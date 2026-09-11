/**
 * 量子内核第三遍质量遍历回归网（R8-B，2026-09-12）：
 *
 * 每个用例锁定本遍发现并修复的真实缺陷（修复前实测复现）：
 *
 * T1 qiskit-export 角度奇偶校验绕过：`angles: [γ]`（length=1）经
 *    `length >= 2` 前置条件绕过奇偶守卫，静默换成缺省角 [π/2, π/4]——
 *    调用方「训练好的角度」以默认电路的形态被丢弃，与守卫自己的错误
 *    信息（奇数长度必须拒绝）自相矛盾。修复：奇偶校验覆盖调用方传入
 *    的原始数组。
 * T2 QPU 三道闸门的文档真相：solve.ts 文件头曾宣称「可修复的修复」与
 *    「能量核对」两道不存在的闸门。实现的真实姿态是：非法样本直接丢弃
 *    （不做修复——修复产物不是测量结果）+ 后端能量仅记录不校验（信任
 *    姿态，退化由最优率对照兜底）。本用例把该姿态钉住，防止有人按旧
 *    文档「补上」能量闸门时无意识改变语义，也防止非法样本被悄悄修复。
 * T3 numReads 缺省的路径差异：接口 JSDoc 曾宣称统一「默认 100」——本地
 *    精确引擎实际是 128（DEFAULT_SHOTS，solve 层显式钉住上报）。
 * T4 全空间引擎跨实例同种子复现缺钉：seed 契约（「随机种子（可复现）」）
 *    此前只在**同一** problem 实例上钉过（cvar/ma 的确定性测试）——
 *    computeEnergies 的记忆化按实例 WeakMap 隔离，两个结构相同的新鲜
 *    实例必须给出位级相同的解（子空间侧已由调度器孪生/中止测试覆盖，
 *    全空间侧缺失）。
 * T5 born 坍缩修复路径的概率同源：采样落非法态被修复时，此前上报
 *    bestValidProb——那是**另一个**分配（概率最大的合法基态）的 Born
 *    概率，违反 SolverSolution.probability 的字段契约「所选分配的 Born
 *    概率」。修复后按报告分配自身基态的真实 Born 概率上报，本用例用
 *    导出原语独立重建末态做位级对账。
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import type { AssignmentProblem } from '../../src/core/quantum-optimizer.js';
import {
  annealSolve,
  bruteForceOptimum,
  computeEnergies,
  defaultPenalties,
  qaoaSolve,
  QuantumStateVector,
} from '../../src/core/quantum-optimizer.js';
import { normalizedEnergies } from '../../src/core/solver-common.js';
import { toQiskitProgram } from '../../src/core/qpu/qiskit-export.js';
import { solveAssignmentOnBackend } from '../../src/core/qpu/solve.js';
import { LocalQuantumBackend } from '../../src/core/qpu/quantum-backend.js';
import { DWaveBackend } from '../../src/core/qpu/dwave-backend.js';
import { QuantumEngineError } from '../../src/utils/errors.js';
import { mulberry32 } from '../../src/utils/rng.js';

// ----------------------------------------------------------------------------
// 工厂
// ----------------------------------------------------------------------------

function coupledProblem(seed: number, m = 2, n = 3): AssignmentProblem {
  const rng = mulberry32(seed);
  const weights = Array.from({ length: m }, () =>
    Array.from({ length: n }, () => +(0.15 + 0.7 * rng()).toFixed(3)),
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
  const pen = defaultPenalties(p);
  p.penaltyOneHot = pen.oneHot;
  p.penaltyCapacity = pen.capacity;
  return p;
}

/** 弱罚问题（born 采样可落非法态而合法质量仍高于地板） */
function weakPenaltyProblem(): AssignmentProblem {
  const weights = [
    [0.9, 0.5, 0.4],
    [0.85, 0.5, 0.4],
  ];
  return {
    taskIds: ['t0', 't1'],
    agentIds: ['a0', 'a1', 'a2'],
    weights,
    ineligible: weights.map((r) => r.map(() => false)),
    couplings: new Map(),
    penaltyOneHot: 0.1,
    penaltyCapacity: 0.1,
  };
}

