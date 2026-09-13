/**
 * The global monotonicity certificate — v0.4.0's gap-free face.
 *
 * T6's theorem lives on the grid family p = i/20: twenty adjacent pairs,
 * twenty exact gaps. Between the grid points the curve carried no
 * certificate — monotone "on the lattice" is not monotone on (0,1). This
 * module closes the gaps with a certificate that needs no lattice:
 *
 * THEOREM (machine, exact): substitute d = 1 - 2q = p in the T5/T8 series
 * and the withdrawal curve becomes an all-positive-coefficient power series
 *     net(p) = sum_{k>=1} p^{2k} / (4 ln2 k(2k-1)),
 * so for every rational pair 0 <= p1 < p2 < 1,
 *     net(p2) - net(p1) >= (p2^2 - p1^2)/(4 ln2) > 0
 * — the k = 1 term plus a nonnegative remainder: pure BigInt rational
 * algebra, valid at any scale the rationals can name (the trial certifies
 * the pair (0, 10^-12), whose margin no grid of doubles could resolve).
 *
 * CITATION (classical analysis, consistency only — the same split as T7):
 * net'(p) = log2((1-q)/q)/4 evaluated per subinterval with the kernel's own
 * negLn/LN2/iDivPos machinery. A subinterval queue with adaptive bisection
 * (bisect on a nonpositive lower bound, convict at depth exhaustion)
 * certifies net' > 0 on the seeded cells GIVEN net' nondecreasing (T7's
 * convexity citation face); each derivative bound times cell width must
 * stay under the enclosures' upper bound on the increment — the data gate.
 *
 * The power-series leg is the series path re-indexed in p (exact algebra,
 * d = p — NOT a third independent derivation); what it adds is structural:
 * the positive-coefficient form in p is what the margin algebra reads, and
 * it is cross-checked as data against the closed path at every shared
 * point. p = 1 stays the closed path's exact anchor (the series in p
 * diverges there, 1 - p^2 in the tail denominator — the honest exclusion).
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
  iDivPos,
  iOverlap,
  iScaleNonneg,
  ivl,
  iWidth,
  negLn,
  LN2,
} from "./rational.js";
import { refuse } from "../core/errors.js";
import { MONO_GRID_N, monoGridPoints, netClosedIvl, netSeriesIvl } from "./theorem.js";

/** v0.4.0 — the gap-free certificate's quoted floors/ceilings. The witnesses
 * re-derive every number from exact BigInt rationals, never from these
 * strings. Margin/gap quotes are truncated DOWN (witness asserts
 * cert >= quote); the width quote is a ceiling (witness asserts value <= quote). */
export const QUOTED_GLOBAL_MIN_MARGIN = "0.000901"; // floor of the min algebraic pair margin over the 19 cells
export const QUOTED_GLOBAL_MIN_POWER_GAP = "0.000902"; // floor of the min raw third-path gap (pairs 0 -> 19/20)
export const QUOTED_GLOBAL_ANCHOR_GAP = "0.0843"; // floor of the (19/20 -> 1) closed-path anchor gap
export const QUOTED_GLOBAL_MAX_POWER_WIDTH = "1e-21"; // ceiling on the power path's widest enclosure (LN2-budget-dominated, like both existing paths)

const POWER_TERMS = 512; // same budget as the h2 series path: tail < 1e-30 for p <= 19/20

/**
 * net(p) as the all-positive-coefficient power series in p:
 * net(p) = sum_{k>=1} p^{2k}/(4 ln2 k(2k-1)). Partial sum exact by the same
 * integer layout the h2 series path uses (common denominator B^K * C, limbs
 * linear in K); tail obeys
 *   sum_{k>K} u^k/(k(2k-1)) <= u^{K+1}/((K+1)(2K+1)(1-u)),  u = p^2.
 * p = 0 returns [0,0] exact (every term is 0); p >= 1 is refused — the tail
 * diverges at p = 1 (1 - u = 0), the honest exclusion of the series family.
 */
