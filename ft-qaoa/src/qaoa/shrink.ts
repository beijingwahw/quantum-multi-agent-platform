import type { IsingModel } from "../core/ising.js";
import { requireThat, requireQubitCount } from "../core/errors.js";
import { DensityMatrix } from "../core/density.js";
import { qaoaState } from "./engine.js";
import type { QaoaParams } from "./engine.js";
import { applyReadoutFlips, noisyExpectation } from "./noise.js";

/**
 * The shrink/algebra face of the bounded-noise track (v0.4). Two theorems,
 * both machine-falsifiable, both proved against the entry-level facts of
 * density.ts rather than asserted:
 *
 * F1 — noise-circuit exchange. The per-layer depolarizing channel's DIAGONAL
 * action is exactly the classical bit-flip channel with flip probability
 * 2*eps/3 (pass-1 diagonal mixing weights (1-2eps/3, 2eps/3)), it never
 * converts off-diagonal content back into the diagonal (pass 1 pairs (s,t)
 * with (s^bit, t^bit) — inequality of s,t is preserved; pass 2 only scales),
 * and the cost phase never touches the diagonal (phase 0 on s === t). Only
 * the MIXER transfers coherence into populations. Consequences:
 *
 *   (a) COMMUTING REGIME (exact identity). If the cost is non-interacting
 *       (every coupling weight 0 — the layer unitary is a tensor product of
 *       single-qubit unitaries, and the isotropic channel commutes with
 *       those), or p = 1, or every mixer after the first noise layer is
 *       trivial (beta_t = 0 for t >= 2 — includes the linear ramp at p = 2,
 *       whose trailing beta is identically 0), then
 *
 *         <C>_noisy = sum_S a^{p|S|} * cHat(S) * <chi_S>_ideal
 *                   = sum_S b^{|S|} (1-b)^{n-|S|} <C>_{S-marginal},
 *
 *       with a = 1-4eps/3, b = a^p, chi_S the Walsh character, cHat the Walsh
 *       spectrum of the energy table, and the correlators taken on the
 *       IDEAL (noiseless, statevector-engine) final distribution. This is
 *       the terminal-shrink identity: interleaving the noise commutes it to
 *       one shrink per qubit at the end, and the binomial-marginal form is
 *       its erasure representation (the two forms agree by binomial
 *       inversion — proved independently in tests).
 *
 *   (b) INTERLEAVED REGIME (identity FAILS; priced, not hidden). With
 *       interaction terms AND a nontrivial mixer between two noise layers,
 *       commutation through the entangling cost phase is impossible and the
 *       closed form errs by a machine-measured O(eps) gap (up to ~2e-1 on
 *       seeded instances). What survives exactly is the POLYNOMIAL LAW:
 *       <C>_noisy(a) is a polynomial in a of degree <= n*p (each of the p*n
 *       single-qubit channel applications is affine in a), with the a^0
 *       coefficient equal to mean(E) — angle-independent, so noise-aware
 *       retraining can never move it. The grade decomposition
 *       <C>_noisy(a) = sum_k g_k a^k turns every noise-aware comparison of
 *       two schedules into an exact univariate-polynomial comparison — the
 *       decidable form of the "retraining question" of the evaluation-vs-
 *       retraining boundary in noise.ts.
 *
 * F2 — readout Walsh-filter identity. The symmetric readout flip channel is
 * diagonalized by the Walsh characters with eigenvalue (1-2q)^{|S|} per mode
 * S, so <C>_obs(q) = sum_S (1-2q)^{|S|} cHat(S) <chi_S> is EXACTLY a
 * polynomial in 1-2q of degree <= n (degree <= 2 for any 2-local cost: the
 * spectrum vanishes above the locality). "Readout only rescales, never
 * bends" upgrades from exp4's empirical statement to the exact criterion:
 * grouped coefficients w_k = sum_{|S|=k} cHat(S)<chi_S> all non-negative for
 * k >= 1 implies <C>_obs(q) is non-increasing on q in [0, 1/2] — and the
 * machine reports the verdict per instance either way.
 *
 * Honest boundaries: only the layer-after-cost+mixer depolarizing model and
 * the symmetric independent readout model are covered; per-gate noise (the
 * negative control below), amplitude damping and correlated flips are out.
 * The identity of F1(a) is claimed as SUFFICIENT (machine grids support
 * necessity for interacting costs; no necessity claim is made). Binomial
 * weights are a probability mixture only for eps <= 3/4 (a in [0,1]); the
 * algebra is exact on the whole channel domain eps in [0,1].
 */

