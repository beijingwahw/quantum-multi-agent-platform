import { Rng } from "../core/rng.js";

/**
 * 矩阵乘积态（MPS）—— 实数、开链、物理维 d=2。
 * 张量布局：site i 的 [χ_left, 2, χ_right]，平铺索引 (l*2+s)*χR + r。
 */
export interface Mps {
  readonly n: number;
  readonly tensors: Float64Array[];
  readonly chis: number[]; // 长度 n+1，边界 χ_0 = χ_n = 1
}

export function randomMps(n: number, chiMax: number, seed: number): Mps {
  const rng = new Rng(seed);
  const chis: number[] = [];
  for (let i = 0; i <= n; i++) {
    chis.push(Math.max(1, Math.min(2 ** Math.min(i, n - i), chiMax)));
  }
  const tensors: Float64Array[] = [];
  for (let i = 0; i < n; i++) {
    const cl = chis[i]!;
    const cr = chis[i + 1]!;
    const t = new Float64Array(cl * 2 * cr);
    for (let k = 0; k < t.length; k++) t[k] = rng.range(-1, 1);
    tensors.push(t);
  }
  const mps: Mps = { n, tensors, chis };
  normalizeMps(mps);
  return mps;
}

export function mpsNorm(mps: Mps): number {
  let env = new Float64Array(1); // env[a*χ + a']，初始 [1]
  let chi = 1;
  for (let i = 0; i < mps.n; i++) {
    const t = mps.tensors[i]!;
    const cr = mps.chis[i + 1]!;
    const next = new Float64Array(cr * cr);
    for (let b = 0; b < cr; b++) {
      for (let bp = 0; bp < cr; bp++) {
        let acc = 0;
        for (let a = 0; a < chi; a++) {
          for (let ap = 0; ap < chi; ap++) {
            const e = env[a * chi + ap]!;
            if (e === 0) continue;
            for (let s = 0; s < 2; s++) {
              acc += e * t[((a * 2 + s) * cr + b)]! * t[((ap * 2 + s) * cr + bp)]!;
            }
          }
        }
        next[b * cr + bp] = acc;
      }
    }
    env = next;
    chi = cr;
  }
  return Math.sqrt(env[0]!);
}

export function normalizeMps(mps: Mps): void {
  const norm = mpsNorm(mps);
  if (norm > 0) {
    const t0 = mps.tensors[0]!;
    for (let k = 0; k < t0.length; k++) t0[k] = t0[k]! / norm;
  }
}

/** 基态振幅 ψ(s)：从左到右收缩行向量。O(n·χ²)。 */
export function mpsAmplitude(mps: Mps, bits: number): number {
  let v = new Float64Array(1);
  v[0] = 1;
  let chi = 1;
  for (let i = 0; i < mps.n; i++) {
    const s = (bits >>> i) & 1;
    const cr = mps.chis[i + 1]!;
    const t = mps.tensors[i]!;
    const next = new Float64Array(cr);
    for (let r = 0; r < cr; r++) {
      let acc = 0;
      for (let l = 0; l < chi; l++) {
        acc += v[l]! * t[((l * 2 + s) * cr + r)]!;
      }
      next[r] = acc;
    }
    v = next;
    chi = cr;
  }
  return v[0]!;
}

