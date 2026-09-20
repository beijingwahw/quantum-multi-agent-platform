/**
 * R18-A 验收 · pending-reachability（挂起任务可达性三分类刻画）。
 *
 * 钉板结构（定理级主张 + 走私审判式负对照）：
 * ① 三分类基础：schedulable-now / awaiting-release / unsatisfiable 的
 *    证人集（matching/idle/busy）逐一钉死；
 * ② T1 零错杀（真实调度器）：unsatisfiable 任务在注册表不变的完整调度
 *    路径（重调度×多轮 + 其它任务完成释放容量再重调度）下保持 pending；
 * ②' 复活通道（T1 的时点边界）：判定后注册具备能力的 agent → 立即可
 *    调度——证明「unsatisfiable」是时点陈述而非未来承诺；
 * ③ T1' 提前失败 ≡ 等满 TTL（终态等价钉板）：两条独立时间线（unsatisfiable
 *    提前失败 vs pendingTimeoutMs 等满），终态与级联 reason 完全相同，
 *    唯一差异是时间；
 * ④ T2 等待根据（真实调度器）：awaiting-release 的挂起任务在匹配 agent
 *    完成释放后获得调度（正钉板）；overloaded 同为闭包成员；
 * ⑤ 负对照·窄闭包错杀：内联「只看 idle」的错误判定器在匹配 agent 全
 *    working 的实例上输出 unsatisfiable——错杀钉死（本模块输出
 *    awaiting-release）；
 * ⑥ 负对照·输入走私：重复 agent id / 重复需求 → 具名 SchedulingError；
 * ⑦ 边界：空需求 × 空注册表 → unsatisfiable；空需求 × 有 idle agent →
 *    schedulable-now；批量判定输出序 = 输入序。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyPendingTask,
  classifyPendingBucket,
  type ReachabilityAgentView,
  type ReachabilityTaskView,
} from '../src/core/pending-reachability.js';
import { QuantumScheduler } from '../src/core/quantum-scheduler.js';
import { SchedulingError } from '../src/utils/errors.js';
import { makeAgent, makeTask, sleep } from './helpers/fixtures.js';

/** 判定模块的 agent 视图（从平台 Agent 形状投影；state 含 offline 全闭包） */
function viewOf(agent: {
  id: string;
  capabilities: string[];
  state: string;
}): ReachabilityAgentView {
  return { id: agent.id, capabilities: agent.capabilities, state: agent.state };
}

function taskView(id: string, capabilities: readonly string[]): ReachabilityTaskView {
  return { id, requiredCapabilities: capabilities };
}

describe('R18-A · pending-reachability ① 三分类与证人集', () => {
  const agents: ReachabilityAgentView[] = [
    { id: 'a1', capabilities: ['js'], state: 'idle' },
    { id: 'a2', capabilities: ['js', 'ml'], state: 'working' },
    { id: 'a3', capabilities: ['ops'], state: 'overloaded' },
    { id: 'a4', capabilities: [], state: 'idle' },
  ];

  it('schedulable-now：空闲池内有匹配（证人 = idle 子集）', () => {
    const v = classifyPendingTask(taskView('t1', ['js']), agents);
    assert.equal(v.classification, 'schedulable-now');
    assert.deepEqual(v.matchingAgents, ['a1', 'a2']);
    assert.deepEqual(v.idleMatches, ['a1']);
    assert.deepEqual(v.busyMatches, ['a2']);
  });

  it('awaiting-release：无空闲匹配但注册表内有（证人 = busy 匹配）', () => {
    const v = classifyPendingTask(taskView('t2', ['ml']), agents);
    assert.equal(v.classification, 'awaiting-release');
    assert.deepEqual(v.matchingAgents, ['a2']);
    assert.deepEqual(v.idleMatches, []);
    assert.deepEqual(v.busyMatches, ['a2']);
  });

  it('unsatisfiable：全注册表无匹配（含 overloaded/offline 在内的闭包为空）', () => {
    const v = classifyPendingTask(taskView('t3', ['rust']), agents);
    assert.equal(v.classification, 'unsatisfiable');
    assert.deepEqual(v.matchingAgents, []);
    assert.deepEqual(v.idleMatches, []);
    assert.deepEqual(v.busyMatches, []);
  });

  it('多需求合取：agent 需同时具备全部需求能力才匹配', () => {
    const v = classifyPendingTask(taskView('t4', ['js', 'ml']), agents);
    assert.equal(v.classification, 'awaiting-release'); // 仅 a2 同时具备，且 working
    assert.deepEqual(v.matchingAgents, ['a2']);
  });

  it('offline 也在闭包内（不因失联状态而错杀）', () => {
    const v = classifyPendingTask(taskView('t5', ['net']), [
      { id: 'a9', capabilities: ['net'], state: 'offline' },
    ]);
    assert.equal(v.classification, 'awaiting-release');
  });
});

