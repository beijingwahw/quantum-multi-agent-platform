/**
 * quantum-innovation-showcase —— R14 创新波「九模块」+ R18 创新波「七模块」外围演示（可独立运行）。
 *
 * 运行：`npx tsx examples/quantum-innovation-showcase.ts`（零依赖、零网络、
 * 零随机——除 BayesianHireBrain 与 R18 序贯段的种子化 Mulberry32 流，
 * 同 seed 逐位可复现）。
 *
 * 依次演示 8 个 R14 opt-in 新模块的核心能力（第 9 个 beta-distribution 是
 * Bayesian 雇佣大脑的数值内核，穿插演示并附独立对拍）：
 *   1. entanglement-batch-composer —— 纠缠感知批组成：基线切片 0 捕获 →
 *      局部搜索把可捕获耦合势从 0 提到 totalMass（100%）；
 *   2. min-cost-flow-potentials —— 位势对偶面（getPotentials/injectPotentials）
 *      + 同实例增量重解（新任务到达 → 负环消除）＝ 冷重建终态对拍；
 *   3. cross-backend-consensus —— 跨后端融合计数/Wilson 区间/Kendall
 *      tau-b/TVD 全套手工可核对数字；
 *   4. readout-mitigation —— MAP 解码（Hamming 最近合法分配）+ 似然加权
 *      的缓解频率（observedInvalidRate 0.20 的证据被重新归账）；
 *   5. bayesian-hire-brain —— Beta-Bernoulli 技能后验（CI/LCB）+ 四种
 *      雇佣策略（greedy/ucb1/thompson/portfolio-Hedge）的确定性对照；
 *   6. parameter-shift —— 两值谱精确移位梯度 vs 中心差分的误差对比 +
 *      支配性精修（目标值只降不升）；
 *   7. reserve-price-vcg —— 公开保留价的资格截除：efficiencyLoss 与
 *      excludedByReserve 的诚实核算；
 *   8. tool-capability-policy —— 按宿主授权/按调用点参数的最小权限裁决。
 *
 * R18 创新波七模块（演示 9–15，全部只读模块公开 API 组合，不改任何
 * src/ 文件；每段打印主张名＋机器算出的证据数字）：
 *   9.  shadow-price-secant —— 影子价格割线：仿射段内一步命中
 *       （3 次评估 vs 60 轮二分 61 次）；
 *   10. noise-aware-backend-selector —— 保持率闭式（端点双锚 + 单调性）
 *       + Beta 优势概率精确有限和（对称恒等式 + 数值积分对拍）+ 后验回灌；
 *   11. commutation-ft —— Kőnig 精确构造（二部图零缺口）+ 调度形状
 *       （E=70、Δ=8）+ FT 画像缩减（T 计数逐字节不变）；
 *   12. sprt-calibration-gate —— 序贯停止（学习流检出）+ 截断族
 *       第一类误差界（null 扫描机器复证）；
 *   13. evidence-gated-exploration —— 包络/预算证书（望远镜求和）+
 *       门控断流联合仿真（判后恒 0、节省比）；
 *   14. gamma-spectrum-buyout —— DFT 系数精确恢复 + Lipschitz 证书
 *       夹逼真极小 + 支配性精修；
 *   15. pending-reachability —— 挂起任务三分类（零错杀刻画 + 证人集）。
 *
 * 每步的断言失败即抛错退出非 0；全部通过则结尾打印「十六模块清单」
 * 与 R18 各段的证据数字总对照行。
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
// R18 创新波七模块（只读公开 API 组合）
import { solveSecant } from '../src/core/shadow-price-secant.js';
import {
  betaAdvantageProbability,
  NoiseAwareBackendSelector,
  oneHotRetentionRate,
} from '../src/core/qpu/noise-aware-backend-selector.js';
import { parallelEstimateFtCircuit, parallelizeLayer } from '../src/core/qpu/commutation-ft.js';
import type { CouplingEdge } from '../src/core/qpu/commutation-ft.js';
import { surfaceCode } from '../src/core/qpu/ft-estimate.js';
import {
  SprtCalibrationGate,
  sprtTypeOneUpperBound,
} from '../src/proactive-intelligence/sprt-calibration-gate.js';
import {
  EvidenceGatedExploration,
  ExplorationBudgetLedger,
  explorationBudgetBound,
  sigmaBound,
} from '../src/proactive-intelligence/evidence-gated-exploration.js';
import {
  analyzeGammaSpectrum,
  buyoutGammaCurve,
  gammaCurveDerivativeAt,
  gammaCurveValueAt,
  minimizeGammaCurve,
  refineGammaByTrigBuyout,
} from '../src/core/gamma-spectrum-buyout.js';
import { classifyPendingBucket } from '../src/core/pending-reachability.js';
import { mulberry32 } from '../src/utils/rng.js';

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

/** R18 各段的证据数字总对照行素材（printSummaryLine 末尾统一打印） */
const r18Summary: string[] = [];

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
  policy: 'greedy' | 'ucb1' | 'thompson' | 'portfolio',
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
  hr('演示 5／Bayesian 雇佣大脑：技能后验区间 + 三策略与 Hedge 组合对照（同结算流）');
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
  // R17-D：portfolio = 对三成员跑 Hedge（乘性权重，缺省 η=0.1，奖励规范化
  // 到 [0,1]）——「处处近最优」的展演证据：同一构造下不劣于最优单策略
  // 超过经典界 (ln K/η + ηT/2)·taskValue（Freund-Schapire 1997）
  const portfolio = runHire('portfolio', 42);
  const hedgeBudget = (Math.log(3) / 0.1 + (0.1 * portfolio.settled) / 2) * 10; // K=3, η=0.1, T=结算数, V=10
  console.log(
    `portfolio：netWelfare = ${fmt(portfolio.netWelfare, 2)}，结算 ${portfolio.settled}/${ROUNDS}` +
      `（≥ greedy − Hedge 界 ${fmt(hedgeBudget, 2)}）`,
  );
  console.log(greedy.topSkill);
  assert(greedy.settled === ROUNDS && ucb1.settled === ROUNDS, '确定性策略 20 轮全部成交');
  assert(
    greedy.netWelfare >= ucb1.netWelfare - 1e-9,
    '本实例贪心后验均值 ≥ UCB1（exploit 占优的设定）',
  );
  assert(
    portfolio.netWelfare >= greedy.netWelfare - hedgeBudget - 1e-9,
    'portfolio（Hedge 组合）≥ greedy − 界：处处近最优',
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
// 演示 9：影子价格割线（shadow-price-secant，R18-A）
// ----------------------------------------------------------------------------

function demoShadowPriceSecant(): void {
  hr('演示 9／影子价格割线：仿射段内一步命中（3 次评估 vs 二分 61 次）');
  // 纯仿射评估器 P(λ)=30−6λ：P(0)=30 > B=12 ≥ P(4)=6（λmax 契约成立，
  // 仿射段覆盖全区间——一步命中定理的前提）。
  const P = (lambda: number): number => 30 - 6 * lambda;
  const budget = 12;
  const lambdaMax = 4;
  const r = solveSecant({ evaluate: P, budget, lambdaMax });
  // 闭式理论割线点：λ̂ = (P(0)−B)·λmax/(P(0)−P(λmax)) = 18·4/24 = 3
  const theory = ((P(0) - budget) * lambdaMax) / (P(0) - P(lambdaMax));
  console.log(
    `评估轨迹          ：[${r.evaluatedLambdas.map((l) => fmt(l, 6)).join(', ')}]（λ=0 → λmax → 割线点）`,
  );
  console.log(
    `一步命中          ：λ̂ = ${fmt(r.lambda, 9)}（闭式理论 ${fmt(theory, 9)}），` +
      `实测支付 P(λ̂) = ${fmt(r.payment, 9)} vs 预算 ${budget}，exactHit = ${r.exactHit}`,
  );
  // 内联 60 轮二分对照（batch-VCG λ-bisection 的同口径参照）
  let evals = 1;
  P(0);
  let lo = 0;
  let hi = lambdaMax;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    evals++;
    if (P(mid) > budget) lo = mid;
    else hi = mid;
  }
  console.log(
    `二分参照          ：60 轮 = ${evals} 次评估（割线 ${r.evaluatedLambdas.length} 次——` +
      `预算紧路径每轮 ≈ 一次 MCF 冷解，仿射段上省 ${evals - r.evaluatedLambdas.length} 次）`,
  );
  // 预算不紧短路：B=100 ≥ P(0)，1 次评估即返回 λ=0
  const slack = solveSecant({ evaluate: P, budget: 100, lambdaMax });
  console.log(
    `slackAtZero 短路  ：B=100 → λ=0，${slack.evaluatedLambdas.length} 次评估（预算不紧不进搜索）`,
  );
  r18Summary.push(
    `secant：仿射段 3 评估命中 |P−B|=${Math.abs(r.payment - budget).toExponential(1)}（二分 61 次）`,
  );
  assert(r.evaluatedLambdas.length === 3, '仿射评估器恰 3 次评估（0、λmax、割线点）');
  assert(r.exactHit && Math.abs(r.payment - budget) <= 1e-9, '第 3 次评估命中预算（|P−B| ≤ 1e-9）');
  near(r.lambda, 3, 1e-9, 'λ̂ = 闭式理论值 3（段内单调不增 ⟹ 最小可行 λ）');
  assert(slack.slackAtZero && slack.evaluatedLambdas.length === 1, '不紧预算 1 次评估短路');
}

