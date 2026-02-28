#!/usr/bin/env node
// simple semgrep-like scanner for the purposes of CI/tests
const fs = require('fs');
const yaml = require('js-yaml');
const glob = require('glob');

let config;
try {
  config = yaml.load(fs.readFileSync('.semgrep.yml', 'utf8'));
} catch (e) {
  console.error('failed to load .semgrep.yml', e.message);
  process.exit(1);
}
const rules = config.rules || [];
let found = false;

// files to scan may be passed as args; default to globbing all JS
let files = process.argv.slice(2);
if (files.length === 0) {
  files = glob.sync('**/*.js', { ignore: 'node_modules/**' });
}

rules.forEach(rule => {
  const pat = rule.pattern;
  if (!pat) return;
  // convert semgrep-like $VARIABLE placeholders to wildcard
  let wildcardMarker = '___WILDCARD___';
  let tmp = pat.replace(/\$[A-Za-z0-9_]+/g, wildcardMarker);
  // escape regex metacharacters in the remainder
  tmp = tmp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // restore wildcards as .* patterns
  tmp = tmp.replace(new RegExp(wildcardMarker, 'g'), '.*');
  const regex = new RegExp(tmp, 'g');
  files.forEach(file => {
    if (!fs.existsSync(file)) return;
    const content = fs.readFileSync(file, 'utf8');
    if (regex.test(content)) {
      console.error(`rule ${rule.id || '(unknown)'} matched in ${file}`);
      found = true;
    }
  });
});
process.exit(found ? 1 : 0);
