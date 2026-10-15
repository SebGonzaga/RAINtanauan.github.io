// api/_lib/tools.js
// Read-only "tools" the RAIN assistant (Gemini) can call to look up live data
// instead of guessing. Everything here is a GET: the assistant can read the
// app's data, it can never create, change or delete anything.
//
// Safety model
//  * Arguments come from the model, so every one is validated/clamped.
//  * Supabase is queried with the SIGNED-IN USER'S OWN access token and the
//    public publishable key -- never the service-role key -- so Row Level
//    Security applies exactly as it does in the browser.
//  * Text that originated from people (alert messages, incident reports) is
//    sanitised + length-capped, and the system prompt tells the model to treat
//    tool output as data, not instructions.
//  * Every tool returns a plain object with `ok: true|false`; failures never
//    throw out of executeTool().

import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {
  HttpError, fetchJson, cached, clean, safeTerm, toInt, toNum,
  haversineKm, compass, ago, phDateKey, phWeekday,
} from './util.js';

const OWM = 'https://api.openweathermap.org';
const USGS_QUAKES = 'https://earthquake.usgs.gov/fdsnws/event/1/query';
const VOLCVIEW = 'https://volcview.wr.usgs.gov/vv-api/volcanoApi/wwvolcanoes';

// Same project URL / publishable key as assets/js/supabase-client.js. The
// publishable key is public by design (it grants nothing beyond RLS).
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ajvjxqdylnysmvlajvdr.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_jgfGCr4QV6bJCppnEG8Pew_jwuGP472';

// Mirrors volcano.html (TAAL_VNUM / TAAL_FALLBACK) and main.js (PH_QUAKE_BBOX).
const TAAL = { vnum: '273070', lat: 14.0021, lng: 120.9932, elevM: 311 };
const PH_BBOX = { minlatitude: 4, maxlatitude: 21, minlongitude: 116, maxlongitude: 127 };
const DEFAULT_LOC = { lat: 14.0863, lng: 121.1497, label: 'Tanauan City, Batangas' };
const AVIATION_COLOR = { GREEN: 'Green (normal)', YELLOW: 'Yellow (advisory)', ORANGE: 'Orange (watch)', RED: 'Red (warning)' };

const MIN = 60 * 1000;

// ---------------------------------------------------------------------------
// Shared lookups
// ---------------------------------------------------------------------------
function owmKey() {
  const k = process.env.OPENWEATHER_API_KEY;
  if (!k) throw new Error('weather provider not configured');
  return k;
}

async function geocode(place, signal) {
  const q = safeTerm(place, 80);
  if (!q) return null;
  const key = owmKey();
  const list = await cached(`geo:${q.toLowerCase()}`, 24 * 60 * MIN, () =>
    fetchJson(`${OWM}/geo/1.0/direct?q=${encodeURIComponent(q + ',PH')}&limit=1&appid=${key}`, { signal }));
  const g = Array.isArray(list) ? list[0] : null;
  if (!g) return null;
  return { lat: g.lat, lng: g.lon, label: [g.name, g.state].filter(Boolean).join(', ') };
}

/** Where should "here" be? An explicit place beats the user's location, which
 *  beats their saved area, which beats Tanauan City (the app's default centre). */
async function resolveLocation(ctx, place) {
  if (place) {
    const g = await geocode(place, ctx.signal);
    if (!g) return { error: `No Philippine place found called "${clean(place, 40)}"` };
    return g;
  }
  if (ctx.lat != null && ctx.lng != null) return { lat: ctx.lat, lng: ctx.lng, label: ctx.city || 'your location' };
  if (ctx.city) {
    try {
      const g = await geocode(ctx.city, ctx.signal);
      if (g) return { ...g, label: ctx.city };
    } catch { /* fall through to default */ }
  }
  return { ...DEFAULT_LOC, assumedDefault: true };
}

const r2 = (n) => Math.round(n * 100) / 100;
const owmKeyFor = (lat, lng) => `${lat.toFixed(2)},${lng.toFixed(2)}`;

function owmCurrent(lat, lng, signal) {
  const key = owmKey();
  return cached(`owm:cur:${owmKeyFor(lat, lng)}`, 10 * MIN, () =>
    fetchJson(`${OWM}/data/2.5/weather?lat=${lat}&lon=${lng}&units=metric&appid=${key}`, { signal }));
}

