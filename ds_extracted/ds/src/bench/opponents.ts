/**
 * QuantumSched-Bench — the unified solver interface and the opponents
 * (GENESIS 目标 A). One interface carries the quantum engines and the
 * classical opponents into the same matrix; the referee is always
 * brute-force enumeration, never another solver; welfare is recomputed by
 * the ONE accounting function — no solver's self-report ever reaches a table.
 *
 * Classical opponents (the task book's three, plus greedy alone for the
 * gradient): Hungarian (the platform's O(n³) baseline), greedy,
 * greedy + local search, and simulated annealing — each independently
 * checked against brute force on small instances in the test suite
 * (对拍, the task book's own requirement).
 */
import type { AssignmentProblem } from '../core/quantum-optimizer.js';
import { hungarianAssignment, localSearchAssignment } from '../core/classical-baselines.js';
import { annealSolve, bruteForceOptimum, qaoaSolve } from '../core/quantum-optimizer.js';
import { annealSolveSubspace, buildSubspaceModel } from '../core/subspace-optimizer.js';
import { QuantumEngineError } from '../utils/errors.js';
import { benchRng } from './generator.js';

export interface BenchSolution {
  /** assignment[t] = agent index, or -1 if unassigned */
  readonly assignment: readonly number[];
  /** wall time in ms (informational; not a claim) */
  readonly ms: number;
}

export interface BenchSolver {
  readonly id: string;
  readonly kind: 'classical' | 'quantum';
  /** solvers above the full-space qubit cap are SKIPPED — a visible cell with a reason, never a dropped one */
  readonly maxQubits?: number;
  readonly solve: (problem: AssignmentProblem) => BenchSolution;
}

function flatCouplingKey(q1: number, q2: number, nqubits: number): number {
  const lo = Math.min(q1, q2);
  const hi = Math.max(q1, q2);
  return lo * nqubits + hi;
}

/**
 * The one welfare accounting: weights of assigned pairs + coupling bonuses,
 * mirroring bruteForceOptimum's own summation.
 */
export function assignmentWelfare(
  problem: AssignmentProblem,
  assignment: readonly number[],
): number {
  const m = problem.taskIds.length;
  const n = problem.agentIds.length;
  const nq = m * n;
  let welfare = 0;
  for (let t = 0; t < m; t++) {
    const a = assignment[t];
    if (a === undefined || a < 0) continue;
    welfare += problem.weights[t]![a]!;
    for (let t2 = 0; t2 < t; t2++) {
      const a2 = assignment[t2];
      if (a2 === undefined || a2 < 0) continue;
      welfare += problem.couplings.get(flatCouplingKey(t2 * n + a2, t * n + a, nq)) ?? 0;
    }
  }
  return welfare;
}

/** Hungarian — the platform's O(n³) linear-track baseline. */
export const hungarianOpponent: BenchSolver = {
  id: 'hungarian',
  kind: 'classical',
  solve: (p) => ({ assignment: hungarianAssignment(p.weights, p.ineligible), ms: 0 }),
};

/** Greedy: tasks in order, each takes its best free agent. */
export const greedyOpponent: BenchSolver = {
  id: 'greedy',
  kind: 'classical',
  solve: (p) => ({ assignment: greedyAssignment(p), ms: 0 }),
};

/** Greedy + the platform's local search (improvement passes). */
export const greedyLocalSearchOpponent: BenchSolver = {
  id: 'greedy+local-search',
  kind: 'classical',
  solve: (p) => ({ assignment: localSearchAssignment(p), ms: 0 }),
};

/** The greedy starting assignment (also SA's start). */
export function greedyAssignment(p: AssignmentProblem): number[] {
  const m = p.taskIds.length;
  const used = new Set<number>();
  const assignment = new Array<number>(m).fill(-1);
  for (let t = 0; t < m; t++) {
    let best = -1;
    let bestW = -Infinity;
    for (let a = 0; a < p.agentIds.length; a++) {
      if (p.ineligible[t]![a]! || used.has(a)) continue;
      if (p.weights[t]![a]! > bestW) {
        bestW = p.weights[t]![a]!;
        best = a;
      }
    }
    if (best >= 0) {
      assignment[t] = best;
      used.add(best);
    }
  }
  return assignment;
}

