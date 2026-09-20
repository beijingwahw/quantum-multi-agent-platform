/**
 * R19 创新 · execution-tier 双画像钉板（代理 S · QPU 域）
 *
 * 钉三张面：
 * - 命题 1 决策面零变化：dual.decision 与 decideExecutionTier(计数口径直接
 *   调用) 在 nisq / ftqc-queue / classical 三种形态下逐字节 deepEqual；
 * - 命题 2/3 双画像继承：ftDual.serial ≡ decision.ftqc（同码同假设），
 *   定理 C 恒等式（T 计数/蒸馏/占地逐字节、轮数/信道/墙钟线性缩减）在
 *   决策缝上复钉；缩减因子手算锚；
 * - 负对照：越界/重边/未归一化边走私具名拒绝；nisq 判定不消费边集
 *   （镜像规则）；classical 回退下并行账达标不回写决策（决策面冻结）。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { decideExecutionTierDual } from '../src/core/qpu/execution-tier-dual.js';
import type {
  ExecutionTierDualRequest,
  ExecutionTierDualDecision,
} from '../src/core/qpu/execution-tier-dual.js';
import { decideExecutionTier } from '../src/core/qpu/execution-tier.js';
import type { CouplingEdge } from '../src/core/qpu/commutation-ft.js';
import { QuantumEstimateError } from '../src/utils/errors.js';

const edge = (a: number, b: number): CouplingEdge => [a, b];

/** 调度形状耦合集（one-hot 团 + 同 agent 容量对——toIsing 的 J 结构） */
function schedulingCouplings(m: number, n: number): CouplingEdge[] {
  const out: CouplingEdge[] = [];
  for (let t = 0; t < m; t++) {
    for (let a1 = 0; a1 < n; a1++) {
      for (let a2 = a1 + 1; a2 < n; a2++) out.push(edge(t * n + a1, t * n + a2));
    }
  }
  for (let a = 0; a < n; a++) {
    for (let t1 = 0; t1 < m; t1++) {
      for (let t2 = t1 + 1; t2 < m; t2++) out.push(edge(t1 * n + a, t2 * n + a));
    }
  }
  return out;
}

/**
 * 命题 1 的独立复算裁判：计数口径由测试自行从边集导出（与被测模块的
 * 导出方式独立同构），直接调既有决策器对拍。
 */
function dualWithUnchangedDecision(
  label: string,
  req: ExecutionTierDualRequest,
): ExecutionTierDualDecision {
  const dual = decideExecutionTierDual(req);
  const direct = decideExecutionTier({
    logicalQubits: req.logicalQubits,
    couplings: req.couplingEdges.length,
    ...(req.circuitDepth !== undefined ? { circuitDepth: req.circuitDepth } : {}),
    ...(req.nisq !== undefined ? { nisq: req.nisq } : {}),
    ...(req.ft !== undefined ? { ft: req.ft } : {}),
  });
  assert.deepEqual(dual.decision, direct, `${label}: 决策面必须逐字节零变化`);
  return dual;
}

describe('R19S · 命题 1：决策面零变化（三形态对拍）', () => {
  it('nisq 形态：决策一致且 ftDual === undefined（FT 账不在 nisq 决策面内）', () => {
    const couplings = schedulingCouplings(4, 5); // nq=20 ≤ 133
    const dual = dualWithUnchangedDecision('nisq', {
      logicalQubits: 20,
      couplingEdges: couplings,
      circuitDepth: 4,
    });
    assert.equal(dual.decision.tier, 'nisq');
    assert.equal(dual.ftDual, undefined, '镜像规则：nisq 判定不补算 FT 双画像');
  });

  it('ftqc-queue 形态：决策一致且 ftDual 必有', () => {
    const couplings = schedulingCouplings(4, 5);
    const dual = dualWithUnchangedDecision('ftqc-queue', {
      logicalQubits: 20,
      couplingEdges: couplings,
      circuitDepth: 4,
      nisq: { maxQubits: 10 },
    });
    assert.equal(dual.decision.tier, 'ftqc-queue');
    assert.notEqual(dual.ftDual, undefined);
  });

  it('classical 形态：决策一致（超错误预算回退本地精确引擎）', () => {
    // 紧预算使所有 surface 距离超预算（无 fallback 语义歧义）
    const couplings = schedulingCouplings(4, 5);
    const dual = dualWithUnchangedDecision('classical', {
      logicalQubits: 20,
      couplingEdges: couplings,
      circuitDepth: 4,
      nisq: { maxQubits: 10 },
      ft: { targetCircuitError: 1e-20 },
    });
    assert.equal(dual.decision.tier, 'classical');
    assert.notEqual(dual.ftDual, undefined);
  });
});

