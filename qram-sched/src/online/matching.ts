/**
 * Online bipartite matching: tasks arrive online, workers are the known side
 * (Karp-Vazirani-Vazirani, STOC 1990).
 *
 * - Greedy with uniform tie-breaking: matches each arrival to a uniformly
 *   random available neighbor. Worst case 1/2 (cited).
 * - RANKING (KVV): a uniformly random permutation of workers; each arrival
 *   takes its available neighbor of best (lowest) rank. (1 - 1/e)-competitive
 *   and optimal among randomized algorithms (KVV 1990; Devanur-Jain-Kleinberg
 *   primal-dual proof, SODA 2013). Since v0.2.0 the KVV tight instances are
 *   EXECUTED in-repo (see kv-tight.ts, EXP6): E[RANKING on D_n] hits
 *   (1-1/e)n + 1 - 2/e exactly (three independent exact kernels), and the
 *   deterministic phase adversary pins greedy at exactly n/2.
 * - Quantum layer: the per-arrival inner search (best-ranked available
 *   neighbor) served by Durr-Hoyer Grover search instead of a linear scan.
 *   Same decision rule; reads O(n) -> O(sqrt(n) log n); bit-identical
 *   decisions whenever the bounded-error search does not miss (agreement
 *   rates reported). Competitive ratios are information-theoretic caps that
 *   quantum inner search cannot change.
 *
 * Referee: exact maximum matching via Kuhn's augmenting-path algorithm.
 */
import { Rng } from "../core/rng.js";
import { durHoyerFindBest, groverFindMarked } from "./grover.js";

export interface ObmInstance {
  /** Offline workers 0..n-1. */
  readonly n: number;
  /** Arrivals in order; each is a neighbor list over workers. */
  readonly arrivals: ReadonlyArray<readonly number[]>;
}

/** Exact maximum matching size of the final graph (Kuhn's algorithm). */
export function kuhnMaxMatching(inst: ObmInstance): number {
  const matchOfWorker = new Int32Array(inst.n).fill(-1);
  const tryAssign = (arrival: number, visited: Uint8Array): boolean => {
    const nb = inst.arrivals[arrival] as readonly number[];
    for (const w of nb) {
      if ((visited[w] as number) !== 0) continue;
      visited[w] = 1;
      if ((matchOfWorker[w] as number) === -1 || tryAssign(matchOfWorker[w] as number, visited)) {
        matchOfWorker[w] = arrival;
        return true;
      }
    }
    return false;
  };
  let size = 0;
  for (let a = 0; a < inst.arrivals.length; a++) {
    const visited = new Uint8Array(inst.n);
    if (tryAssign(a, visited)) size++;
  }
  return size;
}

export interface MatchResult {
  size: number;
  reads: number;
  /** For the quantum variant: number of arrivals where the search disagreed with the exact rule. */
  disagreements: number;
}

/** The cascade adversary: arrivals in pairs (v ~ {u_1, u_2}; w ~ {u_1}); greedy with
 *  lowest-index ties matches exactly half; uniform ties do better; ranking 3/4. */
export function cascadeInstance(pairs: number): ObmInstance {
  const n = 2 * pairs;
  const arrivals: number[][] = [];
  for (let i = 0; i < pairs; i++) {
    arrivals.push([2 * i, 2 * i + 1]);
    arrivals.push([2 * i]);
  }
  return { n, arrivals };
}

/** Erdos-Renyi arrival bank. */
export function randomInstance(n: number, arrivals: number, p: number, rng: Rng): ObmInstance {
  const list: number[][] = [];
  for (let a = 0; a < arrivals; a++) {
    const nb: number[] = [];
    for (let w = 0; w < n; w++) if (rng.next() < p) nb.push(w);
    list.push(nb);
  }
  return { n, arrivals: list };
}

/** Greedy matching. tie 'lowest'/'highest': deterministic first/last-available
 *  (worst case exactly 1/2, both tight via the phase adversary). tie
 *  'uniform': uniformly random available neighbor. mode 'grover' serves the
 *  uniform-tie variant via Grover sampling (distribution-identical) or falls
 *  back to the exact rule on bounded-error misses (charged). */
