/**
 * Deterministic seeded RNG (mulberry32).
 *
 * Uses only uint32 integer arithmetic, so the sequence is bit-identical across
 * platforms and Node versions — a hard requirement for reproducible reports.
 * Ported verbatim from ft-qaoa so both prototypes share one noise model.
 */
export class Rng {
  private state: number;

  constructor(readonly seed: number) {
    this.state = seed >>> 0;
  }

  nextU32(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }

  /** Uniform in [0, 1). */
  next(): number {
    return this.nextU32() / 4294967296;
  }

  /** Uniform in [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Uniform integer in [0, maxExclusive). */
  int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }

  /** Bernoulli trial with success probability p. */
  bernoulli(p: number): boolean {
    return this.next() < p;
  }
}
