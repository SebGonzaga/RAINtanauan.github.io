// /api/weather.js
// Serverless function (Vercel Node.js runtime). Proxies OpenWeatherMap
// requests so the API key stays server-side, replacing the client-side
// "bring your own key" flow that used to live in weather.html.
//
// Usage from the frontend:
//   /api/weather?lat=14.21&lng=121.16              -> current conditions
//   /api/weather?lat=14.21&lng=121.16&forecast=1   -> 5-day forecast
//   /api/weather?geocode=Calamba                   -> city search

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { lat, lng, forecast, geocode } = req.query;

  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server misconfigured: OPENWEATHER_API_KEY not set' });
  }

  let url;
  if (geocode) {
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
