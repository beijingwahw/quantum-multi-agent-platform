import type { Coupling } from "../core/ising.js";
import { xSpectrumOf } from "../core/spectra.js";
import type { XSpectrum } from "../core/spectra.js";

/**
 * Non-stoquastic annealing driver: H_D = -Γ·Σ_i σ^x_i + Σ_{(i,j)} κ_ij σ^x_i σ^x_j.
 *
 * κ_ij > 0 makes H_D NON-stoquastic in the computational (Z) basis: the
 * σ^x_i σ^x_j term connects basis states differing in two bits with a
 * POSITIVE off-diagonal matrix element (+κ), breaking Perron-Frobenius.
 * The standard transverse-field driver (κ = 0) is stoquastic.
 *
 * Route positioning (honest): lab demonstrations of non-stoquastic couplers
 * exist at 2 flux qubits (Ozfidan et al., Phys. Rev. Applied 13, 034037
 * (2020)); a programmable multi-qubit non-stoquastic driver in a production
 * annealer does not — that is the hardware gap this route targets.
 */
export interface DriverSpec {
  readonly gamma: number;
  readonly couplings: readonly Coupling[]; // reuse {j, k, w} with w = κ
}

export interface StoquasticityReport {
  readonly stoquastic: boolean;
  /** Largest positive off-diagonal element (the sign barrier strength). */
  readonly maxPositiveOffdiag: number;
  /** Smallest off-diagonal element (single-bit flips contribute -Γ). */
  readonly minOffdiag: number;
  readonly positivePairs: number;
  readonly detail: string;
}

/**
 * Matrix-level stoquasticity check in the computational basis.
 * Off-diagonals of H_D: single-bit flips contribute -Γ (<= 0 when Γ >= 0);
 * double-bit flips {j,k} contribute +κ_jk. Stoquastic iff no κ_jk > 0.
 */
export function checkStoquasticity(driver: DriverSpec): StoquasticityReport {
  let maxPositive = 0;
  let minKappa = 0;
  let positivePairs = 0;
  for (const c of driver.couplings) {
    if (c.w > 0) {
      positivePairs++;
      if (c.w > maxPositive) maxPositive = c.w;
    }
    if (c.w < minKappa) minKappa = c.w;
  }
  // Off-diagonal set: single-bit flips -> -Γ; double-bit flips {j,k} -> κ_jk
  const minOffdiag = Math.min(-driver.gamma, minKappa);
  const stoquastic = driver.gamma >= 0 && maxPositive === 0;
  return {
    stoquastic,
    maxPositiveOffdiag: maxPositive,
    minOffdiag,
    positivePairs,
    detail: stoquastic
      ? `stoquastic: all off-diagonals <= 0 (gamma=${driver.gamma} >= 0, no positive kappa)`
      : `NON-stoquastic: ${positivePairs} positive off-diagonal elements (max +${maxPositive}) break Perron-Frobenius`,
  };
}

/**
 * X-basis eigenvalue table of H_D on the ket H|t⟩: with σ^x eigenvalues
 * x_i(t) = 1 - 2·bit_i(t),
 *   E_x[t] = -Γ·Σ_i x_i + Σ_{(j,k)} κ_jk·x_j·x_k.
 * The whole driver evolution (real-time phase or imaginary-time damping) is
 * diagonal in the X basis, reached by one Walsh-Hadamard transform.
 */
export function xBasisEnergies(n: number, driver: DriverSpec): XSpectrum {
  const dim = 1 << n;
  const out = new Float64Array(dim);
  for (let t = 0; t < dim; t++) {
    let e = 0;
    for (const c of driver.couplings) {
      const xj = ((t >>> c.j) & 1) === 0 ? 1 : -1;
      const xk = ((t >>> c.k) & 1) === 0 ? 1 : -1;
      e += c.w * xj * xk;
    }
    e -= driver.gamma * magnetization(t, n);
    out[t] = e;
  }
  return xSpectrumOf(out);
}

/**
 * Z/X 基自旋求和 Σ_i x_i(bits)（bit 0 → +1，bit 1 → −1）——driver 的
 * X 基能量表与 catalyst 的磁化表共用的单一来源（0.3.0 单源化）。
 */
export function magnetization(bits: number, n: number): number {
  let m = 0;
  for (let i = 0; i < n; i++) m += ((bits >>> i) & 1) === 0 ? 1 : -1;
  return m;
}
