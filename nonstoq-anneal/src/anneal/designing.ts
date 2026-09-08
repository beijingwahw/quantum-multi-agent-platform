/**
 * de-signing 判定器（修正版）—— 对角规范 D = Π σz_i^{(1−ε_i)/2} 下
 * 非 stoquastic 性的可去性。变换表（σz σx σz = −σx 的直接推论）：
 *   D† X_i  D = ε_i·X_i          —— 单点约束，恒可满足
 *   D† X_iX_j D = ε_iε_j·X_iX_j  —— 双点约束 ε_iε_j = −sign(κ_ij)
 *   D† Z_iX_j D = ε_iε_j·Z_iX_j  —— 同型双点约束
 * 全部非对角元 ≤ 0 ⟺ 约束图（XX+ZX 边按所需相对符号）无受挫环——
 * 即带符号 2 染色可解（并查集判定）。
 *
 * 定理级含义：κ>0 的 XX 符号壁垒在**含 κ-奇环的图**上规范不可约
 * （exp1/exp3 的随机稀疏图、奇 AF 环都属此类）；开链/树状 κ 图可去——
 * 但可去只意味着“存在使基态非负的基”，计算基（硬件测量基）中的
 * 符号结构依旧存在（exp5 的 κ=1.0 链实测负分量 46-52% 正是此意）。
 * 更一般的酉 de-signing（Crosson-Deng 类）是开放问题。
 */

export interface GeneralDriverTerms {
  readonly xFields: ReadonlyArray<{ i: number; c: number }>;
  readonly xxPairs: ReadonlyArray<{ i: number; j: number; k: number }>;
  readonly zxPairs: ReadonlyArray<{ i: number; j: number; z: number }>;
}

export interface DeSigningReport {
  readonly designable: boolean;
  /** 受挫环证据（不可去时给出一条）。 */
  readonly frustratedCycle: number[] | null;
  /** 可去时的显式规范证书 ε。 */
  readonly certificate: number[] | null;
  readonly constraintEdges: number;
  readonly detail: string;
}

/**
 * 带权并查集 find（路径压缩，根的 par = 1）——对角规范判定器与元素级
 * 判定器的 vacuous 种子共用的单一来源（0.3.0 单源化：此前三份拷贝，
 * designing.ts 两份 + designing-element.ts 一份）。
 */
export function parityFind(parent: number[], parity: number[], x: number): { root: number; par: number } {
  if (parent[x]! === x) return { root: x, par: 1 };
  const r = parityFind(parent, parity, parent[x]!);
  parent[x] = r.root;
  parity[x] = parity[x]! * r.par;
  return { root: r.root, par: parity[x] };
}

/** 带符号约束图的 2 染色（并查集带权）：返回 ε 或受挫环。 */
function twoColor(
  n: number,
  edges: ReadonlyArray<{ a: number; b: number; req: number }>,
): { epsilon: number[] | null; frustratedCycle: number[] | null; parent: number[]; parity: number[] } {
  const parent = Array.from({ length: n }, (_, i) => i);
  const parity = new Array<number>(n).fill(1); // 相对根的奇偶
  const find = (x: number): { root: number; par: number } => parityFind(parent, parity, x);
  for (const e of edges) {
    const ra = find(e.a);
    const rb = find(e.b);
    if (ra.root === rb.root) {
      if (ra.par * rb.par !== e.req) {
        // 受挫：沿两侧回溯构造环（收集路径上的顶点）
        const cycle: number[] = [];
        let x = e.a;
        while (parent[x]! !== x) {
          cycle.push(x);
          x = parent[x]!;
        }
        x = e.b;
        while (parent[x]! !== x) {
          cycle.push(x);
          x = parent[x]!;
        }
        cycle.push(ra.root);
        return { epsilon: null, frustratedCycle: cycle, parent, parity };
      }
    } else {
      parent[rb.root] = ra.root;
      parity[rb.root] = e.req * rb.par * ra.par;
    }
  }
  const epsilon = new Array<number>(n).fill(1);
  for (let i = 0; i < n; i++) {
    const r = find(i);
    epsilon[i] = r.par;
  }
  return { epsilon, frustratedCycle: null, parent, parity };
}


export function classifyDiagonalGaugeDesignable(terms: GeneralDriverTerms, n: number): DeSigningReport {
  const edges: Array<{ a: number; b: number; req: number }> = [];
  for (const p of terms.xxPairs) if (p.k !== 0) edges.push({ a: p.i, b: p.j, req: -Math.sign(p.k) });
  for (const p of terms.zxPairs) if (p.z !== 0) edges.push({ a: p.i, b: p.j, req: -Math.sign(p.z) });
  // X_i 单点项：ε_i = −sign(c_i) 恒可满足，不进约束图（先记录，染色后合并）
  const xConstraint = new Map<number, number>();
  for (const f of terms.xFields) if (f.c !== 0) xConstraint.set(f.i, -Math.sign(f.c));

  const { epsilon, frustratedCycle, parent, parity } = twoColor(n, edges);
  if (!epsilon) {
    return {
      designable: false,
      frustratedCycle,
      certificate: null,
      constraintEdges: edges.length,
      detail:
        `NOT designable: frustrated cycle [${(frustratedCycle ?? []).join(" → ")}] in the ` +
        `XX/ZX sign-constraint graph — gauge irreducible in the computational basis`,
    };
  }
  // X 单点约束按连通分支整体定符号：分支内 ε_i = 支符号·parity_i，
  // 所有 X 约束必须给出同一支符号（同支异号 X → 不可去）
  const compSign = new Map<number, number>();
  for (const [site, req] of xConstraint) {
    const { root, par } = parityFind(parent, parity, site);
    const needed = req * par; // 支符号须等于 req·parity_i
    const prev = compSign.get(root);
    if (prev !== undefined && prev !== needed) {
      return {
        designable: false,
        frustratedCycle: [site],
        certificate: null,
        constraintEdges: edges.length,
        detail: `NOT designable: X-field sign conflict within one connected component (site ${site})`,
      };
    }
    compSign.set(root, needed);
  }
  for (let i = 0; i < n; i++) {
    const { root, par } = parityFind(parent, parity, i);
    const sign = compSign.get(root) ?? 1;
    epsilon[i] = sign * par;
  }
  return {
    designable: true,
    frustratedCycle: null,
    certificate: epsilon,
    constraintEdges: edges.length,
    detail: `designable under diagonal gauge: epsilon = [${epsilon.join(", ")}]`,
  };
}

/** 用证书 ε 显式执行规范变换（稠密矩阵裁判用）。 */
export function applyGauge(terms: GeneralDriverTerms, epsilon: readonly number[]): GeneralDriverTerms {
  return {
    xFields: terms.xFields.map((f) => ({ i: f.i, c: f.c * epsilon[f.i]! })),
    xxPairs: terms.xxPairs.map((p) => ({ i: p.i, j: p.j, k: p.k * epsilon[p.i]! * epsilon[p.j]! })),
    zxPairs: terms.zxPairs.map((p) => ({ i: p.i, j: p.j, z: p.z * epsilon[p.i]! * epsilon[p.j]! })),
  };
}
