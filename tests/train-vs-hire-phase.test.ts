import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  counterfactual,
  market,
  theoreticalDiffRate,
  cumulativeAdvantage,
  PHASE_DEFAULTS,
  type PhaseParams,
} from '../experiments/train-vs-hire-phase/run.js';
import {
  cumulativeAdvantageClosed,
  alphaStar,
  betaMin,
  kMin,
  deltaMax,
  piGroups,
  alphaStarUniversal,
  trainingBetaInterval,
  loadLLMBuckets,
  fitLearningCurve,
  type LawParams,
} from '../experiments/train-vs-hire-phase/scaling-law.js';

/**
 * 相变实验的回归测试：闭式理论 ↔ 模拟的对应关系 + 相图结构预测。
 * 参数与 run.ts 相同：q0=0.45 δ=0.12 K=60 T=150。
 */
const SEEDS = Array.from({ length: 12 }, (_, i) => 100 + i);

function cell(alpha: number, beta: number, explore?: number): PhaseParams {
  return { ...PHASE_DEFAULTS, alpha, beta, seeds: SEEDS, explore };
}

describe('TrainVsHire 相变 · 闭式理论 vs 模拟', () => {
  /** 理论显著格子（|diff|>2pp）上符号必须一致，且幅度误差 ≤ 4pp（Monte Carlo 容差） */
  it('显著格子上符号一致、幅度吻合（18 格扫描）', () => {
    let solid = 0;
    for (const alpha of [0.5, 0.7, 0.9]) {
      for (const beta of [0.003, 0.02, 0.05, 0.12, 0.27, 0.4]) {
        const p = cell(alpha, beta);
        const th = theoreticalDiffRate(p);
        if (Math.abs(th) <= 0.02) continue;
        solid++;
        const emp = counterfactual(p).diffRate;
        assert.ok(
          Math.sign(th) === Math.sign(emp),
          `α=${alpha} β=${beta}: 理论 ${th.toFixed(3)} vs 经验 ${emp.toFixed(3)} 符号不一致`,
        );
        assert.ok(
          Math.abs(th - emp) <= 0.04,
          `α=${alpha} β=${beta}: |理论−经验|=${Math.abs(th - emp).toFixed(3)} 超容差`,
        );
      }
    }
    assert.ok(solid >= 8, `显著格子仅 ${solid} 个，扫描失效`);
  });
});

describe('TrainVsHire 相变 · 口袋结构（β 非单调）', () => {
  /**
   * P2/P3：α=0.9 时培训获胜区是 β 的中间口袋——
   * 低 β（0.003）先发资本兑现不了 → 雇佣显著赢；
   * 中 β（0.03）先发资本兑现且新人未追平 → 培训显著赢；
   * 高 β（0.4）新人快速追平 → 优势回落。
   */
  it('α=0.9：低β雇佣赢、中β培训赢、高β优势回落（非单调）', () => {
    const low = counterfactual(cell(0.9, 0.003)).diffRate;
    const mid = counterfactual(cell(0.9, 0.03)).diffRate;
    const high = counterfactual(cell(0.9, 0.4)).diffRate;
    assert.ok(low < -0.02, `低β diff=${low.toFixed(3)} 应显著为负`);
    assert.ok(mid > 0.02, `中β diff=${mid.toFixed(3)} 应显著为正`);
    assert.ok(mid > high, `中β(${mid.toFixed(3)}) 应高于高β(${high.toFixed(3)})`);
    assert.ok(mid > low, '口袋峰值应高于低β端');
  });

  /** P4：固定 β=0.03，优势随 α 单调上升；低 α（0.5）雇佣赢 */
  it('β=0.03：优势随 α 单调上升，α=0.5 雇佣赢', () => {
    const d5 = counterfactual(cell(0.5, 0.03)).diffRate;
    const d7 = counterfactual(cell(0.7, 0.03)).diffRate;
    const d9 = counterfactual(cell(0.9, 0.03)).diffRate;
    assert.ok(
      d9 > d7 && d7 > d5,
      `α 单调性破坏: ${d5.toFixed(3)} ${d7.toFixed(3)} ${d9.toFixed(3)}`,
    );
    assert.ok(d5 < 0, `α=0.5 diff=${d5.toFixed(3)} 应为负（天花板不足）`);
  });

  /** P1：渐近惩罚 δ(1−α) —— 同参数学习下基础差距只缩窄不反转（闭式直查） */
  it('P1 渐近惩罚：任意 α<1 下高β极限均为雇佣赢', () => {
    // β=0.4、T=150 已接近饱和：α<0.8 全部为负
    for (const alpha of [0.3, 0.5, 0.7]) {
      assert.ok(theoreticalDiffRate(cell(alpha, 0.4)) < -0.02, `α=${alpha} 高β极限应为雇佣显著赢`);
    }
  });
});