describe('R19S · 命题 2/3：双画像继承（串行账与定理 C 恒等式）', () => {
  it('ftDual.serial ≡ decision.ftqc（同码、同假设、逐字节）', () => {
    const couplings = schedulingCouplings(4, 5);
    const dual = decideExecutionTierDual({
      logicalQubits: 20,
      couplingEdges: couplings,
      circuitDepth: 4,
      nisq: { maxQubits: 10 },
    });
    assert.ok(dual.ftDual !== undefined);
    assert.deepEqual(dual.ftDual.serial, dual.decision.ftqc);
  });

  it('定理 C 在决策缝上：T 计数/蒸馏/占地逐字节，轮数/信道/墙钟线性缩减', () => {
    const couplings = schedulingCouplings(6, 6); // E=180, nq=36
    const dual = decideExecutionTierDual({
      logicalQubits: 36,
      couplingEdges: couplings,
      circuitDepth: 8,
      nisq: { maxQubits: 30 },
    });
    assert.ok(dual.ftDual !== undefined);
    const { serial, parallel, partition, roundsReductionFactor } = dual.ftDual;
    // 逐字节不变族（定理 C 继承）
    assert.equal(parallel.tGatesTotal, serial.tGatesTotal);
    assert.equal(parallel.epsilonDistillation, serial.epsilonDistillation);
    assert.equal(parallel.physicalQubits, serial.physicalQubits);
    assert.equal(parallel.blocks, serial.blocks);
    // 线性缩减族：操作数比 = 轮数比 = 信道错误比（syndromeRoundsPerOp 与
    // lepr 同码同假设 → 逐位相同，比例恒等）
    const opsRatio = parallel.logicalOpsTotal / serial.logicalOpsTotal;
    assert.ok(
      Math.abs(parallel.syndromeRoundsTotal / serial.syndromeRoundsTotal - opsRatio) < 1e-12,
    );
    assert.ok(Math.abs(parallel.epsilonChannel / serial.epsilonChannel - opsRatio) < 1e-12);
    assert.ok(Math.abs(parallel.wallTimeMs / serial.wallTimeMs - opsRatio) < 1e-12);
    // 缩减因子手算锚：(E + 2nq) / (groups + 1) = 252/(groups+1)
    assert.ok(Math.abs(roundsReductionFactor - 252 / (partition.groupCount + 1)) < 1e-12);
    assert.ok(roundsReductionFactor > 8, '稠密调度形状缩减因子 > 8（r18b 同锚）');
    assert.ok(partition.gap >= 0 && partition.groupCount >= partition.lowerBound);
  });

  it('退火型提交（circuitDepth 省略）：深度按 1 测，双画像同口径', () => {
    const couplings = schedulingCouplings(4, 5);
    const dual = decideExecutionTierDual({
      logicalQubits: 20,
      couplingEdges: couplings,
      nisq: { maxQubits: 10 },
    });
    assert.ok(dual.ftDual !== undefined);
    // depth=1 × (E + 2·nq) = 1 × 110
    assert.equal(dual.ftDual.serial.logicalOpsTotal, 110);
    assert.ok(dual.ftDual.note.includes('serial rotations'));
  });

  it('空耦合集＋大 nq：纯场线路极限（1 组 + 混合轮，缩减因子 = nq）', () => {
    const dual = dualWithUnchangedDecision('fields-only', {
      logicalQubits: 200,
      couplingEdges: [],
    });
    assert.equal(dual.decision.tier, 'ftqc-queue');
    assert.ok(dual.ftDual !== undefined);
    assert.equal(dual.ftDual.partition.groupCount, 1);
    assert.equal(dual.ftDual.partition.gap, 0);
    // (0 + 2·200) / (1 + 1) = 200
    assert.equal(dual.ftDual.roundsReductionFactor, 200);
  });

  it('确定性：同输入两次调用 deepEqual（含 note 字符串）', () => {
    const req: ExecutionTierDualRequest = {
      logicalQubits: 36,
      couplingEdges: schedulingCouplings(6, 6),
      circuitDepth: 8,
      nisq: { maxQubits: 30 },
    };
    assert.deepEqual(decideExecutionTierDual(req), decideExecutionTierDual(req));
  });
});

