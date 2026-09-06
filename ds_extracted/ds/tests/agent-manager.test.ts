import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { AgentManager } from '../src/core/agent-manager.js';

describe('AgentManager', () => {
  const managers: AgentManager[] = [];

  after(() => {
    // 清理心跳定时器，避免测试进程无法退出
    managers.forEach((manager) => {
      manager.shutdown();
    });
  });

  function newManager(): AgentManager {
    const manager = new AgentManager({});
    managers.push(manager);
    return manager;
  }
  it('注册并查询agent', () => {
    const manager = newManager();
    const agent = manager.registerAgent({
      name: 'Dev',
      type: 'developer',
      capabilities: ['javascript'],
    });

    assert.ok(agent.id);
    assert.equal(manager.getAgent(agent.id)?.name, 'Dev');
    assert.equal(manager.getAgents().length, 1);
    assert.equal(agent.state, 'idle');
  });

  it('注销agent时清理其全部纠缠关系', () => {
    const manager = newManager();
    const a1 = manager.registerAgent({ name: 'A1', type: 'developer', capabilities: [] });
    const a2 = manager.registerAgent({ name: 'A2', type: 'developer', capabilities: [] });

    manager.createEntanglement(a1.id, a2.id);
    assert.equal(a2.quantumEntanglement.includes(a1.id), true);

    manager.unregisterAgent(a1.id);

    assert.equal(manager.getAgent(a1.id), undefined);
    assert.equal(a2.quantumEntanglement.includes(a1.id), false);
    assert.equal(manager.getEntanglements().length, 0);
  });

  it('重复创建纠缠是幂等的：仅增强已有纠缠', () => {
    const manager = newManager();
    const a1 = manager.registerAgent({ name: 'A1', type: 'developer', capabilities: [] });
    const a2 = manager.registerAgent({ name: 'A2', type: 'developer', capabilities: [] });

    manager.createEntanglement(a1.id, a2.id);
    manager.createEntanglement(a1.id, a2.id);

    assert.equal(manager.getEntanglements().length, 1);
    assert.equal(manager.getEntanglements()[0]!.strength, 0.2); // 0.1 + 0.1
  });

  it('负载超过80触发overloaded，回落触发idle', () => {
    const manager = newManager();
    const agent = manager.registerAgent({ name: 'A1', type: 'developer', capabilities: [] });

    for (let i = 0; i < 81; i++) {
      manager.increaseLoad(agent.id);
    }
    assert.equal(agent.state, 'overloaded');

    manager.decreaseLoad(agent.id, 81);
    assert.equal(agent.state, 'idle');
    assert.equal(agent.load, 0);
  });

  it('显式heartbeat刷新离线agent恢复idle', () => {
    const manager = newManager();
    const agent = manager.registerAgent({ name: 'A1', type: 'developer', capabilities: [] });

    manager.setAgentState(agent.id, 'offline');
    assert.equal(agent.state, 'offline');

    manager.heartbeat(agent.id);
    assert.equal(agent.state, 'idle');
  });

  it('健康检查不会因同一agent双重计数而为负', () => {
    const manager = newManager();
    const agent = manager.registerAgent({ name: 'A1', type: 'developer', capabilities: [] });

    // 同时离线且过载
    manager.setAgentState(agent.id, 'overloaded');
    agent.lastHeartbeat = new Date(Date.now() - 60000);

    const health = manager.checkSystemHealth();
    assert.equal(health.healthyAgents, 0);
    assert.equal(health.systemHealth, 0);
    assert.ok(health.systemHealth >= 0);
  });

  it('空系统健康度为1且平均负载不为NaN', () => {
    const manager = newManager();
    const health = manager.checkSystemHealth();
    const metrics = manager.getAgentMetrics();

    assert.equal(health.systemHealth, 1);
    assert.equal(Number.isNaN(metrics.averageLoad), false);
    assert.equal(metrics.averageLoad, 0);
  });
});
