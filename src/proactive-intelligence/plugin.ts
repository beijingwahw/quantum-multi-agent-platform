/**
 * 主动智能主插件：监控器/决策引擎/执行器/市场 Brain 的装配与事件编排
 * （事件批处理决策、执行结果回流、状态快照）。拆分自 index.ts。
 */

import { EventEmitter } from 'events';
import type {
  ActionExecution,
  DecisionContext,
  Metrics,
  MonitorEvent,
  PolicyConfig,
  Rule,
} from './types';
import { StateMonitor, type StateMonitorConfig, type MonitorStatistics } from './monitor';
import { DecisionEngine } from './decision-engine';
import { ActionExecutor } from './executor';
import {
  GrowthSchedulerBrain,
  type MarketBrain,
  type GrowthAgentSpec,
  type GrowthSchedulerConfig,
} from './brain';
import { StateError } from '../utils/errors';

/** 插件配置：各组件配置透传；brain 为市场大脑（实例或调度器配置，duck typing 识别） */
export interface ProactiveIntelligencePluginConfig {
  monitor?: StateMonitorConfig;
  /** 决策引擎配置（当前未消费，预留扩展） */
  engine?: Record<string, unknown>;
  executor?: Partial<PolicyConfig>;
  brain?: MarketBrain | Partial<GrowthSchedulerConfig>;
  /** 初始市场参与者（config.brain 存在时经 registerAgent 注册） */
  brainAgents?: GrowthAgentSpec[];
}

/** 插件状态快照（getCurrentState 产出，注入规则条件的 currentState） */
interface CurrentSystemState {
  timestamp: Date;
  monitorStats: MonitorStatistics;
  engineMetrics: Metrics;
  executorConfig: PolicyConfig;
  runningExecutions: ActionExecution[];
  /** 运行中动作数（标量：规则可直接做数值比较，数组不能） */
  runningExecutionCount: number;
  /** 最近一条 task 事件的载荷摘要（无任务事件时为 null）——
   *  供 taskTimeoutRule/taskRetryRule 等读取 task.duration / task.retryCount */
  task: Record<string, unknown> | null;
  brain: object | null;
}

/** 插件聚合统计信息 */
export interface PluginStatistics {
  monitor: MonitorStatistics;
  engine: Metrics;
  executor: {
    running: number;
    history: number;
  };
  running: boolean;
}

export class ProactiveIntelligencePlugin extends EventEmitter {
  private monitor: StateMonitor;
  private engine: DecisionEngine;
  private executor: ActionExecutor;
  private brain: MarketBrain | null = null;
  private running: boolean = false;
  /** 决策批处理：同一 tick 内的事件合并为一次决策（修复决策风暴） */
  private decisionScheduled = false;
  private pendingEvents: MonitorEvent[] = [];

  constructor(config: ProactiveIntelligencePluginConfig = {}) {
    super();

    this.monitor = new StateMonitor(config.monitor);
    this.engine = new DecisionEngine(config.engine);
    this.executor = new ActionExecutor(config.executor);

    // 市场 Brain（duck typing）：config.brain 可以是
    //   1. MarketBrain 实例（如 CompoundBrain）——直接接入；
    //   2. GrowthSchedulerBrain 的调度器配置——按配置构造默认增长市场。
    // config.brainAgents 为初始 agent（经 brain.registerAgent 注册）。
    if (config.brain) {
      this.brain =
        typeof (config.brain as MarketBrain).submitTask === 'function'
          ? (config.brain as MarketBrain)
          : new GrowthSchedulerBrain(config.brain as Partial<GrowthSchedulerConfig>);
      const brain = this.brain;
      if (brain) {
        for (const agent of config.brainAgents ?? []) {
          brain.registerAgent?.(agent);
        }
      }
    }

    // 设置事件监听
    this.setupEventHandlers();
  }

  /** 设置事件处理器 */
  private setupEventHandlers(): void {
    // 事件转发：引擎/执行器事件统一冒泡到插件——外部监听者
    // plugin.on('rule_triggered'|'action_completed'|...) 由此生效
    // （修复：此前这些事件只在内部对象上发出，插件层监听永不触发）
    for (const name of ['rule_added', 'rule_removed', 'rule_triggered', 'decision_made'] as const) {
      this.engine.on(name, (...args: unknown[]) => this.emit(name, ...args));
    }
    for (const name of [
      'action_started',
      'action_completed',
      'action_failed',
      'action_cancelled',
      'command_executing',
      'notification_sent',
      'workflow_started',
      'market_allocation',
      'config_updated',
    ] as const) {
      this.executor.on(name, (...args: unknown[]) => this.emit(name, ...args));
    }

    // 执行结果回流决策引擎（修复执行指标恒 0）
    this.executor.on('action_completed', (execution) => {
      this.engine.recordExecution(execution);
    });
    this.executor.on('action_failed', (execution) => {
      this.engine.recordExecution(execution);
    });
    // 取消同样计入执行统计（按失败口径），否则指标漏项
    this.executor.on('action_cancelled', (execution) => {
      this.engine.recordExecution(execution);
    });

    // 监控器发出事件时，合并同 tick 事件后统一触发一次决策
    // （修复：此前每个事件立即全量决策，事件风暴下重复决策且 O(n·m) 评估）
    this.monitor.on('event', (event: MonitorEvent) => {
      if (!this.running) return;

      this.pendingEvents.push(event);
      if (this.decisionScheduled) return;
      this.decisionScheduled = true;

      setImmediate(() => {
        this.decisionScheduled = false;
        const batch = this.pendingEvents;
        this.pendingEvents = [];
        void this.processEventBatch(batch);
      });
    });
  }

