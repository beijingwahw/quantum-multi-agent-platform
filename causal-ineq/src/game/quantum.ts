/**
 * T3 — the process Born rule, executed.
 *
 * Local operations via the Choi-Jamiołkowski representation with the OCB
 * transpose convention: the CP map "detect |psi> on the input qubit, prepare
 * |phi> on the output qubit" has CJ matrix
 *     M = |psi*><psi*|^{in} ⊗ |phi><phi|^{out}.
 * The process matrix Born rule: P = Tr[W (M^A ⊗ M^B)], factors kron-folded
 * in the global order A1 ⊗ A2 ⊗ B1 ⊗ B2.
 *
 * The OCB protocol, exactly as in their Methods:
 *   Alice (input a): measure A1 in the z basis; guess x = outcome (z+ -> 0,
 *     z- -> 1); prepare A2 in the z-encoding |a> of her bit.
 *   Bob (inputs b, b'): b' = 1: measure B1 in the z basis; guess y = outcome;
 *     prepare |0>.  b' = 0: measure B1 in the x basis; outcome t (x+ -> 0,
 *     x- -> 1); prepare the z-encoding of b XOR t.
 *
 * All z/x basis states are real, so the complex conjugate in the CJ is
 * trivial here — the kernels stay complex regardless, so any strategy family
 * with complex states drops in without changes.
 */
import { cmatKron4, cmatTraceProd, type CMat } from "../core/cmat.js";

/** Real-basis qubit projector |v><v| for v in {e0, e1, |+>, |->}. */
function proj(v: readonly [number, number]): CMat {
  return {
    dim: 2,
    re: [[v[0] * v[0], v[0] * v[1]], [v[1] * v[0], v[1] * v[1]]],
    im: [[0, 0], [0, 0]],
  };
}

const E0: readonly [number, number] = [1, 0];
const E1: readonly [number, number] = [0, 1];
const PLUS: readonly [number, number] = [1 / Math.SQRT2, 1 / Math.SQRT2];
const MINUS: readonly [number, number] = [1 / Math.SQRT2, -1 / Math.SQRT2];

export interface GameProbabilities {
  /** P(x = b) averaged over a, b — the b' = 0 branch */
  readonly pAliceGuesses: number;
  /** P(y = a) averaged over a, b — the b' = 1 branch */
  readonly pBobGuesses: number;
  readonly pSuccess: number;
}

/**
 * Execute the OCB protocol on a process matrix W and return the game
 * probabilities. Every number is Tr[W (M^A ⊗ M^B)] over exact complex
 * arithmetic — no sampling.
 */
export function runProtocol(w: CMat): GameProbabilities {
  // Bob's branch probabilities per (a, b)
  let pAliceSum = 0; // over (a,b): P(x = b | a, b, b'=0)
  let pBobSum = 0; // over (a,b): P(y = a | a, b, b'=1)
  for (let a = 0; a < 2; a++) {
    for (let b = 0; b < 2; b++) {
      const aPrep = proj(a === 0 ? E0 : E1);
      // b' = 0 branch: Alice detects z (outcome x), Bob measures x (outcome t)
      // and prepares the z-encoding of b XOR t. Bob's outcome is summed over.
      for (let x = 0; x < 2; x++) {
        const aliceDetect = proj(x === 0 ? E0 : E1);
        for (let t = 0; t < 2; t++) {
          const bobDetect = proj(t === 0 ? PLUS : MINUS);
          const p = cmatTraceProd(w, cmatKron4(aliceDetect, aPrep, bobDetect, proj((b ^ t) === 0 ? E0 : E1))).re;
          if (x === b) pAliceSum += p;
        }
      }
      // b' = 1 branch: Alice as before; Bob detects z (outcome y), prepares |0>.
      for (let x = 0; x < 2; x++) {
        const aliceDetect = proj(x === 0 ? E0 : E1);
        for (let y = 0; y < 2; y++) {
          const bobDetect = proj(y === 0 ? E0 : E1);
          const p = cmatTraceProd(w, cmatKron4(aliceDetect, aPrep, bobDetect, proj(E0))).re;
          if (y === a) pBobSum += p;
        }
      }
    }
  }
  // each branch: average over the 4 (a,b) combos
  const pAliceGuesses = pAliceSum / 4;
  const pBobGuesses = pBobSum / 4;
  return { pAliceGuesses, pBobGuesses, pSuccess: 0.5 * pAliceGuesses + 0.5 * pBobGuesses };
}

/** Branch success under a rotated Bob measurement for b'=1 (axis in the x-z plane, theta = 0 is z). */
export function bobAngleBranch(w: CMat, theta: number): number {
  const c = Math.cos(theta / 2);
  const s = Math.sin(theta / 2);
  // projectors onto the +/- eigenstates of cos(theta) Z + sin(theta) X
  const mk = (sign: number): CMat => {
    const v: readonly [number, number] = sign > 0 ? [c, s] : [s, -c];
    return proj(v);
  };
  let pBobSum = 0;
  for (let a = 0; a < 2; a++) {
    for (let b = 0; b < 2; b++) {
      const aPrep = proj(a === 0 ? E0 : E1);
      for (let x = 0; x < 2; x++) {
        // marginal over BOTH of Alice's z-outcomes — the T2 term cancels in this sum
        const aliceDetect = proj(x === 0 ? E0 : E1);
        for (let y = 0; y < 2; y++) {
          const bobDetect = mk(y === 0 ? 1 : -1);
          const p = cmatTraceProd(w, cmatKron4(aliceDetect, aPrep, bobDetect, proj(E0))).re;
          if (y === a) pBobSum += p;
        }
      }
    }
  }
  return pBobSum / 4;
}
