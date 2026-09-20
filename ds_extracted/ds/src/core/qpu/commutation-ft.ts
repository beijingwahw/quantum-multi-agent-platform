/**
 * commutation-ft —— 对易性感知的容错资源估算修正（R18 创新，opt-in）
 *
 * ============ 定位 ============
 *
 * ft-estimate.ts 的估算模型把每一层的全部旋转（耦合 RZZ + 场 RZ +
 * 混合 RX）当**完全串行**的逻辑操作：logicalOpsTotal = depth·(E + 2·nq)，
 * 每个操作独立消耗 roundsPerOpDistanceFactor·d 轮综合征。这个串行假设
 * 对 Z 型 Pauli 旋转层是可修正的系统性高估：Pauli 算子对易当且仅当
 * 反对易位置数为偶数〔待双源〕，Z 单项与 Z 双项、共享 0 或 2 个比特的
 * Z 双项之间全部对易——但**并行执行的单位不是「对易」而是「不共享
 * 逻辑比特」**（一轮综合征提取中每个逻辑比特只能参与一个操作）。
 * 于是每层的最少轮数问题恰好是图论的最少匹配分解：
 *
 *   代价层的并行分解 = 交互图的边着色（顶点项作悬挂边），组 = matching。
 *
 * 本模块给出：机器可验证的**匹配下界定理**、二部图的 **Kőnig 精确
 * 构造**（= 下界，零缺口）、一般图的 First-Fit 构造（不变量验证 + 与
 * 下界的 gap 如实上报），以及在**完全相同假设**下的 FT 画像修正
 * （轮数/信道错误/墙钟按 (组数+1)/(E+2nq) 比例缩减，T 计数不动）。
 *
 * ============ 精确主张（可证伪） ============
 *
 * 定理 A（匹配下界）：nq 个逻辑比特、耦合边集 E、场项比特集 F 的
 * Pauli 层，任何「组内项目两两不共享比特」的合法分解的组数
 *   ≥ max_{v} ( deg_E(v) + [v ∈ F] ) = Δ(G⁺)。
 * 证明：顶点 v 的 deg_E(v) 条耦合边与（若 v∈F）其场项两两共享 v，
 * 必两两异组。机器验证：枚举小图全部分解（测试）。
 *
 * 定理 B（Kőnig 精确构造）：G⁺ 二部（⟺ 交互图二部——悬挂边不改变
 * 二部性）时，存在恰 Δ(G⁺) 组的合法分解（Kőnig 边着色定理：二部图
 * 边色数 = 最大度〔待双源〕）。本模块的逐边算法构造性地达到它：
 * 边 (u,v)，取 a ∈ free(u)、b ∈ free(v)；a=b 直接染；否则沿 v 起
 * (a,b)-交替路翻转后染 a。正确性的关键步：若交替路到达 u，则该路
 * 与 (u,v) 构成奇数长闭途径，与二部性矛盾——二部图中交替路**不可能**
 * 到达 u，翻转恒安全。复杂度 O(E·K)。
 *
 * 定理 C（FT 画像缩减，模型内恒等式）：在 ft-estimate 的同一假设集
 * 下，并行画像满足（每层）：
 *   rotationsPerLayer: E + 2·nq  →  groups + 1（+1 = 混合层 RX 轮，
 *     RX 两两不共享比特恒 1 组）；
 *   syndromeRoundsTotal、epsilonChannel、wallTimeMs 随该比值**线性**缩减；
 *   tGatesTotal、epsilonDistillation、physicalQubits 逐字节不变。
 * 调度问题的稠密 Ising 编码（任务块内 one-hot 团 + 同 agent 容量对）
 * 满足 Δ = m+n−2、E = m·C(n,2)+n·C(m,2)：缩减因子 = (E+2mn)/(m+n)
 * ——随规模平方增长。
 *
 * ============ 诚实的边界 ============
 *
 * - 并行模型是**逻辑层综合征轮**的抽象：一轮内不共享逻辑比特的 Pauli
 *   旋转可同时提取综合征。真实面码格点手术的并行 Pauli 测量深度还受
 *   测量算子支撑的**几何形状**限制（非局部耦合需要 SWAP/传送，本模块
 *   不建模路由开销）——逻辑拓扑图与硬件拓扑不一致时，本画像是乐观
 *   下界方向的修正量，不是墙钟承诺。〔litinski-2019 类格点手术工作〕
 * - 门级 Trotter 实现不一定能兑现该并行性（编译器串行化）；本模块修正
 *   的是 FT 逻辑层资源画像口径，与 ft-estimate 串行画像**并列对读**，
 *   绝不改写 ft-estimate 的任何输出。
 * - 一般图：First-Fit 构造**不保证**达到下界（一般图边着色属 Vizing
 *   类问题，χ′ ∈ {Δ, Δ+1}〔待双源〕，构造性精确算法复杂）——gap > 0
 *   的实例如实上报。二部图恒零缺口（定理 B）。
 * - 场项集缺省为「全部比特」（与 ft-estimate 的 rotationsPerLayer 口径
 *   一致：场 RZ 每 qubit 一个）；传显式子集时下界相应下调，口径差异
 *   由调用方声明。
 * - 复杂度：二部着色 O(E·K)；First-Fit O(E·G)；验证器 O(E)。无 RNG、
 *   无 IO；分组按色号升序、组内按边序，输出确定。
 *
 * ============ 文献接地（形状级，〔待双源〕） ============
 *
 * - Kőnig 1916 前后「graph coloring / bipartite edge chromatic number
 *   equals maximum degree」〔待双源〕
 * - Vizing 1964/1965 边着色上下界 χ′ ∈ {Δ, Δ+1}〔待双源〕
 * - Misra–Gries 1992 构造性 Δ+1 边着色〔待双源〕
 * - Pauli 群对易结构与辛内积判据（Nielsen–Chuang 教科书族）〔待双源〕
 * - 面码格点手术的并行 Pauli 测量（Litinski 2019 前后 "game of
 *   surface codes" 族）〔待双源〕
 */

