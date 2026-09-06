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
 * ============ 性能内核（v1.5） ============
 *
 * 演化与构建的算术内核在 fiber-kernel.ts（纯函数，串行/并行同一份源码）：
 * - 纤维混合按纤维尺寸 k 查表旋转系数 + 小纤维展开特化；
 * - 退火代价相位走递推（γ_t 线性 ⇒ ph(t) = ph(t−1)·z_k）；
 * - 构建 DFS 的元组键取"字典序单调"编码 ⇒ 升序键数组 + 二分查找，
 *   取代 Map<double,double>；
 * - 大维度退火经 subspace-parallel.ts 多线程确定性并行（逐位一致）。
 *
 * ============ 诚实的边界 ============
 * - 子空间维度仍组合增长 P(n,m)，默认上限 2^21（~200MB 内存），可配置。
 * - 逐块 O(m·dim) 演化成本：dim 百万级时 QAOA 变分训练慢（数百次评估），
 *   大实例推荐退火（一次演化）；QAOA 适合 ≤ ~10^5 维。
 * - 这是经典硬件上的精确量子模拟（含时薛定谔方程在约束子空间的数值积分）；
 *   子空间结构本身就是给真 QPU 的 ansatz 建议（约束感知电路设计）。
 */

import type {
  AssignmentProblem,
  QuantumSolverOptions,
  QuantumCandidate,
  CollapseMode,
  SolverSolution,
} from './quantum-optimizer.js';
import { welfareOf } from './quantum-optimizer.js';
import { mulberry32 } from '../utils/rng.js';
import {
  ComplexAmplitudes,
  cvarExpectationOrdered,
  cvarOrder,
  expectationValue,
  expectationValueInto,
  throwIfAborted,
  minMaxOf,
  normalizedEnergies as normalizedEnergiesOf,
  denormalizeExpectation,
  optimizeAnglesByCoordinateDescent,
  optimizeAnglesByCoordinateDescentSeeded,
  resolveCommonSolverOptions,
  sampleBestIndexByShots,
  sampleIndexByProbabilities,
  validateAnnealOptions,
} from './solver-common.js';
import type { DescentOptions } from './solver-common.js';
import { applyFiberRunsKernel, advanceCostKernel, buildFiberGroupKernel } from './fiber-kernel.js';
import {
  parallelAnnealEvolve,
  parallelAnnealEvolveAsync,
  parallelBuildFiberGroups,
} from './subspace-parallel.js';
import {
  BETA_BOUND,
  BORN_VALID_MASS_FLOOR,
  GAMMA_BOUND,
  SUBSPACE_ANNEAL_STEPS,
  SUBSPACE_ANNEAL_TAU,
  SUBSPACE_DIMENSION_CAP,
} from './constants.js';
import { logWarn } from '../utils/logger.js';

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

export interface SubspaceSolution extends SolverSolution {
  /**
   * 最优福利之比（=1 即命中最优）。全负福利（价值−成本量为负）下比值
   * 语义反转（更差的解比值更大），且最优恰为 0 时除法发散——因此
   * 仅在 optimalWelfare > 0 时有意义；否则约定为命中即 1、未命中即 0
   * （见 safeOptimalityRatio）。
   */
  optimalityRatio: number;
  dimension: number;
  /**
   * 末态 Born 总质量（08#27）：子空间全体基态构造性合法，故它不再像
   * 全空间那样度量「合法占比」，而是幺正演化保范数的读数——正常电路
   * |Σ|ψ|² − 1| ≪ 1e-9，显著偏离即数值发散的红旗。与全空间解的
   * validMass 同名同报告语义（门面层/实验口径统一消费）。
   */
  validMass: number;
}

/** optimalityRatio 的非退化定义：正常域直接取比值；最优 ≤ 0 时比值语义
 * 反转/发散，退化为二值命中判定（浮点容差内视为命中） */
function safeOptimalityRatio(welfare: number, optimalWelfare: number): number {
  if (optimalWelfare > 0) return welfare / optimalWelfare;
  return welfare >= optimalWelfare - 1e-9 ? 1 : 0;
}

export interface SubspaceBuildOptions {
  /** 子空间维度上限（默认 2^21 = SUBSPACE_DIMENSION_CAP）；枚举超过即放弃并返回 null */
  dimensionCap?: number;
}

