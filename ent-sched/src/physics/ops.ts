/**
 * Analytic operations on Bell vectors. Every formula here is cross-checked to
 * machine precision against the independent density-matrix referee
 * (src/physics/referee.ts) in test/physics.test.ts — no formula is trusted
 * because it appears in a paper or in this derivation; the referee is the
 * arbiter.
 *
 * Derivations: see docs/theory.md.
 */

import { type BellVec, werner, wernerWeight } from "./bell.js";
import { SchedError } from "../core/errors.js";

/**
 * Bilateral twirl: average over the 12 bilateral π/2 rotations. Fixes Φ+,
 * averages the error components — maps any Bell vector to werner(λ₀).
 * (Analytic counterpart of refereeTwirl's circuit average.)
 */
export function twirl(l: BellVec): BellVec {
  return werner(l[0]!); // BellVec is length 4 by construction
}

/**
 * Single-qubit depolarization ("replace" convention): with probability p the
 * qubit is discarded and replaced by I/2. For a Bell-diagonal pair,
 * λ → (1−p)λ + p·uniform.
 *
 * Memory decoherence uses p(t) = 1 − exp(−t/T₂) per stored qubit.
 */
export function depol(l: BellVec, p: number): BellVec {
  const out = new Float64Array(4);
  for (let i = 0; i < 4; i++) out[i] = (1 - p) * l[i]! + p / 4;
  return out;
}

/** Depolarization parameter for a qubit stored `t` rounds with time constant T₂. */
export function depolP(t: number, t2: number): number {
  if (!Number.isFinite(t2)) return 0;
  return 1 - Math.exp(-t / t2);
}

/** Apply per-qubit depolarization to both halves of a pair. */
export function agePair(l: BellVec, tA: number, tB: number, t2: number): BellVec {
  return depol(depol(l, depolP(tA, t2)), depolP(tB, t2));
}

/**
 * Entanglement swapping (Bell-state measurement on the middle two qubits,
 * perfect Pauli-frame correction): Bell labels XOR-convolve,
 *   λ'_k = Σ_{i⊕j=k} λ_i μ_j.
 * Hardware success probability q_swap is handled by the engine, not here.
 */
export function swapBell(a: BellVec, b: BellVec): BellVec {
  const out = new Float64Array(4);
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      const t = i ^ j; // t < 4 since i, j < 4
      out[t] = out[t]! + a[i]! * b[j]!;
    }
  return out;
}

/** Closed form for Werner inputs: F' = F₁F₂ + (1−F₁)(1−F₂)/3 (Werner class preserved). */
export function wernerSwapF(f1: number, f2: number): number {
  return f1 * f2 + ((1 - f1) * (1 - f2)) / 3;
}

/**
 * BBPSSW recurrence step on two pairs: bilateral twirl → bilateral CNOT →
 * Z-parity postselection → twirl. The twirl (uniform bilateral π/2 rotation)
 * fixes |Φ+⟩ (since (R⊗R)|Φ+⟩ = |Φ+⟩ for every unitary R) and averages the
 * three error components, so it preserves λ₀ while re-symmetrizing — without
 * it the recurrence does NOT converge (errors pile up in the Z sector; we hit
 * this live: 0.85 → 0.884 → 0.850 regression before the fix).
 *
 * On twirled (Werner) inputs with fidelities f₁, f₂, wᵢ = (1−fᵢ)/3:
 *   P = (f₁+w₁)(f₂+w₂) + 4w₁w₂
 *   F' = (f₁f₂ + w₁w₂)/P
 * Output is returned twirled: werner(F').
 */
export function purify2to1(l: BellVec, m: BellVec): { p: number; out: BellVec } {
  const f1 = l[0]!; // BellVec is length 4 by construction
  const f2 = m[0]!;
  const w1 = wernerWeight(f1);
  const w2 = wernerWeight(f2);
  const p = (f1 + w1) * (f2 + w2) + 4 * w1 * w2;
  if (p <= 0) throw new SchedError("PURIFY_ZERO_PROBABILITY", `p=${p} (inputs f₁=${f1}, f₂=${f2} are not Bell vectors of a physical state)`);
  return { p, out: werner((f1 * f2 + w1 * w2) / p) };
}

/** Werner-input specialization (used by scheduler projections). */
export function purifyWerner(f: number): { p: number; fOut: number } {
  const w = wernerWeight(f);
  const p = (f + w) ** 2 + 4 * w * w;
  return { p, fOut: (f * f + w * w) / p };
}

/**
 * Purification ladder projection: expected fidelity/cost after k rounds of
 * 2→1 recurrence starting from Werner fidelity f. Returns per-round data so
 * callers can plan the cheapest ladder reaching a target fidelity.
 */
export function purifyLadder(f: number, maxRounds: number): Array<{ f: number; p: number }> {
  const steps: Array<{ f: number; p: number }> = [];
  let cur = f;
  for (let k = 0; k < maxRounds; k++) {
    const { p, fOut } = purifyWerner(cur);
    steps.push({ f: fOut, p });
    cur = fOut;
  }
  return steps;
}

/** Binary entropy of a 4-outcome distribution, in bits (0·log 0 = 0). */
export function entropy2(l: BellVec): number {
  let h = 0;
  for (let i = 0; i < 4; i++) {
    const li = l[i]!; // BellVec is length 4 by construction
    if (li > 0) h -= li * Math.log2(li);
  }
  return h;
}

/**
 * Secret-key fraction distillable (one-way) from a Bell-diagonal state:
 * r = 1 − H(λ). Werner threshold: r > 0 ⟺ F > F* ≈ 0.8108 (solved numerically
 * in exp1; consistent with the QKD literature bound).
 */
export function keyFraction(l: BellVec): number {
  return 1 - entropy2(l);
}

/** Concurrence of a Bell-diagonal state: C = max(0, λ_max − Σ_{i≠max} λ_i) = 2 max(0, F − 1/2). */
export function concurrence(l: BellVec): number {
  let mx = 0;
  for (let i = 0; i < 4; i++) mx = Math.max(mx, l[i]!);
  return Math.max(0, 2 * (mx - 0.5));
}

/** Fidelity of a Werner state after k swap hops of fresh fidelity f0 each. */
export function wernerSwapChainF(f0: number, hops: number): number {
  let f = f0;
  for (let k = 1; k < hops; k++) f = wernerSwapF(f, f0);
  return f;
}

/** Convenience: Bell vector of a chain of n equal fresh Werner links. */
export function wernerSwapChainVec(f0: number, hops: number): BellVec {
  let v = werner(f0);
  for (let k = 1; k < hops; k++) v = swapBell(v, werner(f0));
  return v;
}
