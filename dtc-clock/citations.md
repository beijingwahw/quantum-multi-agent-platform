# citations — dtc-clock

Every key below is double-source verified (publisher page + independent
record: arXiv / Crossref / DBLP / author-hosted PDF). Web-verified
2026-09-06 (v0.1.0) and 2026-09-07 (v0.5.0 additions). In-register
references (WIL12, WO15, MI22, LAND61) live in route-price/docs/theory.md
and are quoted, not re-verified here; the FK construction layer (FEY85,
KSV02) lives in vacuum-compiler.

## New in this repo

- **ERS17** — P. Erker, M. T. Mitchison, R. Silva, M. P. Woods, N. Brunner,
  M. Huber, "Autonomous Quantum Clocks: Does Thermodynamics Limit Our
  Ability to Measure Time?", Phys. Rev. X **7**, 031022 (2017).
  doi:10.1103/PhysRevX.7.031022, arXiv:1609.06704.
  [APS](https://link.aps.org/doi/10.1103/PhysRevX.7.031022) +
  [arXiv](https://arxiv.org/abs/1609.06704).
  Note: the last author is M. Huber — a from-memory citation easily writes
  "H. J. Miller" (a different quantum-thermodynamics author); caught by the
  double-source check.
- **EBN16** — D. V. Else, B. Bauer, C. Nayak, "Floquet Time Crystals",
  Phys. Rev. Lett. **117**, 090402 (2016). doi:10.1103/PhysRevLett.117.090402,
  arXiv:1603.08001.
  [APS](https://link.aps.org/doi/10.1103/PhysRevLett.117.090402) +
  [arXiv](https://arxiv.org/abs/1603.08001).
- **KLS16** — V. Khemani, A. Lazarides, R. Moessner, S. L. Sondhi, "Phase
  Structure of Driven Quantum Systems", Phys. Rev. Lett. **116**, 250401
  (2016). doi:10.1103/PhysRevLett.116.250401, arXiv:1508.03344.
  [APS](https://link.aps.org/doi/10.1103/PhysRevLett.116.250401) +
  [Crossref](https://api.crossref.org/works/10.1103/PhysRevLett.116.250401).
  Notes: volume **116** (not 117 — the plan's guessed value, corrected
  here); the official title has no "On the" (that is the arXiv preprint's
  title only).
- **YAO17** — N. Y. Yao, A. C. Potter, I.-D. Potirniche, A. Vishwanath,
  "Discrete Time Crystals: Rigidity, Criticality, and Realizations",
  Phys. Rev. Lett. **118**, 030401 (2017). doi:10.1103/PhysRevLett.118.030401,
  arXiv:1608.02589.
  [APS](https://link.aps.org/doi/10.1103/PhysRevLett.118.030401) +
  [arXiv](https://arxiv.org/abs/1608.02589).
- **BEN73** — C. H. Bennett, "Logical Reversibility of Computation",
  IBM J. Res. Dev. **17**(6), 525–532 (1973). doi:10.1147/rd.176.0525.
  [ACM DL](https://dl.acm.org/doi/10.1147/rd.176.0525) +
  [Crossref](https://api.crossref.org/works/10.1147/rd.176.0525).
- **FT82** — E. Fredkin, T. Toffoli, "Conservative Logic",
  Int. J. Theor. Phys. **21**(3/4), 219–253 (1982).
  doi:10.1007/BF01857727.
  [Springer](https://link.springer.com/article/10.1007/BF01857727) +
  [Princeton-hosted PDF](https://www.cs.princeton.edu/courses/archive/fall05/frs119/papers/fredkin_toffoli82.pdf).
- **HAM50** — R. W. Hamming, "Error Detecting and Error Correcting Codes",
  Bell Syst. Tech. J. **29**(2), 147–160 (1950).
  doi:10.1002/j.1538-7305.1950.tb00463.x.
  [Wiley](https://onlinelibrary.wiley.com/doi/10.1002/j.1538-7305.1950.tb00463.x) +
  [IEEE Xplore](https://ieeexplore.ieee.org/document/6772729/).
  The classical correction-radius law r = floor((d-1)/2) at code distance
  d — TC25's claim is that this theorem holds verbatim for a QUANTUM clock
  register at the keying layer (the repetition code [n,1,n], majority
  decoded by the sector structure).
- **KAC47** — M. Kac, "Random Walk and the Theory of Brownian Motion",
  Amer. Math. Monthly **54**(7, part 1), 369–391 (1947).
  doi:10.1080/00029890.1947.11990189.
  [Taylor & Francis](https://www.tandfonline.com/doi/abs/10.1080/00029890.1947.11990189) +
  [MacTutor](https://mathshistory.st-andrews.ac.uk/Extras/Kac_Chauvenet/)
  (the Chauvenet Prize record).
  Note: a from-memory citation writes the title as "Random Walk and the
  Theory of **Chance**" — wrong; the double-source check caught it (the
  ERS17 lesson repeating). TC26's popcount walk is the Bernoulli-flip walk
  on the n-cube lumped to popcount — this paper's lineage.

## Quoted from the register

- **WIL12 / WO15 / MI22 / LAND61** — see route-price/docs/theory.md
  (double-sourced there 2026-09-06): the equilibrium no-go (WO15), the
  founding proposal (WIL12), the hardware DTC certificate (MI22), and the
  unit price of the floor (LAND61).
- **FEY85 / KSV02** — see vacuum-compiler: the FK clock and the
  history-state layer this repo's runner replaces with a beat.
