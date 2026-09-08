/**
 * Channels and measurements on density matrices: Kraus application, partial
 * trace over subsystems, computational-basis readout with classical outcome
 * distributions and post-measurement states.
 */

import { type CMat, mat, mMul, mDagger } from './cmat.js';
import { DomainError } from './errors.js';

/** Subsystem dimensions must be positive integers — validated once at the
 * channel boundary, never per cell of the hot loops. */
function checkDims(fn: string, dims: readonly number[]): void {
  for (const d of dims) {
    if (!Number.isInteger(d) || d <= 0) {
      throw new DomainError(`${fn}:dims`, `${fn}: subsystem dims must be positive integers, got ${d}`);
    }
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

/** Apply a single unitary: U ρ U†. */
export function applyUnitary(rho: CMat, u: CMat): CMat {
  return mMul(mMul(u, rho), mDagger(u));
}

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
    if (!Number.isInteger(t) || t < 0 || t >= m) {
      throw new DomainError(
        'partialTrace:index',
        `partialTrace: traced-out subsystem index ${t} out of range for ${m} subsystems`,
      );
    }
  }
  if (rho.rows !== dims.reduce((a, b) => a * b, 1)) {
    throw new DomainError('partialTrace:shape', 'dims do not match rho');
  }
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

/**
 * Projective filter in the computational basis: keep only basis states whose
 * digit on subsystem `sys` equals `digit`. Returns the total probability and
 * the conditional post-measurement state on the same registers.
 */
export function filterBasisDigit(
  rho: CMat,
  dims: readonly number[],
  sys: number,
  digit: number,
): { p: number; conditional: CMat } {
  const m = dims.length;
  checkDims('filterBasisDigit', dims);
  if (!Number.isInteger(sys) || sys < 0 || sys >= m) {
    throw new DomainError(
      'filterBasisDigit:index',
      `filterBasisDigit: subsystem index ${sys} out of range for ${m} subsystems`,
    );
  }
  const dsys = dims[sys]!;
  // an out-of-range digit would filter out every basis state and silently
  // return a zero conditional instead of an error
  if (!Number.isInteger(digit) || digit < 0 || digit >= dsys) {
    throw new DomainError(
      'filterBasisDigit:digit',
      `filterBasisDigit: digit ${digit} out of range for subsystem dimension ${dsys}`,
    );
  }
  const strides: number[] = new Array<number>(m);
  strides[m - 1] = 1;
  for (let i = m - 2; i >= 0; i--) strides[i] = strides[i + 1]! * dims[i + 1]!;
  const d = rho.rows;
  const out = mat(d, d);
  let p = 0;
  for (let row = 0; row < d; row++) {
    if (Math.floor(row / strides[sys]!) % dsys !== digit) continue;
    for (let col = 0; col < d; col++) {
      if (Math.floor(col / strides[sys]!) % dsys !== digit) continue;
      out.re[row * d + col] = rho.re[row * d + col]!;
      out.im[row * d + col] = rho.im[row * d + col]!;
    }
    p += rho.re[row * d + row]!;
  }
  if (p > 0) {
    for (let k = 0; k < out.re.length; k++) {
      out.re[k] = out.re[k]! / p;
      out.im[k] = out.im[k]! / p;
    }
  }
  return { p, conditional: out };
}
