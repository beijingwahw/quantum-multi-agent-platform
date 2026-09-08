# The Survivor Census — who the many-worlds sorter actually keeps

> The visitor's sentence: 'postselection lets the optimal branch stay, complexity
> O(1) — the cost is the depreciation of the other universes, and I booked it in
> my report.' The restart accounting, the counting power and the scheduling surface
> all lived on the uniform prior (postselect-sched T1-T5). The survivor himself was
> never audited. This is that audit: the survivor is the POSTERIOR over optima
> weighted by the prior you brought (BAY63's inverse step, executed on branch
> amplitudes); the kill register is itemized per universe and sums to 1-P exactly;
> the waiting price is geometric with an exact schedule; and the boundaries are
> executable — no funded optimum, no census. v0.2.0 adds two faces: stacked
> ledgers compose by the chain rule with additive amortized odds (Table E), and
> the phase-encoding census — the ledger is phase-blind, the state is
> phase-carrying (Table F).

## Table A — the instance family (n=4, integer priors)

| instance | t (raw/funded) | P (amp path) | P (integer) | posterior 2-path dev | off-marked leak | killed (register) | killed (1-P) | odds/survivor |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| t1-fund | 1/1 | 0.0500000000000 | 0.0500000000000 | 0.00e+0 | 0 | 0.950000000000 | 0.950000000000 | 19.00000000 |
| light-optima | 3/3 | 0.0500000000000 | 0.0500000000000 | 0.00e+0 | 0 | 0.950000000000 | 0.950000000000 | 19.00000000 |
| heavy-optima | 3/3 | 0.350000000000 | 0.350000000000 | 0.00e+0 | 0 | 0.650000000000 | 0.650000000000 | 1.857142857 |
| quarter-funded | 4/4 | 0.200000000000 | 0.200000000000 | 5.55e-17 | 0 | 0.800000000000 | 0.800000000000 | 4.000000000 |
| unfunded-optimum | 4/3 | 0.186440677966 | 0.186440677966 | 1.11e-16 | 0 | 0.813559322034 | 0.813559322034 | 4.363636364 |
| uniform-prior | 4/4 | 0.250000000000 | 0.250000000000 | 0.00e+0 | 0 | 0.750000000000 | 0.750000000000 | 3.000000000 |
| full-funding | 16/16 | 1.00000000000 | 1.00000000000 | 1.39e-17 | 0 | 0.00000000000 | -2.22044604925e-16 | -2.220446049e-16 |

Max posterior two-path deviation: **1.110e-16**; max kill-complement deviation: **2.220e-16**; max odds-identity deviation: **3.553e-15**.

## Table B — the kill register, itemized (light-optima: the optimum is the least-funded branch)

| killed universe x | prior mass w_x |
| --- | --- |
| 2 | 3/60 (0.05000000000) |
| 3 | 7/60 (0.1166666667) |
| 4 | 4/60 (0.06666666667) |
| 5 | 7/60 (0.1166666667) |
| 7 | 7/60 (0.1166666667) |
| 8 | 2/60 (0.03333333333) |
| 9 | 3/60 (0.05000000000) |
| 10 | 2/60 (0.03333333333) |
| 11 | 5/60 (0.08333333333) |
| 12 | 5/60 (0.08333333333) |
| 13 | 5/60 (0.08333333333) |
| 14 | 3/60 (0.05000000000) |
| 15 | 4/60 (0.06666666667) |
| **total** | **0.950000000000** (register) = **0.950000000000** (1-P) |

Uniform-prior cross-check: the flat register degenerates to 1/N per kill and the ledger to N/t — postselect-sched's home ground (deviation 0.000e+0).

## Table C — the waiting price (exact schedule vs the conservative bound)

| P | E[T] = 1/P | partial-sum path | dev | k(1e-6) exact | k(1e-6) bound | overcharge |
| --- | --- | --- | --- | --- | --- | --- |
| 0.500000 | 2.00000000000 | 2.00000000000 | 0.00e+0 | 20 | 28 | +40.0% |
| 0.250000 | 4.00000000000 | 4.00000000000 | 0.00e+0 | 49 | 56 | +14.3% |
| 0.100000 | 10.0000000000 | 10.0000000000 | 0.00e+0 | 132 | 139 | +5.3% |
| 0.000976563 | 1024.00000000 | 1024.00000000 | 0.00e+0 | 14141 | 14148 | +0.0% |
| 9.53674e-7 | 1048576.00000 | 1048576.00000 | 0.00e+0 | 14486606 | 14486613 | +0.0% |

