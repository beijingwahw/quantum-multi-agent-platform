/**
 * R18-I 验收 · λ 割线生产接线（BatchVCGScheduler.allocateBatch 的
 * lambdaSolver opt-in；缺省 'bisection' 位同构——未传新参时行为全同）。
 *
 * 钉板结构（走私审判式）：
 * ① 红测主钉·单仿射段+空分配平台市场（1 agent×1 任务、b=0：空履历下
 *    v=successValue·priorQuality=5，P(λ)=5−λ 于 λ<5、P=0 于 λ≥5、
 *    λmax=max(1,v+1)=6）：secant 路径 λ 求解评估数 ≤12（机器计数；
 *    二分路径结构常数 62=1(exact@0)+1(hi 初值)+60(轮)）且精确命中预算
 *    （|Σp−B|≤1e-9）、λ 与二分同值（=3.0）、福利逐位一致、支付可行；
 * ② 负对照·走私审判：未传 lambdaSolver 时新路径不可达——返回对象无
 *    lambdaEvaluations 键，λ/支付/福利/分配与显式 'bisection' 逐位同
 *    （缺省字节不变的直接观测面；全量行为面由既有邻居回归钉）；
 * ③ 负对照·域外 lambdaSolver 具名拒绝（MechanismError，消息含值）；
 * ④ 负对照·预算不紧：secant 配置不影响 exact 早退（λ=0、无评估键）；
 * ⑤ A/B 账本（3 个真实规模市场，机器输出行见 console）：secant vs
 *    bisection 的 λ 求解评估数 / 镜像复刻 MCF 冷解数 / λ / 总支付 /
 *    福利 / 弃标数；两路径终局可行、secant 评估数 < 62；福利逐位一致
 *    或差异机器归因于 λ 差异（λ 更大 ⟹ 弃标不少于二分）。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BatchVCGScheduler, type BatchAgentSpec } from '../src/core/batch-vcg-scheduler.js';
import { solveSecant } from '../src/core/shadow-price-secant.js';
import { MinCostFlow, type FlowEdgeRef } from '../src/core/min-cost-flow.js';
import { mulberry32 } from '../src/utils/rng.js';
import { MechanismError } from '../src/utils/errors.js';

/** 与 allocateBatch 预算比较同值同义的容差 */
const TOL = 1e-9;

/** 主钉市场：单 agent（b=0）×单任务——Σp(λ) 为「仿射段+空分配零平台」两段 */
function monoScheduler(): BatchVCGScheduler {
  const scheduler = new BatchVCGScheduler({ exploreCoefficient: 0, switchCostRate: 0 });
  scheduler.register({
    id: 'mono',
    capabilities: ['x'],
    trueCost: 0,
    trueQuality: { x: 0.5 },
    capacity: 1,
  });
  return scheduler;
}

describe('R18-I · λ 割线接线 ① 单仿射段市场的一步命中形态', () => {
  it('secant ≤12 次评估精确命中预算，λ 与二分同值（=3）、福利逐位一致', () => {
    const caps = ['x'];
    const budget = 2.0; // λ* = 3：P(3)=5−3=2=B 恰在仿射段内
    const secant = monoScheduler().allocateBatch(caps, { budget, lambdaSolver: 'secant' });

    // 机器计数：λ 求解评估数（对照二分结构常数 62）
    assert.equal(
      typeof secant.lambdaEvaluations,
      'number',
      'secant 路径必须披露 λ 求解评估的机器计数',
    );
    assert.ok(
      (secant.lambdaEvaluations ?? Infinity) <= 12,
      `评估数 ${secant.lambdaEvaluations} 应 ≤12（二分 62）`,
    );
    // 精确命中：|Σp − B| ≤ 1e-9（一步命中定理在段内 bracket 上的形态）
    assert.ok(
      Math.abs(secant.totalPayment - budget) <= TOL,
      `|Σp − B| = ${Math.abs(secant.totalPayment - budget)} 应 ≤ 1e-9`,
    );
    assert.ok(secant.totalPayment <= budget + 1e-6, '终局必须可行');

    // 与二分同值：同一市场形状的新实例跑缺省路径。二分的可行判定消费
    // round9 后的支付（|Σp−B|<5e-10 时 round9 平台内恒可行），收敛点由
    // 舍入轨迹停在理论 λ*=3 的 1e-9 邻域内——同值口径 = 支付粒度 round9
    const bisect = monoScheduler().allocateBatch(caps, { budget });
    assert.ok(
      Math.abs(bisect.lambda - 3) <= 2e-9,
      `二分 λ=${bisect.lambda} 应在理论值 3 的 round9 粒度邻域`,
    );
    assert.ok(Math.abs(bisect.totalPayment - 2) <= 2e-9, '二分支付在 round9 平台邻域');
    assert.ok(bisect.totalPayment <= budget + 1e-9, '二分终局在预算容差内可行');
    assert.ok(
      Math.abs(secant.lambda - bisect.lambda) <= 2e-9,
      `secant λ=${secant.lambda} 与二分 λ=${bisect.lambda} 同值（至支付粒度）`,
    );
    // 支付：本市场二分停点确定性地落在 round9 平台左缘（2.000000001，
    // 仍 ≤ B+1e-9 可行），secant 精确命中 2——观测面的支配（非普遍定理）
    assert.ok(
      secant.totalPayment <= bisect.totalPayment,
      `secant 支付 ${secant.totalPayment} ≤ 二分 ${bisect.totalPayment}`,
    );
    assert.equal(secant.welfare, bisect.welfare, '福利逐位一致');
    assert.equal(secant.exactDSIC, bisect.exactDSIC);
    // 支配性：secant λ 不劣于二分（支付粒度内——此处 secant 精确 =3）
    assert.ok(
      secant.lambda <= bisect.lambda + 1e-9,
      `secant λ=${secant.lambda} 不得显著大于二分 λ=${bisect.lambda}`,
    );
  });
});

