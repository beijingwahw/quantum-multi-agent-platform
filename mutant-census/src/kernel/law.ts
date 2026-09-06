/**
 * The physics toys the battery exercises: the damping-into-the-world law from
 * stable-world (lineage: ent-clearing family), its charge and collapse, the
 * two-rate escape chain, and a postselection toy. Everything here has a
 * closed form the battery re-derives; nothing is transcribed.
 */
import type { Rng } from "../core/rng.js";
import { type CMat, type CVec, identity, kron, mat, mMul, mDagger, vKron, vec } from "../core/cmat.js";

export const GAMMA = 0.25;
export const FULL_DIM = 4;
export const DATA_DIM = 2;

/** Kraus pair of the law: damping INTO the world bit, identity on the cargo. */
export function lawKraus(gamma: number = GAMMA): CMat[] {
  const k0w = mat(2, 2);
  k0w.re[0 * 2 + 0] = Math.sqrt(1 - gamma);
  k0w.re[1 * 2 + 1] = 1;
  const k1w = mat(2, 2);
  k1w.re[1 * 2 + 0] = Math.sqrt(gamma); // row 1, col 0: |1><0| carries |0> into the world
  return [kron(k0w, identity(DATA_DIM)), kron(k1w, identity(DATA_DIM))];
}

export function applyLaw(rho: CMat, gamma: number = GAMMA): CMat {
  const k = lawKraus(gamma);
  const out = mat(rho.rows, rho.cols);
  for (const kk of k) {
    const term = mMul(mMul(kk, rho), mDagger(kk));
    for (let t = 0; t < out.re.length; t++) {
      out.re[t] = out.re[t]! + term.re[t]!;
      out.im[t] = out.im[t]! + term.im[t]!;
    }
  }
  return out;
}

export function iterateLaw(rho: CMat, steps: number, gamma: number = GAMMA): CMat {
  let cur = rho;
  for (let k = 0; k < steps; k++) cur = applyLaw(cur, gamma);
  return cur;
}

export function membershipCharge(rho: CMat): number {
  let v = 0;
  for (let k = 0; k < DATA_DIM; k++) v += rho.re[(DATA_DIM + k) * FULL_DIM + (DATA_DIM + k)]!;
  return v;
}

/** The k->infinity state: both diagonal blocks summed INTO the world (the
 * cargo rides in); coherences between sectors dead. Batch 31's lesson lives
 * here: the limit is the into-world collapse, NOT the dephased twin. */
export function collapseIntoWorld(rho: CMat): CMat {
  const out = mat(FULL_DIM, FULL_DIM);
  for (let a = 0; a < DATA_DIM; a++) {
    for (let b = 0; b < DATA_DIM; b++) {
      const inWorld = (DATA_DIM + a) * FULL_DIM + (DATA_DIM + b);
      const inComp = a * FULL_DIM + b;
      out.re[inWorld] = rho.re[inWorld]! + rho.re[inComp]!;
      out.im[inWorld] = rho.im[inWorld]! + rho.im[inComp]!;
    }
  }
  return out;
}

/** Embed a 2x2 cargo inside the world: |1><1| (c) rho. */
export function embedWorld(rhoCargo: CMat): CMat {
  const p1 = mat(2, 2);
  p1.re[3] = 1;
  return kron(p1, rhoCargo);
}

/** |0><0| (x) rho — outside the world. */
export function embedOutside(rhoCargo: CMat): CMat {
  const p0 = mat(2, 2);
  p0.re[0] = 1;
  return kron(p0, rhoCargo);
}

/** Two-rate escape chain on the world bit: W -> perp at rate r, perp -> W at
 * gamma. Closed form of P(in-world at step k) starting in W. */
export function twoRateInWorld(k: number, r: number, gamma: number = GAMMA): number {
  const wStar = gamma / (r + gamma);
  return wStar + Math.pow(1 - r - gamma, k) * (1 - wStar);
}

/** Random unitary by two-pass complex Gram-Schmidt with random re-phasing —
 * NOT exp(iH): the family eigensolver's reconstruction check is PSD-only
 * (batch 31). Lineage: stable-world law.ts. */
