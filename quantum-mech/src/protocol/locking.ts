/**
 * Wiesner conjugate-coding locks for sealed bids (Wiesner 1983 lineage).
 *
 * A bid value v in [0, 2^m) is encoded on m qubits in the computational
 * basis and locked by mapping each qubit into a secret per-qubit basis:
 *   Z basis: |0>, |1>;   X basis: |+>, |->;   Y basis: |R>, |L>.
 * Without the key the auctioneer's ensemble is (2-basis: partially, 3-basis:
 * exactly) independent of v — quantified by Holevo χ in privacy.ts. With the
 * key, readout is exact. Locks are PRODUCT states by construction, so we
 * track per-qubit 2-component amplitudes.
 */

import { type CMat, type CVec, mat, vKron, vNormalize } from '../core/cmat.js';
import { HADAMARD } from '../core/states.js';
import { fromVec } from '../core/states.js';
import type { Rng } from '../core/rng.js';

export type Basis = 0 | 1 | 2; // 0 = Z, 1 = X, 2 = Y

/**
 * Checked narrowing from an untrusted integer (the RNG's draw) to `Basis`.
 * Replaces blind `as Basis` casts: an out-of-family draw is rejected by name
 * instead of silently becoming a wrong basis.
 */
export function toBasis(n: number): Basis {
  if (n === 0 || n === 1 || n === 2) return n;
  throw new Error(`LOCK03-bad-basis: rng draw ${n} is outside the basis family {0,1,2}`);
}

/** Preparer unitary mapping computational basis to the given basis states. */
export function basisUnitary(b: Basis): CMat {
  if (b === 0) {
    const m = mat(2, 2);
    m.re[0] = 1;
    m.re[3] = 1;
    return m;
  }
  if (b === 1) return HADAMARD;
  // Y basis: |R> = (|0> + i|1>)/√2, |L> = (|0> - i|1>)/√2.
  const m = mat(2, 2);
  const s = 1 / Math.SQRT2;
  m.re[0] = s;
  m.re[1] = s;
  m.im[2] = s;
  m.im[3] = -s;
  return m;
}

/** Per-qubit pure state alpha|0> + beta|1>. */
export interface Qubit {
  a: { re: number; im: number };
  b: { re: number; im: number };
}

export type LockMode = 'wiesner' | 'otp';

export interface Lock {
  qubits: Qubit[]; // m qubit states as held by the auctioneer (mutated in place by the interceptor)
  readonly bases: Basis[]; // secret key: per-qubit basis
  /** otp mode: per-qubit classical pad bit (payload is XOR-masked) */
  readonly pads: number[];
  readonly m: number;
  readonly mode: LockMode;
}

const qubit0: Qubit = { a: { re: 1, im: 0 }, b: { re: 0, im: 0 } };
const qubit1: Qubit = { a: { re: 0, im: 0 }, b: { re: 1, im: 0 } };

/** Apply a 2x2 unitary to a single-qubit state. */
export function applyGate(q: Qubit, u: CMat): Qubit {
  // u is a 2x2 matrix built by basisUnitary/mat: indices 0..3 always defined
  return {
    a: {
      re: u.re[0]! * q.a.re - u.im[0]! * q.a.im + u.re[1]! * q.b.re - u.im[1]! * q.b.im,
      im: u.re[0]! * q.a.im + u.im[0]! * q.a.re + u.re[1]! * q.b.im + u.im[1]! * q.b.re,
    },
    b: {
      re: u.re[2]! * q.a.re - u.im[2]! * q.a.im + u.re[3]! * q.b.re - u.im[3]! * q.b.im,
      im: u.re[2]! * q.a.im + u.im[2]! * q.a.re + u.re[3]! * q.b.im + u.im[3]! * q.b.re,
    },
  };
}

/** Conjugate transpose (dagger) of a 2x2 matrix — the single source for this
 * operation (previously triplicated here, in contract/wiesner.ts and as
 * transposeConj2 in protocol/robustness.ts, byte-identical). */
export function dagger2(u: CMat): CMat {
  const m = mat(2, 2);
  m.re[0] = u.re[0]!;
  m.im[0] = -u.im[0]!;
  m.re[1] = u.re[2]!;
  m.im[1] = -u.im[2]!;
  m.re[2] = u.re[1]!;
  m.im[2] = -u.im[1]!;
  m.re[3] = u.re[3]!;
  m.im[3] = -u.im[3]!;
  return m;
}

/** Lock value v: encode in computational basis, conjugate each qubit into a
 * secret random basis ('wiesner': key = basis only, residual information
 * chi > 0 per qubit; 'otp': key = basis + pad bit, chi = 0 exactly — the
 * quantum one-time pad). Returns what the auctioneer holds plus the key. */
