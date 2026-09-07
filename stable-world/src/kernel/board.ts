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
      "classical face: h2(q̄) bits destroyed per run (h2 anchored two ways, 0.168660931 at q̄=0.025 matching the depreciation ledger's own W-E); at E(300 K) = 2.87098e−21 J/bit and E(10 mK) = 9.56993e−26 J/bit (quoted from route-price D1-P1; the ratio inherits the temperature ratio 30000); the coherent face was the model-dependent half — now priced on the authored diagonal Hamiltonian (AT7)",
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
      "p_W monotone over random states and iterations, worst decrease exactly 0, equality iff on-world; parametric up-rate r (two-rate chain with return): in-world probability at step k has the exact closed form w* + (1−r−γ)^k(1−w*), w* = γ/(r+γ) (recursion vs closed to 1e-13, MC census of the same event within 5σ, union bound K·r holds on the grid); the thermal reading r = γ·e^(−ΔE/kT) ships on the authored detailed-balance bath (AT8)",
    exactness: "EXACT",
    witness: "W-F",
    anchors: ["choice-lang"],
  },
  {
    id: "AT7",
    claim:
      "the coherent face of the tariff, PRICED: the law is an incoherent operation in the sector basis, so the sector coherence it kills carries an exact nonequilibrium value — the relative entropy of coherence C_rel(ρ) = S(Δρ) − S(ρ) — and on the authored diagonal Hamiltonian the free-energy identity F(ρ) − F(Δρ) = kT ln2 · C_rel(ρ) makes the price kT ln2 per bit, whatever the temperature",
    dynamics: "tariff",
    price:
      "both law Kraus operators leave the sector basis (max column support 1; random unitaries sit at 4 — the probe separates); pure equal-weight straddlers pay the FULL bit: C_rel = 1 to 1.11e−15 whatever the cargo and phase; pure unequal-weight straddlers pay h2(|α|²) exactly (2.22e−15) — the two faces meet on pure inputs; sector-diagonal states pay 0 exactly (0.00e+0); the engine: dephasing preserves ⟨H⟩ to 0.00e+0, so F(ρ) − F(Δρ) = kT ln2 · C_rel exactly; erasure is monotone along every trajectory (worst rise 0.00e+0 — the incoherent-operation theorem, BCP14, witnessed as census) and completes at the k=200 collapse (6.52e−16); the coherent face settles at exactly TWICE the classical rate (−½ln(1−γ) vs −ln(1−γ), ratio 2.000000000000000); at the quoted schedule a full straddler bit costs 2.871e−21 J @300 K / 9.570e−26 J @10 mK — the value is DISSIPATED, not harvested: an incoherent law has no battery",
    exactness: "EXACT",
    witness: "W-G",
    anchors: ["route-price", "vacuum-compiler", "depreciation-ledger"],
  },
  {
    id: "AT8",
    claim:
      "the thermal reading, SHIPPED: with the authored Hamiltonian H = ΔE·Π_perp (the complement sits ΔE above the world) and a bath obeying detailed balance r_up/r_down = e^{−ΔE/kT}, the escape chain's stationary world-occupancy becomes the Boltzmann logistic — the reading is arithmetic, not a boundary",
    dynamics: "escape",
    price:
      "detailed-balance identity exact: γ/(γ + γe^{−βΔE}) = 1/(1+e^{−βΔE}) to 2.22e−16 over the βΔE × γ grid; escape readings (exact closed form in the cancellation-free arrangement): βΔE=20 → 2.061e−9, βΔE=40 → 4.248e−18 at every horizon K ≥ 100 (the chain equilibrates in ~1/γ steps — the reading IS the stationary share e^{−βΔE}/(1+e^{−βΔE})); union bound escape ≤ Kγe^{−βΔE} ⟹ the DESIGN RULE βΔE ≥ ln(Kγ/δ) holds escape ≤ δ over horizon K (worst excess 0.00e+0; K=1e6, γ=0.25, δ=1e−9 needs βΔE ≥ 33.2); physical anchors (exact SI arithmetic: k = 1.380649e−23 J/K, h = 6.62607015e−34 J·s, a 5 GHz gap = 3.313e−24 J): at 10 mK βΔE = 23.9962, escape-share 3.79e−11; at 100 mK βΔE = 2.3996, escape-share 8.32e−2; at 1 K 0.440; at 300 K 0.500 — every temperature decade costs exactly ln 10 in βΔE: the fridge IS the stability budget; the rates are now DERIVED microscopically (AT9: the collision bath)",
    exactness: "EXACT",
    witness: "W-H",
    anchors: ["route-price", "choice-lang"],
  },
  {
    id: "AT9",
    claim:
      "the microscopic bath, DERIVED: the thermal reading's authored rates are the exact shadow of a unitary collision model — resonant Gibbs bath qubits under the energy-conserving exchange exp(−iθS) — and the law itself is the family's zero-temperature member",
    dynamics: "escape",
    price:
      "[U, H_tot] = 0 exactly (0.00e+0 — energy conservation by construction, not approximation); detailed balance EMERGES: r~/g~ = e^{−βΔE} to 5.55e−17 over the θ × βΔE grid — AT8's authored bath is now a theorem of this one; the world-bit populations follow the two-rate chain per collision (4.44e−16); the stationary register is Gibbs-world ⊗ cargo (2.41e−14, occupancy the Boltzmann logistic to 4.40e−14); THE LAW IS THE T=0 COLLISION: at θ = arcsin √γ the trace distance against applyLaw is 2.35e−14 @βΔE=30 and 4.51e−19 @40, decaying as e^{−βΔE} — the law is the zero-temperature member of its own bath family; and the sector-coherence factor is cos θ WHATEVER THE TEMPERATURE (2.22e−16) — the bath thermalizes populations and never touches the coherence rate: the classical and coherent faces stay dynamically separate; the continuum limit is now EXECUTED as a discrete convergence theorem (AT11)",
    exactness: "EXACT",
    witness: "W-I",
    anchors: ["choice-lang"],
  },
  {
    id: "AT10",
    claim:
      "the coherent shortcut: the same exchange at θ = π/2 against a pure ground weight reaches the law's k→∞ state on the register in ONE energy-conserving step — and conserves exactly the coherence the law dissipates: coherent protocols bank what incoherent laws burn",
    dynamics: "engineered",
    price:
      "register marginal = collapseIntoWorld exactly (3.06e−17) for every input — the 200-step dissipative asymptote is unitarily one step; full-basis C_rel conserved exactly (2.00e−15: an incoherent permutation relocates coherence, never destroys it); product straddlers bank the FULL sector bit on the weight (purity 6.41e−16, banked bits 6.66e−16, free-energy excess = kT ln2 exactly (6.66e−16) — AT7's tariff, harvestable in principle); general states split the ledger — measured exactly on AT12's audit (banked fraction 0.00–0.37, the rest in the correlation term); the dichotomy priced: the shortcut needs a prepared coherent weight and control, the law needs nothing and forgets everything",
    exactness: "EXACT",
    witness: "W-J",
    anchors: ["choice-lang", "dsic-noether"],
  },
  {
    id: "AT11",
    claim:
      "the continuum (Davies) limit, EXECUTED as a discrete convergence theorem: at every finite coupling the collision dynamics is exact and closed-form, and the limit t = n·sin²θ only replaces geometrics by exponentials — restoring the textbook Davies coherence rate that every finite coupling hides",
    dynamics: "escape",
    price:
      "finite coupling is EXACT: populations follow p' = p + sin²θ·(p_b − p) with NO higher corrections (1.11e−16 over the grid); the within-block cargo coherences mix by the 2×2 matrix M (columns sum 1, eigenvalues {1, 1−sin²θ}) whose closed form M^n holds to 5.55e−17, and the sector coherence follows cos^n(θ) (4.86e−17) — the quantum content is exact at every coupling; the composition limit (Φ_θ)^{⌊t/sin²θ⌋} meets the semigroup p_b + e^{−t}(p₀−p_b), coherence e^{−t/2}, with error exactly O(t·sin²θ) — halving θ quarters it (measured ratio 4.0); the generator's coherence rate (cosθ−1)/sin²θ = −1/(1+cosθ) → −½ at O(θ²) — the DAVIES rate (γ↓+γ↑)/2 = ½ restored EXACTLY although every finite coupling is temperature-free: the clock n = t/sin²θ absorbs p_b + q_b = 1; boundary: the functional-analytic weak-coupling theorem (DAV74) remains cited — the machine executes the discrete convergence core",
    exactness: "EXACT",
    witness: "W-K",
    anchors: ["choice-lang"],
  },
  {
    id: "AT12",
    claim:
      "the shortcut's AUDIT LEDGER: the output satisfies the exact three-term decomposition C_total = C_register + C_weight + (I − J_c) with every term ≥ 0, and V* is a permutation — its inverse restores the input EXACTLY: dissipation is the law's choice, not a necessity of the physics",
    dynamics: "engineered",
    price:
      "the ledger holds exactly: C^8 = C^4 + C^2 + (I − J_c) to 2.22e−16 over random and sector-diagonal inputs, every term ≥ 0 (J_c ≤ I by data processing — dephasing cannot increase mutual information); the REVERSAL is bit-exact: V*^dag restores ρ ⊗ |1_w⟩⟨1_w| to trace distance 0.00e+0 — what the law burns in 200 steps is reconstructible from the register+weight records; straddlers: the weight banks the full sector bit, the correlation term is exactly 0, the cargo basis artifact stays on the register (1.55e−15); general states split (banked fraction 0.00–0.37 over the census) — the correlation term is where the remaining value sits, and its one-shot incoherent core is banked on AT14",
    exactness: "EXACT",
    witness: "W-L",
    anchors: ["choice-lang", "dsic-noether"],
  },
  {
    id: "AT13",
    claim:
      "the limiting generator IS the Lindblad operator with the Davies rates — the extraction (Φ_θ − id)/sin²θ converges to jump-down √p_b|1⟩⟨0|⊗I + jump-up √q_b|0⟩⟨1|⊗I (interaction picture), and the composition convergence is uniform over the state space",
    dynamics: "escape",
    price:
      "the extraction-vs-Lindblad match is bounded at 5.98e−2·θ² over the βΔE × θ × state grid — O(θ²) with no drift, on arbitrary states elementwise; the uniformity: sup over random pure states of the composition error falls 3.5× on halving θ (expect 4, Monte Carlo max over 40 states) — the norm-continuity core of the functional-analytic theorem (DAV74) holds on this model as a census; with AT11 this closes the machine-executable content of the weak-coupling limit: exact at finite coupling, Lindblad in the limit, uniform over states; boundary: the operator-norm semigroup theorem on general Hilbert spaces remains cited — this register's 4 dimensions carry the concrete content",
    exactness: "EXACT",
    witness: "W-M",
    anchors: ["choice-lang"],
  },
  {
    id: "AT14",
    claim:
      "the phase-alignment bank: the correlation term's one-shot core is bankable WITHOUT quantum side information — an incoherent controlled-phase controller (diagonal in the product basis) raises the banked weight coherence from |Σ_r σ_r| to Σ_r |σ_r| exactly, the triangle inequality attained",
    dynamics: "engineered",
    price:
      "the aligned bank meets the ℓ¹ optimum to 1.11e−16 (worst deviation over random and sector-diagonal inputs; naive ≤ ℓ1 always, worst excess 0.00e+0); the boost recovers up to 72.7% of the bank on opposite-phase states — coherence that destructively interfered in the naive marginal is one-shot bankable by an incoherent controller; straddlers: alignment is a no-op (1.11e−16 — their σ_r already share the input phase + π/2); the residual gap to C_total is the GENUINE correlation coherence — its asymptotic access is quantum-side-information territory (WY16, cited not executed); the QSI boundary of AT12 is thereby split: what one-shot incoherent control can take is executed exactly, what needs side information is priced and cited",
    exactness: "EXACT",
    witness: "W-N",
    anchors: ["choice-lang", "dsic-noether"],
  },
];