/** Int32 缓冲：优先 SharedArrayBuffer 底座（多线程演化零拷贝共享），不可用时退普通数组 */
/**
 * SAB 可用性模块级一次解析（08#26）：热路径不再每次分配重读
 * process.env——运行中改 env 曾可使同进程前后分配混用两种底座。
 * QUANTUM_NO_SAB=1（旧名，保持兼容）或 QUANTUM_FORCE_AB=1 都选择
 * 普通 ArrayBuffer 路径；模块加载后改动 env 不再生效（确定性行为）。
 */
const SAB_AVAILABLE: boolean =
  process.env.QUANTUM_NO_SAB !== '1' &&
  process.env.QUANTUM_FORCE_AB !== '1' &&
  typeof SharedArrayBuffer === 'function';

function allocI32(count: number): ArrayBufferLike {
  if (!SAB_AVAILABLE) {
    return new ArrayBuffer(count * 4);
  }
  return new SharedArrayBuffer(count * 4);
}

/** 字节缓冲（Uint8 底座）与 Float64 缓冲：同 allocI32 策略 */
function allocBytes(count: number): ArrayBufferLike {
  if (!SAB_AVAILABLE) {
    return new ArrayBuffer(count);
  }
  return new SharedArrayBuffer(count);
}

function allocF64(count: number): ArrayBufferLike {
  if (!SAB_AVAILABLE) {
    return new ArrayBuffer(count * 8);
  }
  return new SharedArrayBuffer(count * 8);
}

// ----------------------------------------------------------------------------
// 枚举：合法分配（DFS）+ 纤维结构
// ----------------------------------------------------------------------------

/**
 * 构建子空间模型。dimension 超过 cap 时返回 null（调用方回退全空间引擎）。
 */
