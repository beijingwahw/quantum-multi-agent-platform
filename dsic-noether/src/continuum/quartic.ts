/**
 * The non-quadratic face (v0.3.0): the quartic family on BOTH sides of the
 * polynomial boundary.
 *
 * PART A — the chain closes on the quartic family. Utilities
 *     v_i(a, tau_i) = tau_i^3 * a - a^4 / 4      (tau on a positive box),
 * one private divisible good per agent, no aggregate constraint. This is the
 * intercept family v = theta*a - a^4/4 reparametrized by tau = theta^(1/3) —
 * the reparametrization under which the efficient allocation x_j = tau_j is a
 * POLYNOMIAL in the reports (with intercept types it is the cube root
 * (theta_j - lambda)^(1/3), outside the ring — PART B prices exactly that).
 * Every link of the chain runs as the ZERO POLYNOMIAL in exact rational
 * arithmetic, and the charge acquires a genuinely new closed form:
 *     G(s;t) = -(s-t)^2 (s^2 + 2st + 3t^2) / 4,
 * a square times a POSITIVE-DEFINITE quadratic (s^2 + 2st + 3t^2 =
 * (s+t)^2 + 2t^2, a sum of squares) — DSIC by ordered-field arithmetic,
 * equality iff s = t. HONEST LABEL: this stage is EXTERNALITY-FREE —
 * others' reports never move x_i, the Clarke pivot payment is identically 0
 * (the no-externality price), and the coupling that made the quadratic
 * family's chain nontrivial is exactly what PART B proves unreachable in the
 * polynomial ring for quartic costs.
 *
 * PART B — the no-polynomial certificate. On the COUPLED stage (one divisible
 * good, sum a_j = 1 — the v0.2.0 stage), quartic utilities v = theta*a - a^4/4
 * have efficient allocation x_j = (theta_j - lambda)^(1/3): we prove the chain
 * does not break at a link — the allocation rule is NOT A POLYNOMIAL in the
 * types, so the zero-polynomial machinery cannot even state it. Certificate,
 * every algebraic step machine-held:
 *   (1) efficiency (FOC, KKT on the concave program) => x_j^3 = theta_j - lambda
 *       with lambda common: subtracting pairs, x_2^3 - x_1^3 = theta_2 - theta_1;
 *   (2) restrict to the others-fixed line theta = (t, obar_2, ...): any
 *       polynomial x restricts to univariate X_1, X_2 in Q[t] with
 *       (X_2 - X_1)(X_2^2 + X_2 X_1 + X_1^2) = obar_2 - t   (degree EXACTLY 1);
 *   (3) the factor identity (P-Q)(P^2+PQ+Q^2) = P^3 - Q^3 holds coefficient-wise
 *       in Q[P,Q] (machine);
 *   (4) the t^(2d)-coefficient of Q^2 + QP + P^2, where d = max deg, is
 *       q_d^2 + q_d p_d + p_d^2 = (q_d + p_d/2)^2 + (3/4) p_d^2 > 0 (sum of
 *       squares, machine identity + ordered field) — so the quadratic factor
 *       has degree 2d EXACTLY, and in the domain Q[t] the product has degree
 *       deg(X_2 - X_1) + 2d;
 *   (5) degree arithmetic: e + 2d = 1 with d = 0 => constants => e = 0: NO
 *       SOLUTION. The witnesses for (4) are executed at generic symbolic
 *       coefficients for d = 1..3; the d-uniformity is the one-line monomial
 *       argument (i + j = 2d with i, j <= d forces i = j = d), stated here and
 *       witnessed by the generic computations.
 * CONTROLS (the checker is sharp, not blunt): at RHS degree 3 the lemma does
 * NOT refute — and indeed X_1 = 1, X_2 = t solves it; the QUADRATIC family's
 * FOC difference is LINEAR, its restricted affine allocation satisfies it
 * exactly — the certificate convicts exactly the cubic FOC, nothing else.
 * The exponential family (v = theta*a - e^a, x = ln(theta - lambda)) fails
 * one level earlier (transcendental FOC inversion) — CITED, not machine-claimed.
 */

