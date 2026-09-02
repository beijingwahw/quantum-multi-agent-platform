import { QuantumScheduler } from './core/quantum-scheduler';
import { AgentManager } from './core/agent-manager';
import { QuantumBus } from './communication/quantum-bus';
import { DSHIntegration } from './dsh/dsh-integration';
import { EventEmitter } from 'events';
import { pathToFileURL } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { setLogLevel } from './utils/logger';
import { Agent, AgentType, TaskPriority, Task, QuantumMessage, MessageType } from './types/quantum-types';

// 深合并配置：保留各层级默认值，仅覆盖用户显式传入的字段
function deepMerge<T extends Record<string, any>>(defaults: T, override: Record<string, any>): T {
  const result: Record<string, any> = { ...defaults };
  for (const key of Object.keys(override)) {
    if (
      override[key] &&
      typeof override[key] === 'object' &&
      !Array.isArray(override[key]) &&
      defaults[key] &&
      typeof (defaults as Record<string, any>)[key] === 'object' &&
      !Array.isArray((defaults as Record<string, any>)[key])
    ) {
      result[key] = deepMerge((defaults as Record<string, any>)[key], override[key]);
    } else {
      result[key] = override[key];
    }
  }
  return result as T;
}

const DEFAULT_CONFIG = {
  logLevel: 'info' as const,
  scheduling: {
    quantumAlgorithm: 'hybrid' as const,
    maxConcurrentTasks: 100,
    taskTimeout: 30000,
    sweepInterval: 5000,
    loadBalancingStrategy: 'capability-based' as const,
    maxHistorySize: 10000
  },
  communication: {
    heartbeatInterval: 5000,
    messageTtl: 60000,
    quantumRange: 100,
    maxMessageSize: 1048576,
    maxQueuedMessages: 1000,
    port: 8080
  },
  dsh: {
    apiEndpoint: 'http://localhost:3080',
    apiTimeout: 10000,
    toolIntegration: true,
    workflowEngine: true
  },
  performance: {
    maxAgentCount: 1000,
    taskQueueSize: 1000,
    metricsInterval: 10000,
    retentionDays: 30,
    retentionMs: 30 * 24 * 3600 * 1000
  }
};

export class QuantumMultiAgentPlatform extends EventEmitter {
  public readonly scheduler: QuantumScheduler;
  public readonly agentManager: AgentManager;
  public readonly quantumBus: QuantumBus;
  public readonly dshIntegration: DSHIntegration;
  public readonly config: any;
  private isRunning: boolean = false;
  private metricsInterval: NodeJS.Timeout | null = null;
  private snapshotTimer: NodeJS.Timeout | null = null;

