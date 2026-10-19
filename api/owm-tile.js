// /api/owm-tile.js
// Server-side proxy for OpenWeatherMap "Weather Maps 1.0" raster tiles so the API key never reaches the browser.
//   /api/owm-tile?layer=clouds_new&z=5&x=27&y=15
// Only whitelisted layers and integer tile coordinates are accepted. Tiles are cached at the CDN edge
// for 10 minutes to stay inside OpenWeatherMap's free-tier call limits (check your plan's limits).
const LAYERS = new Set(['clouds_new', 'wind_new', 'precipitation_new', 'pressure_new']);

import { limited } from './_lib/ratelimit.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (limited(req, res, 'owm-tile', 900)) return;
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Server misconfigured: OPENWEATHER_API_KEY not set' });

  const { layer } = req.query;
  const z = Number(req.query.z), x = Number(req.query.x), y = Number(req.query.y);
  if (!LAYERS.has(layer)) return res.status(400).json({ error: 'Unknown layer' });
  if (![z, x, y].every(Number.isInteger) || z < 0 || z > 10 || x < 0 || y < 0 || x >= 2 ** z || y >= 2 ** z) {
    return res.status(400).json({ error: 'Invalid tile coordinates' });
  }
  try {
    const up = await fetch(`https://tile.openweathermap.org/map/${layer}/${z}/${x}/${y}.png?appid=${apiKey}`);
    if (!up.ok) return res.status(up.status === 404 ? 404 : 502).json({ error: 'Upstream tile error' });
    const buf = Buffer.from(await up.arrayBuffer());
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=300');
    return res.status(200).send(buf);
  } catch (err) {
    console.error('owm-tile error:', err);
    return res.status(500).json({ error: 'Tile fetch failed' });
  }
}
