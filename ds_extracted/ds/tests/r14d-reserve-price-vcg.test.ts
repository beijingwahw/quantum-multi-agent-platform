/**
 * R14-D 创新 2：reserve-price-vcg（带公开保留价的批量 VCG 资格截除变体）
 * 的行为钉。
 *
 * 断言面：
 * 1. 经典 Clarke pivot 手算对照（第二价格 = 替代者报价）；
 * 2. DSIC 证书——保留价（及 μ 组合）下 markup 扫描的虚报收益恒 0；
 * 3. IR——支付 ≥ 报价 × 胜场（pivot 项 ≥ 0）；
 * 4. 诚实边界钉死——保留价截的是**资格**不是**支付**：
 *    垄断 pivot 仍支付 v；竞争市场收紧保留价反而抬升在位者 pivot；
 * 5. 负对照——负/NaN 保留价、μ<1、重复注册、非法容量、空能力名被具名拒绝。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  allocateWithReserve,
  reserveOfCapability,
  type ReservePriceAgent,
} from '../src/core/reserve-price-vcg.js';
import type { EstimatorParams } from '../src/core/market-estimation.js';
import { MechanismError } from '../src/utils/errors.js';

const PARAMS: EstimatorParams = {
  priorQuality: 0.5,
  priorWeight: 3,
  exploreCoefficient: 0,
  switchCostRate: 0,
  successValue: 10,
};

function mkAgent(
  id: string,
  capabilities: string[],
  trueCost: number,
  cred: Record<string, number>,
  opts: { markup?: number; capacity?: number } = {},
): ReservePriceAgent {
  const spec: ReservePriceAgent['record']['spec'] = { trueCost, credentialQuality: cred };
  if (opts.markup !== undefined) spec.bidMarkup = opts.markup;
  return {
    id,
    capabilities,
    capacity: opts.capacity ?? 1,
    record: {
      spec,
      attempts: new Map(),
      successes: new Map(),
      capital: new Map(),
    },
  };
}

/** 两 agent 第二价格实例：A(v=9,b=1) B(v=8,b=4)，单任务 'x' */
function secondPriceAgents(): ReservePriceAgent[] {
  return [mkAgent('a', ['x'], 1, { x: 0.9 }), mkAgent('b', ['x'], 4, { x: 0.8 })];
}

describe('R14-D reserve-price-vcg · 经典路径手算对照', () => {
  it('无保留价（Infinity）退化为经典 VCG：第二价格支付 = 替代者报价', () => {
    const alloc = allocateWithReserve(secondPriceAgents(), ['x'], PARAMS, Infinity);
    assert.deepEqual(
      alloc.assignments.map((a) => [a.agentId, a.capability]),
      [['a', 'x']],
    );
    // p_a = b_a + (W* − W_{−a}) = 1 + (8 − 4) = 5 = b_b
    assert.strictEqual(alloc.payments.a, 5);
    assert.strictEqual(alloc.totalPayment, 5);
    assert.strictEqual(alloc.welfare, 8);
    assert.strictEqual(alloc.maxWelfareNoReserve, 8);
    assert.strictEqual(alloc.efficiencyLoss, 0);
    assert.strictEqual(alloc.platformTake, 4); // Σv 9 − Σp 5
    assert.strictEqual(alloc.droppedTasks, 0);
    assert.strictEqual(alloc.excludedByReserve, 0);
    assert.strictEqual(alloc.mu, 1);
  });

  it('保留价截除竞争者：在位者 pivot 抬升至 v（机制的如实性质，非缺陷）', () => {
    // b_b = 4 > 3.5：B 丧失资格 → W_{−a} = 0 → p_a = 1 + 8 = 9
    const alloc = allocateWithReserve(secondPriceAgents(), ['x'], PARAMS, 3.5);
    assert.deepEqual(
      alloc.assignments.map((a) => a.agentId),
      ['a'],
    );
    assert.strictEqual(alloc.payments.a, 9);
    assert.strictEqual(alloc.excludedByReserve, 1);
    assert.strictEqual(alloc.platformTake, 0);
    // 分配未变：效率无损（保留价只动了反事实可行域）
    assert.strictEqual(alloc.efficiencyLoss, 0);
  });

  it('垄断边界：bid ≤ reserve 的垄断者仍支付 v（保留价不封支付水平）', () => {
    const monopoly = [mkAgent('a', ['x'], 1, { x: 0.9 })];
    const alloc = allocateWithReserve(monopoly, ['x'], PARAMS, 5);
    assert.strictEqual(alloc.assignments.length, 1);
    assert.strictEqual(alloc.payments.a, 9); // = v（Clarke pivot 未被保留价削减）
    assert.strictEqual(alloc.excludedByReserve, 0);
  });

  it('保留价低于全部报价：全弃标且效率损失如实核算', () => {
    const alloc = allocateWithReserve(secondPriceAgents(), ['x'], PARAMS, 0.5);
    assert.deepEqual(alloc.assignments, []);
    assert.deepEqual(alloc.payments, {});
    assert.strictEqual(alloc.totalPayment, 0);
    assert.strictEqual(alloc.droppedTasks, 1);
    assert.strictEqual(alloc.welfare, 0);
    assert.strictEqual(alloc.maxWelfareNoReserve, 8);
    assert.strictEqual(alloc.efficiencyLoss, 8);
    assert.strictEqual(alloc.excludedByReserve, 2);
  });

  it('容量约束生效：cap=1 的双任务批次由 A 与 B 分摊', () => {
    const agents = [
      mkAgent('a', ['x'], 1, { x: 0.9 }, { capacity: 1 }),
      mkAgent('b', ['x'], 4, { x: 0.8 }, { capacity: 1 }),
    ];
    const alloc = allocateWithReserve(agents, ['x', 'x'], PARAMS, Infinity);
    const winners = alloc.assignments.map((a) => a.agentId).sort();
    assert.deepEqual(winners, ['a', 'b']);
    // W* = 8 + 4 = 12；p_a = 1 + (12 − 4) = 9；p_b = 4 + (12 − 8) = 8
    assert.strictEqual(alloc.payments.a, 9);
    assert.strictEqual(alloc.payments.b, 8);
    assert.strictEqual(alloc.welfare, 12);
  });

  it('保留价日程：按能力映射与 default 缺省的读取口径', () => {
    assert.equal(reserveOfCapability(3.5, 'x'), 3.5);
    assert.equal(reserveOfCapability({ perCapability: { x: 3.5 } }, 'x'), 3.5);
    assert.equal(reserveOfCapability({ perCapability: { x: 3.5 } }, 'y'), Infinity);
    assert.equal(reserveOfCapability({ default: 2, perCapability: { x: 3.5 } }, 'x'), 3.5);
    assert.equal(reserveOfCapability({ default: 2 }, 'y'), 2);
    // 映射日程下的机制行为与统一数值一致
    const byMap = allocateWithReserve(secondPriceAgents(), ['x'], PARAMS, {
      perCapability: { x: 3.5 },
    });
    assert.strictEqual(byMap.payments.a, 9);
  });
});

