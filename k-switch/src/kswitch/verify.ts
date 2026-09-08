/**
 * Certificate verifiers for the smuggling trials (v0.2.0): every machine
 * claim in the k=4 faces can be wrapped in a certificate, and every
 * certificate is re-verified FROM SCRATCH — a counterfeit number or structure
 * is NAMED and REJECTED with a machine-recomputed reason.
 */
import {
  S4,
  anticommutingQuad,
  commutingQuad,
  controlFidelity4,
  controlInner4,
  pauliQuadCensus,
  verificationState4,
  sgnControl4,
  switchedControlState4,
  uniformControl4,
} from "./k4.js";
import { distinguishabilityMatrix, hadamardCensus, shortestSupersequence, ORDERS4 } from "./hadamard4.js";
import { KSwitchError } from "./errors.js";

export interface VerifyResult {
  readonly ok: boolean;
  readonly reason: string;
}

// ---------------------------------------------------------------------------
// 1. The parity-orthogonality certificate (k = 4).
// ---------------------------------------------------------------------------

export interface ParityCertificate {
  readonly k: 3 | 4;
  readonly evenCount: number;
  readonly oddCount: number;
  readonly innerAbs: number;
  readonly fCommuting: number;
  readonly fAnticommuting: number;
}

/** Recompute the k=4 parity law from scratch and judge the certificate. */
export function verifyParityCertificate(c: ParityCertificate): VerifyResult {
  if (c.k !== 4) return { ok: false, reason: "PARITY-COUNTERFEIT: verifier covers k=4 only" };
  const even = S4.filter((p) => p.even).length;
  const odd = S4.length - even;
  if (c.evenCount !== even || c.oddCount !== odd) {
    return {
      ok: false,
      reason: `PARITY-COUNTERFEIT: claimed ${c.evenCount} even / ${c.oddCount} odd permutations, machine census has ${even}/${odd} — orthogonality precondition misstated`,
    };
  }
  const inner = controlInner4(uniformControl4(), sgnControl4());
  const innerAbs = Math.hypot(inner.re, inner.im);
  if (Math.abs(c.innerAbs - innerAbs) > 1e-12) {
    return { ok: false, reason: `PARITY-COUNTERFEIT: claimed <u|u_sgn> = ${c.innerAbs}, machine recomputes ${innerAbs}` };
  }
  if (innerAbs > 1e-15) {
    return { ok: false, reason: `PARITY-COUNTERFEIT: <u|u_sgn> = ${innerAbs} is NOT zero — no deterministic readout` };
  }
  const psi = verificationState4();
  const fC = controlFidelity4(switchedControlState4(commutingQuad(), psi), uniformControl4());
  const fA = controlFidelity4(switchedControlState4(anticommutingQuad(), psi), sgnControl4());
  if (Math.abs(c.fCommuting - fC) > 1e-11 || Math.abs(c.fAnticommuting - fA) > 1e-11) {
    return {
      ok: false,
      reason: `PARITY-COUNTERFEIT: claimed readout fidelities (${c.fCommuting}, ${c.fAnticommuting}), machine recomputes (${fC.toFixed(12)}, ${fA.toFixed(12)}) — counterfeit fidelity table`,
    };
  }
  if (Math.abs(fC - 1) > 1e-11 || Math.abs(fA - 1) > 1e-11) {
    return { ok: false, reason: `PARITY-COUNTERFEIT: recomputed fidelities (${fC}, ${fA}) are not 1 — orthogonality claimed but not there` };
  }
  return { ok: true, reason: `parity certificate verified: 12/12 split, <u|u_sgn> = ${innerAbs}, fC = ${fC.toFixed(12)}, fA = ${fA.toFixed(12)}` };
}

// ---------------------------------------------------------------------------
// 2. The distinguishability-matrix certificate (which orders separate which columns).
// ---------------------------------------------------------------------------

export interface DistinguishabilityClaim {
  /** gameMatrix clone: 24 orders x 6 column pairs, claimed 0/1 */
  readonly gameMatrix: readonly number[][];
}

let cachedCensus: ReturnType<typeof hadamardCensus> | null = null;

function census(): ReturnType<typeof hadamardCensus> {
  cachedCensus ??= hadamardCensus();
  return cachedCensus;
}

