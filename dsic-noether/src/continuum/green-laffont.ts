/**
 * The continuum derivation, executed (T5-T8): Noether 1918 -> Green-Laffont
 * on a smooth convex type region, every link machine-exact.
 *
 * THE STAGE. n agents, one divisible good, quasi-linear utilities
 *     v_i(a_i, theta_i) = theta_i * a_i - a_i^2 / 2,   sum_j a_j = 1,
 * types on the box Theta = [2/5, 3/5]^n (interior region: the efficient
 * allocation never touches the capacity walls — checked at the corners,
 * exactly). The efficient allocation solves max sum_j v_j s.t. sum a_j = 1:
 * FOC theta_j - a_j = lambda (the SAME lambda for every j — welfare
 * stationarity), hence the CLOSED FORM
 *     x_j(theta) = theta_j - thetabar + 1/n,   thetabar = (1/n) sum_j theta_j.
 * Everything below is a polynomial in the type coordinates: every identity
 * is verified COEFFICIENT-WISE (the zero polynomial), which proves it for
 * EVERY profile in the region at once.
 *
 * THE CHAIN (T8):
 *   [E] envelope    — DSIC (truth is an interior optimum) => the payment's
 *                     own-report derivative equals dV/da . dx/ds on the
 *                     truthful diagonal: residual = 0 as a polynomial.
 *   [I] integration — the Poincare/FTC step: fiber-integrating [E] exhibits
 *                     p - (antiderivative) as a function h(theta_-i) alone
 *                     (no own-report monomials): the GAUGE READOFF. On a
 *                     convex type region this is exact; K3 shows the
 *                     hypothesis is load-bearing (a closed form on an
 *                     annulus has no potential).
 *   [S] stationarity — efficiency enters: sum_j dV_j/da(x_j) . dx_j/ds = 0
 *                     (all marginal gaps equal lambda, and the x_j sum to 1).
 *   [G] Groves form — [E]+[I]+[S] assemble: p + W_-i(x) has NO own-report
 *                     monomials, i.e. p = h(theta_-i) - W_-i(x): the Groves
 *                     form, with exactly the gauge freedom. The converse is
 *                     the charge: G(s;t) = -(n-1)(s-t)^2/(2n) <= 0 (closed
 *                     form — DSIC proved by ordered-field arithmetic, not
 *                     by sampling).
 *
 * NOETHER'S TWO THEOREMS, mechanism-native (T6/T7):
 *   N-I  (T6): the Groves gauge group p -> p + eps*g(theta_-i) is a
 *        one-parameter symmetry of the report game, and the CHARGE (the
 *        deviation gain / welfare gap) is CONSERVED along the orbit:
 *        dG/deps = 0 as a polynomial identity. The charge itself has the
 *        closed form above, and equals the welfare gap Phi_t(x(s)) -
 *        Phi_t(x(t)) coefficient-wise (the continuum T1).
 *   N-II (T7): the gauge group is the FULL C^infinity(Theta_-i) — a group
 *        depending on arbitrary functions, Noether's second-theorem class
 *        (KSS11). Its identity: the fiber derivative of every differential
 *        incentive identity annihilates the gauge direction (d/ds of
 *        eps*g(theta_-i) is 0 since g has no s-monomials) — the constraint
 *        system cannot see the gauge. The classification corollary is
 *        Green-Laffont uniqueness executed: the solver READS OFF the gauge
 *        from any DSIC payment, and any payment whose readoff carries
 *        own-report monomials is convicted.
 *
 * THE FOUR BOUNDARY CONTROLS (where each hypothesis is load-bearing):
 *   K1 off-gauge:   p + eps*s breaks [E] by EXACTLY -eps and buys an exact
 *                   profitable deviation at s* = t - eps*n/(n-1) worth
 *                   eps^2 n / (2(n-1)) — the crime and its price in closed
 *                   form.
 *   K2 non-efficient: the kappa-rule family x^kappa (efficient for the
 *                   discounted profile kappa*s) is implementable (its
 *                   envelope holds, kappa > 0 monotone) but its [G] drift is
 *                   exactly kappa(1-kappa)(n-1)s/n — the Groves form holds
 *                   ONLY on the kappa = 1 slice. The decreasing rule is not
 *                   implementable at all: 2-cycle gain c(a-b)^2 > 0 exact
 *                   (the continuum Rochet violation, ROC87).
 *   K3 topology:    the form (x dy - y dx)/(x^2+y^2) is CLOSED (curl = 0
 *                   coefficient-wise) yet its integral around the unit
 *                   diamond is exactly 2*pi (4-fold symmetry + the
 *                   atan(2t-1) antiderivative identity, both exact; numeric
 *                   cross-check to 12 digits). On a non-convex type region
 *                   closed does NOT produce a potential: the Poincare step
 *                   [I] is load-bearing — and no FINITE report set can host
 *                   this (every cycle through finitely many reports
 *                   decomposes into triangles: closed => exact always, the
 *                   T2 layer). A strictly continuum phenomenon.
 *   K4 kink:        the second-price auction satisfies the envelope exactly
 *                   on both open regions (pairwise differences, bitwise) —
 *                   the smooth chain runs; the kink locus (theta_1 =
 *                   theta_2, where x jumps by exactly 1) is where it stops
 *                   and the general measurable-space theorem (GL79, cited)
 *                   takes over.
 */