describe('TrainVsHire 相变 · 市场臂锁定与探索修复', () => {
  /**
   * 机制层失败模式：(α=0.5, β=0.27) 雇佣臂累计显著更优（理论 ≈ −5.5pp），
   * 但 explore=0 的市场把 vet 的履历估值锁死在 hire 的资历先验之上 →
   * 永不试用 hire（次优锁定）。UCB 探索项解锁试用并回收部分福利。
   */
  it('次优锁定：explore=0 永不试用 hire；探索项解锁并提升福利', () => {
    const p = cell(0.5, 0.27);
    assert.ok(theoreticalDiffRate(p) < -0.02, '该格子雇佣应显著更优（前置）');

    const locked = market(p);
    assert.ok(locked.vetShare >= 0.95, `锁定份额 ${locked.vetShare.toFixed(2)} 应≥0.95`);
    assert.ok(
      locked.hireTrials <= 1,
      `explore=0 时 hire 试用 ${locked.hireTrials.toFixed(1)} 应≈0`,
    );

    const explored = market(cell(0.5, 0.27, 1.5));
    assert.ok(explored.hireTrials >= 10, `探索后试用 ${explored.hireTrials.toFixed(1)} 应≥10`);
    assert.ok(
      explored.welfarePerTask > locked.welfarePerTask + 0.05,
      `探索福利 ${explored.welfarePerTask.toFixed(2)} 应高于锁定 ${locked.welfarePerTask.toFixed(2)}`,
    );
  });
});

