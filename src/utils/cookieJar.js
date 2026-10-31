/*
 * cookieJar.js
 * In-memory session cookie store: SourceClient writes the cookie from the
 * initial records fetch; VerificationService reads it on every POST /api/validate.
 */

'use strict';

// Stores the session cookie received from GET /api/records.
// SourceClient writes it; VerificationService reads it on every POST.

let _cookie = '';

function setCookieFromHeader(setCookieHeader) {
  if (!setCookieHeader) return;
  const headers = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader]; // Set-Cookie can be a single string or an array of strings
  // Keep only the name=value part of each Set-Cookie directive (strip path, domain, expiry etc.)
  _cookie = headers.map(h => h.split(';')[0].trim()).filter(Boolean).join('; '); // joined so multiple cookies are sent in one Cookie header
}

function getCookie() {
  return _cookie;
}

module.exports = { setCookieFromHeader, getCookie };