// ----------------------------------------------------------------------------
// 演示 10：噪声感知后端选择器（noise-aware-backend-selector，R18-B）
// ----------------------------------------------------------------------------

function demoNoiseAwareBackendSelector(): void {
  hr('演示 10／噪声感知后端选择：保持率闭式 + 精确优势概率 + 后验回灌');
  // 定理 1 闭式与端点双锚
  const q = oneHotRetentionRate(3, 4, 0.07);
  const qHalf = oneHotRetentionRate(2, 3, 0.5);
  console.log(
    `定理 1 保持率     ：q_{m=3,n=4}(f=0.07) = ${fmt(q, 6)}（块因子 ` +
      `${fmt(Math.pow(0.93, 4) + 3 * 0.0049 * Math.pow(0.93, 2), 6)} 的 3 次幂）`,
  );
  console.log(
    `端点双锚          ：f=0 → ${fmt(oneHotRetentionRate(3, 4, 0), 1)}（无噪恒保持）；` +
      `f=1/2, m=2, n=3 → (3·2⁻³)² = ${fmt(qHalf, 6)}（均匀读出直接计数两条独立推导同值）`,
  );
  near(oneHotRetentionRate(3, 4, 0), 1, 0, 'f=0 端点 q=1');
  near(qHalf, 0.140625, 1e-12, 'f=1/2 端点 = (n·2⁻ⁿ)^m = 0.140625');
  // 定理 1' 单调性：f ∈ [0, 0.5] 50 格点机器验证
  let maxRise = 0;
  let prev = oneHotRetentionRate(3, 4, 0);
  for (let i = 1; i <= 50; i++) {
    const cur = oneHotRetentionRate(3, 4, i / 100);
    maxRise = Math.max(maxRise, cur - prev);
    prev = cur;
  }
  console.log(
    `定理 1' 单调性    ：50 格点最大上升 = ${fmt(maxRise, 3)}（≤ 0，解析证明的机器回声）`,
  );
  assert(maxRise <= 1e-15, 'q(f) 在 [0,0.5] 单调不增');

  // 定理 3：对称恒等式 + 独立数值积分对拍（复化中点，避开端点奇异性）
  const a1 = 13;
  const b1 = 1;
  const a2 = 3;
  const b2 = 9;
  const pAB = betaAdvantageProbability(a1, b1, a2, b2);
  const pBA = betaAdvantageProbability(a2, b2, a1, b1);
  const lB = logBeta(a1, b1);
  const fX = (x: number): number =>
    Math.exp((a1 - 1) * Math.log(x) + (b1 - 1) * Math.log(1 - x) - lB);
  const MID = 2000;
  let acc = 0;
  for (let i = 0; i < MID; i++)
    acc += fX(((i + 0.5) * 1) / MID) * betaCdf(((i + 0.5) * 1) / MID, a2, b2);
  console.log(
    `定理 3 优势概率   ：P(Beta(13,1) > Beta(3,9)) = ${fmt(pAB, 9)}（对数空间有限和）；` +
      `对称恒等式 |P(X>Y)+P(Y>X)−1| = ${Math.abs(pAB + pBA - 1).toExponential(2)}`,
  );
  console.log(
    `                    独立第二路（复化中点积分 ∫f_X·CDF_Y，${MID} 点）：${fmt((acc * 1) / MID, 9)}，` +
      `偏差 ${Math.abs(pAB - (acc * 1) / MID).toExponential(2)}（不经正态近似）`,
  );
  assert(Math.abs(pAB + pBA - 1) <= 1e-12, 'P(X>Y)+P(Y>X)=1');
  assert(Math.abs(pAB - (acc * 1) / MID) <= 1e-4, '闭式 vs 数值积分一致');

  // 选择器：噪声先验 + 确定性观测回灌 + 后验优势
  const sel = new NoiseAwareBackendSelector([
    { name: 'qpu', flipProb: 0.07, problemShape: { m: 4, n: 5 }, priorStrength: 8 },
    { name: 'local' },
  ]);
  const priorQ = oneHotRetentionRate(4, 5, 0.07);
  for (let i = 0; i < 12; i++) sel.record('qpu', true);
  for (let i = 0; i < 12; i++) sel.record('local', i % 3 !== 2);
  const snap = sel.snapshot();
  const adv = sel.probabilityBetterThan('qpu', 'local');
  console.log(
    `先验映射          ：q_{m=4,n=5}(0.07) = ${fmt(priorQ, 6)} → κ=8 伪计数 → qpu 臂 Beta(${3}, ${7}) 起步（定理 1 映射整数形状）`,
  );
  for (const arm of snap) {
    console.log(
      `  ${arm.name.padEnd(5)} 后验 Beta(${arm.alpha},${arm.beta}) mean=${fmt(arm.mean, 4)} ` +
        `LCB(δ=0.05)=${fmt(arm.lcb, 4)} trials=${arm.trials} 成功=${arm.successes}`,
    );
  }
  console.log(
    `后验优势          ：P(qpu > local) = ${fmt(adv, 9)}（定理 3 精确值）；` +
      `greedy 决策 → ${sel.selectNext(undefined, 'greedy').backend}`,
  );
  r18Summary.push(
    `retention：q(f=0.07)=${fmt(q, 4)}（端点双锚 1/0.140625）；优势概率对称性和=${fmt(pAB + pBA, 12)}`,
  );
  assert(adv > 0.5, '证据回灌后 qpu 臂优势概率 > 0.5');
  assert(sel.selectNext(undefined, 'greedy').backend === 'qpu', 'greedy 决策选 qpu');
  assert(snap[0]!.alpha === 3 + 12, '共轭更新：先验 α=3 + 12 次成功 = 15');
}

