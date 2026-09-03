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
  operator:
    | 'equals'
    | 'notEquals'
    | 'contains'
    | 'notContains'
    | 'greaterThan'
    | 'lessThan'
    | 'between'
    | 'matches';
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
