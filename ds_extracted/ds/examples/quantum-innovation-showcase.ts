/**
 * quantum-innovation-showcase —— R14 创新波「九模块」外围演示（可独立运行）。
 *
 * 运行：`npx tsx examples/quantum-innovation-showcase.ts`（零依赖、零网络、
 * 零随机——除 BayesianHireBrain 的种子化 Mulberry32 流，同 seed 逐位可复现）。
 *
 * 依次演示 8 个 opt-in 新模块的核心能力（第 9 个 beta-distribution 是
 * Bayesian 雇佣大脑的数值内核，穿插演示并附独立对拍）：
 *   1. entanglement-batch-composer —— 纠缠感知批组成：基线切片 0 捕获 →
 *      局部搜索把可捕获耦合势从 0 提到 totalMass（100%）；
 *   2. min-cost-flow-potentials —— 位势对偶面（getPotentials/injectPotentials）
 *      + 同实例增量重解（新任务到达 → 负环消除）＝ 冷重建终态对拍；
 *   3. cross-backend-consensus —— 跨后端融合计数/Wilson 区间/Kendall
 *      tau-b/TVD 全套手工可核对数字；
 *   4. readout-mitigation —— MAP 解码（Hamming 最近合法分配）+ 似然加权
 *      的缓解频率（observedInvalidRate 0.20 的证据被重新归账）；
 *   5. bayesian-hire-brain —— Beta-Bernoulli 技能后验（CI/LCB）+ 三种
 *      雇佣策略（greedy/ucb1/thompson）的确定性对照；
 *   6. parameter-shift —— 两值谱精确移位梯度 vs 中心差分的误差对比 +
 *      支配性精修（目标值只降不升）；
 *   7. reserve-price-vcg —— 公开保留价的资格截除：efficiencyLoss 与
 *      excludedByReserve 的诚实核算；
 *   8. tool-capability-policy —— 按宿主授权/按调用点参数的最小权限裁决。
 *
 * 每步的断言失败即抛错退出非 0；全部通过则结尾打印「九模块清单」。
 */

import { composeBatches } from '../src/core/entanglement-batch-composer.js';
import { MinCostFlowPotentials } from '../src/core/min-cost-flow-potentials.js';
import { crossBackendConsensus } from '../src/core/qpu/cross-backend-consensus.js';
import { mapDecodeAssignment, mitigateReadout } from '../src/core/qpu/readout-mitigation.js';
import {
  betaCdf,
  betaQuantile,
  lgamma,
  logBeta,
} from '../src/proactive-intelligence/beta-distribution.js';
import { BayesianHireBrain } from '../src/proactive-intelligence/bayesian-hire-brain.js';
import {
  fullspaceLayerMixerGradient,
  perQubitShiftedBetas,
  refineAnglesByExactGradient,
  twoEigenvalueShift,
} from '../src/core/parameter-shift.js';
import { allocateWithReserve } from '../src/core/reserve-price-vcg.js';
import { ToolCapabilityPolicy } from '../src/tools/tool-capability-policy.js';
import type { AssignmentProblem } from '../src/core/quantum-optimizer.js';
import type { QpuSampleSet } from '../src/core/qpu/quantum-backend.js';
import type { EstimatorParams } from '../src/core/market-estimation.js';

// ----------------------------------------------------------------------------
// 小工具
// ----------------------------------------------------------------------------

function assert(condition: boolean, what: string): void {
  if (!condition) {
    throw new Error(`[showcase] 断言失败：${what}`);
  }
}

function near(a: number, b: number, tol: number, what: string): void {
  assert(Math.abs(a - b) <= tol, `${what}（|${a} − ${b}| ≤ ${tol} 不成立）`);
}

const fmt = (n: number, digits = 4): string => n.toFixed(digits);

function hr(title: string): void {
  console.log(`\n${'='.repeat(72)}\n${title}\n${'='.repeat(72)}`);
}

// ----------------------------------------------------------------------------
// 演示 1：纠缠感知批组成（entanglement-batch-composer）
// ----------------------------------------------------------------------------

