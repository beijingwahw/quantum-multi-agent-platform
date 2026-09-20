/**
 * noise-aware-backend-selector —— 噪声感知后端选择器（R18 创新，opt-in）
 *
 * ============ 定位 ============
 *
 * quantum-backend.ts 的注册表是**静态优先级**（默认路径先真硬件后本地）；
 * cross-backend-consensus 融合的是**已经花掉的采样**。两者都不回答
 * 「下一个问题发给哪个后端」：真硬件有读出噪声与排队抖动，本地精确
 * 引擎慢但无噪——盲发要么烧配额要么烧墙钟。本模块把每个后端的逐次
 * 观测（该次求解的顶层分配是否达到福利阈值）累积成 Beta-Bernoulli
 * 后验，先验由**可测噪声参数经闭式保持率映射**（不是均匀的），决策
 * 面三态可选（Thompson / 贪心 / LCB）。纯决策层：不持 QuantumBackend
 * 引用、不发 IO（观测由调用方回灌）。
 *
 * ============ 精确主张（可证伪） ============
 *
 * 定理 1（one-hot 保持率闭式）：m 任务 × n agent 的 one-hot 编码，
 * 独立对称逐比特读出翻转率 f 下，一个每块恰一位选中的合法自旋向量
 * 读出后每块仍恰一位选中的概率为
 *     q_{m,n}(f) = [ (1−f)^n + (n−1)·f²·(1−f)^{n−2} ]^m   （n ≥ 2）。
 * 证明：单块中选中位 s（原 −1）。翻转后该块恰一位 −1 当且仅当
 * (i) s 不翻且其余 n−1 位全不翻（概率 (1−f)^n），或 (ii) s 翻且其余
 * n−1 位恰一位翻（概率 f·(n−1)·f·(1−f)^{n−2}）。块间独立 → m 次幂。
 * 两个端点锚：f=0 ⇒ q=1（无噪声恒保持）；f=1/2 ⇒ 块概率 = n·2^{−n}
 * （完全随机读出下恰一位选中的均匀概率——两条独立推导同值交叉验证）。
 *
 * 定理 1'（单调性）：q_{m,n} 在 f ∈ [0, 1/2] 上单调不增。证明：
 * 块因子 g(f) = (1−f)^n + (n−1)f²(1−f)^{n−2}，g'(f) = (1−f)^{n−3}·h(f)，
 * h(f) = −n + (4n−2)f − n²f²。n=2：h = −2(2f−1)(f−1) ≤ 0（区间内）；
 * n≥3：h 的判别式 −4(n(n−2)²−1) < 0 且开口向下 ⇒ h 恒负。g ≥ 0 且
 * m ≥ 1 ⇒ q = g^m 不增。
 *
 * 定理 2（共轭封闭性）：Beta(α,β) 先验 + Bernoulli 观测的后验为
 * Beta(α+成功, β+失败)，每次更新 O(1)——标准共轭结果（无近义词可争）。
 *
 * 定理 3（精确优势概率有限和）：X ~ Beta(a₁,b₁)，Y ~ Beta(a₂,b₂)
 * 独立，a₂、b₂ 为正整数，则
 *   P(X>Y) = Σ_{k=a₂}^{a₂+b₂−1} C(a₂+b₂−1, k) · B(a₁+k, b₁+a₂+b₂−1−k) / B(a₁,b₁)。
 * 证明：整数形状的正则化不完全 Beta 化为二项尾和 I_x(a₂,b₂) =
 * Σ_k C(a₂+b₂−1,k) x^k (1−x)^{a₂+b₂−1−k}；P(X>Y) = ∫ f_X(x)·I_x(a₂,b₂) dx，
 * 逐项乘 Beta 密度积分得 Beta 函数比。本模块在**对数空间**（lgamma/
 * logBeta）求和（max-shift 归并），不经正态近似。本模块的全流程
 * （先验整数伪计数 + 整数观测计数）保证后验形状恒为正整数 ⇒ 该精确
 * 公式全域适用。
 *
 * ============ 诚实的边界 ============
 *
 * - 观测模型是 Bernoulli（逐次成败）：把「顶层分配福利 ≥ (1−ε)·本地
 *   精确最优」这类阈值判定喂给 record()。连续量（福利差、invalidRate）
 *   的建模不在本模块主张内。
 * - 噪声先验只覆盖**对称独立逐比特翻转**读出模型（与 readout-mitigation
 *   同族、同域纪律 f ∈ [0,0.5]）；相关性噪声（共模漂移、串扰）不建模。
 *   定理 1 的保持率是「one-hot 块保持」概率，不含 agent 不复用约束——
 *   它是合法保持概率的**上界**，作为先验质量使用（先验只是出发点，
 *   观测会覆盖它）。
 * - Thompson 采样的后悔界（对数后悔）是文献结果〔待双源〕，本模块
 *   **不主张证明**，只在测试中给出固定种子的实证钉板与均匀随机
 *   基线的负对照。
 * - 选择器不感知排队/费用/能耗——多目标（成本 vs 成功率）的 Pareto
 *   抉择留给调用方（snapshot 的后验面即为此设计）。
 * - 复杂度：K 臂 select O(K·(Beta 分位数 200 步二分))；record O(1)；
 *   优势概率 O(a₂+b₂) 项对数空间求和。无内置 RNG（thompson 的逆 CDF
 *   抽样由调用方注入 rng: () => number，臂序=注册序，同种子逐位复现）。
 *
 * ============ 文献接地（形状级，〔待双源〕） ============
 *
 * - Thompson 1933「one unknown probability exceeds another」〔待双源〕
 * - Beta-Bernoulli 共轭与 Beta 回归先验伪计数惯例（Gelman 等 Bayesian
 *   Data Analysis 教科书族）〔待双源〕
 * - 整数形状正则化不完全 Beta 的二项尾恒等式（Abramowitz–Stegun
 *   数学手册手册类）〔待双源〕
 * - 两独立 Beta 精确比较概率的有限和公式（Cook 2005 前后 "exact
 *   beta inequalities" 技术笔记族）〔待双源〕
 */

