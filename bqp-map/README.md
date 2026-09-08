# bqp-map — The BQP × NP Scheduling Complexity Atlas

Roadmap #7 / 7 (+ the genealogy enrollments): for every scheduling problem
class, annotate its quantum-reachable complexity class — **which can never be
accelerated** (in a stated model), **which only waits for hardware**.

The difference from a survey: every annotation is **certificate-backed**, and
the machine certificates are **re-executed by `npm test` and `npm run repro`**.
Claims without certificates do not ship — a discipline checker enforces it.
The same discipline now accepts far-future claims too: the genealogy family
enrolls them as verdicts with certificates and costs, manifestos not welcome.

## The one-paragraph answer

- **P-EXACT** (Johnson's F2||Cmax, linear assignment): nothing left to
  accelerate — the classical answer is already exact and near-linear.
- **CONDITIONAL-WALL** (P2||Cmax weak, P||Cmax strong, F3||Cmax): an exact
  polynomial quantum algorithm would imply NP ⊆ BQP — one shared, visible
  conditional; the reductions carrying it are executable here.
- **QUERY-WALL** (black-box exact optimization): success ≤ (2q+1)²/N after q
  oracle queries (BBBV97) — computed on exact evolutions, q=1 anchor exact to
  machine precision; beyond-quadratic requires reading the instance, which is
  precisely not black-box.
- **HW-WAIT** (Grover exact search, Dürr-Høyer min-finding, quantum B&B and
  backtracking): certified quadratic speedups, executed with per-query
  accounting, waiting on logical qubits.
- **INFO-WALL** (online adversarial streams, online matching): the wall is
  informational — qram-sched machine-checked that quantum search leaves the
  decisions bit-identical.
- **VERIFICATION-GAP** (stoquastic vs non-stoquastic annealing, general local
  Hamiltonian): what changes is the witness structure — StoqMA vs QMA — and
  the exact boundary is located: max nonzero off-diagonal −Γ (stoquastic, any
  coupler signs) vs +κ (one XX edge).

## The genealogy family — far-future claims, same discipline

Every letter-claim enrolled under the same discipline (verdict → certificate →
wall model → cost, no manifestos; the full claim-by-claim register is rendered
by exp6 — every claim of the letter mapped to a verdict-carrying row, no claim
unenrolled, no row padded):

- **postselect-sort** (CONDITIONAL-WALL): the many-worlds sorter is TRUE
  in-branch (fidelity 1.000000000000) and pays the depreciation ledger
  out-of-branch: P_success = t/N exactly, 1/P = N/t expected queries — the
  classical random-search rate; never better than Grover-with-restart at the
  same certain-answer standard, with the gap growing ~√(N/t) (measured 4.8×
  at n=4 → 184× at n=14, t=1). The counting power in-branch is the
  executable face of PostBQP = PP (AAR04).
- **retrocausal-cache** (INFO-WALL): correlations are real (singlet CHSH
  2√2 to 15 decimals) while B-side marginals stay at float zero under
  arbitrary local unitary AND CPTP maps — the cache hits 100%, withdrawal
  needs the classical channel (latency floor distance/c). GRW80.
- **vacuum-execution** (MECHANISM-SETTLED, positive): the Feynman–Kitaev deed
  machine-certified — H_prop|Ψ_hist⟩ = 0 to ~1e-15 for random circuits,
  degeneracy accounting, accept/reject witness semantics, and conditional
  readout with fidelity EXACTLY 1 at every clock step (vacuum-compiler T1/T3,
  FEY85 + KSV02).
- **readout-tariff** (MECHANISM-SETTLED): the second law's disclaimer clause
  has a tariff schedule — ground-state storage does no work, but every
  readout mode pays: static (T+1)·log2(T+1) expected erasure bits, fuel that
  buys delivery with the spectral gap closing as price (cargo stays exact —
  covariant-subspace law), or walk time-energy. Direct execution erases 0:
  the vacuum stores and attests, it never beats running (vacuum-compiler T4,
  LAND61).
- **dtc-clock** (MECHANISM-SETTLED): settled at the MODEL layer — an exact
  driven-echo family whose beat (F₊ Z F = −Z exactly, π-paired
  quasi-energies) clocks a universal reversible gate set with cargo
  fidelity 1 at every tick, at zero net work on the ideal beat (detuned
  beats pay exactly); the fewest-units tariff winner is the DTC-clocked
  Bennett machine — the clock is overhead, not engine. The WO15 tombstone
  ships in the same repo: equilibrium never beats. Boundaries: hardware
  instantiation NOT claimed (MI22 holds the hardware cells), noise/error
  correction unmodeled (dtc-clock + route-price D1).
- **bell-money-exclusivity** (MECHANISM-SETTLED, positive): double collateral
  tops out at 1/√2 on GHZ; a threshold above 1/2 admits at most one party —
  no-cloning is the notary (quantum-mech T3, WZ82).
- **quantum-binding** (MECHANISM-SETTLED, no-go): HJW steering lets the
  committer pick the decomposition after the fact; every reveal passes at
  exactly 1/2 — quantum buys privacy and detection, never binding
  (quantum-mech T4, HJW93).
- **dsic-noether** (MECHANISM-SETTLED): the symmetry group and its conserved
  charge are now exhibited, machine-verified on both sides of one algebra —
  the Groves gauge group (payments modulo h_i(b₋ᵢ), GL79) with the WELFARE GAP
  as the charge (bitwise gauge-invariant, ≤ 0, = 0 at truth); implementability
  = exactness of the payment 1-form (dp = −d(W₋ᵢ∘x) bitwise, Rochet cyclical
  monotonicity: no positive cycle); and the discrete Noether theorem executed
  on a variational integrator (charge drift 2.4e-14 symmetric vs 2.0 broken —
  fourteen orders of separation). Corner cases fold in: the charge survives
  quantum reports (quantum-mech T1) and never inverts direction under order
  superposition (switch-sched T4). NOT claimed: a literal derivation of
  Green-Laffont from Noether's 1918 continuum theorem — the unification is an
  isomorphism at the discrete-exactness level, stated as exactly that
  (dsic-noether T1-T4, NOE18 + GL79 + ROC87 + MW01).
- **order-as-resource** (HW-WAIT): the epoch-2 flagship — the switch's
  communication advantage is certified and machine-verified (ESC18, T_joint
  = p/4); the scheduling half is admission-gated (crossing-type erasure only),
  order superposable, not abolishable.
- **quantum-network-sched** (HEURISTIC): entanglement distribution as the
  schedulable resource — ERS meets strict QoS where baselines deliver zero
  (ent-sched).
- **subspace-exact-platform** (HEURISTIC): the capsule's own numbers, exhumed
  — effective 80 qubits = subspace equivalence (NOT physical), NP-hard 5/5 at
  benchmarked sizes, Hungarian parity (platform repo).
- **choice-primitive** (MECHANISM-SETTLED): the model now exists at BOTH
  layers — choice-lang compiles choose-as-primitive with engineered
  stability (the language layer), and stable-world makes the marked world
  the absorbing class of a fixed dissipative law: quiet on the world,
  globally attractive with no postselection and no arrival toll,
  Lyapunov-certified on the same membership charge, robust under law-error,
  stabilization priced on both faces. The row's stated open item — an
  executable model of stability as physics — now exists; nature's
  instantiation is not claimed (choice-lang + stable-world).
  quantum-binding stays as the audit-added no-go row.

## Layout

- `src/reductions/` — T1: Partition→P2||Cmax, 3-Partition→P||Cmax (both
  directions machine-checked), FPTAS dichotomy, Johnson's rule, Ising parity
- `src/upper/` — T2: exact Grover (closed form == state-vector, 1e-12),
  Dürr-Høyer with per-query accounting
- `src/lower/` — T3: full decision-tree enumeration (all 2,097,152 trees at
  N=8,q=3: max success = q/N exactly), BBBV hybrid lemma + corollary computed
  on exact evolutions
- `src/witness/` — T4: NP vs quantum witness verification (Hoeffding law,
  completeness + soundness), stoquastic dichotomy with exact anchors
- `src/atlas/` — T5: the typed registry + discipline checker
- `src/genealogy/` — T6: the postselection depreciation ledger and the
  no-signaling withdrawal clause (exact complex algebra, no sampling)
- `out/reports/atlas.md` + `atlas.json` + `exp6-genealogy.md` — the rendered deliverables
- `docs/theory.md` — theory layer, honest boundaries, verified bibliography

## Reproduce

```
npm install
npm test        # 43/43 — includes re-running every machine certificate
npm run repro   # ~4 s — rebuilds all six experiment reports + the atlas
```

Key numbers (all regenerated by `repro`):

- Grover k*/√N → 0.7813 (→ π/4); success ≥ 0.9966 from N=64 up; classical
  best at the same query budget: k*/N
- Dürr-Høyer: 44/44 optimal runs across N=256..4096 (incl. real P2||Cmax
  assignment spaces where DH returns the exact DP optimum), queries ≈ 13×√N
- Classical wall: max uniform success q/N over ALL decision trees (verified
  exhaustively up to 2,097,152 trees)
- BBBV: q=1 distance exactly 2/√N; lemma + corollary hold at every probed
  (N, q) up to N=4096
- Witness: median estimation error slope −0.477 (1/√m law); coverage and
  soundness at 1−δ on both sides of the contract
- Stoq dichotomy: −Γ / +κ exact across (Γ, κ) grid
- Genealogy: postselection ledger/E* = 4.85 (n=4, t=1) → 184.27 (n=14) —
  the √N depreciation; B-marginals ≤ 2.8e-16 under unitary+CPTP while joint
  HS ≥ 0.66; singlet CHSH 2.828427124746189 (err 8.9e-16) with marginals I/2
  to 1.7e-16

## Honest boundaries

1. No new complexity-class separations — every "never" is model-relative
   (trivial / conditional on NP ⊄ BQP / black-box / information-theoretic),
   and each atlas row labels its model.
2. Finite machine checks anchor cited theorems at concrete sizes; the
   all-sizes statements are the theorems'.
3. The atlas deliberately avoids strong-NP-hardness claims for FIXED machine
   counts m ≥ 3 — the classic trap in this corner.
4. QMA vs NP is open; VERIFICATION-GAP rows describe witness structure, not
   separation.

## Related

- `../ft-qaoa` (#1), `../nonstoq-anneal` (#2 — the sign barrier whose
  complexity-class face is measured here), `../ent-sched` (#3),
  `../quantum-mech` (#4 — the MECHANISM-SETTLED certificates live there),
  `../qverify` (#5), `../qram-sched` (#6), `../switch-sched` (#8 — the
  order-resource contact surface cited by two genealogy rows),
  `../causal-ineq` (#9 — the causal inequality executed: the decision-primitive
  layer where indefinite order provably beats every causal strategy),
  `../k-switch` (#10 — order superposition over k! topological sorts,
  k=3: the parity-orthogonality law and the six-order contact surface)
- Platform: `../ds_extracted/ds` (github.com/beijingwahw/quantum-multi-agent-platform)

MIT. TypeScript strict mode, zero runtime dependencies, NodeNext, node:test.
