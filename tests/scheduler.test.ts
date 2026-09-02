import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { QuantumScheduler } from '../src/core/quantum-scheduler.js';
import { Agent } from '../src/types/quantum-types.js';

function makeAgent(id: string, capabilities: string[], name = id): Agent {
  return {
    id,
    name,
    type: 'developer',
    capabilities,
    state: 'idle',
    load: 0,
    position: { x: 0, y: 0, z: 0 },
    quantumEntanglement: [],
    lastHeartbeat: new Date()
  };
}

function makeTask(name: string, capability: string, priority: any = 'medium') {
  return {
    name,
    type: 'test',
    priority,
    requirements: [
      { type: 'capability' as const, name: capability, value: null, weight: 1.0 }
    ],
    dependencies: [],
    estimatedDuration: 1000,
    actualDuration: 0,
    status: 'pending' as const
  };
}

describe('QuantumScheduler', () => {
  it('将任务分配给能力匹配的空闲agent', () => {
    const scheduler = new QuantumScheduler({});
    const agent = makeAgent('a1', ['javascript']);
    scheduler.registerAgent(agent);

    const task = scheduler.submitTask(makeTask('T1', 'javascript') as any);

    assert.equal(task.status, 'assigned');
    assert.equal(task.assignedAgentId, 'a1');
    assert.equal(agent.state, 'working');
    assert.equal(agent.load, 1);
  });

  it('能力不匹配时任务保持pending', () => {
    const scheduler = new QuantumScheduler({});
    scheduler.registerAgent(makeAgent('a1', ['python']));

    const task = scheduler.submitTask(makeTask('T1', 'javascript') as any);

    assert.equal(task.status, 'pending');
    assert.equal(task.assignedAgentId, undefined);
  });

  it('新agent注册后自动重调度挂起任务', () => {
    const scheduler = new QuantumScheduler({});
    const task = scheduler.submitTask(makeTask('T1', 'javascript') as any);
    assert.equal(task.status, 'pending');

    // 之后才注册具备能力的agent
    scheduler.registerAgent(makeAgent('a1', ['javascript']));

    assert.equal(task.status, 'assigned');
    assert.equal(task.assignedAgentId, 'a1');
  });

  it('completeTask完成任务并释放agent', () => {
    const scheduler = new QuantumScheduler({});
    const agent = makeAgent('a1', ['javascript']);
    scheduler.registerAgent(agent);
    const task = scheduler.submitTask(makeTask('T1', 'javascript') as any);

    const ok = scheduler.completeTask(task.id, true, { output: 'done' });

    assert.ok(ok);
    assert.equal(task.status, 'completed');
    assert.ok(task.completedAt);
    assert.equal(task.actualDuration >= 0, true);
    assert.equal(agent.state, 'idle');
    assert.equal(agent.load, 0);
  });

  it('completeTask失败路径标记failed并释放agent', () => {
    const scheduler = new QuantumScheduler({});
    const agent = makeAgent('a1', ['javascript']);
    scheduler.registerAgent(agent);
    const task = scheduler.submitTask(makeTask('T1', 'javascript') as any);

    scheduler.completeTask(task.id, false);

    assert.equal(task.status, 'failed');
    assert.equal(agent.state, 'idle');
    assert.equal(agent.load, 0);
  });

  it('任务释放容量后挂起的低优先级任务获得调度', () => {
    const scheduler = new QuantumScheduler({});
    const agent = makeAgent('a1', ['javascript']);
    scheduler.registerAgent(agent);

    const first = scheduler.submitTask(makeTask('T1', 'javascript', 'low') as any);
    const second = scheduler.submitTask(makeTask('T2', 'javascript', 'low') as any);
    assert.equal(first.status, 'assigned');
    assert.equal(second.status, 'pending'); // 唯一agent忙

    scheduler.completeTask(first.id);

    // 释放出的容量应自动分配给挂起任务
    assert.equal(second.status, 'assigned');
  });

  it('重调度按优先级排序：critical先于low', () => {
    const scheduler = new QuantumScheduler({});

    // 没有agent时提交，两个任务都挂起
    const low = scheduler.submitTask(makeTask('low-task', 'javascript', 'low') as any);
    const critical = scheduler.submitTask(makeTask('critical-task', 'javascript', 'critical') as any);

    scheduler.registerAgent(makeAgent('a1', ['javascript']));

    // 唯一agent应先接下critical任务
    assert.equal(critical.status, 'assigned');
    assert.equal(low.status, 'pending');
  });

  it('负载超过80时agent进入overloaded', () => {
    const scheduler = new QuantumScheduler({});
    const agent = makeAgent('a1', ['javascript']);
    scheduler.registerAgent(agent);

    // 模拟高负载基础
    agent.load = 80;
    const task = scheduler.submitTask(makeTask('T1', 'javascript') as any);

    assert.equal(task.status, 'assigned');
    assert.equal(agent.state, 'overloaded');
  });

  it('getSystemMetrics在无agent时不出NaN', () => {
    const scheduler = new QuantumScheduler({});
    const metrics = scheduler.getSystemMetrics();
    assert.equal(metrics.systemLoad, 0);
    assert.equal(Number.isNaN(metrics.systemLoad), false);
  });

  it('调度历史记录决策', () => {
    const scheduler = new QuantumScheduler({});
    scheduler.registerAgent(makeAgent('a1', ['javascript']));
    scheduler.submitTask(makeTask('T1', 'javascript') as any);

    const history = scheduler.getSchedulingHistory();
    assert.equal(history.length, 1);
    assert.equal(history[0].agentId, 'a1');
    assert.ok(history[0].probability > 0 && history[0].probability <= 1);
    assert.ok(history[0].confidence > 0);
  });

  it('能力索引在agent注销后正确排除候选', () => {
    const scheduler = new QuantumScheduler({});
    const a1 = makeAgent('a1', ['rust']);
    const a2 = makeAgent('a2', ['rust']);
    scheduler.registerAgent(a1);
    scheduler.registerAgent(a2);
    scheduler.unregisterAgent(a1.id);

    const task = scheduler.submitTask(makeTask('T1', 'rust') as any);
    assert.equal(task.assignedAgentId, 'a2');
  });

  it('多能力要求经索引求交后匹配唯一agent', () => {
    const scheduler = new QuantumScheduler({});
    scheduler.registerAgent(makeAgent('a1', ['frontend']));
    scheduler.registerAgent(makeAgent('a2', ['frontend', 'backend']));

    const task = scheduler.submitTask({
      name: 'T1', type: 'test', priority: 'medium',
      requirements: [
        { type: 'capability' as const, name: 'frontend', value: null, weight: 0.5 },
        { type: 'capability' as const, name: 'backend', value: null, weight: 0.5 }
      ],
      dependencies: [], estimatedDuration: 1000, actualDuration: 0, status: 'pending' as const
    } as any);

    assert.equal(task.assignedAgentId, 'a2');
  });

  it('调度历史封顶且指标计数器正确', () => {
    const scheduler = new QuantumScheduler({ scheduling: { maxHistorySize: 5 } });

    // 10个同能力agent，提交12个任务：10个分配，2个挂起
    for (let i = 0; i < 10; i++) {
      scheduler.registerAgent(makeAgent(`a${i}`, ['bench'], `Agent${i}`));
    }
    const tasks = [];
    for (let i = 0; i < 12; i++) {
      tasks.push(scheduler.submitTask(makeTask(`T${i}`, 'bench') as any));
    }

    // 全部完成
    for (const task of tasks) {
      scheduler.completeTask(task.id, true);
    }

    const metrics = scheduler.getSystemMetrics();
    assert.equal(metrics.totalTasks, 12);
    assert.equal(metrics.completedTasks, 12);
    assert.equal(metrics.pendingTasks, 0);
    assert.equal(metrics.schedulingHistoryLength, 12); // 计数器不封顶
    assert.ok(scheduler.getSchedulingHistory().length <= 5); // 历史数组封顶
  });

  it('updateTaskStatus对pending任务直接完成的路径计数正确', () => {
    const scheduler = new QuantumScheduler({});
    // 无agent → 挂起
    const task = scheduler.submitTask(makeTask('T1', 'javascript') as any);
    assert.equal(task.status, 'pending');

    scheduler.updateTaskStatus(task.id, 'completed');

    const metrics = scheduler.getSystemMetrics();
    assert.equal(metrics.completedTasks, 1);
    assert.equal(metrics.pendingTasks, 0);
  });
});
