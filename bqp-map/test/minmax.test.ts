import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  adversaryMinmax,
  adversaryMinmaxSweepAllSequences,
  auditMinmaxTree,
  exhaustiveMinmaxSweep,
  findMinmaxOptimalDepth,
  minmaxClosedForm,
  minmaxInfoBound,
  minmaxOf,
  minmaxTreeWitness,
} from "../src/lower/minmax.js";

/**
 * King-of-the-hill as a MIN&MAX forgery: the champion tree is optimal for
 * find-max (n-1 comparisons) and never compares the losers among themselves
 * — as a min&max tree it leaves the minimum with n-1 candidates, and must be
 * convicted by name.
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
  const less = adversaryMinmax(n, seq).answers[seq.length - 1]!;
  return less ? hi : lo;
}

/** The sequential king-of-the-hill: the running champion plays each newcomer once. */
function kingHillPlays(n: number): Array<[number, number]> {
  const seq: Array<[number, number]> = [];
  let champ = playAgainst(n, seq, 0, 1); // NO-vs-NO: the fixed answer crowns the higher index
  for (let next = 2; next < n; next++) {
    champ = playAgainst(n, seq, champ, next); // the champion is MAXC, the newcomer NO — the champion keeps winning
  }
  assert.equal(seq.length, n - 1);
  return seq;
}

/**
 * The PAIRING strategy at EXACTLY ceil(3n/2) - 2 plays, against the pairing
 * adversary: pair them up (floor(n/2) plays), king-of-the-hill the winners
 * (ceil(n/2) - 1), king-of-the-hill the min bracket — the pair losers plus
 * the odd leftover once it loses its first winner-bracket duel (ceil(n/2) -
 * 1). The min bracket is recomputed from the record's classes, not assumed.
 */
function pairingPlays(n: number): Array<[number, number]> {
  const seq: Array<[number, number]> = [];
  const winners: number[] = [];
  for (let x = 0; x + 1 < n; x += 2) {
    winners.push(playAgainst(n, seq, x, x + 1)); // the loser falls to the min bracket
  }
  if (n % 2 === 1) winners.push(n - 1); // the odd leftover rides the winner bracket
  let champ = winners[0]!;
  for (let k = 1; k < winners.length; k++) {
    champ = playAgainst(n, seq, champ, winners[k]!);
  }
  const mid = adversaryMinmax(n, seq);
  const minBracket = mid.classes
    .map((c, x) => (c === "MINC" || c === "NO" ? x : -1))
    .filter((x) => x >= 0);
  assert.equal(
    minBracket.length,
    Math.ceil(n / 2),
    "the min bracket is the pair losers plus the fallen leftover",
  );
  let cur = minBracket[0]!;
  for (let k = 1; k < minBracket.length; k++) {
    const w = playAgainst(n, seq, cur, minBracket[k]!);
    cur = w === cur ? minBracket[k]! : cur; // the LOSER carries on as the running minimum
  }
  assert.equal(
    seq.length,
    minmaxClosedForm(n),
    `the pairing strategy must be exactly ceil(3n/2) - 2 long at n=${n}`,
  );
  return seq;
}