import { lgamma, logBeta, betaQuantile } from '../../proactive-intelligence/beta-distribution.js';
import { QuantumEstimateError, BackendError } from '../../utils/errors.js';

// ----------------------------------------------------------------------------
// 定理 1：one-hot 保持率闭式
// ----------------------------------------------------------------------------

/**
 * 合法 one-hot 自旋向量在对称独立读出翻转下的保持率（定理 1 闭式）。
 * 域：m ≥ 1 整数、n ≥ 2 整数（n=1 的块无 one-hot 约束语义，点名拒绝）、
 * f ∈ [0, 0.5]（超出即似然反序域，与 readout-mitigation 同口径拒绝）。
 */
export function oneHotRetentionRate(m: number, n: number, f: number): number {
  if (!Number.isInteger(m) || m < 1) {
    throw new QuantumEstimateError(
      `oneHotRetentionRate: task count must be an integer >= 1, got ${String(m)}`,
    );
  }
  if (!Number.isInteger(n) || n < 2) {
    throw new QuantumEstimateError(
      `oneHotRetentionRate: agent count must be an integer >= 2 ` +
        `(a single-bit block has no one-hot constraint to retain), got ${String(n)}`,
    );
  }
  if (!(f >= 0 && f <= 0.5) || !Number.isFinite(f)) {
    throw new QuantumEstimateError(
      `oneHotRetentionRate: flip probability must be in [0, 0.5] ` +
        `(beyond 0.5 the symmetric-flip readout inverts, mirroring readout-mitigation), got ${String(f)}`,
    );
  }
  const block = Math.pow(1 - f, n) + (n - 1) * f * f * Math.pow(1 - f, n - 2);
  return Math.pow(block, m);
}

// ----------------------------------------------------------------------------
// 定理 3：精确优势概率（两独立 Beta，整数形状，对数空间有限和）
// ----------------------------------------------------------------------------

/** ln C(N, k)（lgamma 组合；N ≥ 0、0 ≤ k ≤ N 整数） */
function logChoose(n: number, k: number): number {
  return lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1);
}

/**
 * P(X > Y)，X ~ Beta(a1,b1)、Y ~ Beta(a2,b2) 独立，**四参数全为正整数**
 * （有限和要求；非整数形状点名拒绝——本模块后验流程恒整数，外部直接
 * 调用者须自带整数形状或改用数值积分）。连分数 Beta CDF 的实现是
 * 另一条独立路径，测试里以数值积分与蒙特卡洛三腿对拍本公式。
 */
export function betaAdvantageProbability(a1: number, b1: number, a2: number, b2: number): number {
  const shapeAssert = (name: string, v: number): void => {
    if (!Number.isInteger(v) || v < 1) {
      throw new QuantumEstimateError(
        `betaAdvantageProbability: ${name} must be a positive integer ` +
          `(the exact finite-sum formula is stated over integer shapes; use numeric ` +
          `integration for fractional posteriors), got ${String(v)}`,
      );
    }
  };
  shapeAssert('a1', a1);
  shapeAssert('b1', b1);
  shapeAssert('a2', a2);
  shapeAssert('b2', b2);
  const logDenom = logBeta(a1, b1);
  const bigN = a2 + b2 - 1;
  const terms: number[] = [];
  for (let k = a2; k <= bigN; k++) {
    // C(N,k) · B(a1+k, b1+N−k) / B(a1,b1)，对数空间
    terms.push(logChoose(bigN, k) + logBeta(a1 + k, b1 + bigN - k) - logDenom);
  }
  // max-shift 归并（指数化前平移，防下溢）
  let max = Number.NEGATIVE_INFINITY;
  for (const t of terms) if (t > max) max = t;
  let sum = 0;
  for (const t of terms) sum += Math.exp(t - max);
  return Math.exp(max + Math.log(sum));
}

