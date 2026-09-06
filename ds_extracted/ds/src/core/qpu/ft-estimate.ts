/**
 * ft-estimate —— 容错量子计算（FTQC）资源估算器（v1.11 引入）
 *
 * ============ 定位 ============
 *
 * 给"这个调度任务若上容错量子计算机要花多少"一个可复算的画像：
 * 物理比特数、墙钟时间、T 门数、总逻辑错误率。与 execution-tier.ts
 * 配套——估算器出数字，路由器出决策（NISQ 直发 / FTQC 排队 / 经典回退）。
 *
 * 数值内核与独立研究原型 ft-qaoa（工作区 D:\multi-agent\ft-qaoa）完全
 * 同构：同一码目录、同一幂律、同一 T 计数缩放——两侧数字可互证。
 *
 * ============ 诚实的边界 ============
 * - 码参数引自公开文献（见各码 source 字段）；阈值为估计输入而非硬件规格。
 * - 逻辑错误模型是标准阈值以下幂律启发式（A 与指数显式可配）。
 * - T 工厂常数是文献量级锚点的显式假设，单级/两级蒸馏对深电路预算的
 *   差异本身就是估算器的输出结论（单级 1e-8 地板会压死深电路预算）。
 * - 本估算器不产生任何"量子优势"声称，只产生资源画像。
 */

/** 容错码规格：[[n,k,d]] + 综合征规模 + 阈值（估计输入）+ 出处 */
export interface FtCodeSpec {
  readonly id: string;
  readonly family: 'surface' | 'gross';
  /** 数据物理比特 n */
  readonly n: number;
  /** 逻辑比特 k */
  readonly k: number;
  /** 码距 d */
  readonly d: number;
  /** 每块综合征辅助比特 */
  readonly ancilla: number;
  /** 每轮每块独立检查数（综合征比特数） */
  readonly checks: number;
  /** 电路级伪阈值（估计输入） */
  readonly threshold: number;
  readonly source: string;
}

/**
 * 旋转面码 [[d², 1, d]]。阈值默认 0.6% 取电路级文献常用值
 * （Fowler et al., Phys. Rev. A 86, 032324 (2012)）。
 */
export function surfaceCode(d: number, threshold = 0.006): FtCodeSpec {
  if (!Number.isInteger(d) || d < 2) {
    throw new QuantumEstimateError(`surface distance must be an integer >= 2, got ${d}`);
  }
  return {
    id: `surface-d${d}`,
    family: 'surface',
    n: d * d,
    k: 1,
    d,
    ancilla: d * d - 1,
    checks: d * d - 1,
    threshold,
    source: 'Fowler et al., Phys. Rev. A 86, 032324 (2012)',
  };
}

/**
 * IBM "gross" 双变量自行车码 [[144, 12, 12]]：144 数据比特 + 144 辅助 =
 * 288 物理比特/块，weight-6 稳定子，BP+OSD 电路级伪阈值 0.6–0.8%。
 */
export function grossCode(threshold = 0.007): FtCodeSpec {
  return {
    id: 'gross-bb-144-12-12',
    family: 'gross',
    n: 144,
    k: 12,
    d: 12,
    ancilla: 144,
    checks: 144,
    threshold,
    source: 'Bravyi et al., Nature 627, 778-783 (2024); arXiv:2308.07915',
  };
}

/** 容纳 logicalQubits 个逻辑比特需要的码块数 */
export function blocksFor(logicalQubits: number, code: FtCodeSpec): number {
  return Math.ceil(logicalQubits / code.k);
}

/**
 * 每综合征轮逻辑错误（幂律启发式）：
 *   eps_L = A · (p_phys / p_th)^{floor(d/2)+1}
 * A 默认 0.1——显式假设，无隐藏常量。
 */
export function logicalErrorPerRound(code: FtCodeSpec, pPhys: number, amplitude = 0.1): number {
  return amplitude * Math.pow(pPhys / code.threshold, Math.floor(code.d / 2) + 1);
}

/** T 工厂假设：吞吐、占地、蒸馏错误——全部显式 */
export interface TFactoryAssumptions {
  /** 每条蒸馏链物理比特 */
  readonly physicalQubits: number;
  /** 产出一个逻辑 T 态的墙钟纳秒 */
  readonly nsPerT: number;
  /** 每个蒸馏 T 态的逻辑错误 */
  readonly epsilonPerT: number;
  readonly source: string;
}

export interface FtEstimateAssumptions {
  /** 物理比特错误率 */
  readonly pPhys: number;
  /** 综合征提取轮周期（微秒） */
  readonly cycleTimeUs: number;
  /** 每逻辑操作消耗的综合征轮数（码距倍数，格点手术量级） */
  readonly roundsPerOpDistanceFactor: number;
  /** 整电路可接受的总逻辑失败概率 */
  readonly targetCircuitError: number;
  /** Clifford+T 合成精度（T 计数 = ceil(3·log2(1/eps)) + 4） */
  readonly synthesisEpsilon: number;
  readonly tFactory: TFactoryAssumptions;
}

export const DEFAULT_FT_ASSUMPTIONS: FtEstimateAssumptions = {
  pPhys: 1e-3,
  cycleTimeUs: 1,
  roundsPerOpDistanceFactor: 1,
  targetCircuitError: 1e-2,
  synthesisEpsilon: 1e-6,
  tFactory: {
    physicalQubits: 5000,
    nsPerT: 100,
    epsilonPerT: 1e-12,
    source:
      'assumption (two-level distillation, Gidney-Ekera 2019 class); ' +
      'single-level 1e-8 fails deep-circuit budgets outright',
  },
};

