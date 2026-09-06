/**
 * 主动智能域 · 审计修复回归（2026-09-06 升级 A2）
 *
 * 逐条锁定审计发现的修复语义：
 *  1. [P0] 动作执行有限并发池：多动作规则真实并发 ≥2 且尊重
 *     maxConcurrentActions 上限；单动作失败/超时语义不变且不波及同伴；
 *     规则优先级处理顺序在并发下保持。
 *  2. [P1] 预检拒绝三态分离：rejected/skipped 与 failed/completed 分列，
 *     不走 throw 路径、事件名区分、不计入失败统计。
 *  3. [P1] 重试分类：确定性失败（ToolError）立即失败不重试，瞬态错误
 *     按 backoff 重试；超时同样不重试（真取消语义）。
 *  4. [P1] 规则所有权隔离：引擎不写调用方对象，出库/事件载荷均快照。
 *  5. [P1] Brain 判别：部分形状抛错、全形状实例接入、含同名异义键的
 *     配置对象不误判。
 *  6/8. [P1/P2] 监控统计增量维护 + total(累计)/live(活跃) 口径。
 *  9. [P2] destroy() 后全部监听器归零。
 * 10. [P3] settled=0 时 successRate 为 null（无数据不报全成功）。
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { EventEmitter } from 'node:events';
import {
  ProactiveIntelligencePlugin,
  DecisionEngine,
  ActionExecutor,
  StateMonitor,
  GrowthSchedulerBrain,
  type Rule,
  type Action,
  type MarketBrain,
} from '../../src/proactive-intelligence/index.js';
import type { GrowthSchedulerConfig } from '../../src/proactive-intelligence/brain.js';
import { ToolError, StateError } from '../../src/utils/errors.js';

// ---------------------------------------------------------------------------
// 辅助构造
// ---------------------------------------------------------------------------

function trigEvent() {
  return { type: 'trig', source: 'test', data: { x: 1 }, severity: 'info' as const };
}

function makeRule(
  id: string,
  priority: number,
  actions: Action[],
  conditions?: Rule['conditions'],
): Rule {
  return {
    id,
    name: id,
    description: '',
    enabled: true,
    priority,
    cooldown: 0,
    conditions: conditions ?? [{ type: 'event', operator: 'equals', field: 'trig.x', value: 1 }],
    actions,
  };
}

function customAction(name: string, handler: () => unknown, extra: Partial<Action> = {}): Action {
  return { type: 'custom', name, parameters: { handler }, ...extra };
}

const notifyAction: Action = {
  type: 'notification',
  name: 'notify',
  parameters: { title: 't', message: 'm' },
};

function tick(times = 2): Promise<void> {
  return new Promise((resolve) => {
    let n = 0;
    const step = () => (++n >= times ? resolve() : setImmediate(step));
    setImmediate(step);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function totalListeners(ee: EventEmitter): number {
  return Array.from(ee.eventNames()).reduce((sum, name) => sum + ee.listenerCount(name), 0);
}

// ---------------------------------------------------------------------------
// 1. [P0] 动作并发池
// ---------------------------------------------------------------------------

describe('审计1 [P0] · 动作执行有限并发池', () => {
  it('多动作规则真实并发 ≥2 且不超过 maxConcurrentActions', async () => {
    let active = 0;
    let maxActive = 0;
    const handler = () => {
      active++;
      if (active > maxActive) maxActive = active;
      return new Promise<void>((resolve) =>
        setTimeout(() => {
          active--;
          resolve();
        }, 25),
      );
    };
    const plugin = new ProactiveIntelligencePlugin({
      executor: { maxConcurrentActions: 2 },
    });
    plugin.addRule(
      makeRule(
        'conc',
        50,
        Array.from({ length: 4 }, (_, i) => customAction(`a${i}`, handler)),
      ),
    );
    await plugin.start();
    plugin.observe(trigEvent());
    await plugin.flush();

    assert.ok(maxActive >= 2, `应观测到 ≥2 的真实并发（实际 ${maxActive}）——串行执行从未重叠`);
    assert.ok(maxActive <= 2, `并发不得超过 maxConcurrentActions=2（实际 ${maxActive}）`);
    const history = plugin.getExecutor().getExecutionHistory({ ruleId: 'conc' });
    assert.equal(history.length, 4);
    assert.equal(history.filter((e) => e.status === 'completed').length, 4);
    await plugin.stop();
  });

  it('单动作失败不波及同伴动作（allSettled 语义）', async () => {
    const plugin = new ProactiveIntelligencePlugin();
    const errors: Array<{ ruleId: string }> = [];
    plugin.on('action_error', (payload: { ruleId: string }) => errors.push(payload));
    plugin.addRule(
      makeRule('mixed', 50, [
        customAction(
          'boom',
          () => new Promise((_, reject) => setTimeout(() => reject(new Error('boom')), 10)),
        ),
        customAction('ok', () => new Promise<void>((resolve) => setTimeout(resolve, 10))),
      ]),
    );
    plugin.addRule(makeRule('bystander', 50, [customAction('ok2', () => Promise.resolve())]));
    await plugin.start();
    plugin.observe(trigEvent());
    await plugin.flush();

    const history = plugin.getExecutor().getExecutionHistory();
    const mixed = history.filter((e) => e.ruleId === 'mixed');
    assert.equal(mixed.filter((e) => e.status === 'failed').length, 1, '失败动作应入史为 failed');
    assert.equal(mixed.filter((e) => e.status === 'completed').length, 1, '同伴动作不受失败影响');
    assert.equal(
      history.filter((e) => e.ruleId === 'bystander' && e.status === 'completed').length,
      1,
      '其他规则的动作照常执行',
    );
    assert.equal(errors.length, 1);
    assert.equal(errors[0]!.ruleId, 'mixed');
    const metrics = plugin.getEngine().getMetrics();
    assert.equal(metrics.actionsFailed, 1);
    assert.equal(metrics.actionsCompleted, 2);
    await plugin.stop();
  });

  it('单动作超时语义不变：超时即失败、不重试、不放大副作用', async () => {
    let handlerCalls = 0;
    const hang = () => {
      handlerCalls++;
      return new Promise<void>(() => {}); // 永不完成，逼出超时路径
    };
    const plugin = new ProactiveIntelligencePlugin();
    plugin.addRule(
      makeRule('hang', 50, [
        customAction('hang', hang, {
          timeout: 40,
          retryPolicy: { maxRetries: 3, backoffMs: 5 },
        }),
      ]),
    );
    plugin.addRule(makeRule('sibling', 50, [customAction('ok', () => Promise.resolve())]));
    await plugin.start();
    plugin.observe(trigEvent());
    await plugin.flush();

    const history = plugin.getExecutor().getExecutionHistory();
    const timedOut = history.find((e) => e.ruleId === 'hang');
    assert.ok(timedOut, '超时动作应入史');
    assert.equal(timedOut.status, 'failed');
    assert.equal(timedOut.error?.message, 'Action timeout');
    assert.equal(handlerCalls, 1, '超时不可重试：副作用动作重跑会放大影响');
    assert.equal(
      history.filter((e) => e.ruleId === 'sibling' && e.status === 'completed').length,
      1,
      '超时动作不阻塞同伴',
    );
    await plugin.stop();
  });

  it('规则优先级处理顺序在并发池下保持（高优先级先执行）', async () => {
    const startOrder: string[] = [];
    const recorder = (label: string) => () => {
      startOrder.push(label);
      return Promise.resolve();
    };
    const plugin = new ProactiveIntelligencePlugin({
      executor: { maxConcurrentActions: 1 }, // 串行化以观测执行顺序
    });
    // 先添加低优先级：证明顺序来自优先级而非注册序
    plugin.addRule(makeRule('low', 10, [customAction('low', recorder('low'))]));
    plugin.addRule(makeRule('high', 90, [customAction('high', recorder('high'))]));
    await plugin.start();
    plugin.observe(trigEvent());
    await plugin.flush();

    assert.deepEqual(startOrder, ['high', 'low'], '高优先级规则的动作应先被执行');
    await plugin.stop();
  });
});

// ---------------------------------------------------------------------------
// 2. [P1] 预检拒绝三态分离
// ---------------------------------------------------------------------------

describe('审计2 [P1] · 预检拒绝与真实失败分列', () => {
  it('禁用/策略阻止/并发超限 → rejected：resolve 返回、入史、action_rejected 事件', async () => {
    const cases: Array<{ label: string; executor: ActionExecutor; message: string }> = [
      {
        label: 'executor 禁用',
        executor: new ActionExecutor({ enabled: false }),
        message: 'disabled',
      },
      {
        label: '动作被策略阻止',
        executor: new ActionExecutor({ blockedActions: ['notification'] }),
        message: 'blocked by policy',
      },
    ];
    for (const { label, executor, message } of cases) {
      const events: string[] = [];
      for (const name of ['action_rejected', 'action_failed', 'action_completed']) {
        executor.on(name, () => events.push(name));
      }
      // 预检拒绝 resolve 返回而非 throw——调用方无需 try/catch 处理策略拒绝
      const execution = await executor.executeAction('r', notifyAction);
      assert.equal(execution.status, 'rejected', `${label}：状态应为 rejected`);
      assert.ok(execution.error?.message.includes(message), `${label}：拒绝原因应入史`);
      assert.deepEqual(
        events,
        ['action_rejected'],
        `${label}：只发 action_rejected，不发 failed/completed`,
      );
      assert.equal(executor.getExecutionHistory().length, 1, `${label}：拒绝仍入史（审计不缺位）`);
    }
  });

  it('并发超限同样走 rejected 路径', async () => {
    const executor = new ActionExecutor({ maxConcurrentActions: 1 });
    const first = executor
      .executeAction(
        'r1',
        customAction('hang', () => new Promise<void>(() => {}), { timeout: 50 }),
      )
      .catch(() => undefined);
    await tick(1);
    const events: string[] = [];
    executor.on('action_rejected', () => events.push('action_rejected'));
    executor.on('action_failed', () => events.push('action_failed'));

    const second = await executor.executeAction('r2', notifyAction);
    assert.equal(second.status, 'rejected');
    assert.ok(second.error?.message.includes('Maximum concurrent actions reached'));
    assert.deepEqual(events, ['action_rejected'], '并发超限发 rejected 事件而非 failed');
    await first; // 等首个动作超时收尾，不留悬挂断言
    assert.equal(
      executor.getExecutionHistory().filter((e) => e.status === 'failed').length,
      1,
      '只有真实超时的首个动作计 failed',
    );
  });

  it('safeMode 跳过标 skipped，不计 completed', async () => {
    const executor = new ActionExecutor({ safeMode: true });
    const events: string[] = [];
    executor.on('action_skipped', () => events.push('action_skipped'));
    executor.on('action_completed', () => events.push('action_completed'));

    const execution = await executor.executeAction('r', notifyAction);
    assert.equal(execution.status, 'skipped');
    assert.deepEqual(events, ['action_skipped']);
  });

  it('插件端到端：被拒动作计入 actionsRejected，不计失败', async () => {
    const plugin = new ProactiveIntelligencePlugin({
      executor: { blockedActions: ['notification'] },
    });
    const rejectedAtPlugin: string[] = [];
    plugin.on('action_rejected', (e: { status: string }) => rejectedAtPlugin.push(e.status));
    plugin.addRule(makeRule('blocked', 50, [notifyAction]));
    await plugin.start();
    plugin.observe(trigEvent());
    await plugin.flush();

    assert.deepEqual(rejectedAtPlugin, ['rejected'], 'action_rejected 应转发到插件层');
    const metrics = plugin.getEngine().getMetrics();
    assert.equal(metrics.actionsRejected, 1);
    assert.equal(metrics.actionsFailed, 0);
    assert.equal(metrics.actionsCompleted, 0);
    assert.equal(metrics.totalActionsExecuted, 0, '被拒动作从未真正执行，不计执行总数');
    await plugin.stop();
  });
});

// ---------------------------------------------------------------------------
// 3. [P1] 重试错误分类
// ---------------------------------------------------------------------------

describe('审计3 [P1] · 确定性失败不重试、瞬态错误重试', () => {
  const retry: Action['retryPolicy'] = { maxRetries: 3, backoffMs: 5 };

  it('ToolError（策略拒绝/参数校验类）立即失败，不按 backoff 重试', async () => {
    let calls = 0;
    const executor = new ActionExecutor();
    await assert.rejects(
      executor.executeAction(
        'r',
        customAction(
          'deterministic',
          () => {
            calls++;
            throw new ToolError('policy denied');
          },
          { retryPolicy: retry },
        ),
      ),
      /policy denied/,
    );
    assert.equal(calls, 1, `确定性失败只尝试 1 次（实际 ${calls}），重试必然同结果`);
  });

  it('参数校验失败（ToolError 同类路径）立即失败', async () => {
    const executor = new ActionExecutor();
    // notification 缺 title/message → executeNotification 抛 ToolError（确定性域错误）
    const bad: Action = {
      type: 'notification',
      name: 'bad',
      parameters: {},
      retryPolicy: retry,
    };
    const startedAt = Date.now();
    await assert.rejects(executor.executeAction('r', bad), /requires/);
    // 确定性失败不重试的强证据：耗时远小于 3 次退避（5/10/15ms）叠加
    assert.ok(Date.now() - startedAt < 10, '参数校验失败不应消耗任何退避周期');
  });

  it('瞬态错误（基础设施类）按 backoff 重试并在成功后停止', async () => {
    let calls = 0;
    const executor = new ActionExecutor();
    const execution = await executor.executeAction(
      'r',
      customAction(
        'transient',
        () => {
          calls++;
          if (calls < 3) throw new Error('ECONNRESET: connection reset by peer');
          return 'recovered';
        },
        { retryPolicy: retry },
      ),
    );
    assert.equal(execution.status, 'completed');
    assert.equal(calls, 3, '第 3 次尝试成功：2 次瞬态失败 + 1 次成功');
  });

  it('持续瞬态失败重试 maxRetries 次后上抛', async () => {
    let calls = 0;
    const executor = new ActionExecutor();
    await assert.rejects(
      executor.executeAction(
        'r',
        customAction(
          'always-busy',
          () => {
            calls++;
            throw new Error('resource temporarily unavailable');
          },
          { retryPolicy: { maxRetries: 2, backoffMs: 5 } },
        ),
      ),
      /resource temporarily unavailable/,
    );
    assert.equal(calls, 3, '1 次初始尝试 + 2 次重试');
  });
});

// ---------------------------------------------------------------------------
// 4. [P1] 规则所有权隔离
// ---------------------------------------------------------------------------

describe('审计4 [P1] · 规则对象不被引擎内部改写', () => {
  function ctx(): Parameters<DecisionEngine['makeDecision']>[0] {
    return {
      events: [],
      currentState: { always: true },
      history: [],
      rules: [],
    };
  }

  const alwaysRule = (): Rule => ({
    id: 'iso',
    name: 'iso',
    description: '',
    enabled: true,
    priority: 50,
    cooldown: 0,
    conditions: [{ type: 'state', operator: 'equals', field: 'always', value: true }],
    actions: [notifyAction],
  });

  it('lastExecuted/enabled 不写回调用方对象（旁路 Map 维护）', async () => {
    const engine = new DecisionEngine();
    const callerRule = alwaysRule();
    engine.addRule(callerRule);

    const triggeredPayloads: Rule[] = [];
    engine.on('rule_triggered', (r: Rule) => triggeredPayloads.push(r));

    const first = await engine.makeDecision(ctx());
    assert.ok(first.has('iso'), '规则应触发');
    assert.equal(callerRule.lastExecuted, undefined, '调用方对象的 lastExecuted 不得被引擎改写');
    assert.equal(callerRule.enabled, true);

    // 事件负载携带冷却字段（快照），但调用方对象仍干净
    assert.ok(triggeredPayloads[0]!.lastExecuted instanceof Date, '快照应呈现 lastExecuted');

    // 调用方改自己的对象不影响引擎（入库是深拷贝）
    callerRule.enabled = false;
    callerRule.conditions = [];
    const second = await engine.makeDecision(ctx());
    assert.ok(second.has('iso'), '引擎内的规则副本不受调用方对象篡改影响');

    // 引擎 toggle 不写调用方对象（先恢复调用方侧为 true 以便区分写入来源）
    callerRule.enabled = true;
    engine.toggleRule('iso', false);
    assert.equal(callerRule.enabled, true, 'toggleRule 只改引擎内部副本，不污染调用方对象');
    const third = await engine.makeDecision(ctx());
    assert.ok(!third.has('iso'), '引擎内规则已被禁用');
  });

  it('getAllRules 返回独立快照：篡改快照不影响引擎', async () => {
    const engine = new DecisionEngine();
    engine.addRule(alwaysRule());

    const snap1 = engine.getAllRules()[0]!;
    const snap2 = engine.getAllRules()[0]!;
    assert.notEqual(snap1, snap2, '每次出库都是新快照');
    assert.notEqual(snap1.conditions, engine.getRule('iso')!.conditions, '条件数组不共享引用');

    snap1.enabled = false;
    snap1.conditions.push({
      type: 'state',
      operator: 'equals',
      field: 'always',
      value: false,
    });
    const decision = await engine.makeDecision(ctx());
    assert.ok(decision.has('iso'), '篡改出库快照不得影响引擎内部规则');
  });

  it('between 元组与 matches 正则入库为拷贝（RegExp lastIndex 状态不共享）', async () => {
    const engine = new DecisionEngine();
    const callerRule = alwaysRule();
    const sharedRegex = /x/g;
    callerRule.conditions = [
      { type: 'state', operator: 'matches', field: 'always', value: sharedRegex },
    ];
    // state.always=true 字符串化 "true" 不含 x → 不触发；重点是引用隔离断言
    engine.addRule(callerRule);
    const stored = engine.getRule('iso')!;
    assert.notEqual(stored.conditions[0]!.value, sharedRegex, '正则应拷贝入库');
    assert.ok(stored.conditions[0]!.value instanceof RegExp);
  });
});

// ---------------------------------------------------------------------------
// 5. [P1] Brain 实例/配置判别
// ---------------------------------------------------------------------------

describe('审计5 [P1] · Brain 判别（不靠单一 submitTask 键鸭子类型）', () => {
  const fullBrain: MarketBrain = {
    submitTask: () => null,
    settleTask: () => false,
    getState: () => ({ marker: 'stub' }),
  };

  it('完整 MarketBrain 实例直接接入', () => {
    const plugin = new ProactiveIntelligencePlugin({ brain: fullBrain });
    assert.equal(plugin.getBrain(), fullBrain, '完整形状的 Brain 实例不得被误判为配置对象');
  });

  it('部分形状（只有 submitTask）立即抛错而非静默换芯', () => {
    // 只具备一个核心方法：半成品 Brain 形状（静默换芯比失败更危险）
    const partialBrain: Partial<GrowthSchedulerConfig> & Record<string, unknown> = {
      submitTask: () => null,
    };
    assert.throws(
      () => new ProactiveIntelligencePlugin({ brain: partialBrain }),
      (err: unknown) => err instanceof StateError && /partial MarketBrain/.test(err.message),
    );
  });

  it('含 submitTask 同名键的配置对象不被误判为 Brain 实例', () => {
    // 旧缺陷场景：调度器配置恰有 submitTask 字段（如远程端点字符串），
    // 单键鸭子检查会把它误判成 Brain 实例
    const configObject: Partial<GrowthSchedulerConfig> & Record<string, unknown> = {
      seed: 3,
      submitTask: 'https://internal/submit-task',
    };
    const plugin = new ProactiveIntelligencePlugin({ brain: configObject });
    assert.ok(
      plugin.getBrain() instanceof GrowthSchedulerBrain,
      '无方法键的对象应按 GrowthSchedulerConfig 构造默认市场',
    );
  });
});

// ---------------------------------------------------------------------------
// 6/8. [P1/P2] 监控统计：增量维护 + total/live 口径
// ---------------------------------------------------------------------------

describe('审计6+8 · 监控统计增量维护与口径', () => {
  /** 从 getEvents() 暴力重算统计（作为增量计数的一致性基准） */
  function bruteForce(monitor: StateMonitor) {
    const events = monitor.getEvents();
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    let critical = 0;
    for (const e of events) {
      byType[e.type] = (byType[e.type] ?? 0) + 1;
      bySeverity[e.severity] = (bySeverity[e.severity] ?? 0) + 1;
      if (e.severity === 'critical') critical++;
    }
    return { live: events.length, byType, bySeverity, critical };
  }

  function observe(monitor: StateMonitor, type: string, severity: 'info' | 'critical' | 'warning') {
    return monitor.observe({ type, source: 's', data: {}, severity });
  }

  it('total 为真累计、live 为活跃窗口；过期后统计与暴力重算一致', async () => {
    const monitor = new StateMonitor({ retentionMs: 60 });
    observe(monitor, 'a', 'info');
    observe(monitor, 'a', 'critical');
    observe(monitor, 'b', 'info');
    observe(monitor, 'c', 'warning');

    let stats = monitor.getStatistics();
    assert.equal(stats.total, 4, 'total 为累计口径');
    assert.equal(stats.live, 4);
    assert.equal(stats.critical, 1);
    assert.equal(stats.recent, 4, '刚观察的事件全部落在 60s 窗口内');
    assert.equal(stats.byType['a'], 2);

    // 过期：旧事件出活跃窗口，total 仍累计
    await sleep(90);
    observe(monitor, 'd', 'info');
    stats = monitor.getStatistics();
    assert.equal(stats.total, 5, 'total 不受过期影响');
    assert.equal(stats.live, 1, '旧事件已出窗');
    assert.deepEqual(stats.byType, { d: 1 }, '计数随出窗扣减');
    assert.deepEqual(stats.bySeverity, { info: 1 });
    assert.equal(stats.critical, 0, '出窗的 critical 同步扣减');
    assert.equal(stats.recent, 1);

    const expected = bruteForce(monitor);
    assert.equal(stats.live, expected.live);
    assert.deepEqual(stats.byType, expected.byType);
    assert.deepEqual(stats.bySeverity, expected.bySeverity);
    assert.equal(stats.critical, expected.critical);
  });

  it('容量淘汰路径的计数扣减与暴力重算一致', () => {
    const monitor = new StateMonitor({ maxBufferSize: 3 });
    for (const t of ['a', 'b', 'a', 'c', 'd', 'd']) {
      observe(monitor, t, t === 'a' ? 'critical' : 'info');
    }
    const stats = monitor.getStatistics();
    assert.equal(stats.total, 6, '淘汰的事件仍计入累计');
    assert.equal(stats.live, 3);
    const expected = bruteForce(monitor);
    assert.deepEqual(stats.byType, expected.byType);
    assert.deepEqual(stats.bySeverity, expected.bySeverity);
    assert.equal(stats.critical, expected.critical);
  });

  it('clear() 清零累计与增量计数表', () => {
    const monitor = new StateMonitor();
    observe(monitor, 'a', 'critical');
    monitor.clear();
    const stats = monitor.getStatistics();
    assert.equal(stats.total, 0);
    assert.equal(stats.live, 0);
    assert.equal(stats.critical, 0);
    assert.deepEqual(stats.byType, {});
    assert.deepEqual(stats.bySeverity, {});
  });

  it('批量事件下 getStatistics 与 getEvents 全量重算深度一致（计数不漂移）', () => {
    const monitor = new StateMonitor({ maxBufferSize: 25 });
    const types = ['x', 'y', 'z'];
    const severities = ['info', 'warning', 'critical'] as const;
    for (let i = 0; i < 60; i++) {
      observe(monitor, types[i % 3]!, severities[i % 3]!);
    }
    const stats = monitor.getStatistics();
    const expected = bruteForce(monitor);
    assert.deepEqual(stats.byType, expected.byType);
    assert.deepEqual(stats.bySeverity, expected.bySeverity);
    assert.equal(stats.critical, expected.critical);
    assert.equal(stats.live, expected.live);
    assert.equal(stats.total, 60);
  });
});

