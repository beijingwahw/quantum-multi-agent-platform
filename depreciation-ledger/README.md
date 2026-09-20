# depreciation-ledger — claim #17, promoted to a build gate

> The visitor's only conduct rule — "the depreciation of the other universes
> must be booked" — was enrolled as atlas claim #17 with the postselection
> ledger as its execution clause. This repo is the promotion: the rule as a
> CHECKER.

## What it is

The seventeen claims of the visitor's letter, rendered as one two-column book
(`out/reports/the-ledger.md`): what may be quoted (NUMBER column) beside what
it costs (COST column), each row stamped with its atlas verdict and its appeal
command (`repo: npm run script` — verified to exist).

## The laws (machine-enforced, `src/kernel/audit.ts`)

- **L0** — every verdict tag is one of the legal vocabulary, single-sourced
  in `src/kernel/ledger.ts` (`LEGAL_VERDICTS` — the type union and the
  runtime list are one declaration).
- **L1** — a row quoting a number must book a cost. The visitor's sentence,
  executable.
- **L2** — a row without numbers must be OPEN: unpriced rows are routes, not
  results.
- **L3/L4** — every atlas anchor id and verdict tag exists in
  `bqp-map/src/atlas/entries.ts` (the book cannot drift from the atlas).
- **L5** — every appeal command is a real script in a real repo on disk
  (the court of appeal is callable, not decorative). The appeal manifest is
  VALIDATED, never cast-trusted: a malformed package.json or a non-table
  `scripts` member is booked as a named L5 violation — the checker does not
  crash on smuggled input.
- **L6** — five arithmetic witnesses re-derive headline costs from scratch,
  independently of the repos that first produced them:
  - W-A: ledger identity 1/P = N/t (exact grid);
  - W-B: the restart-optimality threshold by bisection on sin²3θ = 2sin²θ,
    matching (3−√2)/4 to 1e-12;
  - W-C: the 256-strategy classical CHSH census capping at exactly 2;
  - W-D: Grover restart optimum E* at (N=256, t=1) ≈ 11.619;
  - W-E: the h₂ reconciliation anchor h₂(0.025) ≈ 0.168661.

The renderer REFUSES to print an illegal ledger: if any law fails,
`npm run repro` throws with the violations by name. `npm test` includes the
smuggling docket — a number without a cost, a numberless row with a
confident verdict, a runtime-smuggled illegal verdict (L0), a forged atlas
anchor (L3), forged and missing appeals (L5), and a malformed appeal
manifest that must be BOOKED, never a crash — each convicted by claim id
and law.

## The restart threshold as an exact algebraic certificate (v0.4.0)

W-B's bisection matched (3−√2)/4 to 1e-12; `test/restart-threshold.test.ts`
upgrades that reading to an exact algebraic-number certificate over Q(√2),
all in BigInt — the bisection witness keeps running, now with its closed
form proven rather than numerically suggested:

- **T1** — sin(3θ) = 3s − 4s³ derived on two independent roads (de
  Moivre's imaginary part vs the addition formula), identical coefficient
  vectors by machine expansion.
- **T2** — sin²(3θ) − 2sin²(θ) = s²(16s⁴ − 24s² + 7) as a polynomial
  identity (zero-residual coefficient expansion, a composed-vs-factored
  rational-grid second path, and a float sin(3θ) third path).
- **T3** — the solution set in (0, π/2): the factorization
  16y² − 24y + 7 = 16(y − y−)(y +) verified by exact expansion in
  Q(√2)[y], with y− = (3−√2)/4 ∈ (¼, ½) and y+ = (3+√2)/4 ∈ (1, 2) —
  one solution in (0, 1), the W-B threshold, as an order-theoretic
  certificate (the Q(√2) sign comparison IS √2's irrationality).
- **Negative controls** — the forged threshold (3−√1.9)/4 convicted with
  residual exactly −1/10 (the identity P((3−t)/4) = t² − 2, machine
  expanded), its magnitude sized against the local-slope budget
  4 − 2√3.8; and the interval classifier proven sharp at BOTH roots.

Honest boundary: the Grover E* optimum (W-D) remains a numerical witness —
only the threshold's closed form is certified here. One spec correction,
recorded: the R18 spec sheet placed the complementary root in (½, 1); the
machine shows (3+√2)/4 > 1 — outside (0,1) entirely, not even a legal
sin² value. The classifier test pins the corrected reading.

## Quickstart

```
npm ci
npm test          # 23/23
npm run repro     # renders out/reports/the-ledger.md, or throws
```

## Honest boundaries

1. The ledger's rows SUMMARIZE numbers proven elsewhere; the witnesses
   re-derive only the headline closed forms. Full proofs live in the appeal
   repos named on each row.
2. Verdict tags mirror the bqp-map atlas; pairing of row↔verdict is enforced
   by the atlas's own discipline checker (29/29 entries), not re-derived here.
3. This ledger makes no new physics claims and cites no new literature — it
   is the accounting layer over the correspondence's existing, already
   verified claims.

## Atlas wiring

The bqp-map row `postselect-sort` carries this repo as a cross-prototype
certificate: the conduct rule #17, enforced as a gate over all seventeen
claims.
