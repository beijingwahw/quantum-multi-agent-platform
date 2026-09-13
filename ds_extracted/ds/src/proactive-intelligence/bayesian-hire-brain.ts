/**
 * BayesianHireBrain —— Beta-Bernoulli 技能追踪 + 多臂雇佣策略的 MarketBrain
 *
 * ============ 定位（与既有 Brain 的关系，诚实边界） ============
 *
 * GrowthSchedulerBrain / CompoundBrain 的质量估计共同点是「点估计 + 确定性
 * 探索加成」：baseEstimate 是凭证先验的 Bayesian 收缩（恰好等于
 * Beta(κ0·cred, κ0·(1−cred)) 后验均值），探索项是 UCB 型的确定性加成
 * （exploreCoefficient/√(1+m) 或 e/√(1+m)）。本 Brain 补的是它们没有的
 * 三个成分：
 *
 *   1. 序贯 Beta 后验的不确定性面：后验参数、95% 中心 credible 区间、
 *      置信下界 LCB(q) = Beta 分位数（τ 分位）全部随结算流在线维护——
 *      「这个 agent 有多可靠」从点估计升级为可决策的区间陈述；
 *   2. 随机化指派策略：Thompson 抽样（后验逆 CDF 抽样，独立 Mulberry32
 *      流）按 P(i 是最优) 的频率分配任务；UCB1 / 贪心后验均值作为对照臂
 *      ——多臂雇佣策略的同一框架三种策略可直接 A/B（mission 的
 *      train-vs-hire 对照形态）；
 *   3. 置信下界雇佣阈值（hireFloor）＋实习通道（probationTrials）：
 *      LCB 低于阈值的 agent 不接价值任务；未过试用次数的 agent 放行
 *      （否则冷启动死锁——LCB 在小样本下必然低）。
 *
 * 非平稳性：forgetting ∈ (0,1] 对观测伪计数做逐结算指数遗忘（power
 * prior 形态，先验锚不衰减）。forgetting=1 时退化为终身静态后验。
 *
 * ============ portfolio 策略：Hedge 乘性权重组合（R17-D，opt-in） ============
 *
 * R14-C 已披露的代价面：单策略优劣场景依赖（展演流 greedy 90 > thompson
 * 66 > ucb1 61）。policy='portfolio' 把「条件性正向」升格为处处近最优：
 * 对所携成员集合（缺省 {greedy, thompson, ucb1}，可经 portfolioMembers
 * 配置，K = |集合|）跑 Hedge——乘性权重、全信息反馈：
 *
 *   1. 共享后验：所有成员从同一观测流学习——每次结算更新唯一后验状态
 *      （与展演的并行模拟口径一致：成员不因未被选中而漏学）；
 *   2. 奖励（每结算轮一次，规范化到 [0,1]）：行动成员、以及「点视角赢家
 *      恰为被执行赢家」的成员，获得已实现奖励 r̂ = 1/0（同一实验的真实
 *      结局）；异见成员获得其视角赢家的决策时后验均值 r̂ = μ̂ ∈ [0,1]
 *      （未执行实验的诚实估计——不消耗 thompson 流）；视角弃标 → 0；
 *   3. 权重：w_k ← w_k·exp(η·r̂_k) 后重归一（Σw ≡ 1 的数值纪律，权重比
 *      按轮演化不受绝对值漂移影响）；
 *   4. 行动成员：按权重经独立 Mulberry32 选择流（盐 'HEDG'）种子化抽样
 *      （每次存在 admitted 候选的决策恰消耗一次）；thompson 成员保留
 *      自己的独立种子流（盐 'THMP' 派生，与选择流零耦合；注意与单策略
 *      thompson 模式——直接 Mulberry32(seed)——是不同的流），
 *      未选中时其 RNG 不消耗——被选中才抽（每轮对每个 admitted agent
 *      恰一次 next()），累计计数公开于 state.portfolio.thompsonDraws，
 *      同 seed 逐位可重放。
 *
 * 后悔保证（对任意固定成员策略 i；奖励规范化到 [0,1]，η ∈ (0,1]——
 * 配置域校验强制）：
 *
 *   R_T = Σ_t ( r̂_i,t − Σ_k p_{k,t}·r̂_k,t ) ≤ ln K/η + η·T/2
 *
 * 经典 Hedge 界。出处：Y. Freund, R.E. Schapire, "A decision-theoretic
 * generalization of on-line learning and an application to boosting",
 * J. Comput. Syst. Sci. 55(1):119-139 (1997)。对抗带族背景：P. Auer,
 * N. Cesa-Bianchi, Y. Freund, R.E. Schapire, "The nonstochastic
 * multiarmed bandit problem", SIAM J. Comput. 32(1):48-77 (2002)——
 * 其中 EXP3 是强盗反馈版（每轮只见所选臂的奖励），遗憾界 O(√(TK ln K))；
 * 本实现经共享后验＋反事实估计取得每轮全员的 r̂（全信息反馈），界更紧
 * （O(ln K/η + ηT/2)），如实注明两者反馈口径的区别。
 *
 * 诚实边界：①界作用于所喂的奖励序列——异见成员的 r̂ 是后验均值估计而
 * 非真实反事实（未执行的实验不可观测），奖励后悔 → 福利后悔的转移在
 * 构造流上机证（tests/r17d-hedge-portfolio.test.ts：三条对抗流＋展演
 * 流，portfolio ≥ 事后最优单策略 − 界·scale）；②界对权重分布的期望
 * 奖励成立，种子化抽样的实现值围绕期望波动（鞅差；固定 seed 下确定，
 * 测试逐位钉死）；③奖励是毛社会值口径（成功 ? V : 0，规范化 /V），
 * 对真实成本与弃标的无形成本盲视（trueCost 除模拟口径福利记账外
 * 不可读——既有边界）；④η 是超参数（缺省 0.1）：大 η 追踪快但界中
 * ηT/2 项按二次增长，小 η 反之；⑤对固定（非自适应）成员策略成立，
 * 不含「对手专门针对 portfolio 调整结算流」的口径。
 *
 * ============ 激励性质（诚实声明，不主张 DSIC） ============
 *
 * 支付沿用增长市场的 pivot 夹挤形式 p = clamp(V·q̃_w − s₂, 0, V·q̃_w)
 * （s₂ = 其余参与者的最高分；q̃_w = 赢家本次的质量估值），对赢家自身
 * 报价独立。但 Thompson/UCB 配置规则不是 Myerson 仿射最大化器
 * （估值的随机化/探索加成不满足 DSIC 定理前提），单批 DSIC 不成立；
 * 跨批后验联动更使策略空间开放。本 Brain 定位为实验/对照机制与
 * 统计上最优分配（regret 视角），不是激励相容机制——要 DSIC 用
 * CompoundBrain。
 *
 * ============ 确定性契约 ============
 *
 * 机制自身的随机源全部由构造时的 seed 派生（独立流，与平台其他流零耦合）：
 * 单策略模式 = Mulberry32(seed)（thompson 抽样）；portfolio 模式 = 两条
 * 派生流——Hedge 选择流（盐 'HEDG'）与 thompson 成员流（盐 'THMP'，
 * 仅被选中时推进，计数公开）。同 seed、同注册序、同任务/结算序列 ⇒
 * 分配、支付、Hedge 权重与成员选择逐位可复现。TTL 清扫只读墙钟且只影响
 * 在途台账出账（可观测性），不进入任何定价数值路径。
 */

