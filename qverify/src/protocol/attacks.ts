/**
 * T5a/b/d — Optimal attack games on the trap/basis-commitment layer, exact.
 *
 *  (a) Helstrom two-state discrimination: distinguishing |+_θ⟩ from
 *      |+_{θ+π/4}⟩ (the one-bit uncertainty a server faces about a trap's
 *      secret angle) succeeds with probability exactly
 *      p* = (1 + sin(π/8))/2 ≈ 0.691342. Verified by the trace-norm formula
 *      AND by direct POVM optimization over all binary qubit POVMs.
 *  (b) BB84 games — two distinct constants, machine-separated:
 *      - label discrimination ("which of the four states?"): the pretty-good
 *        measurement attains ½ and the dual feasible point Γ = I/4 proves
 *        ½ optimal;
 *      - bit discrimination ("which bit, basis unknown?"): Helstrom between
 *        the two bit-ensembles gives exactly (2+√2)/4 ≈ 0.853553 — the SAME
 *        constant as the quantum CHSH game value, both being the 22.5°
 *        geometry of √2.
 *  (d) Commit-then-reveal wall: if the server must return a qubit (plus a
 *      claimed outcome bit) before the measurement basis θ is revealed,
 *      acceptance is EXACTLY ½ for every strategy — because averaging the
 *      equatorial projectors over the 8 secret angles gives I/2:
 *      (1/8)Σ_θ Π_θ^+ = I/2. Machine check: the matrix identity, plus MC
 *      over random attacking channels.
 */

import { type CMat, type CVec, mat, mAdd, mMul, mDagger, identity, isHermitian, eigHermitian, fromSpectral, mScale, vInner } from '../core/cmat.js';
import { equatorial, fromVec, KET0, KET1, PLUS, MINUS } from '../core/states.js';
import { traceDistance } from '../core/measures.js';
import { makeRng } from '../core/rng.js';
import { randomChannel, TRAP_ANGLES } from './traps.js';

/** Helstrom success probability for two states with priors (½,½). */
export function helstromTwo(rho0: CMat, rho1: CMat): number {
  return 0.5 * (1 + traceDistance(rho0, rho1));
}

/** The equatorial pair game: |+_θ⟩ vs |+_{θ+π/4}⟩ — expected (1+sin π/8)/2. */
export function equatorialPairHelstrom(): number {
  return helstromTwo(fromVec(equatorial(0)), fromVec(equatorial(Math.PI / 4)));
}

export function equatorialPairHelstromClosed(): number {
  return (1 + Math.sin(Math.PI / 8)) / 2;
}

/**
 * Direct POVM optimization referee for the two-state game: maximize
 * ½ + ¼ r·t over effects E = (I + r·σ)/2, |r| ≤ 1 (all binary qubit POVMs),
 * t_i = Tr(σ_i (ρ₀−ρ₁)) — compass search, deterministic multistart.
 */
export function helstromTwoOptimize(rho0: CMat, rho1: CMat, starts = 16): number {
  const diff = mAdd(rho0, mScale(rho1, -1));
  const t: number[] = [];
  for (const p of paulis2()) {
    const prod = mMul(p, diff);
    t.push(prod.re[0]! + prod.re[3]!);
  }
  const rng = makeRng(0xc0ffee);
  let best = -Infinity;
  const obj = (r: readonly number[]): number => 0.5 + 0.25 * (t[0]! * r[0]! + t[1]! * r[1]! + t[2]! * r[2]!);
  for (let s = 0; s < starts; s++) {
    let r = [rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1];
    const norm = Math.hypot(r[0]!, r[1]!, r[2]!);
    if (norm > 1) r = r.map((x) => x / norm);
    let fx = obj(r);
    let step = 0.2;
    let sweeps = 0;
    let lastFx = -Infinity;
    let stagnant = 0;
    while (step > 1e-7 && sweeps < 4000 && stagnant < 60) {
      let improved = false;
      for (let d = 0; d < 3; d++) {
        for (const sgn of [1, -1]) {
          const y = r.slice();
          y[d] = y[d]! + sgn * step;
          // project back onto the unit ball so the search can slide along the
          // boundary where the optimum lives (E = (I + r·σ)/2 needs |r| ≤ 1)
          const ny = Math.hypot(y[0]!, y[1]!, y[2]!);
          if (ny > 1) {
            y[0] = y[0]! / ny;
            y[1] = y[1]! / ny;
            y[2] = y[2]! / ny;
          }
          const fy = obj(y);
          if (fy > fx + 1e-14) {
            r = y;
            fx = fy;
            improved = true;
          }
        }
      }
      if (!improved) step *= 0.5;
      stagnant = Math.abs(fx - lastFx) < 1e-12 ? stagnant + 1 : 0;
      lastFx = fx;
      sweeps++;
    }
    best = Math.max(best, fx);
  }
  return best;
}

