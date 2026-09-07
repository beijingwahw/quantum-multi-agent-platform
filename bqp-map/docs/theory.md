# bqp-map — Theory Layer

Roadmap #7: the BQP × NP complexity atlas for scheduling. Every scheduling
problem class gets a verdict — **which can never be accelerated** (in a stated
model), **which only waits for hardware** — and every verdict carries a
certificate that `npm test` re-executes.

## Positioning (prior work, honestly drawn)

Complexity-theoretic facts about scheduling are among the oldest results in
the field (Garey-Johnson 1975/1978), and the quantum query landmarks are
equally canonical (Grover 1996, BBBV 1997, Dürr-Høyer 1996, BBHT 1998). What
exists in the literature is *paper*: lemmas, reductions, and class
inclusions. What does **not** exist — and what this prototype delivers — is
the **machine verification of the certificate layer**:

- the NP-hardness reductions of scheduling, **executed** and checked
  instance-by-instance against exact solvers (exp1);
- the classical search wall **enumerated over all decision trees**, not
  quoted (exp3);
- the BBBV hybrid argument **computed** on exact state evolutions, with a
  machine-precision exact anchor at q = 1 (exp3);
- the (2q+1)²/N black-box cap **applied to a scheduling instance** while the
  pseudo-polynomial DP walks around it — the model-relativity of walls,
  demonstrated with numbers (exp3 part D);
- the NP-witness / QMA-witness verification trade **measured** (sampling law,
  completeness and soundness, exp4);
- the StoqMA/QMA boundary **located exactly** (max off-diagonal = −Γ vs +κ,
  exp4).

The atlas registry (src/atlas/entries.ts) is the deliverable; the discipline
checker enforces that **claims without certificates do not ship**.

## The theorem layer, T1–T5

**T1 — Executable reductions.**
`Partition ≤m P2||Cmax` (weak hardness carrier) and `3-Partition ≤m P||Cmax`
(strong hardness carrier) as identity maps with machine-checked equivalences:
random sweeps, exhaustive instance-shape sweeps (every multiset at n=5,
values 1..8), and an exhaustive 3-partition referee. Optimal schedules of
YES instances **decode** into partitions (exactly 3 jobs per machine, every
machine summing to B). The FPTAS for P2||Cmax is implemented with its
(1+ε)-ratio machine-verified against the exact DP — the executable half of
the weak/strong dichotomy (GJ78: strong hardness excludes FPTAS unless P=NP).
Johnson's rule is verified optimal against all-permutation brute force (the
P island). The Ising encoding satisfies `Q(z) = (2·C(z) − total)²`
per configuration, exactly, and its ground state matches the DP optimum.

**T2 — Quantum upper bounds.**
Exact Grover machinery: closed form sin²((2k+1)θ) and state-vector evolution
agree to 1e-12; the optimal iteration count k* tracks (π/4)√N; the classical
wall q/N is reported at the same query budget. Dürr-Høyer minimum finding is
executed with per-query accounting (Grover iterations + threshold
comparisons) and Born-sampled measurements; correctness is re-verified
against the exhaustive argmin, and the query count scales as √N (log-log
slope ≈ 0.5) — on synthetic arrays **and** on the 2^n assignment space of
real P2||Cmax instances, where DH returns the exact DP optimum.

**T3 — The walls, executed.**
*Classical side*: the FULL decision-tree model (adaptive, re-querying,
post-success continuation included) is enumerated exhaustively at (N,q) up
to (8,3) — 2,097,152 trees. Max uniform success = q/N exactly; worst-case
certainty requires q ≥ N. This is Yao's ingredient: every deterministic
tree is capped, hence every randomized algorithm too.
*Quantum side*: the BBBV hybrid lemma `‖ψ_q^x − ψ_q^0‖ ≤ 2q/√N` and its
corollary `success ≤ (2q+1)²/N` are computed on the actual evolutions for
all x over a q-grid; the q = 1 anchor `dist = 2/√N` holds to machine
precision. Part D applies the cap to a scheduling instance's black box while
the DP bypasses it — the atlas's central honesty clause: **walls are
model-relative** (black-box / conditional / information-theoretic), and each
atlas row says which model its wall lives in.

