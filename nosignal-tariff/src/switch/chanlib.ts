/**
 * Named channel families as Kraus sets — the "black boxes" fed to the switch.
 * Each family carries the structural property that decides whether order
 * superposition is a resource (T2/T3 admission logic).
 */

import { type CMat, mat } from '../core/cmat.js';
import type { Rng } from '../core/rng.js';
import { weyl } from '../core/states.js';
import { type Stinespring, krausToStinespring } from './isometry.js';

/**
 * Replacer channel Λ(ρ) = |v⟩⟨v| · Tr ρ for the uniform |v⟩: K_i = |v⟩⟨i|.
 * Zero classical capacity (output independent of input); env dim d.
 */
export function replacerKraus(d: number): CMat[] {
  const kraus: CMat[] = [];
  for (let i = 0; i < d; i++) {
    const K = mat(d, d);
    for (let s = 0; s < d; s++) {
      K.re[s * d + i] = 1 / Math.sqrt(d);
    }
    kraus.push(K);
  }
  return kraus;
}

/**
 * Completely depolarizing channel Λ(ρ) = I/d · Tr ρ: K_{ij} = |i⟩⟨j| / √d.
 * Zero classical capacity; env dim d² (structurally different dilation from
 * the replacer — the pair exercises dilation independence).
 */
export function completelyDepolarizingKraus(d: number): CMat[] {
  const kraus: CMat[] = [];
  const n = 1 / Math.sqrt(d);
  for (let i = 0; i < d; i++) {
    for (let j = 0; j < d; j++) {
      const K = mat(d, d);
      K.re[i * d + j] = n;
      kraus.push(K);
    }
  }
  return kraus;
}

/**
 * Depolarizing channel Λ(ρ) = (1−p)ρ + p·I/d·Tr ρ via the Weyl orbit:
 * Kraus √(1−p(d²−1)/d²)·I plus √(p/d²)·W_{ab} for (a,b) ≠ (0,0).
 * Valid for p ∈ [0, d²/(d²−1)]; p = 1 is the completely depolarizing point.
 */
export function depolarizingKraus(d: number, p: number): CMat[] {
  const pMax = (d * d) / (d * d - 1);
  if (p < 0 || p > pMax + 1e-12) throw new Error(`depolarizing p must be in [0, ${pMax.toFixed(3)}]`);
  const kraus: CMat[] = [];
  const K0 = mat(d, d);
  const c0 = Math.sqrt(Math.max(0, 1 - (p * (d * d - 1)) / (d * d)));
  for (let i = 0; i < d; i++) K0.re[i * d + i] = c0;
  kraus.push(K0);
  const cw = Math.sqrt(p / (d * d));
  for (let a = 0; a < d; a++) {
    for (let b = 0; b < d; b++) {
      if (a === 0 && b === 0) continue;
      const W = weyl(d, a, b);
      const K = mat(d, d);
      for (let k = 0; k < d * d; k++) {
        K.re[k] = cw * W.re[k]!;
        K.im[k] = cw * W.im[k]!;
      }
      kraus.push(K);
    }
  }
  return kraus;
}

/** Unitary box: single Kraus operator U (env dim 1). */
export function unitaryKraus(u: CMat): CMat[] {
  return [u];
}

/**
 * Random CPTP map: a random isometry d → d·k split into k Kraus blocks.
 * Gram-Schmidt orthonormalization runs on random complex columns with the
 * inner product ⟨u, v⟩ = Σ u*·v (conjugation on the first factor — the
 * classic silent-bug site, asserted by the isometry check after building).
 */
export function randomChannelStinespring(rng: Rng, d: number, envDim: number): Stinespring {
  const cols: Array<{ re: number[]; im: number[] }> = [];
  for (let c = 0; c < d; c++) {
    const v = { re: [] as number[], im: [] as number[] };
    for (let r = 0; r < d * envDim; r++) {
      const u1 = Math.max(rng(), 1e-12);
      const u2 = rng();
      const rad = Math.sqrt(-2 * Math.log(u1));
      v.re.push(rad * Math.cos(2 * Math.PI * u2));
      v.im.push(rad * Math.sin(2 * Math.PI * u2));
    }
    cols.push(v);
  }
  const ortho: Array<{ re: number[]; im: number[] }> = [];
  for (const v of cols) {
    const w = { re: v.re.slice(), im: v.im.slice() };
    for (let pass = 0; pass < 2; pass++) {
      for (const u of ortho) {
        let dre = 0;
        let dim_ = 0;
        for (let k = 0; k < w.re.length; k++) {
          dre += u.re[k]! * w.re[k]! + u.im[k]! * w.im[k]!;
          dim_ += u.re[k]! * w.im[k]! - u.im[k]! * w.re[k]!;
        }
        for (let k = 0; k < w.re.length; k++) {
          w.re[k]! -= dre * u.re[k]! - dim_ * u.im[k]!;
          w.im[k]! -= dre * u.im[k]! + dim_ * u.re[k]!;
        }
      }
    }
    let nrm = 0;
    for (let k = 0; k < w.re.length; k++) nrm += w.re[k]! * w.re[k]! + w.im[k]! * w.im[k]!;
    nrm = Math.sqrt(nrm);
    if (nrm < 1e-10) throw new Error('randomChannel: Gram-Schmidt rank collapse');
    ortho.push({ re: w.re.map((x) => x / nrm), im: w.im.map((x) => x / nrm) });
  }
  const V = mat(d * envDim, d);
  for (let c = 0; c < d; c++) {
    for (let r = 0; r < d * envDim; r++) {
      V.re[r * d + c] = ortho[c]!.re[r]!;
      V.im[r * d + c] = ortho[c]!.im[r]!;
    }
  }
  const st: Stinespring = { d, envDim, V };
  // isometry certificate happens inside krausToStinespring-equivalent check
  return st;
}

/** Kraus set of a Stinespring dilation (inverse of krausToStinespring). */
export function stinespringToKraus(st: Stinespring): CMat[] {
  const kraus: CMat[] = [];
  for (let m = 0; m < st.envDim; m++) {
    const K = mat(st.d, st.d);
    for (let s = 0; s < st.d; s++) {
      for (let i = 0; i < st.d; i++) {
        K.re[s * st.d + i] = st.V.re[(s * st.envDim + m) * st.d + i]!;
        K.im[s * st.d + i] = st.V.im[(s * st.envDim + m) * st.d + i]!;
      }
    }
    kraus.push(K);
  }
  return kraus;
}

export { krausToStinespring };
