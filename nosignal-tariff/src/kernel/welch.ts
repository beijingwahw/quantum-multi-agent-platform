/**
 * Kernel — the Welch-bound SIC exclusion certificate (v0.5.0): the
 * tetrahedral family is closed; a fifth constant-overlap payer cannot exist.
 *
 * T8 enrolled the tetrahedral SIC axes as the beyond-Pauli payer: four qubit
 * rays with pairwise |<psi_i|psi_j>|^2 = 1/3. This file proves the closure
 * as a machine theorem, in exact arithmetic throughout:
 *
 *   Lemma (2x2 Hermitian SOS identity — certified on a 625-point rational
 *   grid below). For every 2x2 Hermitian M = [[A, B], [conj B, D]] with real
 *   A, D and B = X + iY:
 *       2 Tr M^2 - (Tr M)^2 = (A - D)^2 + 4 (X^2 + Y^2).
 *   The right side is a sum of real squares, hence >= 0 in any ordered field
 *   (the one axiom-level fact this certificate cites). The identity itself
 *   is machine-certified: the difference of the two sides has degree <= 2 in
 *   each of A, D, X, Y and is verified to vanish on the full product grid
 *   {-2, -1, 0, 1, 2}^4 in exact BigInt rational arithmetic; a polynomial
 *   whose degree in each variable is below the grid side cannot vanish on
 *   the whole grid without being identically zero (per-variable root
 *   counting), so the identity holds for ALL real A, D, X, Y.
 *
 *   Exclusion (the SIC claim, n = 5, c = 1/3 — falsifiable margin 5/6).
 *   Suppose phi_1..phi_5 are unit vectors in C^2 with pairwise overlaps
 *   |<phi_i|phi_j>|^2 = 1/3. Their frame operator M = sum_i |phi_i><phi_i|
 *   is 2x2 Hermitian with entries M_ij = <phi_i|phi_j>, so
 *       Tr M   = sum_i <phi_i|phi_i> = 5,
 *       Tr M^2 = sum_ij |M_ij|^2     = 5 + 2*C(5,2)*(1/3) = 35/3
 *   (the second line is the Hermitian entry form Tr M^2 = sum_ij |M_ij|^2,
 *   covered by the same grid certificate). The Lemma forces
 *   2*(35/3) - 25 >= 0; the exact rational comparison says it is -5/3 < 0.
 *   Contradiction — the five rays do not exist. In Welch form: the total
 *   overlap sum 35/3 falls below the Welch bound n^2/d = 25/2 (70 < 75 by
 *   cross-multiplication; the bound statement is Welch-1974-lower bounds on
 *   the maximum cross correlation of signals, cited, double-source pending —
 *   here EXECUTED at d = 2 rather than quoted).
 *
 *   Saturation (n = 4 — the positive control, Welch equality). The
 *   tetrahedron's own rays are explicit vectors over Q(i, sqrt3) (below):
 *   every pairwise overlap is exactly 1/3, the total is 8 = 16/2, the
 *   Lemma's defect is exactly 0 with BOTH squares individually 0, and the
 *   frame operator is exactly 2I — the tight-frame identity
 *   sum_i |psi_i><psi_i| = (n/d) I. A qubit SIC is a saturated Welch case:
 *   it sits ON the bound, which is exactly why the family cannot grow.
 *
 *   Direct route (sharper: one ray suffices). Since the machine certifies
 *   M = 2I, every vector varphi obeys
 *       sum_i |<varphi|psi_i>|^2 = <varphi| 2I |varphi> = 2 ||varphi||^2
 *   (executed exactly on rational and Q(sqrt3) test vectors — individual
 *   terms may be irrational in Q(sqrt3), the sum is exactly 2). A fifth ray
 *   at constant overlap 1/3 would force the sum to 4/3 != 2: not even ONE
 *   ray extends the family at 1/3.
 *
 * Honest boundaries. The certificate adjudicates CONSTANT-overlap
 * (equiangular) families only — a non-equiangular five-family can satisfy
 * Welch without contradiction and the constant-overlap gate refuses to
 * certify it (the smuggling trials). The engine is the qubit case d = 2 (the
 * SOS identity is 2x2); general-d Welch stays a citation. Overlaps outside
 * the constant family (MUB-style c = 1/2, or c >= 3/8 where five lines are
 * not excluded by this bound) are out of scope. The tetrahedral SIC's own
 * provenance is classical: SIC-POVMs as symmetric informationally complete
 * measurements (Renes-Blume-Kohout-Scott-Grassl-2004, cited, double-source
 * pending). No arXiv id, DOI, or volume is quoted from memory for either
 * citation.
 */

