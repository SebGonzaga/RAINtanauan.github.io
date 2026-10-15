// /api/chat.js
// Serverless function (Vercel Node.js runtime). Proxies chat messages to
// Google's Gemini API so the API key stays server-side. Called from
// virtual-assistance.html (via RainChatAPI in assets/js/main.js).
//
// The assistant has READ-ONLY access to the app's live data through "tools"
// (see api/_lib/tools.js): weather + forecast (OpenWeather), earthquakes
// (USGS), Taal status (USGS VolcView), active alerts and verified incident
// reports (Supabase, queried with the signed-in user's own token so Row Level
// Security applies), evacuation centers and emergency contacts. Gemini decides
// when it needs one, this function runs it, and the model writes the answer.
//
// Env vars
//   GEMINI_API_KEY        required
//   OPENWEATHER_API_KEY   needed for the weather/forecast/volcano-wind tools
//   GEMINI_MODEL          optional, default below
//   CHAT_TOOLS=off        optional kill switch: answers without live data
//   CHAT_RATE_PER_MIN     optional, per-IP requests/minute (default 15)
//
// Uses the free-tier-eligible Gemini 3.1 Flash-Lite model. Gemini 2.5 Flash
// previously worked here but new Google AI Studio projects are provisioned
// only with current-gen models -- 2.5-flash 404s with "model not found" on
// such keys even though it isn't globally deprecated. Free tier is rate
// limited (https://ai.google.dev/gemini-api/docs/rate-limits) -- tool use
// costs 2+ model calls per question, so watch usage as traffic grows.

import { runAgent } from './_lib/agent.js';
import { buildSystemPrompt } from './_lib/prompt.js';
import { clean, toNum } from './_lib/util.js';

const MAX_MESSAGE_CHARS = 500;
const MAX_HISTORY_ITEMS = 10;
const MAX_HISTORY_CHARS = 1500;
const TOTAL_BUDGET_MS = 22000; // keep under vercel.json maxDuration (30s)

// ---- best-effort per-IP rate limit ------------------------------------------
// In-memory, so it is per warm serverless instance -- it blunts a script
// hammering one instance but is not a global quota. For a hard limit use a
// shared store (Upstash/Vercel KV) or Vercel's firewall rate-limit rules.
const hits = new Map();
function rateLimited(ip) {
  const limit = Number(process.env.CHAT_RATE_PER_MIN) || 15;
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60000);
  if (recent.length >= limit) { hits.set(ip, recent); return true; }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < 60000)) hits.delete(k);
  return false;
}

function parseContext(raw) {
  const c = raw && typeof raw === 'object' ? raw : {};
  const lat = Number(c.lat);
  const lng = Number(c.lng);
  // Only accept coordinates inside the Philippines' bounding box.
  const hasCoords = c.lat != null && c.lng != null && Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= 4 && lat <= 21.5 && lng >= 116 && lng <= 127.5;
  return {
    city: clean(c.city, 60) || null,
    lat: hasCoords ? toNum(lat, null, 4, 21.5) : null,
    lng: hasCoords ? toNum(lng, null, 116, 127.5) : null,
  };
}

function parseBearer(header) {
  const m = /^Bearer ([\w-]+\.[\w-]+\.[\w-]+)$/.exec(header || '');
  return m && m[1].length <= 4096 ? m[1] : null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  if (rateLimited(ip)) {
    res.setHeader('Retry-After', '30');
    return res.status(429).json({ error: 'Too many requests -- please wait a moment.' });
  }

  const { message: rawMessage, history, lang, context } = req.body || {};

  if (!rawMessage || typeof rawMessage !== 'string' || !rawMessage.trim()) {
    return res.status(400).json({ error: 'Missing "message" string in request body' });
  }
  const message = rawMessage.trim();
  if (message.length > MAX_MESSAGE_CHARS) {
    return res.status(400).json({ error: `Message too long (max ${MAX_MESSAGE_CHARS} characters)` });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server misconfigured: GEMINI_API_KEY not set' });
  }

  const model = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
  const toolsEnabled = process.env.CHAT_TOOLS !== 'off';
  const userCtx = parseContext(context);
  const startedAt = Date.now();
  const deadline = startedAt + TOTAL_BUDGET_MS;

  // Gemini's chat format differs from OpenAI's: no "system" role inside the
  // message list (the system prompt goes in its own top-level
  // `system_instruction` field instead), and the AI's own turns are
  // labelled "model" rather than "assistant".
  const contents = [
    ...(Array.isArray(history) ? history.slice(-MAX_HISTORY_ITEMS) : [])
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(m.content).slice(0, MAX_HISTORY_CHARS) }],
      })),
    { role: 'user', parts: [{ text: message }] },
  ];

  const toolCtx = {
    ...userCtx,
    token: parseBearer(req.headers.authorization),
    signal: AbortSignal.timeout(TOTAL_BUDGET_MS),
  };
  const base = { apiKey, model, contents, ctx: toolCtx, deadline };
  const prompt = (withTools) => buildSystemPrompt({ lang, city: userCtx.city, withTools });

  try {
    let result;
    try {
      result = await runAgent({ ...base, systemPrompt: prompt(toolsEnabled), useTools: toolsEnabled });
    } catch (err) {
      // A 400 means Gemini rejected the tool-enabled request itself (schema or
      // signature validation, a model without tool support, ...). Degrade to a
      // plain answer rather than leaving the person with nothing. Other
      // failures (429, 5xx, timeouts) are not retried -- that would only burn
      // more quota or time.
      if (toolsEnabled && err?.status === 400) {
        console.warn('chat.js: tool-enabled request rejected, retrying without tools');
        result = await runAgent({ ...base, systemPrompt: prompt(false), useTools: false });
      } else {
        throw err;
      }
    }

    // Never log message content -- only shape + timing.
    console.log(JSON.stringify({
      chat: 'ok', ms: Date.now() - startedAt, rounds: result.rounds,
      tools: result.toolsUsed.map((t) => `${t.tool}:${t.ok ? 'ok' : 'fail'}`),
      finish: result.finishReason, authed: !!toolCtx.token,
    }));

    // An empty reply (e.g. a safety-filter block) is returned as-is; the
    // frontend's existing fallback-to-demo-reply logic takes over.
    return res.status(200).json({
      reply: result.reply,
      sources: result.toolsUsed,
      asOf: new Date().toISOString(),
    });
  } catch (err) {
    console.error('chat.js error:', err?.message || err);
    if (err?.status === 429) {
      res.setHeader('Retry-After', '30');
      return res.status(429).json({ error: 'The assistant is busy -- please try again shortly.' });
    }
    if (err?.status) return res.status(502).json({ error: 'Upstream chat provider error' });
    return res.status(500).json({ error: 'Something went wrong processing your message' });
  }
}
