import { KernelError } from "./errors.js";

/**
 * Deterministic seeded RNG (mulberry32). Every experiment and every stochastic
 * referee in this repository draws randomness exclusively from instances of
 * this class, so any reported number can be regenerated bit-for-bit from a seed.
 */
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

  /** Uniform integer in [lo, hi]. */
  intInclusive(lo: number, hi: number): number {
    // an empty (hi < lo) or non-integer range silently returns out-of-range
    // values — refuse by name; the refusal draws nothing, so the stream of a
    // legal caller is untouched
    if (!Number.isInteger(lo) || !Number.isInteger(hi) || hi < lo) {
      throw new KernelError("rng/int-inclusive-range", `intInclusive: [${lo}, ${hi}] is not an integer range with lo <= hi`);
    }
    return lo + Math.floor(this.next() * (hi - lo + 1));
  }

  /** Uniform integer in [0, n). */
  int(n: number): number {
    // n < 1 makes the range empty (int(0) "returned" 0, int(-2) returned -1);
    // a fractional n skews the floor — both silent, both refused by name
    if (!Number.isInteger(n) || n < 1) {
      throw new KernelError("rng/int-range", `int: maxExclusive ${n} is not an integer >= 1`);
    }
    return Math.floor(this.next() * n);
  }
}