// ----------------------------------------------------------------------------
// 演示 11：对易性感知 FT 估算（commutation-ft，R18-B）
// ----------------------------------------------------------------------------

function demoCommutationFt(): void {
  hr('演示 11／对易性感知 FT：Kőnig 精确构造 + 调度形状 + 画像缩减');
  // (a) 4×4 网格（二部交互图）：16 逻辑比特、24 耦合边，场项 'all'（16 悬边）
  const gridEdges: CouplingEdge[] = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const v = 4 * r + c;
      if (c < 3) gridEdges.push([v, v + 1]);
      if (r < 3) gridEdges.push([v, v + 4]);
    }
  }
  const part = parallelizeLayer(16, gridEdges); // fieldTerms 'all' 缺省
  console.log(
    `4×4 网格层        ：24 耦合 + 16 场项 → ${part.groupCount} 组（下界 Δ(G⁺)=${part.lowerBound}，` +
      `gap=${part.gap}，algorithm=${part.algorithm}，二部=${part.bipartite}）`,
  );
  assert(gridEdges.length === 24, '网格耦合边数 24');
  assert(part.algorithm === 'koenig' && part.gap === 0, '二部图 Kőnig 构造达到下界（零缺口）');

  // (b) 调度形状稠密 Ising 编码：m=4 任务 × n=5 agent（批 1 手锚 E=70、Δ=8）
  const m = 4;
  const n = 5;
  const schedEdges: CouplingEdge[] = [];
  for (let t = 0; t < m; t++) {
    for (let a = 0; a < n; a++) {
      for (let b = a + 1; b < n; b++) schedEdges.push([t * n + a, t * n + b]);
    }
  }
  for (let a = 0; a < n; a++) {
    for (let s = 0; s < m; s++) {
      for (let t2 = s + 1; t2 < m; t2++) schedEdges.push([s * n + a, t2 * n + a]);
    }
  }
  const sched = parallelizeLayer(m * n, schedEdges);
  console.log(
    `调度编码层        ：m=4×n=5 → E=${schedEdges.length} 耦合 + 20 场项 → ${sched.groupCount} 组` +
      `（下界 Δ(G⁺)=${sched.lowerBound}=m+n−2，first-fit gap=${sched.gap} 如实，二部=${sched.bipartite}）`,
  );
  assert(schedEdges.length === 70, 'E = m·C(n,2)+n·C(m,2) = 40+30 = 70');
  assert(sched.lowerBound === 8, 'Δ(G⁺) = m+n−2 = 8（每顶点 deg=7 + 1 场项）');
  assert(sched.groupCount >= sched.lowerBound, '任何合法分解 ≥ 下界（定理 A）');

  // (c) FT 画像缩减（定理 C）：网格层、depth=10、surface code d=5
  const pe = parallelEstimateFtCircuit(
    { logicalQubits: 16, couplings: 24, depth: 10 },
    surfaceCode(5),
    part,
  );
  console.log(
    `FT 画像（d=5,p=10）：串行 logicalOps=${pe.serial.logicalOpsTotal} → 并行 ${pe.parallel.logicalOpsTotal}` +
      `（每层 24+32 → ${part.groupCount}+1），缩减因子 ${fmt(pe.roundsReductionFactor, 3)}×`,
  );
  console.log(
    `                    墙钟 ${fmt(pe.serial.wallTimeMs, 1)}ms → ${fmt(pe.parallel.wallTimeMs, 1)}ms；` +
      `T 门 ${pe.serial.tGatesTotal} 与蒸馏错误逐字节不变（${pe.parallel.tGatesTotal === pe.serial.tGatesTotal && pe.parallel.epsilonDistillation === pe.serial.epsilonDistillation ? '✓' : '✗'}）；` +
      `meetsBudget ${pe.serial.meetsBudget} → ${pe.parallel.meetsBudget}`,
  );
  r18Summary.push(
    `Kőnig：gap=0@Δ=5；调度 E=70/Δ=8；画像 560→60 ops（${fmt(pe.roundsReductionFactor, 2)}×，T 不变）`,
  );
  assert(pe.serial.logicalOpsTotal === 560, '串行 10×(24+32) = 560');
  assert(pe.parallel.logicalOpsTotal === 60, '并行 10×(5+1) = 60');
  near(
    pe.parallel.wallTimeMs * pe.roundsReductionFactor,
    pe.serial.wallTimeMs,
    1e-6,
    '墙钟随缩减因子线性缩减',
  );
  assert(
    pe.parallel.tGatesTotal === pe.serial.tGatesTotal &&
      pe.parallel.epsilonDistillation === pe.serial.epsilonDistillation,
    'T 计数与蒸馏项逐字节不变',
  );
}

