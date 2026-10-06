'use strict';

const { parseMaskedPattern, isValidGuess } = require('./CandidateMatcher');

// All characters the server accepts in a 2-char guess.
// Includes @ — required for patterns where @ is hidden inside **.
// The double-@ filter below protects against invalid reconstructions.
const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789._/@';

/**
 * Generates every valid 2-char combination not yet tried,
 * reconstructed as a full candidate: prefix + guess + suffix.
 *
 * Max 39×39 = 1521 candidates per record.
 * Called only after NAME / DICTIONARY / EXPLICIT are exhausted.
 */
function generate(maskedEmail, triedGuesses = new Set()) {
  const pattern = parseMaskedPattern(maskedEmail);
  if (!pattern || pattern.fullyKnown) return [];

  const prefix = pattern.prefix.toLowerCase();
  const suffix = pattern.suffix.toLowerCase();
  if (!suffix.includes('@')) return [];

  const results = [];

  for (const c1 of CHARS) {
    for (const c2 of CHARS) {
      const guess = c1 + c2;
      if (triedGuesses.has(guess)) continue;
      if (!isValidGuess(guess)) continue;

      const candidate = (prefix + guess + suffix).toLowerCase();

      // Skip if the reconstructed email would have more than one @
      if ((candidate.match(/@/g) || []).length !== 1) continue;

      results.push({ candidate, source: 'BRUTEFORCE', priority: 4 });
    }
  }

  return results;
}

module.exports = { generate };
