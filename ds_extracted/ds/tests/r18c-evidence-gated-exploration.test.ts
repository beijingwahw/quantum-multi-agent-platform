/**
 * R18-C 创新 2：EvidenceGatedExploration（证据门控探索系数反馈环）的
 * 机器验收面——与 src/proactive-intelligence/evidence-gated-exploration.ts
 * 模块头的定理一一对应：
 *   定理 A（包络）→ e ≤ e₀/(2√(n+κ₀+1)) 的全网格钉板 + n=0 精确端点；
 *   定理 B（总预算）→ 望远镜求和数值证书 + 台账对账；
 *   定理 C（门控断流）→ decided ⟹ e ≡ 0 恒等式 + 与 SPRT 门联合仿真；
 *   定理 D（饱和）→ k̄ = ln(100)/β̂ 与 ln(10⁴)/β̂ 的乘法上界；
 *   附：逐因子独立复算、纯函数确定性、走私负对照（无门控实现被定罪）。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  EvidenceGatedExploration,
  ExplorationBudgetLedger,
  explorationBudgetBound,
  sigmaBound,
  DEFAULT_EVIDENCE_GATED_EXPLORATION_CONFIG,
  type ExplorationFeedbackInputs,
} from '../src/proactive-intelligence/evidence-gated-exploration.js';
import { SprtCalibrationGate } from '../src/proactive-intelligence/sprt-calibration-gate.js';
import { mulberry32 } from '../src/utils/rng.js';
import { ConfigurationError, NumericDomainError } from '../src/utils/errors.js';

const KERNEL = new EvidenceGatedExploration();

/** 中性未检出输入（除标注外） */
function inputs(partial: Partial<ExplorationFeedbackInputs>): ExplorationFeedbackInputs {
  return {
    attempts: 10,
    successes: 5,
    alphaHat: 0,
    betaHat: 0,
    meanCapital: 0,
    decided: false,
    ...partial,
  };
}

// ----------------------------------------------------------------------------
// 定理 A · 包络与因子分解
// ----------------------------------------------------------------------------

describe('R18-C · 反馈环 · 包络（定理 A）与因子复算', () => {
  it('e = e₀·σ·saturate·u 逐因子独立复算（Beta 矩阵公式，无共享代码路径）', () => {
    const rng = mulberry32(2026);
    for (let t = 0; t < 200; t++) {
      const n = Math.floor(rng() * 60);
      const s = Math.floor(rng() * (n + 1));
      const kappa = 3;
      const a = kappa / 2 + s;
      const b = kappa / 2 + (n - s);
      const m = n + kappa;
      const sigma = Math.sqrt((a * b) / (m * m * (m + 1)));
      const kernel = new EvidenceGatedExploration({ baseCoefficient: 0.5, priorWeight: kappa });
      const got = kernel.coefficient(inputs({ attempts: n, successes: s }));
      assert.ok(Math.abs(got.uncertaintySigma - sigma) < 1e-15, `σ 复算失配 n=${n} s=${s}`);
      assert.ok(
        Math.abs(got.coefficient - 0.5 * sigma) < 1e-15,
        'e = e₀·σ（未检出、未终判、饱和=1）',
      );
      assert.equal(got.saturationFactor, 1);
      assert.equal(got.undecidedFactor, 1);
    }
  });

  it('包络：500 组 (n,s) 全部 σ ≤ 1/(2√(n+κ₀+1))；s ≈ n/2 处最紧（> 0.98·界）', () => {
    const rng = mulberry32(77);
    const kappa = 3;
    let minRatio = Infinity;
    for (let t = 0; t < 500; t++) {
      const n = Math.floor(rng() * 200);
      const s = Math.floor(rng() * (n + 1));
      const got = KERNEL.coefficient(inputs({ attempts: n, successes: s }));
      const bound = sigmaBound(n, kappa);
      assert.ok(
        got.uncertaintySigma <= bound + 1e-15,
        `σ=${got.uncertaintySigma} 超包络 ${bound}（n=${n}, s=${s}）`,
      );
      assert.ok(
        got.coefficient <=
          DEFAULT_EVIDENCE_GATED_EXPLORATION_CONFIG.baseCoefficient * bound + 1e-15,
        '系数整体 ≤ e₀·包络（定理 A）',
      );
    }
    // 对称后验（s = n/2，n 偶数）时 ab 恰取最大值：包络接近紧
    for (const n of [0, 4, 20, 60, 120]) {
      const got = KERNEL.coefficient(inputs({ attempts: n, successes: n / 2 }));
      const bound = sigmaBound(n, kappa);
      const ratio = got.uncertaintySigma / bound;
      if (n > 0) minRatio = Math.min(minRatio, ratio);
      assert.ok(ratio <= 1 + 1e-12 && ratio > 0.97, `s=n/2 处包络应近紧：ratio=${ratio}`);
    }
    console.log(`[R18-C 包络] s≈n/2 处 σ/σBound 最小比值 = ${minRatio.toFixed(4)}（包络近紧）`);
  });

  it('n=0 精确端点：σ(0,0) = 1/(2√(κ₀+1))（a=b=m/2 的 Beta 精确值，逐 κ₀）', () => {
    for (const kappa of [1, 3, 7]) {
      const kernel = new EvidenceGatedExploration({ priorWeight: kappa });
      const got = kernel.coefficient(inputs({ attempts: 0, successes: 0 }));
      const expected = 1 / (2 * Math.sqrt(kappa + 1));
      assert.ok(
        Math.abs(got.uncertaintySigma - expected) < 1e-15,
        `κ₀=${kappa}: σ=${got.uncertaintySigma} vs ${expected}`,
      );
      assert.ok(Math.abs(sigmaBound(0, kappa) - expected) < 1e-15);
    }
  });

  it('σ 随证据极化收缩：s=0 或 s=n 时 σ < s=n/2 时（成功率的确定性更高）', () => {
    const mid = KERNEL.coefficient(inputs({ attempts: 20, successes: 10 })).uncertaintySigma;
    const allFail = KERNEL.coefficient(inputs({ attempts: 20, successes: 0 })).uncertaintySigma;
    const allPass = KERNEL.coefficient(inputs({ attempts: 20, successes: 20 })).uncertaintySigma;
    assert.ok(allFail < mid && allPass < mid, '极化后验的不确定度应更低');
  });
});

