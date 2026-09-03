import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AssignmentProblem } from '../src/core/quantum-optimizer.js';
import {
  bruteForceOptimum,
  defaultPenalties,
  couplingKey,
  welfareOf,
  isValidAssignment,
  annealSolve,
} from '../src/core/quantum-optimizer.js';
import {
  buildSubspaceModel,
  qaoaSolveSubspace,
  annealSolveSubspace,
  SubspaceState,
} from '../src/core/subspace-optimizer.js';
import { QuantumScheduler } from '../src/core/quantum-scheduler.js';
import type { Agent } from '../src/types/quantum-types.js';

const EPS = 1e-9;

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeProblem(
  m: number,
  n: number,
  seed: number,
  opts: { entangle?: boolean; mask?: boolean } = {},
): AssignmentProblem {
  const r = rng(seed);
  const weights = Array.from({ length: m }, () =>
    Array.from({ length: n }, () => +(0.15 + 0.7 * r()).toFixed(3)),
  );
  const p: AssignmentProblem = {
    taskIds: Array.from({ length: m }, (_, i) => `t${i}`),
    agentIds: Array.from({ length: n }, (_, i) => `a${i}`),
    weights,
    ineligible: weights.map((row) => row.map(() => false)),
    couplings: new Map(),
    penaltyOneHot: 0,
    penaltyCapacity: 0,
  };
  if (opts.mask) {
    p.ineligible[0]![0] = true;
    p.ineligible[m - 1]![n - 1] = true;
  }
  if (opts.entangle) {
    for (let t1 = 0; t1 < m; t1++) {
      for (let t2 = t1 + 1; t2 < m; t2++) {
        p.couplings.set(couplingKey(t1 * n + 0, t2 * n + 1, m * n), 0.35);
        p.couplings.set(couplingKey(t1 * n + 1, t2 * n + 0, m * n), 0.35);
      }
    }
  }
  const pen = defaultPenalties(p);
  p.penaltyOneHot = pen.oneHot;
  p.penaltyCapacity = pen.capacity;
  return p;
}

/** 全排列数 P(n, m) */
function perm(n: number, m: number): number {
  let r = 1;
  for (let i = 0; i < m; i++) r *= n - i;
  return r;
}