// ----------------------------------------------------------------------------
// 演示 12：SPRT 序贯校准门（sprt-calibration-gate，R18-C）
// ----------------------------------------------------------------------------

function demoSprtCalibrationGate(): void {
  hr('演示 12／SPRT 序贯校准门：序贯停止 + 截断族第一类误差界');
  // k=0 观测零增量（零资本零信息——似然族的精确性质）
  const zero = new SprtCalibrationGate();
  const s0 = zero.observe(0.5, 0, true);
  console.log(
    `k=0 观测          ：λ = ${fmt(s0.logLikelihoodRatio, 1)}（增量恒 0——零资本零信息，混合质量 m̄(0)=0）`,
  );
  assert(s0.logLikelihoodRatio === 0, 'k=0 增量恰为 0');

  // 学习流：base=0.5，真值 p(k)=0.5+0.4(1−e^{−0.1k})，k 随任务数增长
  const gate = new SprtCalibrationGate();
  const rng = mulberry32(4242);
  let snap = gate.getState();
  for (let i = 1; i <= 600 && !gate.isTerminal(); i++) {
    const p = 0.5 + 0.4 * (1 - Math.exp(-0.1 * i));
    snap = gate.observe(0.5, i, rng() < p);
  }
  console.log(
    `学习流终判        ：${snap.decision} @ N*=${snap.observations}` +
      `（λ=${fmt(snap.logLikelihoodRatio, 3)} ≥ lnA=${fmt(snap.logUpperBoundary, 3)}，` +
      `最大单步增量 c=${fmt(snap.maxAbsIncrement, 3)}）`,
  );
  assert(snap.decision === 'rejectNull', '学习信号被序贯检出（远早于 600 截断）');

  // null 扫描：M 个独立门在真值=base 下运行，reject 率 ≤ 定理 1 界 α/(1−β)
  const M = 3000;
  const bound = sprtTypeOneUpperBound(0.05, 0.02);
  let rejects = 0;
  let truncated = 0;
  let accepts = 0;
  let totalObs = 0;
  for (let g = 0; g < M; g++) {
    const gi = new SprtCalibrationGate();
    const r = mulberry32(900000 + g);
    let st = gi.getState();
    for (let i = 1; i <= 600 && !gi.isTerminal(); i++) st = gi.observe(0.5, i, r() < 0.5);
    totalObs += st.observations;
    if (st.decision === 'rejectNull') rejects++;
    else if (st.decision === 'truncated') truncated++;
    else accepts++;
  }
  const rate = rejects / M;
  console.log(
    `null 扫描         ：reject=${fmt(rate, 4)} ≤ 界 α/(1−β)=${fmt(bound, 4)}` +
      `（M=${M} 独立门；四态 ${accepts}接受 / ${rejects}拒绝 / ${truncated}不决，均值停时 ${fmt(totalObs / M, 1)}）`,
  );
  console.log(`                    （截断只产生第三结局「不决」，不污染第一类误差——定理 1）`);
  r18Summary.push(
    `SPRT：rejectNull@N*=${snap.observations}；null 率 ${fmt(rate, 4)} ≤ 界 ${fmt(bound, 4)}（M=${M}）`,
  );
  assert(rate <= bound, '第一类误差 ≤ 定理 1 界（截断门，无近似）');
  assert(accepts + rejects + truncated === M, '四态计数守恒');
}

