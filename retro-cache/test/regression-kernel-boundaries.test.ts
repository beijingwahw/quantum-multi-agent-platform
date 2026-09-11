import test from "node:test";
import assert from "node:assert/strict";
import {
  RcError,
  entropyBits,
  jointTable,
  projector,
  wernerCorrelation,
  wernerPair,
} from "../src/kernel/state.js";
import { collisionCensus, inverseCensus } from "../src/kernel/amplify.js";

/** a rejection is only usable if it is NAMED: the throw must be an RcError
 *  carrying the expected stable code, and the message must embed it (the
 *  kernel-hardening idiom) */
function expectRc(fn: () => unknown, code: string): void {
  assert.throws(
    fn,
    (e: unknown): boolean => e instanceof RcError && e.code === code && e.message.includes(`[${code}]`),
    `expected a named RcError with code ${code}`,
  );
}

test("K.J regression: wernerPair refuses a non-physical visibility by name — no silent super-Tsirelson state", () => {
  // the hole: every ledger entry that PRICES a Werner pair (qberOf,
  // withdrawalRow, every adversary row) refused p outside [0, 1] with
  // RC_P_RANGE, but the state constructor itself accepted it —
  // chshStandard(wernerPair(1.5)) read -4.2426, silently past Tsirelson's
  // 2*sqrt(2), with no refusal anywhere on the path
  expectRc(() => wernerPair(1.5), "RC_P_RANGE");
  expectRc(() => wernerPair(-0.1), "RC_P_RANGE");
  expectRc(() => wernerPair(Number.NaN), "RC_P_RANGE");
  // legal neighbors: the endpoints and interior keep their exact cells
  assert.equal(wernerPair(0).re[0]![0], 0.25, "p=0 is the maximally mixed diagonal");
  assert.equal(wernerPair(0).re[0]![1], 0);
  assert.equal(wernerPair(0).re[1]![3], 0);
  assert.equal(wernerPair(1).re[0]![0], 0, "the singlet's anti-diagonal lives off the diagonal");
  assert.equal(wernerPair(1).re[1]![2], -0.5);
  assert.ok(Math.abs(jointTable(wernerPair(0.5), [0, 0, 1], [0, 0, 1])[0][0] - 0.125) < 1e-15, "aligned P(++) = (1-p)/4, the W1 table path");
});

test("K.K regression: entropyBits refuses an infinite weight — the guard that claimed non-finite and was not", () => {
  // the hole: the guard's own message said "negative or non-finite", but
  // Infinity passes `p >= 0`, the sum hands back -Infinity as an "entropy",
  // and every downstream threshold reads it as a confident number
  expectRc(() => entropyBits([Number.POSITIVE_INFINITY]), "RC_NEG_PROB");
  expectRc(() => entropyBits([0.5, Number.NEGATIVE_INFINITY]), "RC_NEG_PROB");
  expectRc(() => entropyBits([Number.NaN]), "RC_NEG_PROB");
  // legal neighbors unchanged: the zero-weight convention and the exact anchors
  assert.equal(entropyBits([0, 1]), 0);
  assert.equal(entropyBits([0.5, 0.5]), 1);
  assert.equal(entropyBits([0.25, 0.25, 0.25, 0.25]), 2);
});

test("K.L regression: non-finite axis components are refused, not laundered into NaN tables", () => {
  // the hole: both axis-taking entries checked the LENGTH but not the values —
  // a NaN or Infinite component seeded NaN into the projector matrix and the
  // closed form, and jointTable printed NaN cells with no refusal anywhere
  expectRc(() => projector([Number.NaN, 0, 0], 1), "RC_NON_FINITE");
  expectRc(() => projector([0, Number.POSITIVE_INFINITY, 0], -1), "RC_NON_FINITE");
  expectRc(() => wernerCorrelation(1, [Number.NaN, 0, 0], [0, 0, 1]), "RC_NON_FINITE");
  expectRc(() => wernerCorrelation(1, [0, 0, 1], [0, Number.NEGATIVE_INFINITY, 0]), "RC_NON_FINITE");
  expectRc(() => jointTable(wernerPair(1), [Number.NaN, 0, 0], [0, 0, 1]), "RC_NON_FINITE");
  // legal neighbors: the z-projector and the closed form keep their exact values
  const p = projector([0, 0, 1], 1);
  assert.equal(p.re[0]![0], 1);
  assert.equal(p.re[0]![1], 0);
  assert.equal(p.re[1]![1], 0);
  assert.equal(wernerCorrelation(1, [0, 0, 1], [0, 0, 1]), -1);
  assert.equal(wernerCorrelation(0.5, [1, 0, 0], [1, 0, 0]), -0.5);
});

test("K.M regression: the field censuses refuse the shift-wrap vacuum by name (RC_NO_FIELD)", () => {
  // the hole: `1 << m` wraps at m >= 31 (and empties at m <= 0), the census
  // loops never ran, and gfMul's own field gate never fired —
  // inverseCensus(32) shipped a vacuous {nonzero: 0, invertible: 0}
  // certificate, and collisionCensus(32, 4) answered universal2: true over a
  // family of 0 maps (collisionCensus(31, 4): family -2147483649)
  expectRc(() => inverseCensus(32), "RC_NO_FIELD");
  expectRc(() => inverseCensus(31), "RC_NO_FIELD");
  expectRc(() => inverseCensus(0), "RC_NO_FIELD");
  expectRc(() => inverseCensus(4.5), "RC_NO_FIELD");
  expectRc(() => collisionCensus(32, 4), "RC_NO_FIELD");
  expectRc(() => collisionCensus(31, 4), "RC_NO_FIELD");
  // refusal precedence is unchanged: the k-range gate still fires first
  expectRc(() => collisionCensus(8, 9), "RC_K_RANGE");
  // legal neighbors: the on-file fields keep their certificates exactly
  assert.deepEqual(inverseCensus(4), { m: 4, nonzero: 15, invertible: 15 });
  assert.deepEqual(inverseCensus(8), { m: 8, nonzero: 255, invertible: 255 });
  const c = collisionCensus(8, 4);
  assert.equal(c.collisionsPerDelta, 15);
  assert.equal(c.family, 255);
  assert.equal(c.maxCollisionProb, 15 / 255);
  assert.ok(c.universal2);
});
