# wukong-crossval

**The hardware path's executable half: the local-exact-engine vs real-QPU cross-validation pipeline, built to the machine-time application's own specification.**

The Wukong-180 application's sole purpose: verify the platform's optimality hit rates on real noisy hardware, with **all variational parameters optimized offline** and machine time spent only on verification sampling. This repo is that experiment, ready to run the day the hours are granted:

- **X1 — the instance set**: 20 seeded instances at 8/12/16/20 qubits (5 linear + 15 NP-hard coupled), every optimum by **exhaustive enumeration** — the only referee this repo trusts — with the linear optima verified on a second path (separable argmax, exact match).
- **X2 — offline-only optimization**: exact-statevector QAOA (p=1..3), effort tiered by size; the dry-run QPU never feeds back into optimization (the application's core machine-time-saving design). Anchors: p=0 expectation = mean cost to 1e-12; norm 1 at every layer count.
- **X3 — the dry-run QPU**: sample the optimized state, symmetric per-qubit readout flips (provenance stated), report raw / observed / calibrated hit rates. At zero noise, observed === raw within MC error; the calibrated rate inverts the stay probability.
- **X4 — the export format**: Qiskit-compatible JSON circuits (offline angles + cost coefficients + shots), deterministic from the seeds; the Sinan-toolchain adaptation point is the documented consumer.
- **X5 — the falsifier, as the application states it**: if the hit rate decays at the noise boundary, the decay scaling IS the result. The pipeline reports hit rates as found — the probe instance's 0.35–0.47% single-shot p=1 rate ships as-is, with the parameter-candidate × layer × seed arm priced at 10–20 hours in the application.

## Honest boundary

The noise model is synthetic (symmetric flips) and says so — real readout confusion matrices arrive with the calibration stage of the granted hours. The n=20 universe (2²⁰ states) is enumerated in the repro and optimized at coarse tier in tests. Nothing here touches the real machine; everything here runs the day it's available.

## Reproduce

```bash
npm ci
npm test        # 12/12 — instances, kernel machinery, NaN guards, dry-run, smuggling trials, entry guard
npm run repro   # renders out/reports/the-xval-package.md (seconds)
```
