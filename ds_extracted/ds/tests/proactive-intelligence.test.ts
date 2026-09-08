import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ProactiveIntelligencePlugin,
  DecisionEngine,
  type Rule,
  type MonitorEvent,
} from '../src/proactive-intelligence/index.js';
import { GrowthSchedulerBrain } from '../src/proactive-intelligence/brain.js';
import { allPresetRules, getRulesByScenario } from '../src/proactive-intelligence/rules.js';
import { ConfigurationError, PlatformError } from '../src/utils/errors.js';

/** 仅等待事件循环排空（不涉及插件决策队列的同步路径等待） */
function tick(times = 2): Promise<void> {
  return new Promise((resolve) => {
    let n = 0;
    const step = () => (++n >= times ? resolve() : setImmediate(step));
    setImmediate(step);
  });
}

function notificationRule(id: string, conditions: Rule['conditions']): Rule {
  return {
    id,
    name: id,
    description: '',
    enabled: true,
    priority: 50,
    cooldown: 0,
    conditions,
    actions: [{ type: 'notification', name: 'notify', parameters: { title: 't', message: 'm' } }],
  };
}

describe('proactive-intelligence · Bug 修复回归', () => {
  /** Bug A：事件载荷在 event.data，规则字段 'test.value' 必须能读到 data.value */
  it('事件条件从 data 载荷取值（此前预设规则永不触发）', async () => {
    const plugin = new ProactiveIntelligencePlugin();
    plugin.addRule(
      notificationRule('r', [
        { type: 'event', operator: 'greaterThan', field: 'test.value', value: 80 },
      ]),
    );
    await plugin.start();

    // data.value = 85 > 80 → 应触发（decision_made 由 engine 发出）
    plugin.getEngine().on('decision_made', (d: any) => {
      assert.ok(d.triggeredRules.includes('r'), '规则应被触发');
    });

    plugin.observe({ type: 'test', source: 's', data: { value: 85 }, severity: 'info' });
    await plugin.flush();

    const hist = plugin.getExecutor().getExecutionHistory();
    assert.ok(
      hist.some((e) => e.status === 'completed'),
      'data 载径条件应触发规则并执行通知动作',
    );

    await plugin.stop();
  });

  /** Bug B：OR 开头的条件此前被 `true || x` 吞掉（语义：连接词属于其后条件） */
  it('条件链：OR 连接词生效、混合链从左到右', async () => {
    const engine = new DecisionEngine();
    const ctx = {
      events: [] as MonitorEvent[],
      currentState: { a: true, b: false, c: true },
      history: [],
      rules: [],
    };

    // a OR b（OR 挂在 b 上：b 与累计结果的连接词）：a=true → true
    // 旧代码 result 初始化 true，首条件带 OR 时被 `true || x` 吞掉
    engine.addRule(
      notificationRule('or', [
        { type: 'state', operator: 'equals', field: 'a', value: true },
        { type: 'state', operator: 'equals', field: 'b', value: true, logicalOperator: 'OR' },
      ]),
    );
    // a AND b：false
    engine.addRule(
      notificationRule('and', [
        { type: 'state', operator: 'equals', field: 'a', value: true },
        { type: 'state', operator: 'equals', field: 'b', value: true },
      ]),
    );
    const decisions = await engine.makeDecision(ctx);
    assert.ok(decisions.has('or'), 'a OR b 应为 true');
    assert.ok(!decisions.has('and'), 'a AND b 应为 false');

    // (b OR c) AND a：从左到右 → (b||c)=true，再 AND a=true
    const engine2 = new DecisionEngine();
    engine2.addRule(
      notificationRule('mixed', [
        { type: 'state', operator: 'equals', field: 'b', value: true },
        { type: 'state', operator: 'equals', field: 'c', value: true, logicalOperator: 'OR' },
        { type: 'state', operator: 'equals', field: 'a', value: true, logicalOperator: 'AND' },
      ]),
    );
    const d2 = await engine2.makeDecision(ctx);
    assert.ok(d2.has('mixed'), '(b OR c) AND a 应为 true');

    // 短路后条件不干扰：(b AND a) 链上 b=false 提前退出 → false
    const engine3 = new DecisionEngine();
    engine3.addRule(
      notificationRule('short', [
        { type: 'state', operator: 'equals', field: 'b', value: true },
        { type: 'state', operator: 'equals', field: 'a', value: true },
      ]),
    );
    const d3 = await engine3.makeDecision(ctx);
    assert.ok(!d3.has('short'), 'b AND a 应为 false');
  });

  /** Bug C：执行结果回流——completed/failed/平均时长不再恒 0 */
  it('执行指标回流决策引擎', async () => {
    const plugin = new ProactiveIntelligencePlugin();
    await plugin.start();

    plugin.addRule(
      notificationRule('ok', [{ type: 'event', operator: 'equals', field: 'evt.x', value: 1 }]),
    );
    plugin.observe({ type: 'evt', source: 's', data: { x: 1 }, severity: 'info' });
    await plugin.flush();

    const metrics = plugin.getEngine().getMetrics();
    assert.equal(metrics.actionsCompleted, 1, '应记录 1 次完成');
    assert.equal(metrics.actionsFailed, 0);
    assert.equal(metrics.totalActionsExecuted, 1);
    assert.ok(metrics.averageExecutionTime >= 0);

    await plugin.stop();
  });

  /** Bug F：同 tick 多事件合并为一次决策（防决策风暴） */
  it('同 tick 事件风暴只触发一次决策', async () => {
    const plugin = new ProactiveIntelligencePlugin();
    await plugin.start();

    let decisions = 0;
    plugin.getEngine().on('decision_made', () => decisions++);

    for (let i = 0; i < 50; i++) {
      plugin.observe({ type: 'noise', source: 's', data: { i }, severity: 'info' });
    }
    await plugin.flush();

    assert.equal(decisions, 1, `50 个同 tick 事件应合并为 1 次决策，实际 ${decisions}`);
    assert.equal(plugin.getEngine().getMetrics().totalEventsProcessed, 50);

    await plugin.stop();
  });

  /** Bug E：取消的执行写入历史 */
  it('取消的执行进入历史', async () => {
    const plugin = new ProactiveIntelligencePlugin();
    const executor = plugin.getExecutor();

    // 手动造一个在途执行：用自定义 handler 挂起（短超时，避免悬挂）
    const execPromise = executor
      .executeAction('r', {
        type: 'custom',
        name: 'hang',
        parameters: { handler: () => new Promise(() => {}) },
        timeout: 20,
      })
      .catch(() => undefined);
    // 等待进入 running
    await tick(1);

    const running = executor.getRunningExecutions();
    assert.equal(running.length, 1);
    executor.cancelExecution(running[0]!.id);

    const history = executor.getExecutionHistory();
    assert.ok(
      history.some((e) => e.status === 'failed' && e.error?.message === 'Execution cancelled'),
    );
    // 幂等：超时后同 ID 不重复入列
    await execPromise;
    assert.equal(history.filter((e) => e.id === running[0]!.id).length, 1);
  });
});