function demoEntanglementBatchComposer(): void {
  hr('演示 1／纠缠批组成：基线切片丢耦合 → 局部搜索全额捕获');
  // 5 任务：t1↔t2 经纠缠 agent 对 (0,1) 耦合，t3↔t4 经 (2,3) 耦合，t5 孤立。
  // 耦合势 = bonus·min(pw) = 0.15·1.0 = 0.15 与 0.15·0.9 = 0.135。
  const tasks = [
    { id: 't1', priorityWeight: 1.0, eligibleAgents: [0] },
    { id: 't3', priorityWeight: 0.9, eligibleAgents: [2] },
    { id: 't5', priorityWeight: 0.5, eligibleAgents: [4] },
    { id: 't2', priorityWeight: 1.0, eligibleAgents: [1] },
    { id: 't4', priorityWeight: 0.9, eligibleAgents: [3] },
  ];
  const options = {
    entangledAgentPairs: [
      { a: 0, b: 1 },
      { a: 2, b: 3 },
    ],
    agentCount: 5,
    maxBatchSize: 3,
    entanglementBonus: 0.15,
  };

  const baseline = composeBatches(tasks, { ...options, improve: false });
  const improved = composeBatches(tasks, options);

  console.log(`基线切片批次      ：${JSON.stringify(baseline.batches)}`);
  console.log(
    `  capturedMass    = ${fmt(baseline.capturedMass)}（纠缠对 t1-t2 / t3-t4 被切进不同批，耦合永远进不了哈密顿量）`,
  );
  console.log(`改进批次          ：${JSON.stringify(improved.batches)}`);
  console.log(
    `  capturedMass    = ${fmt(improved.capturedMass)} / totalMass = ${fmt(improved.totalMass)}`,
  );
  console.log(`  movesApplied    = ${improved.movesApplied}，strategy = ${improved.strategy}`);

  near(improved.totalMass, 0.285, 1e-12, 'totalMass = 0.15 + 0.135');
  assert(baseline.capturedMass === 0, '基线切片捕获 0（结构性损失的演示锚点）');
  near(improved.capturedMass, improved.totalMass, 1e-12, '局部搜索捕获 100% 耦合势');
  assert(improved.movesApplied === 2, '恰两次单任务移动（t1→批2，t4→批1）');
  assert(improved.capturedMass >= baseline.capturedMass, '零遗憾性质：improved ≥ baseline');
  const flat = improved.batches.flat().sort();
  assert(
    JSON.stringify(flat) === JSON.stringify(['t1', 't2', 't3', 't4', 't5']),
    '批序列联 = 输入任务的排列（划分不变量）',
  );
}

// ----------------------------------------------------------------------------
// 演示 2：位势驱动的最小费用流（min-cost-flow-potentials）
// ----------------------------------------------------------------------------

/** 7 节点小实例：0=S，1/2=agent，3/4=任务，5=后到任务，6=T */
function buildFlow(instance: MinCostFlowPotentials): void {
  instance.addEdge(0, 1, 1, 0); // S → a1
  instance.addEdge(0, 2, 1, 0); // S → a2
  instance.addEdge(1, 3, 1, -5); // a1 → t1
  instance.addEdge(2, 3, 1, -3); // a2 → t1
  instance.addEdge(1, 4, 1, -2); // a1 → t2
  instance.addEdge(2, 4, 1, -4); // a2 → t2
  instance.addEdge(3, 6, 1, 0); // t1 → T
  instance.addEdge(4, 6, 1, 0); // t2 → T
}