import { refuse } from "../core/errors.js";
import {
  type Frac,
  F_ONE,
  F_ZERO,
  fAdd,
  fCmp,
  fDecimal,
  fDiv,
  fMul,
  fSub,
  fr,
} from "./rational.js";

// --- Q(sqrt3) with complex limbs: the tetrahedron's exact home ---------------

/** a + b*sqrt(3), limbs exact unreduced rationals (comparisons cross-multiply). */
export interface S3 {
  readonly a: Frac;
  readonly b: Frac;
}

const s3Of = (a: bigint | number, b: bigint | number = 0): S3 => ({
  a: fr(a),
  b: fr(b),
});
const s3Add = (x: S3, y: S3): S3 => ({ a: fAdd(x.a, y.a), b: fAdd(x.b, y.b) });
const s3Sub = (x: S3, y: S3): S3 => ({ a: fSub(x.a, y.a), b: fSub(x.b, y.b) });
const s3Mul = (x: S3, y: S3): S3 => ({
  a: fAdd(fMul(x.a, y.a), fMul(fr(3), fMul(x.b, y.b))),
  b: fAdd(fMul(x.a, y.b), fMul(x.b, y.a)),
});
const s3IsZero = (x: S3): boolean => x.a.n === 0n && x.b.n === 0n;

/** x/y in Q(sqrt3): 1/(a + b s) = (a - b s)/(a^2 - 3 b^2), exact. */
function s3Div(x: S3, y: S3): S3 {
  const den = fSub(fMul(y.a, y.a), fMul(fr(3), fMul(y.b, y.b)));
  if (den.n === 0n)
    refuse(
      "WELCH_S3_INVERSE",
      "s3Div: a^2 - 3b^2 = 0 — the divisor has no inverse in Q(sqrt3)",
    );
  return {
    a: fDiv(fSub(fMul(x.a, y.a), fMul(fr(3), fMul(x.b, y.b))), den),
    b: fDiv(fSub(fMul(x.b, y.a), fMul(x.a, y.b)), den),
  };
}

/** Exact sign of a + b*sqrt(3) — decidable: when the limbs disagree, compare a^2 against 3b^2. */
export function s3Sign(x: S3): number {
  if (x.a.n === 0n && x.b.n === 0n) return 0;
  if (x.a.n === 0n) return x.b.n < 0n ? -1 : 1;
  if (x.b.n === 0n) return x.a.n < 0n ? -1 : 1;
  const aNeg = x.a.n < 0n;
  const bNeg = x.b.n < 0n;
  if (aNeg === bNeg) return aNeg ? -1 : 1;
  const c = fCmp(fMul(x.a, x.a), fMul(fr(3), fMul(x.b, x.b)));
  if (c === 0) return 0;
  return c > 0 ? (aNeg ? -1 : 1) : bNeg ? -1 : 1;
}

/** The rational value of a Q(sqrt3) element KNOWN to be rational (b = 0) — anything else is a named refusal. */
export function s3Rational(x: S3): Frac {
  if (x.b.n !== 0n)
    refuse(
      "WELCH_IRRATIONAL",
      `s3Rational: b != 0 — the value ${fDecimal(x.a, 6)} + ${fDecimal(x.b, 6)}*sqrt3 is not rational`,
    );
  return x.a;
}

