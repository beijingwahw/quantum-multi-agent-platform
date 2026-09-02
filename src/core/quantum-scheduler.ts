import { Agent, Task, SchedulingDecision, QuantumState, TaskPriority, TaskStatus } from '../types/quantum-types';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { logDebug, logInfo } from '../utils/logger';
import {
  AssignmentProblem, QuantumSolverOptions, CollapseMode,
  qaoaSolve, annealSolve, bruteForceOptimum, defaultPenalties, couplingKey
} from './quantum-optimizer';
import {
  buildSubspaceModel, qaoaSolveSubspace, annealSolveSubspace, SubspaceModel, SubspaceSolution
} from './subspace-optimizer';
import type { QuantumBackend } from './qpu/quantum-backend';
import { getBackend } from './qpu/quantum-backend';
import { solveAssignmentOnBackend } from './qpu/solve';

const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
};

// 分桶遍历顺序即调度优先顺序
const PRIORITY_ORDER: TaskPriority[] = ['critical', 'high', 'medium', 'low'];

const DEFAULT_MAX_HISTORY = 10000;

/** 量子调度算法：hybrid 为经典启发式热路径；quantum-* 为真实量子算法（态矢量模拟） */
export type QuantumAlgorithm = 'hybrid' | 'wave-function' | 'probability' | 'quantum-qaoa' | 'quantum-annealing';

/** 量子引擎配置（态矢量规模与坍缩协议） */
export interface QuantumEngineConfig {
  /** QAOA 层数 p */
  layers?: number;
  /** 测量采样次数 */
  shots?: number;
  /** 单块量子比特上限（态矢量指数内存，默认 12 = 4096 维希尔伯特空间） */
  qubitCap?: number;
  /** 纠缠耦合的福利加成系数（作用于两任务优先级权重的较小者） */
  entanglementBonus?: number;
  /** 坍缩模式 */
  select?: CollapseMode;
  /** 随机种子 */
  seed?: number;
  /** 退火参数 */
  anneal?: { tau?: number; steps?: number };
  /**
   * 约束子空间维度上限（默认 2^20 ≈ 100万合法分配，内存~150MB）。
   * 子空间引擎在合法分配集合上做精确量子演化：维度 P(n,m) 而非 2^(m·n)，
   * 可联合调度的批量远超全空间态矢量的能力（8任务×10agent 等效 2^80 全空间）。
   */
  subspaceCap?: number;
}

interface AgentScheduleStats {
  total: number;
  byType: Map<string, number>;
}

// QuantumScheduler所需配置切片：平台配置的可选子集（调度与保留策略）
export interface QuantumSchedulerConfig {
  scheduling?: {
    maxHistorySize?: number;
    maxConcurrentTasks?: number;
    sweepInterval?: number;
    taskTimeout?: number;
    quantumAlgorithm?: QuantumAlgorithm;
    quantum?: QuantumEngineConfig;
    /**
     * 事件驱动的即时调度（默认true）。设为false时提交/注册/完成
     * 不再自动逐任务分配，改由 scheduleBatchQuantum 做联合量子调度——
     * 批量模式需要把任务攒起来联合编码，逐任务贪心会破坏联合最优。
     */
    autoSchedule?: boolean;
  };
  performance?: {
    retentionMs?: number;
    retentionDays?: number;
  };
}

/** 批量量子调度报告 */
export interface QuantumBatchReport {
  engine: 'qaoa' | 'annealing' | 'qpu';
  /** 演化载体：subspace = 约束子空间精确模拟；fullspace = 全空间态矢量（分块）；qpu = 真实量子硬件 */
  representation: 'subspace' | 'fullspace' | 'qpu';
  chunks: number;
  assigned: number;
  assignments: Array<{ taskId: string; taskName: string; agentId: string; probability: number }>;
  /** 末态在合法分配子空间上的概率质量（电路质量） */
  validMass: number;
  /** 所选联合分配的 Born 概率（各块平均） */
  meanProbability: number;
  /** 纠缠耦合条数（进入哈密顿量的纠缠对） */
  entanglementCouplings: number;
  /** 与穷举最优的福利对比（问题规模允许时提供） */
  optimality?: {
    achieved: number;
    optimal: number;
    ratio: number;
  };
  /** 子空间引擎信息（representation=subspace 时提供） */
  subspace?: {
    dimension: number;
    /** 等效全空间维度 2^(m·n) 的对数（量子比特数） */
    equivalentQubits: number;
  };
  /** 各块求解详情 */
  solutions: Array<{
    taskIds: string[];
    welfare: number;
    probability: number;
    validMass: number;
    layers: number;
    evaluations: number;
  }>;
}

// 调度器系统指标快照（getSystemMetrics返回结构，计数器化O(1)读取）
export interface SchedulerSystemMetrics {
  totalAgents: number;
  activeAgents: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  pendingTasks: number;
  systemLoad: number;
  quantumEfficiency: number;
  schedulingHistoryLength: number;
}

export class QuantumScheduler extends EventEmitter {
  private agents: Map<string, Agent> = new Map();
  private tasks: Map<string, Task> = new Map();
  private quantumState: Map<string, QuantumState> = new Map();
  private schedulingHistory: SchedulingDecision[] = [];
  private config: QuantumSchedulerConfig;

  // 性能索引：能力 → 具备该能力的agentId集合（候选集O(要求数)求交）
  private capabilityIndex: Map<string, Set<string>> = new Map();
  // 性能索引：挂起任务按优先级分桶，免除每次重调度的全量排序
  private pendingBuckets: Map<TaskPriority, string[]> = new Map();
  // 性能统计：替代每次决策过滤整个调度历史（O(1)量子相关性）
  private agentStats: Map<string, AgentScheduleStats> = new Map();
  // 计数器：指标计算O(1)，不随任务总量增长
  private totalDecisions = 0;
  private completedAssignments = 0;
  private completedCount = 0;
  private failedCount = 0;
  private pendingCount = 0;
  // 已入桶追踪：保证pendingCount只在真正入过桶的任务上增减
  private pendingTracked: Set<string> = new Set();
  // 当前占用中的agent数（assigned/running），用于并发上限背压
  private activeAssignments = 0;
  // 周期巡检：超时回收 + 已终结任务保留清理
  private sweepTimer: NodeJS.Timeout | null = null;
  // 量子引擎统计：真实量子路径的运行计数与Born概率累积
  private quantumSingleDecisions = 0;
  private quantumBatchRuns = 0;
  private quantumBatchAssigned = 0;
  private quantumProbabilitySum = 0;
  private lastOptimalityRatio: number | null = null;

