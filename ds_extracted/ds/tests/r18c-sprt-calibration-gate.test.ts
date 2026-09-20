/**
 * R18-C 创新 1：SprtCalibrationGate（混合似然比 SPRT 序贯校准门）的
 * 机器验收面——与 src/proactive-intelligence/sprt-calibration-gate.ts
 * 模块头的四条定理一一对应：
 *   定理 1（第一类误差）→ 鞅恒等式对拍 + null 误差率扫描 + 错误 null 定罪；
 *   定理 2（分量第二类）→ 快照的逐分量界非真空性（16 分量 × β=0.02）；
 *   定理 3（期望停时）→ 单分量 Wald 界 + SPRT vs 固定样本对比；
 *   定理 4（族控制）→ Bonferroni 5 门族的 family-wise 扫描；
 *   附：k=0 零信息、确定性逐位复现、配置域走私负对照。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SprtCalibrationGate,
  DEFAULT_SPRT_COMPONENTS,
  DEFAULT_SPRT_GATE_CONFIG,
  bonferroniTypeOne,
  sprtTypeOneUpperBound,
  type SprtGateSnapshot,
} from '../src/proactive-intelligence/sprt-calibration-gate.js';
import { mulberry32 } from '../src/utils/rng.js';
import { ConfigurationError, NumericDomainError, StateError } from '../src/utils/errors.js';

// ----------------------------------------------------------------------------
// 流脚手架：可料 (base, k) 模式 + 种子化 Bernoulli（非独立同分布流：
// base 轮转 0.4/0.5/0.6、k 轮转 1..8——定理 1 的可料自适应面由构造覆盖）
// ----------------------------------------------------------------------------

interface Obs {
  base: number;
  k: number;
  success: boolean;
}

function nullObservations(seed: number, count: number): Obs[] {
  const rng = mulberry32(seed);
  const out: Obs[] = [];
  for (let i = 0; i < count; i++) {
    const base = 0.4 + 0.1 * (i % 3);
    const k = 1 + (i % 8);
    out.push({ base, k, success: rng() < base });
  }
  return out;
}

/** 学习流：真值 = 学习曲线分量 (alpha, beta)，资本爬升至 kMax 后饱和 */
function learningObservations(
  seed: number,
  count: number,
  alpha: number,
  beta: number,
  base = 0.5,
  kMax = 12,
): Obs[] {
  const rng = mulberry32(seed);
  const out: Obs[] = [];
  for (let i = 0; i < count; i++) {
    const k = Math.min(i, kMax);
    const p = base + alpha * (1 - base) * (1 - Math.exp(-beta * k));
    out.push({ base, k, success: rng() < p });
  }
  return out;
}

/** 喂门直到终判或流尽，返回终态快照 */
function runGate(gate: SprtCalibrationGate, obs: Obs[]): SprtGateSnapshot {
  let snap = gate.getState();
  for (const o of obs) {
    if (gate.isTerminal()) break;
    snap = gate.observe(o.base, o.k, o.success);
  }
  return snap;
}

// ----------------------------------------------------------------------------
// 定理 1 · 鞅恒等式对拍（E[Λ_{N∧n}] = 1 的机器面）
// ----------------------------------------------------------------------------

describe('R18-C · SPRT 门 · 鞅恒等式对拍', () => {
  it('E[Λ_{N∧50}] ≈ 1：null 流 4000 种子平均（宽边界 + 截断 50；受限停时定理的数值面）', () => {
    const M = 4000;
    const HORIZON = 50;
    let sum = 0;
    for (let s = 0; s < M; s++) {
      const gate = new SprtCalibrationGate({
        typeOne: 1e-6,
        typeTwo: 1e-6,
        maxObservations: HORIZON,
      });
      const snap = runGate(gate, nullObservations(s, HORIZON));
      assert.equal(snap.decision, 'truncated', '宽边界下 50 步内不应越界（截断即停）');
      sum += Math.exp(snap.logLikelihoodRatio);
    }
    const mean = sum / M;
    console.log(`[R18-C 鞅对拍] E[Λ] 实测 = ${mean.toFixed(4)}（M=${M}，理论 1）`);
    assert.ok(
      Math.abs(mean - 1) < 0.15,
      `鞅恒等式数值面：平均 ${mean} 应接近 1（蒙特卡洛容差 0.15）`,
    );
  });

  it('负对照（走私审判）：分子分母互换的统计量 E[1/Λ] ≫ 1——互换实现会被本钉板定罪', () => {
    const M = 2000;
    const HORIZON = 50;
    let sum = 0;
    for (let s = 0; s < M; s++) {
      const gate = new SprtCalibrationGate({
        typeOne: 1e-6,
        typeTwo: 1e-6,
        maxObservations: HORIZON,
      });
      const snap = runGate(gate, nullObservations(s, HORIZON));
      // 互换统计量 = −λ（对数域逐点取负）：其均值的爆炸即走私定罪
      sum += Math.exp(-snap.logLikelihoodRatio);
    }
    const mean = sum / M;
    console.log(`[R18-C 走私审判] E[1/Λ] 实测 = ${mean.toFixed(3)}（互换统计量应远离 1）`);
    assert.ok(mean > 1.5, `互换统计量的停时均值 ${mean} 应显著偏离 1（定罪阈值 1.5）`);
  });
});

