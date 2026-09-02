import { Agent, Task, SchedulingDecision, QuantumState, TaskPriority, TaskStatus } from '../types/quantum-types';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { logDebug, logInfo } from '../utils/logger';

const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
};

// 分桶遍历顺序即调度优先顺序
const PRIORITY_ORDER: TaskPriority[] = ['critical', 'high', 'medium', 'low'];

const DEFAULT_MAX_HISTORY = 10000;

interface AgentScheduleStats {
  total: number;
  byType: Map<string, number>;
}

export class QuantumScheduler extends EventEmitter {
  private agents: Map<string, Agent> = new Map();
  private tasks: Map<string, Task> = new Map();
  private quantumState: Map<string, QuantumState> = new Map();
  private schedulingHistory: SchedulingDecision[] = [];
  private config: any;

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

  constructor(config: any) {
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
    this.reschedulePendingTasks();
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

    // 立即尝试调度
    this.scheduleTask(fullTask.id);

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
  completeTask(taskId: string, success: boolean = true, result?: any): boolean {
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
      (task as any).result = result;
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

    // 释放出的容量立即用于挂起任务
    this.reschedulePendingTasks();
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
    (this.sweepTimer as any).unref?.();
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
  getSystemMetrics(): any {
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
