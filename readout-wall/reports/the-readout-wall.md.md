# the-readout-wall.md

# THE READOUT WALL — order knowledge and order advantage, both columns

> The ledger's #06 cost column says it in one clause: readout collapses the order. This page executes the clause as trades — every row books what you GET (the definite branch) against what you PAY (the off-block coherences that carry the advantage). It is only rendered because the checker passed: a one-sided trade, an EXACT tag whose witness fails, or a dead anchor all refuse to render.

| id | face | GET | PAY | exactness | witness |
| --- | --- | --- | --- | --- | --- |
| E1 | ESC18 exchange — two completely depolarizing boxes, joint receiver | the order bit: P(control=0 | input) = 1/2 to 1e-15 for every input — a fair coin about the branch, never about the payload | chi_joint 0.048794940695399 -> 0.000000000000000: every bit of the switched advantage lives in the off-block coherences the readout demolishes | EXACT | W-B |
| E2 | Collapse identity — what the readout leaves behind | the definite branch: a classical mixture of the fixed-order channels, weighted by the control's diagonal (p_c * M_c) | the off-block terms, all of them: dephased switch = the mixture, machine-identity to 1e-15 across the showcase pairs, biased controls, and random CPTP pairs — the read-out switch is not a new process, it is the average of the orders you could have chosen | EXACT | W-A |
| E3 | Complementarity face — replacer pair, information parked ON the control | the order bit, again input-blind (P = 1/2) | control information T = 1/2 (chi_control = H2(1/4) - 1/2 = 0.311278 bits) -> z-readout T = 0.000000000000000: the information lives at x-coherence; the order basis sees nothing. Order-knowledge and order-advantage are complementary observables of the same register | EXACT | W-C |
| E4 | Weak readout — partial dephasing of strength lambda | lambda-strength order knowledge | chi(lambda): 0.048795 -> 0.026470 (@0.25) -> 0.011482 (@0.5) -> 0.002831 (@0.75) -> 0 (@1) — endpoints exact, curve shipped as data; no convexity or concavity theorem is claimed for the interior | DATA | W-D |
| E5 | k=3 face — six orders, one register | the order register over the six permutations of S3 | chi_joint 0.098069743463625 -> 0.000000000000000 (machine-measured; no paper value claimed); the six-order mixture identity holds to 1e-15 — the wall scales with the order count it buries | EXACT | W-E |

## Witnesses (independent re-derivations)

- PASS — W-A collapse identity (readout = classical mixture) (5 pairs x 3 inputs, maxdev 1.110e-16)
- PASS — W-B ESC18 exchange (T_full 0.250000000000000, chi 0.048794940695399 -> 0.000000000000000, order-bit blindness 3.33e-16)
- PASS — W-C complementarity face (T(control) 0.499999999999999 -> z-readout 0.000000000000000; chi_control 0.311278124 vs H2(1/4)-1/2)
- PASS — W-D weak-readout interpolation (data) (0:0.048794941 0.25:0.026470287 0.5:0.011482407 0.75:0.002830695 1:0.000000000)
- PASS — W-E k=3 face (six orders) (chi 0.098069743463625 -> 0.000000000000000; mixture identity 1.388e-17 (depol), 5.551e-17 (complex random triples))

## Closing

The wall is not 'you cannot know the order.' It is a price list. The order bit is always for sale, and it is always the same coin: a fair flip about the branch — never about the payload (E1's blindness clause). What it buys depends on where the advantage was parked: on the off-blocks of the joint state (ESC18, E1), on the control's own coherence (the replacer pair, E3), or across six orders at once (E5). Reading does not merely disturb the advantage; the dephased switch IS the classical mixture of the orders you could have chosen without any switch at all (E2). That is why the verdict stays HW-WAIT rather than collapsing to 'impossible': no hardware advance repeals a complementarity — but none is needed to keep paying these prices. Order is superposable, not abolishable; knowledge of it is purchasable, never free.