import {
  pAdd,
  pConst,
  pDeriv,
  pEval,
  pInteg,
  pIsZero,
  pMono,
  pMonomialsUsing,
  pMul,
  pScale,
  pSub,
  pSubst,
  pSubstRat,
  pTotalDeg,
  pVar,
  pZero,
  rAdd,
  rCmp,
  rMul,
  rSub,
  rat,
  R0,
  R1,
  type Poly,
  type Rat,
} from "./poly.js";
import { makeFamily, randomGauge, type Family } from "./green-laffont.js";

// ---------------------------------------------------------------------------
// PART A: the uncoupled quartic family — the chain, executed
// ---------------------------------------------------------------------------

export const QREGION_LO = rat(1, 2);
export const QREGION_HI = rat(3, 2);

/** The stage's allocation rule: x_i = s (own report), computed never asserted. */
export function qxOwn(f: Family): Poly {
  return pVar(f.vars, f.sIdx);
}

/** Others' welfare at the efficient allocation: sum (o^3*o - o^4/4). */
export function qwMinusI(f: Family): Poly {
  let w = pZero(f.vars);
  for (let j = 0; j < f.n - 1; j++) {
    const oj = pVar(f.vars, 2 + j);
    const oj3 = pMul(oj, pMul(oj, oj));
    const xj4 = pMul(pMul(oj, oj), pMul(oj, oj));
    w = pAdd(w, pSub(oj3, pScale(xj4, rat(1, 4))));
  }
  return w;
}

/** The default gauge h(o) = (1/2) sum o^3 — a nontrivial smooth gauge. (The
 * Clarke pivot here equals W_-i, making the pivot payment identically 0: the
 * no-externality price. We exercise the machinery with a nonzero gauge.) */
export function qDefaultGaugeH(f: Family): Poly {
  let h = pZero(f.vars);
  for (let j = 0; j < f.n - 1; j++) {
    const oj = pVar(f.vars, 2 + j);
    h = pAdd(h, pScale(pMul(oj, pMul(oj, oj)), rat(1, 2)));
  }
  return h;
}

/** Groves payment in gauge h (default: the smooth gauge above): p = h - W_-i. */
export function qGrovesPayment(f: Family, h?: Poly): Poly {
  const gauge = h ?? qDefaultGaugeH(f);
  return pSub(gauge, qwMinusI(f));
}

/** Utility of report s under true type t: u = t^3*x - x^4/4 - p. */
export function quOwn(f: Family, p: Poly): Poly {
  const x = qxOwn(f);
  const t = pVar(f.vars, f.tIdx);
  const x4 = pMul(pMul(x, x), pMul(x, x));
  return pSub(pSub(pMul(pMul(t, pMul(t, t)), x), pScale(x4, rat(1, 4))), p);
}

export interface QRule {
  readonly xOwn: Poly;
  readonly dxOwnDS: Poly;
}

export function qEfficientRule(f: Family): QRule {
  const x = qxOwn(f);
  return { xOwn: x, dxOwnDS: pDeriv(x, f.sIdx) };
}

/** [E] the envelope residual: (t^3 - x^3)*dx/ds - dp/ds on the diagonal. */
export function qEnvelopeResidual(f: Family, p: Poly, rule?: QRule): Poly {
  const r = rule ?? qEfficientRule(f);
  const t = pVar(f.vars, f.tIdx);
  const field = pSub(pMul(pSub(pMul(t, pMul(t, t)), pMul(r.xOwn, pMul(r.xOwn, r.xOwn))), r.dxOwnDS), pDeriv(p, f.sIdx));
  return pSubst(field, f.tIdx, pVar(f.vars, f.sIdx));
}

