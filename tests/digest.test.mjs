import { test } from 'node:test';
import assert from 'node:assert/strict';
import { htmlToText, extractAlertLevel, parseModelJson, numbersSupported, phtDate, buildImagePrompt, extractImage, findLatestBulletinUrl, parseTaalBulletin } from '../api/_lib/digest.js';
import handler from '../api/daily-digest.js';

test('htmlToText drops scripts/tags and decodes entities', () => {
  const t = htmlToText('<html><script>evil()</script><p>Alert&nbsp;Level 2 &amp; rising</p><style>x{}</style><div>Next</div></html>');
  assert.equal(t, 'Alert Level 2 & rising\nNext');
});
test('extractAlertLevel needs exactly one level', () => {
  assert.equal(extractAlertLevel('Alert Level 2 remains. Alert Level 2 (increased unrest)'), 2);
  assert.equal(extractAlertLevel('Alert Level 2 may be raised to Alert Level 3'), null);
  assert.equal(extractAlertLevel('no level here'), null);
  assert.equal(extractAlertLevel('Alert Level 7'), null);
});
test('parseModelJson accepts fenced JSON and rejects junk', () => {
  assert.match(parseModelJson('```json\n{"summary":"Calm.","points":["a"]}\n```').summary, /Calm\.\n• a/);
  assert.equal(parseModelJson('not json'), null);
  assert.equal(parseModelJson('{"summary":""}'), null);
});
test('numbersSupported blocks invented figures', () => {
  assert.equal(numbersSupported('Level 2 with 34 earthquakes', 'Alert Level 2 ... 34 volcanic earthquakes'), true);
  assert.equal(numbersSupported('Level 2 with 99 earthquakes', 'Alert Level 2 ... 34 volcanic earthquakes'), false);
  assert.equal(numbersSupported('SO2 2,010 tonnes', 'averaged 2,010 tonnes/day'), true);
});
test('phtDate uses the Manila calendar day', () => {
  assert.equal(phtDate(new Date('2026-10-17T16:30:00Z')), '2026-10-18');
  assert.equal(phtDate(new Date('2026-10-17T15:59:00Z')), '2026-10-17');
});

// ---- handler with a stubbed network ----
function run(env, net) {
  const saved = { ...process.env }, realFetch = globalThis.fetch, calls = [];
  Object.assign(process.env, { SUPABASE_URL: 'https://sb.test', SUPABASE_SERVICE_ROLE_KEY: 'svc', GEMINI_API_KEY: 'g', CRON_SECRET: 'sekret', ...env });
  globalThis.fetch = async (url, opts = {}) => { calls.push({ url: String(url), opts }); return net(String(url), opts); };
  const res = { code: 0, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
  return { res, calls, done: () => { globalThis.fetch = realFetch; for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k]; Object.assign(process.env, saved); } };
}
const ok = (b) => ({ ok: true, status: 200, json: async () => b, text: async () => (typeof b === 'string' ? b : JSON.stringify(b)) });
const PAGE = '<p>' + 'Taal Volcano Bulletin. Alert Level 2 remains in effect. '.repeat(6) + '34 volcanic earthquakes were recorded.</p>';

