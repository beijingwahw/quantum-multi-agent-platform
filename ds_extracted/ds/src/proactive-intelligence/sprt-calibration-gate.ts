/**
 * SprtCalibrationGate —— 混合似然比 SPRT 序贯校准门（R18-C 创新 1，opt-in）
 *
 * ============ 定位（与既有校准面的分工，诚实边界） ============
 *
 * CompoundBrain.calibrate 对结算流做**批式**判定：每次结算后全网格重拟合，
 * 用 deviance 双门限（进入 6 / 维持 1.2）＋滞回防振荡。它回答「现在检出
 * 了吗」，但从不回答两个序贯问题：
 *   1. **何时停**——没有停止规则：观测预算（observationCap）是唯一上界，
 *      每个新观测都全额支付校准/探索成本，即使学习问题早已可判定；
 *   2. **错了怎么办**——deviance 门限无逐次误差控制：同一能力反复进出
 *      检出状态时，「检出一族」的复合第一类误差没有可陈述的界。
 *
 * 本模块补的是这两块：对同一 Bernoulli 学习曲线族
 *     p(k) = base + α·(1−base)·(1−e^{−β·k})   （与 fitGrid 同一似然族）
 * 构造**混合序贯概率比检验**（mixture SPRT）：以稀疏网格分量的凸混合为
 * 复合备择，逐结算消费观测、维护运行对数似然比，越界即终判。它是纯决策
 * 内核：不分配任务、不改定价、不触任何既有文件——宿主（编排者收口或
 * 批 3）把它的终判接到校准/探索策略上。
 *
 * ============ 精确主张（可证伪陈述） ============
 *
 * 记 Λ_n = Π_{i≤n} p_mix,i(X_i) / p0,i(X_i)（混合似然比），阈值
 * A = (1−β)/α > 1 > B = β/(1−α)，其中 α = typeOne、β = typeTwo。
 * 停时 N = 首个 λ_n = ln Λ_n ≥ ln A（判 rejectNull：学习检出）、
 * λ_n ≤ ln B（判 acceptNull：混合备择被拒）或 n = maxObservations
 * （判 truncated：不决，**按不决处理而非并入任何错误**）。
 *
 * **定理 1（第一类误差，截断门，无近似）**
 * 设 (base_i, k_i) 为任意可料序列（每个都是过去观测的确定函数——
 * CompoundBrain 的分配恰好如此：base 取凭证、k 取分配前资本，都由历史
 * 决定），X_i 条件独立且 H0 下 X_i | F_{i−1} ~ Bernoulli(base_i)。则
 *     P_H0( 判 rejectNull ) ≤ 1/A = α/(1−β) ≤ α·(1+2β)  （β ≤ 1/2）。
 * 证明：λ 的每步增量有界（成功侧 ≤ ln(1+0.98·(1−b_min)/b_min)，失败侧
 * ≥ ln(0.02)，由分量 α ≤ αMax 保证），故 Λ_{n∧N} 一致有界；N ≤ maxN
 * 为有界停时，受限停时定理给出 E[Λ_N] = 1；在 rejectNull 上 Λ_N ≥ A，
 * 故 1 = E[Λ_N] ≥ P(reject)·A。∎
 * （截断**不**污染第一类误差：拒绝只经越上界发生。）
 *
 * **定理 2（分量第二类误差）**
 * 若真值为分量 g（X_i | F_{i−1} ~ Bernoulli(p_g(k_i))，p_g 为该分量
 * 曲线），w_g 为其混合权重，则
 *     P_g( 判 acceptNull ) ≤ B / w_g = β / ((1−α)·w_g)。
 * 证明：Λ̃ = p_g/p0 在真值 g 下为均值 1 鞅，其倒数 p0/p_g 亦然；在
 * acceptNull 上 Λ ≥ w_g·Λ̃ ≤ B 给 Λ̃ ≤ B/w_g，即倒数 ≥ w_g/B；对有界
 * 停时取期望得 1 ≥ P(accept)·w_g/B。∎
 * 推论（诚实披露）：界有意义当且仅当 K·β/(1−α) < 1（K = 分量数，
 * 均匀权重）；缺省 16 分量 × β=0.02 ⟹ 每分量界 = 16·0.0211 ≈ 0.337。
 * truncated 判定不在定理 2 内——不决不是错误，宿主可续跑或换门。
 *
 * **定理 3（期望停时，Wald 恒等式形）**
 * 记 c = 已实现最大单步 |增量|。若真值为 g 且每步 KL(p_g(k_i) ‖ base_i)
 * ≥ KL_min > ln(1/w_g) 一致成立，则 E_g[N] ≤ (ln A + c) / (KL_min − ln(1/w_g))；
 * 若 H0 下每步 KL(base_i ‖ p_mix,i) ≥ δ₀ > 0，则 E_0[N] ≤ (c − ln B)/δ₀。
 * （非独立同分布流：{N ≥ i} ∈ F_{i−1} 与 X_i 独立，Wald 恒等式逐项成立；
 * 对数 p_mix ≥ log w_g + log p_g 给出漂移下界。）
 *
 * **定理 4（Bonferroni 族控制）**
 * m 个门各以 (α_i, β_i) 运行、观测流互不相交，则真实零假设族中任一门
 * 判 rejectNull 的概率 ≤ Σ_{i∈I₀} α_i/(1−β_i) ≤ α_family/(1−β_max)
 * （等分 α_i = α_family/m 时）。纯 union bound，精确不等式。
 *
 * ============ 诚实边界（不主张什么） ============
 *
 * - 定理对**理想实数运算**的统计量成立；实现用 double 计算（确定性、
 *   可重放），浮点表示噪声不进入任何断言口径（测试以数值容差钉板）。
 * - 定理 1 的条件是「H0 真时 X_i | F_{i−1} ~ Bernoulli(base_i)」——
 *   base 是宿主声明值。base 被错报（凭证虚高）时界不成立（负对照演示）。
 * - 定理 2 只覆盖 acceptNull；truncated 是第三结局（不决），不承诺任何
 *   一侧的误差。maxObservations 过小时不决概率上升——这是设计取舍。
 * - 备择是**稀疏网格的凸混合**：真曲线不在网格上时，检出力由混合与真值
 *   的 KL 距离决定（对网格外真值不承诺检出概率下界）。
 * - 与 fitGrid 的 deviance 门限是**两套判定**：本门不替换 CompoundBrain
 *   的校准（那是编排者/批 3 的接线决策）；两判定的不一致不构成缺陷。
 * - 不主张任何福利/regret 意义的最优性——这是停止规则与误差控制层。
 *
 * ============ 文献族（仅形状，〔待双源〕） ============
 *
 * - Wald-1947-Sequential Analysis（专著；SPRT 原始界）〔待双源〕
 * - Wasserman-Ramdas-Balakrishnan-2020-Universal inference（混合似然比的
 *   anytime-valid 性质）〔待双源〕
 * - Howard-Ramdas-McAuliffe-Sekhon-2021-Time-uniform confidence sequences
 *   （序贯 anytime-valid 方法族）〔待双源〕
 * - Lai-2001-Sequential analysis some classical problems and new
 *   challenges（复合备择的序贯检验综述）〔待双源〕
 * - Page-1954-Continuous inspection schemes（相邻的连续检测线索 CUSUM）
 *   〔待双源〕
 *
 * ============ 确定性契约 ============
 *
 * 纯决策内核：无随机源、无时钟、无 IO、无模块级可变状态。同一观测序列
 * ⟹ 同一 λ 轨迹与终判，逐位可复现（k=0 的观测增量恰为 0——零资本观测
 * 不携带学习信息，是似然族的精确性质而非实现细节）。
 */

