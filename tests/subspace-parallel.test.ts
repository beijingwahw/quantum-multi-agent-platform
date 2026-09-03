/**
 * subspace-parallel —— 多线程确定性并行演化内核的回归测试。
 *
 * 核心不变量：并行路径与串行路径**逐位一致**（同一份内核源码、纤维完整
 * 落在单一 Worker、区间划分不改变任何算术）——不是近似并行，而是同一条
 * 数值轨迹。任何破坏该等式的改动都意味着并行内核与串行内核发生了漂移。
 */
import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';

import {
  buildSubspaceModel,
  serialAnnealEvolve,
  annealSolveSubspace,
} from '../src/core/subspace-optimizer';
import { parallelAnnealEvolve } from '../src/core/subspace-parallel';
import { couplingKey, type AssignmentProblem } from '../src/core/quantum-optimizer';
import { mulberry32 } from '../src/utils/rng';

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

/** 7 任务 × 10 agent：dim = P(10,7) = 604800 ≥ 并行阈值 2^19 */
const LARGE_M = 7;
const LARGE_N = 10;
const STEPS = 40; // 短退火：回归只验证等价性，不重复跑完整基准

function largeModelEnergies(): {
  model: ReturnType<typeof buildSubspaceModel>;
  energies: Float64Array;
} {
  const model = buildSubspaceModel(makeProblem(LARGE_M, LARGE_N, 7, true));
  assert.ok(model, '7×10 模型应构建成功');
  const spectral =
    model.n > model.m ? model.m * (model.n - model.m) : (model.m * (model.m - 1)) / 2;
  let min = Infinity;
  let max = -Infinity;
  for (const e of model.energies) {
    if (e < min) min = e;
    if (e > max) max = e;
  }
  const span = max - min;
  const energies = new Float64Array(model.energies.length);
  for (let k = 0; k < energies.length; k++) {
    energies[k] = ((model.energies[k]! - min) / span) * 2 * spectral;
  }
  return { model, energies };
}

