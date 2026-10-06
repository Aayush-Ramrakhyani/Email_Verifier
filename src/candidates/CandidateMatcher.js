'use strict';

/**
 * Parses a masked email pattern like "VKR**LUCKY93@GMAIL.COM".
 * The ** separates the known prefix from the known suffix.
 * Returns { prefix, suffix, domain, fullyKnown }.
 */
function parseMaskedPattern(maskedEmail) {
  if (!maskedEmail || typeof maskedEmail !== 'string') return null;

  const upper = maskedEmail.toUpperCase().trim();
  const idx = upper.indexOf('**');

  if (idx === -1) {
    // No mask — email is fully known
    const domain = upper.includes('@') ? upper.split('@').slice(1).join('@') : '';
    return { prefix: upper, suffix: '', domain, fullyKnown: true };
  }

  const afterStars = idx + 2;
  const suffix = upper.slice(afterStars);
  const domain = suffix.includes('@') ? suffix.split('@').slice(1).join('@') : '';

  return {
    prefix: upper.slice(0, idx),
    suffix,
    domain,
    fullyKnown: false,
  };
}

/**
 * Returns true if `candidate` is compatible with the masked email pattern.
 * Compatibility means the candidate starts with the known prefix
 * and ends with the known suffix (case-insensitive).
 */
function isCompatible(maskedEmail, candidate) {
  if (!candidate || typeof candidate !== 'string') return false;

  const p = parseMaskedPattern(maskedEmail);
  if (!p) return false;

  const upper = candidate.toUpperCase().trim();

  if (p.fullyKnown) return upper === p.prefix;

  return upper.startsWith(p.prefix) && upper.endsWith(p.suffix);
}

/**
 * Extracts the guess string — the characters that fill the ** gap —
 * from a compatible candidate.
 * Returns null if the candidate is not compatible with the pattern.
 */
function extractGuess(maskedEmail, candidate) {
  const p = parseMaskedPattern(maskedEmail);
  if (!p || p.fullyKnown) return null;

  const upper = candidate.toUpperCase().trim();
  if (!upper.startsWith(p.prefix) || !upper.endsWith(p.suffix)) return null;

  // Return guess in lowercase (email-safe)
  const guessUpper = upper.slice(p.prefix.length, upper.length - p.suffix.length);
  return guessUpper.toLowerCase();
}

/**
 * Validates that a guess is accepted by the source application.
 * Server rule: "Guess must be exactly 2 alphanumeric characters or have . / _ / @"
 * Interpreted as: exactly 2 characters, each alphanumeric or one of [. / _ @]
 */
const VALID_GUESS_RE = /^[a-z0-9./_@]{2}$/i;

function isValidGuess(guess) {
  return typeof guess === 'string' && VALID_GUESS_RE.test(guess);
}

module.exports = { parseMaskedPattern, isCompatible, extractGuess, isValidGuess };
