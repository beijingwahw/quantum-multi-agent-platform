/**
 * 全平台默认随机种子（调度/优化引擎共用，保证给定 seed 的行为完全可复现）。
 *
 * 【Q1 审计评估结论：同序共享判定为无害，默认值保持 42】
 * 默认部署下两条流同起点同序列：solver-common 的求解器流（每次 solve
 * 新建 mulberry32(42)，用于角度重启扰动与坍缩采样）与 quantum-scheduler
 * 的状态流（持久 mulberry32(42)，用于 agent/任务量子态的 amplitude/
 * phase/position）——值级碰撞确实存在（如首个 agent 的 amplitude 与
 * 每次求解的首抽值级相同）。但实验与代码证据表明无可观测统计耦合：
 * ① 代码层面：amplitude/phase 无任何消费者，仅 position 经量子距离
 *    进入亲和度；两条流的值从不进入同一算式（无精确相等敏感逻辑）。
 * ② 实验层面（2×2 差中差，状态流生成器{42,999} × 求解器种子
 *    {42,4242,12345,2024}，300 问题）：交互项（共享 42 的专属效应）
 *    |Δp|≤0.0017（z ∈ [-2.1,-1.3]，不通过三重比较校正），分配翻转率
 *    不随生成器种子系统性变化（20.7/18.3%、19.3/21.7%、2.7/1.0%）；
 *    均值 p 族表内 42 非离群（0.2336 vs 族 0.2074~0.2358）。
 * ③ 求解器每次 solve 用固定均匀序列对不同权重采样属「公共随机数」
 *    （CRN）形态：不偏移均值，只降低跨场景差分方差。
 * 故不改默认值——任何默认种子移位都会使全部确定性基准黄金值移位，
 * 代价大于收益。需要独立流的调用方应显式传各自 seed。
 */
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
