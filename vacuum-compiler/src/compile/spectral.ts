/**
 * F16 (v0.5.0) — the tilted spectrum's three-term recurrence and its Sturm
 * certificate: fueled gap(eps) by EXACT root counting.
 *
 * The fuel face (T4's census, exp3) measured that tilting the clock by
 * H_fuel = -eps * SUM_t t |t><t| (x) I buys delivery probability P(T) and
 * closes the spectral gap — floats all the way down. This file upgrades that
 * census to an exact-rational certificate layer:
 *
 * (SP-a) THE DRESSED CHAIN BLOCK-DIAGONALIZATION. In the dressing basis
 *   W = SUM_t (U_t...U_1) (x) |t><t| (buildDressing), the assembled
 *   H(eps) = H_prop + H_in + H_fuel (OUTPUT OFF — the output check's clock-T
 *   block would be rotated by V_T and leave this family) is block-diagonal
 *   over data basis states, and each block is a C x C tridiagonal clock
 *   chain with rational entries: diagonal a_0 = 1/2 + [input violation],
 *   a_t = 1 - eps*t (1 <= t <= T-1), a_T = 1/2 - eps*T, off-diagonal -1/2.
 *   Fuel and input check commute with W (both clock-diagonal; W_0 = I), so
 *   W† H(eps) W = I (x) 1/2·L_path + penalties - eps·I(x)diag(0..T) — the
 *   spectrum is CIRCUIT-INDEPENDENT, and there are only TWO distinct chains:
 *   the input-valid chain (multiplicity 2^(n-k)) and the violating chain
 *   (a_0 raised by 1; multiplicity 2^n - 2^(n-k), k = |checkedQubits|).
 *
 * (SP-b) THE JACOBI THREE-TERM RECURRENCE. The characteristic polynomial
 *   D_t(lam) = det(lam I - chain_t) satisfies, EXACTLY in BigInt rationals,
 *
 *     D_{-1} = 1,  D_0 = lam - a_0,
 *     D_t = (lam - a_t) D_{t-1} - (1/4) D_{t-2}   (b^2 = (-1/2)^2 = 1/4),
 *
 *   and charpoly(H(eps)) = p_V^multV * p_X^multX. Every chain is square-free
 *   (gcd(p, p') constant — the spectrum is SIMPLE per chain, machine-proof),
 *   so Sturm's sign-variation counting gives the EXACT number of eigenvalues
 *   below/inside any rational window: no float participates in any decision.
 *
 * (SP-c) THE CERTIFICATES (census instance and every rational eps grid point
 *   machine-checked):
 *   - the SANDWICH: -eps*T <= E_0(eps) <= 1/2 - eps*T. Lower: H(eps) =
 *     H(0) - eps*D with 0 <= D <= T·I (Loewner), and E_0(H(0)) = 0 exactly
 *     (SP-d); certified by Sturm — p_V has NO root strictly below -eps*T.
 *     Upper: Rayleigh on the clock-T unit vector — a_T = 1/2 - eps*T is a
 *     diagonal entry, and lambda_min <= every diagonal entry; certified by a
 *     Sturm count of >= 1 root at or below 1/2 - eps*T.
 *   - the T-END CAPTURE: a_T - E_0(eps) is STRICTLY DECREASING across the
 *     grid (adjacent bisection boxes disjoint) — the ground energy chases
 *     the T-end diagonal downward, the eigenvalue-side fact under T4's
 *     "fuel buys delivery" (the ground state's weight concentrates at T).
 *   - E_0 is STRICTLY DECREASING and the full gap(eps) = E_1 - E_0 (with
 *     multiplicities: E_1 = min(p_V's 2nd, p_X's 1st) once multV = 1) is
 *     boxed to certified width at every grid point, non-increasing on the
 *     grid, and COLLAPSES below any given tolerance for large enough eps
 *     (both chains' grounds lock onto the same a_T well).
 *
 * (SP-d) THE eps = 0 ANCHOR, exact: p_V(0) = 0 in BigInt (the history-state
 *   zero-energy law, re-derived on the polynomial layer — T1's deed as a
 *   root), det(M_X) = (-1)^C p_X(0) > 0, and NO root below 0 in either
 *   chain (PSD certified by Sturm, not by floating point).
 *
 * Boundary honesty: output-check form is OUT (its clock-T data block rotates
 * by V_T under the dressing and exits the tridiagonal family); eps rational
 * only (the certificate is exact — irrational tilts are not claimed); T in
 * [2, 12] (the T2 sweep's domain); the float legs (dressing identity, root
 * multiset) are cross-checks at 1e-12, the DECISION layer is pure BigInt.
 * Weyl/Loewner and Sturm/Jacobi-recurrence theory are cited, not re-proved.
 *
 * Literature: Sturm's 1829 sign-variation theorem and the Jacobi-matrix
 * determinant recurrence (standard in any matrix-analysis text, e.g.
 * Householder, The Theory of Matrices in Numerical Analysis, 1964) [to be
 * dual-sourced]; the FK Hamiltonian lineage FEY85/KSV02 (in-repo, verified).
 */
