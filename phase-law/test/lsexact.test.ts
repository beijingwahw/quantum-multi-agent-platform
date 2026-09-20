import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  breakpoints2xn,
  greedy,
  localSearch,
  lsThreshold2xn,
  makeInstance,
  makeIntegerWeights,
  optimumOf,
  welfareOf,
} from "../src/kernel/law.js";

// ===========================================================================
// PL21's KERNEL — THE 2×n LS THRESHOLD AS AN EXACT RATIONAL. This layer
// lives in the test tree BY DESIGN: the repo's v0.6.0 orphan law (every src
// file must be statically reachable from the render entry, phase-law.test's
// "no orphan modules" guard) means a NEW src file would require editing the
// frozen renderer's import face — forbidden. The theorem is terminal (no
// other module consumes it), so the whole exact-rational road ships here,
// import-clean of nothing, and the wave's ledger records the placement.
//
//   (1) EXACTNESS. Every welfare difference between two assignments is
//       D(λ) = da + db·λ with db ∈ {−1, 0, 1} (m = 2: I ∈ {0, 1}), and da is
//       a difference of integer sums of thousandths (the family's 3-decimal
//       weights taken BEFORE the /1000 division — the staircase's referee
//       arithmetic). Every breakpoint on the λ ≥ 0 face is therefore the
//       exact rational bp = bpThou/1000 (the division by db = ±1 is exact),
//       and the LS threshold — the left edge of the first miss interval —
//       is 0, one of these rationals, or Infinity. NO floating point enters
//       the verdict: interval probes are exact midpoints (half-integers in
//       thousandths) and every comparison 2·da + db·(lo+hi) is integer.
//
//   (2) AGREEMENT. The float road's decisions cannot differ from the integer
//       road's: a nonzero welfare gap is at least half a thousandth
//       (5e−4 ≫ the 1e−9/1e−12 tolerances ≫ the ~1e−15 float summation
//       error), and both roads probe strictly inside the same open interval
//       (distinct integer breakpoints are ≥ 1 thousandth apart; float
//       breakpoints sit within ~1e−12 of their rationals) — so trajectory
//       and optimum, piecewise-constant there, are identical.
//
//   (3) THE NEVER-MISS FACE, exactly. λ*_LS = ∞ iff on EVERY breakpoint
//       interval the integer-road LS endpoint is the enumerated optimum —
//       a finite family of integer checks (necessary and sufficient).
//       Alongside it the STRUCTURAL SUFFICIENT condition, no LS run at all:
//       the greedy endpoint (coupling-blind, λ-free) is the optimum on
//       every interval — itself a finite family of linear inequalities
//       checked at interval ENDPOINTS only (linear and non-negative on a
//       closed interval iff non-negative at both ends). Sufficient, NOT
//       necessary (LS may walk off a non-optimal greedy endpoint and still
//       land on the global); the one-way honesty is asserted and counted.
//
//   (4) THE GRID-SWEEP SMUGGLE. A half-step-offset float sweep samples
//       (j+½)·Δλ and can step OVER a narrow miss interval entirely,
//       reporting the threshold late or never; the rational road names the
//       interval exactly. The negative control pins convicted instances.
// ===========================================================================

/** Integer face of one 2×n assignment: agents (a, b), usesBoth flag, w0 in
 * integer thousandths. */
interface Integer2xnAssignment {
  readonly a: number;
  readonly b: number;
  readonly usesBoth: boolean;
  readonly w0Thou: number;
}

/** Enumerate all n(n−1) assignments with INTEGER thousandth weights — the
 * exact referee. Same visit order as law.ts's enumerateAll (a outer, b
 * inner; strict > keeps the first maximum), so ties break identically. */
