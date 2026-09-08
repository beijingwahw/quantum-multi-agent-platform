/**
 * The readout layer — what measuring the order register does to the switch.
 *
 * The order register is the control qubit c (basis |0⟩ = A-first, |1⟩ =
 * B-first). Reading the order = measuring c in its own basis. Outcome
 * forgotten, that is exactly the dephasing map
 *
 *   Δ(ρ) = Σ_c (|c⟩⟨c| ⊗ I) ρ (|c⟩⟨c| ⊗ I)
 *
 * on the joint output. The collapse identity: after Δ, the joint state is
 * block-diagonal with the fixed-order channels as blocks, weighted by the
 * control's diagonal — the read-out switch is not a new process, it is the
 * classical mixture of the orders you could have just chosen.
 */
import { type CMat, kron, mat } from "../core/cmat.js";
import { partialTrace } from "../core/channels.js";
import { refuse } from "../core/errors.js";
import type { SwitchedChannel } from "../switch/isometry.js";

/** ρ_c ⊗ ρ_S for density matrices. */
export function kronRho(a: CMat, b: CMat): CMat {
  return kron(a, b);
}

/** Complete dephasing on subsystem `sys` of `dims` (the order readout). */
export function dephase(rho: CMat, dims: readonly number[], sys: number): CMat {
  const m = dims.length;
  // an out-of-range sys would make every digit NaN; NaN !== NaN then zeroes the
  // whole matrix silently — refuse it at the boundary instead
  if (!Number.isInteger(sys) || sys < 0 || sys >= m) {
    refuse("DEPHASE_SYS_RANGE", `dephase: subsystem index ${sys} out of range for ${m} subsystems`);
  }
  const strides: number[] = new Array<number>(m);
  strides[m - 1] = 1;
  for (let i = m - 2; i >= 0; i--) strides[i] = strides[i + 1]! * dims[i + 1]!;
  const d = rho.rows;
  const out: CMat = { rows: d, cols: d, re: new Float64Array(rho.re), im: new Float64Array(rho.im) };
  const sysStride = strides[sys]!;
  const dSys = dims[sys]!;
  for (let row = 0; row < d; row++) {
    const rd = Math.floor(row / sysStride) % dSys;
    for (let col = 0; col < d; col++) {
      const cd = Math.floor(col / sysStride) % dSys;
      if (rd !== cd) {
        out.re[row * d + col] = 0;
        out.im[row * d + col] = 0;
      }
    }
  }
  return out;
}

/** Partial dephasing of strength λ ∈ [0,1]: (1−λ)ρ + λ·Δ(ρ) — the weak readout. */
export function partialDephase(rho: CMat, dims: readonly number[], sys: number, lambda: number): CMat {
  if (lambda < 0 || lambda > 1) refuse("PARTIAL_DEPHASE_LAMBDA", "lambda must be in [0,1]");
  const full = dephase(rho, dims, sys);
  const out: CMat = { rows: rho.rows, cols: rho.cols, re: new Float64Array(rho.re.length), im: new Float64Array(rho.im.length) };
  for (let k = 0; k < rho.re.length; k++) {
    out.re[k] = (1 - lambda) * rho.re[k]! + lambda * full.re[k]!;
    out.im[k] = (1 - lambda) * rho.im[k]! + lambda * full.im[k]!;
  }
  return out;
}

/** Diagonal weight p_c of the control input (the readout outcome priors). */
export function controlDiagonal(rhoC: CMat): number[] {
  if (rhoC.rows !== rhoC.cols) refuse("CONTROL_DIAGONAL_SHAPE", "controlDiagonal: control state must be square");
  const out: number[] = [];
  for (let i = 0; i < rhoC.rows; i++) out.push(rhoC.re[i * rhoC.cols + i]!);
  return out;
}

/**
 * The classical mixture the readout leaves behind, built independently from
 * the fixed-order channels and the control's diagonal:
 *
 *   Σ_c |c⟩⟨c| ⊗ p_c · ℳ_c(ρ_S)
 *
 * This is the second path of the collapse-identity witness — never built by
 * dephasing the switched output, always from the fixed orders themselves.
 */
export function classicalMixture(
  sc: SwitchedChannel,
  rhoC: CMat,
  rhoS: CMat,
  proj0: (r: CMat) => CMat,
  proj1: (r: CMat) => CMat,
): CMat {
  if (rhoC.rows !== 2 || rhoC.cols !== 2) {
    // the order register of the two-box switch is a qubit; a smaller control
    // would read p[1] === undefined and book NaN weights silently
    refuse("CLASSICAL_MIXTURE_QUBIT", "classicalMixture: the order register is a qubit — rhoC must be 2x2");
  }
  const p = controlDiagonal(rhoC);
  const d = sc.sw.d;
  const blocks = [proj0(rhoS), proj1(rhoS)]; // fixedAB, fixedBA with env traced
  const out: CMat = mat(2 * d, 2 * d);
  for (let c = 0; c < 2; c++) {
    const blk = blocks[c]!; // blocks is a 2-element literal, c is bounded by the loop
    if (blk.rows !== d || blk.cols !== d) {
      refuse("CLASSICAL_MIXTURE_BLOCK_SHAPE", `classicalMixture: branch block must be ${d}x${d}, got ${blk.rows}x${blk.cols}`);
    }
    const pc = p[c]!;
    for (let i = 0; i < d; i++) {
      for (let j = 0; j < d; j++) {
        const k = (c * d + i) * (2 * d) + (c * d + j);
        out.re[k] = pc * blk.re[i * d + j]!;
        out.im[k] = pc * blk.im[i * d + j]!;
      }
    }
  }
  return out;
}

export interface ReadoutSlices {
  /** joint (control ⊗ target) output, coherent control */
  full: CMat;
  /** joint output after the order readout (full dephasing on control) */
  readout: CMat;
  /** control register only */
  control: CMat;
  /** target register only */
  target: CMat;
}

/** Push ρ_S through the switched process with control ρ_c, with and without readout. */
export function readoutSlices(sc: SwitchedChannel, rhoC: CMat, rhoS: CMat): ReadoutSlices {
  const full = sc.channel(kronRho(rhoC, rhoS));
  return {
    full,
    readout: dephase(full, [2, sc.sw.d], 0),
    control: partialTrace(full, [2, sc.sw.d], [1]),
    target: partialTrace(full, [2, sc.sw.d], [0]),
  };
}
