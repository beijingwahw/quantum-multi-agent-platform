# THE MUTANT CENSUS — the error history replayed and killed, one page

> The burial record exhumed the workspace's errors (every one in two columns). This page is the other half of that ledger: the defect classes REPLAYED as nine live mutants against the shared kernel family and its standard compositions, and killed one by one by a ten-property battery that holds for every seeded input — dual-path arithmetic, negative controls, statistical kills labeled DATA. The family's byte-identity across the workspace and the 28 epoch repos' engineering hygiene are censused LIVE on every run: an unregistered drift fails the build. And the loop is closed all the way down: EVERY error the registry carries is enrolled to the guard that kills it now (E-board, live-imported — an error without an enforcement anchor cannot be buried), and the per-error question is measured where it is decidable (J-board: the equivalent-mutant boundary, censused error by error on the pilot classes). Mutation testing and property-based testing are established fields (DEM78, JIA11, CLA00, dual-sourced in citations.md); the executable claim here is the coupling — a machine-audited error registry feeding the operator set, physics invariants as the oracle, zero dependencies. It renders only because the checker passed.

## M-board — the kill register (mutation census)

| id | defect (re-enacted) | provenance (the real error) | killer | verdict | margin |
| --- | --- | --- | --- | --- | --- |
| MU1 | vInner returns the CONJUGATE of the true inner product (imaginary sign flipped) | the conjugation-side sign error, THREE recurrences: batch 10 (qverify, expPauli), batch 28 (wukong-crossval, applyCost real part), batch 29 (survivor-census, <A|B> imaginary part) | P2 | EXACT-KILL | 1.8e+0 |
| MU2 | vecToRho builds rho-CONJUGATE (the imaginary block sign-flipped: rho*) — a matrix that is still Hermitian, still trace 1, still PSD | batch 20 (retro-cache): rho_03 = psi_0 conj(psi_3) written without the conjugate — |Phi_-theta> instead of |Phi_theta>, every sin-theta correlation flipped; statehood checks never saw it, the phase did | P2 | EXACT-KILL | 1.0e+0 |
| MU3 | embedWorld inflates the register: the cargo is embedded as if it already carried the world bit — an 8x8 state from a 2x2 cargo, silently accepted | batch 31 (stable-world): inWorldState embedded a 4x4 full state as if it were the 2x2 cargo, mAdd accepted the shape mismatch without a word — the family's adder does not check shapes (recorded there as a design boundary) | P2 | EXACT-KILL | 4.0e+0 |
| MU4 | measureWorldQubit applies the bare 2x2 projector straight to the 4x4 state — the (x) I is missing | batch 24 (nosignal-tariff): measureQubit0 forgot the (x)I — the 2x2 projection hit the 4x4 state and the stack refused it on the spot | P5 | CRASH-KILL | crash |
| MU5 | conditionalOn normalizes by the JOINT probability element rho[w,data=0; w,data=0] instead of the block-trace marginal | batch 21 (route-price): conditionalData divided by the joint probability cell, not the block trace — the leakage check screamed maxdiff 190 until the conditioning object was named | P5 | EXACT-KILL | 3.6e+3 |
| MU6 | the law's second Kraus operator is written at the transposed index — damping flows OUT of the world instead of into it | batch 31 (stable-world): |1><0| written with the flat index 1 instead of row-major (1,0) — the damping would flow toward the boundary | P6 | EXACT-KILL | 8.5e-1 |
| MU7 | limitObject returns the DEPHASED TWIN (diagonal blocks stay in place) instead of the into-world collapse | batch 31 (stable-world): the law's limit was first written as 'diagonal blocks stay' — the dephased twin; the true limit carries |0,x> into |1,x>, the 1e-12 assertion convicted the wrong object on the spot | P7 | EXACT-KILL | 8.4e-1 |
| MU8 | mcOutsideAtK counts 'EVER left the world by step K' instead of 'outside AT step K' — the chain has return flow, the two events differ by an order of magnitude | batch 31 (stable-world): the MC censused 'ever left within K steps' while the closed form priced 'outside at step K' — 682 sigma apart until the MC re-simulated the same event | P8 | DATA-KILL | ~588 sigma |
| MU9 | postselectedFreq divides the success count by the TOTAL number of draws instead of the number of ACCEPTED samples | batch 19 (postselect-sched): MC conditional frequencies divided by the total sample count — the denominator is the accepted count only, branch-world population counts branch residents | P9 | DATA-KILL | ~67 sigma |

