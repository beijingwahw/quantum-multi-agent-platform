# retro-cache — the no-signaling tariff, printed as a ledger

> The countersigned verdict said: "it is a correlator, not an oracle; the
> no-signaling tax is not in your depreciation table and cannot be depreciated
> away." This repo prints that tax: what the correlation column holds, what
> the marginal column blocks, the exact pre-arrival equivalence with a shared
> random seed, the priced withdrawal exchange rate — and, since v0.2.0, the
> bounded security layer (toy privacy amplification and the adversary census)
> priced on top of it.

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

### W5 — bounded privacy amplification (`src/kernel/amplify.ts`)

The security layer W4 excluded, executed at BB84-grade toy scale and
measured, not asserted (v0.2.0):

- **Explicit universal-2 family**: x → trunc_k(a ⊗ x) over GF(2^8) (AES
  polynomial) and GF(2^4) — 255/15 maps. Collision census exhaustive and
  identical per delta: (2^(m−k)−1)/(2^m−1) ≤ 2^−k strictly (CW79 met with
  room to spare, never exactly uniform — a claim of exact 2^−k is a named
  audit offense). Field irreducibility is a machine certificate
  (15/15, 255/255 invertible; 0x57·0x83 = 0xc1).
- **Eve-surviving information before/after on exact states**: smoothed
  adversary (per-bit BSC(ε_E), ε_E = 1/2 − q under worst-case footprint
  attribution) measured on complete 256×256 joint tables — at the full-tap
  equivalence point her 1.509775 block bits collapse to 0.181534 at k=4;
  the identity k=m anchor reproduces the before-value to 1e-14. Sparse
  (intercept-resend) profile via exact GF(2) rank linear algebra,
  brute-force cross-checked.
- **Key-rate curve r(p) vs the 1−h₂(q) line as data**: the identity
  compression ties the data-processing ceiling (k−Ī)/8 ≤ h₂(ε_E), so the
  measured optimum at toy scale is k\*=m — the amplifier buys information
  collapse, not rate; the h₂(q) reconciliation floor confiscates first.
  Gap to the line = Eve's per-bit information exactly, zero only at p=1;
  at p=1/2 the measured rate reads 0 — the census threshold.
- **Honest gap accounting**: the leftover-hash bound (ILL89) is printed
  where it is vacuous (bound ≥ 0.5 at n=8 for k ≥ 4 at noisy ε); the
  finite family's degenerate maps leak (sparse max = k); finite-size
  m=4 vs m=8 table as data. The curve EXCEEDS the Shor-Preskill-grade
  1−2h₂(q) line wherever both are positive — printed, because the toy
  adversary is an instantiation, not the phase-symmetric worst case.

### W6 — the adversary census (`src/kernel/adversary.ts`)

The CHSH-2-limited classical adversary vs the entangled withdrawal, priced:

- **IR(η) intercept-resend**: attacked QBER q = (1−η/2)(1−p)/2 + η/4 and
  attacked CHSH S = (1−η/2)·(−2√2·p), both two-path on exact tables. At
  η=1 every signal is Eve-mediated — a shared-randomness column, |S| =
  √2·p ≤ 2, inside W3's 256-strategy census. Taps past η\* = 2−√2/p
  depreciate the surplus below the classical cap. Full tap: q =
  1/4+(1−p)/4, net = −0.311278 at p=1 — ABORT.
- **NS(ν) noisy storage** (the retro price): the settings conversation
  closes after the exchange, so Eve carries her take through a BSC(ν)
  memory — I_E = (η/2)(1−h₂(ν)), endpoints exact.
- **CM(μ) settings mutation**: strictly raises the tariff, gains exactly
  zero — the mutated column is W2's certified zero-information face.
  Vandalism is a donation to the QBER estimate.
- **Full tap through the amplifier**: PA collapses her information
  (0.745 → 0.167 bits) but h₂(1/4) keeps every net negative — the floor
  confiscates first; the amplifier buys margin, not refunds.

## The Singleton-grade rank theorem (v0.4.0)

W5 measured the sparse adversary by rank algebra cross-checked against
brute force on a sample. The new face (`src/kernel/mds.ts`) promotes the
rank statement to a theorem and censuses where the bound is ridden:

