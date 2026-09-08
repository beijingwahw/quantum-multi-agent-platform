/**
 * The multi-party desk — a 3-party GHZ bank, and whether the mint wall
 * survives non-bipartite structures. The census is bounded and exact where
 * exactness is possible: pairwise concurrences of GHZ are exactly 0, every
 * 1-vs-2 cut carries exactly 1/2 negativity, and C's X-measurement plus one
 * cbit withdraws a STANDARD coin onto any pairwise ledger (exact
 * counterexample to a pairwise wall). The wall that survives is per cut:
 * a census of random local channels never raises any cut's negativity
 * (the monotonicity is VW02, cited; the census is the testimony).
 */
import { type CMat, type CVec, identity, kron, kronAll, mScale, outer, vAdd, vKron, vScale } from "../core/cmat.js";
import { applyKraus, partialTrace } from "../core/channels.js";
import { negativity, traceReal } from "../core/measures.js";
import { KET0, KET1, PLUS, MINUS, vecToRho } from "../core/states.js";
import type { Rng } from "../core/rng.js";
import { concurrence, randomLocalKraus } from "./clearing.js";

/** |GHZ> = (|000> + |111>)/sqrt(2) as an 8x8 density matrix. */
export function ghzCoin(): CMat {
  const k000 = vKron(vKron(KET0, KET0), KET0);
  const k111 = vKron(vKron(KET1, KET1), KET1);
  const psi = vScale(vAdd(k000, k111), 1 / Math.SQRT2);
  return vecToRho(psi);
}

/** Pairwise concurrences [AB, AC, BC] of a 3-qubit state. */
export function ghzPairwiseConcurrences(rho: CMat): readonly [number, number, number] {
  const ab = partialTrace(rho, [2, 2, 2], [2]);
  const ac = partialTrace(rho, [2, 2, 2], [1]);
  const bc = partialTrace(rho, [2, 2, 2], [0]);
  return [concurrence(ab), concurrence(ac), concurrence(bc)];
}

/** Cut negativities [AB|C, A|BC, B|AC] of a 3-qubit state. */
export function ghzCutNegativities(rho: CMat): readonly [number, number, number] {
  return [
    negativity(rho, [2, 2, 2], [2]),
    negativity(rho, [2, 2, 2], [0]),
    negativity(rho, [2, 2, 2], [1]),
  ];
}

export interface GhzWithdrawal {
  /** Branch probabilities: exactly 1/2 each. */
  readonly pPlus: number;
  readonly pMinus: number;
  /** The AB pair on each branch: exactly |Phi+> / |Phi->. */
  readonly abPlus: CMat;
  readonly abMinus: CMat;
  /** The JOINT post-measurement state on each branch (for the cut ledger). */
  readonly jointPlus: CMat;
  readonly jointMinus: CMat;
  /** The classical leg's cost: C announces her outcome. */
  readonly cbits: number;
}

/**
 * The withdrawal: C measures her qubit in the X basis and sends 1 cbit.
 * Each branch collapses AB to a known Bell pair — a standard coin on the
 * AB ledger, funded by the bank's joint holding.
 */
export function withdrawToAB(): GhzWithdrawal {
  const g = ghzCoin();
  const kraus = (phi: CVec): CMat => kron(kron(identity(2), identity(2)), outer(phi, phi));
  const unPlus = applyKraus(g, [kraus(PLUS)]);
  const unMinus = applyKraus(g, [kraus(MINUS)]);
  const pPlus = traceReal(unPlus);
  const pMinus = traceReal(unMinus);
  return {
    pPlus,
    pMinus,
    abPlus: mScale(partialTrace(unPlus, [2, 2, 2], [2]), 1 / pPlus),
    abMinus: mScale(partialTrace(unMinus, [2, 2, 2], [2]), 1 / pMinus),
    jointPlus: mScale(unPlus, 1 / pPlus),
    jointMinus: mScale(unMinus, 1 / pMinus),
    cbits: 1,
  };
}

export interface GhzCensus {
  readonly rounds: number;
  /** Worst pairwise concurrence seen across rounds (GHZ starts at 0). */
  readonly worstPairwiseC: number;
  /** Worst cut negativity seen across rounds (GHZ starts at 1/2 per cut). */
  readonly worstCut: number;
  /** Worst pairwise deviation from separability, exact route. */
  readonly worstCutRise: number;
}

/** A census of random single-party local channels applied to all parties. */
export function ghzLocalCensus(rng: Rng, rounds: number): GhzCensus {
  let worstPairwiseC = 0;
  let worstCut = 0;
  let worstCutRise = 0;
  for (let t = 0; t < rounds; t++) {
    let rho = ghzCoin();
    for (let party = 0; party < 3; party++) {
      const kraus = randomLocalKraus(rng);
      const embedded = kraus.map((k) => {
        const parts: CMat[] = [];
        for (let j = 0; j < 3; j++) parts.push(j === party ? k : identity(2));
        return kronAll(parts);
      });
      rho = applyKraus(rho, embedded);
    }
    for (const c of ghzPairwiseConcurrences(rho)) worstPairwiseC = Math.max(worstPairwiseC, c);
    for (const n of ghzCutNegativities(rho)) {
      worstCut = Math.max(worstCut, n);
      worstCutRise = Math.max(worstCutRise, n - 0.5);
    }
  }
  return { rounds, worstPairwiseC, worstCut, worstCutRise };
}

export type GhzClaimTag = "HOLDS" | "REFUTED" | "CENSUS";

export interface GhzClaimRow {
  readonly id: string;
  readonly claim: string;
  readonly tag: GhzClaimTag;
}

/**
 * The bank's findings as claimable rows — the checker (law H8) recomputes
 * each verdict from the machinery and rejects a refuted wall claimed as
 * holding.
 */
export const GHZ_CLAIMS: readonly GhzClaimRow[] = [
  { id: "G1", claim: "GHZ pairwise concurrences are exactly 0 (no two parties share a coin)", tag: "HOLDS" },
  { id: "G2", claim: "every 1-vs-2 cut carries exactly 1/2 negativity (the bank's joint holding)", tag: "HOLDS" },
  { id: "G3", claim: "C measures X and sends 1 cbit: AB receive a known standard coin on both branches (purity, fidelity, concurrence all exact)", tag: "HOLDS" },
  { id: "G4", claim: "the withdrawal conserves the A|BC and B|AC cuts exactly (1/2 -> 1/2) and drops AB|C exactly (1/2 -> 0)", tag: "HOLDS" },
  { id: "G5", claim: "no tripartite LOCC raises pairwise concurrence — a pairwise mint wall", tag: "REFUTED" },
  { id: "G6", claim: "random local channels never raise any cut's negativity (150-round census; the monotonicity is VW02, cited)", tag: "CENSUS" },
  { id: "G7", claim: "random local channels keep every pairwise reduction separable (C stays 0, 150-round census)", tag: "CENSUS" },
];
