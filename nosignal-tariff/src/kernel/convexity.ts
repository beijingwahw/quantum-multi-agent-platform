/**
 * The derivative series and the convexity theorem — v0.6.0's upgrade face.
 *
 * T7 booked convexity as a CITATION face: the formulas net'(p) = log2((1-q)/q)/4
 * and net''(p) = 1/(8 ln2 q(1-q)) verified pointwise as data. v0.4.0's
 * monotonicity theorem showed the series re-indexed in p,
 *     net(p)  = sum_{k>=1} p^{2k} / (4 ln2 k(2k-1)),
 * has all-positive coefficients, and net's increments carry an exact algebraic
 * margin. This module finishes the program for the DERIVATIVE:
 *
 * THEOREM (machine, exact): differentiating the series term by term,
 *     net'(p) = sum_{k>=1} p^{2k-1} / (2 ln2 (2k-1))
 * — again ALL-POSITIVE coefficients on [0,1) — so for every rational pair
 * 0 <= p1 < p2 < 1,
 *     net'(p2) - net'(p1) >= (p2 - p1)/(2 ln2) > 0        (prime margin)
 * and for every rational triple 0 <= p1 < p2 < 1 with midpoint m = (p1+p2)/2,
 *     net(p2) - 2 net(m) + net(p1) >= (p2 - p1)^2/(8 ln2) > 0   (second-difference margin)
 * — net' is strictly increasing and net strictly convex at ANY scale the
 * rationals name, no grid, no calculus. Each margin is the k = 1 series term
 * plus a nonnegative remainder; the remainders are nonnegative by pure algebra:
 * odd monomials are monotone on [0, inf) (a^{2k-1} - b^{2k-1} factors), and the
 * even monomials' second differences satisfy the EXACT binomial identity
 *     (m+h)^{2k} + (m-h)^{2k} - 2 m^{2k} = 2 sum_{j=1..k} C(2k,2j) m^{2k-2j} h^{2j}
 *                                        >= 2 h^{2k} > 0,
 * machine-checked below by two independent BigInt evaluations.
 *
 * (The task sheet's draft bound (p2-p1)^2/(16 ln2) is implied by the stronger
 * (p2-p1)^2/(8 ln2) delivered here — the k = 1 term's exact second difference
 * (p2-p1)^2/2 times its coefficient 1/(4 ln2).)
 *
 * Anti-inflation gates (the same discipline as v0.4.0): a claimed margin must
 * stay UNDER the enclosures' upper bound on the true quantity, computed
 * cross-path (power-path hi vs closed-path lo). True margins pass everywhere;
 * an inflated forgery contradicts the data and is named.
 *
 * CITATION (classical analysis, consistency only): the T7 formulas
 * net'(p) = log2((1+p)/(1-p))/4 and net''(p) = 1/(2 ln2 (1-p^2)) — the
 * derivative series IS the first (artanh) and its term-wise derivative the
 * second; both are cross-checked as data against the series enclosures.
 * p = 0 returns [0,0] exact; p >= 1 is refused — 1 - p^2 = 0 in the tail
 * denominator, the honest exclusion of the series family.
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
  fr,
  frDec,
  iDivPos,
  iOverlap,
  iScaleNonneg,
  iSub,
  iAdd,
  iWidth,
  negLn,
  LN2,
  ivl,
} from "./rational.js";
import { refuse } from "../core/errors.js";
import { MONO_GRID_N, monoGridPoints, netClosedIvl } from "./theorem.js";
import { netPowerIvl } from "./global.js";

// --- the derivative series (all-positive coefficients) ------------------------------------------

const PRIME_TERMS = 512; // same budget as the h2/power paths: tail < 1e-21 for p <= 19/20

/**
 * net'(p) = sum_{k>=1} p^{2k-1}/(2 ln2 (2k-1)) — the artanh series over 2 ln2.
 * Partial sum exact by the same integer layout the power path uses (common
 * denominator B^(K-1) * C, C = prod of the odd denominators); the tail obeys
 *   sum_{k>K} p^{2k-1}/(2k-1) <= p^{2K+1}/(1-p^2)   (each 1/(2k-1) <= 1).
 * p = 0 returns [0,0] exact; p >= 1 is refused — the honest exclusion.
 */