export function buildSubspaceModel(
  problem: AssignmentProblem,
  options: SubspaceBuildOptions = {},
): SubspaceModel | null {
  const m = problem.taskIds.length;
  const n = problem.agentIds.length;
  const cap = options.dimensionCap ?? SUBSPACE_DIMENSION_CAP;
  if (m === 0 || n === 0 || m > n) return null;

  // 元组键：Σ a_t · n^(m−1−t)（a_0 为最高位）。关键性质：DFS 按字典序枚举
  // ⇒ 键严格升序 ⇒ keys 数组天然有序，任意元组 → 规范索引用二分查找即可，
  // 无需哈希 Map（大维度时 Map<double,double> 的插入/查询是构建的主要成本）。
  // 需 n^m ≤ 2^53，维度上限保证了这一点量级。
  const powers = new Float64Array(m);
  {
    let size = 1;
    for (let t = m - 1; t >= 0; t--) {
      powers[t] = size;
      size *= n;
      if (size > Number.MAX_SAFE_INTEGER) return null;
    }
  }

  // 资格掩码展平（DFS 与纤维构建内核共用一份；SAB 底座供并行构建共享）
  const ineligibleFlat = new Uint8Array(allocBytes(m * n));
  for (let t = 0; t < m; t++) {
    for (let a = 0; a < n; a++) {
      if (problem.ineligible[t]?.[a]) ineligibleFlat[t * n + a] = 1;
    }
  }

  // ---- 1) 规范枚举：任务 0..m−1 升序 DFS（预分配类型化数组，无装箱/扩容） ----
  // 容量上界 = min(P(n,m), cap)：无资格约束时即精确维度
  let capacity = 1;
  for (let t = 0; t < m; t++) {
    capacity *= n - t;
    if (capacity > cap) {
      capacity = cap;
      break;
    }
  }
  const assignmentAt = new Int32Array(capacity * m);
  const keys = new Float64Array(allocF64(capacity));
  let dimCount = 0;
  const used = new Uint8Array(n);
  const current = new Int32Array(m).fill(-1);

  const dfs = (t: number): boolean => {
    if (t === m) {
      if (dimCount >= cap) return false; // 已达维度上限：中止枚举
      let key = 0;
      const base = dimCount * m;
      for (let i = 0; i < m; i++) {
        const a = current[i]!;
        assignmentAt[base + i] = a;
        key += a * powers[i]!;
      }
      keys[dimCount] = key;
      dimCount++;
      return true;
    }
    for (let a = 0; a < n; a++) {
      if (ineligibleFlat[t * n + a] || used[a]!) continue;
      used[a] = 1;
      current[t] = a;
      if (!dfs(t + 1)) {
        used[a] = 0;
        current[t] = -1;
        return false;
      }
      used[a] = 0;
      current[t] = -1;
    }
    return true;
  };

  const dfsStart = Date.now();
  if (!dfs(0)) return null;
  const dimension = dimCount;
  if (dimension === 0) return null;
  const sortedKeys = keys.subarray(0, dimension); // 严格升序——二分查找底座
  if (process.env.QUANTUM_PARALLEL_DEBUG) {
    console.error(`[build] dfs1+keys: ${Date.now() - dfsStart}ms (dim=${dimension})`);
  }

  // ---- 2) 能量：E = −福利（含纠缠耦合，零罚项） ----
  // 展平权重矩阵与耦合表（解码键 → 平行数组），一次预换取逐状态免
  // Map 迭代/键解码：dim 百万级时此循环是构建的主要算术成本。
  // 加法次序与 welfareOf 完全一致（t 升序，后耦合按 Map 插入序）→ 逐位一致。
  const weightsFlat = new Float64Array(m * n);
  for (let t = 0; t < m; t++) {
    for (let a = 0; a < n; a++) weightsFlat[t * n + a] = problem.weights[t]![a]!;
  }
  const couplingLen = problem.couplings.size;
  const cplT1 = new Int32Array(couplingLen);
  const cplA1 = new Int32Array(couplingLen);
  const cplT2 = new Int32Array(couplingLen);
  const cplA2 = new Int32Array(couplingLen);
  const cplJ = new Float64Array(couplingLen);
  {
    const nqubits = m * n;
    let ci = 0;
    for (const [key, j] of problem.couplings) {
      const q1 = Math.floor(key / nqubits);
      const q2 = key % nqubits;
      cplT1[ci] = Math.floor(q1 / n);
      cplA1[ci] = q1 % n;
      cplT2[ci] = Math.floor(q2 / n);
      cplA2[ci] = q2 % n;
      cplJ[ci] = j;
      ci++;
    }
  }
  const energiesStart = Date.now();
  const energies = new Float64Array(dimension);
  let optimalWelfare = -Infinity;
  for (let s = 0; s < dimension; s++) {
    const base = s * m;
    let w = 0;
    for (let t = 0; t < m; t++) w += weightsFlat[t * n + assignmentAt[base + t]!]!;
    for (let c = 0; c < couplingLen; c++) {
      if (
        assignmentAt[base + cplT1[c]!] === cplA1[c]! &&
        assignmentAt[base + cplT2[c]!] === cplA2[c]!
      ) {
        w += cplJ[c]!;
      }
    }
    energies[s] = -w;
    if (w > optimalWelfare) optimalWelfare = w;
  }
  if (process.env.QUANTUM_PARALLEL_DEBUG) {
    console.error(`[build] energies(flattened): ${Date.now() - energiesStart}ms`);
  }

  // ---- 3) 纤维结构（内核构建；order/runs 落在共享底座上供并行演化复用） ----
  // order 恰为 0..dim−1 的排列（精确 dim）；被记录的纤维均含 ≥2 元素，
  // 故 runs 实际长度 ≤ dim。大维度时优先多线程并行构建（每组完整归属
  // 单一 Worker、同一内核源码 ⇒ 与串行逐位一致），失败回退串行。
  const varyLists: number[][] = [];
  const labels: string[] = [];
  if (n > m) {
    // 单任务移动：e^{-iβ A_t}，A_t = 任务 t 移动到空闲agent的邻接
    for (let t = 0; t < m; t++) {
      varyLists.push([t]);
      labels.push(`move-t${t}`);
    }
  } else {
    // n == m：无空闲agent，用换位混合（两任务交换agent）
    for (let t1 = 0; t1 < m; t1++) {
      for (let t2 = t1 + 1; t2 < m; t2++) {
        varyLists.push([t1, t2]);
        labels.push(`swap-t${t1}t${t2}`);
      }
    }
  }

  const buildFiberGroup = (varyLast: number[], label: string): FiberGroup => {
    const order = new Int32Array(allocI32(dimension));
    const runs = new Int32Array(allocI32(dimension));
    const { orderLen, runsLen } = buildFiberGroupKernel(
      m,
      n,
      ineligibleFlat,
      sortedKeys,
      Int32Array.from(varyLast),
      dimension,
      order,
      runs,
    );
    return {
      label,
      order: order.subarray(0, orderLen),
      runs: runs.subarray(0, runsLen),
    };
  };

  const mixersStart = Date.now();
  let mixers: FiberGroup[];
  const parallelBuilt = parallelBuildFiberGroups({
    m,
    n,
    dimension,
    ineligible: ineligibleFlat,
    sortedKeys,
    varies: varyLists,
  });
  if (parallelBuilt) {
    mixers = parallelBuilt.map((r, g) => ({ label: labels[g]!, order: r.order, runs: r.runs }));
  } else {
    mixers = varyLists.map((vary, g) => buildFiberGroup(vary, labels[g]!));
  }
  if (process.env.QUANTUM_PARALLEL_DEBUG) {
    console.error(
      `[build] mixers(${parallelBuilt ? `parallel` : 'serial'}): ${Date.now() - mixersStart}ms`,
    );
  }

  return {
    problem,
    m,
    n,
    dimension,
    energies,
    assignmentAt: assignmentAt.subarray(0, dimension * m),
    mixers,
    optimalWelfare,
  };
}

