/**
 * cross-backend-consensus —— 跨后端结果融合与交叉验证统计器（R14 创新，opt-in）
 *
 * ============ 定位 ============
 *
 * solve.ts 的三道闸门是**单后端**质量管线：一次运行、一个后端、一个
 * optimality 对照。本模块把同一调度问题在**多个后端**（本地精确引擎 /
 * D-Wave / 门型机导出回灌 / 任何 QuantumBackend 实现）上的采样结果放到
 * 一起，产出交叉验证统计：
 *
 *   - 融合计数：跨后端按分配聚合出现次数，选出共识胜者（福利优先，
 *     平局取融合出现次数，再平局取字典序——与 solve.ts 的平局规则
 *     差异见下方「与既有闸门的关系」）；
 *   - 逐后端一致性面：valid/invalid 占比、顶层分配、顶层频率的 Wilson
 *     score 区间、与共识胜者的重合度；
 *   - 两两一致性面：后端间频率分布的 Kendall tau-b（并列修正）与
 *     总变差距离（TVD）。
 *
 * ============ 与既有闸门的关系（不重复、不替代） ============
 *
 * - 本模块**不做**合法性修复、**不做**最优率对照（那是 solve.ts +
 *   bruteForceOptimum/buildSubspaceModel 的职责）；它消费的是与第一道
 *   闸门同口径的解码语义（下方 decodeAssignmentFromSpins 与 solve.ts
 *   的内联解码逐点同义：z=-1 ↔ x=1，逐任务 one-hot，违约记 -1）。
 * - 默认路径**零接触**：本文件不被任何既有文件 import；编排者显式
 *   接线（新文件 import 既有模块是允许方向）。
 * - 刻意的口径差异（逐条如实声明）：
 *   1. occurrences 与 spins 长度不一致 → 本模块**点名拒绝**（统计证据
 *      不允许静默缺省计数）；solve.ts 容忍缺省为 1（`?? 1`）——那是
 *      单次求解的容错姿态，这里是多份证据的对账姿态。
 *   2. 顶层平局：solve.ts 取 stateStats 首见项；本模块在跨后端融合后
 *      取字典序最小——多后端场景下首见序依赖调用方传入的报告顺序，
 *      字典序才与传入顺序无关。
 *   3. 频率分母与 solve.ts 的 sampleFrequency 同口径：全部出现次数
 *      （含非法样本），使跨后端频率可直接与单次运行报告对读。
 *   4. 错长自旋行 / 非 ±1 数值 → 按 solve.ts 同口径计为非法样本
 *      （非 ±1 值在 `=== -1` 判定下解码为未选中，与既有闸门逐点同义），
 *      不拒收输入。
 *
 * ============ 诚实的边界 ============
 *
 * - Wilson 区间是频率的置信区间，不是「真分配概率」的界；后端采样
 *   相关（同一硬件重复运行）时区间偏窄，读数按独立 Bernoulli 近似
 *   报告，不做相关性建模。
 * - Kendall tau-b 在计数并列（含缺席=0）上定义；全并列或单一候选时
 *   返回 null（无定义），不伪造 0。
 * - 复杂度：聚合 O(ΣS)（S=各后端样本数）；两两统计 O(B²·K²)
 *   （B=后端数，K=并集分配数）——K 由唯一合法分配数封顶，通常远小于
 *   采样总数。
 * - 无 RNG；Map 按插入序、并集支撑按键排序遍历，输出确定性。
 */

import type { AssignmentProblem } from '../quantum-optimizer.js';
import { validateAssignmentProblem, isValidAssignment, welfareOf } from '../quantum-optimizer.js';
import type { QpuSampleSet } from './quantum-backend.js';
import { BackendError, QuantumEstimateError } from '../../utils/errors.js';
import { WELFARE_COMPARISON_EPSILON } from '../../utils/numeric.js';

/** 单个后端的采样报告（backend 名必须唯一非空） */
export interface BackendSampleReport {
  readonly backend: string;
  readonly samples: QpuSampleSet;
}

/** Wilson score 区间（[low, high] ⊆ [0,1]，center 为区间中心） */
export interface WilsonInterval {
  readonly center: number;
  readonly low: number;
  readonly high: number;
}

