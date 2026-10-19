import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { heatIndexC, heatCategory, mosquitoSuitability } = createRequire(import.meta.url)("../assets/js/rain-indices.js");

test("heat index is close to the NWS chart for 32 C / 70%", () => {
  assert.ok(Math.abs(heatIndexC(32, 70) - 40.4) < 0.6); // chart: 90 F/70% is about 105 F (40.6 C)
});
test("cool, dry air stays below the PAGASA caution range", () => {
  assert.ok(heatIndexC(20, 50) < 27);
});
test("PAGASA class boundaries", () => {
  assert.equal(heatCategory(26.9)[2], "safe");
  assert.equal(heatCategory(27)[0], "Caution");
  assert.equal(heatCategory(33)[0], "Extreme Caution");
  assert.equal(heatCategory(42)[0], "Danger");
  assert.equal(heatCategory(52)[0], "Extreme Danger");
});
test("mosquito suitability counts favorable rules", () => {
  assert.deepEqual([3, "High"], ((r) => [r.n, r.label])(mosquitoSuitability({ tempC: 28, rh: 80, rainNowMm: 0, rain5dMm: 25 })));
  assert.equal(mosquitoSuitability({ tempC: 28, rh: 80, rainNowMm: 0, rain5dMm: 0 }).label, "Moderate");
  assert.equal(mosquitoSuitability({ tempC: 20, rh: 50, rainNowMm: 0, rain5dMm: 0 }).label, "Low");
  assert.equal(mosquitoSuitability({ tempC: 20, rh: 50, rainNowMm: 0, rain5dMm: 0 }).n, 0);
});
