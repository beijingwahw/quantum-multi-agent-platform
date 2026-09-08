import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { QramError, type QramErrorCode } from "../src/core/errors.js";
import { REPLAY_SEED_XOR, Rng } from "../src/core/rng.js";
import { hittingTime, jacobiEigenvalues, luSolve } from "../src/core/linalg.js";
import {
  groverFullSpace,
  groverSuccessClosedForm,
  mcMedianError,
  qaeDistribution,
  qaeEstimate,
  qaeQueries,
} from "../src/ae/ampest.js";
import { BucketBrigadeQram, queryFailureProb } from "../src/qram/bucket.js";
import { monteCarloMean } from "../src/qram/stream.js";
import { groverFindMarked, linearFindBest, linearFindMarked } from "../src/online/grover.js";
import { greedyMatch, rankingMatchWithRank } from "../src/online/matching.js";
import {
  derangement,
  deterministicGreedyHalfInstance,
  monotoneInstance,
  sampleDnMember,
} from "../src/online/kv-tight.js";
import { adversarialRun, ucb1Run } from "../src/bandit/classical.js";
import { classicalReplayQueries, quantumReplayRun } from "../src/bandit/quantum.js";
import { chainFromGraph, lazyChain, SzegedyWalk, uniformAwayFrom, type Chain } from "../src/walk/szegedy.js";

// ---------------------------------------------------------------------------
// 走私审判 #3 (v0.3.0): 非法输入在公共内核处必须被"点名"(BY ERROR CODE)驳回 —
// 不是静默 NaN、不是伪造见证、不是吞掉的 undefined。此前这些路径全部返回
// 垃圾值:pick([]) 给出 undefined as T、linearFindBest([]) 伪造 index 0、
// 错维矩阵给出 NaN 解、越界邻居被 Uint8Array 越界读写静默吞掉。
// ---------------------------------------------------------------------------

