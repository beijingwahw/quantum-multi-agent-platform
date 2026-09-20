# ent-clearing — the settlement layer of the entanglement standard

Ledger row #12 (Bell pairs as money) and #13 (no-cloning as notary) settled the COIN and the NOTARY. The binding market (binding-price) settled what the notary charges. What no book in this workspace had ever executed is the sentence's last word: **结算 — settlement itself**. How is the currency SPENT? How is it QUOTED? How are weak coins NETTED to standard? And why can the desk never MINT?

This repo is that book — a one-page exchange board where every trade carries both columns and the coin's fate.

## The board (E1–E9)

| id | trade | headline |
| --- | --- | --- |
| E1 | redeem an unknown qubit | teleportation: 1 ebit + 2 cbits → the payload, channel fidelity exactly 1; the coin is BURNED (post-trade concurrence exactly 0); goods freeze until the classical leg settles (B's pre-bits marginal exactly I/2) |
| E2 | buy classical capacity | dense coding: 1 transmitted qubit → exactly 2 cbits; the coin is RETURNED as a known Bell pair (post-decode concurrence exactly 1) |
| E3 | the no-coin floor | 1 qubit without entanglement: at most 1 cbit (tetrahedron χ = 1 exactly; ceiling is Holevo's, in-book) |
| E4 | net a weak coin | Procrustean filter: success exactly \|Φ+⟩ with probability exactly 2·λ_min; failure a product state; p ≤ C throughout. Mixed-coin netting stays asymptotic (BBPS96, quoted) |
| E5 | mint new entanglement | locally: never (census never raises E_F; VIDAL00 cited); one global CNOT mints C 0 → 1 |
| E6 | the classical leg's tariff | the 2 cbits of E1 cost kT ln 2 per bit read — #11's settled schedule, cross-anchored, not re-executed |
| E7 | net MIXED coins (BBPSSW round, bounded scale) | v0.2.0: the recurrence round executed exactly at n = 2, 3, 4 coins (16×16 kernels; closed forms recompute to 1e-12; the depolarizing step realized as the exact 24-element local-Clifford twirl — load-bearing, see the honest negatives). Never a standard coin at bounded scale; the asymptotic hashing line stays quoted with gap accounting |
| E8 | settle the ledger | the catalyst conservation census: dense coding conserves coin E_F exactly; teleportation burns it (delta exactly −1); netting/purification never raise expected E_F; every row an exact identity, counterexample, or never-rises |
| E9 | the multi-party desk | a 3-party GHZ bank: pairwise concurrences exactly 0, every cut exactly 1/2; C measures X + 1 cbit → AB hold a known standard coin exactly. The mint wall survives per cut (census; VW02 cited) and fails on the pairwise ledger (exact counterexample) |

**The parity and its asymmetry.** E1 and E2 quote the same parity — 1 ebit = 1 qubit = 2 cbits — but the coin's fate differs by direction: fuel in redemption, catalyst in quotation. The parity holds; the accounting does not. That asymmetry is this desk's contribution to the standard.

## The θ-desk (v0.4.0, `src/kernel/ghztheta.ts`)

The GHZ bank re-opened at an arbitrary coin angle, |GHZ_θ⟩ = (|000⟩ + e^{iθ}|111⟩)/√2 — a theorem with one direction of flow:

- **The triple.** Every NUMERICAL face of the bank is θ-free: the three pairwise concurrences stay exactly 0, every 1-vs-2 cut stays exactly 1/2 negativity, and every branch probability stays exactly 1/2 — at every θ on the πk/12 grid, and structurally (the pairwise reduction's coherence cells are EXACTLY 0.0: the bit-flip symmetry cancels the phase at the bit level).
- **The withdrawal.** C measures X and sends 1 cbit: AB receive exactly |Φ±θ⟩ = (|00⟩ ± e^{iθ}|11⟩)/√2 on the two branches (fidelity 1, concurrence 1, E_F 1, branch probabilities ½) — the angle rides INTO the coin's phase and nowhere else. The cut ledger conserves exactly (A|BC and B|AC stay ½, AB|C drops ½ → 0). θ = 0 degenerates onto the existing bank byte-for-byte (ghzThetaCoin(0) = ghzCoin()).
- **The basis census.** No measurement basis folds θ into any population — the R18 design draft expected Y to fold it and the machine refuted that: Y folds its OWN basis phase into the coin as θ − π/2, populations stay ½. Branch concurrence = |sin 2β| at every tilt (θ-free); the standard coin is withdrawn exactly at equatorial bases and nowhere else; the coin's phase is θ − φ (the transfer direction is enumerable).
- **Claims discipline.** The desk carries its own seven-row claims table (TH1–TH7: five HOLDS, one CENSUS, two REFUTED) with an H8-style checker that recomputes every verdict; contraband tags are convicted by name. Concurrence/E_F exactness runs two paths: the linear cell 2|ρ_{00,11}| (exact to 1e-12) and the Wootters solver (cross-path at 1e-7 — its documented ~1e-8 noise on rank-deficient pure states is a face of the solver, not of the coin).

## The salvage desk (v0.5.0, `src/kernel/recycle.ts`)

The FAILED branch of a BBPSSW round, priced by dynamic programming. What executes: a bank of 1–4 Bell-diagonal coins; an action family of pairing rounds (each side optionally twirled first — the twirl is free as a local operation, never free of consequence); every transition on the 16×16 kernel with BOTH branch spectra cross-checked against their XOR closed forms (the fail branch's closed form is new here); and value iteration over the finite reachable graph — each round consumes two coins and leaves one, so bounded depth is conservation, not an assumption.

- **R2 — step never-rises (VIDAL00 instantiated per action).** Every (state, action) pair's branch-averaged book value ≤ the acting bank's book, recomputed action by action from the kernels; a violation refuses by name — the smuggling trials' instrument.
- **R3 — three value-iteration series.** HOLD (free to stop) is pinned AT the book at every depth; EXACT (forced to act at every depth) is non-increasing to its floor; DELIVER (forced first move, free afterwards) drops once and never climbs: **depth does not pay — the deliverable optimum is exactly the best single round (D* = E_1, a machine identity across the whole census)**.
- **R4 — the L9 squeeze.** The conservation ledger's purification row is this DP's depth-1 face: book = L9's before and D* = L9's after EXACTLY at the canonical grade F = 0.85 (machine equality against `computeLedger()`); L9_after ≤ E_1 ≤ D* ≤ book = L9_before.
- **R5 — the melt-down, two widths.** Isothermal: the failed residue is EXACTLY I/4 at every grade (all four Bell weights 1/4, E_F exactly 0). Werner–Werner at ANY two grades: every residue weight stays under 1/2 — the failed branch prices at exactly 0 however the grades mix; non-Werner leftovers (raw success branches) do carry book value and trade on the market like any coin.
- **R6 — the census (17 rows).** Isothermal banks at the yield table's grades plus mixed-grade banks; every row's book / deliverable / gap / floor recomputes from the DP (1e-9, the row's numbers are keyed, the checker convicts a forgery). The recycling discount book − D* is strictly positive everywhere (0.030 per pair at F = 0.55 rising to 0.874 at F = 0.95), and a deeper mixed market recycles tighter (4-coin 0.118 vs 3-coin 0.296) — never once above the book.
- **Contraband.** Three trials convict by name: a forged successor bank (EC_RECYCLE_MONOTONICITY), a census row claiming a NEGATIVE recycling discount, and the free refinery — a failed residue "re-distilled" against a fresh near-standard coin with the target's E_F never entering the ledger (the same physical transition with the target honestly on the books passes the same audit).

## Laws (the checker, `src/kernel/audit.ts`)

- **H1** every trade carries BOTH columns (give and get) — single-sided quotes do not ship;
- **H2** every row cites a witness that exists — an unwitnessed rate is marketing;
- **H3** anchor repos exist on disk;
- **H4** tags are EXACT / DATA / QUOTED — closed vocabulary;
- **H5** ids unique;
- **H6** yield-table provenance — an EXECUTED row's numbers must recompute from the purification machinery at its finite scale (the BBPS96 asymptotic hashing line does not launder as finite-n data; a counterfeit mint claim is rejected); a QUOTED row must cite BBPS96 and quote the line exactly;
- **H7** ledger honesty — every conservation row's claim must match the machine-recomputed delta (a fake conservation identity is rejected by recomputation);
- **H8** GHZ-bank claim honesty — HOLDS/REFUTED/CENSUS tags must match the machine's recomputed verdict (a refuted wall claimed as holding is contraband).

The renderer refuses to print an illegal board — or an illegal yield table, ledger, or claims table; the test suite includes twelve smuggling trials (one per law face plus the named-refusal boundary trials), the theta desk's four contraband-claim trials (v0.4.0), the salvage desk's three contraband trials (v0.5.0: a forged successor bank, a negative-discount census row, the free refinery), the render entry guard, a test that the exported render mains really run, and the quality anchors (every kernel throw carries a named EC_ code; the report printer refuses non-finite input by name).

## Run

```
npm test        # the full suite: 94 tests (machinery, witnesses, 12 smuggling trials, the theta desk's 18, the salvage desk's 18, entry guard, render mains, quality anchors, boundary/determinism regressions)
npm run typecheck
npm run lint
npm run repro   # renders out/reports/the-ent-clearing.md (board + yield table + ledger + GHZ bank + witnesses)
```

Zero runtime dependencies; TypeScript strict; the matrix kernel is the workspace's battle-tested lineage (binding-price ← choice-lang ← letter-audit), contracts re-read before reuse.

## Honest boundaries

1. Mixed-coin netting is EXECUTED at bounded scale (v0.2.0): the BBPSSW recurrence round with its depolarizing step, realized exactly as the 24-element local-Clifford isotropic twirl (the paper's random bilateral rotations in finite form), on n = 2, 3, 4 coins. The n → ∞ asymptotics — hashing's positive rate above F ≈ 0.8107 (machine brackets the sign change), ZANG25's no-go theorems, LAMI24's exactness under dually non-entangling operations — remain quoted, never claimed as machine output.
2. Bounded-scale netting never delivers a standard coin (F_out < 1 exactly): the mint wall holds inside the purification desk. Two honest negatives are machine-measured: at F = 0.45 the round degrades the coin, and WITHOUT the twirl the nested round degrades it (0.884146 → 0.812024 at F = 0.85).
3. The mint wall's non-increase is a census (DATA) supporting cited theorems (VIDAL00 for E_F, VW02 for cut negativity). The machine testifies; the court cites.
4. The GHZ census is bounded: 150 rounds of single-qubit local channels on three parties; deeper LOCC strategies, larger banks, and the 3-tangle are not explored. The pairwise-wall counterexample, the cut conservations, and the withdrawal identities are exact.
5. E6 quotes the sibling books' settled tariff; this desk never re-executes another book's numbers.
6. Public-key quantum money remains open — quantum-mech's boundary stands; this desk notarizes with private keys, as Wiesner's bank does.
7. The board's quantum claims are all 2–3 qubit density matrices (up to 16×16 for the purification round); no hardware claims are made or implied.
8. The salvage DP (v0.5.0) certifies its own action family — pairing rounds with optional twirls on Bell-diagonal banks of at most 4 coins. Optimality over ALL of LOCC stays cited (VIDAL00, VW02); the machine testifies within the family, the court cites beyond it.