**T4 — Witness verification.**
One scheduling instance, both witnesses: the classical bitstring verifies in
one exact evaluation; the quantum state verifies by Born sampling with
median error following the 1/√m law (measured slope ≈ −0.5). The
Hoeffding shot count `m ≥ R²·ln(2/δ)/(2ε²)` is Monte-Carlo checked on both
sides: completeness (honest states accepted ≥ 1−δ) and soundness (cheating
states with ⟨H⟩ ≥ B + 2ε rejected ≥ 1−δ). The stoquastic dichotomy is exact:
ZZ couplers of any sign are diagonal; the −ΓX driver contributes exactly −Γ
off-diagonal; one +κXX edge contributes exactly +κ. Max off-diagonal −Γ vs
+κ — the machine-checked boundary between StoqMA territory (BDOT08) and
QMA-complete 2-local territory (KKR06).

**T5 — The atlas.**
A typed registry of scheduling problem classes, each annotated with classical
status, quantum upper bound, quantum lower barrier, and a verdict from a
fixed taxonomy. The discipline map binds verdicts to required certificate
kinds (e.g. QUERY-WALL requires the machine BBBV certificate); citations
must resolve to the bibliography below; cross-prototype certificates must
point at workspace prototypes that exist on disk. exp5 renders
`out/reports/atlas.md` + `atlas.json`.

## Verdict taxonomy

| verdict | meaning | wall model |
| --- | --- | --- |
| P-EXACT | already exactly polynomial | trivial |
| CONDITIONAL-WALL | NP-hard; exact poly quantum ⟹ NP ⊆ BQP | conditional (one shared, visible assumption) |
| QUERY-WALL | black-box success ≤ (2q+1)²/N | oracle/black-box |
| HW-WAIT | certified speedup awaiting hardware | none — it's a door, not a wall |
| INFO-WALL | information-theoretic (online/adversarial) | informational |
| VERIFICATION-GAP | witness structure changes (QMA/StoqMA) | verification semantics |
| HEURISTIC | empirical claims only | none claimed |
| MECHANISM-SETTLED | mechanism property settled by exact algebra in a workspace prototype (positive or no-go) | physics, not search speed |
| OPEN | precisely stated open question | n/a |

## Honest boundaries

1. **No new separations.** Unconditional complexity-class separations (even
   P vs NP, a fortiori NP vs BQP) are beyond current mathematics; every
   "never" in this atlas is (i) trivially true (P-EXACT), (ii) conditional on
   NP ⊄ BQP (one visible shared assumption), (iii) oracle/black-box model
   (BBBV), or (iv) information-theoretic (online). The atlas's contribution
   is making each wall **certificate-backed and model-labeled**, not
   inventing new ones.
2. **Finite verification is finite.** The decision-tree sweeps and BBBV
   checks verify concrete sizes (up to N = 2^22 trees, N = 4096 states);
   the statements for ALL sizes rest on the cited theorems, which the
   finite checks anchor — the direction of evidence is theorem → machine
   anchor, never the reverse.
3. **Grover-optimality constants.** The BBBV corollary (2q+1)²/N is loose by
   a constant; the tight quantum lower bound Θ(√N) and the optimal π/4
   prefactor are the cited theorem's. exp3 reports both, separately.
4. **Strong-NP-hardness attributions.** P||Cmax with machine count in the
   input is strongly NP-hard via 3-Partition (GJ75, machine-checked tail of
   the chain). The atlas deliberately avoids claims about **fixed** m ≥ 3
   strong hardness — the classic trap in this corner of the literature.
5. **QMA vs NP is open.** The VERIFICATION-GAP rows describe witness
   structure (what a quantum witness buys and costs), not a separation.
6. **The DH implementation** samples the exact Born distribution per seed;
   failure probabilities are bounded in theory and zero-observed in every
   seed we ran — reported as measured, not as a guarantee.
