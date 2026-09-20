/**
 * R18-A 验收 · shadow-price-secant（影子价格 λ 的分段仿射割线搜索）。
 *
 * 钉板结构（每条主张一枚钉子，负对照走私审判式）：
 * ① 仿射段内一步命中定理：构造精确仿射支付评估器，断言第 3 次评估命中
 *    （评估数 = 3 机器计数）且 |P(λ̂) − B| ≤ 1e-9、λ̂ = 闭式理论值；
 * ② 分段仿射连续（多段折线）命中：exactHit = true，λ 落理论段内；
 * ③ 跳降（不连续，Σp 跳过预算）：可行返回 + exactHit = false + 评估数
 *    ≤ 8（支付平坦终止，机器计数）；
 * ④ 预算不紧短路：slackAtZero，1 次评估；
 * ⑤ 负对照·域外输入：budget NaN/负、λmax ≤ 0、tolerance < 0、
 *    maxEvaluations < 4 —— 一律具名 MechanismError；
 * ⑥ 负对照·λmax 契约违约：P(λmax) > B 的评估器必须被具名拒绝（不静默
 *    交出无主张结果）；
 * ⑦ 负对照·单调性违约：λ 增支付反增的评估器必须带证据对抛错；
 * ⑧ 负对照·防御上限：maxEvaluations=3 时跳降实例触发 cap 抛错；
 * ⑨ 对拍：batch-VCG 同构市场（镜像 WDP + Clarke pivot 支付评估器，
 *    MinCostFlow 冷解复刻 batch-vcg-scheduler.solveWDP/solveWithPayments
 *    的数值路径）——割线 vs 内联 60 轮二分参照：两者终局支付均 ≤ B，
 *    割线评估数 < 二分评估数（机器计数）；真实 BatchVCGScheduler.
 *    allocateBatch 同市场预算紧路径的 λ/支付可行性与割线一致。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { solveSecant } from '../src/core/shadow-price-secant.js';
import { MinCostFlow, type FlowEdgeRef } from '../src/core/min-cost-flow.js';
import { BatchVCGScheduler, type BatchAgentSpec } from '../src/core/batch-vcg-scheduler.js';
import { MechanismError } from '../src/utils/errors.js';

/** 预算容差（与 allocateBatch 的 budget + 1e-9 同值同义） */
const TOL = 1e-9;

