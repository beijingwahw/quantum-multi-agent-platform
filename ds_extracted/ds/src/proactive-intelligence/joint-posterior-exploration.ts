/**
 * JointPosteriorExploration —— (α̂,β̂) 联合后验 sd 的探索系数（R19-R 创新 1，opt-in）
 *
 * ============ 定位（R18 版 σ 的诚实升级，诚实边界） ============
 *
 * R18 的 EvidenceGatedExploration 把探索系数的不确定度面取为**能力成功率**
 * 的 Beta 后验 sd（模块头已如实声明：「σ 是成功率的后验 sd 而非 (α̂,β̂)
 * 联合后验 sd——学习问题不确定性只经 decided 布尔粗粒度进入」）。本模块
 * 兑现该批 3 候选：把 σ 从 (n,s) 的成功率面升级为**学习曲线参数 (α,β)
 * 联合后验的 sd 面**，权重口径与 CompoundBrain.fitGrid 的幸存分量混合
 * 完全对齐：
 *
 *   w_g = exp(ll_g − ll_max) / Σ_h exp(ll_h − ll_max)
 *
 * （compound-brain.ts:776-782 同式：weight = Math.exp(ll − best.ll) 后对
 * 幸存集归一。）宿主传入幸存分量集（fitGrid 的截断——似然比 < 1/200 与
 * deviance 维持门限——是宿主/校准层的职责；把近 null 分量混进来会重演
 * compound-brain 注释里实证过的「双重收缩腰斩」，本模块不替宿主做截断）。
 *
 * 估计对象换成曲线质量 m(k) = α·(1−e^{−β·k}) 在评估资本 k̄ 处的值：
 *
 *   σ_joint(k̄) = √Var_w[ m(k̄) ]，e = e₀ · σ_joint(k̄) · saturate · u
 *
 * 语义升级的三个精确面（其余因子与 R18 逐字同义）：
 *   1. **σ 是 k 的函数**（sd 面）：观测窗内近并列的曲线在未观测资本处
 *      分叉时，σ_joint 在那里放大（外推不确定度进入定价）；R18 的
 *      σ(n,s) 对评估资本完全盲；
 *   2. **σ(0) = 0 逐位**：全部分量在零资本处曲线质量为 0——零资本观测
 *      不携带曲线形状信息，与 SprtCalibrationGate 的「k=0 增量恰为 0」
 *      精确同源（同一似然族的两条恒等式）；
 *   3. **σ(∞) = sd_w(α)**：饱和区只剩幅度不确定性。
 *
 * ============ 精确主张（可证伪陈述） ============
 *
 * 记分量 g 的曲线质量 m_g(k) = α_g(1−e^{−β_g·k})，权重如上（或宿主直接
 * 给归一权重）。d̄_g = (ll_max − ll_g)/n 为每观测对数似然亏量（n = 生成
 * 该似然的观测数，宿主申报）。
 *
 * **定理 J1（成对恒等式）**
 *     σ_joint(k)² = (1/2)·Σ_g Σ_h w_g·w_h·(m_g(k) − m_h(k))²。
 * 对任意概率权重精确成立（代数恒等式，非近似）——测试用它做与
 * E[m²]−E[m]² 的双路径对拍。
 *
 * **定理 J2（Lipschitz 证书包络）** 设网格在 k 处的 Lipschitz 常数
 *     L(k) = max{ (m_g(k)−m_h(k))² / (d̄_g+d̄_h) : d̄_g+d̄_h > 0 }
 * 有限（平似然网格无定义，见下）。则
 *     σ_joint(k)² ≤ L(k)·E_w[d̄] ≤ L(k)·K/(e·n)
 * （e = 2.71828…，K = 分量数）。证明：J1 + 逐对 Lipschitz 条件给
 * σ² ≤ (L/2)·ΣΣ w_g w_h (d̄_g+d̄_h) = L·E_w[d̄]；分子逐项 d̄·e^{−n·d̄}
 * ≤ 1/(e·n)（x·e^{−nx} 在 x=1/n 取最大），分母 ≥ 1（ll_max 分量在场），
 * K 项求和。∎（全部是所供数字的精确算术，无统计假设。）
 *
 * **定理 J3（预算望远镜）** 若整段评估流上 L(k̄_i) ≤ L_max、K_i ≤ K_max，
 * 且每次评估恰消费一个新观测（n_i = i，与 R18 定理 B 的入口条件同款），
 * 则
 *     Σ e ≤ 2·e₀·√(L_max·K_max/e)·√N。
 * 证明：e ≤ e₀·√(LK/(e·n))，Σ_{n=1}^N n^{−1/2} ≤ 2√N（积分比较）。∎
 *
 * **定理 J4（k 面精确端点）** σ_joint(0) = 0（逐位）；σ_joint(k→∞) =
 * sd_w(α)（e^{−β·k}→0）；σ_joint(k) 一般非单调（快/慢曲线先分离后合并）。
 *
 * ============ 诚实边界（不主张什么） ============
 *
 * - **估计对象变了**：σ_joint 是曲线质量 m(k̄) 的（准）后验 sd，R18 的
 *   σ 是成功率的 Beta 后验 sd——两个不同的量，数值不可直接比大小；
 *   对照账本只钉语义分界（k 盲 vs 外推敏感），不主张谁「更优」。
 * - **准后验，非规范后验**：网格权重 = 似然比截断后的平坦先验混合
 *   （fitGrid 口径），不含先验收缩项；对网格外真值不承诺覆盖率。
 * - **证书常数携带可辨识性**：L(k) 把「曲线差异不被似然区分」的程度
 *   编进包络——似然平坦脊（β 退化方向，fitGrid 注释同源）使 L 爆炸；
 *   平似然网格（全体 ll 相等，或 ll 并列且曲线不同）上证书**不可得**
 *   （指名拒绝），σ 的精确计算不受影响。这是诚实推广边界：R18 的
 *   1/(2√(n+κ₀+1)) 包络对一切 (n,s) 可得，本包络只对可辨识网格可得。
 * - **宿主申报的 n 与 ll 必须同源**：d̄ 的分母 n 是宿主生成 ll 时的观测
 *   数；虚报小 n 会虚假收紧证书（测试演示「错误 null」的同类口径）。
 * - 饱和/门控因子与 R18 逐字同义（启发式形状 + 恒等式面），不新增主张；
 *   不主张 regret/福利最优性；端到端市场接线归编排者。
 *
 * ============ 文献族（仅形状，〔待双源〕） ============
 *
 * - Wasserman-Ramdas-Balakrishnan-2020-Universal inference（混合似然比
 *   的 anytime-valid 性质；fitGrid 权重同族）〔待双源〕
 * - Lattimore-Szepesvári-2020-Bandit Algorithms（不确定度驱动的探索
 *   加成形族）〔待双源〕
 * - Howard-Ramdas-McAuliffe-Sekhon-2021-Time-uniform confidence
 *   sequences（不确定度收缩面）〔待双源〕
 * - Wald-1947-Sequential Analysis（停止规则与信息计量的经典框架）
 *   〔待双源〕
 *
 * ============ 确定性契约 ============
 *
 * 纯函数内核：无随机源、无时钟、无 IO、无模块级可变状态。同一输入
 * 逐位同输出。台账只是确定性累加器。
 */

