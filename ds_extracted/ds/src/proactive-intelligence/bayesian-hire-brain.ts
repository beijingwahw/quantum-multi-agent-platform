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
 * 机制自身唯一随机源是构造时的 Mulberry32(seed)（独立流，与平台其他
 * 流零耦合）。同 seed、同注册序、同任务/结算序列 ⇒ 分配与支付逐位
 * 可复现。TTL 清扫只读墙钟且只影响在途台账出账（可观测性），不进入
 * 任何定价数值路径。
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

/** 指派策略：thompson = 后验抽样；greedy = 后验均值；ucb1 = UCB1 加成 */
export type HirePolicy = 'thompson' | 'greedy' | 'ucb1';

export interface BayesianHireConfig {
  /** 单任务成功社会价值 */
  taskValue: number;
  /** Beta 先验强度 κ0：cred → Beta(κ0·cred, κ0·(1−cred)) */
  priorWeight: number;
  /** 缺省凭证质量（无 credentialQuality 条目的能力） */
  defaultCredential: number;
  /** 指派策略（thompson 需 seed；greedy/ucb1 零随机） */
  policy: HirePolicy;
  /** Thompson 抽样种子（独立 Mulberry32 流） */
  seed: number;
  /** UCB1 探索系数（policy='ucb1' 时生效） */
  ucbExploration: number;
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

const VALID_POLICIES: ReadonlySet<string> = new Set(['thompson', 'greedy', 'ucb1']);

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
  private readonly openTasks = new Map<
    string,
    { agentId: string; capability: string; taskValue: number; trueCost: number; openedAt: number }
  >();
  private readonly rng: Mulberry32;
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
        `BayesianHireConfig.policy must be one of: thompson, greedy, ucb1; got '${String(config.policy)}'`,
      );
    }
    this.config = { ...DEFAULT_BAYESIAN_HIRE_CONFIG, ...config };
    this.rng = new Mulberry32(this.config.seed); // 种子有限性由 Mulberry32 构造守卫
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
   * 本次决策的质量估值（按策略）：
   * - greedy：后验均值 α/(α+β)（与 compound-brain baseEstimate 同口径的
   *   静态特例：Beta(κ0·cred, κ0·(1−cred)) 后验均值 = (κ0·cred+s)/(κ0+n)）；
   * - thompson：后验逆 CDF 抽样（u ~ U[0,1)，q̃ = F⁻¹(u)），按后验最优
   *   概率分配探索；
   * - ucb1：均值 + c·√(2·ln(N+1)/n)，n 为后验伪样本量（先验充当天然的
   *   探索衰减——Bayesian UCB 形态），N 为累计分配轮次。
   * 抽签序：thompson 对 admitted 按注册序每 agent 恰一次——同 seed 下
   * 可复现。
   */
  private estimateQuality(rt: AgentRuntime, c: string): number {
    const { a, b } = this.posterior(rt, c);
    const mean = a / (a + b);
    if (this.config.policy === 'greedy') return mean;
    if (this.config.policy === 'ucb1') {
      return (
        mean +
        this.config.ucbExploration * Math.sqrt((2 * Math.log(this.banditRounds + 1)) / (a + b))
      );
    }
    return betaQuantile(this.rng.next(), a, b);
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
   */
  submitTask(capability: string): BrainAssignment | null {
    this.sweepStaleOpenTasks();
    const eligible = [...this.agents.values()].filter((rt) => rt.skills.has(capability));
    if (eligible.length === 0) return null;

    const admitted = eligible.filter((rt) => this.passesHireGate(rt, capability));
    if (admitted.length === 0) return null;

    let winner: AgentRuntime | null = null;
    let winnerQuality = 0;
    let winnerScore = -Infinity;
    let secondScore: number | null = null;
    for (const rt of admitted) {
      const q = this.estimateQuality(rt, capability);
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
    this.openTasks.set(taskId, {
      agentId: winner.spec.id,
      capability,
      taskValue: this.config.taskValue,
      trueCost: winner.spec.trueCost,
      openedAt: Date.now(),
    });
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
   * 结算：按成败更新后验伪计数（遗忘因子先行衰减）与模拟口径福利。
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

    this.netWelfare += (success ? open.taskValue : 0) - open.trueCost;
    this.settledCount += 1;
    if (success) this.successCount += 1;
    return true;
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
    };
  }
}
