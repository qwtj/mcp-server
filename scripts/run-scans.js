#!/usr/bin/env node
const { spawnSync } = require('child_process');
const fs = require('fs');

let config = {};
try {
  config = JSON.parse(fs.readFileSync('security-config.json', 'utf8'));
} catch (err) {
  console.error('failed to load security-config.json', err.message);
}

const auditLevel = process.env.SECURITY_FAIL_LEVEL || config.auditLevel || 'high';
console.log(`using audit level ${auditLevel}`);

const args = process.argv.slice(2);
const skipSast = args.includes('--skip-sast') || args.includes('--audit-only');

function run(command, args, opts = {}) {
  const r = spawnSync(command, args, { stdio: 'inherit', ...opts });
  if (r.error) throw r.error;
  return r.status;
}

let exitCode = 0;

// run dependency audit
try {
  const code = run('npm', ['audit', `--audit-level=${auditLevel}`]);
  if (code !== 0) exitCode = code;
} catch (e) {
  console.error('npm audit failed', e.message);
  exitCode = 1;
}

// run semgrep unless skipped
if (!skipSast) {
  try {
    const code = run('node', [__dirname + '/semgrep.js']);
    if (code !== 0) exitCode = code;
  } catch (e) {
    console.error('semgrep failed', e.message);
    exitCode = 1;
  }
} else {
  console.log('skipping SAST per flag');
}

process.exit(exitCode);