import { estimateFtCircuit, DEFAULT_FT_ASSUMPTIONS } from './ft-estimate.js';
import type {
  FtEstimate,
  FtEstimateAssumptions,
  LogicalCircuitProfile,
  FtCodeSpec,
} from './ft-estimate.js';
import { logicalErrorPerRound } from './ft-estimate.js';
import { QuantumEstimateError } from '../../utils/errors.js';

/** 耦合边（q1 < q2，简单图：无重边——Ising J 的 Map 键已保证唯一） */
export type CouplingEdge = readonly [number, number];

/** 一组可并行项目：耦合边 + 场项比特（组内两两不共享逻辑比特） */
export interface LayerGroup {
  readonly couplings: readonly CouplingEdge[];
  readonly fieldQubits: readonly number[];
}

/** 分解结果（对读面：algorithm / 下界 / 缺口全公开） */
export interface LayerPartition {
  readonly groups: readonly LayerGroup[];
  readonly groupCount: number;
  /** 定理 A 下界 Δ(G⁺)；合法分解恒 ≥ 此值（验证器钉死） */
  readonly lowerBound: number;
  /** groupCount − lowerBound；二部（Kőnig）恒 0，First-Fit 如实上报 */
  readonly gap: number;
  readonly bipartite: boolean;
  readonly algorithm: 'koenig' | 'first-fit';
  /** 分解覆盖的场项口径（'all' 时为全部比特的压缩表示） */
  readonly fieldTermCount: number;
}

// ----------------------------------------------------------------------------
// 输入域校验
// ----------------------------------------------------------------------------

interface LayerSpec {
  readonly nqubits: number;
  readonly couplings: readonly CouplingEdge[];
  readonly fieldQubits: readonly number[];
  readonly fieldAll: boolean;
}

