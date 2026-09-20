/**
 * R18 创新 · noise-aware-backend-selector 钉板（代理 B · QPU+总线域）
 *
 * 覆盖五张面：
 * - 定理 1 保持率闭式：端点锚（f=0 / f=1/2 的两条独立推导同值）、n=2
 *   手算、seeded 蒙特卡洛对拍（真 one-hot 向量逐比特翻转）；
 * - 定理 1' 单调性：[0, 0.5] 离散格点机器验证；
 * - 定理 3 精确优势概率：有限和 vs 独立数值积分（复用平台 betaCdf 连
 *   分式——第二条实现路径）vs seeded 蒙特卡洛（betaQuantile 逆 CDF）三
 *   腿对拍 + 对称恒等式 P(A>B)+P(B>A)=1；
 * - 选择器行为面：三态规则确定性、共轭更新、后验快照、regret 实证
 *   （非定理，如实标注）与均匀随机基线负对照；
 * - 负对照（走私审判风格）：域外参数 / 非整数形状 / 未知臂 / 非布尔
 *   证据 / thompson 缺 rng——全部点名拒绝。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  oneHotRetentionRate,
  betaAdvantageProbability,
  noiseAwarePrior,
  NoiseAwareBackendSelector,
} from '../src/core/qpu/noise-aware-backend-selector.js';
import { betaCdf, betaQuantile, logBeta } from '../src/proactive-intelligence/beta-distribution.js';
import { BackendError, QuantumEstimateError } from '../src/utils/errors.js';

const EPS = 1e-12;

/** mulberry32（与 experiments/qpu-cross-validation/kernel.ts 同惯用法） */
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('R18B · 定理 1：one-hot 保持率闭式', () => {
  it('端点锚：f=0 → 1；f=1/2 → (n/2^n)^m（与均匀读出的直接计数推导同值）', () => {
    assert.equal(oneHotRetentionRate(4, 5, 0), 1);
    // 完全随机读出：每块恰一位 −1 的概率 = C(n,1)/2^n = n/2^n；块独立 → ^m
    for (const [m, n] of [
      [3, 4],
      [5, 2],
      [2, 6],
    ] as const) {
      assert.ok(
        Math.abs(oneHotRetentionRate(m, n, 0.5) - Math.pow(n / 2 ** n, m)) < EPS,
        `m=${m} n=${n}`,
      );
    }
  });

  it('n=2 手算锚：q = [ (1−f)² + f² ]^m（块内两位，全不翻或全翻）', () => {
    for (const f of [0, 0.1, 0.25, 0.5]) {
      const block = (1 - f) ** 2 + f * f;
      assert.ok(Math.abs(oneHotRetentionRate(3, 2, f) - block ** 3) < EPS, `f=${f}`);
    }
  });

  it('seeded 蒙特卡洛对拍（m=3, n=4, f=0.07）：真 one-hot 向量逐比特翻转', () => {
    const m = 3;
    const n = 4;
    const f = 0.07;
    const rng = makeRng(20260920);
    const TRIALS = 60_000;
    let retained = 0;
    for (let t = 0; t < TRIALS; t++) {
      let ok = true;
      for (let b = 0; b < m && ok; b++) {
        let neg = 0;
        for (let i = 0; i < n; i++) {
          const flipped = rng() < f;
          // 真向量：位 0 为 −1（选中），其余 +1；翻转取反
          const spin = (i === 0 ? -1 : 1) * (flipped ? -1 : 1);
          if (spin === -1) neg++;
        }
        if (neg !== 1) ok = false;
      }
      if (ok) retained++;
    }
    const closed = oneHotRetentionRate(m, n, f);
    const p = retained / TRIALS;
    const sigma = Math.sqrt((closed * (1 - closed)) / TRIALS);
    assert.ok(
      Math.abs(p - closed) < 4 * sigma,
      `MC=${p.toExponential(4)} vs 闭式=${closed.toExponential(4)}（4σ=${(4 * sigma).toExponential(3)}）`,
    );
  });

  it("定理 1' 单调性：f ∈ [0, 0.5] 离散格点 q 单调不增（n=2..8）", () => {
    for (let n = 2; n <= 8; n++) {
      let prev = oneHotRetentionRate(4, n, 0);
      for (let step = 1; step <= 50; step++) {
        const f = step / 100;
        const q = oneHotRetentionRate(4, n, f);
        assert.ok(q <= prev + 1e-15, `n=${n} f=${f}：q 递增（单调性破缺）`);
        prev = q;
      }
    }
  });

  it('负对照：域外参数点名拒绝', () => {
    for (const bad of [0.51, 1, -0.1, Number.NaN]) {
      assert.throws(
        () => oneHotRetentionRate(3, 4, bad),
        (e: unknown) =>
          e instanceof QuantumEstimateError && e.message.includes('must be in [0, 0.5]'),
        `f=${bad}`,
      );
    }
    assert.throws(() => oneHotRetentionRate(0, 4, 0.1), /task count/);
    assert.throws(() => oneHotRetentionRate(3, 1, 0.1), /agent count/);
  });
});

