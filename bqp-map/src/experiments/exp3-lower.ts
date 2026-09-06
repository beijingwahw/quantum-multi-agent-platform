/**
 * EXP3 — The walls, executed (the "never accelerable" tier, with its precise
 * model-relative meanings).
 *
 * A: ALL deterministic q-query decision trees enumerated (full binary model):
 *    max uniform success = q/N exactly; worst-case success 1 only at q >= N
 * B: random deep trees spot-checked at N=64 — nothing escapes the cap
 * C: BBBV hybrid argument on exact evolutions: ||psi_q^x - psi_q^0|| <= 2q/sqrt(N)
 *    for all x; corollary success <= (2q+1)^2/N; q=1 exact anchor 2/sqrt(N)
 * D: the wall ON a scheduling instance: black-box access to the schedule
 *    quality of a P2||Cmax instance is capped at quadratic — while the DP
 *    (which READS the instance) walks around the wall entirely. Walls are
 *    model-relative; the atlas says so with numbers.
 */
import { groverRun } from "../upper/grover.js";
import { bbbvCheck, bbbvExactAnchor } from "../lower/bbbv.js";
import { exhaustiveDecisionTrees, randomTreeSpotCheck } from "../lower/classical.js";
import { table, writeReport } from "./report.js";
import { pathToFileURL } from "node:url";

function run(): void {
  const parts: string[] = [];

  // A: full decision-tree sweeps
  {
    const rows: Array<readonly string[]> = [];
    const sweeps: Array<[number, number]> = [
      [2, 2],
      [3, 3],
      [4, 2],
      [4, 3],
      [6, 3],
      [8, 2],
      [8, 3],
      [16, 2],
    ];
    for (const [N, q] of sweeps) {
      const s = exhaustiveDecisionTrees(N, q);
      if (!s.allWithinCap) throw new Error(`cap violated at N=${N}, q=${q}`);
      if (Math.abs(s.maxUniform - Math.min(q, N) / N) > 1e-12) throw new Error(`max != q/N at N=${N}, q=${q}`);
      rows.push([String(N), String(q), String(s.trees), s.maxUniform.toFixed(6), (q / N).toFixed(6), s.worstCaseSuccess.toFixed(3)]);
    }
    parts.push(
      `## A: exhaustive decision-tree enumeration (classical wall)\n\n${table(
        ["N", "q", "trees enumerated (ALL)", "max uniform success", "q/N", "max worst-case success"],
        rows,
      )}\n\nAdaptive querying, re-querying, post-success continuation — every legal tree shape is inside the count. The cap q/N is exact, and worst-case certainty needs q >= N (the (3,3) row reaches it).\n`,
    );
  }

  // B: spot checks
  {
    const rows: Array<readonly string[]> = [];
    for (const q of [2, 4, 6, 8]) {
      const spot = randomTreeSpotCheck(64, q, 20000, 2026090500 + q);
      rows.push([String(q), (q / 64).toFixed(6), spot.maxUniform.toFixed(6), spot.maxUniform <= spot.cap + 1e-12 ? "OK" : "FAIL"]);
      if (spot.maxUniform > spot.cap + 1e-12) throw new Error("spot check violated cap");
    }
    parts.push(`## B: random-tree spot checks at N=64 (20000 trees per q)\n\n${table(["q", "cap q/N", "observed max", "verdict"], rows)}\n\nYao's ingredient: every deterministic tree is capped, so every randomized mixture is too.\n`);
  }

  // C: BBBV
  {
    const rows: Array<readonly string[]> = [];
    for (const [N, qs] of [
      [256, [1, 2, 4, 6, 8, 12, 16]],
      [1024, [1, 4, 8, 16, 24, 30]],
      [4096, [1, 12]],
    ] as const) {
      for (const q of qs) {
        const c = bbbvCheck(N, q);
        if (!c.lemmaHolds || !c.corollaryHolds) throw new Error(`BBBV failed at N=${N} q=${q}`);
        rows.push([String(N), String(q), c.maxDist.toFixed(6), c.hybridBound.toFixed(6), c.tightness.toFixed(4), c.maxSuccess.toExponential(3), c.corollaryBound.toExponential(3)]);
      }
    }
    const anchor256 = bbbvExactAnchor(256);
    const anchor1024 = bbbvExactAnchor(1024);
    if (!anchor256 || !anchor1024) throw new Error("q=1 anchor not exact");
    parts.push(
      `## C: BBBV hybrid argument on exact evolutions\n\n${table(
        ["N", "q", "max dist", "bound 2q/sqrt(N)", "tightness", "max success", "cap (2q+1)^2/N"],
        rows,
      )}\n\nThe q=1 anchor is EXACT: max distance = 2/sqrt(N) to machine precision at N=256 and N=1024. Lemma and corollary hold for every x and every q probed.\n`,
    );
  }

  // D: wall on a scheduling instance
  {
    const N = 1024;
    const r = groverRun(N, [555]); // the optimal-assignment oracle, abstracted
    const q6 = bbbvCheck(N, 6);
    const q12 = bbbvCheck(N, 12);
    parts.push(
      `## D: the wall on a scheduling instance (N = 2^10 assignment space)\n\nA black-box algorithm probing the schedule-quality oracle:\n\n- after 6 queries: certified success cap ${(q6.corollaryBound).toFixed(4)} (actual Grover success at 6 queries: ${q6.maxSuccess.toFixed(4)})\n- after 12 queries: cap ${(q12.corollaryBound).toFixed(4)} (actual: ${q12.maxSuccess.toFixed(4)})\n- Grover at k* = ${r.k} queries: success ${r.successExact.toFixed(6)}\n- classical exhaustive: ${N} evaluations; classical at ${r.k} queries: ${r.classicalSameQueries.toFixed(6)}\n\nSame instance, non-black-box route: the pseudo-polynomial DP reads the processing times and returns the optimum in O(n * total) — the wall binds the oracle model, not the problem. This is the atlas's central honesty clause, with numbers.\n`,
    );
  }

  const body = `# EXP3 — Walls, executed\n\n${parts.join("\n")}`;
  const file = writeReport("exp3-lower.md", body);
  console.log(`exp3 done -> ${file}`);
}

// batch-33 retrofit: entry-guard law (house form since batch 21) — imports never render
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  run();
}