function enumerateInteger2xn(n: number, seed: number): Integer2xnAssignment[] {
  if (!Number.isInteger(n) || n < 2)
    throw new Error("enumerateInteger2xn is a 2-task theorem — wrong object");
  const w = makeIntegerWeights(2, n, seed);
  const out: Integer2xnAssignment[] = [];
  for (let a = 0; a < n; a++) {
    for (let b = 0; b < n; b++) {
      if (b === a) continue;
      const usesBoth = (a === 0 || b === 0) && (a === 1 || b === 1);
      out.push({ a, b, usesBoth, w0Thou: w[0]![a]! + w[1]![b]! });
    }
  }
  return out;
}

/** The exact breakpoint set in integer thousandths, ascending, deduplicated:
 * the POSITIVE roots −da/db of the db ≠ 0 pairs (db = ±1 at m = 2, so the
 * division is exact) — same face as law.ts's breakpoints2xn (its x > 1e-12
 * filter), each root the exact rational bpThou/1000. */
function integerBreakpoints2xn(n: number, seed: number): number[] {
  const all = enumerateInteger2xn(n, seed);
  const set = new Set<number>();
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const da = all[i]!.w0Thou - all[j]!.w0Thou;
      const db = (all[i]!.usesBoth ? 1 : 0) - (all[j]!.usesBoth ? 1 : 0);
      if (db !== 0) {
        const x = -da / db; // db = ±1: the exact integer root
        if (x > 0) set.add(x);
      }
    }
  }
  return [...set].sort((x, y) => x - y);
}

/** The integer optimum at the probe (lo+hi)/2 thousandths (an exact
 * half-integer midpoint of an open breakpoint interval): maximize
 * 2·w0Thou + I·(lo+hi) in pure integer arithmetic — the probe's welfare
 * times 2·1000, an order-preserving scale. Ties keep the first in visit
 * order, matching law.ts's optimumOf. */
function argmaxAtProbe(
  all: readonly Integer2xnAssignment[],
  loPlusHi: number,
): Integer2xnAssignment {
  let best = all[0]!;
  let bestV = -Infinity;
  for (const asg of all) {
    const v = 2 * asg.w0Thou + (asg.usesBoth ? 1 : 0) * loPlusHi;
    if (v > bestV) {
      bestV = v;
      best = asg;
    }
  }
  return best;
}

/** Integer greedy: tasks in order, best free agent by WEIGHTS ONLY, strict >
 * (the first maximum wins) — the same tie semantics as law.ts's greedy on
 * the same matrix, so the endpoint is the same assignment. */
function greedyInt(w: readonly number[][]): [number, number] {
  let a = 0;
  for (let j = 1; j < w[0]!.length; j++) {
    if (w[0]![j]! > w[0]![a]!) a = j;
  }
  let b = -1;
  for (let j = 0; j < w[1]!.length; j++) {
    if (j === a) continue;
    if (b < 0 || w[1]![j]! > w[1]![b]!) b = j;
  }
  return [a, b];
}

/** The 1-exchange neighborhood of (a, b): move task 0 to a' ∉ {a, b} or
 * task 1 to b' ∉ {a, b} — same neighborhood and visit order as law.ts's
 * localSearch. */
function neighbors(
  n: number,
  pair: readonly [number, number],
): Array<[number, number]> {
  const [a, b] = pair;
  const out: Array<[number, number]> = [];
  for (let ap = 0; ap < n; ap++) {
    if (ap !== a && ap !== b) out.push([ap, b]);
  }
  for (let bp = 0; bp < n; bp++) {
    if (bp !== a && bp !== b) out.push([a, bp]);
  }
  return out;
}

/** Integer local search from the greedy endpoint at the probe: strict > 0
 * integer gains, first improving neighbor in visit order — matches
 * law.ts's > 1e-12 on gaps never smaller than half a thousandth. */
