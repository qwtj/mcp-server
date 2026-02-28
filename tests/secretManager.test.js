const secretManager = require('../lib/secretManager');

describe('Secret manager', () => {
  afterEach(() => {
    secretManager._reset();
    delete process.env.TEST_KEY;
  });

  test('UT-101: returns value from env backend', () => {
    process.env.TEST_KEY = 'value';
    const val = secretManager.getSecret('TEST_KEY');
    expect(val).toBe('value');
  });

  test('UT-102: throws when key missing', () => {
    expect(() => secretManager.getSecret('MISSING')).toThrow(/not found/);
  });

  test('allows backend injection', () => {
    const custom = { get: (k) => (k === 'foo' ? 'bar' : undefined) };
    secretManager.setBackend(custom);
    expect(secretManager.getSecret('foo')).toBe('bar');
    expect(() => secretManager.getSecret('x')).toThrow();
  });
});
