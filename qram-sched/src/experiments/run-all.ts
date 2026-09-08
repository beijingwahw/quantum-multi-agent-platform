/**
 * Full reproduction: all six experiments, fresh outputs, in order.
 *
 * v0.2.0 fix (documented): this runner used to `await import(...)` the
 * experiment modules and rely on their entry guards — but the house
 * entry-guard law ("imports never render": main runs only when the module IS
 * the process entry) made every import a silent no-op, while the report
 * directory had already been wiped: `npm run repro` deleted out/reports and
 * rewrote nothing, exiting 0. The fix follows the workspace conviction
 * precedent: run-all now imports each experiment's EXPORTED main() and calls
 * it directly. Entry guards remain in place so `npm run exp:<name>` still
 * works when a module is the process entry.
 */
import { reportDir } from "./report.js";
import { main as exp1 } from "./exp1-qram.js";
import { main as exp2 } from "./exp2-walk.js";
import { main as exp3 } from "./exp3-ae.js";
import { main as exp4 } from "./exp4-regret.js";
import { main as exp5 } from "./exp5-matching.js";
import { main as exp6 } from "./exp6-kvv.js";
import { reject } from "../core/errors.js";
import { rmSync, mkdirSync } from "node:fs";

const t0 = Date.now();
rmSync(reportDir, { recursive: true, force: true });
mkdirSync(reportDir, { recursive: true });

const experiments: ReadonlyArray<[string, () => void]> = [
  ["exp1-qram", exp1],
  ["exp2-walk", exp2],
  ["exp3-ae", exp3],
  ["exp4-regret", exp4],
  ["exp5-matching", exp5],
  ["exp6-kvv", exp6],
];

let rendered = 0;
for (const [name, main] of experiments) {
  main();
  rendered++;
  console.log(`rendered: ${name}`);
}

if (rendered !== experiments.length) reject("REPRO_INCOMPLETE", `rendered ${rendered}/${experiments.length} experiments`);
console.log(`\nAll ${rendered} experiments complete in ${((Date.now() - t0) / 1000).toFixed(1)}s. Reports in out/reports/.`);