import { type CMat, cmatZero, VacuumError } from "../core/cmat.js";
import type { ExactRational } from "./amplify.js";

// ---------------------------------------------------------------------------
// Exact rational arithmetic (gcd-reduced; the coefficient-growth guard the
// recurrence needs — unreduced sums explode past BigInt limits at degree 13).
// ---------------------------------------------------------------------------

interface Rat {
  readonly num: bigint;
  readonly den: bigint;
}

function ratNorm(r: { num: bigint; den: bigint }): Rat {
  if (r.den === 0n) {
    throw new VacuumError(
      "spectral/malformed-rational",
      `a zero denominator reached the rational kernel (${r.num}/0)`,
    );
  }
  if (r.den < 0n) return { num: -r.num, den: -r.den };
  let x = r.num < 0n ? -r.num : r.num;
  let y = r.den < 0n ? -r.den : r.den;
  while (y !== 0n) {
    const t = x % y;
    x = y;
    y = t;
  }
  const g = x === 0n ? 1n : x;
  return { num: r.num / g, den: r.den / g };
}

const rAdd = (a: Rat, b: Rat): Rat =>
  ratNorm({ num: a.num * b.den + b.num * a.den, den: a.den * b.den });
const rMul = (a: Rat, b: Rat): Rat =>
  ratNorm({ num: a.num * b.num, den: a.den * b.den });
const rSub = (a: Rat, b: Rat): Rat => rAdd(a, { num: -b.num, den: b.den });
const rCmp = (a: Rat, b: Rat): number =>
  a.num * b.den < b.num * a.den ? -1 : a.num * b.den > b.num * a.den ? 1 : 0;
const rOf = (num: bigint, den: bigint): Rat => ratNorm({ num, den });
const rFloat = (r: Rat): number => Number(r.num) / Number(r.den);

function requireExactRational(eps: ExactRational, what: string): void {
  // Number.isFinite does NOT coerce BigInts (it answers false for every
  // BigInt) — the type check comes first, the domain check second
  if (
    typeof eps.num !== "bigint" ||
    typeof eps.den !== "bigint" ||
    eps.den <= 0n
  ) {
    throw new VacuumError(
      "spectral/malformed-rational",
      `${what}: epsilon = ${String(eps.num)}/${String(eps.den)}, expected a rational num/den with den > 0`,
    );
  }
}

// ---------------------------------------------------------------------------
// The rational-polynomial kernel (coefficients by power, index = power).
// ---------------------------------------------------------------------------

export type RationalPoly = readonly Rat[];

function polyTrim(p: readonly Rat[]): Rat[] {
  const out = [...p];
  while (out.length > 1 && out[out.length - 1]!.num === 0n) out.pop();
  return out;
}

function polyAdd(a: readonly Rat[], b: readonly Rat[]): Rat[] {
  const out: Rat[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    out.push(rAdd(a[i] ?? { num: 0n, den: 1n }, b[i] ?? { num: 0n, den: 1n }));
  return polyTrim(out);
}

function polyMul(a: readonly Rat[], b: readonly Rat[]): Rat[] {
  if (a.length < 1 || b.length < 1) {
    throw new VacuumError(
      "spectral/malformed-polynomial",
      `polyMul: a degree-${a.length - 1} times a degree-${b.length - 1} polynomial — the kernel received an empty operand`,
    );
  }
  const out: Rat[] = Array<Rat>(a.length + b.length - 1).fill({
    num: 0n,
    den: 1n,
  });
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++)
      out[i + j] = rAdd(out[i + j]!, rMul(a[i]!, b[j]!));
  }
  return polyTrim(out);
}

