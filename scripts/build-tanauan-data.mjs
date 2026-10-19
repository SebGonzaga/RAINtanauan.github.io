#!/usr/bin/env node
// Builds data/*.geojson for Tanauan City, Batangas from PUBLIC sources. Run locally (needs internet), then commit data/.
//   node scripts/build-tanauan-data.mjs --osm-boundaries            (simplest: everything from OpenStreetMap, all unverified)
//   node scripts/build-tanauan-data.mjs [--boundaries path/to/adm4.geojson] [--evac path/to/cdrrmo.csv]   (HDX boundaries win over --osm-boundaries)
// - Schools, barangay halls, evacuation-center CANDIDATES: OpenStreetMap via Overpass (ODbL). Always labeled "unverified".
// - Barangay boundaries: a GeoJSON you export from the HDX COD-AB dataset (PSA/NAMRIA); labeled "indicative", not official.
// - Evacuation centers: a CSV from the CDRRMO is the only way to get "official" status (see data/evacuation-centers.template.csv).
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const OUT = path.resolve(process.env.DATA_DIR || 'data');
const today = new Date().toISOString().slice(0, 10);
const inPH = (lng, lat) => lng >= 116 && lng <= 127.5 && lat >= 4 && lat <= 21.5;
const write = (file, features, meta) => {
  fs.writeFileSync(path.join(OUT, file), JSON.stringify({ type: 'FeatureCollection',
    _meta: { ...meta, generatedOn: today, crs: 'WGS84 (EPSG:4326), [lng, lat]' }, features }, null, 1));
  console.log(`${file}: ${features.length} features`);
};
fs.mkdirSync(OUT, { recursive: true });
// Cross-check names against data/tanauan-barangay-list.csv (48 barangays, PSA/NAMRIA via OCHA, Feb 2025). Reports, never guesses.
const norm = (x) => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
function checkAgainstList(names) {
  const f = path.resolve('data/tanauan-barangay-list.csv');
  if (!fs.existsSync(f)) return { pcode: new Map(), missing: [], extra: [] };
  const list = parseCsv(fs.readFileSync(f, 'utf8')).slice(1).map((r) => ({ name: r[0], pcode: r[1] }));
  const keys = (n) => { const m = String(n).match(/^(.*?)\s*\((.*)\)\s*$/); return m ? [norm(n), norm(m[1]), norm(m[2])] : [norm(n)]; };
  const pcode = new Map(), used = new Set(), extra = [];
  for (const n of names) { const k = keys(n), o = list.find((x) => !used.has(x.pcode) && keys(x.name).some((y) => k.includes(y))); if (o) { used.add(o.pcode); pcode.set(n, o.pcode); } else extra.push(n); }
  return { pcode, missing: list.filter((x) => !used.has(x.pcode)).map((x) => x.name), extra };
}


// ---- 1. OpenStreetMap facilities -------------------------------------------------------------
async function overpass() {
  if (process.env.OVERPASS_FIXTURE) return JSON.parse(fs.readFileSync(process.env.OVERPASS_FIXTURE, 'utf8'));
  // The municipality that contains a point near Tanauan's poblacion; its name is printed so you can verify it.
  const q = `[out:json][timeout:90];is_in(14.0863,121.1497)->.a;area.a["admin_level"="6"]["boundary"="administrative"]->.city;
(nwr["amenity"~"^(school|townhall|shelter)$"](area.city);nwr["emergency"="assembly_point"](area.city);
 nwr["name"~"barangay hall|brgy\\\\.? hall|evacuation",i](area.city););out center tags;`;
  const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', headers: { 'User-Agent': 'RAIN-data-build/1.0', 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q) });
  if (!r.ok) throw new Error('Overpass HTTP ' + r.status);
  return r.json();
}
const addr = (t) => [t['addr:housenumber'], t['addr:street'], t['addr:suburb'] || t['addr:barangay'], t['addr:city'] || t['addr:municipality']].filter(Boolean).join(', ');
function classify(t) {
  const n = t.name || '';
  if (t.amenity === 'townhall' || /barangay hall|brgy\.? hall/i.test(n)) return 'halls';
  if (t.amenity === 'shelter' || t.emergency === 'assembly_point' || /evacuation/i.test(n)) return 'evac';
  if (t.amenity === 'school') return 'schools';
  return null;
}
const osm = await overpass();
const groups = { schools: [], halls: [], evac: [] };
for (const el of osm.elements || []) {
  const t = el.tags || {}, g = classify(t);
  const lat = el.lat ?? el.center?.lat, lng = el.lon ?? el.center?.lon;
  if (!g || !t.name || lat == null || !inPH(lng, lat)) continue; // unnamed or out-of-range items are skipped, never guessed
  groups[g].push({ type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] },
    properties: { name: t.name, address: addr(t), source: 'OpenStreetMap contributors (ODbL), element ' + el.type + '/' + el.id, verification: 'unverified', verifiedOn: null } });
}
const osmMeta = (what) => ({ dataset: what, status: 'COMMUNITY DATA - unverified, may be incomplete or outdated', source: 'OpenStreetMap contributors via Overpass API (ODbL, attribution required)' });
write('tanauan-schools.geojson', groups.schools, osmMeta('Schools'));
write('tanauan-barangay-halls.geojson', groups.halls, osmMeta('Barangay halls / town halls'));

