# EXP2 — the spectral gap law

## A. bare clock anchor (identity gates)

With identity gates H_prop = (1/2 · path Laplacian on C vertices) ⊗ I:
spectrum {1 - cos(pi k / C)}, each value 2^n-degenerate.

| T | C=T+1 | gap machine | gap closed form | dev | closed/machine |
| --- | --- | --- | --- | --- | --- |
| 2 | 3 | 0.500000000000 | 0.500000000000 | 3.33e-16 | 1.000000 |
| 3 | 4 | 0.292893218813 | 0.292893218813 | 2.22e-16 | 1.000000 |
| 4 | 5 | 0.190983005625 | 0.190983005625 | 2.78e-16 | 1.000000 |
| 5 | 6 | 0.133974596216 | 0.133974596216 | 0.00e+0 | 1.000000 |
| 6 | 7 | 0.099031132098 | 0.099031132098 | 1.80e-16 | 1.000000 |
| 7 | 8 | 0.076120467489 | 0.076120467489 | 5.55e-17 | 1.000000 |
| 8 | 9 | 0.060307379214 | 0.060307379214 | 2.08e-16 | 1.000000 |
| 9 | 10 | 0.048943483705 | 0.048943483705 | 2.08e-17 | 1.000000 |
| 10 | 11 | 0.040507026386 | 0.040507026386 | 1.04e-16 | 1.000000 |
| 11 | 12 | 0.034074173711 | 0.034074173711 | 1.11e-16 | 1.000000 |
| 12 | 13 | 0.029058182574 | 0.029058182574 | 3.47e-18 | 1.000000 |

Full-spectrum multiset check at T=5 passes at 1e-10.

## B. the dressing identity (a theorem, machine-verified)

W = sum_t (U_t...U_1) ⊗ |t><t| is a unitary clock-local dressing and
W† H_prop W = ½·(path Laplacian on C vertices) ⊗ I_data — for EVERY circuit.
The propagation spectrum is exactly {1 - cos(pi k / C)} with multiplicity
2^n regardless of the gates; this conjugation also explains why the walk
delivery curve in exp3 is circuit-independent (the clock walks alone).

| T | seed | max |W†H W − L⊗I| | max |W†W − I| |
| --- | --- | --- | --- |
| 4 | 401 | 2.22e-16 | 2.22e-16 |
| 4 | 402 | 4.44e-16 | 4.44e-16 |
| 4 | 403 | 0.00e+0 | 0.00e+0 |
| 4 | 404 | 2.22e-16 | 2.22e-16 |
| 4 | 405 | 2.22e-16 | 2.22e-16 |
| 6 | 401 | 2.22e-16 | 4.44e-16 |
| 6 | 402 | 4.44e-16 | 4.44e-16 |
| 6 | 403 | 0.00e+0 | 0.00e+0 |
| 6 | 404 | 2.22e-16 | 2.22e-16 |
| 6 | 405 | 2.22e-16 | 2.22e-16 |
| 8 | 401 | 4.44e-16 | 4.44e-16 |
| 8 | 402 | 4.44e-16 | 4.44e-16 |
| 8 | 403 | 4.44e-16 | 4.44e-16 |
| 8 | 404 | 2.22e-16 | 2.22e-16 |
| 8 | 405 | 2.22e-16 | 2.22e-16 |

## C. full program Hamiltonian (prop + input check + output check)

| program | ground energy | gap |
| --- | --- | --- |
| demo accept (n=2, T=2) | -5.89e-18 | 0.133975 |
| random unique-input (n=2, T=6) | 2.54e-17 | 0.025072 |