import type { Rng } from "../core/rng.js";
import {
  pAdd,
  pAssertSame,
  pConst,
  pCoef,
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
  pSubstAll,
  pSubstRat,
  pVar,
  pFromMonomials,
  pZero,
  rAdd,
  rCmp,
  rMul,
  rNeg,
  rStr,
  rSub,
  rat,
  type Poly,
  type Rat,
} from "./poly.js";

// ---------------------------------------------------------------------------
// the family
// ---------------------------------------------------------------------------

export interface Family {
  readonly n: number;
  readonly vars: readonly string[]; // ["s","t","o0",...,"o{n-2}", ...extra]
  readonly sIdx: number; // always 0
  readonly tIdx: number; // always 1
}

export function makeFamily(n: number, extraVars: readonly string[] = []): Family {
  if (n < 2) throw new Error("makeFamily: n >= 2 required");
  const vars = ["s", "t"];
  for (let j = 0; j < n - 1; j++) vars.push(`o${j}`);
  return { n, vars: [...vars, ...extraVars], sIdx: 0, tIdx: 1 };
}

export const REGION_LO = rat(2, 5);
export const REGION_HI = rat(3, 5);

function othersSum(f: Family): Poly {
  let s = pZero(f.vars);
  for (let j = 0; j < f.n - 1; j++) s = pAdd(s, pVar(f.vars, 2 + j));
  return s;
}

function othersSumNoSelf(f: Family, self: number): Poly {
  let s = pZero(f.vars);
  for (let j = 0; j < f.n - 1; j++) {
    if (j !== self) s = pAdd(s, pVar(f.vars, 2 + j));
  }
  return s;
}

/** Efficient own allocation x_i(s, o) = s - (s + sum o)/n + 1/n. */
export function xOwn(f: Family): Poly {
  return pSub(
    pAdd(pScale(pVar(f.vars, f.sIdx), rat(f.n - 1, f.n)), pConst(f.vars, rat(1, f.n))),
    pScale(othersSum(f), rat(1, f.n)),
  );
}

/** Efficient other allocation x_j(s, o) = o_j - (s + sum o)/n + 1/n — the
 * mean runs over ALL reports including o_j, so o_j carries (n-1)/n and the
 * others' cross sum excludes it (an early draft divided by the full sum and
 * left o_j at (n-2)/n — the envelope residual convicted it at -o/4). */
export function xOther(f: Family, j: number): Poly {
  if (j < 0 || j >= f.n - 1) throw new Error(`xOther: index ${j} out of range`);
  return pSub(
    pAdd(pScale(pVar(f.vars, 2 + j), rat(f.n - 1, f.n)), pConst(f.vars, rat(1, f.n))),
    pScale(pAdd(pVar(f.vars, f.sIdx), othersSumNoSelf(f, j)), rat(1, f.n)),
  );
}

/** d x_own / d s = (n-1)/n (computed, never asserted). */
export function dxOwnDS(f: Family): Poly {
  return pDeriv(xOwn(f), f.sIdx);
}

/** Others' welfare at the efficient allocation of the reported profile. */
export function wMinusI(f: Family): Poly {
  let w = pZero(f.vars);
  for (let j = 0; j < f.n - 1; j++) {
    const xj = xOther(f, j);
    const oj = pVar(f.vars, 2 + j);
    w = pAdd(w, pSub(pMul(oj, xj), pScale(pMul(xj, xj), rat(1, 2))));
  }
  return w;
}

/** The Clarke pivot h(o): others' best welfare ALONE (capacity 1 over n-1
 * agents), closed form y_j = o_j - obar + 1/(n-1). */