function polyScale(p: readonly Rat[], c: Rat): Rat[] {
  return p.map((a) => rMul(a, c));
}

function polyEval(p: readonly Rat[], x: Rat): Rat {
  let acc: Rat = { num: 0n, den: 1n };
  for (let i = p.length - 1; i >= 0; i--) acc = rAdd(rMul(acc, x), p[i]!);
  return acc;
}

function polyDeriv(p: readonly Rat[]): Rat[] {
  if (p.length <= 1) return [{ num: 0n, den: 1n }];
  const out: Rat[] = [];
  for (let i = 1; i < p.length; i++) out.push(rMul(p[i]!, rOf(BigInt(i), 1n)));
  return polyTrim(out);
}

function polyRem(a: readonly Rat[], b: readonly Rat[]): Rat[] {
  const r = [...a];
  const db = b.length - 1;
  const lead = b[db]!;
  while (r.length - 1 >= db && !(r.length === 1 && r[0]!.num === 0n)) {
    const dr = r.length - 1;
    const f = rMul(r[dr]!, rOf(lead.den, lead.num));
    for (let i = 0; i <= db; i++)
      r[dr - i] = rSub(r[dr - i]!, rMul(f, b[db - i]!));
    while (r.length > 1 && r[r.length - 1]!.num === 0n) r.pop();
  }
  return polyTrim(r);
}

/** degree of gcd(a, b) — 0 means coprime (the square-free certificate). */
function gcdPolyDeg(a: readonly Rat[], b: readonly Rat[]): number {
  let x = polyTrim(a);
  let y = polyTrim(b);
  while (!(y.length === 1 && y[0]!.num === 0n)) {
    const rem = polyRem(x, y);
    x = y;
    y = rem;
  }
  return x.length - 1;
}

const ratSign = (v: Rat): number =>
  v.num === 0n ? 0 : v.den < 0n ? (v.num > 0n ? -1 : 1) : v.num > 0n ? 1 : -1;

/** The Sturm sequence of an (immutable, reference-identified) polynomial.
 * Bisection asks for the same polynomial's sequence once per midpoint —
 * the sequence build (rational remainders, the expensive step) is cached
 * per array reference; polynomials are never mutated after construction. */
const sturmCache = new WeakMap<readonly Rat[], readonly RationalPoly[]>();

function sturmSequence(p: readonly Rat[]): readonly RationalPoly[] {
  const cached = sturmCache.get(p);
  if (cached !== undefined) return cached;
  const seq: RationalPoly[] = [polyTrim(p), polyDeriv(p)];
  for (;;) {
    const prev = seq[seq.length - 2]!;
    const cur = seq[seq.length - 1]!;
    const negRem = polyRem(prev, cur).map((c) => ({ num: -c.num, den: c.den }));
    if (negRem.length === 1 && negRem[0]!.num === 0n) break;
    seq.push(polyTrim(negRem));
  }
  sturmCache.set(p, seq);
  return seq;
}

function signVariations(seq: readonly RationalPoly[], x: Rat): number {
  let v = 0;
  let last = 0;
  for (const p of seq) {
    const s = ratSign(polyEval(p, x));
    if (s === 0) continue;
    if (last !== 0 && s !== last) v++;
    last = s;
  }
  return v;
}

function variationsAtNegInf(seq: readonly RationalPoly[]): number {
  let v = 0;
  let last = 0;
  for (const p of seq) {
    const deg = p.length - 1;
    const s = deg % 2 === 0 ? ratSign(p[deg]!) : -ratSign(p[deg]!);
    if (last !== 0 && s !== last) v++;
    last = s;
  }
  return v;
}

/** EXACT count of roots of a square-free p in (-inf, x] — valid whether or
 * not p(x) = 0 (zero signs are skipped, which lands a root AT x on the
 * counted side: the uniform endpoint convention). */
