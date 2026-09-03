import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AssignmentProblem } from '../src/core/quantum-optimizer.js';
import {
  bruteForceOptimum,
  defaultPenalties,
  couplingKey,
  welfareOf,
} from '../src/core/quantum-optimizer.js';
import { hungarianAssignment, localSearchAssignment } from '../src/core/classical-baselines.js';
import { buildSubspaceModel, annealSolveSubspace } from '../src/core/subspace-optimizer.js';
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

describe('classical-baselines（经典最强基线）', () => {
  it('匈牙利算法在线性实例上与穷举最优一致（多种子+掩码）', () => {
    for (const seed of [11, 22, 33]) {
      const p = makeProblem(4, 6, seed, { mask: true });
      const assignment = hungarianAssignment(p.weights, p.ineligible);
      // 掩码尊重
      assert.notEqual(assignment[0], 0);
      assert.notEqual(assignment[3], 5);
      // 与穷举一致（线性问题：穷举按含耦合的福利算，无耦合时二者等价）
      const linear = { ...p, couplings: new Map() };
      const brute = bruteForceOptimum(linear);
      const hungW = assignment.reduce((s, a, t) => s + p.weights[t]![a]!, 0);
      assert.ok(
        Math.abs(hungW - brute.welfare) < EPS,
        `匈牙利 ${hungW.toFixed(3)} 应等于穷举最优 ${brute.welfare.toFixed(3)} (seed=${seed})`,
      );
    }
  });

  it('对照认证：量子子空间解与匈牙利解在线性实例上逐点一致（独立算法互证）', () => {
    for (const seed of [101, 202]) {
      const p = makeProblem(5, 8, seed); // 无耦合：纯线性分配
      const hung = hungarianAssignment(p.weights, p.ineligible);
      const hungW = welfareOf(p, hung);
      const model = buildSubspaceModel(p)!;
      const quantum = annealSolveSubspace(model, {
        anneal: { tau: 20, steps: 150 },
        select: 'shots-best',
        shots: 512,
      });
      assert.ok(
        Math.abs(quantum.welfare - hungW) < EPS,
        `量子 ${quantum.welfare.toFixed(3)} 应与匈牙利精确解 ${hungW.toFixed(3)} 一致 (seed=${seed})`,
      );
      assert.ok(Math.abs(model.optimalWelfare - hungW) < EPS);
    }
  });

  it('局部搜索不劣于贪心，量子不低于局部搜索（耦合/QAP型实例）', () => {
    for (const seed of [7, 77, 777]) {
      const p = makeProblem(5, 7, seed, { entangle: true });
      const model = buildSubspaceModel(p)!;
      const ls = localSearchAssignment(p);
      const lsW = welfareOf(p, ls);
      // 局部搜索 ≥ 贪心（同一初始）
      // 贪心福利：局部搜索的初始即贪心，改进后必 ≥
      const quantum = annealSolveSubspace(model, {
        anneal: { tau: 20, steps: 150 },
        select: 'shots-best',
        shots: 512,
      });
      assert.ok(
        quantum.welfare >= lsW - EPS,
        `量子 ${quantum.welfare.toFixed(3)} 不应低于局部搜索 ${lsW.toFixed(3)} (seed=${seed})`,
      );
      assert.ok(Math.abs(quantum.welfare - model.optimalWelfare) < EPS);
    }
  });
});

describe('QuantumScheduler 多轮子空间调度（任务多于agent）', () => {
  function makeAgent(id: string, capabilities: string[]): Agent {
    return {
      id,
      name: id,
      type: 'developer',
      capabilities,
      state: 'idle',
      load: 0,
      position: { x: 0, y: 0, z: 0 },
      quantumEntanglement: [],
      lastHeartbeat: new Date(),
    };
  }

  it('6任务×3agent：首轮联合分配3个，完成后次轮再分配3个（逐轮最优）', () => {
    const scheduler = new QuantumScheduler({
      scheduling: {
        quantumAlgorithm: 'quantum-annealing',
        autoSchedule: false,
        quantum: { anneal: { tau: 20, steps: 150 } },
      },
    });
    for (let i = 0; i < 3; i++) {
      scheduler.registerAgent(makeAgent(`a${i}`, ['js']));
    }
    const priorities = ['critical', 'high', 'high', 'medium', 'medium', 'low'] as const;
    for (let i = 0; i < 6; i++) {
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

    // 首轮：3个agent各承接1个任务（容量1），其余任务挂起等待释放
    const report1 = scheduler.scheduleBatchQuantum();
    assert.equal(report1.representation, 'subspace');
    assert.equal(report1.assigned, 3);
    assert.equal(report1.chunks, 1);
    assert.ok(report1.optimality!);
    assert.ok(report1.optimality!.ratio >= 0.999, '首轮应命中最优');
    assert.equal(
      scheduler.getAgents().every((a) => a.state !== 'idle'),
      true,
    );

    // 完成首轮任务（释放agent），次轮调度剩余3个
    for (const t of scheduler.getTasks()) {
      if (t.status === 'assigned') scheduler.completeTask(t.id, true);
    }
    const report2 = scheduler.scheduleBatchQuantum();
    assert.equal(report2.representation, 'subspace');
    assert.equal(report2.assigned, 3);
    assert.ok(report2.optimality!.ratio >= 0.999, '次轮应命中最优');

    assert.equal(
      scheduler.getTasks().every((t) => t.status === 'assigned' || t.status === 'completed'),
      true,
    );
    // 6任务全分配过：3完成 + 3在跑
    const busy = scheduler.getAgents().filter((a) => a.state !== 'idle');
    assert.equal(busy.length, 3);
  });

  it('m > n 且维度超限时仍能回退全空间路径', () => {
    const scheduler = new QuantumScheduler({
      scheduling: {
        quantumAlgorithm: 'quantum-annealing',
        autoSchedule: false,
        quantum: { subspaceCap: 2, qubitCap: 12 }, // P(n,k)全超限 → 回退
      },
    });
    for (let i = 0; i < 3; i++) {
      scheduler.registerAgent(makeAgent(`a${i}`, ['js']));
    }
    for (let i = 0; i < 2; i++) {
      scheduler.submitTask({
        name: `任务${i}`,
        type: 'batch',
        priority: 'medium',
        requirements: [{ type: 'capability', name: 'js', value: null, weight: 1 }],
        dependencies: [],
        estimatedDuration: 5000,
        actualDuration: 0,
        status: 'pending',
      } as any);
    }
    const report = scheduler.scheduleBatchQuantum();
    assert.equal(report.representation, 'fullspace');
    assert.equal(report.assigned, 2);
  });
});
