import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CompoundBrain,
  DEFAULT_COMPOUND_CONFIG,
  lawKMin,
  lawDeltaMax,
  type CompoundAgentSpec,
  type CompoundTaskSpec,
} from '../src/core/compound-brain.js';
// 08#11：实验面（simulateBatch/misreport）自 CompoundBrain 迁出
import { CompoundBrainSimulator } from '../src/core/compound-brain-simulator.js';
// 05#22：本地 mulberry32 副本与 src/utils/rng.ts 的 Mulberry32.next
// 逐位同算法（同操作序列、同种子推进），收敛到平台唯一实现——种子流不变
import { mulberry32 } from '../src/utils/rng.js';

function agent(
  id: string,
  capabilities: string[],
  trueCost: number,
  trueQuality: Record<string, number>,
): CompoundAgentSpec {
  return { id, capabilities, trueCost, trueQuality, capacity: 1 };
}

/**
 * 05#8：稳定序列化——对象键排序后递归序列化，数组保序。
 * 语义等价性比较不得依赖 JSON.stringify 的 V8 键插入序（payments 等
 * Record 的键序取决于运行时构造路径，等价内容可能排出不同字符串）。
 */
function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const body = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableSerialize(v)}`)
      .join(',');
    return `{${body}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

// ============================================================================
// 相变定律（闭式）
// ============================================================================

describe('CompoundBrain · 相变定律闭式', () => {
  it('L3：K_min 无凭证劣势时为 0，劣势越大所需资本越多', () => {
    assert.equal(lawKMin(0.5, 0, 0.9, 0.2, 60), 0);
    const k1 = lawKMin(0.5, 0.05, 0.9, 0.2, 60);
    const k2 = lawKMin(0.5, 0.15, 0.9, 0.2, 60);
    assert.ok(k1 !== null && k2 !== null && k2 > k1, `K_min 应随 δ 递增：${k1} → ${k2}`);
  });

  it('L3：不可学习（α=0）或资本化不可行时返回 null', () => {
    assert.equal(lawKMin(0.5, 0.3, 0, 0.1, 60), null);
    // 需求超过可学习余量 (1−q0)：永远追不上
    assert.equal(lawKMin(0.5, 0.9, 0.2, 0.1, 60), null);
  });

  it('L4：δ_max 随资本 K 与 α 单调递增', () => {
    const d0 = lawDeltaMax(0.5, 0, 0.6, 0.1, 60);
    const d1 = lawDeltaMax(0.5, 20, 0.6, 0.1, 60);
    assert.ok(d1 > d0, '资本越多可承受劣势越大');
    const dLow = lawDeltaMax(0.5, 20, 0.3, 0.1, 60);
    assert.ok(d1 > dLow, '可学习性越高可承受劣势越大');
  });
});

// ============================================================================
// DSIC + IR：随机实例虚报不获益
// ============================================================================

describe('CompoundBrain · DSIC 与个体理性', () => {
  /**
   * 单批 DSIC 检验：同一随机实例（同 seed → 同公开状态、同任务集），
   * a0 如实报价 vs 加价。单批内公开状态与报价无关（q̂、g 只依赖历史
   * 结算与凭证），两臂严格对齐——这正是 DSIC 定理的前提。
   * 跨批动态 DSIC 不在定理边界内（虚报可改变自身未来历史：少接任务
   * 以维持高估值/探索红利），见 compound-brain.ts 头部的诚实边界声明。
   */
  function batchUtility(seed: number, markup: number): number {
    const rng = mulberry32(seed);
    const brain = new CompoundBrain({ seed: seed + 7 });
    const CAPS = ['A', 'B', 'C'];
    const specs = Array.from({ length: 5 }, (_, i) => {
      const caps = CAPS.filter(() => rng() < 0.6);
      if (caps.length === 0) caps.push(CAPS[Math.floor(rng() * 3)]!);
      return agent(
        `a${i}`,
        caps,
        0.5 + rng() * 2,
        Object.fromEntries(caps.map((c) => [c, 0.3 + rng() * 0.6])),
      );
    });
    // DSIC 检验只扰动 a0 的报价，其余人固定如实报价——
    // W*_{−a0} 是 a0 效用中的常数项，唯一自变量是 a0 自己的报价
    for (const s of specs) brain.registerAgent(s, s.id === 'a0' ? s.trueCost + markup : s.trueCost);
    const tasks: CompoundTaskSpec[] = Array.from({ length: 5 }, () => ({
      capability: CAPS[Math.floor(rng() * 3)]!,
      value: 6 + rng() * 8,
    }));
    const alloc = brain.allocateBatch(tasks);
    const k = alloc.assignments.filter((x) => x.agentId === 'a0').length;
    return (alloc.payments['a0'] ?? 0) - k * specs[0]!.trueCost;
  }

  it('DSIC（单批）：虚报成本不优于如实报价（30 实例 × 5 报价扰动）', () => {
    const rng = mulberry32(2024);
    let violations = 0;
    for (let trial = 0; trial < 30; trial++) {
      const seed = 5000 + trial;
      const honestUtil = batchUtility(seed, 0);
      for (let b = 0; b < 5; b++) {
        const markup = 0.2 + rng() * 1.5; // 加价幅度
        const liedUtil = batchUtility(seed, markup);
        if (liedUtil > honestUtil + 1e-6) violations++;
      }
    }
    assert.equal(violations, 0, `虚报严格优于如实报价的次数应为 0，实际 ${violations}`);
  });

  it('IR：中标者支付 ≥ 其真实报价成本（弱个体理性）', () => {
    for (let trial = 0; trial < 15; trial++) {
      const rng = mulberry32(7000 + trial);
      const brain = new CompoundBrain({ seed: 8000 + trial });
      const CAPS = ['A', 'B'];
      const specs = Array.from({ length: 4 }, (_, i) => {
        const caps = CAPS.filter(() => rng() < 0.7);
        if (caps.length === 0) caps.push(CAPS[i % 2]!);
        return agent(
          `a${i}`,
          caps,
          0.5 + rng() * 2,
          Object.fromEntries(caps.map((c) => [c, 0.4 + rng() * 0.5])),
        );
      });
      for (const s of specs) brain.registerAgent(s);
      const tasks: CompoundTaskSpec[] = Array.from({ length: 5 }, () => ({
        capability: CAPS[Math.floor(rng() * 2)]!,
        value: 8 + rng() * 6,
      }));
      const alloc = brain.allocateBatch(tasks);
      for (const [id, pay] of Object.entries(alloc.payments)) {
        const k = alloc.assignments.filter((x) => x.agentId === id).length;
        const spec = specs.find((s) => s.id === id)!;
        assert.ok(
          pay >= spec.trueCost * k - 1e-6,
          `agent ${id} 支付 ${pay} < 成本 ${spec.trueCost * k}，违反 IR`,
        );
      }
    }
  });
});

// ============================================================================
// 增长路由与视野优势
// ============================================================================

describe('CompoundBrain · 增长投资行为', () => {
  // 可投资配置（市场锁定陷阱的标准形态）：昂贵专家（base 高、学习余量小）
  // vs 廉价新人（base 低、学习余量大）。本配置位于深投资区：δ=0.2、
  // α=0.85、β=0.15——trainee 净价值 k≈5 反超，理论要求孵化投资
  const AGENTS: CompoundAgentSpec[] = [
    { id: 'veteran', capabilities: ['X'], trueCost: 2.0, trueQuality: { X: 0.8 } },
    { id: 'trainee', capabilities: ['X'], trueCost: 0.2, trueQuality: { X: 0.6 } },
  ];

  /** 08#11：实验参数（simAlpha/simBeta/seed 的抽样流）经模拟器注入，
   * 机制 config 只保留机制旋钮 */
  function makeBrain(
    growthDiscount: number,
    simAlpha: number,
    simBeta: number,
    seed = 42,
  ): { brain: CompoundBrain; sim: CompoundBrainSimulator } {
    const brain = new CompoundBrain({ growthDiscount, growthHorizon: 80, seed });
    for (const a of AGENTS) brain.registerAgent(a);
    return { brain, sim: new CompoundBrainSimulator(brain, { simAlpha, simBeta, seed }) };
  }

  it('可学习 regime（深投资区）：compound 比 static（γ=0）累计真实福利更高（孵化投资回收）', () => {
    // 相图放置：本场景位于培训/雇佣相变的深投资区（δ=0.2 凭证差距小、
    // α=0.85 强信号、β=0.15 快饱和——交叉点 k≈5，50 批的 oracle 边际
    // ≈ +60）。机制应稳健回收：8 seed 平均实测 Δ≈+42。
    // （相边界附近的行为由「边际 regime 损失有界」测试单独守卫。）
    const run = (gamma: number): number => {
      const seeds = [11, 22, 33, 44, 55, 66, 77, 88];
      let total = 0;
      for (const seed of seeds) {
        const { sim } = makeBrain(gamma, 0.85, 0.15, seed);
        for (let b = 0; b < 50; b++) {
          const { realizedWelfare } = sim.simulateBatch([{ capability: 'X', value: 10 }]);
          total += realizedWelfare / seeds.length;
        }
      }
      return total;
    };
    const staticWelfare = run(0);
    const compoundWelfare = run(1);
    assert.ok(
      compoundWelfare > staticWelfare + 10,
      `compound 福利 (${compoundWelfare.toFixed(1)}) 应显著高于 static (${staticWelfare.toFixed(1)})`,
    );
  });

  it('边际 regime（相边界附近）：oracle 边际薄（≈+17），compound 损失有界', () => {
    // trainee base 0.5 / α=0.75 / β=0.12：渐近质量 0.875 < veteran 0.95，
    // 投资仅靠成本优势回收、交叉点 k≈9——恰在相变边界附近。机制在此
    // 既不应鲁莽投资（不可学习时同款公开信息），也不应崩溃：
    // 诚实推断下的有界损失是理论预期行为。
    const run = (gamma: number): number => {
      const seeds = [11, 22, 33, 44, 55, 66];
      let total = 0;
      for (const seed of seeds) {
        const brain = new CompoundBrain({
          growthDiscount: gamma,
          growthHorizon: 80,
          seed,
        });
        brain.registerAgent({
          id: 'veteran',
          capabilities: ['X'],
          trueCost: 2.0,
          trueQuality: { X: 0.8 },
        });
        brain.registerAgent({
          id: 'trainee',
          capabilities: ['X'],
          trueCost: 0.2,
          trueQuality: { X: 0.5 },
        });
        const sim = new CompoundBrainSimulator(brain, { simAlpha: 0.75, simBeta: 0.12, seed });
        for (let b = 0; b < 50; b++) {
          const { realizedWelfare } = sim.simulateBatch([{ capability: 'X', value: 10 }]);
          total += realizedWelfare / seeds.length;
        }
      }
      return total;
    };
    const staticWelfare = run(0);
    const compoundWelfare = run(1);
    assert.ok(
      compoundWelfare >= staticWelfare - 20,
      `边际 regime compound (${compoundWelfare.toFixed(1)}) 损失应有界（≥ static−20），static=${staticWelfare.toFixed(1)}`,
    );
  });

  it('不可学习 regime（α=0）：compound 劣化有界（探索信息价格，校准零误报下 dq 不投资）', () => {
    const run = (gamma: number): number => {
      const seeds = [11, 22, 33, 44, 55, 66];
      let total = 0;
      for (const seed of seeds) {
        const { sim } = makeBrain(gamma, 0, 0, seed);
        for (let b = 0; b < 50; b++) {
          const { realizedWelfare } = sim.simulateBatch([{ capability: 'X', value: 10 }]);
          total += realizedWelfare / seeds.length;
        }
      }
      return total;
    };
    const staticWelfare = run(0);
    const compoundWelfare = run(1);
    // 探索项（e/√(1+m)·v̄）是校准的信息引擎，在不可学习 regime 下是纯成本：
    // 有界（1/√ 衰减 + 失败观测压低 baseEstimate 使 gap 上升加速止损）
    assert.ok(
      compoundWelfare >= staticWelfare - 15,
      `不可学习时 compound (${compoundWelfare.toFixed(1)}) 劣化应有界（≥ static−15），static=${staticWelfare.toFixed(1)}`,
    );
  });

  it('公开不可区分的昂贵潜力股：bid-free g 无法区分，损失有界（DSIC 结构性代价）', () => {
    // 与可投资配置公开信息相同（base 0.6/0.8、学习曲线相同），仅 trainee 成本
    // 更贵（3.0）——g 不允许依赖报价（DSIC），机制对此必然与可投资场景行为
    // 相同；底线份额的双重衰减（dq~e^{−β̂k}，floor~1/(1+β̂k)）保证损失有界
    const run = (gamma: number): number => {
      const seeds = [11, 22, 33, 44];
      let total = 0;
      for (const seed of seeds) {
        const brain = new CompoundBrain({
          growthDiscount: gamma,
          growthHorizon: 80,
          seed,
        });
        brain.registerAgent({
          id: 'veteran',
          capabilities: ['X'],
          trueCost: 2.0,
          trueQuality: { X: 0.8 },
        });
        brain.registerAgent({
          id: 'trainee',
          capabilities: ['X'],
          trueCost: 3.0,
          trueQuality: { X: 0.6 },
        });
        const sim = new CompoundBrainSimulator(brain, { simAlpha: 0.85, simBeta: 0.15, seed });
        for (let b = 0; b < 50; b++) {
          const { realizedWelfare } = sim.simulateBatch([{ capability: 'X', value: 10 }]);
          total += realizedWelfare / seeds.length;
        }
      }
      return total;
    };
    const staticWelfare = run(0);
    const compoundWelfare = run(1);
    assert.ok(
      compoundWelfare >= staticWelfare - 20,
      `公开不可区分场景 compound (${compoundWelfare.toFixed(1)}) 损失应有界（≥ static−20），static=${staticWelfare.toFixed(1)}`,
    );
  });

  it('增长路由：可学习 regime 下 trainee 获得孵化投资（8 seed 平均份额 > 0）', () => {
    // 单 seed 下 trainee 前几次结算失败（真实 q=0.5）会击穿 Bayesian 基准
    // 估计并触发份额锁定——这是机制的已知冷启动极限（p≈0.5^3），
    // 统计口径应为多 seed 平均：诚实机制应显著投资于潜力 agent
    let total = 0;
    const perSeed: number[] = [];
    for (let seed = 5; seed <= 12; seed++) {
      const { sim } = makeBrain(1, 0.85, 0.15, seed);
      let traineeTasks = 0;
      for (let b = 0; b < 60; b++) {
        const { settlements } = sim.simulateBatch([{ capability: 'X', value: 10 }]);
        traineeTasks += settlements.filter((s) => s.agentId === 'trainee').length;
      }
      perSeed.push(traineeTasks);
      total += traineeTasks;
    }
    const avg = total / perSeed.length;
    assert.ok(
      avg >= 10,
      `trainee 平均应获得 ≥10 任务孵化投资，实际平均 ${avg.toFixed(1)}（各 seed: ${perSeed.join(',')}）`,
    );
  });

  it('容量与弃标：无人具备能力时任务被弃标而非强分', () => {
    const brain = new CompoundBrain();
    brain.registerAgent(agent('a', ['A'], 1, { A: 0.5 }));
    const alloc = brain.allocateBatch([{ capability: 'Z', value: 100 }]);
    assert.equal(alloc.assignments.length, 0, '无人具备 Z 能力：应弃标');
    assert.equal(alloc.droppedTasks, 1);
    // 估值不抵报价：负边际任务也应弃标
    const alloc2 = brain.allocateBatch([{ capability: 'A', value: 0.1 }]);
    assert.equal(alloc2.assignments.length, 0, 'v·q̂ < b：自由处置应弃标');
  });
});

// ============================================================================
// 在线校准
// ============================================================================

describe('CompoundBrain · 在线校准', () => {
  it('可学习 regime：结算流恢复出 α̂ > 0 且 learnable', () => {
    // 多 seed 平均：中等学习信号（α=0.75, β=0.12）下分箱+门限的检出是概率性的，
    // 但 8 seed 中至少一次检出即证明校准闭环可用
    let detected = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const brain = new CompoundBrain({
        minCalibrationAttempts: 20,
        seed,
      });
      brain.registerAgent(agent('a', ['X'], 0.5, { X: 0.5 }));
      brain.registerAgent(agent('b', ['X'], 0.5, { X: 0.5 }));
      const sim = new CompoundBrainSimulator(brain, { simAlpha: 0.9, simBeta: 0.15, seed });
      for (let b = 0; b < 150; b++) {
        sim.simulateBatch([{ capability: 'X', value: 10 }]);
      }
      const cal = brain.calibrations().find((c) => c.capability === 'X')!;
      if (cal.alphaHat > 0.15 && cal.learnable) detected++;
    }
    assert.ok(detected >= 1, `8 个 seed 中应至少 1 个检出学习信号，实际 ${detected}`);
  });

  it('不可学习 regime：α̂ 保持 0（零误报，宁缺勿假）', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const brain = new CompoundBrain({
        minCalibrationAttempts: 20,
        seed,
      });
      brain.registerAgent(agent('a', ['X'], 0.5, { X: 0.5 }));
      brain.registerAgent(agent('b', ['X'], 0.5, { X: 0.5 }));
      const sim = new CompoundBrainSimulator(brain, { simAlpha: 0, simBeta: 0, seed });
      for (let b = 0; b < 150; b++) {
        sim.simulateBatch([{ capability: 'X', value: 10 }]);
      }
      const cal = brain.calibrations().find((c) => c.capability === 'X')!;
      assert.equal(cal.alphaHat, 0, `seed=${seed}：不可学习 regime 不应误报学习信号`);
      assert.equal(cal.learnable, false);
    }
  });

  it('advise()：校准驱动孵化建议（结构完整，K_min 随 δ 单调不减）', () => {
    const brain = new CompoundBrain({ growthHorizon: 60, seed: 3 });
    brain.registerAgent(agent('expert', ['X'], 1, { X: 0.85 }));
    brain.registerAgent(agent('novice', ['X'], 1, { X: 0.5 }));
    const sim = new CompoundBrainSimulator(brain, { simAlpha: 0.8, simBeta: 0.15, seed: 3 });
    for (let b = 0; b < 80; b++) {
      sim.simulateBatch([{ capability: 'X', value: 10 }]);
    }
    const advice = brain.advise();
    const capX = advice.find((a) => a.capability === 'X');
    assert.ok(capX, '应产出 X 能力的建议');
    assert.ok(capX.incubations.length === 2);
    for (const inc of capX.incubations) {
      assert.ok(typeof inc.capital === 'number');
      assert.ok(typeof inc.deltaMax === 'number');
      // 无劣势（已是最佳）→ K_min = 0；有劣势 → 正资本或不可行
      if (inc.kMin !== null) assert.ok(inc.kMin >= 0);
    }
    // expert 无劣势 → kMin = 0
    const expert = capX.incubations.find((i) => i.agentId === 'expert')!;
    assert.ok(expert.kMin === null || expert.kMin === 0, '最佳者无需孵化资本');

    // 05#14：兑现标题的「δ 单调」——lawKMin 的文档方向是 K_min 随凭证
    // 劣势 δ 单调不减（δ=0 → 0；劣势越大所需资本越多；不可行 = null = ∞）。
    // δ 未在建议中直接暴露，从公开的 base 字段重算：
    // δ_i = max(0, max_{j≠i} base_j − base_i)
    const incubations = capX.incubations;
    const deltaOf = (idx: number): number =>
      Math.max(
        0,
        ...incubations.filter((_, j) => j !== idx).map((o) => o.base - incubations[idx]!.base),
      );
    const kMinAsInf = (k: number | null): number => (k === null ? Number.POSITIVE_INFINITY : k);
    const byDelta = incubations
      .map((inc, idx) => ({ inc, delta: deltaOf(idx) }))
      .sort((a, b) => a.delta - b.delta);
    assert.ok(byDelta[byDelta.length - 1]!.delta > 0, 'novice 应存在正凭证劣势（前提自查）');
    for (let i = 1; i < byDelta.length; i++) {
      const prev = byDelta[i - 1]!;
      const curr = byDelta[i]!;
      assert.ok(
        kMinAsInf(curr.inc.kMin) >= kMinAsInf(prev.inc.kMin) - 1e-9,
        `K_min 应随 δ 单调不减：δ=${prev.delta.toFixed(3)} → K_min=${String(prev.inc.kMin)}, ` +
          `δ=${curr.delta.toFixed(3)} → K_min=${String(curr.inc.kMin)}`,
      );
    }
  });
});