export function qEnvelopeIntegrand(f: Family, rule?: QRule): Poly {
  const r = rule ?? qEfficientRule(f);
  const t = pVar(f.vars, f.tIdx);
  return pSubst(pMul(pSub(pMul(t, pMul(t, t)), pMul(r.xOwn, pMul(r.xOwn, r.xOwn))), r.dxOwnDS), f.tIdx, pVar(f.vars, f.sIdx));
}

/** [I] the gauge readoff (the Poincare/FTC step), quartic version. */
export function qGaugeReadoff(f: Family, p: Poly, s0: Rat, rule?: QRule): Poly {
  const integ = pInteg(qEnvelopeIntegrand(f, rule), f.sIdx);
  const anchor = pSubstRat(integ, f.sIdx, s0);
  return pAdd(pSub(p, integ), anchor);
}

export type QClassification =
  | { kind: "gauge"; h: Poly }
  | { kind: "not-dsic"; offending: number };

/** The Green-Laffont classifier on the quartic family. */
export function qClassifyPayment(f: Family, p: Poly, s0: Rat, rule?: QRule): QClassification {
  const off = qGaugeReadoff(f, p, s0, rule);
  const count = pMonomialsUsing(off, f.sIdx);
  if (count > 0) return { kind: "not-dsic", offending: count };
  return { kind: "gauge", h: off };
}

/** [S] welfare stationarity: sum_j (tau_j^3 - x_j^3) * dx_j/ds on the diagonal.
 * On this stage every marginal gap is zero at the efficient allocation
 * (x_j = tau_j, no common multiplier), and only the own term has dx/ds != 0. */
export function qWelfareStationarityResidual(f: Family, rule?: QRule): Poly {
  const r = rule ?? qEfficientRule(f);
  const t = pVar(f.vars, f.tIdx);
  const t3 = pMul(t, pMul(t, t));
  let sum = pMul(pSub(t3, pMul(r.xOwn, pMul(r.xOwn, r.xOwn))), r.dxOwnDS);
  for (let j = 0; j < f.n - 1; j++) {
    const xj = pVar(f.vars, 2 + j); // others' allocation: their own report
    const marg = pSub(pMul(xj, pMul(xj, xj)), pMul(xj, pMul(xj, xj)));
    sum = pAdd(sum, pMul(marg, pDeriv(xj, f.sIdx)));
  }
  return pSubst(sum, f.tIdx, pVar(f.vars, f.sIdx));
}

/** [G] the Groves-form residual: p + W_-i (the gauge iff free of s-monomials). */
export function qGrovesFormResidual(f: Family, p: Poly): Poly {
  return pAdd(p, qwMinusI(f));
}

/** Deviation gain G(s;t,o) = u(s;t,o) - u(t;t,o). */
export function qDeviationGain(f: Family, p: Poly): Poly {
  const u = quOwn(f, p);
  return pSub(u, pSubst(u, f.sIdx, pVar(f.vars, f.tIdx)));
}

/** The welfare-gap form Phi_t(x(s)) - Phi_t(x(t)) — the charge sans payments. */
export function qWelfareGapForm(f: Family): Poly {
  const x = qxOwn(f);
  const t = pVar(f.vars, f.tIdx);
  const x4 = pMul(pMul(x, x), pMul(x, x));
  const phi = pAdd(pSub(pMul(pMul(t, pMul(t, t)), x), pScale(x4, rat(1, 4))), qwMinusI(f));
  return pSub(phi, pSubst(phi, f.sIdx, pVar(f.vars, f.tIdx)));
}

/** The charge in closed form: G = -(s-t)^2 (s^2 + 2st + 3t^2)/4. */
export function qChargeClosedForm(f: Family): Poly {
  const s = pVar(f.vars, f.sIdx);
  const t = pVar(f.vars, f.tIdx);
  const d = pSub(s, t);
  const sos = pAdd(pAdd(pMul(s, s), pScale(pMul(s, t), rat(2))), pScale(pMul(t, t), rat(3)));
  return pScale(pMul(pMul(d, d), sos), rat(-1, 4));
}

