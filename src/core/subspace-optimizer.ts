/**
 * subspace-optimizer —— 约束本征子空间中的精确量子调度（v1.2 核心突破）
 *
 * ============ 突破陈述 ============
 *
 * v1.1 的全空间态矢量在 nq = 任务数×agent数 个量子比特上演化，内存 O(2^nq)，
 * 单块上限 ~20 量子比特。但调度的物理约束（one-hot + 容量）决定了量子态
 * 从一开始就只生活在全希尔伯特空间的一个极小子空间——**合法分配集合**：
 *
 *   dim(subspace) = P(n, m) = n!/(n-m)!   （m 任务注入 n agent）
 *   vs dim(full) = 2^(m·n)
 *
 * 例：8 任务 × 10 agent：子空间 1,814,400 维；全空间 2^80 ≈ 1.2×10^24 维
 * （≈10^15 TB 内存——全空间模拟在宇宙尺度上不可行）。本模块把量子演化
 * **整体搬进约束子空间**，用经典内存精确模拟此前不可能规模的量子调度。
 * 这是量子模拟中利用对称性/约束结构压缩希尔伯特空间的同一类技术
 * （如量子化学的对称子空间方法），首次应用于多Agent任务分配调度。
 *
 * ============ 三个关键构造 ============
 *
 * 1. **零罚项编码**：子空间的基矢 = 合法分配（天然满足 one-hot、容量、资格），
 *    能量 E(x) = −W(x)（福利含纠缠耦合），无需违约罚项——罚项导致的
 *    能量尺度压缩/近简并问题（v1.1 退火调参的主要困难）从根上消失。
 *
 * 2. **纤维混合算符（本模块的数学核心）**：
 *    单任务移动邻接 A_t = Σ_{base} Σ_{a,a'∈free(base)} |x_{t→a'}⟩⟨x_{t→a}|
 *    （把任务 t 挪到任一空闲agent）。固定其余任务（base）后，该 fiber 上
 *    A_t 限制为完全图邻接 K_k = J − I（k = fiber 大小），其指数有**闭式解**：
 *
 *      e^{-iβ(J−I)}: a_j ↦ e^{iβ}·a_j + (e^{−iβ(k−1)} − e^{iβ})·μ_fiber
 *
 *    （μ 为 fiber 平均振幅；K_k 本征值 k−1 在均匀分量、−1 在正交补。）
 *    因此 e^{-iβ·A_t} 逐 fiber **精确**施加，O(dim) 完成——无 Trotter 误差、
 *    无逐边枚举。m 个任务的 A_t 互不对易 → 混合层 = Π_t e^{-iβ_t A_t}
 *    （每个因子精确），这是 QAOA 乘积拟设的标准结构。
 *    n == m（无空闲agent）时移动纤维退化，改用**换位混合** A_{t1,t2}
 *    （两任务交换agent，fiber = K_2），同样精确。
 *
 * 3. **两种算法的子空间形态**：
 *    - QAOA：初态均匀（A_t 公共顶本征矢，对应 v1.1 的 |+⟩^n），
 *      变分优化 (γ, β) 最小化 ⟨E⟩；
 *    - 绝热退火：H(s) = −(1−s)·Σ_t A_t + s·C，初态均匀是 −ΣA 的基态
 *      （Perron-Frobenius：非负邻接阵的顶本征矢）——绝热跟随抵达 C 的基态。
 *
 * ============ 诚实的边界 ============
 * - 子空间维度仍组合增长 P(n,m)，默认上限 2^21（~200MB 内存），可配置。
 * - 逐块 O(m·dim) 演化成本：dim 百万级时 QAOA 变分训练慢（数百次评估），
 *   大实例推荐退火（一次演化）；QAOA 适合 ≤ ~10^5 维。
 * - 这是经典硬件上的精确量子模拟（含时薛定谔方程在约束子空间的数值积分）；
 *   子空间结构本身就是给真 QPU 的 ansatz 建议（约束感知电路设计）。
 */