// ============================================================================
// fitGrid 精确 memo（08#3）
// ============================================================================

describe('CompoundBrain · 校准缓存（08#3）', () => {
  /** 私有成员的测试视图（fitGrid 计数探针 / 显式触发 calibrate） */
  type BrainInternals = {
    fitGrid: (obs: Array<{ base: number; k: number; success: boolean }>) => unknown;
    calibrate: (c: string) => void;
  };

  function internalsOf(brain: CompoundBrain): BrainInternals {
    return brain as unknown as BrainInternals;
  }

  /** 安装 fitGrid 调用计数探针，返回读数函数（确定性探针，不依赖时间） */
  function probeFitGrid(brain: CompoundBrain): () => number {
    const internals = internalsOf(brain);
    const original = internals.fitGrid;
    let calls = 0;
    internals.fitGrid = (obs) => {
      calls++;
      return original.call(brain, obs);
    };
    return () => calls;
  }

  it('同观测重复校准不重算；新增观测/容量淘汰后必重算（键 = 变更计数而非长度）', () => {
    const brain = new CompoundBrain({
      minCalibrationAttempts: 3,
      observationCap: 6, // 故意小：第 7 次结算起进入 FIFO 淘汰区（长度恒 6）
      seed: 42,
    });
    brain.registerAgent(agent('a', ['X'], 0.5, { X: 0.5 }));
    brain.registerAgent(agent('b', ['X'], 0.5, { X: 0.5 }));

    const settleOne = (success: boolean): void => {
      const r = brain.submitTask('X');
      assert.ok(r, '两 agent 单任务必有人中标');
      assert.ok(brain.settleTask(r.taskId, success));
    };

    // 观测不足 minCalibrationAttempts 期间 fitGrid 本就不跑；攒到 4 条
    for (let i = 0; i < 4; i++) settleOne(i >= 1);

    const readCalls = probeFitGrid(brain);
    const internals = internalsOf(brain);

    // 观测未变：重复校准必须命中缓存（0 次网格重算）
    internals.calibrate('X');
    internals.calibrate('X');
    assert.equal(readCalls(), 0, '观测未变的重复校准不得重跑 51×41 网格');

    // 新增观测（append，未达淘汰）：结算内校准必须重算 1 次，随后命中
    settleOne(true);
    assert.equal(readCalls(), 1, '观测 append 后必须重算');
    internals.calibrate('X');
    assert.equal(readCalls(), 1, '重算一次后同观测校准复用缓存');

    // 淘汰区：长度恒为 6 而内容在换——若键误用长度，此处会静默返回过期拟合
    for (let extra = 0; extra < 3; extra++) {
      settleOne(extra % 2 === 0);
    }
    assert.equal(readCalls(), 4, '容量淘汰（同长度不同内容）每次结算后都必须重算');

    internals.calibrate('X');
    assert.equal(readCalls(), 4, '最终观测集未变，校准仍命中缓存');
  });

  it('缓存命中/未命中路径位级一致：冗余重校准不改变任何校准与定价数值', () => {
    const mk = (): CompoundBrain =>
      new CompoundBrain({ minCalibrationAttempts: 3, observationCap: 8, seed: 42 });
    const withRedundantRecalibration = mk();
    const plainFlow = mk();
    for (const brain of [withRedundantRecalibration, plainFlow]) {
      brain.registerAgent(agent('a', ['X'], 0.5, { X: 0.5 }));
    }

    const internals = internalsOf(withRedundantRecalibration);
    for (let i = 0; i < 30; i++) {
      for (const brain of [withRedundantRecalibration, plainFlow]) {
        const r = brain.submitTask('X');
        assert.ok(r);
        assert.ok(brain.settleTask(r.taskId, i >= 3)); // 学习型成功流：α̂ > 0
      }
      // A 侧插入任意次冗余校准（命中缓存）；B 侧只有结算内的真实校准
      internals.calibrate('X');
      internals.calibrate('X');
    }

    const calA = withRedundantRecalibration.calibrations();
    const calB = plainFlow.calibrations();
    assert.ok(calB[0]!.alphaHat > 0, '对照场景应检出学习信号（否则等价断言空转）');
    assert.deepEqual(calA, calB, '校准报告逐位一致');

    // 定价口径（mixture 经 qHat/growthValue 进入分配与支付）也必须一致
    const allocA = withRedundantRecalibration.allocateBatch([{ capability: 'X', value: 10 }]);
    const allocB = plainFlow.allocateBatch([{ capability: 'X', value: 10 }]);
    assert.deepEqual(allocA, allocB, '缓存路径不得改变任何分配/支付/福利数值');
  });
});

