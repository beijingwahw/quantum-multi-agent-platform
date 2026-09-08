/**
 * Exact density-matrix evolution for bounded-noise QAOA — the engine behind
 * pricing the "noiseless logical layer" boundary (README v0.1 boundary #2).
 *
 * A pure statevector cannot carry a noise channel exactly (channels produce
 * mixed states), so the bounded-noise face runs the same QAOA layers on the
 * full 2^n x 2^n density matrix. Only the primitives deep QAOA needs are
 * provided: diagonal cost phases, the transverse-field mixer, and the two
 * noise primitives (per-qubit Pauli depolarizing, symmetric readout flips).
 * Everything is computed entry-wise on interleaved-real Float64Arrays — no
 * sampling, no trajectory approximation: the channels are applied exactly.
 */

import { FtQaoaError, requireThat, requireQubitCount } from "./errors.js";

export class DensityMatrix {
  readonly dim: number;
  readonly re: Float64Array;
  readonly im: Float64Array;

  private constructor(readonly n: number, re: Float64Array, im: Float64Array) {
    this.dim = 1 << n;
    this.re = re;
    this.im = im;
  }

  /** |+><+|^n: every entry equals 2^-n (real). */
  static plusState(n: number): DensityMatrix {
    requireQubitCount(n);
    const dim = 1 << n;
    const val = 1 / dim;
    return new DensityMatrix(n, new Float64Array(dim * dim).fill(val), new Float64Array(dim * dim));
  }

  /** rho = |psi><psi| from a pure amplitude pair (length 2^n each). */
  static fromPureState(n: number, psiRe: Float64Array, psiIm: Float64Array): DensityMatrix {
    requireQubitCount(n);
    const dim = 1 << n;
    if (psiRe.length !== dim || psiIm.length !== dim) {
      throw new FtQaoaError(
        "PURE_STATE_LENGTH_MISMATCH",
        `pure-state length mismatch: ${psiRe.length}/${psiIm.length} vs 2^${n}`,
      );
    }
    const re = new Float64Array(dim * dim);
    const im = new Float64Array(dim * dim);
    for (let s = 0; s < dim; s++) {
      for (let t = 0; t < dim; t++) {
        re[s * dim + t] = psiRe[s]! * psiRe[t]! + psiIm[s]! * psiIm[t]!;
        im[s * dim + t] = psiIm[s]! * psiRe[t]! - psiRe[s]! * psiIm[t]!;
      }
    }
    return new DensityMatrix(n, re, im);
  }

  clone(): DensityMatrix {
    return new DensityMatrix(this.n, this.re.slice(), this.im.slice());
  }

  /**
   * Apply exp(-i*gamma*C) on both sides: rho_st *= exp(-i*gamma*(E_s - E_t)).
   * The diagonal is untouched in exact arithmetic (phase 0), so it is skipped.
   * The phase is factored as (-gamma*E_s) + (+gamma*E_t) so only 2*dim trig
   * calls are needed per layer; the per-entry work is a complex multiply.
   */
  applyCostPhase(gamma: number, energyOf: Float64Array): void {
    const { re, im, dim } = this;
    requireThat(
      energyOf.length === dim,
      "ENERGY_LENGTH_MISMATCH",
      `energy table length must equal 2^n = ${dim}, got ${energyOf.length}`,
    );
    const cosS = new Float64Array(dim);
    const sinS = new Float64Array(dim);
    const cosT = new Float64Array(dim);
    const sinT = new Float64Array(dim);
    for (let s = 0; s < dim; s++) {
      const ps = -gamma * energyOf[s]!;
      cosS[s] = Math.cos(ps);
      sinS[s] = Math.sin(ps);
      const pt = -ps;
      cosT[s] = Math.cos(pt);
      sinT[s] = Math.sin(pt);
    }
    for (let s = 0; s < dim; s++) {
      const row = s * dim;
      const cs = cosS[s]!;
      const ss = sinS[s]!;
      for (let t = 0; t < dim; t++) {
        if (t === s) continue;
        const c = cs * cosT[t]! - ss * sinT[t]!;
        const si = cs * sinT[t]! + ss * cosT[t]!;
        const idx = row + t;
        const r = re[idx]!;
        const i = im[idx]!;
        re[idx] = r * c - i * si;
        im[idx] = r * si + i * c;
      }
    }
  }

  /**
   * Apply the mixer unitary U = exp(-i*beta*B) with B = sum_j X_j as
   * rho -> U rho U†. Per-qubit factors commute, so this is n single-qubit
   * rotations applied on the left, then the same n on the right:
   * (prod_j M_j) rho (prod_j M_j)†. M_j = cos(beta) I - i sin(beta) X_j.
   */
  applyMixer(beta: number): void {
    const { n } = this;
    const c = Math.cos(beta);
    const si = Math.sin(beta);
    if (c === 1 && si === 0) return;
    // Left: rho -> M rho mixes row pairs (s0 = s with bit j cleared, s1 = s|bit).
    for (let j = 0; j < n; j++) {
      this.mixQubitLeft(j, c, si);
    }
    // Right: rho -> rho M† mixes column pairs (M† = c I + i si X).
    for (let j = 0; j < n; j++) {
      this.mixQubitRight(j, c, si);
    }
  }

  private mixQubitLeft(j: number, c: number, si: number): void {
    const { re, im, dim } = this;
    const bit = 1 << j;
    for (let s0 = 0; s0 < dim; s0++) {
      if (s0 & bit) continue;
      const s1 = s0 | bit;
      const r0 = s0 * dim;
      const r1 = s1 * dim;
      for (let t = 0; t < dim; t++) {
        const a = r0 + t;
        const b = r1 + t;
        const re0 = re[a]!;
        const im0 = im[a]!;
        const re1 = re[b]!;
        const im1 = im[b]!;
        // (M rho)[s0,t] = c*rho[s0,t] - i*si*rho[s1,t]
        re[a] = c * re0 + si * im1;
        im[a] = c * im0 - si * re1;
        // (M rho)[s1,t] = -i*si*rho[s0,t] + c*rho[s1,t]
        re[b] = c * re1 + si * im0;
        im[b] = c * im1 - si * re0;
      }
    }
  }

