/**
 * History states and readout.
 *
 * |Psi_hist> = (1/sqrt(T+1)) Σ_t (U_t...U_1 |psi_in>) ⊗ |t>
 *
 * - H_prop |Psi_hist> = 0 exactly (the ground-state deed).
 * - The clock marginal is EXACTLY uniform: Tr_data |Psi><Psi| = I/(T+1).
 * - Conditioning on clock outcome T hands back the program output with
 *   fidelity exactly 1 — measuring the clock at t is reading the program
 *   counter, and the data register is exactly U_t...U_1|psi_in>.
 */
import { type CMat, type CVec, cmatApply, cvecFidelity, cvecInner, cvecNorm, cvecZero, VacuumError } from "../core/cmat.js";
import type { Circuit } from "./circuit.js";

/** data⊗clock factorization check: psi.dim must be a multiple of the clock
 * dimension — a non-divisor used to truncate D toward zero and read/write
 * past the buffers silently (garbage out, no signal). */
function requireClockDivisor(psiDim: number, clockStates: number, what: string): number {
  if (!Number.isInteger(clockStates) || clockStates < 1) {
    throw new VacuumError("readout/clock-out-of-domain", `${what}: clockStates ${clockStates}`);
  }
  if (psiDim % clockStates !== 0) {
    throw new VacuumError("readout/clock-not-divisor", `${what}: state dim ${psiDim} is not a multiple of clockStates ${clockStates}`);
  }
  return psiDim / clockStates;
}

/** Full-space (data ⊗ clock) history state of a data-space input. */
export function historyState(circuit: Circuit, input: CVec): CVec {
  const D = 2 ** circuit.nQubits;
  if (input.dim !== D) {
    throw new VacuumError("cmat/dim-mismatch", `historyState: input dim ${input.dim}, expected ${D} = 2^${circuit.nQubits}`);
  }
  const C = circuit.steps.length + 1;
  const psi = cvecZero(D * C);
  let step = input;
  const amp = 1 / Math.sqrt(C);
  for (let t = 0; t <= circuit.steps.length; t++) {
    if (t > 0) step = cmatApply((circuit.steps[t - 1] as { matrix: CMat }).matrix, step);
    for (let d = 0; d < D; d++) {
      psi.re[d * C + t] = amp * (step.re[d] as number);
      psi.im[d * C + t] = amp * (step.im[d] as number);
    }
  }
  return psi;
}

/** Clock marginal ρ_clock = Tr_data |Psi><Psi|: diagonal P(t) (exactly
 * uniform for a history state) AND the coherences, which are NOT zero in
 * general: rho[t,t'] = <psi_t'|psi_t>/(T+1) — the intermediate-state
 * overlaps (identity-heavy circuits have near-full coherences). The law,
 * not the folklore: outcomes uniform, marginal coherent. */
export function clockRho(psi: CVec, clockStates: number): { re: number[][]; im: number[][]; probs: number[] } {
  const C = clockStates;
  const D = requireClockDivisor(psi.dim, C, "clockRho");
  const re: number[][] = Array.from({ length: C }, () => new Array<number>(C).fill(0));
  const im: number[][] = Array.from({ length: C }, () => new Array<number>(C).fill(0));
  for (let t = 0; t < C; t++) {
    for (let tp = 0; tp < C; tp++) {
      let r = 0;
      let i2 = 0;
      for (let d = 0; d < D; d++) {
        const ar = psi.re[d * C + t] as number;
        const ai = psi.im[d * C + t] as number;
        const br = psi.re[d * C + tp] as number;
        const bi = psi.im[d * C + tp] as number;
        r += ar * br + ai * bi;
        i2 += ar * bi - ai * br;
      }
      re[t]![tp] = r;
      im[t]![tp] = i2;
    }
  }
  return { re, im, probs: re.map((row, t) => row[t] as number) };
}

/** Conditional data state given clock outcome t (unnormalized amplitudes,
 * norm² = P(t); normalized by the caller when P(t) > 0). */
export function conditionalData(psi: CVec, clockStates: number, t: number): { state: CVec; prob: number } {
  const C = clockStates;
  const D = requireClockDivisor(psi.dim, C, "conditionalData");
  if (!Number.isInteger(t) || t < 0 || t >= C) {
    throw new VacuumError("readout/clock-step-out-of-range", `conditionalData: step ${t} outside [0, ${C})`);
  }
  const out = cvecZero(D);
  let p = 0;
  for (let d = 0; d < D; d++) {
    out.re[d] = psi.re[d * C + t] as number;
    out.im[d] = psi.im[d * C + t] as number;
    p += (out.re[d] as number) ** 2 + (out.im[d] as number) ** 2;
  }
  return { state: out, prob: p };
}

/** Static readout certificate: conditioned on clock = T, the data register is
 * exactly the circuit output. Returns P(T) and the fidelity to the target. */
export function staticReadoutFidelity(circuit: Circuit, input: CVec, target: CVec): { probT: number; fidelity: number } {
  const psi = historyState(circuit, input);
  const C = circuit.steps.length + 1;
  const { state, prob } = conditionalData(psi, C, C - 1);
  if (prob <= 1e-300) throw new VacuumError("readout/zero-probability", "staticReadoutFidelity: zero probability at clock T");
  const inv = 1 / Math.sqrt(prob);
  for (let k = 0; k < state.dim; k++) {
    state.re[k] = (state.re[k] as number) * inv;
    state.im[k] = (state.im[k] as number) * inv;
  }
  return { probT: prob, fidelity: cvecFidelity(state, target) };
}

/** Spectral time evolution e^{-i H t} |psi0> using a full eigendecomposition.
 * Used by the free-clock walk exhibit; the decomposition's own reconstruction
 * certificate guards the eigenpairs. (The dead wrapper `overlap` — a bare
 * rename of cvecInner with zero references at retirement — is deleted.) */
export function spectralEvolve(
  eig: { values: Float64Array; vectors: CVec[] },
  psi0: CVec,
  t: number,
): CVec {
  if (eig.values.length !== eig.vectors.length) {
    throw new VacuumError("readout/eigendecomposition-mismatch", `spectralEvolve: ${eig.values.length} values vs ${eig.vectors.length} vectors`);
  }
  if (eig.vectors.length !== psi0.dim) {
    throw new VacuumError("cmat/dim-mismatch", `spectralEvolve: spectrum dim ${eig.vectors.length} vs state dim ${psi0.dim}`);
  }
  const out = cvecZero(psi0.dim);
  for (let k = 0; k < eig.values.length; k++) {
    const lam = eig.values[k] as number;
    const vk = eig.vectors[k] as CVec;
    const z = cvecInner(vk, psi0);
    const cos = Math.cos(lam * t);
    const sin = Math.sin(lam * t);
    // e^{-i lam t} z = (cos - i sin)(re + i im)
    const sr = cos * z.re + sin * z.im;
    const si = cos * z.im - sin * z.re;
    for (let d = 0; d < out.dim; d++) {
      out.re[d] = (out.re[d] as number) + sr * (vk.re[d] as number) - si * (vk.im[d] as number);
      out.im[d] = (out.im[d] as number) + sr * (vk.im[d] as number) + si * (vk.re[d] as number);
    }
  }
  return out;
}

/** Norm of a state (used to confirm walk states stay normalized). */
export function stateNorm(v: CVec): number {
  return cvecNorm(v);
}
