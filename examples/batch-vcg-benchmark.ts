/**
 * 批量 VCG 基准：预算-效率 frontier + 三方机制对比
 * （λ-bisection：预算硬约束/DSIC近似 vs μ-VCG+Pacer：精确DSIC/预算按平均守恒）
 * 运行：node --import tsx examples/batch-vcg-benchmark.ts
 */
import {
  BatchVCGScheduler,
  BudgetPacer,
  type BatchAgentSpec,
} from '../src/core/batch-vcg-scheduler.js';

const BASE = {
  successValue: 10,
  priorQuality: 0.5,
  priorWeight: 3,
  exploreCoefficient: 0,
  switchCostRate: 0,
};
const CAPS = ['A', 'B', 'C'];

const AGENTS: BatchAgentSpec[] = [
  {
    id: 'a0',
    capabilities: CAPS,
    trueCost: 1.0,
    capacity: 3,
    trueQuality: { A: 0.6, B: 0.6, C: 0.8 },
    credentialQuality: { A: 0.6, B: 0.6, C: 0.8 },
  },
  {
    id: 'a1',
    capabilities: ['B'],
    trueCost: 1.8,
    capacity: 3,
    trueQuality: { B: 0.85 },
    credentialQuality: { B: 0.85 },
  },
  {
    id: 'a2',
    capabilities: CAPS,
    trueCost: 2.6,
    capacity: 3,
    trueQuality: { A: 0.75, B: 0.5, C: 0.5 },
    credentialQuality: { A: 0.75, B: 0.5, C: 0.5 },
  },
  {
    id: 'a3',
    capabilities: ['C'],
    trueCost: 3.4,
    capacity: 2,
    trueQuality: { C: 0.8 },
    credentialQuality: { C: 0.4 },
  },
  {
    id: 'a4',
    capabilities: ['A', 'C'],
    trueCost: 2.0,
    capacity: 2,
    trueQuality: { A: 0.7, C: 0.6 },
    credentialQuality: { A: 0.55, C: 0.55 },
  },
];

const TASKS = ['A', 'B', 'C', 'A', 'A', 'C', 'C', 'B', 'A', 'C'];

function fresh(): BatchVCGScheduler {
  const s = new BatchVCGScheduler(BASE);
  AGENTS.forEach((a) => s.register(a));
  return s;
}

const slack = fresh().allocateBatch(TASKS);
const myopic = fresh().allocateMyopic(TASKS);
const vcgPayment = slack.totalPayment;

console.log(
  `任务 ${TASKS.length} 个 | 无预算约束 VCG：W*=${slack.welfare} Σp=${vcgPayment.toFixed(2)} take=${slack.platformTake.toFixed(2)}`,
);
console.log(
  `短视基线：        W=${myopic.welfare} Σp=${myopic.totalPayment.toFixed(2)} take=${myopic.platformTake.toFixed(2)} 弃标=${myopic.droppedTasks}\n`,
);

console.log('预算-效率 frontier（拉格朗日影子价格 λ 对预算 B 的响应）');
console.log('| 预算 B | Σp | λ | 福利 | 效率损失 | take | 弃标 | 路径 |');
console.log('|---|---|---|---|---|---|---|---|');
for (const frac of [0.3, 0.5, 0.7, 0.85, 1.0]) {
  const B = vcgPayment * frac;
  const a = fresh().allocateBatch(TASKS, { budget: B });
  console.log(
    `| ${B.toFixed(1)} | ${a.totalPayment.toFixed(2)} | ${a.lambda.toFixed(3)} | ${a.welfare.toFixed(2)} | ${a.efficiencyLoss.toFixed(2)} | ${a.platformTake.toFixed(2)} | ${a.droppedTasks} | ${a.exactDSIC ? '精确DSIC' : 'λ松弛'} |`,
  );
}

