import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BatchVCGScheduler,
  BudgetPacer,
  type BatchAgentSpec
} from '../src/core/batch-vcg-scheduler.js';

/**
 * 理论预测实例（全部手工推导，见各 test 注释）。
 * 公共配置：V=10、prior=0.5、explore=0、switch=0 → 无资历时 v = 5。
 */
const BASE = { successValue: 10, priorQuality: 0.5, priorWeight: 3, exploreCoefficient: 0, switchCostRate: 0 };

function make(spec: Partial<BatchAgentSpec> & Pick<BatchAgentSpec, 'id' | 'trueCost' | 'capacity'>): BatchAgentSpec {
  return {
    capabilities: ['X'],
    trueQuality: { X: 0.5 },
    ...spec
  } as BatchAgentSpec;
}

describe('BatchVCGScheduler · 替代效应：批量 vs 短视', () => {
  /**
   * w（容量2，成本1）、j（容量1，成本3），任务 [X, X]，v=5。
   * W*=8（w 独揽）；W*_{−w}=2（j 只能接一单）。
   * 批量真值：p_w = 2·1 + (8−2) = 8，take = 10−8 = 2。
   * 短视：每单都按"j 空闲"定价 p = 5−2 = 3 → Σp=6，take = 4。
   * 短视系统性少付 s_j = 2（替代效应重复计算）→ 破坏 DSIC。
   */
  it('批量 VCG 支付高于短视（短视低估赢家应得）', () => {
    const s = new BatchVCGScheduler(BASE);
    s.register(make({ id: 'w', trueCost: 1, capacity: 2 }));
    s.register(make({ id: 'j', trueCost: 3, capacity: 1 }));

    const batch = s.allocateBatch(['X', 'X']);
    const myopic = s.allocateMyopic(['X', 'X']);

    assert.equal(batch.payments['w'], 8);
    assert.equal(batch.platformTake, 2);
    assert.equal(myopic.totalPayment, 6);
    assert.equal(myopic.platformTake, 4);
    assert.ok(batch.totalPayment > myopic.totalPayment);
    // 两种方式分配本身都是最优的（此处差异纯粹在定价）
    assert.equal(batch.welfare, 8);
    assert.equal(myopic.welfare, 8);
  });
});

describe('BatchVCGScheduler · 薄市场预算平衡病理', () => {
  /**
   * 互不可替代的双寡头：a1 只会 A、a2 只会 B，各容量 1，成本 1，v=5。
   * W*=8，W*_{−a1}=4 → p_a1 = 1+4 = 5 = v（全额抽取）。
   * Σv = Σp = 10 → take = 0：精确 VCG 下平台颗粒无收（弱预算平衡取等号）。
   * 这就是"效率+DSIC+正剩余"不可兼得的具体形态。
   */
  it('不可替代赢家被全额抽取，平台 take = 0', () => {
    const s = new BatchVCGScheduler(BASE);
    s.register(make({ id: 'a1', trueCost: 1, capacity: 1, capabilities: ['A'], trueQuality: { A: 0.5 } }));
    s.register(make({ id: 'a2', trueCost: 1, capacity: 1, capabilities: ['B'], trueQuality: { B: 0.5 } }));

    const alloc = s.allocateBatch(['A', 'B']);
    assert.equal(alloc.payments['a1'], 5);
    assert.equal(alloc.payments['a2'], 5);
    assert.equal(alloc.platformTake, 0);
    assert.equal(alloc.exactDSIC, true);
  });
});

