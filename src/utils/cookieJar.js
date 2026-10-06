'use strict';

// Stores the session cookie received from GET /api/records.
// SourceClient writes it; VerificationService reads it on every POST.

let _cookie = '';

function setCookieFromHeader(setCookieHeader) {
  if (!setCookieHeader) return;
  const headers = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  // Keep only the name=value part of each Set-Cookie directive
  _cookie = headers.map(h => h.split(';')[0].trim()).filter(Boolean).join('; ');
}

function getCookie() {
  return _cookie;
}

module.exports = { setCookieFromHeader, getCookie };
