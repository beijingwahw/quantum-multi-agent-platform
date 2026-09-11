/**
 * R8-A 质量波（第三遍 · 调度/市场子系统）回归网。
 *
 * 定罪与钉板：
 * 1. BudgetPacer.update(spend) 的 NaN 污染——R6 只守卫了构造期参数
 *    （budget/kappa/maxMu），同一条「μ 永久 NaN」污染链的另一端
 *    （每批 update 的 spend 输入）被漏掉：NaN 击穿 `spend < 0` 惰性
 *    守卫后 μ 不可逆变 NaN，下游只能拿到不指名来源的 mu 拒绝。
 * 2. GrowthMarketScheduler 单任务 market 路径缺免费处置：最优 s<0 时
 *    强制分配使 Clarke pivot 支付变负（v_w<0 时 min(max(·,0),v_w)=v_w），
 *    与模块头部的 IR/DSIC 声明及 Brain 接口的 null 语义矛盾。
 * 3. BatchVCGScheduler.allocateMyopic 同型：v<0 时输出负支付。
 * 4. 种子化模拟路径的确定性钉板（BatchVCG / GrowthMarket /
 *    CompoundBrain：同 seed 同输入 → 逐位一致的结算流与快照）。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BatchVCGScheduler,
  BudgetPacer,
  type BatchAgentSpec,
} from '../../src/core/batch-vcg-scheduler.js';
import {
  GrowthMarketScheduler,
  type GrowthAgentSpec,
} from '../../src/core/growth-market-scheduler.js';
import { CompoundBrain } from '../../src/core/compound-brain.js';
import { MechanismError } from '../../src/utils/errors.js';

const BASE = {
  successValue: 10,
  priorQuality: 0.5,
  priorWeight: 3,
  exploreCoefficient: 0,
  switchCostRate: 0,
};

// ----------------------------------------------------------------------------
// BudgetPacer.update：spend 域守卫（构造期守卫的漏网同胞）
// ----------------------------------------------------------------------------
describe('R8-A · BudgetPacer.update spend 域守卫', () => {
  it('update(NaN/负数/非数值)：MechanismError 且 μ 不被污染', () => {
    for (const bad of [Number.NaN, -1, '20' as unknown as number]) {
      const pacer = new BudgetPacer(10, 0.5, 100);
      pacer.update(20); // 先激活对偶（μ > 1）
      const muBefore = pacer.getMu();
      assert.ok(muBefore > 1, '前置：超支已激活对偶上升');
      assert.throws(
        () => pacer.update(bad),
        (err: unknown) => err instanceof MechanismError && err.message.includes('spend must be'),
        `spend=${String(bad)} 应被具名拒绝`,
      );
      // 拒绝零残留：pacemaker 状态可继续正常使用（修复前 NaN 会永久卡死 μ）
      assert.equal(pacer.getMu(), muBefore, '拒绝不得改动 μ');
      pacer.update(5);
      assert.ok(Number.isFinite(pacer.getMu()) && pacer.getMu() >= 1, '后续合法 update 仍正常工作');
    }
  });

  it('合法邻域不受影响：超支升 μ、零支出衰减回 1', () => {
    const pacer = new BudgetPacer(10, 0.5, 100);
    assert.equal(pacer.getMu(), 1);
    pacer.update(20); // ratio=2 → μ=2^0.5>1
    assert.ok(pacer.getMu() > 1);
    pacer.update(0); // ratio=0 → μ 收缩回下界 1
    assert.equal(pacer.getMu(), 1);
    // 零预算 pacemaker 维持禁用语义（除零守卫）
    const disabled = new BudgetPacer(0, 0.5, 100);
    disabled.update(20);
    assert.equal(disabled.getMu(), 1, 'budget<=0 时 update 维持禁用');
  });
});

// ----------------------------------------------------------------------------
// GrowthMarketScheduler：market 路径免费处置（负估值不再强制分配）
// ----------------------------------------------------------------------------
describe('R8-A · GrowthMarketScheduler 免费处置', () => {
  function spec(): GrowthAgentSpec {
    return {
      id: 'solo',
      capabilities: ['js', 'ml'],
      trueCost: 1,
      trueQuality: { js: 0.5, ml: 0.5 },
    };
  }
  const CFG = { ...BASE, switchCostRate: 0.5, seed: 42 };

  /** 在 js 上积累 25 单位资本 → dominant=js，ml 的切换成本 12.5 */
  function loadedScheduler(): GrowthMarketScheduler {
    const s = new GrowthMarketScheduler(CFG);
    s.register(spec());
    for (let i = 0; i < 25; i++) {
      const t = s.submitTask('js');
      assert.ok(t, 'js 任务估值正、必然分配');
      s.completeTask(t.taskId, true);
    }
    return s;
  }

  it('全员估值不抵报价（s<0）→ null 而非负支付强制分配', () => {
    const s = loadedScheduler();
    // v_ml = 10·0.5 − 0.5×25 = −7.5；s = −8.5 < 0
    assert.equal(s.submitTask('ml'), null, '免费处置：负边际任务弃标');
    // 修复前：强制分配且 payment = min(max(−7.5,0), −7.5) = −7.5（赢家倒贴）
  });

  it('合法邻域：正估值分配与支付口径不变', () => {
    const s = loadedScheduler();
    const t = s.submitTask('js'); // v_js = 10·q̂(js) − 0（主专业无切换成本）
    assert.ok(t, '正边际任务照常分配');
    assert.equal(t.winnerId, 'solo');
    assert.ok(t.payment >= 0 && t.payment <= t.socialValue, '支付 ∈ [0, v]');
    // 无竞争者（Clarke pivot 单价）→ 全额抽取 v
    assert.ok(Math.abs(t.payment - t.socialValue) < 1e-9);
    // 基线策略保持「总是分配」的既有行为（免费处置仅限 market 机制路径）
    const greedy = s.submitTask('ml', 'greedy');
    assert.ok(greedy, 'greedy 基线语义不变');
    assert.equal(greedy.payment, 1, '一价拍卖按报价支付');
  });
});

