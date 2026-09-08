# citations.md — all references web-verified on 2026-09-05

Two memory errors were caught and corrected during verification (marked *).

## qRAM

- V. Giovannetti, S. Lloyd, L. Maccone, "Quantum Random Access Memory",
  Phys. Rev. Lett. 100, 160501 (2008). Original preprint arXiv:0708.1879 (2007).
  https://link.aps.org/doi/10.1103/PhysRevLett.100.160501
- V. Giovannetti, S. Lloyd, L. Maccone, "Architectures for a Quantum Random
  Access Memory", Phys. Rev. A 78, 052310 (2008), arXiv:0807.4994.
  https://arxiv.org/abs/0807.4994
- S. Arunachalam et al., "On the robustness of bucket brigade quantum RAM",
  New J. Phys. 17, 123010 (2015). (Noise-robustness analysis; honest-boundary
  reference for EXP1.)

## Quantum walks

- M. Szegedy, "Spectra of quantized walks and a sqrt(de) rule",
  Quantum Information and Computation / FOCS 2004, arXiv:quant-ph/0401053.
  https://arxiv.org/abs/quant-ph/0401053
- F. Magniez, A. Nayak, J. Roland, M. Santha, "Search via Quantum Walk",
  STOC 2007; SIAM J. Comput. 40(1), 142-164 (2011), arXiv:quant-ph/0608026.
  https://arxiv.org/abs/quant-ph/0608026

## Amplitude estimation and quantum sampling

- G. Brassard, P. Hoyer, M. Mosca, A. Tapp, "Quantum Amplitude Amplification
  and Estimation", AMS Contemporary Mathematics 305 (2002), arXiv:quant-ph/0005055.
  https://arxiv.org/abs/quant-ph/0005055
- * A. Montanaro, "Quantum speedup of Monte Carlo methods",
  Proc. R. Soc. A 471 (2015), arXiv:1504.06987 — NOT 1411.4117 as first
  recalled; corrected during verification.
  https://arxiv.org/abs/1504.06987
- L. K. Grover, "A fast quantum mechanical algorithm for database search",
  STOC 1996. P. Hoyer, Durr-Hoyer minimum finding: C. Durr, P. Hoyer,
  "A quantum algorithm for finding the minimum", 1996, arXiv:quant-ph/9607014.

## Classical online/learning lower bounds

- T. L. Lai, H. Robbins, "Asymptotically efficient adaptive allocation rules",
  Adv. Appl. Math. 6, 4-22 (1985).
- P. Auer, N. Cesa-Bianchi, Y. Freund, R. E. Schapire, "The nonstochastic
  multiarmed bandit problem", SIAM J. Comput. 32(1), 48-77 (2002). Exp3;
  Omega(sqrt(nT)) minimax lower bound.
  https://www.schapire.net/papers/AuerCeFrSc01.pdf
- R. M. Karp, U. V. Vazirani, V. V. Vazirani, "An Optimal Algorithm for
  On-line Bipartite Matching", STOC 1990. RANKING, 1 - 1/e, optimal.
- N. R. Devanur, K. Jain, R. D. Kleinberg, "Randomized Primal-Dual Analysis of
  RANKING for Online Bipartite Matching", SODA 2013.
  https://www.nikhildevanur.com/pubs/RPDFinal.pdf
- B. E. Birnbaum, C. Mathieu, "On-line Bipartite Matching Made Simple",
  SIGACT News 2008. https://cs.brown.edu/people/claire/Publis/sigactnews08.pdf

## v0.2.0 additions (web-verified 2026-09-08, two independent sources each)

- U. Feige, "Tighter bounds for online bipartite matching", arXiv:1812.11774
  (December 2018). https://arxiv.org/abs/1812.11774
  (verified on arXiv and via DBLP/ResearchGate indexes). THE source executed in
  EXP6 and src/online/kv-tight.ts: Section 1.1 defines the distribution D_n and
  its representative MonotoneG (arrival u_j adjacent to the suffix {v_j..v_n});
  Theorems 6/14 and Corollary 21 give E[RANKING on D_n] =
  ((n+1)! - d(n+1) - d(n)) / n! = (1-1/e)n + 1 - 2/e + O(1/n!) with the table
  a(1..7) = 1, 3, 13, 67, 411, 2921, 23633 — every one of these numbers is
  reproduced bit-exactly in-repo; Section 1 carries the deterministic greedy
  1/2 adversary sketch (phase 1 over all workers, phase 2 over the matched
  set) and KVV's Lemma 13 (all greedy algorithms equal on D_n), which the
  subset-DP/formula agreement machine-confirms.
- S. Jaques, A. G. Rattew, "QRAM: A Survey and Critique", Quantum 9, 1922
  (2025), DOI 10.22331/q-2025-12-02-1922; preprint arXiv:2305.10310 (2023).
  https://arxiv.org/abs/2305.10310 ,
  https://quantum-journal.org/papers/q-2025-12-02-1922/
  (verified on arXiv and on the Quantum journal site). Source of the
  insertion-cost/active-vs-passive charging philosophy behind EXP1-D: qRAM
  calls must be metered at the memory's own cost, and one-shot data loading
  rarely amortizes. Our census uses only this repo's own bucket-brigade
  activation ledgers for the concrete numbers.
- Search-sweep context (2023-2026, positioning only, nothing executed):
  randomized k-server conjecture refuted (Bubeck-Coister-Rabani, STOC 2023);
  the quantum-online competitive-ratio line remains the Khadiev et al.
  request-answer/automata program (arXiv:1709.08409 and follow-ups); no
  2023-2026 paper was found that machine-executes KVV tight instances or the
  regret/query-ledger separation — the v0.1.0 positioning claim survives the
  sweep.

## Quantum bandits / quantum online prior art (positioning)

- * Positioning correction: quantum bandit results EXIST in the literature —
  the original roadmap item's "not yet done" framing is wrong at the level of
  query-complexity theorems. What remains undone (and what this repository
  does) is the machine verification of the theorem layer and the executable
  ledger separation for scheduling semantics.
- Y. Wang, M. B. Wan, X. Yi, et al., "Quantum Exploration Algorithms for
  Multi-Armed Bandits", AAAI 2021 (best-arm identification, quadratic).
- Wan, Zhang, et al., "Quantum Multi-Armed Bandits and Stochastic Linear
  Bandits Enjoy Logarithmic Regrets", AAAI 2023, arXiv:2205.14988 — O(polylog T)
  regret with quantum reward oracles; self-described as the first provable
  quantum speedup for bandit regrets.
  https://arxiv.org/abs/2205.14988
- Follow-ups: "Multi-Armed Bandits and Quantum Channel Oracles" (Quantum,
  2025); "Multi-armed quantum bandits" (Quantum 2022, information-theoretic
  lower bounds in a different model); quantum bandits-with-knapsacks (2025).
