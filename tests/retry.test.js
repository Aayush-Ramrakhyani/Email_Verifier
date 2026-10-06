'use strict';

const { test } = require('node:test');
const assert   = require('node:assert/strict');
const { withRetry, RetryableError, SessionExpiredError } = require('../src/utils/retry');

test('withRetry — succeeds on first attempt', async () => {
  let calls = 0;
  const result = await withRetry(async () => { calls++; return 'ok'; });
  assert.equal(result, 'ok');
  assert.equal(calls, 1);
});

test('withRetry — retries on RetryableError and eventually succeeds', async () => {
  let calls = 0;
  const result = await withRetry(async () => {
    calls++;
    if (calls < 3) throw new RetryableError('transient');
    return 'done';
  }, { maxRetries: 3, baseDelayMs: 1 });
  assert.equal(result, 'done');
  assert.equal(calls, 3);
});

test('withRetry — throws after maxRetries exceeded', async () => {
  let calls = 0;
  await assert.rejects(
    withRetry(async () => { calls++; throw new RetryableError('always fails'); }, { maxRetries: 2, baseDelayMs: 1 }),
    RetryableError
  );
  assert.equal(calls, 3); // 1 initial + 2 retries
});

test('withRetry — does NOT retry SessionExpiredError', async () => {
  let calls = 0;
  await assert.rejects(
    withRetry(async () => { calls++; throw new SessionExpiredError(); }, { maxRetries: 3, baseDelayMs: 1 }),
    SessionExpiredError
  );
  assert.equal(calls, 1);
});

test('withRetry — does NOT retry non-retryable errors', async () => {
  let calls = 0;
  await assert.rejects(
    withRetry(async () => { calls++; throw new Error('logic error'); }, { maxRetries: 3, baseDelayMs: 1 }),
    Error
  );
  assert.equal(calls, 1);
});