describe("min&max optimality — the three-leg theorem, executed", () => {
  it("LEG A flat sweep: zero correct trees below the closed form, exact ordinals at the optimum (n = 3, 4)", () => {
    const at3 = exhaustiveMinmaxSweep(3, 2);
    assert.equal(at3.trees, 27);
    assert.equal(at3.correct, 0); // ceil(3n/2) - 3 = 2 — the forgery depth, all 27 trees die
    const opt3 = exhaustiveMinmaxSweep(3, 3);
    assert.equal(opt3.trees, 2187);
    assert.ok(opt3.correct > 0); // the optimum ceil(3n/2) - 2 = 3 carries correct trees
    assert.ok(opt3.correctAllLeafSeparated); // the weak counting bound held as data (>= n(n-1) leaves)
    const at4 = exhaustiveMinmaxSweep(4, 3);
    assert.equal(at4.trees, 6 ** 7);
    assert.equal(at4.correct, 0); // ceil(6) - 3 = 3 — every one of the 279,936 trees dies
  });

  it("LEG B game DFS: the exact optimum equals ceil(3n/2) - 2 for n = 2..6", () => {
    const expect: Array<[number, number]> = [
      [2, 1],
      [3, 3],
      [4, 4],
      [5, 6],
      [6, 7],
    ];
    for (const [n, q] of expect) {
      const r = findMinmaxOptimalDepth(n);
      assert.equal(r.optimum, q, `min&max optimum at n=${n}`);
      assert.equal(
        q,
        minmaxClosedForm(n),
        "the closed form is the machine optimum",
      );
    }
    // the R18 draft's prose "n=2 special case: 3 comparisons" — the machine
    // rules 1: compare the two, the winner is the max, the loser the min
    assert.equal(minmaxClosedForm(2), 1);
    assert.equal(findMinmaxOptimalDepth(2).optimum, 1);
  });

  it("the constructive witness: a correct flat tree at exactly the closed form's depth (n = 2..5)", () => {
    for (let n = 2; n <= 5; n++) {
      const tree = minmaxTreeWitness(n);
      assert.equal(tree.length, 2 ** minmaxClosedForm(n) - 1);
      const audit = auditMinmaxTree(n, tree);
      assert.ok(audit.correct, `the witness tree must audit correct at n=${n}`);
    }
  });

  it("the counting gate is exact BigInt: q >= ceil(log2(n(n-1))) — TIGHT at n=4, gapped at n=5,6 for the adversary", () => {
    const expect: Array<[number, number, string]> = [
      [3, 3, "6"],
      [4, 4, "12"],
      [6, 5, "30"],
      [12, 8, "132"],
    ];
    for (const [n, q, pairs] of expect) {
      const b = minmaxInfoBound(n);
      assert.equal(b.ceilingLog2Pairs, q, `ceil(log2 ${n}(n-1))`);
      assert.equal(b.pairs.toString(), pairs);
      assert.ok(b.pow2 >= b.pairs && b.pow2 / 2n < b.pairs);
    }
    assert.ok(
      minmaxInfoBound(4).ceilingLog2Pairs === 4 &&
        findMinmaxOptimalDepth(4).optimum === 4,
      "n=4: the counting bound TOUCHES the optimum — the only wall in the family where it does",
    );
    assert.ok(
      minmaxInfoBound(5).ceilingLog2Pairs === 5 &&
        findMinmaxOptimalDepth(5).optimum === 6,
      "the 5-vs-6 gap at n=5 is the pairing adversary's territory",
    );
    assert.ok(
      minmaxInfoBound(6).ceilingLog2Pairs === 5 &&
        findMinmaxOptimalDepth(6).optimum === 7,
      "the 5-vs-7 gap at n=6 is two comparisons wide — counting alone cannot see it",
    );
  });
});

describe("min&max adversary — the pairing argument as a machine invariant", () => {
  it("LEG C sweep: every adaptive strategy of k = ceil(3n/2) - 3 plays leaves min&max undetermined", () => {
    const expect: Array<[number, number, number]> = [
      [4, 3, 216],
      [5, 5, 100000],
    ];
    for (const [n, k, sequences] of expect) {
      const s = adversaryMinmaxSweepAllSequences(n, k);
      assert.equal(s.sequences, sequences);
      assert.equal(s.k, minmaxClosedForm(n) - 1);
      assert.ok(
        s.allInvariantsHeld,
        `pool-accounting/no-no-budget/drop-law invariants failed at n=${n}`,
      );
      assert.ok(s.allWitnessesValid, `witness orders failed at n=${n}`);
      assert.ok(
        s.allBlocked,
        `some strategy of ${k} plays determined both extrema at n=${n}`,
      );
    }
  });

  it("the sequential king-of-the-hill at n-1 plays: one champion, n-1 min candidates — blocked with named min witnesses", () => {
    const n = 6;
    const rec = adversaryMinmax(n, kingHillPlays(n));
    assert.equal(rec.k, n - 1);
    assert.ok(rec.poolAccountingHeld && rec.noNoBudgetHeld && rec.dropLawHeld);
    assert.equal(rec.maxCandidates.length, 1); // the champion
    assert.equal(rec.minCandidates.length, n - 1); // every victim is still a min candidate
    assert.equal(rec.blocked, "MIN-UNKNOWN");
    assert.equal(rec.witnesses.length, 2);
    assert.equal(new Set(rec.witnesses.map((w) => w.claimedMax)).size, 1); // both null
    assert.equal(new Set(rec.witnesses.map((w) => w.claimedMin)).size, 2); // different minima
    for (const w of rec.witnesses) {
      assert.equal(w.order[0], w.claimedMin); // the witness floors what it claims
    }
  });

  it("tightness: the pairing strategy determines both extrema at exactly ceil(3n/2) - 2 plays (even, odd, and n=2)", () => {
    for (const n of [2, 4, 5, 6]) {
      const rec = adversaryMinmax(n, pairingPlays(n));
      assert.equal(rec.k, minmaxClosedForm(n), `at n=${n}`);
      assert.ok(
        rec.poolAccountingHeld && rec.noNoBudgetHeld && rec.dropLawHeld,
        `invariants at n=${n}`,
      );
      assert.equal(
        rec.blocked,
        "DETERMINED",
        `the pairing play must determine both extrema at n=${n}`,
      );
      assert.equal(rec.witnesses.length, 0); // no witnesses when determined — nothing left to block
      assert.equal(rec.maxCandidates.length, 1);
      assert.equal(rec.minCandidates.length, 1);
      assert.notEqual(rec.maxCandidates[0], rec.minCandidates[0]);
    }
  });

  it("the drop law as data: n=6, every play's candidacy burn is 2 only on NO-vs-NO, else at most 1", () => {
    const rec = adversaryMinmax(6, pairingPlays(6));
    assert.equal(rec.drops.length, rec.k);
    let noNo = 0;
    for (const d of rec.drops) {
      assert.ok(d === 0 || d === 1 || d === 2);
      if (d === 2) noNo++;
    }
    assert.equal(noNo, Math.floor(6 / 2)); // the three paired duels are exactly the two-burn plays
    assert.ok(noNo <= Math.floor(6 / 2)); // the pairing budget, held as data
  });
});

