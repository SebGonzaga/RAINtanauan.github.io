import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allow, clientIp } from '../api/_lib/ratelimit.js';

test('allows up to the limit then blocks within the window, then resets', () => {
  const t = 1_000_000;
  for (let i = 0; i < 3; i++) assert.equal(allow('k1', 3, 60000, t + i), true);
  assert.equal(allow('k1', 3, 60000, t + 10), false);
  assert.equal(allow('k1', 3, 60000, t + 60001), true);
});
test('keys are independent', () => {
  assert.equal(allow('a', 1, 60000, 5), true); assert.equal(allow('a', 1, 60000, 6), false); assert.equal(allow('b', 1, 60000, 6), true);
});
test('clientIp reads the first forwarded address', () => {
  assert.equal(clientIp({ headers: { 'x-forwarded-for': '1.2.3.4, 9.9.9.9' } }), '1.2.3.4');
  assert.equal(clientIp({ headers: {} }), 'unknown');
});
