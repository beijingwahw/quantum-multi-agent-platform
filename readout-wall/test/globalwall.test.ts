import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  type Frac,
  type Ivl,
  F_ZERO,
  F_ONE,
  PATH_T,
  fAdd,
  fCmp,
  fDecimal,
  fDiv,
  fIsZero,
  fMul,
  fSub,
  fr,
  iOf,
} from "../src/kernel/rational.js";
import {
  certifyStrictlyDecreasing,
  esc18Certificate,
  esc18Chi,
  gridPoints,
} from "../src/kernel/theorem.js";
import {
  MAX_DEPTH,
  REFINE_FLOOR,
  REFINE_FLOOR_K3,
  certifyAdaptiveConvexity,
  certifyAdaptiveDescent,
  globalWallCertificates,
  wallSeeds,
} from "../src/kernel/globalwall.js";

/**
 * The hiding-dip counterfeit: the true F1 curve plus a narrow rational tent
 * centered at lambda0 = 21/40 — the EXACT midpoint of seed cell 10 — with
 * half-width s = 1/640 (support strictly inside the cell) and amplitude
 * w = 1/512. The tent is EXACTLY invisible to the v0.2.0 grid certificate
 * (it vanishes at every grid point, so the old checker passes it verbatim),
 * and it rises steeper than chi descends (w/s = 1.25 versus |chi'| < 0.05
 * there), so any cell inside the rising flank fails at EVERY depth — the
 * adaptive bisection chases it into the flank and convicts at runway
 * exhaustion. (An amplitude of 1/1024 hides below even the floor-1 cell's
 * total descent — the first draft's dip, caught only at floor 2: the
 * amplitude must sit between the finest certified descent and the seed gap.)
 */
const LAMBDA0 = fr(21, 40);
const TENT_S = fr(1, 640);
const TENT_W = fr(1, 512);

function tentAt(l: Frac): Frac {
  const left = fSub(LAMBDA0, l);
  if (fCmp(left, F_ZERO) > 0) {
    if (fCmp(left, TENT_S) >= 0) return F_ZERO;
    return fMul(fSub(TENT_S, left), fDiv(TENT_W, TENT_S));
  }
  const right = fSub(l, LAMBDA0);
  if (fCmp(right, TENT_S) >= 0) return F_ZERO;
  return fMul(fSub(TENT_S, right), fDiv(TENT_W, TENT_S));
}

const hidingDip = (l: Frac): Ivl => {
  const t = tentAt(l);
  const base = esc18Chi(l, PATH_T);
  return { lo: fAdd(base.lo, t), hi: fAdd(base.hi, t) };
};

describe("W7 the covering-partition certificate", () => {
  const wall = globalWallCertificates();

  it("the three families certify descent and convexity on both paths, covering the grid", () => {
    assert.ok(wall.ok, "the covering certificate must be green");
    for (const [fam, floor] of [
      [wall.esc18, REFINE_FLOOR],
      [wall.replacer, REFINE_FLOOR],
      [wall.k3, REFINE_FLOOR_K3],
    ] as const) {
      assert.ok(
        fam.descent.every((d) => d.ok),
        `${fam.family}: descent subdivision failed`,
      );
      assert.ok(
        fam.convex.every((c) => c.ok),
        `${fam.family}: convexity subdivision failed`,
      );
      assert.ok(
        fam.coversGrid,
        `${fam.family}: every grid point must be a partition point`,
      );
      assert.ok(
        fam.chainViaGridCertifier,
        `${fam.family}: the endpoint chain must re-verify through the v0.2.0 checker`,
      );
      assert.ok(
        fam.crossOverlapAll,
        `${fam.family}: both ln paths must agree at every partition point`,
      );
      assert.ok(
        fam.gapDominatesWidth,
        `${fam.family}: the min gap must dominate the enclosure slop`,
      );
      assert.ok(fam.maxDepthUsed >= floor);
      assert.equal(fam.partitionPoints, 20 * 2 ** floor + 1);
    }
    assert.ok(
      wall.esc18.citationMaxDist !== null,
      "F1 must carry the citation curvature cross",
    );
  });

  it("the discovered numbers are quoted honestly: machine values dominate the pinned floors", () => {
    // floors, pinned below what the machine discovered (witness asserts cert >= quote)
    const gapFloors: Array<[string, Frac]> = [
      ["esc18", wall.esc18.minGap!],
      ["replacer", wall.replacer.minGap!],
      ["k3", wall.k3.minGap!],
    ];
    const ddFloor = fr(1n, 20000000n); // 5e-8, below the smallest convexity margin discovered
    for (const [name, gap] of gapFloors) {
      assert.ok(
        fCmp(gap, fr(1n, 1000000n)) > 0,
        `${name}: min descent gap ${fDecimal(gap, 8)} must exceed the 1e-6 floor`,
      );
    }
    assert.ok(
      wall.esc18.minDD !== null &&
        wall.replacer.minDD !== null &&
        wall.k3.minDD !== null &&
        fCmp(wall.esc18.minDD, ddFloor) > 0 &&
        fCmp(wall.replacer.minDD, ddFloor) > 0 &&
        fCmp(wall.k3.minDD, ddFloor) > 0,
      "every family's min convexity gap must exceed the 5e-8 floor",
    );
    console.log(
      "globalwall discovered:",
      JSON.stringify({
        esc18Gap: fDecimal(wall.esc18.minGap!, 10),
        replacerGap: fDecimal(wall.replacer.minGap!, 10),
        k3Gap: fDecimal(wall.k3.minGap!, 10),
        esc18DD: fDecimal(wall.esc18.minDD, 12),
        replacerDD: fDecimal(wall.replacer.minDD, 12),
        k3DD: fDecimal(wall.k3.minDD, 12),
        maxWidth: fDecimal(wall.esc18.maxWidth, 24),
        esc18CitationMaxDist:
          wall.esc18.citationMaxDist !== null
            ? fDecimal(wall.esc18.citationMaxDist, 12)
            : null,
        maxDepthUsed: wall.esc18.maxDepthUsed,
      }),
    );
  });

  it("strict refinement: the covering partition's min gap is strictly finer than the v0.2.0 grid gap", () => {
    const grid = esc18Certificate();
    assert.ok(grid.minGap !== null && wall.esc18.minGap !== null);
    assert.ok(
      fCmp(grid.minGap, wall.esc18.minGap) > 0,
      "the floor-refined partition must certify a strictly smaller minimum gap",
    );
  });
});

