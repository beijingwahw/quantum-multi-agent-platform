# Citations — stable-world

Every new reference was double-sourced before enrollment (publisher/archive + independent institutional page). In-book physics (the kT·ln2 schedule, the marked-world semantics, the membership charge) is anchored to the sibling repos that verified them — this page cites them the way a power plant cites the central bank's published rate.

## New in this repo

- **LYAP92** — A. Liapounoff [A. M. Lyapunov], "Problème général de la stabilité du mouvement", *Annales de la Faculté des sciences de l'Université de Toulouse pour les sciences mathématiques et physiques*, Série 2, Tome 9 (1907), pp. 203–474. French translation of the 1892 Kharkov doctoral dissertation "Общая задача об устойчивости движения". doi:10.5802/afst.246.
  - Source 1: Numdam, https://www.numdam.org/item/AFST_1907_2_9__203_0/ (full text, free access)
  - Source 2: AFST Centre Mersenne (the journal's own repository), https://afst.centre-mersenne.org/articles/10.5802/afst.246/
  - Used for: the stability-certificate concept (AT3) — a fixed point is certified stable by a functional that decreases along trajectories off it. The machine executes the monotone functional on density matrices; the citation anchors the method's provenance, not the quantum claim.

- **NAC00** — M. A. Nielsen, I. L. Chuang, *Quantum Computation and Quantum Information*, Cambridge University Press (2000; 10th Anniversary Edition 2010). doi:10.1017/CBO9780511976667.
  - Source 1: Cambridge University Press, https://www.cambridge.org/highereducation/books/quantum-computation-and-quantum-information/01E10196D0A682A6AEFFEA52D53BE9AE
  - Source 2: bibliographic record cross-checked against Wikipedia's citation of the 2000 first edition, https://en.wikipedia.org/wiki/Quantum_Computation_and_Quantum_Information
  - Used for: the amplitude-damping channel family (Ch. 8) that the law instantiates (damping INTO the marked world, Ch.-convention inverted and defined explicitly in `law.ts`); also the general density-matrix formalism. Provenance anchor — every closed form here is re-derived by the witnesses, never transcribed.

- **BCP14** — T. Baumgratz, M. Cramer, M. B. Plenio, "Quantifying Coherence", *Physical Review Letters* 113, 140401 (2014). doi:10.1103/PhysRevLett.113.140401.
  - Source 1: APS, https://link.aps.org/doi/10.1103/PhysRevLett.113.140401
  - Source 2: arXiv:1311.0275, https://arxiv.org/abs/1311.0275 (verified — the preprint number is 1311.0275; writing it from memory produced 1310.6190, the citation-drift class caught at the source)
  - Used for: the relative entropy of coherence C_rel(ρ) = S(ρ_diag) − S(ρ) and its monotonicity under incoherent operations (AT7) — the theorem behind the erasure census. The machine witnesses the monotonicity as a census on the law's own trajectories and the closed-form values exactly; the citation anchors the theorem's provenance, not the arithmetic.

- **BIPM19** — BIPM, *The International System of Units (SI)*, 9th edition (2019; current version 4.01). k = 1.380 649 × 10⁻²³ J K⁻¹ exactly (defines the kelvin); h = 6.626 070 15 × 10⁻³⁴ J s exactly (defines the kilogram).
  - Source 1: BIPM SI Brochure 9th ed. EN PDF, https://www.bipm.org/documents/20126/41483022/SI-Brochure-9-EN.pdf
  - Source 2: NIST Special Publication 330 (2019), The International System of Units (SI), https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.330-2019.pdf
  - Used for: the exact-SI arithmetic of the thermal readings (AT8) — βΔE = hf/(kT) needs both constants exact, so the 5 GHz / 10 mK anchors carry no measurement error by construction.

- **DAV74** — E. B. Davies, "Markovian master equations", *Communications in Mathematical Physics* 39(2), 91–110 (1974). doi:10.1007/BF01608389.
  - Source 1: bibliographic record cross-checked via Google Scholar's Davies profile (CMP 39(2), 91–110, 1974) and Semantic Scholar, https://www.semanticscholar.org/paper/b223bf1d3a7b8c765893ceaf3480e4fa9586922b
  - Source 2: cited verbatim (volume/pages/DOI) by Dann, Rossi et al., "Quantum thermo-dynamical construction for driven open systems" and by arXiv:2507.10080 — two independent bibliographic witnesses agree on **1974** (the 1976 "Markovian master equations II" lives in Math. Ann. 219 — the year was the memory's contribution, the sources corrected it)
  - Used for: the weak-coupling tradition AT9 executes a discrete shadow of (repeated interactions with resonant Gibbs qubits; detailed balance and the Davies generator). The machine executes the collision model exactly; the continuum weak-coupling limit is cited, not executed — that is the row's own stated boundary.

- **WY16** — A. Winter, D. Yang, "Operational Resource Theory of Coherence", *Physical Review Letters* 116, 120404 (2016). doi:10.1103/PhysRevLett.116.120404.
  - Source 1: APS, https://link.aps.org/doi/10.1103/PhysRevLett.116.120404
  - Source 2: arXiv:1506.07975, https://arxiv.org/abs/1506.07975 (re-verified this visit: title/authors/journal reference confirmed on the arXiv abstract page — PRL 116, 120404 (2016))
  - Used for: the operational backdrop of AT10's banking claim — coherence's work value under incoherent operations (distillation/dilution). The machine banks the straddler's full bit on the weight exactly (free-energy excess = kT ln2 witnessed); what WY16's framework prices beyond that (asymptotic distillation rates) is cited, not re-derived. AT15 keeps exactly this split: the bounded catalyst face is executed, the asymptotic face stays cited.

## New this visit (v0.6.0 — the holder, the second world, the accumulated error)

- **OH02** — J. Oppenheim, M. Horodecki, P. Horodecki, R. Horodecki, "Thermodynamical Approach to Quantifying Quantum Correlations", *Physical Review Letters* 89, 180402 (2002). doi:10.1103/PhysRevLett.89.180402.
  - Source 1: APS, https://link.aps.org/doi/10.1103/PhysRevLett.89.180402
  - Source 2: PubMed record 12398585 (PRL 89(18):180402, 2002), https://pubmed.ncbi.nlm.nih.gov/12398585/ — preprint arXiv:quant-ph/0112074; note the PUBLISHED version credits four authors (an early preprint listing is sometimes cited with five — the sources corrected this)
  - Used for: the work-deficit backdrop of AT15 — work extraction from bipartite correlations, global vs local, and the gap a classical record fails to close. The machine executes this repo's exact shadow: the nested-triangle ladder (naive → aligned → conditional) with the residual priced as data; OH02's asymptotic deficit theory is the cited frame, not a re-derived claim.

- **LB21** — P. Lipka-Bartosik, P. Skrzypczyk, "All States are Universal Catalysts in Quantum Thermodynamics", *Physical Review X* 11, 011061 (2021). doi:10.1103/PhysRevX.11.011061.
  - Source 1: arXiv:2006.16290, https://arxiv.org/abs/2006.16290
  - Source 2: the PRX record as indexed (PRX 11, 011061 (2021)) via independent search coverage of link.aps.org/doi/10.1103/PhysRevX.11.011061
  - Used for: the catalytic contrast class for AT15 — with UNBOUNDED (many-copy) catalysts, majorization-resource theories make every state universal. This repo deliberately bounds the catalyst (d_c = 2, cap log2 d_c = 1 bit) and claims nothing asymptotic; LB21 marks exactly the territory left uncited-into.

- **CZJ24** — J. Czartowski, A. de Oliveira Junior, "Catalytic transformations for thermal operations", *Physical Review Research* 6, 033203 (2024). doi:10.1103/PhysRevResearch.6.033203.
  - Source 1: arXiv:2403.04845, https://arxiv.org/abs/2403.04845 (abstract page confirms journal reference PRR 6, 033203 (2024))
  - Source 2: independent search-index coverage of the PRR bibliographic record (volume/article/year agreeing)
  - Used for: the strict-catalysis framing of AT15 — a catalyst returned unchanged, with lower bounds on how large it must be to help. The machine's catalyst is finite and single-shot (the weight, d_c = 2); CZJ24's dimensional-tradeoff results are the recent literature anchor for why the bound is the story.

## Anchored in-book (not re-verified here)

- **The kT·ln2 erasure schedule per bit at 300 K / 10 mK** (AT5) — anchored to `route-price` (D1-P1: k exact SI 2019, ln2 by quadrature, E(300 K) = 2.87098e−21 J, E(10 mK) = 9.56993e−26 J) and behind it the settled ledger row #11 (`vacuum-compiler`).
- **h2(0.025) = 0.168660931** — cross-anchored to `depreciation-ledger`'s own witness W-E (the two books share one anchor on purpose).
- **The membership charge and the engineered-program semantics** (AT1/AT3) — anchored to `choice-lang` (R2/R6).
- **The discrete-Noether implication shape note** (AT3) — anchored to `dsic-noether`, with exactly the "noted, not claimed" discipline of choice-lang R6.
