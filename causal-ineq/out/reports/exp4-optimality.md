# EXP4 — Optimality beyond the rotated-measurement family

**Family F_q**: all binary-outcome TPCP instruments on qubit in/out per lab — arbitrary
local-input dependence, entangled CJ elements allowed, shared ancillas reduced to PSD+TP
elements (OCB12's instrument-ancilla reduction). Rotated projective measurements are a
measure-zero corner of this family.

## The certificate chain

| chain link | worst deviation |
| --- | --- |
| process Born rule (16-dim) == functional decomposition (320 samples) | 2.22e-16 |
| functional decomposition == closed form (240 product samples) | 1.11e-16 |
| lemmas L1-L4 on all sampled instruments (incl. entangled elements) | 3.71e-15 |

## The bound, executed (W* = ¼[1 + c1 T1 + c2 T2], c1 = c2 = 1/√2)

| quantity | value |
| --- | --- |
| branch bound b'=0 (Alice guesses): ½(1+c2) | 0.853553390593 |
| branch bound b'=1 (Bob guesses): ½(1+c1) | 0.853553390593 |
| p_success bound at c1=c2=1/√2 | 0.853553390593 |
| cos²(π/8) | 0.853553390593 |
| OCB protocol slack (bound − executed) | 0.00e+0 |
| min slack over 200 random strategies | 0.291534 |

P_A ≤ ½(1+c2) and P_B ≤ ½(1+c1) hold independently (every input to the chain is a PSD/TP
lemma — see src/game/certificate.ts header); both are ATTAINED simultaneously by the OCB
z/x protocol, so within F_q on W* the supremum is exactly cos²(π/8) = 0.853553390593.

## Multistart sweep (deterministic, seed-fixed)

640 random starts + coordinate line-search (40 passes, 60 parameters each): best found
0.853507373499, i.e. 4.60e-5 BELOW the bound — nothing exceeds it.
Perturbed-OCB restarts return to the optimum 20/20 times; a restart that fell short would
land strictly below the bound — the certificate, not the search, carries the claim.

## The biased OCB functional — LC25 anchor, executed

| α | executed ℐ_α = P_A + α·P_B on S_OCB,α | closed form (1+α+√(1+α²))/2 | deviation | process |
| --- | --- | --- | --- | --- |
| 0.00 | 1.000000000000 | 1.000000000000 | 0.00e+0 | VALID |
| 0.25 | 1.140388203202 | 1.140388203202 | 0.00e+0 | VALID |
| 0.50 | 1.309016994375 | 1.309016994375 | 2.22e-16 | VALID |
| 1.00 | 1.707106781187 | 1.707106781187 | 2.22e-16 | VALID |
| 2.00 | 2.618033988750 | 2.618033988750 | 4.44e-16 | VALID |
| 4.00 | 4.561552812809 | 4.561552812809 | 0.00e+0 | VALID |

LC25 (arXiv:2403.02749, Nat. Commun. 16, 3314) prove ℐ^{ICO}_{OCB,α} = (1+α+√(1+α²))/2 is
the exact maximum over ARBITRARY quantum processes and arbitrary local operations; the executed
qubit values saturate it at every α probed, and the qubit-lab relaxation bound above reproduces
the same number — the qubit corner is already tight. At α = 1: ℐ = 1 + 1/√2 = 1.707106781187
(our normalization: p_success = cos²(π/8)); the PSD window c1²+c2² ≤ 1 touches the curve exactly
where the game value saturates it.

## Honest boundary

Proven WITHIN F_q (qubit labs, the process W*). Not claimed: optimality over higher-dimensional
labs or other processes — that is LC25's theorem (cited; their SDP hierarchy is out of scope,
see README boundary 2). The sweep corroborates, never certifies: only the relaxation bound does.
