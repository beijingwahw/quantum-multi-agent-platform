/**
 * 配对基准测量器（bench-kit）：为「同一进程内两段代码谁更快」提供可被
 * 验证的答案。存在的理由是一次真实事故：2026-09-06 的性能回归中，同文件
 * 双路径零测试（两臂代码完全相同）实测比率 1.068——**第二个模块稳定慢
 * 约 7%**，即测量框架自身携带系统性伪影；按旧方法论得到的 1.09/1.15
 * 级「差异」因此全部不可信（其中两次实测后被判定为伪影并回退）。
 *
 * 方法论（Criterion 谱系，按本仓事故教训加固）：
 * - **配对交错**：每轮 A/B 相邻执行，机器漂移对两臂均等；
 * - **次序随机化**：每轮谁先执行由种子化 RNG 决定（构造性完美平衡的
 *   洗牌）——把「模块序/执行序」的系统性偏差转化为方差，再由统计区间
 *   吸收（这是对 7% 伪影的直接对消机制；种子固定保证可复现）。自验证
 *   期间实测的两条残余伪影知识（2026-09-06 诊断）：位置效应 ~1%（后行
 *   者略慢，缓存/JIT 状态的位置寄生，靠平衡序列 + 区间吸收）；分配型
 *   负载把 GC 尖峰带进测量（单轮比率可摆动 0.2~4.7×，中位数估计在重尾
 *   下失稳——自测负载应零分配，真实分配语义的基准需更多轮数与 MAD 披露）；
 * - **对称预热**：预热阶段同样交错进行，两臂的 JIT 分层/内联缓存状态
 *   对称起步；
 * - **稳健统计**：每轮比率 tB/tA 的中位数 + bootstrap 百分位区间（种子
 *   化复采样），MAD 围栏（Iglewicz-Hoan 常数 3.5/1.4826）分类离群并
 *   **披露计数而非静默剔除**；
 * - **A/A 效度前置**：任何判决前先看测量器能否在相同双臂上得出「无异
 *   差」——配套测试以 A/A 控制锁定本性质；
 * - **伪影地板**：判决要求效应量超过 ARTIFACT_FLOOR（实测伪影量级），
 *   区间排除 1 但效应在地板以内 → 如实报 no-difference；
 * - **漂移监控**：固定参考负载在首/中/尾计时，散布超限 → unstable，
 *   结果只报告不判决（整机降频期的教训：绝对数字不可比）；
 * - **时钟分辨率守卫**：单轮中位耗时低于计时器分辨率量级 → inconclusive；
 * - **可注入时钟**：测量器自身可被测试（世界级纪律：测量器也要被测量）。
 */

import { mulberry32 } from '../../src/utils/rng.js';

/** 同文件双路径零测试实测的系统性伪影量级（1.068），判决的效应量地板 */
export const ARTIFACT_FLOOR = 1.07;
/** 漂移判停阈值：参考负载首/中/尾耗时的 max/min 散布上限 */
export const DRIFT_SPREAD_LIMIT = 1.5;
/** 计时器分辨率守卫：单轮中位耗时低于该值（ms）不做判决 */
export const MIN_ROUND_MS = 0.2;

export const DEFAULT_ROUNDS = 25;
export const DEFAULT_WARMUP_ROUNDS = 10;
const BOOTSTRAP_RESAMPLES = 2000;

export interface BenchArm {
  readonly name: string;
  readonly run: () => void;
}

export type PairedVerdict = 'b-faster' | 'b-slower' | 'no-difference' | 'inconclusive';

export interface PairedBenchReport {
  readonly armA: string;
  readonly armB: string;
  readonly roundsTotal: number;
  readonly roundsKept: number;
  readonly excludedOutliers: number;
  /**
   * 分层臂效应估计 √(median₁·median₀)：A 先行层与 B 先行层中位比率
   * 的几何平均——位置寄生因子 p 与 1/p 精确对消，只剩臂效应
   */
  readonly medianRatio: number;
  readonly ciLow: number;
  readonly ciHigh: number;
  /** 位置效应诊断 √(median₁/median₀)，健康时应 ≈1（偏离即位置寄生强度） */
  readonly positionEffect: number;
  readonly medianAMs: number;
  readonly medianBMs: number;
  readonly driftSpread: number;
  readonly unstable: boolean;
  readonly lowResolution: boolean;
  /** |A 先行轮数 − B 先行轮数|——随机化的平衡性披露 */
  readonly orderImbalance: number;
  readonly verdict: PairedVerdict;
  /** inconclusive 时给出原因；判决生效时给出效应量与地板的关系 */
  readonly note: string;
}

