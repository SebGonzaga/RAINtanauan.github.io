import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const RainTimely = createRequire(import.meta.url)('../assets/js/weather-timely.js');

const NOW = Date.UTC(2026, 9, 4, 6, 0, 0);
const slot = (hoursFromNow, temp, pop, id = 800) => ({
  dt: (NOW + hoursFromNow * 3600000) / 1000, main: { temp }, pop, weather: [{ id, icon: '01d' }],
});

test('hourlySlots returns the next 8 upcoming 3-hour slots and skips old ones', () => {
  const list = [slot(-6, 30, 0), slot(-3, 30, 0)];
  for (let i = 0; i < 12; i++) list.push(slot(i * 3, 28 + (i % 3), 0.1));
  const out = RainTimely.hourlySlots(list, NOW);
  assert.equal(out.length, 8);
  assert.equal(out[0].dt * 1000, NOW);
  assert.equal(out[0].pop, 10);
  assert.equal(out[0].tempC, 28);
});

test('hourlySlots tolerates empty or missing input', () => {
  assert.deepEqual(RainTimely.hourlySlots(undefined, NOW), []);
  assert.deepEqual(RainTimely.hourlySlots([], NOW), []);
});

test('rainHeadsUp: null when the next ~9 hours are dry', () => {
  const slots = RainTimely.hourlySlots([slot(0, 30, 0.1), slot(3, 30, 0.2), slot(6, 30, 0.3), slot(9, 30, 0.9, 501)], NOW);
  assert.equal(RainTimely.rainHeadsUp(slots, NOW), null);
});

test('rainHeadsUp: flags high chance of rain with hours until it starts', () => {
  const slots = RainTimely.hourlySlots([slot(0, 30, 0.1), slot(3, 28, 0.7, 500)], NOW);
  const r = RainTimely.rainHeadsUp(slots, NOW);
  assert.equal(r.hours, 3);
  assert.equal(r.pop, 70);
  assert.equal(r.heavy, false);
});

test('rainHeadsUp: marks heavy rain and thunderstorms', () => {
  assert.equal(RainTimely.rainHeadsUp(RainTimely.hourlySlots([slot(0, 27, 0.9, 503)], NOW), NOW).heavy, true);
  assert.equal(RainTimely.rainHeadsUp(RainTimely.hourlySlots([slot(0, 27, 0.5, 211)], NOW), NOW).heavy, true);
});

test('agoText', () => {
  assert.equal(RainTimely.agoText(NOW, NOW + 20000), 'just now');
  assert.equal(RainTimely.agoText(NOW, NOW + 5 * 60000), '5 min ago');
  assert.equal(RainTimely.agoText(NOW, NOW + 2 * 3600000), '2 h ago');
});
