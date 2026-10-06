'use strict';

const { parseMaskedPattern, isValidGuess } = require('./CandidateMatcher');

/**
 * Generates name-derived candidates by producing bounded 2-character guesses
 * and reconstructing the full email: prefix + guess + suffix.
 *
 * The source application enforces exactly-2-char guesses, so we generate
 * guesses directly rather than filtering full email forms.
 */
function generate(contactName, maskedEmail) {
  const pattern = parseMaskedPattern(maskedEmail);
  if (!pattern || pattern.fullyKnown) return [];

  const prefix = pattern.prefix.toLowerCase();
  const suffix = pattern.suffix.toLowerCase();

  // Whether the @ sign is visible in the suffix, or hidden inside the **
  const atInSuffix = suffix.includes('@');

  // Normalize name into word parts
  const parts = contactName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return [];

  const first  = parts[0];
  const last   = parts.length > 1 ? parts[parts.length - 1] : '';
  const middle = parts.length > 2 ? parts[1] : '';

  const guessSet = new Set();

  const add = (g) => { if (isValidGuess(g)) guessSet.add(g.toLowerCase()); };

  // ── From first name ──────────────────────────────────────────────────────
  // If first name starts with the known prefix, take the next 2 chars
  if (first.startsWith(prefix)) {
    const rest = first.slice(prefix.length);
    if (rest.length >= 2) add(rest.slice(0, 2));       // e.g. prefix=AJA, first=AJAYBHAI → "YB"
    if (rest.length >= 1) {
      add(rest[0] + '.');                              // "Y."
      add(rest[0] + '_');                              // "Y_"
      add(rest[0] + '/');                              // "Y/"
      if (last)   add(rest[0] + last[0]);              // "YS"
      if (middle) add(rest[0] + middle[0]);            // "YM"
    }
  }

  // First 2 chars of first name (regardless of prefix match)
  if (first.length >= 2) add(first.slice(0, 2));
  if (first.length >= 1 && last.length >= 1) {
    add(first[0] + last[0]);    // initials
    add(last[0] + first[0]);    // reversed initials
    add(first[0] + '.');
    add(first[0] + '_');
    add(first[0] + '/');
    add('.' + first[0]);
    add('_' + first[0]);
  }

  // First 2 chars of last name
  if (last.length >= 2) add(last.slice(0, 2));
  if (last.length >= 1 && middle.length >= 1) add(last[0] + middle[0]);

  // Middle name
  if (middle.length >= 2) add(middle.slice(0, 2));

  // ── @ hidden inside ** (patterns like CEO**LIEN.IN) ─────────────────────
  // The guess must contain @ to produce a valid email.
  // Try: name-char + @  (e.g. "r@" → ceor@lien.in)
  if (!atInSuffix) {
    const initials = [first[0], last[0], middle[0]].filter(Boolean);
    for (const ch of initials) {
      add(ch + '@');   // e.g. "r@"
      add('@' + ch);   // e.g. "@r" — less common but possible
    }
    // Also try first 2 chars of first name + @ variants
    if (first.startsWith(prefix) && prefix.length < first.length) {
      const next = first[prefix.length];
      add(next + '@');
    }
  }

  // Reconstruct full candidates: prefix + guess + suffix
  const results = [];
  const seen = new Set();

  for (const guess of guessSet) {
    const candidate = (prefix + guess + suffix).toLowerCase();
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    // Quick sanity: must have exactly one @
    if ((candidate.match(/@/g) || []).length !== 1) continue;
    results.push({ candidate, source: 'NAME', priority: 1 });
  }

  return results;
}

module.exports = { generate };
