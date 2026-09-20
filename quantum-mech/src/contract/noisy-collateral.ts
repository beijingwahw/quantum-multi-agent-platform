/**
 * G1-b · the collateral noise budget (v0.5.0): does readout noise on the
 * BOND qubit break the escrow's exclusivity test?
 *
 * The noise-free exclusivity story (exp3, contract/monogamy.ts): on the
 * constructive family
 *     psi_x = sqrt(x)|100> + sqrt((1-x)/2)(|010> + |001>)
 * (bond qubit B first, escrows E1/E2 on qubits 1/2) the simultaneous
 * Bell-fidelity budget F(B,E1) + F(B,E2) <= 1 holds for the whole family,
 * so an acceptance threshold strictly above 1/2 admits at most one escrow —
 * CKW monogamy executed as contract law.
 *
 * This module puts PARAMETERIZED local noise (dephasing / amplitude damping
 * at strength gamma) on the BOND qubit only — the pledge's qubit sits in the
 * escrow's noisy memory — and machine-checks what survives:
 *
 * (CB-a) closed forms, exact on the family:
 *     F1 = (1-x)/4 + gamma*x/2                     (damping)
 *     F1 = (1-x)/4                                 (dephasing)
 *     sum = F1 + F2 = (1-x)/2 + gamma*x            (damping)
 *         = (1-x)/2                                (dephasing)
 *   The Bell overlap of the pair states lives in the Psi-direction; the
 *   Phi+ test reads only populations, which local bond noise can only
 *   redirect (decay to |0>) never amplify.
 *
 * (CB-b) the budget SURVIVES: max_x sum = max(1/2, gamma) <= 1 for every
 *   gamma in [0,1] — the excess epsilon(gamma) = max(0, max_x sum - 1) is
 *   IDENTICALLY ZERO. Bond-local noise does not move the acceptance
 *   threshold: the spec-form threshold (1 + epsilon(gamma))/2 stays 1/2 and
 *   even the family-tight form max(1/2, gamma)/2 never exceeds 1/2.
 *
 * (CB-c) what noise DOES shrink: the concurrence face. C(B,Ei) =
 *   factor(gamma) * sqrt(2x(1-x)) with factor = (1-2*gamma) for dephasing
 *   (gamma <= 1/2, the repo's census-table convention — over-rotation
 *   beyond 1/2 re-amplifies coherence) and sqrt(1-gamma) for damping. The
 *   balanced optimum x = 1/2 decays from the CKW ceiling 1/sqrt(2) — the
 *   exclusivity MARGIN melts while the acceptance threshold stands.
 *
 * (CB-d) CKW slack pin: on the noisy (mixed) family states the tangle
 *   combination C_AB^2 + C_AC^2 - C_ABC^2 stays <= 0 to machine precision —
 *   a machine echo of the inequality on this slice, pinned per (noise,
 *   gamma) — NOT a proof of a mixed-state CKW theorem (see the boundary
 *   note below).
 *
 * Honest boundary: single-parameter family, BOND-LOCAL noise only. Noise on
 * the escrow qubits or general three-qubit states is not covered — the
 * max over all states of F1+F2 under noise is not computed here (noise-free
 * it is 1 at the GHZ point; exp3's table is the noise-free reference). The
 * (CB-d) pin is a family-level machine fact, not the mixed-state CKW
 * inequality (which as stated is a pure-state theorem).
 *
 * Literature anchors: CKW-2000 (Coffman-Kundu-Wootters, tangle monogamy)
 * and Osborne-Verstraete-2006 (general qubit case) — both already anchored
 * in this repo's contract layer; the channel parameterization inherits
 * exp7's noise census conventions (channels.ts phaseFlipKraus /
 * amplitudeDampKraus). The Bell-fidelity acceptance test as an escrow
 * verification primitive is the repo's own exp3 design 〔待双源〕.
 */

import { type CMat, identity, kronAll } from "../core/cmat.js";
import {
  applyKraus,
  amplitudeDampKraus,
  partialTrace,
  phaseFlipKraus,
} from "../core/channels.js";
import { fromVec } from "../core/states.js";
import { bellFidelity, ckw, concurrence } from "./monogamy.js";

export type CollateralNoiseName = "dephase" | "damp";

function checkNoiseArgs(
  fn: string,
  noise: CollateralNoiseName,
  gamma: number,
  x: number,
): void {
  // unknown noise names are excluded by the CollateralNoiseName union type;
  // the VALUE ranges are what a guard can still catch at runtime
  if (!Number.isFinite(gamma) || gamma < 0 || gamma > 1) {
    throw new Error(`${fn}: gamma must lie in [0,1], got ${gamma}`);
  }
  // the repo-wide census convention (channels.ts): phase-flip tables live on
  // gamma in [0, 1/2] — beyond it the phase over-rotates back
  if (noise === "dephase" && gamma > 0.5) {
    throw new Error(
      `${fn}: dephase census lives on gamma in [0, 1/2] (over-rotation beyond), got ${gamma}`,
    );
  }
  if (!Number.isFinite(x) || x < 0 || x > 1) {
    throw new Error(`${fn}: family parameter x must lie in [0,1], got ${x}`);
  }
}

