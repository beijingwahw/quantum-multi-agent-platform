/**
 * T2 — The FK trap detection calculus, exact.
 *
 * Setting (isolated-trap kernel of Fitzsimons–Kashefi verification): the
 * client prepares a trap qubit |+_θ⟩ with θ uniform over the 8 equatorial
 * angles and later asks for a measurement in basis θ (the state is an
 * eigenstate of the revealed basis: the honest run passes with probability
 * 1). A deviating server applies an arbitrary CPTP map Λ = {E_j} to the
 * trap before the basis is revealed.
 *
 * Machine-verified claims:
 *  (1) Acceptance averaged over the secret angle:
 *      p̄(Λ) = Σ_j |c_{j,I}|² + ½ Σ_j (|c_{j,X}|² + |c_{j,Y}|²)
 *      with c_{j,P} the Pauli coefficients of E_j. Three independent
 *      computations must agree to machine precision: the density-matrix
 *      physics referee, the Pauli-expansion referee (per-θ identity
 *      ⟨+_θ|E_j|+_θ⟩ = c_I + c_X cos θ + c_Y sin θ), and the closed formula.
 *  (2) Tier structure: Z components are detected with certainty (⟨Z⟩ = 0 on
 *      every |+θ⟩), X and Y components with probability exactly ½, the
 *      identity is invisible. Exact bound:
 *      p̄_reject ≥ ½ (1 − idMass), tight for {√(1−q) I, √q X}.
 *  (3) t independent traps: acceptance = p̄(Λ)^t exactly.
 *  (4) Blind spot: a deviation never touching the trap (arbitrary unitary
 *      on a garbage register) leaves acceptance exactly 1 — traps constrain
 *      only what they touch; full protocols interleave traps with the
 *      computation for this reason (cited, not re-proved here).
 */

import { type CMat, type CVec, mat, mMul, mDagger, mScale, identity, vInner, kron } from '../core/cmat.js';
import { applyKraus } from '../core/channels.js';
import { equatorial, equatorialRho, PAULI_X, PAULI_Y, PAULI_Z, fromVec, randomPureState } from '../core/states.js';
import type { Rng } from '../core/rng.js';
import { applyLocalRho, expPauli, mulVec } from '../core/gates.js';

export const TRAP_ANGLES: readonly number[] = Array.from({ length: 8 }, (_, k) => (k * Math.PI) / 4);

export interface PauliCoeffs {
  cI: { re: number; im: number };
  cX: { re: number; im: number };
  cY: { re: number; im: number };
  cZ: { re: number; im: number };
}

/** Pauli expansion E = c_I I + c_X X + c_Y Y + c_Z Z via Tr(P E)/2 (P† = P). */
export function pauliCoeffs(e: CMat): PauliCoeffs {
  const tr = (p: CMat): { re: number; im: number } => {
    const prod = mMul(p, e);
    let re = 0;
    let im = 0;
    for (let i = 0; i < 2; i++) {
      re += prod.re[i * 2 + i]!;
      im += prod.im[i * 2 + i]!;
    }
    return { re: re / 2, im: im / 2 };
  };
  return { cI: tr(identity(2)), cX: tr(PAULI_X), cY: tr(PAULI_Y), cZ: tr(PAULI_Z) };
}

/**
 * Formula: p̄(Λ) = Σ_j |c_{j,I}|² + ½ Σ_j (|c_{j,X}|² + |c_{j,Y}|²).
 * (⟨+θ|X|+θ⟩ = cos θ, ⟨+θ|Y|+θ⟩ = ±sin θ, ⟨+θ|Z|+θ⟩ = 0; averaging cos², sin²
 * over the 8-angle grid gives ½ and all cross terms vanish.)
 */
export function trapAcceptanceFormula(kraus: readonly CMat[]): number {
  let acc = 0;
  for (const e of kraus) {
    const c = pauliCoeffs(e);
    acc += c.cI.re * c.cI.re + c.cI.im * c.cI.im;
    acc += 0.5 * (c.cX.re * c.cX.re + c.cX.im * c.cX.im);
    acc += 0.5 * (c.cY.re * c.cY.re + c.cY.im * c.cY.im);
  }
  return acc;
}

/** Physics referee: per-angle density-matrix evaluation Σ_j ⟨+_θ|E_j ρ_θ E_j†|+_θ⟩, averaged over the 8 secrets. */
export function trapAcceptanceDirect(kraus: readonly CMat[]): number {
  let acc = 0;
  for (const theta of TRAP_ANGLES) {
    const rho = applyKraus(equatorialRho(theta), kraus);
    const psi = equatorial(theta);
    const ip = vInner(psi, mulVec(rho, psi));
    acc += ip.re / TRAP_ANGLES.length;
  }
  return acc;
}

/** Pauli-expansion referee: per-θ identity ⟨+_θ|E_j|+_θ⟩ = c_{j,I} + c_{j,X} cos θ ± c_{j,Y} sin θ, no matrices touched. */
export function trapAcceptanceExpansion(kraus: readonly CMat[]): number {
  let acc = 0;
  for (const theta of TRAP_ANGLES) {
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    for (const e of kraus) {
      const c = pauliCoeffs(e);
      // ⟨Y⟩ = sin θ on |+θ⟩ (real), so c_Y enters as a real shift c_Y·sin θ
      const val = c.cI.re + c.cX.re * cos + c.cY.re * sin;
      const im = c.cI.im + c.cX.im * cos + c.cY.im * sin;
      acc += (val * val + im * im) / TRAP_ANGLES.length; // sum over Kraus, average over θ only
    }
  }
  return acc;
}

export function idMass(kraus: readonly CMat[]): number {
  let m = 0;
  for (const e of kraus) {
    const c = pauliCoeffs(e);
    m += c.cI.re * c.cI.re + c.cI.im * c.cI.im;
  }
  return m;
}

