/** Shared experiment kernels: complex matrix helpers for certificate checks. */

export function dag(a: { re: number[][]; im: number[][] }): { re: number[][]; im: number[][] } {
  const n = a.re.length;
  const re = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const im = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      re[i]![j] = a.re[j]![i]!;
      im[i]![j] = -a.im[j]![i]!;
    }
  }
  return { re, im };
}

export function mul(a: { re: number[][]; im: number[][] }, b: { re: number[][]; im: number[][] }): { re: number[][]; im: number[][] } {
  const n = a.re.length;
  const re = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const im = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < n; k++) {
      const ar = a.re[i]![k]!;
      const ai = a.im[i]![k]!;
      if (ar === 0 && ai === 0) continue;
      for (let j = 0; j < n; j++) {
        re[i]![j] = re[i]![j]! + ar * b.re[k]![j]! - ai * b.im[k]![j]!;
        im[i]![j] = im[i]![j]! + ar * b.im[k]![j]! + ai * b.re[k]![j]!;
      }
    }
  }
  return { re, im };
}

export function maxDevFrom(a: { re: number[][]; im: number[][] }, b: { re: number[][]; im: number[][] }): number {
  let d = 0;
  for (let i = 0; i < a.re.length; i++) {
    for (let j = 0; j < a.re.length; j++) {
      d = Math.max(d, Math.hypot((a.re[i]![j] as number) - (b.re[i]![j] as number), (a.im[i]![j] as number) - (b.im[i]![j] as number)));
    }
  }
  return d;
}
