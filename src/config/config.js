'use strict';

require('dotenv').config();

const path = require('path');

const config = {
  sourceAppUrl: process.env.SOURCE_APP_URL || 'http://139.59.72.254:3133',
  sourceAppMode: process.env.SOURCE_APP_MODE || 'real',

  requestDelayMs: parseInt(process.env.REQUEST_DELAY_MS || '100', 10),
  maxRetries:     parseInt(process.env.MAX_RETRIES     || '3',   10),

  nameWorkers:  parseInt(process.env.NAME_WORKERS  || '3', 10),
  abbrWorkers:  parseInt(process.env.ABBR_WORKERS  || '3', 10),
  dictWorkers:  parseInt(process.env.DICT_WORKERS  || '2', 10),
  bruteWorkers: parseInt(process.env.BRUTE_WORKERS || '8', 10),

  dinPrefix:  process.env.DIN_PREFIX || '',
  dataDir:    path.join(__dirname, '../../data'),

  resetProgress:    process.env.RESET_PROGRESS  === 'true',
  enableBruteForce: process.env.ENABLE_BRUTEFORCE !== 'false',

  auth: {
    username: process.env.SOURCE_APP_USERNAME || '',
    password: process.env.SOURCE_APP_PASSWORD || '',
    token: process.env.SOURCE_APP_TOKEN || '',
  },
};

module.exports = config;