function parseLayerSpec(
  nqubits: number,
  couplings: readonly CouplingEdge[],
  fieldTerms: 'all' | 'none' | readonly number[],
): LayerSpec {
  if (!Number.isInteger(nqubits) || nqubits < 1) {
    throw new QuantumEstimateError(
      `parallelizeLayer: nqubits must be a positive integer, got ${String(nqubits)}`,
    );
  }
  const seen = new Set<string>();
  for (let i = 0; i < couplings.length; i++) {
    const e = couplings[i]!;
    const [q1, q2] = e;
    if (
      !Number.isInteger(q1) ||
      !Number.isInteger(q2) ||
      q1 < 0 ||
      q2 < 0 ||
      q1 >= nqubits ||
      q2 >= nqubits ||
      q1 === q2
    ) {
      throw new QuantumEstimateError(
        `parallelizeLayer: couplings[${i}] must be [q1, q2] with 0 <= q1 < q2 < ${nqubits}, got ${String(e)}`,
      );
    }
    if (q1 > q2) {
      throw new QuantumEstimateError(
        `parallelizeLayer: couplings[${i}] must be normalized (q1 < q2), got ${String(e)}`,
      );
    }
    const key = `${q1},${q2}`;
    if (seen.has(key)) {
      throw new QuantumEstimateError(
        `parallelizeLayer: duplicate coupling edge (${key}); the matching-decomposition model is stated over simple graphs`,
      );
    }
    seen.add(key);
  }
  if (fieldTerms === 'all') {
    return {
      nqubits,
      couplings,
      fieldQubits: Array.from({ length: nqubits }, (_, q) => q),
      fieldAll: true,
    };
  }
  if (fieldTerms === 'none') {
    return { nqubits, couplings, fieldQubits: [], fieldAll: false };
  }
  const fieldSet = new Set<number>();
  for (const q of fieldTerms) {
    if (!Number.isInteger(q) || q < 0 || q >= nqubits) {
      throw new QuantumEstimateError(
        `parallelizeLayer: fieldTerms entries must be integers in [0, ${nqubits}), got ${String(q)}`,
      );
    }
    if (fieldSet.has(q)) {
      throw new QuantumEstimateError(
        `parallelizeLayer: duplicate field term on qubit ${String(q)}`,
      );
    }
    fieldSet.add(q);
  }
  return { nqubits, couplings, fieldQubits: [...fieldTerms], fieldAll: false };
}

// ----------------------------------------------------------------------------
// 下界与二部判定
// ----------------------------------------------------------------------------

/** 定理 A 下界：Δ(G⁺) = max_v (deg_E(v) + [v ∈ F]) */
export function matchingLowerBound(spec: {
  nqubits: number;
  couplings: readonly CouplingEdge[];
  fieldQubits: readonly number[];
}): number {
  const deg = new Array<number>(spec.nqubits).fill(0);
  for (const [q1, q2] of spec.couplings) {
    deg[q1]!++;
    deg[q2]!++;
  }
  const field = new Set(spec.fieldQubits);
  let bound = 0;
  for (let v = 0; v < spec.nqubits; v++) {
    bound = Math.max(bound, deg[v]! + (field.has(v) ? 1 : 0));
  }
  return bound;
}

/** BFS 染色二部判定（非连通图逐分量；悬边形前在真实交互图上判定） */
export function interactionIsBipartite(
  nqubits: number,
  couplings: readonly CouplingEdge[],
): boolean {
  const adj: number[][] = Array.from({ length: nqubits }, () => []);
  for (const [q1, q2] of couplings) {
    adj[q1]!.push(q2);
    adj[q2]!.push(q1);
  }
  const side = new Array<number | null>(nqubits).fill(null);
  for (let s = 0; s < nqubits; s++) {
    if (side[s] !== null) continue;
    side[s] = 0;
    const queue = [s];
    while (queue.length > 0) {
      const v = queue.shift()!;
      for (const w of adj[v]!) {
        if (side[w] === null) {
          side[w] = 1 - side[v]!;
          queue.push(w);
        } else if (side[w] === side[v]) {
          return false;
        }
      }
    }
  }
  return true;
}