test("走私审判 #3: illegal inputs at every public kernel are rejected BY ERROR CODE", () => {
  const qram2 = new BucketBrigadeQram(2);
  const twoState: Chain = { n: 2, neighbors: [[0, 1], [1, 0]], probs: [[0.5, 0.5], [0.5, 0.5]] };
  const asym: Chain = { n: 2, neighbors: [[1], [1]], probs: [[1], [1]] };
  const trials: ReadonlyArray<[string, () => unknown, QramErrorCode]> = [
    // core
    ["pick empty", () => new Rng(1).pick([]), "RNG_EMPTY_PICK"],
    ["int(0)", () => new Rng(1).int(0), "RNG_INT_RANGE"],
    ["bernoulli p>1", () => new Rng(1).bernoulli(1.5), "RNG_BERNOULLI_RANGE"],
    ["luSolve shape", () => luSolve(2, new Float64Array(3), new Float64Array(2)), "LINALG_SHAPE"],
    ["luSolve singular", () => luSolve(1, new Float64Array([0]), new Float64Array([1])), "LINALG_SINGULAR"],
    ["jacobi shape", () => jacobiEigenvalues(2, new Float64Array(3)), "LINALG_SHAPE"],
    ["hittingTime shape", () => hittingTime(2, new Float64Array(3), new Set([0]), new Float64Array(2)), "LINALG_SHAPE"],
    ["hittingTime target range", () => hittingTime(2, new Float64Array(4), new Set([7]), new Float64Array(2)), "LINALG_SHAPE"],
    // ae
    ["qaeDistribution p", () => qaeDistribution(1, 4), "AE_P_RANGE"],
    ["qaeDistribution m", () => qaeDistribution(0.4, 0), "AE_M_RANGE"],
    ["qaeEstimate register", () => qaeEstimate(16, 4), "AE_REGISTER_RANGE"],
    ["qaeQueries m", () => qaeQueries(0), "AE_M_RANGE"],
    ["closed form p", () => groverSuccessClosedForm(1.5, 1), "AE_P_RANGE"],
    ["closed form k", () => groverSuccessClosedForm(0.5, -1), "AE_K_RANGE"],
    ["mcMedianError params", () => mcMedianError(0.4, 0, 10, 1), "AE_MC_PARAMS"],
    ["fullspace marked range", () => groverFullSpace(3, [9], 1), "AE_FULLSPACE_PARAMS"],
    ["fullspace duplicate marked", () => groverFullSpace(3, [2, 2], 1), "AE_FULLSPACE_PARAMS"],
    // qram
    ["queryFailureProb p", () => queryFailureProb("bucket-brigade", 3, 1.5), "QRAM_P_RANGE"],
    ["monteCarloMean draws", () => monteCarloMean(qram2, 0, Math.random), "STREAM_DRAWS"],
    // online search
    ["linearFindBest empty", () => linearFindBest([], (x, y) => x < y), "GROVER_EMPTY_SCORES"],
    ["groverFindMarked n", () => groverFindMarked(0, () => true, new Rng(1)), "GROVER_N_RANGE"],
    ["linearFindMarked n", () => linearFindMarked(0, () => true), "GROVER_N_RANGE"],
    // matching
    ["greedyMatch OOB neighbor", () => greedyMatch({ n: 2, arrivals: [[5]] }, new Rng(0), "linear"), "OBM_INSTANCE_SHAPE"],
    ["rankingMatchWithRank rank shape", () => rankingMatchWithRank({ n: 3, arrivals: [[0]] }, [0, 1], "linear", new Rng(0)), "OBM_RANK_SHAPE"],
    ["monotoneInstance range", () => monotoneInstance(0), "MATCH_ARG_RANGE"],
    ["sampleDnMember range", () => sampleDnMember(0, new Rng(0)), "MATCH_ARG_RANGE"],
    ["derangement range", () => derangement(-1), "MATCH_ARG_RANGE"],
    ["phase adversary odd n", () => deterministicGreedyHalfInstance(3, "lowest"), "MATCH_EVEN_N"],
    // bandit
    ["ucb1Run no arms", () => ucb1Run([], 10, 1), "BANDIT_NO_ARMS"],
    ["ucb1Run means range", () => ucb1Run([0.5, 1.5], 10, 1), "BANDIT_MEANS_RANGE"],
    ["adversarialRun gamma", () => adversarialRun(2, 10, 1, 1.5, (s, l) => { const r = linearFindBest(s, l); return { best: r.index, reads: r.reads }; }), "BANDIT_ARG_RANGE"],
    ["quantumReplayRun schedule", () => quantumReplayRun([0.5, 0.4], 10, 1, 5, 3), "BANDIT_ARG_RANGE"],
    ["classicalReplayQueries delta", () => classicalReplayQueries(0, 2, 0.05), "BANDIT_ARG_RANGE"],
    ["classicalReplayQueries failureProb", () => classicalReplayQueries(0.1, 2, 1), "BANDIT_ARG_RANGE"],
    // walk
    ["chainFromGraph neighbor", () => chainFromGraph([[2]]), "WALK_NEIGHBOR_RANGE"],
    ["chainFromGraph isolated", () => chainFromGraph([[]]), "WALK_ISOLATED_VERTEX"],
    ["uniformAwayFrom target", () => uniformAwayFrom(3, new Set([5])), "WALK_TARGET_RANGE"],
    ["walk marked target", () => new SzegedyWalk(twoState, [7]), "WALK_TARGET_RANGE"],
    ["walk mu shape", () => new SzegedyWalk(twoState, [1]).initialState(new Float64Array(3)), "WALK_MU_SHAPE"],
    ["walk asymmetric support", () => new SzegedyWalk(asym, [0]), "WALK_ASYMMETRIC_SUPPORT"],
    ["lazyChain shape", () => lazyChain({ n: 2, neighbors: [[1]], probs: [[1], [1]] }), "WALK_CHAIN_SHAPE"],
  ];
  for (const [name, fn, code] of trials) {
    assert.throws(
      fn,
      (e: unknown) => {
        assert.ok(e instanceof QramError, `${name}: not a QramError: ${String(e)}`);
        assert.equal(e.code, code, `${name}: wrong code (got ${e.code})`);
        return true;
      },
      `${name} must be rejected`,
    );
  }
});

