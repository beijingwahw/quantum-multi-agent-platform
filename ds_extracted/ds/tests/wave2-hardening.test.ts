/**
 * Wave 2 深度遍历收尾回归：第二轮全仓遍历确认的遗留缺陷修复锚点。
 *
 * 覆盖（编号对应全量审计报告第 4 章附表）：
 * - 01#14 重复 agent 注册静默覆盖 → 显式 SchedulingError（与 VCG 调度器对齐）
 * - 01#6  依赖数组别名通道 → submitTask 防御拷贝（环的结构性 unreachable）
 * - 01#5  挂起任务 TTL（默认关闭，配置即启用）+ 巡检定时器随首个提交启动
 * - 01#9  restarts/topK 退化参数在求解器入口拒绝
 * - 01#11 Born 采样支撑集排除零概率态（严格不等式边界，两个采样器同契约）
 * - 01#19 cvarOrder 相等能量按索引决胜（不再依赖 sort 稳定性）
 * - 01#3  单任务块超 qubitCap：跳过并告警，不再让引擎在调度中段抛错
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { QuantumScheduler } from '../src/core/quantum-scheduler.js';
import {
  resolveCommonSolverOptions,
  sampleIndexByProbabilities,
  sampleBestIndexByShots,
  cvarOrder,
} from '../src/core/solver-common.js';
import { QuantumEngineError, SchedulingError } from '../src/utils/errors.js';
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

describe('Wave 2 收尾 · 重复注册拒绝（01#14）', () => {
  it('同 ID 二次注册抛 SchedulingError，不再静默覆盖', () => {
    const scheduler = new QuantumScheduler({});
    scheduler.registerAgent(makeAgent('a1', ['js']));
    assert.throws(
      () => scheduler.registerAgent(makeAgent('a1', ['python'])),
      (err: unknown) => err instanceof SchedulingError && /already registered/.test(err.message),
    );
  });
});

describe('Wave 2 收尾 · 依赖数组别名隔离（01#6）', () => {
  it('提交后调用方突变原 dependencies 数组不影响调度器内任务', () => {
    const scheduler = new QuantumScheduler({});
    scheduler.registerAgent(makeAgent('a1', ['js']));
    const t1 = scheduler.submitTask(makeTask('T1', 'js'));
    // t1 提交后即 assigned（能力匹配），可作为合法依赖
    scheduler.completeTask(t1.id, true, 'done');
    const t3 = scheduler.submitTask(makeTask('T3', 'js'));
    scheduler.completeTask(t3.id, true, 'done');

    const deps = [t1.id];
    const t2 = scheduler.submitTask({ ...makeTask('T2', 'js'), dependencies: deps });
    assert.equal(t2.dependencies.length, 1);

    // 别名通道：{...task} 浅拷贝下这一 push 会改写调度器内的 T2 依赖
    deps.push(t3.id);
    assert.equal(t2.dependencies.length, 1, '调度器持有的依赖数组必须与调用方隔离');
    assert.deepEqual(t2.dependencies, [t1.id]);
  });

  it('未知依赖仍然拒绝（既有契约不回归）', () => {
    const scheduler = new QuantumScheduler({});
    assert.throws(
      () => scheduler.submitTask({ ...makeTask('T1', 'js'), dependencies: ['ghost'] }),
      SchedulingError,
    );
  });
});

describe('Wave 2 收尾 · 挂起任务 TTL（01#5）', () => {
  it('配置 pendingTimeoutMs 后，不可满足任务超时转 failed 并携带结构化原因', async () => {
    const scheduler = new QuantumScheduler({
      scheduling: {
        autoSchedule: false,
        pendingTimeoutMs: 60,
        sweepInterval: 25,
      },
    });
    // 能力无人具备 → 永久 pending 的典型不可满足任务
    scheduler.registerAgent(makeAgent('a1', ['python']));
    const task = scheduler.submitTask(makeTask('T1', 'javascript'));
    assert.equal(task.status, 'pending');

    // 巡检定时器必须随首个提交启动（而非首个分配）——否则本用例永不触发
    await new Promise((resolve) => setTimeout(resolve, 250));
    assert.equal(task.status, 'failed');
    assert.equal((task.result as { reason?: string } | undefined)?.reason, 'pending_timeout');
    assert.equal(scheduler.getSystemMetrics().pendingTasks, 0);
  });

  it('默认关闭：无 pendingTimeoutMs 配置时任务保持 pending（长依赖链语义保留）', async () => {
    const scheduler = new QuantumScheduler({
      scheduling: { autoSchedule: false, sweepInterval: 25 },
    });
    scheduler.registerAgent(makeAgent('a1', ['python']));
    const task = scheduler.submitTask(makeTask('T1', 'javascript'));
    await new Promise((resolve) => setTimeout(resolve, 120));
    assert.equal(task.status, 'pending');
  });
});

describe('Wave 2 收尾 · 求解器退化参数拒绝（01#9）', () => {
  it('restarts=0 在入口拒绝（不再产出空角度 + Infinity 最优）', () => {
    assert.throws(
      () => resolveCommonSolverOptions({ restarts: 0 }, 'argmax-valid'),
      (err: unknown) => err instanceof QuantumEngineError && /restarts/.test(err.message),
    );
  });

  it('topK=0 在入口拒绝（不再产出空结果集）', () => {
    assert.throws(
      () => resolveCommonSolverOptions({ topK: 0 }, 'argmax-valid'),
      (err: unknown) => err instanceof QuantumEngineError && /topK/.test(err.message),
    );
  });

  it('合法缺省仍然通过（缺省值不在拒绝范围）', () => {
    const resolved = resolveCommonSolverOptions({}, 'argmax-valid');
    assert.ok(resolved.restarts >= 1);
    assert.ok(resolved.topK >= 1);
  });
});

describe('Wave 2 收尾 · Born 采样支撑集（01#11）', () => {
  it('sampleIndexByProbabilities 不返回零概率态（r=0 且首段零质量）', () => {
    const probs = new Float64Array([0, 0.5, 0.5]);
    assert.equal(
      sampleIndexByProbabilities(probs, () => 0),
      1,
    );
  });

  it('sampleIndexByProbabilities 正常区间行为保持（CDF 语义）', () => {
    const probs = new Float64Array([0.5, 0.5]);
    assert.equal(
      sampleIndexByProbabilities(probs, () => 0.9),
      1,
    );
    assert.equal(
      sampleIndexByProbabilities(probs, () => 0.1),
      0,
    );
  });

  it('sampleBestIndexByShots 同契约：r=0 落在首个正质量态', () => {
    const probs = new Float64Array([0, 0, 1]);
    const chosen = sampleBestIndexByShots(
      probs,
      4,
      () => 0,
      (i) => -i,
    );
    assert.equal(chosen, 2);
  });

  it('sampleBestIndexByShots 中段零概率态不被采中', () => {
    // 质量 [0.5, 0, 0.5]，r 恰落在 0.5 边界 → 严格不等式落到 index 2
    const probs = new Float64Array([0.5, 0, 0.5]);
    const chosen = sampleBestIndexByShots(
      probs,
      1,
      () => 0.5,
      (i) => -i,
    );
    assert.equal(chosen, 2);
  });
});

describe('Wave 2 收尾 · cvarOrder 索引决胜（01#19）', () => {
  it('相等能量按索引升序（比较器自承载，不依赖 sort 稳定性）', () => {
    const order = cvarOrder(new Float64Array([5, 3, 3, 7]));
    assert.deepEqual(Array.from(order), [1, 2, 0, 3]);
  });
});

describe('Wave 2 收尾 · 全空间单块超限兜底（01#3）', () => {
  it('单任务×大空闲池超 qubitCap：跳过该块不抛错，任务留 pending', () => {
    const scheduler = new QuantumScheduler({
      scheduling: {
        autoSchedule: false,
        quantum: { subspaceCap: 32, qubitCap: 12 },
      },
    });
    // 40 个空闲 agent：子空间维 P(40,1)=40 > subspaceCap=32 → 回退全空间；
    // 全空间 1×40=40 > qubitCap=12 → 修复前引擎在调度中段抛 QuantumEngineError
    for (let i = 0; i < 40; i++) {
      scheduler.registerAgent(makeAgent(`a${i}`, ['test']));
    }
    const task = scheduler.submitTask(makeTask('T1', 'test'));

    const report = scheduler.scheduleBatchQuantum();
    assert.equal(report.representation, 'fullspace');
    assert.equal(report.assigned, 0, '超限块必须被跳过而非抛错');
    assert.equal(task.status, 'pending', '被跳过的任务保持 pending 等待下一轮');
  });
});
