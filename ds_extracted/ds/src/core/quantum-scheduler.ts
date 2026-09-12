/**
 * quantum-scheduler —— 量子多agent调度器（01#24 拆分后的门面 + 注册表）。
 *
 * 本类此前是 ~2000 行的 god class，职责已按 01#24 拆分为三个协作对象：
 * - TaskLifecycleManager（task-lifecycle-manager.ts）：任务表、挂起桶、
 *   依赖反向索引、状态计数器、终态/转移应用、巡检簿记与不变量校验；
 * - QuantumEngineOrchestrator（engine-orchestrator.ts）：单任务真量子决策
 *   与批量联合量子调度（子空间精确/全空间态矢量/QPU 后端 + 异步孪生）；
 * - 本类：agent/纠缠注册表、能力匹配与亲和度评分、巡检定时器接线、
 *   公共门面（纯委托——公共 API、事件名、错误消息、日志行、种子化
 *   随机数抽取序保持不变；可观测行为除三处**同波次行为修复**外不变：
 *   01#14 unregisterAgent 清扫其余agent的悬挂纠缠引用（本文件），
 *   01#4 QPU await 窗口后按实时并发余量封顶套用（engine-orchestrator），
 *   01#5 挂起任务缺省 TTL 600s（task-lifecycle-manager）——三项各有
 *   回归测试钉死，逐方法对拍见 R11 漂移审计）。
 */

import type {
  Agent,
  Task,
  SchedulingDecision,
  QuantumState,
  TaskStatus,
} from '../types/quantum-types.js';
import { EventEmitter } from 'events';
import { randomUUID } from 'node:crypto';
import { logDebug, logInfo } from '../utils/logger.js';
import { SchedulingError } from '../utils/errors.js';
import { Mulberry32, DEFAULT_SEED } from '../utils/rng.js';
import type { CollapseMode } from './quantum-optimizer.js';
import { taskInvariantAssertionsEnabled, type InvariantViolation } from './task-lifecycle.js';
// 01#24：生命周期与引擎编排拆入协作模块；本类保留注册表/亲和度/门面
import { TaskLifecycleManager, PRIORITY_ORDER } from './task-lifecycle-manager.js';
import { QuantumEngineOrchestrator, ALTERNATIVES_COUNT } from './engine-orchestrator.js';
import type { QuantumBackend } from './qpu/quantum-backend.js';
import type { ExecutionTierRouting } from './qpu/execution-tier.js';

// 01#24：挂起 TTL 缺省随 sweep 簿记迁入 task-lifecycle-manager.ts；
// 此处原位 re-export 维持 quantum-scheduler.js 的既有导入路径不变。
export { DEFAULT_PENDING_TIMEOUT_MS } from './task-lifecycle-manager.js';

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

/** agent 调度统计（O(1) 量子相关性计数；01#24 起由生命周期管理器共构写入） */
export interface AgentScheduleStats {
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
     * 挂起任务 TTL（毫秒）。超时未获得调度的 pending 任务以
     * { reason: 'pending_timeout' } 失败并级联下游——不可满足任务
     * （能力无人具备、依赖链断裂）不再永久驻留内存与指标。
     * 未配置时取 DEFAULT_PENDING_TIMEOUT_MS（10 分钟，01#5 收尾：
     * 此前缺省关闭）；显式 0 关闭（长依赖链的合法等待语义）。
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

/**
 * 量子多Agent调度器：单任务波函数/量子算法决策 + 批量联合量子调度
 * （全空间/约束子空间/QPU 三种演化载体）。任务生命周期由转移表守卫，
 * 巡检定时器负责超时回收与保留清理（shutdown() 释放）。
 * （01#24：生命周期簿记与量子引擎编排分别拆入 TaskLifecycleManager 与
 * QuantumEngineOrchestrator，本类保留注册表/亲和度/定时器接线与门面）
 */
export class QuantumScheduler extends EventEmitter {
  private agents = new Map<string, Agent>();
  private quantumState = new Map<string, QuantumState>();
  private schedulingHistory: SchedulingDecision[] = [];
  private config: QuantumSchedulerConfig;
  // 量子态的随机性也走种子化 PRNG：给定 seed 的调度行为完全可复现
  private rngSource: Mulberry32 = new Mulberry32(DEFAULT_SEED);

