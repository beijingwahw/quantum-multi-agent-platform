/** Failure budget of the Hoeffding count (EXP4-B convention, shared by EXP1-D). */
export declare const FAILURE_BUDGET = 0.05;
/**
 * Off-grid p bank for the QAE requirement: p = 1/2 sits exactly on the phase
 * grid for every m (the degenerate best case, exp1-qram.ts's own guard) and
 * must not set the register size — the requirement is the WORST median error
 * over this bank, exactly as EXP1-D computes it.
 */
export declare const OFF_GRID_P_BANK: readonly number[];
/** Smallest phase register m whose exact-QAE WORST off-grid median error clears eps. */
export declare function minimalPhaseQubits(eps: number): number;
/** Classical samples for median error <= eps at failure budget delta (Hoeffding). */
export declare function hoeffdingSamples(eps: number, delta?: number): number;
/** The full two-sided cost model at (n_b, eps); every field is an exact integer. */
export interface PaybackModel {
    readonly nb: number;
    readonly eps: number;
    readonly N: number;
    /** QAE phase register m*(eps). */
    readonly m: number;
    /** QAE oracle queries per task = 2^m - 1. */
    readonly queries: number;
    /** classical samples per task. */
    readonly samples: number;
    /** quantum one-off loading = N * n_b activations. */
    readonly loadQuantum: number;
    /** classical one-off loading = N (symmetric billing). */
    readonly loadClassical: number;
    /** net insertion surcharge = N * (n_b - 1). */
    readonly loadNet: number;
    /** per-task quantum = queries * n_b activations. */
    readonly perTaskQuantum: number;
    /** per-task classical = samples. */
    readonly perTaskClassical: number;
}
export declare function paybackModel(nb: number, eps: number, delta?: number): PaybackModel;
/** Total metered activations after T tasks, both sides. */
export declare function totalQuantumCost(model: PaybackModel, tasks: number): number;
export declare function totalClassicalCost(model: PaybackModel, tasks: number): number;
export type PaybackThreshold = {
    readonly feasible: true;
    readonly denominator: number;
    readonly Tstar: number;
} | {
    readonly feasible: false;
    readonly denominator: number;
};
/** (PB-a / PB-b) the exact threshold and the infeasible domain, from the model. */
export declare function paybackThreshold(model: PaybackModel): PaybackThreshold;
/**
 * Independent referee: the first task count T (1..cap) at which the metered
 * quantum total undercuts the classical total, found by running the ledger
 * task-by-task WITHOUT consulting the closed form. null = no crossover inside
 * cap (for infeasible models that is forever, by PB-b's two non-negative
 * terms; cap only bounds the scan, never the claim).
 */
export declare function bruteForceThreshold(model: PaybackModel, cap?: number): {
    readonly Tstar: number | null;
    readonly scannedTo: number;
};
/**
 * (PB-b) the explicit infeasibility boundary at precision eps: n_b at or above
 * ceiling(samples / queries) never pays back (s <= q * n_b), one below it is
 * feasible (s > q * n_b — both sides of the inequality are exact integers).
 */
export declare function criticalAddressBits(eps: number, delta?: number): {
    readonly thresholdNb: number;
    readonly samples: number;
    readonly queries: number;
};
/**
 * (PB-c, machine form) the sup-crossover eps* and the enumerated infeasible
 * holes under it. The R18 spec's "monotone denominator" reading is REFUTED by
 * this very scan (holes exist at every n_b tried); what the theorem asserts
 * is the sup-uniqueness of eps* plus the complete hole table on the grid.
 */
export interface EpsilonCrossover {
    readonly nb: number;
    /** sup{eps grid point : Den > 0}; 0 when the whole grid is infeasible. */
    readonly epsStar: number;
    readonly gridStep: number;
    /** ascending grid eps values inside (0, epsStar] with Den <= 0. */
    readonly holes: readonly number[];
    /** true iff every grid point left of the first hole is feasible. */
    readonly feasibleFromBelow: boolean;
}
export declare function epsilonStar(nb: number, gridStep?: number, gridMax?: number): EpsilonCrossover;
export interface PaybackViolation {
    readonly name: string;
    readonly detail: string;
}
export interface PaybackVerdict {
    readonly accepted: boolean;
    readonly violations: readonly PaybackViolation[];
}
/**
 * A payback claim about (n_b, eps): breakEvenTasks = T asserts "the metered
 * quantum total has caught up by task T"; breakEvenTasks = null asserts "this
 * parameter point never pays back".
 */
export interface PaybackClaim {
    readonly nb: number;
    readonly eps: number;
    readonly breakEvenTasks: number | null;
    readonly delta?: number;
}
/** The claim checker: counterfeit break-even rows die here, by name. */
export declare function auditPaybackClaim(claim: PaybackClaim): PaybackVerdict;