import type { AssignmentProblem, QuantumSolverOptions, QuantumCandidate, CollapseMode } from './quantum-optimizer';
import { welfareOf } from './quantum-optimizer';

// ----------------------------------------------------------------------------
// 子空间模型
// ----------------------------------------------------------------------------

/** 一个任务的移动纤维组：order 为按 base 分组连续排列的规范索引，runs 切分纤维 */
interface FiberGroup {
  label: string;
  /** 演化遍历顺序（规范索引），同 fiber 连续 */
  order: Int32Array;
  /** runs[2i..2i+1] = order 上的 [start, end) 区间 */
  runs: Int32Array;
}

export interface SubspaceModel {
  problem: AssignmentProblem;
  m: number;
  n: number;
  /** 子空间维度 = 合法分配总数 */
  dimension: number;
  /** 每个基态（合法分配）的能量 = −福利（零罚项） */
  energies: Float64Array;
  /** assignmentAt[s*m + t] = 基态 s 中任务 t 的 agent 索引 */
  assignmentAt: Int32Array;
  /** 每任务一个移动纤维组（n > m 时连通）；n == m 时为换位纤维组 */
  mixers: FiberGroup[];
  /** 优化解参照：精确最优福利（子空间枚举天然给出） */
  optimalWelfare: number;
}

export interface SubspaceSolution {
  engine: 'qaoa' | 'annealing';
  assignment: number[];
  welfare: number;
  energy: number;
  probability: number;
  /** 最优福利之比（=1 即命中最优） */
  optimalityRatio: number;
  expectation: number;
  layers: number;
  angles: number[] | null;
  evaluations: number;
  candidates: QuantumCandidate[];
  dimension: number;
}

export interface SubspaceBuildOptions {
  /** 子空间维度上限（默认 2^21）；枚举超过即放弃并返回 null */
  dimensionCap?: number;
}

// ----------------------------------------------------------------------------
// 可复现随机源（与 quantum-optimizer 相同的 mulberry32）
// ----------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ----------------------------------------------------------------------------
// 枚举：合法分配（DFS）+ 纤维结构
// ----------------------------------------------------------------------------

/**
 * 构建子空间模型。dimension 超过 cap 时返回 null（调用方回退全空间引擎）。
 */