/** Complex number over Q(sqrt3). */
export interface CS3 {
  readonly re: S3;
  readonly im: S3;
}

const csOf = (re: S3, im: S3 = s3Of(0)): CS3 => ({ re, im });
const csAdd = (u: CS3, v: CS3): CS3 => ({
  re: s3Add(u.re, v.re),
  im: s3Add(u.im, v.im),
});
const csMul = (u: CS3, v: CS3): CS3 => ({
  re: s3Sub(s3Mul(u.re, v.re), s3Mul(u.im, v.im)),
  im: s3Add(s3Mul(u.re, v.im), s3Mul(u.im, v.re)),
});
const csConj = (u: CS3): CS3 => ({ re: u.re, im: s3Sub(s3Of(0), u.im) });
const csNormSq = (u: CS3): S3 => s3Add(s3Mul(u.re, u.re), s3Mul(u.im, u.im));
const csScale = (u: CS3, s: S3): CS3 => ({
  re: s3Mul(u.re, s),
  im: s3Mul(u.im, s),
});

// --- 2x2 Hermitian matrices: the Welch engine at d = 2 ------------------------

/** Hermitian M = [[A, B], [conj B, D]], A/D real, B = X + iY. */
export interface H2 {
  readonly aa: S3;
  readonly bb: CS3;
  readonly dd: S3;
}

export function h2Trace(m: H2): S3 {
  return s3Add(m.aa, m.dd);
}

/** Tr M^2 in the Hermitian entry form A^2 + D^2 + 2|B|^2 = sum_ij |M_ij|^2 (grid-certified with the SOS identity). */
export function h2TrSq(m: H2): S3 {
  const b2 = csNormSq(m.bb);
  return s3Add(s3Add(s3Mul(m.aa, m.aa), b2), s3Add(b2, s3Mul(m.dd, m.dd)));
}

/** The Welch defect 2 Tr M^2 - (Tr M)^2 — a sum of real squares by the certified identity. */
export function h2WelchDefect(m: H2): S3 {
  const tr = h2Trace(m);
  return s3Sub(s3Add(h2TrSq(m), h2TrSq(m)), s3Mul(tr, tr));
}

export interface SosParts {
  /** (A - D)^2 */
  readonly diag: S3;
  /** 4 (X^2 + Y^2) */
  readonly off: S3;
}

/** The two real squares the defect decomposes into (the identity's right side). */
export function h2SosParts(m: H2): SosParts {
  const dsub = s3Sub(m.aa, m.dd);
  return { diag: s3Mul(dsub, dsub), off: s3Mul(s3Of(4), csNormSq(m.bb)) };
}

export interface GridCertificate {
  readonly side: readonly Frac[];
  readonly points: number;
  /** defect === diag + off on every grid point, exact */
  readonly sosIdentityHolds: boolean;
}

/** The 625-point certificate: on {-2..2}^4 (exact rationals) the SOS identity holds with zero residual everywhere. */
export function sosGridCertificate(): GridCertificate {
  const side = [-2, -1, 0, 1, 2].map((v) => fr(v));
  let points = 0;
  let holds = true;
  for (const A of side)
    for (const D of side)
      for (const X of side)
        for (const Y of side) {
          const m: H2 = {
            aa: { a: A, b: F_ZERO },
            bb: { re: { a: X, b: F_ZERO }, im: { a: Y, b: F_ZERO } },
            dd: { a: D, b: F_ZERO },
          };
          const parts = h2SosParts(m);
          if (!s3IsZero(s3Sub(h2WelchDefect(m), s3Add(parts.diag, parts.off))))
            holds = false;
          points++;
        }
  return { side, points, sosIdentityHolds: holds };
}

// --- the tetrahedral SIC kets over Q(i, sqrt3) --------------------------------

/** A raw (unnormalized) qubit ket, components in Q(i, sqrt3). */
export interface RawKet {
  readonly c0: CS3;
  readonly c1: CS3;
}

