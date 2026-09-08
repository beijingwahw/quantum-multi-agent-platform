/** Reproduce every experiment: `npm run repro` rebuilds all out/*.md|json. */

import { main as runBlindness } from './exp1-blindness.js';
import { main as runTraps } from './exp2-traps.js';
import { main as runRigidity } from './exp3-rigidity.js';
import { main as runSampling } from './exp4-sampling.js';
import { main as runAttacks } from './exp5-attacks.js';

// The batch-33 entry-guard law makes imports silent, so run-all must invoke
// the exported mains directly — anything else renders nothing (the silent
// repro no-op five sibling repos were convicted of in this wave).
function main(): void {
  const t0 = Date.now();
  runBlindness();
  runTraps();
  runRigidity();
  runSampling();
  runAttacks();
  console.log(`\nrepro complete in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main();