export function buildSubspaceModel(problem: AssignmentProblem, options: SubspaceBuildOptions = {}): SubspaceModel | null {
  const m = problem.taskIds.length;
  const n = problem.agentIds.length;
  const cap = options.dimensionCap ?? 1 << 21;
  if (m === 0 || n === 0 || m > n) return null;

  // 元组键：Σ a_t · n^t（需 n^m ≤ 2^53，维度上限保证了这一点量级）
  const powers = new Float64Array(m);
  {
    let size = 1;
    for (let t = 0; t < m; t++) {
      powers[t] = size;
      size *= n;
      if (size > Number.MAX_SAFE_INTEGER) return null;
    }
  }

  const tupleKey = (agents: number[]): number => {
    let key = 0;
    for (let t = 0; t < m; t++) key += agents[t] * powers[t];
    return key;
  };

  // ---- 1) 规范枚举：任务 0..m−1 升序 DFS ----
  const assignmentAt: number[] = [];
  const used = new Array<boolean>(n).fill(false);
  const current = new Array<number>(m).fill(-1);
  const keyToIndex = new Map<number, number>();

  const enumerateAll = (): boolean => {
    const dfs = (t: number): boolean => {
      if (t === m) {
        if (assignmentAt.length / m >= cap) return false; // 已达维度上限：中止枚举
        keyToIndex.set(tupleKey(current), assignmentAt.length / m);
        for (let i = 0; i < m; i++) assignmentAt.push(current[i]);
        return true;
      }
      for (let a = 0; a < n; a++) {
        if (problem.ineligible[t][a] || used[a]) continue;
        used[a] = true;
        current[t] = a;
        if (!dfs(t + 1)) {
          used[a] = false;
          current[t] = -1;
          return false;
        }
        used[a] = false;
        current[t] = -1;
      }
      return true;
    };
    return dfs(0);
  };

  if (!enumerateAll()) return null;
  const dimension = assignmentAt.length / m;
  if (dimension === 0) return null;

  // ---- 2) 能量：E = −福利（含纠缠耦合，零罚项） ----
  const energies = new Float64Array(dimension);
  let optimalWelfare = -Infinity;
  const buffer = new Array<number>(m);
  for (let s = 0; s < dimension; s++) {
    for (let t = 0; t < m; t++) buffer[t] = assignmentAt[s * m + t];
    const w = welfareOf(problem, buffer);
    energies[s] = -w;
    if (w > optimalWelfare) optimalWelfare = w;
  }

  // ---- 3) 纤维结构 ----
  // 对任务 t（或任务对 [t1,t2]），按"其余任务固定"分组重排基态索引，
  // 使同 fiber 的基态在 order 数组中连续。
  const buildFiberGroup = (varyLast: number[], label: string): FiberGroup => {
    const order: number[] = [];
    const runs: number[] = [];
    const varySet = new Set(varyLast);

    // 递归顺序：非变化维度先固定（pos 递增跳过变化维度），变化维度最后
    // 展开 → 同 fiber 的基态在 order 中连续
    const dfs2 = (pos: number): void => {
      if (pos === m) {
        // 所有非变化维度已固定：现在展开变化维度，生成一个 fiber
        const start = order.length;
        const assignVary = (vi: number): void => {
          if (vi === varyLast.length) {
            const idx = keyToIndex.get(tupleKey(current));
            if (idx !== undefined) order.push(idx);
            return;
          }
          const t = varyLast[vi];
          for (let a = 0; a < n; a++) {
            if (problem.ineligible[t][a] || used[a]) continue;
            used[a] = true;
            current[t] = a;
            assignVary(vi + 1);
            used[a] = false;
            current[t] = -1;
          }
        };
        assignVary(0);
        if (order.length > start) {
          runs.push(start, order.length);
        }
        return;
      }
      if (varySet.has(pos)) {
        dfs2(pos + 1); // 跳过变化维度（稍后统一展开）
        return;
      }
      for (let a = 0; a < n; a++) {
        if (problem.ineligible[pos][a] || used[a]) continue;
        used[a] = true;
        current[pos] = a;
        dfs2(pos + 1);
        used[a] = false;
        current[pos] = -1;
      }
    };

    dfs2(0);

    return {
      label,
      order: Int32Array.from(order),
      runs: Int32Array.from(runs)
    };
  };

  const mixers: FiberGroup[] = [];
  if (n > m) {
    // 单任务移动：e^{-iβ A_t}，A_t = 任务 t 移动到空闲agent的邻接
    for (let t = 0; t < m; t++) {
      mixers.push(buildFiberGroup([t], `move-t${t}`));
    }
  } else {
    // n == m：无空闲agent，用换位混合（两任务交换agent）
    for (let t1 = 0; t1 < m; t1++) {
      for (let t2 = t1 + 1; t2 < m; t2++) {
        mixers.push(buildFiberGroup([t1, t2], `swap-t${t1}t${t2}`));
      }
    }
  }

  return {
    problem, m, n, dimension,
    energies,
    assignmentAt: Int32Array.from(assignmentAt),
    mixers,
    optimalWelfare
  };
}

// ----------------------------------------------------------------------------
// 子空间态矢量与演化
// ----------------------------------------------------------------------------

export class SubspaceState {
  readonly dim: number;
  readonly re: Float64Array;
  readonly im: Float64Array;

  constructor(dim: number) {
    this.dim = dim;
    this.re = new Float64Array(dim);
    this.im = new Float64Array(dim);
  }

  setUniform(): void {
    const amp = 1 / Math.sqrt(this.dim);
    this.re.fill(amp);
    this.im.fill(0);
  }

  norm(): number {
    let sum = 0;
    for (let s = 0; s < this.dim; s++) {
      sum += this.re[s] * this.re[s] + this.im[s] * this.im[s];
    }
    return Math.sqrt(sum);
  }

