'use strict';

/**
 * Normalizes a raw API record into the internal structure.
 *
 * Raw API fields (confirmed from GET /api/records):
 *   id             - numeric row ID
 *   din            - identifier (DIN number)
 *   contact_name   - full contact name
 *   contact_email  - masked email pattern (e.g. "VKR**LUCKY93@GMAIL.COM")
 *   contact_mobile - masked mobile (e.g. "827XXXX969")
 *
 * Fields not present in the raw record (status, message, guestInput)
 * come from the Verify API response and are set to null here.
 */
function normalize(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('normalize: expected a record object');
  }

  return {
    rowId:        raw.id,
    identifier:   raw.din,
    contactName:  raw.contact_name  || '',
    contactEmail: raw.contact_email || '',
    guestInput:   null,   // populated after verification
    status:       null,   // populated after verification
    message:      null,   // populated after verification
    raw,
  };
}

function normalizeAll(records) {
  if (!Array.isArray(records)) {
    throw new Error('normalizeAll: expected an array');
  }
  return records.map(normalize);
}

module.exports = { normalize, normalizeAll };