// ----------------------------------------------------------------------------
// 定理 B · 总预算证书
// ----------------------------------------------------------------------------

describe('R18-C · 反馈环 · 总预算（定理 B）', () => {
  it('望远镜证书：Σ_{n<N} 1/(2√(n+κ₀+1)) ≤ √(N+κ₀+1)（N=1..400 全扫 + 大 N 抽查）', () => {
    const kappa = 3;
    let sum = 0;
    for (let n = 0; n < 400; n++) {
      sum += 1 / (2 * Math.sqrt(n + kappa + 1));
      const bound = Math.sqrt(n + 1 + kappa + 1);
      assert.ok(
        sum <= bound + 1e-12,
        `N=${n + 1}：Σ=${sum.toPrecision(15)} 超界 ${bound.toPrecision(15)}`,
      );
    }
    for (const N of [1_000, 10_000, 100_000]) {
      let s = 0;
      for (let n = 0; n < N; n++) s += 1 / (2 * Math.sqrt(n + kappa + 1));
      const bound = Math.sqrt(N + kappa + 1);
      console.log(`[R18-C 望远镜] N=${N}：Σ=${s.toFixed(1)} ≤ √(N+κ₀+1)=${bound.toFixed(1)}`);
      assert.ok(s <= bound + 1e-9);
    }
  });

  it('台账对账：最坏情形流（每步 s=n/2 取包络上界）Σ e ≤ e₀·√(entries+κ₀+1)', () => {
    const ledger = new ExplorationBudgetLedger({ baseCoefficient: 0.5, priorWeight: 3 });
    for (let n = 0; n < 300; n++) {
      const c = KERNEL.coefficient(inputs({ attempts: n, successes: Math.floor(n / 2) }));
      ledger.record(c.coefficient);
    }
    console.log(
      `[R18-C 台账] Σ e=${ledger.totalSubsidy().toFixed(4)} ≤ 界=${ledger.bound().toFixed(4)}（300 步最坏情形）`,
    );
    assert.ok(ledger.totalSubsidy() <= ledger.bound());
    assert.equal(ledger.entryCount(), 300);
    assert.ok(
      Math.abs(ledger.bound() - explorationBudgetBound(300, { baseCoefficient: 0.5 })) < 1e-12,
      '台账界 = 纯函数界（同一证书）',
    );
  });

  it('explorationBudgetBound 域校验：count 非负整数', () => {
    for (const bad of [-1, 1.5, Number.NaN]) {
      assert.throws(
        () => explorationBudgetBound(bad),
        (e: unknown) => e instanceof ConfigurationError,
        `count=${String(bad)} 应拒绝`,
      );
    }
    assert.equal(explorationBudgetBound(0), 0.5 * Math.sqrt(4));
  });
});

// ----------------------------------------------------------------------------
// 定理 C/D · 门控断流与饱和
// ----------------------------------------------------------------------------

