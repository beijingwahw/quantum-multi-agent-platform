# The BQP x NP Scheduling Complexity Atlas

Every row carries certificates; `npm test` re-runs the machine ones.

## P-EXACT (2)

Already exactly polynomial — there is nothing left to accelerate.

| problem | classical | quantum upper | quantum lower | certificates |
| --- | --- | --- | --- | --- |
| F2||Cmax — two-machine flow shop | P | already exact and near-linear; polylog quantum tricks are immaterial | not applicable — the optimum is computable exactly | machine-reduction:src/reductions/johnson.ts; citation:JOHNSON54 |
| Linear sum assignment (the platform's linear track) | P | polylog-factor tricks at best | ordered searching requires Θ(log N) quantum queries (HNS01) — comparison-type ordering primitives resist super-logarithmic quantum relief | citation:KUHN55; citation:HNS01; cross-prototype:ds_extracted/ds |

## CONDITIONAL-WALL (5)

NP-hard: an exact polynomial quantum algorithm would imply NP ⊆ BQP (one shared, visible conditional).

| problem | classical | quantum upper | quantum lower | certificates |
| --- | --- | --- | --- | --- |
| P2||Cmax — two identical machines, minimize makespan | NP-hard (weak) | exact Grover enumeration in O*(2^{n/2}); FPTAS unchanged | black-box cap (2q+1)²/N; polynomial exact ⟹ NP ⊆ BQP | machine-reduction:src/reductions/partition.ts; machine-fptas:src/reductions/fptas.ts; machine-bbbv:src/lower/bbbv.ts |
| P||Cmax — identical machines, machine count part of the input | NP-hard (strong) | Grover enumeration O*(2^{n/2}); heuristics only beyond that | same conditional wall, now robust to unary encoding | machine-reduction:src/reductions/threepartition.ts; citation:GJ75; citation:GJ78 |
| F3||Cmax — three-machine flow shop (and beyond) | NP-hard (strong) | Grover enumeration; QAOA heuristics | conditional wall (same class as P||Cmax) | citation:GJS76 |
| The conditional wall itself: exact polynomial quantum algorithms for NP-hard scheduling | NP-complete chain | BQP membership for the NP-hard tracks is exactly the open question | widely believed NP ⊄ BQP; oracle evidence exists (BBBV97 relative to oracles) | machine-reduction:src/reductions/threepartition.ts; citation:BBBV97 |
| Postselected exact selection — 'the many-worlds sorter': read the marked schedule in O(1), conditional on postselection | no free postselection | deterministic readout ON the postselected branch (fidelity 1.000000000000 with |x*> at t=1, machine-checked) | the depreciation ledger: P_success = t/N exactly; the ledger never beats Grover-with-restart E* = min_k (k+1)/p_k at the same certain-answer standard, and the gap grows ~sqrt(N/t) | machine-postselect:src/genealogy/postselect.ts; cross-prototype:postselect-sched; cross-prototype:survivor-census; cross-prototype:depreciation-ledger; citation:AAR04 |

## QUERY-WALL (1)

Black-box access is capped at quadratic — the (2q+1)²/N certificate, machine-checked.

| problem | classical | quantum upper | quantum lower | certificates |
| --- | --- | --- | --- | --- |
| Black-box exact optimization over the schedule space | exponential | Grover O(√N) queries, optimal up to constant | success ≤ (2q+1)²/N after q oracle queries (BBBV97) — machine-checked on exact evolutions | machine-bbbv:src/lower/bbbv.ts; machine-classical:src/lower/classical.ts; citation:BBBV97 |

## HW-WAIT (5)

A certified (typically quadratic) quantum speedup exists; it waits on fault-tolerant hardware.

| problem | classical | quantum upper | quantum lower | certificates |
| --- | --- | --- | --- | --- |
| Exact schedule search by amplitude amplification | 2^n queries | O(2^{n/2}) oracle queries, success ≥ 0.99 at k* ≈ (π/4)√N — machine-verified | cannot beat √ (BBBV) — quadratic, not exponential | machine-grover:src/upper/grover.ts; machine-bbbv:src/lower/bbbv.ts |
| Dürr-Høyer minimum-schedule finding | N evaluations | O(√N) expected oracle queries, executed with per-query accounting | Ω(√N) — minimum finding contains search (unique-min valuations) | machine-grover:src/upper/dhmin.ts; citation:DH96 |
| Branch-and-bound with quantum minimum finding | T nodes explored | O(√T · poly) — quadratic in the explored tree (MONT19) | quadratic only; bound quality stays classical | citation:MONT19 |
| Quantum walk speedup of backtracking | T nodes | O(√T · poly(n)) (MONT18) | quadratic only | citation:MONT18 |
| Order as an optional resource — 'the quantum switch makes allocate-first-or-execute-first lose its definition; the scheduler no longer orders tasks' | fixed-order composition | switched order carries information no fixed order can: zero+zero capacity channels transmit jointly under the switch (ESC18), machine-verified (T = 1/2 on replacers, exact linear law T_joint = p/4) | no scheduling acceleration: realistic alloc/exec pairs — the best fixed order dominates at every gamma (D(switch) = (1-gamma)/2); admission only for crossing-type erasure payloads; mechanism direction order-free (U_sw = (U_def + U_BA)/2) | cross-prototype:switch-sched; cross-prototype:causal-ineq; cross-prototype:k-switch; cross-prototype:readout-wall; citation:CDP13; citation:ESC18 |

## INFO-WALL (3)

The wall is informational (online/adversarial); quantum search does not move it.

| problem | classical | quantum upper | quantum lower | certificates |
| --- | --- | --- | --- | --- |
| Online scheduling under adversarial task streams | information-theoretic | per-arrival query counts drop (O(n) → O(√n log n)); regret ledger UNCHANGED | bit-identical decisions under adversarial streams — the wall is informational, not computational | cross-prototype:qram-sched |
| Online bipartite matching competitive ratio | information-theoretic | per-arrival searches accelerate | competitive ratio caps are distributional, untouched by search speed | cross-prototype:qram-sched |
| Retrocausal cache — 'answers arrive before questions, hit rate 100%' | relativistic wall | correlations are real: the joint state carries them (machine-checked; switch-sched exp3: joint yes, machine-side receiver 0/40) | marginals exactly invariant under arbitrary local unitary AND CPTP maps (machine-checked to 1e-16); withdrawal requires the classical channel — latency floor distance/c | machine-nosignal:src/genealogy/nosignal.ts; cross-prototype:switch-sched; cross-prototype:retro-cache; cross-prototype:nosignal-tariff; citation:GRW80 |

## VERIFICATION-GAP (3)

The quantum side changes the witness structure (QMA / StoqMA), not the search speed.

| problem | classical | quantum upper | quantum lower | certificates |
| --- | --- | --- | --- | --- |
| Stoquastic annealing scheduling (ZZ couplers of any sign + negative transverse driver) | NP-hard | annealing heuristics; no exponential advantage known | ground-state VERIFICATION lands in StoqMA (BDOT08) — strictly weaker witness structure than QMA unless classes collapse | machine-stoq:src/witness/stoq.ts; citation:BDOT08 |
| Non-stoquastic annealing (+κ XX drivers) | NP-hard + simulation barrier | annealing with genuinely quantum drivers | verification class rises to QMA-complete families (KKR06) — and the sign barrier cuts BOTH ways: it also blocks classical simulation of the quantum dynamics | machine-stoq:src/witness/stoq.ts; citation:KKR06; cross-prototype:nonstoq-anneal |
| General local-Hamiltonian scheduling decision (unconstrained Ising + arbitrary drivers) | NP-hard (and QMA on the quantum side) | QMA verifier accepts good witnesses with Born sampling (Hoeffding law, machine-checked) | soundness holds against cheating states at the same sampling cost | machine-witness:src/witness/verify.ts; citation:KKR06 |

## HEURISTIC (3)

Empirical performance claims, sized and reproducible — no complexity-class movement.

| problem | classical | quantum upper | quantum lower | certificates |
| --- | --- | --- | --- | --- |
| QAOA on scheduling instances | n/a | approximation quality; depth-monotone on logical qubits (platform: 5/5 exact hits on the NP-hard track at the benchmarked sizes) | no complexity-class movement claimed, none demonstrated | cross-prototype:ft-qaoa; cross-prototype:ds_extracted/ds |
| Quantum-network task allocation — entanglement distribution itself as the schedulable resource (relays, purification ladders, delivery deadlines) | engineering | ERS meets strict QoS windows where asap/late/TDM deliver zero (0.666/round at F-bar 0.979, three concurrent flows on a six-node ladder network) | pathologies machine-verified: swap-asap freezes into deadlock without release as a first-class primitive; purification ladders need >= 4 storage slots per link below F = 0.95 | cross-prototype:ent-sched |
| The time capsule's own numbers — 'effective 80 qubits, NP-hard track 5/5' | exact at benchmarked sizes | exact constrained-subspace evolution at effective 80 qubits (full-space simulation would need ~10^15 TB); seeded, reproducible | no complexity-class movement: exactness is at benchmarked sizes against exact classical referees — 'effective' is subspace equivalence, NOT 80 physical qubits | cross-prototype:ds_extracted/ds; cross-prototype:burial-record; cross-prototype:wukong-crossval; cross-prototype:mutant-census |

## MECHANISM-SETTLED (6)

A mechanism-design property settled at theorem level by exact algebra in a workspace prototype — positive or no-go; physics, not search speed.

| problem | classical | quantum upper | quantum lower | certificates |
| --- | --- | --- | --- | --- |
| Vacuum execution — 'programs written into the ground state, the universe executes them' | not applicable | Feynman-Kitaev compilation: H_prop|Psi_hist> = 0 to ~1e-15 for random circuits; clock readout at step t hands back U_t...U_1|psi_in> with fidelity EXACTLY 1 | not a speedup claim — a mechanism law: the ground state IS the computation | cross-prototype:vacuum-compiler; citation:FEY85; citation:KSV02 |
| Readout tariff — 'the second law is a disclaimer clause, not a limit' | thermodynamic accounting | the clause itemized: storage in the ground state does no work, but every readout mode pays — static: (T+1)·log2(T+1) expected erasure bits; fuel tilt: buys delivery 0.143->0.399 with cargo EXACT (covariant-subspace law) at the price of a closing spectral gap; walk: peak delivery with coherent time-energy cost | the vacuum never beats running the program: direct execution = T unitary gates, ZERO erasure | cross-prototype:vacuum-compiler; citation:LAND61 |
| Entanglement-denominated settlement — Bell pairs as collateral: is exclusivity physical? | contracts and courts | double collateral tops out at exactly 1/sqrt(2) on GHZ; an acceptance threshold above 1/2 admits at most ONE party — no-cloning is the notary (WZ82) | not a complexity claim — a physical law, machine-verified | cross-prototype:quantum-mech; cross-prototype:ent-clearing; citation:WZ82 |
| Quantum commitments — does entanglement buy binding? | escrow or courts | privacy and detection: yes — eavesdropping is noticed, losing bids stay hidden | binding: no — HJW steering lets the committer pick the ensemble decomposition after the fact (HJW93); every reveal passes at exactly 1/2 | cross-prototype:quantum-mech; cross-prototype:binding-price; citation:HJW93 |
| DSIC as a Noether symmetry — 'scheduling as physics law': is incentive compatibility the conserved charge of a symmetry? | mechanism design | the symmetry is exhibited and machine-verified: the Groves GAUGE GROUP (payments modulo h_i(b_-i), GL79) with the WELFARE GAP Phi_v(x(b)) - max Phi_v as the conserved charge (bitwise gauge-invariant, <= 0, = 0 at truth); implementability = exactness of the payment 1-form dp = -d(W_-i . x) (Rochet cyclical monotonicity: no positive cycle); the same algebra as the discrete Noether theorem executed on a variational integrator (charge drift 2.4e-14 symmetric vs 2.0 broken — fourteen orders of separation) | the literal derivation of Green-Laffont from Noether's 1918 continuum theorem is NOT proved — the unification is an isomorphism at the discrete-exactness level, and is stated as exactly that | cross-prototype:dsic-noether; cross-prototype:quantum-mech; cross-prototype:switch-sched; citation:NOE18; citation:GL79; citation:ROC87; citation:MW01 |
| 'Choice' as a language primitive — the desired world as a stable solution of the program | no model | the model now exists at BOTH layers: choice-lang compiles choose-as-primitive (denotation exact to 1.2e-16); stable-world makes the marked world the absorbing class of a fixed dissipative law — quiet on the world (deviation exactly 0), globally attractive (leakage (1-gamma)^k (1-p0) exact for every input), Lyapunov-certified (increment gamma(1-V) exact), robust at eps law-error (bounded by eps/(1-(1-eps)(1-gamma))) | not applicable — the mechanism layer is settled; what remains is nature's instantiation, which is not a complexity question | citation:NOE18; cross-prototype:route-price; cross-prototype:choice-lang; cross-prototype:stable-world |

## OPEN (1)

Annotated with the precise open question.

| problem | classical | quantum upper | quantum lower | certificates |
| --- | --- | --- | --- | --- |
| Time crystals as the clock wall — zero-energy eternal beat | not applicable | none certified — discrete time crystals are experimentally real (stable subharmonic response on a quantum processor), general-purpose zero-energy clocking is not | not applicable — no executable model exists to wall against | citation:MI22; cross-prototype:route-price |

## Machine certificates (re-executed at repro time)

| machine certificate | verdict | detail |
| --- | --- | --- |
| partition-reduction | PASS | 39 random instances, equivalence holds |
| threepartition-reduction | PASS | 42 YES / 16 NO instances vs exhaustive referee |
| johnson-exact | PASS | 25 random instances vs all-permutation brute force |
| fptas-ratio | PASS | worst observed ratio 1.0180 <= 1+eps on 60 runs |
| ising-parity | PASS | Q(z) = (2C-total)^2 per state; ground state == DP optimum |
| grover-three-way | PASS | N=1024 unique marked: k*=25, success=0.999461, classical same budget=0.024414 |
| dh-min | PASS | 6 seeds N=256 all optimal; max queries/√N = 15.38 |
| bbbv-hybrid | PASS | q=1 anchor exact 2/√N; q=1: dist 0.1250<=0.1250, succ 0.03479<=0.03516; q=4: dist 0.4951<=0.5000, succ 0.28474<=0.31641; q=8: dist 0.9594<=1.0000, succ 0.76372<=1.12891; q=12: dist 1.3640<=1.5000, succ 0.99995<=2.44141;  |
| classical-trees | PASS | full trees (8,2): 512 max=0.25; (6,3): 279936 max=0.5; spot check (64,6): max=0.09375<=0.09375 |
| stoq-dichotomy | PASS | stoq max off-diag = -1 (= -Gamma), nonstoq = 0.5 (= +kappa) |
| witness-law | PASS | coverage 1.000/1.000/1.000 at delta 0.1/0.05; rejection 1.000/1.000 |
| postselect-ledger | PASS | n=4: P=2^-4 exact, fidelity=1.000000000000, ledger/E*=4.8; n=8: P=2^-8 exact, fidelity=1.000000000000, ledger/E*=22.0; n=12: P=2^-12 exact, fidelity=1.000000000000, ledger/E*=91.5; counting ratio 0.465909 vs brute 0.465909 |
| nosignal-withdrawal | PASS | B-marginal worst 2.22e-16 under unitary+CPTP (joint HS >= 0.689); singlet marginal 1.67e-16, corr 2.22e-16, CHSH err 8.88e-16 |

## Discipline check

0 violations — every verdict is certificate-backed.
