import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RefusalError } from "../src/core/errors.js";
import {
  type Frac,
  type Ivl,
  F_HALF,
  F_ONE,
  F_ZERO,
  fAdd,
  fCmp,
  fDecimal,
  fSub,
  fr,
  frDec,
  iAdd,
  iOf,
  iOverlap,
} from "../src/kernel/rational.js";
import {
  certifyStrictlyIncreasing,
  monoGridPoints,
  netClosedIvl,
  netSeriesIvl,
} from "../src/kernel/theorem.js";
import {
  type Cell,
  certifyDerivSubdivision,
  certifyGlobalMonotone,
  incrMargin,
  marginUnderData,
  netPowerIvl,
  netPrimeCellLower,
  QUOTED_GLOBAL_ANCHOR_GAP,
  QUOTED_GLOBAL_MAX_POWER_WIDTH,
  QUOTED_GLOBAL_MIN_MARGIN,
  QUOTED_GLOBAL_MIN_POWER_GAP,
} from "../src/kernel/global.js";

/** Run `fn`, demand a RefusalError, return its code — the conviction is by name. */
function codeOf(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof RefusalError, `expected a RefusalError, got ${String(e)}`);
    return e.code;
  }
  assert.fail("expected a refusal that never came");
}

/** The 19 derivative seeds [i/20, (i+1)/20], i = 1..19 (the last reaches b = 1). */
function derivSeeds(): Cell[] {
  const seeds: Cell[] = [];
  for (let i = 1; i <= 19; i++) seeds.push({ a: fr(i, 20), b: fr(i + 1, 20) });
  return seeds;
}

describe("G1 the power-series leg (the series path re-indexed in p)", () => {
  it("the p-form closes on both existing paths at every grid point and at off-grid samples", () => {
    for (const p of monoGridPoints().filter((x) => fCmp(x, F_ONE) !== 0)) {
      assert.ok(iOverlap(netPowerIvl(p), netClosedIvl(p)), `power vs closed disjoint at p = ${fDecimal(p, 4)}`);
      assert.ok(iOverlap(netPowerIvl(p), netSeriesIvl(p)), `power vs series disjoint at p = ${fDecimal(p, 4)}`);
    }
    for (const p of [fr(1, 7), fr(13, 40), fr(37, 50)]) {
      assert.ok(iOverlap(netPowerIvl(p), netClosedIvl(p)), `off-grid power vs closed disjoint at p = ${fDecimal(p, 4)}`);
      assert.ok(iOverlap(netPowerIvl(p), netSeriesIvl(p)), `off-grid power vs series disjoint at p = ${fDecimal(p, 4)}`);
    }
  });

  it("the exact anchor p = 0 returns [0,0] and p >= 1 is refused — the honest exclusion", () => {
    assert.equal(fCmp(netPowerIvl(F_ZERO).lo, F_ZERO), 0);
    assert.equal(fCmp(netPowerIvl(F_ZERO).hi, F_ZERO), 0); // every series term is 0 — no limit trick needed
    assert.equal(codeOf(() => netPowerIvl(F_ONE)), "GLOBAL_NETPOWER_DOMAIN"); // 1 - p^2 = 0 in the tail denominator
    assert.equal(codeOf(() => netPowerIvl(fr(6, 5))), "GLOBAL_NETPOWER_DOMAIN");
    assert.equal(codeOf(() => netPowerIvl(fr(-1, 5))), "GLOBAL_NETPOWER_DOMAIN");
  });
});

