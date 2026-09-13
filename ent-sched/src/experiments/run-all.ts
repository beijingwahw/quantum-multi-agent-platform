import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

// batch-33 retrofit (R13 hardening): the spawn chain used to run at module
// top level — importing this module (a test, a future aggregator) re-rendered
// every experiment for ~8 minutes. The house entry-guard law ("imports never
// render", the form the sibling repos' run-alls already carry) moves it behind
// main(); `npm run repro` (this file as the process entry) is unchanged.
function main(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const exps = [
    "exp1-physics.ts",
    "exp2-chain.ts",
    "exp3-network.ts",
    "exp4-purify.ts",
    "exp5-scaling.ts",
    "exp6-robustness.ts",
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
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
