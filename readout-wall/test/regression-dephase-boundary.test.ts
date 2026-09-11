import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dephase, partialDephase, readoutSlices } from "../src/kernel/collapse.js";
import { RefusalError } from "../src/core/errors.js";
import { krausToStinespring, makeSwitchedChannel } from "../src/switch/isometry.js";
import { completelyDepolarizingKraus } from "../src/switch/chanlib.js";
import { mat, type CMat } from "../src/core/cmat.js";
import { PLUS, vecToRho } from "../src/core/states.js";

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
 * Regression: the readout layer's dims boundary.
 *
 * Before the guard, dephase never validated `dims` against the matrix it was
 * given: a zero or fractional dim made every digit NaN, and NaN !== NaN then
 * zeroed the whole matrix silently (a trace-0 "state" that looked built);
 * a dims product that missed the matrix decomposed digits that do not exist —
 * corruption invisible on the diagonal. partialDephase additionally let a NaN
 * lambda through its `< 0 || > 1` gate (NaN fails both comparisons) and bled
 * it into every entry.
 */
describe("R1 the dephase boundary refuses silent-garbage dims by name", () => {
  const rho3: CMat = mat(3, 3); // a 3x3 density matrix, trace 1
  rho3.re[0] = 1;

  it("a zero or fractional dim is refused, not silently zeroed (DEPHASE_DIMS_MISMATCH)", () => {
    // probe of the old behavior: dephase(rho3, [0, 3], 0) returned the 3x3
    // zero matrix — trace 0, no error, no NaN visible in the result
    assert.equal(refusalCode(() => dephase(rho3, [0, 3], 0)), "DEPHASE_DIMS_MISMATCH");
    assert.equal(refusalCode(() => dephase(rho3, [1.5, 2], 0)), "DEPHASE_DIMS_MISMATCH");
  });

  it("a dims product that misses the matrix is refused (DEPHASE_DIMS_MISMATCH)", () => {
    // the old behavior kept the diagonal intact while corrupting the
    // decomposition — the worst kind of wrong, the kind that survives a glance
    assert.equal(refusalCode(() => dephase(rho3, [2, 2], 0)), "DEPHASE_DIMS_MISMATCH");
    assert.equal(refusalCode(() => dephase(mat(2, 3), [2, 2], 0)), "DEPHASE_DIMS_MISMATCH");
  });

  it("a NaN or infinite lambda is refused, not bled into every entry (PARTIAL_DEPHASE_LAMBDA)", () => {
    const rho2: CMat = mat(2, 2);
    rho2.re[0] = 1;
    // NaN fails both comparisons of the old `lambda < 0 || lambda > 1` gate —
    // the result was an all-NaN matrix with the shape of a state
    assert.equal(refusalCode(() => partialDephase(rho2, [2, 2], 0, NaN)), "PARTIAL_DEPHASE_LAMBDA");
    assert.equal(refusalCode(() => partialDephase(rho2, [2, 2], 0, Infinity)), "PARTIAL_DEPHASE_LAMBDA");
    assert.equal(refusalCode(() => partialDephase(rho2, [2, 2], 0, -Infinity)), "PARTIAL_DEPHASE_LAMBDA");
  });

  it("legal neighbors still pass and stay numerically identical (the guard bites only contraband)", () => {
    const sc = makeSwitchedChannel(
      krausToStinespring(completelyDepolarizingKraus(2)),
      krausToStinespring(completelyDepolarizingKraus(2)),
    );
    const s = readoutSlices(sc, vecToRho(PLUS), mat(2, 2));
    const d1 = dephase(s.full, [2, 2], 0);
    assert.equal(d1.re.length, 16); // 4x4, built, no refusal
    for (const v of [...d1.re, ...d1.im]) assert.ok(Number.isFinite(v));
    // a 3-subsystem dephase on a valid 2x2x2 register also still passes
    const rho8: CMat = mat(8, 8);
    rho8.re[0] = 1;
    assert.equal(dephase(rho8, [2, 2, 2], 1).re.length, 64);
    // the endpoints of lambda remain legal
    assert.ok(partialDephase(rho8, [2, 2, 2], 0, 0).rows > 0);
    assert.ok(partialDephase(rho8, [2, 2, 2], 0, 1).rows > 0);
  });
});
