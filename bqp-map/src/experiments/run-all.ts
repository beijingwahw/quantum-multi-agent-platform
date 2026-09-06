/** Full repro: rebuild every report from scratch, seeds fixed. */
import { execFileSync } from "node:child_process";

const experiments = [
  "exp1-reductions.ts",
  "exp2-upper.ts",
  "exp3-lower.ts",
  "exp4-witness.ts",
  "exp5-atlas.ts",
  "exp6-genealogy.ts",
];

const t0 = Date.now();
for (const exp of experiments) {
  const t = Date.now();
  execFileSync(process.execPath, ["--import", "tsx", `src/experiments/${exp}`], { stdio: "inherit" });
  console.log(`  (${exp}: ${((Date.now() - t) / 1000).toFixed(1)}s)`);
}
console.log(`\nrepro complete in ${((Date.now() - t0) / 1000).toFixed(1)}s — reports in out/reports/`);
