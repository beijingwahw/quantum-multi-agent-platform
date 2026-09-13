/**
 * readout-mitigation —— QPU 读出误差缓解解码器（R14 创新，opt-in）
 *
 * ============ 定位 ============
 *
 * solve.ts 的第一道闸门对非法样本的处置是**丢弃并计数**（刻意不修复：
 * 修复产物不是测量结果）。这个姿态对「把解交给调度器」是对的，但它把
 * 真实硬件读出误差下的统计证据整块扔掉了：在对称读出翻转噪声下，一次
 * 观测到 one-hot 违约的样本，完全可能来自一个合法分配——只是若干比特
 * 被读翻了。本模块在**不改变闸门默认行为**的前提下，提供一个显式
 * opt-in 的统计估计器，把这些证据按噪声模型重新归账：
 *
 *   1. MAP 解码（mapDecodeAssignment）：给定单条观测自旋向量，在全部
 *      合法分配中找 Hamming 距离最近者——对称独立翻转噪声 + 合法分配
 *      均匀先验下的最大后验解码。关键结构：Hamming 距离按任务块可分
 *      （d = Σ_t cost_t[A_t]，cost_t 有闭式，见 hammingBlockCosts），
 *      于是 MAP 解码 = 一个线性分配问题，复用本仓 O(m³) 匈牙利精确求解
 *      （classical-baselines.hungarianAssignment）——不需要枚举子空间。
 *   2. 后验频率估计（mitigateReadout）：对每个候选合法分配 A，把全部
 *      样本（含非法样本）的出现次数按似然 P(s|A) = f^d·(1−f)^(N−d)
 *      加权（对数空间累加，max-shift 归并），给出缓解后的频率分布、
 *      条件平均距离与质量回收率。
 *
 * ============ 诚实的边界 ============
 *
 * - 噪声模型是**对称独立逐比特翻转**（与 experiments/qpu-cross-validation
 *   X3 干跑 QPU 的 provenance 同族；真实读出混淆矩阵是非对称的，本模块
 *   不声称覆盖）。f ∈ [0, 0.5]：f > 0.5 时似然反序（翻转比保真更频繁），
 *   点名拒绝而不是输出反着的答案。
 * - 输出是**模型下的推断量**（mitigatedCount 是期望计数，不是测量计数），
 *   与闸门的 raw invalidSamples 并排报告（observedInvalidRate）供对读；
 *   绝不回写 solve.ts 的任何默认路径。
 * - 候选集缺省 = 合法解码 ∪ 非法样本的 MAP 解码；这是**支撑受限**的
 *   quasi-后验（recoveredMass < 1 的部分即支撑外质量，如实上报）。
 *   传满候选集可逼近完整后验，成本 O(|C|·S·m)。
 * - 非 ±1 自旋值被点名拒绝（似然距离无定义）；solve.ts 把它们按未选中
 *   解码（容错姿态）——差异刻意且双向声明。
 * - 复杂度：O(S·m·n) 块代价 + O(U·m³) 非法行 MAP（U=唯一非法自旋行数，
 *   按行去重备忘）+ O(|C|·S·m) 似然累加。无 RNG；排序全确定性。
 */

import type { AssignmentProblem } from '../quantum-optimizer.js';
import { validateAssignmentProblem, isValidAssignment, welfareOf } from '../quantum-optimizer.js';
import type { QpuSampleSet } from './quantum-backend.js';
import { hungarianAssignment } from '../classical-baselines.js';
import { BackendError, QuantumEstimateError } from '../../utils/errors.js';

/** MAP 解码结果：最近合法分配 + 距离 + 闭式块代价（诊断面） */
export interface MapDecodeResult {
  readonly assignment: number[];
  /** 观测自旋与该分配规范化自旋的总 Hamming 距离（= Σ_t blockCosts[t][A_t]） */
  readonly hammingDistance: number;
  readonly blockCosts: number[][];
}

/**
 * 任务块 Hamming 代价的闭式：观测块内 −1 记数为 k，则
 *   cost[t][a] = k + 1 − 2·[观测(t,a) = −1]
 * （分配 A_t = a 的规范化自旋在 (t,a) 处为 −1、块内其余为 +1；每错一
 * 格记 1）。值域 [0, n+1]；资格由求解方经掩码排除（代价本身不编码资格）。
 */
