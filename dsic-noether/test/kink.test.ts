import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  pAssertZero,
  pEval,
  pIsZero,
  pSub,
  rCmp,
  rStr,
  rSub,
  rat,
  type Rat,
} from "../src/continuum/poly.js";
import * as k from "../src/continuum/kink.js";

describe("T10 jump regime: the second-price kink as two polynomial patches", () => {
  it("per-patch [E]: the envelope residual is the zero polynomial on BOTH open patches", () => {
    const { win, lose } = k.secondPricePatches();
    pAssertZero(k.patchEnvelopeResidual(win), "[E] winning patch");
    pAssertZero(k.patchEnvelopeResidual(lose), "[E] losing patch");
  });

  it("per-patch [G]: p + W_-i(x) = the pivot w on BOTH patches — Groves piecewise with a COMMON gauge", () => {
    const { win, lose } = k.secondPricePatches();
    pAssertZero(k.patchGrovesResidual(win), "[G] winning patch");
    pAssertZero(k.patchGrovesResidual(lose), "[G] losing patch");
  });

  it("per-patch [I]: the gauge readoff is clean (no own-report monomials) on both patches", () => {
    const { win, lose } = k.secondPricePatches();
    assert.ok(k.patchReadoff(win).clean, "winning patch readoff leaked s");
    assert.ok(k.patchReadoff(lose).clean, "losing patch readoff leaked s");
  });

  it("the gluing identity [u] = t*[x] - [p] holds with [x] = 1, [p] = w, [u] = t - w, exact", () => {
    for (const [t, w] of [
      [rat(7, 10), rat(1, 2)],
      [rat(2, 5), rat(1, 2)],
      [rat(5, 8), rat(3, 8)],
    ] as ReadonlyArray<readonly [Rat, Rat]>) {
      const j = k.kinkJumps(t, w);
      assert.equal(rCmp(j.jumpX, rat(1)), 0, `[x] ${rStr(j.jumpX)}`);
      assert.equal(rCmp(j.jumpP, w), 0, `[p] ${rStr(j.jumpP)}`);
      assert.equal(rCmp(j.jumpU, rSub(t, w)), 0, `[u] ${rStr(j.jumpU)}`);
      assert.ok(j.ok, `gluing residual ${rStr(j.gluingResidual)}`);
    }
  });

  it("across-kink [I] (the Milgrom-Segal envelope): U(t1) - U(t0) equals the exact measure above w, crossing or not", () => {
    const pairs: ReadonlyArray<readonly [Rat, Rat, Rat]> = [
      [rat(2, 5), rat(4, 5), rat(1, 2)], // crossing
      [rat(1, 20), rat(9, 20), rat(1, 2)], // below
      [rat(11, 20), rat(49, 50), rat(1, 2)], // above
      [rat(4, 5), rat(2, 5), rat(1, 2)], // crossing, reversed
    ];
    for (const [t0, t1, w] of pairs) {
      const e = k.acrossKinkEnvelope(t0, t1, w);
      assert.ok(e.ok, `(${rStr(t0)}, ${rStr(t1)}) vs w=${rStr(w)}: ${rStr(e.uDiff)} != ${rStr(e.integral)}`);
    }
  });

  it("the charge's one-sided limits at the kink are priced exactly, with the SIGNED win-side limit", () => {
    const winner = k.chargeOneSided(rat(7, 10), rat(1, 2));
    assert.equal(rCmp(winner.fromWin, rat(0)), 0, rStr(winner.fromWin));
    assert.equal(rCmp(winner.fromLose, rat(-1, 5)), 0, rStr(winner.fromLose));
    assert.ok(winner.dsicAcross);
    const loser = k.chargeOneSided(rat(2, 5), rat(1, 2));
    assert.equal(rCmp(loser.fromWin, rat(-1, 10)), 0, `win-side ${rStr(loser.fromWin)}`);
    assert.equal(rCmp(loser.fromLose, rat(0)), 0, rStr(loser.fromLose));
    assert.ok(loser.dsicAcross);
  });

  it("SMUGGLING TRIAL: first price passes the kink gluing identity but is convicted ON THE PATCH (residual exactly -1)", () => {
    const t = rat(7, 10);
    const w = rat(1, 2);
    const fp = k.firstPriceComposite(t, w);
    assert.equal(rCmp(fp.gluingResidual, rat(0)), 0, "gluing unexpectedly failed — the counterfeit would then be trivial");
    assert.ok(fp.convicted, "the composite checker must convict");
    // the named crime: the winning-patch envelope residual is the constant -1
    const res = fp.winPatchResidual;
    assert.ok(!pIsZero(res), "residual vanished");
    const at = pEval(res, [w, t, w]);
    assert.equal(rCmp(at, rat(-1)), 0, `residual ${rStr(at)} != -1`);
    assert.throws(() => {
      pAssertZero(res, "first-price winning-patch envelope");
    }, /FAILED/);
  });

  it("SMUGGLING TRIAL: all-pay is convicted on the LOSING patch (residual exactly -1) even though x is constant there", () => {
    const { lose } = k.allPayPatches();
    const res = k.patchEnvelopeResidual(lose);
    assert.ok(!pIsZero(res), "residual vanished");
    const at = pEval(res, [rat(1, 2), rat(7, 10), rat(1, 2)]);
    assert.equal(rCmp(at, rat(-1)), 0, `residual ${rStr(at)} != -1`);
    assert.throws(() => {
      pAssertZero(res, "all-pay losing-patch envelope");
    }, /FAILED/);
  });
});

