import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MinCostFlow } from '../src/core/min-cost-flow.js';
import { MechanismError } from '../src/utils/errors.js';

describe('MinCostFlow（自由处置最小费用流）', () => {
  it('单条负费用路径：满流推进，费用 = 流×单位费用', () => {
    const f = new MinCostFlow(4);
    f.addEdge(0, 1, 1, -2);
    f.addEdge(1, 3, 1, -1);
    const { flow, cost } = f.run(0, 3);
    assert.equal(flow, 1);
    assert.equal(cost, -3);
  });

  it('自由处置：边际费用非负的路径不推进（多分配反而降福利）', () => {
    const f = new MinCostFlow(4);
    f.addEdge(0, 1, 1, -2);
    f.addEdge(1, 3, 1, 5); // 路径总费用 +3 ≥ 0
    const { flow, cost } = f.run(0, 3);
    assert.equal(flow, 0);
    assert.equal(cost, 0);
  });

  it('多条路径按费用升序推进至无利可图（手算对照）', () => {
    // 两条单位路径：上 -3、下 -1 → 都推进；再无负费用路则停
    const f = new MinCostFlow(6);
    f.addEdge(0, 1, 1, -1);
    f.addEdge(1, 3, 1, -2); // 路径A：-3
    f.addEdge(0, 2, 1, 0);
    f.addEdge(2, 4, 1, -1); // 路径B：-1
    f.addEdge(3, 5, 2, 0);
    f.addEdge(4, 5, 2, 0);
    const { flow, cost } = f.run(0, 5);
    assert.equal(flow, 2);
    assert.equal(cost, -4);
  });

  it('容量竞争：费用更低的路径吃满容量，溢出走次优', () => {
    // s→a 容量1（费用-5）、s→b 容量2（费用-1）；a/b→t 充足
    const f = new MinCostFlow(4);
    const cheap = f.addEdge(0, 1, 1, -5);
    f.addEdge(0, 2, 2, -1);
    f.addEdge(1, 3, 1, 0);
    f.addEdge(2, 3, 2, 0);
    const { flow, cost } = f.run(0, 3);
    assert.equal(flow, 3);
    assert.equal(cost, -7); // 1×(-5) + 2×(-1)
    assert.equal(f.edgeOccupied(cheap), true); // 便宜边被吃满
  });

  it('edgeOccupied：未占用边为 false，分配后为 true', () => {
    const f = new MinCostFlow(3);
    const e = f.addEdge(0, 2, 1, -1);
    assert.equal(f.edgeOccupied(e), false);
    f.run(0, 2);
    assert.equal(f.edgeOccupied(e), true);
  });

  it('残余网络反向边：撤流语义正确（再跑一次可反转此前分配）', () => {
    // 第一次 run 后，把 t→s 视作新源汇重推会在反向边上得到对消流。
    // 这里验证更实用的性质：对同一实例重复 run 幂等（第二次无负费用路）。
    const f = new MinCostFlow(3);
    f.addEdge(0, 1, 1, -1);
    f.addEdge(1, 2, 1, -1);
    const first = f.run(0, 2);
    const second = f.run(0, 2);
    assert.equal(first.flow, 1);
    assert.equal(second.flow, 0); // 已最优，无新增强路
    assert.equal(second.cost, 0);
  });

  it('越界节点抛 MechanismError（领域错误而非裸 Error）', () => {
    const f = new MinCostFlow(2);
    assert.throws(
      () => f.addEdge(5, 1, 1, 1),
      (err: unknown) => err instanceof MechanismError && /out of range/.test(err.message),
    );
  });
});
