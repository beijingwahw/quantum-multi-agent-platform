export interface CxVec {
    readonly re: Float64Array;
    readonly im: Float64Array;
}
/** Success probability of k Grover iterates with good fraction p (2-plane closed form). */
export declare function groverSuccessClosedForm(p: number, k: number): number;
/** Full-space Grover simulation over N = 2^q items, t of them marked. Referee for the closed form. */
export declare function groverFullSpace(q: number, marked: readonly number[], k: number): number;
/** Distribution of QPE register outcomes j for amplitude estimation of p with m phase qubits. */
export declare function qaeDistribution(p: number, m: number): Float64Array;
/** p_hat value for register outcome j. */
export declare function qaeEstimate(j: number, m: number): number;
/** Median absolute error of QAE with m phase qubits for true amplitude p. */
export declare function qaeMedianError(p: number, m: number): number;
/** Oracle queries used by one QAE run with m phase qubits (controlled powers 2^0..2^{m-1}). */
export declare function qaeQueries(m: number): number;
/** Monte Carlo median absolute error for estimating p with s samples, over trials runs. */
export declare function mcMedianError(p: number, s: number, trials: number, seed: number): number;