describe('proactive-intelligence · 入口负对照（静默垃圾路径拒绝）', () => {
  it('observe：畸形 severity/空 type 抛 ConfigurationError，不再污染统计表', () => {
    const plugin = new ProactiveIntelligencePlugin();
    const observe = (severity: unknown, type = 't'): void => {
      plugin.observe({
        type,
        source: 's',
        data: {},
        severity: severity as MonitorEvent['severity'],
      });
    };

    // 畸形 severity 此前以任意字符串键沉淀进 bySeverity 统计
    assert.throws(
      () => observe('catastrophic'),
      (error: unknown) =>
        error instanceof ConfigurationError &&
        error instanceof PlatformError &&
        /Invalid event severity 'catastrophic'/.test(error.message),
    );
    // 空 type 的事件无法被任何 'type.field' 规则匹配却照常计数
    assert.throws(() => observe('info', ''), /Event type must be a non-empty string/);

    // 边界：四档合法 severity 全部可观察，统计无垃圾键
    for (const severity of ['info', 'warning', 'error', 'critical'] as const) {
      observe(severity);
    }
    const stats = plugin.getMonitor().getStatistics();
    assert.equal(stats.total, 4);
    assert.deepEqual(Object.keys(stats.bySeverity).sort(), [
      'critical',
      'error',
      'info',
      'warning',
    ]);
  });

  it('addRule：空 id 与非法 cooldown 抛 ConfigurationError（冷却不得被静默解除）', () => {
    const engine = new DecisionEngine();
    assert.throws(
      () => engine.addRule(notificationRule('', [])),
      /Rule id must be a non-empty string/,
    );
    // NaN cooldown：`elapsed < NaN` 恒假 → 此前规则每轮决策都触发
    assert.throws(
      () => engine.addRule({ ...notificationRule('bad-cooldown', []), cooldown: NaN }),
      (error: unknown) =>
        error instanceof ConfigurationError &&
        /cooldown must be a finite non-negative/.test(error.message),
    );
    assert.throws(
      () => engine.addRule({ ...notificationRule('neg-cooldown', []), cooldown: -1 }),
      /cooldown/,
    );

    // 边界：cooldown=0（无冷却）是合法退化，合法规则照常入库触发
    engine.addRule(
      notificationRule('zero-cooldown', [
        { type: 'state', operator: 'equals', field: 'a', value: 1 },
      ]),
    );
    assert.ok(engine.getRule('zero-cooldown') !== undefined);
  });

  it('getDecisionHistory：limit=0 返回空（不再被 falsy 判定放大成全量），负数拒绝', async () => {
    const engine = new DecisionEngine();
    const ctx = {
      events: [] as MonitorEvent[],
      currentState: {},
      history: [],
      rules: [] as Rule[],
    };
    await engine.makeDecision(ctx);
    await engine.makeDecision(ctx);

    assert.equal(engine.getDecisionHistory(0).length, 0);
    assert.equal(engine.getDecisionHistory(1).length, 1);
    assert.equal(engine.getDecisionHistory().length, 2);
    assert.throws(() => engine.getDecisionHistory(-3), /limit must be a non-negative integer/);
  });

  it('getRulesByScenario：未知场景拒绝，不再静默返回全部规则', () => {
    // 拼写错误此前落入 default 返回 13 条预设规则（静默垃圾路径）
    assert.throws(
      () => getRulesByScenario('secruity'),
      (error: unknown) =>
        error instanceof ConfigurationError &&
        /Unknown rules scenario 'secruity'/.test(error.message),
    );

    // 边界：全部合法场景名（含 'all'）返回不变
    for (const scenario of ['system', 'agent', 'task', 'security', 'business', 'market', 'all']) {
      assert.ok(getRulesByScenario(scenario).length > 0, scenario);
    }
    assert.deepEqual(getRulesByScenario('all'), allPresetRules);
  });
});

