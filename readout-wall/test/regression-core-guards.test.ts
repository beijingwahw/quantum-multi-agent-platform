import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { basisVec } from "../src/core/cmat.js";
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
