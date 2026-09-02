/**
 * 批量 VCG 调度器：多任务并发 + 容量约束 + 预算约束
 *
 * ============ 机制结构（三层） ============
 *
 * 1) 精确批量 VCG（预算不紧时的基准机制）
 *    - WDP（赢家决定问题）= 容量约束下的二部图最优分配（运输问题），
 *      用最小费用最大流精确求解（逐任务贪心不最优，替代/腾挪需要残差网络增广）。
 *    - Clarke pivot 支付按 bundle 计价：p_i = b_i·k_i + (W* − W*_{−i})，
 *      其中 W*_{−i} 是把 agent i 整体移出后的最优福利。
 *    - 性质：分配效率最优 + 占优策略激励相容（DSIC）+ 弱预算平衡（take ≥ 0）。
 *    - 与逐任务"短视 VCG"的本质差别：替代效应。例：w（容量 2）独揽两任务，
 *      j（容量 1）是唯一替代者——短视把每个任务都当成"j 空闲可用"来定价，
 *      take = 2·s_j；批量真值 take = s_j。短视系统性少付 s_j，破坏 DSIC。
 *
 * 2) 预算约束与不可能性边界（诚实声明）
 *    - 单边采购（平台估值公开、只有卖家私有成本）下，精确批量 VCG 恒有
 *      take = Σv − Σp ≥ 0（每个赢家的支付不超过其创造的价值）——弱预算平衡成立。
 *    - 但薄竞争市场（每个赢家都"不可替代"）下 take → 0：平台无法从调度中
 *      自持运营。这正是 Green-Laffmont 类不可能性的具体形态：
 *      效率 + DSIC + 正剩余抽取不可兼得。
 *    - 外部现金预算 B < Σp^VCG 时，机制必须牺牲三者之一。
 *
 * 3) 拉格朗日松弛（预算紧时）
 *    - 影子价格 λ ≥ 0 对每任务估值折价：ṽ = v − λ；
 *      二分搜索最小可行 λ 使 Σp(λ) ≤ B（λ = λmax 时无任何分配，Σp = 0，恒可行）。
 *    - λ 的经济含义：对"边际剩余抽取"征税。IR 保持（p_i ≥ b_i·k_i 恒成立），
 *      分配只在 score = ṽ − b 变号时才改变——许多情形下零效率损失即可满足预算。
 *    - 代价：λ 依赖全部报价 → 精确 DSIC 不再成立。
 *      提供 measureMisreportGain() 实证测量偏离幅度。
 *
 * 4) 仿射乘子 μ-VCG（Affine VCG）——预算平衡问题的精确 DSIC 逃生舱
 *
 *    洞察：λ-bisection 破坏 DSIC 的唯一根源是「乘子 ← 当前报价」的反馈回路。
 *    Green-Laffmont 不可能性约束的是"效率 + DSIC + 无外部预算的收支相抵"；
 *    本问题是"外部预算 B 下的一侧私有信息采购"（成本私有、估值公开），
 *    不可能性并不强制牺牲 DSIC——把乘子钉在公开信息上即可全部保住。
 *
 *    构造：公开常数 (λ, μ)，分配最大化仿射目标 Φ(X) = Σ(v−λ) − μ·Σb
 *    （仿射最大化器——Roberts 定理刻画的 DSIC 机制族）。Groves 型支付：
 *        p_i = b_i·k_i + [Φ(X*) − Φ(X_{−i})] / μ
 *    定理（精确 DSIC + IR）：只要 (λ, μ) 不依赖当批报价，该机制精确 DSIC，
 *    且 p_i ≥ b_i·k_i（IR）。证明梗概见 allocateAffineBatch 注释。
 *
 *    经济含义：μ 是平台的市场力（markup / Lerner 几何）。
 *    - μ=1 退化为经典 VCG（薄市场 take→0 病理）；
 *    - μ>1 在保持精确 DSIC 的同时恢复剩余抽取（薄市场病理的逃生舱），
 *      代价是边际分配收缩：b ∈ (v/μ, v) 的任务被弃标。
 *
 *    预算即控制：把"预算硬约束"从机制设计牺牲改写为控制问题——
 *    BudgetPacer 用历史批次的公开支付在线校准 μ_t（对数空间对偶上升），
 *    μ_t 只依赖过去 → 每批精确 DSIC，预算按平均意义守恒。
 *    （与广告平台预算 pacing 同构，但对偶变量是采购 markup 而非出价折扣。）
 *
 * ============ 边界与口径 ============
 * - 分配/支付代码只消费「报价 + 公开履历」（按能力成功率、上下文资本）；
 *   trueCost / trueQuality 为私有信息，仅供 simulateBatch 模拟结算读取。
 * - 批内并发：agent 同批最多承接 capacity 个任务；批间同步结算释放容量。
 *   跨批异步调度属于 QuantumScheduler 的职责，本模块是原子批层。
 * - 重复博弈的动态激励（为经营声誉而压报价）不在本模块处理范围。
 */