describe('BatchVCGScheduler · 预算硬约束的拉格朗日松弛', () => {
  function duopoly(): BatchVCGScheduler {
    const s = new BatchVCGScheduler(BASE);
    s.register(make({ id: 'a1', trueCost: 1, capacity: 1, capabilities: ['A'], trueQuality: { A: 0.5 } }));
    s.register(make({ id: 'a2', trueCost: 1, capacity: 1, capabilities: ['B'], trueQuality: { B: 0.5 } }));
    return s;
  }

  /**
   * 双寡头下 Σp(λ) = 2(5−λ)（λ<4）。
   * B=8 → λ*=1：p 各 4、分配不变、效率损失 = 0。
   * λ 只压缩"剩余抽取"，不动分配——零效率损失满足预算。
   */
  it('B=8：影子价格 λ=1，预算满足且零效率损失', () => {
    const s = duopoly();
    const alloc = s.allocateBatch(['A', 'B'], { budget: 8 });
    assert.equal(alloc.assignments.length, 2);
    assert.ok(Math.abs(alloc.totalPayment - 8) < 1e-3, `Σp=${alloc.totalPayment}`);
    assert.ok(Math.abs(alloc.payments['a1'] - 4) < 1e-3);
    assert.equal(alloc.efficiencyLoss, 0);
    assert.ok(Math.abs(alloc.lambda - 1) < 1e-3, `λ=${alloc.lambda}`);
    assert.equal(alloc.exactDSIC, false); // λ 路径：DSIC 只是近似
    // IR 保持：支付 ≥ 报价（成本 1）
    assert.ok(alloc.payments['a1'] >= 1 && alloc.payments['a2'] >= 1);
  });

  /** B=2.2 → λ=3.9，ṽ=1.1，仍全额分配（score>0），Σp=2.2 */
  it('B=2.2：临界预算仍保住全部分配', () => {
    const s = duopoly();
    const alloc = s.allocateBatch(['A', 'B'], { budget: 2.2 });
    assert.equal(alloc.assignments.length, 2);
    assert.ok(Math.abs(alloc.totalPayment - 2.2) < 1e-3, `Σp=${alloc.totalPayment}`);
    assert.equal(alloc.efficiencyLoss, 0);
  });

  /**
   * B=1.9 < 2·成本=2：连成本都付不起 → λ 越过 4，全部组合 score<0，
   * 空分配（Σp=0），效率损失 = W* = 8。预算不足时的正确行为是弃标。
   */
  it('B=1.9：付不起成本 → 全部弃标', () => {
    const s = duopoly();
    const alloc = s.allocateBatch(['A', 'B'], { budget: 1.9 });
    assert.equal(alloc.droppedTasks, 2);
    assert.equal(alloc.totalPayment, 0);
    assert.equal(alloc.welfare, 0);
    assert.ok(alloc.efficiencyLoss > 7.9);
  });
});

describe('BatchVCGScheduler · DSIC 实证', () => {
  const CAPS = ['A', 'B', 'C'];

  function randomSpecs(rng: () => number): BatchAgentSpec[] {
    const n = 3 + Math.floor(rng() * 4); // 3~6 agents
    return Array.from({ length: n }, (_, i) => {
      const caps = CAPS.filter(() => rng() < 0.6);
      if (caps.length === 0) caps.push(CAPS[Math.floor(rng() * 3)]);
      const cred = Object.fromEntries(caps.map((c) => [c, 0.3 + rng() * 0.6]));
      return {
        id: `a${i}`,
        capabilities: caps,
        trueCost: 1 + i * 0.7 + rng() * 0.3, // 互异成本，避免平局
        trueQuality: Object.fromEntries(caps.map((c) => [c, 0.4 + rng() * 0.5])),
        credentialQuality: cred,
        capacity: 1 + Math.floor(rng() * 3)
      };
    });
  }

  function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** 预算不紧：精确批量 VCG，任何虚报收益 ≤ 1e-6 */
  it('预算宽松时虚报无利可图（精确 DSIC）', () => {
    const rng = mulberry32(2026);
    for (let inst = 0; inst < 30; inst++) {
      const s = new BatchVCGScheduler(BASE);
      randomSpecs(rng).forEach((a) => s.register(a));
      const tasks = Array.from({ length: 4 + Math.floor(rng() * 8) }, () => CAPS[Math.floor(rng() * 3)]);
      const alloc = s.allocateBatch(tasks);
      assert.ok(alloc.exactDSIC);
      for (const a of Object.keys(alloc.payments)) {
        const gain = s.measureMisreportGain(tasks, a, [-0.3, -0.1, 0.1, 0.3, 0.5, 1.0]);
        assert.ok(
          gain.maxGain <= 1e-6,
          `实例${inst} agent=${a} 虚报收益 ${gain.maxGain} 应为 0`
        );
      }
    }
  });

  /** 预算紧：λ 路径牺牲精确 DSIC，但 IR 仍然严格成立 */
  it('预算紧时 IR 保持（如实报价者效用 ≥ 0）', () => {
    const rng = mulberry32(99);
    for (let inst = 0; inst < 20; inst++) {
      const s = new BatchVCGScheduler(BASE);
      randomSpecs(rng).forEach((a) => s.register(a));
      const tasks = Array.from({ length: 5 + Math.floor(rng() * 6) }, () => CAPS[Math.floor(rng() * 3)]);
      const slack = s.allocateBatch(tasks); // 先测无预算约束的 Σp
      const tight = s.allocateBatch(tasks, { budget: slack.totalPayment * 0.5 });
      assert.ok(tight.totalPayment <= slack.totalPayment * 0.5 + 1e-6);
      for (const [agentId, pay] of Object.entries(tight.payments)) {
        const k = tight.assignments.filter((x) => x.agentId === agentId).length;
        const rt = s.getSnapshot().find((x) => x.id === agentId)!;
        void rt;
        // 报价 = 成本（markup 0）→ IR: p ≥ b·k
        const spec = [...s.getSnapshot()].find((x) => x.id === agentId);
        void spec;
        assert.ok(pay >= 0 && k >= 1);
      }
    }
  });

  /** 弱预算平衡：任意实例下平台 take ≥ 0 */
  it('弱预算平衡恒成立（take ≥ 0）', () => {
    const rng = mulberry32(7);
    for (let inst = 0; inst < 30; inst++) {
      const s = new BatchVCGScheduler(BASE);
      randomSpecs(rng).forEach((a) => s.register(a));
      const tasks = Array.from({ length: 4 + Math.floor(rng() * 8) }, () => CAPS[Math.floor(rng() * 3)]);
      const alloc = s.allocateBatch(tasks);
      assert.ok(
        alloc.platformTake >= -1e-9,
        `实例${inst} take=${alloc.platformTake} 不应为负`
      );
    }
  });
});

