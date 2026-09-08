/**
 * The k=3 face of the wall — six orders, one register.
 *
 * Three channels A, B, C switched over the six permutations of S₃, control in
 * the uniform superposition |u₆⟩ = Σ_π |π⟩/√6. Built by the same fixed-slot
 * discipline as the two-box switch: slot a always holds A's environment, b
 * B's, c C's, regardless of order. Amplitudes are tracked as COMPLEX columns
 * end to end — the random-CPTP families have complex Stinespring factors, and
 * a real-only accumulator is silently immune to the showcase anchors (batch 9).
 * The readout wall at k=3: dephasing the 6-dimensional order register must
 * leave exactly the uniform classical mixture of the six fixed-order channels.
 */
import {
  type CMat,
  identity,
  mat,
  matEq,
  mDagger,
  mMul,
  vec,
  type CVec,
} from "../core/cmat.js";
import { refuse } from "../core/errors.js";
import type { Stinespring } from "../switch/isometry.js";

export const PERMUTATIONS: ReadonlyArray<[number, number, number]> = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
];

/** Permute the subsystem slots of a complex column: new slot perm[k] = old slot k. */
function permuteSlots(
  re: Float64Array,
  im: Float64Array,
  dims: number[],
  perm: number[],
): { re: Float64Array; im: Float64Array; dims: number[] } {
  const m = dims.length;
  const strides: number[] = new Array<number>(m);
  strides[m - 1] = 1;
  for (let i = m - 2; i >= 0; i--) strides[i] = strides[i + 1]! * dims[i + 1]!;
  const newDims = perm.map((p) => dims[p]!);
  const newStrides: number[] = new Array<number>(m);
  newStrides[m - 1] = 1;
  // strides of the PERMUTED registers must come from newDims, not dims — with
  // unequal environment dimensions dims[i+1] indexes a non-bijective map and
  // corrupts every branch (invisible while all env dims happen to be equal)
  for (let i = m - 2; i >= 0; i--) newStrides[i] = newStrides[i + 1]! * newDims[i + 1]!;
  const outRe = new Float64Array(re.length);
  const outIm = new Float64Array(im.length);
  for (let idx = 0; idx < re.length; idx++) {
    let rest = idx;
    const digits: number[] = new Array<number>(m);
    for (let i = 0; i < m; i++) {
      digits[i] = Math.floor(rest / strides[i]!);
      rest %= strides[i]!;
    }
    let newIdx = 0;
    for (let k = 0; k < m; k++) newIdx += digits[perm[k]!]! * newStrides[k]!;
    outRe[newIdx] = re[idx]!;
    outIm[newIdx] = im[idx]!;
  }
  return { re: outRe, im: outIm, dims: newDims };
}

/**
 * Branch isometry W_π: rows over canonical dims [d, eA, eB, eC] with FIXED
 * slot semantics; π lists the channels in application order (indices into
 * `vs`). Built column by column: apply each Stinespring to the live target
 * factor (its environment slot lands right after d), then permute env slots
 * to canonical order.
 */