import { Mulberry32, DEFAULT_SEED } from '../utils/rng.js';
import { ConfigurationError, MechanismError } from '../utils/errors.js';
import { betaQuantile } from './beta-distribution.js';
import type { BrainAssignment, MarketBrain } from './brain.js';

// ----------------------------------------------------------------------------
// 类型
// ----------------------------------------------------------------------------

export interface HireAgentSpec {
  id: string;
  capabilities: string[];
  /** 私有：真实成本（机制不读；仅 settleTask 的模拟口径福利记账使用） */
  trueCost: number;
  /** 公开：各能力凭证质量（Beta 先验均值；缺省用 defaultCredential） */
  credentialQuality?: Record<string, number>;
  /** 公开报价（缺省 = trueCost，如实报价起点） */
  bid?: number;
}

/**
 * 指派策略：thompson = 后验抽样；greedy = 后验均值；ucb1 = UCB1 加成；
 * portfolio = 对成员集合跑 Hedge 乘性权重组合（见类头 R17-D 节）。
 */
export type HirePolicy = 'thompson' | 'greedy' | 'ucb1' | 'portfolio';

/** portfolio 的成员策略（Hedge 所携集合的元素；类型级排除嵌套 portfolio） */
export type HedgeMember = Exclude<HirePolicy, 'portfolio'>;