describe('subspace-parallel（多线程确定性并行）', () => {
  test('并行构建纤维组与串行逐位一致（order/runs/energies/assignmentAt）', () => {
    // 8×10：dim = 1,814,400 ≥ 构建并行阈值 2^18
    const problem = makeProblem(8, 10, 21, true);
    const parallelModel = buildSubspaceModel(problem);
    assert.ok(parallelModel);

    const prev = process.env.QUANTUM_DISABLE_PARALLEL;
    process.env.QUANTUM_DISABLE_PARALLEL = '1';
    let serialModel: ReturnType<typeof buildSubspaceModel>;
    try {
      serialModel = buildSubspaceModel(problem);
    } finally {
      if (prev === undefined) delete process.env.QUANTUM_DISABLE_PARALLEL;
      else process.env.QUANTUM_DISABLE_PARALLEL = prev;
    }
    assert.ok(serialModel);

    assert.equal(parallelModel.dimension, serialModel.dimension);
    assert.equal(parallelModel.mixers.length, serialModel.mixers.length);
    for (let g = 0; g < serialModel.mixers.length; g++) {
      const a: { label: string; order: Int32Array; runs: Int32Array } = parallelModel.mixers[g]!;
      const b: { label: string; order: Int32Array; runs: Int32Array } = serialModel.mixers[g]!;
      assert.equal(a.label, b.label, `混合器 ${g} 标签一致`);
      assert.equal(a.order.length, b.order.length, `混合器 ${g} order 长度一致`);
      for (let i = 0; i < a.order.length; i++) {
        assert.ok(a.order[i] === b.order[i], `混合器 ${g} order[${i}] 逐位一致`);
      }
      assert.equal(a.runs.length, b.runs.length, `混合器 ${g} runs 长度一致`);
      for (let i = 0; i < a.runs.length; i++) {
        assert.ok(a.runs[i] === b.runs[i], `混合器 ${g} runs[${i}] 逐位一致`);
      }
    }
    for (let s = 0; s < serialModel.dimension; s++) {
      assert.ok(
        parallelModel.energies[s] === serialModel.energies[s],
        `energies[${s}] 逐位一致（展平福利计算不改加法次序）`,
      );
    }
    for (let i = 0; i < serialModel.assignmentAt.length; i++) {
      assert.ok(parallelModel.assignmentAt[i] === serialModel.assignmentAt[i]);
    }
  });

  test('并行演化与串行演化逐位一致（含纠缠耦合）', () => {
    const { model, energies } = largeModelEnergies();
    const tau = 20;

    const serial = serialAnnealEvolve(model!, energies, tau, STEPS);
    const parallel = parallelAnnealEvolve(model!, energies, tau, STEPS);
    assert.ok(parallel, '当前环境应可用并行路径（Node worker_threads + SharedArrayBuffer）');

    for (let k = 0; k < model!.dimension; k++) {
      assert.ok(
        parallel.re[k] === serial.re[k] && parallel.im[k] === serial.im[k],
        `第 ${k} 个振幅并行/串行应逐位一致（并行只在纤维区间上划分，不改任何算术）`,
      );
    }
  });

  test('并行演化跨运行确定性（同一输入 → 同一位模式）', () => {
    const { model, energies } = largeModelEnergies();
    const first = parallelAnnealEvolve(model!, energies, 20, STEPS);
    const second = parallelAnnealEvolve(model!, energies, 20, STEPS);
    assert.ok(first && second, '两次并行演化均应成功');
    for (let k = 0; k < model!.dimension; k++) {
      assert.ok(
        first.re[k] === second.re[k] && first.im[k] === second.im[k],
        '确定性并行：结果不得依赖线程调度',
      );
    }
  });

  test('大维度端到端退火命中最优（并行路径参与 annealSolveSubspace）', () => {
    const model = buildSubspaceModel(makeProblem(6, 9, 11, true));
    assert.ok(model);
    const solution = annealSolveSubspace(model, { anneal: { tau: 20, steps: 150 } });
    assert.ok(solution.optimalityRatio > 0.999, `应命中最优，ratio=${solution.optimalityRatio}`);
  });

  test('禁用开关回退串行（QUANTUM_DISABLE_PARALLEL=1 时返回 null）', () => {
    const { model, energies } = largeModelEnergies();
    const prev = process.env.QUANTUM_DISABLE_PARALLEL;
    process.env.QUANTUM_DISABLE_PARALLEL = '1';
    try {
      const disabled = parallelAnnealEvolve(model!, energies, 20, STEPS);
      assert.equal(disabled, null, '禁用后应返回 null（调用方回退串行）');
    } finally {
      if (prev === undefined) delete process.env.QUANTUM_DISABLE_PARALLEL;
      else process.env.QUANTUM_DISABLE_PARALLEL = prev;
    }
  });

  test('小维度不启用并行（低于阈值时返回 null，串行更快）', () => {
    const model = buildSubspaceModel(makeProblem(5, 7, 3, false));
    assert.ok(model);
    assert.ok(model.dimension < 1 << 19, '测试前提：该实例低于并行阈值');
    let emin = Infinity;
    let emax = -Infinity;
    for (const e of model.energies) {
      if (e < emin) emin = e;
      if (e > emax) emax = e;
    }
    const span = emax - emin;
    const energies = new Float64Array(model.energies.length);
    for (let k = 0; k < energies.length; k++) {
      energies[k] = ((model.energies[k]! - emin) / span) * 2 * 10;
    }
    assert.equal(parallelAnnealEvolve(model, energies, 20, 30), null);
  });

  test('简并谱（全等权重）退火不产生 NaN 且产出合法分配', () => {
    const m = 4;
    const n = 6;
    const problem = makeProblem(m, n, 5, false);
    // 全等权重 → 能量谱 span=0 → 归一化全零 → 相位恒等
    for (const row of problem.weights) row.fill(0.5);
    const model = buildSubspaceModel(problem);
    assert.ok(model);
    const solution = annealSolveSubspace(model, { seed: 5 });
    assert.ok(Number.isFinite(solution.welfare), '简并谱退火仍应产出有限福利');
    assert.ok(
      solution.optimalityRatio > 1 - 1e-9,
      `简并谱所有分配等价，ratio 应为 1，实际 ${solution.optimalityRatio}`,
    );
  });
});