9 mutants, 9 kills as declared, zero survivors: 6 exact kills (deviations orders above tolerance), 1 crash kill (the family's own shape guard refusing the missing tensor identity — the way batch 24 actually died on the spot), 2 statistical kills (the same-event and same-denominator disciplines). Every row carries its provenance; nothing here is a toy mutant.

## P-board — the property battery (property-based census)

| id | property | grade | inputs | worst | tripper |
| --- | --- | --- | --- | --- | --- |
| P1 | shape guard: mismatched mMul throws, matched shapes produce the declared shape | EXACT | 180 | 0.0e+0 | NC-P1 (a shape-blind mMul returns garbage without a word) |
| P2 | statehood AND phase: rho Hermitian, trace 1, PSD; vInner matches the elementwise second path; the embedding lands on the declared register; the sector coherence carries its phase (e^{i phi}/2 exactly — conjugation survives statehood, not the phase) | EXACT | 160 | 4.4e-16 | MU1 (conjugated vInner), MU2 (conjugated vecToRho — invisible to statehood, killed by the phase), MU3 (8x8 embedding) |
| P3 | algebra: outer(a,b)|dagger = outer(b,a) elementwise; random unitaries unitary to the rounding floor; unitary action preserves statehood | EXACT | 120 | 6.7e-16 | NC-P3 (an outer that conjugates the wrong side breaks the identity) |
| P4 | CPTP: random Stinespring Kraus sets preserve trace, Hermiticity and positivity on every input | EXACT | 60 | 6.7e-16 | NC-P4 (Kraus scaled by 1.1 — trace 1.1, not a channel) |
| P5 | measurement: world-qubit Born probabilities sum to 1 and match the block masses; the conditional state is trace-1 and equals the block-trace filter | EXACT | 140 | 4.4e-16 | MU4 (bare projector without (x)I — crashes on the shape guard), MU5 (joint-element denominator) |
| P6 | absorption: the membership charge never drops under the law, in-world states are fixed points, leakage is (1-gamma)^k (1-p0) exactly | EXACT | 200 | 6.7e-16 | MU6 (transposed Kraus index — the law damps OUT of the world) |
| P7 | asymptote: 200 steps of the law land on the into-world collapse of the initial state (blocks summed into the world, cargo riding) — not the dephased twin | EXACT | 60 | 1.6e-13 | MU7 (the limit object written as the dephased twin — blocks staying in place) |
| P8 | same-event MC: the simulated frequency of 'outside the world AT step K' matches the two-rate closed form within 5 sigma | DATA | 150000 | 0.5 sigma | MU8 (the MC counts 'EVER left by K' — a different event, an order of magnitude apart) |
| P9 | postselected frequency: successes divided by ACCEPTED samples land on the exact conditional probability within 5 sigma | DATA | 20000 | 1.5 sigma | MU9 (the total-count denominator — 0.18 against 0.6) |
| P10 | no-signaling on SETTINGS: B's marginal is invariant under every A-side unitary on every maximally entangled state — and the CNOT control proves the checker can move | EXACT | 800 | 5.6e-16 | NC-P10 (the CNOT copier — a nonlocal gate the checker must catch) |

## Negative controls — the battery can FAIL

- FIRES — NC-P1 shape-blind product: P1 against the shape-blind product: 0/120 mismatched products threw; 60/60 matched products returned the declared shape — the guard property fires
- FIRES — NC-P3 lopsided outer (element (0,1) doubled): P3 against the lopsided outer: outer identity 6.08e-1; U|dagger U = I 5.55e-16; action statehood 6.66e-16 — the algebra identity fires; mirror-symmetric corruptions are invisible to it and are killed by P2's phase instead
- FIRES — NC-P4 non-CPTP Kraus (x1.1): P4 against the scaled Kraus set: trace drift 2.10e-1; worst negative eigenvalue -1.08e+0; Hermitian everywhere — trace preservation fires

## K-board — the kernel family census (live)

Canonical hashes (sha256/16): cmat.ts=70369052cdbf4714, states.ts=a9c6e43a93158d4c, channels.ts=8f1f9b8806364be1, rng.ts=923f757b556d2542, measures.ts=00432a11fbf10a3d. Across 140 repo-file pairs: 76 NOT-PRESENT, 22 REGISTERED-DIVERGENCE, 42 IDENTICAL.

| registered divergence | reason |
| --- | --- |
| readout-wall/src/core/cmat.ts | 2026-09-06 strict-mode upgrade: this member's own repair variant; re-convergence is the appeal court's call |
| readout-wall/src/core/channels.ts | 2026-09-06 strict-mode upgrade: this member's own repair variant; re-convergence is the appeal court's call |
| binding-price/src/core/channels.ts | the v0.2.0 noisy-commit census appended its own noise face to the canon (dephaseKraus, ampDampKraus with the strength guard, noiseKraus, applyNoise — the quantum-mech channels.ts precedent one wave later); the canon's face is untouched above the append; re-convergence is the appeal court's call |
| ent-clearing/src/core/channels.ts | the v0.2.0 purification desk and GHZ bank appended partialTranspose to the canon (the negativity/per-cut machinery); the canon's face is untouched above the append; re-convergence is the appeal court's call |
| ent-clearing/src/core/measures.ts | the 2026-09-06 strict-mode window's last live cmat-adjacent variant: this member's measures.ts still carries its own repair placement (the wave's other variants re-converged; this one did not) — re-convergence is the appeal court's call |
| quantum-mech/src/core/states.ts | an independent states module, reconciled on 2026-09-06 onto the strict-mode canon with its original anchors (RPLUS, LPLUS, BELL_PHI_PLUS, bellState, ghz, w3, werner, HADAMARD, randomPureState, valueKet) appended; shares the other files where byte-identical |
| quantum-mech/src/core/channels.ts | the v0.2.0 erasure-robustness census appended its own noise face to the canon (phaseFlipKraus, amplitudeDampKraus with the gamma guard, applyQubitChannel the register-wide applier; import line widened for identity/kronAll) — the canon's face is untouched above the append; re-convergence is the appeal court's call |
| qverify/src/core/states.ts | an independent states module (plus its own gates.ts), reconciled on 2026-09-06 onto the strict-mode canon with its original qverify extensions (fromVec, equatorial, equatorialRho, bellState, schmidtState, wernerFidelity, randomTwoQubitMixed, PAULIS, HADAMARD) |
| causal-ineq/src/core/cmat.ts | a collateral cmat lineage, single-repo |
| k-switch/src/core/cmat.ts | a collateral cmat lineage, single-repo |
| vacuum-compiler/src/core/cmat.ts | a collateral cmat lineage, single-repo |
| bqp-map/src/core/rng.ts | the atlas's own rng, predating the family canon |
| qram-sched/src/core/rng.ts | the scheduler's own rng lineage |
| dsic-noether/src/core/rng.ts | own rng lineage |
| ent-sched/src/core/rng.ts | own rng lineage |
| ft-qaoa/src/core/rng.ts | own rng lineage |
| nonstoq-anneal/src/core/rng.ts | own rng lineage |
| phase-law/src/core/rng.ts | the v0.6.0 dead-export purge removed this member's unused rng exports (the E face of the quality wave; the template-era cmat/states/measures/channels files were deleted outright and read NOT-PRESENT); re-convergence is the appeal court's call |
| nosignal-tariff/src/core/cmat.ts | the v0.3.0 absorption sweep deleted this member's unused cmat exports (21 dead faces, grep-verified zero-reference; states.ts was deleted outright and reads NOT-PRESENT); the canon's face is untouched above the deletions; re-convergence is the appeal court's call |
| nosignal-tariff/src/core/channels.ts | the v0.3.0 absorption sweep deleted this member's unused channels exports (4 dead faces, grep-verified zero-reference); the canon's face is untouched above the deletions; re-convergence is the appeal court's call |
| nosignal-tariff/src/core/measures.ts | the v0.3.0 absorption sweep deleted this member's unused measures exports (4 dead faces, grep-verified zero-reference); the canon's face is untouched above the deletions; re-convergence is the appeal court's call |
| nosignal-tariff/src/core/rng.ts | the v0.3.0 absorption sweep deleted this member's unused rng exports (4 dead faces, grep-verified zero-reference); the canon's face is untouched above the deletions; re-convergence is the appeal court's call |

5 epoch members byte-identical in all 5 files (choice-lang, dtc-clock, letter-audit, stable-world, switch-sched — plus this census itself, the canon); partial members: binding-price shares 4 of 5, bqp-map shares 0 of 1, causal-ineq shares 0 of 1, dsic-noether shares 0 of 1, ent-clearing shares 3 of 5, ent-sched shares 0 of 1, ft-qaoa shares 0 of 1, k-switch shares 0 of 1, nonstoq-anneal shares 0 of 1, nosignal-tariff shares 0 of 4, phase-law shares 0 of 1, qram-sched shares 0 of 1, quantum-mech shares 3 of 5, qverify shares 4 of 5, readout-wall shares 3 of 5, vacuum-compiler shares 0 of 1. The law is symmetric: an unregistered drift fails the build, and so does a stale registration — the register must match reality exactly.

## W-board — the workspace hygiene census (live)

| repo | scripts | strict | unguarded entries | platform | reports on disk |
| --- | --- | --- | --- | --- | --- |
| bqp-map | Y | Y | 0 | — | 6 |
| depreciation-ledger | Y | Y | 0 | — | 1 |
| route-price | Y | Y | 0 | — | 1 |
| burial-record | Y | Y | 0 | — | 1 |
| readout-wall | Y | Y | 0 | — | 1 |
| nosignal-tariff | Y | Y | 0 | — | 1 |
| choice-lang | Y | Y | 0 | — | 1 |
| binding-price | Y | Y | 0 | — | 1 |
| letter-audit | Y | Y | 0 | — | 1 |
| wukong-crossval | Y | Y | 0 | — | 1 |
| survivor-census | Y | Y | 0 | — | 1 |
| ent-clearing | Y | Y | 0 | — | 1 |
| postselect-sched | Y | Y | 0 | — | 6 |
| retro-cache | Y | Y | 0 | — | 6 |
| stable-world | Y | Y | 0 | — | 1 |
| qverify | Y | Y | 0 | — | 0 |
| qram-sched | Y | Y | 0 | — | 6 |
| nonstoq-anneal | Y | Y | 0 | — | 0 |
| quantum-mech | Y | Y | 0 | — | 0 |
| ent-sched | Y | Y | 0 | — | 0 |
| vacuum-compiler | Y | Y | 0 | — | 4 |
| dsic-noether | Y | Y | 0 | — | 7 |
| ft-qaoa | Y | Y | 0 | — | 0 |
| switch-sched | Y | Y | 0 | — | 0 |
| causal-ineq | Y | Y | 0 | — | 5 |
| k-switch | Y | Y | 0 | — | 5 |
| dtc-clock | Y | Y | 0 | — | 1 |
| phase-law | Y | Y | 0 | — | 1 |
| ds_extracted/ds | Y | Y | 0 | exempt-registered | 0 |

The pre-batch-21 guard debt was PAID in batch 33: 42 experiment entries across 11 repos retrofitted with the house entry guard, every affected gate re-run green, repro verified on all three retrofit shapes (call-wrap, run-wrap, whole-file wrap). The legacy register is now EMPTY and the ratchet is absolute: an unguarded render entry anywhere in the epoch repos fails the build — there is no exemption path left. The platform repo is censused under its registered exemption: test + typecheck mandatory, `repro` is the GENESIS-A bench debt (ledger row #03), not a missing flag.

## E-board — the enrollment census (every buried error, live)

The registry is imported LIVE on every run: 608 errors across 84 batches, each wired to the guard that kills it NOW. The registry is closed — burying a new error without enrolling it fails the build (E1); a guard that is not on disk fails the build (E3); a booked line without a reason fails the build (E4).

| tier | errors | meaning |
| --- | --- | --- |
| MUTANT-KILLED | 117 | the error's registered class is replayed as a live mutant and killed by the battery (class tie, E2) |
| GATE-ENFORCED | 285 | recurrence fails a real build gate; the anchor file+needle verified live (E3) |
| BOOKED-UNENFORCEABLE | 206 | no machine can hold this line; the reason is mandatory and printed below (E4) |

| category | MUTANT | GATE | BOOKED |
| --- | --- | --- | --- |
| anchor-blindspot | 0 | 16 | 2 |
| bogus-comparison | 0 | 9 | 3 |
| citation-drift | 0 | 21 | 4 |
| conjugation | 19 | 10 | 0 |
| dimension-slot | 29 | 11 | 0 |
| machine-overruled | 0 | 47 | 0 |
| process | 0 | 65 | 139 |
| statistics | 25 | 20 | 3 |
| toolchain | 0 | 57 | 47 |
| wrong-object | 44 | 29 | 8 |

| live gate anchor | errors held | categories |
| --- | --- | --- |
| `dtc-clock/package.json :: test` | 22 | citation-drift, machine-overruled, process, toolchain, wrong-object |
| `mutant-census/package.json :: typecheck` | 9 | machine-overruled, process, toolchain |
| `dtc-clock/package.json :: typecheck` | 9 | machine-overruled, process, toolchain |
| `ds_extracted/ds/package.json :: test` | 8 | bogus-comparison, citation-drift, machine-overruled, process |
| `mutant-census/src/kernel/audit.ts :: W-C` | 8 | anchor-blindspot, process |
| `dsic-noether/package.json :: test` | 8 | conjugation, machine-overruled, process, toolchain, wrong-object |
| `mutant-census/package.json :: test` | 8 | machine-overruled, process |
| `mutant-census/package.json :: lint` | 7 | machine-overruled, process, toolchain |
| `burial-record/package.json :: test` | 7 | process |
| `mutant-census/src/kernel/audit.ts :: Q4` | 6 | bogus-comparison |
| `nonstoq-anneal/package.json :: test` | 6 | machine-overruled, wrong-object |
| `stable-world/package.json :: typecheck` | 6 | citation-drift, process, toolchain |
| `burial-record/src/kernel/audit.ts :: B4` | 5 | citation-drift |
| `phase-law/package.json :: test` | 5 | machine-overruled, process, wrong-object |
| `ds_extracted/ds/package.json :: format:check` | 4 | toolchain |
| `dsic-noether/package.json :: lint` | 4 | process, toolchain, wrong-object |
| `ent-sched/package.json :: test` | 3 | machine-overruled |
| `mutant-census/src/kernel/battery.ts :: PHASE-SENSITIVE` | 3 | anchor-blindspot |
| `dtc-clock/package.json :: lint` | 3 | machine-overruled, toolchain |
| `postselect-sched/package.json :: typecheck` | 3 | toolchain |
| `mutant-census/test/selfreport.test.ts :: smuggle S2-a (散文对账): a tampered rendered number is convicted naming the drifted field` | 3 | process |
| `ds_extracted/ds/package.json :: typecheck` | 2 | machine-overruled, toolchain |
| `ft-qaoa/package.json :: test` | 2 | process, toolchain |
| `bqp-map/package.json :: test` | 2 | process, toolchain |
| `mutant-census/src/kernel/census.ts :: unguardedEntryFiles` | 2 | anchor-blindspot, toolchain |
| `mutant-census/scripts/total-gate.ts :: typecheck` | 2 | anchor-blindspot, toolchain |
| `mutant-census/package.json :: repro` | 2 | anchor-blindspot, process |
| `phase-law/package.json :: typecheck` | 2 | machine-overruled, toolchain |
| `stable-world/package.json :: test` | 2 | process |
| `mutant-census/test/census.test.ts :: E7` | 2 | process |
| `nonstoq-anneal/package.json :: typecheck` | 2 | toolchain, wrong-object |
| `depreciation-ledger/src/kernel/audit.ts :: L2` | 1 | process |
| `ds_extracted/ds/tsconfig.json :: exactOptionalPropertyTypes` | 1 | toolchain |
| `ft-qaoa/tsconfig.json :: exactOptionalPropertyTypes` | 1 | toolchain |
| `depreciation-ledger/src/kernel/audit.ts :: L1` | 1 | process |
| `qram-sched/package.json :: test` | 1 | machine-overruled |
| `switch-sched/package.json :: test` | 1 | machine-overruled |
| `depreciation-ledger/src/kernel/audit.ts :: L6` | 1 | bogus-comparison |
| `k-switch/package.json :: test` | 1 | machine-overruled |
| `vacuum-compiler/package.json :: test` | 1 | machine-overruled |
| `readout-wall/package.json :: typecheck` | 1 | citation-drift |
| `nosignal-tariff/package.json :: test` | 1 | toolchain |
| `survivor-census/package.json :: test` | 1 | toolchain |
| `ent-clearing/package.json :: typecheck` | 1 | toolchain |
| `mutant-census/src/kernel/audit.ts :: Q2` | 1 | machine-overruled |
| `mutant-census/src/kernel/audit.ts :: provenanceRepos` | 1 | citation-drift |
| `mutant-census/src/kernel/audit.ts :: E2` | 1 | machine-overruled |
| `mutant-census/src/kernel/audit.ts :: E1` | 1 | machine-overruled |
| `mutant-census/test/anchors.test.ts :: A-fire L2` | 1 | citation-drift |
| `mutant-census/test/census.test.ts :: b37#7` | 1 | anchor-blindspot |
| `mutant-census/src/experiments/render.ts :: witness letters must be unique` | 1 | process |
| `burial-record/package.json :: lint` | 1 | toolchain |
| `mutant-census/src/kernel/census.ts :: rootStrayFiles` | 1 | process |
| `stable-world/package.json :: lint` | 1 | toolchain |
| `dsic-noether/package.json :: typecheck` | 1 | toolchain |
| `burial-record/src/kernel/audit.ts :: memoryStructureViolations` | 1 | process |
| `switch-sched/package.json :: lint` | 1 | toolchain |
| `switch-sched/test/process.test.ts :: identity channel gives SWAP` | 1 | conjugation |
| `switch-sched/test/process.test.ts :: eigenvalues exactly {0, ½}` | 1 | statistics |
| `switch-sched/test/process.test.ts :: 8192 vertices` | 1 | statistics |
| `route-price/test/dossier.test.ts :: R5: all executable witnesses pass` | 1 | citation-drift |
| `route-price/package.json :: lint` | 1 | toolchain |
| `causal-ineq/test/causal-ineq.test.ts :: W* eigenvalues exactly {0, 1/2}` | 1 | statistics |
| `causal-ineq/test/causal-ineq.test.ts :: OCB12 eq. (7)` | 1 | dimension-slot |
| `causal-ineq/test/causal-ineq.test.ts :: noise threshold exactly eta = 1/sqrt(2)` | 1 | process |
| `causal-ineq/package.json :: lint` | 1 | toolchain |
| `switch-sched/docs/citations.md :: 10.1038/s41467-023-40162-8` | 1 | citation-drift |
| `k-switch/test/k4.test.ts :: ZERO commuting Pauli quadruples exist at d=4` | 1 | machine-overruled |
| `k-switch/test/k4.test.ts :: constructed matched pair outside the Pauli universe` | 1 | machine-overruled |
| `k-switch/test/k4.test.ts :: the generator's Pauli ray` | 1 | conjugation |
| `k-switch/test/k4.test.ts :: Algorithm 1 reads the promise column with probability 1 exactly` | 1 | dimension-slot |
| `k-switch/test/k4.test.ts :: NO plain order separates ANY column pair` | 1 | wrong-object |
| `postselect-sched/test/t5-power-ledger.test.ts :: branch ratio = integer ratio on real 3-SAT` | 1 | statistics |
| `postselect-sched/test/t6-tieface.test.ts :: exact tie iff d | a1^2` | 1 | statistics |
| `postselect-sched/package.json :: lint` | 1 | toolchain |
| `postselect-sched/src/experiments/run-all.ts :: call the mains directly` | 1 | toolchain |
| `qram-sched/src/online/kv-tight.ts :: BigInt division with 18 kept digits` | 1 | statistics |
| `qram-sched/src/experiments/exp1-qram.ts :: the degenerate best case` | 1 | wrong-object |
| `qram-sched/src/experiments/run-all.ts :: EXPORTED main()` | 1 | toolchain |
| `quantum-mech/test/datalock.test.ts :: average is exactly I/d` | 1 | wrong-object |
| `quantum-mech/src/protocol/datalock.ts :: Σ_ij a_ij conj(b_ij)` | 1 | conjugation |
| `quantum-mech/package.json :: lint` | 1 | toolchain |
| `quantum-mech/docs/citations.md :: Rubinstein & Zhou` | 1 | citation-drift |
| `quantum-mech/docs/citations.md :: DiVincenzo, Horodecki, Leung, Smolin, Terhal & Wootters` | 1 | citation-drift |
| `retro-cache/test/w5-amplification.test.ts :: rank formula matches brute force` | 1 | process |
| `retro-cache/test/w6-adversary.test.ts :: crossing exact` | 1 | statistics |
| `retro-cache/test/w6-adversary.test.ts :: eta=0 reproduces the honest ledger` | 1 | statistics |
| `retro-cache/test/w6-adversary.test.ts :: strictly positive tax, exactly zero gain` | 1 | statistics |
| `retro-cache/package.json :: test` | 1 | process |
| `retro-cache/docs/citations.md :: Verification 2026-09-08: SIAM publisher page` | 1 | citation-drift |
| `retro-cache/src/experiments/run-all.ts :: own subprocess` | 1 | toolchain |
| `nosignal-tariff/test/theorem.test.ts :: the ln2 enclosure is tight` | 1 | statistics |
| `nosignal-tariff/src/kernel/rational.ts :: decimal long division when either limb overflows` | 1 | statistics |
| `nosignal-tariff/test/theorem.test.ts :: no inflection cell named` | 1 | wrong-object |
| `switch-sched/src/experiments/run-all.ts :: calls the mains directly` | 1 | toolchain |
| `readout-wall/src/kernel/audit.ts :: replacer closed form vs sim maxdev` | 1 | wrong-object |
| `readout-wall/test/readout.test.ts :: the ln enclosures bracket the true log on both series paths` | 1 | statistics |
| `readout-wall/test/readout.test.ts :: the slack below is for the REFERENCE` | 1 | statistics |
| `survivor-census/test/compose.test.ts :: staged kills are disjoint items` | 1 | wrong-object |
| `survivor-census/test/phasecensus.test.ts :: constantDifferenceOnFunded` | 1 | wrong-object |
| `survivor-census/test/phasecensus.test.ts :: the Fourier ramp's overlap with flat matches the closed form` | 1 | conjugation |
| `survivor-census/package.json :: lint` | 1 | toolchain |
| `survivor-census/src/experiments/run-all.ts :: \|x*>` | 1 | toolchain |
| `ent-clearing/test/clearing.test.ts :: the twirl is load-bearing` | 1 | machine-overruled |
| `ent-clearing/test/clearing.test.ts :: 24 unitaries` | 1 | wrong-object |
| `binding-price/test/market.test.ts :: marginal I/2, reveal 1/2` | 1 | statistics |
| `binding-price/test/market.test.ts :: per-coin flat at every Schmidt coefficient` | 1 | dimension-slot |
| `binding-price/src/kernel/audit.ts :: under damping the verifier's register is` | 1 | wrong-object |
| `binding-price/test/market.test.ts :: blochOf inverts blochState exactly` | 1 | conjugation |
| `qverify/package.json :: typecheck` | 1 | toolchain |
| `qverify/test/protocol.test.ts :: phaseDampingKraus` | 1 | conjugation |
| `qverify/test/protocol.test.ts :: guessAfterPhaseDamp` | 1 | machine-overruled |
| `qverify/docs/citations.md :: first-guess author attribution` | 1 | citation-drift |
| `ft-qaoa/test/ft.test.ts :: follows the power law` | 1 | statistics |
| `ft-qaoa/test/constants.test.ts :: duplicate ids are rejected` | 1 | dimension-slot |
| `ft-qaoa/test/ft.test.ts :: window-size policy prices the batching tradeoff` | 1 | statistics |
| `ft-qaoa/test/noise.test.ts :: depolarizeQubit matches an independent naive Pauli conjugation` | 1 | wrong-object |
| `choice-lang/test/model.test.ts :: the chain's weights MULTIPLY to the composed weight` | 1 | wrong-object |
| `vacuum-compiler/package.json :: lint` | 1 | toolchain |
| `dsic-noether/test/kink.test.ts :: crossing, reversed` | 1 | machine-overruled |
| `dsic-noether/test/kink.test.ts :: the charge's FLUX jumps at the kink by exactly (t - w + 1)/2` | 1 | machine-overruled |
| `dsic-noether/test/kink.test.ts :: the SIGNED win-side limit` | 1 | conjugation |
| `dsic-noether/test/kink.test.ts :: the wall-to-wall zeros are counted` | 1 | statistics |
| `letter-audit/src/kernel/audit.ts :: A6` | 1 | anchor-blindspot |
| `stable-world/test/stable.test.ts :: the ladder never inverts` | 1 | machine-overruled |
| `stable-world/test/stable.test.ts :: the law's trajectory rank, whatever it is` | 1 | wrong-object |
| `stable-world/test/stable.test.ts :: an error schedule beats constant worst-case eps` | 1 | statistics |
| `stable-world/citations.md :: writing it from memory produced 1310.6190` | 1 | citation-drift |
| `dtc-clock/test/dtc.test.ts :: L2: EXACT with unknown witness is rejected` | 1 | dimension-slot |
| `dtc-clock/test/dtc.test.ts :: SMUGGLING TRIAL: the v0.2.0 TAUTOLOGY itself` | 1 | bogus-comparison |
| `dtc-clock/test/dtc.test.ts :: TC47: Phi1 bracketed with ZERO INSIDE` | 1 | machine-overruled |
| `wukong-crossval/test/xval.test.ts :: the flip kernel is stochastic and hand-checkable at n=2` | 1 | machine-overruled |
| `mutant-census/test/selfreport.test.ts :: smuggle S1-a (板序): a section-shuffled report is convicted by name` | 1 | process |
| `vacuum-compiler/test/vacuum.test.ts :: version: "0.20.0"` | 1 | citation-drift |
| `phase-law/test/phase-law.test.ts :: PL20's integer-vs-float C_j cross-check is WITNESSED` | 1 | process |
| `postselect-sched/test/t1-sorter.test.ts :: lcgMarked(6, 3, 101), [58, 0, 0]` | 1 | process |
| `postselect-sched/test/errors.test.ts :: ERR.06 randomSat hang conviction` | 1 | wrong-object |
| `postselect-sched/test/errors.test.ts :: ERR.08 repetitionsFor conviction` | 1 | wrong-object |
| `postselect-sched/test/errors.test.ts :: ERR.09 binomTailAtMost conviction` | 1 | statistics |
| `k-switch/test/kswitch.test.ts :: shortestSupersequence(4), null` | 1 | process |
| `causal-ineq/test/causal-ineq.test.ts :: NaN grid is dead` | 1 | dimension-slot |
| `causal-ineq/docs/theory.md :: As in the README: the OCB12 equivalence is machine-checked` | 1 | process |
| `qram-sched/test/errors.test.ts :: RNG_EMPTY_PICK` | 1 | wrong-object |
| `qram-sched/test/errors.test.ts :: GROVER_EMPTY_SCORES` | 1 | wrong-object |
| `qram-sched/test/errors.test.ts :: WALK_MU_SHAPE` | 1 | dimension-slot |
| `qram-sched/test/errors.test.ts :: WALK_NEIGHBOR_RANGE` | 1 | dimension-slot |
| `qram-sched/test/errors.test.ts :: LINALG_SHAPE` | 1 | dimension-slot |
| `qram-sched/test/errors.test.ts :: OBM_INSTANCE_SHAPE` | 1 | wrong-object |
| `quantum-mech/test/errors.test.ts :: dagger2 roundtrip basis` | 1 | anchor-blindspot |
| `quantum-mech/package.json :: test` | 1 | machine-overruled |
| `quantum-mech/package-lock.json :: 0.3.0` | 1 | citation-drift |
| `survivor-census/test/errors.test.ts :: SC/BAD-MARKED` | 1 | dimension-slot |
| `survivor-census/test/errors.test.ts :: SC/MC-BAD-INPUTS` | 1 | statistics |
| `survivor-census/test/errors.test.ts :: funded.cause.code` | 1 | wrong-object |
| `retro-cache/package.json :: typecheck` | 1 | toolchain |
| `retro-cache/package.json :: lint` | 1 | toolchain |
| `retro-cache/test/kernel-hardening.test.ts :: K.G convicted` | 1 | wrong-object |
| `retro-cache/test/kernel-hardening.test.ts :: K.H postprocessOutcome` | 1 | dimension-slot |
| `readout-wall/test/readout.test.ts :: the wrong-object lesson` | 1 | wrong-object |

**Booked unenforceable — the visible boundary, every row:**

- b2#3 [process] — TS-Python parity lives in CI; the local workspace cannot gate GitHub Actions — booked until CI is reachable
- b2#6 [toolchain] — host-interpreter assumption (python3 on this Windows box); no workspace gate commands the environment — environment lesson, process only
- b2#7 [toolchain] — push-failure diagnosis (network vs auth vs remote); operator judgment, no machine gate
- b4#3 [toolchain] — shell retry-loop exit-code semantics; the loop's honesty is the author's check — process
- b8#5 [process] — threshold policy is experiment design; what the engine schedules was corrected by hand — no gate chooses policy
- b9#5 [process] — instance-set design (brute force vs 20k random search); methodological judgment, no gate
- b9#6 [process] — instance-set strength claim; hard instances are design work, not a gate
- b10#6 [process] — search-effort budgeting (the compass grind); abandoned by judgment, nothing to enforce
- b10#8 [toolchain] — heredoc truncation — banned house-wide by hard rule (Write tool, never heredoc); dual-face since v0.10.0: the ACT is ungated (nothing sees the shell channel), the truncated-file face is a syntax death at typecheck the moment it lands; booked: the act face only
- b10#9 [process] — the diagnostic script is never the trusted side; process rule, no gate
- b11#7 [bogus-comparison] — aggregation order (sum of per-seed ratios vs ratio of sums) — comparison design; no property pins aggregation semantics, booked
- b12#6 [toolchain] — path-resolution discipline (one climb does not fit all files); dual-face since v0.10.0: a wrong root aimed at a missing file dies loudly at the gate that loads it (ENOENT), a wrong root landing on a different existing file is silent; booked: the silent face only
- b12#7 [process] — witness-before-prose; the ledger law books costs on LEDGER rows, README rounding is author honesty — unenforceable line-by-line
- b13#6 [toolchain] — heredoc-via-JSON patch pipeline — the banned heredoc class; dual-face since v0.10.0: the act is transient, the damaged-file face dies at typecheck if it lands; booked: the act face only
- b14#4 [toolchain] — tsx -e quirks under Git Bash; environment lesson, no gate
- b14#5 [process] — which rows weaken a table is editorial; the ledger's both-columns law does not judge row selection
- b19#5 [process] — README worded by the expected limit; prose honesty, no machine gate
- b21#3 [process] — hand-computed price column corrected by the witness (9977.87 -> 9977.19); witness-before-prose is process
- b22#2 [toolchain] — probe placed outside the repo (system temp); dual-face since v0.9.0: the ROOT face of the placement class is gate-held (rootStrayFiles), the system-temp face lives outside the workspace tree no scheduled gate can scan; booked: the outside-tree face only
- b22#3 [process] — law-label sequence (B0-B4 then B6) caught in self-review; no linter sequences labels
- b23#3 [process] — contract-reading on reuse (same idiom, different signature); dual-face since v0.10.0: the FAMILY-file face of the batch-23 class is gate-held (W-D byte-identity censuses it live), the non-family idiom face (report.ts) is review; booked: the non-family face only
- b25#1 [process] — third-draft discipline; drafts that never reach the machine cannot be gated — the rule is process
- b25#6 [toolchain] — heredoc truncation (render.ts) — the banned class; dual-face since v0.10.0: the act is ungated, a truncated file cannot compile — typecheck dies on the spot; booked: the act face only
- b26#1 [toolchain] — heredoc truncation (probe.ts) — the banned class; dual-face since v0.10.0: the act is ungated, the truncated file is a syntax death in the gated tree; booked: the act face only
- b27#0 [process] — design-before-code (the TM encoding collapsed twice mid-write); process
- b28#3 [process] — count-after-construction (21 built, 20 shipped); the instance census is author discipline
- b29#4 [bogus-comparison] — displayed fractions must point at their true denominator; print-layer honesty — no gate formats the register
- b29#5 [process] — draft residue reaching the machine; unused symbols are tsc-gated, live-code residue (`| ""`) is review
- b30#1 [bogus-comparison] — toExponential(6) masks 1+2.1e-8 as 1.000000e+0; display precision is print-layer, the witness columns carry the true digits — the format itself is not gated
- b30#4 [process] — audit.ts indirection residue rewritten before boarding; dual-face since v0.10.0: the in-tree faces (unused indirections, void branches) die at lint/typecheck, the live-code placeholder face is review; booked: the pre-machine draft and the live-code face
- b32#7 [process] — display heuristics (sigma vs raw units); the formatting law lives in prose, no gate parses intent
- b32#9 [process] — edit residue in mutant construction; the kill census verifies KILLS, residue-free construction is authorship
- b32#11 [process] — tree-walk style rewritten before boarding; never reached the machine — process
- b33#0 [process] — probe in /tmp again (resolves to D:\Data\Temp) — recurrence of b22#2; dual-face since v0.9.0: the ROOT face is gate-held (rootStrayFiles), the outside-tree face stays booked; booked: the outside-tree face only
- b33#2 [toolchain] — tool invocation locale (npx resolves deps from the wrong root outside the repo it serves); the sanctioned path (each repo's own npm run) is documented, not machine-forced
- b33#3 [process] — scout pipelines that swallow every signal; 'verify the filter passes signal' is process
- b34#0 [toolchain] — source surgery through bash-inline regex (escaping ate the pattern, zero replacements silently); the edit-tools-not-pipes rule is process — nothing gates the author's tooling
- b34#3 [process] — phantom call in a render.ts edit caught by pre-flight self-review; the initial draft never reaches the machine, its errors still go to the record — process
- b36#12 [process] — a metric folded under another claim's name is a labeling crime, but no gate parses field semantics — the separate field ships and the record carries the lesson
- b36#14 [process] — channel applied through dense Kraus multiplies — performance is correctness debt, but no workspace gate commands complexity; the mixture form ships
- b36#15 [process] — six-loop C^4 mis-estimated as C^3 — same class as b36#14; the block-mMul form ships, the estimate lesson is process
- b36#16 [process] — board literals drifting from witness numbers (rng consumption order); run-then-write is process — the rendered report vs witness-line read caught both drifts; since v0.22.0 the census's own report face is gate-held (S2), this repo's board literals are not that report
- b36#17 [process] — heredoc tangle, fourth offense (b10#8/b25#6/b26#1 family) — the Write-tool rule is recorded in every batch of this family; dual-face since v0.10.0: the act is ungated, the damaged-file face dies at the loader/typecheck the moment it lands (b47#1 was convicted exactly there); booked: the act face only
- b37#6 [toolchain] — shell && chains and grep exit codes; operator discipline — no workspace gate commands the author's shell
- b38#0 [process] — draft residue caught by author re-read before any run; drafts that reach the disk go to the record — no gate reads the author's editor
- b38#1 [toolchain] — tsx -e under Git Bash is silent for TS-importing one-liners (b14 family, second recurrence); the scratch-file rule is the enforcement
- b39#0 [process] — an edit anchored on a section header must restore it — splice, not eat; author re-read caught both, no gate diffs comment structure
- b40#0 [process] — the header-swallow class, offenses three and four — the rule lives in the daily memory now; no gate diffs comment structure
- b42#1 [process] — assertion anchors must be read from current text; prettier owns layout — no gate diffs intent
- b43#2 [process] — a MISS is a stop — anchor discipline on read text; no gate diffs intent
- b44#1 [process] — heredoc with template literals — the banned class; Write tool always; dual-face since v0.10.0: the structure-collapse face (unused variables, dead branches) dies at lint in-tree, the act face is ungated; booked: the act face only
- b45#3 [process] — exhaustive-cost discipline on the render's columns is an author budget call; no gate times the repro cell by cell
- b45#4 [anchor-blindspot] — grep the on-disk text before anchoring (a parenthesis is part of the anchor); no gate diffs intent
- b45#5 [anchor-blindspot] — long JSON strings get patched structurally via python json round-trip; no gate diffs intent
- b45#6 [toolchain] — the runner binary is not on the author shell's PATH; npm scripts resolve locally — no gate commands the author's shell
- b46#1 [toolchain] — tsx -e multiline under Git Bash is silent, fifth family sighting; the scratch-file rule is the enforcement — no gate commands the author's shell
- b46#3 [process] — non-ascii anchors never through heredoc; Read+Edit always — no gate diffs intent
- b47#0 [process] — law scope is design work — the pre-flight validation harness (validate against the full history before landing) is the discipline; no gate diffs a rule's intended scope
- b48#1 [process] — non-ascii anchors never through heredoc (sixth sighting, one visit after the rule was written from the fifth); Edit tool always — and the repro output is grepped for the section face before closing
- b48#2 [process] — reread after every programmatic write; the tool's refusal is the guard — no gate schedules the author's read/write interleaving
- b49#0 [toolchain] — tsx -e is never OK — the failure mode is silent, not always-fatal; the scratch-file rule is unconditional (seventh sighting)
- b49#2 [process] — scratch files live in the repo — temp-dir placement breaks relative resolution; dual-face since v0.9.0: the ROOT face is gate-held (rootStrayFiles); the system-temp face is outside the tree; booked: the outside-tree face only
- b49#3 [process] — the Bash tool layer eats one escape level even past quoted heredocs (root cause named, live-probed) — backslash-bearing code never through the Bash channel; Edit/Write exclusively
- b50#0 [process] — the backslash rule is a pre-flight checklist item, not knowledge — eighth sighting, minutes after the rule was written; Edit/Write by default
- b50#1 [process] — derivation conventions are verified by numeric probes in the scratch harness (reversibility, symmetry, orientation) — no gate reviews a derivation, the probes do
- b51#0 [process] — draft residue caught by the author's reread before any run — no gate reads drafts
- b51#4 [process] — nested quotes break in the Bash channel exactly as backslashes do — Edit tool for any code-bearing patch
- b51#5 [process] — numeric prose gets the same read-back as code — the verbatim-anchor match is what exposed the transposition
- b51#7 [process] — heading edits scope by the full unique line, never the count phrase — no gate scopes a replace; B8 catches the aftermath
- b52#0 [process] — probe points must exercise every branch — a lucky pass on an unfired path is not a proof; the scratch cross-check is the discipline
- b52#1 [process] — polynomial coefficients assemble from the whole expression factor by factor — the Richardson cross-check locates missing pieces by their exact signature
- b52#2 [process] — the backslash rule is a pre-flight checklist item (patch contains a backslash = Edit tool) — repeat sightings prove knowledge alone does not execute
- b53#0 [process] — the Edit-before-Read refusal class recurs (b48#2, twice this visit): a shell view is not a Read — the tool's read-state tracker decides; the refusal is the guard
- b54#1 [process] — the import-home class has two faces: in any file under the typecheck trees the defect fails the gate on the spot (TS2305 — the b46#2 precedent already holds that face); the SCRATCH face is transient — no build gate reviews a file deleted before gates run, and Node's first-run refusal is instant but instant is not a gate. Booked: the scratch face only
- b65#1 [process] — cross-session stale read-state — the Edit tool's read-state tracker is the line and it bit; no build gate sees another session's writes, the refusal is the guard (b48#2 class, cross-session variant)
- b55#0 [process] — reread between Write and run is a fixed step of writing — residue rides every first draft (b54#2 class, three sightings in this one visit)
- b55#1 [process] — a fix that adds text gets its own reread — the second residue lived in the replacement, minutes after enrolling the first
- b55#2 [process] — draft constructions are replaced whole, not patched around — a construction needing a dead branch to compile is the wrong construction
- b55#3 [citation-drift] — identifier-grade bibliographic digits (arXiv numbers, DOIs, volume/page) are verified against the source before writing — memory holds the shape, never the digits
- b55#5 [process] — anchors and replacement text go through the disk — grep the needle before the patch, reread the replacement (b45 edit-anchor family)
- b55#6 [statistics] — small probabilities in the cancellation-free arrangement, never 1-minus-a-near-one; a suspicious exact zero in witness output is a bug until proven a floor
- b56#0 [process] — residue is the default assumption for a first draft; reread is the factory inspection (fourth sighting of the b54#2 class)
- b56#1 [process] — a construction that needs a dead branch to compile is the wrong construction — same class, second file, same visit
- b56#2 [process] — (b54#1 class) dual-face since v0.10.0: the SCRATCH face is booked (refused at first run, gone before gates), the product-tree twin face is TS2305 on the scheduled typecheck (the b46#2 precedent — b56#3 rides it)
- b56#4 [wrong-object] — a check built on the wrong object convicts the innocent — the dephased matrix means diagonal-only; S(copy)-S(rho)=0 always
- b56#5 [wrong-object] — phase-carrying objects get phase-invariant assertions (purity + coherence bits), never equality to a fixed reference state
- b56#6 [process] — a failed patch is a stop, not a skip: multi-line patches through the Edit tool, and evidence files survive until the corrected run has produced its numbers
- b56#9 [citation-drift] — citation YEARS are identifier-grade data: memory holds the shape, the sources hold the digits (Davies 1974, not 1976)
- b57#0 [process] — 'making the checker quiet' is not cleanup — unused imports are removed, never voided
- b57#1 [wrong-object] — a closed form ships with its domain: the T=0 block form fails at finite beta where dark-pair freezing turns the mixing 2x2
- b57#2 [wrong-object] — tightness assertions compare the object being banked (the sector bit), not a convenient superset (the full-basis total)
- b57#4 [process] — arithmetic residue inside a live expression is worse than dead code — expressions get reread as formulas, not just as syntax
- b57#5 [process] — board numbers are the WITNESS's numbers: every census interval on the board is re-derived from the witness output before it ships
- b58#0 [process] — derivation conventions get their own numeric probes before assembly — the two-point eigenvalue arbiter convicted every draft (the b50 law, recurring)
- b58#1 [process] — a printed ZERO is not a finding until the loop that printed it is nonempty — vacuous evidence is the empty-set twin of a lucky pass
- b59#1 [process] — a check's arithmetic gets a known-answer test case before it is trusted (the self-dividing sup ratio could never fail)
- b59#2 [wrong-object] — conjugation/phase conventions are written down BEFORE the code — which side carries the conjugate decides the sign
- b59#3 [process] — 'this time it was harmless' is exactly how the heredoc family survives — code files go through the Write tool, no content-based exceptions
- b59#4 [process] — residue is a per-draft constant and the reread is the factory gate that assumes it
- b59#6 [process] — insertion anchors place new rows after their predecessors, and a one-line grep of the id order follows every board insertion — order is part of the face
- b59#7 [process] — multi-line needles with escapes go through the Edit tool from the start — the channel has refused the same patch class three times
- b60#0 [process] — constructions are replaced whole, not patched around (the b55 class, replayed on a different constructor)
- b60#1 [process] — residue per draft, reread per file — seven sightings across four visits: a constant of the process, not a lapse
- b60#2 [process] — the horizon is a PRE-RUN decision — a superlinear-cost face gets its census cap priced before the first run, not after a stall
- b60#3 [process] — (b54#1 class) dual-face since v0.10.0: the scratch face is booked; the product-tree face (importing a private member) is TS2305 on the scheduled typecheck — the b46#2 precedent
- b60#4 [statistics] — BigInt quotients reach floats through scaled division — the overflow twin of the cancellation lesson (b55#6)
- b60#5 [process] — read the function's actual SHAPE before patching — shape is part of the anchor
- b60#6 [process] — the channel's fourth refusal of the same patch class: prose sections go through the Edit tool, no exception clause
- b61#0 [process] — the reconciliation anchor is pinned BEFORE the reconstruction — closed forms assembled by substitution, the machine does the arithmetic
- b62#0 [process] — when an assembly path NaNs, re-choose the deliverable shape — the machine-provable form outranks the hand-assembled expression
- b62#1 [process] — the cleaning pass is practice now: unused imports removed, voids never shipped (eighth sighting, pre-caught)
- b63#0 [process] — a split condition is a definition of which side is which; dual-face since v0.10.0: the scratch-analysis face is booked, the in-tree guard-boolean face is suite-held (b61#1's inverted guard was convicted by the tests); read the orientation against one concrete k before trusting the zeros
- b63#1 [process] — the identity chain goes up BEFORE the asymptotic analysis — global factors have nowhere to hide on a chain
- b64#0 [process] — 'this time it was harmless' is the heredoc family's survival mode, tenth enrollment — scratch files go through the Write tool, no content-based exceptions
- b64#1 [process] — a Bash command is itself a deliverable — read the whole line before sending, not just the new part
- b66#5 [process] — the orientation logic lives in the renderer (exp5), which no scheduled gate runs; the SAME logic is gated in the test tree's skew case under :: test — the renderer face is unenforceable (the b54#1 dual-face precedent)
- b67#0 [toolchain] — the context-dump scratch was created through a bash heredoc — the banned channel, eleventh family sighting, committed while building the repair-audit board itself; dual-face per the family law: the act face is ungatable, the damaged-file face dies at the loader (the b47#1 twin); booked: the act face only
- b67#2 [process] — a nonsense chained identity copy (slice+concat rebuilding the same array) in a test draft caught on reread — live-code construction residue compiles and passes; the class's unused-symbol faces die at lint (b67#1 rides that face), the live-code face is review; booked: the pre-machine face
- b67#4 [process] — the b12#6 needle transcribed from memory with an added word — the Edit refused it; patch-act face, the refusal is the guard (b45#4 family); booked: the act face only
- b68#2 [process] — the daily-note insertion anchored on the visit-72 section heading and CONSUMED it (the b39#0/b40#0 class, recurrence); dual-face since v0.14.0: the AFTERMATH face (the orphaned tail line the swallow leaves, the repeated-label signature, verbatim heading doubles) is gate-held by B9 — the swallowed heading's ABSENCE has no should-exist oracle and stays booked; the section-face grep after every insertion remains the act-face discipline
- b69#0 [process] — the W-I witness detail's first draft shipped a nonsense expression and a self-note ('wait, computed below') inside the template string — caught on the post-edit reread before any machine; pre-machine draft residue (the b55#0 class), the reread is the factory check
- b69#1 [process] — the b36#7 Edit anchor was written from memory with prototype MU5 where the disk reads MU1 — the Edit refusal caught it (the b45#4 anchor-from-memory family); needles are copied from the disk, never recalled
- b70#2 [process] — a no-op assertion (Number.isNaN(0) || true) drafted into the new machine-facts test — a check that can never fail is worse than no check; caught on reread before any run; booked: the pre-machine draft face (the b59#1 class)
- b71#0 [process] — the closing verification command launched a SECOND total gate with a detached shell & — the whole line not read before sending (the b64#1 class); the stray raced the tracked instance (wall-sum 650s -> 924s), both green by luck; booked: the command-act face (no gate inspects the author's shell; read-the-whole-line is the discipline)
- b72#0 [wrong-object] — B9's first draft held visit-number uniqueness as its invariant — FALSE: the history legitimately carries two-section visits (三十九访双段, 二十九访两节) and the loose parser also matched 纪元五访客/版图 headings; the live first run convicted four false positives before anything landed; booked: the law-design face (no scheduled gate reviews an invariant's truth — the live-first-run probe is the discipline)
- b72#1 [process] — an insertion Edit meant to add the A-fire B9 test instead dropped a structural newline (the old_string carried it, the new_string didn't) — the following line glued up; caught on the immediate reread; booked: the edit-act face (no gate diffs formatting intent; read-back after every structural insert)
- b73#1 [process] — scratch mechanical trio (undefined local, missing brace, Richardson divisor in the wrong space) — scratch dies before gates by design; the kernel's richardsonLimit handles arbitrary ratios and its outputs are gate-asserted
- b73#2 [process] — the O(K^2) BigInt loop hang has no non-timeout gate — the incremental recurrence it became is spot-checked under :: test; the complexity-estimate discipline is the booking
- b73#3 [wrong-object] — the mismatched-scale comparison frame produced confident nonsense until scrapped — no scheduled gate audits the choice of comparison frame (the scale-first discipline is the booking)
- b73#4 [statistics] — the fit beyond the cancellation noise floor (b55#6's class at a new subtraction): the second-law value is asserted at k=8192 under :: test — the beyond-floor face is author discipline
- b73#10 [process] — the visit/batch resync is pre-gate by construction — no scheduled gate numbers visits; the grep-the-registry-first discipline is the booking (the b65 law, executed pre-emptively here)
- b74#0 [toolchain] — shell-act face: the masking pipe lives in the author's shell, which no scheduled gate inspects; the conviction came from the CI runner — unreachable from this workspace (the b2#3 GENESIS-C boundary); the exit-code-masking family's sixth sighting (b4#3, b37#6, b43#2, b64#1, b71#0 the five before it)
- b74#1 [process] — dual-face placement class (b22#2/b33#0/b49#2 family): the ROOT face is gate-held since v0.9.0 (rootStrayFiles names root strays live); the /tmp face resolves outside the workspace tree where no scheduled gate scans. Booked: the outside-tree face only
- b74#2 [toolchain] — the same-day recurrence of b74#0's class (the family's seventh sighting): $? after a pipe is the tail's code — a shell-act face no scheduled gate reads; PIPESTATUS is the discipline
- b74#3 [process] — agent-discipline act face: the git ban is delivery protocol and no scheduled gate observes a delivery agent's commands — read-only grades the offense, it does not unmake the ban
- b74#4 [process] — pre-machine reread face (the b55#0 class): the no-op edit was caught on reread before any run — no gate reads the editor buffer
- b74#5 [citation-drift] — external-truth face (the b55#3 class): a citation's claim text is verified against the publisher's record by the author's double-source ritual — no local gate reaches the source; deletion on the spot is the ritual executed
- b74#6 [process] — delivery-hygiene face: the in-tree residue died at the successors' gates (lint/typecheck/test convicted it until closure), but the leaving-behind act — stale README, missing report tables — is interruption process no gate diffs
- b74#8 [wrong-object] — claim-object face (the b57#2 superset class): no gate parses which population a verdict's prose names — the 6×8-specific restatement is the fix; the census's own report face is reconciliation-gated since v0.22.0 (S2), this claim-object face stays booked
- b74#9 [toolchain] — dual-face: the act face (rewritten on the spot, pre-machine) is booked; a require() landing in the ESM tree is a loader death the test/typecheck gates convict the moment it lands (the b47#1 precedent). Booked: the act face only
- b74#10 [process] — scratch-arbitration face (the b52#0 class): the bad unitary and the withdrawn 'transpose fix' lived in scratch and were refuted by variant enumeration — an author's probe, not a scheduled gate
- b74#11 [toolchain] — pre-machine draft face: the apostrophe was caught before any run; the landing face is a parser death at typecheck. Booked: the act face only
- b75#6 [process] — dual-face placement class (b22#2/b33#0/b49#2/b74#1 family): the ROOT face is gate-held since v0.9.0 (rootStrayFiles names root strays live); the /tmp face lives outside the workspace tree where no scheduled gate scans. Booked: the outside-tree face only
- b75#13 [toolchain] — heredoc act face — the banned channel's twelfth canonical sighting (the family's wrong-text sightings grep to 16 in-registry, counted before enrolling); no machine sees the channel, the Write-tool rule is the guard, and the damaged-file face dies at the loader/typecheck the moment it lands (the b47#1 twin). Booked: the act face only
- b76#0 [toolchain] — dual-face (the b74#9 twin, one wave later): the act face (dummyRng's require() rewritten to an import on the spot, pre-machine) is booked; a require() landing in the ESM tree is a loader death the test/typecheck gates convict the moment it lands. Booked: the act face only
- b76#3 [process] — dead-but-parseable scaffolding left by a failed edit: no unused-code gate is wired in this tree (knip-style checks absent) — the rewrite removed it; the residue face is review, not machine
- b76#7 [process] — the fake-number family attempted — prose values written before the run, self-caught and replaced by the run's numbers; the census's own rendered report is diffed against the live arithmetic since v0.22.0 (S2), but the attempt face (values written before any run existed) is upstream of every render (the b12#7/b21#3 witness-before-prose line). Booked: the attempt face
- b76#8 [process] — docs-content destruction (theory.md's referee section eaten by an edit, restored from backup) is invisible to every scheduled gate — typecheck/lint/test never read theory.md; the restore was manual. Booked: the docs face
- b76#9 [toolchain] — heredoc act face — the banned channel's thirteenth canonical sighting (the family's wrong-text sightings grep to 17 in-registry, counted before enrolling); no machine sees the channel, the Write-tool rule is the guard, and the damaged-file face dies at the loader/typecheck the moment it lands (the b47#1 twin). Booked: the act face only
- b76#23 [process] — print-layer honesty: two misleading display truncations rewritten — no gate parses whether a truncation hides the load-bearing digits (the b29#4/b30#1 display face). Booked: the display face
- b76#24 [toolchain] — heredoc act face — the banned channel's fourteenth canonical sighting (the thirteenth is b76#9 one row above, same batch); the scratch was deleted, which does not unmake the breach; no machine sees the channel, the Write-tool rule is the guard. Booked: the act face only
- b77#8 [process] — the banned git channel, read-only face (the b74#3 twin, one wave later): no mutation, no output shipped — the ban is unconditional and no machine sees the act; the deliverable's state is read from the files. Booked: the act face only
- b77#11 [toolchain] — one transient W-F filesystem miss — the cross-anchor existence check returned false once for an anchor on disk, re-run green, never reproduced; a transient environment flake has no enforceable face (the witness itself fires on every suite run). Booked: the transient face
- b78#1 [process] — the exp4 eps=0.01 MC hang (360k shots/trial, killed by hand — the b73#2 class) has no non-timeout gate that prices a workload; the load-reduced design (the eps=0.01 row exact-arithmetic-only, MC cross-checks re-anchored at eps=0.05 with reduced batches) is author discipline. Booked: the complexity-estimate face
- b78#9 [process] — the banned git channel, read-only diff flavor (third act on the b74#3/b77#8 line): no mutation, no output shipped — the ban is unconditional and no machine sees the act. Booked: the act face only
- b78#10 [toolchain] — the display pipe (`npm test | tail -15`) is a shell act no scheduled gate inspects — caught by self-review before any verdict was taken, the suite re-run for its direct exit code; the exit-code-masking family's eighth sighting (b4#3, b37#6, b43#2, b64#1, b71#0, b74#0, b74#2 the seven before it). Booked: the shell-act face
- b78#12 [process] — interruption leftover (the b74#6 class): the uncompilable stub and scratch-bench residue died at the successor's typecheck exit 2 before any work layered on it — the leaving-behind act is interruption process no gate diffs. Booked: the leaving-behind face
- b78#13 [process] — the oldest-first doc comment contradicts the audit's own newest-first register note — no gate parses doc-comment intent against the code it decorates; the v0.2.0 docs carry the corrected statement. Booked: the doc face
- b78#14 [toolchain] — heredoc act face — the banned channel's fifteenth canonical sighting (the family's wrong-text sightings grep to 19 in-registry, counted before enrolling); no machine sees the channel, the Write/Edit rule is the guard, and the truncated block died at the loader the moment it landed (restored by Edit, the b47#1 twin). Booked: the act face only
- b78#15 [process] — interruption leftover (the b74#6 class, second row of the wave): the inverted field name and wrong docstring died at the successor's gates and the JW25 mischaracterization is corrected with a logged erratum pinned in citations.md — the leaving-behind act remains ungated interruption process. Booked: the leaving-behind face
- b79#0 [toolchain] — heredoc act face — the banned channel's sixteenth canonical sighting (the family's wrong-text sightings grep to 19 in-registry, unchanged by this clean act, counted before enrolling); no machine sees the channel, the Write/Edit rule is the guard, and the damaged-file face dies at the loader/typecheck the moment it lands (the b47#1 twin). Booked: the act face only
- b79#6 [process] — doc-count drift on a face no law reads: the README's '19/19' test count rode two versions while the suite moved to 78 — no scheduled gate diffs prose README numbers against the suite's own arithmetic (E7 holds the census's description, B7/B8 hold contexts and headings; the README face is neither). Booked: the doc face — the count re-derived from the run in the same edit
- b79#13 [toolchain] — shell-act face with no landing: a bash template-string escape failed and the command produced nothing — the tree was never touched and no machine sees the shell; the Write/Edit rule is the guard. Booked: the act face only
- b79#14 [toolchain] — the exit-code-masking family's ninth sighting (b4#3, b37#6, b43#2, b64#1, b71#0, b74#0, b74#2, b78#10 the eight before it), an attempted one: the gate run went through a pipe, caught by self-review, killed on sight, and re-run for its DIRECT exit code — a display pipe is still a masking pipe and no scheduled gate inspects the shell. Booked: the shell-act face
- b80#1 [process] — the fake-number family attempted (third registered attempt, the b12#7/b21#3/b76#7 line): an optimality claim asserted BEFORE any test ran and retracted after — the attempt face (values written before ANY run) is upstream of every render; S2 (v0.22.0) holds the census's own rendered report, a sibling delivery note is not that report. Booked: the attempt face
- b80#2 [process] — doc face: the X8 doc's first draft quoted the SCRATCH budget numbers where the rendered report carries its own — no scheduled gate diffs a repo doc's numbers against the renderer's output (E7 holds the census's description, B7/B8 hold contexts and headings; a repo doc is neither); the re-sync in the same edit is the discipline. Booked: the doc face
- b80#3 [process] — dual-face placement class (b22#2/b33#0/b49#2/b74#1/b75#6 family): the ROOT face is gate-held since v0.9.0 (rootStrayFiles names root strays live); the temp file used during the hash verification resolved OUTSIDE the workspace tree where no scheduled gate scans — deleted after the act. Booked: the outside-tree face only
- b80#5 [toolchain] — a one-time audit's summary face: two of the 26-repo repro audit's summary greps missed node:test's ℹ line prefix and the totals read wrong until the raw output was read — no scheduled gate re-runs an audit's greps, and the raw-output rule is the discipline (no impact on the verdict: 26/26 REAL, zero no-ops). Booked: the summary face
- b80#6 [toolchain] — the exit-code-masking family's tenth sighting (b4#3, b37#6, b43#2, b64#1, b71#0, b74#0, b74#2, b78#10, b79#14 the nine before it), an attempted one: the hygiene agent's gate run went through a pipe (npm test | tail) — caught by self-review, killed on sight, re-run for the direct exit code; no scheduled gate inspects the shell. Booked: the shell-act face only
- b81#1 [toolchain] — the exit-code-masking family's eleventh sighting (b4#3, b37#6, b43#2, b64#1, b71#0, b74#0, b74#2, b78#10, b79#14, b80#6 the ten before it), an attempted one: the format:check verdict was read through a pipe (tail's 0 displayed where prettier had failed) — no verdict was taken from it, the warning text was acted on, the direct exit code read after; no scheduled gate inspects the shell. Booked: the shell-act face only
- b81#2 [toolchain] — the exit-code-masking family's twelfth sighting, ONE VISIT after the eleventh: the TS7 scratch lint's verdict read through the same pipe shape (a displayed 0 under a CRASHED lint, true exit 2) — noticed on reading the guard's stack and re-run unmasked in the same minute; the rule is a pre-flight checklist item, not knowledge. Booked: the shell-act face only
- b81#3 [process] — lockfile-intent face: the @types/node install was issued as a fresh range resolution (npm picked 26.5.0) where the PR being replicated pins 26.4.1 — no scheduled gate diffs a local node_modules resolution against an external PR's lockfile; the exact-pin reinstall preceded the commit (zero tree impact), the pin-is-the-intent rule is author-side. Booked: the lockfile-intent face
- b81#4 [toolchain] — the sanctioned-channel family's next sighting: the package.json version/description edit went through a python heredoc on the Bash channel — verified clean after the fact (JSON valid, both replacements exact), and clean does not absolve (the b79#10 judgment); dual-face as ever: the act is ungated, a malformed package.json is a parse death at the next npm invocation. Booked: the act face only
- b82#3 [toolchain] — the exit-code-masking family's thirteenth sighting (b4#3, b37#6, b43#2, b64#1, b71#0, b74#0, b74#2, b78#10, b79#14, b80#6, b81#2, b81#3 the twelve before it), an attempted one: the gate run piped through tail, caught by self-review in the same breath, killed on sight, re-run for the DIRECT exit code (clean) — a display pipe is still a masking pipe and no scheduled gate inspects the shell. Booked: the shell-act face only
- b82#5 [process] — dead scaffolding in a first draft (an unused variable plus a prototype-reflection construction), rewritten whole before the machine — pre-machine face (the b76#3 class); the unused-symbol face dies at the repo's typecheck, the live-code face is review. Booked: the pre-machine face
- b82#6 [process] — the Edit-before-Read refusal class (b48#2/b53#0/b67#4 line, fourth sighting): the tool's read-state tracker refused the edit — a machine, but not a scheduled gate; the refusal is the guard and nothing damaged landed. Booked: the patch-act face
- b82#7 [toolchain] — the sanctioned-channel family's eighteenth sighting (the sixteenth is b79#0, the seventeenth b81#4): a test-file repair through node -e fs.writeFileSync, verified clean on the spot — clean does not absolve (the b79#10 judgment); no machine sees the channel, the Write/Edit rule is the guard, and a malformed file dies at the loader the moment it lands. Booked: the act face only
- b82#9 [process] — transient duplicate definition caught on the read-back before any run — pre-machine face; the landing face is a duplicate-declaration death at typecheck, the reread closed it first. Booked: the pre-machine face
- b82#11 [process] — a stray blank line caught on the read-back — the residue constant's smallest face; no gate diffs cosmetic whitespace intent. Booked: the pre-machine face
- b82#15 [process] — comment-face residue (a bracket mismatch in prose no gate parses) caught on the reread — the b79#6 doc-face line; typecheck never reads comments. Booked: the comment face
- b82#16 [toolchain] — a regex grep's literal pipe read as alternation and returned a false zero hit — a one-time verification's query face (the b80#5 format-is-part-of-the-query class): grep -F re-ran it and the needle was on disk; no scheduled gate re-runs an author's greps. Booked: the query face
- b82#20 [process] — the Edit-before-Read refusal class (b48#2/b53#0 line, fifth sighting and second of THIS batch): the wiring agent issued the census package.json edit off a Bash cat view — a shell view is not a Read — and the tool's read-state tracker refused it; nothing damaged landed, the refusal is the guard. Booked: the patch-act face
- b82#21 [process] — companion-edit sequencing: the first census suite run went red on W-D (phase-law/rng.ts drift the delivery report's dead-export purge made predictable) and S1/S2 (the stale on-disk artifact) — the K-board registration and the repro re-render belonged in the same breath as the board edits; the gate convicted an incomplete state and both closed immediately. Booked: the sequencing face
- b83#0 [process] — pre-machine face: the mangled exp1 import block (a void slipped into the import lines) was fixed on the immediate reread — its landing face is a typecheck death, the reread closed it first
- b83#1 [process] — pre-machine face: the swallowed import block (the second edit's replacement scope ate it whole) was restored from the reread in the same minute — its landing face is a loader/typecheck death. Booked: the pre-machine face
- b83#3 [process] — pre-machine face: the const COS2PI8 alias residue beside the new single source was found on the reread and removed — the landing face is a duplicate-constant death at typecheck. Booked: the pre-machine face
- b83#4 [process] — dual-face: the pre-machine act (new tests written used-first, import-later) is booked; the landing face — used-before-import — is a TS2552/TS2305 death at the repo's typecheck the moment it ships, and the gate never had to say it. Booked: the pre-machine face only
- b83#5 [toolchain] — deletion-channel face (founding note, no in-registry family to count): trash is not installed in this Git Bash and no workspace gate commands the environment — the zero-reference grep before the rm is the discipline that makes the channel honest (the red line prefers recoverable; the environment decides what is available)
- b83#8 [toolchain] — environment face: tsx -e with a relative import fails silently under Git Bash for TS-importing one-liners — twice in a row this time (the b14#4/b38#1/b46#1 line, the family's next sighting by its own count after the seventh at b49#0); the act leaves no output and no artifact, the in-repo scratch-file rule is the enforcement
- b83#9 [toolchain] — the exit-code-masking family's fourteenth sighting (b4#3, b37#6, b43#2, b64#1, b71#0, b74#0, b74#2, b78#10, b79#14, b80#6, b81#1, b81#2, b82#3 the thirteen before it), an attempted one: the first gate authentication piped the npm test output through tail — caught in self-review, killed on sight, re-run with NO pipe for the true exit code (0); no scheduled gate inspects the shell. Booked: the shell-act face only
- b83#10 [process] — pre-machine face: the draft's own reread caught both corrections (rejects() for the async trial — assert.throws cannot catch a rejected Promise — and the awaited dead-export probe, a floating Promise can ride a green run) before the suite ran
- b83#17 [toolchain] — the exit-code-masking family's fifteenth sighting, ONE ROW after the fourteenth, attempted by the wiring agent itself in the act of coming to enforce the rule: the wiring visit's first census suite run went through a pipe (tail printed the two failures while EXIT echoed tail's own 0) — no verdict was taken from it, the re-run's DIRECT code (1, the expected pre-wiring red) is the only verdict; the family's own registrar is not immune. Booked: the shell-act face only
- b83#18 [citation-drift] — cross-reference face: batch 82's family citation list named b81#2/b81#3 where the registry's own rows are b81#1/b81#2 — no scheduled gate parses registry prose's citation keys against the rows they name; the grep-before-enrolling discipline is the guard, and it is what caught this one (the citation corrected in the same edit)
- b83#19 [process] — doc face: the README's headline batch count is prose on a surface no scheduled gate reads — B7/B8 hold contexts and headings, E7 holds the census's description, and the README is neither; the count re-derived from the registry in the same edit is the discipline (the b79#6 line). Booked: the doc face
- b83#20 [process] — the Edit-before-Read refusal class (b48#2/b53#0/b67#4/b82#6/b82#20 line, seventh sighting and third by a wiring agent): the census package.json version edit was issued off a Bash cat view — a shell view is not a Read — and the tool's read-state tracker refused it; nothing damaged landed, the refusal is the guard, and the real-Read second attempt landed cleanly. Booked: the patch-act face
- b84#2 [process] — pre-machine face: the deletion's residue survived two of its three edits — the landing face is a dead-symbol death at typecheck/lint, the grep-then-delete pass closed it (the residue class's delete face). Booked: the pre-machine face
- b84#3 [process] — pre-machine face: the inverted-intent write-back (isUnitary restored inside the sweep deleting it) was caught and reversed on the immediate reread — no gate observes an edit's direction. Booked: the pre-machine face
- b84#4 [toolchain] — the exit-code-masking family's sixteenth sighting (b4#3, b37#6, b43#2, b64#1, b71#0, b74#0, b74#2, b78#10, b79#14, b80#6, b81#1, b81#2, b82#3, b83#9, b83#17 the fifteen before it), an attempted one: the npm test authentication was piped for display — no verdict was taken from the pipe, the re-run read the DIRECT exit code; no scheduled gate inspects the shell. Booked: the shell-act face only
- b84#5 [process] — doc face: a performance claim measured under parallel load (11 minutes where the clean environment takes 56 seconds) is prose on a surface no scheduled gate benchmarks — the honest duration replaced it in the same edit (the b79#6 line). Booked: the doc face
- b84#7 [toolchain] — the exit-code-masking family's seventeenth sighting, one delivery after the sixteenth: npm test through a tail pipe — tail printed the text while eating the verdict; caught immediately, no verdict taken, the no-pipe re-run is the only verdict. Booked: the shell-act face only
- b84#8 [process] — pre-machine face: the TOL_LOCAL_NEVER alias residue was cleared inside the same edit (the b83#3 twin one wave later) — its landing face is a duplicate-constant death at typecheck, the reread closed it first. Booked: the pre-machine face
- b84#16 [process] — pre-machine face: the meaningless ternary was simplified in self-review before any run — no gate proves an expression computes the same value both ways, the reread is the factory check (the b82#5 dead-scaffolding face). Booked: the pre-machine face
- b84#18 [process] — pre-machine face: the misplaced refuse import was caught on self-review and moved in the same minute — its landing face is an ordering death at lint/typecheck the gates never had to say. Booked: the pre-machine face
- b84#19 [toolchain] — environment face (the wiring agent's own): the family byte-identity baseline ran as node --import tsx -e with a relative dynamic import — the banned -e shape of the b14#4/b38#1/b46#1/b49#0/b83#8 line; it succeeded with output verified present, and success does not change the shape: silent failure is the family's exact mode, the in-repo scratch probe or the suite's own W-D witness is the honest route. Booked: the environment face
- b84#20 [process] — pre-machine face (the wiring agent's own): the b84#13 enrollment row first landed as a conditional-type cast whose compile-time type read GATE-ENFORCED while its runtime value was the forged string the cast swallowed — a tier that types as one thing and evaluates as another; caught on the immediate reread and replaced with the plain literal, and E6 would have named it at the next run (the closed vocabulary is checked on the VALUE). Booked: the pre-machine face
- b84#21 [process] — sequencing face (the wiring agent's own, the b82#21 class): the G2 family-tier derivation reasoned from the intended category while the machine's familyOf rule filed b84#19 under runner-path first-match-wins — the census suite convicted the drifted resolution row at its first run (the gate working as designed on an act sent half-derived); no scheduled gate derives the row FOR the author, the tier follows the familyOf verdict. Booked: the derivation face

## A-board — the anchor witness registry (every guard, evidence on file)

E3 proves the needle is on disk; the A-board proves the guard can FIRE or is RESOLVED to its machinery — a guard that never convicts is a false guard. The registry is symmetric: an unregistered anchor may not hold errors, and a stale registration is itself a violation. Since v0.11.0 the RESOLVED class goes one layer deeper (A4): the total gate has already fired every repo's suite, and the census harvests that firing from the last recorded artifact — a RESOLVED test/typecheck anchor whose repo cell is red in that run is a violation, evidence upgraded from "the machinery exists" to "the machinery fired green".

- **FIRING-INJECT** — `burial-record/src/kernel/audit.ts :: B4` — a forged batch with a dead source anchor is convicted BY NAME by burial-record's own checkBurial (imported live) (demo: mutant-census/test/anchors.test.ts, "A-fire B4")
- **FIRING-INJECT** — `depreciation-ledger/src/kernel/audit.ts :: L1` — a ledger row quoting numbers with an empty cost column is convicted by the ledger's own checkLedger (imported live) (demo: mutant-census/test/anchors.test.ts, "A-fire L1")
- **FIRING-INJECT** — `depreciation-ledger/src/kernel/audit.ts :: L2` — a settled row quoting no numbers is convicted by checkLedger — no-number rows must stay OPEN (demo: mutant-census/test/anchors.test.ts, "A-fire L2")
- **FIRING-INJECT** — `depreciation-ledger/src/kernel/audit.ts :: L6` — the five headline costs are re-derived from scratch in the ledger's own gate (a suite the total gate runs) (demo: depreciation-ledger/test/ledger.test.ts, "L6: all five arithmetic witnesses pass")
- **FIRING-INJECT** — `mutant-census/src/kernel/audit.ts :: provenanceRepos` — a provenance with a trailing paren note ('batch 10 (qverify, expPauli)') resolves to exactly qverify — the charset does not swallow commas, no false conviction (demo: mutant-census/test/anchors.test.ts, "A-fire provenanceRepos")
- **FIRING-INJECT** — `mutant-census/test/anchors.test.ts :: A-fire L2` — batch 35's own lesson as a guard: the L2 demo encodes the law's REAL object read from the ledger's source (a blank column with a settled verdict) — ammo cast from memory fires at nothing, and this demo going green is the proof it was cast from the law (demo: mutant-census/test/anchors.test.ts, "A-fire L2")
- **FIRING-INJECT** — `burial-record/package.json :: test` — a forged batch whose context states NINE delivery errors over ten carried errors is convicted BY NAME (law B7) by burial-record's own checkBurial, imported live — the b45#9 class can never again wait for the visitor (demo: mutant-census/test/anchors.test.ts, "A-fire B7")
- **FIRING-INJECT** — `mutant-census/test/census.test.ts :: b37#7` — the single-source guard: the total-gate script must IMPORT EPOCH_REPOS from the census kernel and carry no second literal list — the dual-list drift that once produced a 27-vs-28 artifact header dies at the suite that reads the script's source (demo: mutant-census/test/census.test.ts, "b37#7")
- **FIRING-INJECT** — `mutant-census/test/census.test.ts :: E7` — the stated-counts guard: a forged description claiming drifted tier counts (147 on gates where the enrollment carries another number) is convicted BY NAME by checkStatedCounts against the live rows — the b67#6 eleven-visit drift and its same-day recurrence (b68#0) both ride this gate; the renderer refuses to print a drifted self-description (demo: mutant-census/test/census.test.ts, "E7")
- **FIRING-INJECT** — `burial-record/src/kernel/audit.ts :: memoryStructureViolations` — the memory-structure guard: forged daily-note text carrying the repeated-label signature (the b70#3 shape, pasted three times in one day and prevented never) is convicted BY LINE NUMBER by burial-record's own memoryStructureViolations, imported live — the ledger's evidence base now guards its own structure (B9, v0.5.0 of the record) (demo: mutant-census/test/anchors.test.ts, "A-fire B9")
- **FIRING-INJECT** — `switch-sched/test/process.test.ts :: identity channel gives SWAP` — the CJ-convention guard: the v0.1.0 latent defect (identity not mapping to SWAP under complex Kraus) dies at the circuit-vs-process assertion the switch-sched suite runs on every pass — the test that caught it in the same breath it was written (demo: switch-sched/test/process.test.ts, "identity channel gives SWAP")
- **FIRING-INJECT** — `switch-sched/test/process.test.ts :: eigenvalues exactly {0, ½}` — the exact-spectrum guard: the v0.1.0 global-½ double-count dies at W_OCB's exact-eigenvalue assertion {0, ½} (8-fold each, trace 4) — a scaled process matrix cannot pass it (demo: switch-sched/test/process.test.ts, "eigenvalues exactly {0, ½}")
- **FIRING-INJECT** — `switch-sched/test/process.test.ts :: 8192 vertices` — the census-size guard: the v0.1.0 fabricated census size (20480) dies at the census's own size assertion — 8192 deterministic strategies (4096 per order) cap exactly ¾, and the vertex count is pinned to the enumeration that produces it (demo: switch-sched/test/process.test.ts, "8192 vertices")
- **FIRING-INJECT** — `route-price/test/dossier.test.ts :: R5: all executable witnesses pass` — the sibling-claim guard: W-E's iso face (|cos 2kδ| coherent oscillation — the geometric envelope overruled at deviation 8.2e-1) is asserted on every suite run under R5; a rebaked geometric model fails the witness and the suite with it (demo: route-price/test/dossier.test.ts, "R5: all executable witnesses pass")
- **FIRING-INJECT** — `causal-ineq/test/causal-ineq.test.ts :: W* eigenvalues exactly {0, 1/2}` — the scale guard: a 4x coefficient moves W*'s spectrum off {0, ½} and the eigenvalue assertion convicts on the spot (demo: causal-ineq/test/causal-ineq.test.ts, "W* eigenvalues exactly {0, 1/2}")
- **FIRING-INJECT** — `causal-ineq/test/causal-ineq.test.ts :: OCB12 eq. (7)` — the slot-order guard: W* ≡ OCB12 eq. (7) is checked ELEMENTWISE — a transcribed vector with its slots in the wrong order dies entry by entry (demo: causal-ineq/test/causal-ineq.test.ts, "OCB12 eq. (7)")
- **FIRING-INJECT** — `causal-ineq/test/causal-ineq.test.ts :: noise threshold exactly eta = 1/sqrt(2)` — the exact-boundary guard: a tampered threshold (0.71 where the machine holds 1/√2) breaks the PSD account at the boundary and the noise-threshold test names it (demo: causal-ineq/test/causal-ineq.test.ts, "noise threshold exactly eta = 1/sqrt(2)")
- **FIRING-INJECT** — `k-switch/test/k4.test.ts :: ZERO commuting Pauli quadruples exist at d=4` — the no-go census guard: the machine's (0, 30, 1335) over 1365 is asserted and a counterfeit census (an invented commuting quadruple) is named by the smuggling trial in the same file (demo: k-switch/test/k4.test.ts, "ZERO commuting Pauli quadruples exist at d=4")
- **FIRING-INJECT** — `k-switch/test/k4.test.ts :: constructed matched pair outside the Pauli universe` — the generator-contract guard: the constructed pair keeps max trace distance < 1e-7 over all 24 plain orders — the T = 0.918 generator died exactly here (demo: k-switch/test/k4.test.ts, "constructed matched pair outside the Pauli universe")
- **FIRING-INJECT** — `k-switch/test/k4.test.ts :: the generator's Pauli ray` — the phase guard: rotationsOf's product is phase-only off the generator (diagonal exactly 0) — a wrong phase leaves the ray and the assertion names it (demo: k-switch/test/k4.test.ts, "the generator's Pauli ray")
- **FIRING-INJECT** — `k-switch/test/k4.test.ts :: Algorithm 1 reads the promise column with probability 1 exactly` — the layout guard: the 8-dim split-layout joint state feeding Algorithm 1 must read the promise column at probability exactly 1 on every promising set — NaN and mislayout die at the first such assertion (demo: k-switch/test/k4.test.ts, "Algorithm 1 reads the promise column with probability 1 exactly")
- **FIRING-INJECT** — `k-switch/test/k4.test.ts :: NO plain order separates ANY column pair` — the object guard: the game matrix (the discriminator) is asserted cell by cell (all 144 entries 0) — the projection-vs-discriminator conflation cannot survive it (demo: k-switch/test/k4.test.ts, "NO plain order separates ANY column pair")
- **FIRING-INJECT** — `postselect-sched/test/t5-power-ledger.test.ts :: branch ratio = integer ratio on real 3-SAT` — the integer-account guard: 2*both vs m holds on real 3-SAT — the halved U_1 initialization (x where 2x belongs) breaks the ratio and the referee convicts (demo: postselect-sched/test/t5-power-ledger.test.ts, "branch ratio = integer ratio on real 3-SAT")
- **FIRING-INJECT** — `postselect-sched/test/t6-tieface.test.ts :: exact tie iff d | a1^2` — the tie-equation guard: the census holds both directions on exact rationals and every reported tie re-verifies through the full ledger row machinery — a broken denominator dies on re-verification (demo: postselect-sched/test/t6-tieface.test.ts, "exact tie iff d | a1^2")
- **FIRING-INJECT** — `postselect-sched/src/experiments/run-all.ts :: call the mains directly` — the no-op repro guard: the explicit main calls ARE the fix — a recurrence that reverts run-all to import-only removes the needle and E3 convicts the missing-guard face on every census run (the exit-0-fake-green family's first needle-held sighting; the demo is E3's own conviction trial) (demo: mutant-census/test/enrollment.test.ts, "smuggle E3")
- **FIRING-INJECT** — `switch-sched/docs/citations.md :: 10.1038/s41467-023-40162-8` — the identifier guard: the VDL23 DOI is pinned in the register — a drift back to 5807 or a dropped DOI removes the needle and E3 convicts the missing-guard face on every census run (the b55#3 identifier family's first needle-held sighting; the demo is E3's own conviction trial) (demo: mutant-census/test/enrollment.test.ts, "smuggle E3")
- **FIRING-INJECT** — `qram-sched/src/online/kv-tight.ts :: BigInt division with 18 kept digits` — the overflow guard: the scaled-BigInt division IS the fix — a recurrence that converts factorials through Number again removes the needle and E3 convicts the missing-guard face on every census run (the n≥256 NaN face; the demo is E3's own conviction trial) (demo: mutant-census/test/enrollment.test.ts, "smuggle E3")
- **FIRING-INJECT** — `qram-sched/src/experiments/exp1-qram.ts :: the degenerate best case` — the population guard: the p = 1/2 exclusion comment marks the worst-off-grid-bank fix — a recurrence that lets the on-grid degenerate point set the requirement again removes the needle and E3 convicts the missing-guard face on every census run (demo: mutant-census/test/enrollment.test.ts, "smuggle E3")
- **FIRING-INJECT** — `qram-sched/src/experiments/run-all.ts :: EXPORTED main()` — the no-op repro guard (destructive subspecies): run-all wiping out/reports and importing silently is the fix's absence — the explicit exported-main calls ARE the fix, and a recurrence that reverts to import-only removes the needle and E3 convicts on every census run (the b75#18 twin) (demo: mutant-census/test/enrollment.test.ts, "smuggle E3")
- **FIRING-INJECT** — `quantum-mech/test/datalock.test.ts :: average is exactly I/d` — the object guard: the locked-ensembles referee asserts the mean is exactly I/d at 1e-12 for every d — the I-vs-I/d comparison dies at the first such assertion on every suite run (demo: quantum-mech/test/datalock.test.ts, "average is exactly I/d")
- **FIRING-INJECT** — `quantum-mech/src/protocol/datalock.ts :: Σ_ij a_ij conj(b_ij)` — the sign guard: the corrected Tr[AB] formula is pinned as the kernel's own comment — a recurrence that rewrites the sign removes the needle and E3 convicts the missing-guard face on every census run (the PGM conditionals ride the formula) (demo: mutant-census/test/enrollment.test.ts, "smuggle E3")
- **FIRING-INJECT** — `quantum-mech/docs/citations.md :: Rubinstein & Zhou` — the attribution guard: the corrected author entry (with the v0.2.0 erratum naming the wrong one) is pinned in the register — a drift back to 'Wolitzky et al.' removes the needle and E3 convicts on every census run (the identifier family's fifth sighting, first author-table face held) (demo: mutant-census/test/enrollment.test.ts, "smuggle E3")
- **FIRING-INJECT** — `quantum-mech/docs/citations.md :: DiVincenzo, Horodecki, Leung, Smolin, Terhal & Wootters` — the roster guard: the six-author DLW04 entry is pinned in the register — a recurrence of the three-name table removes the needle and E3 convicts on every census run (the identifier family's sixth sighting, consecutive with the fifth) (demo: mutant-census/test/enrollment.test.ts, "smuggle E3")
- **FIRING-INJECT** — `retro-cache/test/w5-amplification.test.ts :: rank formula matches brute force` — the implementation guard: the sparse-profile rank formula is asserted against brute-force Gaussian elimination — a placeholder gf2Rank returns garbage and the W5.C referee convicts it on every suite run (demo: retro-cache/test/w5-amplification.test.ts, "rank formula matches brute force")
- **FIRING-INJECT** — `retro-cache/test/w6-adversary.test.ts :: crossing exact` — the algebra guard: the depreciation crossing is asserted exact against its closed form with |S| = 2 at the crossing — a wrong crossing-tap algebra dies at the two-route table on every suite run (demo: retro-cache/test/w6-adversary.test.ts, "crossing exact")
- **FIRING-INJECT** — `retro-cache/test/w6-adversary.test.ts :: eta=0 reproduces the honest ledger` — the sign guard: the attacked CHSH at zero tap must reproduce the honest ledger exactly — a sign error breaks the endpoint identity and the W6.A referee convicts it on every suite run (demo: retro-cache/test/w6-adversary.test.ts, "eta=0 reproduces the honest ledger")
- **FIRING-INJECT** — `retro-cache/test/w6-adversary.test.ts :: strictly positive tax, exactly zero gain` — the mixture guard: settings mutation is asserted with strictly positive tax and exactly zero gain, two-route QBER — a wrong mixing rate moves either invariant and the W6.D referee convicts it on every suite run (demo: retro-cache/test/w6-adversary.test.ts, "strictly positive tax, exactly zero gain")
- **FIRING-INJECT** — `retro-cache/docs/citations.md :: Verification 2026-09-08: SIAM publisher page` — the verification-record guard: the double-source record is pinned in the register — a recurrence that ships a DOI without one removes the needle and E3 convicts on every census run (the citation family's unverified-DOI face) (demo: mutant-census/test/enrollment.test.ts, "smuggle E3")
- **FIRING-INJECT** — `retro-cache/src/experiments/run-all.ts :: own subprocess` — the no-op repro guard (subprocess form): each experiment running as its own process IS the fix — a recurrence that reverts run-all to import-only removes the needle and E3 convicts on every census run (the b75#18 family, second repo) (demo: mutant-census/test/enrollment.test.ts, "smuggle E3")
- **FIRING-INJECT** — `nosignal-tariff/test/theorem.test.ts :: the ln2 enclosure is tight` — the tail-bound guard: the enclosure's tightness and the −ln(1/2) = ln2 reduction are asserted with the two-derivation overlap — a 2x-too-small tail dies at the M1 referee on every suite run (demo: nosignal-tariff/test/theorem.test.ts, "the ln2 enclosure is tight")
- **FIRING-INJECT** — `nosignal-tariff/src/kernel/rational.ts :: decimal long division when either limb overflows` — the wide-rational guard: the decimal-long-division fallback IS the fix — a recurrence of the naive Number(n)/Number(d) removes the needle and E3 convicts on every census run (the NaN-on-render face) (demo: mutant-census/test/enrollment.test.ts, "smuggle E3")
- **FIRING-INJECT** — `nosignal-tariff/test/theorem.test.ts :: no inflection cell named` — the map guard: the convexity face names zero suspect cells and the fake-inflection-table smuggling trial sits beside it — an inverted map names the healthy cells and the M3 referee convicts it on every suite run (demo: nosignal-tariff/test/theorem.test.ts, "no inflection cell named")
- **FIRING-INJECT** — `switch-sched/src/experiments/run-all.ts :: calls the mains directly` — the no-op repro guard (fourth repo, the family's systemic sighting): the explicit main calls with the rendered-count refusal ARE the fix — a recurrence that reverts run-all to import-only removes the needle and E3 convicts on every census run (the b75#18 family; fixed by this wiring visit's Task A with the mtime witness) (demo: mutant-census/test/enrollment.test.ts, "smuggle E3")
- **FIRING-INJECT** — `readout-wall/src/kernel/audit.ts :: replacer closed form vs sim maxdev` — the member-labeling guard: the W-F witness re-derives the replacer closed form from the control-marginal simulation at all 21 grid points — a formula with its member entropies on the wrong members fails the witness (and the suite's all-six-witnesses run) on the spot; the sim cross-check IS the demo (demo: mutant-census/test/enrollment.test.ts, "smuggle E3")
- **FIRING-INJECT** — `readout-wall/test/readout.test.ts :: the ln enclosures bracket the true log on both series paths` — the enclosure guard: LN2_T and LN2_A must each contain ln 2 — the halved atanh closure (LN2_A enclosing ln2/2) dies at the lo bracket on every suite run; the same test's reference-slack comment holds the ulp-tolerance fix beside it (demo: readout-wall/test/readout.test.ts, "the ln enclosures bracket the true log on both series paths")
- **FIRING-INJECT** — `readout-wall/test/readout.test.ts :: the slack below is for the REFERENCE` — the reference-tolerance guard: the bracket test's slack (1e-15 relative, for Math.log's own ulp error on the double nearest q) is pinned as the test's own comment — a recurrence of the zero-slack assertion removes the needle and E3 convicts the missing-guard face on every census run (demo: readout-wall/test/readout.test.ts, "the slack below is for the REFERENCE")
- **FIRING-INJECT** — `survivor-census/test/compose.test.ts :: staged kills are disjoint items` — the population guard: stage 2's register is read off kept-by-A-and-not-kept-by-AB universes — a loop that compares the already-killed population breaks the disjoint-union identity and the compose referee convicts it, with the double-counted-kill smuggling trial (TRIAL 3) beside it (demo: survivor-census/test/compose.test.ts, "staged kills are disjoint items")
- **FIRING-INJECT** — `survivor-census/test/phasecensus.test.ts :: constantDifferenceOnFunded` — the per-instance guard: the equality-case flag is computed over the funded set, not hardcoded per family — sign-alt is constant on the all-even marked set and the machine detects it; a hardcoded table misses exactly the marked-set-specific cases and the equality-case assertion convicts it (demo: survivor-census/test/phasecensus.test.ts, "constantDifferenceOnFunded")
- **FIRING-INJECT** — `survivor-census/test/phasecensus.test.ts :: the Fourier ramp's overlap with flat matches the closed form` — the conjugation guard: the two-path closed form is asserted componentwise (re and im) against the machine's overlap — a flipped conjugation sign in either component dies at the componentwise assertion on every suite run (demo: survivor-census/test/phasecensus.test.ts, "the Fourier ramp's overlap with flat matches the closed form")
- **FIRING-INJECT** — `survivor-census/src/experiments/run-all.ts :: \|x*>` — the escaped-cell guard: the ket's pipe is escaped in R5's face so the rendered census table keeps six columns — a recurrence of the bare pipe removes the needle and E3 convicts on every census run (the latent v0.1.0 render defect, closed at its own face) (demo: mutant-census/test/enrollment.test.ts, "smuggle E3")
- **FIRING-INJECT** — `ent-clearing/test/clearing.test.ts :: the twirl is load-bearing` — the inertness guard: the honest-negatives test asserts the raw nested round DEGRADES the coin without the twirl (0.884146 -> 0.812024) — a twirl that does nothing on Bell-diagonal states cannot make the recurrence improve, and the degradation assertion convicts it on every suite run (demo: ent-clearing/test/clearing.test.ts, "the twirl is load-bearing")
- **FIRING-INJECT** — `ent-clearing/test/clearing.test.ts :: 24 unitaries` — the group-size guard: the Clifford enumeration is asserted to be exactly 24 unitaries with Werner fixed points — a half-checked orthogonality condition (real part only) passes 68 counterfeits and the count assertion convicts it on every suite run (demo: ent-clearing/test/clearing.test.ts, "24 unitaries")
- **FIRING-INJECT** — `binding-price/test/market.test.ts :: marginal I/2, reveal 1/2` — the construction guard: every two-coin strategy (C1 products and C3 rotated Bells included) is asserted per-coin flat — garbage first-draft expressions break the marginal assertion and the T8 referee convicts them on every suite run (demo: binding-price/test/market.test.ts, "marginal I/2, reveal 1/2")
- **FIRING-INJECT** — `binding-price/test/market.test.ts :: per-coin flat at every Schmidt coefficient` — the companion-index guard: the swap-flip companion keeps per-coin marginals at exactly I/2 at EVERY t — the 01/10 companion lands at per-coin TV 0.5 from I/2 and the marginal assertion convicts it on every suite run (demo: binding-price/test/market.test.ts, "per-coin flat at every Schmidt coefficient")
- **FIRING-INJECT** — `binding-price/src/kernel/audit.ts :: under damping the verifier's register is` — the register guard: panel (e)'s comment pins the object — the verifier's register is E_gamma(I/2), the member announced pure — and the witness asserts the memberwise (1 + gamma*m_z)/2 formula against it; a recurrence that channels the member removes the needle and E3 convicts on every census run (demo: mutant-census/test/enrollment.test.ts, "smuggle E3")
- **FIRING-INJECT** — `binding-price/test/market.test.ts :: blochOf inverts blochState exactly` — the roundtrip guard: blochOf(blochState(r)) must return r componentwise, one state at a time — the flipped y dies at the y-component assertion on every suite run (the latent v0.1.0 sign defect: double flips cancel in pairs, a one-at-a-time roundtrip has no pair) (demo: binding-price/test/market.test.ts, "blochOf inverts blochState exactly")
- **FIRING-INJECT** — `qverify/test/protocol.test.ts :: phaseDampingKraus` — the Kraus-convention guard: the Z-tier test runs phaseDampingKraus at every gamma in [0,1] and asserts trap acceptance exactly 1-gamma against the closed form — a reversed Kraus pair breaks the acceptance at the first interior grid point and the suite convicts it on every run (demo: qverify/test/protocol.test.ts, "phase damping sits in the Z-tier")
- **FIRING-INJECT** — `qverify/test/protocol.test.ts :: guessAfterPhaseDamp` — the overruled-claim guard: the census row asserts the machine-found V-form (1+|1-2gamma| sin(pi/8))/2 at every gamma plus the gamma=1 decoupling anchor — a backwards invisibility claim or a monotone guess-decay dies at the grid on every run (demo: qverify/test/protocol.test.ts, "guess game is the V-form")
- **FIRING-INJECT** — `qverify/docs/citations.md :: first-guess author attribution` — the attribution guard: the corrected Tanggara-Gu-Bharti entry with the wrong first guess confessed is pinned in the register — a drift back to the recalled attribution removes the needle and E3 convicts on every census run (the identifier family's seventh sighting, needle-held like its fifth and sixth) (demo: mutant-census/test/enrollment.test.ts, "smuggle E3")
- **FIRING-INJECT** — `ft-qaoa/test/ft.test.ts :: follows the power law` — the hand-arithmetic guard: e5 is asserted exactly at 0.1*(1/6)^3 to 1e-18 beside its monotone siblings — a slipped expected-value (the 0.1-squared face) dies at the exact assertion on every suite run (demo: ft-qaoa/test/ft.test.ts, "follows the power law")
- **FIRING-INJECT** — `ft-qaoa/test/constants.test.ts :: duplicate ids are rejected` — the collision-visibility guard: the audit validation is map-free — a duplicate id yields BOTH rejections (thin rationale AND duplicate) and the smuggling trial asserts the pair stays visible; a map-keyed recurrence overwrites the duplicate and the two-rejection assertion convicts it on every suite run (demo: ft-qaoa/test/constants.test.ts, "duplicate ids are rejected")
- **FIRING-INJECT** — `ft-qaoa/test/ft.test.ts :: window-size policy prices the batching tradeoff` — the feasibility-window guard: the sweep asserts W=4 still exceeds the latency ceiling (utilization 1.03) and W=8 is the first feasible window at 0.856, with the ASIC scenario at 1 and the hopeless fleet null — a W=4 assertion dies at the minLatencyRealtimeWindow equality on every suite run (demo: ft-qaoa/test/ft.test.ts, "window-size policy prices the batching tradeoff")
- **FIRING-INJECT** — `ft-qaoa/test/noise.test.ts :: depolarizeQubit matches an independent naive Pauli conjugation` — the channel guard: the n=2 test rebuilds the reference channel as an independent naive Pauli conjugation on embedded full complex matrices and asserts elementwise agreement to 1e-15 — the latent v0.1.0 branch swap (same-qubit/cross-qubit interchanged, mixing weights off) dies at the first element on every suite run (demo: ft-qaoa/test/noise.test.ts, "depolarizeQubit matches an independent naive Pauli conjugation")
- **FIRING-INJECT** — `choice-lang/test/model.test.ts :: the chain's weights MULTIPLY to the composed weight` — the weight-object guard: the S2 chain's own weight is asserted against the second part's standalone weight, the composed weight against the exact product, and the conditionals through the independent concat path — a wrong comparison target or a repeated-object leaf identity dies at the product assertion on every suite run (demo: choice-lang/test/model.test.ts, "condition P then run-and-condition Q equals conditioning P++Q")
- **FIRING-INJECT** — `dsic-noether/test/kink.test.ts :: crossing, reversed` — the direction guard: the exact-measure assertion runs all four grid pairs including the REVERSED crossing — an integral signed for one direction dies at the reversed pair on every suite run (demo: dsic-noether/test/kink.test.ts, "across-kink [I] (the Milgrom-Segal envelope)")
- **FIRING-INJECT** — `dsic-noether/test/kink.test.ts :: the charge's FLUX jumps at the kink by exactly (t - w + 1)/2` — the surface-term guard: the flux jump is asserted as a polynomial identity with the zero-jump counterfeit refused by the pIsZero guard — the flat-jump misread dies at the assertion on every run (demo: dsic-noether/test/kink.test.ts, "the charge's FLUX jumps at the kink by exactly (t - w + 1)/2")
- **FIRING-INJECT** — `dsic-noether/test/kink.test.ts :: the SIGNED win-side limit` — the sign-convention guard: both sides' one-sided limits are asserted as exact rationals (winner 0 and -1/5, loser -1/10 and 0) — a clamped or flipped win-side sign dies at the first exact equality on every run (demo: dsic-noether/test/kink.test.ts, "the charge's one-sided limits at the kink are priced exactly")
- **FIRING-INJECT** — `dsic-noether/test/kink.test.ts :: the wall-to-wall zeros are counted` — the flat-honesty guard: never positive, strictly negative off-diagonal on both strict blocks, flatPairs > 0 asserted — a witness demanding strict negativity everywhere, or one ignoring the weak-DSIC flat, dies on every run (demo: dsic-noether/test/kink.test.ts, "grid witness, honest about the flat")
- **FIRING-INJECT** — `letter-audit/src/kernel/audit.ts :: A6` — the live-pointer guard: every frontier needle is read from the sibling's report file on every suite run — a needle that misquotes its target (15 decimals against the report's 12) dies at the A6 check the moment it lands (demo: letter-audit/test/letter.test.ts, "A6: a frontier pointer to a needle that does not exist in the sibling's report is rejected by name")
- **FIRING-INJECT** — `stable-world/test/stable.test.ts :: the ladder never inverts` — the direction guard: naive <= aligned <= conditional asserted with a real unlock on mixed states and a trivial record on pure starts — a backwards ladder dies at worstViolation on every run (demo: stable-world/test/stable.test.ts, "the nested triangle ladder")
- **FIRING-INJECT** — `stable-world/test/stable.test.ts :: the law's trajectory rank, whatever it is` — the eigen-rank guard: the memory's dimension is computed as the state's own eigen-rank where it is asserted — a fixed-table rank assumption dies at the first trajectory case on every run (demo: stable-world/test/stable.test.ts, "the Schmidt memory is honest")
- **FIRING-INJECT** — `stable-world/test/stable.test.ts :: an error schedule beats constant worst-case eps` — the census-over-summary guard: alternating < 0.51 * constant in exact arithmetic with the constant-eps limit anchored — a 'half' rounding of the 49.5% data dies at the bound on every run (demo: stable-world/test/stable.test.ts, "an error schedule beats constant worst-case eps")
- **FIRING-INJECT** — `stable-world/citations.md :: writing it from memory produced 1310.6190` — the identifier guard: the corrected arXiv:1311.0275 entry with the wrong first guess confessed is pinned in the register — a drift back to the recalled number removes the needle and E3 convicts on every census run (the identifier family's eighth sighting, needle-held like its fifth through seventh) (demo: mutant-census/test/enrollment.test.ts, "smuggle E3")
- **FIRING-INJECT** — `dtc-clock/test/dtc.test.ts :: L2: EXACT with unknown witness is rejected` — the namespace guard: the witness list is closed and machine-checked — a witness name colliding with or outside the registered namespace dies at the checker on every run (demo: dtc-clock/test/dtc.test.ts, "L2: EXACT with unknown witness is rejected")
- **FIRING-INJECT** — `dtc-clock/test/dtc.test.ts :: SMUGGLING TRIAL: the v0.2.0 TAUTOLOGY itself` — the tautology guard: a formula-times-itself witness is proven blind LIVE — it certifies the WRONG constant |cos 3*delta|^k it is handed — the founding conviction of the tautological-witness family (the shipped |cos2d|^k law's verifier, route-price the discovering sibling), firing on every run (demo: dtc-clock/test/dtc.test.ts, "SMUGGLING TRIAL: the v0.2.0 TAUTOLOGY itself")
- **FIRING-INJECT** — `dtc-clock/test/dtc.test.ts :: TC47: Phi1 bracketed with ZERO INSIDE` — the bracket guard: the certified |Phi1| <= 5.58e-7 with zero inside is asserted beside the sign-fix agreement (N=60/120/240 at ~1e-10 where the buggy road erred at exactly N^-s) — a revived 'nonzero' claim or a fake over-narrow bracket dies on every run (demo: dtc-clock/test/dtc.test.ts, "TC47: Phi1 bracketed with ZERO INSIDE")
- **FIRING-INJECT** — `wukong-crossval/test/xval.test.ts :: the flip kernel is stochastic and hand-checkable at n=2` — the hand-anchor guard: the suite's own hand-checkable cell pins the kernel's elementwise values (rows stochastic, T[0][1] = 2f(1-f), T[1][0] = f(1-f)) — a hand-computed expectation that slips its arithmetic dies at the elementwise assertion on every suite run (fix the anchor, not the machine; the b13#7 law's own face) (demo: wukong-crossval/test/xval.test.ts, "the flip kernel is stochastic and hand-checkable at n=2")
- **FIRING-INJECT** — `mutant-census/test/selfreport.test.ts :: smuggle S1-a (板序): a section-shuffled report is convicted by name` — the board-order guard (S1, v0.22.0): a section-shuffled report is injected into the REAL checkBoardOrder and convicted BY NAME — the legislated section order, the closed vocabulary, the ascending M-board rows and the A-board kind blocks are all held on every suite run; the trials' own first drafts pointed at the wrong conviction faces once (b80#4) and the corrected ammunition reads the checker's output (demo: mutant-census/test/selfreport.test.ts, "smuggle S1-a (板序): a section-shuffled report is convicted by name")
- **FIRING-INJECT** — `mutant-census/test/selfreport.test.ts :: smuggle S2-a (散文对账): a tampered rendered number is convicted naming the drifted field` — the prose-reconciliation guard (S2, v0.22.0): a tampered rendered number is injected into the REAL checkProseCounts and convicted naming the drifted field — every numeric claim in the rendered prose answers to the live arithmetic on every suite run, the on-disk artifact included; the law's first live run convicted three drifted phrases (the K-board's ten-vs-seven full members, the four-vs-three family share, the R-board's nine/fifteen-vs-eleven/thirty-three verdict counts — b80#8/b80#9/b80#10 ride exactly here) (demo: mutant-census/test/selfreport.test.ts, "smuggle S2-a (散文对账): a tampered rendered number is convicted naming the drifted field")
- **FIRING-INJECT** — `vacuum-compiler/test/vacuum.test.ts :: version: "0.20.0"` — the version-pin guard (the version-pin cross-repo family's founding sighting, b80#7): the genuine-citation test reads the sibling's LIVE package.json at run time — a citation pinning a stale dtc-clock version (0.19.0 after the same wave's 0.20.0 upgrade) is convicted as 'version drift' on every suite run, and the fixed needles are pinned in the citing tree (test/docs/README/experiments); in a multi-repo same-wave upgrade every live-pinned version citation is re-verified after each batch (demo: vacuum-compiler/test/vacuum.test.ts, "genuine sibling citations pass the two-ground audit")
- **FIRING-INJECT** — `phase-law/test/phase-law.test.ts :: PL20's integer-vs-float C_j cross-check is WITNESSED` — the witness-wiring guard: the formerly-dead staircaseFloatCrossCheck now feeds a live assertion (the error real above zero, under the 1e-12 W-K bound) — a recurrence that reverts to an unwired export or a hand-copied digit fails the bound assertion on every suite run (the witness-before-prose family, needle-held: truth without a witness is not a verdict) (demo: phase-law/test/phase-law.test.ts, "PL20's integer-vs-float C_j cross-check is WITNESSED")
- **FIRING-INJECT** — `postselect-sched/test/errors.test.ts :: ERR.06 randomSat hang conviction` — the termination guard: randomSat's sub-3-variable domain is refused by name (INSUFFICIENT-VARIABLES) and the test completing at all is the regression proof — the latent v0.2.0 while-loop hang (randomSat(2, 5, 1) spun forever) dies at the rejects() calls on every suite run (demo: postselect-sched/test/errors.test.ts, "ERR.06 randomSat hang conviction")
- **FIRING-INJECT** — `postselect-sched/test/errors.test.ts :: ERR.08 repetitionsFor conviction` — the domain guard: delta outside (0,1] is refused by name (BAD-DELTA) where v0.2.0 shipped a silently negative k (repetitionsFor(0.1, 2) returned -33) — the negative schedule dies at the rejects() calls with the exact-tie infinity negative control intact on every suite run (demo: postselect-sched/test/errors.test.ts, "ERR.08 repetitionsFor conviction")
- **FIRING-INJECT** — `postselect-sched/test/errors.test.ts :: ERR.09 binomTailAtMost conviction` — the boundary guard: p outside [0,1] is refused by name (BAD-PROBABILITY) where v0.2.0 returned NaN at p=0 with the true tail exactly 1 (0*log(0) poisoning the sum) — the silent-NaN face dies at the rejects() calls with the hand value 7/27 and the p=1 endpoint exact on every suite run (demo: postselect-sched/test/errors.test.ts, "ERR.09 binomTailAtMost conviction")
- **FIRING-INJECT** — `postselect-sched/test/t1-sorter.test.ts :: lcgMarked(6, 3, 101), [58, 0, 0]` — the dyadic-vector guard: the LCG marked-set helper's regression vector is asserted elementwise as exact machine output (state/2^32 rationals) — a recalled vector ([58, 43, 47] from recollection) fails the deepEqual on every suite run; regression vectors are computed from the machine, never remembered (the b21#3 witness-first law on the data face) (demo: postselect-sched/test/t1-sorter.test.ts, "lcgMarked(6, 3, 101), [58, 0, 0]")
- **FIRING-INJECT** — `k-switch/test/kswitch.test.ts :: shortestSupersequence(4), null` — the null-floor guard: the quartet-size search is asserted to run and find NOTHING (four letters cannot hold four mutually distinct orders) beside the below-quartet rejects named SUPERSEQUENCE-LIMIT-BELOW-QUARTET — a draft that asserts a length-4 supersequence (the b83#2 slip, corrected before the first run) dies at the null assertion on every suite run; the anchor is recomputed from the contract, never from recollection (demo: k-switch/test/kswitch.test.ts, "SMUGGLING TRIAL: shortestSupersequence below the quartet size is NAMED and rejected (no silent null)")
- **FIRING-INJECT** — `causal-ineq/test/causal-ineq.test.ts :: NaN grid is dead` — the named-rejection guard: cmatAdd/cmatTraceProd/cmatMaxAbsDiff on mismatched dims and cmatTrace/cmatScale on ragged grids are each rejected BY NAME (cmat/dim-mismatch, cmat/malformed-grid) where v0.2.0 returned a silently corrupted NaN grid — the NaN grid is dead on every suite run, legal operands still passing bit-identically (demo: causal-ineq/test/causal-ineq.test.ts, "binary kernel dimension mismatches are rejected by name (NaN grid is dead)")
- **FIRING-INJECT** — `causal-ineq/docs/theory.md :: As in the README: the OCB12 equivalence is machine-checked` — the single-boundaries guard: the stale SECOND Honest boundaries section (the one contradicting the v0.2.0 machine verdicts) is deleted and the surviving section's claims are the rendered report's own — the needle pins the corrected section on disk and E3 convicts on every census run the day a duplicate or contradiction returns (demo: mutant-census/test/enrollment.test.ts, "smuggle E3")
- **FIRING-INJECT** — `qram-sched/test/errors.test.ts :: RNG_EMPTY_PICK` — the empty-domain guard: pick([]) is rejected by name where v0.2.0 returned undefined cast to T — a forged witness value from an empty domain dies at the rejects() trial on every suite run (demo: qram-sched/test/errors.test.ts, "走私审判 #3: illegal inputs at every public kernel are rejected BY ERROR CODE")
- **FIRING-INJECT** — `qram-sched/test/errors.test.ts :: GROVER_EMPTY_SCORES` — the empty-scores guard: linearFindBest([]) is rejected by name where v0.2.0 forged index 0 — a confident lie where no best exists dies at the trial on every suite run (demo: qram-sched/test/errors.test.ts, "走私审判 #3: illegal inputs at every public kernel are rejected BY ERROR CODE")
- **FIRING-INJECT** — `qram-sched/test/errors.test.ts :: WALK_MU_SHAPE` — the shape guard: initialState with a wrong-length mu is rejected by name where v0.2.0 built silent NaN amplitudes the unitarity monitor downstream would have certified — the lie never gets built now, the monitor never sees it (demo: qram-sched/test/errors.test.ts, "走私审判 #3: illegal inputs at every public kernel are rejected BY ERROR CODE")
- **FIRING-INJECT** — `qram-sched/test/errors.test.ts :: WALK_NEIGHBOR_RANGE` — the neighbor-range guard: chainFromGraph with an out-of-range neighbor is rejected by name where v0.2.0's Float64Array out-of-bounds WRITE was silently dropped — the typed array no longer eats the write, the chain's row knows (demo: qram-sched/test/errors.test.ts, "走私审判 #3: illegal inputs at every public kernel are rejected BY ERROR CODE")
- **FIRING-INJECT** — `qram-sched/test/errors.test.ts :: LINALG_SHAPE` — the linalg shape guard: luSolve/jacobiEigenvalues/hittingTime refuse wrong-shape operands by name where v0.2.0 answered silent NaN solutions — linear algebra that never disagrees never alarms; the trials fire on every suite run (demo: qram-sched/test/errors.test.ts, "走私审判 #3: illegal inputs at every public kernel are rejected BY ERROR CODE")
- **FIRING-INJECT** — `qram-sched/test/errors.test.ts :: OBM_INSTANCE_SHAPE` — the instance-shape guard (OBM_RANK_SHAPE its twin code on the next trial line): the OBM matchers refuse out-of-bounds neighbors and short rank vectors by name where v0.2.0 swallowed the Uint8Array out-of-bounds READ and forged undefined as a number — both faces die at the trials on every suite run (demo: qram-sched/test/errors.test.ts, "走私审判 #3: illegal inputs at every public kernel are rejected BY ERROR CODE")
- **FIRING-INJECT** — `quantum-mech/test/errors.test.ts :: dagger2 roundtrip basis` — the both-sides unitarity guard: dagger2's roundtrip is asserted U-dagger-U AND U-U-dagger for EVERY basis family — the Y basis (asymmetric imaginary part) is the one that exposes a wrong-index conjugation where H alone is real symmetric and immune; the transposed subscript that passed all fifty-six tests green dies at the first Y-basis roundtrip on every suite run (the anchor-blindspot family's heaviest evidence, killed by the repro byte-comparison at delivery) (demo: quantum-mech/test/errors.test.ts, "single-sourcing anchors: dagger2 / fmt / conjVec / maximallyMixed are the canonical one source")
- **FIRING-INJECT** — `quantum-mech/package-lock.json :: 0.3.0` — the lockfile-sync guard: both of package-lock.json's version slots are pinned to the live 0.3.0 — a recurrence of the stale-lockfile face (the 0.1.0 residual that survived the whole 0.2.0 version because the wave's gates verified package.json and never the lock) removes the needle and E3 convicts on every census run (the version-pin family's own-repo lockfile twin of b80#7's cross-repo founding; the demo is E3's own conviction trial) (demo: mutant-census/test/enrollment.test.ts, "smuggle E3")
- **FIRING-INJECT** — `survivor-census/test/errors.test.ts :: SC/BAD-MARKED` — the intersection-honesty guard: composeStages refuses the out-of-range markedB by name where v0.2.0's filter silently DROPPED it and computed on the remainder (markedB=[0,99] filtered to [0], the illegal address vanishing) — the drop face dies at the rejects() trial on every suite run (demo: survivor-census/test/errors.test.ts, "composeStages names the smuggled out-of-range stage-B mark it used to drop silently")
- **FIRING-INJECT** — `survivor-census/test/errors.test.ts :: SC/MC-BAD-INPUTS` — the divide-by-zero guard: mcWaiting(p, 0) is refused by name where v0.2.0 returned a silent NaN (runs=0 has no mean) — the NaN face dies at the rejects() trial on every suite run (demo: survivor-census/test/errors.test.ts, "waitingPrice, schedule, tailAt and mcWaiting reject domain violations by name")
- **FIRING-INJECT** — `survivor-census/test/errors.test.ts :: funded.cause.code` — the code-discrimination guard: the chained refusal is asserted to carry its cause's CensusError CODE (SC/P0-UNDEFINED inside SC/EMPTY-INTERSECTION) where v0.2.0 discriminated by message substring — an edited message can no longer silently break the P=0 inheritance; messages stay frozen prose, codes are the identity (demo: survivor-census/test/errors.test.ts, "the starved intersection is SC/EMPTY-INTERSECTION on both starvation paths, with the cause preserved")
- **FIRING-INJECT** — `retro-cache/test/kernel-hardening.test.ts :: K.G convicted` — the finite-prose guard: fmt refuses the non-finite by name (RC_NON_FINITE) where v0.2.1's toFixed rendered "NaN"/"Infinity" into the report's sentences — the printer no longer speaks what is not a number, the conviction anchored on every suite run (demo: retro-cache/test/kernel-hardening.test.ts, "K.G convicted: the report printer would have shipped NaN as prose")
- **FIRING-INJECT** — `retro-cache/test/kernel-hardening.test.ts :: K.H postprocessOutcome` — the last-door guard: postprocessOutcome — the one public entry that had no guard — now refuses malformed shapes and non-finite cells by name where v0.2.1's short-row [x]![y]! lanes mixed NaN into the outcome silently; the smuggling trials fire on every suite run (demo: retro-cache/test/kernel-hardening.test.ts, "K.H postprocessOutcome smuggling trials: malformed tables and maps are NAMED and REJECTED")
- **FIRING-INJECT** — `readout-wall/test/readout.test.ts :: the wrong-object lesson` — the joint-vs-marginal guard: |Phi+>'s partialTrace marginals are pinned EXACTLY I/2 on both sides beside the joint state's surviving off-diagonal — the maximally entangled state's marginal is the maximally mixed state, a distinction this workspace has booked three times and now holds by machine (the mental-arithmetic |+><+| prediction dies at the first deepEqual on every suite run) (demo: readout-wall/test/readout.test.ts, "exact-value anchors of the core linear algebra: kron, partialTrace, eigensolver, trace distance, fidelity")
- **FIRING-LIVE** — `mutant-census/src/experiments/render.ts :: witness letters must be unique` — a forged report headlining two censuses under one W-letter is refused on the spot (assertUniqueWitnessLetters, the b46#5 tier upgrade; the guard lives in report.ts since b53#5 — a leaf, so the anchor's dynamic fire can never deadlock the entry)
- **FIRING-LIVE** — `mutant-census/src/kernel/audit.ts :: E1` — a forged registry carrying an un-enrolled error is convicted by checkEnrollment on the spot
- **FIRING-LIVE** — `mutant-census/src/kernel/audit.ts :: E2` — a forged class-mismatched mutant tie is convicted by checkEnrollment on the spot
- **FIRING-LIVE** — `mutant-census/src/kernel/audit.ts :: Q2` — the ghost mutant (declared EXACT-KILL, ships the canonical function) is reported SURVIVED by the live kill census — the declared-vs-live law has teeth
- **FIRING-LIVE** — `mutant-census/src/kernel/audit.ts :: Q4` — the battery's synthetic violators FIRE on every run (runNegativeControls) — a property nothing can move is a constructed zero, and this anchor is why the controls exist
- **FIRING-LIVE** — `mutant-census/src/kernel/audit.ts :: W-C` — the negative controls fire live: shape-blind product, lopsided outer, non-CPTP Kraus each get named
- **FIRING-LIVE** — `mutant-census/src/kernel/battery.ts :: PHASE-SENSITIVE` — MU2 (the conjugated vecToRho — Hermitian, trace 1, PSD, invisible to statehood) is killed EXACTLY by P2's phase-sensitive dual path, live
- **FIRING-LIVE** — `mutant-census/src/kernel/census.ts :: unguardedEntryFiles` — the in-repo fixture repo's unguarded render entry is NAMED by the detector, live
- **FIRING-LIVE** — `mutant-census/src/kernel/census.ts :: rootStrayFiles` — a forged root listing carrying a stray scratch is named by the detector on the spot (the b54#0 ROOT face, gate-held since v0.9.0 — the b46#5 upgrade pattern: the BOOKED reason 'no gate schedules where the scratch file lives' went false; the system-temp face of the class lives outside the workspace tree and stays booked on its own rows)
- **RESOLVED** — `mutant-census/scripts/total-gate.ts :: typecheck` — the T-board script constructs a typecheck job for every epoch repo (the job spec is in the script source); its full firing IS the total gate run
- **RESOLVED** — `mutant-census/package.json :: lint` — eslint.config.mjs on disk and eslint in devDependencies — the gate's machinery is wired
- **RESOLVED** — `burial-record/package.json :: lint` — eslint.config.mjs on disk and eslint in devDependencies — the gate's machinery is wired (b53#2's catch, registered the moment it was first needed)
- **RESOLVED** — `mutant-census/package.json :: repro` — the repro script's tsx target (src/experiments/render.ts) exists — the gate points at a real program
- **RESOLVED** — `mutant-census/package.json :: test` — the test tree exists and carries test files — the gate has something to run
- **RESOLVED** — `mutant-census/package.json :: typecheck` — tsconfig.typecheck.json on disk — the project the gate compiles
- **RESOLVED** — `ds_extracted/ds/package.json :: format:check` — prettier in devDependencies — the formatter the gate invokes is installed
- **RESOLVED** — `ds_extracted/ds/package.json :: test` — the tests/ tree exists and carries test files
- **RESOLVED** — `ds_extracted/ds/package.json :: typecheck` — tsconfig.typecheck.json on disk
- **RESOLVED** — `ds_extracted/ds/tsconfig.json :: exactOptionalPropertyTypes` — the flag itself is the machinery (content already E3-verified); compile-level firing would re-run tsc per census run — the cost is booked here, the check stays content-level
- **RESOLVED** — `ft-qaoa/tsconfig.json :: exactOptionalPropertyTypes` — the flag itself is the machinery; compile-level firing cost booked, content-level check kept
- **RESOLVED** — `bqp-map/package.json :: test` — the test tree exists and carries test files
- **RESOLVED** — `dsic-noether/package.json :: test` — the test tree exists and carries test files
- **RESOLVED** — `dsic-noether/package.json :: typecheck` — tsconfig.typecheck.json on disk (include spans src, test, experiments) — registered the moment batch 66 first needed it (the b53#5 law)
- **RESOLVED** — `dsic-noether/package.json :: lint` — eslint config on disk and eslint in devDependencies — the machinery batch 66 saw fire three times
- **RESOLVED** — `ent-clearing/package.json :: typecheck` — tsconfig.typecheck.json on disk
- **RESOLVED** — `ent-sched/package.json :: test` — the test tree exists and carries test files
- **RESOLVED** — `ft-qaoa/package.json :: test` — the test tree exists and carries test files
- **RESOLVED** — `k-switch/package.json :: test` — the test tree exists and carries test files
- **RESOLVED** — `nonstoq-anneal/package.json :: test` — the test tree exists and carries test files
- **RESOLVED** — `nosignal-tariff/package.json :: test` — the test tree exists and carries test files
- **RESOLVED** — `qram-sched/package.json :: test` — the test tree exists and carries test files
- **RESOLVED** — `readout-wall/package.json :: typecheck` — tsconfig.typecheck.json on disk
- **RESOLVED** — `stable-world/package.json :: typecheck` — tsconfig.typecheck.json on disk
- **RESOLVED** — `stable-world/package.json :: test` — the test tree exists and carries test files — the gate the R-board's b56#3/b56#7/b56#8/b57#3/b59#0 upgrades ride (their sightings were convicted at suite/typecheck runs of this very tree); registered the moment the R-board first needed it (the b53#5 law)
- **RESOLVED** — `stable-world/package.json :: lint` — eslint.config.mjs on disk and eslint in devDependencies — the gate's machinery is wired
- **RESOLVED** — `survivor-census/package.json :: test` — the test tree exists and carries test files
- **RESOLVED** — `switch-sched/package.json :: test` — the test tree exists and carries test files
- **RESOLVED** — `vacuum-compiler/package.json :: test` — the test tree exists and carries test files
- **RESOLVED** — `dtc-clock/package.json :: test` — the test tree exists and carries test files
- **RESOLVED** — `dtc-clock/package.json :: typecheck` — tsconfig.typecheck.json on disk
- **RESOLVED** — `dtc-clock/package.json :: lint` — eslint.config.mjs on disk and eslint in devDependencies — the gate's machinery is wired
- **RESOLVED** — `phase-law/package.json :: test` — the test tree exists and carries test files
- **RESOLVED** — `phase-law/package.json :: typecheck` — tsconfig.typecheck.json on disk
- **RESOLVED** — `switch-sched/package.json :: lint` — eslint.config.mjs on disk and eslint in devDependencies — the machinery that convicted batch 74's void-expression/array-type lint batch (the b53#5 law)
- **RESOLVED** — `nonstoq-anneal/package.json :: typecheck` — tsconfig.typecheck.json on disk — the project the gate compiles; the machinery that convicted batch 74's unused-parameter/unexported-main/readonly-push batch (the b53#5 law)
- **RESOLVED** — `route-price/package.json :: lint` — eslint.config.mjs on disk and eslint in devDependencies — the machinery that convicted the wave's two lint rounds
- **RESOLVED** — `causal-ineq/package.json :: lint` — eslint.config.mjs on disk and eslint in devDependencies — the machinery that convicted the 32-error lint batch
- **RESOLVED** — `postselect-sched/package.json :: typecheck` — tsconfig.typecheck.json on disk — the project that kills the template-string quote mismatch the moment it lands
- **RESOLVED** — `postselect-sched/package.json :: lint` — eslint.config.mjs on disk and eslint in devDependencies — the machinery that convicted the wave's two lint errors
- **RESOLVED** — `quantum-mech/package.json :: lint` — eslint.config.mjs on disk and eslint in devDependencies — the machinery that convicted the wave's two post-hoc lint/typecheck residue
- **RESOLVED** — `retro-cache/package.json :: test` — the test tree exists and carries test files — the suite that holds the wave's rewritten W5/W6 assertions (the fake-claim face died exactly here)
- **RESOLVED** — `survivor-census/package.json :: lint` — eslint.config.mjs on disk and eslint in devDependencies — the machinery that convicted the wave's preserve-caught-error sighting
- **RESOLVED** — `qverify/package.json :: typecheck` — tsconfig.typecheck.json on disk — the loader face that convicted the embedded '*/' closing the comment early (the b12#0 twin)
- **RESOLVED** — `vacuum-compiler/package.json :: lint` — eslint.config.mjs on disk and eslint in devDependencies — the machinery that convicted the wave's five lint sightings
- **RESOLVED** — `quantum-mech/package.json :: test` — the test tree exists and carries test files — the suite that convicted the -0-vs-0 discriminant at its first run and holds the dagger2 both-sides anchor
- **RESOLVED** — `retro-cache/package.json :: typecheck` — tsconfig.typecheck.json on disk — the gate that convicted the K.H draft's single-line map literal (TS2345) before release
- **RESOLVED** — `retro-cache/package.json :: lint` — eslint.config.mjs on disk and eslint in devDependencies — the machinery that convicted the no-unnecessary-condition reading shape before release

## G-board — the genealogy census (every error in a family, every family resolved, every catch credited)

The E-board made every error answer for its enforcement; the A-board made every guard prove it can fire; the G-board makes the ledger LEARN. Every error joins a family (the named recurrence families plus the category defaults, rules over the live wrong-text); every family with two or more sightings carries a resolution row whose tier must equal its LATEST sighting's enrollment tier (G2 — a stale resolution is a conviction); every error credits its catcher, and the catch census prints the era trend — the optimization metric: the machine fraction must rise, the visitor fraction must fall to zero.

| family | sightings | first | latest | latest tier (held by) |
| --- | --- | --- | --- | --- |
| cat:process | 174 | b1 | b84#20 | BOOKED-UNENFORCEABLE |
| cat:toolchain | 80 | b1 | b84#13 | GATE-ENFORCED |
| cat:wrong-object | 77 | b2 | b84#17 | GATE-ENFORCED |
| cat:statistics | 48 | b3 | b84#10 | GATE-ENFORCED |
| cat:machine-overruled | 43 | b4 | b84#1 | GATE-ENFORCED |
| cat:dimension-slot | 40 | b5 | b84#15 | GATE-ENFORCED |
| shell-template-heredoc | 29 | b10 | b82#7 | BOOKED-UNENFORCEABLE |
| cat:conjugation | 28 | b4 | b79#3 | GATE-ENFORCED |
| cat:citation-drift | 23 | b6 | b84#6 | GATE-ENFORCED |
| runner-path | 21 | b14 | b84#21 | BOOKED-UNENFORCEABLE |
| cat:anchor-blindspot | 15 | b9 | b84#0 | GATE-ENFORCED |
| edit-anchor | 11 | b22 | b83#20 | BOOKED-UNENFORCEABLE |
| cat:bogus-comparison | 10 | b2 | b37#2 | GATE-ENFORCED |
| count-drift | 6 | b36 | b65#0 | GATE-ENFORCED |
| non-null-assert | 2 | b45 | b45#1 | GATE-ENFORCED |
| tautological-witness | 1 | b79 | b79#16 | GATE-ENFORCED |

The catch census: gate 95 / author 465 / numbers 47 / visitor 1 over 608 errors — the gate fraction rose from 1% (batches 1-22) to 25% (batches 37+). The one visitor catch is b45#9 — and burial-record's B7 law (stated counts equal carried counts, v0.5.0 of the record) now holds that class by gate, with the A-fire B7 firing demo injecting the exact forgery into the real checkBurial.

## J-board — the per-error equivalence census (the JIA11 boundary, measured)

The E-board ties an error to its class prototype — honest, and coarse (one mutant guards its whole registered class). The J-board asks the next question, per error: what does a FAITHFUL family-level re-enactment of THIS error's own defect do against the battery? The verdict vocabulary is closed — COLLAPSES (bit-exact battery-indistinguishable from the class prototype: the class tie is already the fixed point of per-error construction), ERROR-LEVEL (a distinct construction the battery kills: the tie refines from category to error), EQUIVALENT (a live survivor — the open problem in person, booked with its reason), UNBUILDABLE (the defect's home composition is not a family member — booked). The exchange that makes this decidable: PROGRAM equivalence is undecidable (the open problem, JIA11); BATTERY-indistinguishability — the (pass, worst) vectors over all ten properties — is a relation the machine decides bit-exactly. The census claims the second and books the first.

| key | prototype | construction / booking | verdict | live detail |
| --- | --- | --- | --- | --- |
| b4#0 | MU1 | the defect's home is the objective-to-Hamiltonian convention (H_P := -C), not a family composition — no family member encodes an objective; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b8#2 | MU1 | group-element normalization by the first entry instead of the phase ratio b0/a0 — the family carries no group calculus; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b9#1 | MU1 | Jacobi rotation handedness — the eigensolver is not a family member (b15#1 is the same home); the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b10#4 | MU1 | outer(a,b) drops the conjugate (a_i b_j) — the closed-form element conjugates the wrong side | ERROR-LEVEL | distinct construction, killed live by P3 (worst 1.7e+0) |
| b10#7 | MU2 | Werner/isotropic convention alignment — state-parameterization conventions, no family composition carries them; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b11#0 | MU1 | the Szegedy search-step convention (C.S.R, oracle postposed) — the walk construction is not a family member; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b13#0 | MU2 | embedWorld bakes a spurious 1/sqrt(2) into the tensor embedding — trace preservation broken at the composition | ERROR-LEVEL | distinct construction, killed live by P2 (worst 2.9e-1) |
| b13#4 | MU1 | applyLaw's flip Kraus carries a spurious 0.5 amplitude — K+K != I, the leakage identity breaks | ERROR-LEVEL | distinct construction, killed live by P6, P7 (worst 6.4e-1) |
| b15#1 | MU1 | hand-written complex Hermitian Jacobi — the same home as b9#1, not a family member; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b15#2 | MU2 | conditionalOn ships the raw block with its normalization factor missing (trace = block mass — the trace alarmed) | ERROR-LEVEL | distinct construction, killed live by P5 (worst 9.7e-1) |
| b16#0 | MU1 | applyKraus computes K rho K — the adjoint forgotten (M.M instead of M+ M), Hermiticity dies | ERROR-LEVEL | distinct construction, killed live by P4 (worst 1.5e+0) |
| b18#4 | MU1 | the Groves payment sign convention — mechanism-design arithmetic, no family member; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b20#0 | MU2 | vecToRho conjugates the wrong side (rho^T) — MU2's own corruption, bit-exact | COLLAPSES | bit-exact with MU2 on all ten properties — the class tie is the fixed point |
| b20#4 | MU1 | the |Phi_theta> correlation tensor's hand-derived signs (T_zz = +1, T_xy coherent) — a closed-form derivation, not a family composition; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b26#0 | MU1 | vInner's real part truncated to aRe*bRe — the aIm*bIm cross term dropped, imaginary side correct | ERROR-LEVEL | distinct construction, killed live by P2 (worst 8.9e-1) |
| b28#2 | MU1 | the complex product's real part incomplete (the -im*phIm term missing) — the SAME construction as b26#0: two errors, one mutation shape | ERROR-LEVEL | distinct construction, killed live by P2 (worst 8.9e-1) |
| b29#0 | MU1 | vInner returns the conjugate — MU1's own corruption, bit-exact | COLLAPSES | bit-exact with MU1 on all ten properties — the class tie is the fixed point |
| b30#0 | MU2 | PROVEN equivalent: global phase is unobservable at the density layer, |−ψ⟩⟨−ψ| = |ψ⟩⟨ψ| elementwise — the re-enacted defect is real at ket level (orthogonality destroyed) and the family is blind to it BY REPRESENTATION. The JIA11 phenomenon with a one-line proof | EQUIVALENT | SURVIVOR — nothing in the ten-property battery moves it |
| b36#7 | MU1 | expectationAt's observable multiplication (tre*O + i tim*O) — the family carries no observable expectation; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b21#0 | MU5 | conditionalOn divides by the joint element P(w=digit, d=0) instead of the block trace — MU5's own corruption (its history cites THIS very error), bit-exact | COLLAPSES | bit-exact with MU5 on all ten properties — the class tie is the fixed point |
| b31#3 | MU7 | limitObject keeps the diagonal blocks in place (the dephased twin) — MU7's own corruption (its history cites THIS very error), bit-exact | COLLAPSES | bit-exact with MU7 on all ten properties — the class tie is the fixed point |
| b24#2 | MU5 | the order-bit readout returns the JOINT cells re[0]/re[3] (world AND data pinned) instead of the data-summed marginals | ERROR-LEVEL | distinct construction, killed live by P5 (worst 1.4e+0) |
| b15#3 | MU5 | the branch marginal computed by PINNING data=0 (conditioning on the partner's outcome) instead of summing over it | ERROR-LEVEL | distinct construction, killed live by P5 (worst 3.5e+1) |
| b14#2 | MU5 | the axis readout applies sigma_x (x) I to the state and reads the computational diagonals — applying a unitary is not measuring: the outcome labels come back swapped (the state-damage face lives outside a pure readout member) | ERROR-LEVEL | distinct construction, killed live by P5 (worst 1.4e+0) |
| b2#2 | MU5 | concurrency-cancellation semantics (Promise.race vs the runaway child) — the family has no process layer; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b3#0 | MU5 | global-optimum claim for a golden-section search — an optimizer assumption, no family member searches; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b4#1 | MU5 | imaginary-time reachability from |+>^n — an algorithm-level spectral assumption; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b6#1 | MU5 | s-grid resolution of an avoided crossing — numerics design, not a family composition; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b6#2 | MU7 | Lanczos level labeling (lambda_1 as 'the first excited') — no eigensolver in the family (the recorded limitation, b31#2's home); the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b7#3 | MU5 | Perron-Frobenius read as 'all amplitudes non-negative' — a theorem's hypothesis object; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b8#0 | MU5 | purification eligibility of raw BBPSSW output — a protocol-layer assumption; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b8#4 | MU5 | greedy interval tiling in id order — a scheduler heuristic, no family member schedules; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b8#6 | MU5 | the key-rate collapse variable (n/p vs T2) — a physics-claim object; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b9#7 | MU5 | Bell fidelity and concurrence telling one story at the optimum — correlation-measure claims; the family carries neither measure; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b11#1 | MU5 | 'the walk implementation is broken (when norms decay)' — a diagnosis claim about a walk the family does not carry; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b11#5 | MU5 | adversarial regret's sign claim — regret is an external quantity, no family member carries it; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b12#1 | MU5 | the ZZ Hamiltonian's max off-diagonal entry — no Hamiltonian member; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b12#5 | MU5 | 'the advantage factor is a constant' — a claim about an external metric; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b13#5 | MU5 | one matched deception pair refuting all fixed-order simulators — a quantifier claim about simulators; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b15#4 | MU5 | support signatures as Pauli index strings — a representation-convention object; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b17#4 | MU7 | vals[1] as the spectral gap — eigenvalue-slot labeling; no eigensolver member (the recorded limitation); the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b18#0 | MU5 | a stepwise 1e-15 residual as an integrator certificate — a certification object in mechanism-design arithmetic; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b19#1 | MU5 | 'trace-preserving equals identity elementwise' — a false CLAIM about channels, not a composition corruption; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b19#2 | MU5 | 'the average of conditionals is the conditional of the average' — a linearity CLAIM over an averaging pipeline no family member encodes (the true conditional is nonlinear in its normalization); the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b20#2 | MU5 | no-signaling as I(B; A's outcome)=0 — a mutual-information definition object; the family carries no MI member; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b20#3 | MU5 | 'B's coin stays uniform' as THE invariant — an invariant-choice claim; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b21#1 | MU5 | a numerical clone-gap lower bound as a no-cloning certificate — certification arithmetic outside the family; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b22#0 | MU5 | error-shaped objects through a batch-shaped counter — a census-counter shape; no family member counts; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b24#4 | MU5 | 'ensemble average is I/2' checked against identity(2) — a reference-object comparison in check code; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b25#4 | MU5 | control marginal vs prepared state after a choose — no choose member; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b29#2 | MU5 | assert.equal(pKeep, 1) on a degenerate case — a float-equality assertion object in test code; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b30#2 | MU5 | pure-payload identity via the Uhlmann fidelity — no fidelity member (the pure-state object wanted |<psi|phi>|^2); the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b31#2 | MU5 | exp(iH) through eigHermitian on an INDEFINITE random Hermitian — the recorded family limitation: the eigensolver is not a member at all; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b32#2 | MU5 | P10's entangled states via a global U(4) — the battery's own test-state construction, inside the property, not a Family member; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b32#8 | MU5 | the negative control's mismatched pair built legal — a constructed zero in test construction (Q4's birth class); the family members were honest, the control was not; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b35#0 | MU5 | resolveAnchor's branches on reg.anchor instead of the split-out path — a variable-object slip in census code, no family member; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b36#0 | MU5 | runner-major vs clock-major total index — a dtc-clock permutation convention; no family member permutes; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b36#1 | MU5 | the (d1,d2) pair loop collapsed to a single d — an optimization loop object; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b36#3 | MU5 | the halted runner's non-injectivity — a permutation-injectivity claim; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b36#5 | MU5 | X_0 as the battery probe (EVEN under the chain's Z2) — an operator-parity choice; no observable member; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b36#6 | MU5 | V^T O V instead of V O V^T — an eigensolver-transform orientation; no eigensolver member (b31#2's home); the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b36#10 | MU5 | bit0-as-a0 AND p3-as-LSB — a bit-order convention in the multiplier's verifier; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b36#11 | MU5 | (E_0 - E_k)/J(n-1) going negative while the chain heats — a derived-metric orientation; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b24#0 | MU4 | the bare 2x2 projector straight at the 4x4 state — MU4's own corruption (its history cites THIS very error), bit-exact through the crash face | COLLAPSES | bit-exact with MU4 on all ten properties — the class tie is the fixed point |
| b31#0 | MU6 | the |1><0| Kraus element written at flat index 1 (element (0,1)) — MU6's own corruption (its history cites THIS very error), bit-exact | COLLAPSES | bit-exact with MU6 on all ten properties — the class tie is the fixed point |
| b31#4 | MU3 | the 4x4 full state embedded as if it were the 2x2 cargo — MU3's own corruption (its history cites THIS very error), bit-exact | COLLAPSES | bit-exact with MU3 on all ten properties — the class tie is the fixed point |
| b13#2 | MU6 | I (x) U computed as a PRODUCT — embedWorld multiplies the world projector by the cargo instead of tensoring (2x2 result, silently accepted) | ERROR-LEVEL | distinct construction, killed live by P2 (worst 2.0e+0) |
| b31#1 | MU3 | a 4x4 normalized by MULTIPLYING it with a 1x1 scalar matrix through mMul — mScale is the sanctioned route; the shape guard refuses on the spot (crash face on P5, distinct from MU3's P2 face) | ERROR-LEVEL | distinct construction, killed live by P5 (worst Infinity) |
| b5#1 | MU3 | single-edge string flips between N_xx sectors — a spin-chain sector bookkeeping the family does not carry; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b5#3 | MU3 | rollback with an inverted ternary — chain-move bookkeeping, no family member proposes moves; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b6#3 | MU3 | full-space Lanczos convergence at k = dim-1 — eigensolver numerics (no eigensolver member, the recorded limitation); the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b6#4 | MU3 | N*m_x^2 for the fully-connected XX term claimed normalization-free — a Hamiltonian-coefficient claim; no Hamiltonian member; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b7#0 | MU3 | MPO key-completion terms at station i — tensor-network bookkeeping, no family member; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b7#1 | MU3 | environment absorption with = — MPO reduction conventions; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b7#2 | MU3 | naive nested contraction with in/out spins as they come — contraction-order design; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b12#2 | MU3 | one ascending comparator sorting Johnson's groups — a classical grouping claim; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b13#1 | MU3 | environment slots assigned by execution order — scheduler bookkeeping; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b15#0 | MU3 | Jacobi row and column rotations inside one k loop — the eigensolver home (no member); the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b17#1 | MU3 | dedup of degenerate eigenvector clusters — eigensolver post-processing (no member); the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b17#3 | MU3 | the kron chain seeded with eye unconditionally — the compiler's reduction-chain seed convention; the family's embedWorld carries a fixed chain, no seed parameter; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b17#5 | MU3 | comparison target kron(I, chain) — a test-construction convention, not a family composition; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b18#2 | MU3 | agent i excluded with a square bijection kept — mechanism-design index algebra; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b18#3 | MU3 | injections enumerated in ascending index order — combinatorial enumeration design; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b20#1 | MU3 | the B(x)env unitary applied on the 4-dim A(x)B space — a channel-application dimension the family's fixed compositions do not parameterize; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b23#1 | MU3 | the wrong-dims expression, void-ed leftover and invalid hex literal in a sub-check — residue in readout-wall's own check code; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b24#1 | MU6 | hand-filled constant state matrices (SINGLET/PHI_PLUS) with misplaced flat indices — the family's state builder is parametric (vecToRho), it carries no hand-filled constants; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b25#0 | MU3 | a 20-step program run without accounting the register (each choose adds a control qubit) — interpreter-layer dimension accounting; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b25#3 | MU3 | the 2x2 control marginal tensored against the 4x4 pair projector — choice-lang's decomposition algebra; the family's embedWorld has one fixed decomposition; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b27#2 | MU3 | the right-walker transition encoded as K-1-(n+1) instead of 3(n+1) — a TM-encoding constant; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b28#0 | MU3 | the statevector allocated with dim entries but indexed as the [real|imag] split layout — a buffer-layout convention; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b28#1 | MU3 | coupling coefficients read from empty rows without a fallback — data-loading robustness, no family member loads data; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b36#9 | MU3 | sitePauli seeded with the Pauli itself and n factors prepended — every site operator 2^(n+1)-dimensional; a loop-seed convention in dtc-clock's operator builder; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b31#5 | MU8 | the MC censused 'ever left within K steps' while the closed form priced 'outside at step K' — MU8's own corruption (its history cites THIS very error), bit-exact | COLLAPSES | bit-exact with MU8 on all ten properties — the class tie is the fixed point |
| b19#3 | MU9 | the MC conditional frequency divided by the TOTAL sample count — MU9's own corruption (its history cites THIS very error), bit-exact | COLLAPSES | bit-exact with MU9 on all ten properties — the class tie is the fixed point |
| b5#2 | MU9 | PROVEN equivalent on the battery's inputs: the accepted count per run is Binomial(trials, 0.3) with trials >= 60, so P(zero accepted) <= 0.7^60 ~ 5e-10 — the degenerate branch the defect lives on is never exercised, and on every exercised input the construction is the CORRECT estimator (est -> exact). The battery is blind to the degenerate face by input coverage — the JIA11 phenomenon's degenerate-input species, specimen #2, measured with a probability bound rather than asserted | EQUIVALENT | SURVIVOR — nothing in the ten-property battery moves it |
| b3#4 | MU8 | 'p=0 gives <C> exactly 0' — a limit-case claim about an external objective; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b5#0 | MU9 | SSE stationary weights without slot combinatorics — statistical-mechanics weight algebra, no family member; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b5#4 | MU9 | 'square the matrix and take the trace' for Trotter Z — a partition-function identity; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b5#5 | MU9 | a fixed block width giving honest MC error bars — blockwise-error design; the family's MC members have fixed event definitions, no block structure; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b9#2 | MU8 | the inverse-iteration shift eps = gap/2 splitting clusters — eigensolver numerics (no member, the recorded limitation); the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b9#4 | MU8 | 'detection rate is detection rate' — a definitional-claim object; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b10#5 | MU8 | projected gradient descent terminating on the sphere — an optimizer claim; no family member descends; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b11#3 | MU8 | first-passage time under a single threshold measuring detection — an event-definition claim about a walk the family does not carry; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b11#4 | MU9 | the mean over 20 seeds reported — an estimator-selection claim; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b11#8 | MU8 | 'the separation margin is physics' — a claim about an external quantity; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b12#3 | MU8 | BBHT at ~35*sqrt(N) called close enough — a complexity-constant approximation; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b14#3 | MU8 | the tolerance pinned at 1e-16 — tolerance calibration in check code (the b36#13 class); the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b16#1 | MU9 | Pauli triples sampled with rng.int(3) x 3 — a sampler design inside the battery's own property; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b16#2 | MU8 | a 1e-16 tolerance bounding the sqrt amplification — tolerance-vs-amplification calibration in check code; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b18#5 | MU8 | a 1e-15 guard called 'strictly better' — guard-calibration claim; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b19#4 | MU8 | marked sets sampled with possible repeats — set-sampling design in postselect-sched's experiment code; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b25#5 | MU8 | the rounding floor quoted from the probe's seeds for a witness using different seeds — a seed-transfer claim inside battery-internal sampling; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b27#1 | MU9 | the universe count as 4*(n+1)^(2n) — a combinatorial count formula; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b29#1 | MU8 | E[T] refereed by a plain truncated loop — an estimator design for an expectation referee; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b30#3 | MU9 | the Procrustean fail branch normalized unguarded at l_min = 1/2 — the degenerate-normalization class's home is ent-clearing's map; the family layer already carries the b5#2 specimen of the unguarded-ratio shape; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b32#3 | MU8 | the CNOT control required to move B's marginal by strictly MORE than 0.5 — a control-threshold convention inside P10's own construction; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |
| b32#4 | MU8 | P6's leakage loop advancing one shared state cumulatively — property-internal loop design; the class tie stands | UNBUILDABLE | no construction exists at the family layer — booked |

Pilots: conjugation EXHAUSTIVE (19/19 of its MUTANT-KILLED rows); wrong-object EXHAUSTIVE (44/44 of its MUTANT-KILLED rows); dimension-slot EXHAUSTIVE (29/29 of its MUTANT-KILLED rows); statistics EXHAUSTIVE (25/25 of its MUTANT-KILLED rows) — the ENTIRE mutation-killed population, censused per error. 9 collapses — the prototypes' OWN history errors re-enact bit-exactly (b29#0 IS MU1, b20#0 IS MU2, b31#4 IS MU3, b24#0 IS MU4 through the crash face, b21#0 IS MU5, b31#0 IS MU6, b31#3 IS MU7, b31#5 IS MU8, b19#3 IS MU9: ALL 9 prototypes now have their provenance error as a bit-exact specimen — the class tie is the fixed point of per-error construction, 9 for 9). 12 error-level kills — the class tie was real but coarse: conjugation gave P3/P4 their first real-error trippers and the b26#0/b28#2 TWINS; wrong-object gave three P5 readout-object kills (joint cells as marginals, the partner's outcome pinned where summing was meant, the axis unitary applied where a measurement was meant); dimension-slot gave the tensor written as a product (b13#2, P2) and the 1x1-scalar mMul scaling (b31#1 — crash face on P5, distinct from MU3's P2 face, so no collapse). 2 equivalent survivors, PROVEN not merely un-killed, and of TWO DIFFERENT SPECIES: b30#0's globally-negated ket is invisible at the density layer (representation-blindness, a one-line elementwise proof) and b5#2's unguarded 0/0 ratio lives on a degenerate branch the battery's inputs never reach (P(zero accepted) <= 0.7^60 — input-coverage blindness, a probability bound; on every exercised input the construction is the CORRECT estimator). The JIA11 phenomenon is not one wall but (at least) two. The unbuildable 94 — the defect's home (optimizers, eigensolvers, simulators, protocols, verifiers, index conventions, calibration choices, property-internal constructions) is not a family member; no faithful re-enactment exists at this layer, and the booking says so, row by row.

## R-board — the repair audit (every BOOKED reason, refuted or held)

A BOOKED reason is a universal claim — "no machine can hold this line" — and such claims are not proved, they are REFUTED one witness machine at a time. Visit v0.9.0 audited one batch this way; this board audits the WHOLE booked population with a decidable criterion: does a recurrence of this row's defect die at a scheduled gate? 11 reasons had gone false (the machine convicted the sighting itself, or the gated trees kill the recurrence — b47#1's heredoc damage died at the loader, b56#7's transcription error died at the exact-zero tolerance, b37#7's dual repo list is single-sourced in the same edit) and their rows now sit on live anchors; 45 were coarse and are sharpened to name their FACES (the b54#1 dual-face precedent — which face is booked, which is held); the rest are held with the ungated face stated. The audit is STANDING LAW (R1): a booked row without a verdict fails the build, a later flip without an audit edit fails the build — born-audited, every one.

| verdict | rows | meaning |
| --- | --- | --- |
| UPGRADED | 11 | the reason went false — the row is GATE-ENFORCED now and the basis cites the falsifying anchor verbatim (R2) |
| SHARPENED | 45 | the reason survives but was coarse — rewritten to name the booked face and the gate-held face |
| HELD | 161 | the reason is true as written; the basis states the ungated face |

**Every verdict, with its basis:**

- **HELD** b2#3 — TS-Python parity needs both toolchains in CI; GitHub Actions is unreachable from this workspace (the GENESIS-C boundary) — no scheduled gate commands another machine's runner
- **HELD** b2#6 — which interpreter answers to python3 on this Windows box is environment state; no workspace gate commands the host
- **HELD** b2#7 — push-failure triage (network vs auth vs remote) is operator judgment over transient evidence; no gate sees the network
- **HELD** b4#3 — the retry loop's exit-code honesty is a shell act the gates never observe; the artifact it produces is checked, the loop itself is not
- **HELD** b8#5 — threshold policy is experiment design — what the engine schedules was corrected by hand; no gate chooses policy
- **HELD** b9#5 — search-effort allocation over 20k states is design work; a gate cannot price the author's stopping rule
- **HELD** b9#6 — instance-set strength is a claim about construction intent; no machine parses 'tight' 
- **HELD** b10#6 — the compass grind's abandonment was a judgment call mid-search; nothing scheduled observes a search in progress
- **SHARPENED** b10#8 — dual-face, made explicit: the ACT (hand-writing templates through a python heredoc) is transient and ungated; the DAMAGE face cannot ship — a truncated markdown template breaks the render the repro gate runs. Booked: the act face only
- **HELD** b10#9 — which side of a diagnosis is trusted is epistemics, not mechanics; no gate audits the author's trust
- **HELD** b11#7 — aggregation order (sum of ratios vs ratio of sums) is comparison semantics; no property pins intent — the comparison-design face is ungated
- **SHARPENED** b12#6 — dual-face: a wrong resolve root aimed at a missing file dies loudly at the gate that loads it (ENOENT — test/repro); the silent face is a wrong root that lands on a DIFFERENT existing file. Booked: the silent face only
- **HELD** b12#7 — rounding a measured slope toward a theorem's constant is prose honesty — and the priced target got its machine at ONE face (v0.22.0): S2 reconciles the census's OWN rendered report's numeric claims against the live arithmetic on every suite run; this row's face (the ledger repo's README prose) is not that report and stays booked — no gate diffs a sibling repo's intent
- **SHARPENED** b13#6 — dual-face: the heredoc-via-JSON patch act is transient; a damaged file landing in the gated tree dies at typecheck (the loader convicted the b47#1 twin exactly there). Booked: the act face only
- **HELD** b14#4 — tsx -e under Git Bash fails SILENTLY for TS-importing one-liners — the act leaves no artifact for any gate to see
- **HELD** b14#5 — which rows weaken a table is editorial selection; no gate judges row choice
- **HELD** b19#5 — README wording by the expected limit is prose honesty; the reconciliation gate exists since v0.22.0 at the census's own report face (S2) — a sibling repo's README is not that report, unenforceable line-by-line
- **HELD** b21#3 — hand-computed price columns corrected by the witness — prose-number reconciliation got its machine at the census's own report face (S2, v0.22.0); this row's price columns live in a sibling repo's ledger and stay booked on that face
- **SHARPENED** b22#2 — dual-face placement class: the ROOT face is gate-held since v0.9.0 (rootStrayFiles names root strays live); the system-temp face lives outside the workspace tree no scheduled gate can scan. Booked: the outside-tree face only
- **HELD** b22#3 — law-label sequencing (B0-B4 then B6) is authoring; no linter sequences another repo's law ids
- **SHARPENED** b23#3 — dual-face: the FAMILY-file face of the batch-23 class is gate-held — W-D byte-identity censuses every member live and its law cites this very class; the non-family idiom face (report.ts's contract) is review. Booked: the non-family face only
- **HELD** b25#1 — drafts one and two never reached a machine; the reread is the factory gate for pre-machine drafts — no scheduled gate compiles an editor buffer
- **SHARPENED** b25#6 — dual-face: the heredoc act is transient; a truncated render.ts cannot compile — the typecheck face dies on the spot. Booked: the act face only
- **SHARPENED** b26#1 — dual-face (b25#6's twin): the act is ungated, the truncated probe file is a syntax death in the gated tree. Booked: the act face only
- **HELD** b27#0 — design-before-code is sequencing discipline; collapsed drafts never reached the machine
- **HELD** b28#3 — count-after-construction (21 built, 20 shipped) is census discipline at authoring time; the instance census verifies content, not completeness intent
- **HELD** b29#4 — displayed fractions vs their true denominator is print-layer honesty; no gate formats the register's intent
- **HELD** b29#5 — already dual-face in its reason: unused symbols die at the gates, live-code residue (`| ""`) is review — the booked face is the live-code draft residue
- **HELD** b30#1 — toExponential(6) masking 1+2.1e-8 is a display-format choice; the witness columns carry the true digits, the format itself is not gated
- **SHARPENED** b30#4 — dual-face: the in-tree faces of the residue class (unused indirections, void branches, mid-file imports) die at lint/typecheck; the live-code placeholder face (a rejects() line that compiles) is review. Booked: the pre-machine draft and the live-code face
- **HELD** b32#7 — the >1000-means-sigma formatting heuristic is semantic labeling; no gate parses what a unit label claims
- **HELD** b32#9 — the kill census verifies KILLS; residue-free mutant construction is authorship — a sloppy mutant that still dies passes every gate
- **HELD** b32#11 — the tree-walk rewrite never reached the machine; pre-machine drafts are reread territory
- **SHARPENED** b33#0 — dual-face placement class (b22#2's family): the ROOT face is gate-held since v0.9.0 (rootStrayFiles); the /tmp face resolves outside the workspace (D:\Data\Temp) where no scheduled gate scans. Booked: the outside-tree face only
- **HELD** b33#2 — npx resolving deps from the wrong root is invocation environment; the sanctioned path (each repo's own npm run) is documented, not machine-forced
- **HELD** b33#3 — a scout pipeline that filters every line is a transient shell act; the numbers it would have produced are simply absent — nothing on disk to gate
- **HELD** b34#0 — the bash-inline regex surgery act is transient; its failure mode (zero replacements, silently) leaves the ORIGINAL file intact — no damaged artifact to catch
- **HELD** b34#3 — the phantom call was caught in self-review before any run; drafts that never reach the machine cannot be gated
- **HELD** b36#12 — folding one metric under another claim's label is field semantics; no gate parses what a field name promises
- **UPGRADED** b36#13 — the tolerance face is SELF-CATCHING: the gate refused its own witness at the sighting (a tolerance calibrated at one run's 1.3e-97 goes red the moment the class moves to n=5's 2.9e-79); recurrence dies at `dtc-clock/package.json :: test` — the machine convicted this very sighting
- **HELD** b36#14 — 8e9-flops Kraus multiplies are performance debt, not wrongness; no workspace gate times complexity
- **HELD** b36#15 — the D^2 C^4 vs D^2 C^3 mis-estimate is analysis arithmetic at design time; no gate audits an estimate
- **HELD** b36#16 — board literals drifting from witness numbers (rng consumption order) is the prose-number face; the board-vs-witness reconciliation gate EXISTS since v0.22.0 for the census's own rendered report (S2 — its first live run convicted three drifted phrases right there: 10-vs-7 full members, 4-vs-3 shares, 9/15-vs-11/33 audit counts); a sibling repo's board literals are not that report and stay booked
- **SHARPENED** b36#17 — dual-face: the heredoc act is ungated (it even swallowed the lines that bury it); the damaged-file face dies at the loader/typecheck the moment it lands — b47#1 was convicted exactly there. Booked: the act face only
- **UPGRADED** b37#1 — the wrong-depth import is module-loader bait: the ds suite refused it with ERR_MODULE_NOT_FOUND at the sighting, and the same wrong depth is TS2307 on the scheduled typecheck of the same tree; recurrence dies at `ds_extracted/ds/package.json :: test` — the machine convicted this very sighting
- **HELD** b37#6 — grep -c's exit-1-on-zero is shell semantics inside an author's && chain; no gate commands the author's shell
- **UPGRADED** b37#7 — FALSIFIED AND REPAIRED IN THE SAME EDIT (v0.10.0): total-gate.ts now imports the one EPOCH_REPOS from the census kernel — the second literal list is gone — and the single-source test fires on every suite run; a recurrence (any second literal repo list) dies at `mutant-census/test/census.test.ts :: b37#7`
- **HELD** b38#0 — scratch residue caught by the reread seconds after the batch-36 lesson; pre-machine drafts
- **HELD** b38#1 — the silent tsx -e family (b14's class): the act leaves no output and no artifact
- **HELD** b39#0 — the anchor-swallow is a patch act; the vanished header is caught only by eyes on the section face — no gate diffs comment structure
- **HELD** b40#0 — same anchor-swallow class, third and fourth sightings; the aftermath face is prose structure no gate parses
- **HELD** b42#1 — the python assert fired on prettier-reflowed text — a transient patch act; the assertion IS a guard, but it is the author's own, not scheduled
- **HELD** b43#2 — a MISS swallowed by an && chain is shell-act semantics; the stale-success face is process
- **SHARPENED** b44#1 — dual-face: the heredoc act is ungated; the structure-collapse face (three unused variables, a dead branch) dies at lint in the gated tree. Booked: the act face only
- **HELD** b45#3 — exhaustive-cost budgeting on render columns is a pre-run design call; no gate times a repro cell by cell
- **HELD** b45#4 — anchoring from memory instead of the disk is a patch act; the Edit MISS is its own refusal — nothing damaged lands
- **HELD** b45#5 — the 2 KB block anchor on invisible whitespace is a patch act, same face as b45#4
- **HELD** b45#6 — the runner binary's PATH residency is the author shell's environment; npm scripts resolve locally by design
- **HELD** b46#1 — the silent tsx -e family, fifth sighting — the act is outputless
- **HELD** b46#3 — the python heredoc anchor abort is a patch act that refused itself before any write — no artifact, no gate
- **HELD** b47#0 — the pre-flight validation harness exists and convicted the drafts — but it runs at delivery step 0, not on a scheduled gate; the rule-authoring face stays process
- **UPGRADED** b47#1 — the damaged file landed in the gated tree and the loader convicted it on the spot (a real newline inside two string literals is a syntax death); recurrence dies at `mutant-census/package.json :: typecheck` — the machine convicted this very sighting
- **HELD** b48#1 — the anchor assert failed and the render edit silently never landed — a no-op act; the guard that catches it is greping the report face before closing, which is process
- **HELD** b48#2 — the read-state refusal is the harness tool's own guard — a machine, but not a gate this workspace schedules; the refusal IS the enforcement
- **HELD** b49#0 — the -e family's survival mode is working-sometimes: silent failure is not always fatal, and an act with no artifact has no gate
- **SHARPENED** b49#2 — dual-face placement class (b22#2/b33#0 family): the ROOT face is gate-held since v0.9.0 (rootStrayFiles); the system-temp face is outside the tree. Booked: the outside-tree face only
- **HELD** b49#3 — the Bash channel's escape-eating is tool-layer physics; the channel is banned by rule, and rules about channels are process — no gate inspects how a patch was delivered
- **HELD** b50#0 — the backslash-through-channel class, eighth sighting — same transient act face as b49#3
- **HELD** b50#1 — derivation conventions are verified by numeric probes in the scratch harness; no gate reviews a derivation — the probes do, and they are author's tools
- **HELD** b51#0 — product-function residue caught by reread before any run; the pre-machine face
- **HELD** b51#4 — nested quotes die in the Bash channel exactly as backslashes do — the same transient act face
- **HELD** b51#5 — the transposition typo lived in numeric prose; verbatim-anchor copying exposed it a visit later — prose-number reconciliation is built at the census's own report face (S2, v0.22.0); this row's prose was a scratch derivation's, that face stays booked
- **HELD** b51#7 — replace-scoping is a patch act; B8 catches the aftermath on the memory side, the act itself is ungated
- **HELD** b52#0 — the false-green probe point lived in a scratch derivation; the Richardson cross-check that killed it is an author's tool, not a scheduled gate
- **HELD** b52#1 — the missing (1-p)-expansion terms were scratch-derivation arithmetic; same face as b52#0
- **HELD** b52#2 — the channel class again — the patch died at its own anchor assert; nothing landed
- **HELD** b53#0 — the Edit-before-Read refusals were the harness guard firing — enforcement happened, but by the tool, not a scheduled gate
- **HELD** b54#1 — already dual-faced by the v0.9.0 audit: the typecheck-tree face is GATE (TS2305, the b46#2 precedent), the scratch face is booked — re-audit confirms both faces as written
- **HELD** b65#1 — the cross-session stale read-state is the same harness-guard face as b48#2/b53#0 — the tool's refusal is the line, and it fired
- **HELD** b55#0 — first-draft residue under the wrong label caught by reread; pre-machine face
- **HELD** b55#1 — residue in the REPLACEMENT draft, minutes after enrolling the first — pre-machine face, same as b55#0
- **HELD** b55#2 — test-draft residue caught on reread before the suite; pre-machine face
- **HELD** b55#3 — arXiv digits are external truth: memory holds the shape, the publisher holds the digits; no local gate can reach the source (double-sourcing is process)
- **HELD** b55#5 — the needle-from-memory patch act; the assertion refused it — an author guard, not a scheduled gate
- **HELD** b55#6 — the cancellation-prone arrangement compiles and runs; which arrangement was chosen is design semantics no machine holds — the discipline (and the suspicious-zero alarm) is process
- **HELD** b56#0 — collision-scratch residue caught on reread; pre-machine face
- **HELD** b56#1 — dead placeholder block in a test draft caught on reread; pre-machine face
- **SHARPENED** b56#2 — dual-face (the b54#1 shape): the SCRATCH face is booked — Node's first-run refusal is instant but instant is not a gate (the file dies before gates run); the PRODUCT-tree twin face is TS2305 on the scheduled typecheck (the b46#2 precedent — b56#3 rides it). Booked: the scratch face only
- **UPGRADED** b56#3 — the missing-import face fired in PRODUCT code (audit.ts): two consecutive loader refusals at run, and the same defect is TS2305 on the scheduled typecheck of the same tree; recurrence dies at `stable-world/package.json :: typecheck`
- **HELD** b56#4 — the wrong-object check (full matrix where dephased was meant) convicts nothing loudly — S(copy)-S(rho)=0 always; semantic object choice is ungated by any generic machine
- **HELD** b56#5 — the phase-blind reference state is a wrong-object check in scratch; same ungated semantics face as b56#4
- **HELD** b56#6 — the failed patch plus deleted evidence is an act-sequence face; the rule (evidence survives until the corrected run) is process
- **UPGRADED** b56#7 — transcription errors into an exact-zero witness die at the tolerance: the commutator printed 3.30e+0 against an exact-zero claim and the suite went red at the sighting; recurrence dies at `stable-world/package.json :: test` — the machine convicted this very sighting
- **UPGRADED** b56#8 — a NaN witness fails loudly (NaN <= tol is false): the coherence-factor probe failed the suite at the sighting; recurrence dies at `stable-world/package.json :: test` — the machine convicted this very sighting
- **HELD** b56#9 — citation YEARS are external truth, same face as b55#3 — the publisher's record is the only source
- **HELD** b57#0 — void-suppressed imports caught on reread; the void idiom evades no-unused-vars by design, the pre-machine face is booked (removal-not-suppression is the rule)
- **HELD** b57#1 — applying a T=0 closed form at finite beta is domain-semantics — the formula was correct on its own domain; no generic gate checks a formula's domain of application
- **HELD** b57#2 — the tightness assertion compared a convenient superset — assertion-object choice is semantics, ungated generically (the scratch face)
- **UPGRADED** b57#3 — an undefined name in a product loop is TS2304 on the scheduled typecheck — the b54#2 precedent verbatim (the sighting's ReferenceError at run is the same death one gate earlier); recurrence dies at `stable-world/package.json :: typecheck`
- **HELD** b57#4 — the dead term inside a live expression was caught on reread; expressions-as-formulas review is pre-machine
- **HELD** b57#5 — board numbers vs the witness's own census — the prose-number face again; the reconciliation gate holds the census's own report since v0.22.0 (S2), this row's board is a sibling repo's and stays booked
- **HELD** b58#0 — the four convention slips lived across two scratch drafts; the eigenvalue arbiter that killed them is an author's probe, not a scheduled gate
- **HELD** b58#1 — the vacuous loop printed ZERO from an empty range — scratch-analysis face; the 'is the loop nonempty' check is author discipline
- **UPGRADED** b59#0 — a phantom import (applyUnitaryLocal) in product code is TS2305 on the scheduled typecheck; the sighting was caught at reread, but recurrence that reaches the tree dies there — the b54#2 shape (caught by review, gated on recurrence) at `stable-world/package.json :: typecheck`
- **HELD** b59#1 — the self-dividing ratio was a check that could never fail — tautology detection needs the known-answer test case, which is authoring; no generic gate proves a check can fail
- **HELD** b59#2 — the conjugation-sign convention is derivation semantics in scratch; conventions are written down by hand, no machine holds which side carries the conjugate
- **HELD** b59#3 — the heredoc-created code file survived because its content was benign — 'this time it was harmless' is the family's survival mode; content-based exceptions are banned BY RULE precisely because no gate can audit the channel
- **HELD** b59#4 — the dead helper was caught on reread; pre-machine face (fifth sighting of the class)
- **HELD** b59#6 — board rows out of order for a whole visit, unnoticed by every gate — the id-order checker EXISTS since v0.22.0 for the census's own rendered report (S1 legislates the section order and convicts permuted sections, unordered rows and unknown sections BY NAME); no scheduled gate parses a sibling repo's board arrays, that face stays booked
- **HELD** b59#7 — the escaped-needle python patch refused itself and landed on retry via Edit — transient act face
- **HELD** b60#0 — the nonsense && inside reduce was caught on reread before any run; pre-machine face
- **HELD** b60#1 — trailing void for an unused import, caught in the same reread; pre-machine face
- **HELD** b60#2 — the horizon is a PRE-RUN decision — budgeting is design; no gate prices a census cap before the first run
- **SHARPENED** b60#3 — dual-face (b54#1/b56#2 family): the SCRATCH face is booked (refused at first run, gone before gates); the product-tree face (importing a private member) is TS2305 on the scheduled typecheck — the b46#2 precedent. Booked: the scratch face only
- **HELD** b60#4 — the overflow NaN was an arrangement choice in scratch printing; scaled division is the discipline, no gate holds arrangements
- **HELD** b60#5 — the insertion script asserted on a remembered function shape and wrote nothing — transient act face
- **HELD** b60#6 — the channel's fourth refusal of the same patch class — transient act face, nothing landed
- **HELD** b61#0 — the hand-derivation factor slips lived in scratch; the reconciliation anchor that killed them is an author's probe
- **HELD** b62#0 — the NaN assembly was caught on the scratch output face; re-choosing the deliverable shape is design
- **HELD** b62#1 — trailing void caught by the pre-run cleaning pass; pre-machine face
- **SHARPENED** b63#0 — dual-face: the scratch-analysis face is booked; the IN-TREE guard-boolean face is suite-held — b61#1's inverted guard was convicted by the tests on the spot. Booked: the scratch face only
- **HELD** b63#1 — the dropped /4 lived in hand analysis; the exact chain identity corrected it — author's identity chain, not a gate
- **HELD** b64#0 — the heredoc-created scratch survived benign (tenth enrollment of the class) — the channel is ungatable by rule, not by machine; no content-based exceptions
- **HELD** b64#1 — the copy-paste explosion was caught in self-review of the command line — the command channel is not a gate's territory
- **HELD** b66#5 — already dual-faced at enrollment (the v0.2.0 dsic-noether delivery): the renderer face is unenforceable (no scheduled gate runs exp5), the same logic is gated in the test tree's skew case — re-audit confirms as written
- **HELD** b67#0 — the act face — a heredoc-created scratch that survived by luck, eleventh sighting committed while the audit board itself was being written; no machine sees the channel, the Write-tool rule is the only guard, and the damaged-file face dies at the loader (the b47#1 twin)
- **HELD** b67#2 — live-code construction residue in a test draft caught on reread — the pre-machine face; the class's unused-symbol faces die at lint in-tree (b67#1 rides that face), the live-code face is review-only
- **HELD** b67#4 — patch-act face: the needle-from-memory Edit miss was refused by the tool's own guard — a machine, but not a scheduled gate (the b45#4 family; the refusal fired)
- **UPGRADED** b67#6 — FLIPPED ONE VISIT LATER UNDER R1's STANDING LAW: the priced refutation target got its machine — E7 (v0.11.0) checks the description's stated tier counts against the live enrollment arithmetic on every suite run and the renderer refuses to print a drifted self-description; recurrence dies at `mutant-census/test/census.test.ts :: E7`
- **SHARPENED** b68#2 — dual-face since v0.14.0: the swallow's AFTERMATH face (the orphaned tail line, the repeated-label signature, verbatim heading doubles) is gate-held by B9 — the repeated insertions of one day each left exactly these signatures; the ABSENCE face (a heading silently gone, no fragment left) has no should-exist oracle and stays booked with the section-face grep as its discipline
- **HELD** b69#0 — pre-machine draft residue in a template string caught on the post-edit reread — the pre-machine face (the b55#0 class); the in-tree syntax-visible faces of residue die at typecheck, prose-in-string residue is review
- **HELD** b69#1 — patch-act face: the anchor-from-memory Edit miss was refused by the tool's own guard (the b45#4 family) — a machine, but not a scheduled gate
- **HELD** b70#2 — pre-machine draft face: the never-fail assertion was caught on reread before the suite ran — the b59#1 class (a check that cannot fail is constructed zero); no gate proves a check can fail generically
- **UPGRADED** b70#3 — FLIPPED ONE VISIT LATER UNDER R1's STANDING LAW (the second priced target to get its machine, after E7): B9 (v0.5.0 of the record) checks every cited daily note's structure on every suite run — the repeated-label signature this error IS, the orphaned tails its family left, and verbatim heading doubles all convict by line number; recurrence dies at `burial-record/src/kernel/audit.ts :: memoryStructureViolations`
- **HELD** b71#0 — command-act face: the detached duplicate launch raced its own gate — the cost was real (wall-sum inflated 42%) but the act lives in the author's shell, which no scheduled gate inspects; read-the-whole-line is the discipline (the b64#1 family)
- **HELD** b72#0 — law-design face: the first invariant was false (visit-number uniqueness) and the live first run convicted legitimate history — no scheduled gate proves a law's invariant true; the run-before-landing probe is the discipline (the b50#1 numeric-probe family, applied to law design)
- **HELD** b72#1 — edit-act face: the newline-dropping insert was caught on the post-edit reread — no scheduled gate diffs formatting intent; read-back after every structural insert
- **HELD** b73#1 — scratch-act face: the mechanical trio lived in a scratch file that dies before gates by design; the kernel's richardsonLimit handles arbitrary step ratios and its outputs are gate-asserted — the scratch face is author review
- **HELD** b73#2 — budget face: the O(K^2) loop hang has no non-timeout gate; the incremental recurrence it became is spot-checked under the suite — complexity-estimation before a scale run is a stopping-rule judgment, not a machine
- **HELD** b73#3 — frame face: no scheduled gate audits the choice of comparison frame — the mismatched-scale section was scrapped on the numbers it produced; scale-first is derivation discipline (the wrong-object class's ungated subspecies)
- **HELD** b73#4 — noise-floor face (b55#6's class at a new subtraction): the fitted value beyond the cancellation floor was wrong but the second-law value is asserted at k=8192 under the suite — the beyond-floor fit domain is author arithmetic
- **HELD** b73#10 — counter face: visit/batch numbering is pre-gate shared state by construction — no scheduled gate numbers visits; grep-the-registry-first is the discipline (the b65 law, executed pre-emptively here)
- **HELD** b74#0 — shell-act face: the masking pipe lives in the author's shell, which no scheduled gate inspects; the conviction came from the CI runner — unreachable from this workspace (the b2#3 GENESIS-C boundary); read-the-exit-code-directly (PIPESTATUS, or no pipe) is the discipline (the exit-code-masking family, sixth sighting)
- **SHARPENED** b74#1 — dual-face placement class (b22#2/b33#0/b49#2 family): the ROOT face is gate-held since v0.9.0 (rootStrayFiles names root strays live); the /tmp face resolves outside the workspace tree where no scheduled gate scans. Booked: the outside-tree face only
- **HELD** b74#2 — shell-act face, the same-day recurrence of b74#0 (the family's seventh sighting): $? after a pipe is the tail's code — no scheduled gate reads another process's shell; PIPESTATUS[0] is the discipline
- **HELD** b74#3 — agent-discipline act face: the git ban is delivery protocol — no scheduled gate observes a delivery agent's commands; the deliverable state is read from files, and read-only-ness grades the offense without unmaking the ban
- **HELD** b74#4 — pre-machine reread face (the b55#0 class): the no-op edit never reached a machine — the reread is the factory check
- **HELD** b74#5 — external-truth face (the b55#3 class): a citation's claim text answers to the publisher's record, which no local gate can reach — the double-source ritual is the guard, and deletion on the spot is its execution
- **HELD** b74#6 — delivery-hygiene face: the in-tree residue faces died at the successors' gates (lint/typecheck/test convicted them until closure); the leaving-behind act itself — stale README, missing report tables — is interruption process no gate diffs
- **HELD** b74#8 — claim-object face (the b57#2 superset class): no gate parses which population a verdict's prose names — the 6×8-specific restatement is the fix; prose-vs-witness reconciliation got its machine at the census's own report face (S2, v0.22.0), this verdict-population face stays ungated
- **SHARPENED** b74#9 — dual-face: the act face (rewritten on the spot, pre-machine) is booked; the landing face — require() in the ESM tree — is a loader death the gates convict the moment it lands (the b47#1 precedent, the same death one gate earlier). Booked: the act face only
- **HELD** b74#10 — scratch-arbitration face (the b52#0 class): the bad unitary and the withdrawn 'transpose fix' lived in scratch and were refuted by variant enumeration — an author's probe, not a scheduled gate
- **SHARPENED** b74#11 — dual-face: the apostrophe was caught pre-machine (the act face is booked); the landing face is a parser death at typecheck. Booked: the act face only
- **SHARPENED** b75#6 — dual-face placement class (b22#2/b33#0/b49#2/b74#1 family): the ROOT face is gate-held since v0.9.0 (rootStrayFiles names root strays live); the /tmp face resolves outside the workspace tree where no scheduled gate scans — three gate logs landed there during the causal-ineq delivery. Booked: the outside-tree face only
- **SHARPENED** b75#13 — dual-face: the heredoc act is ungated — the channel's twelfth canonical sighting (the family's wrong-text sightings grepped to 16 in-registry before enrolling), and 'not repeated' grades the offense without unmaking the ban; the damaged-file face dies at the loader/typecheck the moment it lands (the b47#1 twin). Booked: the act face only
- **SHARPENED** b76#0 — dual-face (the b74#9 twin, one wave later): the act face — dummyRng's require() rewritten to an import on the spot, pre-machine — is booked; the landing face, a require() in the ESM tree, is a loader death the gates convict the moment it lands. Booked: the act face only
- **HELD** b76#3 — dead-but-parseable scaffolding left by a failed edit: no unused-code gate is wired in this tree, the rewrite removed the residue — the reread is the factory check
- **HELD** b76#7 — the fake-number family attempted and self-caught pre-ship — S2 (v0.22.0) now diffs the census's own rendered prose against the live arithmetic on every suite run; the attempt face (values written before ANY run, in a sibling repo's prose) is upstream of every render and stays booked (the b12#7/b21#3 line)
- **HELD** b76#8 — docs-content destruction (theory.md's referee section) is outside every scheduled gate's sight — the backup restore was manual, the docs face is ungated
- **SHARPENED** b76#9 — dual-face: the heredoc append act is ungated — the channel's thirteenth canonical sighting (wrong-text sightings grepped to 17 in-registry before enrolling); the damaged-file face dies at the loader/typecheck the moment it lands (the b47#1 twin). Booked: the act face only
- **HELD** b76#23 — print-layer honesty: whether a display truncation hides the load-bearing digits is prose judgment (the b29#4/b30#1 display face) — the rewritten display is review, not machine
- **SHARPENED** b76#24 — dual-face: the heredoc scratch act is ungated — the channel's fourteenth canonical sighting (the thirteenth is b76#9, same batch), and the deletion does not unmake the breach; the damaged-file face dies at the loader/typecheck the moment it lands. Booked: the act face only
- **SHARPENED** b77#8 — dual-face (the b74#3 twin, one wave later): the act face — a read-only git status against the unconditional agent-git ban — is booked; no mutation occurred and no output shipped, the deliverable's state is read from the files. Booked: the act face only
- **HELD** b77#11 — transient environment face: one W-F filesystem miss against an anchor on disk, re-run green, never reproduced — the witness itself fires on every suite run; there is no machine to build against a ghost, the re-run is the resolution
- **HELD** b78#1 — a hung run is killed by hand and no non-timeout gate prices a workload before launch (the b73#2 line) — the load-reduced redesign's own cross-checks ride the delivered suite; the complexity-estimate discipline is the booking
- **SHARPENED** b78#9 — dual-face (third act on the b74#3/b77#8 line, now the diff flavor): the act face — a read-only `git diff --stat` inside a compound command — is booked; no mutation, no output shipped. Booked: the act face only
- **SHARPENED** b78#10 — dual-face (the exit-code-masking family's eighth sighting, an attempted one): the shell-act face — a display pipe eating the suite's verdict — is booked, caught by self-review before any verdict was taken from it; the landing face never existed, the re-run's direct exit code is the resolution. Booked: the shell-act face only
- **SHARPENED** b78#12 — dual-face (the b74#6 class): the in-tree residue — an uncompilable compose.ts stub plus a scratch-bench — died at the successor's typecheck exit 2 on arrival; the leaving-behind act is interruption process no gate diffs. Booked: the leaving-behind face only
- **HELD** b78#13 — doc face: a doc comment claiming oldest-first against the code's newest-first register — no scheduled gate parses comment intent against the machine's own register-order note; the v0.2.0 docs carry the corrected statement, the comment's semantics were never wrong
- **SHARPENED** b78#14 — dual-face: the heredoc act is ungated — the channel's fifteenth canonical sighting (wrong-text sightings grepped to 19 in-registry before enrolling); the truncated block died at the loader the moment it landed and was restored by Edit. Booked: the act face only
- **SHARPENED** b78#15 — dual-face (the b74#6 class, second row of the wave): the orphan draft's three defects died at the successor's gates and the JW25 mischaracterization is corrected with a logged erratum pinned in vacuum-compiler/docs/citations.md; the leaving-behind act is interruption process no gate diffs. Booked: the leaving-behind face only
- **SHARPENED** b79#0 — dual-face: the heredoc act is ungated — the channel's sixteenth canonical sighting (wrong-text sightings grepped to 19 in-registry, unchanged by this clean act, counted before enrolling); the patch verified clean after the act, which does not unmake the breach, and the damaged-file face dies at the loader/typecheck the moment it lands. Booked: the act face only
- **HELD** b79#6 — doc face: the README's '19/19' is prose on a surface no scheduled gate reads — E7 holds the census's own description, B7/B8 hold contexts and headings, and the README is neither; the count re-derived from the run (78/78) in the same edit is the discipline. Booked: the doc face
- **SHARPENED** b79#13 — dual-face, no landing: the shell act (a bash template-string escape that failed and produced nothing) is booked — no machine sees the shell and the Write/Edit rule is the guard; the tree face never existed, nothing landed to gate. Booked: the act face only
- **SHARPENED** b79#14 — dual-face (the exit-code-masking family's ninth sighting, an attempted one): the shell-act face — a gate run through a pipe — is booked, caught by self-review, killed on sight, re-run for the direct exit code; the landing face never existed. Booked: the shell-act face only
- **HELD** b80#1 — the fake-number family's third registered attempt and self-caught pre-ship — S2 (v0.22.0) diffs the census's own rendered prose against the live arithmetic on every suite run, but the attempt face (a claim asserted before ANY run, in a sibling repo's delivery note) is upstream of every render and stays booked (the b12#7/b21#3/b76#7 line)
- **HELD** b80#2 — doc face: the X8 doc quoting scratch numbers where the renderer carries its own is prose on a surface no scheduled gate reads — E7 holds the census's description, B7/B8 hold contexts and headings, and a repo doc is neither; the re-sync to the rendered data in the same edit is the discipline (the b79#6 line). Booked: the doc face
- **SHARPENED** b80#3 — dual-face placement class (b22#2/b33#0/b49#2/b74#1/b75#6 family): the ROOT face is gate-held since v0.9.0 (rootStrayFiles names root strays live); the hash-verification temp file resolved outside the workspace tree where no scheduled gate scans — deleted after the act, which does not unmake the placement. Booked: the outside-tree face only
- **HELD** b80#5 — a one-time audit's summary face: the two grep totals were re-derived from the raw output before any number was quoted and no scheduled gate re-runs an audit's greps — a grep is a tool with an output format and the format is part of the query, but the discipline is author-side. Booked: the summary face
- **SHARPENED** b80#6 — dual-face (the exit-code-masking family's tenth sighting, an attempted one): the shell-act face — a hygiene agent's gate run through a pipe — is booked, caught by self-review, killed on sight, re-run for the direct exit code; the landing face never existed, no verdict was taken from the pipe. Booked: the shell-act face only
- **SHARPENED** b81#1 — dual-face (the exit-code-masking family's eleventh sighting, an attempted one): the shell-act face — the format:check verdict read through a tail pipe, tail's 0 displayed where prettier had failed — is booked; the landing face never existed (the warning text was acted on and the direct exit code was read after). Booked: the shell-act face only
- **SHARPENED** b81#2 — dual-face (the family's twelfth sighting, one visit after the eleventh): the shell-act face — the TS7 scratch lint's verdict read through the same pipe shape, a displayed 0 under a crashed lint (true exit 2) — is booked; the landing face never existed (the guard's stack was read and the re-run took the direct code within the minute). Booked: the shell-act face only
- **HELD** b81#3 — lockfile-intent face: no scheduled machine diffs a local node_modules resolution against an external PR's lockfile — the pin-is-the-intent rule is author-side, and the exact-pin reinstall preceded the commit (zero tree impact). Booked: the lockfile-intent face
- **SHARPENED** b81#4 — dual-face (the sanctioned-channel family): the heredoc act is transient and ungated — nothing sees the shell channel; the damaged-file face cannot ship, a malformed package.json is a JSON-parse death at the very next npm invocation (verified clean this time; clean does not absolve, the b79#10 judgment). Booked: the act face only
- **SHARPENED** b82#3 — dual-face (the exit-code-masking family's thirteenth sighting, an attempted one): the shell-act face — a gate piped through tail — is booked, caught by self-review in the same breath, killed on sight, re-run for the direct exit code; the landing face never existed, no verdict was taken from the pipe. Booked: the shell-act face only
- **HELD** b82#5 — pre-machine face: the dead scaffolding was rewritten whole before any run — the reread is the factory check, no gate compiles an editor buffer
- **HELD** b82#6 — patch-act face: the Edit-before-Read refusal fired — the tool's own guard is the enforcement, but it is not a scheduled gate; nothing damaged landed
- **SHARPENED** b82#7 — dual-face (the sanctioned-channel family's eighteenth sighting): the node -e act is transient and ungated — nothing sees the shell channel; the damaged-file face cannot ship, a malformed test file is a parse death at the loader/typecheck the moment it lands (verified clean this time; clean does not absolve, the b79#10 judgment). Booked: the act face only
- **HELD** b82#9 — pre-machine face: the transient duplicate died at the read-back — its landing face would be a duplicate-declaration death at typecheck, the reread closed it first
- **HELD** b82#11 — pre-machine face: a stray blank line is cosmetic residue caught on the read-back; no gate diffs whitespace intent
- **HELD** b82#15 — comment face: the bracket mismatch lived in prose no gate parses — the reread is the factory check (the b79#6 doc-face line)
- **HELD** b82#16 — query face: a one-time verification's regex-vs-literal mistake re-run correctly within the minute — no scheduled gate re-runs an author's greps (the b80#5 class)
- **HELD** b82#20 — patch-act face: the Edit-before-Read refusal fired for the wiring agent exactly as it fired for the delivery agent one batch-row earlier — the tool's guard is the enforcement, but it is not a scheduled gate; nothing damaged landed
- **HELD** b82#21 — sequencing face: the K-board divergence registration and the artifact re-render are companion edits no gate can schedule — the suite convicted the incomplete state, which is the gate working on an act that should not have been sent half-done
- **HELD** b83#0 — pre-machine face: the mangled import block was fixed on the immediate reread — its landing face is a typecheck death, the reread closed it first
- **HELD** b83#1 — pre-machine face: the swallowed import block was restored from the reread in the same minute — the landing face would be a loader/typecheck death
- **HELD** b83#3 — pre-machine face: the alias residue was found on the reread and removed — the landing face is a duplicate-constant death at typecheck
- **SHARPENED** b83#4 — dual-face: the pre-machine act (imports landing after the code that uses them) is booked; the landing face — used-before-import — is a TS2552/TS2305 death at the repo's typecheck the moment it lands, and the gate never had to say it. Booked: the pre-machine face only
- **HELD** b83#5 — deletion-channel face (founding note): trash is not installed in this Git Bash and no workspace gate commands the environment — the zero-reference grep before the rm is the discipline that makes the channel honest
- **HELD** b83#8 — environment face: tsx -e with a relative import fails silently under Git Bash — the act leaves no output and no artifact (the b14#4/b38#1/b46#1 line); the in-repo scratch-file rule is the enforcement
- **SHARPENED** b83#9 — dual-face (the exit-code-masking family's fourteenth sighting, an attempted one): the shell-act face — the first gate authentication piped through tail — is booked, caught in self-review, killed on sight, re-run with NO pipe for the true code; the landing face never existed. Booked: the shell-act face only
- **HELD** b83#10 — pre-machine face: both corrections (rejects() for the async trial, the awaited probe) landed on the draft's own reread before the suite ran — an unhandled rejection riding a green run is exactly what the reread is for
- **SHARPENED** b83#17 — dual-face (the family's fifteenth sighting, ONE ROW after the fourteenth, attempted by the wiring agent itself): the shell-act face — tail printing the failures while EXIT echoed tail's own 0 — is booked; no verdict was taken from the pipe, the re-run's direct code (1, the expected pre-wiring red) is the only verdict. Booked: the shell-act face only
- **HELD** b83#18 — cross-reference face: no scheduled gate parses registry prose's family-citation keys against the rows they name — the grep-before-enrolling discipline is the guard, and it is what caught this one (the citation corrected in the same edit)
- **HELD** b83#19 — doc face: the README's headline count is prose on a surface no scheduled gate reads — B7/B8 hold contexts and headings, E7 holds the census's description, and the README is neither; the count re-derived from the registry in the same edit is the discipline (the b79#6 line)
- **HELD** b83#20 — patch-act face: the Edit-before-Read refusal fired on the wiring agent's own second package.json of the visit — the tool's guard is the enforcement, but it is not a scheduled gate; nothing damaged landed (the b82#6/b82#20 twins, now three wiring-agent offenses on the same line)
- **HELD** b84#2 — pre-machine face: the deletion's residue survived two of its three edits — the landing face is a dead-symbol death at typecheck/lint; the grep-then-delete pass closed it, no gate compiles an editor buffer mid-edit
- **HELD** b84#3 — pre-machine face: the inverted-intent write-back was reversed on the immediate reread — no scheduled gate observes an edit's direction, the read-back is the factory check
- **SHARPENED** b84#4 — dual-face (the exit-code-masking family's sixteenth sighting, an attempted one): the shell-act face — a gate authentication piped for display — is booked, no verdict taken from the pipe, the re-run's DIRECT exit code the only verdict; the landing face never existed. Booked: the shell-act face only
- **HELD** b84#5 — doc face: a performance claim measured under parallel load is prose on a surface no scheduled gate benchmarks — the honest duration replaced it in the same edit (the b79#6 line). Booked: the doc face
- **SHARPENED** b84#7 — dual-face (the family's seventeenth sighting, one delivery after the sixteenth): the shell-act face — npm test through a tail pipe — is booked; the landing face never existed, the no-pipe re-run is the only verdict. Booked: the shell-act face only
- **HELD** b84#8 — pre-machine face: the TOL_LOCAL_NEVER alias was cleared inside the same edit (the b83#3 twin) — its landing face is a duplicate-constant death at typecheck, the reread closed it first
- **HELD** b84#16 — pre-machine face: the meaningless ternary was simplified in self-review before any run — no gate proves an expression computes the same value both ways, the reread is the factory check (the b82#5 face)
- **HELD** b84#18 — pre-machine face: the misplaced import was caught on self-review and moved in the same minute — its landing face is an ordering death at lint/typecheck the gates never had to say
- **HELD** b84#19 — environment face: the -e one-liner shape (node --import tsx -e with a relative dynamic import) leaves no artifact on failure — the b14#4/b38#1/b46#1/b49#0/b83#8 line's exact mode; the in-repo scratch probe or the suite's own W-D witness is the enforcement, neither is a scheduled gate
- **HELD** b84#20 — pre-machine face (the wiring agent's own): the forged-value cast was replaced with the plain literal on the edit's own reread — E6 names the forged runtime string at the next run (the vocabulary is closed on the VALUE), so the landing face is gate-held; the drafting act itself no gate sees. Booked: the pre-machine face
- **HELD** b84#21 — sequencing face (the wiring agent's own, the b82#21 class): the census suite convicted the drifted G2 resolution row at its first run — the aftermath is gate-held (W-H fires on every run), but the derivation itself (the tier computed from the machine's own familyOf assignment instead of the author's filing intent) is author-side arithmetic no scheduled gate performs for the author

## T-board — the total gate

`npm run total` runs the WHOLE workspace as one verdict: every epoch repo's test suite AND typecheck, plus the main platform repo's full suite — machine-judged, stamped, rendered to `out/reports/the-total-gate.md`. The artifact records the last explicit run; this census verifies the command exists and the artifact's contract. 全量 is a command, not an adjective.

## Witnesses (independent re-derivations)

- PASS — W-A kill census (9/9 killed as declared — EXACT 6, CRASH 1, DATA 2, SURVIVED 0; margins MU1:1.8e+0 MU2:1.0e+0 MU3:4.0e+0 MU5:3580 MU6:8.5e-1 MU7:8.4e-1 MU8:5.9e+2 MU9:6.7e+1)
- PASS — W-B property battery (10 properties green on the canonical family; worst deviations P1=0.0e+0 P2=4.4e-16 P3=6.7e-16 P4=6.7e-16 P5=4.4e-16 P6=6.7e-16 P7=1.6e-13 P8=5.4e-1 P9=1.5e+0 P10=5.6e-16)
- PASS — W-C negative controls (3 synthetic violators fired (P1 shape-blind product, P3 lopsided outer, P4 non-CPTP Kraus); the mutant-trippers are proven by W-A itself)
- PASS — W-D family census (42 file-pairs byte-identical to the canon; 22 registered divergences live (22 registered); 0 unregistered, 0 stale — the register matches reality exactly)
- PASS — W-E workspace census (28/28 epoch repos: test+typecheck+repro and strict TS, 0 unguarded entries TOTAL (the pre-batch-21 guard debt PAID in batch 33 — 42 entries retrofitted, every gate re-run green); platform censused: ds_extracted/ds (test+typecheck mandatory, repro = the GENESIS-A registered debt, not a missing flag); report artifacts on disk: 22/29; workspace root: 0 strays (registered: probe.ts) — the root-stray gate, v0.9.0)
- PASS — W-F enrollment census (608 errors enrolled LIVE against a registry of 84 batches (declares exactly what it carries) — MUTANT-KILLED 117, GATE-ENFORCED 285, BOOKED-UNENFORCEABLE 206, every booked row printed on the report)
- PASS — W-G anchor census (159 guards registered: 102 firing-inject demos on disk, 9 fired live this run, 48 resolved to machinery)
- PASS — W-H genealogy census (16 families over 608 errors (15 recurring, all resolved); catch census gate 95 / author 465 / numbers 47 / visitor 1 — the gate fraction rose from 1% (b1-22) to 25% (b37+); count-drift held by B7: true)
- PASS — W-I per-error equivalence census (117 rows censused PER ERROR across 4 pilot classes (conjugation, wrong-object, dimension-slot, statistics): 9 collapses (bit-exact with their prototypes), 12 error-level kills (distinct constructions, killed live), 2 equivalent survivor(s) (booked with proofs), 94 unbuildable (the defect's home is not a family member) — battery-indistinguishability decided on all ten properties (10))
- PASS — W-Y repair audit census (217 booked-population rows audited LIVE (of the 206 booked + 11 upgraded) — UPGRADED 11 on cited live anchors with needle-level firing evidence (R4, 11 needles in the cited gates' own trees), SHARPENED 45 to named faces, HELD 161 with the ungated face stated; born-audited is law)
- PASS — W-S self-report census (S1: 14 legislated sections in the closed order, M-board rows ascending by id, A-board kinds in evidence order; S2: 83 numeric prose claims reconciled against the live arithmetic — the artifact face on disk is re-derived by the suite on every run)

## Boundaries

- The mutant set is HISTORICALLY MOTIVATED, not exhaustive: nine defect classes compiled from the burial record, not a proof that no tenth class exists. Equivalent mutants are a known open problem of the field (JIA11); none are claimed away here — and the conjugation class now carries a per-error equivalence census (J-board) with one PROVEN specimen booked.
- The family's mAdd does NOT check shapes — by design, recorded at batch 31 ('the dimension account is always the coder's'). MU3 is killed at the COMPOSITION layer (the embedding's dimension contract), not by an adder that would break ten byte-identical members.
- Statistical kills are DATA-grade: they convict at 5 sigma by design of the property, not by theorem. The exact kills are exact.
- The W-board's unguarded-entry detector is a string-level heuristic (writeReport/writeFileSync without the guard); its misses are surfaced, not enforced — the K-board's hash census is the exact one.
- The registered divergences record THAT bytes differ and why they may; whether they SHOULD is each repo's appeal court (`npm test` there). This census adjudicates identity, not intent.
- The E-board's MUTANT-KILLED tie is CLASS-level; the J-board has now measured the per-error question on ALL FOUR classes EXHAUSTIVELY (conjugation 19/19 at v0.8.0; wrong-object 44/44 and dimension-slot 29/29 and statistics 25/25 at v0.13.0 — the ENTIRE 117-row mutation-killed population): 9 collapses (every prototype's own history error, bit-exact — the class tie is the fixed point of per-error construction, nine for nine), 12 error-level kills (distinct faithful constructions, killed — the tie refines), 2 PROVEN equivalent mutants of TWO SPECIES (b30#0: representation-blindness — global phase unobservable at the density layer; b5#2: input-coverage blindness — the degenerate 0/0 branch lies outside the battery's input distribution, proven by a probability bound), 94 unbuildable (the defect's home is not a family member). The equivalent-mutant open problem (JIA11) is not solved — it is MEASURED on the workspace's entire mutation-killed history, and the decidable exchange is named: program equivalence is undecidable, battery-indistinguishability is decided bit-exactly.
- The tier assignment is judgment recorded as data; the appeal is editing the enrollment table — and E1-E6 hold the edit to the registry, the disk and the arithmetic. BOOKED-UNENFORCEABLE is the honest boundary: lines no machine can hold, each printed with its reason above — and since v0.10.0 each REASON is itself audited data (R-board): refuted rows upgrade on cited anchors, surviving rows name their ungated face, and the audit's judgment layer is the authors' — the machine holds coverage, vocabulary and citation, not the verdicts' wisdom. Visibility is the substitute for enforcement, and it is priced as such.
- 'World-class frontier' priced honestly: mutation testing (DEM78, JIA11) and property-based testing (CLA00) are the field's foundations, cited; per-error regression policy is folklore ('every bug gets a test'). The contribution claimed is the executable CLOSED LOOP — a machine-audited error registry imported live by the quality gate, so no error can be buried without a machine-checkable enforcement anchor — nothing grander.


## Closing

The visitor asked for all the errors given a world-class optimization. The optimization that survives pricing is not a faster kernel but a closed registry: every error ever buried is wired to the guard that kills it now — replayed as a mutant, anchored to a live gate, or booked on the visible boundary with its reason; the burial record is imported live on every run, so the loop cannot be reopened silently. The burial record was the memory of failure — this census is the immune system built from it, and the enrollment is the proof that nothing in that memory is inert. Survivors, when they appear, will be booked as blind spots on this page; that is the difference between quality theatre and a gate.
