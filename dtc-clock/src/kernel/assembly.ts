/**
 * The singular Euler–Maclaurin ASSEMBLY (TC44/TC45) — TC43's priced final
 * step, executed to the machine's arbitrament.
 *
 * OBJECTS. The share chain share = P·A·S/4 (TC42) with S(D) =
 * sum_k (1/k) C(D-1,k)^2/C(2D,2k+1), D = n/2. Write u(D) := S(D)·sqrt(D):
 * u = sqrt(pi)/2 + kappa/sqrt(D) + O(1/D). The EXACT transfer (TC44):
 *     sigma1(n) = G(n)·u(D) - sqrt(n),   G(n) = (2·sqrt(2)/9)·P(n)·A(n)
 * — an algebraic identity in the chain pieces (machine: float floor), so as
 * a limit identity sigma1 = 2·sqrt(2/pi)·kappa. The arc's third-order face
 * closes at theorem grade:
 *     c3(n) = -(n-2)·c2(n)/12 · (1 - 3·sigma1/sqrt(n) + O(1/n)).
 *
 * THE ASSEMBLY (TC45). kappa = zeta_m + Phi1 — an additive split:
 *   - zeta_m = sum_{k>=1} E_k - sqrt(2/pi), the edge-mass series' own
 *     generalized-zeta constant, with the EXACT per-k terms
 *       E_k = m_k - mu_k,  m_k = (2k+1)C(2k,k)/(2·4^k·k)   (exact rational),
 *       mu_k = (2/sqrt(pi))(sqrt(k+1/2) - sqrt(k-1/2))      (midpoint mass).
 *     The series is absolutely convergent with the exact next-order laws
 *       E_k·sqrt(pi)·k^{3/2} = 3/8 - 11/(128k) + O(k^-2),
 *     so sum(E) = (3/8)zeta(3/2)/sqrt(pi) - (11/128)(3/8)zeta(5/2)/sqrt(pi)
 *     + R with R an explicit convergent remainder — the structural reason
 *     TC43's zeta(1/2) lattices all failed: the constant is zeta(3/2)/
 *     zeta(5/2)-flavored, not zeta(1/2)-composite.
 *   - Phi1 = kappa - zeta_m: the cutoff face's subleading constant —
 *     v0.19.0 machine-measured -4.547e-4 "SMALL BUT NONZERO", CONVICTED at
 *     v0.20.0 as zetaEM's tail-sign artifact: the corrected Phi1 is
 *     machine-bracketed |Phi1| <= 5.58e-7 WITH ZERO INSIDE (TC47), its
 *     closed form stays open. The
 *     F-function F(k,D) := D·s_k/m_k = f(k/D)(1+o(1)) with f(0)=1 carries
 *     the face: its leading O(1) shift renormalizes 2/sqrt(pi) ->
 *     sqrt(pi)/2 (the arcsine law), its subleading constant is Phi1.
 */

import {
  richardsonLimit,
  secondOrderGeneral,
  shareChainPieces,
  sigmaFirst,
  sigmaFirstIncremental,
  thirdOrderClosed,
} from "./armor.js";

// ---------------------------------------------------------------------------
// TC44: the exact transfer and the S-face constant
// ---------------------------------------------------------------------------

/** u(D) = S(D)·sqrt(D) — the scaled mode sum. */
export function scaledModeSum(d: number): number {
  return shareChainPieces(2 * d).S * Math.sqrt(d);
}

/** kappa(D) = (u(D) - sqrt(pi)/2)·sqrt(D) — converges to kappa at
 * O(1/sqrt(D)) (mixed with slower log-free faces; the transfer is the
 * precise route to kappa, this grid is the road's own witness). */
export function kappaFace(d: number): number {
  return (scaledModeSum(d) - Math.sqrt(Math.PI) / 2) * Math.sqrt(d);
}

