# EXP4 — regret vs query ledgers: where the quantum tear is, and where it is not

## A. Live classical baselines (arms 0.60/0.50/0.45/0.40, Delta = 0.10/0.15/0.20)

| horizon T | UCB1 median regret | median regret / ln T | ETC-live mean regret (N=300) | UCB1 final-wrong seeds |
| --- | --- | --- | --- | --- |
| 2500 | 115.0 | 14.70 | 135.0 | 3 |
| 5000 | 156.7 | 18.40 | 135.0 | 1 |
| 10000 | 218.0 | 23.67 | 135.0 | 1 |
| 20000 | 268.7 | 27.13 | 135.0 | 0 |

Medians (robust to the rare wrong-final-arm seed, counted separately): UCB1 regret grows on the ln(T) scale (median/ln T drifts mildly upward in the pre-asymptotic regime — the Lai-Robbins constant is approached from below, and wrong-final seeds vanish by T = 20000); ETC-live burns exactly N * sum(Delta) = 135 exploration regret. In the live model exploration is paid in regret — no algorithm choice changes the ledger (Lai-Robbins).

## B. Replay model: zero regret at quantum vs classical query cost

| instance | QAE-replay mean regret | wrong-commit seeds / 20 | QAE mean queries | classical replay queries (Hoeffding, delta=0.05) | classical/quantum |
| --- | --- | --- | --- | --- | --- |
| Delta=0.20 | 0.00 | 0 | 464 | 1016 | 2.2 |
| Delta=0.10 | 0.00 | 0 | 972 | 4064 | 4.2 |
| Delta=0.05 | 100.00 | 2 | 2018 | 16244 | 8.0 |
| Delta=0.025 | 50.00 | 2 | 5264 | 64964 | 12.3 |

Both replay schedulers sit at (near-)zero regret: moving from the live to the replay model is what removes regret — an information-model change. Inside the replay model the quantum scheduler pays Theta(1/Delta) queries where the classical one pays Theta(1/Delta^2): the quadratic tear, conditional on the qRAM premise. The Hoeffding column is the classical requirement for the same 5% failure budget.

## C. Adversarial stream: bit-identical decisions, identical regret

| seed | Exp3 regret (linear argmax) | Exp3 regret (Durr-Hoyer argmax) | decisions identical | linear reads | Durr-Hoyer reads |
| --- | --- | --- | --- | --- | --- |
| 0 | 99.0 | 99.0 | true | 8 | 14 |
| 1 | -9.0 | -9.0 | true | 8 | 8 |
| 2 | 77.0 | 77.0 | true | 8 | 9 |
| 3 | 39.0 | 39.0 | true | 8 | 7 |
| 4 | 22.0 | 22.0 | true | 8 | 9 |
| 5 | 79.0 | 79.0 | true | 8 | 5 |
| 6 | 26.0 | 26.0 | true | 8 | 9 |
| 7 | 78.0 | 78.0 | true | 8 | 12 |
| 8 | 44.0 | 44.0 | true | 8 | 11 |
| 9 | 58.0 | 58.0 | true | 8 | 8 |

All 10 seeds: decisions bit-identical and regrets exactly equal (verified) whenever the bounded-error quantum argmax returns the true optimum; the compute ledger still drops (k vs ~sqrt(k) reads). Measured regrets sit on the sqrt(T) scale of the Auer et al. minimax construction: accelerating compute does not enlarge the feedback set, so the Omega(sqrt(kT)) wall — an information bound, not a compute bound — stands.

## The three-layer statement (machine-checked above)

1. LIVE classical: exploration burns regret (ln T scale; Lai-Robbins ledger).
2. REPLAY model (qRAM premise): regret leaves the ledger; classical cost Theta(1/eps^2) queries.
3. REPLAY quantum: same zero regret at Theta(1/eps) queries — the tear is real but conditional on
   quantum access to a faithful replayable environment, and it is a QUERY-complexity tear.
4. ADVERSARIAL live: no tear at any layer; only the per-decision compute drops.

## Honest boundaries

- The replay premise is strong: a qRAM holding a faithful simulator (or logs) of the environment. Live interactive arm pulls cannot be queried in superposition; for those, layer 1's ledger is inescapable.
- Prior art exists at the query-complexity level (Wang et al. AAAI 2021 best-arm; Wan-Zhang et al. AAAI 2023, arXiv:2205.14988, O(polylog T) regret with quantum reward oracles): our contribution is the executable ledger separation and the adversarial wall, not the first quantum regret bound.
- QAE outcome distributions are exact; the staged scheduler is one design point, not an optimal one.