import { ConfigurationError, NumericDomainError } from '../utils/errors.js';

// ----------------------------------------------------------------------------
// 类型
// ----------------------------------------------------------------------------

/**
 * 联合后验网格分量：fitGrid 幸存分量的形状。
 * 权重口径二选一（与 SprtComponent 同纪律）：全体带 logLikelihood
 * （模块按 fitGrid 同式归一），或全体带 weight（calibrations() mixture
 * 的直接对接；和须为 1）。混用指名拒绝。
 */
export interface JointGridComponent {
  /** 学习幅度 α ∈ (0, 0.98]（与 SprtComponent 同上界） */
  alpha: number;
  /** 学习速率 β > 0（有限） */
  beta: number;
  /** 该分量的 Bernoulli 对数似然（ll 形权重入口；证书必需） */
  logLikelihood?: number;
  /** 归一化混合权重（weight 形入口；全体同给、和为 1） */
  weight?: number;
}

export interface JointExplorationConfig {
  /** 基准探索系数 e₀ > 0（对齐平台 exploreCoefficient 缺省 0.5） */
  baseCoefficient: number;
}

export const DEFAULT_JOINT_EXPLORATION_CONFIG: JointExplorationConfig = {
  baseCoefficient: 0.5,
};

/** 反馈环输入：幸存分量网格 + 评估资本 + 校准状态 + 序贯门终判布尔 */
export interface JointFeedbackInputs {
  /** fitGrid 幸存分量集（非空） */
  components: readonly JointGridComponent[];
  /** 评估资本 k̄ ≥ 0：σ 面在该处取值（曲线不确定度的定价点） */
  evaluationCapital: number;
  /** 校准幅度估计 α̂ ≥ 0（饱和因子的检出开关） */
  alphaHat: number;
  /** 校准速率估计 β̂ ≥ 0 */
  betaHat: number;
  /** 平均资本 k̄_sat ≥ 0（饱和因子的评估资本；通常 = evaluationCapital） */
  meanCapital: number;
  /** 序贯门是否已终判（终判即断流） */
  decided: boolean;
}

