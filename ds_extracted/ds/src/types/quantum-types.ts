// 量子态多Agent平台核心类型定义
//
// ============ Date 字段的 DTO 语义（2026-09 审计收口） ============
//
// 本模块中类型为 `Date` 的字段（Agent.lastHeartbeat、Task.assignedAt/
// createdAt/updatedAt/completedAt、QuantumMessage.timestamp、
// QuantumEntanglement.lastInteraction）描述的是**进程内**对象形态。
// 它们一旦跨进程边界（WebSocket 总线转发、控制台快照广播、HTTP API）
// 就经过 JSON.stringify：Date 被序列化为 ISO 8601 字符串，对端
// JSON.parse 之后这些字段静态类型仍是 Date、运行时却是 string——
// 类型系统的承诺在反序列化边界处失效。
//
// 约定（最小非破坏）：
//   1. 线上（wire/DTO）形态：ISO 8601 字符串（或 epoch 毫秒数）；
//   2. 进程内消费方需要真实 Date（比较/运算/Date API）时，必须经
//      下述 reviveDate / reviveDateRequired 在入站边界显式复活，
//      不得对反序列化产物直接调用 Date 方法；
//   3. 仅透传/再序列化的中间层（如总线转发）无需复活——string 经过
//      stringify 仍是同一字符串，保持零行为变更。

/** Date 字段在 DTO 边界的可接受形态：Date 实例、ISO 8601 字符串或 epoch 毫秒数 */
export type DateLike = Date | string | number;

/**
 * 入站 DTO 的可选 Date 字段复活（最小非破坏帮助函数）。
 *
 * - Date 实例原样直通（幂等，可对任意来源安全调用）；
 * - 字符串/数字按 Date 构造器解析（ISO 8601 / epoch ms）；
 * - null/undefined 或不可解析的垃圾值返回 undefined——可选字段的
 *   「缺失」与「非法」都归约为 undefined，由调用方决定语义。
 */
export function reviveDate(value: DateLike | null | undefined): Date | undefined {
  if (value == null) return undefined;
  if (value instanceof Date) return value;
  const revived = new Date(value);
  return Number.isNaN(revived.getTime()) ? undefined : revived;
}

/**
 * 入站 DTO 的必填 Date 字段复活：缺失或不可解析时抛 TypeError
 * （指名字段，便于在边界处定位坏载荷），绝不静默给出错误纪元的 Date。
 */
export function reviveDateRequired(value: DateLike, field: string): Date {
  const revived = reviveDate(value);
  if (revived === undefined) {
    throw new TypeError(
      `Invalid date for required field '${field}': expected Date, ISO string or epoch ms, got ${typeof value}`,
    );
  }
  return revived;
}

export interface QuantumState {
  id: string;
  amplitude: number;
  phase: number;
  collapsed: boolean;
  position: Vector3D;
}

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface Agent {
  id: string;
  name: string;
  type: AgentType;
  capabilities: string[];
  state: AgentState;
  load: number;
  position: Vector3D;
  quantumEntanglement: string[];
  /** 最近心跳时刻（DTO 边界为 ISO 字符串，入站消费经 reviveDate） */
  lastHeartbeat: Date;
}

export type AgentType =
  'developer' | 'tester' | 'deployer' | 'monitor' | 'security' | 'devops' | 'custom';

/** agent 状态机：offline 仅经 setAgentState 显式设置（远端失联） */
export type AgentState = 'idle' | 'working' | 'overloaded' | 'offline';

export interface Task {
  id: string;
  name: string;
  type: string;
  priority: TaskPriority;
  quantumState: QuantumState;
  requirements: TaskRequirement[];
  dependencies: string[];
  estimatedDuration: number;
  actualDuration: number;
  status: TaskStatus;
  assignedAgentId?: string;
  /** 以下四个时间戳经 JSON 序列化退化为 ISO 字符串，入站消费经 reviveDate（见文件头 DTO 语义） */
  assignedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  // 任务终结后由completeTask附加的执行结果，内容由调用方定义
  result?: unknown;
}

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type TaskStatus = 'pending' | 'assigned' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface TaskRequirement {
  /**
   * 需求类别。本平台调度器只强制执行 'capability'（agent.capabilities
   * 成员匹配，01#7 起 submitTask 对其余三类直接拒绝——静默忽略硬
   * 约束比拒绝更危险）。'resource' | 'location' | 'quantum' 保留在
   * 类型联合里供下游平台（例如带资源账本或位置感知的调度器）扩展，
   * 本仓调度器遇到即抛 SchedulingError。
   */
  type: 'capability' | 'resource' | 'location' | 'quantum';
  name: string;
  /** 附加匹配值（扩展类需求使用；capability 可省略） */
  value?: unknown;
  weight: number;
}

export interface QuantumMessage {
  id: string;
  type: MessageType;
  sourceAgentId: string;
  targetAgentId?: string;
  targetAgentIds?: string[];
  content: unknown;
  /** 消息时刻（总线转发为 JSON：对端收到的是 ISO 字符串，消费经 reviveDate） */
  timestamp: Date;
  priority: MessagePriority;
  quantumState: QuantumState;
}

export type MessageType =
  | 'task_assignment'
  | 'task_completed'
  | 'task_failed'
  | 'agent_status'
  | 'status_update'
  | 'quantum_entanglement'
  | 'heartbeat'
  | 'connection_ack'
  | 'request'
  | 'response'
  | 'broadcast'
  | 'error';

export type MessagePriority = 'low' | 'medium' | 'high' | 'critical';

export interface SchedulingDecision {
  taskId: string;
  agentId: string;
  probability: number;
  confidence: number;
  reasoning: string;
  alternatives: Array<{
    agentId: string;
    probability: number;
  }>;
}

export interface QuantumEntanglement {
  id: string;
  agentId1: string;
  agentId2: string;
  strength: number;
  /** 最近交互时刻（DTO 边界为 ISO 字符串，入站消费经 reviveDate） */
  lastInteraction: Date;
  correlation: number;
  sharedResources: string[];
}