function demoMinCostFlowPotentials(): void {
  hr('演示 2／位势流：对偶面读取 + 增量重解（负环消除）= 冷重建终态');
  // 初解：a1→t1(−5)、a2→t2(−4)，最优 flow=2 cost=−9
  const incremental = new MinCostFlowPotentials(7);
  buildFlow(incremental);
  const r1 = incremental.run(0, 6);
  console.log(`初解 run()        ：flow = ${r1.flow}, cost = ${r1.cost}（a1→t1, a2→t2）`);
  assert(r1.flow === 2 && r1.cost === -9, '初解 {flow:2, cost:−9}');
  const duals = incremental.getPotentials();
  assert(duals !== null && duals.length === 7, '对偶面可读出（7 节点位势）');
  console.log(`节点位势 π        ：[${duals!.map((p) => fmt(p, 2)).join(', ')}]`);
  console.log('  （SSP 对偶不变量：全部残量边归约费用 ≥ −1e-9）');

  // 新任务 t3 到达：a1→t3 费用 −6 比在位指派 a1→t1(−5) 更优 → 残量网络出现
  // 负环 a1→t3→T→(rev t1→T)→(rev a1→t1)：−6+0+0+5 = −1，环取消接管。
  incremental.addEdge(1, 5, 1, -6); // a1 → t3（新任务）
  incremental.addEdge(5, 6, 1, 0); // t3 → T
  const r2 = incremental.run(0, 6);
  const m = incremental.metrics();
  console.log(`增量 run()        ：flow = ${r2.flow}, cost = ${r2.cost}（环取消把 a1 换到 t3）`);
  console.log(
    `确定性计数        ：dijkstra=${m.dijkstraRuns}, bfPasses=${m.bellmanFordPasses}, ` +
      `repairs=${m.potentialRepairs}, cycleCancels=${m.cycleCancellations}, augments=${m.augmentations}`,
  );
  assert(r2.flow === 0, '源点已饱和：增量轮不再推进流量');
  assert(m.cycleCancellations >= 1, '新边诱发的负环被环取消消除');

  // 冷重建对拍：同拓扑全边集一次求解 —— 增量终态 = 冷重建终态
  const cold = new MinCostFlowPotentials(7);
  buildFlow(cold);
  cold.addEdge(1, 5, 1, -6);
  cold.addEdge(5, 6, 1, 0);
  const rc = cold.run(0, 6);
  console.log(`冷重建 run()      ：flow = ${rc.flow}, cost = ${rc.cost}（a1→t3, a2→t2）`);
  assert(r1.flow + r2.flow === rc.flow, '增量流量和 = 冷重建流量');
  near(r1.cost + r2.cost, rc.cost, 1e-9, '增量成本和 = 冷重建成本（{−9} + {−1} = {−10}）');

  // 对偶热启动跨实例迁移：把增量实例的位势注入第三张同拓扑冷图，注入后
  // 可行性无构造性保证，但修复后终态正确性不受影响（模块契约）。
  const warm = new MinCostFlowPotentials(7);
  buildFlow(warm);
  warm.addEdge(1, 5, 1, -6);
  warm.addEdge(5, 6, 1, 0);
  warm.injectPotentials(duals!);
  const rw = warm.run(0, 6);
  console.log(`位势注入后 run()  ：flow = ${rw.flow}, cost = ${rw.cost}（热启动修复后终态不变）`);
  assert(rw.flow === rc.flow, '注入热启动：流量与冷重建一致');
  near(rw.cost, rc.cost, 1e-9, '注入热启动：成本与冷重建一致');
}

// ----------------------------------------------------------------------------
// 共享的 2 任务 × 2 agent 分配问题（演示 3/4 共用）
// ----------------------------------------------------------------------------

// 注意容量契约：本编码每 agent 至多一任务（isValidAssignment 强制 no-reuse），
// 故合法分配只有 [0,1]（welfare 9）与 [1,0]（welfare 5）——[0,0]/[1,1] 非法。
const problem: AssignmentProblem = {
  taskIds: ['task-a', 'task-b'],
  agentIds: ['agent-x', 'agent-y'],
  weights: [
    [5, 3],
    [2, 4],
  ],
  ineligible: [
    [false, false],
    [false, false],
  ],
  couplings: new Map(),
  penaltyOneHot: 8,
  penaltyCapacity: 8,
};

/** 分配 → 自旋向量（z = −1 ↔ 选中；逐任务 one-hot） */
function spinsOf(assignment: number[]): number[] {
  const spins: number[] = [];
  for (const a of assignment) {
    for (let j = 0; j < 2; j++) spins.push(j === a ? -1 : 1);
  }
  return spins;
}

// ----------------------------------------------------------------------------
// 演示 3：跨后端共识（cross-backend-consensus）
// ----------------------------------------------------------------------------