// ----------------------------------------------------------------------------
// Kőnig 逐边着色（二部精确，定理 B）
// ----------------------------------------------------------------------------

/**
 * 内部统一表示：全部项目（耦合边 + 场项悬边 v—(v+nq)）作简单边集，
 * 端点 u < v。二部图中悬挂边不破坏二部性（虚拟顶点度 1）。
 */
interface FlatEdge {
  readonly a: number;
  readonly b: number;
  readonly coupling: CouplingEdge | null; // null = 场项悬边（a 为真实比特）
}

function flatten(spec: LayerSpec): FlatEdge[] {
  const edges: FlatEdge[] = spec.couplings.map((e) => ({ a: e[0], b: e[1], coupling: e }));
  for (const v of spec.fieldQubits) {
    edges.push({ a: v, b: spec.nqubits + v, coupling: null });
  }
  return edges;
}

/**
 * Kőnig 逐边着色：色号 1..K（K = Δ(G⁺)，即下界）。正确性注记见定理 B：
 * 二部图中 (a,b)-交替路不可能到达 u（否则与 (u,v) 成奇闭途径），翻转
 * 恒安全；free 恒非空（部分着色下 used(v) ≤ deg−1 ≤ K−1）。
 */
function koenigColoring(edges: FlatEdge[], k: number): number[] {
  // colorAt.get(v).get(c) = 以 v 为端点、色 c 的边 id（每顶点每色至多一边）
  const colorAt = new Map<number, Map<number, number>>();
  const colorOf = new Array<number>(edges.length).fill(0);
  const edgeAt = (v: number, c: number): number | undefined => colorAt.get(v)?.get(c);
  const setColor = (id: number, c: number): void => {
    const e = edges[id]!;
    const old = colorOf[id]!;
    if (old !== 0) {
      // 翻转序列的瞬时同色冲突：前一条边可能已把本顶点 old 色的记录
      // 覆盖成自己——删除必须「认主」（只删确实指向本边的记录），
      // 否则误删他边的新记录、造出幽灵边（chase 随之绕环）
      const ma = colorAt.get(e.a);
      if (ma?.get(old) === id) ma.delete(old);
      const mb = colorAt.get(e.b);
      if (mb?.get(old) === id) mb.delete(old);
    }
    if (!colorAt.has(e.a)) colorAt.set(e.a, new Map());
    if (!colorAt.has(e.b)) colorAt.set(e.b, new Map());
    colorAt.get(e.a)!.set(c, id);
    colorAt.get(e.b)!.set(c, id);
    colorOf[id] = c;
  };

  for (let id = 0; id < edges.length; id++) {
    const e = edges[id]!;
    let pickA = 0;
    for (let c = 1; c <= k; c++) {
      if (!colorAt.get(e.a)?.has(c)) {
        pickA = c;
        break;
      }
    }
    let pickB = 0;
    for (let c = 1; c <= k; c++) {
      if (!colorAt.get(e.b)?.has(c)) {
        pickB = c;
        break;
      }
    }
    // free 恒非空的证明见文件头（used ≤ deg−1 ≤ K−1）；0 兜底＝实现 bug
    if (pickA === 0 || pickB === 0) {
      throw new QuantumEstimateError(
        `koenigColoring: internal invariant broken (no free color at an endpoint with K=${k}); ` +
          'this is an implementation bug, not a caller error',
      );
    }
    if (pickA === pickB) {
      setColor(id, pickA);
      continue;
    }
    // pickA ∈ free(a) ∩ used(b)；pickB ∈ free(b) ∩ used(a)（交集空的推论）
    const a = pickA;
    const b = pickB;
    // 从 e.b 端沿 (a,b)-交替路 chase（首条色 a 的边；cur 推进到对端）
    const path: number[] = [];
    let cur = e.b;
    let want = a;
    for (;;) {
      const next = edgeAt(cur, want);
      if (next === undefined) break;
      path.push(next);
      cur = cur === edges[next]!.a ? edges[next]!.b : edges[next]!.a;
      want = want === a ? b : a;
    }
    // 交替路终点缺 want 色 → 翻转安全（证明见文件头）
    for (const pid of path) {
      const old = colorOf[pid]!;
      setColor(pid, old === a ? b : a);
    }
    setColor(id, a);
  }
  return colorOf;
}

