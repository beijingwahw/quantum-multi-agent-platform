# postselect-sched — the many-worlds sorter as a schedulable primitive

> Roadmap item promoted from the bqp-map atlas row `postselect-sort`
> (genealogy family, verdict CONDITIONAL-WALL). The visitor's claim —
> "postselection reads the optimum in O(1); the cost is the depreciation of
> the other universes, and I booked it" — had its certificate layer
> (machine-postselect in bqp-map exp6). This repo is the theorem layer that
> certificate pointed past: **the depreciation ledger is a Las Vegas restart
> strategy, and restart theory (LSZ93) executes on it exactly.**

## What existed before (honest demarcation)

- **PostBQP = PP** (AAR04) — pen and paper, class level.
- **Restart theory** (Luby–Sinclair–Zuckerman 1993): optimal fixed cutoff, no
  mixed/probabilistic strategy beats it, universal doubling within
  (19/2)·λ·(log₂λ+5) — pen and paper, classical.
- **Heralded postselection** — the daily bread of experimental quantum optics
  and entanglement distribution; engineering, not theorem layer.
- **bqp-map exp6** (same workspace): the sorter's certainty-in-branch, the
  ledger 1/P = N/t, and the counting-ratio readout as a machine certificate.

What nobody had done: execute the **restart-scheduling theorem layer** on the
postselection ledger — no-beating verified by exhaustive enumeration, the
convex-combination identity (LSZ93 eq. 7) on a third arithmetic path, the
universal-doubling robustness trade on the sorter's own success curve, a
precise threshold law for when pure postselection is restart-optimal, and the
scheduling statement of when postselection is a *free* resource. That is this
repo.

## Deliverables

### T1 — sorter branch algebra (`src/kernel/sorter.ts`)

- Certainty-in-branch: one oracle query, postselect the flag; at t = 1 the
  conditional address state is EXACTLY |x*⟩ (fidelity 1.000000000000,
  n = 4..14; zero amplitude outside the marked set).
- The branch is a clean conditional sample: any payload bit read in-branch
  carries the integer ratio |{g ∧ h}|/|{g}| (amplitude path = integer
  referee, float zero deviation).
- **The filter is not a channel**: conditioning a mixture is affine only in
  the branch-weighted sense — concrete instance with trace distance exactly
  1/6; Kraus completeness {Π₀, Π₁} at 1e-15; the measure-and-keep realization
  reproduces the conditional statistics (Monte Carlo, both statistics inside
  5σ).

### T2 — restart algebra, the amortization-rate theorem layer (`src/kernel/restart.ts`)

- Two-path identity: LSZ λ(t) = E[min(T,t)]/q(t) (written in the deficit form
  (t − Σ_{u<t}(t−u)p(u))/q(t)) vs the renewal-sum accumulation form —
  float-zero agreement on all families. Note: the author-preprint PDF's
  formula for λ(t) OCR'd sign-garbled (it violated the paper's own λ ≤ L
  lemma); the executed definition is the direct renewal semantics, caught by
  the exhaustive no-beating referee before shipping.
- **No-beating, exhaustive**: every cyclic cutoff strategy over the menu
  lands at or above λ*; the best fixed cutoff attains it (LSZ93 Thm 3's
  conclusion, machine-checked by enumeration).
- **Convex-combination identity** (LSZ93 eq. 7): T(S) = Σ gᵢ λ(tᵢ), gᵢ ≥ 0,
  Σ gᵢ = 1 on a third arithmetic path — the algebraic root of no-beating.
- **Universal doubling** (LSZ93 Thm 5 shape): S_univ stays far inside the
  (19/2)λ*(log₂λ*+5) bound on geometric / power-law / bimodal families
  (executed as a finite prefix + cycle; the theorem is about the infinite
  sequence — noted in the report).
- **Grover curves two-path**: closed form sin²((2k+1)θ) vs iterated 2×2
  rotation, 1e-12 across the grid.
- **The threshold law** (new, sharp): the pure sorter (k = 0) is
  restart-optimal **iff t/N ≥ c\***, with the binding constraint at k = 1:
  c* → (3−√2)/4 ≈ 0.3964 — sin²(3θ) > 2 sin²(θ) exactly below it. Above the
  threshold the visitor's sorter is, by the ledger's own standard, the
  optimal restart strategy; below it, amplify-then-postselect strictly
  dominates. The ledger/E* ratio grows ~√(N/t) (bqp-map exp6's table, now
  with the exact reason).
- **Always-pay model**: mid-circuit rounds cannot be inspected without
  destroying the amplification, so the full cutoff price is paid — and the
  cheapest single round type is still unbeatable by any cyclic schedule
  (enumerated; LSZ's L-function argument, machine-checked).
- Side observation: the classical first-mark law (restart gains nothing,
  λ* = no-restart mean) — the machinery reports the honest no-gain.

### T3 — counting power in-branch (`src/experiments/exp-t3-counting.ts`)

- Every branch outcome probability is an exact integer ratio — the readout
  evaluates #P-function fractions (the executable face of PostBQP = PP;
  the class equality itself is cited, not re-proven).
