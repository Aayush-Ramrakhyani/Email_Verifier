'use strict';

require('dotenv').config();

const fs   = require('fs');
const path = require('path');

const config         = require('./config/config');
const logger         = require('./utils/logger');
const { withRetry, SessionExpiredError } = require('./utils/retry');
const { createThrottle } = require('./utils/rateLimiter');

const SourceClient     = require('./source/SourceClient');
const { normalizeAll } = require('./source/RecordNormalizer');

const NameGen     = require('./candidates/NameCandidateGenerator');
const AbbrGen     = require('./candidates/AbbreviationCandidateGenerator');
const DictGen     = require('./candidates/DictionaryCandidateGenerator');
const ExplicitGen = require('./candidates/ExplicitCandidateGenerator');

const { parseMaskedPattern, isValidGuess } = require('./candidates/CandidateMatcher');
const VerificationService = require('./verification/VerificationService');
const ResultStore         = require('./storage/ResultStore');
const ProgressStore       = require('./storage/ProgressStore');

const DATA_DIR     = config.dataDir;
const RECORDS_FILE = path.join(DATA_DIR, 'records.json');
const SUMMARY_FILE = path.join(DATA_DIR, 'summary.json');

// All valid 2-char combos for brute-force
const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789._/@';
const ALL_COMBOS = [];
for (const c1 of CHARS) {
  for (const c2 of CHARS) {
    const g = c1 + c2;
    if (isValidGuess(g)) ALL_COMBOS.push(g);
  }
}

// ─── Async Queue ──────────────────────────────────────────────────────────────
// Multiple concurrent consumers can safely pull from the same queue.
// Items are distributed one-per-consumer; close() signals all consumers to exit.

class AsyncQueue {
  constructor(name) {
    this._name    = name;
    this._items   = [];
    this._waiters = [];
    this._done    = false;
  }

  push(item) {
    this._items.push(item);
    if (this._waiters.length > 0) this._waiters.shift()();
  }

  close() {
    this._done = true;
    while (this._waiters.length > 0) this._waiters.shift()();
  }

  async next() {
    while (this._items.length === 0 && !this._done) {
      await new Promise(r => this._waiters.push(r));
    }
    if (this._items.length > 0) return { value: this._items.shift(), done: false };
    return { value: undefined, done: true };
  }

  async *[Symbol.asyncIterator]() {
    for (;;) {
      const { value, done } = await this.next();
      if (done) return;
      yield value;
    }
  }

  get size() { return this._items.length; }
}

// ─── Worker Pool ──────────────────────────────────────────────────────────────
// Spawns `count` concurrent workers, each with its own throttle, all pulling
// from the same queue. Resolves when every worker exits (queue empty + closed).

async function runWorkers(queue, count, taskFn) {
  const slots = Array.from({ length: count }, async () => {
    const throttle = createThrottle();
    for await (const item of queue) await taskFn(item, throttle);
  });
  await Promise.all(slots);
}

// ─── Session recovery — shared across all concurrent workers ─────────────────
// One worker triggers it; all others await the same promise and resume together.

let _sessionRecovery = null;

async function waitForSessionRecovery() {
  if (!_sessionRecovery) {
    logger.warn('Session expired — all workers pausing 60 seconds');
    let remaining = 60;
    const tick = setInterval(() => {
      remaining--;
      process.stdout.write(`\r  Session recovering — resuming in ${remaining}s... `);
    }, 1000);
    _sessionRecovery = new Promise(r => setTimeout(r, 60_000)).then(() => {
      clearInterval(tick);
      process.stdout.write('\r                                               \r');
      _sessionRecovery = null;
      logger.info('Session recovered — all workers resuming');
    });
  }
  await _sessionRecovery;
}

// ─── Core: send one candidate to the verify API ───────────────────────────────

