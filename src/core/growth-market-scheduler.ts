/**
 * 增长市场调度器（Growth-Maximizing Market Scheduler）
 *
 * 创新定位：现有调度器（含 2026 前沿的 AGENTLANCE / SALE 等市场机制工作）
 * 的目标函数是「当期福利最大化」——在 Agent 能力固定的前提下做最优分配。
 * 本模块把目标函数升级为「当期福利 + 系统智力资本的长期增长」，即：
 *
 *   1. VCG（Clarke pivot）支付规则 —— 成本报价激励相容：
 *      Agent 如实报价是弱占优策略，谎报只会丢掉有利可图的任务或接下亏损任务；
 *   2. 上下文资本 + 学习曲线 —— 每完成一个任务，Agent 在该能力上的
 *      有效质量沿饱和曲线上升（练习效应），上下文被显式定价为资产；
 *   3. UCB 探索项 —— 调度器有原则地"投资"尝试次数少的潜力 Agent，
 *      而不是永远剥削现有强者（探索/利用权衡的形式化）；
 *   4. 切换成本 —— 离开主专业需按已积累的上下文资本付费，
 *      李嘉图比较优势分工作为均衡态内生涌现，而非人为指定。
 *
 * 机制边界约定：分配与支付代码只消费「报价 + 公开履历」
 * （声誉、按能力统计的成功率、上下文资本）；spec 中的 trueCost / trueQuality
 * 属于 Agent 私有信息，仅被 simulateTask 模拟结算读取。
 *
 * 实测校准（2026-09，glm-4-flash 真实模型实验，n=2112，见 experiments/llm-learning-curve/）：
 *   - 隐性技能任务（口径只能从案例学）：α≈0.58、β≈0.09，学习曲线假设成立
 *     （q 从 0.46 升至 0.77，z=2.77）；显式规则已写全的任务 α→0，无学习空间。
 *   - 污染案例库（错误标签入库）使质量坍缩（q: 0.92→0.08）——
 *     资本累积必须经过验证层，未验证的经验是"负资本"。
 *   - α=0（不可学习）时默认探索系数不足，会锁死廉价平庸者、埋没潜在专家
 *     （coder 天赋 0.85 从未被发掘）；探索强度需与可学习性 α 反向匹配
 *     （α=0 时 explore≈3.0 才能恢复福利至 4407）。
 */

/** 分配策略：market = 本机制；greedy / round-robin = 对照基线 */
export type AllocationPolicy = 'market' | 'greedy' | 'round-robin';

export interface GrowthAgentSpec {
  id: string;
  capabilities: string[];
  /** 私有信息：真实边际成本（机制代码不得读取） */
  trueCost: number;
  /** 私有信息：各能力的基础成功率（机制代码不得读取） */
  trueQuality: Record<string, number>;
  /** 报价加成：0 = 如实报价（激励相容均衡）；>0 = 策略性加价 */
  bidMarkup?: number;
}

export interface GrowthSchedulerConfig {
  /** 任务成功的社会价值 V */
  successValue: number;
  /** 无历史记录时的质量先验 */
  priorQuality: number;
  /** 质量先验的虚拟样本权重 k0 */
  priorWeight: number;
  /** 全局声誉 EWMA 系数（仅用于报表，不参与分配） */
  reputationAlpha: number;
  /** UCB 探索系数：越大越愿意投资潜力 Agent */
  exploreCoefficient: number;
  /** 学习天花板 α：练习最多能填补 (1 - 基础质量) 的比例 */
  learningCeiling: number;
  /** 学习速率 β：上下文资本转化为质量的速率 */
  learningRate: number;
  /** 切换成本率 τ：离开主专业时按其上下文资本计费 */
  switchCostRate: number;
  /** 模拟结算的随机种子 */
  seed: number;
}