test('rejects missing or wrong secret', async () => {
  const t = run({}, () => ok([]));
  await handler({ method: 'GET', headers: {} }, t.res); t.done();
  assert.equal(t.res.code, 401);
});
test('stores an ok digest with the extracted level, and skips unset sources', async () => {
  const t = run({ DIGEST_VOLCANO_URL: 'https://src.test/taal' }, (url) => {
    if (url.includes('/rest/v1/ai_digests?select')) return ok([]);
    if (url === 'https://src.test/taal') return ok(PAGE);
    if (url.includes('generateContent')) return ok({ candidates: [{ content: { parts: [{ text: '{"summary":"Alert Level 2 with 34 volcanic earthquakes.","points":[]}' }] } }] });
    if (url.includes('on_conflict')) return { ok: true, status: 201 };
    throw new Error('unexpected ' + url);
  });
  await handler({ method: 'GET', headers: { authorization: 'Bearer sekret' } }, t.res); t.done();
  const saved = JSON.parse(t.calls.find((c) => c.url.includes('on_conflict')).opts.body);
  assert.equal(t.res.code, 200);
  assert.equal(saved.status, 'ok'); assert.equal(saved.alert_level, 2); assert.equal(saved.kind, 'volcano');
  assert.match(t.res.body.results.heat, /skipped/);
});
test('marks the row source_unreachable when the page fails, and never calls the AI', async () => {
  const t = run({ DIGEST_VOLCANO_URL: 'https://src.test/taal' }, (url) => {
    if (url.includes('/rest/v1/ai_digests?select')) return ok([]);
    if (url === 'https://src.test/taal') return { ok: false, status: 503 };
    if (url.includes('on_conflict')) return { ok: true, status: 201 };
    throw new Error('unexpected ' + url);
  });
  await handler({ method: 'GET', headers: { authorization: 'Bearer sekret' } }, t.res); t.done();
  assert.equal(JSON.parse(t.calls.find((c) => c.url.includes('on_conflict')).opts.body).status, 'source_unreachable');
  assert.ok(!t.calls.some((c) => c.url.includes('generateContent')));
});
test('does not publish a summary containing invented numbers', async () => {
  const t = run({ DIGEST_VOLCANO_URL: 'https://src.test/taal' }, (url) => {
    if (url.includes('/rest/v1/ai_digests?select')) return ok([]);
    if (url === 'https://src.test/taal') return ok(PAGE);
    if (url.includes('generateContent')) return ok({ candidates: [{ content: { parts: [{ text: '{"summary":"There were 500 earthquakes.","points":[]}' }] } }] });
    if (url.includes('on_conflict')) return { ok: true, status: 201 };
    throw new Error('unexpected ' + url);
  });
  await handler({ method: 'GET', headers: { authorization: 'Bearer sekret' } }, t.res); t.done();
  const saved = JSON.parse(t.calls.find((c) => c.url.includes('on_conflict')).opts.body);
  assert.equal(saved.status, 'ai_failed'); assert.equal(saved.summary, null);
});
test('skips work already done today', async () => {
  const t = run({ DIGEST_VOLCANO_URL: 'https://src.test/taal' }, (url) => { if (url.includes('/rest/v1/ai_digests?select')) return ok([{ status: 'ok', image_url: 'https://sb.test/storage/v1/object/public/digest-images/volcano/x.png', summary: 's', metrics: { alert_level: 1 } }]); throw new Error('unexpected ' + url); });
  await handler({ method: 'GET', headers: { authorization: 'Bearer sekret' } }, t.res); t.done();
  assert.equal(t.res.body.results.volcano, 'already done today');
});

// ---- illustration step ----
const PNG_B64 = Buffer.alloc(400, 7).toString('base64');
const IMG_RESP = { candidates: [{ content: { parts: [{ text: 'here' }, { inlineData: { mimeType: 'image/png', data: PNG_B64 } }] } }] };
const SUMMARY_RESP = { candidates: [{ content: { parts: [{ text: '{"summary":"Alert Level 2 with 34 volcanic earthquakes.","points":[]}' }] } }] };