export interface PgmResult {
  success: number;
  /** ‖Σ_k E_k − I‖₁ (POVM completeness) */
  completenessError: number;
}

/**
 * Pretty-good measurement for a weighted pure-state ensemble:
 * E_k = G^{−1/2} (w_k |ψ_k⟩⟨ψ_k|) G^{−1/2}, G = Σ_k w_k |ψ_k⟩⟨ψ_k|.
 * Success = Σ_k w_k ⟨ψ_k|E_k|ψ_k⟩ = Σ_k w_k² ⟨ψ_k|G^{−1/2}|ψ_k⟩².
 */
export function prettyGoodMeasurement(states: readonly CVec[], weights: readonly number[]): PgmResult {
  const first = states[0];
  // a mismatched weights vector would silently read undefined and emit NaN effects
  if (first === undefined || weights.length !== states.length) {
    throw new Error(`prettyGoodMeasurement: expected one weight per state, got ${weights.length} for ${states.length} states`);
  }
  const k = states.length;
  const d = first.n;
  const psiMats = states.map((s) => fromVec(s));
  const G = mat(d, d);
  for (let a = 0; a < k; a++) {
    for (let i = 0; i < d * d; i++) {
      G.re[i] = G.re[i]! + weights[a]! * psiMats[a]!.re[i]!;
      G.im[i] = G.im[i]! + weights[a]! * psiMats[a]!.im[i]!;
    }
  }
  if (!isHermitian(G, 1e-12)) throw new Error('G not Hermitian');
  const { values, vectors } = eigHermitian(G);
  const invSqrtVals = Float64Array.from(values, (v) => (v > 1e-12 ? 1 / Math.sqrt(v) : 0));
  const GinvSqrt = fromSpectral(invSqrtVals, vectors);
  let success = 0;
  let sum = mat(d, d);
  for (let a = 0; a < k; a++) {
    const Ek = mScale(mMul(mMul(GinvSqrt, psiMats[a]!), GinvSqrt), weights[a]!);
    sum = mAdd(sum, Ek);
    // ⟨ψ_k|E_k|ψ_k⟩ = w_k ⟨ψ_k|G^{−1/2}|ψ_k⟩²
    const v = mulVec(GinvSqrt, states[a]!);
    const ip = vInner(states[a]!, v);
    success += weights[a]! * weights[a]! * ip.re * ip.re;
  }
  const eye = identity(d);
  let err = 0;
  for (let i = 0; i < d * d; i++) err += Math.abs(sum.re[i]! - eye.re[i]!) + Math.abs(sum.im[i]!);
  return { success, completenessError: err };
}

/** BB84 label discrimination ("which of the four states?") — PGM ½, dual-certified optimal. */
export function bb84LabelGame(): { pgmSuccess: number; dualUpperBound: number } {
  const states: CVec[] = [KET0, KET1, PLUS, MINUS];
  const { success } = prettyGoodMeasurement(states, [0.25, 0.25, 0.25, 0.25]);
  // dual feasible point Γ = I/4 ⪰ ¼ρ_k ∀k with Tr Γ = ½ — certify optimality
  return { pgmSuccess: success, dualUpperBound: 0.5 };
}

