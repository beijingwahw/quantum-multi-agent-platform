/**
 * QuantumSched-Bench — the runner: every instance × every solver, one row
 * per cell, losses shipped as shipped. The anti-selection law lives here:
 * the row count is instances × solvers, exactly, and the report layer
 * refuses to print anything else.
 */
import {
  makeBenchInstance,
  recordFamily,
  type BenchInstance,
  type BenchInstanceSpec,
} from './generator.js';
import { assignmentWelfare, defaultSolvers, referee, type BenchSolver } from './opponents.js';

export interface BenchRow {
  readonly track: string;
  readonly instanceId: string;
  readonly m: number;
  readonly n: number;
  readonly seed: number;
  readonly solver: string;
  readonly kind: 'classical' | 'quantum';
  /** recomputed welfare (the one accounting), never a solver self-report */
  readonly welfare: number;
  /** brute-force optimum */
  readonly optimal: number;
  /** 1 − welfare/optimal (0 = hit; only meaningful when optimal > 0) */
  readonly gap: number;
  /** |welfare − optimal| < 1e-9 */
  readonly hit: boolean;
  /** skipped cells stay visible: the solver declared the instance over its cap */
  readonly skipped: boolean;
  readonly ms: number;
}

export interface BenchRun {
  readonly rows: readonly BenchRow[];
  /** instances × solvers, minted by runBenchmark — a forged report cannot forge this */
  readonly expectedCells: number;
  readonly generatedAt: string;
  readonly seed: number;
  readonly solverIds: readonly string[];
}

export function runBenchmark(
  specs: readonly BenchInstanceSpec[] = defaultSpecs(),
  solvers: readonly BenchSolver[] = defaultSolvers(42),
  seed = 42,
): BenchRun {
  const rows: BenchRow[] = [];
  const cache = new Map<string, { instance: BenchInstance; optimal: number }>();
  for (const solver of solvers) {
    for (const spec of specs) {
      let entry = cache.get(specId(spec));
      if (entry === undefined) {
        const instance = makeBenchInstance(spec);
        const opt = referee(instance.problem).welfare;
        entry = { instance, optimal: opt };
        cache.set(specId(spec), entry);
      }
      const t0 = Date.now();
      const overCap = solver.maxQubits !== undefined && entry.instance.nqubits > solver.maxQubits;
      if (overCap) {
        rows.push({
          track: spec.track,
          instanceId: entry.instance.id,
          m: spec.m,
          n: spec.n,
          seed: spec.seed,
          solver: solver.id,
          kind: solver.kind,
          welfare: Number.NaN,
          optimal: entry.optimal,
          gap: Number.NaN,
          hit: false,
          skipped: true,
          ms: 0,
        });
        continue;
      }
      const solution = solver.solve(entry.instance.problem);
      const ms = Date.now() - t0;
      const welfare = assignmentWelfare(entry.instance.problem, solution.assignment);
      rows.push({
        track: spec.track,
        instanceId: entry.instance.id,
        m: spec.m,
        n: spec.n,
        seed: spec.seed,
        solver: solver.id,
        kind: solver.kind,
        welfare,
        optimal: entry.optimal,
        gap:
          entry.optimal > 0
            ? 1 - welfare / entry.optimal
            : welfare === entry.optimal
              ? 0
              : Number.NaN,
        hit: Math.abs(welfare - entry.optimal) < 1e-9,
        skipped: false,
        ms,
      });
    }
  }
  return {
    rows,
    expectedCells: specs.length * solvers.length,
    generatedAt: new Date().toISOString(),
    seed,
    solverIds: solvers.map((s) => s.id),
  };
}

/** Default specs = the record family (deterministic; see generator.ts). */
export function defaultSpecs(): BenchInstanceSpec[] {
  return recordFamily();
}

function specId(spec: BenchInstanceSpec): string {
  return `${spec.track}-m${spec.m}n${spec.n}-s${spec.seed}`;
}

/**
 * The anti-selection law: a legal run carries EXACTLY expectedCells rows
 * (minted by runBenchmark from instances × solvers), one per cell — a
 * dropped loss is a forged report.
 */
export function checkRun(run: BenchRun): string[] {
  const problems: string[] = [];
  if (run.rows.length !== run.expectedCells) {
    problems.push(
      `row count ${run.rows.length} !== expected cells ${run.expectedCells} — selection suspected`,
    );
  }
  const seen = new Set<string>();
  for (const r of run.rows) {
    const key = `${r.instanceId}::${r.solver}`;
    if (seen.has(key)) problems.push(`duplicate cell ${key}`);
    seen.add(key);
  }
  return problems;
}