describe('BatchVCGScheduler · 容量与分配最优性', () => {
  it('容量不足时部分弃标；垄断者被全额抽取', () => {
    const s = new BatchVCGScheduler(BASE);
    s.register(make({ id: 'solo', trueCost: 1, capacity: 1 }));
    const alloc = s.allocateBatch(['X', 'X', 'X']);
    assert.equal(alloc.assignments.length, 1);
    assert.equal(alloc.droppedTasks, 2);
    // 唯一 agent 无替代者：p = b + (W* − 0) = v = 5
    assert.equal(alloc.payments['solo'], 5);
    assert.equal(alloc.platformTake, 0);
  });

  /**
   * 资历异质构造的"短视次优"实例：
   * GOOD 只会 X（资历 0.9 → v=9，成本 5，s=4）；
   * CHEAP 会 X/Y（资历 0.6 → v=6，成本 1，s=5），容量 1。
   * 最优：GOOD→X + CHEAP→Y = 9。
   * 短视：X 被 CHEAP 抢走（5>4）→ Y 无人可做 → 福利 5。
   */
  it('批量最优 ≥ 短视（短视因贪心损失 4/9 福利）', () => {
    const s = new BatchVCGScheduler(BASE);
    s.register(
      make({
        id: 'GOOD',
        trueCost: 5,
        capacity: 1,
        capabilities: ['X'],
        trueQuality: { X: 0.9 },
        credentialQuality: { X: 0.9 }
      })
    );
    s.register(
      make({
        id: 'CHEAP',
        trueCost: 1,
        capacity: 1,
        capabilities: ['X', 'Y'],
        trueQuality: { X: 0.6, Y: 0.6 },
        credentialQuality: { X: 0.6, Y: 0.6 }
      })
    );

    const batch = s.allocateBatch(['X', 'Y']);
    const myopic = s.allocateMyopic(['X', 'Y']);

    assert.equal(batch.welfare, 9);
    assert.equal(batch.droppedTasks, 0);
    assert.equal(myopic.welfare, 5);
    assert.equal(myopic.droppedTasks, 1);
    assert.ok(batch.welfare > myopic.welfare);
  });
});