  private mixQubitRight(j: number, c: number, si: number): void {
    const { re, im, dim } = this;
    const bit = 1 << j;
    for (let s = 0; s < dim; s++) {
      const row = s * dim;
      for (let t0 = 0; t0 < dim; t0++) {
        if (t0 & bit) continue;
        const t1 = t0 | bit;
        const a = row + t0;
        const b = row + t1;
        const re0 = re[a]!;
        const im0 = im[a]!;
        const re1 = re[b]!;
        const im1 = im[b]!;
        // (rho M†)[s,t0] = c*rho[s,t0] + i*si*rho[s,t1]
        re[a] = c * re0 - si * im1;
        im[a] = c * im0 + si * re1;
        // (rho M†)[s,t1] = -i*si*rho[s,t0] + c*rho[s,t1]
        re[b] = c * re1 - si * im0;
        im[b] = c * im1 + si * re0;
      }
    }
  }

  /**
   * Exact single-qubit Pauli depolarizing channel on qubit j:
   *   E(rho) = (1-p) rho + (p/3) (X rho X + Y rho Y + Z rho Z).
   *
   * Entry-wise derivation: writing rho in 2x2 blocks along qubit j
   * (A = rows 0/cols 0, D = rows 1/cols 1, B = rows 0/cols 1, C = its adjoint),
   * X rho X swaps A<->D and B<->C, Z rho Z keeps A,D and negates B,C, and
   * Y rho Y swaps A<->D while negating the swapped B,C. Hence
   *  - A -> (1-2p/3) A + (2p/3) D and D -> (1-2p/3) D + (2p/3) A:
   *    entries whose row and column SHARE bit j (diagonal included) mix
   *    pairwise with their bit-j-flipped partner, weights (1-2p/3, 2p/3);
   *  - B, C -> (1-4p/3) B, C: entries whose row and column DIFFER on bit j
   *    decay with NO mixing.
   * Valid (completely positive) for 0 <= p <= 1.
   */
  depolarizeQubit(j: number, p: number): void {
    if (p === 0) return;
    requireThat(
      Number.isInteger(j) && j >= 0 && j < this.n,
      "QUBIT_INDEX_INVALID",
      `qubit index must be an integer in [0, n=${this.n}), got ${j} (1 << j wraps mod 32 silently otherwise)`,
    );
    requireThat(p >= 0 && p <= 1, "DEPOLARIZE_P_INVALID", `depolarizing probability out of [0,1]: ${p}`);
    const { re, im, dim } = this;
    const bit = 1 << j;
    const keepSame = 1 - (2 * p) / 3;
    const mixSame = (2 * p) / 3;
    const keepDiff = 1 - (4 * p) / 3;

    // Pass 1 — entries sharing bit j: pair (s,t) <-> (s^bit, t^bit) mixes.
    // Exactly one of {s, s^bit} carries bit j, so the s-without-bit member is
    // the canonical representative and each pair is written exactly once.
    // (The diagonal s === t is the classical bit-flip mixing of Pass 1.)
    for (let s = 0; s < dim; s++) {
      if (s & bit) continue;
      const row = s * dim;
      const partnerRow = (s | bit) * dim;
      for (let t = 0; t < dim; t++) {
        if (t & bit) continue;
        const a = row + t;
        const b = partnerRow + (t | bit);
        const ra = re[a]!;
        const ia = im[a]!;
        const rb = re[b]!;
        const ib = im[b]!;
        re[a] = keepSame * ra + mixSame * rb;
        im[a] = keepSame * ia + mixSame * ib;
        re[b] = mixSame * ra + keepSame * rb;
        im[b] = mixSame * ia + keepSame * ib;
      }
    }

    // Pass 2 — entries differing on bit j: plain coherence decay, no mixing.
    for (let s = 0; s < dim; s++) {
      const row = s * dim;
      const sHasBit = (s & bit) !== 0;
      for (let t = 0; t < dim; t++) {
        if (((t & bit) !== 0) === sHasBit) continue;
        const idx = row + t;
        re[idx] = keepDiff * re[idx]!;
        im[idx] = keepDiff * im[idx]!;
      }
    }
  }

  /** Trace (sum of the real diagonal; exact evolution keeps it at 1). */
  trace(): number {
    const { re, dim } = this;
    let acc = 0;
    for (let s = 0; s < dim; s++) acc += re[s * dim + s]!;
    return acc;
  }

  /** Born probabilities: the (real) diagonal of rho. */
  probabilities(): Float64Array {
    const { re, dim } = this;
    const out = new Float64Array(dim);
    for (let s = 0; s < dim; s++) out[s] = re[s * dim + s]!;
    return out;
  }

  /** Hermiticity defect max |rho_st - conj(rho_ts)| — a float-noise-level check. */
  hermiticityDefect(): number {
    const { re, im, dim } = this;
    let worst = 0;
    for (let s = 0; s < dim; s++) {
      const row = s * dim;
      for (let t = s + 1; t < dim; t++) {
        const a = row + t;
        const b = t * dim + s;
        const dr = Math.abs(re[a]! - re[b]!);
        const di = Math.abs(im[a]! + im[b]!);
        const d = Math.max(dr, di);
        if (d > worst) worst = d;
      }
    }
    return worst;
  }
}
