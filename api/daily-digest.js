// /api/daily-digest.js — nightly AI digest of PUBLIC PHIVOLCS / PAGASA pages (additional feature; unofficial).
// Triggered by Vercel Cron (vercel.json: 0 16 * * * UTC = 00:00 Philippine time; on the Hobby plan it may fire any time within that hour).
// Env: CRON_SECRET (required; Vercel sends it as a Bearer token), SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY,
//      DIGEST_VOLCANO_URL and/or DIGEST_HEAT_URL (exact public https pages to read; a kind is skipped when its URL is unset),
//      GEMINI_MODEL (optional).
import { htmlToText, extractAlertLevel, SYSTEM_PROMPT, buildPrompt, parseModelJson, numbersSupported, sha256Hex, phtDate } from './_lib/digest.js';

const KINDS = [['volcano', 'DIGEST_VOLCANO_URL'], ['heat', 'DIGEST_HEAT_URL']];
const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models';

const sbHeaders = () => ({ apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` });

async function summarize(kind, text) {
  const model = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
  const r = await fetch(`${GEMINI}/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] }, contents: [{ role: 'user', parts: [{ text: buildPrompt(kind, text) }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 700, responseMimeType: 'application/json' } }),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error('gemini ' + r.status);
  const j = await r.json();
  return { model, parsed: parseModelJson(j?.candidates?.[0]?.content?.parts?.[0]?.text) };
}

async function runOne(kind, url, date) {
  const have = await fetch(`${process.env.SUPABASE_URL}/rest/v1/ai_digests?select=status&kind=eq.${kind}&digest_date=eq.${date}`, { headers: sbHeaders() }).then((r) => (r.ok ? r.json() : [])).catch(() => []);
  if (have[0] && have[0].status === 'ok') return 'already done today'; // cron can fire twice; never overwrite a good row or re-spend AI calls
  const row = { kind, digest_date: date, source_url: url, status: 'source_unreachable', alert_level: null, summary: null, source_fetched_at: null, source_sha256: null, model: null };
  try {
    const page = await fetch(url, { headers: { 'User-Agent': 'RAIN-digest/1.0 (disaster-awareness app)' }, signal: AbortSignal.timeout(8000) });
    if (!page.ok) throw new Error('source ' + page.status);
    const text = htmlToText(await page.text());
    row.source_fetched_at = new Date().toISOString();
    if (text.length < 200) { row.status = 'source_unparsed'; }
    else {
      row.source_sha256 = sha256Hex(text);
      if (kind === 'volcano') row.alert_level = extractAlertLevel(text);
      row.status = 'ai_failed';
      try {
        const { model, parsed } = await summarize(kind, text);
        row.model = model;
        if (parsed && numbersSupported(parsed.summary, text)) { row.summary = parsed.summary; row.status = 'ok'; }
      } catch (e) { console.error('digest AI error:', kind, e.message); }
    }
  } catch (e) { console.error('digest source error:', kind, e.message); }
  const save = await fetch(`${process.env.SUPABASE_URL}/rest/v1/ai_digests?on_conflict=kind,digest_date`, {
    method: 'POST', headers: { ...sbHeaders(), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(row),
  });
  if (!save.ok) { console.error('digest save error:', save.status); return 'could not save'; }
  return row.status;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: 'Unauthorized' });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.GEMINI_API_KEY) return res.status(500).json({ error: 'Server misconfigured' });
  const date = phtDate();
  const out = {};
  await Promise.all(KINDS.map(async ([kind, envName]) => {
    const url = process.env[envName];
    if (!url) { out[kind] = 'skipped (' + envName + ' not set)'; return; }
    if (!/^https:\/\//.test(url)) { out[kind] = 'skipped (URL must be https)'; return; }
    out[kind] = await runOne(kind, url, date);
  }));
  return res.status(200).json({ date, results: out });
}