describe('R18B · 定理 3：精确优势概率有限和（三腿对拍）', () => {
  /** 独立路径 1：数值积分 ∫ f_X(x)·I_x(a2,b2) dx（Simpson，用平台 betaCdf）。
   * 端点显式取极限：x→1⁻ 的被积值 = P(Y<1)·pdf(1⁻) = 1·(b1=1 ? a1 : 0)，
   * x→0⁺ 恒 0（I_0=0）——首红教训：抹零端点会让 Simpson 丢掉正确权重。 */
  function integrateAdvantage(a1: number, b1: number, a2: number, b2: number): number {
    const nInt = 20_000;
    const h = 1 / nInt;
    const pdf = (x: number): number =>
      Math.exp((a1 - 1) * Math.log(x) + (b1 - 1) * Math.log1p(-x) - logBeta(a1, b1));
    let sum = 0;
    for (let i = 0; i <= nInt; i++) {
      const x = i * h;
      const w = i === 0 || i === nInt ? 1 : i % 2 === 1 ? 4 : 2;
      let integrand: number;
      if (i === 0)
        integrand = 0; // I_0 = 0
      else if (i === nInt)
        integrand = b1 === 1 ? a1 : 0; // 极限（见上）
      else integrand = pdf(x) * betaCdf(x, a2, b2);
      sum += w * integrand;
    }
    return (h / 3) * sum;
  }

  it('有限和 vs Simpson 积分（betaCdf 独立实现）：相对差 < 1e-9', () => {
    for (const [a1, b1, a2, b2] of [
      [3, 2, 4, 2],
      [1, 1, 1, 1],
      [9, 12, 3, 3],
      [2, 8, 5, 1],
      [30, 25, 40, 38],
    ] as const) {
      const exact = betaAdvantageProbability(a1, b1, a2, b2);
      const num = integrateAdvantage(a1, b1, a2, b2);
      assert.ok(
        Math.abs(exact - num) < 1e-9,
        `(${a1},${b1}) vs (${a2},${b2})：有限和=${exact.toExponential(10)} 积分=${num.toExponential(10)}`,
      );
    }
  });

  it('有限和 vs seeded 蒙特卡洛（betaQuantile 逆 CDF 抽样）：4σ 内', () => {
    const a1 = 7;
    const b1 = 4;
    const a2 = 3;
    const b2 = 9;
    const exact = betaAdvantageProbability(a1, b1, a2, b2);
    const rng = makeRng(4242);
    const nMc = 50_000;
    let wins = 0;
    for (let i = 0; i < nMc; i++) {
      const x = betaQuantile(rng(), a1, b1);
      const y = betaQuantile(rng(), a2, b2);
      if (x > y) wins++;
    }
    const p = wins / nMc;
    const sigma = Math.sqrt((exact * (1 - exact)) / nMc);
    assert.ok(Math.abs(p - exact) < 4 * sigma, `MC=${p} vs 精确=${exact.toExponential(4)}`);
  });

  it('对称恒等式：P(X>Y) + P(Y>X) = 1（整数形状无 tie）', () => {
    for (const [a1, b1, a2, b2] of [
      [5, 3, 2, 2],
      [12, 1, 1, 12],
      [4, 4, 4, 4],
    ] as const) {
      const fwd = betaAdvantageProbability(a1, b1, a2, b2);
      const rev = betaAdvantageProbability(a2, b2, a1, b1);
      assert.ok(Math.abs(fwd + rev - 1) < EPS, `(${a1},${b1})/(${a2},${b2})：和=${fwd + rev}`);
      // 同分布 → 0.5
    }
    assert.ok(Math.abs(betaAdvantageProbability(4, 4, 4, 4) - 0.5) < EPS);
  });

  it('负对照：非整数形状点名拒绝（定理域声明，不静默近似）', () => {
    for (const bad of [2.5, 0, -1]) {
      assert.throws(
        () => betaAdvantageProbability(bad, 2, 3, 3),
        (e: unknown) => e instanceof QuantumEstimateError && e.message.includes('positive integer'),
        `shape=${bad}`,
      );
    }
  });
});

