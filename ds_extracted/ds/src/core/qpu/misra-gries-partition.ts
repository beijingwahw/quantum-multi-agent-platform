/**
 * misra-gries-partition —— 一般图匹配分解的 Δ+1 构造上界（R19 创新，opt-in）
 *
 * ============ 定位 ============
 *
 * commutation-ft.ts 对一般（非二部）交互图用 First-Fit 构造匹配分解，
 * 不保证达到 Δ(G⁺)+1 以内（贪心边着色无此保证，gap 可超 1）。本模块
 * 移植 Misra–Gries 边着色算法：任意简单图构造性使用 ≤ Δ+1 色
 * （Vizing 上界的构造面）。在匹配分解语言里：
 *
 *   任意 Pauli 层（耦合边 + 场项悬边）存在组数 ≤ Δ(G⁺)+1 的合法分解，
 *   本模块构造性地给出它——gap 恒 ∈ {0, 1}（First-Fit 无此界）。
 *
 * 算法（按参考实现逐句端口，见文献接地）：
 *   对每条未着色边 (x, f)：
 *   1. fan：F = [v0=f, v1, …, vk]，对 i ≥ 1 有 color(x, v_i) 在 v_{i−1}
 *      上空闲（fan 性质）；从 f 起贪心扩到极大（每次追加后从头重扫，
 *      扫描序确定）；
 *   2. c := x 上最小空闲色；d := v_k 上最小空闲色；
 *   3. 反转含 x 的 (c,d)-链（Kempe 链）：自 x 的 d 色边起步（c 在 x
 *      空闲 ⇒ x 是链端点），逐边 c↔d 互换——反转保持着色合法性
 *      （链内部每顶点恰一条 c 一条 d，端点失去的颜色恰为其空闲色）；
 *   4. 链长 0（x 无 d 色边）→ w := v_k；否则 w := fan 中**首个** d 空闲
 *      顶点 v_j（存在性是 MG 定理的一部分）；
 *   5. 旋转前缀 [v0..v_j]：color(x, v_i) := color(x, v_{i+1})，末边
 *      (x, w) 着 d。旋转合法性：新 color(x, v_i) 恰为 fan 性质保证在
 *      v_i 空闲的色；(x, w) 着 d 需要 d 在 x 与 w 两端空闲——步骤 3/4
 *      的构造点。
 *
 * ============ 精确主张（可证伪） ============
 *
 * 定理 V（Vizing 构造面 / Misra–Gries）：输出恒为合法分解（组内两两
 * 不共享比特、全覆盖、验证器绿）且 groupCount ≤ Δ(G⁺)+1，即
 *   gap = groupCount − lowerBound ∈ {0, 1}。
 * 二部图上 χ′ = Δ（Kőnig），此时 gap=0 可达——本算法不保证取到
 * （它只有 Δ+1 承诺），Kőnig 精确路径仍在 commutation-ft。
 *
 * ============ 诚实的边界 ============
 *
 * - **正确性证明不在此重造**：fan 旋转与 Kempe 反转交互的完整证明见
 *   Misra–Gries 1992 原文与 Bhoja 2025 的 Lean 4 形式化验证（本端口
 *   按其参考实现逐句对照）。本模块的证据面是机器 referee：随机图
 *   ×300 全部验证器绿且 gap ≤ 1、确定性双跑 deepEqual、下界不可达性
 *   由 r18b 的全指派枚举钉死。
 * - 输出**不保证**最优（χ′ ∈ {Δ, Δ+1} 的判定是 Holyer-1981 NP-难面
 *   的三次图特例家族——一般图上「Δ 是否够用」不试图回答）；gap=1
 *   的输出如实上报，可能是真需求（χ′=Δ+1）也可能是构造冗余。
 * - **FT 接缝本波未扩**：parallelEstimateFtCircuit 消费的
 *   LayerPartition.algorithm 字面量类型是 'koenig' | 'first-fit'（属主
 *   文件本波只读冻结）；本模块返回自有类型 MisraGriesPartition（字段
 *   同形 + algorithm: 'misra-gries'）。收口批把该联合类型扩一个字面量
 *   即可直喂——FT 数值路径零变化（groupCount/fieldTermCount 是它消费
 *   的全部）。
 * - 输入域校验与 commutation-ft.parseLayerSpec 同款同消息（该解析器
 *   模块私有、属主文件冻结，此处镜像实现——两处消息将并行存活到
 *   收口批裁决）。
 * - 复杂度：O(E·Δ) fan 扫描 + O(V) 链反转每边，总计 O(E·(E+V)) 量级
 *   （估算器规模 E ≤ 数百，无压力）。无 RNG、无 IO、导入零副作用；
 *   分组按色号升序、组内按边序，输出确定。
 *
 * ============ 文献接地（形状级，〔待双源〕） ============
 *
 * - Misra & Gries 1992「A constructive proof of Vizing's theorem」
 *   〔待双源〕
 * - Vizing 1964/1965 边着色上下界 χ′ ∈ {Δ, Δ+1}〔待双源〕
 * - Bhoja 2025「A verified implementation of the Misra and Gries edge
 *   coloring algorithm」（Lean 4 形式化）〔待双源〕
 * - Holyer 1981（三次图 3-边可着色性 NP-完全——最优性判定的不可达面）
 *   〔待双源〕
 * - 参考实现：alifarazz/Misra-Gries-coloring（Python，逐句端口对照）
 *   〔已核对源码〕
 */

