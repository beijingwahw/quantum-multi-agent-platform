/** 全平台默认随机种子（调度/优化引擎共用，保证给定 seed 的行为完全可复现） */
export const DEFAULT_SEED = 42;

/**
 * mulberry32：32 位确定性 PRNG（全平台共享的唯一实现）。
 *
 * 所有调度/优化引擎的随机性都必须经由这里，保证给定 seed 的完整可复现性。
 * 实现保持与原始各副本逐位一致（含种子推进次序），替换不改变任何数值序列。
 */

export class Mulberry32 {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** 产生下一个 [0, 1) 均匀随机数 */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** reseed：重置到新种子（保持对象身份，便于持有方热替换） */
  reseed(seed: number): void {
    this.state = seed >>> 0;
  }
}

/** 函数式便捷包装：返回闭包，调用一次产一个 [0, 1) 随机数 */
export function mulberry32(seed: number): () => number {
  const rng = new Mulberry32(seed);
  return () => rng.next();
}

/** Fisher–Yates 洗牌（确定性，供实验与采样使用） */
export function shuffled<T>(items: readonly T[], rng: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = arr[i]!;
    const b = arr[j]!;
    arr[i] = b;
    arr[j] = a;
  }
  return arr;
}