// ----------------------------------------------------------------------------
// First-Fit 构造（一般图；不保证最优，gap 如实）
// ----------------------------------------------------------------------------

function firstFitGroups(spec: LayerSpec): { groups: LayerGroup[]; count: number } {
  // 耦合边按端点度和降序（贪心的常规启发：高度边先进低色组）
  const deg = new Array<number>(spec.nqubits).fill(0);
  for (const [q1, q2] of spec.couplings) {
    deg[q1]!++;
    deg[q2]!++;
  }
  const order = [...spec.couplings]
    .map((e, i) => ({ e, i }))
    .sort((x, y) => deg[y.e[0]]! + deg[y.e[1]]! - (deg[x.e[0]]! + deg[x.e[1]]!) || x.i - y.i);
  const groups: Array<{ couplings: CouplingEdge[]; field: number[]; busy: Set<number> }> = [];
  const fits = (g: { busy: Set<number> }, q1: number, q2: number): boolean =>
    !g.busy.has(q1) && !g.busy.has(q2);
  for (const { e } of order) {
    let g = groups.find((cand) => fits(cand, e[0], e[1]));
    if (!g) {
      g = { couplings: [], field: [], busy: new Set() };
      groups.push(g);
    }
    g.couplings.push(e);
    g.busy.add(e[0]);
    g.busy.add(e[1]);
  }
  // 场项后放置（度 1 项目最灵活）：放首个该比特空闲的组
  for (const v of spec.fieldQubits) {
    let g = groups.find((cand) => !cand.busy.has(v));
    if (!g) {
      g = { couplings: [], field: [], busy: new Set() };
      groups.push(g);
    }
    g.field.push(v);
    g.busy.add(v);
  }
  return {
    groups: groups.map((g) => ({ couplings: g.couplings, fieldQubits: g.field })),
    count: groups.length,
  };
}

// ----------------------------------------------------------------------------
// 不变量验证器（负对照的审判面）
// ----------------------------------------------------------------------------

/**
 * 合法分解判定：每条耦合边恰出现一次、每个场项恰出现一次、组内项目
 * 两两不共享比特、组内非空。任何走私（重复边、丢边、共享比特组）红。
 */
export function verifyMatchingPartition(
  nqubits: number,
  couplings: readonly CouplingEdge[],
  fieldQubits: readonly number[],
  groups: readonly LayerGroup[],
): { valid: boolean; reason: string } {
  const expectedEdges = new Set(couplings.map((e) => `${e[0]},${e[1]}`));
  const seenEdges = new Set<string>();
  const expectedFields = new Set(fieldQubits);
  const seenFields = new Set<number>();
  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi]!;
    const occupied = new Set<number>();
    if (g.couplings.length + g.fieldQubits.length === 0) {
      return { valid: false, reason: `group ${gi} is empty` };
    }
    for (const e of g.couplings) {
      const key = `${e[0]},${e[1]}`;
      if (!expectedEdges.has(key)) {
        return { valid: false, reason: `group ${gi} carries unknown edge (${key})` };
      }
      if (seenEdges.has(key)) {
        return { valid: false, reason: `edge (${key}) appears in more than one group` };
      }
      seenEdges.add(key);
      for (const v of e) {
        if (occupied.has(v)) {
          return {
            valid: false,
            reason: `group ${gi} is not a matching: qubit ${v} shared by two projects`,
          };
        }
        occupied.add(v);
      }
    }
    for (const v of g.fieldQubits) {
      if (!expectedFields.has(v)) {
        return { valid: false, reason: `group ${gi} carries unknown field term on qubit ${v}` };
      }
      if (seenFields.has(v)) {
        return { valid: false, reason: `field term on qubit ${v} appears in more than one group` };
      }
      seenFields.add(v);
      if (occupied.has(v)) {
        return {
          valid: false,
          reason: `group ${gi} shares qubit ${v} between a coupling and a field term`,
        };
      }
      occupied.add(v);
    }
  }
  for (const key of expectedEdges) {
    if (!seenEdges.has(key))
      return { valid: false, reason: `edge (${key}) is missing from every group` };
  }
  for (const v of expectedFields) {
    if (!seenFields.has(v)) return { valid: false, reason: `field term on qubit ${v} is missing` };
  }
  if (groups.length < matchingLowerBound({ nqubits, couplings, fieldQubits })) {
    return { valid: false, reason: 'partition uses fewer groups than the matching lower bound' };
  }
  return { valid: true, reason: 'ok' };
}