export const DEFAULT_GROWTH_CONFIG: GrowthSchedulerConfig = {
  successValue: 10,
  priorQuality: 0.5,
  priorWeight: 3,
  reputationAlpha: 0.15,
  exploreCoefficient: 0.35,
  learningCeiling: 0.6,
  learningRate: 0.15,
  switchCostRate: 0.03,
  seed: 42
};

export interface TaskAssignment {
  taskId: string;
  capability: string;
  winnerId: string;
  /** 赢家将获得的支付 */
  payment: number;
  /** 调度器对中标者产出的公开估值：V·q̂ + 探索奖励 − 切换成本 */
  socialValue: number;
  policy: AllocationPolicy;
}

export interface SettlementResult {
  taskId: string;
  winnerId: string;
  capability: string;
  success: boolean;
  payment: number;
  /** 模拟口径：真实执行成本（含切换惩罚） */
  actualCost: number;
}

export interface AgentSnapshot {
  id: string;
  wins: number;
  totalAttempts: number;
  reputation: number;
  /** 主专业（上下文资本最高的能力） */
  dominant: string | null;
  /** 主专业占该 Agent 总尝试的比例（专业化程度） */
  dominantShare: number;
  /** 该 Agent 能力分布的香农熵（越低越专业） */
  entropy: number;
  /** 模拟口径：支付 − 真实成本 的累计利润 */
  profit: number;
  capital: Record<string, number>;
}

interface AgentRuntime {
  spec: GrowthAgentSpec;
  reputation: number;
  attempts: Map<string, number>;
  successes: Map<string, number>;
  capital: Map<string, number>;
  totalAttempts: number;
  wins: number;
  profit: number;
}

interface OpenTask {
  assignment: TaskAssignment;
  winner: AgentRuntime;
}