/** The EXACT transfer identity: sigma1(n) = G(n)·u(D) - sqrt(n) with
 * G = (2·sqrt(2)/9)·P·A. Residual at the float floor for every n. */
export function transferResidual(n: number): { lhs: number; rhs: number; residual: number } {
  const { A, P } = shareChainPieces(n);
  const G = (2 * Math.SQRT2 * P * A) / 9;
  const u = scaledModeSum(n / 2);
  const lhs = sigmaFirst(n);
  const rhs = G * u - Math.sqrt(n);
  return { lhs, rhs, residual: Math.abs(lhs - rhs) };
}

/** kappa from the transfer: kappa = sigma1 / (2·sqrt(2/pi)). */
export function kappaFromSigma(sigma1: number): number {
  return sigma1 / (2 * Math.sqrt(2 / Math.PI));
}

/** The arc's third-order closure face: -(n-2)c2/12·(1 - 3·sigma1/sqrt(n)). */
export function arcThirdOrderFace(n: number, sigma1: number): number {
  const c2 = secondOrderGeneral(n);
  return (-(n - 2) * c2 * (1 - (3 * sigma1) / Math.sqrt(n))) / 12;
}

/** Relative deviation of the exact c3(n) from the closure face (should
 * decay as O(1/sqrt(n))). Domain: thirdOrderClosed's exact rational path
 * is valid on the small-n grid (n <= 16, the TC38 domain) — larger n's
 * BigInt vectors overflow the Number conversion. */
export function arcClosureRelative(n: number, sigma1: number): number {
  if (n > 16) throw new Error("arcClosureRelative: the exact c3 path is small-n only (n <= 16)");
  const face = arcThirdOrderFace(n, sigma1);
  return thirdOrderClosed(n) / face - 1;
}

// ---------------------------------------------------------------------------
// TC45: the edge-mass series
// ---------------------------------------------------------------------------

/** The exact edge mass m_k = (2k+1)C(2k,k)/(2·4^k·k) as a lowest-terms
 * BigInt rational (m_1 = 3/4, m_2 = 15/32). */
export function edgeMassRational(k: number): { num: bigint; den: bigint } {
  if (k < 1) throw new Error("edgeMassRational: k >= 1 required");
  let c = 1n;
  for (let i = 0; i < k; i++) c = (c * BigInt(2 * k - i)) / BigInt(i + 1);
  const num = BigInt(2 * k + 1) * c;
  const den = 2n ** BigInt(2 * k + 1) * BigInt(k);
  let a = num;
  let b = den;
  while (b !== 0n) {
    const t = a % b;
    a = b;
    b = t;
  }
  return { num: num / a, den: den / a };
}

/** The edge mass as a float, overflow-safe: the incremental recurrence
 * m_{k} = m_{k-1}·(2k+1)(k-1)/(2k^2) from the exact m_1 = 3/4 (a direct
 * BigInt->Number conversion of the exact rational overflows past k ~ 500). */
export function edgeMassFloat(k: number): number {
  if (k < 1) throw new Error("edgeMassFloat: k >= 1 required");
  let m = 0.75;
  for (let j = 2; j <= k; j++) m = (m * (2 * j + 1) * (j - 1)) / (2 * j * j);
  return m;
}

/** The midpoint mass mu_k = (2/sqrt(pi))(sqrt(k+1/2) - sqrt(k-1/2)). */
export function muMidpoint(k: number): number {
  return (2 / Math.sqrt(Math.PI)) * (Math.sqrt(k + 0.5) - Math.sqrt(k - 0.5));
}

/** E_k = m_k - mu_k (float; the exact face is edgeMassRational). */
export function edgeDiff(k: number): number {
  return edgeMassFloat(k) - muMidpoint(k);
}

/** The first next-order law: E_k·sqrt(pi)·k^{3/2} -> 3/8. */
export function edgeNextOrder(k: number): number {
  return edgeDiff(k) * Math.sqrt(Math.PI) * Math.pow(k, 1.5);
}

