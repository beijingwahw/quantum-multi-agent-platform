/**
 * 影子首隙排序普查（G3-b，v0.6 的新定理面）——研究级猜想面的机器裁决。
 *
 * 猜想（可证伪）：非 stoquastic 谱 H(κ) 的首隙 g₊ 与其影子谱 H(−κ) 的
 * 首隙 g₋ 之间是否存在普适排序定律？候选方向来自 beta-law 的可枚举上界
 *   |R(β) − 1| ≤ (dim−1)·(e^{−β·g₊} + e^{−β·g₋})：
 * 若 g₋ ≥ g₊ 恒立，影子项 e^{−β·g₋} 永不 binding，上界的紧度刻画只由
 * 原谱决定。机器普查（(n ≤ 8) × s × κ × seed 网格，betaLawSpectra 单源）
 * 裁决：**不存在普适排序定律**——影子可以比原谱更稀疏（g₊ > g₋ 的反例
 * 行存在，即"发现"），此时上界的影子项在一切 β > 0 处 binding；同时
 * 影子占优（g₋ > g₊）是压倒性的主流方向（普查统计见 census 字段）。
 * 基态侧不受影响：普查内 ΔE₀ = E₀(κ) − Ē₀(−κ) ≥ 0 零违反（影子基态
 * 不劣，Perron-Frobenius 侧）——首隙排序与基态排序是两个独立命题。
 *
 * 反例刻画（实测，全部聚在晚退火段 s = 0.75）：ratio = g₊/g₋ ∈
 * [1.025, 1.342]；最大者 n=7、κ=0.5（影子首隙比原谱窄 25%）。
 *
 * 审判面：auditOrderingClaim——把"影子首隙永不更小"猜想说成定律
 * （CertificateVerificationFailed，附反例计数与首个重验证反例）；
 * "无普适定律"的发现声明必须携带可重验证的见证行（缺见证、篡改数字、
 * 张冠李戴的见证行、普查外数据行，分别按 code 击毙；见证行同时对
 * betaLawSpectra 的现场重算负责，不只对普查表负责）。
 */
import { NonstoqError } from "../core/errors.js";
import { Rng } from "../core/rng.js";
import { energies, randomIsing } from "../core/ising.js";
import { xBasisEnergies } from "../anneal/driver.js";
import { betaLawSpectra } from "./beta-law.js";

/** 普查网格：缺省即定理陈述所系的网格（n 2..8 × s × κ × seed）。 */
export interface ShadowGapGrid {
  readonly ns: readonly number[];
  readonly ss: readonly number[];
  readonly kappas: readonly number[];
  readonly seeds: readonly number[];
}

/** 缺省网格：252 行（7 尺寸 × 3 退火点 × 4 耦合 × 3 种子），全确定性。 */
export const DEFAULT_SHADOW_GAP_GRID: ShadowGapGrid = {
  ns: [2, 3, 4, 5, 6, 7, 8],
  ss: [0.25, 0.5, 0.75],
  kappas: [0.2, 0.5, 0.8, 1.2],
  seeds: [31, 77, 911],
};

/** 一行的首隙排序：g₋ 与 g₊ 逐行机器判决（相对容差 1e-12 内记退化）。 */
export type GapOrdering = "shadow-larger" | "plus-larger" | "degenerate";

export interface ShadowGapRow {
  readonly n: number;
  readonly s: number;
  readonly kappa: number;
  readonly seed: number;
  /** g₊ = H(κ) 谱的 E₁ − E₀（betaLawSpectra 单源） */
  readonly gapPlus: number;
  /** g₋ = 影子谱 H(−κ) 的 E₁ − E₀ */
  readonly gapMinus: number;
  /** g₊/g₋（发现强度：> 1 即影子更稀疏） */
  readonly ratio: number;
  readonly ordering: GapOrdering;
  /** ΔE₀ = E₀(κ) − Ē₀(−κ)（≥ 0 侧的逐行数据） */
  readonly deltaE0: number;
}

export interface ShadowGapCensus {
  readonly rows: readonly ShadowGapRow[];
  readonly total: number;
  readonly shadowLarger: number;
  readonly plusLarger: number;
  readonly degenerate: number;
  /** ΔE₀ < −1e-9 的行数（普查内预期 0） */
  readonly deltaE0Violations: number;
  /** plus-larger 行中最大的 g₊/g₋（最稀疏的影子） */
  readonly worstRatio: number;
  readonly verdict: "NO-UNIVERSAL-ORDERING";
}