All schedules minimal on the grid: **true**; the bound never undercharges (min overcharge 0.00%). MC realization referee: waiting 0.56 sigma, survivor posterior 1.17 sigma (DATA, not theorem).

## Table D — the census (every rate carries both faces)

| id | claim | label | conditional face | unconditional face | witness/anchor |
| --- | --- | --- | --- | --- | --- | --- |
| R1 | 'postselection lets the optimal branch stay' — the survivor's identity | INTEGER-RATIO | the kept branch is clean: zero amplitude outside the funded marked set, exactly | the survivor is the POSTERIOR over optima weighted by the prior you brought (c_x / sum of funded c); 'the' optimum exists only at t=1 — the sorter sorts by the prior, and an unfunded optimum never comes back | W-A |
| R2 | 'complexity O(1)' — the sorter's speed | EXACT | inside the survived frame: one coherent pass, zero repetitions, the readout is deterministic | outside the frame: waiting time to first survivor is geometric, E[T] = 1/P exactly; at P = 2^-20 the expected wait is 1,048,576 trials | W-F |
| R3 | 'the cost is the depreciation of the other universes' — the register | EXACT | the register is itemized per universe: each killed branch with its own mass | the register sums to 1-P exactly (two paths); amortized killed mass per confirmed survivor is (1-P)/P — the failure odds; the uniform prior degenerates to postselect-sched's flat 1/N ledger | W-C |
| R4 | the coherence face — branches stay phases, not just masses | EXACT | the survivor is ONE pure state over the funded branches: relative phases survive postselection | an address reading dephases it into the posterior — pure state, mixed reading; the interference (phase-overlap vs closed form) is what a classical mixture over branches cannot carry | W-E |
| R5 | sorter certainty at t=1 (cross-anchor) | QUOTED | postselect-sched T1: conditional address is EXACTLY \|x*> at t=1, fidelity 1.000000000000 (n=4..14) | this repo W-A: the posterior degenerates to a point mass at t=1 — same fact from the prior side; the point-mass regime is the only one where the singular 'the optimal branch' is honest | postselect-sched/out/reports/t1-sorter.md |
| R6 | the cache's 'hit rate 100%' (cross-anchor) | QUOTED | retro-cache W3: pre-arrival, the cache state is indistinguishable from a shared random seed (TV = 0.000000000000000) — the answer is 'there' only relative to the question that later aligns | nosignal-tariff T4: net(p) = (1 - h2((1-p)/2))/2 — 0.5 clean, 0.094360938 at p=0.5, exactly 0 at the seed floor p=0; the unconditional yield per raw pair is the withdrawal schedule | retro-cache/out/reports/w3-equivalence.md |
| R7 | the wall row — one wall, two audits | DATA | 'O(1)' and 'hit rate 100%' are both TRUE in the survived/aligned frame — neither is a lie | transported out of its frame each claim pays its yield: the sorter P per trial (E[T] = 1/P), the cache net(p) per raw pair — CONDITIONAL-WALL and INFO-WALL are the same wall audited from two sides | — |
| R8 | the grammar failures — where the sentence has no referent | EXACT | P=0: zero-branch conditioning is UNDEFINED — the sorter has no output face; P=1: the register is empty, nothing was sorted | 'lets the optimal branch stay' presupposes a FUNDED optimum (existence presupposition, executable as a thrown error); no finite price buys an event of probability zero | W-I |
| R9 | stacked ledgers — sequential postselection composes by the chain rule, never additively | EXACT | survive stage A, then stage B: the posterior-of-posterior is exactly the posterior over funded(A∩B) (BAY63 telescoped; verified on fraction and sequential-projection paths); address filters commute, identity and idempotent stages are exact | the composed price multiplies: P_AB = P_A*P_2, E[T_AB] = 1/(P_A P_2) with the renewal decomposition 1/P_A + (1-P_2)/(P_A P_2); the amortized kill-odds ADD, (1-P_AB)/P_AB = (1-P_A)/P_A + (1-P_2)/(P_A P_2); staged kill registers are disjoint items summing to 1-P_AB; a starved intersection refuses (P=0 inherited through the chain) | W-J |
| R10 | the phase-encoding census — what a phase structure buys | EXACT | the survivor under ANY encoding (flat, sign-alternating, Fourier ramps, seeded random) is one pure state over the funded branches: self-overlap 1, |overlap| = 1 exactly iff the phase difference is constant on the funded set | the LEDGER is phase-blind: P, the itemized kill register, and E[T] = 1/P are invariant across every encoding censused, deviation exactly 0 — no phase encoding moves a single mass in the funeral bill; the interference lives only in the state's coherent overlaps (bounded census, no optimality or metrology claim) | W-K |

