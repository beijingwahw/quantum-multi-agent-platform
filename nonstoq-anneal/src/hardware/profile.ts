/**
 * 可编程非 stoquastic 退火机 —— 机器可读硬件剖面（显式假设，全部可配）。
 * 数值范围锚定本仓库模拟所需（exp1-exp5），硬件可实现性引用已公开的
 * 实验演示（Ozfidan et al., PRA 13, 034037 (2020)：磁通量子比特容性+感性
 * 双耦合产生 ZX 型非 stoquastic 项）；生产级多比特可编程实现不存在——
 * 本剖面即路线目标规格。见 docs/hardware-spec.md。
 */

export interface CouplerSpec {
  readonly kind: "xx" | "zx" | "zz";
  /** 可编程系数范围（单位：Γ，Γ=1 归一）。 */
  readonly range: readonly [number, number];
  /** 相对带宽（校准不确定度，显式假设）。 */
  readonly calibrationTolerance: number;
  readonly note: string;
}

export interface NonStoqHardwareProfile {
  readonly id: string;
  readonly qubits: number;
  readonly gammaRange: readonly [number, number];
  readonly connectivity: number;
  readonly couplers: readonly CouplerSpec[];
  /** 两参数路径时序分辨率（μs，显式假设）。 */
  readonly scheduleResolutionUs: number;
  readonly source: string;
}

export const DEFAULT_NONSTOQ_PROFILE: NonStoqHardwareProfile = {
  id: "nonstoq-annealer-v0",
  qubits: 64,
  gammaRange: [0.2, 2.0],
  connectivity: 4,
  couplers: [
    { kind: "zz", range: [-2, 2], calibrationTolerance: 0.03, note: "问题项（标准退火耦合器）" },
    { kind: "xx", range: [-2, 2], calibrationTolerance: 0.04, note: "反铁磁 XX 催化剂；κ>0 为非 stoquastic（规范不可约，见 designing.ts）" },
    { kind: "zx", range: [-1, 1], calibrationTolerance: 0.05, note: "Ozfidan 2020 已实验演示的耦合类型；对角规范可去（de-signing 判定器管）" },
  ],
  scheduleResolutionUs: 0.05,
  source: "assumption anchored to: Ozfidan et al., Phys. Rev. Applied 13, 034037 (2020); exp1-exp5 simulation envelopes",
};

export interface FitReport {
  readonly fits: boolean;
  readonly violations: string[];
}

/** 驱动器是否落在硬件包络内（调度器/实验入口的通用校验）。 */
export function fitsHardwareProfile(
  driver: { gamma: number; couplings: ReadonlyArray<{ j: number; k: number; w: number; kind?: "xx" | "zx" }> },
  profile: NonStoqHardwareProfile = DEFAULT_NONSTOQ_PROFILE,
): FitReport {
  const violations: string[] = [];
  if (driver.gamma < profile.gammaRange[0] || driver.gamma > profile.gammaRange[1]) {
    violations.push(`gamma ${driver.gamma} outside ${profile.gammaRange.join("..")}`);
  }
  const degrees = new Map<number, number>();
  for (const c of driver.couplings) {
    degrees.set(c.j, (degrees.get(c.j) ?? 0) + 1);
    degrees.set(c.k, (degrees.get(c.k) ?? 0) + 1);
    const spec = profile.couplers.find((s) => s.kind === (c.kind ?? "xx"));
    if (!spec) {
      violations.push(`no coupler spec for kind=${c.kind ?? "xx"}`);
      continue;
    }
    if (c.w < spec.range[0] || c.w > spec.range[1]) {
      violations.push(`coupling (${c.j},${c.k})=${c.w} outside ${spec.range.join("..")}`);
    }
  }
  for (const [q, d] of degrees) {
    if (d > profile.connectivity) violations.push(`qubit ${q} degree ${d} > ${profile.connectivity}`);
  }
  return { fits: violations.length === 0, violations };
}

/** 设备验证协议的机读清单（docs/hardware-spec.md §5 的机器形态）。 */
export interface CalibrationAnchor {
  readonly name: string;
  readonly expectation: string;
  readonly derivesFrom: string;
}

export const CALIBRATION_ANCHORS: readonly CalibrationAnchor[] = [
  {
    name: "stoq-baseline-positivity",
    expectation: "κ=0 设置下基态采样分布非负符号结构（Perron-Frobenius 基线，exp1 对照）",
    derivesFrom: "exp1: κ=0 → P = 1.000000 精确",
  },
  {
    name: "pair-spectroscopy-kc",
    expectation: "双比特对谱在 κ_c = 2Γ 处相变（片上可复现的解析锚点）",
    derivesFrom: "anneal.test.ts 解析锚点（κ>2Γ → P=0 精确）",
  },
  {
    name: "xx-irreducibility",
    expectation: "κ>0 的 XX 项在任何对角规范下不可去（符号壁垒的定理级声明）",
    derivesFrom: "designing.ts 闭式判定 + 稠密矩阵裁判",
  },
  {
    name: "driver-ground-preparation",
    expectation: "κ>2Γ 后必须能制备驱动器自身含符号结构的基态（退火初态）",
    derivesFrom: "exp2: 从 |+⟩^n 起跳在 κ>2Γ 违背绝热前提",
  },
];