/** 最小费用最大流（SPFA 连续最短增广），用于精确求解容量约束下的 WDP */
class MinCostFlow {
  private readonly graph: Array<Array<{ to: number; rev: number; cap: number; cost: number }>> = [];

  constructor(n: number) {
    for (let i = 0; i < n; i++) this.graph.push([]);
  }

  /** 建边并返回前向边引用（供事后查询是否被占用） */
  addEdge(from: number, to: number, cap: number, cost: number): { from: number; idx: number } {
    this.graph[from].push({ to, rev: this.graph[to].length, cap, cost });
    this.graph[to].push({ to: from, rev: this.graph[from].length - 1, cap: 0, cost: -cost });
    return { from, idx: this.graph[from].length - 1 };
  }

  /**
   * 最小费用流（自由处置版）：只沿负费用增广路推进——当容量竞争使
   * "多分配一单"的边际福利为负时停止，允许最优解弃标。
   * （若跑满最大流会强制分配所有可分配任务，在容量挤占下得到次优解。）
   */
  run(s: number, t: number): { flow: number; cost: number } {
    let flow = 0;
    let cost = 0;
    const n = this.graph.length;
    for (;;) {
      const dist = Array<number>(n).fill(Infinity);
      const inQueue = Array<boolean>(n).fill(false);
      const prev: Array<{ node: number; edgeIdx: number } | null> = Array(n).fill(null);
      dist[s] = 0;
      const queue: number[] = [s];
      while (queue.length > 0) {
        const u = queue.shift()!;
        inQueue[u] = false;
        for (let i = 0; i < this.graph[u].length; i++) {
          const e = this.graph[u][i];
          if (e.cap > 0 && dist[u] + e.cost < dist[e.to] - 1e-9) {
            dist[e.to] = dist[u] + e.cost;
            prev[e.to] = { node: u, edgeIdx: i };
            if (!inQueue[e.to]) {
              queue.push(e.to);
              inQueue[e.to] = true;
            }
          }
        }
      }
      // 无增广路，或边际费用非负（再分配只会降福利）→ 停止
      if (dist[t] === Infinity || dist[t] >= -1e-12) break;
      let aug = Infinity;
      for (let v = t; v !== s; ) {
        const p = prev[v]!;
        aug = Math.min(aug, this.graph[p.node][p.edgeIdx].cap);
        v = p.node;
      }
      for (let v = t; v !== s; ) {
        const p = prev[v]!;
        const e = this.graph[p.node][p.edgeIdx];
        e.cap -= aug;
        this.graph[e.to][e.rev].cap += aug;
        cost += aug * e.cost;
        v = p.node;
      }
      flow += aug;
    }
    return { flow, cost };
  }

  /** 读取 agent→task 前向边是否被占用（cap 由 1 减为 0 即被分配） */
  edgeOccupied(ref: { from: number; idx: number }): boolean {
    return this.graph[ref.from][ref.idx].cap === 0;
  }
}

export interface BatchAgentSpec {
  id: string;
  capabilities: string[];
  /** 私有信息：真实边际成本（机制代码不得读取） */
  trueCost: number;
  /** 私有信息：各能力的基础成功率（机制代码不得读取） */
  trueQuality: Record<string, number>;
  /**
   * 可验证资历（公开信息）：入场时各能力的质量先验，如简历/认证。
   * 机制可安全消费——不违反 DSIC（VCG 对任意公开估值成立）。
   */
  credentialQuality?: Record<string, number>;
  /** 报价加成：0 = 如实报价；>0 = 策略性加价 */
  bidMarkup?: number;
  /** 同批最大并发任务数 */
  capacity: number;
}

export interface BatchVCGConfig {
  successValue: number;
  priorQuality: number;
  priorWeight: number;
  reputationAlpha: number;
  exploreCoefficient: number;
  learningCeiling: number;
  learningRate: number;
  switchCostRate: number;
  seed: number;
}

