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

## The wedge cosine law (v0.5.0, `src/kernel/wedge.ts`)

G7's bend, upgraded from a float to exact certificates. For ANY single-qubit channel with Bloch output r′, the wedge between an announcement a and the output's loss is **wedge(a) = loss(output)·(1 − cos∠(a, r′))/2** with cos∠(a, r′) = a·r′/(|a||r′|) — a channel-agnostic geometry (the channel only chooses r′; the reveal prices the angle), machine-checked two-path (closed form vs the dense pass/loss machinery) over 2560 census points on both channels to 1e−12. The R18 design draft factored the loss of the INPUT; the machine convicts that factorization at the G7 point itself (0.146446 ≠ 0.103553). For dephasing the output law r′ = ((1−2γ)r_x, (1−2γ)r_y, r_z) is exactly rational, so the certificates go exact in BigInt rationals:

- **WC4** — cos² of the input-anchored wedge is EXACTLY rational for every rational pure r and rational γ wherever the output is nonzero (no square root in the certificate); the fully-dephased equatorial boundary r′ = 0 has no angle and wedge exactly 0.
- **WC5/WC6** — cos and wedge themselves are rational exactly when |r′| is a rational length: wedge is exact on the whole Pythagorean family at γ ∈ {0, ½}; at γ = ¼ the blanket claim DIES (r = (4/5, 0, 3/5): |r′|² = 13/25, 13 not a square — cos = √13/5 outside Q; the machine refuted the spec's own sentence, and the neighboring axis point keeps cos = 1: point-dependence, not a blanket).
- **WC7** — the G7 float 0.103553 upgraded: wedge = (√2 − 1)/4 in Q(√2), bracketed 0.103553 < w < 0.103554 by exact BigInt squaring; cos² = 1/2 exactly; dense-vs-field float deviation at 1e−16 scale.
- **Slack = loss ⟺ a ∥ r′** (WC3): the aligned announcement meets the one-to-one to 1e−15 at every swept point; every misaligned point is strictly wedged. The desk's counterfeit verifier names rationality laundering (NOT-RATIONAL-POINT), forged rationals (FORGED-COS/-WEDGE/-COS-SQUARE), and angles claimed on the degenerate boundary (DEGENERATE-OUTPUT).

## The Schmidt joint-reveal envelope (v0.6.0, `src/kernel/schmidt.ts`)

G8's bounded census, upgraded from floats to a law. For the Schmidt pair ensemble {½ψ(t), ½ψ′(t)} (ψ(t) = cos t|00⟩ + sin t|11⟩, ψ′ the swap-flip) and ANY product announcement |a⟩⊗|b⟩ with |a⟩ = cos α|0⟩ + e^{iγₐ}sin α|1⟩, |b⟩ likewise, the joint pass is EXACTLY **P(α,β;t) = ¼[1 + cos2α cos2β + sin2t·sin2α sin2β·cos(γₐ+γ_b)] = ¼[1 + aᵀC(t)b]** with correlation matrix C(t) = diag(sin2t, −sin2t, 1) — the family's entire two-coin behavior is one diagonal matrix, machine-checked on three routes (closed form, dense kernel trace, correlator bilinear) over the algebraic grid to 1e−12. The faces the law gives the census:

- **SC1** — the closed form itself: 6591 grid points (α,β,t ∈ kπ/24 × three phase sums), worst closed-vs-dense 1.7e−16, correlator-vs-dense at the same scale.
- **SC2** — per-coin flat at every t and announcement (both coins ½, worst 1.1e−16): the census's flat supply as a one-line corollary of the closed form.
- **SC3** — the (z,z) announcement is PINNED at ½ for every t (the population correlation never turns off); the equatorial steering curve P(+,+;t) = ¼(1+sin2t) sweeps the census's ¼→½ span; the full envelope is FLAT — sup ½ at every t, inf exactly 0 at (z,−z).
- **SC4** — the dead y-axis: the t-term carries the phase sum as cos(γₐ+γ_b) (in Bloch components, aₓbₓ − a_yb_y), so γₐ+γ_b = π/2 kills it entirely — a falsifiable face, not prose; the off-diagonal correlators vanish, C_yy = −sin2t is the phase-conjugate twin of C_xx.
- **SC5** — the baseline anchors: t = 0 collapses to the classical joint table ¼[1+cos2αcos2β]; t = π/4 both members ARE |Φ⁺⟩ (the family closes at the Bell point, cross-anchored with the G8 Bell ensemble).
- **SC6/SC7 (the R18 spec refuted, twice)** — the design draft's formula ¼[1+sin2αsin2βcos2t] carries NO population term and dies at the witness t = 0, (+,+): it claims ½ where the truth is ¼ (worst grid deviation 0.354 = √2/4); its envelope sup = ½(1+|cos2t|) (reaching 1 at t = 0) is unreachable — the machine's sup is ½ at every t, since P ≤ ¼(1+σ_max(C)) with σ_max = 1.

The desk names counterfeit kinds: FORGED-VALUE (with the deviation printed at local scale, and the R18 shape itself fingerprinted when the forged value matches SC6's refuted formula), ENVELOPE-EXCEEDED (a pass above the flat ½ ceiling), SUBZERO-PASS, ANGLE-RANGE.

## The laws (src/kernel/audit.ts)

| law | enforces |
| --- | --- |
| M1 | every good carries a price — unpriced goods do not ship |
| M2 | an unpriceable claim must cite an invariance witness — **an asserted impossibility without a witness is marketing** |
| M3 | anchor repos exist on disk (quantum-mech, nosignal-tariff) |
| M4 | tags are MARKET-EXACT or DATA |
| M5 | ids unique |

Renderer refuses illegal markets; sixteen smuggling trials (five ledger-level, six v0.2.0 witness-level: counterfeit flat-supply families, forged census numbers, fake identity rows — and five v0.3.0 dimension-fraud trials: a qutrit handed to the one-coin machinery is refused by name, not multiplied into garbage), plus the v0.5.0 wedge desk's exactness-fraud trials (rationality laundering, forged rationals, angles claimed on the degenerate boundary); the complex-quadrant honesty of the identity is tested (anti-aligned announcements underpass ½ — the identity has a sign face), as is the blochOf roundtrip (the v0.2.0 sign catch). The v0.3.0 quality wave also single-sourced the golden angle and the Fibonacci grid generator (strategy grids and noise-census grids share one definition — the flat-supply property is invariant to the constant's value, so a drifted duplicate copy would have been completely silent; the rendered report is byte-identical across the merge) and pared the byte-copied kernel core to its live faces (states.ts and rng.ts had zero references — the repo's experiments are deterministic by design; the census canon carries them).

## Honest boundary

The market layer prices the HJW-style commitment family at the qubit level; quantum-mech's protocol experiments own the full protocol analyses (steering tables, BB84 game separations, the erasure/robustness census). The flat supply is witnessed over G2's enumerated families plus G6's parameterized family, swept exhaustively on its grids — the general HJW theorem (every decomposition of I/2) remains cited through the anchors, not re-proven. G7's channels are single-qubit dephasing and damping on the verifier's register (no channel design, no adaptive noise); G8's joint-movability is a bounded census over four strategy families, not a characterization of the two-coin joint supply. The wedge desk's exact certificates are stated on PURE rational Bloch inputs under dephasing (mixed inputs and other channels carry the two-path float census only); the Q(√2) certificate is the G7 point alone — the general quadratic-extension certificate is not built.

## Literature anchors (v0.2.0, adopted as anchors only)

- van Luijk, Marrakchi, Osborne, Stottmeister, Wilking, *Quantum steering is equivalent to state-preserving conditional expectations*, arXiv:2608.10783 (2026) — the modern structural form of the steering freedom this market prices (steering ⟺ liftability of ensemble decompositions); anchor only, nothing here re-proves it.
- Wang, Meng, Dahlsten, *Non-unique decompositions of mixed states and deterministic energy transfers*, arXiv:2509.04235 (2025), publ. Phys. Rev. (DOI 10.1103/12b6-hw2h) — HJW non-uniqueness exploited operationally; supports the reading that decomposition freedom is a physical resource, not bookkeeping.
- Both identifiers verified from two independent sources (arXiv + ResearchGate/APS). No claims of this repo depend on either; the no-go backdrop (Mayers–Lo–Chau; relativistic alternatives) stays anchored in quantum-mech's bibliography.

## Reproduce

```bash
npm ci
npm test        # 87/87
npm run repro   # renders out/reports/the-binding-price.md (seconds)
```
