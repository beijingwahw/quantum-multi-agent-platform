import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  makeNuInstance,
  nuRay,
  nuRayDescentCount,
  nuSubsetEnvelope,
  type NuInstance,
} from "../src/kernel/nonuniform.js";

// ===========================================================================
// PL22's KERNEL — THE DESCENT CHARACTERIZATION ON NON-UNIFORM RAYS. This
// layer lives in the test tree BY DESIGN (the v0.7.0 lsexact precedent): the
// repo's no-orphan-modules guard (every src file must be statically
// reachable from the frozen render entry) forbids a new src file, so the
// theorem ships beside its tests, import-clean of nothing but nonuniform.ts.
//
// THE THEOREM (E5). On the ray λ(t) = t·μ (μ > 0), with the subset envelope
// D_S = max W₀ over assignments realizing EXACTLY S and V_S(t) = D_S +
// t·μ(S), the staircase count c(t) = |argmax_S V_S(t)| (nuRay's recorded
// winner, lowest-index tie-break) can DESCEND (c(t₂) < c(t₁), t₁ < t₂) if
// and only if there is a realized pair (A, B) with
//
//     |A| > |B|   AND   μ(A) < μ(B)   AND   D_A > D_B
//     AND both A and B exposed on the open ray:
//         I_S = { t > 0 : V_S(t) ≥ V_T(t) for every realized T } ≠ ∅.
//
//   (1) NECESSITY is exact: a recorded descent A → B forces the plane
//       difference Δ(t) = (D_A − D_B) + t(μ(A) − μ(B)) ≥ 0 at t₁ and ≤ 0 at
//       t₂, hence μ(A) < μ(B) and the crossing t* = (D_A−D_B)/(μ(B)−μ(A))
//       strictly positive — and the recorded winner is an argmax, so both
//       intervals are nonempty. No exposure-clause-free version can be
//       sufficient: the plane pair may exist while a THIRD plane (e.g. the
//       full set, which has both the top intercept and the top slope) roofs
//       the envelope everywhere — machine-convicted below (21 over-reports
//       on the k=3 grid alone).
//   (2) k ≤ 2 IMPOSSIBILITY: with μ > 0 every 2-set slope dominates every
//       1-set slope and ∅ has slope 0, so no pair satisfies |A| > |B| with
//       μ(A) < μ(B) — zero descents, structurally (PL19's exchange argument,
//       now closed-form).
//   (3) k = 3 DICHOTOMY: 3-sets dominate under μ > 0, so the only possible
//       pair shape is (2-set, 1-set) — descent REQUIRES a dominant pair
//       μ_i > μ_j + μ_l. Minimality: with m = 3 tasks no 2-pair mask is
//       realizable (max realized |S| = 1), so m = 4 is the minimal cell.
//   (4) k = 4 breaks the dichotomy: a 2-vs-1 slope inversion (μ_l >
//       μ_i + μ_j) without any dominant pair already descends — witnessed.
//
//   REDUNDANCY LEMMA (found while proving (1)): under μ(A) < μ(B), A's
//   exposure on the open ray already IMPLIES D_A > D_B (if D_A ≤ D_B then
//   V_A < V_B on t > 0, so A is never exposed) — the D-clause is kept
//   explicit because it is the fulcrum of the shuffled-predicate negative
//   control, and its independence from the slope clause is what the control
//   violates.
//
// Honest boundaries: D_S comes from complete enumeration (2^k families,
// sizes ≤ 4×10); the ray is the OPEN ray t > 0 (grids start at 1e-3 — the
// equivalence sweep's first draft started at 0.05 and missed four descents
// living below it, the resolution lesson recorded in the ledger); the
// decider's interval arithmetic is float (D values carry ~1e-13 summation
// noise; knife-edge ties are measure-zero and none were met in 800 cells);
// the apex corner (A and B touching the envelope only AT their crossing
// point) is the one geometry where weak exposure does not hand the count
// over — not encountered on the grid, documented here.
// ===========================================================================

/** |S| for a mask. */
function popcount(x: number): number {
  let c = 0;
  while (x !== 0) {
    c += x & 1;
    x >>= 1;
  }
  return c;
}

/** μ(S) for a mask (−1 = unrealized). */
function muOf(mus: readonly number[], mask: number): number {
  let s = 0;
  for (let i = 0; i < mus.length; i++) {
    if (mask & (1 << i)) s += mus[i]!;
  }
  return s;
}