## Table E — stacked ledgers: sequential postselection (S6, v0.2.0)

| pair | P_A | P_2 (in A-frame) | P_AB direct | chain dev | register dev | sum dev | E[T] renewal dev | odds dev | order dev |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| overlap-3of4 | 0.2000000000 | 0.9166666667 | 0.1833333333 | 0.00e+0 | 0.00e+0 | 2.22e-16 | 8.88e-16 | 8.88e-16 | 0.00e+0 |
| shrink-inside | 0.3833333333 | 0.6086956522 | 0.2333333333 | 5.55e-17 | 0.00e+0 | 0.00e+0 | 8.88e-16 | 8.88e-16 | 0.00e+0 |
| identity-stage | 0.2000000000 | 1.000000000 | 0.2000000000 | 2.78e-17 | 0.00e+0 | 1.11e-16 | 8.88e-16 | 8.88e-16 | 0.00e+0 |
| idempotent | 0.2000000000 | 1.000000000 | 0.2000000000 | 2.78e-17 | 0.00e+0 | 1.11e-16 | 8.88e-16 | 8.88e-16 | 0.00e+0 |

Chain rule P_AB = P_A*P_2 max dev **1.110e-16**; posterior composition **1.110e-16**; sequential-projection amplitude path **1.110e-16**; amortized odds ADD with max dev **8.882e-16**; identity stage exact: **true**; idempotent: **true**; starved intersection refuses: **true**; the stacked ledgers' own audit (C1-C5) violations: **0**.

## Table F — the phase-encoding census: the ledger is phase-blind, the state is phase-carrying (S7, v0.2.0)

| encoding family | P | P dev vs flat | register dev | E[T] dev | dephased reading dev | |<survivor\|flat survivor>| |
| --- | --- | --- | --- | --- | --- | --- |
| flat (the reference encoding — no phases) | 0.2000000000 | 0 | 0 | 0 | 5.55e-17 | 1.00000000000 |
| sign-alt (alternating signs pi*(x mod 2) — constant on every single-parity funded set) | 0.2000000000 | 0 | 0 | 0 | 5.55e-17 | 1.00000000000 |
| fourier-b1 (full-cycle Fourier ramp 2*pi*1*x/N (gcd(1,16)=1)) | 0.2000000000 | 0 | 0 | 0 | 5.55e-17 | 0.117851130198 |
| fourier-b3 (full-cycle Fourier ramp 2*pi*3*x/N (gcd(3,16)=1)) | 0.2000000000 | 0 | 0 | 0 | 5.55e-17 | 0.117851130198 |
| fourier-b5 (full-cycle Fourier ramp 2*pi*5*x/N (gcd(5,16)=1)) | 0.2000000000 | 0 | 0 | 0 | 5.55e-17 | 0.117851130198 |
| fourier-b7 (full-cycle Fourier ramp 2*pi*7*x/N (gcd(7,16)=1)) | 0.2000000000 | 0 | 0 | 0 | 5.55e-17 | 0.117851130198 |
| random-s101 (seeded uniform phases (reproducible)) | 0.2000000000 | 0 | 0 | 0 | 5.55e-17 | 0.426170958863 |
| random-s103 (seeded uniform phases (reproducible)) | 0.2000000000 | 0 | 0 | 0 | 5.55e-17 | 0.780251791455 |
| ramp3+const (fourier-b3 plus a constant pi/9 — differs from fourier-b3 by a CONSTANT (the equality case)) | 0.2000000000 | 0 | 0 | 0 | 5.55e-17 | 0.117851130198 |