export function pivotH(f: Family): Poly {
  const k = f.n - 1;
  let h = pZero(f.vars);
  for (let j = 0; j < k; j++) {
    const yj = pAdd(
      pSub(pScale(pVar(f.vars, 2 + j), rat(k - 1, k)), pScale(othersSumNoSelf(f, j), rat(1, k))),
      pConst(f.vars, rat(1, k)),
    );
    const oj = pVar(f.vars, 2 + j);
    h = pAdd(h, pSub(pMul(oj, yj), pScale(pMul(yj, yj), rat(1, 2))));
  }
  return h;
}

/** Groves payment in gauge h (default: the Clarke pivot): p = h - W_-i. */
export function grovesPayment(f: Family, h?: Poly): Poly {
  const gauge = h ?? pivotH(f);
  pAssertSame(gauge, wMinusI(f), "grovesPayment");
  return pSub(gauge, wMinusI(f));
}

/** Utility of report s under true type t: u = t*x - x^2/2 - p. */
export function uOwn(f: Family, p: Poly): Poly {
  const x = xOwn(f);
  const t = pVar(f.vars, f.tIdx);
  return pSub(pSub(pMul(t, x), pScale(pMul(x, x), rat(1, 2))), p);
}

// ---------------------------------------------------------------------------
// the chain: [E] envelope, [I] fiber integration, [S] stationarity, [G] Groves
// ---------------------------------------------------------------------------

export interface Rule {
  readonly xOwn: Poly;
  readonly dxOwnDS: Poly;
}

export function efficientRule(f: Family): Rule {
  return { xOwn: xOwn(f), dxOwnDS: dxOwnDS(f) };
}

/** [E] the envelope residual: (t - x) . dx/ds - dp/ds, restricted to the
 * truthful diagonal t := s. The zero polynomial iff the payment satisfies
 * the envelope identity on the whole region. */
export function envelopeResidual(f: Family, p: Poly, rule?: Rule): Poly {
  const r = rule ?? efficientRule(f);
  const t = pVar(f.vars, f.tIdx);
  const field = pSub(pMul(pSub(t, r.xOwn), r.dxOwnDS), pDeriv(p, f.sIdx));
  return pSubst(field, f.tIdx, pVar(f.vars, f.sIdx));
}

/** The envelope integrand (polynomial in (s, o)): dp/ds along the fiber. */
export function envelopeIntegrand(f: Family, rule?: Rule): Poly {
  const r = rule ?? efficientRule(f);
  const t = pVar(f.vars, f.tIdx);
  return pSubst(pMul(pSub(t, r.xOwn), r.dxOwnDS), f.tIdx, pVar(f.vars, f.sIdx));
}

/** [I] the gauge readoff: p minus its definite fiber integral from s0. The
 * fiber derivative of the readoff is p' - (envelope integrand), zero by [E],
 * so on a convex region the readoff is h(theta_-i) — and its value at s0 is
 * exactly p(s0), the anchored payment. */
export function gaugeReadoff(f: Family, p: Poly, s0: Rat, rule?: Rule): Poly {
  const integ = pInteg(envelopeIntegrand(f, rule), f.sIdx);
  const anchor = pSubstRat(integ, f.sIdx, s0);
  return pAdd(pSub(p, integ), anchor);
}

export type Classification =
  | { kind: "gauge"; h: Poly }
  | { kind: "not-dsic"; offending: number };

/** The Green-Laffont classifier: a payment whose readoff carries own-report
 * monomials is NOT on the gauge orbit (not DSIC for the efficient rule);
 * a clean readoff IS Groves + gauge by construction. */
export function classifyPayment(f: Family, p: Poly, s0: Rat, rule?: Rule): Classification {
  const off = gaugeReadoff(f, p, s0, rule);
  const count = pMonomialsUsing(off, f.sIdx);
  if (count > 0) return { kind: "not-dsic", offending: count };
  return { kind: "gauge", h: off };
}

/** [S] welfare stationarity: sum_j (theta_j - x_j) . dx_j/ds on the diagonal
 * t := s — zero iff the rule is efficient-stationary in the own-report
 * direction (where efficiency enters the derivation). */
export function welfareStationarityResidual(f: Family, rule?: Rule): Poly {
  const r = rule ?? efficientRule(f);
  const t = pVar(f.vars, f.tIdx);
  let sum = pMul(pSub(t, r.xOwn), r.dxOwnDS);
  for (let j = 0; j < f.n - 1; j++) {
    const xj = xOther(f, j);
    sum = pAdd(sum, pMul(pSub(pVar(f.vars, 2 + j), xj), pDeriv(xj, f.sIdx)));
  }
  return pSubst(sum, f.tIdx, pVar(f.vars, f.sIdx));
}

