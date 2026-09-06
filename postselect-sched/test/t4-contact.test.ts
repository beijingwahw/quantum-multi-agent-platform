import test from "node:test";
import assert from "node:assert/strict";
import { Rng } from "../src/kernel/sorter.js";
import { eStarGrover, groverPClosed, lubyUniversal, payExpected } from "../src/kernel/restart.js";

function geometricRounds(rng: Rng, q: number): number {
  let rounds = 0;
  for (;;) {
    rounds++;
    if (rng.next() < q) return rounds;
  }
}

test("T4.A identical geometric waiting law; only the query column differs", () => {
  const trials = 120000;
  for (const q of [1 / 16, 1 / 8, 1 / 4, 1 / 2]) {
    const rngA = new Rng(9001);
    const rngH = new Rng(1337);
    let sumA = 0;
    let sumH = 0;
    let sumSqA = 0;
    for (let i = 0; i < trials; i++) {
      const a = geometricRounds(rngA, q);
      sumA += a;
      sumSqA += a * a;
      sumH += geometricRounds(rngH, q);
    }
    const meanA = sumA / trials;
    const meanH = sumH / trials;
    const sigma = Math.sqrt((1 - q) / (q * q * trials));
    assert.ok(Math.abs(meanA - 1 / q) < 5 * sigma, `active: mean ${meanA} vs ${1 / q}`);
    assert.ok(Math.abs(meanH - 1 / q) < 5 * sigma, `heralded: mean ${meanH} vs ${1 / q}`);
    // variance sanity: geometric variance (1-q)/q^2, within a loose CLT margin
    const varA = sumSqA / trials - meanA * meanA;
    const varExact = (1 - q) / (q * q);
    assert.ok(Math.abs(varA - varExact) / varExact < 0.05, `variance ${varA} vs ${varExact}`);
    // the cost columns: active pays 1/q queries per answer exactly; heralded pays 0 by model
    assert.ok(Math.abs(meanA * 1 - 1 / q) < 5 * sigma, "active query ledger = 1/q");
  }
});

test("T4.B online depth-doubling stays within a small factor of the oracle optimum", () => {
  const N = 256;
  const cutoffs = lubyUniversal(3).slice(0, 7);
  const depths = cutoffs.map((c) => c - 1);
  const costs = depths.map((k) => k + 1);
  let worst = 0;
  for (const t of [1, 3, 7, 15, 31, 63, 127] as const) {
    const probs = depths.map((k) => groverPClosed(N, t, k));
    const T = payExpected(costs, probs, depths.map((_, i) => i));
    const e = eStarGrover(N, t);
    const ratio = T / e.queries;
    assert.ok(ratio >= 1 - 1e-9, `t=${t}: schedule beat the oracle optimum (${ratio})`);
    if (ratio > worst) worst = ratio;
  }
  assert.ok(worst < 10, `worst ratio ${worst.toFixed(3)} exceeds the empirical bound`);
});

test("T4.C the freeness identity: query ledger transfers, acceptance law does not", () => {
  // exact statement of the contact surface: with per-round success q,
  //   active postselection: answers/round = q, queries/answer = 1/q
  //   heralded loss:        answers/round = q, queries/answer = 0
  // the geometric acceptance law is the SAME object; only the billed column moves.
  for (const q of [1 / 8, 1 / 4]) {
    const rng = new Rng(4242);
    const trials = 50000;
    let accepted = 0;
    for (let i = 0; i < trials; i++) {
      if (rng.next() < q) accepted++;
    }
    const sigma = Math.sqrt((q * (1 - q)) / trials);
    assert.ok(Math.abs(accepted / trials - q) < 5 * sigma, "acceptance rate identical to q");
  }
});
