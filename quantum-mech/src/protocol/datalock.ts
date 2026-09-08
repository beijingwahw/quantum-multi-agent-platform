/**
 * Quantum data locking at bounded exact scale (the DLW04/HLSW04 line).
 *
 * Construction (HLSW04-style random bases): a message v ∈ {0..d−1}
 * (d = 2^n qubits, n ≤ 6) is locked by choosing a key k ∈ {0..K−1} indexing
 * one of K seeded-random orthonormal bases of C^d and sending the v-th basis
 * vector |ψ_v^{(k)}⟩. Without the key, the adversary holds
 *   ρ_v = (1/K) Σ_k |ψ_v^{(k)}⟩⟨ψ_v^{(k)}|,
 * whose Holevo χ over v is machine-measured here; because each key indexes a
 * COMPLETE basis, the key-averaged ensemble state is ρ̄ = I/d EXACTLY, so the
 * pretty-good measurement reduces to the POVM {ρ_y}. With the key, a
 * projective measurement in basis k identifies v deterministically —
 * post-unlock accessible information = n bits against log2(K) key bits.
 *
 * Honest scope: n ≤ 6, everything exact (no sampling for the information
 * measures; Monte Carlo appears nowhere in this module). The asymptotic
 * locking theorem (key ≪ data as n → ∞) is CITED, not re-proved: what this
 * module verifies is the advantage DIRECTION on the census — at fixed
 * key/data ratio K/d, the accessible fraction χ/n shrinks as n grows, and
 * χ falls as K rises. The Wishart first-order heuristic (d−1)/(2K ln 2) is
 * printed next to the measured χ as a cross-check, never as a claim.
 *
 * Anchors: DiVincenzo-Horodecki-Leung-Smolin-Terhal-Wootters, IEEE-IT 48:569
 * (2004); Hayden-Leung-Shor-Winter, Commun. Math. Phys. 250:371 (2004);
 * Guha et al., PRX 4:011016 (2014) — see docs/citations.md.
 */

import { type CMat, type CVec, identity, mat, vInner, vScale } from '../core/cmat.js';
import { eigenvaluesHermitian } from '../core/cmat.js';
import { randomPureState } from '../core/states.js';
import type { Rng } from '../core/rng.js';
import { makeRng } from '../core/rng.js';

// ---------------------------------------------------------------------------
// Construction: seeded random orthonormal bases (twice-iterated modified
// Gram-Schmidt on complex Gaussians) with an orthonormality referee.
// ---------------------------------------------------------------------------

/** Max |⟨ψ_i|ψ_j⟩ − δ_ij| over ALL pairs — the orthonormality referee. */
export function basisReferee(basis: readonly CVec[]): number {
  const d = basis.length;
  let worst = 0;
  for (let i = 0; i < d; i++) {
    for (let j = 0; j < d; j++) {
      const ip = vInner(basis[i]!, basis[j]!);
      const want = i === j ? 1 : 0;
      worst = Math.max(worst, Math.hypot(ip.re - want, ip.im));
    }
  }
  return worst;
}

/** One random orthonormal basis of C^d from a seeded RNG. */
export function randomOrthonormalBasis(d: number, rng: Rng): CVec[] {
  if (!Number.isInteger(d) || d < 1) throw new Error(`randomOrthonormalBasis: need integer d >= 1, got ${d}`);
  const out: CVec[] = [];
  for (let i = 0; i < d; i++) {
    let v = randomPureState(d, rng);
    // two Gram-Schmidt passes: numerical orthogonality to referee tolerance
    for (let pass = 0; pass < 2; pass++) {
      for (const u of out) {
        const ip = vInner(u, v);
        // v <- v - <u,v> u  (complex inner product, conj on the first factor)
        const w = { n: d, re: new Float64Array(d), im: new Float64Array(d) };
        for (let t = 0; t < d; t++) {
          w.re[t] = v.re[t]! - (ip.re * u.re[t]! - ip.im * u.im[t]!);
          w.im[t] = v.im[t]! - (ip.re * u.im[t]! + ip.im * u.re[t]!);
        }
        v = w;
      }
      const nrm = Math.sqrt(vInner(v, v).re);
      if (nrm < 1e-9) throw new Error('randomOrthonormalBasis: degenerate draw');
      v = vScale(v, 1 / nrm);
    }
    out.push(v);
  }
  return out;
}