/** [G] the Groves-form residual: p + W_-i(x). The Groves form iff this has
 * NO own-report monomials (it then IS the gauge h). */
export function grovesFormResidual(f: Family, p: Poly): Poly {
  return pAdd(p, wMinusI(f));
}

// ---------------------------------------------------------------------------
// the charge (T6): deviation gain, welfare gap, closed form, orbit conservation
// ---------------------------------------------------------------------------

/** Deviation gain G(s;t,o) = u(s;t,o) - u(t;t,o) for payment p. */
export function deviationGain(f: Family, p: Poly): Poly {
  const u = uOwn(f, p);
  return pSub(u, pSubst(u, f.sIdx, pVar(f.vars, f.tIdx)));
}

/** The welfare-gap form Phi_t(x(s)) - Phi_t(x(t)) — the charge computed
 * WITHOUT payments (the continuum face of exp1's bitwise identity). */
export function welfareGapForm(f: Family): Poly {
  const x = xOwn(f);
  const t = pVar(f.vars, f.tIdx);
  const phi = pAdd(pSub(pMul(t, x), pScale(pMul(x, x), rat(1, 2))), wMinusI(f));
  return pSub(phi, pSubst(phi, f.sIdx, pVar(f.vars, f.tIdx)));
}

/** The charge in closed form: G = -(n-1)/(2n) (s-t)^2 — DSIC for this
 * family by ordered-field arithmetic ((n-1)/(2n) > 0, squares >= 0),
 * equality iff s = t. */
export function chargeClosedForm(f: Family): Poly {
  const d = pSub(pVar(f.vars, f.sIdx), pVar(f.vars, f.tIdx));
  return pScale(pMul(d, d), rat(-(f.n - 1), 2 * f.n));
}

/** The identity G = closed form, as a residual polynomial (zero iff the
 * charge's closed form is exact). */
export function chargeIdentityResidual(n: number): Poly {
  const f = makeFamily(n);
  return pSub(deviationGain(f, grovesPayment(f)), chargeClosedForm(f));
}

/** N-I: the gauge-orbit conservation. Builds the family with an eps axis,
 * forms p + eps*g, and returns dG/deps — the zero polynomial iff the charge
 * is conserved along the one-parameter gauge orbit. */
export function gaugeOrbitDerivative(n: number, g: Poly): Poly {
  const f = makeFamily(n, ["eps"]);
  const epsIdx = f.vars.length - 1;
  if (g.vars.length !== f.vars.length) {
    throw new Error("gaugeOrbitDerivative: gauge polynomial arity mismatch");
  }
  for (let i = 0; i < f.vars.length; i++) {
    if (g.vars[i] !== f.vars[i]) throw new Error("gaugeOrbitDerivative: gauge variable mismatch");
  }
  const pEps = pAdd(grovesPayment(f), pMul(pVar(f.vars, epsIdx), g));
  return pDeriv(deviationGain(f, pEps), epsIdx);
}

/** A seeded random gauge polynomial: monomials in the OTHERS' types only
 * (degrees 0..3, rational coefficients) — it never touches s or t. */
export function randomGauge(f: Family, rng: Rng, terms: number): Poly {
  const denominators = [1, 2, 3, 4, 6];
  let g = pZero(f.vars);
  for (let k = 0; k < terms; k++) {
    const exps = new Array<number>(f.vars.length).fill(0);
    for (let j = 0; j < f.n - 1; j++) {
      exps[2 + j] = rng.intInclusive(0, 3);
    }
    const num = rng.intInclusive(-9, 9);
    const den = denominators[rng.intInclusive(0, denominators.length - 1)] as number;
    if (num === 0) continue;
    g = pAdd(g, pMono(f.vars, exps, rat(num, den)));
  }
  if (pIsZero(g)) g = pAdd(g, pConst(f.vars, rat(7, 5)));
  return g;
}

// ---------------------------------------------------------------------------
// K1: the off-gauge crime and its exact price
// ---------------------------------------------------------------------------

/** The off-gauge perturbation p' = p + eps*s (a payment that moves ALONG the
 * own-report coordinate — off the gauge orbit, which only allows moves along
 * theta_-i): the [E] residual is EXACTLY -eps (the eps^1 coefficient; the
 * constant term stays 0). */
