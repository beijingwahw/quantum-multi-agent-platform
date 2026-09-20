/**
 * The k=4 face of the wall — twenty-four orders, the S4 character table, and
 * the weak-readout closed form — v0.6.0's upgrade face.
 *
 * Four completely depolarizing qubit boxes switched over the 24 permutations
 * of S4, control in the uniform superposition |u24>, binary computational-
 * basis ensemble, joint receiver (the F1/F3 discipline lifted one order up).
 * The environment-traced joint state on control(c) S(2) — 48 dimensions — is
 *     rho(c) = sum_{pi,sigma} [c/24 |pi><sigma| + (1-c)/24 delta |pi><pi|]
 *              (x) T_{pi,sigma}(rho_in),   T_{pi,sigma} = Tr_E(W_pi rho_in W_sigma^dagger).
 *
 * THE TASK SHEET'S FIRST READING WAS FALSIFIED (spec-as-assumption, R19 law
 * 11): T_tau is NOT a function of the conjugacy class — the 24 coefficients
 * take different values inside one class (max intra-class deviation 0.09375;
 * two 3-cycles carry a = 1/8 while three others carry 1/32). What IS true,
 * and what this module certifies:
 *
 *   THEOREM (machine, exact):
 *   (1) LEFT invariance — T_{pi,sigma} depends only on the group element
 *       pi^-1 sigma (identical channels; relabeling conjugates the pair), so
 *       rho's coefficients form a GROUP CIRCULANT: rho[(g pi),(g sigma)] =
 *       rho[(pi),(sigma)] entrywise-exact for every g. This is what makes the
 *       spectrum a function of the representation theory, not of the 576 pairs.
 *   (2) The coefficient table: for the ensemble-average input I/2 the 24
 *       coefficients are SCALARS a_tau (X/Z covariance of the depolarizing
 *       dilation: V U = (U (x) U (x) U)V for U in {X, Z}); for the member
 *       inputs |0><0| they are diag(x_tau, a_tau - x_tau). All 48 numbers are
 *       exact dyadic rationals; the table-built operator equals the direct
 *       576-pair build to 1e-12.
 *   (3) The S4 character table (5 classes 1/6/3/8/6, irreps 1, 1', 2, 3, 3')
 *       passes the orthogonality relations and the regular-character law —
 *       the machine owns the table before using it.
 *   (4) The isotypic block traces are EXACT: {trivial 7/32, sign 0, 2-dim
 *       1/8, standard 3/8, standard(x)sign 9/32} for BOTH input families —
 *       in particular the sign isotypic component carries exactly ZERO
 *       weight: the depolarizing switch is blind to the alternating
 *       character.
 *   (5) chi4(1) = [0,0] exact: at zero coherence every eigenvalue is exactly
 *       1/48 (the operator is diag(1/48), a dyadic equality).
 *
 *   MACHINE-ENUMERATED (the spectral class table; float-pinned, each block's
 *   eigenvalues exact where rational, algebraic where the cubic/quadratic
 *   says so): the 48x48 problem reduces along the isotypic decomposition to
 *   blocks of size 2 dim(R)^2, each block's distinct eigenvalues appearing
 *   with multiplicity exactly dim(R) — the character table labels the blocks
 *   and predicts the degeneracy law. The pooled blocks reconstruct the full
 *   spectrum to 1e-14. The average spectrum is
 *       {0 x2, 1/128 x10, alpha x12, 3/128 x10, beta x12, 7/64 x2},
 *   alpha and beta the algebraic pair with EXACT sum alpha + beta = 5/128
 *   (from the exact standard-block trace minus the rational middle root) —
 *   the k=2 {n/8} and k=3 {n/48} rational-spectrum laws terminate at k=4:
 *   two of the 48 eigenvalues of each 3-dim block are cubic irrationals.
 *
 *   THE CERTIFICATE CARRIER (exact intervals): each float eigenvalue is
 *   bracketed by a rigorous rational enclosure — the eigensolver's own
 *   reconstruction certificate plus a Weyl budget for the dyadic-entry
 *   rounding (classical, one line, disclosed) — and the weak readout moves
 *   every eigenvalue affinely, eig(c) = c base + (1-c)/48 (verified as data
 *   against the operator at c in {0.9, 0.5, 0.37}, max deviation < 1e-15).
 *   chi4(lambda) is then an exact interval sum of entropy terms (f = -q
 *   log2 q is increasing on [0, 1/3] since 1/3 < 1/e — classical, disclosed;
 *   every bracket is machine-checked inside [0, 1/3)), and carries the SAME
 *   certificates as the other families: v0.2.0's grid checkers and v0.5.0's
 *   covering-partition subdivision (globalwall's engine, read-only reuse).
 *
 * Honest split:
 *   THEOREM: the circulant law, the coefficient table, the character table,
 *     the block traces, chi4(1) = 0, the grid and subdivision certificates
 *     over the bracketed spectra — exact rational comparisons throughout.
 *   DATA (verified, never certificated): the affine law at intermediate c,
 *     the float eigenvalues inside their brackets, the algebraic eigenvalues'
 *     rational pins, S(rho_0) = S(rho_1) (bit-flip covariance, dev 0.0).
 */
import {
  type CMat,
  mat,
  matEq,
  eigenvaluesHermitian,
  eigHermitian,
  reconstruct,
} from "../core/cmat.js";
import { refuse } from "../core/errors.js";
import { completelyDepolarizingKraus } from "../switch/chanlib.js";
import { krausToStinespring, type Stinespring } from "../switch/isometry.js";
import {
  type Frac,
  type Ivl,
  type LnPath,
  F_ONE,
  F_ZERO,
  fAdd,
  fCmp,
  fDiv,
  fMul,
  fSub,
  fr,
  iWidth,
  fTerm,
  LN_PATHS,
  PATH_T,
} from "./rational.js";
import {
  certifyStrictlyDecreasing,
  certifyConvexGrid,
  type StrictDecrResult,
  type ConvexResult,
} from "./theorem.js";
import {
  certifyAdaptiveDescent,
  certifyAdaptiveConvexity,
  MAX_DEPTH,
  type SubdivisionResult,
} from "./globalwall.js";

// --- S4: the group, its classes, its character table --------------------------------------------

export type Perm = readonly [number, number, number, number];