7. **The genealogy rows are enrollments, not endorsements.** Far-future
   claims (postselection sorting, retrocausal caching, vacuum computing,
   entanglement settlement, DSIC-as-Noether) enter the atlas under the same
   discipline as every scheduling row: verdict, certificate, wall model,
   cost. PostBQP = PP is cited (AAR04), not re-proven — exp6 executes the
   cost accounting and the counting-ratio readout. No-signaling is quantum
   mechanics' own (GRW80), executed on exact instances; superquantum
   theories are out of scope. MECHANISM-SETTLED rows carry no
   complexity-class content: they record where physics (not search speed)
   settles a mechanism question, positive or no-go. The latency floor
   distance/c is special relativity quoted, not derived here.

## Bibliography (every id web-verified at build time of this document; see memory/2026-09-05)

- **BBBV97** — C.H. Bennett, E. Bernstein, G. Brassard, U. Vazirani, "Strengths and Weaknesses of Quantum Computing", SIAM J. Comput. 26(5):1510–1523 (1997). arXiv:quant-ph/9701001. [Quantum search cannot beat quadratic on unstructured oracles; the hybrid argument.]
- **GJ75** — M.R. Garey, D.S. Johnson, "Complexity Results for Multiprocessor Scheduling Under Resource Constraints", SIAM J. Comput. 4(4):397–411 (1975). [3-Partition strongly NP-complete; multiprocessor scheduling hardness.]
- **GJ78** — M.R. Garey, D.S. Johnson, "'Strong' NP-Completeness Results", J. ACM 25(2) (1978). doi:10.1145/322077.322090. [Strong NP-hardness excludes pseudo-polynomial algorithms and FPTAS unless P=NP.]
- **GJS76** — M.R. Garey, D.S. Johnson, R. Sethi, "The Complexity of Flowshop and Jobshop Scheduling", Mathematics of Operations Research 1(2):117–129 (1976).
- **JOHNSON54** — S.M. Johnson, "Optimal Two- and Three-Stage Production Schedules with Setup Times Included", Naval Research Logistics Quarterly 1(1):61–68 (1954). [Johnson's rule: F2||Cmax exactly solvable in O(n log n).]
- **KUHN55** — H.W. Kuhn, "The Hungarian Method for the Assignment Problem", Naval Research Logistics Quarterly 2(1–2):83–97 (1955). doi:10.1002/nav.3800020109.
- **HNS01** — P. Høyer, J. Neerbek, Y. Shi, "Quantum Complexities of Ordered Searching, Sorting, and Element Distinctness", Algorithmica 34(4):429–448 (2002). arXiv:quant-ph/0102078. [Ordered searching requires Θ(log N) quantum queries.]
- **DH96** — C. Dürr, P. Høyer, "A Quantum Algorithm for Finding the Minimum", arXiv:quant-ph/9607014 (1996).
- **BBHT98** — M. Boyer, G. Brassard, P. Høyer, A. Tapp, "Tight Bounds on Quantum Searching", Fortschritte der Physik 46:493–506 (1998). arXiv:quant-ph/9605034. [Variable-iteration search schedule used by our DH implementation.]
- **MONT18** — A. Montanaro, "Quantum Walk Speedup of Backtracking Algorithms", Theory of Computing 14(15):1–24 (2018). arXiv:1509.02374.
- **MONT19** — A. Montanaro, "Quantum Speedup of Branch-and-Bound Algorithms", Physical Review Research 2, 013056 (2020). arXiv:1906.10375.
- **BDOT08** — S. Bravyi, D.P. DiVincenzo, R. Oliveira, B.M. Terhal, "The Complexity of Stoquastic Local Hamiltonian Problems", Quantum Information & Computation 8(5):361–385 (2008). arXiv:quant-ph/0606140. [StoqMA.]
- **KKR06** — J. Kempe, A. Kitaev, O. Regev, "The Complexity of the Local Hamiltonian Problem", SIAM J. Comput. 35(5):1070–1097 (2006). arXiv:quant-ph/0406180. [QMA-completeness.]
- **FEY85** — R. P. Feynman, "Quantum mechanical computers", Optics News 11(2):11–20 (1985); reprinted Foundations of Physics 16(6):507–531 (1986). doi:10.1007/BF01886518. [The clock/Hamiltonian model of computation. Web-verified: the journal version followed in 1986.]
- **KSV02** — A. Yu. Kitaev, A. H. Shen, M. N. Vyalyi, "Classical and Quantum Computation", AMS Graduate Studies in Mathematics 47 (2002). ISBN 0-8218-3229-8. [Ch. 14 "Quantum NP": the Feynman–Kitaev clock construction and k-local Hamiltonian QMA-completeness.]
- **LLO96** — S. Lloyd, "Universal Quantum Simulators", Science 273(5278):1073–1078 (1996). doi:10.1126/science.273.5278.1073. [Simulation as spectral compilation.]
- **ROC87** — J.-C. Rochet, "A necessary and sufficient condition for rationalizability in a quasi-linear context", Journal of Mathematical Economics 16(2):191–200 (1987). [Cyclical monotonicity: implementability ⟺ no positive cycle of the allocation 1-form. Web-verified.]
- **GL79** — J. R. Green, J.-J. Laffont, "Incentives in Public Decision-Making", North-Holland, Amsterdam (1979); characterization also in Econometrica 45(2):427–438 (1977). [Groves schemes are the only DSIC mechanisms for efficient social choice. Web-verified.]
- **MW01** — J. E. Marsden, M. West, "Discrete mechanics and variational integrators", Acta Numerica 10:357–514 (2001). doi:10.1017/S096249290100006X. [Discrete Noether theorem: exact momentum-map conservation for variational integrators. Web-verified.]
- **AAR04** — S. Aaronson, "Quantum Computing, Postselection, and Probabilistic Polynomial-Time", Proc. R. Soc. A 461(2063):3473–3482 (2005). arXiv:quant-ph/0412187. [PostBQP = PP. Web-verified: the arXiv id is 0412187 — an earlier draft's 0408336 was wrong and caught at verification.]
- **GRW80** — G.C. Ghirardi, A. Rimini, T. Weber, "A general argument against superluminal transmission through the quantum mechanical measurement process", Lettere al Nuovo Cimento 27:293–298 (1980). doi:10.1007/BF02817189. [No-signaling theorem.]
- **MI22** — X. Mi, M. Ippoliti, et al., "Time-crystalline eigenstate order on a quantum processor", Nature 601:531–536 (2022). doi:10.1038/s41586-021-04257-w. [Discrete time crystal on Sycamore.]
- **LAND61** — R. Landauer, "Irreversibility and Heat Generation in the Computing Process", IBM J. Res. Dev. 5(3):183–191 (1961). doi:10.1147/rd.53.0183. [Erasure costs kT ln 2.]
- **WZ82** — W.K. Wootters, W.H. Zurek, "A single quantum cannot be cloned", Nature 299:802–803 (1982). doi:10.1038/299802a0. [No-cloning.]
- **HJW93** — L.P. Hughston, R. Jozsa, W.K. Wootters, "A complete classification of quantum ensembles having a given density matrix", Phys. Lett. A 183(1):14–18 (1993). [Ensemble decompositions choosable after the fact — quantum buys privacy, never binding.]
- **NOE18** — E. Noether, "Invariante Variationsprobleme", Nachr. Ges. Wiss. Göttingen, Math.-Phys. Kl. 1918:235–257 (1918). [Symmetries and conserved quantities.]
- **KSS11** — Y. Kosmann-Schwarzbach, "The Noether Theorems: Invariance and Conservation Laws in the Twentieth Century", Springer (2011), transl. B. E. Schwarzbach. ISBN 978-0-387-87868-3 / 9781461427681. [The two-theorem structure: finite groups ⟹ conserved currents; groups depending on arbitrary functions (gauge classes) ⟹ identities among the Euler–Lagrange equations. The Groves gauge group C^∞(Θ₋ᵢ) is a second-theorem class. Web-verified 2026-09-07: publisher + bookseller ISBN records.]
- **OLV86** — P. J. Olver, "Applications of Lie Groups to Differential Equations", Graduate Texts in Mathematics 107, Springer (1986; 2nd ed. 1993). [The Helmholtz conditions / inverse problem of the calculus of variations (§4.4) and the modern Noether theory — the closedness of the allocation 1-form as the Euler–Lagrange face of the report action. Web-verified 2026-09-07: Springer book page + DNB table of contents.]
- **SPI65** — M. Spivak, "Calculus on Manifolds: A Modern Approach to Classical Theorems of Advanced Calculus", Benjamin (1965). [Green's theorem and the Poincaré lemma (closed ⟹ exact on star-shaped domains) — the analytic content of the continuum chain's [I] step, executed as exact polynomial integration on a convex box. Web-verified 2026-09-07: Wikipedia bibliography + citing-course records.]
- **LSZ93** — M. Luby, A. Sinclair, D. Zuckerman, "Optimal Speedup of Las Vegas Algorithms", Information Processing Letters 47(4):173–180 (1993). Preliminary version: Proc. 2nd Israel Symp. on Theory of Computing and Systems, Jerusalem (1993). [Fixed-cutoff restart optimality (Thm 3), no mixed/probabilistic improvement (Thm 4), universal doubling within (19/2)·λ·(log₂λ+5) (Thm 5). Web-verified 2026-09-05 from the author-hosted preprint (people.eecs.berkeley.edu/~sinclair/vegas.pdf); journal record from publisher metadata. Executed as the theorem layer of the postselect-sched cross-prototype.]
- **CHSH69** — J.F. Clauser, M.A. Horne, A. Shimony, R.A. Holt, "Proposed Experiment to Test Local Hidden-Variable Theories", Phys. Rev. Lett. 23(15):880–884 (1969). doi:10.1103/PhysRevLett.23.880. [The classical cap |S| ≤ 2; executed by the 256-strategy census in the retro-cache cross-prototype. Web-verified 2026-09-06: APS publisher page + ADS/INSPIRE records.]
- **TSIR80** — B.S. Cirel'son (Tsirelson), "Quantum generalizations of Bell's inequality", Letters in Mathematical Physics 4(2):93–100 (1980). doi:10.1007/BF00417500. [Tsirelson's bound 2√2. Web-verified 2026-09-06: Springer page + author-hosted PDF.]
- **SHAN48** — C.E. Shannon, "A Mathematical Theory of Communication", Bell System Technical Journal 27:379–423, 623–656 (1948). doi:10.1002/j.1538-7305.1948.tb01338.x. [The h₂ reconciliation floor in the retro-cache withdrawal ledger. Web-verified 2026-09-06: Wiley DOI + Bell Labs reprint hosted at Harvard Math.]
- **CDP13** — G. Chiribella, G.M. D'Ariano, P. Perinotti, B. Valiron, "Quantum computations without definite causal structure", Phys. Rev. A 88, 022318 (2013). arXiv:0912.0195. [The quantum switch as a higher-order supermap; re-verified at enrollment time.]
- **ESC18** — D. Ebler, S. Salek, G. Chiribella, "Enhanced Communication with the Assistance of Indefinite Causal Order", Phys. Rev. Lett. 120, 120502 (2018). arXiv:1711.10165. [Zero+zero capacity channels transmit under the switch; machine-verified in ../switch-sched.]
- **BAY63** — Rev. Mr. Bayes (communicated by Mr. Price), "An Essay towards solving a Problem in the Doctrine of Chances", Phil. Trans. R. Soc. 53:370–418 (1763). doi:10.1098/rstl.1763.0053. [The posterior vocabulary for the sorter's survivor semantics: the kept branch is the prior-weighted posterior over optima. Web-verified 2026-09-06: Royal Society Publishing page + Internet Archive scan of the original (archive.org/details/philtrans09948070); executed as the survivor-census cross-prototype.]