export const DEFAULT_BATCH_CONFIG: BatchVCGConfig = {
  successValue: 10,
  priorQuality: 0.5,
  priorWeight: 3,
  reputationAlpha: 0.15,
  exploreCoefficient: 0,
  learningCeiling: 0.6,
  learningRate: 0.15,
  switchCostRate: 0,
  seed: 42
};

export interface BatchAssignment {
  taskId: string;
  agentId: string;
  capability: string;
  /** 该任务分摊的支付（bundle 支付按任务均摊，仅用于报表） */
  paymentShare: number;
}

export interface BatchAllocation {
  assignments: BatchAssignment[];
  /** 按 agent 计的 VCG 支付（机制的真实口径） */
  payments: Record<string, number>;
  totalPayment: number;
  /** 实际分配的真实福利 Σ(v − b) */
  welfare: number;
  /** λ=0 时的最优福利（效率上界） */
  maxWelfare: number;
  efficiencyLoss: number;
  /** 平台剩余 = Σv − Σp ≥ 0（弱预算平衡） */
  platformTake: number;
  /** 拉格朗日影子价格：预算不紧时为 0 */
  lambda: number;
  /** 仿射乘子（markup）：仅 allocateAffineBatch 设置；其余路径为 1 */
  mu?: number;
  droppedTasks: number;
  budget: number;
  /** true = 精确 DSIC 路径；false = λ 松弛路径（DSIC 近似） */
  exactDSIC: boolean;
}

export interface BatchSettlement {
  taskId: string;
  agentId: string;
  success: boolean;
  payment: number;
  actualCost: number;
}