/** The positive-definiteness identity s^2 + 2st + 3t^2 = (s+t)^2 + 2t^2 —
 * the sum-of-squares certificate behind DSIC on this family. */
export function qChargeSosResidual(f: Family): Poly {
  const s = pVar(f.vars, f.sIdx);
  const t = pVar(f.vars, f.tIdx);
  const form = pAdd(pAdd(pMul(s, s), pScale(pMul(s, t), rat(2))), pScale(pMul(t, t), rat(3)));
  const squares = pAdd(pMul(pAdd(s, t), pAdd(s, t)), pScale(pMul(t, t), rat(2)));
  return pSub(form, squares);
}

export function qChargeIdentityResidual(n: number): Poly {
  const f = makeFamily(n);
  return pSub(qDeviationGain(f, qGrovesPayment(f)), qChargeClosedForm(f));
}

/** N-I: dG/deps along the one-parameter gauge orbit p -> p + eps*g(o). */
export function qGaugeOrbitDerivative(n: number, g: Poly): Poly {
  const f = makeFamily(n, ["eps"]);
  const epsIdx = f.vars.length - 1;
  const pEps = pAdd(qGrovesPayment(f), pMul(pVar(f.vars, epsIdx), g));
  return pDeriv(qDeviationGain(f, pEps), epsIdx);
}

/** Re-exported for experiments/tests: seeded random gauge over others' types. */
export { randomGauge as qRandomGauge };

/** Grid witness: G <= 0 on the rational grid, = 0 only on the diagonal. */
export function qChargeGridWitness(n: number, steps: number): { worst: Rat; worstOffDiag: Rat } {
  const f = makeFamily(n);
  const gain = qDeviationGain(f, qGrovesPayment(f));
  let worst = R0;
  let worstOff = rat(-1);
  const point: Rat[] = f.vars.map(() => rat(1));
  const width = rSub(QREGION_HI, QREGION_LO);
  for (let i = 0; i <= steps; i++) {
    for (let k = 0; k <= steps; k++) {
      point[f.sIdx] = rAdd(QREGION_LO, rMul(rat(i, steps), width));
      point[f.tIdx] = rAdd(QREGION_LO, rMul(rat(k, steps), width));
      const g = pEval(gain, point);
      if (rCmp(g, worst) > 0) worst = g;
      if (i !== k && rCmp(g, worstOff) > 0) worstOff = g;
    }
  }
  return { worst, worstOffDiag: worstOff };
}

// ---------------------------------------------------------------------------
// PART A2: the kappa control — implementable for every kappa, Groves on slices
// ---------------------------------------------------------------------------

/** The kappa-rule x^kappa_own = kappa*s (efficient for the kappa-discounted
 * profile), others symmetric: x_j = kappa*o_j. */
export function qKappaRule(f: Family, kappa: Rat): QRule {
  const x = pScale(pVar(f.vars, f.sIdx), kappa);
  return { xOwn: x, dxOwnDS: pDeriv(x, f.sIdx) };
}

/** The implementing payment: the fiber integral of the kappa envelope. */
export function qKappaPayment(f: Family, kappa: Rat, s0: Rat): Poly {
  const integ = pInteg(qEnvelopeIntegrand(f, qKappaRule(f, kappa)), f.sIdx);
  const anchor = pSubstRat(integ, f.sIdx, s0);
  return pAdd(pSub(integ, anchor), qDefaultGaugeH(f));
}

/** Others' welfare at the kappa-allocation. */
export function qKappaWMinusI(f: Family, kappa: Rat): Poly {
  let w = pZero(f.vars);
  for (let j = 0; j < f.n - 1; j++) {
    const oj = pVar(f.vars, 2 + j);
    const xj = pScale(oj, kappa);
    const oj3 = pMul(oj, pMul(oj, oj));
    const xj4 = pMul(pMul(xj, xj), pMul(xj, xj));
    w = pAdd(w, pSub(pMul(oj3, xj), pScale(xj4, rat(1, 4))));
  }
  return w;
}