test('buildImagePrompt uses the summary and forbids text and invented drama', () => {
  const p = buildImagePrompt('volcano', 'Alert Level 1. Calm.');
  assert.match(p, /Alert Level 1\. Calm\./); assert.match(p, /No text/); assert.match(p, /do NOT draw eruptions/);
});
test('extractImage returns the inline image and rejects other data', () => {
  assert.equal(extractImage(IMG_RESP).ext, 'png');
  assert.equal(extractImage(SUMMARY_RESP), null);
  assert.equal(extractImage({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'text/html', data: PNG_B64 } }] } }] }), null);
});
test('an ok digest also gets an uploaded illustration linked on its row', async () => {
  const t = run({ DIGEST_VOLCANO_URL: 'https://src.test/taal' }, (url) => {
    if (url.includes('/rest/v1/ai_digests?select')) return ok([]);
    if (url === 'https://src.test/taal') return ok(PAGE);
    if (url.includes('gemini-2.5-flash-image:generateContent')) return ok(IMG_RESP);
    if (url.includes('generateContent')) return ok(SUMMARY_RESP);
    if (url.includes('/storage/v1/object/digest-images/')) return { ok: true, status: 200 };
    if (url.includes('on_conflict') || url.includes('kind=eq.volcano')) return { ok: true, status: 204 };
    throw new Error('unexpected ' + url);
  });
  await handler({ method: 'GET', headers: { authorization: 'Bearer sekret' } }, t.res); t.done();
  assert.match(t.res.body.results.volcano, /image ok/);
  const patch = t.calls.find((c) => c.opts.method === 'PATCH');
  assert.match(JSON.parse(patch.opts.body).image_url, /\/storage\/v1\/object\/public\/digest-images\/volcano\/.+\.png$/);
});
test('if the picture fails the text summary is still saved and the run does not crash', async () => {
  const t = run({ DIGEST_VOLCANO_URL: 'https://src.test/taal' }, (url) => {
    if (url.includes('/rest/v1/ai_digests?select')) return ok([]);
    if (url === 'https://src.test/taal') return ok(PAGE);
    if (url.includes('gemini-2.5-flash-image:generateContent')) return { ok: false, status: 429 };
    if (url.includes('generateContent')) return ok(SUMMARY_RESP);
    if (url.includes('on_conflict')) return { ok: true, status: 201 };
    throw new Error('unexpected ' + url);
  });
  await handler({ method: 'GET', headers: { authorization: 'Bearer sekret' } }, t.res); t.done();
  assert.equal(t.res.code, 200);
  assert.equal(JSON.parse(t.calls.find((c) => c.url.includes('on_conflict')).opts.body).status, 'ok');
  assert.match(t.res.body.results.volcano, /image failed/);
});
test('DIGEST_IMAGES=off never calls the image model', async () => {
  const t = run({ DIGEST_VOLCANO_URL: 'https://src.test/taal', DIGEST_IMAGES: 'off' }, (url) => {
    if (url.includes('/rest/v1/ai_digests?select')) return ok([]);
    if (url === 'https://src.test/taal') return ok(PAGE);
    if (url.includes('generateContent')) return ok(SUMMARY_RESP);
    if (url.includes('on_conflict')) return { ok: true, status: 201 };
    throw new Error('unexpected ' + url);
  });
  await handler({ method: 'GET', headers: { authorization: 'Bearer sekret' } }, t.res); t.done();
  assert.ok(!t.calls.some((c) => c.url.includes('flash-image')));
});
test('a good summary row with no picture only retries the picture', async () => {
  const t = run({ DIGEST_VOLCANO_URL: 'https://src.test/taal' }, (url) => {
    if (url.includes('/rest/v1/ai_digests?select')) return ok([{ status: 'ok', image_url: null, summary: 'Alert Level 2.', metrics: { alert_level: 2 } }]);
    if (url.includes('flash-image:generateContent')) return ok(IMG_RESP);
    if (url.includes('/storage/v1/object/digest-images/')) return { ok: true, status: 200 };
    if (url.includes('kind=eq.volcano')) return { ok: true, status: 204 };
    throw new Error('unexpected ' + url);
  });
  await handler({ method: 'GET', headers: { authorization: 'Bearer sekret' } }, t.res); t.done();
  assert.match(t.res.body.results.volcano, /summary already done; image ok/);
  assert.ok(!t.calls.some((c) => c.url === 'https://src.test/taal'));
});

// ---- bulletin list page ----
const LIST = '<a href="https://w.test/bulletin/activity-mvo?bid=16940&amp;lang=en">Mayon</a>' +
  '<a href="/bulletin/activity-tvo?bid=16937">Taal FIL</a><a href="/bulletin/activity-tvo?bid=16937&amp;lang=en">Taal EN</a>' +
  '<a href="/bulletin/activity-tvo?bid=16900&amp;lang=en">old</a><a href="https://evil.test/bulletin/activity-tvo?bid=99999&amp;lang=en">x</a>';
test('findLatestBulletinUrl picks the newest Taal bulletin, English, same host only', () => {
  assert.equal(findLatestBulletinUrl(LIST, 'https://w.test/bulletin/list-of-bulletin'), 'https://w.test/bulletin/activity-tvo?bid=16937&lang=en');
  assert.equal(findLatestBulletinUrl('no links', 'https://w.test/x'), null);
  assert.equal(findLatestBulletinUrl(LIST, 'http://w.test/x'), null);
});
test('volcano list page: reads the newest Taal bulletin and stores its URL', async () => {
  const BUL = '<table><tr><td>ALERT LEVEL</td><td>1</td></tr></table>' + '<p>Taal Volcano Summary of 24Hr Observation. Sulfur dioxide 557 tonnes / day. Plume 1800 meters tall. </p>'.repeat(4);
  const t = run({ DIGEST_VOLCANO_URL: 'https://w.test/bulletin/list-of-bulletin', DIGEST_IMAGES: 'off' }, (url) => {
    if (url.includes('/rest/v1/ai_digests?select')) return ok([]);
    if (url === 'https://w.test/bulletin/list-of-bulletin') return ok(LIST);
    if (url === 'https://w.test/bulletin/activity-tvo?bid=16937&lang=en') return ok(BUL);
    if (url.includes('generateContent')) return ok({ candidates: [{ content: { parts: [{ text: '{"summary":"Alert Level 1. Plume 1800 meters tall.","points":[]}' }] } }] });
    if (url.includes('on_conflict')) return { ok: true, status: 201 };
    throw new Error('unexpected ' + url);
  });
  await handler({ method: 'GET', headers: { authorization: 'Bearer sekret' } }, t.res); t.done();
  const saved = JSON.parse(t.calls.find((c) => c.url.includes('on_conflict')).opts.body);
  assert.equal(saved.status, 'ok'); assert.equal(saved.alert_level, 1);
  assert.equal(saved.source_url, 'https://w.test/bulletin/activity-tvo?bid=16937&lang=en');
});

