/**
 * The interior theorem — v0.2.0's upgrade face.
 *
 * v0.1.0's honest boundary said: "E4 interior is data, no convexity theorem
 * claimed." This module executes the theorem half for THREE closed-form
 * families, each stated precisely:
 *
 *   F1 (ESC18 weak readout): two completely depolarizing qubit boxes,
 *       control |+>, binary computational-basis ensemble, joint receiver.
 *       Under lambda-partial dephasing of the order register the joint output
 *       has member spectrum {(3-l)/8, (1+l)/8, 1/4, 1/4} and average spectrum
 *       {(5-l)/16 x2, (3+l)/16 x2} — every eigenvalue an affine, dyadic-slope
 *       function of lambda. Hence
 *         chi(l) = 2 f((5-l)/16) + 2 f((3+l)/16)
 *                  - f((3-l)/8) - f((1+l)/8) - 2 f(1/4),   f = -q log2 q,
 *       and chi is certified STRICTLY DECREASING and STRICTLY CONVEX on the
 *       rational grid lambda = i/20 (i = 0..20) by exact interval arithmetic,
 *       with ln enclosed on TWO independent series paths.
 *
 *   F2 (replacer control): the replacer pair parks its ensemble information
 *       on the control register (E3). Under the same lambda-readout the
 *       control ensemble has member spectra {l/2, 1-l/2} and {1/2, 1/2} and
 *       average spectrum {(3-l)/4, (1+l)/4}:
 *         chi_ctl(l) = f((3-l)/4) + f((1+l)/4) - [f(l/2) + f(1-l/2) + 1]/2.
 *       Same grid, same two paths, same certificate pair.
 *
 *   F3 (k=3 weak readout): six orders over three completely depolarizing
 *       boxes, uniform 6-dimensional control. Member spectrum
 *       {n/48 : n in 1,2,2,2,2,4,4,4,4,5,7,11} and average spectrum
 *       {1/16 x10, 3/16 x2} at full coherence c = 1; every eigenvalue is
 *       affine in c, eig(c) = c*base + (1-c)/12. Same grid, same paths.
 *
 * Honest split (stated on the report, enforced by the ledger tags):
 *   THEOREM (machine, exact): grid monotonicity and grid convexity per family
 *     per path — interval upper/lower bounds compared as exact rationals.
 *     These need no calculus.
 *   CITATION (classical analysis, verified as DATA): for F1 the candidate
 *     chi''(l) = [1/(3-l) + 1/(1+l) - 1/(5-l) - 1/(3+l)] / (8 ln 2)
 *     is checked pointwise against sampled interval second-difference
 *     quotients; agreement is quoted as data, never asserted as certificate.
 *
 * The certificate checkers are generic on interval lists and census points —
 * the smuggling trials feed them counterfeit curves and fake frontier tables,
 * and customs must NAME the cell.
 */
import {
  type Frac,
  type Ivl,
  F_HALF,
  F_ONE,
  F_ZERO,
  fAdd,
  fCmp,
  fDiv,
  fMul,
  fSub,
  fDecimal,
  fr,
  iAdd,
  iDivPos,
  iOf,
  iScaleNonneg,
  iSub,
  iWidth,
  fTerm,
  iNeg,
  LN_PATHS,
  PATH_T,
  type LnPath,
} from "./rational.js";

// --- generic certificate checkers (shared with the smuggling trials) -----------------------

export interface StrictDecrResult {
  readonly ok: boolean;
  /** index of the first adjacent pair that fails (named rejection), null when ok */
  readonly firstFailure: number | null;
  /** min over pairs of v[i].lo - v[i+1].hi (the certificate's margin), null when !ok */
  readonly minGap: Frac | null;
}

/** Strictly decreasing, certified: every interval lower bound > next upper bound. */
export function certifyStrictlyDecreasing(v: readonly Ivl[]): StrictDecrResult {
  let minGap: Frac | null = null;
  for (let i = 0; i + 1 < v.length; i++) {
    const gap = fSub(v[i]!.lo, v[i + 1]!.hi);
    if (fCmp(gap, F_ZERO) <= 0) return { ok: false, firstFailure: i, minGap: null };
    minGap = minGap === null ? gap : (fCmp(gap, minGap) < 0 ? gap : minGap);
  }
  return { ok: true, firstFailure: null, minGap };
}

export interface ConvexResult {
  readonly ok: boolean;
  /** index i of the first cell with non-positive second difference, null when ok */
  readonly firstFailure: number | null;
  /** min over cells of the LOWER bound of dd_i (the certificate's margin) */
  readonly minDD: Frac | null;
}

