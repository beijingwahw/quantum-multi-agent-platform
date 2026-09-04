import type { QuantumAlgorithm, QuantumEngineConfig } from './core/quantum-scheduler.js';
import { QuantumScheduler } from './core/quantum-scheduler.js';
import { AgentManager } from './core/agent-manager.js';
import { QuantumBus } from './communication/quantum-bus.js';
import { DSHIntegration } from './dsh/dsh-integration.js';
import { EventEmitter } from 'events';
import { pathToFileURL } from 'url';
import type { LogLevel } from './utils/logger.js';
import { setLogLevel, logInfo, logWarn, logError } from './utils/logger.js';
import { ConfigurationError } from './utils/errors.js';
import type {
  Agent,
  AgentType,
  TaskPriority,
  Task,
  TaskRequirement,
} from './types/quantum-types.js';

/** 递归可选：用户配置只需覆盖关心的字段，其余保留默认值 */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

// 原型污染防护：这些键出现在用户配置（可能来自 JSON.parse 的任意输入）里时
// 会触发 Object.prototype 的 setter，必须整体拒绝
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

// 递归深度上限：防御病态嵌套配置导致的栈溢出（含循环引用的配置对象）
const MAX_MERGE_DEPTH = 10;

// 深合并配置：保留各层级默认值，仅覆盖用户显式传入的字段。
// 数组整体替换（不逐元素合并——元素语义未知，半合并产物更危险）。
// 类型边界说明：override 声明为 DeepPartial<T>，运行时按键读取需要
// 走 Record<string, unknown> 视图，出口一次性收敛回 T——这是本函数
// 唯一的类型断言点（此前双 as 在入口/出口各散一处）。
function deepMerge<T extends object>(
  defaults: T,
  override: DeepPartial<T> | undefined,
  depth = 0,
): T {
  if (depth > MAX_MERGE_DEPTH) {
    throw new ConfigurationError(`Configuration nesting exceeds depth limit ${MAX_MERGE_DEPTH}`);
  }
  const result = { ...defaults };
  if (!override) return result;
  const target = result as Record<string, unknown>;
  for (const key of Object.keys(override) as Array<keyof T & string>) {
    if (DANGEROUS_KEYS.has(key)) {
      throw new ConfigurationError(`Configuration key '${key}' is not allowed`);
    }
    const overrideValue: unknown = (override as Record<string, unknown>)[key];
    const defaultValue: unknown = (defaults as Record<string, unknown>)[key];
    const bothArePlainObjects =
      overrideValue !== null &&
      typeof overrideValue === 'object' &&
      !Array.isArray(overrideValue) &&
      defaultValue !== null &&
      typeof defaultValue === 'object' &&
      !Array.isArray(defaultValue);
    if (bothArePlainObjects) {
      target[key] = deepMerge(defaultValue, overrideValue, depth + 1);
    } else if (overrideValue !== undefined) {
      target[key] = overrideValue;
    }
  }
  return result;
}

/**
 * 平台配置（DEFAULT_CONFIG 的完整形状；用户侧传 DeepPartial）。
 * 历史上的 dsh.* / messageTtl / quantumRange / maxAgentCount / taskQueueSize /
 * loadBalancingStrategy 字段从未被任何组件消费，已删除——配置面只声明
 * 真实生效的开关（运行时多余字段会被 deepMerge 安全忽略，旧配置仍可用）。
 */
export interface PlatformConfig {
  logLevel: LogLevel;
  scheduling: {
    quantumAlgorithm: QuantumAlgorithm;
    maxConcurrentTasks: number;
    taskTimeout: number;
    sweepInterval: number;
    maxHistorySize: number;
    autoSchedule?: boolean;
    quantum?: QuantumEngineConfig;
  };
  communication: {
    heartbeatInterval: number;
    maxMessageSize: number;
    maxQueuedMessages: number;
    port: number;
    /** 设置后 WebSocket 控制台协议要求令牌鉴权 */
    authToken?: string;
    maxSubscriptions?: number;
    /** 心跳 ping 间隔（毫秒） */
    heartbeatIntervalMs?: number;
    /** 心跳过期阈值（毫秒） */
    heartbeatTimeoutMs?: number;
    /**
     * 监听地址（默认 '127.0.0.1'）。无 authToken 的本地开发模式绝不
     * 暴露到网络接口；LAN 部署显式传入（如 '0.0.0.0'）并务必配置 authToken
     */
    host?: string;
    /** 最大并发连接数（默认 256），超出即以 1013 拒绝新连接 */
    maxConnections?: number;
  };
  performance: {
    metricsInterval: number;
    retentionDays: number;
    retentionMs: number;
  };
}

