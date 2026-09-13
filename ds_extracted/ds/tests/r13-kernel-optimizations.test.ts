import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AssignmentProblem } from '../src/core/quantum-optimizer.js';
import {
  QuantumStateVector,
  qaoaSolve,
  annealSolve,
  computeEnergies,
  couplingKey,
  decodeCouplingKey,
  decodeAssignment,
  defaultPenalties,
  isValidAssignment,
  welfareOf,
} from '../src/core/quantum-optimizer.js';
import { normalizedEnergies } from '../src/core/solver-common.js';
import { buildSubspaceModel, qaoaSolveSubspace } from '../src/core/subspace-optimizer.js';
import { QuantumScheduler } from '../src/core/quantum-scheduler.js';
import type { Agent } from '../src/types/quantum-types.js';
import { makeTask } from './helpers/fixtures.js';

/**
 * R13 内核优化波（代理 A：量子调度内核象限）的行为钉。
 *
 * 每条性能改造（applyMixer 块遍历、逐评估态矢量 scratch 复用、
 * computeEnergies 不变量外提、selectSolution 零分配内联、批量耦合
 * 循环外提）都带一个位级/等价性断言：优化只动执行计划，不动数值
 * 轨迹——这些测试把「不动」钉成机器可验证的契约。
 */

// 确定性种子 RNG（测试本地参考实现的输入生成器）
function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomProblem(rng: () => number, m: number, n: number): AssignmentProblem {
  const weights = Array.from({ length: m }, () =>
    Array.from({ length: n }, () => +(rng() * 2 - 1).toFixed(3)),
  );
  const ineligible = weights.map((row) => row.map(() => rng() < 0.2));
  const problem: AssignmentProblem = {
    taskIds: Array.from({ length: m }, (_, i) => `t${i}`),
    agentIds: Array.from({ length: n }, (_, i) => `a${i}`),
    weights,
    ineligible,
    couplings: new Map(),
    penaltyOneHot: 0,
    penaltyCapacity: 0,
  };
  const nq = m * n;
  const nc = Math.floor(rng() * 5);
  for (let c = 0; c < nc; c++) {
    const q1 = Math.floor(rng() * nq);
    const q2 = Math.floor(rng() * nq);
    if (q1 !== q2) problem.couplings.set(couplingKey(q1, q2, nq), +rng().toFixed(3));
  }
  const pen = defaultPenalties(problem);
  problem.penaltyOneHot = pen.oneHot;
  problem.penaltyCapacity = pen.capacity;
  return problem;
}

// ----------------------------------------------------------------------------
// C4：applyMixer/applyMixerAngles 的块遍历重构 —— 与「全升序扫描 + 跳过
// 置位下标」的原实现逐位一致（访问序相同、每对算术相同）
// ----------------------------------------------------------------------------

describe('R13 C4：applyMixer 块遍历位级同一', () => {
  /** 编辑前的参考实现（k 全升序 + if (k & mask) continue） */
  function referenceMixer(re: Float64Array, im: Float64Array, nq: number, beta: number): void {
    const dim = 1 << nq;
    const c = Math.cos(beta);
    const s = Math.sin(beta);
    for (let j = 0; j < nq; j++) {
      const mask = 1 << j;
      for (let k = 0; k < dim; k++) {
        if (k & mask) continue;
        const p = k | mask;
        const re0 = re[k]!,
          im0 = im[k]!;
        const re1 = re[p]!,
          im1 = im[p]!;
        re[k] = c * re0 + s * im1;
        im[k] = c * im0 - s * re1;
        re[p] = c * re1 + s * im0;
        im[p] = c * im1 - s * re0;
      }
    }
  }

  it('随机态 × 随机 β：新块遍历与参考实现逐位相等（含范数守恒）', () => {
    const rng = seededRng(20260913);
    for (let trial = 0; trial < 50; trial++) {
      const nq = 1 + Math.floor(rng() * 10);
      const dim = 1 << nq;
      const re = new Float64Array(dim);
      const im = new Float64Array(dim);
      for (let k = 0; k < dim; k++) {
        re[k] = rng() * 2 - 1;
        im[k] = rng() * 2 - 1;
      }
      const sv = new QuantumStateVector(nq, 0);
      sv.re.set(re);
      sv.im.set(im);
      const beta = rng() * Math.PI * 2;
      sv.applyMixer(beta);
      referenceMixer(re, im, nq, beta);
      for (let k = 0; k < dim; k++) {
        assert.equal(sv.re[k], re[k], `re[${k}] nq=${nq} trial=${trial}`);
        assert.equal(sv.im[k], im[k], `im[${k}] nq=${nq} trial=${trial}`);
      }
    }
  });

  it('支配性前提保持：全等角 applyMixerAngles 与 applyMixer 逐位相同', () => {
    const rng = seededRng(4242);
    for (let trial = 0; trial < 20; trial++) {
      const nq = 1 + Math.floor(rng() * 9);
      const dim = 1 << nq;
      const a = new QuantumStateVector(nq, 0);
      const b = new QuantumStateVector(nq, 0);
      for (let k = 0; k < dim; k++) {
        a.re[k] = b.re[k] = rng() * 2 - 1;
        a.im[k] = b.im[k] = rng() * 2 - 1;
      }
      const beta = rng() * (Math.PI / 2);
      a.applyMixer(beta);
      b.applyMixerAngles(Array.from({ length: nq }, () => beta));
      for (let k = 0; k < dim; k++) {
        assert.equal(a.re[k], b.re[k]);
        assert.equal(a.im[k], b.im[k]);
      }
    }
  });
});