interface AgentRuntime {
  spec: BatchAgentSpec;
  attempts: Map<string, number>;
  successes: Map<string, number>;
  capital: Map<string, number>;
  reputation: number;
  totalAttempts: number;
  profit: number;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class BatchVCGScheduler {
  private readonly config: BatchVCGConfig;
  private readonly agents = new Map<string, AgentRuntime>();
  private readonly rng: () => number;
  private taskSeq = 0;
  private lastAllocation: BatchAllocation | null = null;
  private readonly history: Array<{ success: boolean }> = [];
  private netWelfare = 0;

  constructor(config: Partial<BatchVCGConfig> = {}) {
    this.config = { ...DEFAULT_BATCH_CONFIG, ...config };
    this.rng = mulberry32(this.config.seed);
  }

  register(spec: BatchAgentSpec): this {
    if (this.agents.has(spec.id)) throw new Error(`Agent 已注册: ${spec.id}`);
    this.agents.set(spec.id, {
      spec,
      attempts: new Map(),
      successes: new Map(),
      capital: new Map(),
      reputation: this.config.priorQuality,
      totalAttempts: 0,
      profit: 0
    });
    return this;
  }

  // ---------- 公开估值（只消费公开履历 + 报价） ----------

  private bidOf(rt: AgentRuntime): number {
    return rt.spec.trueCost * (1 + (rt.spec.bidMarkup ?? 0));
  }

  private estimateQuality(rt: AgentRuntime, capability: string): number {
    const n = rt.attempts.get(capability) ?? 0;
    const s = rt.successes.get(capability) ?? 0;
    const cred = rt.spec.credentialQuality?.[capability] ?? this.config.priorQuality;
    return (s + cred * this.config.priorWeight) / (n + this.config.priorWeight);
  }

  private dominantOf(rt: AgentRuntime): string | null {
    let best: string | null = null;
    let bestCap = -1;
    for (const [cap, v] of rt.capital) {
      if (v > bestCap) {
        bestCap = v;
        best = cap;
      }
    }
    return best;
  }

  private switchCostOf(rt: AgentRuntime, capability: string): number {
    const dom = this.dominantOf(rt);
    if (!dom || dom === capability) return 0;
    return this.config.switchCostRate * (rt.capital.get(dom) ?? 0);
  }

  /** 全局口径的按能力尝试总数（公开履历，不随排除集变化——保证 VCG 支付一致性） */
  private totalPullsOf(capability: string): number {
    let n = 0;
    for (const rt of this.agents.values()) n += rt.attempts.get(capability) ?? 0;
    return n;
  }

  /** 平台对 rt 执行 capability 的公开估值（λ 折价前） */
  private valueOf(rt: AgentRuntime, capability: string): number {
    const q = this.estimateQuality(rt, capability);
    const n = rt.attempts.get(capability) ?? 0;
    const explore =
      this.config.exploreCoefficient * Math.sqrt(Math.log(1 + this.totalPullsOf(capability)) / (1 + n));
    return this.config.successValue * q + explore - this.switchCostOf(rt, capability);
  }

  // ---------- WDP：最小费用流精确求解 ----------

  /**
   * 求解给定估值折价 λ、成本乘子 μ、给定可用 agent 集合下的仿射最优分配。
   * score = v − λ − μ·b ≤ 0 的组合不建边（免费处置，等价于不分配）。
   * μ=1 且 λ=0 即经典福利最大化；μ>1 为仿射最大化器（markup 几何）。
   */
  private solveWDP(
    capabilities: string[],
    lambda: number,
    excludeAgent?: string,
    mu = 1
  ): Array<{ taskIdx: number; agentId: string }> {
    const rts = [...this.agents.values()].filter((rt) => rt.spec.id !== excludeAgent);
    const T = capabilities.length;
    if (T === 0 || rts.length === 0) return [];

    const S = 0;
    const sink = 1 + rts.length + T;
    const mcf = new MinCostFlow(sink + 1);
    for (let a = 0; a < rts.length; a++) {
      mcf.addEdge(S, 1 + a, rts[a].spec.capacity, 0);
    }
    const pairEdges: Array<{ ref: { from: number; idx: number }; taskIdx: number; agentId: string }> = [];
    for (let a = 0; a < rts.length; a++) {
      const rt = rts[a];
      const bid = this.bidOf(rt);
      for (let t = 0; t < T; t++) {
        const cap = capabilities[t];
        if (!rt.spec.capabilities.includes(cap)) continue;
        const score = this.valueOf(rt, cap) - lambda - mu * bid;
        if (score <= 0) continue; // 免费处置：负分组合永不入最优解
        const ref = mcf.addEdge(1 + a, 1 + rts.length + t, 1, -score);
        pairEdges.push({ ref, taskIdx: t, agentId: rt.spec.id });
      }
    }
    for (let t = 0; t < T; t++) {
      mcf.addEdge(1 + rts.length + t, sink, 1, 0);
    }
    mcf.run(S, sink);
    return pairEdges.filter((pe) => mcf.edgeOccupied(pe.ref)).map((pe) => ({
      taskIdx: pe.taskIdx,
      agentId: pe.agentId
    }));
  }

  /** 指定 λ 下的分配福利 Σ(ṽ − b) */
  private welfareOf(
    capabilities: string[],
    pairs: Array<{ taskIdx: number; agentId: string }>,
    lambda: number
  ): number {
    let w = 0;
    for (const p of pairs) {
      const rt = this.agents.get(p.agentId)!;
      const cap = capabilities[p.taskIdx];
      w += this.valueOf(rt, cap) - lambda - this.bidOf(rt);
    }
    return w;
  }

  /** 给定 λ 的分配 + bundle 级 Clarke pivot 支付 */
  private solveWithPayments(
    capabilities: string[],
    lambda: number
  ): { pairs: Array<{ taskIdx: number; agentId: string }>; payments: Record<string, number>; total: number } {
    const pairs = this.solveWDP(capabilities, lambda);
    const W = this.welfareOf(capabilities, pairs, lambda);
    const counts = new Map<string, number>();
    for (const p of pairs) counts.set(p.agentId, (counts.get(p.agentId) ?? 0) + 1);
    const payments: Record<string, number> = {};
    let total = 0;
    for (const agentId of counts.keys()) {
      const rt = this.agents.get(agentId)!;
      const wWithout = this.welfareOf(capabilities, this.solveWDP(capabilities, lambda, agentId), lambda);
      // p_i = b_i·k_i + (W* − W*_{−i})，自动落在 [b_i·k_i, ṽ_i(X_i)] 内
      const pay = this.bidOf(rt) * counts.get(agentId)! + (W - wWithout);
      payments[agentId] = Math.round(pay * 1e9) / 1e9;
      total += payments[agentId];
    }
    return { pairs, payments, total };
  }

  // ---------- 对外主接口 ----------

  /**
   * 批量分配 + 定价。
   * budget = 每批现金支付上限 Σp ≤ B（默认 Infinity → 精确 VCG 路径）。
   * 预算紧时按拉格朗日影子价格 λ 对估值折价，二分最小可行 λ。
   */
  allocateBatch(capabilities: string[], opts: { budget?: number } = {}): BatchAllocation {
    const budget = opts.budget ?? Infinity;
    const exact = this.solveWithPayments(capabilities, 0);
    const maxWelfare = this.welfareOf(capabilities, exact.pairs, 0);

    const build = (
      pairs: Array<{ taskIdx: number; agentId: string }>,
      payments: Record<string, number>,
      lambda: number
    ): BatchAllocation => {
      const total = Object.values(payments).reduce((a, b) => a + b, 0);
      const realWelfare = this.welfareOf(capabilities, pairs, 0);
      const assignments: BatchAssignment[] = pairs
        .slice()
        .sort((a, b) => a.taskIdx - b.taskIdx)
        .map((p) => ({
          taskId: `t${++this.taskSeq}`,
          agentId: p.agentId,
          capability: capabilities[p.taskIdx],
          paymentShare: 0
        }));
      const byAgent = new Map<string, number>();
      for (const p of pairs) byAgent.set(p.agentId, (byAgent.get(p.agentId) ?? 0) + 1);
      for (const a of assignments) {
        a.paymentShare = payments[a.agentId] / byAgent.get(a.agentId)!;
      }
      // platformTake = Σv − Σp：用 λ=0 的真实估值核算
      let vSum = 0;
      for (const p of pairs) {
        const rt = this.agents.get(p.agentId)!;
        vSum += this.valueOf(rt, capabilities[p.taskIdx]);
      }
      const alloc: BatchAllocation = {
        assignments,
        payments,
        totalPayment: Math.round(total * 1e9) / 1e9,
        welfare: Math.round(realWelfare * 1e9) / 1e9,
        maxWelfare: Math.round(maxWelfare * 1e9) / 1e9,
        efficiencyLoss: Math.round((maxWelfare - realWelfare) * 1e9) / 1e9,
        platformTake: Math.round((vSum - total) * 1e9) / 1e9,
        lambda: Math.round(lambda * 1e9) / 1e9,
        droppedTasks: capabilities.length - pairs.length,
        budget,
        exactDSIC: lambda === 0
      };
      return alloc;
    };

    if (exact.total <= budget + 1e-9) {
      this.lastAllocation = build(exact.pairs, exact.payments, 0);
      return this.lastAllocation;
    }

    // ---- 预算紧：拉格朗日松弛，二分最小可行 λ ----
    let lambdaMax = 1;
    for (const rt of this.agents.values()) {
      for (const cap of rt.spec.capabilities) {
        lambdaMax = Math.max(lambdaMax, this.valueOf(rt, cap) + 1);
      }
    }
    // λ = λmax 时所有组合 score < 0 → 空分配，Σp = 0 ≤ B 恒可行
    let lo = 0; // 不可行
    let hi = lambdaMax; // 可行
    let best = this.solveWithPayments(capabilities, hi);
    for (let iter = 0; iter < 60; iter++) {
      const mid = (lo + hi) / 2;
      const cand = this.solveWithPayments(capabilities, mid);
      if (cand.total <= budget + 1e-9) {
        hi = mid;
        best = cand;
      } else {
        lo = mid;
      }
    }
    this.lastAllocation = build(best.pairs, best.payments, hi);
    return this.lastAllocation;
  }

  /**
   * 仿射乘子批量分配（μ-VCG）：公开常数 (λ, μ) 下的精确 DSIC 机制。
   *
   * 定理（精确 DSIC + IR）：设 (λ, μ) 不依赖当批报价（公开政策常数、
   * 或由历史批次校准——如 BudgetPacer），则机制
   *     X* = argmax Φ(X)，Φ(X) = Σ(v−λ) − μ·Σb
   *     p_i = b_i·k_i + [Φ(X*) − Φ(X_{−i})] / μ
   * 是占优策略激励相容的，且 p_i ≥ b_i·k_i（IR）。
   *
   * 证明梗概：固定他人报价，令 Ψ(X) = (1/μ)(Σv(X)−λ|X|) − Σ_{j≠i}b_j(X) − c_i(X_i)。
   * 机制选 X* = argmax[Ψ(X) − (b_i−c_i)(X_i)]，支付使 u_i = Ψ(X*) − Φ(X_{−i})/μ。
   * 如实报价（b_i = c_i）时 X* 最大化 Ψ → u_i 取最大值；
   * 任何偏离只能诱导 Ψ 更小的分配 → 无利可图。IR 由 Φ(X*) ≥ Φ(X_{−i})（X_{−i} 的
   * 可行域是 X 的子域）直接得出。∎
   *
   * 注意：若调用方用「当批报价」二分出 μ 再传入，DSIC 保证失效（反馈回路），
   * 此时应使用 allocateBatch 的 λ 路径并在结果中读取 exactDSIC=false。
   */
  allocateAffineBatch(
    capabilities: string[],
    opts: { lambda?: number; mu?: number } = {}
  ): BatchAllocation {
    const lambda = opts.lambda ?? 0;
    const mu = Math.max(1, opts.mu ?? 1);
    const pairs = this.solveWDP(capabilities, lambda, undefined, mu);

    const phiOf = (ps: Array<{ taskIdx: number; agentId: string }>): number => {
      let s = 0;
      for (const p of ps) {
        const rt = this.agents.get(p.agentId)!;
        s += this.valueOf(rt, capabilities[p.taskIdx]) - lambda - mu * this.bidOf(rt);
      }
      return s;
    };
    const phiStar = phiOf(pairs);

    const counts = new Map<string, number>();
    for (const p of pairs) counts.set(p.agentId, (counts.get(p.agentId) ?? 0) + 1);
    const payments: Record<string, number> = {};
    let total = 0;
    for (const agentId of counts.keys()) {
      const rt = this.agents.get(agentId)!;
      const phiWithout = phiOf(this.solveWDP(capabilities, lambda, agentId, mu));
      const pay = this.bidOf(rt) * counts.get(agentId)! + (phiStar - phiWithout) / mu;
      payments[agentId] = Math.round(pay * 1e9) / 1e9;
      total += payments[agentId];
    }

    // 真实福利核算（λ=0、μ=1 口径）
    let realWelfare = 0;
    let vSum = 0;
    for (const p of pairs) {
      const rt = this.agents.get(p.agentId)!;
      const v = this.valueOf(rt, capabilities[p.taskIdx]);
      vSum += v;
      realWelfare += v - this.bidOf(rt);
    }
    const maxWelfare = this.welfareOf(capabilities, this.solveWDP(capabilities, 0), 0);

    const assignments: BatchAssignment[] = pairs
      .slice()
      .sort((a, b) => a.taskIdx - b.taskIdx)
      .map((p) => ({
        taskId: `t${++this.taskSeq}`,
        agentId: p.agentId,
        capability: capabilities[p.taskIdx],
        paymentShare: 0
      }));
    for (const a of assignments) {
      a.paymentShare = payments[a.agentId] / counts.get(a.agentId)!;
    }

    const alloc: BatchAllocation = {
      assignments,
      payments,
      totalPayment: Math.round(total * 1e9) / 1e9,
      welfare: Math.round(realWelfare * 1e9) / 1e9,
      maxWelfare: Math.round(maxWelfare * 1e9) / 1e9,
      efficiencyLoss: Math.round((maxWelfare - realWelfare) * 1e9) / 1e9,
      platformTake: Math.round((vSum - total) * 1e9) / 1e9,
      lambda: Math.round(lambda * 1e9) / 1e9,
      mu: Math.round(mu * 1e9) / 1e9,
      droppedTasks: capabilities.length - pairs.length,
      budget: Infinity,
      exactDSIC: true
    };
    this.lastAllocation = alloc;
    return alloc;
  }

  /**
   * 逐任务"短视 VCG"基线：按任务贪心 + 单任务 pivot 支付。
   * 忽略批间替代效应，用于对照（低估赢家支付、分配可能次优）。
   */
  allocateMyopic(capabilities: string[]): BatchAllocation {
    const remaining = new Map<string, number>();
    for (const rt of this.agents.values()) remaining.set(rt.spec.id, rt.spec.capacity);
    const assignments: BatchAssignment[] = [];
    const payments: Record<string, number> = {};
    let vSum = 0;
    let welfare = 0;

    capabilities.forEach((cap, t) => {
      void t;
      const cands = [...this.agents.values()].filter(
        (rt) => rt.spec.capabilities.includes(cap) && (remaining.get(rt.spec.id) ?? 0) > 0
      );
      if (cands.length === 0) return;
      const scored = cands.map((rt) => {
        const v = this.valueOf(rt, cap);
        return { rt, v, s: v - this.bidOf(rt) };
      });
      scored.sort((a, b) => b.s - a.s || a.rt.spec.id.localeCompare(b.rt.spec.id));
      const winner = scored[0];
      const second = scored[1];
      const pay = Math.min(Math.max(winner.v - (second?.s ?? 0), 0), winner.v);
      payments[winner.rt.spec.id] = (payments[winner.rt.spec.id] ?? 0) + pay;
      remaining.set(winner.rt.spec.id, remaining.get(winner.rt.spec.id)! - 1);
      assignments.push({
        taskId: `t${++this.taskSeq}`,
        agentId: winner.rt.spec.id,
        capability: cap,
        paymentShare: pay
      });
      vSum += winner.v;
      welfare += winner.s;
    });

    const total = Object.values(payments).reduce((a, b) => a + b, 0);
    const alloc: BatchAllocation = {
      assignments,
      payments,
      totalPayment: Math.round(total * 1e9) / 1e9,
      welfare: Math.round(welfare * 1e9) / 1e9,
      maxWelfare: this.welfareOf(capabilities, this.solveWDP(capabilities, 0), 0),
      efficiencyLoss: 0,
      platformTake: Math.round((vSum - total) * 1e9) / 1e9,
      lambda: 0,
      droppedTasks: capabilities.length - assignments.length,
      budget: Infinity,
      exactDSIC: false
    };
    alloc.efficiencyLoss = Math.round((alloc.maxWelfare - alloc.welfare) * 1e9) / 1e9;
    return alloc;
  }

  /** 结算上一批分配：更新公开履历（按能力成功率 / 上下文资本 / 声誉） */
  settleBatch(results: Array<{ taskId: string; success: boolean }>): void {
    if (!this.lastAllocation) throw new Error('没有待结算的批次');
    const byTask = new Map(this.lastAllocation.assignments.map((a) => [a.taskId, a]));
    for (const r of results) {
      const a = byTask.get(r.taskId);
      if (!a) throw new Error(`任务不属于当前批次: ${r.taskId}`);
      const rt = this.agents.get(a.agentId)!;
      rt.attempts.set(a.capability, (rt.attempts.get(a.capability) ?? 0) + 1);
      rt.successes.set(a.capability, (rt.successes.get(a.capability) ?? 0) + (r.success ? 1 : 0));
      rt.capital.set(a.capability, (rt.capital.get(a.capability) ?? 0) + 1);
      rt.totalAttempts++;
      rt.reputation =
        rt.reputation * (1 - this.config.reputationAlpha) + (r.success ? 1 : 0) * this.config.reputationAlpha;
      const pay = this.lastAllocation.payments[a.agentId] ?? 0;
      const k = this.lastAllocation.assignments.filter((x) => x.agentId === a.agentId).length;
      rt.profit += pay / k - rt.spec.trueCost;
    }
    this.lastAllocation = null;
  }

  /** 分配 + 模拟执行 + 结算（读取私有信息，仅实验用）。
   * 传 affine 时走 μ-VCG 路径（公开乘子，精确 DSIC）。 */
  simulateBatch(
    capabilities: string[],
    opts: { budget?: number; affine?: { lambda?: number; mu?: number } } = {}
  ): { allocation: BatchAllocation; settlements: BatchSettlement[]; netWelfare: number } {
    const allocation = opts.affine
      ? this.allocateAffineBatch(capabilities, opts.affine)
      : this.allocateBatch(capabilities, opts);
    const settlements: BatchSettlement[] = [];
    let welfare = 0;
    const capitalBefore = new Map<string, number>();
    const results: Array<{ taskId: string; success: boolean }> = [];

    for (const a of allocation.assignments) {
      const rt = this.agents.get(a.agentId)!;
      const cap = a.capability;
      const k0 = rt.capital.get(cap) ?? 0;
      capitalBefore.set(a.taskId, k0);
      const dom = this.dominantOf(rt);
      const base = rt.spec.trueQuality[cap] ?? 0;
      const { learningCeiling: alpha, learningRate: beta } = this.config;
      const qEff = Math.min(1, base + alpha * (1 - base) * (1 - Math.exp(-beta * k0)));
      const success = this.rng() < qEff;
      const penalty =
        dom && dom !== cap ? this.config.switchCostRate * (rt.capital.get(dom) ?? 0) : 0;
      const actualCost = rt.spec.trueCost * (1 + penalty);
      const k = allocation.assignments.filter((x) => x.agentId === a.agentId).length;
      const pay = (allocation.payments[a.agentId] ?? 0) / k;
      settlements.push({ taskId: a.taskId, agentId: a.agentId, success, payment: pay, actualCost });
      welfare += (success ? this.config.successValue : 0) - actualCost;
      results.push({ taskId: a.taskId, success });
    }
    if (results.length > 0) this.settleBatch(results);
    this.netWelfare += welfare;
    for (const r of results) this.history.push({ success: r.success });
    return { allocation, settlements, netWelfare: Math.round(welfare * 100) / 100 };
  }

  /**
   * 实证测量策略性虚报的收益（固定公开履历，只改该 agent 的 markup）。
   * 预算不紧或公开仿射乘子时应为 0（精确 DSIC）；λ-bisection 路径报告偏离幅度。
   * 传 affine 时按 μ-VCG 路径评估（该路径的 DSIC 实证证书）。
   */
  measureMisreportGain(
    capabilities: string[],
    agentId: string,
    markups: number[],
    opts: { budget?: number; affine?: { lambda?: number; mu?: number } } = {}
  ): { maxGain: number; bestMarkup: number; details: Array<{ markup: number; utility: number }> } {
    const savedLast = this.lastAllocation;
    const rt = this.agents.get(agentId);
    if (!rt) throw new Error(`未知 agent: ${agentId}`);
    const savedMarkup = rt.spec.bidMarkup;

    const run = (): BatchAllocation =>
      opts.affine
        ? this.allocateAffineBatch(capabilities, opts.affine)
        : this.allocateBatch(capabilities, { budget: opts.budget });

    const utilityOf = (alloc: BatchAllocation): number => {
      const k = alloc.assignments.filter((a) => a.agentId === agentId).length;
      return (alloc.payments[agentId] ?? 0) - rt.spec.trueCost * k;
    };

    const truthful = utilityOf(run());
    const details: Array<{ markup: number; utility: number }> = [{ markup: savedMarkup ?? 0, utility: truthful }];
    let maxGain = 0;
    let bestMarkup = savedMarkup ?? 0;
    for (const m of markups) {
      rt.spec.bidMarkup = m;
      const u = utilityOf(run());
      details.push({ markup: m, utility: u });
      if (u - truthful > maxGain) {
        maxGain = u - truthful;
        bestMarkup = m;
      }
    }
    rt.spec.bidMarkup = savedMarkup;
    this.lastAllocation = savedLast;
    return { maxGain: Math.round(maxGain * 1e9) / 1e9, bestMarkup, details };
  }

  // ---------- 指标 ----------

  getWindowSuccessRate(from: number, to: number): number {
    const slice = this.history.slice(from, to);
    if (slice.length === 0) return 0;
    return slice.filter((x) => x.success).length / slice.length;
  }

  getNetWelfare(): number {
    return Math.round(this.netWelfare * 100) / 100;
  }

  getSettledCount(): number {
    return this.history.length;
  }

  getSnapshot(): Array<{
    id: string;
    attempts: Record<string, number>;
    successes: Record<string, number>;
    capital: Record<string, number>;
    reputation: number;
    profit: number;
  }> {
    return [...this.agents.values()].map((rt) => ({
      id: rt.spec.id,
      attempts: Object.fromEntries(rt.attempts),
      successes: Object.fromEntries(rt.successes),
      capital: Object.fromEntries(rt.capital),
      reputation: Math.round(rt.reputation * 1000) / 1000,
      profit: Math.round(rt.profit * 100) / 100
    }));
  }
}

/**
 * 预算 pacemaker：用历史批次的公开支付在线校准仿射乘子 μ_t。
 *
 * 更新规则（对数空间对偶上升）：μ_{t+1} = clip(μ_t · (Σp_t / B)^κ)。
 * - 超支（Σp_t > B）→ μ 上升：markup 收紧，支付按 1/μ 压缩、边际任务弃标；
 * - 节余 → μ 向 1 衰减：恢复接近经典 VCG 的支付水平。
 * - κ ∈ (0,1] 为步长阻尼（κ=0.5 经验稳健）。
 *
 * 关键性质：μ_t 只依赖「已结算的过去」→ 对当批报价是公开常数，
 * 因此每批的 μ-VCG 保持精确 DSIC——预算从"机制设计牺牲"降格为"控制问题"。
 * 与广告平台预算 pacing 同构：对偶变量是采购 markup，而非买方出价折扣。
 */
export class BudgetPacer {
  private mu = 1;

  constructor(
    private readonly budget: number,
    private readonly kappa = 0.5,
    private readonly maxMu = 100
  ) {}

  /** 当前公开乘子（对当批所有 agent 同时可见、先于报价确定） */
  getMu(): number {
    return this.mu;
  }

  /** 每批结算后调用：spend = 该批实际总支付 */
  update(spend: number): void {
    if (this.budget <= 0 || spend < 0) return;
    const ratio = spend / this.budget;
    this.mu = Math.min(this.maxMu, Math.max(1, this.mu * Math.pow(ratio, this.kappa)));
  }
}
