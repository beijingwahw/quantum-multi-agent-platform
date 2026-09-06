/**
 * 决策引擎 (Brain)：规则存储、条件求值（事件/状态/时间/复合路径提取）
 * 与决策历史/指标。拆分自 index.ts——职责单一的决策层组件。
 *
 * 规则所有权契约：addRule 深拷贝入库，getRule/getAllRules 返回拷贝——
 * 引擎内部状态机（enabled/lastExecuted）与调用方对象彻底隔离。
 * 此前规则按引用入库：toggleRule/makeDecision 直接改写调用方对象、
 * 外部也能改 conditions 绕过冷却，EventEmitter 再把同一引用 emit
 * 出去放大别名风险。
 */

import { EventEmitter } from 'events';
import type {
  Action,
  ActionExecution,
  BetweenCondition,
  Condition,
  DecisionContext,
  DecisionRecord,
  MatchesCondition,
  Metrics,
  MonitorEvent,
  Rule,
  ScalarCondition,
} from './types.js';

/**
 * 条件拷贝（边界防御）：between 的元组与 matches 的 RegExp 状态
 * （lastIndex）复制为新实例，标量值是不可变原语、原样传递。
 * 重载让判别联合的每个成员各自保持精确类型。
 */
function cloneCondition(c: ScalarCondition): ScalarCondition;
function cloneCondition(c: BetweenCondition): BetweenCondition;
function cloneCondition(c: MatchesCondition): MatchesCondition;
function cloneCondition(c: Condition): Condition;
function cloneCondition(c: Condition): Condition {
  switch (c.operator) {
    case 'between': {
      const [lower, upper] = c.value;
      return { ...c, value: [lower, upper] };
    }
    case 'matches':
      return {
        ...c,
        value: c.value instanceof RegExp ? new RegExp(c.value.source, c.value.flags) : c.value,
      };
    default:
      return { ...c };
  }
}

/** 规则深拷贝（见类头「规则所有权契约」） */
function cloneRule(rule: Rule): Rule {
  const cloned: Rule = {
    ...rule,
    conditions: rule.conditions.map((c) => cloneCondition(c)),
    actions: rule.actions.map((a) => {
      const action: Action = { ...a, parameters: { ...a.parameters } };
      if (a.retryPolicy) action.retryPolicy = { ...a.retryPolicy };
      return action;
    }),
  };
  return cloned;
}

/**
 * 缺失值安全数值化：null/undefined/对象/NaN/空串一律返回 null。
 * 此前 Number(null)=0 使「字段缺失」在 greaterThan/lessThan/between
 * 中被当作 0 参与比较，比较条件可被缺失值误命中。
 */
function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

export class DecisionEngine extends EventEmitter {
  private rules = new Map<string, Rule>();
  /** 规则最后执行时间旁路表：不写回规则对象，拷贝出库时合并呈现 */
  private lastExecutedById = new Map<string, Date>();
  private decisionHistory: DecisionRecord[] = [];
  private metrics: Metrics = {
    totalEventsProcessed: 0,
    totalDecisionsMade: 0,
    totalActionsExecuted: 0,
    actionsCompleted: 0,
    actionsFailed: 0,
    actionsRejected: 0,
    actionsSkipped: 0,
    averageDecisionTime: 0,
    averageExecutionTime: 0,
    rulesTriggered: {},
  };

  // 无构造配置（02#7）：引擎的全部行为参数都活在规则本身（阈值/窗口/
  // 重试策略），不存在引擎级旋钮——曾经保留的 _config 参数承诺了不
  // 存在的可配置性，是签名层面的谎言，删除而非实现假配置。
  constructor() {
    super();
  }

  /** 添加规则（深拷贝入库，见类头「规则所有权契约」） */
  addRule(rule: Rule): void {
    this.rules.set(rule.id, cloneRule(rule));
    // lastExecuted 旁路表：显式携带则以调用方为准，否则沿用引擎侧
    // 既有记录；两侧皆无 → 不设条目（absence 即「从未执行」，
    // 冷却检查跳过）
    if (rule.lastExecuted) {
      this.lastExecutedById.set(rule.id, rule.lastExecuted);
    }
    this.emit('rule_added', this.snapshotRule(rule.id));
  }

  /** 移除规则 */
  removeRule(ruleId: string): boolean {
    const deleted = this.rules.delete(ruleId);
    if (deleted) {
      this.lastExecutedById.delete(ruleId);
      this.emit('rule_removed', ruleId);
    }
    return deleted;
  }

  /** 出库快照（合并旁路 lastExecuted；对内部存储零别名） */
  private snapshotRule(ruleId: string): Rule | null {
    const rule = this.rules.get(ruleId);
    if (!rule) return null;
    const lastExecuted = this.lastExecutedById.get(ruleId);
    const snapshot = cloneRule(rule);
    if (lastExecuted) snapshot.lastExecuted = lastExecuted;
    return snapshot;
  }

  /** 获取规则（拷贝出库） */
  getRule(ruleId: string): Rule | undefined {
    const snapshot = this.snapshotRule(ruleId);
    return snapshot ?? undefined;
  }

  /** 获取所有规则（拷贝出库） */
  getAllRules(): Rule[] {
    return Array.from(this.rules.keys())
      .map((id) => this.snapshotRule(id))
      .filter((r): r is Rule => r !== null);
  }

  /** 启用/禁用规则 */
  toggleRule(ruleId: string, enabled: boolean): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;

