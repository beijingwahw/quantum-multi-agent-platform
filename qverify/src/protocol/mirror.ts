/**
 * T4b — Mirror (Loschmidt echo) certification, exact closed form vs simulation.
 *
 * Model: run a random circuit layer-by-layer, then its inverse, inserting a
 * global depolarizing channel D_λ (replace by I/2ⁿ with probability λ) after
 * each of the L forward layers (the mirror pass is noiseless). The return
 * probability of |0…0⟩ has the exact closed form
 *      F_return = (1−λ)^L + (1 − (1−λ)^L)/2ⁿ
 * because depolarizing forgets: once a replacement happened, subsequent
 * unitaries leave the maximally mixed state and the return probability is
 * exactly 2^{-n}; if no replacement ever happened the evolution is pure and
 * returns 1. The density-matrix simulation must match to machine precision.
 */

import { type CMat, mat } from '../core/cmat.js';
import { depolarize } from '../core/channels.js';
import { applyLocalRho, randomCircuit, mirrorCircuit, type RandomCircuit, type CircuitOp } from '../core/gates.js';
import type { Rng } from '../core/rng.js';

function applyOpRho(rho: CMat, n: number, op: CircuitOp): CMat {
  if (op.kind === 'u1') {
    if (!op.u) throw new Error('u1 op without unitary');
    return applyLocalRho(rho, n, op.qubits[0]!, op.u);
  }
  // CZ ρ CZ: element (i,j) picks up a −1 exactly when one of i,j lies in the
  // both-bits-one quadrant and the other does not ((−1)·(−1) = +1 there).
  const qa = op.qubits[0]!; // cz ops always carry two qubits (CircuitOp contract)
  const qb = op.qubits[1]!;
  const d = rho.rows;
  const out: CMat = { rows: d, cols: d, re: rho.re.slice(), im: rho.im.slice() };
  const inQuadrant = (idx: number): boolean =>
    ((idx >> (n - 1 - qa)) & 1) === 1 && ((idx >> (n - 1 - qb)) & 1) === 1;
  for (let row = 0; row < d; row++) {
    const rowQ = inQuadrant(row);
    for (let col = 0; col < d; col++) {
      if (rowQ !== inQuadrant(col)) {
        out.re[row * d + col] = -rho.re[row * d + col]!;
        out.im[row * d + col] = -rho.im[row * d + col]!;
      }
    }
  }
  return out;
}

/** Forward pass with global depolarizing λ after each layer, then noiseless mirror. */
export function mirrorReturnProb(circuit: RandomCircuit, lambda: number): number {
  const n = circuit.n;
  const d = 1 << n;
  const zero = mat(d, d);
  zero.re[0] = 1;
  let rho: CMat = zero;
  for (const layer of circuit.layers) {
    for (const op of layer) rho = applyOpRho(rho, n, op);
    rho = depolarize(rho, lambda);
  }
  const mirror = mirrorCircuit(circuit);
  for (const layer of mirror.layers) {
    for (const op of layer) rho = applyOpRho(rho, n, op);
  }
  return rho.re[0]!;
}

/** Closed form: (1−λ)^L + (1−(1−λ)^L)/2ⁿ. */
export function mirrorClosedForm(lambda: number, layers: number, n: number): number {
  const survive = (1 - lambda) ** layers;
  return survive + (1 - survive) / (1 << n);
}

/** One mirror experiment: simulation vs closed form must agree to machine precision. */
export function runMirrorExperiment(n: number, layers: number, lambda: number, rng: Rng): { simulated: number; closed: number } {
  const circuit = randomCircuit(rng, n, layers);
  return {
    simulated: mirrorReturnProb(circuit, lambda),
    closed: mirrorClosedForm(lambda, layers, n),
  };
}

/**
 * Local per-gate depolarizing (realistic model): exact simulation, no closed
 * form claimed. Returns the return-probability curve over layer counts.
 */
export function localNoiseMirrorCurve(
  n: number,
  layerCounts: readonly number[],
  lambda: number,
  rng: Rng,
): Array<{ layers: number; fReturn: number }> {
  const out: Array<{ layers: number; fReturn: number }> = [];
  for (const layers of layerCounts) {
    const circuit = randomCircuit(rng, n, layers);
    const d = 1 << n;
    const zero = mat(d, d);
    zero.re[0] = 1;
    let rho: CMat = zero;
    for (const layer of circuit.layers) {
      for (const op of layer) rho = applyOpRho(rho, n, op);
      for (let q = 0; q < n; q++) rho = localDepolarize(rho, n, q, lambda);
    }
    const mirror = mirrorCircuit(circuit);
    for (const layer of mirror.layers) {
      for (const op of layer) rho = applyOpRho(rho, n, op);
      for (let q = 0; q < n; q++) rho = localDepolarize(rho, n, q, lambda);
    }
    out.push({ layers, fReturn: rho.re[0]! });
  }
  return out;
}

/**
 * Exact local depolarizing on qubit q: Λ(ρ) = (1−λ)ρ + λ (I_q/2 ⊗ Tr_q ρ).
 * Block form by qubit q: ρ = Σ_{a,b} |a⟩⟨b| ⊗ R_{ab} gives
 * off-diagonal blocks scaled by (1−λ), diagonal blocks (1−λ)R_{aa} + (λ/2)(R_{00}+R_{11}).
 */
export function localDepolarize(rho: CMat, n: number, q: number, lambda: number): CMat {
  const d = rho.rows;
  const stride = 1 << (n - 1 - q);
  const out = mat(d, d);
  const flip = (idx: number): number => {
    const a = Math.floor(idx / stride) % 2;
    return idx + (a === 0 ? stride : -stride);
  };
  for (let row = 0; row < d; row++) {
    const ra = Math.floor(row / stride) % 2;
    const fRow = flip(row);
    for (let col = 0; col < d; col++) {
      const ca = Math.floor(col / stride) % 2;
      if (ra !== ca) {
        out.re[row * d + col] = (1 - lambda) * rho.re[row * d + col]!;
        out.im[row * d + col] = (1 - lambda) * rho.im[row * d + col]!;
      } else {
        const fCol = flip(col);
        out.re[row * d + col] =
          (1 - lambda) * rho.re[row * d + col]! + (lambda / 2) * (rho.re[row * d + col]! + rho.re[fRow * d + fCol]!);
        out.im[row * d + col] =
          (1 - lambda) * rho.im[row * d + col]! + (lambda / 2) * (rho.im[row * d + col]! + rho.im[fRow * d + fCol]!);
      }
    }
  }
  return out;
}
