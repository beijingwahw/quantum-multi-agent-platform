/**
 * R10-B 修复波回归：主动智能（02#6 / 02#13 / 02#15 / 02#23）与
 * QuantumBus（09#F04 / 09#F05 / 09#F09）修复点的钉板测试。
 *
 * 总线部分沿用 quality-regressions.test.ts 的确定性驱动模式：
 * port 0 真实监听 + waitForBusEvent 事件谓词等待（无固定轮次时序估计）；
 * 同连接消息严格有序——「后续正向事件到达时，前一帧必然已被处理」。
 */
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';

import { QuantumBus } from '../../src/communication/quantum-bus.js';
import {
  DecisionEngine,
  StateMonitor,
  ProactiveIntelligencePlugin,
  type Rule,
} from '../../src/proactive-intelligence/index.js';
import { ConfigurationError } from '../../src/utils/errors.js';

// ----------------------------------------------------------------------------
// 共享构造
// ----------------------------------------------------------------------------

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

// ----------------------------------------------------------------------------
// 02#6 remainder：contains/notContains 子串域收窄（数字/布尔不再隐式字符串化）
// ----------------------------------------------------------------------------

describe('R10 · decision-engine contains 子串域收窄（02#6 remainder）', () => {
  async function triggersOn(
    field: string,
    value: unknown,
    operator: 'contains' | 'notContains',
    conditionValue: string | number | boolean,
  ): Promise<boolean> {
    const engine = new DecisionEngine();
    engine.addRule(
      notificationRule('r', [{ type: 'state', operator, field, value: conditionValue }]),
    );
    const actions = await engine.makeDecision({
      events: [],
      currentState: { v: value },
      history: [],
      rules: [],
    });
    return actions.has('r');
  }

  it('数字值不参与子串比较：12 contains "1" → false（不再隐式字符串化命中）', async () => {
    assert.equal(
      await triggersOn('v', 12, 'contains', '1'),
      false,
      '数字 contains 字符串子串不得命中',
    );
    assert.equal(await triggersOn('v', 12, 'contains', 1), false, '数字 contains 数字同样在域外');
    // 双极对称：域外时 notContains 也不成立（不是「不含 → true」）
    assert.equal(
      await triggersOn('v', 12, 'notContains', '1'),
      false,
      '域外值 notContains 不得翻转为 true',
    );
  });

  it('布尔值不参与子串比较：true contains "true" → false', async () => {
    assert.equal(await triggersOn('v', true, 'contains', 'true'), false);
    assert.equal(await triggersOn('v', true, 'notContains', 'true'), false);
  });

  it('字符串 contains/notContains 保持子串语义', async () => {
    assert.equal(await triggersOn('v', 'hello world', 'contains', 'world'), true);
    assert.equal(await triggersOn('v', 'hello world', 'notContains', 'xyz'), true);
    assert.equal(await triggersOn('v', 'hello world', 'notContains', 'world'), false);
    // 条件值非字符串（数字）时同为域外：'abc' contains 1 → false
    assert.equal(await triggersOn('v', 'abc', 'contains', 1), false, '双侧都必须是字符串');
  });

  it('数组成员语义保留：includes 按原值精确匹配', async () => {
    assert.equal(await triggersOn('v', ['a', 'b', 'c'], 'contains', 'b'), true);
    assert.equal(await triggersOn('v', ['a', 'b', 'c'], 'notContains', 'b'), false);
    assert.equal(
      await triggersOn('v', ['a', 'b', 'c'], 'contains', 'ab'),
      false,
      '成员匹配不是子串拼接',
    );
  });
});

// ----------------------------------------------------------------------------
// 02#13 remainder：StateMonitor 构造期拒绝垃圾容量/保留配置
// 02#15：deadPrefix 游标行为（容量淘汰路径一并钉住）
// ----------------------------------------------------------------------------

