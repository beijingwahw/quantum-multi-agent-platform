/**
 * 主动智能主插件：监控器/决策引擎/执行器/市场 Brain 的装配与事件编排
 * （事件批处理决策、执行结果回流、状态快照）。拆分自 index.ts。
 */

import { EventEmitter } from 'events';
import type {
  Action,
  ActionExecution,
  DecisionContext,
  Metrics,
  MonitorEvent,
  PolicyConfig,
  Rule,
} from './types.js';
import { StateMonitor, type StateMonitorConfig, type MonitorStatistics } from './monitor.js';
import { DecisionEngine } from './decision-engine.js';
import { ActionExecutor } from './executor.js';
import {
  GrowthSchedulerBrain,
  type MarketBrain,
  type GrowthAgentSpec,
  type GrowthSchedulerConfig,
  type BrainState,
} from './brain.js';
import { StateError } from '../utils/errors.js';

/**
 * 决策上下文的事件窗口上界（02#23 remainder）：决策引擎只消费事件流
 * 尾部（extractEventValue 对各事件类型从尾部取最新一条、决策历史只留
 * 尾部快照），而每批决策都全量拷贝监控缓冲（getCurrentState 路径的
 * events: getEvents()）使快照成本随缓冲规模线性增长。此处把拷贝限定
 * 为最近 STATE_EVENT_WINDOW 条：规则可见「窗口内某类型的最新事件」；
 * 被 >200 条异质事件洪峰挤到窗口外的旧类型事件对事件条件不再可见——
 * 这是 bounded-copy 的显式取舍（状态类条件与 brain.* 字段不受影响）。
 */
const STATE_EVENT_WINDOW = 200;

/** 插件配置：各组件配置透传；brain 为市场大脑（实例或调度器配置） */
export interface ProactiveIntelligencePluginConfig {
  monitor?: StateMonitorConfig;
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
  /** 市场 Brain 公开状态（GrowthSchedulerBrain 为 BrainState；
   *  其他 MarketBrain 实现的形状由其 getState 决定，规则按 'brain.*'
   *  动态路径读取） */
  brain: BrainState | Record<string, unknown> | null;
}

/** 插件聚合统计信息 */
export interface PluginStatistics {
  monitor: MonitorStatistics;
  engine: Metrics;
  executor: {
    running: number;
    history: number;
    /** 待执行动作队列深度（优先级池的背压指标） */
    backlog: number;
  };
  running: boolean;
}

export class ProactiveIntelligencePlugin extends EventEmitter {
  private monitor: StateMonitor;
  private engine: DecisionEngine;
  private executor: ActionExecutor;
  private brain: MarketBrain | null = null;
  private running = false;
  /** 决策批处理：同一 tick 内的事件合并为一次决策（修复决策风暴） */
  private decisionScheduled = false;
  private pendingEvents: MonitorEvent[] = [];
  /** 在途决策批数（flush 的确定性等待依据） */
  private inFlightBatches = 0;
  /** 待执行动作队列深度（背压可观测：事件风暴下的堆积量） */
  private actionBacklog = 0;
  /**
   * ruleId → priority 查表缓存（R13 性能）：原每决策批从 getAllRules()
   * 深拷贝重建 Map——优先级在规则生命周期内不可变（唯一变更途径是
   * addRule 同 id 覆盖，届时引擎发 rule_added），缓存随 rule_added/
   * rule_removed 失效即与实时值恒等。
   */
  private rulePriorityCache: Map<string, number> | null = null;

  constructor(config: ProactiveIntelligencePluginConfig = {}) {
    super();

    this.monitor = new StateMonitor(config.monitor);
    this.engine = new DecisionEngine();
    this.executor = new ActionExecutor(config.executor);

    // 市场 Brain 判别：config.brain 可以是
    //   1. MarketBrain 实例（如 CompoundBrain）——直接接入；
    //   2. GrowthSchedulerBrain 的调度器配置——按配置构造默认增长市场。
    // 判别不再只看 submitTask 一个键（配置对象恰有同名键即被误判为
    // Brain 实例；缺键的部分实现会静默退化为新建默认市场）：
    // 三个核心方法齐全 → 实例；一个都没有 → 配置对象；部分具备 →
    // 立即抛错（半成品 Brain 静默换芯比失败更危险）。
    // config.brainAgents 为初始 agent（经 brain.registerAgent 注册）。
    if (config.brain) {
      this.brain =
        this.resolveBrain(config.brain) ??
        new GrowthSchedulerBrain(config.brain as Partial<GrowthSchedulerConfig>);
      for (const agent of config.brainAgents ?? []) {
        this.brain.registerAgent?.(agent);
      }
    }

    // 设置事件监听
    this.setupEventHandlers();
  }