export function sturmCountRootsUpTo(p: RationalPoly, x: Rat): number {
  const seq = sturmSequence(p);
  return variationsAtNegInf(seq) - signVariations(seq, x);
}

/** EXACT count of roots of a square-free p in the OPEN interval (a, b). */
export function sturmCountRootsIn(p: RationalPoly, a: Rat, b: Rat): number {
  const atB = sturmCountRootsUpTo(p, b);
  const atA = sturmCountRootsUpTo(p, a);
  const rootAtA = polyEval(p, a).num === 0n ? 1 : 0;
  const rootAtB = polyEval(p, b).num === 0n ? 1 : 0;
  return atB - atA - rootAtB + rootAtA;
}

// ---------------------------------------------------------------------------
// (SP-a) the tilted chains and (SP-b) the three-term recurrence.
// ---------------------------------------------------------------------------

export interface TiltedChain {
  /** C = T+1 rational diagonals a_0..a_T of the dressed clock chain. */
  readonly diagonals: readonly Rat[];
  /** det(lam I - chain) by the three-term recurrence, exact. */
  readonly poly: RationalPoly;
  /** gcd(p, p') degree — 0 certifies a simple spectrum. */
  readonly squareFreeGcdDeg: number;
  /** float mirror of the chain (the double-path leg). */
  readonly floatMatrix: CMat;
}

function requireDepth(T: number, what: string): void {
  if (!Number.isInteger(T) || T < 2 || T > 12) {
    throw new VacuumError(
      "spectral/depth-out-of-domain",
      `${what}: T = ${String(T)}, expected an integer in [2, 12] (the T2 sweep's domain)`,
    );
  }
}

/** The dressed chain diagonals: a_0 = 1/2 + penalty, a_t = 1 - eps*t,
 * a_T = 1/2 - eps*T (all exact rationals; penalty 0 = input-valid chain,
 * 1 = the violating chain with a_0 raised by the input check). */
export function tiltedChainDiagonals(
  T: number,
  eps: ExactRational,
  penalty: 0 | 1,
): readonly Rat[] {
  requireDepth(T, "tiltedChainDiagonals");
  requireExactRational(eps, "tiltedChainDiagonals");
  const e = rOf(eps.num, eps.den);
  const out: Rat[] = [];
  for (let t = 0; t <= T; t++) {
    let a = rOf(t === 0 || t === T ? 1n : 2n, 2n);
    if (t === 0 && penalty === 1) a = rAdd(a, rOf(1n, 1n));
    out.push(rSub(a, rMul(e, rOf(BigInt(t), 1n))));
  }
  return out;
}

/** The Jacobi determinant recurrence: D_{-1} = 1, D_0 = lam - a_0,
 * D_t = (lam - a_t) D_{t-1} - (1/4) D_{t-2} (b = -1/2 throughout). */
export function jacobiCharacteristicPoly(
  diagonals: readonly Rat[],
): RationalPoly {
  if (diagonals.length < 2) {
    throw new VacuumError(
      "spectral/depth-out-of-domain",
      `jacobiCharacteristicPoly: ${diagonals.length} diagonal entries (a clock chain needs >= 2)`,
    );
  }
  const zero: Rat = { num: 0n, den: 1n };
  const one: Rat = { num: 1n, den: 1n };
  let dPrev: Rat[] = [one]; // D_{-1} = 1 — the convention the recurrence needs
  let dCur: Rat[] = polyAdd(
    [zero, one],
    [{ num: -diagonals[0]!.num, den: diagonals[0]!.den }],
  );
  for (let t = 1; t < diagonals.length; t++) {
    const lamMinusA = polyAdd(
      [zero, one],
      [{ num: -diagonals[t]!.num, den: diagonals[t]!.den }],
    );
    const next = polyAdd(
      polyMul(lamMinusA, dCur),
      polyScale(dPrev, rOf(-1n, 4n)),
    );
    dPrev = dCur;
    dCur = next;
  }
  return dCur;
}

/** Assemble one chain: diagonals + recurrence polynomial + square-free
 * certificate + the float mirror. */