async function sendCandidate(record, candidateObj, activeSet, svc, resultStore, processedKeys, progress, throttle) {
  if (!activeSet.has(record.rowId)) return false;

  const key = `${record.rowId}:${candidateObj.candidate.toLowerCase()}`;
  if (processedKeys.has(key)) return false;

  // If another worker is recovering from session expiry, wait before sending
  if (_sessionRecovery) await _sessionRecovery;

  await throttle();
  if (!activeSet.has(record.rowId)) return false;

  let result;
  try {
    result = await withRetry(
      () => svc.verifyRecord(record, candidateObj.candidate),
      { maxRetries: config.maxRetries, baseDelayMs: 1000 }
    );
  } catch (err) {
    if (err instanceof SessionExpiredError) {
      await waitForSessionRecovery();
      // Retry this exact candidate once after recovery
      return sendCandidate(record, candidateObj, activeSet, svc, resultStore, processedKeys, progress, throttle);
    }
    logger.error(`Error ${record.contactEmail}: ${err.message}`);
    result = { success: false, status: 'ERROR', message: err.message, candidate: candidateObj.candidate, guess: null, rawResponse: null };
    progress.increment('errors');
  }

  processedKeys.add(key);
  resultStore.append(record, candidateObj, result);

  if (result.success) {
    logger.info(`SUCCESS [${candidateObj.source}] ${record.contactEmail} → ${candidateObj.candidate}`);
    progress.increment('verified');
    activeSet.delete(record.rowId);
    progress.save();
    return true;
  }

  if (result.status !== 'ERROR') progress.increment('invalid');
  return false;
}

// ─── Summary ──────────────────────────────────────────────────────────────────