import { ConfigurationError, NumericDomainError, StateError } from '../utils/errors.js';

// ----------------------------------------------------------------------------
// 类型
// ----------------------------------------------------------------------------

/** 备择分量：学习曲线 (α, β) 与混合权重 */
export interface SprtComponent {
  /** 学习幅度 α ∈ (0, 0.98]（上界同 baseEstimate 的 0.98 钳制——保证 p_mix < 1 严格成立） */
  alpha: number;
  /** 学习速率 β > 0（有限） */
  beta: number;
  /** 混合权重 ∈ (0,1)；全体分量要么都给权重（和为 1）、要么都不给（均匀） */
  weight?: number;
}

/** 门配置 */
export interface SprtGateConfig {
  /** 第一类误差目标 α ∈ (0,1)（定理 1 的名义水平） */
  typeOne: number;
  /** 第二类误差目标 β ∈ (0,1)（定理 2 的名义水平；非真空界要求 K·β/(1−α) < 1） */
  typeTwo: number;
  /** 截断上界 N ≥ 1（到达即判 truncated：不决） */
  maxObservations: number;
  /** 备择分量集（非空） */
  components: readonly SprtComponent[];
}

/**
 * 缺省备择网格：α × β 各 4 档共 16 分量、均匀权重。覆盖真实 LLM 学习
 * 曲线量级（experiments 实证 β ∈ [0.03, 0.3]、平台仿真常用 α ∈ [0.2, 0.8]）；
 * 稀疏性是刻意的——定理 2 的界按 1/w_g = K 膨胀，网格越密备择越鲁棒、
 * 第二类界越松，16 是两端折中。
 */