function demoCrossBackendConsensus(): void {
  hr('演示 3／跨后端共识：融合计数 + Wilson 区间 + tau-b + TVD');
  const exact: QpuSampleSet = {
    spins: [spinsOf([0, 1]), spinsOf([1, 0]), [-1, -1, 1, -1]],
    energies: [-9, -5, 0],
    occurrences: [90, 6, 4],
    solver: 'showcase-exact',
    realHardware: false,
  };
  const noisy: QpuSampleSet = {
    spins: [spinsOf([0, 1]), spinsOf([1, 0]), [1, 1, 1, 1]],
    energies: [-9, -5, 0],
    occurrences: [55, 25, 20],
    solver: 'showcase-noisy-qpu',
    realHardware: false,
  };
  const result = crossBackendConsensus(problem, [
    { backend: 'exact', samples: exact },
    { backend: 'noisy', samples: noisy },
  ]);

  console.log(`共识胜者          ：[${result.assignment.join(',')}]，welfare = ${result.welfare}`);
  console.log(
    `融合计数          ：胜者 ${result.fusedOccurrences} / 总 ${result.totalOccurrences} 次，` +
      `频率 = ${fmt(result.fusedFrequency, 3)}`,
  );
  console.log(
    `胜者频率 Wilson95 ：[${fmt(result.fusedFrequencyWilson.low, 3)}, ${fmt(result.fusedFrequencyWilson.high, 3)}]`,
  );
  for (const b of result.perBackend) {
    console.log(
      `  ${b.backend.padEnd(5)} valid=${b.validOccurrences} invalid=${b.invalidOccurrences} ` +
        `top=[${b.topAssignment?.join(',') ?? '∅'}] topFreq=${fmt(b.topFrequency, 2)} ` +
        `consensusShare=${fmt(b.consensusShare, 3)} agree=${b.agreesWithConsensus}`,
    );
  }
  const p = result.pairwise[0];
  if (p === undefined) throw new Error('[showcase] 断言失败：两后端输入必有 pairwise 统计');
  console.log(
    `两两一致性        ：tau-b = ${fmt(p.kendallTauB ?? Number.NaN, 4)}，TVD = ${fmt(p.totalVariation ?? Number.NaN, 4)}`,
  );

  // 手工核对锚：welfare[0,1]=5+4=9 为唯一最大；融合 90+55=145/200=0.725；
  // exact 顶层频率 90/100=0.9；tau-b：唯一候选对同序 → +1；
  // TVD = 0.5·(|90/96−55/80| + |6/96−25/80|) = 0.5·(0.25+0.25) = 0.25。
  assert(JSON.stringify(result.assignment) === '[0,1]', '共识胜者 = [0,1]（welfare 9）');
  assert(result.fusedOccurrences === 145 && result.totalOccurrences === 200, '融合计数 145/200');
  near(result.fusedFrequency, 0.725, 1e-12, '融合频率 0.725');
  assert(result.perBackend[0]!.topFrequency === 0.9, 'exact 顶层频率 0.9');
  assert(result.perBackend[1]!.invalidOccurrences === 20, 'noisy 非法样本 20');
  near(p.kendallTauB ?? 0, 1, 1e-12, 'tau-b = +1（唯一候选对同序，无并列）');
  near(p.totalVariation ?? 0, 0.25, 1e-12, 'TVD = 0.25');
  assert(!result.disagreement, '两后端顶层均与共识一致');
}

// ----------------------------------------------------------------------------
// 演示 4：读出误差缓解（readout-mitigation）
// ----------------------------------------------------------------------------

function demoReadoutMitigation(): void {
  hr('演示 4／读出缓解：MAP 解码 + 似然加权归账（闸门丢弃的证据被回收）');
  // 真值 [0,1]；s2/s3 各翻转一比特 → naive 解码成非法样本（one-hot 违约）
  const s1 = spinsOf([0, 1]);
  const s2 = [-1, 1, 1, 1]; // task-b 块无选中
  const s3 = [-1, 1, -1, -1]; // task-b 块双选中
  const flipProb = 0.05;

  const map2 = mapDecodeAssignment(problem, s2);
  console.log(
    `MAP 解码 s2       ：[${map2.assignment.join(',')}]，Hamming 距离 = ${map2.hammingDistance}`,
  );
  assert(map2.hammingDistance === 1, '单比特翻转的 MAP 距离 = 1');
  assert(JSON.stringify(map2.assignment) === '[0,1]', 'MAP 解码恢复真值 [0,1]（匈牙利精确解）');

  const report = mitigateReadout(
    problem,
    {
      spins: [s1, s2, s3],
      energies: [-9, -9, -9],
      occurrences: [80, 12, 8],
      solver: 'showcase',
      realHardware: false,
    },
    flipProb,
  );
  console.log(
    `总读数            ：${report.totalReads}，observedInvalidRate = ${fmt(report.observedInvalidRate, 2)}`,
  );
  for (const c of report.candidates) {
    console.log(
      `  候选 [${c.assignment.join(',')}]  naive=${fmt(c.naiveCount, 1)}  ` +
        `mitigated=${fmt(c.mitigatedCount, 3)}  freq=${fmt(c.mitigatedFrequency, 3)}  ` +
        `meanD=${c.meanHammingDistance === null ? 'null' : fmt(c.meanHammingDistance, 3)}`,
    );
  }
  console.log(
    `质量回收率 recoveredMass = ${fmt(report.recoveredMass, 3)}（支撑外质量如实上报，不冒充 1）`,
  );

  // 手工核对锚：[0,1] 的缓解计数 = 80·0.95⁴ + 12·(0.05·0.95³) + 8·(0.05·0.95³)
  //            = 65.1605 + 0.5145 + 0.343 = 66.018
  const top = report.candidates[0]!;
  assert(JSON.stringify(top.assignment) === '[0,1]', '缓解后顶层候选 = 真值 [0,1]');
  near(top.mitigatedCount, 66.018, 1e-3, '[0,1] 缓解计数 ≈ 66.018');
  assert(report.observedInvalidRate === 0.2, '闸门口径非法率 = 0.20');
  assert(top.naiveCount === 80, 'naive 计数与闸门口径可对读');
}

