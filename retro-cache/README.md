# retro-cache — the no-signaling tariff, printed as a ledger

> The countersigned verdict said: "it is a correlator, not an oracle; the
> no-signaling tax is not in your depreciation table and cannot be depreciated
> away." This repo prints that tax: what the correlation column holds, what
> the marginal column blocks, the exact pre-arrival equivalence with a shared
> random seed, and the priced withdrawal exchange rate.

## What existed before (honest demarcation)

- No-signaling theorem (GRW80) — pen and paper, 1980.
- CHSH inequality (CHSH69), Tsirelson bound (TSIR80) — pen and paper.
- The bqp-map exp6 `machine-nosignal` certificate (same workspace): marginal
  invariance under unitary/CPTP on exact instances + singlet anchors.
- QKD accounting — decades of literature; nothing here claims security.

What nobody had executed: the cache as a **tariff ledger** — the pre-arrival
equivalence with shared randomness stated distributionally, the classical
strategy space censused to its exact cap, and the withdrawal exchange rate
(QBER, sifting, reconciliation floor, settings tariff) in one machine-checked
table.

## Deliverables

### W1 — the correlation inventory (`src/kernel/state.ts`)

Werner-pair joint tables P(x,y|a,b) = (1 − xy·p·a·b)/4 on two arithmetic
paths (4×4 matrix trace vs closed form) to 1e-15 across random axis pairs and
visibilities; CHSH rides the Tsirelson line 2√2·p exactly. The
complex-anchor family |Φ_θ⟩ = (|00⟩ + e^{iθ}|11⟩)/√2 anchors the FULL
correlation tensor E = cosθ(a_x b_x − a_y b_y) + a_z b_z + sinθ(a_x b_y +
a_y b_x) — the sinθ off-diagonals carry the phase and break first
under any conjugation slip (they did: an earlier draft's ρ₀₃ imaginary sign
error flipped the state to |Φ_−θ⟩ and the referee caught it).

### W2 — the marginal tariff (`src/experiments/exp-w2-marginal.ts`)

- **I(B answer; A question) = 0**: B's outcome distribution is exactly (1/2,
  1/2) under every A-setting (24-axis grid) and every visibility — the
  question never leaks (GRW80 executed).
- A-side random unitaries leave B's marginal exactly untouched while the
  joint state visibly moves (HS distance reported). The A-side CPTP
  generality is the bqp-map exp6 B1 certificate — carried, not duplicated.
- B-side local maps (structured Stinespring CPTP on B⊗env, built on the full
  8-dim space so the dilation never touches A): B may bias its own coin
  (non-unital maps — reported honestly), but the outcome distribution is
  IDENTICAL across A-settings to 1e-14: local processing injects zero
  A-dependence.
- The bit, stated correctly: I(B answer; A answer) = 1 on the aligned joint
  table, 0 on perpendicular axes — the bit lives in the |a·b| alignment,
  never in B's row alone.

### W3 — the pre-arrival equivalence (`src/kernel/tariff.ts`)

- Before the classical channel, the quantum cache is distributionally
  indistinguishable from a pre-shared random seed: TV distance 0.000000000000000
  across all axis pairs.
- The ENTIRE surplus lives in the joint column: all 256 deterministic
  shared-randomness strategies (16×16 full census) cap |CHSH| at exactly
  2.000000000000000 (CHSH69's line, executed by enumeration); the singlet
  reaches 2√2 (TSIR80's line, executed by matrix trace).
- Conclusion: the cache is worth exactly its surplus over a seed, and that
  surplus is the very column the channel must carry.

### W4 — the withdrawal ledger (`src/kernel/tariff.ts`)

Aligned-axes extraction on Werner pairs, everything two-path:

| quantity | value |
| --- | --- |
| QBER after B's flip | (1−p)/2, table path = closed form to 1e-15 |
| sifting | two bases, rate 1/2 per raw pair |
| reconciliation floor | h₂(QBER) per sifted bit (SHAN48, cited bound) |
| net | (1 − h₂(q))/2 bits per raw pair: 0.5 noiseless, 0.094 at p=0.5, exactly 0 at p=0 |
| settings tariff | 1 bit per raw pair on the classical channel |

At p = 0 the cache IS the shared seed of W3 — net exactly zero. Nothing in
this ledger arrives before the settings conversation closes.

## Quickstart

```
npm ci
npm test          # 14/14
npm run repro     # rebuilds out/reports/w1..w4 markdown, seconds
```

TypeScript strict, zero runtime dependencies, NodeNext, node:test.

## Honest boundaries

1. GRW80, CHSH69, TSIR80 are cited, not re-proven; the machine executes them
   on exact instances (invariance grids, the 256-strategy census, the
   standard-axes CHSH trace).
2. The CPTP family is structured-random (local ⊗ local · controlled-local
   dilations), not Haar; it includes entangling and non-unital maps. The
   A-independence certificate holds for every map in the family; the
   all-maps statement rides on GRW80.
3. W4 prices reconciliation and the settings tariff only. Privacy
   amplification against adversaries — the security layer that turns these
   numbers into a secret-key rate — is deliberately NOT executed here.
4. The classical census covers deterministic strategies; mixed strategies are
   convex combinations and cannot exceed the deterministic cap (standard
   argument, applied not re-proved).
5. Monte Carlo appears nowhere in a theorem claim: all numbers are exact
   algebra with independent second paths.

## Atlas wiring

The bqp-map row `retrocausal-cache` (INFO-WALL) carries this repo as a
cross-prototype certificate; CHSH69 / TSIR80 / SHAN48 enter the atlas
bibliography.
