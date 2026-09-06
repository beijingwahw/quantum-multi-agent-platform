/**
 * Fixtures — the marked world, the engineered family, the random family.
 */
import { type CMat, type CVec, mat } from "../core/cmat.js";
import { makeRng, type Rng } from "../core/rng.js";
import { vNormalize } from "../core/cmat.js";

export const DATA_DIM = 4; // two data qubits
/** The desired world: W = span{|00>, |11>} — projector diag(1,0,0,1). */
export function worldProjector(): CMat {
  const m = mat(4, 4);
  m.re[0] = 1;
  m.re[3 * 4 + 3] = 1;
  return m;
}

/** |00> data state — a resident of the desired world. */
export function worldState(): CMat {
  const m = mat(4, 4);
  m.re[0] = 1;
  return m;
}

/** Random d x d unitary: Gram-Schmidt over d random complex columns. */
export function randomUnitary(rng: Rng, d: number): CMat {
  const cols: CVec[] = [];
  for (let c = 0; c < d; c++) {
    const v: CVec = { n: d, re: new Float64Array(d), im: new Float64Array(d) };
    for (let k = 0; k < d; k++) {
      const u1 = Math.max(rng(), 1e-12);
      const u2 = rng();
      const r = Math.sqrt(-2 * Math.log(u1));
      v.re[k] = r * Math.cos(2 * Math.PI * u2);
      v.im[k] = r * Math.sin(2 * Math.PI * u2);
    }
    cols.push(vNormalize(v));
  }
  // Gram-Schmidt (complex inner product, conjugation on the first factor)
  const ortho: CVec[] = [];
  for (const v of cols) {
    const w: CVec = { n: d, re: new Float64Array(v.re), im: new Float64Array(v.im) };
    for (let pass = 0; pass < 2; pass++) {
      for (const u of ortho) {
        let dre = 0;
        let dim = 0;
        for (let k = 0; k < d; k++) {
          dre += u.re[k]! * w.re[k]! + u.im[k]! * w.im[k]!;
          dim += u.re[k]! * w.im[k]! - u.im[k]! * w.re[k]!;
        }
        for (let k = 0; k < d; k++) {
          w.re[k] = w.re[k]! - (dre * u.re[k]! - dim * u.im[k]!);
          w.im[k] = w.im[k]! - (dre * u.im[k]! + dim * u.re[k]!);
        }
      }
    }
    let nrm = 0;
    for (let k = 0; k < d; k++) nrm += w.re[k]! * w.re[k]! + w.im[k]! * w.im[k]!;
    nrm = Math.sqrt(nrm);
    if (nrm < 1e-10) throw new Error("randomUnitary: Gram-Schmidt rank collapse");
    ortho.push({ n: d, re: Float64Array.from(w.re.map((x) => x / nrm)), im: Float64Array.from(w.im.map((x) => x / nrm)) });
  }
  const u = mat(d, d);
  for (let c = 0; c < d; c++) {
    const v = ortho[c]!; // ortho has exactly d columns (one push per iteration)
    for (let r = 0; r < d; r++) {
      u.re[r * d + c] = v.re[r]!;
      u.im[r * d + c] = v.im[r]!;
    }
  }
  return u;
}

/** Random 2x2 unitary via a random complex Gram-Schmidt pair. */
function randomU2(rng: Rng): CMat {
  return randomUnitary(rng, 2);
}

/**
 * ENGINEERED branch unitary: block-diagonal in W (+) W-perp with random 2x2
 * blocks — W = span{e0, e3}, W-perp = span{e1, e2}.
 */
export function engineeredUnitary(seed: number): CMat {
  const rng = makeRng(seed);
  const a = randomU2(rng);
  const b = randomU2(rng);
  const u = mat(4, 4);
  // W block on indices {0, 3}
  u.re[0 * 4 + 0] = a.re[0]!;
  u.im[0 * 4 + 0] = a.im[0]!;
  u.re[0 * 4 + 3] = a.re[1]!;
  u.im[0 * 4 + 3] = a.im[1]!;
  u.re[3 * 4 + 0] = a.re[2]!;
  u.im[3 * 4 + 0] = a.im[2]!;
  u.re[3 * 4 + 3] = a.re[3]!;
  u.im[3 * 4 + 3] = a.im[3]!;
  // W-perp block on indices {1, 2}
  u.re[1 * 4 + 1] = b.re[0]!;
  u.im[1 * 4 + 1] = b.im[0]!;
  u.re[1 * 4 + 2] = b.re[1]!;
  u.im[1 * 4 + 2] = b.im[1]!;
  u.re[2 * 4 + 1] = b.re[2]!;
  u.im[2 * 4 + 1] = b.im[2]!;
  u.re[2 * 4 + 2] = b.re[3]!;
  u.im[2 * 4 + 2] = b.im[3]!;
  return u;
}

/** Fully random branch unitary (not preserving W). */
export function randomBranchUnitary(seed: number): CMat {
  return randomUnitary(makeRng(seed), 4);
}