// ----------------------------------------------------------------------------
// 演示 5：Bayesian 雇佣大脑（bayesian-hire-brain + beta-distribution 内核）
// ----------------------------------------------------------------------------

const ROUNDS = 20;

/** 各 agent 的真成功率（演示的模拟结算口径）：alice 75% / bob 50% / carol 25% */
function settles(id: string, round: number): boolean {
  switch (id) {
    case 'alice':
      return round % 4 !== 3;
    case 'bob':
      return round % 2 === 0;
    default:
      return round % 4 === 0;
  }
}

function runHire(
  policy: 'greedy' | 'ucb1' | 'thompson',
  seed: number,
): { netWelfare: number; settled: number; topSkill: string } {
  const brain = new BayesianHireBrain({ taskValue: 10, priorWeight: 3, policy, seed });
  brain
    .registerAgent({
      id: 'alice',
      capabilities: ['translate'],
      trueCost: 3,
      credentialQuality: { translate: 0.85 },
    })
    .registerAgent({
      id: 'bob',
      capabilities: ['translate'],
      trueCost: 2,
      credentialQuality: { translate: 0.6 },
    })
    .registerAgent({
      id: 'carol',
      capabilities: ['translate'],
      trueCost: 1,
      credentialQuality: { translate: 0.4 },
    });
  let settled = 0;
  for (let r = 0; r < ROUNDS; r++) {
    const a = brain.submitTask('translate');
    if (a === null) continue; // 免费处置：thompson 抽样低谷时估值不抵报价
    if (a.winnerId === undefined) {
      throw new Error('[showcase] 断言失败：成交分配必带 winnerId');
    }
    brain.settleTask(a.taskId, settles(a.winnerId, r));
    settled++;
  }
  const state = brain.getState();
  const alice = state.agents[0]!;
  const sk = alice.skills[0]!;
  return {
    netWelfare: state.netWelfare,
    settled,
    topSkill:
      `alice 后验 α=${fmt(sk.alpha, 2)} β=${fmt(sk.beta, 2)} mean=${fmt(sk.mean, 3)} ` +
      `CI95=[${fmt(sk.ci95[0], 3)}, ${fmt(sk.ci95[1], 3)}] LCB(τ=0.9)=${fmt(sk.lcb, 3)}`,
  };
}

function demoBayesianHireBrain(): void {
  hr('演示 5／Bayesian 雇佣大脑：技能后验区间 + 三策略对照（同结算流）');
  const greedy = runHire('greedy', 42);
  const ucb1 = runHire('ucb1', 42);
  const thompson = runHire('thompson', 42);
  console.log(
    `greedy   ：netWelfare = ${fmt(greedy.netWelfare, 2)}，结算 ${greedy.settled}/${ROUNDS}`,
  );
  console.log(`ucb1     ：netWelfare = ${fmt(ucb1.netWelfare, 2)}，结算 ${ucb1.settled}/${ROUNDS}`);
  console.log(
    `thompson ：netWelfare = ${fmt(thompson.netWelfare, 2)}，结算 ${thompson.settled}/${ROUNDS}`,
  );
  console.log(greedy.topSkill);
  assert(greedy.settled === ROUNDS && ucb1.settled === ROUNDS, '确定性策略 20 轮全部成交');
  assert(
    greedy.netWelfare >= ucb1.netWelfare - 1e-9,
    '本实例贪心后验均值 ≥ UCB1（exploit 占优的设定）',
  );

  // beta-distribution 内核对拍（第 9 个模块的独立锚点）
  const q = betaQuantile(0.9, 3, 2);
  near(betaCdf(q, 3, 2), 0.9, 1e-9, 'betaQuantile/betaCdf 逆元往返');
  near(lgamma(5), Math.log(24), 1e-10, 'lgamma(5) = ln 4!');
  near(logBeta(2, 3), Math.log(1 / 12), 1e-10, 'logBeta(2,3) = ln B(2,3) = ln(1/12)');
  console.log(
    `beta 内核         ：lgamma(5)=${fmt(lgamma(5), 6)}，logBeta(2,3)=${fmt(logBeta(2, 3), 6)}，Q_{0.9}(3,2)=${fmt(q, 4)} ✓`,
  );
}