describe('R18-A · pending-reachability ② T1 零错杀（真实调度器钉板）', () => {
  it('unsatisfiable 任务历经完整调度路径仍 pending（注册表不变）', () => {
    const scheduler = new QuantumScheduler({ scheduling: { autoSchedule: true } });
    // 两个 agent：都只有 'js'；无人具备 'rust'
    scheduler.registerAgent(makeAgent('w1', ['js']));
    scheduler.registerAgent(makeAgent('w2', ['js']));

    const doable = scheduler.submitTask(makeTask('doable', 'js'));
    const hopeless = scheduler.submitTask(makeTask('hopeless', 'rust'));
    assert.equal(doable.status, 'assigned');
    assert.equal(hopeless.status, 'pending');

    // 判定时刻的注册表快照 → unsatisfiable
    const verdict = classifyPendingTask(
      taskView(hopeless.id, ['rust']),
      scheduler.getAgents().map((a) => viewOf(a)),
    );
    assert.equal(verdict.classification, 'unsatisfiable');

    // T1 的机器验证：注册表不变下，任何调度路径都不能改变 pending——
    // 手动多轮重调度 + 完成在役任务释放容量再重调度
    scheduler.shutdown();
    for (let round = 0; round < 3; round++) {
      scheduler.reschedulePendingTasks();
      assert.equal(scheduler.getTasks().find((t) => t.id === hopeless.id)?.status, 'pending');
    }
    scheduler.completeTask(doable.id, true); // 释放 w1 → 全员空闲
    for (let round = 0; round < 3; round++) {
      scheduler.reschedulePendingTasks();
      assert.equal(
        scheduler.getTasks().find((t) => t.id === hopeless.id)?.status,
        'pending',
        `T1：注册表不变时 unsatisfiable 任务在第 ${round} 轮重调度后仍应 pending`,
      );
    }
  });

  it("②' 复活通道：判定后注册具备能力的 agent，任务立即可调度（时点边界的反向钉板）", () => {
    const scheduler = new QuantumScheduler({ scheduling: { autoSchedule: true } });
    scheduler.registerAgent(makeAgent('w1', ['js']));
    const hopeless = scheduler.submitTask(makeTask('later', 'rust'));
    assert.equal(hopeless.status, 'pending');

    const before = classifyPendingTask(
      taskView(hopeless.id, ['rust']),
      scheduler.getAgents().map(viewOf),
    );
    assert.equal(before.classification, 'unsatisfiable');

    // 能力供给变化（新注册）：注册钩子同步触发 reschedulePendingTasks，
    // 任务当场被消化——判定时点之后的注册是唯一的复活通道
    scheduler.registerAgent(makeAgent('rustacean', ['rust']));
    assert.equal(
      scheduler.getTasks().find((t) => t.id === hopeless.id)?.status,
      'assigned',
      '注册钩子 reschedulePendingTasks 应立即调度此前不可达的任务',
    );
    const after = classifyPendingTask(
      taskView(hopeless.id, ['rust']),
      scheduler.getAgents().map(viewOf),
    );
    // 注册后快照：匹配集非空（分类随供给翻转；agent 已在役故为
    // awaiting-release——「不再判死」才是本钉板的对象）
    assert.notEqual(after.classification, 'unsatisfiable');
    assert.deepEqual(after.matchingAgents, ['rustacean']);
    scheduler.shutdown();
  });
});

