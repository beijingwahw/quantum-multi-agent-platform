import { pathToFileURL } from "node:url";
import { main as t1 } from "./exp-t1-sorter.js";
import { main as t2 } from "./exp-t2-restart.js";
import { main as t3 } from "./exp-t3-counting.js";
import { main as t4 } from "./exp-t4-contact.js";
import { main as t5 } from "./exp-t5-power-ledger.js";
import { main as t6 } from "./exp-t6-tieface.js";

// call the mains directly — the per-file entry-guard (house form since
// batch 21) suppresses rendering when an exp module is merely IMPORTED, so
// run-all must call the mains directly (v0.1.0 shipped this broken: `npm run repro`
// silently re-rendered nothing; caught and fixed in the v0.2.0 tie-face drop).
// R7: the calls themselves moved inside main() — a bare module-level render
// chain is an import side effect (anything importing run-all would render all
// six reports); run-all now carries the same runIfMain guard as its targets.
export function main(): void {
  t1();
  t2();
  t3();
  t4();
  t5();
  t6();
}

// batch-33 retrofit: entry-guard law (house form since batch 21) — imports never render
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
