'use strict';

const fs   = require('fs');
const path = require('path');
const { isCompatible, extractGuess, isValidGuess } = require('./CandidateMatcher');

const CANDIDATES_PATH = path.join(__dirname, '../../config/candidates.json');

function loadExplicit() {
  try {
    const raw = fs.readFileSync(CANDIDATES_PATH, 'utf8');
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.map(c => String(c).toLowerCase().trim()).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Returns explicitly configured candidates that are compatible
 * with the masked email pattern.
 */
function generate(maskedEmail) {
  if (!maskedEmail) return [];

  const explicit = loadExplicit();
  const results = [];
  const seen = new Set();

  for (const candidate of explicit) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);

    if (isCompatible(maskedEmail, candidate)) {
      const guess = extractGuess(maskedEmail, candidate);
      if (isValidGuess(guess)) {
        results.push({ candidate, source: 'EXPLICIT', priority: 3 });
      }
    }
  }

  return results;
}

module.exports = { generate };
