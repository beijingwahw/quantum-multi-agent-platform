import { main as exp1 } from "./exp1-sign.js";
import { main as exp2 } from "./exp2-anneal.js";
import { main as exp3 } from "./exp3-sse-sign.js";
import { main as exp4 } from "./exp4-catalyst.js";
import { main as exp5 } from "./exp5-scale.js";
import { main as exp6 } from "./exp6-designability.js";
import { writeReport } from "./common.js";
import { pathToFileURL } from "node:url";

export function main(): void {
  console.log("=== nonstoq-anneal repro: experiment 1/6 (sign barrier) ===\n");
  exp1();
  console.log("\n=== nonstoq-anneal repro: experiment 2/6 (anneal) ===\n");
  exp2();
  console.log("\n=== nonstoq-anneal repro: experiment 3/6 (SSE average sign) ===\n");
  exp3();
  console.log("\n=== nonstoq-anneal repro: experiment 4/6 (catalyst) ===\n");
  exp4();
  console.log("\n=== nonstoq-anneal repro: experiment 5/6 (tensor scale) ===\n");
  exp5();
  console.log("\n=== nonstoq-anneal repro: experiment 6/6 (element-level de-signing) ===\n");
  exp6();
  writeReport(
    "SUMMARY",
    {
      generated: new Date().toISOString(),
      note: "full results in exp1-sign.json, exp2-anneal.json, exp3-sse-sign.json, exp4-catalyst.json, exp6-designability.json",
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
      "- exp6-designability.md — element-level de-signing decidability: two-qubit phase diagram",
      "  with certified YES/NO dichotomy, graph-family verdicts vs diagonal gauge, PF re-verified",
      "  through the decision layer",
      "",
    ].join("\n"),
  );
}

// batch-33 retrofit: entry-guard law (house form since batch 21) — imports never render
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
