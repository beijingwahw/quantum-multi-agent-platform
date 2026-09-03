/**
 * CompoundBrain —— 增长复利大脑
 *
 * 世界观：多 Agent 平台不是「把任务发给谁」的调度器，而是一个
 * 管理智力资本组合的投资机构。每个任务的分配同时是两笔决策：
 *   1. 消费决策：谁现在做得最好（当期净价值 v·q̂ − b）；
 *   2. 投资决策：谁值得再积累一单位上下文资本（增长影子价值 g）。
 * 静态批量 VCG 只做 1；CompoundBrain 把 2 写进配置目标本身。
 *
 * ============ 定理（DSIC 保持的增长投资） ============
 *
 * 分配规则（容量约束 WDP，自由处置）：
 *    X* = argmax_X  Σ_{(j,i)∈X} [ v_j·q̂_i(c_j) − b_i ]  +  Σ_{(j,i)∈X} g_i(c_j)
 * 支付（Clarke pivot，对增广福利 W 计价）：
 *    p_i = b_i·k_i + ( W* − W*_{−i} )
 *
 * 关键条件：q̂（含校准学习曲线）与 g（增长影子价值 + 探索期权）都只是
 * 「历史结算 + 公开凭证」的函数——与当批报价 b 无关。
 * 证明（Myerson 型）：机制是仿射最大化器 Σ公共项(X) − Σ b_i·k_i(X)，
 * 公共项对报价独立；如实报价时代理人效用 = W*(真成本) − W*_{−i}，
 * 恰为标准 VCG 效用，虚报不可能改进。∎
 *
 * 经济含义：平台通过目标函数为学习付费（g 项抬高低资本 agent 的配置边际），
 * 而不是通过支付补贴——支付仍是激励相容的 pivot，投资全部发生在
 * 配置边际上。破解「探索必然破坏激励相容」的定式：
 * 探索价值若只依赖公开历史，则与 DSIC 完全正交。
 *
 * ============ 增长影子价值 g 的构造（全部公开量） ============
 *
 *    g_i(c) = v̄_c · [ Q̂_i(c, k_i+H) − Q̂_i(c, k_i) ] · share_i(c) + e_c/√(1+n_i(c)) ]
 *    Q̂_i(c, k+H) − Q̂_i(c, k)：视野累计增益——再积累 H 单位资本的
 *    级数和 Σ_{j<H} dq(k+j) = α(1−base)e^{−βk}(1−e^{−βH})，天然有界
 *    （≤ α(1−base)）。注意不能用边际形式 dq·H：dq 按 e^{−βk} 衰减，
 *    dq·H 高估 βH 倍（H≫1/β 时一个量级），产生野值补贴。
 *
 * - H：剩余视野（该能力预计还要来多少任务）；
 * - share_i：max(历史分派份额 EWMA, 孵化底线 1/(n(1+β̂k)))——资本只有
 *   会被继续使用才有价值。纯 EWMA 会自我强化锁定（在位者 share≈1
 *   补贴微小 dq，挑战者 share≈0 被饿死）；孵化底线给潜力股孵化通道，
 *   且按学习饱和时标衰减保证 bounded damage。注意：闭式相变定律
 *   （K_min/δ_max）不能进入该定价项——孵化可行性含 agent 自身报价，
 *   会破坏 DSIC（见 growthValue 注释）——定律仅作为 advise() 的
 *   信息层输出：「理论做顾问，不定价」；
 * - 探索项：低尝试数 agent 的期权价值，同时是校准的信息引擎
 *   （学习曲线拟合需要低资本观测流，见 growthValue 注释）。
 *
 * ============ 在线校准（理论→机制闭环） ============
 *
 * 每能力用结算流拟合归一化学习曲线 ŝ = (q−base)/(1−base) = α(1−e^{−βk})，
 * 得到 (α̂, β̂, R²)。观测不足时 α̂←0（保守：宁可错失增长，不可虚投）。
 * 校准参数直接驱动 g 与相变定律顾问 advise()——
 * 培训/雇佣的闭式定律（K_min、δ_max、β_min）从论文表格变成实时仪表盘。
 *
 * ============ 诚实的边界 ============
 *
 * - 每批 DSIC 精确成立；跨批动态 DSIC 不保证（share EWMA 由历史分配
 *   决定，理论上存在跨批策略空间）——与增长市场调度器的探索项同款 caveat。
 * - g 的份额加权是保守近似：低估「投资成功后份额跃迁」的期权价值。
 * - 预算：支付含投资成分（可超当期福利），现金流敏感场景应配合
 *   BatchVCGScheduler 的 μ-VCG/BudgetPacer 使用。
 */

import { EventEmitter } from 'events';
import type { FlowEdgeRef } from './min-cost-flow';
import { MinCostFlow } from './min-cost-flow';
import { MechanismError } from '../utils/errors';
import { Mulberry32 } from '../utils/rng';

// ----------------------------------------------------------------------------
// 类型
// ----------------------------------------------------------------------------

export interface CompoundAgentSpec {
  id: string;
  capabilities: string[];
  /** 私有：真实单位成本（报价默认等于它；实验可用 misreport 覆盖） */
  trueCost: number;
  /** 私有：各能力基础质量真相（仅 simulate 结算抽样用，机制不可见） */
  trueQuality: Record<string, number>;
  /** 公开：各能力凭证质量（先验）。缺省 = trueQuality（实验中凭证诚实） */
  credentialQuality?: Record<string, number>;
  capacity?: number;
}

