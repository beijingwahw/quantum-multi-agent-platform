/**
 * quantum-optimizer —— 真正的量子态调度引擎
 *
 * 本模块不再是"量子词汇 + 经典加权评分"的隐喻，而是把任务分配问题
 * 编码为量子哈密顿量，在态矢量（复振幅）上执行真实的量子力学演化，
 * 再按 Born 规则 |ψ(x)|² 测量坍缩出调度决策：
 *
 *   1. 叠加态：一个批次的所有「任务→agent」分配方案同时存在于
 *      一个 2^nq 维复希尔伯特空间中（nq = 任务数 × agent数，one-hot 编码）；
 *   2. 演化：两种真实量子算法（在经典硬件上模拟薛定谔方程）——
 *        a) QAOA（量子近似优化算法）：交替施加代价哈密顿量
 *           e^{-iγC}（对角，精确）与混合算符 e^{-iβΣX_j}（单比特旋转
 *           之积，X_j 相互对易故亦精确），变分优化角度 (γ, β) 最小化 ⟨C⟩；
 *        b) 绝热量子退火：H(s) = (1-s)·ΣX_j + s·C，s: 0→1 的
 *           Trotter 化薛定谔演化，初态 |+⟩^nq 为横场基态；
 *   3. 干涉：低能量（高福利）分配方案的振幅相长，高能量方案相消——
 *      这是相位（复数虚部）真实参与运算的体现；
 *   4. 坍缩：测量按 |amp(x)|² 采样；SchedulingDecision.probability
 *      从此是真实的 Born 概率，而非归一化分数。
 *
 * 哈密顿量编码（QUBO → Ising）：
 *   福利  W(x) = Σ_{t,a} w_{t,a}·x_{t,a} + Σ_{耦合} J·x_{q1}·x_{q2}
 *   其中耦合项来自 Agent 间的"量子纠缠"：纠缠对共同承接相关任务
 *   获得福利加成——纠缠从装饰字段变成哈密顿量中的物理耦合。
 *   约束：每任务 one-hot（Σ_a x_{t,a}=1）与每 agent 容量（≤1），
 *   均以二次罚项进入能量 E(x) = -W(x) + 罚项，保持 QUBO 结构。
 *
 * ============ 诚实的边界 ============
 * - 这是量子力学的**经典模拟**（含时薛定谔方程的数值积分），不是真 QPU。
 *   态矢量模拟指数内存 O(2^nq)，引擎以 qubitCap 分块控制规模；
 *   大规模热路径仍走经典启发式（quantumAlgorithm 默认 'hybrid'）。
 * - toIsing() 可导出 (h, J) Ising 系数——同一问题可直接交给
 *   真实量子退火机（D-Wave）或 QAOA 硬件运行，接口即插即用。
 * - 每批演化为幺正演化，测量坍缩遵循 Born 规则；QAOA 角度优化
 *   在经典侧完成（这是 QAOA 的本义：变分量子-经典混合算法）。
 */

// ----------------------------------------------------------------------------
// 类型定义
// ----------------------------------------------------------------------------

/** 任务→agent 批量分配问题（one-hot 编码的 QUBO） */
export interface AssignmentProblem {
  /** 任务标识（索引即任务编号） */
  taskIds: string[];
  /** agent 标识（索引即 agent 编号） */
  agentIds: string[];
  /**
   * 福利权重 w[t][a]：任务 t 交给 agent a 的当期价值。
   * ineligible[t][a] = true 的格子不可选（权重仍需有限值）。
   */
  weights: number[][];
  /** 资格掩码：true = 该 (任务, agent) 对不允许 */
  ineligible: boolean[][];
  /**
   * 二次耦合（纠缠加成等）：键 = q1 * nqubits + q2（q1 < q2），
   * 值 = 两比特同时为 1 时的福利加成 J（J>0 鼓励共同选中）。
   */
  couplings: Map<number, number>;
  /** one-hot 违约罚系数 */
  penaltyOneHot: number;
  /** agent 容量违约罚系数 */
  penaltyCapacity: number;
}

