/**
 * 主动智能插件核心模块
 *
 * 提供自主感知、智能决策、主动干预的能力
 *
 * @module proactive-intelligence
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  GrowthSchedulerBrain,
  type MarketBrain,
  type BrainAssignment,
  type GrowthAgentSpec,
  type GrowthSchedulerConfig
} from './brain';

export { GrowthSchedulerBrain } from './brain';
export type { MarketBrain, BrainAssignment, BrainState, GrowthAgentSpec } from './brain';

// ============================================================================
// 类型定义
// ============================================================================

export interface MonitorEvent {
  id: string;
  type: string;
  source: string;
  timestamp: Date;
  /** 事件载荷（形状随事件类型变化，规则按「类型.字段」路径读取） */
  data: Record<string, unknown>;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

export interface DecisionContext {
  events: MonitorEvent[];
  /** 当前系统状态（形状由宿主决定，规则按「a.b」路径读取） */
  currentState: unknown;
  history: DecisionRecord[];
  rules: Rule[];
}

/** 单次决策的历史记录（DecisionEngine.getDecisionHistory 返回项） */
export interface DecisionRecord {
  timestamp: Date;
  context: DecisionContext;
  triggeredRules: string[];
  actions: Array<[string, Action[]]>;
}

export interface Rule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  conditions: Condition[];
  actions: Action[];
  cooldown: number; // 冷却时间（毫秒）
  lastExecuted?: Date;
}

export interface Condition {
  type: 'event' | 'state' | 'time' | 'composite';
  operator: 'equals' | 'notEquals' | 'contains' | 'notContains' |
            'greaterThan' | 'lessThan' | 'between' | 'matches';
  field: string;
  /** 比较目标值：随 operator 语义可为标量、[下限, 上限] 二元组或正则 */
  value: unknown;
  logicalOperator?: 'AND' | 'OR';
}

export interface Action {
  type: 'command' | 'notification' | 'workflow' | 'custom' | 'assignment';
  name: string;
  /** 动作参数（形状随 type 变化：title/message、command/args、handler 等） */
  parameters: Record<string, unknown>;
  timeout?: number;
  retryPolicy?: {
    maxRetries: number;
    backoffMs: number;
  };
}

export interface ActionExecution {
  id: string;
  ruleId: string;
  action: Action;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: unknown;
  error?: Error;
  startTime: Date;
  endTime?: Date;
}

export interface PolicyConfig {
  enabled: boolean;
  maxConcurrentActions: number;
  actionTimeoutMs: number;
  auditLogEnabled: boolean;
  safeMode: boolean; // 安全模式：只记录不执行
  allowedActions: string[];
  blockedActions: string[];
}

export interface Metrics {
  totalEventsProcessed: number;
  totalDecisionsMade: number;
  totalActionsExecuted: number;
  actionsCompleted: number;
  actionsFailed: number;
  averageDecisionTime: number;
  averageExecutionTime: number;
  rulesTriggered: Record<string, number>;
}

// ============================================================================
// 状态监控器 (Observer)
// ============================================================================

/** 状态监控器配置 */
export interface StateMonitorConfig {
  maxBufferSize?: number;
  retentionMs?: number;
}

/** 状态监控聚合统计 */
export interface MonitorStatistics {
  total: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  /** 最近 1 分钟事件数 */
  recent: number;
  critical: number;
}

export class StateMonitor extends EventEmitter {
  private eventBuffer: MonitorEvent[] = [];
  private maxBufferSize: number = 10000;
  private retentionMs: number = 3600000; // 1小时

  constructor(private config: StateMonitorConfig = {}) {
    super();
    if (config.maxBufferSize) {
      this.maxBufferSize = config.maxBufferSize;
    }
    if (config.retentionMs) {
      this.retentionMs = config.retentionMs;
    }
  }

  /**
   * 监控事件
   */
  observe(event: Omit<MonitorEvent, 'id' | 'timestamp'>): MonitorEvent {
    const monitorEvent: MonitorEvent = {
      id: uuidv4(),
      timestamp: new Date(),
      ...event
    };

    this.eventBuffer.push(monitorEvent);

    // 清理过期事件
    this.cleanup();

    // 触发决策引擎
    this.emit('event', monitorEvent);

    return monitorEvent;
  }

