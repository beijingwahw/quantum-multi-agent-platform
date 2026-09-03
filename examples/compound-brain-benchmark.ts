/**
 * CompoundBrain 基准：静态 VCG vs 增长复利大脑（双 regime）
 *
 * 场景：在位者 hire（凭证高、贵）vs 学习者 trainee（凭证低、便宜）。
 * 三条臂（同一真实动力学，仅机制不同）：
 *   naive    —— 不校准（α̂≡0）+ γ=0：永远按当前估计分配（近视基线）；
 *   static   —— 在线校准 + γ=0：知道学习曲线，但不为增长投资（只消费）；
 *   compound —— 在线校准 + γ=1：为学习资本付影子价格（消费 + 投资）。
 *
 * Regime A（可学习 α=0.9 β=0.15）：
 *   naive 锁死在 hire；static 也几乎全给 hire（trainee 资本永远不涨，
 *   q̂ 永远是初值——市场锁定！）；compound 前期牺牲当期福利给 trainee
 *   积资本，反超后净胜。闭式相变定律预测反超点 ≈ K_min。
 * Regime B（不可学习 α=0.03）：
 *   校准给出 α̂≈0 → g≈0 → compound 退化为 static（优雅降级，不乱投资）。
 *
 * 运行：node --import tsx examples/compound-brain-benchmark.ts
 */
import { CompoundBrain, type CompoundAgentSpec } from '../src/core/compound-brain.js';

const TASKS = Array.from({ length: 1 }, () => ({ capability: 'X', value: 10 }));
const BATCHES = 120;

const AGENTS: CompoundAgentSpec[] = [
  {
    id: 'trainee',
    capabilities: ['X'],
    trueCost: 0.3,
    trueQuality: { X: 0.3 },
    credentialQuality: { X: 0.3 },
    capacity: 1,
  },
  {
    id: 'hire',
    capabilities: ['X'],
    trueCost: 1.0,
    trueQuality: { X: 0.6 },
    credentialQuality: { X: 0.6 },
    capacity: 1,
  },
];

function makeBrain(
  arm: 'naive' | 'static' | 'compound',
  simAlpha: number,
  simBeta: number,
  seed: number,
): CompoundBrain {
  const brain = new CompoundBrain({
    simAlpha,
    simBeta,
    seed,
    growthHorizon: 60,
    exploreCoefficient: 0, // 三臂对比纯粹来自 γ 与校准，不带探索项
    growthDiscount: arm === 'compound' ? 1 : 0,
    minCalibrationAttempts: arm === 'naive' ? Infinity : 15,
  });
  for (const a of AGENTS) brain.registerAgent(a);
  return brain;
}

interface ArmResult {
  cumulative: number[];
  final: number;
  traineeTasks: number;
  traineeCapital: number;
  alphaHat: number;
  betaHat: number;
}

function run(arm: 'naive' | 'static' | 'compound', simAlpha: number, simBeta: number): ArmResult {
  // 多种子平均（真实动力学随机性）
  const SEEDS = [11, 22, 33, 44, 55, 66, 77, 88];
  const cumPerSeed: number[][] = [];
  let traineeTasks = 0;
  let traineeCapital = 0;
  let alphaHat = 0;
  let betaHat = 0;
  for (const seed of SEEDS) {
    const brain = makeBrain(arm, simAlpha, simBeta, seed);
    const cum: number[] = [0];
    let traineeCount = 0;
    for (let b = 0; b < BATCHES; b++) {
      const { realizedWelfare, settlements } = brain.simulateBatch(TASKS);
      cum.push(cum[cum.length - 1]! + realizedWelfare);
      for (const s of settlements) if (s.agentId === 'trainee') traineeCount++;
    }
    cumPerSeed.push(cum);
    traineeTasks += traineeCount / SEEDS.length;
    traineeCapital +=
      ((brain.getState().agents.find((a) => a.id === 'trainee')!.capital as Record<string, number>)[
        'X'
      ] ?? 0) / SEEDS.length;
    const cal = brain.calibrations()[0]!;
    alphaHat += cal.alphaHat / SEEDS.length;
    betaHat += cal.betaHat / SEEDS.length;
  }
  const avg = Array.from(
    { length: BATCHES + 1 },
    (_, i) => cumPerSeed.reduce((a, c) => a + c[i]!, 0) / cumPerSeed.length,
  );
  return {
    cumulative: avg,
    final: avg[avg.length - 1]!,
    traineeTasks,
    traineeCapital,
    alphaHat,
    betaHat,
  };
}

function report(regime: string, simAlpha: number, simBeta: number): void {
  console.log(`\n===== Regime ${regime}（真实动力学 α=${simAlpha} β=${simBeta}）=====`);
  const arms = {
    naive: run('naive', simAlpha, simBeta),
    static: run('static', simAlpha, simBeta),
    compound: run('compound', simAlpha, simBeta),
  } as const;

  console.log('| 批次 | naive | static | compound |');
  console.log('|---|---|---|---|');
  for (const b of [0, 15, 30, 40, 60, 90, 120]) {
    console.log(
      `| ${b} | ${arms.naive.cumulative[b]!.toFixed(1)} | ${arms.static.cumulative[b]!.toFixed(1)} | ${arms.compound.cumulative[b]!.toFixed(1)} |`,
    );
  }
  console.log('\n| 臂 | trainee 任务数 | trainee 资本 | 校准 α̂ | β̂ | 终值福利 |');
  console.log('|---|---|---|---|---|---|');
  for (const [name, r] of Object.entries(arms)) {
    console.log(
      `| ${name} | ${r.traineeTasks.toFixed(1)} | ${r.traineeCapital.toFixed(0)} | ${r.alphaHat.toFixed(2)} | ${r.betaHat.toFixed(3)} | ${r.final.toFixed(1)} |`,
    );
  }
  const gain = arms.compound.final - arms.static.final;
  console.log(
    `\ncompound − static = ${gain >= 0 ? '+' : ''}${gain.toFixed(1)}（${gain > 5 ? '投资显著获胜' : gain > 0 ? '投资小幅获胜' : Math.abs(gain) < 5 ? '≈打平（优雅降级）' : '投资亏损'}）`,
  );
}

report('A · 可学习', 0.9, 0.15);
report('B · 不可学习', 0.03, 0.15);

// 顾问仪表盘：可学习 regime 下的相变定律读数
console.log('\n===== 相变定律顾问（Regime A，compound 臂终点读数）=====');
{
  const brain = makeBrain('compound', 0.9, 0.15, 11);
  for (let b = 0; b < BATCHES; b++) brain.simulateBatch(TASKS);
  for (const adv of brain.advise()) {
    console.log(
      `能力 ${adv.capability}：α̂=${adv.calibration.alphaHat.toFixed(2)} β̂=${adv.calibration.betaHat.toFixed(3)} R²=${adv.calibration.r2.toFixed(2)} 可学习=${adv.calibration.learnable}`,
    );
    console.log('| agent | 资本 | K_min | δ_max | q̂(now) | q̂(horizon) |');
    console.log('|---|---|---|---|---|---|');
    for (const inc of adv.incubations) {
      console.log(
        `| ${inc.agentId} | ${inc.capital} | ${inc.kMin === null ? '不可行' : inc.kMin.toFixed(1)} | ${inc.deltaMax.toFixed(3)} | ${inc.qNow.toFixed(3)} | ${inc.qHorizon.toFixed(3)} |`,
      );
    }
  }
}