export function hammingBlockCosts(problem: AssignmentProblem, spins: number[]): number[][] {
  const m = problem.taskIds.length;
  const n = problem.agentIds.length;
  const nqubits = m * n;
  if (spins.length !== nqubits) {
    throw new BackendError(
      `hammingBlockCosts: spins length ${spins.length} != m*n = ${nqubits}; ` +
        'the closed form is defined block-by-block on the full spin vector',
    );
  }
  const costs: number[][] = [];
  for (let t = 0; t < m; t++) {
    let neg = 0;
    for (let a = 0; a < n; a++) {
      const v = spins[t * n + a]!;
      assertSpin(v, `spins[${t * n + a}]`);
      if (v === -1) neg++;
    }
    const row = new Array<number>(n);
    for (let a = 0; a < n; a++) {
      row[a] = spins[t * n + a] === -1 ? neg - 1 : neg + 1;
    }
    costs.push(row);
  }
  return costs;
}

function assertSpin(v: number, where: string): void {
  if (v !== 1 && v !== -1) {
    throw new BackendError(
      `readout-mitigation: ${where} = ${v}; spins must be exactly ±1 ` +
        '(Hamming distance to a one-hot pattern is undefined otherwise; ' +
        'solve.ts decodes non-±1 as unselected — a different, documented posture)',
    );
  }
}

/**
 * MAP 解码：合法分配中与观测 Hamming 最近者（对称翻转噪声 + 均匀先验）。
 * 块可分闭式 + 匈牙利精确求解，O(m³)；资格掩码经 ineligible 直传
 * （BIG = m(n+1)+1 严格支配任意可行总代价 m(n+1)，可行性判定不失真）。
 * 无可行分配时透传 hungarianAssignment 的 InfeasibleProblemError。
 */
export function mapDecodeAssignment(problem: AssignmentProblem, spins: number[]): MapDecodeResult {
  validateAssignmentProblem(problem);
  const blockCosts = hammingBlockCosts(problem, spins);
  // hungarianAssignment 最大化 Σ weights → 传负代价即最小化 Σ cost
  const negated = blockCosts.map((row) => row.map((c) => -c));
  const assignment = hungarianAssignment(negated, problem.ineligible);
  let d = 0;
  for (let t = 0; t < assignment.length; t++) {
    const a = assignment[t]!;
    if (a < 0) {
      throw new BackendError(
        `readout-mitigation: mapDecodeAssignment got an unassigned task ${t}; ` +
          'infeasible instances must surface as InfeasibleProblemError, not sentinel rows',
      );
    }
    d += blockCosts[t]![a]!;
  }
  return { assignment, hammingDistance: d, blockCosts };
}

// ----------------------------------------------------------------------------
// 后验频率估计
// ----------------------------------------------------------------------------

export interface MitigatedCandidate {
  readonly assignment: number[];
  readonly welfare: number;
  /** 直接（naive）解码落到该分配的出现次数——与闸门口径可对读的锚 */
  readonly naiveCount: number;
  /** Σ_s occ_s·P(s|A)（期望计数，浮点；对数空间累加后指数化） */
  readonly mitigatedCount: number;
  readonly mitigatedFrequency: number;
  /** 条件平均 Hamming 距离 Σ_s occ·P(s|A)·d / mitigatedCount；零质量为 null */
  readonly meanHammingDistance: number | null;
}

export interface MitigationReport {
  readonly flipProb: number;
  /** 全部样本出现次数之和（含非法） */
  readonly totalReads: number;
  /** 候选按缓解计数降序（平局福利降序→字典序） */
  readonly candidates: MitigatedCandidate[];
  /** Σ mitigatedCount / totalReads ∈ [0,1]：模型质量落到候选集的比例 */
  readonly recoveredMass: number;
  /** naive 闸门口径的非法样本率（invalidOcc / totalReads），供对读 */
  readonly observedInvalidRate: number;
}

export interface MitigateReadoutOptions {
  /**
   * 候选合法分配集。缺省 = 合法解码 ∪ 非法样本的 MAP 解码（支撑受限
   * quasi-后验）；传入显式清单（如子空间 top-K）可扩大支撑。
   */
  readonly candidates?: readonly number[][];
}