export function netPrimeSeriesIvl(p: Frac): Ivl {
  if (fCmp(p, F_ZERO) < 0 || fCmp(p, F_ONE) >= 0) {
    refuse("CONVEXITY_PRIME_DOMAIN", "netPrimeSeriesIvl: p outside [0,1)");
  }
  if (fCmp(p, F_ZERO) === 0) return ivl(F_ZERO, F_ZERO); // every series term is 0
  const u = fMul(p, p); // p^2 in (0,1)
  const J = PRIME_TERMS - 1;
  const N = u.n;
  const B = u.d;
  const c: bigint[] = new Array<bigint>(J + 1); // c[j] = 2j+1
  for (let j = 0; j <= J; j++) c[j] = BigInt(2 * j + 1);
  const prefix: bigint[] = new Array<bigint>(J + 2).fill(1n); // prefix[j] = c_0..c_{j-1}
  for (let j = 0; j <= J; j++) prefix[j + 1] = prefix[j]! * c[j]!;
  const suffix: bigint[] = new Array<bigint>(J + 2).fill(1n); // suffix[j] = c_{j+1}..c_J
  for (let j = J; j >= 0; j--) suffix[j] = suffix[j + 1]! * c[j]!;
  const C = prefix[J + 1]!;
  let num = 0n;
  let powN = 1n; // N^j entering iteration j
  let powB = B ** BigInt(J); // B^{J-j} entering iteration j
  for (let j = 0; j <= J; j++) {
    num += powN * powB * (prefix[j]! * suffix[j + 1]!); // N^j B^{J-j} (C/c_j)
    powN *= N;
    powB /= B;
  }
  const psum: Frac = { n: num, d: B ** BigInt(J) * C }; // exact: sum_{j<=J} u^j/(2j+1)
  // net' partial sum = p * psum (the k-th series term is p^{2k-1} = p * u^{k-1})
  const psumP = fMul(p, psum);
  // tail <= p * u^K / (1 - u) — uk built to u^K by exact repeated multiplication
  let uk = F_ONE;
  for (let j = 0; j < PRIME_TERMS; j++) uk = fMul(uk, u);
  const tail = fDiv(fMul(p, uk), fSub(F_ONE, u));
  return iDivPos(ivl(psumP, fAdd(psumP, tail)), iScaleNonneg(LN2, fr(2)));
}

// --- the two theorem margins (exact BigInt algebra) ----------------------------------------------

/**
 * The exact prime margin: net'(p2) - net'(p1) >= (p2 - p1)/(2 ln2) — the k = 1
 * term (p, coefficient 1/(2 ln2)) plus a nonnegative remainder (each odd
 * monomial p^{2k-1} increasing on [0, inf): a^r - b^r = (a-b)(...) >= 0).
 * ln2 <= ln2_hi makes the bound safe; valid at any representable scale.
 */
export function primeIncrMargin(p1: Frac, p2: Frac): Frac {
  if (fCmp(p1, F_ZERO) < 0 || fCmp(p2, F_ONE) >= 0) {
    refuse(
      "CONVEXITY_PAIR_DOMAIN",
      "primeIncrMargin: pair outside [0,1) x [0,1)",
    );
  }
  if (fCmp(p1, p2) >= 0) {
    refuse(
      "CONVEXITY_PAIR_ORDER",
      "primeIncrMargin: p1 >= p2 — no increment to certify",
    );
  }
  return fDiv(fSub(p2, p1), fMul(fr(2), LN2.hi));
}

/**
 * The exact second-difference margin: net(p2) - 2 net(m) + net(p1) >=
 * (p2-p1)^2/(8 ln2) at m = (p1+p2)/2 — the k = 1 term p^2/(4 ln2) whose second
 * difference is exactly (p2-p1)^2/2, plus a nonnegative remainder (the binomial
 * identity on every even monomial — see evenMonomialSecondDiff).
 */
