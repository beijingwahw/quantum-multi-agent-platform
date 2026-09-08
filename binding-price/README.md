# binding-price

**The market of ledger row #13, executed: privacy is bought, binding is not — and here is the coin.**

The ledger said it as a verdict: *as notary exact, as binding vetoed — HJW lets the promisor choose the decomposition after the fact; privacy is bought, binding is not.* This repo executes the market underneath:

- **G1 — the one-coin identity.** A reveal's pass probability is Tr[|a⟩⟨a| ρ_V] = (1 + a·r)/2 — so **binding slack (pass − ½) is exactly half the verifier marginal's polarization along the announcement**. Every unit of binding bought is a unit of privacy sold, one-to-one, as an equation rather than a trade-off curve (deviation ≤ 1.3e−16 over 200 swept pairs).
- **G2 — the flat supply, witnessed.** Across the promisor's entire HJW strategy space — 24 random bases, the tetrahedral decomposition, mixed-member ensembles — the verifier's marginal stays exactly I/2 (TV = 0.0) and the reveal stays exactly ½ (deviation = 0.0). No decomposition moves it at any offer: the supply curve is identically flat at zero because the same object prices both goods.
- **G3 — the sellable goods, priced.** Entangled concealment T = 0 (perfectly hidden — and thereby pinned at ½ by G1); tamper detection 1 − (3/4)^m on two arithmetic paths for m = 1..12; the pad economy anchored in quantum-mech's quantum-OTP invariance (χ = 0 exactly, ensemble equality across payloads).
- **G4 — the classical frontier.** One parameter, two prices: for marginals polarized at r with aligned announcement, pass = ½ + r/2 and concealment loss = r/2 — **slack equals loss at every grid point**; the classical equatorial cheat's 0.853553390593 = (2+√2)/4 is just the point r = 1/√2 on that line (quantum-mech's exp4 equiangular constant, re-derived as a frontier point).
- **G5 — the constants on two paths**, symbolically and numerically.
- **G6 — the flat supply beyond enumeration (v0.2.0).** 26 enumerated families upgraded to a precisely stated CONTINUOUS family swept exhaustively: antipodal-pair products {¼ ±u, ¼ ±v} over 61×25 Fibonacci grids (every dihedral decomposition — basis pair and great square are parameter points), geodesic interpolations between the family's extremal points (91), convex refinements {w·I/2, (1−w)/2 ±a} (21×25). 2141 ensembles: worst marginal TV 8.3e−17, worst reveal deviation 1.1e−16 — "enumerated" becomes "exhaustive over the parameterized family" (the regular tetrahedron is not of pair form and stays in G2's enumerated families).
- **G7 — the one-coin identity under a noisy commit channel (v0.2.0).** The exact census, survives/bends/breaks all machine-measured: as an equation of the OUTPUT marginal the identity survives every channel and strength (maxdev 1.7e−16, 10 settings × 256 pairs); the flat supply survives as flatness by CPTP linearity (every decomposition of I/2 lands on E_γ(I/2), 1.3e−16) — dephasing keeps the level at exactly ½ (unital), damping tilts it memberwise to (1+γm_z)/2 up to certainty at γ=1; the input↔output one-to-one BENDS (dephased oblique polarization: wedge 0.103553 between input-aligned slack and output loss at γ=½) and BREAKS (damping confiscates γ/2 of concealment from a perfectly concealed input — maxdev 2.8e−17, cross-anchored with quantum-mech v0.2.0's HJW-under-noise census T = γ/2 — and mints the matching slack along its own axis). The coin never stops being one coin; noise breaks the assumption that the input pair is the output pair.
- **G8 — two coins, bounded census (v0.2.0).** 63 strategies (product decompositions, the Bell ensemble, locally rotated Bells, Schmidt interpolations): the PER-COIN flat supply persists (marginal I/2, reveal ½, worst dev 2.2e−16) at every Schmidt coefficient; but the JOINT reveal is MOVED by perfectly concealing strategies — at the fixed (z,z) announcement the pass spans ¼ (I/4-decompositions) to ½ (the Schmidt family's classical correlations). The one-coin coin does not mint a two-coin coin: joint statistics are priced by correlations, and correlations are steerable — the honest boundary of the flat supply.

## The laws (src/kernel/audit.ts)

| law | enforces |
| --- | --- |
| M1 | every good carries a price — unpriced goods do not ship |
| M2 | an unpriceable claim must cite an invariance witness — **an asserted impossibility without a witness is marketing** |
| M3 | anchor repos exist on disk (quantum-mech, nosignal-tariff) |
| M4 | tags are MARKET-EXACT or DATA |
| M5 | ids unique |

Renderer refuses illegal markets; eleven smuggling trials (five ledger-level, six v0.2.0 witness-level: counterfeit flat-supply families, forged census numbers, fake identity rows — each named and rejected); the complex-quadrant honesty of the identity is tested (anti-aligned announcements underpass ½ — the identity has a sign face), as is the blochOf roundtrip (the v0.2.0 sign catch).

## Honest boundary

The market layer prices the HJW-style commitment family at the qubit level; quantum-mech's protocol experiments own the full protocol analyses (steering tables, BB84 game separations, the erasure/robustness census). The flat supply is witnessed over G2's enumerated families plus G6's parameterized family, swept exhaustively on its grids — the general HJW theorem (every decomposition of I/2) remains cited through the anchors, not re-proven. G7's channels are single-qubit dephasing and damping on the verifier's register (no channel design, no adaptive noise); G8's joint-movability is a bounded census over four strategy families, not a characterization of the two-coin joint supply.

## Literature anchors (v0.2.0, adopted as anchors only)

- van Luijk, Marrakchi, Osborne, Stottmeister, Wilking, *Quantum steering is equivalent to state-preserving conditional expectations*, arXiv:2608.10783 (2026) — the modern structural form of the steering freedom this market prices (steering ⟺ liftability of ensemble decompositions); anchor only, nothing here re-proves it.
- Wang, Meng, Dahlsten, *Non-unique decompositions of mixed states and deterministic energy transfers*, arXiv:2509.04235 (2025), publ. Phys. Rev. (DOI 10.1103/12b6-hw2h) — HJW non-uniqueness exploited operationally; supports the reading that decomposition freedom is a physical resource, not bookkeeping.
- Both identifiers verified from two independent sources (arXiv + ResearchGate/APS). No claims of this repo depend on either; the no-go backdrop (Mayers–Lo–Chau; relativistic alternatives) stays anchored in quantum-mech's bibliography.

## Reproduce

```bash
npm ci
npm test        # 33/33
npm run repro   # renders out/reports/the-binding-price.md (seconds)
```
