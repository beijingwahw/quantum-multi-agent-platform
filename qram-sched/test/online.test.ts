import test from "node:test";
import assert from "node:assert/strict";
import { cascadeInstance, greedyMatch, kuhnMaxMatching, randomInstance, rankingMatch } from "../src/online/matching.js";
import { groverFindMarked, linearFindMarked } from "../src/online/grover.js";
import { Rng } from "../src/core/rng.js";

test("kuhn: exact maximum matching anchors", () => {
  const cascade = cascadeInstance(8);
  assert.equal(kuhnMaxMatching(cascade), 16); // every pair contributes 2
  const inst = { n: 3, arrivals: [[0, 1], [0, 1], [2]] };
  assert.equal(kuhnMaxMatching(inst), 3);
  const empty = { n: 3, arrivals: [[], [0]] };
  assert.equal(kuhnMaxMatching(empty), 1);
});

test("greedy-lowest on the cascade: exactly 1/2 (the deterministic greedy cap)", () => {
  const inst = cascadeInstance(16);
  const opt = kuhnMaxMatching(inst);
  const g = greedyMatch(inst, new Rng(1), "linear", "lowest");
  assert.equal(g.size, opt / 2);
});

test("cascade: uniform-tie greedy and RANKING sit at 3/4", () => {
  const inst = cascadeInstance(16);
  const opt = kuhnMaxMatching(inst);
  let gu = 0;
  let rk = 0;
  for (let s = 0; s < 300; s++) {
    gu += greedyMatch(inst, new Rng(s), "linear", "uniform").size;
    rk += rankingMatch(inst, new Rng(s), "linear").size;
  }
  assert.ok(Math.abs(gu / 300 / opt - 0.75) < 0.02, String(gu / 300 / opt));
  assert.ok(Math.abs(rk / 300 / opt - 0.75) < 0.02, String(rk / 300 / opt));
});

test("random banks: greedy and RANKING indistinguishable on random families; floors hold", () => {
  // No dominance theorem exists between greedy-uniform and RANKING per instance;
  // the caps (1/2 and 1 - 1/e) are worst-case guarantees. We check the floors.
  let gr = 0;
  let rr = 0;
  let counted = 0;
  let minRank = 1;
  for (let s = 0; s < 40; s++) {
    const inst = randomInstance(64, 64, 0.08, new Rng(4000 + s));
    const opt = kuhnMaxMatching(inst);
    if (opt === 0) continue;
    const g = greedyMatch(inst, new Rng(s), "linear").size / opt;
    const r = rankingMatch(inst, new Rng(s), "linear").size / opt;
    gr += g;
    rr += r;
    counted++;
    minRank = Math.min(minRank, r);
  }
  assert.ok(Math.abs(rr / counted - gr / counted) <= 0.05);
  assert.ok(minRank > 1 - 1 / Math.E - 0.05, String(minRank));
});

test("ranking: Durr-Hoyer inner search preserves match quality and cuts reads", () => {
  let linSize = 0;
  let quantSize = 0;
  let linReads = 0;
  let quantReads = 0;
  for (let s = 0; s < 15; s++) {
    const inst = randomInstance(128, 96, 0.06, new Rng(6000 + s));
    const lin = rankingMatch(inst, new Rng(s), "linear");
    const quant = rankingMatch(inst, new Rng(s), "grover");
    linSize += lin.size;
    quantSize += quant.size;
    linReads += lin.reads;
    quantReads += quant.reads;
  }
  // bounded-error search: match sizes agree within the miss budget
  assert.ok(Math.abs(linSize - quantSize) <= 8, `${linSize} vs ${quantSize}`);
  assert.ok(quantReads < linReads * 0.6, `${quantReads} vs ${linReads}`);
});

test("groverFindMarked: never returns an unmarked index", () => {
  const rng = new Rng(9);
  for (let trial = 0; trial < 200; trial++) {
    const n = 64;
    const markedSet = new Set<number>();
    while (markedSet.size < 1 + rng.int(8)) markedSet.add(rng.int(n));
    const isMarked = (i: number) => markedSet.has(i);
    const r = groverFindMarked(n, isMarked, rng);
    assert.ok(r.index === -1 || isMarked(r.index));
    if (markedSet.size > 4) assert.ok(r.index >= 0, "should find when marked density is high");
  }
});

test("linearFindMarked: first-found semantics", () => {
  const marked = [5, 9];
  const r = linearFindMarked(12, (i) => marked.includes(i));
  assert.equal(r.index, 5);
  assert.equal(r.reads, 6);
  const none = linearFindMarked(10, () => false);
  assert.equal(none.index, -1);
  assert.equal(none.reads, 10);
});
