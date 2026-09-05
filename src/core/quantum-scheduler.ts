import type {
  Agent,
  Task,
  SchedulingDecision,
  QuantumState,
  TaskPriority,
  TaskStatus,
} from '../types/quantum-types.js';
import { EventEmitter } from 'events';
import { randomUUID } from 'node:crypto';
import { logDebug, logInfo, logWarn } from '../utils/logger.js';
import { SchedulingError } from '../utils/errors.js';
import { Mulberry32, DEFAULT_SEED } from '../utils/rng.js';
import {
  BRUTE_FORCE_QUBIT_LIMIT,
  FULLSPACE_QUBIT_LIMIT,
  SCHEDULER_QUBIT_CAP,
  SCHEDULER_SUBSPACE_CAP,
  SUBSPACE_QAOA_DIMENSION_LIMIT,
} from './constants.js';
import { AGENT_OVERLOAD_THRESHOLD } from './agent-manager.js';
import {
  assertLegalTaskTransition,
  isLegalTaskTransition,
  checkTaskInvariants,
  taskInvariantAssertionsEnabled,
  type InvariantViolation,
} from './task-lifecycle.js';
import type { AssignmentProblem, QuantumSolverOptions, CollapseMode } from './quantum-optimizer.js';
import {
  qaoaSolve,
  annealSolve,
  bruteForceOptimum,
  defaultPenalties,
  couplingKey,
  isValidAssignment,
} from './quantum-optimizer.js';
import {
  buildSubspaceModel,
  qaoaSolveSubspace,
  annealSolveSubspace,
} from './subspace-optimizer.js';
import type { QuantumBackend } from './qpu/quantum-backend.js';
import { getBackend } from './qpu/quantum-backend.js';
import { solveAssignmentOnBackend } from './qpu/solve.js';

const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

// 分桶遍历顺序即调度优先顺序
const PRIORITY_ORDER: TaskPriority[] = ['critical', 'high', 'medium', 'low'];

const DEFAULT_MAX_HISTORY = 10000;

/**
 * 波函数调度的评分权重（单任务决策 / 批量打分两套口径）。
 * 此前两处以字面量散落（且顺序不同），改权重时必须两处同改——集中于此。
 */
const SINGLE_TASK_WEIGHTS = {
  distance: 0.3,
  capability: 0.4,
  load: 0.2,
  correlation: 0.1,
} as const;
const BATCH_SCORE_WEIGHTS = {
  capability: 0.4,
  load: 0.2,
  correlation: 0.1,
  distance: 0.3,
} as const;

/** loadScore = 1/(load + ε) 的分母平滑项：避免零负载agent的除零爆炸 */
const LOAD_EPSILON = 0.1;
/** 决策置信度 = min(2×最优分, 1)：最优分过半即满置信 */
const CONFIDENCE_GAIN = 2;
/** 决策附带的次优候选数 */
const ALTERNATIVES_COUNT = 2;

/**
 * 量子距离得分：越近越高（归一化到 (0,1]）。
 * 单任务与批量两条打分路径共用——此前单任务路径直接用原始距离，
 * 与批量路径方向相反（同权重下选出不同agent），语义错误。
 */
function distanceScoreOf(distance: number): number {
  return 1 / (1 + distance);
}

/** 评分四要素（能力/负载/相关性/距离）——单任务决策与批量打分共用同一组件计算 */
interface AffinityComponents {
  capabilityScore: number;
  loadScore: number;
  correlationScore: number;
  /** 原始欧氏距离（评分统一经 distanceScoreOf 归一） */
  distance: number;
}

/** 量子调度算法：hybrid 为经典启发式热路径；quantum-* 为真实量子算法（态矢量模拟） */
export type QuantumAlgorithm =
  'hybrid' | 'wave-function' | 'probability' | 'quantum-qaoa' | 'quantum-annealing';

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
  /**
   * CVaR-QAOA 分位系数 α ∈ (0,1]（默认 1 = 经典均值目标）。α<1 时
   * QAOA 路径的角度优化以最优 α 分位能量期望为变分目标
   * （Barkoutsos et al. 2020），低层数下命中率实证更优
   */
  cvarAlpha?: number;
  /**
   * QAOA 角度参数化（默认 'layer'）。'multi' = ma-QAOA：每个混合算子
   * 独立变分角（Chandarana et al. 2020），以 layer 最优为种子 ⇒
   * 构造性保证不劣于 layer 模式
   */
  angleMode?: 'layer' | 'multi';
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
    /**
     * 挂起任务 TTL（毫秒，默认关闭）。超时未获得调度的 pending 任务
     * 以 { reason: 'pending_timeout' } 失败并级联下游——不可满足任务
     * （能力无人具备、依赖链断裂）不再永久驻留内存与指标。默认关闭
     * 以保留长依赖链的合法等待语义；配置即启用。
     */
    pendingTimeoutMs?: number;
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
  /** 取消终态任务数（与 failedTasks 分列——取消≠失败） */
  cancelledTasks: number;
  pendingTasks: number;
  systemLoad: number;
  quantumEfficiency: number;
  schedulingHistoryLength: number;
}

export class QuantumScheduler extends EventEmitter {
  private agents = new Map<string, Agent>();
  private tasks = new Map<string, Task>();
  private quantumState = new Map<string, QuantumState>();
  private schedulingHistory: SchedulingDecision[] = [];
  private config: QuantumSchedulerConfig;
  // 量子态的随机性也走种子化 PRNG：给定 seed 的调度行为完全可复现
  private rngSource: Mulberry32 = new Mulberry32(DEFAULT_SEED);