export function secondDiffMargin(p1: Frac, p2: Frac): Frac {
  if (fCmp(p1, F_ZERO) < 0 || fCmp(p2, F_ONE) >= 0) {
    refuse(
      "CONVEXITY_TRIPLE_DOMAIN",
      "secondDiffMargin: triple outside [0,1) x [0,1)",
    );
  }
  if (fCmp(p1, p2) >= 0) {
    refuse(
      "CONVEXITY_TRIPLE_ORDER",
      "secondDiffMargin: p1 >= p2 — no second difference to certify",
    );
  }
  const h = fDiv(fSub(p2, p1), fr(2));
  return fDiv(fMul(h, h), fMul(fr(2), LN2.hi));
}

/**
 * The binomial identity as an EXACT machine object: the second difference of
 * the even monomial t^{2k} at (m-h, m, m+h), evaluated two ways —
 * (a) directly on the common denominator (m.d*m.h... cleared to integers),
 * (b) by the closed form 2 sum_j C(2k,2j) m^{2k-2j} h^{2j}.
 * Returns both, plus the >= 2 h^{2k} lower bound (the j = k term alone).
 */
export interface MonomialDD {
  readonly direct: Frac;
  readonly binomial: Frac;
  readonly floor: Frac; // 2 h^{2k}
  readonly identityHolds: boolean;
  readonly atLeastFloor: boolean;
}

export function evenMonomialSecondDiff(
  m: Frac,
  h: Frac,
  k: number,
): MonomialDD {
  if (fCmp(h, F_ZERO) <= 0) {
    refuse(
      "CONVEXITY_MONOMIAL_H",
      "evenMonomialSecondDiff: h must be strictly positive",
    );
  }
  if (fCmp(m, F_ZERO) < 0) {
    refuse(
      "CONVEXITY_MONOMIAL_M",
      "evenMonomialSecondDiff: m must be nonnegative",
    );
  }
  if (!Number.isInteger(k) || k < 1 || k > 12) {
    refuse(
      "CONVEXITY_MONOMIAL_K",
      "evenMonomialSecondDiff: k must be an integer in 1..12 (witness range)",
    );
  }
  const e = 2 * k;
  // clear denominators: work with M = m.n * h.d, H = h.n * m.d over D = (m.d h.d)^e
  const md = m.d;
  const hd = h.d;
  const M = m.n * hd;
  const H = h.n * md;
  const D = (md * hd) ** BigInt(e);
  const directN =
    (M + H) ** BigInt(e) + (M - H) ** BigInt(e) - 2n * M ** BigInt(e);
  let binomialN = 0n;
  const C = (n: number, r: number): bigint => {
    let c = 1n;
    for (let i = 0; i < r; i++) c = (c * BigInt(n - i)) / BigInt(i + 1);
    return c;
  };
  for (let j = 1; j <= k; j++)
    binomialN += 2n * C(e, 2 * j) * M ** BigInt(e - 2 * j) * H ** BigInt(2 * j);
  const floorN = 2n * H ** BigInt(e);
  const direct: Frac = { n: directN, d: D };
  const binomial: Frac = { n: binomialN, d: D };
  const floor: Frac = { n: floorN, d: D };
  return {
    direct,
    binomial,
    floor,
    identityHolds: directN === binomialN,
    atLeastFloor: directN >= floorN,
  };
}

// --- the anti-inflation gates (data rules the margins) -------------------------------------------

/**
 * A claimed net' increment bound must not exceed the series enclosures' upper
 * bound on the true increment: m <= prime(p2).hi - prime(p1).lo.
 */
export function primeMarginUnderData(m: Frac, p1: Frac, p2: Frac): boolean {
  const upper = fSub(netPrimeSeriesIvl(p2).hi, netPrimeSeriesIvl(p1).lo);
  return fCmp(m, upper) <= 0;
}

/**
 * A claimed second-difference bound must not exceed the enclosures' upper
 * bound on the true second difference (cross-path: power hi at the endpoints,
 * closed lo at the midpoint): m <= net(p2).hi - 2 net(m).lo + net(p1).hi.
 */
