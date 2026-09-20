import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  adversaryFindSecond,
  adversarySecondSweepAllSequences,
  auditSecondTree,
  exhaustiveSecondSweep,
  findSecondOptimalDepth,
  secondClosedForm,
  secondInfoBound,
  secondOf,
  secondTreeWitness,
} from "../src/lower/second.js";

/**
 * King-of-the-hill as a SECOND-largest forgery: the champion tree is optimal
 * for find-max (n-1 comparisons) and never compares the champion's victims
 * with each other — as a second-largest tree at the forgery depth
 * n + ceil(log2 n) - 3 it must be convicted by name.
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

/**
 * Play one comparison against the adversary by replay: the answer to play t
 * depends only on plays [0..t], so pushing and re-running names it. Returns
 * the WINNER's index ("a_i < a_j?" — j wins on yes, i on no).
 */
function playAgainst(
  n: number,
  seq: Array<[number, number]>,
  i: number,
  j: number,
): number {
  const lo = Math.min(i, j);
  const hi = Math.max(i, j);
  seq.push([lo, hi]);
  const less = adversaryFindSecond(n, seq).answers[seq.length - 1]!;
  return less ? hi : lo;
}

/** The sequential king-of-the-hill: the running champion plays each newcomer once. */
function kingHillPlays(n: number): Array<[number, number]> {
  const seq: Array<[number, number]> = [];
  let champ = playAgainst(n, seq, 0, 1); // the tie rule crowns the higher index here
  for (let next = 2; next < n; next++) {
    champ = playAgainst(n, seq, champ, next); // the running champion has the larger team and keeps winning
  }
  assert.equal(seq.length, n - 1);
  return seq;
}

/** The balanced tournament + loser bracket at EXACTLY n + ceil(log2 n) - 2 plays, against the team adversary. */
function optimalPlays(n: number): Array<[number, number]> {
  const seq: Array<[number, number]> = [];
  let pool: number[] = Array.from({ length: n }, (_, x) => x);
  while (pool.length > 1) {
    const next: number[] = [];
    for (let i = 0; i + 1 < pool.length; i += 2) {
      next.push(playAgainst(n, seq, pool[i]!, pool[i + 1]!));
    }
    if (pool.length % 2 === 1) next.push(pool[pool.length - 1]!);
    pool = next;
  }
  const champion = pool[0]!;
  const mid = adversaryFindSecond(n, seq);
  assert.equal(
    mid.champion,
    champion,
    "the bracket winner is the unique undefeated",
  );
  let best: number | null = null;
  for (const c of mid.secondCandidates) {
    best = best === null ? c : playAgainst(n, seq, best, c);
  }
  assert.equal(
    seq.length,
    secondClosedForm(n),
    `the optimal play sequence must be exactly n + ceil(log2 n) - 2 long at n=${n}`,
  );
  return seq;
}

describe("second-largest optimality — the three-leg theorem, executed", () => {
  it("LEG A flat sweep: zero correct trees below the closed form, exact ordinals at the optimum (n = 3, 4)", () => {
    const at3 = exhaustiveSecondSweep(3, 2);
    assert.equal(at3.trees, 27);
    assert.equal(at3.correct, 0); // n + ceil(log2 n) - 3 = 2 — the forgery depth, all 27 trees die
    const opt3 = exhaustiveSecondSweep(3, 3);
    assert.equal(opt3.trees, 2187);
    assert.ok(opt3.correct > 0); // the optimum n + ceil(log2 n) - 2 = 3 carries correct trees
    assert.ok(opt3.correctAllLeafSeparated); // the weak counting bound held as data (>= n(n-1) leaves)
    const at4 = exhaustiveSecondSweep(4, 3);
    assert.equal(at4.trees, 6 ** 7);
    assert.equal(at4.correct, 0); // 4 + 2 - 3 = 3 — every one of the 279,936 trees dies
  });

  it("LEG B game DFS: the exact optimum equals n + ceil(log2 n) - 2 for n = 2..6", () => {
    const expect: Array<[number, number]> = [
      [2, 1],
      [3, 3],
      [4, 4],
      [5, 6],
      [6, 7],
    ];
    for (const [n, q] of expect) {
      const r = findSecondOptimalDepth(n);
      assert.equal(r.optimum, q, `second-largest optimum at n=${n}`);
      assert.equal(
        q,
        secondClosedForm(n),
        "the closed form is the machine optimum",
      );
    }
  });

  it("the constructive witness: a correct flat tree at exactly the closed form's depth (n = 3..5)", () => {
    for (let n = 3; n <= 5; n++) {
      const tree = secondTreeWitness(n);
      assert.equal(tree.length, 2 ** secondClosedForm(n) - 1);
      const audit = auditSecondTree(n, tree);
      assert.ok(audit.correct, `the witness tree must audit correct at n=${n}`);
    }
  });

  it("the counting gate is exact BigInt: q >= ceil(log2(n(n-1))) — and it leaves the n=5 gap the adversary closes", () => {
    const expect: Array<[number, number, string]> = [
      [3, 3, "6"],
      [4, 4, "12"],
      [5, 5, "20"],
      [12, 8, "132"],
    ];
    for (const [n, q, pairs] of expect) {
      const b = secondInfoBound(n);
      assert.equal(b.ceilingLog2Pairs, q, `ceil(log2 ${n}(n-1))`);
      assert.equal(b.pairs.toString(), pairs);
      assert.ok(b.pow2 >= b.pairs && b.pow2 / 2n < b.pairs);
    }
    assert.ok(
      secondInfoBound(5).ceilingLog2Pairs === 5 &&
        findSecondOptimalDepth(5).optimum === 6,
      "the 5-vs-6 gap at n=5 is the adversary leg's territory",
    );
  });
});

