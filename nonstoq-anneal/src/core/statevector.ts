/**
 * Zero-dependency state vector for annealing under σ^x-driver Hamiltonians.
 *
 * Key trick: a driver built from σ^x polynomials is DIAGONAL in the X basis,
 * and the basis change H^⊗n is an in-place Walsh-Hadamard transform. So every
 * evolution — real-time phase or imaginary-time damping — stays diagonal in
 * one of the two bases, and the whole engine is two diagonal sweeps plus two
 * transforms per Trotter slice.
 */
import { Rng } from "./rng.js";

export class StateVector {
  readonly dim: number;
  readonly re: Float64Array;
  readonly im: Float64Array;

  private constructor(readonly n: number, re: Float64Array, im: Float64Array) {
    this.dim = 1 << n;
    this.re = re;
    this.im = im;
  }

  static plusState(n: number): StateVector {
    const dim = 1 << n;
    const amp = 1 / Math.sqrt(dim);
    return new StateVector(n, new Float64Array(dim).fill(amp), new Float64Array(dim));
  }

  /**
   * Generic seeded real vector (normalized). Imaginary-time projection needs an
   * initial state with nonzero overlap on the whole spectrum: |+>^n is a single
   * X-basis ket and can be exactly orthogonal to the target ground space.
   */
  static seededReal(n: number, seed: number): StateVector {
    const dim = 1 << n;
    const rng = new Rng(seed);
    const re = new Float64Array(dim);
    for (let s = 0; s < dim; s++) re[s] = rng.range(-1, 1);
    const sv = new StateVector(n, re, new Float64Array(dim));
    sv.normalize();
    return sv;
  }

  clone(): StateVector {
    return new StateVector(this.n, this.re.slice(), this.im.slice());
  }

  norm(): number {
    let acc = 0;
    for (let s = 0; s < this.dim; s++) {
      const r = this.re[s]!;
      const i = this.im[s]!;
      acc += r * r + i * i;
    }
    return Math.sqrt(acc);
  }

  normalize(): void {
    const norm = this.norm();
    if (norm > 0) {
      for (let s = 0; s < this.dim; s++) {
        this.re[s] = this.re[s]! / norm;
        this.im[s] = this.im[s]! / norm;
      }
    }
  }

  /** Multiply amplitude s by exp(-i * gamma * eigen[s]) (Z- or X-basis diagonal). */
  applyPhase(gamma: number, eigen: Float64Array): void {
    const { re, im, dim } = this;
    for (let s = 0; s < dim; s++) {
      const e = eigen[s]!;
      if (e === 0) continue;
      const phase = -gamma * e;
      const c = Math.cos(phase);
      const si = Math.sin(phase);
      const r = re[s]!;
      const i = im[s]!;
      re[s] = r * c - i * si;
      im[s] = r * si + i * c;
    }
  }

  /** Multiply amplitude s by exp(-tau * eigen[s]) — imaginary-time damping. */
  applyDamp(tau: number, eigen: Float64Array): void {
    const { re, im, dim } = this;
    for (let s = 0; s < dim; s++) {
      const d = Math.exp(-tau * eigen[s]!);
      re[s] = re[s]! * d;
      im[s] = im[s]! * d;
    }
  }

  /**
   * In-place Walsh-Hadamard transform (apply H to every qubit, with the
   * 1/sqrt(2) per-qubit normalization). Maps the Z basis to the X basis and
   * back; applying twice is the identity.
   */
  applyHadamardAll(): void {
    const { re, im, dim, n } = this;
    const invSqrt2 = 1 / Math.SQRT2;
    for (let j = 0; j < n; j++) {
      const stride = 1 << j;
      for (let s0 = 0; s0 < dim; s0++) {
        if (s0 & stride) continue;
        const s1 = s0 | stride;
        const re0 = re[s0]!;
        const re1 = re[s1]!;
        const im0 = im[s0]!;
        const im1 = im[s1]!;
        re[s0] = (re0 + re1) * invSqrt2;
        im[s0] = (im0 + im1) * invSqrt2;
        re[s1] = (re0 - re1) * invSqrt2;
        im[s1] = (im0 - im1) * invSqrt2;
      }
    }
  }

  probabilities(): Float64Array {
    const out = new Float64Array(this.dim);
    for (let s = 0; s < this.dim; s++) {
      const r = this.re[s]!;
      const i = this.im[s]!;
      out[s] = r * r + i * i;
    }
    return out;
  }

  /** Expectation of a diagonal (Z-basis) operator given per-state eigenvalues. */
  expectation(eigen: Float64Array): number {
    const probs = this.probabilities();
    let acc = 0;
    for (let s = 0; s < this.dim; s++) acc += probs[s]! * eigen[s]!;
    return acc;
  }

  /**
   * Sign-structure ratio P = sum(psi) / sum(|psi|) for a real state.
   * P = 1 exactly when every amplitude is non-negative (Perron-Frobenius
   * property of stoquastic ground states); P < 1 certifies sign structure
   * that stochastic (worldline) classical samplers pay for exponentially.
   */
  signRatio(): number {
    let sum = 0;
    let absSum = 0;
    for (let s = 0; s < this.dim; s++) {
      const v = this.re[s]!;
      sum += v;
      absSum += Math.abs(v);
    }
    return absSum > 0 ? sum / absSum : 1;
  }
}
