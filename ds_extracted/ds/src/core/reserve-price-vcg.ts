/**
 * reserve-price-vcg —— 带公开保留价（采购价格上限）的批量 VCG 变体（R14-D）
 *
 * ============ 机制陈述 ============
 *
 * 既有市场面（batch-vcg-scheduler）提供：精确批量 VCG / λ-bisection 预算
 * 松弛 / μ-VCG 仿射乘子。本模块补上第三种公开控制旋钮：**保留价**
 * （procurement reserve / 价格上限）——报价高于保留价的 (agent, 能力) 对
 * **丧失资格**（不进入分配与支付的反事实可行域）。
 *
 * 定理（精确 DSIC + IR）：保留价是公开常数，资格截除只通过「自身报价
 * 是否 ≤ 保留价」作用于可行域，支付保持 Groves/仿射 pivot 不变，则机制
 * 仍精确 DSIC 且个体理性。证明梗概：给定他人报价，agent i 的支付在
 * **给定被选分配 X** 下与自身报价无关（Clarke 项 b_i·k_i 与 Φ 中的 −b_i·k_i
 * 相消，与 μ-VCG 同一论证）；如实报价时机制最大化 u_i + Φ(X_{−i})，任何
 * 虚报只能（a）诱导 Φ 更小的分配，或（b）把自身报价顶过保留价而被整体
 * 排除（效用 0 ≤ 如实效用，IR 由截除域上的 Clarke 项 ≥ 0 保证）。∎
 * 与 μ 组合：Φ_μ(X) = Σ(v − μ·b) 在截除后的可行域上仍是仿射最大化器
 * （Roberts 定理族），(保留价, μ) 同为公开常数 ⇒ 组合机制保持精确 DSIC。
 *
 * ============ 诚实边界（测试钉死） ============
 * - 保留价约束的是**资格**（报价上限），不是**支付水平**：垄断情形下
 *  Clarke pivot 仍支付 v（测试专门钉住这一点）。支付水平控制属于 μ
 *  （markup 几何），两者经公开常数正交组合。
 * - 竞争市场上收紧保留价会**抬高**在位赢家的 pivot 支付（把贵的替代者
 *  从反事实可行域中移走 ⇒ W_{−i} 下降）——这是机制的如实性质，不是缺陷。
 * - 估值来自公开履历（market-estimation 共享层），与既有机制同口径；
 *   trueCost/trueQuality 仅为实验结算的私有通道，本模块不读。
 *
 * ============ 与既有能力的关系 ============
 * - λ-bisection：预算硬约束 / 牺牲 DSIC；μ-VCG：支付水平 / 精确 DSIC；
 *   保留价（本模块）：准入资格 / 精确 DSIC——三者互不重复，可组合
 *   （λ 与保留价组合时 DSIC 断言同样失效，与既有 λ 路径同因，不提供）。
 * - 本模块是 opt-in 纯函数面：不持有状态、不被既有文件 import（编排者
 *   收口接线）；复用 MinCostFlow 与 market-estimation 的公共导出。
 */

import { MinCostFlow, type FlowEdgeRef } from './min-cost-flow.js';
import {
  bidOf,
  socialValueOf,
  type EstimatorParams,
  type MarketAgentRecord,
} from './market-estimation.js';
import { round9 } from '../utils/numeric.js';
import { MechanismError } from '../utils/errors.js';

/** 参与保留价机制的 agent：公开身份 + 履历（record 形状即共享估值层口径） */
export interface ReservePriceAgent {
  id: string;
  capabilities: string[];
  /** 同批最大并发任务数（0 = 永不中标，合法退化） */
  capacity: number;
  /** 公开履历（估值只读 spec/attempts/successes/capital） */
  record: MarketAgentRecord;
}

/**
 * 保留价日程：统一数值，或按能力的映射（default 为缺省，perCapability
 * 覆盖特定能力；Infinity = 该能力无上限——退化为经典 VCG）。
 */
export type ReserveSchedule =
  | number
  | {
      default?: number;
      perCapability?: Record<string, number>;
    };

/** 保留价分配结果（口径与 BatchAllocation 对齐的子集 + 保留价诊断） */
export interface ReservePriceAllocation {
  assignments: Array<{ taskId: string; agentId: string; capability: string; paymentShare: number }>;
  /** 按 agent 计的 pivot 支付（机制真实口径） */
  payments: Record<string, number>;
  totalPayment: number;
  /** 实际分配的真实福利 Σ(v − b) */
  welfare: number;
  /** 无保留价最优福利（效率上界，诚实核算 efficiencyLoss 的分母） */
  maxWelfareNoReserve: number;
  efficiencyLoss: number;
  /** 平台剩余 = Σv − Σp */
  platformTake: number;
  droppedTasks: number;
  /** 资格相配但被保留价截除的 (agent, task) 对数（诊断） */
  excludedByReserve: number;
  /** 仿射乘子（缺省 1 = 经典 pivot） */
  mu: number;
}

