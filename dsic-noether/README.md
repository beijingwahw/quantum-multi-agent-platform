# dsic-noether — Roadmap #12: the symmetry layer of mechanism design, at both layers

> Epoch-5 claim, audited: "你们的 DSIC 定理，在这里是 Noether 对称性的一个特例。"
> The atlas row said: "the map is poetic until a conserved charge is exhibited."
> v0.1.0 exhibited the charge — the poetry survived as algebra, discretely.
> v0.2.0 executes the derivation the row still excluded: Noether's 1918
> continuum theorem -> Green-Laffont, every link the zero polynomial.
> v0.3.0 takes the two boundaries v0.2.0 priced: the NON-QUADRATIC face (the
> quartic chain closes on the externality-free stage, and a no-polynomial
> certificate proves the coupled quartic stage cannot host the chain at all)
> and the KINK as piecewise-smooth Noether (both regimes glued exactly).

## Positioning

Mechanism design has the pieces (Groves mechanisms GL79, cyclical monotonicity
ROC87) and mechanics has the theorem (Noether NOE18, discrete and exact MW01).
Nobody had put them on one page as ONE algebra and machine-checked both sides.
That is this repository.

## The correspondence, machine-verified on both sides

| the algebra | mechanism design (integer-exact) | discrete mechanics (rounding-exact) |
| --- | --- | --- |
| invariant object | deviation gain (the WELFARE GAP) | L_d under diagonal rotation |
| group action | gauge p → p + h_i(b₋ᵢ) — the Groves orbit (GL79) | SO(2) on the plane (NOE18) |
| closed 1-form | dp + d(W₋ᵢ∘x): bitwise 0 on all pairs | θ_d·ξ: ≤ 5e-15 isotropic |
| the charge | welfare gap ≤ 0, = 0 exactly at truth | angular momentum: drift 2.4e-14 over 400 steps |
| broken case | anti-efficient: positive cycle 102; second-best: 25/40 worlds violate | anisotropic: curl 8e-2, J drift 2.0 |
| stationarity | truthful reporting maximizes Φ_v (DSIC) | DEL trajectory (residuals ≤ 6e-15) |

**The bridge**: invariance under a group action ⟹ the contracted 1-form is
closed (cycle/loop sums vanish) ⟹ a potential (the charge) exists ⟹ the
solution is stationary (truth / DEL). Fourteen orders of magnitude separate
the symmetric and broken cases on the physics side; bitwise zero separates
them on the mechanism side.

## Deliverables

- **T1 the gauge group and its charge**: deviation gain == welfare gap,
  BITWISE, in two independent gauges, over random worlds; gauge invariance
  bitwise; DSIC as a charge statement (gap ≤ 0 everywhere, = 0 at truth); the
  gauge orbit moves every payment by exactly h − h′.
- **T2 implementability as exactness**: the payment 1-form is exact
  (dp = −d(W₋ᵢ∘x), bitwise on all pairs); potential reconstruction bitwise;
  cyclical monotonicity scanned over all simple cycles (84/world at K = 5);
  negative controls (anti-efficient: positive cycle + direct deviation;
  second-best: 25/40 violation rate — the quantum-mech T5 approximate-solver
  lesson restated); positive control the machine insisted on: greedy serial
  dictatorship is implementable 40/40 (classic fact; we had drafted it as a
  villain and recorded the correction).
- **T3 discrete Noether, executed**: midpoint variational integrator
  (Marsden-West); the closedness identity has a CLOSED FORM
  h(aₓ − a_y)·mid_x·mid_y, derived and machine-verified; symmetric case closed
  at rounding scale with the charge conserved to 2.4e-14 over 400 DEL steps;
  anisotropic case: curl 8e-2 and charge drift 2.0.
- **T4 the bridge**: the table above as a report, with the house corner cases
  attached — quantum-mech T1 (the charge survives quantum reports: utility
  affine 1e-16 in the density matrix) and switch-sched T4 (the charge's
  direction never inverts under order superposition: U_sw = (U_def+2)/2).

**T5 the continuum 1-forms (v0.2.0)**: on the quadratic divisible-good family
(v = θ·a − a²/2, Σa = 1, types on [2/5, 3/5]^n) the efficient allocation is
the closed form x_j = θ_j − θ̄ + 1/n; the allocation 1-form α = x·ds is
closed iff the Jacobian of x is symmetric — which is both the Euler–Lagrange
face of the report action (the Helmholtz/inverse-problem condition, OLV86)
and the exact existence condition for a payment. The skew family x + c·(s₂,−s₁)
crosses the implementable locus exactly at c = 0 with rectangle cycle
integral exactly −2cwh.

