# Theory — what a burial batch is, and why the record is executable

## The object

A **burial batch** is one delivery's error log: the set of wrong assertions and practices that the delivery's own judges (tests, certificate checkers, exhaustive referees, cross-examinations) caught before shipping. Batches are numbered in order of burial; the count is the workspace's most-quoted humility metric ("the burial record stands at N batches").

Before this repo, the record lived as prose sections (`### 关键经验（第N批…）`) in the daily memory files. That prose is the *evidence* and remains so — this registry is a transcribed, machine-audited index over it, never a replacement for it.

## The two-column discipline

The depreciation ledger's founding law is that a number never travels without its cost. The burial record applies the same shape to errors: **a wrong assertion never travels without its correction**. One-column errors (war stories without fixes, or fixes posing as timeless truths with no bug behind them) fail the build. This is deliberate redundancy with the ledger: the ledger books what claims cost; this books what ignorance cost.

## Why numbering continuity is a law

The count drifted exactly once — the ledger's `#04` cost column said "20 batches" after the twenty-first was buried — and nothing caught it, because prose counts are maintained by hand. Law B3 (numbering is exactly `1..N`) plus witness W-4 (declared constants equal the recount) make the next drift a build failure. The fix for count drift is not vigilance; it is making the count live in one place.

## The taxonomy

Ten categories, fixed at the type level. They emerged from the record itself, not from a priori system-building:

- `conjugation` — sign, complex-conjugate, phase and normalization conventions (the single most recurrent physics-side trap: `v·conj(v)` imaginary parts, `H_P := −C`, twirl normalization, Groves payment signs).
- `dimension-slot` — dimensions, slots, factor order, index bookkeeping (Stinespring on the full space, environment slot semantics, `kron` vs matrix product).
- `wrong-object` — the assertion was written against the wrong object (`I(B; A's settings)` not `I(B; A's outcome)`; block trace not joint element; the conditional's denominator is the accepted count).
- `anchor-blindspot` — anchors that were structurally immune to the bug class they should have caught (all-real anchors hide conjugate bugs; k=1 hides divisor bugs; symmetric errors cancel in symmetric tests).
- `bogus-comparison` — wrong comparison standards, tautological controls, invented dominance theorems.
- `citation-drift` — references and transcriptions trusted from memory (arXiv numbers, PDF-transcribed formulas, file numbers).
- `toolchain` — platform, build, CI, path and editor plumbing (Windows stub pythons, exit-code-eating pipes, `*/` in comments, entry guards).
- `statistics` — weights, tolerances, error bars, denominators, numerical hygiene.
- `machine-overruled` — physics or law expectations corrected by the machine (the clock marginal is coherent, not diagonal; SD is a positive control; six fixed orders tie at 1/√2).
- `process` — discipline itself: record corrections don't bury them, run the witness before writing the number, wording follows data.

## Citations

**None new.** This is an accounting layer: every number the registry quotes (error counts, batch counts) is derived from its own data, and every physics claim inside a correction is anchored to the repo where it was settled and verified. The appeal court for every entry is the anchored repo's test suite.