// ---------------------------------------------------------------------------
// 9. [P2] destroy() 监听器回收
// ---------------------------------------------------------------------------

describe('审计9 [P2] · destroy() 后监听器计数归零', () => {
  it('转发器/回流/合并器监听全部解除', () => {
    const plugin = new ProactiveIntelligencePlugin();
    // 外部监听者（插件层与组件层各挂一个）
    plugin.on('decision_made', () => {});
    plugin.getEngine().on('rule_added', () => {});
    plugin.getExecutor().on('action_completed', () => {});
    plugin.getMonitor().on('event', () => {});

    const before = {
      plugin: totalListeners(plugin),
      engine: totalListeners(plugin.getEngine()),
      executor: totalListeners(plugin.getExecutor()),
      monitor: totalListeners(plugin.getMonitor()),
    };
    // 组件层至少有插件装配的内部监听 + 测试挂的外部监听
    assert.ok(before.plugin >= 1);
    assert.ok(before.engine >= 2);
    assert.ok(before.executor >= 15, '执行器侧应有 15 个内部转发/回流监听 + 外部监听');
    assert.ok(before.monitor >= 2);

    plugin.destroy();

    assert.equal(totalListeners(plugin), 0, '插件自身监听器归零');
    assert.equal(totalListeners(plugin.getEngine()), 0, '引擎监听器归零');
    assert.equal(totalListeners(plugin.getExecutor()), 0, '执行器监听器归零');
    assert.equal(totalListeners(plugin.getMonitor()), 0, '监控器监听器归零');
  });

  it('destroy 后 observe 不再触发决策（紧急制动不被复活）', async () => {
    const plugin = new ProactiveIntelligencePlugin();
    plugin.addRule(makeRule('zombie', 50, [notifyAction]));
    await plugin.start();
    plugin.destroy();

    let decisions = 0;
    plugin.getEngine().on('decision_made', () => decisions++);
    plugin.observe(trigEvent());
    await tick(4);
    assert.equal(decisions, 0);
    assert.equal(plugin.getExecutor().getExecutionHistory().length, 0);
  });
});