/** Realized-mask family of an envelope (d entries null = unrealized). */
function realizedFamily(d: ReadonlyArray<number | null>): number[] {
  const out: number[] = [];
  for (let m = 0; m < d.length; m++) {
    if (d[m] !== null) out.push(m);
  }
  return out;
}

/**
 * The exposure interval I_S = { t ≥ 0 : V_S(t) ≥ V_T(t) ∀ realized T },
 * as [lo, hi]; null when empty. Callers intersect with the open ray t > 0
 * (nonempty iff hi > 0 and hi ≥ lo).
 */
function exposureInterval(
  d: ReadonlyArray<number | null>,
  mus: readonly number[],
  S: number,
): [number, number] | null {
  let lo = 0;
  let hi = Number.POSITIVE_INFINITY;
  for (const T of realizedFamily(d)) {
    if (T === S) continue;
    const mS = muOf(mus, S);
    const mT = muOf(mus, T);
    const dS = d[S] as number;
    const dT = d[T] as number;
    if (mS === mT) {
      if (dS < dT) return null; // parallel and below — never exposed
    } else if (mS > mT) {
      if (dS < dT) lo = Math.max(lo, (dT - dS) / (mS - mT));
    } else {
      if (dS <= dT) return null; // steeper rival above — never exposed
      hi = Math.min(hi, (dS - dT) / (mT - mS));
    }
  }
  if (lo > hi || hi <= 0) return null; // empty, or off the open ray
  return [lo, hi];
}

/** The COMPLETE DESCIDER: a descent witness (A, B, t*) or null. */
function descentWitness(
  d: ReadonlyArray<number | null>,
  mus: readonly number[],
): { A: number; B: number; tStar: number } | null {
  const F = realizedFamily(d);
  const exposed = new Map<number, [number, number]>();
  for (const S of F) {
    const iv = exposureInterval(d, mus, S);
    if (iv !== null) exposed.set(S, iv);
  }
  for (const A of F) {
    for (const B of F) {
      if (popcount(A) <= popcount(B)) continue;
      if (!(muOf(mus, A) < muOf(mus, B))) continue;
      if (!(d[A]! > d[B]!)) continue;
      if (!exposed.has(A) || !exposed.has(B)) continue;
      return { A, B, tStar: (d[A]! - d[B]!) / (muOf(mus, B) - muOf(mus, A)) };
    }
  }
  return null;
}

/** The R18-spec LITERAL predicate — the pair condition WITHOUT exposure
 *  clauses (necessity-only; its over-reports are the spec-refutation). */
function literalPairPredicate(
  d: ReadonlyArray<number | null>,
  mus: readonly number[],
): boolean {
  for (const A of realizedFamily(d)) {
    for (const B of realizedFamily(d)) {
      if (
        popcount(A) > popcount(B) &&
        muOf(mus, A) < muOf(mus, B) &&
        d[A]! > d[B]!
      )
        return true;
    }
  }
  return false;
}

/** The SHUFFLED control — the slope clause dropped (|A|>|B| ∧ D_A>D_B only). */
function predicateNoSlope(
  d: ReadonlyArray<number | null>,
  mus: readonly number[],
): boolean {
  for (const A of realizedFamily(d)) {
    for (const B of realizedFamily(d)) {
      if (
        popcount(A) > popcount(B) &&
        d[A]! > d[B]! &&
        muOf(mus, A) > muOf(mus, B)
      )
        return true;
    }
  }
  return false;
}

// the two-scale grid: 1e-3 fine scale (descents can live at t* ~ 4e-3) up to 0.08,
// then 0.05 steps to t = 8 — the first-draft grid starting at 0.05 missed four
const TS = [
  ...Array.from({ length: 80 }, (_, i) => 0.001 * (i + 1)),
  ...Array.from({ length: 160 }, (_, i) => 0.081 + 0.05 * i),
];