  /**
   * Brain 实例 / 调度器配置判别（见构造器注释）。
   * 返回 null 表示候选是纯配置对象，应按默认增长市场构造。
   */
  private resolveBrain(
    candidate: MarketBrain | Partial<GrowthSchedulerConfig>,
  ): MarketBrain | null {
    const required = ['submitTask', 'settleTask', 'getState'] as const;
    const missing = required.filter(
      (key) => typeof (candidate as Record<string, unknown>)[key] !== 'function',
    );
    if (missing.length === 0) return candidate as MarketBrain;
    if (missing.length === required.length) return null;
    throw new StateError(
      `config.brain has a partial MarketBrain shape (missing ${missing.join(', ')}); ` +
        'pass a complete MarketBrain instance or a plain GrowthSchedulerConfig object',
    );
  }

  /** 设置事件处理器 */
  private setupEventHandlers(): void {
    // 事件转发：引擎/执行器事件统一冒泡到插件——外部监听者
    // plugin.on('rule_triggered'|'action_completed'|...) 由此生效
    // （修复：此前这些事件只在内部对象上发出，插件层监听永不触发）
    for (const name of ['rule_added', 'rule_removed', 'rule_triggered', 'decision_made'] as const) {
      this.engine.on(name, (...args: unknown[]) => this.emit(name, ...args));
    }
    // 优先级查表缓存失效：规则增删（含同 id 覆盖改优先级）后重建。
    // toggleRule 只改 enabled 不改 priority，无需失效
    this.engine.on('rule_added', () => {
      this.rulePriorityCache = null;
    });
    this.engine.on('rule_removed', () => {
      this.rulePriorityCache = null;
    });
    for (const name of [
      'action_started',
      'action_completed',
      'action_failed',
      'action_rejected',
      'action_skipped',
      'action_cancelled',
      'command_executing',
      'notification_sent',
      'workflow_started',
      'market_allocation',
      'config_updated',
    ] as const) {
      this.executor.on(name, (...args: unknown[]) => this.emit(name, ...args));
    }

    // 执行结果回流决策引擎（修复执行指标恒 0）。
    // rejected/skipped 同样回流但计入独立字段——它们既非成功也非失败。
    this.executor.on('action_completed', (execution: ActionExecution) => {
      this.engine.recordExecution(execution);
    });
    this.executor.on('action_failed', (execution: ActionExecution) => {
      this.engine.recordExecution(execution);
    });
    this.executor.on('action_rejected', (execution: ActionExecution) => {
      this.engine.recordExecution(execution);
    });
    this.executor.on('action_skipped', (execution: ActionExecution) => {
      this.engine.recordExecution(execution);
    });
    // 取消同样计入执行统计（按失败口径），否则指标漏项
    this.executor.on('action_cancelled', (execution: ActionExecution) => {
      this.engine.recordExecution(execution);
    });

    // 监控器发出事件时，合并同 tick 事件后统一触发一次决策
    // （修复：此前每个事件立即全量决策，事件风暴下重复决策且 O(n·m) 评估）
    this.monitor.on('event', (event: MonitorEvent) => {
      // 事件面冒泡（README/QUICKSTART 文档化的 plugin.on('event')）：
      // 与 engine/executor 事件同口径转发到插件层——此前只在内部合并
      // 消费，文档承诺的监听面永不触发
      this.emit('event', event);
      if (!this.running) return;

      this.pendingEvents.push(event);
      if (this.decisionScheduled) return;
      this.decisionScheduled = true;

      setImmediate(() => {
        this.decisionScheduled = false;
        // stop() 是紧急制动：已排队的决策批次在 stop 之后不得再执行动作
        if (!this.running) {
          this.pendingEvents = [];
          return;
        }
        const batch = this.pendingEvents;
        this.pendingEvents = [];
        void this.processEventBatch(batch);
      });
    });
  }

