import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  QuantumStateVector,
  AssignmentProblem,
  qaoaSolve,
  annealSolve,
  bruteForceOptimum,
  defaultPenalties,
  couplingKey,
  computeEnergies,
  toIsing,
  decodeAssignment,
  isValidAssignment,
  welfareOf
} from '../src/core/quantum-optimizer.js';
import { QuantumScheduler } from '../src/core/quantum-scheduler.js';
import { Agent } from '../src/types/quantum-types.js';

const EPS = 1e-9;

function makeProblem(withCoupling: boolean, couplingTargets: [number, number, number, number] = [0, 0, 1, 1], jValue = 0.4): AssignmentProblem {
  const weights = [
    [0.60, 0.55, 0.30], // t0 略偏好 a0
    [0.30, 0.58, 0.52]  // t1 略偏好 a1
  ];
  const p: AssignmentProblem = {
    taskIds: ['t0', 't1'],
    agentIds: ['a0', 'a1', 'a2'],
    weights,
    ineligible: weights.map(r => r.map(() => false)),
    couplings: new Map(),
    penaltyOneHot: 0,
    penaltyCapacity: 0
  };
  if (withCoupling) {
    const [t1, a1, t2, a2] = couplingTargets;
    p.couplings.set(couplingKey(t1 * 3 + a1, t2 * 3 + a2, 6), jValue);
  }
  const pen = defaultPenalties(p);
  p.penaltyOneHot = pen.oneHot;
  p.penaltyCapacity = pen.capacity;
  return p;
}

function makeSchedulerAgent(id: string, capabilities: string[], entangledWith: string[] = []): Agent {
  return {
    id,
    name: id,
    type: 'developer',
    capabilities,
    state: 'idle',
    load: 0,
    position: { x: 0, y: 0, z: 0 },
    quantumEntanglement: entangledWith,
    lastHeartbeat: new Date()
  };
}

function makeTask(name: string, capability: string, priority: any = 'medium') {
  return {
    name,
    type: 'test',
    priority,
    requirements: [
      { type: 'capability' as const, name: capability, value: null, weight: 1.0 }
    ],
    dependencies: [],
    estimatedDuration: 1000,
    actualDuration: 0,
    status: 'pending' as const
  };
}

describe('QuantumStateVector（物理层）', () => {
  it('混合算符 exp(-iβX)|0⟩ = cosβ|0⟩ - i·sinβ|1⟩（解析振幅）', () => {
    const sv = new QuantumStateVector(1, 0);
    sv.applyMixer(Math.PI / 4);
    const c = Math.cos(Math.PI / 4);
    const s = Math.sin(Math.PI / 4);
    assert.ok(Math.abs(sv.re[0] - c) < EPS);
    assert.ok(Math.abs(sv.im[0]) < EPS);
    assert.ok(Math.abs(sv.re[1]) < EPS);
    assert.ok(Math.abs(sv.im[1] + s) < EPS); // -i·sinβ
    assert.ok(Math.abs(sv.norm() - 1) < EPS);
  });

  it('代价相位（对角幺正）不改变基态概率分布', () => {
    const sv = new QuantumStateVector(3, 0);
    sv.setUniformSuperposition();
    const before = sv.probabilities();
    const energies = new Float64Array(8);
    for (let k = 0; k < 8; k++) energies[k] = k * 0.7;
    sv.applyCostPhase(1.234, energies);
    const after = sv.probabilities();
    for (let k = 0; k < 8; k++) {
      assert.ok(Math.abs(before[k] - after[k]) < EPS);
    }
    assert.ok(Math.abs(sv.norm() - 1) < EPS);
  });

  it('横场基态 |−⟩^n 是混合算符的本征态（模长不变）', () => {
    const sv = new QuantumStateVector(4, 0);
    sv.setTransverseGroundState();
    // |−⟩^n 振幅符号 = (-1)^popcount
    const amp = 1 / 4;
    for (let k = 0; k < 16; k++) {
      const sign = popcountLocal(k) % 2 === 0 ? 1 : -1;
      assert.ok(Math.abs(sv.re[k] - sign * amp) < EPS);
      assert.ok(Math.abs(sv.im[k]) < EPS);
    }
    // |−⟩ 是 X 的本征态：mixer 只赋予全局相位 e^{inβ}，概率分布不变
    const before = sv.probabilities();
    sv.applyMixer(0.77);
    const after = sv.probabilities();
    for (let k = 0; k < 16; k++) {
      assert.ok(Math.abs(before[k] - after[k]) < EPS);
    }
    assert.ok(Math.abs(sv.norm() - 1) < EPS);
  });

  it('QAOA末态分布非均匀：低能量态概率显著高于均匀基线（干涉证据）', () => {
    const problem = makeProblem(true);
    const solution = qaoaSolve(problem, { layers: 4, restarts: 2, select: 'argmax-valid' });
    // 最优分配的 Born 概率应远超均匀分布 1/64
    assert.ok(solution.probability > 1 / 64 + EPS);
    assert.ok(solution.validMass > 0);
  });

  it('born 模式坍缩结果分布合理：多次坍缩至少一次命中高福利区', () => {
    const problem = makeProblem(true);
    const brute = bruteForceOptimum(problem);
    const best = brute.ranking[0];
    const second = brute.ranking[1] ?? best;
    let hitTop = false;
    for (let seed = 1; seed <= 20; seed++) {
      const s = qaoaSolve(problem, { select: 'born', seed, layers: 4 });
      assert.ok(s.welfare > 0);
      if (s.welfare >= second - EPS) hitTop = true;
    }
    assert.ok(hitTop, '20次Born坍缩应至少一次落在福利前二');
  });
});

