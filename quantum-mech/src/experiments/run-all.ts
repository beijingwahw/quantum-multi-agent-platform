/**
 * Reproduce every experiment: `npm run repro` rebuilds all out/*.md|json.
 *
 * batch-33 law: experiment entry guards make imports never render — a
 * run-all that IMPORTS the exp modules silently no-ops (the 0.1s "repro"
 * bug this file used to have). Each experiment therefore runs as its own
 * process, where `process.argv[1]` IS the experiment file and the entry
 * guard fires. Never pipe this command's output through anything that
 * hides its exit code.
 */

import { execFileSync } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const experiments = [
  'exp1-dsic.ts',
  'exp2-privacy.ts',
  'exp3-escrow.ts',
  'exp4-nogo.ts',
  'exp5-vcg.ts',
  'exp6-datalock.ts',
  'exp7-erasure.ts',
];

const here = dirname(fileURLToPath(import.meta.url));
const t0 = Date.now();
for (const exp of experiments) {
  const t = Date.now();
  execFileSync(process.execPath, ['--import', 'tsx', `${here}/${exp}`], { stdio: 'inherit' });
  console.log(`  (${exp}: ${((Date.now() - t) / 1000).toFixed(1)}s)`);
}
console.log(`\nrepro complete in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