/** 待估算的逻辑电路画像：规模 × 耦合数 × 深度（QAOA 层数 p） */
export interface LogicalCircuitProfile {
  readonly logicalQubits: number;
  readonly couplings: number;
  readonly depth: number;
}

/** FTQC 资源估算结果（全部可由假设复算） */
export interface FtEstimate {
  readonly code: FtCodeSpec;
  readonly blocks: number;
  readonly physicalQubits: number;
  readonly factoryQubits: number;
  readonly totalPhysicalQubits: number;
  readonly logicalOpsTotal: number;
  readonly syndromeRoundsTotal: number;
  readonly wallTimeMs: number;
  readonly tGatesTotal: number;
  readonly epsilonChannel: number;
  readonly epsilonDistillation: number;
  readonly epsilonTotal: number;
  readonly meetsBudget: boolean;
}

import { QuantumEstimateError } from '../../utils/errors.js';

/**
 * 估算容错执行一个逻辑电路的资源。
 *
 * 模型（与 ft-qaoa 同构）：
 *   - 每层非 Clifford 内容 = (couplings + 2·logicalQubits) 个任意角旋转
 *     （耦合 RZZ + 场 RZ + 混合器 RX），每旋转 T 数 = ceil(3·log2(1/eps))+4；
 *   - 每逻辑操作消耗 factor·d 轮综合征，信道错误按轮幂律累积；
 *   - 蒸馏错误按 T 门数累积；墙钟按串行逻辑执行（保守）。
 */
export function estimateFtCircuit(
  profile: LogicalCircuitProfile,
  code: FtCodeSpec,
  assumptions: Partial<FtEstimateAssumptions> = {},
): FtEstimate {
  const a: FtEstimateAssumptions = { ...DEFAULT_FT_ASSUMPTIONS, ...assumptions };
  const { logicalQubits, couplings, depth } = profile;
  if (logicalQubits < 1 || couplings < 0 || depth < 1) {
    throw new QuantumEstimateError(
      `invalid circuit profile: qubits=${logicalQubits}, couplings=${couplings}, depth=${depth}`,
    );
  }

  const blocks = blocksFor(logicalQubits, code);
  const rotationsPerLayer = couplings + 2 * logicalQubits;
  const tPerRotation = Math.ceil(3 * Math.log2(1 / a.synthesisEpsilon)) + 4;
  const logicalOpsTotal = depth * rotationsPerLayer;
  const tGatesTotal = logicalOpsTotal * tPerRotation;
  const syndromeRoundsPerOp = Math.max(1, Math.round(a.roundsPerOpDistanceFactor * code.d));
  const syndromeRoundsTotal = logicalOpsTotal * syndromeRoundsPerOp;

  const epsilonChannel =
    logicalOpsTotal * syndromeRoundsPerOp * logicalErrorPerRound(code, a.pPhys);
  const epsilonDistillation = tGatesTotal * a.tFactory.epsilonPerT;
  const epsilonTotal = epsilonChannel + epsilonDistillation;

  const wallTimeUs = syndromeRoundsTotal * a.cycleTimeUs;
  const tRatePerSec = wallTimeUs > 0 ? tGatesTotal / (wallTimeUs / 1e6) : Number.POSITIVE_INFINITY;
  const factoryRatePerSec = 1e9 / a.tFactory.nsPerT;
  const factories = Math.max(1, Math.ceil(tRatePerSec / factoryRatePerSec));

  const physicalQubits = blocks * (code.n + code.ancilla);
  const factoryQubits = factories * a.tFactory.physicalQubits;

  return {
    code,
    blocks,
    physicalQubits,
    factoryQubits,
    totalPhysicalQubits: physicalQubits + factoryQubits,
    logicalOpsTotal,
    syndromeRoundsTotal,
    wallTimeMs: wallTimeUs / 1000,
    tGatesTotal,
    epsilonChannel,
    epsilonDistillation,
    epsilonTotal,
    meetsBudget: epsilonTotal <= a.targetCircuitError,
  };
}

/**
 * 码选择：surface 距离扫描（奇数 d，3..31）取最小可行占地，与固定 d=12
 * 的 gross 码对照。无可行 surface 距离时回落最小占地（meetsBudget=false
 * 如实上报），gross 恒参与对照。
 */
export function selectFtCode(
  profile: LogicalCircuitProfile,
  assumptions: Partial<FtEstimateAssumptions> = {},
): { surface: FtEstimate; gross: FtEstimate; chosen: FtEstimate } {
  const candidates: FtEstimate[] = [];
  for (let d = 3; d <= 31; d += 2) {
    candidates.push(estimateFtCircuit(profile, surfaceCode(d), assumptions));
  }
  const feasible = candidates.filter((c) => c.meetsBudget);
  const surface = (feasible.length > 0 ? feasible : candidates).reduce((best, c) =>
    c.totalPhysicalQubits < best.totalPhysicalQubits ? c : best,
  );
  const gross = estimateFtCircuit(profile, grossCode(), assumptions);
  const pool = gross.meetsBudget ? [surface, gross] : [surface];
  const chosen = pool.reduce((best, c) =>
    c.totalPhysicalQubits < best.totalPhysicalQubits ? c : best,
  );
  return { surface, gross, chosen };
}
