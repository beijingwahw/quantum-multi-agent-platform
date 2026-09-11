/**
 * CompoundBrain 事件监听器异常隔离回归网（2026-09 代码质量遍历）：
 *
 * 08#1 只把 'allocated' 的 emit 包进了 try/catch；同类「状态已提交、
 * 结果已丢失」的洞在其余三个事件上原样存在：
 *   - 'backlog_warning' 在 allocateBatch 尾部（guarded 'allocated' 之前！）
 *     裸 emit——坏监听器让调用方拿不到 assignments/taskId，pending 台账
 *     里的任务永不可结算；
 *   - 'settled' 在 settle 的 pending.delete 之后裸 emit——结算已入账但
 *     调用方拿到异常，重试恒 false，被误读为「结算失败」；
 *   - 'settle_skipped' 同理把显式 return false 契约变成异常。
 * 修复：全部 emit 走 guardedEmit（与 AgentManager 08#41 同款）。
 * 本文件锁定：监听器抛错时状态变更与返回值完好。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CompoundBrain } from '../../src/core/compound-brain.js';

function freshBrain(listeners: {
  allocated?: () => void;
  settled?: () => void;
  backlog?: () => void;
}): CompoundBrain {
  const brain = new CompoundBrain({ seed: 7, pendingBacklogWarnAt: 1, defaultTaskValue: 10 });
  brain.registerAgent(
    {
      id: 'a1',
      capabilities: ['api'],
      trueCost: 1,
      trueQuality: { api: 0.7 },
      capacity: 2,
    },
    1,
  );
  if (listeners.allocated) brain.on('allocated', listeners.allocated);
  if (listeners.settled) brain.on('settled', listeners.settled);
  if (listeners.backlog) brain.on('backlog_warning', listeners.backlog);
  return brain;
}

const boom = (): never => {
  throw new Error('listener boom');
};

describe('CompoundBrain 监听器异常隔离（state committed, result kept）', () => {
  it('坏 backlog_warning 监听器不吞分配结果：assignments 可用且可结算', () => {
    const brain = freshBrain({ backlog: boom });
    const alloc = brain.allocateBatch([{ capability: 'api', value: 10 }]);
    assert.equal(alloc.assignments.length, 1, '分配结果必须返回给调用方');
    // 台账里的任务必须还能结算（学习资本照常推进）
    assert.equal(brain.settle(alloc.assignments[0]!.taskId, true), true);
    brain.dispose();
  });

  it('坏 settled 监听器不改写结算结果：settle 返回 true 且幂等语义完好', () => {
    const brain = freshBrain({ settled: boom });
    const alloc = brain.allocateBatch([{ capability: 'api', value: 10 }]);
    const taskId = alloc.assignments[0]!.taskId;
    assert.equal(brain.settle(taskId, true), true, '已提交的结算必须返回 true');
    assert.equal(brain.settle(taskId, true), false, '重试仍是幂等 false（恰一次入账）');
    assert.equal(brain.getState().settledCount, 1, '学习履历恰好推进一次');
    assert.equal(brain.getState().pendingBacklog.count, 0, '台账已出清');
    brain.dispose();
  });

  it('坏 allocated 监听器不吞分配结果（08#1 既有行为保持）', () => {
    const brain = freshBrain({ allocated: boom });
    const alloc = brain.allocateBatch([{ capability: 'api', value: 10 }]);
    assert.equal(alloc.assignments.length, 1);
    assert.equal(brain.settle(alloc.assignments[0]!.taskId, false), true);
    brain.dispose();
  });

  it('simulateBatch 在坏 settled 监听器下完整结算全批（不中断半途）', () => {
    const brain = freshBrain({ settled: boom });
    const sim = brain.simulateBatch([
      { capability: 'api', value: 10 },
      { capability: 'api', value: 9 },
    ]);
    assert.equal(
      sim.settlements.length,
      sim.allocation.assignments.length,
      '每个分配都必须走到结算',
    );
    assert.ok(sim.settlements.length >= 1);
    assert.equal(brain.getState().pendingBacklog.count, 0, '无任务滞留台账');
    brain.dispose();
  });
});