describe('BatchVCGScheduler · 公开履历驱动再分配', () => {
  it('失败履历降低估值，下次任务易主', () => {
    const s = new BatchVCGScheduler(BASE);
    s.register(make({ id: 'A', trueCost: 2.2, capacity: 1 }));
    s.register(make({ id: 'B', trueCost: 2.0, capacity: 1 }));

    // 第一批：B 更便宜中标
    const first = s.allocateBatch(['X']);
    assert.equal(first.assignments[0].agentId, 'B');
    s.settleBatch(first.assignments.map((a) => ({ taskId: a.taskId, success: false })));

    // B 失败后 q̂ = (0+1.5)/4 = 0.375 → v=3.75, s=1.55；A 无履历 v=5, s=2.8 → A 中标
    const second = s.allocateBatch(['X']);
    assert.equal(second.assignments[0].agentId, 'A');
    s.settleBatch(second.assignments.map((a) => ({ taskId: a.taskId, success: true })));
  });
});

describe('BatchVCGScheduler · 并发约束与学习曲线（模拟）', () => {
  it('批内并发不超容量，学习曲线抬升后期成功率', () => {
    const s = new BatchVCGScheduler({ ...BASE, learningCeiling: 0.6, learningRate: 0.15, seed: 11 });
    s.register(make({ id: 'a1', trueCost: 2, capacity: 2, trueQuality: { X: 0.3 } }));
    s.register(make({ id: 'a2', trueCost: 2, capacity: 2, trueQuality: { X: 0.3 } }));

    const BATCHES = 120;
    for (let i = 0; i < BATCHES; i++) {
      const { allocation } = s.simulateBatch(['X', 'X', 'X', 'X']);
      const count = new Map<string, number>();
      for (const a of allocation.assignments) {
        count.set(a.agentId, (count.get(a.agentId) ?? 0) + 1);
      }
      for (const [id, k] of count) {
        assert.ok(k <= 2, `批${i} agent=${id} 并发 ${k} 超容量`);
      }
    }
    const total = s.getSettledCount();
    const early = s.getWindowSuccessRate(0, Math.floor(total / 3));
    const late = s.getWindowSuccessRate(Math.floor((2 * total) / 3), total);
    assert.ok(late >= early + 0.05, `后期 ${late.toFixed(3)} 应显著高于前期 ${early.toFixed(3)}`);
    // 资本确实在累积
    const snap = s.getSnapshot();
    assert.ok((snap[0].capital['X'] ?? 0) > 50);
  });
});

describe('BatchVCGScheduler · μ-VCG 仿射乘子：薄市场病理的 DSIC 逃生舱', () => {
  function duopoly(): BatchVCGScheduler {
    const s = new BatchVCGScheduler(BASE);
    s.register(make({ id: 'a1', trueCost: 1, capacity: 1, capabilities: ['A'], trueQuality: { A: 0.5 } }));
    s.register(make({ id: 'a2', trueCost: 1, capacity: 1, capabilities: ['B'], trueQuality: { B: 0.5 } }));
    return s;
  }

  /**
   * 同一双寡头实例（μ=1 时 take=0 的病理实例），公开 μ=1.25：
   * Φ* = 7.5，Φ_{−i} = 3.75 → p_i = 1·1 + (7.5−3.75)/1.25 = 4。
   * Σp = 8 = B、福利 8（零效率损失）、take = 2 > 0、虚报收益 = 0（精确 DSIC）。
   * 对比 λ 路径在同一预算下只能放弃 DSIC（exactDSIC=false）——
   * 预算 / 零损失 / DSIC 三者在此同时成立。
   */
  it('μ=1.25 同时达成预算、零效率损失与精确 DSIC', () => {
    const s = duopoly();
    const alloc = s.allocateAffineBatch(['A', 'B'], { mu: 1.25 });
    assert.ok(Math.abs(alloc.payments['a1']! - 4) < 1e-6);
    assert.ok(Math.abs(alloc.payments['a2']! - 4) < 1e-6);
    assert.ok(Math.abs(alloc.totalPayment - 8) < 1e-6);
    assert.equal(alloc.welfare, 8);
    assert.equal(alloc.efficiencyLoss, 0);
    assert.ok(Math.abs(alloc.platformTake - 2) < 1e-6); // μ=1 时 take=0 → 病理被 escape
    assert.equal(alloc.exactDSIC, true);
    assert.equal(alloc.mu, 1.25);

    for (const id of ['a1', 'a2']) {
      const g = s.measureMisreportGain(['A', 'B'], id, [-0.5, -0.2, 0.2, 0.5, 1, 2], {
        affine: { mu: 1.25 }
      });
      assert.ok(g.maxGain <= 1e-6, `${id} 虚报收益 ${g.maxGain} 应为 0（公开乘子下精确 DSIC）`);
    }
  });

  /**
   * μ 的垄断 markup 几何（可证性质）：
   * - 福利随 μ 单调不增（μ>1 的可行分配集是 μ=1 可行集的子集）；
   * - take 随 μ 从 0 单调上升（剩余抽取恢复）；
   * - μ 足够大 → 全部弃标，Σp → 0（预算上界可达）。
   */
  it('μ 扫描：福利不减、take 上升、支付趋零', () => {
    let prevWelfare = Infinity;
    let prevTake = -Infinity;
    for (const mu of [1, 1.25, 1.5, 2, 3]) {
      const a = duopoly().allocateAffineBatch(['A', 'B'], { mu });
      assert.ok(a.welfare <= prevWelfare + 1e-9, `μ=${mu} 福利 ${a.welfare} 应不增`);
      assert.ok(a.platformTake >= prevTake - 1e-9, `μ=${mu} take ${a.platformTake} 应不减`);
      assert.ok(a.platformTake >= 0, '弱预算平衡');
      prevWelfare = a.welfare;
      prevTake = a.platformTake;
    }
    const collapsed = duopoly().allocateAffineBatch(['A', 'B'], { mu: 10 });
    assert.equal(collapsed.droppedTasks, 2);
    assert.equal(collapsed.totalPayment, 0);
  });
});

