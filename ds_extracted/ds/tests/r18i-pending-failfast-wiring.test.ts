/**
 * R18-I 验收 · 挂起可达性 sweep 接线（TaskLifecycleManager.sweep 的
 * failFastUnsatisfiable opt-in；缺省关——位同构铁律，未配置时 sweep
 * 行为与现完全一致）。
 *
 * 钉板结构（T1'/T1 的生产接线钉死）：
 * ① 红测主钉·开关开：unsatisfiable（全注册表无能力匹配）的挂起任务
 *    在 sweep 后立即 failed（reason='unsatisfiable'）；
 * ② T1' 终态等价（两条独立时间线）：A 线盲 TTL 等满（pending_timeout）
 *    vs B 线早失败（unsatisfiable）——down 两线均 failed，下游 leaf
 *    两线均 failed 且级联 reason 均 dependency_failed（逐任务相同，
 *    唯一差异是时间与失败根因记录）；
 * ③ 零错杀：schedulable-now / awaiting-release 任务在同一 sweep 下
 *    不被误杀（能力判定与依赖门控正交；awaiting-release 在释放后
 *    获得调度——T2 等待根据）；
 * ④ 时点边界：sweep 判死后的新 agent 注册不复活已终态任务
 *    （判定是时点陈述；复活通道在判定之前，见 r18a ②'）；
 * ⑤ 重复需求防御：requirements 携带重复 capability 的任务不使 sweep
 *    抛错（接线对需求去重），仍按 unsatisfiable 判死；
 * ⑥ 负对照·走私审判：不传开关（缺省）时 sweep 后 unsatisfiable 任务
 *    仍 pending——新路径不可达必须钉死。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { QuantumScheduler } from '../src/core/quantum-scheduler.js';
import { makeAgent, makeTask, sleep } from './helpers/fixtures.js';

function statusOf(scheduler: QuantumScheduler, id: string): string | undefined {
  return scheduler.getTasks().find((t) => t.id === id)?.status;
}

function reasonOf(scheduler: QuantumScheduler, id: string): unknown {
  const t = scheduler.getTasks().find((x) => x.id === id);
  return (t?.result as { reason?: unknown } | undefined)?.reason;
}

describe('R18-I · sweep 早失败接线 ① 红测主钉 + ⑥ 缺省不可达', () => {
  it('① 开关开：unsatisfiable 挂起任务在 sweep 后 failed（reason=unsatisfiable，含 elapsedMs）', async () => {
    const scheduler = new QuantumScheduler({
      scheduling: {
        autoSchedule: true,
        failFastUnsatisfiable: true,
        sweepInterval: 5,
        pendingTimeoutMs: 0,
      },
    });
    scheduler.registerAgent(makeAgent('w1', ['js']));
    const doable = scheduler.submitTask(makeTask('doable', 'js'));
    const hopeless = scheduler.submitTask(makeTask('hopeless', 'rust'));
    assert.equal(doable.status, 'assigned');
    assert.equal(hopeless.status, 'pending');

    await sleep(60); // 等 sweep 周期（5ms）跑过
    scheduler.shutdown();
    assert.equal(
      statusOf(scheduler, hopeless.id),
      'failed',
      'unsatisfiable 任务应被 sweep 提前判死',
    );
    assert.equal(reasonOf(scheduler, hopeless.id), 'unsatisfiable');
    const elapsed = (
      scheduler.getTasks().find((t) => t.id === hopeless.id)?.result as
        | {
            elapsedMs?: unknown;
          }
        | undefined
    )?.elapsedMs;
    assert.equal(typeof elapsed, 'number', '载荷与 pending_timeout 同形（reason+elapsedMs）');
    assert.equal(statusOf(scheduler, doable.id), 'assigned', '可调度任务不受影响');
  });

  it('⑥ 负对照·缺省不传开关：sweep 后 unsatisfiable 任务仍 pending（新路径不可达）', async () => {
    const scheduler = new QuantumScheduler({
      scheduling: { autoSchedule: true, sweepInterval: 5, pendingTimeoutMs: 60_000 },
    });
    scheduler.registerAgent(makeAgent('w1', ['js']));
    const hopeless = scheduler.submitTask(makeTask('hopeless', 'rust'));
    assert.equal(hopeless.status, 'pending');
    await sleep(60);
    scheduler.shutdown();
    assert.equal(
      statusOf(scheduler, hopeless.id),
      'pending',
      '缺省关闭时 sweep 不得提前杀死挂起任务（位同构）',
    );
  });
});

describe('R18-I · sweep 早失败接线 ② T1′ 终态等价（两条独立时间线）', () => {
  it('早失败线与盲 TTL 线的终态/级联逐任务相同（唯一差异=时间与失败根因记录）', async () => {
    // A 线：盲 TTL（缺省关 + pendingTimeoutMs=40）
    const a = new QuantumScheduler({
      scheduling: { autoSchedule: true, sweepInterval: 5, pendingTimeoutMs: 40 },
    });
    a.registerAgent(makeAgent('w1', ['js']));
    a.submitTask(makeTask('root', 'js'));
    const aDown = a.submitTask(makeTask('down', 'rust'));
    const aLeaf = a.submitTask({ ...makeTask('leaf', 'js'), dependencies: [aDown.id] });
    await sleep(150); // 等 TTL 收割 + 级联
    a.shutdown();

    // B 线：早失败（开关开 + 无 TTL）
    const b = new QuantumScheduler({
      scheduling: {
        autoSchedule: true,
        failFastUnsatisfiable: true,
        sweepInterval: 5,
        pendingTimeoutMs: 0,
      },
    });
    b.registerAgent(makeAgent('w1', ['js']));
    b.submitTask(makeTask('root', 'js'));
    const bDown = b.submitTask(makeTask('down', 'rust'));
    const bLeaf = b.submitTask({ ...makeTask('leaf', 'js'), dependencies: [bDown.id] });
    await sleep(60); // 首个 sweep 周期即判死 + 级联
    b.shutdown();

    // down：两线均 failed；根因记录有意分列（pending_timeout vs unsatisfiable）
    assert.equal(statusOf(a, aDown.id), 'failed');
    assert.equal(statusOf(b, bDown.id), 'failed');
    assert.equal(reasonOf(a, aDown.id), 'pending_timeout');
    assert.equal(reasonOf(b, bDown.id), 'unsatisfiable');
    // leaf：两线均 failed 且级联 reason 相同（dependency_failed）
    assert.equal(statusOf(a, aLeaf.id), 'failed');
    assert.equal(statusOf(b, bLeaf.id), 'failed');
    assert.equal(reasonOf(a, aLeaf.id), 'dependency_failed');
    assert.equal(reasonOf(b, bLeaf.id), 'dependency_failed');
  });
});

describe('R18-I · sweep 早失败接线 ③–⑤ 零错杀与时点边界', () => {
  it('③ 零错杀：awaiting-release 不被杀，且释放后获调度（T2 等待根据）', async () => {
    const scheduler = new QuantumScheduler({
      scheduling: {
        autoSchedule: true,
        failFastUnsatisfiable: true,
        sweepInterval: 5,
        pendingTimeoutMs: 0,
      },
    });
    scheduler.registerAgent(makeAgent('busy', ['ml']));
    const first = scheduler.submitTask(makeTask('first', 'ml'));
    assert.equal(first.status, 'assigned');
    const second = scheduler.submitTask(makeTask('second', 'ml')); // awaiting-release
    const doomed = scheduler.submitTask(makeTask('doomed', 'rust')); // unsatisfiable
    assert.equal(second.status, 'pending');
    assert.equal(doomed.status, 'pending');

    await sleep(60);
    assert.equal(statusOf(scheduler, doomed.id), 'failed', 'unsatisfiable 判死');
    assert.equal(
      statusOf(scheduler, second.id),
      'pending',
      'awaiting-release（匹配 agent 在役）不得误杀',
    );
    // T2：释放后等待任务获调度
    scheduler.completeTask(first.id, true);
    assert.equal(statusOf(scheduler, second.id), 'assigned');
    scheduler.shutdown();
  });

  it('④ 时点边界：sweep 判死之后注册具备能力的 agent，任务不复活（终态不可逆）', async () => {
    const scheduler = new QuantumScheduler({
      scheduling: {
        autoSchedule: true,
        failFastUnsatisfiable: true,
        sweepInterval: 5,
        pendingTimeoutMs: 0,
      },
    });
    scheduler.registerAgent(makeAgent('w1', ['js']));
    const hopeless = scheduler.submitTask(makeTask('late-saver', 'rust'));
    await sleep(60); // 判死已发生
    scheduler.registerAgent(makeAgent('rustacean', ['rust']));
    assert.equal(
      statusOf(scheduler, hopeless.id),
      'failed',
      '判定是时点陈述：判死后的能力供给增加不复活终态任务',
    );
    scheduler.shutdown();
  });

  it('⑤ 重复 capability 需求：sweep 不抛错（接线去重防御），仍判死', async () => {
    const scheduler = new QuantumScheduler({
      scheduling: {
        autoSchedule: true,
        failFastUnsatisfiable: true,
        sweepInterval: 5,
        pendingTimeoutMs: 0,
      },
    });
    scheduler.registerAgent(makeAgent('w1', ['js']));
    const dup = scheduler.submitTask({
      ...makeTask('dup-req', 'rust'),
      requirements: [
        { type: 'capability', name: 'rust', value: null, weight: 1 },
        { type: 'capability', name: 'rust', value: null, weight: 1 },
      ],
    });
    assert.equal(dup.status, 'pending');
    await sleep(60); // 若接线把重复需求透传给判定模块会在此抛 SchedulingError
    scheduler.shutdown();
    assert.equal(statusOf(scheduler, dup.id), 'failed');
    assert.equal(reasonOf(scheduler, dup.id), 'unsatisfiable');
  });
});
