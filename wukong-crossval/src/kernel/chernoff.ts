/**
 * The information bound (X9) — the floor under every discriminator, priced
 * row by row against the 2-sigma statistic X8 already ships.
 *
 * Claim (exact): on the Hamming-shell face — one shell label per shot, the
 * face X8's own statistic consumes — no N-shot discriminator of readout
 * flips vs global depolarizing (both fitted to the same observed hit rate)
 * has error probability below (1/2) e^{-N C(P,Q)}, where C(P,Q) is the
 * Chernoff information -min_{0<=s<=1} log sum_i p_i^s q_i^{1-s} of the two
 * shell distributions. The objective is convex in s (Holder), so a golden-
 * section minimum in log space is exact to machine precision; N_info =
 * ln(2/delta)/C is the floor's own budget for error <= delta, and the
 * table prices X8's 2-sigma shell-1 budget against it, row by row.
 *
 * Boundary (stated, not hidden): the bound governs the shell-label face.
 * The full bitstring face is not enumerable at n=20 (4^20 terms), and both
 * models concentrate their disagreement exactly on the shell predictions —
 * the floor quoted is the floor of the face the pipeline actually reads.
 * Operating points where the depolarizing fit is unphysical (lambda > 1)
 * are separated by sign outright (X8's own finding) and carry no bound
 * columns — reported as found, never invented. Where the two shell
 * distributions coincide (C -> 0) the bound is infinite and the row is
 * rejected by name: nothing ships, the degeneracy itself is the finding.
 */
import { choose, exactObservedHitRate, flipKernel } from "./robust.js";
import { fitDepolarizing, fitReadoutFlip } from "./discriminate.js";
import { makeRng } from "./crossval.js";
import { XvalError } from "./error.js";

/** A vanishing Chernoff information below this is a degenerate (coincident)
 * shell pair, not a small positive floor — the bound is infinite. */
export const CHERNOFF_ZERO = 1e-14;
/** the error budget the bound column quotes (aligned with alpha = 0.05) */
export const CHERNOFF_DELTA = 0.05;

/** The readout model's shell distribution at flip level f: one flip-kernel
 * pass, P_d = sum_{d'} mass(d') * T_{d'->d} — exact, no Monte Carlo. */
export function readoutShellDist(masses: Float64Array, f: number): Float64Array {
  const n = masses.length - 1;
  const T = flipKernel(n, f);
  const out = new Float64Array(n + 1);
  for (let d = 0; d <= n; d++) for (let j = 0; j <= n; j++) out[j]! += masses[d]! * T[d]![j]!;
  return out;
}

/** The depolarizing model's shell distribution at mixing lambda: Q_d =
 * lambda * mass(d) + (1-lambda) * C(n,d)/2^n (each shell dragged toward its
 * uniform weight by the same 1-lambda). */
export function depolShellDist(masses: Float64Array, lambda: number): Float64Array {
  const n = masses.length - 1;
  const out = new Float64Array(n + 1);
  for (let d = 0; d <= n; d++) out[d] = lambda * masses[d]! + (1 - lambda) * (choose(n, d) / 2 ** n);
  return out;
}

/** g(s) = log sum_i p_i^s q_i^{1-s} in log-sum-exp form. Interior s only
 * (golden-section probe points never touch 0 or 1, where 0 * log 0 would
 * poison the arithmetic); terms with both probabilities zero contribute 0
 * on the open interval and are skipped. */
function logChernoffSum(p: Float64Array, q: Float64Array, s: number): number {
  const terms: number[] = [];
  let m = -Infinity;
  for (let i = 0; i < p.length; i++) {
    const pi = p[i]!;
    const qi = q[i]!;
    if (pi === 0 && qi === 0) continue;
    const t = s * Math.log(pi) + (1 - s) * Math.log(qi);
    terms.push(t);
    if (t > m) m = t;
  }
  let sum = 0;
  for (const t of terms) sum += Math.exp(t - m);
  return m + Math.log(sum);
}

/** The Chernoff information and its attaining s*: golden section over the
 * convex log-sum-exp objective on [0,1], to interval width 1e-13. g is
 * symmetric under (p,q,s) -> (q,p,1-s), so C(P,Q) = C(Q,P) exactly. */
export function chernoffInformation(p: Float64Array, q: Float64Array): { info: number; sStar: number } {
  if (p.length !== q.length || p.length < 1) {
    throw new XvalError("XVAL_MASSES_SHAPE", `chernoffInformation: the two shell distributions must carry the same n+1 >= 1 entries, got ${String(p.length)} vs ${String(q.length)}`);
  }
  const g = (s: number): number => logChernoffSum(p, q, s);
  const invPhi = (Math.sqrt(5) - 1) / 2;
  let lo = 0;
  let hi = 1;
  let c = hi - invPhi * (hi - lo);
  let d = lo + invPhi * (hi - lo);
  let fc = g(c);
  let fd = g(d);
  while (hi - lo > 1e-13) {
    if (fc < fd) {
      hi = d;
      d = c;
      fd = fc;
      c = hi - invPhi * (hi - lo);
      fc = g(c);
    } else {
      lo = c;
      c = d;
      fc = fd;
      d = lo + invPhi * (hi - lo);
      fd = g(d);
    }
  }
  const sStar = (lo + hi) / 2;
  return { info: -g(sStar), sStar };
}

/** The floor's own budget: N >= ln(2/delta)/C forces every discriminator's
 * error below delta. A coincident pair (C ~ 0) is rejected by name — the
 * bound is infinite and no budget column may ship for it. */
