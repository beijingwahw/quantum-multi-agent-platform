# THE CHOICE MODEL — choice as a language primitive, executed

> The ledger's OPEN row said 'no executable model exists'. This page is one: a minimal language whose choose steps compile to controlled branching, a marked world, and the facts that survive machine audit — every claim naming its program family. It renders only because the checker passed.

| id | claim | family | price | exactness | witness |
| --- | --- | --- | --- | --- | --- |
| R1 | the denotation compiles: conditioning the final state on a control pattern yields exactly the branch product's action on data | both | pattern probability = product of branch weights exactly (0.003673519813811 for the probe pattern); conditional data state vs U_pattern rho U_pattern-deviation <= 1.2e-16 — the semantics is the compilation | MODEL-EXACT | W-B |
| R2 | stability as compilation: engineered programs (W-preserving branch blocks) keep data-in-W in W over arbitrary lengths | engineered | membership drift <= 9e-16 (the rounding floor at the witness's fixed seeds, measured 8.882e-16) over program lengths 1..6 — the desired world is a fixed point of every engineered program | MODEL-EXACT | W-A |
| R3 | random programs do not preserve the world — stability is engineered, not generic | random | membership after 6 random steps: mean 0.4816, range [0.4161, 0.5332] over 12 trials — decaying toward the dimension ratio 1/2 (data only, no theorem claimed for the rate) | DATA | W-A |
| R4 | the certification toll: verifying 'the world we want' among the branches costs 1/P attempts — the epoch-3 ledger reopened at the language layer | engineered | pattern weights exact against the closed form; Monte-Carlo E[attempts] within 2% of 1/P at 200k samples (P = 0.152 / 0.614 / 0.869) — knowing WHICH world costs its branch weight, always | MODEL-EXACT | W-C |
| R5 | the choice steers, never broadcasts: the register's coherence is order 1 under rephasing, a copied register's pair coherence is order 2 | engineered | steer term ratio exactly e^{i phi} (magnitude 1 to 1e-12) for phi in {0.3, 0.7, 1.1}; the CNOT clone preserves the term's VALUE exactly while its two-copy phase rate doubles — one copy or two, never a broadcast | MODEL-EXACT | W-D |
| R6 | the conservation law that guards stability, exhibited in-model: invariance implies the membership charge is conserved for EVERY input, implies stability | both | engineered: <Pi_W> before = after to <= 1.5e-15 on in-W, in-W-perp, and random superposition inputs (a conserved charge, not just a fixed point); random programs violate it — the same implication shape as the discrete Noether layer (noted, not claimed as new) | MODEL-EXACT | W-E |

## Witnesses (independent re-derivations)

- PASS — W-A stability split (engineered drift 8.882e-16 (floor 9.00e-16); random mean 0.4816 range [0.4161, 0.5332] vs dimension ratio 0.5)
- PASS — W-B denotation compiles (weight 0.003673519813811 vs closed 0.003673519813811; conditional deviation 1.110e-16)
- PASS — W-C certification toll (P=0.151647: E[attempts] 6.6020 vs 1/P=6.5943; P=0.613601: E[attempts] 1.6268 vs 1/P=1.6297; P=0.868697: E[attempts] 1.1517 vs 1/P=1.1511)
- PASS — W-D covariance order split (steer phi=0.3: phase 0.300000000000 mag 1.000000000000; steer phi=0.7: phase 0.700000000000 mag 1.000000000000; steer phi=1.1: phase 1.100000000000 mag 1.000000000000; clone pair: value equality exact, order 2 exact)
- PASS — W-E membership charge (engineered conservation drift 2.220e-16 over in-W, in-Wperp, random inputs; random program moves the charge by 0.450539 (violation real))

## Closing — what this does and does not settle

The model executes the route route-price priced: the legal boundary (controlled branching — the register steers, never broadcasts, the clone's double phase rate machine-read), stability as engineered invariance (drift at the rounding floor for any engineered program length; random programs sink toward the dimension ratio), the certification toll (knowing WHICH world costs its branch weight, 1/P reopened at the language layer), and the conserved charge that guards stability — invariance implies conservation for every input, the same implication shape as the discrete Noether layer. What it does NOT settle: the epoch-5 question. Stability here is compilation, not physics; the desired world is a fixed point because we built the branches that way, and the row stays OPEN for exactly that reason. The model's gift to the OPEN row is precise: it is now a question about nature, no longer a question about whether the question can be asked.
