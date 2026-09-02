/**
 * 论文级突破：培训 vs 雇佣相变的闭式定律 + 普适标度 + 真实 LLM 标定
 *
 * ============ 四条闭式定律（精确离散口径，与模拟逐批对应） ============
 *
 * 记 A(β) = (1−q0)(1−e^{−βK}) − δ（在位者的资本化优势 − 雇佣溢价），
 *    S(β) = (1−e^{−βT})/(1−e^{−β})（几何和）。
 * 累计优势闭式：Σadv = −δ(1−α)T + α·A·S。
 *
 * L1 相边界：培训赢 ⟺ α > α*(β) := δT/(A·S + δT)。
 *    （α* 是 β 的 U 形曲线：β→β_min 时 →1，中段下降，β→∞ 回升到
 *     δT/((1−q0−δ)+δT)——因此培训获胜区是 β 的有限区间"口袋"。）
 * L2 资本化阈值：β_min = −ln(1−Π1)/K，Π1 = δ/(1−q0)。
 *    先发资本必须先把雇佣溢价"烧穿"（(1−q0)(1−e^{−βK}) > δ），
 *    与 α、T 无关——纯结构门槛。Π1 ≥ 1 时雇佣恒胜。
 * L3 最小孵化资本：K_min = −ln(1 − δ(1+(1−α)T/(αS))/(1−q0))/β。
 * L4 培训可承受的最高雇佣溢价：
 *    δ_max = α(1−q0)(1−e^{−βK})S / ((1−α)T + αS)，随 α 单调上升。
 *
 * ============ 普适标度（Buckingham π） ============
 *
 * 连续极限（β→0，K=Π2/β、T=Π3/β）下，条件化为纯无量纲形式：
 *    α[1−e^{−Π2} − Π1](1−e^{−Π3}) > Π1(1−α)Π3
 * 整个相变由三个无量纲群决定：
 *    Π1 = δ/(1−q0)（归一化雇佣溢价）、Π2 = βK（资本化度）、Π3 = βT（视界度）。
 * 推论：归一化优势 adv/(1−q0) 是 (Π1, Π2, Π3, α) 的普适函数——
 * 不同 (q0, δ, K, T, β) 的组织只要 Π 群相同就处于同一相位（坍缩）。
 *
 * ============ 真实 LLM 标定 ============
 *
 * 用 glm-4-flash 隐性学习实测 bucket（results-implicit.json，1056 次评测）
 * 拟合 (q̂0, α̂, β̂)，代入 L4 得到真实模型"培训可承受的最高雇佣溢价"。
 *
 * 运行：node --import tsx experiments/train-vs-hire-phase/scaling-law.ts
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  counterfactual,
  cumulativeAdvantage,
  PHASE_DEFAULTS,
  type PhaseParams
} from './run.js';

export interface LawParams {
  q0: number;
  delta: number;
  K: number;
  T: number;
  alpha: number;
  beta: number;
}

// ---------- 四条闭式定律 ----------

/** 几何和 Σ_{k=0}^{T−1} e^{−βk} */
function geometricSum(beta: number, T: number): number {
  if (Math.abs(beta) < 1e-12) return T;
  return (1 - Math.exp(-beta * T)) / (1 - Math.exp(-beta));
}

/** 资本化优势（>0 才有培训获胜的可能） */
export function capitalizedAdvantage(p: LawParams): number {
  return (1 - p.q0) * (1 - Math.exp(-p.beta * p.K)) - p.delta;
}

/** 累计优势闭式（与 run.ts 逐项求和精确一致） */
export function cumulativeAdvantageClosed(p: LawParams): number {
  const S = geometricSum(p.beta, p.T);
  const A = capitalizedAdvantage(p);
  return -p.delta * (1 - p.alpha) * p.T + p.alpha * A * S;
}

/** L1 相边界 α*(β)：培训赢 ⟺ α > α*(β)；A≤0 时返回 Infinity */
export function alphaStar(p: LawParams): number {
  const S = geometricSum(p.beta, p.T);
  const A = capitalizedAdvantage(p);
  if (A <= 0) return Infinity;
  return (p.delta * p.T) / (A * S + p.delta * p.T);
}

/** L2 资本化阈值 β_min（Π1 ≥ 1 时雇佣恒胜，返回 Infinity） */
export function betaMin(p: LawParams): number {
  const pi1 = p.delta / (1 - p.q0);
  if (pi1 >= 1) return Infinity;
  return -Math.log(1 - pi1) / p.K;
}

