'use strict';

const fs   = require('fs');
const path = require('path');

const config       = require('../config/config');
const RESULTS_FILE = path.join(config.dataDir, 'results.jsonl');
const TRIED_FILE   = path.join(config.dataDir, 'tried.jsonl');

class ResultStore {
  constructor() {
    const dir = path.dirname(RESULTS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  /**
   * Saves every verification attempt to tried.jsonl (for resume/duplicate prevention).
   * Saves only successful verifications to results.jsonl (for your review).
   */
  append(record, candidateObj, verifyResult) {
    const ts = new Date().toISOString();

    // Always write to tried.jsonl (internal duplicate prevention)
    const triedLine = JSON.stringify({
      rowId:     record.rowId,
      candidate: verifyResult.candidate,
      guess:     verifyResult.guess,
      status:    verifyResult.status,
      timestamp: ts,
    });
    fs.appendFileSync(TRIED_FILE, triedLine + '\n', 'utf8');

    // Only write successes to results.jsonl
    if (verifyResult.success) {
      const resultLine = JSON.stringify({
        rowId:           record.rowId,
        identifier:      record.identifier,
        contactName:     record.contactName,
        originalEmail:   record.contactEmail,
        verifiedEmail:   verifyResult.candidate,
        guess:           verifyResult.guess,
        candidateSource: candidateObj.source,
        message:         verifyResult.message,
        timestamp:       ts,
      });
      fs.appendFileSync(RESULTS_FILE, resultLine + '\n', 'utf8');
    }
  }

  /**
   * Loads all previously attempted rowId:candidate keys from tried.jsonl.
   * Used to skip already-tried combinations on resume.
   */
  loadProcessedKeys() {
    const keys = new Set();
    if (!fs.existsSync(TRIED_FILE)) return keys;

    const content = fs.readFileSync(TRIED_FILE, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const r = JSON.parse(trimmed);
        if (r.rowId != null && r.candidate) {
          keys.add(`${r.rowId}:${r.candidate.toLowerCase()}`);
        }
      } catch { /* skip malformed lines */ }
    }
    return keys;
  }
}

module.exports = ResultStore;