// ----------------------------------------------------------------------------
// 定理 1 · null 误差率 + 检出行为
// ----------------------------------------------------------------------------

describe('R18-C · SPRT 门 · 误差率与检出', () => {
  it('null 流：empirical reject ≤ α/(1−β)（3000 种子；定理 1 的经验面）', () => {
    const ALPHA = 0.05;
    const BETA = 0.02;
    const M = 3000;
    let rejects = 0;
    let accepts = 0;
    let truncated = 0;
    for (let s = 0; s < M; s++) {
      const gate = new SprtCalibrationGate({ typeOne: ALPHA, typeTwo: BETA, maxObservations: 400 });
      const snap = runGate(gate, nullObservations(s, 400));
      if (snap.decision === 'rejectNull') rejects++;
      else if (snap.decision === 'acceptNull') accepts++;
      else truncated++;
    }
    const rate = rejects / M;
    const bound = sprtTypeOneUpperBound(ALPHA, BETA);
    console.log(
      `[R18-C null 扫描] reject=${rate.toFixed(4)} ≤ 界=${bound.toFixed(4)} | ` +
        `accept=${(accepts / M).toFixed(3)} truncated(不决)=${(truncated / M).toFixed(3)}（M=${M}）`,
    );
    assert.ok(rate <= bound, `null 拒绝率 ${rate} 超出定理 1 界 ${bound}`);
    assert.ok(accepts / M >= 0.7, 'null 流应以接受为主（下界早收）');
    assert.equal(rejects + accepts + truncated, M, '四态计数守恒');
    // 截断是不决而非错误：type-I 口径只数 rejectNull（首红自省：SPRT 承诺
    // 误差控制，不承诺限时必判——8.7% 的 400 步不决是真实统计事实）
  });

  it('学习流（真值 = 网格分量 0.6/0.12）：检出率 ≥ 0.85，平均停时 ≪ 截断上界', () => {
    const M = 200;
    let rejects = 0;
    let totalN = 0;
    for (let s = 0; s < M; s++) {
      const gate = new SprtCalibrationGate(); // 缺省：α=0.05, β=0.02, N*=600, 16 分量
      const snap = runGate(gate, learningObservations(s, 600, 0.6, 0.12));
      totalN += snap.observations;
      if (snap.decision === 'rejectNull') rejects++;
    }
    console.log(
      `[R18-C 学习流] 检出率=${(rejects / M).toFixed(3)}，平均停时=${(totalN / M).toFixed(1)}（M=${M}，N*=600）`,
    );
    assert.ok(rejects / M >= 0.85, `检出率 ${(rejects / M).toFixed(3)} 应 ≥ 0.85`);
    assert.ok(totalN / M < 150, '平均停时应远小于截断上界');
  });

  it('k=0 观测零信息：增量恰为 0（似然族精确性质，非实现细节）', () => {
    const gate = new SprtCalibrationGate();
    const a = gate.observe(0.5, 0, true);
    const b = gate.observe(0.7, 0, false);
    assert.equal(a.logLikelihoodRatio, 0);
    assert.equal(b.logLikelihoodRatio, 0);
    assert.equal(a.maxAbsIncrement, 0);
    assert.equal(b.decision, 'continue');
  });

  it('快照口径：边界常数 = ln((1−β)/α) / ln(β/(1−α))；16 分量第二类界 = 16β/(1−α) 非真空', () => {
    const gate = new SprtCalibrationGate({ typeOne: 0.05, typeTwo: 0.02 });
    const snap = gate.getState();
    assert.ok(Math.abs(snap.logUpperBoundary - Math.log(0.98 / 0.05)) < 1e-12);
    assert.ok(Math.abs(snap.logLowerBoundary - Math.log(0.02 / 0.95)) < 1e-12);
    assert.equal(snap.componentTypeTwoUpperBounds.length, DEFAULT_SPRT_COMPONENTS.length);
    for (const b of snap.componentTypeTwoUpperBounds) {
      assert.ok(Math.abs(b - (0.02 / 0.95) * 16) < 1e-12);
      assert.ok(b < 1, '均匀 16 分量 × β=0.02：逐分量第二类界应非真空（< 1）');
    }
  });
});