// ----------------------------------------------------------------------------
// BatchVCGScheduler.allocateMyopic：负估值支付下限 0
// ----------------------------------------------------------------------------
describe('R8-A · allocateMyopic 负估值支付下限', () => {
  function make(): BatchAgentSpec {
    return {
      id: 'm',
      capabilities: ['js', 'X'],
      trueCost: 1,
      trueQuality: { js: 0.5, X: 0.5 },
      capacity: 5,
    };
  }

  it('v<0 的强制分配支付为 0（不再倒贴）', () => {
    const s = new BatchVCGScheduler({ ...BASE, switchCostRate: 0.5, seed: 3 });
    s.register(make());
    for (let i = 0; i < 25; i++) {
      const alloc = s.allocateBatch(['js']);
      s.settleBatch(alloc.assignments.map((a) => ({ taskId: a.taskId, success: true })));
    }
    // v_X = 10·0.5 − 0.5×25 = −7.5；短视基线无免费处置仍强制分配……
    const myopic = s.allocateMyopic(['X']);
    assert.equal(myopic.assignments.length, 1, '基线语义：总是分配');
    // ……但支付不得为负（修复前 pay = min(max(−7.5,0), −7.5) = −7.5）
    assert.equal(myopic.payments['m'], 0, '负估值的支付下限为 0');
    assert.equal(myopic.assignments[0]!.paymentShare, 0);
  });

  it('合法邻域：正估值的短视支付公式不变', () => {
    const s = new BatchVCGScheduler(BASE);
    s.register(make());
    // v=5、无次优竞争者 → 短视单价 = min(max(5−0,0),5) = 5
    const myopic = s.allocateMyopic(['X']);
    assert.equal(myopic.payments['m'], 5);
  });
});

// ----------------------------------------------------------------------------
// 种子化模拟路径的确定性钉板（同 seed 同输入 → 逐位一致）
// ----------------------------------------------------------------------------
describe('R8-A · 市场机制种子确定性', () => {
  it('BatchVCGScheduler.simulateBatch：双实例同 seed 结算流与快照逐位一致', () => {
    const run = (): unknown[] => {
      const s = new BatchVCGScheduler({
        ...BASE,
        learningCeiling: 0.6,
        learningRate: 0.15,
        seed: 11,
      });
      s.register({
        id: 'a1',
        capabilities: ['X'],
        trueCost: 2,
        trueQuality: { X: 0.4 },
        capacity: 2,
      });
      s.register({
        id: 'a2',
        capabilities: ['X'],
        trueCost: 2.2,
        trueQuality: { X: 0.55 },
        capacity: 2,
      });
      const trace: unknown[] = [];
      for (let i = 0; i < 15; i++) {
        const { settlements, netWelfare } = s.simulateBatch(['X', 'X', 'X']);
        trace.push(settlements, netWelfare);
      }
      trace.push(s.getSnapshot(), s.getNetWelfare(), s.getWindowSuccessRate(0, 45));
      return trace;
    };
    assert.deepEqual(run(), run(), '同 seed 双实例必须产生逐位一致的结算轨迹');
  });

  it('GrowthMarketScheduler.simulateTask：双实例同 seed 结算流与快照逐位一致', () => {
    const run = (): unknown[] => {
      const s = new GrowthMarketScheduler({ seed: 7 });
      const agents: GrowthAgentSpec[] = [
        {
          id: 'expert',
          capabilities: ['research', 'coding'],
          trueCost: 3,
          trueQuality: { research: 0.9, coding: 0.5 },
        },
        {
          id: 'novice',
          capabilities: ['research', 'coding'],
          trueCost: 1.2,
          trueQuality: { research: 0.5, coding: 0.6 },
        },
      ];
      agents.forEach((a) => s.register(a));
      const trace: unknown[] = [];
      for (let i = 0; i < 40; i++) {
        const r = s.simulateTask(i % 2 === 0 ? 'research' : 'coding');
        assert.ok(r, '正边际任务必然分配');
        trace.push(r);
      }
      trace.push(s.getSnapshot(), s.getNetWelfare(), s.getSettledCount());
      return trace;
    };
    assert.deepEqual(run(), run(), '同 seed 双实例必须产生逐位一致的结算轨迹');
  });

  it('CompoundBrain.simulateBatch：双实例同 seed 结算流与学习状态逐位一致', () => {
    const run = (): unknown => {
      const brain = new CompoundBrain({ simAlpha: 0.8, simBeta: 0.15, seed: 5 });
      brain.registerAgent({ id: 'a', capabilities: ['X'], trueCost: 1, trueQuality: { X: 0.6 } });
      brain.registerAgent({ id: 'b', capabilities: ['X'], trueCost: 1.5, trueQuality: { X: 0.5 } });
      const trace: unknown[] = [];
      for (let i = 0; i < 25; i++) {
        const { settlements, realizedWelfare } = brain.simulateBatch([
          { capability: 'X', value: 10 },
          { capability: 'X', value: 9 },
        ]);
        trace.push(settlements, realizedWelfare);
      }
      const st = brain.getState();
      // pendingBacklog.oldestAgeMs 是可观测性墙钟，不参与确定性口径
      trace.push(st.settledCount, st.successRate, st.netWelfare, st.agents);
      return trace;
    };
    assert.deepEqual(run(), run(), '同 seed 双实例必须产生逐位一致的学习轨迹');
  });
});