describe('R18-A · shadow-price-secant ①② 仿射结构的一步命中', () => {
  // 参数化仿射实例：P(λ) = a − b·λ 在 [0, λmax] 上纯仿射（λmax 取段内
  // 值，使 P(λmax) = a − b·λmax > 0 且 ≤ B——一步命中定理的前提是
  // bracket 两端在同一仿射段上，floor 钳制的触底实例属多段形态、由②覆盖）
  const affineCases: ReadonlyArray<{
    a: number;
    b: number;
    budget: number;
    lambdaMax: number;
    lambdaStar: number;
  }> = [
    // λ* = (a−B)/b；λmax = 1.3·λ* ⟹ P(λmax) = B − 0.3(a−B) ∈ (0, B)
    { a: 12, b: 1.5, budget: 5, lambdaMax: 1.3 * ((12 - 5) / 1.5), lambdaStar: (12 - 5) / 1.5 },
    {
      a: 7.3,
      b: 0.4,
      budget: 6.9,
      lambdaMax: 1.3 * ((7.3 - 6.9) / 0.4),
      lambdaStar: (7.3 - 6.9) / 0.4,
    },
    { a: 100, b: 9, budget: 41, lambdaMax: 1.25 * ((100 - 41) / 9), lambdaStar: (100 - 41) / 9 },
  ];

  for (const c of affineCases) {
    it(`仿射 P(λ)=a−bλ 纯段：3 次评估精确命中（a=${c.a}, b=${c.b}, B=${c.budget}）`, () => {
      const P = (lambda: number): number => c.a - c.b * lambda;
      // 前置自检：两端确在同一仿射段（P(λmax) ∈ (0, B]，无 floor 参与）
      assert.ok(P(c.lambdaMax) > 0 && P(c.lambdaMax) <= c.budget);
      const result = solveSecant({
        evaluate: P,
        budget: c.budget,
        lambdaMax: c.lambdaMax,
      });
      // 一步命中定理：恰 3 次评估（λ=0、λ=λmax、割线点）
      assert.equal(result.evaluatedLambdas.length, 3, '评估数机器计数必须为 3');
      assert.equal(result.exactHit, true);
      assert.equal(result.slackAtZero, false);
      // 命中精度：插值算术的 IEEE 舍入 ≤ 数 ulp，断言 1e-9 档（hitTol 缺省）
      assert.ok(
        Math.abs(result.payment - c.budget) <= 1e-9,
        `|P(λ̂) − B| = ${Math.abs(result.payment - c.budget)} 应 ≤ 1e-9`,
      );
      // λ̂ = 闭式理论最小可行值（段内单调不增 ⟹ 命中点即最小可行点）
      assert.ok(
        Math.abs(result.lambda - c.lambdaStar) <= 1e-9,
        `λ̂ = ${result.lambda} 应 ≈ 理论值 ${c.lambdaStar}`,
      );
      // 返回点实测可行
      assert.ok(result.payment <= c.budget + TOL);
    });
  }

  it('② 两段连续折线：命中落在理论段内且 exactHit（中点步把 lo 推进段 2 后段内一步命中）', () => {
    // 段 1（λ<2）：P = 10 − 3λ；段 2（λ≥2）：P = 6 − 0.5λ（连续：2 处均 = 4）
    // B = 3 ⟹ 段 2 内解 λ* = (6−3)/0.5 = 6
    const P = (lambda: number): number => (lambda < 2 ? 10 - 3 * lambda : 6 - 0.5 * lambda);
    const result = solveSecant({ evaluate: P, budget: 3, lambdaMax: 12 });
    assert.equal(result.exactHit, true);
    assert.ok(Math.abs(result.payment - 3) <= 1e-9);
    assert.ok(Math.abs(result.lambda - 6) <= 1e-9, `λ̂=${result.lambda} 应 ≈ 6`);
    assert.ok(
      result.evaluatedLambdas.length <= 12,
      `评估数 ${result.evaluatedLambdas.length} 应 ≤ 12（含中点保底步）`,
    );
  });

  it('② 三段折线（预算在第一段内解出）：一步命中不受段边界干扰', () => {
    // 段 1（λ<1.5）：P = 9 − 4λ；段 2/3 更平。B = 7.4 ⟹ 段 1 内 λ* = 0.4
    const P = (lambda: number): number => {
      if (lambda < 1.5) return 9 - 4 * lambda;
      if (lambda < 5) return 5 - lambda;
      return 1.2 - 0.1 * lambda;
    };
    const result = solveSecant({ evaluate: P, budget: 7.4, lambdaMax: 10 });
    assert.equal(result.exactHit, true);
    assert.ok(Math.abs(result.payment - 7.4) <= 1e-9);
    assert.ok(Math.abs(result.lambda - 0.4) <= 1e-9);
  });
});

describe('R18-A · shadow-price-secant ③④ 跳降与短路', () => {
  it('③ 跳降（P 在 λ=3 处从 10 跳到 4，B=5）：可行返回、exactHit=false、评估 ≤ 8（平坦终止）', () => {
    const P = (lambda: number): number => (lambda < 3 ? 10 : 4);
    const result = solveSecant({ evaluate: P, budget: 5, lambdaMax: 10 });
    assert.equal(result.exactHit, false, '跳变跨过预算：不存在段内命中');
    assert.equal(result.slackAtZero, false);
    assert.ok(result.payment <= 5 + TOL, '返回点必须实测可行');
    assert.ok(result.lambda >= 3, `返回 λ=${result.lambda} 不得落不可行侧（λ<3 时 P=10>B）`);
    assert.ok(
      result.evaluatedLambdas.length <= 8,
      `跳降平台应由平坦终止消化，评估数 ${result.evaluatedLambdas.length} 应 ≤ 8`,
    );
  });

  it('③ 多平台阶梯跳降：每平台一次收缩后仍可行返回', () => {
    // 阶梯：λ<2→12、[2,5)→9、[5,8)→6、≥8→2.5；B=5.5 ⟹ 最小可行 λ=5
    const P = (lambda: number): number => (lambda < 2 ? 12 : lambda < 5 ? 9 : lambda < 8 ? 6 : 2.5);
    const result = solveSecant({ evaluate: P, budget: 5.5, lambdaMax: 10 });
    assert.ok(result.payment <= 5.5 + TOL);
    assert.ok(result.lambda >= 5, '返回点不得落 P=9/12 的不可行侧');
    assert.ok(
      result.evaluatedLambdas.length <= 16,
      `阶梯实例评估数 ${result.evaluatedLambdas.length} 应受平坦/中点混合消化`,
    );
  });

  it('④ 预算不紧：slackAtZero 短路，恰 1 次评估', () => {
    let calls = 0;
    const result = solveSecant({
      evaluate: (lambda) => {
        calls++;
        assert.equal(lambda, 0);
        return 4.2;
      },
      budget: 5,
      lambdaMax: 10,
    });
    assert.equal(result.slackAtZero, true);
    assert.equal(result.lambda, 0);
    assert.equal(result.payment, 4.2);
    assert.equal(calls, 1, '短路路径必须恰评估 1 次');
  });

  it('④ 预算恰好等于 P(0)：可行（≤ B + tol），1 次评估短路', () => {
    const result = solveSecant({ evaluate: () => 5, budget: 5, lambdaMax: 10 });
    assert.equal(result.slackAtZero, true);
    assert.equal(result.evaluatedLambdas.length, 1);
  });
});