describe('subspace-optimizer（约束子空间模型）', () => {
  it('子空间维度 = P(n,m)（全资格时），带资格掩码时正确收缩', () => {
    const full = buildSubspaceModel(makeProblem(3, 5, 1))!;
    assert.equal(full.dimension, perm(5, 3)); // 60

    const masked = buildSubspaceModel(makeProblem(3, 5, 1, { mask: true }))!;
    assert.ok(masked.dimension < perm(5, 3));
    assert.ok(masked.dimension > 0);
    // 掩码尊重：任何基态不使用 t0→a0 与 t2→a4
    for (let s = 0; s < masked.dimension; s++) {
      assert.notEqual(masked.assignmentAt[s * 3 + 0], 0);
      assert.notEqual(masked.assignmentAt[s * 3 + 2], 4);
    }
  });

  it('维度超限时返回 null（调用方可回退全空间引擎）', () => {
    // P(10,8)=1814400 > cap 1000
    const model = buildSubspaceModel(makeProblem(8, 10, 1), { dimensionCap: 1000 });
    assert.equal(model, null);
  });

  it('能量 = −福利（逐基态，含纠缠耦合，零罚项）', () => {
    const p = makeProblem(3, 5, 7, { entangle: true });
    const model = buildSubspaceModel(p)!;
    const buffer: number[] = new Array(3);
    for (let s = 0; s < model.dimension; s++) {
      for (let t = 0; t < 3; t++) buffer[t] = model.assignmentAt[s * 3 + t]!;
      assert.ok(
        Math.abs(model.energies[s]! + welfareOf(p, buffer)) < 1e-9,
        `基态 ${s}: E 应等于 -W`,
      );
    }
    // 精确最优与 v1.1 穷举引擎一致
    const brute = bruteForceOptimum(p);
    assert.ok(Math.abs(model.optimalWelfare - brute.welfare) < 1e-9);
  });

  it('纤维混合器：幺正保范数，β 后 −β 精确还原（机器精度）', () => {
    const model = buildSubspaceModel(makeProblem(3, 5, 7, { entangle: true }))!;
    const st = new SubspaceState(model.dimension);

    // 随机态：填充后归一化
    const r = rng(99);
    let norm2 = 0;
    for (let s = 0; s < model.dimension; s++) {
      st.re[s] = r() * 2 - 1;
      st.im[s] = r() * 2 - 1;
      norm2 += st.re[s]! * st.re[s]! + st.im[s]! * st.im[s]!;
    }
    const inv = 1 / Math.sqrt(norm2);
    for (let s = 0; s < model.dimension; s++) {
      st.re[s] = st.re[s]! * inv;
      st.im[s] = st.im[s]! * inv;
    }

    for (const g of model.mixers) st.applyFiberMixer(g, 0.6);
    assert.ok(Math.abs(st.norm() - 1) < 1e-9, '混合器应保持范数');

    // 可逆性：均匀态经 β,−β 后应回到自身（机器精度）
    const uniform = 1 / Math.sqrt(model.dimension);
    const st2 = new SubspaceState(model.dimension);
    st2.setUniform();
    for (const g of model.mixers) st2.applyFiberMixer(g, 0.83);
    for (const g of model.mixers) st2.applyFiberMixer(g, -0.83);
    let maxDev = 0;
    for (let s = 0; s < st2.dim; s++) {
      maxDev = Math.max(maxDev, Math.abs(st2.re[s]! - uniform), Math.abs(st2.im[s]!));
    }
    assert.ok(maxDev < 1e-12, `β,−β 应还原初始态，最大偏差 ${maxDev.toExponential(2)}`);
  });

  it('QAOA 子空间：命中精确最优（含资格掩码 + 纠缠耦合）', () => {
    const p = makeProblem(3, 5, 7, { entangle: true, mask: true });
    const model = buildSubspaceModel(p)!;
    const s = qaoaSolveSubspace(model, {
      layers: 3,
      restarts: 2,
      select: 'shots-best',
      shots: 256,
    });
    assert.ok(isValidAssignment(p, s.assignment));
    assert.ok(
      Math.abs(s.optimalityRatio - 1) < 1e-9,
      `QAOA 子空间应命中最优，ratio=${s.optimalityRatio}`,
    );
    assert.equal(s.dimension, model.dimension);
  });

  it('绝热退火子空间：命中精确最优（多种子）', () => {
    for (let seed = 1; seed <= 3; seed++) {
      const p = makeProblem(4, 6, seed * 100, { entangle: true });
      const model = buildSubspaceModel(p)!;
      const s = annealSolveSubspace(model, {
        anneal: { tau: 20, steps: 150 },
        select: 'shots-best',
        shots: 256,
      });
      assert.ok(
        Math.abs(s.optimalityRatio - 1) < 1e-9,
        `退火种子${seed}应命中最优，ratio=${s.optimalityRatio.toFixed(4)}`,
      );
    }
  });

  it('n == m（无空闲agent）：换位混合器保持连通并命中最优', () => {
    const p = makeProblem(4, 4, 11, { entangle: true });
    const model = buildSubspaceModel(p)!;
    assert.equal(model.dimension, perm(4, 4)); // 24
    assert.equal(model.mixers.length, 6); // C(4,2) 个换位纤维组

    const brute = bruteForceOptimum(p);
    const s = annealSolveSubspace(model, {
      anneal: { tau: 40, steps: 300 },
      select: 'shots-best',
      shots: 512,
    });
    assert.ok(
      Math.abs(s.welfare - brute.welfare) < EPS,
      `换位混合器应命中最优：${s.welfare} vs ${brute.welfare}`,
    );
  });

  it('双引擎交叉验证：子空间解与全空间引擎解福利一致（都命中最优）', () => {
    const p = makeProblem(3, 4, 21, { entangle: true });
    const model = buildSubspaceModel(p)!;
    const sub = annealSolveSubspace(model, {
      anneal: { tau: 40, steps: 300 },
      select: 'shots-best',
      shots: 512,
    });
    const full = annealSolve(p, {
      anneal: { tau: 120, steps: 1200 },
      select: 'shots-best',
      shots: 512,
    });
    assert.ok(Math.abs(sub.welfare - model.optimalWelfare) < EPS);
    assert.ok(Math.abs(full.welfare - bruteForceOptimum(p).welfare) < EPS);
  });
});

