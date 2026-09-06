# EXP1 — Process validity, executed

Four conditions: Hermitian, PSD (real-symmetric Jacobi, tolerance 1e-12), Tr = 4, allowed Pauli patterns only
(rules F1-F3 derived from TPCP invariance — see src/process/validity.ts header for the derivation).

| candidate | verdict | min eig | trace | worst forbidden pattern |
| --- | --- | --- | --- | --- |
| mixed (1/4)·1 | VALID | 2.50e-1 | 4.000000000000 | - |
| channel A≺B (Φ^{A2B1}) | VALID | 0.00e+0 | 4.000000000000 | - |
| channel B≺A (Φ^{A1B2}) | VALID | 0.00e+0 | 4.000000000000 | - |
| W*(1/√2) — the violation candidate | VALID | -1.28e-17 | 4.000000000000 | 0,0,1,3:1.04e-17 |
| W*(0.9) — beyond PSD window | INVALID | -6.82e-2 | 4.000000000000 | 0,0,1,3:3.47e-18 |
| forbidden A1A2 term (+0.05 ZZ) | INVALID | 2.00e-1 | 4.000000000000 | 3,3,0,0:5.00e-2 |
| forbidden A2B2 term (+0.05 XX) | INVALID | 2.00e-1 | 4.000000000000 | 0,1,0,1:5.00e-2 |
| PSD violation (0.9·Z^A2Z^B1) | INVALID | -6.50e-1 | 4.000000000000 | - |

W*(1/√2) eigenvalue certificate: min = -1.282e-17 (exact 0 — eigenvalues are {0, 1/2} because (T1+T2)/√2 squares to 1 and T1, T2 anticommute).

Negative controls fail for the RIGHT reasons: A1A2 breaks F1 (own input-output correlation), A2B2 breaks F3,
oversized coefficients break PSD.
