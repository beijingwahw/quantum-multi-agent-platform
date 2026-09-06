import { main as exp1 } from "./exp1-sign.js";
import { main as exp2 } from "./exp2-anneal.js";
import { main as exp3 } from "./exp3-sse-sign.js";
import { main as exp4 } from "./exp4-catalyst.js";
import { main as exp5 } from "./exp5-scale.js";
import { writeReport } from "./common.js";
import { pathToFileURL } from "node:url";

export function main(): void {
  console.log("=== nonstoq-anneal repro: experiment 1/4 (sign barrier) ===\n");
  exp1();
  console.log("\n=== nonstoq-anneal repro: experiment 2/4 (anneal) ===\n");
  exp2();
  console.log("\n=== nonstoq-anneal repro: experiment 3/5 (SSE average sign) ===\n");
  exp3();
  console.log("\n=== nonstoq-anneal repro: experiment 4/5 (catalyst) ===\n");
  exp4();
  console.log("\n=== nonstoq-anneal repro: experiment 5/5 (tensor scale) ===\n");
  exp5();
  writeReport(
    "SUMMARY",
    {
      generated: new Date().toISOString(),
      note: "full results in exp1-sign.json, exp2-anneal.json, exp3-sse-sign.json, exp4-catalyst.json",
    },
    [
      "# nonstoq-anneal reproducible report set",
      "",
      "All numbers regenerate from `npm run repro` (fixed seeds, deterministic RNG).",
      "",
      "- exp1-sign.md — ground-state sign-structure barrier (kappa x n scan, Perron-Frobenius baseline)",
      "- exp2-anneal.md — real-time anneal, stoquastic vs non-stoquastic drivers",
      "- exp3-sse-sign.md — direct QMC average-sign measurement (SSE) with exact-enumeration referee",
      "- exp4-catalyst.md — AF XX catalyst testbed on the p-spin first-order family (honest two-sided result)",
      "- exp5-tensor-scale.md — DMRG scaling to n=64 with sampled sign metric",
      "",
    ].join("\n"),
  );
}

// batch-33 retrofit: entry-guard law (house form since batch 21) — imports never render
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
