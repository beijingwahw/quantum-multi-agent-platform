/**
 * Wave-7 quality face: tests added by the code-quality upgrade.
 *
 *  1. the machine-certificate census — the id list runMachineCertificates()
 *     emits is pinned exactly, so a deleted or renamed certificate check can
 *     no longer pass silently (before this, dropping a push{} left every
 *     remaining check green);
 *  2. the Rng reproducibility root — every reported number regenerates from
 *     this class ("the atlas's own rng"); its stream is now pinned to exact
 *     float anchors so any drift in generation order fails loudly;
 *  3. single-source anchors — the merged helpers (fitSlope, randInts, fmt)
 *     carry exact-value and exact-render regressions;
 *  4. the error face as negative controls — every documented precondition
 *     throw is exercised (a contract that is never tested is a wish).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Rng } from "../src/core/rng.js";
import { fitSlope, hoeffdingShots, median, randInts } from "../src/core/stats.js";
import { runMachineCertificates } from "../src/atlas/check.js";
import { embed } from "../src/genealogy/nosignal.js";
import { postselectCount, postselectSearch } from "../src/genealogy/postselect.js";
import { groverSuccessExact } from "../src/upper/grover.js";
import { fptasP2 } from "../src/reductions/fptas.js";
import { fmt, table } from "../src/experiments/report.js";

describe("quality: machine-certificate census", () => {
  it("runMachineCertificates emits exactly the 13 registered checks, in order, all passing", () => {
    const checks = runMachineCertificates();
    assert.deepEqual(
      checks.map((c) => c.id),
      [
        "partition-reduction",
        "threepartition-reduction",
        "johnson-exact",
        "fptas-ratio",
        "ising-parity",
        "grover-three-way",
        "dh-min",
        "bbbv-hybrid",
        "classical-trees",
        "stoq-dichotomy",
        "witness-law",
        "postselect-ledger",
        "nosignal-withdrawal",
      ],
    );
    for (const c of checks) {
      assert.equal(c.pass, true, `${c.id}: ${c.detail}`);
      assert.ok(c.detail.length > 0, `${c.id}: detail must carry the measured numbers`);
    }
  });
});

describe("quality: Rng reproducibility root", () => {
  it("Rng(1) stream pinned to exact float anchors (regeneration is bit-for-bit)", () => {
    const r = new Rng(1);
    assert.deepEqual([r.next(), r.next(), r.next(), r.next()], [
      0.6270739405881613, 0.002735721180215478, 0.5274470399599522, 0.9810509674716741,
    ]);
  });

  it("two instances of the same seed produce identical streams; different seeds diverge", () => {
    const a = new Rng(1234);
    const b = new Rng(1234);
    let identical = true;
    for (let i = 0; i < 1000; i++) if (a.next() !== b.next()) identical = false;
    assert.equal(identical, true);
    const c = new Rng(11);
    const d = new Rng(12);
    let diverged = false;
    for (let i = 0; i < 100; i++) if (c.next() !== d.next()) diverged = true;
    assert.equal(diverged, true, "distinct seeds must produce distinct streams");
  });

  it("int(n) hits both bounds of [0, n) over 10000 draws; bernoulli(0.3) count pinned at 2994", () => {
    const r = new Rng(2026);
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < 10000; i++) {
      const v = r.int(7);
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
    assert.equal(min, 0);
    assert.equal(max, 6);
    const b = new Rng(99);
    let trues = 0;
    for (let i = 0; i < 10000; i++) if (b.bernoulli(0.3)) trues++;
    assert.equal(trues, 2994, "seeded bernoulli count is deterministic — pin it, don't band it");
  });

  it("shuffle is seed-deterministic, multiset-preserving, and identity at n=1", () => {
    const s1 = new Rng(7).shuffle([1, 2, 3, 4, 5, 6]);
    const s2 = new Rng(7).shuffle([1, 2, 3, 4, 5, 6]);
    assert.deepEqual(s1, [5, 2, 3, 4, 6, 1]);
    assert.deepEqual(s1, s2);
    const big = Array.from({ length: 100 }, (_, i) => i);
    const shuffled = new Rng(314).shuffle([...big]);
    assert.deepEqual([...shuffled].sort((x, y) => x - y), big);
    assert.deepEqual(new Rng(1).shuffle([42]), [42]);
  });
});

describe("quality: single-source anchors (the merged helpers)", () => {
  it("fitSlope is exact on dyadic data: slope 2 for y = 2x + 1", () => {
    assert.equal(fitSlope([1, 2, 3, 4], [3, 5, 7, 9]), 2);
  });

  it("median/hoeffdingShots exact anchors", () => {
    assert.equal(median([3, 1, 2]), 2);
    assert.equal(median([4, 1, 3, 2]), 2.5);
    assert.equal(hoeffdingShots(1, 0.1, 2), 6); // ceil(4 * ln 20 / 2) = ceil(5.9914...) = 6
  });

  it("randInts: bounds, length, determinism (the former triple's single source)", () => {
    const xs = randInts(new Rng(5), 50, 3, 9);
    assert.equal(xs.length, 50);
    for (const x of xs) assert.ok(x >= 3 && x <= 9 && Number.isInteger(x));
    assert.deepEqual(randInts(new Rng(5), 50, 3, 9), xs);
  });

  it("report fmt/table render exactly (toFixed convention — the semantic the live twin carries)", () => {
    assert.equal(fmt(1.5, 2), "1.50");
    assert.equal(fmt(2, 3), "2.000");
    assert.equal(fmt(Number.NaN, 3), "NaN");
    assert.equal(fmt(Number.POSITIVE_INFINITY), "Infinity");
    assert.equal(table(["a", "b"], [["1", "2"]]), "| a | b |\n| --- | --- |\n| 1 | 2 |");
  });
});

describe("quality: error face — documented preconditions throw (negative controls)", () => {
  it("postselectSearch rejects empty marked sets and out-of-range addresses", () => {
    assert.throws(() => postselectSearch(8, []), /need at least one marked item/);
    assert.throws(() => postselectSearch(4, [16]), /marked address 16 outside the 4-qubit address space \[0, 16\)/);
  });

  it("postselectCount rejects predicate tables that are not length 2^n", () => {
    assert.throws(() => postselectCount(4, [true, false], [true]), /predicate tables must have length 2\^n/);
  });

  it("groverSuccessExact rejects out-of-range marked addresses", () => {
    assert.throws(() => groverSuccessExact(16, [16], 1), /marked address 16 outside \[0, 16\)/);
  });

  it("fptasP2 rejects non-positive eps (exact solving is minMakespanP2's job)", () => {
    assert.throws(() => fptasP2([3, 1, 4], 0), /eps must be positive/);
    assert.throws(() => fptasP2([3, 1, 4], -0.1), /eps must be positive/);
  });

  it("embed rejects unitary/target-arity dimension mismatch", () => {
    const u2 = { dim: 2, re: [[1, 0], [0, 1]], im: [[0, 0], [0, 0]] };
    assert.throws(() => embed(u2, [0, 1], 2), /unitary dim 2 does not match 4 = 2\^2 target qubits/);
  });
});
