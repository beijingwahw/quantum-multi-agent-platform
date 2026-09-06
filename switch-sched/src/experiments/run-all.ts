/** Reproduce every experiment: `npm run repro` rebuilds all reports/*.md. */

async function main(): Promise<void> {
  const t0 = Date.now();
  await import('./exp1-switch-algebra.js');
  await import('./exp2-capacity.js');
  await import('./exp3-sched-contact.js');
  await import('./exp4-mechanism.js');
  console.log(`\nrepro complete in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

void main();
