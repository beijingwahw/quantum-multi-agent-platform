import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  type Frac,
  type Ivl,
  F_HALF,
  F_ONE,
  F_ZERO,
  fAdd,
  fCmp,
  fDecimal,
  fMul,
  fSub,
  fr,
  frDec,
  iAdd,
  iOf,
  iOverlap,
  h2Closed,
  h2Series,
  LN2,
  negLn,
} from "../src/kernel/rational.js";
import {
  certifyConvexGrid,
  certifyStrictlyIncreasing,
  convexityCertificate,
  monoCertificate,
  monoGridPoints,
  netClosedIvl,
  MONO_GRID_N,
} from "../src/kernel/theorem.js";
import {
  QUOTED_MONO_MIN_GAP,
  QUOTED_MONO_MAX_WIDTH,
  QUOTED_CONVEX_MIN_DD,
  QUOTED_DERIV_MAX_DIST,
  QUOTED_SECOND_DERIV_MAX_DIST,
} from "../src/kernel/ledger.js";

describe("M1 the exact rational kernel", () => {
  it("rational comparisons are exact where floats would already lie", () => {
    // 0.1 + 0.2 === 0.3 in rationals; in floats it is not
    assert.equal(fCmp(fAdd(fr(1, 10), fr(2, 10)), fr(3, 10)), 0);
    assert.equal(fCmp(fMul(fr(1, 3), fr(3)), F_ONE), 0);
    assert.notEqual(0.1 + 0.2, 0.3); // the float world the certificate does NOT live in
  });

  it("the ln2 enclosure is tight and the reduction -ln(1/2) = ln2 closes on it", () => {
    assert.ok(fCmp(LN2.lo, frDec("0.6931")) > 0 && fCmp(LN2.hi, frDec("0.6932")) < 0);
    assert.ok(iOverlap(negLn(F_HALF), LN2)); // the same transcendental on two derivations
  });

  it("the two h2 paths enclose a common value across the grid's q range", () => {
    for (const q of [fr(1, 40), fr(1, 4), fr(39, 40)]) {
      assert.ok(iOverlap(h2Closed(q), h2Series(q)), `paths disjoint at q = ${fDecimal(q, 4)}`);
    }
  });
});

describe("M2 the monotonicity certificate (the interior theorem)", () => {
  it("strictly increasing on the grid family, both paths, with the quoted margins", () => {
    const c = monoCertificate();
    assert.ok(c.ok, "certificate failed");
    assert.ok(c.closed.ok && c.series.ok && c.crossOverlapAll);
    assert.equal(c.gaps.length, MONO_GRID_N);
    assert.ok(fCmp(c.closed.minGap ?? F_ZERO, frDec(QUOTED_MONO_MIN_GAP)) >= 0);
    assert.ok(fCmp(c.series.minGap ?? F_ZERO, frDec(QUOTED_MONO_MIN_GAP)) >= 0);
    assert.ok(fCmp(c.maxWidth, frDec(QUOTED_MONO_MAX_WIDTH)) <= 0);
  });

  it("the honest exclusions hold: series refuses q=0, closed form carries the endpoints", () => {
    assert.throws(() => h2Series(F_ZERO)); // d = 1: the series diverges — refused, not fudged
    assert.equal(fCmp(h2Closed(F_ZERO).lo, F_ZERO), 0);
    assert.equal(fCmp(h2Closed(F_ZERO).hi, F_ZERO), 0);
    assert.equal(fCmp(h2Closed(F_HALF).lo, F_ONE), 0); // h2(1/2) = 1 exact
  });
});

describe("M3 the convexity / inflection face", () => {
  it("grid second differences certified positive; no inflection cell named", () => {
    const c = convexityCertificate();
    assert.ok(c.ok, "convexity certificate failed");
    assert.ok(c.convex.ok && c.quotientsPositive && c.formulaPositive && c.secondFormulaPositive);
    assert.equal(c.inflectionCells.length, 0);
    assert.ok(fCmp(c.minDD ?? F_ZERO, frDec(QUOTED_CONVEX_MIN_DD)) >= 0);
  });

  it("the citation formula is verified as data within the quoted agreement", () => {
    const c = convexityCertificate();
    assert.ok(fCmp(c.derivMaxDist, frDec(QUOTED_DERIV_MAX_DIST)) <= 0);
    assert.ok(fCmp(c.secondDerivMaxDist, frDec(QUOTED_SECOND_DERIV_MAX_DIST)) <= 0);
  });
});

describe("M4 smuggling trials — counterfeit certificates are named and rejected", () => {
  it("a counterfeit monotonicity certificate on an anchor-preserving non-monotone perturbation", () => {
    // bump(p) = (1/16) * 4 * p(1-p) * (3 - 16 p(1-p)): vanishes exactly at the
    // anchors 0 and 1 (the forger keeps the anchor rows pristine) but dips
    // harder than net rises just past p = 0.15 — genuinely non-monotone
    const bump = (p: Frac): Frac => {
      const u = fMul(p, fSub(F_ONE, p));
      return fMul(fr(1, 16), fMul(fr(4), fMul(u, fSub(fr(3), fMul(fr(16), u)))));
    };
    assert.equal(fCmp(bump(F_ZERO), F_ZERO), 0); // anchors intact — the forgery looks scheduled
    assert.equal(fCmp(bump(F_ONE), F_ZERO), 0);
    const table: Ivl[] = monoGridPoints().map((p) => iAdd(netClosedIvl(p), iOf(bump(p))));
    const r = certifyStrictlyIncreasing(table);
    assert.ok(!r.ok, "the counterfeit certificate must be rejected");
    assert.equal(r.firstFailure, 3); // the checker NAMES the pair (p = 3/20 -> 4/20)
    assert.ok(r.minGap === null); // no margin is minted for contraband
  });

  it("a fake inflection table: monotone, anchor-clean, and caught only by the convexity gate", () => {
    // +1/400 spiked at exactly one interior point (p = 3/20): every adjacent
    // gap still increases (the real gaps there exceed 0.0045), the anchors
    // are untouched — but Delta^2 at cell 3 drops by 2/400 into the negative
    const table: Ivl[] = monoGridPoints().map((p) =>
      fCmp(p, fr(3, 20)) === 0 ? iAdd(netClosedIvl(p), iOf(fr(1, 400))) : netClosedIvl(p),
    );
    const mono = certifyStrictlyIncreasing(table);
    const conv = certifyConvexGrid(table);
    assert.ok(mono.ok, "the forgery must pass the monotonicity gate — that is the trap");
    assert.ok(!conv.ok, "the convexity checker must reject the fake inflection table");
    assert.equal(conv.firstFailure, 3); // the cell is named: p = 2/20, 3/20, 4/20
  });

  it("a counterfeit twin path: claims 1e-12 agreement, shifted 1e-18 — beyond float sight, not exact sight", () => {
    const q = fr(1, 4);
    const real = h2Series(q);
    const shift = frDec("1e-18");
    const lyingTwin: Ivl = { lo: fAdd(real.lo, shift), hi: fAdd(real.hi, shift) };
    assert.ok(iOverlap(h2Closed(q), real)); // the honest series closes on the closed form
    assert.ok(!iOverlap(h2Closed(q), lyingTwin)); // the forgery is named by the overlap gate
  });
});
