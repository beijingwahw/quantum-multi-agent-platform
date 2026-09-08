# Citations — retro-cache

Every load-bearing reference, verification status recorded. House rule: a
citation ships only after the bibliographic record has been checked against a
primary source.

- **GRW80** — G.C. Ghirardi, A. Rimini, T. Weber, "A general argument against
  superluminal transmission through the quantum mechanical measurement
  process", Lettere al Nuovo Cimento 27:293–298 (1980). doi:10.1007/BF02817189.
  [No-signaling theorem.]
  Verification 2026-09-05 in-house (bqp-map docs/theory.md bibliography).
  Carried over.

- **CHSH69** — J.F. Clauser, M.A. Horne, A. Shimony, R.A. Holt, "Proposed
  Experiment to Test Local Hidden-Variable Theories", Phys. Rev. Lett.
  23(15):880–884 (1969). doi:10.1103/PhysRevLett.23.880.
  [The CHSH inequality: |S| ≤ 2 for every local hidden-variable / shared
  randomness strategy. Executed here by the 256-strategy census.]
  Verification 2026-09-06: APS publisher page (link.aps.org/doi/10.1103/
  PhysRevLett.23.880) plus NASA ADS and INSPIRE records; pages 880–884.

- **TSIR80** — B.S. Cirel'son (Tsirelson), "Quantum generalizations of Bell's
  inequality", Letters in Mathematical Physics 4(2):93–100 (1980).
  doi:10.1007/BF00417500.
  [Tsirelson's bound: |S| ≤ 2√2 for quantum correlations.]
  Verification 2026-09-06: Springer publisher page plus the author-hosted
  PDF (Hebrew University page).

- **SHAN48** — C.E. Shannon, "A Mathematical Theory of Communication", Bell
  System Technical Journal 27:379–423 and 623–656 (1948).
  doi:10.1002/j.1538-7305.1948.tb01338.x.
  [Entropy and the source-coding floor behind h₂(QBER) reconciliation
  leakage.]
  Verification 2026-09-06: Wiley DOI record plus the Bell Labs reprint hosted
  at Harvard Math (people.math.harvard.edu/~ctm/home/text/others/shannon/
  entropy/entropy.pdf).

- **BB84** — C.H. Bennett, G. Brassard, "Quantum cryptography: Public key
  distribution and coin tossing", Proceedings of the IEEE International
  Conference on Computers, Systems and Signal Processing, Bangalore, India,
  pp. 175–179 (December 1984). Reprinted with scan of the original manuscript
  in Theoretical Computer Science 560:7–11 (2014),
  doi:10.1016/j.tcs.2014.05.025.
  [The QKD protocol whose worst-case accounting (all observed noise is
  adversary footprint) W5 adopts at toy grade. Cited, not re-proved.]
  Verification 2026-09-08: ScienceDirect reprint record (S0304397514004241,
  TCS 560:7–11, doi 10.1016/j.tcs.2014.05.025) plus arXiv:2003.06557
  (authors' own retrospective posting carrying the original bibliographic
  record).

- **BBR88** — C.H. Bennett, G. Brassard, J.-M. Robert, "Privacy Amplification
  by Public Discussion", SIAM Journal on Computing 17(2):210–229 (1988).
  doi:10.1137/0217014.
  [Privacy amplification by universal hashing over a public channel — the
  layer W5 executes at toy scale.]
  Verification 2026-09-08: SIAM publisher page (epubs.siam.org/doi/10.1137/
  0217014) plus the IBM Research publication record and INSPIRE
  (literature/2743833); full text via the Ohio State-hosted reprint.

- **CW79** — J.L. Carter, M.N. Wegman, "Universal Classes of Hash Functions",
  Journal of Computer and System Sciences 18(2):143–154 (1979).
  doi:10.1016/0022-0000(79)90044-8.
  [Universal-2 hashing — the collision-probability definition W5's explicit
  field-multiplication family is exhaustively censused against.]
  Verification 2026-09-08: DBLP record (journals/jcss/CarterW79) plus the IBM
  Research publication record; full text via the Ohio State-hosted reprint
  and the Masaryk University mirror.

- **ILL89** — R. Impagliazzo, L.A. Levin, M. Luby, "Pseudo-random generation
  from one-way functions", Proceedings of the 30th IEEE Symposium on
  Foundations of Computer Science (FOCS 1989); ACM Digital Library record
  doi:10.1145/73007.73009.
  [The leftover hash lemma: universal hashing extracts uniformity up to
  0.5·2^{-(H_∞−k)/2}. W5 computes and prints the bound, including where it
  is vacuous at toy block size.]
  Verification 2026-09-08: ACM Digital Library record (dl.acm.org/doi/
  10.1145/73007.73009, FOCS 1989) plus the Wikipedia leftover-hash-lemma
  bibliography; journal extension Håstad–Impagliazzo–Levin–Luby, SIAM J.
  Comput. 24(6) (1995).

- **STAF26** — G. Staffieri, G. Scala, C. Lupo, "Finite-size security of QKD:
  comparison of three proof techniques", arXiv:2601.03829 (January 2026).
  doi:10.48550/arXiv.2601.03829.
  [2026 context: how composable finite-size proof techniques shape achievable
  key rates under collective attacks — the register this repo deliberately
  does NOT claim; W5's gap accounting is the toy-scale echo.]
  Verification 2026-09-08: arXiv abstract page (arxiv.org/abs/2601.03829,
  Staffieri/Scala/Lupo, quant-ph, submitted January 2026) plus the QSNP
  (EU Quantum Flagship) publication record and ResearchGate entry.

- **CHENG25** — X. Cheng et al., "An efficient large-scale privacy
  amplification scheme exceeding 10G bits for Quantum Key Distribution",
  EPJ Quantum Technology 12:137 (2025). doi:10.1140/epjqt/s40507-025-00433-3.
  [2025 implementation context: universal-hash privacy amplification at
  10^8–10^10-bit block sizes — the production scale whose finite-size
  effects W5 measures at the toy end (m = 4, 8).]
  Verification 2026-09-08: Springer publisher page (s40507-025-00433-3) plus
  the NASA ADS record (2025EPJQT..12..137C).