export interface CompoundTaskSpec {
  capability: string;
  /** 平台对该任务的成功估值（公开） */
  value: number;
}

export interface CompoundConfig {
  /** 剩余视野：每能力预计未来的任务数（增长价值的复利基数） */
  growthHorizon: number;
  /** 增长折损 γ∈[0,1]：0 = 退化为静态批量 VCG（对照臂） */
  growthDiscount: number;
  /** 探索期权系数 e_c（按任务价值比例）。校准的信息引擎：保证低资本观测流不断流——学习曲线检出时机是孵化投资盈亏的分水岭（实证：早检出 seed +43，晚检出 seed −48）。对高成本 agent 的误导路由由 gap 自限（explore < gap 时不再路由） */
  exploreCoefficient: number;
  /** 份额 EWMA 平滑系数 */
  shareAlpha: number;
  /** 凭证先验权重（Bayesian 收缩） */
  priorWeight: number;
  /** 触发校准的最少结算观测数（之前 α̂=0）。χ² 门限守卫误报，样本量要求可较低以提前检出（检出时机 = 孵化窗口） */
  minCalibrationAttempts: number;
  /** 默认任务价值（单任务入口 submitTask 用） */
  defaultTaskValue: number;
  /** 模拟专用：真实学习参数（机制不可见） */
  simAlpha: number;
  simBeta: number;
  /** 模拟专用：随机种子 */
  seed: number;
}

export const DEFAULT_COMPOUND_CONFIG: CompoundConfig = {
  growthHorizon: 60,
  growthDiscount: 1,
  exploreCoefficient: 0.5,
  shareAlpha: 0.1,
  priorWeight: 3,
  minCalibrationAttempts: 10,
  defaultTaskValue: 10,
  simAlpha: 0,
  simBeta: 0,
  seed: 42,
};

export interface CompoundAssignment {
  taskId: string;
  agentId: string;
  capability: string;
  payment: number;
  taskValue: number;
  estQuality: number;
  growthValue: number;
}

export interface CompoundAllocation {
  assignments: CompoundAssignment[];
  /** 各 agent 支付总额 */
  payments: Record<string, number>;
  totalPayment: number;
  /** 增广福利 W*（含增长项） */
  welfareAugmented: number;
  /** 当期福利（不含增长项，投资机会成本的账面口径） */
  welfareCurrent: number;
  /** 本批增长投资总额 Σ g·k */
  growthInvestment: number;
  droppedTasks: number;
}

export interface Settlement {
  taskId: string;
  agentId: string;
  capability: string;
  success: boolean;
  /** 结算时该 agent 在该能力上的资本（分配前口径） */
  capitalAtAssignment: number;
}

export interface CalibrationReport {
  capability: string;
  alphaHat: number;
  betaHat: number;
  r2: number;
  attempts: number;
  learnable: boolean;
}

export interface IncubationAdvice {
  agentId: string;
  capital: number;
  base: number;
  qNow: number;
  qHorizon: number;
  /** 反超最佳替代者所需的最小资本（闭式 K_min；null = 投资不可行） */
  kMin: number | null;
  /** 该 agent 可承受的最高凭证劣势（闭式 δ_max） */
  deltaMax: number;
}

export interface CapabilityAdvice {
  capability: string;
  calibration: CalibrationReport;
  incubations: IncubationAdvice[];
}

// ----------------------------------------------------------------------------
// 相变定律（闭式；与 experiments/train-vs-hire-phase/scaling-law.ts 同源）
// ----------------------------------------------------------------------------

function geometricSum(beta: number, T: number): number {
  if (beta < 1e-12) return T;
  return (1 - Math.exp(-beta * T)) / (1 - Math.exp(-beta));
}

/** L3：反超凭证劣势 δ 所需的最小孵化资本；不可行返回 null */
export function lawKMin(
  q0: number,
  delta: number,
  alpha: number,
  beta: number,
  T: number,
): number | null {
  if (delta <= 0) return 0;
  if (alpha <= 0 || beta <= 0) return null;
  const S = geometricSum(beta, T);
  const need = delta * (1 + ((1 - alpha) * T) / (alpha * S));
  const frac = need / (1 - q0);
  if (frac >= 1) return null;
  return -Math.log(1 - frac) / beta;
}

/** L4：资本 K 的在位者可承受的最高凭证劣势 */
export function lawDeltaMax(q0: number, K: number, alpha: number, beta: number, T: number): number {
  const S = geometricSum(beta, T);
  const cap = (1 - q0) * (1 - Math.exp(-beta * K));
  return (alpha * cap * S) / ((1 - alpha) * T + alpha * S);
}

// ----------------------------------------------------------------------------
// CompoundBrain
// ----------------------------------------------------------------------------

interface AgentState {
  spec: CompoundAgentSpec;
  bid: number;
  capacity: number;
  capital: Map<string, number>;
  attempts: Map<string, number>;
  successes: Map<string, number>;
  /** 逐观测历史（per 能力）：曲线调整基准估计用（公开量） */
  obsHistory: Map<string, Array<{ k: number; success: boolean }>>;
}

interface CurveComponent {
  alpha: number;
  beta: number;
  weight: number;
}