export function netPowerIvl(p: Frac): Ivl {
  if (fCmp(p, F_ZERO) < 0 || fCmp(p, F_ONE) >= 0) {
    refuse("GLOBAL_NETPOWER_DOMAIN", "netPowerIvl: p outside [0,1)");
  }
  const u = fMul(p, p); // p^2 in [0,1)
  const K = POWER_TERMS;
  const N = u.n;
  const B = u.d;
  const c: bigint[] = new Array<bigint>(K + 1);
  for (let k = 1; k <= K; k++) c[k] = BigInt(k * (2 * k - 1));
  const prefix: bigint[] = new Array<bigint>(K + 2).fill(1n); // prefix[k] = c_1..c_{k-1}
  for (let k = 1; k <= K; k++) prefix[k + 1] = prefix[k]! * c[k]!;
  const suffix: bigint[] = new Array<bigint>(K + 2).fill(1n); // suffix[k] = c_{k+1}..c_K
  for (let k = K; k >= 1; k--) suffix[k] = suffix[k + 1]! * c[k]!;
  const C = prefix[K + 1]!;
  let num = 0n;
  let powN = 1n; // N^{k-1} entering iteration k
  let powB = B ** BigInt(K); // B^{K-k+1} entering iteration k
  for (let k = 1; k <= K; k++) {
    powN *= N; // now exactly N^k
    powB /= B; // now exactly B^{K-k}
    num += powN * powB * (prefix[k]! * suffix[k + 1]!); // N^k B^{K-k} (C/c_k)
  }
  const psum: Frac = { n: num, d: B ** BigInt(K) * C }; // exact: sum_{k<=K} u^k/(k(2k-1))
  let uk = u;
  for (let k = 1; k <= K; k++) uk = fMul(uk, u);
  // tail <= u^{K+1}/((K+1)(2K+1)(1-u)) — uk is now u^{K+1}; u < 1 strictly
  const tail = fDiv(uk, fMul(fr((POWER_TERMS + 1) * (2 * (POWER_TERMS + 1) - 1)), fSub(F_ONE, u)));
  return iDivPos(ivl(psum, fAdd(psum, tail)), iScaleNonneg(LN2, fr(4)));
}

// --- the pair-increment lemma (the theorem half) ----------------------------------------------

/**
 * The exact algebraic margin: net(p2) - net(p1) >= (p2^2 - p1^2)/(4 ln2_hi)
 * for 0 <= p1 < p2 < 1 — the k = 1 series term plus a nonnegative
 * remainder. ln2 <= ln2_hi makes the bound safe; every operand is an exact
 * BigInt rational, so the margin is certified at any representable scale.
 */
export function incrMargin(p1: Frac, p2: Frac): Frac {
  if (fCmp(p1, F_ZERO) < 0 || fCmp(p2, F_ONE) >= 0) {
    refuse("GLOBAL_PAIR_DOMAIN", "incrMargin: pair outside [0,1) x [0,1)");
  }
  if (fCmp(p1, p2) >= 0) {
    refuse("GLOBAL_PAIR_ORDER", "incrMargin: p1 >= p2 — no increment to certify");
  }
  return fDiv(fSub(fMul(p2, p2), fMul(p1, p1)), fMul(fr(4), LN2.hi));
}

/**
 * The anti-inflation gate: a claimed lower bound m on net(p2) - net(p1)
 * must not exceed what the enclosures admit,
 *   m <= netPowerIvl(p2).hi - netClosedIvl(p1).lo,
 * an UPPER bound on the true increment built cross-path (power hi vs closed
 * lo — two independent enclosures). The true margins pass everywhere; an
 * inflated forgery contradicts the data and is named here.
 */
export function marginUnderData(m: Frac, p1: Frac, p2: Frac): boolean {
  const upper = fSub(netPowerIvl(p2).hi, netClosedIvl(p1).lo);
  return fCmp(m, upper) <= 0;
}

// --- the citation half: net' cell bounds via negLn/LN2/iDivPos ----------------------------------

/**
 * net'(p) lower bound over the cell [a, b]: the T7 citation formula
 * net'(p) = log2((1-q)/q)/4 = -ln((1-a)/(1+a))/(4 ln2) at the LEFT
 * endpoint — valid over the whole cell GIVEN net' nondecreasing (T7's
 * convexity citation face, data-verified on the grid). Pure kernel
 * machinery: negLn's series enclosure, LN2's enclosure, iDivPos.
 */
export function netPrimeCellLower(a: Frac, b: Frac): Frac {
  if (fCmp(a, F_ZERO) <= 0 || fCmp(b, F_ONE) > 0 || fCmp(a, b) >= 0) {
    refuse("GLOBAL_NETPRIME_DOMAIN", "netPrimeCellLower: cell not inside (0,1]");
  }
  const r = fDiv(fSub(F_ONE, a), fAdd(F_ONE, a)); // (1-a)/(1+a) in (0,1) for 0 < a < 1
  return iDivPos(negLn(r), iScaleNonneg(LN2, fr(4))).lo;
}

