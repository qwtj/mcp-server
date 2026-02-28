// tests/server.test.js

const request = require('supertest');
const app = require('../server');

describe('Express server', () => {
  test('server.exports app', () => {
    expect(app).toBeDefined();
  });
  test('basic route returns 200', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('MCP server running');
  });
});