describe('R18-A · shadow-price-secant ⑤–⑧ 负对照（走私审判）', () => {
  it('⑤ budget NaN / 负数：具名拒绝（NaN 击穿比较恒 false 的既有教训）', () => {
    const ok = (lambda: number): number => 10 - lambda;
    assert.throws(
      () => solveSecant({ evaluate: ok, budget: Number.NaN, lambdaMax: 12 }),
      MechanismError,
    );
    assert.throws(() => solveSecant({ evaluate: ok, budget: -1, lambdaMax: 12 }), MechanismError);
    assert.throws(() => solveSecant({ evaluate: ok, budget: 5, lambdaMax: 0 }), MechanismError);
    assert.throws(
      () => solveSecant({ evaluate: ok, budget: 5, lambdaMax: 12, tolerance: -1 }),
      MechanismError,
    );
    assert.throws(
      () => solveSecant({ evaluate: ok, budget: 5, lambdaMax: 12, maxEvaluations: 3 }),
      MechanismError,
    );
  });

  it('⑥ λmax 契约违约（P(λmax) > B）：具名拒绝且证据入消息', () => {
    // P(λ) = 10 − 0.2λ：P(λmax=12) = 7.6 > B=5 —— 评估器从未回到空分配
    assert.throws(
      () => solveSecant({ evaluate: (lambda) => 10 - 0.2 * lambda, budget: 5, lambdaMax: 12 }),
      (err: unknown) => {
        assert.ok(err instanceof MechanismError);
        assert.match(err.message, /lambdaMax contract violated/);
        assert.match(err.message, /7\.6/);
        return true;
      },
    );
  });

  it('⑦ 单调性违约（λ 增支付反增）：带证据对抛错，不交出无主张结果', () => {
    // P(λ) = λ<3 ? 10−λ : λ<6 ? 11 : 1：λmax=10 处 P=1 ≤ B=5（契约满足），
    // 但初始割线点 λ̂ = (10−5)·10/(10−1) = 5.56 落 (3,6) 违约区，P=11 > pLo
    assert.throws(
      () =>
        solveSecant({
          evaluate: (lambda) => (lambda < 3 ? 10 - lambda : lambda < 6 ? 11 : 1),
          budget: 5,
          lambdaMax: 10,
        }),
      (err: unknown) => {
        assert.ok(err instanceof MechanismError);
        assert.match(err.message, /monotonicity violated/);
        assert.match(err.message, /11/);
        return true;
      },
    );
  });

  it('⑧ 防御上限：maxEvaluations=4 下不收敛的两段折线触发 cap 抛错', () => {
    // 两段折线（B=3 实例）的收敛需 ≥8 次评估——cap=4 必须在循环内抛错
    assert.throws(
      () =>
        solveSecant({
          evaluate: (lambda) => (lambda < 2 ? 10 - 3 * lambda : 6 - 0.5 * lambda),
          budget: 3,
          lambdaMax: 12,
          maxEvaluations: 4,
        }),
      (err: unknown) => {
        assert.ok(err instanceof MechanismError);
        assert.match(err.message, /evaluation cap 4 exceeded/);
        return true;
      },
    );
  });
});