**T6 Noether I, mechanism-native (v0.2.0)**: the charge has the closed form
G(s;t) = −(n−1)(s−t)²/(2n) — DSIC by ordered-field arithmetic, equality iff
s = t, independently witnessed on exact rational grids — and equals the
welfare gap Φ_t(x(s)) − Φ_t(x(t)) coefficient-wise. Under the one-parameter
gauge orbit p → p + ε·g(θ₋ᵢ) the charge is conserved: dG/dε is the zero
polynomial for seeded random gauges. The Noether-I implication shape
(invariance => conserved quantity), executed.

**T7 Noether II: the gauge identity + the classification (v0.2.0)**: the
gauge group is the full C^∞(Θ₋ᵢ) — Noether's second-theorem class (KSS11).
Its identity: the fiber derivative of every differential incentive identity
annihilates the gauge direction (g has no s-monomials). The classification
corollary is Green-Laffont uniqueness executed: the solver reads the gauge
off ANY DSIC payment exactly (the readoff p − antiderivative carries no
own-report monomials and equals the anchored payment), and convicts
off-orbit payments on sight.

**T8 the chain, assembled (v0.2.0)**: [E] DSIC ⟹ the payment's own-report
derivative equals ∂V/∂a·dx/ds on the truthful diagonal (zero polynomial);
[I] fiber integration — the Poincaré/FTC step — exhibits the gauge h(θ₋ᵢ);
[S] efficiency enters as welfare stationarity Σ_j(θ_j−x_j)·dx_j/ds = 0;
[G] p + W₋ᵢ(x) = h(θ₋ᵢ) exactly: the Groves form, with exactly the gauge
freedom. Converse by the closed-form charge. **The continuum derivation the
ledger rows excluded is executed** — with four boundary controls marking
where each hypothesis is load-bearing:

- **K1 off-gauge**: p + ε·s breaks the envelope by exactly −ε and buys a
  profitable deviation at s* = t − εn/(n−1) worth exactly ε²n/(2(n−1)).
- **K2 efficiency**: the κ-rule family is implementable for every κ > 0 but
  its Groves drift is exactly κ(1−κ)(n−1)/n·s — Groves form only at κ = 1;
  the decreasing rule is not implementable at all (2-cycle c(a−b)² > 0 exact).
- **K3 topology**: the winding form (x dy − y dx)/(x²+y²) is closed
  (coefficient-wise) yet integrates to exactly 2π around the unit diamond
  (quarter-turn symmetry exact + the atan(2t−1) antiderivative identity
  exact; numeric cross-check 6.2831853071796). Closed does NOT produce a
  potential on a non-convex type region — the Poincaré step is load-bearing,
  and no finite report set can host the phenomenon: a strictly continuum
  theorem-shape.
- **K4 smoothness**: the second-price auction satisfies the envelope bitwise
  on both open regions; the kink locus (where the allocation jumps by
  exactly 1) is where the smooth chain stops and the general measurable-space
  theorem (GL79) takes over.

**T9 the non-quadratic face (v0.3.0)**: the quartic utility family
v = θa − a⁴/4, on both sides of the polynomial boundary. (a) On the
EXTERNALLY-FREE stage (one private good per agent, types τ = θ^(1/3), so the
efficient rule x_j = τ_j is polynomial) the whole chain closes again — every
link the zero polynomial — and the charge acquires a genuinely new closed
form G = −(s−t)²(s²+2st+3t²)/4, a square times a POSITIVE-DEFINITE quadratic
((s+t)²+2t², a sum of squares) — DSIC by ordered-field arithmetic, globally.
Noether I orbit conservation and the Noether II classifier run on the new
family; the κ-control's Groves drift is exactly κ(1−κ³)s³ (Groves only on the
κ = 1 slice; κ < 0 has a positive Rochet 2-cycle −κ(a−b)²). (b) On the
COUPLED stage (Σa = 1 — the v0.2.0 stage) a NO-POLYNOMIAL CERTIFICATE proves
the efficient allocation x_j = (θ_j−λ)^(1/3) cannot be a polynomial in the
types: the FOC forces (X₂−X₁)(X₂²+X₂X₁+X₁²) = θ₂−θ₁, the quadratic factor
has degree 2d exactly (leading coefficient (q_d+p_d/2)²+(3/4)p_d² > 0 by a
machine sum-of-squares identity), and degree arithmetic e+2d = 1 with d = 0
⟹ e = 0 has no solution. The chain does not break at a link — the ring
cannot state it. Controls prove the checker sharp: at degree 3 the lemma
does not refute (X₁=1, X₂=t solves it), and the quadratic family's LINEAR
FOC is not convicted. The exponential family fails one level earlier
(transcendental FOC inversion) — cited, not machine-claimed.