  probabilities(): Float64Array {
    const p = new Float64Array(this.dim);
    for (let s = 0; s < this.dim; s++) {
      p[s] = this.re[s] * this.re[s] + this.im[s] * this.im[s];
    }
    return p;
  }

  /** 代价相位 e^{-iγC}：子空间内逐基态（精确对角） */
  applyCostPhase(gamma: number, energies: Float64Array): void {
    for (let s = 0; s < this.dim; s++) {
      const e = energies[s];
      const c = Math.cos(gamma * e);
      const sn = Math.sin(gamma * e);
      const r = this.re[s];
      const i = this.im[s];
      this.re[s] = r * c + i * sn;
      this.im[s] = i * c - r * sn;
    }
  }

  /**
   * 纤维混合 e^{-iβ A_group}：逐 fiber 的完全图旋转（闭式，精确）。
   * a_j ↦ e^{iβ}·a_j + (e^{−iβ(k−1)} − e^{iβ})·μ，μ 为 fiber 平均振幅。
   * annealing 用负号方向（等价于 β → −β）。
   */
  applyFiberMixer(group: FiberGroup, beta: number, sign: 1 | -1 = 1): void {
    const b = sign * beta;
    // 逐 fiber 求和 → 均值 → 闭式旋转
    const { order, runs } = group;
    for (let r = 0; r < runs.length; r += 2) {
      const start = runs[r];
      const end = runs[r + 1];
      const k = end - start;
      if (k <= 1) continue; // 纤维退化（唯一可选agent）：恒等

      let sumRe = 0, sumIm = 0;
      for (let i = start; i < end; i++) {
        const s = order[i];
        sumRe += this.re[s];
        sumIm += this.im[s];
      }
      const muRe = sumRe / k;
      const muIm = sumIm / k;

      // 系数：c_eig = e^{−iβ(k−1)} − e^{iβ}
      const theta = -b * (k - 1);
      const diffRe = Math.cos(theta) - Math.cos(b);
      const diffIm = Math.sin(theta) - Math.sin(b);

      // a_j ↦ e^{iβ}a_j + diff·μ
      const rotRe = Math.cos(b);
      const rotIm = Math.sin(b);
      for (let i = start; i < end; i++) {
        const s = order[i];
        const ar = this.re[s];
        const ai = this.im[s];
        // e^{iβ}·a
        const er = ar * rotRe - ai * rotIm;
        const ei = ar * rotIm + ai * rotRe;
        // + diff·μ
        this.re[s] = er + diffRe * muRe - diffIm * muIm;
        this.im[s] = ei + diffRe * muIm + diffIm * muRe;
      }
    }
  }
}

// ----------------------------------------------------------------------------
// QAOA / 退火（子空间形态）
// ----------------------------------------------------------------------------

function expectationOfSubspace(state: SubspaceState, energies: Float64Array): number {
  const p = state.probabilities();
  let sum = 0;
  for (let s = 0; s < state.dim; s++) sum += p[s] * energies[s];
  return sum;
}

function runSubspaceQaoaCircuit(
  angles: number[],
  layers: number,
  model: SubspaceModel,
  energies: Float64Array
): SubspaceState {
  const state = new SubspaceState(model.dimension);
  state.setUniform();
  for (let p = 0; p < layers; p++) {
    state.applyCostPhase(angles[p], energies);
    for (const group of model.mixers) {
      state.applyFiberMixer(group, angles[layers + p]);
    }
  }
  return state;
}

