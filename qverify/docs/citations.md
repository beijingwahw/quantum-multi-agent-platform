# Citations — all web-verified against original sources (2026-09-08)

1. **UBQC** — A. Broadbent, J. Fitzsimons, E. Kashefi, "Universal Blind
   Quantum Computation", FOCS 2009. arXiv:0807.4154.
   Client prepares single-qubit states from a finite set and sends them to a
   server; interactive classical communication; blindness + authentication.
   Verified: arxiv.org/abs/0807.4154.

2. **FK verification** — J. F. Fitzsimons, E. Kashefi, "Unconditionally
   verifiable blind quantum computation", Phys. Rev. A 96, 012303 (2017).
   arXiv:1203.5217. Trap-based detection of a cheating server on top of UBQC.
   Verified: arXiv id + PRA record located via APS link
   (doi:10.1103/PhysRevA.96.012303). NOTE: my first-guess id 1206.2364 was
   wrong (a math paper) — caught by source verification.

3. **RUV rigidity** — S. Reichardt, F. Unger, T. Vidick, "A classical leash
   for a quantum system: trusted classical control of quantum computation",
   arXiv:1209.0448 (Nature version: "Classical command of quantum systems",
   Nature 496, 456 (2013)). CHSH-game rigidity lets a classical verifier
   command entangled provers.
   Verified: arxiv.org/abs/1209.0448.

4. **Mahadev** — U. Mahadev, "Classical Verification of Quantum
   Computations", FOCS 2018. arXiv:1804.01082. Fully classical verifier under
   LWE.
   Verified: arxiv.org/abs/1804.01082.

5. **Composable security** — V. Dunjko, E. Kashefi, A. Leverrier,
   "Composable security of delegated quantum computation", arXiv:1301.3662
   (TCC 2014 version). Distinguishes blindness-only vs verifiable delegated
   protocols.
   Verified: arxiv.org/abs/1301.3662 (my first-guess prefix "1601" was wrong —
   corrected by search).

6. **Horodecki criterion** — R. Horodecki, P. Horodecki, M. Horodecki,
   "Violating Bell inequality by mixed spin-1/2 states: necessary and
   sufficient condition", Phys. Lett. A 200, 340 (1995).
   doi:10.1016/0375-9601(95)00214-N. S_max = 2√(u₁+u₂) with u the top
   eigenvalues of TᵀT; violation iff u₁+u₂ > 1.
   Verified via multiple secondary sources + DOI; the exact S_max = 2√(m₁+m₂)
   statement confirmed.

7. **Bužek–Hillery cloning** — V. Bužek, M. Hillery, "Quantum copying: beyond
   the no-cloning theorem", Phys. Rev. A 54, 1844 (1996); universal 1→2 qubit
   cloner, single-copy fidelity exactly 5/6. Follow-up: arXiv:quant-ph/9607018.
   Verified: 5/6 optimality for universal symmetric 1→2 cloning (multiple
   sources; RMP review Scarani et al., Rev. Mod. Phys. 77, 1225 (2005)).

8. **Classical shadows** — H.-Y. Huang, R. Kueng, J. Preskill, "Predicting
   many properties of a quantum system from very few measurements", Nature
   Physics 16, 1050 (2020). arXiv:2002.08953.
   Verified: arxiv.org/abs/2002.08953 + Nature Physics record.

9. **Experimental verification** — S. Barz, J. F. Fitzsimons, E. Kashefi,
   P. Walther, "Experimental verification of quantum computations", Nature
   Physics 9, 727 (2013). arXiv:1309.0005. Photonics demo of verifiable
   blind computation. (My "2012" memory was the group's Science blind-computing
   demo; the verification paper is 2013 — corrected by verification.)
   Verified: arxiv.org/abs/1309.0005.

10. **Sample-complexity wall** — D. Hangleiter, M. Kliesch, J. Eisert,
    C. Gogolin, "Sample complexity of device-independently certified 'quantum
    supremacy'", Phys. Rev. Lett. 122, 210502 (2019).
    Verified: APS listing located by search.

