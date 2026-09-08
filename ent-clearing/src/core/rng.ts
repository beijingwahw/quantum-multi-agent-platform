/** Seeded RNG (mulberry32) — every experiment rerun must reproduce bit-for-bit. */

export interface Rng {
  (): number;
  int(maxExclusive: number): number;
  normal(): number;
  pick<T>(items: readonly T[]): T;
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
  const rng: Rng = Object.assign(next, {
    int: (maxExclusive: number): number => Math.floor(next() * maxExclusive),
    normal: (): number => {
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
    pick: <T>(items: readonly T[]): T => {
      if (items.length === 0) throw new Error('EC_EMPTY: rng.pick: empty collection');
      const drawn = items[Math.floor(next() * items.length)];
      if (drawn === undefined) throw new Error('EC_PICK: rng.pick drew nothing');
      return drawn;
    },
  });
  return rng;
}