// ----------------------------------------------------------------------------
// C5：computeEnergies 的不变量外提 —— 与原「逐基态重算掩码/解码耦合」
// 实现逐位一致（含 ineligible 掩码与耦合表）
// ----------------------------------------------------------------------------

describe('R13 C5：computeEnergies 外提位级同一', () => {
  /** 编辑前的参考实现（每基态重算 1<<q 与 decodeCouplingKey 小对象） */
  function referenceEnergies(problem: AssignmentProblem): {
    energies: Float64Array;
    min: number;
    max: number;
  } {
    const m = problem.taskIds.length;
    const n = problem.agentIds.length;
    const nqubits = m * n;
    const dim = 1 << nqubits;
    const energies = new Float64Array(dim);
    const perTask = new Int32Array(m);
    const perAgent = new Int32Array(n);
    let min = Infinity;
    let max = -Infinity;
    for (let k = 0; k < dim; k++) {
      perTask.fill(0);
      perAgent.fill(0);
      let welfare = 0;
      for (let t = 0; t < m; t++) {
        for (let a2 = 0; a2 < n; a2++) {
          if (k & (1 << (t * n + a2))) {
            perTask[t]!++;
            perAgent[a2]!++;
            welfare += problem.weights[t]![a2]!;
          }
        }
      }
      for (const [key, j] of problem.couplings) {
        const { q1, q2 } = decodeCouplingKey(key, nqubits);
        if (q1 < q2 && (k & (1 << q1)) !== 0 && (k & (1 << q2)) !== 0) welfare += j;
      }
      let penalty = 0;
      for (let t = 0; t < m; t++) {
        if (perTask[t]! !== 1)
          penalty += problem.penaltyOneHot * (perTask[t]! - 1) * (perTask[t]! - 1);
      }
      for (let a2 = 0; a2 < n; a2++) {
        const c = perAgent[a2]!;
        if (c > 1) penalty += problem.penaltyCapacity * ((c * (c - 1)) / 2);
      }
      const e = -welfare + penalty;
      energies[k] = e;
      if (e < min) min = e;
      if (e > max) max = e;
    }
    return { energies, min, max };
  }

  it('随机问题（含掩码/耦合/罚项）：能量表与 min/max 逐位相等', () => {
    const rng = seededRng(1337);
    for (let trial = 0; trial < 30; trial++) {
      const m = 1 + Math.floor(rng() * 3);
      const n = 1 + Math.floor(rng() * 4);
      if (m * n > 14) continue;
      const problem = randomProblem(rng, m, n);
      const ref = referenceEnergies(problem);
      const info = computeEnergies(problem);
      assert.equal(info.min, ref.min, `min trial=${trial}`);
      assert.equal(info.max, ref.max, `max trial=${trial}`);
      assert.equal(info.dim, ref.energies.length);
      for (let k = 0; k < info.dim; k++) {
        assert.equal(info.energies[k], ref.energies[k], `energies[${k}] trial=${trial}`);
      }
    }
  });

  it('记忆化命中路径与首次计算逐位一致（指纹未变时）', () => {
    const rng = seededRng(99);
    const problem = randomProblem(rng, 3, 4);
    const first = computeEnergies(problem);
    const second = computeEnergies(problem);
    assert.equal(first.energies, second.energies, '同问题实例应命中同一缓存条目');
    assert.equal(first.min, second.min);
  });
});

