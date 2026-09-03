import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { QuantumBus } from '../src/communication/quantum-bus.js';
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
      const client = new WebSocket(`ws://localhost:${port}/quantum-bus`);
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
});
