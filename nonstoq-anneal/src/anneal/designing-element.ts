/**
 * 元素级 de-signing 判定器 —— README 开放问题（0.1.x：元素级判定为开放）。
 *
 * 决策问题（在 +κ XX 驱动器族 + ZZ 对角部分上精确定义）：
 * 给定 H = Σ_i g_i·X_i + Σ_i p_i·Z_i + Σ_{(u,v)} (κ_uv·X_uX_v + w_uv·Z_uZ_v)，
 * 是否存在单比特基变换集合 U = ⊗_i U_i（U_i ∈ O(2)，实正交），使共轭后
 * U†HU 在计算基下的**每一个**非对角矩阵元 ≤ 0（stoquastic）？
 * 逐项符号判定（designing.ts 的对角规范）是本问题在 ψ ∈ {0,π} 的子集——
 * 元素级还包含求和抵消：同一翻转行上多项之和可为正，即使每项单独可去。
 *
 * 单比特 O(2) 共轭表（精确，测试中与稠密 Kronecker 共轭互证）：
 *   U_i = R(ψ_i/2)（旋转）或 Z·R((ψ_i−π)/2)（反射）时
 *   X_i → a_i·X_i + b_i·Z_i，  Z_i → d_i·(a_i·Z_i − b_i·X_i)
 *   其中 (a_i, b_i) = (cos ψ_i, sin ψ_i) 自由跑满单位圆，d_i ∈ {±1} 独立。
 * 由此（z_i ∈ {±1} 为构型位）：翻转 i 的矩阵元
 *   A_i(z) = g_i·a_i − d_i·p_i·b_i + Σ_{邻居 o} z_o·(κ_io·a_i·b_o − d_i·d_o·w_io·b_i·a_o)
 * 双翻转 (u,v) 的矩阵元 D_uv = κ·a_u·a_v + d_u·d_v·w·b_u·b_v。
 * 最大非对角元 = max_i max_z A_i(z) 且 max_{(u,v)} D_uv，其中
 * max_z A_i(z) = 基项 + Σ_o |每邻居贡献|（同邻居的多重边先按 (κ,w) 求和
 * ——共享同一个 z_o，逐边取 |·| 会高估；2026-09-08 稠密裁判抓获并修复）——
 * O(n+|E|) 精确。
 *
 * 判定的两侧证书：
 *  - YES 证书：显式角度 + 精确元素检查 ≤ 0（n ≤ 10 另过稠密矩阵裁判）；
 *  - NO 证书：单边对 (u,v) 孤立化松弛（丢弃其余邻边/约束 ⟹ 松弛必弱），
 *    二维角网格 + Lipschitz 界：若格点最小值 − 界余量 > 0，则孤立对
 *    不可行 ⟹ 整图不可行（定理级，不依赖搜索运气）。NO 证书另带独立
 *    重推裁决器 verifyNoGoCertificate（防伪造）。
 * 诚实边界：YES/NO 之间允许 UNRESOLVED（数值分辨率不足，如实报告）。
 * "平凡对角"逃逸（所有非对角元恰为零 = 驱动器被断开）单独标记 vacuous——
 * 它可行与否本身是一个带符号 2-染色问题（Z 场钉住 d·b 符号，ZZ 边要求
 * 反号），可受挫。规范可去只意味着存在使基态非负的基，不改变硬件
 * 测量基中的符号结构（exp1/exp5 的 P 度量仍在计算基定义）。
 *
 * 解析层（0.2.0 新增，docs/theory.md §1.7 有证明）：2 比特均匀横场族
 * H = −Γ(X_u+X_v) + κ·X_uX_v 的封闭二分法——非平凡 de-signing 存在
 * ⟺ κ ≤ Γ；κ > Γ 时唯一可行点全部 vacuous。dichotomyGridCheck 在全网格
 * 上机器复核 NO 侧。
 */
import { Rng } from "../core/rng.js";
import { NonstoqError } from "../core/errors.js";
import { parityFind } from "./designing.js";

export interface ElementField {
  readonly i: number;
  readonly c: number;
}

export interface ElementPair {
  readonly i: number;
  readonly j: number;
  /** XX 系数 κ_uv（>0 即 non-stoquastic）。 */
  readonly kappa: number;
  /** ZZ 系数 w_uv（问题的对角耦合部分，可为 0）。 */
  readonly zz: number;
}

export interface ElementTerms {
  readonly n: number;
  readonly xFields: readonly ElementField[];
  readonly zFields: readonly ElementField[];
  readonly pairs: readonly ElementPair[];
}

export interface LocalRotation {
  /** 每比特圆上点 ψ_i ∈ [0, 2π)。 */
  readonly psi: readonly number[];
  /** 每比特反射符号 d_i ∈ {±1}。 */
  readonly d: readonly number[];
}

