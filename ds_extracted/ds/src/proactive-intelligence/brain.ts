/**
 * 增长调度器 Brain —— 主动智能插件的市场决策大脑
 *
 * 把 GrowthMarketScheduler 接入 ProactiveIntelligencePlugin 的决策回路：
 *   - 感知：monitor 的 task_request 事件 → 提交增长市场（VCG 定价 + 学习资本 + UCB 探索）；
 *   - 决策：市场清算产出 assignment（赢家 + 支付），作为 'assignment' 动作执行；
 *   - 反馈：执行结束后 settleTask 回写成败 → 学习曲线 / 声誉 / 专业化更新；
 *   - 状态：getState() 注入 DecisionContext.currentState.brain，
 *     规则可用 'brain.successRate'、'brain.netWelfare' 等字段联动市场健康度。
 *
 * 设计原则：Brain 不替代规则引擎——规则负责「何时干预」，
 * Brain 负责「任务交给谁」的持续最优分配（增长最大化目标）。
 */

import {
  GrowthMarketScheduler,
  type GrowthSchedulerConfig,
  type GrowthAgentSpec,
  type TaskAssignment,
  type AgentSnapshot,
} from '../core/growth-market-scheduler.js';

export interface BrainState {
  /** 市场累计净福利 */
  netWelfare: number;
  /** 已结算任务数 */
  settledCount: number;
  /** 全窗口成功率（settledCount=0 时为 null——「无数据」不得报告为 100%） */
  successRate: number | null;
  /** 在途（已分配未结算）任务数 */
  openTasks: number;
  /** 各 agent 的公开快照（学习资本 / 专业化 / 利润） */
  agents: AgentSnapshot[];
}

/** 市场分配结果（submitTask 返回；无可行赢家时为 null） */
export interface BrainAssignment {
  taskId: string;
  winnerId?: string;
  agentId?: string;
  capability: string;
  payment: number;
  socialValue?: number;
}

/**
 * MarketBrain —— 插件决策大脑的结构化接口。
 * 任何满足该接口的市场机制均可接入：GrowthSchedulerBrain（单任务 VCG +
 * 学习资本）、CompoundBrain（批量增长增广 VCG + 在线校准 + 相变定律顾问）等。
 * 泛型参数让各实现携带自己的状态/参与者形状（替代 getState(): object、
 * registerAgent(spec: unknown) 这类无信息量签名）；默认 unknown 保持
 * 插件层「形状由 Brain 自决、规则按动态路径读取」的既有契约。
 */
export interface MarketBrain<TState = unknown, TAgentSpec = unknown> {
  /** 提交任务：市场清算返回分配（赢家 + 支付），无可行赢家返回 null */
  submitTask(capability: string): BrainAssignment | null;
  /** 结算：回写成败，驱动学习/声誉/校准更新 */
  settleTask(taskId: string, success: boolean): boolean;
  /** 公开决策状态（注入规则条件 'brain.*'） */
  getState(): TState;
  /** 注册市场参与者（可选：插件允许外部 brain 缺省实现） */
  registerAgent?(spec: TAgentSpec): unknown;
}

export class GrowthSchedulerBrain implements MarketBrain<BrainState, GrowthAgentSpec> {
  private readonly scheduler: GrowthMarketScheduler;
  /** 已分配未结算的任务（taskId → 提交时间；过期清扫见 OPEN_TASK_TTL_MS） */
  private readonly openTasks = new Map<string, number>();

  constructor(config: Partial<GrowthSchedulerConfig> = {}) {
    this.scheduler = new GrowthMarketScheduler(config);
  }

  /**
   * 在途任务的滞留上限：漏 settle 的任务按提交时间过期出账，
   * 否则 openTasks 永久虚高（健康度指标失真且无从发现）。
   * 1 小时对任务级分配是保守下界，真实部署可按任务 SLA 配置。
   */
  private static readonly OPEN_TASK_TTL_MS = 3_600_000;

  /** 清扫过期在途任务（O(过期数)，Map 迭代序即插入序=时间序） */
  private sweepExpiredOpenTasks(): void {
    const cutoff = Date.now() - GrowthSchedulerBrain.OPEN_TASK_TTL_MS;
    for (const [taskId, submittedAt] of this.openTasks) {
      if (submittedAt >= cutoff) break; // 时间序单调，首个未过期即可停
      this.openTasks.delete(taskId);
    }
  }

  /** 注册 agent（能力 / 成本 / 质量为私有信息，机制按报价与履历定价） */
  registerAgent(spec: GrowthAgentSpec): this {
    this.scheduler.register(spec);
    return this;
  }

  /**
   * 提交任务给增长市场：分配 + VCG 支付定价。
   * 无可行赢家（无人具备能力或估值不抵报价）时返回 null。
   */
  submitTask(capability: string): TaskAssignment | null {
    this.sweepExpiredOpenTasks();
    const assignment = this.scheduler.submitTask(capability);
    if (assignment) this.openTasks.set(assignment.taskId, Date.now());
    return assignment;
  }

  /**
   * 结算任务：回写成败，驱动学习曲线（上下文资本）与声誉更新。
   * 由执行器完成 assignment 后调用（真实执行结果来自外部回调）。
   */
  settleTask(taskId: string, success: boolean): boolean {
    this.sweepExpiredOpenTasks();
    if (!this.openTasks.has(taskId)) return false;
    this.openTasks.delete(taskId);
    this.scheduler.completeTask(taskId, success);
    return true;
  }

  /** 公开决策状态：注入规则引擎的 currentState.brain */
  getState(): BrainState {
    this.sweepExpiredOpenTasks();
    const settled = this.scheduler.getSettledCount();
    return {
      netWelfare: this.scheduler.getNetWelfare(),
      settledCount: settled,
      successRate: settled > 0 ? this.scheduler.getWindowSuccessRate(0, settled) : null,
      openTasks: this.openTasks.size,
      agents: this.scheduler.getSnapshot(),
    };
  }

  // simulateTask 包装已按死代码清偿删除：全仓零调用点（实验与示例直接
  // 使用 GrowthMarketScheduler.simulateTask），且它绕过 openTasks 记账，
  // 经 Brain 模拟反而会造成在途口径失真。真实闭环走 submitTask+settleTask。
}

export type { GrowthSchedulerConfig, GrowthAgentSpec, TaskAssignment, AgentSnapshot };
