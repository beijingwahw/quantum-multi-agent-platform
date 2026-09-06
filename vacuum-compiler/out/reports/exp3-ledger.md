# EXP3 — the energy ledger

Units: bits of erasure (multiply by kT·ln2 for joules — LAND61).

## A. static ledger

| T | entropy log2(T+1) bits/attempt | expected erasure (T+1)·log2(T+1) bits |
| --- | --- | --- |
| 2 | 1.5850 | 4.75 |
| 3 | 2.0000 | 8.00 |
| 4 | 2.3219 | 11.61 |
| 5 | 2.5850 | 15.51 |
| 6 | 2.8074 | 19.65 |
| 7 | 3.0000 | 24.00 |
| 8 | 3.1699 | 28.53 |
| 9 | 3.3219 | 33.22 |
| 10 | 3.4594 | 38.05 |
| 11 | 3.5850 | 43.02 |
| 12 | 3.7004 | 48.11 |

Geometric mean cross-check at T=6: exact 7.00, MC 6.96.
Direct execution: T unitary gates, zero erasure — the comparison baseline.

## B. fuel: buying delivery probability

| eps/Delta | P(T) | conditional fidelity | infidelity | gap(eps) | oil bill eps·<D> |
| --- | --- | --- | --- | --- | --- |
| 0.00 | 0.142857 | 1.000000000000 | 0.00e+0 | 0.025072 | 0.000000 |
| 0.05 | 0.153011 | 1.000000000000 | 0.00e+0 | 0.023356 | 0.003886 |
| 0.10 | 0.163372 | 1.000000000000 | 0.00e+0 | 0.021733 | 0.008022 |
| 0.20 | 0.184466 | 1.000000000000 | 0.00e+0 | 0.018766 | 0.017022 |
| 0.40 | 0.226432 | 1.000000000000 | 0.00e+0 | 0.013888 | 0.037640 |
| 0.80 | 0.300357 | 1.000000000000 | 0.00e+0 | 0.007574 | 0.086203 |
| 1.60 | 0.398961 | 1.000000000000 | 0.00e+0 | 0.002443 | 0.194587 |

Machine-discovered law: the tilt -eps·sum t|t><t| ⊗ I closes on the
trajectory-covariant subspace exactly, so the ground state keeps the form
sum_t alpha_t(eps)·psi_t ⊗ |t> for EVERY tilt — conditional readout at
every clock step stays exact (verified step-by-step at eps = 1.6·Delta).
The price of oil is the closing spectral gap, not the cargo.

## C. the free clock walk

| t | P(clock = T) |
| --- | --- |
| 0 | 0.000000 |
| 1 | 0.000000 |
| 2 | 0.000002 |
| 3 | 0.000145 |
| 4 | 0.002952 |
| 5 | 0.024085 |
| 6 | 0.103007 |
| 7 | 0.262862 |
| 8 | 0.424133 |
| 9 | 0.439072 |
| 10 | 0.298289 |
| 11 | 0.183345 |
| 12 | 0.199601 |
| 13 | 0.232586 |
| 14 | 0.188801 |
| 15 | 0.143795 |
| 16 | 0.147515 |
| 17 | 0.147634 |
| 18 | 0.161237 |
| 19 | 0.254967 |
| 20 | 0.353900 |
| 21 | 0.311169 |

Peak delivery 0.4562 at t = 8.5 vs static floor 1/7 = 0.1429.
At every sampled time with nonzero P(T), the conditional data state equals
U_T...U_1|00> to machine precision (worst infidelity 2.22e-16):
the walk never garbles the program — it just rarely delivers it.

## The wall

| mode | P(deliver) | price | expected erasure bits |
| --- | --- | --- | --- |
| direct execution | 0 | T unitary gates, reversible | 0 |
| static (ground state) | 0.1429 | measure clock, retry | 19.65 |
| fueled (eps=0.4·Delta) | 0.2264 | oil: tilt -eps·t (gap closes; cargo stays exact) | 12.40 |
| walk (free clock) | 0.4562 | coherent time t*=8.5; energy bandwidth ~ ||H|| | 6.15 |

The vacuum compiler stores and attests computation; it never beats running it.
