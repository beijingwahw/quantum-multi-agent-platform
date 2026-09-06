/**
 * Postselection ledger — the machine certificate behind the atlas entry
 * `postselect-sort` (genealogy family).
 *
 * Claim on trial: "the many-worlds sorter — postselection reads the marked
 * item deterministically, complexity O(1); the cost is the depreciation of
 * the other universes."
 *
 * The machine splits the claim into its two faces and executes both:
 *   A. CERTAINTY-IN-BRANCH (true): H^{n}|0>, ONE oracle query, postselect
 *      the flag register on 1 — the conditional address state is EXACTLY the
 *      marked set, fidelity 1.000000000000 with |x*> when one item is marked.
 *   B. THE DEPRECIATION LEDGER (the price): P_success = t/N exactly, so one
 *      heralded readout costs 1/P_success = N/t expected oracle queries —
 *      at par with classical random search and strictly worse than Grover's
 *      ~ (pi/4)*sqrt(N/t) queries (same repo, exact machinery). Amortized,
 *      the sorter pays classical-random rates; only the accounting category
 *      moved from "queries" to "rejected branches".
 *   C. COUNTING POWER IN-BRANCH (why anyone wanted it): postselected branch
 *      weights equal conditional counting ratios |{g AND h}|/|{g}| in closed
 *      form — the executable face of PostBQP = PP (AAR04, cited not proven).
 *      The branch weight P_success = |{g}|/2^n is the same coin's other side.
 *
 * All numbers are exact state-vector/amplitude algebra — no sampling appears
 * anywhere in a theorem claim.
 */
import { groverSuccessClosedForm, groverTheta } from "../upper/grover.js";

export interface PostselectSearch {
  readonly n: number;
  readonly N: number;
  /** number of marked items t */
  readonly t: number;
  /** postselection success probability, summed from the post-oracle state vector */
  readonly pSuccess: number;
  /** closed form t/N — the two must agree to machine precision */
  readonly pSuccessClosedForm: number;
  /** |<x*|psi_cond>|^2 for the single marked item (deterministic readout certificate) */
  readonly conditionalFidelity: number;
  /** 1/P_success: expected oracle queries per heralded readout */
  readonly expectedRepetitions: number;
  /** Grover-with-restart expected queries at the certain-answer standard: min_k (k+1)/p_k */
  readonly groverRestartQueries: number;
  /** the restart-optimal iteration count */
  readonly groverRestartK: number;
  /** classical random search, expected oracle queries to a marked item */
  readonly classicalExpectedQueries: number;
}

/**
 * Execute the many-worlds sorter on one instance: address register of n
 * qubits, flag register marking a subset, single oracle query, postselect.
 * The flag register is kept as an explicit pair of branch vectors so every
 * reported number is read off amplitudes, not formulas.
 */
export function postselectSearch(n: number, marked: readonly number[]): PostselectSearch {
  const N = 2 ** n;
  const t = marked.length;
  if (t === 0) throw new Error("postselectSearch: need at least one marked item");
  for (const x of marked) {
    if (!Number.isInteger(x) || x < 0 || x >= N) {
      throw new Error(`postselectSearch: marked address ${x} outside the ${n}-qubit address space [0, ${N})`);
    }
  }
  const markedSet = new Set(marked);

  // |psi> = H^{n}|0> (x)|0>_flag, then the oracle moves marked amplitudes
  // into the flag=1 branch: one query, everything else untouched.
  const branch0 = new Float64Array(N);
  const branch1 = new Float64Array(N);
  const amp = 1 / Math.sqrt(N);
  for (let x = 0; x < N; x++) {
    if (markedSet.has(x)) branch1[x] = amp;
    else branch0[x] = amp;
  }

  // P_success read off the branch weight
  let pSuccess = 0;
  for (let x = 0; x < N; x++) pSuccess += branch1[x]! ** 2;

  // conditional address state: branch1 / sqrt(P_success) — uniform over the
  // marked set, EXACTLY |x*> when t = 1.
  const norm = Math.sqrt(pSuccess);
  let conditionalFidelity = Number.NaN;
  if (t === 1) {
    const xStar = marked[0] as number;
    const ampStar = branch1[xStar]! / norm;
    conditionalFidelity = ampStar ** 2;
  }

  // Grover compared at the SAME standard the sorter claims — a certain answer:
  // k iterations + 1 verification query, restart on failure; expected queries
  // (k+1)/p_k, minimized over k. k = 0 is the pure random guess, so E* can
  // never exceed the classical rate — equality is attainable, advantage is the gap.
  const theta = groverTheta(N, t);
  const hi = Math.ceil(Math.PI / (4 * theta)) + 3;
  let groverRestartQueries = Number.POSITIVE_INFINITY;
  let groverRestartK = 0;
  for (let k = 0; k <= hi; k++) {
    const p = groverSuccessClosedForm(N, t, k);
    if (p <= 0) continue;
    const e = (k + 1) / p;
    if (e < groverRestartQueries) {
      groverRestartQueries = e;
      groverRestartK = k;
    }
  }

  return {
    n,
    N,
    t,
    pSuccess,
    pSuccessClosedForm: t / N,
    conditionalFidelity,
    expectedRepetitions: 1 / pSuccess,
    groverRestartQueries,
    groverRestartK,
    classicalExpectedQueries: N / t,
  };
}

export interface PostselectCount {
  readonly n: number;
  readonly N: number;
  /** P(flag = 1) = |{g}|/N, read off the branch weight */
  readonly pSuccess: number;
  /** P(h = 1 | flag = 1) read off the postselected branch amplitudes */
  readonly conditionalRatio: number;
  /** brute-force |{g AND h}|/|{g}| */
  readonly bruteRatio: number;
  /** |conditionalRatio - bruteRatio| — must be float zero */
  readonly deviation: number;
}

/**
 * Execute the counting face: predicates g (postselection flag) and h (readout
 * bit) over n qubits. The postselected branch reads the conditional counting
 * ratio |{g AND h}|/|{g}| in closed form — the amplitude-level content of
 * PostBQP = PP — while the branch weight |{g}|/N is the price of entering it.
 */
export function postselectCount(n: number, g: readonly boolean[], h: readonly boolean[]): PostselectCount {
  const N = 2 ** n;
  if (g.length !== N || h.length !== N) throw new Error("postselectCount: predicate tables must have length 2^n");
  const amp = 1 / Math.sqrt(N);
  let weight = 0; // |{g}|/N, accumulated through float amplitudes
  let joint = 0; // |{g AND h}|/N, same path
  for (let x = 0; x < N; x++) {
    if (!g[x]) continue;
    weight += amp * amp;
    if (h[x]) joint += amp * amp;
  }
  const conditionalRatio = joint / weight;
  // brute-force referee on a DIFFERENT arithmetic path: exact integer counts,
  // rational ratio — so agreement is a check, not a tautology
  let cntG = 0;
  let cntGH = 0;
  for (let x = 0; x < N; x++) {
    if (!g[x]) continue;
    cntG++;
    if (h[x]) cntGH++;
  }
  const bruteRatio = cntGH / cntG;
  return {
    n,
    N,
    pSuccess: weight,
    conditionalRatio,
    bruteRatio,
    deviation: Math.abs(conditionalRatio - bruteRatio),
  };
}