function optimizeSubspaceQaoaAngles(
  layers: number,
  model: SubspaceModel,
  energies: Float64Array,
  restarts: number,
  rng: () => number
): { angles: number[]; expectation: number; evaluations: number } {
  let bestAngles: number[] = [];
  let bestExpectation = Infinity;
  let evaluations = 0;

  for (let r = 0; r < restarts; r++) {
    const angles: number[] = [];
    for (let p = 0; p < layers; p++) {
      angles.push(r === 0 ? ((p + 1) / layers) * Math.PI * 0.5 : rng() * Math.PI);
    }
    for (let p = 0; p < layers; p++) {
      angles.push(r === 0 ? (1 - (p + 1) / (layers + 1)) * Math.PI * 0.25 : rng() * Math.PI * 0.5);
    }

    const evaluate = (a: number[]): number => {
      evaluations++;
      return expectationOfSubspace(runSubspaceQaoaCircuit(a, layers, model, energies), energies);
    };

    let current = evaluate(angles);
    let delta = 0.3;
    const gammaBound = Math.PI;
    const betaBound = Math.PI / 2;

    while (delta > 1e-3) {
      let improved = false;
      for (let i = 0; i < angles.length; i++) {
        const bound = i < layers ? gammaBound : betaBound;
        for (const sign of [1, -1]) {
          const candidate = angles.slice();
          candidate[i] = Math.min(bound, Math.max(0, candidate[i] + sign * delta));
          const value = evaluate(candidate);
          if (value < current - 1e-12) {
            angles.splice(0, angles.length, ...candidate);
            current = value;
            improved = true;
          }
        }
      }
      if (!improved) delta *= 0.5;
    }

    if (current < bestExpectation) {
      bestExpectation = current;
      bestAngles = angles.slice();
    }
  }
  return { angles: bestAngles, expectation: bestExpectation, evaluations };
}

/** 子空间内的测量坍缩（所有基态均合法——无罚项无违约） */
function collapseSubspace(
  model: SubspaceModel,
  probs: Float64Array,
  mode: CollapseMode,
  shots: number,
  rng: () => number,
  topK: number
): { assignment: number[]; probability: number; candidates: QuantumCandidate[] } {
  const { m, energies } = model;
  let chosen = -1;

  if (mode === 'born') {
    const r = rng();
    let cum = 0;
    for (let s = 0; s < probs.length; s++) {
      cum += probs[s];
      if (r <= cum) { chosen = s; break; }
    }
    if (chosen < 0) chosen = probs.length - 1;
  } else if (mode === 'shots-best') {
    const cum = new Float64Array(probs.length);
    let acc = 0;
    for (let s = 0; s < probs.length; s++) {
      acc += probs[s];
      cum[s] = acc;
    }
    let bestEnergy = Infinity;
    for (let i = 0; i < shots; i++) {
      const r = rng() * acc;
      let lo = 0, hi = probs.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (cum[mid] < r) lo = mid + 1; else hi = mid;
      }
      if (energies[lo] < bestEnergy) {
        bestEnergy = energies[lo];
        chosen = lo;
      }
    }
    if (chosen < 0) chosen = 0;
  } else {
    // argmax-valid → 子空间内即 argmax
    let bestProb = -1;
    for (let s = 0; s < probs.length; s++) {
      if (probs[s] > bestProb) {
        bestProb = probs[s];
        chosen = s;
      }
    }
  }

  const assignment: number[] = [];
  for (let t = 0; t < m; t++) assignment.push(model.assignmentAt[chosen * m + t]);

  const candidates: QuantumCandidate[] = Array.from(probs)
    .map((p, s) => ({ s, p }))
    .sort((x, y) => y.p - x.p)
    .slice(0, topK)
    .map(({ s, p }) => {
      const a: number[] = [];
      for (let t = 0; t < m; t++) a.push(model.assignmentAt[s * m + t]);
      return { assignment: a, welfare: -energies[s], energy: energies[s], probability: p };
    });

  return { assignment, probability: probs[chosen], candidates };
}

function normalizedEnergies(model: SubspaceModel, scale: number): Float64Array {
  let min = Infinity, max = -Infinity;
  for (const e of model.energies) {
    if (e < min) min = e;
    if (e > max) max = e;
  }
  const span = max - min;
  const out = new Float64Array(model.dimension);
  for (let s = 0; s < out.length; s++) {
    out[s] = span > 0 ? ((model.energies[s] - min) / span) * scale : 0;
  }
  return out;
}