/** 系数分解快照（审计面：联合 sd 面的逐项可核） */
export interface JointExplorationCoefficient {
  /** 反馈环产出 e = e₀·σ_joint(k̄)·saturate·u */
  coefficient: number;
  /** 联合后验 sd σ_joint(evaluationCapital) */
  jointSigma: number;
  /** 模型平均曲线质量 E_w[m(k̄)]（审计面） */
  meanCurveMass: number;
  /** sd_w(α)（(α̂,β̂) 联合面的幅度边缘） */
  alphaPosteriorSd: number;
  /** sd_w(β)（速率边缘） */
  betaPosteriorSd: number;
  /** 饱和因子 e^{−β̂·k̄_sat}（未检出 = 1；与 R18 逐字同义） */
  saturationFactor: number;
  /** 未终判因子（终判 = 0） */
  undecidedFactor: 0 | 1;
  /** 分量数 K */
  componentCount: number;
}

/** 证书包络快照（定理 J2 的机器核对面） */
export interface CertifiedEnvelopeFace {
  /** σ_joint(k)（精确值） */
  sigma: number;
  /** 证书上界 √(L·K/(e·n)) */
  bound: number;
  /** 网格 Lipschitz 常数 L(k) */
  lipschitzConstant: number;
  /** E_w[d̄]（每观测平均亏量的混合期望） */
  ewDeficit: number;
  /** 亏量界 K/(e·n) */
  deficitBound: number;
  /** 分量数 K */
  componentCount: number;
}

/** 预算证书配置（定理 J3：流上最大值由宿主申报） */
export interface JointBudgetCertificate {
  /** e₀ > 0 */
  baseCoefficient: number;
  /** 流上 L(k̄_i) 的最大值（有限正数） */
  lipschitzMax: number;
  /** 流上 K_i 的最大值（正整数） */
  componentCountMax: number;
}

/** 分量 α 上界（与 SprtComponent 的 ALPHA_MAX 一致） */
const ALPHA_MAX = 0.98;

// ----------------------------------------------------------------------------
// 内部：网格解析与校验（走私审判风格：非法值指名拒绝）
// ----------------------------------------------------------------------------

interface ResolvedGrid {
  components: ReadonlyArray<{ alpha: number; beta: number }>;
  weights: readonly number[];
  /** ll 形时可用（证书需要）；weight 形为 null */
  logLikelihoods: readonly number[] | null;
}

