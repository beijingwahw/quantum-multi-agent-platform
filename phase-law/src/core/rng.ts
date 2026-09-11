/** Seeded RNG (mulberry32) — every experiment rerun must reproduce bit-for-bit. */

/**
 * The v0.6.0 dead-export purge missed the int/normal/pick faces (zero
 * references since the solvers draw bare doubles); they were deleted at the
 * 2026-09-12 wave — among other things, the dead `int` carried the unguarded
 * biased-index face every other mulberry32 lineage in this workspace has
 * since refused at its boundary.
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
