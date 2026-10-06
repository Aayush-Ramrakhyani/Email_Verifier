'use strict';

const { test } = require('node:test');
const assert   = require('node:assert/strict');
const { normalize, normalizeAll } = require('../src/source/RecordNormalizer');

const RAW = {
  id: 84284,
  din: '11867533',
  contact_name: 'SAPNA KUMARI',
  contact_email: 'SSS**3456AS@GMAIL.COM',
  contact_mobile: '827XXXX969',
};

test('normalize maps all fields correctly', () => {
  const r = normalize(RAW);
  assert.equal(r.rowId,        84284);
  assert.equal(r.identifier,   '11867533');
  assert.equal(r.contactName,  'SAPNA KUMARI');
  assert.equal(r.contactEmail, 'SSS**3456AS@GMAIL.COM');
  assert.equal(r.guestInput,   null);
  assert.equal(r.status,       null);
  assert.equal(r.message,      null);
  assert.deepEqual(r.raw, RAW);
});

test('normalize does not modify raw record', () => {
  const copy = { ...RAW };
  normalize(RAW);
  assert.deepEqual(RAW, copy);
});

test('normalizeAll handles empty array', () => {
  assert.deepEqual(normalizeAll([]), []);
});

test('normalizeAll maps array correctly', () => {
  const result = normalizeAll([RAW, RAW]);
  assert.equal(result.length, 2);
  assert.equal(result[0].rowId, 84284);
});

test('normalize throws on non-object input', () => {
  assert.throws(() => normalize(null));
  assert.throws(() => normalize('string'));
});
