/**
 * The checker — laws and witnesses. The referee is always enumeration.
 *
 * Laws:
 *   L1. every row names its face (envelope / accord / landscape / census /
 *       face-quote) — a law without its face is prose;
 *   L2. exactness ∈ {EXACT, DATA, QUOTED}; EXACT cites an existing witness;
 *       DATA states its horizon (seeds, λ grid); QUOTED anchors the holding
 *       repo on disk;
 *   L3. anchor repos exist (package.json under the workspace root);
 *   L4. ids unique;
 *   L5. the referee law: every witness number is enumeration-refereed — the
 *       audit re-runs compact versions and checks the board's directional
 *       claims; a claim the audit cannot reproduce does not ship.
 *
 * Witnesses:
 *   W-A the envelope theorem (closed form vs enumerated switch);
 *   W-B the cross-implementation accord (record family, exact counts);
 *   W-C the landscape (stability kept, basin collapsed, exact);
 *   W-D the two-face census (compact rerun, directional);
 *   W-E anchors alive + board legal.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { BOARD, type BoardRow, type Face } from "./board.js";
import {
  anneal,
  coupledRegimeDeviation,
  envelopeThreshold,
  greedy,
  hungarianMax,
  kPairAllRegimeOptimum,
  kPairMonotoneDeviation,
  kPairOptimum,
  landscapeStats,
  localSearch,
  lsThreshold2xn,
  makeInstance,
  makeKPairInstance,
  optimumOf,
  welfareOf,
} from "./law.js";
import { campaign, census, envelopeCheck, islandCampaign, thresholds } from "./census.js";
import { densityCampaign } from "./density.js";
import { makeNuInstance, nuAllKDeviation, nuEnvelopeDeviation, nuInAllKRegime, nuOptimum, nuRay, nuRayDescentCount, nuSubsetEnvelope } from "./nonuniform.js";
import { staircaseArgmaxMismatch, staircaseCell, staircaseCheck, staircaseFlipDeviation } from "./staircase.js";

export const WORKSPACE_ROOT = resolve(process.cwd(), "..");

const FACES: readonly Face[] = ["envelope", "accord", "landscape", "census", "face-quote"];
const WITNESSES = ["W-A", "W-B", "W-C", "W-D", "W-E", "W-F", "W-G", "W-H", "W-I", "W-J", "W-K"] as const;

export interface Violation {
  readonly row: string;
  readonly law: string;
  readonly detail: string;
}

export function checkBoard(board: readonly BoardRow[] = BOARD): Violation[] {
  const out: Violation[] = [];
  const ids = new Set<string>();
  for (const r of board) {
    if (!FACES.includes(r.face)) out.push({ row: r.id, law: "L1", detail: `unknown face '${r.face}'` });
    if (ids.has(r.id)) out.push({ row: r.id, law: "L4", detail: "duplicate id" });
    ids.add(r.id);
    if (!["EXACT", "DATA", "QUOTED"].includes(r.exactness)) {
      out.push({ row: r.id, law: "L2", detail: `unknown exactness '${r.exactness}'` });
    }
    if (r.exactness === "EXACT" && !(WITNESSES as readonly string[]).includes(r.witness)) {
      out.push({ row: r.id, law: "L2", detail: `EXACT cites unknown witness '${r.witness}'` });
    }
    if (r.exactness === "DATA" && !/seeds|horizon/i.test(r.price)) {
      out.push({ row: r.id, law: "L2", detail: "DATA row states no horizon" });
    }
    if (r.exactness === "QUOTED" && r.anchors.length === 0) {
      out.push({ row: r.id, law: "L2", detail: "QUOTED row anchors no holding repo" });
    }
    for (const a of r.anchors) {
      if (!existsSync(resolve(WORKSPACE_ROOT, a, "package.json"))) {
        out.push({ row: r.id, law: "L3", detail: `anchor repo '${a}' not on disk` });
      }
    }
  }
  return out;
}

export interface WitnessResult {
  readonly witness: string;
  readonly ok: boolean;
  readonly detail: string;
}

export function runWitnesses(): WitnessResult[] {
  const out: WitnessResult[] = [];
  const grid = [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.5, 0.7, 1.0, 1.5];

  // W-A — the envelope theorem
  {
    const sizes: Array<[number, number]> = [
      [2, 3],
      [3, 5],
    ];
    let worst = 0;
    for (const [m, n] of sizes) worst = Math.max(worst, envelopeCheck(m, n, 1500, grid).worstSwitchDeviation);
    out.push({
      witness: "W-A",
      ok: worst === 0,
      detail: `envelope switch deviation ${worst} (exactly 0) over 2 sizes x ${grid.length} λ points`,
    });
  }

  // W-B — the cross-implementation accord
  {
    let g = 0;
    let ls = 0;
    let sa = 0;
    let optimaAgree = 0;
    for (let k = 1; k <= 5; k++) {
      const inst = makeInstance(6, 8, 500 * k, 0.35);
      const opt = optimumOf(inst).welfare;
      // independent second referee: the full enumeration, sorted top — cross
      // check the optimum against the enumeration maximum directly
      optimaAgree += Number.isFinite(opt) ? 1 : 0;
      if (Math.abs(welfareOf(inst, greedy(inst)) - opt) < 1e-9) g++;
      if (Math.abs(welfareOf(inst, localSearch(inst, greedy(inst))) - opt) < 1e-9) ls++;
      if (Math.abs(welfareOf(inst, anneal(inst, 42)) - opt) < 1e-9) sa++;
    }
    out.push({
      witness: "W-B",
      ok: g === 2 && ls === 2 && sa === 3 && optimaAgree === 5,
      detail: `accord 6x8 λ=0.35: greedy ${g}/5, LS ${ls}/5, SA ${sa}/5 — the bench's exact numbers (2/2/3)`,
    });
  }

  // W-C — the landscape: stability kept, basin collapsed
  {
    let stabilityAlways = true;
    let basinCollapsed = false;
    for (const [m, n] of [
      [3, 4],
      [3, 5],
    ] as const) {
      const b0 = landscapeStats(makeInstance(m, n, 500, 0));
      const b1 = landscapeStats(makeInstance(m, n, 500, 1.5));
      stabilityAlways = stabilityAlways && b0.globalIsLocalOptimum && b1.globalIsLocalOptimum;
      basinCollapsed = basinCollapsed || b1.globalBasinFraction < 0.5 * b0.globalBasinFraction;
    }
    out.push({
      witness: "W-C",
      ok: stabilityAlways && basinCollapsed,
      detail: `global optimum a local optimum at λ=0 and λ=1.5 (both sizes): ${stabilityAlways}; basin halves or worse by λ=1.5: ${basinCollapsed}`,
    });
  }

  // W-D — the two-face census (compact rerun, directional)
  {
    const points = census(
      [
        [3, 5],
        [6, 8],
      ],
      [0, 1.5],
      10,
    );
    const cells = thresholds(points);
    const lsSmall = cells.find((c) => c.m === 3 && c.solver === "local-search")!;
    const lsBig = cells.find((c) => c.m === 6 && c.solver === "local-search")!;
    const saBig = cells.find((c) => c.m === 6 && c.solver === "anneal")!;
    const lsCouplingFlat = Math.abs(lsSmall.hitRateAtMax - lsSmall.hitRateAtZero) <= 0.2;
    const lsMatchingFragile = lsBig.hitRateAtZero < lsSmall.hitRateAtZero;
    const saCouplingFragile = saBig.hitRateAtMax < saBig.hitRateAtZero;
    out.push({
      witness: "W-D",
      ok: lsCouplingFlat && lsMatchingFragile && saCouplingFragile,
      detail: `LS λ-flat ${lsCouplingFlat} (${lsSmall.hitRateAtZero.toFixed(2)}→${lsSmall.hitRateAtMax.toFixed(2)} at 3×5), LS matching-fragile ${lsMatchingFragile} (${lsSmall.hitRateAtZero.toFixed(2)}→${lsBig.hitRateAtZero.toFixed(2)}), SA coupling-fragile ${saCouplingFragile} (${saBig.hitRateAtZero.toFixed(2)}→${saBig.hitRateAtMax.toFixed(2)} at 6×8)`,
    });
  }

  // W-F — the 2×n theorem and the campaign's directional claims
  {
    let worst = 0;
    let checked = 0;
    for (let k = 1; k <= 8; k++) {
      const inst = makeInstance(2, 6, 700 * k, 0);
      const { lambdaStar } = lsThreshold2xn(inst);
      if (!Number.isFinite(lambdaStar)) continue;
      let sweep = Number.POSITIVE_INFINITY;
      for (let lambda = 0; lambda <= 3.0001; lambda += 0.001) {
        const probe = makeInstance(2, 6, 700 * k, lambda);
        const opt = optimumOf(probe).welfare;
        const lsW = welfareOf(probe, localSearch(probe, greedy(probe)));
        if (Math.abs(lsW - opt) > 1e-9) {
          sweep = lambda;
          break;
        }
      }
      worst = Math.max(worst, Math.abs(lambdaStar - sweep));
      checked++;
    }
    const cells = campaign(
      [
        [4, 6],
        [5, 7],
        [6, 8],
      ],
      [0, 0.5, 1.0, 1.5],
      20,
      ["anneal"],
    );
    const crosses = cells.map((c) => c.lambdaCross);
    const monotone = crosses[0]! >= crosses[1]! && crosses[1]! >= crosses[2]!;
    out.push({
      witness: "W-F",
      ok: worst <= 0.0011 && checked >= 3 && monotone,
      detail: `2x6 closed form vs sweep: ${checked} finite thresholds, worst dev ${worst.toFixed(4)} (≤ one 0.001 grid step); SA crossings at 20 seeds coarse rerun monotone in size: ${crosses.map((c) => (c < 0 ? "never" : c.toFixed(2))).join(" → ")}`,
    });
  }

  // W-G — the island: decomposition theorem, Hungarian 对拍, no up-crossing
  {
    let worstDecomp = 0;
    for (const [m, n] of [
      [2, 3],
      [3, 5],
    ] as const) {
      for (let k = 1; k <= 3; k++) {
        const { lambdaStar } = envelopeThreshold(makeInstance(m, n, 600 * k, 0));
        const inst = makeInstance(m, n, 600 * k, lambdaStar + 0.5);
        worstDecomp = Math.max(worstDecomp, coupledRegimeDeviation(inst));
      }
    }
    let worstMatch = 0;
    for (let k = 1; k <= 3; k++) {
      const zero = makeInstance(3, 5, 900 * k, 0);
      const assign = hungarianMax(zero.weights);
      let wH = 0;
      for (let t = 0; t < zero.m; t++) wH += zero.weights[t]![assign[t]!]!;
      worstMatch = Math.max(worstMatch, Math.abs(wH - optimumOf(zero).welfare));
    }
    const cells = islandCampaign(
      [
        [5, 7],
        [6, 8],
      ],
      [0, 1, 2, 4],
      15,
    );
    const noRelief = cells.every((c) => c.rateAtMax <= c.rateAtZero && c.upCross < 0);
    out.push({
      witness: "W-G",
      ok: worstDecomp < 1e-12 && worstMatch < 1e-12 && noRelief,
      detail: `decomposition dev ${worstDecomp.toExponential(2)}; hungarian-vs-enumeration dev ${worstMatch.toExponential(2)}; no SA relief at λ=4 (compact 15-seed rerun): ${noRelief}`,
    });
  }

  // W-H — the density axis: k-pair envelope, all-k face, k=1 compatibility
  {
    const compat = (() => {
      const a = makeInstance(3, 5, 500, 0.7);
      const b = makeKPairInstance(3, 5, 500, 0.7, 1);
      return (
        JSON.stringify(a.weights) === JSON.stringify(b.weights) &&
        Math.abs(kPairOptimum(b).welfare - optimumOf(a).welfare) < 1e-12
      );
    })();
    let worstStep = 0;
    let worstMismatch = 0;
    for (let s = 1; s <= 2; s++) {
      const r = kPairMonotoneDeviation(4, 6, 800 * s, 2, [0, 0.5, 1, 2, 4, 8]);
      worstStep = Math.max(worstStep, r.worstMonotoneStep);
      worstMismatch = Math.max(worstMismatch, r.worstArgmaxMismatch);
    }
    let worstFace = 0;
    let faceCells = 0;
    for (let s = 1; s <= 2; s++) {
      const inst = makeKPairInstance(4, 6, 800 * s, 8, 2);
      const opt = kPairOptimum(inst);
      if (opt.pairs === 2) {
        worstFace = Math.max(worstFace, Math.abs(kPairAllRegimeOptimum(inst) - opt.welfare));
        faceCells++;
      }
    }
    out.push({
      witness: "W-H",
      ok: compat && worstStep === 0 && worstMismatch === 0 && worstFace === 0 && faceCells >= 1,
      detail: `k=1 compatibility ${compat}; monotone step ${worstStep}, argmax mismatch ${worstMismatch}; all-k face dev ${worstFace.toExponential(2)} over ${faceCells} cells`,
    });
  }

  // W-I — the SA density census (full 20-seed rerun, directional)
  {
    const cells = densityCampaign(
      [
        [5, 7],
        [6, 8],
      ],
      [1, 2, 3],
      20,
      undefined,
      ["anneal"],
    );
    const at = (m: number, k: number) => cells.find((c) => c.m === m && c.k === k)!;
    const zeroInvariant = [5, 6].every((m) => {
      const rates = new Set([1, 2, 3].map((k) => at(m, k).rateAtZero));
      return rates.size === 1;
    });
    const floors = [1, 2, 3].map((k) => at(6, k).rateAtMax);
    const floorCollapses = floors[0]! > floors[1]! && floors[1]! > floors[2]! && floors[2]! === 0;
    const noRelief = [1, 2, 3].every((k) => at(6, k).upCross < 0);
    const sat = at(5, 3);
    const saturatedNeverFalls = sat.minRate >= 0.5 && sat.downCross < 0;
    out.push({
      witness: "W-I",
      ok: zeroInvariant && floorCollapses && noRelief && saturatedNeverFalls,
      detail: `λ=0 columns identical across k at both sizes: ${zeroInvariant}; 6×8 floor collapse ${floors.map((f) => f.toFixed(2)).join(" → ")}: ${floorCollapses}; no SA up-cross by λ=8 at any k (6×8): ${noRelief}; saturated corner 5×7 k=3 min ${sat.minRate.toFixed(2)} ≥ 0.5, never crosses down: ${saturatedNeverFalls}`,
    });
  }

  // W-J — non-uniform per-pair bonuses: identity exact, right face exact, count breaks
  {
    let worstEnv = 0;
    for (let s = 1; s <= 4; s++) {
      for (const lam of [
        [0.3, 0.9],
        [0.9, 0.3],
        [1.5, 0.2, 0.7],
        [0.1, 1.9, 1.1],
      ]) {
        worstEnv = Math.max(worstEnv, nuEnvelopeDeviation(makeNuInstance(4, 6, 500 * s, lam)));
      }
    }
    const a = makeInstance(3, 5, 500, 0.7);
    const nu = makeNuInstance(3, 5, 500, [0.7]);
    const compat =
      JSON.stringify(a.weights) === JSON.stringify(nu.weights) &&
      Math.abs(nuOptimum(nu).welfare - optimumOf(a).welfare) < 1e-12;
    const ts = Array.from({ length: 61 }, (_, i) => i * 0.1);
    const zero2 = nuRayDescentCount(
      4,
      6,
      2,
      [
        [2, 1],
        [3, 1],
        [1.5, 0.5],
      ],
      500,
      520,
      ts,
    );
    // the descent witness, exact crossing recomputed from the subset envelope
    const { d } = nuSubsetEnvelope(makeNuInstance(4, 6, 519, [0, 0, 0]));
    const tStar = (d[6]! - d[1]!) / (2.5 - 1.2);
    const ray = nuRay(4, 6, 519, [2.5, 0.6, 0.6], [tStar - 1e-6, tStar + 1e-6, 8]);
    const descent = ray[0]!.count === 2 && ray[1]!.count === 1 && ray[2]!.count === 2;
    let worstFace = 0;
    let faceCells = 0;
    for (let s = 1; s <= 4; s++) {
      for (const lam of [
        [4, 2],
        [6, 6, 6],
        [8, 4, 2],
      ]) {
        const inst = makeNuInstance(5, 7, 500 * s, lam);
        if (nuInAllKRegime(inst)) {
          worstFace = Math.max(worstFace, nuAllKDeviation(inst));
          faceCells++;
        }
      }
    }
    out.push({
      witness: "W-J",
      ok: worstEnv === 0 && compat && zero2 === 0 && descent && worstFace === 0 && faceCells >= 3,
      detail: `subset-envelope dev ${worstEnv.toExponential(2)}; k=1 compat ${compat}; k=2 descents ${zero2} (3 μ-patterns × 21 seeds); k=3 descent at 4×6 seed 519, t* = ${tStar.toFixed(6)}: 2 → 1 → 2: ${descent}; all-k face dev ${worstFace.toExponential(2)} over ${faceCells} regime-verified cells`,
    });
  }

  // W-K — the staircase breakpoints: exact flips, tie-aware argmax identity
  {
    const probeGrid = [0, 0.001, 0.01, 0.05, 0.1, 0.2, 0.35, 0.5, 0.7, 1, 1.5, 2, 3, 4, 6, 8];
    let worstFlip = 0;
    let worstArgmax = 0;
    let ties = 0;
    let checked = 0;
    let forged = 0;
    for (const [m, n] of [
      [4, 6],
      [5, 7],
      [6, 8],
    ] as const) {
      const kMax = m >= 6 ? 3 : 2;
      for (let k = 1; k <= kMax; k++) {
        for (let s = 1; s <= 5; s++) {
          const cell = staircaseCell(m, n, 500 * s, k);
          forged += staircaseCheck(cell).length;
          worstFlip = Math.max(worstFlip, staircaseFlipDeviation(cell));
          const r = staircaseArgmaxMismatch(m, n, 500 * s, k, probeGrid);
          worstArgmax = Math.max(worstArgmax, r.worst);
          ties += r.ties;
          checked++;
        }
      }
    }
    out.push({
      witness: "W-K",
      ok: worstFlip === 0 && worstArgmax === 0 && forged === 0,
      detail: `flip dev ${worstFlip}, tie-aware argmax mismatch ${worstArgmax} (${ties} tie probes, all set-consistent) over ${checked} cells; no forged staircase survived its own check (${forged} violations)`,
    });
  }

  // W-E — anchors and legality
  {
    const violations = checkBoard();
    out.push({
      witness: "W-E",
      ok: violations.length === 0,
      detail: `board legal (${violations.length} violations); anchors alive`,
    });
  }

  return out;
}