interface CapabilityState {
  /** 校准观测：{base, k, success}（base = 观测时点的估计基础质量） */
  observations: Array<{ base: number; k: number; success: boolean }>;
  valueEwma: number | null;
  /** 分派份额 EWMA（agentId → 份额） */
  shareEwma: Map<string, number>;
  alphaHat: number;
  betaHat: number;
  r2: number;
  /**
   * 后验混合曲线（定价口径）。门限未通过时为空（严格 null 模型）；
   * 通过时含 α=0 分量——barely 检出时 null 占主导，证据积累后学习
   * 分量权重上升：软门限取代人工置信收缩。
   */
  mixture: CurveComponent[];
}

export class CompoundBrain extends EventEmitter {
  private readonly config: CompoundConfig;
  private readonly agents = new Map<string, AgentState>();
  private readonly caps = new Map<string, CapabilityState>();
  private readonly pending = new Map<
    string,
    { agentId: string; capability: string; kBefore: number; taskValue: number; trueCost: number }
  >();
  private taskSeq = 0;
  private readonly rngSource: Mulberry32;
  /** 已实现福利累计（结算时按成败与真实成本入账；getState.netWelfare 口径） */
  private netWelfareSum = 0;

  constructor(config: Partial<CompoundConfig> = {}) {
    super();
    this.config = { ...DEFAULT_COMPOUND_CONFIG, ...config };
    this.rngSource = new Mulberry32(this.config.seed);
  }

  // ---------- 注册与报价 ----------

  registerAgent(spec: CompoundAgentSpec, bid?: number): this {
    // 重复id静默覆盖会清空该agent的资本/尝试计数，而 caps.observations
    // 仍保留其历史——状态撕裂。重复注册是调用方bug，应立即暴露
    if (this.agents.has(spec.id)) {
      throw new MechanismError(
        `CompoundBrain: agent '${spec.id}' is already registered (re-registration would wipe its learning capital)`,
      );
    }
    this.agents.set(spec.id, {
      spec,
      bid: bid ?? spec.trueCost,
      capacity: spec.capacity ?? 1,
      capital: new Map(),
      attempts: new Map(),
      successes: new Map(),
      obsHistory: new Map(),
    });
    for (const c of spec.capabilities) {
      if (!this.caps.has(c)) {
        this.caps.set(c, {
          observations: [],
          valueEwma: null,
          shareEwma: new Map(),
          alphaHat: 0,
          betaHat: 0,
          r2: 0,
          mixture: [],
        });
      }
    }
    return this;
  }

  /** 实验用：虚报成本（DSIC 检验） */
  misreport(agentId: string, bid: number): void {
    const a = this.agents.get(agentId);
    if (a) a.bid = bid;
  }

  // ---------- 公开估计（与报价无关——DSIC 定理的前提） ----------

  /**
   * agent 在能力 c 上的基础质量估计：凭证先验 × 观测收缩（null 模型：q = base）。
   * 凭证锚定同 qHat：小样本时观测均值是纯噪声（1-2 次 Bernoulli 失败
   * 曾把估计毒化到 0.30/0.38，饿死挑战者），λ = n/(n+10) 插值锚定。
   */
  private baseEstimate(a: AgentState, c: string): number {
    const cred = a.spec.credentialQuality?.[c] ?? a.spec.trueQuality[c] ?? 0.5;
    const n = a.attempts.get(c) ?? 0;
    const s = a.successes.get(c) ?? 0;
    const w = this.config.priorWeight;
    const raw = (w * cred + s) / (w + n);
    const lambda = n / (n + 10);
    return Math.min(0.98, Math.max(0.02, cred + lambda * (raw - cred)));
  }

  /**
   * 后验混合曲线在资本 k 处的（归一化）学习水平：
   *    mixValue(k) = Σ_g w_g · α_g · (1 − e^{−β_g k})
   * 定价用后验均值而非点估计：(α, β) 在小样本下不可辨识（β̂ 在网格
   * 边界 0.50 与 0.03-0.08 间跳变，振幅被系统性低估一半——实证 seed 44：
   * α̂(1−base)=0.19 vs 真值 0.375），点估计外推产生幻想与振荡。混合
   * 定价天然对冲：慢曲线保持 Δq 尾部、快曲线限制早期幅度，且含 α=0
   * 分量——barely 检出时自动向 null 收缩（软门限，取代人工 n/(n+20)）。
   */
  private mixValue(c: string, k: number): number {
    const cs = this.caps.get(c);
    if (!cs || cs.mixture.length === 0) return 0;
    let v = 0;
    for (const g of cs.mixture) v += g.weight * g.alpha * (1 - Math.exp(-g.beta * k));
    return v;
  }

