# binding-price

**The market of ledger row #13, executed: privacy is bought, binding is not — and here is the coin.**

The ledger said it as a verdict: *as notary exact, as binding vetoed — HJW lets the promisor choose the decomposition after the fact; privacy is bought, binding is not.* This repo executes the market underneath:

- **G1 — the one-coin identity.** A reveal's pass probability is Tr[|a⟩⟨a| ρ_V] = (1 + a·r)/2 — so **binding slack (pass − ½) is exactly half the verifier marginal's polarization along the announcement**. Every unit of binding bought is a unit of privacy sold, one-to-one, as an equation rather than a trade-off curve (deviation ≤ 1.3e-16 over 200 swept pairs).
- **G2 — the flat supply, witnessed.** Across the promisor's entire HJW strategy space — 24 random bases, the tetrahedral decomposition, mixed-member ensembles — the verifier's marginal stays exactly I/2 (TV = 0.0) and the reveal stays exactly ½ (deviation = 0.0). No decomposition moves it at any offer: the supply curve is identically flat at zero because the same object prices both goods.
- **G3 — the sellable goods, priced.** Entangled concealment T = 0 (perfectly hidden — and thereby pinned at ½ by G1); tamper detection 1 − (3/4)^m on two arithmetic paths for m = 1..12; the pad economy anchored in quantum-mech's T2.
- **G4 — the classical frontier.** One parameter, two prices: for marginals polarized at r with aligned announcement, pass = ½ + r/2 and concealment loss = r/2 — **slack equals loss at every grid point**; the classical equatorial cheat's 0.853553390593 = (2+√2)/4 is just the point r = 1/√2 on that line (quantum-mech's T5 constant, re-derived as a frontier point).
- **G5 — the constants on two paths**, symbolically and numerically.

## The laws (src/kernel/audit.ts)

| law | enforces |
| --- | --- |
| M1 | every good carries a price — unpriced goods do not ship |
| M2 | an unpriceable claim must cite an invariance witness — **an asserted impossibility without a witness is marketing** |
| M3 | anchor repos exist on disk (quantum-mech, nosignal-tariff) |
| M4 | tags are MARKET-EXACT or DATA |
| M5 | ids unique |

Renderer refuses illegal markets; five smuggling trials; the complex-quadrant honesty of the identity is tested (anti-aligned announcements underpass ½ — the identity has a sign face).

## Honest boundary

The market layer prices the HJW-style commitment family at the qubit level; quantum-mech's T4/T5 own the full protocol analyses (steering tables, BB84 game separations). The flat supply is witnessed over the strategy families enumerated here — the general HJW theorem (every decomposition of I/2) is cited through the anchors, not re-proven. No new citations.

## Reproduce

```bash
npm ci
npm test        # 12/12
npm run repro   # renders out/reports/the-binding-price.md (seconds)
```