function localSearchInt(
  n: number,
  start: readonly [number, number],
  loPlusHi: number,
  w: readonly number[][],
): [number, number] {
  const welfare = (p: readonly [number, number]): number => {
    const usesBoth = (p[0] === 0 || p[1] === 0) && (p[0] === 1 || p[1] === 1);
    return 2 * (w[0]![p[0]]! + w[1]![p[1]]!) + (usesBoth ? 1 : 0) * loPlusHi;
  };
  let cur = [start[0], start[1]] as [number, number];
  for (;;) {
    const curW = welfare(cur);
    let moved = false;
    for (const nb of neighbors(n, cur)) {
      if (welfare(nb) > curW) {
        cur = [nb[0], nb[1]];
        moved = true;
        break;
      }
    }
    if (!moved) return cur;
  }
}

const intervalEdges = (n: number, seed: number): number[] => [
  0,
  ...integerBreakpoints2xn(n, seed),
];

/** The far-inside probe of the unbounded last interval: any point beyond
 * every breakpoint (2e6 thousandths dwarfs every |da| ≤ ~3 thousand-weight). */
const FAR_THOU = 2_000_000;

interface ExactLsThreshold2xn {
  /** the threshold in integer thousandths (the exact rational is thou/1000);
   *  Infinity when LS never misses */
  readonly lambdaStarThou: number;
  /** the number of breakpoint intervals on the λ ≥ 0 face */
  readonly intervals: number;
  readonly neverMisses: boolean;
}

/** THE EXACT THRESHOLD. Intervals [b_0=0, b_1), [b_1, b_2), …, (b_last, ∞)
 * on the thousandth line; each probed at its exact midpoint in doubled
 * integer arithmetic; the first miss interval's LEFT EDGE is the threshold
 * — the same left-closed convention as law.ts's lsThreshold2xn. */
function lsThresholdExact2xn(n: number, seed: number): ExactLsThreshold2xn {
  if (!Number.isInteger(n) || n < 2)
    throw new Error("lsThresholdExact2xn is a 2-task theorem — wrong object");
  const all = enumerateInteger2xn(n, seed);
  const w = makeIntegerWeights(2, n, seed);
  const starts = greedyInt(w);
  const edges = intervalEdges(n, seed);
  for (let i = 0; i < edges.length; i++) {
    const lo = edges[i]!;
    const hi = i + 1 < edges.length ? edges[i + 1]! : lo + FAR_THOU;
    const loPlusHi = lo + hi;
    const opt = argmaxAtProbe(all, loPlusHi);
    const end = localSearchInt(n, starts, loPlusHi, w);
    const usesBoth =
      (end[0] === 0 || end[1] === 0) && (end[0] === 1 || end[1] === 1);
    const endWelfare =
      2 * (w[0]![end[0]]! + w[1]![end[1]]!) + (usesBoth ? 1 : 0) * loPlusHi;
    const optWelfare = 2 * opt.w0Thou + (opt.usesBoth ? 1 : 0) * loPlusHi;
    if (endWelfare !== optWelfare) {
      return {
        lambdaStarThou: lo,
        intervals: edges.length,
        neverMisses: false,
      };
    }
  }
  return {
    lambdaStarThou: Number.POSITIVE_INFINITY,
    intervals: edges.length,
    neverMisses: true,
  };
}

/**
 * THE STRUCTURAL SUFFICIENT CONDITION, no LS run at all: the greedy endpoint
 * (coupling-blind, λ-free) is the optimum on EVERY breakpoint interval.
 * Each greedy-vs-assignment gap is linear in λ, hence non-negative across
 * the interval iff non-negative at both ENDPOINTS — a finite family of pure
 * integer checks. Sufficient for λ* = ∞ (greedy optimal ⟹ LS, started
 * there, stays there and hits the optimum); NOT necessary — the tests
 * assert the one-way implication and count the converse instances honestly.
 */
