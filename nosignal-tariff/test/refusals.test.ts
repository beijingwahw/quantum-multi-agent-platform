import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RefusalError, refuse } from "../src/core/errors.js";
import { makeRng } from "../src/core/rng.js";
import { eigenvaluesHermitian, mat, mMul } from "../src/core/cmat.js";
import { partialTrace } from "../src/core/channels.js";
import { dephase } from "../src/kernel/collapse.js";
import { branchIsometry, krausToStinespring } from "../src/switch/isometry.js";
import { replacerKraus } from "../src/switch/chanlib.js";
import {
  F_ONE,
  F_ZERO,
  fDiv,
  fr,
  frDec,
  h2Closed,
  h2Series,
  iDivPos,
  iOf,
  iScaleNonneg,
  ivl,
  negLn,
} from "../src/kernel/rational.js";

/** Run `fn`, demand a RefusalError, return its code — the conviction is by name. */
function codeOf(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof RefusalError, `expected a RefusalError, got ${String(e)}`);
    return e.code;
  }
  assert.fail("expected a refusal, got a return value");
}

describe("K1 customs names every kernel refusal by code", () => {
  it("the rational kernel's domain refusals are coded", () => {
    assert.equal(codeOf(() => fr(1, 0)), "FR_ZERO_DENOMINATOR");
    assert.equal(codeOf(() => fDiv(F_ONE, F_ZERO)), "FDIV_ZERO_DIVISOR");
    assert.equal(codeOf(() => ivl(F_ONE, F_ZERO)), "IVL_LO_ABOVE_HI");
    assert.equal(codeOf(() => iScaleNonneg(iOf(F_ONE), fr(-1))), "ISCALE_NEGATIVE_SCALAR");
    assert.equal(codeOf(() => iDivPos(iOf(F_ONE), iOf(F_ZERO))), "IDIV_DIVISOR_NOT_POSITIVE");
    assert.equal(codeOf(() => negLn(F_ZERO)), "NEGLN_DOMAIN");
    assert.equal(codeOf(() => negLn(F_ONE)), "NEGLN_DOMAIN");
    assert.equal(codeOf(() => h2Closed(fr(3, 2))), "H2CLOSED_DOMAIN");
    assert.equal(codeOf(() => h2Series(F_ZERO)), "H2SERIES_DOMAIN");
    assert.equal(codeOf(() => frDec("not-a-number")), "FRDEC_UNPARSEABLE");
  });

  it("the linear core's shape refusals are coded", () => {
    assert.equal(codeOf(() => mMul(mat(2, 3), mat(2, 2))), "MMUL_SHAPE_MISMATCH");
    assert.equal(codeOf(() => eigenvaluesHermitian(mat(2, 3))), "EIGENVALUES_NOT_SQUARE");
  });

  it("channel boundaries name out-of-range indices by code", () => {
    const rho4 = mat(4, 4);
    assert.equal(codeOf(() => partialTrace(rho4, [2, 2], [5])), "PARTIALTRACE_INDEX_OUT_OF_RANGE");
    assert.equal(codeOf(() => partialTrace(rho4, [2, 2, 2], [])), "PARTIALTRACE_DIMS_MISMATCH");
    assert.equal(codeOf(() => partialTrace(rho4, [0, 2], [])), "SUBSYSTEM_DIMS_INVALID");
    assert.equal(codeOf(() => dephase(rho4, [2, 2], 7)), "DEPHASE_INDEX_OUT_OF_RANGE");
  });

  it("switch construction names its failures by code", () => {
    assert.equal(codeOf(() => krausToStinespring([mat(2, 3)])), "KRAUS_NOT_SQUARE");
    assert.equal(
      codeOf(() =>
        branchIsometry(krausToStinespring(replacerKraus(2)), krausToStinespring(replacerKraus(3)), "A"),
      ),
      "BRANCH_DIM_MISMATCH",
    );
  });

  it("the refusal envelope: message text frozen, code rides along", () => {
    assert.throws(() => refuse("TEST_CODE", "the message is the frozen surface"), (e): e is RefusalError => {
      if (!(e instanceof RefusalError)) return false;
      assert.equal(e.code, "TEST_CODE");
      assert.equal(e.message, "the message is the frozen surface");
      assert.equal(e.name, "RefusalError");
      return true;
    });
  });

  it("the seeded stream is bit-stable across refactors (frozen anchors)", () => {
    const r = makeRng(42);
    assert.deepEqual(
      [r(), r(), r()].map((x) => x.toFixed(15)),
      ["0.601103751920164", "0.448290558997542", "0.852465793490410"],
    );
    assert.equal(makeRng(777)().toFixed(15), "0.686378717888147");
  });
});
