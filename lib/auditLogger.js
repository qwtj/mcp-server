const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const logDir = path.join(__dirname, '..', 'logs');
// Use a worker-specific filename to avoid test-suite parallelism collisions (Jest sets JEST_WORKER_ID)
const workerId = process.env.JEST_WORKER_ID || process.pid;
const logFile = path.join(logDir, `audit-${workerId}.log`);

// ensure directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

function _computeChecksum(entryString) {
  return crypto.createHash('sha256').update(entryString).digest('hex');
}

function logEvent(event) {
  const timestamp = new Date().toISOString();
  const entry = {
    timestamp,
    ...event
  };
  const entryString = JSON.stringify(entry);
  const checksum = _computeChecksum(entryString);
  const line = JSON.stringify({ entry, checksum }) + '\n';
  // append-only semantics via appendFile
  fs.appendFileSync(logFile, line, { flag: 'a' });
}

function verifyIntegrity() {
  if (!fs.existsSync(logFile)) return true;
  const contents = fs.readFileSync(logFile, 'utf8').trim().split('\n');
  for (const line of contents) {
    if (!line) continue;
    try {
      const { entry, checksum } = JSON.parse(line);
      const computed = _computeChecksum(JSON.stringify(entry));
      if (computed !== checksum) {
        return false;
      }
    } catch (err) {
      return false;
    }
  }
  return true;
}

module.exports = {
  logEvent,
  verifyIntegrity,
  _logFile: logFile,
  _computeChecksum
};