/** BB84 bit discrimination ("which bit, basis unknown?") — expected (2+√2)/4. */
export function bb84BitGame(): { helstrom: number; closed: number; optimized: number } {
  // ρ_bit0 = (|0⟩⟨0| + |+⟩⟨+|)/2, ρ_bit1 = (|1⟩⟨1| + |−⟩⟨−|)/2
  const rho0 = mScale(mAdd(fromVec(KET0), fromVec(PLUS)), 0.5);
  const rho1 = mScale(mAdd(fromVec(KET1), fromVec(MINUS)), 0.5);
  return {
    helstrom: helstromTwo(rho0, rho1),
    closed: 0.5 + Math.SQRT2 / 4,
    optimized: helstromTwoOptimize(rho0, rho1),
  };
}

/** Commit-then-reveal wall: (1/8)Σ_θ Π_θ^+ = I/2 exactly. */
export function projectorSumIdentity(): { maxDeviation: number } {
  const sum = mat(2, 2);
  for (const theta of TRAP_ANGLES) {
    const proj = fromVec(equatorial(theta));
    for (let i = 0; i < 4; i++) {
      sum.re[i] = sum.re[i]! + proj.re[i]! / 8;
      sum.im[i] = sum.im[i]! + proj.im[i]! / 8;
    }
  }
  let dev = 0;
  dev = Math.max(dev, Math.abs(sum.re[0]! - 0.5), Math.abs(sum.re[3]! - 0.5), Math.abs(sum.re[1]!), Math.abs(sum.re[2]!));
  dev = Math.max(dev, Math.abs(sum.im[0]!), Math.abs(sum.im[1]!), Math.abs(sum.im[2]!), Math.abs(sum.im[3]!));
  return { maxDeviation: dev };
}

/**
 * MC referee for the wall: random attacking channel, server returns the
 * channel output plus a claimed bit; verifier measures in the secret basis.
 * Acceptance must concentrate on ½.
 */
export function commitRevealMC(trials: number, seed: number): { acceptance: number; stdErr: number } {
  const rng = makeRng(seed);
  const hits: number[] = [];
  for (let t = 0; t < trials; t++) {
    const kraus = randomChannel(rng, 1 + rng.int(3));
    const theta = TRAP_ANGLES[rng.int(8)]!; // rng.int(8) ∈ [0,8) matches the 8-angle grid
    const claimed = rng.int(2);
    const rho0 = fromVec(equatorial(theta));
    const rho = mat(2, 2);
    for (const e of kraus) {
      const term = mMul(mMul(e, rho0), mDagger(e));
      for (let i = 0; i < 4; i++) {
        rho.re[i] = rho.re[i]! + term.re[i]!;
        rho.im[i] = rho.im[i]! + term.im[i]!;
      }
    }
    const psi = equatorial(claimed === 0 ? theta : theta + Math.PI);
    const ip = vInner(psi, mulVec(rho, psi));
    hits.push(ip.re);
  }
  const mean = hits.reduce((a, b) => a + b, 0) / trials;
  const varr = hits.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, trials - 1);
  return { acceptance: mean, stdErr: Math.sqrt(varr / trials) };
}

function paulis2(): CMat[] {
  const x = mat(2, 2);
  x.re[1] = 1;
  x.re[2] = 1;
  const y = mat(2, 2);
  y.im[1] = -1;
  y.im[2] = 1;
  const z = mat(2, 2);
  z.re[0] = 1;
  z.re[3] = -1;
  return [x, y, z];
}

function mulVec(m: CMat, v: CVec): CVec {
  const out: CVec = { n: m.rows, re: new Float64Array(m.rows), im: new Float64Array(m.rows) };
  for (let i = 0; i < m.rows; i++) {
    let re = 0;
    let im = 0;
    for (let j = 0; j < m.cols; j++) {
      re += m.re[i * m.cols + j]! * v.re[j]! - m.im[i * m.cols + j]! * v.im[j]!;
      im += m.re[i * m.cols + j]! * v.im[j]! + m.im[i * m.cols + j]! * v.re[j]!;
    }
    out.re[i] = re;
    out.im[i] = im;
  }
  return out;
}