export function offGaugeEnvelopeResidual(n: number): { epsCoeff: Rat; constantTerm: Rat } {
  const f = makeFamily(n, ["eps"]);
  const epsIdx = f.vars.length - 1;
  const crime = pMul(pVar(f.vars, epsIdx), pVar(f.vars, f.sIdx));
  const p = pAdd(grovesPayment(f), crime);
  const res = envelopeResidual(f, p); // poly in (s, o, eps)
  const zero = new Array<number>(f.vars.length).fill(0);
  const oneEps = [...zero];
  oneEps[epsIdx] = 1;
  return { epsCoeff: pCoef(res, oneEps), constantTerm: pCoef(res, zero) };
}

/** The exact profitable deviation for p' = p + eps*s: at s* = t - eps*n/(n-1)
 * the gain is exactly eps^2 n / (2(n-1)). Returns the substituted gain
 * polynomial (constant in t) plus the numeric check. */
export function offGaugeCrime(n: number, eps: Rat): { substituted: Poly; gainAt: Rat; expected: Rat; f: Family } {
  const f = makeFamily(n, ["eps"]);
  const epsIdx = f.vars.length - 1;
  const crime = pMul(pVar(f.vars, epsIdx), pVar(f.vars, f.sIdx));
  const p = pAdd(grovesPayment(f), crime);
  const gain = deviationGain(f, p);
  const sStar = pSub(pVar(f.vars, f.tIdx), pScale(pVar(f.vars, epsIdx), rat(n, n - 1)));
  const substituted = pSubst(gain, f.sIdx, sStar);
  const point: Rat[] = f.vars.map(() => rat(1, 2));
  point[epsIdx] = eps;
  return {
    substituted,
    gainAt: pEval(substituted, point),
    expected: rMul(rMul(eps, eps), rat(n, 2 * (n - 1))),
    f,
  };
}

// ---------------------------------------------------------------------------
// K2: the kappa family (implementable, non-Groves) and the decreasing rule
// ---------------------------------------------------------------------------

/** x^kappa_own = kappa*s - (kappa*s + sum o)/n + 1/n — the rule efficient
 * for the discounted profile (kappa*s, o). */
export function kappaXOwn(f: Family, kappa: Rat): Poly {
  const s = pVar(f.vars, f.sIdx);
  const disc = pAdd(pScale(s, kappa), othersSum(f));
  return pAdd(pScale(s, kappa), pSub(pConst(f.vars, rat(1, f.n)), pScale(disc, rat(1, f.n))));
}

export function kappaRule(f: Family, kappa: Rat): Rule {
  const x = kappaXOwn(f, kappa);
  return { xOwn: x, dxOwnDS: pDeriv(x, f.sIdx) };
}

/** The kappa-rule's implementing payment: the fiber integral of its own
 * envelope integrand, anchored on the pivot (monotone for kappa > 0). */
export function kappaPayment(f: Family, kappa: Rat, s0: Rat): Poly {
  const integ = pInteg(envelopeIntegrand(f, kappaRule(f, kappa)), f.sIdx);
  const anchor = pSubstRat(integ, f.sIdx, s0);
  const pivotAnchor = pSubstRat(pivotH(f), f.sIdx, s0);
  return pAdd(pSub(integ, anchor), pivotAnchor);
}

/** Others' welfare at the kappa-allocation. */
export function kappaWMinusI(f: Family, kappa: Rat): Poly {
  let w = pZero(f.vars);
  for (let j = 0; j < f.n - 1; j++) {
    const oj = pVar(f.vars, 2 + j);
    const xj = pSub(
      pAdd(oj, pConst(f.vars, rat(1, f.n))),
      pScale(pAdd(pScale(pVar(f.vars, f.sIdx), kappa), othersSum(f)), rat(1, f.n)),
    );
    w = pAdd(w, pSub(pMul(oj, xj), pScale(pMul(xj, xj), rat(1, 2))));
  }
  return w;
}

/** The [G] drift for the kappa-rule payment: exactly kappa(1-kappa)(n-1)/n*s
 * — zero ONLY on the kappa = 1 slice (the efficiency hypothesis). */
export function kappaGrovesDrift(f: Family, kappa: Rat, s0: Rat): Poly {
  return pDeriv(pAdd(kappaPayment(f, kappa, s0), kappaWMinusI(f, kappa)), f.sIdx);
}

/** The decreasing rule x(s) = d - c*s: 2-cycle of the allocation 1-form =
 * c(a-b)^2 > 0 (Rochet continuum violation — exact rational arithmetic). */
export function decreasingRuleCycle(a: Rat, b: Rat, c: Rat): Rat {
  const d = rSub(a, b);
  return rMul(c, rMul(d, d));
}