describe('QuantumScheduler 子空间集成', () => {
  function makeAgent(id: string, capabilities: string[], entangledWith: string[] = []): Agent {
    return {
      id,
      name: id,
      type: 'developer',
      capabilities,
      state: 'idle',
      load: 0,
      position: { x: 0, y: 0, z: 0 },
      quantumEntanglement: entangledWith,
      lastHeartbeat: new Date(),
    };
  }

  it('批量调度自动走子空间引擎：5任务×7agent = 2520维，最优率100%', () => {
    const scheduler = new QuantumScheduler({
      scheduling: {
        quantumAlgorithm: 'quantum-annealing',
        autoSchedule: false,
        quantum: { anneal: { tau: 20, steps: 150 } },
      },
    });
    for (let i = 0; i < 7; i++) {
      scheduler.registerAgent(makeAgent(`a${i}`, ['js'], i === 0 ? ['a1'] : i === 1 ? ['a0'] : []));
    }
    const priorities = ['critical', 'high', 'medium', 'low', 'low'] as const;
    for (let i = 0; i < 5; i++) {
      scheduler.submitTask({
        name: `任务${i}`,
        type: 'batch',
        priority: priorities[i],
        requirements: [{ type: 'capability', name: 'js', value: null, weight: 1 }],
        dependencies: [],
        estimatedDuration: 5000,
        actualDuration: 0,
        status: 'pending',
      } as any);
    }

    const report = scheduler.scheduleBatchQuantum();

    assert.equal(report.representation, 'subspace');
    assert.equal(report.subspace!.dimension, perm(7, 5)); // 2520
    assert.equal(report.subspace!.equivalentQubits, 35);
    assert.equal(report.assigned, 5);
    assert.ok(report.entanglementCouplings > 0);
    assert.ok(
      Math.abs(report.optimality!.ratio - 1) < 1e-9,
      `子空间批量最优率应为100%，实际 ${(report.optimality!.ratio * 100).toFixed(2)}%`,
    );

    // 5个任务分配到5个不同agent（容量约束）
    const assignedAgents = new Set(report.assignments.map((a) => a.agentId));
    assert.equal(assignedAgents.size, 5);
    assert.ok(scheduler.getTasks().every((t) => t.status === 'assigned'));
    assert.equal(scheduler.getAgents().filter((a) => a.state !== 'idle').length, 5);
  });

  it('子空间超维时回退全空间分块引擎', () => {
    const scheduler = new QuantumScheduler({
      scheduling: {
        quantumAlgorithm: 'quantum-qaoa',
        autoSchedule: false,
        quantum: { subspaceCap: 2, qubitCap: 12, layers: 3 }, // P(3,1)=3 > 2 → 回退
      },
    });
    scheduler.registerAgent(makeAgent('a1', ['js']));
    scheduler.registerAgent(makeAgent('a2', ['js']));
    scheduler.registerAgent(makeAgent('a3', ['js']));
    scheduler.submitTask({
      name: 'T1',
      type: 'batch',
      priority: 'high',
      requirements: [{ type: 'capability', name: 'js', value: null, weight: 1 }],
      dependencies: [],
      estimatedDuration: 5000,
      actualDuration: 0,
      status: 'pending',
    } as any);

    const report = scheduler.scheduleBatchQuantum();
    assert.equal(report.representation, 'fullspace');
    assert.equal(report.assigned, 1);
  });
});