export interface ElementViolation {
  readonly kind: "single-flip" | "double-flip";
  readonly site: number | null;
  readonly edge: readonly [number, number] | null;
  /** worst-case z 的邻位符号（单翻转行取到最大值的构型证据）。 */
  readonly zSigns: readonly number[] | null;
  readonly value: number;
  /** 供走私审判使用的可命名描述。 */
  readonly name: string;
}

export interface ElementScan {
  /** 旋转后最大非对角矩阵元（精确公式，≤ 0 即 stoquastic）。 */
  readonly max: number;
  readonly worst: ElementViolation;
}

export interface PairNoGo {
  readonly edge: readonly [number, number];
  /** 孤立对子系统在网格上的最小 max-元素。 */
  readonly gridMin: number;
  /** Lipschitz 界余量（网格间距 × 导数界）。 */
  readonly slack: number;
  /** gridMin − slack > 0 即证明不可行。 */
  readonly margin: number;
  readonly resolution: number;
}

/**
 * 判决 = 可辨识联合（0.3.0 类型硬化）：YES 必带旋转证书、NO 必带 no-go
 * 证书、UNRESOLVED 两者皆空。字段名与旧扁平接口一致（消费方按 verdict
 * 收窄后访问），但"YES 却没证书"这类不变量破坏从运行时约定升级为
 * 编译期不可表示。
 */
export type ElementDecision =
  | {
      readonly verdict: "YES";
      /** 搜索到的最优 max-元素（YES 证书的精确值）。 */
      readonly bestMax: number;
      readonly certificate: LocalRotation;
      /** 证书是否把所有非对角元都转到恰为零（平凡对角/断开驱动器）。 */
      readonly vacuous: boolean;
      readonly noGo: null;
      readonly denseReferee: "pass" | "fail" | "skipped";
      readonly method: string;
    }
  | {
      readonly verdict: "NO";
      /** 搜索到的最优 max-元素（上界——真实最小值 ≥ 它）。 */
      readonly bestMax: number;
      readonly certificate: null;
      readonly vacuous: false;
      readonly noGo: PairNoGo;
      readonly denseReferee: "skipped";
      readonly method: string;
    }
  | {
      readonly verdict: "UNRESOLVED";
      /** 搜索到的最优 max-元素（上界）。 */
      readonly bestMax: number;
      readonly certificate: null;
      readonly vacuous: false;
      readonly noGo: null;
      readonly denseReferee: "skipped";
      readonly method: string;
    };

export interface DecideOptions {
  /** 多起点数（默认随 n 缩放）。 */
  readonly starts?: number;
  readonly seed?: number;
  /** n ≤ denseRefereeMax 时用稠密矩阵独立复核 YES 证书。 */
  readonly denseRefereeMax?: number;
  /** 单边 Lipschitz NO 证书的网格分辨率（每轴格数，默认 720）。 */
  readonly pairGrid?: number;
  readonly pairMaxEdges?: number;
}

// ---------------------------------------------------------------------------
// 精确元素公式
// ---------------------------------------------------------------------------

function cosSin(psi: readonly number[]): { a: number[]; b: number[] } {
  return { a: psi.map(Math.cos), b: psi.map(Math.sin) };
}

function fieldArray(n: number, fields: readonly ElementField[]): number[] {
  const out = new Array<number>(n).fill(0);
  for (const f of fields) out[f.i] = out[f.i]! + f.c;
  return out;
}

/**
 * 多重边归一：同一无序点对 (u,v) 的多条 pair 记录在线性系数 (κ, w) 上
 * 与单条等价（矩阵元对 (κ, w) 线性）；自环 (i=i) 的 XX/ZZ 均为对角元，
 * 对 stoquasticity 判定无贡献，安全丢弃。归一化不改变稠密矩阵的非对角
 * 结构——这是 2026-09-08 修复的要点：旧实现对每条 pair 记录独立取
 * worst-case 邻位符号，多重边共享同一个 z 符号，|t| 逐条求和会高估
 * max 元素（公式 vs 稠密裁判 1e0 级失配，随机化对照当场抓获）。
 */
export function normalizeTerms(terms: ElementTerms): ElementTerms {
  const merged = new Map<number, { i: number; j: number; kappa: number; zz: number }>();
  for (const p of terms.pairs) {
    if (p.i === p.j) continue; // 自环 = 纯对角移位
    const lo = Math.min(p.i, p.j);
    const hi = Math.max(p.i, p.j);
    const key = lo * terms.n + hi;
    const prev = merged.get(key);
    if (prev) {
      prev.kappa += p.kappa;
      prev.zz += p.zz;
    } else {
      merged.set(key, { i: lo, j: hi, kappa: p.kappa, zz: p.zz });
    }
  }
  return { ...terms, pairs: [...merged.values()] };
}