const DEFAULT_CONFIG: PlatformConfig = {
  logLevel: 'info',
  scheduling: {
    quantumAlgorithm: 'hybrid',
    maxConcurrentTasks: 100,
    taskTimeout: 30000,
    sweepInterval: 5000,
    maxHistorySize: 10000,
  },
  communication: {
    heartbeatInterval: 5000,
    maxMessageSize: 1048576,
    maxQueuedMessages: 1000,
    port: 8080,
  },
  performance: {
    metricsInterval: 10000,
    retentionDays: 30,
    retentionMs: 30 * 24 * 3600 * 1000,
  },
};

/** 控制台快照（buildConsoleSnapshot 返回结构） */
export interface ConsoleSnapshot {
  timestamp: string;
  agents: Array<{
    id: string;
    name: string;
    type: string;
    state: string;
    load: number;
    capabilities: string[];
    entanglementCount: number;
  }>;
  tasks: Array<{
    id: string;
    name: string;
    type: string;
    status: string;
    priority: string;
    assignedAgentId: string | null;
    createdAt: Date;
  }>;
  metrics: PlatformSystemMetrics;
}

/** 平台级系统指标聚合（getSystemMetrics 返回结构） */
export interface PlatformSystemMetrics {
  scheduler: ReturnType<QuantumScheduler['getSystemMetrics']>;
  agents: ReturnType<AgentManager['getAgentMetrics']>;
  bus: ReturnType<QuantumBus['getMetrics']>;
  dsh: ReturnType<DSHIntegration['getMetrics']>;
  health: ReturnType<AgentManager['checkSystemHealth']>;
}

export class QuantumMultiAgentPlatform extends EventEmitter {
  public readonly scheduler: QuantumScheduler;
  public readonly agentManager: AgentManager;
  public readonly quantumBus: QuantumBus;
  public readonly dshIntegration: DSHIntegration;
  public readonly config: PlatformConfig;
  private isRunning = false;
  private metricsInterval: NodeJS.Timeout | null = null;
  private snapshotTimer: NodeJS.Timeout | null = null;

  constructor(config: DeepPartial<PlatformConfig> = {}) {
    super();

    this.config = deepMerge(DEFAULT_CONFIG, config);
    setLogLevel(this.config.logLevel);

    // 初始化核心组件
    this.scheduler = new QuantumScheduler(this.config);
    this.agentManager = new AgentManager(this.config);
    this.quantumBus = new QuantumBus(this.config);
    this.dshIntegration = new DSHIntegration(this.config);

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Agent管理事件
    this.agentManager.on('agent_registered', (agent: Agent) => {
      this.scheduler.registerAgent(agent);
      this.quantumBus.createBroadcastMessage(
        agent.id,
        'agent_status',
        {
          agentId: agent.id,
          name: agent.name,
          status: 'registered',
        },
        'low',
      );
    });

    this.agentManager.on('agent_unregistered', (agent: Agent) => {
      this.scheduler.unregisterAgent(agent.id);
      this.quantumBus.createBroadcastMessage(
        agent.id,
        'agent_status',
        {
          agentId: agent.id,
          name: agent.name,
          status: 'unregistered',
        },
        'low',
      );
    });

    // Task调度事件（负载已由调度器维护，此处仅通知）
    this.scheduler.on(
      'task_assigned',
      ({ taskId, agentId }: { taskId: string; agentId: string }) => {
        // 定向投递给被分配的agent（第4参是目标；错放source位会广播全文）
        this.quantumBus.createMessage(
          'scheduler',
          'task_assignment',
          {
            taskId,
            message: 'New task assigned',
          },
          agentId,
        );
        this.broadcastConsoleSnapshot();
      },
    );

    this.scheduler.on('task_completed', ({ taskId, task }: { taskId: string; task: Task }) => {
      this.quantumBus.createBroadcastMessage('scheduler', 'task_completed', {
        taskId,
        taskName: task.name,
        duration: task.actualDuration,
      });
      this.broadcastConsoleSnapshot();
    });

    this.scheduler.on('task_failed', ({ taskId, task }: { taskId: string; task: Task }) => {
      this.quantumBus.createBroadcastMessage('scheduler', 'task_failed', {
        taskId,
        taskName: task.name,
      });
      this.broadcastConsoleSnapshot();
    });

    // DSH集成事件
    this.dshIntegration.on('initialized', () => {
      logInfo('QuantumPlatform', 'DSH Integration initialized');
    });

    // 控制台协议：快照查询与远程命令
    this.quantumBus.on('console_query', ({ respond }: { respond: (content: unknown) => void }) => {
      respond(this.buildConsoleSnapshot());
    });

    this.quantumBus.on(
      'console_command',
      ({ action, payload }: { action: string; payload?: unknown }) => {
        this.handleConsoleCommand(action, payload);
      },
    );
  }