describe('R19S · 决策面冻结：并行账不回写 tier', () => {
  it('串行全距离超预算（classical）而并行账达标：tier 仍 classical，note 声明 informational', () => {
    // 构造：pPhys 逼近阈值（0.0055/0.006）使串行信道错误在所有 surface
    // 距离上都超过宽松预算（回退最小占地 d=3）；稠密调度形状的并行缩减
    // （~25 倍）把并行信道错误压回预算内——对读信息，不构成改判。
    const couplings = schedulingCouplings(8, 8); // E=448, nq=64
    const dual = dualWithUnchangedDecision('freeze', {
      logicalQubits: 64,
      couplingEdges: couplings,
      nisq: { maxQubits: 32 },
      ft: { pPhys: 0.0055, targetCircuitError: 10 },
    });
    assert.equal(dual.decision.tier, 'classical');
    assert.ok(dual.decision.ftqc !== undefined);
    assert.equal(dual.decision.ftqc.meetsBudget, false, '前置：串行账确实超预算');
    assert.ok(dual.ftDual !== undefined);
    assert.equal(dual.ftDual.parallel.meetsBudget, true, '前置：并行账确实达标');
    assert.match(dual.ftDual.note, /not a re-decision/);
    assert.match(dual.ftDual.note, /serial=false parallel=true/);
  });
});

describe('R19S · 负对照：边集走私具名拒绝（FT 路径）', () => {
  const badEdgesCases: Array<{ label: string; edges: CouplingEdge[]; pattern: RegExp }> = [
    { label: '越界边（q ≥ logicalQubits）', edges: [edge(0, 999)], pattern: /must be \[q1, q2\]/ },
    { label: '重边', edges: [edge(0, 1), edge(0, 1)], pattern: /duplicate coupling edge/ },
    { label: '未归一化边', edges: [edge(1, 0)], pattern: /normalized/ },
  ];
  for (const { label, edges, pattern } of badEdgesCases) {
    it(`${label}：nisq 装不下时（FT 路径必达）具名拒绝`, () => {
      assert.throws(
        () =>
          decideExecutionTierDual({
            logicalQubits: 4,
            couplingEdges: edges,
            nisq: { maxQubits: 2 },
          }),
        (e: unknown) => e instanceof QuantumEstimateError && pattern.test(e.message),
      );
    });
  }

  it('同款走私边＋nisq 装得下：不抛（nisq 判定只读计数，不消费边集——决策面同构）', () => {
    const dual = decideExecutionTierDual({
      logicalQubits: 4,
      couplingEdges: [edge(1, 0)], // 未归一化，但 nisq 判定不读它
    });
    assert.equal(dual.decision.tier, 'nisq');
    assert.equal(dual.ftDual, undefined);
  });
});