// ----------------------------------------------------------------------------
// C1/C2/C3：求解级态矢量 scratch 复用 + CVaR 分支外分配 —— 同种子求解
// 完全确定，且不同维度的求解交错进行互不污染
// ----------------------------------------------------------------------------

describe('R13 C1/C2：scratch 复用的确定性与隔离', () => {
  it('qaoaSolve 同种子两次求解逐字段一致（均值与 CVaR 目标、layer 与 multi）', () => {
    const rng = seededRng(7);
    const problem = randomProblem(rng, 3, 4);
    const configs = [
      { layers: 3, restarts: 2, select: 'argmax-valid' as const, seed: 42 },
      { layers: 3, restarts: 2, select: 'argmax-valid' as const, seed: 42, cvarAlpha: 0.3 },
      {
        layers: 2,
        restarts: 2,
        select: 'shots-best' as const,
        seed: 7,
        angleMode: 'multi' as const,
      },
    ];
    for (const cfg of configs) {
      const a = qaoaSolve(problem, cfg);
      const b = qaoaSolve(problem, cfg);
      assert.deepEqual(a, b, `config=${JSON.stringify(cfg)}`);
    }
  });

  it('不同维度求解交错：各自结果与单独求解逐字段一致（无跨求解污染）', () => {
    const rng = seededRng(21);
    const small = randomProblem(rng, 2, 3);
    const large = randomProblem(rng, 3, 4);
    const cfg = { layers: 3, restarts: 2, select: 'argmax-valid' as const, seed: 42 };
    const smallSolo = qaoaSolve(small, cfg);
    const largeSolo = qaoaSolve(large, cfg);
    // 交错序列：small → large → small → large（复用/重建 scratch 的路径反复切换）
    qaoaSolve(small, cfg);
    qaoaSolve(large, cfg);
    const smallAgain = qaoaSolve(small, cfg);
    const largeAgain = qaoaSolve(large, cfg);
    assert.deepEqual(smallSolo, smallAgain);
    assert.deepEqual(largeSolo, largeAgain);
  });

  it('annealSolve 同种子两次求解逐字段一致', () => {
    const rng = seededRng(5);
    const problem = randomProblem(rng, 2, 4);
    const cfg = { seed: 42, select: 'shots-best' as const, shots: 64 };
    assert.deepEqual(annealSolve(problem, cfg), annealSolve(problem, cfg));
  });

  it('qaoaSolveSubspace 同种子两次求解逐字段一致，且与全空间交错互不污染', () => {
    const rng = seededRng(31);
    const p34 = randomProblem(rng, 3, 4);
    const p45 = randomProblem(rng, 4, 5);
    const m34 = buildSubspaceModel(p34);
    const m45 = buildSubspaceModel(p45);
    assert.ok(m34 && m45);
    const cfg = { seed: 42, layers: 3, restarts: 2 };
    const solo34 = qaoaSolveSubspace(m34, cfg);
    const solo45 = qaoaSolveSubspace(m45, cfg);
    qaoaSolveSubspace(m45, cfg);
    const again34 = qaoaSolveSubspace(m34, cfg);
    assert.deepEqual(solo34, again34);
    assert.deepEqual(solo45, qaoaSolveSubspace(m45, cfg));
    // 全空间与子空间引擎交错（两引擎各自的 scratch 互不可见）
    qaoaSolve(p34, { seed: 42, layers: 3, restarts: 2, select: 'argmax-valid' });
    assert.deepEqual(solo34, qaoaSolveSubspace(m34, cfg));
  });
});

// ----------------------------------------------------------------------------
// C6：selectSolution 的零分配内联 —— 用仍导出的 decodeAssignment +
// isValidAssignment 作为参考谓词，全量重建末态概率并核对坍缩读数
// ----------------------------------------------------------------------------

