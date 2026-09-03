/**
 * 论文级实验：扫 (α, β) 参数空间，找「培训优于雇佣」的相变边界
 *
 * 情境：
 *   在位者 vet  —— 基础质量 q0，已积累 K 单上下文资本（同一学习动力学下预滚）；
 *   外聘者 hire —— 基础质量 q0+δ（雇佣溢价，资历可见），零资本。
 *   学习曲线与调度器同式：q(k) = q_base + α(1−q_base)(1−e^{−βk})，
 *   α = 学习天花板，β = 学习速率，k = 上下文资本（已结算任务数）。
 *
 * 三条臂（每格 (α,β) × 多种子平均）：
 *   1) 培训臂：只有 vet，继续做 T 单 → 每单成功率 r_train；
 *   2) 雇佣臂：只有 hire，做 T 单 → 每单成功率 r_hire；
 *   3) 市场臂：两者同场，BatchVCG 按公开估值分配 → 锁定 / 易主份额。
 *
 * 闭式理论（期望口径，与模拟臂精确对应）：
 *   优势差  adv(k) = qI(K+k) − qH(k)
 *                 = −δ(1−α) + α·e^{−βk}·[(1−q0)(1−e^{−βK}) − δ]
 *   培训优于雇佣 ⟺ Σ_{k=0}^{T−1} adv(k) > 0（几何和，有闭式）。
 *
 * 结构性预测（相图形状）：
 *   P1 渐近惩罚：adv(∞) = −δ(1−α) < 0 —— 双方同参数学习时，基础差距只缩窄
 *      （δ → δ(1−α)）不反转 → 「培训赢」不可能是渐近态，只能是有限视界暂态；
 *   P2 低 β 边界：βK ≪ 1 时先发资本兑现不了（(1−q0)(1−e^{−βK}) < δ）→ 雇佣赢；
 *   P3 高 β 边界：新人 T 单内追平 → 雇佣赢；
 *   P4 α 单调性：口袋随 α 增大而变宽（惩罚项 δ(1−α)T 缩小、先发项放大）；
 *   → 相变边界是 (α, β) 平面上的封闭口袋，不是单调阈值。
 *
 * 市场臂的独立现象（机制层）：
 *   公开估值锁定 —— vet 的履历估值一旦高于 hire 的资历先验，explore=0 的市场
 *   永不试用 hire（即使雇佣臂累计福利更高）→ 探索项（UCB）是解锁钥匙。
 *
 * 运行：node --import tsx experiments/train-vs-hire-phase/run.ts
 */
import { BatchVCGScheduler, type BatchAgentSpec } from '../../src/core/batch-vcg-scheduler.js';

export interface PhaseParams {
  /** 在位者基础质量 */
  q0: number;
  /** 雇佣溢价：外聘者基础质量 = q0 + delta */
  delta: number;
  /** 双方相同边际成本 */
  cost: number;
  /** 在位者先发资本（预滚任务数） */
  K: number;
  /** 对比视界（任务数） */
  T: number;
  /** 学习天花板 α */
  alpha: number;
  /** 学习速率 β */
  beta: number;
  /** 随机种子集合（结果为种子平均） */
  seeds: number[];
  /** 市场臂探索系数（默认 0） */
  explore?: number;
}

export const PHASE_DEFAULTS: Omit<PhaseParams, 'alpha' | 'beta' | 'seeds'> = {
  q0: 0.45,
  delta: 0.12,
  cost: 1.0,
  K: 60,
  T: 150,
};

const BASE = {
  successValue: 10,
  priorQuality: 0.5,
  priorWeight: 3,
  exploreCoefficient: 0,
  switchCostRate: 0,
};

function vetSpec(p: PhaseParams): BatchAgentSpec {
  return {
    id: 'vet',
    capabilities: ['X'],
    trueCost: p.cost,
    capacity: 1,
    trueQuality: { X: p.q0 },
    credentialQuality: { X: p.q0 },
  };
}

function hireSpec(p: PhaseParams): BatchAgentSpec {
  return {
    id: 'hire',
    capabilities: ['X'],
    trueCost: p.cost,
    capacity: 1,
    trueQuality: { X: p.q0 + p.delta },
    credentialQuality: { X: p.q0 + p.delta },
  };
}

function makeScheduler(p: PhaseParams, seed: number): BatchVCGScheduler {
  return new BatchVCGScheduler({
    ...BASE,
    learningCeiling: p.alpha,
    learningRate: p.beta,
    exploreCoefficient: p.explore ?? 0,
    seed,
  });
}