// ----------------------------------------------------------------------------
// 主入口
// ----------------------------------------------------------------------------

export interface ParallelizeOptions {
  /**
   * 场项口径：'all'（缺省，与 ft-estimate 的 rotationsPerLayer 同口径——
   * 场 RZ 每 qubit 一个）、'none'、或显式比特子集。
   */
  readonly fieldTerms?: 'all' | 'none' | readonly number[];
  /**
   * 算法：'koenig'（仅二部，达到下界精确）、'first-fit'（任意图）、
   * 'auto'（缺省：二部走 koenig，否则 first-fit）。
   */
  readonly mode?: 'koenig' | 'first-fit' | 'auto';
}

/**
 * Pauli 代价层的匹配分解。二部图恒零缺口（定理 B）；一般图 First-Fit
 * 的缺口如实上报。输出恒经验证器校验（内部自检，返回的必是合法分解）。
 */
export function parallelizeLayer(
  nqubits: number,
  couplings: readonly CouplingEdge[],
  options: ParallelizeOptions = {},
): LayerPartition {
  const spec = parseLayerSpec(nqubits, couplings, options.fieldTerms ?? 'all');
  const mode = options.mode ?? 'auto';
  const bipartite = interactionIsBipartite(spec.nqubits, spec.couplings);
  if (mode === 'koenig' && !bipartite) {
    throw new QuantumEstimateError(
      `parallelizeLayer: mode 'koenig' is exact only on bipartite interaction graphs ` +
        `(the alternating-path proof breaks on odd cycles); this graph is not bipartite — ` +
        "use mode 'auto' or 'first-fit' (gap reported honestly)",
    );
  }
  const lowerBound = matchingLowerBound(spec);
  const useKoenig = mode === 'koenig' || (mode === 'auto' && bipartite);

  let groups: LayerGroup[];
  let algorithm: 'koenig' | 'first-fit';
  if (useKoenig) {
    const edges = flatten(spec);
    const colorOf = koenigColoring(edges, lowerBound);
    // 重组为 LayerGroup（色号 1..K；按色号升序、组内按边 id 序——确定性）
    const byColor = new Map<number, { couplings: CouplingEdge[]; field: number[] }>();
    for (let id = 0; id < edges.length; id++) {
      const c = colorOf[id]!;
      let g = byColor.get(c);
      if (!g) {
        g = { couplings: [], field: [] };
        byColor.set(c, g);
      }
      const e = edges[id]!;
      if (e.coupling === null) g.field.push(e.a);
      else g.couplings.push(e.coupling);
    }
    groups = [...byColor.entries()]
      .sort((x, y) => x[0] - y[0])
      .map(([, g]) => ({ couplings: g.couplings, fieldQubits: g.field }));
    algorithm = 'koenig';
  } else {
    const fit = firstFitGroups(spec);
    groups = fit.groups;
    algorithm = 'first-fit';
  }

  const check = verifyMatchingPartition(spec.nqubits, spec.couplings, spec.fieldQubits, groups);
  if (!check.valid) {
    // 内部不变量破裂＝实现 bug，不是调用方错误——具名炸出便于定罪
    throw new QuantumEstimateError(
      `parallelizeLayer: internal invariant broken (${check.reason}); ` +
        'the constructed partition failed its own verifier',
    );
  }
  return {
    groups,
    groupCount: groups.length,
    lowerBound,
    gap: groups.length - lowerBound,
    bipartite,
    algorithm,
    fieldTermCount: spec.fieldQubits.length,
  };
}