/** 读取某能力的保留价（Infinity = 无上限）；导出供消费方与测试对账 */
export function reserveOfCapability(schedule: ReserveSchedule, capability: string): number {
  if (typeof schedule === 'number') return schedule;
  const per = schedule.perCapability?.[capability];
  if (per !== undefined) return per;
  return schedule.default ?? Infinity;
}

/** 保留价日程域校验：每个生效值须为有限非负数或 Infinity（负值/NaN 具名拒绝） */
function validateReserveSchedule(schedule: ReserveSchedule): void {
  const checkValue = (v: unknown, where: string): void => {
    if (typeof v !== 'number' || Number.isNaN(v) || v < 0) {
      throw new MechanismError(
        `reserve ${where} must be a non-negative finite number or Infinity, got ${String(v)}`,
      );
    }
  };
  if (typeof schedule === 'number') {
    checkValue(schedule, 'value');
    return;
  }
  checkValue(schedule.default ?? Infinity, "'default'");
  for (const [cap, v] of Object.entries(schedule.perCapability ?? {})) {
    checkValue(v, `for capability '${cap}'`);
  }
}

interface WdpResult {
  pairs: Array<{ taskIdx: number; agentId: string }>;
  /** 截除域上的仿射目标值 Φ = Σ(v − μ·b) */
  phi: number;
  /** λ=0、μ=1 口径的真实福利 Σ(v − b) */
  welfare: number;
}

/**
 * 带保留价资格截除的批量分配 + 定价（纯函数，无状态）。
 *
 * @param agents        参与者（公开履历 + 容量）
 * @param capabilities  任务能力序列（taskId 按输入序 t1..tn 生成）
 * @param params        共享估值参数（与 GrowthMarket/BatchVCG 同层）
 * @param reserve       公开保留价日程（报价 > 保留价的能力对丧失资格）
 * @param opts          mu ≥ 1 仿射乘子（缺省 1 = 经典 Clarke pivot）
 */