/** ||v||^2 = <v|v>, an S3. */
export function ketNormSq(v: RawKet): S3 {
  return s3Add(csNormSq(v.c0), csNormSq(v.c1));
}

/** <u|v> (conjugate-linear in u), a CS3. */
function ketBra(u: RawKet, v: RawKet): CS3 {
  return csAdd(csMul(csConj(u.c0), v.c0), csMul(csConj(u.c1), v.c1));
}

/** The scale-invariant overlap |<u|v>|^2 / (||u||^2 ||v||^2) as an S3 (may be irrational). */
function ketOverlapS3(u: RawKet, v: RawKet): S3 {
  return s3Div(csNormSq(ketBra(u, v)), s3Mul(ketNormSq(u), ketNormSq(v)));
}

/** The overlap as an exact rational — refuses by name when the value is not rational. */
export function ketOverlapSq(u: RawKet, v: RawKet): Frac {
  return s3Rational(ketOverlapS3(u, v));
}

/**
 * The tetrahedral SIC kets, raw: for a Bloch direction r = (x, y, z) the
 * state (1 + z, x + i y) scaled by sqrt(3) — components land in Q(i, sqrt3)
 * with norms 6 +/- 2*sqrt3, and every scale cancels in the overlaps below.
 * The four directions are the even-parity tetrahedron vertices
 * (1,1,1), (1,-1,-1), (-1,1,-1), (-1,-1,1), each / sqrt(3).
 */
export const TETRAHEDRON_RAW: readonly RawKet[] = [
  { c0: csOf(s3Of(1, 1)), c1: csOf(s3Of(1), s3Of(1)) }, // (sqrt3+1, 1+i)
  { c0: csOf(s3Of(-1, 1)), c1: csOf(s3Of(1), s3Of(-1)) }, // (sqrt3-1, 1-i)
  { c0: csOf(s3Of(-1, 1)), c1: csOf(s3Of(-1), s3Of(1)) }, // (sqrt3-1, -1+i)
  { c0: csOf(s3Of(1, 1)), c1: csOf(s3Of(-1), s3Of(-1)) }, // (sqrt3+1, -1-i)
];

/** The antipode of payer 1 (Bloch direction -(1,1,1)/sqrt3) — the smuggling trial's vehicle. */
export const ANTIPODE_RAW: RawKet = {
  c0: csOf(s3Of(-1, 1)),
  c1: csOf(s3Of(-1), s3Of(-1)),
}; // (sqrt3-1, -1-i)

/** |<psi_i|psi_j>|^2 for the tetrahedron, i/j in [0, 4). */
export function tetraOverlapSq(i: number, j: number): Frac {
  if (
    !Number.isInteger(i) ||
    !Number.isInteger(j) ||
    i < 0 ||
    i >= 4 ||
    j < 0 ||
    j >= 4
  )
    refuse(
      "WELCH_TETRA_INDEX",
      `tetraOverlapSq: indices must be integers in [0, 4) (got ${i}, ${j})`,
    );
  return ketOverlapSq(TETRAHEDRON_RAW[i]!, TETRAHEDRON_RAW[j]!);
}

/** The frame operator sum_i |psi_i><psi_i| built from the raw kets (S3 division, no square roots). */
export function tetraFrameOperator(): H2 {
  let aa = s3Of(0);
  let dd = s3Of(0);
  let bb = csOf(s3Of(0));
  for (const v of TETRAHEDRON_RAW) {
    const inv = s3Div(s3Of(1), ketNormSq(v));
    aa = s3Add(aa, s3Mul(csNormSq(v.c0), inv));
    dd = s3Add(dd, s3Mul(csNormSq(v.c1), inv));
    bb = csAdd(bb, csScale(csMul(v.c0, csConj(v.c1)), inv));
  }
  return { aa, bb, dd };
}