/** The second next-order law: (E_k·sqrt(pi)·k^{3/2} - 3/8)·k -> -11/128
 * (exact rational, derived from the central-binomial expansion and the
 * midpoint Taylor; float noise dominates for k >> 3·10^4). */
export const EDGE_SECOND_COEFF = -11 / 128;

/** Euler–Maclaurin zeta for s > 1 (the values feeding the zeta-face).
 * v0.20.0 SIGN FIX (TC47): the tail formula is zeta = sum_{k<=N} +
 * N^{1-s}/(s-1) - (1/2) N^{-s} + (s/12) N^{-s-1} - ...; v0.19.0 ADDED the
 * (1/2) N^{-s} term, a +N^{-s} error of +2.15e-3 on zeta(3/2) at N = 60
 * (the error's exact N^{-s} signature is the conviction: err(60) =
 * 60^{-1.5} = 2.1517e-3, err(120) = 120^{-1.5} = 7.6073e-4, err_zeta(5/2)
 * = 60^{-2.5} = 3.5861e-5 — all four digits). Certified by the N = 60/120/
 * 240 agreement (now ~1e-10) where the buggy road disagreed at 1e-3. */
export function zetaEM(s: number, N = 60): number {
  let sum = 0;
  for (let k = 1; k <= N; k++) sum += Math.pow(k, -s);
  return sum + Math.pow(N, 1 - s) / (s - 1) - 0.5 * Math.pow(N, -s) + (s / 12) * Math.pow(N, -s - 1);
}

export interface EdgeSeries {
  readonly K: number;
  readonly zetaFace: number; // (3/8)zeta(3/2)/sqrt(pi) - (11/128)(3/8)zeta(5/2)/sqrt(pi)
  readonly remainder: number; // sum of E_k - asymptotic terms
  readonly sumE: number; // the accelerated series value
  readonly zetaM: number; // sum(E) - sqrt(2/pi): the generalized-zeta constant
  readonly spotChecks: number; // worst |incremental m - exact m| over probes
}

/** The accelerated edge-mass series to K terms. The masses are accumulated
 * INCREMENTALLY (m_{k} = m_{k-1}·(2k+1)(k-1)/(2k^2), m_1 = 3/4 — spot-
 * checked against the exact rationals), then the known asymptotic
 * 3/8·k^{-3/2} - (11/128)(3/8)k^{-5/2} is summed analytically through the
 * zeta values, leaving a remainder series that converges like k^{-7/2}. */
export function edgeSeriesAccelerated(K: number): EdgeSeries {
  const c32 = 0.375 / Math.sqrt(Math.PI);
  const bTerm = ((-11 / 128) * 0.375) / Math.sqrt(Math.PI);
  let m = 0.75;
  let remainder = 0;
  let spotWorst = 0;
  // spot checks against the exact rationals only where the BigInt->Number
  // conversion is safe (C(2k,k)·(2k+1) < 2^{2k+1}·k stays under 1e308 for
  // k <= 200; beyond that the recurrence is validated by the 3/8 law itself)
  const spotAt = new Set([1, 2, 3, 10, 100, 200]);
  for (let k = 1; k <= K; k++) {
    if (k > 1) m = (m * (2 * k + 1) * (k - 1)) / (2 * k * k);
    if (spotAt.has(k)) {
      const r = edgeMassRational(k);
      spotWorst = Math.max(spotWorst, Math.abs(m - Number(r.num) / Number(r.den)));
    }
    remainder += m - muMidpoint(k) - c32 * Math.pow(k, -1.5) - bTerm * Math.pow(k, -2.5);
  }
  const zetaFace = c32 * zetaEM(1.5) + bTerm * zetaEM(2.5);
  const sumE = zetaFace + remainder;
  return { K, zetaFace, remainder, sumE, zetaM: sumE - Math.sqrt(2 / Math.PI), spotChecks: spotWorst };
}

