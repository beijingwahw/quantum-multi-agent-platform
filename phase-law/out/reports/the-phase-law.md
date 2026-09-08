# THE PHASE LAW — where the coupled track's classical wall lives, measured exactly

> The identity card's third line promised phase-transition laws; the platform's law was a market law. This page is the combinatorial one: the coupling strength λ gates the assignment track from P (matching, PL7) toward QAP-type hardness on an exact hinge (PL1), the optimum never loses stability — its REACHABILITY collapses (PL3/PL4), and the two strongest polynomial heuristics fail on orthogonal axes (PL5). The referee is always complete enumeration; the v1.11 bench erratum is double-witnessed here (PL2).


## The board

| id | claim | face | price | tag | witness |
| --- | --- | --- | --- | --- | --- |
| PL1 | the ENVELOPE THEOREM (closed form): every assignment's welfare is W_0(c) + λ·I(c) with I ∈ {0,1} — the optimal structure switches from uncoupled to coupled exactly at λ_opt* = max(0, U − C), U and C the best uncoupled/coupled linear welfares | envelope | worst switch deviation 0 (exactly) over sizes 2×3, 3×5, 6×8 × a 13-point λ grid: the closed form predicts the enumerated optimum's structure at every λ — a two-line theorem (capacity 1 makes the bonus fire exactly once per coupled assignment), machine-checked, no approximation | EXACT | W-A |
| PL2 | the CROSS-IMPLEMENTATION ACCORD: this repo's independently written greedy / 1-exchange LS / SA reproduce the QuantumSched-Bench's record-track counts exactly — the v1.11 erratum is double-witnessed | accord | 6×8, λ=0.35, public seeds 500·k: greedy 2/5, local search 2/5, SA 3/5 — identical to the bench's independently implemented numbers (which live in the platform repo); two codebases, one referee (enumeration), zero divergence | EXACT | W-B |
| PL3 | STABILITY IS NEVER LOST: at every λ the global optimum is itself a 1-exchange local optimum — the phase transition is not about the optimum becoming unstable | landscape | globalIsLocalOptimum true at λ ∈ {0, 0.3, 0.7, 1.5} on the COMPLETE landscapes of 3×4 (24 nodes) and 3×5 (60 nodes): the optimum is always reachable-and-stable; what changes is everything around it (PL4) | EXACT | W-C |
| PL4 | the BASIN COLLAPSE: λ fragments the landscape — local optima multiply and the global optimum's steepest-descent basin shrinks — the transition is REACHABILITY, not stability | landscape | 3×4 seed 500: local optima 1 → 3 → 6 → 6 and global basin 100% → 75% → 29.2% → 25.0% at λ = 0 → 0.3 → 0.7 → 1.5 (exact on the enumerated 1-exchange graph); 3×5 same shape (1 → 3 → 6; 100% → 46.7% → 33.3% → 28.3%) — the mechanism under the heuristic wall, measured exactly | EXACT | W-C |
| PL5 | the TWO-FACE LAW (census): the classical wall has two orthogonal faces — local search is COUPLING-FLAT but MATCHING-FRAGILE; simulated annealing is MATCHING-ROBUST but COUPLING-FRAGILE — they fail on different axes, and the record track sits at the axes' intersection | census | DATA, horizon: 6 sizes × 9 λ points × 20 public seeds (500·k, k=1..20), every optimum enumerated: LS hit rate at λ=0 decays with size 0.90 → 0.65 → 0.65 → 0.40 → 0.30 while its λ-response stays flat (|Δ| ≤ 0.10 at every size); SA at λ=0 stays ≥ 0.70 but crosses 50% in λ at 1.25 (4×6), 1.25 (5×7), 0.60 (6×8); greedy (coupling-blind) is flat-low everywhere. The bench's record numbers (2/5, 2/5, 3/5 at 6×8 λ=0.35) are exactly what two orthogonal failures predict | DATA | W-D |
| PL6 | the pilot's non-monotone λ* was seed noise — the campaign resolves it (superseded by PL9) | census | DATA: at 20 seeds hit rates quantize to 0.05 and the crossings looked non-monotone (1.25, 1.25, 0.60); the 60-seed fine-grid campaign (PL9) finds them MONOTONE — this row stays as the record of the correction, not as the law | DATA | W-D |
| PL8 | the 2×n LS-THRESHOLD THEOREM (closed form): at m = 2 every welfare difference is linear in λ, so local-search-from-greedy's trajectory is piecewise-constant across finitely many λ-intervals — the exact miss threshold is the leftmost interval where the LS endpoint misses, computable in closed form from the breakpoints | envelope | 30 public 2×6 instances (seeds 700·k): 16 carry a finite threshold, 14 never miss (LS is strong at 2×n); closed form vs a 0.001-step sweep: worst deviation exactly one grid step (the sweep's own resolution — agreement by construction on every interval); breakpoints −a/b over all assignment pairs, sorted, all > 0 | EXACT | W-F |
| PL9 | the SCALING CAMPAIGN (the pilot's priced next step, executed): at 60 public seeds × 31 λ points the two-face law CONFIRMS — and the SA crossing is MONOTONE in size, decreasing roughly linearly; a re-entrant easy-hard-easy tail appears at extreme λ | census | DATA, horizon 6 sizes × 31 λ (step 0.05) × 60 seeds (500·k), every optimum enumerated: LS is λ-FLAT at every size (worst |Δ| ≤ 0.08 across the whole grid; 6×8 sits at 0.37 essentially constant) with a pure SIZE cliff 0.75 → 0.58 → 0.62 → 0.45 → 0.37; SA crossings 0.925 (4×6), 0.775 (5×7), 0.525 (6×8) — monotone, and a 3-point linear fit gives ≈ −0.2 per task (reported AS A FIT, never as a theorem); re-entrant tail: 6×8 dips to 0.38 near λ≈0.9 then recovers to 0.43 by λ=1.5 — extreme coupling makes the coupled block easy to spot, the classic easy-hard-easy shape, noted honestly | DATA | W-F |
| PL7 | the λ=0 face is polynomial: with zero coupling the track is a pure assignment problem — exactly solvable in P (Hungarian), where the platform's bench measured 25/25 | face-quote | QUOTED from the platform's own certified baseline (QuantumSched-Bench, ds v1.11: Hungarian 25/25 point-wise optimal on the linear twins): λ gates the track from P (matching) toward QAP-type hardness, and PL1's envelope gives the gate's exact hinge — the phase object this repo measures lives between those two facts | QUOTED | W-E |
| PL10 | the COUPLED-REGIME DECOMPOSITION THEOREM: for λ > λ_opt* (the envelope hinge, PL1) every optimal assignment uses both entangled agents — and the optimum is then computable in POLYNOMIAL time: max over n² ordered pairs (i→a0, j→a1) of w_i(a0) + w_j(a1) + λ + max-weight matching of the rest (Hungarian, O(m³)) | envelope | worst deviation 8.88e-16 against complete enumeration over 54 cells (sizes 2×3, 3×5, 4×6 × 6 public seeds × three λ values above each hinge) — the island's right face is a P algorithm, and the hinge it needs is PL1's closed form | EXACT | W-G |
| PL11 | the LEFT face is P by this repo's own Hungarian: at λ = 0 every assignment scores W_0, so the enumerated optimum equals the maximum-weight matching — computed by the compact O(m²n) implementation, cross-checked 对拍-style against enumeration | envelope | hungarianMax total === the λ=0 enumerated optimum on the family (5 public instances, worst deviation 0 exactly); an earlier cross-check of this row compared the matching against the UNCOUPLED-only optimum — wrong object (at λ=0 coupled assignments score the same W_0), caught and corrected in the same sitting (batch 40) | EXACT | W-G |
| PL12 | the ISLAND CAMPAIGN: the SA U-curve to λ=4 — and NO re-entrant up-crossing: structure-blind search finds no relief at extreme coupling | census | DATA, horizon 2 sizes (5×7, 6×8) × 41 λ (step 0.1, to 4.0) × 40 public seeds: down-crossings 0.45 (6×8) and 2.05 (5×7 — the curve hugs 0.50, the crossing is boundary-fragile); minima 0.38@λ=0.6 (6×8) and 0.47@λ=2.1 (5×7); rates at λ=4: 0.40 / 0.47 ≈ the minima — the v0.2.0 'recovery' (0.38→0.43) was a shallow wiggle, not a return to easy; seed-set sensitivity stated: the 60-seed campaign crossed the same family at 0.525/0.775 — the MINIMUM is the robust statistic, the crossing is fragile when the curve is flat near 0.5 | DATA | W-G |
| PL13 | the ISLAND IS ALGORITHMIC, NOT DYNAMIC: the optimum is poly-computable on BOTH faces (λ=0 matching, PL11; λ>λ_opt* decomposition, PL10) — yet SA, which does not know the family's structure, stays lost across the whole right side (PL12): the right face is reachable by analysis, not by search | envelope | the sharpened statement the three boards above jointly license: hardness on this family lives on a λ-interval whose edges are P-known — one face by matching, one by the n²×matching decomposition — while a structure-blind solver gets no relief (no up-crossing by λ=4); boundary: the single-entangled-pair family — denser coupling structures are the priced next step | EXACT | W-G |
| PL14 | the k-PAIR ENVELOPE THEOREM: with k disjoint entangled pairs, W_λ(c) = W_0(c) + λ·realizedPairs(c) and opt(λ) = max_j (C_j + jλ) — the optimum's realized-pair count is a NONDECREASING step function of λ and equals argmax_j (C_j + jλ) everywhere; k = 1 reproduces the v0.1 family exactly | envelope | 15 cells (sizes (3,6,2), (4,8,3), (4,6,2) × 5 public seeds × 7 λ points): worst monotone-step violation 0, worst argmax mismatch 0; k=1 compatibility: weights identical and optima agree with the v0.1 single-pair family to 1e-12 — the two-line envelope was the k=1 shadow of a k+1-line envelope | EXACT | W-H |
| PL15 | the ALL-k RIGHT FACE: whenever the optimum realizes all k pairs (λ above the last breakpoint), it is computable in POLYNOMIAL time — tasks to the 2k labeled pair slots by Hungarian, the rest by another matching | envelope | worst deviation 0.00e+0 (integer-exact, no rounding at all) over 24 cells (sizes (4,6,2), (6,8,3) × 4 public seeds × λ ∈ {4, 8, 16}, every cell verified to be in the all-k regime first); the single-pair decomposition theorem (PL10) is the k=1 case | EXACT | W-H |
| PL16 | the DENSITY CENSUS (first cut): local search stays λ-FLAT as pairs multiply — its coupling-flatness survives density — but its level DROPS with k: density is a THIRD axis of hurt | census | DATA, horizon 5×7 × λ ∈ {0, 0.5, 1, 2, 4} × 15 public seeds, LS-from-greedy probe under the k-pair welfare: k=1 flat at 0.53, k=2 flat at 0.33, k=3 flat at 0.27 (λ=0 columns all 0.40 — the matching face untouched by k); boundary: LS probe only — the SA k-pair census and non-uniform per-pair bonuses are the priced next step | DATA | W-H |
| PL17 | the GENERALIZED ISLAND: P on the left face (λ=0, matching), P on the right face (all-k regime, PL15), and a monotone staircase of at most k steps between them (PL14) — while the density census says the structure-blind solver's hurt DEEPENS with k | envelope | the statement PL14+PL15+PL16 jointly license: hardness on the k-pair family lives between two P-known faces on a monotone staircase; the blind-solver level falls with density (0.53 → 0.33 → 0.27 at 5×7); boundaries: uniform λ across pairs, LS probe, pilot seeds — the priced next steps are the SA density census, non-uniform bonuses, and the staircase's breakpoint-scaling in k | EXACT | W-H |
| PL18 | the SA DENSITY CENSUS: density SPLITS the island — on the unsaturated axis (6×8, all k pairs realizable) SA's crossing stays monotone in k and its floor collapses to ZERO with no re-entrant up-cross at any k; in the SATURATED corner (5×7 k=3, pair agents outnumber task capacity) the curve never falls below 0.5 and recovers — the easy-hard-easy tail lives at saturation, not on the density ray | census | DATA, horizon 2 sizes × k ∈ {1,2,3} × 81 λ (step 0.1, to 8.0) × 20 public seeds (500·s), every optimum enumerated (one enumeration per cell, reused across the whole λ grid): 6×8 anneal down-crossings 0.65 → 0.35 → 0.35 with rates@λ=8 of 0.35 → 0.05 → 0.00 and NO up-cross at any k — the k=1 island's no-relief verdict SURVIVES realizable density; 5×7 anneal 1.35 → 0.65 → never-below-0.5 (min 0.55@λ=0.9, 0.70 at λ=8) — six pair agents for five tasks leave three equivalent two-pair targets, and SA finds one; λ=0 columns identical across k at both sizes (anneal 0.95/0.70, LS 0.40/0.30 — the matching face untouched by density); LS falls with k at 5×7 (0.45 → 0.35 → 0.30) but is NON-monotone at 6×8 (0.25 → 0.45 → 0.20 at λ=4) — PL16's 'level drops with k' does not extend to 6×8, reported as found; density k=1 对拍: hit rates identical to the v0.1 census and greedy/LS/SA tours bit-identical | DATA | W-I |
| PL19 | the NON-UNIFORM ENVELOPE: per-pair bonuses λ_ij turn the k+1-line envelope into 2^k PLANES — opt(λ) = max_S (D_S + Σ_{i∈S} λ_i) survives EXACTLY and the all-k right face survives EXACTLY (one coverage-forced Hungarian), but the MONOTONE-COUNT staircase BREAKS: on a non-uniform ray λ(t) = t·μ the realized count can DESCEND — the exchange argument confines descents to k ≥ 3 with a dominant pair (μ₁ > μ₂ + μ₃), and the machine finds one | envelope | subset-envelope identity worst deviation 0.00e+0 (4×6 × 4 public seeds × 4 non-uniform λ-vectors, enumeration the referee); all-k face worst deviation 0.00e+0 over regime-verified cells at 5×7 with non-uniform vectors, m > 2k handled by ONE Hungarian whose slot edges are augmented by M = m+1 (coverage forced, M subtracted back); k=1 compatibility: weights identical to the v0.1 family, optimum deviation 0; k=2 ray descents 0 over 3 μ-patterns × 21 public seeds (structural: every 2-set slope dominates every 1-set — descent needs a dominant pair); k=3 DESCENT WITNESS: 4×6 seed 519, μ = (2.5, 0.6, 0.6) — D_{{2,3}} = 2.818 vs D_{{1}} = 2.597, exact crossing t* = 0.170000: count 2 → 1 (the dominant pair takes over) → 2 again on a different pair set — the staircase under non-uniform bonuses descends AND re-ascends | EXACT | W-J |
| PL20 | the BREAKPOINT THEOREM (exact in k): the staircase's argmax flips at the EXACT RATIONAL breakpoints of the upper convex hull of (j, C_j) — λ* = (C_a − C_b)/(b − a), C computed in integer thousandths, denominators ≤ k — and at λ* ± 1e-6 the argmax sits precisely on the two hull neighbours; the breakpoints' scaling in k is DATA, no law claimed | envelope | 105 cells ((4,6) and (5,7) × k ≤ 2, (6,8) × k ≤ 3, 15 public seeds each): worst flip deviation 0, tie-aware argmax-vs-enumeration mismatch 0 (7 tie probes — the 3-decimal weights make exact ties real — every one set-consistent), integer-vs-float C_j cross-check 8.88e-13 thousandths; the k-scaling as DATA at 6×8: last-breakpoint (all-k threshold) medians 0.022 → 0.065 → 0.181 and maxima 0.055 → 0.218 → 0.435 for k = 1 → 2 → 3, while FULL staircases vanish (3/15 → 1/15 → 0/15 cells realize all k steps — the hull SKIPS levels as k grows) | EXACT | W-K |

## The census (20 public seeds, every optimum enumerated)

| size | solver | hit@λ=0 | hit@λ=1.5 | 50% crossing |
| --- | --- | --- | --- | --- |
| 2×3 | anneal | 1.00 | 0.85 | never |
| 2×3 | greedy | 0.80 | 0.30 | 0.250 |
| 2×3 | local-search | 0.80 | 0.85 | never |
| 3×4 | anneal | 1.00 | 0.80 | never |
| 3×5 | anneal | 1.00 | 0.50 | never |
| 3×4 | greedy | 0.90 | 0.55 | never |
| 3×5 | greedy | 0.65 | 0.35 | 0.050 |
| 3×4 | local-search | 0.90 | 0.95 | never |
| 3×5 | local-search | 0.65 | 0.60 | never |
| 4×6 | anneal | 1.00 | 0.45 | 1.250 |
| 4×6 | greedy | 0.65 | 0.25 | 0.050 |
| 4×6 | local-search | 0.65 | 0.70 | never |
| 5×7 | anneal | 0.95 | 0.45 | 1.250 |
| 5×7 | greedy | 0.40 | 0.25 | 0.000 |
| 5×7 | local-search | 0.40 | 0.45 | 0.000 |
| 6×8 | anneal | 0.70 | 0.40 | 0.600 |
| 6×8 | greedy | 0.30 | 0.20 | 0.000 |
| 6×8 | local-search | 0.30 | 0.25 | 0.000 |

## The scaling campaign (v0.2.0 — 60 seeds × 31 λ points, step 0.05)

| size | solver | hit@λ=0 | hit@λ=0.5 | hit@λ=1.0 | hit@λ=1.5 | 50% crossing |
| --- | --- | --- | --- | --- | --- | --- |
| 2×3 | anneal | 1.00 | 1.00 | 0.97 | 0.83 | never |
| 2×3 | local-search | 0.80 | 0.78 | 0.77 | 0.77 | never |
| 3×4 | anneal | 0.98 | 0.97 | 0.70 | 0.57 | never |
| 3×4 | local-search | 0.68 | 0.75 | 0.75 | 0.75 | never |
| 3×5 | anneal | 1.00 | 0.97 | 0.57 | 0.52 | never |
| 3×5 | local-search | 0.65 | 0.60 | 0.58 | 0.58 | never |
| 4×6 | anneal | 1.00 | 0.83 | 0.48 | 0.45 | 0.925 |
| 4×6 | local-search | 0.53 | 0.62 | 0.62 | 0.62 | never |
| 5×7 | anneal | 0.92 | 0.58 | 0.42 | 0.42 | 0.775 |
| 5×7 | local-search | 0.37 | 0.45 | 0.45 | 0.45 | 0.000 |
| 6×8 | anneal | 0.77 | 0.52 | 0.45 | 0.42 | 0.525 |
| 6×8 | local-search | 0.37 | 0.37 | 0.37 | 0.37 | 0.000 |

The campaign's verdict: LS is λ-flat at every size (its wall is the SIZE cliff: 0.75 → 0.37); the SA crossing is MONOTONE in size — 0.925 (4×6) → 0.775 (5×7) → 0.525 (6×8), roughly −0.2 per task over three points (a FIT, not a theorem) — and the 6×8 curve is re-entrant (0.77 → 0.38 near λ≈0.9 → 0.43 at λ=1.5): extreme coupling makes the coupled block easy to spot. The pilot's non-monotonicity (PL6) was seed noise.


## The island (v0.3.0 — the U-curve to λ=4, 40 public seeds)

| size | solver | down-cross | min | λ at min | up-cross | rate@λ=0 | rate@λ=4 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 5×7 | anneal | 2.05 | 0.47 | 2.1 | none by λ=4 | 0.95 | 0.47 |
| 6×8 | anneal | 0.45 | 0.38 | 0.6 | none by λ=4 | 0.78 | 0.40 |

The island's verdict: no re-entrant up-crossing by λ=4 at either size — the v0.2.0 'recovery' was a shallow wiggle. The optimum is poly-computable on BOTH faces (matching at λ=0; the n²×matching decomposition above the hinge, deviation 8.88e-16) — but structure-blind SA gets no relief: **the island is algorithmic, not dynamic** — its right face is reachable by analysis, not by search. Boundaries: the single-entangled-pair family; the crossing statistic is boundary-fragile when the curve hugs 0.5 (the minimum is the robust statistic); denser coupling structures are the priced next step.


## The density axis (v0.4.0 — k entangled pairs, first cut)

| claim | number |

| --- | --- |

| k+1-line envelope: monotone staircase + argmax identity | step-violation 0, mismatch 0 (15 cells) |

| all-k right face (slots + matching) | deviation 0.00e+0 (24 cells, integer-exact) |

| k=1 compatibility with v0.1 | weights identical, optima agree to 1e-12 |

| density census (LS probe, 5×7, 15 seeds): λ-flat at every k | k=1: 0.53 · k=2: 0.33 · k=3: 0.27 |


The generalized island: P on the left (matching), P on the right (all-k slots + matching), a monotone staircase of at most k steps between (PL14) — and the structure-blind level FALLS with density (PL16). Priced next: the SA density census, non-uniform per-pair bonuses, and the staircase's breakpoint scaling in k.


## The density law (v0.5.0 — SA census, non-uniform bonuses, breakpoint scaling)

### The SA density census (20 public seeds, λ 0→8 step 0.1, every optimum enumerated)

| size | k | solver | hit@λ=0 | down-cross | min | λ at min | hit@λ=8 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 5×7 | 1 | anneal | 0.95 | 1.35 | 0.40 | 2.1 | 0.40 |
| 5×7 | 1 | local-search | 0.40 | 0.00 | 0.40 | 0.0 | 0.45 |
| 5×7 | 2 | anneal | 0.95 | 0.65 | 0.20 | 0.9 | 0.20 |
| 5×7 | 2 | local-search | 0.40 | 0.00 | 0.35 | 0.3 | 0.35 |
| 5×7 | 3 | anneal | 0.95 | never | 0.55 | 0.9 | 0.70 |
| 5×7 | 3 | local-search | 0.40 | 0.00 | 0.30 | 0.2 | 0.30 |
| 6×8 | 1 | anneal | 0.70 | 0.65 | 0.35 | 1.7 | 0.35 |
| 6×8 | 1 | local-search | 0.30 | 0.00 | 0.25 | 0.2 | 0.25 |
| 6×8 | 2 | anneal | 0.70 | 0.35 | 0.05 | 1.0 | 0.05 |
| 6×8 | 2 | local-search | 0.30 | 0.00 | 0.30 | 0.0 | 0.45 |
| 6×8 | 3 | anneal | 0.70 | 0.35 | 0.00 | 2.1 | 0.00 |
| 6×8 | 3 | local-search | 0.30 | 0.00 | 0.20 | 0.2 | 0.20 |

The census's verdict: density SPLITS the island. On the UNSATURATED axis (6×8, all k pairs realizable) SA's crossing stays monotone in k (0.65 → 0.35 → 0.35), its floor collapses 0.35 → 0.05 → 0.00, and there is NO re-entrant up-cross at any k by λ=8 — the k=1 island's no-relief verdict SURVIVES density. In the SATURATED corner (5×7 k=3: six pair agents, five tasks — three equivalent two-pair targets) the curve never falls below 0.5 (min 0.55@λ=0.9, back to 0.70 at λ=8): the easy-hard-easy tail lives at saturation, not on the density ray. λ=0 columns are identical across k at both sizes (the matching face untouched). LS falls with k at 5×7 (0.45 → 0.35 → 0.30) but is NON-monotone at 6×8 (0.25 → 0.45 → 0.20 at λ=4) — reported as found, PL16's level-drop does not extend to 6×8.

### Non-uniform per-pair bonuses (the 2^k-plane envelope)

| identity | verdict |
| --- | --- |
| subset envelope: opt(λ) = max_S (D_S + Σ_{i∈S} λ_i) | SURVIVES — deviation 0.00e+0 vs enumeration (4×6, 4 seeds × 4 λ-vectors) |
| all-k right face (one coverage-forced Hungarian, M = m+1) | SURVIVES — deviation 0.00e+0 over regime-verified cells |
| k=1 compatibility with the v0.1 family | SURVIVES — weights identical, optimum deviation 0 |
| monotone count on uniform rays | SURVIVES — PL14's theorem, 0 violations |
| monotone count on non-uniform rays, k = 2 | SURVIVES — 0 descents over 3 μ-patterns × 21 seeds (structural: 2-set slopes dominate) |
| monotone count on non-uniform rays, k = 3 | **BREAKS** — witness below |

The descent witness (exact): 4×6 seed 519, ray λ(t) = t·(2.5, 0.6, 0.6) — D_{{2,3}} = 2.818 vs D_{{1}} = 2.597, crossing t* = 0.170000: the optimum's realized count goes 2 → 1 (the dominant pair takes over) → 2 again on a different pair set. The monotone staircase is strictly a UNIFORM-λ phenomenon; descents need k ≥ 3 and a dominant pair (μ₁ > μ₂ + μ₃) — the exchange argument says so, and the machine agrees.

### Breakpoint scaling in k (exact rationals; scaling as DATA only)

| size | k | cells with breaks | last break min/med/max | full staircases |
| --- | --- | --- | --- | --- |
| 6×8 | 1 | 3/15 | 0.009 / 0.022 / 0.055 | 3/15 |
| 6×8 | 2 | 14/15 | 0.019 / 0.065 / 0.218 | 1/15 |
| 6×8 | 3 | 15/15 | 0.019 / 0.181 / 0.435 | 0/15 |

The staircase's verdict: every breakpoint is an exact rational λ* = (C_a − C_b)/(b − a) over integer thousandths (denominators ≤ k), and at λ* ± 1e-6 the argmax sits precisely on the two hull neighbours — flip deviation 0 over 105 cells, tie-aware argmax-vs-enumeration mismatch 0 (7 exact-tie probes, all set-consistent), integer-vs-float C_j cross-check 8.88e-13 thousandths. The scaling in k is DATA ONLY: at 6×8 the last breakpoint (the all-k threshold) grows with k — medians 0.022 → 0.065 → 0.181 and maxima 0.055 → 0.218 → 0.435 — while FULL staircases vanish (the hull SKIPS levels as k grows; no 6×8 cell realizes all 3 steps at k=3). No scaling law is claimed.


## The landscape (exact, complete 1-exchange graph, seed 500)

| size | λ | nodes | local optima | global basin |
| --- | --- | --- | --- | --- |
| 3×4 | 0 | 24 | 1 | 100.0% |
| 3×4 | 0.3 | 24 | 3 | 75.0% |
| 3×4 | 0.7 | 24 | 6 | 29.2% |
| 3×4 | 1.5 | 24 | 6 | 25.0% |
| 3×5 | 0 | 60 | 1 | 100.0% |
| 3×5 | 0.3 | 60 | 3 | 46.7% |
| 3×5 | 0.7 | 60 | 6 | 33.3% |
| 3×5 | 1.5 | 60 | 6 | 28.3% |

## External anchors (2023–2026 literature, double-verified — anchors, not method)

| anchor | identifiers (verified from two independent sources) | what it positions |
| --- | --- | --- |
| Verel, Thomson, Rifki (2024), "Where the Really Hard Quadratic Assignment Problems Are: the QAP-SAT instances" | arXiv:2403.02783 (evoCOP 2024) + HAL hal-04489201 | assignment-family phase transitions located by fitness-landscape and search-effort analysis — PL18's density census is the coupled-assignment analogue on an exact referee |
| Martínez-García & Porras (2025), "Problem hardness of diluted Ising models: Population Annealing versus Simulated Annealing" | arXiv:2501.07638 + Phys. Rev. E 112, 035314 | annealing hardness varying with structural density (dilution) — the density axis question; they report an easy-hard-easy sweep in dilution, this repo finds the easy tail only at SATURATION (PL18), never on the realizable density ray |
| Angelini & Ricci-Tersenghi (2023), "Limits and Performances of Algorithms Based on Simulated Annealing in Solving Sparse Hard Inference Problems" | Phys. Rev. X 13, 021011 + arXiv:2206.04760 | algorithmic thresholds where SA enters a hard phase — the coupling face's crossing statistic (PL5/PL9/PL18) is the same object measured exactly on a family whose optimum is always enumerable |

Nothing above is reproduced or adopted as method: this repo proves only what it machine-executes — enumeration referee, public seeds, integer-exact arithmetic. The anchors situate the findings; every number on this page is from this repo's own runs.


## Witnesses

- **W-A**: PASS — envelope switch deviation 0 (exactly 0) over 2 sizes x 13 λ points
- **W-B**: PASS — accord 6x8 λ=0.35: greedy 2/5, LS 2/5, SA 3/5 — the bench's exact numbers (2/2/3)
- **W-C**: PASS — global optimum a local optimum at λ=0 and λ=1.5 (both sizes): true; basin halves or worse by λ=1.5: true
- **W-D**: PASS — LS λ-flat true (0.60→0.70 at 3×5), LS matching-fragile true (0.60→0.40), SA coupling-fragile true (0.90→0.60 at 6×8)
- **W-F**: PASS — 2x6 closed form vs sweep: 3 finite thresholds, worst dev 0.0010 (≤ one 0.001 grid step); SA crossings at 20 seeds coarse rerun monotone in size: 1.25 → 1.25 → 0.75
- **W-G**: PASS — decomposition dev 0.00e+0; hungarian-vs-enumeration dev 0.00e+0; no SA relief at λ=4 (compact 15-seed rerun): true
- **W-H**: PASS — k=1 compatibility true; monotone step 0, argmax mismatch 0; all-k face dev 0.00e+0 over 2 cells
- **W-I**: PASS — λ=0 columns identical across k at both sizes: true; 6×8 floor collapse 0.35 → 0.05 → 0.00: true; no SA up-cross by λ=8 at any k (6×8): true; saturated corner 5×7 k=3 min 0.55 ≥ 0.5, never crosses down: true
- **W-J**: PASS — subset-envelope dev 0.00e+0; k=1 compat true; k=2 descents 0 (3 μ-patterns × 21 seeds); k=3 descent at 4×6 seed 519, t* = 0.170000: 2 → 1 → 2: true; all-k face dev 0.00e+0 over 4 regime-verified cells
- **W-K**: PASS — flip dev 0, tie-aware argmax mismatch 0 (2 tie probes, all set-consistent) over 35 cells; no forged staircase survived its own check (0 violations)
- **W-E**: PASS — board legal (0 violations); anchors alive

## The law, in one paragraph

λ_opt* = max(0, U − C) is the exact hinge of the OPTIMAL STRUCTURE (PL1). The HEURISTIC wall is not that hinge: the optimum stays 1-exchange stable at every λ (PL3) while its basin collapses (PL4) — a reachability transition. And the wall has two orthogonal faces (PL5): local search dies with SIZE on the matching face (0.90 → 0.30 at λ=0), annealing dies with λ on the coupling face (crossings 1.25/1.25/0.60) — the record track's 2/5, 2/5, 3/5 is the signature of both axes failing at once. No scaling law is claimed at pilot scale (PL6). With k entangled pairs the hinge becomes a STAIRCASE of exact rational breakpoints on the upper hull of (j, C_j) (PL14/PL20), and density splits the island (PL18): on the unsaturated axis SA's floor collapses to zero with no relief by λ=8, while saturation (pairs outnumbering tasks) hands SA three equivalent targets and the curve recovers — and non-uniform per-pair bonuses BREAK the monotone count (PL19): the optimum can realize FEWER pairs as coupling grows, 2 → 1 → 2 on the witnessed ray. Boundaries: sizes ≤ 6×8, k ≤ 3, 20 seeds, 3-decimal weights — the census is honest about its horizon.