  constructor(config: QuantumSchedulerConfig) {
    super();
    this.config = config;
  }

  private get maxHistory(): number {
    return this.config?.scheduling?.maxHistorySize ?? DEFAULT_MAX_HISTORY;
  }

  // Agent管理
  registerAgent(agent: Agent): void {
    this.agents.set(agent.id, agent);
    this.initializeQuantumState(agent);
    this.indexCapabilities(agent);
    this.agentStats.set(agent.id, { total: 0, byType: new Map() });
    this.emit('agent_registered', agent);
    logInfo('QuantumScheduler', `Agent registered: ${agent.name} (${agent.id})`);

    // 新agent加入后，尝试调度之前无agent可用的挂起任务
    if (this.config?.scheduling?.autoSchedule !== false) {
      this.reschedulePendingTasks();
    }
  }

  unregisterAgent(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      this.agents.delete(agentId);
      this.quantumState.delete(agentId);
      // 从能力索引中移除
      for (const capability of agent.capabilities) {
        this.capabilityIndex.get(capability)?.delete(agentId);
      }
      this.agentStats.delete(agentId);
      this.emit('agent_unregistered', agent);
      logInfo('QuantumScheduler', `Agent unregistered: ${agent.name} (${agentId})`);
    }
  }

  private indexCapabilities(agent: Agent): void {
    for (const capability of agent.capabilities) {
      let set = this.capabilityIndex.get(capability);
      if (!set) {
        set = new Set();
        this.capabilityIndex.set(capability, set);
      }
      set.add(agent.id);
    }
  }

  updateAgent(agent: Partial<Agent> & { id: string }): void {
    const existing = this.agents.get(agent.id);
    if (existing) {
      const merged = { ...existing, ...agent };
      this.agents.set(agent.id, merged);
      // 能力变化时重建该agent的索引项
      if (agent.capabilities) {
        for (const capability of existing.capabilities) {
          this.capabilityIndex.get(capability)?.delete(agent.id);
        }
        this.indexCapabilities(merged);
      }
      this.emit('agent_updated', this.agents.get(agent.id));
    }
  }

  // Task管理
  submitTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'quantumState'>): Task {
    // 依赖校验：未知依赖ID直接拒绝，避免任务永远挂起的静默陷阱
    for (const depId of task.dependencies || []) {
      if (!this.tasks.has(depId)) {
        throw new Error(`Unknown dependency '${depId}' for task '${task.name}'`);
      }
    }

    const fullTask: Task = {
      ...task,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date(),
      quantumState: this.generateQuantumState()
    };

    this.tasks.set(fullTask.id, fullTask);
    this.emit('task_submitted', fullTask);

    // 立即尝试调度（批量模式下攒起来等联合量子调度）
    if (this.config?.scheduling?.autoSchedule !== false) {
      this.scheduleTask(fullTask.id);
    }

    // 未被分配则进入对应优先级分桶等待
    if (fullTask.status === 'pending') {
      this.enqueuePending(fullTask.id, fullTask.priority);
    }

    logDebug('QuantumScheduler', `Task submitted: ${task.name} (${fullTask.id})`);
    return fullTask;
  }

  private enqueuePending(taskId: string, priority: TaskPriority): void {
    let bucket = this.pendingBuckets.get(priority);
    if (!bucket) {
      bucket = [];
      this.pendingBuckets.set(priority, bucket);
    }
    bucket.push(taskId);
    this.pendingTracked.add(taskId);
    this.pendingCount++;
  }

  updateTaskStatus(taskId: string, status: TaskStatus): void {
    if (this.tasks.has(taskId)) {
      this.completeTask(taskId, status === 'completed');
    }
  }

  // 任务完成/失败：更新状态、释放agent、触发挂起任务重调度
  completeTask(taskId: string, success: boolean = true, result?: unknown): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    const wasPending = task.status === 'pending';
    const now = new Date();

    if (success) {
      task.status = 'completed';
      task.completedAt = now;
      this.completedCount++;
      // 仅统计真正经过调度决策并完成的任务
      if (task.assignedAgentId) this.completedAssignments++;
    } else {
      task.status = 'failed';
      this.failedCount++;
    }
    if (wasPending && this.pendingTracked.delete(taskId)) {
      this.pendingCount--;
    }
    task.updatedAt = now;
    task.actualDuration = now.getTime() - task.createdAt.getTime();
    if (result !== undefined) {
      task.result = result;
    }
    this.tasks.set(taskId, task);

    // 释放agent
    if (task.assignedAgentId) {
      this.activeAssignments = Math.max(0, this.activeAssignments - 1);
      const agent = this.agents.get(task.assignedAgentId);
      if (agent) {
        agent.load = Math.max(0, agent.load - 1);
        if (agent.state === 'working') {
          agent.state = agent.load > 80 ? 'overloaded' : 'idle';
        }
        this.agents.set(agent.id, agent);
      }
    }

    if (success) {
      this.emit('task_completed', { taskId, task, result });
    } else {
      this.emit('task_failed', { taskId, task, result });
      // 级联失败：依赖本任务的任务一并失败，避免永久挂起
      this.cascadeFailure(taskId);
    }

    logDebug('QuantumScheduler', `Task ${success ? 'completed' : 'failed'}: ${task.name} (${taskId})`);

    // 释放出的容量立即用于挂起任务（批量模式下留待联合调度）
    if (this.config?.scheduling?.autoSchedule !== false) {
      this.reschedulePendingTasks();
    }
    return true;
  }

  // 量子调度算法
  scheduleTask(taskId: string): SchedulingDecision | null {
    const task = this.tasks.get(taskId);
    if (!task) {
      logDebug('QuantumScheduler', `Task not found: ${taskId}`);
      return null;
    }

    // 依赖门控：前置任务未全部完成前不调度
    if (!this.dependenciesMet(task)) {
      logDebug('QuantumScheduler', `Task ${taskId} waiting for dependencies`);
      return null;
    }

    const decision = this.tryAssign(task, this.resolveCandidates(task));

    if (!decision) {
      logDebug('QuantumScheduler', `No available agents for task: ${taskId}`);
    }

    return decision;
  }

  // 前置依赖是否全部完成
  private dependenciesMet(task: Task): boolean {
    if (!task.dependencies || task.dependencies.length === 0) return true;
    return task.dependencies.every(depId => {
      const dep = this.tasks.get(depId);
      return dep !== undefined && dep.status === 'completed';
    });
  }

  // 级联失败：将依赖failedTaskId的未终结任务标记失败（递归向下传播）
  private cascadeFailure(failedTaskId: string, depth: number = 0): void {
    if (depth > 100) return; // 防御环形依赖导致的无限递归

    const dependents: string[] = [];
    for (const t of this.tasks.values()) {
      if ((t.status === 'pending' || t.status === 'assigned' || t.status === 'running') &&
          t.dependencies && t.dependencies.includes(failedTaskId)) {
        dependents.push(t.id);
      }
    }

    for (const id of dependents) {
      this.completeTask(id, false, { reason: 'dependency_failed', dependency: failedTaskId });
    }
  }

  // 对给定候选集做量子决策并完成分配（供直接调度与重调度共用）
  private tryAssign(task: Task, candidates: Agent[]): SchedulingDecision | null {
    if (candidates.length === 0) return null;

    // 并发上限背压：占满后任务留待后续释放
    const maxConcurrent = this.config?.scheduling?.maxConcurrentTasks;
    if (maxConcurrent != null && this.activeAssignments >= maxConcurrent) {
      logDebug('QuantumScheduler', `Concurrency limit reached (${maxConcurrent}), task ${task.id} deferred`);
      return null;
    }

    const decision = this.makeQuantumDecision(task, candidates);
    return this.applyAssignmentDecision(task, decision);
  }

  // 应用一次已生成的调度决策：占用agent、入历史、广播事件
  // （经典单任务路径与量子批量路径共用）
  private applyAssignmentDecision(task: Task, decision: SchedulingDecision): SchedulingDecision {
    this.assignTaskToAgent(task.id, decision.agentId);
    this.schedulingHistory.push(decision);
    this.totalDecisions++;
    // 有界历史：防止长时运行下内存无限增长
    if (this.schedulingHistory.length > this.maxHistory) {
      this.schedulingHistory.splice(0, this.schedulingHistory.length - this.maxHistory);
    }
    this.emit('task_scheduled', { taskId: task.id, decision });

    logDebug('QuantumScheduler', `Task ${task.id} assigned to agent ${decision.agentId}`);
    return decision;
  }

  // 经能力索引求交得到空闲候选集，避免全agent扫描
  private resolveCandidates(task: Task): Agent[] {
    let candidateIds: Set<string> | null = null;

    for (const req of task.requirements) {
      if (req.type !== 'capability') continue;
      const set = this.capabilityIndex.get(req.name);
      if (!set) {
        return []; // 无任何agent具备该能力
      }
      if (candidateIds === null) {
        candidateIds = new Set(set);
      } else {
        for (const id of candidateIds) {
          if (!set.has(id)) candidateIds.delete(id);
        }
      }
      if (candidateIds.size === 0) return [];
    }

    const available: Agent[] = [];
    const source: Iterable<string> = candidateIds ?? this.agents.keys();
    for (const id of source) {
      const agent = this.agents.get(id);
      if (agent && agent.state === 'idle') {
        available.push(agent);
      }
    }
    return available;
  }

  // 挂起任务重调度：按分桶顺序（critical→low）遍历，免除排序。
  // 空闲池匹配：直接在空闲agent池内按能力筛选后量子评分分配，
  // 池空即全局终止——不受"空闲但能力不符"的agent干扰，
  // 每轮成本O(挂起任务+空闲池)，与挂起总量解耦。
  reschedulePendingTasks(): number {
    // 空闲池快照
    const idlePool: Agent[] = [];
    for (const agent of this.agents.values()) {
      if (agent.state === 'idle') idlePool.push(agent);
    }
    if (idlePool.length === 0) return 0;

    let scheduledCount = 0;

    for (const priority of PRIORITY_ORDER) {
      const bucket = this.pendingBuckets.get(priority);
      if (!bucket || bucket.length === 0) continue;

      const remaining: string[] = [];

      for (const taskId of bucket) {
        if (idlePool.length === 0) {
          // 空闲池已尽：剩余任务原样留桶，不再逐个尝试
          remaining.push(taskId);
          continue;
        }

        const task = this.tasks.get(taskId);
        // 惰性清理：已分配/完成/取消的条目直接出桶
        if (!task || task.status !== 'pending') continue;

        // 依赖未就绪的任务留桶，避免无效的候选匹配
        if (!this.dependenciesMet(task)) {
          remaining.push(taskId);
          continue;
        }

        // 在空闲池中筛出能力匹配的候选，保留量子评分质量
        const matches: Agent[] = [];
        for (const agent of idlePool) {
          if (this.checkCapabilityMatch(agent, task)) matches.push(agent);
        }

        if (matches.length > 0) {
          const decision = this.tryAssign(task, matches);
          if (decision) {
            scheduledCount++;
            // 将已分配agent移出空闲池
            const idx = idlePool.findIndex(a => a.id === decision.agentId);
            if (idx >= 0) idlePool.splice(idx, 1);
          } else {
            remaining.push(taskId);
          }
        } else {
          // 池中有空闲agent但能力不符：留待agent构成变化
          remaining.push(taskId);
        }
      }

      if (remaining.length === 0) {
        this.pendingBuckets.delete(priority);
      } else {
        this.pendingBuckets.set(priority, remaining);
      }
    }

    return scheduledCount;
  }

  private countIdleAgents(): number {
    let count = 0;
    for (const agent of this.agents.values()) {
      if (agent.state === 'idle') count++;
    }
    return count;
  }

  // 周期巡检：分配超时回收 + 已终结任务保留清理
  private ensureSweepTimer(): void {
    if (this.sweepTimer) return;
    const interval = this.config?.scheduling?.sweepInterval ?? 5000;
    this.sweepTimer = setInterval(() => this.sweep(), interval);
    // 不阻止进程退出
    this.sweepTimer.unref?.();
  }

  private sweep(): void {
    const now = Date.now();
    const timeout = this.config?.scheduling?.taskTimeout ?? 30000;

    // 1) 超时回收：assigned/running超时的任务标记失败，释放agent并级联
    for (const task of this.tasks.values()) {
      if ((task.status === 'assigned' || task.status === 'running') && task.assignedAt) {
        if (now - task.assignedAt.getTime() > timeout) {
          this.completeTask(task.id, false, { reason: 'timeout', elapsedMs: now - task.assignedAt.getTime() });
        }
      }
    }

    // 2) 保留清理：终结超过保留期的任务从内存移除（计数器指标保留历史总量）
    const retentionMs = this.config?.performance?.retentionMs ??
      (this.config?.performance?.retentionDays ?? 30) * 86400000;
    if (retentionMs > 0) {
      for (const [id, task] of this.tasks) {
        if (task.status === 'completed' || task.status === 'failed') {
          const endedAt = task.completedAt?.getTime() ?? task.updatedAt.getTime();
          if (now - endedAt > retentionMs) {
            this.tasks.delete(id);
          }
        }
      }
    }
  }

  // 停止巡检定时器，供平台关闭时调用
  shutdown(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
  }

  private generateQuantumState(): QuantumState {
    return {
      id: uuidv4(),
      amplitude: Math.random(),
      phase: Math.random() * 2 * Math.PI,
      collapsed: false,
      position: { x: Math.random(), y: Math.random(), z: Math.random() }
    };
  }

  private initializeQuantumState(agent: Agent): void {
    const quantumState = this.generateQuantumState();
    this.quantumState.set(agent.id, quantumState);
  }

  private makeQuantumDecision(task: Task, agents: Agent[]): SchedulingDecision {
    const algorithm = this.config?.scheduling?.quantumAlgorithm ?? 'hybrid';
    if (algorithm === 'quantum-qaoa' || algorithm === 'quantum-annealing') {
      return this.makeTrueQuantumDecision(task, agents, algorithm);
    }
    // 量子波函数调度算法
    const scores = agents.map(agent => {
      const agentQuantumState = this.quantumState.get(agent.id);
      const distance = this.calculateQuantumDistance(agentQuantumState!, task.quantumState);
      const capabilityScore = this.calculateCapabilityScore(agent, task);
      const loadScore = 1 / (agent.load + 0.1);
      // O(1)相关性：直接读预置计数，不回扫历史
      const stats = this.agentStats.get(agent.id);
      const correlationScore = stats && stats.total > 0
        ? (stats.byType.get(task.type) || 0) / stats.total
        : 0;

      const totalScore = (0.3 * distance) + (0.4 * capabilityScore) + (0.2 * loadScore) + (0.1 * correlationScore);

      return {
        agentId: agent.id,
        score: totalScore
      };
    });

    scores.sort((a, b) => b.score - a.score);

    const bestScore = scores[0];
    const totalScoreSum = scores.reduce((sum, s) => sum + s.score, 0);

    return {
      taskId: task.id,
      agentId: bestScore.agentId,
      probability: bestScore.score / totalScoreSum,
      confidence: Math.min(bestScore.score * 2, 1),
      reasoning: `Quantum distance optimization with capability matching`,
      alternatives: scores.slice(1, 3).map(s => ({
        agentId: s.agentId,
        probability: s.score / totalScoreSum
      }))
    };
  }

  private calculateQuantumDistance(q1: QuantumState, q2: QuantumState): number {
    const dx = q1.position.x - q2.position.x;
    const dy = q1.position.y - q2.position.y;
    const dz = q1.position.z - q2.position.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  // ============ 真正的量子调度路径 ============
  // 单任务：任务在候选agent集合上建立 one-hot 叠加态，量子演化（QAOA/
  // 绝热退火）放大高福利分支的振幅，测量坍缩得到分配；
  // decision.probability 是所选基态的真实 Born 概率 |ψ(x)|²。

  /** agent-任务亲和度：经典评分四要素（能力/负载/相关性/量子距离）的加权和，进入哈密顿量 */
  private agentAffinity(agent: Agent, task: Task): number {
    const distance = this.calculateQuantumDistance(this.quantumState.get(agent.id)!, task.quantumState);
    const capabilityScore = this.calculateCapabilityScore(agent, task);
    const loadScore = 1 / (agent.load + 0.1);
    const stats = this.agentStats.get(agent.id);
    const correlationScore = stats && stats.total > 0
      ? (stats.byType.get(task.type) || 0) / stats.total
      : 0;
    const distanceScore = 1 / (1 + distance); // 距离越近越高（归一化到(0,1]）
    return (0.4 * capabilityScore) + (0.2 * loadScore) + (0.1 * correlationScore) + (0.3 * distanceScore);
  }

  private buildSolverOptions(): QuantumSolverOptions {
    const q = this.config?.scheduling?.quantum ?? {};
    return {
      layers: q.layers,
      shots: q.shots,
      select: q.select,
      seed: q.seed,
      anneal: q.anneal
    };
  }

  private makeTrueQuantumDecision(task: Task, agents: Agent[], algorithm: 'quantum-qaoa' | 'quantum-annealing'): SchedulingDecision {
    // 单候选：平凡坍缩，无需演化
    if (agents.length === 1) {
      this.quantumSingleDecisions++;
      return {
        taskId: task.id,
        agentId: agents[0].id,
        probability: 1,
        confidence: 1,
        reasoning: 'trivial collapse: single candidate',
        alternatives: []
      };
    }

    const priorityWeight = PRIORITY_WEIGHT[task.priority] / 4; // 0.25..1
    const problem: AssignmentProblem = {
      taskIds: [task.id],
      agentIds: agents.map(a => a.id),
      weights: [agents.map(a => priorityWeight * this.agentAffinity(a, task))],
      ineligible: [agents.map(() => false)],
      couplings: new Map(),
      penaltyOneHot: 0,
      penaltyCapacity: 0
    };
    const penalties = defaultPenalties(problem);
    problem.penaltyOneHot = penalties.oneHot;
    problem.penaltyCapacity = penalties.capacity;

    const solution = algorithm === 'quantum-qaoa'
      ? qaoaSolve(problem, this.buildSolverOptions())
      : annealSolve(problem, this.buildSolverOptions());

    const agentIndex = solution.assignment[0] ?? -1;
    const chosen = agentIndex >= 0 ? agents[agentIndex] : agents[0];
    this.quantumSingleDecisions++;
    this.quantumProbabilitySum += solution.probability;

    return {
      taskId: task.id,
      agentId: chosen.id,
      probability: solution.probability,
      confidence: solution.validMass,
      reasoning: `${solution.engine}: superposition over ${agents.length} agents, ` +
        `evolution (${solution.layers} ${solution.engine === 'qaoa' ? 'layers' : 'steps'}), ` +
        `Born collapse p=${solution.probability.toFixed(3)}`,
      alternatives: solution.candidates.slice(1, 3).map(c => ({
        agentId: agents[c.assignment[0]]?.id ?? chosen.id,
        probability: c.probability
      }))
    };
  }

  /**
   * 批量联合量子调度（量子态调度的完整形态）：
   * 把一批挂起任务与空闲agent的**联合分配问题**编码为哈密顿量——
   * 所有分配组合同时存在于叠加态中，纠缠的agent对以耦合项进入能量，
   * 演化后测量坍缩得到联合分配。这是逐任务贪心无法表达的联合最优。
   *
   * @param taskIds 指定任务（缺省取全部挂起任务，按优先级）
   */
  scheduleBatchQuantum(taskIds?: string[]): QuantumBatchReport {
    const algorithm: 'quantum-qaoa' | 'quantum-annealing' =
      this.config?.scheduling?.quantumAlgorithm === 'quantum-annealing'
        ? 'quantum-annealing'
        : 'quantum-qaoa';
    const engineKind = algorithm === 'quantum-qaoa' ? 'qaoa' as const : 'annealing' as const;

    // 1) 收集可调度任务：显式ID或按优先级桶顺序的全部挂起任务
    let candidates: Task[];
    if (taskIds) {
      candidates = taskIds
        .map(id => this.tasks.get(id))
        .filter((t): t is Task => !!t && t.status === 'pending' && this.dependenciesMet(t));
    } else {
      candidates = [];
      for (const priority of PRIORITY_ORDER) {
        for (const id of this.pendingBuckets.get(priority) ?? []) {
          const task = this.tasks.get(id);
          if (task && task.status === 'pending' && this.dependenciesMet(task)) {
            candidates.push(task);
          }
        }
      }
    }

    // 2) 空闲agent池与并发余量
    const idlePool = this.getAgents().filter(a => a.state === 'idle');
    const maxConcurrent = this.config?.scheduling?.maxConcurrentTasks;
    const slots = maxConcurrent != null
      ? Math.max(0, maxConcurrent - this.activeAssignments)
      : Infinity;

    if (candidates.length === 0 || idlePool.length === 0 || slots === 0) {
      return {
        engine: engineKind, representation: 'fullspace', chunks: 0, assigned: 0, assignments: [],
        validMass: 0, meanProbability: 0, entanglementCouplings: 0,
        solutions: []
      };
    }

    // 3) 能力过滤：无可匹配agent的任务出局
    const schedulable = candidates.filter(task =>
      idlePool.some(agent => this.checkCapabilityMatch(agent, task))
    );

    // 4) 首选：约束子空间精确引擎（多轮）—— 每轮把至多 min(空闲数, 维度
    //    上限允许的任务数) 个任务联合编码进子空间精确求解。任务多于空闲
    //    agent（m > n）时自动分轮，联合窗口保持最大，不再退化到全空间小分块。
    //    可联合调度的批量远超全空间态矢量（例：8任务×10agent = 181万维
    //    子空间，等效全空间 2^80 维）。
    const subspaceCap = this.config?.scheduling?.quantum?.subspaceCap ?? (1 << 20);
    if (schedulable.length > 0 && idlePool.length >= 2) {
      const subspaceReport = this.runSubspaceRounds(schedulable, algorithm, subspaceCap, slots, maxConcurrent ?? null);
      if (subspaceReport) return subspaceReport;
    }

    // 5) 回退：全空间态矢量分块路径（子空间超维或不定时使用）
    //    任务数×agent数 ≤ qubitCap（态矢量内存上限）
    const qubitCap = this.config?.scheduling?.quantum?.qubitCap ?? 12;
    const chunks: Task[][] = [];
    let current: Task[] = [];
    for (const task of schedulable) {
      if (current.length > 0 && (current.length + 1) * idlePool.length > qubitCap) {
        chunks.push(current);
        current = [];
      }
      current.push(task);
    }
    if (current.length > 0) chunks.push(current);

    // 6) 逐块求解：构建哈密顿量（亲和度+纠缠耦合）→ 演化 → 坍缩
    const report: QuantumBatchReport = {
      engine: engineKind,
      representation: 'fullspace',
      chunks: chunks.length,
      assigned: 0,
      assignments: [],
      validMass: 0,
      meanProbability: 0,
      entanglementCouplings: 0,
      solutions: []
    };

    let achievedWelfare = 0;
    let optimalWelfare = 0;
    let optimalityKnown = true;

    for (const chunk of chunks) {
      if (this.activeAssignments >= slots && maxConcurrent != null) break;
      const remainingSlots = maxConcurrent != null ? slots - this.activeAssignments : Infinity;

      const { problem, couplingCount, nqubits } = this.buildBatchProblem(chunk, idlePool);
      report.entanglementCouplings += couplingCount;

      const solverOptions = this.buildSolverOptions();
      const solution = algorithm === 'quantum-qaoa'
        ? qaoaSolve(problem, solverOptions)
        : annealSolve(problem, solverOptions);

      // 精确最优对照（问题规模允许时）：量子解 vs 穷举最优的诚实自检
      const brute = nqubits <= 16 ? bruteForceOptimum(problem) : null;
      achievedWelfare += solution.welfare;
      if (brute) {
        optimalWelfare += brute.welfare;
      } else {
        optimalityKnown = false;
      }

      report.solutions.push({
        taskIds: chunk.map(t => t.id),
        welfare: solution.welfare,
        probability: solution.probability,
        validMass: solution.validMass,
        layers: solution.layers,
        evaluations: solution.evaluations
      });
      report.validMass += solution.validMass;

      // 6) 应用坍缩结果：仍受并发上限约束
      for (let t = 0; t < chunk.length; t++) {
        if (report.assigned >= remainingSlots) break;
        const task = chunk[t];
        if (task.status !== 'pending') continue; // 并发块内前序已占用
        const agentIndex = solution.assignment[t];
        if (agentIndex == null || agentIndex < 0) continue;
        if (problem.ineligible[t][agentIndex]) continue;
        const agent = idlePool[agentIndex];
        if (agent.state !== 'idle') continue; // 同块内被占用

        const decision: SchedulingDecision = {
          taskId: task.id,
          agentId: agent.id,
          probability: solution.probability, // 联合分配的Born概率
          confidence: solution.validMass,
          reasoning: `batch ${solution.engine}: joint superposition of ${chunk.length} tasks × ` +
            `${idlePool.length} agents${couplingCount > 0 ? `, ${couplingCount} entanglement couplings` : ''}, ` +
            `Born collapse p=${solution.probability.toFixed(3)}`,
          alternatives: []
        };
        this.applyAssignmentDecision(task, decision);
        report.assigned++;
        report.assignments.push({
          taskId: task.id,
          taskName: task.name,
          agentId: agent.id,
          probability: solution.probability
        });
        this.quantumProbabilitySum += solution.probability;
      }
    }

    this.quantumBatchRuns++;
    this.quantumBatchAssigned += report.assigned;
    if (report.solutions.length > 0) {
      report.validMass /= report.solutions.length;
      report.meanProbability = report.solutions.reduce((s, x) => s + x.probability, 0) / report.solutions.length;
    }
    if (optimalityKnown && optimalWelfare > 0) {
      report.optimality = {
        achieved: achievedWelfare,
        optimal: optimalWelfare,
        ratio: achievedWelfare / optimalWelfare
      };
      this.lastOptimalityRatio = report.optimality.ratio;
    }

    logInfo('QuantumScheduler',
      `Quantum batch (${algorithm}/fullspace): ${report.assigned}/${candidates.length} tasks assigned ` +
      `in ${report.chunks} chunk(s), meanBornP=${report.meanProbability.toFixed(3)}` +
      (report.optimality ? `, optimality=${(report.optimality.ratio * 100).toFixed(1)}%` : ''));
    return report;
  }

  /**
   * 子空间多轮求解：每轮取至多 P(空闲数, k) ≤ subspaceCap 的最大 k 个
   * 挂起任务，与当前空闲池联合编码进约束子空间精确求解，应用坍缩结果后
   * 进入下一轮（前轮占用的agent自动出池）。任何一轮都不可行时返回 null
   * 交由调用方回退全空间路径。
   */
  private runSubspaceRounds(
    tasks: Task[],
    algorithm: 'quantum-qaoa' | 'quantum-annealing',
    subspaceCap: number,
    slots: number,
    maxConcurrent: number | null
  ): QuantumBatchReport | null {
    const report: QuantumBatchReport = {
      engine: algorithm === 'quantum-qaoa' ? 'qaoa' : 'annealing',
      representation: 'subspace',
      chunks: 0,
      assigned: 0,
      assignments: [],
      validMass: 1, // 子空间全部基态合法：概率质量恒为1
      meanProbability: 0,
      entanglementCouplings: 0,
      solutions: []
    };

    let achieved = 0;
    let optimal = 0;
    let maxDim = 0;
    let maxQubits = 0;
    let pending = tasks.filter(t => t.status === 'pending');
    let anyRound = false;

    while (pending.length > 0) {
      if (maxConcurrent != null && this.activeAssignments >= slots) break;
      const pool = this.getAgents().filter(a => a.state === 'idle');
      if (pool.length < 1) break;

      // 本轮可行任务：当前空闲池中至少一个能力匹配的agent
      const feasible = pending.filter(t => pool.some(a => this.checkCapabilityMatch(a, t)));
      if (feasible.length === 0) break;

      // 维度上限允许的最大联合任务数 k：P(n,k) ≤ subspaceCap
      let k = 0;
      let d = 1;
      while (k < pool.length) {
        const next = d * (pool.length - k);
        if (next > subspaceCap) break;
        d = next;
        k++;
      }
      k = Math.max(1, k);

      const remainingSlots = maxConcurrent != null ? slots - this.activeAssignments : Infinity;
      const round = feasible.slice(0, Math.min(k, pool.length, remainingSlots));
      if (round.length === 0) break;

      const built = this.buildBatchProblem(round, pool);
      const model = buildSubspaceModel(built.problem, { dimensionCap: subspaceCap });
      if (!model || model.dimension === 0) break;

      // QAOA 变分训练成本随维度线性放大，大子空间自动改用退火（一次演化）
      const useQaoa = algorithm === 'quantum-qaoa' && model.dimension <= (1 << 16);
      const solution = useQaoa
        ? qaoaSolveSubspace(model, this.buildSolverOptions())
        : annealSolveSubspace(model, this.buildSolverOptions());

      report.engine = solution.engine;
      report.chunks++;
      report.entanglementCouplings += built.couplingCount;
      achieved += solution.welfare;
      optimal += model.optimalWelfare;
      maxDim = Math.max(maxDim, model.dimension);
      maxQubits = Math.max(maxQubits, round.length * pool.length);
      report.solutions.push({
        taskIds: round.map(t => t.id),
        welfare: solution.welfare,
        probability: solution.probability,
        validMass: 1,
        layers: solution.layers,
        evaluations: solution.evaluations
      });
      anyRound = true;

      let assignedThisRound = 0;
      for (let t = 0; t < round.length; t++) {
        const task = round[t];
        if (task.status !== 'pending') continue;
        const agentIndex = solution.assignment[t];
        if (agentIndex == null || agentIndex < 0) continue;
        const agent = pool[agentIndex];
        if (agent.state !== 'idle') continue;

        const decision: SchedulingDecision = {
          taskId: task.id,
          agentId: agent.id,
          probability: solution.probability, // 联合分配的Born概率
          confidence: 1,
          reasoning: `subspace ${solution.engine}: exact evolution over P(${pool.length},${round.length})` +
            `=${model.dimension} valid assignments (equiv. ${round.length * pool.length} qubits full space)` +
            `${built.couplingCount > 0 ? `, ${built.couplingCount} entanglement couplings` : ''}, ` +
            `Born collapse p=${solution.probability.toExponential(2)}`,
          alternatives: []
        };
        this.applyAssignmentDecision(task, decision);
        report.assigned++;
        report.assignments.push({
          taskId: task.id,
          taskName: task.name,
          agentId: agent.id,
          probability: solution.probability
        });
        this.quantumProbabilitySum += solution.probability;
        assignedThisRound++;
      }
      if (assignedThisRound === 0) break; // 防御：无进展即退出

      pending = pending.filter(t => t.status === 'pending');
    }

    if (!anyRound) return null;

    if (report.solutions.length > 0) {
      report.meanProbability = report.solutions.reduce((s, x) => s + x.probability, 0) / report.solutions.length;
    }
    if (optimal > 0) {
      report.optimality = { achieved, optimal, ratio: achieved / optimal };
    }
    report.subspace = { dimension: maxDim, equivalentQubits: maxQubits };

    this.quantumBatchRuns++;
    this.quantumBatchAssigned += report.assigned;
    if (report.optimality) {
      this.lastOptimalityRatio = report.optimality.ratio;
    }

    logInfo('QuantumScheduler',
      `Quantum batch (${report.engine}/subspace, ${report.chunks} round(s)): ` +
      `${report.assigned} tasks, maxDim=${maxDim} (equiv ${maxQubits} qubits)` +
      (report.optimality ? `, optimality=${(report.optimality.ratio * 100).toFixed(1)}%` : ''));
    return report;
  }

  /**
   * 批量哈密顿量构建（子空间与全空间两条路径共用）：
   * 福利权重 = 优先级 × 亲和度；能力不符 → 不合格；
   * 纠缠agent对 → 二次耦合福利加成（物理意义上的哈密顿量耦合项）。
   */
  private buildBatchProblem(chunk: Task[], idlePool: Agent[]): {
    problem: AssignmentProblem;
    couplingCount: number;
    nqubits: number;
  } {
    const entanglementBonus = this.config?.scheduling?.quantum?.entanglementBonus ?? 0.15;
    const problem: AssignmentProblem = {
      taskIds: chunk.map(t => t.id),
      agentIds: idlePool.map(a => a.id),
      weights: [],
      ineligible: [],
      couplings: new Map(),
      penaltyOneHot: 0,
      penaltyCapacity: 0
    };
    const nqubits = chunk.length * idlePool.length;

    // 福利权重：优先级 × 亲和度；能力不符 → 不合格
    for (const task of chunk) {
      const pw = PRIORITY_WEIGHT[task.priority] / 4;
      problem.weights.push(idlePool.map(agent => pw * this.agentAffinity(agent, task)));
      problem.ineligible.push(idlePool.map(agent => !this.checkCapabilityMatch(agent, task)));
    }

    // 纠缠耦合：任意两任务落在纠缠agent对上 → 福利加成（哈密顿量的物理耦合项）
    let couplingCount = 0;
    for (let t1 = 0; t1 < chunk.length; t1++) {
      for (let t2 = t1 + 1; t2 < chunk.length; t2++) {
        const pwMin = Math.min(PRIORITY_WEIGHT[chunk[t1].priority], PRIORITY_WEIGHT[chunk[t2].priority]) / 4;
        for (let a1 = 0; a1 < idlePool.length; a1++) {
          for (let a2 = 0; a2 < idlePool.length; a2++) {
            if (a1 === a2) continue;
            if (idlePool[a1].quantumEntanglement.includes(idlePool[a2].id) &&
                !problem.ineligible[t1][a1] && !problem.ineligible[t2][a2]) {
              problem.couplings.set(
                couplingKey(t1 * idlePool.length + a1, t2 * idlePool.length + a2, nqubits),
                entanglementBonus * pwMin
              );
              couplingCount++;
            }
          }
        }
      }
    }

    // 全空间路径需要罚项（子空间路径忽略罚项——约束内建于子空间本身）
    const penalties = defaultPenalties(problem);
    problem.penaltyOneHot = penalties.oneHot;
    problem.penaltyCapacity = penalties.capacity;

    return { problem, couplingCount, nqubits };
  }

  /**
   * 在真实量子硬件上执行批量联合调度（异步——云端 QPU 是网络调用）：
   * 联合分配编码为 Ising → 提交 D-Wave Leap（或其它 QuantumBackend）→
   * 采样 → 合法性校验 → 与本地精确最优对照 → 应用分配。
   * 后端缺省自动选择：有 DWAVE_API_TOKEN 凭据时用真 QPU，否则本地精确引擎。
   * 真实硬件噪声由三道闸门兜底（非法样本丢弃 / 能量核对 / 最优率报告）。
   */
  async scheduleBatchQuantumQpu(
    backend?: QuantumBackend,
    options: { numReads?: number; timeoutMs?: number } = {}
  ): Promise<QuantumBatchReport> {
    const engine = backend ?? getBackend();

    // 收集可调度任务（与 scheduleBatchQuantum 相同语义：优先级桶顺序）
    const candidates: Task[] = [];
    for (const priority of PRIORITY_ORDER) {
      for (const id of this.pendingBuckets.get(priority) ?? []) {
        const task = this.tasks.get(id);
        if (task && task.status === 'pending' && this.dependenciesMet(task)) {
          candidates.push(task);
        }
      }
    }
    const idlePool = this.getAgents().filter(a => a.state === 'idle');
    const maxConcurrent = this.config?.scheduling?.maxConcurrentTasks;
    const slots = maxConcurrent != null ? Math.max(0, maxConcurrent - this.activeAssignments) : Infinity;

    if (candidates.length === 0 || idlePool.length === 0 || slots === 0) {
      return {
        engine: 'qpu', representation: 'qpu', chunks: 0, assigned: 0, assignments: [],
        validMass: 0, meanProbability: 0, entanglementCouplings: 0, solutions: []
      };
    }

    const feasible = candidates.filter(task =>
      idlePool.some(agent => this.checkCapabilityMatch(agent, task))
    );
    // 真 QPU 不受本地态矢量内存限制（Ising 变量数即规模），一轮吃满空闲池
    const round = feasible.slice(0, Math.min(idlePool.length, slots === Infinity ? idlePool.length : slots));

    const built = this.buildBatchProblem(round, idlePool);
    const result = await solveAssignmentOnBackend(built.problem, engine, options);

    const report: QuantumBatchReport = {
      engine: 'qpu',
      representation: 'qpu',
      chunks: 1,
      assigned: 0,
      assignments: [],
      validMass: 1 - result.invalidSamples / Math.max(1, result.totalReads),
      meanProbability: result.sampleFrequency,
      entanglementCouplings: built.couplingCount,
      solutions: [{
        taskIds: round.map(t => t.id),
        welfare: result.welfare,
        probability: result.sampleFrequency,
        validMass: 1 - result.invalidSamples / Math.max(1, result.totalReads),
        layers: result.totalReads,
        evaluations: 1
      }]
    };
    if (result.optimality) {
      report.optimality = result.optimality;
    }

    for (let t = 0; t < round.length; t++) {
      const task = round[t];
      const agentIndex = result.assignment[t];
      if (agentIndex == null || agentIndex < 0) continue;
      const agent = idlePool[agentIndex];
      if (agent.state !== 'idle') continue;

      const decision: SchedulingDecision = {
        taskId: task.id,
        agentId: agent.id,
        probability: result.sampleFrequency, // 采样频率 = 量子分布的频率估计
        confidence: report.validMass,
        reasoning: `${engine.name}${engine.realHardware ? ' (real QPU)' : ''}: solver=${result.solver}, ` +
          `${result.totalReads} reads, sample frequency=${(result.sampleFrequency * 100).toFixed(2)}%` +
          (result.optimality ? `, optimality=${(result.optimality.ratio * 100).toFixed(1)}%` : ''),
        alternatives: []
      };
      this.applyAssignmentDecision(task, decision);
      report.assigned++;
      report.assignments.push({
        taskId: task.id,
        taskName: task.name,
        agentId: agent.id,
        probability: result.sampleFrequency
      });
      this.quantumProbabilitySum += result.sampleFrequency;
    }

    this.quantumBatchRuns++;
    this.quantumBatchAssigned += report.assigned;
    if (report.optimality) {
      this.lastOptimalityRatio = report.optimality.ratio;
    }

    logInfo('QuantumScheduler',
      `Quantum batch on ${engine.name}${engine.realHardware ? ' [REAL QPU]' : ' [local exact]'}: ` +
      `${report.assigned} tasks, solver=${result.solver}, ` +
      `invalidSamples=${result.invalidSamples}/${result.totalReads}` +
      (report.optimality ? `, optimality=${(report.optimality.ratio * 100).toFixed(1)}%` : ''));
    return report;
  }

  /** 量子引擎运行统计 */
  getQuantumMetrics(): {
    algorithm: QuantumAlgorithm;
    singleDecisions: number;
    batchRuns: number;
    batchAssigned: number;
    meanProbability: number | null;
    lastOptimalityRatio: number | null;
  } {
    const total = this.quantumSingleDecisions + this.quantumBatchAssigned;
    return {
      algorithm: this.config?.scheduling?.quantumAlgorithm ?? 'hybrid',
      singleDecisions: this.quantumSingleDecisions,
      batchRuns: this.quantumBatchRuns,
      batchAssigned: this.quantumBatchAssigned,
      meanProbability: total > 0 ? this.quantumProbabilitySum / total : null,
      lastOptimalityRatio: this.lastOptimalityRatio
    };
  }

  private calculateCapabilityScore(agent: Agent, task: Task): number {
    let score = 0;
    let totalWeight = 0;

    task.requirements.forEach(req => {
      if (req.type === 'capability') {
        const hasCapability = agent.capabilities.includes(req.name);
        if (hasCapability) {
          score += req.weight;
        }
        totalWeight += req.weight;
      }
    });

    return totalWeight > 0 ? score / totalWeight : 0;
  }

  private checkCapabilityMatch(agent: Agent, task: Task): boolean {
    return task.requirements.every(req => {
      if (req.type === 'capability') {
        return agent.capabilities.includes(req.name);
      }
      return true;
    });
  }

  private assignTaskToAgent(taskId: string, agentId: string): void {
    const task = this.tasks.get(taskId);
    const agent = this.agents.get(agentId);

    if (task && agent) {
      // 仅对真正入过挂起桶的任务回退计数（提交即分配的任务不涉及）
      if (this.pendingTracked.delete(taskId)) {
        this.pendingCount--;
      }
      task.assignedAgentId = agentId;
      task.assignedAt = new Date();
      task.status = 'assigned';
      task.updatedAt = new Date();
      agent.state = 'working';
      agent.load = Math.min(agent.load + 1, 100);
      if (agent.load > 80) {
        agent.state = 'overloaded';
      }
      this.activeAssignments++;
      // 首次分配后启动周期巡检（超时回收+保留清理）
      this.ensureSweepTimer();

      // 更新agent调度统计（供O(1)相关性计算）
      const stats = this.agentStats.get(agentId);
      if (stats) {
        stats.total++;
        stats.byType.set(task.type, (stats.byType.get(task.type) || 0) + 1);
      }

      this.tasks.set(taskId, task);
      this.agents.set(agentId, agent);

      this.emit('task_assigned', { taskId, agentId });
    }
  }

  // 统计和监控（全部计数器化，无全表扫描）
  getSystemMetrics(): SchedulerSystemMetrics {
    const totalAgents = this.agents.size;
    let activeAgents = 0;
    for (const agent of this.agents.values()) {
      if (agent.state === 'working') activeAgents++;
    }

    return {
      totalAgents,
      activeAgents,
      totalTasks: this.tasks.size,
      completedTasks: this.completedCount,
      failedTasks: this.failedCount,
      pendingTasks: this.pendingCount,
      systemLoad: totalAgents > 0 ? activeAgents / totalAgents : 0,
      quantumEfficiency: this.totalDecisions > 0
        ? this.completedAssignments / this.totalDecisions
        : 0,
      schedulingHistoryLength: this.totalDecisions
    };
  }

  // 获取当前状态
  getAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  getTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  getSchedulingHistory(): SchedulingDecision[] {
    return this.schedulingHistory;
  }
}