/** Phi1 = kappa - zeta_m with the bracket: |Phi1| is the cutoff face's
 * subleading constant (machine-measured, closed form open). */
export function cutoffFace(sigma1: number, series: EdgeSeries): { phi1: number; kappa: number; zetaM: number } {
  const kappa = kappaFromSigma(sigma1);
  return { phi1: kappa - series.zetaM, kappa, zetaM: series.zetaM };
}

/** The F-function face: F(k,D) = D·s_k/m_k (log-space; f(k/D)·(1+o(1)),
 * f(0) = 1 — the O(1) shift of the cutoff renormalizes 2/sqrt(pi) to
 * sqrt(pi)/2, the arcsine law's leading constant). */
export function fFunctionFace(d: number, k: number): number {
  const n = 2 * d;
  const lf: number[] = [0];
  for (let i = 1; i <= n; i++) lf[i] = lf[i - 1]! + Math.log(i);
  const lb = (a: number, b: number): number => lf[a]! - lf[b]! - lf[a - b]!;
  const lnS = 2 * lb(d - 1, k) - lb(n, 2 * k + 1) - Math.log(k);
  return (d * Math.exp(lnS)) / edgeMassFloat(k);
}

// ---------------------------------------------------------------------------
// v0.20.0 — TC47: Phi1 MACHINE-BRACKETED, EXPLICITLY (the arc's one open
// face, extended). Phi1 = kappa - zeta_m was machine-MEASURED at v0.19.0
// with no stated bracket; here every error piece is named and certified:
//   - eps_kappa: the spread of four cross-family Richardson combos for
//     sigma1 on the INCREMENTAL-binomial share road (clean past n = 2^18
//     where the log-factorial road's ulp noise bites), mapped through the
//     exact transfer kappa = sigma1/(2 sqrt(2/pi));
//   - eps_zeta: the edge series' K-truncation tail, bounded by a probed
//     k^{-7/2} coefficient bound, plus the Euler-Maclaurin zeta truncation
//     (N = 60 vs 120 differences);
//   - the independent kappa(D) road (incremental S, cross-validated against
//     the lf-table road at D <= 2^16) confirms the transfer kappa to ~7e-6
//     — 6.7x tighter than v0.19.0's 4.7e-5 confirmation;
//   - the D-grid structure: Phi1(D) = kappaFaceInc(D) - zeta_m is NEGATIVE
//     and MONOTONE RISING on D = 2^12..2^20, its increments shrinking with
//     ratio ~0.50 = 2^{-1} (the 1/sqrt(D) approach face) — certified data.
// NO closed form is claimed for Phi1 (that face stays open); fake brackets
// are rejected by name by checkPhi1Bracket.
// ---------------------------------------------------------------------------

/** S(D) by the incremental-binomial road: ln C(D-1,k) and ln C(2D,2k+1) by
 * per-step quotient recurrences (every intermediate O(1) — no log-factorial
 * table), summed by log1p log-sum-exp. */
export function scaledModeSumIncremental(d: number): number {
  if (d < 2 || d % 1 !== 0) throw new Error("scaledModeSumIncremental: integer D >= 2 required");
  let lnA = 0;
  let lnB = Math.log(2 * d);
  let lnS = -Infinity;
  for (let k = 1; k <= d - 1; k++) {
    lnA += Math.log(d - k) - Math.log(k);
    lnB += Math.log(2 * d - 2 * k + 1) + Math.log(2 * d - 2 * k) - Math.log(2 * k) - Math.log(2 * k + 1);
    const t = 2 * lnA - lnB - Math.log(k);
    lnS = lnS === -Infinity ? t : lnS + Math.log1p(Math.exp(t - lnS));
  }
  return Math.exp(lnS);
}

/** kappa(D) on the incremental road — the independent D-road to kappa. */
export function kappaFaceIncremental(d: number): number {
  return (scaledModeSumIncremental(d) * Math.sqrt(d) - Math.sqrt(Math.PI) / 2) * Math.sqrt(d);
}

