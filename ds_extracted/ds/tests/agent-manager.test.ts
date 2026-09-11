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

  function newManager(config: ConstructorParameters<typeof AgentManager>[0] = {}): AgentManager {
    const manager = new AgentManager(config);
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

  it('健康检查不会因同一agent双重计数而为负（注入单调时钟驱动真离线）', () => {
    // 08#45 之后失联判定只读单调旁账——操纵公开的 lastHeartbeat 墙钟
    // 字段对 checkSystemHealth 已是死路径。经 monotonicClock 注入虚拟
    // 时钟，才能真正把 agent 推过 staleThreshold（max(30s, 3×间隔)），
    // 使「同时离线且过载」的并集去重被实际执行而非空转。
    let mono = 0;
    const manager = newManager({ monotonicClock: () => mono });
    const agent = manager.registerAgent({ name: 'A1', type: 'developer', capabilities: [] });
    const fresh = manager.registerAgent({ name: 'A2', type: 'developer', capabilities: [] });

    manager.setAgentState(agent.id, 'overloaded');
    mono += 60_000; // 超过 30s 下限：两个旁账都陈旧……
    manager.heartbeat(fresh.id); // ……但 fresh 刚心跳：旁账刷新到 60s 时点

    const health = manager.checkSystemHealth();
    assert.equal(health.offlineAgents, 1, '只有时钟推进的 agent 判离线');
    assert.equal(health.overloadedAgents, 1);
    // agent 同时命中离线与过载两个集合——并集去重后只计一次异常
    assert.equal(health.healthyAgents, 1, 'fresh agent 仍健康');
    assert.equal(health.systemHealth, 0.5);
    assert.ok(health.systemHealth >= 0, '并集去重保证健康度不为负');
  });

  it('单调旁账口径：墙钟字段回拨不影响失联判定（NTP 跳变免疫）', () => {
    const mono = 0;
    const manager = newManager({ monotonicClock: () => mono });
    const agent = manager.registerAgent({ name: 'A1', type: 'developer', capabilities: [] });
    // 墙钟被回拨 1 小时（旧路径会凭空制造 offline）
    agent.lastHeartbeat = new Date(Date.now() - 3_600_000);
    const health = manager.checkSystemHealth();
    assert.equal(health.offlineAgents, 0, '旁账新鲜：墙钟回拨不产生假离线');
    assert.equal(health.healthyAgents, 1);
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