describe('R10 · StateMonitor 配置域守卫（02#13 remainder）', () => {
  const invalidValues: unknown[] = [0, -5, NaN, '10', true, null];

  it('maxBufferSize/retentionMs 非数字/NaN/≤0 一律抛 ConfigurationError', () => {
    for (const bad of invalidValues) {
      assert.throws(
        () => new StateMonitor({ maxBufferSize: bad as number }),
        (error: unknown) =>
          error instanceof ConfigurationError &&
          error.message.includes('maxBufferSize must be a positive number'),
        `maxBufferSize=${String(bad)} 必须被拒绝`,
      );
      assert.throws(
        () => new StateMonitor({ retentionMs: bad as number }),
        (error: unknown) =>
          error instanceof ConfigurationError &&
          error.message.includes('retentionMs must be a positive number'),
        `retentionMs=${String(bad)} 必须被拒绝`,
      );
    }
  });

  it('合法值（含下界 1）照常工作；容量淘汰经 deadPrefix 游标保留最新事件（02#15）', () => {
    const monitor = new StateMonitor({ maxBufferSize: 1, retentionMs: 3_600_000 });
    monitor.observe({ type: 'a', source: 's', data: {}, severity: 'info' });
    const newest = monitor.observe({ type: 'b', source: 's', data: {}, severity: 'info' });

    const events = monitor.getEvents();
    assert.equal(events.length, 1, 'maxBufferSize=1 只保留最新一条');
    assert.equal(events[0]!.id, newest.id, '容量淘汰驱逐的是最旧事件（deadPrefix 前缀语义）');
    const stats = monitor.getStatistics();
    assert.equal(stats.total, 2, '累计口径不受容量淘汰影响');
    assert.equal(stats.live, 1);
  });
});

// ----------------------------------------------------------------------------
// 02#23 remainder：决策上下文事件窗口有界（STATE_EVENT_WINDOW = 200）
// ----------------------------------------------------------------------------

describe('R10 · 决策事件窗口有界（02#23 remainder）', () => {
  it('getRecentEvents：尾部窗口、最新事件在内、域守卫同 getDecisionHistory 口径', () => {
    const monitor = new StateMonitor();
    const seeded: Array<ReturnType<StateMonitor['observe']>> = [];
    for (let i = 0; i < 250; i++) {
      seeded.push(monitor.observe({ type: 'n', source: 's', data: { i }, severity: 'info' }));
    }
    const recent = monitor.getRecentEvents(200);
    assert.equal(recent.length, 200, '250 条活跃事件取最近 200 条');
    assert.equal(recent[0]!.id, seeded[50]!.id, '窗口左端是第 51 条（前 50 条在窗口外）');
    assert.equal(recent[recent.length - 1]!.id, seeded[249]!.id, '最新事件必须在窗口内');

    assert.deepEqual(monitor.getRecentEvents(0), [], 'limit=0 合法返回空数组');
    assert.throws(() => monitor.getRecentEvents(-1), /non-negative integer/);
    assert.throws(() => monitor.getRecentEvents(1.5), /non-negative integer/);
  });

  it('插件决策批次：事件上下文 ≤ 200、触顶上界、窗口内最新事件仍可触发规则', async () => {
    const plugin = new ProactiveIntelligencePlugin();
    const engine = plugin.getEngine();
    const contextLengths: number[] = [];
    const lastTypes: string[] = [];
    const firstIndices: unknown[] = [];
    // 捕获注入决策引擎的上下文（先收集后断言，不在引擎内部判定）
    const originalDecision = engine.makeDecision.bind(engine);
    engine.makeDecision = (context) => {
      contextLengths.push(context.events.length);
      lastTypes.push(context.events[context.events.length - 1]?.type ?? '');
      firstIndices.push(context.events[0]?.data.i);
      return originalDecision(context);
    };

    plugin.addRule(
      notificationRule('late-rule', [
        { type: 'event', operator: 'equals', field: 'late.value', value: 1 },
      ]),
    );
    await plugin.start();

    for (let i = 0; i < 249; i++) {
      plugin.observe({ type: 'noise', source: 's', data: { i }, severity: 'info' });
    }
    plugin.observe({ type: 'late', source: 's', data: { value: 1 }, severity: 'info' });
    await plugin.flush();

    assert.ok(contextLengths.length >= 1, '至少发生一次决策批次');
    assert.equal(
      Math.max(...contextLengths),
      200,
      `250 个事件应触顶 200 上界，实际 ${contextLengths.join(',')}`,
    );
    assert.ok(
      contextLengths.every((n) => n <= 200),
      '任何批次都不得超过窗口上界',
    );
    assert.ok(
      lastTypes.every((t) => t === 'late'),
      '窗口尾部必须是最新事件',
    );
    assert.ok(
      firstIndices.every((i) => i === 50),
      '窗口左端是第 51 条事件（i=50）',
    );

    const hist = plugin.getExecutor().getExecutionHistory();
    assert.ok(
      hist.some((e) => e.status === 'completed'),
      '窗口内最新事件（late）仍可触发规则并执行动作',
    );
    await plugin.stop();
  });
});