// ----------------------------------------------------------------------------
// 定理 3 · 期望停时：Wald 界 + SPRT vs 固定样本
// ----------------------------------------------------------------------------

describe('R18-C · SPRT 门 · 期望停时（定理 3）', () => {
  /** 单分量门（K=1，定理 3 前置条件 KL > ln(1/w)=0 在任意正 KL 下成立） */
  const single = (): SprtCalibrationGate =>
    new SprtCalibrationGate({
      typeOne: 0.05,
      typeTwo: 0.02,
      maxObservations: 2000,
      components: [{ alpha: 0.6, beta: 0.12 }],
    });
  const BASE = 0.5;
  const K_CONST = 10;
  const truthP = BASE + 0.6 * (1 - BASE) * (1 - Math.exp(-0.12 * K_CONST));

  it('E[N] ≤ (ln A + c)/KL：常数 k 流、300 种子（Wald 恒等式的经验核）', () => {
    // KL 与 c 独立复算（与实现无共享代码路径）
    const succIncr = Math.log(truthP / BASE);
    const failIncr = Math.log((1 - truthP) / (1 - BASE));
    const kl = truthP * succIncr + (1 - truthP) * failIncr;
    const c = Math.max(Math.abs(succIncr), Math.abs(failIncr));
    const logA = Math.log(0.98 / 0.05);
    const M = 300;
    let totalN = 0;
    const rng = mulberry32(999);
    for (let s = 0; s < M; s++) {
      const gate = single();
      let snap = gate.getState();
      for (let i = 0; !gate.isTerminal(); i++) {
        snap = gate.observe(BASE, K_CONST, rng() < truthP);
      }
      totalN += snap.observations;
      assert.ok(snap.decision === 'rejectNull' || snap.decision === 'acceptNull');
    }
    const meanN = totalN / M;
    const bound = (logA + c) / kl;
    console.log(
      `[R18-C Wald 界] 实测 E[N]=${meanN.toFixed(1)} ≤ 界 (lnA+c)/KL=${bound.toFixed(1)}` +
        `（KL=${kl.toFixed(4)}, c=${c.toFixed(4)}, M=${M}）`,
    );
    assert.ok(meanN <= bound, `E[N]=${meanN} 超出 Wald 界 ${bound}`);
  });

  it('SPRT 平均停时 < 同等双误差目标的固定样本 n（经验扫描，400+400 种子）', () => {
    // SPRT 平均停时
    const M = 400;
    let totalN = 0;
    {
      const rng = mulberry32(1234);
      for (let s = 0; s < M; s++) {
        const gate = single();
        while (!gate.isTerminal()) gate.observe(BASE, K_CONST, rng() < truthP);
        totalN += gate.getState().observations;
      }
    }
    const sprtMean = totalN / M;
    // 固定样本：λ_n ≥ 0 判备择。扫描最小 n 使 type-I ≤ 0.05 且 type-II ≤ 0.02
    const succIncr = Math.log(truthP / BASE);
    const failIncr = Math.log((1 - truthP) / (1 - BASE));
    let nFixed: number | null = null;
    for (let n = 1; n <= 300; n++) {
      let falsePos = 0;
      let falseNeg = 0;
      const rng0 = mulberry32(50_000);
      const rng1 = mulberry32(90_000);
      for (let s = 0; s < M; s++) {
        let lr = 0;
        for (let i = 0; i < n; i++) lr += rng0() < BASE ? succIncr : failIncr;
        if (lr >= 0) falsePos++;
        let lr1 = 0;
        for (let i = 0; i < n; i++) lr1 += rng1() < truthP ? succIncr : failIncr;
        if (lr1 < 0) falseNeg++;
      }
      if (falsePos / M <= 0.05 && falseNeg / M <= 0.02) {
        nFixed = n;
        break;
      }
    }
    console.log(
      `[R18-C SPRT vs 固定样本] SPRT 平均停时=${sprtMean.toFixed(1)} vs 固定样本 n*=${nFixed}` +
        `（同等误差目标 α=0.05/β=0.02，M=${M}）`,
    );
    assert.ok(nFixed !== null, '300 步内固定样本应能达成双误差目标');
    assert.ok(sprtMean < nFixed, `SPRT 平均停时 ${sprtMean} 应小于固定样本 ${String(nFixed)}`);
  });
});