export interface CrossBackendOptions {
  /**
   * Wilson 区间的正态分位数（双尾）。缺省 1.959963984540054（95%）。
   * 必须为正有限数。
   */
  readonly z?: number;
}

/** 逐后端一致性统计 */
export interface BackendAgreementStats {
  readonly backend: string;
  /** 合法样本出现次数（与第一道闸门同口径解码） */
  readonly validOccurrences: number;
  /** 非法样本出现次数（错长行/one-hot 违约/资格与复用违约，solve.ts 同口径） */
  readonly invalidOccurrences: number;
  /** 该后端观察到的唯一合法分配数 */
  readonly uniqueAssignments: number;
  /** 该后端内部的顶层分配（福利优先→次数→字典序）；零合法样本时为 null */
  readonly topAssignment: number[] | null;
  /** 顶层分配频率 = 顶层出现次数 / 全部出现次数（与 solve.ts sampleFrequency 同分母） */
  readonly topFrequency: number;
  /** 顶层频率的 Wilson 区间 */
  readonly topFrequencyWilson: WilsonInterval;
  /** 共识胜者在该后端合法样本中的占比；零合法样本时为 0 */
  readonly consensusShare: number;
  /** 该后端顶层分配是否与共识胜者同一（键级比较） */
  readonly agreesWithConsensus: boolean;
}

/** 两两一致性统计 */
export interface PairwiseAgreement {
  readonly a: string;
  readonly b: string;
  /**
   * 频率排名的 Kendall tau-b（并列修正；缺席分配计 0）。
   * null = 无定义（并集只有 0/1 个候选，或某一侧计数全并列）。
   */
  readonly kendallTauB: number | null;
  /**
   * 合法频率分布的总变差距离 0.5·Σ|p_a − p_b|（并集支撑上）。
   * null = 任一侧零合法样本（分布未定义）。
   */
  readonly totalVariation: number | null;
}

export interface ConsensusResult {
  /** 共识胜者分配（福利优先→融合次数→字典序）；零合法样本（全体）时为 [] */
  readonly assignment: number[];
  readonly welfare: number;
  /** 融合后落到共识胜者的出现次数 */
  readonly fusedOccurrences: number;
  /** 融合总出现次数（全部后端全部样本，含非法） */
  readonly totalOccurrences: number;
  /** 共识胜者频率（与 solve.ts sampleFrequency 同分母口径） */
  readonly fusedFrequency: number;
  readonly fusedFrequencyWilson: WilsonInterval;
  readonly perBackend: BackendAgreementStats[];
  readonly pairwise: PairwiseAgreement[];
  /** 任一后端顶层 ≠ 共识胜者，或任一后端零合法样本 */
  readonly disagreement: boolean;
}

/** 默认 z：95% 双尾正态分位数 */
export const WILSON_Z_95 = 1.959963984540054;

/** Wilson score 区间（k 成功 / n 试验，z 正态分位数） */
export function wilsonInterval(k: number, n: number, z: number): WilsonInterval {
  if (!Number.isInteger(k) || !Number.isInteger(n) || n < 1 || k < 0 || k > n) {
    throw new QuantumEstimateError(
      `wilsonInterval: need integers 0 <= k <= n with n >= 1, got k=${k}, n=${n}`,
    );
  }
  if (!(z > 0) || !Number.isFinite(z)) {
    throw new QuantumEstimateError(`wilsonInterval: z must be a positive finite number, got ${z}`);
  }
  const p = k / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return {
    center,
    low: Math.max(0, center - half),
    high: Math.min(1, center + half),
  };
}

// ----------------------------------------------------------------------------
// 解码（与 solve.ts 内联解码逐点同义——z=-1 ↔ x=1，逐任务 one-hot）
// ----------------------------------------------------------------------------

/**
 * 自旋向量 → 分配候选（含 -1 哨兵）。错长输入由调用方按非法样本计数
 * （solve.ts 同口径）；本函数假定长度已核。
 */
function decodeAssignmentFromSpins(spins: number[], m: number, n: number): number[] {
  const assignment = new Array<number>(m).fill(-1);
  for (let t = 0; t < m; t++) {
    let chosen = -1;
    for (let a = 0; a < n; a++) {
      if (spins[t * n + a] === -1) {
        if (chosen >= 0) {
          chosen = -1; // one-hot 违约
          break;
        }
        chosen = a;
      }
    }
    assignment[t] = chosen;
  }
  return assignment;
}