// ----------------------------------------------------------------------------
// 总线驱动（09#F04 / 09#F05 / 09#F09）：quality-regressions 同款确定性模式
// ----------------------------------------------------------------------------

describe('R10 · QuantumBus authenticate 身份长度与 token 绑定（09#F04 remainder）', () => {
  const buses: QuantumBus[] = [];

  function openSocket(port: number): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/quantum-bus`);
      ws.once('open', () => resolve(ws));
      ws.once('error', reject);
    });
  }

  function waitForBusEvent<T>(
    bus: QuantumBus,
    name: string,
    predicate: (e: T) => boolean,
    timeoutMs = 3_000,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const listener = (e: T) => {
        if (!predicate(e)) return;
        clearTimeout(timer);
        bus.off(name, listener);
        resolve(e);
      };
      const timer = setTimeout(() => {
        bus.off(name, listener);
        reject(new Error(`timeout waiting for bus event '${name}'`));
      }, timeoutMs);
      bus.on(name, listener);
    });
  }

  function waitClose(ws: WebSocket, timeoutMs = 3_000): Promise<number | undefined> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('close timeout')), timeoutMs);
      ws.once('close', (code: number) => {
        clearTimeout(timer);
        resolve(code);
      });
    });
  }

  after(() => {
    for (const bus of buses) bus.shutdown();
  });

  it('超长 agentId（>128）被拒：4001 断开、计入 invalidAgentIdRejections、不绑定身份', async () => {
    const bus = new QuantumBus({ communication: { port: 0 } });
    buses.push(bus);
    await bus.start();

    const ws = await openSocket(bus.getPort()!);
    ws.send(JSON.stringify({ type: 'authenticate', agentId: 'a'.repeat(129) }));
    await waitForBusEvent(
      bus,
      'authentication_failed',
      (e: { connectionId: string }) => typeof e.connectionId === 'string',
    );
    assert.equal(await waitClose(ws), 4001, '与形状非法同判定：4001 断开');
    assert.equal(bus.getMetrics().security.invalidAgentIdRejections, 1, '超长身份拒绝必须计数');
    assert.deepEqual(bus.getAgentsOnline(), []);
  });

  it('边界：恰好 128 字符的 agentId 正常认证（上限不是减一）', async () => {
    const bus = new QuantumBus({ communication: { port: 0 } });
    buses.push(bus);
    await bus.start();

    const agentId = 'a'.repeat(128);
    const ws = await openSocket(bus.getPort()!);
    ws.send(JSON.stringify({ type: 'authenticate', agentId }));
    await waitForBusEvent(
      bus,
      'agent_authenticated',
      (e: { agentId: string }) => e.agentId === agentId,
    );
    assert.deepEqual(bus.getAgentsOnline(), [agentId]);
    ws.close();
  });

  it('tokenAgents 绑定：越界 agentId 被拒并计入 identitySpoofRejections，清单内身份不受影响', async () => {
    const bus = new QuantumBus({
      communication: {
        port: 0,
        authToken: 'secret',
        tokenAgents: { secret: ['agent-1'] },
      },
    });
    buses.push(bus);
    await bus.start();

    const good = await openSocket(bus.getPort()!);
    good.send(JSON.stringify({ type: 'authenticate', agentId: 'agent-1', token: 'secret' }));
    await waitForBusEvent(
      bus,
      'agent_authenticated',
      (e: { agentId: string }) => e.agentId === 'agent-1',
    );

    // 共享 token 声称清单外的 agent-2：拒绝 + 4001 + 不绑定身份
    const bad = await openSocket(bus.getPort()!);
    bad.send(JSON.stringify({ type: 'authenticate', agentId: 'agent-2', token: 'secret' }));
    await waitForBusEvent(
      bus,
      'authentication_failed',
      (e: { agentId: string }) => e.agentId === 'agent-2',
    );
    assert.equal(await waitClose(bad), 4001);
    assert.equal(bus.getMetrics().security.identitySpoofRejections, 1, '越界声称计入冒用口径');
    assert.deepEqual(bus.getAgentsOnline(), ['agent-1'], '越界身份不得上线');
    good.close();
  });

  it('未配置 tokenAgents 时行为不变：共享 token 可认证任意合法 agentId', async () => {
    const bus = new QuantumBus({ communication: { port: 0, authToken: 'secret' } });
    buses.push(bus);
    await bus.start();

    const ws = await openSocket(bus.getPort()!);
    ws.send(JSON.stringify({ type: 'authenticate', agentId: 'agent-9', token: 'secret' }));
    await waitForBusEvent(
      bus,
      'agent_authenticated',
      (e: { agentId: string }) => e.agentId === 'agent-9',
    );
    assert.deepEqual(bus.getAgentsOnline(), ['agent-9']);
    ws.close();
  });

  it('鉴权未开启时 tokenAgents 不生效（绑定仅在 authToken 配置后约束）', async () => {
    const bus = new QuantumBus({
      communication: { port: 0, tokenAgents: { 'some-token': ['agent-1'] } },
    });
    buses.push(bus);
    await bus.start();

    const ws = await openSocket(bus.getPort()!);
    // 本地开发模式：无 token 也可认证任意身份（历史行为保持）
    ws.send(JSON.stringify({ type: 'authenticate', agentId: 'agent-x' }));
    await waitForBusEvent(
      bus,
      'agent_authenticated',
      (e: { agentId: string }) => e.agentId === 'agent-x',
    );
    ws.close();
  });

  it('tokenAgents 垃圾形状构造期拒绝；Map 形态同获支持', () => {
    assert.throws(
      // 负对照：字符串允许清单是运行时才能到达的垃圾形状（静态层按 unknown 视图传入）
      () =>
        new QuantumBus({
          communication: {
            tokenAgents: { t: 'agent-1' } as unknown as Record<string, readonly string[]>,
          },
        }),
      (error: unknown) =>
        error instanceof ConfigurationError && error.message.includes("tokenAgents['t']"),
      '允许清单必须是字符串数组（字符串值会以子串语义静默误判）',
    );
    assert.throws(
      () => new QuantumBus({ communication: { tokenAgents: { '': ['a'] } } }),
      /tokenAgents keys must be non-empty/,
    );
    // Map 形态：与 Record 同一归一入口
    const bus = new QuantumBus({
      communication: { tokenAgents: new Map([['t', ['a', 'b']]]) },
    });
    buses.push(bus);
    assert.ok(!bus.isStarted());
  });
});

describe('R10 · QuantumBus timestamp 形状校验（09#F05 remainder）', () => {
  const buses: QuantumBus[] = [];

  function openSocket(port: number): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/quantum-bus`);
      ws.once('open', () => resolve(ws));
      ws.once('error', reject);
    });
  }

  function waitForBusEvent<T>(
    bus: QuantumBus,
    name: string,
    predicate: (e: T) => boolean,
    timeoutMs = 3_000,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const listener = (e: T) => {
        if (!predicate(e)) return;
        clearTimeout(timer);
        bus.off(name, listener);
        resolve(e);
      };
      const timer = setTimeout(() => {
        bus.off(name, listener);
        reject(new Error(`timeout waiting for bus event '${name}'`));
      }, timeoutMs);
      bus.on(name, listener);
    });
  }

  after(() => {
    for (const bus of buses) bus.shutdown();
  });

  let seq = 0;
  function wireMessage(overrides: Record<string, unknown>): string {
    const base: Record<string, unknown> = {
      id: `m-${++seq}`,
      type: 'status_update',
      sourceAgentId: 'agent-1',
      targetAgentId: `offline-${seq}`,
      content: {},
      timestamp: new Date().toISOString(),
      priority: 'medium',
      quantumState: {
        id: 'q',
        amplitude: 1,
        phase: 0,
        collapsed: true,
        position: { x: 0, y: 0, z: 0 },
      },
    };
    return JSON.stringify({ ...base, ...overrides });
  }

  it('合法线上形态照常投递：ISO 8601 字符串与 epoch 毫秒数（DateLike 契约）', async () => {
    const bus = new QuantumBus({ communication: { port: 0 } });
    buses.push(bus);
    await bus.start();
    const ws = await openSocket(bus.getPort()!);

    ws.send(wireMessage({ timestamp: new Date().toISOString() }));
    await waitForBusEvent(
      bus,
      'message_queued',
      (e: { agentId: string }) => e.agentId === 'offline-1',
    );

    ws.send(wireMessage({ timestamp: Date.now() }));
    await waitForBusEvent(
      bus,
      'message_queued',
      (e: { agentId: string }) => e.agentId === 'offline-2',
    );
    ws.close();
  });

  it('畸形 timestamp 按无效格式丢弃：对象/不可解析字符串/布尔/缺失', async () => {
    const bus = new QuantumBus({ communication: { port: 0 } });
    buses.push(bus);
    await bus.start();
    const queued: string[] = [];
    bus.on('message_queued', (e: { agentId: string }) => queued.push(e.agentId));

    const ws = await openSocket(bus.getPort()!);
    const badFrames = [
      wireMessage({ timestamp: { iso: 'not-a-real-date' } }),
      wireMessage({ timestamp: 'not-a-date' }),
      wireMessage({ timestamp: true }),
      JSON.stringify({
        id: `m-${++seq}`,
        type: 'status_update',
        sourceAgentId: 'agent-1',
        targetAgentId: `offline-${seq}`,
        content: {},
        priority: 'medium',
        quantumState: {
          id: 'q',
          amplitude: 1,
          phase: 0,
          collapsed: true,
          position: { x: 0, y: 0, z: 0 },
        },
      }),
    ];
    // 同连接有序：紧随的合法帧入队事件到达时，前面各帧必然已被处理
    ws.send(badFrames[0]!);
    ws.send(badFrames[1]!);
    ws.send(badFrames[2]!);
    ws.send(badFrames[3]!);
    ws.send(wireMessage({}));
    await waitForBusEvent(
      bus,
      'message_queued',
      (e: { agentId: string }) => e.agentId === `offline-${seq}`,
    );

    assert.equal(
      queued.length,
      1,
      `仅合法帧入队，畸形 timestamp 全部丢弃（实际 ${queued.join(',')}）`,
    );
    assert.equal(bus.getConnectionCount(), 1, '无效格式是丢弃路径，不断连');
    ws.close();
  });
});

