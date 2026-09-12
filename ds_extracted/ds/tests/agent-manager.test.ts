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
    assert.ok(a2.quantumEntanglement.includes(a1.id));

    manager.unregisterAgent(a1.id);

    assert.equal(manager.getAgent(a1.id), undefined);
    assert.ok(!a2.quantumEntanglement.includes(a1.id));
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

  it('过载阈值边界两侧：load === 阈值不过载，load === 阈值+1 过载（05#24）', () => {
    // 05#24: 阈值此前硬编码 80，测试只能循环 increaseLoad 81 次跨过
    // 边界——配置化后用小阈值直接驱动两侧
    const manager = newManager({ overloadThreshold: 5 });
    const agent = manager.registerAgent({ name: 'A1', type: 'developer', capabilities: [] });

    manager.increaseLoad(agent.id, 5);
    assert.equal(agent.load, 5);
    assert.equal(agent.state, 'idle', 'load === 阈值：不大于即不过载');

    manager.increaseLoad(agent.id);
    assert.equal(agent.state, 'overloaded', 'load === 阈值+1：过载');

    manager.decreaseLoad(agent.id);
    assert.equal(agent.state, 'idle', '回落到阈值：经 decreaseLoad 恢复 idle');
    assert.equal(agent.load, 5);
  });

  it('updateAgent 的 NaN load 被忽略：保留旧值且其余字段照常合并（05#24）', () => {
    const manager = newManager();
    const agent = manager.registerAgent({ name: 'A1', type: 'developer', capabilities: [] });
    manager.updateAgent(agent.id, { load: 10 });

    manager.updateAgent(agent.id, { load: Number.NaN, name: 'A1-renamed' });

    assert.ok(!Number.isNaN(agent.load), 'NaN 不得写入 load');
    assert.equal(agent.load, 10, '忽略 NaN 字段后保留旧值');
    assert.equal(agent.name, 'A1-renamed', '同批其余字段照常合并');
    assert.equal(agent.state, 'idle');
  });

  it('setAgentState 收口过载不变量：load 超阈时请求 idle/working 落 overloaded（08#42）', () => {
    const manager = newManager();
    const agent = manager.registerAgent({ name: 'A1', type: 'developer', capabilities: [] });
    manager.updateAgent(agent.id, { load: 85 });
    assert.equal(agent.state, 'overloaded');

    // 直写入口不得绕过不变量：高负载下请求非过载状态必须落 overloaded
    manager.setAgentState(agent.id, 'idle');
    assert.equal(agent.state, 'overloaded', 'load 85 > 80：请求 idle 落 overloaded');
    manager.setAgentState(agent.id, 'working');
    assert.equal(agent.state, 'overloaded', 'working 同理不得放行');

    // offline 是显式失联语义，不由负载推导
    manager.setAgentState(agent.id, 'offline');
    assert.equal(agent.state, 'offline');

    // 显式 overloaded（低负载）是合法状态：回落只经 decreaseLoad
    const other = newManager();
    const a2 = other.registerAgent({ name: 'A2', type: 'developer', capabilities: [] });
    other.setAgentState(a2.id, 'overloaded');
    assert.equal(a2.state, 'overloaded');
  });

  it('注销时清扫无纠缠记录的悬挂对端引用（01#14）', () => {
    const manager = newManager();
    const a1 = manager.registerAgent({ name: 'A1', type: 'developer', capabilities: [] });
    const a2 = manager.registerAgent({ name: 'A2', type: 'developer', capabilities: [] });

    // updateAgent 直写纠缠数组：无纠缠记录的引用不在 removeEntanglements
    // 的对端清理路径（08#46）上，注销时必须全表清扫出清
    manager.updateAgent(a1.id, { quantumEntanglement: [a2.id] });
    assert.ok(a1.quantumEntanglement.includes(a2.id));

    manager.unregisterAgent(a2.id);
    assert.ok(!a1.quantumEntanglement.includes(a2.id), '悬挂引用必须在注销时被清扫');
    assert.deepEqual(a1.quantumEntanglement, []);
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
    assert.ok(!Number.isNaN(metrics.averageLoad));
    assert.equal(metrics.averageLoad, 0);
  });
});