describe("W8 the smuggling trials — counterfeit curves are chased and convicted by name", () => {
  it("the hiding dip is invisible to the v0.2.0 grid certificate and convicted by the subdivision", () => {
    // the tent vanishes at every grid point — the old certificate passes on the counterfeit
    for (const p of gridPoints())
      assert.ok(
        fIsZero(tentAt(p)),
        `tent must vanish at grid point ${fDecimal(p, 4)}`,
      );
    assert.ok(
      fCmp(tentAt(LAMBDA0), TENT_W) === 0,
      "the tent peaks at full amplitude at lambda0",
    );
    const blind = certifyStrictlyDecreasing(
      gridPoints().map((p) => hidingDip(p)),
    );
    assert.ok(
      blind.ok,
      "the v0.2.0 grid checker must be blind to the hiding dip (that is the point)",
    );
    // the subdivision chases it — this trial runs the machinery at floor 1 with a shorter
    // runway (the trial's object is the chase, not F1's production floor, whose cost W7 carries)
    const TRIAL_FLOOR = 1;
    const TRIAL_RUNWAY = 8;
    const sub = certifyAdaptiveDescent(
      hidingDip,
      wallSeeds(),
      TRIAL_FLOOR,
      TRIAL_RUNWAY,
    );
    assert.ok(!sub.ok, "the subdivision must convict the hiding dip");
    assert.ok(sub.convicted !== null, "the conviction is named");
    assert.equal(
      sub.convicted.depth,
      TRIAL_RUNWAY,
      "the forger used the whole runway",
    );
    assert.ok(
      fCmp(sub.convicted.b, LAMBDA0) <= 0,
      "the convicted cell's right end is at or left of the peak",
    );
    const flank = fSub(LAMBDA0, TENT_S);
    assert.ok(
      fCmp(sub.convicted.a, flank) >= 0,
      "the convicted cell is named inside the tent's rising flank",
    );
  });

  it("an everywhere-increasing curve is convicted at seed depth (zero budget — no runway)", () => {
    const rising = (l: Frac): Ivl => iOf(fDiv(l, fr(8)));
    const sub = certifyAdaptiveDescent(rising, wallSeeds(), 0, 0);
    assert.ok(!sub.ok && sub.convicted !== null);
    assert.equal(
      sub.convicted.depth,
      0,
      "the first seed cell already fails, and the budget is zero",
    );
    assert.equal(sub.convicted.seed, 0);
  });

  it("a concave curve is convicted by the convexity subdivision at seed depth", () => {
    const concave = (l: Frac): Ivl => {
      // chi(l) = l(1-l)/4 — strictly concave on [0,1], zero at both endpoints
      const v = fDiv(fMul(l, fSub(F_ONE, l)), fr(4));
      return iOf(v);
    };
    const sub = certifyAdaptiveConvexity(concave, wallSeeds(), 0, 0);
    assert.ok(!sub.ok && sub.convicted !== null);
    assert.equal(sub.convicted.depth, 0);
    assert.ok(
      fCmp(sub.convicted.gap, F_ZERO) < 0,
      "the concave cell's gap is strictly negative",
    );
  });

  it("degenerate budgets are refused by description (house style)", () => {
    const chi = (l: Frac): Ivl => esc18Chi(l, PATH_T);
    assert.throws(
      () => certifyAdaptiveDescent(chi, [], REFINE_FLOOR, MAX_DEPTH),
      /no seed cells/,
    );
    assert.throws(
      () => certifyAdaptiveDescent(chi, wallSeeds(), -1, MAX_DEPTH),
      /depth budget/,
    );
    assert.throws(
      () => certifyAdaptiveDescent(chi, wallSeeds(), MAX_DEPTH + 1, MAX_DEPTH),
      /depth budget/,
    );
  });
});
