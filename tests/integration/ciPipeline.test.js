const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const os = require('os');

describe('integration: CI pipeline scenarios', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('IT-501: npm audit fails on known vulnerable package', () => {
    // create minimal project with vulnerable dependency
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"tmp","version":"1.0.0"}');
    spawnSync('npm', ['install', 'lodash@4.17.15'], { cwd: tmpDir, stdio: 'ignore' });
    const result = spawnSync('npm', ['audit', '--audit-level=high'], { cwd: tmpDir });
    expect(result.status).not.toBe(0);
  });

  test('IT-502: semgrep detects insecure pattern using baseline config', () => {
    const file = path.join(tmpDir, 'bad.js');
    fs.writeFileSync(file, 'if (a == b) { console.log("hi"); }');
    const result = spawnSync('node', [path.join(process.cwd(), 'scripts/semgrep.js'), file], { cwd: tmpDir });
    expect(result.status).not.toBe(0);
  });

  test('IT-503: custom rule appended to .semgrep.yml triggers scan', () => {
    const configPath = path.join(process.cwd(), '.semgrep.yml');
    const original = fs.readFileSync(configPath, 'utf8');
    // append a rule that matches console.log('secret')
    const extra = `\n  - id: test-custom\n    pattern: console.log('secret')\n    message: custom rule\n    languages: [javascript]\n    severity: ERROR\n`;
    fs.appendFileSync(configPath, extra);
    const file = path.join(tmpDir, 'secret.js');
    fs.writeFileSync(file, "console.log('secret');");
    // explicitly run scanner from project root so config is found
    const result = spawnSync('node', [path.join(process.cwd(), 'scripts/semgrep.js'), file], { cwd: process.cwd() });
    expect(result.status).not.toBe(0);
    // restore
    fs.writeFileSync(configPath, original);
  });

  test('IT-504: audit level from security-config.json respected', () => {
    const cfgPath = path.join(process.cwd(), 'security-config.json');
    const original = fs.readFileSync(cfgPath, 'utf8');
    const tmpPkg = path.join(tmpDir, 'package.json');
    fs.writeFileSync(tmpPkg, '{"name":"tmp","version":"1.0.0"}');
    spawnSync('npm', ['install', 'lodash@4.17.15'], { cwd: tmpDir, stdio: 'ignore' });

    // set a low threshold and run via helper script
    // copy threshold into tmpDir so script running there picks it up
    fs.writeFileSync(cfgPath, '{"auditLevel":"low"}');
    fs.writeFileSync(path.join(tmpDir, 'security-config.json'), '{"auditLevel":"low"}');
    const r1 = spawnSync('node', [path.join(process.cwd(), 'scripts/run-scans.js'), '--audit-only'], { cwd: tmpDir });
    // low level should still fail (since vulnerability is high severity) or at least produce exit !=0
    expect(r1.status).not.toBe(0);

    // set threshold to none should make helper succeed
    fs.writeFileSync(cfgPath, '{"auditLevel":"none"}');
    fs.writeFileSync(path.join(tmpDir, 'security-config.json'), '{"auditLevel":"none"}');
    const r2 = spawnSync('node', [path.join(process.cwd(), 'scripts/run-scans.js'), '--audit-only'], { cwd: tmpDir });
    expect(r2.status).toBe(0);

    fs.writeFileSync(cfgPath, original);
  });
});