// ----------------------------------------------------------------------------
// 定理 4 · 族控制
// ----------------------------------------------------------------------------

describe('R18-C · SPRT 门 · Bonferroni 族控制（定理 4）', () => {
  it('5 门等分族水平 0.05：family-wise reject ≤ α_family/(1−β)（1500 族复制）', () => {
    const FAMILY = 0.05;
    const GATES = 5;
    const perGate = bonferroniTypeOne(FAMILY, GATES);
    assert.ok(Math.abs(perGate - 0.01) < 1e-15);
    const M = 1500;
    let familyRejects = 0;
    for (let r = 0; r < M; r++) {
      let anyReject = false;
      for (let j = 0; j < GATES; j++) {
        const gate = new SprtCalibrationGate({
          typeOne: perGate,
          typeTwo: 0.02,
          maxObservations: 400,
        });
        const snap = runGate(gate, nullObservations(r * 8 + j, 400));
        if (snap.decision === 'rejectNull') anyReject = true;
      }
      if (anyReject) familyRejects++;
    }
    const rate = familyRejects / M;
    const bound = FAMILY / (1 - 0.02);
    console.log(
      `[R18-C 族控制] family-wise=${rate.toFixed(4)} ≤ 界=${bound.toFixed(4)}（${GATES} 门 × M=${M}）`,
    );
    assert.ok(rate <= bound, `族拒绝率 ${rate} 超出 union bound ${bound}`);
  });

  it('bonferroniTypeOne 域校验：族水平 ∈ (0,1)、门数整数 ≥ 1', () => {
    for (const bad of [0, 1, -0.1, Number.NaN, 1.5]) {
      assert.throws(
        () => bonferroniTypeOne(bad, 5),
        (e: unknown) => e instanceof ConfigurationError,
        `familyLevel=${String(bad)} 应拒绝`,
      );
    }
    for (const bad of [0, -1, 2.5, Number.NaN]) {
      assert.throws(
        () => bonferroniTypeOne(0.05, bad),
        (e: unknown) => e instanceof ConfigurationError,
        `gates=${String(bad)} 应拒绝`,
      );
    }
  });
});

// ----------------------------------------------------------------------------
// 确定性
// ----------------------------------------------------------------------------

describe('R18-C · SPRT 门 · 确定性', () => {
  it('同观测序列 → λ 轨迹与终判逐位一致（toPrecision(15)）', () => {
    const run = (): string[] => {
      const gate = new SprtCalibrationGate();
      const out: string[] = [];
      for (const o of learningObservations(42, 120, 0.6, 0.12)) {
        if (gate.isTerminal()) break;
        const snap = gate.observe(o.base, o.k, o.success);
        out.push(
          `${snap.observations}:${snap.logLikelihoodRatio.toPrecision(15)}:${snap.decision}`,
        );
      }
      return out;
    };
    assert.deepEqual(run(), run(), '同流重跑逐位可复现');
  });
});

// ----------------------------------------------------------------------------
// 负对照（配置域走私 + 终判后消费 + 错误 null 定罪）
// ----------------------------------------------------------------------------

