// /api/hazard-point.js
// Server-side proxy: asks the MGB hazard services (Philippine Geoportal / UlAP) what is mapped at ONE point.
// Usage: /api/hazard-point?service=Flood|RainInducedLandslide&lat=14.08&lng=121.15
// Returns { service, count, attributes } where attributes are exactly what MGB returned (not interpreted).
const ALLOWED = { Flood: true, RainInducedLandslide: true };
const BASE = 'https://ulap-hazards.georisk.gov.ph/arcgis/rest/services/MGBPublic/';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { service } = req.query;
  const lat = Number(req.query.lat), lng = Number(req.query.lng);
  if (!ALLOWED[service]) return res.status(400).json({ error: 'Unknown service' });
  if (!(lat >= 4 && lat <= 21.5 && lng >= 116 && lng <= 127.5)) return res.status(400).json({ error: 'Point outside the Philippines' });

  const d = 0.01;
  const url = `${BASE}${service}/MapServer/identify?geometry=${lng},${lat}&geometryType=esriGeometryPoint&sr=4326&layers=all&tolerance=1` +
    `&mapExtent=${lng - d},${lat - d},${lng + d},${lat + d}&imageDisplay=400,400,96&returnGeometry=false&f=json`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) return res.status(502).json({ error: 'Upstream hazard server error' });
    const j = await r.json();
    if (j.error) return res.status(502).json({ error: 'Upstream hazard server rejected the query' });
    const first = (j.results || [])[0];
    const attributes = {};
    if (first && first.attributes) {
      for (const [k, v] of Object.entries(first.attributes)) {
        if (/^(shape|objectid|fid)/i.test(k)) continue;
        attributes[k] = String(v).slice(0, 120);
      }
    }
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({ service, count: (j.results || []).length, layer: first && first.layerName, attributes });
  } catch (err) {
    console.error('hazard-point error:', err && err.name);
    return res.status(502).json({ error: 'Could not reach the hazard server' });
  } finally {
    clearTimeout(timer);
  }
}