  // 性能索引：能力 → 具备该能力的agentId集合（候选集O(要求数)求交）
  private capabilityIndex = new Map<string, Set<string>>();
  // 性能统计：替代每次决策过滤整个调度历史（O(1)量子相关性）
  private agentStats = new Map<string, AgentScheduleStats>();
  // 计数器：指标计算O(1)，不随任务总量增长
  private totalDecisions = 0;
  // 周期巡检：超时回收 + 已终结任务保留清理
  private sweepTimer: NodeJS.Timeout | null = null;
  // 01#24 拆分的协作对象（构造注入 ctx 回调，双向纯委托）
  private readonly lifecycle: TaskLifecycleManager;
  private readonly engine: QuantumEngineOrchestrator;

  constructor(config: QuantumSchedulerConfig) {
    super();
    this.config = config;
    this.rngSource = new Mulberry32(config.scheduling?.quantum?.seed ?? DEFAULT_SEED);
    this.lifecycle = new TaskLifecycleManager({
      config: this.config,
      agents: this.agents,
      agentStats: this.agentStats,
      events: this,
      generateQuantumState: () => this.generateQuantumState(),
      scheduleTask: (taskId) => this.scheduleTask(taskId),
      reschedulePendingTasks: () => this.reschedulePendingTasks(),
    });
    this.engine = new QuantumEngineOrchestrator({
      config: this.config,
      getAgents: () => this.getAgents(),
      getTask: (taskId) => this.lifecycle.taskMap.get(taskId),
      activeAssignments: () => this.lifecycle.activeAssignmentCount,
      dependenciesMet: (task) => this.lifecycle.dependenciesMet(task),
      collectPendingCandidates: () => this.lifecycle.collectPendingCandidates(),
      checkCapabilityMatch: (agent, task) => this.checkCapabilityMatch(agent, task),
      agentAffinity: (agent, task) => this.agentAffinity(agent, task),
      applyAssignmentDecision: (task, decision) => this.applyAssignmentDecision(task, decision),
    });
    // 巡检定时器随构造启动（审计 A1#3）：此前随首个任务/首次分配才启动，
    // 「只提交从不分配」「只注册 agent」的部署里挂起 TTL 与 assigned/
    // running 超时都不会运行。构造即启动把巡检与调用路径彻底解耦；
    // unref() 保证空转巡检不阻止进程退出。
    this.ensureSweepTimer();
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
      // 01#14 收尾：清扫其余 agent 纠缠数组中的悬挂引用——被注销 id 若
      // 残留在对端数组里，后续同 id 重注册会静默复活早已不存在的耦合
      // （buildBatchProblem 直接读这些数组构建哈密顿量耦合项）。
      for (const other of this.agents.values()) {
        if (other.quantumEntanglement.includes(agentId)) {
          other.quantumEntanglement = other.quantumEntanglement.filter((id) => id !== agentId);
        }
      }
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

  // Task管理（01#24：簿记委托 TaskLifecycleManager，门面签名不变）
  submitTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'quantumState'>): Task {
    return this.lifecycle.submitTask(task);
  }

  /**
   * 状态机安全的任务状态更新：终结态（completed/failed/cancelled）走
   * completeTask 统一收尾（释放agent、级联、重调度）；中间态
   * （pending/assigned/running）只更新状态字段。此前任意非 completed
   * 入参都被静默当作失败收尾——updateTaskStatus(id, 'running') 实际
   * 会杀死任务（行为陷阱，已修复并由测试守护）。
   */
  updateTaskStatus(taskId: string, status: TaskStatus): void {
    this.lifecycle.updateTaskStatus(taskId, status);
  }

  // 任务完成/失败：更新状态、释放agent、触发挂起任务重调度
  completeTask(taskId: string, success = true, result?: unknown): boolean {
    return this.lifecycle.completeTask(taskId, success, result);
  }

