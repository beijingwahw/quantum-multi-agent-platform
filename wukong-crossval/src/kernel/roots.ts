/**
 * The readout-fit root census (X8's disclosed boundary, fully mapped) —
 * v0.4.0's closing theorem for the fit's non-uniqueness.
 *
 * Claim (exact): the observed hit rate under symmetric flips is a degree-
 * <=n polynomial in lambda = 1 - 2f,
 *     r(lambda) = 2^-n sum_d mass(d) (1-lambda)^d (1+lambda)^{n-d},
 * the same Walsh-character filtering law the shell kernel already obeys
 * (f = 0 -> |psi_opt|^2, f = 1/2 -> 2^-n). So the fit equation r(f) =
 * target has finitely many roots, and the "spurious global second root
 * near f ~ 0.368" that the local bracket works around is not numerical
 * noise — it is a theorem-predicted root of an exact polynomial.
 *
 * The census maps the non-uniqueness with two independent paths joined by
 * certificates. LOCATE: sign flips of g = r - target on a dense grid, each
 * flip bisected to a floating-point-tight bracket (width far below 1e-9).
 * CERTIFY: on each flipping grid pair the Bernstein form of g has exactly
 * one sign change — by variation diminishment the pair holds EXACTLY one
 * root, so every enrolled root is a certified simple root, not a located
 * guess. COMPLETE: the Bernstein sign-change count over the whole interval
 * is an upper bound on every root in (0,1) counted with multiplicity; if
 * it exceeds the flip count, roots are hiding as even-multiplicity
 * tangencies or sub-grid pairs, and the census bisects the certificate down
 * to the grid segment carrying the excess and DISCLOSES it — a hidden root
 * is reported as hidden, never ignored, never invented.
 *
 * Boundary: roots exactly at f = 0 or f = 1/2 are disclosed, not enrolled
 * (the open interval is the honest fit domain); an identically-constant
 * rate (uniform state) makes every f a root and is rejected by name — a
 * census of infinitely many roots is a degeneracy, not a fit.
 */
import { choose, exactObservedHitRate } from "./robust.js";
import { XvalError } from "./error.js";

/** root isolation width bound (in lambda units) */
export const ROOT_WIDTH = 1e-9;
/** dense grid for locating sign flips (the first path) */
const GRID = 8193;
/** bisection depth per flip (bracket tightens to floating-point resolution) */
const BISECT_STEPS = 100;
/** endpoint tolerance for boundary-root detection at lambda = 0 / 1 */
export const ROOT_EVAL_TOL = 1e-12;
/** mid-point residual band: |r(f*) - target| at an enrolled root's center
 * (the certificate is the Bernstein sign change + the bracket, not this) */
export const ROOT_MID_BAND = 1e-8;

/** The exact power coefficients of r in lambda = 1 - 2f on [0,1]. */
export function readoutRatePoly(masses: Float64Array): number[] {
  if (masses.length < 1) {
    throw new XvalError("XVAL_MASSES_SHAPE", `readoutRatePoly: the Hamming-distance mass vector must carry n+1 >= 1 entries, got ${String(masses.length)}`);
  }
  const n = masses.length - 1;
  const a = new Array<number>(n + 1).fill(0);
  for (let d = 0; d <= n; d++) {
    const m = masses[d]!;
    if (m === 0) continue;
    for (let i = 0; i <= d; i++) {
      const ci = choose(d, i) * (i % 2 === 0 ? 1 : -1); // (1-lambda)^d term
      for (let j = 0; j <= n - d; j++) a[i + j]! += m * ci * choose(n - d, j); // (1+lambda)^{n-d} term
    }
  }
  for (let k = 0; k <= n; k++) a[k]! /= 2 ** n;
  return a;
}

/** Power-to-Bernstein basis conversion: lambda^m = sum_{k>=m}
 * (C(k,m)/C(n,m)) B_{k,n}(lambda), so c_k = sum_{m<=k} a_m C(k,m)/C(n,m). */
export function powerToBernstein(a: readonly number[]): number[] {
  const n = a.length - 1;
  const c = new Array<number>(n + 1).fill(0);
  for (let k = 0; k <= n; k++) {
    let s = 0;
    for (let m = 0; m <= k; m++) s += a[m]! * (choose(k, m) / choose(n, m));
    c[k] = s;
  }
  return c;
}

