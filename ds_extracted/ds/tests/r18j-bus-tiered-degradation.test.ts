/**
 * R18-J 红测+钉板：总线分级降质背压（opt-in）。
 *
 * 定罪机制（红测先行）：慢消费者现状＝sendToConnection 仅有
 * bufferedAmount > MAX_BUFFERED_BYTES(4MiB) 的单阈值断开，0..4MiB
 * 区间是无观测、无分级、无缓解动作的无界缓冲——水位 2.5MiB 时全部
 * 消息（含 low 优先级）无条件 send 进 ws 缓冲，服务端没有任何背压
 * 信号（无事件/无计数/无降质），且 slowConsumerDegradation 配置键
 * 被静默忽略（连构造期拒绝都没有）。本文件以「配置分级后必有滞回
 * 分级事件/计数/动作」断言定罪现状（红），实施后转绿；未配置路径
 * 的行为逐字节钉死既有语义（负对照：新路径不可达）。
 *
 * 测试手法：白盒注入 mock ws 连接（bufferedAmount 由测试逐消息驱动，
 * 精确控制水位脚本）——真 WS 客户端的 TCP 窗口水位不可精确复现，
 * 端到端投递面由既有邻居测试（quantum-bus/r13/r15p1）覆盖。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';
import { QuantumBus } from '../src/communication/quantum-bus.js';
import { ConfigurationError } from '../src/utils/errors.js';

// ----------------------------------------------------------------------------
// 辅助：可控 mock 慢消费者连接（水位脚本驱动滞回状态机）
// ----------------------------------------------------------------------------

interface MockWs {
  readyState: number;
  bufferedAmount: number;
  sent: string[];
  closeCalls: Array<{ code: number | undefined; reason: string | undefined }>;
  send(payload: string): void;
  close(code?: number, reason?: string): void;
}

/** 注入一条 mock 连接（未认证哨兵 '' 之外的完整身份），返回句柄 */
function injectSlowConsumer(
  bus: QuantumBus,
  agentId: string,
  initialBuffered = 0,
): { connectionId: string; ws: MockWs } {
  const ws: MockWs = {
    readyState: WebSocket.OPEN,
    bufferedAmount: initialBuffered,
    sent: [],
    closeCalls: [],
    send(payload: string): void {
      this.sent.push(payload);
    },
    close(code?: number, reason?: string): void {
      this.closeCalls.push({ code, reason });
    },
  };
  const connectionId = randomUUID();
  const connection = {
    id: connectionId,
    agentId,
    ws,
    lastPing: new Date(),
    subscriptions: [] as string[],
  };
  const internals = bus as unknown as {
    connections: Map<string, unknown>;
    connectionsByAgent: Map<string, unknown[]>;
  };
  internals.connections.set(connectionId, connection);
  const conns = internals.connectionsByAgent.get(agentId);
  if (conns === undefined) internals.connectionsByAgent.set(agentId, [connection]);
  else conns.push(connection);
  return { connectionId, ws };
}

interface TierChangedEvent {
  connectionId: string;
  from: number;
  to: number;
  action: string | null;
  bufferedAmount: number;
}

/** 收集分级降质事件（降级永不静默的观测面） */
function collectTierEvents(bus: QuantumBus): TierChangedEvent[] {
  const events: TierChangedEvent[] = [];
  bus.on('slow_consumer_tier_changed', (event: TierChangedEvent) => {
    events.push(event);
  });
  return events;
}

/** 解析 mock ws 已发送帧的 (type, content) 摘要 */
function sentFrames(ws: MockWs): Array<{ id: string; priority: string; seq: number }> {
  return ws.sent.map((frame) => {
    const parsed = JSON.parse(frame) as { id: string; priority: string; content: { seq: number } };
    return { id: parsed.id, priority: parsed.priority, seq: parsed.content.seq };
  });
}

const MB = 1024 * 1024;

// ----------------------------------------------------------------------------
// 红测定罪：慢消费者现状（0..4MiB 区间）无背压面
// ----------------------------------------------------------------------------

