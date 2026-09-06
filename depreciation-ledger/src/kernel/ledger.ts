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
      "model layer executed (dtc-clock): the beat is exact — F+ Z_i F = -Z_i (2.2e-16) and pi-paired quasi-energies (odd traces <= 2.9e-79) — and it CLOCKS general computation: a one-hot token keyed on the order sector advances once per subharmonic period and fires a universal reversible program (2x2 multiplier, 16/16, integer-exact cargo) with cargo fidelity 1 at every tick (3.3e-16); zero back-action on the orbit (5.6e-16); the ideal beat costs zero NET work (strobe energy constant 2.7e-15, TPM work delta(W-0), escape 1.1e-31)",
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
    costColumn: "as BINDING: no — HJW lets the promisor choose the decomposition after the fact; reveal passes exactly 1/2. Privacy is bought; binding is not — the market EXECUTED (binding-price: one-coin identity — binding slack IS concealment loss one-to-one; flat supply witnessed over the entire HJW strategy space)",
    atlasRow: "quantum-binding",
    appealRepo: "quantum-mech",
    appealCommand: "repro",
  },
  {
    claimId: "#14",
    epoch: "5",
    claim: "Scheduling is a physical law, not computation",
    verdict: "MECHANISM-SETTLED",
    numberColumn: "symmetry group exhibited (Groves gauge group); conserved charge = welfare gap, bitwise gauge-invariant; cycle sums vanish exactly",
    costColumn: "discrete exact-layer isomorphism only — NOT a continuum derivation of Green-Laffont from Noether 1918; the epoch-5 superstructure now ships at BOTH layers (choice-lang language + stable-world physics, #15 graduated) — the continuum derivation stays excluded",
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
      "the physics layer EXECUTED (stable-world): quiet-on-world deviation exactly 0; sector update p' = p + γ(1−p) and leakage (1−γ)^k(1−p0) exact to 1.1e-15 for every input; k=200 into-world collapse to 1.6e-13; the membership charge as Lyapunov function ΔV = γ(1−V) exact to 1.9e-16, conserved to 5.6e-16 under engineered branch programs (one functional, two regimes); eps-perturbed asymptotic leakage under the exact bound eps/(1−(1−eps)(1−γ)) on the full census; escape worst drop exactly 0; the language layer ships separately (choice-lang)",
    costColumn:
      "the law is AUTHORED — the engineer writes the channel; nature's instantiation not claimed (machine layer, the vacuum-compiler precedent); the law selects the WORLD, never the CONTENTS (path-dependent within-world state); stability is PURCHASED — sector-erasure tariff h2(q̄)·kT ln2 per run on the classical face (quoted from route-price/#11), coherent face model-dependent, unpriced; escape unpriced by the law (parametric up-rate r in closed form; thermal reading not shipped); the continuum Green-Laffont derivation stays excluded (#14/#16 boundary unchanged)",
    atlasRow: "choice-primitive",
    appealRepo: "stable-world",
    appealCommand: "repro",
  },
  {
    claimId: "#16",
    epoch: "5",
    claim: "DSIC is a special case of Noether symmetry",
    verdict: "MECHANISM-SETTLED",
    numberColumn: "closedness identity closed-form vs numeric 2.8e-14; symmetric charge drift 2.4e-14 / 400 steps; anisotropic control drift 2.0 (fourteen orders separated)",
    costColumn: "the literal statement is FALSE as continuum derivation — only the discrete-layer isomorphism ships; the letter's poetry upgraded to a precise claim with its boundary written on the same line — and the upgrade itself is now EXECUTED over the whole letter (letter-audit: origin claim as the Busy-Beaver ladder, five abilities priced, A1 both-sides law)",
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