function popcountLocal(k: number): number {
  let c = 0;
  while (k) {
    k &= k - 1;
    c++;
  }
  return c;
}

describe('quantum-optimizer（求解质量）', () => {
  it('穷举最优在手算实例上正确', () => {
    const p = makeProblem(false);
    const brute = bruteForceOptimum(p);
    // 无耦合：[0,1] = 0.60 + 0.58 = 1.18
    assert.deepEqual(brute.assignment, [0, 1]);
    assert.ok(Math.abs(brute.welfare - 1.18) < 1e-9);
    assert.equal(brute.validCount, 6); // 3 agents 排列 3×2
  });

  it('QAOA 命中穷举最优（无耦合实例）', () => {
    const p = makeProblem(false);
    const brute = bruteForceOptimum(p);
    const s = qaoaSolve(p, { layers: 4, restarts: 3, select: 'shots-best', shots: 256 });
    assert.ok(isValidAssignment(p, s.assignment));
    assert.ok(Math.abs(s.welfare - brute.welfare) < 1e-9,
      `QAOA welfare ${s.welfare} 应等于最优 ${brute.welfare}`);
  });

  it('QAOA 命中穷举最优（纠缠耦合实例）', () => {
    const p = makeProblem(true);
    const brute = bruteForceOptimum(p);
    const s = qaoaSolve(p, { layers: 4, restarts: 3, select: 'shots-best', shots: 256 });
    assert.ok(Math.abs(s.welfare - brute.welfare) < 1e-9);
  });

  it('绝热退火命中穷举最优', () => {
    const p = makeProblem(true);
    const brute = bruteForceOptimum(p);
    const s = annealSolve(p, { anneal: { tau: 120, steps: 1200 }, select: 'shots-best', shots: 256 });
    assert.ok(isValidAssignment(p, s.assignment));
    assert.ok(Math.abs(s.welfare - brute.welfare) < 1e-9,
      `退火 welfare ${s.welfare} 应等于最优 ${brute.welfare}`);
  });

  it('纠缠耦合项翻转最优分配（哈密顿量物理耦合生效）', () => {
    // 耦合加在 (t0→a1, t1→a0) 上，J=0.4 足以把最优从 [0,1] 翻到 [1,0]
    const plain = makeProblem(false);
    const flipped = makeProblem(true, [0, 1, 1, 0], 0.4);

    const plainOpt = bruteForceOptimum(plain);
    const flipOpt = bruteForceOptimum(flipped);
    assert.deepEqual(plainOpt.assignment, [0, 1]);
    assert.deepEqual(flipOpt.assignment, [1, 0], '耦合应使最优解易主');

    const s = qaoaSolve(flipped, { layers: 4, restarts: 3, select: 'shots-best', shots: 256 });
    assert.deepEqual(s.assignment, [1, 0], 'QAOA应找到被纠缠耦合翻转的最优');
    assert.ok(Math.abs(s.welfare - flipOpt.welfare) < 1e-9);
  });

  it('不合格(任务,agent)对永不被选择', () => {
    const p = makeProblem(false);
    p.ineligible[0][0] = true; // t0 不能给 a0
    p.ineligible[1][1] = true; // t1 不能给 a1
    const brute = bruteForceOptimum(p);
    assert.notEqual(brute.assignment[0], 0);
    assert.notEqual(brute.assignment[1], 1);
    const s = qaoaSolve(p, { layers: 4, restarts: 2, select: 'shots-best', shots: 256 });
    assert.notEqual(s.assignment[0], 0);
    assert.notEqual(s.assignment[1], 1);
    assert.ok(Math.abs(s.welfare - brute.welfare) < 1e-9);
  });

  it('Born概率自洽：所选概率∈(0,1]，候选概率和不超过合法概率质量', () => {
    const p = makeProblem(true);
    const s = qaoaSolve(p, { select: 'argmax-valid' });
    assert.ok(s.probability > 0 && s.probability <= 1);
    const candidateSum = s.candidates.reduce((sum, c) => sum + c.probability, 0);
    assert.ok(candidateSum <= s.validMass + EPS);
    assert.ok(s.validMass <= 1 + EPS);
  });

  it('Ising导出与态矢量能量一致（QPU可移植性）', () => {
    const p = makeProblem(true);
    const { energies } = computeEnergies(p);
    const ising = toIsing(p);
    const n = 3;

    // 遍历全部合法分配，逐一核对 Ising 能量 == 态矢量能量
    for (let a0 = 0; a0 < n; a0++) {
      for (let a1 = 0; a1 < n; a1++) {
        if (a0 === a1) continue;
        const assignment = [a0, a1];
        const state = (1 << (0 * n + a0)) | (1 << (1 * n + a1));
        // z_i = 1 - 2x_i
        let e = ising.offset;
        for (let q = 0; q < ising.nqubits; q++) {
          const x = (state >> q) & 1;
          const z = 1 - 2 * x;
          e += ising.h[q] * z;
        }
        for (const [key, j] of ising.J) {
          const q1 = Math.floor(key / ising.nqubits);
          const q2 = key % ising.nqubits;
          const z1 = 1 - 2 * ((state >> q1) & 1);
          const z2 = 1 - 2 * ((state >> q2) & 1);
          e += j * z1 * z2;
        }
        assert.ok(Math.abs(e - energies[state]) < 1e-6,
          `Ising能量(${e}) 应等于哈密顿量能量(${energies[state]}) @ [${a0},${a1}]`);
        assert.ok(Math.abs(welfareOf(p, assignment) + energies[state]) < 1e-6,
          '合法分配的动能 = -福利');
      }
    }
  });
});

