/**
 * 品牌化谱表类型 —— 本仓第一错误族（cat:dimension-slot，census 7 次记录，
 * 含 b7#2 的 matvec 四步收缩槽序）的类型级装甲（0.3.0 类型硬化）。
 *
 * H(s) = −s·C + (1−s)·H_D 的引擎在两个对角基之间往返：Z 基问题谱表
 * （energies，索引 = 计算基位型）与 X 基驱动谱表（xEnergies，索引 =
 * Walsh-Hadamard 位型）。两者都是 Float64Array——槽序互换在类型上
 * 不可见，在物理上是灾难（q.s 是输入、q.sp 是输出的教训即此族）。
 *
 * 品牌类型把"哪张表属于哪个基"编进类型：ZSpectrum 与 XSpectrum 互不
 * 可赋值，裸 Float64Array 也进不了任何一个槽位。品牌只在生产者处落
 * 一次（zSpectrumOf/xSpectrumOf 是全仓仅有的两个受审 as 点），此后
 * 一切引用靠类型流动。零表在两个基下相同（0 是基无关常数），故
 * zeroSpectrum 的返回类型是两个品牌的交集（品牌属性互异、可共存）。
 */
export type ZSpectrum = Float64Array & { readonly __zBasis: true };
export type XSpectrum = Float64Array & { readonly __xBasis: true };

/** 受审品牌点：把已按 Z 基约定填好的表标记为 ZSpectrum（生产者专用）。 */
export function zSpectrumOf(table: Float64Array): ZSpectrum {
  return table as ZSpectrum;
}

/** 受审品牌点：把已按 X 基约定填好的表标记为 XSpectrum（生产者专用）。 */
export function xSpectrumOf(table: Float64Array): XSpectrum {
  return table as XSpectrum;
}

/** 全零谱表（长度 2^n）：零在两个对角基下相同，同时携带 Z/X 品牌。 */
export function zeroSpectrum(n: number): ZSpectrum & XSpectrum {
  return new Float64Array(1 << n) as ZSpectrum & XSpectrum;
}