// ---- official numbers copied from the bulletin ----
const ROW = (label, val) => `<tr><td><img src="x.png"><br><b>${label}</b></td><td>${val}</td></tr>`;
const BULLETIN_HTML = '<table><tr><td>ALERT LEVEL</td><td>1</td></tr></table><table><tr><td>Date: 26 October 2026<br>ALERT LEVEL<br>(Low-level unrest)</td><td>1</td></tr></table><p>PARAMETERS</p><table>' +
  ROW('Seismicity', '8 volcanic earthquakes including 1 volcanic tremor (31 hours and 44 minutes duration)') +
  ROW('Acidity</b><br>Main Crater Lake<b>', '0.48 (10 February 2026)') +
  ROW('Temperature</b><br>Main Crater Lake<b>', '63.1 ℃ (10 February 2026)') +
  ROW('Sulfur Dioxide Flux', '557 tonnes / day (23 October 2026)') +
  ROW('Plume', '1800 meters tall; Voluminous emission; north-northwest drift') +
  ROW('Ground Deformation', 'Short-term inflation of Taal Volcano Island') +
  '</table><p>Earthquake Location:</p><p>RECOMMENDATION/COMMENT</p>';
test('parseTaalBulletin copies the parameter table exactly', () => {
  const m = parseTaalBulletin(htmlToText(BULLETIN_HTML));
  assert.equal(m.alert_level, 1); assert.equal(m.alert_label, 'Low-level unrest'); assert.equal(m.bulletin_date, '26 October 2026');
  assert.deepEqual(m.so2, { v: '557 tonnes / day', d: '23 October 2026' });
  assert.deepEqual(m.temperature, { v: '63.1 ℃', d: '10 February 2026' });
  assert.deepEqual(m.acidity, { v: '0.48', d: '10 February 2026' });
  assert.equal(m.seismicity.v, '8 volcanic earthquakes including 1 volcanic tremor (31 hours and 44 minutes duration)');
  assert.equal(m.plume.v, '1800 meters tall; Voluminous emission; north-northwest drift');
  assert.equal(m.deformation.v, 'Short-term inflation of Taal Volcano Island');
});
test('parseTaalBulletin returns null for pages that are not a bulletin', () => {
  assert.equal(parseTaalBulletin('Just some news text about Taal.'), null);
  assert.equal(parseTaalBulletin('PARAMETERS nothing useful here'), null);
});
test('volcano run stores the official numbers, and still saves without them if column 012 is missing', async () => {
  let n = 0;
  const t = run({ DIGEST_VOLCANO_URL: 'https://src.test/b', DIGEST_IMAGES: 'off' }, (url, opts) => {
    if (url.includes('/rest/v1/ai_digests?select')) return ok([]);
    if (url === 'https://src.test/b') return ok(BULLETIN_HTML);
    if (url.includes('generateContent')) return ok({ candidates: [{ content: { parts: [{ text: '{"summary":"Alert Level 1. Plume 1800 meters tall.","points":[]}' }] } }] });
    if (url.includes('on_conflict')) return ++n === 1 ? { ok: false, status: 400 } : { ok: true, status: 201 };
    throw new Error('unexpected ' + url);
  });
  await handler({ method: 'GET', headers: { authorization: 'Bearer sekret' } }, t.res); t.done();
  const posts = t.calls.filter((c) => c.url.includes('on_conflict')).map((c) => JSON.parse(c.opts.body));
  assert.equal(posts.length, 2);
  assert.equal(posts[0].metrics.so2.v, '557 tonnes / day');
  assert.equal(posts[1].metrics, undefined); assert.equal(posts[1].status, 'ok');
});