// ----------------------------------------------------------------------------
// 聚合
// ----------------------------------------------------------------------------

interface AggregatedBackend {
  readonly backend: string;
  /** key → 出现次数（仅合法分配；键 = assignment.join(',')） */
  readonly counts: Map<string, number>;
  /** key → assignment（首见建档；合法键全为非负索引，键空间无碰撞） */
  readonly assignments: Map<string, number[]>;
  /** key → welfare（首见建档；welfare 是分配的纯函数，键相同则值相同） */
  readonly welfares: Map<string, number>;
  readonly validOccurrences: number;
  readonly invalidOccurrences: number;
  readonly totalOccurrences: number;
}

/** 顶层比较器：福利（ε 容差，与 solve.ts 同常数）→ 次数 → 字典序。
 * 返回 >0 表示 a 优于 b。 */
function compareTop(
  a: { welfare: number; count: number; assignment: number[] },
  b: { welfare: number; count: number; assignment: number[] },
): number {
  if (a.welfare > b.welfare + WELFARE_COMPARISON_EPSILON) return 1;
  if (b.welfare > a.welfare + WELFARE_COMPARISON_EPSILON) return -1;
  if (a.count !== b.count) return a.count > b.count ? 1 : -1;
  const len = Math.min(a.assignment.length, b.assignment.length);
  for (let i = 0; i < len; i++) {
    const av = a.assignment[i]!;
    const bv = b.assignment[i]!;
    if (av !== bv) return av < bv ? 1 : -1;
  }
  return 0;
}

/**
 * 单后端聚合：解码 → 合法性（无效键局部备忘，与 solve.ts 的 invalidKeys
 * 备忘同思路；备忘是**本函数局部状态**，保证可重入/跨问题零泄漏）→
 * 按分配累计出现次数。
 */
function aggregateBackend(
  problem: AssignmentProblem,
  report: BackendSampleReport,
): AggregatedBackend {
  const m = problem.taskIds.length;
  const n = problem.agentIds.length;
  const nqubits = m * n;
  const { samples } = report;
  if (samples.spins.length === 0) {
    throw new BackendError(
      `crossBackendConsensus: backend '${report.backend}' returned 0 samples; ` +
        'an empty sample set has no frequency evidence to reconcile',
    );
  }
  if (samples.occurrences.length !== samples.spins.length) {
    throw new BackendError(
      `crossBackendConsensus: backend '${report.backend}' has ${samples.spins.length} spins ` +
        `but ${samples.occurrences.length} occurrences; mismatched count arrays would falsify ` +
        'every frequency statistic (solve.ts tolerates ?? 1 for single-run gates; consensus does not)',
    );
  }

  const counts = new Map<string, number>();
  const assignments = new Map<string, number[]>();
  const welfares = new Map<string, number>();
  const invalidKeys = new Set<string>();
  let valid = 0;
  let invalid = 0;
  for (let s = 0; s < samples.spins.length; s++) {
    const spins = samples.spins[s]!;
    const occ = samples.occurrences[s]!;
    // 出现计数是统计的计量单位：负数/NaN/Infinity 不是「退化证据」而是
    // 伪造证据（D-Wave 路径已 asNumberArray 校验；自定义后端不保证）
    if (!Number.isFinite(occ) || occ < 0) {
      throw new BackendError(
        `crossBackendConsensus: backend '${report.backend}' sample ${s} has a non-finite ` +
          `or negative occurrence count (${occ}); counts are the unit of evidence, ` +
          'garbage here falsifies every downstream statistic',
      );
    }
    if (spins.length !== nqubits) {
      invalid += occ; // solve.ts 同口径：错长行是非法样本，不是拒收输入
      continue;
    }
    const assignment = decodeAssignmentFromSpins(spins, m, n);
    const key = assignment.join(',');
    if (invalidKeys.has(key)) {
      invalid += occ; // 备忘命中：同键重复无效样本不重验，按次数累计
      continue;
    }
    if (!counts.has(key)) {
      if (!isValidAssignment(problem, assignment)) {
        invalidKeys.add(key);
        invalid += occ;
        continue;
      }
      counts.set(key, 0);
      assignments.set(key, assignment);
      welfares.set(key, welfareOf(problem, assignment));
    }
    counts.set(key, counts.get(key)! + occ);
    valid += occ;
  }
  if (valid + invalid === 0) {
    throw new BackendError(
      `crossBackendConsensus: backend '${report.backend}' carries samples but zero total ` +
        'occurrences; there is no frequency evidence to reconcile',
    );
  }
  return {
    backend: report.backend,
    counts,
    assignments,
    welfares,
    validOccurrences: valid,
    invalidOccurrences: invalid,
    totalOccurrences: valid + invalid,
  };
}