describe('R18-I · λ 割线接线 ②–④ 负对照（走私审判）', () => {
  it('② 未传 lambdaSolver：新路径不可达（无 lambdaEvaluations 键）且与显式 bisection 逐位同', () => {
    const caps = ['x'];
    const budget = 2.0;
    const implicit = monoScheduler().allocateBatch(caps, { budget });
    const explicit = monoScheduler().allocateBatch(caps, { budget, lambdaSolver: 'bisection' });
    assert.equal('lambdaEvaluations' in implicit, false, '缺省路径不得携带新披露键');
    assert.equal(implicit.lambda, explicit.lambda);
    assert.equal(implicit.totalPayment, explicit.totalPayment);
    assert.equal(implicit.welfare, explicit.welfare);
    assert.equal(implicit.maxWelfare, explicit.maxWelfare);
    assert.equal(implicit.droppedTasks, explicit.droppedTasks);
    assert.deepEqual(implicit.payments, explicit.payments);
    assert.deepEqual(
      implicit.assignments.map((a) => a.agentId),
      explicit.assignments.map((a) => a.agentId),
    );
  });

  it('③ 域外 lambdaSolver 具名拒绝（静默回退会拿着「以为在测 secant」的数据出结论）', () => {
    assert.throws(
      () =>
        monoScheduler().allocateBatch(['x'], {
          budget: 2,
          lambdaSolver: 'newton' as unknown as 'secant',
        }),
      (err: unknown) => {
        assert.ok(err instanceof MechanismError);
        assert.match(err.message, /lambdaSolver/);
        assert.match(err.message, /newton/);
        return true;
      },
    );
  });

  it('④ 预算不紧：secant 配置不影响 exact 早退（λ=0、exactDSIC、无评估键）', () => {
    const alloc = monoScheduler().allocateBatch(['x'], { budget: 100, lambdaSolver: 'secant' });
    assert.equal(alloc.lambda, 0);
    assert.equal(alloc.exactDSIC, true);
    assert.equal('lambdaEvaluations' in alloc, false, '不紧路径不经 λ 求解器');
  });
});

