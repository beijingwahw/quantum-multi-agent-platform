import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  adversaryFindMax,
  adversarySweepAllSequences,
  auditMaxTree,
  auditSortTree,
  exhaustiveMaxSweep,
  exhaustiveSortSweep,
  findMaxOptimalDepth,
  sortingInfoBound,
  sortingOptimalDepth,
} from "../src/lower/comparison.js";

/**
 * King-of-the-hill: compare the running champion with the next element,
 * depth m-1, champion over elements 0..m-1. Correct as a find-max tree on
 * n = m; on n = m+1 it is the truncated forgery (element m never compared).
 */
function kingHillTree(m: number): Array<[number, number]> {
  const depth = m - 1;
  const ask: Array<[number, number]> = new Array(2 ** depth - 1).fill([0, 1]);
  const build = (v: number, champ: number, next: number): void => {
    if (next >= m) return;
    const lo = Math.min(champ, next);
    const hi = Math.max(champ, next);
    ask[v] = [lo, hi];
    build(2 * v + 1, hi, next + 1); // yes: a_lo < a_hi — hi is the new champion
    build(2 * v + 2, lo, next + 1); // no: lo stays champion
  };
  build(0, 0, 1);
  return ask;
}

/** The tournament the adversary's duel rule produces: larger index survives. */
function tournament(n: number): Array<[number, number]> {
  const seq: Array<[number, number]> = [];
  let champ = 0;
  for (let next = 1; next < n; next++) {
    seq.push([Math.min(champ, next), Math.max(champ, next)]);
    champ = Math.max(champ, next);
  }
  return seq;
}

describe("comparison-model walls — find-max (the P-EXACT island, executed)", () => {
  it("flat exhaustive sweep: no correct tree below n-1, correct trees exist at n-1 (exact ordinals)", () => {
    // the brute-force wall: every canonical depth-q tree audited on all n! inputs
    assert.equal(exhaustiveMaxSweep(3, 1).correct, 0);
    assert.equal(exhaustiveMaxSweep(3, 2).correct, 3); // n-1 = 2: exactly three correct trees
    assert.equal(exhaustiveMaxSweep(4, 2).correct, 0);
    assert.equal(exhaustiveMaxSweep(4, 3).correct, 54); // n-1 = 3: fifty-four
    assert.equal(exhaustiveMaxSweep(5, 2).correct, 0);
    for (const s of [exhaustiveMaxSweep(3, 2), exhaustiveMaxSweep(4, 3)]) {
      assert.ok(s.correctAllLeafSeparated); // every correct tree separates the n possible maxima (the WEAK counting bound, held as data)
    }
  });

  it("game-tree DFS on partial orders: exact optimum = n-1 for n = 2..6, agreeing with the flat sweep", () => {
    for (let n = 2; n <= 6; n++) {
      const r = findMaxOptimalDepth(n);
      assert.equal(r.optimum, n - 1, `find-max optimum at n=${n}`);
    }
    // cross-check against the flat sweep's territory
    assert.ok(exhaustiveMaxSweep(3, 1).correct === 0 && 1 < findMaxOptimalDepth(3).optimum);
    assert.ok(exhaustiveMaxSweep(3, 2).correct > 0 && 2 >= findMaxOptimalDepth(3).optimum);
    assert.ok(exhaustiveMaxSweep(4, 2).correct === 0 && 2 < findMaxOptimalDepth(4).optimum);
    assert.ok(exhaustiveMaxSweep(4, 3).correct > 0 && 3 >= findMaxOptimalDepth(4).optimum);
  });

  it("king-of-the-hill at depth n-1 audits correct for n = 3..6 (the upper-bound witness)", () => {
    for (let n = 3; n <= 6; n++) {
      const audit = auditMaxTree(n, kingHillTree(n));
      assert.ok(audit.correct, `king-of-the-hill must be correct at n=${n}`);
      assert.ok(audit.wrongPerm === null);
    }
  });

  it("the adversary: every adaptive strategy of k = n-2 comparisons leaves >= n-k undefeated with valid witnesses", () => {
    // exhaustive: all C(n,2)^k choice sequences — covering every adaptive strategy
    const expect: Array<[number, number, number]> = [
      [4, 2, 36],
      [5, 3, 1000],
      [6, 4, 50625],
    ];
    for (const [n, k, sequences] of expect) {
      const s = adversarySweepAllSequences(n, k);
      assert.equal(s.sequences, sequences);
      assert.ok(s.allInvariantsHeld, `invariant failed at n=${n}`);
      assert.ok(s.allWitnessesValid, `witness invalid at n=${n}`);
      assert.equal(s.minUndefeated, n - k); // >= n-k, and the tournament attains equality
    }
  });

  it("the tournament play: n-1 comparisons, one undefeated, the witness crowns the champion", () => {
    const n = 5;
    const rec = adversaryFindMax(n, tournament(n));
    assert.equal(rec.k, n - 1);
    assert.ok(rec.invariantHeld);
    assert.deepEqual(rec.undefeated, [n - 1]);
    assert.equal(rec.witnesses.length, 1);
    assert.equal(rec.witnesses[0]!.candidate, n - 1);
    assert.equal(rec.witnesses[0]!.order[rec.witnesses[0]!.order.length - 1], n - 1);
  });
});

