/**
 * EvidenceGatedExploration —— 证据门控的探索系数反馈环（R18-C 创新 2，opt-in）
 *
 * ============ 定位（既有探索项的盲日程缺陷，诚实边界） ============
 *
 * 平台全部既有探索加成都是**观测数的盲日程**（与证据状态无关的函数）：
 *   - CompoundBrain.growthValue：explore = exploreCoefficient/√(1+m)；
 *   - GrowthMarketScheduler/market-estimation：exploreBonus(n, pulls, e)；
 *   - BayesianHireBrain ucb1：e·√(2·ln(N+1)/(a+b))。
 * 它们对 n 衰减，但对「学习问题是否已经判定」**不响应**：校准一旦检出
 * （或否定）学习信号，继续为该能力支付探索加成是纯损耗——信息已经买
 * 到手了还在付钱。R14-C 设计稿的 e(α̂,β̂,k̄) 反馈环正是此缺口：系数
 * 应当由校准状态 (α̂, β̂)、平均资本 k̄ 与证据余量共同驱动。
 *
 * 本模块把反馈环做成**纯函数内核**（无随机、无时钟、无状态）：
 *
 *   e = e₀ · σ_post(n,s) · saturate(β̂, k̄) · u(decided)
 *
 *   1. σ_post：能力成功率的 Beta 后验标准差（先验 Beta(κ₀/2, κ₀/2)，
 *      与 bayesian-hire-brain 的凭证先验同族）。探索按「剩余不确定性」
 *      定价——后验收敛 ⟹ 系数自动衰减，且衰减率与估计精度同阶；
 *   2. saturate = e^{−β̂·k̄}：校准检出后，平均资本 k̄ 处的曲线敏感度按
 *      学习饱和时标 1/β̂ 衰减（k̄ ≫ 1/β̂ 的观测几乎不携带曲线形状信息
 *      ——compound-brain 校准注释实证：饱和后观测不再产生形状信息）；
 *   3. u = 1{未终判}：**序贯门终判即断流**——与 SprtCalibrationGate
 *      （R18-C 创新 1）的终判布尔对接，问题判定后探索恒为 0。
 *
 * ============ 精确主张（可证伪陈述） ============
 *
 * **定理 A（包络）** 任意输入下
 *     e ≤ e₀ · σBound(n)，σBound(n) = 1/(2·√(n+κ₀+1))，
 * 证明：Beta(a,b) 方差 = ab/(m²(m+1)) ≤ (m/2)²/(m²(m+1)) = 1/(4(m+1))
 * （a+b = m = n+κ₀，ab ≤ (m/2)²），saturate ≤ 1、u ≤ 1。∎
 *
 * **定理 B（总预算，望远镜求和证书）** 任意一段长度为 N 的未终判评估
 * （无论成败如何、k̄ 与校准如何变化），
 *     Σ e ≤ (e₀/2)·Σ_{n=n₀}^{n₀+N−1}(n+κ₀+1)^{−1/2} ≤ e₀·√(n₀+N+κ₀+1)，
 * 证明：逐项 (n+κ₀+1)^{−1/2} ≤ 2(√(n+κ₀+1) − √(n+κ₀))（[n−1,n] 上积分
 * 比较），求和望远镜化；首项 (κ₀+1)^{−1/2} ≤ 2√(κ₀+1)（κ₀ ≥ 0）合并
 * 进尾部。从冷启动（n₀=0）即 Σ e ≤ e₀·√(N+κ₀+1)。∎
 *
 * **定理 C（门控断流）** decided = true ⟹ e ≡ 0（逐位恒等，非近似）。
 * 与定理 B 合并：总探索预算被**判定时刻** N* 封顶——
 *     Σ_{全程} e ≤ e₀·√(N*+κ₀+1)，
 * 与盲日程（e₀/√(1+n) 直付到视界 T，总量 ~2e₀√T）相比，早判定流
 * （N* ≪ T）的节省因子 = √(T/N*)。盲日程**永远**付到 T。
 *
 * **定理 D（饱和乘法界）** 检出（α̂>0, β̂>0）时 factor = e^{−β̂·k̄}：
 * k̄ ≥ (ln 100)/β̂ ⟹ factor ≤ 0.01（k̄ ≥ (ln 10⁴)/β̂ ⟹ ≤ 1e−4）。
 *
 * ============ 诚实边界（不主张什么） ============
 *
 * - **不主张任何 regret/福利最优性**：定理是探索补贴的支付上界口径，
 *   不刻画探索-利用权衡的效率，也不与 Hedge portfolio（R17-D 的策略
 *   组合层）比较——层次不同：那是「选哪个策略」，这是「给探索付多少」。
 * - σ_post 是**能力成功率**的 Beta 后验 sd，不是学习曲线参数 (α̂,β̂)
 *   的后验 sd；「学习问题本身」的不确定性只经 decided 布尔（粗粒度）
 *   进入。把 (α,β) 的联合后验 sd 接进来是批 3 候选，不是本模块承诺。
 * - saturate 因子是启发式形状（正当性来自饱和区 Fisher 信息衰减），
 *   不承担定理——唯一的精确主张是定理 D 的乘法上界。
 * - 端到端效果（系数反过来改变分配、从而改变观测流）未经本模块测试：
 *   需要市场接线（编排者收口）。本模块的机证是系数层面的恒等式与
 *   预算不等式，以及在重放流上的行为钉板。
 * - 定理 B 的界对成败序列**最坏情形**成立（每一步都取包络上界）；
 *   实际流的 Σ e 通常远小于界（测试报告真实数值）。
 *
 * ============ 文献族（仅形状，〔待双源〕） ============
 *
 * - Wald-1947-Sequential Analysis（停止规则与期望样本量的经典框架）
 *   〔待双源〕
 * - Lattimore-Szepesvári-2020-Bandit Algorithms（探索加成的 UCB 形族
 *   与 1/√n 不确定度标度）〔待双源〕
 * - Howard-Ramdas-McAuliffe-Sekhon-2021-Time-uniform confidence
 *   sequences（anytime-valid 不确定度收缩面）〔待双源〕
 * - Howard-Ramdas-2022-Sequential estimation〔待双源〕
 *
 * ============ 确定性契约 ============
 *
 * 纯函数：同输入逐位同输出，无随机源、无时钟、无 IO。预算台账
 * （ExplorationBudgetLedger）只是逐次求和的确定性累加器。
 */