/** Pauli-letter shrink factor per depolarizing layer: a = 1 - 4*eps/3. */
export function shrinkFactor(eps: number): number {
  requireThat(eps >= 0 && eps <= 1, "SHRINK_EPS_INVALID", `depolarizing probability out of [0,1]: ${eps}`);
  return 1 - (4 * eps) / 3;
}

/** Population count of a bit pattern (Walsh mode size |S|). */
function popcount(x: number): number {
  let c = 0;
  while (x !== 0) {
    x &= x - 1;
    c++;
  }
  return c;
}

/** Walsh character chi_S(s) = (-1)^{|s & S|} = prod_{j in S} z_j(s). */
function chi(S: number, s: number): number {
  return popcount(s & S) % 2 === 0 ? 1 : -1;
}

/** The ideal (noiseless) Born distribution, via the statevector engine. */
function idealProbs(model: IsingModel, energyOf: Float64Array, params: QaoaParams): Float64Array {
  return qaoaState(model, energyOf, params).probabilities();
}

/**
 * Walsh spectrum of a function on {0,1}^n by direct summation
 * cHat(S) = 2^-n sum_s f(s) chi_S(s). O(4^n) on purpose: the independent
 * second route against the fast Hadamard transform used by the F2 pairing.
 */
export function walshSpectrumDirect(f: Float64Array, n: number): Float64Array {
  requireQubitCount(n);
  requireThat(
    f.length === 1 << n,
    "ENERGY_LENGTH_MISMATCH",
    `function table length must equal 2^n = ${1 << n}, got ${f.length}`,
  );
  const dim = 1 << n;
  const out = new Float64Array(dim);
  for (let S = 0; S < dim; S++) {
    let acc = 0;
    for (let s = 0; s < dim; s++) acc += f[s]! * chi(S, s);
    out[S] = acc / dim;
  }
  return out;
}

/** In-place fast Hadamard transform (unnormalized), O(n 2^n). */
export function fastHadamard(f: Float64Array, n: number): void {
  requireQubitCount(n);
  requireThat(f.length === 1 << n, "ENERGY_LENGTH_MISMATCH", `transform length must equal 2^n = ${1 << n}, got ${f.length}`);
  const dim = 1 << n;
  for (let stride = 1; stride < dim; stride <<= 1) {
    for (let base = 0; base < dim; base += stride << 1) {
      for (let off = 0; off < stride; off++) {
        const u = f[base + off]!;
        const v = f[base + off + stride]!;
        f[base + off] = u + v;
        f[base + off + stride] = u - v;
      }
    }
  }
}

/** <chi_S> under a distribution (the ideal correlator when probs is ideal). */
export function correlator(probs: Float64Array, S: number): number {
  let acc = 0;
  for (let s = 0; s < probs.length; s++) acc += probs[s]! * chi(S, s);
  return acc;
}

/** Non-interacting iff every coupling weight is exactly zero. */
export function isNonInteracting(model: IsingModel): boolean {
  return model.couplings.every((c) => c.w === 0);
}

export type ExchangeReason = "non-interacting" | "single-layer" | "trivial-tail-mixers" | "interleaved";

export interface ExchangeRegime {
  readonly commuting: boolean;
  readonly reason: ExchangeReason;
}

/**
 * Decidable predicate for F1(a): the terminal-shrink identity is exact when
 * the noise never has a nontrivial mixer between two of its applications on
 * interacting content, and never meets an entangling cost at all when the
 * cost factorizes. Sufficient conditions, checked in proof order.
 */
