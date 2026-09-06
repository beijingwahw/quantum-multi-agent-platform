# EXP4 — Witness verification and the StoqMA boundary

## A: witness asymmetry on one P2||Cmax instance (n=8)

Classical witness: one bitstring z, verified by ONE exact evaluation makespan(z) <= B (deterministic, zero samples).
Quantum witness: uniform state, exact <H> = 54.5000 (linear-algebra referee).

| shots | exact <H> | median |estimate - exact| |
| --- | --- | --- |
| 100 | 54.5000 | 0.64000 |
| 1000 | 54.5000 | 0.21500 |
| 10000 | 54.5000 | 0.07110 |

log-log slope of median error vs shots: -0.477 (the 1/sqrt(m) law predicts -0.5). Verification cost is the price of the quantum witness's expressive scope.

## B: the statistical contract, both sides

| eps | delta | Hoeffding shots | empirical coverage | holds (>= 1-delta) |
| --- | --- | --- | --- | --- |
| 4.0 | 0.10 | 158 | 1.0000 | OK |
| 2.0 | 0.10 | 630 | 1.0000 | OK |
| 1.0 | 0.10 | 2518 | 1.0000 | OK |
| 2.0 | 0.05 | 776 | 1.0000 | OK |

Soundness (verifier accepts iff estimate <= B + eps; cheating states with <H> >= B + (1+gap)*eps):

| gap (in units of eps) | delta | shots | rejection rate | holds (>= 1-delta) |
| --- | --- | --- | --- | --- |
| 1.0 | 0.10 | 630 | 1.0000 | OK |
| 2.0 | 0.10 | 630 | 1.0000 | OK |
| 3.0 | 0.10 | 630 | 1.0000 | OK |

## C: stoquastic dichotomy (n=4, 8 random sign patterns per row)

| Gamma | kappa | stoq max off-diag (= -Gamma exactly) | nonstoq max off-diag (= +kappa exactly) |
| --- | --- | --- | --- |
| 1.0 | 0.5 | -1.00 | 0.50 |
| 1.0 | 2.0 | -1.00 | 2.00 |
| 0.3 | 0.1 | -0.30 | 0.10 |
| 2.0 | 5.0 | -2.00 | 5.00 |

ZZ couplers of ANY sign never leave the diagonal; the -Gamma X driver is the only off-diagonal term in the annealing regime and it is negative. One +kappa XX edge flips the certificate. This is the machine-checked boundary between StoqMA (BDOT08) and QMA-complete (KKR06) territory — the complexity-class face of nonstoq-anneal's sign barrier.