/** nuRay (the repo's referee) — descent events with their mask pairs. */
function staircaseEvents(
  inst: NuInstance,
  mus: readonly number[],
): Array<{
  from: number;
  to: number;
  fromCount: number;
  toCount: number;
  tFrom: number;
  tTo: number;
}> {
  const ray = nuRay(inst.m, inst.n, inst.seed, mus, TS);
  const out: Array<{
    from: number;
    to: number;
    fromCount: number;
    toCount: number;
    tFrom: number;
    tTo: number;
  }> = [];
  for (let i = 1; i < ray.length; i++) {
    if (ray[i]!.count < ray[i - 1]!.count) {
      out.push({
        from: ray[i - 1]!.mask,
        to: ray[i]!.mask,
        fromCount: ray[i - 1]!.count,
        toCount: ray[i]!.count,
        tFrom: ray[i - 1]!.t,
        tTo: ray[i]!.t,
      });
    }
  }
  return out;
}

const envelopeOf = (m: number, n: number, seed: number, k: number) =>
  nuSubsetEnvelope(
    makeNuInstance(
      m,
      n,
      seed,
      Array.from({ length: k }, () => 0),
    ),
  ).d;

const GROUPS = [
  {
    k: 2,
    m: 4,
    n: 6,
    mus: [
      [2, 1],
      [3, 1],
      [5, 4],
      [1, 2],
      [10, 1],
      [4, 3],
    ],
  },
  {
    k: 3,
    m: 4,
    n: 6,
    mus: [
      [10, 4, 3],
      [5, 1, 1],
      [3, 2.5, 2],
      [4, 3, 3],
      [5, 4, 2],
      [10, 1, 1],
      [2.5, 0.6, 0.6],
      [3, 3, 1],
    ],
  },
  {
    k: 4,
    m: 4,
    n: 10,
    mus: [
      [3, 3, 3, 7],
      [2, 2, 2, 5],
      [1, 1, 1, 1],
      [2, 2, 2, 2.01],
      [5, 1, 1, 1],
      [3, 3, 1, 1],
    ],
  },
] as const;

const SEED_FROM = 500;
const SEED_TO = 539; // 40 seeds per cell

describe("PL22 — (2) the k ≤ 2 impossibility, closed-form and re-witnessed", () => {
  it("the decider never fires on the whole k=2 grid (6 patterns × 40 seeds) and nuRayDescentCount re-confirms zero", () => {
    let cells = 0;
    for (const mus of GROUPS[0].mus) {
      for (let seed = SEED_FROM; seed <= SEED_TO; seed++) {
        const d = envelopeOf(4, 6, seed, 2);
        assert.equal(
          descentWitness(d, mus),
          null,
          `k=2 μ=(${mus.join(",")}) seed ${seed}: no pair can satisfy |A|>|B| ∧ μ(A)<μ(B) with μ>0`,
        );
        cells++;
      }
    }
    assert.equal(cells, 240);
    assert.equal(
      nuRayDescentCount(4, 6, 2, GROUPS[0].mus, SEED_FROM, SEED_TO, TS),
      0,
    );
  });

  it("negative control: the slope-clause-dropped predicate FIRES on the k=2 grid where the theorem says zero — the shuffle is convicted", () => {
    let fires = 0;
    for (const mus of GROUPS[0].mus) {
      for (let seed = SEED_FROM; seed <= SEED_TO; seed++) {
        const d = envelopeOf(4, 6, seed, 2);
        if (predicateNoSlope(d, mus)) fires++;
      }
    }
    assert.ok(
      fires >= 100,
      `the shuffled predicate must over-report massively (fired ${fires}/240) — a decider without the slope clause is not a decider`,
    );
  });
});

