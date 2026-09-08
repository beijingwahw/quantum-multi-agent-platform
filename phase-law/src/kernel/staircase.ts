/**
 * PHASE-LAW v0.5.0 — BREAKPOINT-SCALING IN k (PL20): the staircase of PL14
 * (opt(λ) = max_j (C_j + jλ), argmax nondecreasing in λ) has EXACT RATIONAL
 * breakpoints: the argmax flips where two envelope lines cross,
 *      λ* = (C_a − C_b) / (b − a),
 * and the flipping levels are the UPPER CONVEX HULL of the points (j, C_j).
 * Weights are 3-decimal, so C_j is computed in INTEGER THOUSANDTHS by
 * enumerating with the pre-rounding integers — the breakpoints are exact
 * rationals p/q, q ≤ k, with zero floating doubt. Verification: at λ* ± 1e-6
 * the argmax must sit on the two hull neighbours (deviation 0 over all
 * cells), and the enumerated optimum's realized count must equal the argmax
 * at every probe. The k-scaling of the breakpoint positions is reported AS
 * DATA ONLY — no scaling law is claimed.
 */
import { enumerateKPair, makeIntegerWeights, makeKPairInstance, type KPairInstance } from "./law.js";

export interface StaircaseCell {
  readonly m: number;
  readonly n: number;
  readonly seed: number;
  readonly k: number;
  /** C_j in integer thousandths, index 0..k; null where level j is unreachable (2j > m) */
  readonly cThou: ReadonlyArray<number | null>;
  /** the hull levels (j values), strictly ascending, starting at argmax C_j (λ ≥ 0 face) */
  readonly levels: readonly number[];
  /** exact breakpoints between consecutive hull levels, strictly ascending, same length − 1 */
  readonly breaks: readonly number[];
}

/** C_j in thousandths by enumeration with integer arithmetic (the referee). */
export function integerCj(m: number, n: number, seed: number, k: number): ReadonlyArray<number | null> {
  if (2 * k > n) throw new Error(`integerCj: k=${k} needs n ≥ 2k (n=${n}) — wrong object`);
  const weights = makeIntegerWeights(m, n, seed);
  const c = new Array<number | null>(k + 1).fill(null);
  const current = new Array<number>(m).fill(-1);
  const used = new Array<boolean>(n).fill(false);
  const rec = (t: number, w0: number): void => {
    if (t === m) {
      let pairs = 0;
      for (let i = 0; i < k; i++) {
        if (current.includes(2 * i) && current.includes(2 * i + 1)) pairs++;
      }
      const prev = c[pairs] ?? null;
      if (prev === null || w0 > prev) c[pairs] = w0;
      return;
    }
    for (let a = 0; a < n; a++) {
      if (used[a]!) continue;
      used[a] = true;
      current[t] = a;
      rec(t + 1, w0 + weights[t]![a]!);
      used[a] = false;
      current[t] = -1;
    }
  };
  rec(0, 0);
  return c;
}

/**
 * The upper convex hull of the finite points (j, C_j), listed left to right
 * from the λ ≥ 0 face: start at the leftmost point of the upper hull (the
 * argmax of C_j, ties to the largest j — for λ > 0 the steeper line wins
 * immediately), keep points while the chain turns clockwise (slopes of
 * successive edges strictly decreasing — the envelope property).
 */
export function upperHull(c: ReadonlyArray<number | null>): readonly number[] {
  const pts: Array<[number, number]> = [];
  for (let j = 0; j < c.length; j++) {
    if (c[j] !== null) pts.push([j, c[j] as number]);
  }
  if (pts.length === 0) return [];
  // start: the max-C point, ties to the LARGEST j (for any λ > 0 the steeper
  // line dominates immediately; at λ = 0 they tie)
  let startIdx = 0;
  for (let i = 1; i < pts.length; i++) {
    if (pts[i]![1] > pts[startIdx]![1] || (pts[i]![1] === pts[startIdx]![1] && pts[i]![0] > pts[startIdx]![0])) {
      startIdx = i;
    }
  }
  const hull: Array<[number, number]> = [pts[startIdx]!];
  // walk right: keep the chain convex (successive edge slopes strictly
  // decreasing) — pop while the new point makes a left turn (slope increases)
  for (let i = startIdx + 1; i < pts.length; i++) {
    while (hull.length >= 2) {
      const [jA, cA] = hull[hull.length - 2]!;
      const [jB, cB] = hull[hull.length - 1]!;
      const [jC, cC] = pts[i]!;
      // slope(B→C) vs slope(A→B): pop B if slope does not strictly decrease
      const s1 = (cB - cA) / (jB - jA);
      const s2 = (cC - cB) / (jC - jB);
      if (s2 >= s1) hull.pop();
      else break;
    }
    hull.push(pts[i]!);
  }
  return hull.map(([j]) => j);
}