describe('R18-C · SPRT 门 · 负对照（走私审判）', () => {
  it('配置走私：typeOne/typeTwo/maxObservations/components 逐条指名拒绝', () => {
    for (const bad of [0, 1, -0.1, Number.NaN, 1.5]) {
      assert.throws(
        () => new SprtCalibrationGate({ typeOne: bad }),
        (e: unknown) => e instanceof ConfigurationError && e.message.includes('typeOne'),
        `typeOne=${String(bad)} 应拒绝`,
      );
      assert.throws(
        () => new SprtCalibrationGate({ typeTwo: bad }),
        (e: unknown) => e instanceof ConfigurationError && e.message.includes('typeTwo'),
        `typeTwo=${String(bad)} 应拒绝`,
      );
    }
    for (const bad of [0, -1, 2.5, Number.NaN]) {
      assert.throws(
        () => new SprtCalibrationGate({ maxObservations: bad }),
        (e: unknown) => e instanceof ConfigurationError && e.message.includes('maxObservations'),
        `maxObservations=${String(bad)} 应拒绝`,
      );
    }
    assert.throws(() => new SprtCalibrationGate({ components: [] }), /must be a non-empty array/);
    assert.throws(
      () => new SprtCalibrationGate({ components: [{ alpha: 0.99, beta: 0.1 }] }),
      (e: unknown) => e instanceof ConfigurationError && e.message.includes('(0, 0.98]'),
      'α 超上界应拒绝（p_mix < 1 的数值前提）',
    );
    assert.throws(
      () => new SprtCalibrationGate({ components: [{ alpha: 0.5, beta: 0 }] }),
      (e: unknown) => e instanceof ConfigurationError && e.message.includes('.beta'),
    );
    assert.throws(
      () =>
        new SprtCalibrationGate({
          components: [
            { alpha: 0.5, beta: 0.1, weight: 0.7 },
            { alpha: 0.6, beta: 0.2 },
          ],
        }),
      (e: unknown) =>
        e instanceof ConfigurationError && e.message.includes('either every component'),
      '部分分量带权重应拒绝（隐式权重两可）',
    );
    assert.throws(
      () =>
        new SprtCalibrationGate({
          components: [
            { alpha: 0.5, beta: 0.1, weight: 0.7 },
            { alpha: 0.6, beta: 0.2, weight: 0.5 },
          ],
        }),
      (e: unknown) => e instanceof ConfigurationError && e.message.includes('sum to 1'),
      '权重和 ≠ 1 应拒绝',
    );
  });

  it('observe 域走私：base 越界 / k 负 / 非布尔 success 指名拒绝；终判后再消费 StateError', () => {
    const gate = new SprtCalibrationGate();
    for (const badBase of [0, 1, -0.1, Number.NaN, 1.0000001]) {
      assert.throws(
        () => gate.observe(badBase, 5, true),
        (e: unknown) => e instanceof NumericDomainError && e.message.includes('base'),
        `base=${String(badBase)} 应拒绝`,
      );
    }
    assert.throws(
      () => gate.observe(0.5, -1, true),
      (e: unknown) => e instanceof NumericDomainError && e.message.includes('k'),
    );
    assert.throws(
      () => gate.observe(0.5, 5, 1 as unknown as boolean),
      (e: unknown) => e instanceof NumericDomainError && e.message.includes('success'),
    );
    // 终判后消费：用极强流立刻越上界
    const hot = new SprtCalibrationGate({ typeOne: 0.3, typeTwo: 0.3 });
    let snap = hot.getState();
    for (let i = 0; !hot.isTerminal(); i++) {
      snap = hot.observe(0.2, 50, true); // base=0.2、k=50：增量大且恒成功
    }
    assert.equal(snap.decision, 'rejectNull');
    assert.throws(
      () => hot.observe(0.5, 5, true),
      (e: unknown) => e instanceof StateError && e.message.includes('terminal'),
      '终判后再消费应指名拒绝（静默会腐蚀已停统计量）',
    );
  });

  it('错误 null 定罪：base 虚报 0.5、真值 0.62 → 拒绝率远超名义界（界以 null 正确为条件）', () => {
    const M = 300;
    let rejects = 0;
    for (let s = 0; s < M; s++) {
      const gate = new SprtCalibrationGate({ maxObservations: 400 });
      const rng = mulberry32(7000 + s);
      let snap = gate.getState();
      for (let i = 0; !gate.isTerminal(); i++) {
        snap = gate.observe(0.5, 5, rng() < 0.62); // 声明 base=0.5，真值 0.62
      }
      if (snap.decision === 'rejectNull') rejects++;
    }
    const rate = rejects / M;
    const bound = sprtTypeOneUpperBound(0.05, 0.02);
    console.log(
      `[R18-C 错误 null] 虚报 base=0.5（真值 0.62）拒绝率=${rate.toFixed(3)} ≫ 界=${bound.toFixed(4)}（M=${M}）`,
    );
    assert.ok(
      rate > 0.5,
      `错误 null 下拒绝率 ${rate} 应远超名义界——保证以 null 正确性为前提（诚实边界的机器演示）`,
    );
  });

  it('缺省配置常量钉板（漂移防护）', () => {
    assert.equal(DEFAULT_SPRT_GATE_CONFIG.typeOne, 0.05);
    assert.equal(DEFAULT_SPRT_GATE_CONFIG.typeTwo, 0.02);
    assert.equal(DEFAULT_SPRT_GATE_CONFIG.maxObservations, 600);
    assert.equal(DEFAULT_SPRT_COMPONENTS.length, 16);
    for (const c of DEFAULT_SPRT_COMPONENTS) assert.equal(c.weight, undefined);
  });
});