export interface BayesianHireConfig {
  /** 单任务成功社会价值 */
  taskValue: number;
  /** Beta 先验强度 κ0：cred → Beta(κ0·cred, κ0·(1−cred)) */
  priorWeight: number;
  /** 缺省凭证质量（无 credentialQuality 条目的能力） */
  defaultCredential: number;
  /** 指派策略（thompson 需 seed；greedy/ucb1 零随机；portfolio 见类头 R17-D 节） */
  policy: HirePolicy;
  /** Thompson 抽样种子（独立 Mulberry32 流） */
  seed: number;
  /** UCB1 探索系数（policy='ucb1' 时生效；portfolio 模式下同为 ucb1 成员的系数） */
  ucbExploration: number;
  /** Hedge 学习率 η ∈ (0,1]（policy='portfolio' 时生效；后悔界常数的适用域） */
  hedgeEta: number;
  /**
   * Hedge 成员策略集合（policy='portfolio' 时生效）：非空、无重复、
   * 元素 ∈ {greedy, thompson, ucb1}（运行时对走私值指名拒绝）。
   */
  portfolioMembers: readonly HedgeMember[];
  /** LCB 雇佣阈值：后验 LCB < hireFloor 的 agent 不参与指派（0 = 关闭） */
  hireFloor: number;
  /** 实习通道：观测次数（先验不计）少于此值的 agent 绕过雇佣阈值 */
  probationTrials: number;
  /** LCB 置信水平 τ（Beta 分位数） */
  lcbConfidence: number;
  /** 逐结算遗忘因子 ρ ∈ (0,1]：观测伪计数按 ρ 指数衰减（1 = 静态） */
  forgetting: number;
  /** 在途任务 TTL（毫秒）：超时未结算从台账清除（仅台账，不影响数值） */
  staleTaskTtlMs: number;
}

export const DEFAULT_BAYESIAN_HIRE_CONFIG: BayesianHireConfig = {
  taskValue: 10,
  priorWeight: 3,
  defaultCredential: 0.5,
  policy: 'thompson',
  seed: DEFAULT_SEED,
  ucbExploration: 1,
  hedgeEta: 0.1,
  portfolioMembers: ['greedy', 'thompson', 'ucb1'],
  hireFloor: 0,
  probationTrials: 0,
  lcbConfidence: 0.9,
  forgetting: 1,
  staleTaskTtlMs: 3_600_000,
};

/** 单能力后验快照（getState 的 agents[].skills[] 元素形状） */
export interface HireSkillSnapshot {
  capability: string;
  /** Beta 后验参数 α（先验 + 折算成功伪计数） */
  alpha: number;
  /** Beta 后验参数 β（先验 + 折算失败伪计数） */
  beta: number;
  /** 原始终身观测计数（不受遗忘影响；履历口径） */
  attempts: number;
  successes: number;
  /** 后验均值 α/(α+β) */
  mean: number;
  /** 后验 95% 中心 credible 区间 */
  ci95: readonly [number, number];
  /** 置信下界（lcbConfidence 分位） */
  lcb: number;
  /** 是否处于实习通道（观测数 < probationTrials） */
  probation: boolean;
}

export interface HireAgentSnapshot {
  id: string;
  skills: HireSkillSnapshot[];
}

export interface BayesianHireState {
  /** 模拟口径累计净福利：Σ(成功价值) − Σ(真实成本)（settleTask 时入账） */
  netWelfare: number;
  settledCount: number;
  successRate: number | null;
  openTasks: number;
  agents: HireAgentSnapshot[];
  /** portfolio 策略可观测面（仅 policy='portfolio' 时存在；下标 = members 序） */
  portfolio?: PortfolioTelemetry;
}