describe('相变闭式定律 · L1–L4 与恒等式', () => {
  const org = {
    q0: PHASE_DEFAULTS.q0,
    delta: PHASE_DEFAULTS.delta,
    K: PHASE_DEFAULTS.K,
    T: PHASE_DEFAULTS.T,
  };

  /** 闭式几何和与 run.ts 逐项求和精确一致；Σadv(α*)=0 恒等式 */
  it('闭式 = 逐项求和；α* 是精确零点', () => {
    for (const [alpha, beta] of [
      [0.5, 0.01],
      [0.7, 0.03],
      [0.9, 0.05],
      [0.6, 0.12],
      [0.85, 0.005],
    ] as Array<[number, number]>) {
      const law: LawParams = { ...org, alpha, beta };
      const closed = cumulativeAdvantageClosed(law);
      const loop = cumulativeAdvantage({ ...PHASE_DEFAULTS, ...law, seeds: [] } as PhaseParams);
      assert.ok(
        Math.abs(closed - loop) < 1e-9,
        `α=${alpha} β=${beta}: |闭式−逐项|=${Math.abs(closed - loop)}`,
      );
      const aStar = alphaStar(law);
      if (isFinite(aStar)) {
        const atBoundary = cumulativeAdvantageClosed({ ...law, alpha: aStar });
        assert.ok(Math.abs(atBoundary) < 1e-9, `α*=${aStar} 处 Σadv=${atBoundary} 应为 0`);
        // 符号翻转：α*±0.05 两侧异号
        const above = cumulativeAdvantageClosed({ ...law, alpha: aStar + 0.05 });
        const below = cumulativeAdvantageClosed({ ...law, alpha: aStar - 0.05 });
        if (aStar + 0.05 <= 1 && aStar - 0.05 > 0) {
          assert.ok(
            above > 0 && below < 0,
            `α* 两侧应翻转: ${below.toFixed(3)} → ${above.toFixed(3)}`,
          );
        }
      }
    }
  });

  /** L2：β_min 之下 A<0 → α*=∞（雇佣恒胜）；Π1≥1 时 β_min=∞ */
  it('L2 资本化阈值：β<β_min 时培训不可能赢', () => {
    for (const beta of [0.001, 0.003, 0.004]) {
      const law = { ...org, alpha: 0.99, beta };
      assert.ok(
        beta < betaMin(law) && !isFinite(alphaStar(law)),
        `β=${beta} < β_min=${betaMin(law).toFixed(4)} 时 α* 应为 ∞`,
      );
    }
    // Π1 ≥ 1（δ ≥ 1−q0）：雇佣溢价烧穿全部剩余学习空间
    assert.ok(!isFinite(betaMin({ ...org, delta: 0.55, alpha: 0.9, beta: 0.01 })));
    assert.equal(betaMin({ ...org, alpha: 0.9, beta: 0.01 }).toFixed(4), '0.0041');
  });

  /** L3：K_min 处 Σadv=0；K>K_min 培训赢、K<K_min 雇佣赢 */
  it('L3 最小孵化资本：解析 K_min 是精确符号翻转点', () => {
    const base = { ...org, alpha: 0.9, beta: 0.02 };
    const pred = kMin(base)!;
    assert.ok(Math.abs(pred - 17.4) < 0.2, `K_min=${pred.toFixed(1)} 应≈17.4`);
    assert.ok(cumulativeAdvantageClosed({ ...base, K: Math.round(pred) + 1 }) > 0);
    assert.ok(cumulativeAdvantageClosed({ ...base, K: Math.round(pred) - 1 }) < 0);
    // 不可行情形：α 太低、T 太长 → 任何 K 都不够
    assert.equal(kMin({ ...org, alpha: 0.2, beta: 0.01 }), null);
  });

  /** L4：δ_max 随 α 单调上升；δ=δ_max 时 Σadv=0（边界一致性） */
  it('L4 δ_max：单调性 + 边界一致性', () => {
    const base = { ...org, alpha: 0.7, beta: 0.03 };
    const d5 = deltaMax({ ...base, alpha: 0.5 });
    const d9 = deltaMax({ ...base, alpha: 0.9 });
    assert.ok(d9 > d5, `δ_max(0.9)=${d9.toFixed(3)} 应 > δ_max(0.5)=${d5.toFixed(3)}`);
    // 边界一致性：δ=δ_max 处累计优势恰为 0
    for (const alpha of [0.5, 0.7, 0.9]) {
      const law = { ...base, alpha };
      const dm = deltaMax(law);
      assert.ok(
        Math.abs(cumulativeAdvantageClosed({ ...law, delta: dm })) < 1e-9,
        `α=${alpha}: δ=δ_max=${dm.toFixed(3)} 处 Σadv 应为 0`,
      );
    }
  });

  /** 普适标度：连续极限下精确边界收敛到 Π 群公式 */
  it('普适边界：β→0 时 α*(β) → α*_univ(Π1,Π2,Π3)', () => {
    const pi1 = 0.2182;
    const pi2 = 0.6;
    const pi3 = 1.5;
    const uni = alphaStarUniversal(pi1, pi2, pi3);
    const exact = alphaStar({
      q0: 0.45,
      delta: 0.55 * pi1, // δ = (1−q0)·Π1
      K: pi2 / 0.001,
      T: pi3 / 0.001,
      alpha: 0.5,
      beta: 0.001,
    });
    assert.ok(Math.abs(uni - exact) < 0.01, `普适 ${uni.toFixed(4)} vs 精确 ${exact.toFixed(4)}`);
  });

  /** 解析获胜区间：区间内理论为正、区间外为负（口袋封闭性） */
  it('trainingBetaInterval：口袋内为正、口袋外为负', () => {
    for (const alpha of [0.7, 0.9]) {
      const interval = trainingBetaInterval(org, alpha)!;
      assert.ok(interval[0] > betaMin({ ...org, alpha, beta: 0.03 }) * 0.99, '下端 ≥ β_min');
      for (const beta of [
        interval[0] * 1.05,
        (interval[0] + interval[1]) / 2,
        interval[1] * 0.95,
      ]) {
        assert.ok(cumulativeAdvantageClosed({ ...org, alpha, beta }) > 0, `β=${beta} 应培训赢`);
      }
      for (const beta of [interval[0] * 0.9, interval[1] * 1.1]) {
        assert.ok(cumulativeAdvantageClosed({ ...org, alpha, beta }) < 0, `β=${beta} 应雇佣赢`);
      }
    }
    // α 太低无口袋
    assert.equal(trainingBetaInterval(org, 0.3), null);
  });
});

