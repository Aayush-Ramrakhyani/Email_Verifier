/*
 * DictionaryCandidateGenerator.js
 * Generates email candidates from a static role/keyword dictionary (config/dictionary.json)
 * and filters them by compatibility with the masked email pattern.
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { parseMaskedPattern, isCompatible, extractGuess, isValidGuess } = require('./CandidateMatcher');

const DICT_PATH = path.join(__dirname, '../../config/dictionary.json');

function loadDictionary() {
  try {
    const raw = fs.readFileSync(DICT_PATH, 'utf8');
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    // Deduplicate and normalize
    return [...new Set(list.map(w => String(w).toLowerCase().trim()).filter(Boolean))]; // deduplicate and normalise on load to avoid redundant API calls
  } catch {
    return [];
  }
}

/**
 * Generates role/dictionary email candidates and filters them
 * by compatibility with the masked email pattern.
 */
function generate(maskedEmail) {
  const pattern = parseMaskedPattern(maskedEmail);
  if (!pattern || pattern.fullyKnown || !pattern.domain) return [];

  const domain = pattern.domain.toLowerCase();
  const words = loadDictionary();
  const results = [];
  const seen = new Set();

  for (const word of words) {
    const candidate = `${word}@${domain}`;
    if (seen.has(candidate)) continue;
    seen.add(candidate);

    if (isCompatible(maskedEmail, candidate)) {
      const guess = extractGuess(maskedEmail, candidate);
      if (isValidGuess(guess)) { // only include if the extracted guess satisfies the server's 2-char rule
        results.push({ candidate, source: 'DICTIONARY', priority: 2 });
      }
    }
  }

  return results;
}

module.exports = { generate };