describe('R10 · QuantumBus 未知帧类型显式错误帧（09#F09 remainder）', () => {
  const buses: QuantumBus[] = [];

  function openSocket(port: number): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/quantum-bus`);
      ws.once('open', () => resolve(ws));
      ws.once('error', reject);
    });
  }

  function waitForBusEvent<T>(
    bus: QuantumBus,
    name: string,
    predicate: (e: T) => boolean,
    timeoutMs = 3_000,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const listener = (e: T) => {
        if (!predicate(e)) return;
        clearTimeout(timer);
        bus.off(name, listener);
        resolve(e);
      };
      const timer = setTimeout(() => {
        bus.off(name, listener);
        reject(new Error(`timeout waiting for bus event '${name}'`));
      }, timeoutMs);
      bus.on(name, listener);
    });
  }

  function waitForWsMessage<T extends { type?: string }>(
    ws: WebSocket,
    predicate: (msg: T) => boolean,
    timeoutMs = 3_000,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const listener = (data: WebSocket.RawData) => {
        let msg: T;
        try {
          msg = JSON.parse((data as Buffer).toString('utf8')) as T;
        } catch {
          return;
        }
        if (!predicate(msg)) return;
        clearTimeout(timer);
        ws.off('message', listener);
        resolve(msg);
      };
      const timer = setTimeout(() => {
        ws.off('message', listener);
        reject(new Error('timeout waiting for ws message'));
      }, timeoutMs);
      ws.on('message', listener);
    });
  }

  after(() => {
    for (const bus of buses) bus.shutdown();
  });

  it('未知 type 收到 error 帧（code=unknown_message_type）、连接保持打开、计数 +1', async () => {
    const bus = new QuantumBus({ communication: { port: 0 } });
    buses.push(bus);
    await bus.start();

    const ws = await openSocket(bus.getPort()!);
    ws.send(
      JSON.stringify({
        id: 'bogus-1',
        type: 'bogus',
        sourceAgentId: 'agent-1',
        content: {},
        timestamp: new Date().toISOString(),
        priority: 'medium',
        quantumState: {
          id: 'q',
          amplitude: 1,
          phase: 0,
          collapsed: true,
          position: { x: 0, y: 0, z: 0 },
        },
      }),
    );

    // connection_ack 先到（谓词跳过），随后是错误帧
    const frame = await waitForWsMessage<{
      type?: string;
      content?: { code?: string; message?: string };
    }>(ws, (msg) => msg.type === 'error');
    assert.equal(frame.content?.code, 'unknown_message_type', '稳定 code 供客户端编程判定');
    assert.ok(String(frame.content?.message).includes('bogus'), '错误消息指名被拒类型');
    assert.equal(bus.getMetrics().security.unknownTypeRejections, 1, '未知类型拒绝必须计数');
    assert.equal(bus.getMessageQueueSize(), 0, '未知类型不得进入路由/离线队列');

    // 连接保持打开：同连接后续合法流量（authenticate）照常工作
    ws.send(JSON.stringify({ type: 'authenticate', agentId: 'agent-1' }));
    await waitForBusEvent(
      bus,
      'agent_authenticated',
      (e: { agentId: string }) => e.agentId === 'agent-1',
    );
    assert.equal(ws.readyState, WebSocket.OPEN, '未知类型是协议协商问题，不断连');
    ws.close();
  });

  it('缺失 type 同为未知类型（error 帧 + 计数）；已知类型不触发', async () => {
    const bus = new QuantumBus({ communication: { port: 0 } });
    buses.push(bus);
    await bus.start();

    const ws = await openSocket(bus.getPort()!);
    const frame = JSON.stringify({
      id: 'no-type',
      sourceAgentId: 'agent-1',
      content: {},
      timestamp: new Date().toISOString(),
      priority: 'medium',
      quantumState: {
        id: 'q',
        amplitude: 1,
        phase: 0,
        collapsed: true,
        position: { x: 0, y: 0, z: 0 },
      },
    });
    ws.send(frame);
    await waitForWsMessage<{ type?: string; content?: { code?: string } }>(
      ws,
      (msg) => msg.type === 'error' && msg.content?.code === 'unknown_message_type',
    );
    assert.equal(bus.getMetrics().security.unknownTypeRejections, 1);
    ws.close();
  });
});
