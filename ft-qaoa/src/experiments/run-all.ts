import { main as exp1 } from "./exp1-monotonic.js";
import { main as exp2 } from "./exp2-resources.js";
import { main as exp3 } from "./exp3-decoder.js";
import { main as exp4 } from "./exp4-noise.js";
import { writeReport } from "./common.js";
import { pathToFileURL } from "node:url";

export function main(): void {
  console.log("=== ft-qaoa repro: experiment 1/4 (monotonicity) ===\n");
  exp1();
  console.log("\n=== ft-qaoa repro: experiment 2/4 (resource estimates + constants audit) ===\n");
  exp2();
  console.log("\n=== ft-qaoa repro: experiment 3/4 (decoder scheduling) ===\n");
  exp3();
  console.log("\n=== ft-qaoa repro: experiment 4/4 (bounded-noise face) ===\n");
  exp4();
  writeReport(
    "SUMMARY",
    { generated: new Date().toISOString(), note: "full results in exp1-monotonic.json, exp2-resources.json, exp3-decoder.json, exp4-noise.json" },
    [
      "# ft-qaoa reproducible report set",
      "",
      "All numbers regenerate from `npm run repro` (fixed seeds, deterministic RNG).",
      "",
      "- exp1-monotonic.md — p=128 ladders, embedding identity, monotonicity checks",
      "- exp2-resources.md — qLDPC/surface resource estimates for p up to 256 + assumption-constants audit",
      "- exp3-decoder.md — real-time decoder fleet scheduling analysis",
      "- exp4-noise.md — bounded-noise monotonicity face (exact density matrix, p <= 32)",
      "",
    ].join("\n"),
  );
}

// batch-33 retrofit: entry-guard law (house form since batch 21) — imports never render
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
