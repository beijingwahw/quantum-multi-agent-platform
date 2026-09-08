/**
 * The interior theorem — v0.2.0's upgrade face.
 *
 * v0.1.0's honest boundary said: "T4 interior is data, monotone on grid
 * only." This module executes the theorem half: net(p) = (1 - h2((1-p)/2))/2
 * is certified STRICTLY INCREASING on the rational grid family p = i/20 by
 * exact interval arithmetic — every gap compared is an exact BigInt rational
 * (upper bound of net(p_i) < lower bound of net(p_{i+1})), with h2 enclosed
 * on TWO independent paths (closed form and the Taylor series around the
 * maximum, both with rigorous tails). No float enters any certificate; the
 * only transcendental object (ln) lives behind rational series bounds.
 *
 * Honest split (stated on the report, enforced by the ledger tags):
 *   THEOREM (machine, exact): grid monotonicity per path; second-difference
 *     positivity on the grid; strict positivity of every sampled interval
 *     difference quotient. These need no calculus.
 *   CITATION (classical analysis): h2'(q) = log2((1-q)/q) and
 *     net''(p) = 1/(8 ln2 q(1-q)) (differentiation of -q ln q). The machine
 *     verifies the citation pointwise as DATA: formula intervals vs sampled
 *     quotients, agreement quoted; positivity of the formula intervals is
 *     exact GIVEN the formula (reduces to q < 1/2, pure rational algebra).
 *
 * The certificate checkers are generic on interval lists — the smuggling
 * trials feed them counterfeit curves and customs must NAME the cell.
 */
import {
  type Frac,
  type Ivl,
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
  iMul,
  iOf,
  iScaleNonneg,
  iSub,
  iWidth,
  h2Closed,
  h2Series,
  netOnPath,
  negLn,
  LN2,
} from "./rational.js";

// --- generic certificate checkers (shared with the smuggling trials) -----------------------

export interface StrictIncrResult {
  readonly ok: boolean;
  /** index of the first adjacent pair that fails (named rejection), null when ok */
  readonly firstFailure: number | null;
  /** min over pairs of v[i+1].lo - v[i].hi (the certificate's margin), null when !ok */
  readonly minGap: Frac | null;
}

