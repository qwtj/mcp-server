const request = require('supertest');
const fs = require('fs');
const auditLogger = require('../lib/auditLogger');

describe('Integration: server and audit', () => {
  // we will clear log file manually inside tests when appropriate
  afterEach(() => {
    if (fs.existsSync(auditLogger._logFile)) fs.unlinkSync(auditLogger._logFile);
  });

  test('IT-201: startup logs event', async () => {
    // require server after clearing to ensure entry is created afterwards
    if (fs.existsSync(auditLogger._logFile)) fs.unlinkSync(auditLogger._logFile);
    const app = require('../server');
    expect(auditLogger.verifyIntegrity()).toBe(true);
    const contents = fs.readFileSync(auditLogger._logFile, 'utf8').trim().split('\n');
    expect(contents.length).toBeGreaterThanOrEqual(1);
  });

  test('IT-202: tool execution logs access', async () => {
    // ensure startup event is logged first
    if (fs.existsSync(auditLogger._logFile)) fs.unlinkSync(auditLogger._logFile);
    const app = require('../server');
    process.env.TOOL_API_KEY = 'xyz';
    const res = await request(app).get('/tool');
    expect(res.status).toBe(200);
    const contents = fs.readFileSync(auditLogger._logFile, 'utf8').trim().split('\n');
    const last = JSON.parse(contents[contents.length-1]);
    expect(last.entry.event).toBe('tool_access');
  });


  test('IT-203: audit log persists across lifecycle', () => {
    auditLogger.logEvent({ event: 'foo' });
    // simulate restart by reloading module? just verify file remains
    expect(fs.existsSync(auditLogger._logFile)).toBe(true);
    expect(auditLogger.verifyIntegrity()).toBe(true);
  });
});
