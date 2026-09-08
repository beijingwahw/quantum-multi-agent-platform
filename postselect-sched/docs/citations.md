# Citations — postselect-sched

Every load-bearing reference, with its verification status. House rule: a
citation ships only after the bibliographic record has been checked against a
primary source (publisher page, arXiv abstract, or the authors' own hosting).

- **LSZ93** — M. Luby, A. Sinclair, D. Zuckerman, "Optimal Speedup of Las
  Vegas Algorithms", Information Processing Letters 47(4):173–180, 1993.
  Preliminary version: Proc. 2nd Israel Symp. on Theory of Computing and
  Systems (ISTCS), Jerusalem, June 1993.
  [Fixed-cutoff optimality (Thm 3), no improvement from probabilistic/mixed
  strategies (Thm 4), universal doubling sequence within (19/2)·λ·(log₂λ+5)
  (Thm 5), and the convex-combination identity behind them.]
  Verification 2026-09-05: full author-hosted preprint read
  (people.eecs.berkeley.edu/~sinclair/vegas.pdf — Sinclair's faculty page);
  journal volume/issue/pages from publisher metadata via web search. CAVEAT
  recorded honestly: the preprint's inline formula for lambda(t) came through
  our PDF-to-text pass sign-garbled (it violated the paper's own lambda <= L
  lemma on a two-point example); the executed lambda(t) = E[min(T,t)]/q(t) is
  the direct renewal semantics, hand-verified and machine-verified against
  the renewal sum before any theorem table was read off. The theorem
  statements (Thm 3/4/5) are about this object.

- **AAR04** — S. Aaronson, "Quantum Computing, Postselection, and
  Probabilistic-Polynomial-Time", Proc. R. Soc. A 461(2063):3473–3482 (2005).
  arXiv:quant-ph/0412187.
  [PostBQP = PP.]
  Verification 2026-09-05 in-house (sibling repo bqp-map, docs/theory.md
  bibliography): the arXiv id 0412187 was corrected at verification time (an
  earlier draft's 0408336 was wrong and caught). Carried over; not re-derived.

- **DH96** — C. Dürr, P. Høyer, "A quantum algorithm for finding the
  minimum", arXiv:quant-ph/9607014 (1996).
  [The amplify-then-verify-with-restart pattern; the certain-answer standard
  E* = min_k (k+1)/p_k used for the ledger comparison.]
  Verification 2026-09-05 in-house (bqp-map docs/theory.md). Carried over.

- **BBHT98** — M. Boyer, G. Brassard, P. Høyer, A. Tapp, "Tight Bounds on
  Quantum Searching", Fortschritte der Physik 46:493–506 (1998).
  arXiv:quant-ph/9605034.
  [Grover success probabilities p_k = sin²((2k+1)θ) in closed form.]
  Verification 2026-09-05 in-house (bqp-map docs/theory.md). Carried over.

- **HOE63** — W. Hoeffding, "Probability Inequalities for Sums of Bounded
  Random Variables", Journal of the American Statistical Association
  58(301):13–30 (1963).
  [The exponential tail bound exp(-2 k gap^2) behind the T5 confidence
  schedule.]
  Verification 2026-09-06: JSTOR record (stable/2282952) plus a freely hosted
  copy of the PDF (csee.umbc.edu); journal volume/issue/pages confirmed from
  publisher metadata.

- **SRZ23** — J.-B. Seznec, H. Richard, K. Scaman, G. Zappella, "Black-box
  Acceleration of Las Vegas Algorithms and Algorithmic Reverse Jensen's
  Inequalities", arXiv:2304.11017 (2023). Version 1 carried the title
  "Breaking the Log Barrier: a Novel Universal Restart Strategy for Faster
  Las Vegas Algorithms".
  [Adopted as the modern-successor anchor for the restart-theorem layer: the
  LSZ93 log factor can be beaten by a universal strategy, and restart costs
  obey a reverse-Jensen view. Context and currency only — nothing from the
  paper is re-proven or imported as method; the T2/T6 kernels stay on LSZ93
  plus exact in-repo arithmetic.]
  Verification 2026-09-08, two independent sources: (1) arXiv abstract page
  (v2 title, author metadata); (2) SemanticScholar record
  (paper 4be7973b90112d600944a5d30b5a5de6bf0dded4, v1 title with the full
  four-author line, DOI 10.48550/arXiv.2304.11017). The DataCite registry
  record for the same DOI lists only the submitting author — an incomplete
  registry entry, recorded here honestly rather than papered over.

- **AH25** — S. Ashur, S. Har-Peled, "Quickly Avoiding a Random Catastrophe",
  arXiv:2503.04633 (2025), cs.DS.
  [Adopted as the randomized-restart anchor: simulations of a randomized
  search algorithm to expected time O(O log O) via randomized threshold
  schedules — the mixed-strategy line that contextualizes the T6 tie face
  (at an exact tie the optimal-policy set is a full simplex of mixed
  policies; LSZ93 Thm 4 already says no MIX beats the best FIXED cutoff when
  the distribution is known — the randomized schedules earn their keep in
  the unknown-distribution regime). Cited as context; no method imported.]
  Verification 2026-09-08, two independent sources: (1) arXiv abstract page
  (authors Stav Ashur, Sariel Har-Peled; submitted 2025-03-06); (2) DataCite
  registry record for DOI 10.48550/arxiv.2503.04633 (full creator list:
  Ashur, Stav; Har-Peled, Sariel; publication year 2025).

Carried-over entries were verified the same day in the sibling atlas repo;
this file records their provenance rather than duplicating the fetch.
