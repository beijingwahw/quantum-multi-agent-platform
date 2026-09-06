/**
 * Independent physics referee: full density-matrix simulation of the actual
 * multi-qubit circuits, sharing nothing with the analytic Bell-vector algebra
 * except the definition of a Werner state's density matrix.
 *
 * Layout convention: qubit 0 is the most significant bit. A two-pair register
 * is (q0 q1) = pair A, (q2 q3) = pair B.
 *
 * Circuits:
 *  - swap:      Bell measurement on the middle qubits (q1,q2) implemented as
 *               CNOT(1→2), H(1), then Z-measurement of q1,q2; postselect the
 *               Φ+ outcome (q1=q2=0). Other outcomes are equivalent up to a
 *               Pauli frame fix, which the referee verifies explicitly.
 *  - purify:    BBPSSW — bilateral CNOT (q0→q2, q1→q3), Z-measure pair B,
 *               postselect agreeing outcomes, apply the bilateral-X frame
 *               correction for the (1,1) branch.
 *  - depol:     with probability p, discard-and-replace one qubit by I/2.
 */

import {
  type CxMat,
  G_H,
  G_X,
  G_Z,
  add,
  cnot,
  conjugate,
  dagger,
  expectationReal,
  gate1,
  kron,
  maxOffDiagonal,
  partialTrace,
  projectZ,
  scale,
  trace,
  zeros,
} from "../core/cx.js";
import { BELL_STATES, type BellVec } from "./bell.js";

/** Density matrix (4×4) of a Werner state with fidelity F. */
export function wernerDM(f: number): CxMat {
  const m = zeros(4);
  // F|Φ+⟩⟨Φ+| + (1−F)/3 · (I − |Φ+⟩⟨Φ+|)
  const pp = BELL_STATES[0]!; // BELL_STATES is a literal 4-entry table
  const w = (1 - f) / 3;
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++)
      m.re[i * 4 + j] = f * pp[i]! * pp[j]! + (i === j ? w : 0) - w * pp[i]! * pp[j]!;
  return m;
}

/** Bell vector of a 4×4 state: overlaps with the four Bell states. */
export function bellVectorOf(rho: CxMat): BellVec {
  const out = new Float64Array(4);
  for (let k = 0; k < 4; k++) out[k] = expectationReal(rho, BELL_STATES[k]!);
  return out;
}

/** Renormalize ρ by its trace; returns {state, prob}. */
function renormalize(rho: CxMat): { state: CxMat; prob: number } {
  const p = trace(rho).re;
  return { state: scale(rho, 1 / p), prob: p };
}

/**
 * Referee for entanglement swapping of two Werner pairs (fA on qubits 0,1;
 * fB on qubits 2,3). Returns the Φ+-outcome branch: success probability
 * (trace of the postselected state) and the Bell vector of the surviving
 * outer pair (qubits 0,3).
 */
export function refereeSwap(fA: number, fB: number): { p: number; vec: BellVec } {
  const rho0 = kron(wernerDM(fA), wernerDM(fB));
  // Bell analyzer on middle qubits: CNOT(1→2) then H(1); (q1,q2)=(0,0) ⟺ Φ+
  let rho = conjugate(rho0, cnot(4, 1, 2));
  rho = conjugate(rho, gate1(4, 1, G_H));
  let post = projectZ(rho, 1, 0);
  post = projectZ(post, 2, 0);
  const { state, prob } = renormalize(post);
  const outer = partialTrace(state, [0, 3]);
  return { p: prob, vec: bellVectorOf(outer) };
}

/**
 * Same swap, but postselecting the Φ− analyzer outcome and repairing it with
 * a Z frame fix on qubit 3 — proves frame corrections make every BSM outcome
 * equivalent, which the analytic convolution implicitly assumes.
 */
