/**
 * Kernel — the smuggling audit: named checkers that reject counterfeit rows
 * before they can ride into a report. A row is only as good as the machine
 * number behind it; a claim of exactness where the machine measures a
 * strictly different value is a named offense, not a rounding note.
 */
import { collisionCensus } from "./amplify.js";
import { h2 } from "./tariff.js";

export interface AuditVerdict {
  readonly ok: boolean;
  readonly offense: string | null;
  readonly detail: string;
}

export interface RateRow {
  readonly p: number;
  /** observed QBER q = (1 - p)/2 */
  readonly q: number;
  /** the theoretical line 1 - h2(q) (the W4 reconciliation-only net) */
  readonly line: number;
  /** the claimed measured secret rate */
  readonly measured: number;
}

/**
 * Audit one key-rate row against the machine.
 *
 * Two named offenses:
 *  1. "counterfeit key-rate row (value)" — the claimed measured value is not
 *     the machine's number.
 *  2. "counterfeit key-rate row (no gap)" — for p < 1 the measured rate can
 *     never touch the 1 - h2(q) line: data processing pins
 *     r <= h2(eps_E) - h2(q) = line - (1 - h2(eps_E)) with eps_E = 1/2 - q,
 *     so a row that sits exactly on the line (or above the certified floor's
 *     gap) is a forgery. At p = 1 the honest endpoint r = line = 1 is allowed.
 */
export function auditRateRow(row: RateRow, machineMeasured: number): AuditVerdict {
  if (Math.abs(row.measured - machineMeasured) > 1e-9) {
    return {
      ok: false,
      offense: "counterfeit key-rate row (value)",
      detail: `p=${row.p}: claims r=${row.measured.toPrecision(12)} but the machine recomputes ${machineMeasured.toPrecision(12)}`,
    };
  }
  if (row.p < 1 - 1e-12) {
    const epsE = 0.5 - row.q;
    const certifiedFloorGap = 1 - h2(epsE); // > 0 whenever 0 < epsE < 1
    const gap = row.line - row.measured;
    if (gap < certifiedFloorGap - 1e-9) {
      return {
        ok: false,
        offense: "counterfeit key-rate row (no gap)",
        detail: `p=${row.p}: gap to the 1-h2(q) line is ${gap.toPrecision(6)} but data processing certifies a gap of at least ${certifiedFloorGap.toPrecision(6)} (Eve's per-bit information is positive); a tighter row claims measurement where none exists`,
      };
    }
  }
  return {
    ok: true,
    offense: null,
    detail: `p=${row.p}: measured value reproduces; gap to the line at or above the certified floor`,
  };
}

export interface UniformityClaim {
  readonly m: number;
  readonly k: number;
  /** claimed collision probability for the truncated field-multiplication family */
  readonly claimedCollisionProb: number;
}

/**
 * Audit a hash-family uniformity claim. The exact collision count of
 * F_{m,k} = { x -> trunc_k(a (x) x) } is (2^(m-k) - 1)/(2^m - 1) for every
 * delta != 0 — strictly BETTER than 2^-k, never equal to it. Claiming exact
 * 2^-k uniformity (the textbook ideal) for this family is a named offense:
 * the honest statement is "universal-2 with room to spare, not exactly
 * uniform".
 */
export function auditUniformityClaim(claim: UniformityClaim): AuditVerdict {
  const census = collisionCensus(claim.m, claim.k);
  const exact = census.maxCollisionProb;
  if (Math.abs(claim.claimedCollisionProb - exact) > 1e-12) {
    const isTextbookIdeal = Math.abs(claim.claimedCollisionProb - 2 ** -claim.k) < 1e-15;
    return {
      ok: false,
      offense: isTextbookIdeal
        ? "counterfeit uniformity claim (exactly 2^-k)"
        : "counterfeit uniformity claim (wrong value)",
      detail: `claims collision probability ${claim.claimedCollisionProb.toPrecision(12)} for GF(2^${claim.m}) truncated to k=${claim.k}; the exhaustive census over all ${census.family} maps and all deltas says ${exact.toPrecision(12)} (= ${census.collisionsPerDelta}/${census.family})`,
    };
  }
  return {
    ok: true,
    offense: null,
    detail: `collision probability matches the exhaustive census (${census.collisionsPerDelta}/${census.family} = ${exact.toPrecision(12)} <= 2^-${claim.k} = ${census.uniform2Bound.toPrecision(12)}, strict)`,
  };
}