describe("min&max smuggling trials — counterfeit trees are convicted by name", () => {
  it("the king-of-the-hill forgery at depth n-1 is convicted with the named leaf and pair", () => {
    // n = 4: depth 3 — the find-max-optimal tree is a min&max forgery
    const audit = auditMinmaxTree(4, kingHillTree(4));
    assert.ok(!audit.correct, "the max-only tree must be rejected");
    assert.ok(audit.inconsistentLeaf !== null);
    assert.ok(audit.wrongPerm !== null);
    assert.ok(audit.truePairOfWrong !== null && audit.leafClaimedPair !== null);
    assert.notDeepEqual(audit.truePairOfWrong, audit.leafClaimedPair); // the two pairs differ — named
    // the forged depth itself is convicted wholesale by the sweep (279,936 trees, zero correct)
    assert.equal(exhaustiveMinmaxSweep(4, 3).correct, 0);
  });

  it("minmaxOf pins the ordered pair exactly (the audit's own oracle)", () => {
    assert.deepEqual(minmaxOf([1, 0]), [1, 0]);
    assert.deepEqual(minmaxOf([0, 2, 1]), [0, 1]);
    assert.deepEqual(minmaxOf([3, 1, 2, 0]), [3, 0]);
    assert.deepEqual(minmaxOf([1, 2, 3, 4]), [0, 3]);
    assert.throws(() => minmaxOf([5]), /at least 2 elements/);
  });

  it("degenerate inputs are refused by description (house style)", () => {
    assert.throws(
      () =>
        auditMinmaxTree(4, [
          [0, 1],
          [0, 2],
        ]),
      /not 2\^depth - 1/,
    );
    assert.throws(
      () =>
        auditMinmaxTree(4, [
          [0, 0],
          [1, 2],
          [0, 1],
        ]),
      /compares an element with itself/,
    );
    assert.throws(
      () =>
        auditMinmaxTree(3, [
          [0, 5],
          [1, 2],
          [0, 1],
        ]),
      /outside \[0,3\)/,
    );
    assert.throws(
      () =>
        auditMinmaxTree(3, [
          [2, 1],
          [1, 2],
          [0, 1],
        ]),
      /not canonically oriented/,
    );
    assert.throws(() => adversaryMinmax(4, [[0, 0]]), /distinct elements/);
    assert.throws(() => exhaustiveMinmaxSweep(1, 2), /n must be an integer/);
    assert.throws(() => findMinmaxOptimalDepth(7), /n must be an integer/);
    assert.throws(() => minmaxInfoBound(21), /n must be an integer/);
    assert.throws(() => minmaxTreeWitness(1), /n must be an integer/);
  });
});