function resolveGrid(components: readonly JointGridComponent[]): ResolvedGrid {
  if (!Array.isArray(components) || components.length === 0) {
    throw new ConfigurationError(
      'JointGridComponent[] must be a non-empty array of surviving fitGrid components',
    );
  }
  const raw = components as ReadonlyArray<{
    alpha?: unknown;
    beta?: unknown;
    logLikelihood?: unknown;
    weight?: unknown;
  }>;
  const withBoth = raw.filter((c) => c.logLikelihood !== undefined && c.weight !== undefined);
  const withLL = raw.filter((c) => c.logLikelihood !== undefined);
  const withWeight = raw.filter((c) => c.weight !== undefined);
  // 货币一致性：全体 ll、或全体 weight。真混用、部分缺省、双币并持都会让
  // 隐式权重语义两可，一律按「混合口径」指名拒绝（与 SprtComponent 同纪律）。
  if (withBoth.length !== 0 || (withLL.length !== raw.length && withWeight.length !== raw.length)) {
    throw new ConfigurationError(
      'JointGridComponent[]: mixed logLikelihood/weight presence is ambiguous — ' +
        'either every component carries logLikelihood or every component carries weight',
    );
  }
  const comps: Array<{ alpha: number; beta: number }> = [];
  raw.forEach((c, i) => {
    if (
      typeof c.alpha !== 'number' ||
      !Number.isFinite(c.alpha) ||
      c.alpha <= 0 ||
      c.alpha > ALPHA_MAX
    ) {
      throw new NumericDomainError(
        `JointGridComponent[${i}].alpha must be within (0, ${ALPHA_MAX}], got ${String(c.alpha)}`,
      );
    }
    if (typeof c.beta !== 'number' || !Number.isFinite(c.beta) || c.beta <= 0) {
      throw new NumericDomainError(
        `JointGridComponent[${i}].beta must be a finite positive number, got ${String(c.beta)}`,
      );
    }
    comps.push({ alpha: c.alpha, beta: c.beta });
  });

  if (withLL.length !== 0) {
    // ll 形：fitGrid 同式归一（w ∝ exp(ll − ll_max)，相对差消去下溢风险）
    const lls: number[] = [];
    let llMax = -Infinity;
    raw.forEach((c, i) => {
      const ll = c.logLikelihood as number;
      if (typeof ll !== 'number' || !Number.isFinite(ll)) {
        throw new NumericDomainError(
          `JointGridComponent[${i}].logLikelihood must be a finite number, got ${String(ll)}`,
        );
      }
      lls.push(ll);
      if (ll > llMax) llMax = ll;
    });
    const rawW = lls.map((ll) => Math.exp(ll - llMax));
    const z = rawW.reduce((a, b) => a + b, 0);
    return {
      components: comps,
      weights: rawW.map((w) => w / z),
      logLikelihoods: lls,
    };
  }

  // weight 形：calibrations() mixture 直接对接（和为 1 的纪律校验）
  const weights: number[] = [];
  let sum = 0;
  raw.forEach((c, i) => {
    const w = c.weight as number;
    if (typeof w !== 'number' || !Number.isFinite(w) || w <= 0) {
      throw new ConfigurationError(
        `JointGridComponent[${i}].weight must be a finite positive number, got ${String(w)}`,
      );
    }
    weights.push(w);
    sum += w;
  });
  if (Math.abs(sum - 1) > 1e-9) {
    throw new ConfigurationError(
      `JointGridComponent[] weights must sum to 1 (within 1e-9), got ${sum}`,
    );
  }
  return { components: comps, weights, logLikelihoods: null };
}

function assertCapital(name: string, value: number): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new NumericDomainError(
      `JointFeedbackInputs.${name} must be a finite non-negative number, got ${String(value)}`,
    );
  }
}

// ----------------------------------------------------------------------------
// 纯函数：σ 面（定理 J1/J4 的使用面）
// ----------------------------------------------------------------------------

/** 曲线质量 m_g(k)（模块内单一实现） */
function curveMass(alpha: number, beta: number, k: number): number {
  return alpha * (1 - Math.exp(-beta * k));
}

/**
 * 联合后验 sd 面 σ_joint(k) = √Var_w[m(k)]（定理 J1 的直接口径；
 * 纯函数，ll 形与 weight 形同入口）。
 */