/** Hedge 组合的公开遥测（重放性与权重演化的机器账） */
export interface PortfolioTelemetry {
  /** 成员策略集合（构造时快照，序 = weights/selections 下标序） */
  members: readonly HedgeMember[];
  /** 归一化 Hedge 权重（每结算轮更新后 Σ = 1，容浮点舍入） */
  weights: readonly number[];
  /** 各成员被选为行动成员的累计轮数 */
  selections: readonly number[];
  /** Hedge 已更新轮数（= portfolio 模式的结算次数，后悔界的 T） */
  hedgeRounds: number;
  /** thompson 成员 RNG 累计消耗次数（仅其被选中时推进；每轮 = admitted 数） */
  thompsonDraws: number;
}

/** portfolio 模式的轮内决策快照（settleTask 时结算奖励用） */
interface PortfolioRoundSnapshot {
  /** 本轮行动成员下标 */
  selected: number;
  /** 各成员的点视角：视角赢家 id（null = 该成员会弃标）与其决策时后验均值 */
  views: ReadonlyArray<{ winner: string | null; mean: number }>;
}

/** 能力的在线后验状态（伪计数在 forgetting<1 时为浮点） */
interface SkillState {
  alphaPrior: number;
  betaPrior: number;
  succ: number;
  fail: number;
  attempts: number;
  successes: number;
}

interface AgentRuntime {
  spec: HireAgentSpec;
  bid: number;
  skills: Map<string, SkillState>;
}

/** 在途任务台账条目（分配 → 结算） */
interface OpenTaskRecord {
  agentId: string;
  capability: string;
  taskValue: number;
  trueCost: number;
  openedAt: number;
  portfolio?: PortfolioRoundSnapshot;
}

const VALID_POLICIES: ReadonlySet<string> = new Set(['thompson', 'greedy', 'ucb1', 'portfolio']);
const VALID_MEMBERS: ReadonlySet<string> = new Set(['thompson', 'greedy', 'ucb1']);

/**
 * 独立子流种子派生：seed 与命名盐经两轮 imul 混合（确定性、可复现；
 * 不同盐产出互不相关的流起点）。盐取可读 ASCII 大端拼数：'HEDG'/'THMP'。
 */
const HEDGE_SELECTION_SALT = 0x48454447;
const THOMPSON_MEMBER_SALT = 0x54484d50;

function deriveStreamSeed(seed: number, salt: number): number {
  let h = Math.imul((seed ^ salt) >>> 0, 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  return (h ^ (h >>> 13)) >>> 0;
}

// ----------------------------------------------------------------------------
// 配置域校验（走私审判风格：非法值指名拒绝，undefined 保持缺省）
// ----------------------------------------------------------------------------

function validateConfig(name: keyof BayesianHireConfig, value: number): void {
  const fail = (requirement: string): never => {
    throw new ConfigurationError(
      `BayesianHireConfig.${name} must be ${requirement}, got ${String(value)}`,
    );
  };
  switch (name) {
    case 'taskValue':
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        fail('a finite non-negative number');
      }
      return;
    case 'priorWeight':
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        fail('a finite positive number');
      }
      return;
    case 'defaultCredential':
    case 'lcbConfidence':
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value >= 1) {
        fail('within open interval (0, 1)');
      }
      return;
    case 'ucbExploration':
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        fail('a finite non-negative number');
      }
      return;
    case 'hedgeEta':
      // η ∈ (0,1]：后悔界常数 ln K/η + ηT/2 的适用域（e^{ηr} 二次展开在
      // η ≤ 1 时给出该常数；0 会冻结权重，>1 界常数换形）
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 1) {
        fail('within (0, 1]');
      }
      return;
    case 'hireFloor':
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value >= 1) {
        fail('within [0, 1)');
      }
      return;
    case 'probationTrials':
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
        fail('a non-negative integer');
      }
      return;
    case 'forgetting':
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 1) {
        fail('within (0, 1]');
      }
      return;
    case 'staleTaskTtlMs':
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        fail('a finite positive number');
      }
      return;
    default:
      return;
  }
}

// ----------------------------------------------------------------------------
// BayesianHireBrain
// ----------------------------------------------------------------------------