// ---------------------------------------------------------------------------
// 10. [P3] successRate 无数据语义
// ---------------------------------------------------------------------------

describe('审计10 [P3] · 无结算数据时 successRate 为 null', () => {
  it('settledCount=0 → successRate=null（不谎报 100%）', () => {
    const brain = new GrowthSchedulerBrain({ seed: 1 });
    const state = brain.getState();
    assert.equal(state.settledCount, 0);
    assert.equal(state.successRate, null, '无数据必须报告 null，而非缺省 1');
  });

  it('successRate=null 不触发数值比较规则（缺失值不参与比较）', async () => {
    const plugin = new ProactiveIntelligencePlugin({
      brain: { successValue: 10, exploreCoefficient: 0.35, seed: 7 },
      brainAgents: [{ id: 'a1', capabilities: ['X'], trueCost: 1, trueQuality: { X: 0.6 } }],
    });
    plugin.addRule(
      makeRule(
        'false-alarm',
        50,
        [notifyAction],
        [{ type: 'state', operator: 'lessThan', field: 'brain.successRate', value: 0.5 }],
      ),
    );
    await plugin.start();

    let triggered = false;
    plugin.getEngine().on('decision_made', (d: { triggeredRules: string[] }) => {
      if (d.triggeredRules.includes('false-alarm')) triggered = true;
    });
    plugin.observe({ type: 'ping', source: 's', data: {}, severity: 'info' });
    await plugin.flush();

    assert.ok(!triggered, 'successRate=null（无数据）不得被 lessThan 当作 0 触发误报');
    await plugin.stop();
  });

  it('首次结算后 successRate 有真实值', () => {
    const brain = new GrowthSchedulerBrain({ seed: 2 });
    brain.registerAgent({ id: 'a', capabilities: ['X'], trueCost: 1, trueQuality: { X: 1 } });
    const assignment = brain.submitTask('X')!;
    assert.ok(assignment);
    assert.ok(brain.settleTask(assignment.taskId, true));
    const state = brain.getState();
    assert.equal(state.settledCount, 1);
    assert.equal(state.successRate, 1);
  });
});
