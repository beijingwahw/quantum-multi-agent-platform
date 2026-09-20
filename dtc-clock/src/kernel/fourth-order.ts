/**
 * THE FOURTH-ORDER DECAY COEFFICIENT c_4 — the R21 zero-ripple addition
 * (delivered WITHOUT a version bump; the registration face is this file's
 * header and its tests, not a board row).
 *
 * THE SETTING (TC33-TC40's arc, unchanged): the strict armor's absorbing
 * block Q(p) = I + pQ_1 + p^2Q_2 + p^3Q_3 + p^4Q_4 + ... on the Dirichlet
 * states {0..n/2-1} (n even), reversible in the binomial D-inner product,
 * with the top branch
 *     lambda_1(p) = 1 - 2p + c_2 p^2 + c_3 p^3 + c_4 p^4 + O(p^5).
 * Writing A(p) = (Q(p) - I)/p = Q_1 + pQ_2 + p^2Q_3 + p^3Q_4, the top
 * eigenvalue of A(p) is mu(p) = -2 + c_2 p + c_3 p^2 + c_4 p^3 + ... and the
 * Rayleigh-Schrodinger hierarchy in the D-inner product (u_w = n - 2w the
 * top eigenvector, theta_1 = -2; K_j the odd Krawtchouk modes j >= 3,
 * theta_j = -2j, gaps Delta_j = theta_1 - theta_j = 2(j-1)) gives the
 * FOUR-FACE decomposition of the third-order RS correction:
 *
 *   c_4 = <u,Q_4 u>/<u,u>                                    [quotient face]
 *       + 2 sum_j <K_j,Q_2 u><K_j,Q_3 u> / (Delta_j vv_j uu) [mixed face]
 *       + sum_{j,k} <K_j,Q_2 u><K_j,Q_2 K_k><K_k,Q_2 u>
 *                  / (Delta_j Delta_k vv_j vv_k uu)          [double face]
 *       - c_2 sum_j <K_j,Q_2 u>^2 / (Delta_j^2 vv_j uu)      [normalization
 *                                                              subtraction].
 *
 * SPEC-VS-MACHINE ADJUDICATION (the spec is a hypothesis; the eigenvalue is
 * the court): the R18 design stock described c_4 as THREE faces — quotient,
 * a Q_2-coupling face, and "the first second-order repulsion face (the
 * SQUARE of the Q_3 coupling)". The machine convicts that inventory: the
 * Q_3-coupling square first enters at c_5 (two W-vertices), while the true
 * fourth-order repulsion content is the Q_2-coupling DOUBLE face plus the
 * normalization subtraction that the intermediate normalization owes. The
 * fourthOrderSpecVariant export freezes the spec-as-written inventory so the
 * test can convict it against the exact eigenvalue (the residual refuses to
 * drop); the four-face sum is the inventory the eigenvalue accepts.
 *
 * THE IDENTITY CHAIN CONTINUES (the quotient face's law): TC39 found
 * 3<u,Q_3 u> + (n-2)<u,Q_2 u> = 0. At fourth order the chain reads
 *     4<u,Q_4 u> + alpha<u,Q_3 u> + beta<u,Q_2 u> = 0,
 * with the machine-determined integer coefficients
 *     alpha = (3n-2)/2,  beta = n-2        (n even, so alpha is an integer),
 * i.e. in all-integer form 8<u,Q_4 u> + (3n-2)<u,Q_3 u> + 2(n-2)<u,Q_2 u> = 0
 * — fourthOrderIdentityResidue returns exactly this residue. Consequences:
 * T_3/T_2 = -(n-2)/3 (TC39 verbatim) and T_4/T_2 = (3n-8)(n-2)/24, so the
 * quotient face inherits c_2's general-n law:
 *     <u,Q_4 u>/<u,u> = (3n-8)(n-2)/24 * c_2(n)
 *                     = (3n-8)(n-2)(n-1) C(n-2,(n-2)/2) / (24 * 2^(n-2)),
 * verified by BigInt zero-residue on the wide grid (fourthOrderQuotientGeneral).
 *
 * THE CROSSING ROAD (an independent arithmetic for the quotient faces): the
 * FULL Ehrenfest expectation is exactly linear, E[u(W_0)u(W_1)] = n(1-2p)
 * for every p (each spin's echo carries the factor E[eta] = 1-2p and
 * E[sigma_i sigma_j] = delta_ij) — so with T = the truncated block sum and
 * X = the boundary-crossing sum, 2T + 2X = 2^n n (1-2p) forces T_k = -X_k
 * at every order k >= 2. X_k is a SEVEN-TERM boundary sum (crossing
 * transitions w -> v > n/2 only, at most four flips deep), computed by a
 * generic enumerator that shares no code with the applyQkBig block road —
 * the two roads must agree in exact BigInt (crossingQuotientResidue).
 *
 * Literature shape (both pending dual sourcing): the Rayleigh-Schrodinger
 * hierarchy for multi-term perturbation families, Kato-1980 "Perturbation
 * Theory for Linear Operators" (the E^(3) coefficient's four-term
 * structure) [dual-source pending]; the Krawtchouk norms and three-term
 * recurrence, Nikiforov-Uvarov-1988 "Special Functions of Mathematical
 * Physics" (the vv_j / mode structure) [dual-source pending].
 */