/** Recompute the exact 24x6 game matrix and compare cell by cell. */
export function verifyDistinguishabilityMatrix(claim: DistinguishabilityClaim): VerifyResult {
  const truth = distinguishabilityMatrix(census());
  if (claim.gameMatrix.length !== 24) {
    return { ok: false, reason: `DISTINGUISHABILITY-COUNTERFEIT: claimed matrix has ${claim.gameMatrix.length} rows, the order census has 24` };
  }
  for (let pi = 0; pi < 24; pi++) {
    const row = claim.gameMatrix[pi]!;
    if (row.length !== truth.pairs.length) {
      return { ok: false, reason: `DISTINGUISHABILITY-COUNTERFEIT: row ${pi} has ${row.length} entries, machine has ${truth.pairs.length} column pairs` };
    }
    for (let q = 0; q < truth.pairs.length; q++) {
      const claimed = row[q]!;
      const actual = truth.gameMatrix[pi]![q]!;
      if (claimed !== actual) {
        const { y, y2 } = truth.pairs[q]!;
        return {
          ok: false,
          reason: `DISTINGUISHABILITY-COUNTERFEIT: order #${pi} on column pair (${y},${y2}) claimed ${claimed}, machine recomputes ${actual} — matched set pairs exist with same-ray products through this order`,
        };
      }
    }
  }
  const separated = truth.gameMatrix.flat().reduce((a, b) => a + b, 0);
  return { ok: true, reason: `distinguishability matrix verified: ${separated}/144 nonzero entries (machine: all zero — no plain order separates any column pair in the worst case)` };
}

// ---------------------------------------------------------------------------
// 3. The supersequence certificate (the fixed-order query bound witness).
// ---------------------------------------------------------------------------

export interface SupersequenceClaim {
  readonly length: number;
  /** witness string over {A,B,C,D} claimed to contain all four quartet orders */
  readonly witness: string;
}

/** Check the witness string, then re-derive the minimal length by enumeration. */
export function verifySupersequenceClaim(claim: SupersequenceClaim): VerifyResult {
  const word = [...claim.witness].map((ch) => "ABCD".indexOf(ch));
  if (word.some((v) => v < 0)) {
    return { ok: false, reason: `SUPERSEQUENCE-COUNTERFEIT: witness "${claim.witness}" contains letters outside {A,B,C,D}` };
  }
  if (word.length !== claim.length) {
    return { ok: false, reason: `SUPERSEQUENCE-COUNTERFEIT: claimed length ${claim.length}, witness has ${word.length} letters` };
  }
  const missing = ORDERS4.map((p, idx) => {
    let i = 0;
    for (const c of word) {
      if (c === p[i]) i++;
      if (i === p.length) return null;
    }
    return idx;
  }).filter((v): v is number => v !== null);
  if (missing.length > 0) {
    const labels = missing.map((i) => ORDERS4[i]!.join("")).join(", ");
    return { ok: false, reason: `SUPERSEQUENCE-COUNTERFEIT: witness "${claim.witness}" misses order(s) ${labels} as subsequences` };
  }
  const truth = shortestSupersequence(9);
  if (truth === null) throw new KSwitchError("SUPERSEQUENCE-SEARCH-FAILED", "the exhaustive machine search returned nothing up to length 9 — the search kernel is broken");
  if (claim.length < truth.minLength) {
    return {
      ok: false,
      reason: `SUPERSEQUENCE-COUNTERFEIT: claimed length ${claim.length} but the exhaustive machine census finds NO supersequence below ${truth.minLength} (all ${4 ** (truth.minLength - 1)} shorter strings checked)`,
    };
  }
  if (claim.length > truth.minLength) {
    return { ok: false, reason: `SUPERSEQUENCE-COUNTERFEIT: witness valid but not minimal — machine minimum is ${truth.minLength}` };
  }
  return { ok: true, reason: `supersequence certificate verified: length ${claim.length} minimal, witness contains all four orders` };
}

// ---------------------------------------------------------------------------
// 4. The Pauli-census certificate (commuting/anticommuting quadruple counts).
// ---------------------------------------------------------------------------

export interface CensusClaim {
  readonly commuting: number;
  readonly anticommuting: number;
  readonly mixed: number;
}

/** Recompute the C(15,4) = 1365 quadruple census and compare. */
export function verifyQuadCensus(claim: CensusClaim): VerifyResult {
  const truth = pauliQuadCensus();
  if (claim.commuting !== truth.commuting.length || claim.anticommuting !== truth.anticommuting.length || claim.mixed !== truth.mixed) {
    return {
      ok: false,
      reason: `PAULI-CENSUS-COUNTERFEIT: claimed (${claim.commuting} commuting, ${claim.anticommuting} anticommuting, ${claim.mixed} mixed), machine census has (${truth.commuting.length}, ${truth.anticommuting.length}, ${truth.mixed}) over C(15,4)=1365 quadruples`,
    };
  }
  return {
    ok: true,
    reason: `Pauli census verified: ${truth.commuting.length} commuting / ${truth.anticommuting.length} anticommuting / ${truth.mixed} mixed`,
  };
}