describe('R14-D reserve-price-vcg · μ 组合（仿射 pivot）', () => {
  it('μ=1.5 的仿射 pivot 手算：p = b + (Φ* − Φ_{−i})/μ', () => {
    // Φ = Σ(v − 1.5b)：A: 9−1.5=7.5；B: 8−6=2 → p_a = 1 + (7.5−2)/1.5
    const alloc = allocateWithReserve(secondPriceAgents(), ['x'], PARAMS, Infinity, { mu: 1.5 });
    assert.strictEqual(alloc.payments.a, 4.666666667);
    assert.strictEqual(alloc.mu, 1.5);
    // μ 收紧了支付水平（5 → 4.67）：支付水平控制属于 μ，与资格截除正交
    assert.ok(alloc.payments.a < 5);
  });
});

describe('R14-D reserve-price-vcg · DSIC / IR 证书', () => {
  function dsicMaxGain(
    agents: ReservePriceAgent[],
    capabilities: string[],
    reserve: number | { default?: number; perCapability?: Record<string, number> },
    mu?: number,
  ): number {
    let worst = 0;
    for (const agent of agents) {
      const truthful = allocateWithReserve(agents, capabilities, PARAMS, reserve, mu ? { mu } : {});
      const utilityOf = (alloc: ReturnType<typeof allocateWithReserve>): number => {
        const k = alloc.assignments.filter((a) => a.agentId === agent.id).length;
        return (alloc.payments[agent.id] ?? 0) - agent.record.spec.trueCost * k;
      };
      const u0 = utilityOf(truthful);
      for (const markup of [-0.3, -0.1, 0.1, 0.3, 0.5, 1.0]) {
        const manipulated = agents.map((a) =>
          a.id === agent.id
            ? mkAgent(
                a.id,
                a.capabilities,
                a.record.spec.trueCost,
                a.record.spec.credentialQuality ?? {},
                { ...optsOf(a), markup },
              )
            : a,
        );
        const alloc = allocateWithReserve(
          manipulated,
          capabilities,
          PARAMS,
          reserve,
          mu ? { mu } : {},
        );
        worst = Math.max(worst, utilityOf(alloc) - u0);
      }
    }
    return worst;
  }
  function optsOf(a: ReservePriceAgent): { capacity?: number } {
    return { capacity: a.capacity };
  }

  it('保留价下 markup 扫描的虚报收益恒 0（经典 pivot）', () => {
    const agents = [
      mkAgent('a', ['x'], 1, { x: 0.9 }, { capacity: 2 }),
      mkAgent('b', ['x'], 4, { x: 0.8 }),
      mkAgent('c', ['x'], 2.5, { x: 0.7 }),
    ];
    assert.ok(dsicMaxGain(agents, ['x', 'x'], 6) <= 1e-9, '虚报不得有利可图');
  });

  it('保留价 × μ 组合下 markup 扫描的虚报收益恒 0（仿射 pivot）', () => {
    const agents = [
      mkAgent('a', ['x'], 1, { x: 0.9 }, { capacity: 2 }),
      mkAgent('b', ['x'], 4, { x: 0.8 }),
      mkAgent('c', ['x'], 2.5, { x: 0.7 }),
    ];
    assert.ok(dsicMaxGain(agents, ['x', 'x'], 6, 1.5) <= 1e-9, 'μ 组合保持精确 DSIC');
  });

  it('IR：所有赢家支付 ≥ 报价 × 胜场（pivot 项非负）', () => {
    const agents = [
      mkAgent('a', ['x'], 1, { x: 0.9 }, { capacity: 2 }),
      mkAgent('b', ['x'], 4, { x: 0.8 }),
      mkAgent('c', ['y'], 2, { y: 0.75 }),
    ];
    const alloc = allocateWithReserve(agents, ['x', 'x', 'y'], PARAMS, 5);
    const wins = new Map<string, number>();
    for (const a of alloc.assignments) wins.set(a.agentId, (wins.get(a.agentId) ?? 0) + 1);
    for (const [id, k] of wins) {
      const agent = agents.find((ag) => ag.id === id)!;
      const bid = agent.record.spec.trueCost * (1 + (agent.record.spec.bidMarkup ?? 0));
      assert.ok(
        (alloc.payments[id] ?? 0) >= bid * k - 1e-9,
        `IR 违约：${id} 支付 ${alloc.payments[id]} < ${bid * k}`,
      );
    }
  });

  it('确定性：同输入两次调用逐字段一致（纯函数，无状态）', () => {
    const agents = secondPriceAgents();
    const a = allocateWithReserve(agents, ['x', 'x'], PARAMS, 4);
    const b = allocateWithReserve(agents, ['x', 'x'], PARAMS, 4);
    assert.deepEqual(b, a);
  });
});

