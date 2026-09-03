import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ProactiveIntelligencePlugin,
  DecisionEngine,
  type Rule,
  type MonitorEvent,
} from '../src/proactive-intelligence/index.js';
import { GrowthSchedulerBrain } from '../src/proactive-intelligence/brain.js';

/** 等待 setImmediate 批处理决策完成 */
function tick(times = 4): Promise<void> {
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
    await tick();

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
    await tick();

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
    await tick();

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
    await tick();

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
    await tick();

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
    await tick();

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
    await tick();
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
    assert.ok(a && a.winnerId === 'solo');

    // 未知任务结算返回 false
    assert.equal(brain.settleTask('nonexistent', true), false);
  });
});