export function secondDiffMarginUnderData(
  m: Frac,
  p1: Frac,
  p2: Frac,
): boolean {
  const mid = fDiv(fAdd(p1, p2), fr(2));
  const upper = fSub(
    fAdd(netPowerIvl(p2).hi, netPowerIvl(p1).hi),
    fMul(netClosedIvl(mid).lo, fr(2)),
  );
  return fCmp(m, upper) <= 0;
}

// --- the certificate assembly --------------------------------------------------------------------

/** v0.6.0 — the theorem's quoted floors. Margins are truncated DOWN (the
 * witnesses assert cert >= quote); widths are ceilings (assert value <= quote). */
export const QUOTED_MIN_PRIME_MARGIN = "0.036067"; // floor of the min prime margin over the 19 cells
export const QUOTED_MIN_DD_MARGIN = "0.001803"; // floor of the min second-difference margin over the 19 grid triples
export const QUOTED_MAX_PRIME_WIDTH = "2e-21"; // ceiling on the derivative series' widest enclosure

export interface PrimeCellCert {
  readonly p1: Frac;
  readonly p2: Frac;
  readonly margin: Frac;
  readonly marginOk: boolean;
}

export interface DDTripleCert {
  readonly p1: Frac;
  readonly pm: Frac;
  readonly p2: Frac;
  readonly margin: Frac;
  readonly marginOk: boolean;
  /** the enclosures' own second difference dominates the theorem margin (data agreement) */
  readonly dominatesEnclosure: boolean;
}

export interface ConvexityCert {
  readonly ok: boolean;
  readonly primeCells: readonly PrimeCellCert[];
  readonly ddTriples: readonly DDTripleCert[];
  readonly minPrimeMargin: Frac;
  readonly minDDMargin: Frac;
  /** the adversarial close pair (1/3, 1/3 + 1e-12): prime margin strictly positive */
  readonly closePairMargin: Frac;
  /** the tiny triple (0, 1e-12): second-difference margin strictly positive */
  readonly tinyTripleMargin: Frac;
  /** derivative series vs the T7 citation formula at every shared grid point */
  readonly primeCitationOverlap: boolean;
  /** the series' widest enclosure — its own honesty number */
  readonly maxPrimeWidth: Frac;
  /** net'' = sum p^{2j}/(2 ln2) vs 1/(2 ln2 (1-p^2)) at samples — data */
  readonly secondSeriesOverlap: boolean;
}

/** The convexity certificate, memoized (pure and expensive). */
let convexCache: ConvexityCert | null = null;

export function certifyGlobalConvexity(): ConvexityCert {
  convexCache ??= computeConvexity();
  return convexCache;
}

