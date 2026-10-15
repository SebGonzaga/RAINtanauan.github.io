/* RAIN -- timely weather helpers.
   Pure functions (no DOM) so they can be unit-tested in Node.
   Input is the OpenWeatherMap 5-day / 3-hour forecast list (forecast.list). */
(function (root) {
  const RainTimely = {
    REFRESH_MS: 10 * 60 * 1000, // auto-refresh interval

    /** Next `count` 3-hour slots that start at or after `nowMs` (default 8 = 24h). */
    hourlySlots(list, nowMs, count) {
      const n = count || 8;
      const now = nowMs != null ? nowMs : Date.now();
      return (list || [])
        .filter((s) => s && typeof s.dt === "number" && s.dt * 1000 >= now - 90 * 60 * 1000)
        .slice(0, n)
        .map((s) => ({
          dt: s.dt,
          tempC: Math.round(s.main.temp),
          pop: Math.round((s.pop || 0) * 100), // chance of rain, %
          weather: (s.weather && s.weather[0]) || null,
        }));
    },

    /** Heads-up for the next ~9 hours: returns null or { hours, pop, heavy }. */
    rainHeadsUp(slots, nowMs) {
      const now = nowMs != null ? nowMs : Date.now();
      for (const s of (slots || []).slice(0, 3)) {
        const id = s.weather ? s.weather.id : 0;
        const rainy = (id >= 200 && id < 600);
        if (s.pop >= 60 || rainy) {
          const hours = Math.max(0, Math.round((s.dt * 1000 - now) / 3600000));
          return { hours, pop: s.pop, heavy: id >= 502 && id <= 531 || (id >= 200 && id < 300) };
        }
      }
      return null;
    },

    /** "just now", "5 min ago", "2 h ago" */
    agoText(updatedMs, nowMs) {
      const diff = Math.max(0, (nowMs != null ? nowMs : Date.now()) - updatedMs);
      const min = Math.floor(diff / 60000);
      if (min < 1) return "just now";
      if (min < 60) return `${min} min ago`;
      return `${Math.floor(min / 60)} h ago`;
    },
  };

  if (typeof module !== "undefined" && module.exports) module.exports = RainTimely;
  else root.RainTimely = RainTimely;
})(typeof self !== "undefined" ? self : this);