export function randomUnitary(rng: Rng, d: number): CMat {
  const cols: Array<{ re: Float64Array; im: Float64Array }> = [];
  for (let j = 0; j < d; j++) {
    const v = { re: new Float64Array(d), im: new Float64Array(d) };
    for (let i = 0; i < d; i++) {
      v.re[i] = rng.normal();
      v.im[i] = rng.normal();
    }
    for (let pass = 0; pass < 2; pass++) {
      for (const q of cols) {
        let dr = 0;
        let di = 0;
        for (let i = 0; i < d; i++) {
          dr += q.re[i]! * v.re[i]! + q.im[i]! * v.im[i]!;
          di += q.re[i]! * v.im[i]! - q.im[i]! * v.re[i]!;
        }
        for (let i = 0; i < d; i++) {
          v.re[i] = v.re[i]! - (dr * q.re[i]! - di * q.im[i]!);
          v.im[i] = v.im[i]! - (dr * q.im[i]! + di * q.re[i]!);
        }
      }
    }
    let nrm = 0;
    for (let i = 0; i < d; i++) nrm += v.re[i]! * v.re[i]! + v.im[i]! * v.im[i]!;
    nrm = Math.sqrt(nrm);
    if (nrm < 1e-12) throw new Error("randomUnitary: degenerate draw");
    const phase = rng() * 2 * Math.PI;
    const c = Math.cos(phase) / nrm;
    const s = Math.sin(phase) / nrm;
    for (let i = 0; i < d; i++) {
      const re = v.re[i]!;
      const im = v.im[i]!;
      v.re[i] = c * re - s * im;
      v.im[i] = s * re + c * im;
    }
    cols.push(v);
  }
  const u = mat(d, d);
  for (let j = 0; j < d; j++) {
    for (let i = 0; i < d; i++) {
      u.re[i * d + j] = cols[j]!.re[i]!;
      u.im[i * d + j] = cols[j]!.im[i]!;
    }
  }
  return u;
}

/** Random CPTP Kraus set via Stinespring over a random unitary on system(x)env. */
export function randomCptpKraus(rng: Rng, d: number, envDim: number): CMat[] {
  const big = randomUnitary(rng, d * envDim);
  const kraus: CMat[] = [];
  for (let j = 0; j < envDim; j++) {
    const k = mat(d, d);
    for (let i = 0; i < d; i++) {
      for (let ip = 0; ip < d; ip++) {
        k.re[i * d + ip] = big.re[(i * envDim + j) * (d * envDim) + ip * envDim]!;
        k.im[i * d + ip] = big.im[(i * envDim + j) * (d * envDim) + ip * envDim]!;
      }
    }
    kraus.push(k);
  }
  return kraus;
}

/** A sector-coherent start: ((|0> + e^{i phi}|1>)/sqrt2) (x) cargo. */
export function sectorCoherentState(rng: Rng, cargo: CVec): CMat {
  const phi = rng() * 2 * Math.PI;
  const w = vec(2);
  w.re[0] = 1 / Math.SQRT2;
  w.re[1] = Math.cos(phi) / Math.SQRT2;
  w.im[1] = Math.sin(phi) / Math.SQRT2;
  const full = vKron(w, cargo);
  return vecToRhoLocal(full);
}

function vecToRhoLocal(v: CVec): CMat {
  const m = mat(v.n, v.n);
  for (let i = 0; i < v.n; i++) {
    for (let j = 0; j < v.n; j++) {
      m.re[i * v.n + j] = v.re[i]! * v.re[j]! + v.im[i]! * v.im[j]!;
      m.im[i * v.n + j] = v.im[i]! * v.re[j]! - v.re[i]! * v.im[j]!;
    }
  }
  return m;
}

/** Same-event MC: probability of being OUTSIDE the world at step K, chain
 * simulated step by step (the batch-31 event definition: "outside AT step
 * K", not "ever left"). */
export function mcOutsideAtK(seedState: boolean, rng: Rng, K: number, r: number, gamma: number = GAMMA): boolean {
  let inWorld = seedState;
  for (let k = 0; k < K; k++) inWorld = inWorld ? rng() >= r : rng() < gamma;
  return !inWorld;
}