describe('R18-A · pending-reachability ③ T1′ 提前失败 ≡ 等满 TTL（终态等价）', () => {
  /**
   * 两条独立时间线，同一初始构造：
   * A 线：pendingTimeoutMs=40、sweepInterval=10 —— 等满 TTL 后失败；
   * B 线：无 TTL（pendingTimeoutMs=0），在判定 unsatisfiable 后立即以
   *       { reason: 'unsatisfiable' } 失败（接线后的提前失败行为等价物）。
   * T1'：两线的任务终态与下游级联 reason 逐任务相同；唯一差异是时间。
   */
  function buildTimeline(): QuantumScheduler {
    const scheduler = new QuantumScheduler({
      scheduling: { autoSchedule: true, pendingTimeoutMs: 0 },
    });
    scheduler.registerAgent(makeAgent('w1', ['js']));
    return scheduler;
  }

  function terminalStatesOf(
    scheduler: QuantumScheduler,
  ): Map<string, { status: string; reason: unknown }> {
    const out = new Map<string, { status: string; reason: unknown }>();
    for (const t of scheduler.getTasks()) {
      out.set(t.name, {
        status: t.status,
        reason: (t.result as { reason?: unknown } | undefined)?.reason,
      });
    }
    return out;
  }

  it('两线终态与级联 reason 逐任务相同（唯一差异 = 时间）', async () => {
    // A 线：盲 TTL
    const a = new QuantumScheduler({
      scheduling: { autoSchedule: true, pendingTimeoutMs: 40, sweepInterval: 10 },
    });
    a.registerAgent(makeAgent('w1', ['js']));
    a.submitTask(makeTask('root', 'js'));
    const aDown = a.submitTask({ ...makeTask('down', 'rust'), dependencies: [] });
    // 链式下游：root(js) ← down(rust, 不可达) ← leaf
    const aLeaf = a.submitTask({ ...makeTask('leaf', 'js'), dependencies: [aDown.id] });
    assert.ok(aLeaf);
    await sleep(120); // 等待 sweep 以 pending_timeout 收割 down
    a.shutdown();

    // B 线：判定 unsatisfiable → 立即提前失败（同步窗口零竞态）
    const b = buildTimeline();
    b.submitTask(makeTask('root', 'js'));
    const bDown = b.submitTask(makeTask('down', 'rust'));
    const bLeaf = b.submitTask({
      ...makeTask('leaf', 'js'),
      dependencies: [bDown.id],
    });
    assert.ok(bLeaf);
    const verdict = classifyPendingTask(taskView(bDown.id, ['rust']), b.getAgents().map(viewOf));
    assert.equal(verdict.classification, 'unsatisfiable');
    b.completeTask(bDown.id, false, { reason: 'unsatisfiable' }); // 提前失败（级联自动触发）
    b.shutdown();

    const statesA = terminalStatesOf(a);
    const statesB = terminalStatesOf(b);
    // down：两线同为 failed（reason 字符串不同：pending_timeout vs unsatisfiable——
    // 失败根因记录差异是有意的观测面；终态与失败类别相同）
    assert.equal(statesA.get('down')?.status, 'failed');
    assert.equal(statesB.get('down')?.status, 'failed');
    assert.equal(statesA.get('down')?.reason, 'pending_timeout');
    assert.equal(statesB.get('down')?.reason, 'unsatisfiable');
    // leaf：两线同为 failed 且级联 reason 相同（dependency_failed）
    assert.equal(statesA.get('leaf')?.status, 'failed');
    assert.equal(statesB.get('leaf')?.status, 'failed');
    assert.equal(statesA.get('leaf')?.reason, 'dependency_failed');
    assert.equal(statesB.get('leaf')?.reason, 'dependency_failed');
  });
});