/** Convex on the grid, certified: every interval second difference has lo > 0. */
export function certifyConvexGrid(v: readonly Ivl[]): ConvexResult {
  let minDD: Frac | null = null;
  for (let i = 1; i + 1 < v.length; i++) {
    const dd = iSub(iAdd(v[i - 1]!, v[i + 1]!), iAdd(v[i]!, v[i]!));
    if (fCmp(dd.lo, F_ZERO) <= 0) return { ok: false, firstFailure: i, minDD: null };
    minDD = minDD === null ? dd.lo : (fCmp(dd.lo, minDD) < 0 ? dd.lo : minDD);
  }
  return { ok: true, firstFailure: null, minDD };
}

export interface CensusPoint {
  /** order-information gained (bits) — the GET column */
  readonly get: Ivl;
  /** capacity lost (bits of chi) — the PAY column */
  readonly pay: Ivl;
}

export interface AntichainResult {
  readonly ok: boolean;
  /** indices (dominator, dominated) of the first dominating pair, null when ok */
  readonly dominator: number | null;
  readonly dominated: number | null;
}

/**
 * Pareto certificate on the census: no measured point dominates another.
 * A dominates B when A gets >= order-knowledge for <= capacity loss with one
 * comparison strict — every comparison an exact certified interval relation
 * (lo/hi bounds), so a pair too close to certify is NOT reported (the claim
 * is only what is certified, on this census — never a global statement).
 */
export function certifyAntichain(points: readonly CensusPoint[]): AntichainResult {
  for (let a = 0; a < points.length; a++) {
    for (let b = 0; b < points.length; b++) {
      if (a === b) continue;
      const A = points[a]!;
      const B = points[b]!;
      const getGe = fCmp(A.get.lo, B.get.hi) >= 0;
      const payLe = fCmp(A.pay.hi, B.pay.lo) <= 0;
      const strict = fCmp(A.get.lo, B.get.hi) > 0 || fCmp(A.pay.hi, B.pay.lo) < 0;
      if (getGe && payLe && strict) return { ok: false, dominator: a, dominated: b };
    }
  }
  return { ok: true, dominator: null, dominated: null };
}

// --- the grid and the three closed-form families -------------------------------------------

export const GRID_N = 20;

export function gridPoints(): Frac[] {
  const pts: Frac[] = [];
  for (let i = 0; i <= GRID_N; i++) pts.push(fDiv(fr(i), fr(GRID_N)));
  return pts;
}

/** F1: chi(lambda) for the ESC18 weak-readout family, exact enclosure. */
export function esc18Chi(lambda: Frac, path: LnPath = PATH_T): Ivl {
  const l = lambda;
  const avgEntropy = iAdd(
    iScaleNonneg(fTerm(fDiv(fSub(fr(5), l), fr(16)), path), fr(2)),
    iScaleNonneg(fTerm(fDiv(fAdd(fr(3), l), fr(16)), path), fr(2)),
  );
  const memberEntropy = iAdd(
    fTerm(fDiv(fSub(fr(3), l), fr(8)), path),
    iAdd(fTerm(fDiv(fAdd(fr(1), l), fr(8)), path), iScaleNonneg(fTerm(F_HALF, path), fr(2))),
  );
  return iSub(avgEntropy, memberEntropy);
}

/** F2: control-ensemble chi(lambda) for the replacer family, exact enclosure. */
export function replacerChi(lambda: Frac, path: LnPath = PATH_T): Ivl {
  const l = lambda;
  const avg = iAdd(fTerm(fDiv(fSub(fr(3), l), fr(4)), path), fTerm(fDiv(fAdd(fr(1), l), fr(4)), path));
  const memberU = iAdd(fTerm(fDiv(l, fr(2)), path), fTerm(fDiv(fSub(fr(2), l), fr(2)), path));
  const memberOrth = iAdd(fTerm(F_HALF, path), fTerm(F_HALF, path));
  return iSub(avg, iScaleNonneg(iAdd(memberU, memberOrth), F_HALF));
}

/** F3 member eigenvalue numerators over 48 (multiplicity in the list). */
const K3_MEMBER_N: readonly number[] = [1, 2, 2, 2, 2, 4, 4, 4, 4, 5, 7, 11];
/** F3 average eigenvalues at full coherence: 1/16 ten times, 3/16 twice. */
const K3_AVG_BASE: readonly Frac[] = (() => {
  const bases: Frac[] = [];
  for (let k = 0; k < 10; k++) bases.push(fr(1, 16));
  bases.push(fr(3, 16), fr(3, 16));
  return bases;
})();

