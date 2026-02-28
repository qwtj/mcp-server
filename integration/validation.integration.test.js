// integration/validation.integration.test.js
// Integration tests for validatePayload middleware in a real Express app

const express = require('express');
const request = require('supertest');
const { validatePayload, exampleSchema } = require('../validators/validatePayload');

describe('Integration: validatePayload middleware', () => {
  let app;
  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.post('/api/user', validatePayload(exampleSchema), (req, res) => {
      res.status(201).json({ user: req.body });
    });
  });

  it('should create user with valid payload', async () => {
    const res = await request(app)
      .post('/api/user')
      .send({ name: 'Charlie', email: 'charlie@example.com' });
    expect(res.statusCode).toBe(201);
    expect(res.body.user).toEqual({ name: 'Charlie', email: 'charlie@example.com' });
  });

  it('should reject user with missing name', async () => {
    const res = await request(app)
      .post('/api/user')
      .send({ email: 'dana@example.com' });
    expect(res.statusCode).toBe(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'name' })
      ])
    );
  });

  it('should reject user with invalid email', async () => {
    const res = await request(app)
      .post('/api/user')
      .send({ name: 'Dana', email: 'not-an-email' });
    expect(res.statusCode).toBe(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'email' })
      ])
    );
  });
});
