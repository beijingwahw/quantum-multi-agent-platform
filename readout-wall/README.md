# readout-wall

**The measurement wall of indefinite causal order, executed as an exchange-rate ledger.**

The ledger's `#06` cost column cites three walls; the first — *readout collapses the order* — has been quoted in every repo since switch-sched but never executed as its own object. This repo is that execution. Five trades, every one with both columns booked:

- **E1 — the ESC18 exchange.** Two completely depolarizing boxes, joint receiver: the switched pair carries χ_joint = 0.048794940695399 bits, and **every bit of it lives in the off-block coherences of the order register** — a z-readout takes χ to 0.000000000000000 exactly. The order bit the readout *buys* is input-blind: P(control=0 | input) = 1/2 to 1e-15, a fair coin about the branch, never about the payload.
- **E2 — the collapse identity.** The dephased switch equals the classical mixture Σ p_c·ℳ_c of the fixed-order channels, weighted by the control's diagonal — machine-identity to 1e-15 across the showcase pairs and random CPTP pairs, on a second path built from the fixed orders themselves. *The read-out switch is not a new process; it is the average of the orders you could have chosen without any switch.*
- **E3 — the complementarity face.** The replacer pair parks its information ON the control at x-coherence (T = 1/2, χ_control = H₂(1/4) − 1/2); reading the order basis sees nothing (T after z-readout = 0.000000000000000). Order-knowledge and order-advantage are complementary observables of the same register.
- **E4 — the weak readout.** Partial dephasing of strength λ: χ(λ) = 0.048795 → 0.026470 → 0.011482 → 0.002831 → 0. Endpoints exact; the curve ships as **data** — no convexity/concavity theorem is claimed for the interior.
- **E5 — the k=3 face.** Six orders over three depolarizing boxes: χ = 0.098069743463625 (machine-measured, no paper value claimed) → 0 under readout; the six-order mixture identity holds to 1e-15, **including complex random CPTP triples** — the wall scales with the number of orders it buries.

## Why the verdict stays HW-WAIT

The wall is a price list, not a prohibition. No hardware advance repeals a complementarity — but none is needed to keep paying these prices. Order is superposable, not abolishable; knowledge of it is purchasable, never free.

## The laws (src/kernel/audit.ts)

| law | enforces |
| --- | --- |
| C1 | a trade books BOTH columns — GET without PAY (or vice versa) fails the build |
| C2 | exactness tag is EXACT or DATA, and every row cites a witness that exists — EXACT without re-derivation is hearsay |
| C3 | anchor repos exist on disk (switch-sched, k-switch) — physics stays anchored where it was verified |
| C5 | exchange ids are unique |

The renderer refuses to print an illegal ledger; the tests include smuggling trials (one-sided trade, dead witness, illegal tag, dead anchor, duplicate id), each named and rejected by law. All five witnesses re-derive every EXACT number from the constructed channels — the ledger's digits are compared against physics, never copied into it.

## Honest boundary

The χ values are binary-ensemble Holevo quantities (capacity lower bounds, the same register switch-sched certified), not optimal capacities — the ESC18 optimisation remains cited there, not reproduced here. E5's coherent triple value is machine-measured with no paper claim attached. No new citations: the physics anchors to switch-sched's and k-switch's in-book verifications.

## Reproduce

```bash
npm ci
npm test        # 11/11 — checker, five witnesses, collapse machinery, smuggling trials, entry guard
npm run repro   # renders out/reports/the-readout-wall.md (seconds)
```