/** L3 最小孵化资本（不可行时返回 null） */
export function kMin(p: LawParams): number | null {
  const S = geometricSum(p.beta, p.T);
  const need = p.delta * (1 + ((1 - p.alpha) * p.T) / (p.alpha * S));
  const frac = need / (1 - p.q0);
  if (frac >= 1) return null;
  return -Math.log(1 - frac) / p.beta;
}

/** L4 培训可承受的最高雇佣溢价（随 α 单调上升） */
export function deltaMax(p: LawParams): number {
  const S = geometricSum(p.beta, p.T);
  const cap = (1 - p.q0) * (1 - Math.exp(-p.beta * p.K));
  return (p.alpha * cap * S) / ((1 - p.alpha) * p.T + p.alpha * S);
}

// ---------- 普适标度 ----------

export interface PiGroups {
  /** 归一化雇佣溢价 δ/(1−q0) */
  pi1: number;
  /** 资本化度 βK */
  pi2: number;
  /** 视界度 βT */
  pi3: number;
}

export function piGroups(p: LawParams): PiGroups {
  return { pi1: p.delta / (1 - p.q0), pi2: p.beta * p.K, pi3: p.beta * p.T };
}

/** 普适（连续极限）相边界：给定 (Π1, Π2, Π3) 的 α* */
export function alphaStarUniversal(pi1: number, pi2: number, pi3: number): number {
  const bracket = 1 - Math.exp(-pi2) - pi1;
  if (bracket <= 0) return Infinity;
  return (pi1 * pi3) / (bracket * (1 - Math.exp(-pi3)) + pi1 * pi3);
}

/** 培训获胜的 β 区间（解析，α* U 形曲线两次穿越；无口袋返回 null） */
export function trainingBetaInterval(
  p: Omit<LawParams, 'beta' | 'alpha'>,
  alpha: number,
  betaHi = 5
): [number, number] | null {
  const bMin = betaMin({ ...p, alpha, beta: 1 });
  if (!isFinite(bMin)) return null;
  let lo: number | null = null;
  let hi: number | null = null;
  const N = 4000;
  for (let i = 1; i <= N; i++) {
    const beta = bMin * Math.pow(betaHi / bMin, i / N);
    if (alphaStar({ ...p, alpha, beta }) < alpha) {
      if (lo === null) lo = beta;
      hi = beta;
    }
  }
  if (lo === null || hi === null) return null;
  return [lo, hi];
}

// ---------- 实验工具 ----------

function runCounterfactual(
  org: { q0: number; delta: number; K: number; T: number },
  alpha: number,
  beta: number,
  seeds: number[]
): number {
  const p: PhaseParams = {
    ...PHASE_DEFAULTS,
    q0: org.q0,
    delta: org.delta,
    K: org.K,
    T: org.T,
    alpha,
    beta,
    seeds
  };
  return counterfactual(p).diffRate;
}

// ---------- 真实 LLM 标定 ----------

export interface LLMBucket {
  kMid: number;
  n: number;
  q: number;
}

export function loadLLMBuckets(): LLMBucket[] {
  const here = dirname(fileURLToPath(import.meta.url));
  const raw = JSON.parse(readFileSync(join(here, '../llm-learning-curve/results-implicit.json'), 'utf-8'));
  return raw.conditions.treatment.buckets.map((b: LLMBucket) => ({
    kMid: b.kMid,
    n: b.n,
    q: b.q
  }));
}

/** 加权最小二乘拟合 q(k) = base + α(1−base)(1−e^{−βk})（网格搜索） */
export function fitLearningCurve(buckets: LLMBucket[]): {
  base: number;
  alpha: number;
  beta: number;
  r2: number;
} {
  let best = { base: 0.5, alpha: 0.5, beta: 0.1, sse: Infinity };
  for (let base = 0.3; base <= 0.6001; base += 0.01) {
    for (let alpha = 0.2; alpha <= 1.0001; alpha += 0.02) {
      for (let li = 0; li <= 60; li++) {
        const beta = Math.pow(10, -2.5 + (li * 2.8) / 60);
        let sse = 0;
        for (const b of buckets) {
          const pred = base + alpha * (1 - base) * (1 - Math.exp(-beta * b.kMid));
          sse += b.n * (b.q - pred) * (b.q - pred);
        }
        if (sse < best.sse) best = { base, alpha, beta, sse };
      }
    }
  }
  const w = buckets.reduce((a, b) => a + b.n, 0);
  const mean = buckets.reduce((a, b) => a + b.n * b.q, 0) / w;
  const sst = buckets.reduce((a, b) => a + b.n * (b.q - mean) * (b.q - mean), 0);
  return { base: best.base, alpha: best.alpha, beta: best.beta, r2: 1 - best.sse / sst };
}