describe('R18-C · 反馈环 · 门控断流（定理 C）与饱和（定理 D）', () => {
  it('decided=true ⟹ coefficient ≡ 0（任意其余输入，恒等式面）', () => {
    const rng = mulberry32(5);
    for (let t = 0; t < 200; t++) {
      const n = Math.floor(rng() * 50);
      const s = Math.floor(rng() * (n + 1));
      const got = KERNEL.coefficient(
        inputs({
          attempts: n,
          successes: s,
          alphaHat: rng(),
          betaHat: rng(),
          meanCapital: rng() * 30,
          decided: true,
        }),
      );
      assert.equal(got.coefficient, 0, '终判后系数恒 0（定理 C）');
      assert.equal(got.undecidedFactor, 0);
      assert.ok(got.uncertaintySigma > 0, 'σ 照常计算（审计面不因门控失明）');
    }
  });

  it('饱和乘法界（定理 D）：k̄=ln(100)/β̂ ⟹ ≤0.01；ln(10⁴)/β̂ ⟹ ≤1e−4；未检出恒 1', () => {
    const betaHat = 0.12;
    const f1 = KERNEL.coefficient(
      inputs({ alphaHat: 0.6, betaHat, meanCapital: Math.log(100) / betaHat }),
    ).saturationFactor;
    const f2 = KERNEL.coefficient(
      inputs({ alphaHat: 0.6, betaHat, meanCapital: Math.log(1e4) / betaHat }),
    ).saturationFactor;
    console.log(
      `[R18-C 饱和] k̄=ln100/β̂ → ${f1.toExponential(2)}；k̄=ln10⁴/β̂ → ${f2.toExponential(2)}`,
    );
    assert.ok(f1 <= 0.01 + 1e-15);
    assert.ok(f2 <= 1e-4 + 1e-18);
    // 未检出（α̂=0 或 β̂=0）：无饱和证据不罚
    assert.equal(
      KERNEL.coefficient(inputs({ alphaHat: 0, betaHat: 0.12, meanCapital: 50 })).saturationFactor,
      1,
    );
    assert.equal(
      KERNEL.coefficient(inputs({ alphaHat: 0.6, betaHat: 0, meanCapital: 50 })).saturationFactor,
      1,
    );
  });

  it('联合仿真（学习流 + SPRT 门）：判前系数 > 0、判后恒 0；预算 ≤ e₀√(N*+κ₀+1)', () => {
    const HORIZON = 600;
    const ALPHA_TRUE = 0.6;
    const BETA_TRUE = 0.12;
    const BASE = 0.5;
    const rng = mulberry32(314);
    const gate = new SprtCalibrationGate(); // 缺省 16 分量门
    const ledger = new ExplorationBudgetLedger({ baseCoefficient: 0.5, priorWeight: 3 });
    let n = 0;
    let s = 0;
    for (let i = 0; i < HORIZON; i++) {
      if (gate.isTerminal()) break;
      const k = Math.min(i, 12);
      const success = rng() < BASE + ALPHA_TRUE * (1 - BASE) * (1 - Math.exp(-BETA_TRUE * k));
      // 宿主接线形态：先问系数（决策时点状态），再消费观测
      const coef = KERNEL.coefficient(
        inputs({ attempts: n, successes: s, meanCapital: k, decided: gate.isTerminal() }),
      );
      ledger.record(coef.coefficient);
      gate.observe(BASE, k, success);
      n++;
      if (success) s++;
    }
    const starN = gate.getState().observations; // 判定恰发生在最后一个观测之后
    // 判后断流恒等式（再喂 20 个评估）
    for (let j = 0; j < 20; j++) {
      const coef = KERNEL.coefficient(inputs({ attempts: n, successes: s, decided: true }));
      assert.equal(coef.coefficient, 0);
    }
    // 预算封顶：Σ e ≤ e₀·√(N*+κ₀+1)（定理 B+C 合并）
    const boundAtDecision = explorationBudgetBound(starN, { baseCoefficient: 0.5 });
    console.log(
      `[R18-C 联合仿真] 门判=${gate.getState().decision} @N*=${starN}；` +
        `Σ e=${ledger.totalSubsidy().toFixed(3)} ≤ 判定时刻界=${boundAtDecision.toFixed(3)}` +
        ` ≤ 全视界界=${explorationBudgetBound(HORIZON, { baseCoefficient: 0.5 }).toFixed(3)}`,
    );
    assert.ok(ledger.totalSubsidy() <= boundAtDecision, '总补贴被判定时刻封顶（定理 B+C）');
    // 判前系数恒正（未终判期间探索在付钱）
    assert.ok(ledger.totalSubsidy() > 0);
    // 与同 σ 无门控变体（走私形态）的对照：差值 = 判后尾段（负对照数据源）
    let ungated = 0;
    let s2 = 0;
    let n2 = 0;
    const rng2 = mulberry32(314);
    for (let i = 0; i < HORIZON; i++) {
      const k = Math.min(i, 12);
      const coef = KERNEL.coefficient(inputs({ attempts: n2, successes: s2, meanCapital: k }));
      ungated += coef.coefficient;
      const success = rng2() < BASE + ALPHA_TRUE * (1 - BASE) * (1 - Math.exp(-BETA_TRUE * k));
      n2++;
      if (success) s2++;
    }
    const saving = ((1 - ledger.totalSubsidy() / ungated) * 100).toFixed(1);
    console.log(
      `[R18-C 联合仿真] 门控 Σ=${ledger.totalSubsidy().toFixed(3)} vs 无门控 Σ=${ungated.toFixed(3)}` +
        `（同一 σ 日程付满 ${HORIZON} 步；节省 ${saving}%）`,
    );
    assert.ok(ungated > ledger.totalSubsidy(), '同 σ 无门控变体应付满全程（差值=判后尾段）');
  });
});

