// tests/server.test.js

const request = require('supertest');
const app = require('../server');

describe('Express server', () => {
  test('server.exports app', () => {
    expect(app).toBeDefined();
  });

  test('health endpoint on /health returns 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.text).toContain('MCP server running');
  });

  test('root GET returns tool list JSON', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('tools');
    expect(Array.isArray(res.body.tools)).toBe(true);
    expect(res.body.tools.length).toBeGreaterThan(0);
  });

  test('root OPTIONS also returns 404', async () => {
    const res = await request(app).options('/');
    expect(res.status).toBe(404);
  });

  test('accepts simple JSON-RPC initialize on /mcp', async () => {
    const payload = { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} };
    const res = await request(app).post('/mcp').send(payload);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('result.capabilities.tools');
    expect(Array.isArray(res.body.result.capabilities.tools)).toBe(true);
    expect(res.body.result.capabilities.tools.length).toBeGreaterThan(0);
  });

  test('also handles initialize posted to root /', async () => {
    const payload = { jsonrpc: '2.0', id: 2, method: 'initialize', params: {} };
    const res = await request(app).post('/').send(payload);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('result.capabilities.tools');
    expect(Array.isArray(res.body.result.capabilities.tools)).toBe(true);
    expect(res.body.result.capabilities.tools.length).toBeGreaterThan(0);
  });

  test('accepts notifications/initialized without error', async () => {
    const notif = { jsonrpc: '2.0', method: 'notifications/initialized' };
    const res = await request(app).post('/').send(notif);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({});
  });

  test('any notification returns 200 empty object', async () => {
    const notif = { jsonrpc: '2.0', method: 'some/unimportant', params: { foo: 'bar' } };
    const res = await request(app).post('/').send(notif);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({});
  });

  test('returns tool list when client asks model/getTools', async () => {
    const payload = { jsonrpc: '2.0', id: 3, method: 'model/getTools', params: {} };
    const res = await request(app).post('/').send(payload);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('result.tools');
    expect(Array.isArray(res.body.result.tools)).toBe(true);
    expect(res.body.result.tools.length).toBeGreaterThan(0);
  });
});