// ----------------------------------------------------------------------------
// 演示 13：证据门控探索（evidence-gated-exploration，R18-C）
// ----------------------------------------------------------------------------

function demoEvidenceGatedExploration(): void {
  hr('演示 13／证据门控探索：包络 + 预算证书 + 门控断流');
  const eg = new EvidenceGatedExploration(); // e₀=0.5, κ₀=3（平台缺省）

  // 定理 A 包络：s=n/2 处近紧
  const n = 1000;
  const c = eg.coefficient({
    attempts: n,
    successes: n / 2,
    alphaHat: 0,
    betaHat: 0,
    meanCapital: 0,
    decided: false,
  });
  const ratio = c.uncertaintySigma / sigmaBound(n, 3);
  console.log(
    `包络（定理 A）    ：n=${n}, s=${n / 2} 处 σ=${fmt(c.uncertaintySigma, 9)}，` +
      `上界 1/(2√(n+κ₀+1))=${fmt(sigmaBound(n, 3), 9)}，比值=${fmt(ratio, 6)}（s≈n/2 处近紧）`,
  );
  assert(c.uncertaintySigma <= sigmaBound(n, 3) + 1e-15, 'σ ≤ 包络上界');

  // 定理 B 望远镜预算证书：最坏情形流（s=⌊n/2⌋、未检出、未终判）
  const N = 10000;
  const ledger = new ExplorationBudgetLedger();
  for (let i = 0; i < N; i++) {
    ledger.record(
      eg.coefficient({
        attempts: i,
        successes: Math.floor(i / 2),
        alphaHat: 0,
        betaHat: 0,
        meanCapital: i,
        decided: false,
      }).coefficient,
    );
  }
  console.log(
    `预算证书（定理 B）：N=${N} 最坏情形 Σe=${fmt(ledger.totalSubsidy(), 1)} ≤ ` +
      `e₀·√(N+κ₀+1)=${fmt(ledger.bound(), 1)}（台账 ${ledger.entryCount()} 条对账恒可复核）`,
  );
  assert(ledger.totalSubsidy() <= ledger.bound(), 'Σ e ≤ 望远镜上界');

  // 定理 D 饱和乘法界
  const sat1 = eg.coefficient({
    attempts: 10,
    successes: 5,
    alphaHat: 0.4,
    betaHat: 0.1,
    meanCapital: Math.log(100) / 0.1,
    decided: false,
  });
  const sat2 = eg.coefficient({
    attempts: 10,
    successes: 5,
    alphaHat: 0.4,
    betaHat: 0.1,
    meanCapital: Math.log(1e4) / 0.1,
    decided: false,
  });
  console.log(
    `饱和（定理 D）    ：k̄=ln100/β̂ → 因子 ${fmt(sat1.saturationFactor, 4)} ≤ 0.01；` +
      `k̄=ln10⁴/β̂ → ${fmt(sat2.saturationFactor, 8)} ≤ 1e-4（精确命中）`,
  );
  assert(sat1.saturationFactor <= 0.01 && sat2.saturationFactor <= 1e-4, '饱和乘法界');

  // 定理 C 门控断流：与 SPRT 门联合仿真（种子化，逐位可复现）
  const rng = mulberry32(777);
  const gate = new SprtCalibrationGate();
  const gatedLedger = new ExplorationBudgetLedger();
  let blindTotal = 0;
  let successes = 0;
  let kStar = 0;
  let snapG = gate.getState();
  for (let i = 1; i <= 600; i++) {
    const p = 0.5 + 0.4 * (1 - Math.exp(-0.1 * i));
    const ok = rng() < p;
    if (!gate.isTerminal()) snapG = gate.observe(0.5, i, ok);
    if (ok) successes++;
    if (!gate.isTerminal()) kStar = i;
    gatedLedger.record(
      eg.coefficient({
        attempts: i,
        successes,
        alphaHat: 0,
        betaHat: 0,
        meanCapital: i,
        decided: gate.isTerminal(),
      }).coefficient,
    );
    blindTotal += eg.coefficient({
      attempts: i,
      successes,
      alphaHat: 0,
      betaHat: 0,
      meanCapital: i,
      decided: false,
    }).coefficient;
  }
  const saving = 100 * (1 - gatedLedger.totalSubsidy() / blindTotal);
  console.log(
    `门控断流（定理 C）：门 ${snapG.decision} @N*=${kStar}；门控 Σe=${fmt(gatedLedger.totalSubsidy(), 3)} ≤ ` +
      `判定时刻界 ${fmt(explorationBudgetBound(kStar), 3)} ≤ 全视界界 ${fmt(explorationBudgetBound(600), 3)}`,
  );
  console.log(
    `                    无门控同 σ 日程付满 600 步 Σe=${fmt(blindTotal, 3)}，节省 ${fmt(saving, 1)}%` +
      `（盲日程永远付到视界；判后恒 0）`,
  );
  r18Summary.push(
    `探索：Σe=${fmt(ledger.totalSubsidy(), 1)}≤√N=${fmt(ledger.bound(), 1)}；门控省 ${fmt(saving, 1)}%@N*=${kStar}`,
  );
  assert(
    gatedLedger.totalSubsidy() <= explorationBudgetBound(kStar),
    'Σ e ≤ 判定时刻界（定理 B+C）',
  );
  assert(saving > 0, '门控变体比无门控省');
}

