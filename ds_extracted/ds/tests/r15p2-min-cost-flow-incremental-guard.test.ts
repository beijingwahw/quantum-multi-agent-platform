/**
 * R15-P2 · 缺陷 3 红测：MinCostFlow 增量负环陷阱的具名拒绝。
 *
 * 现状（被定罪，R14 可执行证据）：同一实例「run → addEdge → run」时，
 * 新边可诱发负费用改进环；SPFA 只找 s-t 增广路，看不见环，第二次 run
 * 静默停在次优——S→A(容1)、A→T0(−1) 先解 {1,−1}；加 A→T1(−5) 重跑
 * 返回 {0,0}，冷解是 −5。
 *
 * 修复后契约：第二次 run 前检测到「上次 run 之后有 addEdge 变异且已有
 * 流在途」→ StateError 具名拒绝，消息指明增量重解请用
 * MinCostFlowPotentials（含环取消）。
 *
 * 位同构边界（本文件同时钉死不被定罪的路径，防守卫过宽）：
 * - 无变异的重复 run 幂等（min-cost-flow.test.ts 既有语义）；
 * - 首次 run 前任意 addEdge 不触发（全部生产调用方 batch-vcg /
 *   compound-brain / reserve-price-vcg 均为「新建→建边→run 一次」）；
 * - 上次 run 零流在途时 addEdge 后再 run 仍允许（等价于并图冷解——
 *   无残余流即无环取消需求，SPFA 语义仍精确）。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MinCostFlow } from '../src/core/min-cost-flow.js';
import { StateError } from '../src/utils/errors.js';

describe('R15-P2 · MinCostFlow 增量变异守卫', () => {
  it('R14 证据场景：有流在途 + 变异后重 run → StateError 具名拒绝并指向 MinCostFlowPotentials', () => {
    const f = new MinCostFlow(6);
    f.addEdge(0, 1, 1, 0); // S→A 容1
    f.addEdge(1, 3, 1, -1); // A→T0 −1
    f.addEdge(3, 5, 1, 0); // T0→sink
    const r1 = f.run(0, 5);
    assert.deepEqual(r1, { flow: 1, cost: -1 }, '首轮：上 T0，流 1 费 −1');

    f.addEdge(1, 4, 1, -5); // 新到 A→T1 −5（诱发置换改进环）
    f.addEdge(4, 5, 1, 0);

    // 修复前：{flow:0, cost:0} 静默次优（红）；修复后：具名拒绝
    assert.throws(
      () => f.run(0, 5),
      (err: unknown) =>
        err instanceof StateError &&
        err.message.includes('MinCostFlowPotentials') &&
        err.message.includes('addEdge'),
      '增量变异 + 在途流的重解必须具名拒绝（StateError），消息指向 MinCostFlowPotentials',
    );

    // 冷解对照不受影响：并图新解 −5（弃 T0 上 T1）
    const cold = new MinCostFlow(6);
    cold.addEdge(0, 1, 1, 0);
    cold.addEdge(1, 3, 1, -1);
    cold.addEdge(3, 5, 1, 0);
    cold.addEdge(1, 4, 1, -5);
    cold.addEdge(4, 5, 1, 0);
    assert.deepEqual(cold.run(0, 5), { flow: 1, cost: -5 });
  });

  it('位同构边界：无变异的重复 run 仍幂等（守卫不触发）', () => {
    const f = new MinCostFlow(3);
    f.addEdge(0, 1, 1, -1);
    f.addEdge(1, 2, 1, -1);
    const first = f.run(0, 2);
    const second = f.run(0, 2); // run 之后没有 addEdge → 合法
    assert.deepEqual(first, { flow: 1, cost: -2 });
    assert.deepEqual(second, { flow: 0, cost: 0 }, '已最优，无新增强路');
  });

  it('位同构边界：首次 run 前的 addEdge 不触发（生产调用方全部是该形态）', () => {
    const f = new MinCostFlow(4);
    f.addEdge(0, 1, 1, -5);
    f.addEdge(1, 3, 2, 0);
    f.addEdge(0, 2, 2, -1);
    f.addEdge(2, 3, 2, 0);
    assert.deepEqual(f.run(0, 3), { flow: 3, cost: -7 });
  });

  it('位同构边界：上次 run 零流在途时变异后重 run 仍允许，结果 = 并图冷解', () => {
    const warm = new MinCostFlow(4);
    warm.addEdge(0, 1, 1, 5); // 非负路：首 run 推零流（自由处置停止）
    assert.deepEqual(warm.run(0, 3), { flow: 0, cost: 0 });
    warm.addEdge(1, 3, 1, -7); // 新边使全路转负：5 + (−7) = −2
    const second = warm.run(0, 3); // 无在途流 → 允许
    assert.deepEqual(second, { flow: 1, cost: -2 });

    const cold = new MinCostFlow(4);
    cold.addEdge(0, 1, 1, 5);
    cold.addEdge(1, 3, 1, -7);
    assert.deepEqual(cold.run(0, 3), { flow: 1, cost: -2 }, '零流重跑与冷解同值');
  });
});