export const DEFAULT_SPRT_COMPONENTS: readonly SprtComponent[] = [
  { alpha: 0.2, beta: 0.02 },
  { alpha: 0.2, beta: 0.05 },
  { alpha: 0.2, beta: 0.12 },
  { alpha: 0.2, beta: 0.3 },
  { alpha: 0.4, beta: 0.02 },
  { alpha: 0.4, beta: 0.05 },
  { alpha: 0.4, beta: 0.12 },
  { alpha: 0.4, beta: 0.3 },
  { alpha: 0.6, beta: 0.02 },
  { alpha: 0.6, beta: 0.05 },
  { alpha: 0.6, beta: 0.12 },
  { alpha: 0.6, beta: 0.3 },
  { alpha: 0.8, beta: 0.02 },
  { alpha: 0.8, beta: 0.05 },
  { alpha: 0.8, beta: 0.12 },
  { alpha: 0.8, beta: 0.3 },
];

export const DEFAULT_SPRT_GATE_CONFIG: SprtGateConfig = {
  typeOne: 0.05,
  // 16 分量均匀权重下非真空的第二类界要求 β < (1−α)/16 ≈ 0.0594；0.02 ⟹
  // 每分量界 = 16·0.02/0.95 ≈ 0.337（定理 2 的诚实数值）
  typeTwo: 0.02,
  maxObservations: 600,
  components: DEFAULT_SPRT_COMPONENTS,
};

/** 终判四态：continue 运行中；rejectNull 检出学习；acceptNull 拒绝混合备择；truncated 不决 */
export type SprtDecision = 'continue' | 'rejectNull' | 'acceptNull' | 'truncated';

/** 门状态快照（observe 返回值与 getState 口径一致） */
export interface SprtGateSnapshot {
  decision: SprtDecision;
  /** 已消费观测数 */
  observations: number;
  /** 运行对数似然比 λ_n（终判时刻即停止值） */
  logLikelihoodRatio: number;
  /** 上界 ln A = ln((1−β)/α) */
  logUpperBoundary: number;
  /** 下界 ln B = ln(β/(1−α))（负数） */
  logLowerBoundary: number;
  /** 已实现最大单步 |增量| c（定理 3 的过冲常数） */
  maxAbsIncrement: number;
  /** 逐分量第二类误差上界 B/w_g（分量序 = 构造序） */
  componentTypeTwoUpperBounds: readonly number[];
}

/** 分量 α 上界（钳制一致性与 p_mix < 1 的数值保证） */
const ALPHA_MAX = 0.98;
/** base 的数值域（成功侧增量有界性的入口保证） */
const BASE_MIN = 1e-6;
const BASE_MAX = 1 - 1e-6;

// ----------------------------------------------------------------------------
// 配置域校验（走私审判风格：非法值指名拒绝，undefined 保持缺省）
// ----------------------------------------------------------------------------

function validateProbability(name: string, value: number): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value >= 1) {
    throw new ConfigurationError(
      `SprtGateConfig.${name} must be within open interval (0, 1), got ${String(value)}`,
    );
  }
}

// ----------------------------------------------------------------------------
// SprtCalibrationGate
// ----------------------------------------------------------------------------

export class SprtCalibrationGate {
  private readonly typeOne: number;
  private readonly typeTwo: number;
  private readonly maxObservations: number;
  /** 归一化后的分量表（权重已解析为正数、和为 1） */
  private readonly components: ReadonlyArray<{ alpha: number; beta: number; weight: number }>;
  private readonly logUpper: number;
  private readonly logLower: number;

