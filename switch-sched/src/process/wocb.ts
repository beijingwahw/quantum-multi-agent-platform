/**
 * The OCB process matrix, executable — the causally nonseparable process of
 * Oreshkov-Costa-Brukner, Nat. Commun. 3, 1092 (2012), Eq. (7):
 *
 *   W = ¼[ 𝟙 + (1/√2)( σ_z^{A2} σ_z^{B1} + σ_z^{A1} σ_x^{B1} σ_z^{B2} ) ]
 *
 * on registers (A1, A2, B1, B2), each a qubit (16×16). Every number in this
 * module comes from machine arithmetic on that matrix; nothing is copied from
 * the paper except the matrix itself (verified against both the arXiv
 * ar5iv rendering of 1105.4464 and nature.com/articles/ncomms2076).
 *
 * Validity of a process matrix (OCB Methods): (i) W ⪰ 0, (ii) normalization
 * Tr[W (M_A^{CPTP} ⊗ M_B^{CPTP})] = 1 for all local CPTP maps, (iii) term
 * types within the Fig. 3 set (termtype.ts). All three are machine-checked
 * here; (ii) is exact for the enumerated CPTP battery, sampled beyond it.
 */

import { type CMat, eigenvaluesHermitian, identity, isHermitian, kronAll, mAdd, mMul, mScale, mTrace } from '../core/cmat.js';
import { PAULI_X, PAULI_Z } from '../core/states.js';
import { cjMatrix, processProbability } from './cj.js';
import { causalWitness, gameWitnessFunctional, verifyCensusSizeCap } from './gypi.js';
import { judgeTermTypes, type TermJudge } from './termtype.js';

/** W_OCB = ¼[𝟙 + (σ_z^{A2}σ_z^{B1} + σ_z^{A1}σ_x^{B1}σ_z^{B2})/√2]. */
export function ocbProcess(): CMat {
  const zz = kronAll([identity(2), PAULI_Z, PAULI_Z, identity(2)]); // σ_z^{A2}σ_z^{B1}
  const zxz = kronAll([PAULI_Z, identity(2), PAULI_X, PAULI_Z]); // σ_z^{A1}σ_x^{B1}σ_z^{B2}
  const corrections = mScale(mAdd(zz, zxz), 1 / Math.SQRT2);
  return mScale(mAdd(identity(16), corrections), 1 / 4);
}

/** White-noise process 𝟙/4: PSD, term-type ∅, normalized — the convex lid. */
export function whiteNoiseProcess(): CMat {
  return mScale(identity(16), 1 / 4);
}

/** Isotropic mixture W(ν) = ν W_OCB + (1−ν) 𝟙/4 — a valid process ∀ν∈[0,1]. */
export function noisyOcbProcess(nu: number): CMat {
  return mAdd(mScale(ocbProcess(), nu), mScale(whiteNoiseProcess(), 1 - nu));
}

export interface EigenSummary {
  readonly min: number;
  readonly max: number;
  readonly negativeCount: number; // eigenvalues below −tol
  readonly values: readonly number[];
}

/** Hermitian eigenvalue summary with a PSD verdict at the given tolerance. */
export function eigenSummary(w: CMat, tol = 1e-12): EigenSummary {
  const eig = Array.from(eigenvaluesHermitian(w)).sort((x, y) => x - y);
  const min = eig[0];
  const max = eig[eig.length - 1];
  if (min === undefined || max === undefined) throw new Error('eigenSummary: empty spectrum');
  return {
    min,
    max,
    negativeCount: eig.filter((l) => l < -tol).length,
    values: eig,
  };
}

/**
 * Normalization on the identity/identity CPTP pair: Tr[W (𝟙⊗𝟙-Swap CJ pair)].
 * The CJ of each identity channel is the SWAP operator (OCB convention), so
 * the battery entry is Tr[W · SWAP^{A1A2} ⊗ SWAP^{B1B2}] and must equal 1.
 */
export function normalizationOnIdentities(w: CMat): number {
  const swap = cjMatrix([identity(2)]); // = SWAP in the OCB convention
  return processProbability(w, swap, swap);
}

/**
 * Normalization battery: identity channels, depolarizing channels, and
 * random-unitary mixtures — for each, Tr[W (M_A ⊗ M_B)] must be exactly 1.
 * Returns the largest deviation found.
 */
export function normalizationDeviation(w: CMat, extraCptp: ReadonlyArray<readonly CMat[]>): number {
  let worst = Math.abs(normalizationOnIdentities(w) - 1);
  for (const kraus of extraCptp) {
    const p = processProbability(w, cjMatrix(kraus), cjMatrix(kraus));
    worst = Math.max(worst, Math.abs(p - 1));
  }
  return worst;
}

