/**
 * task-lifecycle-manager —— 任务生命周期管理器（01#24 拆分）。
 *
 * QuantumScheduler 此前是 ~2000 行的 god class，本模块把其中的任务
 * 生命周期职责整块迁出：任务表、挂起桶、依赖反向索引、状态计数器、
 * 终态/转移应用（转移表守卫见 task-lifecycle.ts）、巡检超时回收与
 * 保留清理、不变量校验。迁移是纯委托——方法体逐字保留（仅 this.* 引用
 * 改经 ctx 回调/自有字段），事件名、错误消息、日志行、种子化随机数
 * 抽取序不变；可观测行为除一处**同波次行为修复**外不变：01#5 把 sweep
 * 的挂起任务 TTL 缺省从「关闭」改为 600s（显式 0 关闭，见
 * DEFAULT_PENDING_TIMEOUT_MS）——迁移不是把行为漂移藏进搬家的机会。
 * QuantumScheduler 保留注册表与公共门面。
 */

import type {
  Agent,
  Task,
  QuantumState,
  SchedulingDecision,
  TaskPriority,
  TaskStatus,
} from '../types/quantum-types.js';
import type { EventEmitter } from 'events';
import { randomUUID } from 'node:crypto';
import { logDebug } from '../utils/logger.js';
import { SchedulingError } from '../utils/errors.js';
import { AGENT_OVERLOAD_THRESHOLD } from './agent-manager.js';
import {
  assertLegalTaskTransition,
  isLegalTaskTransition,
  isTerminalTaskStatus,
  checkTaskInvariants,
  type InvariantViolation,
} from './task-lifecycle.js';
import { classifyPendingTask } from './pending-reachability.js';
// 01#24：仅类型依赖调度器模块（配置切片与统计口径）——无运行时环依赖
import type { AgentScheduleStats, QuantumSchedulerConfig } from './quantum-scheduler.js';

// 分桶遍历顺序即调度优先顺序（01#24：随 pendingBuckets 迁入本模块，
// 调度器的重调度扫描与这里的候选收集共用同一顺序源）
export const PRIORITY_ORDER: TaskPriority[] = ['critical', 'high', 'medium', 'low'];

/**
 * 挂起任务缺省 TTL（01#5 收尾）：10 分钟。此前缺省关闭（undefined →
 * 禁用），不可满足/依赖阻塞的 pending 任务在默认部署下仍永久泄漏内存
 * 与指标。显式配置 0 可关闭（长依赖链的合法等待语义）。
 * （01#24：随 sweep 迁入本模块；quantum-scheduler.ts 原位 re-export
 * 维持既有导入路径不变）
 */
export const DEFAULT_PENDING_TIMEOUT_MS = 600_000;

/**
 * 01#24：生命周期管理器所需的调度器上下文（窄接口，构造注入）。
 * 管理器不拥有 agent 注册表与亲和度评分——收尾释放 agent、提交时的
 * 量子态生成与自动重调度经此上下文回调；events 即调度器本体
 * （EventEmitter），事件广播的发射源与拆分前完全一致。
 */
export interface TaskLifecycleContext {
  readonly config: QuantumSchedulerConfig;
  /** agent 注册表（活引用）：释放/占用 agent 时读写同一 Map */
  readonly agents: Map<string, Agent>;
  /** agent 调度统计（活引用）：assignTaskToAgent 的 O(1) 相关性计数 */
  readonly agentStats: Map<string, AgentScheduleStats>;
  /** 事件发射源：调度器本体（task_submitted/completed/failed/assigned） */
  readonly events: EventEmitter;
  /** 生成任务量子态（种子化 PRNG 在调度器侧，抽取序不变） */
  generateQuantumState(): QuantumState;
  /** 提交后立即调度的公共入口（autoSchedule 开启时） */
  scheduleTask(taskId: string): SchedulingDecision | null;
  /** 收尾释放容量后的挂起重调度（autoSchedule 开启时） */
  reschedulePendingTasks(): void;
}

/**
 * 任务生命周期管理器（01#24 自 QuantumScheduler 拆出）：
 * 拥有任务表 / pendingBuckets / dependents 反向索引与全部状态计数器，
 * 是任务状态机（转移表见 task-lifecycle.ts）的唯一写点集合。
 */
