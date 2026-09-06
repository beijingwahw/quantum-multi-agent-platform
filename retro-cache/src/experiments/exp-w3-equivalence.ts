/**
 * W3 — the pre-arrival equivalence: before the channel, the quantum cache
 * IS a shared random seed; the entire surplus lives in the joint column.
 */
import { chshStandard, jointTable, tvDistance, wernerPair } from "../kernel/state.js";
import { classicalCensus } from "../kernel/tariff.js";
import { writeReport, fmt } from "./report.js";
import { pathToFileURL } from "node:url";

function main(): void {
  const lines: string[] = [];
  lines.push("# W3 — pre-arrival equivalence: correlator, not oracle\n");

  lines.push("## A. before the channel: distributionally indistinguishable from a shared seed\n");
  lines.push(
    "The cache's pre-arrival deliverable is B's local answer distribution together with its (in)dependence of A's side. A classical shared-seed cache (pre-shared random bit s) delivers exactly the same object: B's data uniform, independent of everything on A's side.\n",
  );
  const rho = wernerPair(1);
  const axesAB: number[][] = [
    [0, 0, 1],
    [1, 0, 0],
    [0.6, 0.64, 0.48],
    [Math.SQRT1_2, Math.SQRT1_2, 0],
  ];
  let worstTv = 0;
  for (const a of axesAB) {
    for (const b of axesAB) {
      const t = jointTable(rho, a, b);
      const py: number[] = [(t[0][0]) + (t[1][0]), (t[0][1]) + (t[1][1])];
      worstTv = Math.max(worstTv, tvDistance(py, [0.5, 0.5]));
    }
  }
  lines.push(`- TV distance, quantum B-answer vs uniform seed bit, all axis pairs: ${fmt(worstTv, 15)}`);
  lines.push("- TV distance, classical seed B-answer vs uniform: 0 (identical by construction)");
  lines.push("\nBy any LOCAL statistic, before the classical channel, the two caches are the same object.\n");

  lines.push("## B. the surplus column: all 256 classical strategies vs the singlet\n");
  const census = classicalCensus();
  const s = chshStandard(rho);
  lines.push(`- deterministic shared-randomness strategies enumerated: ${census.strategies} (16 x 16)`);
  lines.push(`- maximum |CHSH| over the whole census: ${fmt(census.maxAbsS, 15)} — the classical cap, CHSH69`);
  lines.push(`- the singlet at the standard axes: ${fmt(s, 12)} vs Tsirelson's 2*sqrt(2) = ${fmt(2 * Math.SQRT2, 12)}`);
  lines.push(
    `\nThe visitor's cache is worth exactly its surplus over a shared seed, and the surplus (2*sqrt(2) vs 2) lives in the JOINT, setting-dependent column — the very column the classical channel must carry before anyone can spend it.\n`,
  );

  const path = writeReport("w3-equivalence.md", lines.join("\n"));
  console.log(`exp W3 done -> ${path}`);
}

// batch-33 retrofit: entry-guard law (house form since batch 21) — imports never render
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
