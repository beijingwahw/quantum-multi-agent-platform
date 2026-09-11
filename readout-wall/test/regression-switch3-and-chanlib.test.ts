import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { branchIsometry3, switch3 } from "../src/kernel/kswitch3.js";
import { krausToStinespring, type Stinespring } from "../src/switch/isometry.js";
import { completelyDepolarizingKraus, randomChannelStinespring } from "../src/switch/chanlib.js";
import { makeRng } from "../src/core/rng.js";
import { RefusalError } from "../src/core/errors.js";
import { identity, mat, matEq, mDagger, mMul, type CMat } from "../src/core/cmat.js";

/** Run `fn`, expect a RefusalError, return its code — shared idiom with T7/T8. */
function refusalCode(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof RefusalError, `expected a RefusalError, got ${String(e)}`);
    return e.code;
  }
  assert.fail("expected a refusal, none was raised");
}

/**
 * Regression: the k=3 builders and the random-channel family.
 *
 * Before the guards: branchIsometry3 (an exported builder with NO final
 * isometry certificate) read past V's end on mismatched target dims or a
 * malformed dilation buffer — undefined entries surfacing as NaN columns in
 * 48 of 256 entries on the probe fixture, silently. A four-channel list was
 * silently truncated to three (the refusal message always said "exactly
 * three"). krausToStinespring([]) dilated to a 0-dimensional "channel" that
 * passed every vacuous check. And randomChannelStinespring returned without
 * the isometry certificate its own comment claimed — the exact slip the
 * two-box path (krausToStinespring) had been asserting all along.
 */
describe("R2 the k=3 builders and chanlib refuse degenerate input by name", () => {
  const d2 = krausToStinespring(completelyDepolarizingKraus(2));
  const d3 = krausToStinespring(completelyDepolarizingKraus(3));

  it("an empty Kraus list is refused, not diluted into a 0-dimensional channel (KRAUS_SHAPE)", () => {
    assert.equal(refusalCode(() => krausToStinespring([])), "KRAUS_SHAPE");
  });

  it("mismatched target dims are refused at the k=3 boundary (SWITCH3_DIM_MATCH)", () => {
    // the old path: undefined reads -> NaN columns, no refusal anywhere in
    // branchIsometry3 (switch3 only caught it at its final M†M = I check,
    // blaming a "construction bug" instead of naming the input)
    assert.equal(refusalCode(() => branchIsometry3([d2, d2, d3], [0, 1, 2])), "SWITCH3_DIM_MATCH");
    assert.equal(refusalCode(() => switch3([d3, d2, d3])), "SWITCH3_DIM_MATCH");
  });

  it("a malformed dilation buffer is refused, not read past its end (STINESPRING_SHAPE)", () => {
    const fake: Stinespring = { d: 2, envDim: 4, V: mat(2, 2) }; // wrong buffer
    // the old probe: 48 of 256 entries NaN, returned silently
    assert.equal(refusalCode(() => branchIsometry3([d2, d2, fake], [0, 1, 2])), "STINESPRING_SHAPE");
  });

  it("a channel list longer than three is refused, not silently truncated (SWITCH3_CHANNEL_COUNT)", () => {
    // the old behavior: switch3([a, b, c, d]) built a six-order switch from
    // (a, b, c) and never mentioned d — while the message said "exactly three"
    assert.equal(refusalCode(() => switch3([d2, d2, d2, d2])), "SWITCH3_CHANNEL_COUNT");
    assert.equal(refusalCode(() => branchIsometry3([d2, d2, d2, d2], [0, 1, 2])), "SWITCH3_CHANNEL_COUNT");
  });

  it("randomChannelStinespring certificates its own output: V†V = I, no NaN, across seeds", () => {
    const rng = makeRng(0x5ead07);
    for (let t = 0; t < 8; t++) {
      const st = randomChannelStinespring(rng, 2, 3);
      for (const v of [...st.V.re, ...st.V.im]) assert.ok(Number.isFinite(v), "random channel carries non-finite entries");
      assert.ok(matEq(mMul(mDagger(st.V), st.V), identity(st.d), 1e-12), "random channel failed V†V = I");
    }
  });

  it("legal neighbors still pass: a d=3 six-order switch constructs and certificates itself", () => {
    const sw = switch3([d3, d3, d3]);
    assert.equal(sw.d, 3);
    assert.equal(sw.branches.length, 6);
    // the final isometry certificate inside switch3 is the legal-neighbor proof
    assert.ok(matEq(mMul(mDagger(sw.M), sw.M), identity(sw.M.cols), 1e-12));
    const W: CMat = branchIsometry3([d3, d3, d3], [2, 1, 0]);
    for (const v of [...W.re, ...W.im]) assert.ok(Number.isFinite(v));
  });
});
