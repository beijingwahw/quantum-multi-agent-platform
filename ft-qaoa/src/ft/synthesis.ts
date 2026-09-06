import type { IsingModel } from "../core/ising.js";

export interface RotationSynthesisOptions {
  /** Target synthesis error per rotation (epsilon in Clifford+T approximation). */
  readonly epsilon: number;
  /**
   * T-count scaling coefficient c in T = c*log2(1/eps) + c0.
   * Default 3 follows Clifford+T synthesis scaling in the spirit of
   * Kliuchnikov-Maslov-Mosca (2013); the coefficient stays an explicit input.
   */
  readonly coefficient?: number;
  /** Additive constant c0 (gate-count floor per synthesized rotation). */
  readonly additiveConstant?: number;
}

export const DEFAULT_SYNTHESIS: RotationSynthesisOptions = {
  epsilon: 1e-6,
  coefficient: 3,
  additiveConstant: 4,
};

/** T gates to synthesize one arbitrary Z-rotation at the given precision. */
export function tCountForRotation(options: RotationSynthesisOptions = DEFAULT_SYNTHESIS): number {
  const c = options.coefficient ?? 3;
  const c0 = options.additiveConstant ?? 4;
  return Math.ceil(c * Math.log2(1 / options.epsilon)) + c0;
}

export interface LayerProfile {
  /** Arbitrary-angle single-qubit rotations (field terms + mixer terms). */
  readonly singleQubitRotations: number;
  /** Arbitrary-angle two-qubit rotations (coupling terms, CNOT-Rz-CNOT). */
  readonly twoQubitRotations: number;
  readonly cliffords: number;
  readonly tCount: number;
}

/**
 * Logical gate profile of one QAOA layer for an Ising cost
 * C = sum h_j Z_j + sum w_jk Z_j Z_k and mixer B = sum X_j:
 *   cost:  m Rzz (each 2 CNOTs + 1 Rz) + n field Rz
 *   mixer: n Rx (= H Rz H)
 * Non-Clifford content: (m + 2n) arbitrary rotations per layer.
 */
export function qaoaLayerProfile(model: IsingModel, options: RotationSynthesisOptions = DEFAULT_SYNTHESIS): LayerProfile {
  const m = model.couplings.length;
  const n = model.n;
  const singleQubitRotations = n + n; // field rotations + mixer rotations
  const twoQubitRotations = m;
  const cliffords = 2 * m + 2 * n; // CNOT pairs for Rzz, H pairs for mixer
  const tCount = (m + 2 * n) * tCountForRotation(options);
  return { singleQubitRotations, twoQubitRotations, cliffords, tCount };
}