// ----------------------------------------------------------------------------
// 演示 6：参数移位梯度（parameter-shift）
// ----------------------------------------------------------------------------

function demoParameterShift(): void {
  hr('演示 6／参数移位：精确两点梯度 vs 中心差分 + 支配性精修');
  // 单比特 |0⟩ 经 e^{−iβX} 后 ⟨Z⟩ = cos 2β（X 生成元谱 {+1,−1}，Δ=2）——
  // 两点移位对该目标**精确**，中心差分只有 O(h²) 收敛。
  const f = (beta: number): number => Math.cos(2 * beta);
  const beta0 = 0.3;
  const evaluate = (angles: readonly number[]): number => f(angles[0]!);
  const shiftGrad = twoEigenvalueShift(evaluate, [beta0], { index: 0, gap: 2 });
  const analytic = -2 * Math.sin(2 * beta0);
  const h = 0.1;
  const cdGrad = (f(beta0 + h) - f(beta0 - h)) / (2 * h);
  console.log(`β₀ = ${beta0} 处 ∂⟨Z⟩/∂β：`);
  console.log(
    `  精确移位   = ${fmt(shiftGrad, 12)}  |误| = ${fmt(Math.abs(shiftGrad - analytic), 2)}`,
  );
  console.log(
    `  中心差分   = ${fmt(cdGrad, 6)}  |误| = ${fmt(Math.abs(cdGrad - analytic), 6)}（h=${h} 的 O(h²) 截断）`,
  );
  near(shiftGrad, analytic, 1e-12, '移位梯度与解析导数逐位一致');
  assert(Math.abs(cdGrad - analytic) > 1e-4, '中心差分误差可见（对比锚点）');

  // 逐比特移位副本 + layer 模式求和梯度（对易分解 + 链式法则，仍精确）
  const betas = [beta0, beta0 + 0.1, beta0 - 0.1];
  const layer = (bs: readonly number[]): number => bs.reduce((acc, b) => acc + f(b), 0);
  const layerGrad = fullspaceLayerMixerGradient(
    (qubit, delta) => layer(perQubitShiftedBetas(betas, qubit, delta)),
    betas.length,
  );
  const layerAnalytic = betas.reduce((acc, b) => acc - 2 * Math.sin(2 * b), 0);
  near(layerGrad, layerAnalytic, 1e-12, 'layer 模式逐比特求和梯度精确');

  // 种子化精修（支配性：目标只降不升）
  const objective = (angles: readonly number[]): number => f(angles[0]!) + 0.5 * f(angles[1]!);
  const seed = [0.3, 0.2];
  const refined = refineAnglesByExactGradient(
    (a) => objective(a),
    seed,
    [Math.PI, Math.PI],
    [
      { index: 0, gap: 2 },
      { index: 1, gap: 2 },
    ],
  );
  console.log(
    `精修              ：seed → angles = [${refined.angles.map((a) => fmt(a, 4)).join(', ')}]，` +
      `value ${fmt(objective(seed), 4)} → ${fmt(refined.value, 6)}（最优 −1.5，evals=${refined.evaluations}）`,
  );
  assert(refined.value <= objective(seed), '支配性：精修目标 ≤ 种子');
  assert(refined.improved && refined.value < -1.49, '精修逼近全空间最优 −1.5');
}

// ----------------------------------------------------------------------------
// 演示 7：保留价 VCG（reserve-price-vcg）
// ----------------------------------------------------------------------------