export interface BasisFamily {
  d: number;
  K: number;
  basis: CVec[][];
  /** worst orthonormality error over all K bases (referee, want ≤ 1e-12) */
  referee: number;
}

export function makeBasisFamily(d: number, K: number, seed: number): BasisFamily {
  if (!Number.isInteger(K) || K < 1) throw new Error(`makeBasisFamily: need integer K >= 1, got ${K}`);
  const rng = makeRng(seed);
  const basis: CVec[][] = [];
  let referee = 0;
  for (let k = 0; k < K; k++) {
    const b = randomOrthonormalBasis(d, rng);
    referee = Math.max(referee, basisReferee(b));
    basis.push(b);
  }
  return { d, K, basis, referee };
}

// ---------------------------------------------------------------------------
// Locked states and the accessible-information brackets.
// ---------------------------------------------------------------------------

/** ρ_v = (1/K) Σ_k |ψ_v^{(k)}⟩⟨ψ_v^{(k)}| for every v — the keyless view. */
export function lockedRhos(family: BasisFamily): CMat[] {
  const { d, K } = family;
  const out: CMat[] = [];
  for (let v = 0; v < d; v++) {
    const acc = mat(d, d);
    for (let k = 0; k < K; k++) {
      const psi = family.basis[k]![v]!;
      for (let i = 0; i < d; i++) {
        for (let j = 0; j < d; j++) {
          const pr = psi.re[i]! * psi.re[j]! + psi.im[i]! * psi.im[j]!;
          const pi = psi.im[i]! * psi.re[j]! - psi.re[i]! * psi.im[j]!;
          acc.re[i * d + j] = acc.re[i * d + j]! + pr / K;
          acc.im[i * d + j] = acc.im[i * d + j]! + pi / K;
        }
      }
    }
    out.push(acc);
  }
  return out;
}

/** Max entrywise |ρ̄ − I/d|: because each key is a complete basis, ρ̄ = I/d
 * exactly — this referee must report ~1e-16 or the construction is broken. */
export function averageRhoDefect(rhos: readonly CMat[]): number {
  const d = rhos[0]!.rows;
  const rhoBar = mat(d, d);
  for (const r of rhos) {
    for (let k = 0; k < d * d; k++) rhoBar.re[k] = rhoBar.re[k]! + r.re[k]! / d;
  }
  const I = identity(d);
  let worst = 0;
  for (let k = 0; k < d * d; k++) worst = Math.max(worst, Math.abs(rhoBar.re[k]! - I.re[k]! / d), Math.abs(rhoBar.im[k]!));
  return worst;
}

export interface AccessibleBounds {
  /** Holevo χ of the uniform ensemble — the tight upper bound we compute */
  upper: number;
  /** pretty-good-measurement mutual information (POVM elements are ρ_y
   * exactly, since ρ̄ = I/d) — a machine lower bound on I_acc */
  pgm: number;
  /** computational-basis measurement mutual information — another lower bound */
  compBasis: number;
  /** max of the lower bounds: the certified bracket is [lower, upper] */
  lower: number;
  /** mean entropy of the ρ_v (χ = S(ρ̄) − mean S; S(ρ̄) = log2 d here) */
  meanEntropy: number;
  /** worst_v ½Σ|λ_i(ρ_v) − 1/d|: distance of the locked states from I/d,
   * derived from the same spectra — the single-shot hiding defect */
  worstMixedDefect: number;
}

function entropyBits(eig: Iterable<number>): number {
  let s = 0;
  for (const l of eig) if (l > 1e-15) s -= l * Math.log2(l);
  return s;
}

function miFromConditional(cond: ReadonlyArray<readonly number[]>, d: number): number {
  // uniform prior 1/d over v (rows), outcomes y (cols)
  let mi = 0;
  for (let v = 0; v < d; v++) {
    for (let y = 0; y < d; y++) {
      const p = cond[v]![y]!;
      if (p <= 1e-15) continue;
      let marg = 0;
      for (let w = 0; w < d; w++) marg += cond[w]![y]! / d;
      if (marg <= 1e-15) continue;
      mi += (p / d) * Math.log2(p / marg);
    }
  }
  return mi;
}