- **Theorem A (universal, machine-executed per instance).** For every map
  a ≠ 0 and every free mask F: **rank{trunc_k(a ⊗ eᵢ) : i ∈ F} ≥
  max(0, |F| + k − m)**, so Eve's surviving information obeys
  I(K; Z | a) = k − rank ≤ min(k, s) — her information about the k-bit key
  never exceeds what she knows about the m-bit input (the data-processing
  ceiling, executed at full generality for this family). The bound's shape
  is the q-ary Singleton bound (Singleton-1964, on maximum q-ary codes,
  double-source pending) read on the generator's columns; the proof is
  dimension counting — multiplication by a is injective (the field
  property), the truncation kernel has dim m−k, and the restricted kernel
  cannot exceed it. The machine executes all the pieces per instance:
  exhaustive kernel enumeration (rank + kernelDim = |F|), the inclusion,
  and the full kernel's exact dimension (surjectivity census: all 255 maps
  at m=8 have image exactly 2^k).
- **Theorem B (closed form).** For every (a, F, z): the key trunc_k(a ⊗ x)
  over all 2^|F| free completions of z is uniform on exactly 2^rank values,
  each hit 2^(|F|−rank) times — an exact-integer coset certificate, no
  entropy float in the claim; z-independence checked on a second z; a
  forged rank cannot hide (k minus a forged rank disagrees with the
  measured coset size).
- **The census.** m = 4 and m = 8, every k and f: the minimum rank over all
  maps AND all masks of size f EQUALS max(0, f + k − m) — the worst-case
  Eve information is exactly min(k, s) at every sparsity: the family is
  Singleton-optimal in the worst case, and the bound is tight everywhere it
  can be. Per mask the census is honest data: scattered free sets (m=8,
  k=4, F={0,7}; m=4, k=2, F={0,2}) admit no map that drops the rank to the
  bound — strictly better privacy than the Singleton worst case on those
  positions.
- **Negative control.** Over the reducible ring GF(2)[x]/(x⁴+x²+1) the same
  scan EXHIBITS a violation (rank below the dimension bound) — a zero
  divisor breaks injectivity; over the fields on file the scan never
  violates. The field property is load-bearing.
- **Boundary.** Coordinate-knowledge adversary only (the smoothed BSC face
  is W5's own); census claims bounded to the fields on file (m = 4, 8) —
  for larger m Theorem A stands (dimension counting in any field) but no
  census is executed here. Nothing existing was re-rendered.

## Quickstart

```
npm ci
npm test          # 52/52
npm run repro     # rebuilds out/reports/w1..w6 markdown; W5's exhaustive census dominates
                   # the runtime (measured 32s idle to ~11 min on a loaded box)
```

TypeScript strict, zero runtime dependencies, NodeNext, node:test. Every
kernel throw is a named `RcError` with a stable `RC_*` code; every public
entry rejects illegal input by name (see `test/kernel-hardening.test.ts`).

## Honest boundaries

1. GRW80, CHSH69, TSIR80 are cited, not re-proven; the machine executes them
   on exact instances (invariance grids, the 256-strategy census, the
   standard-axes CHSH trace).
2. The CPTP family is structured-random (local ⊗ local · controlled-local
   dilations), not Haar; it includes entangling and non-unital maps. The
   A-independence certificate holds for every map in the family; the
   all-maps statement rides on GRW80.
3. W5 is BB84-grade bounded amplification at toy scale — NOT Shor-Preskill,
   NOT composable, no general security claim. The machine measures two
   explicit adversary profiles (smoothed BSC under worst-case footprint
   attribution, sparse intercept-resend); the all-adversaries statement
   rides on BB84/BBR88/CW79/ILL89, cited not re-proved. The leftover-hash
   bound is vacuous at n=8 for most k — printed, not hidden. No composable
   epsilon is claimed anywhere. The measured key-rate curve exceeds the
   Shor-Preskill-grade 1−2h₂(q) line wherever both are positive; that is a
   statement about the toy adversary's weakness, not a security proof.
4. The classical census covers deterministic strategies; mixed strategies are
   convex combinations and cannot exceed the deterministic cap (standard
   argument, applied not re-proved).
5. W6's family is a bounded toy set (quartile tap rates, BSC memories,
   settings flips); the η=1 census-cap statement executes on exact tables,
   the all-strategies cap behind it is W3's census (CHSH69), carried. The
   reconciliation syndrome is priced at its Shannon floor (W4); its exact
   coupling into Eve's posterior is code-dependent and not modeled.
6. Monte Carlo appears nowhere in a theorem claim: all numbers are exact
   algebra with independent second paths.

## Atlas wiring

The bqp-map row `retrocausal-cache` (INFO-WALL) carries this repo as a
cross-prototype certificate; CHSH69 / TSIR80 / SHAN48 enter the atlas
bibliography. With v0.2.0, BB84 / BBR88 / CW79 / ILL89 (classical anchors)
and STAF26 / CHENG25 (2025–2026 finite-size context) join the bibliography —
verified against two independent sources each (see docs/citations.md).