describe('R18-A · shadow-price-secant ⑨ 对拍（batch-VCG 同构市场）', () => {
  /**
   * 镜像市场：与 batch-vcg-scheduler.solveWDP/solveWithPayments 同构的
   * λ ↦ Σp(λ) 评估器——MCF 冷解复刻（S→agent(capacity)→task(1)→sink、
   * 边费 = −(v − λ − b)、score ≤ 0 不建边），Clarke pivot 按 bundle 计价
   * p_i = b_i·k_i + (W(λ) − W₋ᵢ(λ))。v 的取值与空履历 BatchVCGScheduler
   * 的 valueOf 同口径（exploreCoefficient=0、switchCostRate=0 时
   * socialValueOf = successValue·priorQuality）。
   */
  interface MirrorMarket {
    agentIds: string[];
    capabilities: string[];
    v: number[][]; // v[a][t]
    bid: number[];
    capacity: number[];
    eligible: boolean[][];
  }

  function solveWdpMirror(
    m: MirrorMarket,
    lambda: number,
    excludeAgent: number | undefined,
  ): Array<{ t: number; a: number }> {
    const agents = m.agentIds.map((id, i) => ({ id, i })).filter(({ i }) => i !== excludeAgent);
    const T = m.capabilities.length;
    const sink = 1 + agents.length + T;
    const mcf = new MinCostFlow(sink + 1);
    agents.forEach(({ i }, idx) => mcf.addEdge(0, 1 + idx, m.capacity[i]!, 0));
    const pairEdges: Array<{ ref: FlowEdgeRef; t: number; a: number }> = [];
    agents.forEach(({ i }, idx) => {
      for (let t = 0; t < T; t++) {
        if (!m.eligible[i]![t]) continue;
        const score = m.v[i]![t]! - lambda - m.bid[i]!;
        if (score <= 0) continue;
        const ref = mcf.addEdge(1 + idx, 1 + agents.length + t, 1, -score);
        pairEdges.push({ ref, t, a: i });
      }
    });
    for (let t = 0; t < T; t++) mcf.addEdge(1 + agents.length + t, sink, 1, 0);
    mcf.run(0, sink);
    return pairEdges.filter((pe) => mcf.edgeOccupied(pe.ref)).map((pe) => ({ t: pe.t, a: pe.a }));
  }

  function welfareMirror(
    m: MirrorMarket,
    pairs: Array<{ t: number; a: number }>,
    lambda: number,
  ): number {
    let w = 0;
    for (const p of pairs) w += m.v[p.a]![p.t]! - lambda - m.bid[p.a]!;
    return w;
  }

  function totalPaymentMirror(m: MirrorMarket, lambda: number): number {
    const pairs = solveWdpMirror(m, lambda, undefined);
    const W = welfareMirror(m, pairs, lambda);
    const counts = new Map<number, number>();
    for (const p of pairs) counts.set(p.a, (counts.get(p.a) ?? 0) + 1);
    let total = 0;
    for (const a of counts.keys()) {
      const wWithout = welfareMirror(m, solveWdpMirror(m, lambda, a), lambda);
      total += m.bid[a]! * counts.get(a)! + (W - wWithout);
    }
    return total;
  }

  /** 与 batch-vcg 默认配置同口径的镜像市场（空履历 ⇒ v = 10·0.5 = 5） */
  function buildMirror(): MirrorMarket {
    const agentIds = ['a0', 'a1', 'a2'];
    const capabilities = ['x', 'x', 'x', 'y', 'x'];
    const v = 5; // successValue(10) × priorQuality(0.5)
    const bid = [1.2, 1.0, 1.4];
    const capacity = [2, 1, 1];
    const eligible = [
      [true, true, true, false, true],
      [true, true, true, true, true],
      [true, false, true, false, true],
    ];
    return {
      agentIds,
      capabilities,
      v: eligible.map((row) => row.map(() => v)),
      bid,
      capacity,
      eligible,
    };
  }

  /** 内联二分参照：复刻 allocateBatch 的 60 轮 λ-bisection（同一评估器） */
  function bisectionBaseline(
    m: MirrorMarket,
    budget: number,
  ): { lambda: number; payment: number; evaluations: number } {
    let lambdaMax = 1;
    for (let a = 0; a < m.agentIds.length; a++) {
      for (let t = 0; t < m.capabilities.length; t++)
        lambdaMax = Math.max(lambdaMax, m.v[a]![t]! + 1);
    }
    let evaluations = 0;
    const P = (lambda: number): number => {
      evaluations++;
      return totalPaymentMirror(m, lambda);
    };
    let lo = 0;
    let hi = lambdaMax;
    let bestPayment = P(hi);
    for (let iter = 0; iter < 60; iter++) {
      const mid = (lo + hi) / 2;
      const cand = P(mid);
      if (cand <= budget + TOL) {
        hi = mid;
        bestPayment = cand;
      } else {
        lo = mid;
      }
    }
    return { lambda: hi, payment: bestPayment, evaluations };
  }

  it('镜像市场：割线与二分参照终局均可行，割线评估数严格更少（机器计数）', () => {
    const m = buildMirror();
    const budget = 4.0;
    // 前置：P(0) > B（预算确实紧），P(λmax)=0 ≤ B
    const p0 = totalPaymentMirror(m, 0);
    assert.ok(p0 > budget, `镜像市场在 λ=0 处应预算紧（P(0)=${p0}）`);

    const secant = solveSecant({
      evaluate: (lambda) => totalPaymentMirror(m, lambda),
      budget,
      lambdaMax: 6,
    });
    const bisect = bisectionBaseline(m, budget);

    assert.ok(secant.payment <= budget + TOL, `割线终局支付 ${secant.payment} 应 ≤ B+tol`);
    assert.ok(bisect.payment <= budget + TOL, `二分参照终局支付 ${bisect.payment} 应 ≤ B+tol`);
    assert.ok(
      secant.evaluatedLambdas.length < bisect.evaluations,
      `割线评估数 ${secant.evaluatedLambdas.length} 应 < 二分 ${bisect.evaluations}`,
    );
  });

  it('真实 BatchVCGScheduler 预算紧路径与割线在同一市场均交付可行分配', () => {
    // 同构真市场：3 agents（bid=trueCost、空履历）× 5 任务，与镜像同形状
    const specs: BatchAgentSpec[] = [
      { id: 'a0', capabilities: ['x'], trueCost: 1.2, trueQuality: { x: 0.5 }, capacity: 2 },
      {
        id: 'a1',
        capabilities: ['x', 'y'],
        trueCost: 1.0,
        trueQuality: { x: 0.5, y: 0.5 },
        capacity: 1,
      },
      { id: 'a2', capabilities: ['x'], trueCost: 1.4, trueQuality: { x: 0.5 }, capacity: 1 },
    ];
    const scheduler = new BatchVCGScheduler({ exploreCoefficient: 0, switchCostRate: 0 });
    for (const spec of specs) scheduler.register(spec);

    const capabilities = ['x', 'x', 'x', 'y', 'x'];
    const budget = 4.0;
    const allocation = scheduler.allocateBatch(capabilities, { budget });
    assert.ok(allocation.lambda > 0, '预算紧路径应给出正影子价格');
    assert.ok(
      allocation.totalPayment <= budget + 1e-6,
      `allocateBatch 总支付 ${allocation.totalPayment} 应 ≤ 预算`,
    );

    // 割线在同一市场（镜像评估器）上的终局同样可行——两条独立求解路径
    // 交付一致的可行性，互相认证
    const m = buildMirror();
    const secant = solveSecant({
      evaluate: (lambda) => totalPaymentMirror(m, lambda),
      budget,
      lambdaMax: 6,
    });
    assert.ok(secant.payment <= budget + TOL);
    assert.ok(
      secant.evaluatedLambdas.length < 62,
      `割线评估数 ${secant.evaluatedLambdas.length} 应 < 二分路径的 62`,
    );
  });

  it('随机分段仿射族 × 40：割线终局全部可行（性质的压力钉板）', () => {
    // 确定性构造 40 个多段仿射/跳降混合实例（种子化，非 Math.random）
    const rand = (seed: number): (() => number) => {
      let a = seed >>> 0;
      return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    };
    const rng = rand(20260920);
    for (let inst = 0; inst < 40; inst++) {
      // 3~6 个断点的单调不增阶梯（段值递减，段内平坦或缓降）
      const segments = 3 + Math.floor(rng() * 4);
      const breakpoints: number[] = [];
      for (let s = 1; s < segments; s++) breakpoints.push(2 + s * 2 + rng());
      breakpoints.sort((x, y) => x - y);
      const values: number[] = [];
      let v = 8 + rng() * 6;
      for (let s = 0; s < segments; s++) {
        values.push(v);
        v -= 0.5 + rng() * 2.5;
      }
      const lambdaMax = breakpoints[breakpoints.length - 1]! + 4;
      const P = (lambda: number): number => {
        let idx = 0;
        while (idx < breakpoints.length && lambda >= breakpoints[idx]!) idx++;
        return values[idx]!;
      };
      // 预算取值覆盖末段平台与首段之间：P(λmax)=values 末段 ≤ B < P(0)=首段
      const budget =
        values[values.length - 1]! + rng() * (values[0]! - values[values.length - 1]! - 0.5);
      const result = solveSecant({ evaluate: P, budget, lambdaMax });
      assert.ok(
        result.payment <= budget + TOL,
        `实例 ${inst}: 终局支付 ${result.payment} 应 ≤ B=${budget}+tol`,
      );
      assert.ok(
        result.evaluatedLambdas.length <= 64,
        `实例 ${inst}: 评估数 ${result.evaluatedLambdas.length} 应在防御上限内`,
      );
    }
  });
});