/** worst-case z 显式取每个邻位贡献的符号（同邻位多重边先合并）——max_z A_i(z) 精确。 */
function worstSingleFlip(terms: ElementTerms, rot: LocalRotation, site: number): ElementViolation {
  const { a, b } = cosSin(rot.psi);
  const g = fieldArray(terms.n, terms.xFields);
  const p = fieldArray(terms.n, terms.zFields);
  let value = g[site]! * a[site]! - rot.d[site]! * p[site]! * b[site]!;
  const perNeighbor = new Map<number, number>();
  const order: number[] = [];
  for (const e of terms.pairs) {
    if (e.i !== site && e.j !== site) continue;
    const other = e.i === site ? e.j : e.i;
    const t =
      e.kappa * a[site]! * b[other]! - rot.d[site]! * rot.d[other]! * e.zz * b[site]! * a[other]!;
    const prev = perNeighbor.get(other);
    if (prev === undefined) {
      perNeighbor.set(other, t);
      order.push(other);
    } else {
      perNeighbor.set(other, prev + t);
    }
  }
  const zSigns: number[] = [];
  for (const other of order) {
    const t = perNeighbor.get(other)!;
    value += Math.abs(t);
    zSigns.push(t >= 0 ? 1 : -1);
  }
  return {
    kind: "single-flip",
    site,
    edge: null,
    zSigns,
    value,
    name:
      `single-flip row site ${site}` +
      (zSigns.length > 0 ? ` (neighbor signs [${zSigns.join(",")}])` : ""),
  };
}

function doubleFlipElement(rot: LocalRotation, e: ElementPair): number {
  const { a, b } = cosSin(rot.psi);
  return e.kappa * a[e.i]! * a[e.j]! + rot.d[e.i]! * rot.d[e.j]! * e.zz * b[e.i]! * b[e.j]!;
}

/** 精确扫描：最大非对角元 + 可命名的 worst 违规（供证书验证/走私审判）。 */
export function scanMaxOffDiagonal(terms: ElementTerms, rot: LocalRotation): ElementScan {
  const norm = normalizeTerms(terms);
  let worst: ElementViolation = {
    kind: "single-flip",
    site: null,
    edge: null,
    zSigns: null,
    value: -Infinity,
    name: "empty",
  };
  for (let i = 0; i < norm.n; i++) {
    const v = worstSingleFlip(norm, rot, i);
    if (v.value > worst.value) worst = v;
  }
  for (const e of norm.pairs) {
    const value = doubleFlipElement(rot, e);
    if (value > worst.value) {
      worst = {
        kind: "double-flip",
        site: null,
        edge: [e.i, e.j],
        zSigns: null,
        value,
        name: `double-flip element (${e.i},${e.j})`,
      };
    }
  }
  return { max: worst.value, worst };
}

/**
 * 证书验证：列出所有 > tol 的正元素违规（含命名）。
 * 走私审判入口——伪造证书必须在这里被点名拒绝。
 */
export function listViolations(
  terms: ElementTerms,
  rot: LocalRotation,
  tol = 0,
): ElementViolation[] {
  const norm = normalizeTerms(terms);
  const out: ElementViolation[] = [];
  for (let i = 0; i < norm.n; i++) {
    const v = worstSingleFlip(norm, rot, i);
    if (v.value > tol) out.push(v);
  }
  for (const e of norm.pairs) {
    const value = doubleFlipElement(rot, e);
    if (value > tol) {
      out.push({
        kind: "double-flip",
        site: null,
        edge: [e.i, e.j],
        zSigns: null,
        value,
        name: `double-flip element (${e.i},${e.j})`,
      });
    }
  }
  return out.sort((x, y) => y.value - x.value);
}

/** 证书裁决器：接受/拒绝 + 违规清单（防走私的机器入口）。 */
export interface CertificateVerdict {
  readonly accepted: boolean;
  readonly vacuous: boolean;
  readonly violations: readonly ElementViolation[];
}

/**
 * 裁决一份声称的 de-signing 证书：每个非对角元（含多重边求和后的真值）
 * 必须 ≤ tol。伪造证书在此被点名拒绝（走私审判 #1 的机器落点）。
 */
export function verifyElementCertificate(
  terms: ElementTerms,
  rot: LocalRotation,
  tol = 1e-9,
): CertificateVerdict {
  const violations = listViolations(terms, rot, tol);
  return {
    accepted: violations.length === 0,
    vacuous: violations.length === 0 && isVacuousCertificate(terms, rot, 1e-9),
    violations,
  };
}