  /**
   * 校准曲线上的质量估计（消除双重计数）。
   *
   * 双重计数陷阱：朴素构造 q̂ = baseEstimate + curve(k) 中，baseEstimate
   * 是观测成功率的 Bayesian 收缩——观测已包含学习水平，再叠加完整曲线
   * 会重复计入，q̂ 系统性高估。一致估计：从每个观测中先减去该时点的
   * 曲线增益（混合曲线口径），再对残差做 Bayesian 收缩得到 base_adj。
   * 在真实模型下 E[残差] = base（无偏），q̂ = base_adj + curve(k) 一致。
   * 未检出（mixture 空）时退化为 null 模型的 baseEstimate。
   *
   * 凭证锚定：校准模型中 base 是已知 nuisance（凭证），base_adj 的残差
   * 重估在 m 小时是纯噪声——2 次 Bernoulli 失败把 base 毒化到 0.30
   * （真值 0.5，实证 seed 33：trainee 被饿死 48 批）。置信插值
   * base = cred + λ·(baseRaw − cred)，λ = m/(m+10)：小样本锚定凭证，
   * 证据积累后收敛到残差一致估计。
   */
  private qHat(a: AgentState, c: string, k: number): number {
    const cs = this.caps.get(c);
    if (!cs || cs.mixture.length === 0) return this.baseEstimate(a, c);
    const cred = a.spec.credentialQuality?.[c] ?? a.spec.trueQuality[c] ?? 0.5;
    const hist = a.obsHistory.get(c) ?? [];
    const w = this.config.priorWeight;
    let num = w * cred;
    for (const o of hist) {
      const gain = (1 - cred) * this.mixValue(c, o.k);
      num += (o.success ? 1 : 0) - gain;
    }
    const m = hist.length;
    const baseRaw = num / (w + m);
    const lambda = m / (m + 10);
    const base = Math.min(0.98, Math.max(0.02, cred + lambda * (baseRaw - cred)));
    return base + (1 - base) * this.mixValue(c, k);
  }

  /**
   * 增长影子价值 g（公开量的函数：资本、份额、校准、探索计数）。
   *
   * 视野累计增益 Δq = q̂(k+H) − q̂(k)：再积累 H 单位资本的累计质量增益。
   * 为什么不能用边际形式 dq·H：dq(k) = α(1−base)βe^{−βk} 本身按 e^{−βk}
   * 衰减，dq·H 假设边际增益在整个视野持续，高估因子 ≈ βH（H=80、β=0.12
   * 时 10 倍——实证：校准检出瞬间 g_t=16.8 的野值补贴，昂贵潜力股场景
   * 亏损 49.5）。正确级数和 Σ_{j<H} dq(k+j) = Δq(k,k+H) = α(1−base)e^{−βk}
   * ·(1−e^{−βH}) ≤ α(1−base) 天然有界。
   *
   * (1−base) 因子自带冷启动自愈：早期失败压低 base → 学习余量 (1−base)
   * 变大 → Δq 补偿上升——单次 Bernoulli 失败不再饿死挑战者（旧形式下
   * q̂ 崩到 0.375 后 15 批无法翻身，实证 seed 11）。
   *
   * 份额 = max(历史分派 EWMA, 孵化底线)。纯 EWMA 有自我强化锁定缺陷：
   * 在位者 share≈1 获得巨额补贴，挑战者 share≈0 被饿死。孵化底线
   * 1/(n·(1+β̂k)) 修复之：底线在先验 1/n 起步（任何有学习余量的 agent
   * 都值得孵化尝试），随资本按学习饱和时标 1/β̂ 衰减——Δq 本身也按
   * e^{−β̂k} 衰减，双重衰减保证对不可投资 agent 的补贴损失有界。
   *
   * 为什么相变定律（lawKMin）不能进这里的定价：孵化可行性本质上依赖
   * 净价值比较，含 agent 自身报价 b_i——g 一旦依赖 b_i，仿射最大化器
   * 证明失效（低报可打开「孵化门」换取增长补贴），DSIC 破坏。事实上
   * 可证明 g 必须与全部报价无关（对 j≠i 的 DSIC 要求 g_j 不依赖 b_i，
   * 对 j 自身要求 g_j 不依赖 b_j）。因此 bid-free 的 g 在「公开信息
   * 不可区分」的两个场景（便宜潜力股 vs 昂贵潜力股）中必然行为相同
   * ——对后者适度亏损投资是 DSIC 约束下的结构性代价，由 Δq 与底线的
   * 双重衰减兜底（昂贵场景缺口 ~4，g 包络在 k≈3 处降至缺口以下）。
   * 闭式定律只存在于 advise()（信息层，不参与定价）。
   *
   * 探索项不只是利用-探索权衡，更是校准的信息引擎：学习曲线拟合需要
   * 低资本（k 小）观测流，赢家通吃的流在 k~1/β 后不再产生形状信息
   * （实证：单流 150 观测检出率 5/20，双 agent 交错流 27/30）。
   *
   * γ 门控整体 g（含探索）：探索是信息投资，属于增长预算的一部分——
   * γ=0 时 g≡0，机制严格退化为静态批量 VCG（对照臂纯净性）。
   */
  private growthValue(a: AgentState, c: string): number {
    const cs = this.caps.get(c);
    if (!cs) return 0;
    if (this.config.growthDiscount <= 0) return 0;
    const vBar = cs.valueEwma ?? this.config.defaultTaskValue;
    const k = a.capital.get(c) ?? 0;
    const dQ = this.qHat(a, c, k + this.config.growthHorizon) - this.qHat(a, c, k);
    const capable = [...this.agents.values()].filter((x) => x.spec.capabilities.includes(c));
    const n = capable.length;
    if (n === 0) return 0;
    // 孵化底线：按学习饱和时标 1/β̂ 随资本衰减（未校准 β̂=0 时底线不衰减，
    // 但此时 Δq=0，无副作用）
    const floorShare = 1 / (n * (1 + cs.betaHat * k));
    const share = Math.max(cs.shareEwma.get(a.spec.id) ?? 1 / n, floorShare);
    const m = a.attempts.get(c) ?? 0;
    const explore = this.config.exploreCoefficient / Math.sqrt(1 + m);
    return vBar * this.config.growthDiscount * (dQ * share + explore);
  }

