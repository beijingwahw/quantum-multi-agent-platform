/**
 * 质量波(2026-09)补覆盖 · task-lifecycle 不变量校验器
 *
 * 选点依据(c8 行级覆盖):checkTaskInvariants(四类不变量的违例分支
 * 与通过分支)与 assertLegalTaskTransition 的调试断言路径在既有套件中
 * 完全未执行——不变量校验器自身从未被校验,等于「裁判没有对拍」。
 * 本文件是纯函数测试:零定时器、零 IO、逐分支确定性。
 */
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertLegalTaskTransition,
  checkTaskInvariants,
  isLegalTaskTransition,
} from '../../src/core/task-lifecycle.js';
import { SchedulingError } from '../../src/utils/errors.js';
import type { Task } from '../../src/types/quantum-types.js';

const PREV = process.env.QUANTUM_ASSERT_INVARIANTS;
after(() => {
  if (PREV === undefined) delete process.env.QUANTUM_ASSERT_INVARIANTS;
  else process.env.QUANTUM_ASSERT_INVARIANTS = PREV;
});

function task(partial: Partial<Task> & { id: string }): Task {
  return partial as Task;
}

function snapshot(overrides: Partial<Parameters<typeof checkTaskInvariants>[1]>) {
  return {
    activeAssignments: 1,
    tasksInFlight: 1,
    pendingCount: 1,
    pendingTrackedSize: 1,
    pendingBucketEntries: 1,
    ...overrides,
  };
}

describe('质量波补覆盖 · checkTaskInvariants 四类不变量', () => {
  it('一致快照返回空违例表(裁判的通过面)', () => {
    const violations = checkTaskInvariants(
      [task({ id: 't1', status: 'completed', completedAt: new Date() })],
      snapshot({}),
    );
    assert.deepEqual(violations, []);
  });

  it('activeAssignments 与 |assigned ∪ running| 分裂被定罪', () => {
    const violations = checkTaskInvariants(
      [],
      snapshot({ activeAssignments: 2, tasksInFlight: 1 }),
    );
    assert.equal(violations.length, 1);
    assert.equal(violations[0]!.invariant, 'activeAssignments === |assigned ∪ running|');
    assert.equal(violations[0]!.expected, '1');
    assert.equal(violations[0]!.actual, '2');
  });

  it('pendingCount 与追踪集大小分裂被定罪', () => {
    // 桶对齐 tracked(2),隔离出仅 pendingCount 的分裂
    const violations = checkTaskInvariants(
      [],
      snapshot({ pendingCount: 1, pendingTrackedSize: 2, pendingBucketEntries: 2 }),
    );
    assert.equal(violations.length, 1);
    assert.equal(violations[0]!.invariant, 'pendingCount === pendingTracked.size');
  });

  it('挂起桶小于追踪集(丢任务)被定罪;惰性冗余不算违例', () => {
    // pendingCount 对齐 tracked(2),隔离出仅桶缺失的违例
    const lost = checkTaskInvariants(
      [],
      snapshot({ pendingBucketEntries: 0, pendingTrackedSize: 2, pendingCount: 2 }),
    );
    assert.equal(lost.length, 1);
    assert.equal(lost[0]!.invariant, 'pendingBuckets ⊇ pendingTracked（桶丢失挂起任务）');
    assert.equal(lost[0]!.actual, '0');

    // 桶内惰性残留(桶 >= 追踪集)是既定语义,不是违例
    const lazy = checkTaskInvariants(
      [],
      snapshot({ pendingBucketEntries: 3, pendingTrackedSize: 1 }),
    );
    assert.equal(lazy.length, 0);
  });

  it('非终态任务携带 completedAt 被逐任务定罪(报告任务 id 与状态)', () => {
    const violations = checkTaskInvariants(
      [
        task({ id: 'ok', status: 'completed', completedAt: new Date() }),
        task({ id: 'bad', status: 'running', completedAt: new Date() }),
      ],
      snapshot({}),
    );
    assert.equal(violations.length, 1);
    assert.equal(violations[0]!.invariant, 'completedAt ⇒ status === completed');
    assert.match(violations[0]!.actual, /bad.*running/);
  });

  it('复合违例全部并列返回(不短路漏报)', () => {
    const violations = checkTaskInvariants(
      [task({ id: 'bad', status: 'pending', completedAt: new Date() })],
      snapshot({ activeAssignments: 5, pendingBucketEntries: 0 }),
    );
    assert.equal(violations.length, 3, '三类计数违例 + 任务自洽违例同时在场');
  });
});

describe('质量波补覆盖 · assertLegalTaskTransition 的调试断言门控', () => {
  it('QUANTUM_ASSERT_INVARIANTS=1 时非法转移抛结构化错误并列出合法目标', () => {
    process.env.QUANTUM_ASSERT_INVARIANTS = '1';
    try {
      // completed 是终态:任何出边都非法
      assert.throws(
        () => assertLegalTaskTransition('completed', 'assigned'),
        (error: unknown) =>
          error instanceof SchedulingError &&
          error.message.includes('Illegal task state transition completed → assigned') &&
          // 错误消息携带该状态的合法目标列表(终态为空列表)
          error.message.includes("legal targets from 'completed'"),
      );
      // 合法转移在断言模式下照常放行
      assert.doesNotThrow(() => assertLegalTaskTransition('pending', 'assigned'));
      assert.equal(isLegalTaskTransition('pending', 'assigned'), true);
    } finally {
      delete process.env.QUANTUM_ASSERT_INVARIANTS;
    }
  });

  it('默认(未开启)时非法转移静默放行——生产热路径守卫语义由调用方承载', () => {
    delete process.env.QUANTUM_ASSERT_INVARIANTS;
    assert.doesNotThrow(() => assertLegalTaskTransition('cancelled', 'running'));
  });
});