  constructor(config: any = {}) {
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
      this.quantumBus.createBroadcastMessage(agent.id, 'agent_status', {
        agentId: agent.id,
        name: agent.name,
        status: 'registered'
      } as any, 'low');
    });

    this.agentManager.on('agent_unregistered', (agent: Agent) => {
      this.scheduler.unregisterAgent(agent.id);
      this.quantumBus.createBroadcastMessage(agent.id, 'agent_status', {
        agentId: agent.id,
        name: agent.name,
        status: 'unregistered'
      } as any, 'low');
    });

    // Task调度事件（负载已由调度器维护，此处仅通知）
    this.scheduler.on('task_assigned', ({ taskId, agentId }) => {
      this.quantumBus.createMessage(agentId, 'task_assignment', {
        taskId,
        message: 'New task assigned'
      });
      this.broadcastConsoleSnapshot();
    });

    this.scheduler.on('task_completed', ({ taskId, task }) => {
      this.quantumBus.createBroadcastMessage('scheduler', 'task_completed' as MessageType, {
        taskId,
        taskName: task.name,
        duration: task.actualDuration
      });
      this.broadcastConsoleSnapshot();
    });

    this.scheduler.on('task_failed', ({ taskId, task }) => {
      this.quantumBus.createBroadcastMessage('scheduler', 'task_failed' as MessageType, {
        taskId,
        taskName: task.name
      });
      this.broadcastConsoleSnapshot();
    });

    // DSH集成事件
    this.dshIntegration.on('initialized', () => {
      console.log('[QuantumPlatform] DSH Integration initialized');
    });

    // 控制台协议：快照查询与远程命令
    this.quantumBus.on('console_query', ({ respond }: any) => {
      respond(this.buildConsoleSnapshot());
    });

    this.quantumBus.on('console_command', ({ action, payload }: any) => {
      this.handleConsoleCommand(action, payload);
    });
  }

  // 控制台协议实现
  buildConsoleSnapshot(): any {
    // 任务只取最近一批：广播成本不随历史任务总量增长
    const recentTasks = this.getTasks().slice(-200);
    return {
      timestamp: new Date().toISOString(),
      agents: this.getAgents().map(agent => ({
        id: agent.id,
        name: agent.name,
        type: agent.type,
        state: agent.state,
        load: agent.load,
        capabilities: agent.capabilities,
        entanglementCount: agent.quantumEntanglement.length
      })),
      tasks: recentTasks.map(task => ({
        id: task.id,
        name: task.name,
        type: task.type,
        status: task.status,
        priority: task.priority,
        assignedAgentId: task.assignedAgentId || null,
        createdAt: task.createdAt
      })),
      metrics: this.getSystemMetrics()
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
        this.quantumBus.createBroadcastMessage('platform', 'status_update', this.buildConsoleSnapshot());
      }
    }, 100);

    // 不阻止进程退出
    (this.snapshotTimer as any).unref?.();
  }

  handleConsoleCommand(action: string, payload: any): void {
    try {
      switch (action) {
        case 'submit_task': {
          const task = this.submitTask({
            name: payload?.name || 'Console Task',
            type: 'console',
            priority: payload?.priority || 'medium',
            requirements: []
          });
          console.log(`[QuantumPlatform] Console command: task submitted (${task.id})`);
          break;
        }
        case 'add_agent': {
          const agent = this.registerAgent({
            name: payload?.name || `Console Agent ${Date.now() % 10000}`,
            type: 'custom',
            capabilities: payload?.capabilities || ['custom_task']
          });
          console.log(`[QuantumPlatform] Console command: agent added (${agent.name})`);
          break;
        }
        case 'complete_task': {
          if (payload?.taskId) {
            this.completeTask(payload.taskId, payload?.success !== false);
          }
          break;
        }
        default:
          console.warn(`[QuantumPlatform] Unknown console command: ${action}`);
      }
    } finally {
      // 命令执行后广播最新快照，所有已连接的控制台同步刷新
      this.broadcastConsoleSnapshot();
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    try {
      console.log('[QuantumPlatform] Starting Quantum Multi-Agent Platform...');

      // 启动通信总线（占用端口）
      await this.quantumBus.start();

      // 启动DSH集成
      await this.dshIntegration.initialize();

      // 注册系统agents
      this.registerSystemAgents();

      // 启动系统监控
      this.metricsInterval = setInterval(() => {
        this.reportMetrics();
      }, this.config.performance.metricsInterval);

      this.isRunning = true;
      this.emit('started');
      console.log('[QuantumPlatform] Quantum Multi-Agent Platform started successfully');
    } catch (error) {
      console.error('[QuantumPlatform] Failed to start:', error);
      throw error;
    }
  }

  stop(): void {
    if (!this.isRunning) return;

    console.log('[QuantumPlatform] Stopping Quantum Multi-Agent Platform...');

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
    this.isRunning = false;
    this.emit('stopped');
    
    console.log('[QuantumPlatform] Quantum Multi-Agent Platform stopped');
  }

  private registerSystemAgents(): void {
    // 注册开发agent
    const developerAgent = this.agentManager.registerAgent({
      name: 'Quantum Developer',
      type: 'developer',
      capabilities: ['code_analysis', 'debugging', 'refactoring', 'testing'],
      position: { x: 0, y: 0, z: 0 }
    });

    // 注册测试agent
    const testerAgent = this.agentManager.registerAgent({
      name: 'Quantum Tester',
      type: 'tester',
      capabilities: ['unit_testing', 'integration_testing', 'performance_testing', 'debugging'],
      position: { x: 1, y: 0, z: 0 }
    });

    // 部署agent
    const deployerAgent = this.agentManager.registerAgent({
      name: 'Quantum Deployer',
      type: 'deployer',
      capabilities: ['deployment', 'monitoring', 'rollback', 'scaling'],
      position: { x: 0, y: 1, z: 0 }
    });

    // 监控agent
    const monitorAgent = this.agentManager.registerAgent({
      name: 'Quantum Monitor',
      type: 'monitor',
      capabilities: ['performance_monitoring', 'health_check', 'alerting', 'logging'],
      position: { x: 1, y: 1, z: 0 }
    });

    // 创建量子纠缠
    this.agentManager.createEntanglement(developerAgent.id, testerAgent.id);
    this.agentManager.createEntanglement(testerAgent.id, deployerAgent.id);
    this.agentManager.createEntanglement(deployerAgent.id, monitorAgent.id);

    console.log('[QuantumPlatform] System agents registered');
  }

  // Public API
  submitTask(task: {
    name: string;
    type: string;
    priority: TaskPriority;
    requirements?: any[];
    dependencies?: string[];
    estimatedDuration?: number;
  }): Task {
    const fullTask: Task = {
      ...task,
      id: uuidv4(),
      requirements: task.requirements || [],
      dependencies: task.dependencies || [],
      estimatedDuration: task.estimatedDuration || 60000,
      actualDuration: 0,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      quantumState: {
        id: uuidv4(),
        amplitude: 1,
        phase: Math.random() * 2 * Math.PI,
        collapsed: false,
        position: { 
          x: Math.random(), 
          y: Math.random(), 
          z: Math.random() 
        }
      }
    };

    return this.scheduler.submitTask(fullTask);
  }

  // 任务完成/失败的统一入口
  completeTask(taskId: string, success: boolean = true, result?: any): boolean {
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

  async executeDSHTool(toolName: string, parameters: any, agentId?: string): Promise<any> {
    return await this.dshIntegration.executeTool(toolName, parameters, agentId);
  }

  async executeDSHWorkflow(workflowId: string, agentId?: string): Promise<any> {
    return await this.dshIntegration.executeWorkflow(workflowId, agentId);
  }

  // Monitoring and Metrics
  getSystemMetrics(): any {
    return {
      scheduler: this.scheduler.getSystemMetrics(),
      agents: this.agentManager.getAgentMetrics(),
      bus: this.quantumBus.getMetrics(),
      dsh: this.dshIntegration.getMetrics(),
      health: this.agentManager.checkSystemHealth()
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
    console.log(`[QuantumPlatform] Metrics:`, {
      timestamp: new Date().toISOString(),
      agents: metrics.agents,
      tasks: metrics.scheduler,
      health: metrics.health
    });
    this.broadcastConsoleSnapshot();
  }
}

// 导出主要类和接口
export { QuantumScheduler } from './core/quantum-scheduler';
export type { QuantumSchedulerConfig, QuantumAlgorithm, QuantumEngineConfig, QuantumBatchReport } from './core/quantum-scheduler';
export {
  QuantumStateVector, qaoaSolve, annealSolve, bruteForceOptimum,
  defaultPenalties, couplingKey, toIsing, computeEnergies,
  decodeAssignment, isValidAssignment, welfareOf
} from './core/quantum-optimizer';
export type {
  AssignmentProblem, QuantumSolverOptions, QuantumSolution, QuantumCandidate,
  QuantumEngineKind, CollapseMode, ProblemEnergies, IsingModel, BruteForceResult
} from './core/quantum-optimizer';
export {
  buildSubspaceModel, qaoaSolveSubspace, annealSolveSubspace, SubspaceState
} from './core/subspace-optimizer';
export type { SubspaceModel, SubspaceSolution, SubspaceBuildOptions } from './core/subspace-optimizer';
export { hungarianAssignment, localSearchAssignment } from './core/classical-baselines';
export { LocalQuantumBackend, registerBackend, getBackend, listBackends } from './core/qpu/quantum-backend';
export type { QuantumBackend, QpuSampleSet, QpuSolveOptions } from './core/qpu/quantum-backend';
export { DWaveBackend } from './core/qpu/dwave-backend';
export type { DWaveConfig } from './core/qpu/dwave-backend';
export { solveAssignmentOnBackend } from './core/qpu/solve';
export type { QpuAssignmentResult } from './core/qpu/solve';
export { toQiskitProgram } from './core/qpu/qiskit-export';
export type { QiskitExportOptions } from './core/qpu/qiskit-export';
export { AgentManager } from './core/agent-manager';
export { QuantumBus } from './communication/quantum-bus';
export { DSHIntegration } from './dsh/dsh-integration';
export { GrowthMarketScheduler, DEFAULT_GROWTH_CONFIG } from './core/growth-market-scheduler';
export type {
  GrowthAgentSpec,
  GrowthSchedulerConfig,
  AllocationPolicy,
  TaskAssignment,
  SettlementResult,
  AgentSnapshot
} from './core/growth-market-scheduler';
export { BatchVCGScheduler, BudgetPacer, DEFAULT_BATCH_CONFIG } from './core/batch-vcg-scheduler';
export { CompoundBrain, DEFAULT_COMPOUND_CONFIG, lawKMin, lawDeltaMax } from './core/compound-brain';
export type {
  CompoundAgentSpec,
  CompoundTaskSpec,
  CompoundConfig,
  CompoundAllocation,
  CompoundAssignment,
  Settlement,
  CalibrationReport,
  CapabilityAdvice,
  IncubationAdvice
} from './core/compound-brain';
export { GrowthSchedulerBrain } from './proactive-intelligence/brain';
export type { BrainState } from './proactive-intelligence/brain';
export { ProactiveIntelligencePlugin } from './proactive-intelligence/index';
export type {
  MonitorEvent,
  DecisionContext,
  Rule,
  Condition,
  Action,
  ActionExecution,
  PolicyConfig,
  Metrics
} from './proactive-intelligence/index';
export type {
  BatchAgentSpec,
  BatchVCGConfig,
  BatchAllocation,
  BatchAssignment,
  BatchSettlement
} from './core/batch-vcg-scheduler';

// 导出类型
export type { Agent, AgentType, Task, TaskPriority, QuantumMessage } from './types/quantum-types';

// CLI入口（Windows路径兼容）
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const platform = new QuantumMultiAgentPlatform();
  
  // 启动平台
  platform.start().catch(console.error);

  // 监听中断信号
  process.on('SIGINT', () => {
    console.log('\n[QuantumPlatform] Received SIGINT, shutting down...');
    platform.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n[QuantumPlatform] Received SIGTERM, shutting down...');
    platform.stop();
    process.exit(0);
  });
}

export default QuantumMultiAgentPlatform;