// ----------------------------------------------------------------------------
// 演示 14：γ 谱差三角多项式买断（gamma-spectrum-buyout，R18-D）
// ----------------------------------------------------------------------------

function demoGammaSpectrumBuyout(): void {
  hr('演示 14／γ 谱买断：DFT 系数精确恢复 + Lipschitz 证书夹逼 + 支配性精修');
  // dim=4 整数谱 {0,1,2,4}：差集 {1,2,3,4}，基频 g=1，M=4，N=9
  const energies = [0, 1, 2, 4];
  const truth: ReadonlyArray<readonly [number, number, number]> = [
    [1, -1.2, 0.7],
    [2, 0.5, -0.3],
    [3, 0.25, 0.15],
    [4, -0.1, 0.05],
  ];
  const c0True = 2.5;
  const f = (g: number): number => {
    let v = c0True;
    for (const [d, a, b] of truth) v += a * Math.cos(d * g) + b * Math.sin(d * g);
    return v;
  };
  const df = (g: number): number => {
    let v = 0;
    for (const [d, a, b] of truth) v += d * (b * Math.cos(d * g) - a * Math.sin(d * g));
    return v;
  };

  const spec = analyzeGammaSpectrum(energies);
  if (!spec.ok) throw new Error(`[showcase] 断言失败：整数谱分析应成功（${spec.reason}）`);
  console.log(
    `谱分析            ：dim=4 整数谱 → 互异差值 [${spec.differences.join(', ')}]，基频 g=${spec.fundamental}，` +
      `N=${spec.sampleCount}（M=${spec.maxHarmonic}，周期 T=${fmt(spec.period, 4)}，互异能量 ${spec.distinctEnergies}）`,
  );
  assert(JSON.stringify(spec.differences) === '[1,2,3,4]', '差集 {1,2,3,4}、基频 1');

  const bound = 2 * Math.PI;
  const buyout = buyoutGammaCurve((angles: number[]) => f(angles[0]!), [0.9], 0, spec, bound);
  let maxCoef = Math.abs(buyout.c0 - c0True);
  for (let r = 0; r < truth.length; r++) {
    maxCoef = Math.max(maxCoef, Math.abs(buyout.cosCoefficients[r]! - truth[r]![1]));
    maxCoef = Math.max(maxCoef, Math.abs(buyout.sinCoefficients[r]! - truth[r]![2]));
  }
  console.log(
    `买断（定理 T2）   ：N=${buyout.spectrum.sampleCount}+2 探针 = ${buyout.evaluations} 次评估恢复全部 Fourier 系数，` +
      `max |Δcoef| = ${maxCoef.toExponential(2)}；杂散谐波 ${buyout.maxSpuriousAmplitude.toExponential(2)}、` +
      `探针残差 ${buyout.maxProbeResidual.toExponential(2)}（~舍入级）`,
  );
  assert(maxCoef <= 1e-9, '系数恢复 ≤ 1e-9（朴素 DFT 精确可逆）');

  // 50 点闭式求值/梯度 vs 解析（定理 T4 的免费精确梯度）
  let maxV = 0;
  let maxD = 0;
  for (let i = 0; i <= 50; i++) {
    const g = (i / 50) * bound;
    maxV = Math.max(maxV, Math.abs(gammaCurveValueAt(buyout, g) - f(g)));
    maxD = Math.max(maxD, Math.abs(gammaCurveDerivativeAt(buyout, g) - df(g)));
  }
  console.log(
    `闭式面（定理 T4） ：50 点求值 max|Δ| = ${maxV.toExponential(2)}，梯度 max|Δ| = ${maxD.toExponential(2)}（买断后零电路评估）`,
  );
  assert(maxV <= 1e-9 && maxD <= 1e-9, '买断曲线与解析真值逐点一致');

  // 证书夹逼（定理 T3）：独立参考 = 密扫 + 三分逼近真极小
  const cert = minimizeGammaCurve(buyout, bound, { targetEps: 1e-9 });
  let bestG = 0;
  let bestV = Infinity;
  for (let i = 0; i <= 2000; i++) {
    const g = (i / 2000) * bound;
    const v = f(g);
    if (v < bestV) {
      bestV = v;
      bestG = g;
    }
  }
  let refLo = Math.max(0, bestG - bound / 2000);
  let refHi = Math.min(bound, bestG + bound / 2000);
  for (let it = 0; it < 200 && refHi - refLo > 1e-14; it++) {
    const m1 = refLo + (refHi - refLo) / 3;
    const m2 = refHi - (refHi - refLo) / 3;
    if (f(m1) <= f(m2)) refHi = m2;
    else refLo = m1;
  }
  const trueMin = f((refLo + refHi) / 2);
  const truncatedGap = (cert.lipschitz * bound) / (2 * (cert.gridPoints - 1));
  console.log(
    `证书夹逼（T3）    ：真极小参考 ${fmt(trueMin, 9)} ∈ [${fmt(cert.lowerBound, 6)}, ${fmt(cert.upperBound, 6)}]，` +
      `gap=${cert.gap.toExponential(2)}（L₁=${fmt(cert.lipschitz, 3)}，网格 ${cert.gridPoints} 点）`,
  );
  console.log(
    `                    gap 受 maxGrid=65536 截断：截断公式 L₁·bound/(2(N_g−1)) = ${truncatedGap.toExponential(2)}（如实，不假称 1e-9）`,
  );
  assert(cert.lowerBound <= trueMin && trueMin <= cert.upperBound, '真极小被证书夹住');
  assert(Math.abs(cert.gap - truncatedGap) <= 1e-6, 'gap = 截断公式');

  // 支配性精修（种子 0.9 → 证书化极小）
  const seedValue = f(0.9);
  const refined = refineGammaByTrigBuyout(
    (angles: number[]) => f(angles[0]!),
    [0.9],
    [bound],
    energies,
    { gammaIndices: [0] },
  );
  console.log(
    `支配性精修        ：seed γ=0.9（f=${fmt(seedValue, 6)}）→ γ=${fmt(refined.angles[0]!, 6)}（f=${fmt(refined.value, 9)}），` +
      `${refined.evaluations} 次评估 / ${refined.sweeps} 轮扫描，improved=${refined.improved}`,
  );
  r18Summary.push(
    `γ买断：|Δcoef|≤${maxCoef.toExponential(0)}；证书 gap=${cert.gap.toExponential(1)} 夹住真极小；精修 ${fmt(seedValue, 3)}→${fmt(refined.value, 3)}`,
  );
  assert(refined.value <= seedValue, '支配性：精修不劣化种子');
  assert(refined.improved && refined.value < seedValue, '精修严格改进');
}

