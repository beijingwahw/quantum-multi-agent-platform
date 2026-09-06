/**
 * Exact Grover machinery over a search space of size N (basis states 0..N-1).
 *
 * Two independent computations of the same quantity:
 *   1. closed form  success(k) = sin^2((2k+1)*theta),  theta = arcsin(sqrt(t/N))
 *   2. exact state-vector evolution (oracle O flips the sign of marked
 *      amplitudes, then diffusion D = 2|s><s| - I), success = sum of marked
 *      amplitudes squared.
 * They must agree to machine precision — this is the three-way referee
 * (closed form / simulation / classical exhaustive) behind every "quantum
 * upper bound" certificate in the atlas.
 */

export function groverTheta(N: number, t: number): number {
  return Math.asin(Math.sqrt(t / N));
}

export function groverSuccessClosedForm(N: number, t: number, k: number): number {
  return Math.sin((2 * k + 1) * groverTheta(N, t)) ** 2;
}

export function groverSuccessExact(N: number, marked: readonly number[], k: number): number {
  for (const x of marked) {
    if (!Number.isInteger(x) || x < 0 || x >= N) {
      throw new Error(`groverSuccessExact: marked address ${x} outside [0, ${N})`);
    }
  }
  const psi = new Float64Array(N).fill(1 / Math.sqrt(N));
  for (let iter = 0; iter < k; iter++) {
    for (const x of marked) psi[x] = -psi[x]!;
    let mean = 0;
    for (let i = 0; i < N; i++) mean += psi[i] as number;
    mean /= N;
    for (let i = 0; i < N; i++) psi[i] = 2 * mean - (psi[i] as number);
  }
  let s = 0;
  for (const x of marked) s += (psi[x] as number) ** 2;
  return s;
}

/** k maximizing the closed-form success (searched over the natural range). */
export function optimalK(N: number, t: number): number {
  const theta = groverTheta(N, t);
  const hi = Math.ceil(Math.PI / (4 * theta)) + 3;
  let best = 0;
  let bestP = -1;
  for (let k = 0; k <= hi; k++) {
    const p = groverSuccessClosedForm(N, t, k);
    if (p > bestP) {
      bestP = p;
      best = k;
    }
  }
  return best;
}

export interface GroverRun {
  N: number;
  t: number;
  k: number;
  successClosedForm: number;
  successExact: number;
  /** Classical best deterministic success with the same query budget (q/N). */
  classicalSameQueries: number;
}

export function groverRun(N: number, marked: readonly number[]): GroverRun {
  const t = marked.length;
  const k = optimalK(N, t);
  return {
    N,
    t,
    k,
    successClosedForm: groverSuccessClosedForm(N, t, k),
    successExact: groverSuccessExact(N, marked, k),
    classicalSameQueries: Math.min(k, N) / N,
  };
}