function demoReservePriceVcg(): void {
  hr('演示 7／保留价 VCG：报价 > 保留价 ⇒ 资格截除（精确 DSIC 保持）');
  const params: EstimatorParams = {
    priorQuality: 0.5,
    priorWeight: 3,
    exploreCoefficient: 0.1,
    switchCostRate: 0,
    successValue: 10,
  };
  const recordOf = (trueCost: number, credentialQuality?: Record<string, number>) => ({
    spec: credentialQuality === undefined ? { trueCost } : { trueCost, credentialQuality },
    attempts: new Map<string, number>(),
    successes: new Map<string, number>(),
    capital: new Map<string, number>(),
  });
  const agents = [
    { id: 'atlas', capabilities: ['translate'], capacity: 2, record: recordOf(2) },
    { id: 'bohr', capabilities: ['translate'], capacity: 2, record: recordOf(4) },
    {
      id: 'costly',
      capabilities: ['translate', 'audit'],
      capacity: 1,
      record: recordOf(9, { audit: 0.95 }),
    },
  ];
  const capabilities = ['translate', 'translate', 'audit'];
  const result = allocateWithReserve(agents, capabilities, params, 5);

  console.log(`保留价 = 5        ：atlas 报 2、bohr 报 4（准入），costly 报 9（> 5，整体截除）`);
  for (const a of result.assignments) {
    console.log(
      `  ${a.taskId} → ${a.agentId}（${a.capability}），paymentShare = ${fmt(a.paymentShare, 3)}`,
    );
  }
  console.log(
    `atlas pivot 支付  ：${fmt(result.payments['atlas'] ?? 0, 2)}（Clarke 项按无 atlas 世界算——保留价在那个世界同样生效，costly 全截除）`,
  );
  console.log(
    `welfare           ：${fmt(result.welfare, 2)}（无保留价上界 ${fmt(result.maxWelfareNoReserve, 2)}）`,
  );
  console.log(
    `诚实核算          ：efficiencyLoss = ${fmt(result.efficiencyLoss, 2)}，droppedTasks = ${result.droppedTasks}，` +
      `excludedByReserve = ${result.excludedByReserve}，platformTake = ${fmt(result.platformTake, 2)}`,
  );

  // 手工核对锚：audit 只有 costly 能做且报价 9 > 5 → 被截除 → droppedTasks=1；
  // 两件 translate 全给 atlas（截除域最优）；无保留价时 costly 以 v−b=0.5 中标
  // audit → efficiencyLoss = 0.5；excludedByReserve 按任务槽计：(costly,t1)、
  // (costly,t2)、(costly,audit) = 3；atlas 反事实世界保留价同样生效（costly
  // 全截除），φ₋ = bohr×2(1+1) = 2，pay = 2×2 + (6 − 2) = 8。
  assert(result.droppedTasks === 1, 'audit 任务因保留价落空');
  assert(result.excludedByReserve === 3, '截除 (costly,t1)、(costly,t2)、(costly,audit) 三槽');
  assert(result.welfare === 6, '截除域福利 = (5−2)×2 = 6');
  near(result.maxWelfareNoReserve, 6.5, 1e-9, '无保留价上界 = 6 + 0.5 = 6.5');
  near(result.efficiencyLoss, 0.5, 1e-9, '效率损失如实上报 0.5');
  near(result.totalPayment, 8, 1e-9, 'atlas pivot 支付 = 4 + (6 − 2) = 8');
}

// ----------------------------------------------------------------------------
// 演示 8：工具能力策略（tool-capability-policy）
// ----------------------------------------------------------------------------

