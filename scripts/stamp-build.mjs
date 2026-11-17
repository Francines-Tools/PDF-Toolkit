// Writes build.json with a yyyymmddhhmm UTC stamp. Run by the Build stamp
// workflow on every push to main.
import { writeFileSync } from 'node:fs';

const now = new Date();
const p = n => String(n).padStart(2, '0');
const build = '' + now.getUTCFullYear() + p(now.getUTCMonth() + 1) + p(now.getUTCDate()) +
  p(now.getUTCHours()) + p(now.getUTCMinutes());

writeFileSync('build.json', JSON.stringify({ build, iso: now.toISOString() }, null, 2) + '\n');
console.log('build stamp:', build);
