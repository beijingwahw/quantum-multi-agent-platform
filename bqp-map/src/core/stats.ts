/** Small statistics helpers shared by experiments and referees. */
import type { Rng } from "./rng.js";

/** Arithmetic mean. Private: only fitSlope consumes it — not part of the shared surface. */
function mean(xs: readonly number[]): number {
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

export function median(xs: readonly number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

/**
 * Least-squares slope of ys against xs.
 *
 * Single source since the wave-7 single-sourcing face: the former twin in
 * experiments/report.ts was deleted after proving the two bodies
 * bit-isomorphic — both accumulate the means left-to-right from an exact 0
 * seed (for-loop += vs reduce((a,b)=>a+b, 0) execute the same float ops in
 * the same order) and the num/den loops are token-identical, so every report
 * number is unchanged; repro byte-comparison confirmed it.
 */
export function fitSlope(xs: readonly number[], ys: readonly number[]): number {
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += ((xs[i] as number) - mx) * ((ys[i] as number) - my);
    den += ((xs[i] as number) - mx) ** 2;
  }
  return num / den;
}

/** Hoeffding sample count: shots m such that P(|est-mean| > eps) <= delta for a range of width R. */
export function hoeffdingShots(eps: number, delta: number, range: number): number {
  return Math.ceil((range * range * Math.log(2 / delta)) / (2 * eps * eps));
}

/**
 * n integers drawn uniformly from [lo, hi] (inclusive both ends), in the
 * caller's rng stream order. Single source since the wave-7 single-sourcing
 * face: the three token-identical copies (atlas/check.ts, exp1, the
 * reductions test) were collapsed onto this one; the rng draws happen in the
 * same order as before, so seeded streams are unchanged.
 */
export function randInts(rng: Rng, n: number, lo: number, hi: number): number[] {
  return Array.from({ length: n }, () => lo + rng.int(hi - lo + 1));
}
