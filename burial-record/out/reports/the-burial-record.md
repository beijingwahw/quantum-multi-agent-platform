# THE BURIAL RECORD — the capsule's true contents, exhumed and audited

> The letter says the real time capsule is the burial record: the error logs. This page renders it as a registry — every batch anchored to the repo it happened in and the memory file that records it, every error in two columns (wrong | right). It is only rendered because the checker passed: a vanished repo, a one-column error, a gap in the numbering, or a dead source anchor all fail the build.

## Census

- batches: 45
- errors: 274
- repos involved: 29
- categories in use: 10/10

| repo | batches | errors |
| --- | --- | --- |
| dtc-clock | 5 | 41 |
| mutant-census | 4 | 30 |
| nonstoq-anneal | 4 | 22 |
| ds_extracted/ds | 3 | 21 |
| bqp-map | 2 | 14 |
| qverify | 1 | 10 |
| qram-sched | 1 | 9 |
| quantum-mech | 1 | 8 |
| switch-sched | 1 | 8 |
| nosignal-tariff | 1 | 8 |
| stable-world | 1 | 8 |
| phase-law | 4 | 8 |
| ent-sched | 1 | 7 |
| vacuum-compiler | 1 | 7 |
| dsic-noether | 1 | 7 |
| choice-lang | 1 | 7 |
| causal-ineq | 1 | 6 |
| postselect-sched | 1 | 6 |
| survivor-census | 1 | 6 |
| ent-clearing | 1 | 6 |
| ft-qaoa | 1 | 5 |
| retro-cache | 1 | 5 |
| k-switch | 1 | 4 |
| route-price | 1 | 4 |
| burial-record | 1 | 4 |
| readout-wall | 1 | 4 |
| wukong-crossval | 1 | 4 |
| letter-audit | 1 | 3 |
| binding-price | 1 | 2 |

| category | errors |
| --- | --- |
| process | 51 |
| wrong-object | 47 |
| toolchain | 34 |
| machine-overruled | 32 |
| dimension-slot | 29 |
| statistics | 25 |
| conjugation | 19 |
| anchor-blindspot | 15 |
| bogus-comparison | 11 |
| citation-drift | 11 |

## The batches

### Batch 1 — ds_extracted/ds (2026-09-05)

- context: platform audit repair (P0x1 / P1x15 + antipattern clusters, ~60 items)
- source: `memory/2026-09-05.md` @ "审计修复 + 推送"

