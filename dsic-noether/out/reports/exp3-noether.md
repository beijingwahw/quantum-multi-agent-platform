# EXP3 — discrete Noether, executed

## A. the closedness identity has a closed form

D_1 L_d·xi_Q(q) + D_2 L_d·xi_Q(q+) = h (a_x - a_y) mid_x mid_y —
derivative-based value matches it to 2.84e-14 over random pairs, both quads
(the guard 1e-13 sits above the ~1e-14 rounding floor of the |q+ - q|/h terms).

## B. symmetry => closed 1-form

| potential | max |closedness| over random pairs |
| --- | --- |
| isotropic a_x = a_y = 1 | 5.33e-15 |
| anisotropic (1, 4) | 8.08e-2 |

## C. the charge along DEL trajectories (400 steps, h = 0.05)

| potential | max DEL residual | max |J_k - J_0| |
| --- | --- | --- |
| isotropic | 5.88e-15 | 2.40e-14 |
| anisotropic | 5.88e-15 | 2.00e+0 |

Discrete Noether (MW01): exact invariance of L_d under the diagonal
rotation => the momentum-map charge is conserved EXACTLY in exact
arithmetic; the machine sees rounding scale. Break the symmetry and the
charge drifts by orders of magnitude more — the same algebra as the
mechanism side: gauge symmetry => charge invariant; broken rule =>
positive cycles.