// Green-Laffmont 的实证代价：预算紧时虚报偏离幅度（对照：松弛时恒为 0）
console.log('\n虚报收益实证（markups ∈ {-30%..+100%}，每 agent 试探）');
for (const binding of [true, false]) {
  const s = fresh();
  const budget = binding ? vcgPayment * 0.6 : Infinity;
  const alloc = s.allocateBatch(TASKS, { budget });
  let worst = 0;
  let who = '';
  for (const agentId of Object.keys(alloc.payments)) {
    const g = s.measureMisreportGain(TASKS, agentId, [-0.3, -0.1, 0.1, 0.3, 0.5, 1.0], { budget });
    if (g.maxGain > worst) {
      worst = g.maxGain;
      who = `${agentId}(+${Math.round(g.bestMarkup * 100)}%)`;
    }
  }
  console.log(
    `  ${binding ? `预算紧(B=${(vcgPayment * 0.6).toFixed(1)})` : '预算松弛  '}：最大虚报收益 = ${worst.toFixed(4)} ${who}`,
  );
}

// ============ 突破：μ-VCG 仿射乘子（精确 DSIC 的预算逃生舱） ============
console.log('\nμ-VCG：markup 扫描（同一实例，公开乘子 → 精确 DSIC）');
console.log('| μ | Σp | 福利 | 效率损失 | take | 弃标 | DSIC |');
console.log('|---|---|---|---|---|---|---|');
for (const mu of [1, 1.15, 1.3, 1.5, 2, 3]) {
  const a = fresh().allocateAffineBatch(TASKS, { mu });
  console.log(
    `| ${mu} | ${a.totalPayment.toFixed(2)} | ${a.welfare.toFixed(2)} | ${a.efficiencyLoss.toFixed(2)} | ${a.platformTake.toFixed(2)} | ${a.droppedTasks} | 精确 |`,
  );
}

console.log('\n公开乘子下虚报收益（μ ∈ {1.3, 1.8}，应为精确 0）');
for (const mu of [1.3, 1.8]) {
  const s = fresh();
  const alloc = s.allocateAffineBatch(TASKS, { mu });
  let worst = 0;
  for (const agentId of Object.keys(alloc.payments)) {
    const g = s.measureMisreportGain(TASKS, agentId, [-0.3, -0.1, 0.1, 0.3, 0.5, 1.0], {
      affine: { mu },
    });
    worst = Math.max(worst, g.maxGain);
  }
  console.log(`  μ=${mu}：最大虚报收益 = ${worst.toFixed(6)}`);
}

// ============ 预算即控制：BudgetPacer 在线校准 ============
const B = vcgPayment * 0.6;
const BATCHES = 60;
const pacer = new BudgetPacer(B, 0.5);
const paced = fresh();
const spends: number[] = [];
const welfares: number[] = [];
for (let t = 0; t < BATCHES; t++) {
  const { allocation, netWelfare } = paced.simulateBatch(TASKS, { affine: { mu: pacer.getMu() } });
  spends.push(allocation.totalPayment);
  welfares.push(netWelfare);
  pacer.update(allocation.totalPayment);
}
const lateMean = spends.slice(BATCHES / 2).reduce((a, b) => a + b, 0) / (BATCHES / 2);
const welfareMean = welfares.reduce((a, b) => a + b, 0) / BATCHES;
console.log(`\nBudgetPacer（B=${B.toFixed(1)}，${BATCHES} 批）`);
console.log(`  末态 μ = ${pacer.getMu().toFixed(3)}`);
console.log(
  `  后半程平均支出 = ${lateMean.toFixed(2)}（预算 ${B.toFixed(2)}，偏差 ${((lateMean / B - 1) * 100).toFixed(1)}%）`,
);
console.log(`  平均真实福利 = ${welfareMean.toFixed(2)}`);

console.log('\n三方机制对比（同一预算 B）');
console.log('| 机制 | 预算保证 | DSIC | 支付水平 | 代价 |');
console.log('|---|---|---|---|---|');
console.log(
  `| λ-bisection | 每批硬约束 | 近似（实测 0） | ${fresh().allocateBatch(TASKS, { budget: B }).totalPayment.toFixed(2)} | 乘子依赖当批报价 |`,
);
console.log(
  `| μ-VCG + Pacer | 平均守恒（后半程偏差 ${((lateMean / B - 1) * 100).toFixed(1)}%） | 精确 | ${lateMean.toFixed(2)} | 边际任务弃标 |`,
);
console.log(`| 经典 VCG | 无 | 精确 | ${vcgPayment.toFixed(2)} | 薄市场 take→0 |`);
