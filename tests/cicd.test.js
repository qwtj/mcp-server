// tests/cicd.test.js

const fs = require('fs');

const path = require('path');
const yaml = require('js-yaml');

describe('CI/CD config', () => {
  test('UT-501: ci.yml exists and contains semgrep and audit steps', () => {
    const ci = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
    expect(ci).toMatch(/npm audit/);
    expect(ci).toMatch(/semgrep/);
  });

  test('UT-502: .semgrep.yml is present and valid YAML', () => {
    const file = '.semgrep.yml';
    expect(fs.existsSync(file)).toBe(true);
    const parsed = yaml.load(fs.readFileSync(file, 'utf8'));
    expect(parsed).toHaveProperty('rules');
  });

  test('UT-503: security-config.json has threshold keys', () => {
    const cfg = JSON.parse(fs.readFileSync('security-config.json', 'utf8'));
    expect(cfg).toHaveProperty('auditLevel');
  });

  test('UT-504: package.json includes scan scripts', () => {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    expect(pkg.scripts).toHaveProperty('scan:sast');
    expect(pkg.scripts).toHaveProperty('scan:deps');
    expect(pkg.scripts).toHaveProperty('scan');
  });

  test('UT-505: semgrep script exists', () => {
    expect(fs.existsSync('scripts/semgrep.js')).toBe(true);
  });
});