// ---------- 主程序 ----------

function main(): void {
  console.log('培训 vs 雇佣：闭式相变定律 + 普适标度 + 真实 LLM 标定\n');
  const org = { q0: PHASE_DEFAULTS.q0, delta: PHASE_DEFAULTS.delta, K: PHASE_DEFAULTS.K, T: PHASE_DEFAULTS.T };

  // ---- 定律自检：闭式 vs 逐项求和、α* 恒等式 ----
  console.log('【定律自检】');
  let maxErr = 0;
  for (const [alpha, beta] of [
    [0.5, 0.01], [0.7, 0.03], [0.9, 0.05], [0.6, 0.12], [0.85, 0.005]
  ] as Array<[number, number]>) {
    const law = { ...org, alpha, beta };
    const closed = cumulativeAdvantageClosed(law);
    const loop = cumulativeAdvantage({ ...PHASE_DEFAULTS, ...law, seeds: [] } as PhaseParams);
    maxErr = Math.max(maxErr, Math.abs(closed - loop));
    const aStar = alphaStar(law);
    if (isFinite(aStar)) {
      const atBoundary = cumulativeAdvantageClosed({ ...law, alpha: aStar });
      maxErr = Math.max(maxErr, Math.abs(atBoundary));
    }
  }
  console.log(`  闭式 vs 逐项求和 & Σadv(α*)=0 恒等式：最大误差 = ${maxErr.toExponential(2)}\n`);

  // ---- 解析边界 vs 经验边界 ----
  console.log('【解析边界 vs 经验边界】（经验 = 粗网格扫描，端点被网格量化）');
  console.log('| α | β_min(解析) | 解析获胜区间 | 经验获胜区间 |');
  console.log('|---|---|---|---|');
  const GRID = [0.003, 0.005, 0.008, 0.012, 0.02, 0.03, 0.05, 0.08, 0.12, 0.18, 0.27, 0.4];
  const seeds12 = Array.from({ length: 12 }, (_, i) => 100 + i);
  for (const alpha of [0.6, 0.7, 0.8, 0.9]) {
    const interval = trainingBetaInterval(org, alpha);
    const wins = GRID.filter((beta) => runCounterfactual(org, alpha, beta, seeds12) > 0);
    const emp =
      wins.length === 0 ? '∅' : `[${Math.min(...wins)}, ${Math.max(...wins)}]`;
    const ana = interval ? `[${interval[0].toFixed(4)}, ${interval[1].toFixed(3)}]` : '∅';
    console.log(`| ${alpha} | ${betaMin({ ...org, alpha, beta: 0.03 }).toFixed(4)} | ${ana} | ${emp} |`);
  }
  console.log();

  // ---- 普适坍缩 ----
  console.log('【普适坍缩】同 Π 群、不同原始参数 → 同相位（归一化每单优势 adv/(1−q0)）');
  const CONFIGS = [
    { name: 'A', q0: 0.45, delta: 0.12, K: 60, T: 150 },
    { name: 'B', q0: 0.3, delta: 0.12 * (0.7 / 0.55), K: 120, T: 300 },
    { name: 'C', q0: 0.6, delta: 0.12 * (0.4 / 0.55), K: 30, T: 75 }
  ];
  const seeds24 = Array.from({ length: 24 }, (_, i) => 200 + i);
  console.log('| (α, Π2, Π3) | 理论 | ' + CONFIGS.map((c) => `${c.name} 经验`).join(' | ') + ' | 极差 |');
  console.log('|---|---|' + CONFIGS.map(() => '---').join('|') + '|---|');
  for (const [alpha, pi2] of [
    [0.5, 1.8],
    [0.7, 1.8],
    [0.9, 1.8]
  ] as Array<[number, number]>) {
    const pi3 = 4.5;
    const vals: number[] = [];
    for (const c of CONFIGS) {
      const beta = pi2 / c.K;
      vals.push(runCounterfactual(c, alpha, beta, seeds24) / (1 - c.q0));
    }
    const th =
      cumulativeAdvantageClosed({ ...CONFIGS[0], alpha, beta: pi2 / CONFIGS[0].K }) /
      CONFIGS[0].T /
      (1 - CONFIGS[0].q0);
    const spread = Math.max(...vals) - Math.min(...vals);
    console.log(
      `| (${alpha}, ${pi2}, ${pi3}) | ${th >= 0 ? '+' : ''}${th.toFixed(3)} | ` +
        vals.map((v) => `${v >= 0 ? '+' : ''}${v.toFixed(3)}`).join(' | ') +
        ` | ${spread.toFixed(3)} |`
    );
  }
  console.log('\n  反例对照（同原始参数、不同 Π2 → 相位改变）：');
  {
    const alpha = 0.9;
    const beta = 0.03;
    const d60 = runCounterfactual({ ...org, K: 60 }, alpha, beta, seeds24);
    const d6 = runCounterfactual({ ...org, K: 6 }, alpha, beta, seeds24);
    console.log(
      `  α=0.9 β=0.03：K=60（Π2=1.8）diff=${d60 >= 0 ? '+' : ''}${d60.toFixed(3)} vs K=6（Π2=0.18）diff=${d6 >= 0 ? '+' : ''}${d6.toFixed(3)} —— 坍缩非平凡`
    );
  }
  console.log();

  // ---- K_min 定律 ----
  console.log('【K_min 定律】α=0.9, β=0.02, T=150：最小孵化资本的解析预测 vs 经验符号翻转');
  {
    const p = { ...org, alpha: 0.9, beta: 0.02 };
    const pred = kMin(p)!;
    console.log(`  解析 K_min = ${pred.toFixed(1)} 单先发资本`);
    console.log('  | K | 理论每单差 | 经验每单差 | 符号一致 |');
    console.log('  |---|---|---|---|');
    const seeds32 = Array.from({ length: 32 }, (_, i) => 300 + i);
    for (const K of [4, 6, 10, 14, 17, 20, 26, 34, 44]) {
      const th = cumulativeAdvantageClosed({ ...p, K }) / p.T;
      const emp = runCounterfactual({ ...org, K }, 0.9, 0.02, seeds32);
      const ok = Math.abs(th) < 0.008 || Math.sign(th) === Math.sign(emp);
      console.log(`  | ${K} | ${th >= 0 ? '+' : ''}${th.toFixed(4)} | ${emp >= 0 ? '+' : ''}${emp.toFixed(4)} | ${ok ? '✓' : '✗'} |`);
    }
  }
  console.log();

  // ---- δ_max 定律 + LLM 标定 ----
  console.log('【δ_max 定律 + 真实 LLM 标定】');
  {
    const buckets = loadLLMBuckets();
    const fit = fitLearningCurve(buckets);
    console.log(
      `  glm-4-flash 隐性学习拟合（${buckets.reduce((a, b) => a + b.n, 0)} 次评测）：q̂0=${fit.base.toFixed(2)} α̂=${fit.alpha.toFixed(2)} β̂=${fit.beta.toFixed(3)}（R²=${fit.r2.toFixed(3)}）`
    );
    const modelGain = fit.alpha * (1 - fit.base) * (1 - Math.exp(-fit.beta * 20));
    console.log(`  实测增益 q(k=20)−q(0) = ${(0.771 - 0.417).toFixed(3)}，模型增益 = ${modelGain.toFixed(3)}`);
    for (const T of [20, 150]) {
      const p = { q0: fit.base, delta: 0, K: 20, T, alpha: fit.alpha, beta: fit.beta };
      const dm = deltaMax(p);
      const verdict120 = cumulativeAdvantageClosed({ ...p, delta: 0.12 });
      console.log(
        `  视界 T=${T}：培训可承受的最高雇佣溢价 δ_max = ${dm.toFixed(3)}（${(dm * 100).toFixed(1)}pp）；δ=0.12 时 ${verdict120 > 0 ? '培训赢' : '雇佣赢'}`
      );
    }
    console.log('  相图定位：把 (α̂, β̂, K=20) 放回扫描相图（q0=0.45, δ=0.12, T=150 口径）');
    const seat = { q0: 0.45, delta: 0.12, K: 20, T: 150, alpha: fit.alpha, beta: fit.beta };
    const interval = trainingBetaInterval(
      { q0: seat.q0, delta: seat.delta, K: seat.K, T: seat.T },
      fit.alpha
    );
    console.log(
      `  α=α̂=${fit.alpha.toFixed(2)} 的培训获胜 β 区间 = ${interval ? `[${interval[0].toFixed(3)}, ${interval[1].toFixed(3)}]` : '∅'}；实测 β̂=${fit.beta.toFixed(3)} → ${interval && fit.beta > interval[0] && fit.beta < interval[1] ? '落在口袋内（培训赢）' : '落在口袋外（雇佣赢）'}`
    );
  }
}

if (process.argv[1] && process.argv[1].endsWith('scaling-law.ts')) main();