/** The 24 permutations, lexicographic in (a,b,c,d) — the module's canonical indexing. */
export const S4: readonly Perm[] = (() => {
  const out: Perm[] = [];
  for (let a = 0; a < 4; a++)
    for (let b = 0; b < 4; b++)
      for (let c = 0; c < 4; c++)
        for (let d = 0; d < 4; d++) {
          const seen = new Set([a, b, c, d]);
          if (seen.size === 4) out.push([a, b, c, d]);
        }
  return out;
})();

export const compose = (a: Perm, b: Perm): Perm => [
  a[b[0]]!,
  a[b[1]]!,
  a[b[2]]!,
  a[b[3]]!,
];
export const invert = (p: Perm): Perm => {
  const q = [0, 0, 0, 0] as [number, number, number, number];
  for (let i = 0; i < 4; i++) q[p[i]!] = i;
  return q;
};

export const indexOfPerm = (p: Perm): number =>
  S4.findIndex(
    (x) => x[0] === p[0] && x[1] === p[1] && x[2] === p[2] && x[3] === p[3],
  );

/** Cycle type key: "1^4", "2.1^2", "2^2", "3.1", "4" — the five classes. */
export function cycleType(p: Perm): string {
  const done = [false, false, false, false];
  const lens: number[] = [];
  for (let i = 0; i < 4; i++) {
    if (done[i]!) continue;
    let len = 0;
    let j = i;
    while (!done[j]!) {
      done[j] = true;
      j = p[j]!;
      len++;
    }
    lens.push(len);
  }
  lens.sort((x, y) => y - x);
  const counts = new Map<number, number>();
  for (const l of lens) counts.set(l, (counts.get(l) ?? 0) + 1);
  return [...counts.entries()]
    .sort((x, y) => y[0] - x[0])
    .map(([l, n]) => (n === 1 ? `${l}` : `${l}^${n}`))
    .join(".");
}

export const S4_CLASS_SIZES: Record<string, number> = {
  "1^4": 1,
  "2.1^2": 6,
  "2^2": 3,
  "3.1": 8,
  "4": 6,
};

export interface Irrep {
  readonly name: string;
  readonly dim: number;
  /** character per class key */
  readonly chi: Record<string, number>;
}

/** The character table of S4 — owned by the machine through orthogonality (below). */
export const S4_IRREPS: readonly Irrep[] = [
  {
    name: "trivial",
    dim: 1,
    chi: { "1^4": 1, "2.1^2": 1, "2^2": 1, "3.1": 1, "4": 1 },
  },
  {
    name: "sign",
    dim: 1,
    chi: { "1^4": 1, "2.1^2": -1, "2^2": 1, "3.1": 1, "4": -1 },
  },
  {
    name: "2-dim",
    dim: 2,
    chi: { "1^4": 2, "2.1^2": 0, "2^2": 2, "3.1": -1, "4": 0 },
  },
  {
    name: "standard",
    dim: 3,
    chi: { "1^4": 3, "2.1^2": 1, "2^2": -1, "3.1": 0, "4": -1 },
  },
  {
    name: "standard(x)sign",
    dim: 3,
    chi: { "1^4": 3, "2.1^2": -1, "2^2": -1, "3.1": 0, "4": 1 },
  },
];

export interface CharacterTableCert {
  /** sum_classes size chi chi = 24 for every row */
  readonly orthogonal: boolean;
  /** sum_R dim(R) chi_R = [24, 0, 0, 0, 0] — the regular character */
  readonly regularLaw: boolean;
  readonly sumDimSquared: number;
  readonly classSizesMatch: boolean;
}