/** 用逐点 SVD 把稠密实向量编码为精确 MPS（χ ≤ 2^i 截断到 chiMax；裁判用）。 */
export function mpsFromDense(vec: Float64Array, n: number, chiMax: number): Mps {
  // 位反转重排：使 site 0 = 量子比特 0（原平坦索引按 MSB 切分会把比特序颠倒）
  let mat = new Float64Array(vec.length);
  for (let s = 0; s < vec.length; s++) {
    let r = 0;
    for (let i = 0; i < n; i++) if ((s >>> i) & 1) r |= 1 << (n - 1 - i);
    mat[r] = vec[s]!;
  }
  let rows = 1;
  let cols = vec.length;
  const chis: number[] = [1];
  const tensors: Float64Array[] = [];
  for (let i = 0; i < n - 1; i++) {
    const newRows = rows * 2;
    const newCols = cols / 2;
    // SVD of mat [newRows × newCols]：用对称特征分解 (MᵀM) 的 Jacobi
    const mtm = Array.from({ length: newCols }, () => new Array<number>(newCols).fill(0));
    for (let a = 0; a < newRows; a++) {
      for (let b = 0; b < newCols; b++) {
        const vab = mat[a * newCols + b]!;
        for (let c = b; c < newCols; c++) {
          mtm[b]![c]! += vab * mat[a * newCols + c]!;
        }
      }
    }
    for (let b = 0; b < newCols; b++) for (let c = 0; c < b; c++) mtm[b]![c] = mtm[c]![b]!;
    const { eigenvalues, eigenvectors } = jacobiEigenWithVectors(mtm);
    // 奇异值 = sqrt(λ)，按 |λ| 降序取前 k
    const order = eigenvalues.map((v, idx) => [v, idx] as const).sort((x, y) => y[0] - x[0]);
    const k = Math.min(chiMax, newCols, order.filter(([v]) => v > 1e-24).length || 1);
    const U = new Float64Array(newRows * k); // 左奇异向量
    const S = new Float64Array(k);
    for (let j = 0; j < k; j++) {
      const [lambda, idx] = order[j]!;
      S[j] = Math.sqrt(Math.max(lambda, 0));
      const vCol = eigenvectors[idx]!;
      for (let a = 0; a < newRows; a++) {
        let acc = 0;
        for (let b = 0; b < newCols; b++) acc += mat[a * newCols + b]! * vCol[b]!;
        U[a * k + j] = acc; // 未归一（= σ·v_j 的 U 分量）
      }
      // 归一化 U 列：U 列范数 = σ
      let norm2 = 0;
      for (let a = 0; a < newRows; a++) norm2 += U[a * k + j]! ** 2;
      const sigma = Math.sqrt(norm2);
      S[j] = sigma;
      if (sigma > 0) for (let a = 0; a < newRows; a++) U[a * k + j] = U[a * k + j]! / sigma;
    }
    // 张量 i：[rows, 2, k] ← U 重排（rows = 2^i 已按 (…, s_i) 平铺，U 行含全部左物理位）
    const t = new Float64Array(rows * 2 * k);
    for (let a = 0; a < rows * 2; a++) {
      for (let j = 0; j < k; j++) t[a * k + j] = U[a * k + j]!;
    }
    tensors.push(t);
    chis.push(k);
    // mat ← diag(S)·Vᵀ：Vᵀ[j, b] = eigenvectors[idx_j][b]
    const next = new Float64Array(k * newCols);
    for (let j = 0; j < k; j++) {
      const [, idx] = order[j]!;
      const vCol = eigenvectors[idx]!;
      for (let b = 0; b < newCols; b++) next[j * newCols + b] = S[j]! * vCol[b]!;
    }
    mat = next;
    rows = k;
    cols = newCols;
  }
  // 最后一个张量：[rows, 2, 1]
  const tLast = new Float64Array(rows * 2);
  for (let a = 0; a < rows * 2; a++) tLast[a] = mat[a]!;
  tensors.push(tLast);
  chis.push(1);
  return { n, tensors, chis };
}

/** Jacobi 特征分解（值 + 向量），供 SVD 使用（矩阵维 ≤ ~64）。 */
export function jacobiEigenWithVectors(matrix: number[][]): {
  eigenvalues: number[];
  eigenvectors: number[][];
} {
  const m = matrix.length;
  const a = matrix.map((r) => [...r]);
  const V: number[][] = Array.from({ length: m }, (_, i) =>
    Array.from({ length: m }, (_, j): number => (i === j ? 1 : 0)),
  );
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0;
    for (let p = 0; p < m; p++) for (let q = p + 1; q < m; q++) off += a[p]![q]! * a[p]![q]!;
    if (off < 1e-24) break;
    for (let p = 0; p < m; p++) {
      for (let q = p + 1; q < m; q++) {
        if (Math.abs(a[p]![q]!) < 1e-15) continue;
        const theta = (a[q]![q]! - a[p]![p]!) / (2 * a[p]![q]!);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let i = 0; i < m; i++) {
          const aip = a[i]![p]!;
          const aiq = a[i]![q]!;
          a[i]![p] = c * aip - s * aiq;
          a[i]![q] = s * aip + c * aiq;
        }
        for (let i = 0; i < m; i++) {
          const api = a[p]![i]!;
          const aqi = a[q]![i]!;
          a[p]![i] = c * api - s * aqi;
          a[q]![i] = s * api + c * aqi;
        }
        for (let i = 0; i < m; i++) {
          const vip = V[i]![p]!;
          const viq = V[i]![q]!;
          V[i]![p] = c * vip - s * viq;
          V[i]![q] = s * vip + c * viq;
        }
      }
    }
  }
  const eigenvalues: number[] = [];
  for (let i = 0; i < m; i++) eigenvalues.push(a[i]![i]!);
  const eigenvectors: number[][] = [];
  for (let j = 0; j < m; j++) eigenvectors.push(V.map((row) => row[j]!));
  return { eigenvalues, eigenvectors };
}
