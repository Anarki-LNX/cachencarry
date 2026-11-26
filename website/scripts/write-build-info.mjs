#!/usr/bin/env node
// Writes dist/build.json after a build: which commit and when. It is the health check of
// the live site (https://cachencarry.loopout.tech/build.json) and what deploy/deploy.sh
// compares after switching to a new build. Contains nothing secret: no token, no paths.

import { execFileSync } from 'node:child_process';
import { stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const site = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(site, 'dist');

try {
  await stat(join(dist, 'index.html'));
} catch {
  console.error('write-build-info: no dist/index.html (run the build first)');
  process.exit(2);
}

let commit = 'unknown';
try {
  commit = execFileSync('git', ['-C', site, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim();
} catch {
  // not a git checkout: keep "unknown"
}

const info = {
  site: 'cachencarry-website',
  commit,
  builtAt: new Date().toISOString(),
};
await writeFile(join(dist, 'build.json'), `${JSON.stringify(info, null, 2)}\n`);
console.log(`build.json: ${commit.slice(0, 7)} ${info.builtAt}`);
