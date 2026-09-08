import { reject } from "../core/errors.js";
import { groverSuccessClosedForm } from "../ae/ampest.js";
/**
 * BBHT variable-iteration schedule (single source, v0.3.0 face C): both search
 * entry points draw k uniform in [0, kMax] with kMax = ceil(sqrt(n)) (at least
 * 1), retrying GROVER_ATTEMPTS times. Previously kMax, the attempt count and
 * the reads formula were duplicated verbatim in groverFindBetter and
 * groverFindMarked; the arithmetic here is unchanged (bit-identical ledgers).
 */
const GROVER_ATTEMPTS = 8;
function bbhtKMax(n) {
    return Math.max(1, Math.ceil(Math.sqrt(n)));
}
/** Oracle reads of one k-iteration Grover sweep: 2k iterations + 1 verification read. */
function sweepReads(k) {
    return 2 * k + 1;
}
/** Linear scan for the minimum under a strict-less comparator; reads = N. */
export function linearFindBest(scores, less) {
    // v0.3.0: an empty table used to fabricate index 0 — a witness invented out
    // of nothing. Named rejection instead.
    if (scores.length === 0)
        reject("GROVER_EMPTY_SCORES", "linearFindBest: scores must be non-empty");
    let best = 0;
    for (let i = 1; i < scores.length; i++) {
        if (less(scores[i], scores[best]))
            best = i;
    }
    return { index: best, reads: scores.length };
}
/**
 * Durr-Hoyer style search for a strictly-better element than the threshold
 * value, with retry schedule uniform k in [0, ceil(sqrt(N))]. Returns the
 * index of the new threshold holder, or -1 if no better element was found
 * (bounded error: a better element may exist but was missed).
 */
export function groverFindBetter(n, thresholdValue, value, less, rng) {
    if (!Number.isInteger(n) || n < 1)
        reject("GROVER_N_RANGE", "n >= 1 items to search");
    const kMax = bbhtKMax(n);
    for (let attempt = 0; attempt < GROVER_ATTEMPTS; attempt++) {
        const k = rng.int(kMax + 1);
        const reads = sweepReads(k);
        // Exact Grover outcome: we need the marked set to sample uniformly.
        const marked = [];
        for (let i = 0; i < n; i++)
            if (less(value(i), thresholdValue))
                marked.push(i);
        const t = marked.length;
        if (t === 0)
            return { index: -1, reads };
        const success = groverSuccessClosedForm(t / n, k);
        if (rng.next() < success) {
            return { index: marked[rng.int(t)], reads };
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
export function durHoyerFindBest(scores, less, rng) {
    if (scores.length === 0)
        reject("GROVER_EMPTY_SCORES", "durHoyerFindBest: scores must be non-empty");
    const n = scores.length;
    const value = (i) => scores[i];
    let threshold = rng.int(n);
    let reads = 1;
    for (let guard = 0; guard < 4 * n; guard++) {
        const r = groverFindBetter(n, value(threshold), value, less, rng);
        reads += r.reads;
        if (r.index < 0)
            break;
        threshold = r.index;
    }
    const trueBest = linearFindBest(scores, less).index;
    return { best: threshold, reads, correct: threshold === trueBest };
}
/** Linear scan for any marked element; reads = N. Used per-arrival in matching. */
export function linearFindMarked(n, isMarked) {
    if (!Number.isInteger(n) || n < 1)
        reject("GROVER_N_RANGE", "n >= 1 items to search");
    for (let i = 0; i < n; i++)
        if (isMarked(i))
            return { index: i, reads: i + 1 };
    return { index: -1, reads: n };
}
/** Grover search for any marked element (bounded error, exact sampling); reads ledger. */
export function groverFindMarked(n, isMarked, rng) {
    if (!Number.isInteger(n) || n < 1)
        reject("GROVER_N_RANGE", "n >= 1 items to search");
    const kMax = bbhtKMax(n);
    // Counting pass is not needed by the algorithm; we enumerate only to draw
    // the outcome from the exact Grover distribution (the simulator's referee
    // privilege; the reads ledger charges only the Grover iterations).
    const marked = [];
    for (let i = 0; i < n; i++)
        if (isMarked(i))
            marked.push(i);
    const t = marked.length;
    if (t === 0)
        return { index: -1, reads: kMax };
    for (let attempt = 0; attempt < GROVER_ATTEMPTS; attempt++) {
        const k = rng.int(kMax + 1);
        const reads = sweepReads(k);
        const success = groverSuccessClosedForm(t / n, k);
        if (rng.next() < success) {
            return { index: marked[rng.int(t)], reads };
        }
    }
    return { index: -1, reads: GROVER_ATTEMPTS * sweepReads(kMax) };
}
