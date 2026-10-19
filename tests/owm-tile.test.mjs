import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/owm-tile.js';

const realFetch = globalThis.fetch;
function call(query, { key = 'k', method = 'GET' } = {}) {
  if (key) process.env.OPENWEATHER_API_KEY = key; else delete process.env.OPENWEATHER_API_KEY;
  const out = { headers: {} };
  const res = { status(c) { out.code = c; return res; }, json(b) { out.body = b; return res; }, send(b) { out.sent = b; return res; }, setHeader(k, v) { out.headers[k] = v; } };
  return handler({ method, query }, res).then(() => out);
}
const ok = () => { const urls = []; globalThis.fetch = async (u) => { urls.push(u); return { ok: true, status: 200, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer }; }; return urls; };

test('valid tile is proxied, cached, and key never appears in response', async () => {
  const urls = ok(); const r = await call({ layer: 'clouds_new', z: '5', x: '27', y: '15' });
  assert.equal(r.code, 200); assert.match(urls[0], /map\/clouds_new\/5\/27\/15\.png\?appid=k/);
  assert.equal(r.headers['Content-Type'], 'image/png'); assert.match(r.headers['Cache-Control'], /s-maxage=600/);
  assert.ok(!JSON.stringify(r.headers).includes('appid'));
});
test('rejects unknown layers, non-integer or out-of-range tiles, bad method, missing key', async () => {
  ok();
  assert.equal((await call({ layer: 'evil', z: '5', x: '1', y: '1' })).code, 400);
  assert.equal((await call({ layer: 'wind_new', z: '5', x: '1.5', y: '1' })).code, 400);
  assert.equal((await call({ layer: 'wind_new', z: '5', x: '32', y: '1' })).code, 400);
  assert.equal((await call({ layer: 'wind_new', z: '11', x: '1', y: '1' })).code, 400);
  assert.equal((await call({ layer: 'wind_new', z: '5', x: '1', y: '1' }, { method: 'POST' })).code, 405);
  assert.equal((await call({ layer: 'wind_new', z: '5', x: '1', y: '1' }, { key: null })).code, 500);
});
test('upstream errors map to 502/404', async () => {
  globalThis.fetch = async () => ({ ok: false, status: 401 }); assert.equal((await call({ layer: 'wind_new', z: '5', x: '1', y: '1' })).code, 502);
  globalThis.fetch = async () => ({ ok: false, status: 404 }); assert.equal((await call({ layer: 'wind_new', z: '5', x: '1', y: '1' })).code, 404);
  globalThis.fetch = realFetch;
});