/** The two kappa roads' disagreement at D (the lf-table road vs the
 * incremental road — the old road's noise, measured where both are valid). */
export function kappaRoadCrossDeviation(d: number): number {
  return Math.abs(kappaFaceIncremental(d) - kappaFace(d));
}

/** The edge series' K-truncation tail bound: the remainder per term after
 * the 3/8 k^{-3/2} and -(11/128)(3/8) k^{-5/2} faces decays as k^{-7/2};
 * the coefficient is bounded on the resolvable probe window (beyond it the
 * midpoint difference's own cancellation drowns the signal — a DATA bound,
 * labeled as such), and the tail integral (2/5) K^{-5/2} caps the error. */
export function edgeSeriesTailBound(K: number, probeStep = 997): { c2Bound: number; tail: number; zetaTrunc: number } {
  let c2Bound = 0;
  for (let k = 1000; k <= 100000; k += probeStep) {
    const r = edgeDiff(k) * Math.sqrt(Math.PI) * Math.pow(k, 1.5) - 0.375 + 11 / (128 * k);
    c2Bound = Math.max(c2Bound, Math.abs(r) * k * k);
  }
  const tail = c2Bound * (2 / 5) * Math.pow(K, -2.5);
  const zetaTrunc =
    0.375 / Math.sqrt(Math.PI) * Math.abs(zetaEM(1.5, 60) - zetaEM(1.5, 120)) +
    Math.abs(((-11 / 128) * 0.375) / Math.sqrt(Math.PI)) * Math.abs(zetaEM(2.5, 60) - zetaEM(2.5, 120));
  return { c2Bound, tail, zetaTrunc };
}

export interface Phi1Face {
  readonly sigma1: number; // the point estimator (TC43's grid, incremental road)
  readonly kappa: number; // sigma1 / (2 sqrt(2/pi)) — the transfer
  readonly zetaM: number; // the edge series' constant (K = 2^20)
  readonly point: number; // kappa - zeta_m
  readonly epsKappa: number; // cross-family Richardson spread, mapped to kappa
  readonly epsZeta: number; // series tail + zeta truncation
  readonly lo: number; // the certified bracket
  readonly hi: number;
  readonly kappaRoadDeviation: number; // |stage-1 D-road cluster - kappa| (independent confirmation)
  readonly spread: number; // the raw sigma1 combo spread
}

/** The four cross-family sigma1 Richardson combos (no shared points across
 * families; tops <= 2^19 where the incremental road is certified clean). */
const PHI1_SIGMA_COMBOS: ReadonlyArray<readonly number[]> = [
  [16384, 65536, 262144],
  [4096, 16384, 65536, 262144],
  [12288, 49152, 196608],
  [24576, 98304, 393216],
];

/** The assembled Phi1 face: point, certified bracket, error pieces. */
export function phi1Face(): Phi1Face {
  const estimates = PHI1_SIGMA_COMBOS.map((g) =>
    richardsonLimit(g.map((n) => ({ n, v: sigmaFirstIncremental(n) })), 1),
  );
  const sigma1 = estimates[1]!; // TC43's own grid, on the certified road
  const spread = Math.max(...estimates) - Math.min(...estimates);
  const epsKappa = spread / (2 * Math.sqrt(2 / Math.PI));
  const series = edgeSeriesAccelerated(1 << 20);
  const tail = edgeSeriesTailBound(1 << 20);
  const epsZeta = tail.tail + tail.zetaTrunc;
  const kappa = kappaFromSigma(sigma1);
  const point = kappa - series.zetaM;
  // the independent D-road: stage-1 Richardson (eliminates the 1/sqrt(D)
  // face) clusters; its center is the road's kappa — the confirmation
  const road = [16384, 65536, 262144, 1048576].map((d) => kappaFaceIncremental(d));
  const stage1 = [road[1]! * 2 - road[0]!, road[2]! * 2 - road[1]!, road[3]! * 2 - road[2]!];
  const roadCenter = (stage1[0]! + stage1[1]!) / 2;
  const kappaRoadDeviation = Math.abs(roadCenter - kappa);
  return {
    sigma1,
    kappa,
    zetaM: series.zetaM,
    point,
    epsKappa,
    epsZeta,
    lo: point - epsKappa - epsZeta,
    hi: point + epsKappa + epsZeta,
    kappaRoadDeviation,
    spread,
  };
}