export function refereeSwapPhiMinus(fA: number, fB: number): BellVec {
  const rho0 = kron(wernerDM(fA), wernerDM(fB));
  let rho = conjugate(rho0, cnot(4, 1, 2));
  rho = conjugate(rho, gate1(4, 1, G_H));
  // analyzer outcome (q1,q2) = (1,0) ⟺ Φ−
  let post = projectZ(rho, 1, 1);
  post = projectZ(post, 2, 0);
  const { state } = renormalize(post);
  const fixed = conjugate(state, gate1(4, 3, G_Z));
  const outer = partialTrace(fixed, [0, 3]);
  return bellVectorOf(outer);
}

/**
 * Referee for one round of BBPSSW purification on two Werner pairs (f1 on
 * qubits 0,1; f2 on qubits 2,3). Bilateral CNOT (0→2, 1→q3), Z-measure pair
 * B, postselect agreeing outcomes (00 or 11), bilateral-X frame fix on the
 * 11 branch. Returns {p, vec} of the surviving pair A.
 */
export function refereePurify(f1: number, f2: number): { p: number; vec: BellVec } {
  const rho0 = kron(wernerDM(f1), wernerDM(f2));
  const cx = cnot(4, 0, 2);
  const cx2 = cnot(4, 1, 3);
  const rho = conjugate(conjugate(rho0, cx), cx2);

  // outcome (0,0) on qubits 2,3
  let a = projectZ(rho, 2, 0);
  a = projectZ(a, 3, 0);
  // outcome (1,1): bilateral X on pair A repairs the frame
  let b = projectZ(rho, 2, 1);
  b = projectZ(b, 3, 1);
  const bx = conjugate(b, gate1(4, 0, G_X));
  const bFixed = conjugate(bx, gate1(4, 1, G_X));

  const combined = add(a, bFixed);
  const { state, prob } = renormalize(combined);
  const kept = partialTrace(state, [0, 1]);
  return { p: prob, vec: bellVectorOf(kept) };
}

/**
 * Referee for single-qubit depolarization of a stored pair: with probability
 * p, qubit `q` is replaced by I/2 (trace-and-discard), applied coherently over
 * the whole register.
 */
export function refereeDepol(f: number, p: number, qubit: 0 | 1): BellVec {
  const rho = replaceQubit(wernerDM(f), qubit);
  const mixed = add(scale(wernerDM(f), 1 - p), scale(rho, p));
  return bellVectorOf(mixed);
}

/** (I/2) ⊗ Tr_qubit ρ, keeping the qubit's slot in the register. */
function replaceQubit(rho: CxMat, qubit: 0 | 1): CxMat {
  const out = zeros(4);
  // basis |ab⟩, index = a*2 + b; qubit 0 = a, qubit 1 = b
  for (let ai = 0; ai < 2; ai++)
    for (let bi = 0; bi < 2; bi++)
      for (let aj = 0; aj < 2; aj++)
        for (let bj = 0; bj < 2; bj++) {
          if (qubit === 0 && ai !== aj) continue;
          if (qubit === 1 && bi !== bj) continue;
          if (qubit === 0) {
            // Σ_k ρ[(k,bi),(k,bj)] · 1/2, copied into every (ai,aj) slot
            // (all indices < 16 = the size of the 4×4 register)
            for (let k = 0; k < 2; k++) {
              const src = (k * 2 + bi) * 4 + (k * 2 + bj);
              const r = rho.re[src]!;
              const i = rho.im[src]!;
              const dst = (ai * 2 + bi) * 4 + (aj * 2 + bj);
              out.re[dst] = out.re[dst]! + 0.5 * r;
              out.im[dst] = out.im[dst]! + 0.5 * i;
            }
          } else {
            for (let k = 0; k < 2; k++) {
              const src = (ai * 2 + k) * 4 + (aj * 2 + k);
              const r = rho.re[src]!;
              const i = rho.im[src]!;
              const dst = (ai * 2 + bi) * 4 + (aj * 2 + bj);
              out.re[dst] = out.re[dst]! + 0.5 * r;
              out.im[dst] = out.im[dst]! + 0.5 * i;
            }
          }
        }
  return out;
}