// ---------------------------------------------------------------------------
// Static reference data (evacuation centers, emergency numbers)
// ---------------------------------------------------------------------------
// These live in the browser bundle (assets/js/demo-data.js). Evaluating that
// one file in an empty sandbox gives the server the SAME list the Emergency
// page shows, with no second copy to keep in sync. vercel.json bundles the
// file with the function (functions.includeFiles).
let demoData;
function loadDemo() {
  if (demoData !== undefined) return demoData;
  try {
    const file = path.join(process.cwd(), 'assets', 'js', 'demo-data.js');
    const fromSandbox = vm.runInNewContext(`${readFileSync(file, 'utf8')}\n;RAIN_DEMO`, { window: {} }, { timeout: 1000 });
    // Deep-copy into this realm: drops the sandbox's functions/prototypes and
    // keeps only plain data (arrays/objects/strings/numbers).
    demoData = JSON.parse(JSON.stringify(fromSandbox));
  } catch (err) {
    console.error('chat tools: could not load demo-data.js:', err.message);
    demoData = null;
  }
  return demoData;
}

// ---------------------------------------------------------------------------
// Supabase (as the signed-in user)
// ---------------------------------------------------------------------------
function supabaseGet(pathAndQuery, token, signal) {
  return fetchJson(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal,
  });
}
const NEEDS_SIGN_IN = {
  ok: false, available: false,
  error: 'This needs a signed-in RAIN account and this person is not signed in (or their session expired).',
};

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------
const obj = (properties = {}, required = []) => ({ type: 'object', properties, required });