  // 量子调度算法
  scheduleTask(taskId: string): SchedulingDecision | null {
    const task = this.lifecycle.taskMap.get(taskId);
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
    if (!this.lifecycle.dependenciesMet(task)) {
      logDebug('QuantumScheduler', `Task ${taskId} waiting for dependencies`);
      return null;
    }

    const decision = this.tryAssign(task, this.resolveCandidates(task));

    if (!decision) {
      logDebug('QuantumScheduler', `No available agents for task: ${taskId}`);
    }

    return decision;
  }

  // 对给定候选集做量子决策并完成分配（供直接调度与重调度共用）
  private tryAssign(task: Task, candidates: Agent[]): SchedulingDecision | null {
    if (candidates.length === 0) return null;

    // 并发上限背压：占满后任务留待后续释放
    const maxConcurrent = this.config.scheduling?.maxConcurrentTasks;
    if (maxConcurrent != null && this.lifecycle.activeAssignmentCount >= maxConcurrent) {
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
    this.lifecycle.assignTaskToAgent(task.id, decision.agentId);
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
  // （01#24：任务表与挂起桶归 TaskLifecycleManager，经只读视图与
  // 桶操作方法读写——遍历序与重建语义不变）
  reschedulePendingTasks(): number {
    // 空闲池快照
    const idlePool: Agent[] = [];
    for (const agent of this.agents.values()) {
      if (agent.state === 'idle') idlePool.push(agent);
    }
    if (idlePool.length === 0) return 0;

    let scheduledCount = 0;

    for (const priority of PRIORITY_ORDER) {
      const bucket = this.lifecycle.getPendingBucket(priority);
      if (!bucket || bucket.length === 0) continue;

      const remaining: string[] = [];

      for (const taskId of bucket) {
        if (idlePool.length === 0) {
          // 空闲池已尽：剩余任务原样留桶，不再逐个尝试
          remaining.push(taskId);
          continue;
        }

        const task = this.lifecycle.taskMap.get(taskId);
        // 惰性清理：已分配/完成/取消的条目直接出桶
        if (task?.status !== 'pending') continue;

        // 依赖未就绪的任务留桶，避免无效的候选匹配
        if (!this.lifecycle.dependenciesMet(task)) {
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
        this.lifecycle.deletePendingBucket(priority);
      } else {
        this.lifecycle.setPendingBucket(priority, remaining);
      }
    }

    return scheduledCount;
  }

  // 周期巡检：分配/挂起超时回收 + 已终结任务保留清理。
  // 构造函数即启动（幂等：已存在时早退）——巡检不依赖任何任务提交或
  // 分配成功的调用路径（01#24：簿记本体在 TaskLifecycleManager.sweep）
  private ensureSweepTimer(): void {
    if (this.sweepTimer) return;
    const interval = this.config.scheduling?.sweepInterval ?? 5000;
    this.sweepTimer = setInterval(() => {
      this.lifecycle.sweep();
    }, interval);
    // 不阻止进程退出
    this.sweepTimer.unref();
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
      // 01#24：真量子单任务决策与引擎统计迁入 QuantumEngineOrchestrator
      return this.engine.makeTrueQuantumDecision(task, agents, algorithm);
    }
    // 量子波函数调度算法（亲和度求和序与批量路径共用同一实现——
    // 浮点加法不满足结合律，两套手写求和序在近平局处可有 ~1e-17 ULP
    // 分歧并选出不同 agent，属未声明的口径分歧）
    const scores = agents.map((agent) => ({
      agentId: agent.id,
      score: this.affinityScore(SINGLE_TASK_WEIGHTS, this.affinityComponents(agent, task)),
    }));

    if (scores.length === 0) {
      throw new SchedulingError(`makeQuantumDecision: no eligible agent for task '${task.id}'`);
    }
    scores.sort((a, b) => b.score - a.score);

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
  // （01#24：求解与统计本体在 QuantumEngineOrchestrator，亲和度由本类供给）

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

  /**
   * 批量联合量子调度（量子态调度的完整形态）：
   * 把一批挂起任务与空闲agent的**联合分配问题**编码为哈密顿量——
   * 所有分配组合同时存在于叠加态中，纠缠的agent对以耦合项进入能量，
   * 演化后测量坍缩得到联合分配。这是逐任务贪心无法表达的联合最优。
   *
   * 同步契约（08#34）：子空间退火演化经 Atomics.wait 阻塞式驱动，求解
   * 期间主线程事件循环停摆（HTTP/WS 心跳、GC 冻结）——脚本与简单确定性
   * 场景可用；长驻服务进程（WS/HTTP）请优先使用异步孪生
   * {@link QuantumScheduler.scheduleBatchQuantumAsync}（数值逐位一致）。
   *
   * @param taskIds 指定任务（缺省取全部挂起任务，按优先级）
   */
  scheduleBatchQuantum(taskIds?: string[]): QuantumBatchReport {
    return this.engine.scheduleBatchQuantum(taskIds);
  }

  /**
   * 批量联合量子调度的异步孪生（08#34 调度器侧收口）。
   *
   * 与 {@link QuantumScheduler.scheduleBatchQuantum} 完全同一语义、同一
   * dispatch 序列——**数值逐位一致**（同一问题实例、同一种子时两版的
   * QuantumBatchReport 逐字段相同，由回归测试锚定）。唯一区别：子空间
   * 退火演化走 waitAsync 非阻塞驱动（annealSolveSubspaceAsync），求解
   * 期间主线程事件循环全程存活——WS/HTTP 心跳、GC、immediate 队列照常
   * 运转。长驻服务进程应优先使用本入口；同步版保留给脚本/简单确定性场景。
   *
   * 已知不对称（有意为之）：QAOA 分支（qaoaSolveSubspace）没有异步变体，
   * 两版均同步执行——但调度器仅在子空间维度 ≤ SUBSPACE_QAOA_DIMENSION_LIMIT
   * 时选择 QAOA，其变分训练的阻塞时长有界；真正可达分钟级的退火路径
   * （大维度）已全部 async 化。
   *
   * @param taskIds 指定任务（缺省取全部挂起任务，按优先级）
   */
  async scheduleBatchQuantumAsync(taskIds?: string[]): Promise<QuantumBatchReport> {
    return this.engine.scheduleBatchQuantumAsync(taskIds);
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
    options: { numReads?: number; timeoutMs?: number; routing?: ExecutionTierRouting } = {},
  ): Promise<QuantumBatchReport> {
    return this.engine.scheduleBatchQuantumQpu(backend, options);
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
    return this.engine.getQuantumMetrics();
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

  /**
   * 调试模式不变量校验（Wave 2.1 验收标准①的机制化）：
   * 对比计数器口径与全表扫描派生真值，返回违例列表（空 = 通过）。
   * QUANTUM_ASSERT_INVARIANTS=1 时由 CI 在全套件运行后调用；
   * 生产默认不跑（全表扫描成本与热路径预算冲突）。
   */
  checkInvariants(): InvariantViolation[] {
    return this.lifecycle.checkInvariants();
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
      totalTasks: this.lifecycle.taskMap.size,
      completedTasks: this.lifecycle.completedTaskCount,
      failedTasks: this.lifecycle.failedTaskCount,
      cancelledTasks: this.lifecycle.cancelledTaskCount,
      pendingTasks: this.lifecycle.pendingTaskCount,
      systemLoad: totalAgents > 0 ? activeAgents / totalAgents : 0,
      quantumEfficiency:
        this.totalDecisions > 0 ? this.lifecycle.completedAssignmentCount / this.totalDecisions : 0,
      schedulingHistoryLength: this.totalDecisions,
    };
  }

  // 获取当前状态
  getAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  getTasks(): Task[] {
    return Array.from(this.lifecycle.taskMap.values());
  }

  getSchedulingHistory(): SchedulingDecision[] {
    // 防御性拷贝：外部 push/splice 会破坏长度封顶不变量并使
    // totalDecisions 与实际历史长度脱钩
    return this.schedulingHistory.slice();
  }
}
