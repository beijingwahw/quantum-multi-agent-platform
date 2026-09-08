# EXP4 — the graduated boundary, amplification, and the walk's coherent price

Every number below regenerates from `npm run repro` (seeded, zero dependencies).

## A. the tariff cross-check — the independent third path (exact integers)

dtc-clock TC14 (v0.19.0) legislated, at matched depth 11: DTC-clocked Bennett 0 <
DTC as-built 5 < irreversible Boolean 9 < FK spectral clock 43.02 — the FK entry
quoted from THIS repo's T4 static mode. route-price W-E (v0.2.0) re-priced the
same ordering on its own netlist. The third path below re-decides every
comparison against (T+1)·log2(T+1) by exact integer arithmetic:
(T+1)·log2(T+1) < c ⟺ (T+1)^(T+1) < 2^c (BigInt) — floats are display-only.

| T | exact bracket lo | vs 5 | vs 9 | float (display) |
| --- | --- | --- | --- | --- |
| 2 | 4 | < 5 | < 9 | 4.7549 |
| 3 | 8 | > 5 | < 9 | 8.0000 |
| 4 | 11 | > 5 | > 9 | 11.6096 |
| 5 | 15 | > 5 | > 9 | 15.5098 |
| 6 | 19 | > 5 | > 9 | 19.6515 |
| 7 | 24 | > 5 | > 9 | 24.0000 |
| 8 | 28 | > 5 | > 9 | 28.5293 |
| 9 | 33 | > 5 | > 9 | 33.2193 |
| 10 | 38 | > 5 | > 9 | 38.0537 |
| 11 | 43 | > 5 | > 9 | 43.0196 |
| 12 | 48 | > 5 | > 9 | 48.1057 |

Matched-depth verdict at T = 11: 5 < 9 < 43.02 (exact); the quoted
43.02 is certified as the correct 2-decimal rounding of 12·log2(12), tightly
(4301 and 4303 both fail the exact check). The tariff crossovers on our
conventions: the FK static entry undercuts the 5-unit sibling rival only at
T ≤ 2, the 9-unit rival only at T ≤ 3 — from T = 3 and T = 4
on, the rivals win and the gap only grows. The sibling citations, re-audited
read-only against their shipped reports and package versions:

| citation | verdict | crimes |
| --- | --- | --- |
| dtc-clock TC14 (v0.19.0) | ACCEPTED | — |
| route-price W-E (v0.2.0) | ACCEPTED | — |

## B. the amplification census (exact rationals + seeded MC)

