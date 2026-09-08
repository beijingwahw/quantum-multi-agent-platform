# EXP6 — Genealogy enrollments: postselection ledger + no-signaling withdrawal

## A. postselect-sort — the many-worlds sorter, audited

One oracle query, then postselect the flag. Executed exactly (amplitude algebra, no sampling):

| n | t | P_success | t/N (closed) | fidelity(x*) | ledger 1/P | grover E* | classical N/t | ledger/E* |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 4 | 1 | 6.250000e-2 | 6.250000e-2 | 1.000000000000 | 16.00 | 3.30 | 16.00 | 4.85 |
| 4 | 3 | 1.875000e-1 | 1.875000e-1 | - | 5.33 | 2.11 | 5.33 | 2.53 |
| 4 | 7 | 4.375000e-1 | 4.375000e-1 | - | 2.29 | 2.29 | 2.29 | 1.00 |
| 6 | 1 | 1.562500e-2 | 1.562500e-2 | 1.000000000000 | 64.00 | 6.12 | 64.00 | 10.45 |
| 6 | 3 | 4.687500e-2 | 4.687500e-2 | - | 21.33 | 3.81 | 21.33 | 5.60 |
| 6 | 7 | 1.093750e-1 | 1.093750e-1 | - | 9.14 | 2.78 | 9.14 | 3.28 |
| 8 | 1 | 3.906250e-3 | 3.906250e-3 | 1.000000000000 | 256.00 | 11.62 | 256.00 | 22.03 |
| 8 | 3 | 1.171875e-2 | 1.171875e-2 | - | 85.33 | 6.94 | 85.33 | 12.29 |
| 8 | 7 | 2.734375e-2 | 2.734375e-2 | - | 36.57 | 4.75 | 36.57 | 7.70 |
| 10 | 1 | 9.765625e-4 | 9.765625e-4 | 1.000000000000 | 1024.00 | 22.68 | 1024.00 | 45.16 |
| 10 | 3 | 2.929688e-3 | 2.929688e-3 | - | 341.33 | 13.36 | 341.33 | 25.55 |
| 10 | 7 | 6.835938e-3 | 6.835938e-3 | - | 146.29 | 8.93 | 146.29 | 16.37 |
| 12 | 1 | 2.441406e-4 | 2.441406e-4 | 1.000000000000 | 4096.00 | 44.75 | 4096.00 | 91.53 |
| 12 | 3 | 7.324219e-4 | 7.324219e-4 | - | 1365.33 | 26.09 | 1365.33 | 52.34 |
| 12 | 7 | 1.708984e-3 | 1.708984e-3 | - | 585.14 | 17.28 | 585.14 | 33.87 |
| 14 | 1 | 6.103516e-5 | 6.103516e-5 | 1.000000000000 | 16384.00 | 88.92 | 16384.00 | 184.27 |
| 14 | 3 | 1.831055e-4 | 1.831055e-4 | - | 5461.33 | 51.58 | 5461.33 | 105.87 |
| 14 | 7 | 4.272461e-4 | 4.272461e-4 | - | 2340.57 | 33.97 | 2340.57 | 68.90 |