Ledger phase-blindness (max over families of P/register/E[T] deviation): **0** — exactly zero, no encoding moves a mass in the bill; dephased reading = posterior under every encoding (max dev **5.551e-17**). Self-overlap dev **1.110e-16**. Equality case (constant phase difference on the funded set — fourier-b3 vs ramp3+const, and sign-alt on this all-even marked set, detected per instance): |overlap| = 1 within **1.110e-16**. Strictness margin on the censused non-constant families: **2.197e-1** (DATA over the enumerated families — a bounded census, not a theorem over all encodings).

## Witnesses

- PASS — W-A: survivor = posterior: amplitude path vs integer-ratio path (c_x / sum kept c), all instances (max deviation 1.110e-16)
- PASS — W-B: zero amplitude outside the funded marked set after conditioning (all instances) (max leak 0)
- PASS — W-C: kill register totals: sum of itemized masses vs 1-P complement (all instances); uniform prior degenerates to the flat 1/N register of postselect-sched's uniform ground (complement dev 2.220e-16, uniform-flat dev 0.000e+0)
- PASS — W-D: odds identity: (1-P)/P vs 1/P - 1, all instances (max deviation 3.553e-15)
- PASS — W-E: coherence kept: survivor overlap under two phase assignments, amplitude path vs closed form; self-overlap exactly 1 (overlap dev 1.110e-16, self-overlap 1.000000000000000)
- PASS — W-F: waiting price E[T] = 1/P: closed form vs closed-form partial sum (analytic tail < 1e-12 of the mean), instance P-grid plus anchors 1/2, 2^-10, 2^-20; loop referee at moderate P (max deviation 0.000e+0)
- PASS — W-G: exact schedule minimality ((1-P)^k <= delta < (1-P)^(k-1)) on the (P, delta) grid, exp-log vs pow cross-path; bound overcharge never negative (all minimal: true, min overcharge 0.0000)
- PASS — W-H: realization referee: physical draw-from-prior procedure lands inside 5 sigma for both the geometric waiting and the survivor posterior (DATA, never a theorem claim) (waiting 0.56 sigma, survivor 1.17 sigma)
- PASS — W-I: boundaries executable: P=0 conditioning refuses (thrown error), P=1 register empty, unfunded optimum marked-but-never-returns, t=1 posterior is a point mass (p0Refused=true, p1Empty=true, unfundedNeverReturn=true, t1PointMass=true)
- PASS — W-J: composition laws, exact: chain rule P_AB = P_A*P_2; posterior-of-posterior = posterior over funded(A∩B) on fraction AND sequential-projection amplitude paths; staged kill registers disjoint, union = direct register, sum = 1-P_AB; E[T_AB] = 1/(P_A P_2) = 1/P_A + (1-P_2)/(P_A P_2); amortized odds ADD; order-irrelevant; identity and idempotent stages; starved intersection refuses; own audit C1-C5 clean (chain 1.110e-16, posterior 1.110e-16, survivor 1.110e-16, register 0.000e+0, sum 2.220e-16, wait-chain 8.882e-16, wait-renewal 8.882e-16, odds 8.882e-16, order 0.000e+0, identity=true, idempotent=true, starved-refused=true, audit-violations=0)
- PASS — W-K: phase-encoding census: the LEDGER is phase-blind (P, itemized register, E[T] invariant across flat/sign-alt/fourier/random families, deviation exactly 0; dephased reading = posterior under every encoding on the standard two-path float dev); the STATE is phase-carrying (self-overlap 1 under every encoding; |overlap| = 1 exactly for constant phase differences — detected per funded set — and strictly < 1 on every non-constant family censused) (ledger phase-blindness dev 0, dephased reading dev 5.551e-17, self-overlap dev 1.110e-16, equality-case dev 1.110e-16, strictness margin 2.197e-1 (DATA over the enumerated families))

## The grammar failures (executable)

- **P=0**: the kernel refuses zero-branch conditioning (thrown error: 'undefined') — refusal witnessed: true.
- **P=1**: empty register, nothing sorted — witnessed: true.
- **unfunded optimum**: marked but zero prior weight — never returns, posterior exactly 0 there — witnessed: true.
- **t=1**: the posterior is a point mass — the only regime where the singular 'the optimal branch' is honest — witnessed: true.

