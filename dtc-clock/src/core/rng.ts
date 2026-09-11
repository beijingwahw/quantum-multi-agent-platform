/** Seeded RNG (mulberry32) — every experiment rerun must reproduce bit-for-bit.
 * (v0.21.1 dead-code sweep: the int/normal/pick members had zero callers
 * anywhere in the workspace — grep-proven — and went; only the raw stream is
 * consumed, and the stream itself is unchanged bit-for-bit.) */
export interface Rng {
  (): number;
}

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