/** Horner evaluation of the power-coefficient polynomial at x. */
function evalPower(a: readonly number[], x: number): number {
  let v = 0;
  for (let k = a.length - 1; k >= 0; k--) v = v * x + a[k]!;
  return v;
}

/** Sign changes among coefficients, |x| <= tol skipped. */
function signChanges(c: readonly number[], tol: number): number {
  let v = 0;
  let sign = 0;
  for (const x of c) {
    if (Math.abs(x) <= tol) continue;
    const s = x > 0 ? 1 : -1;
    if (sign !== 0 && s !== sign) v++;
    sign = s;
  }
  return v;
}

/** Bernstein coefficients of g on the subinterval [lo, hi] of [0,1]:
 * substitute lambda = lo + (hi-lo) t in the power form (exact powers
 * precomputed), convert to the Bernstein basis in t. */
function bernsteinOn(a: readonly number[], lo: number, hi: number): number[] {
  const n = a.length - 1;
  const powLo = [1];
  const powS = [1];
  for (let i = 1; i <= n; i++) {
    powLo.push(powLo[i - 1]! * lo);
    powS.push(powS[i - 1]! * (hi - lo));
  }
  const d = new Array<number>(n + 1).fill(0);
  for (let m = 0; m <= n; m++) for (let k = 0; k <= m; k++) d[k]! += a[m]! * choose(m, k) * powLo[m - k]! * powS[k]!;
  return powerToBernstein(d);
}

export interface IsolatedRoot {
  /** the root's floating-point-tight bracket in lambda = 1 - 2f */
  readonly lambdaLow: number;
  readonly lambdaHigh: number;
  /** the same bracket in flip units, f = (1 - lambda)/2 (order reversed) */
  readonly fLow: number;
  readonly fHi: number;
  readonly fMid: number;
  readonly width: number;
  /** the grid pair containing this root carries exactly ONE Bernstein sign
   * change — variation diminishment certifies exactly one root inside */
  readonly certified: boolean;
}

export interface HiddenRoots {
  /** the grid segment where the certificate exposes more multiplicity than
   * the sign flips show (tangency roots / sub-grid pairs) */
  readonly lambdaLow: number;
  readonly lambdaHigh: number;
  readonly excess: number;
}

export interface RootCensus {
  readonly target: number;
  readonly n: number;
  /** every certified simple root of r(f) = target in the OPEN (0, 1/2),
   * each bracketed to width <= 1e-9 */
  readonly roots: readonly IsolatedRoot[];
  readonly rootCount: number;
  /** Bernstein sign-change count over [0,1] — an upper bound on ALL roots
   * in the interval counted with multiplicity (the completeness face) */
  readonly bernsteinTotal: number;
  /** the dense-grid sign-flip count (the locating path) */
  readonly signFlipTotal: number;
  /** the two paths agree: no multiplicity hides beyond the flip roots */
  readonly twoPathsAgree: boolean;
  /** multiplicity the certificate exposes but no flip shows, located to its
   * grid segment and disclosed as hidden */
  readonly hiddenRoots: readonly HiddenRoots[];
  /** roots exactly at f = 0 (lambda = 1) or f = 1/2 (lambda = 0), disclosed */
  readonly boundaryRoots: readonly string[];
}