describe('R18B · 噪声感知先验与选择器行为面', () => {
  it('先验映射：整数伪计数、f=0 集中成功、f=1/2 均匀化、κ=0 退化为 Beta(1,1)', () => {
    const quiet = noiseAwarePrior(3, 4, 0, 8);
    const noisy = noiseAwarePrior(3, 4, 0.5, 8);
    assert.deepEqual(quiet, { alpha: 9, beta: 1 }); // q=1 → 全部伪计数给成功
    assert.ok(noisy.alpha >= 1 && noisy.beta >= 1);
    assert.equal(noisy.alpha + noisy.beta, 10); // 1+κ 恒等
    assert.ok(noisy.alpha < quiet.alpha, '更噪的后端先验均值必须更低（定理 1 单调性的推论）');
    assert.deepEqual(noiseAwarePrior(3, 4, 0.1, 0), { alpha: 1, beta: 1 });
    assert.throws(() => noiseAwarePrior(3, 4, 0.1, 1.5), /non-negative integer/);
    assert.throws(() => noiseAwarePrior(3, 4, 0.1, -1), /non-negative integer/);
  });

  it('共轭更新 + 后验快照 + 精确优势概率闭环（手算数字钉死）', () => {
    const sel = new NoiseAwareBackendSelector([
      { name: 'local', priorStrength: 0 },
      { name: 'dwave', flipProb: 0.05, problemShape: { m: 3, n: 4 }, priorStrength: 0 },
    ]);
    for (let i = 0; i < 12; i++) sel.record('local', true);
    for (let i = 0; i < 10; i++) sel.record('dwave', i < 2);
    const local = sel.posteriorOf('local');
    const dwave = sel.posteriorOf('dwave');
    assert.deepEqual([local.alpha, local.beta], [13, 1]);
    assert.deepEqual([dwave.alpha, dwave.beta], [3, 9]);
    assert.equal(local.trials, 12);
    assert.equal(dwave.successes, 2);
    // P(local > dwave) 与手算有限和逐位一致
    assert.ok(
      Math.abs(
        sel.probabilityBetterThan('local', 'dwave') - betaAdvantageProbability(13, 1, 3, 9),
      ) < EPS,
    );
    assert.ok(sel.probabilityBetterThan('local', 'dwave') > 0.99, '压倒性优势应被精确概率捕获');
    assert.ok(sel.probabilityBetterThan('dwave', 'local') < 0.01);
  });

  it('三态规则：thompson 同种子逐位复现（臂序=注册序）；greedy/lcb 确定性', () => {
    const sel = new NoiseAwareBackendSelector([{ name: 'a' }, { name: 'b' }]);
    sel.record('a', true);
    sel.record('b', false);
    const d1 = sel.selectNext(makeRng(7));
    const d2 = sel.selectNext(makeRng(7));
    assert.deepEqual(d1, d2, '同种子 thompson 决策逐位一致');
    assert.equal(d1.rule, 'thompson');
    assert.equal(d1.scores.length, 2);
    const greedy = sel.selectNext(undefined, 'greedy');
    assert.equal(greedy.backend, 'a', 'greedy 取后验均值最大');
    const lcb = sel.selectNext(undefined, 'lcb');
    assert.equal(lcb.backend, 'a');
    assert.ok(lcb.scores[0]!.score < greedy.scores[0]!.score, 'LCB 必须低于均值（β>0 时）');
  });

  it('regret 实证（非定理）：thompson 显著优于均匀随机基线（同 RNG 流，固定种子）', () => {
    const pTrue: Record<string, number> = { good: 0.85, bad: 0.45 };
    const pBest = 0.85;
    const steps = 4_000;
    const rng = makeRng(1818);
    const runThompson = (): number => {
      const sel = new NoiseAwareBackendSelector([{ name: 'good' }, { name: 'bad' }]);
      let regret = 0;
      for (let t = 0; t < steps; t++) {
        const pick = sel.selectNext(rng).backend;
        regret += pBest - pTrue[pick]!;
        sel.record(pick, rng() < pTrue[pick]!);
      }
      return regret;
    };
    const runRandom = (): number => {
      let regret = 0;
      for (let t = 0; t < steps; t++) {
        const pick = rng() < 0.5 ? 'good' : 'bad';
        regret += pBest - pTrue[pick]!;
      }
      return regret;
    };
    const thompsonRegret = runThompson();
    const randomRegret = runRandom();
    // 随机基线 ≈ 0.5·steps·Δ = 0.2·4000 = 800（负对照：线性 regret）
    assert.ok(
      randomRegret > 0.15 * steps,
      `均匀随机基线的 regret 应线性增长（实测 ${randomRegret}）`,
    );
    assert.ok(
      thompsonRegret < randomRegret / 4,
      `thompson regret=${thompsonRegret} 应显著低于随机基线的 1/4（${randomRegret / 4}）`,
    );
  });

  it('负对照：构造域与证据域的点名拒绝', () => {
    assert.throws(() => new NoiseAwareBackendSelector([]), /at least one arm/);
    assert.throws(() => new NoiseAwareBackendSelector([{ name: '' }]), /non-empty string/);
    assert.throws(
      () => new NoiseAwareBackendSelector([{ name: 'x' }, { name: 'x' }]),
      /duplicate arm name/,
    );
    assert.throws(
      () => new NoiseAwareBackendSelector([{ name: 'x', flipProb: 0.05 }]),
      /without problemShape/,
    );
    assert.throws(
      () => new NoiseAwareBackendSelector([{ name: 'x', priorStrength: 5 }]),
      /without flipProb/,
    );
    assert.throws(
      () => new NoiseAwareBackendSelector([{ name: 'x' }], { lcbDelta: 1.5 }),
      /lcbDelta/,
    );
    const sel = new NoiseAwareBackendSelector([{ name: 'x' }]);
    assert.throws(() => sel.record('nope', true), /unknown arm/);
    assert.throws(
      () => sel.record('x', 1 as never),
      (e: unknown) => e instanceof BackendError && e.message.includes('must be a boolean'),
    );
    assert.throws(() => sel.selectNext(), /requires an injected rng/);
    assert.throws(() => sel.posteriorOf('nope'), /unknown arm/);
  });
});