/** 似然权重的 max-shift 归并：count = Σ w，meanD = Σ w·d / Σ w */
function accumulate(
  logTerms: readonly number[],
  ds: readonly number[],
): { count: number; meanD: number | null } {
  let max = Number.NEGATIVE_INFINITY;
  for (const t of logTerms) if (t > max) max = t;
  if (max === Number.NEGATIVE_INFINITY) return { count: 0, meanD: null };
  let sumW = 0;
  let sumWD = 0;
  for (let i = 0; i < logTerms.length; i++) {
    const t = logTerms[i]!;
    if (t === Number.NEGATIVE_INFINITY) continue;
    const w = Math.exp(t - max);
    sumW += w;
    sumWD += w * ds[i]!;
  }
  return { count: Math.exp(max + Math.log(sumW)), meanD: sumWD / sumW };
}

/**
 * 读出误差缓解的频率估计。f = 0 退化为 naive 计数（无噪声锚点）。
 */
export function mitigateReadout(
  problem: AssignmentProblem,
  samples: QpuSampleSet,
  flipProb: number,
  options: MitigateReadoutOptions = {},
): MitigationReport {
  validateAssignmentProblem(problem);
  if (!(flipProb >= 0 && flipProb <= 0.5) || !Number.isFinite(flipProb)) {
    throw new QuantumEstimateError(
      `mitigateReadout: flipProb must be in [0, 0.5] (beyond 0.5 the symmetric-flip ` +
        `likelihood inverts — nearest-neighbor decoding would return the anti-solution), got ${flipProb}`,
    );
  }
  const m = problem.taskIds.length;
  const n = problem.agentIds.length;
  const nqubits = m * n;
  if (samples.spins.length === 0) {
    throw new BackendError(
      'mitigateReadout: sample set carries 0 spins; there is no evidence to re-weight',
    );
  }
  if (samples.occurrences.length !== samples.spins.length) {
    throw new BackendError(
      `mitigateReadout: ${samples.spins.length} spins vs ${samples.occurrences.length} ` +
        'occurrences; mismatched counts would falsify every likelihood weight',
    );
  }

  // ---- 逐样本：块代价（长度/±1 在此点名拒绝）+ naive 解码 + 非法样本 MAP 备忘 ----
  const blockCostsPerSample: number[][][] = [];
  const naiveCounts = new Map<string, number>();
  const candidateAssignments = new Map<string, number[]>();
  const mapMemo = new Map<string, number[]>(); // 非法自旋行 → MAP 解码（按行去重）
  let totalReads = 0;
  let invalidOcc = 0;
  for (let s = 0; s < samples.spins.length; s++) {
    const spins = samples.spins[s]!;
    const occ = samples.occurrences[s]!;
    if (!Number.isFinite(occ) || occ < 0) {
      throw new BackendError(
        `mitigateReadout: sample ${s} has a non-finite or negative occurrence count ` +
          `(${occ}); counts are the unit of evidence, garbage here falsifies every weight`,
      );
    }
    totalReads += occ;
    const blockCosts = hammingBlockCosts(problem, spins);
    blockCostsPerSample.push(blockCosts);
    const assignment = decodeNaive(spins, m, n);
    const key = assignment.join(',');
    if (isValidAssignment(problem, assignment)) {
      naiveCounts.set(key, (naiveCounts.get(key) ?? 0) + occ);
      if (!candidateAssignments.has(key)) candidateAssignments.set(key, assignment);
    } else {
      invalidOcc += occ;
      const spinKey = spins.join(',');
      let decoded = mapMemo.get(spinKey);
      if (decoded === undefined) {
        decoded = mapDecodeAssignment(problem, spins).assignment;
        mapMemo.set(spinKey, decoded);
      }
      const dkey = decoded.join(',');
      if (!candidateAssignments.has(dkey)) candidateAssignments.set(dkey, decoded);
    }
  }
  if (totalReads === 0) {
    throw new BackendError(
      'mitigateReadout: sample set carries spins but zero total occurrences; ' +
        'there is no evidence to re-weight',
    );
  }

  // ---- 候选集（显式清单或缺省并集）----
  let candidates: number[][];
  if (options.candidates !== undefined) {
    if (options.candidates.length === 0) {
      throw new BackendError(
        'mitigateReadout: options.candidates is empty; a posterior over zero states is not an estimate',
      );
    }
    const seen = new Set<string>();
    candidates = [];
    for (let i = 0; i < options.candidates.length; i++) {
      const c = options.candidates[i]!;
      if (!Array.isArray(c) || c.length !== m) {
        throw new BackendError(
          `mitigateReadout: candidates[${i}] must be an array of length m=${m}, got ${String(c)}`,
        );
      }
      if (!isValidAssignment(problem, c)) {
        throw new BackendError(
          `mitigateReadout: candidates[${i}] = [${c.join(',')}] is not a valid assignment ` +
            '(one-hot/eligibility/no-reuse); the likelihood model is defined over valid states only',
        );
      }
      const key = c.join(',');
      if (!seen.has(key)) {
        seen.add(key);
        candidates.push(c);
      }
    }
  } else {
    candidates = [...candidateAssignments.values()];
  }

  // ---- 对数空间似然累加（max-shift 归并，含条件平均距离）----
  const logF = flipProb > 0 ? Math.log(flipProb) : 0; // f=0 走 d===0 特例
  const logStay = Math.log(1 - flipProb); // f ≤ 0.5 → 有限
  const distances = new Array<number>(samples.spins.length);
  interface Accrued {
    assignment: number[];
    welfare: number;
    naiveCount: number;
    mitigatedCount: number;
    meanHammingDistance: number | null;
  }
  const accrued: Accrued[] = [];
  let totalWeight = 0;
  for (const assignment of candidates) {
    if (flipProb === 0) {
      // f=0 无噪声锚点：只有 d=0 的样本贡献质量，且贡献恰为其出现次数
      //（绕过 log→exp 往返的浮点尘，锚点必须精确等于 naive 计数）
      let count = 0;
      for (let s = 0; s < samples.spins.length; s++) {
        const blockCosts = blockCostsPerSample[s]!;
        let d = 0;
        for (let t = 0; t < m; t++) d += blockCosts[t]![assignment[t]!]!;
        if (d === 0) count += samples.occurrences[s]!;
      }
      totalWeight += count;
      accrued.push({
        assignment,
        welfare: welfareOf(problem, assignment),
        naiveCount: naiveCounts.get(assignment.join(',')) ?? 0,
        mitigatedCount: count,
        meanHammingDistance: count > 0 ? 0 : null,
      });
      continue;
    }
    const logTerms: number[] = [];
    for (let s = 0; s < samples.spins.length; s++) {
      const blockCosts = blockCostsPerSample[s]!;
      const occ = samples.occurrences[s]!;
      let d = 0;
      for (let t = 0; t < m; t++) d += blockCosts[t]![assignment[t]!]!;
      distances[s] = d;
      logTerms.push(Math.log(occ) + d * logF + (nqubits - d) * logStay);
    }
    const { count, meanD } = accumulate(logTerms, distances);
    totalWeight += count;
    accrued.push({
      assignment,
      welfare: welfareOf(problem, assignment),
      naiveCount: naiveCounts.get(assignment.join(',')) ?? 0,
      mitigatedCount: count,
      meanHammingDistance: meanD,
    });
  }
  const results: MitigatedCandidate[] = accrued.map((a) => ({
    ...a,
    mitigatedFrequency: totalWeight > 0 ? a.mitigatedCount / totalWeight : 0,
  }));

  results.sort(compareCandidates);
  return {
    flipProb,
    totalReads,
    candidates: results,
    recoveredMass: totalWeight / totalReads,
    observedInvalidRate: invalidOcc / totalReads,
  };
}

/** 候选排序：缓解计数降序 → 福利降序 → 字典序升（全确定性） */
function compareCandidates(a: MitigatedCandidate, b: MitigatedCandidate): number {
  if (a.mitigatedCount !== b.mitigatedCount) return a.mitigatedCount > b.mitigatedCount ? -1 : 1;
  if (a.welfare !== b.welfare) return a.welfare > b.welfare ? -1 : 1;
  const len = Math.min(a.assignment.length, b.assignment.length);
  for (let i = 0; i < len; i++) {
    const av = a.assignment[i]!;
    const bv = b.assignment[i]!;
    if (av !== bv) return av < bv ? -1 : 1;
  }
  return 0;
}

/** naive 解码（与 solve.ts 内联解码逐点同义；长度已由块代价断言） */
function decodeNaive(spins: number[], m: number, n: number): number[] {
  const assignment = new Array<number>(m).fill(-1);
  for (let t = 0; t < m; t++) {
    let chosen = -1;
    for (let a = 0; a < n; a++) {
      if (spins[t * n + a] === -1) {
        if (chosen >= 0) {
          chosen = -1;
          break;
        }
        chosen = a;
      }
    }
    assignment[t] = chosen;
  }
  return assignment;
}
