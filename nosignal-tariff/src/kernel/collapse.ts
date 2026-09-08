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
  if (!Number.isInteger(sys) || sys < 0 || sys >= m) {
    refuse("DEPHASE_INDEX_OUT_OF_RANGE", `dephase: subsystem index ${sys} is outside dims of length ${m}`);
  }
  const strides: number[] = new Array<number>(m);
  strides[m - 1] = 1;
  for (let i = m - 2; i >= 0; i--) strides[i] = strides[i + 1]! * dims[i + 1]!;
  const d = rho.rows;
  const out = mat(d, d);
  out.re.set(rho.re);
  out.im.set(rho.im);
  for (let row = 0; row < d; row++) {
    const rd = Math.floor(row / strides[sys]!) % dims[sys]!;
    for (let col = 0; col < d; col++) {
      const cd = Math.floor(col / strides[sys]!) % dims[sys]!;
      if (rd !== cd) {
        out.re[row * d + col] = 0;
        out.im[row * d + col] = 0;
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