/**
 * Simulated annealing over assignments — the bench's own classical SA:
 * greedy start, one-task reassignment neighbors, Metropolis acceptance,
 * geometric cooling, best-ever tracking (so SA never loses to greedy).
 * Deterministic from the seed.
 */
export function makeAnnealingOpponent(seed: number, iterations = 4000): BenchSolver {
  return {
    id: 'simulated-annealing',
    kind: 'classical',
    solve: (p) => {
      const m = p.taskIds.length;
      const n = p.agentIds.length;
      const rng = benchRng(seed);
      const current = greedyAssignment(p);
      const used = new Set<number>(current.filter((a) => a >= 0));
      let best = current.slice();
      let bestWelfare = assignmentWelfare(p, best);
      let curWelfare = bestWelfare;
      const T0 = 0.3;
      const cooling = Math.pow(0.001 / T0, 1 / Math.max(1, iterations));
      for (let it = 0; it < iterations; it++) {
        const T = T0 * Math.pow(cooling, it);
        const t = Math.floor(rng() * m);
        const from = current[t]!;
        const to = Math.floor(rng() * n);
        if (p.ineligible[t]![to]! || used.has(to)) continue;
        current[t] = to;
        used.delete(from);
        used.add(to);
        const w = assignmentWelfare(p, current);
        const dW = w - curWelfare;
        if (dW >= 0 || rng() < Math.exp(dW / Math.max(T, 1e-12))) {
          curWelfare = w;
          if (w > bestWelfare) {
            bestWelfare = w;
            best = current.slice();
          }
        } else {
          current[t] = from;
          used.delete(to);
          used.add(from);
        }
      }
      return { assignment: best, ms: 0 };
    },
  };
}

/** The subspace exact engine — the battle record's holder. */
export const subspaceExactSolver: BenchSolver = {
  id: 'subspace-exact',
  kind: 'quantum',
  solve: (p) => {
    const model = buildSubspaceModel(p);
    if (model === null)
      throw new QuantumEngineError('subspace model build failed — instance over the dimension cap');
    return { assignment: annealSolveSubspace(model, { seed: 42 }).assignment, ms: 0 };
  },
};

/** Full-space QAOA at the benchmark example's own configuration (≤ 20 qubits). */
export const qaoaSolver: BenchSolver = {
  id: 'qaoa-full-space',
  kind: 'quantum',
  maxQubits: 20,
  solve: (p) => ({
    assignment: qaoaSolve(p, { layers: 4, restarts: 2, select: 'shots-best', shots: 512, seed: 42 })
      .assignment,
    ms: 0,
  }),
};

/** Full-space quantum annealing simulation (≤ 20 qubits). */
export const annealSolver: BenchSolver = {
  id: 'anneal-full-space',
  kind: 'quantum',
  maxQubits: 20,
  solve: (p) => ({ assignment: annealSolve(p, { seed: 42 }).assignment, ms: 0 }),
};

/** The default matrix: 4 classical opponents + 3 quantum engines. */
export function defaultSolvers(seed: number): BenchSolver[] {
  return [
    hungarianOpponent,
    greedyOpponent,
    greedyLocalSearchOpponent,
    makeAnnealingOpponent(seed),
    subspaceExactSolver,
    qaoaSolver,
    annealSolver,
  ];
}

/** The referee — brute-force enumeration only. */
export function referee(problem: AssignmentProblem): {
  welfare: number;
  assignment: readonly number[];
} {
  const r = bruteForceOptimum(problem);
  return { welfare: r.welfare, assignment: r.assignment };
}
