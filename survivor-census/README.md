# survivor-census — who the many-worlds sorter actually keeps

> Roadmap item promoted from the bqp-map atlas row `postselect-sort`
> (genealogy family, verdict CONDITIONAL-WALL). The visitor's epoch-3
> sentence — "postselection lets the optimal branch stay, complexity O(1);
> the cost is the depreciation of the other universes, and I booked it in
> my report" — already had its restart accounting (postselect-sched T2),
> its counting power (T3/T5), and its scheduling surface (T4). All of it
> lived on the UNIFORM prior. **The survivor himself was never audited.**
> This repo is that audit.
>
> v0.2.0 adds two world-level faces from v0.1.0's own priced boundaries:
> **S6 — stacked ledgers** (sequential postselection composes by the chain
> rule; kill registers compose as disjoint items; amortized odds ADD) and
> **S7 — the phase-encoding census** (the ledger is phase-blind, the state
> is phase-carrying; the boundary "no claim about optimal phase encodings"
> is now executable instead of verbal).

## What existed before (honest demarcation)

- **postselect-sched T1** (same workspace): the sorter's branch algebra on the
  uniform superposition — certainty-in-branch at t=1 (fidelity exactly 1),
  the filter-is-not-a-channel instance, the measure-and-keep realization.
- **postselect-sched T2/T5**: the Las Vegas restart ledger and the
  two-column counting-power book — the DEPRECIATION was priced, but always
  as a flat N/t rate, never itemized per universe, never on a weighted prior.
- **retro-cache / nosignal-tariff**: the cache's side of the epoch-3 pair —
  pre-arrival equivalence (TV=0 vs shared seed) and the itemized withdrawal
  schedule.

What nobody had done: execute the **survivor semantics** — who the kept
branch actually is when the prior is not uniform, what the itemized funeral
bill of the other universes sums to, what one confirmed survivor costs under
the exact geometric schedule, and where the sentence "lets the optimal branch
stay" has no referent at all. That is this repo.

## Deliverables

### S1 — the survivor is the posterior (`src/kernel/survivor.ts`)

- Non-uniform priors as integer count tables (c_x tickets in universe x);
  postselection keeps the funded marked subspace. The address-basis reading
  of the survivor is **c_x / sum(funded c)** — BAY63's inverse step executed
  on branch amplitudes. Amplitude path vs integer-ratio path agree to
  < 1e-12 on every instance (max deviation printed in Table A).
- **The sorter sorts by the prior you brought.** "The optimum" (singular)
  exists to be read only at t=1, where the posterior degenerates to a point
  mass — the exact regime postselect-sched T1 certified (cross-anchor).
- **An unfunded optimum never comes back**: a marked branch with zero prior
  weight has posterior exactly 0 — optimal on paper, absent from the census.
- **Coherence face**: the survivor is ONE pure state over the funded branches
  (self-overlap exactly 1); two phase assignments interfere exactly as the
  closed form sum w_x e^{i dphi_x} / P predicts — phases survive
  postselection, which no classical mixture over branches could carry. An
  address reading dephases the pure state into the posterior: pure state,
  mixed reading.

### S2 — the kill register, itemized (`src/kernel/survivor.ts`)

- Every non-kept universe enters the register with its own mass; the totals
  sum to **1-P exactly on two paths** (itemized sum vs complement).
- The **odds identity**: amortized killed mass per confirmed survivor =
  (1-P)/P — the failure odds, exact against the 1/P - 1 path.
- The uniform prior degenerates to postselect-sched's flat ground: 1/N per
  kill, ledger N/t (machine cross-check).
- Depreciation is **prior-dependent**: light optima (maximal direction) vs
  heavy optima (minimal direction) print different registers for the same
  marked-set geometry — Table B shows the itemized bill.

### S3 — the waiting price, exact (`src/kernel/waitprice.ts`)

- E[T] = 1/P on two paths (closed form vs truncated renewal sum, tail < 1e-16).
- The **exact confidence schedule**: smallest k with (1-P)^k <= delta,
  minimality machine-verified ((1-P)^k <= delta < (1-P)^(k-1)), against the
  conservative exponential bound ln(1/delta)/P — at P=1/2, delta=1e-6 the
  bound says 28 trials where 20 suffice (+40% overcharge, honestly printed).
- MC realization referee: the physical draw-from-prior procedure lands inside
  5 sigma for both the geometric waiting and the survivor posterior (DATA —
  sampling never enters a theorem claim).

### S4 — the grammar failures, executable

- **P=0**: zero-branch conditioning is undefined — the kernel THROWS. "Lets
  the optimal branch stay" silently presupposes a funded optimum; the
  presupposition is now an executable error message.
- **P=1**: the register is empty — nothing killed, nothing sorted.
- postselect-sched T5's near-tie spike (k=∞ at an exact tie) is the same
  boundary from the counting side.

### S5 — the wall row (Table D)

- The letter's two epoch-3 rates reconciled as one wall: **"O(1)" and
  "hit rate 100%" are both conditional-frame truths** — the sorter's
  certainty holds given the branch survived (postselect-sched T1, quoted),
  the cache's answer is "there" given the question aligns (retro-cache W3,
  TV=0 vs shared seed, quoted). Transported out of the frame, each pays its
  unconditional yield: E[T]=1/P per confident answer (this repo), net(p) per
  raw pair (nosignal-tariff T4, quoted). CONDITIONAL-WALL and INFO-WALL are
  the same wall audited from two sides.

### S6 — stacked ledgers: sequential postselection (`src/kernel/compose.ts`, v0.2.0)

