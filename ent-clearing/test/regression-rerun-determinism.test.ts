import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { basisVec } from "../src/core/cmat.js";
import { makeRng } from "../src/core/rng.js";
import { ghzLocalCensus } from "../src/kernel/ghz.js";
import { computeLedger } from "../src/kernel/ledger.js";

/**
 * Regression: same seed, same ledger — the seeded census the ledger's L16 row
 * and the renderer's GHZ section consume must re-run BYTE-identically (the
 * repro contract at the pipeline level; the EC_-coded refusals guard the
 * primitives). Plus the basisVec boundary: the missed sibling of the
 * dtc-clock/stable-world conviction (an out-of-range index was a silent
 * no-op write returning the zero vector).
 */
describe("regression: seeded censuses re-run byte-identically; basisVec refuses out-of-range", () => {
  it("computeLedger() twice is deep-equal — every seeded row bit-stable", () => {
    const a = computeLedger();
    const b = computeLedger();
    assert.equal(JSON.stringify(a), JSON.stringify(b));
    // the legal neighbor: the content is real, 16 recomputed rows
    assert.equal(a.length, 16);
  });

  it("ghzLocalCensus(same seed) twice is deep-equal, and a different seed differs", () => {
    const a = ghzLocalCensus(makeRng(203), 12);
    const b = ghzLocalCensus(makeRng(203), 12);
    assert.equal(JSON.stringify(a), JSON.stringify(b));
    const c = ghzLocalCensus(makeRng(204), 12);
    assert.notEqual(JSON.stringify(a), JSON.stringify(c));
  });

  it("basisVec refuses out-of-range/negative/fractional indices by name (EC_INDEX)", () => {
    assert.throws(() => basisVec(4, 4), /EC_INDEX: basisVec index 4 out of range for dimension 4/);
    assert.throws(() => basisVec(4, -1), /EC_INDEX/);
    assert.throws(() => basisVec(4, 0.5), /EC_INDEX/);
    // legal neighbor pin: the in-range basis vector is still exact
    const v = basisVec(3, 2);
    assert.deepEqual(Array.from(v.re), [0, 0, 1]);
    assert.deepEqual(Array.from(v.im), [0, 0, 0]);
  });
});