export interface PairedBenchOptions {
  /** 计量轮数（配对），默认 25 */
  rounds?: number;
  /** 每臂预热轮数（交错进行），默认 10 */
  warmupRounds?: number;
  /** 次序随机化种子（默认 20260906，固定可复现） */
  seed?: number;
  /** 可注入时钟（默认 performance.now），供测量器自测试 */
  clock?: () => number;
  /** 漂移监控参考负载（默认内置确定性校验和） */
  reference?: () => void;
}

/**
 * 次序随机化序列：第 i 轮 A 是否先行。**构造性完美平衡**——先铺
 * ⌈n/2⌉ 个 A-先与 ⌊n/2⌋ 个 B-先，再以种子化 Fisher-Yates 洗牌：
 * 既消灭次序不平衡对中位比率的偏置（实测不平衡 + 重尾方差可产出
 * ~5% 的假差异），又保留对周期性伪影（GC 节律、定时器对齐）的随机
 * 化。决定性与平衡性由配套测试锚定。
 */
export function randomizedOrderSequence(rounds: number, seed: number): boolean[] {
  const aFirstCount = Math.ceil(rounds / 2);
  const order: boolean[] = [];
  for (let i = 0; i < aFirstCount; i++) order.push(true);
  for (let i = aFirstCount; i < rounds; i++) order.push(false);
  // 种子化 Fisher-Yates
  const rng = mulberry32(seed);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = order[i]!;
    order[i] = order[j]!;
    order[j] = tmp;
  }
  return order;
}

/**
 * MAD 围栏离群分类（Iglewicz-Hoan：中位数 ± 3.5·1.4826·MAD）。
 * 纯函数：返回保留的下标集合与剔除计数。MAD 为 0（超过半数同值）时不剔除。
 */
export function fenceOutliers(values: readonly number[]): {
  kept: number[];
  excluded: number;
} {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  const median = sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  const deviations = values.map((v) => Math.abs(v - median)).sort((a, b) => a - b);
  const mad =
    deviations.length % 2 === 1
      ? deviations[deviations.length >> 1]!
      : (deviations[(deviations.length >> 1) - 1]! + deviations[deviations.length >> 1]!) / 2;
  if (mad === 0) return { kept: values.map((_, i) => i), excluded: 0 };
  const fence = 3.5 * 1.4826 * mad;
  const kept: number[] = [];
  let excluded = 0;
  values.forEach((v, i) => {
    if (Math.abs(v - median) <= fence) kept.push(i);
    else excluded++;
  });
  return { kept, excluded };
}