export function allocateWithReserve(
  agents: readonly ReservePriceAgent[],
  capabilities: readonly string[],
  params: EstimatorParams,
  reserve: ReserveSchedule,
  opts: { mu?: number } = {},
): ReservePriceAllocation {
  validateReserveSchedule(reserve);
  const mu = opts.mu ?? 1;
  if (typeof mu !== 'number' || !Number.isFinite(mu) || mu < 1) {
    throw new MechanismError(`mu must be a finite number ≥ 1, got ${String(opts.mu)}`);
  }
  const seen = new Set<string>();
  for (const agent of agents) {
    if (typeof agent.id !== 'string' || !agent.id) {
      throw new MechanismError(`agent id must be a non-empty string, got ${String(agent.id)}`);
    }
    if (seen.has(agent.id)) {
      throw new MechanismError(`Agent already registered: ${agent.id}`);
    }
    seen.add(agent.id);
    if (!Number.isInteger(agent.capacity) || agent.capacity < 0) {
      throw new MechanismError(
        `agent '${agent.id}' capacity must be a non-negative integer, got ${String(agent.capacity)}`,
      );
    }
    if (!Array.isArray(agent.capabilities)) {
      throw new MechanismError(`agent '${agent.id}' capabilities must be an array`);
    }
    const cost = agent.record.spec.trueCost;
    if (typeof cost !== 'number' || !Number.isFinite(cost)) {
      throw new MechanismError(
        `agent '${agent.id}' record.spec.trueCost must be a finite number, got ${String(cost)}`,
      );
    }
    const markup = agent.record.spec.bidMarkup;
    if (markup !== undefined && (typeof markup !== 'number' || !Number.isFinite(markup))) {
      throw new MechanismError(
        `agent '${agent.id}' record.spec.bidMarkup must be a finite number if present, got ${String(markup)}`,
      );
    }
  }
  for (let t = 0; t < capabilities.length; t++) {
    const cap = capabilities[t];
    if (typeof cap !== 'string' || !cap) {
      throw new MechanismError(`capabilities[${t}] must be a non-empty string, got ${String(cap)}`);
    }
  }

  // 全局口径的按能力尝试总数（不随排除集变化——支付一致性，同既有机制）
  const totalPullsOf = (capability: string): number => {
    let total = 0;
    for (const agent of agents) total += agent.record.attempts.get(capability) ?? 0;
    return total;
  };
  const valueOf = (agent: ReservePriceAgent, capability: string): number =>
    socialValueOf(agent.record, capability, totalPullsOf(capability), params);

  /** 资格判定：能力相配 && 报价 ≤ 保留价（保留价生效时） */
  const eligible = (
    agent: ReservePriceAgent,
    capability: string,
    reserveActive: boolean,
  ): boolean => {
    if (!agent.capabilities.includes(capability)) return false;
    if (reserveActive && bidOf(agent.record) > reserveOfCapability(reserve, capability)) {
      return false;
    }
    return true;
  };

  const solveWDP = (
    reserveActive: boolean,
    excludeAgent: string | undefined,
    muOf: number,
  ): WdpResult => {
    const active = agents.filter((a) => a.id !== excludeAgent);
    const T = capabilities.length;
    const S = 0;
    const sink = 1 + active.length + T;
    const mcf = new MinCostFlow(sink + 1);
    for (let a = 0; a < active.length; a++) {
      mcf.addEdge(S, 1 + a, active[a]!.capacity, 0);
    }
    const pairEdges: Array<{ ref: FlowEdgeRef; taskIdx: number; agentId: string }> = [];
    for (let a = 0; a < active.length; a++) {
      const agent = active[a]!;
      const bid = bidOf(agent.record);
      for (let t = 0; t < T; t++) {
        const cap = capabilities[t]!;
        if (!eligible(agent, cap, reserveActive)) continue;
        const score = valueOf(agent, cap) - muOf * bid;
        if (score <= 0) continue; // 免费处置：负分组合永不入最优解（同既有口径）
        const ref = mcf.addEdge(1 + a, 1 + active.length + t, 1, -score);
        pairEdges.push({ ref, taskIdx: t, agentId: agent.id });
      }
    }
    for (let t = 0; t < T; t++) {
      mcf.addEdge(1 + active.length + t, sink, 1, 0);
    }
    mcf.run(S, sink);
    const pairs = pairEdges
      .filter((pe) => mcf.edgeOccupied(pe.ref))
      .map((pe) => ({ taskIdx: pe.taskIdx, agentId: pe.agentId }));
    let phi = 0;
    let welfare = 0;
    for (const p of pairs) {
      const agent = agents.find((a) => a.id === p.agentId)!;
      const v = valueOf(agent, capabilities[p.taskIdx]!);
      const bid = bidOf(agent.record);
      phi += v - muOf * bid;
      welfare += v - bid;
    }
    return { pairs, phi, welfare };
  };

  // ---- 分配与支付（保留价生效域上） ----
  const primary = solveWDP(true, undefined, mu);
  const counts = new Map<string, number>();
  for (const p of primary.pairs) counts.set(p.agentId, (counts.get(p.agentId) ?? 0) + 1);

  const payments: Record<string, number> = {};
  let total = 0;
  for (const agentId of counts.keys()) {
    const agent = agents.find((a) => a.id === agentId)!;
    const without = solveWDP(true, agentId, mu);
    // p_i = b_i·k_i + (Φ* − Φ_{−i})/μ（μ=1 即经典 Clarke pivot）
    const pay = bidOf(agent.record) * (counts.get(agentId) ?? 0) + (primary.phi - without.phi) / mu;
    payments[agentId] = round9(pay);
    total += payments[agentId];
  }

  // ---- 诚实核算 ----
  const maxWelfareNoReserve = solveWDP(false, undefined, 1).welfare;
  let vSum = 0;
  for (const p of primary.pairs) {
    const agent = agents.find((a) => a.id === p.agentId)!;
    vSum += valueOf(agent, capabilities[p.taskIdx]!);
  }
  let excludedByReserve = 0;
  for (const agent of agents) {
    for (const cap of capabilities) {
      if (
        agent.capabilities.includes(cap) &&
        bidOf(agent.record) > reserveOfCapability(reserve, cap)
      ) {
        excludedByReserve++;
      }
    }
  }

  const assignments = primary.pairs
    .slice()
    .sort((a, b) => a.taskIdx - b.taskIdx)
    .map((p) => ({
      taskId: `t${p.taskIdx + 1}`,
      agentId: p.agentId,
      capability: capabilities[p.taskIdx]!,
      paymentShare: (payments[p.agentId] ?? 0) / (counts.get(p.agentId) ?? 1),
    }));

  return {
    assignments,
    payments,
    totalPayment: round9(total),
    welfare: round9(primary.welfare),
    maxWelfareNoReserve: round9(maxWelfareNoReserve),
    efficiencyLoss: round9(maxWelfareNoReserve - primary.welfare),
    platformTake: round9(vSum - total),
    droppedTasks: capabilities.length - primary.pairs.length,
    excludedByReserve,
    mu,
  };
}
