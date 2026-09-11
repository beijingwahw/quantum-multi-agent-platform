/**
 * 量子内核第二遍质量遍历回归网（2026-09 SECOND PASS）：
 *
 * 每个用例锁定一个本遍发现并修复的真实缺陷（修复前实测全部复现）：
 *
 * C1 全空间候选表错读对象（R1 topK 单源化的回归）：topKByProbabilityDesc
 *    返回的是 validStates 的**位置**，映射却把位置当基态解码——合法基态的
 *    Born 概率被安到无关低位基态的分配/能量上，候选表出现 [-1,-1] 类非法
 *    分配；调度器 alternatives 因此把全部次优候选项静默折叠成已选 agent。
 * C2 能量记忆化指纹碰撞：weights 求「和」+ ineligible 求「计数」的指纹
 *    对行内交换权重/挪动掩码不敏感——构建后变更命中旧缓存，静默按旧
 *    语义求解（与文档「任何变更都会使缓存失效」契约相反）。
 * C3 问题形状静默垃圾：缺行/短行 weights 读 undefined → NaN 能量表 →
 *    argmax 兜底读出「看起来合理」的答案（welfare 1.18、validMass=NaN
 *    实测复现）；掩码缺格被当合格；裸耦合键越界经 int32 回绕混叠低位比特。
 * C4 select 坍缩模式无运行时校验：任意字符串静默落入 argmax 分支。
 * C5 FTQC 估算器退化假设：pPhys<0 输出**负**错误率且 meetsBudget=true；
 *    cycleTimeUs=0 输出 wallTimeMs=0 + Infinity 占地——垃圾以可信画像外流。
 * C6 D-Wave qp 压缩格式 num_solutions 为小数时静默解出 ceil 个解（幻影
 *    样本歪曲频率统计）。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AssignmentProblem } from '../../src/core/quantum-optimizer.js';
import {
  qaoaSolve,
  annealSolve,
  bruteForceOptimum,
  computeEnergies,
  toIsing,
  welfareOf,
  defaultPenalties,
  isValidAssignment,
} from '../../src/core/quantum-optimizer.js';
import { buildSubspaceModel } from '../../src/core/subspace-optimizer.js';
import { QuantumScheduler } from '../../src/core/quantum-scheduler.js';
import { DWaveBackend } from '../../src/core/qpu/dwave-backend.js';
import { BackendError, QuantumEngineError, QuantumEstimateError } from '../../src/utils/errors.js';
import { estimateFtCircuit, grossCode, surfaceCode } from '../../src/core/qpu/ft-estimate.js';
import { decideExecutionTier } from '../../src/core/qpu/execution-tier.js';
import type { Agent } from '../../src/types/quantum-types.js';

function makeProblem(): AssignmentProblem {
  const weights = [
    [0.6, 0.55, 0.3],
    [0.3, 0.58, 0.52],
  ];
  const p: AssignmentProblem = {
    taskIds: ['t0', 't1'],
    agentIds: ['a0', 'a1', 'a2'],
    weights,
    ineligible: weights.map((r) => r.map(() => false)),
    couplings: new Map(),
    penaltyOneHot: 0,
    penaltyCapacity: 0,
  };
  const pen = defaultPenalties(p);
  p.penaltyOneHot = pen.oneHot;
  p.penaltyCapacity = pen.capacity;
  return p;
}

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

// ----------------------------------------------------------------------------
// C1 全空间候选表：概率与解码必须读同一个基态对象
// ----------------------------------------------------------------------------

describe('第二遍 · C1 全空间候选表错读对象', () => {
  it('候选表全部为合法分配，能量 = -福利（合法基态零罚项），按概率降序', () => {
    const p = makeProblem();
    const sol = qaoaSolve(p, { layers: 4, restarts: 2, select: 'argmax-valid' });
    assert.ok(!sol.repaired, '良构实例不应触发修复路径（前提）');
    assert.ok(sol.candidates.length >= 2);
    let prevProb = Infinity;
    for (const c of sol.candidates) {
      assert.ok(
        isValidAssignment(p, c.assignment),
        `候选 [${c.assignment}] 必须是合法分配（修复前出现 [-1,-1] 等错读对象）`,
      );
      assert.ok(
        Math.abs(c.energy + welfareOf(p, c.assignment)) < 1e-12,
        `候选 [${c.assignment}] 能量 ${c.energy} 应等于 -福利 ${-welfareOf(p, c.assignment)}`,
      );
      assert.ok(c.probability <= prevProb + 1e-15, '候选按 Born 概率降序');
      prevProb = c.probability;
    }
    // argmax-valid 模式：top-1 候选即所选（同一扫描序同一判据）
    assert.deepEqual(sol.candidates[0]!.assignment, sol.assignment);
    assert.equal(sol.candidates[0]!.probability, sol.probability);
  });

  it('annealSolve 同一候选契约（两引擎坍缩路径共吃同一修复）', () => {
    const p = makeProblem();
    const sol = annealSolve(p, { select: 'argmax-valid' });
    for (const c of sol.candidates) {
      assert.ok(isValidAssignment(p, c.assignment));
      assert.ok(Math.abs(c.energy + welfareOf(p, c.assignment)) < 1e-12);
    }
  });

  it('调度器 alternatives 报告真实的次优候选 agent（不再折叠为已选 agent）', () => {
    const scheduler = new QuantumScheduler({
      scheduling: { quantumAlgorithm: 'quantum-qaoa', quantum: { layers: 3 } },
    });
    for (let i = 0; i < 4; i++) scheduler.registerAgent(makeAgent(`a${i}`, ['js']));
    scheduler.submitTask({
      name: 'T1',
      type: 'test',
      priority: 'medium',
      requirements: [{ type: 'capability', name: 'js', value: null, weight: 1 }],
      dependencies: [],
      estimatedDuration: 1000,
      actualDuration: 0,
      status: 'pending',
    });
    const decision = scheduler.getSchedulingHistory().at(-1)!;
    assert.equal(decision.alternatives.length, 2, '单任务×4agent 应有 2 个次优候选');
    // 修复前：decode(-1 位基态) → agents[undefined] → chosen.id 兜底，
    // 两个 alternative 与已选 agent 同名（候选信息静默丢失）
    assert.ok(
      decision.alternatives.every((alt) => alt.agentId !== decision.agentId),
      `alternatives 不应折叠为已选 agent（got ${decision.alternatives.map((a) => a.agentId).join(',')} vs chosen ${decision.agentId}）`,
    );
    assert.equal(new Set(decision.alternatives.map((a) => a.agentId)).size, 2);
    scheduler.shutdown();
  });
});

// ----------------------------------------------------------------------------
// C2 能量记忆化指纹：位置敏感、内容变更必失效
// ----------------------------------------------------------------------------

describe('第二遍 · C2 能量记忆化指纹碰撞', () => {
  it('行内交换两个权重：重算必须发生（等和不同内容）', () => {
    const p = makeProblem();
    const e1 = computeEnergies(p);
    const w = p.weights[0]![0]!;
    p.weights[0]![0] = p.weights[0]![1]!;
    p.weights[0]![1] = w;
    const e2 = computeEnergies(p);
    let changed = 0;
    for (let k = 0; k < e1.energies.length; k++) {
      if (e1.energies[k] !== e2.energies[k]) changed++;
    }
    assert.ok(changed > 0, '行内交换权重后能量表必须变化（0 变更 = 陈旧缓存命中）');
    // 与内容相同的新鲜实例逐位一致（重算的正确性见证）
    const fresh = makeProblem();
    const w0 = fresh.weights[0]![0]!;
    fresh.weights[0]![0] = fresh.weights[0]![1]!;
    fresh.weights[0]![1] = w0;
    const eFresh = computeEnergies(fresh);
    for (let k = 0; k < eFresh.energies.length; k++) {
      assert.equal(e2.energies[k], eFresh.energies[k]);
    }
  });

  it('耦合值 +1e-12（旧 1e-9 量化哈希失明）：重算必须发生且与新鲜实例逐位一致', () => {
    const p = makeProblem();
    // couplingKey 语义：q(t0→a0)=0 与 q(t1→a1)=4 的耦合，key = lo*nq+hi = 4
    p.couplings.set(4, 0.4);
    const e1 = computeEnergies(p);
    // 子 1e-9 的值变更：旧指纹 Math.floor(v*1e9) 对此碰撞 → 陈旧缓存
    p.couplings.set(4, 0.4 + 1e-12);
    const e2 = computeEnergies(p);
    let changed = 0;
    for (let k = 0; k < e1.energies.length; k++) {
      if (e1.energies[k] !== e2.energies[k]) changed++;
    }
    assert.ok(changed > 0, '子 1e-9 的耦合值变更后能量表必须变化（0 变更 = 陈旧缓存命中）');
    const fresh = makeProblem();
    fresh.couplings.set(4, 0.4 + 1e-12);
    const eFresh = computeEnergies(fresh);
    for (let k = 0; k < eFresh.energies.length; k++) {
      assert.equal(e2.energies[k], eFresh.energies[k]);
    }
  });

  it('未变更的重复求解仍命中缓存（性能契约不回退）', () => {
    const p = makeProblem();
    const e1 = computeEnergies(p);
    const e2 = computeEnergies(p);
    assert.equal(e1, e2, '同一实例未变更时应返回同一（记忆化）对象');
  });
});

// ----------------------------------------------------------------------------
// C3 问题形状：命名拒绝取代静默 NaN/undefined 穿流
// ----------------------------------------------------------------------------

describe('第二遍 · C3 问题形状静默垃圾 → 命名拒绝', () => {
  it('短行 weights：五个入口全部拒绝（修复前 qaoaSolve 静默返回 welfare=1.18、validMass=NaN）', () => {
    const ragged: AssignmentProblem = {
      taskIds: ['t0', 't1'],
      agentIds: ['a0', 'a1', 'a2'],
      weights: [
        [0.6, 0.55, 0.3],
        [0.3, 0.58],
      ],
      ineligible: [
        [false, false, false],
        [false, false, false],
      ],
      couplings: new Map(),
      penaltyOneHot: 10,
      penaltyCapacity: 10,
    };
    assert.throws(() => computeEnergies(ragged), QuantumEngineError);
    assert.throws(() => qaoaSolve(ragged), QuantumEngineError);
    assert.throws(() => annealSolve(ragged), QuantumEngineError);
    assert.throws(() => bruteForceOptimum(ragged), QuantumEngineError);
    assert.throws(() => toIsing(ragged), QuantumEngineError);
    assert.throws(() => buildSubspaceModel(ragged), QuantumEngineError);
    assert.throws(() => welfareOf(ragged, [0, 1]), QuantumEngineError);
    assert.throws(() => qaoaSolve(ragged), /row 1 must have exactly n=3 cells/);
  });

  it('缺 ineligible 行 / 稀疏掩码格：拒绝', () => {
    const missing: AssignmentProblem = {
      ...makeProblem(),
      ineligible: [[false, false, false]],
    };
    assert.throws(() => computeEnergies(missing), /rows must match taskIds/);

    const sparse = makeProblem();
    const holed = new Array<boolean>(3);
    holed[0] = false;
    holed[2] = false; // index 1 是洞
    sparse.ineligible[0] = holed;
    assert.throws(() => computeEnergies(sparse), /ineligible\[0\]\[1\] is undefined/);
  });

  it('非有限权重 / 罚项：拒绝（NaN 曾静默穿成全 NaN 能量表）', () => {
    const nanW = makeProblem();
    nanW.weights[1]![2] = Number.NaN;
    assert.throws(() => computeEnergies(nanW), /weights\[1\]\[2\] must be a finite number/);

    const nanPenalty = makeProblem();
    nanPenalty.penaltyCapacity = Number.POSITIVE_INFINITY;
    assert.throws(() => computeEnergies(nanPenalty), /penaltyCapacity must be a finite number/);
  });

  it('裸耦合键越界 / 反序 / 对角：拒绝（曾静默混叠或丢弃）', () => {
    const foreign = makeProblem();
    const nq = 6;
    foreign.couplings.set(nq * nq + 2, 0.4); // q1 = nq 越界（int32 回绕混叠）
    assert.throws(() => computeEnergies(foreign), /must decode to 0 <= q1 < q2 < 6/);

    const reversed = makeProblem();
    reversed.couplings.set((1 * 3 + 2) * nq + 0 * 3, 0.4); // hi*nq+lo：computeEnergies 曾静默丢弃
    assert.throws(() => computeEnergies(reversed), /must decode to 0 <= q1 < q2 < 6/);

    const diagonal = makeProblem();
    diagonal.couplings.set(2 * nq + 2, 0.4); // q1 === q2（四路径语义分裂）
    assert.throws(() => computeEnergies(diagonal), /must decode to 0 <= q1 < q2 < 6/);
  });

  it('良构问题求解不受新校验影响（守卫不改变合法路径）', () => {
    const p = makeProblem();
    const sol = qaoaSolve(p, { layers: 4, restarts: 2, select: 'shots-best', shots: 256 });
    assert.ok(Math.abs(sol.welfare - bruteForceOptimum(p).welfare) < 1e-9);
    const model = buildSubspaceModel(p);
    assert.ok(model, '良构 2×3 问题必可建模');
  });
});

// ----------------------------------------------------------------------------
// C4 select 坍缩模式：运行时校验（与 angleMode 同款）
// ----------------------------------------------------------------------------

describe('第二遍 · C4 select 坍缩模式静默胁迫', () => {
  it('非法 select 字符串被入口拒绝（此前静默落入 argmax 分支）', () => {
    const p = makeProblem();
    assert.throws(() => qaoaSolve(p, { select: 'born-best' as never }), /select must be/);
    assert.throws(() => qaoaSolve(p, { select: 7 as never }), /select must be/);
  });

  it('三个合法模式照常求解（合法邻域不受影响）', () => {
    const p = makeProblem();
    for (const select of ['argmax-valid', 'shots-best', 'born'] as const) {
      const sol = qaoaSolve(p, { select, seed: 7 });
      assert.ok(Number.isFinite(sol.welfare));
    }
  });
});

// ----------------------------------------------------------------------------
// C5 FTQC 估算器退化假设：负错误率 / 零墙钟 + Infinity 占地不再外流
// ----------------------------------------------------------------------------

describe('第二遍 · C5 FTQC 估算器退化假设', () => {
  const profile = { logicalQubits: 80, couplings: 240, depth: 128 };

  it('pPhys ≤ 0 / cycleTimeUs ≤ 0 / synthesisEpsilon 越界：命名拒绝', () => {
    assert.throws(
      () => estimateFtCircuit(profile, grossCode(), { pPhys: -1e-3 }),
      (err: unknown) => err instanceof QuantumEstimateError && err.message.includes('pPhys'),
    );
    assert.throws(
      () => estimateFtCircuit(profile, grossCode(), { cycleTimeUs: 0 }),
      (err: unknown) => err instanceof QuantumEstimateError && err.message.includes('cycleTimeUs'),
    );
    assert.throws(
      () => estimateFtCircuit(profile, grossCode(), { synthesisEpsilon: 1 }),
      (err: unknown) =>
        err instanceof QuantumEstimateError && err.message.includes('synthesisEpsilon'),
    );
  });

  it('码阈值 ≤ 0：命名拒绝（此前幂律除以 0 得 Infinity/NaN）', () => {
    assert.throws(() => surfaceCode(5, 0), /threshold must be a positive finite/);
    assert.throws(() => grossCode(-0.007), /threshold must be a positive finite/);
  });

  it('执行层级路由透传退化假设时同步失败（不产 ftqc/classical 决策）', () => {
    assert.throws(
      () =>
        decideExecutionTier({
          logicalQubits: 80,
          couplings: 240,
          circuitDepth: 128,
          ft: { pPhys: -1e-3 },
        }),
      QuantumEstimateError,
    );
  });

  it('合法邻域锚：默认假设的画像有限且墙钟为正', () => {
    const est = estimateFtCircuit(profile, grossCode());
    assert.ok(Number.isFinite(est.totalPhysicalQubits));
    assert.ok(est.wallTimeMs > 0);
    assert.ok(est.epsilonTotal > 0);
  });
});

// ----------------------------------------------------------------------------
// C6 D-Wave qp 压缩格式：小数 num_solutions 不再静默解出幻影样本
// ----------------------------------------------------------------------------

describe('第二遍 · C6 D-Wave qp num_solutions 小数计数', () => {
  function backendWith(answer: unknown): DWaveBackend {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ id: 'prob-c6', status: 'COMPLETED', answer }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })) as unknown as typeof fetch;
    return new DWaveBackend({
      token: 't',
      endpoint: 'https://cloud.dwavesys.com/sapi/v2',
      fetch: fetchImpl,
    });
  }

  it('num_solutions=1.5：显式 BackendError 而非静默解出 2 个解', async () => {
    const backend = backendWith({
      format: 'qp',
      num_solutions: 1.5,
      data: { vector: [0b1010] },
      energies: [-1],
      num_occurrences: [3],
    });
    await assert.rejects(
      () => backend.solveIsing([0, 0, 0, 0], new Map(), 4, { numReads: 3 }),
      (err: unknown) =>
        err instanceof BackendError && err.message.includes('malformed num_solutions'),
    );
  });

  it('整数 num_solutions 照常解析（合法邻域锚）', async () => {
    const backend = backendWith({
      format: 'qp',
      num_solutions: 1,
      data: { vector: [0b1010] },
      energies: [-1],
      num_occurrences: [7],
    });
    const samples = await backend.solveIsing([0, 0, 0, 0], new Map(), 4, { numReads: 7 });
    assert.equal(samples.spins.length, 1);
    // word=0b1010 → bits [0,1,0,1] → bit=1 处自旋 −1
    assert.deepEqual(samples.spins[0], [1, -1, 1, -1]);
  });
});
