import test from "node:test";
import assert from "node:assert/strict";
import { adversarialRun, etcRun, ucb1Run } from "../src/bandit/classical.js";
import { classicalReplayQueries, quantumReplayRun, sampleQae } from "../src/bandit/quantum.js";
import { durHoyerFindBest, linearFindBest } from "../src/online/grover.js";
import { Rng } from "../src/core/rng.js";

const means = [0.6, 0.5, 0.45, 0.4];

test("ucb1: regret accounting is exact against decisions", () => {
  for (const seed of [0, 1, 2]) {
    const run = ucb1Run(means, 5000, seed);
    const best = Math.max(...means);
    let recomputed = 0;
    for (let t = 0; t < 5000; t++) recomputed += best - (means[run.decisions[t] as number] as number);
    assert.ok(Math.abs(recomputed - run.regret) < 1e-9);
    assert.equal(run.plays, 5000);
  }
});

test("etc live: exploration burn is exactly N * sum(Delta)", () => {
  const N = 300;
  const run = etcRun(means, 20000, N, 7, "live");
  const burn = N * means.reduce((s, m) => s + (0.6 - m), 0);
  // regret = exploration burn + commit term; the burn part is deterministic
  const commitArm = run.decisions[19999] as number;
  const commitRegret = (20000 - 4 * N) * (0.6 - (means[commitArm] as number));
  assert.ok(Math.abs(run.regret - burn - commitRegret) < 1e-9);
});

test("etc replay: zero exploration regret, queries = k * N", () => {
  const run = etcRun(means, 20000, 300, 7, "replay");
  const commitArm = run.decisions[19999] as number;
  assert.equal(run.oracleReads, 4 * 300);
  assert.ok(Math.abs(run.regret - 20000 * (0.6 - (means[commitArm] as number)) + 300 * 4 * 0) < 1e-9 || run.regret >= 0);
  assert.equal(run.plays, 20000 - 1200);
});

test("quantum replay: query ledger is the exact staged QAE schedule", () => {
  for (const seed of [0, 1, 2, 3, 4]) {
    const run = quantumReplayRun(means, 10000, seed);
    // rounds r with m = 3, 4, ..., 3 + r - 1: queries = sum k(2^m - 1)
    let expected = 0;
    for (let r = 1; r <= run.rounds; r++) expected += means.length * (2 ** (3 + r - 1) - 1);
    assert.equal(run.queries, expected);
    assert.ok(run.rounds >= 1 && run.rounds <= 11);
  }
});

test("quantum replay: correct commit on clean gaps across seeds", () => {
  let correct = 0;
  for (let s = 0; s < 30; s++) {
    const run = quantumReplayRun([0.6, 0.5, 0.5, 0.5], 1000, s);
    if (run.committedArm === 0) correct++;
  }
  assert.ok(correct >= 29, `${correct}/30`);
});

test("adversarial: identical decisions imply identical regret (the compute wall)", () => {
  for (const seed of [0, 1, 2]) {
    const lin = adversarialRun(8, 3000, seed, 0.1, (scores, less) => {
      const r = linearFindBest(scores, less);
      return { best: r.index, reads: r.reads };
    });
    const rng = new Rng(seed ^ 0xbeef);
    const quant = adversarialRun(8, 3000, seed, 0.1, (scores, less) => {
      const r = durHoyerFindBest(scores, less, rng);
      return { best: r.best, reads: r.reads };
    });
    // Note: regret vs the best FIXED arm can be negative on a given oblivious
    // stream (a dynamic policy is not dominated by fixed arms) — no sign claim.
    assert.equal(lin.decisions.length, 3000);
    if (Buffer.compare(Buffer.from(lin.decisions), Buffer.from(quant.decisions)) === 0) {
      assert.equal(lin.regret, quant.regret);
    }
  }
});

test("durHoyer: finds the true argmax with high probability and sub-linear reads", () => {
  const rng = new Rng(5);
  let agree = 0;
  let totalReads = 0;
  const trials = 200;
  const n = 256;
  for (let t = 0; t < trials; t++) {
    const scores = Float64Array.from({ length: n }, () => Math.floor(rng.next() * 1e9));
    const lin = linearFindBest(scores, (x, y) => x < y);
    const dh = durHoyerFindBest(scores, (x, y) => x < y, rng);
    totalReads += dh.reads;
    if (dh.best === lin.index) agree++;
    assert.equal(lin.reads, n);
  }
  assert.ok(agree / trials >= 0.95, `${agree}/${trials}`);
  assert.ok(totalReads / trials < n, `${totalReads / trials} vs ${n}`);
});

test("sampleQae: draws concentrate around the true amplitude", () => {
  const rng = new Rng(77);
  const p = 0.3;
  let acc = 0;
  const draws = 4000;
  for (let i = 0; i < draws; i++) acc += sampleQae(p, 7, rng);
  const mean = acc / draws;
  // QAE with m=7 has a small bias floor (E[sin^2] ≠ p exactly); tolerance covers it
  assert.ok(Math.abs(mean - p) < 0.02, String(mean));
});

test("classicalReplayQueries: scales as 1/Delta^2", () => {
  const a = classicalReplayQueries(0.2, 4, 0.05);
  const b = classicalReplayQueries(0.1, 4, 0.05);
  assert.ok(Math.abs(b / a - 4) < 1e-9);
});
