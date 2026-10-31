import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { basisVec, colFrom, eigHermitian, mat, reconstruct } from "../src/core/cmat.js";
import { RefusalError } from "../src/core/errors.js";
import { makeRng } from "../src/core/rng.js";

/** Run `fn`, expect a RefusalError, return its code — shared idiom with the chanlib suite. */
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
 * Regression (R9-A): the core family guards this repo shares with the canon.
 *
 * basisVec: an out-of-range or fractional index into the Float64Array was a
 * silent no-op write — the caller received a confident-looking |0...0>
 * instead of an error (the hole stable-world R4, ent-clearing R7 and
 * dtc-clock were convicted of and refuse by name). rng.int: maxExclusive < 1
 * or non-integer silently returned 0 or a biased floor, smuggling an
 * out-of-range index into every consumer — the guard the qverify/quantum-mech
 * lineages landed 2026-09-11, adopted here in the same breath as the canon.
 * Each test pins the refusal AND the exact legal output, so the guard can
 * neither vanish nor creep onto the legal path.
 */
describe("core family guards (R9-A): basisVec and rng.int boundaries", () => {
  it("basisVec refuses out-of-range and fractional indices by code (was: silent zero vector)", () => {
    assert.equal(refusalCode(() => basisVec(3, 3)), "BASISVEC_INDEX_RANGE");
    assert.equal(refusalCode(() => basisVec(3, -1)), "BASISVEC_INDEX_RANGE");
    assert.equal(refusalCode(() => basisVec(3, 1.5)), "BASISVEC_INDEX_RANGE");
    assert.throws(() => basisVec(3, 3), /basisVec: index 3 out of range for dimension 3/);
  });

  it("basisVec still builds the exact legal vector (and the module-load kets with it)", () => {
    const v = basisVec(3, 1);
    assert.deepEqual(Array.from(v.re), [0, 1, 0]);
    assert.deepEqual(Array.from(v.im), [0, 0, 0]);
    assert.equal(v.n, 3);
  });

  it("rng.int refuses degenerate bounds before any draw (int(2.5) biased, int(0)/int(-2) impossible)", () => {
    const rng = makeRng(1);
    assert.throws(() => rng.int(0), /rng\.int: maxExclusive must be an integer >= 1, got 0/);
    assert.throws(() => rng.int(-2), /rng\.int: maxExclusive must be an integer >= 1, got -2/);
    assert.throws(() => rng.int(2.5), /rng\.int: maxExclusive must be an integer >= 1, got 2\.5/);
  });

  it("rng.int keeps the legal seeded stream bit-identical (guard sits before the draw)", () => {
    const rng = makeRng(101);
    assert.deepEqual([rng.int(3), rng.int(3), rng.int(3), rng.int(3)], [0, 2, 1, 1]);
    const picker = makeRng(7);
    assert.equal(picker.pick(["a", "b", "c", "d", "e"]), "a");
    // pick consumed draw 1 (index 0 -> "a"); the stream continues 0, 4
    assert.deepEqual([picker.int(5), picker.int(5)], [0, 4]);
  });
});

// 2026-11-01 修复（R9-B）：reconstruct 原对 λ ≤ 0 一律静默跳过——不定 Hermitian
// 输入的负谱被丢弃，"Σ λ vv† = H" 契约悄然失真（eigHermitian 的重构核对与
// kswitch4 的本征值括号预算都建立在它之上）。现在负本征值超出容差即具名拒绝；
// 本试验同时钉死拒绝与合法路径（PSD 谱精确重构、容差内数值性微负不受影响）。
describe("core family guards (R9-B): reconstruct refuses indefinite spectra by name", () => {
  it("an indefinite Hermitian input is refused, not silently projected (RECONSTRUCT_NEGATIVE_EIGENVALUE)", () => {
    // diag(0.5, -0.25) via eigHermitian's own decomposition: the refusal now
    // fires inside the reconstruction check that used to launder the spectrum
    const indef = mat(2, 2);
    indef.re[0] = 0.5;
    indef.re[3] = -0.25;
    assert.equal(refusalCode(() => eigHermitian(indef)), "RECONSTRUCT_NEGATIVE_EIGENVALUE");
    // direct call too — the contract lives on reconstruct itself
    const e1 = colFrom([1, 0], [0, 0]);
    const e2 = colFrom([0, 1], [0, 0]);
    assert.equal(
      refusalCode(() => reconstruct(indef, new Float64Array([0.5, -0.25]), [e1, e2])),
      "RECONSTRUCT_NEGATIVE_EIGENVALUE",
    );
    assert.throws(
      () => reconstruct(indef, new Float64Array([0.5, -0.25]), [e1, e2]),
      /reconstruct: eigenvalue 1 = -2\.5.*e-1 .* is not PSD/,
    );
  });

  it("the legal PSD path still reconstructs exactly, and tolerance-scale numerical negatives pass", () => {
    const psd = mat(2, 2);
    psd.re[0] = 0.75;
    psd.re[3] = 0.25;
    const { values, vectors } = eigHermitian(psd);
    const rec = reconstruct(psd, values, vectors);
    for (let k = 0; k < 4; k++) {
      assert.ok(Math.abs(rec.re[k]! - psd.re[k]!) < 1e-12);
      assert.ok(Math.abs(rec.im[k]!) < 1e-12);
    }
    // a numerical negative within the 1e-9·scale tolerance is dropped as before
    const f1 = colFrom([1, 0], [0, 0]);
    const f2 = colFrom([0, 1], [0, 0]);
    const okRec = reconstruct(psd, new Float64Array([0.75, -1e-17]), [f1, f2]);
    assert.ok(Math.abs(okRec.re[0]! - 0.75) < 1e-12);
    assert.ok(okRec.re[3]! === 0);
  });
});
