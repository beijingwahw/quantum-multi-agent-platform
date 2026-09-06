/**
 * 执行层级路由 —— FTQC 估算器决定 NISQ / FTQC 排队 / 经典回退
 *
 * 覆盖三层：估算器数值内核（与工作区 ft-qaoa 原型同构，数字可互证）、
 * 路由器三态决策、solve/scheduler 接缝行为（defer 抛画像 / classical
 * 强制本地 / nisq 原路径不变）。
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  surfaceCode,
  grossCode,
  logicalErrorPerRound,
  blocksFor,
  estimateFtCircuit,
  selectFtCode,
  DEFAULT_FT_ASSUMPTIONS,
} from '../src/core/qpu/ft-estimate.js';
import { decideExecutionTier, DEFAULT_NISQ_PROFILE } from '../src/core/qpu/execution-tier.js';
import { solveAssignmentOnBackend } from '../src/core/qpu/solve.js';
import { LocalQuantumBackend } from '../src/core/qpu/quantum-backend.js';
import type { QuantumBackend, QpuSampleSet } from '../src/core/qpu/quantum-backend.js';
import { FtqcDeferredError, QuantumEstimateError } from '../src/utils/errors.js';
import { defaultPenalties } from '../src/core/quantum-optimizer.js';
import type { AssignmentProblem } from '../src/core/quantum-optimizer.js';

function makeProblem(m: number, n: number, seed: number): AssignmentProblem {
  let a = seed >>> 0;
  const rng = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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

/** 假 NISQ 后端：只用于断言“classical 判定时从未被调用” */
function fakeBackend(name = 'fake-nisq'): QuantumBackend & { calls: number } {
  const impl = {
    calls: 0,
    name,
    realHardware: false,
    isAvailable: () => true,
    solveIsing: (): Promise<QpuSampleSet> => {
      impl.calls++;
      throw new Error('fake backend must not be called under classical routing');
    },
  };
  return impl;
}

describe('FTQC 资源估算器（数值内核）', () => {
  it('码目录参数与公开文献一致', () => {
    const s5 = surfaceCode(5);
    assert.equal(s5.n, 25);
    assert.equal(s5.k, 1);
    assert.equal(s5.ancilla, 24);
    const g = grossCode();
    assert.equal(g.n, 144);
    assert.equal(g.k, 12);
    assert.equal(g.d, 12);
    assert.equal(g.ancilla, 144);
    assert.ok(g.source.includes('Bravyi'));
    assert.equal(blocksFor(80, g), 7);
    assert.equal(blocksFor(12, g), 1);
    assert.throws(() => surfaceCode(2.5), QuantumEstimateError);
  });

  it('逻辑错误幂律：随码距与物理错误率单调下降', () => {
    const pPhys = 1e-3;
    const e5 = logicalErrorPerRound(surfaceCode(5), pPhys);
    const e7 = logicalErrorPerRound(surfaceCode(7), pPhys);
    const e7better = logicalErrorPerRound(surfaceCode(7), 1e-4);
    assert.ok(Math.abs(e5 - 0.1 * Math.pow(1 / 6, 3)) < 1e-18);
    assert.ok(e7 < e5);
    assert.ok(e7better < e7);
  });

  it('估算组合自洽：操作数/T 门/错误预算/墙钟可复算', () => {
    const profile = { logicalQubits: 80, couplings: 240, depth: 128 };
    const est = estimateFtCircuit(profile, grossCode());
    assert.equal(est.blocks, 7);
    assert.equal(est.physicalQubits, 7 * 288);
    assert.equal(est.logicalOpsTotal, 128 * (240 + 160));
    // T 每旋转 = ceil(3·log2(1e6)) + 4 = 64
    assert.equal(est.tGatesTotal, est.logicalOpsTotal * 64);
    assert.equal(est.syndromeRoundsTotal, est.logicalOpsTotal * 12);
    assert.ok(Math.abs(est.wallTimeMs - est.syndromeRoundsTotal / 1000) < 1e-12);
    assert.ok(Math.abs(est.epsilonTotal - (est.epsilonChannel + est.epsilonDistillation)) < 1e-18);
    assert.equal(est.meetsBudget, est.epsilonTotal <= DEFAULT_FT_ASSUMPTIONS.targetCircuitError);
    // gross 固定 d=12 在 p_phys=1e-3 下深电路超预算（与 ft-qaoa 原型同结论）
    assert.ok(!est.meetsBudget);
    assert.ok(est.epsilonTotal > 0.05);
    // 更好的物理比特救活它
    const better = estimateFtCircuit(profile, grossCode(), { pPhys: 1e-4 });
    assert.ok(better.meetsBudget);
  });

  it('码选择：surface 距离扫描找到可行解时取最小占地', () => {
    const { surface, gross, chosen } = selectFtCode({ logicalQubits: 12, couplings: 20, depth: 8 });
    assert.ok(surface.meetsBudget);
    assert.equal(gross.code.id, 'gross-bb-144-12-12');
    // 小浅电路：单块 gross 更省 → chosen 为 gross
    assert.equal(chosen.code.id, 'gross-bb-144-12-12');
    const deep = selectFtCode({ logicalQubits: 80, couplings: 240, depth: 128 });
    // 深大电路：gross 超预算 → chosen 落在可行 surface
    assert.ok(!deep.gross.meetsBudget || deep.chosen.code.family === 'surface');
    assert.ok(chosen.totalPhysicalQubits <= surface.totalPhysicalQubits);
  });

  it('非法画像被入口拒绝', () => {
    assert.throws(
      () => estimateFtCircuit({ logicalQubits: 0, couplings: 5, depth: 8 }, grossCode()),
      QuantumEstimateError,
    );
    assert.throws(
      () => estimateFtCircuit({ logicalQubits: 8, couplings: 5, depth: 0 }, grossCode()),
      QuantumEstimateError,
    );
  });
});