/** 预滚：vet 独做 K 单，积累先发资本（同一 α/β 动力学） */
function preRolledVet(p: PhaseParams, seed: number): BatchVCGScheduler {
  const s = makeScheduler(p, seed);
  s.register(vetSpec(p));
  for (let i = 0; i < p.K; i++) s.simulateBatch(['X']);
  return s;
}

// ---------- 闭式理论 ----------

/** 第 k 单的期望质量差（vet 从资本 K+k 起，hire 从 k 起） */
export function advantageAt(p: PhaseParams, k: number): number {
  const qI = p.q0 + p.alpha * (1 - p.q0) * (1 - Math.exp(-p.beta * (p.K + k)));
  const qH = p.q0 + p.delta + p.alpha * (1 - p.q0 - p.delta) * (1 - Math.exp(-p.beta * k));
  return qI - qH;
}

/** 视界 T 内累计期望质量差（培训赢 ⟺ > 0） */
export function cumulativeAdvantage(p: PhaseParams): number {
  let s = 0;
  for (let k = 0; k < p.T; k++) s += advantageAt(p, k);
  return s;
}

/** 理论每单优势差（与模拟 diffRate 同口径） */
export function theoreticalDiffRate(p: PhaseParams): number {
  return cumulativeAdvantage(p) / p.T;
}

// ---------- 模拟臂 ----------

/** 培训臂 vs 雇佣臂：每单成功率与差值（种子平均） */
export function counterfactual(p: PhaseParams): {
  trainRate: number;
  hireRate: number;
  diffRate: number;
} {
  let trainSucc = 0;
  let trainN = 0;
  for (const seed of p.seeds) {
    const s = preRolledVet(p, seed);
    for (let i = 0; i < p.T; i++) {
      for (const st of s.simulateBatch(['X']).settlements) {
        trainSucc += st.success ? 1 : 0;
        trainN++;
      }
    }
  }
  let hireSucc = 0;
  let hireN = 0;
  for (const seed of p.seeds) {
    const s = makeScheduler(p, seed);
    s.register(hireSpec(p));
    for (let i = 0; i < p.T; i++) {
      for (const st of s.simulateBatch(['X']).settlements) {
        hireSucc += st.success ? 1 : 0;
        hireN++;
      }
    }
  }
  const trainRate = trainN > 0 ? trainSucc / trainN : 0;
  const hireRate = hireN > 0 ? hireSucc / hireN : 0;
  return { trainRate, hireRate, diffRate: trainRate - hireRate };
}

/** 市场臂：vet 份额 / hire 试用次数 / 平均每单福利 */
export function market(p: PhaseParams): {
  vetShare: number;
  hireTrials: number;
  welfarePerTask: number;
} {
  let vetWins = 0;
  let hireWins = 0;
  let welfare = 0;
  for (const seed of p.seeds) {
    const s = preRolledVet(p, seed);
    s.register(hireSpec(p));
    for (let i = 0; i < p.T; i++) {
      const { allocation, settlements, netWelfare } = s.simulateBatch(['X']);
      welfare += netWelfare;
      for (const a of allocation.assignments) {
        if (a.agentId === 'vet') vetWins++;
        else hireWins++;
      }
      void settlements;
    }
  }
  const total = vetWins + hireWins;
  return {
    vetShare: total > 0 ? vetWins / total : 0,
    hireTrials: hireWins / p.seeds.length,
    welfarePerTask: welfare / (total > 0 ? total : 1),
  };
}

// ---------- 主程序：网格扫描 + ASCII 相图 ----------

const ALPHAS = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
const BETAS = [0.003, 0.005, 0.008, 0.012, 0.02, 0.03, 0.05, 0.08, 0.12, 0.18, 0.27, 0.4];
const SEEDS = Array.from({ length: 12 }, (_, i) => 100 + i);

/** 经验格字符：培训显著赢 + / 培训弱赢 · / 边界 o / 雇佣弱赢 - / 雇佣显著赢 = */
function empChar(d: number): string {
  if (d >= 0.03) return '█';
  if (d >= 0.005) return '+';
  if (d > -0.005) return 'o';
  if (d > -0.03) return '-';
  return '=';
}

function theoChar(d: number): string {
  if (d >= 0.03) return '█';
  if (d >= 0.005) return '+';
  if (d > -0.005) return 'o';
  if (d > -0.03) return '-';
  return '=';
}

function shareChar(share: number): string {
  if (share >= 0.8) return 'L'; // 锁定在位者
  if (share <= 0.2) return 'T'; // 易主外聘者
  return 'm';
}