/** Orthogonality certificate for the character table — exact integer arithmetic. */
export function characterTableCert(): CharacterTableCert {
  const classes = Object.keys(S4_CLASS_SIZES);
  let orthogonal = true;
  for (const R of S4_IRREPS) {
    const s = classes.reduce(
      (acc, c) => acc + S4_CLASS_SIZES[c]! * R.chi[c]! * R.chi[c]!,
      0,
    );
    if (s !== 24) orthogonal = false;
  }
  for (let i = 0; i < S4_IRREPS.length; i++)
    for (let j = i + 1; j < S4_IRREPS.length; j++) {
      const s = classes.reduce(
        (acc, c) =>
          acc +
          S4_CLASS_SIZES[c]! * S4_IRREPS[i]!.chi[c]! * S4_IRREPS[j]!.chi[c]!,
        0,
      );
      if (s !== 0) orthogonal = false;
    }
  const regularLaw = classes.every(
    (c) =>
      S4_IRREPS.reduce((acc, R) => acc + R.dim * R.chi[c]!, 0) ===
      (c === "1^4" ? 24 : 0),
  );
  const sumDimSquared = S4_IRREPS.reduce((acc, R) => acc + R.dim * R.dim, 0);
  let classSizesMatch = true;
  const counts = new Map<string, number>();
  for (const p of S4) {
    const k = cycleType(p);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  for (const [k, n] of Object.entries(S4_CLASS_SIZES))
    if (counts.get(k) !== n) classSizesMatch = false;
  return { orthogonal, regularLaw, sumDimSquared, classSizesMatch };
}

// --- the k=4 branch isometries (fixed-slot discipline) -------------------------------------------

let depolCache: Stinespring | null = null;

/** The completely depolarizing qubit channel as a Stinespring isometry (env dim 4). */
export function depolStinespring(): Stinespring {
  depolCache ??= krausToStinespring(completelyDepolarizingKraus(2));
  return depolCache;
}

const stridesOf = (dims: readonly number[]): number[] => {
  const s: number[] = new Array<number>(dims.length);
  s[dims.length - 1] = 1;
  for (let i = dims.length - 2; i >= 0; i--) s[i] = s[i + 1]! * dims[i + 1]!;
  return s;
};

function permuteSlots(
  re: Float64Array,
  im: Float64Array,
  dims: number[],
  perm: number[],
): { re: Float64Array; im: Float64Array } {
  const m = dims.length;
  const strides = stridesOf(dims);
  const newDims = perm.map((p) => dims[p]!);
  const newStrides = stridesOf(newDims);
  const outRe = new Float64Array(re.length);
  const outIm = new Float64Array(im.length);
  for (let idx = 0; idx < re.length; idx++) {
    let rest = idx;
    const digits: number[] = new Array<number>(m);
    for (let i = 0; i < m; i++) {
      digits[i] = Math.floor(rest / strides[i]!);
      rest %= strides[i]!;
    }
    let newIdx = 0;
    for (let k = 0; k < m; k++) newIdx += digits[perm[k]!]! * newStrides[k]!;
    outRe[newIdx] = re[idx]!;
    outIm[newIdx] = im[idx]!;
  }
  return { re: outRe, im: outIm };
}

export interface Branch4 {
  /** rows over dims [2, e, e, e, e] big-endian (e = 4), cols 2 */
  readonly W: { re: Float64Array; im: Float64Array; rows: number };
  readonly pi: Perm;
}

/**
 * Branch isometry W_pi: apply the four depolarizing boxes in the order pi,
 * then permute the environment slots to the canonical fixed-slot layout
 * (slot c+1 always holds channel c). Mapped per input basis column; the
 * returned W satisfies W^dagger W = I_2 (certificate below).
 */
export function branchIsometry4(pi: Perm): Branch4 {
  const st = depolStinespring();
  const d = 2;
  const e = st.envDim;
  if (st.d !== 2)
    refuse(
      "KSWITCH4_DEPOL_DIM",
      "branchIsometry4: expected the qubit depolarizing dilation",
    );
  const rows = d * e ** 4;
  const re = new Float64Array(rows * d);
  const im = new Float64Array(rows * d);
  for (let i = 0; i < d; i++) {
    let dims = [d];
    let cre = new Float64Array(d);
    let cim = new Float64Array(d);
    cre[i] = 1;
    for (const _k of pi) {
      // all four boxes are THE depolarizing dilation (the module's scope)
      const newDims = [d, e, ...dims.slice(1)];
      const size = newDims.reduce((a, b) => a * b, 1);
      const nre = new Float64Array(size);
      const nim = new Float64Array(size);
      const liveStride = Math.max(1, size / (d * e));
      for (let rest = 0; rest < liveStride; rest++)
        for (let s = 0; s < d; s++)
          for (let m = 0; m < e; m++) {
            let are = 0;
            let aim = 0;
            const rowIdx = (s * e + m) * d;
            for (let j = 0; j < d; j++) {
              const ar = cre[j * liveStride + rest]!;
              const ai = cim[j * liveStride + rest]!;
              if (ar === 0 && ai === 0) continue;
              const vr = st.V.re[rowIdx + j]!;
              const vi = st.V.im[rowIdx + j]!;
              are += vr * ar - vi * ai;
              aim += vr * ai + vi * ar;
            }
            const target = (s * e + m) * liveStride + rest;
            nre[target] = are;
            nim[target] = aim;
          }
      dims = newDims;
      cre = nre;
      cim = nim;
    }
    const perm: number[] = [0];
    for (let c = 0; c < 4; c++)
      for (let t = 0; t < 4; t++)
        if (pi[t] === c) {
          perm.push(4 - t); // old env slot (1-based) holding channel c
          break;
        }
    const fixed = permuteSlots(cre, cim, dims, perm);
    for (let r = 0; r < rows; r++) {
      re[r * d + i] = fixed.re[r]!;
      im[r * d + i] = fixed.im[r]!;
    }
  }
  return { W: { re, im, rows }, pi };
}

let branchCache: Branch4[] | null = null;

/** All 24 branch isometries in S4 order (memoized). */
export function branch4s(): readonly Branch4[] {
  branchCache ??= S4.map((pi) => branchIsometry4(pi));
  return branchCache;
}

/** Isometry certificate for a branch: W^dagger W = I_2 to 1e-12. */
export function branchIsometryOk(b: Branch4): boolean {
  const w = b.W;
  for (const [i, j] of [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
  ] as const) {
    let ar = 0;
    let ai = 0;
    for (let r = 0; r < w.rows; r++) {
      const xr = w.re[r * 2 + i]!;
      const xi = w.im[r * 2 + i]!;
      const yr = w.re[r * 2 + j]!;
      const yi = w.im[r * 2 + j]!;
      ar += xr * yr + xi * yi;
      ai += xi * yr - xr * yi;
    }
    if (Math.abs(ar - (i === j ? 1 : 0)) > 1e-12 || Math.abs(ai) > 1e-12)
      return false;
  }
  return true;
}

/**
 * The env-traced cross term T_{pi,sigma}(rho_in): the 2x2 S-block sum over the
 * 256 environment configurations, rho_in packed as [r00, r01re, r01im, r11].
 * Returns [t00, t01re, t01im, t11].
 */
export function tCross4(
  piIdx: number,
  sigmaIdx: number,
  rhoIn: readonly number[],
): number[] {
  if (piIdx < 0 || piIdx >= 24 || sigmaIdx < 0 || sigmaIdx >= 24) {
    refuse("KSWITCH4_INDEX", "tCross4: permutation index outside 0..23");
  }
  const wp = branch4s()[piIdx]!.W;
  const ws = branch4s()[sigmaIdx]!.W;
  const out = [0, 0, 0, 0];
  const envSpan = 4 ** 4;
  for (let a = 0; a < 2; a++)
    for (let b = 0; b < 2; b++) {
      let accRe = 0;
      let accIm = 0;
      for (let env = 0; env < envSpan; env++)
        for (let j = 0; j < 2; j++)
          for (let k = 0; k < 2; k++) {
            const rr = j === k ? (j === 0 ? rhoIn[0]! : rhoIn[3]!) : rhoIn[1]!;
            const ri = j === k ? 0 : j === 0 ? rhoIn[2]! : -rhoIn[2]!;
            if (rr === 0 && ri === 0) continue;
            const pr = wp.re[(a * envSpan + env) * 2 + j]!;
            const pi_ = wp.im[(a * envSpan + env) * 2 + j]!;
            const sr = ws.re[(b * envSpan + env) * 2 + k]!;
            const si = ws.im[(b * envSpan + env) * 2 + k]!;
            const xr = pr * rr - pi_ * ri;
            const xi = pr * ri + pi_ * rr;
            accRe += xr * sr + xi * si;
            accIm += xi * sr - xr * si;
          }
      if (a === b) out[a * 2 + b] = accRe;
      else {
        out[1] = accRe;
        out[2] = accIm;
      }
    }
  return out;
}

// --- the exact coefficient table (machine-derived, test-witnessed) -------------------------------

export interface K4Coeff {
  /** T_tau(I/2) = a_tau * I — the ensemble-average scalar coefficient */
  readonly a: Frac;
  /** T_tau(|0><0|) = diag(x_tau, 2 a_tau - x_tau) — the member coefficient */
  readonly x: Frac;
}

/**
 * The 24 coefficient pairs in S4 order — every entry an exact dyadic rational.
 * Derived by tCross4(t, id, .) and re-derived by the test at every run; the
 * left-invariance theorem says these 24 numbers ARE the whole 576-pair table.
 */
export const K4_COEFFICIENTS: readonly K4Coeff[] = [
  { a: fr(1, 2), x: fr(1, 2) }, // #0  1^4
  { a: fr(1, 8), x: fr(1, 8) },
  { a: fr(1, 8), x: fr(1, 8) },
  { a: fr(1, 8), x: fr(1, 8) },
  { a: fr(1, 8), x: fr(1, 8) },
  { a: fr(1, 8), x: fr(1, 8) },
  { a: fr(1, 8), x: fr(1, 8) },
  { a: fr(1, 32), x: fr(1, 16) }, // #7  2^2
  { a: fr(1, 8), x: fr(1, 8) },
  { a: fr(1, 8), x: fr(1, 4) }, // #9  4
  { a: fr(1, 32), x: fr(1, 16) },
  { a: fr(1, 32), x: fr(1, 16) },
  { a: fr(1, 8), x: fr(1, 8) },
  { a: fr(1, 32), x: fr(1, 16) },
  { a: fr(1, 8), x: fr(1, 8) },
  { a: fr(1, 32), x: fr(1, 16) },
  { a: fr(1, 8), x: fr(1, 4) }, // #16 2^2
  { a: fr(1, 8), x: fr(1, 8) },
  { a: fr(1, 8), x: fr(1, 4) }, // #18 4
  { a: fr(1, 32), x: fr(1, 16) },
  { a: fr(1, 32), x: fr(1, 16) },
  { a: fr(1, 8), x: fr(1, 8) },
  { a: fr(1, 8), x: fr(1, 8) },
  { a: fr(1, 32), x: fr(1, 16) }, // #23 2^2
];

export type K4Family = "avg" | "member";

/** tau(pi, sigma) = pi^-1 sigma as an S4 index — the circulant's index map. */
export function tauIndexOf(piIdx: number, sigmaIdx: number): number {
  return indexOfPerm(compose(invert(S4[piIdx]!), S4[sigmaIdx]!));
}

/**
 * The env-traced 48x48 joint operator at coherence c, built from the exact
 * coefficient table: diagonal blocks 1/24, off-diagonal blocks c/24. When
 * `viaCoefficients` is false the coefficients are computed DIRECTLY from the
 * 576 branch-isometry pairs — the independent path for the dual witness.
 */
export function buildJoint4(
  family: K4Family,
  c: number,
  viaCoefficients = true,
  coefficients: readonly K4Coeff[] = K4_COEFFICIENTS,
): CMat {
  const n = 48;
  const m = mat(n, n);
  const rhoIn = family === "avg" ? [0.5, 0, 0, 0.5] : [1, 0, 0, 0];
  for (let p = 0; p < 24; p++)
    for (let s = 0; s < 24; s++) {
      let T: readonly number[];
      if (viaCoefficients) {
        const k = coefficients[tauIndexOf(p, s)]!;
        // avg: a * I ; member: diag(x, 2a - x) — the S-trace is 2a on both faces
        T =
          family === "avg"
            ? [num(k.a), 0, 0, num(k.a)]
            : [num(k.x), 0, 0, num(fSub(fMul(fr(2), k.a), k.x))];
      } else {
        T = tCross4(p, s, rhoIn);
      }
      const w = p === s ? 1 / 24 : c / 24;
      const put = (a: number, b: number, re: number, im: number) => {
        const ri = (p * 2 + a) * n + s * 2 + b;
        m.re[ri] = m.re[ri]! + re * w;
        m.im[ri] = m.im[ri]! + im * w;
      };
      put(0, 0, T[0]!, 0);
      put(1, 1, T[3]!, 0);
      put(0, 1, T[1]!, T[2]!);
      put(1, 0, T[1]!, -T[2]!);
    }
  return m;
}

const num = (f: Frac): number => Number(f.n) / Number(f.d); // dyadic limbs — exact in double

/**
 * THEOREM (1): entrywise left-invariance — max deviation of
 * rho[(g pi),(g sigma)] from rho[(pi),(sigma)] over ALL 24 g x 576 pairs.
 * Exact zero on the coefficient build (identical table lookups).
 */
export function leftInvarianceDev(family: K4Family, c = 1): number {
  const m = buildJoint4(family, c);
  let dev = 0;
  for (let gi = 0; gi < 24; gi++) {
    const g = S4[gi]!;
    for (let p = 0; p < 24; p++) {
      const gp = indexOfPerm(compose(g, S4[p]!));
      for (let s = 0; s < 24; s++) {
        const gs = indexOfPerm(compose(g, S4[s]!));
        for (let a = 0; a < 2; a++)
          for (let b = 0; b < 2; b++) {
            const v1 = m.re[(gp * 2 + a) * 48 + gs * 2 + b]!;
            const v2 = m.re[(p * 2 + a) * 48 + s * 2 + b]!;
            dev = Math.max(dev, Math.abs(v1 - v2));
          }
      }
    }
  }
  return dev;
}

/**
 * The coefficient-table dual witness: table-built vs direct 576-pair build,
 * both families at full coherence. matEq at 1e-12 — the entries are the same
 * dyadic rationals on both paths, so this is a structural identity check.
 */
export function coefficientsMatchDirect(): boolean {
  return (
    matEq(buildJoint4("avg", 1, true), buildJoint4("avg", 1, false), 1e-12) &&
    matEq(
      buildJoint4("member", 1, true),
      buildJoint4("member", 1, false),
      1e-12,
    )
  );
}

/**
 * THEOREM (4), exact (at full coherence): the isotypic block trace
 * Tr(P_R rho) = (dim/24) sum_g chiR(g) sum_pi (1/24) Tr_S(T_{pi^-1 g pi}) in
 * pure Frac arithmetic — and Tr_S(T_tau) = 2 a_tau on BOTH input faces (avg:
 * Tr(a I) = 2a; member: x + (2a - x) = 2a), which is why the trace table is
 * family-independent: a machine-exact degeneracy of the k=4 face.
 */
export function isotypicTrace(R: Irrep): Frac {
  let total = F_ZERO;
  for (let gi = 0; gi < 24; gi++) {
    const chi = R.chi[cycleType(S4[gi]!)]!;
    if (chi === 0) continue;
    let inner = F_ZERO;
    for (let p = 0; p < 24; p++) {
      const tau = tauIndexOf(p, indexOfPerm(compose(S4[gi]!, S4[p]!)));
      const k = K4_COEFFICIENTS[tau]!;
      inner = fAdd(inner, fDiv(fMul(fr(2), k.a), fr(24)));
    }
    total = fAdd(total, fMul(fr(chi), inner));
  }
  return fMul(fDiv(fr(R.dim), fr(24)), total);
}

/** The exact block-trace table, both families: {trivial 7/32, sign 0, 2-dim 1/8, standard 3/8, standard(x)sign 9/32}. */
export const K4_BLOCK_TRACES: readonly Frac[] = [
  fr(7, 32),
  F_ZERO,
  fr(1, 8),
  fr(3, 8),
  fr(9, 32),
];

export function blockTracesOk(): boolean {
  for (let i = 0; i < S4_IRREPS.length; i++)
    if (fCmp(isotypicTrace(S4_IRREPS[i]!), K4_BLOCK_TRACES[i]!) !== 0)
      return false;
  return true;
}

// --- the isotypic blocks and the machine-enumerated spectral class table --------------------------

export interface DistinctEig {
  readonly value: number;
  readonly multiplicity: number;
  /** exact rational pin when the value is a dyadic/n/24-type rational (null for algebraic roots) */
  readonly pin: Frac | null;
}

export interface IrrepBlockFace {
  readonly irrep: string;
  readonly dim: number;
  readonly blockDim: number; // 2 dim^2
  readonly eigenvalues: readonly number[]; // sorted, the block's own list
  readonly distinct: readonly DistinctEig[];
  /** every distinct multiplicity is a multiple of dim — the character-theoretic degeneracy law */
  readonly multiplicityLawHolds: boolean;
}

export interface SpectralClassTable {
  readonly family: K4Family;
  readonly blocks: readonly IrrepBlockFace[];
  /** pooled block eigenvalues vs the dense 48-dim spectrum — the reconstruction witness */
  readonly pooledReconstructionDev: number;
  readonly baseSpectrum: readonly number[]; // the 48 sorted float eigenvalues
  /** chi4 at full coherence (data) */
  readonly chiAtFullCoherence: number;
}

const PIN_CANDIDATES: readonly Frac[] = (() => {
  const pins: Frac[] = [];
  for (let k = 1; k <= 2048; k++)
    for (const d of [24, 32, 48, 64, 96, 128, 192, 256, 384]) {
      const f = fr(k, d);
      if (Number(k) / d <= 1) pins.push(f);
    }
  return pins;
})();

function pinOf(v: number): Frac | null {
  for (const p of PIN_CANDIDATES)
    if (Math.abs(v - Number(p.n) / Number(p.d)) < 1e-9) return p;
  return null;
}

/** The isotypic projector P_R = (dim/24) sum_tau chi(tau) L_tau, as a 24x24 real matrix. */
function isotypicProjector(R: Irrep): number[][] {
  const P: number[][] = Array.from({ length: 24 }, () =>
    new Array<number>(24).fill(0),
  );
  for (let t = 0; t < 24; t++) {
    const chi = R.chi[cycleType(S4[t]!)]!;
    if (chi === 0) continue;
    const sc = (R.dim / 24) * chi;
    for (let p = 0; p < 24; p++) {
      const tp = indexOfPerm(compose(S4[t]!, S4[p]!));
      P[tp]![p]! += sc;
    }
  }
  return P;
}

const spectralCache: Partial<Record<K4Family, SpectralClassTable>> = {};

/**
 * The machine-enumerated spectral class table: for each irrep, the
 * compression of the 48x48 operator to range(P_R) (x) C^2 — dimension
 * 2 dim(R)^2 — its eigenvalues, their rational pins, and the degeneracy law.
 */
export function spectralClassTable(family: K4Family): SpectralClassTable {
  const cached = spectralCache[family];
  if (cached !== undefined) return cached;
  const op = buildJoint4(family, 1, true);
  const blocks: IrrepBlockFace[] = [];
  const pooled: number[] = [];
  for (const R of S4_IRREPS) {
    const P = isotypicProjector(R);
    // orthonormal basis of range(P) by projecting standard basis vectors
    const ortho: number[][] = [];
    for (let i = 0; i < 24 && ortho.length < R.dim * R.dim; i++) {
      const v = new Array<number>(24).fill(0).map((_, j) => P[j]![i]!);
      for (const u of ortho) {
        let dot = 0;
        for (let a = 0; a < 24; a++) dot += u[a]! * v[a]!;
        for (let a = 0; a < 24; a++) v[a]! -= dot * u[a]!;
      }
      const nrm = Math.hypot(...v);
      if (nrm > 1e-8) ortho.push(v.map((x) => x / nrm));
    }
    if (ortho.length !== R.dim * R.dim) {
      refuse(
        "KSWITCH4_PROJECTOR_RANK",
        `spectralClassTable: projector rank ${ortho.length} != ${R.dim * R.dim} for ${R.name}`,
      );
    }
    const bd = R.dim * R.dim * 2;
    const block = mat(bd, bd);
    for (let x = 0; x < bd; x++)
      for (let y = 0; y < bd; y++) {
        const ux = ortho[Math.floor(x / 2)]!;
        const uy = ortho[Math.floor(y / 2)]!;
        const ax = x % 2;
        const ay = y % 2;
        let val = 0;
        for (let pi = 0; pi < 24; pi++)
          for (let sg = 0; sg < 24; sg++)
            val += ux[pi]! * uy[sg]! * op.re[(pi * 2 + ax) * 48 + sg * 2 + ay]!;
        block.re[x * bd + y] = val;
      }
    const eigs = Array.from(eigenvaluesHermitian(block)).sort((a, b) => a - b);
    pooled.push(...eigs);
    const distinct: Array<{
      value: number;
      multiplicity: number;
      pin: Frac | null;
    }> = [];
    for (const e of eigs) {
      const last = distinct[distinct.length - 1];
      if (last !== undefined && Math.abs(e - last.value) <= 1e-7)
        last.multiplicity++;
      else distinct.push({ value: e, multiplicity: 1, pin: pinOf(e) });
    }
    blocks.push({
      irrep: R.name,
      dim: R.dim,
      blockDim: bd,
      eigenvalues: eigs,
      distinct: distinct.map((d) => ({ ...d })),
      multiplicityLawHolds: distinct.every((d) => d.multiplicity % R.dim === 0),
    });
  }
  pooled.sort((a, b) => a - b);
  const base = Array.from(eigenvaluesHermitian(op)).sort((a, b) => a - b);
  let dev = 0;
  for (let i = 0; i < 48; i++)
    dev = Math.max(dev, Math.abs(pooled[i]! - base[i]!));
  const avg = buildJoint4("avg", 1, true);
  const mem = buildJoint4("member", 1, true);
  const chi = entropyOf(avg) - entropyOf(mem);
  const table: SpectralClassTable = {
    family,
    blocks,
    pooledReconstructionDev: dev,
    baseSpectrum: base,
    chiAtFullCoherence: chi,
  };
  spectralCache[family] = table;
  return table;
}

function entropyOf(m: CMat): number {
  const eigs = eigenvaluesHermitian(m);
  let s = 0;
  for (const e of eigs) if (e > 1e-15) s -= e * Math.log2(e);
  return s;
}

// --- the rigorous eigenvalue brackets and the exact chi4 -----------------------------------------

/**
 * Every float eigenvalue bracketed by a rigorous rational enclosure: the
 * eigensolver's reconstruction certificate (sum |A - sum lam v v^dag| — the
 * solver refuses above 1e-8) plus a Weyl budget for the dyadic-entry rounding
 * of the /3-factor entries (|A - A_float|_F <= 48 * 0.5 * 2^-52, classical),
 * doubled for safety, then rounded OUTWARD to the 2^-28 grid. The claim
 * (Weyl, classical, disclosed): every true eigenvalue of the exact operator
 * lies within the budget of the sorted float list, sorted-matched.
 */
const EIG_ROUND = 2 ** 28; // bracket grid: 1/2^28 ~ 3.7e-9 per side
const WEYL_BUDGET = 48 * 0.5 * 2 ** -52 * 4; // entry rounding, Frobenius, safety x4

const bracketCache: Partial<Record<K4Family, readonly Ivl[]>> = {};

export function eigenBrackets(family: K4Family): readonly Ivl[] {
  const cached = bracketCache[family];
  if (cached !== undefined) return cached;
  const op = buildJoint4(family, 1, true);
  const { values, vectors } = eigHermitian(op); // refuses unless reconstruction holds
  const recon = reconstruct(op, values, vectors);
  let reconErr = 0;
  for (let k = 0; k < op.re.length; k++)
    reconErr +=
      Math.abs(recon.re[k]! - op.re[k]!) + Math.abs(recon.im[k]! - op.im[k]!);
  const w = 2 * (reconErr + WEYL_BUDGET);
  const out: Ivl[] = [];
  for (let i = 0; i < 48; i++) {
    const v = values[i]!;
    const loRaw = Math.floor((v - w) * EIG_ROUND) / EIG_ROUND;
    const hiRaw = Math.ceil((v + w) * EIG_ROUND) / EIG_ROUND;
    // PSD clamp: a partial trace of a positive operator has no negative spectrum
    const lo = Math.max(loRaw, 0);
    const hi = Math.max(hiRaw, 1 / EIG_ROUND); // a zero eigenvalue's bracket still has positive width
    if (hi >= 1 / 3) {
      refuse(
        "KSWITCH4_EIG_DOMAIN",
        `eigenBrackets: bracket hi ${hi} leaves [0,1/3) — the entropy monotonicity face`,
      );
    }
    out.push({
      lo: fr(BigInt(Math.round(lo * EIG_ROUND)), BigInt(EIG_ROUND)),
      hi: fr(BigInt(Math.round(hi * EIG_ROUND)), BigInt(EIG_ROUND)),
    });
  }
  bracketCache[family] = out;
  return out;
}

const chi4Memo = new Map<LnPath, Map<string, Ivl>>();

/**
 * Value-preserving gcd reduction (the nosignal-tariff rational kernel's
 * discipline, local to this module — readout's rational.ts is frozen by the
 * new-file law): the entropy sums below accumulate 25-ish terms whose
 * UNREDUCED denominators compound to ~10^5-bit limbs and dominate the whole
 * certificate's cost; reducing the accumulator after each add keeps the limbs
 * at the lcm scale while every comparison, width, and certificate verdict
 * reads the same exact value.
 */
function fReduceLocal(a: Frac): Frac {
  let x = a.n < 0n ? -a.n : a.n;
  let y = a.d;
  while (y !== 0n) {
    const t = x % y;
    x = y;
    y = t;
  }
  if (x === 1n) return a;
  return { n: a.n / x, d: a.d / x };
}

interface EigCluster {
  /** bracket of the whole degenerate cluster [min lo, max hi] */
  readonly lo: Frac;
  readonly hi: Frac;
  readonly mult: number;
}

const clusterCache: Partial<Record<K4Family, readonly EigCluster[]>> = {};

/**
 * Cluster the 48 brackets along the spectrum's true degeneracies (the class
 * table's multiplicities): true distinct-eigenvalue gaps are >= 7e-4 while
 * bracket widths are ~1e-8, so brackets of one degenerate family overlap and
 * distinct families never do. The entropy sum then carries one term per
 * CLUSTER scaled by its multiplicity — same exact value, ~4x fewer series.
 */
function eigenClusters(family: K4Family): readonly EigCluster[] {
  const cached = clusterCache[family];
  if (cached !== undefined) return cached;
  const brackets = [...eigenBrackets(family)].sort((a, b) => fCmp(a.lo, b.lo));
  const clusters: EigCluster[] = [];
  for (const b of brackets) {
    const last = clusters[clusters.length - 1];
    if (last !== undefined && fCmp(b.lo, last.hi) <= 0) {
      clusters[clusters.length - 1] = {
        lo: last.lo,
        hi: fCmp(b.hi, last.hi) > 0 ? b.hi : last.hi,
        mult: last.mult + 1,
      };
    } else {
      clusters.push({ lo: b.lo, hi: b.hi, mult: 1 });
    }
  }
  clusterCache[family] = clusters;
  return clusters;
}

/**
 * chi4(lambda) as an EXACT interval: every base eigenvalue cluster moves
 * affinely, eig(c) = c bracket + (1-c)/48, and each entropy term is enclosed
 * by f at the interval ends (f = -q log2 q increasing on [0, 1/3) — every
 * bracket is machine-checked inside; chi4(1) = [0,0] exact by cancellation).
 */
export function k4Chi(lambda: Frac, path: LnPath = PATH_T): Ivl {
  // the exact endpoint: at lambda = 1 the operator IS diag(1/48) (zeroCoherenceExact)
  // — both entropy sums are the same 48 copies of f(1/48), so chi4 = 0 exactly
  if (fCmp(lambda, F_ONE) === 0) return { lo: F_ZERO, hi: F_ZERO };
  let perPath = chi4Memo.get(path);
  if (perPath === undefined) {
    perPath = new Map<string, Ivl>();
    chi4Memo.set(path, perPath);
  }
  const key = `${lambda.n}/${lambda.d}`;
  const hit = perPath.get(key);
  if (hit !== undefined) return hit;
  const c = fSub(F_ONE, lambda);
  const uniform = fr(1, 48);
  let avgLo = F_ZERO;
  let avgHi = F_ZERO;
  for (const cl of eigenClusters("avg")) {
    const lo = fReduceLocal(
      fAdd(fMul(c, cl.lo), fMul(fSub(F_ONE, c), uniform)),
    );
    const hi = fReduceLocal(
      fAdd(fMul(c, cl.hi), fMul(fSub(F_ONE, c), uniform)),
    );
    avgLo = fReduceLocal(fAdd(avgLo, fMul(fTerm(lo, path).lo, fr(cl.mult))));
    avgHi = fReduceLocal(fAdd(avgHi, fMul(fTerm(hi, path).hi, fr(cl.mult))));
  }
  let memLo = F_ZERO;
  let memHi = F_ZERO;
  for (const cl of eigenClusters("member")) {
    const lo = fReduceLocal(
      fAdd(fMul(c, cl.lo), fMul(fSub(F_ONE, c), uniform)),
    );
    const hi = fReduceLocal(
      fAdd(fMul(c, cl.hi), fMul(fSub(F_ONE, c), uniform)),
    );
    memLo = fReduceLocal(fAdd(memLo, fMul(fTerm(lo, path).lo, fr(cl.mult))));
    memHi = fReduceLocal(fAdd(memHi, fMul(fTerm(hi, path).hi, fr(cl.mult))));
  }
  const iv = { lo: fSub(avgLo, memHi), hi: fSub(avgHi, memLo) };
  perPath.set(key, iv);
  return iv;
}

// --- the certificates: coarse exact grid + covering subdivision ----------------------------------

/**
 * v0.6.0 — the k=4 certificate's quoted floors/ceilings (truncated DOWN for
 * gaps, UP for widths). THE COST DISCLOSURE (the reason this family's exact
 * certificate runs on the QUARTER grid while F1/F2/F3 run on i/20): each
 * chi4 enclosure evaluates 25 entropy-series terms whose bracket fractions
 * carry 2^28-scaled denominators, and this kernel's ln series compound
 * unreduced — one enclosure costs ~6 seconds. Five lambda points x two ln
 * paths is the honest budget this visit; the 21-point float grid below
 * carries the fine-scale shape as DATA.
 */
export const QUOTED_K4_MIN_DESCENT_GAP = "0.008413"; // floor of the min descent gap over paths (quarter grid)
export const QUOTED_K4_MIN_CONVEX_DD = "0.015751"; // floor of the min convexity cell gap (quarter grid)
export const QUOTED_K4_MAX_CHI_WIDTH = "0.000003"; // ceiling on chi4's widest enclosure
export const QUOTED_K4_CHI0 = "0.153273"; // floor of chi4(0)'s exact lower enclosure
export const QUOTED_K4_FLOAT_MIN_GAP = "0.000373"; // floor of the float grid's min descent gap (data)
export const QUOTED_K4_FLOAT_MIN_DD = "0.000611"; // floor of the float grid's min second difference (data)

/** The certificate grid: lambda in {0, 1/4, 1/2, 3/4, 1} — the disclosed resolution. */
export function k4GridPoints(): Frac[] {
  return [F_ZERO, fr(1, 4), fDiv(F_ONE, fr(2)), fr(3, 4), F_ONE];
}

export interface K4GridCert {
  readonly descent: readonly StrictDecrResult[];
  readonly convex: readonly ConvexResult[];
  readonly minGap: Frac | null;
  readonly minDD: Frac | null;
  readonly maxWidth: Frac;
  readonly crossOverlapAll: boolean;
  readonly ok: boolean;
}

/** v0.2.0's grid checkers applied to chi4 on the quarter grid (memoized — pure and expensive). */
let gridCache: K4GridCert | null = null;

export function k4GridCertificate(): K4GridCert {
  gridCache ??= computeK4Grid();
  return gridCache;
}

function computeK4Grid(): K4GridCert {
  const pts = k4GridPoints();
  const perPath = LN_PATHS.map((path) => pts.map((p) => k4Chi(p, path)));
  const descent = perPath.map((vals) => certifyStrictlyDecreasing(vals));
  const convex = perPath.map((vals) => certifyConvexGrid(vals));
  let minGap: Frac | null = null;
  for (const d of descent) {
    if (d.minGap === null) continue;
    minGap =
      minGap === null
        ? d.minGap
        : fCmp(d.minGap, minGap) < 0
          ? d.minGap
          : minGap;
  }
  let minDD: Frac | null = null;
  for (const c of convex) {
    if (c.minDD === null) continue;
    minDD =
      minDD === null ? c.minDD : fCmp(c.minDD, minDD) < 0 ? c.minDD : minDD;
  }
  let maxWidth = F_ZERO;
  for (const vals of perPath)
    for (const iv of vals) {
      const w = iWidth(iv);
      if (fCmp(w, maxWidth) > 0) maxWidth = w;
    }
  let crossOverlapAll = true;
  const [first, second] = perPath;
  if (first === undefined || second === undefined) {
    refuse("KSWITCH4_PATHS", "computeK4Grid: expected two paths");
  }
  for (let i = 0; i < first.length; i++) {
    if (
      fCmp(first[i]!.lo, second[i]!.hi) > 0 ||
      fCmp(second[i]!.lo, first[i]!.hi) > 0
    )
      crossOverlapAll = false;
  }
  return {
    descent,
    convex,
    minGap,
    minDD,
    maxWidth,
    crossOverlapAll,
    ok:
      descent.every((d) => d.ok) &&
      convex.every((c) => c.ok) &&
      crossOverlapAll &&
      minGap !== null &&
      fCmp(minGap, frDec(QUOTED_K4_MIN_DESCENT_GAP)) >= 0 &&
      minDD !== null &&
      fCmp(minDD, frDec(QUOTED_K4_MIN_CONVEX_DD)) >= 0 &&
      fCmp(maxWidth, frDec(QUOTED_K4_MAX_CHI_WIDTH)) <= 0,
  };
}

function frDec(s: string): Frac {
  const m = /^(\d+)\.(\d+)$/.exec(s);
  if (m === null) return fr(BigInt(s));
  return fr(BigInt(m[1]! + m[2]!), BigInt(10 ** m[2]!.length));
}

export interface K4WallCert {
  readonly descent: readonly SubdivisionResult[];
  readonly convex: readonly SubdivisionResult[];
  readonly ok: boolean;
}

/**
 * v0.5.0's covering-partition subdivision applied to chi4 (globalwall's
 * engine, read-only): the two seeds [0, 1/2] and [1/2, 1] subdivide
 * unconditionally to resolution 1/8 (REFINE_FLOOR_K4 = 1) and adapt further
 * while a cell fails — the bisection is armed for hiding dips at every scale
 * below the floor, with the forger's runway (MAX_DEPTH) inherited from the
 * wall engine.
 */
export const REFINE_FLOOR_K4 = 1;

let wallCache: K4WallCert | null = null;

export function k4WallCertificate(): K4WallCert {
  wallCache ??= {
    descent: LN_PATHS.map((path) =>
      certifyAdaptiveDescent(
        (l) => k4Chi(l, path),
        k4Seeds(),
        REFINE_FLOOR_K4,
        MAX_DEPTH,
      ),
    ),
    convex: LN_PATHS.map((path) =>
      certifyAdaptiveConvexity(
        (l) => k4Chi(l, path),
        k4Seeds(),
        REFINE_FLOOR_K4,
        MAX_DEPTH,
      ),
    ),
    get ok(): boolean {
      return this.descent.every((d) => d.ok) && this.convex.every((c) => c.ok);
    },
  };
  return wallCache;
}

function k4Seeds(): Array<{ a: Frac; b: Frac }> {
  return [
    { a: F_ZERO, b: fDiv(F_ONE, fr(2)) },
    { a: fDiv(F_ONE, fr(2)), b: F_ONE },
  ];
}

// --- the fine-scale float grid (data) -------------------------------------------------------------

export interface K4FloatGrid {
  readonly values: readonly number[]; // chi4(i/20) by float spectra, i = 0..20
  readonly minGap: number;
  readonly minDD: number;
  readonly decreasing: boolean;
  readonly convex: boolean;
}

let floatGridCache: K4FloatGrid | null = null;

/**
 * DATA (never a certificate): chi4 on the 21-point grid by float spectra —
 * the fine-scale shape the exact certificate's quarter grid cannot afford.
 * Each point is two 48-dim eigendecompositions (avg and member operators at
 * coherence c = 1 - lambda).
 */
export function k4FloatGrid(): K4FloatGrid {
  floatGridCache ??= computeFloatGrid();
  return floatGridCache;
}

function computeFloatGrid(): K4FloatGrid {
  const values: number[] = [];
  for (let i = 0; i <= 20; i++) {
    const c = 1 - i / 20;
    values.push(
      entropyOf(buildJoint4("avg", c, true)) -
        entropyOf(buildJoint4("member", c, true)),
    );
  }
  let minGap = Infinity;
  let minDD = Infinity;
  for (let i = 0; i + 1 < values.length; i++)
    minGap = Math.min(minGap, values[i]! - values[i + 1]!);
  for (let i = 1; i + 1 < values.length; i++)
    minDD = Math.min(minDD, values[i - 1]! + values[i + 1]! - 2 * values[i]!);
  return {
    values,
    minGap,
    minDD,
    decreasing: minGap > 0,
    convex: minDD > 0,
  };
}

// --- the affine weak-readout law (data) -----------------------------------------------------------

/**
 * DATA: eig(c) = c base + (1-c)/48 — the operator's sorted spectrum at
 * coherence c vs the affine prediction from the c = 1 spectrum. Returns the
 * max deviation over the sampled coherences.
 */
export function affineLawDev(c: number): number {
  let dev = 0;
  for (const family of ["avg", "member"] as const) {
    const base = Array.from(
      eigenvaluesHermitian(buildJoint4(family, 1, true)),
    ).sort((a, b) => a - b);
    const got = Array.from(
      eigenvaluesHermitian(buildJoint4(family, c, true)),
    ).sort((a, b) => a - b);
    for (let i = 0; i < 48; i++)
      dev = Math.max(dev, Math.abs(got[i]! - (c * base[i]! + (1 - c) / 48)));
  }
  return dev;
}

/**
 * THEOREM (5): at zero coherence the operator is EXACTLY diag(1/48) — every
 * entry compared as a dyadic rational (entry * 48 * 2^30 integral and equal).
 */
export function zeroCoherenceExact(): boolean {
  for (const family of ["avg", "member"] as const) {
    const m = buildJoint4(family, 0, true);
    for (let i = 0; i < 48; i++)
      for (let j = 0; j < 48; j++) {
        const v = m.re[i * 48 + j]!;
        const want = i === j ? 1 / 48 : 0;
        if (Math.abs(v - want) > 1e-15) return false;
        if (m.im[i * 48 + j]! !== 0) return false;
      }
  }
  return true;
}

/** S(rho_0) = S(rho_1) — bit-flip covariance, machine-checked as data (deviation). */
export function memberEntropySymmetryDev(): number {
  // the |1><1| member operator: X-conjugation swaps the diagonal coefficients
  const m0 = buildJoint4("member", 1, true);
  const m1 = buildJointMember1();
  return Math.abs(entropyOf(m0) - entropyOf(m1));
}

function buildJointMember1(): CMat {
  const n = 48;
  const m = mat(n, n);
  for (let p = 0; p < 24; p++)
    for (let s = 0; s < 24; s++) {
      const k = K4_COEFFICIENTS[tauIndexOf(p, s)]!;
      const t00 = num(fSub(fMul(fr(2), k.a), k.x));
      const t11 = num(k.x);
      const w = 1 / 24; // c = 1: diagonal and off-diagonal weights coincide
      const i0 = p * 2 * n + s * 2;
      const i1 = (p * 2 + 1) * n + s * 2 + 1;
      m.re[i0] = m.re[i0]! + t00 * w;
      m.re[i1] = m.re[i1]! + t11 * w;
    }
  return m;
}
