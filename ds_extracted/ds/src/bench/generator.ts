/**
 * QuantumSched-Bench — the public, seeded instance generator (GENESIS 目标 A).
 *
 * Every instance is a function of (track, size, seed) and nothing else: same
 * inputs, byte-identical problem, forever. The NP-hard coupled track uses the
 * SAME public family the platform's battle record was set on (weights
 * 0.15 + 0.7·r rounded to 3 decimals, one entangled agent pair with the 0.35
 * block bonus, seeds = 100·k) — so the record is reproducible by rerunning
 * the family, not by trusting prose.
 */
import type { AssignmentProblem } from '../core/quantum-optimizer.js';
import { couplingKey, defaultPenalties } from '../core/quantum-optimizer.js';

/** Seeded RNG (mulberry32 idiom, the platform's own). */
export function benchRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type BenchTrack = 'linear' | 'np-hard';

export interface BenchInstanceSpec {
  /** track name; 'np-hard' adds the entangled pair's quadratic bonuses */
  readonly track: BenchTrack;
  /** tasks × agents */
  readonly m: number;
  readonly n: number;
  /** public seed; the record family uses 100·k */
  readonly seed: number;
}

export interface BenchInstance {
  readonly spec: BenchInstanceSpec;
  readonly id: string;
  readonly problem: AssignmentProblem;
  /** nqubits of the full-space encoding (m·n) */
  readonly nqubits: number;
}

/**
 * The battle-record family: 4 sizes × 5 public seeds on the NP-hard coupled
 * track (entangled pair [0,1]) with their linear twins — PLUS the README
 * record track itself: 6×8 coupled × seeds 500·k, the exact family the
 * 5/5-vs-0/5 table was set on (same construction: weights first, then the
 * entangled pair's 0.35 block bonuses). `npm run bench` runs exactly this set.
 */
export function recordFamily(): BenchInstanceSpec[] {
  const specs: BenchInstanceSpec[] = [];
  const sizes: Array<[number, number]> = [
    [2, 3],
    [2, 4],
    [3, 4],
    [3, 5],
  ];
  for (const [m, n] of sizes) {
    for (let k = 1; k <= 5; k++) {
      specs.push({ track: 'np-hard', m, n, seed: 100 * k });
      specs.push({ track: 'linear', m, n, seed: 100 * k });
    }
  }
  for (let k = 1; k <= 5; k++) {
    specs.push({ track: 'np-hard', m: 6, n: 8, seed: 500 * k });
    specs.push({ track: 'linear', m: 6, n: 8, seed: 500 * k });
  }
  return specs;
}

/** Deterministic instance construction — the ONLY way bench instances exist. */
export function makeBenchInstance(spec: BenchInstanceSpec): BenchInstance {
  const r = benchRng(spec.seed);
  const weights = Array.from({ length: spec.m }, () =>
    Array.from({ length: spec.n }, () => +(0.15 + 0.7 * r()).toFixed(3)),
  );
  const nq = spec.m * spec.n;
  const couplings = new Map<number, number>();
  if (spec.track === 'np-hard') {
    // the record family's entanglement: agents (0,1), block bonus 0.35 —
    // keys built through the platform's own couplingKey (it normalizes the
    // order and refuses diagonal keys)
    for (let t1 = 0; t1 < spec.m; t1++) {
      for (let t2 = t1 + 1; t2 < spec.m; t2++) {
        couplings.set(couplingKey(t1 * spec.n + 0, t2 * spec.n + 1, nq), 0.35);
        couplings.set(couplingKey(t1 * spec.n + 1, t2 * spec.n + 0, nq), 0.35);
      }
    }
  }
  const problem: AssignmentProblem = {
    taskIds: Array.from({ length: spec.m }, (_, i) => `t${i}`),
    agentIds: Array.from({ length: spec.n }, (_, i) => `a${i}`),
    weights,
    ineligible: weights.map((row) => row.map(() => false)),
    couplings,
    penaltyOneHot: 0,
    penaltyCapacity: 0,
  };
  // penalties resolved through the platform's own defaults (never hand-set)
  const pen = defaultPenalties(problem);
  problem.penaltyOneHot = pen.oneHot;
  problem.penaltyCapacity = pen.capacity;
  return {
    spec,
    id: `${spec.track}-m${spec.m}n${spec.n}-s${spec.seed}`,
    problem,
    nqubits: nq,
  };
}
