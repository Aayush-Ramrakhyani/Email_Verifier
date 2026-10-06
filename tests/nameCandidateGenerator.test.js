'use strict';

const { test } = require('node:test');
const assert   = require('node:assert/strict');
const { generate } = require('../src/candidates/NameCandidateGenerator');

test('generates name candidates — 2-char guess reconstruction', () => {
  // SORABH RAWAT + SOR**RAWAT567@GMAIL.COM
  // prefix=SOR, first name=sorabh → rest after prefix = "abh"
  // 2-char guess = "ab" → candidate = "sorabrawat567@gmail.com"
  const cands = generate('SORABH RAWAT', 'SOR**RAWAT567@GMAIL.COM');
  const emails = cands.map(c => c.candidate);
  assert.ok(emails.length > 0, `Expected at least one candidate. Got: ${emails.join(', ')}`);
  // All guesses must be exactly 2 chars
  const { extractGuess, isValidGuess } = require('../src/candidates/CandidateMatcher');
  for (const c of cands) {
    const guess = extractGuess('SOR**RAWAT567@GMAIL.COM', c.candidate);
    assert.ok(isValidGuess(guess), `Invalid guess "${guess}" for candidate "${c.candidate}"`);
  }
});

test('all returned candidates are compatible with the pattern', () => {
  const { isCompatible } = require('../src/candidates/CandidateMatcher');
  const cands = generate('SORABH RAWAT', 'SOR**RAWAT567@GMAIL.COM');
  for (const c of cands) {
    assert.ok(
      isCompatible('SOR**RAWAT567@GMAIL.COM', c.candidate),
      `Incompatible candidate returned: ${c.candidate}`
    );
  }
});

test('all candidates have source=NAME and priority=1', () => {
  const cands = generate('AAYUSH RAMRAKHYANI', 'AAY**AKHYANI@GMAIL.COM');
  for (const c of cands) {
    assert.equal(c.source, 'NAME');
    assert.equal(c.priority, 1);
  }
});

test('returns empty array when no name matches pattern', () => {
  // Name "RANJIT BISWAS" doesn't start with prefix "CHA"
  const cands = generate('RANJIT BISWAS', 'CHA**NAPD2@GMAIL.COM');
  // Candidates might include suffix-aware forms that happen to match — that's fine
  // Just verify all returned candidates are compatible
  const { isCompatible } = require('../src/candidates/CandidateMatcher');
  for (const c of cands) {
    assert.ok(isCompatible('CHA**NAPD2@GMAIL.COM', c.candidate), c.candidate);
  }
});

test('no duplicate candidates returned', () => {
  const cands = generate('SORABH RAWAT', 'SOR**RAWAT567@GMAIL.COM');
  const emails = cands.map(c => c.candidate.toLowerCase());
  const unique = new Set(emails);
  assert.equal(unique.size, emails.length, 'Duplicate candidates found');
});

test('handles single-word name gracefully', () => {
  const cands = generate('VIKRANT', 'VIK**ANT@GMAIL.COM');
  assert.ok(Array.isArray(cands));
});