export function lockValue(v: number, m: number, rng: Rng, nBases: 2 | 3, mode: LockMode = 'wiesner'): Lock {
  if (!Number.isInteger(m) || m < 1) {
    throw new Error(`LOCK02-bad-m: lockValue needs integer m >= 1 qubit, got ${m}`);
  }
  if (v < 0 || v >= 2 ** m) {
    throw new Error(`LOCK01-bad-value: lockValue payload v=${v} out of range [0, 2^m) with m=${m}`);
  }
  const bases: Basis[] = [];
  const pads: number[] = [];
  const qubits: Qubit[] = [];
  for (let q = 0; q < m; q++) {
    let bit = (v >> q) & 1; // little-endian payload bit
    const basis = toBasis(rng.int(nBases));
    bases.push(basis);
    let pad = 0;
    if (mode === 'otp') {
      pad = rng.int(2);
      bit ^= pad;
    }
    pads.push(pad);
    qubits.push(applyGate(bit === 0 ? qubit0 : qubit1, basisUnitary(basis)));
  }
  return { qubits, bases, pads, m, mode };
}

/** Unlock with the true key: deterministic readout of the payload for
 * honest states (otp mode XORs the pads back out). Returns the payload
 * value (argmax readout). */
export function unlockValue(lock: Lock): number {
  let v = 0;
  for (let q = 0; q < lock.m; q++) {
    // Lock invariant: qubits/bases/pads all have length m
    const back = applyGate(lock.qubits[q]!, dagger2(basisUnitary(lock.bases[q]!)));
    const p0 = back.a.re ** 2 + back.a.im ** 2;
    const p1 = back.b.re ** 2 + back.b.im ** 2;
    let bit = p1 > p0 ? 1 : 0;
    if (lock.mode === 'otp') bit ^= lock.pads[q]!;
    if (bit) v |= 1 << q;
  }
  return v;
}

/** Intercept-measure-resend on one lock: for each qubit the interceptor
 * guesses a basis, measures, and re-sends the observed eigenstate. Returns
 * the mutated lock (same key object semantics: only qubits change). */
export function interceptMeasureResend(lock: Lock, rng: Rng, nBases: 2 | 3): void {
  for (let q = 0; q < lock.m; q++) {
    const guess = toBasis(rng.int(nBases));
    const u = basisUnitary(guess);
    const rotated = applyGate(lock.qubits[q]!, dagger2(u));
    const p0 = rotated.a.re ** 2 + rotated.a.im ** 2;
    const p1 = rotated.b.re ** 2 + rotated.b.im ** 2;
    const outcome = rng() * (p0 + p1) < p0 ? 0 : 1;
    const resent = applyGate(outcome === 0 ? qubit0 : qubit1, u);
    lock.qubits[q] = resent;
  }
}

/** Rebuild the full 2^m state vector of a lock (for density-matrix referees). */
export function lockStateVector(lock: Lock): CVec {
  const perQubit = lock.qubits.map((q) =>
    vNormalize({
      n: 2,
      re: Float64Array.from([q.a.re, q.b.re]),
      im: Float64Array.from([q.a.im, q.b.im]),
    }),
  );
  return perQubit.reduce((acc, v) => vKron(acc, v));
}

/**
 * The ensemble the AUCTIONEER holds for payload v, averaged over all keys:
 *   rho_v = (1/K) Σ_key |lock(v, key)><...|. Small m only (K = nBases^m).
 */
export function lockedEnsemble(v: number, m: number, nBases: 2 | 3, mode: LockMode = 'wiesner'): CMat {
  const keyOptions = mode === 'otp' ? 2 * nBases : nBases;
  const total = keyOptions ** m;
  const acc = mat(2 ** m, 2 ** m);
  const bases: Basis[] = new Array<Basis>(m).fill(0);
  const pads: number[] = new Array<number>(m).fill(0);
  const walk = (q: number): void => {
    if (q === m) {
      const lock: Lock = { qubits: [], bases: [...bases], pads: [...pads], m, mode };
      for (let i = 0; i < m; i++) {
        let bit = (v >> i) & 1;
        if (mode === 'otp') bit ^= pads[i]!;
        lock.qubits.push(applyGate(bit === 0 ? qubit0 : qubit1, basisUnitary(bases[i]!)));
      }
      const rho = fromVec(lockStateVector(lock));
      for (let k = 0; k < acc.re.length; k++) {
        acc.re[k] = acc.re[k]! + rho.re[k]! / total;
        acc.im[k] = acc.im[k]! + rho.im[k]! / total;
      }
      return;
    }
    for (let b = 0; b < nBases; b++) {
      bases[q] = toBasis(b);
      if (mode === 'otp') {
        pads[q] = 0;
        walk(q + 1);
        pads[q] = 1;
        walk(q + 1);
      } else {
        walk(q + 1);
      }
    }
  };
  walk(0);
  return acc;
}