import { ConfigurationError, NumericDomainError } from '../utils/errors.js';

// ----------------------------------------------------------------------------
// 类型
// ----------------------------------------------------------------------------

export interface EvidenceGatedExplorationConfig {
  /** 基准探索系数 e₀ > 0（量级对齐平台 exploreCoefficient 缺省 0.5） */
  baseCoefficient: number;
  /** 先验权重 κ₀ ≥ 1（先验 Beta(κ₀/2, κ₀/2)；下界是定理 B 证书的入口条件） */
  priorWeight: number;
}

export const DEFAULT_EVIDENCE_GATED_EXPLORATION_CONFIG: EvidenceGatedExplorationConfig = {
  baseCoefficient: 0.5,
  priorWeight: 3,
};

/** 反馈环输入：观测计数 + 校准状态 + 序贯门终判布尔 */
export interface ExplorationFeedbackInputs {
  /** 已结算观测数 n ≥ 0 */
  attempts: number;
  /** 成功数 0 ≤ s ≤ n */
  successes: number;
  /** 校准幅度估计 α̂（未检出 = 0；compound-brain calibrations() 口径） */
  alphaHat: number;
  /** 校准速率估计 β̂（未检出 = 0） */
  betaHat: number;
  /** 平均资本 k̄ ≥ 0（saturate 因子在该资本处评估） */
  meanCapital: number;
  /** 序贯门是否已终判（SprtCalibrationGate.isTerminal() 的对接面） */
  decided: boolean;
}

