import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/weather.js';

function call(query, { key = 'k' } = {}) {
  if (key) process.env.OPENWEATHER_API_KEY = key; else delete process.env.OPENWEATHER_API_KEY;
  const out = {};
  const res = { status(c) { out.code = c; return res; }, json(b) { out.body = b; return res; } };
  return handler({ method: 'GET', query }, res).then(() => out);
}
const realFetch = globalThis.fetch;
function mock(ok = true) { const urls = []; globalThis.fetch = async (u) => { urls.push(u); return { ok, json: async () => ({ list: [] }), text: async () => 'err' }; }; return urls; }

test('air=current builds the air_pollution URL', async () => {
  const urls = mock(); const r = await call({ lat: '14.08', lng: '121.15', air: 'current' });
  assert.equal(r.code, 200); assert.match(urls[0], /data\/2\.5\/air_pollution\?lat=14\.08&lon=121\.15/);
});
test('air=forecast uses the forecast endpoint', async () => {
  const urls = mock(); await call({ lat: '14', lng: '121', air: 'forecast' }); assert.match(urls[0], /air_pollution\/forecast/);
});
test('air=history validates the window', async () => {
  mock();
  assert.equal((await call({ lat: '14', lng: '121', air: 'history' })).code, 400);
  assert.equal((await call({ lat: '14', lng: '121', air: 'history', start: '100', end: '50' })).code, 400);
  assert.equal((await call({ lat: '14', lng: '121', air: 'history', start: '0', end: String(8 * 86400) })).code, 400);
  const urls = mock(); assert.equal((await call({ lat: '14', lng: '121', air: 'history', start: '1000', end: '2000' })).code, 200);
  assert.match(urls[0], /air_pollution\/history\?.*start=1000&end=2000/);
});
test('rejects bad coordinates and unknown air modes', async () => {
  mock();
  assert.equal((await call({ lat: 'abc', lng: '121', air: 'current' })).code, 400);
  assert.equal((await call({ lat: '95', lng: '121', air: 'current' })).code, 400);
  assert.equal((await call({ lat: '14', lng: '121', air: 'bogus' })).code, 400);
});
test('missing key and upstream failure give clean errors', async () => {
  mock(); assert.equal((await call({ lat: '14', lng: '121', air: 'current' }, { key: null })).code, 500);
  mock(false); assert.equal((await call({ lat: '14', lng: '121', air: 'current' })).code, 502);
  globalThis.fetch = realFetch;
});
test('existing current-weather route still works', async () => {
  const urls = mock(); await call({ lat: '14', lng: '121' }); assert.match(urls[0], /data\/2\.5\/weather\?/); globalThis.fetch = realFetch;
});