test("error surface law: every src rejection goes through the named-code channel", () => {
  // Regression guard for face B: an untyped `throw new Error(` anywhere in src
  // recreates the anonymous-throw surface this wave retired.
  const srcRoot = join(import.meta.dirname, "../src");
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name.endsWith(".ts")) files.push(p);
    }
  };
  walk(srcRoot);
  assert.ok(files.length >= 20, `expected the full src tree, found ${files.length} files`);
  let rejectSites = 0;
  for (const f of files) {
    const content = readFileSync(f, "utf8");
    assert.ok(!content.includes("throw new Error("), `${f}: untyped throw resurrected`);
    rejectSites += (content.match(/reject\(/g) ?? []).length;
  }
  assert.ok(rejectSites >= 60, `expected the coded-guard surface, found ${rejectSites} reject() sites`);
});

test("convention anchors: seed-0 remap and the single-sourced replay XOR", () => {
  // Rng(0) remaps to the golden-ratio-derived state (never the absorbing 0).
  const a = new Rng(0);
  const b = new Rng(0x9e3779b9);
  for (let i = 0; i < 100; i++) assert.equal(a.next(), b.next());
  // The replay-seed convention is single-sourced (v0.3.0 face C): value pinned.
  assert.equal(REPLAY_SEED_XOR, 0x5f356495);
});

test("dead-export purge holds: no zombie bank helpers on the matching module", async () => {
  // v0.3.0 face E deleted arrivalReadProfile and ratioBank (zero references,
  // superseded by the inlined bank loops of EXP5/tests). They must stay dead.
  const mod = (await import("../src/online/matching.js")) as unknown as Record<string, unknown>;
  assert.equal(mod.ratioBank, undefined, "ratioBank resurrected");
  assert.equal(mod.arrivalReadProfile, undefined, "arrivalReadProfile resurrected");
});

test("BBHT schedule exact-value anchors: single source, unchanged ledgers", () => {
  // Empty marked set charges exactly kMax = max(1, ceil(sqrt(n))) reads.
  assert.equal(groverFindMarked(4, () => false, new Rng(5)).reads, 2);
  assert.equal(groverFindMarked(9, () => false, new Rng(5)).reads, 3);
  assert.equal(groverFindMarked(1, () => false, new Rng(5)).reads, 1);
  // Linear marked scan is first-found semantics with exact read counts.
  assert.deepEqual(linearFindMarked(12, (i) => i === 5), { index: 5, reads: 6 });
});

test("degenerate legality anchors: the new guards do not over-reject", () => {
  // Single-arm bank (k = 1) is legal: gap is NaN, never commits early, ends on
  // the only arm — regret exactly 0 and the full default schedule 3..13.
  const solo = quantumReplayRun([0.7], 500, 11);
  assert.equal(solo.regret, 0);
  assert.equal(solo.committedArm, 0);
  assert.equal(solo.rounds, 11);
  assert.equal(solo.queries, (2 ** 14 - 2 ** 3) - 11);
  // All-target hitting time is exactly 0 (already absorbed), not an error.
  const ht = hittingTime(3, new Float64Array(9).fill(1 / 3), new Set([0, 1, 2]), new Float64Array(3).fill(1 / 3));
  assert.equal(ht, 0);
  // Empty-neighbor arrival lists remain legal instances (arrival skipped).
  assert.equal(greedyMatch({ n: 3, arrivals: [[], [0]] }, new Rng(0), "linear").size, 1);
});