**T10 the kink locus as piecewise-smooth Noether (v0.3.0)**: K4 executed as
a piecewise mechanism, two regimes. JUMP regime — the second-price auction
as two polynomial patches: the chain per patch, the COMMON gauge h = w (the
pivot) on both patches, and the gluing priced exactly: [x] = 1, [p] = w,
[u] = t−w with the identity [u] = t·[x] − [p]; the charge's one-sided limits
(0 and −(t−w) for a true winner — forcing a win you should not take costs
exactly the true-type gap); the across-kink integration step = the
Milgrom-Segal envelope (MS02) executed exactly on crossing, non-crossing,
and reversed rational pairs. First price PASSES the gluing identity and is
convicted ON THE PATCH (residual exactly −1): the counterfeit certificate
"gluing ⟹ DSIC" is named and rejected. CONTINUITY regime — the capacity
wall of the quadratic family (types widened to [1/2, 5/2]²): the interior
patch carries a NONCONSTANT rule (the chain runs nontrivially); x, p, and
the charge are continuous at the wall kink s* = w−1 (zero polynomials, w
symbolic) while the charge's FLUX jumps by exactly (t−w+1)/2 = x(t) — the
surface term of the piecewise conservation law. The wall-to-wall block is a
weak-DSIC flat (charge 0), counted honestly. The gauge-readoff census gains
a two-parameter non-linear gauge, read off coefficient-exact with hidden
own-report terms convicted on sight.

## Honest boundaries

- **What is proved**: both instantiations of the algebra at the discrete
  layer (integer-exact, T1–T4), the continuum derivation at the smooth
  layer (T5–T8, every identity the zero polynomial in exact rational
  arithmetic — it holds for every type profile in the region at once), the
  quartic chain on the externality-free stage plus the no-polynomial
  certificate for the coupled quartic stage (T9, both directions, with
  sharp controls), and the piecewise-smooth kink discipline in both regimes
  (T10, per-patch chains plus exact gluing). The symmetry group and the
  conserved charge the atlas asked for are exhibited at both layers and on
  the new family; the Noether→Green-Laffont implication is executed with
  its load-bearing hypotheses each carrying a machine witness.
- **What is NOT proved**: the general Green-Laffont theorem for measurable
  type spaces and nonsmooth mechanisms (GL79, cited — the kink locus K4 is
  its territory; the modern general-type-space uniqueness PBS25 is likewise
  cited); Green/Poincaré as general analytic theorems (SPI65, cited — here
  they are executed as exact polynomial integration on a convex box);
  Noether's theorems as general statements (NOE18, KSS11, cited — the
  mechanism instances are what the machine holds); polynomial exactness of
  any EXTERNALITY-BEARING quartic mechanism (the T9 certificate refutes the
  natural one — reparametrizing the type space does not polynomialize the
  λ-coupling); rational (as opposed to polynomial) non-solvability of the
  coupled quartic FOC (would need the arithmetic of the Fermat cubic —
  cited, not executed); the exponential family's FOC inversion (transcendental
  — outside the certificate's algebraic scope); the second-price per-patch
  links are trivially zero (constant patch rules — labelled, not inflated);
  tie-breaking AT the kink point itself (the repo stays tie-free — the wall
  flat is indifference, not a tie) and multi-agent wall combinatorics (one
  wall, n = 2 here).
- **Scale**: discrete layer 3×3 assignment instances, K = 5 own-reports,
  full enumeration; continuum layer n = 2, 3 agents, closed forms — the
  polynomial ring is the whole type space at once. Small on purpose —
  exactness is the deliverable, not size.
- Tie-free by construction at both layers (ties are the kink locus of K4;
  the wall-to-wall flat of T10's continuity regime is indifference, priced
  and counted, never a tie).
- The epoch-5 superstructure ("scheduling as a physical law", choice as a
  language primitive) remains where it was: the `choice-primitive` OPEN row.

## Reproduce everything

```
npm ci && npm test && npm run repro
```

78/78 tests; seven reports rebuilt in about a second and a half. Seeded,
zero runtime dependencies, TypeScript strict + NodeNext. Reports land in
`out/reports/`. Citations (web-verified): [docs/citations.md](docs/citations.md).
