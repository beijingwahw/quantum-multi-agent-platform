import { StateVector } from "../core/statevector.js";
import { lowestSpectrum } from "./lanczos.js";

/**
 * 催化剂试验台 —— Nishimori-Takada / Seki-Nishimori 型反铁磁涨落催化剂
 * 的精确可验证实现（Nishimori & Takada, Frontiers in ICT 4, 2 (2017)；
 * Hormozi et al., PRB 95, 184416 (2017)）。
 *
 * 哈密顿量（与原文同一归一化，最大化约定 H_P := −C）：
 *   H(s,λ) = s(1−λ)·N·m_x² − s·N·m_z^p − (1−s)·N·m_x
 *   —— +N·m_x²（反铁磁 XX，正的非对角矩阵元 → 非 stoquastic）
 * 两参数路径：s: 0→1 保持 λ=λ0，再于 s=1 抬 λ: λ0→1。
 *
 * 诚实边界：原文的指数增强声称属 p≥4 的渐近区；本试验台在精确可及的
 * n≤12 上给出的是可证伪的实测（见 exp4：谱学方向性趋势 + 操作度负结果）。
 */

/** p-spin 全连通铁磁体能量表：C = N·m_z^p（p 奇 → 唯一最优全 +1）。 */
export function pspinEnergies(n: number, p: number): Float64Array {
  if (!Number.isInteger(p) || p < 2) throw new Error(`p-spin needs integer p >= 2, got ${p}`);
  const dim = 1 << n;
  const E = new Float64Array(dim);
  for (let z = 0; z < dim; z++) {
    E[z] = n * Math.pow(magnetization(n, z) / n, p);
  }
  return E;
}

function magnetization(n: number, z: number): number {
  let m = 0;
  for (let i = 0; i < n; i++) m += ((z >>> i) & 1) === 0 ? 1 : -1;
  return m;
}

/** X 基磁化表 Σ_i x_i。 */
export function magTable(n: number): Float64Array {
  const dim = 1 << n;
  const t = new Float64Array(dim);
  for (let z = 0; z < dim; z++) t[z] = magnetization(n, z);
  return t;
}

/** N·m_x² 表 = (2/n)·Σ_{i<j} x_i x_j + 1（常数项保留，忠实原文）。 */
export function xxScaled(n: number): Float64Array {
  const dim = 1 << n;
  const t = new Float64Array(dim);
  for (let z = 0; z < dim; z++) {
    const m = magnetization(n, z);
    t[z] = (2 / n) * ((m * m - n) / 2) + 1;
  }
  return t;
}

/** H(s,λ) 驱动部分的 X 基本征值表：−(1−s)·Γ·mag + s(1−λ)·N·m_x²。 */
export function xEnergiesAt(
  mag: Float64Array,
  xx: Float64Array,
  s: number,
  lambda: number,
  gamma = 1,
): Float64Array {
  const t = new Float64Array(mag.length);
  for (let i = 0; i < t.length; i++) {
    t[i] = -(1 - s) * gamma * mag[i]! + s * (1 - lambda) * xx[i]!;
  }
  return t;
}

export interface GapPoint {
  readonly gap: number;
  readonly sStar: number;
}

/** 固定 λ 下沿 s 的最小 gap：粗扫 + 三候选邻域黄金分割细化（一级避免
 *  交叉的谷宽 ~ gap 本身，粗网格必然错过谷底，必须局部细化）。 */
export function minGapFixedLambda(
  n: number,
  energies: Float64Array,
  mag: Float64Array,
  xx: Float64Array,
  lambda: number,
  options: { coarse?: number; refine?: number; k?: number } = {},
): GapPoint {
  const coarseN = options.coarse ?? 40;
  const refineIters = options.refine ?? 36;
  const k = options.k ?? 40;
  const gapAt = (s: number): number =>
    lowestSpectrum(n, energies, xEnergiesAt(mag, xx, s, lambda), s, { k }).gap;

  const coarse: Array<{ s: number; gap: number }> = [];
  for (let i = 1; i <= coarseN; i++) {
    const s = i / (coarseN + 1);
    coarse.push({ s, gap: gapAt(s) });
  }
  coarse.sort((a, b) => a.gap - b.gap);
  let best: { s: number; gap: number } = coarse[0]!;

  for (const c of coarse.slice(0, 3)) {
    const lo = Math.max(1e-4, c.s - 1 / (coarseN + 1));
    const hi = Math.min(1 - 1e-4, c.s + 1 / (coarseN + 1));
    const phi = (Math.sqrt(5) - 1) / 2;
    let a = lo;
    let b = hi;
    let c1 = b - phi * (b - a);
    let c2 = a + phi * (b - a);
    let f1 = gapAt(c1);
    let f2 = gapAt(c2);
    for (let it = 0; it < refineIters; it++) {
      if (f1 < f2) {
        b = c2;
        c2 = c1;
        f2 = f1;
        c1 = b - phi * (b - a);
        f1 = gapAt(c1);
      } else {
        a = c1;
        c1 = c2;
        f1 = f2;
        c2 = a + phi * (b - a);
        f2 = gapAt(c2);
      }
    }
    const sMid = (a + b) / 2;
    const g = gapAt(sMid);
    if (g < best.gap) best = { s: sMid, gap: g };
  }
  return { gap: best.gap, sStar: best.s };
}

/** 两参数路径退火：u∈[0,1]，s 于 u=s₁ 处达 1，随后 λ: λ0→1。返回落点
 *  在唯一最优（全 +1，索引 0）的概率。λ0=1 时退化为纯化学计量退火。 */
export function annealCatalystPath(
  n: number,
  energies: Float64Array,
  mag: Float64Array,
  xx: Float64Array,
  options: {
    readonly lambda0: number;
    readonly s1?: number;
    readonly time: number;
    readonly slices?: number;
  },
): number {
  const s1 = options.s1 ?? 0.5;
  const slices = options.slices ?? 400;
  const dt = options.time / slices;
  const state = StateVector.plusState(n);
  const xE = new Float64Array(1 << n);
  for (let m = 1; m <= slices; m++) {
    const u = m / slices;
    const s = Math.min(1, u / s1);
    const lambda =
      options.lambda0 + (1 - options.lambda0) * Math.min(1, Math.max(0, (u - s1) / Math.max(1e-9, 1 - s1)));
    state.applyPhase(-dt * s, energies);
    const table = xEnergiesAt(mag, xx, s, lambda);
    xE.set(table);
    state.applyHadamardAll();
    state.applyPhase(dt, xE);
    state.applyHadamardAll();
  }
  return state.probabilities()[0]!;
}