export type QuantumEngineKind = 'qaoa' | 'annealing';
export type CollapseMode = 'argmax-valid' | 'shots-best' | 'born';

export interface QuantumSolverOptions {
  /** QAOA 层数 p（默认 3） */
  layers?: number;
  /** 测量采样次数（shots-best 模式用，默认 128） */
  shots?: number;
  /** QAOA 角度优化随机重启次数（默认 2） */
  restarts?: number;
  /** 坍缩模式（默认 shots-best：多次测量取最优合法结果，真实退火实践协议） */
  select?: CollapseMode;
  /** 退火参数（默认 tau=120, steps=1200） */
  anneal?: { tau?: number; steps?: number };
  /** 随机种子（可复现；默认 42） */
  seed?: number;
  /** 输出 top-K 候选（默认 3） */
  topK?: number;
}

export interface QuantumCandidate {
  /** assignment[t] = agent 索引，-1 = 未分配 */
  assignment: number[];
  welfare: number;
  energy: number;
  /** 该分配的 Born 概率 |ψ(x)|² */
  probability: number;
}

export interface QuantumSolution {
  engine: QuantumEngineKind;
  assignment: number[];
  welfare: number;
  energy: number;
  /** 所选分配的 Born 概率 */
  probability: number;
  /** 全体合法分配上的概率质量（电路质量指标） */
  validMass: number;
  /** 末态能量期望 ⟨E⟩（原始能量尺度） */
  expectation: number;
  /** QAOA 实际层数 / 退火步数 */
  layers: number;
  /** QAOA 优化后的角度 [γ1..γp, β1..βp]（退火为 null） */
  angles: number[] | null;
  /** 角度优化中电路评估次数 */
  evaluations: number;
  /** born 模式采样到非法解而触发的修复标记 */
  repaired: boolean;
  /** 按 Born 概率排序的候选分配 */
  candidates: QuantumCandidate[];
}

// ----------------------------------------------------------------------------
// 可复现随机源（mulberry32）
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

/** 基态置位数（横场基态 |−⟩^{⊗n} 的相位符号） */
function popcount(k: number): number {
  let c = 0;
  while (k) {
    k &= k - 1;
    c++;
  }
  return c;
}

// ----------------------------------------------------------------------------
// 态矢量：nq 量子比特的复振幅寄存器（薛定谔演化的载体）
// ----------------------------------------------------------------------------

export class QuantumStateVector {
  readonly nqubits: number;
  readonly dim: number;
  readonly re: Float64Array;
  readonly im: Float64Array;

  constructor(nqubits: number, basisState: number = 0) {
    this.nqubits = nqubits;
    this.dim = 1 << nqubits;
    this.re = new Float64Array(this.dim);
    this.im = new Float64Array(this.dim);
    this.re[basisState] = 1;
  }

  /** |+⟩^{⊗nq}：均匀叠加，所有分配方案等权共存（QAOA 初态） */
  setUniformSuperposition(): void {
    const amp = 1 / Math.sqrt(this.dim);
    this.re.fill(amp);
    this.im.fill(0);
  }

  /**
   * |−⟩^{⊗nq}：横场 H_X = ΣX_j 的基态（本征值 −nq）。
   * 绝热退火的正确初态：从 H_X 基态出发才能跟随到代价哈密顿量的基态
   * （|+⟩^n 是 H_X 的最高态，绝热跟随会落到能量最高点——已实测验证）。
   */
  setTransverseGroundState(): void {
    const amp = 1 / Math.sqrt(this.dim);
    for (let k = 0; k < this.dim; k++) {
      this.re[k] = amp * (popcount(k) % 2 === 0 ? 1 : -1);
      this.im[k] = 0;
    }
  }