export function exchangeRegime(model: IsingModel, params: QaoaParams): ExchangeRegime {
  const p = params.gammas.length;
  if (isNonInteracting(model)) return { commuting: true, reason: "non-interacting" };
  if (p <= 1) return { commuting: true, reason: "single-layer" };
  let tailTrivial = true;
  for (let t = 1; t < p; t++) {
    if (params.betas[t] !== 0) {
      tailTrivial = false;
      break;
    }
  }
  if (tailTrivial) return { commuting: true, reason: "trivial-tail-mixers" };
  return { commuting: false, reason: "interleaved" };
}

/**
 * Route A — terminal-shrink closed form:
 * <C>_noisy = sum_S b^{|S|} cHat(S) <chi_S>_ideal with b = (1-4eps/3)^p.
 * The correlators come from the statevector engine, so agreement with the
 * density engine in the commuting regime is a two-engine identity check.
 */
export function terminalShrinkExpectation(model: IsingModel, energyOf: Float64Array, params: QaoaParams, eps: number): number {
  const n = model.n;
  const dim = 1 << n;
  requireThat(energyOf.length === dim, "ENERGY_LENGTH_MISMATCH", `energy table length must equal 2^n = ${dim}, got ${energyOf.length}`);
  const b = Math.pow(shrinkFactor(eps), params.gammas.length);
  const probs = idealProbs(model, energyOf, params);
  const spec = walshSpectrumDirect(energyOf, n);
  let acc = 0;
  for (let S = 0; S < dim; S++) acc += Math.pow(b, popcount(S)) * spec[S]! * correlator(probs, S);
  return acc;
}

/**
 * Route B — binomial-marginal closed form (erasure representation of the
 * same identity): sum_S b^{|S|}(1-b)^{n-|S|} <C>_{S-marginal}, where the
 * S-marginal expectation is computed by marginalizing the ideal distribution
 * onto S and pairing the restricted character expansion — a different
 * computation path than route A (marginalization + per-marginal sums vs
 * global correlators), agreeing with it by binomial inversion.
 */
export function binomialMarginalExpectation(model: IsingModel, energyOf: Float64Array, params: QaoaParams, eps: number): number {
  const n = model.n;
  const dim = 1 << n;
  const b = Math.pow(shrinkFactor(eps), params.gammas.length);
  const probs = idealProbs(model, energyOf, params);
  // Terms of C's character expansion: |S'| <= 2 here, but written generally.
  const terms: Array<{ S: number; c: number }> = [];
  for (const c of model.couplings) terms.push({ S: (1 << c.j) | (1 << c.k), c: c.w });
  for (let j = 0; j < n; j++) terms.push({ S: 1 << j, c: model.fields[j]! });
  let acc = 0;
  for (let S = 0; S < dim; S++) {
    const k = popcount(S);
    const weight = Math.pow(b, k) * Math.pow(1 - b, n - k);
    // marginalize probs onto S: the marginal index re-numbers the bits of S
    // in ascending qubit order (compressed indexing).
    const marg = new Float64Array(1 << k);
    for (let s = 0; s < dim; s++) {
      let idx = 0;
      let bit = 0;
      for (let j = 0; j < n; j++) {
        if ((S >>> j) & 1) {
          idx |= (s >>> j) & 1 ? 1 << bit : 0;
          bit++;
        }
      }
      marg[idx] = marg[idx]! + probs[s]!;
    }
    let margExp = 0;
    for (const t of terms) {
      if ((t.S & ~S) !== 0) continue;
      // compressed mask of t.S within S's ascending bit order, so the
      // character chi(t.S, .) is evaluated in the marginal's own indexing
      let cmask = 0;
      let bit = 0;
      for (let j = 0; j < n; j++) {
        if ((S >>> j) & 1) {
          if ((t.S >>> j) & 1) cmask |= 1 << bit;
          bit++;
        }
      }
      let pairing = 0;
      for (let mid = 0; mid < marg.length; mid++) pairing += marg[mid]! * chi(cmask, mid);
      margExp += t.c * pairing;
    }
    acc += weight * margExp;
  }
  return acc;
}

