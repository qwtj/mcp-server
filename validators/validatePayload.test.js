// validators/validatePayload.test.js
// Jest unit tests for validatePayload middleware

const { validatePayload, exampleSchema } = require('./validatePayload');
const express = require('express');
const request = require('supertest');

// Helper to create an app with the middleware
function createTestApp(schema = exampleSchema) {
  const app = express();
  app.use(express.json());
  app.post('/test', validatePayload(schema), (req, res) => {
    res.status(200).json({ success: true });
  });
  return app;
}

describe('validatePayload middleware', () => {
  it('accepts valid payload', async () => {
    const app = createTestApp();
    const res = await request(app)
      .post('/test')
      .send({ name: 'Alice', email: 'alice@example.com' });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('rejects missing name', async () => {
    const app = createTestApp();
    const res = await request(app)
      .post('/test')
      .send({ email: 'bob@example.com' });
    expect(res.statusCode).toBe(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'name' })
      ])
    );
  });

  it('rejects invalid email', async () => {
    const app = createTestApp();
    const res = await request(app)
      .post('/test')
      .send({ name: 'Bob', email: 'not-an-email' });
    expect(res.statusCode).toBe(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'email' })
      ])
    );
  });
});