  /** 处理一批事件：规则决策 + Brain 市场分配 */
  private async processEventBatch(batch: MonitorEvent[]): Promise<void> {
    this.inFlightBatches++;
    try {
      try {
        const rules = this.engine.getAllRules();
        // R13：优先级查表走缓存（规则增删时失效重建），首批用同一份
        // 快照建表——值与逐批重建恒等
        const rulePriorityById = (this.rulePriorityCache ??= new Map(
          rules.map((r) => [r.id, r.priority]),
        ));
        const context: DecisionContext = {
          // 02#23 remainder：有界尾部窗口，不再全量拷贝活跃缓冲
          events: this.monitor.getRecentEvents(STATE_EVENT_WINDOW),
          currentState: this.getCurrentState(),
          history: this.engine.getDecisionHistory(10),
          rules,
        };

        const actions = await this.engine.makeDecision(context);

        // Brain 市场决策：task_request 事件提交增长市场（VCG 定价 + 学习资本）
        if (this.brain) {
          for (const event of batch) {
            if (event.type !== 'task_request') continue;
            const capability = event.data.capability;
            if (typeof capability !== 'string' || !capability) continue;
            const assignment = this.brain.submitTask(capability);
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

        // 执行所有动作：优先级感知的有限并发池（P0 修复的创新升级——
        // 原双层 for...await 逐动作串行致吞吐塌陷；朴素池化只保证并发，
        // 这里进一步保证「规则优先级语义在并发下仍然成立」）：
        // - 有效优先级 = 规则优先级 + 等待老化（每等待 1s 折算 +1：
        //   老化使低优先级规则在持续高优先级负载下最终浮出——防饿死
        //   是优先级调度的完备性要求，缺了它「优先级」只是「尽可能插队」；
        //   量级与规则优先级 0-100 匹配，够慢以尊重优先级、够快以在
        //   风暴尺度上防饿死）；
        // - 并发上限与执行器预检共用同一配置值；
        // - 队列深度入统计（背压可观测：风暴下的堆积从指标可见）。
        const entries: Array<{
          ruleId: string;
          action: Action;
          priority: number;
          seq: number;
          enqueuedAt: number;
        }> = [];
        let entrySeq = 0;
        for (const [ruleId, ruleActions] of actions.entries()) {
          const priority = rulePriorityById.get(ruleId) ?? 0;
          for (const action of ruleActions) {
            entries.push({ ruleId, action, priority, seq: entrySeq++, enqueuedAt: Date.now() });
          }
        }
        if (entries.length > 0) {
          const limit = Math.min(this.executor.getConfig().maxConcurrentActions, entries.length);
          /** 取有效优先级最高的待执行项（同分按入队序——FIFO 决胜） */
          const pickNext = (): (typeof entries)[number] | undefined => {
            let bestIndex = -1;
            let bestScore = -Infinity;
            const now = Date.now();
            for (let i = 0; i < entries.length; i++) {
              const e = entries[i];
              if (!e) continue;
              const score = e.priority + (now - e.enqueuedAt) / 1000;
              const better =
                score > bestScore ||
                (score === bestScore && bestIndex >= 0 && e.seq < entries[bestIndex]!.seq);
              if (better) {
                bestScore = score;
                bestIndex = i;
              }
            }
            if (bestIndex < 0) return undefined;
            const [picked] = entries.splice(bestIndex, 1);
            return picked;
          };
          const worker = async (): Promise<void> => {
            for (;;) {
              const entry = pickNext();
              if (!entry) return;
              this.actionBacklog = Math.max(0, this.actionBacklog - 1);
              // stop() 是紧急制动：已出队未启动的动作不再执行（在飞的由
              // stop() 的 cancelExecution 终止）。制动必须覆盖整个动作池——
              // 此前只在批处理调度口拦截，池内排队的动作在 stop 后继续开火
              if (!this.running) return;
              try {
                await this.executor.executeAction(entry.ruleId, entry.action);
              } catch (error) {
                this.emit('action_error', { ruleId: entry.ruleId, action: entry.action, error });
              }
            }
          };
          this.actionBacklog += entries.length;
          const workers: Array<Promise<void>> = [];
          for (let i = 0; i < limit; i++) {
            workers.push(worker());
          }
          await Promise.all(workers);
        }
      } catch (error) {
        this.emit('decision_error', error);
      }
    } finally {
      this.inFlightBatches--;
    }
  }

  /**
   * 确定性冲刷原语：等待全部已排队/在途的决策批次（含动作执行）完成。
   * 测试与集成方以此替代「N 次 setImmediate 魔法数」——后者依赖经验
   * 轮次估计，CI 慢机上少等一轮即间歇失败（多等只是浪费）。
   * 事件驱动等待 + 超时保护，无真实时钟依赖。
   */
  async flush(timeoutMs = 5_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    // 至少让出一个事件循环轮次：observe 的 setImmediate 决策调度得以入队
    await new Promise<void>((resolve) => setImmediate(resolve));
    while (this.decisionScheduled || this.pendingEvents.length > 0 || this.inFlightBatches > 0) {
      if (Date.now() > deadline) {
        throw new StateError(
          `ProactiveIntelligencePlugin.flush() timed out after ${timeoutMs}ms ` +
            `(scheduled=${this.decisionScheduled}, pending=${this.pendingEvents.length}, inFlight=${this.inFlightBatches})`,
        );
      }
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
  }

  /** 获取当前状态（含 Brain 市场状态，供规则条件 'brain.*' 联动） */
  private getCurrentState(): CurrentSystemState {
    // 最近一条任务事件载荷：任务类规则（超时/重试）的数据源。
    // 此前规则读 state 'task.*' 而状态里从无 task 键，条件恒为 NaN 不成立。
    // O(1) 类型索引读取（原为整表拷贝 + reverse 扫描，万级缓冲下每批 O(n)）。
    const latestTaskEvent = this.monitor.getLatestEventByType('task');
    // 快照成本说明（每批一次）：监控统计为增量维护 O(类型数+log n)、
    // 最新任务事件 O(1)、决策历史固定 10 条——快照不再随缓冲区规模线性
    // 扩张；runningExecutions 单次取用复用（此前取两次）。
    const runningExecutions = this.executor.getRunningExecutions();

    return {
      timestamp: new Date(),
      monitorStats: this.monitor.getStatistics(),
      engineMetrics: this.engine.getMetrics(),
      executorConfig: this.executor.getConfig(),
      runningExecutions,
      runningExecutionCount: runningExecutions.length,
      task: latestTaskEvent ? latestTaskEvent.data : null,
      // 形状由具体 Brain 的 getState 决定（MarketBrain 泛型默认 unknown），
      // 插件层无法静态收窄——规则按 'brain.*' 动态路径读取
      brain: (this.brain ? this.brain.getState() : null) as
        BrainState | Record<string, unknown> | null,
    };
  }

  /** 启动插件 */
  start(): Promise<void> {
    if (this.running) {
      throw new StateError('Plugin is already running');
    }

    this.running = true;
    this.emit('started');
    return Promise.resolve();
  }

  /** 停止插件 */
  stop(): Promise<void> {
    if (!this.running) return Promise.resolve();

    this.running = false;
    // 池内未启动的排队动作被紧急制动放弃（worker 见 !running 即返回）：
    // 背压计数同步清零——这些条目不再有人拾取，留着只会永久虚高
    this.actionBacklog = 0;

    // 等待所有运行中的动作完成或超时
    const running = this.executor.getRunningExecutions();
    for (const execution of running) {
      this.executor.cancelExecution(execution.id);
    }

    this.emit('stopped');
    return Promise.resolve();
  }

  /**
   * 彻底销毁插件：解除全部跨组件监听（转发器 ×15、结果回流 ×5、
   * 监控合并器）并清空自身监听者。stop() 只是紧急制动（停止决策），
   * 不释放监听器引用链——组件与插件互相持有的引用会阻止 GC，
   * 且同进程内反复构造插件（如测试）会持续累积到 MaxListeners 阈值。
   */
  destroy(): void {
    this.running = false;
    this.pendingEvents = [];
    this.decisionScheduled = false;

    this.monitor.removeAllListeners();
    this.engine.removeAllListeners();
    this.executor.removeAllListeners();
    this.removeAllListeners();
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
        // R13：长度查询走专用计数（原为 getExecutionHistory().length，
        // 每次统计全量拷贝万级历史数组）
        history: this.executor.getExecutionHistorySize(),
        backlog: this.actionBacklog,
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