describe("second-largest adversary — the tournament argument as a machine invariant", () => {
  it("LEG C sweep: every adaptive strategy of k = n + ceil(log2 n) - 3 plays leaves the second undetermined", () => {
    const expect: Array<[number, number, number]> = [
      [4, 3, 216],
      [5, 5, 100000],
    ];
    for (const [n, k, sequences] of expect) {
      const s = adversarySecondSweepAllSequences(n, k);
      assert.equal(s.sequences, sequences);
      assert.equal(s.k, n + Math.ceil(Math.log2(n)) - 3);
      assert.ok(
        s.allInvariantsHeld,
        `doubling/undefeated invariants failed at n=${n}`,
      );
      assert.ok(s.allWitnessesValid, `witness orders failed at n=${n}`);
      assert.ok(
        s.allBlocked,
        `some strategy of ${k} plays determined the second at n=${n}`,
      );
    }
  });

  it("the sequential tournament at n-1 plays: one champion, n-1 candidates — blocked with named second witnesses", () => {
    const n = 6;
    const rec = adversaryFindSecond(n, kingHillPlays(n));
    assert.equal(rec.k, n - 1);
    assert.ok(
      rec.invariantHeld &&
        rec.undefeatedBudgetHeld &&
        rec.championInvariantHeld,
    );
    assert.equal(rec.undefeated.length, 1);
    assert.equal(rec.champion, rec.undefeated[0]);
    assert.equal(rec.blocked, "SECOND-UNKNOWN");
    assert.equal(rec.secondCandidates.length, n - 1); // every victim is still a candidate
    assert.equal(rec.witnesses.length, 2);
    assert.equal(new Set(rec.witnesses.map((w) => w.crown)).size, 1); // same champion...
    assert.equal(new Set(rec.witnesses.map((w) => w.second)).size, 2); // ...different seconds
  });

  it("tightness: the balanced tournament + loser bracket determines the second at exactly n + ceil(log2 n) - 2 plays", () => {
    for (const n of [4, 6]) {
      const rec = adversaryFindSecond(n, optimalPlays(n));
      assert.equal(rec.k, secondClosedForm(n), `at n=${n}`);
      assert.ok(
        rec.invariantHeld &&
          rec.undefeatedBudgetHeld &&
          rec.championInvariantHeld,
      );
      assert.equal(
        rec.blocked,
        "DETERMINED",
        `the optimal-length play must determine the second at n=${n}`,
      );
      assert.equal(rec.witnesses.length, 0); // no witnesses when determined — nothing left to block
      assert.ok(rec.champion !== null && rec.secondCandidates.length === 1);
    }
  });
});

describe("second-largest smuggling trials — counterfeit trees are convicted by name", () => {
  it("the king-of-the-hill forgery at depth n + ceil(log2 n) - 3 is convicted with the named leaf and pair", () => {
    // n = 4: depth 3 = 4 + 2 - 3 — the find-max-optimal tree is a second-largest forgery
    const audit = auditSecondTree(4, kingHillTree(4));
    assert.ok(!audit.correct, "the truncated tree must be rejected");
    assert.ok(audit.inconsistentLeaf !== null);
    assert.ok(audit.wrongPerm !== null);
    assert.ok(audit.truePairOfWrong !== null && audit.leafClaimedPair !== null);
    assert.notDeepEqual(audit.truePairOfWrong, audit.leafClaimedPair); // the two pairs differ — named
    // the forged depth itself is convicted wholesale by the sweep (279,936 trees, zero correct)
    assert.equal(exhaustiveSecondSweep(4, 3).correct, 0);
  });

  it("secondOf pins the ordered pair exactly (the audit's own oracle)", () => {
    assert.deepEqual(secondOf([1, 0]), [0, 1]);
    assert.deepEqual(secondOf([0, 2, 1]), [1, 2]);
    assert.deepEqual(secondOf([3, 1, 2, 0]), [0, 2]);
    assert.deepEqual(secondOf([1, 2, 3, 4]), [3, 2]);
    assert.throws(() => secondOf([5]), /at least 2 elements/);
  });

  it("degenerate inputs are refused by description (house style)", () => {
    assert.throws(
      () =>
        auditSecondTree(4, [
          [0, 1],
          [0, 2],
        ]),
      /not 2\^depth - 1/,
    );
    assert.throws(
      () =>
        auditSecondTree(4, [
          [0, 0],
          [1, 2],
          [0, 1],
        ]),
      /compares an element with itself/,
    );
    assert.throws(
      () =>
        auditSecondTree(3, [
          [0, 5],
          [1, 2],
          [0, 1],
        ]),
      /outside \[0,3\)/,
    );
    assert.throws(
      () =>
        auditSecondTree(3, [
          [2, 1],
          [1, 2],
          [0, 1],
        ]),
      /not canonically oriented/,
    );
    assert.throws(() => adversaryFindSecond(4, [[0, 0]]), /distinct elements/);
    assert.throws(() => exhaustiveSecondSweep(1, 2), /n must be an integer/);
    assert.throws(() => findSecondOptimalDepth(7), /n must be an integer/);
    assert.throws(() => secondInfoBound(21), /n must be an integer/);
    assert.throws(() => secondTreeWitness(1), /n must be an integer/);
  });
});