// ----------------------------------------------------------------------------

/**
 * 跨后端共识与交叉验证统计。
 *
 * 输入：同一 AssignmentProblem 在 ≥1 个后端上的采样报告（backend 名唯一）。
 * 输出：共识胜者 + 逐后端一致性面 + 两两 tau-b/TVD。全确定性、无 RNG。
 */
export function crossBackendConsensus(
  problem: AssignmentProblem,
  reports: readonly BackendSampleReport[],
  options: CrossBackendOptions = {},
): ConsensusResult {
  validateAssignmentProblem(problem);
  if (reports.length === 0) {
    throw new BackendError(
      'crossBackendConsensus: need at least one backend report (got 0); ' +
        'cross-validation over an empty evidence pool has no meaning',
    );
  }
  const seen = new Set<string>();
  for (const report of reports) {
    if (typeof report.backend !== 'string' || report.backend.length === 0) {
      throw new BackendError(
        `crossBackendConsensus: backend name must be a non-empty string, got ${String(report.backend)}`,
      );
    }
    if (seen.has(report.backend)) {
      throw new BackendError(
        `crossBackendConsensus: duplicate backend name '${report.backend}' — ` +
          'per-backend and pairwise statistics are keyed by name',
      );
    }
    seen.add(report.backend);
  }
  const z = options.z ?? WILSON_Z_95;
  if (!(z > 0) || !Number.isFinite(z)) {
    throw new QuantumEstimateError(
      `crossBackendConsensus: options.z must be a positive finite number, got ${z}`,
    );
  }

  const aggregated = reports.map((r) => aggregateBackend(problem, r));

  // ---- 融合计数与共识胜者 ----
  const fusedCounts = new Map<string, number>();
  for (const agg of aggregated) {
    for (const [key, count] of agg.counts) {
      fusedCounts.set(key, (fusedCounts.get(key) ?? 0) + count);
    }
  }
  let totalOccurrences = 0;
  for (const agg of aggregated) totalOccurrences += agg.totalOccurrences;

  let consensusKey: string | null = null;
  let consensusBest: { welfare: number; count: number; assignment: number[] } | null = null;
  if (fusedCounts.size > 0) {
    for (const [key, count] of fusedCounts) {
      const candidate = {
        welfare: firstWelfareOf(aggregated, key),
        count,
        assignment: firstAssignmentOf(aggregated, key),
      };
      if (consensusBest === null || compareTop(candidate, consensusBest) > 0) {
        consensusBest = candidate;
        consensusKey = key;
      }
    }
  }

  // ---- 逐后端一致性面 ----
  const perBackend: BackendAgreementStats[] = aggregated.map((agg) => {
    let topKey: string | null = null;
    let topBest: { welfare: number; count: number; assignment: number[] } | null = null;
    for (const [key, count] of agg.counts) {
      const candidate = {
        welfare: agg.welfares.get(key)!,
        count,
        assignment: agg.assignments.get(key)!,
      };
      if (topBest === null || compareTop(candidate, topBest) > 0) {
        topBest = candidate;
        topKey = key;
      }
    }
    const topCount = topKey === null ? 0 : agg.counts.get(topKey)!;
    const share =
      agg.validOccurrences === 0 || consensusKey === null
        ? 0
        : (agg.counts.get(consensusKey) ?? 0) / agg.validOccurrences;
    return {
      backend: agg.backend,
      validOccurrences: agg.validOccurrences,
      invalidOccurrences: agg.invalidOccurrences,
      uniqueAssignments: agg.counts.size,
      topAssignment: topBest === null ? null : topBest.assignment,
      topFrequency: topCount / agg.totalOccurrences,
      topFrequencyWilson: wilsonInterval(topCount, agg.totalOccurrences, z),
      consensusShare: share,
      agreesWithConsensus: topKey !== null && topKey === consensusKey,
    };
  });

  // ---- 两两 tau-b / TVD ----
  const pairwise: PairwiseAgreement[] = [];
  for (let i = 0; i < aggregated.length; i++) {
    for (let j = i + 1; j < aggregated.length; j++) {
      pairwise.push(pairwiseOf(aggregated[i]!, aggregated[j]!));
    }
  }

  const fusedCount = consensusKey === null ? 0 : fusedCounts.get(consensusKey)!;
  const zeroValidBackend = aggregated.some((agg) => agg.validOccurrences === 0);
  return {
    assignment: consensusBest === null ? [] : consensusBest.assignment,
    welfare: consensusBest === null ? 0 : consensusBest.welfare,
    fusedOccurrences: fusedCount,
    totalOccurrences,
    fusedFrequency: fusedCount / totalOccurrences,
    fusedFrequencyWilson: wilsonInterval(fusedCount, totalOccurrences, z),
    perBackend,
    pairwise,
    disagreement:
      consensusKey === null || zeroValidBackend || perBackend.some((s) => !s.agreesWithConsensus),
  };
}