describe("PL22 — the equivalence sweep: decider ⟺ staircase on the full grid", () => {
  it("800 cells, 100% agreement (a mismatch is a conviction); descents exist in both k=3 and k=4 groups", () => {
    let cells = 0;
    let deciderCells = 0;
    let staircaseCells = 0;
    let k3Descents = 0;
    let k4Descents = 0;
    for (const g of GROUPS) {
      for (const mus of g.mus) {
        for (let seed = SEED_FROM; seed <= SEED_TO; seed++) {
          const inst = makeNuInstance(g.m, g.n, seed, mus);
          const d = envelopeOf(g.m, g.n, seed, g.k);
          const dec = descentWitness(d, mus);
          const ev = staircaseEvents(inst, mus);
          assert.equal(
            dec !== null,
            ev.length > 0,
            `MISMATCH k=${g.k} μ=(${mus.join(",")}) seed ${seed}: decider ${JSON.stringify(dec)}, staircase events ${ev.length}`,
          );
          // NECESSITY pinned per event: every recorded descent's mask pair
          // satisfies the predicate with a positive crossing
          for (const e of ev) {
            assert.ok(
              popcount(e.from) > popcount(e.to),
              `k=${g.k} μ=(${mus.join(",")}) seed ${seed}: |from|>|to|`,
            );
            assert.ok(
              muOf(mus, e.from) < muOf(mus, e.to),
              `k=${g.k} μ=(${mus.join(",")}) seed ${seed}: slope(from)<slope(to)`,
            );
            assert.ok(
              d[e.from]! > d[e.to]!,
              `k=${g.k} μ=(${mus.join(",")}) seed ${seed}: D(from)>D(to)`,
            );
            assert.ok(
              (d[e.from]! - d[e.to]!) / (muOf(mus, e.to) - muOf(mus, e.from)) >
                0,
              "positive breakpoint",
            );
          }
          if (dec !== null) deciderCells++;
          if (ev.length > 0) {
            staircaseCells++;
            if (g.k === 3) k3Descents++;
            if (g.k === 4) k4Descents++;
          }
          cells++;
        }
      }
    }
    assert.equal(cells, 800);
    assert.equal(deciderCells, staircaseCells);
    assert.ok(
      k3Descents >= 3,
      `the k=3 group must contain descents (found ${k3Descents}) — the sweep has teeth`,
    );
    assert.ok(
      k4Descents >= 1,
      `the k=4 group must contain descents (found ${k4Descents})`,
    );
  });

  it("the literal spec predicate (no exposure clause) OVER-REPORTS — the spec's iff is machine-convicted and repaired", () => {
    let overReports = 0;
    let trueDescents = 0;
    for (const mus of GROUPS[1].mus) {
      for (let seed = SEED_FROM; seed <= SEED_TO; seed++) {
        const inst = makeNuInstance(4, 6, seed, mus);
        const d = envelopeOf(4, 6, seed, 3);
        const lit = literalPairPredicate(d, mus);
        const descends = staircaseEvents(inst, mus).length > 0;
        if (lit && !descends) overReports++;
        if (lit && descends) trueDescents++;
      }
    }
    assert.ok(
      overReports >= 10,
      `the pair condition alone predicts descents that never happen (${overReports} over-reports vs ${trueDescents} real) — sufficiency needs the exposure clauses`,
    );
  });

  it("redundancy lemma: under μ(A) < μ(B), A's exposure on the open ray already forces D_A > D_B (no counterexample in the whole grid)", () => {
    let pairsChecked = 0;
    for (const g of GROUPS) {
      for (const mus of g.mus) {
        for (let seed = SEED_FROM; seed <= SEED_TO; seed++) {
          const d = envelopeOf(g.m, g.n, seed, g.k);
          for (const A of realizedFamily(d)) {
            for (const B of realizedFamily(d)) {
              if (muOf(mus, A) >= muOf(mus, B)) continue;
              const iv = exposureInterval(d, mus, A);
              if (iv === null) continue;
              pairsChecked++;
              assert.ok(
                d[A]! > d[B]!,
                `k=${g.k} μ=(${mus.join(",")}) seed ${seed}: exposed A (mask ${A}) must sit above B (mask ${B}) — the redundancy lemma`,
              );
            }
          }
        }
      }
    }
    assert.ok(
      pairsChecked > 1000,
      `the lemma must be exercised (checked ${pairsChecked} exposed pairs)`,
    );
  });
});

