/**
 * The census tolerance — the single source. Every two-path float comparison
 * in the kernels, the experiments and the tests holds against THIS value;
 * a second copy would fork the standard the repo is held to (all merged
 * copies were the identical literal 1e-12, so the merge is value-free).
 *
 * Deliberately NOT this constant: the 1e-10 loop-referee allowance of
 * witness W-F (plain accumulation drift at moderate P) and the 1e-9
 * strictness margin of the phase census (S7) — different semantics, own
 * values.
 */
export const TOL = 1e-12;
