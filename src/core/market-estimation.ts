/**
 * 市场机制共享估值层
 *
 * GrowthMarketScheduler（单任务市场）与 BatchVCGScheduler（批量 VCG 拍卖）
 * 对「公开履历 → 估值」使用同一套语义：贝叶斯质量估计、UCB 探索奖励、
 * 专业化切换成本、学习曲线有效质量、声誉 EWMA、结算历史窗口。
 * 此前两处各持有一份近似逐字相同的实现，任何修正都要改两遍——
 * 现在统一在这里，机制代码只保留各自的分配与支付逻辑。
 *
 * 口径约定（两个消费方都必须遵守）：
 * - 本层只消费「公开履历 + 报价」，绝不读取 trueQuality/trueCost
 *   （那是 simulate 结算的私有信息通道）；
 * - totalPulls 采用全局口径（不随 VCG 排除集变化），保证支付一致性。
 */

export interface EstimatorParams {
  /** 无历史记录时的质量先验 */
  priorQuality: number;
  /** 质量先验的虚拟样本权重 k0 */
  priorWeight: number;
  /** UCB 探索系数 */
  exploreCoefficient: number;
  /** 切换成本率 τ */
  switchCostRate: number;
  /** 任务成功的社会价值 V */
  successValue: number;
}

/** 机制可见的 agent 履历（两个调度器的 AgentRuntime 的公共子集） */
export interface MarketAgentRecord {
  spec: {
    trueCost: number;
    /** 报价加成：0 = 如实报价 */
    bidMarkup?: number;
    /** 可验证凭证（公开信息；缺省回退 priorQuality） */
    credentialQuality?: Record<string, number>;
  };
  attempts: Map<string, number>;
  successes: Map<string, number>;
  capital: Map<string, number>;
}

/** Agent 报价：真实成本 × (1 + 加成)。机制不读 trueCost，只读 bid */
export function bidOf(rt: MarketAgentRecord): number {
  return rt.spec.trueCost * (1 + (rt.spec.bidMarkup ?? 0));
}

/** 贝叶斯质量估计：按能力的历史成功率向（凭证或全局）先验收缩 */
export function estimateQuality(
  rt: MarketAgentRecord,
  capability: string,
  params: EstimatorParams,
): number {
  const n = rt.attempts.get(capability) ?? 0;
  const s = rt.successes.get(capability) ?? 0;
  const prior = rt.spec.credentialQuality?.[capability] ?? params.priorQuality;
  return (s + prior * params.priorWeight) / (n + params.priorWeight);
}

/** 主专业：上下文资本最高的能力 */
export function dominantOf(rt: MarketAgentRecord): string | null {
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
export function switchCostOf(
  rt: MarketAgentRecord,
  capability: string,
  params: EstimatorParams,
): number {
  const dominant = dominantOf(rt);
  if (!dominant || dominant === capability) {
    return 0;
  }
  return params.switchCostRate * (rt.capital.get(dominant) ?? 0);
}

/** UCB 探索奖励：尝试少的 agent 获得原则性的估值加成 */
export function exploreBonus(attempts: number, totalPulls: number, coefficient: number): number {
  return coefficient * Math.sqrt(Math.log(1 + totalPulls) / (1 + attempts));
}

/** 公开社会价值：V·q̂ + UCB 探索奖励 − 切换成本 */
export function socialValueOf(
  rt: MarketAgentRecord,
  capability: string,
  totalPulls: number,
  params: EstimatorParams,
): number {
  const q = estimateQuality(rt, capability, params);
  const n = rt.attempts.get(capability) ?? 0;
  return (
    params.successValue * q +
    exploreBonus(n, totalPulls, params.exploreCoefficient) -
    switchCostOf(rt, capability, params)
  );
}

/**
 * 学习曲线有效质量（模拟结算的私有信息通道，机制代码不得调用）：
 * qEff = min(1, base + α·(1−base)·(1−e^{−β·capital}))。
 */
export function effectiveQuality(
  base: number,
  capital: number,
  learningCeiling: number,
  learningRate: number,
): number {
  return Math.min(1, base + learningCeiling * (1 - base) * (1 - Math.exp(-learningRate * capital)));
}

/** 声誉 EWMA 更新 */
export function updateReputation(reputation: number, success: boolean, alpha: number): number {
  return reputation * (1 - alpha) + (success ? 1 : 0) * alpha;
}

/** 结算成功后按能力累积履历（attempts/successes/capital 同步 +1） */
export function recordSettlement(
  rt: MarketAgentRecord,
  capability: string,
  success: boolean,
): void {
  rt.attempts.set(capability, (rt.attempts.get(capability) ?? 0) + 1);
  rt.successes.set(capability, (rt.successes.get(capability) ?? 0) + (success ? 1 : 0));
  rt.capital.set(capability, (rt.capital.get(capability) ?? 0) + 1);
}

/** 结算历史环形窗口：滑动统计不需要无限历史，长运行防内存无界增长 */
export class SettlementHistory {
  private readonly entries: boolean[] = [];
  private readonly cap: number;

  constructor(cap = 10000) {
    this.cap = cap;
  }

  push(success: boolean): void {
    this.entries.push(success);
    if (this.entries.length > this.cap) {
      this.entries.splice(0, this.entries.length - this.cap);
    }
  }

  /** [from, to) 窗口内的成功率（按结算顺序） */
  successRate(from: number, to: number): number {
    const slice = this.entries.slice(from, to);
    if (slice.length === 0) return 0;
    return slice.filter(Boolean).length / slice.length;
  }

  get size(): number {
    return this.entries.length;
  }
}