describe('R18-J 红测定罪 · 慢消费者无界缓冲无背压面', () => {
  it('定罪：配置分级降质后，2.5MiB 慢消费者水位仍零事件零计数零动作（现状＝配置被静默忽略）', () => {
    const bus = new QuantumBus({
      communication: {
        port: 0,
        slowConsumerDegradation: {
          // 倍增阈值：缺省恢复线 floor(t/2) 恰等于前级阈值——带划分
          // 合法边界（等差阈值下缺省恢复线必破带，构造期拒绝）
          tiers: [
            { thresholdBytes: 1 * MB, action: 'warn' },
            { thresholdBytes: 2 * MB, action: 'shed-low-priority' },
            { thresholdBytes: 4 * MB, action: 'quarantine' },
          ],
        },
      },
    });
    const events = collectTierEvents(bus);
    const { ws } = injectSlowConsumer(bus, 'slow-agent', 2.5 * MB);

    // 水位 2.5MiB：应进入第 2 级（shed）——low 被丢、medium 照发
    bus.createMessage('src', 'request', { seq: 1 }, 'slow-agent', undefined, 'low');
    bus.createMessage('src', 'request', { seq: 2 }, 'slow-agent', undefined, 'medium');

    assert.equal(
      events.length,
      1,
      '进入降级级必须发 slow_consumer_tier_changed 事件（降级永不静默）',
    );
    assert.equal(events[0]?.from, 0);
    assert.equal(events[0]?.to, 2, '2.5MiB ≥ 2MiB 进入 shed 级');
    const frames = sentFrames(ws).map((f) => f.seq);
    assert.deepEqual(frames, [2], 'shed 级丢 low 保 medium——现状两条都无条件入缓冲（无界）');
    const metrics = bus.getSlowConsumerDegradationMetrics();
    assert.ok(metrics !== null, '配置后必须有分级观测面');
    assert.equal(metrics.tierEntries[1], 1, '第 2 级进入计数');
    assert.equal(metrics.shedDroppedMessages, 1, '被 shed 的 low 消息计数');
    bus.shutdown();
  });

  it('定罪：走私阈值配置被静默接受（现状无构造期校验）', () => {
    assert.throws(
      () =>
        new QuantumBus({
          communication: {
            port: 0,
            slowConsumerDegradation: { tiers: [{ thresholdBytes: 0, action: 'warn' }] },
          },
        }),
      (error: unknown) =>
        error instanceof ConfigurationError && error.message.includes('thresholdBytes'),
      'thresholdBytes=0 必须构造期具名拒绝',
    );
  });
});

// ----------------------------------------------------------------------------
// 负对照：未配置时新路径不可达（缺省字节不变）
// ----------------------------------------------------------------------------

describe('R18-J 负对照 · 未配置时新路径不可达', () => {
  it('未配置：2.5MiB 水位全部消息无条件照发、零事件、观测面 null——与现状逐字节一致', () => {
    const bus = new QuantumBus({ communication: { port: 0 } });
    const events = collectTierEvents(bus);
    const { ws } = injectSlowConsumer(bus, 'slow-agent', 2.5 * MB);

    for (const priority of ['low', 'medium', 'high'] as const) {
      bus.createMessage('src', 'request', { seq: priority }, 'slow-agent', undefined, priority);
    }

    assert.equal(ws.sent.length, 3, '未配置时任何水位下消息照发（既有无背压行为不变）');
    assert.equal(events.length, 0, '未配置时零分级事件');
    assert.equal(bus.getSlowConsumerDegradationMetrics(), null, '未配置时观测面不存在');
    assert.equal(bus.getMetrics().droppedMessages, 0);
    bus.shutdown();
  });

  it('未配置：4MiB 硬顶既有断开逐字节不变（1013 + slow consumer + droppedMessages 入既有账）', () => {
    const bus = new QuantumBus({ communication: { port: 0 } });
    const events = collectTierEvents(bus);
    const { ws } = injectSlowConsumer(bus, 'slow-agent', 4 * MB + 1);

    const delivered = bus.sendToAgent('slow-agent', {
      id: randomUUID(),
      type: 'request',
      sourceAgentId: 'src',
      content: { seq: 1 },
      timestamp: new Date(),
      priority: 'medium',
      quantumState: {
        id: 'q',
        amplitude: 1,
        phase: 0,
        collapsed: true,
        position: { x: 0, y: 0, z: 0 },
      },
    });

    assert.equal(delivered, false, '硬顶断开后 sendToAgent 返回 false（消息回退入离线队列）');
    assert.deepEqual(
      ws.closeCalls,
      [{ code: 1013, reason: 'slow consumer' }],
      '既有硬顶断开帧逐字节不变',
    );
    assert.equal(ws.sent.length, 0);
    assert.equal(bus.getMetrics().droppedMessages, 1, '硬顶丢弃计入既有 droppedMessages');
    assert.equal(bus.getMessageQueueSize(), 1, '断开后消息按既有回退语义入离线队列');
    assert.equal(events.length, 0, '未配置时硬顶路径同样零分级事件');
    bus.shutdown();
  });

  it('未配置：getMetrics 键集与既有形状精确一致（位同构钉板）', () => {
    const bus = new QuantumBus({ communication: { port: 0 } });
    const metrics = bus.getMetrics();
    assert.deepEqual([...Object.keys(metrics)].sort(), [
      'activeConnections',
      'agentsOnline',
      'connections',
      'droppedMessages',
      'messageQueueSize',
      'port',
      'security',
      'started',
      'uptime',
    ]);
    assert.deepEqual([...Object.keys(metrics.security)].sort(), [
      'connectionLimitRejections',
      'identityRebindRejections',
      'identitySpoofRejections',
      'invalidAgentIdRejections',
      'invalidChannelRejections',
      'malformedDisconnects',
      'queuedAgentBuckets',
      'rateLimitDisconnects',
      'unauthenticatedRejections',
      'unknownTypeDisconnects',
      'unknownTypeRejections',
    ]);
    bus.shutdown();
  });
});

