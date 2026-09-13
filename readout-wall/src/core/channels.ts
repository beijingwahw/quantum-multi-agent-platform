/**
 * Channel-layer operations on density matrices: the partial trace over
 * subsystems, with dimension and index validation at the boundary.
 */

import { type CMat, mat } from './cmat.js';
import { refuse } from './errors.js';

/** Subsystem dimensions must be positive integers — validated once at the
 * channel boundary, never per cell of the hot loops. */
function checkDims(fn: string, dims: readonly number[]): void {
  for (const d of dims) {
    if (!Number.isInteger(d) || d <= 0) refuse('DIMS_POSITIVE_INTEGER', `${fn}: subsystem dims must be positive integers, got ${d}`);
  }
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
    if (!Number.isInteger(t) || t < 0 || t >= m) refuse('PARTIAL_TRACE_INDEX_RANGE', `partialTrace: traced-out subsystem index ${t} out of range for ${m} subsystems`);
  }
  if (rho.rows !== dims.reduce((a, b) => a * b, 1)) refuse('PARTIAL_TRACE_DIMS_MISMATCH', 'dims do not match rho');
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
  // Per-index decompositions computed once — the same integer arithmetic the
  // per-cell loop used to redo for every (row, col) pair: the kept-subsystem
  // output index of an index (rows and columns share the formula), and its
  // digits on the traced-out subsystems (the match predicate).
  const outIndexOf: number[] = new Array<number>(dIn);
  const traceDigitsOf: number[][] = new Array<number[]>(dIn);
  for (let idx = 0; idx < dIn; idx++) {
    const digits: number[] = new Array<number>(m);
    let r = idx;
    for (let i = 0; i < m; i++) {
      digits[i] = Math.floor(r / strides[i]!);
      r %= strides[i]!;
    }
    let outIdx = 0;
    for (let j = 0; j < keep.length; j++) outIdx += digits[keep[j]!]! * keptStrides[j]!;
    outIndexOf[idx] = outIdx;
    const td: number[] = new Array<number>(traceOut.length);
    for (let j = 0; j < traceOut.length; j++) td[j] = digits[traceOut[j]!]!;
    traceDigitsOf[idx] = td;
  }
  for (let row = 0; row < dIn; row++) {
    const keepRow = outIndexOf[row]!;
    const rowTrace = traceDigitsOf[row]!;
    const rowBase = row * dIn;
    for (let col = 0; col < dIn; col++) {
      const colTrace = traceDigitsOf[col]!;
      let matches = true;
      for (let j = 0; j < rowTrace.length; j++) {
        if (colTrace[j]! !== rowTrace[j]!) {
          matches = false;
          break;
        }
      }
      if (!matches) continue;
      const keepCol = outIndexOf[col]!;
      out.re[keepRow * dOut + keepCol] = out.re[keepRow * dOut + keepCol]! + rho.re[rowBase + col]!;
      out.im[keepRow * dOut + keepCol] = out.im[keepRow * dOut + keepCol]! + rho.im[rowBase + col]!;
    }
  }
  return out;
}