// ---- 2. Evacuation centers: CDRRMO CSV (official) + OSM candidates (unverified) ---------------
const evac = [...groups.evac];
function parseCsv(t) {
  const rows = []; let r = [], c = '', q = false;
  for (let i = 0; i < t.length; i++) { const ch = t[i];
    if (q) { if (ch === '"' && t[i + 1] === '"') { c += '"'; i++; } else if (ch === '"') q = false; else c += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { r.push(c); c = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; r.push(c); c = ''; if (r.some((x) => x !== '')) rows.push(r); r = []; }
    else c += ch; }
  if (c !== '' || r.length) { r.push(c); rows.push(r); }
  return rows;
}
if (opt('--evac')) {
  const [head, ...rows] = parseCsv(fs.readFileSync(opt('--evac'), 'utf8')), ix = (k) => head.map((h) => h.trim().toLowerCase()).indexOf(k);
  let bad = 0;
  rows.forEach((r, n) => {
    const lat = parseFloat(r[ix('lat')]), lng = parseFloat(r[ix('lng')]), name = (r[ix('name')] || '').trim();
    if (!name || !inPH(lng, lat)) { bad++; console.warn(`evac CSV row ${n + 2} skipped (missing name or coordinates outside the Philippines; must be WGS84 lat/lng)`); return; }
    let ver = (r[ix('verification')] || '').trim().toLowerCase() === 'official' ? 'official' : 'unverified';
    const src = (r[ix('source')] || '').trim(), on = (r[ix('verifiedon')] || '').trim();
    if (ver === 'official' && (!src || !on)) { ver = 'unverified'; console.warn(`evac CSV row ${n + 2}: "official" needs source and verifiedOn; downgraded to unverified`); }
    evac.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: { name, address: (r[ix('address')] || '').trim(), barangay: (r[ix('barangay')] || '').trim(), capacity: (r[ix('capacity')] || '').trim(), source: src || 'CDRRMO CSV (source not stated)', verification: ver, verifiedOn: on || null } });
  });
  if (bad) console.warn(bad + ' CSV rows skipped');
}
write('tanauan-evacuation-centers.geojson', evac, { dataset: 'Evacuation centers', status: opt('--evac') ? 'CDRRMO CSV merged; OSM candidates stay unverified' : 'OSM candidates only (unverified). Provide a CDRRMO CSV via --evac for official status', source: 'see per-feature source' });

// ---- 3a. Fallback: barangay boundaries from OpenStreetMap (no big download; community data, unverified) ----
const same = (a, b) => a[0] === b[0] && a[1] === b[1];
function assembleRings(ways) { // join way fragments end-to-end into closed rings
  const out = [], pool = ways.map((w) => w.slice());
  while (pool.length) {
    let ring = pool.shift(), grew = true;
    while (grew && !same(ring[0], ring[ring.length - 1])) {
      grew = false;
      for (let i = 0; i < pool.length; i++) {
        const w = pool[i], end = ring[ring.length - 1];
        if (same(w[0], end)) ring = ring.concat(w.slice(1));
        else if (same(w[w.length - 1], end)) ring = ring.concat(w.slice(0, -1).reverse());
        else continue;
        pool.splice(i, 1); grew = true; break;
      }
    }
    if (same(ring[0], ring[ring.length - 1]) && ring.length >= 4) out.push(ring); else console.warn('  unclosed boundary ring skipped');
  }
  return out;
}
const pip = (pt, ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j];
  if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c; } return c; };