  // ---------- 校准 ----------

  /**
   * 网格 Bernoulli 极大似然拟合：x ∈ {0,1}（成败），
   * p(k) = base + α(1−base)(1−e^{−βk})，base = 时不变凭证基准
   * （per-agent 已知 nuisance）。
   *
   * 为什么用精确对数似然而非高斯 SSE 近似：SSE 口径需要 σ̂²——
   * 实证中 σ̂² 从 null 残差估计（sseNull/(n−1)），把学习信号本身
   * 当噪声计入，σ̂² 系统性膨胀（可学习场景下 mixture 覆盖全部 2091 个
   * 网格点，mixValue 收缩到均匀网格平均≈0.25，学习水平被腰斩——
   * 实证 seed 33：q̂(k=16)=0.69 vs 真值 0.82，trainee 恰在收获期
   * 被饿死）。Bernoulli 似然无需方差估计：
   *    ll = Σ [x·ln p + (1−x)·ln(1−p)]
   * 这是指数族精确似然，小样本下给出最优推断；deviance
   * D = 2(ll_max − ll_0) 在 null 下近似 χ²(2)（2 个自由参数），
   * 检测门限有精确分布理论支撑。
   *
   * 为什么拟合原始单位而非归一化 ŝ=(x−base)/(1−base)：归一化把
   * Bernoulli 噪声按 1/(1−base) 放大（base=0.98 时失败观测 ŝ=−49）。
   *
   * 返回最优拟合、null 对数似然与后验混合分量：
   * w_g ∝ exp(ll_g − ll_max)，仅含「自身通过学习门限」的分量——
   * 2(ll_g − ll₀) ≥ 1.2（与 calibrate 的维持门限一致）。
   * 门限与定价必须自洽：deviance 门限是「拒绝 α=0」的假设检验，
   * 若定价混合再纳入 null/近-null 分量，等于检验后又把被拒绝的
   * 假设请回来——双重收缩把学习水平腰斩（实证 seed 33：混合覆盖
   * 全部 2091 网格点，mv(7)≈0.19 vs 幸存分量均值≈0.45，trainee
   * 恰在收获期被饿死）。定价 = 幸存假设上的后验，推断才是自洽的。
   * 附加截断：ll_max − ll_g > ln(200)（似然比 < 1/200）的分量丢弃。
   *
   * β 网格 [0.001, 0.5]：β→∞ 是曲线的不可识别退化方向（阶跃函数），
   * 且真实 LLM 学习曲线 β∈[0.03, 0.3] 量级——超出即小样本过拟合。
   */
  private fitGrid(obs: Array<{ base: number; k: number; success: boolean }>): {
    best: { alpha: number; beta: number; ll: number };
    llNull: number;
    mixture: CurveComponent[];
  } {
    let best = { alpha: 0, beta: 0, ll: -Infinity };
    const llGrid: number[] = [];
    const logTerm = (p: number, x: number): number => {
      const q = Math.min(1 - 1e-6, Math.max(1e-6, p));
      return x > 0.5 ? Math.log(q) : Math.log(1 - q);
    };
    for (let ai = 0; ai <= 50; ai++) {
      const alpha = ai / 50;
      for (let bi = 0; bi <= 40; bi++) {
        const beta = Math.pow(10, -3 + (bi * 2.7) / 40);
        let ll = 0;
        for (const o of obs) {
          const p = o.base + alpha * (1 - o.base) * (1 - Math.exp(-beta * o.k));
          ll += logTerm(p, o.success ? 1 : 0);
        }
        llGrid.push(ll);
        if (ll > best.ll + 1e-12) best = { alpha, beta, ll };
      }
    }
    // null 对数似然（α=0，p = base 精确值，与 β 无关）
    let llNull = 0;
    for (const o of obs) {
      llNull += logTerm(o.base, o.success ? 1 : 0);
    }
    // 后验混合：仅纳入自身通过学习门限（2(ll_g − ll₀) ≥ 1.2，与
    // calibrate 维持门限一致）的分量
    const cutoff = best.ll - Math.log(200);
    const mixture: CurveComponent[] = [];
    let wSum = 0;
    let idx = 0;
    for (let ai = 0; ai <= 50; ai++) {
      const alpha = ai / 50;
      for (let bi = 0; bi <= 40; bi++) {
        const ll = llGrid[idx++]!;
        if (ll < cutoff) continue;
        if (2 * (ll - llNull) < 1.2) continue;
        const weight = Math.exp(ll - best.ll);
        const beta = Math.pow(10, -3 + (bi * 2.7) / 40);
        mixture.push({ alpha, beta, weight });
        wSum += weight;
      }
    }
    for (const g of mixture) g.weight /= wSum;
    return { best, llNull, mixture };
  }