/** The [G] drift for the kappa payment: exactly kappa(1-kappa^3) s^3 (zero on
 * the kappa = 1 slice; kappa = 0 is the degenerate no-trade slice where the
 * constant-0 rule makes every constant payment Groves — noted, not hidden). */
export function qKappaGrovesDrift(f: Family, kappa: Rat, s0: Rat): Poly {
  return pDeriv(pAdd(qKappaPayment(f, kappa, s0), qKappaWMinusI(f, kappa)), f.sIdx);
}

/** The Rochet 2-cycle of the kappa-rule's allocation 1-form on reports
 * {a, b}: (a - b)*(x(b) - x(a)) = -kappa (a-b)^2 — positive iff kappa < 0. */
export function qKappaTwoCycle(a: Rat, b: Rat, kappa: Rat): Rat {
  return rMul(rSub(a, b), rMul(kappa, rSub(b, a)));
}

// ---------------------------------------------------------------------------
// PART B: the no-polynomial certificate for the coupled quartic stage
// ---------------------------------------------------------------------------

/** Step (3): the factor identity (P-Q)(P^2+PQ+Q^2) = P^3 - Q^3 in Q[P,Q]. */
export function certFactorIdentity(): Poly {
  const vars = ["P", "Q"];
  const P = pVar(vars, 0);
  const Q = pVar(vars, 1);
  const lhs = pMul(pSub(P, Q), pAdd(pAdd(pMul(Q, Q), pMul(Q, P)), pMul(P, P)));
  const rhs = pSub(pMul(pMul(P, P), P), pMul(pMul(Q, Q), Q));
  return pSub(lhs, rhs);
}

/** Step (4a): A^2 + AB + B^2 = (A + B/2)^2 + (3/4) B^2 — the sum-of-squares
 * identity that makes the quadratic factor's leading coefficient strictly
 * positive unless both leading coefficients vanish. */
export function certSosIdentity(): Poly {
  const vars = ["A", "B"];
  const A = pVar(vars, 0);
  const B = pVar(vars, 1);
  const form = pAdd(pAdd(pMul(A, A), pMul(A, B)), pMul(B, B));
  const half = pAdd(A, pScale(B, rat(1, 2)));
  const squares = pAdd(pMul(half, half), pScale(pMul(B, B), rat(3, 4)));
  return pSub(form, squares);
}

export interface TopCoeffWitness {
  readonly d: number;
  /** the t^(2d)-slice of Q^2 + QP + P^2, re-based with t-exponent 0 */
  readonly slice: Poly;
  /** the expected quadratic form p_d^2 + p_d q_d + q_d^2 over the same ring */
  readonly expected: Poly;
  /** maximal t-exponent actually appearing in Q^2 + QP + P^2 (must be 2d) */
  readonly maxExp: number;
  readonly matches: boolean;
  readonly noOvershoot: boolean;
}

/** Step (4b): for GENERIC symbolic-coefficient P, Q of degree d (coefficients
 * p_0..p_d, q_0..q_d are ring variables), the t^(2d)-slice of Q^2 + QP + P^2
 * is exactly q_d^2 + q_d p_d + p_d^2 and nothing reaches above 2d. Executed
 * for d = 1..3; d-uniformity is the monomial argument i + j = 2d, i,j <= d
 * => i = j = d (each mixed pair lands strictly below 2d). */
