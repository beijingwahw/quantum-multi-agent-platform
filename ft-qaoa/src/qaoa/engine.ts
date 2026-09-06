import { StateVector } from "../core/statevector.js";
import type { IsingModel } from "../core/ising.js";

/** QAOA angle schedule; layer t applies exp(-i*beta_t*B) exp(-i*gamma_t*C). */
export interface QaoaParams {
  readonly gammas: readonly number[];
  readonly betas: readonly number[];
}

export function makeParams(gammas: readonly number[], betas: readonly number[]): QaoaParams {
  if (gammas.length !== betas.length) {
    throw new Error(`gamma/beta length mismatch: ${gammas.length} vs ${betas.length}`);
  }
  return { gammas, betas };
}

export function depthOf(params: QaoaParams): number {
  return params.gammas.length;
}

/** Run the p-layer circuit and return the final state. */
export function qaoaState(model: IsingModel, energyOf: Float64Array, params: QaoaParams): StateVector {
  const state = StateVector.plusState(model.n);
  for (let t = 0; t < params.gammas.length; t++) {
    state.applyCostPhase(params.gammas[t]!, energyOf);
    state.applyMixer(params.betas[t]!);
  }
  return state;
}

/** Forward pass keeping only <C> — the workhorse of every parameter search. */
export function qaoaExpectation(model: IsingModel, energyOf: Float64Array, params: QaoaParams): number {
  const state = qaoaState(model, energyOf, params);
  const probs = state.probabilities();
  let acc = 0;
  for (let s = 0; s < probs.length; s++) acc += probs[s]! * energyOf[s]!;
  return acc;
}

/**
 * The padding map behind the monotonicity theorem: append a zero layer.
 * exp(-i*0*C) = exp(-i*0*B) = identity, so F_{p+1}(theta | 0,0) = F_p(theta).
 */
export function appendZeroLayer(params: QaoaParams): QaoaParams {
  return makeParams([...params.gammas, 0], [...params.betas, 0]);
}

/**
 * Absolute gap |F_p(theta) - F_{p+1}(theta | 0,0)| computed through the real engine.
 * Mathematically exactly 0; any deviation above float noise is an engine bug.
 */
export function embeddingGap(model: IsingModel, energyOf: Float64Array, params: QaoaParams): number {
  const fp = qaoaExpectation(model, energyOf, params);
  const fp1 = qaoaExpectation(model, energyOf, appendZeroLayer(params));
  return Math.abs(fp - fp1);
}
