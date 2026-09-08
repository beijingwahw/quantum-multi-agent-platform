/**
 * The allocation table (X6's data) — the calibration stage's shot budgets,
 * per instance x noise level x effect size, computed BEFORE machine time.
 *
 * Null H0: observed hit rate = p0 = |psi_opt|^2 (the exact-engine
 * prediction, no change). Alternative H1: p1 = the model-predicted observed
 * rate under symmetric per-qubit flips at the stated level, scaled by the
 * effect axis: effectRel = 1 is the full predicted change, 0.5 half, 0.25
 * quarter — the pessimistic axis that asks what machine time costs if the
 * true change is smaller than predicted. The exact binomial minimum rides
 * with the Chernoff sufficient bound, machine-verified per row; rows whose
 * minimum exceeds the cap are censored and say so — the bound still ships.
 *
 * Scope (priced, not hidden): every instance at n <= 16, plus the coupled
 * n=20 probe at the noise boundary. The remaining n=20 instances are
 * excluded by the effort tier: each costs ~25 exact-statevector
 * optimizations at 2^20 amplitudes per pass, and the probe already carries
 * the boundary verdict this face needs. The exclusion is disclosed in the
 * report, and the depth plan follows X2's effort tiers (p=1..3 where the
 * optimizer refines, p=1 on grid/coarse tiers).
 */
import type { Instance } from "./crossval.js";
import { exactObservedHitRate } from "./robust.js";
import { exactProbe } from "./probe.js";
import { minShots, powerAt } from "./power.js";

export interface BudgetRow {
  readonly instanceId: string;
  readonly n: number;
  readonly kind: "linear" | "coupled";
  readonly depth: number;
  readonly flip: number;
  readonly effectRel: number;
  readonly alpha: number;
  readonly beta: number;
  /** exact |psi_opt|^2 — the no-change null */
  readonly p0: number;
  /** p0 + effectRel * (predicted - p0), the scaled alternative */
  readonly p1: number;
  /** minimum shots (scan definition); null = censored beyond cap */
  readonly shots: number | null;
  /** exact power at shots; null when censored */
  readonly power: number | null;
  /** sawtooth dips above the minimum; null when censored */
  readonly dips: number | null;
  /** Chernoff sufficient bound (always present) */
  readonly chernoff: number;
  /** machine-verified: exact power at the Chernoff bound >= 1 - beta */
  readonly chernoffVerified: boolean;
}

/** The single-source point computation — generator and checker share it. */
export function budgetRowFromMasses(
  masses: Float64Array,
  meta: { instanceId: string; n: number; kind: "linear" | "coupled"; depth: number },
  flip: number,
  effectRel: number,
  alpha: number,
  beta: number,
  cap: number,
): BudgetRow {
  const p0 = masses[0]!;
  const predicted = exactObservedHitRate(masses, flip);
  const p1 = p0 + effectRel * (predicted - p0);
  const base = {
    instanceId: meta.instanceId,
    n: meta.n,
    kind: meta.kind,
    depth: meta.depth,
    flip,
    effectRel,
    alpha,
    beta,
    p0,
    p1,
  };
  if (!(Math.abs(p1 - p0) > 1e-15)) {
    // no predicted change at this operating point: nothing to detect, censored with reason
    return { ...base, shots: null, power: null, dips: null, chernoff: 0, chernoffVerified: true };
  }
  const r = minShots(p0, p1, alpha, 1 - beta, cap);
  const chernoffVerified = powerAt(r.chernoff, p0, p1, alpha) >= 1 - beta;
  return {
    ...base,
    shots: r.shots,
    power: r.power,
    dips: r.dips,
    chernoff: r.chernoff,
    chernoffVerified,
  };
}

/** All rows for one (instance, depth): the exact probe is shared. */
export function budgetRowsForDepth(
  inst: Instance,
  depth: number,
  flips: readonly number[],
  effectRels: readonly number[],
  betas: readonly number[],
  alpha: number,
  cap: number,
): BudgetRow[] {
  const probe = exactProbe(inst, depth);
  const meta = { instanceId: inst.id, n: inst.n, kind: inst.kind, depth };
  const out: BudgetRow[] = [];
  for (const flip of flips) {
    for (const effectRel of effectRels) {
      for (const beta of betas) {
        out.push(budgetRowFromMasses(probe.masses, meta, flip, effectRel, alpha, beta, cap));
      }
    }
  }
  return out;
}

// The shipped grid — noise levels across the stated boundary, the effect
// axis, and the two power targets the calibration stage would quote.
export const BUDGET_FLIPS: readonly number[] = [0.01, 0.02, 0.05];
export const BUDGET_EFFECTS: readonly number[] = [1, 0.5, 0.25];
/** power targets, as (1 - beta); the X8 discriminator plans at the first */
export const BUDGET_BETAS = [0.2, 0.1] as const;
export const BUDGET_ALPHA = 0.05;
/** censoring cap — rows beyond it ship as censored with the Chernoff bound */
export const BUDGET_CAP = 10_000_000;
/** the coupled n=20 probe at the noise boundary (the falsifier's own arm) */
export const BUDGET_N20_PROBE_ID = "np-n20-11";

/** Depth plan follows X2's effort tiers: p=1..3 where refinement runs. */
export function budgetDepths(n: number): readonly number[] {
  return n <= 12 ? [1, 2, 3] : [1];
}

/** The allocation table's instance scope: all n <= 16 plus the n=20 probe. */
export function allocationScope(instances: readonly Instance[]): { included: readonly Instance[]; excluded: ReadonlyArray<{ id: string; reason: string }> } {
  const included: Instance[] = [];
  const excluded: Array<{ id: string; reason: string }> = [];
  for (const inst of instances) {
    if (inst.n <= 16 || inst.id === BUDGET_N20_PROBE_ID) included.push(inst);
    else excluded.push({ id: inst.id, reason: "n=20 beyond the boundary probe — effort tier, priced in the ledger" });
  }
  return { included, excluded };
}

/** The full allocation table for an instance list. */
export function buildBudgetTable(instances: readonly Instance[]): BudgetRow[] {
  const out: BudgetRow[] = [];
  const { included } = allocationScope(instances);
  for (const inst of included) {
    for (const depth of budgetDepths(inst.n)) {
      out.push(...budgetRowsForDepth(inst, depth, BUDGET_FLIPS, BUDGET_EFFECTS, BUDGET_BETAS, BUDGET_ALPHA, BUDGET_CAP));
    }
  }
  return out;
}
