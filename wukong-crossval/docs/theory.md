# Theory — the physical-verification step, executable half

## Scope alignment

The machine-time application (`本源悟空180机时申请书.md`) defines the experiment precisely: local exact engine vs real QPU, ≤20–24 qubits (classically exactly verifiable), parameters offline, verification sampling only, honest decay reporting at the noise boundary. This package implements that spec; it does not touch the DTC-clock milestone (#10) — the application does not cover a time-crystal experiment, and no claim is made here that #10 moved. What moved is the platform's physical-verification path (#03/#04's "物理实证" step).

## Design decisions

- **Enumeration as the only referee.** Optima by exhaustive sweep (2^n states, n ≤ 20); linear instances double-checked by the separable argmax — two independent paths, exact match required.
- **Statevector layout.** [real | imaginary] split layout in one Float64Array, dim = length >> 1 — the layout constant is shared by every kernel function; the first draft mixed layouts (allocating dim and indexing 2·dim), which produced NaN energies and was the delivery's first buried error.
- **Offline-only parameters (the application's core economy).** optimizeOffline evaluates exact expectations only; the sampling path (dry-run QPU) is downstream and never feeds back. Effort tiers: full grid + coordinate refine at n ≤ 12, grid at 16, coarse at 20 — the n=20 universe costs ~10⁶ amplitudes per evaluation.
- **Honest noise.** Symmetric per-qubit flips with stated probability; raw / observed / calibrated reported separately; the crude inversion (observed / stay, clamped) is labeled as such. Real confusion matrices are the calibration stage's job on the granted hours.

## The falsifier

The application's own honest boundary, executed: at 99% two-qubit fidelity the 20-qubit arm is the noise boundary data point; if hit rates decay with size and depth, the decay's scaling is the publishable result. The package therefore reports every instance's rate as found, with no selection — the same discipline the ledger enforces everywhere else.

## Citations

None new. The application document and the platform repo (ds_extracted/ds) are the anchored sources; QAOA references remain in-book from the platform's bibliography.