describe("G2 the gap-free pair certificate (the theorem half)", () => {
  it("strictly increasing on ALL of [0,1): exact margins for arbitrary rational pairs at any scale", () => {
    // the adversarial pairs: a close interior pair no grid could separate, a
    // near-zero pair whose increment is nineteen orders below float sight
    const closeP2 = fAdd(fr(1, 3), fr(1n, 10n ** 12n));
    assert.ok(fCmp(incrMargin(fr(1, 3), closeP2), F_ZERO) > 0);
    const tiny = incrMargin(F_ZERO, fr(1n, 10n ** 12n));
    assert.ok(fCmp(tiny, F_ZERO) > 0, "the (0, 10^-12) margin must be strictly positive by exact algebra");
    assert.ok(fCmp(tiny, frDec("3.6e-25")) > 0 && fCmp(tiny, frDec("3.7e-25")) < 0); // the quoted scale
    assert.ok(fCmp(incrMargin(F_ZERO, F_HALF), F_ZERO) > 0);
  });

  it("the full certificate is green with the quoted floors and ceilings", () => {
    const c = certifyGlobalMonotone();
    assert.ok(c.ok, "gap-free certificate failed");
    assert.equal(c.cells.length, 19); // [0,1) partitioned; (19/20,1] carries the anchor gap
    assert.equal(c.cells[0]!.leg, "INCREMENT"); // negLn refuses r = 1 at a = 0 — the honest split
    assert.ok(c.cells.every((x) => x.leg === "DERIVATIVE" || x === c.cells[0]));
    assert.ok(fCmp(c.minMargin, frDec(QUOTED_GLOBAL_MIN_MARGIN)) >= 0);
    assert.ok(fCmp(c.anchorPairGap, frDec(QUOTED_GLOBAL_ANCHOR_GAP)) >= 0);
    let minPowerGap = c.powerGaps[0]!;
    for (const g of c.powerGaps) if (fCmp(g, minPowerGap) < 0) minPowerGap = g;
    assert.ok(fCmp(minPowerGap, frDec(QUOTED_GLOBAL_MIN_POWER_GAP)) >= 0); // T6 re-derived on the third path
    assert.ok(fCmp(c.maxPowerWidth, frDec(QUOTED_GLOBAL_MAX_POWER_WIDTH)) <= 0);
    assert.ok(c.derivUnderData); // every citation bound x width stays under the data
  });

  it("the true margins stay under the data — the anti-inflation gate passes honestly", () => {
    const c = certifyGlobalMonotone();
    for (const cell of c.cells) {
      assert.ok(cell.marginOk, `margin exceeded the data at cell [${fDecimal(cell.a, 4)}, ${fDecimal(cell.b, 4)}]`);
      assert.ok(marginUnderData(cell.margin, cell.a, cell.b));
    }
  });
});

describe("G3 the adaptive subdivision machinery (subinterval queue + bisection)", () => {
  it("the true curve's cells certify at depth 0 — the left-endpoint bound suffices on (0,1]", () => {
    const r = certifyDerivSubdivision(netPrimeCellLower, derivSeeds(), 6);
    assert.ok(r.ok);
    assert.equal(r.certified, 19);
    assert.equal(r.maxDepthUsed, 0); // honest: net' > 0 on any [a,b] with a > 0; the bisection is armed for liars
    assert.ok(r.convicted === null);
  });

  it("a coarse-but-honest bound is rescued by refinement (the bisection terminates)", () => {
    // a crude bound that certifies nothing wider than 1/100: the seed
    // bisects three times (1/20 -> 1/40 -> 1/80 -> 1/160 < 1/100), then all 8 leaves certify
    const coarse = (a: Frac, b: Frac): Frac => {
      if (fCmp(fSub(b, a), fr(1, 100)) < 0) return netPrimeCellLower(a, b);
      return F_ZERO; // honest refusal to certify — not a lie
    };
    const r = certifyDerivSubdivision(coarse, derivSeeds().slice(0, 1), 6);
    assert.ok(r.ok);
    assert.equal(r.certified, 8); // 2^3 leaves from one seed
    assert.equal(r.maxDepthUsed, 3);
  });

  it("a hidden derivative dip is run down by the bisection and convicted at named depth", () => {
    // the smuggler's curve: honest bounds everywhere except a dip hidden in
    // (0.47, 0.53) — any cell intersecting the window carries the dip's
    // (negative) true bound. Coarse cells over the window fail, children
    // keep failing until the depth budget runs out: CONVICTED, by name.
    const dipLo = frDec("0.47");
    const dipHi = frDec("0.53");
    const intersects = (a: Frac, b: Frac): boolean => fCmp(a, dipHi) < 0 && fCmp(dipLo, b) < 0;
    const liar = (a: Frac, b: Frac): Frac => (intersects(a, b) ? fr(-1, 100) : netPrimeCellLower(a, b));
    const r = certifyDerivSubdivision(liar, derivSeeds(), 4);
    assert.ok(!r.ok, "the hidden dip must be convicted");
    const cc = r.convicted!;
    assert.ok(cc !== null);
    assert.ok(fCmp(cc.bound, F_ZERO) <= 0, "the conviction carries the nonpositive bound that named it");
    assert.equal(cc.depth, 4); // the forger's runway is on the record
    assert.ok(cc.seed === 8 || cc.seed === 9, "the convicted cell descends from the seeds covering (0.45, 0.55)"); // [9/20,10/20] and [10/20,11/20]
    assert.ok(fCmp(cc.b, fr(9, 20)) > 0 && fCmp(cc.a, fr(11, 20)) < 0); // named inside the smuggling window's span
  });
});

