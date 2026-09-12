/** Seeded RNG (mulberry32) — every experiment rerun must reproduce bit-for-bit. */

export interface Rng {
  (): number;
  int(maxExclusive: number): number;
  normal(): number;
  pick<T>(items: readonly T[]): T;
}

/** One standard complex-Gaussian sample (Box-Muller), rng consumed in a fixed
 * order: u1 (floored away from 0), then u2. The single source for every
 * Gaussian amplitude in the repo — callers must not roll their own pair. */
export function complexGaussian(rng: Rng): { re: number; im: number } {
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  const r = Math.sqrt(-2 * Math.log(u1));
  return { re: r * Math.cos(2 * Math.PI * u2), im: r * Math.sin(2 * Math.PI * u2) };
}

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let spare: number | null = null;
  // the callable-plus-methods shape assembled by Object.assign so the type
  // system sees the full Rng interface with no cast (all three methods, or
  // the b86#10 lesson repeats)
  const rng: Rng = Object.assign(next, {
    int(maxExclusive: number): number {
      // refuse BEFORE any draw so legal seeded streams stay bit-identical —
      // the guard every sibling mulberry32 lineage carries (qram-sched,
      // ent-sched, bqp-map, qverify, quantum-mech, k-switch, ft-qaoa,
      // nonstoq-anneal, dsic-noether): a non-integer bound has no uniform
      // value (int(2.5) draws 0/1/2 at 40/40/20), and 0/negative/Infinity
      // return impossible indices — silently
      if (!Number.isInteger(maxExclusive) || maxExclusive < 1) {
        throw new Error(
          `int(maxExclusive) draws uniformly from [0, maxExclusive): integer >= 1 required, got ${maxExclusive}`,
        );
      }
      return Math.floor(next() * maxExclusive);
    },
    normal(): number {
      if (spare !== null) {
        const v = spare;
        spare = null;
        return v;
      }
      let u: number;
      let v: number;
      let s: number;
      do {
        u = next() * 2 - 1;
        v = next() * 2 - 1;
        s = u * u + v * v;
      } while (s === 0 || s >= 1);
      const f = Math.sqrt((-2 * Math.log(s)) / s);
      spare = v * f;
      return u * f;
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error('rng.pick: empty collection');
      return items[rng.int(items.length)]!;
    },
  });
  return rng;
}
