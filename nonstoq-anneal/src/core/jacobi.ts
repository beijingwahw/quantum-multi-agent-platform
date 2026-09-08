/**
 * 稠密实对称矩阵的 Jacobi 特征分解 —— 全仓单一来源（0.3.0 单源化）。
 *
 * 此前 mps.ts（SVD 用，带向量）与 lanczos.ts（T 矩阵用，仅值）各持一份
 * 逐位相同的旋转核心；任何一份漂移都会让 DMRG 的奇异值谱与 Lanczos 的
 * 三对角谱出自两套算术。现在两处一律 import 本模块——值路径
 * （jacobiEigenvalues）与向量路径（jacobiEigenWithVectors）共享同一旋转
 * 核心，漂移在构造上不可能。
 *
 * 数值约定（冻结）：100 轮扫描上限；off < 1e-24 提前终止；|a_pq| < 1e-15
 * 跳过；t = sign(θ)/(|θ|+√(θ²+1)) 的标准稳定公式。矩阵维 ≤ ~100。
 */

/** Jacobi 特征分解（值 + 向量），供 SVD 与 DMRG 使用（矩阵维 ≤ ~64）。 */
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

/** 稠密对称矩阵 Jacobi 特征值（升序；测试裁判与 Lanczos T 矩阵共用）。 */
export function jacobiEigenvalues(matrix: number[][]): number[] {
  const { eigenvalues } = jacobiEigenWithVectors(matrix);
  eigenvalues.sort((x, y) => x - y);
  return eigenvalues;
}
