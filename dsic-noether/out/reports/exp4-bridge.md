# EXP4 — the bridge: symmetry => closedness => charge => stationarity

| the algebra | mechanism design (integer-exact) | discrete mechanics (rounding-exact) |
| --- | --- | --- |
| invariant object | deviation gain (welfare gap) | L_d under diagonal rotation |
| group action | gauge p -> p + h(b_-i) (GL79 orbit) | SO(2) on R^2 (NOE18) |
| closed 1-form | dp + d(W_-i . x): worst imbalance 0 (bitwise 0) | theta_d . xi: |closedness| ~1e-16 (isotropic) |
| charge | welfare gap: max 0 (<= 0, = 0 at truth) | angular momentum: drift 2.40e-14 over 400 steps |
| broken case | anti-efficient rule: positive cycle 104 | anisotropic: curl 1.69e-2, J drift 2.00e+0 |
| stationarity | truthful reporting maximizes Phi_v (DSIC) | DEL trajectory solves D_1 L_d + D_2 L_d = 0 |

## The corner cases from the house files

| prototype | status |
| --- | --- |
| quantum-mech | on disk |
| switch-sched | on disk |

- quantum-mech T1: utility affine in the reported density matrix (1e-16),
  deviation gain identically 0 for the second-price rule — the charge
  survives quantum reports: gauge invariance does not care whether the
  report is classical or a density matrix.
- switch-sched T4: U_sw = (U_def + 2)/2 exactly under order superposition —
  the charge's SIGN never inverts: deviation benefit halves, direction
  is conserved. A conservation law stated for indefinite causal order.

## Honest boundary

What is proved here, at machine precision, both sides: invariance of the
right object makes the right 1-form closed; closedness produces the
potential/charge; the charge pins the stationary solution (truth / DEL).
The formal implication from Noether's 1918 continuum theorem to
Green-Laffont — excluded when this report was written — is now EXECUTED
at the smooth layer in exp5-continuum (v0.2.0): the chain [E]nvelope ->
[I]ntegration (Poincare) -> [S]tationarity -> [G]roves form closes in
exact rational polynomial arithmetic, with Noether I as the gauge-orbit
conservation of the charge and Noether II as the gauge identity whose
moduli reading is Green-Laffont uniqueness. This report keeps its
discrete-exactness layer as the discretization: the bridge table is the
same algebra, sampled.
