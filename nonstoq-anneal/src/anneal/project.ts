import { StateVector } from "../core/statevector.js";
import type { ZSpectrum, XSpectrum } from "../core/spectra.js";

export interface ProjectionOptions {
  readonly dtau?: number;
  readonly maxSteps?: number;
  readonly tolerance?: number;
  /** Seed for the generic initial vector (deterministic across runs). */
  readonly seed?: number;
}

export interface ProjectionResult {
  readonly state: StateVector;
  /** ⟨H(s)⟩ of the converged state, H(s) = (1−s)·H_D − s·C. */
  readonly energy: number;
  readonly converged: boolean;
  readonly steps: number;
  /**
   * P = Σψ/Σ|ψ| of the ground state under the global-sign convention (largest
   * |amplitude| positive): 1 for every stoquastic ground state (Perron-
   * Frobenius); < 1 certifies the sign structure that worldline samplers pay
   * for exponentially.
   */
  readonly signRatio: number;
}

/**
 * Ground state of H(s) = (1−s)·H_D − s·C by imaginary-time projection
 * (maximizing C == minimizing −C, the max-welfare convention).
 *
 * Trotterized e^{−ΔτH}: damp by e^{+Δτ·s·C} in the Z basis, flip to the X
 * basis (Walsh-Hadamard), damp by e^{−Δτ·(1−s)·E_x}, flip back, normalize.
 * The dominant eigenvector of the product is the ground state of the
 * Trotterized H(s) → true ground state as Δτ → 0.
 *
 * Two numerics-mandated conventions:
 *  - the initial state is a seeded generic real vector: |+>^n is a single
 *    X-basis ket and can be exactly orthogonal to the target ground space;
 *  - the global sign of the converged vector is fixed so its largest-
 *    magnitude amplitude is positive — P is only meaningful per-representative.
 *
 * This is the exact kernel behind the sign-barrier claim: the converged
 * vector is what diffusion/worldline samplers must reproduce, with the sign
 * structure it carries — stoquastic ground states are provably non-negative
 * (Perron-Frobenius), non-stoquastic ones are not.
 */
export function projectGroundState(
  n: number,
  energies: ZSpectrum,
  xEnergies: XSpectrum,
  s: number,
  options: ProjectionOptions = {},
): ProjectionResult {
  const dtau = options.dtau ?? 0.04;
  const maxSteps = options.maxSteps ?? 4000;
  const tolerance = options.tolerance ?? 1e-12;
  const seed = options.seed ?? 0xc0ffee;

  const state = StateVector.seededReal(n, seed);
  fixGlobalSign(state);

  let energy = totalEnergy(state, energies, xEnergies, s);
  let converged = false;
  let step = 0;

  for (; step < maxSteps; step++) {
    // e^{−Δτ·s·(−C)} = e^{+Δτ·s·C}：damp 因子取负 γ 等价于对 −C 做虚时衰减
    state.applyDamp(-dtau * s, energies);
    state.applyHadamardAll();
    state.applyDamp(dtau * (1 - s), xEnergies);
    state.applyHadamardAll();
    state.normalize();

    const total = totalEnergy(state, energies, xEnergies, s);
    if (Math.abs(total - energy) < tolerance * (1 + Math.abs(total))) {
      energy = total;
      converged = true;
      step++;
      break;
    }
    energy = total;
  }
  fixGlobalSign(state);

  return {
    state,
    energy,
    converged,
    steps: step,
    signRatio: state.signRatio(),
  };
}

/** ⟨H(s)⟩ = −s·⟨C⟩_Z + (1−s)·⟨H_D⟩_X（驱动项在 X 基对角，翻转读出） */
function totalEnergy(
  state: StateVector,
  energies: ZSpectrum,
  xEnergies: XSpectrum,
  s: number,
): number {
  const problemEnergy = state.expectation(energies);
  const flipped = state.clone();
  flipped.applyHadamardAll();
  const driverEnergy = flipped.expectation(xEnergies);
  return -s * problemEnergy + (1 - s) * driverEnergy;
}

/** 全局符号约定：最大 |幅值| 取正（P 的表示依赖性在此消除） */
function fixGlobalSign(state: StateVector): void {
  let idx = 0;
  for (let s = 1; s < state.dim; s++) {
    if (Math.abs(state.re[s]!) > Math.abs(state.re[idx]!)) idx = s;
  }
  if (state.re[idx]! < 0) {
    for (let s = 0; s < state.dim; s++) state.re[s] = -state.re[s]!;
  }
}
