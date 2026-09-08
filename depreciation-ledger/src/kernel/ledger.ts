/**
 * The ledger — the visitor's seventeen claims, both columns on one page.
 *
 * Schema law (claim #17 itself): a row may quote a number only if it books a
 * cost; a row with no executable cost column may not quote numbers at all and
 * must carry verdict OPEN. The checker in audit.ts enforces this — the
 * visitor's conduct rule, as a build gate.
 */

export type Verdict =
  | "HEURISTIC"
  | "HW-WAIT"
  | "CONDITIONAL-WALL"
  | "INFO-WALL"
  | "MECHANISM-SETTLED"
  | "OPEN";

export interface LedgerRow {
  readonly claimId: string;
  readonly epoch: string;
  readonly claim: string;
  readonly verdict: Verdict;
  /** what may be quoted in public — empty means NO numbers allowed */
  readonly numberColumn: string;
  /** the booked cost — empty means the row cannot exist with numbers */
  readonly costColumn: string;
  /** anchor row id in bqp-map/src/atlas/entries.ts */
  readonly atlasRow: string;
  /** where the machine re-proves this row: repo directory + npm script name */
  readonly appealRepo: string;
  readonly appealCommand: string;
}

export const LEDGER: readonly LedgerRow[] = [
  {
    claimId: "#01",
    epoch: "1",
    claim: "Fault-tolerant quantum computing is epoch-1 archive technology",
    verdict: "HEURISTIC",
    numberColumn: "logical-layer p=128 depth monotonicity, worst r_128 = 0.9912 @ n=14; p=0 trivial point excluded",
    costColumn: "gross [[144,12,12]] needs pPhys <= 3e-4; surface d=17 = 51,160 qubits / 3.28M T gates at p>=100; real-time qLDPC decode is the wall (CPU rho ~1125x over budget; FPGA/ASIC only)",
    atlasRow: "qaoa-heuristic",
    appealRepo: "ft-qaoa",
    appealCommand: "repro",
  },
  {
    claimId: "#02",
    epoch: "1",
    claim: "Quantum networking",
    verdict: "HEURISTIC",
    numberColumn: "ERS 0.666 delivered pairs/round at F0=0.97, fMin=0.975 (asap/late/TDM: 0)",
    costColumn: ">= 4 storage slots per link (3-slot ladder saturates at 0.9497, delivery zero); release/discard is a first-class primitive (swap-asap freezes without it)",
    atlasRow: "quantum-network-sched",
    appealRepo: "ent-sched",
    appealCommand: "repro",
  },
  {
    claimId: "#03",
    epoch: "1",
    claim: "QAOA",
    verdict: "HEURISTIC",
    numberColumn: "platform: 292/292 tests, subspace-exact engine, three QPU backends",
    costColumn: "heuristic complexity class — no speedup claim; numbers reproducible, class unmoved; the physical-verification pipeline is READY (wukong-crossval: instances enumerated, parameters offline-only, dry-run green — awaiting granted hours only)",
    atlasRow: "qaoa-heuristic",
    appealRepo: "ds_extracted/ds",
    appealCommand: "test",
  },
  {
    claimId: "#04",
    epoch: "1",
    claim: "The time capsule: effective 80 qubits, NP-hard 5/5",
    verdict: "HEURISTIC",
    numberColumn: "equivalent-80 constraint-subspace exact solve; NP-hard track 5/5 vs best classical heuristic 0/5; Hungarian cross-check pointwise",
    costColumn: "'equivalent' = subspace equivalence, NOT a physical 80-qubit machine; capsule OWNERSHIP audited and rejected (burial record: the machine-audited registry at burial-record, every error in two columns — batch and error counts live THERE, machine-re-derived, never quoted here); the QUALITY layer now executed as its own census and paid forward to FULL coverage (mutant-census: the burial record's defect classes replayed as nine mutants and killed by a ten-property battery — 6 EXACT + 1 CRASH + 2 DATA, zero survivors; the kernel family's byte-identity censused live, unregistered drift fails the build; the pre-batch-21 guard debt PAID in full — 42 entries retrofitted, the register emptied, zero tolerated since; the platform censused under its registered exemption; `npm run total` judges the whole workspace's tests AND typechecks as one command; and the ENROLLMENT — the registry imported live on every run, every buried error wired to the guard that kills it now: on the mutants by declared class, on build gates anchored file+needle to disk, or booked unenforceable with printed reasons — an error without an enforcement anchor can no longer be buried; and the A-board — every one of those guards now carries evidence: a firing demo injected into the real checker, a live shot on every run, or resolved machinery on disk — a guard that cannot fire is a false guard)",
    atlasRow: "subspace-exact-platform",
    appealRepo: "bqp-map",
    appealCommand: "test",
  },
  {
    claimId: "#05",
    epoch: "2",
    claim: "The quantum switch liberates causal order",
    verdict: "HW-WAIT",
    numberColumn: "two zero-capacity channels -> chi = 0.048795 bit via switch (ESC18, machine-verified); replacer control displacement exactly 1/2",
    costColumn: "capacity advantage only — no combinatorial-optimization speedup in the advantage catalog; BBBV wall stands; hardware does not yet ship switches at scale",
    atlasRow: "order-as-resource",
    appealRepo: "switch-sched",
    appealCommand: "repro",
  },
  {
    claimId: "#06",
    epoch: "2",
    claim: "The scheduler no longer orders tasks",
    verdict: "HW-WAIT",
    numberColumn: "hybrid law U_sw = (U_def + 2)/2 exact (~1e-16) — direction never inverts",
    costColumn: "order is superposable, not abolishable: measurement wall EXECUTED (readout-wall: the order bit is input-blind at P=1/2, the dephased switch IS the fixed-order mixture to 1e-15, ESC18 chi dies 0.048795->0 exactly); advantage-catalog wall; mechanism wall (DSIC needs causal info structure)",
    atlasRow: "order-as-resource",
    appealRepo: "k-switch",
    appealCommand: "repro",
  },
  {
    claimId: "#07",
    epoch: "3",
    claim: "Many-worlds sorter: postselection reads the optimum in O(1)",
    verdict: "CONDITIONAL-WALL",
    numberColumn: "in-branch fidelity exactly 1.000000000000 (n=4..14, t=1)",
    costColumn: "ledger 1/P = N/t (classical-random rate); restart-optimal iff t/N >= (3-sqrt(2))/4 ~ 0.39645; below it ledger/E* grows ~ sqrt(N/t); PostBQP=PP is cited, not re-proven; survivor semantics EXECUTED (survivor-census: on a weighted prior the survivor is the POSTERIOR over optima — the sorter sorts by the prior you bring, an unfunded optimum never returns; kill register itemized per universe, sums to 1-P exactly; waiting price E[T]=1/P with the exact (1-P)^k schedule, the exp bound is a +40% overcharge at P=1/2/delta=1e-6)",
    atlasRow: "postselect-sort",
    appealRepo: "postselect-sched",
    appealCommand: "repro",
  },
  {
    claimId: "#08",
    epoch: "3",
    claim: "Retrocausal cache: answers before questions, hit rate 100%",
    verdict: "INFO-WALL",
    numberColumn: "correlations real to 15 decimals (CHSH 2.828427124746189); pre-arrival TV distance vs shared seed: 0.000000000000000",
    costColumn: "marginal exactly I/2 under any local map; withdrawal tariff ITEMIZED as its own schedule (nosignal-tariff: 24-axis zero leakage at the rounding floor, net(p) = (1-h2((1-p)/2))/2 monotone with exact anchors, h2 on two paths); net (1-h2(q))/2, exactly 0 at p=0 (the seed floor); 256-strategy census caps classical CHSH at exactly 2; reconciled with #07 as ONE wall (survivor-census Table D: 'O(1)' and '100%' are both conditional-frame truths, the unconditional yields E[T]=1/P and net(p) are the price columns)",
    atlasRow: "retrocausal-cache",
    appealRepo: "retro-cache",
    appealCommand: "repro",
  },
  {
    claimId: "#09",
    epoch: "4",
    claim: "Vacuum compiler: programs written into the ground state",
    verdict: "MECHANISM-SETTLED",
    numberColumn: "H_prop|Psi_hist> = 0 to ~1e-15; dressing identity W+ H_prop W = (1/2) L_path (x) I for ALL circuits (~4e-16); conditional readout fidelity exactly 1 at every clock step",
    costColumn: "expected erasure (T+1)log2(T+1) bits per readout cycle; fuel tilt narrows the spectral gap (not the cargo); direct execution of T gates costs 0 erasure — the vacuum notarizes computation, never substitutes it",
    atlasRow: "vacuum-execution",
    appealRepo: "vacuum-compiler",
    appealCommand: "repro",
  },
  {
    claimId: "#10",
    epoch: "4",
    claim: "Time crystals as the zero-energy clock wall",
    verdict: "MECHANISM-SETTLED",
    numberColumn:
      "model layer executed (dtc-clock): the beat is exact — F+ Z_i F = -Z_i (2.2e-16) and pi-paired quasi-energies (odd traces <= 2.9e-79) — and it CLOCKS general computation: a one-hot token keyed on the order sector advances once per subharmonic period and fires a universal reversible program (2x2 multiplier, 16/16, integer-exact cargo) with cargo fidelity 1 at every tick (3.3e-16); zero back-action on the orbit (5.6e-16); the ideal beat costs zero NET work (strobe energy constant 2.7e-15, TPM work delta(W-0), escape 1.1e-31); the decay-law arc: lambda_1(p) = 1 - 2p + c_2 p^2 + c_3 p^3 + O(p^4) — c_2(n) = (n-1)C(n-2,m)/2^(n-2) the central-binomial partial sum (TC36/TC37, BigInt zero-residue), gamma = 2 universal (TC33), the Krawtchouk integer spectrum {n-2, n-6, ...} (TC34), c_3 the two-face rational with the first level-repulsion face (TC38), and the QUOTIENT-FACE LAW (v0.14.0): 3<u,Q_3 u> + (n-2)<u,Q_2 u> = 0 exactly — u the joint Rayleigh vector, q(n) = -(n-2)c_2(n)/3 (TC39); the COUPLING CLOSED FORMS (v0.15.0): vv = C(n,j)2^(n-1) with the truncated Krawtchouk norms equal to the classical full norms, uu = n·2^(n-1), |cpl(n,j)| = 2n(n-1)C(n-2,m)C(dim-1,(j-1)/2) — the coupling proportional to c_2's central binomial, zero-residue over n=4..36 (TC40) — and the share's horizon pushed to n=1024 by pure substitution: monotone past 1 to 1.1078, extrapolating to 9/8 under a/sqrt(n) corrections (identified by extrapolation); THE 9/8 LIMIT ASSEMBLED (v0.16.0): the mode ratio factors EXACTLY into central binomials — zero BigInt residue — and with the classical C(2t,t) asymptotic the share assembles to 9/8 - a/sqrt(n) + O(1/n), monotone with geometrically shrinking doubling increments (the limit bracketed at n=2048 with 9/8 inside to four digits), the correction constant converging to 0.55091 — so r -> (n-2)c_2/4 and c_3 -> -(n-2)c_2/12: the third-order face closed in closed form (TC41); THE ARCSINE LAW (v0.17.0): the exact chain identity share = P·A·S/4 with S's k-profile the arcsine density — S·sqrt(dim)·sqrt(pi) -> pi/2 (the Beta(1/2,3/2) integral), independently reproducing 9/8 through the chain, and a = 0.55087 with the one-term basis refuted at seven digits (the x^(-1/2) endpoint singularities feed the correction through singular Euler-Maclaurin constants) (TC42); THE CONSTANT PINNED (v0.18.0): sigma1 = -0.4896664762 so a = 0.550874786 at ten digits, one-term zeta-lattice candidates all refuted at that precision, and the fixed-k edge law EXACT (summand*dim -> (2k+1)C(2k,k)/(2*4^k*k)) — the final singular-EM coefficient assembly delineated to one step and priced (TC43); THE ASSEMBLY EXECUTED (v0.19.0): the EXACT TRANSFER sigma1(n) = G(n)·u(D) - sqrt(n) (algebraic in the chain pieces, float-floor residual) carries the ten digits to the S-face constant kappa = sigma1/(2sqrt(2/pi)) = -0.3068529590, and the arc's third-order face closes at theorem grade: c_3 = -(n-2)c_2/12·(1 - 3·sigma1/sqrt(n) + O(1/n)) — TC41's IF now a theorem with its full correction face (TC44); and the constant DECOMPOSES additively, machine-arbitrated: kappa = zeta_m + Phi1 with zeta_m = sum_k(m_k - mu_k) - sqrt(2/pi) = -0.306398243 the edge-mass series' generalized-zeta constant (exact per-k rationals, exact next-order laws 3/8 and -11/128, accelerated through zeta(3/2)/zeta(5/2) with an explicit k^-7/2 remainder — the STRUCTURAL reason the zeta(1/2) lattices failed) and Phi1 = -4.547e-4 the cutoff face's subleading constant — small but NONZERO, machine-bracketed, its closed form the arc's one remaining open face (TC45)",
    costColumn:
      "every use metered, nothing waived: detuned beats pay W_0 = J(n-1)sin^2(2delta) exactly (chain heating suppressed 4.5x vs the isolated echo over 15 periods, DATA — no infinite-time total claimed, prethermal cited); the tariff table LEGISLATED BEFORE THE NUMBERS: DTC-clocked Bennett 0 < as-built 5 < irreversible rival 9 < FK spectral 43.02 (T+1)log2(T+1) units quoted from vacuum-compiler — the clock is overhead, not engine (D1-M4 pre-announcement, now with numbers); phase reads on the orbit cost 0 (immunity witnessed), amplitude reads and noise/error-correction NOT modeled — the readout wall's face; hardware instantiation NOT claimed (MI22 holds the hardware cells); the WO15 tombstone executed in the same repo: equilibrium never beats, the only static-Hamiltonian beat is a spent two-eigenstate battery at the Bohr frequency (amplitude 0.6508, period exact 1.4e-15) — ERS17's autonomous-clock price",
    atlasRow: "dtc-clock",
    appealRepo: "dtc-clock",
    appealCommand: "repro",
  },
  {
    claimId: "#11",
    epoch: "4",
    claim: "The second law is a disclaimer clause, not a limit",
    verdict: "MECHANISM-SETTLED",
    numberColumn: "static storage zero work (eigenstate); tilt raises P(T) 0.143 -> 0.399 with cargo exact to 8e-15",
    costColumn: "the clause has a tariff schedule: every readout mode pays Landauer kT ln 2 per bit — readout-tariff settled, not waived",
    atlasRow: "readout-tariff",
    appealRepo: "vacuum-compiler",
    appealCommand: "repro",
  },
  {
    claimId: "#12",
    epoch: "4",
    claim: "Bell pairs as money",
    verdict: "MECHANISM-SETTLED",
    numberColumn: "GHZ double-mortgage ceiling exactly 1/sqrt(2), attained by the balanced family at x = 1/2",
    costColumn:
      "acceptance threshold > 1/2 means at most ONE transfer per pair — exclusivity is physics, and it prices the currency: no double spending, ever; the SETTLEMENT now executed as its own board (ent-clearing: teleportation burns the coin — identity channel, post-trade concurrence exactly 0, goods frozen until the classical leg settles; dense coding returns it as a catalyst — exactly 2 cbits, concurrence exactly 1; Procrustean netting at exactly 2*l_min; the mint wall — local ops never raise E_F, one global CNOT mints)",
    atlasRow: "bell-money-exclusivity",
    appealRepo: "quantum-mech",
    appealCommand: "repro",
  },
  {
    claimId: "#13",
    epoch: "4",
    claim: "No-cloning underwrites every contract for free",
    verdict: "MECHANISM-SETTLED",
    numberColumn: "as notary: WZ82, exact; counterfeit curve (3/4)^m verified",
    costColumn: "as BINDING: no — HJW lets the promisor choose the decomposition after the fact; reveal passes exactly 1/2. Privacy is bought; binding is not — the market EXECUTED (binding-price: one-coin identity — binding slack IS concealment loss one-to-one; flat supply witnessed over the enumerated families plus the v0.2.0 parameterized continuous family, 2141 ensembles machine-verified — no decomposition moves the reveal at any offer)",
    atlasRow: "quantum-binding",
    appealRepo: "quantum-mech",
    appealCommand: "repro",
  },
  {
    claimId: "#14",
    epoch: "5",
    claim: "Scheduling is a physical law, not computation",
    verdict: "MECHANISM-SETTLED",
    numberColumn: "symmetry group exhibited at BOTH layers (Groves gauge group); conserved charge = welfare gap, bitwise gauge-invariant; cycle sums vanish exactly; v0.2.0: the continuum chain [E]nvelope -> [I]ntegration (Poincare/FTC) -> [S]tationarity -> [G]roves form is the ZERO POLYNOMIAL in exact rational arithmetic (holds for every type profile in the region at once), the charge in closed form -(n-1)(s-t)^2/(2n)",
    costColumn: "the continuum derivation EXECUTED at the smooth layer (dsic-noether v0.2.0): both directions (Groves => DSIC by the closed-form charge; DSIC => Groves by the chain), Noether I = gauge-orbit conservation of the charge (dG/deps = 0 coefficient-wise), Noether II = the gauge identity whose moduli reading is Green-Laffont uniqueness (the solver reads the gauge off any DSIC payment); four controls mark the load-bearing hypotheses — off-gauge crime priced eps^2 n/(2(n-1)) exactly, kappa-family implementable-but-non-Groves with drift exactly kappa(1-kappa)(n-1)/n s, the winding form closed yet 2*pi around the unit diamond (Poincare load-bearing — a strictly continuum shape no finite type set can host), the second-price kink locus; what stays excluded: only the general measurable-space Green-Laffont (GL79, cited) and Noether's theorems as general statements (NOE18/KSS11, cited) — the epoch-5 superstructure ships at BOTH layers (choice-lang language + stable-world physics, #15 graduated)",
    atlasRow: "dsic-noether",
    appealRepo: "dsic-noether",
    appealCommand: "repro",
  },
  {
    claimId: "#15",
    epoch: "5",
    claim: "'Choice' as a language primitive",
    verdict: "MECHANISM-SETTLED",
    numberColumn:
      "the physics layer EXECUTED (stable-world): quiet-on-world deviation exactly 0; sector update p' = p + γ(1−p) and leakage (1−γ)^k (1−p0) exact to 1.1e-15 for every input; k=200 into-world collapse to 1.6e-13; the membership charge as Lyapunov function ΔV = γ(1−V) exact to 1.9e-16, conserved to 5.6e-16 under engineered branch programs (one functional, two regimes); eps-perturbed asymptotic leakage under the exact bound eps/(1−(1−eps)(1−γ)) on the full census; escape worst drop exactly 0; the coherent face priced (v0.2.0): C_rel = 1 for pure straddlers to 1.11e-15, dephasing preserves <H> to 0.00e+0 so F(rho)-F(Delta rho) = kT ln2 · C_rel exactly, erasure monotone (worst rise 0.00e+0) at exactly twice the classical rate; the thermal reading shipped: detailed-balance identity 1/(1+e^-beta-dE) exact to 2.22e-16, design rule beta-dE >= ln(K gamma/delta), 5 GHz at 10 mK reads 1-3.79e-11 (exact SI); the bath DERIVED microscopically (v0.3.0): collision model — detailed balance emerges to 5.55e-17, [U,H_tot]=0 exactly, the law IS the T=0 collision (TD 2.35e-14 @beta-dE=30 decaying as e^-beta-dE), coherence factor cos(theta) temperature-free; the coherent shortcut: one-step collapse to 3.06e-17, full-basis C_rel conserved to 2.00e-15, the straddler's bit banked on the weight with FE excess exactly kT ln2 (6.66e-16); the continuum limit EXECUTED (v0.4.0): finite coupling exact (populations no higher corrections 1.11e-16, block closed form 5.55e-17, sector coherence cos^n 4.86e-17), composition error exactly O(t sin^2 theta) (halving ratio 4.0), the Davies coherence rate 1/2 restored exactly (gap 0.00e+0); the audit ledger: three-term decomposition to 2.22e-16 with every term >= 0, the inverse permutation restores the input bit-exactly (TD 0.00e+0); the generator IDENTIFIED (v0.5.0): the extraction limit IS the Lindblad operator with the Davies rates (bounded 5.98e-2 * theta^2 elementwise, uniform over states as a census — ratio 3.5 on halving); the phase-alignment bank: the l1 optimum attained exactly (1.11e-16), recovering up to 72.7% one-shot QSI-free on opposite-phase states; the language layer ships separately (choice-lang)",
    costColumn:
      "the law is AUTHORED — the engineer writes the channel; nature's instantiation not claimed (machine layer, the vacuum-compiler precedent); the law selects the WORLD, never the CONTENTS (path-dependent within-world state); stability is PURCHASED on BOTH faces — classical h2(q̄)·kT ln2 per run (quoted from route-price/#11) plus the coherent face kT ln2 · C_rel per stabilization on the authored diagonal Hamiltonian, DISSIPATED by the law and BANKED by the coherent shortcut (the straddler's full bit lands on a ground weight with FE excess exactly kT ln2; the three-term audit ledger decomposes every output exactly and the inverse permutation restores the input — dissipation is the law's choice, not a necessity); the thermal reading DERIVED from the microscopic collision bath (resonant Gibbs qubits, energy-conserving exchange — the law is the T=0 member of its own bath family; the continuum limit executed as a discrete convergence theorem with the Davies rate restored); what stays open: only the GENERAL-Hilbert-space operator-norm theorem (DAV74 — this register's concrete content is now machine-held: exact at finite coupling, Lindblad in the limit, uniform over states) and the GENUINE correlation coherence's asymptotic access (quantum side information, WY16 — its one-shot incoherent core is now executed exactly on AT14); the continuum Green-Laffont derivation is EXECUTED at the smooth layer (dsic-noether v0.2.0 — the #14/#16 boundary upgraded, its load-bearing hypotheses machine-witnessed)",
    atlasRow: "choice-primitive",
    appealRepo: "stable-world",
    appealCommand: "repro",
  },
  {
    claimId: "#16",
    epoch: "5",
    claim: "DSIC is a special case of Noether symmetry",
    verdict: "MECHANISM-SETTLED",
    numberColumn: "closedness identity closed-form vs numeric 2.8e-14; symmetric charge drift 2.4e-14 / 400 steps; anisotropic control drift 2.0 (fourteen orders separated); v0.2.0 continuum: the chain assembles coefficient-exact, dG/deps = 0 along the gauge orbit, uniqueness = the Noether-II moduli reading (gauge read off seeded random DSIC payments EXACTLY, off-orbit payments convicted)",
    costColumn: "the literal statement now SHIPS as a smooth-continuum theorem (dsic-noether v0.2.0): for smooth mechanisms on convex type regions with interior optima, efficient + DSIC <=> the Groves orbit, derived through Noether's two theorems' mechanism instances (first: orbit conservation of the charge; second: the gauge identity whose classification is uniqueness) — with the boundary written on the same line: the measurable/kinked generality of the full Green-Laffont theorem remains cited (GL79), the kink locus is its territory; the letter's upgrade is now EXECUTED over the whole letter (letter-audit: origin claim as the Busy-Beaver ladder, five abilities priced, A1 both-sides law)",
    atlasRow: "dsic-noether",
    appealRepo: "dsic-noether",
    appealCommand: "repro",
  },
  {
    claimId: "#17",
    epoch: "conduct",
    claim: "The depreciation of the other universes must be booked",
    verdict: "CONDITIONAL-WALL",
    numberColumn: "this ledger: 17 rows, every number row costed; five arithmetic witnesses re-derive headline costs from scratch",
    costColumn: "the rule itself is the build gate: a row quoting numbers without a cost column fails `npm test` — the visitor's conduct rule, enforced by machine",
    atlasRow: "postselect-sort",
    appealRepo: "depreciation-ledger",
    appealCommand: "test",
  },
];