// ----------------------------------------------------------------------------
// 噪声感知先验（定理 1 映射 → 整数伪计数）
// ----------------------------------------------------------------------------

/**
 * 噪声感知先验伪计数：Beta(1 + round(κ·q), 1 + κ − round(κ·q))。
 * κ（先验强度）取非负整数 ⇒ 先验形状恒正整数 ⇒ 定理 3 全流程适用。
 * round 而非截断：κ(1−q) 与 κ·q 之和恰为 κ，两侧对称取整。
 */
export function noiseAwarePrior(
  m: number,
  n: number,
  f: number,
  strength: number,
): { readonly alpha: number; readonly beta: number } {
  if (!Number.isInteger(strength) || strength < 0) {
    throw new QuantumEstimateError(
      `noiseAwarePrior: prior strength must be a non-negative integer ` +
        `(integer pseudo-counts keep the exact advantage formula in-domain), got ${String(strength)}`,
    );
  }
  const q = oneHotRetentionRate(m, n, f);
  const successes = Math.round(strength * q);
  return { alpha: 1 + successes, beta: 1 + (strength - successes) };
}

// ----------------------------------------------------------------------------
// 选择器（纯决策层）
// ----------------------------------------------------------------------------

/** 选择器臂的构造描述（flipProb 给出时 problemShape 必填） */
export interface SelectorArmInit {
  readonly name: string;
  /** 读出翻转率 f ∈ [0,0.5]；给出则先验按定理 1 闭式映射 */
  readonly flipProb?: number;
  /** 编码形状（m 任务 × n agent）；flipProb 存在时必填 */
  readonly problemShape?: { readonly m: number; readonly n: number };
  /** 先验强度 κ（非负整数伪实验数；缺省 0 → Beta(1,1) 均匀） */
  readonly priorStrength?: number;
}

export type SelectionRule = 'thompson' | 'greedy' | 'lcb';

/** 单臂后验快照（观察面：调用方做多目标权衡的原始材料） */
export interface ArmPosterior {
  readonly name: string;
  readonly alpha: number;
  readonly beta: number;
  readonly mean: number;
  readonly trials: number;
  readonly successes: number;
  /** 后验 LCB（构造时给定的 δ 分位数；供 greedy/thompson 之外的对读） */
  readonly lcb: number;
}

export interface SelectionDecision {
  readonly backend: string;
  readonly rule: SelectionRule;
  /** 逐臂打分（thompson=逆 CDF 抽样值；greedy=后验均值；lcb=δ 分位数） */
  readonly scores: ReadonlyArray<{ readonly name: string; readonly score: number }>;
}

export interface SelectorOptions {
  /** LCB 分位数 δ（缺省 0.05）；域 (0,1) */
  readonly lcbDelta?: number;
}

interface Arm {
  readonly name: string;
  alpha: number;
  beta: number;
  trials: number;
  successes: number;
}

/**
 * 噪声感知后端选择器。用法：
 *   const sel = new NoiseAwareBackendSelector([{ name: 'dwave', flipProb: 0.03, problemShape: {m: 4, n: 5}, priorStrength: 8 }, { name: 'local' }]);
 *   const pick = sel.selectNext(makeRng(42));       // thompson（缺省）
 *   ...求解... sel.record(pick.backend, welfare >= (1-eps)*optimum);
 * 逐臂后验 + 三态规则 + 精确优势概率。零 IO、零内置随机源。
 */
export class NoiseAwareBackendSelector {
  private readonly arms: Arm[] = [];
  private readonly lcbDelta: number;

