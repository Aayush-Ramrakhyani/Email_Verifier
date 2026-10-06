'use strict';

const { test } = require('node:test');
const assert   = require('node:assert/strict');
const { parseMaskedPattern, isCompatible, extractGuess } = require('../src/candidates/CandidateMatcher');

test('parseMaskedPattern — masked email', () => {
  const p = parseMaskedPattern('VKR**LUCKY93@GMAIL.COM');
  assert.equal(p.prefix, 'VKR');
  assert.equal(p.suffix, 'LUCKY93@GMAIL.COM');
  assert.equal(p.domain, 'GMAIL.COM');
  assert.equal(p.fullyKnown, false);
});

test('parseMaskedPattern — fully known email (no **)', () => {
  const p = parseMaskedPattern('INFO@GMAIL.COM');
  assert.equal(p.fullyKnown, true);
  assert.equal(p.prefix, 'INFO@GMAIL.COM');
});

test('parseMaskedPattern — null input', () => {
  assert.equal(parseMaskedPattern(null), null);
  assert.equal(parseMaskedPattern(''), null);
});

test('isCompatible — matching candidate', () => {
  assert.equal(isCompatible('I**O@GMAIL.COM', 'info@gmail.com'), true);
});

test('isCompatible — non-matching candidate (wrong prefix)', () => {
  assert.equal(isCompatible('I**O@GMAIL.COM', 'support@gmail.com'), false);
});

test('isCompatible — non-matching candidate (wrong suffix)', () => {
  assert.equal(isCompatible('I**O@GMAIL.COM', 'info@yahoo.com'), false);
});

test('isCompatible — case insensitive', () => {
  assert.equal(isCompatible('SOR**RAWAT567@GMAIL.COM', 'SORABHRAWAT567@GMAIL.COM'), true);
  assert.equal(isCompatible('SOR**RAWAT567@GMAIL.COM', 'sorabhrawat567@gmail.com'), true);
});

test('extractGuess — correct extraction', () => {
  const guess = extractGuess('SOR**RAWAT567@GMAIL.COM', 'sorabhrawat567@gmail.com');
  assert.equal(guess, 'abh');
});

test('extractGuess — with separator', () => {
  const guess = extractGuess('SOR**RAWAT567@GMAIL.COM', 'sorabh.rawat567@gmail.com');
  assert.equal(guess, 'abh.');
});

test('extractGuess — incompatible candidate returns null', () => {
  const guess = extractGuess('VKR**LUCKY93@GMAIL.COM', 'info@gmail.com');
  assert.equal(guess, null);
});

test('extractGuess — matches verify payload format (2-char guess)', () => {
  // Simulates the network capture: guess="RA" for some 2-char ** pattern
  const guess = extractGuess('CHA**NAPD2@GMAIL.COM', 'charanapd2@gmail.com');
  assert.equal(guess, 'ra');
});
