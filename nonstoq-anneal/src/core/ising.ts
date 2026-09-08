import type { Rng } from "./rng.js";
import { NonstoqError } from "./errors.js";
import { zSpectrumOf } from "./spectra.js";
import type { ZSpectrum } from "./spectra.js";

/** Weighted Ising coupling between qubits j < k. */
export interface Coupling {
  readonly j: number;
  readonly k: number;
  readonly w: number;
}

/**
 * Cost function C(s) = sum_j h_j * z_j + sum_{(j,k)} w_jk * z_j * z_k
 * with z_j = +1 when bit j of the basis index is 0, and -1 when it is 1.
 * QAOA maximizes C.
 */
export interface IsingModel {
  readonly n: number;
  readonly fields: readonly number[];
  readonly couplings: readonly Coupling[];
}

export interface RandomIsingOptions {
  /** Approximate graph degree (number of coupling partners per qubit). */
  readonly degree?: number;
  readonly fieldRange?: readonly [number, number];
  readonly weightRange?: readonly [number, number];
}

/** Seeded sparse random Ising instance (default: degree-3, weights in [-1, 1]). */
export function randomIsing(rng: Rng, n: number, options: RandomIsingOptions = {}): IsingModel {
  const degree = options.degree ?? 3;
  const fieldRange = options.fieldRange ?? [-1, 1];
  const weightRange = options.weightRange ?? [-1, 1];

  const seen = new Set<number>();
  const couplings: Coupling[] = [];
  for (let j = 0; j < n; j++) {
    let added = 0;
    let guard = 0;
    while (added < degree && guard < 50 * degree * n) {
      guard++;
      const k = rng.int(n);
      if (k === j) continue;
      const lo = Math.min(j, k);
      const hi = Math.max(j, k);
      const key = lo * n + hi;
      if (seen.has(key)) continue;
      seen.add(key);
      couplings.push({
        j: lo,
        k: hi,
        w: rng.range(weightRange[0], weightRange[1]),
      });
      added++;
    }
  }
  const fields = Array.from({ length: n }, () => rng.range(fieldRange[0], fieldRange[1]));
  return { n, fields, couplings };
}

/**
 * Seeded 3-regular MaxCut instance encoded as Ising maximization:
 * cycle (degree 2) + random perfect matching (degree 1), weights all -1, no fields.
 * C(s) = 2*cut(s) - |E|, so maximizing C maximizes the cut.
 * The matching is retried until every pair avoids the cycle edges, so the
 * graph is exactly 3-regular.
 */
export function maxcut3Reg(rng: Rng, n: number): IsingModel {
  if (n < 4 || n % 2 !== 0) {
    throw new NonstoqError("Maxcut3RegDomain", `3-regular graph needs even n >= 4, got ${n}`);
  }
  const isCycleEdge = (a: number, b: number): boolean => {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    return hi - lo === 1 || hi - lo === n - 1;
  };
  const couplings: Coupling[] = [];
  for (let j = 0; j < n; j++) {
    const k = (j + 1) % n;
    couplings.push({ j: Math.min(j, k), k: Math.max(j, k), w: -1 });
  }
  const perm = Array.from({ length: n }, (_, i) => i);
  let matched = false;
  for (let attempt = 0; attempt < 200 && !matched; attempt++) {
    for (let i = n - 1; i > 0; i--) {
      const r = rng.int(i + 1);
      const tmp = perm[i]!;
      perm[i] = perm[r]!;
      perm[r] = tmp;
    }
    let ok = true;
    for (let i = 0; i < n; i += 2) {
      if (isCycleEdge(perm[i]!, perm[i + 1]!)) {
        ok = false;
        break;
      }
    }
    matched = ok;
  }
  if (!matched) {
    throw new NonstoqError("Maxcut3RegMatchFailed", `could not build a 3-regular matching on n=${n} in 200 attempts`);
  }
  for (let i = 0; i < n; i += 2) {
    const a = perm[i]!;
    const b = perm[i + 1]!;
    couplings.push({ j: Math.min(a, b), k: Math.max(a, b), w: -1 });
  }
  return { n, fields: new Array<number>(n).fill(0), couplings };
}

/** Energy of every computational basis state, indexed by bit pattern. O(2^n * |couplings|).
 *  返回 Z 谱表（品牌）：进引擎的 energies 槽位，与 X 基驱动表互不可换。 */
export function energies(model: IsingModel): ZSpectrum {
  const dim = 1 << model.n;
  const out = new Float64Array(dim);
  const { fields, couplings } = model;
  for (let s = 0; s < dim; s++) {
    let e = 0;
    for (const c of couplings) {
      const zj = (s >>> c.j) & 1 ? -1 : 1;
      const zk = (s >>> c.k) & 1 ? -1 : 1;
      e += c.w * zj * zk;
    }
    for (let j = 0; j < fields.length; j++) {
      if (fields[j] !== 0) e += fields[j]! * ((s >>> j) & 1 ? -1 : 1);
    }
    out[s] = e;
  }
  return zSpectrumOf(out);
}

export interface BruteForceResult {
  readonly optimum: number;
  readonly argmax: number;
}

/** Exact optimum by exhaustive search; the ground truth every ratio is measured against. */
export function bruteForce(energyOf: Float64Array): BruteForceResult {
  let best = energyOf[0]!;
  let argmax = 0;
  for (let s = 1; s < energyOf.length; s++) {
    const e = energyOf[s]!;
    if (e > best) {
      best = e;
      argmax = s;
    }
  }
  return { optimum: best, argmax };
}

/** Map an Ising objective value of a MaxCut instance back to cut size. */
export function cutSize(model: IsingModel, energy: number): number {
  return (energy + model.couplings.length) / 2;
}
