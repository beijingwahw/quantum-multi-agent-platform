/**
 * 矩阵 Trotter 精确配分比 —— 采样器的任意 β 裁判。
 *
 * 恒等式：⟨sign⟩ = Z(κ)/Z(−κ)（stoquastic 影子）。两个 Z 都由对称化
 * Trotter 传播子的迹精确计算：U = D_z^{1/2}·(W D_x W)·D_z^{1/2}，
 * Z = Tr(U^M)，M = 2^k 次矩阵平方取迹。n ≤ 8（dim ≤ 256）时秒级，
 * 与 SSE 全枚举在 n=2 互相印证（枚举无 Trotter 误差，矩阵无截断误差）。
 */
import type { ZSpectrum, XSpectrum } from "../core/spectra.js";

function hadamardBasisMatrix(dim: number, xEnergies: XSpectrum, driverCoef: number): Float64Array {
  // B[a][b] = (1/dim)·Σ_t (−1)^{popcount(a&t)}·(−1)^{popcount(b&t)}·e^{−driverCoef·E_x(t)}
  const B = new Float64Array(dim * dim);
  const signs = new Float64Array(dim);
  for (let t = 0; t < dim; t++) {
    signs[t] = Math.exp(-driverCoef * xEnergies[t]!);
  }
  for (let a = 0; a < dim; a++) {
    for (let b = 0; b < dim; b++) {
      let acc = 0;
      for (let t = 0; t < dim; t++) {
        const parity = popcountParity(a & t) * popcountParity(b & t);
        acc += parity * signs[t]!;
      }
      B[a * dim + b] = acc / dim;
    }
  }
  return B;
}

function popcountParity(x: number): number {
  let p = 1;
  let v = x;
  while (v) {
    p = -p;
    v &= v - 1;
  }
  return p;
}

function trotterLogZ(
  n: number,
  energies: ZSpectrum,
  xEnergies: XSpectrum,
  s: number,
  beta: number,
  log2Slices: number,
): number {
  const dim = 1 << n;
  const M = 1 << log2Slices;
  const dtau = beta / M;
  const B = hadamardBasisMatrix(dim, xEnergies, dtau * (1 - s));
  // U = Dz^{1/2} B Dz^{1/2}，Dz 对角元 = e^{−Δτ·s·(−C)/2} = e^{+Δτ·s·C/2}
  const U = new Float64Array(dim * dim);
  for (let a = 0; a < dim; a++) {
    const da = Math.exp((dtau * s * energies[a]!) / 2);
    for (let b = 0; b < dim; b++) {
      U[a * dim + b] = da * B[a * dim + b]! * Math.exp((dtau * s * energies[b]!) / 2);
    }
  }
  // 矩阵平方 k 次 → U^M，逐级按最大元素归一化防溢出，取迹后按对数刻度还原
  let T = U;
  let logScale = 0;
  for (let k = 0; k < log2Slices; k++) {
    const N = new Float64Array(dim * dim);
    for (let a = 0; a < dim; a++) {
      for (let c = 0; c < dim; c++) {
        const t = T[a * dim + c]!;
        if (t === 0) continue;
        const rowC = c * dim;
        const rowA = a * dim;
        for (let b = 0; b < dim; b++) {
          N[rowA + b] = N[rowA + b]! + t * T[rowC + b]!;
        }
      }
    }
    let maxAbs = 0;
    for (const x of N) {
      const v = Math.abs(x);
      if (v > maxAbs) maxAbs = v;
    }
    if (maxAbs > 0 && Number.isFinite(maxAbs)) {
      for (let idx = 0; idx < N.length; idx++) N[idx] = N[idx]! / maxAbs;
      logScale += Math.log(maxAbs);
    }
    T = N;
  }
  let trace = 0;
  for (let a = 0; a < dim; a++) trace += T[a * dim + a]!;
  // 负对数刻度下溢保护：返回 Z 的对数由调用方组合（此处直接返回带刻度的迹）
  return trace > 0 ? Math.log(trace) + logScale : Number.NEGATIVE_INFINITY;
}

/**
 * 精确 ⟨sign⟩ = Z(κ 驱动)/Z(−κ 影子)。n ≤ 8 推荐（dim ≤ 256）。
 * log2Slices 默认 9（512 片，Trotter 误差 ≪ MC 统计误差）。
 * 两个 Z 都在对数刻度上计算（防溢出），比值在最后一步还原。
 */
export function exactSignRatio(
  n: number,
  energies: ZSpectrum,
  xEnergiesPlus: XSpectrum,
  xEnergiesMinus: XSpectrum,
  s: number,
  beta: number,
  log2Slices = 9,
): number {
  const logZPlus = trotterLogZ(n, energies, xEnergiesPlus, s, beta, log2Slices);
  const logZMinus = trotterLogZ(n, energies, xEnergiesMinus, s, beta, log2Slices);
  if (logZMinus === Number.NEGATIVE_INFINITY) return 1;
  return Math.exp(logZPlus - logZMinus);
}
