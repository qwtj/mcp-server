// Simple configuration helper with allowlist support

const fs = require('fs');
const path = require('path');

function getSecretBackendName() {
  // allow overriding via environment variable
  return process.env.SECRET_BACKEND || 'env';
}

// allowlist configuration
const allowlistPath = path.join(__dirname, '..', 'config', 'allowlist.json');
let _allowlist = [];

function loadAllowlist() {
  try {
    const raw = fs.readFileSync(allowlistPath, 'utf8');
    _allowlist = JSON.parse(raw);
    if (!Array.isArray(_allowlist)) {
      throw new Error('allowlist must be an array');
    }
  } catch (err) {
    // if file missing or invalid, keep previous list and rethrow for caller
    throw err;
  }
}

function getAllowlist() {
  return _allowlist.slice();
}

function reloadAllowlist() {
  try {
    loadAllowlist();
    return true;
  } catch (err) {
    // log error via auditLogger if available
    const audit = require('./auditLogger');
    try {
      audit.logEvent({ event: 'allowlist_reload_failed', reason: err.message });
    } catch (_) {
      // ignore
    }
    return false;
  }
}

// initial load attempt (silently ignore failures, an empty list is acceptable)
try {
  loadAllowlist();
} catch (e) {
  _allowlist = [];
}

// watch file for changes (disabled by default; enable with env var)
// this avoids open handles during tests and lets operators opt-in
if (process.env.ENABLE_ALLOWLIST_WATCH === 'true') {
  fs.watchFile(allowlistPath, { interval: 1000 }, (curr, prev) => {
    if (curr.mtime !== prev.mtime) {
      reloadAllowlist();
    }
  });
}

module.exports = {
  getSecretBackendName,
  getAllowlist,
  reloadAllowlist
};
