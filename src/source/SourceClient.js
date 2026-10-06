'use strict';

const https = require('https');
const http  = require('http');
const config = require('../config/config');
const logger = require('../utils/logger');
const { setCookieFromHeader } = require('../utils/cookieJar');

const RECORDS_ENDPOINT = '/api/records';

/**
 * Fetches a URL and returns parsed JSON.
 * Uses Node's built-in http/https — no external dependencies.
 */
function fetchJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed  = new URL(url);
    const lib     = parsed.protocol === 'https:' ? https : http;
    const timeout = options.timeoutMs || 30_000;

    const req = lib.get(url, { headers: options.headers || {} }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode, headers: res.headers, body });
      });
    });

    req.setTimeout(timeout, () => {
      req.destroy(new Error(`Request timed out after ${timeout}ms`));
    });

    req.on('error', reject);
  });
}

class SourceClient {
  constructor() {
    this.baseUrl = config.sourceAppUrl;
  }

  /**
   * Retrieves all records from GET /api/records.
   * Returns the raw records array from the API response.
   */
  async getRecords() {
    const prefix = config.dinPrefix;
    const url = prefix
      ? `${this.baseUrl}${RECORDS_ENDPOINT}?din_prefix=${encodeURIComponent(prefix)}`
      : `${this.baseUrl}${RECORDS_ENDPOINT}`;
    logger.info(`Connecting to source API: ${url}`);

    const { status, headers, body } = await fetchJson(url);
    setCookieFromHeader(headers['set-cookie']);

    if (status !== 200) {
      throw new Error(`GET /api/records returned HTTP ${status}`);
    }

    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch (e) {
      throw new Error(`GET /api/records returned invalid JSON: ${e.message}`);
    }

    if (parsed.status && parsed.status !== 'success') {
      throw new Error(`API reported status: ${parsed.status}`);
    }

    const records = parsed.records;
    if (!Array.isArray(records)) {
      throw new Error('GET /api/records: expected "records" array in response');
    }

    logger.info(`Retrieved ${records.length} records`);
    return records;
  }

  // verifyRecord(...) will be added after the real Verify request is provided.
}

module.exports = SourceClient;