// ----------------------------------------------------------------------------
// 子空间态矢量与演化
// ----------------------------------------------------------------------------

/**
 * 子空间态矢量：共享复振幅基座 + 纤维混合算符（本引擎特有的演化结构）。
 * 均匀叠加 / 范数 / Born 概率 / 对角代价相位均继承自 ComplexAmplitudes。
 */
export class SubspaceState extends ComplexAmplitudes {
  constructor(dim: number) {
    super(dim);
  }

  /**
   * 纤维混合 e^{-iβ A_group}：逐 fiber 的完全图旋转（闭式，精确）。
   * a_j ↦ e^{iβ}·a_j + (e^{−iβ(k−1)} − e^{iβ})·μ，μ 为 fiber 平均振幅。
   * annealing 用负号方向（等价于 β → −β）。
   */
  applyFiberMixer(group: FiberGroup, beta: number, sign: 1 | -1 = 1): void {
    const { order, runs } = group;
    applyFiberRunsKernel(this.re, this.im, order, runs, 0, runs.length, sign * beta);
  }
}

// ----------------------------------------------------------------------------
// QAOA / 退火（子空间形态）
// ----------------------------------------------------------------------------

function expectationOfSubspace(state: SubspaceState, energies: Float64Array): number {
  return expectationValue(state, energies);
}

function runSubspaceQaoaCircuit(
  angles: number[],
  layers: number,
  model: SubspaceModel,
  energies: Float64Array,
): SubspaceState {
  const state = new SubspaceState(model.dimension);
  state.setUniform();
  for (let p = 0; p < layers; p++) {
    state.applyCostPhase(angles[p]!, energies);
    for (const group of model.mixers) {
      state.applyFiberMixer(group, angles[layers + p]!);
    }
  }
  return state;
}

/** 坐标下降角度优化（共享实现：全空间/子空间两引擎的同一变分循环）。
 * cvarAlpha < 1 时变分目标换为 CVaR_α（预排序跨评估复用）；
 * α ≥ 1 保持均值目标原路径（默认位级不变）。 */
function optimizeSubspaceQaoaAngles(
  layers: number,
  model: SubspaceModel,
  energies: Float64Array,
  restarts: number,
  rng: () => number,
  cvarAlpha = 1,
  descentOpts: DescentOptions = {},
): { angles: number[]; expectation: number; evaluations: number } {
  // scratch 概率缓冲（01#18）：与全空间引擎 optimizeQaoaAngles 同款——
  // 每次评估一块 dim 维分配改为整求解单块复用，逐位结果不变
  const scratch = new Float64Array(energies.length);
  if (cvarAlpha < 1) {
    const order = cvarOrder(energies);
    return optimizeAnglesByCoordinateDescent(
      (angles) =>
        cvarExpectationOrdered(
          runSubspaceQaoaCircuit(angles, layers, model, energies).probabilitiesInto(scratch),
          energies,
          order,
          cvarAlpha,
        ),
      layers,
      restarts,
      rng,
      descentOpts,
    );
  }
  return optimizeAnglesByCoordinateDescent(
    (angles) =>
      expectationValueInto(runSubspaceQaoaCircuit(angles, layers, model, energies), energies),
    layers,
    restarts,
    rng,
    descentOpts,
  );
}