11. **RCS review** — D. Hangleiter, J. Eisert, "Computational advantage of
    quantum random sampling", Rev. Mod. Phys. 95, 035001 (2023).
    arXiv:2206.04079. XEB verification limits, spoofing discussion.
    Verified: arxiv.org/abs/2206.04079.

12. **Kaniewski self-testing bounds (v0.2 anchor)** — J. Kaniewski, "Analytic
    and nearly optimal self-testing bounds for the Clauser-Horne-Shimony-Holt
    and Mermin inequalities", Phys. Rev. Lett. 117, 070402 (2016).
    arXiv:1604.08176. Source of the census anchors: the linear extractability
    bound Q(β) ≥ 1/2 + ½(β−β*)/(2√2−β*) (Eq. (10)) and the trivial upper
    barrier (Eq. (4)), with threshold β* = (16+14√2)/17 ≈ 2.1058. Adopted as
    bound shapes (data), not re-derived.
    Verified: full text via arxiv.org/html/1604.08176v3 (equations quoted
    verbatim, incl. β* = (16+14√2)/17 in the abstract) + APS listing
    (doi:10.1103/PhysRevLett.117.070402) via search + independent
    confirmation of the bound shape in Piwecki, Christandl, Rosset, "Robust
    self-testing of two-qubit states" (arXiv:1902.00870, Fig. 1).

13. **Bancal numerical threshold** — J.-D. Bancal, M. Navascués, V. Scarani,
    T. Vértesi, T. H. Yang, "Physical characterization of quantum devices
    from nonlocal correlations", Phys. Rev. A 91, 022115 (2015).
    arXiv:1307.7053. Non-trivial plain singlet fidelity above β ≈ 2.37
    (swap trick + see-saw numerics). Cited only — the numerics are not
    reproducible in-repo. (Note: my first-guess attribution "multipartite
    entanglement witnesses" was a different 2011 Bancal paper — caught by
    source verification.)
    Verified: APS record (doi:10.1103/PhysRevA.91.022115) via search +
    arxiv.org/abs/1307.7053.

14. **Shadow median-of-means** — W. Fu, "Classical Shadows with Improved
    Median-of-Means Estimation", arXiv:2412.03381; published as IOP Quantum
    Science and Technology (2025). Cited as context for the MoM constants
    behind the shadow sample counts.
    Verified: arxiv.org/abs/2412.03381 + IOP record via search.

15. **Single-copy shadow lower bounds** — A. Lowe, M. Moshkovitz, A. Parekh,
    A. Segev, "Lower Bounds for Learning Quantum States with Single-Copy
    Measurements", arXiv:2207.14438; journal version in ACM (2025),
    doi:10.1145/3717450. Matching O(min{d,M} log M / ε²) bounds.
    Verified: arxiv.org/abs/2207.14438 (pdf) + ACM listing via search.

16. **XEB pitfalls (2024)** — "Limitations of Linear Cross-Entropy as a
    Measure for Quantum Advantage", PRX Quantum 5, 010334 (2024); and
    A. Tanggara, M. Gu, K. Bharti, "Classically Spoofing System Linear Cross
    Entropy Score Benchmarking", arXiv:2405.00789 (2024). Anchors for the
    census's spoof caveat. (My first-guess author attribution for 2405.00789
    was wrong — caught by reading the arXiv page.)
    Verified: APS record via search + arxiv.org/abs/2405.00789 (authors
    quoted verbatim from the abstract page).

## Verification notes

- arXiv was unreachable via direct fetch from this network (connection
  resets); verification went through the web-reader channel and web search
  (which returned arXiv/APS records with title, authors, year, abstracts).
- Two of my initial arXiv ids from memory were wrong (1206.2364 → FK is
  1203.5217; "1601.xxxxx" for DKL → 1301.3662), and one year was off (Barz
  verification: 2013, not 2012). All corrected — the whole point of
  source-verifying every citation.