function greedyEndpointAlwaysOptimal2xn(n: number, seed: number): boolean {
  const all = enumerateInteger2xn(n, seed);
  const w = makeIntegerWeights(2, n, seed);
  const g = greedyInt(w);
  const gW0 = w[0]![g[0]]! + w[1]![g[1]]!;
  const gI = (g[0] === 0 || g[1] === 0) && (g[0] === 1 || g[1] === 1) ? 1 : 0;
  const edges = intervalEdges(n, seed);
  for (let i = 0; i < edges.length; i++) {
    const lo = edges[i]!;
    const hi = i + 1 < edges.length ? edges[i + 1]! : lo + FAR_THOU;
    for (const asg of all) {
      const dA = gW0 - asg.w0Thou;
      const dB = gI - (asg.usesBoth ? 1 : 0);
      if (dA + dB * lo < 0 || dA + dB * hi < 0) return false;
    }
  }
  return true;
}

/** THE GRID-SWEEP FACE (the negative control's engine): scan λ over the
 * phase-offset grid (j + offset)·stepThou/1000 with the FLOAT solvers
 * exactly as law.ts runs them, and report the first grid λ whose probe
 * misses — Infinity if none does within gridPoints. */
function gridSweepThreshold2xn(
  n: number,
  seed: number,
  stepThou: number,
  offset: number,
  gridPoints: number,
): number {
  if (!(offset >= 0 && offset < 1))
    throw new Error(
      "gridSweepThreshold2xn: offset must lie in [0,1) — the grid phase",
    );
  for (let j = 0; j < gridPoints; j++) {
    const lambda = ((j + offset) * stepThou) / 1000;
    if (lambda === 0) continue;
    const probe = makeInstance(2, n, seed, lambda);
    const opt = optimumOf(probe).welfare;
    const lsW = welfareOf(probe, localSearch(probe, greedy(probe)));
    if (Math.abs(lsW - opt) > 1e-9) return lambda;
  }
  return Number.POSITIVE_INFINITY;
}

// ===========================================================================
// THE TESTS
// ===========================================================================

/** The float road's threshold for an agreement cell. */
function thresholdFloat(n: number, seed: number): number {
  return lsThreshold2xn(makeInstance(2, n, seed, 0)).lambdaStar;
}