// ============================================================================
// 插件集成（duck typing）
// ============================================================================

describe('CompoundBrain · 插件集成', () => {
  it('CompoundBrain 实例直接作为 config.brain 接入并完成闭环', async () => {
    const { ProactiveIntelligencePlugin } = await import('../src/proactive-intelligence/index.js');
    // 08#11：本用例只走 submitTask/settleTask 闭环，实验参数随模拟逻辑
    // 迁出 config（原 simAlpha/simBeta 从未在此路径被消费）
    const brain = new CompoundBrain({
      defaultTaskValue: 10,
      seed: 9,
    });
    brain.registerAgent(agent('a', ['summarize'], 0.5, { summarize: 0.6 }));

    const plugin = new ProactiveIntelligencePlugin({ brain });
    await plugin.start();

    // task_request 事件 → Brain 市场分配（setImmediate 批处理 → executor 执行）
    plugin.observe({
      type: 'task_request',
      source: 'test',
      data: { capability: 'summarize' },
      severity: 'info',
    });
    await new Promise((r) => {
      let n = 0;
      const step = () => {
        if (++n >= 4) r(null);
        else setImmediate(step);
      };
      setImmediate(step);
    });

    const hist = plugin.getExecutor().getExecutionHistory();
    const alloc = hist.find((e) => e.status === 'completed' && e.action?.type === 'assignment');
    assert.ok(alloc, 'task_request 应经 CompoundBrain 产出 market_allocate 执行记录');
    const taskId = (alloc.result as any).taskId;

    // 结算闭环：settleTask 驱动学习资本与校准
    assert.ok(plugin.settleTask(taskId, true), '结算应命中在途任务');
    const agents = (plugin.getBrain()!.getState() as any).agents;
    assert.equal(agents[0].capital.summarize, 1, '结算后学习资本 +1');
    assert.equal(plugin.settleTask(taskId, true), false, '重复结算应幂等拒绝');

    await plugin.stop();
  });

  it('配置对象仍按 GrowthSchedulerBrain 构造（向后兼容）', async () => {
    const { ProactiveIntelligencePlugin, GrowthSchedulerBrain } =
      await import('../src/proactive-intelligence/index.js');
    const plugin = new ProactiveIntelligencePlugin({ brain: { successValue: 10 } });
    assert.ok(
      plugin.getBrain() instanceof GrowthSchedulerBrain,
      '配置对象应构造默认增长市场 Brain',
    );
  });
});