export const TOOLS = {
  get_current_weather: {
    meta: { label: 'Weather', source: 'OpenWeather' },
    declaration: {
      name: 'get_current_weather',
      description: 'Current weather right now: temperature, conditions, wind, humidity, recent rain. Use for "is it raining?", "how hot/windy is it?", typhoon or flood checks. Defaults to the person\'s saved area.',
      parameters: obj({ place: { type: 'string', description: 'Optional Philippine city/municipality, e.g. "Tagaytay". Omit to use the person\'s own area.' } }),
    },
    async run(args, ctx) {
      const loc = await resolveLocation(ctx, args.place);
      if (loc.error) return { ok: false, error: loc.error };
      const d = await owmCurrent(loc.lat, loc.lng, ctx.signal);
      const observedMs = (d.dt || Date.now() / 1000) * 1000;
      return {
        ok: true,
        location: loc.label,
        ...(loc.assumedDefault && { assumedDefault: true }),
        temperatureC: Math.round(d.main.temp),
        feelsLikeC: Math.round(d.main.feels_like),
        condition: d.weather?.[0]?.description,
        humidityPercent: d.main.humidity,
        windKmh: Math.round((d.wind?.speed ?? 0) * 3.6),
        ...(d.wind?.gust != null && { gustKmh: Math.round(d.wind.gust * 3.6) }),
        ...(d.wind?.deg != null && { windFrom: compass(d.wind.deg) }),
        cloudCoverPercent: d.clouds?.all,
        rainLastHourMm: d.rain?.['1h'] ?? 0,
        observedAt: new Date(observedMs).toISOString(),
        observedAgo: ago(observedMs),
        source: 'OpenWeather',
      };
    },
  },

  get_weather_forecast: {
    meta: { label: 'Forecast', source: 'OpenWeather' },
    declaration: {
      name: 'get_weather_forecast',
      description: 'Short-range forecast (next ~3 days): temperature range, chance and amount of rain, strongest wind. Use for "will it rain tomorrow?", typhoon/flood planning, "should I evacuate/travel?".',
      parameters: obj({ place: { type: 'string', description: 'Optional Philippine city/municipality. Omit to use the person\'s own area.' } }),
    },
    async run(args, ctx) {
      const loc = await resolveLocation(ctx, args.place);
      if (loc.error) return { ok: false, error: loc.error };
      const key = owmKey();
      const d = await cached(`owm:fc:${owmKeyFor(loc.lat, loc.lng)}`, 30 * MIN, () =>
        fetchJson(`${OWM}/data/2.5/forecast?lat=${loc.lat}&lon=${loc.lng}&units=metric&appid=${key}`, { signal: ctx.signal }));
      const days = new Map();
      for (const e of d.list || []) {
        const ms = e.dt * 1000;
        const k = phDateKey(ms);
        if (!days.has(k)) days.set(k, { date: k, day: phWeekday(ms), tmin: Infinity, tmax: -Infinity, pop: 0, rain: 0, wind: 0, conds: {} });
        const day = days.get(k);
        day.tmin = Math.min(day.tmin, e.main.temp_min);
        day.tmax = Math.max(day.tmax, e.main.temp_max);
        day.pop = Math.max(day.pop, e.pop ?? 0);
        day.rain += e.rain?.['3h'] ?? 0;
        day.wind = Math.max(day.wind, e.wind?.speed ?? 0);
        const c = e.weather?.[0]?.description;
        if (c) day.conds[c] = (day.conds[c] || 0) + 1;
      }
      const out = [...days.values()].slice(0, 3).map((x) => ({
        date: x.date,
        day: x.day,
        lowC: Math.round(x.tmin),
        highC: Math.round(x.tmax),
        chanceOfRainPercent: Math.round(x.pop * 100),
        expectedRainMm: Math.round(x.rain * 10) / 10,
        maxWindKmh: Math.round(x.wind * 3.6),
        mostly: Object.entries(x.conds).sort((a, b) => b[1] - a[1])[0]?.[0],
      }));
      return {
        ok: true,
        location: loc.label,
        ...(loc.assumedDefault && { assumedDefault: true }),
        days: out,
        note: 'Today may be a partial day. Forecasts change; confirm with PAGASA for official typhoon signals.',
        source: 'OpenWeather',
      };
    },
  },

  get_recent_earthquakes: {
    meta: { label: 'Earthquakes', source: 'USGS' },
    declaration: {
      name: 'get_recent_earthquakes',
      description: 'Recent earthquakes in and around the Philippines (magnitude, place, depth, how long ago, distance from the person). Use for "was there an earthquake?", "any quakes today?", "what was that shaking?".',
      parameters: obj({
        days: { type: 'integer', description: 'Look-back window in days, 1-30. Default 3.' },
        min_magnitude: { type: 'number', description: 'Minimum magnitude, 2.5-8. Default 3.' },
      }),
    },
    async run(args, ctx) {
      const days = toInt(args.days, 3, 1, 30);
      const minMag = toNum(args.min_magnitude, 3, 2.5, 8);
      const geo = await cached(`usgs:${days}:${minMag}`, 5 * MIN, async () => {
        const end = new Date();
        const start = new Date(end.getTime() - days * 24 * 60 * MIN);
        const p = new URLSearchParams({
          format: 'geojson', orderby: 'time', limit: '200',
          starttime: start.toISOString(), endtime: end.toISOString(), minmagnitude: String(minMag),
          ...Object.fromEntries(Object.entries(PH_BBOX).map(([k, v]) => [k, String(v)])),
        });
        return fetchJson(`${USGS_QUAKES}?${p}`, { signal: ctx.signal });
      });
      const ref = await resolveLocation(ctx, null);
      const quakes = (geo.features || []).map((f) => {
        const [lng, lat, depth] = f.geometry.coordinates;
        const t = f.properties.time;
        return {
          magnitude: f.properties.mag,
          place: clean(f.properties.place, 120),
          occurredAt: new Date(t).toISOString(),
          ago: ago(t),
          depthKm: depth != null ? Math.round(depth) : null,
          distanceFromYouKm: Math.round(haversineKm(ref.lat, ref.lng, lat, lng)),
          tsunamiFlag: !!f.properties.tsunami,
          ...(f.properties.felt ? { feltReports: f.properties.felt } : {}),
        };
      });
      const strongest = quakes.reduce((b, q) => (!b || q.magnitude > b.magnitude ? q : b), null);
      return {
        ok: true,
        windowDays: days,
        minMagnitude: minMag,
        totalFound: quakes.length,
        strongest,
        mostRecent: quakes.slice(0, 6),
        distanceMeasuredFrom: ref.label,
        ...(ref.assumedDefault && { assumedDefault: true }),
        note: 'USGS coverage of small Philippine earthquakes is partial; PHIVOLCS is the official source. Earthquakes cannot be predicted.',
        source: 'USGS',
      };
    },
  },

  get_volcano_status: {
    meta: { label: 'Taal Volcano', source: 'USGS VolcView' },
    declaration: {
      name: 'get_volcano_status',
      description: 'Taal Volcano snapshot: location, aviation colour code, and the wind at the volcano right now (useful for which way ash would drift). Use for "how is Taal?", ashfall questions.',
      parameters: obj(),
    },
    async run(_args, ctx) {
      let rec = null;
      try {
        const all = await cached('volcview:all', 30 * MIN, () => fetchJson(VOLCVIEW, { timeoutMs: 8000, signal: ctx.signal }));
        rec = Array.isArray(all) ? all.find((x) => String(x.vnum) === TAAL.vnum) : null;
      } catch { /* fall back to static coordinates below */ }
      const lat = rec?.lat ?? TAAL.lat;
      const lng = rec?.lng ?? TAAL.lng;
      let wind = null;
      try {
        const w = await owmCurrent(lat, lng, ctx.signal);
        if (w.wind?.deg != null) {
          wind = {
            speedKmh: Math.round((w.wind.speed ?? 0) * 3.6),
            blowingFrom: compass(w.wind.deg),
            driftingToward: compass(w.wind.deg + 180),
            note: 'Wind direction only; this is not an ashfall forecast.',
          };
        }
      } catch { /* wind is optional */ }
      const color = rec?.color ? String(rec.color).toUpperCase() : null;
      return {
        ok: true,
        volcano: 'Taal Volcano',
        liveRecord: !!rec,
        coordinates: { lat, lng },
        elevationM: rec?.elevM ?? TAAL.elevM,
        aviationColorCode: color ? (AVIATION_COLOR[color] || clean(color, 20)) : 'none on file',
        wind,
        officialAlertLevel: {
          available: false,
          note: 'PHIVOLCS Alert Levels (0-5) have no public API, so none is available here. The aviation colour code is a different scale. Point the person to the Volcano page / PHIVOLCS for the official level.',
        },
        source: rec ? 'USGS VolcView' : 'static reference coordinates',
      };
    },
  },

  get_active_alerts: {
    meta: { label: 'RAIN Alerts', source: 'RAIN' },
    declaration: {
      name: 'get_active_alerts',
      description: 'Alerts currently in effect that RAIN administrators have issued (typhoon, flood, volcanic, etc.) with severity and affected area. Use for "any alerts?", "is there a warning for my area?".',
      parameters: obj({
        area: { type: 'string', description: 'Optional place name to filter by, e.g. "Batangas".' },
        min_severity: { type: 'string', enum: ['advisory', 'warning', 'critical'], description: 'Only this severity and above. Default: all.' },
      }),
    },
    async run(args, ctx) {
      if (!ctx.token) return NEEDS_SIGN_IN;
      const nowIso = encodeURIComponent(new Date().toISOString());
      const q = [
        'select=title,type,severity,area,message,starts_at,expires_at',
        `starts_at=lte.${nowIso}`,
        `or=(expires_at.is.null,expires_at.gt.${nowIso})`,
        'order=starts_at.desc', 'limit=8',
      ];
      if (args.min_severity === 'critical') q.push('severity=eq.critical');
      else if (args.min_severity === 'warning') q.push('severity=in.(warning,critical)');
      const area = safeTerm(args.area, 40);
      if (area) q.push(`area=ilike.*${encodeURIComponent(area)}*`);
      let rows;
      try { rows = await supabaseGet(`alerts?${q.join('&')}`, ctx.token, ctx.signal); }
      catch (e) { if (e instanceof HttpError && [401, 403].includes(e.status)) return NEEDS_SIGN_IN; throw e; }
      return {
        ok: true,
        count: rows.length,
        alerts: rows.map((a) => ({
          title: clean(a.title, 120),
          type: clean(a.type, 40),
          severity: a.severity,
          area: clean(a.area, 120),
          message: clean(a.message, 400),
          startedAgo: ago(Date.parse(a.starts_at)),
          expiresAt: a.expires_at || null,
        })),
        note: rows.length ? undefined : 'No active RAIN alerts match. This does not replace official PAGASA/PHIVOLCS/NDRRMC bulletins.',
        source: 'RAIN alerts (issued by administrators)',
      };
    },
  },

  get_recent_incidents: {
    meta: { label: 'Incident Reports', source: 'RAIN' },
    declaration: {
      name: 'get_recent_incidents',
      description: 'Recent community incident reports that an administrator has VERIFIED (flooding, road damage, ashfall, etc.). Use for "what is happening near me?", "is the road flooded?".',
      parameters: obj({
        category: { type: 'string', description: 'Optional category filter, e.g. "Flooding".' },
        area: { type: 'string', description: 'Optional place name filter.' },
        hours: { type: 'integer', description: 'Look-back window in hours, 1-168. Default 48.' },
      }),
    },
    async run(args, ctx) {
      if (!ctx.token) return NEEDS_SIGN_IN;
      const hours = toInt(args.hours, 48, 1, 168);
      const since = encodeURIComponent(new Date(Date.now() - hours * 60 * MIN).toISOString());
      const q = [
        'select=title,category,area,description,created_at',
        'status=eq.verified', `created_at=gte.${since}`,
        'order=created_at.desc', 'limit=6',
      ];
      const cat = safeTerm(args.category, 40);
      if (cat) q.push(`category=ilike.*${encodeURIComponent(cat)}*`);
      const area = safeTerm(args.area, 40);
      if (area) q.push(`area=ilike.*${encodeURIComponent(area)}*`);
      let rows;
      try { rows = await supabaseGet(`incidents?${q.join('&')}`, ctx.token, ctx.signal); }
      catch (e) { if (e instanceof HttpError && [401, 403].includes(e.status)) return NEEDS_SIGN_IN; throw e; }
      return {
        ok: true,
        windowHours: hours,
        count: rows.length,
        incidents: rows.map((i) => ({
          title: clean(i.title, 120),
          category: clean(i.category, 40),
          area: clean(i.area, 120),
          details: clean(i.description, 200),
          reportedAgo: ago(Date.parse(i.created_at)),
        })),
        note: 'Only administrator-verified reports are included; unverified reports are not shown.',
        source: 'RAIN community reports (verified)',
      };
    },
  },

  find_evacuation_centers: {
    meta: { label: 'Evacuation Centers', source: 'RAIN' },
    declaration: {
      name: 'find_evacuation_centers',
      description: 'Nearest listed evacuation centers / designated shelters with address, contact number, facilities and distance. Use for "where do I evacuate?", "nearest shelter".',
      parameters: obj({
        near: { type: 'string', description: 'Optional Philippine place to search near. Omit to use the person\'s own area.' },
        category: { type: 'string', enum: ['shelter', 'government', 'mall'], description: 'Optional type filter.' },
        limit: { type: 'integer', description: 'How many to return, 1-5. Default 3.' },
      }),
    },
    async run(args, ctx) {
      const demo = loadDemo();
      if (!demo?.evacuationCenters?.length) return { ok: false, error: 'The evacuation center list is not available right now.' };
      const loc = await resolveLocation(ctx, args.near);
      if (loc.error) return { ok: false, error: loc.error };
      const limit = toInt(args.limit, 3, 1, 5);
      const list = demo.evacuationCenters
        .filter((c) => !args.category || c.category === args.category)
        .map((c) => ({ c, d: haversineKm(loc.lat, loc.lng, c.lat, c.lng) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, limit)
        .map(({ c, d }) => ({
          name: clean(c.name, 100), type: clean(c.type, 40), address: clean(c.address, 140),
          contact: clean(c.contact, 40), facilities: clean(c.facilities, 140),
          distanceKm: Math.round(d * 10) / 10,
        }));
      return {
        ok: true,
        searchedNear: loc.label,
        ...(loc.assumedDefault && { assumedDefault: true }),
        centers: list,
        note: 'Distances are straight-line from approximate coordinates. Ask local officials which centers are open before travelling.',
        source: 'Tanauan City CDRRMO evacuation center list',
      };
    },
  },

  get_emergency_contacts: {
    meta: { label: 'Emergency Contacts', source: 'RAIN' },
    declaration: {
      name: 'get_emergency_contacts',
      description: 'Official Philippine emergency hotline numbers (police, fire, medical, NDRRMC) as listed in this app.',
      parameters: obj(),
    },
    async run() {
      const demo = loadDemo();
      if (!demo?.emergencyContacts?.length) return { ok: false, error: 'The contact list is not available right now.' };
      return {
        ok: true,
        contacts: demo.emergencyContacts.map((c) => ({ name: clean(c.name, 80), number: clean(c.number, 30) })),
        source: 'RAIN emergency contacts (Tanauan City CDRRMO)',
      };
    },
  },
};

export const TOOL_DECLARATIONS = Object.values(TOOLS).map((t) => t.declaration);
export const toolMeta = (name) => TOOLS[name]?.meta;

function friendlyError(err) {
  if (err?.name === 'TimeoutError' || err?.name === 'AbortError') return 'The data source took too long to respond.';
  if (err instanceof HttpError) return `The data source is unavailable right now (${err.status}).`;
  if (/not configured/.test(err?.message || '')) return 'This data source is not set up on the server yet.';
  return 'The data source is unavailable right now.';
}

/** Runs one tool call. Never throws -- returns { result, ok } for the model. */
export async function executeTool(name, rawArgs, ctx) {
  const tool = TOOLS[name];
  if (!tool) return { ok: false, result: { ok: false, error: `Unknown tool "${clean(name, 40)}".` } };
  const args = rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs) ? rawArgs : {};
  let timer;
  try {
    const result = await Promise.race([
      tool.run(args, ctx),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Object.assign(new Error('tool timeout'), { name: 'TimeoutError' })), 9000);
      }),
    ]);
    return { ok: result?.ok !== false, result };
  } catch (err) {
    console.error(`tool ${name} failed:`, err?.message || err);
    return { ok: false, result: { ok: false, error: friendlyError(err) } };
  } finally {
    clearTimeout(timer);
  }
}
