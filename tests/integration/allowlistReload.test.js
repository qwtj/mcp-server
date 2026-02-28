const fs = require('fs');
const path = require('path');
const config = require('../../lib/config');

// test will modify allowlist file and expect reload behavior

describe('integration: allowlist reload', () => {
  test('IT-403: modify allowlist file at runtime', async () => {
    const file = path.join(__dirname, '..', '..', 'config', 'allowlist.json');
    // start with empty list
    fs.writeFileSync(file, JSON.stringify([]));
    config.reloadAllowlist();
    expect(config.getAllowlist()).toEqual([]);
    // write a new entry and manually reload (simulating watcher)
    fs.writeFileSync(file, JSON.stringify(['echo']));
    const ok2 = config.reloadAllowlist();
    expect(ok2).toBe(true);
    expect(config.getAllowlist()).toEqual(['echo']);
  });

  afterAll(() => {
    const file = path.join(__dirname, '..', '..', 'config', 'allowlist.json');
    fs.unwatchFile(file);
  });
});