/** F3: chi(lambda) (coherence c = 1 - lambda) for the six-order family. */
export function k3Chi(lambda: Frac, path: LnPath = PATH_T): Ivl {
  const c = fSub(F_ONE, lambda);
  const uniform = fr(1, 12);
  let member = iOf(F_ZERO);
  for (const n of K3_MEMBER_N) {
    const eig = fAdd(fMul(c, fr(n, 48)), fMul(fSub(F_ONE, c), uniform));
    member = iAdd(member, fTerm(eig, path));
  }
  let avg = iOf(F_ZERO);
  for (const base of K3_AVG_BASE) {
    const eig = fAdd(fMul(c, base), fMul(fSub(F_ONE, c), uniform));
    avg = iAdd(avg, fTerm(eig, path));
  }
  return iSub(avg, member);
}

// --- the certificates (memoized — pure and expensive) ----------------------------------------

function iDist(a: Ivl, b: Ivl): Frac {
  const c1 = fSub(a.lo, b.hi);
  const c2 = fSub(b.lo, a.hi);
  return fCmp(c1, c2) > 0 ? c1 : c2;
}

export interface FamilyCert {
  readonly family: string;
  readonly closedForm: string;
  /** per-path strictly-decreasing results, one entry per LN_PATHS */
  readonly monotone: readonly StrictDecrResult[];
  /** per-path grid-convexity results */
  readonly convex: readonly ConvexResult[];
  /** min monotone margin over paths (exact) */
  readonly minGap: Frac | null;
  /** min convexity margin over paths (exact) */
  readonly minDD: Frac | null;
  /** widest enclosure across paths — the honesty number */
  readonly maxWidth: Frac;
  /** the two paths' enclosures share a point at every grid index */
  readonly crossOverlapAll: boolean;
  /** F1 only: max |sampled second-difference quotient - citation formula| (DATA, exact enclosure distance) */
  readonly citationMaxDist: Frac | null;
}

function certifyFamily(
  family: string,
  closedForm: string,
  chi: (lambda: Frac, path: LnPath) => Ivl,
  citationFormula: ((lambda: Frac, path: LnPath) => Ivl) | null,
): FamilyCert {
  const pts = gridPoints();
  const perPath = LN_PATHS.map((path) => pts.map((p) => chi(p, path)));
  const monotone = perPath.map((vals) => certifyStrictlyDecreasing(vals));
  const convex = perPath.map((vals) => certifyConvexGrid(vals));
  let minGap: Frac | null = null;
  for (const m of monotone) {
    if (m.minGap === null) continue;
    minGap = minGap === null ? m.minGap : (fCmp(m.minGap, minGap) < 0 ? m.minGap : minGap);
  }
  let minDD: Frac | null = null;
  for (const c of convex) {
    if (c.minDD === null) continue;
    minDD = minDD === null ? c.minDD : (fCmp(c.minDD, minDD) < 0 ? c.minDD : minDD);
  }
  let maxWidth = F_ZERO;
  for (const vals of perPath) {
    for (const iv of vals) {
      const w = iWidth(iv);
      if (fCmp(w, maxWidth) > 0) maxWidth = w;
    }
  }
  let crossOverlapAll = true;
  const [first, second] = perPath;
  if (first === undefined || second === undefined) throw new Error("certifyFamily: expected two paths");
  for (let i = 0; i < first.length; i++) {
    if (fCmp(first[i]!.lo, second[i]!.hi) > 0 || fCmp(second[i]!.lo, first[i]!.hi) > 0) {
      crossOverlapAll = false;
    }
  }
  // citation formula agreement (data): sampled second-difference quotients at
  // interior grid points, h = 1/100, vs the analytic candidate interval
  let citationMaxDist: Frac | null = null;
  if (citationFormula !== null) {
    const path = PATH_T;
    const h = fr(1, 100);
    let maxDist = F_ZERO;
    for (let j = 1; j < GRID_N; j++) {
      const p = fDiv(fr(j), fr(GRID_N));
      const fwd = chi(fAdd(p, h), path);
      const mid = chi(p, path);
      const bwd = chi(fSub(p, h), path);
      // (fwd - 2 mid + bwd) / h^2 — subtracting mid twice needs interval care
      const ddq = iDivPos(iSub(iAdd(fwd, bwd), iAdd(mid, mid)), iOf(fMul(h, h)));
      const dist = iDist(ddq, citationFormula(p, path));
      if (fCmp(dist, maxDist) > 0) maxDist = dist;
    }
    citationMaxDist = maxDist;
  }
  return {
    family,
    closedForm,
    monotone,
    convex,
    minGap,
    minDD,
    maxWidth,
    crossOverlapAll,
    citationMaxDist,
  };
}

