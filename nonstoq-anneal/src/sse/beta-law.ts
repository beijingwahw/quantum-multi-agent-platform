/**
 * 有限 β 符号定律的精确修正项 —— v0.4.0 的新定理面。
 *
 * 恒等式（谱形，机器可验零残差）：
 *   ⟨sign⟩(β) = Z(κ)/Z(−κ) = Σ_i e^{−βE_i} / Σ_j e^{−βĒ_j}
 *             = e^{−βΔE₀} · R(β)，
 *   ΔE₀ = E₀(κ) − Ē₀(−κ)，R(β) = (Σ_i e^{−β(E_i−E₀)})/(Σ_j e^{−β(Ē_j−Ē₀)})。
 * 渐近线 e^{−βΔE₀} 的误差由此精确展开：
 *   R(β) − 1 = [Σ_{i≥1} e^{−β(E_i−E₀)} − Σ_{j≥1} e^{−β(Ē_j−Ē₀)}] / (1 + Σ_{j≥1} e^{−β(Ē_j−Ē₀)})
 * —— 分子是两条谱的激发态枚举之差（"激发态-影子贡献"，dim ≤ 2^10 内逐项
 * 可枚举），分母只含影子谱。排序谱给出可枚举上界：
 *   |R(β) − 1| ≤ Σ_{i≥1} e^{−β(E_i−E₀)} + Σ_{j≥1} e^{−β(Ē_j−Ē₀)}
 *             ≤ (dim−1)·(e^{−β·g₊} + e^{−β·g₋})，g± = 各谱首隙。
 *
 * 三条机器证词，分工诚实：
 *   1. 谱和比（Jacobi 全谱 + 指数和）——EXACT 裁判。双锚定：与 SSE
 *      全枚举在 β=0.25 吻合到 1e-10（n=2）；与"片矩阵 U 本征分解的
 *      Tr(U^M)"在 β=2 吻合到 1e-10（E_trot ≡ E_Jacobi 逐位一致）。
 *   2. 矩阵 Trotter 精确 Z 比（exact-ratio.ts，冻结不动）——小 β 交叉
 *      证词。诚实边界：其矩阵平方路径在 β 增大时数值漂移（n=2 实测：
 *      β=0.25 偏 4e-4 —— 与仓内 sse.test 的 2e-3 纪律一致；β=2 偏
 *      7.5e-2，且不随片数收敛）。本模块不把它当大 β 裁判，只在
 *      trotterResidual 字段如实披露。
 *   3. 虚时投影基态能（project.ts）—— E₀(κ) 与 Ē₀(−κ) 的独立来源
 *      （残差 ~1e-4..5e-3，投影自身 Δτ² 纪律）。
 * 零残差见证 = 同一组数的两条独立浮点路径（未平移的 Z 比 vs 平移后
 * e^{−βΔE₀}·R；R−1 vs 闭式激发差展开）之差，量级在 1e-16。
 *
 * 审判面：auditSignLawTable 按 NonstoqError 码击毙表行——渐近线冒充
 * 精确值（CertificateVerificationFailed）、篡改值（同码）、找不到对应
 * 数据行（ReportRowMissing）、稠密裁判超上限（DenseRefereeCap）。
 */
import { NonstoqError } from "../core/errors.js";
import { jacobiEigenvalues } from "../core/jacobi.js";
import type { XSpectrum, ZSpectrum } from "../core/spectra.js";
import { projectGroundState } from "../anneal/project.js";
import { exactSignRatio } from "./exact-ratio.js";

/** 稠密裁判上限：2^n × 2^n Jacobi 对角化，n = 10（dim = 1024）为止。 */
const DENSE_CAP = 10;

function popcountParity(x: number): number {
  let p = 1;
  let v = x;
  while (v) {
    p = -p;
    v &= v - 1;
  }
  return p;
}