describe("G4 smuggling trials — the gap-free face", () => {
  it("a forged gap-free table (anchor-clean dip at p = 1/2) is named by certifyStrictlyIncreasing", () => {
    // the forger dips the POWER-path table by 1/25 at exactly p = 10/20:
    // anchors 0 and 20 untouched (the forgery looks scheduled), every other
    // gap still increases — the pair (9/20 -> 10/20) goes negative
    const pts = monoGridPoints().filter((x) => fCmp(x, F_ONE) !== 0); // 0..19/20 on the power path
    const table: Ivl[] = pts.map((p) =>
      fCmp(p, fr(1, 2)) === 0 ? iAdd(netPowerIvl(p), iOf(fr(-1, 25))) : netPowerIvl(p),
    );
    const forged = [...table, iOf(F_HALF)]; // ...and the exact 1/2 anchor at p = 1 kept pristine
    assert.equal(fCmp(forged[0]!.lo, F_ZERO), 0); // anchors intact — the forgery looks scheduled
    assert.equal(fCmp(forged[20]!.lo, F_HALF), 0);
    const r = certifyStrictlyIncreasing(forged);
    assert.ok(!r.ok, "the forged gap-free table must be rejected");
    assert.equal(r.firstFailure, 9); // the checker NAMES the pair (9/20 -> 10/20)
    assert.ok(r.minGap === null); // no margin is minted for contraband
  });

  it("an inflated gap-free margin is convicted by the data gate", () => {
    // the forger claims net(2/20) - net(1/20) >= 0.05; the cross-path
    // enclosures cap the true increment at ~0.00271 — the claim contradicts
    // the data, the gate names it, while the true margin passes
    const p1 = fr(1, 20);
    const p2 = fr(1, 10);
    assert.ok(!marginUnderData(fr(1, 20), p1, p2), "the inflated margin must die at the data gate");
    assert.ok(marginUnderData(incrMargin(p1, p2), p1, p2), "the true margin must pass");
    const upper = fSub(netPowerIvl(p2).hi, netClosedIvl(p1).lo);
    assert.ok(fCmp(upper, frDec("0.00271")) > 0 && fCmp(upper, frDec("0.00272")) < 0); // the cap, quoted
  });

  it("degenerate inputs are refused by name", () => {
    assert.equal(codeOf(() => incrMargin(F_HALF, F_HALF)), "GLOBAL_PAIR_ORDER"); // no increment to certify
    assert.equal(codeOf(() => incrMargin(fr(3, 4), F_HALF)), "GLOBAL_PAIR_ORDER");
    assert.equal(codeOf(() => incrMargin(F_ONE, fr(3, 2))), "GLOBAL_PAIR_DOMAIN");
    assert.equal(codeOf(() => netPrimeCellLower(F_ZERO, F_HALF)), "GLOBAL_NETPRIME_DOMAIN"); // a = 0: negLn refuses r = 1
    assert.equal(codeOf(() => netPrimeCellLower(fr(1, 2), fr(11, 10))), "GLOBAL_NETPRIME_DOMAIN"); // b > 1
    assert.equal(codeOf(() => netPrimeCellLower(fr(1, 2), fr(1, 4))), "GLOBAL_NETPRIME_DOMAIN"); // a >= b
    assert.equal(codeOf(() => certifyDerivSubdivision(netPrimeCellLower, [], 6)), "GLOBAL_EMPTY_SEEDS"); // a certificate of nothing certifies nothing
  });
});