/** For the decreasing rule and ANY affine payment beta*s: an exactly
 * profitable deviation exists. Returns one (s, gain) witness. */
export function decreasingProfitableDeviation(t: Rat, c: Rat, d: Rat, beta: Rat): { s: Rat; gain: Rat } {
  // gain(s;t) = t*(x(s)-x(t)) - beta*(s-t) = -(t*c + beta)*(s-t)
  const slope = rAdd(rMul(t, c), beta);
  const step = rSub(REGION_HI, REGION_LO);
  const s = rCmp(slope, rat(0)) < 0 ? rAdd(t, step) : rSub(t, step);
  const gain = rMul(rNeg(slope), rSub(s, t));
  const level = rSub(d, rMul(c, s));
  if (rCmp(level, rat(0)) < 0 || rCmp(level, rat(1)) > 0) {
    throw new Error(`decreasing control: allocation level ${rStr(level)} left [0,1]`);
  }
  if (rCmp(gain, rat(0)) <= 0) throw new Error("decreasing control: witness not profitable");
  return { s, gain };
}

// ---------------------------------------------------------------------------
// T5: the allocation 1-form — closedness (Helmholtz) and the skew control
// ---------------------------------------------------------------------------

/** Two divisible goods, n agents, own fiber report (s1, s2) with others'
 * types symbolic (o1, o2): x_k = s_k - (s_k + o_k)/n + 1/n per good. */
export function twoGoodOwnAllocation(n: number): { x1: Poly; x2: Poly; vars: readonly string[] } {
  const vars = ["s1", "s2", "o1", "o2"];
  const build = (si: number, oi: number): Poly =>
    pAdd(
      pSub(pScale(pVar(vars, si), rat(n - 1, n)), pScale(pVar(vars, oi), rat(1, n))),
      pConst(vars, rat(1, n)),
    );
  return { x1: build(0, 2), x2: build(1, 3), vars };
}

/** Closedness of the allocation 1-form alpha = x.ds on the own fiber:
 * d alpha = 0 iff the Jacobian is symmetric — the Euler-Lagrange face of
 * the report action (the Helmholtz condition; OLV86) and the exact
 * existence condition for a payment (alpha = dp on a convex fiber). */
export function allocationClosednessResidual(x1: Poly, x2: Poly): Poly {
  pAssertSame(x1, x2, "allocationClosednessResidual");
  return pSub(pDeriv(x2, 0), pDeriv(x1, 1));
}

/** The skew-perturbed rule x~ = x + c*(s2, -s1) (n = 2 goods family):
 * closedness residual EXACTLY -2c — the family crosses the implementable
 * locus exactly at c = 0. */
export function skewRule(c: Rat): { x1: Poly; x2: Poly } {
  const { x1, x2, vars } = twoGoodOwnAllocation(2);
  return {
    x1: pAdd(x1, pScale(pVar(vars, 1), c)),
    x2: pSub(x2, pScale(pVar(vars, 0), c)),
  };
}

/** Integral of alpha = x1 ds1 + x2 ds2 around the fiber rectangle
 * [a, a+w] x [b, b+h] at others = (o1, o2) — exact edge integration. */
export function rectangleCycleIntegral(
  x1: Poly,
  x2: Poly,
  a: Rat,
  b: Rat,
  w: Rat,
  h: Rat,
  o1: Rat,
  o2: Rat,
): Rat {
  const vars = x1.vars;
  const base = (): Rat[] => {
    const pt = new Array<Rat>(vars.length).fill(rat(0));
    pt[2] = o1;
    pt[3] = o2;
    return pt;
  };
  const edge = (form: Poly, fixedIdx: number, fixedVal: Rat, from: Rat, to: Rat, movingIdx: number): Rat => {
    const restricted = pSubstRat(form, fixedIdx, fixedVal);
    const integ = pInteg(restricted, movingIdx);
    const lo = base();
    lo[fixedIdx] = fixedVal;
    lo[movingIdx] = from;
    const hi = base();
    hi[fixedIdx] = fixedVal;
    hi[movingIdx] = to;
    return rSub(pEval(integ, hi), pEval(integ, lo));
  };
  const bottom = edge(x1, 1, b, a, rAdd(a, w), 0);
  const right = edge(x2, 0, rAdd(a, w), b, rAdd(b, h), 1);
  const top = edge(x1, 1, rAdd(b, h), rAdd(a, w), a, 0);
  const left = edge(x2, 0, a, rAdd(b, h), b, 1);
  return rAdd(rAdd(bottom, right), rAdd(top, left));
}

