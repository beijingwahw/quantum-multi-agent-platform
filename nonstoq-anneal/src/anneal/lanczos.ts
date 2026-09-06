import { Rng } from "../core/rng.js";

/**
 * 矩阵无关 Lanczos 谱仪 —— H(s) = −s·C + (1−s)·H_D 的低端谱与 gap。
 *
 * H·v 乘积复用双基机制：Z 基对角（−s·C）逐点乘，X 基对角（(1−s)·H_D，
 * 本征值表 xEnergies）经两次 Walsh-Hadamard 施加。实对称算子，实向量，
 * 每次乘积 O(n·dim)。Lanczos 带全重正交（k ≤ 96，防正交性流失），
 * 三对角 T 的特征值由小型稠密 Jacobi 求解。
 */

export interface SpectrumResult {
  /** 最低两个本征值 λ0 ≤ λ1（Trotter 无关——这是算子本身的谱）。 */
  readonly lambda0: number;
  readonly lambda1: number;
  readonly gap: number;
  readonly iterations: number;
}

/** H(s)·v：Z 基对角（−s·C）+ X 基对角（(1−s)·H_D，经两次 WH）。 */
export function applyHamiltonian(
  n: number,
  energies: Float64Array,
  xEnergies: Float64Array,
  s: number,
  v: Float64Array,
  out: Float64Array,
): Float64Array {
  const dim = 1 << n;
  for (let i = 0; i < dim; i++) {
    out[i] = -s * energies[i]! * v[i]!;
  }
  const tmp = v.slice();
  hadamardInPlace(tmp, n);
  for (let i = 0; i < dim; i++) {
    tmp[i] = (1 - s) * xEnergies[i]! * tmp[i]!;
  }
  hadamardInPlace(tmp, n);
  for (let i = 0; i < dim; i++) {
    out[i] = out[i]! + tmp[i]!;
  }
  return out;
}

/**
 * Walsh-Hadamard 原位变换（除以 √2 归一）——applyHamiltonian 与测试共用。
 */
export function hadamardInPlace(v: Float64Array, n: number): void {
  const dim = 1 << n;
  for (let j = 0; j < n; j++) {
    const stride = 1 << j;
    for (let a = 0; a < dim; a++) {
      if (a & stride) continue;
      const b = a | stride;
      const x = v[a]!;
      const y = v[b]!;
      v[a] = (x + y) / Math.SQRT2;
      v[b] = (x - y) / Math.SQRT2;
    }
  }
}

/** 稠密对称矩阵 Jacobi 特征值（k×k，k ≤ ~100；测试裁判与 T 矩阵共用）。 */
export function jacobiEigenvalues(matrix: number[][]): number[] {
  const k = matrix.length;
  const a = matrix.map((row) => [...row]);
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0;
    for (let p = 0; p < k; p++) {
      for (let q = p + 1; q < k; q++) off += a[p]![q]! * a[p]![q]!;
    }
    if (off < 1e-24) break;
    for (let p = 0; p < k; p++) {
      for (let q = p + 1; q < k; q++) {
        if (Math.abs(a[p]![q]!) < 1e-15) continue;
        const theta = (a[q]![q]! - a[p]![p]!) / (2 * a[p]![q]!);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let i = 0; i < k; i++) {
          const aip = a[i]![p]!;
          const aiq = a[i]![q]!;
          a[i]![p] = c * aip - s * aiq;
          a[i]![q] = s * aip + c * aiq;
        }
        for (let i = 0; i < k; i++) {
          const api = a[p]![i]!;
          const aqi = a[q]![i]!;
          a[p]![i] = c * api - s * aqi;
          a[q]![i] = s * api + c * aqi;
        }
      }
    }
  }
  const eigenvalues: number[] = [];
  for (let i = 0; i < k; i++) eigenvalues.push(a[i]![i]!);
  eigenvalues.sort((x, y) => x - y);
  return eigenvalues;
}

/**
 * Lanczos 低端谱：种子化随机起点，全重正交，返回最低两本征值与 gap。
 * k 建议 32–96；对简并基态流形 gap 的解释见调用方（exp4 报告中注明）。
 */
export function lowestSpectrum(
  n: number,
  energies: Float64Array,
  xEnergies: Float64Array,
  s: number,
  options: { k?: number; seed?: number } = {},
): SpectrumResult {
  const dim = 1 << n;
  const k = Math.min(options.k ?? 64, dim);
  const seed = options.seed ?? 0x1a4ce;
  const rng = new Rng(seed);

  const basis: Float64Array[] = [];
  const alphas: number[] = [];
  const betas: number[] = [];
  const v = new Float64Array(dim);
  for (let i = 0; i < dim; i++) v[i] = rng.range(-1, 1);
  const norm0 = Math.sqrt(v.reduce((a, b) => a + b * b, 0));
  for (let i = 0; i < dim; i++) v[i] = v[i]! / norm0;
  basis.push(v);

  const w = new Float64Array(dim);
  let iterations = 0;
  for (let m = 0; m < k; m++) {
    iterations = m + 1;
    applyHamiltonian(n, energies, xEnergies, s, basis[m]!, w);
    const alpha = dot(basis[m]!, w);
    alphas.push(alpha);
    // w ← w − α·v_m − β·v_{m−1}，随后全重正交
    for (let i = 0; i < dim; i++) w[i] = w[i]! - alpha * basis[m]![i]!;
    if (m > 0) {
      const betaPrev = betas[m - 1]!;
      for (let i = 0; i < dim; i++) w[i] = w[i]! - betaPrev * basis[m - 1]![i]!;
    }
    for (const b of basis) {
      const d = dot(b, w);
      for (let i = 0; i < dim; i++) w[i] = w[i]! - d * b[i]!;
    }
    const beta = Math.sqrt(dot(w, w));
    if (beta < 1e-12) break; // 不变子空间（happy breakdown）
    if (m === k - 1) break; // T 已是 k×k 满阶（k = dim 时全空间精确）
    betas.push(beta);
    const next = new Float64Array(dim);
    for (let i = 0; i < dim; i++) next[i] = w[i]! / beta;
    basis.push(next);
  }

  // 三对角 T 的本征值（稠密 Jacobi）
  const size = alphas.length;
  const T: number[][] = Array.from({ length: size }, () => new Array<number>(size).fill(0));
  for (let i = 0; i < size; i++) {
    T[i]![i] = alphas[i]!;
    if (i < betas.length) {
      T[i]![i + 1] = betas[i]!;
      T[i + 1]![i] = betas[i]!;
    }
  }
  const eigenvalues = jacobiEigenvalues(T);
  return {
    lambda0: eigenvalues[0]!,
    lambda1: eigenvalues[1]!,
    gap: eigenvalues[1]! - eigenvalues[0]!,
    iterations,
  };
}

function dot(a: Float64Array, b: Float64Array): number {
  let acc = 0;
  for (let i = 0; i < a.length; i++) acc += a[i]! * b[i]!;
  return acc;
}
