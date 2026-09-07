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
 *     machine-measured -4.547e-4, SMALL BUT NONZERO (the sharp-cutoff
 *     assembly does not close exactly); its closed form stays open. The
 *     F-function F(k,D) := D·s_k/m_k = f(k/D)(1+o(1)) with f(0)=1 carries
 *     the face: its leading O(1) shift renormalizes 2/sqrt(pi) ->
 *     sqrt(pi)/2 (the arcsine law), its subleading constant is Phi1.
 */

import { secondOrderGeneral, shareChainPieces, sigmaFirst, thirdOrderClosed } from "./armor.js";

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

/** Euler–Maclaurin zeta for s > 1 (the values feeding the zeta-face). */
export function zetaEM(s: number): number {
  const N = 60;
  let sum = 0;
  for (let k = 1; k <= N; k++) sum += Math.pow(k, -s);
  return sum + Math.pow(N, 1 - s) / (s - 1) + 0.5 * Math.pow(N, -s) + (s / 12) * Math.pow(N, -s - 1);
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