  /**
   * 重拟合某能力的 (α̂, β̂)。
   * 估计器：Bernoulli 极大似然 + deviance 显著性门限。
   *   - null 模型：无学习（q = 凭证基准），ll₀；
   *   - D = 2(ll_max − ll₀) 在 null 下近似 χ²(2)（Wilks）；
   *   - D 超过门限才接受学习信号。
   *
   * 滞回门限：进入 6（χ²(2) 上尾 ≈ 5%），维持 1.2。
   * 维持门限必须显著低于进入门限：检出后新的失败观测会同时伤害
   * 曲线似然、帮助 null（失败在 p=0.5 下比 p=0.65 下更可能），
   * deviance 单调下降直至击穿——实证 seed 33：b=25 检出 → b=26-30
   * trainee 获任务 → 2 次失败把 deviance 拖回 2.5 以下 → b=35 丢失
   * 检测 → 饿死 10 批 → b=45 再检出已无回收窗口。粘滞的维持门限
   * 是序贯检测的标准防振荡手段；误报防护主要由进入门限承担。
   * 门限经 20 seed × 150 批不可学习 regime 实证校准。
   *
   * 为什么不用分箱：学习在 k ~ 1/β 处饱和（β=0.15 → k≈20），而资本可
   * 累积到上百——k 等宽分箱把整个学习瞬态压进第一个箱，信号被摧毁。
   *
   * 保守哲学：宁可错失增长，不可虚投。中等信号的漏检是真实的信息论
   * 极限（饱和后观测不携带形状信息）。
   */
  private calibrate(c: string): void {
    const cs = this.caps.get(c)!;
    const obs = cs.observations;
    if (obs.length < this.config.minCalibrationAttempts) {
      cs.alphaHat = 0;
      cs.betaHat = 0;
      cs.r2 = 0;
      cs.mixture = [];
      return;
    }

    const { best, llNull, mixture } = this.fitGrid(obs);
    const deviance = 2 * (best.ll - llNull);
    const wasDetected = cs.alphaHat > 0;
    const threshold = wasDetected ? 1.2 : 6;
    if (deviance <= threshold) {
      cs.alphaHat = 0;
      cs.betaHat = 0;
      cs.r2 = 0;
      cs.mixture = [];
      return;
    }
    cs.alphaHat = best.alpha;
    cs.betaHat = best.beta;
    // McFadden 伪 R²：1 − ll/ll₀（两者皆负，比值无量纲）
    cs.r2 = llNull < 0 ? Math.max(0, Math.min(1, 1 - best.ll / llNull)) : 0;
    cs.mixture = mixture;
  }

  // ---------- 核心：批量分配（增长增广 WDP + Clarke pivot） ----------

  /**
   * 求解增广 WDP。excludedAgentId ≠ null 时排除该 agent（重解 W*_{−i}）。
   * 返回 { W, assignmentEdges }（assignmentEdges 仅在完整求解时填充）。
   */
  private solveWDP(
    tasks: CompoundTaskSpec[],
    excludedAgentId: string | null,
  ): {
    W: number;
    edges: Array<{ taskIdx: number; agentId: string; edge: FlowEdgeRef; vQ: number; g: number }>;
  } {
    const agentList = [...this.agents.values()].filter((a) => a.spec.id !== excludedAgentId);
    const agentIdx = new Map(agentList.map((a, i) => [a.spec.id, i]));
    const S = 0;
    const taskBase = 1;
    const agentBase = taskBase + tasks.length;
    const T = agentBase + agentList.length;
    const mcf = new MinCostFlow(T + 1);

    for (let j = 0; j < tasks.length; j++) {
      mcf.addEdge(S, taskBase + j, 1, 0);
      mcf.addEdge(taskBase + j, T, 1, 0); // 自由处置：允许弃标
    }
    for (const a of agentList) {
      mcf.addEdge(agentBase + agentIdx.get(a.spec.id)!, T, a.capacity, 0);
    }

    const edges: Array<{
      taskIdx: number;
      agentId: string;
      edge: FlowEdgeRef;
      vQ: number;
      g: number;
    }> = [];
    for (let j = 0; j < tasks.length; j++) {
      const task = tasks[j]!;
      const c = task.capability;
      const cs = this.caps.get(c);
      for (const a of agentList) {
        if (!a.spec.capabilities.includes(c)) continue;
        const q = this.qHat(a, c, a.capital.get(c) ?? 0);
        const g = cs ? this.growthValue(a, c) : 0;
        // 费用 = b − v·q̂ − g（福利的相反数）
        const edge = mcf.addEdge(
          taskBase + j,
          agentBase + (agentIdx.get(a.spec.id) ?? 0),
          1,
          a.bid - task.value * q - g,
        );
        edges.push({ taskIdx: j, agentId: a.spec.id, edge, vQ: task.value * q, g });
      }
    }

    const { cost } = mcf.run(S, T);
    return { W: -cost, edges };
  }

