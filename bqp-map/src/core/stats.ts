/** Small statistics helpers shared by experiments and referees. */

export function mean(xs: readonly number[]): number {
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

export function median(xs: readonly number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

/** Least-squares slope of ys against xs. */
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

export function fmt(x: number, digits = 3): string {
  if (!Number.isFinite(x)) return String(x);
  return x.toPrecision(digits);
}