export class TaskLifecycleManager {
  private tasks = new Map<string, Task>();
  // 性能索引：挂起任务按优先级分桶，免除每次重调度的全量排序
  private pendingBuckets = new Map<TaskPriority, string[]>();
  /**
   * 性能索引：依赖 → 其直接下游任务集合。级联失败曾对每次失败做全量
   * 任务扫描（O(T)/次，批量失败 O(E·T)）。Set 按提交序遍历 == 原全表
   * 扫描筛选序，级联的 completeTask 调用序列不变（位级行为一致）。
   * 维护点：submitTask（建立）与 sweep 保留清理（随任务删除收缩）。
   */
  private dependents = new Map<string, Set<string>>();
  // 计数器：指标计算O(1)，不随任务总量增长
  private completedCount = 0;
  private failedCount = 0;
  /** 取消计数（01#15：取消≠失败，failedTasks 不得混入取消口径） */
  private cancelledCount = 0;
  private pendingCount = 0;
  // 已入桶追踪：保证pendingCount只在真正入过桶的任务上增减
  private pendingTracked = new Set<string>();
  // 当前占用中的agent数（assigned/running），用于并发上限背压
  private activeAssignments = 0;
  // 仅统计真正经过调度决策并完成的任务（quantumEfficiency 分子）
  private completedAssignments = 0;

  // 04 P2-11（erasableSyntaxOnly）：参数属性改为显式字段 + 构造器赋值
  private readonly ctx: TaskLifecycleContext;

  constructor(ctx: TaskLifecycleContext) {
    this.ctx = ctx;
  }

  /** 任务表只读视图（调度器的查找/遍历/计数经此读取同一 Map） */
  get taskMap(): ReadonlyMap<string, Task> {
    return this.tasks;
  }

  get activeAssignmentCount(): number {
    return this.activeAssignments;
  }

  get completedAssignmentCount(): number {
    return this.completedAssignments;
  }

  get completedTaskCount(): number {
    return this.completedCount;
  }

  get failedTaskCount(): number {
    return this.failedCount;
  }

  get cancelledTaskCount(): number {
    return this.cancelledCount;
  }

  get pendingTaskCount(): number {
    return this.pendingCount;
  }

  // 挂起桶的受控读写（01#24：调度器重调度扫描重建桶时的原语义操作）
  getPendingBucket(priority: TaskPriority): readonly string[] | undefined {
    return this.pendingBuckets.get(priority);
  }

  setPendingBucket(priority: TaskPriority, ids: string[]): void {
    this.pendingBuckets.set(priority, ids);
  }

  deletePendingBucket(priority: TaskPriority): void {
    this.pendingBuckets.delete(priority);
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
      quantumState: this.ctx.generateQuantumState(),
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
    this.ctx.events.emit('task_submitted', fullTask);

    // 立即尝试调度（批量模式下攒起来等联合量子调度）
    if (this.ctx.config.scheduling?.autoSchedule !== false) {
      this.ctx.scheduleTask(fullTask.id);
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
    const cancelled = !success && TaskLifecycleManager.isCancellation(result);
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
      const agent = this.ctx.agents.get(task.assignedAgentId);
      if (agent) {
        agent.load = Math.max(0, agent.load - 1);
        // overloaded 必须与 working 同样参与释放重判，否则它是无出边的
        // 吸收态：load 归零仍停在 overloaded，agent 永久退出空闲候选池，
        // systemLoad 也随之失真（全员 overloaded 时显示零负载）。
        // 重判语义与 agent-manager 的 heartbeat 恢复一致：按当前 load 定态。
        if (agent.state === 'working' || agent.state === 'overloaded') {
          agent.state = agent.load > AGENT_OVERLOAD_THRESHOLD ? 'overloaded' : 'idle';
        }
        this.ctx.agents.set(agent.id, agent);
      }
    }

    if (success) {
      this.ctx.events.emit('task_completed', { taskId, task, result });
    } else {
      this.ctx.events.emit('task_failed', { taskId, task, result });
      // 级联失败：依赖本任务的任务一并失败，避免永久挂起
      this.cascadeFailure(taskId);
    }

    logDebug(
      'QuantumScheduler',
      `Task ${success ? 'completed' : 'failed'}: ${task.name} (${taskId})`,
    );

    // 释放出的容量立即用于挂起任务（批量模式下留待联合调度）
    if (this.ctx.config.scheduling?.autoSchedule !== false) {
      this.ctx.reschedulePendingTasks();
    }
    return true;
  }

