/**
 * R15-P1 缺陷3红测：连接数封顶拒绝不入 security 计数。
 *
 * 旧实现：1013 拒绝只 logWarn——「攻击面可观测：被边界拒绝的流量分类
 * 计数」的设计注记应覆盖此路径（连接洪水是明确的攻击面信号，却不在
 * metrics 里）。定罪机制：maxConnections=1 时第二个连接被 1013 拒绝，
 * 断言 security.connectionLimitRejections === 1（旧实现无该计数 → 红）。
 */
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { QuantumBus } from '../src/communication/quantum-bus.js';

const buses: QuantumBus[] = [];

function openSocket(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/quantum-bus`);
    ws.once('open', () => resolve(ws));
    ws.once('error', reject);
  });
}

after(() => {
  for (const bus of buses) bus.shutdown();
});

describe('R15-P1 · 连接数封顶拒绝计入 security 计数面', () => {
  it('超限连接 1013 拒绝时 connectionLimitRejections 递增', async () => {
    const bus = new QuantumBus({ communication: { port: 0, maxConnections: 1 } });
    buses.push(bus);
    await bus.start();

    const first = await openSocket(bus.getPort()!);
    const second = new WebSocket(`ws://127.0.0.1:${bus.getPort()}/quantum-bus`);
    const closed = new Promise<number | undefined>((resolve) => {
      second.once('close', (code: number) => resolve(code));
    });
    assert.equal(await closed, 1013, '超限连接以 1013 拒绝（既有行为不变）');
    assert.equal(
      bus.getMetrics().security.connectionLimitRejections,
      1,
      '封顶拒绝必须计入 security 计数（攻击面可观测）',
    );

    // 第三条连接同样被拒：计数继续累积
    const third = new WebSocket(`ws://127.0.0.1:${bus.getPort()}/quantum-bus`);
    const closed3 = new Promise<number | undefined>((resolve) => {
      third.once('close', (code: number) => resolve(code));
    });
    assert.equal(await closed3, 1013);
    assert.equal(bus.getMetrics().security.connectionLimitRejections, 2);

    assert.equal(bus.getConnectionCount(), 1, '首个连接不受影响');
    first.close();
  });
});
