// api/_lib/util.js
// Small shared helpers for the chat assistant's tool layer. Files/folders
// prefixed with "_" inside /api are NOT deployed as routes by Vercel, so this
// directory is import-only.

export const PH_TZ = 'Asia/Manila';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** fetch + JSON with a hard timeout and an optional parent AbortSignal. */
export async function fetchJson(url, { headers, timeoutMs = 6000, signal } = {}) {
  const signals = [AbortSignal.timeout(timeoutMs)];
  if (signal) signals.push(signal);
  const res = await fetch(url, { headers, signal: AbortSignal.any(signals) });
  if (!res.ok) throw new HttpError(res.status, `HTTP ${res.status} from ${new URL(url).host}`);
  return res.json();
}

// ---- tiny in-memory TTL cache (per warm serverless instance) --------------
// Cuts repeat upstream calls (USGS, OpenWeather, VolcView) when several people
// ask the same thing within a few minutes. Failures are never cached.
const store = new Map();
export async function cached(key, ttlMs, producer) {
  const hit = store.get(key);
  if (hit && hit.exp > Date.now()) return hit.value;
  const value = await producer();
  store.set(key, { value, exp: Date.now() + ttlMs });
  if (store.size > 300) {
    for (const [k, v] of store) if (v.exp <= Date.now()) store.delete(k);
    if (store.size > 300) store.delete(store.keys().next().value);
  }
  return value;
}
export function _clearCache() { store.clear(); } // for tests

// ---- value helpers ---------------------------------------------------------
export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

export function toInt(v, dflt, lo, hi) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? clamp(n, lo, hi) : dflt;
}
export function toNum(v, dflt, lo, hi) {
  const n = Number(v);
  return Number.isFinite(n) ? clamp(n, lo, hi) : dflt;
}

/** Plain-text field coming from a database or a person: strip control chars,
 *  collapse whitespace, cap the length. Defence-in-depth for prompt injection
 *  (the system prompt also tells the model to treat tool output as data). */
export function clean(value, max = 200) {
  if (value == null) return '';
  const s = String(value).replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ').replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s;
}

/** A search term that is safe to embed in a PostgREST ilike filter. */
export function safeTerm(value, max = 60) {
  return String(value ?? '').replace(/[^\p{L}\p{N} .'-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const DIRS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
export const compass = (deg) => DIRS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];

/** "12 minutes ago" — computed server-side so the model never does date math. */
export function ago(ms, now = Date.now()) {
  const diff = Math.max(0, now - ms);
  const min = Math.round(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  const d = Math.round(hr / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

/** Local Philippine date/time string for the system prompt. */
export function phNow(now = new Date()) {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: PH_TZ, dateStyle: 'full', timeStyle: 'short',
  }).format(now);
}
export function phDateKey(ms) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: PH_TZ }).format(new Date(ms)); // YYYY-MM-DD
}
export function phWeekday(ms) {
  return new Intl.DateTimeFormat('en-PH', { timeZone: PH_TZ, weekday: 'long' }).format(new Date(ms));
}
