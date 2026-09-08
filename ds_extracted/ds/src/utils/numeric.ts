/**
 * 数值口径工具：全平台统一的舍入位数。
 * 舍入位数不一致会让「同一次计算」在报表层出现末位漂移，
 * 因此集中在此，禁止在业务代码里再写 `Math.round(x * 1e9) / 1e9` 之类。
 */

import { NumericDomainError } from './errors.js';

/**
 * 统一舍入实现：非法输入在入口拒绝（负对照契约）。
 * - NaN/Infinity 输入此前会被「舍入」成自身继续流毒（round2(NaN)===NaN）；
 * - 有限但量级过大的输入（如 round9(1e300)，x*1e9 溢出为 Infinity）此前
 *   静默产出 Infinity——货币/福利口径下两者都是垃圾值，一律抛
 *   NumericDomainError 而非继续传播。
 */
function roundToScale(
  x: number,
  scale: number,
  name: 'round9' | 'round2' | 'round3',
  precision: string,
): number {
  if (!Number.isFinite(x)) {
    throw new NumericDomainError(`${name}(): input must be a finite number, got ${String(x)}`);
  }
  const rounded = Math.round(x * scale) / scale;
  if (!Number.isFinite(rounded)) {
    throw new NumericDomainError(
      `${name}(): rounding ${String(x)} overflows to a non-finite value at ${precision} precision`,
    );
  }
  return rounded;
}

/** 机制支付/福利的核算精度（1e-9） */
export function round9(x: number): number {
  return roundToScale(x, 1e9, 'round9', '1e-9');
}

/** 货币口径（分） */
export function round2(x: number): number {
  return roundToScale(x, 100, 'round2', '0.01');
}

/** 比率口径（千分位） */
export function round3(x: number): number {
  return roundToScale(x, 1000, 'round3', '0.001');
}

/**
 * 福利/能量比较的浮点容差（Q2 收口）：同仓两套精度治理（此处集中、
 * qpu/solve.ts 散写 1e-12）与「集中口径」哲学矛盾。跨路径比较
 * （QPU 采样 vs 本地精确对照）统一引用本常量。
 */
export const WELFARE_COMPARISON_EPSILON = 1e-12;
