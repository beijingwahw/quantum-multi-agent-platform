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

  /** Uniform integer in [0, n). */
  int(n: number): number {
    // a non-integer n has no uniform value in [0, n): floor(next()*n) would
    // silently draw a biased index (int(2.5) draws 0/1/2 at 40/40/20), and
    // n <= 0 or n = Infinity return impossible indices — the guard every other
    // mulberry32 lineage in this workspace already carries (dsic-noether,
    // qram-sched, ft-qaoa, nonstoq-anneal, qverify, quantum-mech, k-switch);
    // the refusal draws nothing, so legal seeded streams stay bit-identical
    if (!Number.isInteger(n) || n < 1) {
      throw new Error(`Rng.int: n must be an integer >= 1 (got ${n}) — no uniform value exists in [0, ${n})`);
    }
    return Math.floor(this.next() * n);
  }

  /** True with probability p. */
  bernoulli(p: number): boolean {
    return this.next() < p;
  }

  /** Uniform pick from a non-empty array (throws on empty — the documented precondition, enforced). */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error("Rng.pick: items must be non-empty");
    return items[this.int(items.length)] as T;
  }

  /** In-place Fisher-Yates; returns the same array for chaining. */
  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      const tmp = items[i] as T;
      items[i] = items[j] as T;
      items[j] = tmp;
    }
    return items;
  }
}
