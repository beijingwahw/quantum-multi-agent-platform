/**
 * THE LAW — a fixed dissipative channel whose absorbing class is the marked
 * world. This is the physics half of the epoch-5 sentence: choice-lang
 * compiled choose() into controlled branching and kept the world stable BY
 * CONSTRUCTION (engineered programs); here the world is stable because the
 * LAW ITSELF flows every state into it. Register: one world qubit (bit = 1
 * means "in the world") ⊗ one data qubit (the cargo), full dim 4.
 *
 * The law is amplitude damping INTO the world sector, quiet on everything
 * already inside:
 *   K0 = (|1><1| + sqrt(1-gamma)|0><0|) ⊗ I,  K1 = sqrt(gamma) |1><0| ⊗ I
 * so a state's complement population decays as (1-gamma)^k, its sector
 * coherence as (sqrt(1-gamma))^k, and its within-world block is untouched.
 * Everything here has a closed form the witnesses re-derive, never assume.
 */
import type { Rng } from "../core/rng.js";
import { type CMat, identity, kron, mat, mAdd, mScale } from "../core/cmat.js";
import { applyKraus } from "../core/channels.js";

export const GAMMA = 0.25;
export const DATA_DIM = 2;
export const FULL_DIM = 4;

/** Pi_W = |1><1| ⊗ I — the world projector (basis order: world ⊗ data). */
export function worldProjector(): CMat {
  const m = mat(FULL_DIM, FULL_DIM);
  for (let k = 0; k < DATA_DIM; k++) m.re[(DATA_DIM + k) * FULL_DIM + (DATA_DIM + k)] = 1;
  return m;
}

/** Pi_perp = |0><0| ⊗ I. */
export function complementProjector(): CMat {
  const m = mat(FULL_DIM, FULL_DIM);
  for (let k = 0; k < DATA_DIM; k++) m.re[k * FULL_DIM + k] = 1;
  return m;
}

/** The Kraus pair of the law (world damping toward 1, identity on data). */
export function lawKraus(gamma: number = GAMMA): CMat[] {
  const k0w = mat(2, 2);
  k0w.re[0 * 2 + 0] = Math.sqrt(1 - gamma);
  k0w.re[1 * 2 + 1] = 1;
  const k1w = mat(2, 2);
  k1w.re[1 * 2 + 0] = Math.sqrt(gamma); // row 1, col 0: |1><0| moves |0> into the world
  return [kron(k0w, identity(DATA_DIM)), kron(k1w, identity(DATA_DIM))];
}

export function applyLaw(rho: CMat, gamma: number = GAMMA): CMat {
  return applyKraus(rho, lawKraus(gamma));
}

export function iterateLaw(rho: CMat, steps: number, gamma: number = GAMMA): CMat {
  let cur = rho;
  for (let k = 0; k < steps; k++) cur = applyLaw(cur, gamma);
  return cur;
}

/** Membership charge V(rho) = Tr[Pi_W rho] — choice-lang R6's functional. */
export function membershipCharge(rho: CMat): number {
  let v = 0;
  // indices bounded by k < DATA_DIM with FULL_DIM*FULL_DIM storage (max 15 < 16)
  for (let k = 0; k < DATA_DIM; k++) v += rho.re[(DATA_DIM + k) * FULL_DIM + (DATA_DIM + k)]!;
  return v;
}

export function leakage(rho: CMat): number {
  return 1 - membershipCharge(rho);
}

/** Sector coherence: the trace of the (W-row, perp-col) block. */
export function sectorCoherence(rho: CMat): { re: number; im: number } {
  let re = 0;
  let im = 0;
  // indices bounded by k < DATA_DIM with FULL_DIM*FULL_DIM storage (max 11 < 16)
  for (let k = 0; k < DATA_DIM; k++) {
    re += rho.re[(DATA_DIM + k) * FULL_DIM + k]!;
    im += rho.im[(DATA_DIM + k) * FULL_DIM + k]!;
  }
  return { re, im };
}

/** The k->infinity state: both diagonal blocks SUMMED INTO the world, sector
 * coherences dead. The complement block does not stay in place — K1 carries
 * |0,x> to |1,x>, so the cargo rides into the world with its data intact.
 * This is what the law converges to: the CONTENTS are the initial diagonal
 * blocks (path-dependent), never chosen by the law. */
