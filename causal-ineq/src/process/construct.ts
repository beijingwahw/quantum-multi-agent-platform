/**
 * Candidate process matrices, constructed so the validity checker is the
 * referee (never the constructor's say-so).
 *
 * Spaces: A1 (qubit 0, MSB), A2 (qubit 1), B1 (qubit 2), B2 (qubit 3).
 *
 * The violating process (machine-derived, first principles):
 *   W*(c) = (1/4)[ 1 + c ( Z^A2 Z^B1 + Z^A1 X^B1 Z^B2 ) ],  c = 1/sqrt(2).
 * Both terms use allowed patterns (A2B1, A1B1B2). The two Pauli products
 * anticommute (they share exactly B1 with X vs Z), each squaring to 1, so
 * (T1+T2)/sqrt(2) has eigenvalues +-1 and W* has eigenvalues exactly {0, 1/2}
 * — PSD with certificate-grade precision. Tr[W*] = 4 exactly.
 *
 * Game mechanics of the two terms (OCB protocol):
 *   - Z^A2 Z^B1: Bob's z-measurement of B1 reveals Alice's z-encoded bit a
 *     (the b'=1 branch wins with 1/2 (1 + c)).
 *   - Z^A1 X^B1 Z^B2: Bob's x-outcome t enters twice — his own encoding
 *     b (+) t and the correlation — and cancels: (−1)^{x+b+t+t}. Alice's
 *     z-measurement of A1 reveals b regardless of t (the b'=0 branch).
 */
import { cmatAdd, cmatEye, cmatKron4, cmatScale, type CMat } from "../core/cmat.js";
import { PAULI, pauliProduct } from "./validity.js";

const I = PAULI[0] as CMat;
const X = PAULI[1] as CMat;
const Z = PAULI[3] as CMat;

/** The maximally mixed (fully non-signaling) process: W = 1/4 · 1_16. */
export function wMixed(): CMat {
  return cmatEye(16, 0.25);
}

/**
 * The A-before-B identity-channel process:
 * W = (1/2 · 1)^{A1} ⊗ |Φ><Φ|^{A2,B1} ⊗ 1^{B2}, with |Φ> = |00>+|11>
 * carrying A's output into B's input. Expanding |Φ><Φ| = (1/2)(11 + XX − YY + ZZ):
 *   W^{A≺B} = (1/4)[ 11 + X^{A2}X^{B1} − Y^{A2}Y^{B1} + Z^{A2}Z^{B1} ] (kron-folded).
 * Trace 4, PSD, allowed patterns (A2B1) only.
 */
export function wChannelAB(): CMat {
  const Y = PAULI[2] as CMat;
  return cmatScale(
    cmatAdd(
      cmatAdd(cmatKron4(I, I, I, I), cmatKron4(I, X, X, I)),
      cmatAdd(cmatScale(cmatKron4(I, Y, Y, I), -1), cmatKron4(I, Z, Z, I)),
    ),
    0.25,
  );
}

/**
 * The B-before-A identity-channel process (channel B2 -> A1):
 *   W^{B≺A} = (1/4)[ 11 + X^{A1}X^{B2} − Y^{A1}Y^{B2} + Z^{A1}Z^{B2} ].
 */
export function wChannelBA(): CMat {
  const Y = PAULI[2] as CMat;
  return cmatScale(
    cmatAdd(
      cmatAdd(cmatKron4(I, I, I, I), cmatKron4(X, I, I, X)),
      cmatAdd(cmatScale(cmatKron4(Y, I, I, Y), -1), cmatKron4(Z, I, I, Z)),
    ),
    0.25,
  );
}

/** W*(c): the candidate violating family. */
export function wStar(c: number): CMat {
  const t1 = pauliProduct(0, 3, 3, 0); // Z^A2 Z^B1
  const t2 = pauliProduct(3, 0, 1, 3); // Z^A1 X^B1 Z^B2
  return cmatScale(cmatAdd(cmatEye(16, 1), cmatScale(cmatAdd(t1, t2), c)), 0.25);
}

/** White noise blend: eta W* + (1−eta) mixed. Linear in eta by construction. */
export function wNoisy(eta: number): CMat {
  return cmatAdd(cmatScale(wStar(Math.SQRT1_2), eta), cmatScale(wMixed(), 1 - eta));
}

/** Negative control: valid-looking W with a forbidden A2-with-B-trivial term. */
export function wForbiddenF1(): CMat {
  // Z^A1 Z^A2 (pattern A1A2) — physically: process pre-correlating Alice's
  // input with her output, enabling her to learn the input before acting.
  return cmatAdd(cmatEye(16, 0.25), cmatScale(pauliProduct(3, 3, 0, 0), 0.05));
}

/** Negative control: forbidden A2-B2 term (outputs coupled to outputs). */
export function wForbiddenF3(): CMat {
  return cmatAdd(cmatEye(16, 0.25), cmatScale(pauliProduct(0, 1, 0, 1), 0.05));
}

/** Negative control: PSD violation (coefficient beyond the PSD window). */
export function wNotPSD(): CMat {
  return cmatAdd(cmatEye(16, 0.25), cmatScale(pauliProduct(0, 3, 3, 0), 0.9));
}