/** Exact rejection lower bound ½(1 − idMass); the theorem says p̄_reject ≥ this. */
export function rejectionLowerBound(kraus: readonly CMat[]): number {
  return 0.5 * (1 - idMass(kraus));
}

/** The X-attack family {√(1−q) I, √q X}: acceptance exactly 1 − q/2 — bound is tight. */
export function xAttack(q: number): CMat[] {
  if (!(q >= 0 && q <= 1)) throw new Error(`QV_PROBABILITY: xAttack q must be in [0,1], got ${q}`);
  return [mScale(identity(2), Math.sqrt(1 - q)), mScale(PAULI_X, Math.sqrt(q))];
}

/** Random CPTP map via a random isometry: k Kraus operators = row blocks of V (2k×2, V†V = I₂). */
export function randomChannel(rng: Rng, k: number): CMat[] {
  const cols: Array<{ re: number[]; im: number[] }> = [];
  for (let c = 0; c < 2; c++) {
    const v = { re: [] as number[], im: [] as number[] };
    for (let r = 0; r < 2 * k; r++) {
      v.re.push(rng.normal());
      v.im.push(rng.normal());
    }
    cols.push(v);
  }
  // complex Gram–Schmidt: normalize each pivot BEFORE subtracting its projection
  for (let c = 0; c < cols.length; c++) {
    for (let p = 0; p < c; p++) {
      let dr = 0;
      let di = 0;
      for (let r = 0; r < 2 * k; r++) {
        dr += cols[p]!.re[r]! * cols[c]!.re[r]! + cols[p]!.im[r]! * cols[c]!.im[r]!;
        di += cols[p]!.re[r]! * cols[c]!.im[r]! - cols[p]!.im[r]! * cols[c]!.re[r]!;
      }
      for (let r = 0; r < 2 * k; r++) {
        cols[c]!.re[r] = cols[c]!.re[r]! - (dr * cols[p]!.re[r]! - di * cols[p]!.im[r]!);
        cols[c]!.im[r] = cols[c]!.im[r]! - (dr * cols[p]!.im[r]! + di * cols[p]!.re[r]!);
      }
    }
    let n2 = 0;
    for (let r = 0; r < 2 * k; r++) n2 += cols[c]!.re[r]! * cols[c]!.re[r]! + cols[c]!.im[r]! * cols[c]!.im[r]!;
    const n = Math.sqrt(n2);
    for (let r = 0; r < 2 * k; r++) {
      cols[c]!.re[r] = cols[c]!.re[r]! / n;
      cols[c]!.im[r] = cols[c]!.im[r]! / n;
    }
  }
  const kraus: CMat[] = [];
  for (let j = 0; j < k; j++) {
    const m = mat(2, 2);
    for (let a = 0; a < 2; a++) {
      for (let b = 0; b < 2; b++) {
        m.re[a * 2 + b] = cols[b]!.re[2 * j + a]!;
        m.im[a * 2 + b] = cols[b]!.im[2 * j + a]!;
      }
    }
    kraus.push(m);
  }
  const tp = mat(2, 2);
  for (const kk of kraus) {
    const kd = mMul(mDagger(kk), kk);
    for (let i = 0; i < 4; i++) {
      tp.re[i] = tp.re[i]! + kd.re[i]!;
      tp.im[i] = tp.im[i]! + kd.im[i]!;
    }
  }
  const err =
    Math.abs(tp.re[0]! - 1) + Math.abs(tp.re[3]! - 1) + Math.abs(tp.re[1]!) + Math.abs(tp.re[2]!) +
    Math.abs(tp.im[0]!) + Math.abs(tp.im[3]!);
  if (err > 1e-10) throw new Error(`QV_NOT_TP: randomChannel produced a non-trace-preserving map (err=${err})`);
  return kraus;
}

/** t independent traps: exact acceptance = p̄(Λ)^t (product over i.i.d. rounds). */
export function multiTrapAcceptance(kraus: readonly CMat[], t: number): number {
  return trapAcceptanceFormula(kraus) ** t;
}

/** Blind spot: arbitrary attack on a garbage qubit never touching the trap — acceptance exactly 1. */
export function garbageBlindSpot(rng: Rng): { trapAcceptance: number; garbageFidelity: number } {
  const theta = TRAP_ANGLES[3]!; // the 8-angle grid is fixed above — index 3 is in range
  const garbage = randomPureState(2, rng);
  let joint = kron(equatorialRho(theta), fromVec(garbage));
  const u = mMul(expPauli([rng.normal(), rng.normal(), 0]), expPauli([0, rng.normal(), rng.normal()]));
  joint = applyLocalRho(joint, 2, 1, u); // attack on garbage qubit only
  const pPlus = measurePlusProbQ0(joint, theta);
  const gOut = applyKraus(fromVec(garbage), [u]);
  const ip = vInner(garbage, mulVec(gOut, garbage));
  return { trapAcceptance: pPlus, garbageFidelity: ip.re };
}

function measurePlusProbQ0(rho: CMat, theta: number): number {
  // P(+_θ on qubit 0) = Σ_b ⟨+_θ, b| ρ |+_θ, b⟩ — the vectors are already normalized
  const psi = equatorial(theta);
  let p = 0;
  for (let b = 0; b < 2; b++) {
    const v: CVec = { n: 4, re: new Float64Array(4), im: new Float64Array(4) };
    v.re[0 * 2 + b] = psi.re[0]!;
    v.im[0 * 2 + b] = psi.im[0]!;
    v.re[1 * 2 + b] = psi.re[1]!;
    v.im[1 * 2 + b] = psi.im[1]!;
    p += vInner(v, mulVec(rho, v)).re;
  }
  return p;
}