  constructor(arms: readonly SelectorArmInit[], options: SelectorOptions = {}) {
    if (arms.length === 0) {
      throw new BackendError(
        'NoiseAwareBackendSelector: need at least one arm (got 0); selection over an empty pool is undefined',
      );
    }
    const seen = new Set<string>();
    for (let i = 0; i < arms.length; i++) {
      const arm = arms[i]!;
      if (typeof arm.name !== 'string' || arm.name.length === 0) {
        throw new BackendError(
          `NoiseAwareBackendSelector: arms[${i}].name must be a non-empty string, got ${String(arm.name)}`,
        );
      }
      if (seen.has(arm.name)) {
        throw new BackendError(
          `NoiseAwareBackendSelector: duplicate arm name '${arm.name}' — posteriors are keyed by name`,
        );
      }
      seen.add(arm.name);
      if (arm.flipProb !== undefined) {
        if (arm.problemShape === undefined) {
          throw new BackendError(
            `NoiseAwareBackendSelector: arm '${arm.name}' declares flipProb without problemShape; ` +
              'the retention-rate prior is a function of the (m, n) one-hot encoding',
          );
        }
        const prior = noiseAwarePrior(
          arm.problemShape.m,
          arm.problemShape.n,
          arm.flipProb,
          arm.priorStrength ?? 0,
        );
        this.arms.push({ name: arm.name, ...prior, trials: 0, successes: 0 });
      } else {
        if (arm.priorStrength !== undefined && arm.priorStrength !== 0) {
          throw new BackendError(
            `NoiseAwareBackendSelector: arm '${arm.name}' declares priorStrength without flipProb; ` +
              'a noise-free prior carries no pseudo-evidence (use flipProb to place prior mass)',
          );
        }
        // 均匀先验 Beta(1,1)：整数形状，定理 3 域内
        this.arms.push({ name: arm.name, alpha: 1, beta: 1, trials: 0, successes: 0 });
      }
    }
    const delta = options.lcbDelta ?? 0.05;
    if (!(delta > 0 && delta < 1) || !Number.isFinite(delta)) {
      throw new QuantumEstimateError(
        `NoiseAwareBackendSelector: lcbDelta must be in (0, 1), got ${String(delta)}`,
      );
    }
    this.lcbDelta = delta;
  }

  /** 共轭更新（定理 2）：O(1)。success 必须是布尔——观测证据不允许垃圾形态 */
  record(name: string, success: boolean): void {
    const arm = this.armOf(name);
    if (typeof success !== 'boolean') {
      throw new BackendError(
        `NoiseAwareBackendSelector.record: success must be a boolean for arm '${name}', ` +
          `got ${String(success)}; evidence units are whole trials, garbage falsifies every posterior`,
      );
    }
    arm.trials++;
    if (success) {
      arm.successes++;
      arm.alpha++;
    } else {
      arm.beta++;
    }
  }

  /**
   * 选下一臂。thompson 需注入 rng（逆 CDF 抽样：theta = betaQuantile(u)，
   * u 按**注册序**逐臂取一个）；greedy/lcb 确定性（rng 可省）。
   * 平局取注册序最前者。返回逐臂打分供审计。
   */
  selectNext(rng?: () => number, rule: SelectionRule = 'thompson'): SelectionDecision {
    if (rule === 'thompson' && typeof rng !== 'function') {
      throw new BackendError(
        'NoiseAwareBackendSelector.selectNext: the thompson rule requires an injected rng ' +
          '(inverse-CDF sampling; no hidden random source)',
      );
    }
    const scores = this.arms.map((arm) => {
      if (rule === 'thompson') {
        return { name: arm.name, score: betaQuantile(rng!(), arm.alpha, arm.beta) };
      }
      if (rule === 'greedy') return { name: arm.name, score: arm.alpha / (arm.alpha + arm.beta) };
      return { name: arm.name, score: betaQuantile(this.lcbDelta, arm.alpha, arm.beta) };
    });
    let bestIdx = 0;
    for (let i = 1; i < scores.length; i++) {
      if (scores[i]!.score > scores[bestIdx]!.score) bestIdx = i;
    }
    return { backend: scores[bestIdx]!.name, rule, scores };
  }

  /** 后验优势：P(臂 a 成功率 > 臂 b 成功率)，定理 3 精确有限和 */
  probabilityBetterThan(a: string, b: string): number {
    const armA = this.armOf(a);
    const armB = this.armOf(b);
    return betaAdvantageProbability(armA.alpha, armA.beta, armB.alpha, armB.beta);
  }

  posteriorOf(name: string): ArmPosterior {
    const arm = this.armOf(name);
    return {
      name: arm.name,
      alpha: arm.alpha,
      beta: arm.beta,
      mean: arm.alpha / (arm.alpha + arm.beta),
      trials: arm.trials,
      successes: arm.successes,
      lcb: betaQuantile(this.lcbDelta, arm.alpha, arm.beta),
    };
  }

  snapshot(): ArmPosterior[] {
    return this.arms.map((arm) => this.posteriorOf(arm.name));
  }

  private armOf(name: string): Arm {
    const arm = this.arms.find((a) => a.name === name);
    if (arm === undefined) {
      throw new BackendError(
        `NoiseAwareBackendSelector: unknown arm '${name}'; registered: [${this.arms
          .map((a) => a.name)
          .join(', ')}]`,
      );
    }
    return arm;
  }
}