/** The complete root census of r(f) = target over the open (0, 1/2). */
export function rootCensus(masses: Float64Array, target: number): RootCensus {
  const n = masses.length - 1;
  const a = readoutRatePoly(masses);
  let nonConst = 0;
  for (let k = 1; k <= n; k++) nonConst = Math.max(nonConst, Math.abs(a[k]!));
  if (nonConst <= 1e-15 && Math.abs(a[0]! - target) <= 1e-15) {
    throw new XvalError("XVAL_ROOTS_DEGENERATE", `rootCensus: the rate is identically ${String(a[0])} on the whole flip axis (uniform-state masses) — every f solves r(f) = ${String(target)}, a census of infinitely many roots is a degeneracy, not a fit; rejected by name`);
  }
  const scale = Math.max(1e-300, ...a.map(Math.abs));
  const tol = scale * 1e-12; // relative sign tolerance: the noise floor of the conversion
  const g = (x: number): number => evalPower(a, x) - target;
  // path 1 — locate: dense-grid sign flips, each bisected to a tight bracket
  const roots: IsolatedRoot[] = [];
  const flips: Array<[number, number]> = [];
  let prev = g(0);
  for (let j = 1; j <= GRID; j++) {
    const x = j / GRID;
    const fx = g(x);
    if (prev !== 0 && Math.sign(prev) !== Math.sign(fx)) flips.push([(j - 1) / GRID, x]);
    prev = fx;
  }
  for (const [x0, x1] of flips) {
    let lo = x0;
    let hi = x1;
    let flo = g(lo);
    for (let it = 0; it < BISECT_STEPS; it++) {
      const mid = (lo + hi) / 2;
      const fm = g(mid);
      if (Math.sign(fm) === Math.sign(flo)) {
        lo = mid;
        flo = fm;
      } else {
        hi = mid;
      }
    }
    const lambdaMid = (lo + hi) / 2;
    // certify: exactly one Bernstein sign change over the flipping grid pair
    const certified = signChanges(bernsteinOn(a, x0, x1).map((c) => c - target), tol) === 1;
    roots.push({ lambdaLow: lo, lambdaHigh: hi, fLow: (1 - hi) / 2, fHi: (1 - lo) / 2, fMid: (1 - lambdaMid) / 2, width: hi - lo, certified });
  }
  // path 2 — complete: the whole-interval Bernstein sign changes bound ALL
  // roots (with multiplicity); any excess over the flips is hidden structure
  const bernsteinTotal = signChanges(powerToBernstein(a).map((c) => c - target), tol);
  const hidden: HiddenRoots[] = [];
  if (bernsteinTotal > flips.length) {
    // bisect the certificate onto grid segments until the excess is located
    const locate = (j0: number, j1: number, coef: readonly number[]): void => {
      const v = signChanges(coef, tol);
      const innerFlips = flips.filter(([x0, x1]) => x0 >= j0 / GRID - 1e-15 && x1 <= j1 / GRID + 1e-15).length;
      if (v <= innerFlips) return; // consistent: no hidden multiplicity here
      if (j1 - j0 <= 1) {
        hidden.push({ lambdaLow: j0 / GRID, lambdaHigh: j1 / GRID, excess: v - innerFlips });
        return;
      }
      const jm = (j0 + j1) >> 1;
      locate(j0, jm, bernsteinOn(a, j0 / GRID, jm / GRID).map((c) => c - target));
      locate(jm, j1, bernsteinOn(a, jm / GRID, j1 / GRID).map((c) => c - target));
    };
    locate(0, GRID, powerToBernstein(a).map((c) => c - target));
  }
  // boundary roots (lambda = 1 -> f = 0, lambda = 0 -> f = 1/2): disclosed, not enrolled
  const boundaryRoots: string[] = [];
  if (Math.abs(g(1)) <= ROOT_EVAL_TOL) boundaryRoots.push("f=0");
  if (Math.abs(g(0)) <= ROOT_EVAL_TOL) boundaryRoots.push("f=1/2");
  return {
    target,
    n,
    roots,
    rootCount: roots.length,
    bernsteinTotal,
    signFlipTotal: flips.length,
    twoPathsAgree: bernsteinTotal === flips.length && roots.every((r) => r.certified),
    hiddenRoots: hidden,
    boundaryRoots,
  };
}

export interface FitRootCensusRow {
  readonly instanceId: string;
  readonly n: number;
  readonly depth: number;
  readonly flip: number;
  readonly target: number;
  readonly roots: readonly IsolatedRoot[];
  readonly rootCount: number;
  readonly twoPathsAgree: boolean;
  readonly hiddenRoots: readonly HiddenRoots[];
  readonly boundaryRoots: readonly string[];
  /** the stated operating point is itself an enrolled root of its own fit equation */
  readonly statedRootEnrolled: boolean;
}

/** The census row for one (probe, operating point): the fit equation
 * r(f) = r(flip) mapped completely over (0, 1/2). */
export function fitRootCensus(
  masses: Float64Array,
  meta: { instanceId: string; n: number; depth: number },
  flip: number,
): FitRootCensusRow {
  const target = exactObservedHitRate(masses, flip);
  const c = rootCensus(masses, target);
  return {
    instanceId: meta.instanceId,
    n: meta.n,
    depth: meta.depth,
    flip,
    target,
    roots: c.roots,
    rootCount: c.rootCount,
    twoPathsAgree: c.twoPathsAgree,
    hiddenRoots: c.hiddenRoots,
    boundaryRoots: c.boundaryRoots,
    statedRootEnrolled: c.roots.some((r) => Math.abs(r.fMid - flip) <= 1e-6),
  };
}