async function overpassBoundaries() {
  if (process.env.OVERPASS_BOUNDARY_FIXTURE) return JSON.parse(fs.readFileSync(process.env.OVERPASS_BOUNDARY_FIXTURE, 'utf8'));
  const q = `[out:json][timeout:120];is_in(14.0863,121.1497)->.a;area.a["admin_level"="6"]["boundary"="administrative"]->.city;relation["boundary"="administrative"]["admin_level"="10"](area.city);out geom tags;`;
  const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', headers: { 'User-Agent': 'RAIN-data-build/1.0', 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q) });
  if (!r.ok) throw new Error('Overpass HTTP ' + r.status);
  return r.json();
}
if (!opt('--boundaries') && args.includes('--osm-boundaries')) {
  const feats = [];
  for (const el of (await overpassBoundaries()).elements || []) {
    if (el.type !== 'relation' || !el.tags?.name) continue;
    const line = (role) => (el.members || []).filter((m) => m.role === role && m.geometry).map((m) => m.geometry.map((g) => [g.lon, g.lat]));
    const outers = assembleRings(line('outer')), inners = assembleRings(line('inner'));
    if (!outers.length || !inPH(...outers[0][0])) { console.warn('boundary skipped (no usable outer ring): ' + el.tags.name); continue; }
    const polys = outers.map((o) => [o]);
    inners.forEach((h) => { const host = polys.find((pl) => pip(h[0], pl[0])); if (host) host.push(h); });
    feats.push({ type: 'Feature', geometry: polys.length === 1 ? { type: 'Polygon', coordinates: polys[0] } : { type: 'MultiPolygon', coordinates: polys },
      properties: { name: el.tags.name, source: 'OpenStreetMap contributors (ODbL), relation/' + el.id, verification: 'unverified', verifiedOn: null } });
  }
  const chk = checkAgainstList(feats.map((f) => f.properties.name));
  feats.forEach((f) => { const c = chk.pcode.get(f.properties.name); if (c) f.properties.pcode = c; });
  if (chk.missing.length) console.warn('Official barangays with NO matching boundary: ' + chk.missing.join('; '));
  if (chk.extra.length) console.warn('Boundary names NOT in the official list (left unmatched, no pcode): ' + chk.extra.join('; '));
  write('tanauan-barangays.geojson', feats, { dataset: 'Barangay boundaries', status: 'COMMUNITY DATA - unverified; replace with the HDX/NAMRIA file when available', source: 'OpenStreetMap contributors via Overpass API (ODbL)' });
  if (feats.length !== 48) console.warn(`WARNING: ${feats.length} barangays found; the city government site states 48. OSM may be incomplete.`);
}

// ---- 3. Barangay boundaries from an HDX COD-AB export ----------------------------------------
if (opt('--boundaries')) {
  const gj = JSON.parse(fs.readFileSync(opt('--boundaries'), 'utf8')), feats = gj.features || [];
  const keys = Object.keys(feats[0]?.properties || {}), find = (re) => keys.find((k) => re.test(k));
  const kName = find(/^adm4_(name|en)$/i) || find(/barangay|brgy/i) || find(/^name$/i), kMun = find(/^adm3_(name|en)$/i), kProv = find(/^adm2_(name|en)$/i), kCode = find(/^adm4_pcode$/i), kM3 = find(/^adm3_pcode$/i);
  if (!kName) throw new Error('No barangay-name field found. Fields: ' + keys.join(', '));
  console.log(`boundary fields -> name:${kName} municipality:${kMun || '-'} province:${kProv || '-'} pcode:${kCode || '-'}`);
  // City of Tanauan, Batangas = PSGC/pcode PH0401031 (confirmed in the HDX xlsx). Prefer the code; fall back to names.
  const sel = feats.filter((f) => { const p = f.properties || {};
    if (kM3) return p[kM3] === 'PH0401031';
    return (!kMun || /tanauan/i.test(p[kMun] || '')) && (!kProv || /batangas/i.test(p[kProv] || '')); });
  const first = JSON.stringify(sel[0]?.geometry?.coordinates || []).match(/-?\d+\.?\d*/g) || [];
  if (!sel.length) throw new Error('No Tanauan (Batangas) features matched; check the file and its field values');
  if (!inPH(+first[0], +first[1])) throw new Error('Coordinates are not lng/lat WGS84. Reproject first: ogr2ogr -t_srs EPSG:4326 out.geojson in.shp');
  write('tanauan-barangays.geojson', sel.map((f) => ({ type: 'Feature', geometry: f.geometry,
    properties: { name: f.properties[kName], pcode: kCode ? f.properties[kCode] : undefined, source: 'PSA/NAMRIA boundaries via OCHA COD-AB (HDX), 2023 release', verification: 'indicative', verifiedOn: null } })),
    { dataset: 'Barangay boundaries', status: 'INDICATIVE (OCHA states these are not official boundaries)', source: 'HDX: Philippines - Subnational Administrative Boundaries' });
  if (sel.length !== 48) console.warn(`WARNING: ${sel.length} barangays found; the official list has 48. Check for split/merged features.`);
}
console.log('Done. Review the files, then commit data/.');