/** The family state psi_x (pure, 3 qubits, bond = qubit 0). */
export function collateralFamilyState(x: number): CMat {
  checkNoiseArgs("CB01-family-x", "dephase", 0, x);
  const v = { n: 8, re: new Float64Array(8), im: new Float64Array(8) };
  v.re[4] = Math.sqrt(x); // |100>
  v.re[2] = Math.sqrt((1 - x) / 2); // |010>
  v.re[1] = Math.sqrt((1 - x) / 2); // |001>
  return fromVec(v);
}

/** psi_x after LOCAL noise on the bond qubit only (K ⊗ I ⊗ I). */
export function bondNoisyFamilyState(
  x: number,
  noise: CollateralNoiseName,
  gamma: number,
): CMat {
  checkNoiseArgs("CB02-noisy-family", noise, gamma, x);
  const kraus =
    noise === "dephase" ? phaseFlipKraus(gamma) : amplitudeDampKraus(gamma);
  const embedded = kraus.map((k) => kronAll([k, identity(2), identity(2)]));
  return applyKraus(collateralFamilyState(x), embedded);
}

export interface CollateralBudgetRow {
  noise: CollateralNoiseName;
  gamma: number;
  x: number;
  /** Bell fidelity <Phi+|rho_{B,E1}|Phi+> (physical path, density matrices) */
  f1: number;
  f2: number;
  sum: number;
  /** concurrences of both noisy reduced pairs */
  cBE1: number;
  cBE2: number;
  /** C_AB^2 + C_AC^2 - C_ABC^2 on the noisy (mixed) state — must stay <= 0 */
  ckwSlack: number;
}

/** One fully machine-measured row: noisy state, both reductions, both
 * quantities, both paths' raw material. */
export function collateralRow(
  noise: CollateralNoiseName,
  gamma: number,
  x: number,
): CollateralBudgetRow {
  checkNoiseArgs("CB03-row", noise, gamma, x);
  const rho = bondNoisyFamilyState(x, noise, gamma);
  const be1 = partialTrace(rho, [2, 2, 2], [2]);
  const be2 = partialTrace(rho, [2, 2, 2], [1]);
  const f1 = bellFidelity(be1);
  const f2 = bellFidelity(be2);
  const r = ckw(rho);
  return {
    noise,
    gamma,
    x,
    f1,
    f2,
    sum: f1 + f2,
    cBE1: concurrence(be1),
    cBE2: concurrence(be2),
    ckwSlack: r.cAB ** 2 + r.cAC ** 2 - r.cABC ** 2,
  };
}

/** Closed form of F1 (CB-a): (1-x)/4 + gamma*x/2 (damping), (1-x)/4
 * (dephasing). */
export function f1Closed(
  noise: CollateralNoiseName,
  gamma: number,
  x: number,
): number {
  checkNoiseArgs("CB04-f1", noise, gamma, x);
  return (1 - x) / 4 + (noise === "damp" ? (gamma * x) / 2 : 0);
}

/** Closed form of the budget sum: (1-x)/2 + gamma*x (damping), (1-x)/2
 * (dephasing). */
export function budgetSumClosed(
  noise: CollateralNoiseName,
  gamma: number,
  x: number,
): number {
  checkNoiseArgs("CB05-sum", noise, gamma, x);
  return (1 - x) / 2 + (noise === "damp" ? gamma * x : 0);
}

/** The family-tight maximum of the budget: max(1/2, gamma) (damping; the
 * linear-in-x sum tops out at an endpoint), 1/2 (dephasing). */
export function familyMaxSumClosed(
  noise: CollateralNoiseName,
  gamma: number,
): number {
  checkNoiseArgs("CB06-max-sum", noise, gamma, 0);
  return noise === "damp" ? Math.max(0.5, gamma) : 0.5;
}

/** The budget excess epsilon(gamma) = max(0, family max sum - 1): identically
 * 0 on gamma in [0,1] (CB-b) — the F1+F2 <= 1 budget survives bond-local
 * noise on the family. */
export function epsilonBudget(
  noise: CollateralNoiseName,
  gamma: number,
): number {
  return Math.max(0, familyMaxSumClosed(noise, gamma) - 1);
}

export interface ExclusiveThreshold {
  /** family-tight double-pass bar: strictly above this, both escrows cannot
   * both pass on the family = max(1/2, gamma)/2 */
  familyTight: number;
  /** the spec's epsilon-form bar (1 + epsilon(gamma))/2 — equals 1/2 here */
  specForm: number;
  /** family-tight never exceeds the noise-free threshold 1/2 */
  noShiftNeeded: boolean;
}

/** The acceptance-threshold faces (CB-b): both forms, and the fact that
 * neither moves past the noise-free 1/2. */