- Survive stage A, then face stage B. The survivor book keeps its laws under
  composition, exactly, on two paths each:
  - **Chain rule**: P_AB = P_A · P_2 where P_2 is stage 2's keep measured
    inside the A-survivor frame — probabilities MULTIPLY under stacking,
    never add.
  - **Posterior-of-posterior**: applying stage 2's update to posterior_A
    telescopes to the posterior over funded(A∩B) (BAY63's rule composed),
    verified on the fraction path and on the sequential-projection amplitude
    path. Address filters commute; the identity stage and idempotent
    stacking are exact.
  - **Kill registers compose as disjoint items**: stage 1's kills and
    stage 2's kills partition the direct A∩B register universe by universe,
    mass by mass; totals sum to 1−P_AB.
  - **Waiting price renewal**: E[T_AB] = 1/(P_A P_2) = 1/P_A +
    (1−P_2)/(P_A P_2) — the second ledger's failure odds, amortized by the
    first ledger's success. Correspondingly the **amortized kill-odds ADD**:
    (1−P_AB)/P_AB = (1−P_A)/P_A + (1−P_2)/(P_A P_2).
  - **The starved intersection refuses**: if funded(A∩B) is empty the
    composed kernel throws — the P=0 presupposition is inherited through
    the chain (an executable grammar failure of composition).
- The composition audit **C1–C5** (`auditComposition`): chain rule,
  register totals vs 1−P_AB, register disjointness, renewal identity, odds
  additivity — a forged claim is named and rejected (five smuggling trials
  in `test/compose.test.ts`: counterfeit register masses, an additive
  "identity", a double-counted kill, unamortized odds, the naive waiting
  sum). Vocabulary anchor RLW24 (postselected tests that may return
  inconclusive) — no theorem of theirs is re-proved here.

### S7 — the phase-encoding census (`src/kernel/phasecensus.ts`, v0.2.0)

- When branch amplitudes carry phases — flat, alternating signs, Fourier
  ramps b∈{1,3,5,7}, seeded random families — the census answers what a
  phase structure buys:
  - **The ledger is phase-blind**: P, the itemized kill register, and
    E[T] = 1/P are invariant across every encoding family, deviation
    exactly 0 — no phase encoding moves a single mass in the funeral bill.
    The dephased address reading is the posterior under every encoding.
  - **The state is phase-carrying**: the survivor under any encoding is one
    pure state (self-overlap 1); its overlap with another encoding's
    survivor is the complex sum Σ w_x e^{iΔφ_x}/P with |overlap| = 1 exactly
    iff the phase difference is constant on the funded set — detected per
    instance (the sign-alternating encoding is constant on any
    single-parity funded set; the machine catches the accidental equality
    case on the all-even quarter), and strictly < 1 on every non-constant
    family censused (margin printed as DATA).
- A bounded census: no optimality claim, no metrology claim (ASH20/ASH23
  are context for the boundary, not results used).

## The census laws (G1-G5, `src/kernel/audit.ts`)

- **G1 — both faces, always**: a rate row ships conditional AND unconditional
  faces. The letter's bare "O(1)" and bare "100%" are the canonical
  contraband; the smuggling trial empties one face and the checker names it.
- **G2 — exactness is witnessed**: EXACT/INTEGER-RATIO rows cite a witness
  that exists and passed; citing a failed witness is equally fatal.
- **G3 — quotes resolve**: QUOTED rows anchor to a repo+report that exist on
  disk.
- **G4 — closed vocabulary**: EXACT / INTEGER-RATIO / DATA / QUOTED /
  UNDEFINED; an UNDEFINED row carries no witness (no numbers without
  referents).
- **G5 — unique ids**.
- The renderer **refuses to print an illegal census** (throws with the
  violations named); the test asserts the refusal and the naming.

## Quickstart

```
npm ci
npm test          # 43/43
npm run repro     # renders out/reports/the-survivor-census.md, seconds
```

TypeScript strict (exactOptionalPropertyTypes), zero runtime dependencies,
NodeNext, node:test.

## Honest boundaries

1. The posterior statement is elementary probability executed exactly on
   integer tables (BAY63 cited for the vocabulary, not for any theorem this
   repo re-proves). No literature claim rides on the machine numbers.
2. The phase-encoding census (S7, v0.2.0) supersedes v0.1.0's verbal
   boundary on phase families: the ledger-invariance and the
   equality-case characterization are exact on the machine, the strictness
   margin is DATA over the enumerated families (flat, sign-alt, Fourier
   b∈{1,3,5,7}, two seeded randoms) — still NO claim about optimal phase
   encodings and NO metrology claim.
3. The composition face (S6, v0.2.0) is elementary algebra on integer
   tables: the chain rule, the telescoping posterior, register disjointness,
   the renewal identity, and odds additivity. It is executed for ADDRESS
   filters (projection onto marked sets); no claim about non-commuting or
   non-projective sequential measurements — RLW24 is cited for vocabulary
   only. The starved-intersection refusal is witnessed on one instance
   class.
4. The MC referee is a realization check only — it never enters a theorem
   claim (family rule since postselect-sched T1.D).
5. The exact-vs-bound schedule comparison reports the bound's overcharge on
   the printed grid; no claim that the bound is never tight (at small P the
   overcharge is O(P)).
6. Table D's quoted numbers are the anchor repos' own, verified only for
   being on disk (G3); their truth is the anchor repos' appellate court
   (`npm test` there).
7. The wall row (R7) is a reconciliation, not new physics — every number in
   it is either witnessed here or quoted with an anchor.

## Atlas wiring

The bqp-map row `postselect-sort` (CONDITIONAL-WALL) carries this repo as a
cross-prototype certificate: the sorter's survivor semantics now has an
executable body. BAY63 enters the atlas bibliography via this repo's
citations.