/**
 * H(s) = (1−s)·H_D − s·C 的计算基稠密矩阵。H_D 在 X 基对角（表
 * xEnergies），经 Walsh-Hadamard 变到 Z 基：H_D[a][b] = f[a^b]/dim，
 * f[c] = Σ_t (−1)^{popcount(c&t)}·xE[t]（与 exact-ratio.ts 同一布局，
 * 那里 signs = e^{−Δτ·…}，这里直接用能量表）。
 */
export function denseH(n: number, energies: ZSpectrum, xEnergies: XSpectrum, s: number): number[][] {
  const dim = 1 << n;
  const f = new Float64Array(dim);
  for (let c = 0; c < dim; c++) {
    let acc = 0;
    for (let t = 0; t < dim; t++) acc += popcountParity(c & t) * xEnergies[t]!;
    f[c] = acc;
  }
  const H: number[][] = [];
  for (let a = 0; a < dim; a++) {
    const row = new Array<number>(dim);
    for (let b = 0; b < dim; b++) {
      row[b] = (a === b ? -s * energies[a]! : 0) + (1 - s) * (f[a ^ b]! / dim);
    }
    H.push(row);
  }
  return H;
}

export interface BetaLawSpectra {
  readonly n: number;
  readonly dim: number;
  readonly s: number;
  /** H(κ) 全谱（升序，Jacobi） */
  readonly plus: readonly number[];
  /** H(−κ) 影子全谱（升序） */
  readonly minus: readonly number[];
  /** ΔE₀ = E₀(κ) − Ē₀(−κ) ≥ 0 —— 影子不劣（Perron-Frobenius 侧） */
  readonly deltaE0: number;
  readonly gapPlus: number;
  readonly gapMinus: number;
  /** 虚时投影的第三证词：|E₀^proj − E₀^Jacobi| 的最大值（两条谱） */
  readonly projectionResidual: number;
}

/** 全谱 + 基态交叉证词（Jacobi vs 虚时投影）。 */
export function betaLawSpectra(
  n: number,
  energies: ZSpectrum,
  xPlus: XSpectrum,
  xMinus: XSpectrum,
  s: number,
): BetaLawSpectra {
  guardInputs(n, energies, xPlus, xMinus, s, 1);
  const plus = jacobiEigenvalues(denseH(n, energies, xPlus, s));
  const minus = jacobiEigenvalues(denseH(n, energies, xMinus, s));
  const projPlus = projectGroundState(n, energies, xPlus, s).energy;
  const projMinus = projectGroundState(n, energies, xMinus, s).energy;
  const projectionResidual = Math.max(Math.abs(projPlus - plus[0]!), Math.abs(projMinus - minus[0]!));
  return {
    n,
    dim: 1 << n,
    s,
    plus,
    minus,
    deltaE0: plus[0]! - minus[0]!,
    gapPlus: plus.length > 1 ? plus[1]! - plus[0]! : Number.POSITIVE_INFINITY,
    gapMinus: minus.length > 1 ? minus[1]! - minus[0]! : Number.POSITIVE_INFINITY,
    projectionResidual,
  };
}

export interface BetaLawRow {
  readonly beta: number;
  /** 谱和比 Σe^{−βE}/Σe^{−βĒ}（未平移路径） */
  readonly signSpectral: number;
  /** 矩阵 Trotter 精确 Z 比（exact-ratio 裁判） */
  readonly signTrotter: number;
  /** 渐近线 e^{−βΔE₀} */
  readonly asymptote: number;
  /** R(β)（平移路径独立计算） */
  readonly R: number;
  /** 精确修正项 R(β) − 1 */
  readonly correction: number;
  /** 零残差见证 #1：|谱和比 − e^{−βΔE₀}·R|（同一组数的代数重排） */
  readonly identityResidual: number;
  /** 零残差见证 #2：|correction − 闭式激发差展开| */
  readonly correctionResidual: number;
  /** Trotter 交叉证词 vs 谱和比 —— 只作数据披露：矩阵平方路径在大 β 数值漂移（模块头注） */
  readonly trotterResidual: number;
  readonly excitedPlus: number;
  readonly excitedMinus: number;
  /** 可枚举上界 (dim−1)·(e^{−β·g₊} + e^{−β·g₋})；withinBound = |correction| ≤ bound */
  readonly correctionBound: number;
  readonly withinBound: boolean;
}