// ---------------------------------------------------------------------------
// K3: the annulus — closed but not exact, exactly
// ---------------------------------------------------------------------------

export interface RatFun {
  readonly num: Poly;
  readonly den: Poly;
}

/** d(N/D)/dx by the quotient rule (denominator kept as D^2). */
export function rfDeriv(rf: RatFun, idx: number): RatFun {
  return {
    num: pSub(pMul(pDeriv(rf.num, idx), rf.den), pMul(rf.num, pDeriv(rf.den, idx))),
    den: pMul(rf.den, rf.den),
  };
}

/** The winding form omega = (x dy - y dx)/(x^2 + y^2) as P dx + Q dy. */
export function windingForm(): { vars: readonly string[]; P: RatFun; Q: RatFun } {
  const vars = ["x", "y"];
  const x = pVar(vars, 0);
  const y = pVar(vars, 1);
  const den = pAdd(pMul(x, x), pMul(y, y));
  return { vars, P: { num: pScale(y, rat(-1)), den }, Q: { num: x, den } };
}

/** curl(omega): both partials share the denominator D^2, so a zero NUMERATOR
 * difference proves curl = 0 coefficient-wise. */
export function windingCurlNumerator(): Poly {
  const { P, Q } = windingForm();
  const dQdx = rfDeriv(Q, 0);
  const dPdy = rfDeriv(P, 1);
  pAssertSame(dQdx.den, dPdy.den, "windingCurlNumerator");
  return pSub(dQdx.num, dPdy.num);
}

/** Quarter-turn invariance: (x, y) -> (-y, x) pulls omega back to omega.
 * Pulled-back dx-coefficient should equal P, dy-coefficient equal Q —
 * verified on the common denominator D (invariant under the turn). The
 * substitution is SIMULTANEOUS (sequential composition was convicted). */
export function windingQuarterTurnCheck(): { pbPminusP: Poly; pbQminusQ: Poly } {
  const { vars, P, Q } = windingForm();
  const negY = pScale(pVar(vars, 1), rat(-1));
  const x = pVar(vars, 0);
  // p(x, y) -> p(-y, x) in one simultaneous step
  const pb = (p: Poly): Poly => pSubstAll(p, [0, 1], [negY, x]);
  // pulled-back form: Q(x',y') dx + (-P(x',y')) dy
  return {
    pbPminusP: pSub(pb(Q.num), P.num),
    pbQminusQ: pSub(pScale(pb(P.num), rat(-1)), Q.num),
  };
}

/** The diamond side (1,0) -> (0,1) parametrized by gamma(t) = (1-t, t):
 * the pullback of omega is EXACTLY dt / (2t^2 - 2t + 1). Machine route: set
 * x := 1 - y in the (x, y) ring (the line of the side), read off numerator
 * and denominator as polynomials in y alone (the side parameter), and check
 * the antiderivative identity d/dt atan(2t-1) = 1/(2t^2-2t+1), which
 * reduces to 2(2t^2-2t+1) - (1 + (2t-1)^2) = 0. */
export function diamondSideIdentities(): {
  pullbackNumerator: Poly; // must be the constant 1
  pullbackDenominator: Poly; // 2y^2 - 2y + 1, y the side parameter
  antiderivativeCheck: Poly;
} {
  const { vars, P, Q } = windingForm();
  const oneMinusY = pSub(pConst(vars, rat(1)), pVar(vars, 1));
  // along the side: dx/dt = -1, dy/dt = +1 ⟹ pulled-back numerator
  // -P(gamma) + Q(gamma)
  const pulled = pAdd(
    pScale(pSubst(P.num, 0, oneMinusY), rat(-1)),
    pSubst(Q.num, 0, oneMinusY),
  );
  const denPulled = pSubst(P.den, 0, oneMinusY);
  // after x := 1 - y no monomial may carry x; any survivor is a bug.
  const numEntries: Array<readonly [string, Rat]> = [];
  const denEntries: Array<readonly [string, Rat]> = [];
  for (const [k, c] of pulled.mono) {
    const e = k.split(",").map(Number);
    if ((e[0] as number) !== 0) throw new Error("diamondSideIdentities: x survived the pullback");
    numEntries.push([k, c]);
  }
  for (const [k, c] of denPulled.mono) {
    const e = k.split(",").map(Number);
    if ((e[0] as number) !== 0) throw new Error("diamondSideIdentities: x survived the pullback");
    denEntries.push([k, c]);
  }
  const numY = pFromMonomials(vars, numEntries);
  const denY = pFromMonomials(vars, denEntries);
  const y = pVar(vars, 1);
  const twoM1 = pSub(pScale(y, rat(2)), pConst(vars, rat(1)));
  const antiderivativeCheck = pSub(
    pScale(denY, rat(2)),
    pAdd(pConst(vars, rat(1)), pMul(twoM1, twoM1)),
  );
  return { pullbackNumerator: numY, pullbackDenominator: denY, antiderivativeCheck };
}

