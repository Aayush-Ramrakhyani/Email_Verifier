/*
 * config.js
 * Centralised runtime configuration loaded from environment variables with
 * sensible defaults, covering API endpoints, concurrency, retry, and auth settings.
 */

'use strict';

require('dotenv').config();

const path = require('path');

const config = {
  sourceAppUrl: process.env.SOURCE_APP_URL || 'http://139.59.72.254:3133',
  sourceAppMode: process.env.SOURCE_APP_MODE || 'real',

  requestDelayMs: parseInt(process.env.REQUEST_DELAY_MS || '100', 10), // ms between requests per worker; lower = faster but risks 429
  maxRetries:     parseInt(process.env.MAX_RETRIES     || '3',   10), // max exponential-backoff retries before giving up on a candidate

  nameWorkers:  parseInt(process.env.NAME_WORKERS  || '3', 10),  // stage 1 concurrency
  abbrWorkers:  parseInt(process.env.ABBR_WORKERS  || '3', 10),  // stage 2 concurrency
  dictWorkers:  parseInt(process.env.DICT_WORKERS  || '2', 10),  // stage 3 concurrency
  bruteWorkers: parseInt(process.env.BRUTE_WORKERS || '8', 10),  // stage 4 — more workers to churn 1521 combos per record faster

  dinPrefix:  process.env.DIN_PREFIX || '',
  dataDir:    path.join(__dirname, '../../data'),

  resetProgress:    process.env.RESET_PROGRESS  === 'true',          // wipe progress.json and start fresh
  enableBruteForce: process.env.ENABLE_BRUTEFORCE !== 'false',       // defaults ON; set ENABLE_BRUTEFORCE=false to skip stage 4

  auth: {
    username: process.env.SOURCE_APP_USERNAME || '',
    password: process.env.SOURCE_APP_PASSWORD || '',
    token: process.env.SOURCE_APP_TOKEN || '',
  },
};

module.exports = config;
