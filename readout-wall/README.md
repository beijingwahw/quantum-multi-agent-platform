# readout-wall

**The measurement wall of indefinite causal order, executed as an exchange-rate ledger.**

The ledger's `#06` cost column cites three walls; the first — *readout collapses the order* — has been quoted in every repo since switch-sched but never executed as its own object. This repo is that execution. Six trades, every one with both columns booked:

- **E1 — the ESC18 exchange.** Two completely depolarizing boxes, joint receiver: the switched pair carries χ_joint = 0.048794940695399 bits, and **every bit of it lives in the off-block coherences of the order register** — a z-readout takes χ to 0.000000000000000 exactly. The order bit the readout *buys* is input-blind: P(control=0 | input) = 1/2 to 1e-15, a fair coin about the branch, never about the payload.
- **E2 — the collapse identity.** The dephased switch equals the classical mixture Σ p_c·ℳ_c of the fixed-order channels, weighted by the control's diagonal — machine-identity to 1e-15 across the showcase pairs and random CPTP pairs, on a second path built from the fixed orders themselves. *The read-out switch is not a new process; it is the average of the orders you could have chosen without any switch.*
- **E3 — the complementarity face.** The replacer pair parks its information ON the control at x-coherence (T = 1/2, χ_control = H₂(1/4) − 1/2); reading the order basis sees nothing (T after z-readout = 0.000000000000000). Order-knowledge and order-advantage are complementary observables of the same register.
- **E4 — the weak readout, now a theorem (v0.2.0).** Partial dephasing of strength λ: χ(λ) = 0.048795 → 0.026470 → 0.011482 → 0.002831 → 0. v0.1.0 shipped the interior as data with no theorem claimed; v0.2.0 executes it: the closed form 2f((5−λ)/16)+2f((3+λ)/16)−f((3−λ)/8)−f((1+λ)/8)−2f(1/4) (f = −q log₂ q; spectra re-derived by the simulation at every grid point) is certified **strictly decreasing and strictly convex on the rational grid λ = i/20** by exact rational interval arithmetic, ln enclosed on two independent series paths. No float enters any certificate.
- **E5 — the k=3 face.** Six orders over three depolarizing boxes: χ = 0.098069743463625 (machine-measured, no paper value claimed) → 0 under readout; the six-order mixture identity holds to 1e-15, **including complex random CPTP triples**. The k=3 weak-readout curve carries its own closed form (dyadic spectra, affine in the coherence) with its own exact monotonicity+convexity certificates on the same grid — the wall scales with the number of orders it buries.
- **E6 — the exchange-rate frontier (v0.2.0).** GET = λ bits of order knowledge (the read-and-remember instrument leaves exactly the weak-readout state; its record carries I(record; order) = λ). PAY = χ lost. Both showcase families (ESC18 joint, replacer control) are machine-mapped as exact data with a **Pareto certificate: no census point dominates another** (exact antichain, on the census only — never a global claim), and **first-touch dominance: every next slice of order knowledge is strictly cheaper than the last** — the first 1/20 costs 0.005123 bits of joint χ / 0.065113 bits of control χ. The wall is steepest at first touch.

## Why the verdict stays HW-WAIT

The wall is a price list, not a prohibition. No hardware advance repeals a complementarity — but none is needed to keep paying these prices. Order is superposable, not abolishable; knowledge of it is purchasable, never free.

## The laws (src/kernel/audit.ts)

| law | enforces |
| --- | --- |
| C1 | a trade books BOTH columns — GET without PAY (or vice versa) fails the build |
| C2 | exactness tag is EXACT or DATA, and every row cites a witness that exists — EXACT without re-derivation is hearsay |
| C3 | anchor repos exist on disk (switch-sched, k-switch) — physics stays anchored where it was verified |
| C5 | exchange ids are unique and inside the E1..E6 numbering discipline (range enforced at runtime as of v0.2.0) |

The renderer refuses to print an illegal ledger; the tests include smuggling trials (one-sided trade, dead witness, illegal tag, dead anchor, duplicate id, out-of-range id, counterfeit monotonicity by inverted pair, float-sorted-but-uncertifiable widths, flattened convexity cell, fake frontier point that dominates the census), each named and rejected by law or by certificate cell. All six witnesses re-derive every EXACT number from the constructed channels — the ledger's digits are compared against physics, never copied into it.

## The refusal surface (v0.3.0, extended in v0.4.0)

Every throw in the kernel, switch, and — since v0.4.0 — core numeric layers (`channels.ts`, `cmat.ts`) carries a named code (the `RefusalError` envelope, `src/core/errors.ts`): the message stays frozen prose, the code is the identity a test can convict (T7 and T8 try each public refusal by name — out-of-range subsystems, non-qubit order registers, zero denominators, domain violations, short channel lists, degenerate curves, shape mismatches in the linalg kernel). Two latent defects died at that wall: a degenerate curve or census (0/1 points) used to *vacuously certify* — `certifyStrictlyDecreasing([])` returned `ok:true` — and `fDecimal` dropped the minus sign of negative fractions whose decimal expansion terminates exactly at the digit limit. The v0.3.0 quality wave also absorbed the dead faces: 24 zero-reference exports deleted from `cmat.ts`, `channels.ts`, `chanlib.ts`, `isometry.ts`, `rational.ts`, `theorem.ts` (grep-verified across the workspace; the canon-identical `states.ts`/`rng.ts`/`measures.ts` are left untouched — their dead exports are the family canon's to shed), and the interval-midpoint quotation is single-sourced (`iMid`). The v0.4.0 wave single-sourced the weak readout itself: the four inline `(1−λ)ρ + λ·Δ(ρ)` compositions in the audit now all flow through `partialDephase` (the named E4 object), proven bit-identical on the showcase fixture at every grid point — the rendered report is byte-identical before and after both waves.

## Honest boundary

The χ values are binary-ensemble Holevo quantities (capacity lower bounds, the same register switch-sched certified), not optimal capacities — the ESC18 optimisation remains cited there, not reproduced here. E5's coherent triple value is machine-measured with no paper claim attached. The v0.2.0 theorems are statements **on the stated families and the stated grid** (λ = i/20): no claim is made off-grid, for other channel pairs, or across the two frontier currencies (the cross-family exchange-rate ratio is quoted as data only). The closed forms were derived in-repo from the constructed channels and are verified against the simulation at every grid point; they are not imported from any paper.

## Reproduce

```bash
npm ci
npm test        # 31/31 — checker, six witnesses, collapse machinery, theorem certificates, smuggling trials, entry guard, refusal codes, single-source interchange + linalg exact anchors
npm run repro   # renders out/reports/the-readout-wall.md (seconds)
```
