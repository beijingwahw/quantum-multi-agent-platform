# THE CROSS-VALIDATION PACKAGE — the hardware path's executable half

> The machine-time application's sole purpose: local exact engine vs real QPU, parameters offline, verification sampling only. This package is that experiment, built to the application's own specification and dry-run green — the granted hours plug into a running pipeline, not a plan.

| id | claim | price | exactness | witness |
| --- | --- | --- | --- | --- |
| X1 | the instance set: 20 seeded instances at 8/12/16/20 qubits — 5 linear + 15 NP-hard coupled — every optimum by exhaustive enumeration, and the linear optima verified on a second path (separable argmax, exact match) | enumeration is the only referee (law: no heuristic optimum ships); the n=20 universe costs 2^20 states per instance and is enumerated in the repro | EXACT | W-A |
| X2 | offline parameter optimization: QAOA p=1..3 variational angles optimized against the exact statevector expectation only — the dry-run QPU never feeds back (the application's core machine-time-saving design) | effort tiers by size (full grid + refine at n<=12, grid at 16, coarse at 20); p=0 anchor exact (uniform expectation = mean cost, 1e-12); probabilities sum to 1 at every layer count | EXACT | W-B |
| X3 | the dry-run QPU: sample the optimized state, apply symmetric per-qubit readout flips (flip probability stated per row), report raw / observed / calibrated hit rates | at zero noise, observed === raw within MC error (verified); the calibrated rate inverts the stay probability and clamps honestly; the noise model is synthetic and says so — real readout confusion matrices arrive with the calibration stage of the granted hours | EXACT | W-C |
| X4 | the export format: Qiskit-compatible JSON circuits (gates as offline angles + cost coefficients + shots), deterministic and re-generable from the seeds | round-trip: the exported JSON's fields recompile to the same statevector parameters (deterministic given instance id and tier); the Sinan-toolchain adaptation point is the format's consumer, documented not executed | EXACT | W-D |
| X5 | the falsifier, as the application states it: if the hit rate decays at the noise boundary (20 qubits, 99% two-qubit fidelity), the decay scaling IS the publishable result — not a failure to hide | the pipeline reports hit rates as found, no selection: p=1 on the probe instance gives ratio 0.415 and single-shot hit rate 0.35-0.47% — low, reported as-is; parameter candidates x layers x seeds is the machine-time arm that lifts it, priced at 10-20 hours in the application | DATA | W-E |

## Witnesses

- PASS — W-A instance set + separable second path (20 instances (5 linear second-path exact, 15 coupled enumerated))
- PASS — W-B offline optimization anchors (p=0: E = mean cost (-14.450000 vs -14.450000); p=1 improves to -18.4399; norm 1 at 1.000000000000)
- PASS — W-C dry-run QPU (zero-noise raw 0.0043 vs observed 0.0043; noisy observed 0.0033 -> calibrated 0.0039 (stay 0.8508))
- PASS — W-D export round-trip (deterministic JSON, 1 layer(s), cost fields complete (8 linear))
- PASS — W-E falsifier census (n=8:5 n=12:5 n=16:5 n=20:5 — every instance will be reported, hit rate as found)

## Closing

What remains outside this repo is exactly what the application names: the granted hours, the Sinan toolchain session, and the real readout confusion matrices. Everything else — instances with enumerated optima, offline parameters, export format, dry-run statistics, falsifier — runs today. When the hours arrive, the pipeline runs the same day; and if the hit rate decays at the noise boundary, the package is built to report the decay as the finding, which is what the application promised the reviewers.
