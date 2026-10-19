// api/_lib/ratelimit.js — best-effort per-IP rate limiter (fixed window), in memory.
// LIMITATION: state lives in one warm serverless instance, so this blunts casual abuse and runaway loops
// but is not a hard global limit. For a hard limit use a shared store (e.g. Upstash/Vercel KV or Supabase).
const buckets = new Map();
const MAX_KEYS = 5000;

export function clientIp(req) {
  const xff = req.headers && (req.headers['x-forwarded-for'] || req.headers['x-real-ip']);
  return (Array.isArray(xff) ? xff[0] : String(xff || '')).split(',')[0].trim() || 'unknown';
}

/** Returns true if the request is allowed; false if the caller exceeded `limit` hits in `windowMs`. */
export function allow(key, limit, windowMs, now = Date.now()) {
  if (buckets.size > MAX_KEYS) for (const [k, v] of buckets) if (v.reset <= now) buckets.delete(k);
  if (buckets.size > MAX_KEYS) buckets.clear();
  const b = buckets.get(key);
  if (!b || b.reset <= now) { buckets.set(key, { n: 1, reset: now + windowMs }); return true; }
  b.n += 1;
  return b.n <= limit;
}

/** Sends a 429 and returns true when limited. Usage: if (limited(req, res, 'weather', 60)) return; */
export function limited(req, res, name, limitPerMin) {
  if (allow(name + ':' + clientIp(req), limitPerMin, 60000)) return false;
  res.setHeader('Retry-After', '60');
  res.status(429).json({ error: 'Too many requests. Please wait a minute and try again.' });
  return true;
}
