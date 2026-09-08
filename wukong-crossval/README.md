# wukong-crossval

**The hardware path's executable half: the local-exact-engine vs real-QPU cross-validation pipeline, built to the machine-time application's own specification.**

The Wukong-180 application's sole purpose: verify the platform's optimality hit rates on real noisy hardware, with **all variational parameters optimized offline** and machine time spent only on verification sampling. This repo is that experiment, ready to run the day the hours are granted:

- **X1 — the instance set**: 20 seeded instances at 8/12/16/20 qubits (5 linear + 15 NP-hard coupled), every optimum by **exhaustive enumeration** — the only referee this repo trusts — with the linear optima verified on a second path (separable argmax, exact match).
- **X2 — offline-only optimization**: exact-statevector QAOA (p=1..3), effort tiered by size; the dry-run QPU never feeds back into optimization (the application's core machine-time-saving design). Anchors: p=0 expectation = mean cost to 1e-12; norm 1 at every layer count.
- **X3 — the dry-run QPU**: sample the optimized state, symmetric per-qubit readout flips (provenance stated), report raw / observed / calibrated hit rates. At zero noise, observed === raw within MC error; the calibrated rate inverts the stay probability.
- **X4 — the export format**: Qiskit-compatible JSON circuits (offline angles + cost coefficients + shots), deterministic from the seeds; the Sinan-toolchain adaptation point is the documented consumer.
- **X5 — the falsifier, as the application states it**: if the hit rate decays at the noise boundary, the decay scaling IS the result. The pipeline reports hit rates as found — the probe instance's 0.35–0.47% single-shot p=1 rate ships as-is, with the parameter-candidate × layer × seed arm priced at 10–20 hours in the application.
- **X6 — the power-analysis layer (v0.2.0)**: the calibration stage's arithmetic, computed BEFORE machine time — the minimum shots to distinguish the model-predicted hit-rate change from the no-change null at α=0.05 with power 0.80/0.90, per instance × noise level × effect size. Exact binomial critical regions in log space; the Chernoff sufficient bound machine-verified on every row; rows beyond the 1e7-shot cap are censored and say so. The exact kernel's own finding: the predicted sign is **not always decay** — at small n and low noise the model predicts inflow through the Hamming-1 shell, and the table prices both tails. Headline (as found): at the offline p=1 parameters, n=20 hit rates sit at ~1.2× the uniform floor, so full-decay detection there costs ≥1e9 shots — the arithmetic justification for the application's parameter-candidate × layer × seed arm.
- **X7 — the parameter-robustness census (v0.2.0)**: how far does offline optimality survive? Coordinate perturbation grid (δ = 0.01–0.25 rad) around every offline optimum at the depths already used, the objective's curvature as data, and the predicted on-QPU degradation band under the synthetic readout model — exact Hamming-shell convolution, no Monte Carlo. Anchors: f=0 → |ψ_opt|², f=1/2 → 1/2ⁿ, and agreement with the dry-run sampler within MC error.
- **X8 — the falsifier sharpened (v0.2.0)**: one more discriminating statistic — readout flips vs global depolarizing, each fitted to the same predicted hit-rate change, their Hamming-1 shell predictions compared at the planned budgets. As data, as found: at inflated operating points no physical depolarizing fit exists (sign separates outright); at decay operating points separability dies with size — 4.7–10σ at n=12 (separable), 1.8–4.0σ at n=16 (borderline at f=0.01), 0.08–0.20σ at n=20 (NOT separable at any planned budget; ~100× the shots or a stronger statistic needed), and the readout fit is only locally unique.

## Honest boundary

The noise model is synthetic (symmetric flips) and says so — real readout confusion matrices arrive with the calibration stage of the granted hours. The n=20 universe (2²⁰ states) is enumerated in the repro and optimized at coarse tier in tests. The allocation table covers every instance at n ≤ 16 plus the coupled n=20 boundary probe; the remaining n=20 rows are priced out (~25 exact 2²⁰ optimizations per pass) and the exclusion is disclosed in the report. Nothing here touches the real machine; everything here runs the day it's available.

## Reproduce

```bash
npm ci
npm test        # 40/40 — instances, kernel machinery, power engine, tables, smuggling trials, discriminator, entry guard, the named error surface, hand-checkable gate anchors
npm run repro   # renders out/reports/the-xval-package.md (~2–4 min: full allocation table + census, every row re-checked)
```

## Anchors (v0.2.0's faces, verified from two independent sources each)

- Galda et al., "Similarity-Based Parameter Transferability in the Quantum Approximate Optimization Algorithm" — arXiv:2307.05420; Frontiers Quantum Sci. Technol. 2:1200975 (2023), DOI 10.3389/frqst.2023.1200975. Parameter transfer robustness is an empirical question — this census measures it in-repo.
- He, Shaydulin, Herman, Li, Raymond, Sureshbabu, Pistoia, "Parameter Setting Heuristics Make the QAOA Suitable for the Early Fault-Tolerant Era" — arXiv:2408.09538 (ICCAD 2024 session). Parameter concentration/transfer motivates offline-first optimization.
- Guo et al., "False Positives Raised by Quantum Readout Error Mitigation" — arXiv:2510.08687 (v1 2025, v5 2026). Mitigated rates can mislead — the power layer prices detection on raw observed rates with exact arithmetic before machine time.
- Exact binomial inference (Clopper–Pearson lineage) and Chernoff–Hoeffding bounds: classical statistics, implemented exactly in-repo (`src/kernel/power.ts`), no external numbers relied upon.