/** 现场重算一行谱（模型由 seed 决定，全确定性）。 */
function spectraOf(n: number, kappa: number, seed: number, s: number) {
  const model = randomIsing(new Rng(seed), n);
  const e = energies(model);
  const xp = xBasisEnergies(n, {
    gamma: 1,
    couplings: model.couplings.map((c) => ({ j: c.j, k: c.k, w: kappa })),
  });
  const xm = xBasisEnergies(n, {
    gamma: 1,
    couplings: model.couplings.map((c) => ({ j: c.j, k: c.k, w: -kappa })),
  });
  return betaLawSpectra(n, e, xp, xm, s);
}

function rowOf(
  n: number,
  kappa: number,
  seed: number,
  s: number,
): ShadowGapRow {
  const spec = spectraOf(n, kappa, seed, s);
  const tol =
    1e-12 * Math.max(1, Math.abs(spec.gapPlus), Math.abs(spec.gapMinus));
  const ordering: GapOrdering =
    Math.abs(spec.gapMinus - spec.gapPlus) <= tol
      ? "degenerate"
      : spec.gapMinus > spec.gapPlus
        ? "shadow-larger"
        : "plus-larger";
  return {
    n,
    s,
    kappa,
    seed,
    gapPlus: spec.gapPlus,
    gapMinus: spec.gapMinus,
    ratio: spec.gapPlus / spec.gapMinus,
    ordering,
    deltaE0: spec.deltaE0,
  };
}

/** 影子首隙排序普查：全网格逐行机器判决＋统计＋发现行收集。 */
export function shadowGapCensus(
  grid: Partial<ShadowGapGrid> = {},
): ShadowGapCensus {
  const ns = grid.ns ?? DEFAULT_SHADOW_GAP_GRID.ns;
  const ss = grid.ss ?? DEFAULT_SHADOW_GAP_GRID.ss;
  const kappas = grid.kappas ?? DEFAULT_SHADOW_GAP_GRID.kappas;
  const seeds = grid.seeds ?? DEFAULT_SHADOW_GAP_GRID.seeds;
  if (ns.length < 1 || ss.length < 1 || kappas.length < 1 || seeds.length < 1) {
    throw new NonstoqError(
      "CertificateVerificationFailed",
      "shadowGapCensus: an empty grid axis verifies nothing (every axis needs at least one value)",
    );
  }
  const rows: ShadowGapRow[] = [];
  let shadowLarger = 0;
  let plusLarger = 0;
  let degenerate = 0;
  let deltaE0Violations = 0;
  let worstRatio = 1;
  for (const n of ns) {
    for (const s of ss) {
      for (const kappa of kappas) {
        for (const seed of seeds) {
          const row = rowOf(n, kappa, seed, s);
          rows.push(row);
          if (row.ordering === "shadow-larger") shadowLarger++;
          else if (row.ordering === "plus-larger") {
            plusLarger++;
            worstRatio = Math.max(worstRatio, row.ratio);
          } else degenerate++;
          if (row.deltaE0 < -1e-9) deltaE0Violations++;
        }
      }
    }
  }
  return {
    rows,
    total: rows.length,
    shadowLarger,
    plusLarger,
    degenerate,
    deltaE0Violations,
    worstRatio,
    verdict: "NO-UNIVERSAL-ORDERING",
  };
}

// --- 排序声明审判面 -----------------------------------------------------------------------------

/** 发现见证行：声明"该 (n, s, κ, seed) 处影子更稀疏"，数字须过现场重算。 */
export interface OrderingWitness {
  readonly n: number;
  readonly s: number;
  readonly kappa: number;
  readonly seed: number;
  readonly gapPlus: number;
  readonly gapMinus: number;
}

export interface OrderingClaim {
  readonly claimed: "shadow-gap-never-smaller" | "no-universal-law";
  readonly witnesses: readonly OrderingWitness[];
}

/**
 * 排序声明审判：猜想面与发现面各按其可验证形态受审。
 *  - "shadow-gap-never-smaller"：普查有反例 ⟹ CertificateVerificationFailed
 *    （罪名携带反例计数与首个反例的现场重验证）；
 *  - "no-universal-law"：必须携带 ≥ 1 个见证行；每个见证行要（按序）过
 *    普查行匹配（ReportRowMissing）、数字吻合（CertificateVerificationFailed，
 *    1e-9）、影子确实更稀疏（CertificateVerificationFailed，张冠李戴）、
 *    以及 betaLawSpectra 现场重算（InternalNoGoReverifyFailed——内部
 *    不变量破坏，不是声明方的错）。
 */