/** 平凡对角判定：所有非对角元是否都恰为零（vacuous de-signing）。 */
export function isVacuousCertificate(terms: ElementTerms, rot: LocalRotation, tol = 1e-9): boolean {
  const norm = normalizeTerms(terms);
  for (let i = 0; i < norm.n; i++) {
    // 全部 z 构型下 A_i(z) ≡ 0 ⟺ 基项与每个邻位（合并后）贡献都为零
    const { a, b } = cosSin(rot.psi);
    const g = fieldArray(norm.n, norm.xFields);
    const p = fieldArray(norm.n, norm.zFields);
    if (Math.abs(g[i]! * a[i]! - rot.d[i]! * p[i]! * b[i]!) > tol) return false;
    for (const e of norm.pairs) {
      if (e.i === i || e.j === i) {
        const other = e.i === i ? e.j : e.i;
        const t =
          e.kappa * a[i]! * b[other]! - rot.d[i]! * rot.d[other]! * e.zz * b[i]! * a[other]!;
        if (Math.abs(t) > tol) return false;
      }
    }
  }
  for (const e of norm.pairs) {
    if (Math.abs(doubleFlipElement(rot, e)) > tol) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// 稠密裁判（独立于公式路径：显式共轭 2^n × 2^n 矩阵）
// ---------------------------------------------------------------------------

function siteMatrix(psi: number, d: number): number[][] {
  const c = Math.cos(psi / 2);
  const s = Math.sin(psi / 2);
  return d === 1
    ? [
        [c, -s],
        [s, c],
      ]
    : [
        [s, c],
        [c, -s],
      ]; // Z·R((ψ−π)/2)
}

/**
 * 共轭后的稠密矩阵（n ≤ 10）。与公式路径完全独立：直接张量 U = ⊗U_i 后
 * 做 U†H U。位序约定：比特 0 = 索引低位 = 最后一个张量因子。
 */
export function denseRotatedMatrix(terms: ElementTerms, rot: LocalRotation): number[][] {
  const n = terms.n;
  if (n > 10) throw new NonstoqError("DenseRefereeCap", `dense referee capped at n=10, got ${n}`);
  const dim = 1 << n;
  // 原始 H（稀疏项直接写进稠密表）
  const H = Array.from({ length: dim }, () => new Array<number>(dim).fill(0));
  for (const f of terms.xFields) {
    for (let z = 0; z < dim; z++) H[z]![z ^ (1 << f.i)]! += f.c;
  }
  for (const f of terms.zFields) {
    for (let z = 0; z < dim; z++) H[z]![z]! += f.c * (((z >>> f.i) & 1) === 0 ? 1 : -1);
  }
  for (const e of terms.pairs) {
    for (let z = 0; z < dim; z++) {
      const zi = ((z >>> e.i) & 1) === 0 ? 1 : -1;
      const zj = ((z >>> e.j) & 1) === 0 ? 1 : -1;
      H[z]![z ^ (1 << e.i) ^ (1 << e.j)]! += e.kappa;
      H[z]![z]! += e.zz * zi * zj;
    }
  }
  // U = ⊗ U_i，比特 0 为低位（最后因子）
  let U: number[][] = [[1]];
  for (let i = n - 1; i >= 0; i--) {
    const Ui = siteMatrix(rot.psi[i]!, rot.d[i]!);
    const grown = Array.from({ length: U.length * 2 }, () => new Array<number>(U.length * 2).fill(0));
    for (let a = 0; a < U.length; a++) {
      for (let b = 0; b < U.length; b++) {
        const v = U[a]![b]!;
        if (v === 0) continue;
        for (let c = 0; c < 2; c++) {
          for (let e = 0; e < 2; e++) {
            grown[2 * a + c]![2 * b + e]! += v * Ui[c]![e]!;
          }
        }
      }
    }
    U = grown;
  }
  // U† H U
  const out = Array.from({ length: dim }, () => new Array<number>(dim).fill(0));
  const HU = Array.from({ length: dim }, () => new Array<number>(dim).fill(0));
  for (let a = 0; a < dim; a++) {
    for (let b = 0; b < dim; b++) {
      let acc = 0;
      for (let k = 0; k < dim; k++) acc += H[a]![k]! * U[k]![b]!;
      HU[a]![b] = acc;
    }
  }
  for (let a = 0; a < dim; a++) {
    for (let b = 0; b < dim; b++) {
      let acc = 0;
      for (let k = 0; k < dim; k++) acc += U[k]![a]! * HU[k]![b]!;
      out[a]![b] = acc;
    }
  }
  return out;
}

/** 稠密矩阵最大正非对角元（裁判）。 */
export function denseMaxPositiveOffdiag(H: ReadonlyArray<readonly number[]>): number {
  let m = 0;
  for (let a = 0; a < H.length; a++) {
    for (let b = 0; b < H.length; b++) {
      if (a !== b && H[a]![b]! > m) m = H[a]![b]!;
    }
  }
  return m;
}

/**
 * PF 交叉验证：稠密矩阵基态（幂迭代）的符号比 P = Σψ/Σ|ψ|。
 * stoquastic ⟹ P = 1（Perron-Frobenius）——把判定器与 exp1 的符号度量接通。
 * 迭代必须带 Gershgorin 位移 c > λ_max（v → (cI−H)v）：裸的 v → −Hv
 * 放大的是 |λ| 极端者——谱对称时收敛到最高激发态而非基态（2026-09-08
 * 由"严格负证书的 P 必须 = 1 却量出 0.30"的机器矛盾抓获）。
 */
export function denseGroundStateSignRatio(H: ReadonlyArray<readonly number[]>): number {
  const dim = H.length;
  const rng = new Rng(0xd3519);
  const v = Array.from({ length: dim }, () => rng.range(-1, 1));
  // Gershgorin 上界：c ≥ λ_max(H) 保证 (cI−H) 的主导本征方向 = H 的基态
  let c = -Infinity;
  for (let a = 0; a < dim; a++) {
    let off = 0;
    for (let b = 0; b < dim; b++) if (b !== a) off += Math.abs(H[a]![b]!);
    c = Math.max(c, H[a]![a]! + off);
  }
  c += 1;
  let prev = Infinity;
  for (let step = 0; step < 20000; step++) {
    const nv = new Array<number>(dim).fill(0);
    for (let a = 0; a < dim; a++) {
      let acc = c * v[a]!;
      for (let k = 0; k < dim; k++) acc -= H[a]![k]! * v[k]!;
      nv[a] = acc;
    }
    let norm = 0;
    for (const x of nv) norm += x * x;
    norm = Math.sqrt(norm);
    for (let a = 0; a < dim; a++) nv[a] = nv[a]! / norm;
    // Rayleigh 收敛判定
    let energy = 0;
    for (let a = 0; a < dim; a++) {
      let acc = 0;
      for (let k = 0; k < dim; k++) acc += H[a]![k]! * nv[k]!;
      energy += nv[a]! * acc;
    }
    v.splice(0, dim, ...nv);
    if (Math.abs(energy - prev) < 1e-12 * (1 + Math.abs(energy))) break;
    prev = energy;
  }
  let sum = 0;
  let absSum = 0;
  let big = 0;
  for (const x of v) {
    sum += x;
    absSum += Math.abs(x);
    if (Math.abs(x) > Math.abs(big)) big = x;
  }
  return big < 0 ? -sum / absSum : sum / absSum;
}

// ---------------------------------------------------------------------------
// 搜索：多种子坐标下降（含 d 翻转的离散移动）
// ---------------------------------------------------------------------------

interface Adjacency {
  g: number[];
  p: number[];
  /** 每点的邻接表：{other, kappa, zz}（多重边已按 (κ, w) 求和合并）。 */
  nbrs: Array<Array<{ other: number; kappa: number; zz: number }>>;
}

function adjacency(terms: ElementTerms): Adjacency {
  const norm = normalizeTerms(terms);
  const g = fieldArray(norm.n, norm.xFields);
  const p = fieldArray(norm.n, norm.zFields);
  const nbrs: Array<Array<{ other: number; kappa: number; zz: number }>> = Array.from(
    { length: norm.n },
    () => [],
  );
  for (const e of norm.pairs) {
    nbrs[e.i]!.push({ other: e.j, kappa: e.kappa, zz: e.zz });
    nbrs[e.j]!.push({ other: e.i, kappa: e.kappa, zz: e.zz });
  }
  return { g, p, nbrs };
}

/** 快速路径的 max 元素（与 scanMaxOffDiagonal 一致，避免重复分配）。 */
function fastMax(adj: Adjacency, psi: readonly number[], d: readonly number[]): number {
  const a = psi.map(Math.cos);
  const b = psi.map(Math.sin);
  let worst = -Infinity;
  for (let i = 0; i < adj.g.length; i++) {
    let value = adj.g[i]! * a[i]! - d[i]! * adj.p[i]! * b[i]!;
    for (const e of adj.nbrs[i]!) {
      value += Math.abs(
        e.kappa * a[i]! * b[e.other]! - d[i]! * d[e.other]! * e.zz * b[i]! * a[e.other]!,
      );
    }
    if (value > worst) worst = value;
  }
  for (let u = 0; u < adj.g.length; u++) {
    for (const e of adj.nbrs[u]!) {
      if (e.other < u) continue;
      const value =
        e.kappa * a[u]! * a[e.other]! + d[u]! * d[e.other]! * e.zz * b[u]! * b[e.other]!;
      if (value > worst) worst = value;
    }
  }
  return worst;
}

function sweep(
  adj: Adjacency,
  psi: number[],
  d: number[],
  rng: Rng,
  sweepBudget: number,
): number {
  let f = fastMax(adj, psi, d);
  for (let s = 0; s < sweepBudget; s++) {
    let improved = false;
    const radius = 0.5 * Math.pow(0.95, s);
    for (let i = 0; i < psi.length; i++) {
      const base = psi[i]!;
      const cands = [radius, -radius, radius / 4, -radius / 4];
      for (let q = 0; q < 8; q++) cands.push((2 * Math.PI * q) / 8 + rng.next() * 0.1);
      let moved = false;
      for (const delta of cands) {
        psi[i] = base + delta;
        const nf = fastMax(adj, psi, d);
        if (nf < f - 1e-13) {
          f = nf;
          improved = true;
          moved = true;
          break;
        }
      }
      if (!moved) psi[i] = base;
      // d 翻转（离散移动）
      const od = d[i]!;
      d[i] = -od;
      const nf = fastMax(adj, psi, d);
      if (nf < f - 1e-13) {
        f = nf;
        improved = true;
      } else {
        d[i] = od;
      }
    }
    if (!improved) break;
  }
  return f;
}

/**
 * 平凡对角角落的种子：τ_i = d_i·b_i 的带符号 2-染色。
 * 元素条件退化为：单翻转 −p_i·τ_i ≤ 0（p_i ≠ 0 时钉 τ_i = sign(p_i)），
 * ZZ 边要求 w·τ_u·τ_v ≤ 0（w ≠ 0 时 τ_uτ_v = −sign(w)）。逐支解析符号。
 */
function vacuousSeed(terms: ElementTerms): LocalRotation | null {
  const p = fieldArray(terms.n, terms.zFields);
  const parent = Array.from({ length: terms.n }, (_, i) => i);
  const parity = new Array<number>(terms.n).fill(1);
  const find = (x: number): { root: number; par: number } => parityFind(parent, parity, x);
  for (const e of terms.pairs) {
    if (e.zz === 0) continue;
    const ra = find(e.i);
    const rb = find(e.j);
    const req = -Math.sign(e.zz); // τ_uτ_v = −sign(w)
    if (ra.root === rb.root) {
      if (ra.par * rb.par !== req) return null; // ZZ 边自身受挫
    } else {
      parent[rb.root] = ra.root;
      parity[rb.root] = req * rb.par * ra.par;
    }
  }
  // 逐连通支定符号：Z 场钉住的点必须给出同一支符号
  const compSign = new Map<number, number>();
  for (let i = 0; i < terms.n; i++) {
    if (p[i]! === 0) continue;
    const { root, par } = find(i);
    const needed = Math.sign(p[i]!) * par;
    const prev = compSign.get(root);
    if (prev !== undefined && prev !== needed) return null; // 场与 ZZ 边冲突
    compSign.set(root, needed);
  }
  const psi = new Array<number>(terms.n);
  const d = new Array<number>(terms.n);
  for (let i = 0; i < terms.n; i++) {
    const { root, par } = find(i);
    const tau = (compSign.get(root) ?? 1) * par;
    d[i] = tau;
    psi[i] = Math.PI / 2; // b_i = +1，τ = d·b = d
  }
  return { psi, d };
}

function optimize(terms: ElementTerms, options: DecideOptions): { rot: LocalRotation; f: number } {
  const adj = adjacency(terms);
  const rng = new Rng(options.seed ?? 20260908);
  const starts = options.starts ?? Math.max(24, 3 * terms.n);
  let bestF = Infinity;
  let bestPsi: number[] = [];
  let bestD: number[] = [];
  const tryRot = (psi: number[], d: number[]): void => {
    const f = sweep(adj, psi, d, rng, 120);
    if (f < bestF - 1e-15) {
      bestF = f;
      bestPsi = psi.slice();
      bestD = d.slice();
    }
  };
  // 结构化种子
  tryRot(new Array<number>(terms.n).fill(0), new Array<number>(terms.n).fill(1));
  const vac = vacuousSeed(terms);
  if (vac) tryRot(vac.psi.slice(), vac.d.slice());
  tryRot(new Array<number>(terms.n).fill(Math.PI / 2), new Array<number>(terms.n).fill(-1)); // X 基
  for (let s = 0; s < starts; s++) {
    const psi = Array.from({ length: terms.n }, () => rng.next() * 2 * Math.PI);
    const d = Array.from({ length: terms.n }, () => (rng.next() < 0.5 ? 1 : -1));
    tryRot(psi, d);
  }
  return { rot: { psi: bestPsi, d: bestD }, f: bestF };
}

// ---------------------------------------------------------------------------
// 单边孤立化 Lipschitz NO 证书
// ---------------------------------------------------------------------------

function isolatedPairTerms(terms: ElementTerms, e: ElementPair): ElementTerms {
  const g = fieldArray(terms.n, terms.xFields);
  const p = fieldArray(terms.n, terms.zFields);
  return {
    n: 2,
    xFields: [
      { i: 0, c: g[e.i]! },
      { i: 1, c: g[e.j]! },
    ],
    zFields: [
      { i: 0, c: p[e.i]! },
      { i: 1, c: p[e.j]! },
    ],
    pairs: [{ i: 0, j: 1, kappa: e.kappa, zz: e.zz }],
  };
}

/**
 * 对每条边做孤立对松弛 + 网格 + Lipschitz 下界。孤立子系统是原问题的
 * 松弛（约束子集），故其不可行 ⟹ 原问题不可行（定理级 NO）。
 */
function pairLipschitzNoGo(
  terms: ElementTerms,
  options: DecideOptions = {},
): PairNoGo | null {
  const norm = normalizeTerms(terms);
  const res = options.pairGrid ?? 720;
  const maxEdges = options.pairMaxEdges ?? 64;
  const h = (2 * Math.PI) / res;
  const g = fieldArray(norm.n, norm.xFields);
  const p = fieldArray(norm.n, norm.zFields);
  let edgeCount = 0;
  for (const e of norm.pairs) {
    if (edgeCount >= maxEdges) break;
    edgeCount++;
    const sub = isolatedPairTerms(norm, e);
    const adj = adjacency(sub);
    // Lipschitz 常数：|∂/∂ψ_u| ≤ |g_u| + |p_u| + |κ| + |w|（每项的导数界）
    const Lu = Math.abs(g[e.i]!) + Math.abs(p[e.i]!) + Math.abs(e.kappa) + Math.abs(e.zz);
    const Lv = Math.abs(g[e.j]!) + Math.abs(p[e.j]!) + Math.abs(e.kappa) + Math.abs(e.zz);
    const slack = ((Lu + Lv) * h) / 2;
    let gridMin = Infinity;
    const psi = [0, 0];
    for (const du of [1, -1]) {
      for (const dv of [1, -1]) {
        for (let s1 = 0; s1 < res; s1++) {
          psi[0] = s1 * h;
          for (let s2 = 0; s2 < res; s2++) {
            psi[1] = s2 * h;
            const f = fastMax(adj, psi, [du, dv]);
            if (f < gridMin) gridMin = f;
          }
        }
      }
    }
    const margin = gridMin - slack;
    if (margin > 0) {
      return {
        edge: [e.i, e.j],
        gridMin,
        slack,
        margin,
        resolution: res,
      };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// 决策层
// ---------------------------------------------------------------------------

export interface NoGoVerdict {
  readonly accepted: boolean;
  readonly reason: string;
}

/**
 * NO 证书裁决器：声称的孤立对不可行证书必须能在声明的边上被独立重推
 * （网格最小值 − Lipschitz 余量 > 0）。伪造的 no-go（如在可去实例上
 * 报一个正 margin）在这里被点名拒绝（走私审判的机器落点）。
 */
export function verifyNoGoCertificate(
  terms: ElementTerms,
  noGo: PairNoGo,
): NoGoVerdict {
  const [u, v] = noGo.edge;
  const norm = normalizeTerms(terms);
  const found = norm.pairs.find((e) => e.i === u && e.j === v);
  if (!found) {
    return {
      accepted: false,
      reason: `counterfeit no-go: claimed edge (${u},${v}) does not exist in the (normalized) term list`,
    };
  }
  const sub = isolatedPairTerms(norm, found);
  const adj = adjacency(sub);
  const g = fieldArray(norm.n, norm.xFields);
  const p = fieldArray(norm.n, norm.zFields);
  const res = noGo.resolution;
  const h = (2 * Math.PI) / res;
  const Lu = Math.abs(g[u]!) + Math.abs(p[u]!) + Math.abs(found.kappa) + Math.abs(found.zz);
  const Lv = Math.abs(g[v]!) + Math.abs(p[v]!) + Math.abs(found.kappa) + Math.abs(found.zz);
  const slack = ((Lu + Lv) * h) / 2;
  let gridMin = Infinity;
  const psi = [0, 0];
  for (const du of [1, -1]) {
    for (const dv of [1, -1]) {
      for (let s1 = 0; s1 < res; s1++) {
        psi[0] = s1 * h;
        for (let s2 = 0; s2 < res; s2++) {
          psi[1] = s2 * h;
          const f = fastMax(adj, psi, [du, dv]);
          if (f < gridMin) gridMin = f;
        }
      }
    }
  }
  const margin = gridMin - slack;
  if (margin > 0) {
    return {
      accepted: true,
      reason: `re-derived on edge (${u},${v}): gridMin ${gridMin.toFixed(6)} − slack ${slack.toFixed(6)} = margin ${margin.toFixed(6)} > 0`,
    };
  }
  return {
    accepted: false,
    reason:
      `counterfeit no-go: re-derivation on edge (${u},${v}) gives margin ${margin.toFixed(6)} ≤ 0 ` +
      `(claimed ${noGo.margin.toFixed(6)}) — relaxation is feasible there, infeasibility NOT proved`,
  };
}

/**
 * 定理（2 比特、无 ZZ/无 Z 场、均匀横场的封闭二分法；证明见 docs/theory.md §1.7）：
 * H = −Γ(X_u+X_v) + κ·X_uX_v（κ, Γ > 0）存在非平凡（非 vacuous）单比特
 * 基变换 de-signing ⟺ κ ≤ Γ。κ > Γ 时唯一可行点是把两比特都转到纯对角
 * （a_u = a_v = 0，驱动器被断开的 vacuous 逃逸）。
 */
export function uniformPairDichotomy(gamma: number, kappa: number): {
  readonly nonVacuousDesignable: boolean;
  /** κ ≤ Γ 侧的显式证书：u 留在 X 基、v 转成纯 Z 通道。 */
  readonly certificate: LocalRotation | null;
  readonly detail: string;
} {
  if (gamma <= 0 || kappa <= 0) {
    throw new NonstoqError("DichotomyDomain", `dichotomy stated for gamma, kappa > 0 (got Γ=${gamma}, κ=${kappa})`);
  }
  if (kappa <= gamma) {
    return {
      nonVacuousDesignable: true,
      certificate: { psi: [0, Math.PI / 2], d: [1, 1] },
      detail:
        `κ=${kappa} ≤ Γ=${gamma}: certificate ψ_u=0, ψ_v=π/2 — A_u rows = −Γ+κ·z_v ≤ 0, ` +
        `D = κ·1·0 = 0, all elements ≤ 0 with live single-flip channel (non-vacuous)`,
    };
  }
  return {
    nonVacuousDesignable: false,
    certificate: null,
    detail:
      `κ=${kappa} > Γ=${gamma}: case analysis (docs/theory.md §1.7) — every de-signing has ` +
      `a_u = a_v = 0 (vacuous); no non-trivial one exists`,
  };
}

/**
 * 二分法 NO 侧的机器核查：在 (ψ_u, ψ_v) × d 的全网格上，任何 max 元素 ≤ tol
 * 的点都必须落在 vacuous 角落（|a_u|, |a_v| ≤ vacTol）。网格 + 情形分析
 * 双通道互证（分析证明见 docs/theory.md；这里是可证伪的数值复核）。
 */
export function dichotomyGridCheck(gamma: number, kappa: number, res = 360): {
  readonly holds: boolean;
  readonly worstEscape: number;
} {
  const terms: ElementTerms = {
    n: 2,
    xFields: [
      { i: 0, c: -gamma },
      { i: 1, c: -gamma },
    ],
    zFields: [],
    pairs: [{ i: 0, j: 1, kappa, zz: 0 }],
  };
  const h = (2 * Math.PI) / res;
  let worstEscape = 0;
  for (const du of [1, -1]) {
    for (const dv of [1, -1]) {
      for (let s1 = 0; s1 < res; s1++) {
        const psi = [s1 * h, 0];
        for (let s2 = 0; s2 < res; s2++) {
          psi[1] = s2 * h;
          const d = [du, dv];
          const scan = scanMaxOffDiagonal(terms, { psi, d });
          if (scan.max <= 1e-12) {
            // 可行点：必须 vacuous（两个 a 都贴 0）
            const escape = Math.max(Math.abs(Math.cos(psi[0]!)), Math.abs(Math.cos(psi[1])));
            worstEscape = Math.max(worstEscape, escape);
          }
        }
      }
    }
  }
  return { holds: worstEscape <= 1e-3, worstEscape };
}

export function decideElementDesignable(
  terms: ElementTerms,
  options: DecideOptions = {},
): ElementDecision {
  const norm = normalizeTerms(terms);
  const { rot } = optimize(norm, options);
  const scan = scanMaxOffDiagonal(norm, rot);
  const tol = 1e-9;
  if (scan.max <= tol) {
    // YES：证书经精确公式复核；小 n 再过稠密裁判
    let referee: ElementDecision["denseReferee"] = "skipped";
    const cap = options.denseRefereeMax ?? 10;
    if (norm.n <= cap) {
      const dense = denseMaxPositiveOffdiag(denseRotatedMatrix(norm, rot));
      referee = dense <= 1e-9 ? "pass" : "fail";
    }
    return {
      verdict: "YES",
      bestMax: scan.max,
      certificate: rot,
      vacuous: isVacuousCertificate(norm, rot, 1e-9),
      noGo: null,
      denseReferee: referee,
      method:
        `multi-start coordinate descent (${options.starts ?? Math.max(24, 3 * norm.n)} starts, ` +
        `seed ${options.seed ?? 20260908}); certificate = exact element formulas` +
        (referee === "pass" ? " + dense 2^n referee" : ""),
    };
  }
  const noGo = pairLipschitzNoGo(norm, options);
  if (noGo) {
    const reVerified = verifyNoGoCertificate(norm, noGo);
    if (!reVerified.accepted) {
      throw new NonstoqError("InternalNoGoReverifyFailed", `internal no-go certificate failed re-derivation: ${reVerified.reason}`);
    }
    return {
      verdict: "NO",
      bestMax: scan.max,
      certificate: null,
      vacuous: false,
      noGo,
      denseReferee: "skipped",
      method:
        `isolated-pair relaxation on edge (${noGo.edge.join(",")}): grid ${noGo.resolution}^2 x 4 ` +
        `gauge signs, min = ${noGo.gridMin.toFixed(6)} > Lipschitz slack ${noGo.slack.toFixed(6)} ` +
        `(margin ${noGo.margin.toFixed(6)}) — relaxation infeasible PROVES full infeasibility`,
    };
  }
  return {
    verdict: "UNRESOLVED",
    bestMax: scan.max,
    certificate: null,
    vacuous: false,
    noGo: null,
    denseReferee: "skipped",
    method:
      `optimizer min max-element = ${scan.max.toFixed(6)} > 0 but no pair-relaxation certificate ` +
      `fired — feasibility undecided at this resolution (honest verdict)`,
  };
}