  private decision: SprtDecision = 'continue';
  private logLambda = 0;
  private observed = 0;
  private maxAbsIncrement = 0;

  constructor(config: Partial<SprtGateConfig> = {}) {
    const merged: SprtGateConfig = { ...DEFAULT_SPRT_GATE_CONFIG, ...config };
    validateProbability('typeOne', merged.typeOne);
    validateProbability('typeTwo', merged.typeTwo);
    if (
      typeof merged.maxObservations !== 'number' ||
      !Number.isInteger(merged.maxObservations) ||
      merged.maxObservations < 1
    ) {
      throw new ConfigurationError(
        `SprtGateConfig.maxObservations must be an integer ≥ 1, got ${String(merged.maxObservations)}`,
      );
    }
    if (!Array.isArray(merged.components) || merged.components.length === 0) {
      throw new ConfigurationError(
        'SprtGateConfig.components must be a non-empty array of mixture components',
      );
    }
    // 权重口径：要么全体显式、要么全体缺省（均匀）。部分显式会让隐式分量
    // 的权重语义两可（剩余质量均摊还是非法），指名拒绝。
    const raw = merged.components as ReadonlyArray<{
      alpha?: unknown;
      beta?: unknown;
      weight?: unknown;
    }>;
    const withWeight = raw.filter((c) => c.weight !== undefined);
    if (withWeight.length !== 0 && withWeight.length !== raw.length) {
      throw new ConfigurationError(
        'SprtGateConfig.components: either every component carries a weight or none does ' +
          '(mixed presence makes implicit weights ambiguous)',
      );
    }
    const uniform = 1 / raw.length;
    const resolved: Array<{ alpha: number; beta: number; weight: number }> = [];
    let weightSum = 0;
    raw.forEach((c, i) => {
      if (
        typeof c.alpha !== 'number' ||
        !Number.isFinite(c.alpha) ||
        c.alpha <= 0 ||
        c.alpha > ALPHA_MAX
      ) {
        throw new ConfigurationError(
          `SprtGateConfig.components[${i}].alpha must be within (0, ${ALPHA_MAX}], got ${String(c.alpha)}`,
        );
      }
      if (typeof c.beta !== 'number' || !Number.isFinite(c.beta) || c.beta <= 0) {
        throw new ConfigurationError(
          `SprtGateConfig.components[${i}].beta must be a finite positive number, got ${String(c.beta)}`,
        );
      }
      const weight = c.weight === undefined ? uniform : (c.weight as number);
      if (typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0) {
        throw new ConfigurationError(
          `SprtGateConfig.components[${i}].weight must be a finite positive number, got ${String(c.weight)}`,
        );
      }
      weightSum += weight;
      resolved.push({ alpha: c.alpha, beta: c.beta, weight });
    });
    if (withWeight.length !== 0 && Math.abs(weightSum - 1) > 1e-9) {
      throw new ConfigurationError(
        `SprtGateConfig.components weights must sum to 1 (within 1e-9), got ${weightSum}`,
      );
    }

    this.typeOne = merged.typeOne;
    this.typeTwo = merged.typeTwo;
    this.maxObservations = merged.maxObservations;
    this.components = resolved;
    this.logUpper = Math.log((1 - merged.typeTwo) / merged.typeOne);
    this.logLower = Math.log(merged.typeTwo / (1 - merged.typeOne));
  }

  /**
   * 混合质量 m̄(k) = Σ_g w_g·α_g·(1−e^{−β_g·k})。
   * 由此 p_mix = base + m̄·(1−base)，且 1−p_mix = (1−base)·(1−m̄)——
   * 成败两侧似然比可写成只依赖 m̄ 的精确形式（见 observe），数值上
   * 无除零、无 catastrophic cancellation。
   */
  private mixtureMass(k: number): number {
    let m = 0;
    for (const c of this.components) {
      m += c.weight * c.alpha * (1 - Math.exp(-c.beta * k));
    }
    // 精确值域 [0, Σw·α ≤ 0.98]；钳制仅防浮点表示噪声（数学上不可达界外）
    return Math.min(ALPHA_MAX, Math.max(0, m));
  }

