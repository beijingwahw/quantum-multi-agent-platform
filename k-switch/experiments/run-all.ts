/** Full repro: rebuild every report from scratch. */
import { execFileSync } from "node:child_process";

const experiments = ["exp1-switch.ts", "exp2-sched.ts", "exp3-k4-parity.ts", "exp4-hadamard.ts", "exp5-sched4.ts"];

const t0 = Date.now();
for (const exp of experiments) {
  const t = Date.now();
  execFileSync(process.execPath, ["--import", "tsx", `experiments/${exp}`], { stdio: "inherit" });
  console.log(`  (${exp}: ${((Date.now() - t) / 1000).toFixed(1)}s)`);
}
console.log(`\nrepro complete in ${((Date.now() - t0) / 1000).toFixed(1)}s — reports in out/reports/`);
