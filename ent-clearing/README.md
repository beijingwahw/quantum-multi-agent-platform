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

## Laws (the checker, `src/kernel/audit.ts`)

- **H1** every trade carries BOTH columns (give and get) — single-sided quotes do not ship;
- **H2** every row cites a witness that exists — an unwitnessed rate is marketing;
- **H3** anchor repos exist on disk;
- **H4** tags are EXACT / DATA / QUOTED — closed vocabulary;
- **H5** ids unique;
- **H6** yield-table provenance — an EXECUTED row's numbers must recompute from the purification machinery at its finite scale (the BBPS96 asymptotic hashing line does not launder as finite-n data; a counterfeit mint claim is rejected); a QUOTED row must cite BBPS96 and quote the line exactly;
- **H7** ledger honesty — every conservation row's claim must match the machine-recomputed delta (a fake conservation identity is rejected by recomputation);
- **H8** GHZ-bank claim honesty — HOLDS/REFUTED/CENSUS tags must match the machine's recomputed verdict (a refuted wall claimed as holding is contraband).

The renderer refuses to print an illegal board — or an illegal yield table, ledger, or claims table; the test suite includes eleven smuggling trials (one per law face) plus the render entry guard, and a test that the exported render mains really run.

## Run

```
npm test        # the full suite: 39 tests (machinery, witnesses, 11 smuggling trials, entry guard, render mains)
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