// ----------------------------------------------------------------------------
// 配置走私拒绝：构造期具名 ConfigurationError
// ----------------------------------------------------------------------------

describe('R18-J 走私拒绝 · 分级阈值配置的构造期校验', () => {
  const make = (tiers: unknown): QuantumBus =>
    new QuantumBus({
      communication: { port: 0, slowConsumerDegradation: { tiers } as never },
    });

  it('形状走私：tiers 非数组/空数组/tier 非对象逐项具名拒绝', () => {
    assert.throws(() => make(undefined), /tiers.*non-empty array/);
    assert.throws(() => make('nope'), /tiers.*non-empty array/);
    assert.throws(() => make([]), /tiers.*non-empty array/);
    assert.throws(() => make([42]), /tiers\[0\].*object/);
  });

  it('阈值走私：非正整数/非数字/非严格递增（相等与倒序）逐项具名拒绝', () => {
    assert.throws(() => make([{ thresholdBytes: 0, action: 'warn' }]), /thresholdBytes.*positive/);
    assert.throws(() => make([{ thresholdBytes: -5, action: 'warn' }]), /thresholdBytes.*positive/);
    assert.throws(
      () => make([{ thresholdBytes: 1.5, action: 'warn' }]),
      /thresholdBytes.*positive/,
    );
    assert.throws(
      () => make([{ thresholdBytes: '1000', action: 'warn' } as never]),
      /thresholdBytes.*positive/,
    );
    assert.throws(
      () =>
        make([
          { thresholdBytes: 2000, action: 'warn' },
          { thresholdBytes: 2000, action: 'warn' },
        ]),
      /strictly greater/,
    );
    assert.throws(
      () =>
        make([
          { thresholdBytes: 2000, action: 'warn' },
          { thresholdBytes: 1000, action: 'warn' },
        ]),
      /strictly greater/,
    );
  });

  it('动作走私：未知/缺失 action 具名拒绝（错误消息列出合法值）', () => {
    assert.throws(
      () => make([{ thresholdBytes: 1000, action: 'explode' }]),
      /action.*'warn' \| 'shed-low-priority' \| 'quarantine'/,
    );
    assert.throws(
      () => make([{ thresholdBytes: 1000 } as never]),
      /action.*'warn' \| 'shed-low-priority' \| 'quarantine'/,
    );
  });

  it('恢复线走私：越自身阈值/越前级阈值/非整数逐项具名拒绝（滞回带划分良定义）', () => {
    // ≥ 自身 thresholdBytes：带宽为 0/负
    assert.throws(
      () => make([{ thresholdBytes: 2000, action: 'warn', recoverBytes: 2000 }]),
      /recoverBytes/,
    );
    assert.throws(
      () => make([{ thresholdBytes: 2000, action: 'warn', recoverBytes: 2500 }]),
      /recoverBytes/,
    );
    // < 前级 thresholdBytes：line 序列单调性破缺（带间空洞）
    assert.throws(
      () =>
        make([
          { thresholdBytes: 2000, action: 'warn' },
          { thresholdBytes: 3000, action: 'warn', recoverBytes: 1500 },
        ]),
      /recoverBytes/,
    );
    assert.throws(
      () => make([{ thresholdBytes: 2000, action: 'warn', recoverBytes: -1 }]),
      /recoverBytes/,
    );
    assert.throws(
      () => make([{ thresholdBytes: 2000, action: 'warn', recoverBytes: 1.5 }]),
      /recoverBytes/,
    );
    // 缺省恢复线 floor(t/2) 同样受带划分约束：相邻级过近时拒绝并要求显式配置
    assert.throws(
      () =>
        make([
          { thresholdBytes: 1000, action: 'warn' },
          { thresholdBytes: 1100, action: 'warn' },
        ]),
      /recoverBytes/,
    );
  });

  it('合法边界：recoverBytes=0（最低级）与等于前级阈值可通过构造', () => {
    const bus = make([
      { thresholdBytes: 2000, action: 'warn', recoverBytes: 0 },
      { thresholdBytes: 3000, action: 'warn', recoverBytes: 2000 },
    ]);
    assert.ok(bus.getSlowConsumerDegradationMetrics() !== null);
    bus.shutdown();
  });
});