function traceProd(a: CMat, b: CMat): number {
  // Tr[AB] for Hermitian a, b — real; since b_ji = conj(b_ij):
  // Tr[AB] = Σ_ij a_ij b_ji = Σ_ij a_ij conj(b_ij)
  const d = a.rows;
  let s = 0;
  for (let i = 0; i < d; i++) {
    for (let j = 0; j < d; j++) {
      s += a.re[i * d + j]! * b.re[i * d + j]! + a.im[i * d + j]! * b.im[i * d + j]!;
    }
  }
  return s;
}

/** The accessible-information bracket [lower, upper] of the locked ensemble,
 * plus derived hiding defects. χ is computed from one eigendecomposition per
 * ρ_v (spectra reused for the mixed-defect metric). */
export function accessibleBounds(rhos: readonly CMat[]): AccessibleBounds {
  const d = rhos[0]!.rows;
  const spectra = rhos.map((r) => eigenvaluesHermitian(r));
  const meanEntropy = spectra.reduce((s, e) => s + entropyBits(e), 0) / d;
  const sAvg = Math.log2(d); // S(ρ̄) with ρ̄ = I/d (referee-checked separately)
  let chi = sAvg - meanEntropy;
  if (chi < 0) chi = Math.max(chi, 0); // numerical guard: χ ≥ 0 exactly
  let worstMixedDefect = 0;
  for (const e of spectra) {
    let s = 0;
    for (const l of e) s += Math.abs(l - 1 / d);
    worstMixedDefect = Math.max(worstMixedDefect, s / 2);
  }
  const pgmCond = rhos.map((rv) => rhos.map((ry) => Math.max(0, traceProd(ry, rv))));
  const compCond = rhos.map((rv) => Array.from({ length: d }, (_, y) => Math.max(0, rv.re[y * d + y]!)));
  const pgm = miFromConditional(pgmCond, d);
  const compBasis = miFromConditional(compCond, d);
  return {
    upper: chi,
    pgm,
    compBasis,
    lower: Math.max(pgm, compBasis),
    meanEntropy,
    worstMixedDefect,
  };
}

// ---------------------------------------------------------------------------
// Unlock exactness: with key k, the projective measurement in basis k
// identifies v with probability 1 — machine-checked as the worst off-diagonal
// overlap inside every basis (this IS the content of "post-unlock I_acc = n").
// ---------------------------------------------------------------------------

export function unlockExactness(family: BasisFamily): number {
  let worst = 0;
  for (const b of family.basis) worst = Math.max(worst, basisReferee(b));
  return worst;
}

// ---------------------------------------------------------------------------
// Census rows + certificate protocol.
// ---------------------------------------------------------------------------

export interface LockingRow {
  n: number;
  d: number;
  K: number;
  keyBits: number;
  dataBits: number;
  chiUpper: number;
  lower: number;
  pgm: number;
  compBasis: number;
  worstMixedDefect: number;
  unlockWorstOverlap: number;
  /** Wishart first-order heuristic (d−1)/(2K ln 2) — cross-check, not a claim */
  wishartHeuristic: number;
  familyReferee: number;
}

export function lockingRow(n: number, K: number, seed: number): LockingRow {
  if (!Number.isInteger(n) || n < 1 || n > 6) throw new Error(`lockingRow: n must be 1..6 (bounded exact scale), got ${n}`);
  const d = 2 ** n;
  const family = makeBasisFamily(d, K, seed);
  const rhos = lockedRhos(family);
  const bounds = accessibleBounds(rhos);
  const defect = averageRhoDefect(rhos);
  if (defect > 1e-12) {
    throw new Error(`lockingRow: average-rho referee failed (|ρ̄ − I/d| = ${defect.toExponential(2)})`);
  }
  return {
    n,
    d,
    K,
    keyBits: Math.log2(K),
    dataBits: n,
    chiUpper: bounds.upper,
    lower: bounds.lower,
    pgm: bounds.pgm,
    compBasis: bounds.compBasis,
    worstMixedDefect: bounds.worstMixedDefect,
    unlockWorstOverlap: unlockExactness(family),
    wishartHeuristic: (d - 1) / (2 * K * Math.LN2),
    familyReferee: family.referee,
  };
}

