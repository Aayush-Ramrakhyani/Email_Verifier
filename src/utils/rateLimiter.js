'use strict';

const config = require('../config/config');

/**
 * Creates an independent throttle slot.
 * Each concurrent worker gets its own slot so they don't block each other —
 * 5 workers at 100ms each = ~50 req/s total throughput.
 * On 429, the caller uses withRetry exponential backoff instead.
 */
function createThrottle() {
  let lastRequestAt = 0;
  return async function throttle() {
    const delayMs = config.requestDelayMs;
    const elapsed = Date.now() - lastRequestAt;
    const wait    = delayMs - elapsed;
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    lastRequestAt = Date.now();
  };
}

module.exports = { createThrottle };
