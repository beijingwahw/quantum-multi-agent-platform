/**
 * 数值口径工具：全平台统一的舍入位数。
 * 舍入位数不一致会让「同一次计算」在报表层出现末位漂移，
 * 因此集中在此，禁止在业务代码里再写 `Math.round(x * 1e9) / 1e9` 之类。
 */

/** 机制支付/福利的核算精度（1e-9） */
export function round9(x: number): number {
  return Math.round(x * 1e9) / 1e9;
}

/** 货币口径（分） */
export function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

/** 比率口径（千分位） */
export function round3(x: number): number {
  return Math.round(x * 1000) / 1000;
}