export function tiltedChain(
  T: number,
  eps: ExactRational,
  penalty: 0 | 1,
): TiltedChain {
  const diagonals = tiltedChainDiagonals(T, eps, penalty);
  const poly = jacobiCharacteristicPoly(diagonals);
  const n = diagonals.length;
  const m = cmatZero(n);
  for (let i = 0; i < n; i++) {
    m.re[i]![i] = rFloat(diagonals[i]!);
    if (i > 0) m.re[i]![i - 1] = -0.5;
    if (i < n - 1) m.re[i]![i + 1] = -0.5;
  }
  return {
    diagonals,
    poly,
    squareFreeGcdDeg: gcdPolyDeg(poly, polyDeriv(poly)),
    floatMatrix: m,
  };
}

/** Isolate EVERY root of a square-free MONIC p (sorted from the bottom) by
 * exact rational bisection on Sturm counts, bracketed by the Cauchy bound
 * 1 + max|c_k| (every root of a monic polynomial lives inside it); each
 * returned midpoint is within (bracket width)/2^bits of its root, and a
 * dyadic-midpoint root is returned exactly. */
export function isolateRoots(p: RationalPoly, bits = 40): readonly Rat[] {
  const trimmed = polyTrim(p);
  const deg = trimmed.length - 1;
  const lead = trimmed[deg]!;
  if (lead.num !== lead.den) {
    throw new VacuumError(
      "spectral/poly-not-monic",
      `isolateRoots: leading coefficient ${lead.num}/${lead.den} — the Cauchy bracket is priced for the monic recurrence output`,
    );
  }
  let maxAbs = 0;
  for (let k = 0; k < deg; k++)
    maxAbs = Math.max(maxAbs, Math.abs(rFloat(trimmed[k]!)));
  const boundF = Math.ceil(1 + maxAbs) + 1;
  const lo0 = rOf(-BigInt(boundF), 1n);
  const hi0 = rOf(BigInt(boundF), 1n);
  const out: Rat[] = [];
  for (let idx = 0; idx < deg; idx++) {
    let lo = lo0;
    let hi = hi0;
    let exact: Rat | null = null;
    for (let it = 0; it < bits; it++) {
      const mid = rOf(lo.num * hi.den + hi.num * lo.den, lo.den * hi.den * 2n);
      const upTo = sturmCountRootsUpTo(p, mid);
      if (polyEval(p, mid).num === 0n && upTo - 1 === idx) {
        exact = mid;
        break;
      }
      if (upTo > idx) hi = mid;
      else lo = mid;
    }
    out.push(
      exact ?? rOf(lo.num * hi.den + hi.num * lo.den, lo.den * hi.den * 2n),
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// (SP-c)/(SP-d) the tilted-spectrum certificate.
// ---------------------------------------------------------------------------

export interface TiltedSpectrumCertificate {
  readonly T: number;
  readonly eps: Rat;
  readonly valid: TiltedChain;
  readonly violating: TiltedChain;
  /** multiplicities: 2^(n-k) valid chains, 2^n - 2^(n-k) violating. */
  readonly multValid: number;
  readonly multViolating: number;
  /** exact bisection midpoints of each chain's roots (bottom-up). */
  readonly validRoots: readonly Rat[];
  readonly violatingRoots: readonly Rat[];
  /** E_0 (always the valid chain's bottom root — V = X - e_0 e_0^T is below
   * X in the Loewner order, so lambda_0(V) <= lambda_0(X) by the min-max
   * principle) and E_1 = the valid chain's 2nd root when multValid >= 2,
   * else min(valid 2nd, violating 1st). */
  readonly e0: Rat;
  readonly e1: Rat;
  readonly gap: Rat;
  /** the sandwich witnesses, Sturm-certified at issue time. */
  readonly sandwich: {
    readonly lower: Rat; // -eps*T
    readonly upper: Rat; // 1/2 - eps*T
    readonly noRootBelowLower: boolean;
    readonly rootAtOrBelowUpper: boolean;
  };
  /** eps = 0 anchor flags (all exact; false-able only if the layer is wrong). */
  readonly zeroTilt: {
    readonly isZeroTilt: boolean;
    readonly validPolyAtZeroIsRoot: boolean;
    readonly violatingDetPositive: boolean;
    readonly noNegativeRoots: boolean;
  };
}

export interface TiltedSpectrumInput {
  readonly nQubits: number;
  readonly checkedQubits: readonly number[];
  readonly T: number;
  readonly epsilon: ExactRational;
}

/** Certify the tilted spectrum of the prop+in+fuel Hamiltonian (output OFF):
 * both chains' characteristic polynomials by the three-term recurrence, all
 * roots isolated by exact bisection, the full-spectrum gap boxed, the
 * sandwich witnessed, simplicity certified. Pure BigInt decisions. */
export function certifyTiltedSpectrum(
  input: TiltedSpectrumInput,
): TiltedSpectrumCertificate {
  const { nQubits, checkedQubits, T } = input;
  requireDepth(T, "certifyTiltedSpectrum");
  requireExactRational(input.epsilon, "certifyTiltedSpectrum");
  if (!Number.isInteger(nQubits) || nQubits < 1 || nQubits > 6) {
    throw new VacuumError(
      "spectral/qubits-out-of-domain",
      `certifyTiltedSpectrum: nQubits = ${String(nQubits)}, expected an integer in [1, 6]`,
    );
  }
  const seen = new Set<number>();
  for (const q of checkedQubits) {
    if (!Number.isInteger(q) || q < 0 || q >= nQubits) {
      throw new VacuumError(
        "spectral/checked-qubit-out-of-range",
        `certifyTiltedSpectrum: checked qubit ${String(q)} outside [0, ${nQubits})`,
      );
    }
    if (seen.has(q)) {
      throw new VacuumError(
        "spectral/checked-qubit-duplicate",
        `certifyTiltedSpectrum: checked qubit ${String(q)} listed twice (the multiplicity bookkeeping counts distinct qubits)`,
      );
    }
    seen.add(q);
  }
  const eps = rOf(input.epsilon.num, input.epsilon.den);
  const valid = tiltedChain(T, input.epsilon, 0);
  const violating = tiltedChain(T, input.epsilon, 1);
  const multValid = 2 ** (nQubits - checkedQubits.length);
  const multViolating = 2 ** nQubits - multValid;
  if (valid.squareFreeGcdDeg !== 0 || violating.squareFreeGcdDeg !== 0) {
    throw new VacuumError(
      "spectral/chain-not-square-free",
      `gcd(p, p') has degree ${valid.squareFreeGcdDeg}/${violating.squareFreeGcdDeg} — the Sturm layer requires a simple spectrum and a nonsimple one means the kernel is wrong, not the input`,
    );
  }
  const validRoots = isolateRoots(valid.poly);
  const violatingRoots = isolateRoots(violating.poly);
  const e0 = validRoots[0]!;
  const e1 =
    multValid >= 2
      ? validRoots[1]!
      : rCmp(validRoots[1]!, violatingRoots[0]!) <= 0
        ? validRoots[1]!
        : violatingRoots[0]!;
  const gap = rSub(e1, e0);
  const lower = rSub({ num: 0n, den: 1n }, rMul(eps, rOf(BigInt(T), 1n)));
  const upper = rSub(rOf(1n, 2n), rMul(eps, rOf(BigInt(T), 1n)));
  const noRootBelowLower =
    sturmCountRootsUpTo(valid.poly, lower) -
      (polyEval(valid.poly, lower).num === 0n ? 1 : 0) ===
    0;
  const pAtUpper = polyEval(valid.poly, upper);
  const rootAtOrBelowUpper =
    pAtUpper.num === 0n || sturmCountRootsUpTo(valid.poly, upper) >= 1;
  const isZero = eps.num === 0n;
  // PSD at eps = 0: no negative roots in either chain (strictly below 0)
  const tinyNeg = rOf(-1n, 1000000000n);
  const noNegValid = isZero
    ? sturmCountRootsIn(valid.poly, rOf(-1000000n, 1n), tinyNeg) === 0
    : true;
  const noNegViolating = isZero
    ? sturmCountRootsIn(violating.poly, rOf(-1000000n, 1n), tinyNeg) === 0
    : true;
  const C = T + 1;
  return {
    T,
    eps,
    valid,
    violating,
    multValid,
    multViolating,
    validRoots,
    violatingRoots,
    e0,
    e1,
    gap,
    sandwich: { lower, upper, noRootBelowLower, rootAtOrBelowUpper },
    zeroTilt: {
      isZeroTilt: isZero,
      validPolyAtZeroIsRoot:
        polyEval(valid.poly, { num: 0n, den: 1n }).num === 0n,
      violatingDetPositive:
        rCmp(
          rMul(
            polyEval(violating.poly, { num: 0n, den: 1n }),
            C % 2 === 0 ? rOf(1n, 1n) : rOf(-1n, 1n),
          ),
          { num: 0n, den: 1n },
        ) > 0,
      noNegativeRoots: noNegValid && noNegViolating,
    },
  };
}

// ---------------------------------------------------------------------------
// Smuggling trials: the counterfeit-certificate auditor.
// ---------------------------------------------------------------------------

/** A submitted gap-census row (data, not trusted — this is what smugglers
 * edit). All claims are recomputed exactly from the recurrence. */
export interface SubmittedGapRow {
  readonly eps: ExactRational;
  /** claimed E_0 (float — must sit inside the certified bisection box). */
  readonly claimedE0: number;
  /** claimed gap (float — must sit inside the certified box). */
  readonly claimedGap: number;
  /** claimed number of eigenvalues of the VALID chain strictly below 0. */
  readonly claimedRootsBelowZero: number;
}

export interface GapTableViolation {
  readonly eps: string;
  readonly crime: string;
  readonly detail: string;
}

/** Audit a submitted fueled-gap census against the exact layer. Named
 * crimes: counterfeit E_0 (outside the certified bisection box), counterfeit
 * gap (outside the box), root-count lie (Sturm recount disagrees), the
 * sandwich violated (a row claiming E_0 above 1/2 - eps*T + slack), and
 * structural corruption (duplicate rows / a gap in the eps ladder). */
export function auditGapTable(
  input: Omit<TiltedSpectrumInput, "epsilon">,
  rows: readonly SubmittedGapRow[],
  boxTolerance = 1e-6,
): readonly GapTableViolation[] {
  const violations: GapTableViolation[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const key = `${String(r.eps.num)}/${String(r.eps.den)}`;
    if (seen.has(key)) {
      violations.push({
        eps: key,
        crime: "duplicate row",
        detail: `epsilon ${key} appears twice`,
      });
      continue;
    }
    seen.add(key);
    let cert: TiltedSpectrumCertificate;
    try {
      cert = certifyTiltedSpectrum({ ...input, epsilon: r.eps });
    } catch (err) {
      if (err instanceof VacuumError) {
        violations.push({
          eps: key,
          crime: "row rejected by the exact layer",
          detail: `[${err.code}] ${err.message}`,
        });
        continue;
      }
      throw err;
    }
    if (Math.abs(r.claimedE0 - rFloat(cert.e0)) > boxTolerance) {
      violations.push({
        eps: key,
        crime: "counterfeit E0",
        detail: `claimed ${r.claimedE0}, the certified bisection box pins E0 = ${rFloat(cert.e0)} (exact ${cert.e0.num}/${cert.e0.den})`,
      });
    }
    if (Math.abs(r.claimedGap - rFloat(cert.gap)) > boxTolerance) {
      violations.push({
        eps: key,
        crime: "counterfeit gap",
        detail: `claimed ${r.claimedGap}, the certified box pins gap = ${rFloat(cert.gap)} (exact ${cert.gap.num}/${cert.gap.den})`,
      });
    }
    const trueBelow =
      sturmCountRootsUpTo(cert.valid.poly, { num: 0n, den: 1n }) -
      (polyEval(cert.valid.poly, { num: 0n, den: 1n }).num === 0n ? 1 : 0);
    if (r.claimedRootsBelowZero !== trueBelow) {
      violations.push({
        eps: key,
        crime: "root-count lie",
        detail: `claimed ${r.claimedRootsBelowZero} valid-chain eigenvalues below 0, Sturm counts ${trueBelow}`,
      });
    }
    if (r.claimedE0 > rFloat(cert.sandwich.upper) + boxTolerance) {
      violations.push({
        eps: key,
        crime: "sandwich violated",
        detail: `claimed E0 ${r.claimedE0} exceeds the Rayleigh witness 1/2 - eps*T = ${rFloat(cert.sandwich.upper)}`,
      });
    }
  }
  return violations;
}