describe('执行层级路由器（三态决策）', () => {
  it('装得下 NISQ → nisq 直发', () => {
    const d = decideExecutionTier({ logicalQubits: 60, couplings: 100, circuitDepth: 8 });
    assert.equal(d.tier, 'nisq');
    assert.ok(d.nisqFit.qubitsOk && d.nisqFit.depthOk);
    assert.equal(d.ftqc, undefined);
    assert.ok(d.reason.includes('fits NISQ'));
  });

  it('深度超轮廓（p>10 深电路）且容错预算内 → ftqc-queue 带完整画像', () => {
    const d = decideExecutionTier({ logicalQubits: 80, couplings: 240, circuitDepth: 128 });
    assert.equal(d.tier, 'ftqc-queue');
    assert.ok(!d.nisqFit.depthOk);
    assert.ok(d.ftqc);
    assert.ok(d.ftqc.meetsBudget);
    assert.ok(d.ftqc.totalPhysicalQubits > 0);
    assert.ok(d.reason.includes('FTQC estimate within budget'));
  });

  it('退火型提交（无层数）只查比特装载', () => {
    const fits = decideExecutionTier({
      logicalQubits: 5000,
      couplings: 30000,
      nisq: { maxQubits: 5640 },
    });
    assert.equal(fits.tier, 'nisq');
    assert.equal(fits.nisqFit.checkedDepth, false);
    const overflow = decideExecutionTier({
      logicalQubits: 6000,
      couplings: 40000,
      nisq: { maxQubits: 5640 },
    });
    // 6000 逻辑比特深 Ising：FT 预算内可行 → 排队
    assert.equal(overflow.tier === 'ftqc-queue' || overflow.tier === 'classical', true);
    assert.ok(overflow.ftqc !== undefined);
  });

  it('容错估算超预算 → classical 回退，reason 带出具体 eps', () => {
    const d = decideExecutionTier({
      logicalQubits: 80,
      couplings: 240,
      circuitDepth: 128,
      ft: { targetCircuitError: 1e-6 },
    });
    assert.equal(d.tier, 'classical');
    assert.ok(d.reason.includes('fails error budget'));
    assert.ok(d.reason.includes('eps='));
  });

  it('默认 NISQ 轮廓可配置覆盖', () => {
    assert.equal(DEFAULT_NISQ_PROFILE.maxCircuitDepth, 10);
    const d = decideExecutionTier({
      logicalQubits: 60,
      couplings: 100,
      circuitDepth: 128,
      nisq: { maxCircuitDepth: 200 },
    });
    assert.equal(d.tier, 'nisq');
  });
});

describe('solve/scheduler 接缝（路由行为）', () => {
  it('routing 缺省：行为与历史版本完全一致', async () => {
    const problem = makeProblem(3, 4, 11);
    const result = await solveAssignmentOnBackend(problem, new LocalQuantumBackend());
    assert.equal(result.backend, 'local-subspace');
    assert.equal(result.executionTier, undefined);
  });

  it('nisq 判定：照常执行并附带 executionTier 决策', async () => {
    const problem = makeProblem(2, 3, 12); // 6 qubits
    const result = await solveAssignmentOnBackend(problem, new LocalQuantumBackend(), {
      routing: { circuitDepth: 4 },
    });
    assert.equal(result.executionTier?.tier, 'nisq');
    assert.ok(result.welfare > 0);
  });

  it('ftqc-queue 判定：不执行，抛 FtqcDeferredError 且画像随行', async () => {
    const problem = makeProblem(2, 3, 13);
    await assert.rejects(
      solveAssignmentOnBackend(problem, new LocalQuantumBackend(), {
        routing: { circuitDepth: 128 },
      }),
      (err: unknown) => {
        assert.ok(err instanceof FtqcDeferredError);
        assert.equal(err.decision.tier, 'ftqc-queue');
        assert.ok(err.decision.ftqc);
        assert.ok(err.decision.ftqc.totalPhysicalQubits > 0);
        assert.ok(err.message.includes('FTQC queue'));
        return true;
      },
    );
  });

  it('classical 判定：估算超预算时强制转本地精确引擎（不再调用原后端）', async () => {
    const problem = makeProblem(2, 3, 14); // 6 qubits, NISQ 装得下比特但深度溢出
    const fake = fakeBackend();
    const result = await solveAssignmentOnBackend(problem, fake, {
      routing: {
        circuitDepth: 128,
        // 极严苛预算：FTQC 也不可行 → classical → 本地精确引擎接管
        ft: { targetCircuitError: 1e-9 },
      },
    });
    assert.equal(result.executionTier?.tier, 'classical');
    assert.equal(result.backend, 'local-subspace');
    assert.equal(fake.calls, 0);
    assert.ok(result.optimality && Math.abs(result.optimality.ratio - 1) < 1e-9);
  });
});
