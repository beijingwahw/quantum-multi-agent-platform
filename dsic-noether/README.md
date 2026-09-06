# dsic-noether — Roadmap #12: the symmetry layer of mechanism design

> Epoch-5 claim, audited: "你们的 DSIC 定理，在这里是 Noether 对称性的一个特例。"
> The atlas row said: "the map is poetic until a conserved charge is exhibited."
> This prototype exhibits the charge. The poetry survives — as algebra.

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

## Honest boundaries

- **What is proved**: both instantiations of the algebra, at machine
  precision, integer-exact on the mechanism side. The symmetry group and the
  conserved charge the atlas asked for are now exhibited: the Groves gauge
  group and the welfare gap.
- **What is NOT proved**: a formal derivation of Green-Laffont from Noether's
  1918 continuum theorem. The unification is at the discrete-exactness level:
  one algebra, two instantiations. The epoch-5 sentence is thereby upgraded
  from poetry to a precise discrete-level isomorphism — and stops there,
  honestly, at epoch-1 standards of proof.
- **Scale**: 3×3 assignment instances, K = 5 own-reports (84 simple cycles),
  full enumeration. Small on purpose — exactness is the deliverable, not size.
- Tie-free instances by construction (tie-breaking is a DSIC subtlety this
  prototype excludes explicitly, not silently).
- The epoch-5 superstructure ("scheduling as a physical law", choice as a
  language primitive) remains where it was: the `choice-primitive` OPEN row.

## Reproduce everything

```
npm ci && npm test && npm run repro
```

19/19 tests; full report rebuild in under a second. Seeded, zero runtime
dependencies, TypeScript strict + NodeNext. Reports land in `out/reports/`.
Citations (web-verified): [docs/citations.md](docs/citations.md).
