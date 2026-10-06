'use strict';

const { parseMaskedPattern, isCompatible, extractGuess, isValidGuess } = require('./CandidateMatcher');

/**
 * Generates candidates from name-truncation abbreviation patterns:
 *   first[k] + last[l], last[k] + first[l], with separators . and _
 *   e.g. name "Aayush Ramrakhyani", pattern AA**AM@GMAIL.COM
 *        → tries "aayram" → prefix=aa, suffix=am@gmail.com → guess="yr" ✓
 *
 * Only handles patterns where @ is visible in the suffix.
 * Patterns where @ is hidden (CEO**LIEN.IN) are handled by the NAME stage.
 */
function generate(contactName, maskedEmail) {
  const pattern = parseMaskedPattern(maskedEmail);
  if (!pattern || pattern.fullyKnown) return [];
  if (!pattern.suffix.includes('@')) return [];

  const domain = pattern.domain.toLowerCase();

  const parts = contactName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length < 2) return [];

  const first  = parts[0];
  const last   = parts[parts.length - 1];
  const middle = parts.length > 2 ? parts[1] : '';

  const locals = new Set();

  // first[k] + sep + last[l]
  for (let k = 1; k <= Math.min(first.length, 6); k++) {
    for (let l = 1; l <= Math.min(last.length, 6); l++) {
      const f  = first.slice(0, k);
      const la = last.slice(0, l);
      locals.add(f + la);
      locals.add(f + '.' + la);
      locals.add(f + '_' + la);
    }
  }

  // last[k] + sep + first[l]
  for (let k = 1; k <= Math.min(last.length, 6); k++) {
    for (let l = 1; l <= Math.min(first.length, 6); l++) {
      const la = last.slice(0, k);
      const f  = first.slice(0, l);
      locals.add(la + f);
      locals.add(la + '.' + f);
      locals.add(la + '_' + f);
    }
  }

  // first[k] + middle[m] + last[l]
  if (middle) {
    for (let k = 1; k <= Math.min(first.length, 4); k++) {
      for (let m = 1; m <= Math.min(middle.length, 3); m++) {
        for (let l = 1; l <= Math.min(last.length, 4); l++) {
          locals.add(first.slice(0, k) + middle.slice(0, m) + last.slice(0, l));
        }
      }
    }
  }

  const results = [];
  const seen    = new Set();

  for (const local of locals) {
    const candidate = local + '@' + domain;
    if (seen.has(candidate)) continue;
    seen.add(candidate);

    if (!isCompatible(maskedEmail, candidate)) continue;

    const guess = extractGuess(maskedEmail, candidate);
    if (!guess || !isValidGuess(guess)) continue;

    if ((candidate.match(/@/g) || []).length !== 1) continue;

    results.push({ candidate, source: 'ABBR', priority: 2 });
  }

  return results;
}

module.exports = { generate };