/**
 * A locking claim: every number in the certificate is re-derived from
 * (n, keyBases, seed) by verifyLockingCertificate — a certificate whose
 * numbers were never measured does not survive the referee.
 */
export interface LockingCertificate {
  n: number;
  keyBases: number;
  seed: number;
  /** claimed Holevo χ of the locked ensemble, bits */
  chiPreUpper: number;
  /** claimed worst_v T(ρ_v, I/d) */
  worstMixedDefect: number;
  /** claimed worst off-diagonal overlap within key bases */
  unlockWorstOverlap: number;
  /** claimed post-unlock accessible information in bits (want n) */
  postBits: number;
  /** claimed key size log2(K) in bits — the price paid for the unlock */
  keyBits: number;
}

export function certificateFromRow(row: LockingRow, seed: number): LockingCertificate {
  return {
    n: row.n,
    keyBases: row.K,
    seed,
    chiPreUpper: row.chiUpper,
    worstMixedDefect: row.worstMixedDefect,
    unlockWorstOverlap: row.unlockWorstOverlap,
    postBits: row.dataBits,
    keyBits: row.keyBits,
  };
}

export interface Verification {
  ok: boolean;
  /** machine name of the rejection, present iff ok === false */
  code?: string;
  detail?: string;
}

/** Re-derive everything the certificate claims; reject with a named code. */
export function verifyLockingCertificate(cert: LockingCertificate): Verification {
  if (!Number.isInteger(cert.n) || cert.n < 1 || cert.n > 6) {
    return { ok: false, code: 'REF00-bounds', detail: `n=${cert.n} outside the bounded exact scale 1..6` };
  }
  if (!Number.isInteger(cert.keyBases) || cert.keyBases < 2) {
    return { ok: false, code: 'REF00-bounds', detail: `keyBases=${cert.keyBases} < 2` };
  }
  const row = lockingRow(cert.n, cert.keyBases, cert.seed);
  if (row.familyReferee > 1e-12) {
    return { ok: false, code: 'REF00-basis', detail: `basis orthonormality referee ${row.familyReferee.toExponential(2)}` };
  }
  if (Math.abs(cert.chiPreUpper - row.chiUpper) > 1e-9) {
    return {
      ok: false,
      code: 'REF01-fabricated-chi',
      detail: `claimed pre-unlock χ = ${cert.chiPreUpper}, re-derived ${row.chiUpper.toFixed(6)} bits`,
    };
  }
  if (Math.abs(cert.worstMixedDefect - row.worstMixedDefect) > 1e-9) {
    return {
      ok: false,
      code: 'REF02-fabricated-defect',
      detail: `claimed T(ρ_v, I/d) = ${cert.worstMixedDefect}, re-derived ${row.worstMixedDefect.toFixed(6)}`,
    };
  }
  if (Math.abs(cert.unlockWorstOverlap - row.unlockWorstOverlap) > 1e-9) {
    return {
      ok: false,
      code: 'REF03-fabricated-unlock',
      detail: `claimed unlock overlap ${cert.unlockWorstOverlap}, re-derived ${row.unlockWorstOverlap.toExponential(2)}`,
    };
  }
  if (cert.postBits !== cert.n) {
    return {
      ok: false,
      code: 'REF04-post-unlock-mismatch',
      detail: `post-unlock accessible information is ${cert.n} bits, not ${cert.postBits}`,
    };
  }
  // a "full unlock" claim without the key budget that pays for it
  if (Math.abs(cert.keyBits - Math.log2(cert.keyBases)) > 1e-9) {
    return {
      ok: false,
      code: 'REF05-key-size-mismatch',
      detail: `key size is log2(${cert.keyBases}) = ${Math.log2(cert.keyBases).toFixed(3)} bits, certificate claims ${cert.keyBits}`,
    };
  }
  if (cert.chiPreUpper < 0 || cert.chiPreUpper > cert.n) {
    return { ok: false, code: 'REF06-chi-range', detail: `χ=${cert.chiPreUpper} outside [0, n]` };
  }
  return { ok: true };
}
