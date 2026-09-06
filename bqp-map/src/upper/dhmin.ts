/**
 * Durr-Hoyer minimum finding (quant-ph/9607014) with the BBHT variable-
 * iteration inner search, executed honestly:
 *
 *  - every Grover iteration spends exactly one oracle query (counted),
 *  - the post-measurement comparison spends one more query (counted),
 *  - the measurement itself samples the exact Born distribution of the
 *    evolved state (no closed-form shortcut), and
 *  - the inner search retries with geometrically growing iteration budgets
 *    until either a smaller element is found or the budget passes c*sqrt(N),
 *    at which point the current threshold is declared minimal.
 *
 * The referee checks (a) the returned index attains the true minimum against
 * exhaustive classical evaluation, and (b) the query count scales as
 * sqrt(N), never N. This is the machine certificate behind every HW-WAIT
 * (quadratic, waiting on hardware) atlas entry.
 */
import type { Rng } from "../core/rng.js";

export interface DhResult {
  index: number;
  value: number;
  queries: number;
  optimal: boolean;
}

export interface Valuation {
  readonly N: number;
  /** The comparison oracle: value of index x. One call = one query. */
  valueAt(x: number): number;
  /** Direct array access when the valuation is explicit (for referees). */
  toArray(): readonly number[];
}

export function arrayValuation(vals: readonly number[]): Valuation {
  return {
    N: vals.length,
    valueAt: (x: number) => vals[x] as number,
    toArray: () => vals,
  };
}

/** Sample an index from |psi|^2 given the raw amplitudes. */
function bornSample(amps: readonly number[], rng: Rng): number {
  let total = 0;
  for (const a of amps) total += a * a;
  let r = rng.next() * total;
  for (let i = 0; i < amps.length; i++) {
    r -= (amps[i] as number) ** 2;
    if (r <= 0) return i;
  }
  return amps.length - 1;
}

/** Run j Grover iterations (oracle: value < threshold) from the uniform state; return final amps. */
function groverAmps(val: Valuation, thresholdValue: number, j: number): number[] {
  const N = val.N;
  const amps = new Array<number>(N).fill(1 / Math.sqrt(N));
  for (let iter = 0; iter < j; iter++) {
    for (let x = 0; x < N; x++) {
      if (val.valueAt(x) < thresholdValue) amps[x] = -(amps[x] as number);
    }
    let mean = 0;
    for (const a of amps) mean += a;
    mean /= N;
    for (let i = 0; i < N; i++) amps[i] = 2 * mean - (amps[i] as number);
  }
  return amps;
}

export function dhMin(val: Valuation, rng: Rng): DhResult {
  const N = val.N;
  const cap = Math.ceil(Math.sqrt(N)); // BBHT ladder ceiling
  let queries = 0;

  let thresholdIndex = rng.int(N);
  let thresholdValue = val.valueAt(thresholdIndex);
  queries += 1; // reading the seed threshold

  for (;;) {
    // BBHT inner search for some x with value < thresholdValue:
    // geometric ladder m -> ceil(8m/7) capped at ceil(sqrt(N)), then a few
    // retries in the [cap/2, cap) iteration band where marked items are found
    // with constant probability per attempt.
    let m = 1;
    let found = false;
    while (m <= cap) {
      const j = rng.int(m) + (m >= 2 ? rng.int(m) : 0); // j in [0, 2m) once m >= 2
      const amps = groverAmps(val, thresholdValue, j);
      queries += j; // j oracle queries for the j iterations
      const sampled = bornSample(amps, rng);
      queries += 1; // compare sampled value against threshold
      const v = val.valueAt(sampled);
      if (v < thresholdValue) {
        thresholdIndex = sampled;
        thresholdValue = v;
        found = true;
        break;
      }
      m = Math.min(Math.ceil((8 * m) / 7), cap);
      if (m === cap) m = cap + 1; // hand the cap band to the retry phase
    }
    if (found) continue;
    let late = false;
    for (let r = 0; r < 8; r++) {
      const j = Math.floor(cap / 2) + rng.int(Math.max(1, cap - Math.floor(cap / 2)));
      const amps = groverAmps(val, thresholdValue, j);
      queries += j;
      const sampled = bornSample(amps, rng);
      queries += 1;
      const v = val.valueAt(sampled);
      if (v < thresholdValue) {
        thresholdIndex = sampled;
        thresholdValue = v;
        late = true;
        break;
      }
    }
    if (!late) break; // no element below threshold found: declare minimum
  }

  const values = val.toArray();
  let trueMin = Infinity;
  for (const v of values) trueMin = Math.min(trueMin, v);
  return {
    index: thresholdIndex,
    value: thresholdValue,
    queries,
    optimal: thresholdValue === trueMin,
  };
}
