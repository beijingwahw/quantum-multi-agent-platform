/**
 * R15-P1 缺陷2红测：总线未知帧类型拒绝无逐连接熔断。
 *
 * 旧实现：已认证连接可无限发送未知类型帧（限速窗内 1000/s 的 logWarn +
 * 错误回帧）——日志与回帧都是可无限持续的放大面；畸形消息 F07 已有
 * 32 条断路器，未知帧没有。定罪机制：同连接连续发 32 个未知类型帧，
 * 断言连接被 1008 熔断断开并计入 security.unknownTypeDisconnects
 * （旧实现无熔断 → close 超时 → 红）。
 * 同时锁定：阈值前的逐帧行为（错误帧+unknownTypeRejections 计数）
 * 逐字节不变；可受理帧复位熔断（与 F07「可解析即复位」同位语义）。
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

function waitClose(ws: WebSocket, timeoutMs = 3_000): Promise<number | undefined> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('close timeout')), timeoutMs);
    ws.once('close', (code: number) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
}

function unknownFrame(n: number): string {
  return JSON.stringify({
    id: `bogus-${n}`,
    type: `bogus-${n}`,
    sourceAgentId: 'agent-x',
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
}

after(() => {
  for (const bus of buses) bus.shutdown();
});

describe('R15-P1 · 未知帧类型逐连接熔断（与 F07 同型阈值）', () => {
  it('同连接连续 32 个未知类型帧：1008 熔断断开 + unknownTypeDisconnects 计数', async () => {
    const bus = new QuantumBus({ communication: { port: 0 } });
    buses.push(bus);
    await bus.start();

    const ws = await openSocket(bus.getPort()!);
    for (let i = 1; i <= 32; i++) ws.send(unknownFrame(i));

    const code = await waitClose(ws);
    assert.equal(code, 1008, '未知类型洪泛必须以 1008 熔断断开');
    const security = bus.getMetrics().security;
    assert.equal(security.unknownTypeDisconnects, 1, '熔断断开计入 dedicated 计数');
    assert.equal(security.unknownTypeRejections, 32, '每帧仍计入逐帧拒绝计数（含触发帧）');
  });

  it('阈值前（31 帧）：连接保持打开、逐帧行为不变（错误帧 + 计数），无熔断', async () => {
    const bus = new QuantumBus({ communication: { port: 0 } });
    buses.push(bus);
    await bus.start();

    const ws = await openSocket(bus.getPort()!);
    for (let i = 1; i <= 31; i++) ws.send(unknownFrame(i));

    // 31 帧错误帧照常回发（connection_ack 之后逐帧到达）
    await new Promise<void>((resolve, reject) => {
      let errors = 0;
      const timer = setTimeout(() => reject(new Error('error frame timeout')), 3_000);
      ws.on('message', (data) => {
        try {
          const frame = JSON.parse((data as Buffer).toString('utf8')) as {
            type?: string;
            content?: { code?: string };
          };
          if (frame.type === 'error' && frame.content?.code === 'unknown_message_type') {
            errors++;
            if (errors >= 31) {
              clearTimeout(timer);
              resolve();
            }
          }
        } catch {
          /* 忽略非 JSON */
        }
      });
    });
    assert.equal(bus.getMetrics().security.unknownTypeRejections, 31);
    assert.equal(bus.getMetrics().security.unknownTypeDisconnects, 0);
    assert.equal(ws.readyState, WebSocket.OPEN, '31 帧（阈值 -1）不得触发熔断');
    ws.close();
  });

  it('可受理帧复位熔断：31 帧 → authenticate → 再 31 帧，全程不断开', async () => {
    const bus = new QuantumBus({ communication: { port: 0 } });
    buses.push(bus);
    await bus.start();

    const ws = await openSocket(bus.getPort()!);
    const authed = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('auth timeout')), 3_000);
      bus.once('agent_authenticated', () => {
        clearTimeout(timer);
        resolve();
      });
    });
    for (let i = 1; i <= 31; i++) ws.send(unknownFrame(i));
    ws.send(JSON.stringify({ type: 'authenticate', agentId: 'reset-probe' }));
    await authed;
    for (let i = 32; i <= 62; i++) ws.send(unknownFrame(i));

    await new Promise((r) => setTimeout(r, 300));
    assert.equal(bus.getMetrics().security.unknownTypeDisconnects, 0, '合法帧插入后熔断计数复位');
    assert.equal(ws.readyState, WebSocket.OPEN);
    ws.close();
  });
});
