# exp4-mechanism

## Definite order (report → allocate)

| θ/π | U_def(θ) | gain g(θ) = U(θ) − U(0) |
|---|---|---|
| 0.0000 | 2.000000 | +0.000000 |
| 0.0833 | 1.982963 | -0.017037 |
| 0.1667 | 1.933013 | -0.066987 |
| 0.2500 | 1.853553 | -0.146447 |
| 0.3333 | 1.750000 | -0.250000 |
| 0.4167 | 1.629410 | -0.370590 |
| 0.5000 | 1.500000 | -0.500000 |
| 0.5833 | 1.370590 | -0.629410 |
| 0.6667 | 1.250000 | -0.750000 |
| 0.7500 | 1.146447 | -0.853553 |
| 0.8333 | 1.066987 | -0.933013 |
| 0.9167 | 1.017037 | -0.982963 |
| 1.0000 | 1.000000 | -1.000000 |

DSIC holds in the definite order: no deviation beats honest reporting (max gain ≤ 0).

## Switched order — measurement-style allocation

| θ/π | U_sw(θ) | U_sw(θ) − ½(U_def(θ) + U_BA) | gain vs U_sw(0) |
|---|---|---|---|
| 0.0000 | 2.000000 | -4.4e-16 | +0.000000 |
| 0.0833 | 1.991481 | -4.4e-16 | -0.008519 |
| 0.1667 | 1.966506 | -4.4e-16 | -0.033494 |
| 0.2500 | 1.926777 | -6.7e-16 | -0.073223 |
| 0.3333 | 1.875000 | -4.4e-16 | -0.125000 |
| 0.4167 | 1.814705 | -2.2e-16 | -0.185295 |
| 0.5000 | 1.750000 | -2.2e-16 | -0.250000 |
| 0.5833 | 1.685295 | -2.2e-16 | -0.314705 |
| 0.6667 | 1.625000 | -4.4e-16 | -0.375000 |
| 0.7500 | 1.573223 | -2.2e-16 | -0.426777 |
| 0.8333 | 1.533494 | -4.4e-16 | -0.466506 |
| 0.9167 | 1.508519 | -4.4e-16 | -0.491481 |
| 1.0000 | 1.500000 | -4.4e-16 | -0.500000 |

The measurement-style allocation decoheres the branches: the switched utility is
EXACTLY the equal mixture ½(U_def(θ) + U_BA) — the deviation gain survives with its
sign but HALF its magnitude. Incentive compatibility is preserved (attenuated), not
inverted: order indefiniteness acts as a scaling on the incentive landscape.

## Switched order — coherent allocation (CNOT)

| θ/π | U_sw^coh(θ) | deviation from mixture | gain vs U_sw^coh(0) |
|---|---|---|---|
| 0.0000 | 2.000000 | -4.4e-16 | +0.000000 |
| 0.0833 | 1.991481 | -4.4e-16 | -0.008519 |
| 0.1667 | 1.966506 | -4.4e-16 | -0.033494 |
| 0.2500 | 1.926777 | -6.7e-16 | -0.073223 |
| 0.3333 | 1.875000 | -4.4e-16 | -0.125000 |
| 0.4167 | 1.814705 | -2.2e-16 | -0.185295 |
| 0.5000 | 1.750000 | -2.2e-16 | -0.250000 |
| 0.5833 | 1.685295 | -2.2e-16 | -0.314705 |
| 0.6667 | 1.625000 | -4.4e-16 | -0.375000 |
| 0.7500 | 1.573223 | -2.2e-16 | -0.426777 |
| 0.8333 | 1.533494 | -4.4e-16 | -0.466506 |
| 0.9167 | 1.508519 | -4.4e-16 | -0.491481 |
| 1.0000 | 1.500000 | -4.4e-16 | -0.500000 |

Coherent allocation keeps cross-branch coherences alive; the mixture law breaks by
machine-measured amounts (see column 3). IC verdict under coherent allocation: **PRESERVED (max gain ≤ 0)**.

## Verdict

- Measurement-style mechanisms (the realistic case — outcomes are classical): incentive
  constraints survive order indefiniteness with gains exactly halved. DSIC's direction
  is an order-free property here; only the exchange rate moves.
- Coherent allocation (CNOT): the mixture law survives EXACTLY — coherences cancel out of
  the payoff marginal. For this mechanism family the order superposition never inverts an
  incentive, it rescales it: the wall softens, does not fall. (Echoes quantum-mech T1: the
  utility remains affine in the deviation — conservation beats order.)
- Scope: one toy mechanism, one deviation family, exact arithmetic. This is a first
  executable probe of "mechanism design without definite order", not a theorem.

