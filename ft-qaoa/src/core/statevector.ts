/**
 * Minimal zero-dependency state-vector engine, tuned for deep QAOA forward passes:
 * interleaved-real state lives in two Float64Arrays and only the two primitives
 * deep QAOA needs (diagonal cost phases, transverse-field mixer) are provided.
 */
export class StateVector {
  readonly dim: number;
  readonly re: Float64Array;
  readonly im: Float64Array;

  private constructor(readonly n: number, re: Float64Array, im: Float64Array) {
    this.dim = 1 << n;
    this.re = re;
    this.im = im;
  }

  /** Uniform superposition |+>^n — the QAOA initial state. */
  static plusState(n: number): StateVector {
    const dim = 1 << n;
    const amp = 1 / Math.sqrt(dim);
    return new StateVector(n, new Float64Array(dim).fill(amp), new Float64Array(dim));
  }

  static zeros(n: number): StateVector {
    const dim = 1 << n;
    const sv = new StateVector(n, new Float64Array(dim), new Float64Array(dim));
    sv.re[0] = 1;
    return sv;
  }

  clone(): StateVector {
    return new StateVector(this.n, this.re.slice(), this.im.slice());
  }

  /** Apply exp(-i * gamma * C) where energyOf[s] is the eigenvalue on basis state s. */
  applyCostPhase(gamma: number, energyOf: Float64Array): void {
    const { re, im, dim } = this;
    for (let s = 0; s < dim; s++) {
      const e = energyOf[s]!;
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

  /**
   * Apply exp(-i * beta * B) with B = sum_j X_j. The per-qubit factors commute, so
   * this is a product of single-qubit rotations [[cos, -i sin], [-i sin, cos]].
   */
  applyMixer(beta: number): void {
    const { re, im, dim, n } = this;
    const c = Math.cos(beta);
    const si = Math.sin(beta);
    if (c === 1 && si === 0) return;
    for (let j = 0; j < n; j++) {
      const stride = 1 << j;
      for (let s0 = 0; s0 < dim; s0++) {
        if (s0 & stride) continue;
        const s1 = s0 | stride;
        const re0 = re[s0]!;
        const im0 = im[s0]!;
        const re1 = re[s1]!;
        const im1 = im[s1]!;
        re[s0] = c * re0 + si * im1;
        im[s0] = c * im0 - si * re1;
        re[s1] = c * re1 + si * im0;
        im[s1] = c * im1 - si * re0;
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

  norm(): number {
    let acc = 0;
    for (let s = 0; s < this.dim; s++) {
      const r = this.re[s]!;
      const i = this.im[s]!;
      acc += r * r + i * i;
    }
    return Math.sqrt(acc);
  }
}