import { DtcError } from "../core/errors.js";
import {
  applyQ2Big,
  applyQ3Big,
  binomialBig,
  dotDBig,
  type BigRational,
  krawtchoukBigVector,
} from "./armor.js";

// ---------------------------------------------------------------------------
// Exact rational helpers (local, gcd-reduced: the double face carries up to
// (dim-1)^2 addends and unreduced accumulation would multiply denominators
// needlessly; reduction never changes a value).
// ---------------------------------------------------------------------------

function gcdBig(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

function ratAdd(a: BigRational, b: BigRational): BigRational {
  const num = a.num * b.den + b.num * a.den;
  const den = a.den * b.den;
  const g = gcdBig(num, den);
  return { num: num / g, den: den / g };
}

const ZERO: BigRational = { num: 0n, den: 1n };

// ---------------------------------------------------------------------------
// Q_4 — the EXACT p^4 coefficient of the absorbing block. Every transition's
// probability is C(n-w,a) C(w,b) p^(a+b) (1-p)^(n-a-b); expanding (1-p)^n
// gives, at total order 4, the five flip-count groups below with coefficients
// C(n-a-b, 4-a-b) (-1)^(4-a-b): +1 (four flips), -(n-3) (three), +C(n-2,2)
// (two), -C(n-1,3) (one), +C(n,4) (zero) — Dirichlet-truncated at w+k < dim,
// mirroring applyQ2Big/applyQ3Big line for line.
// ---------------------------------------------------------------------------

/** The exact p^4 coefficient Q_4 applied to a BigInt block vector. */
export function applyQ4Big(
  n: number,
  dim: number,
  x: readonly bigint[],
): bigint[] {
  const out: bigint[] = [];
  for (let w = 0; w < dim; w++) {
    let acc = 0n;
    // four-flip counts, coefficient +1
    if (w + 4 < dim && n - w >= 4) acc += binomialBig(n - w, 4) * x[w + 4]!;
    if (w + 2 < dim && n - w >= 3 && w >= 1) {
      acc += binomialBig(n - w, 3) * BigInt(w) * x[w + 2]!;
    }
    if (n - w >= 2 && w >= 2)
      acc += binomialBig(n - w, 2) * binomialBig(w, 2) * x[w]!;
    if (w - 2 >= 0 && n - w >= 1 && w >= 3)
      acc += BigInt(n - w) * binomialBig(w, 3) * x[w - 2]!;
    if (w - 4 >= 0) acc += binomialBig(w, 4) * x[w - 4]!;
    // three-flip counts, coefficient -(n-3)
    let t3 = 0n;
    if (w + 3 < dim && n - w >= 3) t3 += binomialBig(n - w, 3) * x[w + 3]!;
    if (w + 1 < dim && n - w >= 2 && w >= 1) {
      t3 += ((BigInt(n - w) * BigInt(n - w - 1)) / 2n) * BigInt(w) * x[w + 1]!;
    }
    if (w - 1 >= 0 && n - w >= 1 && w >= 2) {
      t3 += BigInt(n - w) * ((BigInt(w) * BigInt(w - 1)) / 2n) * x[w - 1]!;
    }
    if (w - 3 >= 0) t3 += binomialBig(w, 3) * x[w - 3]!;
    acc += -BigInt(n - 3) * t3;
    // two-flip counts, coefficient +C(n-2,2)
    let t2 = 0n;
    if (w + 2 < dim && n - w >= 2)
      t2 += ((BigInt(n - w) * BigInt(n - w - 1)) / 2n) * x[w + 2]!;
    if (n - w >= 1 && w >= 1) t2 += BigInt(n - w) * BigInt(w) * x[w]!;
    if (w - 2 >= 0) t2 += ((BigInt(w) * BigInt(w - 1)) / 2n) * x[w - 2]!;
    acc += ((BigInt(n - 2) * BigInt(n - 3)) / 2n) * t2;
    // one-flip counts, coefficient -C(n-1,3)
    let t1 = 0n;
    if (w + 1 < dim) t1 += BigInt(n - w) * x[w + 1]!;
    if (w - 1 >= 0) t1 += BigInt(w) * x[w - 1]!;
    acc += -((BigInt(n - 1) * BigInt(n - 2) * BigInt(n - 3)) / 6n) * t1;
    // zero-flip, coefficient +C(n,4)
    acc +=
      ((BigInt(n) * BigInt(n - 1) * BigInt(n - 2) * BigInt(n - 3)) / 24n) *
      x[w]!;
    out.push(acc);
  }
  return out;
}

// ---------------------------------------------------------------------------
// The four faces of c_4, exact BigInt rationals.
// ---------------------------------------------------------------------------

/** The four RS faces of c_4(n): quotient, mixed, double, normalization. */
export interface FourthOrderFaces {
  /** <u,Q_4 u>/<u,u> — the plain quotient face. */
  readonly quotient: BigRational;
  /** 2 sum_j cpl_j c3_j/(Delta_j vv_j uu) — the Q_2 x Q_3 coupling face. */
  readonly mixed: BigRational;
  /** sum_{j,k} cpl_j Q2_jk cpl_k/(Delta_j Delta_k vv_j vv_k uu) — the Q_2
   * coupling squared through the second-order correction vector. */
  readonly double: BigRational;
  /** -c_2 sum_j cpl_j^2/(Delta_j^2 vv_j uu) — the normalization subtraction. */
  readonly normalization: BigRational;
}

/** The four faces of c_4(n) as exact BigInt rationals (even n >= 4). */
export function fourthOrderFaces(n: number): FourthOrderFaces {
  if (n < 4 || n % 2 !== 0) {
    throw new DtcError(
      "E/DOMAIN",
      `fourthOrderFaces: even n >= 4 required, got ${n}`,
    );
  }
  const dim = n / 2;
  const u = Array.from({ length: dim }, (_, w) => BigInt(n - 2 * w));
  const uu = dotDBig(n, dim, u, u);
  const q2u = applyQ2Big(n, dim, u);
  const q3u = applyQ3Big(n, dim, u);
  const quotient: BigRational = {
    num: dotDBig(n, dim, u, applyQ4Big(n, dim, u)),
    den: uu,
  };
  const c2Num = dotDBig(n, dim, u, q2u); // <u,Q_2 u> (c_2 = c2Num/uu)

  const js: number[] = [];
  for (let j = 3; j <= 2 * dim - 1; j += 2) js.push(j);
  const vv: bigint[] = [];
  const cpl: bigint[] = [];
  const c3c: bigint[] = [];
  const modes: bigint[][] = [];
  const q2Modes: bigint[][] = [];
  for (const j of js) {
    const vj = krawtchoukBigVector(n, j, dim);
    vv.push(dotDBig(n, dim, vj, vj));
    cpl.push(dotDBig(n, dim, vj, q2u));
    c3c.push(dotDBig(n, dim, vj, q3u));
    modes.push(vj);
    q2Modes.push(applyQ2Big(n, dim, vj));
  }

  let mixed = ZERO;
  let dbl = ZERO;
  let nrm = ZERO;
  for (let i = 0; i < js.length; i++) {
    const di = BigInt(2 * (js[i]! - 1));
    mixed = ratAdd(mixed, {
      num: 2n * cpl[i]! * c3c[i]!,
      den: di * vv[i]! * uu,
    });
    nrm = ratAdd(nrm, {
      num: -c2Num * cpl[i]! * cpl[i]!,
      den: uu * di * di * vv[i]! * uu,
    });
    for (let k = 0; k < js.length; k++) {
      const dk = BigInt(2 * (js[k]! - 1));
      const q2jk = dotDBig(n, dim, modes[i]!, q2Modes[k]!);
      dbl = ratAdd(dbl, {
        num: cpl[i]! * q2jk * cpl[k]!,
        den: di * dk * vv[i]! * vv[k]! * uu,
      });
    }
  }
  return { quotient, mixed, double: dbl, normalization: nrm };
}

/** c_4(n) as the exact four-face sum (even n >= 4). */
export function fourthOrderClosedRational(n: number): BigRational {
  const f = fourthOrderFaces(n);
  return ratAdd(ratAdd(f.quotient, f.mixed), ratAdd(f.double, f.normalization));
}

/** c_4(n) as a float (the exact rational at the float floor). */
export function fourthOrderClosed(n: number): number {
  const r = fourthOrderClosedRational(n);
  return Number(r.num) / Number(r.den);
}

// ---------------------------------------------------------------------------
// The spec-as-written variant — THREE faces with "the square of the Q_3
// coupling" as the repulsion content, exactly as the R18 design stock
// described it. CONVICTED by the eigenvalue residual (the test): kept as a
// named export so the conviction is reproducible, not folklore.
// ---------------------------------------------------------------------------

/** The spec-as-written inventory: quotient + mixed + a Q_3-coupling square
 * face; the double and normalization faces absent. NOT c_4 — the eigenvalue
 * refuses it (see the tests). */
export function fourthOrderSpecVariant(n: number): BigRational {
  const f0 = fourthOrderFaces(n);
  const dim = n / 2;
  const u = Array.from({ length: dim }, (_, w) => BigInt(n - 2 * w));
  const uu = dotDBig(n, dim, u, u);
  const q3u = applyQ3Big(n, dim, u);
  let q3sq = ZERO;
  for (let j = 3; j <= 2 * dim - 1; j += 2) {
    const vj = krawtchoukBigVector(n, j, dim);
    const c3 = dotDBig(n, dim, vj, q3u);
    const vv = dotDBig(n, dim, vj, vj);
    const d = BigInt(2 * (j - 1));
    q3sq = ratAdd(q3sq, { num: c3 * c3, den: d * d * vv * uu });
  }
  return ratAdd(ratAdd(f0.quotient, f0.mixed), q3sq);
}

// ---------------------------------------------------------------------------
// The identity chain at fourth order: 8<u,Q_4 u> + (3n-2)<u,Q_3 u> +
// 2(n-2)<u,Q_2 u> = 0 (the all-integer form of 4<u,Q_4 u> +
// ((3n-2)/2)<u,Q_3 u> + (n-2)<u,Q_2 u> = 0). Cheap road: no Krawtchouk
// vectors, runs to large n.
// ---------------------------------------------------------------------------

/** The fourth-order identity-chain residue (zero for every even n >= 4). */
export function fourthOrderIdentityResidue(n: number): bigint {
  if (n < 4 || n % 2 !== 0) {
    throw new DtcError(
      "E/DOMAIN",
      `fourthOrderIdentityResidue: even n >= 4 required, got ${n}`,
    );
  }
  const dim = n / 2;
  const u = Array.from({ length: dim }, (_, w) => BigInt(n - 2 * w));
  const t2 = dotDBig(n, dim, u, applyQ2Big(n, dim, u));
  const t3 = dotDBig(n, dim, u, applyQ3Big(n, dim, u));
  const t4 = dotDBig(n, dim, u, applyQ4Big(n, dim, u));
  return 8n * t4 + BigInt(3 * n - 2) * t3 + 2n * BigInt(n - 2) * t2;
}

/** The chain's quotient-face consequence: <u,Q_4 u>/<u,u> =
 * (3n-8)(n-2)(n-1) C(n-2,(n-2)/2) / (24 * 2^(n-2)) — the general-n closed
 * form the chain forces (c_2's law times (3n-8)(n-2)/24). */
export function fourthOrderQuotientGeneral(n: number): BigRational {
  if (n < 4 || n % 2 !== 0) {
    throw new DtcError(
      "E/DOMAIN",
      `fourthOrderQuotientGeneral: even n >= 4 required, got ${n}`,
    );
  }
  return {
    num:
      BigInt((3 * n - 8) * (n - 2) * (n - 1)) * binomialBig(n - 2, (n - 2) / 2),
    den: 24n * 2n ** BigInt(n - 2),
  };
}

/** The block-road quotient face alone — <u,Q_4 u>/<u,u> with NO Krawtchouk
 * modes and no repulsion faces (the wide-grid road: n=40 costs what one
 * applyQ4Big costs). */
export function fourthOrderQuotientRational(n: number): BigRational {
  if (n < 4 || n % 2 !== 0) {
    throw new DtcError(
      "E/DOMAIN",
      `fourthOrderQuotientRational: even n >= 4 required, got ${n}`,
    );
  }
  const dim = n / 2;
  const u = Array.from({ length: dim }, (_, w) => BigInt(n - 2 * w));
  return {
    num: dotDBig(n, dim, u, applyQ4Big(n, dim, u)),
    den: dotDBig(n, dim, u, u),
  };
}

// ---------------------------------------------------------------------------
// The crossing road. X_k sums the BOUNDARY-CROSSING order-k transitions
// (w < dim, v > dim) with both u-factors; since the full-chain expectation is
// exactly linear (2T + 2X = 2^n n (1-2p)), T_k = -X_k at every k >= 2.
// ---------------------------------------------------------------------------

/** The crossing sum X_k (order k = 2..4), enumerating every (a,b) pair with
 * a+b <= k, v = w+a-b > n/2 — a road sharing no arithmetic with applyQkBig. */
function crossingSum(n: number, k: number): bigint {
  const dim = n / 2;
  let s = 0n;
  for (let w = 0; w < dim; w++) {
    for (let a = 0; a <= k; a++) {
      for (let b = 0; a + b <= k; b++) {
        const v = w + a - b;
        if (v <= dim || v > n) continue; // v = dim carries u = 0; v > n impossible
        const c = k - a - b;
        const binom =
          binomialBig(n, w) *
          binomialBig(n - w, a) *
          binomialBig(w, b) *
          binomialBig(n - a - b, c);
        s +=
          BigInt(n - 2 * w) *
          BigInt(n - 2 * v) *
          binom *
          (c % 2 === 0 ? 1n : -1n);
      }
    }
  }
  return s;
}

/** The two-road residue T_k + X_k (zero ⟺ the block road and the crossing
 * road agree exactly) — the independent-arithmetic certificate. */
export function crossingQuotientResidue(n: number, k: number): bigint {
  if (n < 4 || n % 2 !== 0 || k < 2 || k > 4) {
    throw new DtcError(
      "E/DOMAIN",
      `crossingQuotientResidue: even n >= 4, k in 2..4, got (${n},${k})`,
    );
  }
  const dim = n / 2;
  const u = Array.from({ length: dim }, (_, w) => BigInt(n - 2 * w));
  const tk =
    k === 2
      ? dotDBig(n, dim, u, applyQ2Big(n, dim, u))
      : k === 3
        ? dotDBig(n, dim, u, applyQ3Big(n, dim, u))
        : dotDBig(n, dim, u, applyQ4Big(n, dim, u));
  return tk + crossingSum(n, k);
}

/** The full-chain linearity residual at float p: |2T(p) + 2X(p) -
 * 2^n n (1-2p)| relative — the analytic foundation the crossing road stands
 * on, pinned on the machine (not just derived in the comment). */
export function fullChainLinearityResidual(n: number, p: number): number {
  const binomRow = (m: number): number[] => {
    const row: number[] = [1];
    for (let i = 1; i <= m; i++) row[i] = (row[i - 1]! * (m - i + 1)) / i;
    return row;
  };
  const rows: number[][] = Array.from({ length: n + 1 }, (_, m) => binomRow(m));
  const cn = binomRow(n);
  const uw = (w: number): number => n - 2 * w;
  let t = 0;
  let x = 0;
  for (let w = 0; w <= n; w++) {
    for (let a = 0; a <= n - w; a++) {
      for (let b = 0; b <= w; b++) {
        const v = w + a - b;
        const prob =
          rows[n - w]![a]! *
          rows[w]![b]! *
          Math.pow(p, a + b) *
          Math.pow(1 - p, n - a - b);
        const term = cn[w]! * uw(w) * uw(v) * prob;
        if (w < n / 2 && v < n / 2) t += term;
        else if (w < n / 2 && v > n / 2) x += term;
        // the mirrored halves double T and X exactly; the cross terms at the
        // tie plane carry u = 0
      }
    }
  }
  const full = 2 * t + 2 * x;
  const target = 2 ** n * n * (1 - 2 * p);
  return Math.abs(full - target) / Math.abs(target);
}
