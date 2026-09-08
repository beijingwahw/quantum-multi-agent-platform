/** Solve A x = b for a square nonsingular A. A is consumed (factored in place); b is copied. */
export declare function luSolve(n: number, a: Float64Array, b: Float64Array): Float64Array;
/** Expected hitting time of a Markov chain to an absorbing target SET, from a start distribution.
 *
 * The chain is given as a row-stochastic matrix P (row-major n x n) over states
 * 0..n-1; target states are absorbing. Solves the standard fundamental-matrix
 * system over transient states; returns the expected number of steps weighted
 * by startMu (mass on targets contributes 0: already absorbed).
 */
export declare function hittingTime(n: number, p: Float64Array, targets: ReadonlySet<number>, startMu: Float64Array): number;
/** Eigenvalues (ascending) of a real symmetric n x n matrix via cyclic Jacobi. Consumes a copy. */
export declare function jacobiEigenvalues(n: number, matrixIn: Float64Array, sweeps?: number): Float64Array;
