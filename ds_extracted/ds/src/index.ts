import type { QuantumAlgorithm, QuantumEngineConfig } from './core/quantum-scheduler.js';
import { QuantumScheduler } from './core/quantum-scheduler.js';
import { AgentManager } from './core/agent-manager.js';
import { QuantumBus } from './communication/quantum-bus.js';
import { DSHIntegration } from './dsh/dsh-integration.js';
import { EventEmitter } from 'events';
import type { LogLevel } from './utils/logger.js';
import { setLogLevel, logInfo, logWarn, logError } from './utils/logger.js';
import { ConfigurationError, MessageValidationError } from './utils/errors.js';
import type {
  Agent,
  AgentType,
  TaskPriority,
  Task,
  TaskRequirement,
} from './types/quantum-types.js';

/**
 * 递归可选：用户配置只需覆盖关心的字段，其余保留默认值。
 * 数组元素的完整性（08#51 余项）：deepMerge 对数组**整体替换**（见下），
 * 不逐元素合并——因此覆盖数组时元素必须是完整形状（U[]），不允许
 * 半指定元素。此前的同态映射碰巧把部分性传播进元素（partial 元素可
 * 编译），运行时却被原样替换进配置——类型承诺了不会发生的合并，
 * 半合并产物是静默垃圾。显式条件分支取代隐式行为；MAX_MERGE_DEPTH
 * 运行时深度上限不变。
 */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Array<infer U>
    ? U[]
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};

// 原型污染防护：这些键出现在用户配置（可能来自 JSON.parse 的任意输入）里时
// 会触发 Object.prototype 的 setter，必须整体拒绝
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

// 控制台 submit_task 的合法优先级（R13）：成员测试走常量 Set——此前每条
// 命令都新建数组字面量再线性扫描，纯热路径分配
const CONSOLE_PRIORITIES = new Set(['low', 'medium', 'high', 'critical']);

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
  /**
   * 聚合采集时刻（ISO-8601，08#54）：五组件按固定顺序顺序拉取、非事务性
   * 快照——本时间戳标记聚合起点，同一份报告内各子报告的数字来自
   * [collectedAt, 聚合完成] 窗口内的不同内部时刻。消费方（控制台/日志）
   * 据此界定数字的新鲜度；组件级原子快照属后续演进项。
   */
  collectedAt: string;
  scheduler: ReturnType<QuantumScheduler['getSystemMetrics']>;
  agents: ReturnType<AgentManager['getAgentMetrics']>;
  bus: ReturnType<QuantumBus['getMetrics']>;
  dsh: ReturnType<DSHIntegration['getMetrics']>;
  health: ReturnType<AgentManager['checkSystemHealth']>;
}

/**
 * 控制台 submit_task 的 requirements 校验（08#49 余项）：与
 * {@link QuantumScheduler.submitTask} 的需求契约同口径——本调度器只强制
 * 'capability'（其余类型提交期拒绝，见 01#7），故控制台载荷也只接受
 * capability 元素；name 非空字符串、weight 有限数。畸形远程输入抛
 * ConfigurationError，由 handleConsoleCommand 的 catch 走 console error
 * 日志路径（与 priority 校验同一处置），不静默降级为无约束任务。
 */
function parseConsoleRequirements(raw: unknown): TaskRequirement[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    throw new ConfigurationError("'requirements' must be an array");
  }
  return raw.map((item, i) => {
    if (typeof item !== 'object' || item === null) {
      throw new ConfigurationError(`requirements[${i}] must be an object`);
    }
    const r = item as Record<string, unknown>;
    if (r.type !== 'capability') {
      throw new ConfigurationError(
        `requirements[${i}].type '${String(r.type)}' is not enforced by this scheduler ` +
          `(only 'capability' is supported)`,
      );
    }
    if (typeof r.name !== 'string' || !r.name) {
      throw new ConfigurationError(`requirements[${i}].name must be a non-empty string`);
    }
    if (typeof r.weight !== 'number' || !Number.isFinite(r.weight)) {
      throw new ConfigurationError(`requirements[${i}].weight must be a finite number`);
    }
    const req: TaskRequirement = { type: 'capability', name: r.name, weight: r.weight };
    if (r.value !== undefined) req.value = r.value;
    return req;
  });
}

