# citations.md — double-source verification records

## 2026-09-08 (letter-audit v0.2.0, the frontier re-audit + the sixth rung)

- **MXDYS25** — BB(6) lower bounds, June 2025 (champion machine discovered by mxdys): **S(6) > Σ(6) > 2↑↑↑5**, with the champion's Σ past 2↑↑(2↑↑(2↑↑9)).
  - Source 1: BusyBeaverWiki "BB(6)" (wiki.bbchallenge.org/wiki/BB(6)) — states "S(6)>Σ(6)>2↑↑↑5", machine `1RB1RA_1RC1RZ_1LD0RF_1RA0LE_0LD1RC_1RA0RE` discovered by mxdys in June 2025.
  - Source 2: Scott Aaronson, "BusyBeaver(6) is really quite large", June 28, 2025 (scottaaronson.blog/?p=8972) — "BB(6) > 2↑↑(2↑↑(2↑↑9))", "at least 2 pentated to the 5".
  - The two expressions are consistent (the champion's tower strictly exceeds 2↑↑↑5); this repo machine-checks that comparison by exact height arithmetic (W-G).
  - Corroborating: Quanta Magazine, Aug 22, 2025 (June 2025 record, broken again nine days later).
- **MXDYS25-INTERIM** (prose, single-sourced) — June 17, 2025: BB(6) > 10↑↑10,000,000 with a Coq correctness proof (busycoq). Source: Aaronson's post only; cited as prose, not as data.
- **KROPITZ22** — prior record BB(6) > 10↑↑15 (Pavel Kropitz, 2022). Source 1: Aaronson's post (June 2025, "1510 means 10 to the 10 … 15 times"). Source 2: BusyBeaverWiki BB(6) history section (Kropitz lineage; his 2010 bound S(6) > 7.4×10^36534). Cited as context only.
- **ANTIHYDRA24** — the BB(6) obstacle: a 6-state machine (discovered June 2024) whose halting is a Collatz-like open problem; "probviously" non-halting, unproven.
  - Source 1: BusyBeaverWiki "BB(6)" (Cryptids section).
  - Source 2: Aaronson's post comment thread (Shawn Ligocki, July 6, 2025: Cryptids as the obstacle; holdouts ~3,000 machines — single-sourced prose, marked as such in O8's boundary).
- **BBC24-PAPER** — the BB(5) result is now a paper: "Determination of the fifth Busy Beaver value", arXiv:2509.12337 (S(5) = 47,176,870, Coq; STOC 2026 version exists). Upgrades BBC24 from announcement to paper; value unchanged.
  - Source 1: arxiv.org/abs/2509.12337.
  - Source 2: bbchallenge.org (the proof announcement, July 2, 2024) + Wikipedia "Busy beaver" (values table cites the paper).
- **ARXIV2412.14703** (methodology anchor, adopted not executed) — "A brief history of quantum vs classical computational advantage": quantum-advantage claims audited as a LIVING registry whose statuses (verified / weakly refuted / refuted) are re-audited as classical simulators improve. This is the method shape the frontier re-audit instantiates at workspace scale: a registry is honest only while its statuses track the shipped evidence, with each claim carrying a checkable pointer.
  - Source 1: arxiv.org/abs/2412.14703.
  - Source 2: the companion audit practice — S. Oh et al., Phys. Rev. A 107, 022610 (2023, chip-level scaling audit of RCS claims) and QuantumBenchmarkZoo's living supremacy-status tracker.
  - Anchor only: no quantum-advantage number from this anchor enters the ledger.

## 2026-09-06 (letter-audit, 十七访)

- **RADO62** — T. Rado, "On a simple source for non-computable functions", Bell System Technical Journal 41(3):877–884 (1962). Established the Busy Beaver game; BB(1)=1, BB(2)=6.
  - Source 1: Wikipedia "Busy beaver" (history section, values table).
  - Source 2: Wolfram MathWorld "Busy Beaver" (cites Rado 1962 directly).
- **LINRADO65** — S. Lin and T. Rado, "Computer studies of Turing machine problems", J. ACM 12(2):196–212 (1965). BB(3)=21 by exhaustive enumeration.
  - Source 1: Wolfram MathWorld "Busy Beaver" (foundational papers list).
  - Source 2: Wikipedia "Busy beaver" (values table attribution).
- **BBC24** — bbchallenge community result, announced July 2, 2024: **BB(5) = 47,176,870**, with a Coq-verified proof completed 2024 (paper 2025); champion machine discovered by Marxen & Buntrock (1989).
  - Source 1: bbchallenge.org (Pascal Michel's record page: S(5,2) = 47,176,870).
  - Source 2: OEIS A060843 (links the proof-announcement forum post, July 2, 2024).
  - Corroborating: Scott Aaronson's blog announcement; TAPDANCE (Hamilton Institute) July 2, 2024.
- **BRADY83** (prose mention only) — BB(4) = 107, Brady (1983).
  - Source 1: Wikipedia "Busy beaver" values table.
  - Source 2: Quanta Magazine (Aug 2025) coverage listing the ladder 1, 6, 21, 107, 47,176,870.
