import type { IsingModel } from "../core/ising.js";
import { StateVector } from "../core/statevector.js";
import { zeroSpectrum } from "../core/spectra.js";
import type { ZSpectrum } from "../core/spectra.js";
import type { DriverSpec } from "./driver.js";
import { xBasisEnergies } from "./driver.js";
import { projectGroundState } from "./project.js";

export interface AnnealOptions {
  /** Total anneal time T; slice count M gives dt = T/M. */
  readonly time: number;
  readonly slices?: number;
  /**
   * Initial state: 'driver-ground' (default) prepares the ground state of H_D
   * by imaginary-time projection — mandatory physics, because for κ > 2Γ the
   * XX-driver ground is NOT |+>^n; 'plus' keeps the textbook uniform start.
   */
  readonly initialState?: "driver-ground" | "plus";
}

export interface AnnealResult {
  /** Probability of measuring an exact optimum of C at the end of the anneal. */
  readonly successProbability: number;
  /** ⟨C⟩ / C_opt of the final state. */
  readonly energyRatio: number;
  readonly meanEnergy: number;
  readonly optimum: number;
}

/**
 * Real-time quantum annealing under H(s) = (1−s)·H_D + s·H_P with H_P := −C
 * (maximizing C == minimizing H_P — the max-welfare convention shared with
 * ft-qaoa and the platform), linear schedule s(m/M), Trotterized per slice:
 *   Z-basis phase e^{−i·dt·s·(−C)} → WH → X-basis phase e^{−i·dt·(1−s)·H_D} → WH.
 * Works verbatim for stoquastic (κ=0) and non-stoquastic (κ>0) drivers —
 * the sign barrier does not affect statevector simulation, which is exactly
 * the point: the barrier targets polynomial classical samplers, not this engine.
 */
export function anneal(
  model: IsingModel,
  energies: ZSpectrum,
  optimum: number,
  driver: DriverSpec,
  options: AnnealOptions,
): AnnealResult {
  const M = options.slices ?? 200;
  const dt = options.time / M;
  const xEnergies = xBasisEnergies(model.n, driver);

  // 初态 = 驱动器基态（虚时投影；κ=0 时即 |+>^n）。κ > 2Γ 后 XX 驱动器
  // 基态带符号结构，从 |+>^n 起跳违背绝热前提——这是非 stoq 路线的
  // 真实工程约束：退火机必须能制备自身驱动的基态。（零表基无关，
  // zeroSpectrum 同时携带 Z/X 品牌。）
  const zeroEnergies = zeroSpectrum(model.n);
  const state =
    options.initialState === "plus"
      ? StateVector.plusState(model.n)
      : projectGroundState(model.n, zeroEnergies, xEnergies, 0, { dtau: 0.08, maxSteps: 4000, tolerance: 1e-12 }).state;
  for (let m = 1; m <= M; m++) {
    const s = m / M;
    // H_P = −C：applyPhase(γ) 实现 e^{−iγC}，故 γ 取负即得 e^{+idt·s·C}
    state.applyPhase(-dt * s, energies);
    state.applyHadamardAll();
    state.applyPhase(dt * (1 - s), xEnergies);
    state.applyHadamardAll();
  }

  const probs = state.probabilities();
  let success = 0;
  // 退化最优：所有达到 C_opt 的基态概率合计
  for (let t = 0; t < probs.length; t++) {
    if (energies[t]! === optimum) success += probs[t]!;
  }
  const meanEnergy = state.expectation(energies);
  return {
    successProbability: success,
    energyRatio: meanEnergy / optimum,
    meanEnergy,
    optimum,
  };
}