export class BayesianHireBrain implements MarketBrain<BayesianHireState, HireAgentSpec> {
  private readonly config: BayesianHireConfig;
  private readonly agents = new Map<string, AgentRuntime>();
  /**
   * 在途任务台账（分配 → 结算）。openedAt 单调（墙钟），TTL 清扫按插入序
   * 前缀出账——只影响 openTasks 可观测性，绝不进入定价/支付/后验数值。
   */
  private readonly openTasks = new Map<string, OpenTaskRecord>();
  private readonly rng: Mulberry32;
  /** portfolio 模式：Hedge 选择流（按权重抽行动成员）；其余策略为 null */
  private readonly selectionRng: Mulberry32 | null;
  /** portfolio 模式：成员集合（下标 = weights/selections/views 的序）；否则 null */
  private readonly members: readonly HedgeMember[] | null;
  /** 归一化 Hedge 权重（不变式：非 portfolio 模式为空数组） */
  private hedgeWeights: number[] = [];
  private readonly memberSelections: number[] = [];
  /** Hedge 已更新轮数（后悔界的 T；弃标/TTL 出账轮不更新） */
  private hedgeRounds = 0;
  /** thompson 成员 RNG 消耗计数（重放性账目；单策略模式亦计数但不公开） */
  private thompsonDraws = 0;
  private taskSeq = 0;
  /** UCB1 的全局轮次计数（每产出一次分配 +1；对数项的分母基准） */
  private banditRounds = 0;
  private settledCount = 0;
  private successCount = 0;
  private netWelfare = 0;

  constructor(config: Partial<BayesianHireConfig> = {}) {
    for (const [name, value] of Object.entries(config)) {
      // 数值旋钮逐项域校验（undefined/非数值不构成配置值，typeof 收窄）
      if (typeof value === 'number') validateConfig(name as keyof BayesianHireConfig, value);
    }
    if (config.policy !== undefined && !VALID_POLICIES.has(config.policy)) {
      throw new ConfigurationError(
        `BayesianHireConfig.policy must be one of: thompson, greedy, ucb1, portfolio; got '${String(config.policy)}'`,
      );
    }
    if (config.portfolioMembers !== undefined) {
      if (config.portfolioMembers.length === 0) {
        throw new ConfigurationError(
          'BayesianHireConfig.portfolioMembers must be a non-empty array of member policies',
        );
      }
      const seen = new Set<string>();
      for (const member of config.portfolioMembers) {
        if (!VALID_MEMBERS.has(member)) {
          throw new ConfigurationError(
            `BayesianHireConfig.portfolioMembers entries must be one of: greedy, thompson, ucb1; got '${String(member)}'`,
          );
        }
        if (seen.has(member)) {
          throw new ConfigurationError(
            `BayesianHireConfig.portfolioMembers must not repeat member '${member}' (duplicates would double its Hedge weight)`,
          );
        }
        seen.add(member);
      }
    }
    this.config = { ...DEFAULT_BAYESIAN_HIRE_CONFIG, ...config };
    if (this.config.policy === 'portfolio') {
      const members = [...this.config.portfolioMembers];
      this.members = members;
      this.hedgeWeights = members.map(() => 1 / members.length);
      for (const _member of members) this.memberSelections.push(0);
      this.selectionRng = new Mulberry32(deriveStreamSeed(this.config.seed, HEDGE_SELECTION_SALT));
      this.rng = new Mulberry32(deriveStreamSeed(this.config.seed, THOMPSON_MEMBER_SALT));
    } else {
      this.members = null;
      this.selectionRng = null;
      this.rng = new Mulberry32(this.config.seed); // 既有路径逐位不变
    }
  }

  /** 注册 agent（重复 id 指名拒绝——静默覆盖会清空其技能后验） */
  registerAgent(spec: HireAgentSpec): this {
    const raw = spec as { id?: unknown; trueCost?: unknown } | null;
    if (raw === null || typeof raw.id !== 'string' || raw.id.length === 0) {
      throw new ConfigurationError(
        `HireAgentSpec.id must be a non-empty string, got ${String(raw === null ? raw : raw.id)}`,
      );
    }
    if (typeof raw.trueCost !== 'number' || !Number.isFinite(raw.trueCost) || raw.trueCost < 0) {
      throw new ConfigurationError(
        `HireAgentSpec '${raw.id}' trueCost must be a finite non-negative number, got ${String(raw.trueCost)}`,
      );
    }
    if (this.agents.has(spec.id)) {
      throw new MechanismError(
        `BayesianHireBrain: agent '${spec.id}' is already registered (re-registration would wipe its skill posterior)`,
      );
    }
    const bid = spec.bid ?? spec.trueCost;
    if (typeof bid !== 'number' || !Number.isFinite(bid) || bid < 0) {
      throw new ConfigurationError(
        `HireAgentSpec '${spec.id}' bid must be a finite non-negative number, got ${String(bid)}`,
      );
    }
    const skills = new Map<string, SkillState>();
    for (const c of spec.capabilities) {
      const cred = spec.credentialQuality?.[c] ?? this.config.defaultCredential;
      if (typeof cred !== 'number' || !Number.isFinite(cred) || cred < 0 || cred > 1) {
        throw new ConfigurationError(
          `HireAgentSpec '${spec.id}' credentialQuality['${c}'] must be within [0, 1], got ${String(cred)}`,
        );
      }
      skills.set(c, {
        alphaPrior: this.config.priorWeight * cred,
        betaPrior: this.config.priorWeight * (1 - cred),
        succ: 0,
        fail: 0,
        attempts: 0,
        successes: 0,
      });
    }
    this.agents.set(spec.id, { spec, bid, skills });
    return this;
  }