// ----------------------------------------------------------------------------
// FT 画像修正（定理 C：同假设、只改并行度）
// ----------------------------------------------------------------------------

export interface ParallelFtEstimate {
  /** ft-estimate 串行画像（原样直出，对读锚） */
  readonly serial: FtEstimate;
  /** 并行画像（同假设重算轮数/信道/墙钟/工厂数；T 计数与蒸馏项不变） */
  readonly parallel: FtEstimate;
  readonly partition: LayerPartition;
  /** serial.syndromeRoundsTotal / parallel.syndromeRoundsTotal */
  readonly roundsReductionFactor: number;
}

/**
 * 在 estimateFtCircuit 的同一假设集上给出对易性感知的并行画像。
 * 每层操作单位从 (E + 2·nq) 个串行旋转改为 (groups + 1) 个并行组
 * （+1 = 混合层 RX 轮——RX 两两不共享比特恒单组）；T 门数、蒸馏
 * 错误、码块占地逐字节不变。
 */
export function parallelEstimateFtCircuit(
  profile: LogicalCircuitProfile,
  code: FtCodeSpec,
  partition: LayerPartition,
  assumptions: Partial<FtEstimateAssumptions> = {},
): ParallelFtEstimate {
  const serial = estimateFtCircuit(profile, code, assumptions);
  const a: FtEstimateAssumptions = { ...DEFAULT_FT_ASSUMPTIONS, ...assumptions };
  const { logicalQubits, couplings, depth } = profile;
  const nq = logicalQubits;
  if (partition.fieldTermCount !== nq) {
    throw new QuantumEstimateError(
      `parallelEstimateFtCircuit: partition covers ${partition.fieldTermCount} field terms ` +
        `but the serial model counts one RZ per logical qubit (${nq}); use fieldTerms: 'all' ` +
        'for a like-for-like comparison',
    );
  }
  // 每层并行组数（代价层 groups + 混合层 1）
  const parallelRotationsPerLayer = partition.groupCount + 1;
  const serialRotationsPerLayer = couplings + 2 * nq;
  const opsParallel = depth * parallelRotationsPerLayer;
  const syndromeRoundsPerOp = Math.max(1, Math.round(a.roundsPerOpDistanceFactor * code.d));
  const syndromeRoundsTotal = opsParallel * syndromeRoundsPerOp;
  const epsilonChannel = opsParallel * syndromeRoundsPerOp * logicalErrorPerRound(code, a.pPhys);
  const wallTimeUs = syndromeRoundsTotal * a.cycleTimeUs;
  const tRatePerSec =
    wallTimeUs > 0 ? serial.tGatesTotal / (wallTimeUs / 1e6) : Number.POSITIVE_INFINITY;
  const factoryRatePerSec = 1e9 / a.tFactory.nsPerT;
  const factories = Math.max(1, Math.ceil(tRatePerSec / factoryRatePerSec));
  const parallel: FtEstimate = {
    code,
    blocks: serial.blocks,
    physicalQubits: serial.physicalQubits,
    factoryQubits: factories * a.tFactory.physicalQubits,
    totalPhysicalQubits: serial.physicalQubits + factories * a.tFactory.physicalQubits,
    logicalOpsTotal: opsParallel,
    syndromeRoundsTotal,
    wallTimeMs: wallTimeUs / 1000,
    tGatesTotal: serial.tGatesTotal,
    epsilonChannel,
    epsilonDistillation: serial.epsilonDistillation,
    epsilonTotal: epsilonChannel + serial.epsilonDistillation,
    meetsBudget: epsilonChannel + serial.epsilonDistillation <= a.targetCircuitError,
  };
  return {
    serial,
    parallel,
    partition,
    roundsReductionFactor: serialRotationsPerLayer / parallelRotationsPerLayer,
  };
}
