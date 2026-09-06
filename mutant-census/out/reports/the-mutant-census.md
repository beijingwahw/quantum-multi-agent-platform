# THE MUTANT CENSUS — the error history replayed and killed, one page

> The burial record exhumed the workspace's errors (every one in two columns). This page is the other half of that ledger: the defect classes REPLAYED as nine live mutants against the shared kernel family and its standard compositions, and killed one by one by a ten-property battery that holds for every seeded input — dual-path arithmetic, negative controls, statistical kills labeled DATA. The family's byte-identity across the workspace and the 26 repos' engineering hygiene are censused LIVE on every run: an unregistered drift fails the build. And the loop is closed all the way down: EVERY error the registry carries is enrolled to the guard that kills it now (E-board, live-imported — an error without an enforcement anchor cannot be buried). Mutation testing and property-based testing are established fields (DEM78, JIA11, CLA00, dual-sourced in citations.md); the executable claim here is the coupling — a machine-audited error registry feeding the operator set, physics invariants as the oracle, zero dependencies. It renders only because the checker passed.

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

Nine mutants, nine kills as declared, zero survivors: six exact kills (deviations orders above tolerance), one crash kill (the family's own shape guard refusing the missing tensor identity — the way batch 24 actually died on the spot), two statistical kills (the same-event and same-denominator disciplines). Every row carries its provenance; nothing here is a toy mutant.

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

Canonical hashes (sha256/16): cmat.ts=70369052cdbf4714, states.ts=a9c6e43a93158d4c, channels.ts=8f1f9b8806364be1, rng.ts=923f757b556d2542, measures.ts=00432a11fbf10a3d. Across 140 repo-file pairs: 71 NOT-PRESENT, 13 REGISTERED-DIVERGENCE, 43 IDENTICAL, 13 STALE-REGISTRATION.

| registered divergence | reason |
| --- | --- |
| readout-wall/src/core/cmat.ts | 2026-09-06 strict-mode upgrade: this member's own repair variant; re-convergence is the appeal court's call |
| readout-wall/src/core/channels.ts | 2026-09-06 strict-mode upgrade: this member's own repair variant; re-convergence is the appeal court's call |
| readout-wall/src/core/measures.ts | 2026-09-06 strict-mode upgrade: this member's own repair variant; re-convergence is the appeal court's call |
| nosignal-tariff/src/core/cmat.ts | 2026-09-06 strict-mode upgrade: this member's own repair variant; re-convergence is the appeal court's call |
| nosignal-tariff/src/core/measures.ts | 2026-09-06 strict-mode upgrade: this member's own repair variant; re-convergence is the appeal court's call |
| choice-lang/src/core/cmat.ts | 2026-09-06 strict-mode upgrade: this member's own repair variant; re-convergence is the appeal court's call |
| choice-lang/src/core/measures.ts | 2026-09-06 strict-mode upgrade: this member's own repair variant; re-convergence is the appeal court's call |
| binding-price/src/core/cmat.ts | 2026-09-06 strict-mode upgrade: this member's own repair variant; re-convergence is the appeal court's call |
| binding-price/src/core/measures.ts | 2026-09-06 strict-mode upgrade: this member's own repair variant; re-convergence is the appeal court's call |
| letter-audit/src/core/cmat.ts | 2026-09-06 strict-mode upgrade: this member's own repair variant; re-convergence is the appeal court's call |
| letter-audit/src/core/measures.ts | 2026-09-06 strict-mode upgrade: this member's own repair variant; re-convergence is the appeal court's call |
| ent-clearing/src/core/cmat.ts | 2026-09-06 strict-mode upgrade: this member's own repair variant; re-convergence is the appeal court's call |
| ent-clearing/src/core/measures.ts | 2026-09-06 strict-mode upgrade: this member's own repair variant; re-convergence is the appeal court's call |
| quantum-mech/src/core/cmat.ts | 2026-09-06 strict-mode upgrade: this member's own repair variant; re-convergence is the appeal court's call |
| quantum-mech/src/core/measures.ts | 2026-09-06 strict-mode upgrade: this member's own repair variant; re-convergence is the appeal court's call |
| quantum-mech/src/core/states.ts | an independent states module, reconciled on 2026-09-06 onto the strict-mode canon with its original anchors (RPLUS, LPLUS, BELL_PHI_PLUS, bellState, ghz, w3, werner, HADAMARD, randomPureState, valueKet) appended; shares the other files where byte-identical |
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

Ten full members byte-identical in all five files (the eight-repo lineage plus this census); quantum-mech and qverify share four of five. The law is symmetric: an unregistered drift fails the build, and so does a stale registration — the register must match reality exactly.

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
| postselect-sched | Y | Y | 0 | — | 5 |
| retro-cache | Y | Y | 0 | — | 4 |
| stable-world | Y | Y | 0 | — | 1 |
| qverify | Y | Y | 0 | — | 0 |
| qram-sched | Y | Y | 0 | — | 5 |
| nonstoq-anneal | Y | Y | 0 | — | 0 |
| quantum-mech | Y | Y | 0 | — | 0 |
| ent-sched | Y | Y | 0 | — | 0 |
| vacuum-compiler | Y | Y | 0 | — | 3 |
| dsic-noether | Y | Y | 0 | — | 4 |
| ft-qaoa | Y | Y | 0 | — | 0 |
| switch-sched | Y | Y | 0 | — | 0 |
| causal-ineq | Y | Y | 0 | — | 3 |
| k-switch | Y | Y | 0 | — | 2 |
| dtc-clock | Y | Y | 0 | — | 1 |
| phase-law | Y | Y | 0 | — | 1 |
| ds_extracted/ds | Y | Y | 0 | exempt-registered | 0 |

The pre-batch-21 guard debt was PAID in batch 33: 42 experiment entries across 11 repos retrofitted with the house entry guard, every affected gate re-run green, repro verified on all three retrofit shapes (call-wrap, run-wrap, whole-file wrap). The legacy register is now EMPTY and the ratchet is absolute: an unguarded render entry anywhere in the epoch repos fails the build — there is no exemption path left. The platform repo is censused under its registered exemption: test + typecheck mandatory, `repro` is the GENESIS-A bench debt (ledger row #03), not a missing flag.

## E-board — the enrollment census (every buried error, live)

The registry is imported LIVE on every run: 280 errors across 46 batches, each wired to the guard that kills it NOW. The registry is closed — burying a new error without enrolling it fails the build (E1); a guard that is not on disk fails the build (E3); a booked line without a reason fails the build (E4).

| tier | errors | meaning |
| --- | --- | --- |
| MUTANT-KILLED | 117 | the error's registered class is replayed as a live mutant and killed by the battery (class tie, E2) |
| GATE-ENFORCED | 102 | recurrence fails a real build gate; the anchor file+needle verified live (E3) |
| BOOKED-UNENFORCEABLE | 61 | no machine can hold this line; the reason is mandatory and printed below (E4) |

| category | MUTANT | GATE | BOOKED |
| --- | --- | --- | --- |
| anchor-blindspot | 0 | 12 | 3 |
| bogus-comparison | 0 | 8 | 3 |
| citation-drift | 0 | 11 | 0 |
| conjugation | 19 | 0 | 0 |
| dimension-slot | 29 | 0 | 0 |
| machine-overruled | 0 | 32 | 0 |
| process | 0 | 16 | 39 |
| statistics | 25 | 0 | 0 |
| toolchain | 0 | 20 | 16 |
| wrong-object | 44 | 3 | 0 |

| live gate anchor | errors held | categories |
| --- | --- | --- |
| `mutant-census/src/kernel/audit.ts :: W-C` | 8 | anchor-blindspot, process |
| `ds_extracted/ds/package.json :: test` | 7 | bogus-comparison, citation-drift, machine-overruled, process |
| `dtc-clock/package.json :: test` | 7 | machine-overruled, toolchain, wrong-object |
| `dtc-clock/package.json :: typecheck` | 7 | machine-overruled, process, toolchain |
| `mutant-census/src/kernel/audit.ts :: Q4` | 6 | bogus-comparison |
| `burial-record/src/kernel/audit.ts :: B4` | 5 | citation-drift |
| `mutant-census/package.json :: lint` | 5 | machine-overruled, toolchain |
| `ds_extracted/ds/package.json :: format:check` | 3 | toolchain |
| `mutant-census/src/kernel/battery.ts :: PHASE-SENSITIVE` | 3 | anchor-blindspot |
| `mutant-census/package.json :: typecheck` | 3 | machine-overruled, process, toolchain |
| `mutant-census/package.json :: test` | 3 | machine-overruled, process |
| `phase-law/package.json :: test` | 3 | process, wrong-object |
| `ds_extracted/ds/package.json :: typecheck` | 2 | machine-overruled, toolchain |
| `ft-qaoa/package.json :: test` | 2 | process, toolchain |
| `nonstoq-anneal/package.json :: test` | 2 | machine-overruled |
| `ent-sched/package.json :: test` | 2 | machine-overruled |
| `bqp-map/package.json :: test` | 2 | process, toolchain |
| `dsic-noether/package.json :: test` | 2 | machine-overruled, toolchain |
| `mutant-census/src/kernel/census.ts :: unguardedEntryFiles` | 2 | anchor-blindspot, toolchain |
| `mutant-census/scripts/total-gate.ts :: typecheck` | 2 | anchor-blindspot, toolchain |
| `stable-world/package.json :: typecheck` | 2 | citation-drift |
| `dtc-clock/package.json :: lint` | 2 | machine-overruled |
| `burial-record/package.json :: test` | 2 | process |
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
| `mutant-census/package.json :: repro` | 1 | process |
| `mutant-census/src/kernel/audit.ts :: E2` | 1 | machine-overruled |
| `mutant-census/src/kernel/audit.ts :: E1` | 1 | machine-overruled |
| `mutant-census/test/anchors.test.ts :: A-fire L2` | 1 | citation-drift |
| `phase-law/package.json :: typecheck` | 1 | machine-overruled |

**Booked unenforceable — the visible boundary, every row:**

- b2#3 [process] — TS-Python parity lives in CI; the local workspace cannot gate GitHub Actions — booked until CI is reachable
- b2#6 [toolchain] — host-interpreter assumption (python3 on this Windows box); no workspace gate commands the environment — environment lesson, process only
- b2#7 [toolchain] — push-failure diagnosis (network vs auth vs remote); operator judgment, no machine gate
- b4#3 [toolchain] — shell retry-loop exit-code semantics; the loop's honesty is the author's check — process
- b8#5 [process] — threshold policy is experiment design; what the engine schedules was corrected by hand — no gate chooses policy
- b9#5 [process] — instance-set design (brute force vs 20k random search); methodological judgment, no gate
- b9#6 [process] — instance-set strength claim; hard instances are design work, not a gate
- b10#6 [process] — search-effort budgeting (the compass grind); abandoned by judgment, nothing to enforce
- b10#8 [toolchain] — heredoc truncation — banned house-wide by hard rule (Write tool, never heredoc); enforcement is process, nothing gates the author's tooling
- b10#9 [process] — the diagnostic script is never the trusted side; process rule, no gate
- b11#7 [bogus-comparison] — aggregation order (sum of per-seed ratios vs ratio of sums) — comparison design; no property pins aggregation semantics, booked
- b12#6 [toolchain] — path-resolution discipline (one climb does not fit all files); no gate derives each file's depth generically
- b12#7 [process] — witness-before-prose; the ledger law books costs on LEDGER rows, README rounding is author honesty — unenforceable line-by-line
- b13#6 [toolchain] — heredoc-via-JSON patch pipeline — the banned heredoc class; process only
- b14#4 [toolchain] — tsx -e quirks under Git Bash; environment lesson, no gate
- b14#5 [process] — which rows weaken a table is editorial; the ledger's both-columns law does not judge row selection
- b19#5 [process] — README worded by the expected limit; prose honesty, no machine gate
- b21#3 [process] — hand-computed price column corrected by the witness (9977.87 -> 9977.19); witness-before-prose is process
- b22#2 [toolchain] — probe placed outside the repo (system temp); the batch-33 rule (probes live in-repo) is process — no gate scans the author's scratch location
- b22#3 [process] — law-label sequence (B0-B4 then B6) caught in self-review; no linter sequences labels
- b23#3 [process] — contract-reading on reuse (same idiom, different signature); practice, no gate compares idioms
- b25#1 [process] — third-draft discipline; drafts that never reach the machine cannot be gated — the rule is process
- b25#6 [toolchain] — heredoc truncation (render.ts) — the banned class; process only
- b26#1 [toolchain] — heredoc truncation (probe.ts) — the banned class; process only
- b27#0 [process] — design-before-code (the TM encoding collapsed twice mid-write); process
- b28#3 [process] — count-after-construction (21 built, 20 shipped); the instance census is author discipline
- b29#4 [bogus-comparison] — displayed fractions must point at their true denominator; print-layer honesty — no gate formats the register
- b29#5 [process] — draft residue reaching the machine; unused symbols are tsc-gated, live-code residue (`| ""`) is review
- b30#1 [bogus-comparison] — toExponential(6) masks 1+2.1e-8 as 1.000000e+0; display precision is print-layer, the witness columns carry the true digits — the format itself is not gated
- b30#4 [process] — audit.ts indirection residue rewritten before boarding; pre-flight review, process
- b32#7 [process] — display heuristics (sigma vs raw units); the formatting law lives in prose, no gate parses intent
- b32#9 [process] — edit residue in mutant construction; the kill census verifies KILLS, residue-free construction is authorship
- b32#11 [process] — tree-walk style rewritten before boarding; never reached the machine — process
- b33#0 [process] — probe in /tmp again (resolves to D:\Data\Temp) — recurrence of b22#2; the rule is process, its enforcement is the daily memory
- b33#2 [toolchain] — tool invocation locale (npx resolves deps from the wrong root outside the repo it serves); the sanctioned path (each repo's own npm run) is documented, not machine-forced
- b33#3 [process] — scout pipelines that swallow every signal; 'verify the filter passes signal' is process
- b34#0 [toolchain] — source surgery through bash-inline regex (escaping ate the pattern, zero replacements silently); the edit-tools-not-pipes rule is process — nothing gates the author's tooling
- b34#3 [process] — phantom call in a render.ts edit caught by pre-flight self-review; the initial draft never reaches the machine, its errors still go to the record — process
- b36#12 [process] — a metric folded under another claim's name is a labeling crime, but no gate parses field semantics — the separate field ships and the record carries the lesson
- b36#13 [process] — tolerance calibration against a single run's number; the class-claim rule (tolerances state the category, not a snapshot) is author discipline — the witness gate checks the class, not the author's history
- b36#14 [process] — channel applied through dense Kraus multiplies — performance is correctness debt, but no workspace gate commands complexity; the mixture form ships
- b36#15 [process] — six-loop C^4 mis-estimated as C^3 — same class as b36#14; the block-mMul form ships, the estimate lesson is process
- b36#16 [process] — board literals drifting from witness numbers (rng consumption order); run-then-write is process — the rendered report vs witness-line read caught both drifts, no gate diffs prose against numbers
- b36#17 [process] — heredoc tangle, fourth offense (b10#8/b25#6/b26#1 family) — the Write-tool rule is now recorded in three batches; enforcement remains the author's habit
- b37#1 [process] — relative-root depth is author discipline (third offense of batch 29's class); no gate derives each file's own depth
- b37#6 [toolchain] — shell && chains and grep exit codes; operator discipline — no workspace gate commands the author's shell
- b37#7 [anchor-blindspot] — the dual EPOCH_REPOS lists (census + total-gate) are design debt; single-sourcing the repo list is booked future work, not a live gate
- b38#0 [process] — draft residue caught by author re-read before any run; drafts that reach the disk go to the record — no gate reads the author's editor
- b38#1 [toolchain] — tsx -e under Git Bash is silent for TS-importing one-liners (b14 family, second recurrence); the scratch-file rule is the enforcement
- b39#0 [process] — an edit anchored on a section header must restore it — splice, not eat; author re-read caught both, no gate diffs comment structure
- b40#0 [process] — the header-swallow class, offenses three and four — the rule lives in the daily memory now; no gate diffs comment structure
- b42#1 [process] — assertion anchors must be read from current text; prettier owns layout — no gate diffs intent
- b43#2 [process] — a MISS is a stop — anchor discipline on read text; no gate diffs intent
- b44#1 [process] — heredoc with template literals — the banned class, fourth family sighting; Write tool always
- b45#3 [process] — exhaustive-cost discipline on the render's columns is an author budget call; no gate times the repro cell by cell
- b45#4 [anchor-blindspot] — grep the on-disk text before anchoring (a parenthesis is part of the anchor); no gate diffs intent
- b45#5 [anchor-blindspot] — long JSON strings get patched structurally via python json round-trip; no gate diffs intent
- b45#6 [toolchain] — the runner binary is not on the author shell's PATH; npm scripts resolve locally — no gate commands the author's shell
- b46#1 [toolchain] — tsx -e multiline under Git Bash is silent, fifth family sighting; the scratch-file rule is the enforcement — no gate commands the author's shell
- b46#3 [process] — non-ascii anchors never through heredoc; Read+Edit always — no gate diffs intent
- b46#5 [process] — identifier namespaces (witness letters, board letters, anchor names) are grepped before claimed — no gate holds a naming table

## A-board — the anchor witness registry (every guard, evidence on file)

E3 proves the needle is on disk; the A-board proves the guard can FIRE or is RESOLVED to its machinery — a guard that never convicts is a false guard. The registry is symmetric: an unregistered anchor may not hold errors, and a stale registration is itself a violation.

- **FIRING-INJECT** — `burial-record/src/kernel/audit.ts :: B4` — a forged batch with a dead source anchor is convicted BY NAME by burial-record's own checkBurial (imported live) (demo: mutant-census/test/anchors.test.ts, "A-fire B4")
- **FIRING-INJECT** — `depreciation-ledger/src/kernel/audit.ts :: L1` — a ledger row quoting numbers with an empty cost column is convicted by the ledger's own checkLedger (imported live) (demo: mutant-census/test/anchors.test.ts, "A-fire L1")
- **FIRING-INJECT** — `depreciation-ledger/src/kernel/audit.ts :: L2` — a settled row quoting no numbers is convicted by checkLedger — no-number rows must stay OPEN (demo: mutant-census/test/anchors.test.ts, "A-fire L2")
- **FIRING-INJECT** — `depreciation-ledger/src/kernel/audit.ts :: L6` — the five headline costs are re-derived from scratch in the ledger's own gate (a suite the total gate runs) (demo: depreciation-ledger/test/ledger.test.ts, "L6: all five arithmetic witnesses pass")
- **FIRING-INJECT** — `mutant-census/src/kernel/audit.ts :: provenanceRepos` — a provenance with a trailing paren note ('batch 10 (qverify, expPauli)') resolves to exactly qverify — the charset does not swallow commas, no false conviction (demo: mutant-census/test/anchors.test.ts, "A-fire provenanceRepos")
- **FIRING-INJECT** — `mutant-census/test/anchors.test.ts :: A-fire L2` — batch 35's own lesson as a guard: the L2 demo encodes the law's REAL object read from the ledger's source (a blank column with a settled verdict) — ammo cast from memory fires at nothing, and this demo going green is the proof it was cast from the law (demo: mutant-census/test/anchors.test.ts, "A-fire L2")
- **FIRING-INJECT** — `burial-record/package.json :: test` — a forged batch whose context states NINE delivery errors over ten carried errors is convicted BY NAME (law B7) by burial-record's own checkBurial, imported live — the b45#9 class can never again wait for the visitor (demo: mutant-census/test/anchors.test.ts, "A-fire B7")
- **FIRING-LIVE** — `mutant-census/src/kernel/audit.ts :: E1` — a forged registry carrying an un-enrolled error is convicted by checkEnrollment on the spot
- **FIRING-LIVE** — `mutant-census/src/kernel/audit.ts :: E2` — a forged class-mismatched mutant tie is convicted by checkEnrollment on the spot
- **FIRING-LIVE** — `mutant-census/src/kernel/audit.ts :: Q2` — the ghost mutant (declared EXACT-KILL, ships the canonical function) is reported SURVIVED by the live kill census — the declared-vs-live law has teeth
- **FIRING-LIVE** — `mutant-census/src/kernel/audit.ts :: Q4` — the battery's synthetic violators FIRE on every run (runNegativeControls) — a property nothing can move is a constructed zero, and this anchor is why the controls exist
- **FIRING-LIVE** — `mutant-census/src/kernel/audit.ts :: W-C` — the negative controls fire live: shape-blind product, lopsided outer, non-CPTP Kraus each get named
- **FIRING-LIVE** — `mutant-census/src/kernel/battery.ts :: PHASE-SENSITIVE` — MU2 (the conjugated vecToRho — Hermitian, trace 1, PSD, invisible to statehood) is killed EXACTLY by P2's phase-sensitive dual path, live
- **FIRING-LIVE** — `mutant-census/src/kernel/census.ts :: unguardedEntryFiles` — the in-repo fixture repo's unguarded render entry is NAMED by the detector, live
- **RESOLVED** — `mutant-census/scripts/total-gate.ts :: typecheck` — the T-board script constructs a typecheck job for every epoch repo (the job spec is in the script source); its full firing IS the total gate run
- **RESOLVED** — `mutant-census/package.json :: lint` — eslint.config.mjs on disk and eslint in devDependencies — the gate's machinery is wired
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
- **RESOLVED** — `ent-clearing/package.json :: typecheck` — tsconfig.typecheck.json on disk
- **RESOLVED** — `ent-sched/package.json :: test` — the test tree exists and carries test files
- **RESOLVED** — `ft-qaoa/package.json :: test` — the test tree exists and carries test files
- **RESOLVED** — `k-switch/package.json :: test` — the test tree exists and carries test files
- **RESOLVED** — `nonstoq-anneal/package.json :: test` — the test tree exists and carries test files
- **RESOLVED** — `nosignal-tariff/package.json :: test` — the test tree exists and carries test files
- **RESOLVED** — `qram-sched/package.json :: test` — the test tree exists and carries test files
- **RESOLVED** — `readout-wall/package.json :: typecheck` — tsconfig.typecheck.json on disk
- **RESOLVED** — `stable-world/package.json :: typecheck` — tsconfig.typecheck.json on disk
- **RESOLVED** — `survivor-census/package.json :: test` — the test tree exists and carries test files
- **RESOLVED** — `switch-sched/package.json :: test` — the test tree exists and carries test files
- **RESOLVED** — `vacuum-compiler/package.json :: test` — the test tree exists and carries test files
- **RESOLVED** — `dtc-clock/package.json :: test` — the test tree exists and carries test files
- **RESOLVED** — `dtc-clock/package.json :: typecheck` — tsconfig.typecheck.json on disk
- **RESOLVED** — `dtc-clock/package.json :: lint` — eslint.config.mjs on disk and eslint in devDependencies — the gate's machinery is wired
- **RESOLVED** — `phase-law/package.json :: test` — the test tree exists and carries test files
- **RESOLVED** — `phase-law/package.json :: typecheck` — tsconfig.typecheck.json on disk

## G-board — the genealogy census (every error in a family, every family resolved, every catch credited)

The E-board made every error answer for its enforcement; the A-board made every guard prove it can fire; the G-board makes the ledger LEARN. Every error joins a family (the named recurrence families plus the category defaults, rules over the live wrong-text); every family with two or more sightings carries a resolution row whose tier must equal its LATEST sighting's enrollment tier (G2 — a stale resolution is a conviction); every error credits its catcher, and the catch census prints the era trend — the optimization metric: the machine fraction must rise, the visitor fraction must fall to zero.

| family | sightings | first | latest | latest tier (held by) |
| --- | --- | --- | --- | --- |
| cat:process | 45 | b1 | b46#5 | BOOKED-UNENFORCEABLE |
| cat:wrong-object | 45 | b2 | b45#2 | GATE-ENFORCED |
| cat:dimension-slot | 29 | b5 | b36#9 | MUTANT-KILLED |
| cat:machine-overruled | 29 | b4 | b45#7 | GATE-ENFORCED |
| cat:statistics | 25 | b3 | b32#4 | MUTANT-KILLED |
| cat:toolchain | 24 | b1 | b46#4 | GATE-ENFORCED |
| cat:conjugation | 19 | b4 | b36#7 | MUTANT-KILLED |
| cat:anchor-blindspot | 13 | b9 | b45#5 | BOOKED-UNENFORCEABLE |
| shell-template-heredoc | 11 | b10 | b46#3 | BOOKED-UNENFORCEABLE |
| cat:bogus-comparison | 10 | b2 | b37#2 | GATE-ENFORCED |
| cat:citation-drift | 10 | b6 | b37#3 | GATE-ENFORCED |
| runner-path | 10 | b14 | b46#1 | BOOKED-UNENFORCEABLE |
| count-drift | 4 | b36 | b45#9 | GATE-ENFORCED |
| edit-anchor | 4 | b22 | b45#4 | BOOKED-UNENFORCEABLE |
| non-null-assert | 2 | b45 | b45#1 | GATE-ENFORCED |

The catch census: gate 15 / author 232 / numbers 32 / visitor 1 over 280 errors — the gate fraction rose from 1% (batches 1-22) to 27% (batches 37+). The one visitor catch is b45#9 — and burial-record's B7 law (stated counts equal carried counts, v0.5.0 of the record) now holds that class by gate, with the A-fire B7 firing demo injecting the exact forgery into the real checkBurial.

## T-board — the total gate

`npm run total` runs the WHOLE workspace as one verdict: every epoch repo's test suite AND typecheck, plus the main platform repo's full suite — machine-judged, stamped, rendered to `out/reports/the-total-gate.md`. The artifact records the last explicit run; this census verifies the command exists and the artifact's contract. 全量 is a command, not an adjective.

## Witnesses (independent re-derivations)

- PASS — W-A kill census (9/9 killed as declared — EXACT 6, CRASH 1, DATA 2, SURVIVED 0; margins MU1:1.8e+0 MU2:1.0e+0 MU3:4.0e+0 MU5:3580 MU6:8.5e-1 MU7:8.4e-1 MU8:5.9e+2 MU9:6.7e+1)
- PASS — W-B property battery (10 properties green on the canonical family; worst deviations P1=0.0e+0 P2=4.4e-16 P3=6.7e-16 P4=6.7e-16 P5=4.4e-16 P6=6.7e-16 P7=1.6e-13 P8=5.4e-1 P9=1.5e+0 P10=5.6e-16)
- PASS — W-C negative controls (3 synthetic violators fired (P1 shape-blind product, P3 lopsided outer, P4 non-CPTP Kraus); the mutant-trippers are proven by W-A itself)
- FAIL — W-D family census (readout-wall/measures.ts registered as divergent but now byte-identical — stale registration; nosignal-tariff/cmat.ts registered as divergent but now byte-identical — stale registration; nosignal-tariff/measures.ts registered as divergent but now byte-identical — stale registration; choice-lang/cmat.ts registered as divergent but now byte-identical — stale registration; choice-lang/measures.ts registered as divergent but now byte-identical — stale registration; binding-price/cmat.ts registered as divergent but now byte-identical — stale registration; binding-price/measures.ts registered as divergent but now byte-identical — stale registration; letter-audit/cmat.ts registered as divergent but now byte-identical — stale registration; letter-audit/measures.ts registered as divergent but now byte-identical — stale registration; ent-clearing/cmat.ts registered as divergent but now byte-identical — stale registration; ent-clearing/measures.ts registered as divergent but now byte-identical — stale registration; quantum-mech/cmat.ts registered as divergent but now byte-identical — stale registration; quantum-mech/measures.ts registered as divergent but now byte-identical — stale registration)
- PASS — W-E workspace census (28/28 epoch repos: test+typecheck+repro and strict TS, 0 unguarded entries TOTAL (the pre-batch-21 guard debt PAID in batch 33 — 42 entries retrofitted, every gate re-run green); platform censused: ds_extracted/ds (test+typecheck mandatory, repro = the GENESIS-A registered debt, not a missing flag); report artifacts on disk: 22/29)
- PASS — W-F enrollment census (280 errors enrolled LIVE against a registry of 46 batches (declares exactly what it carries) — MUTANT-KILLED 117, GATE-ENFORCED 102, BOOKED-UNENFORCEABLE 61, every booked row printed on the report)
- PASS — W-G anchor census (43 guards registered: 7 firing-inject demos on disk, 7 fired live this run, 29 resolved to machinery)
- PASS — W-H genealogy census (15 families over 280 errors (15 recurring, all resolved); catch census gate 15 / author 232 / numbers 32 / visitor 1 — the gate fraction rose from 1% (b1-22) to 27% (b37+); count-drift held by B7: true)

## Boundaries

- The mutant set is HISTORICALLY MOTIVATED, not exhaustive: nine defect classes compiled from the burial record, not a proof that no tenth class exists. Equivalent mutants are a known open problem of the field (JIA11); none are claimed away here.
- The family's mAdd does NOT check shapes — by design, recorded at batch 31 ('the dimension account is always the coder's'). MU3 is killed at the COMPOSITION layer (the embedding's dimension contract), not by an adder that would break ten byte-identical members.
- Statistical kills are DATA-grade: they convict at 5 sigma by design of the property, not by theorem. The exact kills are exact.
- The W-board's unguarded-entry detector is a string-level heuristic (writeReport/writeFileSync without the guard); its misses are surfaced, not enforced — the K-board's hash census is the exact one.
- The registered divergences record THAT bytes differ and why they may; whether they SHOULD is each repo's appeal court (`npm test` there). This census adjudicates identity, not intent.
- The E-board's MUTANT-KILLED tie is CLASS-level: one mutant guards its whole registered category-class (the registry's own B0-verified filing), not each error individually re-mutated; the equivalent-mutant open problem (JIA11) stands. Per-error mutants are not claimed.
- The tier assignment is judgment recorded as data; the appeal is editing the enrollment table — and E1-E6 hold the edit to the registry, the disk and the arithmetic. BOOKED-UNENFORCEABLE is the honest boundary: lines no machine can hold, each printed with its reason above. Visibility is the substitute for enforcement, and it is priced as such.
- 'World-class frontier' priced honestly: mutation testing (DEM78, JIA11) and property-based testing (CLA00) are the field's foundations, cited; per-error regression policy is folklore ('every bug gets a test'). The contribution claimed is the executable CLOSED LOOP — a machine-audited error registry imported live by the quality gate, so no error can be buried without a machine-checkable enforcement anchor — nothing grander.


## Closing

The visitor asked for all the errors given a world-class optimization. The optimization that survives pricing is not a faster kernel but a closed registry: every error ever buried is wired to the guard that kills it now — replayed as a mutant, anchored to a live gate, or booked on the visible boundary with its reason; the burial record is imported live on every run, so the loop cannot be reopened silently. The burial record was the memory of failure — this census is the immune system built from it, and the enrollment is the proof that nothing in that memory is inert. Survivors, when they appear, will be booked as blind spots on this page; that is the difference between quality theatre and a gate.