  allocateBatch(tasks: CompoundTaskSpec[]): CompoundAllocation {
    if (tasks.length === 0) {
      return {
        assignments: [],
        payments: {},
        totalPayment: 0,
        welfareAugmented: 0,
        welfareCurrent: 0,
        growthInvestment: 0,
        droppedTasks: 0,
      };
    }

    // 更新各能力价值 EWMA（公开量）
    for (const c of new Set(tasks.map((t) => t.capability))) {
      const cs = this.caps.get(c);
      if (!cs) continue;
      const mean =
        tasks.filter((t) => t.capability === c).reduce((a, t) => a + t.value, 0) /
        tasks.filter((t) => t.capability === c).length;
      cs.valueEwma = cs.valueEwma === null ? mean : 0.8 * cs.valueEwma + 0.2 * mean;
    }

    // 完整求解
    const full = this.solveWDP(tasks, null);
    const winners = full.edges.filter((e) => e.edge.cap === 0); // 容量耗尽 = 被占用
    const kOf = new Map<string, number>();
    for (const e of winners) kOf.set(e.agentId, (kOf.get(e.agentId) ?? 0) + 1);

    // Clarke pivot：逐赢家重解 W*_{−i}
    const payments: Record<string, number> = {};
    const assignmentByTask = new Map<number, { agentId: string; vQ: number; g: number }>();
    for (const e of winners)
      assignmentByTask.set(e.taskIdx, { agentId: e.agentId, vQ: e.vQ, g: e.g });

    for (const [agentId, k] of kOf) {
      const a = this.agents.get(agentId)!;
      const without = this.solveWDP(tasks, agentId);
      payments[agentId] = a.bid * k + (full.W - without.W);
    }

    // 份额 EWMA 更新（公开量：按本批分派比例）
    for (const c of new Set(tasks.map((t) => t.capability))) {
      const cs = this.caps.get(c);
      if (!cs) continue;
      const cTasks = tasks.map((t, i) => ({ cap: t.capability, i })).filter((t) => t.cap === c);
      const counts = new Map<string, number>();
      for (const t of cTasks) {
        const asg = assignmentByTask.get(t.i);
        if (asg) counts.set(asg.agentId, (counts.get(asg.agentId) ?? 0) + 1);
      }
      for (const a of this.agents.values()) {
        if (!a.spec.capabilities.includes(c)) continue;
        const frac = (counts.get(a.spec.id) ?? 0) / cTasks.length;
        const prev =
          cs.shareEwma.get(a.spec.id) ??
          1 / [...this.agents.values()].filter((x) => x.spec.capabilities.includes(c)).length;
        cs.shareEwma.set(
          a.spec.id,
          (1 - this.config.shareAlpha) * prev + this.config.shareAlpha * frac,
        );
      }
    }

    // 组装结果
    const assignments: CompoundAssignment[] = [];
    let welfareCurrent = 0;
    let growthInvestment = 0;
    for (let j = 0; j < tasks.length; j++) {
      const asg = assignmentByTask.get(j);
      if (!asg) continue;
      const task = tasks[j]!;
      const a = this.agents.get(asg.agentId)!;
      const taskId = `ct-${++this.taskSeq}`;
      this.pending.set(taskId, {
        agentId: asg.agentId,
        capability: task.capability,
        kBefore: a.capital.get(task.capability) ?? 0,
        taskValue: task.value,
        trueCost: a.spec.trueCost,
      });
      const estQuality = asg.vQ / task.value;
      assignments.push({
        taskId,
        agentId: asg.agentId,
        capability: task.capability,
        payment: (payments[asg.agentId] ?? 0) / (kOf.get(asg.agentId) ?? 1),
        taskValue: task.value,
        estQuality,
        growthValue: asg.g,
      });
      welfareCurrent += asg.vQ - a.bid;
      growthInvestment += asg.g;
    }

    const totalPayment = Object.values(payments).reduce((x, y) => x + y, 0);
    this.emit('allocated', { assignments, payments });
    return {
      assignments,
      payments,
      totalPayment,
      welfareAugmented: full.W,
      welfareCurrent,
      growthInvestment,
      droppedTasks: tasks.length - assignments.length,
    };
  }

  // ---------- 结算（驱动学习资本与校准） ----------

  settle(taskId: string, success: boolean): boolean {
    const p = this.pending.get(taskId);
    if (!p) return false;
    this.pending.delete(taskId);
    const a = this.agents.get(p.agentId);
    const cs = this.caps.get(p.capability);
    if (!a || !cs) return false;
    // 已实现福利：成败按真实动力学入账（成本用分配时点快照）
    this.netWelfareSum += (success ? p.taskValue : 0) - p.trueCost;
    // 校准观测的归一化基准必须是「时不变」的凭证（而非随观测演化的
    // base 估计——后者会把学习水平吸收进基础质量，破坏 (α,β) 可识别性：
    // E[ŝ] = α(1−e^{−βk}) 要求基准不含 k 的信息）
    const cred =
      a.spec.credentialQuality?.[p.capability] ?? a.spec.trueQuality[p.capability] ?? 0.5;
    a.attempts.set(p.capability, (a.attempts.get(p.capability) ?? 0) + 1);
    if (success) a.successes.set(p.capability, (a.successes.get(p.capability) ?? 0) + 1);
    a.capital.set(p.capability, (a.capital.get(p.capability) ?? 0) + 1);
    const hist = a.obsHistory.get(p.capability) ?? [];
    hist.push({ k: p.kBefore, success });
    a.obsHistory.set(p.capability, hist);
    cs.observations.push({ base: cred, k: p.kBefore, success });
    // 观测窗口封顶（FIFO）：校准是每结算一次的全网格重拟合，
    // 无界增长会使长运行系统每次结算的CPU成本线性恶化
    const OBS_CAP = 2000;
    if (cs.observations.length > OBS_CAP) {
      cs.observations.splice(0, cs.observations.length - OBS_CAP);
    }
    if (hist.length > OBS_CAP) {
      hist.splice(0, hist.length - OBS_CAP);
    }
    this.calibrate(p.capability);
    this.emit('settled', {
      taskId,
      agentId: p.agentId,
      capability: p.capability,
      success,
      capitalAtAssignment: p.kBefore,
    } satisfies Settlement);
    return true;
  }

