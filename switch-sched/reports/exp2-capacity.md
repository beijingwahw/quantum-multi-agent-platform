# exp2-capacity

## Headline table — zero-capacity pairs, control |+⟩

| pair | single box T | fixed T (AB / BA) | T control | T target | T joint | Helstrom (joint) | χ control | χ joint |
|---|---|---|---|---|---|---|---|---|
| replacer + replacer {|v⟩,|v⊥⟩} | 0.0e+0 | 0.000000 / 0.000000 | 0.500000 | 0.000000 | 0.500000 | 0.750000 | 0.311278 | 0.311278 |
| completely depolarizing ×2 {|0⟩,|1⟩} | 0.0e+0 | 0.000000 / 0.000000 | 0.000000 | 0.000000 | 0.250000 | 0.625000 | 0.000000 | 0.048795 |
| unitary (X, Z) {|0⟩,|1⟩} | 1.0e+0 | 1.000000 / 1.000000 | 0.000000 | 1.000000 | 1.000000 | 1.000000 | 0.000000 | 1.000000 |

**Zero + zero → positive.** Every single box and every definite order transmits exactly
nothing (T = 0, χ = 0). The switched pairs transmit through the ORDER degree of freedom:
- replacer pair: information lands on the **control** — T = 0.500000, Helstrom
  75.00%, χ = 0.311278 bits = H₂(1/4) − 1/2 (closed form).
- completely depolarizing pair: information lives **only in the joint state** — control and
  target marginals are exactly zero, joint T = 0.250000; the receiver must measure
  jointly. χ_joint = 0.048795 bits.
Priority for the general theorem (nonzero classical capacity of switched completely
depolarizing channels): Ebler-Salek-Chiribella, PRL 120, 120502 (2018). We certify positive
accessible information in exact arithmetic; the optimal-capacity optimisation is cited.

## Asymmetry sweep — (depol(p), depol(1)), ensemble {|0⟩, |1⟩}

| p | fixed T (AB / BA) | T joint (switch) | p/4 |
|---|---|---|---|
| 0 | 0.000000 / 0.000000 | 0.000000 | 0.000000 |
| 0.25 | 0.000000 / 0.000000 | 0.062500 | 0.062500 |
| 0.5 | 0.000000 / 0.000000 | 0.125000 | 0.125000 |
| 0.75 | 0.000000 / 0.000000 | 0.187500 | 0.187500 |
| 1 | 0.000000 / 0.000000 | 0.250000 | 0.250000 |

Exact linear law **T_joint = p/4**: with one box the identity (p = 0) the order carries
nothing — the two branches act on the target identically; as the second box closes, the
order channel opens linearly, reaching the ESC point T = 1/4 at p = 1. Admission
structure: order is a resource precisely where the information must transit erasing
channels on BOTH branches — T3 turns this into a scheduling criterion.