export function collapseIntoWorld(rho: CMat): CMat {
  const out = mat(FULL_DIM, FULL_DIM);
  for (let a = 0; a < DATA_DIM; a++) {
    for (let b = 0; b < DATA_DIM; b++) {
      const inWorld = (DATA_DIM + a) * FULL_DIM + (DATA_DIM + b);
      const inComp = a * FULL_DIM + b;
      // a,b < DATA_DIM bound both indices below 16 (FULL_DIM*FULL_DIM)
      out.re[inWorld] = rho.re[inWorld]! + rho.re[inComp]!;
      out.im[inWorld] = rho.im[inWorld]! + rho.im[inComp]!;
    }
  }
  return out;
}

/** Embed a data state inside the world: |1><1| ⊗ rho_data. */
export function inWorldState(rhoData: CMat): CMat {
  const p1 = mat(2, 2);
  p1.re[3] = 1;
  return kron(p1, rhoData);
}

/** Embed a data state outside the world: |0><0| ⊗ rho_data. */
export function outOfWorldState(rhoData: CMat): CMat {
  const p0 = mat(2, 2);
  p0.re[0] = 1;
  return kron(p0, rhoData);
}

/** Random unitary by complex Gram-Schmidt (QR) on Gaussian columns, each
 * orthonormalized column then re-phased by an independent random phase.
 * Deliberately NOT exp(iH): the family eigensolver's reconstruction check is
 * PSD-only and rejects indefinite spectra. */
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
          // <q, v> = sum conj(q_i) v_i — i < d bounds every access (arrays length d)
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
  // cols holds exactly d columns (one pushed per j-iteration), each length d
  for (let j = 0; j < d; j++) {
    for (let i = 0; i < d; i++) {
      u.re[i * d + j] = cols[j]!.re[i]!;
      u.im[i * d + j] = cols[j]!.im[i]!;
    }
  }
  return u;
}

/**
 * A random branch-block unitary — choice-lang's engineered program, one step:
 * its own unitary on data inside the world, its own outside, control spared.
 * Block-diagonal in the world bit: U = |1><1|⊗A + |0><0|⊗B.
 */
export function randomBranchUnitary(rng: Rng): CMat {
  const p1 = mat(2, 2);
  p1.re[3] = 1;
  const p0 = mat(2, 2);
  p0.re[0] = 1;
  return mAdd(kron(p1, randomUnitary(rng, DATA_DIM)), kron(p0, randomUnitary(rng, DATA_DIM)));
}

/**
 * Random CPTP Kraus set via Stinespring: a random unitary on system ⊗ env,
 * sliced over the env preparation |0>. Completeness Sum K†K = I is asserted
 * by the tests, not assumed here.
 */
export function randomCptpKraus(rng: Rng, d: number, envDim: number): CMat[] {
  const big = randomUnitary(rng, d * envDim);
  const kraus: CMat[] = [];
  for (let j = 0; j < envDim; j++) {
    const k = mat(d, d);
    for (let i = 0; i < d; i++) {
      for (let ip = 0; ip < d; ip++) {
        // big is (d*envDim) square; max index = (d*envDim)^2 - envDim < length
        k.re[i * d + ip] = big.re[(i * envDim + j) * (d * envDim) + ip * envDim]!;
        k.im[i * d + ip] = big.im[(i * envDim + j) * (d * envDim) + ip * envDim]!;
      }
    }
    kraus.push(k);
  }
  return kraus;
}

/** The perturbed law Phi_eps = (1-eps) Phi + eps N as one application. */
export function applyPerturbed(rho: CMat, nKraus: readonly CMat[], eps: number, gamma: number = GAMMA): CMat {
  const viaLaw = applyKraus(rho, lawKraus(gamma));
  const viaN = applyKraus(rho, nKraus);
  return mAdd(mScale(viaLaw, 1 - eps), mScale(viaN, eps));
}

/** The exact algebra bound on asymptotic leakage under the perturbed law. */
export function perturbedLeakageBound(eps: number, gamma: number = GAMMA): number {
  return eps / (1 - (1 - eps) * (1 - gamma));
}

/** Binary entropy, log2 route (the ln route lives in the tests' dual check). */
export function h2(q: number): number {
  if (q <= 0 || q >= 1) return 0;
  return -q * Math.log2(q) - (1 - q) * Math.log2(1 - q);
}

/** Two-rate escape chain (classical, on the world bit): W -> perp at rate r,
 * perp -> W at rate gamma. In-world probability after k steps from W. */
export function twoRateInWorld(k: number, r: number, gamma: number = GAMMA): number {
  const wStar = gamma / (r + gamma);
  return wStar + (1 - r - gamma) ** k * (1 - wStar);
}

export function twoRateRecursion(k: number, r: number, gamma: number = GAMMA): number {
  let w = 1;
  for (let step = 0; step < k; step++) w = (1 - r) * w + gamma * (1 - w);
  return w;
}