/** sum_ij |<psi_i|psi_j>|^2 over all 16 ordered pairs — the Gram path of the Welch total. */
export function tetraGramSum(): Frac {
  let acc = F_ZERO;
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) acc = fAdd(acc, tetraOverlapSq(i, j));
  return acc;
}

/** The four overlaps |<v|psi_i>|^2 (each must be rational — the trial's evidence). */
export function tetraOverlapsWith(v: RawKet): Frac[] {
  return TETRAHEDRON_RAW.map((psi) => ketOverlapSq(v, psi));
}

/** sum_i |<v|psi_i>|^2, summed in Q(sqrt3) THEN rationalized — the Bessel identity's left side (= 2 for every nonzero v). */
export function besselSum(v: RawKet): Frac {
  let acc = s3Of(0);
  for (const psi of TETRAHEDRON_RAW) acc = s3Add(acc, ketOverlapS3(v, psi));
  return s3Rational(acc);
}

// --- the exclusion -------------------------------------------------------------

export interface WelchExclusion {
  readonly n: number;
  readonly c: Frac;
  /** n + 2*C(n,2)*c — the total overlap sum of a constant-c family */
  readonly sumSq: Frac;
  /** n^2 / 2 — the Welch bound at d = 2 */
  readonly bound: Frac;
  /** bound - sumSq (> 0 iff excluded) */
  readonly margin: Frac;
  /** 2*sumSq - n^2 — the frame-operator form the SOS identity forbids to go negative */
  readonly frameDefect: Frac;
  readonly excluded: boolean;
}

/**
 * The Welch exclusion at d = 2 for a CONSTANT pairwise overlap c: excluded
 * iff sum_ij |<ij>|^2 < n^2/2, which the SOS identity forbids. The verdict
 * is honest only under the constant-c hypothesis — the applicant's overlaps
 * must pass assertConstantOverlap first (the smuggling gate).
 */
export function welchExclusionQubit(n: number, c: Frac): WelchExclusion {
  if (!Number.isInteger(n) || n < 2)
    refuse(
      "WELCH_N_RANGE",
      `welchExclusionQubit: n must be an integer >= 2 (got ${n})`,
    );
  if (fCmp(c, F_ZERO) < 0 || fCmp(c, F_ONE) > 0)
    refuse(
      "WELCH_C_RANGE",
      "welchExclusionQubit: the claimed constant c must lie in [0, 1]",
    );
  const pairs = (n * (n - 1)) / 2;
  const sumSq = fAdd(fr(n), fMul(fr(2 * pairs), c));
  const bound = fr(n * n, 2);
  const margin = fSub(bound, sumSq);
  return {
    n,
    c,
    sumSq,
    bound,
    margin,
    frameDefect: fSub(fMul(fr(2), sumSq), fr(n * n)),
    excluded: fCmp(margin, F_ZERO) > 0,
  };
}

/** The certificate's own verdict for the SIC claim: (n = 5, c = 1/3). */
export function sicExclusionCertificate(): WelchExclusion {
  return welchExclusionQubit(5, fr(1, 3));
}

/**
 * The constant-overlap gate: the exclusion certificate adjudicates only
 * equiangular claims. The applicant hands in the MEASURED pairwise overlaps
 * and the claimed constant; any mismatch is a named refusal — a
 * non-equiangular family can satisfy Welch without contradiction and must
 * not be smuggled through the exclusion.
 */
export function assertConstantOverlap(
  overlaps: readonly Frac[],
  claimed: Frac,
  label: string,
): void {
  for (let i = 0; i < overlaps.length; i++) {
    if (fCmp(overlaps[i]!, claimed) !== 0)
      refuse(
        "WELCH_NOT_EQUIANGULAR",
        `assertConstantOverlap: ${label} — pair ${i} measures ${fDecimal(overlaps[i]!, 6)} != claimed ${fDecimal(claimed, 6)}; the exclusion certificate adjudicates constant-overlap families only`,
      );
  }
}