  /**
   * 代价哈密顿量演化 e^{-iγC}。C 在计算基下对角 → 每个基态获得
   * 相位 e^{-iγE(x)}。这是精确的（无 Trotter 误差）。
   */
  applyCostPhase(gamma: number, energies: Float64Array): void {
    const { re, im, dim } = this;
    for (let k = 0; k < dim; k++) {
      const e = energies[k];
      if (e === 0 && gamma === 0) continue;
      const c = Math.cos(gamma * e);
      const s = Math.sin(gamma * e);
      const r = re[k];
      const i = im[k];
      re[k] = r * c + i * s;
      im[k] = i * c - r * s;
    }
  }

  /**
   * 横场混合算符 e^{-iβ Σ_j X_j}。X_j 相互对易，故积之积精确：
   * 每个量子比特独立旋转 exp(-iβX) = cosβ·I - i·sinβ·X。
   */
  applyMixer(beta: number): void {
    const { re, im, dim, nqubits } = this;
    const c = Math.cos(beta);
    const s = Math.sin(beta);
    for (let j = 0; j < nqubits; j++) {
      const mask = 1 << j;
      for (let k = 0; k < dim; k++) {
        if (k & mask) continue;
        const p = k | mask;
        const re0 = re[k], im0 = im[k];
        const re1 = re[p], im1 = im[p];
        // new_a0 = c·a0 - i·s·a1
        re[k] = c * re0 + s * im1;
        im[k] = c * im0 - s * re1;
        // new_a1 = c·a1 - i·s·a0
        re[p] = c * re1 + s * im0;
        im[p] = c * im1 - s * re0;
      }
    }
  }

  /** 各基态的 Born 概率 |amp|² */
  probabilities(): Float64Array {
    const probs = new Float64Array(this.dim);
    for (let k = 0; k < this.dim; k++) {
      probs[k] = this.re[k] * this.re[k] + this.im[k] * this.im[k];
    }
    return probs;
  }

  /** 态矢量范数（检验幺正性保持） */
  norm(): number {
    let sum = 0;
    for (let k = 0; k < this.dim; k++) {
      sum += this.re[k] * this.re[k] + this.im[k] * this.im[k];
    }
    return Math.sqrt(sum);
  }

  clone(): QuantumStateVector {
    const copy = new QuantumStateVector(this.nqubits);
    copy.re.set(this.re);
    copy.im.set(this.im);
    return copy;
  }
}

// ----------------------------------------------------------------------------
// 问题构建与能量
// ----------------------------------------------------------------------------

export interface ProblemEnergies {
  /** 每个基态的原始能量 E(x) */
  energies: Float64Array;
  min: number;
  max: number;
  nqubits: number;
  dim: number;
}

function nQubitsOf(problem: AssignmentProblem): number {
  return problem.taskIds.length * problem.agentIds.length;
}

/** 罚系数默认值：福利量级的 2 倍，保证违约方案能量必然劣于任何合法方案 */
export function defaultPenalties(problem: AssignmentProblem): { oneHot: number; capacity: number } {
  let magnitude = 1;
  for (const row of problem.weights) {
    for (const w of row) magnitude = Math.max(magnitude, Math.abs(w));
  }
  let couplingSum = 0;
  for (const j of problem.couplings.values()) couplingSum += Math.abs(j);
  const scale = 2 * (magnitude * problem.taskIds.length + couplingSum + 1);
  return { oneHot: scale, capacity: scale };
}