  /** 后验参数（先验 + 折算观测伪计数） */
  private posterior(rt: AgentRuntime, c: string): { a: number; b: number } {
    const sk = rt.skills.get(c)!;
    return { a: sk.alphaPrior + sk.succ, b: sk.betaPrior + sk.fail };
  }

  /** LCB 雇佣门槛判定（hireFloor=0 恒过；实习通道放行未决 agent） */
  private passesHireGate(rt: AgentRuntime, c: string): boolean {
    if (this.config.hireFloor <= 0) return true;
    const sk = rt.skills.get(c)!;
    if (sk.succ + sk.fail < this.config.probationTrials) return true;
    const { a, b } = this.posterior(rt, c);
    return betaQuantile(this.config.lcbConfidence, a, b) >= this.config.hireFloor;
  }

  /**
   * 本次决策的质量估值（按行动策略 acting）：
   * - greedy：后验均值 α/(α+β)（与 compound-brain baseEstimate 同口径的
   *   静态特例：Beta(κ0·cred, κ0·(1−cred)) 后验均值 = (κ0·cred+s)/(κ0+n)）；
   * - thompson：后验逆 CDF 抽样（u ~ U[0,1)，q̃ = F⁻¹(u)），按后验最优
   *   概率分配探索；
   * - ucb1：均值 + c·√(2·ln(N+1)/n)，n 为后验伪样本量（先验充当天然的
   *   探索衰减——Bayesian UCB 形态），N 为累计分配轮次。
   * 抽签序：thompson 对 admitted 按注册序每 agent 恰一次——同 seed 下
   * 可复现。RNG 纪律：thompson 流仅在 thompson 为行动策略（被选中）时
   * 推进；单策略模式 acting === config.policy，行为与 R14-C 逐位一致。
   */
  private estimateQuality(rt: AgentRuntime, c: string, acting: HirePolicy): number {
    const { a, b } = this.posterior(rt, c);
    const mean = a / (a + b);
    if (acting === 'greedy') return mean;
    if (acting === 'ucb1') {
      return (
        mean +
        this.config.ucbExploration * Math.sqrt((2 * Math.log(this.banditRounds + 1)) / (a + b))
      );
    }
    this.thompsonDraws++;
    return betaQuantile(this.rng.next(), a, b);
  }

  /**
   * 成员 k 的点视角（决策时确定性视图，供 Hedge 奖励的反事实账）：
   * greedy/thompson 的确定视角 = 后验均值 argmax（thompson 的随机化视角
   * 不消费其流，以其均值视角代位）；ucb1 = 探索加成 argmax（与其实际
   * 决策规则一致，零随机）。平分由先注册者胜（与 submitTask 同决胜）。
   * 全员估值不抵报价 → winner=null（该成员本轮会弃标）。
   */
  private memberView(
    admitted: readonly AgentRuntime[],
    c: string,
    member: HedgeMember,
  ): { winner: string | null; mean: number } {
    let best: AgentRuntime | null = null;
    let bestMean = 0;
    let bestScore = -Infinity;
    for (const rt of admitted) {
      const { a, b } = this.posterior(rt, c);
      const mean = a / (a + b);
      const q =
        member === 'ucb1'
          ? mean +
            this.config.ucbExploration * Math.sqrt((2 * Math.log(this.banditRounds + 1)) / (a + b))
          : mean;
      const score = this.config.taskValue * q - rt.bid;
      if (score > bestScore) {
        best = rt;
        bestScore = score;
        bestMean = mean;
      }
    }
    if (best === null || bestScore < 0) return { winner: null, mean: 0 };
    return { winner: best.spec.id, mean: bestMean };
  }