describe("v0.7.0 — the LS threshold as an exact rational", () => {
  const GRID_N = [3, 4, 5, 6] as const;
  const SEEDS = Array.from({ length: 30 }, (_, i) => i + 1);

  it("PL21: every breakpoint is an exact rational p/1000 — the float road's set, rounded to thousandths, IS the integer set", () => {
    let cells = 0;
    for (const n of GRID_N) {
      for (const seed of SEEDS) {
        // equal-integer differences can carry different float rounding on
        // different pairs — the float Set may split them; rounded to
        // thousandths and re-deduplicated the sets must coincide exactly
        const floatSet = [
          ...new Set(
            breakpoints2xn(makeInstance(2, n, seed, 0)).map((x) =>
              Math.round(x * 1000),
            ),
          ),
        ].sort((x, y) => x - y);
        const intBps = integerBreakpoints2xn(n, seed);
        assert.deepStrictEqual(
          floatSet,
          intBps,
          `n=${String(n)} seed=${String(seed)}: float and integer breakpoint sets differ`,
        );
        cells++;
      }
    }
    assert.ok(cells >= 100, `enough cells checked (${String(cells)})`);
  });

  it("PL21: the float midpoint road and the integer road name the SAME threshold — the same rational, cell for cell", () => {
    let worst = 0;
    let finite = 0;
    let infinite = 0;
    for (const n of GRID_N) {
      for (const seed of SEEDS) {
        const exact = lsThresholdExact2xn(n, seed);
        const floatStar = thresholdFloat(n, seed);
        if (
          !Number.isFinite(exact.lambdaStarThou) ||
          !Number.isFinite(floatStar)
        ) {
          assert.ok(
            !Number.isFinite(exact.lambdaStarThou) ===
              !Number.isFinite(floatStar),
            `n=${String(n)} seed=${String(seed)}: finite/Infinity SPLIT — float ${String(floatStar)} vs exact ${String(exact.lambdaStarThou)}`,
          );
          infinite++;
          continue;
        }
        finite++;
        // the float breakpoint carries ~1e-16 rounding; the RATIONAL it
        // names is compared at thousandth grain (the family's own quantum)
        const dev = Math.abs(
          Math.round(floatStar * 1000) - exact.lambdaStarThou,
        );
        worst = Math.max(worst, dev);
        assert.strictEqual(
          Math.round(floatStar * 1000),
          exact.lambdaStarThou,
          `n=${String(n)} seed=${String(seed)}: float ${String(floatStar)} vs exact ${String(exact.lambdaStarThou)} thousandths`,
        );
      }
    }
    assert.ok(
      worst === 0,
      `worst threshold deviation ${String(worst)} thousandths (finite ${String(finite)} / never-miss ${String(infinite)})`,
    );
  });

  it("PL21: finite thresholds sit exactly on the breakpoint set (the rational is an element, not a neighborhood)", () => {
    let finite = 0;
    for (const n of GRID_N) {
      for (const seed of SEEDS) {
        const { lambdaStarThou } = lsThresholdExact2xn(n, seed);
        if (!Number.isFinite(lambdaStarThou)) continue;
        finite++;
        assert.ok(
          lambdaStarThou === 0 ||
            integerBreakpoints2xn(n, seed).includes(lambdaStarThou),
          `n=${String(n)} seed=${String(seed)}: threshold ${String(lambdaStarThou)} is neither 0 nor a breakpoint`,
        );
      }
    }
    assert.ok(
      finite >= 30,
      `enough finite thresholds to pin (${String(finite)})`,
    );
  });

  it("PL21 negative control: half a thousandth on either side flips the verdict — a threshold nudged by 0.001 is convicted", () => {
    // the sharpness trial doubles as the smuggling trial: claim the threshold
    // one thousandth higher or lower and the flip at +/- 0.0005 convicts it
    let checked = 0;
    for (const n of GRID_N) {
      for (const seed of SEEDS) {
        const { lambdaStarThou } = lsThresholdExact2xn(n, seed);
        if (!Number.isFinite(lambdaStarThou)) continue;
        // at lambda* = 0 there is no below-face (the domain is lambda >= 0)
        if (lambdaStarThou === 0) {
          const above0 = makeInstance(2, n, seed, 0.0005);
          const missesAt0plus =
            Math.abs(
              welfareOf(above0, localSearch(above0, greedy(above0))) -
                optimumOf(above0).welfare,
            ) > 1e-9;
          assert.ok(
            missesAt0plus,
            `n=${String(n)} seed=${String(seed)}: LS hits just above 0 — the rational is wrong`,
          );
          checked++;
          continue;
        }
        const below = makeInstance(2, n, seed, (lambdaStarThou - 0.5) / 1000);
        const above = makeInstance(2, n, seed, (lambdaStarThou + 0.5) / 1000);
        const hitsBelow =
          Math.abs(
            welfareOf(below, localSearch(below, greedy(below))) -
              optimumOf(below).welfare,
          ) <= 1e-9;
        const missesAbove =
          Math.abs(
            welfareOf(above, localSearch(above, greedy(above))) -
              optimumOf(above).welfare,
          ) > 1e-9;
        assert.ok(
          hitsBelow,
          `n=${String(n)} seed=${String(seed)}: LS misses BELOW the threshold — the rational is wrong`,
        );
        assert.ok(
          missesAbove,
          `n=${String(n)} seed=${String(seed)}: LS hits ABOVE the threshold — the rational is wrong`,
        );
        checked++;
        if (checked >= 12) break;
      }
      if (checked >= 12) break;
    }
    assert.ok(checked >= 10, `enough sharp cells checked (${String(checked)})`);
  });

  it("PL21: the structural condition (greedy endpoint optimal on every interval, endpoints only) implies never-miss — one-way, counted honestly", () => {
    let sufficientFailures = 0;
    let greedyAlwaysOpt = 0;
    let neverMiss = 0;
    let walkedOffAndSurvived = 0;
    for (const n of GRID_N) {
      for (const seed of SEEDS) {
        const exact = lsThresholdExact2xn(n, seed);
        const structural = greedyEndpointAlwaysOptimal2xn(n, seed);
        if (structural) greedyAlwaysOpt++;
        if (exact.neverMisses) neverMiss++;
        if (exact.neverMisses && !structural) walkedOffAndSurvived++;
        if (structural && !exact.neverMisses) sufficientFailures++;
      }
    }
    assert.ok(
      sufficientFailures === 0,
      `the implication greedy-optimal => never-miss failed ${String(sufficientFailures)} times`,
    );
    // the converse is NOT claimed: instances where LS walks off a non-optimal
    // greedy endpoint and still lands on the global are counted, not hidden
    assert.ok(neverMiss >= greedyAlwaysOpt, "the counts are consistent");
    assert.ok(
      typeof walkedOffAndSurvived === "number",
      `never-miss ${String(neverMiss)}, greedy-always-optimal ${String(greedyAlwaysOpt)}, walked-off-and-survived ${String(walkedOffAndSurvived)} (the sufficiency gap, as data)`,
    );
  });

  it("PL21 negative control: a half-step-offset grid sweep reports the threshold LATE — the rational road names it exactly", () => {
    const STEP_THOU = 100; // lambda grid step 0.1, phase 1/2 -> points at 0.05, 0.15, ...
    let late = 0;
    let cells = 0;
    let narrowSteppedOver = 0;
    for (const n of GRID_N) {
      for (let seed = 1; seed <= 60; seed++) {
        const exact = lsThresholdExact2xn(n, seed);
        if (!Number.isFinite(exact.lambdaStarThou)) continue;
        cells++;
        const sweep = gridSweepThreshold2xn(n, seed, STEP_THOU, 0.5, 40);
        const sweepThou = Number.isFinite(sweep)
          ? sweep * 1000
          : Number.POSITIVE_INFINITY;
        assert.ok(
          sweepThou >= exact.lambdaStarThou - 1e-6,
          `n=${String(n)} seed=${String(seed)}: the sweep reports EARLIER than the rational — the rational road is the counterfeit`,
        );
        if (sweepThou > exact.lambdaStarThou + 1e-6) late++;
        // a miss interval narrower than the half-step is stepped over whole
        const bps = integerBreakpoints2xn(n, seed);
        const idx = bps.indexOf(exact.lambdaStarThou);
        const nextBp =
          idx >= 0
            ? (bps[idx + 1] ?? exact.lambdaStarThou + 1)
            : exact.lambdaStarThou + 1;
        if (nextBp - exact.lambdaStarThou <= 50 && sweepThou >= nextBp - 1e-6)
          narrowSteppedOver++;
      }
    }
    assert.ok(cells >= 20, `enough finite cells swept (${String(cells)})`);
    assert.ok(
      late >= 5,
      `the sweep is late on real cells (${String(late)} of ${String(cells)}) — the rational road names them first`,
    );
    // the narrow-interval conviction is reported as data: wherever the miss
    // interval was narrower than the half-step, the sweep stepped OVER it
    assert.ok(
      typeof narrowSteppedOver === "number",
      `narrow miss intervals stepped over whole: ${String(narrowSteppedOver)}`,
    );
  });

  it("PL21: the exact road refuses wrong objects by name (n < 2, non-integer, bad grid phase)", () => {
    assert.throws(() => lsThresholdExact2xn(1, 1), /2-task theorem/);
    assert.throws(() => lsThresholdExact2xn(3.5, 1), /2-task theorem/);
    assert.throws(
      () => gridSweepThreshold2xn(4, 1, 100, 1.0, 10),
      /grid phase/,
    );
    assert.throws(
      () => gridSweepThreshold2xn(4, 1, 100, -0.1, 10),
      /grid phase/,
    );
  });
});