export interface BetaLawResult {
  readonly n: number;
  readonly s: number;
  readonly spectra: BetaLawSpectra;
  readonly rows: readonly BetaLawRow[];
}

/**
 * 有限 β 符号定律：对每个 β 给出全部证词与零残差见证。
 * betas 的每个元素必须 > 0 且有限（定律陈述的域）。
 */
export function betaLaw(
  n: number,
  energies: ZSpectrum,
  xPlus: XSpectrum,
  xMinus: XSpectrum,
  s: number,
  betas: readonly number[],
  log2Slices = 10,
): BetaLawResult {
  guardInputs(n, energies, xPlus, xMinus, s, betas.length);
  for (const b of betas) {
    if (!Number.isFinite(b) || b <= 0) {
      throw new NonstoqError(
        "CertificateVerificationFailed",
        `betaLaw: the law's statement requires finite beta > 0 (got ${b}) — the referee cannot re-verify a divergent row`,
      );
    }
  }
  const spectra = betaLawSpectra(n, energies, xPlus, xMinus, s);
  const rows: BetaLawRow[] = [];
  for (const beta of betas) {
    const zPlus = spectra.plus.reduce((acc, e) => acc + Math.exp(-beta * e), 0);
    const zMinus = spectra.minus.reduce((acc, e) => acc + Math.exp(-beta * e), 0);
    const signSpectral = zPlus / zMinus;
    // 平移路径：以各自基态能为原点重算（同一有理式的独立浮点表达式）
    const e0p = spectra.plus[0]!;
    const e0m = spectra.minus[0]!;
    const sp = spectra.plus.reduce((acc, e) => acc + Math.exp(-beta * (e - e0p)), 0);
    const sm = spectra.minus.reduce((acc, e) => acc + Math.exp(-beta * (e - e0m)), 0);
    const R = sp / sm;
    const asymptote = Math.exp(-beta * spectra.deltaE0);
    const excitedPlus = sp - 1;
    const excitedMinus = sm - 1;
    const correction = R - 1;
    const correctionClosed = (excitedPlus - excitedMinus) / (1 + excitedMinus);
    const signTrotter = exactSignRatio(n, energies, xPlus, xMinus, s, beta, log2Slices);
    const gp = Number.isFinite(spectra.gapPlus) ? spectra.gapPlus : 0;
    const gm = Number.isFinite(spectra.gapMinus) ? spectra.gapMinus : 0;
    const correctionBound = (spectra.dim - 1) * (Math.exp(-beta * gp) + Math.exp(-beta * gm));
    rows.push({
      beta,
      signSpectral,
      signTrotter,
      asymptote,
      R,
      correction,
      identityResidual: Math.abs(signSpectral - asymptote * R),
      correctionResidual: Math.abs(correction - correctionClosed),
      trotterResidual: Math.abs(signTrotter - signSpectral),
      excitedPlus,
      excitedMinus,
      correctionBound,
      withinBound: Math.abs(correction) <= correctionBound,
    });
  }
  return { n, s, spectra, rows };
}

// --- 表格审判面 -----------------------------------------------------------------------------

export type SignLawExactness = "EXACT" | "ASYMPTOTE";

export interface SignLawRow {
  readonly beta: number;
  readonly value: number;
  readonly exactness: SignLawExactness;
}

