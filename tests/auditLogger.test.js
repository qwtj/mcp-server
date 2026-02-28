const fs = require('fs');
const auditLogger = require('../lib/auditLogger');

const logFile = auditLogger._logFile;

describe('Audit logger', () => {
  beforeEach(() => {
    if (fs.existsSync(logFile)) fs.unlinkSync(logFile);
  });
  afterEach(() => {
    if (fs.existsSync(logFile)) fs.unlinkSync(logFile);
  });

  test('UT-103: appends entry with metadata', () => {
    auditLogger.logEvent({ event: 'test_event', data: 123 });
    const contents = fs.readFileSync(logFile, 'utf8').trim().split('\n');
    expect(contents.length).toBe(1);
    const { entry, checksum } = JSON.parse(contents[0]);
    expect(entry.event).toBe('test_event');
    expect(typeof checksum).toBe('string');
  });

  test('UT-104: prevents modification of existing entries (detects tamper)', () => {
    auditLogger.logEvent({ event: 'first' });
    // manually tamper by rewriting file
    fs.writeFileSync(logFile, 'corrupt');
    expect(auditLogger.verifyIntegrity()).toBe(false);
  });

  test('UT-105: checksum calculated correctly', () => {
    const obj = { a: 1, b: 2 };
    const line = JSON.stringify({ entry: obj, checksum: auditLogger._computeChecksum(JSON.stringify(obj)) });
    // write line and verify
    fs.appendFileSync(logFile, line + '\n');
    expect(auditLogger.verifyIntegrity()).toBe(true);
  });
});
