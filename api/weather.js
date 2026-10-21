// /api/weather.js
// Serverless function (Vercel Node.js runtime). Proxies OpenWeatherMap
// requests so the API key stays server-side, replacing the client-side
// "bring your own key" flow that used to live in weather.html.
//
// Usage from the frontend:
//   /api/weather?lat=14.21&lng=121.16              -> current conditions
//   /api/weather?lat=14.21&lng=121.16&forecast=1   -> 5-day forecast
//   /api/weather?geocode=Calamba                   -> city search
//   /api/weather?reverse=1&lat=..&lng=..           -> place name for a GPS point
//   /api/weather?lat=..&lng=..&air=current         -> air pollution, current (OpenWeatherMap Air Pollution API)
//   /api/weather?lat=..&lng=..&air=forecast        -> air pollution, hourly forecast (~4 days)
//   /api/weather?lat=..&lng=..&air=history&start=<unix>&end=<unix> -> air pollution history (max 7 days here)

import { limited } from './_lib/ratelimit.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (limited(req, res, 'weather', 90)) return;

  const { lat, lng, forecast, geocode, reverse, air, start, end } = req.query;

  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server misconfigured: OPENWEATHER_API_KEY not set' });
  }

  let url;
  const num = (v) => (v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
  if (air !== undefined) {
    const la = num(lat), lo = num(lng);
    if (la === null || lo === null || la < -90 || la > 90 || lo < -180 || lo > 180) {
      return res.status(400).json({ error: 'Valid "lat" and "lng" query params are required' });
    }
    if (air === 'current') {
      url = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${la}&lon=${lo}&appid=${apiKey}`;
    } else if (air === 'forecast') {
      url = `https://api.openweathermap.org/data/2.5/air_pollution/forecast?lat=${la}&lon=${lo}&appid=${apiKey}`;
    } else if (air === 'history') {
      const s0 = num(start), e0 = num(end);
      if (s0 === null || e0 === null || e0 <= s0 || e0 - s0 > 7 * 86400) {
        return res.status(400).json({ error: '"start" and "end" must be unix seconds, end > start, span <= 7 days' });
      }
      url = `https://api.openweathermap.org/data/2.5/air_pollution/history?lat=${la}&lon=${lo}&start=${Math.floor(s0)}&end=${Math.floor(e0)}&appid=${apiKey}`;
    } else {
      return res.status(400).json({ error: '"air" must be current, forecast or history' });
    }
  } else if (reverse !== undefined) {
    const la = num(lat), lo = num(lng);
    if (la === null || lo === null || la < -90 || la > 90 || lo < -180 || lo > 180) {
      return res.status(400).json({ error: 'Valid "lat" and "lng" query params are required' });
    }
    url = `https://api.openweathermap.org/geo/1.0/reverse?lat=${la}&lon=${lo}&limit=1&appid=${apiKey}`;
  } else if (geocode) {
    url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(geocode)}&limit=5&appid=${apiKey}`;
  } else {
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Missing "lat" and "lng" query params' });
    }
    const endpoint = forecast ? 'forecast' : 'weather';
    url = `https://api.openweathermap.org/data/2.5/${endpoint}?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&units=metric&appid=${apiKey}`;
  }

  try {
    const owmRes = await fetch(url);

    if (!owmRes.ok) {
      const errText = await owmRes.text();
      console.error('OpenWeatherMap error:', errText);
      return res.status(502).json({ error: 'Upstream weather provider error' });
    }

    const data = await owmRes.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error('weather.js error:', err);
    return res.status(500).json({ error: 'Something went wrong fetching weather data' });
  }
}