export function sigmaJointAt(components: readonly JointGridComponent[], k: number): number {
  if (typeof k !== 'number' || !Number.isFinite(k) || k < 0) {
    throw new NumericDomainError(
      `sigmaJointAt() k must be a finite non-negative number, got ${String(k)}`,
    );
  }
  const grid = resolveGrid(components);
  let e1 = 0;
  let e2 = 0;
  for (let g = 0; g < grid.components.length; g++) {
    const m = curveMass(grid.components[g]!.alpha, grid.components[g]!.beta, k);
    e1 += grid.weights[g]! * m;
    e2 += grid.weights[g]! * m * m;
  }
  const variance = e2 - e1 * e1;
  // Var ≥ 0（浮点残差钳到 0；数学上恒非负）
  return Math.sqrt(Math.max(0, variance));
}

// ----------------------------------------------------------------------------
// 纯函数：证书包络（定理 J2 的使用面）
// ----------------------------------------------------------------------------

/**
 * 定理 J2 的证书面：σ_joint(k)、√(L·K/(e·n))、E_w[d̄] 与 K/(e·n)。
 * 仅 ll 形网格可得（d̄ 需要 ll）；平似然网格（全体亏量并列）上 L 无定义，
 * 指名拒绝——证书不可得不是缺陷，是可辨识性的诚实申报。
 */
export function certifiedEnvelope(
  components: readonly JointGridComponent[],
  observations: number,
  k: number,
): CertifiedEnvelopeFace {
  if (typeof observations !== 'number' || !Number.isInteger(observations) || observations < 1) {
    throw new ConfigurationError(
      `certifiedEnvelope() observations must be an integer ≥ 1, got ${String(observations)}`,
    );
  }
  if (typeof k !== 'number' || !Number.isFinite(k) || k < 0) {
    throw new NumericDomainError(
      `certifiedEnvelope() k must be a finite non-negative number, got ${String(k)}`,
    );
  }
  const grid = resolveGrid(components);
  if (grid.logLikelihoods === null) {
    throw new ConfigurationError(
      'certifiedEnvelope() requires the logLikelihood form of JointGridComponent[] ' +
        '(the deficit face d̄_g = (ll_max − ll_g)/n is the sufficient statistic for the certificate)',
    );
  }
  const K = grid.components.length;
  const n = observations;
  const llMax = Math.max(...grid.logLikelihoods);
  const deficits = grid.logLikelihoods.map((ll) => (llMax - ll) / n);

  // L(k)：逐对比值（d̄_g + d̄_h > 0 的对）。两种证书不可得情形：
  // ①全体亏量并列（平似然）；②并列于 ll_max 的分量曲线不同（该对的
  // Lipschitz 比值无穷——成对条件被破坏，证书不再有效）。均指名拒绝。
  let lipschitz = 0;
  let hasNonZeroPair = false;
  let tiedAtMaxWithDistinctCurves = false;
  for (let g = 0; g < K; g++) {
    for (let h = g + 1; h < K; h++) {
      const dSum = deficits[g]! + deficits[h]!;
      const mG = curveMass(grid.components[g]!.alpha, grid.components[g]!.beta, k);
      const mH = curveMass(grid.components[h]!.alpha, grid.components[h]!.beta, k);
      if (dSum <= 0) {
        if (Math.abs(mG - mH) > 0) tiedAtMaxWithDistinctCurves = true;
        continue;
      }
      hasNonZeroPair = true;
      const ratio = ((mG - mH) * (mG - mH)) / dSum;
      if (ratio > lipschitz) lipschitz = ratio;
    }
  }
  if (!hasNonZeroPair || tiedAtMaxWithDistinctCurves) {
    throw new NumericDomainError(
      'certifiedEnvelope(): flat likelihood grid (all deficits tied, or components tied at ' +
        'll_max with distinct curves) — the Lipschitz constant is undefined and no finite ' +
        'certified envelope exists (honest unidentifiability)',
    );
  }

  let ewDeficit = 0;
  for (let g = 0; g < K; g++) ewDeficit += grid.weights[g]! * deficits[g]!;
  const deficitBound = K / (Math.E * n);
  const sigma = sigmaJointAt(components, k);
  return {
    sigma,
    bound: Math.sqrt((lipschitz * K) / (Math.E * n)),
    lipschitzConstant: lipschitz,
    ewDeficit,
    deficitBound,
    componentCount: K,
  };
}

