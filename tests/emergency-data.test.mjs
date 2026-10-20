import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const demo = vm.runInNewContext(read('assets/js/demo-data.js') + '\n;RAIN_DEMO', { window: {} });
const boundaries = (() => { const w = {}; vm.runInNewContext(read('assets/js/tanauan-boundaries.js'), { window: w }); return w.RAIN_BOUNDARIES; })();

test('48 barangay halls with valid coordinates and unique names', () => {
  assert.equal(demo.barangays.length, 48);
  assert.equal(new Set(demo.barangays.map((b) => b.name)).size, 48);
  for (const b of demo.barangays) assert.ok(Number.isFinite(b.lat) && Number.isFinite(b.lng), b.name);
});

test('every barangay has a matching boundary polygon', () => {
  const names = new Set(boundaries.features.map((f) => f.properties.name));
  assert.equal(boundaries.features.length, 48);
  for (const b of demo.barangays) assert.ok(names.has(b.name), 'no boundary for ' + b.name);
});

test('evacuation centers have coordinates inside the Tanauan area', () => {
  assert.ok(demo.evacuationCenters.length > 0);
  for (const c of demo.evacuationCenters) {
    assert.ok(c.lat > 14.0 && c.lat < 14.2 && c.lng > 121.0 && c.lng < 121.25, c.name);
    assert.ok(c.name && c.type && c.address, c.name);
  }
});

test('contacts keep `number` (first of `numbers`) for older code paths', () => {
  for (const c of demo.emergencyContacts) {
    assert.ok(Array.isArray(c.numbers) && c.numbers.length > 0, c.name);
    assert.equal(c.number, c.numbers[0]);
  }
});

test('emergency page loads the boundary file and the service worker precaches it', () => {
  assert.match(read('emergency.html'), /assets\/js\/tanauan-boundaries\.js/);
  assert.match(read('sw.js'), /tanauan-boundaries\.js/);
});