// ----------------------------------------------------------------------------
// 确定性与纯函数
// ----------------------------------------------------------------------------

describe('R18-C · 反馈环 · 确定性与输入域', () => {
  it('纯函数：同输入逐位同输出（toPrecision(15) 全分解）', () => {
    const inp = inputs({
      attempts: 33,
      successes: 17,
      alphaHat: 0.4,
      betaHat: 0.1,
      meanCapital: 6,
    });
    const a = KERNEL.coefficient(inp);
    const b = KERNEL.coefficient(inp);
    assert.equal(a.coefficient.toPrecision(15), b.coefficient.toPrecision(15));
    assert.equal(a.uncertaintySigma.toPrecision(15), b.uncertaintySigma.toPrecision(15));
    assert.equal(a.saturationFactor.toPrecision(15), b.saturationFactor.toPrecision(15));
  });

  it('输入域走私：successes>attempts / 负 k̄ / 非布尔 decided / 非整数 attempts 指名拒绝', () => {
    assert.throws(
      () => KERNEL.coefficient(inputs({ attempts: 5, successes: 6 })),
      (e: unknown) => e instanceof NumericDomainError && e.message.includes('successes'),
    );
    assert.throws(
      () => KERNEL.coefficient(inputs({ meanCapital: -1 })),
      (e: unknown) => e instanceof NumericDomainError && e.message.includes('meanCapital'),
    );
    assert.throws(
      () => KERNEL.coefficient(inputs({ decided: 1 as unknown as boolean })),
      (e: unknown) => e instanceof NumericDomainError && e.message.includes('decided'),
    );
    assert.throws(
      () => KERNEL.coefficient(inputs({ attempts: 2.5 })),
      (e: unknown) => e instanceof NumericDomainError && e.message.includes('attempts'),
    );
    assert.throws(
      () => KERNEL.coefficient(inputs({ alphaHat: -0.1 })),
      (e: unknown) => e instanceof NumericDomainError && e.message.includes('alphaHat'),
    );
    assert.throws(
      () => KERNEL.coefficient(null as unknown as ExplorationFeedbackInputs),
      (e: unknown) => e instanceof NumericDomainError,
    );
  });

  it('配置域走私：e₀ ≤ 0 / κ₀ < 1 指名拒绝（κ₀ ≥ 1 是证书入口条件）', () => {
    for (const bad of [0, -0.5, Number.NaN]) {
      assert.throws(
        () => new EvidenceGatedExploration({ baseCoefficient: bad }),
        (e: unknown) => e instanceof ConfigurationError && e.message.includes('baseCoefficient'),
      );
    }
    for (const bad of [0.5, 0, Number.NaN]) {
      assert.throws(
        () => new EvidenceGatedExploration({ priorWeight: bad }),
        (e: unknown) => e instanceof ConfigurationError && e.message.includes('priorWeight'),
      );
    }
    assert.throws(
      () => new ExplorationBudgetLedger({ baseCoefficient: -1 }),
      (e: unknown) => e instanceof ConfigurationError,
    );
    assert.throws(
      () => new ExplorationBudgetLedger({ priorWeight: 0 }),
      (e: unknown) => e instanceof ConfigurationError,
    );
    assert.throws(
      () => new ExplorationBudgetLedger().record(-0.001),
      (e: unknown) => e instanceof NumericDomainError,
    );
  });

  it('缺省常量钉板', () => {
    assert.equal(DEFAULT_EVIDENCE_GATED_EXPLORATION_CONFIG.baseCoefficient, 0.5);
    assert.equal(DEFAULT_EVIDENCE_GATED_EXPLORATION_CONFIG.priorWeight, 3);
  });
});
