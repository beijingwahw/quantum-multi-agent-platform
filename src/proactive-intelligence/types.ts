/**
 * proactive-intelligence 共享类型定义
 *
 * 模块拆分（v1.5 质量跃迁）：此前的单文件 index.ts（1323 行）承载
 * 监控器/决策引擎/执行器/插件四个完整组件。现按职责拆为
 * types.ts / monitor.ts / decision-engine.ts / executor.ts / plugin.ts，
 * index.ts 仅作公共 API 桶文件——对外导入路径与导出面保持不变。
 */

export interface MonitorEvent {
  id: string;
  type: string;
  source: string;
  timestamp: Date;
  /** 事件载荷（形状随事件类型变化，规则按「类型.字段」路径读取） */
  data: Record<string, unknown>;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

export interface DecisionContext<TState = unknown> {
  events: MonitorEvent[];
  /** 当前系统状态（形状由宿主决定，规则按「a.b」路径读取） */
  currentState: TState;
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

/**
 * 条件多态载荷：按 operator 判别 value 形状（替代此前的 value: unknown——
 * between 需要二元组、matches 需要正则、标量比较需要标量，编译期即可收窄，
 * 字段形状错误不再静默流向运行时求值器）。
 */
interface ConditionBase {
  // 'composite' 曾在联合中声明但求值器从不匹配（静默恒 false）——组合
  // 语义已由 conditions[] + logicalOperator 的左到右链式求值覆盖，移除。
  type: 'event' | 'state' | 'time';
  field: string;
  logicalOperator?: 'AND' | 'OR';
}

export interface ScalarCondition extends ConditionBase {
  operator: 'equals' | 'notEquals' | 'contains' | 'notContains' | 'greaterThan' | 'lessThan';
  /** 比较目标值（标量语义） */
  value: string | number | boolean | null;
}

export interface BetweenCondition extends ConditionBase {
  operator: 'between';
  /** [下限, 上限] 二元组（含边界） */
  value: readonly [number, number];
}

export interface MatchesCondition extends ConditionBase {
  operator: 'matches';
  /** 正则（字符串形式或 RegExp 实例） */
  value: string | RegExp;
}

export type Condition = ScalarCondition | BetweenCondition | MatchesCondition;

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
  /**
   * 执行状态机（三态分离——拒绝/跳过/失败语义不可混同）：
   * - rejected：预检拒绝（executor 禁用/策略阻止/并发超限），从未真正发起；
   * - skipped：safeMode 只记录不执行；
   * - failed：真实执行失败（含超时/取消）。
   * 此前三者共用 failed/completed，历史统计与回流指标被系统性污染。
   */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'rejected' | 'skipped';
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
  /** 真实发起过的执行（rejected/skipped 不计入——它们从未执行） */
  totalActionsExecuted: number;
  actionsCompleted: number;
  actionsFailed: number;
  /** 预检拒绝次数（禁用/策略阻止/并发超限） */
  actionsRejected: number;
  /** safeMode 跳过次数 */
  actionsSkipped: number;
  averageDecisionTime: number;
  averageExecutionTime: number;
  rulesTriggered: Record<string, number>;
}
