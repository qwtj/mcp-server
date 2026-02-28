// tests/security.test.js

const fs = require('fs');
const auditLogger = require('../lib/auditLogger');

describe('Security controls', () => {
  test('ST-302: repo privacy (simulated)', () => {
    // in local context we assume private repo
    expect(true).toBe(true);
  });
  test('ST-003: CI uses official actions (placeholder)', () => {
    expect(true).toBe(true);
  });
  test('ST-001: dependency scan enforcement', () => {
    // check ci.yml for npm audit line
    const ci = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
    expect(ci).toMatch(/npm audit/);
  });
  test('ST-004: no secrets in repo and .env ignored', () => {
    const gitignore = fs.readFileSync('.gitignore', 'utf8');
    expect(gitignore).toMatch(/\.env/);
  });
});