/** Off-diagonal magnitude of ρ expressed in the Bell basis (diagonality check). */
export function bellBasisCoherence(rho: CxMat): number {
  // columns of u are the (real, orthonormal) Bell vectors; coordinates in the
  // Bell basis are u†ρu, so rotate with dagger(u)
  const u = zeros(4);
  for (let k = 0; k < 4; k++)
    for (let i = 0; i < 4; i++) u.re[i * 4 + k] = BELL_STATES[k]![i]!;
  return maxOffDiagonal(conjugate(rho, dagger(u)));
}

/** Bell-diagonal density matrix from a Bell vector. */
export function bellDiagonalDM(l: Float64Array): CxMat {
  const u = zeros(4);
  for (let k = 0; k < 4; k++)
    for (let i = 0; i < 4; i++) u.re[i * 4 + k] = BELL_STATES[k]![i]!;
  const d = zeros(4);
  for (let i = 0; i < 4; i++) d.re[i * 4 + i] = l[i]!; // l is a length-4 Bell vector
  return conjugate(d, u); // U diag(λ) U†
}

/**
 * Exact twirl: uniform average over the six Bell-label permutations that fix
 * Φ+. Real bilateral rotations (R·Rᵀ = I) fix Φ+ by construction; complex
 * bilateral rotations move it, and the protocol's classical record supplies
 * the Pauli frame correction that restores Φ+ — the composite action is
 * exactly S₃ on the three error labels. Implemented at the density-matrix
 * level as permutation conjugation in the Bell basis.
 */
export function refereeTwirl(rho: CxMat): CxMat {
  const u = zeros(4);
  for (let k = 0; k < 4; k++)
    for (let i = 0; i < 4; i++) u.re[i * 4 + k] = BELL_STATES[k]![i]!;
  const inBell = conjugate(rho, dagger(u));
  const perms = [
    [0, 1, 2, 3],
    [0, 1, 3, 2],
    [0, 2, 1, 3],
    [0, 2, 3, 1],
    [0, 3, 1, 2],
    [0, 3, 2, 1],
  ];
  let acc = zeros(4);
  for (const pm of perms) {
    const P = zeros(4);
    for (let i = 0; i < 4; i++) P.re[pm[i]! * 4 + i] = 1; // pm entries are literal 0..3
    acc = add(acc, conjugate(inBell, P));
  }
  return conjugate(scale(acc, 1 / perms.length), u);
}

/**
 * Referee for the full twirled purification step: bilateral twirl on each
 * input, bilateral CNOTs, Z-parity postselection with frame fix, twirl on the
 * survivor. Inputs may be arbitrary Bell vectors — this is the regression
 * guard for the 0.85 → 0.884 → 0.850 failure that motivated the twirl.
 */
export function refereePurifyTwirled(
  l1: Float64Array,
  l2: Float64Array
): { p: number; vec: Float64Array } {
  const rhoA = refereeTwirl(bellDiagonalDM(l1));
  const rhoB = refereeTwirl(bellDiagonalDM(l2));
  const rho0 = kron(rhoA, rhoB);
  const rho = conjugate(conjugate(rho0, cnot(4, 0, 2)), cnot(4, 1, 3));
  let a = projectZ(rho, 2, 0);
  a = projectZ(a, 3, 0);
  let b = projectZ(rho, 2, 1);
  b = projectZ(b, 3, 1);
  const bx = conjugate(b, gate1(4, 0, G_X));
  const bFixed = conjugate(bx, gate1(4, 1, G_X));
  const { state, prob } = renormalize(add(a, bFixed));
  const kept = partialTrace(state, [0, 1]);
  return { p: prob, vec: bellVectorOf(refereeTwirl(kept)) };
}