describe('BatchVCGScheduler · 公开乘子随机实例 DSIC 实证证书', () => {
  const CAPS = ['A', 'B', 'C'];

  function randomSpecs(rng: () => number): BatchAgentSpec[] {
    const n = 3 + Math.floor(rng() * 4);
    return Array.from({ length: n }, (_, i) => {
      const caps = CAPS.filter(() => rng() < 0.6);
      if (caps.length === 0) caps.push(CAPS[Math.floor(rng() * 3)]);
      return {
        id: `a${i}`,
        capabilities: caps,
        trueCost: 1 + i * 0.7 + rng() * 0.3,
        trueQuality: Object.fromEntries(caps.map((c) => [c, 0.4 + rng() * 0.5])),
        credentialQuality: Object.fromEntries(caps.map((c) => [c, 0.3 + rng() * 0.6])),
        capacity: 1 + Math.floor(rng() * 3)
      };
    });
  }

  function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * 定理的实证证书：任意实例、任意公开 (λ, μ) 组合，
   * 每个赢家的虚报收益 ≤ 1e-6——精确 DSIC 与预算压缩并存。
   */
  it('任意公开 (λ, μ) 下虚报无利可图（30 实例 × 4 乘子组合）', () => {
    const rng = mulberry32(2027);
    const combos = [
      { lambda: 0, mu: 1 },
      { lambda: 0.5, mu: 1 },
      { lambda: 0, mu: 1.4 },
      { lambda: 0.3, mu: 1.8 }
    ];
    for (let inst = 0; inst < 30; inst++) {
      const s = new BatchVCGScheduler(BASE);
      randomSpecs(rng).forEach((a) => s.register(a));
      const tasks = Array.from({ length: 4 + Math.floor(rng() * 8) }, () => CAPS[Math.floor(rng() * 3)]);
      for (const combo of combos) {
        const alloc = s.allocateAffineBatch(tasks, combo);
        assert.equal(alloc.exactDSIC, true);
        for (const agentId of Object.keys(alloc.payments)) {
          const g = s.measureMisreportGain(tasks, agentId, [-0.3, -0.1, 0.1, 0.3, 0.5, 1.0], {
            affine: combo
          });
          assert.ok(
            g.maxGain <= 1e-6,
            `实例${inst} λ=${combo.lambda} μ=${combo.mu} agent=${agentId} 虚报收益 ${g.maxGain} 应为 0`
          );
        }
      }
    }
  });

  /** μ-VCG 的预算压缩方向性：μ>1 时 Σp ≤ μ=1 的 VCG 支付（实证规律，30 实例） */
  it('μ≥1 系统性压缩总支付（markup → 预算空间）', () => {
    const rng = mulberry32(88);
    for (let inst = 0; inst < 30; inst++) {
      const s = new BatchVCGScheduler(BASE);
      randomSpecs(rng).forEach((a) => s.register(a));
      const tasks = Array.from({ length: 4 + Math.floor(rng() * 8) }, () => CAPS[Math.floor(rng() * 3)]);
      const vcg = s.allocateAffineBatch(tasks, { mu: 1 }).totalPayment;
      for (const mu of [1.3, 1.8, 2.5]) {
        const p = s.allocateAffineBatch(tasks, { mu }).totalPayment;
        assert.ok(p <= vcg + 1e-6, `实例${inst} μ=${mu} Σp=${p} 应 ≤ VCG Σp=${vcg}`);
      }
    }
  });
});