/**
 * ma-QAOA 角度布局（子空间形态）：[γ_1..γ_p, β_{p,g}（层主序 × 纤维组）]。
 * 全部 β_{p,·} 取 layer 角 β_p 时，multi 电路与 layer 电路逐位相同
 * （applyFiberMixer 按组施加，同组序同运算）。
 */
function expandToMultiAnglesSubspace(
  layerAngles: number[],
  layers: number,
  groups: number,
): number[] {
  const out: number[] = layerAngles.slice(0, layers);
  for (let p = 0; p < layers; p++) {
    const beta = layerAngles[layers + p]!;
    for (let g = 0; g < groups; g++) out.push(beta);
  }
  return out;
}

function runSubspaceQaoaCircuitMulti(
  angles: number[],
  layers: number,
  model: SubspaceModel,
  energies: Float64Array,
): SubspaceState {
  const state = new SubspaceState(model.dimension);
  state.setUniform();
  const G = model.mixers.length;
  for (let p = 0; p < layers; p++) {
    state.applyCostPhase(angles[p]!, energies);
    for (let g = 0; g < G; g++) {
      state.applyFiberMixer(model.mixers[g]!, angles[layers + p * G + g]!);
    }
  }
  return state;
}

/** ma-QAOA 精修（子空间）：layer 最优角展开为种子，坐标下降单调不劣 */
function refineSubspaceQaoaAnglesMulti(
  layers: number,
  model: SubspaceModel,
  energies: Float64Array,
  restarts: number,
  rng: () => number,
  cvarAlpha: number,
  layerAngles: number[],
  layerEvaluations: number,
  descentOpts: DescentOptions = {},
): { angles: number[]; expectation: number; evaluations: number } {
  const G = model.mixers.length;
  const seed = expandToMultiAnglesSubspace(layerAngles, layers, G);
  const angleCount = layers + layers * G;
  const bounds: number[] = Array.from({ length: angleCount }, (_, i) =>
    i < layers ? GAMMA_BOUND : BETA_BOUND,
  );
  // scratch 复用（01#18）：multi 角度空间的评估次数更多，收益同上
  const scratch = new Float64Array(energies.length);
  const evaluate =
    cvarAlpha < 1
      ? (() => {
          const order = cvarOrder(energies); // 预排序跨评估复用
          return (angles: number[]): number =>
            cvarExpectationOrdered(
              runSubspaceQaoaCircuitMulti(angles, layers, model, energies).probabilitiesInto(
                scratch,
              ),
              energies,
              order,
              cvarAlpha,
            );
        })()
      : (angles: number[]): number =>
          expectationValueInto(
            runSubspaceQaoaCircuitMulti(angles, layers, model, energies),
            energies,
          );
  const result = optimizeAnglesByCoordinateDescentSeeded(
    evaluate,
    angleCount,
    bounds,
    restarts,
    rng,
    seed,
    descentOpts,
  );
  return { ...result, evaluations: result.evaluations + layerEvaluations };
}

