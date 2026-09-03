/**
 * 决策引擎 (Brain)：规则存储、条件求值（事件/状态/时间/复合路径提取）
 * 与决策历史/指标。拆分自 index.ts——职责单一的决策层组件。
 */

import { EventEmitter } from 'events';
import type {
  Action,
  ActionExecution,
  Condition,
  DecisionContext,
  DecisionRecord,
  Metrics,
  MonitorEvent,
  Rule,
} from './types';

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
    rulesTriggered: {},
  };

  constructor(_config: Record<string, unknown> = {}) {
    super();
  }

  /** 添加规则 */
  addRule(rule: Rule): void {
    this.rules.set(rule.id, rule);
    this.emit('rule_added', rule);
  }

  /** 移除规则 */
  removeRule(ruleId: string): boolean {
    const deleted = this.rules.delete(ruleId);
    if (deleted) {
      this.emit('rule_removed', ruleId);
    }
    return deleted;
  }

  /** 获取规则 */
  getRule(ruleId: string): Rule | undefined {
    return this.rules.get(ruleId);
  }

  /** 获取所有规则 */
  getAllRules(): Rule[] {
    return Array.from(this.rules.values());
  }

  /** 启用/禁用规则 */
  toggleRule(ruleId: string, enabled: boolean): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;

    rule.enabled = enabled;
    this.emit('rule_toggled', { ruleId, enabled });
    return true;
  }

  /** 做决策 */
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
      this.metrics.rulesTriggered[rule.id] = (this.metrics.rulesTriggered[rule.id] || 0) + 1;

      // 更新最后执行时间
      rule.lastExecuted = new Date();

      this.emit('rule_triggered', rule);
    }

    // 记录决策历史（事件只保留尾部快照：完整事件缓冲区由监控器管理，
    // 此处整表引用会让已被清理的事件随历史记录再存活1000轮）
    this.decisionHistory.push({
      timestamp: new Date(),
      context: { ...context, events: context.events.slice(-10) },
      triggeredRules: triggeredRules.map((r) => r.id),
      actions: Array.from(actions.entries()),
    });

    // 限制历史记录大小
    if (this.decisionHistory.length > 1000) {
      this.decisionHistory = this.decisionHistory.slice(-1000);
    }

    // 更新决策时间指标
    const decisionTime = Date.now() - startTime;
    this.metrics.totalDecisionsMade += 1;
    this.metrics.averageDecisionTime =
      (this.metrics.averageDecisionTime * (this.metrics.totalDecisionsMade - 1) + decisionTime) /
      this.metrics.totalDecisionsMade;

    this.emit('decision_made', {
      triggeredRules: triggeredRules.map((r) => r.id),
      actions,
    });

    return actions;
  }

  /** 评估规则 */
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
  private evaluateConditions(conditions: Condition[], context: DecisionContext): boolean {
    if (conditions.length === 0) return true;

    let result: boolean | null = null;

    for (let i = 0; i < conditions.length; i++) {
      const condition = conditions[i]!;
      const conditionResult = this.evaluateCondition(condition, context);

      if (result === null) {
        result = conditionResult;
      } else {
        const op = condition.logicalOperator ?? 'AND';
        result = op === 'AND' ? result && conditionResult : result || conditionResult;
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

  /** 评估单个条件 */
  private evaluateCondition(condition: Condition, context: DecisionContext): boolean {
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
        return Array.isArray(value)
          ? value.includes(condition.value)
          : String(value).includes(String(condition.value));
      case 'notContains':
        return Array.isArray(value)
          ? !value.includes(condition.value)
          : !String(value).includes(String(condition.value));
      case 'greaterThan':
        return Number(value) > Number(condition.value);
      case 'lessThan':
        return Number(value) < Number(condition.value);
      case 'between':
        if (!Array.isArray(condition.value) || condition.value.length !== 2) {
          return false;
        }
        return Number(value) >= condition.value[0] && Number(value) <= condition.value[1];
      case 'matches':
        // 规则值约定为字符串或 RegExp；非法模式按条件不成立处理而非抛错
        try {
          const pattern = condition.value;
          const re = pattern instanceof RegExp ? pattern : new RegExp(String(pattern));
          return re.test(String(value));
        } catch {
          return false;
        }
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
    const matchingEvents = events.filter((e) => e.type === eventType);
    if (matchingEvents.length === 0) return null;

    // 从最新的事件中提取值
    const latestEvent = matchingEvents[matchingEvents.length - 1]!;
    const fromRoot = this.extractNestedValue(latestEvent, path);
    if (fromRoot !== undefined) return fromRoot;
    return this.extractNestedValue(latestEvent.data, path);
  }

  /** 从状态中提取值 */
  private extractStateValue(state: unknown, field: string): unknown {
    const path = field.split('.');
    return this.extractNestedValue(state, path);
  }

  /** 提取时间值 */
  private extractTimeValue(field: string): number | boolean | null {
    const now = new Date();

    switch (field) {
      case 'hour':
        return now.getHours();
      case 'dayOfWeek':
        return now.getDay();
      case 'isWeekend':
        return now.getDay() === 0 || now.getDay() === 6;
      case 'isBusinessHours': {
        const hour = now.getHours();
        return hour >= 9 && hour < 18;
      }
      default:
        return null;
    }
  }

  /** 提取嵌套值 */
  private extractNestedValue(obj: unknown, path: string[]): unknown {
    let value = obj;
    for (const key of path) {
      if (value == null) return null;
      // 载荷形状动态：按字符串键逐层取值（非对象值同样透传，行为与旧实现一致）
      value = (value as Record<string, unknown>)[key];
    }
    return value;
  }

  /** 获取指标 */
  getMetrics(): Metrics {
    return { ...this.metrics };
  }

  /**
   * 记录一次动作执行结果（由插件层在执行器完成后回调）。
   * 修复：此前 actionsCompleted/actionsFailed/averageExecutionTime
   * 恒为 0——执行器与决策引擎分离后结果从不回流。
   */
  recordExecution(execution: ActionExecution): void {
    const duration = (execution.endTime ?? new Date()).getTime() - execution.startTime.getTime();
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

  /** 重置指标 */
  resetMetrics(): void {
    this.metrics = {
      totalEventsProcessed: 0,
      totalDecisionsMade: 0,
      totalActionsExecuted: 0,
      actionsCompleted: 0,
      actionsFailed: 0,
      averageDecisionTime: 0,
      averageExecutionTime: 0,
      rulesTriggered: {},
    };
  }

  /** 获取决策历史 */
  getDecisionHistory(limit?: number): DecisionRecord[] {
    if (limit) {
      return this.decisionHistory.slice(-limit);
    }
    return [...this.decisionHistory];
  }
}
