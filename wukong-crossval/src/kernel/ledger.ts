/**
 * The cross-validation ledger — the hardware path's executable half, per the
 * application's own specification.
 */

export type Exactness = "EXACT" | "DATA";

export interface XvalRow {
  readonly id: string;
  readonly claim: string;
  readonly price: string;
  readonly exactness: Exactness;
  readonly witness: string;
  readonly anchors: readonly string[];
}

export const QUOTED_INSTANCES = 20;
export const QUOTED_LINEAR = 5;
export const QUOTED_COUPLED = 15;
export const QUOTED_P0_TOL = 1e-12;

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
    price: "as data, as found (planned budget = the allocation table's N*, or the 1e7 cap where censored): at inflated operating points the depolarizing fit is unphysical (lambda > 1) and the sign of the change separates the models outright; at decay operating points the shell-1 gap is 4.7-10 sigma at the n=12 probe (separable), 1.8-4.0 sigma at n=16 (borderline at f=0.01, separable at f>=0.02), and 0.08-0.20 sigma at n=20 — NOT separable at any planned budget, and discrimination there needs ~100x the shots or a stronger statistic; the readout fit is only locally unique (a spurious global root at f=0.368 reproduces r(0.02) on the n=8 probe), disclosed as a boundary of the statistic",
    exactness: "DATA",
    witness: "W-H",
    anchors: ["ds_extracted/ds"],
  },
];
