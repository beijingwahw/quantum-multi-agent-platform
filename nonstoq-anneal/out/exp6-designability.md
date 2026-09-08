# Experiment 6 — Element-level de-signing decidability

Decision problem: does ANY single-qubit real-orthogonal basis change make every
off-diagonal element of the +kappa XX driver family (plus ZZ part and Z fields)
non-positive? Verdicts carry certificates: YES = explicit angles re-verified by the
exact element formulas (+ dense 2^n referee at small n); NO = isolated-pair
relaxation + Lipschitz margin (relaxation-infeasible PROVES infeasibility);
UNRESOLVED = honest gap between search upper bound and certificate resolution.
Regenerate with `npm run repro`.

## Part A — two-qubit uniform-field phase diagram (Gamma = 1)

| kappa | w | p_Z | verdict | vacuous | best max-elem | no-go margin | theorem |
|---|---|---|---|---|---|---|---|
| 0.25 | 0 | 0 | YES | YES | 9.373e-34 | — | nv-designable (kappa<=Gamma) |
| 0.25 | 0.25 | 0 | YES | no | -0.1868 | — | — |
| 0.25 | 1 | 0 | YES | no | -0.1989 | — | — |
| 0.25 | 4 | 0 | YES | no | 1.990e-16 | — | — |
| 0.5 | 0 | 0 | YES | YES | 1.875e-33 | — | nv-designable (kappa<=Gamma) |
| 0.5 | 0.25 | 0 | YES | no | -0.1267 | — | — |
| 0.5 | 1 | 0 | YES | no | -0.0612 | — | — |
| 0.5 | 4 | 0 | YES | no | 2.143e-16 | — | — |
| 1 | 0 | 0 | YES | YES | 3.749e-33 | — | nv-designable (kappa<=Gamma) |
| 1 | 0.25 | 0 | YES | no | 1.531e-17 | — | — |
| 1 | 1 | 0 | YES | no | 6.123e-17 | — | — |
| 1 | 4 | 0 | YES | no | 2.449e-16 | — | — |
| 2 | 0 | 0 | YES | YES | 6.123e-17 | — | only vacuous [grid-verified] |
| 2 | 0.25 | 0 | YES | no | 7.654e-17 | — | — |
| 2 | 1 | 0 | YES | no | 1.225e-16 | — | — |
| 2 | 4 | 0 | YES | no | 3.062e-16 | — | — |
| 4 | 0 | 0 | YES | YES | 1.837e-16 | — | only vacuous [grid-verified] |
| 4 | 0.25 | 0 | YES | no | 1.990e-16 | — | — |
| 4 | 1 | 0 | YES | no | 2.449e-16 | — | — |
| 4 | 4 | 0 | YES | no | 4.286e-16 | — | — |
| 0.25 | 0 | 0.5/0.7 | YES | no | -0.1220 | — | — |
| 0.25 | 0.25 | 0.5/0.7 | YES | no | -0.2263 | — | — |
| 0.25 | 1 | 0.5/0.7 | YES | no | -0.2649 | — | — |
| 0.25 | 4 | 0.5/0.7 | UNRESOLVED | no | 0.0062 | — | — |
| 0.5 | 0 | 0.5/0.7 | YES | no | -0.2113 | — | — |
| 0.5 | 0.25 | 0.5/0.7 | YES | no | -0.2427 | — | — |
| 0.5 | 1 | 0.5/0.7 | YES | no | -0.1421 | — | — |
| 0.5 | 4 | 0.5/0.7 | NO | no | 0.1709 | 0.0788 | — |
| 1 | 0 | 0.5/0.7 | YES | no | -0.2556 | — | — |
| 1 | 0.25 | 0.5/0.7 | YES | no | -0.1502 | — | — |
| 1 | 1 | 0.5/0.7 | YES | no | -0.0833 | — | — |
| 1 | 4 | 0.5/0.7 | NO | no | 0.2680 | 0.1574 | — |
| 2 | 0 | 0.5/0.7 | YES | no | -0.1328 | — | — |
| 2 | 0.25 | 0.5/0.7 | UNRESOLVED | no | 0.0288 | — | — |
| 2 | 1 | 0.5/0.7 | NO | no | 0.2467 | 0.1735 | — |
| 2 | 4 | 0.5/0.7 | NO | no | 0.2512 | 0.1166 | — |
| 4 | 0 | 0.5/0.7 | YES | no | -0.0696 | — | — |
| 4 | 0.25 | 0.5/0.7 | NO | no | 0.1239 | 0.0243 | — |
| 4 | 1 | 0.5/0.7 | NO | no | 0.4455 | 0.3346 | — |
| 4 | 4 | 0.5/0.7 | YES | no | -0.0579 | — | — |

Dichotomy readout: 27 cells YES non-vacuous, 5 YES only-vacuous,
6 certified NO, 2 UNRESOLVED. w=0 row: non-trivial de-signing exists
iff kappa <= Gamma (closed-form theorem, grid machine-check on the NO side).
Any w != 0 with p_Z = 0: YES non-vacuous at EVERY kappa (reflection-gauge X-basis
construction) — the single-edge sign barrier is an artifact of the w=0, p=0 slice.
Certified NO requires Z-field pins that frustrate the reflection gauge (k=2, w=1,
p=0.5/0.7 class).

## Part B — graph families (element verdict vs diagonal gauge vs sign metric)

| family | n | edges | element | vacuous | best | margin | diag-gauge | P(comp) | P(rotated) |
|---|---|---|---|---|---|---|---|---|---|
| chain n=8, kappa=0.5, w=-1 | 8 | 7 | YES | no | 1.225e-16 | — | NO | 0.3652 | 0.9967 |
| odd ring n=7, kappa=0.5, w=+1 | 7 | 7 | UNRESOLVED | no | 0.4298 | — | NO | 5.050e-12 | — |
| exp1-family n=6, kappa=0.5, s=0.5 | 6 | 15 | UNRESOLVED | no | 0.4154 | — | NO | 0.0975 | — |
| exp1-family n=6, kappa=0.05, s=0.5 | 6 | 15 | UNRESOLVED | no | 0.0500 | — | NO | 0.9999 | — |
| K4 n=4, kappa=0.5, w mixed | 4 | 6 | UNRESOLVED | no | 0.1651 | — | NO | 5.006e-6 | — |

P(comp) = ground-state sign ratio in the computational basis (the metric of exp1);
P(rotated) = same ratio in the certified de-signed basis. Non-vacuous YES
certificates recover P(rotated) = 1 (to degeneracy-limited precision when the
certificate sits exactly at the zero boundary) — Perron-Frobenius re-verified
THROUGH the decision layer — while P(comp) reflects the hardware readout basis:
de-signing moves the sign structure out of it, it does not remove it there.
PF is one-directional: P(comp) = 1 does not certify stoquasticity (the k=0.5,
w=0.3 cell is non-stoquastic with positive ground state); P(comp) ~ 0 marks the
barrier as measured in exp1.

## Part C — scale

- chain n=64, kappa=0.25, mixed w and Z fields: **YES** (vacuous=false,
  best max-elem -0.1300, 3551 ms, formulas path only) — the decision
  layer runs at DMRG scale via the O(n+|E|) exact element formulas.
