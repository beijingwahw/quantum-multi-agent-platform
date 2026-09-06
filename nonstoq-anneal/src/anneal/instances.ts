import type { IsingModel, Coupling } from "../core/ising.js";

/**
 * 结构化催化剂实例族（Hormozi et al., PRB 95, 184416 (2017) 型）。
 *
 * 反铁磁（AF）环：最大化 C = Σ (−1)·z_i z_j ⟺ 邻居反平行。
 *  - 偶数环：可双着色，Néel 基态二重简并，无受挫——二级相变、多项式
 *    闭合的 gap（对照族）；
 *  - 奇数环：无法全局反平行，一条受挫键可处于任意位置——n 重简并
 *    基态，化学计量（κ=0）退火呈一级相变特征（min-gap 随 n 指数
 *    闭合）。反铁磁 XX 驱动（κ>0，即本引擎的非 stoquastic 项）预期
 *    直接耦合受挫扇区、打穿一级相变——这是催化剂正面证据的靶场。
 * 结论以 exp4 的测量为准，不预设。
 */

/** 反铁磁环：n ≥ 3 个自旋的环形链，边权全 −1（无场）。 */
export function antiferroRing(n: number): IsingModel {
  if (!Number.isInteger(n) || n < 3) {
    throw new Error(`AF ring needs integer n >= 3, got ${n}`);
  }
  const couplings: Coupling[] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    couplings.push({ j: Math.min(i, j), k: Math.max(i, j), w: -1 });
  }
  return { n, fields: new Array<number>(n).fill(0), couplings };
}

/** 受挫（奇数环）与否的便捷判定。 */
export function isFrustratedRing(n: number): boolean {
  return n % 2 === 1;
}