/** 确定性随机数（mulberry32），保证实验可复现 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class GrowthMarketScheduler {
  private readonly config: GrowthSchedulerConfig;
  private readonly agents = new Map<string, AgentRuntime>();
  private readonly openTasks = new Map<string, OpenTask>();
  /** 模拟口径的结算历史，用于窗口化指标 */
  private readonly history: Array<{ success: boolean }> = [];
  private readonly rng: () => number;
  private taskSeq = 0;
  private rrCursor = 0;
  private netWelfare = 0;

  constructor(config: Partial<GrowthSchedulerConfig> = {}) {
    this.config = { ...DEFAULT_GROWTH_CONFIG, ...config };
    this.rng = mulberry32(this.config.seed);
  }

  register(spec: GrowthAgentSpec): this {
    if (this.agents.has(spec.id)) {
      throw new Error(`Agent 已注册: ${spec.id}`);
    }
    this.agents.set(spec.id, {
      spec,
      reputation: this.config.priorQuality,
      attempts: new Map(),
      successes: new Map(),
      capital: new Map(),
      totalAttempts: 0,
      wins: 0,
      profit: 0
    });
    return this;
  }

  // ---------- 机制内部估值（只消费公开信息 + 报价） ----------

  /** Agent 报价：真实成本 × (1 + 加成)。机制不读 trueCost，只读这里产出的 bid */
  private bidOf(rt: AgentRuntime): number {
    return rt.spec.trueCost * (1 + (rt.spec.bidMarkup ?? 0));
  }

  /** 贝叶斯质量估计：按能力的历史成功率向先验收缩 */
  private estimateQuality(rt: AgentRuntime, capability: string): number {
    const n = rt.attempts.get(capability) ?? 0;
    const s = rt.successes.get(capability) ?? 0;
    const { priorQuality, priorWeight } = this.config;
    return (s + priorQuality * priorWeight) / (n + priorWeight);
  }

  /** 主专业：上下文资本最高的能力 */
  private dominantOf(rt: AgentRuntime): string | null {
    let best: string | null = null;
    let bestCap = 0;
    for (const [cap, value] of rt.capital) {
      if (value > bestCap) {
        bestCap = value;
        best = cap;
      }
    }
    return best;
  }

  /** 切换成本：任务离开主专业时，按主专业已积累资本计费（专业化的机会成本） */
  private switchCostOf(rt: AgentRuntime, capability: string): number {
    const dominant = this.dominantOf(rt);
    if (!dominant || dominant === capability) {
      return 0;
    }
    return this.config.switchCostRate * (rt.capital.get(dominant) ?? 0);
  }

  /** 公开社会价值：V·q̂ + UCB 探索奖励 − 切换成本 */
  private socialValueOf(rt: AgentRuntime, capability: string, totalPulls: number): number {
    const q = this.estimateQuality(rt, capability);
    const n = rt.attempts.get(capability) ?? 0;
    const explore =
      this.config.exploreCoefficient * Math.sqrt(Math.log(1 + totalPulls) / (1 + n));
    return this.config.successValue * q + explore - this.switchCostOf(rt, capability);
  }

  // ---------- 分配与支付 ----------

  /**
   * 提交任务并立即得到分配结果。
   * - market：按 s_i = v_i − bid_i 择优，支付采用 Clarke pivot：
   *   p_w = clamp(v_w − max_{j≠w} s_j, 0, v_w)。
   *   赢家的支付不依赖自身报价 → 如实报价是弱占优策略。
   * - greedy：最低价中标，按报价支付（一价拍卖基线）。
   * - round-robin：轮流坐庄基线。
   */
  submitTask(capability: string, policy: AllocationPolicy = 'market'): TaskAssignment | null {
    const eligible = [...this.agents.values()].filter((rt) =>
      rt.spec.capabilities.includes(capability)
    );
    if (eligible.length === 0) {
      return null;
    }

    const totalPulls = eligible.reduce(
      (sum, rt) => sum + (rt.attempts.get(capability) ?? 0),
      0
    );
    const scored = eligible.map((rt) => {
      const bid = this.bidOf(rt);
      return { rt, bid, v: this.socialValueOf(rt, capability, totalPulls) };
    });

    let winner: (typeof scored)[number];
    let payment: number;

    if (policy === 'greedy') {
      winner = scored.reduce((a, b) => (b.bid < a.bid ? b : a));
      payment = winner.bid;
    } else if (policy === 'round-robin') {
      scored.sort((a, b) => a.rt.spec.id.localeCompare(b.rt.spec.id));
      winner = scored[this.rrCursor++ % scored.length];
      payment = winner.bid;
    } else {
      const withScore = scored.map((x) => ({ ...x, s: x.v - x.bid }));
      winner = withScore.reduce((a, b) => (b.s > a.s ? b : a));
      const secondBest = withScore
        .filter((x) => x.rt !== winner.rt)
        .reduce<number | null>((m, x) => (m === null || x.s > m ? x.s : m), null);
      // 无竞争者时垄断者榨取全部估值；有竞争者时支付 = 移除赢家后的最优分数（Clarke pivot）
      payment = Math.min(
        Math.max(winner.v - (secondBest ?? 0), 0),
        winner.v
      );
    }

    const taskId = `t${++this.taskSeq}`;
    const assignment: TaskAssignment = {
      taskId,
      capability,
      winnerId: winner.rt.spec.id,
      payment,
      socialValue: winner.v,
      policy
    };
    this.openTasks.set(taskId, { assignment, winner: winner.rt });
    winner.rt.wins++;
    return assignment;
  }

  /** 结算：请求方报告成败，更新公开履历（声誉 / 按能力成功率 / 上下文资本 / 窗口指标） */
  completeTask(taskId: string, success: boolean): void {
    const open = this.openTasks.get(taskId);
    if (!open) {
      throw new Error(`任务不存在或已结算: ${taskId}`);
    }
    const { assignment, winner } = open;
    const cap = assignment.capability;
    winner.attempts.set(cap, (winner.attempts.get(cap) ?? 0) + 1);
    winner.successes.set(cap, (winner.successes.get(cap) ?? 0) + (success ? 1 : 0));
    winner.capital.set(cap, (winner.capital.get(cap) ?? 0) + 1);
    winner.totalAttempts++;
    winner.reputation =
      winner.reputation * (1 - this.config.reputationAlpha) +
      (success ? 1 : 0) * this.config.reputationAlpha;
    this.openTasks.delete(taskId);
    // 真实结算同样计入窗口指标（修复：此前仅 simulateTask 记账，
    // completeTask 路径的结算对 getSettledCount/getWindowSuccessRate 不可见）
    this.history.push({ success });
  }

  // ---------- 模拟结算（仅基准/测试使用，读取私有信息） ----------

  /**
   * 提交 + 模拟执行 + 结算一条龙。
   * 有效质量沿学习曲线饱和：qEff = base + α·(1−base)·(1−e^{−β·capital})。
   */
  simulateTask(capability: string, policy: AllocationPolicy = 'market'): SettlementResult | null {
    const assignment = this.submitTask(capability, policy);
    if (!assignment) {
      return null;
    }
    const rt = this.agents.get(assignment.winnerId)!;
    const cap = assignment.capability;

    // 结算前的资本决定本次执行的有效质量与切换惩罚
    const capitalBefore = rt.capital.get(cap) ?? 0;
    const dominant = this.dominantOf(rt);
    const base = rt.spec.trueQuality[cap] ?? 0;
    const { learningCeiling: alpha, learningRate: beta } = this.config;
    const qEff = Math.min(1, base + alpha * (1 - base) * (1 - Math.exp(-beta * capitalBefore)));
    const success = this.rng() < qEff;
    const switchPenalty =
      dominant && dominant !== cap
        ? this.config.switchCostRate * (rt.capital.get(dominant) ?? 0)
        : 0;
    const actualCost = rt.spec.trueCost * (1 + switchPenalty);

    this.completeTask(assignment.taskId, success);
    rt.profit += assignment.payment - actualCost;
    this.netWelfare += (success ? this.config.successValue : 0) - actualCost;

    return {
      taskId: assignment.taskId,
      winnerId: assignment.winnerId,
      capability: cap,
      success,
      payment: assignment.payment,
      actualCost
    };
  }

  // ---------- 指标 ----------

  /** [from, to) 窗口内的成功率（按结算顺序） */
  getWindowSuccessRate(from: number, to: number): number {
    const slice = this.history.slice(from, to);
    if (slice.length === 0) {
      return 0;
    }
    return slice.filter((x) => x.success).length / slice.length;
  }

  /** 净福利 = Σ(成功价值) − Σ(真实执行成本)，模拟口径 */
  getNetWelfare(): number {
    return Math.round(this.netWelfare * 100) / 100;
  }

  getSettledCount(): number {
    return this.history.length;
  }

  getSnapshot(): AgentSnapshot[] {
    return [...this.agents.values()].map((rt) => {
      const capital = Object.fromEntries(rt.capital);
      const dominant = this.dominantOf(rt);
      let dominantShare = 0;
      let entropy = 0;
      if (rt.totalAttempts > 0) {
        for (const n of rt.attempts.values()) {
          const p = n / rt.totalAttempts;
          entropy -= p * Math.log2(p);
          if (dominant !== null) {
            dominantShare = (rt.attempts.get(dominant) ?? 0) / rt.totalAttempts;
          }
        }
      }
      return {
        id: rt.spec.id,
        wins: rt.wins,
        totalAttempts: rt.totalAttempts,
        reputation: Math.round(rt.reputation * 1000) / 1000,
        dominant,
        dominantShare: Math.round(dominantShare * 1000) / 1000,
        entropy: Math.round(entropy * 1000) / 1000,
        profit: Math.round(rt.profit * 100) / 100,
        capital
      };
    });
  }
}
