/** Full reproduction: all five experiments, fresh outputs, in order. */
import { reportDir } from "./report.js";
import { rmSync, mkdirSync } from "node:fs";
const t0 = Date.now();
rmSync(reportDir, { recursive: true, force: true });
mkdirSync(reportDir, { recursive: true });
await import("./exp1-qram.js");
await import("./exp2-walk.js");
await import("./exp3-ae.js");
await import("./exp4-regret.js");
await import("./exp5-matching.js");
console.log(`\nAll experiments complete in ${((Date.now() - t0) / 1000).toFixed(1)}s. Reports in out/reports/.`);