/** 系数分解快照（审计面：三个因子的乘法结构逐项可核） */
export interface ExplorationCoefficient {
  /** 反馈环产出 e = e₀·σ·saturate·u */
  coefficient: number;
  /** Beta 后验标准差 σ_post */
  uncertaintySigma: number;
  /** 饱和因子 e^{−β̂·k̄}（未检出 = 1） */
  saturationFactor: number;
  /** 未终判因子 1{decided=false}（终判 = 0） */
  undecidedFactor: 0 | 1;
}

// ----------------------------------------------------------------------------
// 纯函数：包络与预算（定理 A/B 的使用面，可独立对拍）
// ----------------------------------------------------------------------------

/**
 * 定理 A 的包络上界 1/(2√(n+κ₀+1))。
 * Beta 后验 sd 的精确上界（ab ≤ (m/2)²），与成败序列无关。
 */
export function sigmaBound(attempts: number, priorWeight: number): number {
  assertAttempts(attempts);
  assertPriorWeight(priorWeight);
  return 1 / (2 * Math.sqrt(attempts + priorWeight + 1));
}

/**
 * 定理 B 的总预算上界 e₀·√(count+κ₀+1)：任意 count 次未终判评估的
 * 系数总和不超过此值（望远镜求和证书，见模块头证明）。
 */
export function explorationBudgetBound(
  count: number,
  config: Partial<EvidenceGatedExplorationConfig> = {},
): number {
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
    throw new ConfigurationError(
      `explorationBudgetBound() count must be a non-negative integer, got ${String(count)}`,
    );
  }
  const e0 = config.baseCoefficient ?? DEFAULT_EVIDENCE_GATED_EXPLORATION_CONFIG.baseCoefficient;
  const kappa = config.priorWeight ?? DEFAULT_EVIDENCE_GATED_EXPLORATION_CONFIG.priorWeight;
  assertBaseCoefficient(e0);
  assertPriorWeight(kappa);
  return e0 * Math.sqrt(count + kappa + 1);
}

function assertBaseCoefficient(value: number): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new ConfigurationError(
      `EvidenceGatedExplorationConfig.baseCoefficient must be a finite positive number, got ${String(value)}`,
    );
  }
}

function assertPriorWeight(value: number): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) {
    throw new ConfigurationError(
      `EvidenceGatedExplorationConfig.priorWeight must be a finite number ≥ 1, got ${String(value)}`,
    );
  }
}

function assertAttempts(value: number): void {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new NumericDomainError(`attempts must be a non-negative integer, got ${String(value)}`);
  }
}

// ----------------------------------------------------------------------------
// EvidenceGatedExploration（纯函数内核）
// ----------------------------------------------------------------------------

export class EvidenceGatedExploration {
  private readonly config: EvidenceGatedExplorationConfig;

  constructor(config: Partial<EvidenceGatedExplorationConfig> = {}) {
    const merged = { ...DEFAULT_EVIDENCE_GATED_EXPLORATION_CONFIG, ...config };
    assertBaseCoefficient(merged.baseCoefficient);
    assertPriorWeight(merged.priorWeight);
    this.config = merged;
  }