export function staircaseCell(m: number, n: number, seed: number, k: number): StaircaseCell {
  const cThou = integerCj(m, n, seed, k);
  const levels = upperHull(cThou);
  const breaks: number[] = [];
  for (let i = 1; i < levels.length; i++) {
    const a = cThou[levels[i - 1]!] as number;
    const b = cThou[levels[i]!] as number;
    breaks.push((a - b) / (levels[i]! - levels[i - 1]!) / 1000);
  }
  return { m, n, seed, k, cThou, levels, breaks };
}

/** The envelope argmax at λ (integer C, float λ — safe: probe offsets 1e-6
 * are 3 orders above float error). */
export function staircaseArgmax(cell: StaircaseCell, lambda: number): number {
  let bestJ = -1;
  let bestV = -Infinity;
  for (let j = 0; j <= cell.k; j++) {
    const c = cell.cThou[j] ?? null;
    if (c === null) continue;
    const v = c + j * lambda * 1000;
    if (v > bestV) {
      bestV = v;
      bestJ = j;
    }
  }
  return bestJ;
}

/** THEOREM CHECK 1: at every breakpoint λ* ± 1e-6 the argmax must sit exactly
 * on the two hull neighbours — the flip is sharp at the rational point. */
export function staircaseFlipDeviation(cell: StaircaseCell): number {
  let worst = 0;
  for (let i = 0; i < cell.breaks.length; i++) {
    const b = cell.breaks[i]!;
    const below = staircaseArgmax(cell, b - 1e-6);
    const above = staircaseArgmax(cell, b + 1e-6);
    if (below !== cell.levels[i]!) worst = Math.max(worst, 1);
    if (above !== cell.levels[i + 1]!) worst = Math.max(worst, 1);
  }
  return worst;
}

/** THEOREM CHECK 2: the enumerated optimum's realized-pair count equals the
 * envelope argmax at every λ of a grid (PL14 at breakpoint resolution).
 * Tie-aware: when the envelope's top value is achieved by SEVERAL levels
 * (λ exactly on a breakpoint, or an exact C_j tie — the 3-decimal weights
 * make both real), the identity is "enumerated count ∈ the tied set"; such
 * probes are counted, not scored. */
export function staircaseArgmaxMismatch(
  m: number,
  n: number,
  seed: number,
  k: number,
  lambdas: readonly number[],
): { worst: number; ties: number } {
  const cell = staircaseCell(m, n, seed, k);
  let worst = 0;
  let ties = 0;
  for (const lambda of lambdas) {
    const inst = makeKPairInstance(m, n, seed, lambda, k);
    let bestW = -Infinity;
    let pairs = -1;
    for (const a of enumerateKPair(inst)) {
      if (a.welfare > bestW) {
        bestW = a.welfare;
        pairs = a.pairs;
      }
    }
    const values: number[] = [];
    for (let j = 0; j <= k; j++) {
      const c = cell.cThou[j] ?? null;
      if (c === null) continue;
      values.push(c + j * lambda * 1000);
    }
    const top = Math.max(...values);
    const winners = values.filter((v) => Math.abs(v - top) < 1e-6).length;
    if (winners > 1) {
      ties++;
      // the enumerated count must be one of the tied levels
      let ok = false;
      for (let j = 0; j <= k; j++) {
        const c = cell.cThou[j] ?? null;
        if (c === null) continue;
        if (j === pairs && Math.abs(c + j * lambda * 1000 - top) < 1e-6) ok = true;
      }
      if (!ok) worst = Math.max(worst, 1);
    } else {
      worst = Math.max(worst, Math.abs(pairs - staircaseArgmax(cell, lambda)));
    }
  }
  return { worst, ties };
}

/**
 * The counter-counterfeit check: re-derive the hull and every breakpoint from
 * the cell's OWN C-vector and name any mismatch — a forged breakpoint table
 * (a nudge, a swap, a dropped step) is named and rejected, never rendered.
 */
