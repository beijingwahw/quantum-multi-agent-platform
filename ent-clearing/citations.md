# Citations — ent-clearing

Every new reference was double-sourced before enrollment (publisher + independent archive or institutional page). In-book physics (WZ82 no-cloning, Holevo chi, the Landauer tariff) is anchored to the sibling repos that verified them — this desk cites them the way a clearing house cites the central bank's published schedule.

## New in this repo

- **BBC93** — C. H. Bennett, G. Brassard, C. Crépeau, R. Jozsa, A. Peres, W. K. Wootters, "Teleporting an unknown quantum state via dual classical and Einstein-Podolsky-Rosen channels", *Phys. Rev. Lett.* **70**, 1895–1899 (1993). doi:10.1103/PhysRevLett.70.1895.
  - Source 1: APS, https://link.aps.org/doi/10.1103/PhysRevLett.70.1895
  - Source 2: PubMed PMID 10053414, https://pubmed.ncbi.nlm.nih.gov/10053414/ (public full-text mirror also hosted at iimas.unam.mx)
  - Used for: the redemption trade (E1) — 1 ebit + 2 cbits delivers an unknown qubit and destroys the pair. The machine executes the full channel; the citation anchors the protocol's provenance.

- **BW92** — C. H. Bennett, S. J. Wiesner, "Communication via one- and two-particle operators on Einstein-Podolsky-Rosen states", *Phys. Rev. Lett.* **69**, 2881–2884 (1992). doi:10.1103/PhysRevLett.69.2881.
  - Source 1: APS, https://link.aps.org/doi/10.1103/PhysRevLett.69.2881
  - Source 2: IBM Research publication page, https://research.ibm.com/publications/communication-via-one-and-two-particle-operators-on-einstein-podolsky-rosen-states
  - Used for: the reverse quote (E2) — 1 transmitted qubit + the shared coin carries exactly 2 cbits.

- **BBPS96** — C. H. Bennett, G. Brassard, S. Popescu, B. Schumacher, J. A. Smolin, W. K. Wootters, "Purification of Noisy Entanglement and Faithful Teleportation via Noisy Channels", *Phys. Rev. Lett.* **76**, 722–725 (1996). doi:10.1103/PhysRevLett.76.722. **Erratum**: *Phys. Rev. Lett.* **78**, 2031 (1997), doi:10.1103/PhysRevLett.78.2031 — recorded as part of the citation, per house honesty rules.
  - Source 1: APS, https://link.aps.org/doi/10.1103/PhysRevLett.76.722 (erratum listed on the article page)
  - Source 2: arXiv:quant-ph/9511027, https://arxiv.org/abs/quant-ph/9511027
  - Used for: netting (E4/E7). v0.2.0: the recurrence round is EXECUTED exactly at n = 2, 3, 4 (bilateral CNOT, sacrifice measurement, agreement post-selection, depolarizing step realized as the exact 24-element local-Clifford isotropic twirl); the closed forms p = F² + 2F(1−F)/3 + 5(1−F)²/9 and F' = (F²+(1−F)²/9)/p recompute to 1e-12. The multi-copy HASHING asymptote (rate 1 − H(λ), positive above F ≈ 0.8107) remains quoted with this citation, never claimed as machine output.

- **VIDAL00** — G. Vidal, "Entanglement monotones", *J. Mod. Opt.* **47**(2–3), 355–376 (2000). doi:10.1080/09500340008244048.
  - Source 1: Taylor & Francis, https://www.tandfonline.com/doi/abs/10.1080/09500340008244048
  - Source 2: arXiv:quant-ph/9807077, https://arxiv.org/abs/quant-ph/9807077
  - Used for: the mint wall's theorem side (E5) — convex-roof monotones do not increase under LOCC on average. The machine contributes the census testimony; the theorem is the court, cited. The conservation ledger (E8) instantiates the same monotonicity per settlement op, exactly.

- **VW02** — G. Vidal, R. F. Werner, "Computable measure of entanglement", *Phys. Rev. A* **65**, 032314 (2002). doi:10.1103/PhysRevA.65.032314.
  - Source 1: APS, https://link.aps.org/doi/10.1103/PhysRevA.65.032314
  - Source 2: arXiv:quant-ph/0102117, https://arxiv.org/abs/quant-ph/0102117
  - Used for: the GHZ bank's cut measure (E9) — the negativity N(ρ) = (‖ρ^{T_S}‖₁ − 1)/2 implemented here (partial transpose in `core/channels.ts`) is an LOCC monotone by this paper. The machine contributes the 150-round local-channel census and the exact withdrawal identities; the monotonicity theorem is the court, cited.

- **ZANG25** — A. Zang, X. Chen, E. Chitambar, M. Suchara, T. Zhong, "No-Go Theorems for Universal Entanglement Purification", *Phys. Rev. Lett.* **134**, 190803 (2025). doi:10.1103/PhysRevLett.134.190803.
  - Source 1: APS, https://link.aps.org/doi/10.1103/PhysRevLett.134.190803
  - Source 2: arXiv:2407.21760, https://arxiv.org/abs/2407.21760
  - Used for: modern context on the purification desk's ceiling (E7) — no universal purification scheme exists for the class of states this no-go covers. Cited as a bound on what any desk can promise; not executed here.

- **LAMI24** — L. Lami, B. Regula, "Distillable entanglement under dually non-entangling operations", *Nat. Commun.* **15**, 10120 (2024). doi:10.1038/s41467-024-53816-w.
  - Source 1: Nature Communications / PMC, https://pmc.ncbi.nlm.nih.gov/articles/PMC11584706/
  - Source 2: arXiv:2307.11008, https://arxiv.org/abs/2307.11008
  - Used for: the exact-solution context of distillable entanglement (E7's boundary) — under dually non-entangling operations the distillable entanglement has a computable exact form. Cited; the operations are not LOCC and nothing here is executed on them.

## Anchored in-book (not re-verified here)

- **WZ82** (no-cloning as notary) — anchored to `quantum-mech` (its citations and machine execution).
- **Holevo ceiling** (the optimality half of E3) — anchored to `switch-sched` / `readout-wall` (the χ caliber used across the workspace).
- **Landauer / readout tariff** (E6's kT ln 2 per bit) — anchored to `readout-wall` and `vacuum-compiler` (#11's settled schedule).
- **Wootters concurrence** (the E_F currency) — the formula implemented here is the one machine-executed in `quantum-mech`'s monogamy module; the formula's provenance (Wootters 1998) lives in that repo's bibliography.
