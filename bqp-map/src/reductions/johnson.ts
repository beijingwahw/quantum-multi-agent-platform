/**
 * Johnson's rule for F2||Cmax (Johnson 1954, Naval Research Logistics
 * Quarterly 1(1):61-68) — the canonical "polynomial island" of scheduling.
 *
 * Every job has (p1, p2). Order jobs with p1 < p2 by p1 ascending first, jobs
 * with p1 >= p2 by p2 descending last; the result minimizes the makespan
 * exactly, in O(n log n). This is machine-verified against all-permutation
 * brute force: the atlas cites this as P-EXACT — a problem where "quantum
 * speedup" has nothing left to speed up (the answer is already exact and
 * near-linear).
 */

export function johnsonOrder(p1: readonly number[], p2: readonly number[]): number[] {
  const n = p1.length;
  const front: number[] = []; // p1 < p2: schedule first, ascending p1
  const back: number[] = []; // p1 >= p2: schedule last, descending p2
  for (let i = 0; i < n; i++) {
    if ((p1[i] as number) < (p2[i] as number)) front.push(i);
    else back.push(i);
  }
  front.sort((a, b) => (p1[a] as number) - (p1[b] as number));
  back.sort((a, b) => (p2[b] as number) - (p2[a] as number));
  return [...front, ...back];
}

export function flow2Makespan(p1: readonly number[], p2: readonly number[], order: readonly number[]): number {
  let t1 = 0;
  let t2 = 0;
  for (const j of order) {
    t1 += p1[j] as number;
    t2 = Math.max(t1, t2) + (p2[j] as number);
  }
  return t2;
}

/** All-permutation brute force — the exhaustive referee (n <= 8). */
export function bruteForceFlow2(p1: readonly number[], p2: readonly number[]): number {
  const n = p1.length;
  const used = new Array<boolean>(n).fill(false);
  const order: number[] = [];
  let best = Infinity;
  const rec = (): void => {
    if (order.length === n) {
      best = Math.min(best, flow2Makespan(p1, p2, order));
      return;
    }
    for (let i = 0; i < n; i++) {
      if (used[i]) continue;
      used[i] = true;
      order.push(i);
      rec();
      order.pop();
      used[i] = false;
    }
  };
  rec();
  return best;
}

export function johnsonOptimal(p1: readonly number[], p2: readonly number[]): boolean {
  return flow2Makespan(p1, p2, johnsonOrder(p1, p2)) === bruteForceFlow2(p1, p2);
}