  /**
   * 消费一次结算观测：(base, k, success)。增量：
   *   成功：ln(1 + m̄·(1−base)/base) ≥ 0
   *   失败：ln(1 − m̄) ≤ 0
   * k=0 ⟹ m̄=0 ⟹ 增量恰为 0（零资本观测零信息）。
   * 返回消费后的门快照；终判后再消费是调用方接线错误，指名拒绝。
   */
  observe(base: number, k: number, success: boolean): SprtGateSnapshot {
    if (this.decision !== 'continue') {
      throw new StateError(
        `SprtCalibrationGate is terminal ('${this.decision}') after ${this.observed} ` +
          'observations; late observations would silently corrupt the stopped statistic',
      );
    }
    if (typeof base !== 'number' || !Number.isFinite(base) || base < BASE_MIN || base > BASE_MAX) {
      throw new NumericDomainError(
        `SprtCalibrationGate.observe() base must be within [${BASE_MIN}, ${BASE_MAX}], got ${String(base)}`,
      );
    }
    if (typeof k !== 'number' || !Number.isFinite(k) || k < 0) {
      throw new NumericDomainError(
        `SprtCalibrationGate.observe() k must be a finite non-negative number, got ${String(k)}`,
      );
    }
    if (typeof success !== 'boolean') {
      throw new NumericDomainError(
        `SprtCalibrationGate.observe() success must be a boolean, got ${typeof success}`,
      );
    }

    const mbar = this.mixtureMass(k);
    const increment = success ? Math.log(1 + (mbar * (1 - base)) / base) : Math.log1p(-mbar);
    this.logLambda += increment;
    const absInc = Math.abs(increment);
    if (absInc > this.maxAbsIncrement) this.maxAbsIncrement = absInc;
    this.observed++;

    if (this.logLambda >= this.logUpper) this.decision = 'rejectNull';
    else if (this.logLambda <= this.logLower) this.decision = 'acceptNull';
    else if (this.observed >= this.maxObservations) this.decision = 'truncated';

    return this.getState();
  }

  /** 门快照（不含分量表本体；逐分量第二类界见 componentTypeTwoUpperBounds） */
  getState(): SprtGateSnapshot {
    const bOverW = this.typeTwo / (1 - this.typeOne);
    return {
      decision: this.decision,
      observations: this.observed,
      logLikelihoodRatio: this.logLambda,
      logUpperBoundary: this.logUpper,
      logLowerBoundary: this.logLower,
      maxAbsIncrement: this.maxAbsIncrement,
      componentTypeTwoUpperBounds: this.components.map((c) => bOverW / c.weight),
    };
  }

  /** 是否已终判（宿主的探索门控输入） */
  isTerminal(): boolean {
    return this.decision !== 'continue';
  }
}

// ----------------------------------------------------------------------------
// 族控制助手（定理 4 的使用面）
// ----------------------------------------------------------------------------

/**
 * Bonferroni 等分：族水平 α_family 均分给 m 个门，返回逐门 typeOne。
 * 配合 sprtTypeOneUpperBound 使用：族真实第一类误差 ≤
 * Σ_i sprtTypeOneUpperBound(α_i, β) = α_family/(1−β)（等 β 时）。
 */
export function bonferroniTypeOne(familyLevel: number, gates: number): number {
  if (
    typeof familyLevel !== 'number' ||
    !Number.isFinite(familyLevel) ||
    familyLevel <= 0 ||
    familyLevel >= 1
  ) {
    throw new ConfigurationError(
      `bonferroniTypeOne() familyLevel must be within (0, 1), got ${String(familyLevel)}`,
    );
  }
  if (typeof gates !== 'number' || !Number.isInteger(gates) || gates < 1) {
    throw new ConfigurationError(
      `bonferroniTypeOne() gates must be an integer ≥ 1, got ${String(gates)}`,
    );
  }
  return familyLevel / gates;
}

/** 定理 1 的第一类误差上界 α/(1−β)（宿主汇报口径） */
export function sprtTypeOneUpperBound(typeOne: number, typeTwo: number): number {
  validateProbability('typeOne', typeOne);
  validateProbability('typeTwo', typeTwo);
  return typeOne / (1 - typeTwo);
}