describe('R13 C6：selectSolution 内联合法性等价', () => {
  it('argmax-valid 读数与「导出谓词重建」逐项一致（概率/合法质量/候选）', () => {
    const rng = seededRng(88);
    const problem = randomProblem(rng, 3, 4);
    const cfg = { layers: 3, restarts: 2, select: 'argmax-valid' as const, seed: 42 };
    const solution = qaoaSolve(problem, cfg);
    const m = problem.taskIds.length;
    const n = problem.agentIds.length;

    // 由返回角度重建末态（与 runQaoaCircuit 同一算符序列）
    const info = computeEnergies(problem);
    const normalized = normalizedEnergies(info.energies, info.min, info.max, 1);
    const state = new QuantumStateVector(info.nqubits, 0);
    state.setUniformSuperposition();
    const angles = solution.angles!;
    for (let p = 0; p < cfg.layers; p++) {
      state.applyCostPhase(angles[p]!, normalized);
      state.applyMixer(angles[cfg.layers + p]!);
    }
    const probs = state.probabilities();

    // 参考口径：导出的 decodeAssignment + isValidAssignment 逐基态判定
    let validMassRef = 0;
    let bestProb = -1;
    let chosenState = -1;
    for (let k = 0; k < probs.length; k++) {
      const p = probs[k]!;
      if (p <= 0) continue;
      if (isValidAssignment(problem, decodeAssignment(k, m, n))) {
        validMassRef += p;
        if (p > bestProb) {
          bestProb = p;
          chosenState = k;
        }
      }
    }
    assert.ok(chosenState >= 0);
    assert.equal(solution.validMass, validMassRef, 'validMass 与参考累加逐位一致');
    assert.equal(solution.probability, probs[chosenState]!, '所选概率 = 合法argmax基态的Born概率');
    assert.deepEqual(solution.assignment, decodeAssignment(chosenState, m, n));
    assert.equal(solution.welfare, welfareOf(problem, decodeAssignment(chosenState, m, n)));

    // 候选表：合法基态按概率降序的 top-3（并列按扫描序）
    assert.equal(solution.candidates.length, Math.min(3, solution.candidates.length));
    for (let i = 1; i < solution.candidates.length; i++) {
      assert.ok(
        solution.candidates[i - 1]!.probability >= solution.candidates[i]!.probability,
        '候选概率非升序',
      );
    }
    for (const c of solution.candidates) {
      assert.ok(isValidAssignment(problem, c.assignment), '候选必须是合法分配');
      assert.equal(c.welfare, welfareOf(problem, c.assignment));
    }
  });

  it('born/shots-best 模式下所选分配仍为合法基态且概率同源', () => {
    const rng = seededRng(66);
    const problem = randomProblem(rng, 2, 4);
    for (const select of ['born', 'shots-best'] as const) {
      const s = qaoaSolve(problem, { select, seed: 42, shots: 128 });
      assert.ok(isValidAssignment(problem, s.assignment), `select=${select} 所选应合法`);
      assert.ok(s.probability > 0 && s.probability <= 1);
      assert.ok(s.validMass > 0);
    }
  });
});

// ----------------------------------------------------------------------------
// C7：buildBatchProblem 的耦合循环外提 —— 纠缠对的耦合条数与批量报告
// 数值不因外提改变（固定场景钉 entanglementCouplings）
// ----------------------------------------------------------------------------

describe('R13 C7：批量耦合外提行为钉', () => {
  function makeSchedulerAgent(
    id: string,
    capabilities: string[],
    entangledWith: string[] = [],
  ): Agent {
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

  it('双向纠缠对产生恰好 2 条耦合（哈密顿量物理耦合项条数）', () => {
    const scheduler = new QuantumScheduler({
      scheduling: {
        quantumAlgorithm: 'quantum-qaoa',
        autoSchedule: false,
        quantum: { layers: 4, select: 'shots-best', shots: 256 },
      },
    });
    scheduler.registerAgent(makeSchedulerAgent('a1', ['js'], ['a2']));
    scheduler.registerAgent(makeSchedulerAgent('a2', ['js'], ['a1']));
    scheduler.registerAgent(makeSchedulerAgent('a3', ['js']));
    scheduler.submitTask(makeTask('Q1', 'js', 'critical'));
    scheduler.submitTask(makeTask('Q2', 'js', 'high'));

    const report = scheduler.scheduleBatchQuantum();
    assert.equal(report.assigned, 2);
    // (t0→a1,t1→a2) 与 (t0→a2,t1→a1) 各一条：外提不改插入集合与计数
    assert.equal(report.entanglementCouplings, 2);
    assert.ok(report.optimality);
    assert.ok(report.optimality.ratio >= 0.999);
  });

  it('无纠缠时耦合条数为 0', () => {
    const scheduler = new QuantumScheduler({
      scheduling: { quantumAlgorithm: 'quantum-annealing', autoSchedule: false },
    });
    scheduler.registerAgent(makeSchedulerAgent('b1', ['js']));
    scheduler.registerAgent(makeSchedulerAgent('b2', ['js']));
    scheduler.submitTask(makeTask('Q1', 'js'));
    scheduler.submitTask(makeTask('Q2', 'js'));
    const report = scheduler.scheduleBatchQuantum();
    assert.equal(report.entanglementCouplings, 0);
    assert.ok(report.assigned > 0);
  });
});
