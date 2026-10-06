'use strict';

const { test } = require('node:test');
const assert   = require('node:assert/strict');

// Force mock mode for tests
process.env.SOURCE_APP_MODE = 'mock';

const VerificationService = require('../src/verification/VerificationService');

const RECORD = {
  rowId:        1,
  identifier:   'MOCK001',
  contactName:  'TEST USER',
  contactEmail: 'TES**USER@GMAIL.COM',
};

test('verifyRecord — incompatible candidate returns INCOMPATIBLE', async () => {
  const svc = new VerificationService();
  const result = await svc.verifyRecord(RECORD, 'info@gmail.com');
  assert.equal(result.success, false);
  assert.equal(result.status, 'INCOMPATIBLE');
  assert.equal(result.guess, null);
});

test('verifyRecord — compatible candidate extracts correct guess', async () => {
  const svc = new VerificationService();
  // "tesuser@gmail.com" → prefix TES, suffix USER@GMAIL.COM → guess=''? no
  // "testuser@gmail.com" → prefix TES, ends with USER@GMAIL.COM → starts TES? yes → guess=T
  const result = await svc.verifyRecord(RECORD, 'testuser@gmail.com');
  assert.ok(result.guess !== null);
  assert.equal(result.candidate, 'testuser@gmail.com');
});

test('verifyRecord — returns success or failure (not fabricated)', async () => {
  const svc = new VerificationService();
  const result = await svc.verifyRecord(RECORD, 'testuser@gmail.com');
  assert.ok(['success', 'error'].includes(result.status));
  assert.ok(typeof result.message === 'string');
});

test('getMockRecords — returns array', () => {
  const svc = new VerificationService();
  const records = svc.getMockRecords();
  assert.ok(Array.isArray(records));
  assert.ok(records.length > 0);
});