  // ---------- 模拟（实验用：真实动力学抽样，机制不可见） ----------

  private rng(): number {
    return this.rngSource.next();
  }

  /** 真实动力学下的成功率（仅 simulate 使用） */
  private trueQuality(a: AgentState, c: string): number {
    const base = a.spec.trueQuality[c] ?? 0.5;
    const k = a.capital.get(c) ?? 0;
    return base + this.config.simAlpha * (1 - base) * (1 - Math.exp(-this.config.simBeta * k));
  }

  /**
   * 一步模拟：分配 → 按真实动力学抽成败 → 结算。
   * 返回本批真实福利 Σ(v·success − trueCost)。
   */
  simulateBatch(tasks: CompoundTaskSpec[]): {
    allocation: CompoundAllocation;
    settlements: Settlement[];
    realizedWelfare: number;
  } {
    const allocation = this.allocateBatch(tasks);
    const settlements: Settlement[] = [];
    let realized = 0;
    for (const asg of allocation.assignments) {
      const a = this.agents.get(asg.agentId)!;
      const q = this.trueQuality(a, asg.capability);
      const success = this.rng() < q;
      this.settle(asg.taskId, success);
      realized += (success ? asg.taskValue : 0) - a.spec.trueCost;
      settlements.push({
        taskId: asg.taskId,
        agentId: asg.agentId,
        capability: asg.capability,
        success,
        capitalAtAssignment: (a.capital.get(asg.capability) ?? 1) - 1,
      });
    }
    return { allocation, settlements, realizedWelfare: realized };
  }

  // ---------- 相变定律顾问 ----------

  calibrations(): CalibrationReport[] {
    return [...this.caps.entries()].map(([c, cs]) => ({
      capability: c,
      alphaHat: cs.alphaHat,
      betaHat: cs.betaHat,
      r2: cs.r2,
      attempts: cs.observations.length,
      learnable: cs.alphaHat > 0.15 && cs.r2 > 0.15,
    }));
  }

  /**
   * 组合顾问：对每个能力给出孵化状态（K_min 进度）与可承受凭证劣势（δ_max）。
   * 闭式定律直接来自培训/雇佣相变理论——校准参数实时代入。
   */
  advise(): CapabilityAdvice[] {
    const out: CapabilityAdvice[] = [];
    for (const [c, cs] of this.caps) {
      const capable = [...this.agents.values()].filter((a) => a.spec.capabilities.includes(c));
      if (capable.length === 0) continue;
      const T = this.config.growthHorizon;
      const incubations: IncubationAdvice[] = capable.map((a) => {
        const k = a.capital.get(c) ?? 0;
        const base = this.baseEstimate(a, c);
        // 最佳替代者的凭证优势（相对于 a）
        const delta = Math.max(
          0,
          ...capable.filter((x) => x !== a).map((x) => this.baseEstimate(x, c) - base),
        );
        const kMin = lawKMin(base, delta, cs.alphaHat, cs.betaHat, T);
        const deltaMax = lawDeltaMax(base, k, cs.alphaHat, cs.betaHat, T);
        return {
          agentId: a.spec.id,
          capital: k,
          base,
          qNow: this.qHat(a, c, k),
          qHorizon: this.qHat(a, c, k + T),
          kMin,
          deltaMax,
        };
      });
      out.push({
        capability: c,
        calibration: {
          capability: c,
          alphaHat: cs.alphaHat,
          betaHat: cs.betaHat,
          r2: cs.r2,
          attempts: cs.observations.length,
          learnable: cs.alphaHat > 0.15 && cs.r2 > 0.15,
        },
        incubations,
      });
    }
    return out;
  }

  // ---------- 单任务入口（插件 Brain 接口兼容） ----------

  submitTask(capability: string): {
    taskId: string;
    winnerId: string;
    capability: string;
    payment: number;
    socialValue: number;
  } | null {
    const alloc = this.allocateBatch([{ capability, value: this.config.defaultTaskValue }]);
    if (alloc.assignments.length === 0) return null;
    const a = alloc.assignments[0]!;
    return {
      taskId: a.taskId,
      winnerId: a.agentId,
      capability,
      payment: a.payment,
      socialValue: a.taskValue * a.estQuality,
    };
  }

  settleTask(taskId: string, success: boolean): boolean {
    return this.settle(taskId, success);
  }

  /** 公开状态（插件规则可用 brain.* 字段读取） */
  getState(): {
    settledCount: number;
    openTasks: number;
    successRate: number;
    netWelfare: number;
    agents: Array<Record<string, unknown>>;
  } {
    let attempts = 0;
    let successes = 0;
    for (const a of this.agents.values()) {
      attempts += [...a.attempts.values()].reduce((x, y) => x + y, 0);
      successes += [...a.successes.values()].reduce((x, y) => x + y, 0);
    }
    const agents = [...this.agents.values()].map((a) => ({
      id: a.spec.id,
      capabilities: a.spec.capabilities,
      capital: Object.fromEntries(a.capital),
      attempts: Object.fromEntries(a.attempts),
      successes: Object.fromEntries(a.successes),
    }));
    return {
      settledCount: attempts,
      openTasks: this.pending.size,
      successRate: attempts > 0 ? successes / attempts : 1,
      netWelfare: this.netWelfareSum,
      agents,
    };
  }
}
