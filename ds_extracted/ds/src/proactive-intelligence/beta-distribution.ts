/**
 * Beta 分布数值内核（零依赖、确定性）
 *
 * 提供 lgamma / logBeta / 正则化不完全 Beta（Beta CDF）/ Beta 分位数四个
 * 纯函数，支撑 Beta-Bernoulli 后验的置信下界（LCB）与逆 CDF 抽样：
 *   - lgamma：Lanczos 近似（g=7，9 系数），x<0.5 走 π/sin(πx) 反射；
 *   - logBeta(a,b) = lgamma(a)+lgamma(b)−lgamma(a+b)；
 *   - betaCdf(x,a,b) = I_x(a,b)：Lentz 修正连分式（对称分支保证
 *     I_x(a,b) + I_{1−x}(b,a) = 1 的对偶恒等式）；
 *   - betaQuantile(p,a,b)：对 I_x(a,b)=p 的 [0,1] 二分，200 步把区间
 *     压到 2^−200（double 精度饱和），先收敛先停。
 *
 * 域纪律（入口拒绝，NumericDomainError 指名）：形状参数 a/b 必须 > 0
 * 且有限；x/p 必须落在 [0,1]。NaN/越界不得被「加工」后继续流毒。
 *
 * 实现是纯函数（无随机源、无 IO、无模块级可变状态）：同一输入永远
 * 逐位相同，可作冻结测试 pin 的锚点。
 */

import { NumericDomainError } from '../utils/errors.js';

/** Lanczos 近似常数（g=7，9 项）——公开的标准系数集 */
const LANCZOS_G = 7;
const LANCZOS_COEFFICIENTS: readonly number[] = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
  1.5056327351493116e-7,
];

/** 形状参数域守卫：a/b > 0 且有限（NaN/0/负数一律指名拒绝） */
function assertShape(name: string, value: number): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new NumericDomainError(
      `Beta distribution shape parameter '${name}' must be a finite positive number, got ${String(value)}`,
    );
  }
}

/** ln Γ(x)，x > 0（x < 0.5 走反射公式，保证全域一致精度） */
export function lgamma(x: number): number {
  assertShape('x', x);
  if (x < 0.5) {
    // 反射：Γ(x)·Γ(1−x) = π / sin(πx)
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  }
  const z = x - 1;
  let series = LANCZOS_COEFFICIENTS[0]!;
  for (let i = 1; i < LANCZOS_COEFFICIENTS.length; i++) {
    series += LANCZOS_COEFFICIENTS[i]! / (z + i);
  }
  const t = z + LANCZOS_G + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(series);
}

/** ln B(a,b) = ln Γ(a) + ln Γ(b) − ln Γ(a+b) */
export function logBeta(a: number, b: number): number {
  assertShape('a', a);
  assertShape('b', b);
  return lgamma(a) + lgamma(b) - lgamma(a + b);
}

/** Lentz 修正连分式（betaCdf 的内核；参数约定见 Numerical Recipes betacf） */
function betacf(a: number, b: number, x: number): number {
  const MAX_ITER = 200;
  const EPS = 3e-12;
  const FPMIN = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAX_ITER; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/**
 * Beta(a,b) 的累积分布函数 I_x(a,b)（正则化不完全 Beta）。
 * x=0 → 0、x=1 → 1 是精确边界；分支阈值 (a+1)/(a+b+2) 两侧分别用
 * 对偶形式求值，I_x(a,b) + I_{1−x}(b,a) = 1 在浮点意义下成立。
 */
export function betaCdf(x: number, a: number, b: number): number {
  assertShape('a', a);
  assertShape('b', b);
  if (typeof x !== 'number' || Number.isNaN(x) || x < 0 || x > 1) {
    throw new NumericDomainError(`betaCdf() x must be within [0, 1], got ${String(x)}`);
  }
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lnBt = a * Math.log(x) + b * Math.log1p(-x) - logBeta(a, b);
  const bt = Math.exp(lnBt);
  if (x < (a + 1) / (a + b + 2)) {
    return (bt * betacf(a, b, x)) / a;
  }
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/**
 * Beta(a,b) 的 p 分位数：解 I_x(a,b) = p。
 * p=0 → 0、p=1 → 1 是精确边界；其余在 [0,1] 上二分（区间减半 200 步
 * 已饱和 double 精度，中点 CDF 收敛到 |I−p| < 1e-12 即提前返回）。
 * 纯函数 + 单调 CDF ⇒ 同输入逐位可复现，可作逆 CDF 抽样的确定性内核。
 */
export function betaQuantile(p: number, a: number, b: number): number {
  assertShape('a', a);
  assertShape('b', b);
  if (typeof p !== 'number' || Number.isNaN(p) || p < 0 || p > 1) {
    throw new NumericDomainError(`betaQuantile() p must be within [0, 1], got ${String(p)}`);
  }
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const cdfAtMid = betaCdf(mid, a, b);
    if (Math.abs(cdfAtMid - p) < 1e-13) return mid;
    if (cdfAtMid < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