/**
 * Route C — the proof mechanism itself, as an independent computation: in the
 * whole commuting regime the final diagonal is exactly the classical flip
 * channel F_{2eps/3} applied p times to the ideal diagonal. For the
 * trivial-tail-mixers regime this is the no-late-transfer proof (costs never
 * touch the diagonal, the channel never converts coherence back to
 * populations, only mixers transfer, and the tail mixers are trivial); for
 * the non-interacting regime the state is a PRODUCT state throughout
 * (product initial state, product cost phases, product mixers, product
 * channel), so each qubit's diagonal evolves under its own classical flip.
 * Pricing <C> on applyReadoutFlips^p(ideal probs) must reproduce the density
 * engine there — and measurably departs from it in the interleaved regime,
 * where late mixers feed already-shrunk coherence into the diagonal.
 */
export function diagonalFilterExpectation(model: IsingModel, energyOf: Float64Array, params: QaoaParams, eps: number): number {
  const n = model.n;
  const q = (2 * eps) / 3;
  let probs = idealProbs(model, energyOf, params);
  for (const _t of params.gammas) probs = applyReadoutFlips(probs, n, q);
  let acc = 0;
  for (let s = 0; s < probs.length; s++) acc += probs[s]! * energyOf[s]!;
  return acc;
}

/**
 * Negative control: the per-gate noise placement (depolarize after the cost
 * phase AND after the mixer, twice per layer). The F1 identity is a theorem
 * about the LAYER placement; moving the channel one gate breaks it even on
 * schedules where the layer placement is exact (the ramp at p = 2: the
 * cost-side channel of layer 1 shrinks the coherence the mixer has not yet
 * transferred into the diagonal) — this variant exists to be convicted.
 */
export function perGateNoisyExpectation(model: IsingModel, energyOf: Float64Array, params: QaoaParams, eps: number): number {
  shrinkFactor(eps);
  const rho = DensityMatrix.plusState(model.n);
  const depolAll = (): void => {
    for (let j = 0; j < model.n; j++) rho.depolarizeQubit(j, eps);
  };
  for (let t = 0; t < params.gammas.length; t++) {
    rho.applyCostPhase(params.gammas[t]!, energyOf);
    depolAll();
    rho.applyMixer(params.betas[t]!);
    depolAll();
  }
  const probs = rho.probabilities();
  let acc = 0;
  for (let s = 0; s < probs.length; s++) acc += probs[s]! * energyOf[s]!;
  return acc;
}

export interface ShrinkExchangeReport {
  readonly regime: ExchangeRegime;
  readonly eps: number;
  readonly engineValue: number;
  readonly terminalClosedForm: number;
  readonly binomialMarginal: number;
  readonly diagonalRoute: number;
  readonly maxClosedFormGap: number;
  /** |route A - route B| — the two closed-form algebras must agree everywhere. */
  readonly closedFormSplit: number;
  /** |engine - route C| — at float noise in the whole commuting regime. */
  readonly diagonalRouteGap: number;
}

/**
 * The full exchange verdict for one (instance, schedule, eps): the exact
 * density engine against all three closed-form routes, with the regime the
 * decidable predicate names. In the commuting regime every gap must sit at
 * float noise; in the interleaved regime the closed-form gap is the priced
 * interleaving correction (reported, never hidden).
 */
export function shrinkExchangeReport(
  model: IsingModel,
  energyOf: Float64Array,
  params: QaoaParams,
  eps: number,
): ShrinkExchangeReport {
  const engineValue = noisyExpectation(model, energyOf, params, { depolarizingPerLayer: eps, readoutFlip: 0 });
  const terminalClosedForm = terminalShrinkExpectation(model, energyOf, params, eps);
  const binomialMarginal = binomialMarginalExpectation(model, energyOf, params, eps);
  const diagonalRoute = diagonalFilterExpectation(model, energyOf, params, eps);
  return {
    regime: exchangeRegime(model, params),
    eps,
    engineValue,
    terminalClosedForm,
    binomialMarginal,
    diagonalRoute,
    maxClosedFormGap: Math.max(Math.abs(engineValue - terminalClosedForm), Math.abs(engineValue - binomialMarginal)),
    closedFormSplit: Math.abs(terminalClosedForm - binomialMarginal),
    diagonalRouteGap: Math.abs(engineValue - diagonalRoute),
  };
}

