/**
 * Deterministic seeded RNG (mulberry32). Every experiment and every stochastic
 * referee in this repository draws randomness exclusively from instances of
 * this class, so any reported number can be regenerated bit-for-bit from a seed.
 *
 * v0.3.0: the never-referenced `pick` method is retired (the live paths index
 * with int(n)), and the random-data-state generator — previously two identical
 * private copies in test/vacuum.test.ts and experiments/exp1-compile.ts — is
 * single-sourced here (the stochastic-referee module).
 */
import { type CVec, cvecZero } from "../core/cmat.js";

export class Rng {
  private state: number;

  constructor(readonly seed: number) {
    this.state = seed >>> 0;
    if (this.state === 0) this.state = 0x9e3779b9;
  }

  /** Uniform in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform integer in [0, n). */
  int(n: number): number {
    return Math.floor(this.next() * n);
  }

  bernoulli(p: number): boolean {
    return this.next() < p;
  }
}

/** A random normalized data-space state (uniform re/im boxes, then normed).
 * The single definition since v0.3.0 — the draw order is byte-identical to
 * the former test/experiment copies, so every seeded number regenerates
 * bit-for-bit. */
export function randomDataState(dim: number, rng: Rng): CVec {
  const v = cvecZero(dim);
  for (let k = 0; k < dim; k++) {
    v.re[k] = rng.next() * 2 - 1;
    v.im[k] = rng.next() * 2 - 1;
  }
  const n = Math.sqrt(v.re.reduce((s, x) => s + x * x, 0) + v.im.reduce((s, x) => s + x * x, 0));
  for (let k = 0; k < dim; k++) {
    v.re[k] = (v.re[k] as number) / n;
    v.im[k] = (v.im[k] as number) / n;
  }
  return v;
}