// --- the adaptive bisection machinery (generic — shared with the smuggling trials) --------------

export interface Cell {
  readonly a: Frac;
  readonly b: Frac;
}

/** A claimed lower bound of net' over the cell [a, b] — the machinery is
 * generic so the smuggling trials can feed it counterfeits. */
export type CellBoundFn = (a: Frac, b: Frac) => Frac;

export interface ConvictedCell {
  readonly seed: number; // which seed cell the convicted cell descends from
  readonly a: Frac;
  readonly b: Frac;
  readonly depth: number; // bisections from the seed — the forger's runway
  readonly bound: Frac; // the nonpositive bound that named it
}

export interface DerivSubdivisionResult {
  readonly ok: boolean;
  readonly certified: number; // cells carrying a strictly positive bound
  readonly maxDepthUsed: number;
  readonly convicted: ConvictedCell | null; // non-null iff !ok — the named failure
}

/**
 * Subinterval queue with adaptive bisection: a cell is certified when its
 * bound is strictly positive; a failing cell is bisected while depth
 * remains; depth exhaustion CONVICTS with the named cell and the forger's
 * runway. On the true curve the left-endpoint bound certifies every seeded
 * cell at depth 0 (net' is positive on any [a,b] with a > 0) — the
 * bisection is armed for liars and coarse-but-honest bounds, and the
 * trials exercise both directions.
 */
export function certifyDerivSubdivision(
  bound: CellBoundFn,
  seeds: readonly Cell[],
  maxDepth: number,
): DerivSubdivisionResult {
  if (seeds.length === 0) {
    refuse("GLOBAL_EMPTY_SEEDS", "certifyDerivSubdivision: no seed cells — a certificate of nothing certifies nothing");
  }
  let certified = 0;
  let maxDepthUsed = 0;
  const queue: Array<{ a: Frac; b: Frac; depth: number; seed: number }> = seeds.map((c, i) => ({
    a: c.a,
    b: c.b,
    depth: 0,
    seed: i,
  }));
  while (queue.length > 0) {
    const c = queue.shift()!;
    const lb = bound(c.a, c.b);
    if (fCmp(lb, F_ZERO) > 0) {
      certified++;
      if (c.depth > maxDepthUsed) maxDepthUsed = c.depth;
      continue;
    }
    if (c.depth >= maxDepth) {
      return { ok: false, certified, maxDepthUsed, convicted: { seed: c.seed, a: c.a, b: c.b, depth: c.depth, bound: lb } };
    }
    const mid = fDiv(fAdd(c.a, c.b), fr(2));
    queue.push({ a: c.a, b: mid, depth: c.depth + 1, seed: c.seed }, { a: mid, b: c.b, depth: c.depth + 1, seed: c.seed });
  }
  return { ok: true, certified, maxDepthUsed, convicted: null };
}

// --- the global certificate ---------------------------------------------------------------------

export interface GlobalCellCert {
  readonly a: Frac;
  readonly b: Frac;
  /** INCREMENT on the 0-touching cell (the citation machinery refuses r = 1 at a = 0); DERIVATIVE elsewhere */
  readonly leg: "INCREMENT" | "DERIVATIVE";
  /** the exact algebraic margin (b^2 - a^2)/(4 ln2_hi) — the theorem half, computed on EVERY cell */
  readonly margin: Frac;
  /** the margin stays under the enclosures' increment upper bound — the anti-inflation gate, run on the real margin */
  readonly marginOk: boolean;
}

export interface GlobalCert {
  readonly ok: boolean;
  /** the 19 cells partitioning [0,1) (the (19/20,1] anchor segment carries its own gap) */
  readonly cells: readonly GlobalCellCert[];
  /** min over cells of the exact algebraic margin — the gap-free certificate's floor */
  readonly minMargin: Frac;
  /** the adaptive queue over the 19 derivative seeds (cells [i/20,(i+1)/20], i = 1..19, b = 1 allowed) */
  readonly subdivision: DerivSubdivisionResult;
  /** every derivative bound x width <= the enclosures' upper bound on the increment — citation under data */
  readonly derivUnderData: boolean;
  /** the third path re-derives T6's grid gaps independently: power(hi_{i+1}).lo - power(hi_i).hi, i = 0..18 */
  readonly powerGaps: readonly Frac[];
  /** the (19/20 -> 1) anchor pair: net(1) = 1/2 exact on the closed path minus net(19/20).hi */
  readonly anchorPairGap: Frac;
  /** power vs closed AND power vs series enclosures overlap at every grid point below 1 */
  readonly threePathOverlap: boolean;
  /** widest enclosure on the power path — its own honesty number */
  readonly maxPowerWidth: Frac;
}