function medianOf(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * 分层配对估计（位置寄生偏差的原理性对消）：逐轮比率 tB/tA 同时携带
 * 臂效应 a 与位置效应 p——A 先行轮的比率 ≈ a·p，B 先行轮 ≈ a/p。
 * 取两层中位比率的几何平均 √(median₁·median₀)：位置因子以 p 与 1/p
 * 成对出现，几何平均下精确对消，臂效应保留。实测动机：平衡次序 + 同
 * 闭包双臂仍残留 ±2.5~3% 的运行方向性偏差（随运行翻转），逐轮中位数
 * 无法对消亚轮级位置寄生；分层估计把它消掉。positionEffect 作为诊断
 * 输出（√(median₁/median₀)，健康时应 ≈1）。
 */
export function stratifiedArmEffect(
  ratios: readonly number[],
  aFirstFlags: readonly boolean[],
): { armEffect: number; positionEffect: number; stratum1: number; stratum0: number } {
  const r1: number[] = []; // A 先行层
  const r0: number[] = []; // B 先行层
  ratios.forEach((r, i) => (aFirstFlags[i] ? r1 : r0).push(r));
  if (r1.length === 0 || r0.length === 0) {
    // 单层退化（轮数极小或次序全偏）：回退逐轮中位（位置效应无法对消，
    // 由 note 披露）
    return {
      armEffect: medianOf(ratios),
      positionEffect: Number.NaN,
      stratum1: r1.length > 0 ? medianOf(r1) : Number.NaN,
      stratum0: r0.length > 0 ? medianOf(r0) : Number.NaN,
    };
  }
  const m1 = medianOf(r1);
  const m0 = medianOf(r0);
  return {
    armEffect: Math.sqrt(m1 * m0),
    positionEffect: Math.sqrt(m1 / m0),
    stratum1: m1,
    stratum0: m0,
  };
}

/** 内置漂移参考负载：固定长度确定性校验和（~1-2ms，自身须稳到可当标尺） */
const REFERENCE_BUFFER = new Float64Array(1 << 20);
let REFERENCE_ACCUMULATOR = 0;
function defaultReferenceWorkload(): void {
  let acc = 0;
  for (let k = 0; k < REFERENCE_BUFFER.length; k++) {
    acc += REFERENCE_BUFFER[k]! * k;
  }
  REFERENCE_ACCUMULATOR = acc;
  if (Number.isNaN(REFERENCE_ACCUMULATOR)) throw new Error('reference workload corrupted');
}

/**
 * 配对 A/B 测量。判决规则（前置守卫逐级短路）：
 * unstable（漂移散布超限）/ lowResolution（计时分辨率不足）/ 有效轮数 < 8
 * → inconclusive；区间整体 <1（或 >1）且效应量越过伪影地板 → b-faster
 * （或 b-slower）；区间含 1 或效应在地板内 → no-difference。
 */
export function comparePaired(
  armA: BenchArm,
  armB: BenchArm,
  options: PairedBenchOptions = {},
): PairedBenchReport {
  const rounds = options.rounds ?? DEFAULT_ROUNDS;
  const warmupRounds = options.warmupRounds ?? DEFAULT_WARMUP_ROUNDS;
  const seed = options.seed ?? 20260906;
  const clock = options.clock ?? (() => performance.now());
  const reference = options.reference ?? defaultReferenceWorkload;

  const order = randomizedOrderSequence(rounds, seed);
  const warmupOrder = randomizedOrderSequence(warmupRounds, seed ^ 0x5eed);

  // 对称预热：两臂交错执行，JIT 分层与 IC 状态对称起步
  for (let w = 0; w < warmupRounds; w++) {
    if (warmupOrder[w]!) {
      armA.run();
      armB.run();
    } else {
      armB.run();
      armA.run();
    }
  }

  // 漂移监控：参考负载先预热 2 次（首跑冷启动会使散布虚高），之后在
  // 首/中/尾各取一个检查点——每检查点连续 3 次取中位，吸收单次调度毛刺
  const refTimes: number[] = [];
  reference();
  reference();
  const takeReference = (): void => {
    const oneShot: number[] = [];
    for (let s = 0; s < 3; s++) {
      const t0 = clock();
      reference();
      oneShot.push(clock() - t0);
    }
    refTimes.push(medianOf(oneShot));
  };
  takeReference();

  const timesA: number[] = [];
  const timesB: number[] = [];
  let aFirstCount = 0;
  const refEvery = Math.max(1, Math.floor(rounds / 2));
  for (let r = 0; r < rounds; r++) {
    const aFirst = order[r]!;
    if (aFirst) aFirstCount++;
    if (aFirst) {
      const t0 = clock();
      armA.run();
      const t1 = clock();
      armB.run();
      const t2 = clock();
      timesA.push(t1 - t0);
      timesB.push(t2 - t1);
    } else {
      const t0 = clock();
      armB.run();
      const t1 = clock();
      armA.run();
      const t2 = clock();
      timesB.push(t1 - t0);
      timesA.push(t2 - t1);
    }
    if (r > 0 && (r + 1) % refEvery === 0 && r + 1 < rounds) takeReference();
  }
  takeReference();

  const driftSpread = Math.max(...refTimes) / Math.min(...refTimes);
  const unstable = driftSpread > DRIFT_SPREAD_LIMIT;
  const medianAMs = medianOf(timesA);
  const medianBMs = medianOf(timesB);
  const lowResolution = medianAMs < MIN_ROUND_MS || medianBMs < MIN_ROUND_MS;

  const ratios = timesA.map((ta, i) => timesB[i]! / ta);
  const { kept, excluded } = fenceOutliers(ratios);
  const keptRatios = kept.map((i) => ratios[i]!);
  const keptFlags = kept.map((i) => order[i]!);
  const { armEffect, positionEffect } = stratifiedArmEffect(keptRatios, keptFlags);

  const base = {
    armA: armA.name,
    armB: armB.name,
    roundsTotal: rounds,
    roundsKept: kept.length,
    excludedOutliers: excluded,
    medianRatio: armEffect,
    positionEffect,
    medianAMs,
    medianBMs,
    driftSpread,
    unstable,
    lowResolution,
    orderImbalance: Math.abs(aFirstCount - (rounds - aFirstCount)),
  };

  if (unstable) {
    return {
      ...base,
      ciLow: Number.NaN,
      ciHigh: Number.NaN,
      verdict: 'inconclusive',
      note: `参考负载散布 ${driftSpread.toFixed(2)}× 超限（${DRIFT_SPREAD_LIMIT}）——机器状态漂移，结果仅报告不判决`,
    };
  }
  if (lowResolution) {
    return {
      ...base,
      ciLow: Number.NaN,
      ciHigh: Number.NaN,
      verdict: 'inconclusive',
      note: `单轮中位耗时（A ${medianAMs.toFixed(4)}ms / B ${medianBMs.toFixed(4)}ms）低于分辨率守卫 ${MIN_ROUND_MS}ms——加长单轮负载后重测`,
    };
  }
  if (kept.length < 8) {
    return {
      ...base,
      ciLow: Number.NaN,
      ciHigh: Number.NaN,
      verdict: 'inconclusive',
      note: `MAD 围栏后有效轮数 ${kept.length} < 8——离群过多，样本不可信`,
    };
  }

  // 分层 bootstrap：层内重采样（保持层规模），每次重采样算分层臂效应，
  // 分位取区间——与点估计同一估计量，CI 与中位口径一致
  const rng = mulberry32(seed ^ 0xb005);
  const stratum1 = keptRatios.filter((_, i) => keptFlags[i]);
  const stratum0 = keptRatios.filter((_, i) => !keptFlags[i]);
  const bootstrapEffects: number[] = [];
  for (let b = 0; b < BOOTSTRAP_RESAMPLES; b++) {
    const s1 = stratum1.map(() => stratum1[Math.floor(rng() * stratum1.length)]!);
    const s0 = stratum0.map(() => stratum0[Math.floor(rng() * stratum0.length)]!);
    bootstrapEffects.push(Math.sqrt(medianOf(s1) * medianOf(s0)));
  }
  bootstrapEffects.sort((x, y) => x - y);
  const ciLow = bootstrapEffects[Math.floor(0.025 * bootstrapEffects.length)]!;
  const ciHigh = bootstrapEffects[Math.ceil(0.975 * bootstrapEffects.length) - 1]!;

  const ratio = armEffect;
  if (ciHigh < 1 && ratio <= 1 / ARTIFACT_FLOOR) {
    return {
      ...base,
      ciLow,
      ciHigh,
      verdict: 'b-faster',
      note: `B 快 ${((1 / ratio - 1) * 100).toFixed(1)}%（95% CI [${(1 / ciHigh).toFixed(3)}, ${(1 / ciLow).toFixed(3)}]×，效应越过伪影地板 ${ARTIFACT_FLOOR}）`,
    };
  }
  if (ciLow > 1 && ratio >= ARTIFACT_FLOOR) {
    return {
      ...base,
      ciLow,
      ciHigh,
      verdict: 'b-slower',
      note: `B 慢 ${((ratio - 1) * 100).toFixed(1)}%（95% CI [${ciLow.toFixed(3)}, ${ciHigh.toFixed(3)}]×，效应越过伪影地板）`,
    };
  }
  const floorBounded =
    (ciHigh < 1 && ratio > 1 / ARTIFACT_FLOOR) || (ciLow > 1 && ratio < ARTIFACT_FLOOR);
  return {
    ...base,
    ciLow,
    ciHigh,
    verdict: 'no-difference',
    note: floorBounded
      ? '区间排除 1 但效应量在伪影地板以内——按地板纪律不判差'
      : '95% CI 含 1——无充分证据判定差异',
  };
}
