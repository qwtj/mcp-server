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
    const listDirTool = res.body.result.capabilities.tools.find(t => t.id === 'mcp.listDir' || t.name === 'mcp_listdir');
    expect(listDirTool).toBeDefined();
    expect(listDirTool).toHaveProperty('name', 'mcp_listdir');
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
    const listDirTool = res.body.result.tools.find(t => t.id === 'mcp.listDir' || t.name === 'mcp_listdir');
    expect(listDirTool).toBeDefined();
    expect(listDirTool).toHaveProperty('name', 'mcp_listdir');
    expect(listDirTool).toHaveProperty('inputSchema.type', 'object');
  });

  test('executes a tool when client uses tools/call (MCP spec)', async () => {
    const payload = {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'mcp.listDir', arguments: { path: '.' } }
    };
    const res = await request(app).post('/').send(payload);
    expect(res.status).toBe(200);
    // result should contain entries array from listDir
    expect(res.body).toHaveProperty('result.entries');
    expect(Array.isArray(res.body.result.entries)).toBe(true);
    expect(res.body).toHaveProperty('result.content');
    expect(Array.isArray(res.body.result.content)).toBe(true);
    expect(res.body.result.content[0]).toHaveProperty('type', 'text');
  });

  test('tools/call should not be mistaken for a tools list request', async () => {
    const payload = {
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: { name: 'foo', arguments: {} }
    };
    const res = await request(app).post('/').send(payload);
    // since generic tool foo does not exist, expect error rather than list
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('error');
  });

  test('tool/run alias still executes a tool', async () => {
    const payload = {
      jsonrpc: '2.0',
      id: 6,
      method: 'tool/run',
      params: { name: 'mcp.listDir', path: '.' }
    };
    const res = await request(app).post('/').send(payload);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('result.entries');
    expect(Array.isArray(res.body.result.entries)).toBe(true);
  });

  test('direct method name equal to tool id executes correctly', async () => {
    const payload = {
      jsonrpc: '2.0',
      id: 7,
      method: 'mcp.listDir',
      params: { path: '.' }
    };
    const res = await request(app).post('/').send(payload);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('result.entries');
    expect(Array.isArray(res.body.result.entries)).toBe(true);
  });

  test('simple JSON body with path returns content array', async () => {
    const res = await request(app).post('/').send({ path: '.' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('content');
    expect(Array.isArray(res.body.content)).toBe(true);
  });

  test('absolute path listing via simple JSON succeeds and returns content', async () => {
    const res = await request(app).post('/').send({ path: '/' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('content');
    expect(Array.isArray(res.body.content)).toBe(true);
  });

  test('tilde path listing via simple JSON expands to home directory', async () => {
    const res = await request(app).post('/').send({ path: '~' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('content');
    expect(Array.isArray(res.body.content)).toBe(true);
  });
});