function main(): void {
  const cell = (alpha: number, beta: number, explore?: number): PhaseParams => ({
    ...PHASE_DEFAULTS,
    alpha,
    beta,
    seeds: SEEDS,
    explore,
  });

  console.log(
    `培训 vs 雇佣 相变扫描 | q0=${PHASE_DEFAULTS.q0} δ=${PHASE_DEFAULTS.delta} K=${PHASE_DEFAULTS.K} T=${PHASE_DEFAULTS.T} seeds=${SEEDS.length}`,
  );
  console.log(`图例：█ 培训显著赢(≥+3pp)  + 培训弱赢  o 边界  − 雇佣弱赢  = 雇佣显著赢\n`);

  // 三张图的数据
  const emp = new Map<string, number>();
  const theo = new Map<string, number>();
  const share = new Map<string, number>();
  let agree = 0;
  let solid = 0;

  for (const alpha of [...ALPHAS].reverse()) {
    for (const beta of BETAS) {
      const p = cell(alpha, beta);
      const cf = counterfactual(p);
      const th = theoreticalDiffRate(p);
      const mk = market(p);
      emp.set(`${alpha}|${beta}`, cf.diffRate);
      theo.set(`${alpha}|${beta}`, th);
      share.set(`${alpha}|${beta}`, mk.vetShare);
      if (Math.abs(th) > 0.02) {
        solid++;
        if (Math.sign(th) === Math.sign(cf.diffRate)) agree++;
      }
    }
  }

  const header = 'α\\β    ' + BETAS.map((b) => b.toFixed(3).padStart(6)).join('');
  const row = (label: string, get: (beta: number) => string) =>
    label.padEnd(7) + BETAS.map((b) => get(b).padStart(6)).join('');

  console.log('【经验相图】培训臂 − 雇佣臂 每单成功率差（模拟，种子平均）');
  console.log(header);
  for (const alpha of [...ALPHAS].reverse()) {
    console.log(row(alpha.toFixed(1), (beta) => empChar(emp.get(`${alpha}|${beta}`)!)));
  }

  console.log('\n【理论相图】Σadv(k)/T（闭式几何和）');
  console.log(header);
  for (const alpha of [...ALPHAS].reverse()) {
    console.log(row(alpha.toFixed(1), (beta) => theoChar(theo.get(`${alpha}|${beta}`)!)));
  }

  console.log(`\n符号一致性：${agree}/${solid}（理论 |diff|>2pp 的格子）`);

  console.log('\n【市场臂】在位者份额（L 锁定≥80% / m 混合 / T 易主≤20%，explore=0）');
  console.log(header);
  for (const alpha of [...ALPHAS].reverse()) {
    console.log(row(alpha.toFixed(1), (beta) => shareChar(share.get(`${alpha}|${beta}`)!)));
  }

  // 相变边界提取：每个 α 的培训获胜 β 区间（经验 vs 理论）
  console.log('\n【相变边界】培训获胜的 β 区间（经验 vs 理论）');
  console.log('| α | 经验 β 区间 | 理论 β 区间 |');
  console.log('|---|---|---|');
  for (const alpha of ALPHAS) {
    const empWin = BETAS.filter((beta) => (emp.get(`${alpha}|${beta}`) ?? 0) > 0);
    const theoWin = BETAS.filter((beta) => (theo.get(`${alpha}|${beta}`) ?? 0) > 0);
    const fmt = (arr: number[]) =>
      arr.length === 0 ? '∅（雇佣全域胜）' : `[${Math.min(...arr)}, ${Math.max(...arr)}]`;
    console.log(`| ${alpha} | ${fmt(empWin)} | ${fmt(theoWin)} |`);
  }

  // 探索项的机制层价值：锁定格子上 explore 的修复效果
  console.log('\n【探索修复】锁定格子（α, β）上市场臂的 hire 试用与福利');
  console.log('| α | β | explore | hire试用数 | vet份额 | 每单福利 |');
  console.log('|---|---|---|---|---|---|');
  for (const [alpha, beta] of [
    [0.5, 0.27],
    [0.7, 0.12],
    [0.9, 0.27],
  ] as Array<[number, number]>) {
    for (const explore of [0, 1.5]) {
      const mk = market(cell(alpha, beta, explore));
      console.log(
        `| ${alpha} | ${beta} | ${explore} | ${mk.hireTrials.toFixed(1)} | ${mk.vetShare.toFixed(2)} | ${mk.welfarePerTask.toFixed(2)} |`,
      );
    }
  }
}

if (process.argv[1] && process.argv[1].endsWith('run.ts')) main();