function computeConvexity(): ConvexityCert {
  const pts = monoGridPoints(); // 0, 1/20, ..., 1

  // theorem half, leg 1: net' increasing on the 19 cells
  const primeCells: PrimeCellCert[] = [];
  let minPrimeMargin: Frac | null = null;
  let primeGatesOk = true;
  for (let i = 0; i + 1 <= MONO_GRID_N - 1; i++) {
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const margin = primeIncrMargin(p1, p2);
    const marginOk = primeMarginUnderData(margin, p1, p2);
    if (!marginOk) primeGatesOk = false;
    if (minPrimeMargin === null || fCmp(margin, minPrimeMargin) < 0)
      minPrimeMargin = margin;
    primeCells.push({ p1, p2, margin, marginOk });
  }

  // theorem half, leg 2: net strictly convex on the interior grid triples
  // (i, i+1, i+2) with i+2 <= 19 — the terminal triple (18/20, 19/20, 1) is
  // refused here BY POWER-PATH DOMAIN: the anti-inflation gate reads
  // netPowerIvl(p2), which honestly excludes p = 1 (the series diverges
  // there); the anchor side of that triple is already v0.4.0's closed-path
  // anchor face. The certificate claims the interior, and says so.
  const ddTriples: DDTripleCert[] = [];
  let minDDMargin: Frac | null = null;
  let ddGatesOk = true;
  for (let i = 0; i + 2 <= MONO_GRID_N - 1; i++) {
    const p1 = pts[i]!;
    const pm = pts[i + 1]!;
    const p2 = pts[i + 2]!;
    const margin = secondDiffMargin(p1, p2);
    const marginOk = secondDiffMarginUnderData(margin, p1, p2);
    if (!marginOk) ddGatesOk = false;
    const dd = iSub(
      iAdd(netClosedIvl(p1), netClosedIvl(p2)),
      iAdd(netClosedIvl(pm), netClosedIvl(pm)),
    );
    const dominatesEnclosure = fCmp(dd.lo, margin) >= 0;
    if (!dominatesEnclosure) ddGatesOk = false;
    if (minDDMargin === null || fCmp(margin, minDDMargin) < 0)
      minDDMargin = margin;
    ddTriples.push({ p1, pm, p2, margin, marginOk, dominatesEnclosure });
  }

  // adversarial scales: a pair no grid could separate, a triple at the origin
  const closePair = primeIncrMargin(fr(1, 3), fAdd(fr(1, 3), frDec("1e-12")));
  const tinyTriple = secondDiffMargin(F_ZERO, frDec("1e-12"));

  // citation cross: the series vs net'(p) = log2((1+p)/(1-p))/4 = -ln((1-p)/(1+p))/(4 ln2)
  let primeCitationOverlap = true;
  let maxPrimeWidth = F_ZERO;
  for (const p of pts) {
    if (fCmp(p, F_ZERO) === 0 || fCmp(p, F_ONE) === 0) continue;
    const series = netPrimeSeriesIvl(p);
    const w = iWidth(series);
    if (fCmp(w, maxPrimeWidth) > 0) maxPrimeWidth = w;
    const ratio = fDiv(fSub(F_ONE, p), fAdd(F_ONE, p));
    const citation = iDivPos(negLn(ratio), iScaleNonneg(LN2, fr(4)));
    if (!iOverlap(series, citation)) primeCitationOverlap = false;
  }

  // citation cross, second order: sum p^{2j}/(2 ln2) vs 1/(2 ln2 (1-p^2))
  let secondSeriesOverlap = true;
  for (const p of [fr(1, 4), fr(1, 2), fr(7, 10)]) {
    let s = F_ZERO;
    let pj = F_ONE;
    for (let j = 0; j < 64; j++) {
      s = fAdd(s, pj);
      pj = fMul(pj, fMul(p, p));
    }
    const tail = fDiv(pj, fSub(F_ONE, fMul(p, p)));
    const series = iDivPos(ivl(s, fAdd(s, tail)), iScaleNonneg(LN2, fr(2)));
    const citation = iDivPos(
      { lo: F_ONE, hi: F_ONE },
      iScaleNonneg(LN2, fMul(fr(2), fSub(F_ONE, fMul(p, p)))),
    );
    if (!iOverlap(series, citation)) secondSeriesOverlap = false;
  }

  const minPrime = minPrimeMargin ?? F_ZERO;
  const minDD = minDDMargin ?? F_ZERO;
  return {
    ok:
      primeGatesOk &&
      ddGatesOk &&
      fCmp(minPrime, frDec(QUOTED_MIN_PRIME_MARGIN)) >= 0 &&
      fCmp(minDD, frDec(QUOTED_MIN_DD_MARGIN)) >= 0 &&
      fCmp(closePair, F_ZERO) > 0 &&
      fCmp(tinyTriple, F_ZERO) > 0 &&
      primeCitationOverlap &&
      secondSeriesOverlap &&
      fCmp(maxPrimeWidth, frDec(QUOTED_MAX_PRIME_WIDTH)) <= 0,
    primeCells,
    ddTriples,
    minPrimeMargin: minPrime,
    minDDMargin: minDD,
    closePairMargin: closePair,
    tinyTripleMargin: tinyTriple,
    primeCitationOverlap,
    maxPrimeWidth,
    secondSeriesOverlap,
  };
}
