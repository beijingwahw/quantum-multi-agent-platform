/**
 * Seeded RNG (mulberry32) — every experiment rerun must reproduce bit-for-bit.
 * Wave 4's dead-code clearing removed the unused int/normal/pick helpers and
 * fmt: the live consumers draw bare doubles only, and the bit stream below is
 * byte-identical to the v0.2.0 generator (same state advance, same rounding).
 */

export type Rng = () => number;

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