describe('R14-D reserve-price-vcg · 负对照（走私审判）', () => {
  it('负 / NaN 保留价被具名拒绝（统一数值与映射两形态）', () => {
    assert.throws(
      () => allocateWithReserve(secondPriceAgents(), ['x'], PARAMS, -1),
      (err: unknown) => err instanceof MechanismError && err.message.includes('reserve'),
    );
    assert.throws(
      () => allocateWithReserve(secondPriceAgents(), ['x'], PARAMS, Number.NaN),
      (err: unknown) => err instanceof MechanismError && err.message.includes('reserve'),
    );
    assert.throws(
      () => allocateWithReserve(secondPriceAgents(), ['x'], PARAMS, { perCapability: { x: -2 } }),
      (err: unknown) => err instanceof MechanismError && err.message.includes("capability 'x'"),
    );
  });

  it('μ < 1 / NaN 被拒绝（镜像既有仿射域）', () => {
    assert.throws(
      () => allocateWithReserve(secondPriceAgents(), ['x'], PARAMS, Infinity, { mu: 0.5 }),
      (err: unknown) => err instanceof MechanismError && err.message.includes('mu'),
    );
    assert.throws(
      () => allocateWithReserve(secondPriceAgents(), ['x'], PARAMS, Infinity, { mu: Number.NaN }),
      (err: unknown) => err instanceof MechanismError && err.message.includes('mu'),
    );
  });

  it('重复 agent id 被拒绝（对齐 01#14 注册纪律）', () => {
    const dup = [mkAgent('a', ['x'], 1, { x: 0.9 }), mkAgent('a', ['x'], 3, { x: 0.6 })];
    assert.throws(
      () => allocateWithReserve(dup, ['x'], PARAMS, Infinity),
      (err: unknown) => err instanceof MechanismError && err.message.includes('already registered'),
    );
  });

  it('非法容量 / 空能力名 / 非法 trueCost 被具名拒绝', () => {
    const badCap = [mkAgent('a', ['x'], 1, { x: 0.9 }, { capacity: -1 })];
    assert.throws(
      () => allocateWithReserve(badCap, ['x'], PARAMS, Infinity),
      (err: unknown) => err instanceof MechanismError && err.message.includes('capacity'),
    );
    const badCap2 = [mkAgent('a', ['x'], 1, { x: 0.9 }, { capacity: 1.5 })];
    assert.throws(
      () => allocateWithReserve(badCap2, ['x'], PARAMS, Infinity),
      /capacity must be a non-negative integer/,
    );
    const okAgents = secondPriceAgents();
    assert.throws(
      () => allocateWithReserve(okAgents, [''], PARAMS, Infinity),
      (err: unknown) => err instanceof MechanismError && err.message.includes('capabilities[0]'),
    );
    const badCost = [mkAgent('a', ['x'], Number.NaN, { x: 0.9 })];
    assert.throws(
      () => allocateWithReserve(badCost, ['x'], PARAMS, Infinity),
      (err: unknown) => err instanceof MechanismError && err.message.includes('trueCost'),
    );
  });
});