// ---------------------------------------------------------------------------
// F1(b): the exact polynomial law and the grade decomposition.
// ---------------------------------------------------------------------------

/** Hard cap on the interpolation degree: degree + 1 exact engine runs. */
export const MAX_NOISE_GRADE_DEGREE = 256;

export interface NoiseGrades {
  readonly n: number;
  readonly p: number;
  readonly degree: number;
  /** g_k for k = 0..degree: <C>_noisy(a) = sum_k g_k a^k exactly. */
  readonly grades: Float64Array;
  /** Worst off-node |poly(a) - engine(a)| over the verification grid. */
  readonly maxResidual: number;
  /** The a^0 grade: equals mean(E), independent of the schedule. */
  readonly g0: number;
  /** sum_k g_k = the ideal (eps = 0) value. */
  readonly idealValue: number;
  readonly idealEngineValue: number;
}

/**
 * Exact polynomial grades of <C>_noisy in a = 1-4eps/3, by interpolation at
 * Chebyshev-Lobatto nodes of the channel domain [−1/3, 1] through the exact
 * density engine (each node is one noiseless-or-noisy engine evaluation — a
 * distinct algebra from any closed form), with an off-node residual check.
 * Degree bound np is provable: each of the p*n single-qubit channel
 * applications contributes one affine factor in a.
 */
export function noiseGrades(model: IsingModel, energyOf: Float64Array, params: QaoaParams): NoiseGrades {
  const n = model.n;
  const p = params.gammas.length;
  requireQubitCount(n);
  requireThat(Number.isInteger(p) && p >= 1, "QAOA_DEPTH_INVALID", `schedule depth must be a positive integer, got ${p}`);
  const degree = n * p;
  requireThat(
    degree <= MAX_NOISE_GRADE_DEGREE,
    "SHRINK_GRADE_DEGREE_INVALID",
    `grade interpolation needs degree+1 = ${degree + 1} engine runs; cap is ${MAX_NOISE_GRADE_DEGREE} (shrink n, p, or raise the budget consciously)`,
  );
  // Chebyshev-Lobatto nodes on [lo, 1], lo = a at eps = 1.
  const lo = -1 / 3;
  const mid = (1 + lo) / 2;
  const half = (1 - lo) / 2;
  const nodes: number[] = [];
  const values: number[] = [];
  for (let i = 0; i <= degree; i++) {
    const a = mid + half * Math.cos((Math.PI * i) / degree);
    const eps = ((1 - a) * 3) / 4;
    nodes.push(a);
    values.push(noisyExpectation(model, energyOf, params, { depolarizingPerLayer: eps, readoutFlip: 0 }));
  }
  // Newton divided differences.
  const coef = values.slice();
  for (let j = 1; j <= degree; j++) {
    for (let i = degree; i >= j; i--) {
      coef[i] = (coef[i]! - coef[i - 1]!) / (nodes[i]! - nodes[i - j]!);
    }
  }
  const evalPoly = (x: number): number => {
    let acc = coef[degree]!;
    for (let i = degree - 1; i >= 0; i--) acc = acc * (x - nodes[i]!) + coef[i]!;
    return acc;
  };
  // Off-node verification grid: interior Chebyshev points of the second kind.
  let maxResidual = 0;
  for (let i = 1; i < 2 * degree; i++) {
    const x = mid + half * Math.cos((Math.PI * (i - 0.5)) / (2 * degree));
    const eps = ((1 - x) * 3) / 4;
    const direct = noisyExpectation(model, energyOf, params, { depolarizingPerLayer: eps, readoutFlip: 0 });
    maxResidual = Math.max(maxResidual, Math.abs(evalPoly(x) - direct));
  }
  const grades = new Float64Array(degree + 1);
  // Convert the Newton form to the monomial basis: expand the product of
  // linear factors (x - nodes[i]) by Horner, accumulating coefficients.
  let acc = new Float64Array(1);
  acc[0] = coef[degree]!;
  for (let i = degree - 1; i >= 0; i--) {
    const next = new Float64Array(acc.length + 1);
    // next = acc * (x - nodes[i]) + coef[i]
    for (let j = 0; j < acc.length; j++) {
      next[j + 1] = next[j + 1]! + acc[j]!;
      next[j] = next[j]! - acc[j]! * nodes[i]!;
    }
    next[0] = next[0]! + coef[i]!;
    acc = next;
  }
  for (let j = 0; j <= degree; j++) grades[j] = acc[j]!;
  const g0 = evalPoly(0);
  const idealValue = evalPoly(1);
  const idealEngineValue = noisyExpectation(model, energyOf, params, { depolarizingPerLayer: 0, readoutFlip: 0 });
  return { n, p, degree, grades, maxResidual, g0, idealValue, idealEngineValue };
}