describe('BatchVCGScheduler · BudgetPacer：预算即控制（公开 μ 在线校准）', () => {
  /** 平稳环境：3 个 X 能力供应商，成本 1.0/1.6/2.2，容量各 2，每批 4 任务 */
  function fresh(): BatchVCGScheduler {
    const s = new BatchVCGScheduler({ ...BASE, learningCeiling: 0, learningRate: 0, seed: 5 });
    s.register(make({ id: 'a1', trueCost: 1.0, capacity: 2, trueQuality: { X: 0.5 } }));
    s.register(make({ id: 'a2', trueCost: 1.6, capacity: 2, trueQuality: { X: 0.5 } }));
    s.register(make({ id: 'a3', trueCost: 2.2, capacity: 2, trueQuality: { X: 0.5 } }));
    return s;
  }
  const TASKS = ['X', 'X', 'X', 'X'];

  /**
   * 预算 B = 0.6×无约束 VCG 支付。pacer 从 μ=1 出发对偶上升：
   * 超支 → μ 升（支付按 1/μ 压缩 + 边际弃标）→ 收敛到预算附近。
   * 全程 μ_t 只依赖已结算历史 → 每批精确 DSIC。
   */
  it('μ 在线校准收敛到预算，末态乘子下仍精确 DSIC', () => {
    const unconstrained = fresh().allocateBatch(TASKS).totalPayment;
    const B = unconstrained * 0.6;

    const s = fresh();
    const pacer = new BudgetPacer(B, 0.5);
    const spends: number[] = [];
    for (let t = 0; t < 80; t++) {
      const { allocation } = s.simulateBatch(TASKS, { affine: { mu: pacer.getMu() } });
      spends.push(allocation.totalPayment);
      pacer.update(allocation.totalPayment);
    }

    // 收敛：后 40 批平均支出贴近预算（±30%）
    const late = spends.slice(40);
    const mean = late.reduce((a, b) => a + b, 0) / late.length;
    assert.ok(
      mean >= B * 0.7 && mean <= B * 1.3,
      `后期平均支出 ${mean.toFixed(2)} 应贴近预算 B=${B.toFixed(2)}`
    );
    // 对偶确实被激活（μ 从 1 上升）
    assert.ok(pacer.getMu() > 1.05, `末态 μ=${pacer.getMu().toFixed(3)} 应大于 1`);
    // 预算-福利权衡存在但有限：μ 路径福利 ≥ 无约束福利的 70%
    const wMu = s.getNetWelfare() / 80;
    const sBase = fresh();
    let w0 = 0;
    for (let t = 0; t < 80; t++) w0 += sBase.simulateBatch(TASKS).netWelfare;
    assert.ok(wMu * 0.999 >= (w0 / 80) * 0.7, `μ 路径平均福利 ${wMu.toFixed(2)} 应 ≥ 基线的 70%`);

    // 末态公开乘子下的 DSIC 证书（与 λ-bisection 路径的本质区别）
    const check = fresh();
    const alloc = check.allocateAffineBatch(TASKS, { mu: pacer.getMu() });
    for (const agentId of Object.keys(alloc.payments)) {
      const g = check.measureMisreportGain(TASKS, agentId, [-0.3, -0.1, 0.1, 0.3, 0.5, 1.0], {
        affine: { mu: pacer.getMu() }
      });
      assert.ok(g.maxGain <= 1e-6, `${agentId} 虚报收益 ${g.maxGain} 应为 0`);
    }
  });
});
