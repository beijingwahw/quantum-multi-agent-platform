// 量子态多Agent平台核心类型定义

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
  lastInteraction: Date;
  correlation: number;
  sharedResources: string[];
}