// ============================================================================
// 在途台账积压可观测性（漏结算可见化）
// ============================================================================

describe('CompoundBrain · 在途台账积压可观测性', () => {
  function freshBrain(pendingBacklogWarnAt?: number): CompoundBrain {
    const brain = new CompoundBrain(
      pendingBacklogWarnAt === undefined ? { seed: 11 } : { seed: 11, pendingBacklogWarnAt },
    );
    brain.registerAgent(agent('solo', ['api'], 1, { api: 0.8 }), 1);
    return brain;
  }
  const TASKS: CompoundTaskSpec[] = [{ capability: 'api', value: 10 }];

  it('分配不结算 → getState 暴露积压深度与滞留时长；结算后清零', async () => {
    const brain = freshBrain();
    const alloc = brain.allocateBatch(TASKS);
    assert.ok(alloc.assignments.length > 0, 'solo agent 应赢得任务');

    const backlog = brain.getState().pendingBacklog;
    assert.equal(backlog.count, 1, '未结算任务必须计入积压');
    assert.ok(backlog.oldestAgeMs >= 0, '滞留时长非负');

    // 睡眠余量必须远大于断言阈值：setTimeout 走 libuv 的粗粒度单调钟
    // （Linux CLOCK_MONOTONIC_COARSE，粒度可达 4ms），墙钟上可提前 ~1ms
    // 到期——5ms 睡眠配 >=5 断言在 ubuntu runner 上实测只攒到 4ms（CI
    // 2026-09-09 连续两次），25ms 余量吞掉粒度与提前量后仍稳过阈值。
    await new Promise((r) => setTimeout(r, 25));
    assert.ok(
      brain.getState().pendingBacklog.oldestAgeMs >= 5,
      '滞留时长随时间增长（观测时钟真实走动）',
    );

    assert.equal(brain.settle(alloc.assignments[0]!.taskId, true), true);
    const after = brain.getState().pendingBacklog;
    assert.equal(after.count, 0, '结算清空积压');
    assert.equal(after.oldestAgeMs, 0, '空台账滞留时长为 0');
  });

  it('backlog_warning 带迟滞：越限告警一次，回落半阈值以下才重新武装', () => {
    // 阶段一：越限只告警一次，迟滞期内不重复
    const brain = freshBrain(2);
    const warnings: number[] = [];
    brain.on('backlog_warning', (w) => warnings.push(w.count));

    const firstId = brain.allocateBatch(TASKS).assignments[0]!.taskId;
    brain.allocateBatch(TASKS); // count=2 ≥ 阈值 → 告警 #1
    assert.deepEqual(warnings, [2]);

    brain.allocateBatch(TASKS); // count=3 仍越限 → 迟滞不重复
    brain.settle(firstId, true); // count=2，未回落到 ≤1 → 仍不重新武装
    brain.allocateBatch(TASKS); // count=3
    assert.deepEqual(warnings, [2], '迟滞期内不得重复告警');

    // 阶段二（干净实例）：回落到 ≤ 半阈值（1）后告警重新武装
    const brain2 = new CompoundBrain({ seed: 12, pendingBacklogWarnAt: 2 });
    brain2.registerAgent(agent('solo', ['api'], 1, { api: 0.8 }), 1);
    const seen: number[] = [];
    brain2.on('backlog_warning', (w) => seen.push(w.count));
    const id = brain2.allocateBatch(TASKS).assignments[0]!.taskId;
    brain2.allocateBatch(TASKS); // count=2 → 告警 #1
    brain2.settle(id, true); // 2→1 ≤ 半阈值：重新武装
    brain2.allocateBatch(TASKS); // count=2 再次越限 → 告警 #2（计 2）
    brain2.allocateBatch(TASKS); // count=3，迟滞期内不重复
    assert.deepEqual(seen, [2, 2], '半阈值回落后告警应重新武装');
  });

  it('告警关闭（pendingBacklogWarnAt=0）：积压任意大也不发事件', () => {
    const brain = freshBrain(0);
    let warnings = 0;
    brain.on('backlog_warning', () => warnings++);
    for (let i = 0; i < 5; i++) brain.allocateBatch(TASKS);
    assert.equal(warnings, 0);
    assert.equal(brain.getState().pendingBacklog.count, 5);
  });

  it('可观测性零数值影响：同 seed 下分配/支付/福利与无观测配置逐位一致', () => {
    // 05#8：结构化快照 + 稳定序列化比较（键排序），不再依赖
    // JSON.stringify 的 V8 键插入序——同一确定性保证，无键序脆性
    const snapshot = (cfg?: { pendingBacklogWarnAt?: number }): unknown => {
      const b = new CompoundBrain({ seed: 99, ...cfg });
      b.registerAgent(agent('a', ['api'], 1, { api: 0.7 }), 1);
      b.registerAgent(agent('b', ['api'], 1.5, { api: 0.6 }), 1.5);
      const alloc = b.allocateBatch([
        { capability: 'api', value: 10 },
        { capability: 'api', value: 9 },
      ]);
      return {
        assignments: alloc.assignments.map((x) => [x.agentId, x.payment, x.estQuality]),
        payments: alloc.payments,
        welfareAugmented: alloc.welfareAugmented,
      };
    };
    assert.equal(
      stableSerialize(snapshot()),
      stableSerialize(snapshot({ pendingBacklogWarnAt: 1 })),
      '告警路径开启前后，分配/支付/增广福利的稳定序列化应逐字一致',
    );
    // pendingBacklogWarnAt:1 触发告警路径（代码覆盖）而结果逐位不变
  });
});

