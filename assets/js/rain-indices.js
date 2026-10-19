/* RAIN — shared environmental indices (browser global RainIndices; also importable in Node tests).
   These are ESTIMATES from weather inputs, never official observations or health predictions. */
(function (root) {
  "use strict";
  // NWS heat index (Steadman below 80 F, Rothfusz regression above). Inputs/outputs: degrees C, % RH.
  function heatIndexC(tc, rh) {
    const T = (tc * 9) / 5 + 32;
    let hi = 0.5 * (T + 61 + (T - 68) * 1.2 + rh * 0.094);
    if ((hi + T) / 2 >= 80) {
      hi = -42.379 + 2.04901523 * T + 10.14333127 * rh - 0.22475541 * T * rh - 0.00683783 * T * T - 0.05481717 * rh * rh
        + 0.00122874 * T * T * rh + 0.00085282 * T * rh * rh - 0.00000199 * T * T * rh * rh;
      if (rh < 13 && T >= 80 && T <= 112) hi -= ((13 - rh) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17);
      else if (rh > 85 && T >= 80 && T <= 87) hi += ((rh - 85) / 10) * ((87 - T) / 5);
    }
    return ((hi - 32) * 5) / 9;
  }
  // PAGASA heat-index classes. Returns [name, advice, tone] where tone is safe|caution|critical.
  function heatCategory(c) {
    if (c >= 52) return ["Extreme Danger", "Heat stroke imminent. Stay indoors in cool areas; seek medical help for any heat illness.", "critical"];
    if (c >= 42) return ["Danger", "Heat cramps/exhaustion likely; heat stroke possible with prolonged exposure. Avoid outdoor work, drink water often.", "critical"];
    if (c >= 33) return ["Extreme Caution", "Heat cramps and exhaustion possible. Limit strenuous outdoor activity, rest in shade, hydrate.", "caution"];
    if (c >= 27) return ["Caution", "Fatigue possible with prolonged exposure. Drink water and take breaks.", "caution"];
    return ["Below PAGASA caution range (27 °C)", "No heat-index caution class applies, but stay hydrated.", "safe"];
  }
  // Simplified 3-rule look at weather conditions often associated with faster mosquito development. Not validated for Tanauan.
  function mosquitoSuitability(o) {
    const f = [
      { name: "Temperature", ok: o.tempC >= 25 && o.tempC <= 32, val: o.tempC.toFixed(1) + " °C", rule: "favorable if 25–32 °C (warm range where mosquito development is generally faster)" },
      { name: "Humidity", ok: o.rh >= 70, val: o.rh + "%", rule: "favorable if 70% or higher" },
      { name: "Rain", ok: o.rainNowMm > 0 || o.rain5dMm >= 20, val: `${o.rainNowMm.toFixed(1)} mm last hour; ${o.rain5dMm.toFixed(0)} mm forecast over ~5 days`, rule: "favorable if raining now or 20 mm+ is forecast (standing water)" },
    ];
    const n = f.filter((x) => x.ok).length;
    return { n, label: ["Low", "Low", "Moderate", "High"][n], factors: f };
  }
  const api = { heatIndexC, heatCategory, mosquitoSuitability };
  root.RainIndices = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