export function branchIsometry3(vs: readonly Stinespring[], pi: readonly [number, number, number]): CMat {
  // fewer than three channels would crash on vs[0]/vs[k] with a raw TypeError
  if (vs.length < 3) refuse("SWITCH3_CHANNEL_COUNT", "branchIsometry3: the k=3 switch needs exactly three channels");
  const d = vs[0]!.d; // length checked directly above
  const eEnv = vs.map((v) => v.envDim);
  const canonical = [d, eEnv[0]!, eEnv[1]!, eEnv[2]!];
  const rows = canonical.reduce((a, b) => a * b, 1);
  const W = mat(rows, d);
  for (let i = 0; i < d; i++) {
    let dims = [d];
    let re = new Float64Array(d);
    let im = new Float64Array(d);
    re[i] = 1;
    for (const k of pi) {
      const st = vs[k]!; // k in {0,1,2}, length checked at entry
      const e = st.envDim;
      const newDims = [d, e, ...dims.slice(1)];
      const size = newDims.reduce((a, b) => a * b, 1);
      const newRe = new Float64Array(size);
      const newIm = new Float64Array(size);
      const liveStride = Math.max(1, size / (d * e));
      // new(s, m, rest) = Σ_j V[(s,m),j] * amps(j, rest)
      for (let rest = 0; rest < liveStride; rest++) {
        for (let s = 0; s < d; s++) {
          for (let m = 0; m < e; m++) {
            let accRe = 0;
            let accIm = 0;
            const rowIdx = ((s * e + m) * d);
            for (let j = 0; j < d; j++) {
              const ar = re[j * liveStride + rest]!;
              const ai = im[j * liveStride + rest]!;
              if (ar === 0 && ai === 0) continue;
              const vr = st.V.re[(rowIdx + j)]!;
              const vi = st.V.im[(rowIdx + j)]!;
              accRe += vr * ar - vi * ai;
              accIm += vr * ai + vi * ar;
            }
            const target = ((s * e + m) * liveStride + rest);
            newRe[target] = accRe;
            newIm[target] = accIm;
          }
        }
      }
      dims = newDims;
      re = newRe;
      im = newIm;
    }
    // dims now [d, e_{π2}, e_{π1}, e_{π0}]: old env slot s holds channel π[3−s].
    // canonical slot c+1 must hold channel c → old slot s with π[3−s] = c.
    const perm: number[] = [0];
    for (let c = 0; c < 3; c++) {
      for (let t = 0; t < 3; t++) {
        if (pi[t]! === c) {
          perm.push(3 - t);
          break;
        }
      }
    }
    if (perm.length !== 4) refuse("SWITCH3_SLOT_PERM", "slot permutation failed — pi is not a permutation");
    const fixed = permuteSlots(re, im, dims, perm);
    if (fixed.re.length !== rows) refuse("SWITCH3_SLOT_PERM_DIM", "slot permutation changed dimension");
    for (let r = 0; r < rows; r++) {
      W.re[r * d + i] = fixed.re[r]!;
      W.im[r * d + i] = fixed.im[r]!;
    }
  }
  return W;
}

export interface Switch3 {
  /** block-diagonal isometry over (6-dim control ⊗ S) → (control ⊗ S ⊗ E_A ⊗ E_B ⊗ E_C) */
  readonly M: CMat;
  readonly d: number;
  /** the six branch isometries in PERMUTATIONS order */
  readonly branches: readonly CMat[];
}

export function switch3(vs: readonly Stinespring[]): Switch3 {
  if (vs.length < 3) refuse("SWITCH3_CHANNEL_COUNT", "switch3: the k=3 switch needs exactly three channels");
  const d = vs[0]!.d; // length checked directly above
  const branches = PERMUTATIONS.map((pi) => branchIsometry3(vs, pi));
  const branchRows = branches[0]!.rows; // PERMUTATIONS has six entries, branches is its map
  const rows = 6 * branchRows;
  const cols = 6 * d;
  const M = mat(rows, cols);
  for (let p = 0; p < 6; p++) {
    const W = branches[p]!; // p < 6 = PERMUTATIONS.length
    for (let col = p * d; col < (p + 1) * d; col++) {
      for (let row = 0; row < branchRows; row++) {
        const target = (p * branchRows + row) * cols + col;
        const source = row * d + (col - p * d);
        M.re[target] = W.re[source]!;
        M.im[target] = W.im[source]!;
      }
    }
  }
  if (!matEq(mMul(mDagger(M), M), identity(cols), 1e-12)) {
    refuse("SWITCH3_ISOMETRY", "k=3 switch isometry failed M†M = I — construction bug");
  }
  return { M, d, branches };
}

/** Uniform control state |u₆⟩ as a CVec over 6 dimensions. */
export function uniformControl6(): CVec {
  const v = vec(6);
  for (let i = 0; i < 6; i++) v.re[i] = 1 / Math.sqrt(6);
  return v;
}
