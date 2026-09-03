import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { QuantumScheduler } from '../src/core/quantum-scheduler.js';
import type { Agent } from '../src/types/quantum-types.js';

function makeAgent(id: string, capabilities: string[]): Agent {
  return {
    id,
    name: id,
    type: 'developer',
    capabilities,
    state: 'idle',
    load: 0,
    position: { x: 0, y: 0, z: 0 },
    quantumEntanglement: [],
    lastHeartbeat: new Date(),
  };
}

function baseTask(name: string, priority: any = 'medium'): any {
  return {
    name,
    type: 'test',
    priority,
    requirements: [],
    dependencies: [],
    estimatedDuration: 1000,
    actualDuration: 0,
    status: 'pending',
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('调度器高级特性', () => {
  it('依赖门控：前置任务完成前依赖任务保持挂起', () => {
    const scheduler = new QuantumScheduler({});
    scheduler.registerAgent(makeAgent('a1', ['js']));

    const dep = scheduler.submitTask(baseTask('dep'));
    assert.equal(dep.status, 'assigned');

    // a1忙，依赖任务无空闲agent也无妨——先验证依赖本身
    const dependent = scheduler.submitTask({ ...baseTask('dependent'), dependencies: [dep.id] });
    assert.equal(dependent.status, 'pending');

    scheduler.completeTask(dep.id, true);
    // 依赖完成后a1被释放，依赖任务应被重调度接走
    assert.equal(dependent.status, 'assigned');
  });

  it('依赖门控：即使有空闲agent，未完成依赖仍阻止调度', () => {
    const scheduler = new QuantumScheduler({});
    const a1 = makeAgent('a1', ['js']);
    const a2 = makeAgent('a2', ['js']);
    scheduler.registerAgent(a1);
    scheduler.registerAgent(a2);

    const dep = scheduler.submitTask(baseTask('dep')); // a1或a2接走（量子评分决定）
    const dependent = scheduler.submitTask({ ...baseTask('dependent'), dependencies: [dep.id] });

    // 恰一个agent执行dep，另一个空闲且能力匹配，但依赖未完成 → 必须保持pending
    assert.equal(dep.status, 'assigned');
    assert.equal([a1, a2].filter((a) => a.state === 'working').length, 1);
    assert.equal(dependent.status, 'pending');
  });

  it('级联失败：前置任务失败时依赖任务自动失败', () => {
    const scheduler = new QuantumScheduler({});
    scheduler.registerAgent(makeAgent('a1', ['js']));

    const dep = scheduler.submitTask(baseTask('dep'));
    const dependent = scheduler.submitTask({ ...baseTask('dependent'), dependencies: [dep.id] });
    const grandChild = scheduler.submitTask({
      ...baseTask('grandchild'),
      dependencies: [dependent.id],
    });

    scheduler.completeTask(dep.id, false);

    // 级联传播两层
    assert.equal(dependent.status, 'failed');
    assert.equal(grandChild.status, 'failed');
    assert.equal(scheduler.getSystemMetrics().failedTasks, 3);
  });

  it('未知依赖ID在提交时直接拒绝', () => {
    const scheduler = new QuantumScheduler({});
    assert.throws(
      () => scheduler.submitTask({ ...baseTask('bad'), dependencies: ['nonexistent-id'] }),
      /Unknown dependency 'nonexistent-id'/,
    );
  });

  it('超时回收：超时任务自动失败并释放agent', async () => {
    const scheduler = new QuantumScheduler({
      scheduling: { taskTimeout: 60, sweepInterval: 20 },
    });
    const agent = makeAgent('a1', ['js']);
    scheduler.registerAgent(agent);

    const task = scheduler.submitTask(baseTask('slow'));
    assert.equal(task.status, 'assigned');

    await sleep(150);

    assert.equal(task.status, 'failed');
    assert.equal(agent.state, 'idle');
    assert.equal(agent.load, 0);
    assert.equal((task as any).result?.reason, 'timeout');
    scheduler.shutdown();
  });

  it('并发上限背压：达到maxConcurrentTasks后任务挂起等待释放', () => {
    const scheduler = new QuantumScheduler({
      scheduling: { maxConcurrentTasks: 1 },
    });
    const a1 = makeAgent('a1', ['js']);
    const a2 = makeAgent('a2', ['js']);
    scheduler.registerAgent(a1);
    scheduler.registerAgent(a2);

    const first = scheduler.submitTask(baseTask('first'));
    const second = scheduler.submitTask(baseTask('second'));

    // 两个空闲agent但上限为1：恰好一个在执行，另一个必须保持空闲
    assert.equal(first.status, 'assigned');
    assert.equal(second.status, 'pending');
    assert.equal([a1, a2].filter((a) => a.state === 'working').length, 1);

    // 释放后第二个任务被接走
    scheduler.completeTask(first.id, true);
    assert.equal(second.status, 'assigned');
    scheduler.shutdown();
  });

  it('保留GC：终结任务超过保留期后从内存清除，指标计数保留', async () => {
    const scheduler = new QuantumScheduler({
      scheduling: { sweepInterval: 20 },
      performance: { retentionMs: 50 },
    });
    scheduler.registerAgent(makeAgent('a1', ['js']));

    const task = scheduler.submitTask(baseTask('gc-me'));
    scheduler.completeTask(task.id, true);

    assert.equal(scheduler.getTasks().length, 1);

    await sleep(120); // 超过保留期+巡检周期

    const metrics = scheduler.getSystemMetrics();
    assert.equal(scheduler.getTasks().length, 0); // 内存清除
    assert.equal(metrics.completedTasks, 1); // 历史计数保留
    assert.equal(metrics.totalTasks, 0); // 总量反映当前内存
    scheduler.shutdown();
  });

  it('shutdown清理巡检定时器且幂等', async () => {
    const scheduler = new QuantumScheduler({
      scheduling: { taskTimeout: 60, sweepInterval: 20 },
    });
    scheduler.registerAgent(makeAgent('a1', ['js']));
    const task = scheduler.submitTask(baseTask('t'));
    assert.equal(task.status, 'assigned');
    scheduler.shutdown();
    scheduler.shutdown(); // 幂等

    // 巡检定时器确已停止：超时窗口过后任务不被 sweep 标记失败
    await sleep(120);
    assert.equal(scheduler.getTasks()[0]!.status, 'assigned');
  });

  it('updateTaskStatus 中间态不再被静默标记失败（行为陷阱回归守护）', () => {
    const scheduler = new QuantumScheduler({});
    const agent = makeAgent('a1', ['js']);
    scheduler.registerAgent(agent);
    const task = scheduler.submitTask(baseTask('running-state'));
    assert.equal(task.status, 'assigned');

    // 此前 updateTaskStatus(id, 'running') 会走 completeTask(id, false) 杀死任务
    scheduler.updateTaskStatus(task.id, 'running');
    assert.equal(task.status, 'running');
    assert.equal(task.assignedAgentId, agent.id); // agent 未被释放
    assert.equal(scheduler.getSystemMetrics().failedTasks, 0);

    // 中间态后仍可正常完成
    scheduler.updateTaskStatus(task.id, 'completed');
    assert.equal(task.status, 'completed');
    assert.equal(agent.state, 'idle'); // 完成释放 agent
    scheduler.shutdown();
  });

  it('updateTaskStatus cancelled：按失败终态收尾并释放agent', () => {
    const scheduler = new QuantumScheduler({});
    const agent = makeAgent('a1', ['js']);
    scheduler.registerAgent(agent);
    const task = scheduler.submitTask(baseTask('cancel-me'));
    assert.equal(task.status, 'assigned');

    scheduler.updateTaskStatus(task.id, 'cancelled');
    assert.equal(task.status, 'failed'); // 取消按非成功终态计
    assert.equal(agent.state, 'idle');
    assert.equal(scheduler.getSystemMetrics().failedTasks, 1);
    scheduler.shutdown();
  });
});
