/**
 * Process validity, executable. A 4-qubit operator W on A1 ⊗ A2 ⊗ B1 ⊗ B2
 * (qubit 0 = A1 most significant) is a valid process matrix iff:
 *
 *   (i)   W is Hermitian;
 *   (ii)  W is positive semidefinite;
 *   (iii) Tr[W] = d_{A1} d_{B1} = 4;
 *   (iv)  W is orthogonal to every FORBIDDEN Pauli pattern, derived here
 *         from first principles (TPCP invariance of total probability):
 *
 *   Expand W in the (unnormalized) Pauli basis
 *     W = sum_{jklm} c_{jklm} P_j^{A1} P_k^{A2} P_l^{B1} P_m^{B2},
 *     c_{jklm} = Tr[W (P_j⊗P_k⊗P_l⊗P_m)] / 16, real for Hermitian W.
 *
 *   Perturbing a TPCP instrument by X with Tr_{A2}[X] = 0 keeps it TPCP
 *   (to first order, PSD in the interior); such X contains only patterns
 *   with k ≠ 0. Total probability must stay 1 for ALL TPCP pairs, hence
 *     F1: k ≠ 0 with l = m = 0      (A2-operator with B trivial)  -> c = 0
 *     F2: m ≠ 0 with j = k = 0      (B2-operator with A trivial)  -> c = 0
 *     F3: k ≠ 0 and m ≠ 0           (A2 and B2 together)         -> c = 0
 *   and the symmetric Bob-side derivation gives F2, F3 again.
 *
 *   The 8 allowed nontrivial patterns: A1, B1, A1B1, A2B1, A1A2B1, A1B2,
 *   A1B1B2 (+ identity). Channels work: A2B1 carries A→B, A1B2 carries B→A;
 *   a party's own input-output correlation (A1A2 / B1B2) is forbidden —
 *   the process cannot pre-correlate a lab's input with its output.
 *
 * This executable rule is the machine face of OCB12's linear constraints
 * (their Fig. 3 term characterisation); the derivation above is spelled out
 * so it can be audited independently of the citation.
 */
import { cmatKron4, cmatTrace, cmatTraceProd, hermitianExtremeEig, hermiticityDeviation, type CMat } from "../core/cmat.js";

export const PAULI: readonly CMat[] = [
  { dim: 2, re: [[1, 0], [0, 1]], im: [[0, 0], [0, 0]] }, // 0: identity
  { dim: 2, re: [[0, 1], [1, 0]], im: [[0, 0], [0, 0]] }, // 1: X
  { dim: 2, re: [[0, 0], [0, 0]], im: [[0, -1], [1, 0]] }, // 2: Y
  { dim: 2, re: [[1, 0], [0, -1]], im: [[0, 0], [0, 0]] }, // 3: Z
];

export function pauliProduct(j: number, k: number, l: number, m: number): CMat {
  return cmatKron4(PAULI[j] as CMat, PAULI[k] as CMat, PAULI[l] as CMat, PAULI[m] as CMat);
}

/** True iff the pattern (j,k,l,m) is allowed by rules F1-F3. */
export function patternAllowed(j: number, k: number, l: number, m: number): boolean {
  if (k !== 0 && l === 0 && m === 0) return false; // F1
  if (m !== 0 && j === 0 && k === 0) return false; // F2
  if (k !== 0 && m !== 0) return false; // F3
  return true;
}

export interface PauliCoefficient {
  readonly j: number;
  readonly k: number;
  readonly l: number;
  readonly m: number;
  readonly c: number;
}

/** Pauli coefficients (real part; imaginary part reported via hermiticity check). */
export function pauliCoefficients(w: CMat): PauliCoefficient[] {
  const out: PauliCoefficient[] = [];
  for (let j = 0; j < 4; j++) {
    for (let k = 0; k < 4; k++) {
      for (let l = 0; l < 4; l++) {
        for (let m = 0; m < 4; m++) {
          const t = cmatTraceProd(w, pauliProduct(j, k, l, m));
          out.push({ j, k, l, m, c: t.re / 16 });
        }
      }
    }
  }
  return out;
}

export interface ValidityReport {
  readonly hermiticity: number;
  readonly minEig: number;
  readonly trace: number;
  readonly worstForbidden: { j: number; k: number; l: number; m: number; c: number };
  readonly violations: string[];
  readonly valid: boolean;
}

export function checkValidity(w: CMat, tol = 1e-12): ValidityReport {
  const violations: string[] = [];
  const herm = hermiticityDeviation(w);
  if (herm > tol) violations.push(`not Hermitian (deviation ${herm.toExponential(2)})`);
  const eig = hermitianExtremeEig(w);
  if (eig.min < -tol) violations.push(`not PSD (min eigenvalue ${eig.min.toExponential(2)})`);
  const tr = cmatTrace(w);
  if (Math.abs(tr - 4) > tol) violations.push(`trace ${tr} != 4`);
  let worstForbidden: { j: number; k: number; l: number; m: number; c: number } = { j: 0, k: 0, l: 0, m: 0, c: 0 };
  for (const p of pauliCoefficients(w)) {
    if (!patternAllowed(p.j, p.k, p.l, p.m) && Math.abs(p.c) > Math.abs(worstForbidden.c)) {
      worstForbidden = { j: p.j, k: p.k, l: p.l, m: p.m, c: p.c };
    }
  }
  if (Math.abs(worstForbidden.c) > tol) {
    violations.push(`forbidden pattern (A1:${worstForbidden.j},A2:${worstForbidden.k},B1:${worstForbidden.l},B2:${worstForbidden.m}) coefficient ${worstForbidden.c.toExponential(2)}`);
  }
  return { hermiticity: herm, minEig: eig.min, trace: tr, worstForbidden, violations, valid: violations.length === 0 };
}
