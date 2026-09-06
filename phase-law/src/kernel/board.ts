/**
 * THE BOARD — the coupled track's phase law. The identity card's third line
 * ("相变定律" / phase-transition laws) was a market law in the platform; the
 * COMBINATORIAL phase law — where polynomial heuristics lose the exact
 * optimum as coupling strength λ grows — never existed. These rows are it.
 * Every optimum by complete enumeration; every number witnessed before written.
 */
export type Exactness = "EXACT" | "DATA" | "QUOTED";

export type Face = "envelope" | "accord" | "landscape" | "census" | "face-quote";

export interface BoardRow {
  readonly id: string;
  readonly claim: string;
  readonly face: Face;
  readonly price: string;
  readonly exactness: Exactness;
  readonly witness: string;
  readonly anchors: readonly string[];
}

export const BOARD: readonly BoardRow[] = [
  {
    id: "PL1",
    claim:
      "the ENVELOPE THEOREM (closed form): every assignment's welfare is W_0(c) + λ·I(c) with I ∈ {0,1} — the optimal structure switches from uncoupled to coupled exactly at λ_opt* = max(0, U − C), U and C the best uncoupled/coupled linear welfares",
    face: "envelope",
    price:
      "worst switch deviation 0 (exactly) over sizes 2×3, 3×5, 6×8 × a 13-point λ grid: the closed form predicts the enumerated optimum's structure at every λ — a two-line theorem (capacity 1 makes the bonus fire exactly once per coupled assignment), machine-checked, no approximation",
    exactness: "EXACT",
    witness: "W-A",
    anchors: [],
  },
  {
    id: "PL2",
    claim:
      "the CROSS-IMPLEMENTATION ACCORD: this repo's independently written greedy / 1-exchange LS / SA reproduce the QuantumSched-Bench's record-track counts exactly — the v1.11 erratum is double-witnessed",
    face: "accord",
    price:
      "6×8, λ=0.35, public seeds 500·k: greedy 2/5, local search 2/5, SA 3/5 — identical to the bench's independently implemented numbers (which live in the platform repo); two codebases, one referee (enumeration), zero divergence",
    exactness: "EXACT",
    witness: "W-B",
    anchors: ["ds_extracted/ds"],
  },
  {
    id: "PL3",
    claim:
      "STABILITY IS NEVER LOST: at every λ the global optimum is itself a 1-exchange local optimum — the phase transition is not about the optimum becoming unstable",
    face: "landscape",
    price:
      "globalIsLocalOptimum true at λ ∈ {0, 0.3, 0.7, 1.5} on the COMPLETE landscapes of 3×4 (24 nodes) and 3×5 (60 nodes): the optimum is always reachable-and-stable; what changes is everything around it (PL4)",
    exactness: "EXACT",
    witness: "W-C",
    anchors: [],
  },
  {
    id: "PL4",
    claim:
      "the BASIN COLLAPSE: λ fragments the landscape — local optima multiply and the global optimum's steepest-descent basin shrinks — the transition is REACHABILITY, not stability",
    face: "landscape",
    price:
      "3×4 seed 500: local optima 1 → 3 → 6 → 6 and global basin 100% → 75% → 29.2% → 25.0% at λ = 0 → 0.3 → 0.7 → 1.5 (exact on the enumerated 1-exchange graph); 3×5 same shape (1 → 3 → 6; 100% → 46.7% → 33.3% → 28.3%) — the mechanism under the heuristic wall, measured exactly",
    exactness: "EXACT",
    witness: "W-C",
    anchors: [],
  },
  {
    id: "PL5",
    claim:
      "the TWO-FACE LAW (census): the classical wall has two orthogonal faces — local search is COUPLING-FLAT but MATCHING-FRAGILE; simulated annealing is MATCHING-ROBUST but COUPLING-FRAGILE — they fail on different axes, and the record track sits at the axes' intersection",
    face: "census",
    price:
      "DATA, horizon: 6 sizes × 9 λ points × 20 public seeds (500·k, k=1..20), every optimum enumerated: LS hit rate at λ=0 decays with size 0.90 → 0.65 → 0.65 → 0.40 → 0.30 while its λ-response stays flat (|Δ| ≤ 0.10 at every size); SA at λ=0 stays ≥ 0.70 but crosses 50% in λ at 1.25 (4×6), 1.25 (5×7), 0.60 (6×8); greedy (coupling-blind) is flat-low everywhere. The bench's record numbers (2/5, 2/5, 3/5 at 6×8 λ=0.35) are exactly what two orthogonal failures predict",
    exactness: "DATA",
    witness: "W-D",
    anchors: [],
  },
  {
    id: "PL6",
    claim:
      "the pilot's non-monotone λ* was seed noise — the campaign resolves it (superseded by PL9)",
    face: "census",
    price:
      "DATA: at 20 seeds hit rates quantize to 0.05 and the crossings looked non-monotone (1.25, 1.25, 0.60); the 60-seed fine-grid campaign (PL9) finds them MONOTONE — this row stays as the record of the correction, not as the law",
    exactness: "DATA",
    witness: "W-D",
    anchors: [],
  },
  {
    id: "PL8",
    claim:
      "the 2×n LS-THRESHOLD THEOREM (closed form): at m = 2 every welfare difference is linear in λ, so local-search-from-greedy's trajectory is piecewise-constant across finitely many λ-intervals — the exact miss threshold is the leftmost interval where the LS endpoint misses, computable in closed form from the breakpoints",
    face: "envelope",
    price:
      "30 public 2×6 instances (seeds 700·k): 16 carry a finite threshold, 14 never miss (LS is strong at 2×n); closed form vs a 0.001-step sweep: worst deviation exactly one grid step (the sweep's own resolution — agreement by construction on every interval); breakpoints −a/b over all assignment pairs, sorted, all > 0",
    exactness: "EXACT",
    witness: "W-F",
    anchors: [],
  },
  {
    id: "PL9",
    claim:
      "the SCALING CAMPAIGN (the pilot's priced next step, executed): at 60 public seeds × 31 λ points the two-face law CONFIRMS — and the SA crossing is MONOTONE in size, decreasing roughly linearly; a re-entrant easy-hard-easy tail appears at extreme λ",
    face: "census",
    price:
      "DATA, horizon 6 sizes × 31 λ (step 0.05) × 60 seeds (500·k), every optimum enumerated: LS is λ-FLAT at every size (worst |Δ| ≤ 0.08 across the whole grid; 6×8 sits at 0.37 essentially constant) with a pure SIZE cliff 0.75 → 0.58 → 0.62 → 0.45 → 0.37; SA crossings 0.925 (4×6), 0.775 (5×7), 0.525 (6×8) — monotone, and a 3-point linear fit gives ≈ −0.2 per task (reported AS A FIT, never as a theorem); re-entrant tail: 6×8 dips to 0.38 near λ≈0.9 then recovers to 0.43 by λ=1.5 — extreme coupling makes the coupled block easy to spot, the classic easy-hard-easy shape, noted honestly",
    exactness: "DATA",
    witness: "W-F",
    anchors: [],
  },
  {
    id: "PL7",
    claim:
      "the λ=0 face is polynomial: with zero coupling the track is a pure assignment problem — exactly solvable in P (Hungarian), where the platform's bench measured 25/25",
    face: "face-quote",
    price:
      "QUOTED from the platform's own certified baseline (QuantumSched-Bench, ds v1.11: Hungarian 25/25 point-wise optimal on the linear twins): λ gates the track from P (matching) toward QAP-type hardness, and PL1's envelope gives the gate's exact hinge — the phase object this repo measures lives between those two facts",
    exactness: "QUOTED",
    witness: "W-E",
    anchors: ["ds_extracted/ds"],
  },
  {
    id: "PL10",
    claim:
      "the COUPLED-REGIME DECOMPOSITION THEOREM: for λ > λ_opt* (the envelope hinge, PL1) every optimal assignment uses both entangled agents — and the optimum is then computable in POLYNOMIAL time: max over n² ordered pairs (i→a0, j→a1) of w_i(a0) + w_j(a1) + λ + max-weight matching of the rest (Hungarian, O(m³))",
    face: "envelope",
    price:
      "worst deviation 8.88e-16 against complete enumeration over 54 cells (sizes 2×3, 3×5, 4×6 × 6 public seeds × three λ values above each hinge) — the island's right face is a P algorithm, and the hinge it needs is PL1's closed form",
    exactness: "EXACT",
    witness: "W-G",
    anchors: [],
  },
  {
    id: "PL11",
    claim:
      "the LEFT face is P by this repo's own Hungarian: at λ = 0 every assignment scores W_0, so the enumerated optimum equals the maximum-weight matching — computed by the compact O(m²n) implementation, cross-checked 对拍-style against enumeration",
    face: "envelope",
    price:
      "hungarianMax total === the λ=0 enumerated optimum on the family (5 public instances, worst deviation 0 exactly); an earlier cross-check of this row compared the matching against the UNCOUPLED-only optimum — wrong object (at λ=0 coupled assignments score the same W_0), caught and corrected in the same sitting (batch 40)",
    exactness: "EXACT",
    witness: "W-G",
    anchors: [],
  },
  {
    id: "PL12",
    claim:
      "the ISLAND CAMPAIGN: the SA U-curve to λ=4 — and NO re-entrant up-crossing: structure-blind search finds no relief at extreme coupling",
    face: "census",
    price:
      "DATA, horizon 2 sizes (5×7, 6×8) × 41 λ (step 0.1, to 4.0) × 40 public seeds: down-crossings 0.45 (6×8) and 2.05 (5×7 — the curve hugs 0.50, the crossing is boundary-fragile); minima 0.38@λ=0.6 (6×8) and 0.47@λ=2.1 (5×7); rates at λ=4: 0.40 / 0.47 ≈ the minima — the v0.2.0 'recovery' (0.38→0.43) was a shallow wiggle, not a return to easy; seed-set sensitivity stated: the 60-seed campaign crossed the same family at 0.525/0.775 — the MINIMUM is the robust statistic, the crossing is fragile when the curve is flat near 0.5",
    exactness: "DATA",
    witness: "W-G",
    anchors: [],
  },
  {
    id: "PL13",
    claim:
      "the ISLAND IS ALGORITHMIC, NOT DYNAMIC: the optimum is poly-computable on BOTH faces (λ=0 matching, PL11; λ>λ_opt* decomposition, PL10) — yet SA, which does not know the family's structure, stays lost across the whole right side (PL12): the right face is reachable by analysis, not by search",
    face: "envelope",
    price:
      "the sharpened statement the three boards above jointly license: hardness on this family lives on a λ-interval whose edges are P-known — one face by matching, one by the n²×matching decomposition — while a structure-blind solver gets no relief (no up-crossing by λ=4); boundary: the single-entangled-pair family — denser coupling structures are the priced next step",
    exactness: "EXACT",
    witness: "W-G",
    anchors: [],
  },
  {
    id: "PL14",
    claim:
      "the k-PAIR ENVELOPE THEOREM: with k disjoint entangled pairs, W_λ(c) = W_0(c) + λ·realizedPairs(c) and opt(λ) = max_j (C_j + jλ) — the optimum's realized-pair count is a NONDECREASING step function of λ and equals argmax_j (C_j + jλ) everywhere; k = 1 reproduces the v0.1 family exactly",
    face: "envelope",
    price:
      "15 cells (sizes (3,6,2), (4,8,3), (4,6,2) × 5 public seeds × 7 λ points): worst monotone-step violation 0, worst argmax mismatch 0; k=1 compatibility: weights identical and optima agree with the v0.1 single-pair family to 1e-12 — the two-line envelope was the k=1 shadow of a k+1-line envelope",
    exactness: "EXACT",
    witness: "W-H",
    anchors: [],
  },
  {
    id: "PL15",
    claim:
      "the ALL-k RIGHT FACE: whenever the optimum realizes all k pairs (λ above the last breakpoint), it is computable in POLYNOMIAL time — tasks to the 2k labeled pair slots by Hungarian, the rest by another matching",
    face: "envelope",
    price:
      "worst deviation 0.00e+0 (integer-exact, no rounding at all) over 24 cells (sizes (4,6,2), (6,8,3) × 4 public seeds × λ ∈ {4, 8, 16}, every cell verified to be in the all-k regime first); the single-pair decomposition theorem (PL10) is the k=1 case",
    exactness: "EXACT",
    witness: "W-H",
    anchors: [],
  },
  {
    id: "PL16",
    claim:
      "the DENSITY CENSUS (first cut): local search stays λ-FLAT as pairs multiply — its coupling-flatness survives density — but its level DROPS with k: density is a THIRD axis of hurt",
    face: "census",
    price:
      "DATA, horizon 5×7 × λ ∈ {0, 0.5, 1, 2, 4} × 15 public seeds, LS-from-greedy probe under the k-pair welfare: k=1 flat at 0.53, k=2 flat at 0.33, k=3 flat at 0.27 (λ=0 columns all 0.40 — the matching face untouched by k); boundary: LS probe only — the SA k-pair census and non-uniform per-pair bonuses are the priced next step",
    exactness: "DATA",
    witness: "W-H",
    anchors: [],
  },
  {
    id: "PL17",
    claim:
      "the GENERALIZED ISLAND: P on the left face (λ=0, matching), P on the right face (all-k regime, PL15), and a monotone staircase of at most k steps between them (PL14) — while the density census says the structure-blind solver's hurt DEEPENS with k",
    face: "envelope",
    price:
      "the statement PL14+PL15+PL16 jointly license: hardness on the k-pair family lives between two P-known faces on a monotone staircase; the blind-solver level falls with density (0.53 → 0.33 → 0.27 at 5×7); boundaries: uniform λ across pairs, LS probe, pilot seeds — the priced next steps are the SA density census, non-uniform bonuses, and the staircase's breakpoint-scaling in k",
    exactness: "EXACT",
    witness: "W-H",
    anchors: [],
  },
];
