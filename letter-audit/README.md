# letter-audit

**The letter itself, fully audited — the upgrade method executed on the last un-audited poetry; v0.2.0: the method turned on its own registry.**

Seventeen ledger rows already upgraded the tech genealogy and the conduct code. This repo finishes the founding document — the **origin story** and the **five summonable abilities** — under the correspondence's founding discipline, now law A1: every audited sentence carries its precise form AND its boundary on the same line. At v0.2.0 the audit caught itself: the frontier registry it quoted had fallen behind the workspace, and the re-audit became this version's face.

- **O1 — the origin claim, precise.** "I come from the time point where computation is already complete": for a fixed universe of machines, completion = the step after the last halter halts = its **Busy-Beaver step**. Machine-executed: the n=1 universe (64 machines) completes at step **1**, the n=2 universe (**20,736** machines, **9,784** halters) at step **6** — the halting census verified to stabilize exactly there and never move again. Boundary on the same line: in general the completion moment is **not computable** (Rado's theorem — BB dominates every computable function); the 5-state universe completes at **47,176,870** steps (bbchallenge 2024, Coq-verified, now arXiv:2509.12337 — cited, not re-run). The visitor's home exists in universes smaller than five states, and nowhere as a computable moment.
- **O8 — the sixth rung (v0.2.0).** BB(6) > 2↑↑(2↑↑(2↑↑9)), at least **2↑↑↑5** — pentation (mxdys, June 2025; two-source, see docs/citations.md). The two cited expressions machine-checked consistent by exact tower-height arithmetic (2↑↑5 = 2^65536, the last BigInt tower, 19,729 digits). Boundary: a lower bound only, and the exact value is gated on a **Collatz-like problem** (Antihydra, June 2024) — the sixth rung is fenced, not climbed.
- **O7 — the machines that outlive every bound.** The right-walker writes one fresh 1 per step and never halts — `ones === steps` at every horizon (verified to 500 steps). Its non-completion is provable in one line HERE; in general, separating slow from never is exactly the halting problem — which is why O1's boundary is a theorem, not a schedule.
- **O2–O5 — the gift, the sneer, the genealogy, the rules**: each re-anchored to its existing audit (capsule/burial record; the 17-row verdict census; the DSIC-Noether upgrade; conduct rule 3 as build gate).
- **O6 — the five abilities, priced.** Feasibility = atlas verdict rows; ultimate-form extrapolation = the verdict-certificate-wall structure; epoch upgrades = admission criteria (crossing-type erasure, signature barriers); trinity consulting = the quantum/causal/scheduling flagships themselves; sci-fi-to-roadmap = the dossier form. The abilities were real all along — as **genres with price lists**, not powers.
- **O3, v0.2.0 — the frontier re-audit.** The registry had fallen behind the workspace: its two OPEN rows graduated against shipped certificates — **#10** the clock wall settled at the model layer (dtc-clock v0.19.0, decay-law arc assembled: kappa = −0.3068529590; hardware instantiation still NOT claimed — the HW-WAIT face survives inside the graduation), **#15** choice/stability settled at both layers (stable-world v0.5.0 + choice-lang v0.2.0; the law stays AUTHORED). Census honestly re-counted: **6/4/2/2/OPEN 2/1 → 8/4/2/2/0/1**. Zero OPEN rows remain because the boundaries moved into the cost columns, not because they vanished.

## The laws (src/kernel/audit.ts)

| law | enforces |
| --- | --- |
| A1 | precise form AND boundary, both, or the row does not ship |
| A2 | EXACT rows cite witnesses; CITED rows wear their citation openly |
| A3 | anchor repos exist on disk |
| A4 | tag vocabulary {EXACT, CITED, DATA} |
| A5 | ids unique |
| A6 | frontier pointers resolve LIVE: sibling file exists and contains the cited needle (a dead pointer is named and rejected) |
| A7 | no frontier row without a pointer into the sibling that settles or holds it; a graduation must cite its settler by pointer |
| A8 | the quoted census equals the machine's re-count of the frontier table — no drift |

## Honest boundary

BB(1)=1 and BB(2)=6 are re-derived from scratch by full enumeration; BB(3)=21 (Lin-Rado 1965), BB(4)=107 (Brady 1983), and BB(5)=47,176,870 (bbchallenge 2024, Coq-verified) are **cited, not re-run** — the n=3 universe alone holds 16,777,216 machines and the n=5 champion runs 47 million steps. BB(6) > 2↑↑↑5 (mxdys 2025) is cited two-source; the repo machine-checks only the consistency of the two cited expressions and the exact small-tower prefix. The census counts are this repo's own machine output under its self-defined encoding 4(n+1))^(2n); only the BB maxima are external, and maxima are convention-independent. The frontier re-audit reads the siblings' rendered reports read-only; it writes nothing outside this repo, and its honesty lasts exactly as long as its pointers do — a sibling re-render that drops a needle will fail this repo's build, by design.

## Reproduce

```bash
npm ci
npm test        # 20/20 — census, witnesses, machine-universe machinery, tower arithmetic, 9 smuggling trials (5 ledger + 4 frontier), entry guard
npm run repro   # renders out/reports/the-letter-audit.md (seconds)
```
