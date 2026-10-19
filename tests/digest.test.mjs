import { test } from 'node:test';
import assert from 'node:assert/strict';
import { htmlToText, extractAlertLevel, parseModelJson, numbersSupported, phtDate } from '../api/_lib/digest.js';
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
  const t = run({ DIGEST_VOLCANO_URL: 'https://src.test/taal' }, (url) => { if (url.includes('/rest/v1/ai_digests?select')) return ok([{ status: 'ok' }]); throw new Error('unexpected ' + url); });
  await handler({ method: 'GET', headers: { authorization: 'Bearer sekret' } }, t.res); t.done();
  assert.equal(t.res.body.results.volcano, 'already done today');
});
