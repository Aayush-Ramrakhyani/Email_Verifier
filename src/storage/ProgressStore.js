'use strict';

const fs   = require('fs');
const path = require('path');

const config        = require('../config/config');
const PROGRESS_FILE = path.join(config.dataDir, 'progress.json');

const DEFAULTS = {
  lastProcessedIndex: -1,
  processed:  0,
  verified:   0,
  invalid:    0,
  unknown:    0,
  errors:     0,
  nameCandidates:       0,
  abbrCandidates:       0,
  dictionaryCandidates: 0,
  explicitCandidates:   0,
  startedAt:  null,
  updatedAt:  null,
};

class ProgressStore {
  constructor() {
    this._data = this._load();
  }

  _load() {
    try {
      return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8')) };
    } catch {
      return { ...DEFAULTS, startedAt: new Date().toISOString() };
    }
  }

  save() {
    this._data.updatedAt = new Date().toISOString();
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(this._data, null, 2), 'utf8');
  }

  reset() {
    this._data = { ...DEFAULTS, startedAt: new Date().toISOString() };
    this.save();
  }

  get data() { return this._data; }

  get lastIndex() { return this._data.lastProcessedIndex; }

  increment(field, amount = 1) {
    this._data[field] = (this._data[field] || 0) + amount;
  }

  setLastIndex(idx) {
    this._data.lastProcessedIndex = idx;
  }
}

module.exports = ProgressStore;