import {
  matchingLowerBound,
  interactionIsBipartite,
  verifyMatchingPartition,
} from './commutation-ft.js';
import type { CouplingEdge, LayerGroup } from './commutation-ft.js';
import { QuantumEstimateError } from '../../utils/errors.js';

/** 分解结果（与 LayerPartition 字段同形；algorithm 字面量诚实自立） */
export interface MisraGriesPartition {
  readonly groups: readonly LayerGroup[];
  readonly groupCount: number;
  /** 定理 A 下界 Δ(G⁺)（与 commutation-ft 同一函数出数） */
  readonly lowerBound: number;
  /** groupCount − lowerBound；**恒 ∈ {0, 1}**（定理 V 构造面） */
  readonly gap: number;
  readonly bipartite: boolean;
  readonly algorithm: 'misra-gries';
  readonly fieldTermCount: number;
  /** Vizing 上界 Δ(G⁺)+1；groupCount ≤ 此值恒成立 */
  readonly vizingUpperBound: number;
}

// ----------------------------------------------------------------------------
// 输入域校验（commutation-ft.parseLayerSpec 的镜像——属主文件本波冻结）
// ----------------------------------------------------------------------------

interface LayerSpec {
  readonly nqubits: number;
  readonly couplings: readonly CouplingEdge[];
  readonly fieldQubits: readonly number[];
}

function parseLayerSpec(
  nqubits: number,
  couplings: readonly CouplingEdge[],
  fieldTerms: 'all' | 'none' | readonly number[],
): LayerSpec {
  if (!Number.isInteger(nqubits) || nqubits < 1) {
    throw new QuantumEstimateError(
      `misraGriesLayerPartition: nqubits must be a positive integer, got ${String(nqubits)}`,
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
        `misraGriesLayerPartition: couplings[${i}] must be [q1, q2] with 0 <= q1 < q2 < ${nqubits}, got ${String(e)}`,
      );
    }
    if (q1 > q2) {
      throw new QuantumEstimateError(
        `misraGriesLayerPartition: couplings[${i}] must be normalized (q1 < q2), got ${String(e)}`,
      );
    }
    const key = `${q1},${q2}`;
    if (seen.has(key)) {
      throw new QuantumEstimateError(
        `misraGriesLayerPartition: duplicate coupling edge (${key}); the matching-decomposition model is stated over simple graphs`,
      );
    }
    seen.add(key);
  }
  if (fieldTerms === 'all') {
    return { nqubits, couplings, fieldQubits: Array.from({ length: nqubits }, (_, q) => q) };
  }
  if (fieldTerms === 'none') {
    return { nqubits, couplings, fieldQubits: [] };
  }
  const fieldSet = new Set<number>();
  for (const q of fieldTerms) {
    if (!Number.isInteger(q) || q < 0 || q >= nqubits) {
      throw new QuantumEstimateError(
        `misraGriesLayerPartition: fieldTerms entries must be integers in [0, ${nqubits}), got ${String(q)}`,
      );
    }
    if (fieldSet.has(q)) {
      throw new QuantumEstimateError(
        `misraGriesLayerPartition: duplicate field term on qubit ${String(q)}`,
      );
    }
    fieldSet.add(q);
  }
  return { nqubits, couplings, fieldQubits: [...fieldTerms] };
}

