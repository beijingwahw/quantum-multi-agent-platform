import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GrowthMarketScheduler,
  DEFAULT_GROWTH_CONFIG,
  type GrowthAgentSpec,
} from '../src/core/growth-market-scheduler.js';

const CAPS = ['research', 'coding', 'writing'] as const;

/** 异构 Agent 群：专家贵而精，通才便宜平庸，新人有潜力 */
function benchmarkAgents(): GrowthAgentSpec[] {
  return [
    {
      id: 'researcher',
      capabilities: [...CAPS],
      trueCost: 4,
      trueQuality: { research: 0.9, coding: 0.5, writing: 0.6 },
    },
    {
      id: 'coder',
      capabilities: [...CAPS],
      trueCost: 3.5,
      trueQuality: { research: 0.5, coding: 0.85, writing: 0.5 },
    },
    {
      id: 'writer',
      capabilities: [...CAPS],
      trueCost: 3,
      trueQuality: { research: 0.35, coding: 0.4, writing: 0.88 },
    },
    {
      id: 'generalist',
      capabilities: [...CAPS],
      trueCost: 1.2,
      trueQuality: { research: 0.45, coding: 0.45, writing: 0.45 },
    },
    {
      id: 'novice',
      capabilities: [...CAPS],
      trueCost: 2,
      trueQuality: { research: 0.6, coding: 0.6, writing: 0.35 },
    },
  ];
}

function runRounds(
  scheduler: GrowthMarketScheduler,
  rounds: number,
  policy: 'market' | 'greedy' | 'round-robin',
): void {
  for (let i = 0; i < rounds; i++) {
    scheduler.simulateTask(CAPS[i % CAPS.length]!, policy);
  }
}

describe('GrowthMarketScheduler 激励相容', () => {
  it('如实报价的 Agent 利润严格高于策略性加价者', () => {
    const s = new GrowthMarketScheduler({ seed: 42 });
    s.register({
      id: 'truthful',
      capabilities: ['research'],
      trueCost: 2,
      trueQuality: { research: 0.7 },
      bidMarkup: 0,
    });
    s.register({
      id: 'strategic',
      capabilities: ['research'],
      trueCost: 3,
      trueQuality: { research: 0.7 },
      bidMarkup: 0.6,
    });
    for (let i = 0; i < 300; i++) {
      s.simulateTask('research', 'market');
    }
    const snap = new Map(s.getSnapshot().map((a) => [a.id, a]));
    const truthful = snap.get('truthful')!;
    const strategic = snap.get('strategic')!;
    assert.ok(truthful.profit > 0, `如实报价应盈利，实际 ${truthful.profit}`);
    assert.ok(
      truthful.profit > strategic.profit,
      `如实报价利润 ${truthful.profit} 应高于加价者 ${strategic.profit}`,
    );
    assert.ok(truthful.wins > strategic.wins);
  });
});

describe('GrowthMarketScheduler 专业化涌现', () => {
  it('市场机制让专家在优势能力上形成专业化分工', () => {
    const s = new GrowthMarketScheduler({ seed: 7 });
    benchmarkAgents().forEach((a) => s.register(a));
    runRounds(s, 900, 'market');

    const snap = new Map(s.getSnapshot().map((a) => [a.id, a]));
    // 市场内生涌现稳定分工：写手守住写作，新人成长为研究员，
    // 廉价通才被"培训"成 coder——学习曲线陡峭时，训练可造之才
    // 比雇佣天生专家更有效率（福利 6.6/任务 vs 5.0/任务）。
    assert.equal(snap.get('writer')!.dominant, 'writing');
    assert.ok(
      snap.get('writer')!.dominantShare > 0.5,
      `writer 专业化程度 ${snap.get('writer')!.dominantShare}`,
    );
    assert.equal(snap.get('novice')!.dominant, 'research');
    assert.ok(snap.get('novice')!.dominantShare > 0.5);
    assert.equal(snap.get('generalist')!.dominant, 'coding');
    assert.ok(snap.get('generalist')!.dominantShare > 0.5);

    // 学习曲线：后期成功率应高于前期（系统整体变聪明）
    const early = s.getWindowSuccessRate(0, 150);
    const late = s.getWindowSuccessRate(750, 900);
    assert.ok(
      late >= early + 0.02,
      `后期成功率 ${late.toFixed(3)} 应比前期 ${early.toFixed(3)} 高至少 2 个百分点`,
    );
  });
});

describe('GrowthMarketScheduler 福利对比', () => {
  const ROUNDS = 900;

  it('市场机制净福利高于最低价贪心与轮询基线', () => {
    const results = {} as Record<string, { welfare: number; late: number }>;
    for (const policy of ['market', 'greedy', 'round-robin'] as const) {
      const s = new GrowthMarketScheduler({ seed: 42 });
      benchmarkAgents().forEach((a) => s.register(a));
      runRounds(s, ROUNDS, policy);
      results[policy] = {
        welfare: s.getNetWelfare(),
        late: s.getWindowSuccessRate(750, 900),
      };
    }
    assert.ok(
      results.market!.welfare > results.greedy!.welfare,
      `市场 ${results.market!.welfare} 应高于贪心 ${results.greedy!.welfare}`,
    );
    assert.ok(
      results.market!.welfare > results['round-robin']!.welfare,
      `市场 ${results.market!.welfare} 应高于轮询 ${results['round-robin']!.welfare}`,
    );
    assert.ok(results.market!.late >= results.greedy!.late);
  });
});

describe('GrowthMarketScheduler 机制不变量', () => {
  it('无合格 Agent 时返回 null', () => {
    const s = new GrowthMarketScheduler({ seed: 1 });
    s.register({
      id: 'a',
      capabilities: ['research'],
      trueCost: 2,
      trueQuality: { research: 0.7 },
    });
    assert.equal(s.submitTask('coding'), null);
  });

  it('支付落在 [0, socialValue] 区间内', () => {
    const s = new GrowthMarketScheduler({ seed: 3 });
    benchmarkAgents().forEach((a) => s.register(a));
    for (let i = 0; i < 100; i++) {
      const t = s.submitTask(CAPS[i % CAPS.length]!, 'market')!;
      assert.ok(t.payment >= 0 && t.payment <= t.socialValue);
      s.completeTask(t.taskId, true);
    }
  });

  it('重复结算同一任务抛出异常', () => {
    const s = new GrowthMarketScheduler({ seed: 5 });
    s.register({
      id: 'a',
      capabilities: ['research'],
      trueCost: 2,
      trueQuality: { research: 0.7 },
    });
    const t = s.submitTask('research')!;
    s.completeTask(t.taskId, true);
    assert.throws(() => s.completeTask(t.taskId, true));
  });

  it('默认配置与文档一致', () => {
    assert.equal(DEFAULT_GROWTH_CONFIG.successValue, 10);
    assert.ok(DEFAULT_GROWTH_CONFIG.exploreCoefficient > 0);
  });
});