/** Full structural + metric validity verdict of a candidate process matrix. */
export interface ProcessValidity {
  readonly hermitian: boolean;
  readonly psd: boolean;
  readonly eig: EigenSummary;
  readonly termJudge: TermJudge;
  readonly normalizationError: number;
  readonly valid: boolean;
}

export function judgeProcess(w: CMat, extraCptp: ReadonlyArray<readonly CMat[]> = []): ProcessValidity {
  const eig = eigenSummary(w);
  const termJudge = judgeTermTypes(w);
  const normalizationError = normalizationDeviation(w, extraCptp);
  const valid =
    isHermitian(w) && eig.negativeCount === 0 && termJudge.valid && normalizationError < 1e-10;
  return { hermitian: isHermitian(w), psd: eig.negativeCount === 0, eig, termJudge, normalizationError, valid };
}

/** Game value p_succ(W) via the linear functional Tr[W · S_game]. */
export function gameValueFunctional(w: CMat): number {
  return mTrace(mMul(w, gameWitnessFunctional())).re;
}

/** Witness value Tr[S W] with S = ¾·𝟙 − S_game; negative ⇔ causally nonseparable evidence. */
export function witnessValue(w: CMat): number {
  return mTrace(mMul(w, causalWitness())).re;
}

// ---------------------------------------------------------------------------
// Smuggling-trial checker #2: witness certificates must survive recomputation
// AND the claimed process must pass all three validity gates. A counterfeit
// (inflated gap, fake PSD, forbidden term types) is NAMED and REJECTED.
// ---------------------------------------------------------------------------

export interface WitnessCertificate {
  readonly process: CMat;
  /** claimed Tr[S W] (negative = violation claim) */
  readonly claimedWitnessValue: number;
  /** claimed game value p_succ = ¾ − witness */
  readonly claimedGameValue: number;
}

export interface WitnessVerdict {
  readonly ok: boolean;
  readonly reason: string;
}

/**
 * Verify a witness certificate end-to-end: recompute Tr[S W] from the process
 * matrix itself, recompute p_succ by the from-scratch Born-rule loop, and run
 * the full validity judge. Any gap between claim and machine is NAMED.
 */
export function verifyWitnessCertificate(claim: WitnessCertificate): WitnessVerdict {
  const w = claim.process;
  const wit = witnessValue(w);
  const game = gameValueFunctional(w);
  if (Math.abs(claim.claimedWitnessValue - wit) > 1e-12) {
    return {
      ok: false,
      reason: `WITNESS-COUNTERFEIT: certificate claims Tr[S W] = ${claim.claimedWitnessValue.toFixed(6)}, machine recomputes ${wit.toFixed(6)} — the gap is fabricated`,
    };
  }
  if (Math.abs(claim.claimedGameValue - game) > 1e-12) {
    return {
      ok: false,
      reason: `WITNESS-COUNTERFEIT: certificate claims p_succ = ${claim.claimedGameValue.toFixed(6)}, machine recomputes ${game.toFixed(6)}`,
    };
  }
  if (!isHermitian(w)) {
    return { ok: false, reason: 'WITNESS-COUNTERFEIT: claimed process is not even Hermitian' };
  }
  const eig = eigenSummary(w);
  if (eig.negativeCount > 0) {
    return {
      ok: false,
      reason: `WITNESS-COUNTERFEIT: claimed process is not PSD (min eigenvalue ${eig.min.toExponential(2)}, ${eig.negativeCount} negative) — it is not a physical process`,
    };
  }
  const tj = judgeTermTypes(w);
  if (!tj.valid) {
    const bad = tj.forbidden[0]!;
    return {
      ok: false,
      reason: `WITNESS-COUNTERFEIT: term type ${bad.type} (coefficient ${bad.coefficient.toFixed(3)}) is forbidden by OCB Fig. 3 — an invalid process smuggled into the witness slot`,
    };
  }
  return { ok: true, reason: `verified: recomputed Tr[S W] = ${wit.toFixed(6)}, structure valid` };
}

/**
 * The classical cap certificate: exhaustive census recomputation plus witness
 * nonnegativity on the census optimum (the polytope argument is linear, so
 * the vertex cap caps every shared-randomness strategy). The size/cap
 * counterfeit check is the shared core in gypi.ts — one checker, two entry
 * shapes, no divergent copies of the conviction message.
 */
export function verifyClassicalCapRecord(claimed: {
  familySize: number;
  maxPsucc: number;
}): WitnessVerdict {
  return verifyCensusSizeCap(claimed);
}