function demoToolCapabilityPolicy(): void {
  hr('演示 8／工具能力策略：按宿主授权 × 按调用点参数的最小权限裁决');
  const policy = new ToolCapabilityPolicy([
    'fs.read:/tmp/quantum-showcase',
    'cmd:node',
    'net:api.example.com',
    'subagent',
  ]);
  policy.registerTool({
    toolName: 'read_file',
    capabilities: [{ kind: 'fs.read', param: 'path' }],
  });
  policy.registerTool({
    toolName: 'spawn',
    capabilities: [{ kind: 'cmd', param: 'program' }],
  });
  policy.registerTool({
    toolName: 'fetch',
    capabilities: [{ kind: 'net', param: 'host' }],
  });
  policy.registerTool({ toolName: 'delegate', capabilities: [{ kind: 'subagent' }] });

  const cases: Array<[string, Record<string, string>]> = [
    ['read_file', { path: '/tmp/quantum-showcase/data.json' }],
    ['read_file', { path: 'C:\\Windows\\system32\\config.sys' }],
    ['spawn', { program: 'node' }],
    ['spawn', { program: 'powershell' }],
    ['fetch', { host: 'v2.api.example.com' }],
    ['fetch', { host: 'evil-api.example.com' }],
    ['delegate', {}],
    ['shell', { cmd: 'rm -rf /' }],
  ];
  for (const [tool, params] of cases) {
    const d = policy.checkCall(tool, params);
    console.log(
      `${d.allowed ? '允许' : '拒绝'}  ${tool.padEnd(10)} ${JSON.stringify(params)}` +
        `${d.allowed ? '' : `  ← ${d.reason}`}`,
    );
  }
  assert(
    policy.checkCall('read_file', { path: '/tmp/quantum-showcase/data.json' }).allowed,
    '授权目录内读取',
  );
  assert(
    !policy.checkCall('read_file', { path: 'C:\\Windows\\system32\\config.sys' }).allowed,
    '授权目录外读取被拒',
  );
  assert(policy.checkCall('fetch', { host: 'v2.api.example.com' }).allowed, '子域点锚匹配');
  assert(
    !policy.checkCall('fetch', { host: 'evil-api.example.com' }).allowed,
    "evil-api 不匹配 'api.example.com' 后缀",
  );
  assert(!policy.checkCall('spawn', { program: 'powershell' }).allowed, '未授权程序被拒');
  assert(!policy.checkCall('shell', { cmd: 'rm -rf /' }).allowed, '未声明工具 default-deny');
  assert(policy.checkCall('delegate', {}).allowed, 'subagent 静态授权');
}

// ----------------------------------------------------------------------------
// 九模块清单
// ----------------------------------------------------------------------------

function printModuleList(): void {
  hr('九模块清单（R14 创新波 · 全部 opt-in，零接触默认路径）');
  const rows: Array<[string, string, string]> = [
    [
      '1',
      'src/core/entanglement-batch-composer.ts',
      '纠缠感知批组成：把跨轮纠缠对的耦合福利从结构性丢弃中抢回（演示 1）',
    ],
    [
      '2',
      'src/core/min-cost-flow-potentials.ts',
      '位势最小费用流：对偶面读写 + 同实例增量重解 + 负环安全（演示 2）',
    ],
    [
      '3',
      'src/core/qpu/cross-backend-consensus.ts',
      '跨后端共识：融合计数、Wilson 区间、tau-b/TVD 交叉验证（演示 3）',
    ],
    [
      '4',
      'src/core/qpu/readout-mitigation.ts',
      '读出缓解：Hamming MAP 解码 + 似然加权的频率重归账（演示 4）',
    ],
    [
      '5',
      'src/proactive-intelligence/beta-distribution.ts',
      'Beta 数值内核：lgamma/CDF/分位数，零依赖纯函数（演示 5 内核+对拍）',
    ],
    [
      '6',
      'src/proactive-intelligence/bayesian-hire-brain.ts',
      'Bayesian 雇佣大脑：技能后验区间 + 三策略对照（演示 5）',
    ],
    [
      '7',
      'src/tools/tool-capability-policy.ts',
      '工具能力策略：宿主授权×调用点参数的最小权限裁决（演示 8）',
    ],
    ['8', 'src/core/parameter-shift.ts', '参数移位：两值谱精确梯度 + 支配性精修（演示 6）'],
    [
      '9',
      'src/core/reserve-price-vcg.ts',
      '保留价 VCG：公开报价上限的资格截除，保持精确 DSIC（演示 7）',
    ],
  ];
  for (const [n, path, what] of rows) {
    console.log(`  ${n}. ${path}\n     ${what}`);
  }
  console.log('\n全部断言通过，演示退出码 0。');
}

// ----------------------------------------------------------------------------

function main(): void {
  console.log('quantum-innovation-showcase —— R14 创新波九模块外围演示');
  demoEntanglementBatchComposer();
  demoMinCostFlowPotentials();
  demoCrossBackendConsensus();
  demoReadoutMitigation();
  demoBayesianHireBrain();
  demoParameterShift();
  demoReservePriceVcg();
  demoToolCapabilityPolicy();
  printModuleList();
}

main();