describe("PL22 — (3) the k=3 dichotomy: dominance necessary, m=4 minimal, the PL19 witness closed", () => {
  it("every descending k=3 cell has a dominant pair; the non-dominant patterns find zero descents across 40 seeds each", () => {
    const dominant = (mus: readonly number[]): boolean => {
      const [a, b, c] = [mus[0]!, mus[1]!, mus[2]!];
      return a > b + c || b > a + c || c > a + b;
    };
    let dominantDescents = 0;
    for (const mus of GROUPS[1].mus) {
      const dom = dominant(mus);
      for (let seed = SEED_FROM; seed <= SEED_TO; seed++) {
        const inst = makeNuInstance(4, 6, seed, mus);
        const descends = staircaseEvents(inst, mus).length > 0;
        if (descends) {
          assert.ok(
            dom,
            `k=3 μ=(${mus.join(",")}) seed ${seed} descended WITHOUT a dominant pair — the dichotomy is false`,
          );
          dominantDescents++;
        }
      }
    }
    assert.ok(
      dominantDescents >= 3,
      `dominant-pattern descents must exist (found ${dominantDescents})`,
    );
    // the honest converse datum: dominance alone is NOT sufficient — (10,4,3)
    // is dominant and found ZERO descents in 40 seeds (no exposure aligned)
    let d040 = 0;
    for (let seed = SEED_FROM; seed <= SEED_TO; seed++) {
      if (
        staircaseEvents(makeNuInstance(4, 6, seed, [10, 4, 3]), [10, 4, 3])
          .length > 0
      )
        d040++;
    }
    assert.equal(
      d040,
      0,
      "the dominance-without-exposure datum (10,4,3) must stay zero — pre-verified",
    );
  });

  it("m = 3 is structurally descent-free at k = 3 (no 2-pair mask realizable) — m = 4 is the minimal cell", () => {
    for (let seed = SEED_FROM; seed <= SEED_TO; seed += 8) {
      const d = envelopeOf(3, 6, seed, 3);
      for (let mask = 0; mask < d.length; mask++) {
        if (d[mask] !== null) {
          assert.ok(
            popcount(mask) <= 1,
            `seed ${seed}: 3 tasks realize at most one pair (mask ${mask} has |S|=${popcount(mask)})`,
          );
        }
      }
      assert.equal(
        descentWitness(d, [10, 4, 3]),
        null,
        `seed ${seed}: no pair (2-set, 1-set) exists to descend through`,
      );
    }
  });

  it("the PL19 witness, now with the closed decider: seed 519, μ = (2.5, 0.6, 0.6), t* = 0.170, count 2 → 1 → 2", () => {
    const mus = [2.5, 0.6, 0.6];
    const d = envelopeOf(4, 6, 519, 3);
    const w = descentWitness(d, mus);
    assert.notEqual(w, null);
    assert.equal(w!.A, 6); // {2,3}
    assert.equal(w!.B, 1); // {1}
    assert.ok(Math.abs(w!.tStar - 0.17) < 1e-9, `t* = ${w!.tStar}`);
    const ray = nuRay(4, 6, 519, mus, [0, w!.tStar - 1e-6, w!.tStar + 1e-6, 8]);
    assert.equal(ray[0]!.count, 2);
    assert.equal(ray[1]!.count, 2);
    assert.equal(
      ray[2]!.count,
      1,
      "the dominant pair takes over — the count DESCENDS",
    );
    assert.equal(ray[3]!.count, 2, "and re-ascends on a different pair set");
    // the decider's own witness interval reproduces the handoff from D alone
    const iA = exposureInterval(d, mus, 6);
    const iB = exposureInterval(d, mus, 1);
    assert.ok(iA !== null && iB !== null);
    assert.ok(
      iA[1] <= w!.tStar + 1e-12,
      "A's exposure lies below the crossing",
    );
    assert.ok(
      iB[0] >= w!.tStar - 1e-12,
      "B's exposure lies above the crossing",
    );
  });
});

describe("PL22 — (4) k = 4 breaks the dichotomy: descent without any dominant pair", () => {
  it("witness: (4,10) seed 538, μ = (3,3,1,1) — a 2-vs-1 slope inversion descends, no μ_i beats the sum of two others", () => {
    const mus = [3, 3, 1, 1];
    const maxMu = Math.max(...mus);
    const rest = [...mus].sort((a, b) => b - a);
    assert.ok(
      maxMu < (rest[1] as number) + (rest[2] as number),
      "no dominant pair at k=4 (3 < 3+1)",
    );
    const d = envelopeOf(4, 10, 538, 4);
    const w = descentWitness(d, mus);
    assert.notEqual(
      w,
      null,
      "the decider fires without dominance — impossible at k=3",
    );
    assert.equal(w!.A, 12); // {3,4}: μ = 2
    assert.equal(w!.B, 2); // {2}: μ = 3 — the inversion 2 < 3
    const ev = staircaseEvents(makeNuInstance(4, 10, 538, mus), mus);
    assert.ok(
      ev.length > 0,
      "the staircase descends (t* ≈ 4e-3 — the fine-scale grid catches it)",
    );
    assert.ok(Math.abs(w!.tStar - 0.004) < 1e-9, `t* = ${w!.tStar}`);
  });
});
