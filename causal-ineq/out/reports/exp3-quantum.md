# EXP3 — The violation, executed

The OCB protocol on the process Born rule P = Tr[W (M^A ⊗ M^B)], exact complex arithmetic:

| process | P(x=b) (b'=0) | P(y=a) (b'=1) | p_success | anchor |
| --- | --- | --- | --- | --- |
| mixed (1/4)·1 | 0.500000000000 | 0.500000000000 | 0.500000000000 | 0.500000000000 |
| channel A≺B | 0.500000000000 | 1.000000000000 | 0.750000000000 | 0.750000000000 |
| channel B≺A | 0.500000000000 | 0.500000000000 | 0.500000000000 | 0.500000000000 |
| W*(1/√2) | 0.853553390593 | 0.853553390593 | 0.853553390593 | 0.853553390593 |

**Anchors**: the causal channel A≺B delivers EXACTLY the classical cap 3/4 (Bob reads a off the identity channel, Alice stays blind); W*(1/√2) delivers exactly cos²(π/8) = 0.853553390593 — both branches at ½(1+1/√2). The gap over 3/4 is 0.103553.

## Noise sweep (white-noise blend, linear in η by the Born rule)

| η | p_success (executed) | linear law | vs 3/4 |
| --- | --- | --- | --- |
| 0.000000 | 0.500000000000 | 0.500000000000 | < 3/4 |
| 0.250000 | 0.588388347648 | 0.588388347648 | < 3/4 |
| 0.500000 | 0.676776695297 | 0.676776695297 | < 3/4 |
| 0.707107 | 0.750000000000 | 0.750000000000 | ≥ 3/4 |
| 0.800000 | 0.782842712475 | 0.782842712475 | ≥ 3/4 |
| 1.000000 | 0.853553390593 | 0.853553390593 | ≥ 3/4 |

**Threshold exactly η* = 1/√2**: at η = 0.707107 the success crosses the causal bound — p(η) = ½ + η/2√2 hits 3/4 precisely there. Linear because the Born rule is linear in W.

## Measurement-angle grid (Bob's b'=1 axis in the x-z plane)

| θ | executed | closed form ½(1+cos θ/√2) |
| --- | --- | --- |
| 0.000000 | 0.853553390593 | 0.853553390593 |
| 0.392699 | 0.826640741219 | 0.826640741219 |
| 0.785398 | 0.750000000000 | 0.750000000000 |
| 1.570796 | 0.500000000000 | 0.500000000000 |

Grid over 33 angles: optimum at θ = 0 (z basis) with value cos²(π/8) — the analytic optimum within the rotated-measurement family.
