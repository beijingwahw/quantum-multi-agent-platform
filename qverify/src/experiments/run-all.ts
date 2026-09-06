/** Reproduce every experiment: `npm run repro` rebuilds all out/*.md|json. */

async function main(): Promise<void> {
  const t0 = Date.now();
  await import('./exp1-blindness.js');
  await import('./exp2-traps.js');
  await import('./exp3-rigidity.js');
  await import('./exp4-sampling.js');
  await import('./exp5-attacks.js');
  console.log(`\nrepro complete in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

void main();
