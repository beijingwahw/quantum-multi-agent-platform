import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  bidOf,
  dominantOf,
  estimateQuality,
  exploreBonus,
  socialValueOf,
  switchCostOf,
  effectiveQuality,
  updateReputation,
  recordSettlement,
  SettlementHistory,
  type EstimatorParams,
  type MarketAgentRecord,
} from '../src/core/market-estimation.js';

const PARAMS: EstimatorParams = {
  priorQuality: 0.5,
  priorWeight: 2,
  exploreCoefficient: 1,
  switchCostRate: 0.1,
  successValue: 10,
};

function makeRecord(
  overrides: {
    attempts?: Record<string, number>;
    successes?: Record<string, number>;
    capital?: Record<string, number>;
    spec?: Partial<MarketAgentRecord['spec']>;
  } = {},
): MarketAgentRecord {
  return {
    spec: { trueCost: 5, ...overrides.spec },
    attempts: new Map(Object.entries(overrides.attempts ?? {})),
    successes: new Map(Object.entries(overrides.successes ?? {})),
    capital: new Map(Object.entries(overrides.capital ?? {})),
  };
}

describe('市场机制共享估值层', () => {
  it('bidOf：报价 = 真实成本 × (1 + 加成)，如实报价时等于成本', () => {
    assert.equal(bidOf(makeRecord({ spec: { trueCost: 5 } })), 5);
    assert.equal(bidOf(makeRecord({ spec: { trueCost: 5, bidMarkup: 0.2 } })), 6);
  });

  it('estimateQuality：贝叶斯收缩的手算对照（先验与凭证两口径）', () => {
    const rt = makeRecord({ attempts: { js: 3 }, successes: { js: 2 } });
    // (2 + 0.5×2) / (3+2) = 0.6 —— 全局先验
    assert.equal(estimateQuality(rt, 'js', PARAMS), 0.6);
    // 凭证覆盖先验：(2 + 0.8×2) / 5 = 0.72
    const credentialed = makeRecord({
      attempts: { js: 3 },
      successes: { js: 2 },
      spec: { trueCost: 5, credentialQuality: { js: 0.8 } },
    });
    assert.equal(estimateQuality(credentialed, 'js', PARAMS), 0.72);
    // 无历史：精确回到先验
    assert.equal(estimateQuality(makeRecord(), 'js', PARAMS), 0.5);
  });

  it('dominantOf/switchCostOf：主专业判定与专业化机会成本', () => {
    const rt = makeRecord({ capital: { js: 5, ml: 2 } });
    assert.equal(dominantOf(rt), 'js');
    assert.equal(switchCostOf(rt, 'js', PARAMS), 0); // 留在主专业无成本
    assert.equal(switchCostOf(rt, 'ml', PARAMS), 0.5); // 0.1 × 5
    assert.equal(dominantOf(makeRecord()), null); // 无资本 → 无主专业
    assert.equal(switchCostOf(makeRecord(), 'js', PARAMS), 0);
  });

  it('exploreBonus：随尝试数单调衰减，零样本零拉取时为 0', () => {
    assert.equal(exploreBonus(0, 0, 1), 0); // log(1) = 0
    const lessTried = exploreBonus(0, 3, 1);
    const moreTried = exploreBonus(5, 3, 1);
    assert.ok(lessTried > moreTried);
    assert.ok(moreTried > 0);
    // 手算：c=1, n=0, T=3 → sqrt(ln 4)
    assert.ok(Math.abs(lessTried - Math.sqrt(Math.log(4))) < 1e-12);
  });

  it('socialValueOf：V·q̂ + 探索奖励 − 切换成本 的组合手算', () => {
    const rt = makeRecord({
      attempts: { ml: 2 },
      successes: { ml: 2 },
      capital: { js: 5 }, // 主专业 js，任务在 ml → 有切换成本
    });
    const q = estimateQuality(rt, 'ml', PARAMS); // (2+0.5×2)/(2+2) = 0.75
    const bonus = exploreBonus(2, 4, 1);
    const expected = 10 * q + bonus - 0.5;
    assert.ok(Math.abs(socialValueOf(rt, 'ml', 4, PARAMS) - expected) < 1e-12);
  });

  it('effectiveQuality：学习曲线单调、饱和于1、零资本回基线', () => {
    assert.equal(effectiveQuality(0.5, 0, 0.9, 0.3), 0.5);
    const q1 = effectiveQuality(0.5, 3, 0.9, 0.3);
    const q2 = effectiveQuality(0.5, 10, 0.9, 0.3);
    assert.ok(q1 > 0.5 && q2 > q1);
    assert.ok(q2 < 1); // base + 0.9×0.5 = 0.95 < 1 渐近线
    assert.equal(effectiveQuality(0.5, 1000, 0.9, 0.3), 0.95);
    assert.equal(effectiveQuality(0.9, 1000, 2, 0.3), 1); // 饱和封顶
  });

  it('updateReputation：EWMA 手算（成功/失败两分支）', () => {
    assert.ok(Math.abs(updateReputation(0.5, true, 0.3) - 0.65) < 1e-12);
    assert.ok(Math.abs(updateReputation(0.5, false, 0.3) - 0.35) < 1e-12);
  });

  it('recordSettlement：attempts/capital 恒增，successes 仅成功增', () => {
    const rt = makeRecord();
    recordSettlement(rt, 'js', true);
    recordSettlement(rt, 'js', false);
    assert.equal(rt.attempts.get('js'), 2);
    assert.equal(rt.successes.get('js'), 1);
    assert.equal(rt.capital.get('js'), 2);
  });

  it('SettlementHistory：窗口成功率 + 容量淘汰', () => {
    const h = new SettlementHistory(3);
    h.push(true);
    h.push(false);
    h.push(true);
    assert.equal(h.size, 3);
    assert.equal(h.successRate(0, 3), 2 / 3);
    assert.equal(h.successRate(1, 3), 0.5);
    h.push(false); // 淘汰最旧的 true
    assert.equal(h.size, 3);
    assert.equal(h.successRate(0, 3), 1 / 3);
    assert.equal(h.successRate(5, 9), 0); // 空窗口约定为 0
  });
});
