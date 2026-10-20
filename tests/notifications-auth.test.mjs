import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/notifications.js';

const call = async (headers, env) => {
  const saved = process.env.EMAIL_WEBHOOK_SECRET;
  if (env === undefined) delete process.env.EMAIL_WEBHOOK_SECRET; else process.env.EMAIL_WEBHOOK_SECRET = env;
  const res = { code: 0, status(c) { this.code = c; return this; }, json() { return this; } };
  await handler({ method: 'POST', headers, body: {} }, res);
  if (saved === undefined) delete process.env.EMAIL_WEBHOOK_SECRET; else process.env.EMAIL_WEBHOOK_SECRET = saved;
  return res.code;
};
test('rejects requests when the secret is not configured, even with no header', async () => { assert.equal(await call({}, undefined), 401); });
test('rejects a wrong secret', async () => { assert.equal(await call({ 'x-webhook-secret': 'nope' }, 'right-secret'), 401); });
test('accepts the right secret (reaches the handler body)', async () => { assert.notEqual(await call({ 'x-webhook-secret': 'right-secret' }, 'right-secret'), 401); });