function printSummary(progress, startMs, unresolved) {
  const d    = progress.data;
  const sec  = Math.round((Date.now() - startMs) / 1000);
  const mins = Math.floor(sec / 60);
  const secs = sec % 60;

  const summary = {
    verified:             d.verified,
    unresolved:           unresolved || 0,
    errors:               d.errors,
    nameCandidates:       d.nameCandidates,
    abbrCandidates:       d.abbrCandidates,
    dictionaryCandidates: d.dictionaryCandidates,
    explicitCandidates:   d.explicitCandidates,
    durationSeconds:      sec,
    completedAt:          new Date().toISOString(),
  };

  console.log('\n' + '='.repeat(50));
  console.log('PROCESSING COMPLETE');
  console.log('='.repeat(50));
  console.log(`Verified   : ${summary.verified}`);
  console.log(`Unresolved : ${summary.unresolved}`);
  console.log(`Errors     : ${summary.errors}`);
  console.log(`Duration   : ${mins}m ${secs}s`);
  console.log('='.repeat(50) + '\n');

  fs.writeFileSync(SUMMARY_FILE, JSON.stringify(summary, null, 2), 'utf8');
  logger.info('Summary saved to data/summary.json');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const startMs = Date.now();

  const totalWorkers = config.nameWorkers + config.abbrWorkers + config.dictWorkers + config.bruteWorkers;
  const totalRps     = Math.round(totalWorkers * 1000 / config.requestDelayMs);
  logger.info(
    `Pipeline — NAME×${config.nameWorkers} → ABBR×${config.abbrWorkers} → DICT×${config.dictWorkers} → BRUTE×${config.bruteWorkers} — ~${totalRps} req/s`
  );

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  const progress    = new ProgressStore();
  const resultStore = new ResultStore();
  const svc         = new VerificationService();
  const client      = new SourceClient();

  if (config.resetProgress) {
    logger.info('RESET_PROGRESS=true — resetting');
    progress.reset();
  }

  const processedKeys = resultStore.loadProcessedKeys();
  logger.info(`Loaded ${processedKeys.size} previously tried keys`);

  let rawRecords;
  if (config.sourceAppMode === 'mock') {
    rawRecords = svc.getMockRecords();
  } else {
    rawRecords = await client.getRecords();
    fs.writeFileSync(RECORDS_FILE, JSON.stringify(rawRecords, null, 2), 'utf8');
  }

  if (rawRecords.length === 0) {
    logger.info('No records — already complete!');
    printSummary(progress, startMs, 0);
    return;
  }

  const records   = normalizeAll(rawRecords);
  const activeSet = new Set(records.map(r => r.rowId));
  logger.info(`${records.length} records loaded — launching pipeline`);

  // ── Queues ──────────────────────────────────────────────────────────────────
  const nameQ  = new AsyncQueue('name');
  const abbrQ  = new AsyncQueue('abbr');
  const dictQ  = new AsyncQueue('dict');
  const bruteQ = new AsyncQueue('brute');

  for (const record of records) nameQ.push(record);
  nameQ.close();

  // Periodic status log every 15 seconds
  const statusTimer = setInterval(() => {
    logger.info(
      `Progress — verified: ${progress.data.verified}/${records.length} | ` +
      `nameQ: ${nameQ.size} abbrQ: ${abbrQ.size} dictQ: ${dictQ.size} bruteQ: ${bruteQ.size}`
    );
  }, 15000);

  try {
    await Promise.all([

      // ── Stage 1: NAME ────────────────────────────────────────────────────────
      runWorkers(nameQ, config.nameWorkers, async (record, throttle) => {
        const cands = NameGen.generate(record.contactName, record.contactEmail);
        progress.increment('nameCandidates', cands.length);

        if (!activeSet.has(record.rowId)) { abbrQ.push(record); return; }

        let verified = false;
        for (const c of cands) {
          if (!activeSet.has(record.rowId)) { verified = true; break; }
          if (await sendCandidate(record, c, activeSet, svc, resultStore, processedKeys, progress, throttle)) {
            verified = true; break;
          }
        }
        if (!verified) abbrQ.push(record);
      }).then(() => { logger.info('[NAME] done → closing abbrQ'); abbrQ.close(); }),

      // ── Stage 2: ABBR ────────────────────────────────────────────────────────
      runWorkers(abbrQ, config.abbrWorkers, async (record, throttle) => {
        const cands = AbbrGen.generate(record.contactName, record.contactEmail);
        progress.increment('abbrCandidates', cands.length);

        if (!activeSet.has(record.rowId)) { dictQ.push(record); return; }

        let verified = false;
        for (const c of cands) {
          if (!activeSet.has(record.rowId)) { verified = true; break; }
          if (await sendCandidate(record, c, activeSet, svc, resultStore, processedKeys, progress, throttle)) {
            verified = true; break;
          }
        }
        if (!verified) dictQ.push(record);
      }).then(() => { logger.info('[ABBR] done → closing dictQ'); dictQ.close(); }),

      // ── Stage 3: DICT + EXPLICIT ─────────────────────────────────────────────
      runWorkers(dictQ, config.dictWorkers, async (record, throttle) => {
        const dictCands = DictGen.generate(record.contactEmail);
        const explCands = ExplicitGen.generate(record.contactEmail);
        const cands     = [...dictCands, ...explCands];
        progress.increment('dictionaryCandidates', dictCands.length);
        progress.increment('explicitCandidates',   explCands.length);

        if (!activeSet.has(record.rowId)) {
          if (config.enableBruteForce) bruteQ.push(record);
          return;
        }

        let verified = false;
        for (const c of cands) {
          if (!activeSet.has(record.rowId)) { verified = true; break; }
          if (await sendCandidate(record, c, activeSet, svc, resultStore, processedKeys, progress, throttle)) {
            verified = true; break;
          }
        }
        if (!verified && config.enableBruteForce) bruteQ.push(record);
      }).then(() => { logger.info('[DICT] done → closing bruteQ'); bruteQ.close(); }),

      // ── Stage 4: BRUTE FORCE — all 1521 combos for each record ───────────────
      runWorkers(bruteQ, config.bruteWorkers, async (record, throttle) => {
        if (!activeSet.has(record.rowId)) return;

        const pattern = parseMaskedPattern(record.contactEmail);
        if (!pattern || pattern.fullyKnown) return;

        for (const combo of ALL_COMBOS) {
          if (!activeSet.has(record.rowId)) break;

          const candidate = (pattern.prefix + combo + pattern.suffix).toLowerCase();
          if ((candidate.match(/@/g) || []).length !== 1) continue;

          await sendCandidate(
            record,
            { candidate, source: 'BRUTEFORCE', priority: 4 },
            activeSet, svc, resultStore, processedKeys, progress, throttle
          );
        }
      }).then(() => logger.info('[BRUTE] done')),

    ]);
  } catch (err) {
    clearInterval(statusTimer);
    throw err;
  }

  clearInterval(statusTimer);

  if (activeSet.size > 0) {
    logger.info(`${activeSet.size} records could not be resolved`);
    progress.increment('unknown', activeSet.size);
    progress.save();
  }

  printSummary(progress, startMs, activeSet.size);
}

main().catch(err => {
  require('./utils/logger').error(err.stack || err.message);
  process.exit(1);
});