describe('proactive-intelligence · 增长调度器 Brain', () => {
  function makePlugin(): ProactiveIntelligencePlugin {
    return new ProactiveIntelligencePlugin({
      brain: { successValue: 10, exploreCoefficient: 0.35, seed: 7 },
      brainAgents: [
        { id: 'a1', capabilities: ['X'], trueCost: 1, trueQuality: { X: 0.6 } },
        { id: 'a2', capabilities: ['X'], trueCost: 2, trueQuality: { X: 0.5 } },
      ],
    });
  }

  /** 感知→分配→执行→结算→学习 的完整闭环 */
  it('task_request 事件 → VCG 分配 → 结算驱动学习资本', async () => {
    const plugin = makePlugin();
    const allocations: any[] = [];
    plugin.getExecutor().on('market_allocation', (a) => allocations.push(a));
    await plugin.start();

    plugin.observe({
      type: 'task_request',
      source: 'orchestrator',
      data: { capability: 'X' },
      severity: 'info',
    });
    await plugin.flush();

    // 分配动作已执行（低成本高质量 a1 应胜出）
    assert.equal(allocations.length, 1);
    assert.equal(allocations[0].winnerId, 'a1');
    assert.ok(allocations[0].payment >= 1, 'IR：支付不低于报价');

    // 结算回写 → 学习资本累积
    const brain = plugin.getBrain() as GrowthSchedulerBrain;
    assert.equal(brain.getState().openTasks, 1);
    assert.ok(plugin.settleTask(allocations[0].taskId, true));
    const state = brain.getState();
    assert.equal(state.openTasks, 0);
    assert.equal(state.settledCount, 1);
    assert.equal(state.successRate, 1);
    const a1 = state.agents.find((s) => s.id === 'a1')!;
    assert.ok((a1.capital['X'] ?? 0) > 0, '结算应累积上下文资本');

    await plugin.stop();
  });

  /** 无人具备能力 → 无分配、不抛错 */
  it('无能力匹配时静默跳过', async () => {
    const plugin = makePlugin();
    await plugin.start();

    let errored = false;
    plugin.on('action_error', () => (errored = true));
    plugin.observe({
      type: 'task_request',
      source: 'o',
      data: { capability: 'UNHEARD-OF' },
      severity: 'info',
    });
    await plugin.flush();

    assert.ok(!errored);
    assert.equal((plugin.getBrain() as GrowthSchedulerBrain).getState().openTasks, 0);

    await plugin.stop();
  });

  /** 规则与 Brain 联动：brain.successRate / settledCount 可被条件读取 */
  it('规则可读取 brain 市场状态（成功率跌破阈值告警）', async () => {
    const plugin = makePlugin();
    plugin.addRule(
      notificationRule('market-bad', [
        { type: 'state', operator: 'greaterThan', field: 'brain.settledCount', value: 3 },
        {
          type: 'state',
          operator: 'lessThan',
          field: 'brain.successRate',
          value: 0.5,
          logicalOperator: 'AND',
        },
      ]),
    );
    await plugin.start();

    // 直接用 brain 模拟 5 单，4 失败 1 成功 → successRate = 0.2
    const brain = plugin.getBrain()!;
    const results: boolean[] = [false, false, true, false, false];
    for (const success of results) {
      const assignment = brain.submitTask('X')!;
      brain.settleTask(assignment.taskId, success);
    }

    let triggered = false;
    plugin.getEngine().on('decision_made', (d: any) => {
      if (d.triggeredRules.includes('market-bad')) triggered = true;
    });
    plugin.observe({ type: 'ping', source: 's', data: {}, severity: 'info' });
    await plugin.flush();

    assert.ok(triggered, 'brain.successRate=0.2 应触发市场退化规则');

    await plugin.stop();
  });

  /** 未配置 brain 时插件行为完全兼容旧路径 */
  it('无 brain 配置时兼容旧插件', async () => {
    const plugin = new ProactiveIntelligencePlugin();
    assert.equal(plugin.getBrain(), null);
    assert.equal(plugin.settleTask('t', true), false);
    await plugin.start();
    plugin.observe({ type: 'x', source: 's', data: {}, severity: 'info' });
    await plugin.flush();
    await plugin.stop();
  });
});

describe('GrowthSchedulerBrain · 单元', () => {
  it('配置透传 + 默认探索项生效', () => {
    const brain = new GrowthSchedulerBrain({ seed: 3 });
    brain.registerAgent({
      id: 'solo',
      capabilities: ['Y'],
      trueCost: 0.5,
      trueQuality: { Y: 0.9 },
    });

    const a = brain.submitTask('Y');
    assert.ok(a?.winnerId === 'solo');

    // 未知任务结算返回 false
    assert.equal(brain.settleTask('nonexistent', true), false);
  });
});
