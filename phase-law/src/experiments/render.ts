/**
 * Renders THE PHASE LAW — one page. Entry guard (house law since batch 21).
 */
import { pathToFileURL } from "node:url";
import { BOARD, type BoardRow } from "../kernel/board.js";
import { checkBoard, runWitnesses } from "../kernel/audit.js";
import { census, campaign, islandCampaign, thresholds } from "../kernel/census.js";
import { landscapeStats, makeInstance } from "../kernel/law.js";
import { writeReport } from "./report.js";

export function renderBoard(board: readonly BoardRow[] = BOARD): string {
  const violations = checkBoard(board);
  if (violations.length > 0) {
    const lines = violations.map((v) => `- ${v.row} [${v.law}]: ${v.detail}`);
    throw new Error(`the board is illegal — refusing to print it:\n${lines.join("\n")}`);
  }
  const out: string[] = [];
  out.push("# THE PHASE LAW — where the coupled track's classical wall lives, measured exactly\n");
  out.push(
    "> The identity card's third line promised phase-transition laws; the platform's law was a market law. This page is the combinatorial one: the coupling strength λ gates the assignment track from P (matching, PL7) toward QAP-type hardness on an exact hinge (PL1), the optimum never loses stability — its REACHABILITY collapses (PL3/PL4), and the two strongest polynomial heuristics fail on orthogonal axes (PL5). The referee is always complete enumeration; the v1.11 bench erratum is double-witnessed here (PL2).\n",
  );
  out.push("\n## The board\n");
  out.push("| id | claim | face | price | tag | witness |");
  out.push("| --- | --- | --- | --- | --- | --- |");
  for (const r of board) {
    out.push(`| ${r.id} | ${r.claim} | ${r.face} | ${r.price} | ${r.exactness} | ${r.witness} |`);
  }

  out.push("\n## The census (20 public seeds, every optimum enumerated)\n");
  out.push("| size | solver | hit@λ=0 | hit@λ=1.5 | 50% crossing |");
  out.push("| --- | --- | --- | --- | --- |");
  for (const c of thresholds(census(undefined, undefined, 20))) {
    out.push(
      `| ${c.m}×${c.n} | ${c.solver} | ${c.hitRateAtZero.toFixed(2)} | ${c.hitRateAtMax.toFixed(2)} | ${
        c.lambdaCross < 0 ? "never" : c.lambdaCross.toFixed(3)
      } |`,
    );
  }

  out.push("\n## The scaling campaign (v0.2.0 — 60 seeds × 31 λ points, step 0.05)\n");
  out.push("| size | solver | hit@λ=0 | hit@λ=0.5 | hit@λ=1.0 | hit@λ=1.5 | 50% crossing |");
  out.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const c of campaign()) {
    const at = (l: number): string => {
      const i = c.hitRates.findIndex((_, idx) => Math.abs(idx * 0.05 - l) < 1e-9);
      return i >= 0 ? c.hitRates[i]!.toFixed(2) : "—";
    };
    out.push(
      `| ${c.m}×${c.n} | ${c.solver} | ${at(0)} | ${at(0.5)} | ${at(1.0)} | ${at(1.5)} | ${
        c.lambdaCross < 0 ? "never" : c.lambdaCross.toFixed(3)
      } |`,
    );
  }
  out.push(
    "\nThe campaign's verdict: LS is λ-flat at every size (its wall is the SIZE cliff: 0.75 → 0.37); the SA crossing is MONOTONE in size — 0.925 (4×6) → 0.775 (5×7) → 0.525 (6×8), roughly −0.2 per task over three points (a FIT, not a theorem) — and the 6×8 curve is re-entrant (0.77 → 0.38 near λ≈0.9 → 0.43 at λ=1.5): extreme coupling makes the coupled block easy to spot. The pilot's non-monotonicity (PL6) was seed noise.\n",
  );

  out.push("\n## The island (v0.3.0 — the U-curve to λ=4, 40 public seeds)\n");
  out.push("| size | solver | down-cross | min | λ at min | up-cross | rate@λ=0 | rate@λ=4 |");
  out.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const c of islandCampaign()) {
    out.push(
      `| ${c.m}×${c.n} | ${c.solver} | ${c.downCross < 0 ? "never" : c.downCross.toFixed(2)} | ${c.minRate.toFixed(2)} | ${c.minLambda.toFixed(1)} | ${
        c.upCross < 0 ? "none by λ=4" : c.upCross.toFixed(2)
      } | ${c.rateAtZero.toFixed(2)} | ${c.rateAtMax.toFixed(2)} |`,
    );
  }
  out.push(
    "\nThe island's verdict: no re-entrant up-crossing by λ=4 at either size — the v0.2.0 'recovery' was a shallow wiggle. The optimum is poly-computable on BOTH faces (matching at λ=0; the n²×matching decomposition above the hinge, deviation 8.88e-16) — but structure-blind SA gets no relief: **the island is algorithmic, not dynamic** — its right face is reachable by analysis, not by search. Boundaries: the single-entangled-pair family; the crossing statistic is boundary-fragile when the curve hugs 0.5 (the minimum is the robust statistic); denser coupling structures are the priced next step.\n",
  );

  out.push("\n## The density axis (v0.4.0 — k entangled pairs, first cut)\n");
  out.push("| claim | number |\n");
  out.push("| --- | --- |\n");
  out.push("| k+1-line envelope: monotone staircase + argmax identity | step-violation 0, mismatch 0 (15 cells) |\n");
  out.push("| all-k right face (slots + matching) | deviation 0.00e+0 (24 cells, integer-exact) |\n");
  out.push("| k=1 compatibility with v0.1 | weights identical, optima agree to 1e-12 |\n");
  out.push("| density census (LS probe, 5×7, 15 seeds): λ-flat at every k | k=1: 0.53 · k=2: 0.33 · k=3: 0.27 |\n");
  out.push(
    "\nThe generalized island: P on the left (matching), P on the right (all-k slots + matching), a monotone staircase of at most k steps between (PL14) — and the structure-blind level FALLS with density (PL16). Priced next: the SA density census, non-uniform per-pair bonuses, and the staircase's breakpoint scaling in k.\n",
  );

  out.push("\n## The landscape (exact, complete 1-exchange graph, seed 500)\n");
  out.push("| size | λ | nodes | local optima | global basin |");
  out.push("| --- | --- | --- | --- | --- |");
  for (const [m, n] of [
    [3, 4],
    [3, 5],
  ] as const) {
    for (const lambda of [0, 0.3, 0.7, 1.5]) {
      const s = landscapeStats(makeInstance(m, n, 500, lambda));
      out.push(
        `| ${m}×${n} | ${lambda} | ${s.nodes} | ${s.localOptima} | ${(s.globalBasinFraction * 100).toFixed(1)}% |`,
      );
    }
  }

  out.push("\n## Witnesses\n");
  for (const w of runWitnesses()) {
    out.push(`- **${w.witness}**: ${w.ok ? "PASS" : "FAIL"} — ${w.detail}`);
  }

  out.push(
    "\n## The law, in one paragraph\n\nλ_opt* = max(0, U − C) is the exact hinge of the OPTIMAL STRUCTURE (PL1). The HEURISTIC wall is not that hinge: the optimum stays 1-exchange stable at every λ (PL3) while its basin collapses (PL4) — a reachability transition. And the wall has two orthogonal faces (PL5): local search dies with SIZE on the matching face (0.90 → 0.30 at λ=0), annealing dies with λ on the coupling face (crossings 1.25/1.25/0.60) — the record track's 2/5, 2/5, 3/5 is the signature of both axes failing at once. No scaling law is claimed at pilot scale (PL6). Boundaries: one entangled pair, bonus uniform in λ, sizes ≤ 6×8, 20 seeds — the census is honest about its horizon.\n",
  );
  return out.join("\n");
}

function main(): void {
  const content = renderBoard();
  const path = writeReport("the-phase-law.md", content);
  console.log(`rendered ${path}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]!).href) {
  main();
}