  // 控制台协议实现
  buildConsoleSnapshot(): ConsoleSnapshot {
    // 任务只取最近一批：广播成本不随历史任务总量增长
    const recentTasks = this.getTasks().slice(-200);
    return {
      timestamp: new Date().toISOString(),
      agents: this.getAgents().map((agent) => ({
        id: agent.id,
        name: agent.name,
        type: agent.type,
        state: agent.state,
        load: agent.load,
        capabilities: agent.capabilities,
        entanglementCount: agent.quantumEntanglement.length,
      })),
      tasks: recentTasks.map((task) => ({
        id: task.id,
        name: task.name,
        type: task.type,
        status: task.status,
        priority: task.priority,
        assignedAgentId: task.assignedAgentId ?? null,
        createdAt: task.createdAt,
      })),
      metrics: this.getSystemMetrics(),
    };
  }

  broadcastConsoleSnapshot(): void {
    if (!this.quantumBus.isStarted()) return;

    // 节流：高吞吐下生命周期事件密集触发，100ms内合并为一次广播，
    // console_query应答路径不受影响（始终即时构建新鲜快照）
    if (this.snapshotTimer) return;

    this.snapshotTimer = setTimeout(() => {
      this.snapshotTimer = null;
      if (this.quantumBus.isStarted()) {
        this.quantumBus.createBroadcastMessage(
          'platform',
          'status_update',
          this.buildConsoleSnapshot(),
        );
      }
    }, 100);

    // 不阻止进程退出
    this.snapshotTimer.unref();
  }

