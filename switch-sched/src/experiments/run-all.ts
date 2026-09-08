/**
 * Full reproduction: all five experiments, fresh reports, in order.
 *
 * v0.2.0 wiring fix (documented): this runner used to `await import(...)`
 * the experiment modules and rely on their entry guards — but the house
 * entry-guard law ("imports never render": main runs only when the module
 * IS the process entry) made every import a silent no-op, so `npm run
 * repro` exited 0 without re-rendering a single report (the same
 * exit-0-fake-green defect the sibling repos were convicted of in the same
 * wave). The fix follows the workspace conviction precedent: run-all
 * calls the mains directly (each experiment's EXPORTED main(), invoked
 * explicitly below) and refuses to exit 0 unless all five rendered. Entry
 * guards remain in place so `npm run exp:<name>` still works when a module
 * is the process entry.
 */
import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { main as exp1 } from './exp1-switch-algebra.js';
import { main as exp2 } from './exp2-capacity.js';
import { main as exp3 } from './exp3-sched-contact.js';
import { main as exp4 } from './exp4-mechanism.js';
import { main as exp5 } from './exp5-process-witness.js';

const reportsDir = resolve(process.cwd(), 'reports');

const t0 = Date.now();
rmSync(reportsDir, { recursive: true, force: true });
mkdirSync(reportsDir, { recursive: true });

const experiments: ReadonlyArray<[string, () => void]> = [
  ['exp1-switch-algebra', exp1],
  ['exp2-capacity', exp2],
  ['exp3-sched-contact', exp3],
  ['exp4-mechanism', exp4],
  ['exp5-process-witness', exp5],
];

let rendered = 0;
for (const [name, main] of experiments) {
  main();
  rendered++;
  console.log(`rendered: ${name}`);
}

if (rendered !== experiments.length) throw new Error(`rendered ${rendered}/${experiments.length} experiments`);
console.log(`\nAll ${rendered} experiments complete in ${((Date.now() - t0) / 1000).toFixed(1)}s. Reports in reports/.`);
