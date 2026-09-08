/**
 * Quantum search harness for online decision loops (Grover 1996;
 * Durr-Hoyer minimum finding, 1996; Boyyer-Brassard-Hoyer-Tapp variable
 * iterations). Bounded-error, exact same decision RULE as the linear scan;
 * the deliverable is the oracle-read ledger: O(N) vs O(sqrt(N) log N).
 *
 * Grover sampling is exact: with t marked of N and k iterations the success
 * probability is sin^2((2k+1) theta) with sin theta = sqrt(t/N), and a
 * successful measurement returns a uniformly random marked element. Both
 * facts are cross-checked against full-space Grover simulation in the tests.
 */
import type { Rng } from "../core/rng.js";
import { reject } from "../core/errors.js";
import { groverSuccessClosedForm } from "../ae/ampest.js";

export interface SearchResult {
  readonly index: number;
  readonly reads: number;
}

/**
 * BBHT variable-iteration schedule (single source, v0.3.0 face C): both search
 * entry points draw k uniform in [0, kMax] with kMax = ceil(sqrt(n)) (at least
 * 1), retrying GROVER_ATTEMPTS times. Previously kMax, the attempt count and
 * the reads formula were duplicated verbatim in groverFindBetter and
 * groverFindMarked; the arithmetic here is unchanged (bit-identical ledgers).
 */
const GROVER_ATTEMPTS = 8;

function bbhtKMax(n: number): number {
  return Math.max(1, Math.ceil(Math.sqrt(n)));
}

/** Oracle reads of one k-iteration Grover sweep: 2k iterations + 1 verification read. */
function sweepReads(k: number): number {
  return 2 * k + 1;
}

/** Linear scan for the minimum under a strict-less comparator; reads = N. */
export function linearFindBest<T>(scores: ArrayLike<T>, less: (x: T, y: T) => boolean): SearchResult {
  // v0.3.0: an empty table used to fabricate index 0 — a witness invented out
  // of nothing. Named rejection instead.
  if (scores.length === 0) reject("GROVER_EMPTY_SCORES", "linearFindBest: scores must be non-empty");
  let best = 0;
  for (let i = 1; i < scores.length; i++) {
    if (less(scores[i] as T, scores[best] as T)) best = i;
  }
  return { index: best, reads: scores.length };
}

/**
 * Durr-Hoyer style search for a strictly-better element than the threshold
 * value, with retry schedule uniform k in [0, ceil(sqrt(N))]. Returns the
 * index of the new threshold holder, or -1 if no better element was found
 * (bounded error: a better element may exist but was missed).
 */
export function groverFindBetter<T>(
  n: number,
  thresholdValue: T,
  value: (i: number) => T,
  less: (x: T, y: T) => boolean,
  rng: Rng,
): { index: number; reads: number } {
  if (!Number.isInteger(n) || n < 1) reject("GROVER_N_RANGE", "n >= 1 items to search");
  const kMax = bbhtKMax(n);
  for (let attempt = 0; attempt < GROVER_ATTEMPTS; attempt++) {
    const k = rng.int(kMax + 1);
    const reads = sweepReads(k);
    // Exact Grover outcome: we need the marked set to sample uniformly.
    const marked: number[] = [];
    for (let i = 0; i < n; i++) if (less(value(i), thresholdValue)) marked.push(i);
    const t = marked.length;
    if (t === 0) return { index: -1, reads };
    const success = groverSuccessClosedForm(t / n, k);
    if (rng.next() < success) {
      return { index: marked[rng.int(t)] as number, reads };
    }
  }
  return { index: -1, reads: GROVER_ATTEMPTS * sweepReads(kMax) };
}

/**
 * Durr-Hoyer minimum finding: repeatedly Grover-search for a strictly better
 * element than the current threshold. Returns {best, reads, correct}.
 * 'correct' compares against the true argmin (the harness knows it; the
 * algorithm does not). The linear scan is always correct; the quantum search
 * is bounded-error — agreement rates are reported, not assumed.
 */
export function durHoyerFindBest<T>(scores: ArrayLike<T>, less: (x: T, y: T) => boolean, rng: Rng): { best: number; reads: number; correct: boolean } {
  if (scores.length === 0) reject("GROVER_EMPTY_SCORES", "durHoyerFindBest: scores must be non-empty");
  const n = scores.length;
  const value = (i: number) => scores[i] as T;
  let threshold = rng.int(n);
  let reads = 1;
  for (let guard = 0; guard < 4 * n; guard++) {
    const r = groverFindBetter(n, value(threshold), value, less, rng);
    reads += r.reads;
    if (r.index < 0) break;
    threshold = r.index;
  }
  const trueBest = linearFindBest(scores, less).index;
  return { best: threshold, reads, correct: threshold === trueBest };
}

/** Linear scan for any marked element; reads = N. Used per-arrival in matching. */
export function linearFindMarked(n: number, isMarked: (i: number) => boolean): SearchResult {
  if (!Number.isInteger(n) || n < 1) reject("GROVER_N_RANGE", "n >= 1 items to search");
  for (let i = 0; i < n; i++) if (isMarked(i)) return { index: i, reads: i + 1 };
  return { index: -1, reads: n };
}

/** Grover search for any marked element (bounded error, exact sampling); reads ledger. */
export function groverFindMarked(n: number, isMarked: (i: number) => boolean, rng: Rng): SearchResult {
  if (!Number.isInteger(n) || n < 1) reject("GROVER_N_RANGE", "n >= 1 items to search");
  const kMax = bbhtKMax(n);
  // Counting pass is not needed by the algorithm; we enumerate only to draw
  // the outcome from the exact Grover distribution (the simulator's referee
  // privilege; the reads ledger charges only the Grover iterations).
  const marked: number[] = [];
  for (let i = 0; i < n; i++) if (isMarked(i)) marked.push(i);
  const t = marked.length;
  if (t === 0) return { index: -1, reads: kMax };
  for (let attempt = 0; attempt < GROVER_ATTEMPTS; attempt++) {
    const k = rng.int(kMax + 1);
    const reads = sweepReads(k);
    const success = groverSuccessClosedForm(t / n, k);
    if (rng.next() < success) {
      return { index: marked[rng.int(t)] as number, reads };
    }
  }
  return { index: -1, reads: GROVER_ATTEMPTS * sweepReads(kMax) };
}