  /** 处理一批事件：规则决策 + Brain 市场分配 */
  private async processEventBatch(batch: MonitorEvent[]): Promise<void> {
    try {
      const context: DecisionContext = {
        events: this.monitor.getEvents(),
        currentState: this.getCurrentState(),
        history: this.engine.getDecisionHistory(10),
        rules: this.engine.getAllRules(),
      };

      const actions = await this.engine.makeDecision(context);

      // Brain 市场决策：task_request 事件提交增长市场（VCG 定价 + 学习资本）
      if (this.brain) {
        for (const event of batch) {
          if (event.type !== 'task_request' || !event.data?.capability) continue;
          const assignment = this.brain.submitTask(String(event.data.capability));
          if (assignment) {
            const brainActions = actions.get('brain') ?? [];
            brainActions.push({
              type: 'assignment',
              name: 'market_allocate',
              parameters: { assignment },
            });
            actions.set('brain', brainActions);
          }
        }
      }

      // 执行所有动作
      for (const [ruleId, ruleActions] of actions.entries()) {
        for (const action of ruleActions) {
          try {
            await this.executor.executeAction(ruleId, action);
          } catch (error) {
            this.emit('action_error', { ruleId, action, error });
          }
        }
      }
    } catch (error) {
      this.emit('decision_error', error);
    }
  }

  /** 获取当前状态（含 Brain 市场状态，供规则条件 'brain.*' 联动） */
  private getCurrentState(): CurrentSystemState {
    // 最近一条任务事件载荷：任务类规则（超时/重试）的数据源。
    // 此前规则读 state 'task.*' 而状态里从无 task 键，条件恒为 NaN 不成立。
    const latestTaskEvent = [...this.monitor.getEvents()].reverse().find((e) => e.type === 'task');

    return {
      timestamp: new Date(),
      monitorStats: this.monitor.getStatistics(),
      engineMetrics: this.engine.getMetrics(),
      executorConfig: this.executor.getConfig(),
      runningExecutions: this.executor.getRunningExecutions(),
      runningExecutionCount: this.executor.getRunningExecutions().length,
      task: latestTaskEvent ? latestTaskEvent.data : null,
      brain: this.brain ? this.brain.getState() : null,
    };
  }

  /** 启动插件 */
  async start(): Promise<void> {
    if (this.running) {
      throw new StateError('Plugin is already running');
    }

    this.running = true;
    this.emit('started');
  }

  /** 停止插件 */
  async stop(): Promise<void> {
    if (!this.running) return;

    this.running = false;

    // 等待所有运行中的动作完成或超时
    const running = this.executor.getRunningExecutions();
    for (const execution of running) {
      this.executor.cancelExecution(execution.id);
    }

    this.emit('stopped');
  }

  /** 添加规则 */
  addRule(rule: Rule): void {
    this.engine.addRule(rule);
  }

  /** 移除规则 */
  removeRule(ruleId: string): boolean {
    return this.engine.removeRule(ruleId);
  }

  /** 观察事件 */
  observe(event: Omit<MonitorEvent, 'id' | 'timestamp'>): MonitorEvent {
    return this.monitor.observe(event);
  }

  /** 获取统计信息 */
  getStatistics(): PluginStatistics {
    return {
      monitor: this.monitor.getStatistics(),
      engine: this.engine.getMetrics(),
      executor: {
        running: this.executor.getRunningExecutions().length,
        history: this.executor.getExecutionHistory().length,
      },
      running: this.running,
    };
  }

  /** 获取监控器 */
  getMonitor(): StateMonitor {
    return this.monitor;
  }

  /** 获取决策引擎 */
  getEngine(): DecisionEngine {
    return this.engine;
  }

  /** 获取执行器 */
  getExecutor(): ActionExecutor {
    return this.executor;
  }

  /**
   * 获取市场 Brain（未配置时为 null）。可能是 GrowthSchedulerBrain
   * 或外部接入的任意 MarketBrain 实例（如 CompoundBrain）。
   */
  getBrain(): MarketBrain | null {
    return this.brain;
  }

  /**
   * 向 Brain 注册 agent（市场参与者：能力 / 私有成本 / 私有质量）。
   * spec 形状由具体 Brain 定义（GrowthAgentSpec / CompoundAgentSpec 等）。
   */
  registerBrainAgent(spec: GrowthAgentSpec | Record<string, unknown>): this {
    if (!this.brain) {
      throw new StateError('Brain is not configured (pass config.brain)');
    }
    if (!this.brain.registerAgent) {
      throw new StateError('Brain does not support registerAgent');
    }
    this.brain.registerAgent(spec);
    return this;
  }

  /**
   * 结算 Brain 分配的任务：回写成败，驱动学习曲线与声誉更新。
   * 真实部署中由任务执行方回调；返回 taskId 是否命中在途任务。
   */
  settleTask(taskId: string, success: boolean): boolean {
    if (!this.brain) return false;
    return this.brain.settleTask(taskId, success);
  }
}
