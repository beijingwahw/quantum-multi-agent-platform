/**
 * The BBBV hybrid argument, executed instead of cited
 * (Bennett-Bernstein-Brassard-Vazirani, SIAM J. Comput. 26(5):1510-1523,
 * 1997; quant-ph/9701001).
 *
 * For a search space of size N with a single marked item x, compare the exact
 * evolution under oracle O_x against the oracle-free evolution (O = I), both
 * driven by the Grover schedule (the argument holds for ANY unitary query
 * algorithm; the Grover schedule is the extremal witness we can execute):
 *
 *   Lemma (hybrid):  || psi_q^x - psi_q^0 ||_2 <= 2q / sqrt(N)
 *   Corollary:       |<x|psi_q^x>|^2 <= (1/sqrt(N) + 2q/sqrt(N))^2 = (2q+1)^2 / N
 *
 * Both sides are computed in exact float64 linear algebra over the actual
 * state vectors, for ALL x and a full grid of q — so the "(2q+1)^2/N cap"
 * certificate in the atlas is a checked inequality on real evolutions, not a
 * quotation. Exact anchor: at q = 1 the hybrid distance equals 2/sqrt(N)
 * to machine precision (one query displaces the state by exactly the flipped
 * amplitude pair), a closed-form hit the referee asserts separately.
 */

export interface BbbvCheck {
  N: number;
  q: number;
  maxDist: number;
  hybridBound: number;
  maxSuccess: number;
  corollaryBound: number;
  lemmaHolds: boolean;
  corollaryHolds: boolean;
  tightness: number; // maxDist / (2q/sqrt(N))
}

function evolve(N: number, x: number, q: number): Float64Array {
  const psi = new Float64Array(N).fill(1 / Math.sqrt(N));
  for (let iter = 0; iter < q; iter++) {
    // callers pass x in [0, N) or -1 for the oracle-free reference
    if (x >= 0) psi[x] = -psi[x]!;
    let mean = 0;
    for (let i = 0; i < N; i++) mean += psi[i] as number;
    mean /= N;
    for (let i = 0; i < N; i++) psi[i] = 2 * mean - (psi[i] as number);
  }
  return psi;
}

export function bbbvCheck(N: number, q: number, tol = 1e-12): BbbvCheck {
  const ref = evolve(N, -1, q); // oracle-free reference
  const hybridBound = (2 * q) / Math.sqrt(N);
  const corollaryBound = (2 * q + 1) ** 2 / N;
  let maxDist = 0;
  let maxSuccess = 0;
  for (let x = 0; x < N; x++) {
    const psi = evolve(N, x, q);
    let d2 = 0;
    for (let i = 0; i < N; i++) {
      const d = (psi[i] as number) - (ref[i] as number);
      d2 += d * d;
    }
    maxDist = Math.max(maxDist, Math.sqrt(d2));
    maxSuccess = Math.max(maxSuccess, (psi[x] as number) ** 2);
  }
  return {
    N,
    q,
    maxDist,
    hybridBound,
    maxSuccess,
    corollaryBound,
    lemmaHolds: maxDist <= hybridBound + tol,
    corollaryHolds: maxSuccess <= corollaryBound + tol,
    tightness: maxDist / hybridBound,
  };
}

/** The q = 1 exact anchor: distance is exactly 2/sqrt(N). */
export function bbbvExactAnchor(N: number, tol = 1e-12): boolean {
  const c = bbbvCheck(N, 1);
  return Math.abs(c.maxDist - 2 / Math.sqrt(N)) <= tol;
}