// ----------------------------------------------------------------------------
// 平坦边集（与 commutation-ft.flatten 同构：场项作悬边 v—(v+nq)）
// ----------------------------------------------------------------------------

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

// ----------------------------------------------------------------------------
// Misra–Gries 着色内核
// ----------------------------------------------------------------------------

class MisraGriesColoring {
  private readonly colorOf: number[]; // 0 = 未着色；色号 1..（定理保证 ≤ Δ+1）
  private readonly adj: number[][]; // 顶点 → 关联边 id 序（插入序，确定性）
  private readonly edges: readonly FlatEdge[];

  constructor(edges: readonly FlatEdge[], vertexCount: number) {
    this.edges = edges;
    this.colorOf = new Array<number>(edges.length).fill(0);
    this.adj = Array.from({ length: vertexCount }, () => []);
    for (let id = 0; id < edges.length; id++) {
      this.adj[edges[id]!.a]!.push(id);
      this.adj[edges[id]!.b]!.push(id);
    }
  }

  private otherEnd(id: number, v: number): number {
    const e = this.edges[id]!;
    return e.a === v ? e.b : e.a;
  }

  private isFree(color: number, v: number): boolean {
    for (const id of this.adj[v]!) {
      if (this.colorOf[id] === color) return false;
    }
    return true;
  }

  /** 最小空闲色（定理 V 保证在 1..Δ+1 内取到） */
  private smallestFreeColor(v: number): number {
    let c = 1;
    while (!this.isFree(c, v)) c++;
    return c;
  }

  /**
   * 极大 fan：F=[v0=f,…]，i ≥ 1 时 color(x, v_i) 在 v_{i−1} 空闲。
   * 每次追加后从头重扫（参考实现语义——扫描序即确定性来源）。
   * 返回 fan 顶点序列与对应边 id（fanEdgeIds[0] = 目标未着色边）。
   */
  private maximalFan(
    x: number,
    f: number,
    targetId: number,
  ): { fan: number[]; fanEdgeIds: number[] } {
    const fan = [f];
    const fanEdgeIds = [targetId];
    const inFan = new Set([f]);
    let extended = true;
    while (extended) {
      extended = false;
      for (const id of this.adj[x]!) {
        const v = this.otherEnd(id, x);
        if (inFan.has(v)) continue;
        const color = this.colorOf[id]!;
        if (color === 0) continue; // 仅着色边可入 fan（其色要被下一步借用）
        if (!this.isFree(color, fan[fan.length - 1]!)) continue;
        fan.push(v);
        fanEdgeIds.push(id);
        inFan.add(v);
        extended = true;
        break; // 追加后从头重扫
      }
    }
    return { fan, fanEdgeIds };
  }

  /**
   * 反转含 start 的 (c,d)-链：自 start 的 d 色边起步逐步互换 c↔d。
   * c 在 start 空闲 ⇒ start 是链端点；seen 守卫防绕行（合法着色下
   * {c,d}-子图每顶点至多各一条，链本为简单路——守卫是深度防御）。
   * 返回反转边数（0 = start 无 d 色边，链平凡）。
   */
  private invertCdPath(start: number, c: number, d: number): number {
    let u = start;
    let cc = c;
    let dd = d;
    const seen = new Set<number>([start]);
    let inverted = 0;
    for (;;) {
      let moved = false;
      for (const id of this.adj[u]!) {
        const v = this.otherEnd(id, u);
        if (this.colorOf[id] === dd && !seen.has(v)) {
          this.colorOf[id] = cc; // 互换：d 色 → c
          seen.add(v);
          inverted++;
          u = v;
          const swap = cc;
          cc = dd;
          dd = swap;
          moved = true;
          break;
        }
      }
      if (!moved) return inverted;
    }
  }

