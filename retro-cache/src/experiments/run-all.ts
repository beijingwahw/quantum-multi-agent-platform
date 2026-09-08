/** Full repro: rebuild every report from scratch. Each experiment runs as its
 *  own subprocess so the entry-guard law holds (imports never render; the
 *  guard fires only when the file IS the entrypoint). The previous form of
 *  this runner only imported the exp modules — main() never ran and the
 *  reports silently went stale; that no-op is what this form fixes. */
import { execFileSync } from "node:child_process";

const experiments = [
  "exp-w1-correlations.ts",
  "exp-w2-marginal.ts",
  "exp-w3-equivalence.ts",
  "exp-w4-withdrawal.ts",
  "exp-w5-amplification.ts",
  "exp-w6-adversary.ts",
];

const t0 = Date.now();
for (const exp of experiments) {
  const t = Date.now();
  execFileSync(process.execPath, ["--import", "tsx", `src/experiments/${exp}`], { stdio: "inherit" });
  console.log(`  (${exp}: ${((Date.now() - t) / 1000).toFixed(1)}s)`);
}
console.log(`\nrepro complete in ${((Date.now() - t0) / 1000).toFixed(1)}s — reports in out/reports/`);