// ----------------------------------------------------------------------------
// 分级状态机与动作（滞回带良定义）
// ----------------------------------------------------------------------------

describe('R18-J 分级状态机 · 滞回带与降质动作', () => {
  it('warn 级：进入事件+计数+消息照发；滞回带内保持无重复事件；低于恢复线才恢复', () => {
    const bus = new QuantumBus({
      communication: {
        port: 0,
        slowConsumerDegradation: {
          tiers: [{ thresholdBytes: 1000, action: 'warn', recoverBytes: 400 }],
        },
      },
    });
    const events = collectTierEvents(bus);
    const { ws } = injectSlowConsumer(bus, 'slow-agent');

    ws.bufferedAmount = 0;
    bus.createMessage('src', 'request', { seq: 1 }, 'slow-agent');
    assert.equal(events.length, 0, '水位 0 不进入任何级');

    ws.bufferedAmount = 1000; // 恰达进入线（>=）
    bus.createMessage('src', 'request', { seq: 2 }, 'slow-agent');
    assert.equal(events.length, 1, '恰达阈值即进入（含边界）');
    assert.equal(events[0]?.to, 1);
    assert.equal(events[0]?.action, 'warn');

    ws.bufferedAmount = 999; // 滞回带 [400, 1000)：保持 warn 级
    bus.createMessage('src', 'request', { seq: 3 }, 'slow-agent');
    assert.equal(events.length, 1, '带内不抖动（无事件风暴）');

    ws.bufferedAmount = 500; // 仍在带内（从 1 级视角：保持线 400）
    bus.createMessage('src', 'request', { seq: 4 }, 'slow-agent');
    assert.equal(events.length, 1, '500 ≥ 恢复线 400：保持降级（滞回）');

    ws.bufferedAmount = 399; // 严格低于恢复线：恢复
    bus.createMessage('src', 'request', { seq: 5 }, 'slow-agent');
    assert.equal(events.length, 2);
    assert.equal(events[1]?.from, 1);
    assert.equal(events[1]?.to, 0);
    assert.equal(events[1]?.action, null);

    assert.equal(ws.sent.length, 5, 'warn 级消息全部照发（仅观测不拒发）');
    const metrics = bus.getSlowConsumerDegradationMetrics()!;
    assert.deepEqual(metrics.tierEntries, [1]);
    assert.deepEqual(metrics.tierExits, [1]);
    assert.equal(metrics.degradedConnections.length, 0, '恢复后无降级连接');
    bus.shutdown();
  });

  it('两级跨级：0→2 直接升级、逐级回落（2→1→0），事件链精确', () => {
    const bus = new QuantumBus({
      communication: {
        port: 0,
        slowConsumerDegradation: {
          tiers: [
            { thresholdBytes: 1000, action: 'warn', recoverBytes: 400 },
            { thresholdBytes: 2000, action: 'shed-low-priority', recoverBytes: 1200 },
          ],
        },
      },
    });
    const events = collectTierEvents(bus);
    const { ws } = injectSlowConsumer(bus, 'slow-agent');

    ws.bufferedAmount = 2500;
    bus.createMessage('src', 'request', { seq: 1 }, 'slow-agent');
    assert.deepEqual(
      events.map((e) => [e.from, e.to]),
      [[0, 2]],
      '水位跨两级直接升到最深级',
    );
    assert.equal(events[0]?.action, 'shed-low-priority');

    ws.bufferedAmount = 1500; // 2 级保持带 [1200, 2000)
    bus.createMessage('src', 'request', { seq: 2 }, 'slow-agent');
    assert.equal(events.length, 1, '带内保持无新事件');

    ws.bufferedAmount = 1100; // < 2 级恢复线 1200，但 ≥ 1 级进入线 1000 → 降一级
    bus.createMessage('src', 'request', { seq: 3 }, 'slow-agent');
    assert.deepEqual(
      events.map((e) => [e.from, e.to]),
      [
        [0, 2],
        [2, 1],
      ],
      '逐级回落不跳级',
    );

    ws.bufferedAmount = 399; // < 1 级恢复线 400
    bus.createMessage('src', 'request', { seq: 4 }, 'slow-agent');
    assert.deepEqual(
      events.map((e) => [e.from, e.to]),
      [
        [0, 2],
        [2, 1],
        [1, 0],
      ],
    );

    assert.equal(ws.sent.length, 4, 'warn/shed(medium) 均照发');
    const metrics = bus.getSlowConsumerDegradationMetrics()!;
    assert.deepEqual(metrics.tierEntries, [0, 1]);
    assert.deepEqual(metrics.tierExits, [1, 1]);
    bus.shutdown();
  });

  it('shed 级：low 被丢入离线桶、medium/high/critical 照发；恢复后积压重投递（降质不丢数据）', () => {
    const bus = new QuantumBus({
      communication: {
        port: 0,
        slowConsumerDegradation: {
          tiers: [{ thresholdBytes: 1000, action: 'shed-low-priority', recoverBytes: 400 }],
        },
      },
    });
    const events = collectTierEvents(bus);
    const { ws } = injectSlowConsumer(bus, 'slow-agent');

    ws.bufferedAmount = 1500;
    const lowMsg = bus.createMessage('src', 'request', { seq: 1 }, 'slow-agent', undefined, 'low');
    assert.equal(ws.sent.length, 0, 'low 在 shed 级被拒发');
    assert.equal(
      bus.getMessageQueueSize(),
      1,
      '单播拒发按既有回退语义入离线队列（有界缓冲替换无界 ws 缓冲）',
    );

    bus.createMessage('src', 'request', { seq: 2 }, 'slow-agent', undefined, 'medium');
    bus.createMessage('src', 'request', { seq: 3 }, 'slow-agent', undefined, 'high');
    bus.createMessage('src', 'request', { seq: 4 }, 'slow-agent', undefined, 'critical');
    assert.deepEqual(
      sentFrames(ws).map((f) => f.seq),
      [2, 3, 4],
      'medium/high/critical 照发（shed 只作用于确定的 low）',
    );
    assert.equal(bus.getSlowConsumerDegradationMetrics()!.shedDroppedMessages, 1);

    // 水位恢复：tier 1→0 事件 + 离线桶冲刷（low 重投递）+ 新消息照发
    ws.bufferedAmount = 300;
    bus.createMessage('src', 'request', { seq: 5 }, 'slow-agent', undefined, 'medium');
    assert.deepEqual(
      events.map((e) => [e.from, e.to]),
      [
        [0, 1],
        [1, 0],
      ],
    );
    assert.deepEqual(
      sentFrames(ws).map((f) => f.seq),
      [2, 3, 4, 1, 5],
      '恢复时积压的 low(seq=1) 先于新消息(seq=5)重投递',
    );
    assert.equal(
      sentFrames(ws).find((f) => f.seq === 1)?.id,
      lowMsg.id,
      '重投递的是原消息（同 id）',
    );
    assert.equal(bus.getMessageQueueSize(), 0);
    bus.shutdown();
  });

  it('quarantine 级：全部拒发+单播入离线队列；水位恢复后自动冲刷投递', () => {
    const bus = new QuantumBus({
      communication: {
        port: 0,
        slowConsumerDegradation: {
          tiers: [{ thresholdBytes: 1000, action: 'quarantine', recoverBytes: 400 }],
        },
      },
    });
    const events = collectTierEvents(bus);
    const { ws } = injectSlowConsumer(bus, 'slow-agent');

    ws.bufferedAmount = 1200;
    bus.createMessage('src', 'request', { seq: 1 }, 'slow-agent', undefined, 'critical');
    bus.createMessage('src', 'request', { seq: 2 }, 'slow-agent', undefined, 'medium');
    assert.equal(ws.sent.length, 0, 'quarantine 级全部拒发（critical 也不例外）');
    assert.equal(bus.getMessageQueueSize(), 2);
    assert.equal(bus.getSlowConsumerDegradationMetrics()!.quarantineDeferredMessages, 2);
    assert.equal(events.length, 1);
    assert.equal(events[0]?.action, 'quarantine');
    assert.equal(
      bus.getSlowConsumerDegradationMetrics()!.degradedConnections.length,
      1,
      '隔离中的连接在观测面可见',
    );

    ws.bufferedAmount = 300; // 恢复：降级事件 + 冲刷
    bus.createMessage('src', 'request', { seq: 3 }, 'slow-agent', undefined, 'medium');
    assert.deepEqual(
      sentFrames(ws).map((f) => f.seq),
      [1, 2, 3],
      '恢复后积压按序冲刷再投递新消息',
    );
    assert.equal(bus.getMessageQueueSize(), 0);
    assert.deepEqual(
      events.map((e) => [e.from, e.to]),
      [
        [0, 1],
        [1, 0],
      ],
    );
    assert.equal(bus.getSlowConsumerDegradationMetrics()!.degradedConnections.length, 0);
    bus.shutdown();
  });

  it('硬顶保持：配置路径下 bufferedAmount > 4MiB 仍走既有 1013 断开（分级不削弱最后防线）', () => {
    const bus = new QuantumBus({
      communication: {
        port: 0,
        slowConsumerDegradation: {
          tiers: [{ thresholdBytes: 1 * MB, action: 'warn' }],
        },
      },
    });
    const events = collectTierEvents(bus);
    const { ws } = injectSlowConsumer(bus, 'slow-agent', 4 * MB + 1);

    bus.createMessage('src', 'request', { seq: 1 }, 'slow-agent');
    assert.deepEqual(
      ws.closeCalls,
      [{ code: 1013, reason: 'slow consumer' }],
      '内置硬顶断开帧不变',
    );
    assert.equal(ws.sent.length, 0);
    assert.equal(bus.getMetrics().droppedMessages, 1, '硬顶丢弃仍计入既有 droppedMessages 账');
    assert.equal(events.length, 1, '硬顶前的 tier 升级事件照发（0→1）');
    assert.equal(events[0]?.to, 1);
    bus.shutdown();
  });

  it('多连接独立性：组播下慢消费者与正常消费者各自分级互不干扰', () => {
    const bus = new QuantumBus({
      communication: {
        port: 0,
        slowConsumerDegradation: {
          tiers: [{ thresholdBytes: 1000, action: 'shed-low-priority', recoverBytes: 400 }],
        },
      },
    });
    const events = collectTierEvents(bus);
    const slow = injectSlowConsumer(bus, 'agent-slow', 1500);
    const fast = injectSlowConsumer(bus, 'agent-fast', 0);

    bus.createMessage('src', 'request', { seq: 1 }, undefined, ['agent-slow', 'agent-fast'], 'low');

    assert.equal(slow.ws.sent.length, 0, '慢消费者 low 被拒发');
    assert.equal(fast.ws.sent.length, 1, '正常消费者照常收到');
    assert.equal(bus.getMessageQueueSize(), 1, '仅慢消费者一侧入离线桶');
    const metrics = bus.getSlowConsumerDegradationMetrics()!;
    assert.equal(metrics.degradedConnections.length, 1);
    assert.equal(metrics.degradedConnections[0]?.agentId, 'agent-slow');
    assert.equal(events.length, 1);
    assert.equal(events[0]?.connectionId, slow.connectionId);
    bus.shutdown();
  });
});