/**
 * The decision procedure of the retraining question: once the grades are
 * known, the noisy objective at ANY eps is one polynomial evaluation, and
 * schedule comparisons are exact univariate comparisons sum_k a^k (g_k - g'_k).
 */
export function noisyObjectiveFromGrades(grades: NoiseGrades, eps: number): number {
  const a = shrinkFactor(eps);
  let acc = 0;
  for (let k = grades.degree; k >= 0; k--) acc = acc * a + grades.grades[k]!;
  return acc;
}

// ---------------------------------------------------------------------------
// F2: the readout Walsh-filter identity.
// ---------------------------------------------------------------------------

/**
 * Spectral closed form of the observed expectation:
 * <C>_obs(q) = sum_S (1-2q)^{|S|} cHat(S) <chi_S> — exact for ANY base
 * distribution (noisy or ideal): the flip channel acts the same way on
 * whatever distribution the circuit produced.
 */
export function spectralObservedExpectation(energyOf: Float64Array, probs: Float64Array, q: number): number {
  const dim = energyOf.length;
  requireThat(probs.length === dim, "PROB_LENGTH_MISMATCH", `probability vector length must equal the energy table ${dim}, got ${probs.length}`);
  requireThat(q >= 0 && q <= 1, "READOUT_Q_INVALID", `readout flip probability out of [0,1]: ${q}`);
  const n = Math.log2(dim);
  requireThat(Number.isInteger(n), "QUBIT_COUNT_INVALID", `table lengths must be powers of two, got ${dim}`);
  // Both spectra via the fast Hadamard transform of copies — the transform
  // route, independent of both the flip-convolution engine and the direct
  // summation spectrum.
  const f = energyOf.slice();
  const p = probs.slice();
  fastHadamard(f, n);
  fastHadamard(p, n);
  const lam = 1 - 2 * q;
  let acc = 0;
  for (let S = 0; S < dim; S++) acc += Math.pow(lam, popcount(S)) * f[S]! * p[S]!;
  return acc / dim;
}

export interface ReadoutFilterReport {
  /** w_k = sum_{|S|=k} cHat(S) <chi_S>, k = 0..n: the grouped coefficients. */
  readonly w: number[];
  /** All w_k >= 0 for k >= 1 — the exact "only rescales" criterion. */
  readonly onlyRescales: boolean;
  /** Worst |engine(q) - spectral(q)| over the q grid (two independent algebras). */
  readonly maxFilterGap: number;
  /** Highest k with w_k != 0 — <= 2 for any 2-local cost. */
  readonly effectiveDegree: number;
}

/**
 * The F2 verdict for one schedule: grouped Walsh-filter coefficients, the
 * monotonicity criterion ("readout only rescales, never bends" upgraded from
 * exp4's empirical statement to an exact per-instance criterion), and the
 * engine-vs-spectrum pairing over a q grid.
 */