// ============================================================================
// 08#11 关注点分离：实验面（simulateBatch/misreport）迁出核心机制类
// ============================================================================

describe('CompoundBrain · 实验面分离（08#11）', () => {
  it('核心类不再暴露实验 API：misreport 迁出，缺省配置不含实验旋钮', () => {
    const brain = new CompoundBrain();
    brain.registerAgent(agent('a', ['X'], 1, { X: 0.5 }));
    // 编译级探针（同 08#51 的 @ts-expect-error 锚定法；不执行调用，
    // 仅证明属性已不在 CompoundBrain 类型上）
    // @ts-expect-error 08#11：misreport 已迁至 CompoundBrainSimulator
    const removed: undefined = brain.misreport;
    assert.equal(removed, undefined);
    assert.equal('misreport' in brain, false, '运行时同样不得残留 misreport');
    assert.ok(
      !('simAlpha' in DEFAULT_COMPOUND_CONFIG) && !('simBeta' in DEFAULT_COMPOUND_CONFIG),
      '机制缺省配置不得携带实验旋钮（实验参数经 CompoundBrainSimulatorOptions 注入）',
    );
    brain.dispose();
  });

  it('模拟器复现迁移前的精确数值流（位级迁移契约，pins 取自迁移前实跑）', () => {
    const brain = new CompoundBrain({ growthHorizon: 80, seed: 123 });
    brain.registerAgent({
      id: 'veteran',
      capabilities: ['X'],
      trueCost: 2.0,
      trueQuality: { X: 0.8 },
    });
    brain.registerAgent({
      id: 'trainee',
      capabilities: ['X'],
      trueCost: 0.2,
      trueQuality: { X: 0.6 },
    });
    const sim = new CompoundBrainSimulator(brain, { simAlpha: 0.85, simBeta: 0.15, seed: 123 });
    // pins：迁移前 CompoundBrain.simulateBatch 同 seed/同参数的实跑输出
    // （2026-09-12 迁移前捕获，含中间批次的支付/welfareAug）
    const pins: Array<{
      realized: number;
      welfareAug: number;
      payments: Record<string, number>;
      settlements: Array<[string, boolean, number]>;
    }> = [
      {
        realized: 16.8,
        welfareAug: 20.7,
        payments: { veteran: 12.149999999999999, trainee: 10.149999999999999 },
        settlements: [
          ['veteran', true, 0],
          ['trainee', true, 0],
        ],
      },
      {
        realized: 16.8,
        welfareAug: 18.044787148544927,
        payments: { veteran: 10.795120846999737, trainee: 8.84057539245428 },
        settlements: [
          ['veteran', true, 1],
          ['trainee', true, 1],
        ],
      },
      {
        realized: 7.8,
        welfareAug: 17.058160890634777,
        payments: { veteran: 10.249080445317388, trainee: 8.382413778650722 },
        settlements: [
          ['veteran', true, 2],
          ['trainee', false, 2],
        ],
      },
    ];
    for (const [b, pin] of pins.entries()) {
      const r = sim.simulateBatch([
        { capability: 'X', value: 10 },
        { capability: 'X', value: 9 },
      ]);
      assert.equal(r.realizedWelfare, pin.realized, `批 ${b} 真实福利逐位一致`);
      assert.equal(r.allocation.welfareAugmented, pin.welfareAug, `批 ${b} 增广福利逐位一致`);
      assert.deepEqual(r.allocation.payments, pin.payments, `批 ${b} Clarke pivot 支付逐位一致`);
      assert.deepEqual(
        r.settlements.map((s) => [s.agentId, s.success, s.capitalAtAssignment]),
        pin.settlements,
        `批 ${b} 结算流逐位一致`,
      );
    }
    assert.equal(brain.getState().netWelfare, 41.4, '累计已实现福利逐位一致');
    brain.dispose();
  });

  it('模拟器 misreport 驱动报价（DSIC 实验面）且复现迁移前分配结果', () => {
    const brain = new CompoundBrain({ seed: 7 });
    brain.registerAgent({
      id: 'a1',
      capabilities: ['api'],
      trueCost: 1,
      trueQuality: { api: 0.7 },
      capacity: 2,
    });
    brain.registerAgent({
      id: 'a2',
      capabilities: ['api'],
      trueCost: 1.5,
      trueQuality: { api: 0.6 },
      capacity: 2,
    });
    const sim = new CompoundBrainSimulator(brain, { simAlpha: 0, simBeta: 0 });
    sim.misreport('a1', 5);
    const alloc = brain.allocateBatch([
      { capability: 'api', value: 10 },
      { capability: 'api', value: 9 },
    ]);
    // pins：迁移前 brain.misreport('a1', 5) + allocateBatch 同 seed 实跑输出
    assert.deepEqual(
      alloc.assignments.map((a) => a.agentId),
      ['a2', 'a2'],
      '虚报 5 后两任务都应流向 a2',
    );
    assert.deepEqual(alloc.payments, { a2: 8.099999999999998 });
    assert.equal(alloc.welfareAugmented, 17.9);
    // 未知 id 立即抛错（迁移前 misreport 的契约原样保持）
    assert.throws(() => sim.misreport('nope', 1), /Unknown agent: nope/);
    brain.dispose();
  });

  it('deprecated 委托路径与直接模拟器同流（冻结回归调用方的位级等价保证）', () => {
    // tests/regression/r8-core-lifecycle.test.ts、compound-brain-emit-isolation
    // 与 examples 仍经 brain.simulateBatch 调用——委托内部模拟器必须与
    // 直接使用 CompoundBrainSimulator 产生逐位相同的序列（同 seed、
    // 同 draw 序：每个分配恰一次、按分配序）
    const mk = (): { brain: CompoundBrain; sim: CompoundBrainSimulator } => {
      const brain = new CompoundBrain({ simAlpha: 0.8, simBeta: 0.15, seed: 5, growthHorizon: 80 });
      brain.registerAgent({ id: 'a', capabilities: ['X'], trueCost: 1, trueQuality: { X: 0.6 } });
      brain.registerAgent({ id: 'b', capabilities: ['X'], trueCost: 1.5, trueQuality: { X: 0.5 } });
      return {
        brain,
        sim: new CompoundBrainSimulator(brain, { simAlpha: 0.8, simBeta: 0.15, seed: 5 }),
      };
    };
    const viaDelegator = mk();
    const viaSimulator = mk();
    const TASKS: CompoundTaskSpec[] = [
      { capability: 'X', value: 10 },
      { capability: 'X', value: 9 },
    ];
    for (let i = 0; i < 10; i++) {
      const d = viaDelegator.brain.simulateBatch(TASKS);
      const s = viaSimulator.sim.simulateBatch(TASKS);
      assert.deepEqual(d, s, `批 ${i} 委托路径与模拟器逐位一致`);
    }
    assert.deepEqual(
      viaDelegator.brain.getState().agents,
      viaSimulator.brain.getState().agents,
      '委托与直连的学习状态逐位一致',
    );
    viaDelegator.brain.dispose();
    viaSimulator.brain.dispose();
  });
});
