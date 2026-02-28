const fs = require('fs');
const path = require('path');
const request = require('supertest');
process.env.ENABLE_TOOL_SANDBOX = 'true';
const app = require('../../server');

describe('integration: tool endpoint', () => {
  test('IT-401: allowed tool via HTTP route', async () => {
    // prepare allowlist
    const file = require('path').join(__dirname, '..', '..', 'config', 'allowlist.json');
    require('fs').writeFileSync(file, JSON.stringify(['echo']));
    const config = require('../../lib/config');
    config.reloadAllowlist();

    const response = await request(app)
      .post('/run-tool')
      .send({ toolName: 'echo', args: ['hello'] });
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('result', 'executed');
  });

  test('IT-402: denied tool via HTTP route', async () => {
    const file = require('path').join(__dirname, '..', '..', 'config', 'allowlist.json');
    require('fs').writeFileSync(file, JSON.stringify([]));
    const config = require('../../lib/config');
    config.reloadAllowlist();

    const response = await request(app)
      .post('/run-tool')
      .send({ toolName: 'ls' });
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
  });

  afterAll(() => {
    const file = require('path').join(__dirname, '..', '..', 'config', 'allowlist.json');
    require('fs').unwatchFile(file);
  });
});
