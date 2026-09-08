# Citation register — every reference web-verified on 2026-09-05

Discipline: no citation ships from memory. Each entry below was verified
against the publisher page or arXiv abstract during this build; two of my
own memory-stored identifiers were WRONG and are recorded as corrections.
New 2026-09-08 entries (the process-witness face) were each verified against
TWO independent sources before adoption, with the verification route noted.

## Core theory

1. **Chiribella, D'Ariano, Perinotti, Valiron — "Quantum computations without
   definite causal structure"**
   Phys. Rev. A 88, 022318 (2013). arXiv:0912.0195 (v1 Dec 2009).
   <https://arxiv.org/abs/0912.0195> ·
   <https://link.aps.org/doi/10.1103/PhysRevA.88.022318>
   Used for: the quantum switch supermap; irreducibility (fixed-order
   simulation needs postselection or an extra query); the involution/
   commutation query task. Abstract quote relied upon: "Simulating these
   transformations in a circuit with fixed causal structure requires either
   postselection, or an extra query to the input black boxes."
   *Memory correction: the arXiv id is 0912.0195 (2009), not a 2013 number.*

2. **Oreshkov, Costa, Brukner — "Quantum correlations with no causal order"**
   Nat. Commun. 3, 1092 (2012). doi:10.1038/ncomms2076. arXiv:1105.4464.
   <https://www.nature.com/articles/ncomms2076>
   Used for (v0.2.0, the process-witness face): the CJ convention
   M = [I ⊗ Λ(|ϕ+⟩⟨ϕ+|)]^T (Methods Eq. 20-23), the process matrix Eq. (7)
   W = ¼[𝟙 + (σ_z^{A2}σ_z^{B1} + σ_z^{A1}σ_x^{B1}σ_z^{B2})/√2], the causal
   inequality 3/4 vs the process value (2+√2)/4 (Eq. 8), and the Fig. 3
   term-type classification. The Eq. (7) operator was extracted from TWO
   independent renderings (ar5iv.labs.arxiv.org/html/1105.4464 and
   nature.com/articles/ncomms2076, both fetched 2026-09-08) — the two agree;
   an earlier mangled extraction with A1A2/B1B2 terms was discarded because
   those term types are forbidden by the paper's own Fig. 3.

3. **Ebler, Salek, Chiribella — "Enhanced Communication with the Assistance
   of Indefinite Causal Order"**
   Phys. Rev. Lett. 120, 120502 (2018). arXiv:1711.10165.
   <https://link.aps.org/doi/10.1103/PhysRevLett.120.120502> ·
   <https://arxiv.org/abs/1711.10165>
   Used for: priority of the zero+zero→positive capacity theorem (switched
   completely depolarizing channels). We machine-certify positive accessible
   information from first principles; the optimal-capacity optimisation is
   cited, not reproduced.
   *Memory correction: PRL 120, 120502 / arXiv:1711.10165 — NOT New J. Phys.
   20, 113023 / arXiv:1712.07170 as first recalled.*

## Experiments

4. **Procopio et al. — "Experimental superposition of orders of quantum gates"**
   Nat. Commun. 6, 7913 (2015). arXiv:1412.4006.
   <https://www.nature.com/articles/ncomms8913>
   *Memory correction: arXiv:1412.4006, not 1412.0664.*

5. **Rubino et al. — "Experimental quantum communication through superposition
   of causal order"** Sci. Adv. 3, e1602589 (2017).

6. **Goswami et al. — "Indefinite Causal Order in a Quantum Switch"**
   Phys. Rev. Lett. 121, 090503 (2018). arXiv:1803.04302.
   <https://link.aps.org/doi/10.1103/PhysRevLett.121.090503>
   Used for: causal-nonseparability witnesses (our control-displacement
   witness is the operational slice; full certification is their framework).

7. **van der Lugt, Barrett, Chiribella — "Device-independent certification of
   indefinite causal order in the quantum switch"**
   Nat. Commun. 14, 5811 (2023). doi:10.1038/s41467-023-40162-8.
   <https://www.nature.com/articles/s41467-023-40162-8>
   Used for: the note that the isolated switch does not violate causal
   inequalities (order superposition ≠ relativistic causality violation).
   v0.2.0: this note now has a machine number in-repo — the switch plays the
   OCB game at exactly 5/8 < 3/4 (canonical instruments; exp5 §6).
   *Correction (2026-09-08, flagged by the sibling causal-ineq agent): the
   article number was 5807 as first filed — 5811 is the identifying number;
   re-verified against nature.com and PMC (Nat Commun. 2023 Sep 19;14:5811,
   doi: 10.1038/s41467-023-40162-8) before writing.*

8. **Follow-up (context only):** "Indefinite causal order enables perfect
   quantum communication with zero capacity channels", New J. Phys. (2021).
   <https://iopscience.iop.org/article/10.1088/1367-2630/abe7a0>

## 2023–2026 frontier (added 2026-09-08, two-source verified each)

9. **Guo, Tang, Wang, Lv, Fan, Hu, Huang, Liu, Guo, Chiribella, Liu —
   "Experimental violation of a Bell-like inequality for causal order"**
   Science Advances 12(24), eadv... arXiv:2506.20516 (submitted 25 Jun 2025).
   <https://arxiv.org/abs/2506.20516> ·
   <https://www.science.org/doi/10.1126/sciadv.aee2912>
   Verification: arXiv abstract page (direct) + Science Advances DOI
   10.1126/sciadv.aee2912, Vol. 12, No. 24 (via search-indexed journal page;
   science.org itself bot-blocks direct fetch — noted honestly).
   Used for: the 2025/2026 experimental turn — first photonic violation of a
   Bell-like CAUSAL inequality (order-superposition platform). Anchored, not
   reproduced; no machine claim made against it.

10. **Richter, Antesberger, Cao, Walther, Rozema — "Towards an Experimental
    Device-Independent Verification of Indefinite Causal Order"**
    arXiv:2506.16949 (submitted 20 Jun 2025); conference version "Towards a
    Device Independent Proof of Indefinite Causal Order with a Quantum
    Switch", DOI 10.13643/quantum.2025.qm3b.2.
    <https://arxiv.org/abs/2506.16949> ·
    <https://ucrisportal.univie.ac.at/en/publications/towards-a-device-independent-proof-of-indefinite-causal-order-wit/>
    Verification: arXiv abstract page (direct) + University of Vienna u:cris
    portal (direct) — author list identical on both.
    Used for: the device-independent line (quantum switch + untrusted
    devices, Bell-like inequality). Anchored, not reproduced.

11. **Dourdent et al. — network device-independent certification of
    indefinite causal order** Quantum 8, 1514 (Oct 2024).
    <https://quantum-journal.org/papers/q-2024-10-30-1514/>
    Verification: journal page (search-confirmed; single-source on this
    visit — carried as CONTEXT ONLY, no in-repo claim rests on it).
    Used for: context on the certification program; nothing machine-checked.
