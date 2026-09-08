import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { QuantumBus } from '../src/communication/quantum-bus.js';
import { ConfigurationError, MessageValidationError, PlatformError } from '../src/utils/errors.js';
import WebSocket from 'ws';

describe('QuantumBus', () => {
  const buses: QuantumBus[] = [];

  after(() => {
    buses.forEach((bus) => {
      bus.shutdown();
    });
  });

  it('未启动时不占用端口，离线消息进入队列', () => {
    const bus = new QuantumBus({ communication: { port: 8080 } });
    buses.push(bus);

    assert.equal(bus.isStarted(), false);
    assert.equal(bus.getPort(), null);

    const message = bus.createMessage('agent-1', 'request', { hello: true }, 'agent-2');
    assert.ok(message.id);
    assert.equal(bus.getMessageQueueSize(), 1);
    assert.equal(bus.getAgentsOnline().length, 0);
  });

  it('port 0启动时绑定随机端口', async () => {
    const bus = new QuantumBus({ communication: { port: 0 } });
    buses.push(bus);

    await bus.start();

    assert.equal(bus.isStarted(), true);
    assert.ok(bus.getPort()! > 0);
  });

  it('客户端连接收到connection_ack，认证后收到离线队列消息', async () => {
    const bus = new QuantumBus({ communication: { port: 0 } });
    buses.push(bus);

    // 客户端连接前，向目标agent发消息 → 进入离线队列
    bus.createMessage('agent-1', 'request', { payload: 'queued' }, 'agent-2');
    assert.equal(bus.getMessageQueueSize(), 1);

    await bus.start();
    const port = bus.getPort()!;

    const received: any[] = [];
    await new Promise<void>((resolve, reject) => {
      const client = new WebSocket(`ws://127.0.0.1:${port}/quantum-bus`);
      const timer = setTimeout(() => {
        reject(new Error('test timeout'));
      }, 5000);

      client.on('open', () => {
        client.send(JSON.stringify({ type: 'authenticate', agentId: 'agent-2' }));
      });

      client.on('message', (data: WebSocket.RawData) => {
        const msg = JSON.parse((data as Buffer).toString('utf8')) as { type?: string };
        received.push(msg);
        if (received.length >= 2) {
          clearTimeout(timer);
          client.close();
          resolve();
        }
      });

      client.on('error', reject);
    });

    // 第一条是connection_ack，第二条是离线队列冲刷的request
    assert.equal(received[0].type, 'connection_ack');
    assert.equal(received[1].type, 'request');
    assert.equal(received[1].content.payload, 'queued');
    assert.equal(bus.getMessageQueueSize(), 0);
    assert.deepEqual(bus.getAgentsOnline(), ['agent-2']);
  });

  it('shutdown后状态复位且可安全重复调用', async () => {
    const bus = new QuantumBus({ communication: { port: 0 } });
    await bus.start();
    bus.shutdown();
    bus.shutdown(); // 幂等

    assert.equal(bus.isStarted(), false);
    assert.equal(bus.getPort(), null);
  });

  it('离线队列超过上限时丢弃最旧消息并计数', () => {
    const bus = new QuantumBus({ communication: { port: 0, maxQueuedMessages: 3 } });
    buses.push(bus);

    for (let i = 0; i < 5; i++) {
      bus.createMessage('agent-1', 'request', { seq: i }, 'offline-agent');
    }

    assert.equal(bus.getMessageQueueSize(), 3);
    assert.equal(bus.getMetrics().droppedMessages, 2);
  });

  it('负对照：createMessage 空来源/目标并存/空目标列表抛 MessageValidationError', () => {
    const bus = new QuantumBus({ communication: { port: 0 } });
    buses.push(bus);

    // 空 sourceAgentId 此前构造出的消息会在 validateMessage 被静默丢弃
    assert.throws(
      () => bus.createMessage('', 'request', {}),
      (error: unknown) =>
        error instanceof MessageValidationError &&
        error instanceof PlatformError &&
        /sourceAgentId must be a non-empty string/.test(error.message),
    );
    // 单播/组播目标并存：targetAgentIds 此后被静默忽略
    assert.throws(
      () => bus.createMessage('a', 'request', {}, 'b', ['c', 'd']),
      /mutually exclusive/,
    );
    // 空目标数组：此前 forEach 零投递，静默无人收到
    assert.throws(() => bus.createMessage('a', 'request', {}, undefined, []), /non-empty array/);
    // 目标列表含空串/非字符串
    assert.throws(() => bus.createMessage('a', 'request', {}, undefined, ['x', '']), /entries/);
    assert.throws(
      () => bus.createMessage('a', 'request', {}, undefined, ['x', 42 as unknown as string]),
      /entries/,
    );

    // 边界：合法单播/组播/广播构造不受影响
    const unicast = bus.createMessage('a', 'request', { k: 1 }, 'offline');
    assert.ok(unicast.id);
    assert.equal(bus.getMessageQueueSize(), 1);
    bus.createMessage('a', 'request', {}, undefined, ['g1', 'g2']);
    assert.equal(bus.getMessageQueueSize(), 3); // g1/g2 离线各入队一条
    bus.createMessage('a', 'status_update', {});
  });

  it('负对照：构造期拒绝会造成静默损坏的总线限额配置', () => {
    // maxQueuedMessages<0 会让丢最旧消息的 while 在空队列上无限空转（挂死）
    assert.throws(
      () => new QuantumBus({ communication: { maxQueuedMessages: -1 } }),
      (error: unknown) =>
        error instanceof ConfigurationError &&
        /maxQueuedMessages.*non-negative/.test(error.message),
    );
    // maxSubscriptions<0 使容量判断恒 false、订阅上限被静默绕过
    assert.throws(
      () => new QuantumBus({ communication: { maxSubscriptions: -5 } }),
      /maxSubscriptions/,
    );
    assert.throws(
      () => new QuantumBus({ communication: { maxConnections: 0 } }),
      /maxConnections.*positive/,
    );
    assert.throws(
      () => new QuantumBus({ communication: { maxMessageSize: 0 } }),
      /maxMessageSize.*positive/,
    );
    // 心跳间隔/超时 ≤0：setInterval(fn, 0) 会退化成忙循环
    assert.throws(
      () => new QuantumBus({ communication: { heartbeatIntervalMs: 0 } }),
      /heartbeatIntervalMs.*positive/,
    );
    assert.throws(
      () => new QuantumBus({ communication: { heartbeatTimeoutMs: -1 } }),
      /heartbeatTimeoutMs.*positive/,
    );

    // 边界：合法限额（含 0=立即淘汰语义）不受影响
    const bus = new QuantumBus({
      communication: { port: 0, maxQueuedMessages: 0, maxSubscriptions: 0 },
    });
    buses.push(bus);
    bus.createMessage('a', 'request', {}, 'offline');
    assert.equal(bus.getMessageQueueSize(), 0); // 0=全丢弃（合法退化，计入 dropped）
    assert.equal(bus.getMetrics().droppedMessages, 1);
  });
});