Per-round soundness on the partial-regime demo family (unique valid input; the
trajectory law pins epsilon to the circuit's own acceptance probability):

| family | k | eps^k exact | eps^k float | (1-eps)^k exact | MC (AND rule) | |MC-exact| in sigma |
| --- | --- | --- | --- | --- | --- | --- |
| eps=1/2 (H@0, accept q0=1) | 1 | 1/2 | 5.000e-1 | 1/2 | 4.986e-1 | 0.40σ |
| eps=1/2 (H@0, accept q0=1) | 2 | 1/4 | 2.500e-1 | 1/4 | 2.531e-1 | 1.03σ |
| eps=1/2 (H@0, accept q0=1) | 3 | 1/8 | 1.250e-1 | 1/8 | 1.258e-1 | 0.36σ |
| eps=1/2 (H@0, accept q0=1) | 4 | 1/16 | 6.250e-2 | 1/16 | 6.215e-2 | 0.20σ |
| eps=1/2 (H@0, accept q0=1) | 5 | 1/32 | 3.125e-2 | 1/32 | 3.270e-2 | 1.18σ |
| eps=1/2 (H@0, accept q0=1) | 6 | 1/64 | 1.563e-2 | 1/64 | 1.590e-2 | 0.31σ |
| eps=1/2 (H@0, accept q0=1) | 7 | 1/128 | 7.813e-3 | 1/128 | 8.550e-3 | 1.18σ |
| eps=1/2 (H@0, accept q0=1) | 8 | 1/256 | 3.906e-3 | 1/256 | 3.950e-3 | 0.10σ |
| eps=1/2 (H@0, accept q0=1) | 9 | 1/512 | 1.953e-3 | 1/512 | 1.500e-3 | 1.45σ |
| eps=1/2 (H@0, accept q0=1) | 10 | 1/1024 | 9.766e-4 | 1/1024 | 1.000e-3 | 0.11σ |
| eps=1/2 (H@0, accept q0=1) | 11 | 1/2048 | 4.883e-4 | 1/2048 | exact-only | — |
| eps=1/2 (H@0, accept q0=1) | 12 | 1/4096 | 2.441e-4 | 1/4096 | exact-only | — |
| eps=1/4 (HH, accept q0q1=11) | 1 | 1/4 | 2.500e-1 | 3/4 | 2.518e-1 | 0.59σ |
| eps=1/4 (HH, accept q0q1=11) | 2 | 1/16 | 6.250e-2 | 9/16 | 6.230e-2 | 0.12σ |
| eps=1/4 (HH, accept q0q1=11) | 3 | 1/64 | 1.563e-2 | 27/64 | 1.510e-2 | 0.60σ |
| eps=1/4 (HH, accept q0q1=11) | 4 | 1/256 | 3.906e-3 | 81/256 | 3.500e-3 | 0.92σ |
| eps=1/4 (HH, accept q0q1=11) | 5 | 1/1024 | 9.766e-4 | 243/1024 | 8.500e-4 | 0.57σ |
| eps=1/4 (HH, accept q0q1=11) | 6 | 1/4096 | 2.441e-4 | 729/4096 | exact-only | — |
| eps=1/4 (HH, accept q0q1=11) | 7 | 1/16384 | 6.104e-5 | 2187/16384 | exact-only | — |
| eps=1/4 (HH, accept q0q1=11) | 8 | 1/65536 | 1.526e-5 | 6561/65536 | exact-only | — |
| eps=1/4 (HH, accept q0q1=11) | 9 | 1/262144 | 3.815e-6 | 19683/262144 | exact-only | — |
| eps=1/4 (HH, accept q0q1=11) | 10 | 1/1048576 | 9.537e-7 | 59049/1048576 | exact-only | — |
| eps=1/4 (HH, accept q0q1=11) | 11 | 1/4194304 | 2.384e-7 | 177147/4194304 | exact-only | — |
| eps=1/4 (HH, accept q0q1=11) | 12 | 1/16777216 | 5.960e-8 | 531441/16777216 | exact-only | — |

Binomial amplification identity sum_j C(k,j) eps^j (1-eps)^(k-j) = 1 verified
exactly (BigInt residue 0) on five (eps, k) pairs including non-dyadic 1/3 and 2/7.
Rows with expected MC pass count below 10 are exact-only (the resolution floor —
no tolerance is stretched to cover what the census cannot resolve). Completeness:
the honest accepting witness passes every delivered round with probability
exactly 1 (the T3 conditional-fidelity-1 certificate) — amplification loses
nothing on the completeness side and pays on the ledger:

| k rounds | completeness | expected erasure bits (T=2 static) |
| --- | --- | --- |
| 1 | 1.000000000000 | 4.75 |
| 2 | 1.000000000000 | 9.51 |
| 4 | 1.000000000000 | 19.02 |
| 8 | 1.000000000000 | 38.04 |
| 12 | 1.000000000000 | 57.06 |

## C. the walk's coherent time-energy price (second walk family)

The first walk family (exp3, fixed T=6 across circuits) showed the delivery
curve is circuit-independent. The second family sweeps DEPTH (T = 4..10,
n = 2, unique input |00>): peak delivery, peak time t*, and the coherent
resources actually spent — the energy spread sigma_E = sqrt(<H^2>-<H>^2) of
the initial state, exactly conserved under the walk and machine-law pinned
to exactly 1/2 on this family (the clock-0 basis state touches one clock
edge: <H> = 1/2, <H^2> = 1/2), the time-energy product t*·sigma_E, and the
Mandelstam–Tamm orthogonalization floor pi/(2 sigma_E) = pi as anchor.

| T | peak P(T) | t* | t*/(T+1) | sigma_E (t=0 = t*) | t*·sigma_E | MT floor |
| --- | --- | --- | --- | --- | --- | --- |
| 4 | 0.5588 | 6.50 | 1.300 | 0.500000000000 | 3.2500 | 3.141593 |
| 6 | 0.4562 | 8.50 | 1.214 | 0.500000000000 | 4.2500 | 3.141593 |
| 8 | 0.3913 | 10.75 | 1.194 | 0.500000000000 | 5.3750 | 3.141593 |
| 10 | 0.3451 | 12.75 | 1.159 | 0.500000000000 | 6.3750 | 3.141593 |

The coherent bill, stated plainly: the walk's energy bandwidth is a CONSTANT
1/2 — not the vague ~||H|| of the v0.1.0 wall row — so depth buys nothing on
the energy axis, only on the time axis, and every orthogonalizing detour
obeys the MT floor pi/(2 sigma_E). Cargo stays exact at every delivery peak
(fidelity 1 - 1e-15), but the peak thins with depth (no perfect state
transfer on the path graph) while t* grows: the coherent price of the walk
compounds exactly where its value thins.