  /** 反馈环求值：e = e₀·σ_post·saturate·u（纯函数，逐因子审计见返回值） */
  coefficient(inputs: ExplorationFeedbackInputs): ExplorationCoefficient {
    const raw = inputs as {
      attempts?: unknown;
      successes?: unknown;
      alphaHat?: unknown;
      betaHat?: unknown;
      meanCapital?: unknown;
      decided?: unknown;
    } | null;
    if (raw === null || typeof raw !== 'object') {
      throw new NumericDomainError('ExplorationFeedbackInputs must be an object');
    }
    const n = raw.attempts;
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 0) {
      throw new NumericDomainError(
        `ExplorationFeedbackInputs.attempts must be a non-negative integer, got ${String(n)}`,
      );
    }
    const s = raw.successes;
    if (typeof s !== 'number' || !Number.isInteger(s) || s < 0 || s > n) {
      throw new NumericDomainError(
        `ExplorationFeedbackInputs.successes must be an integer within [0, attempts], got ${String(s)}`,
      );
    }
    const alphaHat = raw.alphaHat;
    if (typeof alphaHat !== 'number' || !Number.isFinite(alphaHat) || alphaHat < 0) {
      throw new NumericDomainError(
        `ExplorationFeedbackInputs.alphaHat must be a finite non-negative number, got ${String(alphaHat)}`,
      );
    }
    const betaHat = raw.betaHat;
    if (typeof betaHat !== 'number' || !Number.isFinite(betaHat) || betaHat < 0) {
      throw new NumericDomainError(
        `ExplorationFeedbackInputs.betaHat must be a finite non-negative number, got ${String(betaHat)}`,
      );
    }
    const kbar = raw.meanCapital;
    if (typeof kbar !== 'number' || !Number.isFinite(kbar) || kbar < 0) {
      throw new NumericDomainError(
        `ExplorationFeedbackInputs.meanCapital must be a finite non-negative number, got ${String(kbar)}`,
      );
    }
    if (typeof raw.decided !== 'boolean') {
      throw new NumericDomainError(
        `ExplorationFeedbackInputs.decided must be a boolean, got ${typeof raw.decided}`,
      );
    }

    // σ_post：先验 Beta(κ₀/2, κ₀/2) + (s 成功, n−s 失败) 的后验 sd
    const kappa = this.config.priorWeight;
    const a = kappa / 2 + s;
    const b = kappa / 2 + (n - s);
    const m = n + kappa;
    const sigma = Math.sqrt((a * b) / (m * m * (m + 1)));

    // saturate：未检出（α̂=0 或 β̂=0）恒 1（无饱和证据时不罚）；检出后按
    // 学习饱和时标 1/β̂ 衰减（定理 D 的乘法上界面）
    const saturationFactor = alphaHat > 0 && betaHat > 0 ? Math.exp(-betaHat * kbar) : 1;

    // u：终判即断流（定理 C 的恒等式面）
    const undecidedFactor: 0 | 1 = inputs.decided ? 0 : 1;

    return {
      coefficient: this.config.baseCoefficient * sigma * saturationFactor * undecidedFactor,
      uncertaintySigma: sigma,
      saturationFactor,
      undecidedFactor,
    };
  }
}

// ----------------------------------------------------------------------------
// 预算台账（确定性累加器：定理 B/C 的机器核对面）
// ----------------------------------------------------------------------------

/**
 * 探索补贴台账：逐次记录反馈环产出，暴露累计值与定理 B 的上界。
 * 累加器本身无策略——何时调用 coefficient 由宿主决定；台账只保证
 * 「已记录次数 × 包络」与「上界」的对账恒可复核。
 */
export class ExplorationBudgetLedger {
  private readonly config: EvidenceGatedExplorationConfig;
  private total = 0;
  private entries = 0;

  constructor(config: Partial<EvidenceGatedExplorationConfig> = {}) {
    this.config = { ...DEFAULT_EVIDENCE_GATED_EXPLORATION_CONFIG, ...config };
    assertBaseCoefficient(this.config.baseCoefficient);
    assertPriorWeight(this.config.priorWeight);
  }

  /** 记录一次系数产出（不校验其来源——台账口径是求和恒等式） */
  record(coefficient: number): void {
    if (typeof coefficient !== 'number' || !Number.isFinite(coefficient) || coefficient < 0) {
      throw new NumericDomainError(
        `ExplorationBudgetLedger.record() coefficient must be a finite non-negative number, got ${String(coefficient)}`,
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

  /** 定理 B 上界（对已记录次数）：Σ e ≤ e₀·√(entries+κ₀+1) */
  bound(): number {
    return explorationBudgetBound(this.entries, this.config);
  }
}