export function exclusiveThreshold(
  noise: CollateralNoiseName,
  gamma: number,
): ExclusiveThreshold {
  checkNoiseArgs("CB07-threshold", noise, gamma, 0);
  const familyTight = familyMaxSumClosed(noise, gamma) / 2;
  const specForm = (1 + epsilonBudget(noise, gamma)) / 2;
  return {
    familyTight,
    specForm,
    noShiftNeeded: familyTight <= 0.5 + 1e-15 && specForm <= 0.5 + 1e-15,
  };
}

/** The concurrence decay factor (CB-c): (1-2*gamma) dephasing,
 * sqrt(1-gamma) damping. */
export function concurrenceDecayFactor(
  noise: CollateralNoiseName,
  gamma: number,
): number {
  checkNoiseArgs("CB08-decay", noise, gamma, 0);
  return noise === "damp" ? Math.sqrt(1 - gamma) : 1 - 2 * gamma;
}

/** The balanced-optimum margin: max_x min(C1, C2) = decay factor * 1/sqrt(2)
 * — the exclusivity margin that melts under noise. */
export function balancedMargin(
  noise: CollateralNoiseName,
  gamma: number,
): number {
  return (concurrenceDecayFactor(noise, gamma) * 1) / Math.sqrt(2);
}

/** (CB-d): the worst (most positive) CKW slack over the family x-grid at
 * this (noise, gamma) — must stay <= machine noise. */
export function ckwSlackCensus(
  noise: CollateralNoiseName,
  gamma: number,
  steps = 100,
): number {
  checkNoiseArgs("CB09-slack", noise, gamma, 0);
  if (!Number.isInteger(steps) || steps < 2) {
    throw new Error(`CB09-slack: need integer steps >= 2, got ${steps}`);
  }
  let worst = -Infinity;
  for (let i = 0; i <= steps; i++) {
    const row = collateralRow(noise, gamma, i / steps);
    worst = Math.max(worst, row.ckwSlack);
  }
  return worst;
}

export interface CollateralBudgetClaim {
  noise: CollateralNoiseName;
  gamma: number;
  x: number;
  /** claimed measured F1 + F2 */
  sum: number;
  /** claimed family max sum at this gamma */
  familyMaxSum: number;
}

/** The anti-smuggling referee: re-measures a claimed budget row from
 * scratch (density matrices, both reductions) and convicts forged sums,
 * forged family maxima — including the classic confusion of BOND-LOCAL
 * noise with all-qubit noise (which inflates the max sum to 1/2 + gamma/2)
 * — by name. */
export function verifyCollateralBudgetClaim(claim: CollateralBudgetClaim): {
  ok: boolean;
  code?: string;
  detail?: string;
} {
  checkNoiseArgs("CB10-claim", claim.noise, claim.gamma, claim.x);
  const row = collateralRow(claim.noise, claim.gamma, claim.x);
  if (Math.abs(row.sum - claim.sum) > 1e-9) {
    return {
      ok: false,
      code: "CBX01-fabricated-budget-sum",
      detail: `${claim.noise}/gamma=${claim.gamma}/x=${claim.x}: claimed F1+F2 ${claim.sum}, re-measured ${row.sum.toFixed(9)}`,
    };
  }
  const scan = familyMaxSumScan(claim.noise, claim.gamma);
  if (Math.abs(scan.maxSum - claim.familyMaxSum) > 1e-9) {
    return {
      ok: false,
      code: "CBX02-fabricated-family-max",
      detail: `${claim.noise}/gamma=${claim.gamma}: claimed family max ${claim.familyMaxSum}, scan gives ${scan.maxSum.toFixed(9)} (closed form ${familyMaxSumClosed(claim.noise, claim.gamma).toFixed(9)}; bond-local noise never inflates it to the all-qubit value)`,
    };
  }
  return { ok: true };
}

/** Machine scan of max_x (F1+F2) with its closed form and the worst
 * deviation — the dual-path pin behind CB-a/CB-b. */
export function familyMaxSumScan(
  noise: CollateralNoiseName,
  gamma: number,
  steps = 200,
): {
  maxSum: number;
  bestX: number;
  closedForm: number;
  worstDeviation: number;
} {
  checkNoiseArgs("CB11-scan", noise, gamma, 0);
  if (!Number.isInteger(steps) || steps < 2) {
    throw new Error(`CB11-scan: need integer steps >= 2, got ${steps}`);
  }
  let maxSum = -Infinity;
  let bestX = 0;
  let worstDeviation = 0;
  for (let i = 0; i <= steps; i++) {
    const x = i / steps;
    const measured = collateralRow(noise, gamma, x).sum;
    worstDeviation = Math.max(
      worstDeviation,
      Math.abs(measured - budgetSumClosed(noise, gamma, x)),
    );
    if (measured > maxSum) {
      maxSum = measured;
      bestX = x;
    }
  }
  return {
    maxSum,
    bestX,
    closedForm: familyMaxSumClosed(noise, gamma),
    worstDeviation,
  };
}