/** 子空间内的测量坍缩（所有基态均合法——无罚项无违约） */
function collapseSubspace(
  model: SubspaceModel,
  probs: Float64Array,
  mode: CollapseMode,
  shots: number,
  rng: () => number,
  topK: number,
): {
  assignment: number[];
  probability: number;
  candidates: QuantumCandidate[];
  validMass: number;
} {
  const { m, energies } = model;
  let chosen = -1;

  // 幺正性护栏（08#27）：演化保范数，Σ|ψ|² 显著偏离 1 即数值发散——
  // 此时 Born 概率的「置信度」语义已经破产，先暴露再继续（结果仍返回，
  // 下游可用 validMass 判读，不静默吞掉发散）
  let mass = 0;
  for (const p of probs) mass += p;
  if (Math.abs(mass - 1) > BORN_VALID_MASS_FLOOR) {
    logWarn(
      'SubspaceOptimizer',
      `state norm drifted: Σ|ψ|² = ${mass.toExponential(6)} (unitarity violated)`,
    );
  }

  if (mode === 'born') {
    chosen = sampleIndexByProbabilities(probs, rng);
  } else if (mode === 'shots-best') {
    chosen = sampleBestIndexByShots(probs, shots, rng, (s) => energies[s]!);
    if (chosen < 0) {
      // 采到 0 概率态时的回退：与全空间引擎同语义——在末态 Born 分布上
      // 取概率最大的基态（argmax）。此前回退到第 0 号基态（DFS 字典序
      // 最小解，无任何最优语义），两引擎同场景不同回退策略且子空间
      // 质量显著更差。
      let bestProb = -1;
      for (let s = 0; s < probs.length; s++) {
        if (probs[s]! > bestProb) {
          bestProb = probs[s]!;
          chosen = s;
        }
      }
    }
  } else {
    // argmax-valid → 子空间内即 argmax
    let bestProb = -1;
    for (let s = 0; s < probs.length; s++) {
      if (probs[s]! > bestProb) {
        bestProb = probs[s]!;
        chosen = s;
      }
    }
  }

  const assignment: number[] = [];
  for (let t = 0; t < m; t++) assignment.push(model.assignmentAt[chosen * m + t]!);

  // top-K 线性选择：此前全量 Array.from().map().sort().slice() 在 dim 百万级
  // 时分配 dim 个对象再 O(dim·log dim) 排序（8×10 实例实测 ~7s），只为取
  // K=3 个候选。线性扫描维护按 p 降序的 K 槽：相等概率保持原有次序（与
  // V8 稳定排序语义一致），产出候选列表与旧实现逐项相同。
  const top: Array<{ s: number; p: number }> = [];
  for (let s = 0; s < probs.length && topK > 0; s++) {
    const p = probs[s]!;
    if (top.length === topK && p <= top[top.length - 1]!.p) continue;
    let i = top.length;
    while (i > 0 && top[i - 1]!.p < p) i--;
    if (top.length === topK) top.pop();
    top.splice(i, 0, { s, p });
  }

  const candidates: QuantumCandidate[] = top.map(({ s, p }) => {
    const a: number[] = [];
    for (let t = 0; t < m; t++) a.push(model.assignmentAt[s * m + t]!);
    return { assignment: a, welfare: -energies[s]!, energy: energies[s]!, probability: p };
  });

  return { assignment, probability: probs[chosen]!, candidates, validMass: mass };
}

function normalizedEnergies(model: SubspaceModel, scale: number): Float64Array {
  const { min, max } = minMaxOf(model.energies);
  return normalizedEnergiesOf(model.energies, min, max, scale);
}

export function qaoaSolveSubspace(
  model: SubspaceModel,
  options: QuantumSolverOptions = {},
): SubspaceSolution {
  const { layers, shots, restarts, select, seed, topK, cvarAlpha, angleMode, warmStart, signal } =
    resolveCommonSolverOptions(options, 'shots-best');
  const rng = mulberry32(seed);
  const descentOpts: DescentOptions = warmStart
    ? { warmStart: true, ...(signal ? { signal } : {}) }
    : signal
      ? { signal }
      : {};

  const energies = normalizedEnergies(model, 1);
  // layer 基线先行；multi 模式以基线最优角的展开为种子精修（支配性同全空间）
  const layer = optimizeSubspaceQaoaAngles(
    layers,
    model,
    energies,
    restarts,
    rng,
    cvarAlpha,
    descentOpts,
  );
  const { angles, evaluations } =
    angleMode === 'multi'
      ? refineSubspaceQaoaAnglesMulti(
          layers,
          model,
          energies,
          restarts,
          rng,
          cvarAlpha,
          layer.angles,
          layer.evaluations,
          descentOpts,
        )
      : layer;
  const finalState =
    angleMode === 'multi'
      ? runSubspaceQaoaCircuitMulti(angles, layers, model, energies)
      : runSubspaceQaoaCircuit(angles, layers, model, energies);
  const probs = finalState.probabilities();
  const collapse = collapseSubspace(model, probs, select, shots, rng, topK);

  // 报告口径恒为真实 ⟨E⟩（layer+均值模式保持优化器返回值——与历史逐位一致）
  const meanExpectation =
    cvarAlpha < 1 || angleMode === 'multi'
      ? expectationOfSubspace(finalState, energies)
      : layer.expectation;

  // 还原原始能量尺度的期望（denormalizeExpectation 单一实现，scale=1）
  const { min: rawMin, max: rawMax } = minMaxOf(model.energies);
  const rawExpectation = denormalizeExpectation(meanExpectation, 1, rawMin, rawMax);

  const solutionWelfare = welfareOfModel(model, collapse.assignment);

  return {
    engine: 'qaoa',
    assignment: collapse.assignment,
    welfare: solutionWelfare,
    energy: -solutionWelfare,
    validMass: collapse.validMass,
    probability: collapse.probability,
    optimalityRatio: safeOptimalityRatio(solutionWelfare, model.optimalWelfare),
    expectation: rawExpectation,
    layers,
    angles,
    evaluations,
    candidates: collapse.candidates,
    dimension: model.dimension,
  };
}

