/**
 * 任务三（01#18）基准：solver-common 热路径分配消减的前后对照。
 * 固定种子、固定实例、固定迭代数；每阶段 3 轮取最优（最优 ≈ 噪声下界）。
 * 运行：node --import tsx bench-solver-hotpath.ts   （于 _x1_bench 目录）
 */
import {
  optimizeAnglesByCoordinateDescent,
  optimizeAnglesByCoordinateDescentSeeded,
} from '../ds/src/core/solver-common.js';
import {
  buildSubspaceModel,
  qaoaSolveSubspace,
  annealSolveSubspace,
} from '../ds/src/core/subspace-optimizer.js';
import { couplingKey, type AssignmentProblem } from '../ds/src/core/quantum-optimizer.js';
import { mulberry32 } from '../ds/src/utils/rng.js';

function makeProblem(m: number, n: number, seed: number, coupled: boolean): AssignmentProblem {
  const rng = mulberry32(seed);
  const weights = Array.from({ length: m }, () =>
    Array.from({ length: n }, () => +(0.15 + 0.7 * rng()).toFixed(3)),
  );
  const problem: AssignmentProblem = {
    taskIds: Array.from({ length: m }, (_, i) => `t${i}`),
    agentIds: Array.from({ length: n }, (_, i) => `a${i}`),
    weights,
    ineligible: weights.map((row) => row.map(() => false)),
    couplings: new Map(),
    penaltyOneHot: 0,
    penaltyCapacity: 0,
  };
  if (coupled) {
    for (let t1 = 0; t1 + 1 < m; t1 += 2) {
      problem.couplings.set(couplingKey(t1 * n, (t1 + 1) * n + 1, m * n), 0.35);
    }
  }
  return problem;
}

function timeMs(fn: () => void): number {
  const t0 = process.hrtime.bigint();
  fn();
  return Number(process.hrtime.bigint() - t0) / 1e6;
}

/** 阶段1：纯坐标下降微观（隔离 solver-common 循环自身的分配开销） */
function benchDescentMicro(): number {
  const evaluate = (a: number[]): number => {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += a[i]! * a[i]! * (i + 1);
    return s;
  };
  let sink = 0;
  return timeMs(() => {
    for (let iter = 0; iter < 2000; iter++) {
      const r = optimizeAnglesByCoordinateDescent(evaluate, 4, 3, mulberry32(42));
      sink += r.evaluations;
    }
    if (sink === -1) console.log(sink);
  });
}

/** 阶段2：种子化坐标下降（ma-QAOA 变体，角度数更多 → 分配开销占比更高） */
function benchSeededDescent(): number {
  const evaluate = (a: number[]): number => {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += a[i]! * a[i]! * (i + 1);
    return s;
  };
  const bounds = Array.from({ length: 12 }, (_, i) => (i < 4 ? Math.PI : Math.PI / 2));
  let sink = 0;
  return timeMs(() => {
    for (let iter = 0; iter < 1500; iter++) {
      const r = optimizeAnglesByCoordinateDescentSeeded(
        evaluate,
        12,
        bounds,
        2,
        mulberry32(7),
        [0.4, 0.4, 0.4, 0.4, 0.3, 0.3, 0.3, 0.3, 0.2, 0.2, 0.2, 0.2],
      );
      sink += r.evaluations;
    }
    if (sink === -1) console.log(sink);
  });
}

/** 阶段3：子空间 QAOA 端到端（dim=2520，每求解含数百次评估） */
function benchQaoaSubspace(): number {
  const model = buildSubspaceModel(makeProblem(5, 7, 3, true))!;
  let sink = 0;
  return timeMs(() => {
    for (let iter = 0; iter < 40; iter++) {
      const s = qaoaSolveSubspace(model, { seed: 1234 });
      sink += s.evaluations;
    }
    if (sink === -1) console.log(sink);
  });
}

/** 阶段4：子空间退火端到端小维度（minMaxOf/collapse 的 TypedArray 遍历） */
function benchAnnealSubspace(): number {
  const model = buildSubspaceModel(makeProblem(4, 6, 5, true))!;
  let sink = 0;
  return timeMs(() => {
    for (let iter = 0; iter < 300; iter++) {
      const s = annealSolveSubspace(model, { seed: 7, anneal: { tau: 20, steps: 60 } });
      sink += s.layers;
    }
    if (sink === -1) console.log(sink);
  });
}

const phases: Array<[string, () => number]> = [
  ['descent-micro (2000 iters)', benchDescentMicro],
  ['seeded-descent (1500 iters)', benchSeededDescent],
  ['qaoa-subspace d=2520 (40 solves)', benchQaoaSubspace],
  ['anneal-subspace d=360 (300 solves)', benchAnnealSubspace],
];

console.log('node', process.version);
for (const [name, fn] of phases) {
  fn(); // 预热（JIT 编译 + 内联缓存）
  const runs = [fn(), fn(), fn()];
  const best = Math.min(...runs);
  console.log(
    `${name}: best=${best.toFixed(1)}ms  runs=[${runs.map((r) => r.toFixed(1)).join(', ')}]`,
  );
}