    rule.enabled = enabled;
    this.emit('rule_toggled', { ruleId, enabled });
    return true;
  }

  /**
   * 做决策。
   *
   * 返回 Promise 是刻意的接口预留而非实现缺陷（02#8）：调用方（插件
   * 主循环）以 await 消费，未来执行链路异步化（如决策期引入异步特征
   * 提取）时签名不必破坏性变更。同步内核被 Promise.resolve 包装的
   * 「半异步」成本是一次微任务跳转，在此显式声明以正名。
   */
  makeDecision(context: DecisionContext): Promise<Map<string, Action[]>> {
    const startTime = Date.now();

    // 更新指标
    this.metrics.totalEventsProcessed += context.events.length;

    // 找到所有触发的规则
    const triggeredRules = this.evaluateRules(context);

    // 对规则按优先级排序
    triggeredRules.sort((a, b) => b.priority - a.priority);

    // 收集要执行的动作（每条规则至多出现一次，直接收集）。
    // 动作数组来自内部拷贝（addRule 深拷贝保证），出库无别名。
    const actions = new Map<string, Action[]>();
    for (const rule of triggeredRules) {
      actions.set(rule.id, rule.actions);

      // 更新规则触发计数
      this.metrics.rulesTriggered[rule.id] = (this.metrics.rulesTriggered[rule.id] ?? 0) + 1;

      // 更新最后执行时间（旁路表，不写回规则对象）
      this.lastExecutedById.set(rule.id, new Date());

      // 事件负载发只读快照（含冷却字段），不泄漏内部存储引用
      this.emit('rule_triggered', this.snapshotRule(rule.id));
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

    return Promise.resolve(actions);
  }

  /** 评估规则 */
  private evaluateRules(context: DecisionContext): Rule[] {
    const triggered: Rule[] = [];

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      // 检查冷却时间（旁路表读取）
      const lastExecuted = this.lastExecutedById.get(rule.id);
      if (lastExecuted) {
        const elapsed = Date.now() - lastExecuted.getTime();
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
   * 短路只做「跳过不影响累计结果的项」（true OR x / false AND x），
   * 不得终止整条链——后面以 AND 连接的条件（或 OR 条件）仍可能
   * 翻转结果。[A=true, B(OR), C(AND)] 的正确值是 C，提前 break 会
   * 错误地返回 true（混合链规则误触发/漏触发的根源）。
   */
  private evaluateConditions(conditions: Condition[], context: DecisionContext): boolean {
    if (conditions.length === 0) return true;

    let result: boolean | null = null;

    for (let i = 0; i < conditions.length; i++) {
      const condition = conditions[i]!;
      const op = i === 0 ? 'AND' : (condition.logicalOperator ?? 'AND');

      // 该条件已无法改变累计结果：跳过求值，但继续扫描后续条件
      if (result === true && op === 'OR') continue;
      if (result === false && op === 'AND') continue;

      const conditionResult = this.evaluateCondition(condition, context);
      result =
        result === null
          ? conditionResult
          : op === 'AND'
            ? result && conditionResult
            : result || conditionResult;
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

    // 根据运算符比较。缺失值（null/undefined）一律不参与比较：
    // Number(null)=0 曾使 greaterThan/lessThan/between 被缺失值误命中，
    // String(undefined) 曾使 contains 命中 "undefined" 子串。
    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'notEquals':
        return value !== condition.value;
      case 'contains':
      case 'notContains': {
        if (value == null || condition.value == null) return false;
        const contains = condition.operator === 'contains';
        if (Array.isArray(value)) {
          return contains ? value.includes(condition.value) : !value.includes(condition.value);
        }
        // 仅原始值参与子串比较：对象的默认字符串化是 '[object Object]'，
        // 子串命中不可能有语义
        if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
          return false;
        }
        const hit = String(value).includes(String(condition.value));
        return contains ? hit : !hit;
      }
      case 'greaterThan': {
        const [num, target] = [toNumber(value), toNumber(condition.value)];
        return num !== null && target !== null && num > target;
      }
      case 'lessThan': {
        const [num, target] = [toNumber(value), toNumber(condition.value)];
        return num !== null && target !== null && num < target;
      }
      case 'between': {
        const num = toNumber(value);
        const lower = toNumber(condition.value[0]);
        const upper = toNumber(condition.value[1]);
        return num !== null && lower !== null && upper !== null && num >= lower && num <= upper;
      }
      case 'matches': {
        if (value == null) return false;
        // 对象/数组的默认字符串化无匹配语义（'[object Object]'）
        if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
          return false;
        }
        // 规则值约定为字符串或 RegExp；非法模式按条件不成立处理而非抛错
        try {
          const pattern = condition.value;
          const re = pattern instanceof RegExp ? pattern : new RegExp(pattern);
          return re.test(String(value));
        } catch {
          return false;
        }
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

  /** 获取指标（rulesTriggered 深拷贝：浅拷贝会把内部计数表按引用泄漏出去） */
  getMetrics(): Metrics {
    return { ...this.metrics, rulesTriggered: { ...this.metrics.rulesTriggered } };
  }

  /**
   * 记录一次动作执行结果（由插件层在执行器完成后回调）。
   * 修复：此前 actionsCompleted/actionsFailed/averageExecutionTime
   * 恒为 0——执行器与决策引擎分离后结果从不回流。
   * rejected/skipped 计入独立字段且不进入 totalActionsExecuted
   * 与平均时延——它们从未真正执行。
   */
  recordExecution(execution: ActionExecution): void {
    if (execution.status === 'rejected') {
      this.metrics.actionsRejected += 1;
      return;
    }
    if (execution.status === 'skipped') {
      this.metrics.actionsSkipped += 1;
      return;
    }

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
      actionsRejected: 0,
      actionsSkipped: 0,
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