describe('相变闭式定律 · 坍缩与 K_min 的经验验证', () => {
  const seeds24 = Array.from({ length: 24 }, (_, i) => 200 + i);
  const CONFIGS = [
    { name: 'A', q0: 0.45, delta: 0.12, K: 60, T: 150 },
    { name: 'B', q0: 0.3, delta: 0.12 * (0.7 / 0.55), K: 120, T: 300 },
    { name: 'C', q0: 0.6, delta: 0.12 * (0.4 / 0.55), K: 30, T: 75 },
  ];

  function empDiff(
    org: { q0: number; delta: number; K: number; T: number },
    alpha: number,
    beta: number,
  ): number {
    return counterfactual({
      ...PHASE_DEFAULTS,
      ...org,
      alpha,
      beta,
      seeds: seeds24,
    }).diffRate;
  }

  /**
   * 普适坍缩：同 (Π1, Π2, Π3, α)、不同原始参数 → 归一化经验优势一致。
   * α=0.9 格子理论归一化 +0.102（强信号），三个配置极差应 ≤ 0.03。
   */
  it('坍缩：同 Π 群 → 同相位同幅度（α=0.9 强信号格子）', () => {
    const alpha = 0.9;
    const pi2 = 1.8;
    const vals = CONFIGS.map((c) => {
      const pi = piGroups({ ...c, alpha, beta: pi2 / c.K });
      assert.ok(
        Math.abs(pi.pi1 - 0.2182) < 1e-3 &&
          Math.abs(pi.pi2 - 1.8) < 1e-9 &&
          Math.abs(pi.pi3 - 4.5) < 1e-9,
      );
      return empDiff(c, alpha, pi2 / c.K) / (1 - c.q0);
    });
    for (const v of vals) assert.ok(v > 0.05, `归一化经验 ${v.toFixed(3)} 应显著为正`);
    const spread = Math.max(...vals) - Math.min(...vals);
    assert.ok(spread <= 0.03, `极差 ${spread.toFixed(3)} 应 ≤ 0.03`);
  });

  /** 坍缩的反面：同原始 α/β、不同 Π2（K 缩小）→ 相位改变（非平凡坍缩） */
  it('反例：Π2 改变 → 相位翻转', () => {
    const org = { q0: 0.45, delta: 0.12, K: 60, T: 150 };
    const big = empDiff(org, 0.9, 0.03);
    const small = empDiff({ ...org, K: 6 }, 0.9, 0.03);
    assert.ok(big > 0.03, `K=60 diff=${big.toFixed(3)} 应显著为正`);
    assert.ok(small < -0.008, `K=6 diff=${small.toFixed(3)} 应为负`);
  });

  /** K_min 定律：经验符号翻转发生在解析预测（17.4）附近 */
  it('K_min：经验翻转点在解析预测 ±8 内', () => {
    const org = { q0: 0.45, delta: 0.12, K: 60, T: 150 };
    const pred = kMin({ ...org, alpha: 0.9, beta: 0.02 })!;
    // 两端强信号
    assert.ok(empDiff({ ...org, K: 4 }, 0.9, 0.02) < -0.012, 'K=4 应显著雇佣赢');
    assert.ok(empDiff({ ...org, K: 44 }, 0.9, 0.02) > 0.02, 'K=44 应显著培训赢');
    // 翻转点
    let flip: number | null = null;
    for (const K of [10, 14, 17, 20, 26]) {
      if (empDiff({ ...org, K }, 0.9, 0.02) > 0) {
        flip = K;
        break;
      }
    }
    assert.ok(flip !== null, '应在 K≤26 内翻转为培训赢');
    assert.ok(
      Math.abs(flip! - pred) <= 8,
      `经验翻转 K=${flip} vs 解析 K_min=${pred.toFixed(1)} 偏差 > 8`,
    );
  });
});

describe('相变闭式定律 · 真实 LLM 标定', () => {
  /** glm-4-flash 隐性学习实测 bucket 拟合 sanity + δ_max 落在合理区间 */
  it('LLM bucket 拟合与 δ_max 定律可计算且量级合理', () => {
    const buckets = loadLLMBuckets();
    assert.equal(buckets.length, 6);
    assert.equal(
      buckets.reduce((a, b) => a + b.n, 0),
      528,
    );
    const fit = fitLearningCurve(buckets);
    assert.ok(fit.alpha > 0.19 && fit.alpha <= 1.001, `α̂=${fit.alpha} 越界`);
    assert.ok(fit.beta > 0.005 && fit.beta < 2, `β̂=${fit.beta} 越界`);
    assert.ok(fit.r2 > 0.3, `R²=${fit.r2.toFixed(3)} 过低`);
    const dm = deltaMax({
      q0: fit.base,
      delta: 0,
      K: 20,
      T: 150,
      alpha: fit.alpha,
      beta: fit.beta,
    });
    assert.ok(dm > 0.05 && dm < 0.45, `δ_max=${dm.toFixed(3)} 量级异常`);
  });
});

describe('BatchVCGScheduler · 市场臂锁定与探索修复（原组续）', () => {
  /** 对齐的锁定：培训本就最优的格子（α=0.9, β=0.05），锁定在 vet 是正确的 */
  it('对齐锁定：培训最优格子上市场锁定 vet（explore=0 即最优）', () => {
    const p = cell(0.9, 0.05);
    assert.ok(theoreticalDiffRate(p) > 0.02, '该格子培训应显著更优（前置）');
    const mk = market(p);
    assert.ok(mk.vetShare >= 0.9, `vet 份额 ${mk.vetShare.toFixed(2)} 应≥0.9`);
  });
});