/** 预计算全部基态能量（一次性 O(dim·任务数·agent数)，供对角演化复用） */
export function computeEnergies(problem: AssignmentProblem): ProblemEnergies {
  const m = problem.taskIds.length;
  const n = problem.agentIds.length;
  const nqubits = nQubitsOf(problem);
  const dim = 1 << nqubits;
  const energies = new Float64Array(dim);
  const couplings = problem.couplings;
  const perTask = new Int32Array(n);
  const perAgent = new Int32Array(m);
  let min = Infinity;
  let max = -Infinity;

  for (let k = 0; k < dim; k++) {
    // 统计每个任务/agent 的选中比特数
    perTask.fill(0);
    perAgent.fill(0);
    let welfare = 0;
    for (let t = 0; t < m; t++) {
      for (let a = 0; a < n; a++) {
        if (k & (1 << (t * n + a))) {
          perTask[t]++;
          perAgent[a]++;
          welfare += problem.weights[t][a];
        }
      }
    }
    // 二次耦合（纠缠加成）
    for (const [key, j] of couplings) {
      const q1 = Math.floor(key / nqubits);
      const q2 = key % nqubits;
      if (q1 < q2 && (k & (1 << q1)) !== 0 && (k & (1 << q2)) !== 0) {
        welfare += j;
      }
    }
    let penalty = 0;
    for (let t = 0; t < m; t++) {
      if (perTask[t] !== 1) penalty += problem.penaltyOneHot * (perTask[t] - 1) * (perTask[t] - 1);
    }
    for (let a = 0; a < n; a++) {
      const c = perAgent[a];
      if (c > 1) penalty += problem.penaltyCapacity * ((c * (c - 1)) / 2);
    }
    const e = -welfare + penalty;
    energies[k] = e;
    if (e < min) min = e;
    if (e > max) max = e;
  }
  return { energies, min, max, nqubits, dim };
}

/** 耦合键编码：q1 < q2 */
export function couplingKey(q1: number, q2: number, nqubits: number): number {
  return q1 * nqubits + q2;
}

