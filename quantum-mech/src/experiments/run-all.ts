/** Reproduce every experiment: `npm run repro` rebuilds all out/*.md|json. */

async function main(): Promise<void> {
  const t0 = Date.now();
  await import('./exp1-dsic.js');
  await import('./exp2-privacy.js');
  await import('./exp3-escrow.js');
  await import('./exp4-nogo.js');
  await import('./exp5-vcg.js');
  console.log(`\nrepro complete in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

void main();
