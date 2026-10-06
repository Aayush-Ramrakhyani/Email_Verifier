'use strict';

const config = require('../config/config');

/**
 * Concurrency-limited queue for verification requests.
 * Ensures no more than maxConcurrent tasks run simultaneously.
 */
class VerificationQueue {
  constructor(maxConcurrent) {
    this.maxConcurrent = maxConcurrent || config.maxConcurrentVerifications;
    this.running = 0;
    this.queue   = [];
  }

  add(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this._tick();
    });
  }

  _tick() {
    while (this.running < this.maxConcurrent && this.queue.length > 0) {
      const { fn, resolve, reject } = this.queue.shift();
      this.running++;
      fn()
        .then(resolve, reject)
        .finally(() => {
          this.running--;
          this._tick();
        });
    }
  }
}

module.exports = VerificationQueue;
