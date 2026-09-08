/**
 * Renders THE PHASE LAW — one page. Entry guard (house law since batch 21).
 */
import { pathToFileURL } from "node:url";
import { BOARD, type BoardRow } from "../kernel/board.js";
import { checkBoard, runWitnesses } from "../kernel/audit.js";
import { census, campaign, islandCampaign, thresholds } from "../kernel/census.js";
import { landscapeStats, makeInstance } from "../kernel/law.js";
import { densityCampaign } from "../kernel/density.js";
import { makeNuInstance, nuSubsetEnvelope } from "../kernel/nonuniform.js";
import { staircaseCell, staircaseStats } from "../kernel/staircase.js";
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

  out.push("\n## The density law (v0.5.0 — SA census, non-uniform bonuses, breakpoint scaling)\n");

  out.push("### The SA density census (20 public seeds, λ 0→8 step 0.1, every optimum enumerated)\n");
  out.push("| size | k | solver | hit@λ=0 | down-cross | min | λ at min | hit@λ=8 |");
  out.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
  const dens = densityCampaign();
  for (const c of dens) {
    out.push(
      `| ${c.m}×${c.n} | ${c.k} | ${c.solver} | ${c.rateAtZero.toFixed(2)} | ${
        c.downCross < 0 ? "never" : c.downCross.toFixed(2)
      } | ${c.minRate.toFixed(2)} | ${c.minLambda.toFixed(1)} | ${c.rateAtMax.toFixed(2)} |`,
    );
  }
  out.push(
    "\nThe census's verdict: density SPLITS the island. On the UNSATURATED axis (6×8, all k pairs realizable) SA's crossing stays monotone in k (0.65 → 0.35 → 0.35), its floor collapses 0.35 → 0.05 → 0.00, and there is NO re-entrant up-cross at any k by λ=8 — the k=1 island's no-relief verdict SURVIVES density. In the SATURATED corner (5×7 k=3: six pair agents, five tasks — three equivalent two-pair targets) the curve never falls below 0.5 (min 0.55@λ=0.9, back to 0.70 at λ=8): the easy-hard-easy tail lives at saturation, not on the density ray. λ=0 columns are identical across k at both sizes (the matching face untouched). LS falls with k at 5×7 (0.45 → 0.35 → 0.30) but is NON-monotone at 6×8 (0.25 → 0.45 → 0.20 at λ=4) — reported as found, PL16's level-drop does not extend to 6×8.\n",
  );

  out.push("### Non-uniform per-pair bonuses (the 2^k-plane envelope)\n");
  out.push("| identity | verdict |");
  out.push("| --- | --- |");
  out.push("| subset envelope: opt(λ) = max_S (D_S + Σ_{i∈S} λ_i) | SURVIVES — deviation 0.00e+0 vs enumeration (4×6, 4 seeds × 4 λ-vectors) |");
  out.push("| all-k right face (one coverage-forced Hungarian, M = m+1) | SURVIVES — deviation 0.00e+0 over regime-verified cells |");
  out.push("| k=1 compatibility with the v0.1 family | SURVIVES — weights identical, optimum deviation 0 |");
  out.push("| monotone count on uniform rays | SURVIVES — PL14's theorem, 0 violations |");
  out.push("| monotone count on non-uniform rays, k = 2 | SURVIVES — 0 descents over 3 μ-patterns × 21 seeds (structural: 2-set slopes dominate) |");
  out.push("| monotone count on non-uniform rays, k = 3 | **BREAKS** — witness below |");
  {
    const { d } = nuSubsetEnvelope(makeNuInstance(4, 6, 519, [0, 0, 0]));
    const tStar = (d[6]! - d[1]!) / (2.5 - 1.2);
    out.push(
      `\nThe descent witness (exact): 4×6 seed 519, ray λ(t) = t·(2.5, 0.6, 0.6) — D_{{2,3}} = ${d[6]!.toFixed(3)} vs D_{{1}} = ${d[1]!.toFixed(3)}, crossing t* = ${tStar.toFixed(6)}: the optimum's realized count goes 2 → 1 (the dominant pair takes over) → 2 again on a different pair set. The monotone staircase is strictly a UNIFORM-λ phenomenon; descents need k ≥ 3 and a dominant pair (μ₁ > μ₂ + μ₃) — the exchange argument says so, and the machine agrees.\n`,
    );
  }

  out.push("### Breakpoint scaling in k (exact rationals; scaling as DATA only)\n");
  out.push("| size | k | cells with breaks | last break min/med/max | full staircases |");
  out.push("| --- | --- | --- | --- | --- |");
  {
    const cells: Array<ReturnType<typeof staircaseCell>> = [];
    for (const [m, n] of [
      [4, 6],
      [5, 7],
      [6, 8],
    ] as const) {
      const kMax = m >= 6 ? 3 : 2;
      for (let k = 1; k <= kMax; k++) {
        for (let s = 1; s <= 15; s++) cells.push(staircaseCell(m, n, 500 * s, k));
      }
    }
    const sat68 = staircaseStats(cells.filter((c) => c.m === 6));
    for (const st of sat68) {
      out.push(
        `| 6×8 | ${st.k} | ${st.cellsWithBreaks}/${st.cells} | ${st.lastBreakMin.toFixed(3)} / ${st.lastBreakMedian.toFixed(3)} / ${st.lastBreakMax.toFixed(3)} | ${st.fullStaircaseCells}/${st.cells} |`,
      );
    }
    out.push(
      `\nThe staircase's verdict: every breakpoint is an exact rational λ* = (C_a − C_b)/(b − a) over integer thousandths (denominators ≤ k), and at λ* ± 1e-6 the argmax sits precisely on the two hull neighbours — flip deviation 0 over 105 cells, tie-aware argmax-vs-enumeration mismatch 0 (7 exact-tie probes, all set-consistent), integer-vs-float C_j cross-check 8.88e-13 thousandths. The scaling in k is DATA ONLY: at 6×8 the last breakpoint (the all-k threshold) grows with k — medians ${sat68[0]!.lastBreakMedian.toFixed(3)} → ${sat68[1]!.lastBreakMedian.toFixed(3)} → ${sat68[2]!.lastBreakMedian.toFixed(3)} and maxima ${sat68[0]!.lastBreakMax.toFixed(3)} → ${sat68[1]!.lastBreakMax.toFixed(3)} → ${sat68[2]!.lastBreakMax.toFixed(3)} — while FULL staircases vanish (the hull SKIPS levels as k grows; no 6×8 cell realizes all 3 steps at k=3). No scaling law is claimed.\n`,
    );
  }

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

  out.push("\n## External anchors (2023–2026 literature, double-verified — anchors, not method)\n");
  out.push("| anchor | identifiers (verified from two independent sources) | what it positions |");
  out.push("| --- | --- | --- |");
  out.push(
    "| Verel, Thomson, Rifki (2024), \"Where the Really Hard Quadratic Assignment Problems Are: the QAP-SAT instances\" | arXiv:2403.02783 (evoCOP 2024) + HAL hal-04489201 | assignment-family phase transitions located by fitness-landscape and search-effort analysis — PL18's density census is the coupled-assignment analogue on an exact referee |",
  );
  out.push(
    "| Martínez-García & Porras (2025), \"Problem hardness of diluted Ising models: Population Annealing versus Simulated Annealing\" | arXiv:2501.07638 + Phys. Rev. E 112, 035314 | annealing hardness varying with structural density (dilution) — the density axis question; they report an easy-hard-easy sweep in dilution, this repo finds the easy tail only at SATURATION (PL18), never on the realizable density ray |",
  );
  out.push(
    "| Angelini & Ricci-Tersenghi (2023), \"Limits and Performances of Algorithms Based on Simulated Annealing in Solving Sparse Hard Inference Problems\" | Phys. Rev. X 13, 021011 + arXiv:2206.04760 | algorithmic thresholds where SA enters a hard phase — the coupling face's crossing statistic (PL5/PL9/PL18) is the same object measured exactly on a family whose optimum is always enumerable |",
  );
  out.push(
    "\nNothing above is reproduced or adopted as method: this repo proves only what it machine-executes — enumeration referee, public seeds, integer-exact arithmetic. The anchors situate the findings; every number on this page is from this repo's own runs.\n",
  );

  out.push("\n## Witnesses\n");
  for (const w of runWitnesses()) {
    out.push(`- **${w.witness}**: ${w.ok ? "PASS" : "FAIL"} — ${w.detail}`);
  }

  out.push(
    "\n## The law, in one paragraph\n\nλ_opt* = max(0, U − C) is the exact hinge of the OPTIMAL STRUCTURE (PL1). The HEURISTIC wall is not that hinge: the optimum stays 1-exchange stable at every λ (PL3) while its basin collapses (PL4) — a reachability transition. And the wall has two orthogonal faces (PL5): local search dies with SIZE on the matching face (0.90 → 0.30 at λ=0), annealing dies with λ on the coupling face (crossings 1.25/1.25/0.60) — the record track's 2/5, 2/5, 3/5 is the signature of both axes failing at once. No scaling law is claimed at pilot scale (PL6). With k entangled pairs the hinge becomes a STAIRCASE of exact rational breakpoints on the upper hull of (j, C_j) (PL14/PL20), and density splits the island (PL18): on the unsaturated axis SA's floor collapses to zero with no relief by λ=8, while saturation (pairs outnumbering tasks) hands SA three equivalent targets and the curve recovers — and non-uniform per-pair bonuses BREAK the monotone count (PL19): the optimum can realize FEWER pairs as coupling grows, 2 → 1 → 2 on the witnessed ray. Boundaries: sizes ≤ 6×8, k ≤ 3, 20 seeds, 3-decimal weights — the census is honest about its horizon.\n",
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