function welfareOfModel(model: SubspaceModel, assignment: number[]): number {
  return welfareOf(model.problem, assignment);
}

/**
 * 串行绝热退火演化：与并行路径（subspace-parallel）同一算符序列、同一内核，
 * 数值逐位一致。γ_t = (t/steps)·dt 线性增长 ⇒ 代价相位走递推内核
 * （每元素每步 2 次三角函数 → 8 次乘加，相位误差 O(t·ε)≈1e−14，幺正不受影响）。
 */
export function serialAnnealEvolve(
  model: SubspaceModel,
  energies: Float64Array,
  tau: number,
  steps: number,
): { re: Float64Array; im: Float64Array } {
  const dim = model.dimension;
  const state = new SubspaceState(dim);
  state.setUniform();

  const dt = tau / steps;
  const dtPerStep = dt / steps;
  const phRe = new Float64Array(dim).fill(1);
  const phIm = new Float64Array(dim);
  const zRe = new Float64Array(dim);
  const zIm = new Float64Array(dim);
  for (let k = 0; k < dim; k++) {
    const theta = energies[k]! * dtPerStep;
    zRe[k] = Math.cos(theta);
    zIm[k] = -Math.sin(theta);
  }

  // H(s) = −(1−s)·ΣA + s·C：均匀初态是 −ΣA 的基态（Perron-Frobenius）
  for (let t = 1; t <= steps; t++) {
    const s = t / steps;
    for (const group of model.mixers) {
      state.applyFiberMixer(group, (1 - s) * dt, -1); // −A 方向（基态支路）
    }
    advanceCostKernel(state.re, state.im, phRe, phIm, zRe, zIm, 0, dim);
  }
  return { re: state.re, im: state.im };
}

export function annealSolveSubspace(
  model: SubspaceModel,
  options: QuantumSolverOptions = {},
): SubspaceSolution {
  // 无罚项子空间景观干净：短退火（τ=20/150步）经多种子验证即可全命中，
  // 大维度时尤其重要（演化成本 ∝ steps×m×dim）
  const tau = options.anneal?.tau ?? SUBSPACE_ANNEAL_TAU;
  const steps = options.anneal?.steps ?? SUBSPACE_ANNEAL_STEPS;
  validateAnnealOptions(tau, steps);
  const { shots, select, seed, topK, signal } = resolveCommonSolverOptions(options, 'shots-best');
  const rng = mulberry32(seed);

  // 代价尺度与混合算符谱宽同量级（08#28：上界估计，刻意保守）：
  // Σ_t A_t 的谱半径 ≈ Σ_t (k_max−1)，按「最大纤维尺寸」放缩到
  // m·(n−m)（或 n≤m 时的 C(m,2)）。保守方向是安全的——谱宽高估
  // ⇒ 归一化能量更小 ⇒ 有效退火更慢，只会多付演化成本、不会发散；
  // 换实际 fiber 结构（Σ_g(|vary_g|−1)）可收紧，但会平移全部退火
  // 数值结果，须与黄金基准同步重校，列为 Wave 4 的破坏性变更。
  const spectralWidth =
    model.n > model.m ? model.m * Math.max(1, model.n - model.m) : (model.m * (model.m - 1)) / 2;
  const energies = normalizedEnergies(model, 2 * spectralWidth);

  // 相位边界的协作中止点（08#19）：并行演化内核在 Worker 内部不可打断
  //（整树终止会留下不可判读的半算态），检查落在构建/演化分发之前——
  // 中止请求在可预期的最早边界被观察，而非穿透整次求解
  throwIfAborted(signal);
  // 大维度优先多线程确定性并行（失败自动回退串行，数值逐位一致）
  const evolved =
    parallelAnnealEvolve(model, energies, tau, steps) ??
    serialAnnealEvolve(model, energies, tau, steps);
  throwIfAborted(signal);
  return finishAnnealSolution(model, energies, spectralWidth, evolved, {
    tau,
    steps,
    shots,
    select,
    topK,
    rng,
  });
}

