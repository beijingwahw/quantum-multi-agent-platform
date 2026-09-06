/**
 * 调度器域审计回归网（A1，2026-09-06）：
 * 每条审计发现一条回归测试，锁定六项调度器域缺陷的修复行为：
 *
 * ① A1#1 状态守卫：非 pending 任务重调度被拒（assignedAgentId 不被覆盖、
 *    已完成任务不被改判）；scheduleTask 与 assignTaskToAgent 双入口守卫。
 * ② A1#2 overloaded 非吸收态：completeTask 释放分支对 working/overloaded
 *    一致按当前 load 重判，agent 负载回落后重新进入候选池。
 * ③ A1#3 挂起 TTL + 巡检定时器构造即启动：从未发生任何分配的部署里，
 *    不可满足任务按 createdAt 起算超时，以 { reason: 'pending_timeout' } 出清。
 * ④ A1#4 依赖环：提交期沿 dependencies 的受限 DFS 检出环即抛 SchedulingError；
 *    合法 DAG 依赖链不受影响。
 * ⑤ A1#5 取消分列：cancelled 是与 failed 分列的终态——不进失败统计，
 *    且必须与 completed/failed 同样接受保留 GC（不得永久驻留内存）。
 * ⑥ A1#6 量子指标与决策同源：quantumProbabilitySum 只累积与决策上报值
 *    同源的 Born 概率（agents[0] 回退分支不上报伪造指标——该分支为纵深
 *    防御，公开 API 下单任务问题的全部候选均合格、repairAssignment 保证
 *    合法解，故不可达；此处锁定可观测契约：meanProbability 恰等于决策值，
 *    平凡坍缩诚实上报概率 1）。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { QuantumScheduler } from '../../src/core/quantum-scheduler.js';
import { SchedulingError } from '../../src/utils/errors.js';
import type { Agent } from '../../src/types/quantum-types.js';

function makeAgent(id: string, capabilities: string[], load = 0): Agent {
  return {
    id,
    name: id,
    type: 'developer',
    capabilities,
    state: 'idle',
    load,
    position: { x: 0, y: 0, z: 0 },
    quantumEntanglement: [],
    lastHeartbeat: new Date(),
  };
}

function makeTask(name: string) {
  return {
    name,
    type: 'test',
    priority: 'medium' as const,
    requirements: [{ type: 'capability' as const, name: 'js', value: null, weight: 1.0 }],
    dependencies: [],
    estimatedDuration: 1000,
    actualDuration: 0,
    status: 'pending' as const,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('调度器域审计回归（A1）', () => {
  it('A1#1 非 pending 任务重调度被拒：归属不覆盖、完成不被改判、指标不污染', () => {
    const scheduler = new QuantumScheduler({});
    const agent = makeAgent('a1', ['js']);
    scheduler.registerAgent(agent);

    const task = scheduler.submitTask(makeTask('T1'));
    assert.equal(task.status, 'assigned');

    // 执行中重调（外部重试场景）：归属与负载不得被改写/叠加
    scheduler.updateTaskStatus(task.id, 'running');
    assert.equal(scheduler.scheduleTask(task.id), null, 'running 任务不得进入调度');
    assert.equal(task.assignedAgentId, 'a1');
    assert.equal(agent.load, 1);

    // 完成后重调：不得被改回 assigned，也不得被后续巡检改判 failed
    scheduler.completeTask(task.id, true, 'done');
    assert.equal(scheduler.scheduleTask(task.id), null, '终态任务不得进入调度');
    assert.equal(task.status, 'completed');
    assert.equal(task.assignedAgentId, 'a1', '分配归属不得被覆盖');

    const metrics = scheduler.getSystemMetrics();
    assert.equal(metrics.completedTasks, 1);
    assert.equal(metrics.failedTasks, 0);
    assert.equal(metrics.cancelledTasks, 0);
    scheduler.shutdown();
  });

  it('A1#2 overloaded 不是吸收态：负载释放后重判 idle 并重新进入候选池', () => {
    const scheduler = new QuantumScheduler({});
    // 外部预置基线 = 阈值 80：调度器计入 +1 即过载（调度器只回减自己计入的增量）
    const agent = makeAgent('a1', ['js'], 80);
    scheduler.registerAgent(agent);

    const t1 = scheduler.submitTask(makeTask('T1'));
    assert.equal(t1.status, 'assigned');
    assert.equal(agent.state, 'overloaded', 'load 81 > 80：分配后进入过载');

    // 释放分支必须对 overloaded 与 working 一致重判：81-1=80 不大于阈值 80 → idle
    scheduler.completeTask(t1.id, true);
    assert.equal(agent.state, 'idle', 'overloaded 必须有出边（不得是无出边吸收态）');
    assert.equal(agent.load, 80, '只回减调度器计入的 +1，外部基线不动');

    // 重新入选候选池：旧实现此任务将永久 pending
    const t2 = scheduler.submitTask(makeTask('T2'));
    assert.equal(t2.status, 'assigned', '恢复 idle 后必须重新可被调度');
    scheduler.shutdown();
  });

  it('A1#3 挂起 TTL：从未发生任何分配的部署中，不可满足任务被 pending_timeout 回收', async () => {
    // 零 agent + autoSchedule=false：不存在任何分配路径——巡检定时器必须在
    // 构造函数就启动，挂起 TTL 才有机会运行（旧实现首个分配成功才启动）
    const scheduler = new QuantumScheduler({
      scheduling: { autoSchedule: false, sweepInterval: 20, pendingTimeoutMs: 60 },
    });

    const task = scheduler.submitTask(makeTask('unsatisfiable'));
    assert.equal(task.status, 'pending');

    await sleep(160); // 超过 TTL(60ms) + 若干巡检周期(20ms)

    assert.equal(task.status, 'failed', '超时未调度的 pending 任务必须出清');
    assert.equal(
      (task.result as { reason?: string } | undefined)?.reason,
      'pending_timeout',
      '失败记录携带结构化原因',
    );
    const metrics = scheduler.getSystemMetrics();
    assert.equal(metrics.failedTasks, 1);
    assert.equal(metrics.pendingTasks, 0, '回收后挂起计数归零');
    scheduler.shutdown();
  });

  it('A1#4 依赖环：提交期受限 DFS 检出 A↔B 环并抛 SchedulingError（DAG 链不受影响）', () => {
    const scheduler = new QuantumScheduler({});
    // 零 agent：A/B 永久 pending——正是审计场景（巡检只回收 assigned/running）
    const a = scheduler.submitTask(makeTask('A'));
    const b = scheduler.submitTask(makeTask('B'));

    // 唯一剩余的环注入通道：调用方突变 submitTask 返回的存活任务引用。
    // 先注入单向边 A→B（A 依赖 B）：仍是 DAG，依赖链提交必须被接受
    a.dependencies.push(b.id);
    const chained = scheduler.submitTask({ ...makeTask('C'), dependencies: [a.id] });
    assert.equal(chained.status, 'pending', '无环依赖链（C→A→B）不被误拒');

    // 注入反向边 B→A 构成环：环上/环下的新提交沿依赖闭包检出即拒
    b.dependencies.push(a.id);
    assert.throws(
      () => scheduler.submitTask({ ...makeTask('D'), dependencies: [a.id] }),
      (err: unknown) => err instanceof SchedulingError && /dependency cycle/.test(err.message),
      '环依赖必须在提交期被调度域错误拒绝，而不是让任务永久 pending',
    );
    scheduler.shutdown();
  });

  it('A1#5 取消分列：cancelled 不进失败统计，且作为终态被保留 GC 回收', async () => {
    const scheduler = new QuantumScheduler({
      scheduling: { sweepInterval: 20 },
      performance: { retentionMs: 50 },
    });
    const agent = makeAgent('a1', ['js']);
    scheduler.registerAgent(agent);

    const task = scheduler.submitTask(makeTask('T1'));
    assert.equal(task.status, 'assigned');

    scheduler.updateTaskStatus(task.id, 'cancelled');
    assert.equal(task.status, 'cancelled', '取消是独立终态');
    assert.equal(agent.state, 'idle', '取消同样释放 agent');

    const metrics = scheduler.getSystemMetrics();
    assert.equal(metrics.failedTasks, 0, '取消不得计入失败口径');
    assert.equal(metrics.cancelledTasks, 1, '取消有自己的计数');

    // cancelled 与 completed/failed 同为终态：超过保留期必须被 GC 出内存
    assert.equal(scheduler.getTasks().length, 1);
    await sleep(130); // 保留期 50ms + 若干巡检周期
    assert.equal(scheduler.getTasks().length, 0, '取消任务不得绕过保留清理永久驻留');
    const after = scheduler.getSystemMetrics();
    assert.equal(after.cancelledTasks, 1, '内存清除后历史计数保留');
    assert.equal(after.totalTasks, 0);
    scheduler.shutdown();
  });

  it('A1#6 量子指标与决策同源：meanProbability 恰等于决策 Born 概率，平凡坍缩诚实上报', () => {
    const scheduler = new QuantumScheduler({
      scheduling: {
        autoSchedule: false,
        quantumAlgorithm: 'quantum-qaoa',
        quantum: { seed: 20260906 },
      },
    });
    for (const id of ['q1', 'q2', 'q3']) {
      scheduler.registerAgent(makeAgent(id, ['js']));
    }

    const task = scheduler.submitTask(makeTask('T1'));
    const decision = scheduler.scheduleTask(task.id);
    assert.ok(decision, '三个空闲能力匹配 agent 必然可调度');
    assert.ok(decision.probability > 0 && decision.probability <= 1);
    assert.match(decision.reasoning, /Born collapse/, '非回退决策以真实测量自述');

    // 指标-决策同源：聚合概率恰等于本次决策上报值（不虚报、不漏记）
    const metrics = scheduler.getQuantumMetrics();
    assert.equal(metrics.singleDecisions, 1);
    assert.equal(metrics.meanProbability, decision.probability);

    // 平凡坍缩（单候选、无演化）诚实上报概率 1——不伪造 Born 数
    const single = new QuantumScheduler({
      scheduling: {
        autoSchedule: false,
        quantumAlgorithm: 'quantum-qaoa',
        quantum: { seed: 20260906 },
      },
    });
    single.registerAgent(makeAgent('solo', ['js']));
    const t2 = single.submitTask(makeTask('T2'));
    const trivial = single.scheduleTask(t2.id);
    assert.ok(trivial);
    assert.equal(trivial.probability, 1);
    assert.equal(trivial.confidence, 1);
    assert.match(trivial.reasoning, /trivial collapse/);
    scheduler.shutdown();
    single.shutdown();
  });
});