describe('R18-I · λ 割线接线 ⑤ A/B 账本（真实规模市场 ×3）', () => {
  /** 种子化真实规模市场：能力池 {js,py,go}、成本/容量/凭证分层 */
  function buildSeededMarket(
    seed: number,
    nAgents: number,
    taskCount: number,
    withCredential: boolean,
  ): { specs: BatchAgentSpec[]; caps: string[] } {
    const rng = mulberry32(seed);
    const pool = ['js', 'py', 'go'];
    const specs: BatchAgentSpec[] = [];
    for (let i = 0; i < nAgents; i++) {
      const nC = 1 + Math.floor(rng() * 2.999);
      const capsSet = new Set<string>();
      while (capsSet.size < nC) capsSet.add(pool[Math.floor(rng() * pool.length)]!);
      const agentCaps = [...capsSet];
      const trueQuality: Record<string, number> = {};
      const credentialQuality: Record<string, number> = {};
      for (const c of agentCaps) {
        trueQuality[c] = 0.3 + rng() * 0.5;
        if (withCredential) credentialQuality[c] = Math.round((0.25 + rng() * 0.6) * 100) / 100;
      }
      specs.push({
        id: `a${i}`,
        capabilities: agentCaps,
        trueCost: Math.round((0.8 + rng() * 1.2) * 10) / 10,
        trueQuality,
        capacity: 1 + Math.floor(rng() * 3),
        ...(withCredential ? { credentialQuality } : {}),
      });
    }
    const caps = Array.from({ length: taskCount }, () => pool[Math.floor(rng() * pool.length)]!);
    return { specs, caps };
  }

  /** 探针读 P(0)=Σp^VCG，取其 fraction 为预算（保证预算紧） */
  function tightBudget(specs: BatchAgentSpec[], caps: string[], fraction: number): number {
    const probe = new BatchVCGScheduler({ exploreCoefficient: 0, switchCostRate: 0 });
    for (const s of specs) probe.register(s);
    const atZero = probe.allocateBatch(caps, { budget: Infinity });
    return Math.max(0.5, Math.round(atZero.totalPayment * fraction * 10) / 10);
  }

  /** 镜像市场：与生产 solveWDP/solveWithPayments 数值路径同构的评估器（r18a ⑨ 互证），
   *  附带 MCF 冷解计数（生产类不暴露——镜像口径，诚实标注） */
  interface MirrorMarket {
    agentIds: string[];
    caps: string[];
    v: number[][];
    bid: number[];
    capacity: number[];
    eligible: boolean[][];
  }

  function mirrorOf(specs: BatchAgentSpec[], caps: string[]): MirrorMarket {
    return {
      agentIds: specs.map((s) => s.id),
      caps,
      v: specs.map((s) => caps.map((c) => 10 * (s.credentialQuality?.[c] ?? 0.5))),
      bid: specs.map((s) => s.trueCost),
      capacity: specs.map((s) => s.capacity),
      eligible: specs.map((s) => caps.map((c) => s.capabilities.includes(c))),
    };
  }

  function mirrorCounters(
    m: MirrorMarket,
    budget: number,
  ): {
    bisEval: number;
    secEval: number;
    bisMcf: number;
    secMcf: number;
    bisLambda: number;
    secLambda: number;
  } {
    let mcfRuns = 0;
    const solveWdpMirror = (
      lambda: number,
      excludeAgent: number | undefined,
    ): Array<{ t: number; a: number }> => {
      mcfRuns++;
      const agents = m.agentIds.map((id, i) => ({ id, i })).filter(({ i }) => i !== excludeAgent);
      const T = m.caps.length;
      const sink = 1 + agents.length + T;
      const mcf = new MinCostFlow(sink + 1);
      agents.forEach(({ i }, idx) => mcf.addEdge(0, 1 + idx, m.capacity[i]!, 0));
      const pairEdges: Array<{ ref: FlowEdgeRef; t: number; a: number }> = [];
      agents.forEach(({ i }, idx) => {
        for (let t = 0; t < T; t++) {
          if (!m.eligible[i]![t]!) continue;
          const score = m.v[i]![t]! - lambda - m.bid[i]!;
          if (score <= 0) continue;
          const ref = mcf.addEdge(1 + idx, 1 + agents.length + t, 1, -score);
          pairEdges.push({ ref, t, a: i });
        }
      });
      for (let t = 0; t < T; t++) mcf.addEdge(1 + agents.length + t, sink, 1, 0);
      mcf.run(0, sink);
      return pairEdges.filter((pe) => mcf.edgeOccupied(pe.ref)).map((pe) => ({ t: pe.t, a: pe.a }));
    };
    const welfareMirror = (pairs: Array<{ t: number; a: number }>, lambda: number): number => {
      let w = 0;
      for (const p of pairs) w += m.v[p.a]![p.t]! - lambda - m.bid[p.a]!;
      return w;
    };
    const totalPaymentMirror = (lambda: number): number => {
      const pairs = solveWdpMirror(lambda, undefined);
      const W = welfareMirror(pairs, lambda);
      const counts = new Map<number, number>();
      for (const p of pairs) counts.set(p.a, (counts.get(p.a) ?? 0) + 1);
      let total = 0;
      for (const a of counts.keys()) {
        const wWithout = welfareMirror(solveWdpMirror(lambda, a), lambda);
        total += m.bid[a]! * counts.get(a)! + (W - wWithout);
      }
      return total;
    };
    let lambdaMax = 1;
    for (let a = 0; a < m.agentIds.length; a++) {
      for (let t = 0; t < m.caps.length; t++) lambdaMax = Math.max(lambdaMax, m.v[a]![t]! + 1);
    }

    // secant 侧
    const secMark = mcfRuns;
    const sec = solveSecant({ evaluate: totalPaymentMirror, budget, lambdaMax });
    const secMcf = mcfRuns - secMark;
    const secLambda = sec.lambda;

    // bisection 侧（复刻 allocateBatch 的 62 评估结构）
    const bisMark = mcfRuns;
    let evaluations = 0;
    const P = (lambda: number): number => {
      evaluations++;
      return totalPaymentMirror(lambda);
    };
    let lo = 0;
    let hi = lambdaMax;
    P(hi);
    for (let iter = 0; iter < 60; iter++) {
      const mid = (lo + hi) / 2;
      if (P(mid) <= budget + TOL) hi = mid;
      else lo = mid;
    }
    const bisMcf = mcfRuns - bisMark;
    return {
      bisEval: evaluations,
      secEval: sec.evaluatedLambdas.length,
      bisMcf,
      secMcf,
      bisLambda: hi,
      secLambda,
    };
  }

  it('M1/M2/M3：两路径终局可行、secant 评估数 <62、福利逐位一致或归因于 λ 差异', () => {
    const markets = [
      { tag: 'M1', seed: 101, nAgents: 6, taskCount: 18, cred: false, frac: 0.55 },
      { tag: 'M2', seed: 202, nAgents: 10, taskCount: 30, cred: false, frac: 0.5 },
      { tag: 'M3', seed: 303, nAgents: 8, taskCount: 24, cred: true, frac: 0.6 },
    ];
    for (const mk of markets) {
      const { specs, caps } = buildSeededMarket(mk.seed, mk.nAgents, mk.taskCount, mk.cred);
      const budget = tightBudget(specs, caps, mk.frac);
      assert.ok(budget > 0 && Number.isFinite(budget), `${mk.tag}: 预算构造必须有效`);

      const bisect = new BatchVCGScheduler({ exploreCoefficient: 0, switchCostRate: 0 });
      for (const s of specs) bisect.register(s);
      const allocB = bisect.allocateBatch(caps, { budget });

      const secant = new BatchVCGScheduler({ exploreCoefficient: 0, switchCostRate: 0 });
      for (const s of specs) secant.register(s);
      const allocS = secant.allocateBatch(caps, { budget, lambdaSolver: 'secant' });

      assert.ok(
        allocB.totalPayment <= budget + 1e-6,
        `${mk.tag}: 二分终局支付 ${allocB.totalPayment} 应 ≤ B=${budget}`,
      );
      assert.ok(
        allocS.totalPayment <= budget + 1e-6,
        `${mk.tag}: secant 终局支付 ${allocS.totalPayment} 应 ≤ B=${budget}`,
      );
      const evals = allocS.lambdaEvaluations ?? Infinity;
      assert.ok(evals < 62, `${mk.tag}: secant 评估数 ${evals} 应 < 62`);
      // 福利逐位一致，或差异机器归因于 λ（secant 停在更保守的可行 λ）
      if (allocS.welfare !== allocB.welfare) {
        assert.ok(
          allocS.lambda > allocB.lambda + 1e-9,
          `${mk.tag}: 福利差异 ${allocS.welfare} vs ${allocB.welfare} 必须源于 secant λ=${allocS.lambda} > 二分 λ=${allocB.lambda}`,
        );
        assert.ok(
          allocS.droppedTasks >= allocB.droppedTasks,
          `${mk.tag}: λ 更大 ⟹ 弃标数 ${allocS.droppedTasks} ≥ ${allocB.droppedTasks}`,
        );
      }

      const mir = mirrorCounters(mirrorOf(specs, caps), budget);
      assert.ok(mir.secMcf < mir.bisMcf, `${mk.tag}: 镜像 MCF 冷解 secant < bisection`);

      // 账本原始行（console 机器输出，详册转录）
      console.log(
        `[AB] ${mk.tag} agents=${mk.nAgents} tasks=${mk.taskCount} cred=${mk.cred} B=${budget}`,
      );
      console.log(
        `[AB] ${mk.tag} bisection evals=62 lambda=${allocB.lambda} pay=${allocB.totalPayment} welfare=${allocB.welfare} dropped=${allocB.droppedTasks}`,
      );
      console.log(
        `[AB] ${mk.tag} secant    evals=${evals} lambda=${allocS.lambda} pay=${allocS.totalPayment} welfare=${allocS.welfare} dropped=${allocS.droppedTasks}`,
      );
      console.log(
        `[AB] ${mk.tag} mirror-mcf bisection=${mir.bisMcf} secant=${mir.secMcf} (mirror lambda bis=${mir.bisLambda.toFixed(9)} sec=${mir.secLambda.toFixed(9)})`,
      );
    }
  });
});