  handleConsoleCommand(action: string, payload: unknown): void {
    try {
      switch (action) {
        case 'submit_task': {
          const p = (payload ?? {}) as Record<string, unknown>;
          const priority = p.priority;
          if (
            priority !== undefined &&
            (typeof priority !== 'string' ||
              !['low', 'medium', 'high', 'critical'].includes(priority))
          ) {
            throw new ConfigurationError(`Invalid priority '${JSON.stringify(priority)}'`);
          }
          // type 可由调用方指定（协议与 SDK 的 submitTask 能力对齐，
          // 不再硬编码 'console'——任务类型是下游能力匹配的输入）
          const taskType = typeof p.type === 'string' && p.type ? p.type : 'console';
          const task = this.submitTask({
            name: typeof p.name === 'string' && p.name ? p.name : 'Console Task',
            type: taskType,
            priority: (priority ?? 'medium') as TaskPriority,
            requirements: [],
          });
          logInfo('QuantumPlatform', `Console command: task submitted (${task.id})`);
          break;
        }
        case 'add_agent': {
          const p = (payload ?? {}) as Record<string, unknown>;
          const capabilities = Array.isArray(p.capabilities)
            ? p.capabilities.map(String)
            : ['custom_task'];
          const agent = this.registerAgent({
            name:
              typeof p.name === 'string' && p.name ? p.name : `Console Agent ${Date.now() % 10000}`,
            type: 'custom',
            capabilities,
          });
          logInfo('QuantumPlatform', `Console command: agent added (${agent.name})`);
          break;
        }
        case 'complete_task': {
          const p = (payload ?? {}) as Record<string, unknown>;
          if (typeof p.taskId !== 'string' || !p.taskId) {
            // 与 submit_task 的 priority 校验同口径：畸形远程输入显式报错，
            // 而不是静默吞掉（调用方无法得知命令未生效）
            throw new ConfigurationError("complete_task requires a non-empty 'taskId'");
          }
          this.completeTask(p.taskId, p.success !== false);
          break;
        }
        default:
          logWarn('QuantumPlatform', `Unknown console command: ${action}`);
      }
    } catch (error) {
      // 控制台命令是远程输入：失败必须被平台消化并向日志报告，
      // 而不是沿事件链抛回总线处理器
      logError(
        'QuantumPlatform',
        `Console command '${action}' failed:`,
        error instanceof Error ? error.message : error,
      );
    } finally {
      // 命令执行后广播最新快照，所有已连接的控制台同步刷新
      this.broadcastConsoleSnapshot();
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    // 逆序回滚栈：每成功占用一项资源压栈一条逆操作，中途抛错按 LIFO
    // 回滚——失败路径零残留。此前只回滚 bus：DSH 半初始化、系统
    // agents 残留会让「未启动」的平台继续持有活动组件。
    const rollback: Array<() => void> = [];
    try {
      logInfo('QuantumPlatform', 'Starting Quantum Multi-Agent Platform...');

      // 启动通信总线（占用端口）
      await this.quantumBus.start();
      rollback.push(() => {
        this.quantumBus.shutdown();
      });

      // 启动DSH集成
      await this.dshIntegration.initialize();
      rollback.push(() => {
        this.dshIntegration.shutdown();
      });

      // 注册系统agents
      this.registerSystemAgents();
      rollback.push(() => {
        this.agentManager.shutdown();
      });

      // 启动系统监控
      this.metricsInterval = setInterval(() => {
        this.reportMetrics();
      }, this.config.performance.metricsInterval);
      rollback.push(() => {
        if (this.metricsInterval) {
          clearInterval(this.metricsInterval);
          this.metricsInterval = null;
        }
      });

      this.isRunning = true;
      this.emit('started');
      logInfo('QuantumPlatform', 'Quantum Multi-Agent Platform started successfully');
    } catch (error) {
      logError('QuantumPlatform', 'Failed to start:', error);
      for (const undo of rollback.reverse()) {
        try {
          undo();
        } catch (rollbackError) {
          // 回滚本身失败不能掩盖原始错误，逐项尽力而为
          logError('QuantumPlatform', 'Rollback step failed:', rollbackError);
        }
      }
      throw error;
    }
  }

  stop(): void {
    if (!this.isRunning) return;

    logInfo('QuantumPlatform', 'Stopping Quantum Multi-Agent Platform...');

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
    if (this.snapshotTimer) {
      clearTimeout(this.snapshotTimer);
      this.snapshotTimer = null;
    }
    this.quantumBus.shutdown();
    this.agentManager.shutdown();
    this.scheduler.shutdown();
    this.dshIntegration.shutdown();
    this.isRunning = false;
    this.emit('stopped');

    logInfo('QuantumPlatform', 'Quantum Multi-Agent Platform stopped');
  }

  /**
   * 彻底销毁平台。stop() 只收尾运行态（定时器/总线/管理器），不解除
   * setupEventHandlers 注册的跨组件监听——组件引用互相滞留，同进程
   * 重建平台（测试/热重启）时监听器持续累积、旧实例无法被 GC。
   * dispose 在 stop 基础上解除全部监听；平台对象此后不可复用。
   */
  dispose(): void {
    this.stop();
    this.agentManager.removeAllListeners();
    this.scheduler.removeAllListeners();
    this.quantumBus.removeAllListeners();
    this.dshIntegration.removeAllListeners();
    this.removeAllListeners();
  }

  private registerSystemAgents(): void {
    // 注册开发agent
    const developerAgent = this.agentManager.registerAgent({
      name: 'Quantum Developer',
      type: 'developer',
      capabilities: ['code_analysis', 'debugging', 'refactoring', 'testing'],
      position: { x: 0, y: 0, z: 0 },
    });

    // 注册测试agent
    const testerAgent = this.agentManager.registerAgent({
      name: 'Quantum Tester',
      type: 'tester',
      capabilities: ['unit_testing', 'integration_testing', 'performance_testing', 'debugging'],
      position: { x: 1, y: 0, z: 0 },
    });

    // 部署agent
    const deployerAgent = this.agentManager.registerAgent({
      name: 'Quantum Deployer',
      type: 'deployer',
      capabilities: ['deployment', 'monitoring', 'rollback', 'scaling'],
      position: { x: 0, y: 1, z: 0 },
    });

    // 监控agent
    const monitorAgent = this.agentManager.registerAgent({
      name: 'Quantum Monitor',
      type: 'monitor',
      capabilities: ['performance_monitoring', 'health_check', 'alerting', 'logging'],
      position: { x: 1, y: 1, z: 0 },
    });

    // 创建量子纠缠
    this.agentManager.createEntanglement(developerAgent.id, testerAgent.id);
    this.agentManager.createEntanglement(testerAgent.id, deployerAgent.id);
    this.agentManager.createEntanglement(deployerAgent.id, monitorAgent.id);

    logInfo('QuantumPlatform', 'System agents registered');
  }

  // Public API
  submitTask(task: {
    name: string;
    type: string;
    priority: TaskPriority;
    requirements?: TaskRequirement[];
    dependencies?: string[];
    estimatedDuration?: number;
  }): Task {
    // id/时间戳/量子态由调度器统一生成（种子化 RNG，可复现）；
    // 此前这里手工构建的 quantumState 会被调度器整个丢弃
    return this.scheduler.submitTask({
      ...task,
      requirements: task.requirements ?? [],
      dependencies: task.dependencies ?? [],
      estimatedDuration: task.estimatedDuration ?? 60000,
      actualDuration: 0,
      status: 'pending',
    });
  }

  // 任务完成/失败的统一入口
  completeTask(taskId: string, success = true, result?: unknown): boolean {
    return this.scheduler.completeTask(taskId, success, result);
  }

  /**
   * 批量联合量子调度：一批挂起任务 × 空闲agent 的联合分配编码为哈密顿量，
   * 叠加态上演化（QAOA/绝热退火）后测量坍缩。纠缠agent对以耦合项进入能量。
   * 返回报告含 Born 概率与（规模允许时的）穷举最优对照。
   */
  scheduleBatchQuantum(taskIds?: string[]) {
    return this.scheduler.scheduleBatchQuantum(taskIds);
  }

  /** 量子引擎运行统计（真实量子路径的决策数、Born概率、最优率） */
  getQuantumMetrics() {
    return this.scheduler.getQuantumMetrics();
  }

  registerAgent(agent: {
    name: string;
    type: AgentType;
    capabilities: string[];
    position?: { x: number; y: number; z: number };
  }): Agent {
    return this.agentManager.registerAgent(agent);
  }

  async executeDSHTool(
    toolName: string,
    parameters: Record<string, unknown>,
    agentId?: string,
  ): Promise<unknown> {
    return await this.dshIntegration.executeTool(toolName, parameters, agentId);
  }

  async executeDSHWorkflow(
    workflowId: string,
    agentId?: string,
  ): Promise<Array<[string, unknown]>> {
    return await this.dshIntegration.executeWorkflow(workflowId, agentId);
  }

  // Monitoring and Metrics
  /**
   * 平台级系统指标聚合。
   * 注意：五组件按固定顺序顺序拉取，非事务性快照——高并发下同一份
   * 报告内的数字可能来自不同的内部时刻（如 scheduler 已记账而 bus
   * 计数未更新）。组件级原子快照需要各组件提供一致版本号，属后续
   * 演进项；当前消费方（控制台/日志）对此精度已足够。
   */
  getSystemMetrics(): PlatformSystemMetrics {
    return {
      scheduler: this.scheduler.getSystemMetrics(),
      agents: this.agentManager.getAgentMetrics(),
      bus: this.quantumBus.getMetrics(),
      dsh: this.dshIntegration.getMetrics(),
      health: this.agentManager.checkSystemHealth(),
    };
  }

  getAgents(): Agent[] {
    return this.agentManager.getAgents();
  }

  getTasks(): Task[] {
    return this.scheduler.getTasks();
  }

  private reportMetrics(): void {
    const metrics = this.getSystemMetrics();
    logInfo('QuantumPlatform', 'Metrics:', {
      timestamp: new Date().toISOString(),
      agents: metrics.agents,
      tasks: metrics.scheduler,
      health: metrics.health,
    });
    this.broadcastConsoleSnapshot();
  }
}

// 导出主要类和接口
export { QuantumScheduler } from './core/quantum-scheduler.js';
export type {
  QuantumSchedulerConfig,
  QuantumAlgorithm,
  QuantumEngineConfig,
  QuantumBatchReport,
} from './core/quantum-scheduler.js';
export {
  QuantumStateVector,
  qaoaSolve,
  annealSolve,
  bruteForceOptimum,
  defaultPenalties,
  couplingKey,
  toIsing,
  computeEnergies,
  decodeAssignment,
  isValidAssignment,
  welfareOf,
} from './core/quantum-optimizer.js';
export type {
  AssignmentProblem,
  QuantumSolverOptions,
  QuantumSolution,
  QuantumCandidate,
  QuantumEngineKind,
  CollapseMode,
  ProblemEnergies,
  IsingModel,
  BruteForceResult,
} from './core/quantum-optimizer.js';
export {
  buildSubspaceModel,
  qaoaSolveSubspace,
  annealSolveSubspace,
  SubspaceState,
} from './core/subspace-optimizer.js';
export type {
  SubspaceModel,
  SubspaceSolution,
  SubspaceBuildOptions,
} from './core/subspace-optimizer.js';
export { hungarianAssignment, localSearchAssignment } from './core/classical-baselines.js';
export {
  LocalQuantumBackend,
  registerBackend,
  getBackend,
  listBackends,
} from './core/qpu/quantum-backend.js';
export type { QuantumBackend, QpuSampleSet, QpuSolveOptions } from './core/qpu/quantum-backend.js';
export { DWaveBackend } from './core/qpu/dwave-backend.js';
export type { DWaveConfig } from './core/qpu/dwave-backend.js';
export { solveAssignmentOnBackend } from './core/qpu/solve.js';
export type { QpuAssignmentResult } from './core/qpu/solve.js';
export { toQiskitProgram } from './core/qpu/qiskit-export.js';
export type { QiskitExportOptions } from './core/qpu/qiskit-export.js';
export { AgentManager } from './core/agent-manager.js';
export {
  PlatformError,
  ConfigurationError,
  StateError,
  SchedulingError,
  MechanismError,
  InfeasibleProblemError,
  QuantumEngineError,
  BackendError,
  ToolError,
} from './utils/errors.js';
export { QuantumBus } from './communication/quantum-bus.js';
export { DSHIntegration } from './dsh/dsh-integration.js';
// 命令策略门面：宿主扩展白名单/收紧超时无需深路径导入 system-tools
export {
  configureCommandPolicy,
  resetCommandPolicy,
  getCommandPolicy,
  execute_command_argv,
} from './tools/system-tools.js';
export { GrowthMarketScheduler, DEFAULT_GROWTH_CONFIG } from './core/growth-market-scheduler.js';
export type {
  GrowthAgentSpec,
  GrowthSchedulerConfig,
  AllocationPolicy,
  TaskAssignment,
  SettlementResult,
  AgentSnapshot,
} from './core/growth-market-scheduler.js';
export {
  BatchVCGScheduler,
  BudgetPacer,
  DEFAULT_BATCH_CONFIG,
} from './core/batch-vcg-scheduler.js';
export {
  CompoundBrain,
  DEFAULT_COMPOUND_CONFIG,
  lawKMin,
  lawDeltaMax,
} from './core/compound-brain.js';
export type {
  CompoundAgentSpec,
  CompoundTaskSpec,
  CompoundConfig,
  CompoundAllocation,
  CompoundAssignment,
  Settlement,
  CalibrationReport,
  CapabilityAdvice,
  IncubationAdvice,
} from './core/compound-brain.js';
export { GrowthSchedulerBrain } from './proactive-intelligence/brain.js';
export type { BrainState } from './proactive-intelligence/brain.js';
export { ProactiveIntelligencePlugin } from './proactive-intelligence/index.js';
export type {
  MonitorEvent,
  DecisionContext,
  Rule,
  Condition,
  Action,
  ActionExecution,
  PolicyConfig,
  Metrics,
} from './proactive-intelligence/index.js';
export type {
  BatchAgentSpec,
  BatchVCGConfig,
  BatchAllocation,
  BatchAssignment,
  BatchSettlement,
} from './core/batch-vcg-scheduler.js';

// 导出类型
export type {
  Agent,
  AgentType,
  Task,
  TaskPriority,
  TaskRequirement,
  QuantumMessage,
} from './types/quantum-types.js';

// CLI入口（Windows路径兼容）
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const platform = new QuantumMultiAgentPlatform();

  // 启动平台（失败必须反映到退出码：脚本/CI 依赖非零退出感知启动失败）
  platform.start().catch((err: unknown) => {
    console.error('[QuantumPlatform]', err);
    process.exitCode = 1;
  });

  // 监听中断信号：让事件循环自然排空（异步日志/关闭握手不被截断），
  // 定时器已全部 unref/clear，进程会自行退出
  const shutdown = (signal: string): void => {
    console.log(`\n[QuantumPlatform] Received ${signal}, shutting down...`);
    try {
      platform.stop();
    } catch (err) {
      // 信号处理里的异常无人接盘会以未捕获异常杀进程——收尾失败
      // 显式反映到退出码而非静默
      console.error('[QuantumPlatform] Shutdown failed:', err);
      process.exitCode = 1;
    }
  };
  process.on('SIGINT', () => {
    shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    shutdown('SIGTERM');
  });
}

export default QuantumMultiAgentPlatform;