/** The gap-free certificate, memoized (pure and expensive). */
let globalCache: GlobalCert | null = null;

export function certifyGlobalMonotone(): GlobalCert {
  globalCache ??= computeGlobal();
  return globalCache;
}

const GLOBAL_MAX_DEPTH = 6;

function computeGlobal(): GlobalCert {
  const pts = monoGridPoints(); // 0, 1/20, ..., 1
  const g = fr(1, MONO_GRID_N);

  // theorem half: the 19 cells of [0,1), margins exact, anti-inflation on each
  const cells: GlobalCellCert[] = [];
  let minMargin: Frac | null = null;
  let marginsAllOk = true;
  for (let i = 0; i + 1 <= MONO_GRID_N - 1; i++) {
    const a = fMul(fr(i), g);
    const b = fMul(fr(i + 1), g);
    const margin = incrMargin(a, b);
    const marginOk = marginUnderData(margin, a, b);
    if (!marginOk) marginsAllOk = false;
    if (minMargin === null || fCmp(margin, minMargin) < 0) minMargin = margin;
    cells.push({ a, b, leg: i === 0 ? "INCREMENT" : "DERIVATIVE", margin, marginOk });
  }

  // citation half: the 19 derivative seeds (the last reaches b = 1) through
  // the adaptive queue
  const seeds: Cell[] = [];
  for (let i = 1; i <= MONO_GRID_N - 1; i++) seeds.push({ a: fMul(fr(i), g), b: fMul(fr(i + 1), g) });
  const subdivision = certifyDerivSubdivision(netPrimeCellLower, seeds, GLOBAL_MAX_DEPTH);

  // citation under data: each seed's derivative bound x width must not
  // exceed the enclosures' upper bound on the increment (power hi vs closed
  // lo; the b = 1 seed uses the closed path's exact 1/2 anchor)
  let derivUnderData = true;
  for (const s of seeds) {
    const width = fSub(s.b, s.a);
    const upper = fSub(netClosedIvl(s.b).hi, netClosedIvl(s.a).lo);
    if (fCmp(fMul(netPrimeCellLower(s.a, s.b), width), upper) > 0) derivUnderData = false;
  }

  // the third path's raw grid gaps (T6 re-derived below the 1 anchor) and
  // the three-path overlap + width honesty
  const interior = pts.filter((p) => fCmp(p, F_ONE) !== 0); // 0 .. 19/20
  const powerVals = interior.map(netPowerIvl);
  const closedVals = interior.map(netClosedIvl);
  const seriesVals = interior.map(netSeriesIvl);
  const powerGaps: Frac[] = [];
  for (let i = 0; i + 1 < powerVals.length; i++) {
    powerGaps.push(fSub(powerVals[i + 1]!.lo, powerVals[i]!.hi));
  }
  let powerGapsAllPositive = true;
  for (const gap of powerGaps) {
    if (fCmp(gap, F_ZERO) <= 0) powerGapsAllPositive = false;
  }
  let threePathOverlap = true;
  let maxPowerWidth = F_ZERO;
  for (let i = 0; i < powerVals.length; i++) {
    if (!iOverlap(powerVals[i]!, closedVals[i]!) || !iOverlap(powerVals[i]!, seriesVals[i]!)) threePathOverlap = false;
    const w = iWidth(powerVals[i]!);
    if (fCmp(w, maxPowerWidth) > 0) maxPowerWidth = w;
  }

  const anchorPairGap = fSub(netClosedIvl(F_ONE).lo, netClosedIvl(fMul(fr(MONO_GRID_N - 1), g)).hi);

  return {
    ok:
      subdivision.ok &&
      marginsAllOk &&
      fCmp(minMargin ?? F_ZERO, F_ZERO) > 0 &&
      powerGapsAllPositive &&
      fCmp(anchorPairGap, F_ZERO) > 0 &&
      threePathOverlap &&
      derivUnderData,
    cells,
    minMargin: minMargin ?? F_ZERO,
    subdivision,
    derivUnderData,
    powerGaps,
    anchorPairGap,
    threePathOverlap,
    maxPowerWidth,
  };
}