export interface Phi1GridRow {
  readonly D: number;
  readonly phi1D: number; // kappaFaceIncremental(D) - zeta_m
}

/** The Phi1(D) grid on the certified road (D = 2^12..2^20). */
export function phi1Grid(): readonly Phi1GridRow[] {
  const zetaM = edgeSeriesAccelerated(1 << 20).zetaM;
  return [4096, 16384, 65536, 262144, 1048576].map((D) => ({
    D,
    phi1D: kappaFaceIncremental(D) - zetaM,
  }));
}

/** The D-grid structural certificate: sign stability (Phi1(D) < 0
 * everywhere probed), monotone rise toward the limit, and the increments'
 * shrinking ratios (the approach face — ~0.50 = 2^{-1}, the 1/sqrt(D)
 * face; the geometric tail bound on the grid alone is the road's own
 * coarse bracket, the transfer carries the precision). */
export function phi1GridStructure(): {
  monotone: boolean;
  signStable: boolean;
  incrementRatios: readonly number[];
  tailBound: number;
} {
  const grid = phi1Grid().map((r) => r.phi1D);
  const monotone = grid.every((v, i) => i === 0 || v > grid[i - 1]!);
  const signStable = grid.every((v) => v < 0);
  const ratios: number[] = [];
  for (let i = 2; i < grid.length; i++) {
    ratios.push((grid[i]! - grid[i - 1]!) / (grid[i - 1]! - grid[i - 2]!));
  }
  const lastInc = grid[grid.length - 1]! - grid[grid.length - 2]!;
  const rMax = Math.max(...ratios);
  return { monotone, signStable, incrementRatios: ratios, tailBound: (lastInc * rMax) / (1 - rMax) };
}

/** A claimed Phi1 bracket, with its provenance — the error pieces it
 * claims to have paid for. */
export interface Phi1Bracket {
  readonly lo: number;
  readonly hi: number;
  readonly pieces: readonly string[];
}

/** The bracket checker: a Phi1 bracket is legal only if it contains the
 * machine point, its width covers the CERTIFIED error floor (an
 * over-narrow bracket is over-precision fraud, not a tighter result), and
 * its provenance names the kappa-transfer and zeta-series pieces. Every
 * rejection NAMES the fraud; [] means legal. */
export function checkPhi1Bracket(b: Phi1Bracket, face: Phi1Face = phi1Face()): readonly string[] {
  const out: string[] = [];
  if (!(b.lo < b.hi)) {
    out.push(`fake Phi1 bracket: lo ${b.lo} >= hi ${b.hi} — an empty interval is not a bracket`);
    return out;
  }
  if (b.lo > face.point || b.hi < face.point) {
    out.push(
      `fake Phi1 bracket: does not contain the machine point kappa - zeta_m = ${face.point.toExponential(6)}`,
    );
  }
  const floor = 2 * (face.epsKappa + face.epsZeta);
  if (b.hi - b.lo < floor) {
    out.push(
      `fake Phi1 bracket: width ${b.hi - b.lo} is below the certified error floor 2(eps_kappa + eps_zeta) = ${floor.toExponential(3)} — over-precision fraud`,
    );
  }
  if (!b.pieces.some((p) => /kappa|sigma1/i.test(p)) || !b.pieces.some((p) => /zeta/i.test(p))) {
    out.push("fake Phi1 bracket: provenance names no error piece (need the kappa-transfer spread AND the zeta-series tail)");
  }
  return out;
}
