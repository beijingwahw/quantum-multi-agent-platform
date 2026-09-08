/**
 * Channels on density matrices: Kraus application, partial trace over
 * subsystems, and the named single-qubit commit channels of the v0.2.0 noise
 * census. The canon's computational-basis readout faces (marginalProbs,
 * filterBasisDigit, depolarize, applyUnitary) were dead weight here — zero
 * references, grep-verified, the market's marginal analysis runs on
 * partialTrace — and were deleted at v0.3.0 (the nosignal-tariff absorption
 * precedent); the census canon and the sibling lineages carry them.
 */

import { type CMat, mat, mMul, mDagger } from './cmat.js';

/** Subsystem dimensions must be positive integers — validated once at the
 * channel boundary, never per cell of the hot loops. */
function checkDims(fn: string, dims: readonly number[]): void {
  for (const d of dims) {
    if (!Number.isInteger(d) || d <= 0) throw new Error(`${fn}: subsystem dims must be positive integers, got ${d}`);
  }
}

/** Apply a CPTP map given its Kraus operators: Σ K ρ K†. */
export function applyKraus(rho: CMat, kraus: readonly CMat[]): CMat {
  const out = mat(rho.rows, rho.cols);
  for (const k of kraus) {
    const kr = mMul(mMul(k, rho), mDagger(k));
    for (let i = 0; i < out.re.length; i++) {
      out.re[i] = out.re[i]! + kr.re[i]!;
      out.im[i] = out.im[i]! + kr.im[i]!;
    }
  }
  return out;
}

/** Apply a single unitary is not carried as a wrapper: U rho U-dagger is one
 *  kernel line (mMul(mMul(u, rho), mDagger(u))) and the repo's one caller
 *  (the rotbell face) writes it in place rather than paying an indirection. */

/**
 * Partial trace: trace out the subsystems whose 0-based indices are listed in
 * `traceOut`, keeping the rest in their original relative order.
 * `dims` are the subsystem dimensions of ρ.
 */
export function partialTrace(rho: CMat, dims: readonly number[], traceOut: readonly number[]): CMat {
  const m = dims.length;
  checkDims('partialTrace', dims);
  // an out-of-range traced-out index would compare undefined !== undefined and
  // silently drop the constraint — refuse it at the boundary instead
  for (const t of traceOut) {
    if (!Number.isInteger(t) || t < 0 || t >= m) throw new Error(`partialTrace: traced-out subsystem index ${t} out of range for ${m} subsystems`);
  }
  if (rho.rows !== dims.reduce((a, b) => a * b, 1)) throw new Error('dims do not match rho');
  const keep = dims.map((_, i) => i).filter((i) => !traceOut.includes(i));
  const keptDims = keep.map((i) => dims[i]!);
  const dOut = keptDims.reduce((a, b) => a * b, 1);
  // strides of kept subsystems inside the OUTPUT space
  const keptStrides: number[] = new Array<number>(keep.length);
  keptStrides[keep.length - 1] = 1;
  for (let j = keep.length - 2; j >= 0; j--) {
    keptStrides[j] = keptStrides[j + 1]! * keptDims[j + 1]!;
  }
  const out = mat(dOut, dOut);
  const strides: number[] = new Array<number>(m);
  strides[m - 1] = 1;
  for (let i = m - 2; i >= 0; i--) strides[i] = strides[i + 1]! * dims[i + 1]!;
  const dIn = rho.rows;
  for (let row = 0; row < dIn; row++) {
    // decompose row index into per-subsystem digits
    const digits: number[] = new Array<number>(m);
    let r = row;
    for (let i = 0; i < m; i++) {
      digits[i] = Math.floor(r / strides[i]!);
      r %= strides[i]!;
    }
    const keepRow = keep.reduce((acc, sys, idx) => acc + digits[sys]! * keptStrides[idx]!, 0);
    for (let col = 0; col < dIn; col++) {
      let c = col;
      const cdigits: number[] = new Array<number>(m);
      for (let i = 0; i < m; i++) {
        cdigits[i] = Math.floor(c / strides[i]!);
        c %= strides[i]!;
      }
      let matches = true;
      for (const t of traceOut) {
        if (cdigits[t]! !== digits[t]!) {
          matches = false;
          break;
        }
      }
      if (!matches) continue;
      const keepCol = keep.reduce((acc, sys, idx) => acc + cdigits[sys]! * keptStrides[idx]!, 0);
      out.re[keepRow * dOut + keepCol] = out.re[keepRow * dOut + keepCol]! + rho.re[row * dIn + col]!;
      out.im[keepRow * dOut + keepCol] = out.im[keepRow * dOut + keepCol]! + rho.im[row * dIn + col]!;
    }
  }
  return out;
}

export type NoiseName = "dephase" | "ampdamp";

/**
 * Phase-flip dephasing at strength γ ∈ [0, 1/2]: K = {√(1−γ) I, √γ Z}, so the
 * off-diagonals scale by (1−2γ) (FULL dephasing at γ = 1/2) and the
 * populations never move. Unital — I/2 is a fixed point at every γ.
 */
export function dephaseKraus(gamma: number): CMat[] {
  if (gamma < 0 || gamma > 0.5) throw new Error(`dephaseKraus: gamma ${gamma} outside [0, 1/2]`);
  const k0 = mat(2, 2);
  k0.re[0] = Math.sqrt(1 - gamma);
  k0.re[3] = Math.sqrt(1 - gamma);
  const k1 = mat(2, 2);
  k1.re[0] = Math.sqrt(gamma);
  k1.re[3] = -Math.sqrt(gamma);
  return [k0, k1];
}

/**
 * Amplitude damping at strength γ ∈ [0, 1]: K = {|0⟩⟨0| + √(1−γ) |1⟩⟨1|,
 * √γ |0⟩⟨1|} — the excited state decays to the ground state. Non-unital: on
 * I/2 it mints a z-polarization of exactly γ (concealment loss γ/2), the
 * census's broken-identity channel.
 */
export function ampDampKraus(gamma: number): CMat[] {
  if (gamma < 0 || gamma > 1) throw new Error(`ampDampKraus: gamma ${gamma} outside [0, 1]`);
  const k0 = mat(2, 2);
  k0.re[0] = 1;
  k0.re[3] = Math.sqrt(1 - gamma);
  const k1 = mat(2, 2);
  k1.re[1] = Math.sqrt(gamma);
  return [k0, k1];
}

/** Kraus set of a named single-qubit noise channel at strength γ. Exhaustive:
 *  a future NoiseName member that forgets its case fails to compile here. */
export function noiseKraus(noise: NoiseName, gamma: number): CMat[] {
  switch (noise) {
    case "dephase":
      return dephaseKraus(gamma);
    case "ampdamp":
      return ampDampKraus(gamma);
    default: {
      const unhandled: never = noise;
      throw new Error(`noiseKraus: unhandled channel name ${String(unhandled)}`);
    }
  }
}

/** The named channel as a map: E_γ(ρ). */
export function applyNoise(rho: CMat, noise: NoiseName, gamma: number): CMat {
  return applyKraus(rho, noiseKraus(noise, gamma));
}

