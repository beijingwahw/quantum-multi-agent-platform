# Experiment 5 — Tensor-network scaling: sign structure at n up to 64

Open nearest-neighbor chains (exact diagonalization caps at n≈13; DMRG χ≤48 extends to 64).
Sign metric P̂ = Σ_sampled ψ / Σ_sampled |ψ| (global sign fixed so P̂ ≥ 0), K=1000 samples.
Regenerate: `npm run exp:scale`.

| n | kappa | E0 (variational) | sign P̂ | negative fraction | max bond | wall ms |
|---|---|---|---|---|---|---|
| 16 | 0.0 | -9.2722 | 1.0000 | 0.000 | 48 | 6078 |
| 16 | 0.5 | -8.9401 | 1.0000 | 0.000 | 48 | 5889 |
| 16 | 1.0 | -7.1453 | 0.5187 | 0.501 | 48 | 5990 |
| 24 | 0.0 | -12.6736 | 1.0000 | 0.000 | 48 | 12635 |
| 24 | 0.5 | -10.3377 | 1.0000 | 1.000 | 48 | 13114 |
| 24 | 1.0 | -4.8167 | 0.2632 | 0.489 | 48 | 13344 |
| 32 | 0.0 | -18.2514 | 1.0000 | 1.000 | 48 | 16810 |
| 32 | 0.5 | -18.6634 | 1.0000 | 0.000 | 48 | 16689 |
| 32 | 1.0 | -13.6124 | 0.9555 | 0.516 | 48 | 19338 |
| 48 | 0.0 | -27.4557 | 1.0000 | 0.000 | 48 | 28383 |
| 48 | 0.5 | -27.4274 | 1.0000 | 0.000 | 48 | 30023 |
| 48 | 1.0 | -25.5787 | 1.0000 | 1.000 | 48 | 27896 |
| 64 | 0.0 | -33.3938 | 1.0000 | 1.000 | 48 | 39330 |
| 64 | 0.5 | -33.4653 | 1.0000 | 1.000 | 48 | 40566 |
| 64 | 1.0 | -12.0571 | 0.8531 | 0.460 | 48 | 39856 |

Referee anchoring (test/tn.test.ts): DMRG energy matches imaginary-time projection at
n=8/10/12 within 2e-3 (χ-truncation); stoquastic amplitudes are single-signed (Perron-
Frobenius) at n=20; κ=0.5 develops negative amplitudes at n=20.