// ----------------------------------------------------------------------------
// 演示 15：挂起任务可达性三分类（pending-reachability，R18-A）
// ----------------------------------------------------------------------------

function demoPendingReachability(): void {
  hr('演示 15／挂起可达性三分类：零错杀刻画 + 证人集');
  const agents = [
    { id: 'alice', capabilities: ['translate'], state: 'idle' },
    { id: 'bob', capabilities: ['translate', 'audit'], state: 'working' },
    { id: 'carol', capabilities: ['render'], state: 'overloaded' },
  ];
  const tasks = [
    { id: 't-translate', requiredCapabilities: ['translate'] },
    { id: 't-audit', requiredCapabilities: ['audit'] },
    { id: 't-gpu', requiredCapabilities: ['gpu'] },
  ];
  const verdicts = classifyPendingBucket(tasks, agents);
  for (const v of verdicts) {
    console.log(
      `${v.task.padEnd(11)} → ${v.classification.padEnd(17)}（匹配 [${v.matchingAgents.join(', ')}]，` +
        `idle [${v.idleMatches.join(', ')}]，busy [${v.busyMatches.join(', ')}]）`,
    );
  }
  console.log(
    `T1（零错杀）      ：unsatisfiable ⟺ 任何调度执行路径下永不离开 pending；` +
      `T1'：提前失败 vs 等满 TTL 终态相同（failed + 同级联 reason），差异只有时间`,
  );
  console.log(
    `T2（等待根据）    ：awaiting-release 的匹配 agent 由超时回收保证有限时间释放；` +
      `overloaded 与 working 同为「在役可释放」闭包成员（窄判定是错杀）`,
  );
  r18Summary.push('reachability：三分类 3/3（now/release/unsat 各一并带证人集）');
  assert(verdicts[0]!.classification === 'schedulable-now', 't-translate：空闲匹配存在');
  assert(
    verdicts[1]!.classification === 'awaiting-release',
    't-audit：匹配 agent 在役（working/overloaded 同为可释放闭包）',
  );
  assert(verdicts[2]!.classification === 'unsatisfiable', 't-gpu：全注册表无匹配');
  assert(JSON.stringify(verdicts[2]!.matchingAgents) === '[]', 'unsatisfiable 证人集为空');
}

