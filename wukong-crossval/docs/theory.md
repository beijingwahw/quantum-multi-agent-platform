# Theory — the physical-verification step, executable half

## Scope alignment

The machine-time application (`本源悟空180机时申请书.md`) defines the experiment precisely: local exact engine vs real QPU, ≤20–24 qubits (classically exactly verifiable), parameters offline, verification sampling only, honest decay reporting at the noise boundary. This package implements that spec; it does not touch the DTC-clock milestone (#10) — the application does not cover a time-crystal experiment, and no claim is made here that #10 moved. What moved is the platform's physical-verification path (#03/#04's "物理实证" step).

## Design decisions

- **Enumeration as the only referee.** Optima by exhaustive sweep (2^n states, n ≤ 20); linear instances double-checked by the separable argmax — two independent paths, exact match required.
- **Statevector layout.** [real | imaginary] split layout in one Float64Array, dim = 2^n — every kernel function reads the split through the single layout accessor `dimOf` (and basis-state probabilities through `probOf`); the first draft mixed layouts (allocating dim and indexing 2·dim), which produced NaN energies and was the delivery's first buried error.
- **Mixer sign convention (disclosed, hand-anchored).** `applyRX` applies e^{+i(θ/2)X} — the conjugate of the textbook RX(θ) = e^{-i(θ/2)X}. The offline optimizer searches β freely, so the achievable circuit family is closed under the conjugation (β → −β) and every shipped number is self-consistent in THIS convention (the test suite's hand-checkable anchor pins amp(|1>) = +i at θ = π, not textbook's −i). Consequence for the hardware day: the X4 circuit export's β must be consumed with the same sign, or the QPU circuit differs from the dry-run by conjugated mixer layers.
- **Offline-only parameters (the application's core economy).** optimizeOffline evaluates exact expectations only; the sampling path (dry-run QPU) is downstream and never feeds back. Effort tiers: full grid + coordinate refine at n ≤ 12, grid at 16, coarse at 20 — the n=20 universe costs ~10⁶ amplitudes per evaluation.
- **Honest noise.** Symmetric per-qubit flips with stated probability; raw / observed / calibrated reported separately; the crude inversion (observed / stay, clamped) is labeled as such. Real confusion matrices are the calibration stage's job on the granted hours.
- **The exact probe (v0.2.0).** One (instance, depth) optimized statevector with its cost table and Hamming-distance masses, memoized per process. Pure deterministic kernel arithmetic — the memo pays the 2^n optimization once; every claimed field the checkers verify is still recomputed from the probe. The n=20 probe costs ~25 exact evaluations at 2²⁰ amplitudes per pass, which is why the allocation table carries one coupled n=20 boundary probe with the exclusion priced and disclosed.

## The power-analysis layer (X6)

The calibration stage needs shot budgets before machine time. For each instance × flip level × effect size × power target: H0 is the exact-engine prediction p0 = |ψ_opt|²; H1 is the model-predicted observed rate p1 under the synthetic readout model (computed EXACTLY by Hamming-shell convolution — `exactObservedHitRate` — no Monte Carlo), scaled along the effect axis (1 = full predicted change, 0.5, 0.25 = the pessimistic axis). The test is the exact one-sided binomial tail test at α=0.05; N* is found by doubling + bisection + a bounded walk-down (the scan definition, stated), and local minimality is machine-verified per row: power(N*) ≥ 1−β and power(N*−1) < 1−β. The Chernoff sufficient bound (midpoint threshold, KL form) ships per row; because {K/N beyond t} is exactly an integer-count event, the bound's region nests inside the exact critical region, so exact power at ceil(N_bound) ≥ 1−β — machine-verified on every row as rendered (648/648).

**The kernel's own finding:** the predicted sign is not always decay. At small n and low noise, the exact convolution says background inflow through the Hamming-1 shell beats outflow — the n=8 probe at f=0.02 predicts +7%. The engine prices both tails (the rejection region follows the predicted sign); the ledger says so. Second finding: at the offline p=1 parameters, n=20 hit rates sit at ~1.2× uniform, so full-decay detection costs ≥ 10⁹ shots — the table converts the application's "10–20 hours" into per-cell arithmetic and justifies the parameter-candidate × layer × seed arm as the only affordable path.

## The parameter-robustness census (X7)

Coordinate perturbation grid (δ = 0.01/0.05/0.1/0.25 rad) around every offline optimum at the depths already used; dE± and discrete curvature (E⁺ − 2E* + E⁻)/δ² as data; the predicted degradation band is the exact observed rate at the band edges f ∈ [0.01, 0.05]. Anchors: f=0 → |ψ_opt|² exactly; f=1/2 → 1/2ⁿ exactly; agreement with the dry-run sampler within MC error (the exact expectation of X3's Monte Carlo). The band is model-conditional (synthetic flips) and labeled as such.

## The falsifier sharpened (X8)

Readout flips vs global depolarizing can each reproduce the same hit-rate change, so the hit rate alone cannot tell them apart; they disagree on the Hamming-1 shell. Each model is fitted to the same predicted operating point (readout: sign-adaptive local bisection — the global curve is non-monotone, with a spurious root near f=0.37 that a naive fit would return; depolarizing: closed form), and the shell-1 predictions are compared against 2σ at the planned budget (the allocation table's N*, or the 1e7 cap where censored). As found: at inflated operating points the depolarizing λ exceeds 1 — unphysical, so the sign separates the models outright; at decay operating points separability dies with size: 4.7–10σ at n=12 (separable), 1.8–4.0σ at n=16 (borderline at f=0.01, separable at f≥0.02), 0.08–0.20σ at n=20 — not separable at any planned budget (σ ∝ 1/√N, so ~100× the shots would be needed). Honest negatives, reported.

## The falsifier

The application's own honest boundary, executed: at 99% two-qubit fidelity the 20-qubit arm is the noise boundary data point; if hit rates decay with size and depth, the decay's scaling is the publishable result. The package therefore reports every instance's rate as found, with no selection — the same discipline the ledger enforces everywhere else.

## Citations (v0.2.0 — identifiers verified from two independent sources each, never memory)

- A. Galda et al., "Similarity-Based Parameter Transferability in the Quantum Approximate Optimization Algorithm," arXiv:2307.05420 (2023); published as Frontiers in Quantum Science and Technology 2:1200975, DOI 10.3389/frqst.2023.1200975 [verified: arXiv abs page + Frontiers + Argonne LCF listing]. Anchor for treating parameter transfer/robustness as an empirical, measurable property; the census measures it in-repo.
- Z. He, R. Shaydulin, D. Herman, C. Li, R. Raymond, S. H. Sureshbabu, M. Pistoia, "Parameter Setting Heuristics Make the Quantum Approximate Optimization Algorithm Suitable for the Early Fault-Tolerant Era," arXiv:2408.09538 (Aug 2024; ICCAD 2024 special session) [verified: arXiv abs page + search aggregators]. Anchor for offline-first parameter setting.
- Y. Guo et al., "False Positives Raised by Quantum Readout Error Mitigation," arXiv:2510.08687 (v1 Oct 2025, v5 Jul 2026) [verified: arXiv abs page + search aggregators]. Anchor for pricing detection on raw observed rates with exact arithmetic rather than trusting mitigated estimates.
- Exact binomial tail tests (Clopper–Pearson lineage) and Chernoff–Hoeffding concentration: classical statistics, implemented exactly in `src/kernel/power.ts`; no external numeric constants relied upon.
- Methods adopted only where reproducible in-repo: all three faces are pure arithmetic on the exact statevector; no literature numbers enter any shipped row.

The application document and the platform repo (ds_extracted/ds) remain the anchored sources for the base package (X1–X5).