export function certTopCoeffSlice(d: number): TopCoeffWitness {
  if (d < 1 || d > 4) throw new Error(`certTopCoeffSlice: d in 1..4 required, got ${d}`);
  const cvars: string[] = [];
  for (let k = 0; k <= d; k++) cvars.push(`p${k}`);
  for (let k = 0; k <= d; k++) cvars.push(`q${k}`);
  const all = ["t", ...cvars];
  const pdIdx = 1 + d;
  const qdIdx = 2 + d + d;
  let P = pZero(all);
  let Q = pZero(all);
  for (let k = 0; k <= d; k++) {
    const ep = new Array<number>(all.length).fill(0);
    ep[0] = k;
    ep[1 + k] = 1;
    P = pAdd(P, pMono(all, ep, R1));
    const eq = new Array<number>(all.length).fill(0);
    eq[0] = k;
    eq[2 + d + k] = 1;
    Q = pAdd(Q, pMono(all, eq, R1));
  }
  const S = pAdd(pAdd(pMul(Q, Q), pMul(Q, P)), pMul(P, P));
  const sliceEntries: Array<[string, Rat]> = [];
  let maxExp = -1;
  for (const [k, c] of S.mono) {
    const e = k.split(",").map(Number);
    const te = e[0] as number;
    if (te > maxExp) maxExp = te;
    if (te === 2 * d) {
      const re = e.slice(1); // exponents over the coefficient variables alone
      sliceEntries.push([re.join(","), c]);
    }
  }
  const slice = slicePoly(all, sliceEntries);
  const expected = pAdd(
    pAdd(
      pMono(all, monoOf(all, pdIdx, 2, qdIdx, 0), R1),
      pMono(all, monoOf(all, pdIdx, 1, qdIdx, 1), R1),
    ),
    pMono(all, monoOf(all, pdIdx, 0, qdIdx, 2), R1),
  );
  return {
    d,
    slice,
    expected,
    maxExp,
    matches: pIsZero(pSub(slice, expected)),
    noOvershoot: maxExp === 2 * d,
  };
}

function monoOf(vars: readonly string[], i: number, ei: number, j: number, ej: number): number[] {
  const e = new Array<number>(vars.length).fill(0);
  e[i] = ei;
  e[j] = ej;
  return e;
}

function slicePoly(vars: readonly string[], entries: ReadonlyArray<readonly [string, Rat]>): Poly {
  // re-keyed entries have t-exponent 0 by construction; keep the ring
  let out = pZero(vars);
  for (const [k, c] of entries) {
    const e = k.split(",").map(Number);
    const full = [0, ...e];
    out = pAdd(out, pMono(vars, full, c));
  }
  return out;
}

export interface DegreeVerdict {
  readonly rhsDegree: number;
  /** (d, e) pairs with e + 2d = rhsDegree, e >= 0, and d = 0 => e = 0 */
  readonly feasible: ReadonlyArray<readonly [number, number]>;
  readonly refuted: boolean;
}

/** Step (5): the degree arithmetic. deg(LHS) = deg(X_2 - X_1) + 2 max-deg; a
 * solution needs e + 2d = rhsDegree with d = 0 forcing e = 0 (constants have
 * constant difference). Refuted iff NO pair survives. */
export function certDegreeArithmetic(rhsDegree: number): DegreeVerdict {
  if (rhsDegree < 0 || !Number.isInteger(rhsDegree)) throw new Error("certDegreeArithmetic: nonnegative integer degree required");
  const feasible: Array<[number, number]> = [];
  for (let d = 0; 2 * d <= rhsDegree; d++) {
    const e = rhsDegree - 2 * d;
    if (d === 0 && e > 0) continue;
    feasible.push([d, e]);
  }
  return { rhsDegree, feasible, refuted: feasible.length === 0 };
}

export interface Certificate {
  /** the RHS polynomial obar_2 - t on the others-fixed line (degree must be 1) */
  readonly rhs: Poly;
  readonly rhsDegree: number;
  readonly factorIdentityZero: boolean;
  readonly sosIdentityZero: boolean;
  readonly topCoeff: readonly TopCoeffWitness[];
  readonly verdict: DegreeVerdict;
  /** true iff every step is machine-exact and the degree arithmetic refutes */
  readonly refuted: boolean;
}