**A1 certainty-in-branch holds**: for t = 1 the conditional address state is EXACTLY |x*> (fidelity 1.000000000000 — the sorter's truthful half).

**A2 the depreciation ledger**: P_success = t/N exactly, so one heralded readout costs 1/P_success = N/t expected queries — column-for-column the classical random search rate. The quantum column is Grover compared at the SAME certain-answer standard (k iterations + 1 verification query, restart on failure): E* = min_k (k+1)/p_k. The ledger never beats E* (k = 0 is the random guess, so equality is attainable); for a single marked item the gap grows as ~sqrt(N) (last column). Postselection moves the cost from "queries" to "rejected branches" — the amortized rate repays at classical-random prices, never better.

### A3. Counting power in-branch — why anyone wanted postselection

Random predicates g (flag) and h (readout); the postselected branch reads the conditional counting ratio |{g AND h}|/|{g}| in closed form, verified against an independent integer-count referee:

| n | P_success = |{g}|/N | P(h=1|flag=1) branch | brute ratio | deviation |
| --- | --- | --- | --- | --- |
| 8 | 0.445313 | 0.526315789474 | 0.526315789474 | 0.00e+0 |
| 10 | 0.368164 | 0.538461538462 | 0.538461538462 | 0.00e+0 |
| 12 | 0.405762 | 0.497593261131 | 0.497593261131 | 0.00e+0 |

This is the amplitude-level content of PostBQP = PP (AAR04, cited): postselection converts counting into a single-branch readout. The branch weight |{g}|/2^n IS the price — the same coin. Power and depreciation are one entry in two columns.

## B. retrocausal-cache — the no-signaling withdrawal clause

Registers A (x) B (x) E; random states; the receiver B never appears in any operation.

| trial | joint HS (unitary) | B marginal (unitary) | joint HS (CPTP) | B marginal (CPTP) |
| --- | --- | --- | --- | --- |
| 0 | 0.936628 | 2.78e-16 | 0.904109 | 2.78e-16 |
| 1 | 0.959046 | 1.67e-16 | 0.657381 | 8.41e-17 |
| 2 | 0.898737 | 2.22e-16 | 0.837757 | 8.33e-17 |
| 3 | 0.929392 | 5.55e-17 | 0.829581 | 1.11e-16 |
| 4 | 0.950153 | 1.67e-16 | 0.803054 | 8.33e-17 |
| 5 | 0.997061 | 1.11e-16 | 0.973210 | 5.72e-17 |
| 6 | 1.059376 | 1.67e-16 | 0.782288 | 1.11e-16 |
| 7 | 0.953330 | 1.11e-16 | 0.833058 | 1.67e-16 |
| 8 | 0.930400 | 7.47e-17 | 0.897658 | 8.33e-17 |
| 9 | 1.056165 | 2.22e-16 | 0.937026 | 1.67e-16 |

**B1 marginal invariance holds**: arbitrary local unitary AND arbitrary local CPTP map (Stinespring unitary on A + fresh ancilla, traced out) leave the B-side marginal at float zero (worst deviation 2.78e-16) while the JOINT state visibly moves (min HS distance 0.6574). The answer exists — in the correlation. The receiver cannot withdraw it: the A half must be delivered, over a classical channel whose latency floor is distance/c.

### B2. Correlation-without-signature anchor (singlet)

A measured along 24 random axes, outcomes forgotten: B marginal stays EXACTLY I/2 (max deviation 1.67e-16). Correlations follow -a.b in closed form (max error 3.33e-16); CHSH at the standard angles reaches 2.828427124746189 vs 2*sqrt(2) = 2.828427124746190 (error 8.88e-16).

Correlation is real to 15 decimals; signaling is zero to 15 decimals. The formalism offers both at once — the cache's "hit rate 100%" is the correlation column, its "withdrawal" is blocked by the marginal column.

## C. The genealogy register — the letter, atomized

The five-epoch letter decomposed into its 17 separable testable claims; each maps to the atlas row that carries its verdict. No claim unenrolled, no row padded:

| # | epoch | the letter's claim | atlas row | verdict | disposition |
| --- | --- | --- | --- | --- | --- |
| #01 | 1 | Fault-tolerant quantum computing — archive technology of epoch 1 | qaoa-heuristic | HEURISTIC | logical-layer p=128 depth monotonicity, resource estimates (ft-qaoa cross-prototype) |
| #02 | 1 | Quantum networking | quantum-network-sched | HEURISTIC | entanglement distribution as the schedulable resource (ent-sched) |
| #03 | 1 | QAOA | qaoa-heuristic | HEURISTIC | engineering claims, sized and reproducible — no class movement |
| #04 | 1 | The time capsule's numbers: effective 80 qubits, NP-hard 5/5 | subspace-exact-platform | HEURISTIC | exact at benchmarked sizes; 'effective' = subspace equivalence, ownership audited |
| #05 | 2 | The quantum switch liberates causal order | order-as-resource | HW-WAIT | capacity advantage certified (ESC18), machine-verified in switch-sched |
| #06 | 2 | 'Allocate or execute first' loses its definition — the scheduler no longer orders tasks | order-as-resource | HW-WAIT | the stronger half is walled (measurement / advantage catalog / mechanism); order is superposable, not abolishable |
| #07 | 3 | Many-worlds sorter: postselection reads the optimum in O(1) | postselect-sort | CONDITIONAL-WALL | true in-branch (fidelity 1); the ledger repays at classical-random rates |
| #08 | 3 | Retrocausal cache: answers arrive before questions, hit rate 100% | retrocausal-cache | INFO-WALL | correlations real to 15 decimals; withdrawal needs the classical channel |
| #09 | 4 | Vacuum compiler: programs written into the ground state, the universe executes | vacuum-execution | MECHANISM-SETTLED | MECHANISM-SETTLED — FK deed machine-certified (vacuum-compiler T1/T3) |
| #10 | 4 | Time crystals as the clock wall — zero-energy eternal beat | dtc-clock | MECHANISM-SETTLED | MECHANISM-SETTLED at the model layer (dtc-clock): the beat clocks universal reversible computation, zero net work on the ideal beat — hardware cells stay with MI22 |
| #11 | 4 | The second law is a disclaimer clause, not a limit | readout-tariff | MECHANISM-SETTLED | the clause has a tariff schedule (vacuum-compiler T4) — every readout mode pays |
| #12 | 4 | Entanglement-denominated settlement: Bell pairs as money | bell-money-exclusivity | MECHANISM-SETTLED | exclusivity is physical (GHZ ceiling 1/sqrt(2), threshold > 1/2 admits one) |
| #13 | 4 | No-cloning underwrites every contract for free | bell-money-exclusivity | MECHANISM-SETTLED | as notary: yes (WZ82); as binding: no — the audit-added no-go lives in quantum-binding |
| #14 | 5 | Scheduling is no longer computation but a physical law | dsic-noether | MECHANISM-SETTLED | gauge group + welfare-gap charge now machine-verified (dsic-noether); the epoch-5 superstructure stays in choice-primitive |
| #15 | 5 | 'Choice' as a language primitive — the desired world as a stable solution | choice-primitive | MECHANISM-SETTLED | MECHANISM-SETTLED — the model exists at BOTH layers (choice-lang + stable-world); nature's instantiation not claimed |
| #16 | 5 | DSIC is a special case of Noether symmetry | dsic-noether | MECHANISM-SETTLED | charge exhibited: the welfare gap, bitwise gauge-invariant (dsic-noether T1-T4); literal continuum derivation NOT claimed |
| #17 | conduct | The depreciation of the other universes must be booked | postselect-sort | CONDITIONAL-WALL | the conduct rule, executed as the depreciation ledger — 1/P_success per readout |

Audit-added genealogy rows (from the epoch audit, not the letter itself): quantum-binding — kept because their certificates stand on their own.

The count is auditable: claims 01-04 (epoch 1), 05-06 (epoch 2), 07-08 (epoch 3), 09-13 (epoch 4), 14-16 (epoch 5), 17 (conduct rule). Every claim carries the same three-part enrollment as every scheduling row: verdict, certificate, cost.

## Honest boundaries

- PostBQP = PP is CITED (AAR04), not re-proven. The machine executes the cost accounting of postselected search and the counting-ratio readout — the class equality stays on the citation's authority.
- No-signaling here is quantum mechanics' own (GRW80, cited): the certificate verifies the formalism's marginal invariance on exact instances. Superquantum no-signaling theories are out of scope; nothing here rules them in or out.
- The latency floor distance/c is special relativity QUOTED, not derived in this repo.
- The register maps claims to rows by content; audit-added rows (not lettered) are reported in the register section, never hidden — padding a row to reach a count would show up as an orphan.
- The Grover comparison runs at the certain-answer standard (k iterations + 1 verification, restart on failure; E* = min_k (k+1)/p_k over the repo's exact closed forms); asymptotic constants (the pi/4 prefactor) belong to the cited theorem, per the atlas's existing clause.
