import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hungarianMax, kPairAllRegimeOptimum, kPairOptimum, makeKPairInstance, makeWeights, optimumOf, makeInstance } from "../src/kernel/law.js";

/**
 * Regression: the matching kernel's boundary.
 *
 * Before the guards, hungarianMax accepted ragged and non-finite matrices
 * silently: undefined entries flowed into the potentials as NaN, comparisons
 * against NaN are false, and the solver returned a confident-looking
 * assignment whose score nobody could re-derive (probe: [[1,2,3],[4,5]]
 * "solved" to [2,1]). And kPairAllRegimeOptimum with fewer agents than pair
 * slots (n < 2k, m ≥ 2k) crashed on a raw TypeError deep inside the slot
 * matrix — while its sibling entry points (densityCampaign, integerCj) had
 * always refused the same input by name.
 */
describe("R1 hungarianMax and the all-k face refuse degenerate matrices by name", () => {
  it("a ragged matrix is refused, not silently solved on undefined entries", () => {
    assert.throws(() => hungarianMax([[1, 2, 3], [4, 5]]), /rectangular/);
    assert.throws(() => hungarianMax([[1, 2], [3, 4], [5]]), /rectangular/);
  });

  it("a non-finite entry is refused, not compared against NaN", () => {
    assert.throws(() => hungarianMax([[1, NaN], [2, 3]]), /finite/);
    assert.throws(() => hungarianMax([[1, Infinity], [2, 3]]), /finite/);
    assert.throws(() => hungarianMax([[1, -Infinity], [2, 3]]), /finite/);
  });

  it("fewer agents than pair slots is refused by name, not by a raw TypeError", () => {
    // m=6 >= 2k=6 but n=4 < 6: the old path crashed reading weights[t][4]
    assert.throws(() => kPairAllRegimeOptimum(makeKPairInstance(6, 4, 500, 8, 3)), /n >= 2k/);
    // and the m < 2k face keeps its named refusal at the new guard position
    assert.throws(() => kPairAllRegimeOptimum(makeKPairInstance(3, 6, 800, 8, 2)), /m >= 2k/);
  });

  it("legal neighbors still pass: the guarded solver stays the exact referee", () => {
    // the 2x2 optimum by hand: max(1+4, 2+3) = 5 — assert the achieved WEIGHT,
    // not the agent indices (the assignment [1,0] scores 2+3 and is also legal)
    const w2: number[][] = [[1, 2], [3, 4]];
    const a = hungarianMax(w2);
    assert.equal(w2[0]![a[0]!]! + w2[1]![a[1]!]!, 5);
    // a square family instance at λ=0: hungarian === enumerated optimum
    const zero = makeInstance(3, 5, 900, 0);
    const assign = hungarianMax(zero.weights);
    let wH = 0;
    for (let t = 0; t < zero.m; t++) wH += zero.weights[t]![assign[t]!]!;
    assert.ok(Math.abs(wH - optimumOf(zero).welfare) < 1e-12);
    // a rectangular m<n matrix: every task assigned, agents distinct
    const r = hungarianMax(makeWeights(3, 6, 777));
    assert.equal(r.length, 3);
    assert.equal(new Set(r).size, 3);
    // the all-k face on the legal m = 2k cell is still integer-exact
    const inst = makeKPairInstance(4, 6, 800, 8, 2);
    assert.equal(Math.abs(kPairAllRegimeOptimum(inst) - kPairOptimum(inst).welfare), 0);
  });
});