// ----------------------------------------------------------------------------
// 纯函数：预算证书（定理 J3 的使用面）
// ----------------------------------------------------------------------------

/**
 * 定理 J3 的总预算上界 2·e₀·√(L_max·K_max/e)·√N：N 次逐观测评估
 * （每次评估恰消费一个新观测，L/K 被流上最大值封顶）的系数总和上界。
 */
export function jointBudgetBound(
  evaluations: number,
  config: Partial<JointBudgetCertificate>,
): number {
  if (typeof evaluations !== 'number' || !Number.isInteger(evaluations) || evaluations < 0) {
    throw new ConfigurationError(
      `jointBudgetBound() evaluations must be a non-negative integer, got ${String(evaluations)}`,
    );
  }
  const e0 = config.baseCoefficient ?? DEFAULT_JOINT_EXPLORATION_CONFIG.baseCoefficient;
  const lipschitz = config.lipschitzMax;
  const kMax = config.componentCountMax;
  if (typeof e0 !== 'number' || !Number.isFinite(e0) || e0 <= 0) {
    throw new ConfigurationError(
      `JointBudgetCertificate.baseCoefficient must be a finite positive number, got ${String(e0)}`,
    );
  }
  if (typeof lipschitz !== 'number' || !Number.isFinite(lipschitz) || lipschitz <= 0) {
    throw new ConfigurationError(
      `JointBudgetCertificate.lipschitzMax must be a finite positive number, got ${String(lipschitz)}`,
    );
  }
  if (typeof kMax !== 'number' || !Number.isInteger(kMax) || kMax < 1) {
    throw new ConfigurationError(
      `JointBudgetCertificate.componentCountMax must be an integer ≥ 1, got ${String(kMax)}`,
    );
  }
  return 2 * e0 * Math.sqrt((lipschitz * kMax) / Math.E) * Math.sqrt(evaluations);
}

// ----------------------------------------------------------------------------
// JointPosteriorExploration（纯函数内核）
// ----------------------------------------------------------------------------

export class JointPosteriorExploration {
  private readonly config: JointExplorationConfig;

  constructor(config: Partial<JointExplorationConfig> = {}) {
    const merged = { ...DEFAULT_JOINT_EXPLORATION_CONFIG, ...config };
    if (
      typeof merged.baseCoefficient !== 'number' ||
      !Number.isFinite(merged.baseCoefficient) ||
      merged.baseCoefficient <= 0
    ) {
      throw new ConfigurationError(
        `JointExplorationConfig.baseCoefficient must be a finite positive number, got ${String(merged.baseCoefficient)}`,
      );
    }
    this.config = merged;
  }

