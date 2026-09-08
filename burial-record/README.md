# burial-record

**The burial record, exhumed and machine-audited.**

The visitor's letter says the time capsule's real contents are the error logs — twenty-one batches of them, buried as prose across the daily memory files. This repo promotes that record to a first-class registry:

- **84 batches / 608 errors**, every error in two columns — the wrong assertion as it stood, and the correction as recorded. The ledger's discipline (a number never travels without its cost) applied to ourselves: an error never travels without its fix. Batch 22 is this repo's own delivery log — the registry buries itself.
- **Dual anchors per batch**: the repo it happened in (must exist on disk) and the memory file + heading that records it (must resolve). A batch cannot predate or outlive its own evidence — the date must be the anchor file's date.
- **A fixed taxonomy of ten categories** (`conjugation`, `dimension-slot`, `wrong-object`, `anchor-blindspot`, `bogus-comparison`, `citation-drift`, `toolchain`, `statistics`, `machine-overruled`, `process`) — unclassified errors do not ship.

## Why this is a repo and not prose

The ledger's `#04` cost column once read "burial record: 20 batches" while the truth was 21 — **prose drifts**. Here the count lives in exactly one place, and law B3 makes silent drift a build failure: batch numbering is exactly `1..N`, continuous, duplicate-free, every batch nonempty. The census witnesses re-derive the headline counts through a second path (JSON round-trip vs direct traversal).

## The laws (src/kernel/audit.ts)

| law | enforces |
| --- | --- |
| B0 | every error's category is drawn from the fixed taxonomy |
| B1 | every batch anchors to a repo that exists on disk — a vanished repo books no errors |
| B2 | every error carries BOTH columns — wrong and right; either alone fails the build |
| B3 | numbering is exactly `1..DECLARED_TOTAL_BATCHES`, no gaps, no duplicates, no empty batches |
| B4 | every source anchor resolves: the memory file exists and contains the cited heading |
| B5 | a batch's date equals its anchor file's date; its context is nonempty |

The renderer refuses to print an illegal registry. The tests include smuggling trials: contraband batches (dead repo, one-column error, numbering gap, dead anchor, illegal category, mismatched date) are each named and rejected by law.

## Honest boundary

This registry **transcribes; it does not re-prove**. The physics in each correction remains the business of the repo it happened in — the appeal court for every entry is that repo's own test suite (`npm test` in the anchored repo). No new citations: this is an accounting layer; every number it quotes is anchored to an existing repo's in-book verification.

## Reproduce

```bash
npm ci
npm test        # 23/23 — checker, witnesses, smuggling trials, entry guard
npm run repro   # renders out/reports/the-burial-record.md (seconds)
```
