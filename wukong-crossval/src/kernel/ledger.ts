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
];