- Odd denominators: gap ≥ 1/(2m) integer separation from 1/2; one postselected
  readout decides the majority sign with error exactly 1/2 − gap; branch
  decision = integer referee decision on every instance.
- Two readouts in-branch form a full conditional simplex (4 cells, each an
  integer ratio, sum exactly 1).

### T5 — the two-column ledger for counting power (`src/kernel/ppledger.ts`)

The countersigned audit said the report printed one column; this prints both.
Machine: real random 3-SAT instances, flag g = "x satisfies phi", readout
h = "x_0 = 1" — the branch decides the PP-style threshold question "among the
models, do more than half set x_0 = 1?".

- Power column: branch ratio = integer ratio both/m (float-zero deviation,
  n = 10..12); integer separation |2·both − m| ≥ 1 pins gap ≥ 1/(2m) off
  exact ties; single-shot error exactly 1/2 − gap; the free-variable
  construction (x_0 absent from every clause) is an EXACT tie — error exactly
  1/2, and no finite price buys a decision (k = ∞).
- Depreciation column: k(δ) = smallest odd k with exp(−2k·gap²) ≤ δ
  (HOE63); the exact binomial vote-error P[Bin(k, ½+gap) ≤ k/2] never
  exceeds δ nor its own Hoeffding bound; total expected queries = k·N/m
  exactly. Confidence costs ln(1/δ)/(2·gap²) branch samples at N/m queries
  each — the exchange rate of postselected counting power, machine-metered,
  including the near-tie price spike at the integer-separation floor.

### T4 — the scheduling contact surface (`src/experiments/exp-t4-contact.ts`)

- **The freeness law**: active postselection and heralded loss wait under the
  SAME geometric law (identical round statistics, both within σ of 1/q) — only
  the cost column differs. The query ledger 1/q is charged exactly when the
  algorithm must do the rejecting itself. *Postselection is a free resource
  exactly when the hardware already heralds the same branches.* This is the
  ent-sched regime (heralded swap/purification attempts are many-worlds
  sorters whose ledger is paid in wall-clock rounds, not oracle queries —
  cross-prototype pointer, parameters illustrative).
- **Online depth-doubling**: when the marked count t is unknown, cycling the
  doubling-depth schedule costs a small constant factor over the
  oracle-informed optimum (worst ratio measured on the N = 256 grid < 10,
  typically ~2–5) — the LSZ robustness trade executed on the sorter's own
  success curve.

## Quickstart

```
npm ci
npm test          # 22/22
npm run repro     # rebuilds out/reports/t1..t5 markdown tables, seconds
```

TypeScript strict (exactOptionalPropertyTypes), zero runtime dependencies,
NodeNext, node:test.

## Honest boundaries

1. PostBQP = PP and the LSZ93 theorems are **cited**, not re-proven. What the
   machine verifies: the cost identities, the no-beating conclusion on
   enumerated finite strategy spaces, the convex decomposition, the empirical
   universal-bound witnesses, the threshold law at finite N. The infinite-
   strategy-space statements ride on the citations.
2. The universal-sequence check runs a finite prefix (cutoffs ≤ 16) cycled —
   LSZ's theorem is about the infinite sequence; the report says so where it
   matters.
3. The always-pay no-beating lemma is machine-checked by exhaustive
   enumeration over cyclic schedules of depth ≤ 3 on small menus — a witness,
   not a proof over all schedules.
4. The heralded-freeness statement is a model statement: it compares two cost
   accountings of the same geometric acceptance law. It does not claim any
   hardware implements heralded rejection for free — only that WHEN the
   environment already rejects those branches, the sorter's query ledger is
   not the right accounting (ent-sched's rounds are).
5. Monte Carlo appears only as a realization referee (T1.D, T4) — never inside
   a theorem claim. All theorem numbers are exact algebra with independent
   second paths.
6. The threshold law's asymptotic constant (3−√2)/4 is derived from the k = 1
   constraint (closed form in the source); the machine reports the finite-N
   thresholds (0.3984 at N=256, 0.396484 for N ≥ 1024), approaching the limit
   0.3964466 from above. The claim "k = 1 is the binding constraint
   asymptotically" is verified on the grid, not proved for all N.
7. T5's concentration scheduling uses the classical Hoeffding inequality
   (HOE63, cited) — applied, not proved. The exact binomial tails are computed
   to machine precision and never exceed the bound; the k(δ) schedule is the
   bound's, which is conservative (a deterministic readout like the both=0
   row of table A needs k=1, not the scheduled k).

## Atlas wiring

The bqp-map row `postselect-sort` (CONDITIONAL-WALL) carries this repo as a
cross-prototype certificate: the depreciation ledger is now not just measured
but placed inside executed restart theory. LSZ93 enters the atlas bibliography.