export function greedyMatch(inst: ObmInstance, rng: Rng, mode: "linear" | "grover", tie: "lowest" | "uniform" | "highest" = "uniform"): MatchResult {
  const taken = new Uint8Array(inst.n);
  let size = 0;
  let reads = 0;
  let disagreements = 0;
  for (const nb of inst.arrivals) {
    const isAvail = (w: number) => (taken[w] as number) === 0 && nb.includes(w);
    if (mode === "linear") {
      reads += inst.n;
      const available = nb.filter((w) => (taken[w] as number) === 0);
      if (available.length === 0) continue;
      const w =
        tie === "lowest"
          ? (available[0] as number)
          : tie === "highest"
            ? (available[available.length - 1] as number)
            : (available[rng.int(available.length)] as number);
      taken[w] = 1;
      size++;
    } else {
      const r = groverFindMarked(inst.n, isAvail, rng);
      reads += r.reads;
      // Referee check: the returned worker must be an available neighbor (Grover
      // never invents items; a miss returns -1 and the arrival is skipped only
      // when the marked set is truly empty up to bounded error).
      if (r.index >= 0 && isAvail(r.index)) {
        taken[r.index] = 1;
        size++;
      } else if (r.index >= 0) {
        disagreements++;
      } else {
        // bounded-error miss: fall back to the exact rule to keep the decision
        // rule identical, charging the linear cost
        const available = nb.filter((w) => (taken[w] as number) === 0);
        reads += inst.n;
        if (available.length > 0) {
          const w = available[rng.int(available.length)] as number;
          taken[w] = 1;
          size++;
          disagreements++;
        }
      }
    }
  }
  return { size, reads, disagreements };
}

/** RANKING: random permutation of workers, arrivals take best-ranked available neighbor. */
export function rankingMatch(inst: ObmInstance, rng: Rng, mode: "linear" | "grover"): MatchResult {
  const rank = rng.shuffle(Array.from({ length: inst.n }, (_, i) => i));
  return rankingMatchWithRank(inst, rank, mode, rng);
}

/**
 * RANKING core under an explicit worker ranking: rank[w] = the position of
 * worker w (lower = better); each arrival takes its available neighbor of
 * best rank. 'linear' consumes no randomness beyond the given ranking;
 * 'grover' draws from rng inside the Durr-Hoyer search. The split exists so
 * exact enumerators (kv-tight) can drive the same decision rule.
 */
export function rankingMatchWithRank(
  inst: ObmInstance,
  rank: readonly number[],
  mode: "linear" | "grover",
  rng: Rng,
): MatchResult {
  const taken = new Uint8Array(inst.n);
  let size = 0;
  let reads = 0;
  let disagreements = 0;
  for (const nb of inst.arrivals) {
    const adjSet = new Set(nb);
    const value = (w: number) => ((taken[w] as number) === 0 && adjSet.has(w) ? (rank[w] as number) : Number.MAX_SAFE_INTEGER);
    if (mode === "linear") {
      reads += inst.n;
      let bestW = -1;
      let bestV = Number.MAX_SAFE_INTEGER;
      for (let w = 0; w < inst.n; w++) {
        const v = value(w);
        if (v < bestV) {
          bestV = v;
          bestW = w;
        }
      }
      if (bestW >= 0) {
        taken[bestW] = 1;
        size++;
      }
    } else {
      // Durr-Hoyer minimum over value(); identical decision when correct.
      const values = Array.from({ length: inst.n }, (_, w) => value(w));
      const r = durHoyerFindBest(values, (x, y) => x < y, rng);
      reads += r.reads;
      // Referee (no oracle reads charged — the values array is the oracle the
      // search already queries): the exact argmin the linear rule would take.
      let exactBest = -1;
      let exactV = Number.MAX_SAFE_INTEGER;
      for (let w = 0; w < inst.n; w++) {
        if ((values[w] as number) < exactV) {
          exactV = values[w] as number;
          exactBest = w;
        }
      }
      const w = r.best;
      if (value(w) < Number.MAX_SAFE_INTEGER) {
        taken[w] = 1;
        size++;
      }
      // A bounded-error miss: the search's pick differs from the exact rule's
      // (counted only when the exact rule had a match to find).
      if (exactBest >= 0 && w !== exactBest) disagreements++;
    }
  }
  return { size, reads, disagreements };
}

/** Expected reads for one arrival under each mode (for the ledger table). */
export function arrivalReadProfile(n: number): { linear: number } {
  return { linear: n };
}

/** Convenience: run a bank of instances and aggregate mean competitive ratios. */
export function ratioBank(
  makeInstance: (seed: number) => ObmInstance,
  seeds: number[],
  algo: (inst: ObmInstance, rng: Rng) => MatchResult,
): { meanRatio: number; minRatio: number; meanReads: number } {
  let sumRatio = 0;
  let minRatio = Infinity;
  let sumReads = 0;
  for (const seed of seeds) {
    const inst = makeInstance(seed);
    const rng = new Rng(seed ^ 0x5f356495);
    const opt = kuhnMaxMatching(inst);
    const res = algo(inst, rng);
    const ratio = opt > 0 ? res.size / opt : 1;
    sumRatio += ratio;
    if (ratio < minRatio) minRatio = ratio;
    sumReads += res.reads;
  }
  return { meanRatio: sumRatio / seeds.length, minRatio, meanReads: sumReads / seeds.length };
}