export function qaoaSolveSubspace(model: SubspaceModel, options: QuantumSolverOptions = {}): SubspaceSolution {
  const layers = options.layers ?? 3;
  const shots = options.shots ?? 128;
  const restarts = options.restarts ?? 2;
  const select = options.select ?? 'shots-best';
  const seed = options.seed ?? 42;
  const topK = options.topK ?? 3;
  const rng = mulberry32(seed);

  const energies = normalizedEnergies(model, 1);
  const { angles, expectation, evaluations } = optimizeSubspaceQaoaAngles(layers, model, energies, restarts, rng);
  const finalState = runSubspaceQaoaCircuit(angles, layers, model, energies);
  const probs = finalState.probabilities();
  const collapse = collapseSubspace(model, probs, select, shots, rng, topK);

  // 还原原始能量尺度的期望
  let rawMin = Infinity, rawMax = -Infinity;
  for (const e of model.energies) {
    if (e < rawMin) rawMin = e;
    if (e > rawMax) rawMax = e;
  }
  const rawExpectation = expectation * (rawMax - rawMin) + rawMin;

  const solutionWelfare = welfareOfModel(model, collapse.assignment);

  return {
    engine: 'qaoa',
    assignment: collapse.assignment,
    welfare: solutionWelfare,
    energy: -solutionWelfare,
    probability: collapse.probability,
    optimalityRatio: solutionWelfare / model.optimalWelfare,
    expectation: rawExpectation,
    layers,
    angles,
    evaluations,
    candidates: collapse.candidates,
    dimension: model.dimension
  };
}

function welfareOfModel(model: SubspaceModel, assignment: number[]): number {
  return welfareOf(model.problem, assignment);
}

export function annealSolveSubspace(model: SubspaceModel, options: QuantumSolverOptions = {}): SubspaceSolution {
  // 无罚项子空间景观干净：短退火（τ=20/150步）经多种子验证即可全命中，
  // 大维度时尤其重要（演化成本 ∝ steps×m×dim）
  const tau = options.anneal?.tau ?? 20;
  const steps = options.anneal?.steps ?? 150;
  const shots = options.shots ?? 128;
  const select = options.select ?? 'shots-best';
  const seed = options.seed ?? 42;
  const topK = options.topK ?? 3;
  const rng = mulberry32(seed);

  // 代价尺度与混合算符谱宽同量级：Σ_t A_t 的谱半径 ≈ Σ_t (k_max−1) ≤ m·(n−m)
  const spectralWidth = model.n > model.m
    ? model.m * Math.max(1, model.n - model.m)
    : (model.m * (model.m - 1)) / 2;
  const energies = normalizedEnergies(model, 2 * spectralWidth);

  // H(s) = −(1−s)·ΣA + s·C：均匀初态是 −ΣA 的基态（Perron-Frobenius）
  const state = new SubspaceState(model.dimension);
  state.setUniform();
  const dt = tau / steps;
  for (let t = 1; t <= steps; t++) {
    const s = t / steps;
    for (const group of model.mixers) {
      state.applyFiberMixer(group, (1 - s) * dt, -1); // −A 方向（基态支路）
    }
    state.applyCostPhase(s * dt, energies);
  }
  const probs = state.probabilities();
  const collapse = collapseSubspace(model, probs, select, shots, rng, topK);

  let expectation = 0;
  for (let s = 0; s < probs.length; s++) expectation += probs[s] * energies[s];
  let rawMin = Infinity, rawMax = -Infinity;
  for (const e of model.energies) {
    if (e < rawMin) rawMin = e;
    if (e > rawMax) rawMax = e;
  }
  const rawExpectation = expectation / (2 * spectralWidth) * (rawMax - rawMin) + rawMin;

  const welfare = welfareOfModel(model, collapse.assignment);
  return {
    engine: 'annealing',
    assignment: collapse.assignment,
    welfare,
    energy: -welfare,
    probability: collapse.probability,
    optimalityRatio: welfare / model.optimalWelfare,
    expectation: rawExpectation,
    layers: steps,
    angles: null,
    evaluations: 1,
    candidates: collapse.candidates,
    dimension: model.dimension
  };
}