export function minShotsInformation(info: number, delta: number): number {
  if (!(0 < delta && delta < 1)) throw new XvalError("XVAL_MINSHOTS_LEVEL", `minShotsInformation: delta must be in (0,1), got ${String(delta)}`);
  if (!(info > CHERNOFF_ZERO)) {
    throw new XvalError("XVAL_CHERNOFF_DEGENERATE", `minShotsInformation: the two shell distributions coincide at this operating point (Chernoff information ${String(info)} <= ${String(CHERNOFF_ZERO)}) — no statistic on the shell face separates them at any budget; the degeneracy is the finding, not a number`);
  }
  return Math.ceil(Math.log(2 / delta) / info);
}

export interface ChernoffRow {
  readonly instanceId: string;
  readonly n: number;
  readonly depth: number;
  readonly flip: number;
  /** the operating point: the readout model's predicted observed hit rate */
  readonly r: number;
  readonly fitFlip: number;
  readonly fitLambda: number;
  readonly depolPhysical: boolean;
  /** Chernoff information of the fitted shell pair; null on sign-separated rows */
  readonly chernoff: number | null;
  readonly sStar: number | null;
  /** the floor's budget for error <= delta; null on sign-separated rows */
  readonly nInfo: number | null;
  /** X8's shell-1 statistic's own 2-sigma budget 4*worst*(1-worst)/gap^2; null on sign-separated rows */
  readonly nTwoSigma: number | null;
  /** nTwoSigma / nInfo — the 2-sigma statistic's price relative to the floor */
  readonly efficiency: number | null;
}

/** One X9 row at one operating point: both models fitted as X8 fits them
 * (local bracket readout fit, exact depolarizing inversion), the Chernoff
 * information of the fitted shell pair, and the two budgets side by side. */
export function chernoffRow(
  masses: Float64Array,
  meta: { instanceId: string; n: number; depth: number },
  flip: number,
  delta: number,
): ChernoffRow {
  const p0 = masses[0]!;
  const r = exactObservedHitRate(masses, flip);
  const { fit } = fitReadoutFlip(masses, r, flip);
  const lam = fitDepolarizing(p0, meta.n, r);
  const physical = lam >= 0 && lam <= 1;
  const base = { instanceId: meta.instanceId, n: meta.n, depth: meta.depth, flip, r, fitFlip: fit, fitLambda: lam, depolPhysical: physical };
  if (!physical) {
    // lambda > 1: no depolarizing drift reproduces an inflated rate — the
    // sign separates the models outright and the bound columns do not exist
    return { ...base, chernoff: null, sStar: null, nInfo: null, nTwoSigma: null, efficiency: null };
  }
  const p = readoutShellDist(masses, fit);
  const q = depolShellDist(masses, lam);
  const { info, sStar } = chernoffInformation(p, q);
  const nInfo = minShotsInformation(info, delta); // rejects the coincident pair by name
  const shell1P = p[1]!;
  const shell1Q = q[1]!;
  const gap = Math.abs(shell1P - shell1Q);
  const worst = Math.max(shell1P, shell1Q);
  const nTwoSigma = Math.ceil((4 * worst * (1 - worst)) / (gap * gap));
  return { ...base, chernoff: info, sStar, nInfo, nTwoSigma, efficiency: nTwoSigma / nInfo };
}

/** The MC-under-either-truth demonstration's fixed arguments (single-sourced
 * for the witness, the report, and the test suite — one demo, not three). */
export const MC_CHERNOFF_DEMO = { probeId: "np-n12-4", depth: 1, flip: 0.05, shotsPerTrial: 40, trials: 2000, seed: 9 } as const;

/** Monte Carlo demonstration: the LIKELIHOOD-RATIO discriminator (the
 * optimal one — any other statistic only pays more) run on N-shot shell
 * samples drawn from each model, its empirical error compared with the
 * bound (1/2) e^{-N C}. The empirical error must sit at or above the bound
 * within MC fluctuation; falling below would falsify the theorem. */
export function mcChernoffDemo(
  p: Float64Array,
  q: Float64Array,
  shotsPerTrial: number,
  trials: number,
  seed: number,
): { empiricalError: number; bound: number; sigma: number } {
  if (!Number.isInteger(shotsPerTrial) || shotsPerTrial < 1 || !Number.isInteger(trials) || trials < 1) {
    throw new XvalError("XVAL_SHOTS_RANGE", `mcChernoffDemo: shotsPerTrial and trials must be integers >= 1, got ${String(shotsPerTrial)} / ${String(trials)}`);
  }
  const { info } = chernoffInformation(p, q);
  const logRatio = new Float64Array(p.length);
  for (let i = 0; i < p.length; i++) logRatio[i] = Math.log(p[i]!) - Math.log(q[i]!);
  const rng = makeRng(seed);
  const sampleLabel = (dist: Float64Array): number => {
    const u = rng();
    let acc = 0;
    for (let i = 0; i < dist.length; i++) {
      acc += dist[i]!;
      if (u < acc) return i;
    }
    return dist.length - 1; // floating-point tail: the last cell absorbs it
  };
  let wrong = 0;
  for (let t = 0; t < trials; t++) {
    const truthIsP = t % 2 === 0;
    const dist = truthIsP ? p : q;
    let ll = 0;
    for (let k = 0; k < shotsPerTrial; k++) ll += logRatio[sampleLabel(dist)]!;
    const guessedP = ll > 0;
    if (guessedP !== truthIsP) wrong++;
  }
  const empiricalError = wrong / trials;
  const bound = 0.5 * Math.exp(-shotsPerTrial * info);
  const sigma = Math.sqrt((empiricalError * (1 - empiricalError)) / trials);
  return { empiricalError, bound, sigma };
}