describe('QuantumScheduler 集成（叠加→演化→坍缩）', () => {
  it('quantum-qaoa 单任务：测量坍缩产生分配，概率为Born概率', () => {
    const scheduler = new QuantumScheduler({
      scheduling: { quantumAlgorithm: 'quantum-qaoa', quantum: { layers: 3, select: 'argmax-valid' } }
    });
    scheduler.registerAgent(makeSchedulerAgent('a1', ['javascript', 'python']));
    scheduler.registerAgent(makeSchedulerAgent('a2', ['javascript']));
    scheduler.registerAgent(makeSchedulerAgent('a3', ['javascript']));

    const task = scheduler.submitTask(makeTask('T1', 'javascript') as any);

    assert.equal(task.status, 'assigned');
    assert.ok(task.assignedAgentId);
    const decision = scheduler.getSchedulingHistory().at(-1)!;
    assert.ok(decision.probability > 0 && decision.probability <= 1);
    assert.match(decision.reasoning, /qaoa/i);
    assert.equal(scheduler.getQuantumMetrics().singleDecisions, 1);
  });

  it('quantum-annealing 单任务同样完成坍缩分配', () => {
    const scheduler = new QuantumScheduler({
      scheduling: { quantumAlgorithm: 'quantum-annealing' }
    });
    scheduler.registerAgent(makeSchedulerAgent('a1', ['rust']));
    scheduler.registerAgent(makeSchedulerAgent('a2', ['rust']));

    const task = scheduler.submitTask(makeTask('T1', 'rust') as any);
    assert.equal(task.status, 'assigned');
    const decision = scheduler.getSchedulingHistory().at(-1)!;
    assert.match(decision.reasoning, /annealing/i);
  });

  it('批量联合量子调度：挂起任务被联合分配且最优率达标', () => {
    const scheduler = new QuantumScheduler({
      scheduling: {
        quantumAlgorithm: 'quantum-qaoa',
        autoSchedule: false, // 攒任务，等待联合量子调度
        quantum: { layers: 4, select: 'shots-best', shots: 256 }
      }
    });
    scheduler.registerAgent(makeSchedulerAgent('a1', ['js'], ['a2']));
    scheduler.registerAgent(makeSchedulerAgent('a2', ['js'], ['a1']));
    scheduler.registerAgent(makeSchedulerAgent('a3', ['js']));

    const t1 = scheduler.submitTask(makeTask('Q1', 'js', 'critical') as any);
    const t2 = scheduler.submitTask(makeTask('Q2', 'js', 'high') as any);
    assert.equal(t1.status, 'pending');
    assert.equal(t2.status, 'pending');

    const report = scheduler.scheduleBatchQuantum();

    assert.equal(report.assigned, 2, '两个挂起任务应被联合分配');
    assert.ok(report.entanglementCouplings > 0, '纠缠对应产生哈密顿量耦合项');
    assert.ok(report.optimality, '小规模问题应附带穷举最优对照');
    assert.ok(report.optimality!.ratio >= 0.999, `联合最优率应为100%，实际 ${(report.optimality!.ratio * 100).toFixed(1)}%`);
    assert.ok(report.meanProbability > 0 && report.meanProbability <= 1);

    // 任务状态与agent占用一致
    assert.equal(scheduler.getTasks().every(t => t.status === 'assigned'), true);
    assert.equal(scheduler.getAgents().filter(a => a.state !== 'idle').length, 2);

    // 统计落地
    const metrics = scheduler.getQuantumMetrics();
    assert.equal(metrics.batchRuns, 1);
    assert.equal(metrics.batchAssigned, 2);
    assert.equal(metrics.lastOptimalityRatio, report.optimality!.ratio);
  });

  it('默认 hybrid 路径行为不变（回归保护）', () => {
    const scheduler = new QuantumScheduler({});
    scheduler.registerAgent(makeSchedulerAgent('a1', ['python']));
    const task = scheduler.submitTask(makeTask('T1', 'python') as any);
    assert.equal(task.status, 'assigned');
    assert.equal(task.assignedAgentId, 'a1');
    assert.equal(scheduler.getQuantumMetrics().algorithm, 'hybrid');
    assert.equal(scheduler.getQuantumMetrics().singleDecisions, 0);
  });

  it('空场景边界：无任务/无agent时批量调度安全返回', () => {
    const scheduler = new QuantumScheduler({
      scheduling: { quantumAlgorithm: 'quantum-annealing' }
    });
    const empty = scheduler.scheduleBatchQuantum();
    assert.equal(empty.assigned, 0);
    assert.equal(empty.chunks, 0);

    scheduler.registerAgent(makeSchedulerAgent('a1', ['js']));
    const noPending = scheduler.scheduleBatchQuantum();
    assert.equal(noPending.assigned, 0);
  });
});
