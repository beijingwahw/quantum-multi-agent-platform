import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mat, mAdd } from "../src/core/cmat.js";
import { applyKraus, filterBasisDigit } from "../src/core/channels.js";
import { traceDistance } from "../src/core/measures.js";
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

  it("filterBasisDigit refuses a dims product that misses the matrix (was: silent misdecomposed digits)", () => {
    // convicted: a 4x4 state against dims [2] decomposes digits that do not
    // exist — the filter silently kept the even-indexed cells and returned a
    // plausible-looking conditional instead of an error (the exact class the
    // sibling guards partialTrace/partialTranspose/marginalProbs already carry)
    const four = maximallyMixed(4);
    assert.throws(() => filterBasisDigit(four, [2], 0, 0), /EC_DIMS_MISMATCH: filterBasisDigit/);
    assert.throws(() => filterBasisDigit(four, [2, 4], 0, 0), /EC_DIMS_MISMATCH: filterBasisDigit/);
    // legal neighbor pin: the matching dims still filter exactly — the kept
    // block of I/4 (p = 1/2 over the digit-0 cell) conditionally becomes I/2
    // on the {0,1} x {0,1} corner of the 4x4 conditional (flat 0 and 5)
    const { p, conditional } = filterBasisDigit(four, [2, 2], 0, 0);
    assert.ok(Math.abs(p - 0.5) <= 1e-15);
    assert.ok(Math.abs(conditional.re[0]! + conditional.re[5]! - 1) <= 1e-15);
    assert.strictEqual(conditional.re[2]!, 0);
  });

  it("mAdd refuses mismatched shapes by name; traceDistance inherits the refusal", () => {
    // convicted: traceDistance(2x2, 4x4) built a plausible distance from the
    // first four cells of the larger state — mMul refuses the same by name
    const two = maximallyMixed(2);
    const four = maximallyMixed(4);
    assert.throws(() => mAdd(two, four), /EC_SHAPE: mAdd cannot add 2x2 to 4x4/);
    assert.throws(() => traceDistance(two, four), /EC_SHAPE: mAdd/);
    // legal neighbor pin: equal shapes still add exactly, and the distance of
    // a state from itself stays the exact 0
    const sum = mAdd(two, two);
    assert.strictEqual(sum.re[0]!, 1);
    assert.strictEqual(traceDistance(two, two), 0);
  });

  it("applyKraus refuses a Kraus operator whose output dimension misses the state", () => {
    // convicted: a 1x2 Kraus on a 2x2 state passed the inner mMul shape check,
    // then read past its own cells while accumulating — a NaN state that
    // looked built
    const two = maximallyMixed(2);
    const K = mat(1, 2);
    K.re[0] = 1;
    assert.throws(() => applyKraus(two, [K]), /EC_SHAPE: applyKraus needs every Kraus operator 2x2, got 1x2/);
    // legal neighbor pin: the identity Kraus still returns the state exactly
    const I2 = mat(2, 2);
    I2.re[0] = 1;
    I2.re[3] = 1;
    const out = applyKraus(two, [I2]);
    for (let k = 0; k < out.re.length; k++) {
      assert.strictEqual(out.re[k]!, two.re[k]!);
      assert.strictEqual(out.im[k]!, 0);
    }
  });
});