// ----------------------------------------------------------------------------
// 十六模块清单 + R18 总对照行
// ----------------------------------------------------------------------------

function printModuleList(): void {
  hr('十六模块清单（R14 创新波九模块 + R18 创新波七模块 · 全部 opt-in，零接触默认路径）');
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
      'Bayesian 雇佣大脑：技能后验区间 + 四策略与 Hedge 组合对照（演示 5）',
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
    [
      '10',
      'src/core/shadow-price-secant.ts',
      '影子价格割线：分段仿射 Σp(λ) 的割线搜索，仿射段内一步命中（演示 9）',
    ],
    [
      '11',
      'src/core/pending-reachability.ts',
      '挂起可达性三分类：unsatisfiable 的零错杀刻画与证人集（演示 15）',
    ],
    [
      '12',
      'src/core/qpu/noise-aware-backend-selector.ts',
      '噪声感知后端选择：保持率闭式先验 + Beta 优势概率精确有限和（演示 10）',
    ],
    [
      '13',
      'src/core/qpu/commutation-ft.ts',
      '对易性感知 FT：Kőnig 匹配分解 + 画像缩减（T 计数不动）（演示 11）',
    ],
    [
      '14',
      'src/proactive-intelligence/sprt-calibration-gate.ts',
      'SPRT 序贯校准门：序贯停止 + 截断族第一类误差界（演示 12）',
    ],
    [
      '15',
      'src/proactive-intelligence/evidence-gated-exploration.ts',
      '证据门控探索：包络/预算证书 + 判定后探索断流（演示 13）',
    ],
    [
      '16',
      'src/core/gamma-spectrum-buyout.ts',
      'γ 谱买断：多值谱代价角的三角多项式 DFT 买断 + Lipschitz 证书（演示 14）',
    ],
  ];
  for (const [n, path, what] of rows) {
    console.log(`  ${n}. ${path}\n     ${what}`);
  }
  console.log('\nR18 七段证据数字总对照：');
  for (const line of r18Summary) console.log(`  · ${line}`);
  console.log('\n全部断言通过，演示退出码 0。');
}

// ----------------------------------------------------------------------------

function main(): void {
  console.log('quantum-innovation-showcase —— R14+R18 创新波十六模块外围演示');
  demoEntanglementBatchComposer();
  demoMinCostFlowPotentials();
  demoCrossBackendConsensus();
  demoReadoutMitigation();
  demoBayesianHireBrain();
  demoParameterShift();
  demoReservePriceVcg();
  demoToolCapabilityPolicy();
  demoShadowPriceSecant();
  demoNoiseAwareBackendSelector();
  demoCommutationFt();
  demoSprtCalibrationGate();
  demoEvidenceGatedExploration();
  demoGammaSpectrumBuyout();
  demoPendingReachability();
  printModuleList();
}

main();
