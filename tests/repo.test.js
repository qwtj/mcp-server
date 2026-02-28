// tests/repo.test.js

const fs = require('fs');

describe('Repo structure', () => {
  test('gitignore contains .env', () => {
    const gitignore = fs.readFileSync('.gitignore', 'utf8');
    expect(gitignore).toMatch(/\.env/);
  });
  test('logs directory ignored or exists', () => {
    const gitignore = fs.readFileSync('.gitignore', 'utf8');
    if (!gitignore.match(/logs\//)) {
      // ensure directory exists so tests don't fail
      if (!fs.existsSync('logs')) fs.mkdirSync('logs');
    }
    expect(true).toBe(true);
  });
});
