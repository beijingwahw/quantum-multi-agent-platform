# EXP1 — the compiler certificate

Every number below regenerates from `npm run repro` (seeded, zero dependencies).

## A. gate library

H/X/Y/Z/S/T/CNOT all pass M†M = I to machine precision.

## B. the deed: H_prop |Psi_hist> = 0

Random circuits × random inputs; max |H_prop Psi| entry modulus.

| instance | first gates | max |H·Psi| |
| --- | --- | --- |
| n=2, T=4, seed=101 | CNOT@0,HY,HT,CNOT@0 | 6.66e-17 |
| n=2, T=6, seed=102 | ZS,TH,SZ,CNOT@0,SS,SY | 5.89e-17 |
| n=3, T=4, seed=103 | CNOT@1,CNOT@1,XZI,XII | 0.00e+0 |
| n=3, T=6, seed=104 | TSX,ITZ,CNOT@0,HSZ,TYT,HHI | 6.21e-17 |

## C. ground-state degeneracy accounting

Bare propagation Hamiltonian: every input's history is a ground state.

| input convention | machine count | expected |
| --- | --- | --- |
| checked=[] | 4 | 4 |
| checked=[0] | 2 | 2 |
| checked=[0,1] | 1 | 1 |

## D. witness semantics (accept/reject)

| program | ground energy | expected |
| --- | --- | --- |
| accepting (q1=1 at T) | -5.89e-18 | 0 |
| rejecting (q1=0 at T) | 0.133975 | > 0 |

## E. static readout

| instance | P(T) machine | P(T) = 1/(T+1) | conditional fidelity |
| --- | --- | --- | --- |
| n=2, T=4 | 0.200000000000 | 0.200000000000 | 1.000000000000 |
| n=2, T=6 | 0.142857142857 | 0.142857142857 | 1.000000000000 |
| n=3, T=4 | 0.200000000000 | 0.200000000000 | 1.000000000000 |
| n=3, T=6 | 0.142857142857 | 0.142857142857 | 1.000000000000 |

Measuring the clock at step T hands back U_T...U_1|psi_in> with fidelity
exactly 1 (worst deviation 2.22e-16). The clock marginal is exactly uniform.