function plainProblem(): AssignmentProblem {
  const weights = [
    [0.6, 0.55, 0.3],
    [0.3, 0.58, 0.52],
  ];
  return {
    taskIds: ['t0', 't1'],
    agentIds: ['a0', 'a1', 'a2'],
    weights,
    ineligible: weights.map((r) => r.map(() => false)),
    couplings: new Map(),
    penaltyOneHot: 10,
    penaltyCapacity: 10,
  };
}

/** D-Wave mock 传输（同 qpu-backend.test 的注入模式，无真实网络） */
interface CapturedRequest {
  method: string;
  url: string;
  body: { params?: { num_reads?: number } } | null;
}

function mockTransport(responder: () => unknown): {
  fetchImpl: typeof fetch;
  requests: CapturedRequest[];
} {
  const requests: CapturedRequest[] = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
    requests.push({ method: init?.method ?? 'GET', url, body });
    return new Response(JSON.stringify(responder()), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;
  return { fetchImpl, requests };
}

function dwaveWith(responder: () => unknown): DWaveBackend {
  return new DWaveBackend({
    token: 't',
    endpoint: 'https://cloud.dwavesys.com/sapi/v2',
    fetch: mockTransport(responder).fetchImpl,
  });
}

/** 最优分配 → 自旋向量（z = 1 − 2x） */
function spinsOf(assignment: number[], m: number, n: number): number[] {
  const spins = new Array<number>(m * n).fill(1);
  for (let t = 0; t < m; t++) spins[t * n + assignment[t]!] = -1;
  return spins;
}

before(() => {
  delete process.env.DWAVE_API_TOKEN;
  delete process.env.D_WAVE_API_TOKEN;
});

// ----------------------------------------------------------------------------
// T1 qiskit-export 角度奇偶校验
// ----------------------------------------------------------------------------

describe('第三遍 · T1 qiskit 角度奇偶校验绕过', () => {
  it('length=1（单 γ 无 β）与 length=3：命名拒绝而非静默换缺省角', () => {
    const p = plainProblem();
    // 修复前：length=1 经 `length >= 2` 前置条件绕过奇偶守卫，静默用缺省角
    assert.throws(
      () => toQiskitProgram(p, { angles: [0.5] }),
      (err: unknown) =>
        err instanceof QuantumEngineError &&
        /angles must be an even-length .*got 1/.test(err.message),
    );
    // length=3 是旧守卫已覆盖的形态（≥2 且奇数）——保持拒绝
    assert.throws(
      () => toQiskitProgram(p, { angles: [0.5, 0.25, 0.1] }),
      /angles must be an even-length .*got 3/,
    );
  });

  it('合法邻域：偶数长度照常切分，undefined/空数组落缺省启发角', () => {
    const p = plainProblem();
    const explicit = toQiskitProgram(p, { angles: [0.7, 0.5, 0.3, 0.25] });
    assert.match(explicit, /GAMMAS = \[0\.7, 0\.5\]/);
    assert.match(explicit, /BETAS\s+= \[0\.3, 0\.25\]/);
    // 空数组 = 「未提供」：缺省单层启发值 [π/2, π/4]
    const defaulted = toQiskitProgram(p, { angles: [] });
    assert.match(defaulted, /GAMMAS = \[1\.570796\]/);
    assert.match(defaulted, /BETAS\s+= \[0\.785398\]/);
    const omitted = toQiskitProgram(p);
    assert.match(omitted, /GAMMAS = \[1\.570796\]/);
  });
});

// ----------------------------------------------------------------------------
// T2 QPU 三道闸门的实现姿态（非法丢弃 / 能量仅记录）
// ----------------------------------------------------------------------------

describe('第三遍 · T2 QPU 闸门姿态（丢弃而非修复，能量信息性）', () => {
  it('可修复的非法样本（容量违约）被丢弃并计数，不被修复成测量结果', async () => {
    const p = coupledProblem(42);
    const optimal = bruteForceOptimum(p).assignment;
    // bad 样本：两任务都给 a0 —— 逐任务 one-hot 合法、容量违约，
    // 全空间引擎语义下「可修复」（repairAssignment 可挪开其一）
    const bad = new Array<number>(6).fill(1);
    bad[0] = -1; // (t0,a0)
    bad[3] = -1; // (t1,a0)
    const backend = dwaveWith(() => ({
      id: 'prob-t2a',
      status: 'COMPLETED',
      answer: {
        solutions: [spinsOf(optimal, 2, 3), bad],
        energies: [-1, -1],
        num_occurrences: [50, 25],
      },
    }));
    const result = await solveAssignmentOnBackend(p, backend, { numReads: 75 });
    assert.deepEqual(result.assignment, optimal, '选中的必须是合法样本的分配');
    assert.equal(result.invalidSamples, 25, '非法样本计入 invalidSamples（丢弃而非修复）');
    assert.equal(result.totalReads, 75);
  });

  it('后端能量与自旋不一致时样本不被能量闸门拒绝（信息性字段，退化由最优率兜底）', async () => {
    const p = coupledProblem(43);
    const optimal = bruteForceOptimum(p).assignment;
    const backend = dwaveWith(() => ({
      id: 'prob-t2b',
      status: 'COMPLETED',
      answer: {
        solutions: [spinsOf(optimal, 2, 3)],
        // 能量刻意给成与 (h,J) 完全不符的值：实现不校验能量（刻意的信任姿态）
        energies: [12345.678],
        num_occurrences: [9],
      },
    }));
    const result = await solveAssignmentOnBackend(p, backend, { numReads: 9 });
    assert.deepEqual(result.assignment, optimal);
    assert.equal(result.invalidSamples, 0, '能量不参与闸门：不得因能量不符丢样本');
    assert.ok(result.optimality && Math.abs(result.optimality.ratio - 1) < 1e-9);
  });
});

// ----------------------------------------------------------------------------
// T3 numReads 缺省的路径差异
// ----------------------------------------------------------------------------

describe('第三遍 · T3 numReads 缺省（D-Wave 100 / 本地精确引擎 128）', () => {
  it('本地精确引擎：缺省采样数 128 且 totalReads 原样上报', async () => {
    const result = await solveAssignmentOnBackend(
      coupledProblem(7, 3, 5),
      new LocalQuantumBackend(),
    );
    assert.equal(result.totalReads, 128, '本地路径缺省 = DEFAULT_SHOTS(128)，非 DWave 的 100');
    assert.equal(result.invalidSamples, 0);
  });

  it('D-Wave：缺省提交参数 num_reads=100（接口 JSDoc 声明的后端侧缺省）', async () => {
    const p = coupledProblem(44);
    const optimal = bruteForceOptimum(p).assignment;
    const { fetchImpl, requests } = mockTransport(() => ({
      id: 'prob-t3',
      status: 'COMPLETED',
      answer: {
        solutions: [spinsOf(optimal, 2, 3)],
        energies: [-1],
        num_occurrences: [30],
      },
    }));
    const backend = new DWaveBackend({ token: 't', fetch: fetchImpl });
    const result = await solveAssignmentOnBackend(p, backend); // 不传 numReads
    const post = requests.find((r) => r.method === 'POST');
    const params = post?.body?.params;
    assert.ok(params, '应发起 POST /problems/ 且带 params');
    assert.equal(params.num_reads, 100, 'D-Wave 侧缺省 num_reads=100');
    assert.equal(result.totalReads, 30, 'totalReads 按实际 occurrences 汇总上报');
  });
});

// ----------------------------------------------------------------------------
// T4 全空间引擎跨实例同种子复现
// ----------------------------------------------------------------------------

describe('第三遍 · T4 全空间跨实例同种子位级复现', () => {
  it('qaoaSolve：两个结构相同的新鲜实例 + 同种子 → 解逐字段位级一致', () => {
    const options = {
      layers: 2,
      restarts: 2,
      seed: 42,
      select: 'shots-best' as const,
      shots: 64,
      topK: 3,
    };
    // 两个新鲜实例：computeEnergies 的 WeakMap 记忆化按实例隔离，
    // 各自全新计算能量表——位级一致必须是算术确定性的结果
    const a = qaoaSolve(coupledProblem(1234), options);
    const b = qaoaSolve(coupledProblem(1234), options);
    assert.deepStrictEqual(a, b);
  });

  it('annealSolve（born 坍缩，含 rng 消耗路径）与 qaoaSolve（born）同样位级一致', () => {
    const annealA = annealSolve(coupledProblem(5678), {
      seed: 42,
      select: 'born',
      anneal: { tau: 40, steps: 300 },
    });
    const annealB = annealSolve(coupledProblem(5678), {
      seed: 42,
      select: 'born',
      anneal: { tau: 40, steps: 300 },
    });
    assert.deepStrictEqual(annealA, annealB);
    const bornA = qaoaSolve(coupledProblem(5678), { seed: 42, select: 'born', layers: 2 });
    const bornB = qaoaSolve(coupledProblem(5678), { seed: 42, select: 'born', layers: 2 });
    assert.deepStrictEqual(bornA, bornB);
    assert.ok(Number.isFinite(annealA.welfare) && Number.isFinite(bornA.welfare));
  });
});

// ----------------------------------------------------------------------------
// T5 born 修复路径的概率同源
// ----------------------------------------------------------------------------

describe('第三遍 · T5 born 修复路径概率同源', () => {
  const LAYERS = 2;

  /** 用导出原语从报告角度独立重建末态 Born 概率表（与 twin-convergence 同款重建） */
  function probsOf(problem: AssignmentProblem, angles: number[]): Float64Array {
    const info = computeEnergies(problem);
    const normalized = normalizedEnergies(info.energies, info.min, info.max, 1);
    const st = new QuantumStateVector(info.nqubits);
    st.setUniformSuperposition();
    for (let p = 0; p < LAYERS; p++) {
      st.applyCostPhase(angles[p]!, normalized);
      st.applyMixer(angles[LAYERS + p]!);
    }
    return st.probabilities();
  }

  function stateOf(assignment: number[], n: number): number {
    let s = 0;
    for (let t = 0; t < assignment.length; t++) s |= 1 << (t * n + assignment[t]!);
    return s;
  }

  it('修复路径（seed=5 实测落非法态）：probability = 报告分配自身基态的 Born 概率', () => {
    const p = weakPenaltyProblem();
    const sol = qaoaSolve(p, { select: 'born', seed: 5, layers: LAYERS, restarts: 1 });
    assert.ok(sol.repaired, '前提：该种子 born 采样落非法态并触发修复');
    assert.ok(sol.validMass >= 1e-6, '前提：合法质量高于地板（非护栏兜底路径）');
    const probs = probsOf(p, sol.angles!);
    // 位级同源：上报概率必须属于报告的那个分配（修复前这里是
    // bestValidProb——概率最大合法基态 [0,1] 的概率，另一个分配的值）
    assert.ok(
      Object.is(sol.probability, probs[stateOf(sol.assignment, 3)]),
      `probability ${sol.probability} 应等于报告分配 [${sol.assignment}] 的 Born 概率 ` +
        `${probs[stateOf(sol.assignment, 3)]}（而非 bestValidProb ${sol.candidates[0]!.probability}）`,
    );
    assert.ok(!Object.is(sol.probability, sol.candidates[0]!.probability));
  });

  it('合法邻域：健康 born 采样与 argmax-valid 的概率同样与分配同源', () => {
    const p = weakPenaltyProblem();
    // 健康 born（seed=6 实测不触发修复）：概率 = 所选基态的 Born 概率
    const healthy = qaoaSolve(p, { select: 'born', seed: 6, layers: LAYERS, restarts: 1 });
    assert.ok(!healthy.repaired, '前提：健康种子不触发修复');
    const probs = probsOf(p, healthy.angles!);
    assert.ok(Object.is(healthy.probability, probs[stateOf(healthy.assignment, 3)]));
    // argmax-valid：所选即 top-1 候选（坍缩语义未被本修复改变）
    const argmax = qaoaSolve(p, { select: 'argmax-valid', seed: 5, layers: LAYERS, restarts: 1 });
    assert.ok(
      Object.is(argmax.probability, probsOf(p, argmax.angles!)[stateOf(argmax.assignment, 3)]),
    );
    assert.equal(argmax.probability, argmax.candidates[0]!.probability);
  });
});
