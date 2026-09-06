/**
 * 任务三（01#18）A/B 交错基准：HEAD 基线（_x1_bench/baseline/src，即
 * 任务三改动前的工作树）vs 当前实现（ds/src）在同一进程内交替执行——
 * 机器状态漂移（本机实测存在整 机级降频）对两边均等作用，比值有效。
 * 运行：node --import tsx bench-ab.ts
 */
import * as oldCommon from '../_x1_bench/baseline/src/core/solver-common.js';
import * as newCommon from '../ds/src/core/solver-common.js';
import * as oldSub from '../_x1_bench/baseline/src/core/subspace-optimizer.js';
import * as newSub from '../ds/src/core/subspace-optimizer.js';
import { mulberry32 as oldRng } from '../_x1_bench/baseline/src/utils/rng.js';
import { couplingKey, type AssignmentProblem } from '../ds/src/core/quantum-optimizer.js';

function makeProblem(m: number, n: number, seed: number, coupled: boolean): AssignmentProblem {
  const rng = oldRng(seed);
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

/** 阶段1：坐标下降微观（隔离 descent 循环自身的分配/复制开销） */
function descentMicro(common: typeof oldCommon): number {
  const evaluate = (a: number[]): number => {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += a[i]! * a[i]! * (i + 1);
    return s;
  };
  let sink = 0;
  return timeMs(() => {
    for (let iter = 0; iter < 2000; iter++) {
      const r = common.optimizeAnglesByCoordinateDescent(evaluate, 4, 3, oldRng(42));
      sink += r.evaluations;
    }
    if (sink === -1) console.log(sink);
  });
}

/** 阶段2：种子化坐标下降（ma-QAOA 角度空间） */
function seededDescent(common: typeof oldCommon): number {
  const evaluate = (a: number[]): number => {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += a[i]! * a[i]! * (i + 1);
    return s;
  };
  const bounds = Array.from({ length: 12 }, (_, i) => (i < 4 ? Math.PI : Math.PI / 2));
  let sink = 0;
  return timeMs(() => {
    for (let iter = 0; iter < 1500; iter++) {
      const r = common.optimizeAnglesByCoordinateDescentSeeded(
        evaluate,
        12,
        bounds,
        2,
        oldRng(7),
        [0.4, 0.4, 0.4, 0.4, 0.3, 0.3, 0.3, 0.3, 0.2, 0.2, 0.2, 0.2],
      );
      sink += r.evaluations;
    }
    if (sink === -1) console.log(sink);
  });
}

/** 阶段3：子空间 QAOA 端到端（dim=2520） */
function qaoaSubspace(sub: typeof oldSub): number {
  const model = sub.buildSubspaceModel(makeProblem(5, 7, 3, true))!;
  let sink = 0;
  return timeMs(() => {
    for (let iter = 0; iter < 15; iter++) {
      const s = sub.qaoaSolveSubspace(model, { seed: 1234 });
      sink += s.evaluations;
    }
    if (sink === -1) console.log(sink);
  });
}

/** 阶段4：子空间退火端到端小维度（minMaxOf/collapse 遍历路径） */
function annealSubspace(sub: typeof oldSub): number {
  const model = sub.buildSubspaceModel(makeProblem(4, 6, 5, true))!;
  let sink = 0;
  return timeMs(() => {
    for (let iter = 0; iter < 300; iter++) {
      const s = sub.annealSolveSubspace(model, { seed: 7, anneal: { tau: 20, steps: 60 } });
      sink += s.layers;
    }
    if (sink === -1) console.log(sink);
  });
}

const phases: Array<[string, (impl: 'old' | 'new') => number]> = [
  ['descent-micro   ', (which) => descentMicro(which === 'old' ? oldCommon : newCommon)],
  ['seeded-descent  ', (which) => seededDescent(which === 'old' ? oldCommon : newCommon)],
  ['qaoa-subspace   ', (which) => qaoaSubspace(which === 'old' ? oldSub : newSub)],
  ['anneal-subspace ', (which) => annealSubspace(which === 'old' ? oldSub : newSub)],
];

console.log('node', process.version, '· A/B 交错（每轮 old→new 相邻执行，机器漂移均等）');
const summary: Array<[string, number, number]> = [];
for (const [name, run] of phases) {
  run('old');
  run('new'); // 双预热
  const oldRuns: number[] = [];
  const newRuns: number[] = [];
  for (let round = 0; round < 3; round++) {
    oldRuns.push(run('old'));
    newRuns.push(run('new'));
  }
  const bestOld = Math.min(...oldRuns);
  const bestNew = Math.min(...newRuns);
  summary.push([name, bestOld, bestNew]);
  console.log(
    `${name} old best=${bestOld.toFixed(1)}ms [${oldRuns.map((r) => r.toFixed(0)).join(',')}]  ` +
      `new best=${bestNew.toFixed(1)}ms [${newRuns.map((r) => r.toFixed(0)).join(',')}]  ` +
      `ratio(new/old)=${(bestNew / bestOld).toFixed(3)}`,
  );
}
const geomean = Math.exp(
  summary.reduce((acc, [, o, n]) => acc + Math.log(n / o), 0) / summary.length,
);
console.log(`几何平均 ratio(new/old) = ${geomean.toFixed(3)}`);