  /**
   * 按当前 Hedge 权重种子化抽样本轮行动成员（下标）：每次调用恰消耗选择流
   * 一次（累积走查，成员序 = 配置序）。浮点塌缩兜底：舍入残差落到末成员。
   */
  private pickActingMember(): number {
    const u = this.selectionRng!.next();
    let acc = 0;
    for (let k = 0; k < this.hedgeWeights.length; k++) {
      acc += this.hedgeWeights[k]!;
      if (u < acc) {
        this.memberSelections[k]! += 1;
        return k;
      }
    }
    const last = this.hedgeWeights.length - 1;
    this.memberSelections[last]! += 1;
    return last;
  }

  /** 在途 TTL 清扫（插入序 = 时间序，首个未过期即可停） */
  private sweepStaleOpenTasks(): void {
    const cutoff = Date.now() - this.config.staleTaskTtlMs;
    for (const [taskId, open] of this.openTasks) {
      if (open.openedAt >= cutoff) break;
      this.openTasks.delete(taskId);
    }
  }

  /**
   * 提交任务：按当前策略估值分配 + pivot 夹挤支付。
   * null 契约与 GrowthSchedulerBrain 同口径：无人具备能力、雇佣门槛
   * 全员拦截、或最优估值不抵报价（免费处置）时返回 null。
   * portfolio 模式：行动成员由 Hedge 权重种子化抽样（选择流仅在存在
   * admitted 候选时消耗一次；弃标轮有消耗而无结算，故无 Hedge 更新）。
   */
  submitTask(capability: string): BrainAssignment | null {
    this.sweepStaleOpenTasks();
    const eligible = [...this.agents.values()].filter((rt) => rt.skills.has(capability));
    if (eligible.length === 0) return null;

    const admitted = eligible.filter((rt) => this.passesHireGate(rt, capability));
    if (admitted.length === 0) return null;

    const actingIndex = this.members === null ? -1 : this.pickActingMember();
    const acting: HirePolicy =
      this.members === null ? this.config.policy : this.members[actingIndex]!;

    let winner: AgentRuntime | null = null;
    let winnerQuality = 0;
    let winnerScore = -Infinity;
    let secondScore: number | null = null;
    for (const rt of admitted) {
      const q = this.estimateQuality(rt, capability, acting);
      const score = this.config.taskValue * q - rt.bid;
      // 严格大于：平分由先注册者胜（Map 迭代序 = 注册序，确定性决胜）
      if (score > winnerScore) {
        if (winner !== null) secondScore = winnerScore;
        winner = rt;
        winnerScore = score;
        winnerQuality = q;
      } else if (secondScore === null || score > secondScore) {
        secondScore = score;
      }
    }
    if (winner === null || winnerScore < 0) return null; // 免费处置：全员估值不抵报价

    // pivot 夹挤支付（对赢家报价独立；DSIC 不主张——见类头诚实声明）
    const payment = Math.min(
      Math.max(this.config.taskValue * winnerQuality - (secondScore ?? 0), 0),
      this.config.taskValue * winnerQuality,
    );
    const taskId = `bh-${++this.taskSeq}`;
    const record: OpenTaskRecord = {
      agentId: winner.spec.id,
      capability,
      taskValue: this.config.taskValue,
      trueCost: winner.spec.trueCost,
      openedAt: Date.now(),
    };
    if (this.members !== null) {
      // 各成员点视角（banditRounds 尚未 +1：与本轮决策同一计数口径）；
      // 行动成员的视角改记其真实决策（thompson 的随机化选择含在内）。
      const views = this.members.map((m) => this.memberView(admitted, capability, m));
      const { a, b } = this.posterior(winner, capability);
      views[actingIndex] = { winner: winner.spec.id, mean: a / (a + b) };
      record.portfolio = { selected: actingIndex, views };
    }
    this.openTasks.set(taskId, record);
    this.banditRounds++;
    return {
      taskId,
      winnerId: winner.spec.id,
      capability,
      payment,
      socialValue: this.config.taskValue * winnerQuality,
    };
  }

