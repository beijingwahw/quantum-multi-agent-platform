# survivor-census — who the many-worlds sorter actually keeps

> Roadmap item promoted from the bqp-map atlas row `postselect-sort`
> (genealogy family, verdict CONDITIONAL-WALL). The visitor's epoch-3
> sentence — "postselection lets the optimal branch stay, complexity O(1);
> the cost is the depreciation of the other universes, and I booked it in
> my report" — already had its restart accounting (postselect-sched T2),
> its counting power (T3/T5), and its scheduling surface (T4). All of it
> lived on the UNIFORM prior. **The survivor himself was never audited.**
> This repo is that audit.

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
npm test          # 24/24
npm run repro     # renders out/reports/the-survivor-census.md, seconds
```

TypeScript strict (exactOptionalPropertyTypes), zero runtime dependencies,
NodeNext, node:test.

## Honest boundaries

1. The posterior statement is elementary probability executed exactly on
   integer tables (BAY63 cited for the vocabulary, not for any theorem this
   repo re-proves). No literature claim rides on the machine numbers.
2. The coherence face is witnessed on real-amplitude phase families; no
   claim about optimal phase encodings or metrology is made.
3. The MC referee is a realization check only — it never enters a theorem
   claim (family rule since postselect-sched T1.D).
4. The exact-vs-bound schedule comparison reports the bound's overcharge on
   the printed grid; no claim that the bound is never tight (at small P the
   overcharge is O(P)).
5. Table D's quoted numbers are the anchor repos' own, verified only for
   being on disk (G3); their truth is the anchor repos' appellate court
   (`npm test` there).
6. The wall row (R7) is a reconciliation, not new physics — every number in
   it is either witnessed here or quoted with an anchor.

## Atlas wiring

The bqp-map row `postselect-sort` (CONDITIONAL-WALL) carries this repo as a
cross-prototype certificate: the sorter's survivor semantics now has an
executable body. BAY63 enters the atlas bibliography via this repo's
citations.