export function readoutFilterReport(
  model: IsingModel,
  energyOf: Float64Array,
  params: QaoaParams,
  qGrid: readonly number[],
): ReadoutFilterReport {
  const n = model.n;
  const dim = 1 << n;
  requireThat(qGrid.length > 0, "SHRINK_Q_GRID_INVALID", "an empty q grid verifies nothing");
  const probs = idealProbs(model, energyOf, params);
  const spec = walshSpectrumDirect(energyOf, n);
  // Correlators via the transform route (cross-paired with the direct-sum
  // spectrum above): P-hat(S) = FHT(probs)[S].
  const phat = probs.slice();
  fastHadamard(phat, n);
  const w: number[] = new Array<number>(n + 1).fill(0);
  for (let S = 0; S < dim; S++) {
    const k = popcount(S);
    w[k] = w[k]! + spec[S]! * phat[S]!;
  }
  let onlyRescales = true;
  for (let k = 1; k <= n; k++) {
    if (w[k]! < 0) {
      onlyRescales = false;
      break;
    }
  }
  let maxFilterGap = 0;
  for (const q of qGrid) {
    requireThat(q >= 0 && q <= 1, "READOUT_Q_INVALID", `readout flip probability out of [0,1]: ${q}`);
    const obs = applyReadoutFlips(probs, n, q);
    let eng = 0;
    for (let s = 0; s < dim; s++) eng += obs[s]! * energyOf[s]!;
    const spec2 = spectralObservedExpectation(energyOf, probs, q);
    maxFilterGap = Math.max(maxFilterGap, Math.abs(eng - spec2));
  }
  let effectiveDegree = 0;
  for (let k = 0; k <= n; k++) {
    if (Math.abs(w[k]!) > 0) effectiveDegree = k;
  }
  return { w, onlyRescales, maxFilterGap, effectiveDegree };
}

// ---------------------------------------------------------------------------
// Anti-smuggling gate for the shrink face.
// ---------------------------------------------------------------------------

export interface ShrinkClaim {
  readonly instanceId: string;
  readonly eps: number;
  /** Claim: the terminal-shrink identity holds for this instance/schedule. */
  readonly claimedTerminalIdentity: boolean;
  /** Claim: worst |engine - closed form| gap, as the claimant reports it. */
  readonly claimedMaxGap: number;
}

export interface ShrinkClaimVerdict {
  readonly accepted: boolean;
  readonly reasons: string[];
}

/**
 * Machine trial of a shrink claim: (1) the claimed gap must match the
 * actually-measured one (an understated gap is a forged report); (2) an
 * identity claim is only accepted in the regime the decidable predicate
 * names — claiming it in the interleaved regime is convicted with the
 * measured gap; (3) denying the identity where it provably holds understates
 * the data. Rejections name the instance and the offense.
 */
export function verifyShrinkClaim(
  claim: ShrinkClaim,
  model: IsingModel,
  energyOf: Float64Array,
  params: QaoaParams,
  gapTolerance: number,
): ShrinkClaimVerdict {
  const reasons: string[] = [];
  const report = shrinkExchangeReport(model, energyOf, params, claim.eps);
  if (claim.claimedMaxGap + gapTolerance < report.maxClosedFormGap) {
    reasons.push(
      `${claim.instanceId}: FORGED gap — claimed ${claim.claimedMaxGap.toExponential(2)} vs measured ${report.maxClosedFormGap.toExponential(2)} (tolerance ${gapTolerance.toExponential(0)})`,
    );
  }
  if (claim.claimedTerminalIdentity && !report.regime.commuting) {
    reasons.push(
      `${claim.instanceId}: MISCLAIMED identity — regime is ${report.regime.reason} (interacting cost with a nontrivial mixer between noise layers); measured gap ${report.maxClosedFormGap.toExponential(2)}`,
    );
  }
  if (claim.claimedTerminalIdentity && report.regime.commuting && report.maxClosedFormGap > gapTolerance) {
    reasons.push(
      `${claim.instanceId}: identity claim fails its own regime — commuting (${report.regime.reason}) but measured gap ${report.maxClosedFormGap.toExponential(2)} exceeds tolerance (engine/closed-form bug class)`,
    );
  }
  if (!claim.claimedTerminalIdentity && report.regime.commuting && report.maxClosedFormGap <= gapTolerance) {
    reasons.push(
      `${claim.instanceId}: claim understates the theorem — regime is ${report.regime.reason} and the identity holds exactly here (measured gap ${report.maxClosedFormGap.toExponential(2)})`,
    );
  }
  return { accepted: reasons.length === 0, reasons };
}