/** The assembled certificate: the coupled quartic stage admits NO polynomial
 * efficient allocation — the chain cannot be stated, and here is the proof. */
export function coupledQuarticCertificate(obar2: Rat): Certificate {
  const vars = ["t"];
  const rhs = pSub(pConst(vars, obar2), pVar(vars, 0));
  const rhsDegree = pTotalDeg(rhs);
  const topCoeff = [1, 2, 3].map((d) => certTopCoeffSlice(d));
  const verdict = certDegreeArithmetic(rhsDegree);
  const factorIdentityZero = pIsZero(certFactorIdentity());
  const sosIdentityZero = pIsZero(certSosIdentity());
  const refuted =
    rhsDegree === 1 &&
    factorIdentityZero &&
    sosIdentityZero &&
    topCoeff.every((w) => w.matches && w.noOvershoot) &&
    verdict.refuted;
  return { rhs, rhsDegree, factorIdentityZero, sosIdentityZero, topCoeff, verdict, refuted };
}

// ---------------------------------------------------------------------------
// PART B controls: the checker is sharp (accepts what it must not refute)
// ---------------------------------------------------------------------------

/** Control 1: at RHS degree 3 the degree arithmetic does NOT refute, and the
 * explicit solution X_1 = 1, X_2 = t satisfies (X_2 - X_1)(...) = t^3 - 1. */
export function certControlDegreeThree(): { verdict: DegreeVerdict; solutionResidual: Poly } {
  const verdict = certDegreeArithmetic(3);
  const vars = ["t"];
  const t = pVar(vars, 0);
  const one = pConst(vars, R1);
  const quad = pAdd(pAdd(pMul(t, t), pMul(t, one)), pMul(one, one));
  const lhs = pMul(pSub(t, one), quad);
  const rhs = pSub(pMul(pMul(t, t), t), pConst(vars, R1));
  return { verdict, solutionResidual: pSub(lhs, rhs) };
}

/** Control 2: the QUADRATIC family's FOC difference is LINEAR
 * (x_2 - x_1 = theta_2 - theta_1) and its restricted affine allocation
 * satisfies it exactly — the certificate convicts the cubic FOC only, and
 * the linear shape is soluble (the affine solution exists, residual 0). */
export function certControlQuadratic(): { focResidual: Poly; solutionExists: boolean } {
  const vars = ["s", "o"];
  const s = pVar(vars, 0);
  const o = pVar(vars, 1);
  // n = 2 quadratic closed form on the others-fixed line theta = (t, obar):
  const x1 = pAdd(pSub(pScale(s, rat(1, 2)), pScale(o, rat(1, 2))), pConst(vars, rat(1, 2)));
  const x2 = pAdd(pSub(pScale(o, rat(1, 2)), pScale(s, rat(1, 2))), pConst(vars, rat(1, 2)));
  const focResidual = pSub(pSub(x2, x1), pSub(o, s));
  return { focResidual, solutionExists: pIsZero(focResidual) };
}

/** The SMUGGLING TRIAL helper: the quadratic family's affine allocation,
 * counterfeited as quartic-efficient — the FOC residual that convicts it. */
export function fakeAffineFOCResidual(): Poly {
  const vars = ["s", "o"];
  const s = pVar(vars, 0);
  const o = pVar(vars, 1);
  const x1 = pAdd(pSub(pScale(s, rat(1, 2)), pScale(o, rat(1, 2))), pConst(vars, rat(1, 2)));
  const x2 = pAdd(pSub(pScale(o, rat(1, 2)), pScale(s, rat(1, 2))), pConst(vars, rat(1, 2)));
  const x1c = pMul(x1, pMul(x1, x1));
  const x2c = pMul(x2, pMul(x2, x2));
  return pSub(pSub(x2c, x1c), pSub(o, s));
}
