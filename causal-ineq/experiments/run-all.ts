/** Full repro: rebuild every report from scratch. */
import { execFileSync } from "node:child_process";

const experiments = ["exp1-validity.ts", "exp2-classical.ts", "exp3-quantum.ts"];

const t0 = Date.now();
for (const exp of experiments) {
  const t = Date.now();
  execFileSync(process.execPath, ["--import", "tsx", `experiments/${exp}`], { stdio: "inherit" });
  console.log(`  (${exp}: ${((Date.now() - t) / 1000).toFixed(1)}s)`);
}
console.log(`\nrepro complete in ${((Date.now() - t0) / 1000).toFixed(1)}s — reports in out/reports/`);