  /**
   * 获取事件历史
   */
  getEvents(filter?: {
    type?: string;
    source?: string;
    severity?: string;
    since?: Date;
  }): MonitorEvent[] {
    let events = [...this.eventBuffer];

    if (filter) {
      if (filter.type) {
        events = events.filter(e => e.type === filter.type);
      }
      if (filter.source) {
        events = events.filter(e => e.source === filter.source);
      }
      if (filter.severity) {
        events = events.filter(e => e.severity === filter.severity);
      }
      const since = filter.since;
      if (since !== undefined) {
        events = events.filter(e => e.timestamp >= since);
      }
    }

    return events;
  }

  /**
   * 获取聚合统计
   */
  getStatistics(): MonitorStatistics {
    const events = this.eventBuffer;
    const now = Date.now();

    return {
      total: events.length,
      byType: events.reduce((acc, e) => {
        acc[e.type] = (acc[e.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      bySeverity: events.reduce((acc, e) => {
        acc[e.severity] = (acc[e.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      recent: events.filter(e => now - e.timestamp.getTime() < 60000).length, // 最近1分钟
      critical: events.filter(e => e.severity === 'critical').length
    };
  }

  /**
   * 清理过期事件
   */
  private cleanup(): void {
    const now = Date.now();
    const cutoff = now - this.retentionMs;

    // 删除过期事件
    this.eventBuffer = this.eventBuffer.filter(
      e => e.timestamp.getTime() > cutoff
    );

    // 如果超过最大缓冲区，删除最旧的
    if (this.eventBuffer.length > this.maxBufferSize) {
      this.eventBuffer = this.eventBuffer.slice(
        this.eventBuffer.length - this.maxBufferSize
      );
    }
  }

  /**
   * 清空事件缓冲区
   */
  clear(): void {
    this.eventBuffer = [];
  }
}

// ============================================================================
// 决策引擎 (Brain)
// ============================================================================

export class DecisionEngine extends EventEmitter {
  private rules: Map<string, Rule> = new Map();
  private decisionHistory: DecisionRecord[] = [];
  private metrics: Metrics = {
    totalEventsProcessed: 0,
    totalDecisionsMade: 0,
    totalActionsExecuted: 0,
    actionsCompleted: 0,
    actionsFailed: 0,
    averageDecisionTime: 0,
    averageExecutionTime: 0,
    rulesTriggered: {}
  };

  constructor(private config: Record<string, unknown> = {}) {
    super();
  }

  /**
   * 添加规则
   */
  addRule(rule: Rule): void {
    this.rules.set(rule.id, rule);
    this.emit('rule_added', rule);
  }

  /**
   * 移除规则
   */
  removeRule(ruleId: string): boolean {
    const deleted = this.rules.delete(ruleId);
    if (deleted) {
      this.emit('rule_removed', ruleId);
    }
    return deleted;
  }

  /**
   * 获取规则
   */
  getRule(ruleId: string): Rule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * 获取所有规则
   */
  getAllRules(): Rule[] {
    return Array.from(this.rules.values());
  }

  /**
   * 启用/禁用规则
   */
  toggleRule(ruleId: string, enabled: boolean): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;

    rule.enabled = enabled;
    this.emit('rule_toggled', { ruleId, enabled });
    return true;
  }

  /**
   * 做决策
   */
  async makeDecision(context: DecisionContext): Promise<Map<string, Action[]>> {
    const startTime = Date.now();

    // 更新指标
    this.metrics.totalEventsProcessed += context.events.length;

    // 找到所有触发的规则
    const triggeredRules = this.evaluateRules(context);

    // 对规则按优先级排序
    triggeredRules.sort((a, b) => b.priority - a.priority);

    // 收集要执行的动作（每条规则至多出现一次，直接收集）
    const actions = new Map<string, Action[]>();
    for (const rule of triggeredRules) {
      actions.set(rule.id, rule.actions);

      // 更新规则触发计数
      this.metrics.rulesTriggered[rule.id] =
        (this.metrics.rulesTriggered[rule.id] || 0) + 1;

      // 更新最后执行时间
      rule.lastExecuted = new Date();

      this.emit('rule_triggered', rule);
    }

    // 记录决策历史
    this.decisionHistory.push({
      timestamp: new Date(),
      context,
      triggeredRules: triggeredRules.map(r => r.id),
      actions: Array.from(actions.entries())
    });

    // 限制历史记录大小
    if (this.decisionHistory.length > 1000) {
      this.decisionHistory = this.decisionHistory.slice(-1000);
    }

    // 更新决策时间指标
    const decisionTime = Date.now() - startTime;
    this.metrics.totalDecisionsMade += 1;
    this.metrics.averageDecisionTime =
      (this.metrics.averageDecisionTime * (this.metrics.totalDecisionsMade - 1) +
       decisionTime) / this.metrics.totalDecisionsMade;

    this.emit('decision_made', {
      triggeredRules: triggeredRules.map(r => r.id),
      actions
    });

    return actions;
  }

  /**
   * 评估规则
   */
  private evaluateRules(context: DecisionContext): Rule[] {
    const triggered: Rule[] = [];

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      // 检查冷却时间
      if (rule.lastExecuted) {
        const elapsed = Date.now() - rule.lastExecuted.getTime();
        if (elapsed < rule.cooldown) continue;
      }

      // 评估所有条件
      if (this.evaluateConditions(rule.conditions, context)) {
        triggered.push(rule);
      }
    }

    return triggered;
  }

  /**
   * 评估条件
   * logicalOperator 语义：该条件与「前面累计结果」之间的连接词
   * （首条件的连接词无意义、被忽略）；混合链从左到右求值、无优先级。
   * 修复：此前 result 初始化为 true，首条件声明 OR 时被 `true || x` 吞掉；
   * 且短路使用刚合并完的连接词而非下一个条件的连接词，混合链错误提前退出。
   */
  private evaluateConditions(
    conditions: Condition[],
    context: DecisionContext
  ): boolean {
    if (conditions.length === 0) return true;

    let result: boolean | null = null;

    for (let i = 0; i < conditions.length; i++) {
      const condition = conditions[i];
      const conditionResult = this.evaluateCondition(condition, context);

      if (result === null) {
        result = conditionResult;
      } else {
        const op = condition.logicalOperator ?? 'AND';
        result = op === 'AND'
          ? result && conditionResult
          : result || conditionResult;
      }

      // 短路：按「下一个条件」的连接词判断，后续条件已无法改变结果
      const next = conditions[i + 1];
      if (next) {
        const nextOp = next.logicalOperator ?? 'AND';
        if (nextOp === 'AND' && result === false) break;
        if (nextOp === 'OR' && result === true) break;
      }
    }

    return result ?? true;
  }

  /**
   * 评估单个条件
   */
  private evaluateCondition(
    condition: Condition,
    context: DecisionContext
  ): boolean {
    let value: unknown;

    // 根据条件类型获取值
    switch (condition.type) {
      case 'event':
        value = this.extractEventValue(context.events, condition.field);
        break;
      case 'state':
        value = this.extractStateValue(context.currentState, condition.field);
        break;
      case 'time':
        value = this.extractTimeValue(condition.field);
        break;
      default:
        return false;
    }

    // 根据运算符比较
    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'notEquals':
        return value !== condition.value;
      case 'contains':
        return Array.isArray(value) ? value.includes(condition.value) :
               String(value).includes(String(condition.value));
      case 'notContains':
        return Array.isArray(value) ? !value.includes(condition.value) :
               !String(value).includes(String(condition.value));
      case 'greaterThan':
        return Number(value) > Number(condition.value);
      case 'lessThan':
        return Number(value) < Number(condition.value);
      case 'between':
        if (!Array.isArray(condition.value) || condition.value.length !== 2) {
          return false;
        }
        return Number(value) >= condition.value[0] &&
               Number(value) <= condition.value[1];
      case 'matches':
        // matches 语义下规则值约定为字符串或 RegExp 字面量
        return new RegExp(condition.value as string | RegExp).test(String(value));
      default:
        return false;
    }
  }

  /**
   * 从事件中提取值
   * 字段约定「事件类型.路径」：先按事件顶层字段解析（id/severity 等元数据），
   * 解析不到时回落到事件载荷 event.data（规则字段 'system_metrics.cpu'
   * 实际读取的是 data.cpu——修复此前只查事件根导致预设规则永不触发的缺陷）。
   */
  private extractEventValue(events: MonitorEvent[], field: string): unknown {
    if (events.length === 0) return null;

    const [eventType, ...path] = field.split('.');

    // 过滤匹配的事件
    const matchingEvents = events.filter(e => e.type === eventType);
    if (matchingEvents.length === 0) return null;

    // 从最新的事件中提取值
    const latestEvent = matchingEvents[matchingEvents.length - 1];
    const fromRoot = this.extractNestedValue(latestEvent, path);
    if (fromRoot !== undefined) return fromRoot;
    return this.extractNestedValue(latestEvent.data, path);
  }

  /**
   * 从状态中提取值
   */
  private extractStateValue(state: unknown, field: string): unknown {
    const path = field.split('.');
    return this.extractNestedValue(state, path);
  }

  /**
   * 提取时间值
   */
  private extractTimeValue(field: string): number | boolean | null {
    const now = new Date();

    switch (field) {
      case 'hour':
        return now.getHours();
      case 'dayOfWeek':
        return now.getDay();
      case 'isWeekend':
        return now.getDay() === 0 || now.getDay() === 6;
      case 'isBusinessHours':
        const hour = now.getHours();
        return hour >= 9 && hour < 18;
      default:
        return null;
    }
  }

  /**
   * 提取嵌套值
   */
  private extractNestedValue(obj: unknown, path: string[]): unknown {
    let value = obj;
    for (const key of path) {
      if (value == null) return null;
      // 载荷形状动态：按字符串键逐层取值（非对象值同样透传，行为与旧实现一致）
      value = (value as Record<string, unknown>)[key];
    }
    return value;
  }

  /**
   * 获取指标
   */
  getMetrics(): Metrics {
    return { ...this.metrics };
  }

  /**
   * 记录一次动作执行结果（由插件层在执行器完成后回调）。
   * 修复：此前 actionsCompleted/actionsFailed/averageExecutionTime
   * 恒为 0——执行器与决策引擎分离后结果从不回流。
   */
  recordExecution(execution: ActionExecution): void {
    const duration =
      (execution.endTime ?? new Date()).getTime() - execution.startTime.getTime();
    this.metrics.totalActionsExecuted += 1;
    if (execution.status === 'completed') {
      this.metrics.actionsCompleted += 1;
    } else {
      this.metrics.actionsFailed += 1;
    }
    const n = this.metrics.totalActionsExecuted;
    this.metrics.averageExecutionTime =
      (this.metrics.averageExecutionTime * (n - 1) + duration) / n;
  }

  /**
   * 重置指标
   */
  resetMetrics(): void {
    this.metrics = {
      totalEventsProcessed: 0,
      totalDecisionsMade: 0,
      totalActionsExecuted: 0,
      actionsCompleted: 0,
      actionsFailed: 0,
      averageDecisionTime: 0,
      averageExecutionTime: 0,
      rulesTriggered: {}
    };
  }

  /**
   * 获取决策历史
   */
  getDecisionHistory(limit?: number): DecisionRecord[] {
    if (limit) {
      return this.decisionHistory.slice(-limit);
    }
    return [...this.decisionHistory];
  }
}

// ============================================================================
// 执行器 (Executor)
// ============================================================================

export class ActionExecutor extends EventEmitter {
  private runningExecutions: Map<string, ActionExecution> = new Map();
  private executionHistory: ActionExecution[] = [];
  private config: PolicyConfig;

  constructor(config: Partial<PolicyConfig> = {}) {
    super();
    this.config = {
      enabled: true,
      maxConcurrentActions: 10,
      actionTimeoutMs: 30000,
      auditLogEnabled: true,
      safeMode: false,
      allowedActions: ['*'],
      blockedActions: [],
      ...config
    };
  }

  /**
   * 执行动作
   */
  async executeAction(
    ruleId: string,
    action: Action
  ): Promise<ActionExecution> {
    const execution: ActionExecution = {
      id: uuidv4(),
      ruleId,
      action,
      status: 'pending',
      startTime: new Date()
    };

    // 检查是否启用
    if (!this.config.enabled) {
      execution.status = 'failed';
      execution.error = new Error('Executor is disabled');
      execution.endTime = new Date();
      this.addToHistory(execution);
      this.emit('action_failed', execution);
      throw execution.error;
    }

    // 检查动作是否被阻止
    if (!this.isActionAllowed(action)) {
      execution.status = 'failed';
      execution.error = new Error('Action is blocked by policy');
      execution.endTime = new Date();
      this.addToHistory(execution);
      this.emit('action_failed', execution);
      throw execution.error;
    }

    // 检查并发限制
    if (this.runningExecutions.size >= this.config.maxConcurrentActions) {
      throw new Error('Maximum concurrent actions reached');
    }

    // 添加到运行中列表
    this.runningExecutions.set(execution.id, execution);

    this.emit('action_started', execution);

    try {
      // 安全模式：只记录不执行
      if (this.config.safeMode) {
        execution.status = 'completed';
        execution.result = { safeMode: true, skipped: true };
      } else {
        execution.status = 'running';
        execution.result = await this.performAction(action, execution);
        execution.status = 'completed';
      }

      execution.endTime = new Date();
      this.emit('action_completed', execution);

    } catch (error) {
      execution.status = 'failed';
      execution.error = error as Error;
      execution.endTime = new Date();
      this.emit('action_failed', execution);
      throw error;

    } finally {
      // 从运行中列表移除
      this.runningExecutions.delete(execution.id);
      this.addToHistory(execution);
    }

    return execution;
  }

  /**
   * 执行动作
   */
  private async performAction(
    action: Action,
    execution: ActionExecution
  ): Promise<unknown> {
    const timeout = action.timeout || this.config.actionTimeoutMs;
    const retryPolicy = action.retryPolicy || { maxRetries: 0, backoffMs: 1000 };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retryPolicy.maxRetries; attempt++) {
      try {
        // 创建超时Promise（race 结束后清理定时器，避免泄漏）
        let timeoutHandle: NodeJS.Timeout | undefined;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(
            () => reject(new Error('Action timeout')),
            timeout
          );
        });

        try {
          // 执行动作
          const result = await Promise.race([
            this.executeByType(action),
            timeoutPromise
          ]);
          return result;
        } finally {
          clearTimeout(timeoutHandle);
        }

      } catch (error) {
        lastError = error as Error;

        // 最后一次尝试失败则抛出错误
        if (attempt === retryPolicy.maxRetries) {
          throw lastError;
        }

        // 等待退避时间
        await new Promise(resolve =>
          setTimeout(resolve, retryPolicy.backoffMs * (attempt + 1))
        );
      }
    }

    throw lastError;
  }

  /**
   * 根据类型执行动作
   */
  private async executeByType(action: Action): Promise<unknown> {
    switch (action.type) {
      case 'command':
        return this.executeCommand(action);
      case 'notification':
        return this.executeNotification(action);
      case 'workflow':
        return this.executeWorkflow(action);
      case 'custom':
        return this.executeCustom(action);
      case 'assignment':
        return this.executeAssignment(action);
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  /**
   * 执行市场分配动作（来自增长调度器 Brain 的 VCG 定价分配）
   */
  private async executeAssignment(action: Action): Promise<unknown> {
    const assignment = action.parameters.assignment as BrainAssignment | undefined;

    if (!assignment || !assignment.taskId || !assignment.winnerId) {
      throw new Error('Assignment action requires "assignment" parameter with taskId and winnerId');
    }

    this.emit('market_allocation', assignment);

    return {
      type: 'assignment',
      taskId: assignment.taskId,
      winnerId: assignment.winnerId,
      capability: assignment.capability,
      payment: assignment.payment,
      socialValue: assignment.socialValue
    };
  }

  /**
   * 执行命令
   */
  private async executeCommand(action: Action): Promise<unknown> {
    const { command, args } = action.parameters;

    if (!command) {
      throw new Error('Command action requires "command" parameter');
    }

    // 这里应该集成实际的命令执行逻辑
    // 例如：使用子进程执行系统命令
    this.emit('command_executing', { command, args });

    return {
      type: 'command',
      command,
      args,
      output: 'Command executed (mock)',
      exitCode: 0
    };
  }

  /**
   * 执行通知
   */
  private async executeNotification(action: Action): Promise<unknown> {
    const { title, message, level } = action.parameters;

    if (!title || !message) {
      throw new Error('Notification action requires "title" and "message" parameters');
    }

    this.emit('notification_sent', { title, message, level });

    return {
      type: 'notification',
      title,
      message,
      level: level || 'info'
    };
  }

  /**
   * 执行工作流
   */
  private async executeWorkflow(action: Action): Promise<unknown> {
    const { workflowId, parameters } = action.parameters;

    if (!workflowId) {
      throw new Error('Workflow action requires "workflowId" parameter');
    }

    // 这里应该集成DSH工作流引擎
    this.emit('workflow_started', { workflowId, parameters });

    return {
      type: 'workflow',
      workflowId,
      parameters,
      status: 'started'
    };
  }

  /**
   * 执行自定义动作
   */
  private async executeCustom(action: Action): Promise<unknown> {
    const { handler } = action.parameters;

    if (!handler || typeof handler !== 'function') {
      throw new Error('Custom action requires "handler" function parameter');
    }

    return handler(action.parameters);
  }

  /**
   * 检查动作是否允许
   */
  private isActionAllowed(action: Action): boolean {
    const actionType = `${action.type}:${action.name}`;

    // 检查阻止列表
    if (this.config.blockedActions.includes('*') ||
        this.config.blockedActions.includes(action.type) ||
        this.config.blockedActions.includes(actionType)) {
      return false;
    }

    // 检查允许列表
    if (this.config.allowedActions.includes('*')) {
      return true;
    }

    return this.config.allowedActions.includes(action.type) ||
           this.config.allowedActions.includes(actionType);
  }

  /**
   * 添加到历史记录（按执行 ID 幂等——取消后再超时的执行不重复入列）
   */
  private addToHistory(execution: ActionExecution): void {
    if (this.executionHistory.some((e) => e.id === execution.id)) return;
    this.executionHistory.push(execution);

    // 限制历史记录大小
    if (this.executionHistory.length > 10000) {
      this.executionHistory = this.executionHistory.slice(-10000);
    }
  }

  /**
   * 获取运行中的执行
   */
  getRunningExecutions(): ActionExecution[] {
    return Array.from(this.runningExecutions.values());
  }

  /**
   * 获取执行历史
   */
  getExecutionHistory(filter?: {
    ruleId?: string;
    status?: string;
    since?: Date;
  }): ActionExecution[] {
    let history = [...this.executionHistory];

    if (filter) {
      if (filter.ruleId) {
        history = history.filter(e => e.ruleId === filter.ruleId);
      }
      if (filter.status) {
        history = history.filter(e => e.status === filter.status);
      }
      const since = filter.since;
      if (since !== undefined) {
        history = history.filter(e => e.startTime >= since);
      }
    }

    return history;
  }

  /**
   * 取消执行（标记失败并写入历史——修复此前取消的执行不进历史）
   */
  cancelExecution(executionId: string): boolean {
    const execution = this.runningExecutions.get(executionId);
    if (!execution) return false;

    execution.status = 'failed';
    execution.error = new Error('Execution cancelled');
    execution.endTime = new Date();

    this.runningExecutions.delete(executionId);
    this.addToHistory(execution);
    this.emit('action_cancelled', execution);

    return true;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<PolicyConfig>): void {
    this.config = { ...this.config, ...config };
    this.emit('config_updated', this.config);
  }

  /**
   * 获取配置
   */
  getConfig(): PolicyConfig {
    return { ...this.config };
  }
}

// ============================================================================
// 主插件类
// ============================================================================

/** 插件配置：各组件配置透传；brain 为市场大脑（实例或调度器配置，duck typing 识别） */
export interface ProactiveIntelligencePluginConfig {
  monitor?: StateMonitorConfig;
  /** 决策引擎配置（当前未消费，预留扩展） */
  engine?: Record<string, unknown>;
  executor?: Partial<PolicyConfig>;
  brain?: MarketBrain | Partial<GrowthSchedulerConfig>;
  /** 初始市场参与者（config.brain 存在时经 registerAgent 注册） */
  brainAgents?: GrowthAgentSpec[];
}

/** 插件状态快照（getCurrentState 产出，注入规则条件的 currentState） */
interface CurrentSystemState {
  timestamp: Date;
  monitorStats: MonitorStatistics;
  engineMetrics: Metrics;
  executorConfig: PolicyConfig;
  runningExecutions: ActionExecution[];
  brain: object | null;
}

/** 插件聚合统计信息 */
export interface PluginStatistics {
  monitor: MonitorStatistics;
  engine: Metrics;
  executor: {
    running: number;
    history: number;
  };
  running: boolean;
}

export class ProactiveIntelligencePlugin extends EventEmitter {
  private monitor: StateMonitor;
  private engine: DecisionEngine;
  private executor: ActionExecutor;
  private brain: MarketBrain | null = null;
  private running: boolean = false;
  /** 决策批处理：同一 tick 内的事件合并为一次决策（修复决策风暴） */
  private decisionScheduled = false;
  private pendingEvents: MonitorEvent[] = [];

  constructor(config: ProactiveIntelligencePluginConfig = {}) {
    super();

    this.monitor = new StateMonitor(config.monitor);
    this.engine = new DecisionEngine(config.engine);
    this.executor = new ActionExecutor(config.executor);

    // 市场 Brain（duck typing）：config.brain 可以是
    //   1. MarketBrain 实例（如 CompoundBrain）——直接接入；
    //   2. GrowthSchedulerBrain 的调度器配置——按配置构造默认增长市场。
    // config.brainAgents 为初始 agent（经 brain.registerAgent 注册）。
    if (config.brain) {
      this.brain =
        typeof (config.brain as MarketBrain).submitTask === 'function'
          ? (config.brain as MarketBrain)
          : new GrowthSchedulerBrain(config.brain as Partial<GrowthSchedulerConfig>);
      const brain = this.brain;
      if (brain) {
        for (const agent of config.brainAgents ?? []) {
          brain.registerAgent?.(agent);
        }
      }
    }

    // 设置事件监听
    this.setupEventHandlers();
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    // 执行结果回流决策引擎（修复执行指标恒 0）
    this.executor.on('action_completed', (execution) => {
      this.engine.recordExecution(execution);
    });
    this.executor.on('action_failed', (execution) => {
      this.engine.recordExecution(execution);
    });

    // 监控器发出事件时，合并同 tick 事件后统一触发一次决策
    // （修复：此前每个事件立即全量决策，事件风暴下重复决策且 O(n·m) 评估）
    this.monitor.on('event', (event: MonitorEvent) => {
      if (!this.running) return;

      this.pendingEvents.push(event);
      if (this.decisionScheduled) return;
      this.decisionScheduled = true;

      setImmediate(() => {
        this.decisionScheduled = false;
        const batch = this.pendingEvents;
        this.pendingEvents = [];
        void this.processEventBatch(batch);
      });
    });
  }

  /**
   * 处理一批事件：规则决策 + Brain 市场分配
   */
  private async processEventBatch(batch: MonitorEvent[]): Promise<void> {
    try {
      const context: DecisionContext = {
        events: this.monitor.getEvents(),
        currentState: this.getCurrentState(),
        history: this.engine.getDecisionHistory(10),
        rules: this.engine.getAllRules()
      };

      const actions = await this.engine.makeDecision(context);

      // Brain 市场决策：task_request 事件提交增长市场（VCG 定价 + 学习资本）
      if (this.brain) {
        for (const event of batch) {
          if (event.type !== 'task_request' || !event.data?.capability) continue;
          const assignment = this.brain.submitTask(String(event.data.capability));
          if (assignment) {
            const brainActions = actions.get('brain') ?? [];
            brainActions.push({
              type: 'assignment',
              name: 'market_allocate',
              parameters: { assignment }
            });
            actions.set('brain', brainActions);
          }
        }
      }

      // 执行所有动作
      for (const [ruleId, ruleActions] of actions.entries()) {
        for (const action of ruleActions) {
          try {
            await this.executor.executeAction(ruleId, action);
          } catch (error) {
            this.emit('action_error', { ruleId, action, error });
          }
        }
      }
    } catch (error) {
      this.emit('decision_error', error);
    }
  }

  /**
   * 获取当前状态（含 Brain 市场状态，供规则条件 'brain.*' 联动）
   */
  private getCurrentState(): CurrentSystemState {
    return {
      timestamp: new Date(),
      monitorStats: this.monitor.getStatistics(),
      engineMetrics: this.engine.getMetrics(),
      executorConfig: this.executor.getConfig(),
      runningExecutions: this.executor.getRunningExecutions(),
      brain: this.brain ? this.brain.getState() : null
    };
  }

  /**
   * 启动插件
   */
  async start(): Promise<void> {
    if (this.running) {
      throw new Error('Plugin is already running');
    }

    this.running = true;
    this.emit('started');
  }

  /**
   * 停止插件
   */
  async stop(): Promise<void> {
    if (!this.running) return;

    this.running = false;

    // 等待所有运行中的动作完成或超时
    const running = this.executor.getRunningExecutions();
    for (const execution of running) {
      this.executor.cancelExecution(execution.id);
    }

    this.emit('stopped');
  }

  /**
   * 添加规则
   */
  addRule(rule: Rule): void {
    this.engine.addRule(rule);
  }

  /**
   * 移除规则
   */
  removeRule(ruleId: string): boolean {
    return this.engine.removeRule(ruleId);
  }

  /**
   * 观察事件
   */
  observe(event: Omit<MonitorEvent, 'id' | 'timestamp'>): MonitorEvent {
    return this.monitor.observe(event);
  }

  /**
   * 获取统计信息
   */
  getStatistics(): PluginStatistics {
    return {
      monitor: this.monitor.getStatistics(),
      engine: this.engine.getMetrics(),
      executor: {
        running: this.executor.getRunningExecutions().length,
        history: this.executor.getExecutionHistory().length
      },
      running: this.running
    };
  }

  /**
   * 获取监控器
   */
  getMonitor(): StateMonitor {
    return this.monitor;
  }

  /**
   * 获取决策引擎
   */
  getEngine(): DecisionEngine {
    return this.engine;
  }

  /**
   * 获取执行器
   */
  getExecutor(): ActionExecutor {
    return this.executor;
  }

  /**
   * 获取市场 Brain（未配置时为 null）。可能是 GrowthSchedulerBrain
   * 或外部接入的任意 MarketBrain 实例（如 CompoundBrain）。
   */
  getBrain(): MarketBrain | null {
    return this.brain;
  }

  /**
   * 向 Brain 注册 agent（市场参与者：能力 / 私有成本 / 私有质量）。
   * spec 形状由具体 Brain 定义（GrowthAgentSpec / CompoundAgentSpec 等）。
   */
  registerBrainAgent(spec: GrowthAgentSpec | Record<string, unknown>): this {
    if (!this.brain) {
      throw new Error('Brain is not configured (pass config.brain)');
    }
    if (!this.brain.registerAgent) {
      throw new Error('Brain does not support registerAgent');
    }
    this.brain.registerAgent(spec);
    return this;
  }

  /**
   * 结算 Brain 分配的任务：回写成败，驱动学习曲线与声誉更新。
   * 真实部署中由任务执行方回调；返回 taskId 是否命中在途任务。
   */
  settleTask(taskId: string, success: boolean): boolean {
    if (!this.brain) return false;
    return this.brain.settleTask(taskId, success);
  }
}

// ============================================================================
// 导出（类型均在声明处导出）
// ============================================================================