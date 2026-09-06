import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const exps = [
  "exp1-physics.ts",
  "exp2-chain.ts",
  "exp3-network.ts",
  "exp4-purify.ts",
  "exp5-scaling.ts",
];

const t0 = Date.now();
for (const exp of exps) {
  const start = Date.now();
  execFileSync(process.execPath, ["--import", "tsx", join(here, exp)], {
    stdio: "inherit",
  });
  console.error(`[repro] ${exp} done in ${((Date.now() - start) / 1000).toFixed(1)}s`);
}
console.error(`\n[repro] all ${exps.length} experiments rebuilt in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
