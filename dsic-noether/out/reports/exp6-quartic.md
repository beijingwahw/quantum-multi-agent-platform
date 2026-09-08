# EXP6 — the non-quadratic face: the quartic family on both sides of the polynomial boundary

T9-A: on the uncoupled quartic family (v = tau^3 a - a^4/4, one private good per agent,
tau = theta^(1/3)) the efficient rule x_j = tau_j is polynomial and the WHOLE chain closes
with every identity the zero polynomial. The charge acquires a new closed form — a square
times a positive-definite quadratic — and DSIC is ordered-field arithmetic. HONEST LABEL:
the stage is externality-free (others' reports never move x_i; the Clarke pivot payment is
identically 0); the coupling that the quadratic stage carried is exactly what T9-B proves
unreachable in the polynomial ring for quartic costs.

## T9-A — the chain, assembled on the quartic family

| n | [E]+[S] residuals | [I] readoff | [G] form |
| --- | --- | --- | --- |
| 2 | 0 (coefficient-wise) | 0 (coefficient-wise) | clean (no s-monomials) |
| 3 | 0 (coefficient-wise) | 0 (coefficient-wise) | clean (no s-monomials) |

## T9-A — the charge and Noether I

| n | closed form | positive-definite factor | grid witness |
| --- | --- | --- | --- |
| 2 | -(s-t)^2(s^2+2st+3t^2)/4 exact | (s+t)^2+2t^2 exact | -113/16384 < 0 at 81 grid points |
| 3 | -(s-t)^2(s^2+2st+3t^2)/4 exact | (s+t)^2+2t^2 exact | -113/16384 < 0 at 81 grid points |

G(s;t) = -(s-t)^2 (s^2+2st+3t^2)/4 with s^2+2st+3t^2 = (s+t)^2 + 2t^2 — a sum of squares,
so G <= 0 with equality iff s = t (global — no region hypothesis needed). This is NOT the
quadratic family's square charge: the quartic wraps the square in a positive-definite form.

| gauge trial | gauge purity | dG/deps |
| --- | --- | --- |
| 0 | no s/t monomials | 0 (coefficient-wise) |
| 1 | no s/t monomials | 0 (coefficient-wise) |
| 2 | no s/t monomials | 0 (coefficient-wise) |

## T9-A — Noether II and the kappa control

| payment | verdict | evidence |
| --- | --- | --- |
| random gauge | gauge | recovered exactly (0 residual) |
| control p + (3/7)s | NOT-DSIC | convicted on sight |

| rule | own envelope | Groves drift d/ds[p + W_-i] |
| --- | --- | --- |
| kappa = 1/2 | 0 (coefficient-wise) | 7/16 * s^3 |
| kappa = 1 | 0 (coefficient-wise) | 0 (the kappa = 1 slice IS Groves) |
| kappa = 2 | 0 (coefficient-wise) | -14 * s^3 |
| kappa = -1/5 | 2-cycle gain | 1/5 > 0 (not implementable, ROC87) |

The kappa-rule (efficient for the kappa-discounted profile) is implementable for every
kappa > 0 but its Groves drift is exactly kappa(1-kappa^3) s^3 — Groves only on the
kappa = 1 slice (kappa = 0 is the degenerate no-trade slice, noted). kappa < 0 has a
positive Rochet 2-cycle -kappa(a-b)^2.

## T9-B — the no-polynomial certificate: the coupled quartic stage

On the v0.2.0 stage (one divisible good, sum a_j = 1, intercept types) the quartic FOC
x_j^3 = theta_j - lambda forces x_2^3 - x_1^3 = theta_2 - theta_1; on the others-fixed
line the RHS has degree exactly 1, while the LHS factors as
(X_2-X_1)(X_2^2+X_2X_1+X_1^2) with the quadratic factor of degree 2d EXACTLY (its
leading coefficient q_d^2+q_d p_d+p_d^2 = (q_d+p_d/2)^2 + (3/4)p_d^2 > 0). Degree
arithmetic e + 2d = 1 with d = 0 => e = 0 has no solution: NO polynomial allocation —
the chain does not break at a link; the polynomial ring cannot state it.

| certificate step | law | machine |
| --- | --- | --- |
| factor identity in Q[P,Q] | degree bookkeeping basis | 0 (coefficient-wise) |
| leading-coefficient positivity | (A+B/2)^2+(3/4)B^2 > 0 unless A=B=0 | 0 (coefficient-wise) |
| generic P, Q of degree 1 | t^2-slice = q_d^2+q_d p_d+p_d^2 | exact, nothing above |
| generic P, Q of degree 2 | t^4-slice = q_d^2+q_d p_d+p_d^2 | exact, nothing above |
| generic P, Q of degree 3 | t^6-slice = q_d^2+q_d p_d+p_d^2 | exact, nothing above |
| degree arithmetic e + 2d = 1, d = 0 => e = 0 | NO solution | refuted |

The d-uniformity of the top-coefficient step (i + j = 2d with i, j <= d forces i = j = d)
is witnessed at generic symbolic coefficients for d = 1..3 and holds monomial-wise for
all d. Controls below prove the checker convicts exactly the cubic shape:

| control | verdict | evidence |
| --- | --- | --- |
| RHS degree 3 | feasible (d, e) = (1, 1) | X_1 = 1, X_2 = t solves it exactly |
| quadratic FOC (linear in x) | affine solution exists | 0 residual — not convicted |
| affine allocation vs cubic FOC | convicted | nonzero residual (named by pAssertZero) |

The exponential family (v = theta*a - e^a, x = ln(theta - lambda)) fails one level
earlier — transcendental FOC inversion — and is CITED as outside the certificate's
algebraic scope, not machine-claimed.

## Honest boundary

PROVED, machine-exact: the full chain on the uncoupled quartic family (both directions —
Groves form by [E]+[I]+[S]+[G], DSIC by the sum-of-squares charge); Noether I orbit
conservation and Noether II classification on the new family; the no-polynomial
certificate for the coupled quartic stage with sharp controls. NOT proved: polynomial
exactness of any EXTERNALITY-BEARING quartic mechanism (the certificate refutes the
natural one); rational (as opposed to polynomial) non-solvability would need the
arithmetic of the Fermat cubic — CITED, not executed here.