/**
 * 退火求解的异步入口（08#34 彻底解法）：演化走 waitAsync 非阻塞驱动，
 * 主线程事件循环全程存活（HTTP/WS 心跳、GC 不停摆）；坍缩与报告
 * 收尾与同步路径共用 finishAnnealSolution——同一 dispatch 序列保证
 * 与同步求解器逐位一致（由测试锚定）。
 */
export async function annealSolveSubspaceAsync(
  model: SubspaceModel,
  options: QuantumSolverOptions = {},
): Promise<SubspaceSolution> {
  const tau = options.anneal?.tau ?? SUBSPACE_ANNEAL_TAU;
  const steps = options.anneal?.steps ?? SUBSPACE_ANNEAL_STEPS;
  validateAnnealOptions(tau, steps);
  const { shots, select, seed, topK } = resolveCommonSolverOptions(options, 'shots-best');
  const rng = mulberry32(seed);

  // 谱宽上界口径与同步路径逐字相同（08#28 说明见同步路径注释）
  const spectralWidth =
    model.n > model.m ? model.m * Math.max(1, model.n - model.m) : (model.m * (model.m - 1)) / 2;
  const energies = normalizedEnergies(model, 2 * spectralWidth);

  const evolved =
    (await parallelAnnealEvolveAsync(model, energies, tau, steps)) ??
    serialAnnealEvolve(model, energies, tau, steps);
  return finishAnnealSolution(model, energies, spectralWidth, evolved, {
    tau,
    steps,
    shots,
    select,
    topK,
    rng,
  });
}

/** 退火求解共享收尾：坍缩 + 期望还原 + 解组装（同步/异步路径单源） */
function finishAnnealSolution(
  model: SubspaceModel,
  energies: Float64Array,
  spectralWidth: number,
  evolved: { re: Float64Array; im: Float64Array },
  ctx: {
    tau: number;
    steps: number;
    shots: number;
    select: CollapseMode;
    topK: number;
    rng: () => number;
  },
): SubspaceSolution {
  const { shots, select, topK, rng, steps: stepCount } = ctx;
  const probs = new Float64Array(model.dimension);
  for (let k = 0; k < probs.length; k++) {
    probs[k] = evolved.re[k]! * evolved.re[k]! + evolved.im[k]! * evolved.im[k]!;
  }
  const collapse = collapseSubspace(model, probs, select, shots, rng, topK);

  let expectation = 0;
  for (let s = 0; s < probs.length; s++) expectation += probs[s]! * energies[s]!;
  const { min: rawMin, max: rawMax } = minMaxOf(model.energies);
  // 归一化尺度为 2·spectralWidth：还原经 denormalizeExpectation（四处统一）
  const rawExpectation = denormalizeExpectation(expectation, 2 * spectralWidth, rawMin, rawMax);

  const welfare = welfareOfModel(model, collapse.assignment);
  return {
    engine: 'annealing',
    assignment: collapse.assignment,
    welfare,
    energy: -welfare,
    validMass: collapse.validMass,
    probability: collapse.probability,
    optimalityRatio: safeOptimalityRatio(welfare, model.optimalWelfare),
    expectation: rawExpectation,
    layers: stepCount,
    angles: null,
    evaluations: 1,
    candidates: collapse.candidates,
    dimension: model.dimension,
  };
}