export function staircaseCheck(cell: StaircaseCell): string[] {
  const out: string[] = [];
  const name = `${cell.m}×${cell.n} seed ${cell.seed} k=${cell.k}`;
  const levels = upperHull(cell.cThou);
  if (levels.length !== cell.levels.length || levels.some((l, i) => l !== cell.levels[i])) {
    out.push(`${name}: counterfeit levels [${cell.levels.join(",")}] — the C-vector gives [${levels.join(",")}]`);
    return out;
  }
  for (let i = 1; i < cell.levels.length; i++) {
    if (cell.levels[i]! <= cell.levels[i - 1]!) {
      out.push(`${name}: levels not strictly ascending — a staircase cannot descend`);
    }
  }
  for (let i = 1; i < cell.breaks.length; i++) {
    if (cell.breaks[i]! <= cell.breaks[i - 1]!) {
      out.push(`${name}: breakpoints not strictly ascending at position ${i}`);
    }
  }
  if (cell.breaks.length !== Math.max(0, cell.levels.length - 1)) {
    out.push(`${name}: ${cell.breaks.length} breakpoints for ${cell.levels.length} levels — shape mismatch`);
    return out;
  }
  for (let i = 0; i < cell.breaks.length; i++) {
    const a = cell.cThou[cell.levels[i]!] as number;
    const b = cell.cThou[cell.levels[i + 1]!] as number;
    const exact = (a - b) / (cell.levels[i + 1]! - cell.levels[i]!) / 1000;
    if (Math.abs(exact - cell.breaks[i]!) > 1e-9) {
      out.push(
        `${name}: counterfeit breakpoint ${cell.breaks[i]!.toFixed(6)} at position ${i} — the lines cross at ${exact.toFixed(6)}`,
      );
    }
    if (cell.breaks[i]! < 0) {
      out.push(`${name}: negative breakpoint at position ${i} — outside the λ ≥ 0 face`);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// The scaling DATA (no law claimed): where the staircase's steps sit as k
// grows — the last breakpoint (the all-k threshold λ_k^+) and the number of
// realized steps, over a public-seed horizon.
// ---------------------------------------------------------------------------

export interface StaircaseStats {
  readonly k: number;
  readonly cells: number;
  /** cells with at least one visible breakpoint (a nontrivial staircase) */
  readonly cellsWithBreaks: number;
  readonly lastBreakMin: number;
  readonly lastBreakMedian: number;
  readonly lastBreakMax: number;
  /** cells whose staircase has the full k steps (k distinct breakpoints) */
  readonly fullStaircaseCells: number;
}

export function staircaseStats(cells: readonly StaircaseCell[]): StaircaseStats[] {
  const byK = new Map<number, StaircaseCell[]>();
  for (const c of cells) {
    const list = byK.get(c.k) ?? [];
    list.push(c);
    byK.set(c.k, list);
  }
  const out: StaircaseStats[] = [];
  for (const k of [...byK.keys()].sort((a, b) => a - b)) {
    const list = byK.get(k)!;
    // medians over NONTRIVIAL staircases only (a break-less cell has no
    // "last breakpoint" — defaulting it to 0 would fake the statistic)
    const lasts = list
      .filter((c) => c.breaks.length >= 1)
      .map((c) => c.breaks[c.breaks.length - 1]!)
      .sort((a, b) => a - b);
    const med = lasts[Math.floor(lasts.length / 2)] ?? 0;
    out.push({
      k,
      cells: list.length,
      cellsWithBreaks: lasts.length,
      lastBreakMin: lasts[0] ?? 0,
      lastBreakMedian: med,
      lastBreakMax: lasts[lasts.length - 1] ?? 0,
      fullStaircaseCells: list.filter((c) => c.breaks.length === k).length,
    });
  }
  return out;
}

/** Float cross-check: the integer C_j must equal the λ=0 float envelope. */
export function staircaseFloatCrossCheck(cell: StaircaseCell): number {
  const inst: KPairInstance = makeKPairInstance(cell.m, cell.n, cell.seed, 0, cell.k);
  let worst = 0;
  const floatC = new Array<number>(cell.k + 1).fill(-Infinity);
  let any = false;
  for (const a of enumerateKPair(inst)) {
    if (a.w0 > floatC[a.pairs]!) floatC[a.pairs] = a.w0;
    any = true;
  }
  if (!any) throw new Error("empty enumeration");
  for (let j = 0; j <= cell.k; j++) {
    const c = cell.cThou[j] ?? null;
    if (c === null) continue;
    worst = Math.max(worst, Math.abs(c / 1000 - floatC[j]!) * 1000);
  }
  return worst;
}