  /** 反馈环求值：e = e₀·σ_joint(k̄)·saturate·u（σ 面审计项见返回值） */
  coefficient(inputs: JointFeedbackInputs): JointExplorationCoefficient {
    const raw = inputs as {
      components?: unknown;
      evaluationCapital?: unknown;
      alphaHat?: unknown;
      betaHat?: unknown;
      meanCapital?: unknown;
      decided?: unknown;
    } | null;
    if (raw === null || typeof raw !== 'object') {
      throw new NumericDomainError('JointFeedbackInputs must be an object');
    }
    if (!Array.isArray(raw.components)) {
      throw new ConfigurationError(
        `JointFeedbackInputs.components must be an array, got ${typeof raw.components}`,
      );
    }
    const alphaHat = raw.alphaHat;
    if (typeof alphaHat !== 'number' || !Number.isFinite(alphaHat) || alphaHat < 0) {
      throw new NumericDomainError(
        `JointFeedbackInputs.alphaHat must be a finite non-negative number, got ${String(alphaHat)}`,
      );
    }
    const betaHat = raw.betaHat;
    if (typeof betaHat !== 'number' || !Number.isFinite(betaHat) || betaHat < 0) {
      throw new NumericDomainError(
        `JointFeedbackInputs.betaHat must be a finite non-negative number, got ${String(betaHat)}`,
      );
    }
    if (typeof raw.decided !== 'boolean') {
      throw new NumericDomainError(
        `JointFeedbackInputs.decided must be a boolean, got ${typeof raw.decided}`,
      );
    }
    assertCapital('evaluationCapital', raw.evaluationCapital as number);
    assertCapital('meanCapital', raw.meanCapital as number);

    const grid = resolveGrid(raw.components as readonly JointGridComponent[]);
    const k = raw.evaluationCapital as number;
    const kSat = raw.meanCapital as number;

    // σ 面：E_w[m(k̄)]、Var_w[m(k̄)]、sd_w(α)、sd_w(β)（一次遍历）
    let eMass = 0;
    let eMass2 = 0;
    let eAlpha = 0;
    let eAlpha2 = 0;
    let eBeta = 0;
    let eBeta2 = 0;
    for (let g = 0; g < grid.components.length; g++) {
      const w = grid.weights[g]!;
      const m = curveMass(grid.components[g]!.alpha, grid.components[g]!.beta, k);
      eMass += w * m;
      eMass2 += w * m * m;
      eAlpha += w * grid.components[g]!.alpha;
      eAlpha2 += w * grid.components[g]!.alpha ** 2;
      eBeta += w * grid.components[g]!.beta;
      eBeta2 += w * grid.components[g]!.beta ** 2;
    }
    const sigma = Math.sqrt(Math.max(0, eMass2 - eMass * eMass));

    // saturate / u：与 R18 逐字同义（检出后按饱和时标 1/β̂ 衰减；终判断流）
    const saturationFactor = alphaHat > 0 && betaHat > 0 ? Math.exp(-betaHat * kSat) : 1;
    const undecidedFactor: 0 | 1 = raw.decided ? 0 : 1;

    return {
      coefficient: this.config.baseCoefficient * sigma * saturationFactor * undecidedFactor,
      jointSigma: sigma,
      meanCurveMass: eMass,
      alphaPosteriorSd: Math.sqrt(Math.max(0, eAlpha2 - eAlpha * eAlpha)),
      betaPosteriorSd: Math.sqrt(Math.max(0, eBeta2 - eBeta * eBeta)),
      saturationFactor,
      undecidedFactor,
      componentCount: grid.components.length,
    };
  }
}

// ----------------------------------------------------------------------------
// 预算台账（确定性累加器：定理 J3 的机器核对面）
// ----------------------------------------------------------------------------

/**
 * 联合探索补贴台账：逐次记录反馈环产出。L_max/K_max 在流结束后由宿主
 * 申报（证书配置），台账保证「Σ e ≤ 2e₀√(L_max·K_max/e)·√entries」
 * 的对账恒可复核。
 */
export class JointExplorationBudgetLedger {
  private readonly config: JointExplorationConfig;
  private total = 0;
  private entries = 0;

  constructor(config: Partial<JointExplorationConfig> = {}) {
    this.config = { ...DEFAULT_JOINT_EXPLORATION_CONFIG, ...config };
    if (
      typeof this.config.baseCoefficient !== 'number' ||
      !Number.isFinite(this.config.baseCoefficient) ||
      this.config.baseCoefficient <= 0
    ) {
      throw new ConfigurationError(
        `JointExplorationConfig.baseCoefficient must be a finite positive number, got ${String(this.config.baseCoefficient)}`,
      );
    }
  }

  /** 记录一次系数产出（台账口径是求和恒等式，不校验其来源） */
  record(coefficient: number): void {
    if (typeof coefficient !== 'number' || !Number.isFinite(coefficient) || coefficient < 0) {
      throw new NumericDomainError(
        `JointExplorationBudgetLedger.record() coefficient must be a finite non-negative number, got ${String(coefficient)}`,
      );
    }
    this.total += coefficient;
    this.entries++;
  }

  /** 累计补贴 Σ e */
  totalSubsidy(): number {
    return this.total;
  }

  /** 已记录次数 */
  entryCount(): number {
    return this.entries;
  }

  /** 定理 J3 上界（对已记录次数；L/K 最大值由宿主申报） */
  bound(cert: Pick<JointBudgetCertificate, 'lipschitzMax' | 'componentCountMax'>): number {
    return jointBudgetBound(this.entries, { ...this.config, ...cert });
  }
}