  /**
   * 结算：按成败更新后验伪计数（遗忘因子先行衰减）与模拟口径福利；
   * portfolio 模式额外做一轮 Hedge 权重更新。
   * 未知/重复 taskId 返回 false（幂等拒绝）。
   */
  settleTask(taskId: string, success: boolean): boolean {
    this.sweepStaleOpenTasks();
    const open = this.openTasks.get(taskId);
    if (!open) return false;
    this.openTasks.delete(taskId);

    const rt = this.agents.get(open.agentId);
    const sk = rt?.skills.get(open.capability);
    if (!rt || !sk) return false; // 台账与注册表不一致（防御：不可达）

    const rho = this.config.forgetting;
    sk.succ = rho * sk.succ + (success ? 1 : 0);
    sk.fail = rho * sk.fail + (success ? 0 : 1);
    sk.attempts += 1;
    if (success) sk.successes += 1;

    if (this.members !== null && open.portfolio !== undefined) {
      this.updateHedgeWeights(open, success);
    }

    this.netWelfare += (success ? open.taskValue : 0) - open.trueCost;
    this.settledCount += 1;
    if (success) this.successCount += 1;
    return true;
  }

  /**
   * Hedge 权重更新（每结算一轮；全信息反馈的诚实口径）：
   * - 行动成员、以及点视角赢家恰为被执行赢家的成员：r̂ = 1/0（已实现
   *   结局——同一实验的真实反馈；thompson 被选中时以其随机化决策兑现）；
   * - 异见成员：r̂ = 其视角赢家的决策时后验均值（未执行实验的诚实估计，
   *   不消耗 thompson 流；确定结算流下随执行证据收敛到真值）；
   * - 视角弃标：r̂ = 0（无行动无所得）。
   * w_k ← w_k·exp(η·r̂_k) 后重归一（Σw ≡ 1；比值演化不受绝对值漂移影响，
   * 持续落后的权重按 e^{−η·差距} 收缩，下溢归 0 是正确极限）。
   */
  private updateHedgeWeights(open: OpenTaskRecord, success: boolean): void {
    const eta = this.config.hedgeEta;
    const views = open.portfolio!.views;
    let sum = 0;
    for (let k = 0; k < this.hedgeWeights.length; k++) {
      const view = views[k]!;
      const realized = k === open.portfolio!.selected || view.winner === open.agentId;
      const rHat = realized ? (success ? 1 : 0) : view.winner === null ? 0 : view.mean;
      const w = this.hedgeWeights[k]! * Math.exp(eta * rHat);
      this.hedgeWeights[k] = w;
      sum += w;
    }
    for (let k = 0; k < this.hedgeWeights.length; k++) {
      this.hedgeWeights[k] = this.hedgeWeights[k]! / sum;
    }
    this.hedgeRounds++;
  }

  /** 公开决策状态（注入规则条件 'brain.*'；区间/LCB 是可规则化的区间陈述） */
  getState(): BayesianHireState {
    this.sweepStaleOpenTasks();
    const agents: HireAgentSnapshot[] = [...this.agents.values()].map((rt) => ({
      id: rt.spec.id,
      skills: [...rt.skills.entries()].map(([capability, sk]) => {
        const a = sk.alphaPrior + sk.succ;
        const b = sk.betaPrior + sk.fail;
        return {
          capability,
          alpha: a,
          beta: b,
          attempts: sk.attempts,
          successes: sk.successes,
          mean: a / (a + b),
          ci95: [betaQuantile(0.025, a, b), betaQuantile(0.975, a, b)] as const,
          lcb: betaQuantile(this.config.lcbConfidence, a, b),
          probation: sk.succ + sk.fail < this.config.probationTrials,
        };
      }),
    }));
    return {
      netWelfare: this.netWelfare,
      settledCount: this.settledCount,
      successRate: this.settledCount > 0 ? this.successCount / this.settledCount : null,
      openTasks: this.openTasks.size,
      agents,
      ...(this.members !== null
        ? {
            portfolio: {
              members: [...this.members],
              weights: [...this.hedgeWeights],
              selections: [...this.memberSelections],
              hedgeRounds: this.hedgeRounds,
              thompsonDraws: this.thompsonDraws,
            },
          }
        : {}),
    };
  }
}