describe("comparison-model walls — sorting (the information gate)", () => {
  it("the leaf-counting gate is exact BigInt: q >= ceil(log2(n!))", () => {
    const expect: Array<[number, number, string]> = [
      [3, 3, "6"],
      [4, 5, "24"],
      [5, 7, "120"],
      [12, 29, "479001600"],
    ];
    for (const [n, q, fact] of expect) {
      const b = sortingInfoBound(n);
      assert.equal(b.ceilingLog2Fact, q, `ceil(log2 ${n}!)`);
      assert.equal(b.fact.toString(), fact);
      assert.ok(b.pow2 >= b.fact && b.pow2 / 2n < b.fact); // the minimal power of two above n!
    }
  });

  it("flat sort sweep: depth 2 convicts all 27 trees, depth 3 carries 108 correct — all n!-injective", () => {
    const low = exhaustiveSortSweep(3, 2);
    assert.equal(low.trees, 27);
    assert.equal(low.correct, 0); // 2^2 = 4 < 6 = 3! — the pigeonhole, machine-side
    const high = exhaustiveSortSweep(3, 3);
    assert.equal(high.trees, 2187);
    assert.equal(high.correct, 108); // the exact ordinal count at the optimum
    assert.ok(high.correctAllLeafSeparated); // every correct tree sends 6 perms to 6 distinct leaves
  });

  it("game-tree DFS sorting optimum = ceil(log2(n!)) for n = 2..5 (bound tight at machine-checked sizes)", () => {
    for (let n = 2; n <= 5; n++) {
      assert.equal(sortingOptimalDepth(n).optimum, sortingInfoBound(n).ceilingLog2Fact, `sorting optimum at n=${n}`);
    }
  });
});

describe("comparison-model smuggling trials — counterfeit trees are named and rejected", () => {
  it("a forged n-2 find-max tree (truncated king-of-the-hill) is convicted by name", () => {
    // the forger declares a champion over elements 0..n-2 and never touches
    // element n-1 — the audit NAMES the leaf and the permutation that kills it
    const audit4 = auditMaxTree(4, kingHillTree(3));
    assert.ok(!audit4.correct, "the truncated tree must be rejected");
    assert.equal(audit4.inconsistentLeaf, 0);
    assert.deepEqual(audit4.wrongPerm, [0, 1, 3, 2]);
    assert.equal(audit4.trueMaxOfWrong, 2);
    assert.equal(audit4.leafClaimedMax, 3);
    const audit5 = auditMaxTree(5, kingHillTree(4));
    assert.ok(!audit5.correct);
    assert.ok(audit5.trueMaxOfWrong !== null && audit5.leafClaimedMax !== null);
    assert.notEqual(audit5.trueMaxOfWrong, audit5.leafClaimedMax); // the forgery's blind spot, named
  });

  it("a forged shallow sorting tree dies on the leaf pigeonhole AND by named permutation", () => {
    // any depth-2 tree on n=3: 2^2 = 4 leaves cannot separate 6 permutations
    const gate = sortingInfoBound(3);
    assert.ok(2n ** 2n < gate.fact); // the pigeonhole certificate, exact BigInt
    assert.equal(exhaustiveSortSweep(3, 2).correct, 0); // and the sweep convicts all 27 candidates
    const audit = auditSortTree(3, [
      [0, 1],
      [0, 2],
      [1, 2],
    ]);
    assert.ok(!audit.correct);
    assert.ok(audit.inconsistentLeaf !== null && audit.wrongPerm !== null && audit.leafFirstPerm !== null);
    assert.notDeepEqual(audit.wrongPerm, audit.leafFirstPerm); // two distinct perms reach one leaf — named
  });

  it("degenerate inputs are refused by description (house style)", () => {
    assert.throws(() => auditMaxTree(4, [[0, 1], [0, 2]]), /not 2\^depth - 1/);
    assert.throws(() => auditMaxTree(4, [[0, 0], [1, 2], [0, 1]]), /compares an element with itself/);
    assert.throws(() => auditMaxTree(3, [[0, 5], [1, 2], [0, 1]]), /outside \[0,3\)/);
    assert.throws(() => auditMaxTree(3, [[2, 1], [1, 2], [0, 1]]), /not canonically oriented/);
    assert.throws(() => adversaryFindMax(4, [[0, 0]]), /distinct elements/);
    assert.throws(() => exhaustiveMaxSweep(1, 2), /n must be an integer/);
    assert.throws(() => findMaxOptimalDepth(8), /n must be an integer/);
    assert.throws(() => sortingOptimalDepth(6), /n must be an integer/);
    assert.throws(() => sortingInfoBound(21), /n must be an integer/);
  });
});
