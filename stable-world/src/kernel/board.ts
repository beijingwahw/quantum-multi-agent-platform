/**
 * THE BOARD — the epoch-5 open core, executed. Ledger row #15's cost column
 * said: "What stays open is stability as PHYSICS, not as compilation."
 * These rows are that physics: the desired world as the absorbing class of a
 * FIXED law, reached from anywhere, held forever, robust under law-error,
 * and PAID FOR on the epoch-4 tariff schedule.
 *
 * Tags: EXACT (machine-witnessed closed form), DATA (census, no theorem
 * attached), QUOTED (cited from the in-register schedule — no machine
 * numbers claimed here).
 */
export type Exactness = "EXACT" | "DATA" | "QUOTED";

export type Dynamics = "law" | "engineered" | "perturbed" | "tariff" | "escape";

export interface BoardRow {
  readonly id: string;
  readonly claim: string;
  readonly dynamics: Dynamics;
  readonly price: string;
  readonly exactness: Exactness;
  readonly witness: string;
  readonly anchors: readonly string[];
}

export const BOARD: readonly BoardRow[] = [
  {
    id: "AT1",
    claim:
      "the law is QUIET on the world it selects: a fixed dissipative channel (damping into the world bit, identity on the cargo) leaves every state already inside the world untouched",
    dynamics: "law",
    price:
      "identity-on-world worst deviation <= 1.5e-15 over random in-world cargo states; sector update p' = p + γ(1−p) exact to the rounding floor for every input; sector coherence decays exactly as (√(1−γ))^k — the law touches only what is OUTSIDE the world",
    exactness: "EXACT",
    witness: "W-A",
    anchors: ["choice-lang"],
  },
  {
    id: "AT2",
    claim:
      "global attraction: from ANY initial state the law flows into the world — no postselection, no restart, no toll for ARRIVING (the epoch-3 coin does not reappear here)",
    dynamics: "law",
    price:
      "leakage(k) = (1−γ)^k (1−p0) exact for every input; at k=200 the state equals its into-world collapse (both diagonal blocks summed into W, cargo intact) to <= 1e-12; the law selects the WORLD, never the CONTENTS — contents are the initial diagonal blocks (path-dependent), sector coherences die at (√(1−γ))^k",
    exactness: "EXACT",
    witness: "W-B",
    anchors: ["choice-lang", "survivor-census"],
  },
  {
    id: "AT3",
    claim:
      "the membership charge is the law's Lyapunov function: strictly increasing off the world, exactly conserved under engineered branch programs — one functional, two regimes",
    dynamics: "engineered",
    price:
      "under the law the increment identity ΔV = γ(1−V) holds to the rounding floor over random states, with equality exactly on-world; under random W-preserving branch unitaries the charge drifts <= 1.5e-15 for EVERY input — symmetry conserves what dissipation drives home; the discrete-Noether implication shape, noted as in choice-lang R6, not claimed beyond it",
    exactness: "EXACT",
    witness: "W-C",
    anchors: ["choice-lang", "dsic-noether"],
  },
  {
    id: "AT4",
    claim:
      "the attractor survives the law being slightly wrong: under Phi_eps = (1−eps)·law + eps·N with random CPTP N, the world stays attractive with bounded residual leakage",
    dynamics: "perturbed",
    price:
      "asymptotic leakage <= eps/(1−(1−eps)(1−γ)) for every eps on the grid {0.002, 0.01, 0.05, 0.1} over 24 random channels and adversarial starts — the bound is exact algebra, the census is DATA; within-world contents drift O(eps): stability is continuity of the attractor under law-error, not immunity",
    exactness: "DATA",
    witness: "W-D",
    anchors: ["choice-lang", "vacuum-compiler"],
  },
  {
    id: "AT5",
    claim:
      "the world's stability is PURCHASED: making the desired world the absorbing class erases which-sector information, and the erasure pays the settled #11 schedule",
    dynamics: "tariff",
    price:
      "classical face: h2(q̄) bits destroyed per run (h2 anchored two ways, 0.168660931 at q̄=0.025 matching the depreciation ledger's own W-E); at E(300 K) = 2.87098e−21 J/bit and E(10 mK) = 9.56993e−26 J/bit (quoted from route-price D1-P1; the ratio inherits the temperature ratio 30000); the coherent face (sector coherences also die) is model-dependent — dephasing's price is not a theorem of this model, unpriced",
    exactness: "QUOTED",
    witness: "W-E",
    anchors: ["route-price", "vacuum-compiler", "depreciation-ledger"],
  },
  {
    id: "AT6",
    claim:
      "escape is impossible under the law: the world is not a metastable state but the absorbing class — leaving requires an external agent, never a fluctuation of the law",
    dynamics: "escape",
    price:
      "p_W monotone over random states and iterations, worst decrease exactly 0, equality iff on-world; parametric up-rate r (two-rate chain with return): in-world probability at step k has the exact closed form w* + (1−r−γ)^k(1−w*), w* = γ/(r+γ) (recursion vs closed to 1e-13, MC census of the same event within 5σ, union bound K·r holds on the grid); the thermal reading r = e^(−ΔE/kT) needs a thermal model — boundary, not shipped",
    exactness: "EXACT",
    witness: "W-F",
    anchors: ["choice-lang"],
  },
];
