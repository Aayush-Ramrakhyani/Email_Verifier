'use strict';

const logger = require('./logger');

class RetryableError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = 'RetryableError';
    this.statusCode = statusCode;
  }
}

class SessionExpiredError extends Error {
  constructor(message) {
    super(message || 'Session Expired: Database cookie reset');
    this.name = 'SessionExpiredError';
    this.code = 'SESSION_EXPIRED';
  }
}

function isRetryable(err) {
  if (err instanceof SessionExpiredError) return false;
  if (err instanceof RetryableError) return true;
  // Network errors
  const retryCodes = ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN'];
  if (retryCodes.includes(err.code)) return true;
  if (err.message && err.message.includes('Timeout')) return true;
  return false;
}

async function withRetry(fn, { maxRetries = 3, baseDelayMs = 1000 } = {}) {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof SessionExpiredError) throw err;
      if (!isRetryable(err)) throw err;

      attempt++;
      if (attempt > maxRetries) throw err;

      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      logger.warn(`Retry ${attempt}/${maxRetries} in ${delay}ms — ${err.message}`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

module.exports = { withRetry, RetryableError, SessionExpiredError };
