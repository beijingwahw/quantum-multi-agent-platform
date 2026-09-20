/**
 * The cross-validation ledger — the hardware path's executable half, per the
 * application's own specification.
 */

/** How a price was established: exact arithmetic, or measured data. */
export type Exactness = "EXACT" | "DATA";

/** One line of the ledger: a claim, its price, tag, witness, and anchors. */
export interface XvalRow {
  readonly id: string;
  readonly claim: string;
  readonly price: string;
  readonly exactness: Exactness;
  readonly witness: string;
  readonly anchors: readonly string[];
}

/** Headline constants — the witnesses re-derive these, never copy. */
export const QUOTED_INSTANCES = 20;
export const QUOTED_LINEAR = 5;
export const QUOTED_COUPLED = 15;
export const QUOTED_P0_TOL = 1e-12;

/** The ledger itself — X1 through X8, the rows the checker must clear. */
export const XVAL: readonly XvalRow[] = [
  {
    id: "X1",
    claim: "the instance set: 20 seeded instances at 8/12/16/20 qubits — 5 linear + 15 NP-hard coupled — every optimum by exhaustive enumeration, and the linear optima verified on a second path (separable argmax, exact match)",
    price: "enumeration is the only referee (law: no heuristic optimum ships); the n=20 universe costs 2^20 states per instance and is enumerated in the repro",
    exactness: "EXACT",
    witness: "W-A",
    anchors: ["ds_extracted/ds"],
  },
  {
    id: "X2",
    claim: "offline parameter optimization: QAOA p=1..3 variational angles optimized against the exact statevector expectation only — the dry-run QPU never feeds back (the application's core machine-time-saving design)",
    price: "effort tiers by size (full grid + refine at n<=12, grid at 16, coarse at 20); p=0 anchor exact (uniform expectation = mean cost, 1e-12); probabilities sum to 1 at every layer count",
    exactness: "EXACT",
    witness: "W-B",
    anchors: ["ds_extracted/ds"],
  },
  {
    id: "X3",
    claim: "the dry-run QPU: sample the optimized state, apply symmetric per-qubit readout flips (flip probability stated per row), report raw / observed / calibrated hit rates",
    price: "at zero noise, observed === raw within MC error (verified); the calibrated rate inverts the stay probability and clamps honestly; the noise model is synthetic and says so — real readout confusion matrices arrive with the calibration stage of the granted hours",
    exactness: "EXACT",
    witness: "W-C",
    anchors: ["ds_extracted/ds"],
  },
  {
    id: "X4",
    claim: "the export format: Qiskit-compatible JSON circuits (gates as offline angles + cost coefficients + shots), deterministic and re-generable from the seeds",
    price: "round-trip: the exported JSON's fields recompile to the same statevector parameters (deterministic given instance id and tier); the Sinan-toolchain adaptation point is the format's consumer, documented not executed",
    exactness: "EXACT",
    witness: "W-D",
    anchors: ["ds_extracted/ds"],
  },
  {
    id: "X5",
    claim: "the falsifier, as the application states it: if the hit rate decays at the noise boundary (20 qubits, 99% two-qubit fidelity), the decay scaling IS the publishable result — not a failure to hide",
    price: "the pipeline reports hit rates as found, no selection: p=1 on the probe instance gives ratio 0.415 and single-shot hit rate 0.35-0.47% — low, reported as-is; parameter candidates x layers x seeds is the machine-time arm that lifts it, priced at 10-20 hours in the application",
    exactness: "DATA",
    witness: "W-E",
    anchors: ["ds_extracted/ds"],
  },
  {
    id: "X6",
    claim: "the power-analysis layer: the minimum shots to distinguish the model-predicted hit-rate change from the no-change null at significance 0.05 with power 0.80/0.90 — per instance x noise level x effect size, computed BEFORE machine time (the calibration stage's own arithmetic)",
    price: "exact binomial critical regions in log space; N* under the scan definition (doubling + bisection + bounded walk-down) with local minimality machine-verified on every row (power(N*) >= 1-beta AND power(N*-1) < 1-beta); the Chernoff sufficient bound ships per row and its sufficiency is machine-verified (648/648 rows as rendered); rows beyond the 1e7 cap are censored and say so with the bound still attached; the exact kernel found the predicted sign is not always decay — at small n and low noise the model predicts inflow through the Hamming-1 shell, and the table prices both tails; scope: all n<=16 instances + the coupled n=20 boundary probe, the remaining n=20 rows are priced out (~25 exact 2^20 optimizations per pass) and the exclusion is disclosed, not hidden",
    exactness: "EXACT",
    witness: "W-F",
    anchors: ["ds_extracted/ds"],
  },
  {
    id: "X7",
    claim: "the parameter-robustness census: a coordinate perturbation grid around every offline optimum (deltas 0.01/0.05/0.1/0.25 rad, depths 1..3 where the optimizer refines, depth 1 on grid/coarse tiers), the objective's curvature as data, and the predicted on-QPU degradation band under the synthetic readout model — exact Hamming-shell convolution, no Monte Carlo",
    price: "every census row is recomputed by the checker (law X7: fake curvature is named and rejected); the exact convolution anchors at f=0 (rate === |psi_opt|^2), f=1/2 (rate === 1/2^n), and against the dry-run sampler within MC error; the band is model-conditional (synthetic flips, provenance X3) and is labeled as such — real confusion matrices are the calibration stage's job; as found: the shipped parameters are grid+refine bests, NOT stationary points — probes finer than the optimizer's own move sizes find slack (0.23% of |E*| at p=1 on the probe; 3-5% at p>=2, where the refine scales moves by 1/p and raw +-0.1 was never probed), reported as negative gains, never hidden",
    exactness: "EXACT",
    witness: "W-G",
    anchors: ["ds_extracted/ds"],
  },
  {
    id: "X8",
    claim: "the falsifier sharpened: one more discriminating statistic — readout flips vs global depolarizing, each fitted to the same predicted hit-rate change, their Hamming-1 shell predictions compared at the planned budgets",
    price: "as data, as found (planned budget = the allocation table's N*, or the 1e7 cap where censored): at inflated operating points the depolarizing fit is unphysical (lambda > 1) and the sign of the change separates the models outright; at decay operating points the shell-1 gap is 4.7-10 sigma at the n=12 probe (separable), 1.8-4.0 sigma at n=16 (borderline at f=0.01, separable at f>=0.02), and 0.08-0.20 sigma at n=20 — NOT separable at any planned budget, and discrimination there needs ~100x the shots or a stronger statistic; v0.4.0 closes the disclosed boundary: the observed rate is an exact degree-<=n polynomial in lambda = 1-2f, and the Bernstein-certificate root census maps the fit's non-uniqueness completely — the n=8 probe carries exactly TWO roots at every operating point (the stated f and a theorem-predicted global second root at f = 0.388 / 0.368 / 0.315 for f = 0.01 / 0.02 / 0.05 — the previously disclosed ~0.368 was this polynomial's root, not numerical noise), while n=12/16/20 carry exactly one root each (locally unique AND globally unique there); every enrolled root is certified by a single Bernstein sign change on its grid pair, bracketed to width <= 1e-9, cross-counted by an independent dense-grid sign-flip path",
    exactness: "DATA",
    witness: "W-H",
    anchors: ["ds_extracted/ds"],
  },
  {
    id: "X9",
    claim: "the information bound: distinguishing readout flips from global depolarizing on the Hamming-shell face (one shell label per shot — the face X8's own statistic consumes) — NO N-shot discriminator's error falls below (1/2)e^{-N C(P,Q)}, C the Chernoff information of the two fitted shell distributions, and the table prices X8's 2-sigma shell-1 budget against that floor row by row",
    price: "the Chernoff information computed exactly: golden-section minimization of the convex log-sum-exp objective on [0,1] (Holder gives the convexity, so the minimum is machine-pinned); the floor's own budget N_info = ceil(ln(2/0.05)/C); as found on the four size probes x three boundary flips: the n=8 rows are all sign-separated outright (lambda > 1 inflation, no bound columns — reported, never invented), and at the physical rows C spans 3.7e-6..6.4e-9 falling with size, N_info spans 1.1e5..5.8e8, and the efficiency ratio (2-sigma budget over the floor) is 1.82-2.56x at n=12/16 but 9.6-10.8x at n=20 — the arithmetic content of X8's '~100x the shots or a stronger statistic': even the optimal shell-face statistic can only recover about a factor of ten at n=20, not the hundred the simple statistic asks; a coincident shell pair (C -> 0) is rejected by name (the bound is infinite — the degeneracy is the finding); the Monte Carlo likelihood-ratio discriminator under either truth sits at or above the bound within 5 sigma_mc on the fixed demo (np-n12-4, f=0.05, 40 shots/trial, 2000 trials)",
    exactness: "EXACT",
    witness: "W-I",
    anchors: ["ds_extracted/ds"],
  },
];