/** Strictly increasing, certified: every interval upper bound < next lower bound. */
export function certifyStrictlyIncreasing(v: readonly Ivl[]): StrictIncrResult {
  let minGap: Frac | null = null;
  for (let i = 0; i + 1 < v.length; i++) {
    const gap = fSub(v[i + 1]!.lo, v[i]!.hi);
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

// --- the grid family and the two net paths ---------------------------------------------------

export const MONO_GRID_N = 20;

export const netClosedIvl = (p: Frac): Ivl => netOnPath(p, h2Closed);
export const netSeriesIvl = (p: Frac): Ivl => netOnPath(p, h2Series);

export function monoGridPoints(): Frac[] {
  const pts: Frac[] = [];
  for (let i = 0; i <= MONO_GRID_N; i++) pts.push(fDiv(fr0(i), fr0(MONO_GRID_N)));
  return pts;
}

function fr0(x: number): Frac {
  return { n: BigInt(x), d: 1n };
}

export interface MonoCert {
  readonly ok: boolean;
  readonly closed: StrictIncrResult; // all 20 adjacent pairs (anchors exact on this path)
  readonly series: StrictIncrResult; // pairs (0,1)..(18,19): series honest for q != 0, exact at d=0
  readonly gaps: readonly Frac[]; // closed-path gaps, one per adjacent pair (the printed certificate)
  readonly maxWidth: Frac; // widest enclosure across both paths — the honesty number
  readonly crossOverlapAll: boolean; // the two paths' h2 enclosures share a point everywhere
}

/** The monotonicity certificate on the full grid family, both paths (memoized — pure and expensive). */
let monoCache: MonoCert | null = null;

export function monoCertificate(): MonoCert {
  monoCache ??= computeMono();
  return monoCache;
}

function computeMono(): MonoCert {
  const pts = monoGridPoints();
  const closed = pts.map(netClosedIvl);
  // p = 1 (q = 0, d = 1): the series diverges — the honest exclusion; the
  // series path certifies pairs (0,1)..(18,19), the closed path carries the
  // anchor pair (19,20) with net(1) = 1/2 exact.
  const seriesPts = pts.filter((p) => fCmp(p, F_ONE) !== 0);
  const series = seriesPts.map(netSeriesIvl);
  let maxWidth = F_ZERO;
  for (const iv of [...closed, ...series]) {
    const w = iWidth(iv);
    if (fCmp(w, maxWidth) > 0) maxWidth = w;
  }
  // cross-path overlap at every shared grid point: net is a strictly monotone
  // affine image of h2, so the net enclosures overlap iff the h2 ones do
  let crossOverlapAll = true;
  for (let i = 0; i < series.length; i++) {
    const a = closed[i]!;
    const b = series[i]!;
    if (fCmp(a.lo, b.hi) > 0 || fCmp(b.lo, a.hi) > 0) crossOverlapAll = false;
  }
  const closedRes = certifyStrictlyIncreasing(closed);
  const seriesRes = certifyStrictlyIncreasing(series);
  const gaps = closed.slice(0, -1).map((iv, i) => fSub(closed[i + 1]!.lo, iv.hi));
  return {
    ok: closedRes.ok && seriesRes.ok && crossOverlapAll,
    closed: closedRes,
    series: seriesRes,
    gaps,
    maxWidth,
    crossOverlapAll,
  };
}

// --- the convexity / inflection face ----------------------------------------------------------

export interface ConvexCert {
  readonly ok: boolean;
  readonly convex: ConvexResult; // grid second differences, exact
  readonly minDD: Frac | null;
  /** sampled interval difference quotients strictly positive — rigorous, no calculus */
  readonly quotientsPositive: boolean;
  /** citation formula net'(p) = log2((1-q)/q)/4 strictly positive at every sample, GIVEN the formula */
  readonly formulaPositive: boolean;
  /** max |sampled quotient interval - formula interval| across samples — the DATA agreement */
  readonly derivMaxDist: Frac;
  /** citation formula net''(p) = 1/(8 ln2 q(1-q)) strictly positive at every sample, GIVEN the formula */
  readonly secondFormulaPositive: boolean;
  /** max |sampled second-difference quotient - second-formula interval| — DATA agreement */
  readonly secondDerivMaxDist: Frac;
  /** the inflection map: grid cells whose second difference is NOT certified positive (empty when ok) */
  readonly inflectionCells: readonly number[];
}

const DERIV_H_DEN = 100; // h = 1/100, samples p = j/20 (j = 1..19): p +/- h stays in (0,1)

function iDist(a: Ivl, b: Ivl): Frac {
  const c1 = fSub(a.lo, b.hi);
  const c2 = fSub(b.lo, a.hi);
  return fCmp(c1, c2) > 0 ? c1 : c2;
}

/**
 * The convexity face: convexity ON THE GRID as exact machine data (interval
 * second differences strictly positive), the analytic candidate (net''
 * = 1/(8 ln2 q(1-q)) > 0 — no interior inflection) verified pointwise as
 * data, its positivity exact GIVEN the citation formula. Memoized.
 */
let convexCache: ConvexCert | null = null;

export function convexityCertificate(): ConvexCert {
  convexCache ??= computeConvex();
  return convexCache;
}

function computeConvex(): ConvexCert {
  const pts = monoGridPoints();
  const closed = pts.map(netClosedIvl);
  const convex = certifyConvexGrid(closed);

  const h = fr(1, DERIV_H_DEN);
  let quotientsPositive = true;
  let formulaPositive = true;
  let secondFormulaPositive = true;
  let derivMaxDist = F_ZERO;
  let secondDerivMaxDist = F_ZERO;

  for (let j = 1; j < MONO_GRID_N; j++) {
    const p = fDiv(fr0(j), fr0(MONO_GRID_N));
    const q = fDiv(fSub(F_ONE, p), fr0(2));
    const fwd = netClosedIvl(fAdd(p, h));
    const mid = netClosedIvl(p);
    const bwd = netClosedIvl(fSub(p, h));

    // sampled first difference quotient (h divides the exact rational scalar)
    const quot = iScaleNonneg(iSub(fwd, bwd), fDiv(F_ONE, fMul(fr0(2), h)));
    if (fCmp(quot.lo, F_ZERO) <= 0) quotientsPositive = false;
    // citation: net'(p) = (1/4) log2((1-q)/q) = (1/4) * (-ln(q/(1-q))) / ln2
    const ratio = fDiv(q, fSub(F_ONE, q)); // in (0,1) for p > 0
    const formula = iDivPos(negLn(ratio), iScaleNonneg(LN2, fr0(4)));
    if (fCmp(formula.lo, F_ZERO) <= 0) formulaPositive = false;
    const dist = iDist(quot, formula);
    if (fCmp(dist, derivMaxDist) > 0) derivMaxDist = dist;

    // sampled second difference quotient / h^2 vs citation net''(p)
    const ddq = iScaleNonneg(iSub(iAdd(fwd, bwd), iAdd(mid, mid)), fDiv(F_ONE, fMul(h, h)));
    const q1m = fMul(q, fSub(F_ONE, q));
    const second = iDivPos(iOf(F_ONE), iMul(iScaleNonneg(LN2, fr0(8)), iOf(q1m)));
    if (fCmp(second.lo, F_ZERO) <= 0) secondFormulaPositive = false;
    const dist2 = iDist(ddq, second);
    if (fCmp(dist2, secondDerivMaxDist) > 0) secondDerivMaxDist = dist2;
  }

  // the inflection map: name every cell whose second difference is NOT
  // certified positive — an honest map, filled iff the certificate failed
  const inflectionCells: number[] = [];
  for (let i = 1; i + 1 < closed.length; i++) {
    const dd = iSub(iAdd(closed[i - 1]!, closed[i + 1]!), iAdd(closed[i]!, closed[i]!));
    if (fCmp(dd.lo, F_ZERO) <= 0) inflectionCells.push(i);
  }
  return {
    ok: convex.ok && quotientsPositive,
    convex,
    minDD: convex.minDD,
    quotientsPositive,
    formulaPositive,
    derivMaxDist,
    secondFormulaPositive,
    secondDerivMaxDist,
    inflectionCells,
  };
}

/** Decimal helper for reports and quoted constants. */
export const dec = (a: Frac, digits = 6): string => fDecimal(a, digits);