export function auditOrderingClaim(
  census: ShadowGapCensus,
  claim: OrderingClaim,
): void {
  if (claim.claimed === "shadow-gap-never-smaller") {
    if (census.plusLarger === 0) {
      throw new NonstoqError(
        "InternalNoGoReverifyFailed",
        `auditOrderingClaim: the conjecture is marked refuted but this census carries zero plus-larger rows — the verdict invariant is broken`,
      );
    }
    const ce = census.rows.find((r) => r.ordering === "plus-larger")!;
    const live = spectraOf(ce.n, ce.kappa, ce.seed, ce.s);
    if (!(live.gapPlus > live.gapMinus)) {
      throw new NonstoqError(
        "InternalNoGoReverifyFailed",
        `auditOrderingClaim: the recorded counterexample (n=${ce.n}, s=${ce.s}, kappa=${ce.kappa}, seed=${ce.seed}) does not re-verify (live g+ = ${live.gapPlus}, g- = ${live.gapMinus})`,
      );
    }
    throw new NonstoqError(
      "CertificateVerificationFailed",
      `auditOrderingClaim: 'shadow-gap-never-smaller' is REFUTED by ${census.plusLarger} census rows — first witness (n=${ce.n}, s=${ce.s}, kappa=${ce.kappa}, seed=${ce.seed}) re-verified live: g+ = ${ce.gapPlus.toPrecision(10)} > g- = ${ce.gapMinus.toPrecision(10)} (ratio ${ce.ratio.toPrecision(6)}) — the shadow spectrum can be the sparser one`,
    );
  }
  // "no-universal-law": a discovery claim must carry verifiable witnesses
  if (claim.witnesses.length < 1) {
    throw new NonstoqError(
      "CertificateVerificationFailed",
      "auditOrderingClaim: a no-universal-law claim without witnesses verifies nothing",
    );
  }
  for (const w of claim.witnesses) {
    const row = census.rows.find(
      (r) =>
        r.n === w.n && r.s === w.s && r.kappa === w.kappa && r.seed === w.seed,
    );
    if (row === undefined) {
      throw new NonstoqError(
        "ReportRowMissing",
        `auditOrderingClaim: witness (n=${w.n}, s=${w.s}, kappa=${w.kappa}, seed=${w.seed}) has no census row`,
      );
    }
    if (
      Math.abs(w.gapPlus - row.gapPlus) > 1e-9 ||
      Math.abs(w.gapMinus - row.gapMinus) > 1e-9
    ) {
      throw new NonstoqError(
        "CertificateVerificationFailed",
        `auditOrderingClaim: witness (n=${w.n}, s=${w.s}, kappa=${w.kappa}, seed=${w.seed}) carries tampered numbers (claims g+ = ${w.gapPlus}, g- = ${w.gapMinus}; the census row says ${row.gapPlus}, ${row.gapMinus})`,
      );
    }
    if (row.ordering !== "plus-larger") {
      throw new NonstoqError(
        "CertificateVerificationFailed",
        `auditOrderingClaim: witness (n=${w.n}, s=${w.s}, kappa=${w.kappa}, seed=${w.seed}) is mislabelled — that row has ordering '${row.ordering}', not a sparser shadow`,
      );
    }
    const live = spectraOf(w.n, w.kappa, w.seed, w.s);
    if (
      Math.abs(live.gapPlus - w.gapPlus) > 1e-9 ||
      Math.abs(live.gapMinus - w.gapMinus) > 1e-9
    ) {
      throw new NonstoqError(
        "InternalNoGoReverifyFailed",
        `auditOrderingClaim: witness (n=${w.n}, s=${w.s}, kappa=${w.kappa}, seed=${w.seed}) disagrees with the live betaLawSpectra recomputation (${live.gapPlus}, ${live.gapMinus}) — an internal invariant is broken, not the claim`,
      );
    }
    if (!(live.gapPlus > live.gapMinus)) {
      throw new NonstoqError(
        "InternalNoGoReverifyFailed",
        `auditOrderingClaim: witness (n=${w.n}, s=${w.s}, kappa=${w.kappa}, seed=${w.seed}) does not re-verify as a sparser shadow (live g+ = ${live.gapPlus}, g- = ${live.gapMinus}) — an internal invariant is broken, not the claim`,
      );
    }
  }
}