| wrong (as it stood) | right (as recorded) | category |
| --- | --- | --- |
| moduleResolution node10 is fine: extensionless relative imports compile, so dist will load | tsc emits them verbatim and Node ESM cannot load dist — NodeNext + explicit .js suffixes on 141 imports; a dist smoke step in CI catches it (audit item I6's prediction came true) | toolchain |
| tests that lock in audited-defective semantics (precheck-reject = failed+throw; cancelled counted as failed) must be preserved as-is | update the assertion together with the semantics and note the change — never route around the test | process |
| a synchronous API can be de-blocked in place with Atomics.wait | the sync signature admits only a hard total-budget ceiling + contract doc; the real fix (async) is a breaking change deferred to Wave 4 | process |
| callers always pass coupling keys as (q1<q2); the reversed order can be ignored | q1>q2 order silently dropped the coupling — normalize the key at the boundary and both the drop and the doubt die together | process |
| deferred audit items (fitGrid refit, global seed, Date DTO) are loose ends to forget | defer deliberately and record why: the refit needs benchmark evidence, the global seed breaks the reproducibility contract | process |

### Batch 2 — ds_extracted/ds (2026-09-05)

- context: P2/P3 second-round closure (commits 96c377e + 9c821aa)
- source: `memory/2026-09-05.md` @ "关键经验（第二轮）"

| wrong (as it stood) | right (as recorded) | category |
| --- | --- | --- |
| verify an expm1 refactor by continuity across beta | assert against the analytic truth K = -ln(1-d(1+(1-a)/a)/(1-q0))/beta — K is proportional to 1/beta and discontinuous to begin with | bogus-comparison |
| silently ignore demand classes the scheduler cannot implement | declare the four classes at type level, implement one, reject the rest at entry — unimplementable hard constraints fail loudly | process |
| Promise.race cancels the runaway command | race only drops the result; the abort must pierce executor -> AbortController -> argv signal -> process tree (60s sleeper reaped in 415ms) | wrong-object |
| TS-Python parity requires running both toolchains in CI | embed shared SELF_CHECK vectors in both artifacts: the Python runtime asserts at run time, the CI test reads them back — drift turns both sides red | process |
| pass {signal: undefined} into an optional {signal?:} | exactOptionalPropertyTypes forbids explicit undefined — construct by conditional key spread | toolchain |
| hand-edited code survives prettier and lint as written | run format after batch edits; prefer-for-of false positives on genuinely hot loops get a disable comment with rationale | toolchain |
| python3 is the Python on this Windows box | python3 is the WindowsApps stub; python is the real interpreter | toolchain |
| a failed push means the network | two distinct forms: 443 timeout (retry 2-3x, 20s apart) and non-fast-forward (fetch + rebase) | toolchain |

### Batch 3 — ft-qaoa (2026-09-05)

- context: logical-layer p=128 QAOA: monotonicity + resource estimator + decode scheduler
- source: `memory/2026-09-05.md` @ "关键经验（第三批）"

| wrong (as it stood) | right (as recorded) | category |
| --- | --- | --- |
| golden-section search finds the global optimum of the ramp-T objective | the landscape oscillates — pure golden section locked 4/7 instances at <C> ~ 0; coarse log-grid global scan first, then local refine | wrong-object |
| single-level T-distillation (eps_T=1e-8) suffices for deep circuits | its floor of 3.2e-6 x T-gates fails every deep budget (the all-FAIL table); two-level 1e-12 is the first meaningful point — a route conclusion, written into theory | process |
| exactOptionalPropertyTypes bites rarely | third bite in this workspace: optional properties cannot carry explicit undefined — conditional spread | toolchain |
| -x ** 2 parses as -(x^2) | unary minus may not neighbor ** in JS — write -(x**2); esbuild's 'Unexpected **' is the symptom | toolchain |
| p=0 gives <C> exactly 0 | it is ~1e-17 — (1/sqrt(dim))^2 binary rounding; assert with 1e-12 tolerance | statistics |

### Batch 4 — nonstoq-anneal (2026-09-05)

- context: X-basis diagonal engine + stoquasticity verifier + imaginary-time projection
- source: `memory/2026-09-05.md` @ "关键经验（第四批）"

| wrong (as it stood) | right (as recorded) | category |
| --- | --- | --- |
| put the maximize-convention Ising objective straight into the Hamiltonian | adiabatic following tracks the LOWEST eigenvalue: H_P := -C must be declared explicitly (measured r -> -1 before the fix) | conjugation |
| imaginary-time projection from |+>^n reaches the ground state | |+>^n is a single point in the X basis and can have ZERO overlap with the target space (the k>2*Gamma XX driver is exactly that) — start from a seeded generic real vector; fix a global sign convention before measuring sign purity | wrong-object |
| the annealer can always prepare |+>^n as the driver state | for k>2*Gamma the driver's own ground state differs from |+>^n — the engine must offer driver-ground initialization | machine-overruled |
| a push retry loop (for do push && break || sleep; done) reports failure | it returns exit code 0 after three failures — judge pushes by git status -sb, never by exit code | toolchain |
| prettier format:check piped through tail propagates failure | the pipe eats the non-zero exit — run it standalone before committing | toolchain |

### Batch 5 — nonstoq-anneal (2026-09-05)

- context: SSE worldline sampler + direct <sign> measurement (gap 1)
- source: `memory/2026-09-05.md` @ "关键经验（第五批"

| wrong (as it stood) | right (as recorded) | category |
| --- | --- | --- |
| SSE stationary weights need no slot combinatorics | the same ordered sequence occupies C(M,n) slots — the weight must carry 1/C(M,n); omitting it biased <n> sixfold (<n>-vs-exact is the bisection locator: offset -> diagonal update, sign-only offset -> type move) | statistics |
| single-edge string flips move between N_xx sectors | they preserve GF(2) parity — cross-sector moves need the edge + two-sites triple flip, and odd-key strings of the flip involution are rejected outright (the initial-state flip cannot save a closure) | dimension-slot |
| accept 0/0 as infinity when the old weight vanishes | unconditional acceptance admits closure-breaking configurations with wOld=0 — require wNew>0 | statistics |
| rollback with the inverted ternary is harmless | the flip map is an involution; the wrong ternary silently rewrites key 2b+2 as 2b+3 — an ADJACENT key | dimension-slot |
| square the matrix and take the trace for Trotter Z | normalize per level and accumulate in log scale; remember the dtau(1-s) driver factor — missing it cost four orders of magnitude | statistics |
| a fixed block width gives honest MC error bars | sector autocorrelation outlasts any fixed width — adaptive block width + multi-seed spread; and judge tests must pick fast-mixing points (slow-mixing deviation is physics, not bug) | statistics |

### Batch 6 — nonstoq-anneal (2026-09-05)

- context: catalyst testbed + matrix-free Lanczos spectrometer (gap 3)
- source: `memory/2026-09-05.md` @ "关键经验（第六批"

| wrong (as it stood) | right (as recorded) | category |
| --- | --- | --- |
| reproduce a paper from memory of its equations | three memory deviations (p=3 is the paper's own counterexample; the XX coefficient sits on the s side; the path is two-parameter) derailed two exploratory implementations — fetching the original ended the guessing in 30 seconds | citation-drift |
| a fixed s-grid resolves the first-order avoided crossing | the valley's width is ~ the gap itself — coarse scan then local golden section, or the grid steps over the valley wholesale | wrong-object |
| Lanczos lambda_1 is 'the first excited level' | single-vector Krylov contributes one direction per eigenspace: lambda_1 is the first level OUTSIDE the manifold — exactly the annealing-gap semantics; judges compare against the degeneracy-resolved dense spectrum | wrong-object |
| full-space Lanczos converges at k = dim - 1 | T must be full rank k = dim for machine-precision exactness | dimension-slot |
| N*m_x^2 for the fully-connected XX term is normalization-free | N*m_x^2 = (2/n) * sum_{i<j} x_i x_j + 1 — the per-pair coupling scales with n | dimension-slot |
| a negative operational result is a failure to hide | negative results are deliverables when falsifiable, judged, and attributed (catalyst success 0.24-0.53x baseline across variants, reported as-is) | process |

### Batch 7 — nonstoq-anneal (2026-09-05)

- context: DMRG scaling + de-signing theorem + hardware profile (gaps 2/4/5)
- source: `memory/2026-09-05.md` @ "关键经验（第七批"

| wrong (as it stood) | right (as recorded) | category |
| --- | --- | --- |
| MPO key-completion terms live at station i | the (1->3) completion belongs at station i+1 — alpha-through-ZZ-all-zero located it in seconds; per-term micro-judges (n=1, n=2 single-term energies) are the fastest locator | dimension-slot |
| absorb environments with = | the four w-channels overwrite each other and the contraction collapses to identically 0 — accumulation must be += | dimension-slot |
| naive nested contraction with in/out spins as they come | the four-step matvec (right env -> W2 -> W1 -> left env) is 100x faster; q.s is the input and q.sp the output — do not swap them | dimension-slot |
| Perron-Frobenius means 'all amplitudes non-negative' | DMRG's global sign is arbitrary — the test is 'sampled amplitudes single-sign' | wrong-object |
| my de-signing analysis: X and XX are gauge-invariant, odd cycles are the obstruction | sz sx sz = -sx: the gauge maps X -> eX and XX -> eeXX — ANY k>0 XX edge makes the sign irreducible (sharper than 'odd cycles'); the dense-matrix judge vetoed two versions of my own test expectations and the final theorem is stronger than the initial claim | machine-overruled |

### Batch 8 — ent-sched (2026-09-05)

- context: entanglement distribution scheduling: round engine + ERS strategy
- source: `memory/2026-09-05.md` @ "关键经验（第八批"

| wrong (as it stood) | right (as recorded) | category |
| --- | --- | --- |
| purify the raw BBPSSW output directly | one purification round leaves a non-Werner state (error concentrated in the Z sector) — measured F regressed 0.884 -> 0.850 until twirling every round; and twirl-fixing Phi+ holds only for real rotations (complex ones need the Pauli frame: 'the S3 label permutation fixing Phi+' is a composite action, not the rotation group) | wrong-object |
| <H(x)H, Ry(pi/2)(x)Ry(pi/2)> should be a decent twirling group | it fixes Psi- and is non-transitive; adding K=SH goes dense beyond cap — the judge's twirl is the Bell-basis six-permutation average | machine-overruled |
| dedupe group elements by normalizing the first entry of a | normalize by the complex ratio b0/a0 — otherwise e^{i*theta}I tests unequal to I and the closure never closes | conjugation |
| purification ladder economics is monotone in effort | three machine-found laws: the mixed-purification fixed point (F0=0.85 caps ~0.909); champion grazing needs a MIN_GAIN threshold + bottom-up fHi fusion; champion + 2 working slots is the minimal 2^k ladder (3 slots saturate) | machine-overruled |
| greedy interval tiling in id order | short segments grab by id and evict the only long cover — interval exact-cover DP; non-adjacent cascade joints merge in the same round | wrong-object |
| sub-threshold full pairs are the engine's business | deliver-or-hold is a POLICY decision; asap's zero delivery is the post-warmup steady state of the frozen deadlock — read the attempts counter to see it | process |
| the key-rate collapse sits at n/p vs T2 | it sits at tiling-wait x T2 decay — the phase diagram's true collapse locus | wrong-object |

### Batch 9 — quantum-mech (2026-09-05)

- context: quantum mechanism design: DSIC conservation + privacy + entangled collateral
- source: `memory/2026-09-05.md` @ "关键经验（第九批"

| wrong (as it stood) | right (as recorded) | category |
| --- | --- | --- |
| Im(v v+) with the conjugate on the left factor | v_i * conj(v_j) has imaginary part b*c - a*d; inverted, EVERY real-vector anchor is immune — complex anchors (random complex pure-state rebuild judge) must be in place from the first batch | anchor-blindspot |
| hand-track Jacobi rotation handedness through the accumulation | values come from the Jacobi diagonal (always right); vectors from block inverse iteration + cluster-block orthogonalization + a rebuild judge — convention-free by construction | conjugation |
| inverse-iteration shift eps = gap/2 splits the clusters | the midpoint amplifies both clusters equally (measured 2 vs 2, no convergence) — eps must be far below gap (gap/16, 12 iterations) | statistics |
| partial-trace strides from the input space | kept/measured strides must be recomputed in the OUTPUT space — input strides silently transpose (the W-state reduction wrote |01> into |10>; GHZ/Bell all-diagonal, immune) | anchor-blindspot |
| detection rate is detection rate | per-bid vs per-bit counting, qubits-per-run = bidders x m, k=min(2^m,4) dilutes flips with payload-free high bits — the '0.167 bug' was bookkeeping | statistics |
| search 20k random states for the 1/sqrt(2) double-mortgage ceiling | random search reached 0.658; the analytic balanced family touches exactly 1/sqrt(2) at x=1/2 — constructive families before random search | process |
| any tight instance set demonstrates first-price underbidding | the demo needs slot-0 + a strict price gap (ties-to-low-index lose slot-1) — 'mathematically fine but demonstration-powerless' sets get rebuilt | process |
| Bell fidelity and concurrence tell one story at the optimum | GHZ attains double-mortgage Bell fidelity (1/2, 1/2); the concurrence-balanced family (x=1/2) has LOWER fidelity there — two metrics, two optima, two stories | wrong-object |

### Batch 10 — qverify (2026-09-05)

- context: delegated-computation quantum self-verification: blindness + traps + rigidity
- source: `memory/2026-09-05.md` @ "关键经验（第十批"

| wrong (as it stood) | right (as recorded) | category |
| --- | --- | --- |
| <+theta|Y|+theta> = 0 | it is ±sin(theta) — the sign error produced a fake 'Y component 100% detectable' formula that self-consisted on X/Z anchors; random-channel cross-examination killed it, and the trap acceptance corrected to a constant 5/6 (cleaner than the fake theta-dependence) | anchor-blindspot |
| k=1 anchors vet the Kraus expansion | the divisor over-counted kraus: k=1 is immune (divide by 1), k=4 random channels exposed a 4x deviation — multi-Kraus batteries or nothing | anchor-blindspot |
| measure in the Y basis by applying U | the measurement rotation is R = U-dagger; H is self-adjoint so X/Z all passed while every complex basis was wrong — real anchors are immune to conjugate-side bugs (batch 9 recurring; the complex-phase makeTarget caught it) | anchor-blindspot |
| CZ rho CZ flips both quadrants touching 11 | it flips 'exactly ONE side in the 11 quadrant' ((3,3) is (+1)(-1)(-1)); forward and mirror errors cancelled at lambda=0 — depolarizing admixture exposed it (theory 0.925 vs measured 0.9108); symmetric-masking bugs demand asymmetric-path tests | anchor-blindspot |
| (1,0) of -i(xX + yY + zZ) equals conj of (0,1) | it is y - ix — write closed-form matrices element by element; 'symmetry' is not a derivation | conjugation |
| projected gradient descent terminates on the sphere | project-back each step always micro-improves -> 14s infinite loops; sweep cap + stagnation counter | statistics |
| grind the compass search until the symmetric double cloner is found | the A/B budget interlock fails Cauchy-Schwarz twice — stop-loss: the exact contraction channel {sqrt(3/4) I, sqrt(1/12) sigma} + Stinespring complement replaces the construction; the BH double cloner demotes to a cited boundary | process |
| Werner and isotropic states under I/4 mixing behave alike | PPT thresholds 1/3 vs 1/2; T = F*diag gives S = 2*sqrt(2)*F cleanly — align conventions with the literature before writing anchors | conjugation |
| hand-written markdown templates through python heredocs | backticks and unicode break — Edit tool or single-line replace | toolchain |
| the diagnostic script is the trusted side | my hand-computed CZ flipped rows only — the 'theory' was the bug; verify the hand-calculation path itself before cross-examining the machine | process |

### Batch 11 — qram-sched (2026-09-05)

- context: qRAM-accelerated online scheduling: walks + AE + regret/query ledger separation
- source: `memory/2026-09-05.md` @ "关键经验（第十一批"

| wrong (as it stood) | right (as recorded) | category |
| --- | --- | --- |
| Szegedy's search step is whatever unitary pairs the flip with the diffusion | the working convention is C.S.R (oracle postposed, double-coordinate flip): first-coordinate single flip, preposed flip, and absorbing columns all fail to search (254 steps, no 0.25 on K_n); the absorbing variant is non-unitary on the support-restricted edge space (norms 0.97-0.99) | conjugation |
| the walk implementation is broken (when norms decay) | the TEST INPUT was broken — the 2-state family missed the 1-q stay probability: columns non-normalized, R not a reflection; pre-verify input row sums before blaming the algorithm | wrong-object |
| lazy doubling: E2 doubles for every graph | path graph 0-1-2-3-4 with targets {0,4}: non-lazy E2 = 4 (hand-missed the +1 from E1), lazy E2 = 8 — the x2 holds only for K_n; the LU judge corrected two versions of my hand anchor consecutively | machine-overruled |
| first-passage time under a single threshold measures detection | the barbell's early transient (2-8 steps) already wipes 0.25 at prob 0.26-0.50 — the honest metric is the envelope peak; dual-report transient + envelope | statistics |
| report the mean over 20 seeds | one wrong-terminal UCB1 seed contributes T*Delta = 2000 regret and distorts the mean — median + wrong-terminal count, reported separately | statistics |
| adversarial regret is non-negative | regret vs the best FIXED arm can be -9: dynamic strategies are not dominated (r[0,0]=r[1,1]=1) — assert what the quantity is, not its sign | wrong-object |
| RANKING dominates greedy-uniform instance-wise | no such theorem exists — 1/2 and 1-1/e are worst-case caps, and a random sparse bank at n=16 had RANKING lower by 0.018; the invented dominance died on test data | bogus-comparison |
| compare the sum of per-seed ratios with a tolerance | |sum rr - sum gr| <= 0.05 passed over the SUM of 40 ratios (0.22) — divide before comparing | bogus-comparison |
| the separation margin is physics | the 1-cell (2*pi/2^m) margin is a design knob: Delta=0.2 gave 2/20 wrong commits, 1.5 cells gave zero — report policy shape and complexity law separately | statistics |

### Batch 12 — bqp-map (2026-09-05)

- context: scheduling complexity atlas: reductions / upper / lower / witness layers
- source: `memory/2026-09-05.md` @ "关键经验（第十二批"

| wrong (as it stood) | right (as recorded) | category |
| --- | --- | --- |
| write k*/sqrt(N) inside a block comment | '*/' closes the comment early — it exploded twice (exp2 header + an entries string); write k* / sqrt with spaces | toolchain |
| the max off-diagonal of the ZZ Hamiltonian is the -Gamma entry | plain max returns 0 — the matrix is diagonal with mostly-zero off-diagonals; the anchor lives on the NONZERO support (positive side unaffected: positives dominate zero) | wrong-object |
| one ascending comparator sorts Johnson's groups | the second group is p2 DESCENDING — the permutation judge caught the reversal; check sort direction group by group | dimension-slot |
| BBHT costs ~35*sqrt(N), close enough | cap = ceil(sqrt(N)), lambda = 8/7, cap-interval [cap/2, cap), 8 retries -> ~13*sqrt(N) with 100% hits — the inner search's FAILURE path (declaring no-solution) dominates the query account | statistics |
| promise instances are plentiful — assert > 10 | (m=2, B=20) has exactly 4 (nondecreasing sequences with fixed sum = partition count) — expectations by arithmetic, not vibes | process |
| the advantage factor is a constant | it grows ~1.27*sqrt(N) — assert at > sqrt(N)/4 scale, not as a fixed multiple | wrong-object |
| one resolve root fits all | in-repo files (theory.md) use repoRoot, sibling prototypes workspaceRoot (one MORE level up) — one resolve, two semantics | toolchain |
| round the measured slope to the theorem's 0.5 | the measured 0.575 is implementation overhead, not physics — report it with the source explained, neither cosmetic nor passed off as 0.5 | process |

### Batch 13 — switch-sched (2026-09-05)

- context: indefinite causal order theorem layer (quantum switch)
- source: `memory/2026-09-05.md` @ "关键经验（第十三批"

| wrong (as it stood) | right (as recorded) | category |
| --- | --- | --- |
| bake 1/sqrt(2) into the switch isometry M | M is controlled routing with no factor — the superposition comes from the input control |+>; baked in, M+ M = (1/2) I and the isometry certificate vetoed it on the spot | conjugation |
| assign environment slots by execution order | slot a is ALWAYS A's environment and slot b B's — ordering them by execution silently destroys the cross-branch coherence (the replacer-control judge returned |+><+| instead of (1/2) I) | dimension-slot |
| I (x) U as mMul(identity, U) | tensor product is kron, not matrix multiplication — both 'look runnable' at 2x2; the shape error is the only warning | dimension-slot |
| copy Weyl Kraus operators elementwise | the copy drops the imaginary part — d=2 Pauli (all real) is immune, d=3 complex phases expose it (batch 9 recurring); multi-dimensional anchors from the first batch | anchor-blindspot |
| replacer Kraus operators carry amplitude v_j | the Kraus is |v><j| with amplitude exactly 1 — the v_j factor cut trace preservation to 2/3; every hand-built Kraus family passes a sum K+ K = I self-check | conjugation |
| one matched deception pair refutes all fixed-order simulators | coherent control makes global phase visible (kickback) — each strategy class needs its own pair; (X,Z) vs (ZX,I) (equal matrix products) is the coherent class's deceiver | wrong-object |
| patch TS strings via JSON -> bash heredoc -> Python | the double-escaped \n split strings into two lines — typecheck after every batch patch; complex patches go through the Edit tool | toolchain |
| my hand-derived T = 1/4, chi = H2(1/4) anchors | both wrong (T = 1/2, chi = H2(1/4) - 1/2) — fix the anchor, not the machine; three-way comparison (derivation / machine / consistency), whoever is right wins | machine-overruled |

### Batch 14 — bqp-map (2026-09-05)

- context: genealogy registration: the visitor's 17 claims as machine-checked atlas rows
- source: `memory/2026-09-05.md` @ "关键经验（第十四批"

| wrong (as it stood) | right (as recorded) | category |
| --- | --- | --- |
| compare the postselect ledger against Grover's best success probability | optimalK maximizes success with NO cost model — t/N ~ 1/2 touches 0.99 at k=5 but pays 5 queries against the ledger's 2.29, and n=4 t=7 shattered 'ledger >= grover queries'; give Grover the same certain-answer standard (k iterations + 1 verification + failure restart, E* = min_k (k+1)/p_k, k=0 the pure guess) — then ledger >= E* always, with attainable equality | bogus-comparison |
| the brute-force control is the same formula evaluated again | that is a tautology — the control must be a different path: integer rational-exact counting against floating-point amplitude accumulation | bogus-comparison |
| apply sigma_a (x) I to measure along axis a | that operator is unitary, not a measurement — projectors P± = (I ± a.sigma)/2, two unnormalized branches summed = the outcome-forgetting channel; otherwise the test greens on the wrong theorem (unitary invariance) | wrong-object |
| pin the tolerance at 1e-16 | (1/sqrt(2))^2 floats to 0.5000000000000001 — the assertion at 1e-16 is exceeded exactly; regression guard 2e-16 with the provenance commented | statistics |
| debug with tsx -e in Git Bash | it is silently mute on Windows — write a temp script file (and repo-root debug files import ./src, not ../src) | toolchain |
| the equality row (n=4, t=7: ledger/E* = 1.00 with k=0 optimal) weakens the table | honest equality ships as-is with its explanation — no selecting, no cosmetics | process |

### Batch 15 — causal-ineq (2026-09-05)

- context: causal inequality execution layer (process matrix framework)
- source: `memory/2026-09-05.md` @ "关键经验（第十五批"

| wrong (as it stood) | right (as recorded) | category |
| --- | --- | --- |
| run Jacobi row and column rotations inside one k loop | column updates then read pre-update elements — the J+AJ two-pass structure breaks; 2x2 hand-checks all pass while 16x16 fails; two independent full passes (anchors [[1,1],[1,-1]] -> ±sqrt(2), sigma_y -> ±1 caught it) | dimension-slot |
| hand-write complex Hermitian Jacobi | double to real-symmetric [[Re,-Im],[Im,Re]] (eigenvalues in pairs) — pure-real rotations, textbook-stable | conjugation |
| |Phi><Phi| = 11 + XX - YY + ZZ | the 1/2 normalization fronts the expansion — nearly lost twice (the channel-W trace alarmed 8 != 4); write the normalization first, then kron | conjugation |
| pin Alice's detection outcome to marginalize Bob's branch | pinning computes the JOINT probability — marginalization sums over both outcomes (the T2 terms cancel exactly in the sum and the closed form closes); same family as batch 14's 'control path must differ' | wrong-object |
| assert support signatures as Pauli index strings | Pauli indices (0-3) are not subsystem support signatures (0/1), and deepEqual is order-sensitive — assert the support-signature SET | wrong-object |
| grab the nature.com file number from memory | ncomms2156 is a genomics paper — the causal-inequality PDF is ncomms2076; walk the PMC + redirect chain fully, and when formulas are images, have the machine construct within constraints and let anchors adjudicate (W* came out stronger than transcription, PSD-tightness proof included) | citation-drift |

### Batch 16 — k-switch (2026-09-05)

- context: k! order-superposition execution layer (six-order switch)
- source: `memory/2026-09-05.md` @ "关键经验（第十六批"

| wrong (as it stood) | right (as recorded) | category |
| --- | --- | --- |
| the isometry certificate is M.M | it is M+ M — exp1 wrote the matrix square and the sign habit slipped through; self-check the algebraic object after writing it | conjugation |
| sample Pauli triples with rng.int(3) x 3 | sampling with replacement breaks the promise class (X,X,Y no longer pairwise anticommuting — the product is Y, not a phase); sample random permutations constrained to the class | statistics |
| a 1e-16 tolerance bounds the sqrt amplification | T = sqrt(1 - |<a|b>|^2) at |<a|b>| = 1-eps gives sqrt(2*eps) ~ 2e-8 — the threshold comes from the amplification formula (1e-7), provenance commented | statistics |
| post-erasure fixed order should show maximal dilution D=1 | the machine: all six fixed orders exactly 1/sqrt(2), the six-order switch exactly 1/2 = D/sqrt(2) — narrate and assert what the machine found, hand-verify the closed form after (X.Z|+> = -|->) | machine-overruled |

### Batch 17 — vacuum-compiler (2026-09-05)

- context: ground-state compiler prototype (Feynman clock + readout energy ledger)
- source: `memory/2026-09-05.md` @ "关键经验（第十七批"

| wrong (as it stood) | right (as recorded) | category |
| --- | --- | --- |
| compute Im(v v+) with the conj on the output side | (v v+) imaginary part is im_i*re_j - re_i*im_j — inverted, real matrices are immune (t3 anchors green) and pure-imaginary sigma_y showed deviation exactly 2; rebuild certificates must include complex examples | anchor-blindspot |
| dedup degenerate eigenvector clusters | Jacobi returns arbitrary REAL bases — decoded complex vectors may be complex-linearly dependent; rebuild per cluster (even real multiplicity = complex multiplicity, in-cluster complex Gram-Schmidt); odd real multiplicity throws directly | dimension-slot |
| half-fill sigma_y's imaginary part; it looks right | the eyeball passed, cmatUnitaryDev returned deviation exactly 1 — hand-written gate matrices fill completely and pass the unitarity check | anchor-blindspot |
| start the kron chain with out = eye unconditionally | at a=0 the embedder krons a 2x-dimension matrix and historyState reads out of bounds -> NaN — and 8x8 kron(eye, cnot) was STILL unitary; embedders verify output dimension exactly 2^n; guards fail loudly over silent NaN | dimension-slot |
| vals[1] is the spectral gap | H_prop's ground state is 2^n-fold degenerate — the gap reads via firstExcited with multiplicity; 'every input's history state is a ground state' becomes the assertion at that site | wrong-object |
| comparison target kron(I, chain) | the global order is data (x) clock — reversed, the identity is off by 0.5; on cross-check failure, audit factor order on BOTH sides first | dimension-slot |
| the clock marginal is diagonal; the fuel tilt dirties the cargo at O((eps/Delta)^2) | both physics claims overruled twice: the marginal-COHERENCE law is the true law (the identity circuit is fully coherent), and the tilt closes on the trajectory-covariant subspace — the fuel account moves to the spectral gap; re-narrate per machine, closed forms supplied | machine-overruled |

### Batch 18 — dsic-noether (2026-09-05)

- context: mechanism-design symmetry layer (Groves gauge group + discrete Noether)
- source: `memory/2026-09-05.md` @ "关键经验（第十八批"

| wrong (as it stood) | right (as recorded) | category |
| --- | --- | --- |
| a stepwise ~1e-15 residual certifies the variational integrator | the DEL sign was inverted (an anti-oscillator): residuals green while |q| exploded to 3.5e8 over 400 steps — certificates also watch trajectory scale (a bounded max|q| assertion added); after the fix lambda sits on the unit circle per the hand-derived (1 - h^2/4)/(1 + h^2/4) | wrong-object |
| fixed-order serial dictatorship is the negative control | SD is the classic non-manipulable rule — the machine refused to break it 40/40; second-best (one step from optimal) is the biter (25/40). Prior intuition yields to machine precedent, and corrections are recorded, not buried | machine-overruled |
| exclude agent i and keep a square bijection | n-1 agents over n items is a PARTIAL INJECTION P(n, n-1); and global agent indices must align with local rows (values[agent] crashed undefined — the loud failure was the good news) | dimension-slot |
| enumerate injections in ascending index order | ascending order yields combinations, not k-permutations — agent order matters in assignment; 'looks right' combinatorics exposed at runtime | dimension-slot |
| let the Groves payment sign convention emerge from the code | p_i = h_i - W_-i(x), U = Phi_v(x) - h, charge = welfare gap — hand-derive the signs once before coding | conjugation |
| a 1e-15 guard is 'strictly better' | the floor is set by the largest intermediate (|q+ - q|/h terms ~56 -> ~1e-14); guard 1e-13 with provenance | statistics |
| experiments reach the workspace root in three levels | two (../..) — the fifth fall on resolve paths | toolchain |

### Batch 19 — postselect-sched (2026-09-05)

- context: restart-scheduling theorem layer for the many-worlds sorter
- source: `memory/2026-09-05.md` @ "关键经验（第十九批"

| wrong (as it stood) | right (as recorded) | category |
| --- | --- | --- |
| transcribe lambda(t) from the LSZ93 preprint PDF | the transcription violated the paper's own lambda <= L lemma — the exhaustive judge returned 19.999 for enumerated strategies against the transcribed 'lambda* = 42.07'; correct semantics lambda(t) = E[min(T,t)]/q(t), hand-checked on {1,5} before rewriting | citation-drift |
| a trace-preserving channel equals the identity elementwise | the complementary-projection two-Kraus channel is block-preserving + cross-block decohering — state the object's semantics before the assertion | wrong-object |
| the average of conditionals is the conditional of the average | (1/2)cond(mix) + (1/2)cond(rho2) does not equal cond(rho1)/2 + cond(rho2)/2 — the second computational path is audited too | wrong-object |
| MC conditional frequencies divide by the total sample count | the denominator is the number of ACCEPTED samples — branch-world population counts only branch residents | statistics |
| sample marked sets with possible repeats | birthday collisions decouple t from the array length — dedup at entry | statistics |
| word the README by the expected limit | finite-N thresholds approach from ABOVE (0.3984 -> 0.396484) — wording follows the data, not the expectation | process |

### Batch 20 — retro-cache (2026-09-06)

- context: no-signaling tariff ledger for the retrocausal cache
- source: `memory/2026-09-06.md` @ "关键经验（第二十批"

| wrong (as it stood) | right (as recorded) | category |
| --- | --- | --- |
| build rho_03 = psi_0 * psi_3 | it is psi_0 * conj(psi_3) with imaginary part -sin(theta)/2 — dropping the conj builds |Phi_-theta> and flips every sin(theta) correlation; the complex anchor family cashed its value immediately (deviation 0.5826 at theta = pi/4 located on the spot) | conjugation |
| apply the B(x)env unitary on the 4-dim A(x)B space | the Stinespring dilation is constructed on the FULL (A) (x) (B (x) env) space with the control straddling A — the A-dependence test alarmed maxdiff 190-scale at once; dimension accounts before matrix multiplies | dimension-slot |
| no-signaling means I(B; A's outcome) = 0 | the correct object is I(B; A's SETTINGS) = 0 — on the aligned axis the outcome MI is legitimately 1 bit (that IS the entanglement); the perpendicular axis gives 0, and the bit lives in the |a.b| alignment | wrong-object |
| the invariant is 'B's coin stays uniform' | non-unitary CPTP legitimately biases B's own coin (E(I/2) != I/2) — the invariant is 'independent of A'; write the physical object first | wrong-object |
| trust the |Phi_theta> tensor at a glance | two easy misses: T_zz = +1 (the Z(x)Z diagonal (-1)(-1) = +1 — both-side signs MULTIPLY) and T_xy = T_yx = sin(theta) (coherent off-diagonal) — hand-derive the full tensor closed form before coding | conjugation |

### Batch 21 — route-price (2026-09-06)

- context: route-and-price dossiers for the two OPEN rows
- source: `memory/2026-09-06.md` @ "关键经验（第二十一批"

| wrong (as it stood) | right (as recorded) | category |
| --- | --- | --- |
| normalize conditionalData by the joint element P(control=g, data=0) | the divisor is the BLOCK TRACE (control=g's marginal) — the joint element sent the leakage check to maxdiff 190; after the fix, exact zero drift. Ask first: conditioned on whom, traced over whom | wrong-object |
| the clone gap's numerical lower bound certifies no-cloning | gap = |sin(theta + phi)| passes through zero (0.337 at phi = 2.7) — no bound exists; the discriminant is COVARIANCE: pair terms invariant under rephasing, clone terms rotating at double speed. Same type as batch 20's Stinespring lesson — write the correct invariant first, then the threshold | wrong-object |
| render.ts runs main() at import | an entry guard (import.meta.url === pathToFileURL(process.argv[1]).href) — otherwise the test's first import executes the rendering | toolchain |
| hand-compute the dossier's price column, then round | the witness measured 9977.19 against the hand's 9977.87 — run the witness first, then write the number into the text | process |

### Batch 22 — burial-record (2026-09-06)

- context: this repo's own delivery: the burial record promoted to a machine-audited registry
- source: `memory/2026-09-06.md` @ "关键经验（第二十二批"

| wrong (as it stood) | right (as recorded) | category |
| --- | --- | --- |
| feed the category census witness error-shaped objects ({repo, category}[]) through a batch-shaped counter (countBy over BurialBatch[]) | tsc rejected the call site — the witness counts by two direct traversals (direct vs JSON round-trip) instead. The live specimen of this registry's own wrong-object category | wrong-object |
| cite batch 19's source anchor from memory as memory/2026-09-06.md | postselect-sched's first delivery (T1-T4, batch 19) happened on 2026-09-05 — only the T5 extension was on the 6th; the B4 gate named the dead anchor, and the B4 smuggling trial caught the real violation by collateral (actual 19 vs expected 20). Anchors are verified against the file by grep, never by recall | citation-drift |
| place the diagnostic script outside the repo (system temp) | it cannot resolve ./src from there — batch 14's own lesson (repo-root debug files import ./src) repeated; the script belongs inside the repo | toolchain |
| number the laws B0-B4 then B6 | a gap in the law numbering of the very repo whose law B3 forbids gaps in batch numbering — caught in self-review, renumbered B0-B5 | process |

### Batch 23 — readout-wall (2026-09-06)

- context: the readout wall delivered as an exchange-rate ledger
- source: `memory/2026-09-06.md` @ "关键经验（第二十三批"

| wrong (as it stood) | right (as recorded) | category |
| --- | --- | --- |
| track only the REAL amplitudes in the k=3 branch builder | random complex CPTP channels would be silently corrupted — and the depolarizing witnesses are structurally immune (real Kraus; batch 9 recurring). Caught in self-review, then the hole closed by construction: W-E's mixture identity now includes complex random triples. A blindspot is not fixed until an anchor exists that can see it | anchor-blindspot |
| leave the wrong-dims expression, the void-ed leftover and the invalid hex literal 0x5ead0u7 in the complex sub-check's first draft | drafts do not reach the machine dirty — cleaned in review before the run; the draft's errors still book | dimension-slot |
| import mulberry32 from the kernel by memory | the export is makeRng — the grep chain refused to run the probe until fixed. A reference into your own codebase is still a reference: verify, never recall | citation-drift |
| reuse report.ts assuming the contract travels with the idiom | the source repo's writeReport returns void and writes reports/, not out/reports/ — the render printed 'rendered -> undefined' until caught. Read the contract before wiring a reused file; same idiom is not same signature | process |

### Batch 24 — nosignal-tariff (2026-09-06)

- context: the no-signaling tariff itemized as one machine-audited schedule
- source: `memory/2026-09-06.md` @ "关键经验（第二十四批"

| wrong (as it stood) | right (as recorded) | category |
| --- | --- | --- |
| apply a 2x2 projector directly to the 4x4 two-qubit state | an operator acting on a subsystem tensors with the identity first — kron(P, I); the shape error fired on the very first run | dimension-slot |
| fill SINGLET/PHI_PLUS density matrices by writing amplitudes into wrong elements (the |01><10| coefficient into the (0,1) slot) | caught in self-review before any run — the state's index account precedes filling numbers; |01> is index 1, |10> is index 2 | dimension-slot |
| read the joint elements re[0]/re[3] of the dephased output as the order-bit probabilities | the object is the CONTROL MARGINAL's diagonal — joint elements depend on the payload by design; the probe's 1.856e-1 was the alarm. The no-signaling object (setting, marginal) has now recurred THREE times (retro-cache batch 20, readout-wall batch 21 conditioning, this batch) — the schedule now writes the correct object at the top of its page | wrong-object |
| transcribe the binary-entropy Taylor series from memory with the prefactor 4x too large and the first power off by one | the machine returned 2.793 deviation; after the fix 1.27e-3 exposed the boundary convergence issue (at d=1 the series converges only as 1/(2N)) — 400 terms on the open grid q in [0.05, 0.45], closed forms at the endpoints; a series is quoted only where it is honest | citation-drift |
| check 'ensemble average is I/2' by comparing against identity(2) | the comparison object is the maximally mixed diag(1/2, 1/2) — printing the diagonal 0.5 exposed that the wrong side of the comparison was wrong, not the physics | wrong-object |
| call the gate green when npm test passes | tsc caught two unused imports (PHI_PLUS, dephase) after all 11 tests were green — tsx does not typecheck; typecheck and test are separate gates and both must run | toolchain |
| feed a 2x2 zero matrix into the 4x4 local-map channel, and require() inside an ESM probe | the stack trace refused both at once — sanity checks need the right-shaped input; ESM imports modules statically | toolchain |
| let the negative-control test wander into a positive assertion with a void-ed leftover variable | rewritten in review before merge — drafts do not reach the machine dirty, and the draft's errors still book | process |

### Batch 25 — choice-lang (2026-09-06)

- context: the first executable model of choice as a language primitive
- source: `memory/2026-09-06.md` @ "关键经验（第二十五批"

| wrong (as it stood) | right (as recorded) | category |
| --- | --- | --- |
| run a 20-step program without accounting the register: each choose adds a control qubit | the joint state is 2^20 x 4 dimensional — the probe hung and was killed by timeout. Dimension accounts before matrix multiplies (third of the family): program length is bounded by memory, not by mathematics | dimension-slot |
| let the language kernel reach the machine on the third draft (draft 1: dead code and a nonsense ternary; draft 2: silly accumulation expressions and per-loop diagonal extraction) | rewritten twice in review — drafts do not reach the machine dirty, and every draft's errors book | process |
| 'verify' the clone's order-2 phase by composing the expected rotation myself and checking it against itself | a tautology wearing a witness's clothes (batch 14's bogus-comparison recurring) — rewritten to read the phase off real matrices: the CNOT pair state rephased by R(x)R, the pair term's ratio extracted from the result | bogus-comparison |
| tensor the 2x2 control marginal against the 4x4 pair projector | the clone input is kron(rho_c, |0><0|_2) — the shape error fired on the run | dimension-slot |
| assert the control marginal equals the prepared state after a choose | the cross-term is scaled by Tr[U0 rho U1-dagger] — that scaling is HOW a control carries information (the replacer pair's mechanism); the invariant is the DIAGONAL (the readout-blind face). The failing test corrected the asserted object, not the physics | wrong-object |
| quote the rounding floor from the probe's seeds (211-family) for a witness using different seeds (201-family) | floors are not seed-stable: the witness measured 8.882e-16 against the quoted 4.5e-16 — quote the floor at the witness's own seeds, with provenance commented | statistics |
| write render.ts through a bash heredoc | the heredoc truncated the file's tail and swallowed the following command — complex files go through the Write tool, always; tsc also caught an unused parameter left by an earlier edit | toolchain |

### Batch 26 — binding-price (2026-09-06)

- context: the market of #13 executed: privacy bought, binding not
- source: `memory/2026-09-06.md` @ "关键经验（第二十六批"

| wrong (as it stood) | right (as recorded) | category |
| --- | --- | --- |
| hand-expand the pass probability's element arithmetic (a real-part sign slip in the A10*B01 term) | real states were immune; the identity sweep caught 1.5e-1 in the complex quadrant — closed forms go through the kernel (mMul + mTrace), never through the fingers (batch 10's expPauli recurring) | conjugation |
| write probe.ts through a bash heredoc again | truncated a second time in the same session (batch 25's lesson re-offended on the spot) — code files go through the Write tool, promoted to a hard rule | toolchain |

### Batch 27 — letter-audit (2026-09-06)

- context: the letter itself, fully audited — origin claim and five abilities
- source: `memory/2026-09-06.md` @ "关键经验（第二十七批"

| wrong (as it stood) | right (as recorded) | category |
| --- | --- | --- |
| start writing the Turing-machine encoding before finishing the design (two drafts collapsed into placeholder voids mid-file) | the third draft defined the clean self-encoding (4(n+1) options per entry) on paper first — encodings are designed before they are typed | process |
| write the universe count as 4 * (n + 1) ** (2 * n) | precedence: that is 4*((n+1)^(2n)) = 324, not (4(n+1))^(2n) = 20736 — the enumeration ran on a truncated universe and returned BB=3 against the expected 6. Hand-evaluate formulas on a concrete case before they enter code | statistics |
| encode the right-walker transition as K - 1 - (n + 1) instead of exactly 3 * (n + 1) | an off-by-one in index arithmetic, caught in self-review — substitute concrete numbers into index formulas the same way | dimension-slot |

### Batch 28 — wukong-crossval (2026-09-06)

- context: the physical-verification pipeline, built to the machine-time application's spec
- source: `memory/2026-09-06.md` @ "关键经验（第二十八批"

| wrong (as it stood) | right (as recorded) | category |
| --- | --- | --- |
| allocate the statevector with dim entries but index it as the [real | imaginary] split layout | psi[dim + k] reads out of bounds into NaN energies — the layout constant (dim = length >> 1) must have a single source threaded through every kernel function | dimension-slot |
| read coupling coefficients from empty rows without a fallback | v += undefined poisons the value with NaN, and NaN comparisons silently fool the enumeration referee (opt 8.6 against the true 18) — boundary reads get ?? 0, and the separable second path is exactly the detective that caught it | dimension-slot |
| apply the cost phase with the real part missing the -im*phIm term | an incomplete complex-product real part (batch 10's conjugate-side class, third appearance this session) — caught by the NaN-energy probe before any number was written | conjugation |
| build 21 instances then slice(0, 20), silently dropping the fifth linear one | 4 linear + 16 coupled against the spec's 5 + 15 — count the construction before truncating it | process |

### Batch 29 — survivor-census (2026-09-06)

- context: the survivor semantics of the many-worlds sorter (posterior, kill register, waiting price)
- source: `memory/2026-09-06.md` @ "关键经验（第二十九批"

| wrong (as it stood) | right (as recorded) | category |
| --- | --- | --- |
| write the imaginary part of <A|B> as aIm*bRe - aRe*bIm | conj(A)B has Im = aRe*bIm - aIm*bRe — the test referee convicted it at deviation 1.176 = 2 sin(pi/5), exactly twice the imaginary part. Conjugation-side sign error, THIRD recurrence (batch 10 expPauli, batch 28 applyCost): write the conjugate expansion before typing the loop | conjugation |
| referee E[T] by a plain truncated loop at every P (P=2^-20 needs ~4e7 accumulated adds) | float drift 4.4e-5, far past the tolerance — the second path became the closed-form partial sum (1-(K+1)q^K+Kq^{K+1})/p with analytic tail < 1e-12 of the mean, and the loop referee stays only at moderate P where K is small. A second path must be independent AND numerically stable, not the same sum in another accent | statistics |
| assert the degenerate full-funding case with assert.equal(pKeep, 1) | the normalized weight sum is 1+2.2e-16 — degenerate assertions over float sums take tolerances; the same eps pushed waitingPrice's domain check to throw on p=1+eps | wrong-object |
| resolve the workspace root in test/ with the three-level climb copied from src/experiments/ | test/ sits TWO levels below the workspace — G3 misreported every live anchor as dead (postselect-sched, retro-cache all 'not on disk'). The climb depth belongs to the file's own position; count your own directories before copying a neighbor's relative root | toolchain |
| print the kill register's fractions as mass*N over N | the true denominator is totalC (60), not N (16) — '2/16 (0.1167)' is a fraction that lies about its own decimal. KillRow now carries count/totalC and the register prints the real integer ratio | bogus-comparison |
| let draft residue reach the machine (a `| ""` leftover inside a ternary, an unused N in p0Probe, an unused seed parameter in mcWaiting) | tsc named all three before any test ran — drafts do not reach the machine dirty, and every draft's errors book | process |

### Batch 30 — ent-clearing (2026-09-06)

- context: the settlement layer of the entanglement standard (teleportation burns the coin, dense coding returns it, Procrustean netting, the mint wall)
- source: `memory/2026-09-06.md` @ "关键经验（第三十批"

| wrong (as it stood) | right (as recorded) | category |
| --- | --- | --- |
| write |Phi-> and |Psi-> as global negations of the plus states: vScale(vAdd(k00, k11), -inv) | the minus lives on the SECOND ket, not on the whole vector — the broken basis destroyed orthogonality (the Phi- projector traced 1 on the Phi+ signal; the Z and XZ signals decoded as all-zero rows). The decode matrix convicted it before any number was written | conjugation |
| print probe fidelities at toExponential(6) and read 1.000000e+0 as clean | the value was 1 + 2.1e-8 — the format masked the dirt while npm test failed on the same number (batch 29's fake-fraction lesson recurring on the reader's side): debug output needs enough digits to convict | bogus-comparison |
| verify pure-payload identity through the Uhlmann fidelity (the sqrtPSD route) | the eigenvector path carries ~1e-8 noise on rank-deficient states (reconstruction accepted at 1e-8), so 'fidelity exactly 1' failed at 1+2.1e-8 — pure references take <psi|rho|psi> (exact linear algebra), identity between mixed matrices takes trace distance (eigenvalues only): the metric is chosen by the rank of what it touches | wrong-object |
| normalize the Procrustean fail branch unguarded at l_min = 1/2 | K_fail is the zero matrix there, pFail is exactly 0, and the fail 'state' is 0/0 = NaN slipping through silently — probability-zero branches are guarded before division (survivor-census S4's P=0 lesson in arithmetic form) | statistics |
| let audit.ts draft residue stand: indirection chains (mMat/randomMixedLike), mid-file imports, a void dead branch, a placeholder rejects() line in T4 | self-review caught all of it before the machine saw the file; drafts do not reach the machine dirty, and every draft's errors book | process |
| copy the kernel core but skip measures.ts (it had only been read) | tsc named both dead imports immediately — a copy list is a checklist, not a memory | toolchain |

### Batch 31 — stable-world (2026-09-06)

- context: the physics half of ledger row #15: the desired world as the absorbing class of a fixed dissipative law (quiet-on-world, global attraction, the charge as Lyapunov function, perturbation census, stabilization tariff, escape ledger) — the row's first verdict move, OPEN -> MECHANISM-SETTLED
- source: `memory/2026-09-06.md` @ "关键经验（第三十一批"

| wrong (as it stood) | right (as recorded) | category |
| --- | --- | --- |
| write the |1><0| Kraus element at flat index 1 (that is element (0,1) — the damping would flow OUT of the world) | row-major (1,0) is index 1*2+0 = 2; self-caught before the machine saw it — indices are written as row*cols+col, never as a bare number (batch 22's index lesson in Kraus form) | dimension-slot |
| scale a 4x4 matrix by multiplying it with a 1x1 'scalar' matrix through mMul | mScale is the operation; mMul would have thrown a shape mismatch — self-caught in review | dimension-slot |
| build random unitaries as exp(iH) through the family eigHermitian on an INDEFINITE random Hermitian | the family solver's reconstruction check runs through reconstruct(), which sums only λ > 0 — it is PSD-only by construction and threw 'reconstruction failed' on every draw; random unitaries rebuilt on complex Gram-Schmidt QR (two re-orthogonalization passes, random column phases), no eigendecomposition. A solver's implicit precondition is part of the object it accepts | wrong-object |
| define the law's k->infinity limit as the diagonal blocks kept IN PLACE (the dephased twin) | K1 carries |0,x> into |1,x>: the true limit is the into-world collapse — the world block equals rho_WW + rho_SS with the cargo intact and the complement block gone; the 1e-12 assertion convicted the wrong object at once. Derive the limit from the Kraus action chain before constructing it | wrong-object |
| compare the converged state against inWorldState(outside) — embedding a 4x4 full state as if it were 2x2 cargo, producing 8x8, while the family mAdd silently accepted the shape mismatch (garbage, not an error) | keep the cargo and embed it both ways from the same 2x2 object; the kernel's adders do not check shapes, so the dimension account is always ours to keep (batch 24's ⊗I lesson, silent variant) | dimension-slot |
| Monte-Carlo the event 'ever left the world within K steps' while the closed form gives 'out of the world AT step K' (the chain has return) | two different events an order of magnitude apart — 682σ; the census resimulates the same event on the full chain with return (1.21σ). The event definition is written in the same sentence as the closed-form claim, before any sampling | statistics |
| import basisVec from states.js (it lives in cmat.js) | the ESM loader named the missing export; a module map is a citation too — grep it, do not remember it (batches 23/24 recurring) | citation-drift |
| consume mat and mAdd in the test file with neither in its import list | self-caught before the run — same lesson as the basisVec line, the import list is checked against the file's actual uses, not assumed | citation-drift |

### Batch 32 — mutant-census (2026-09-06)

- context: the workspace's quality layer: the burial record's defect classes replayed as nine mutants and killed by a ten-property battery (6 EXACT + 1 CRASH + 2 DATA, zero survivors), the kernel family's byte-identity censused live, the 26 repos' hygiene machine-swept
- source: `memory/2026-09-06.md` @ "关键经验（第三十二批"

| wrong (as it stood) | right (as recorded) | category |
| --- | --- | --- |
| ship P2 as a statehood battery (Hermitian, trace 1, PSD) while MU2's corruption is elementwise CONJUGATION (rho*) — the conjugated mutant passed every statehood check and the declared EXACT-KILL was in fact a SURVIVOR | the kill-census test convicted the declaration on the spot; the fix is history's own fix — the sector coherence block carries its phase (e^{i phi}/2 exact), conjugation survives statehood, never the phase (batch 20's blind spot recurring on its own memorial). A negative control isomorphic to the checked object is no control at all | machine-overruled |
| NC-P3's violator: dagger the outer product — a mirror-symmetric corruption set against the mirror-symmetric identity outer(a,b)|dagger = outer(b,a), which it satisfies exactly (the control could never fire) | W-C convicted the deaf control; replaced by a lopsided corruption (element (0,1) doubled) with the mirror-blindness recorded in the boundary: mirror-symmetric tests cannot see mirror-symmetric corruptions, conjugation is killed by the PHASE, not by mirrors | bogus-comparison |
| build P10's entangled states with a random GLOBAL U(4) on |Phi+> and assert B's marginal is I/2 | only LOCAL unitaries preserve maximal entanglement — a generic global U(4) leaves B's marginal far from I/2 (convicted at 4.61e-1); the states are built as U_A (x) U_B. The assertion's admissible class precedes the assertion | wrong-object |
| require the CNOT negative control to move B's marginal by strictly MORE than 0.5 — the CNOT on |+0> moves it by EXACTLY 1/2 | threshold 0.4 with the exact value documented on the line; a threshold that coincides with the physical value is a trap | statistics |
| let P6's leakage loop advance one shared state through k MORE steps for each k in [1,3,7] (cumulative 1, 4, 11) while comparing against (1-gamma)^k | the canonical-family run convicted itself at 2.83e-1; each k evolves independently from rho — a loop counter named k must BE k | statistics |
| leave nonstoq-anneal and ft-qaoa out of the legacy guard register on the strength of a recon grep that found a guard SOMEWHERE in each repo | the census detector is per-FILE: a repo can carry a guarded render and an unguarded experiment entry at once; register what the detector sees, not what a coarse grep remembers | anchor-blindspot |
| capture provenance repos with /batch \d+ \(([^)]+)\)/ — MU1's 'batch 10 (qverify, expPauli)' yields the repo name 'qverify, expPauli' | the Q6 anchor check convicted the nonexistent repo; repo names are lowercase-with-hyphens: /batch \d+ \(([a-z0-9][a-z0-9-]*)/ | citation-drift |
| format kill margins with a >1000-means-sigma heuristic — MU5's exact trace ratio 3580 printed as '~3580 sigma' | the sigma unit belongs to DATA kills only; units are carried by the verdict's grade, not by magnitude | process |
| construct P1's mismatched pair as mat(k, m === k ? m + 1 : m) against mat(m, n) — when m !== k the product is LEGAL and the 'mismatch' census counts legal products | self-caught; a.cols = m + 1 against b.rows = m mismatches by construction — a negative census must GUARANTEE its negatives, not sample them | wrong-object |
| the MU6 edit left a duplicated assignment line (k0w.re[0] set twice) and MU7 zeroed the dephased twin's cells by hand-listing all eight cross index pairs | self-caught; the duplicate removed and the listing replaced by the sector comparison floor(r/2) !== floor(c/2) — an enumerated index list is a loop waiting to be written | process |
| ship render.ts with a placeholder helper whose body throws 'unreachable' — the render would have crashed on first run | self-caught on review; the whole file rewritten — drafts do not reach the machine dirty, and the draft's errors still book | process |
| walk the tree in census.ts through existsSync + readdir try/catch pairs with two helper functions nothing called | rewritten on readdirSync withFileTypes before the machine saw it — one walk, one dirent check, no orphans | process |
| import block missing mMul/vec/vKron while importing unused depolarize/PAULI_X/Rng/CMat | tsc convicted both directions (TS2304 cannot find name; TS6133 declared but never read) — typecheck is its own gate, tsx does not check types | toolchain |

### Batch 33 — mutant-census (2026-09-06)

- context: the v0.2.0 full-coverage extension: the pre-batch-21 guard debt PAID (42 experiment entries retrofitted across 11 repos, every gate re-run green, repro verified on all three retrofit shapes), the legacy register emptied into an absolute ratchet, the platform repo censused under a registered exemption, and `npm run total` judging the whole workspace as one command (55 jobs first run ALL GREEN)
- source: `memory/2026-09-06.md` @ "关键经验（第三十三批"

| wrong (as it stood) | right (as recorded) | category |
| --- | --- | --- |
| drop the retrofit probe into /tmp — which resolves to D:\Data\Temp on this machine, outside the repo, so './src/kernel/census.js' failed to resolve (batch 22's exact trap, re-triggered) | probes live INSIDE the repo (probe-detect.ts, probe-retrofit.ts at the census root) — a lesson that has recurred is a directory convention, not advice | process |
| the retrofit script inserted the guard import after the LAST line matching /^import / — qverify exp5-attacks.ts's last import is a MULTI-LINE declaration, so the line landed inside its braces; the test suite stayed 46/46 green because the test glob never imports the experiment file | typecheck convicted it (TS1003/TS1005) while the tests smiled: green tests say nothing about files they never import — typecheck is its own gate, and a script that edits imports must respect multi-line declarations | anchor-blindspot |
| verify the retrofitted repos with `npx tsc --noEmit --project <other-repo-path>` from the workspace root — npx resolved tsc against the root's node_modules and banner-errored for all 11 repos, every one a false alarm | run each repo's OWN `npm run typecheck` — tooling that resolves against the nearest node_modules must be invoked from the repo it serves | toolchain |
| scout the trailing invocations through a compound pipeline whose `grep -v ":: "` stage filtered out EVERY line (each line contained the separator), while the awk stage tripped ugrep's empty-subexpression error | a filter that swallows the signal is as guilty as one that passes noise — verify a filter lets signal through before trusting its silence; replaced by direct per-file tails | process |

### Batch 34 — mutant-census (2026-09-06)

- context: the v0.3.0 enrollment: the registry CLOSED — every buried error wired live to the guard that kills it now (107 on the mutants by declared class, 61 on build gates anchored file+needle to disk, 36 booked unenforceable with printed reasons, E1-E6 + W-F); this batch's eight delivery errors were enrolled in the same motion — the first batch born already-enrolled
- source: `memory/2026-09-06.md` @ "关键经验（第三十四批"

| wrong (as it stood) | right (as recorded) | category |
| --- | --- | --- |
| batch-edit family.ts through a bash-inline node one-liner whose regex escaping ate the pattern — the script printed 'classes added to 0 mutants' and changed nothing, silently | source surgery goes through the edit tools, never regex through pipes (the heredoc lesson's sibling); an edit script that reports zero replacements is a failure, not a no-op | toolchain |
| hand-mapped b20#3 onto MU2 by misreading its category as conjugation — the registry files it under wrong-object | the generator's class-tie validation REFUSED the emission ('MU2 does not replay category wrong-object') — the mapping is data checked against the live registry, never memory; the same error in a shipped table is E2's exact conviction | machine-overruled |
| enumerated the 204 errors by hand for the decision table and dropped one (b30#5, the measures.ts copy skip) | the generator's coverage validation named the undecided row — the table is generated FROM the live registry, so an omission cannot pass; the same hole in a shipped table is E1's exact conviction | machine-overruled |
| the render.ts edit carried a phantom call ENROLLMENT_used(enrollment) — a function that exists nowhere — caught in self-review before any machine saw it | draft residue is booked even when pre-flight review catches it; the initial draft does not go to the machine, but its errors go to the record | process |
| gen-enrollment.ts assigned `DEFAULTS[...] ?? null` into a Decision | undefined slot — TS2322 under noUncheckedIndexedAccess | restructured to a const decision chain (override ?? machine-overruled default ?? category default); tsc is its own gate | machine-overruled |
| wrote `if (!d) d = ...` where eslint's prefer-nullish-coalescing demanded ??= — the lint gate refused the emission | the const chain removed the reassignment entirely; typed-lint convicts style debt the compiler tolerates | machine-overruled |
| the emitter wrote D:\Data\Temp into the generated TS with bare backslashes — no-useless-escape named the dead \D and \T | the emitter escapes backslash and quote on every emitted column; generated code is code — it goes through the same lint gate | machine-overruled |
| E1's un-enrolled conviction named batch/repo/category but not the key — the smuggling test's /b35#0/ regex failed against a detail that could not name its own defendant | the conviction text now LEADS with the key ('b35#0 un-enrolled …'); a conviction that cannot name its defendant is not one — the new test caught it on first run | machine-overruled |

### Batch 35 — mutant-census (2026-09-06)

- context: the v0.4.0 anchor board: every GATE anchor upgraded from a string to a registered guard with evidence (FIRING-INJECT demos, FIRING-LIVE shots, RESOLVED machinery) under laws A1-A3 — five delivery errors, born enrolled
- source: `memory/2026-09-06.md` @ "关键经验（第三十五批"

| wrong (as it stood) | right (as recorded) | category |
| --- | --- | --- |
| resolveAnchor's branch conditions were written on reg.anchor (which ENDS with the needle) instead of the split-out path — endsWith('/package.json') was always false and every package anchor fell into the 'no resolution rule' fallback | conditions bind to the split's PRODUCT: path.endsWith('/package.json'), not the whole anchor string — the A3 test convicted the blindness by name ('did not resolve') | wrong-object |
| forged the L2 firing ammo from the daily memory's wording — '— (none) —' as a no-numbers row — without reading the law's implementation; hasNumbers is trim() nonempty, so the filler string is a perfectly legal number column and the demo fired at nothing | the conviction demo now encodes the law's real object read from the ledger's own audit.ts source (a BLANK column with a settled verdict); casting ammo for a sibling repo's law means reading that law, not remembering it | citation-drift |
| six T[] annotations on non-simple types in the new anchor module — the array-type lint gate refused until --fix rewrote them | Array<T> for non-simple element types, enforced by typed-lint — generated-or-handwritten, new code goes through the same gate | machine-overruled |
| after narrowing a closed three-kind union, compared reg.kind === 'RESOLVED' (always true) and chained ?. on a non-optional margin — no-unnecessary-condition named both | the else branch of a closed union does not re-compare; non-nullish values do not get optional chains — the lint gate holds these so tsc cannot | machine-overruled |
| the E1a smuggling fixture hardcoded the forged key as b35#0 — a 'future' batch number at writing time; when batch 35 actually landed, the forged entry shadowed the REAL b35#0 in the key map (category process over wrong-object) and the test detonated two unrelated citations (E6 mislabel + E2 class mismatch) instead of its single intended E1 | smuggling ammunition uses keys that can never collide (b99#0); an assumption that the future stays quiet is exactly the kind of thing the registry exists to convict — 2 !== 1 said so | machine-overruled |

### Batch 36 — dtc-clock (2026-09-06)

- context: the #10 settlement repo: the beat clocking universal reversible computation with a legislated tariff table — twenty-two delivery errors, born enrolled (E1 self-application, third generation)
- source: `memory/2026-09-06.md` @ "关键经验（第三十六批"

| wrong (as it stood) | right (as recorded) | category |
| --- | --- | --- |
| applyClockUnitary treated the total index as runner-major while the permutation and every readout used clock-major — two index conventions for one space (the family kron is A-major; the law was read only after the crime) | one layout everywhere: clock-major, row = z*runnerDim + d; read the family convention BEFORE writing operators against it | wrong-object |
| the 'optimized' applyClockUnitary collapsed the (d1,d2) pair loop into a single d — only d1=d2 blocks were written, silently zeroing every cross-d coherence (the runner's ENTIRE coherence) while every clock marginal still passed | the pair loop runs over all (d1,d2); marginals passing is not the state passing — the cargo matrix check caught what the marginals blessed | wrong-object |
| the detuned work law was written as the closed form J(n-1)(cos^2 2d)^k sin^2 2d for all k — true only for k=1: after the first kick the state is a superposition and the ZZ stroke entangles it, so the product-state geometry dies | first period kept as the true closed form (E_1 dev 4.4e-15), the chain's heating beyond it is DATA (suppression 4.5x vs the isolated echo), and NO infinite-time total is claimed — the scratch numbers convicted the prose before it shipped | machine-overruled |
| the runner halted by absorption (token |T> stays) — NOT injective: |T-1,x> -> |T,U x> collides with |T,U x> -> |T,U x>; the permutation lost bijectivity at the first wrap and the trace died at period 4 | the cyclic self-resetting runner: the wrap beat applies (U_T...U_1)+ (involutions replayed in reverse) — one (T+1)-cycle permutation; halt is a READING at the cycle top, not a stop | wrong-object |
| the family's eigHermitian fails its own reconstruction check on generic real-symmetric TI chains (err ~ 49; the values path is fine) — discovered by feeding it one | a local cyclic-Jacobi solver for the real-symmetric case (H is real by construction), with the two evolution roads cross-validated (4.4e-16); the family file stays untouched (K-board byte identity) — recorded as a family design boundary | machine-overruled |
| the tombstone's battery probe was X_0 — an EVEN operator under the chain's Z2, so <E0|X|E1> vanishes by parity and the 'oscillation' was 5e-15 of nothing (a vacuous check wearing a battery's clothes) | the machine scans ALL local observables and certifies the one that actually swings (a Z: amplitude 0.6508 at the Bohr period, exact to 1.4e-15); a negative control forbidden by symmetry is no control at all | wrong-object |
| the eigenbasis fast path transposed the transform — V^T O V instead of V O V^T with rows-as-eigenvectors; the ground state's <Z_0> must vanish by Z2 parity and the wrong transform gave -0.244 | O~[r,c] = sum V[r,k] O[k,l] V[c,l]; physics (a forced zero) is a free oracle against convention slips | wrong-object |
| expectationAt scaled only the imaginary part of (rr + i ri)(c + i s) by the observable — the real part was multiplied by nothing | both parts multiply the (real) observable: tre*O + i tim*O — the conjugation-side arithmetic family's fourth offense | conjugation |
| the stationarity check was moved to the eigenbasis fast path, where diagonal states give EXACTLY zero by construction — a check that cannot fail | stationarity re-routed through the direct projector-sum evolution (real floating-point cancellation, 3.7e-15); the fast path survives only for the battery scan, cross-checked against the direct road | bogus-comparison |
| sitePauli seeded the loop with the Pauli itself and prepended n factors — every site operator came out 2^(n+1)-dimensional; the family's mMul shape guard refused 64x64 * 128x128 on the spot | build the n-factor array (qubit 0 = low-order bit = LAST tensor factor) and kronAll it; dimension bookkeeping is the coder's, never the kernel's | dimension-slot |
| the multiplier's independent verifier read a1a0 with bit0 as a0 AND extracted the output nibble with p3 (wire 4) as the LSB — 6/16 'wrong' while the netlist was right; twice the same reversal in the checker, not the checked | wire0=a1 (MSB), nibble = p3@4 ... p0@7 MSB-first; the hand trace on x=0101 exposed the checker, and the machine's netlist was acquitted | wrong-object |
| chainDrift computed (E_0 - E_k)/J(n-1) — negative while the chain heats (energy PAID is the rise) | (E_k - E_0)/J(n-1); sign the object before signing the formula | wrong-object |
| the cross-validation error was folded into batteryPeriodError (Math.max of two different claims under one label) | a separate crossValidationError field — a number never travels under another claim's name | process |
| the pi-pairing tolerance was calibrated at 1e-90 against ONE run's 1.3e-97 (n=6); n=5 gives 2.9e-79 and the gate refused its own witness | tolerance states the CLASS claim (structural zero: <= 1e-25), not a snapshot of one run; unit-test assertions get their own seeds (shared-rng state drifts with test order) | process |
| the repeated-read census applied the phase-flip channel through dense (CD)^3 Kraus multiplies — 8e9 flops per run, 4.5-minute test suite | the channel as its mixture form: rho -> (1-q)rho + q Z0 rho Z0 with Z0 diagonal — an O((CD)^2) sign scaling; performance is a correctness debt the timer collects with interest | process |
| applyClockUnitary's six nested loops cost D^2 C^4 (the (a,b) sum runs per OUTPUT entry), mis-estimated as D^2 C^3 — a 16x surprise at n=5 | extract each C x C block and transform through the family mMul (F B F+): D^2 C^3 total; the 4.5-minute suite became 20 seconds | process |
| board literals quoted the scratch run's numbers while the audit witness re-derived different ones in tolerance (rng consumption order differs) — text numbers and witness numbers drifted apart twice in one session | censuses get dedicated seeds and the board is written AFTER the witness run (run-then-write, again, until it is reflex); both drifts were caught before shipping by reading the rendered report against the witness lines | process |
| a bash heredoc python codemod tangled (fourth offense: b25, b26, b36 — the third was being recorded when the fourth fired, the heredoc swallowing the very lines that bury it) | code files go through the Write tool, full stop; the lesson has now buried itself twice in one batch | process |
| ~150 noUncheckedIndexedAccess errors (index reads typed number | undefined) — the strict-mode tax every new repo pays at once | the family convention: `!` on structurally-safe index reads (the eslint config documents it); the next repo writes them from the first line | machine-overruled |
| lint: implicit-any JSON.stringify replacer, a template literal on a narrowed `never`, and redundant `!` on consts already narrowed by their initializers | explicit param types, a string-typed capture before the template, and --fix for the redundant assertions — tsc and lint each catch what the other blesses | machine-overruled |
| one FREDKIN line shipped with an unclosed parenthesis — esbuild refused the transform before anything ran | the transform error names file:line:col; syntax is the cheapest error class there is | toolchain |
| scratch.ts left an unused loop variable after the pairing-test reseed | noUnusedLocals names it; dead probes are deleted, not silenced | machine-overruled |

### Batch 37 — ds_extracted/ds (2026-09-06)

- context: the GENESIS target-A delivery: QuantumSched-Bench (the reproducible benchmark suite that convicted the 0/5 record) plus the flap disposition in the total gate — eight delivery errors, born enrolled
- source: `memory/2026-09-06.md` @ "关键经验（第三十七批"

| wrong (as it stood) | right (as recorded) | category |
| --- | --- | --- |
| generator.ts called require() in an ESM/verbatimModuleSyntax repo to import defaultPenalties — and runner.ts repeated the same sin ten minutes later, one file above the freshly written lesson | top-level static imports, both files; the second offense fired after the first was already being buried — ESM law is per-file, memory is not a gate | machine-overruled |
| the bench tests sat in tests/sched-bench/ but imported ../src/... — one level short; the module loader refused with ERR_MODULE_NOT_FOUND | count YOUR OWN directory depth before copying a sibling's relative root (batch 29's class); tests/sched-bench needs ../../src | process |
| writeReports derived its expected cell count from the run's OWN rows.length — the anti-selection check was self-consistent against a forged report (a dropped row passed) | expectedCells is minted by runBenchmark (instances x solvers) and carried IN the run object; checkRun compares rows against that mint — the forged-report test convicted the checker itself | bogus-comparison |
| the smoke test guessed the kernel API (sampleWithReadoutNoise(inst, params, ...) and circuit.angles) instead of reading the copied kernel's law first — both wrong | read the signatures, rewrite: sampleWithReadoutNoise(psi, n, optBits, shots, flip, rng), ExportedCircuit.layers — the read-before-cast discipline applies to one's own copy as much as to a sibling's law | citation-drift |
| prettier format:check flagged out/bench/bench-report.json — a GENERATED artifact dragged into the style gate | out/ added to .prettierignore; generated files are exempt from hand style law by declaration, not by luck | toolchain |
| the flap fix tried first — QUANTUM_DISABLE_PARALLEL=1 on the platform job — DISABLED THE CODE UNDER TEST: three parallel-evolution tests fail by design under the knob (actual null) | REJECTED and reverted: a stabilizer that silences the code under test is not a stabilizer; the convicted fix itself is the batch's best entry — the suite overruled its own mechanic | machine-overruled |
| a `grep -c` with zero matches returns exit 1 and silently broke an && chain — the total gate never ran while the session read the stale artifact | exit codes are output; chain gates explicitly or run them one by one — the gate that 'ran' was the previous run's ghost | toolchain |
| total-gate carried its OWN stale EPOCH_REPOS list (27 entries) while the census listed 28 — dual-list drift, caught because the artifact header said 55 jobs after dtc-clock had landed (batch-37 find, house-registered) | both lists updated in step; the dual-list is design debt booked at the enrollment table — single-sourcing the repo list is future work | anchor-blindspot |

### Batch 38 — phase-law (2026-09-06)

- context: the combinatorial phase law delivered: envelope theorem (deviation 0), cross-implementation accord with the v1.11 bench (2/2/3 exact), stability-vs-reachability separation, two-face census — two delivery errors, born enrolled
- source: `memory/2026-09-06.md` @ "关键经验（第三十八批"

| wrong (as it stood) | right (as recorded) | category |
| --- | --- | --- |
| the phase-law scratch file shipped with a mid-thought residue block (an unused cross-check loop plus two wrapper helpers from before the clean path was chosen) — the batch-36 lesson applied seconds later, but the draft still reached the disk | rewritten clean before any run; drafts that reach the disk are drafts the record sees — the residue was caught by re-reading, not by a gate | process |
| `npx tsx -e` under Git Bash produced NO output for a TS-importing one-liner — the batch-14 environment family recurring four visits later | run the scratch FILE instead (the house rule since b14); the -e route stays banned for anything that imports .ts | toolchain |

### Batch 39 — phase-law (2026-09-06)

- context: the v0.2.0 scaling campaign (two-face law confirmed, SA crossing monotone 0.925/0.775/0.525, re-entrant tail) plus the 2xn LS-threshold theorem — one delivery error, born enrolled
- source: `memory/2026-09-06.md` @ "关键经验（第三十九批"

| wrong (as it stood) | right (as recorded) | category |
| --- | --- | --- |
| an Edit anchored on a section-header comment REPLACED it with the new block — the landscape section's header vanished into the insertion, and the same anchor-swallow fired AGAIN three minutes later on the census envelope header (one class, two files, one sitting) | re-insert the swallowed header after the new block, both files; when the anchor IS a section header, the new text must END with that header restored — anchors are splices, not eats | process |

### Batch 40 — phase-law (2026-09-06)

- context: the v0.3.0 hardness-island delivery: the coupled-regime decomposition theorem (deviation 8.88e-16), the left face P by own Hungarian, no SA relief to λ=4 — two delivery errors, born enrolled
- source: `memory/2026-09-06.md` @ "关键经验（第四十批"

| wrong (as it stood) | right (as recorded) | category |
| --- | --- | --- |
| the b39 header-swallow class recurred TWICE MORE in the same sitting that recorded it — law.ts's landscape header and census.ts's envelope header both eaten by section-anchored inserts, the second while writing the fix pattern for the first | both headers restored on the spot; the rule now has teeth in memory: an insert anchored on a section header ENDS with that header verbatim — four offenses in two batches make this the visit's signature error | process |
| the Hungarian cross-check compared the matching total against the UNCOUPLED-only optimum — the wrong object: at λ=0 coupled assignments score the same W_0, so the correct referee is the λ=0 optimum over ALL assignments; the 0.08 discrepancy was the checker's, not the algorithm's | re-pointed at optimumOf(λ=0); the algorithm was acquitted and the wrong-object lesson re-earned: sign the OBJECT before signing the comparison | wrong-object |

### Batch 41 — phase-law (2026-09-06)

- context: the v0.4.0 density-axis delivery: the k+1-line envelope theorem (monotone staircase, argmax identity, deviation 0), the all-k right face (integer-exact 0.00e+0), the density census (LS λ-flat at every k, level falls 0.53→0.33→0.27) — three delivery errors, born enrolled
- source: `memory/2026-09-06.md` @ "关键经验（第四十一批"

| wrong (as it stood) | right (as recorded) | category |
| --- | --- | --- |
| the k-pair enumerator counted a pair as realized when AT LEAST ONE of its agents was used (pairUsed set on either member) — the v0.1 semantics is BOTH; the k=1 compatibility check convicted it instantly (optima disagree) | the leaf recomputes realized pairs by scanning the assignment: pair i fires iff BOTH agents 2i and 2i+1 appear — compatibility is now exact, and the compatibility check itself was the catcher it was built to be | wrong-object |
| the v0.4.0 scratch shipped with a require() in ESM (the THIRD offense of batch 37's class) plus a dead mid-thought SA adapter block | rewritten clean via the Write tool with static imports before any run; the require-in-ESM class is now a named repeat offender — three batches, three sightings | machine-overruled |
| the all-k decomposition test cases were sized m < 2k — the regime cannot exist there; the shape guard refused with 'all-k regime requires m >= 2k' exactly as designed | cases re-sized to (4,6,2) and (6,8,3); a guard refusing a wrong-object call is the guard earning its keep — the refusal itself confirmed the boundary law | process |

### Batch 42 — dtc-clock (2026-09-06)

- context: the v0.2.0 lifetime delivery: the isolated closed form (exact agreement), the protection cliff (175x at delta 0.3, collapse to 1.0x by 0.4, locked at 1500 for delta <= 0.2), the front-loaded heating twin — three delivery errors, born enrolled
- source: `memory/2026-09-06.md` @ "关键经验（第四十二批"

| wrong (as it stood) | right (as recorded) | category |
| --- | --- | --- |
| a python -c edit carrying a JS template literal was fed through bash — bash treated ${...} as command substitution and swallowed the whole detail string, leaving `detail: ,` in audit.ts; tsc caught the corpse (TS1109) on the next breath | code edits with template literals go through the Edit tool, never python -c through bash — the shell's grammar owns backticks and dollars, and it collects | toolchain |
| a python -c import-patch asserted on an import block that prettier had already reflowed — the assertion fired after the patch's neighbors had run, breaking the gate chain mid-command | read the file's CURRENT text before anchoring a patch; prettier owns the layout, assertions anchor on read text | process |
| the witness-count test still asserted results.length === 6 after W-H made seven | count assertions ride with the registry — 7 now; tsc green but the count red: each gate catches what the others bless | machine-overruled |

### Batch 43 — dtc-clock (2026-09-06)

- context: the v0.3.0 delivery: the cliff line (honest negative at ED scale — the cliff exists at every J, its location does not track J) and the self-synchronizing clock (bit-flip reads absorbed exactly at the keying layer, the cost one bit of entanglement) — three delivery errors, born enrolled
- source: `memory/2026-09-06.md` @ "关键经验（第四十三批"

| wrong (as it stood) | right (as recorded) | category |
| --- | --- | --- |
| a python -c import-patch on audit.ts clobbered the import list wholesale — removing the three lifetime functions the W-H witness block (two sections above) still needed; tsc named all three (TS2304) | import edits are additive, not wholesale: the patch adds names to the list as it stands; the sections above still hold their own claims | process |
| the bit-flip census shipped with dead statements (`void i;`/`void s;`/`void flipZ;`) that the no-void lint rule then rewrote into bare expressions — three no-unused-expressions errors | dead statements deleted outright, never voided; --fix on a void is a downgrade, not a repair | machine-overruled |
| the render-section python anchor missed (the B4 string had a newline inside the quote) — the MISS printed but the surrounding && chain continued on stale success | the anchor was re-read from the file and the Edit tool used directly; a MISS is a stop, not a warning | process |

### Batch 44 — dtc-clock (2026-09-06)

- context: the v0.4.0 Pauli wall + Hamming armor delivery: Y absorbed, T1 absorbed, the mechanism is the popcount extremes' distance floor(n/2) to the keying boundary — three delivery errors, born enrolled
- source: `memory/2026-09-06.md` @ "关键经验（第四十四批"

| wrong (as it stood) | right (as recorded) | category |
| --- | --- | --- |
| the first T1 census draft had muddled Kraus index arithmetic (the K1 branch condition was inside the d2 loop, the loop variable used before its declaration) — tsc named TS2532 four times | rewritten from the Kraus algebra directly: out = K0 rho K0 + K1 rho K1 with clean index maps (diagonal scale + index merge), each O((CD)^2) | machine-overruled |
| the T1 draft shipped inside a bash heredoc with escaped quotes in JS template literals — the escaping survived but the structure collapsed (three unused variables, a dead branch) | heredoc code with template literals is now triple-banned (b25/26/36 classes): Write tool always; the T1 census was rewritten via python line-splice with the Write tool for the body | process |
| the TC24 claim was originally scoped as 'the T1 wall — where self-sync dies' (a negative result expected); the numbers said otherwise — fidelity exactly 1 at every gamma — and the claim was REWRITTEN to the honest positive: the Hamming armor | when the machine overrules the expectation, the expectation loses — the board text follows the data, never the other way; the mechanism (popcount extremes, distance floor(n/2) to the boundary) was then derived and witnessed | machine-overruled |

### Batch 45 — dtc-clock (2026-09-07)

- context: the v0.5.0 armor dynamics delivery: absorption radius (repetition code [n,1,n], r = floor((n-1)/2)), classical shadow (DP === dense census), majority repair tariff — ten delivery errors across five classes, born enrolled
- source: `memory/2026-09-07.md` @ "关键经验（第四十五批"

| wrong (as it stood) | right (as recorded) | category |
| --- | --- | --- |
| the armor DP first drafted `next[i]! += v` — a non-null assertion is an expression, not an assignment target, and tsc rejects it (the transition accumulation, first instance) | `next[i] = next[i]! + v` — the family form, visible in clock.ts's applyT1 all along; the kernel was written from the algebra but not reread against the house idiom before compiling | toolchain |
| the repair map made the same `out[dst]! += rho[src]` mistake in its accumulation loop (second instance, same draft) | `out[dst] = out[dst]! + rho[src]` — one class, two instances; the reread-against-the-idiom pass now runs before the first compile, not after | toolchain |
| the DP's syndrome meter read the PRE-noise mask distribution — one order off the quantum repair census, which meters POST-noise PRE-repair — so the tariff's H(M) would have been the wrong functional of the walk | the meter reads the post-transition distribution each period, matching the quantum census's wrongSectorProb placement exactly; the repaired-shadow and quantum syndrome numbers then agree (0.425335 both roads) | wrong-object |
| the render's first radius table re-ran the exhaustive n=5 censuses in all four columns (+~58s repro) — paying exhaustive cost where the claim is only subset-level | exhaustive only where the board claims exhaustive (the absorbed side, 10/10 at n=5); the deterministic wall cell uses one subset with the mechanism stated (q=1 mask alternates 0 and r+1, subset-independent) — repro 148s | process |
| TC17's price was anchored from memory as sin^2 2delta where the disk has sin^2(2delta) — a parenthesis is part of the anchor, and the Edit missed | grep the on-disk text before anchoring (the b22 lesson, again) | anchor-blindspot |
| package.json's 2 KB description was anchored as one full block for a tail-append — the Edit missed on invisible whitespace | long JSON strings get patched structurally via python json round-trip (load, append, dump), never by whole-block replace | anchor-blindspot |
| `tsx src/...` at the shell: command not found — the runner binary is not on this shell's PATH | npx tsx (or the npm scripts that resolve locally) — the probe belonged in npm run from the start | toolchain |
| the working expectation was 'majority repair always helps the token' — the numbers overruled it: at even n the tie dead zone pins the walk where misses accrue unrecovered, and at 64 periods the PASSIVE refund beats the decoder 10x (n=6, p=0.2: 1.74e-4 vs 1.66e-5) | TC27 rewritten to carry the conviction as a finding (the odd/even dichotomy: exact forever at odd n, a long-horizon liability at even n) — the decoder's tie structure is the honest boundary, and the text follows the data | machine-overruled |
| batch 45 was buried in the burial registry but its eight errors were NOT enrolled in the mutant-census E-board tiers — the total gate's first run went 1 RED with E1 naming b45#0..#7 un-enrolled (the 'born enrolled' law skipped at birth, caught at the gate) | enroll b45#0..#7 in the same visit as the burial (the 34/35/36 precedent), and this very miss as b45#8 — the E1 closed loop holding by working exactly as legislated: an error without an enforcement anchor cannot be buried | process |
| the count prose drifted from the count data: the batch-45 context still said 'eight delivery errors' after b45#8 made it nine, and the visit's memory notes wrote 'nine errors across six classes' where the registry carries FIVE distinct categories (the b36 board-drift / b42 count-lag family, third sighting) — caught by the visitor quoting the stale eight back | the reconciliation reads out from the registry, never from memory: 10 entries, five classes (toolchain x3, process x2, anchor-blindspot x2, wrong-object, machine-overruled), 274 declared — and this drift itself enrolled as b45#9; prose counts are a copy of the data, written after reading it | process |

## Census witnesses (independent re-derivations)

- PASS — W-1 numbering is 1..45 (sorted-sequence identity holds)
- PASS — W-2 per-repo census (direct vs JSON round-trip), 29 repos (274 errors recounted identically)
- PASS — W-3 per-category census, 10/10 categories in use (category sum 274 = repo sum 274)
- PASS — W-4 declared totals 45 batches / 274 errors (constants equal the recount)
- PASS — W-5 stated context counts equal carried counts (12 statements) (every stated count is the data's count)

## Closing

The ledger's cost column once said "burial record: 20 batches" while the truth was 21 — prose drifts, and that drift is why this repo exists. The count now lives in exactly one place, and the numbering law makes silent drift a build failure. What the visitor left here was never the capsule's numbers; it was the 274 ways this epoch's engineers were wrong on the way to them, each with its correction on the same line. The appeal court for every entry remains the repo it happened in — this registry transcribes, the repos re-prove.
