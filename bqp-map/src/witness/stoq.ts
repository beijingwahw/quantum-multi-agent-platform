/**
 * Stoquasticity as a machine-checkable complexity boundary.
 *
 * A Hamiltonian is stoquastic in the computational basis iff every
 * off-diagonal matrix element is <= 0. The dichotomy that matters for the
 * atlas (Bravyi-DiVincenzo-Oliveira-Terhal, QIC 8(5):361-385, 2008,
 * quant-ph/0606140; KKR06 for the general side):
 *
 *   H = sum J_ij Z_i Z_j + sum h_i Z_i - Gamma sum X_i
 *       (the annealing-machine regime: ZZ couplers of ANY sign + a negative
 *       transverse-field driver) is stoquastic: the ZZ and Z parts are
 *       diagonal, the only off-diagonal entries come from -Gamma X_i and are
 *       exactly -Gamma < 0. Its ground-state verification sits in StoqMA.
 *
 *   H' = H + kappa sum_(i,j in E) X_i X_j  with kappa > 0 (the non-stoquastic
 *       driver of roadmap #2) has off-diagonal entries exactly +kappa > 0 on
 *       the XX edges — non-stoquastic for ANY Gamma, and the 2-local term
 *       family is QMA-complete (KKR06). The sign structure is precisely what
 *       lifts the verification class from StoqMA towards QMA, and it is the
 *       same sign structure that builds the classical-simulation barrier
 *       measured in nonstoq-anneal (exp5: 46-52% negative amplitudes at
 *       n=64).
 *
 * Both statements are executed below as exact dense-matrix checks with
 * closed-form anchors: maxOffDiag(stoq) = -Gamma and maxOffDiag(nonstoq) =
 * +kappa, exactly, for all random J/h signs.
 */

export type DenseMatrix = readonly Float64Array[];

export function maxOffDiagonal(H: DenseMatrix): number {
  let mx = -Infinity;
  const dim = H.length;
  for (let i = 0; i < dim; i++) {
    for (let j = 0; j < dim; j++) {
      if (i !== j) mx = Math.max(mx, H[i]![j]!);
    }
  }
  return mx;
}

/**
 * Maximum over NONZERO off-diagonal entries. Dense matrices here are sparse
 * (ZZ is diagonal), so plain maxOffDiagonal returns 0 (the dominant zeros);
 * the stoquasticity anchor lives on the nonzero support.
 */
export function maxNonzeroOffDiagonal(H: DenseMatrix, tol = 1e-12): number {
  let mx = -Infinity;
  const dim = H.length;
  for (let i = 0; i < dim; i++) {
    for (let j = 0; j < dim; j++) {
      if (i !== j && Math.abs(H[i]![j]!) > tol) mx = Math.max(mx, H[i]![j]!);
    }
  }
  return mx === -Infinity ? 0 : mx;
}

export function isStoquastic(H: DenseMatrix, tol = 1e-12): boolean {
  return maxOffDiagonal(H) <= tol;
}

/** ZZ couplings (any sign) + local fields (any sign) - Gamma X_i. */
export function buildStoqAnnealer(
  n: number,
  J: ReadonlyArray<{ i: number; j: number; w: number }>,
  h: readonly number[],
  Gamma: number,
): DenseMatrix {
  const dim = 2 ** n;
  const H: Float64Array[] = [];
  for (let r = 0; r < dim; r++) H.push(new Float64Array(dim));
  for (let y = 0; y < dim; y++) {
    let diag = 0;
    for (const { i, j, w } of J) {
      const zi = ((y >> i) & 1) === 1 ? -1 : 1;
      const zj = ((y >> j) & 1) === 1 ? -1 : 1;
      diag += w * zi * zj;
    }
    for (let i = 0; i < n; i++) {
      const zi = ((y >> i) & 1) === 1 ? -1 : 1;
      diag += (h[i] as number) * zi;
      const y2 = y ^ (1 << i);
      H[y]![y2]! -= Gamma;
    }
    H[y]![y]! += diag;
  }
  return H;
}

/** The same annealer + kappa * X_i X_j on the given edges. */
export function buildNonStoqAnnealer(
  n: number,
  J: ReadonlyArray<{ i: number; j: number; w: number }>,
  h: readonly number[],
  Gamma: number,
  kappa: number,
  xxEdges: ReadonlyArray<{ i: number; j: number }>,
): DenseMatrix {
  const H = buildStoqAnnealer(n, J, h, Gamma);
  const dim = 2 ** n;
  for (let y = 0; y < dim; y++) {
    for (const { i, j } of xxEdges) {
      const y2 = y ^ (1 << i) ^ (1 << j);
      H[y]![y2]! += kappa;
    }
  }
  return H;
}

export interface StoqVerdict {
  stoqMaxOffDiag: number;
  nonStoqMaxOffDiag: number;
  expectedStoq: number; // -Gamma
  expectedNonStoq: number; // +kappa
  dichotomyHolds: boolean;
}

/** Run the dichotomy check on random sign patterns; asserts exact anchors. */
export function stoqDichotomy(
  n: number,
  Gamma: number,
  kappa: number,
  instances: ReadonlyArray<{ J: ReadonlyArray<{ i: number; j: number; w: number }>; h: readonly number[]; xx: ReadonlyArray<{ i: number; j: number }> }>,
  tol = 1e-12,
): StoqVerdict {
  let stoqMax = -Infinity;
  let nonStoqMax = -Infinity;
  for (const { J, h, xx } of instances) {
    stoqMax = Math.max(stoqMax, maxNonzeroOffDiagonal(buildStoqAnnealer(n, J, h, Gamma)));
    nonStoqMax = Math.max(nonStoqMax, maxOffDiagonal(buildNonStoqAnnealer(n, J, h, Gamma, kappa, xx)));
  }
  const dichotomyHolds =
    Math.abs(stoqMax - -Gamma) <= tol && Math.abs(nonStoqMax - kappa) <= tol;
  return { stoqMaxOffDiag: stoqMax, nonStoqMaxOffDiag: nonStoqMax, expectedStoq: -Gamma, expectedNonStoq: kappa, dichotomyHolds };
}
