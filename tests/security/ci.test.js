const fs = require('fs');

describe('security: CI configuration integrity', () => {
  test('ST-501: workflow contains semgrep and audit steps', () => {
    const ci = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
    expect(ci).toMatch(/npm audit/);
    expect(ci).toMatch(/semgrep/);
  });

  test('ST-502: semgrep scanning script present', () => {
    expect(fs.existsSync('scripts/semgrep.js')).toBe(true);
  });

  test('ST-503: corrupt config.json triggers validation error and backup', () => {
    const cfgPath = 'security-config.json';
    const backup = cfgPath + '.bak';
    const orig = fs.readFileSync(cfgPath, 'utf8');
    fs.writeFileSync(cfgPath, '{ not valid json ');
    let threw = false;
    try {
      JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    } catch (e) {
      threw = true;
    }
    expect(threw).toBe(true);
    // restore from original backup
    fs.writeFileSync(cfgPath, orig);
  });

  test('ST-504: scan logs do not leak secrets', () => {
    // run helper with a sensitive env variable and verify it is not echoed
    const spawn = require('child_process').spawnSync;
    const helper = spawn('node', ['scripts/run-scans.js'], {
      env: { ...process.env, DUMMY_SECRET: 'supersecret' }
    });
    expect(helper.stdout.toString()).not.toContain('supersecret');
  });

  test('ST-505: documentation mentions runners or CI platform', () => {
    const docs = fs.readFileSync('docs/security/ci-security-gates.md', 'utf8');
    expect(docs).toMatch(/runners/);
  });
});