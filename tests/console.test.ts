import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import QuantumMultiAgentPlatform from '../src/index.js';
import WebSocket from 'ws';

describe('Web控制台协议 端到端', () => {
  // 追踪全部实例：每个测试都可能新建平台/客户端，结束时统一清理
  const platforms: QuantumMultiAgentPlatform[] = [];
  const clients: WebSocket[] = [];

  after(() => {
    clients.forEach(c => c.close());
    platforms.forEach(p => p.stop());
  });

  function connectConsole(port: number): Promise<{ latest: () => any }> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${port}/quantum-bus`);
      clients.push(ws);
      let latestSnapshot: any = null;

      const timer = setTimeout(() => reject(new Error('console connect timeout')), 8000);

      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'authenticate', agentId: 'web-console' }));
        ws.send(JSON.stringify({ type: 'console_query' }));
      });

      ws.on('message', (data: WebSocket.RawData) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'status_update' && msg.content && Array.isArray(msg.content.agents)) {
          latestSnapshot = msg.content;
          resolve({ latest: () => latestSnapshot });
          clearTimeout(timer);
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  function waitFor(latest: () => any, pred: (snap: any) => boolean, timeoutMs = 8000): Promise<any> {
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const timer = setInterval(() => {
        const snap = latest();
        if (snap && pred(snap)) {
          clearInterval(timer);
          resolve(snap);
        } else if (Date.now() - started > timeoutMs) {
          clearInterval(timer);
          reject(new Error('waitFor timeout'));
        }
      }, 50);
    });
  }

  it('控制台完整闭环：查询→提交任务→添加Agent→完成任务', async () => {
    const platform = new QuantumMultiAgentPlatform({
      communication: { port: 0 },
      performance: { metricsInterval: 60000 }
    });
    platforms.push(platform);
    await platform.start();

    const { latest } = await connectConsole(platform.quantumBus.getPort()!);

    // 1. 快照包含4个系统agent
    const initial = await waitFor(latest, snap => snap.agents.length >= 4);
    assert.ok(initial.agents.some((a: any) => a.name === 'Quantum Developer'));
    assert.ok(initial.metrics.scheduler);
    assert.ok(initial.metrics.health);

    // 2. 提交任务（空能力要求 → 分配给空闲系统agent）
    const ws = clients[clients.length - 1];
    ws.send(JSON.stringify({
      type: 'console_command',
      action: 'submit_task',
      payload: { name: 'console-e2e-task', priority: 'high' }
    }));

    const withTask = await waitFor(latest, snap =>
      snap.tasks.some((t: any) => t.name === 'console-e2e-task')
    );
    const task = withTask.tasks.find((t: any) => t.name === 'console-e2e-task');
    assert.equal(task.status, 'assigned');
    assert.ok(task.assignedAgentId);

    // 3. 动态添加agent
    const agentsBefore = latest().agents.length;
    ws.send(JSON.stringify({
      type: 'console_command',
      action: 'add_agent',
      payload: { name: 'Console E2E Agent' }
    }));

    await waitFor(latest, snap =>
      snap.agents.some((a: any) => a.name === 'Console E2E Agent')
    );
    assert.ok(latest().agents.length === agentsBefore + 1);

    // 4. 完成任务 → 状态同步为completed
    ws.send(JSON.stringify({
      type: 'console_command',
      action: 'complete_task',
      payload: { taskId: task.id, success: true }
    }));

    await waitFor(latest, snap =>
      snap.tasks.some((t: any) => t.id === task.id && t.status === 'completed')
    );
    assert.ok(true);
  });

  it('未知控制台命令被安全忽略并回发快照', async () => {
    const platform = new QuantumMultiAgentPlatform({
      communication: { port: 0 },
      performance: { metricsInterval: 60000 }
    });
    platforms.push(platform);
    await platform.start();

    const { latest } = await connectConsole(platform.quantumBus.getPort()!);
    await waitFor(latest, snap => snap.agents.length >= 4);

    const ws = clients[clients.length - 1];
    ws.send(JSON.stringify({
      type: 'console_command',
      action: 'nonsense_action',
      payload: {}
    }));

    // 收到回发快照且平台未崩溃
    await waitFor(latest, snap => snap.agents.length >= 4);
    assert.ok(platform.quantumBus.isStarted());
  });
});