describe('R18-A · pending-reachability ④ T2 等待根据（真实调度器正钉板）', () => {
  it('awaiting-release：匹配 agent 完成释放后，挂起任务获得调度', () => {
    const scheduler = new QuantumScheduler({ scheduling: { autoSchedule: true } });
    scheduler.registerAgent(makeAgent('busy', ['ml']));
    const first = scheduler.submitTask(makeTask('first', 'ml'));
    assert.equal(first.status, 'assigned');
    const second = scheduler.submitTask(makeTask('second', 'ml'));
    assert.equal(second.status, 'pending');

    const verdict = classifyPendingTask(
      taskView(second.id, ['ml']),
      scheduler.getAgents().map(viewOf),
    );
    assert.equal(verdict.classification, 'awaiting-release');
    assert.deepEqual(verdict.busyMatches, ['busy']);

    // T2 正钉板：在役释放 → autoSchedule 钩子消化等待
    scheduler.completeTask(first.id, true);
    assert.equal(
      scheduler.getTasks().find((t) => t.id === second.id)?.status,
      'assigned',
      '匹配 agent 释放后挂起任务应获得调度（等待有结构根据）',
    );
    scheduler.shutdown();
  });

  it('overloaded 同为闭包成员：不因过载状态而错杀', () => {
    const scheduler = new QuantumScheduler({ scheduling: { autoSchedule: true } });
    // 构造：单 agent、连续提交两个任务——第二任务 pending 时 agent 为 working；
    // overloaded 形态用 load 夹具直接构造
    scheduler.registerAgent(makeAgent('hot', ['gpu'], { load: 85 }));
    scheduler.getAgents()[0]!.state = 'overloaded'; // 夹具直改（调度器持有活引用）

    const pending = scheduler.submitTask(makeTask('wait-gpu', 'gpu'));
    assert.equal(pending.status, 'pending');
    const verdict = classifyPendingTask(
      taskView(pending.id, ['gpu']),
      scheduler.getAgents().map(viewOf),
    );
    // 窄判定（排除 overloaded）会错杀为 unsatisfiable；本模块闭包含 overloaded
    assert.equal(verdict.classification, 'awaiting-release');
    assert.deepEqual(verdict.matchingAgents, ['hot']);
    scheduler.shutdown();
  });
});

describe('R18-A · pending-reachability ⑤–⑦ 负对照与边界（走私审判）', () => {
  it('⑤ 窄闭包错杀钉死：内联「只看 idle」的错误判定器把 awaiting-release 误判为 unsatisfiable', () => {
    const agents: ReachabilityAgentView[] = [{ id: 'w1', capabilities: ['ml'], state: 'working' }];
    const task = taskView('t', ['ml']);
    // 本模块：awaiting-release（等待有根据）
    const correct = classifyPendingTask(task, agents);
    assert.equal(correct.classification, 'awaiting-release');
    // 走私版：只看 idle 的窄闭包 → unsatisfiable（错杀）
    const smuggled = classifyPendingTask(
      task,
      agents.filter((a) => a.state === 'idle'),
    );
    assert.equal(smuggled.classification, 'unsatisfiable');
    // 差异钉死：走私版判死了一个本可等出来的任务
    assert.notEqual(correct.classification, smuggled.classification);
  });

  it('⑥ 重复 agent id：具名拒绝（快照损坏）', () => {
    assert.throws(
      () =>
        classifyPendingTask(taskView('t', ['js']), [
          { id: 'dup', capabilities: ['js'], state: 'idle' },
          { id: 'dup', capabilities: ['ml'], state: 'idle' },
        ]),
      (err: unknown) => {
        assert.ok(err instanceof SchedulingError);
        assert.match(err.message, /duplicate agent id/);
        return true;
      },
    );
  });

  it('⑥ 任务携带重复需求：具名拒绝（输入契约走私）', () => {
    assert.throws(
      () =>
        classifyPendingTask(taskView('t', ['js', 'js']), [
          { id: 'a1', capabilities: ['js'], state: 'idle' },
        ]),
      (err: unknown) => {
        assert.ok(err instanceof SchedulingError);
        assert.match(err.message, /lists capability 'js' twice/);
        return true;
      },
    );
  });

  it('⑦ 空需求 × 空注册表 → unsatisfiable；空需求 × idle agent → schedulable-now', () => {
    const noAgents = classifyPendingTask(taskView('t', []), []);
    assert.equal(noAgents.classification, 'unsatisfiable');
    const withIdle = classifyPendingTask(taskView('t', []), [
      { id: 'empty-cap', capabilities: [], state: 'idle' },
    ]);
    assert.equal(withIdle.classification, 'schedulable-now');
    assert.deepEqual(withIdle.matchingAgents, ['empty-cap']);
  });

  it('⑦ 批量判定：输出序 = 输入任务序（sweep 集成面的稳定契约）', () => {
    const agents: ReachabilityAgentView[] = [
      { id: 'a1', capabilities: ['js'], state: 'idle' },
      { id: 'a2', capabilities: ['ml'], state: 'working' },
    ];
    const verdicts = classifyPendingBucket(
      [taskView('z-task', ['js']), taskView('a-task', ['ml']), taskView('m-task', ['rust'])],
      agents,
    );
    assert.deepEqual(
      verdicts.map((v) => [v.task, v.classification]),
      [
        ['z-task', 'schedulable-now'],
        ['a-task', 'awaiting-release'],
        ['m-task', 'unsatisfiable'],
      ],
    );
  });
});
