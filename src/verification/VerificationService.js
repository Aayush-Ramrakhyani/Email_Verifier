'use strict';

const http  = require('http');
const https = require('https');
const config = require('../config/config');
const logger = require('../utils/logger');
const { RetryableError, SessionExpiredError } = require('../utils/retry');
const { isCompatible, extractGuess } = require('../candidates/CandidateMatcher');
const { getCookie } = require('../utils/cookieJar');

const VALIDATE_ENDPOINT = '/api/validate';

// ─── Mock responses ────────────────────────────────────────────────────────────

const MOCK_RECORDS = [
  { id: 1, din: 'MOCK001', contact_name: 'TEST USER', contact_email: 'TES**USER@GMAIL.COM', contact_mobile: '999XXXX000' },
  { id: 2, din: 'MOCK002', contact_name: 'INFO ADMIN', contact_email: 'INF**DMIN@GMAIL.COM', contact_mobile: '888XXXX111' },
];

function mockVerify(record, candidate, guess) {
  // Simulate success for specific known guesses in mock mode
  const successGuesses = ['t', 'u', 'o', 'a'];
  const success = successGuesses.includes((guess || '').toLowerCase());
  return {
    success,
    status: success ? 'success' : 'error',
    message: success
      ? 'Validation successful. Email has been updated.'
      : 'Invalid guess',
    candidate,
    guess,
    rawResponse: { status: success ? 'success' : 'error', mock: true },
  };
}

// ─── HTTP helper ───────────────────────────────────────────────────────────────

function postJson(url, body, timeoutMs = 30_000) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib    = parsed.protocol === 'https:' ? https : http;
    const bodyStr = JSON.stringify(body);

    const cookie = getCookie();
    const options = {
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + (parsed.search || ''),
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        'Accept':         '*/*',
        'Connection':     'keep-alive',
        'Origin':         `${parsed.protocol}//${parsed.host}`,
        ...(cookie ? { 'Cookie': cookie } : {}),
      },
    };

    const req = lib.request(options, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') });
      });
    });

    req.setTimeout(timeoutMs, () => req.destroy(new Error(`POST ${url} timed out after ${timeoutMs}ms`)));
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

// ─── VerificationService ───────────────────────────────────────────────────────

class VerificationService {
  constructor() {
    this.baseUrl = config.sourceAppUrl;
    this.mock    = config.sourceAppMode === 'mock';
  }

  getMockRecords() {
    return MOCK_RECORDS;
  }

  /**
   * Verifies a candidate email against a record by calling POST /api/validate.
   *
   * @param {object} record    - normalized record ({ rowId, contactEmail, ... })
   * @param {string} candidate - full candidate email string
   * @returns {{ success, status, message, candidate, guess, rawResponse }}
   *
   * Throws SessionExpiredError if the server reports session expiry.
   * Throws RetryableError for 429 / 5xx responses.
   */
  async verifyRecord(record, candidate) {
    const pattern = record.contactEmail;

    if (!isCompatible(pattern, candidate)) {
      return {
        success:     false,
        status:      'INCOMPATIBLE',
        message:     'Candidate does not match email pattern',
        candidate,
        guess:       null,
        rawResponse: null,
      };
    }

    const guess = extractGuess(pattern, candidate);

    if (this.mock) {
      return mockVerify(record, candidate, guess);
    }

    const url = `${this.baseUrl}${VALIDATE_ENDPOINT}`;
    const payload = { id: record.rowId, guess };

    let httpResult;
    try {
      httpResult = await postJson(url, payload);
    } catch (err) {
      throw err; // network error — retry.withRetry handles it
    }

    const { statusCode, body } = httpResult;

    // Rate-limited or server-side error — retryable
    if (statusCode === 429) {
      throw new RetryableError(`HTTP 429 — rate limited`, 429);
    }
    if (statusCode >= 500) {
      throw new RetryableError(`HTTP ${statusCode} — server error`, statusCode);
    }

    // Parse JSON
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      return {
        success:     false,
        status:      'PARSE_ERROR',
        message:     `Non-JSON response (HTTP ${statusCode})`,
        candidate,
        guess,
        rawResponse: body,
      };
    }

    // Detect session expiration — check both status field and message
    const msg        = (parsed.message || '').toLowerCase();
    const statusStr  = (parsed.status  || '').toLowerCase();
    const isExpired  = msg.includes('session expired')
                    || msg.includes('database cookie reset')
                    || statusStr === 'session_expired';
    if (isExpired) {
      throw new SessionExpiredError(parsed.message || 'Session expired');
    }

    // Auth / not-found errors — not retryable, treat as invalid
    if (statusCode === 401 || statusCode === 403 || statusCode === 404) {
      return {
        success:     false,
        status:      `HTTP_${statusCode}`,
        message:     parsed.message || `HTTP ${statusCode}`,
        candidate,
        guess,
        rawResponse: parsed,
      };
    }

    const success = parsed.status === 'success';

    return {
      success,
      status:      parsed.status || 'UNKNOWN',
      message:     parsed.message || '',
      candidate,
      guess,
      rawResponse: parsed,
    };
  }
}

module.exports = VerificationService;
