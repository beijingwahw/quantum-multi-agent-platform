# ent-clearing — the settlement layer of the entanglement standard

Ledger row #12 (Bell pairs as money) and #13 (no-cloning as notary) settled the COIN and the NOTARY. The binding market (binding-price) settled what the notary charges. What no book in this workspace had ever executed is the sentence's last word: **结算 — settlement itself**. How is the currency SPENT? How is it QUOTED? How are weak coins NETTED to standard? And why can the desk never MINT?

This repo is that book — a one-page exchange board where every trade carries both columns and the coin's fate.

## The board (E1–E6)

| id | trade | headline |
| --- | --- | --- |
| E1 | redeem an unknown qubit | teleportation: 1 ebit + 2 cbits → the payload, channel fidelity exactly 1; the coin is BURNED (post-trade concurrence exactly 0); goods freeze until the classical leg settles (B's pre-bits marginal exactly I/2) |
| E2 | buy classical capacity | dense coding: 1 transmitted qubit → exactly 2 cbits; the coin is RETURNED as a known Bell pair (post-decode concurrence exactly 1) |
| E3 | the no-coin floor | 1 qubit without entanglement: at most 1 cbit (tetrahedron χ = 1 exactly; ceiling is Holevo's, in-book) |
| E4 | net a weak coin | Procrustean filter: success exactly \|Φ+⟩ with probability exactly 2·λ_min; failure a product state; p ≤ C throughout. Mixed-coin netting stays asymptotic (BBPS96, quoted) |
| E5 | mint new entanglement | locally: never (census never raises E_F; VIDAL00 cited); one global CNOT mints C 0 → 1 |
| E6 | the classical leg's tariff | the 2 cbits of E1 cost kT ln 2 per bit read — #11's settled schedule, cross-anchored, not re-executed |

**The parity and its asymmetry.** E1 and E2 quote the same parity — 1 ebit = 1 qubit = 2 cbits — but the coin's fate differs by direction: fuel in redemption, catalyst in quotation. The parity holds; the accounting does not. That asymmetry is this desk's contribution to the standard.

## Laws (the checker, `src/kernel/audit.ts`)

- **H1** every trade carries BOTH columns (give and get) — single-sided quotes do not ship;
- **H2** every row cites a witness that exists — an unwitnessed rate is marketing;
- **H3** anchor repos exist on disk;
- **H4** tags are EXACT / DATA / QUOTED — closed vocabulary;
- **H5** ids unique.

The renderer refuses to print an illegal board; the test suite includes five smuggling trials (one per law) plus the render entry guard.

## Run

```
npm test        # the full suite (machinery, witnesses, smuggling trials, entry guard)
npm run typecheck
npm run repro   # renders out/reports/the-ent-clearing.md
```

Zero runtime dependencies; TypeScript strict; the matrix kernel is the workspace's battle-tested lineage (binding-price ← choice-lang ← letter-audit), contracts re-read before reuse.

## Honest boundaries

1. Mixed-coin netting is multi-copy and asymptotic — BBPS96 (with its 1997 erratum) is quoted, not executed. The executed netting is the pure-coin Procrustean grade, exactly.
2. The mint wall's non-increase is a census (DATA) supporting a cited theorem (VIDAL00). The machine testifies; the court cites.
3. E6 quotes the sibling books' settled tariff; this desk never re-executes another book's numbers.
4. Public-key quantum money remains open — quantum-mech's boundary stands; this desk notarizes with private keys, as Wiesner's bank does.
5. The board's quantum claims are all single-qubit-payload scale (2–3 qubit density matrices); no hardware claims are made or implied.
