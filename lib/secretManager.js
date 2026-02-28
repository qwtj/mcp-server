const defaultBackend = {
  get: (key) => {
    return process.env[key];
  }
};

let backend = defaultBackend;

function setBackend(newBackend) {
  if (!newBackend || typeof newBackend.get !== 'function') {
    throw new Error('Backend must implement get(key)');
  }
  backend = newBackend;
}

function getSecret(key) {
  const value = backend.get(key);
  if (value === undefined) {
    throw new Error(`Secret ${key} not found`);
  }
  return value;
}

module.exports = {
  getSecret,
  setBackend,
  // for testing
  _reset: () => { backend = defaultBackend; }
};