  // 前置依赖是否全部完成
  dependenciesMet(task: Task): boolean {
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

  assignTaskToAgent(taskId: string, agentId: string): void {
    const task = this.tasks.get(taskId);
    const agent = this.ctx.agents.get(agentId);

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

      // 更新agent调度统计（供O(1)相关性计算）
      const stats = this.ctx.agentStats.get(agentId);
      if (stats) {
        stats.total++;
        stats.byType.set(task.type, (stats.byType.get(task.type) ?? 0) + 1);
      }

      this.tasks.set(taskId, task);
      this.ctx.agents.set(agentId, agent);

      this.ctx.events.emit('task_assigned', { taskId, agentId });
    }
  }

  /** 按优先级桶顺序收集依赖已满足的全部挂起任务（批量路径的公共候选语义） */
  collectPendingCandidates(): Task[] {
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
   * 周期巡检的任务簿记段（01#24 自调度器迁入）：分配/挂起超时回收 +
   * 已终结任务保留清理。定时器接线（ensureSweepTimer/shutdown）留在
   * 调度器，定时回调进入本方法——回收/清理全部是任务状态机写点。
   */
  sweep(): void {
    const now = Date.now();
    const timeout = this.ctx.config.scheduling?.taskTimeout ?? 30000;

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

    // 1a) R18-I opt-in·挂起可达性早失败（缺省关——未配置时本段不可达，
    // sweep 行为位同构）：unsatisfiable（全注册表无能力匹配，T1 零错杀
    // 刻画见 pending-reachability.ts）的挂起任务立即以
    // { reason: 'unsatisfiable', elapsedMs } 失败——终态与级联 reason 与
    // 等满 pendingTimeoutMs 逐任务相同（T1' 提前失败严格支配），唯一差异
    // 是时间与失败根因记录。判定是时点陈述（JS 单线程下判定与失败的
    // 错杀窗口 = 空集）；sweep 之后注册的新 agent 不复活已判死任务
    // （复活通道在判定之前）——依赖动态注册扩容的部署不应开启。
    if (this.ctx.config.scheduling?.failFastUnsatisfiable === true) {
      const agentViews = [...this.ctx.agents.values()].map((a) => ({
        id: a.id,
        capabilities: a.capabilities,
        state: a.state,
      }));
      for (const task of this.tasks.values()) {
        if (task.status !== 'pending') continue;
        // 需求侧投影 + 去重：重复需求不改变匹配语义，但会触发判定模块
        // 的输入契约拒绝——sweep 定时回调内不抛，防御性去重
        const caps = [
          ...new Set(task.requirements.filter((r) => r.type === 'capability').map((r) => r.name)),
        ];
        const verdict = classifyPendingTask(
          { id: task.id, requiredCapabilities: caps },
          agentViews,
        );
        if (verdict.classification !== 'unsatisfiable') continue;
        logDebug(
          'QuantumScheduler',
          `Pending task failed fast (unsatisfiable): ${task.name} (${task.id}), required [${caps.join(', ')}]`,
        );
        this.completeTask(task.id, false, {
          reason: 'unsatisfiable',
          elapsedMs: now - task.createdAt.getTime(),
        });
      }
    }

    // 1b) 挂起 TTL（01#5，缺省 DEFAULT_PENDING_TIMEOUT_MS=10 分钟，
    // 显式 0 关闭）：超时未调度的 pending 任务失败出清（依赖下游级联），
    // 不可满足任务不再永久驻留。elapsed 从 createdAt 起算——pending
    // 任务没有 assignedAt，驻留期即排队期。
    const pendingTimeoutMs =
      this.ctx.config.scheduling?.pendingTimeoutMs ?? DEFAULT_PENDING_TIMEOUT_MS;
    if (pendingTimeoutMs > 0) {
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
      this.ctx.config.performance?.retentionMs ??
      (this.ctx.config.performance?.retentionDays ?? 30) * 86400000;
    if (retentionMs > 0) {
      for (const [id, task] of this.tasks) {
        // cancelled 同为终态（审计 A1#5 收尾）：取消与失败分列后，此处若
        // 仍只认 completed/failed，取消任务会绕过保留 GC 永久驻留内存与
        // 依赖反向索引。经转移表判终态——未来新增终态自动纳入清理
        if (isTerminalTaskStatus(task.status)) {
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
}