const F1_FORMULA = "chi(l) = 2f((5-l)/16)+2f((3+l)/16)-f((3-l)/8)-f((1+l)/8)-2f(1/4)";
const F2_FORMULA = "chi(l) = f((3-l)/4)+f((1+l)/4)-[f(l/2)+f(1-l/2)+1]/2";
const F3_FORMULA = "chi(c) = sum_avg f(c*b+(1-c)/12) - sum_member f(c*n/48+(1-c)/12)";

/** F1 citation candidate: chi''(l) = [1/(3-l)+1/(1+l)-1/(5-l)-1/(3+l)]/(8 ln 2). */
function esc18SecondDerivative(lambda: Frac, path: LnPath): Ivl {
  const l = lambda;
  const bracket = iAdd(
    iAdd(iOf(fDiv(F_ONE, fSub(fr(3), l))), iOf(fDiv(F_ONE, fAdd(fr(1), l)))),
    iNeg(iAdd(iOf(fDiv(F_ONE, fSub(fr(5), l))), iOf(fDiv(F_ONE, fAdd(fr(3), l))))),
  );
  return iDivPos(iScaleNonneg(bracket, fr(1, 8)), path.ln2);
}

let esc18Cache: FamilyCert | null = null;
export function esc18Certificate(): FamilyCert {
  esc18Cache ??= certifyFamily("F1 ESC18 weak readout (grid lambda = i/20)", F1_FORMULA, esc18Chi, esc18SecondDerivative);
  return esc18Cache;
}

let replacerCache: FamilyCert | null = null;
export function replacerCertificate(): FamilyCert {
  replacerCache ??= certifyFamily("F2 replacer control (grid lambda = i/20)", F2_FORMULA, replacerChi, null);
  return replacerCache;
}

let k3Cache: FamilyCert | null = null;
export function k3Certificate(): FamilyCert {
  k3Cache ??= certifyFamily("F3 k=3 six orders (grid lambda = i/20)", F3_FORMULA, k3Chi, null);
  return k3Cache;
}

export function familyOk(c: FamilyCert): boolean {
  return (
    c.monotone.every((m) => m.ok) &&
    c.convex.every((v) => v.ok) &&
    c.crossOverlapAll
  );
}

// --- the exchange-rate frontier ---------------------------------------------------------------

export interface FrontierCensus {
  readonly family: string;
  /** census points (get = lambda bits of order knowledge, pay = chi lost) */
  readonly points: readonly CensusPoint[];
  readonly antichain: AntichainResult;
  /** marginal prices (chi lost per next order-bit), per adjacent pair */
  readonly marginal: readonly Ivl[];
  /** strictly decreasing marginal price — first-touch dominance, exact */
  readonly marginalDecreasing: StrictDecrResult;
}

export interface FrontierCert {
  readonly esc18: FrontierCensus;
  readonly replacer: FrontierCensus;
  readonly ok: boolean;
}

function censusFor(family: string, chi: (lambda: Frac, path: LnPath) => Ivl): FrontierCensus {
  const pts = gridPoints();
  const vals = pts.map((p) => chi(p, PATH_T));
  const chi0 = vals[0]!;
  const points: CensusPoint[] = pts.map((p, i) => ({
    get: iOf(p),
    pay: iSub(chi0, vals[i]!),
  }));
  const marginal: Ivl[] = [];
  for (let i = 0; i + 1 < vals.length; i++) {
    marginal.push(iSub(vals[i]!, vals[i + 1]!));
  }
  return {
    family,
    points,
    antichain: certifyAntichain(points),
    marginal,
    marginalDecreasing: certifyStrictlyDecreasing(marginal),
  };
}

let frontierCache: FrontierCert | null = null;

/**
 * The Pareto face: per family, the census (G = lambda order bits, L = chi
 * lost) is certified an antichain — no measured point dominates another — and
 * every next order-bit is strictly cheaper than the last (marginal price
 * decreasing: the wall is steepest at first touch). Both are exact; both are
 * certificates on the census only, never global claims.
 */
export function frontierCertificate(): FrontierCert {
  frontierCache ??= {
    esc18: censusFor("ESC18 joint chi", esc18Chi),
    replacer: censusFor("replacer control chi", replacerChi),
    get ok(): boolean {
      return this.esc18.antichain.ok && this.replacer.antichain.ok && this.esc18.marginalDecreasing.ok && this.replacer.marginalDecreasing.ok;
    },
  };
  return frontierCache;
}

/** Decimal helper for reports and quoted constants. */
export const dec = (a: Frac, digits = 6): string => fDecimal(a, digits);
