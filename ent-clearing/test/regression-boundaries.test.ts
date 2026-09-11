import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mat } from "../src/core/cmat.js";
import { maximallyMixed } from "../src/core/states.js";
import {
  concurrence,
  eF,
  h2,
  h2ViaLn,
  netWeakCoin,
  redeem,
} from "../src/kernel/clearing.js";
import {
  bellRoundClosedForm,
  hashingLineWerner,
  wernerRoundClosedForm,
} from "../src/kernel/purify.js";

describe("regression: named refusals on degenerate and out-of-domain input (no silent NaN/garbage)", () => {
  it("h2 and h2ViaLn refuse NaN by name instead of silently returning 0", () => {
    // convicted: h2(NaN) used to fall through the range check and return 0
    assert.throws(() => h2(Number.NaN), /EC_H2_RANGE/);
    assert.throws(() => h2ViaLn(Number.NaN), /EC_H2_RANGE/);
    // the in-range clamps still behave: eigensolver-scale noise at the
    // endpoints clamps to exactly 0, not a throw and not a NaN
    assert.strictEqual(h2(-1e-13), 0);
    assert.strictEqual(h2(1 + 1e-13), 0);
    assert.strictEqual(h2ViaLn(-1e-13), 0);
    assert.strictEqual(h2ViaLn(1 + 1e-13), 0);
  });

  it("concurrence and eF refuse non-4x4 states with a clear EC_SHAPE at the boundary", () => {
    // convicted: a wrong-dimension state used to surface as an opaque
    // "mMul cannot multiply 4x4 by 2x2" from deep inside spinFlip
    const two = maximallyMixed(2);
    assert.throws(() => concurrence(two), /EC_SHAPE: concurrence is defined on 2-qubit/);
    assert.throws(() => eF(two), /EC_SHAPE: concurrence is defined on 2-qubit/);
    const big = mat(8, 8);
    for (let i = 0; i < 8; i++) big.re[i * 8 + i] = 1 / 8;
    assert.throws(() => concurrence(big), /EC_SHAPE: concurrence is defined on 2-qubit/);
  });

  it("netWeakCoin(1/2) returns a finite zero-matrix fail branch, never NaN", () => {
    // convicted: the probability-zero fail branch used to be 0 * Infinity = NaN
    const nt = netWeakCoin(0.5);
    assert.ok(nt.pFail <= 1e-15, "the standard coin has no failure branch");
    for (let k = 0; k < nt.failState.re.length; k++) {
      assert.ok(Number.isFinite(nt.failState.re[k]!), `failState.re[${k}] must be finite`);
      assert.strictEqual(nt.failState.re[k]!, 0);
      assert.ok(Number.isFinite(nt.failState.im[k]!), `failState.im[${k}] must be finite`);
    }
    // the guard-compatible contract still holds one grade below the boundary
    const near = netWeakCoin(0.49);
    assert.ok(Math.abs(near.pSucc + near.pFail - 1) <= 1e-12);
    assert.ok(Array.from(near.failState.re).every(Number.isFinite));
  });

  it("redeem refuses a non-qubit payload by name at the boundary", () => {
    const four = maximallyMixed(4);
    assert.throws(() => redeem(four), /EC_SHAPE: redeem needs a 1-qubit/);
  });

  it("bellRoundClosedForm refuses the probability-zero keep branch like the machine round does", () => {
    // convicted: spectra concentrated on opposite x-blocks used to divide by
    // zero and hand back NaN weights
    assert.throws(
      () => bellRoundClosedForm([0.5, 0.5, 0, 0], [0, 0, 0.5, 0.5]),
      /EC_ZERO_BRANCH/,
    );
  });

  it("wernerRoundClosedForm and hashingLineWerner refuse out-of-domain F by name", () => {
    assert.throws(() => wernerRoundClosedForm(0), /EC_F_RANGE/);
    assert.throws(() => wernerRoundClosedForm(1), /EC_F_RANGE/);
    assert.throws(() => wernerRoundClosedForm(1.5), /EC_F_RANGE/);
    assert.throws(() => hashingLineWerner(0), /EC_F_RANGE/);
    assert.throws(() => hashingLineWerner(1), /EC_F_RANGE/);
    assert.throws(() => hashingLineWerner(Number.NaN), /EC_F_RANGE/);
  });
});
