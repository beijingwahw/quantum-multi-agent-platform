/**
 * QuantumBus 生命周期与攻击面可观测性回归网（2026-09-11 质量跃迁批次）。
 *
 * ① start()/shutdown() 竞争悬挂（P1，本次修复）：bind 被关闭打断后
 *    'listening' 与 'error' 均不再到来，在途 start() Promise 永久悬挂
 *    ——等待方无限 await（进程级挂死）。修复为 shutdown() 对在途启动
 *    以 StateError 确定性拒绝收尾；正常先启动后关闭的路径不受影响。
 * ② identitySpoofRejections 从不递增（P2，本次修复）：已认证连接冒用
 *    他人 agentId 的拒绝路径此前只 warn 不计数，指标文档承诺的
 *    「冒用次数」恒为 0——监控/告警对该攻击面失明。
 * ③ unauthenticatedRejections 漏计控制台路径（P2，本次修复）：指标
 *    文档口径为「订阅/发消息/控制台命令」，console_query/console_command
 *    的未认证拒绝此前只 warn 不计数（订阅/消息路径已计数）。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';

import { QuantumBus } from '../../src/communication/quantum-bus.js';
import { StateError } from '../../src/utils/errors.js';

function openSocket(port: number, path = '/quantum-bus'): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`);
    ws.once('open', () => resolve(ws));
    ws.once('error', reject);
  });
}

/** 等待总线事件（谓词命中即收），超时拒绝——静默拒绝路径无事件可等时用短窗吸收 */
function waitForEvent<T>(
  bus: QuantumBus,
  name: string,
  predicate: (e: T) => boolean,
  timeoutMs = 3000,
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
      reject(new Error(`timeout waiting for '${name}'`));
    }, timeoutMs);
    bus.on(name, listener);
  });
}

describe('QuantumBus 生命周期回归', () => {
  it('shutdown() 竞争在途 start()：Promise 确定性拒绝而非永久悬挂', async () => {
    const bus = new QuantumBus({ communication: { port: 0 } });
    const startPromise = bus.start();
    // 不 await：在 'listening' 到来前紧急制动
    bus.shutdown();

    // 此前该 await 永久悬挂（listening/error 都不再到来）；
    // 现在必须以 StateError 确定性拒绝，且带上有定位价值的消息
    await assert.rejects(
      startPromise,
      (error: unknown) =>
        error instanceof StateError && error.message.includes('before start() finished listening'),
    );

    // 竞争收尾后总线回到干净的可重启状态
    assert.equal(bus.isStarted(), false);
    assert.equal(bus.getPort(), null);
    await bus.start();
    assert.equal(bus.isStarted(), true);
    bus.shutdown();
  });

  it('边界：先完成 start() 再 shutdown() 的正常路径仍为 resolve（非拒绝）', async () => {
    const bus = new QuantumBus({ communication: { port: 0 } });
    await bus.start();
    bus.shutdown();
    // shutdown 后重复 start()/shutdown() 组合不再抛未捕获拒绝
    const second = bus.start();
    bus.shutdown();
    await assert.rejects(second, /before start\(\) finished listening/);
  });
});

describe('QuantumBus 攻击面可观测性回归', () => {
  it('已认证连接冒用他人 agentId 发消息 → 拒绝并计入 identitySpoofRejections', async () => {
    const bus = new QuantumBus({ communication: { port: 0, authToken: 't0k3n' } });
    await bus.start();
    try {
      const ws = await openSocket(bus.getPort()!);
      ws.send(JSON.stringify({ type: 'authenticate', agentId: 'ag1', token: 't0k3n' }));
      await waitForEvent<{ agentId: string }>(
        bus,
        'agent_authenticated',
        (e) => e.agentId === 'ag1',
      );

      // 冒用 ag2 的身份发常规消息：必须被拒（消息不投递）且计数 +1
      ws.send(
        JSON.stringify({
          id: 'spoof-1',
          type: 'request',
          sourceAgentId: 'ag2',
          content: {},
          priority: 'medium',
          quantumState: { id: 'qs', amplitude: 1, phase: 0, collapsed: true },
        }),
      );
      // 静默拒绝无事件可等（设计如此），按时间窗吸收 CI 负载
      await new Promise((r) => setTimeout(r, 200));

      assert.equal(
        bus.getMetrics().security.identitySpoofRejections,
        1,
        '冒用拒绝必须计入指标（此前恒为 0，攻击面失明）',
      );
      ws.close();
    } finally {
      bus.shutdown();
    }
  });

  it('未认证 console_query / console_command → 拒绝并计入 unauthenticatedRejections', async () => {
    const bus = new QuantumBus({ communication: { port: 0, authToken: 't0k3n' } });
    await bus.start();
    try {
      const ws = await openSocket(bus.getPort()!);

      // 未认证即查询快照 / 下发远程命令：两者都只 warn 不计数（缺陷）
      ws.send(JSON.stringify({ type: 'console_query' }));
      ws.send(JSON.stringify({ type: 'console_command', action: 'submit_task', payload: {} }));
      // 快照响应只发给已认证连接的事件不适用——这里等一小窗让总线吸收两帧
      await new Promise((r) => setTimeout(r, 200));

      assert.equal(
        bus.getMetrics().security.unauthenticatedRejections,
        2,
        '控制台两条未认证路径各计一次（与订阅/消息路径同口径）',
      );
      ws.close();
    } finally {
      bus.shutdown();
    }
  });
});
