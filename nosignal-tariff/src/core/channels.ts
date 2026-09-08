/**
 * Channels on density matrices: partial trace over subsystems.
 */

import { type CMat, mat } from './cmat.js';
import { refuse } from './errors.js';

/** Subsystem dimensions must be positive integers — validated once at the
 * channel boundary, never per cell of the hot loops. */
function checkDims(dims: readonly number[]): void {
  for (const d of dims) {
    if (!Number.isInteger(d) || d <= 0) {
      refuse("SUBSYSTEM_DIMS_INVALID", `partialTrace: subsystem dims must be positive integers, got ${d}`);
    }
  }
}

/**
 * Partial trace: trace out the subsystems whose 0-based indices are listed in
 * `traceOut`, keeping the rest in their original relative order.
 * `dims` are the subsystem dimensions of ρ.
 */
export function partialTrace(rho: CMat, dims: readonly number[], traceOut: readonly number[]): CMat {
  const m = dims.length;
  checkDims(dims);
  // an out-of-range traced-out index would compare undefined !== undefined and
  // silently drop the constraint — refuse it at the boundary instead
  for (const t of traceOut) {
    if (!Number.isInteger(t) || t < 0 || t >= m) {
      refuse("PARTIALTRACE_INDEX_OUT_OF_RANGE", `partialTrace: traced-out subsystem index ${t} out of range for ${m} subsystems`);
    }
  }
  if (rho.rows !== dims.reduce((a, b) => a * b, 1)) refuse("PARTIALTRACE_DIMS_MISMATCH", "dims do not match rho");
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