describe("T10 continuity regime: the capacity wall of the quadratic family (types widened to [1/2, 5/2])", () => {
  it("the interior patch (NONCONSTANT rule) and the wall patch both carry the chain: [E] and [G] zero polynomials", () => {
    const inside = k.wallInteriorPatch();
    const walled = k.wallWallPatch();
    assert.ok(!pIsZero(inside.x), "interior rule unexpectedly constant — the test would be vacuous");
    pAssertZero(k.wallEnvelopeResidual(inside), "[E] interior patch");
    pAssertZero(k.wallEnvelopeResidual(walled), "[E] wall patch");
    pAssertZero(k.wallGrovesResidual(inside), "[G] interior patch");
    pAssertZero(k.wallGrovesResidual(walled), "[G] wall patch");
  });

  it("the interior-patch [I] readoff (nontrivial integrand) is clean of own-report monomials", () => {
    const r = k.wallGaugeReadoff();
    assert.ok(r.clean, "the wall readoff leaked own-report monomials");
  });

  it("gluing at s* = w - 1: x, p, and the CHARGE are continuous (zero polynomials, w symbolic)", () => {
    const g = k.wallGluing();
    pAssertZero(g.xJump, "x jump at the wall kink");
    pAssertZero(g.pJump, "p jump at the wall kink");
    pAssertZero(g.chargeJump, "charge jump at the wall kink");
    assert.ok(g.continuous);
  });

  it("the charge's FLUX jumps at the kink by exactly (t - w + 1)/2 — the surface term", () => {
    const fj = k.wallFluxJump();
    assert.ok(!pIsZero(fj.jump), "the flux jump vanished — continuity regime would be mislabeled");
    pAssertZero(pSub(fj.jump, fj.expected), "flux jump == (t-w+1)/2");
    assert.ok(fj.ok);
  });

  it("the piecewise charge blocks: -(s-t)^2/4 interior, 0 wall-to-wall, -(t-w+1)^2/4 cross", () => {
    const b = k.wallChargeBlocks();
    pAssertZero(pSub(b.interior, b.interiorClosedForm), "interior block");
    pAssertZero(b.wallBlock, "wall-to-wall block is identically zero (the weak-DSIC flat)");
    pAssertZero(pSub(b.crossBlock, b.crossClosedForm), "cross block");
    assert.ok(b.allOk);
  });

  it("grid witness, honest about the flat: never positive; strictly negative off-diagonal on both strict blocks; the wall-to-wall zeros are counted", () => {
    const g = k.wallGridWitness(rat(5, 2), 8);
    assert.equal(rCmp(g.worst, rat(0)), 0, `worst ${rStr(g.worst)} > 0`);
    assert.ok(rCmp(g.worstInteriorOff, rat(0)) < 0, rStr(g.worstInteriorOff));
    assert.ok(rCmp(g.worstCross, rat(0)) < 0, rStr(g.worstCross));
    assert.ok(g.flatPairs > 0, "the weak-DSIC flat was not observed (witness degenerate)");
  });
});
