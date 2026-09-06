import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import QuantumMultiAgentPlatform from '../src/index.js';

describe('QuantumMultiAgentPlatform 端到端', () => {
  let platform: QuantumMultiAgentPlatform | null = null;

  after(() => {
    platform?.stop();
  });

  it('start注册系统agent并建立纠缠网络', async () => {
    platform = new QuantumMultiAgentPlatform({
      communication: { port: 0 },
      performance: { metricsInterval: 60000 }, // 测试中不刷日志
    });

    await platform.start();

    const agents = platform.getAgents();
    const names = agents.map((a) => a.name);

    assert.ok(names.includes('Quantum Developer'));
    assert.ok(names.includes('Quantum Tester'));
    assert.ok(names.includes('Quantum Deployer'));
    assert.ok(names.includes('Quantum Monitor'));
    assert.equal(platform.agentManager.getEntanglements().length, 3);
    assert.equal(platform.quantumBus.isStarted(), true);
    assert.ok(platform.quantumBus.getPort()! > 0);
  });

  it('完整任务生命周期：提交→自动分配→完成→释放', async () => {
    const platform2 = new QuantumMultiAgentPlatform({
      communication: { port: 0 },
      performance: { metricsInterval: 60000 },
    });
    await platform2.start();

    const coder = platform2.registerAgent({
      name: 'Coder',
      type: 'developer',
      capabilities: ['rust'],
    });

    // 唯一具备rust能力的coder空闲，任务提交后立即分配
    const task = platform2.submitTask({
      name: 'Rewrite in Rust',
      type: 'refactor',
      priority: 'high',
      requirements: [{ type: 'capability', name: 'rust', value: null, weight: 1.0 }],
    });
    assert.equal(task.status, 'assigned');
    assert.equal(coder.state, 'working');

    platform2.completeTask(task.id, true, { loc: 100 });

    assert.equal(task.status, 'completed');
    assert.equal(coder.state, 'idle');

    const metrics = platform2.getSystemMetrics();
    assert.equal(metrics.scheduler.completedTasks, 1);
    assert.ok(metrics.health.systemHealth > 0);

    platform2.stop();
    assert.equal(platform2.quantumBus.isStarted(), false);
  });

  it('配置深合并：局部覆盖不丢失其余默认值', () => {
    const p = new QuantumMultiAgentPlatform({
      communication: { port: 9999 },
    });

    assert.equal(p.config.communication.port, 9999);
    assert.equal(p.config.communication.heartbeatInterval, 5000);
    assert.equal(p.config.scheduling.maxConcurrentTasks, 100);
    assert.equal(p.config.performance.metricsInterval, 10000);
  });

  it('stop幂等且未启动的stop安全', () => {
    const p = new QuantumMultiAgentPlatform({ communication: { port: 0 } });
    p.stop(); // 未启动，应安全返回
    assert.doesNotThrow(() => {
      p.stop();
    });
  });
});
