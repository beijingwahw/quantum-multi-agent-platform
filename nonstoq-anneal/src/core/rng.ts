import { NonstoqError } from "./errors.js";

/**
 * Deterministic seeded RNG (mulberry32).
 *
 * Uses only uint32 integer arithmetic, so the sequence is bit-identical across
 * platforms and Node versions — a hard requirement for reproducible reports.
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
    if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) {
      throw new NonstoqError("RngRangeDomain", `range(min, max) needs finite bounds with min <= max, got [${min}, ${max}]`);
    }
    return min + (max - min) * this.next();
  }

  /** Uniform integer in [0, maxExclusive). */
  int(maxExclusive: number): number {
    // refuse BEFORE any draw so legal seeded streams stay bit-identical —
    // a non-integer bound has no uniform value (int(2.5) draws 0/1/2 at
    // 40/40/20) and 0/negative/Infinity return impossible indices; the same
    // guard the qverify/quantum-mech/k-switch/qram-sched cores carry
    if (!Number.isInteger(maxExclusive) || maxExclusive < 1) {
      throw new NonstoqError("RngIntDomain", `int(maxExclusive) draws uniformly from [0, maxExclusive): integer >= 1 required, got ${maxExclusive}`);
    }
    return Math.floor(this.next() * maxExclusive);
  }
}
