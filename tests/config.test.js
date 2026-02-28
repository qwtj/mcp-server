const config = require('../lib/config');

describe('Config loader', () => {
  const orig = process.env.SECRET_BACKEND;
  afterEach(() => {
    if (orig === undefined) delete process.env.SECRET_BACKEND;
    else process.env.SECRET_BACKEND = orig;
  });

  test('UT-106: picks correct backend name default and override', () => {
    delete process.env.SECRET_BACKEND;
    expect(config.getSecretBackendName()).toBe('env');
    process.env.SECRET_BACKEND = 'other';
    expect(config.getSecretBackendName()).toBe('other');
  });
});
