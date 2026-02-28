const fs = require('fs');
const path = require('path');
const config = require('../lib/config');

describe('allowlist configuration', () => {
  beforeAll(() => {
    // ensure allowlist file exists
    const file = path.join(__dirname, '..', 'config', 'allowlist.json');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify([]));
  });

  test('UT-403: reload allowlist updates in-memory', () => {
    const file = path.join(__dirname, '..', 'config', 'allowlist.json');
    const newList = ['echo', 'ls'];
    fs.writeFileSync(file, JSON.stringify(newList));
    const ok = config.reloadAllowlist();
    expect(ok).toBe(true);
    expect(config.getAllowlist()).toEqual(newList);
  });

  test('UT-404: handle invalid JSON when reloading allowlist', () => {
    const file = path.join(__dirname, '..', 'config', 'allowlist.json');
    const prev = config.getAllowlist();
    fs.writeFileSync(file, '{bad json');
    const ok = config.reloadAllowlist();
    expect(ok).toBe(false);
    // allowlist should remain unchanged
    expect(config.getAllowlist()).toEqual(prev);
  });

});