export interface SignLawTolerances {
  /** EXACT 行 vs 谱和裁判（恒等式零残差系于其上）的绝对容差（默认 1e-9） */
  readonly exactTol?: number;
  /** ASYMPTOTE 行 vs 渐近线的绝对容差（默认 1e-9） */
  readonly asymptoteTol?: number;
}

/**
 * 符号定律表审判：EXACT 行必须过谱和裁判（双锚定的 EXACT 来源）；ASYMPTOTE
 * 行必须等于渐近线 e^{−βΔE₀}。渐近线冒充精确值、篡改值、β 无对应数据行，
 * 全部按 NonstoqError 码击毙——走私审判按 code 定罪。
 */
export function auditSignLawTable(law: BetaLawResult, rows: readonly SignLawRow[], tolerances: SignLawTolerances = {}): void {
  const exactTol = tolerances.exactTol ?? 1e-9;
  const asymptoteTol = tolerances.asymptoteTol ?? 1e-9;
  for (const row of rows) {
    const ref = law.rows.find((r) => r.beta === row.beta);
    if (ref === undefined) {
      throw new NonstoqError(
        "ReportRowMissing",
        `auditSignLawTable: no beta=${row.beta} row in the beta-law data (betas: ${law.rows.map((r) => r.beta).join(", ")})`,
      );
    }
    if (!Number.isFinite(row.value)) {
      throw new NonstoqError(
        "CertificateVerificationFailed",
        `auditSignLawTable: beta=${row.beta} row carries a non-finite value (${row.value})`,
      );
    }
    if (row.exactness === "EXACT") {
      const gap = Math.abs(row.value - ref.signSpectral);
      if (gap > exactTol) {
        throw new NonstoqError(
          "CertificateVerificationFailed",
          `auditSignLawTable: beta=${row.beta} row claims EXACT ${row.value.toPrecision(10)} but the spectral referee says ${ref.signSpectral.toPrecision(10)} (gap ${gap.toExponential(3)} > ${exactTol.toExponential(2)}) — the asymptote e^{-beta*DeltaE0} = ${ref.asymptote.toPrecision(10)} is NOT the exact value at finite beta (correction R-1 = ${ref.correction.toExponential(3)})`,
        );
      }
    } else {
      const gap = Math.abs(row.value - ref.asymptote);
      if (gap > asymptoteTol) {
        throw new NonstoqError(
          "CertificateVerificationFailed",
          `auditSignLawTable: beta=${row.beta} ASYMPTOTE row value ${row.value.toPrecision(10)} differs from e^{-beta*DeltaE0} = ${ref.asymptote.toPrecision(10)} (gap ${gap.toExponential(3)})`,
        );
      }
    }
  }
}

// --- 输入守卫 ---------------------------------------------------------------------------------

function guardInputs(
  n: number,
  energies: ZSpectrum,
  xPlus: XSpectrum,
  xMinus: XSpectrum,
  s: number,
  minBetas: number,
): void {
  if (!Number.isInteger(n) || n < 1 || n > DENSE_CAP) {
    throw new NonstoqError("DenseRefereeCap", `betaLaw: dense 2^n referee capped at n = ${DENSE_CAP} (got n=${n})`);
  }
  const dim = 1 << n;
  if (energies.length !== dim || xPlus.length !== dim || xMinus.length !== dim) {
    throw new NonstoqError(
      "CertificateVerificationFailed",
      `betaLaw: spectrum tables must all have length 2^n = ${dim} (got ${energies.length}/${xPlus.length}/${xMinus.length}) — the certificate failed re-verification`,
    );
  }
  if (!Number.isFinite(s) || s < 0 || s > 1) {
    throw new NonstoqError(
      "CertificateVerificationFailed",
      `betaLaw: the anneal path requires s in [0,1] (got ${s}) — the certificate failed re-verification`,
    );
  }
  if (minBetas < 1) {
    throw new NonstoqError(
      "CertificateVerificationFailed",
      "betaLaw: at least one beta is required — a law of no rows verifies nothing",
    );
  }
}