  /** 主循环：按平坦边序逐边着色（每条到达时未着色） */
  run(): number[] {
    for (let id = 0; id < this.edges.length; id++) {
      const e = this.edges[id]!;
      const x = e.a; // 中心（耦合边取归一化小端，悬边取真实比特端）
      const f = e.b;
      const { fan, fanEdgeIds } = this.maximalFan(x, f, id);
      const c = this.smallestFreeColor(x);
      const d = this.smallestFreeColor(fan[fan.length - 1]!);
      const pathLen = this.invertCdPath(x, c, d);
      let wIdx: number;
      if (pathLen === 0) {
        wIdx = fan.length - 1; // d 本就空闲于链端（fan 末元），直接收尾
      } else {
        wIdx = fan.findIndex((v) => this.isFree(d, v));
        if (wIdx < 0) {
          // MG 定理保证存在（fan 前缀端点 d 空闲）；不可达＝实现 bug
          throw new QuantumEstimateError(
            'misraGriesLayerPartition: internal invariant broken (no fan vertex with color d free after inversion); ' +
              'this is an implementation bug, not a caller error',
          );
        }
      }
      // 旋转前缀 [v0..v_w]：色沿 fan 下移一格，末边收 d
      for (let i = 0; i < wIdx; i++) {
        this.colorOf[fanEdgeIds[i]!] = this.colorOf[fanEdgeIds[i + 1]!]!;
      }
      this.colorOf[fanEdgeIds[wIdx]!] = d;
    }
    return this.colorOf;
  }
}

// ----------------------------------------------------------------------------
// 主入口
// ----------------------------------------------------------------------------

export interface MisraGriesOptions {
  /**
   * 场项口径：'all'（缺省，与 ft-estimate/commutation-ft 同口径）、
   * 'none'、或显式比特子集。
   */
  readonly fieldTerms?: 'all' | 'none' | readonly number[];
}

/**
 * 一般图匹配分解的 Misra–Gries 构造：组数 ≤ Δ(G⁺)+1 恒成立
 * （定理 V；gap ∈ {0,1}）。输出恒经验证器校验（内部自检——返回的
 * 必是合法分解，走私即具名炸出）。
 */
export function misraGriesLayerPartition(
  nqubits: number,
  couplings: readonly CouplingEdge[],
  options: MisraGriesOptions = {},
): MisraGriesPartition {
  const spec = parseLayerSpec(nqubits, couplings, options.fieldTerms ?? 'all');
  const edges = flatten(spec);
  // 悬边虚拟顶点 v+nq 逐一互异且不与真实顶点重叠——平坦图仍是简单图
  const vertexCount = 2 * spec.nqubits;
  const colorOf = new MisraGriesColoring(edges, vertexCount).run();

  // 重组为 LayerGroup（按色号升序、组内按边 id 序——与 Kőnig 路径同款确定性）
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
  const groups: LayerGroup[] = [...byColor.entries()]
    .sort((x, y) => x[0] - y[0])
    .map(([, g]) => ({ couplings: g.couplings, fieldQubits: g.field }));

  const check = verifyMatchingPartition(spec.nqubits, spec.couplings, spec.fieldQubits, groups);
  if (!check.valid) {
    // 内部不变量破裂＝实现 bug，不是调用方错误——具名炸出便于定罪
    throw new QuantumEstimateError(
      `misraGriesLayerPartition: internal invariant broken (${check.reason}); ` +
        'the constructed partition failed its own verifier',
    );
  }
  const lowerBound = matchingLowerBound(spec);
  return {
    groups,
    groupCount: groups.length,
    lowerBound,
    gap: groups.length - lowerBound,
    bipartite: interactionIsBipartite(spec.nqubits, spec.couplings),
    algorithm: 'misra-gries',
    fieldTermCount: spec.fieldQubits.length,
    vizingUpperBound: lowerBound + 1,
  };
}
