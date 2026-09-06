/**
 * Loop-exactness machinery: the algebra shared by Rochet cyclical
 * monotonicity and discrete Noether closedness.
 *
 * A 1-form on a finite complete digraph is edge data omega(a -> b). Its cycle
 * sums determine everything: potential-exactness (all cycles sum to exactly 0)
 * and no-positive-cycles (all cycles sum to <= 0). For exactness it is enough
 * to check triangles; for the one-sided condition we enumerate all simple
 * cycles (node counts here stay <= 6).
 */

export type EdgeForm = (a: number, b: number) => number;

/** All simple cycles on node set {0..K-1}, each as an index cycle
 * [i0, i1, ..., ik-1] meaning i0 -> i1 -> ... -> ik-1 -> i0. K!-ish growth:
 * assert K <= 7 before enumerating. */
export function simpleCycles(k: number): number[][] {
  if (k > 7) throw new Error(`simpleCycles: K=${k} too large (factorial blow-up)`);
  const out: number[][] = [];
  const used = new Array<boolean>(k).fill(false);
  const path: number[] = [];
  const walk = (start: number, depth: number): void => {
    for (let nxt = 0; nxt < k; nxt++) {
      if (nxt === start) {
        if (depth >= 2) {
          path.push(start);
          out.push([...path]);
          path.pop();
        }
        continue;
      }
      if (used[nxt]) continue;
      // canonical representative: a cycle is recorded once, starting at its
      // smallest node, so require nxt > start for the SECOND node onwards
      if (nxt < start) continue;
      used[nxt] = true;
      path.push(nxt);
      walk(start, depth + 1);
      path.pop();
      used[nxt] = false;
    }
  };
  for (let s = 0; s < k; s++) {
    used[s] = true;
    path.push(s);
    walk(s, 1);
    path.pop();
    used[s] = false;
  }
  return out;
}

export interface CycleScan {
  max: number;
  min: number;
  worst: number[]; // the cycle attaining max
  count: number;
}

/** Max/min simple-cycle sum of a 1-form (K <= 7). */
export function cycleScan(k: number, omega: EdgeForm): CycleScan {
  const cycles = simpleCycles(k);
  let max = -Infinity;
  let min = Infinity;
  let worst: number[] = [];
  for (const cyc of cycles) {
    let s = 0;
    for (let i = 0; i < cyc.length; i++) {
      const a = cyc[i] as number;
      const b = cyc[(i + 1) % cyc.length] as number;
      s += omega(a, b);
    }
    if (s > max) {
      max = s;
      worst = cyc;
    }
    min = Math.min(min, s);
  }
  return { max, min, worst, count: cycles.length };
}

/** Max |sum| over ALL triangles: exactness fails iff some triangle is nonzero. */
export function maxTriangleImbalance(k: number, omega: EdgeForm): number {
  let worst = 0;
  for (let a = 0; a < k; a++) {
    for (let b = 0; b < k; b++) {
      if (b === a) continue;
      for (let c = 0; c < k; c++) {
        if (c === a || c === b) continue;
        worst = Math.max(worst, Math.abs(omega(a, b) + omega(b, c) + omega(c, a)));
      }
    }
  }
  return worst;
}
