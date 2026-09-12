import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DtcError } from "../src/core/errors.js";
import { basisVec, mat, mAdd } from "../src/core/cmat.js";

/**
 * Regression: the linalg boundary guards (landed with the post-0.21.0
 * quality sweeps; the books stayed at 0.21.0). Both refusals close a
 * silent-failure class the rest of the channel layer already refuses by
 * name: an out-of-range basisVec index was a no-op write into the
 * Float64Array (the zero vector out, no error), and a shape-mismatched mAdd
 * read out of bounds into NaN (mMul already refused the same input).
 */
describe("regression: linalg boundary guards refuse by name", () => {
  const codeOf = (fn: () => unknown): string => {
    try {
      fn();
    } catch (e) {
      assert.ok(e instanceof DtcError, `a refusal must be a DtcError, got ${String(e)}`);
      return e.code;
    }
    throw new Error("the illegal input was NOT refused — the guard is missing");
  };

  it("basisVec refuses an out-of-range, negative, or fractional index (E/DOMAIN)", () => {
    assert.equal(codeOf(() => basisVec(4, 4)), "E/DOMAIN");
    assert.equal(codeOf(() => basisVec(4, -1)), "E/DOMAIN");
    assert.equal(codeOf(() => basisVec(4, 0.5)), "E/DOMAIN");
    assert.equal(codeOf(() => basisVec(0, 0)), "E/DOMAIN");
  });

  it("basisVec still returns the exact basis vector on the legal domain", () => {
    const v = basisVec(3, 2);
    assert.deepEqual(Array.from(v.re), [0, 0, 1]);
    assert.deepEqual(Array.from(v.im), [0, 0, 0]);
  });

  it("mAdd refuses a shape mismatch (E/SHAPE) instead of reading into NaN", () => {
    assert.equal(codeOf(() => mAdd(mat(2, 2), mat(2, 3))), "E/SHAPE");
    assert.equal(codeOf(() => mAdd(mat(2, 2), mat(3, 2))), "E/SHAPE");
  });

  it("mAdd still sums same-shape matrices exactly", () => {
    const a = mat(2, 2);
    a.re[0] = 1;
    const b = mat(2, 2);
    b.re[3] = 2;
    const c = mAdd(a, b);
    assert.equal(c.re[0], 1);
    assert.equal(c.re[3], 2);
    assert.equal(c.re[1], 0);
  });
});