/**
 * 量子多agent调度平台：装配 QuantumScheduler / AgentManager / QuantumBus /
 * DSHIntegration 四组件并编排跨组件事件（任务生命周期广播、控制台协议、
 * 指标上报）。start() 逆序回滚保证失败路径零残留；stop() 保留监听以支持
 * 重启，dispose() 彻底解除监听。
 */
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
            (typeof priority !== 'string' || !CONSOLE_PRIORITIES.has(priority))
          ) {
            throw new ConfigurationError(`Invalid priority '${JSON.stringify(priority)}'`);
          }
          // type 可由调用方指定（协议与 SDK 的 submitTask 能力对齐，
          // 不再硬编码 'console'——任务类型是下游能力匹配的输入）
          const taskType = typeof p.type === 'string' && p.type ? p.type : 'console';
          // requirements 可由调用方指定（08#49 余项：此前硬编码 []，控制台
          // 任务永远表达不出能力约束）。校验与 submitTask 的需求契约同口径
          const task = this.submitTask({
            name: typeof p.name === 'string' && p.name ? p.name : 'Console Task',
            type: taskType,
            priority: (priority ?? 'medium') as TaskPriority,
            requirements: parseConsoleRequirements(p.requirements),
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
          // success 严格布尔口径（R15-P2）：此前 `p.success !== false` 把任何
          // 非 false 值（"no"、0）都按成功结算——远程输入的畸形标志静默变成
          // 成功口径，与 submit_task 的严格校验不对称。镜像 priority 的校验
          // 形状：undefined 放行（默认成功，合法载荷行为不变），其余非布尔
          // 一律具名拒绝
          if (p.success !== undefined && typeof p.success !== 'boolean') {
            throw new MessageValidationError(`Invalid success flag '${JSON.stringify(p.success)}'`);
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
   *
   * 同步契约（08#34）：求解期间主线程事件循环停摆——服务进程请优先使用
   * {@link scheduleBatchQuantumAsync}（数值逐位一致，事件循环全程存活）。
   */
  scheduleBatchQuantum(taskIds?: string[]) {
    return this.scheduler.scheduleBatchQuantum(taskIds);
  }

  /**
   * 批量联合量子调度的异步孪生（08#34）：与 {@link scheduleBatchQuantum}
   * 同一语义、同一 dispatch 序列，数值逐位一致；子空间退火演化走
   * waitAsync 非阻塞驱动，求解期间 WS/HTTP 心跳、GC、immediate 队列
   * 照常运转。长驻服务进程（WebSocket 控制台等）应优先使用本入口。
   */
  async scheduleBatchQuantumAsync(taskIds?: string[]) {
    return await this.scheduler.scheduleBatchQuantumAsync(taskIds);
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
      // 08#54：additive 采集时刻——标记非事务性聚合的起点（见接口注释），
      // 全部既有字段保持不变
      collectedAt: new Date().toISOString(),
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

// 导出主要类和接口。
// 桶文件决策（08#52）：单一根出口是刻意设计——本库的唯一重依赖是 ws
//（通信层），其余域零外部依赖，ESM 按需 tree-shaking 已足够；子路径
// 分桶（./core、./qpu …）会新增一层必须长期维护的 API 面，收益不成
// 比例。knip 将本文件锚定为 entry（I9），公共 API 面由此处显式声明。
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
  validateAssignmentProblem,
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
  annealSolveSubspaceAsync,
  SubspaceState,
} from './core/subspace-optimizer.js';
export type {
  SubspaceModel,
  SubspaceSolution,
  SubspaceBuildOptions,
} from './core/subspace-optimizer.js';
export { hungarianAssignment, localSearchAssignment } from './core/classical-baselines.js';
// —— R14 创新波 opt-in 模块（未接入默认调度路径，显式导入使用）——
export { composeBatches } from './core/entanglement-batch-composer.js';
export type {
  EntangledAgentPair,
  ComposerTask,
  BatchComposition,
  ComposerOptions,
} from './core/entanglement-batch-composer.js';
export { MinCostFlowPotentials } from './core/min-cost-flow-potentials.js';
export type { SspMetrics } from './core/min-cost-flow-potentials.js';
export { ShadowPriceAdmissionController, extractCapacityDuals } from './core/admission-control.js';
export type {
  AgentCapacityUsage,
  AgentShadowPrice,
  CapacityDualReport,
  AdmissionControlConfig,
  AdmissionCandidate,
  AdmissionEvaluation,
  AdmissionDecision,
  AdmissionCertificate,
  AdmissionReason,
} from './core/admission-control.js';
// —— R18 创新波 opt-in 模块（未接入默认调度路径，显式导入使用）——
export { solveSecant } from './core/shadow-price-secant.js';
export type {
  PaymentEvaluator,
  SecantSearchInput,
  SecantSearchResult,
} from './core/shadow-price-secant.js';
export { classifyPendingTask, classifyPendingBucket } from './core/pending-reachability.js';
export type {
  ReachabilityAgentView,
  ReachabilityTaskView,
  ReachabilityClass,
  ReachabilityVerdict,
} from './core/pending-reachability.js';
export {
  analyzeGammaSpectrum,
  buyoutGammaCurve,
  gammaCurveValueAt,
  gammaCurveDerivativeAt,
  minimizeGammaCurve,
  refineGammaByTrigBuyout,
} from './core/gamma-spectrum-buyout.js';
export type {
  GammaSpectrumOptions,
  GammaSpectrum,
  GammaSpectrumFailure,
  GammaSpectrumResult,
  BuyoutOptions,
  GammaCurveBuyout,
  GammaMinimizeOptions,
  GammaMinCertificate,
  GammaBuyoutRefineOptions,
  GammaBuyoutRow,
  GammaBuyoutRefineResult,
} from './core/gamma-spectrum-buyout.js';
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
export {
  surfaceCode,
  grossCode,
  logicalErrorPerRound,
  blocksFor,
  estimateFtCircuit,
  selectFtCode,
  DEFAULT_FT_ASSUMPTIONS,
} from './core/qpu/ft-estimate.js';
export type {
  FtCodeSpec,
  FtEstimate,
  FtEstimateAssumptions,
  TFactoryAssumptions,
  LogicalCircuitProfile,
} from './core/qpu/ft-estimate.js';
export { decideExecutionTier, DEFAULT_NISQ_PROFILE } from './core/qpu/execution-tier.js';
export type {
  NisqProfile,
  ExecutionTier,
  ExecutionTierRequest,
  ExecutionTierDecision,
  ExecutionTierRouting,
} from './core/qpu/execution-tier.js';
export { toQiskitProgram } from './core/qpu/qiskit-export.js';
export type { QiskitExportOptions } from './core/qpu/qiskit-export.js';
// R14 创新波 opt-in：跨后端结果融合与读出误差缓解
export {
  crossBackendConsensus,
  wilsonInterval,
  WILSON_Z_95,
} from './core/qpu/cross-backend-consensus.js';
export type {
  BackendSampleReport,
  WilsonInterval,
  CrossBackendOptions,
  BackendAgreementStats,
  PairwiseAgreement,
  ConsensusResult,
} from './core/qpu/cross-backend-consensus.js';
export {
  hammingBlockCosts,
  mapDecodeAssignment,
  mitigateReadout,
} from './core/qpu/readout-mitigation.js';
export type {
  MapDecodeResult,
  MitigatedCandidate,
  MitigationReport,
  MitigateReadoutOptions,
} from './core/qpu/readout-mitigation.js';
// R18 创新波 opt-in：噪声感知后端选择器与对易性感知 FT 并行画像
export {
  oneHotRetentionRate,
  betaAdvantageProbability,
  noiseAwarePrior,
  NoiseAwareBackendSelector,
} from './core/qpu/noise-aware-backend-selector.js';
export type {
  SelectorArmInit,
  SelectionRule,
  ArmPosterior,
  SelectionDecision,
  SelectorOptions,
} from './core/qpu/noise-aware-backend-selector.js';
export {
  matchingLowerBound,
  interactionIsBipartite,
  verifyMatchingPartition,
  parallelizeLayer,
  parallelEstimateFtCircuit,
} from './core/qpu/commutation-ft.js';
export type {
  CouplingEdge,
  LayerGroup,
  LayerPartition,
  ParallelizeOptions,
  ParallelFtEstimate,
} from './core/qpu/commutation-ft.js';
export { AgentManager } from './core/agent-manager.js';
export {
  PlatformError,
  SecurityViolationError,
  ConfigurationError,
  StateError,
  SchedulingError,
  MechanismError,
  InfeasibleProblemError,
  QuantumEngineError,
  BackendError,
  ToolError,
  FtqcDeferredError,
  QuantumEstimateError,
  NumericDomainError,
  MessageValidationError,
  DateValidationError,
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
  AgentPublicState,
  CompoundSimFacts,
} from './core/compound-brain.js';
// 08#11：CompoundBrain 的实验驱动器（simulateBatch/misreport 的实验
// 面迁出核心机制类后的正式入口）
export { CompoundBrainSimulator } from './core/compound-brain-simulator.js';
export type { CompoundBrainSimulatorOptions } from './core/compound-brain-simulator.js';
// —— R14 创新波 opt-in：优化器精确梯度族与机制变体 ——
export {
  twoEigenvalueShift,
  perQubitShiftedBetas,
  fullspaceLayerMixerGradient,
  subspaceMixerGap,
  refineAnglesByExactGradient,
} from './core/parameter-shift.js';
export type {
  MixerAngleSpec,
  GradientRefineOptions,
  GradientRefineResult,
} from './core/parameter-shift.js';
export {
  DEFAULT_NATURAL_DAMPING,
  fubiniStudyMetric,
  dampedNaturalDirection,
  refineAnglesByNaturalGradient,
} from './core/natural-gradient.js';
// R16：精确余弦坐标极小化（两值谱混合器的单余弦定理——三点定弦、闭式全局
// 极小、零步长超参；opt-in，未接默认求解路径）
export {
  refineAnglesByExactCosine,
  fitCosine,
  cosineSampleBetas,
  cosineMinimumInBounds,
  cosineValueAt,
} from './core/exact-cosine-coordinate.js';
export type {
  CosineFit,
  SamplePlacement,
  ExactCosineOptions,
  ExactCosineResult,
} from './core/exact-cosine-coordinate.js';
export type {
  StateAmplitudes,
  NaturalMixerSpec,
  FubiniStudyMetricResult,
  NaturalGradientOptions,
  NaturalGradientResult,
} from './core/natural-gradient.js';
export { allocateWithReserve, reserveOfCapability } from './core/reserve-price-vcg.js';
export type {
  ReservePriceAgent,
  ReserveSchedule,
  ReservePriceAllocation,
} from './core/reserve-price-vcg.js';
export {
  BayesianHireBrain,
  DEFAULT_BAYESIAN_HIRE_CONFIG,
} from './proactive-intelligence/bayesian-hire-brain.js';
export {
  lgamma,
  logBeta,
  betaCdf,
  betaQuantile,
} from './proactive-intelligence/beta-distribution.js';
// R18 创新波 opt-in：混合 SPRT 序贯校准门与证据门控探索系数反馈环
export {
  SprtCalibrationGate,
  DEFAULT_SPRT_COMPONENTS,
  DEFAULT_SPRT_GATE_CONFIG,
  bonferroniTypeOne,
  sprtTypeOneUpperBound,
} from './proactive-intelligence/sprt-calibration-gate.js';
export type {
  SprtComponent,
  SprtGateConfig,
  SprtDecision,
  SprtGateSnapshot,
} from './proactive-intelligence/sprt-calibration-gate.js';
export {
  EvidenceGatedExploration,
  ExplorationBudgetLedger,
  sigmaBound,
  explorationBudgetBound,
  DEFAULT_EVIDENCE_GATED_EXPLORATION_CONFIG,
} from './proactive-intelligence/evidence-gated-exploration.js';
export type {
  EvidenceGatedExplorationConfig,
  ExplorationFeedbackInputs,
  ExplorationCoefficient,
} from './proactive-intelligence/evidence-gated-exploration.js';
export { ToolCapabilityPolicy } from './tools/tool-capability-policy.js';
export type {
  CapabilityKind,
  ToolCapability,
  ToolCapabilityDeclaration,
  CapabilityDecision,
} from './tools/tool-capability-policy.js';
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
// Date 字段的入站复活帮助函数（DTO 语义见 quantum-types.ts 文件头）：
// WebSocket/HTTP 边界反序列化后 timestamp 等字段运行时是 string，
// 需要真实 Date 的消费方经此复活
export { reviveDate, reviveDateRequired } from './types/quantum-types.js';
export type { DateLike } from './types/quantum-types.js';

// CLI 入口已抽离至 src/cli.ts（08#53）：本文件是纯库出口（零进程
// 副作用——import 本模块不再携带信号监听/argv 探测面），可执行装配
// （bin / npm start）在 cli.ts。

export default QuantumMultiAgentPlatform;