/** 解码基态 → 分配（assignment[t] = agent 索引；违约记 -1） */
export function decodeAssignment(state: number, m: number, n: number): number[] {
  const assignment = new Array<number>(m).fill(-1);
  for (let t = 0; t < m; t++) {
    let chosen = -1;
    for (let a = 0; a < n; a++) {
      if (state & (1 << (t * n + a))) {
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

/** 分配是否合法：one-hot + 资格 + 容量 */
export function isValidAssignment(problem: AssignmentProblem, assignment: number[]): boolean {
  const m = problem.taskIds.length;
  const used = new Set<number>();
  for (let t = 0; t < m; t++) {
    const a = assignment[t];
    if (a < 0) return false;
    if (problem.ineligible[t][a]) return false;
    if (used.has(a)) return false;
    used.add(a);
  }
  return true;
}

/** 分配的福利（含耦合加成，不含罚项） */
export function welfareOf(problem: AssignmentProblem, assignment: number[]): number {
  const m = problem.taskIds.length;
  const n = problem.agentIds.length;
  const nqubits = nQubitsOf(problem);
  let welfare = 0;
  for (let t = 0; t < m; t++) {
    const a = assignment[t];
    if (a >= 0) welfare += problem.weights[t][a];
  }
  for (const [key, j] of problem.couplings) {
    const q1 = Math.floor(key / nqubits);
    const q2 = key % nqubits;
    const t1 = Math.floor(q1 / n), a1 = q1 % n;
    const t2 = Math.floor(q2 / n), a2 = q2 % n;
    if (assignment[t1] === a1 && assignment[t2] === a2) welfare += j;
  }
  return welfare;
}

// ----------------------------------------------------------------------------
// 精确最优（分支定界穷举，作为量子解质量的诚实参照）
// ----------------------------------------------------------------------------

export interface BruteForceResult {
  assignment: number[];
  welfare: number;
  /** 合法分配总数（问题规模参照） */
  validCount: number;
  /** 全部合法解的福利降序表（截断至 limit） */
  ranking: number[];
}

export function bruteForceOptimum(problem: AssignmentProblem, limit = 10): BruteForceResult {
  const m = problem.taskIds.length;
  const n = problem.agentIds.length;
  const assignment = new Array<number>(m).fill(-1);
  const used = new Array<boolean>(n).fill(false);
  let best = new Array<number>(m).fill(-1);
  let bestWelfare = -Infinity;
  const welfares: number[] = [];

  const dfs = (t: number, welfare: number) => {
    if (t === m) {
      welfares.push(welfare);
      if (welfare > bestWelfare) {
        bestWelfare = welfare;
        best = assignment.slice();
      }
      return;
    }
    for (let a = 0; a < n; a++) {
      if (problem.ineligible[t][a] || used[a]) continue;
      used[a] = true;
      assignment[t] = a;
      // 该步引入的耦合加成
      let extra = 0;
      const qNew = t * n + a;
      for (let t2 = 0; t2 < t; t2++) {
        const a2 = assignment[t2];
        const lo = Math.min(qNew, t2 * n + a2);
        const hi = Math.max(qNew, t2 * n + a2);
        const j = problem.couplings.get(lo * (m * n) + hi);
        if (j !== undefined) extra += j;
      }
      dfs(t + 1, welfare + problem.weights[t][a] + extra);
      used[a] = false;
      assignment[t] = -1;
    }
  };

  dfs(0, 0);
  welfares.sort((x, y) => y - x);
  return {
    assignment: bestWelfare > -Infinity ? best : [],
    welfare: bestWelfare > -Infinity ? bestWelfare : 0,
    validCount: welfares.length,
    ranking: welfares.slice(0, limit)
  };
}

// ----------------------------------------------------------------------------
// QAOA：变分量子-经典混合算法
// ----------------------------------------------------------------------------

/**
 * 构建 p 层 QAOA 电路并返回末态。
 * energies 需先归一化到 [0,1]（γ 的有效区间依赖量纲）。
 */
function runQaoaCircuit(
  angles: number[],
  layers: number,
  nqubits: number,
  energies: Float64Array
): QuantumStateVector {
  const state = new QuantumStateVector(nqubits);
  state.setUniformSuperposition();
  for (let p = 0; p < layers; p++) {
    state.applyCostPhase(angles[p], energies);
    state.applyMixer(angles[layers + p]);
  }
  return state;
}

function expectationOf(state: QuantumStateVector, energies: Float64Array): number {
  const probs = state.probabilities();
  let sum = 0;
  for (let k = 0; k < state.dim; k++) sum += probs[k] * energies[k];
  return sum;
}

/** 坐标下降角度优化（经典侧的变分循环，QAOA 的本义） */
function optimizeQaoaAngles(
  layers: number,
  nqubits: number,
  energies: Float64Array,
  restarts: number,
  rng: () => number
): { angles: number[]; expectation: number; evaluations: number } {
  let bestAngles: number[] = [];
  let bestExpectation = Infinity;
  let evaluations = 0;

  for (let r = 0; r < restarts; r++) {
    // 初值：绝热路径启发的线性斜坡（首轮）+ 随机扰动（后续重启）
    const angles: number[] = [];
    for (let p = 0; p < layers; p++) {
      angles.push(r === 0
        ? ((p + 1) / layers) * Math.PI * 0.5
        : rng() * Math.PI);
    }
    for (let p = 0; p < layers; p++) {
      angles.push(r === 0
        ? (1 - (p + 1) / (layers + 1)) * Math.PI * 0.25
        : rng() * Math.PI * 0.5);
    }

    const evaluate = (a: number[]): number => {
      evaluations++;
      return expectationOf(runQaoaCircuit(a, layers, nqubits, energies), energies);
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

// ----------------------------------------------------------------------------
// 量子退火：绝热演化的 Trotter 化薛定谔模拟
// ----------------------------------------------------------------------------

function runAnnealingCircuit(
  tau: number,
  steps: number,
  nqubits: number,
  energies: Float64Array
): QuantumStateVector {
  const state = new QuantumStateVector(nqubits);
  state.setTransverseGroundState(); // H_X 基态 |−⟩^{⊗n}
  const dt = tau / steps;
  for (let t = 1; t <= steps; t++) {
    const s = t / steps; // 绝热调度 s: 0 → 1
    state.applyMixer((1 - s) * dt); // e^{-i(1-s)dt ΣX}（X_j 对易，精确）
    state.applyCostPhase(s * dt, energies); // e^{-i s dt C}（对角，精确）
  }
  return state;
}

// ----------------------------------------------------------------------------
// 测量坍缩：从末态概率分布提取调度决策
// ----------------------------------------------------------------------------

function selectSolution(
  problem: AssignmentProblem,
  energiesInfo: ProblemEnergies,
  probs: Float64Array,
  mode: CollapseMode,
  shots: number,
  rng: () => number,
  topK: number
): { assignment: number[]; probability: number; repaired: boolean; validMass: number; candidates: QuantumCandidate[] } {
  const m = problem.taskIds.length;
  const n = problem.agentIds.length;

  // 合法基态集合、概率质量与最大概率合法基态（坍缩参照）
  let validMass = 0;
  let bestValidProb = 0;
  const validStates: number[] = [];
  for (let k = 0; k < probs.length; k++) {
    if (probs[k] <= 0) continue;
    const assignment = decodeAssignment(k, m, n);
    if (isValidAssignment(problem, assignment)) {
      validMass += probs[k];
      validStates.push(k);
      if (probs[k] > bestValidProb) bestValidProb = probs[k];
    }
  }

  let chosenState = -1;
  let repaired = false;

  if (mode === 'born') {
    // 真随机坍缩：按 |ψ|² 采一次样（Born 规则的忠实实现）
    const r = rng();
    let cum = 0;
    for (let k = 0; k < probs.length; k++) {
      cum += probs[k];
      if (r <= cum) {
        chosenState = k;
        break;
      }
    }
    if (chosenState < 0) chosenState = probs.length - 1;
  } else if (mode === 'shots-best' && validStates.length > 0) {
    // 多次测量取最优：采样 shots 次在其中选能量最低的合法结果
    const cum = new Float64Array(probs.length);
    let acc = 0;
    for (let k = 0; k < probs.length; k++) {
      acc += probs[k];
      cum[k] = acc;
    }
    let bestEnergy = Infinity;
    for (let s = 0; s < shots; s++) {
      const r = rng() * acc;
      let lo = 0, hi = probs.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (cum[mid] < r) lo = mid + 1; else hi = mid;
      }
      const assignment = decodeAssignment(lo, m, n);
      if (isValidAssignment(problem, assignment) && energiesInfo.energies[lo] < bestEnergy) {
        bestEnergy = energiesInfo.energies[lo];
        chosenState = lo;
      }
    }
  }

  // argmax-valid 兜底（也是 shots-best 全部采到非法解时的回退）：
  // 在末态分布上取概率最大的合法分配——仍是 Born 分布的读取
  if (chosenState < 0) {
    let bestProb = -1;
    for (const k of validStates) {
      if (probs[k] > bestProb) {
        bestProb = probs[k];
        chosenState = k;
      }
    }
  }

  // 极端情形（罚参数失效导致合法质量≈0）：修复采样结果
  let assignment: number[];
  if (chosenState >= 0) {
    assignment = decodeAssignment(chosenState, m, n);
    if (!isValidAssignment(problem, assignment)) {
      assignment = repairAssignment(problem, assignment);
      repaired = true;
      chosenState = -1;
    }
  } else {
    assignment = repairAssignment(problem, new Array<number>(m).fill(-1));
    repaired = true;
  }

  // top-K 候选（按 Born 概率降序）
  const candidates: QuantumCandidate[] = validStates
    .map((k) => ({
      k,
      p: probs[k]
    }))
    .sort((x, y) => y.p - x.p)
    .slice(0, topK)
    .map(({ k, p }) => {
      const a = decodeAssignment(k, m, n);
      return {
        assignment: a,
        welfare: welfareOf(problem, a),
        energy: energiesInfo.energies[k],
        probability: p
      };
    });

  return {
    assignment,
    probability: chosenState >= 0 ? probs[chosenState] : bestValidProb,
    repaired,
    validMass,
    candidates
  };
}

/** 非法分配修复：违约任务贪心转给剩余最优合法 agent */
function repairAssignment(problem: AssignmentProblem, assignment: number[]): number[] {
  const m = problem.taskIds.length;
  const n = problem.agentIds.length;
  const used = new Set<number>();
  const repaired = new Array<number>(m).fill(-1);
  for (let t = 0; t < m; t++) {
    const a = assignment[t];
    if (a >= 0 && !problem.ineligible[t][a] && !used.has(a)) {
      repaired[t] = a;
      used.add(a);
    }
  }
  for (let t = 0; t < m; t++) {
    if (repaired[t] >= 0) continue;
    let best = -1;
    let bestW = -Infinity;
    for (let a = 0; a < n; a++) {
      if (problem.ineligible[t][a] || used.has(a)) continue;
      if (problem.weights[t][a] > bestW) {
        bestW = problem.weights[t][a];
        best = a;
      }
    }
    if (best >= 0) {
      repaired[t] = best;
      used.add(best);
    }
  }
  return repaired;
}

// ----------------------------------------------------------------------------
// 求解入口
// ----------------------------------------------------------------------------

export function qaoaSolve(problem: AssignmentProblem, options: QuantumSolverOptions = {}): QuantumSolution {
  const layers = options.layers ?? 3;
  const shots = options.shots ?? 128;
  const restarts = options.restarts ?? 2;
  const select = options.select ?? 'argmax-valid';
  const seed = options.seed ?? 42;
  const topK = options.topK ?? 3;
  const rng = mulberry32(seed);

  const energiesInfo = computeEnergies(problem);
  const span = energiesInfo.max - energiesInfo.min;
  const normalized = new Float64Array(energiesInfo.dim);
  if (span > 0) {
    for (let k = 0; k < normalized.length; k++) {
      normalized[k] = (energiesInfo.energies[k] - energiesInfo.min) / span;
    }
  }

  const { angles, expectation, evaluations } = optimizeQaoaAngles(
    layers, energiesInfo.nqubits, normalized, restarts, rng
  );
  const finalState = runQaoaCircuit(angles, layers, energiesInfo.nqubits, normalized);
  const probs = finalState.probabilities();

  const selection = selectSolution(
    problem, energiesInfo, probs, select, shots, rng, topK
  );

  const welfare = welfareOf(problem, selection.assignment);
  const isValid = isValidAssignment(problem, selection.assignment);
  const energy = isValid
    ? -welfare
    : -welfare + problem.penaltyOneHot; // 修复后近似能量（报告用）

  return {
    engine: 'qaoa',
    assignment: selection.assignment,
    welfare,
    energy,
    probability: selection.probability,
    validMass: selection.validMass,
    expectation: expectation * span + energiesInfo.min,
    layers,
    angles,
    evaluations,
    repaired: selection.repaired,
    candidates: selection.candidates
  };
}

export function annealSolve(problem: AssignmentProblem, options: QuantumSolverOptions = {}): QuantumSolution {
  const tau = options.anneal?.tau ?? 120;
  const steps = options.anneal?.steps ?? 1200;
  const shots = options.shots ?? 128;
  const select = options.select ?? 'argmax-valid';
  const seed = options.seed ?? 42;
  const topK = options.topK ?? 3;
  const rng = mulberry32(seed);

  const energiesInfo = computeEnergies(problem);
  const span = energiesInfo.max - energiesInfo.min;
  // 代价能量尺度取横场谱宽（≈2·nqubits）同量级：与 ΣX 公平竞争，
  // 过小则合法/非法态近乎简并（实测会把质量散在非法子空间上）
  const scale = 2 * energiesInfo.nqubits;
  const normalized = new Float64Array(energiesInfo.dim);
  if (span > 0) {
    for (let k = 0; k < normalized.length; k++) {
      normalized[k] = ((energiesInfo.energies[k] - energiesInfo.min) / span) * scale;
    }
  }

  const finalState = runAnnealingCircuit(tau, steps, energiesInfo.nqubits, normalized);
  const probs = finalState.probabilities();
  const selection = selectSolution(
    problem, energiesInfo, probs, select, shots, rng, topK
  );

  const welfare = welfareOf(problem, selection.assignment);
  const isValid = isValidAssignment(problem, selection.assignment);
  let expectation = 0;
  for (let k = 0; k < probs.length; k++) expectation += probs[k] * normalized[k];
  expectation = expectation * span + energiesInfo.min;

  return {
    engine: 'annealing',
    assignment: selection.assignment,
    welfare,
    energy: isValid ? -welfare : -welfare + problem.penaltyOneHot,
    probability: selection.probability,
    validMass: selection.validMass,
    expectation,
    layers: steps,
    angles: null,
    evaluations: 1,
    repaired: selection.repaired,
    candidates: selection.candidates
  };
}

// ----------------------------------------------------------------------------
// QPU 导出：QUBO / Ising 系数（可直接交给真实量子硬件）
// ----------------------------------------------------------------------------

export interface IsingModel {
  /** 外场 h_i（z 基） */
  h: number[];
  /** 耦合 J_{ij}（i < j） */
  J: Map<number, number>;
  /** 常数偏移（能量 = Σh_i z_i + ΣJ_ij z_i z_j + offset, z ∈ {±1}） */
  offset: number;
  nqubits: number;
}

/**
 * 把调度问题导出为 Ising 模型 (h, J)。能量最小化 z 配置 ↔ 最优分配。
 * 该格式与 D-Wave / OpenQAOA 等真实量子求解器直接兼容：
 * 同一个调度问题可在真 QPU 上运行，模拟器仅是执行位置的差异。
 */
export function toIsing(problem: AssignmentProblem): IsingModel {
  const m = problem.taskIds.length;
  const n = problem.agentIds.length;
  const nqubits = nQubitsOf(problem);

  // QUBO：E = Σ c_q x_q + Σ Q_{q1q2} x_q1 x_q2 + const
  const c = new Array<number>(nqubits).fill(0);
  const Q = new Map<number, number>();
  const addQ = (q1: number, q2: number, v: number) => {
    if (q1 > q2) [q1, q2] = [q2, q1];
    if (q1 === q2) {
      c[q1] += v;
      return;
    }
    const key = q1 * nqubits + q2;
    Q.set(key, (Q.get(key) ?? 0) + v);
  };
  let offset = 0;

  // 线性：福利（负号进能量）+ one-hot 线性部分 −λ·x
  // (Σx−1)² = 2·C(c,2) − c + 1：每任务常数 +λ，每比特线性 −λ，对内 +2λ
  for (let t = 0; t < m; t++) {
    offset += problem.penaltyOneHot;
    for (let a = 0; a < n; a++) {
      const q = t * n + a;
      c[q] += -problem.weights[t][a];
      c[q] += -problem.penaltyOneHot;
    }
  }
  // one-hot 二次部分：同任务对 +2λ
  for (let t = 0; t < m; t++) {
    for (let a1 = 0; a1 < n; a1++) {
      for (let a2 = a1 + 1; a2 < n; a2++) {
        addQ(t * n + a1, t * n + a2, 2 * problem.penaltyOneHot);
      }
    }
  }
  // 容量：同 agent 跨任务对 +λcap
  for (let a = 0; a < n; a++) {
    for (let t1 = 0; t1 < m; t1++) {
      for (let t2 = t1 + 1; t2 < m; t2++) {
        addQ(t1 * n + a, t2 * n + a, problem.penaltyCapacity);
      }
    }
  }
  // 纠缠耦合：福利加成 J → 能量 -J
  for (const [key, j] of problem.couplings) {
    const q1 = Math.floor(key / nqubits);
    const q2 = key % nqubits;
    addQ(q1, q2, -j);
  }

  // x = (1 - z)/2 → Ising：h_i = -(c_i/2 + Σ_j Q_ij/2)，J_ij = Q_ij/4，offset += Σc_i/2 + ΣQ_ij/4
  const h = new Array<number>(nqubits).fill(0);
  const J = new Map<number, number>();
  let isingOffset = offset;
  for (let q = 0; q < nqubits; q++) {
    h[q] = -c[q] / 2;
    isingOffset += c[q] / 2;
  }
  for (const [key, v] of Q) {
    const q1 = Math.floor(key / nqubits);
    const q2 = key % nqubits;
    J.set(key, v / 4);
    h[q1] -= v / 4;
    h[q2] -= v / 4;
    isingOffset += v / 4;
  }
  return { h, J, offset: isingOffset, nqubits };
}