function firstWelfareOf(aggregated: AggregatedBackend[], key: string): number {
  for (const agg of aggregated) {
    const w = agg.welfares.get(key);
    if (w !== undefined) return w;
  }
  throw new BackendError(`crossBackendConsensus: internal invariant broken (welfare of '${key}')`);
}

function firstAssignmentOf(aggregated: AggregatedBackend[], key: string): number[] {
  for (const agg of aggregated) {
    const a = agg.assignments.get(key);
    if (a !== undefined) return a;
  }
  throw new BackendError(
    `crossBackendConsensus: internal invariant broken (assignment of '${key}')`,
  );
}

// ----------------------------------------------------------------------------
// 两两统计
// ----------------------------------------------------------------------------

function pairwiseOf(a: AggregatedBackend, b: AggregatedBackend): PairwiseAgreement {
  const keys = new Set<string>([...a.counts.keys(), ...b.counts.keys()]);
  const sortedKeys = [...keys].sort(); // 并集支撑的确定性遍历序
  const xa = sortedKeys.map((k) => a.counts.get(k) ?? 0);
  const xb = sortedKeys.map((k) => b.counts.get(k) ?? 0);

  // Kendall tau-b（计数并列修正）
  const K = sortedKeys.length;
  let concordant = 0;
  let discordant = 0;
  const tieGroupsA = new Map<number, number>();
  const tieGroupsB = new Map<number, number>();
  for (let i = 0; i < K; i++) {
    tieGroupsA.set(xa[i]!, (tieGroupsA.get(xa[i]!) ?? 0) + 1);
    tieGroupsB.set(xb[i]!, (tieGroupsB.get(xb[i]!) ?? 0) + 1);
    for (let j = i + 1; j < K; j++) {
      const dx = xa[i]! - xa[j]!;
      const dy = xb[i]! - xb[j]!;
      if (dx === 0 || dy === 0) continue;
      if (dx * dy > 0) concordant++;
      else discordant++;
    }
  }
  const n0 = (K * (K - 1)) / 2;
  let tiesA = 0;
  for (const c of tieGroupsA.values()) tiesA += (c * (c - 1)) / 2;
  let tiesB = 0;
  for (const c of tieGroupsB.values()) tiesB += (c * (c - 1)) / 2;
  const denomA = n0 - tiesA;
  const denomB = n0 - tiesB;
  const kendallTauB =
    denomA === 0 || denomB === 0 ? null : (concordant - discordant) / Math.sqrt(denomA * denomB);

  // TVD（合法频率分布；任一侧零合法样本 → 未定义）
  let tvd = 0;
  if (a.validOccurrences > 0 && b.validOccurrences > 0) {
    for (let i = 0; i < K; i++) {
      const pa = xa[i]! / a.validOccurrences;
      const pb = xb[i]! / b.validOccurrences;
      tvd += Math.abs(pa - pb);
    }
    tvd *= 0.5;
  }
  return {
    a: a.backend,
    b: b.backend,
    kendallTauB,
    totalVariation: a.validOccurrences === 0 || b.validOccurrences === 0 ? null : tvd,
  };
}
