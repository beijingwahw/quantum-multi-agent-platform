/**
 * Pauli term-type judge for 4-qubit process matrices — the machine form of
 * OCB 2012, Fig. 3: a Hermitian operator on (A1 A2 B1 B2) satisfies the
 * normalization condition Tr[M_A CPTP ⊗ M_B CPTP] = 1 for all local CPTP maps
 * iff its Pauli expansion
 *
 *   W = Σ_{μνλγ} c_{μνλγ} σ_μ^{A1} σ_ν^{A2} σ_λ^{B1} σ_γ^{B2}
 *
 * contains only the term TYPES
 *   ∅, A1, B1, A1B1, A2B1, A1A2B1, A1B2, A1B1B2,
 * with the direction sub-families
 *   W^{A⋠B}-type: {∅, A1, B1, A1B1, A2B1, A1A2B1}  (no term touches B2),
 *   W^{B⋠A}-type: {∅, A1, B1, A1B1, A1B2, A1B1B2}  (no term touches A2).
 * A term touching A2 (resp. B2) without the other party's input is the
 * signature of postselection-type invalidity. The judge is exhaustive in
 * dimension: the Pauli basis spans all Hermitian operators on four qubits.
 *
 * Combined with PSD (an eigenvalue check), this is the exact validity
 * certificate for processes at d = 2 per wire.
 */

import { type CMat, identity, kron, mMul, mTrace } from '../core/cmat.js';
import { PAULI_X, PAULI_Y, PAULI_Z } from '../core/states.js';

const PAULIS: readonly CMat[] = [identity(2), PAULI_X, PAULI_Y, PAULI_Z];
const PAULI_NAMES = ['I', 'X', 'Y', 'Z'] as const;

/** Term types present in a valid process (OCB Fig. 3). */
export const VALID_TERM_TYPES: readonly string[] = [
  '',
  'A1',
  'B1',
  'A1B1',
  'A2B1',
  'A1A2B1',
  'A1B2',
  'A1B1B2',
];

/** Direction sub-families of causally ordered processes. */
export const A_NOT_BEFORE_B_TYPES: readonly string[] = ['', 'A1', 'B1', 'A1B1', 'A2B1', 'A1A2B1'];
export const B_NOT_BEFORE_A_TYPES: readonly string[] = ['', 'A1', 'B1', 'A1B1', 'A1B2', 'A1B1B2'];

export interface PauliTerm {
  readonly factors: readonly [string, string, string, string];
  readonly type: string;
  readonly coefficient: number;
}

/** Decompose a 16×16 Hermitian operator on (A1,A2,B1,B2) into Pauli terms. */
export function pauliTerms(w: CMat, tol = 1e-12): PauliTerm[] {
  const terms: PauliTerm[] = [];
  for (let mu = 0; mu < 4; mu++) {
    for (let nu = 0; nu < 4; nu++) {
      for (let lam = 0; lam < 4; lam++) {
        for (let gam = 0; gam < 4; gam++) {
          const op = kron(kron(kron(PAULIS[mu]!, PAULIS[nu]!), PAULIS[lam]!), PAULIS[gam]!);
          const c = mTrace(mMul(w, op)).re / 16;
          const t = mTrace(mMul(op, op)).re / 16; // should be 1
          if (Math.abs(t - 1) > 1e-12) throw new Error('pauliTerms: normalization of Pauli basis');
          if (Math.abs(c) > tol) {
            const factors: [string, string, string, string] = [
              PAULI_NAMES[mu]!,
              PAULI_NAMES[nu]!,
              PAULI_NAMES[lam]!,
              PAULI_NAMES[gam]!,
            ];
            terms.push({ factors, type: termType(factors), coefficient: c });
          }
        }
      }
    }
  }
  return terms;
}

/** Term type label, e.g. factors ['I','Z','I','Z'] → 'A2B1'. */
export function termType(factors: readonly string[]): string {
  const names = ['A1', 'A2', 'B1', 'B2'];
  return names.filter((_, k) => factors[k] !== 'I').join('');
}

export interface TermJudge {
  readonly terms: readonly PauliTerm[];
  readonly forbidden: readonly PauliTerm[];
  readonly valid: boolean;
}

/** Structural validity judge: are all term types in the OCB Fig. 3 set? */
export function judgeTermTypes(w: CMat, tol = 1e-12): TermJudge {
  const terms = pauliTerms(w, tol);
  const forbidden = terms.filter((t) => !VALID_TERM_TYPES.includes(t.type));
  return { terms, forbidden, valid: forbidden.length === 0 };
}

/** Direction slices: terms that could only come from each ordering. */
export function orderExclusiveTerms(w: CMat, tol = 1e-12): {
  a2Touching: readonly PauliTerm[]; // terms requiring an A⋠B component
  b2Touching: readonly PauliTerm[]; // terms requiring a B⋠A component
} {
  const terms = pauliTerms(w, tol);
  return {
    a2Touching: terms.filter((t) => t.factors[1] !== 'I'),
    b2Touching: terms.filter((t) => t.factors[3] !== 'I'),
  };
}