  // 性能索引：能力 → 具备该能力的agentId集合（候选集O(要求数)求交）
  private capabilityIndex = new Map<string, Set<string>>();
  // 性能索引：挂起任务按优先级分桶，免除每次重调度的全量排序
  private pendingBuckets = new Map<TaskPriority, string[]>();
  /**
   * 性能索引：依赖 → 其直接下游任务集合。级联失败曾对每次失败做全量
   * 任务扫描（O(T)/次，批量失败 O(E·T)）。Set 按提交序遍历 == 原全表
   * 扫描筛选序，级联的 completeTask 调用序列不变（位级行为一致）。
   * 维护点：submitTask（建立）与 sweep 保留清理（随任务删除收缩）。
   */
  private dependents = new Map<string, Set<string>>();
  // 性能统计：替代每次决策过滤整个调度历史（O(1)量子相关性）
  private agentStats = new Map<string, AgentScheduleStats>();
  // 计数器：指标计算O(1)，不随任务总量增长
  private totalDecisions = 0;
  private completedAssignments = 0;
  private completedCount = 0;
  private failedCount = 0;
  /** 取消计数（01#15：取消≠失败，failedTasks 不得混入取消口径） */
  private cancelledCount = 0;
  private pendingCount = 0;
  // 已入桶追踪：保证pendingCount只在真正入过桶的任务上增减
  private pendingTracked = new Set<string>();
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
    this.rngSource = new Mulberry32(config.scheduling?.quantum?.seed ?? DEFAULT_SEED);
  }

  private get maxHistory(): number {
    return this.config.scheduling?.maxHistorySize ?? DEFAULT_MAX_HISTORY;
  }

  // Agent管理
  registerAgent(agent: Agent): void {
    // 重复 ID 拒绝（01#14）：静默覆盖会留下旧能力索引残留（新能力集
    // 不清理旧条目）与统计归零的半更新状态；本仓另两个调度器
    // （growth/batch-vcg）同场景均 throw——三调度器口径对齐
    if (this.agents.has(agent.id)) {
      throw new SchedulingError(`Agent already registered: ${agent.id}`);
    }
    this.agents.set(agent.id, agent);
    this.initializeQuantumState(agent);
    this.indexCapabilities(agent);
    this.agentStats.set(agent.id, { total: 0, byType: new Map() });
    this.emit('agent_registered', agent);
    logInfo('QuantumScheduler', `Agent registered: ${agent.name} (${agent.id})`);

    // 新agent加入后，尝试调度之前无agent可用的挂起任务
    if (this.config.scheduling?.autoSchedule !== false) {
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
    for (const depId of task.dependencies) {
      if (!this.tasks.has(depId)) {
        throw new SchedulingError(`Unknown dependency '${depId}' for task '${task.name}'`);
      }
    }
    // 需求契约诚实化（01#7）：类型层宣告了四类需求（capability/resource/
    // location/quantum），调度器只实现 capability——其余三类此前静默
    // 放行，等价于「要求 GPU 的任务被当作无约束调度」。实现不了的
    // 约束就该在入口拒绝：调用方把 resource/location/quantum 写进
    // requirements 是在表达硬约束，静默忽略比拒绝危险得多。
    for (const req of task.requirements) {
      if (req.type !== 'capability') {
        throw new SchedulingError(
          `Task '${task.name}' uses requirement type '${req.type}' ('${req.name}'), ` +
            `which this scheduler does not enforce — it would be silently ignored. ` +
            `Express hard constraints as 'capability' requirements or pre-filter candidates yourself.`,
        );
      }
    }
    // 依赖环检测（01#6）：环下任务永久 pending——巡检只回收
    // assigned/running 超时，pending 无出边，环一旦入表即泄漏。
    // 环的唯一现实注入通道是调用方持有 dependencies 数组引用事后
    // 突变（下方防御拷贝已闭）；本检查兜住未来的依赖变更 API/旁路。
    if (this.dependencyClosureHasCycle(task.dependencies)) {
      throw new SchedulingError(
        `Task '${task.name}' has a dependency cycle in [${task.dependencies.join(', ')}]`,
      );
    }

    const fullTask: Task = {
      ...task,
      // 依赖数组防御拷贝（规则所有权同款契约）：{...task} 只浅拷，
      // 调用方保留原数组引用——事后 push 反向边即注入 A↔B 环
      dependencies: [...task.dependencies],
      id: randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
      quantumState: this.generateQuantumState(),
    };

    this.tasks.set(fullTask.id, fullTask);
    for (const depId of fullTask.dependencies) {
      let ids = this.dependents.get(depId);
      if (!ids) {
        ids = new Set<string>();
        this.dependents.set(depId, ids);
      }
      ids.add(fullTask.id);
    }
    this.emit('task_submitted', fullTask);

    // 巡检定时器随首个任务就位（此前首个分配成功才启动：只提交从不
    // 分配的部署——挂起 TTL 与 assigned/running 超时都不会运行）
    this.ensureSweepTimer();

    // 立即尝试调度（批量模式下攒起来等联合量子调度）
    if (this.config.scheduling?.autoSchedule !== false) {
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

  /**
   * 状态机安全的任务状态更新：终结态（completed/failed/cancelled）走
   * completeTask 统一收尾（释放agent、级联、重调度）；中间态
   * （pending/assigned/running）只更新状态字段。此前任意非 completed
   * 入参都被静默当作失败收尾——updateTaskStatus(id, 'running') 实际
   * 会杀死任务（行为陷阱，已修复并由测试守护）。
   */
  updateTaskStatus(taskId: string, status: TaskStatus): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
    // 转移表裁决：非法请求（如对终态任务设置中间态）在断言模式下
    // 显式抛错，生产模式静默拒绝——状态写入不再各自判断
    if (!isLegalTaskTransition(task.status, status)) {
      assertLegalTaskTransition(task.status, status);
      logDebug(
        'QuantumScheduler',
        `updateTaskStatus refused: ${task.status} → ${status} is not a legal transition`,
      );
      return;
    }
    if (status === 'completed' || status === 'failed') {
      this.completeTask(taskId, status === 'completed');
      return;
    }
    if (status === 'cancelled') {
      this.completeTask(taskId, false, { reason: 'cancelled' });
      return;
    }
    task.status = status;
    task.updatedAt = new Date();
    this.tasks.set(taskId, task);
  }

  /** 取消收尾的判定：result 为 { reason: 'cancelled' } 载荷 */
  private static isCancellation(result: unknown): boolean {
    return (
      typeof result === 'object' &&
      result !== null &&
      (result as { reason?: unknown }).reason === 'cancelled'
    );
  }

  // 任务完成/失败：更新状态、释放agent、触发挂起任务重调度
  completeTask(taskId: string, success = true, result?: unknown): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    // 幂等守卫：终态任务不得二次收尾——重复调用会重复累计完成数、
    // 重复扣减 activeAssignments/agent.load（虚增空闲容量、突破并发上限）
    // 并重复发出终态事件（updateTaskStatus 与巡检超时可能竞争到达）
    if (task.status === 'completed' || task.status === 'failed') {
      logDebug('QuantumScheduler', `Task ${taskId} already ${task.status}, ignoring re-completion`);
      return false;
    }

    const wasPending = task.status === 'pending';
    const now = new Date();

    // 取消是与失败分列的终态（TaskStatus 联合本就含 'cancelled'）：
    // 此前取消走 failed 分支，failedTasks 里取消与失败不可区分
    const cancelled = !success && QuantumScheduler.isCancellation(result);
    const terminalStatus = success ? 'completed' : cancelled ? 'cancelled' : 'failed';
    // 终态写入经转移表断言（幂等守卫已排除重复收尾，此处防御
    // 未来新增调用点绕过守卫直达本函数的回归）
    assertLegalTaskTransition(task.status, terminalStatus);
    if (success) {
      task.status = 'completed';
      task.completedAt = now;
      this.completedCount++;
      // 仅统计真正经过调度决策并完成的任务
      if (task.assignedAgentId) this.completedAssignments++;
    } else if (cancelled) {
      task.status = 'cancelled';
      this.cancelledCount++;
    } else {
      task.status = 'failed';
      this.failedCount++;
    }
    if (wasPending && this.pendingTracked.delete(taskId)) {
      this.pendingCount--;
    }
    task.updatedAt = now;
    // 执行时长从分配时点起算（01#16）：从 createdAt 起算把排队等待
    // 计入执行时长，SLA/超时归因系统性偏大
    task.actualDuration = now.getTime() - (task.assignedAt ?? task.createdAt).getTime();
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
        // overloaded 必须与 working 同样参与释放重判，否则它是无出边的
        // 吸收态：load 归零仍停在 overloaded，agent 永久退出空闲候选池，
        // systemLoad 也随之失真（全员 overloaded 时显示零负载）。
        // 重判语义与 agent-manager 的 heartbeat 恢复一致：按当前 load 定态。
        if (agent.state === 'working' || agent.state === 'overloaded') {
          agent.state = agent.load > AGENT_OVERLOAD_THRESHOLD ? 'overloaded' : 'idle';
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

    logDebug(
      'QuantumScheduler',
      `Task ${success ? 'completed' : 'failed'}: ${task.name} (${taskId})`,
    );

    // 释放出的容量立即用于挂起任务（批量模式下留待联合调度）
    if (this.config.scheduling?.autoSchedule !== false) {
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

    // 状态守卫：仅 pending 任务可进入调度（与 reschedulePendingTasks 的
    // 惰性状态检查对齐）。缺守卫时外部重试是天然触发场景：
    // 对 completed 任务重调会改回 assigned、随后被超时巡检改判 failed
    // （已完成任务被静默改判）；对 assigned/running 重调会覆盖
    // assignedAgentId、旧 agent 负载不回减、activeAssignments 重复递增。
    if (task.status !== 'pending') {
      logDebug(
        'QuantumScheduler',
        `Task ${taskId} not pending (status=${task.status}), refusing to schedule`,
      );
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
    if (task.dependencies.length === 0) return true;
    return task.dependencies.every((depId) => {
      const dep = this.tasks.get(depId);
      return dep?.status === 'completed';
    });
  }

  /**
   * 新任务依赖闭包内是否已存在环（01#6 纵深防御）：从直接依赖出发
   * 沿 dependencies 做三色 DFS，灰-灰相遇即环。O(闭包内 V+E)。
   * 配合 submitTask 的依赖防御拷贝（切断调用方持有数组引用事后
   * 注入反向边的别名通道），依赖环在结构上不可达——本检查兜住
   * 未来新增的依赖变更 API 或反序列化入表等旁路。
   */
  private dependencyClosureHasCycle(roots: string[]): boolean {
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const hasCycleFrom = (taskId: string): boolean => {
      if (visited.has(taskId)) return false;
      if (visiting.has(taskId)) return true;
      visiting.add(taskId);
      const task = this.tasks.get(taskId);
      let cycle = false;
      if (task) {
        for (const depId of task.dependencies) {
          if (hasCycleFrom(depId)) {
            cycle = true;
            break;
          }
        }
      }
      visiting.delete(taskId);
      visited.add(taskId);
      return cycle;
    };
    return roots.some(hasCycleFrom);
  }

  // 级联失败：将依赖failedTaskId的未终结任务标记失败（递归向下传播）。
  // 终止性由 completeTask 的幂等守卫保证：每个任务恰好一次转入终态，
  // 环形依赖下重复到达的任务在守卫处早退，不会无限递归。
  // 经 dependents 反向索引取直接下游（O(度)，原为全量任务扫描）；
  // 状态过滤保持在读取时进行——任务的终结态转换发生在提交之后。
  private cascadeFailure(failedTaskId: string): void {
    const ids = this.dependents.get(failedTaskId);
    if (!ids) return;

    const dependents: string[] = [];
    for (const id of ids) {
      const t = this.tasks.get(id);
      if (t && (t.status === 'pending' || t.status === 'assigned' || t.status === 'running')) {
        dependents.push(id);
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
    const maxConcurrent = this.config.scheduling?.maxConcurrentTasks;
    if (maxConcurrent != null && this.activeAssignments >= maxConcurrent) {
      logDebug(
        'QuantumScheduler',
        `Concurrency limit reached (${maxConcurrent}), task ${task.id} deferred`,
      );
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
      if (agent?.state === 'idle') {
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
        if (task?.status !== 'pending') continue;

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
            const idx = idlePool.findIndex((a) => a.id === decision.agentId);
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

  // 周期巡检：分配超时回收 + 已终结任务保留清理
  private ensureSweepTimer(): void {
    if (this.sweepTimer) return;
    const interval = this.config.scheduling?.sweepInterval ?? 5000;
    this.sweepTimer = setInterval(() => {
      this.sweep();
    }, interval);
    // 不阻止进程退出
    this.sweepTimer.unref();
  }

  private sweep(): void {
    const now = Date.now();
    const timeout = this.config.scheduling?.taskTimeout ?? 30000;

    // 1) 超时回收：assigned/running超时的任务标记失败，释放agent并级联
    for (const task of this.tasks.values()) {
      if ((task.status === 'assigned' || task.status === 'running') && task.assignedAt) {
        if (now - task.assignedAt.getTime() > timeout) {
          this.completeTask(task.id, false, {
            reason: 'timeout',
            elapsedMs: now - task.assignedAt.getTime(),
          });
        }
      }
    }

    // 1b) 挂起 TTL（01#5，默认关闭）：超时未调度的 pending 任务失败
    // 出清（依赖下游级联），不可满足任务不再永久驻留。elapsed 从
    // createdAt 起算——pending 任务没有 assignedAt，驻留期即排队期。
    const pendingTimeoutMs = this.config.scheduling?.pendingTimeoutMs;
    if (pendingTimeoutMs !== undefined && pendingTimeoutMs > 0) {
      for (const task of this.tasks.values()) {
        if (task.status === 'pending' && now - task.createdAt.getTime() > pendingTimeoutMs) {
          this.completeTask(task.id, false, {
            reason: 'pending_timeout',
            elapsedMs: now - task.createdAt.getTime(),
          });
        }
      }
    }

    // 2) 保留清理：终结超过保留期的任务从内存移除（计数器指标保留历史总量）
    const retentionMs =
      this.config.performance?.retentionMs ??
      (this.config.performance?.retentionDays ?? 30) * 86400000;
    if (retentionMs > 0) {
      for (const [id, task] of this.tasks) {
        if (task.status === 'completed' || task.status === 'failed') {
          const endedAt = task.completedAt?.getTime() ?? task.updatedAt.getTime();
          if (now - endedAt > retentionMs) {
            this.tasks.delete(id);
            // 反向依赖索引同步收缩（该任务不可能再被级联到达：已终结）
            for (const depId of task.dependencies) {
              const ids = this.dependents.get(depId);
              if (ids) {
                ids.delete(id);
                if (ids.size === 0) this.dependents.delete(depId);
              }
            }
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
    const rng = this.rngSource.next.bind(this.rngSource);
    return {
      id: randomUUID(),
      amplitude: rng(),
      phase: rng() * 2 * Math.PI,
      collapsed: false,
      position: { x: rng(), y: rng(), z: rng() },
    };
  }

  private initializeQuantumState(agent: Agent): void {
    const quantumState = this.generateQuantumState();
    this.quantumState.set(agent.id, quantumState);
  }

  private makeQuantumDecision(task: Task, agents: Agent[]): SchedulingDecision {
    const algorithm = this.config.scheduling?.quantumAlgorithm ?? 'hybrid';
    if (algorithm === 'quantum-qaoa' || algorithm === 'quantum-annealing') {
      return this.makeTrueQuantumDecision(task, agents, algorithm);
    }
    // 量子波函数调度算法（亲和度求和序与批量路径共用同一实现——
    // 浮点加法不满足结合律，两套手写求和序在近平局处可有 ~1e-17 ULP
    // 分歧并选出不同 agent，属未声明的口径分歧）
    const scores = agents.map((agent) => ({
      agentId: agent.id,
      score: this.affinityScore(SINGLE_TASK_WEIGHTS, this.affinityComponents(agent, task)),
    }));

    scores.sort((a, b) => b.score - a.score);
    if (scores.length === 0) {
      throw new SchedulingError(`makeQuantumDecision: no eligible agent for task '${task.id}'`);
    }

    const bestScore = scores[0]!;
    const totalScoreSum = scores.reduce((sum, s) => sum + s.score, 0);

    return {
      taskId: task.id,
      agentId: bestScore.agentId,
      probability: bestScore.score / totalScoreSum,
      confidence: Math.min(bestScore.score * CONFIDENCE_GAIN, 1),
      reasoning: `Quantum distance optimization with capability matching`,
      alternatives: scores.slice(1, 1 + ALTERNATIVES_COUNT).map((s) => ({
        agentId: s.agentId,
        probability: s.score / totalScoreSum,
      })),
    };
  }

  /** 评分四要素组件（单任务决策与批量打分共用的唯一实现） */
  private affinityComponents(agent: Agent, task: Task): AffinityComponents {
    const agentQuantumState = this.quantumState.get(agent.id)!;
    const distance = this.calculateQuantumDistance(agentQuantumState, task.quantumState);
    return {
      capabilityScore: this.calculateCapabilityScore(agent, task),
      loadScore: 1 / (agent.load + LOAD_EPSILON),
      // O(1)相关性：直接读预置计数，不回扫历史
      correlationScore: (() => {
        const stats = this.agentStats.get(agent.id);
        return stats && stats.total > 0 ? (stats.byType.get(task.type) ?? 0) / stats.total : 0;
      })(),
      distance,
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
    return this.affinityScore(BATCH_SCORE_WEIGHTS, this.affinityComponents(agent, task));
  }

  /**
   * 亲和度加权和的唯一求值实现（01#10 收口）：固定求和序
   * capability → load → correlation → distance。此前单任务路径
   * distance-first、批量路径 capability-first 两套手写序并存。
   */
  private affinityScore(
    w: { capability: number; load: number; correlation: number; distance: number },
    c: AffinityComponents,
  ): number {
    return (
      w.capability * c.capabilityScore +
      w.load * c.loadScore +
      w.correlation * c.correlationScore +
      w.distance * distanceScoreOf(c.distance)
    );
  }

  private buildSolverOptions(): QuantumSolverOptions {
    const q = this.config.scheduling?.quantum ?? {};
    // exactOptionalPropertyTypes：未配置的旋钮以属性缺省表达，
    // 由求解器缺省解析填充（显式 undefined 不得进入可选属性）
    return {
      ...(q.layers !== undefined ? { layers: q.layers } : {}),
      ...(q.shots !== undefined ? { shots: q.shots } : {}),
      ...(q.select !== undefined ? { select: q.select } : {}),
      ...(q.seed !== undefined ? { seed: q.seed } : {}),
      ...(q.cvarAlpha !== undefined ? { cvarAlpha: q.cvarAlpha } : {}),
      ...(q.angleMode !== undefined ? { angleMode: q.angleMode } : {}),
      ...(q.anneal !== undefined ? { anneal: q.anneal } : {}),
    };
  }

  private makeTrueQuantumDecision(
    task: Task,
    agents: Agent[],
    algorithm: 'quantum-qaoa' | 'quantum-annealing',
  ): SchedulingDecision {
    // 单候选：平凡坍缩，无需演化
    if (agents.length === 1) {
      this.quantumSingleDecisions++;
      return {
        taskId: task.id,
        agentId: agents[0]!.id,
        probability: 1,
        confidence: 1,
        reasoning: 'trivial collapse: single candidate',
        alternatives: [],
      };
    }

    const priorityWeight = PRIORITY_WEIGHT[task.priority] / 4; // 0.25..1
    const problem: AssignmentProblem = {
      taskIds: [task.id],
      agentIds: agents.map((a) => a.id),
      weights: [agents.map((a) => priorityWeight * this.agentAffinity(a, task))],
      ineligible: [agents.map(() => false)],
      couplings: new Map(),
      penaltyOneHot: 0,
      penaltyCapacity: 0,
    };
    const penalties = defaultPenalties(problem);
    problem.penaltyOneHot = penalties.oneHot;
    problem.penaltyCapacity = penalties.capacity;

    const solution =
      algorithm === 'quantum-qaoa'
        ? qaoaSolve(problem, this.buildSolverOptions())
        : annealSolve(problem, this.buildSolverOptions());

    const agentIndex = solution.assignment[0] ?? -1;
    const degraded = agentIndex < 0 || !isValidAssignment(problem, solution.assignment);
    const chosen = agentIndex >= 0 ? agents[agentIndex]! : agents[0]!;
    this.quantumSingleDecisions++;
    // 退化回退（agents[0] 兜底）不得上报 Born 概率/置信度（01#8）：
    // 上报指标必须与实际决策同源——回退不是测量结果，把它计入
    // quantumProbabilitySum 会毒化概率口径
    if (!degraded) {
      this.quantumProbabilitySum += solution.probability;
    }

    return {
      taskId: task.id,
      agentId: chosen.id,
      probability: degraded ? 0 : solution.probability,
      confidence: degraded ? 0 : solution.validMass,
      reasoning: degraded
        ? `${solution.engine}: degenerate solve fell back to first candidate ` +
          `(reported metrics zeroed — decision is not a measurement)`
        : `${solution.engine}: superposition over ${agents.length} agents, ` +
          `evolution (${solution.layers} ${solution.engine === 'qaoa' ? 'layers' : 'steps'}), ` +
          `Born collapse p=${solution.probability.toFixed(3)}`,
      alternatives: solution.candidates.slice(1, 1 + ALTERNATIVES_COUNT).map((c) => ({
        agentId: agents[c.assignment[0] ?? -1]?.id ?? chosen.id,
        probability: c.probability,
      })),
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
      this.config.scheduling?.quantumAlgorithm === 'quantum-annealing'
        ? 'quantum-annealing'
        : 'quantum-qaoa';
    const engineKind = algorithm === 'quantum-qaoa' ? ('qaoa' as const) : ('annealing' as const);

    // 1) 收集可调度任务：显式ID或按优先级桶顺序的全部挂起任务
    let candidates: Task[];
    if (taskIds) {
      candidates = taskIds
        .map((id) => this.tasks.get(id))
        .filter((t): t is Task => !!t && t.status === 'pending' && this.dependenciesMet(t));
    } else {
      candidates = this.collectPendingCandidates();
    }

    // 2) 空闲agent池与并发余量
    const idlePool = this.getAgents().filter((a) => a.state === 'idle');
    const maxConcurrent = this.config.scheduling?.maxConcurrentTasks;
    const slots =
      maxConcurrent != null ? Math.max(0, maxConcurrent - this.activeAssignments) : Infinity;

    if (candidates.length === 0 || idlePool.length === 0 || slots === 0) {
      return {
        engine: engineKind,
        representation: 'fullspace',
        chunks: 0,
        assigned: 0,
        assignments: [],
        validMass: 0,
        meanProbability: 0,
        entanglementCouplings: 0,
        solutions: [],
      };
    }

    // 3) 能力过滤：无可匹配agent的任务出局
    const schedulable = candidates.filter((task) =>
      idlePool.some((agent) => this.checkCapabilityMatch(agent, task)),
    );

    // 4) 首选：约束子空间精确引擎（多轮）—— 每轮把至多 min(空闲数, 维度
    //    上限允许的任务数) 个任务联合编码进子空间精确求解。任务多于空闲
    //    agent（m > n）时自动分轮，联合窗口保持最大，不再退化到全空间小分块。
    //    可联合调度的批量远超全空间态矢量（例：8任务×10agent = 181万维
    //    子空间，等效全空间 2^80 维）。
    const subspaceCap = this.config.scheduling?.quantum?.subspaceCap ?? SCHEDULER_SUBSPACE_CAP;
    if (schedulable.length > 0 && idlePool.length >= 2) {
      const subspaceReport = this.runSubspaceRounds(
        schedulable,
        algorithm,
        subspaceCap,
        slots,
        maxConcurrent ?? null,
      );
      if (subspaceReport) return subspaceReport;
    }

    // 5) 回退：全空间态矢量分块路径（子空间超维或不定时使用）
    //    任务数×agent数 ≤ qubitCap（态矢量内存上限，钳制到引擎硬顶——
    //    超限配置应在配置期报错，而不是让引擎在调度中段抛出）
    const qubitCap = Math.min(
      this.config.scheduling?.quantum?.qubitCap ?? SCHEDULER_QUBIT_CAP,
      FULLSPACE_QUBIT_LIMIT,
    );
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
      solutions: [],
    };

    let achievedWelfare = 0;
    let optimalWelfare = 0;
    let optimalityKnown = true;

    for (const chunk of chunks) {
      if (this.activeAssignments >= slots && maxConcurrent != null) break;
      // 不变量兜底（01#3）：分块条件带 current.length > 0 前缀，
      // 单任务×大空闲池（子空间引擎超维回退到这里的典型场景）产出的
      // 单任务块仍可超 cap——引擎会在调度中段抛 QuantumEngineError。
      // 超限块跳过本轮并告警（任务留 pending 等下一轮），调度循环
      // 的契约是「不抛错的尽力而为」。
      if (chunk.length * idlePool.length > qubitCap) {
        logWarn(
          'QuantumScheduler',
          `Skipping batch chunk of ${chunk.length} task(s) over ${idlePool.length} idle agents: ` +
            `${chunk.length * idlePool.length} qubits exceeds qubitCap=${qubitCap}`,
        );
        continue;
      }
      const remainingSlots = maxConcurrent != null ? slots - this.activeAssignments : Infinity;

      const { problem, couplingCount, nqubits } = this.buildBatchProblem(chunk, idlePool);
      report.entanglementCouplings += couplingCount;

      const solverOptions = this.buildSolverOptions();
      const solution =
        algorithm === 'quantum-qaoa'
          ? qaoaSolve(problem, solverOptions)
          : annealSolve(problem, solverOptions);

      // 精确最优对照（问题规模允许时）：量子解 vs 穷举最优的诚实自检
      const brute = nqubits <= BRUTE_FORCE_QUBIT_LIMIT ? bruteForceOptimum(problem) : null;
      achievedWelfare += solution.welfare;
      if (brute) {
        optimalWelfare += brute.welfare;
      } else {
        optimalityKnown = false;
      }

      report.solutions.push({
        taskIds: chunk.map((t) => t.id),
        welfare: solution.welfare,
        probability: solution.probability,
        validMass: solution.validMass,
        layers: solution.layers,
        evaluations: solution.evaluations,
      });
      report.validMass += solution.validMass;

      // 6) 应用坍缩结果：仍受并发上限约束
      this.applyJointSolution(
        chunk,
        idlePool,
        solution.assignment,
        problem,
        {
          maxAssign: remainingSlots,
          probability: solution.probability,
          confidence: solution.validMass,
          reasoning: () =>
            `batch ${solution.engine}: joint superposition of ${chunk.length} tasks × ` +
            `${idlePool.length} agents${couplingCount > 0 ? `, ${couplingCount} entanglement couplings` : ''}, ` +
            `Born collapse p=${solution.probability.toFixed(3)}`,
        },
        report,
      );
    }

    if (report.solutions.length > 0) {
      report.validMass /= report.solutions.length;
      report.meanProbability =
        report.solutions.reduce((s, x) => s + x.probability, 0) / report.solutions.length;
    }
    if (optimalityKnown && optimalWelfare > 0) {
      report.optimality = {
        achieved: achievedWelfare,
        optimal: optimalWelfare,
        ratio: achievedWelfare / optimalWelfare,
      };
    }
    this.finalizeBatchReport(report);

    logInfo(
      'QuantumScheduler',
      `Quantum batch (${algorithm}/fullspace): ${report.assigned}/${candidates.length} tasks assigned ` +
        `in ${report.chunks} chunk(s), meanBornP=${report.meanProbability.toFixed(3)}` +
        (report.optimality ? `, optimality=${(report.optimality.ratio * 100).toFixed(1)}%` : ''),
    );
    return report;
  }

  /** 按优先级桶顺序收集依赖已满足的全部挂起任务（批量路径的公共候选语义） */
  private collectPendingCandidates(): Task[] {
    const candidates: Task[] = [];
    for (const priority of PRIORITY_ORDER) {
      for (const id of this.pendingBuckets.get(priority) ?? []) {
        const task = this.tasks.get(id);
        if (task?.status === 'pending' && this.dependenciesMet(task)) {
          candidates.push(task);
        }
      }
    }
    return candidates;
  }

  /**
   * 应用联合坍缩解的公共骨架：逐任务校验（并发余量/pending/资格/空闲）
   * → 构建决策 → 应用 → 记入报告。资格校验对子空间/QPU 路径是冗余的
   * 防御（其解构造上已合法），保留统一校验以挡住求解器实现缺陷。
   */
  private applyJointSolution(
    chunk: Task[],
    pool: Agent[],
    assignment: readonly number[],
    problem: AssignmentProblem,
    opts: {
      maxAssign: number;
      probability: number;
      confidence: number;
      reasoning: () => string;
    },
    report: QuantumBatchReport,
  ): void {
    for (let t = 0; t < chunk.length; t++) {
      if (report.assigned >= opts.maxAssign) break;
      const task = chunk[t];
      if (task?.status !== 'pending') continue; // 并发块内前序已占用
      const agentIndex = assignment[t];
      if (agentIndex == null || agentIndex < 0) continue;
      if (problem.ineligible[t]?.[agentIndex]) continue;
      const agent = pool[agentIndex];
      if (agent?.state !== 'idle') continue; // 同块内被占用

      this.applyAssignmentDecision(task, {
        taskId: task.id,
        agentId: agent.id,
        probability: opts.probability, // 联合分配的Born概率
        confidence: opts.confidence,
        reasoning: opts.reasoning(),
        alternatives: [],
      });
      report.assigned++;
      report.assignments.push({
        taskId: task.id,
        taskName: task.name,
        agentId: agent.id,
        probability: opts.probability,
      });
      this.quantumProbabilitySum += opts.probability;
    }
  }

  /** 批量路径的公共收尾：运行计数与最优率快照 */
  private finalizeBatchReport(report: QuantumBatchReport): void {
    this.quantumBatchRuns++;
    this.quantumBatchAssigned += report.assigned;
    if (report.optimality) {
      this.lastOptimalityRatio = report.optimality.ratio;
    }
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
    maxConcurrent: number | null,
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
      solutions: [],
    };

    let achieved = 0;
    let optimal = 0;
    let maxDim = 0;
    let maxQubits = 0;
    let pending = tasks.filter((t) => t.status === 'pending');
    let anyRound = false;

    while (pending.length > 0) {
      if (maxConcurrent != null && this.activeAssignments >= slots) break;
      const pool = this.getAgents().filter((a) => a.state === 'idle');
      if (pool.length < 1) break;

      // 本轮可行任务：当前空闲池中至少一个能力匹配的agent
      const feasible = pending.filter((t) => pool.some((a) => this.checkCapabilityMatch(a, t)));
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
      const useQaoa =
        algorithm === 'quantum-qaoa' && model.dimension <= SUBSPACE_QAOA_DIMENSION_LIMIT;
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
        taskIds: round.map((t) => t.id),
        welfare: solution.welfare,
        probability: solution.probability,
        validMass: 1,
        layers: solution.layers,
        evaluations: solution.evaluations,
      });
      anyRound = true;

      const assignedBefore = report.assigned;
      this.applyJointSolution(
        round,
        pool,
        solution.assignment,
        built.problem,
        {
          maxAssign: Infinity,
          probability: solution.probability,
          confidence: 1,
          reasoning: () =>
            `subspace ${solution.engine}: exact evolution over P(${pool.length},${round.length})` +
            `=${model.dimension} valid assignments (equiv. ${round.length * pool.length} qubits full space)` +
            `${built.couplingCount > 0 ? `, ${built.couplingCount} entanglement couplings` : ''}, ` +
            `Born collapse p=${solution.probability.toExponential(2)}`,
        },
        report,
      );
      if (report.assigned === assignedBefore) break; // 防御：无进展即退出

      pending = pending.filter((t) => t.status === 'pending');
    }

    if (!anyRound) return null;

    if (report.solutions.length > 0) {
      report.meanProbability =
        report.solutions.reduce((s, x) => s + x.probability, 0) / report.solutions.length;
    }
    if (optimal > 0) {
      report.optimality = { achieved, optimal, ratio: achieved / optimal };
    }
    report.subspace = { dimension: maxDim, equivalentQubits: maxQubits };

    this.finalizeBatchReport(report);

    logInfo(
      'QuantumScheduler',
      `Quantum batch (${report.engine}/subspace, ${report.chunks} round(s)): ` +
        `${report.assigned} tasks, maxDim=${maxDim} (equiv ${maxQubits} qubits)` +
        (report.optimality ? `, optimality=${(report.optimality.ratio * 100).toFixed(1)}%` : ''),
    );
    return report;
  }

  /**
   * 批量哈密顿量构建（子空间与全空间两条路径共用）：
   * 福利权重 = 优先级 × 亲和度；能力不符 → 不合格；
   * 纠缠agent对 → 二次耦合福利加成（物理意义上的哈密顿量耦合项）。
   */
  private buildBatchProblem(
    chunk: Task[],
    idlePool: Agent[],
  ): {
    problem: AssignmentProblem;
    couplingCount: number;
    nqubits: number;
  } {
    const entanglementBonus = this.config.scheduling?.quantum?.entanglementBonus ?? 0.15;
    const problem: AssignmentProblem = {
      taskIds: chunk.map((t) => t.id),
      agentIds: idlePool.map((a) => a.id),
      weights: [],
      ineligible: [],
      couplings: new Map(),
      penaltyOneHot: 0,
      penaltyCapacity: 0,
    };
    const nqubits = chunk.length * idlePool.length;

    // 福利权重：优先级 × 亲和度；能力不符 → 不合格
    for (const task of chunk) {
      const pw = PRIORITY_WEIGHT[task.priority] / 4;
      problem.weights.push(idlePool.map((agent) => pw * this.agentAffinity(agent, task)));
      problem.ineligible.push(idlePool.map((agent) => !this.checkCapabilityMatch(agent, task)));
    }

    // 纠缠耦合：任意两任务落在纠缠agent对上 → 福利加成（哈密顿量的物理耦合项）
    let couplingCount = 0;
    for (let t1 = 0; t1 < chunk.length; t1++) {
      for (let t2 = t1 + 1; t2 < chunk.length; t2++) {
        const pwMin =
          Math.min(PRIORITY_WEIGHT[chunk[t1]!.priority], PRIORITY_WEIGHT[chunk[t2]!.priority]) / 4;
        for (let a1 = 0; a1 < idlePool.length; a1++) {
          for (let a2 = 0; a2 < idlePool.length; a2++) {
            if (a1 === a2) continue;
            if (
              idlePool[a1]!.quantumEntanglement.includes(idlePool[a2]!.id) &&
              !problem.ineligible[t1]![a1]! &&
              !problem.ineligible[t2]![a2]!
            ) {
              problem.couplings.set(
                couplingKey(t1 * idlePool.length + a1, t2 * idlePool.length + a2, nqubits),
                entanglementBonus * pwMin,
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
    options: { numReads?: number; timeoutMs?: number } = {},
  ): Promise<QuantumBatchReport> {
    const engine = backend ?? getBackend();

    // 收集可调度任务（与 scheduleBatchQuantum 相同语义：优先级桶顺序）
    const candidates = this.collectPendingCandidates();
    const idlePool = this.getAgents().filter((a) => a.state === 'idle');
    const maxConcurrent = this.config.scheduling?.maxConcurrentTasks;
    const slots =
      maxConcurrent != null ? Math.max(0, maxConcurrent - this.activeAssignments) : Infinity;

    if (candidates.length === 0 || idlePool.length === 0 || slots === 0) {
      return {
        engine: 'qpu',
        representation: 'qpu',
        chunks: 0,
        assigned: 0,
        assignments: [],
        validMass: 0,
        meanProbability: 0,
        entanglementCouplings: 0,
        solutions: [],
      };
    }

    const feasible = candidates.filter((task) =>
      idlePool.some((agent) => this.checkCapabilityMatch(agent, task)),
    );
    // 真 QPU 不受本地态矢量内存限制（Ising 变量数即规模），一轮吃满空闲池
    const round = feasible.slice(
      0,
      Math.min(idlePool.length, slots === Infinity ? idlePool.length : slots),
    );

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
      solutions: [
        {
          taskIds: round.map((t) => t.id),
          welfare: result.welfare,
          probability: result.sampleFrequency,
          validMass: 1 - result.invalidSamples / Math.max(1, result.totalReads),
          // layers 语义是电路层数 p；QPU 采样路径无层数概念，恒 0
          // （读取次数见 reasoning 与 totalReads——此前把 totalReads
          // 塞进 layers 是字段挪用）
          layers: 0,
          evaluations: 1,
        },
      ],
    };
    if (result.optimality) {
      report.optimality = result.optimality;
    }

    this.applyJointSolution(
      round,
      idlePool,
      result.assignment,
      built.problem,
      {
        maxAssign: Infinity,
        probability: result.sampleFrequency, // 采样频率 = 量子分布的频率估计
        confidence: report.validMass,
        reasoning: () =>
          `${engine.name}${engine.realHardware ? ' (real QPU)' : ''}: solver=${result.solver}, ` +
          `${result.totalReads} reads, sample frequency=${(result.sampleFrequency * 100).toFixed(2)}%` +
          (result.optimality ? `, optimality=${(result.optimality.ratio * 100).toFixed(1)}%` : ''),
      },
      report,
    );

    this.finalizeBatchReport(report);

    logInfo(
      'QuantumScheduler',
      `Quantum batch on ${engine.name}${engine.realHardware ? ' [REAL QPU]' : ' [local exact]'}: ` +
        `${report.assigned} tasks, solver=${result.solver}, ` +
        `invalidSamples=${result.invalidSamples}/${result.totalReads}` +
        (report.optimality ? `, optimality=${(report.optimality.ratio * 100).toFixed(1)}%` : ''),
    );
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
      algorithm: this.config.scheduling?.quantumAlgorithm ?? 'hybrid',
      singleDecisions: this.quantumSingleDecisions,
      batchRuns: this.quantumBatchRuns,
      batchAssigned: this.quantumBatchAssigned,
      meanProbability: total > 0 ? this.quantumProbabilitySum / total : null,
      lastOptimalityRatio: this.lastOptimalityRatio,
    };
  }

  private calculateCapabilityScore(agent: Agent, task: Task): number {
    let score = 0;
    let totalWeight = 0;

    task.requirements.forEach((req) => {
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
    return task.requirements.every((req) => {
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
      // 状态守卫（转移表裁决）：调度入口的公共 API 守卫不豁免内部
      // 路径——批量联合调度同样不得把非 pending 任务推入 assigned。
      // pending → assigned 是唯一合法入边。
      if (!isLegalTaskTransition(task.status, 'assigned')) {
        assertLegalTaskTransition(task.status, 'assigned');
        logDebug(
          'QuantumScheduler',
          `assignTaskToAgent refused: ${task.status} → assigned is not a legal transition`,
        );
        return;
      }
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
      if (agent.load > AGENT_OVERLOAD_THRESHOLD) {
        agent.state = 'overloaded';
      }
      this.activeAssignments++;
      // 首次分配后启动周期巡检（超时回收+保留清理）
      this.ensureSweepTimer();

      // 更新agent调度统计（供O(1)相关性计算）
      const stats = this.agentStats.get(agentId);
      if (stats) {
        stats.total++;
        stats.byType.set(task.type, (stats.byType.get(task.type) ?? 0) + 1);
      }

      this.tasks.set(taskId, task);
      this.agents.set(agentId, agent);

      this.emit('task_assigned', { taskId, agentId });
    }
  }

  /**
   * 调试模式不变量校验（Wave 2.1 验收标准①的机制化）：
   * 对比计数器口径与全表扫描派生真值，返回违例列表（空 = 通过）。
   * QUANTUM_ASSERT_INVARIANTS=1 时由 CI 在全套件运行后调用；
   * 生产默认不跑（全表扫描成本与热路径预算冲突）。
   */
  checkInvariants(): InvariantViolation[] {
    let tasksInFlight = 0;
    let bucketEntries = 0;
    for (const bucket of this.pendingBuckets.values()) bucketEntries += bucket.length;
    for (const task of this.tasks.values()) {
      if (task.status === 'assigned' || task.status === 'running') tasksInFlight++;
    }
    return checkTaskInvariants(this.tasks.values(), {
      activeAssignments: this.activeAssignments,
      tasksInFlight,
      pendingCount: this.pendingCount,
      pendingTrackedSize: this.pendingTracked.size,
      pendingBucketEntries: bucketEntries,
    });
  }

  /** 不变量断言是否开启（CI 回归开关的查询接口） */
  static invariantAssertionsEnabled(): boolean {
    return taskInvariantAssertionsEnabled();
  }

  // 统计和监控（全部计数器化，无全表扫描）
  getSystemMetrics(): SchedulerSystemMetrics {
    const totalAgents = this.agents.size;
    let activeAgents = 0;
    for (const agent of this.agents.values()) {
      // overloaded 同为在役状态：只统计 working 会在全员过载时
      // 报告零负载，监控口径与实际饱和相反
      if (agent.state === 'working' || agent.state === 'overloaded') activeAgents++;
    }

    return {
      totalAgents,
      activeAgents,
      totalTasks: this.tasks.size,
      completedTasks: this.completedCount,
      failedTasks: this.failedCount,
      cancelledTasks: this.cancelledCount,
      pendingTasks: this.pendingCount,
      systemLoad: totalAgents > 0 ? activeAgents / totalAgents : 0,
      quantumEfficiency:
        this.totalDecisions > 0 ? this.completedAssignments / this.totalDecisions : 0,
      schedulingHistoryLength: this.totalDecisions,
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
    // 防御性拷贝：外部 push/splice 会破坏长度封顶不变量并使
    // totalDecisions 与实际历史长度脱钩
    return this.schedulingHistory.slice();
  }
}
