'use strict';

function timestamp() {
  return new Date().toTimeString().slice(0, 8);
}

function info(msg) {
  console.log(`[${timestamp()}] ${msg}`);
}

function warn(msg) {
  console.warn(`[${timestamp()}] WARN  ${msg}`);
}

function error(msg) {
  console.error(`[${timestamp()}] ERROR ${msg}`);
}

function debug(msg) {
  if (process.env.DEBUG === 'true') {
    console.log(`[${timestamp()}] DEBUG ${msg}`);
  }
}

module.exports = { info, warn, error, debug };
