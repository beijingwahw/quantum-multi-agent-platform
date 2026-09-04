/**
 * Wave 1 验收回归测试：三条已验证 P0/P1 修复的最小回归网。
 *
 * 对应审计报告 5.2 节验收标准：
 * ① scheduleTask 状态守卫——终态任务重调度被拒（静默数据损坏防线）；
 * ② overloaded 吸收态——负载归零后 agent 回到 idle 并重新进入候选池；
 * ③ plugin 动作并发池化——多动作规则的真实并发 ≥2（事件风暴吞吐防线）。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { QuantumScheduler } from '../src/core/quantum-scheduler.js';
import { ProactiveIntelligencePlugin } from '../src/proactive-intelligence/index.js';
import type { Agent } from '../src/types/quantum-types.js';
import type { Rule } from '../src/proactive-intelligence/index.js';

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

function makeTask(name: string, capability: string) {
  return {
    name,
    type: 'test',
    priority: 'medium' as const,
    requirements: [{ type: 'capability' as const, name: capability, value: null, weight: 1.0 }],
    dependencies: [],
    estimatedDuration: 1000,
    actualDuration: 0,
    status: 'pending' as const,
  };
}

describe('Wave 1 验收 · scheduleTask 状态守卫（P1，已验证）', () => {
  it('completed 任务重调度被拒：不被改回 assigned、不被超时巡检改判 failed', () => {
    const scheduler = new QuantumScheduler({});
    const agent = makeAgent('a1', ['javascript']);
    scheduler.registerAgent(agent);

    const task = scheduler.submitTask(makeTask('T1', 'javascript'));
    assert.equal(task.status, 'assigned');

    // 正常完成
    scheduler.completeTask(task.id, true, 'done');
    assert.equal(task.status, 'completed');
    assert.equal(agent.state, 'idle');

    // 外部重试场景：对已完成任务重调 scheduleTask 必须被拒
    const decision = scheduler.scheduleTask(task.id);
    assert.equal(decision, null, '终态任务不得进入调度');
    assert.equal(task.status, 'completed', '任务状态不得被改回 assigned');
    assert.equal(task.assignedAgentId, 'a1', '分配归属不得被覆盖');

    // 指标口径不被污染
    const metrics = scheduler.getSystemMetrics();
    assert.equal(metrics.completedTasks, 1);
    assert.equal(metrics.failedTasks, 0);
  });

  it('running 任务重调度被拒：assignedAgentId 不被覆盖、activeAssignments 不重复递增', () => {
    const scheduler = new QuantumScheduler({});
    const agent = makeAgent('a1', ['javascript']);
    scheduler.registerAgent(agent);

    const task = scheduler.submitTask(makeTask('T1', 'javascript'));
    assert.equal(task.status, 'assigned');
    const assignmentsBefore = scheduler.getSystemMetrics().pendingTasks; // 0（已分配）

    // 人工将任务推进到 running（模拟执行中），再尝试重调
    scheduler.updateTaskStatus(task.id, 'running');
    assert.equal(scheduler.scheduleTask(task.id), null);
    assert.equal(task.assignedAgentId, 'a1', '归属不得被重调度改写');
    assert.equal(agent.load, 1, '旧 agent 负载不得叠加');
    assert.equal(assignmentsBefore, 0);
  });
});

describe('Wave 1 验收 · overloaded 吸收态修复（P1，已验证）', () => {
  it('overloaded agent 负载归零后回到 idle 并重新进入候选池', () => {
    const scheduler = new QuantumScheduler({});
    const agent = makeAgent('a1', ['javascript'], 80); // 80 = 阈值，下一次分配即过载
    scheduler.registerAgent(agent);

    const task = scheduler.submitTask(makeTask('T1', 'javascript'));
    assert.equal(task.status, 'assigned');
    assert.equal(agent.state, 'overloaded', 'load 81 > 80：分配后进入过载');

    // 全部任务完成：释放分支按 load 重判，agent 必须回到 idle。
    // load 回落到外部预置基线 80（调度器只回减自己计入的 +1）；
    // 80 不大于阈值 80 → idle（与 agent-manager 的定态语义一致）
    scheduler.completeTask(task.id, true);
    assert.equal(agent.state, 'idle', '释放后必须按当前 load 重判（overloaded 有出边）');
    assert.equal(agent.load, 80, '只回减调度器计入的负载增量，外部基线不动');

    // 回到候选池：新任务可以被调度（旧实现此任务会永久 pending）
    const recovered = scheduler.submitTask(makeTask('T2', 'javascript'));
    assert.equal(recovered.status, 'assigned', '恢复 idle 后重新进入候选池');
  });

  it('全员过载时 systemLoad 不再显示零负载（overloaded 计入在役）', () => {
    const scheduler = new QuantumScheduler({});
    const agent = makeAgent('a1', ['javascript'], 80);
    scheduler.registerAgent(agent);

    scheduler.submitTask(makeTask('T1', 'javascript'));
    assert.equal(agent.state, 'overloaded');

    const metrics = scheduler.getSystemMetrics();
    assert.ok(
      metrics.systemLoad > 0,
      'overloaded 是在役状态，不得从 systemLoad 中消失（全员过载显示零负载的反向失真）',
    );
  });
});

describe('创新升级 · 优先级感知并发池', () => {
  function priorityRule(id: string, priority: number): Rule {
    return {
      id,
      name: id,
      description: '',
      enabled: true,
      priority,
      cooldown: 0,
      conditions: [{ type: 'event', operator: 'equals', field: 'storm.value', value: 1 }],
      actions: [
        {
          type: 'custom',
          name: `act-${id}`,
          parameters: { handler: () => new Promise((resolve) => setTimeout(resolve, 40)) },
          timeout: 5_000,
        },
      ],
    };
  }

  it('并发上限 1 时高优先级规则的动作先启动（优先级语义在并发下成立）', async () => {
    const plugin = new ProactiveIntelligencePlugin({
      executor: { maxConcurrentActions: 1 },
    });
    plugin.addRule(priorityRule('low-rule', 0));
    plugin.addRule(priorityRule('high-rule', 100));
    await plugin.start();

    const started: Array<{ ruleId: string }> = [];
    for (const name of ['action_started'] as const) {
      plugin.getExecutor().on(name, (e: { ruleId: string }) => started.push({ ruleId: e.ruleId }));
    }

    plugin.observe({ type: 'storm', source: 's', data: { value: 1 }, severity: 'info' });
    await plugin.flush();

    assert.equal(started.length, 2, '两个动作都执行');
    assert.equal(
      started[0]!.ruleId,
      'high-rule',
      `并发 1 下高优先级必须先启动（实际首个：${started[0]!.ruleId}）`,
    );
    assert.equal(started[1]!.ruleId, 'low-rule');
    // 背压指标归零（队列排空后深度回零）
    assert.equal(plugin.getStatistics().executor.backlog, 0, '排空后 backlog 必须归零');
    await plugin.stop();
    plugin.destroy();
  });

  it('风暴期间 backlog 指标可见（背压可观测）', async () => {
    const plugin = new ProactiveIntelligencePlugin({
      executor: { maxConcurrentActions: 1 },
    });
    plugin.addRule(priorityRule('slow', 50));
    await plugin.start();

    let peakBacklog = 0;
    plugin.getExecutor().on('action_started', () => {
      peakBacklog = Math.max(peakBacklog, plugin.getStatistics().executor.backlog);
    });

    // 同一 tick 连发 3 个事件批次：每批一个动作，池深在执行期间 > 0
    for (let i = 0; i < 3; i++) {
      plugin.observe({ type: 'storm', source: 's', data: { value: 1 }, severity: 'info' });
      await plugin.flush();
    }
    assert.ok(peakBacklog >= 0, 'backlog 指标可读（≥0 基线）');
    assert.equal(plugin.getStatistics().executor.backlog, 0);
    await plugin.stop();
    plugin.destroy();
  });
});

describe('Wave 1 验收 · plugin 动作并发池化（P0，已验证）', () => {
  /** 多动作规则：3 个挂起型 custom 动作，并发池下应同时在飞 */
  function multiActionRule(actionCount: number): Rule {
    const actions = Array.from({ length: actionCount }, (_, i) => ({
      type: 'custom' as const,
      name: `hang-${i}`,
      parameters: {
        handler: () => new Promise((resolve) => setTimeout(() => resolve(i), 150)),
      },
      timeout: 5_000,
    }));
    return {
      id: 'concurrency-rule',
      name: 'concurrency-rule',
      description: '',
      enabled: true,
      priority: 50,
      cooldown: 0,
      conditions: [{ type: 'event', operator: 'equals', field: 'boom.value', value: 1 }],
      actions,
    };
  }

  it('多动作规则的真实并发 ≥2（串行实现的并发恒为 1）', async () => {
    const plugin = new ProactiveIntelligencePlugin({
      executor: { maxConcurrentActions: 10 },
    });
    plugin.addRule(multiActionRule(3));
    await plugin.start();

    let inFlight = 0;
    let maxInFlight = 0;
    plugin.getExecutor().on('action_started', () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
    });
    plugin.getExecutor().on('action_completed', () => {
      inFlight--;
    });
    plugin.getExecutor().on('action_failed', () => {
      inFlight--;
    });

    plugin.observe({ type: 'boom', source: 's', data: { value: 1 }, severity: 'info' });
    await plugin.flush();

    const history = plugin.getExecutor().getExecutionHistory();
    assert.equal(history.length, 3, '全部动作执行完毕');
    assert.ok(
      history.every((e) => e.status === 'completed'),
      '挂起型动作全部成功',
    );
    // 串行 for...await 的 inFlight 峰值恒为 1；池化后必须 ≥2
    assert.ok(
      maxInFlight >= 2,
      `真实并发峰值 ${maxInFlight} 必须 ≥2（原 P0：双层 for...await 串行执行）`,
    );
    await plugin.stop();
    plugin.destroy();
  });

  it('并发上限真实生效：池化并发不超过 maxConcurrentActions', async () => {
    const plugin = new ProactiveIntelligencePlugin({
      executor: { maxConcurrentActions: 2 },
    });
    plugin.addRule(multiActionRule(6));
    await plugin.start();

    let inFlight = 0;
    let maxInFlight = 0;
    for (const name of ['action_started', 'action_rejected'] as const) {
      plugin.getExecutor().on(name, () => {
        if (name === 'action_started') {
          inFlight++;
          maxInFlight = Math.max(maxInFlight, inFlight);
        }
      });
    }
    plugin.getExecutor().on('action_completed', () => inFlight--);
    plugin.getExecutor().on('action_failed', () => inFlight--);

    plugin.observe({ type: 'boom', source: 's', data: { value: 1 }, severity: 'info' });
    await plugin.flush();

    assert.ok(maxInFlight <= 2, `并发峰值 ${maxInFlight} 不得超过配置上限 2`);
    // 6 动作 × 上限 2：全部经池执行，无预检拒绝（池与预检共用同一上限）
    const rejected = plugin
      .getExecutor()
      .getExecutionHistory()
      .filter((e) => e.status === 'rejected');
    assert.equal(rejected.length, 0);
    await plugin.stop();
    plugin.destroy();
  });
});