/** Composite Simpson on [0,1] of dt/(2t^2-2t+1) — numeric cross-check of
 * the exact antiderivative identity (O(h^4) convergence). */
export function diamondSideSimpson(n: number): number {
  const f = (t: number): number => 1 / (2 * t * t - 2 * t + 1);
  const h = 1 / n;
  let s = f(0) + f(1);
  for (let i = 1; i < n; i++) {
    s += (i % 2 === 1 ? 4 : 2) * f(i * h);
  }
  return (s * h) / 3;
}

// ---------------------------------------------------------------------------
// K4: the second-price kink
// ---------------------------------------------------------------------------

/** Second-price auction, one item, two agents. On the open region
 * theta_1 > theta_2 agent 1 wins and pays theta_2 (the Clarke-pivot Groves
 * payment). Pairwise envelope on the region: U(theta_1') - U(theta_1)
 * equals the type step exactly (x = 1 throughout) — bitwise. */
export function secondPriceEnvelopePair(theta1: Rat, theta1Prime: Rat, theta2: Rat): { uDiff: Rat; xStep: Rat; ok: boolean } {
  if (rCmp(theta1, theta2) <= 0 || rCmp(theta1Prime, theta2) <= 0) {
    throw new Error("secondPriceEnvelopePair: both reports must stay in the winning region");
  }
  const u = (th: Rat): Rat => rSub(th, theta2);
  const uDiff = rSub(u(theta1Prime), u(theta1));
  const xStep = rSub(theta1Prime, theta1);
  return { uDiff, xStep, ok: rCmp(uDiff, xStep) === 0 };
}

/** The allocation rule of the second-price auction: 1 if theta_1 > theta_2
 * else 0 (rational comparison — no floats). */
export function secondPriceX(theta1: Rat, theta2: Rat): Rat {
  return rCmp(theta1, theta2) > 0 ? rat(1) : rat(0);
}

/** The kink witness: crossing the diagonal by any eps > 0 moves the
 * allocation by exactly 1 — computed from the rule, not asserted. */
export function secondPriceKinkJump(theta2: Rat, eps: Rat): Rat {
  return rSub(secondPriceX(rAdd(theta2, eps), theta2), secondPriceX(rSub(theta2, eps), theta2));
}

// ---------------------------------------------------------------------------
// interior guard + grid witness
// ---------------------------------------------------------------------------

/** Corner check with exact rational interval arithmetic: for the affine
 * x_j = theta_j - thetabar + 1/n on the box, corner values bound the box:
 * min = -1/5 + 1/n > 0, max = 1/5 + 1/n < 1 — the capacity walls are never
 * touched (the smooth chain's interior hypothesis holds on the region). */
export function interiorGuard(n: number): { lo: Rat; hi: Rat; ok: boolean } {
  const lo = rAdd(rat(-1, 5), rat(1, n));
  const hi = rAdd(rat(1, 5), rat(1, n));
  return { lo, hi, ok: rCmp(lo, rat(0)) > 0 && rCmp(hi, rat(1)) < 0 };
}

/** Exact charge grid witness: G(s;t) at rational grid points is <= 0 with
 * equality only on the diagonal (independent check of the closed form). */
export function chargeGridWitness(n: number, steps: number): { worst: Rat; worstOffDiag: Rat } {
  const f = makeFamily(n);
  const gain = deviationGain(f, grovesPayment(f));
  let worst = rat(0);
  let worstOff = rat(-1);
  const point: Rat[] = f.vars.map(() => rat(1, 2));
  const width = rSub(REGION_HI, REGION_LO);
  for (let i = 0; i <= steps; i++) {
    for (let k = 0; k <= steps; k++) {
      point[f.sIdx] = rAdd(REGION_LO, rMul(rat(i, steps), width));
      point[f.tIdx] = rAdd(REGION_LO, rMul(rat(k, steps), width));
      const g = pEval(gain, point);
      if (rCmp(g, worst) > 0) worst = g;
      if (i !== k && rCmp(g, worstOff) > 0) worstOff = g;
    }
  }
  return { worst, worstOffDiag: worstOff };
}
