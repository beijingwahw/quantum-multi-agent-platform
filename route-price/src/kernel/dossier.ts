/**
 * The two OPEN rows of the atlas, each rendered as a dossier: the claim
 * restated precisely, the certificate a demonstration would have to exhibit,
 * the route as milestones that name their own failure mode, and the prices
 * with derivations. This module is DATA; audit.ts is the law; witnesses.ts
 * re-derives the arithmetic that the price lines quote.
 *
 * Number discipline (mirrors the depreciation-ledger's two-column law, R1):
 * milestone statements stay number-free; numbers live in price columns,
 * where every figure carries its derivation or its executable witness.
 */

/** The only verdict this repository can express. audit.ts rejects anything
 * else by name — a dossier that could claim settledness would be a dossier
 * that could lie about its own epoch. */
export type DossierVerdict = "OPEN-ROUTE";

export type CriterionStatus = "CERTIFIED-ELSEWHERE" | "UNCERTIFIED";

export interface Criterion {
  readonly id: string;
  readonly demand: string;
  readonly status: CriterionStatus;
  /** Where the certified face lives (citation id or local:<repo>); UNCERTIFIED rows still name the demand's nearest anchor. */
  readonly anchor: string;
}

export interface Milestone {
  readonly id: string;
  readonly statement: string;
  /** cite:<ID> resolves in docs/theory.md; local:<repo> must exist on disk. */
  readonly anchor: string;
  /** How this milestone fails — a route without a failure mode is marketing (R3). */
  readonly falsifier: string;
  /** The cost column. Non-empty by law (R1). */
  readonly price: string;
  /** The execution record (v0.2.0): a sibling repo's certificate plus this
   * repo's own passing cross-check witness. Absent while the milestone is
   * still only routed. Policed by law R7. */
  readonly execution?: MilestoneExecution;
}

/** What flips a milestone to CERTIFIED-ELSEWHERE: the sibling repo that shipped
 * the certificate, the certificate's id there, and the witness of THIS repo
 * that re-derives the cited numbers at toy scale. A milestone may claim an
 * execution only with all three — anything less is a counterfeit certificate. */
export interface MilestoneExecution {
  /** Sibling workspace repo (must exist on disk, R7). */
  readonly repo: string;
  /** The sibling's certificate id(s), e.g. "TC9". */
  readonly certificate: string;
  /** One line: what the sibling shipped. */
  readonly shipped: string;
  /** Witness id of THIS repo whose run backs the claim (must exist and pass, R7). */
  readonly crossCheck: string;
}

export interface PriceLine {
  readonly id: string;
  readonly item: string;
  readonly amount: string;
  readonly witness?: string;
}

export interface Dossier {
  readonly id: string;
  readonly atlasRow: string;
  readonly claim: string;
  readonly scope: string;
  readonly verdict: DossierVerdict;
  readonly criteria: readonly Criterion[];
  readonly milestones: readonly Milestone[];
  readonly prices: readonly PriceLine[];
  readonly citations: readonly string[];
}

export const DOSSIERS: readonly Dossier[] = [
  {
    id: "D1",
    atlasRow: "dtc-clock",
    claim: "Time crystals as the clock wall — a zero-energy, eternal beat clocking general computation.",
    scope:
      "Three faces, three different truths: the beat exists (driven systems, experimentally certified at NISQ scale); the beat is zero-energy (closed as impossible in equilibrium — a no-go, not a promise); the beat clocks general computation (certified at the model layer by dtc-clock since that repo shipped, and re-priced here: milestones M3 and M4 now carry execution records with cross-checks W-D and W-E — this dossier verifies its neighbors' receipts, it does not take them on faith).",
    verdict: "OPEN-ROUTE",
    criteria: [
      {
        id: "D1-C1",
        demand: "subharmonic rigidity — the response stays locked at the doubled period under drive detuning and perturbation",
        status: "CERTIFIED-ELSEWHERE",
        anchor: "cite:MI22",
      },
      {
        id: "D1-C2",
        demand: "wall coherence — clocks across the register agree in phase at every tick",
        status: "CERTIFIED-ELSEWHERE",
        anchor: "cite:MI22",
      },
      {
        id: "D1-C3",
        demand: "universality — the tick drives a universal gate set for the full depth of a computation",
        status: "CERTIFIED-ELSEWHERE",
        anchor: "local:dtc-clock",
      },
      {
        id: "D1-C4",
        demand: "energy accounting — energy per tick priced against the tariff schedule of rival clocks at equal error",
        status: "CERTIFIED-ELSEWHERE",
        anchor: "local:dtc-clock",
      },
    ],
    milestones: [
      {
        id: "D1-M1",
        statement:
          "Separate the wording from the physics: no equilibrium ground state beats at all — the zero-energy half of the claim is closed as impossible, not open as promising.",
        anchor: "cite:WO15",
        falsifier:
          "none available from inside equilibrium — the no-go IS the falsifier: no local order parameter oscillates in any ground or thermal-equilibrium state of a local Hamiltonian.",
        price:
          "keeping zero-energy costs the entire beat (WO15). The wording survives only re-scoped to driven systems, where the drive is paid every period — see D1-P3.",
      },
      {
        id: "D1-M2",
        statement:
          "Walk the Floquet route: the beat is real and the drive is the meter — the proposal and the processor demonstration already exist at NISQ scale.",
        anchor: "cite:WIL12",
        falsifier:
          "heating: driven systems generically absorb their way to infinite-temperature mush; the order survives only behind many-body-localization or prethermal protection, and every demonstrated protection has a finite lifetime — drive long enough and the crystal dies.",
        price:
          "drive power every period, for as long as the crystal is asked to beat. The word 'eternal' is bought with a power cord (hardware-specific; no number quoted without a measurement to stand on — D1-P3).",
      },
      {
        id: "D1-M3",
        statement:
          "Promote the beat to a clock register: ticks phase-lock a data register across a full circuit depth — the job the Feynman-Kitaev clock does today, done by physics instead of spectrum. Executed at the model layer by dtc-clock; cross-checked here at toy scale (W-D).",
        anchor: "local:vacuum-compiler",
        falsifier:
          "per-tick dephasing accumulates; the wall fails where cumulative phase error exceeds the circuit's tolerance — the demonstrated ticks are far short of hardware circuit depth (dtc-clock's certificate is in-model: hardware instantiation stays MI22's to claim).",
        price:
          "coherence-time-per-tick times tick-count must cover the computation, and every read of the clock pays the readout tariff — the same erasure schedule the vacuum-compiler already prices (D1-P2). EXECUTED (dtc-clock TC5/TC6/TC9: beat-keyed one-hot token, zero back-action, a TOFFOLI+CNOT 2x2-bit multiplier 16/16 integer-exact with cyclic self-reset) and cross-checked by W-D: echo identity worst 2.22e-16 (n=4, 5 random-J trials), trajectory |m(k) - (-1)^k| worst 1.11e-15 (k<=12), token return 1 - |<0|F^(2k)|0>|^2 = 0 exactly (k<=6), own 11-gate/13-wire multiplier 16/16 integer-exact, 8192/8192 bijection, bitwise self-reset, garbage census 5 wires.",
        execution: {
          repo: "dtc-clock",
          certificate: "TC5/TC6/TC9",
          shipped:
            "the beat keys a one-hot clock token that sequences a reversible 2x2-bit multiplier — cargo fidelity 1 at every tick, 16/16 integer-exact, cyclic self-reset",
          crossCheck: "W-D",
        },
      },
      {
        id: "D1-M4",
        statement:
          "The certificate itself: a computation clocked by a time crystal whose per-operation energy undercuts reversible rivals at equal error. Executed at the model layer by dtc-clock; cross-checked here at toy scale (W-E).",
        anchor: "cite:LAND61",
        falsifier:
          "if drive energy per tick exceeds the rivals' erasure bill, the wall loses on its own tariff schedule — universality without an energy win is a slower clock. The in-model tariff is now settled (see price); the hardware drive bill is not, and remains D1-P3's open cord.",
        price:
          "the floor any rival pays is erasure at kT ln2 per irreversible bit (D1-P1); beating that floor requires reversible operation, at which point the clock is overhead, not engine. EXECUTED (dtc-clock TC12/TC13/TC14/TC17: ideal beat zero net work, detuned W_0 = J(n-1)sin^2(2*delta), tariff 0 < 5 < 9 < 43.02 units, winner the Bennett-uncomputed machine) and cross-checked by W-E: orbit energy flat to 2.66e-15 (n=6, J=1.3, k<=12), W_0 numeric 0.256552 matching the closed form to 1e-12, isolated stroboscope |cos 2k*delta| exact to 3.33e-16, tariff ordering re-priced on this repo's own netlist 0 < 5 < 9 < 43.02 (5 units = 1.4355e-20 J at 300 K, 9 units = 8.6129e-25 J at 10 mK).",
        execution: {
          repo: "dtc-clock",
          certificate: "TC12/TC13/TC14/TC17",
          shipped:
            "zero net work on the ideal beat; the detuned first period's exact price W_0 = J(n-1)sin^2(2*delta); the legislated tariff table — the DTC-clocked Bennett machine wins at 0 units",
          crossCheck: "W-E",
        },
      },
    ],
    prices: [
      {
        id: "D1-P1",
        item: "the floor every clock pays per irreversible bit — E = kT ln2, with k the exact SI constant; dilution-fridge and room temperature span four orders of magnitude.",
        amount:
          "closed form k·T·ln2 with k = 1.380649e-23 J/K (exact, SI 2019); ln2 independently re-derived by midpoint quadrature of 1/x on [1,2]; E(300 K) ≈ 2.8710e-21 J, E(10 mK) ≈ 9.5699e-26 J, ratio exactly the temperature ratio (30000).",
        witness: "W-A",
      },
      {
        id: "D1-P2",
        item: "eternity is metered: expected erasure for a full clock-readout cycle grows superlinearly with circuit depth — the beat may be eternal, the readout is not.",
        amount:
          "the vacuum-compiler T4 law, priced: (T+1)·log2(T+1) expected erasure bits per cycle — depth 10: ≈ 38.05 bits; depth 100: ≈ 672.48; depth 1000: ≈ 9977.19; monotone, unbounded (W-A).",
        witness: "W-A",
      },
      {
        id: "D1-P3",
        item: "the drive: the re-scoped claim's recurring cost — every period, for as long as the crystal is asked to beat.",
        amount:
          "still deliberately unquoted — the boundary now sharpened by the certificates it waits on: every IN-MODEL face of the cord is metered (ideal beat zero net work; detuning pays W_0 = J(n-1)sin^2(2*delta), W-E's 0.256552 at J=1.3, n=6, delta=0.1; readout and maintenance on their own meters), so what remains unpriced is exactly the HARDWARE cord — the dissipated joules of a physical drive, which no repo computes and only an experiment surviving its own falsifier can invoice. The theory price is real and cited (ERS17: accuracy is bought with entropy; VHM26: the time-crystal clock's performance is a thermodynamic quantity; NS25: the fuel itself is priced) — the number is not, by design.",
      },
    ],
    citations: ["WIL12", "WO15", "MI22", "LAND61", "ERS17", "VHM26", "NS25"],
  },
  {
    id: "D2",
    atlasRow: "choice-primitive",
    claim: "'Choice' as a language primitive — writing the desired world makes it a stable solution of the program.",
    scope:
      "The primitive's nearest certified relatives are already in the atlas: coherent branching (controlled operations — legal today), stability-as-invariance (ground-state compilation), the certification toll (the postselection ledger). What is undelivered is the semantics where stability is the default; the conservation law that would guard it is now EXHIBITED at the mechanism-design layer (dsic-noether shipped the Groves gauge group and its charge, discrete and continuum) and re-priced here with cross-check W-F — the language-level charge remains unidentified, and the dossier keeps drawing that boundary honestly.",
    verdict: "OPEN-ROUTE",
    criteria: [
      {
        id: "D2-C1",
        demand: "semantics — a formal model with choice as a primitive, well-defined and composable",
        status: "UNCERTIFIED",
        anchor: "cite:SEL04",
      },
      {
        id: "D2-C2",
        demand: "stability — the desired world invariant under the program, robust under perturbation",
        status: "CERTIFIED-ELSEWHERE",
        anchor: "local:vacuum-compiler",
      },
      {
        id: "D2-C3",
        demand: "the conservation law — the symmetry whose conserved charge guards the stability (exhibited at the mechanism-design layer: the Groves gauge group and its welfare-gap charge; the language-level charge remains open)",
        status: "CERTIFIED-ELSEWHERE",
        anchor: "local:dsic-noether",
      },
      {
        id: "D2-C4",
        demand: "certification — observing that the desired world was obtained, priced",
        status: "CERTIFIED-ELSEWHERE",
        anchor: "local:postselect-sched",
      },
    ],
    milestones: [
      {
        id: "D2-M1",
        statement:
          "Draw the boundary of the legal primitive: coherent control exists — a superposed control steers the program down superposed branches; what cannot exist is copying the condition to the branches' callers. The control steers, never broadcasts.",
        anchor: "cite:SEL04",
        falsifier:
          "the copy attack, executed in W-B: a CNOT 'copy' of the control entangles instead of cloning — the pair's coherence is rephasing-invariant while a true clone's would rotate at twice the rate, the two coinciding only at isolated phases and separated everywhere by the covariance mark: no-cloning made executable (WZ82).",
        price:
          "one control, shared: parallel worlds query it jointly and pay entanglement, or measure it and collapse the choice. SEL04's quantum-data-classical-control restriction is not timidity — it is this wall, adopted as syntax (D2-P2).",
      },
      {
        id: "D2-M2",
        statement:
          "Define stability as invariance: the desired world is stable exactly when its projector reduces the program's evolution — testable algebra, executed on toy models.",
        anchor: "local:vacuum-compiler",
        falsifier:
          "generic targets are not invariant — W-B's random-program trials keep fidelity strictly below the engineered-exact runs; stability is engineered (compiled), never a default of the syntax.",
        price:
          "engineering invariance is the vacuum-compiler's compilation cost all over again: the desired world must be made an invariant subspace before the language can be asked to keep it (D2-P3).",
      },
      {
        id: "D2-M3",
        statement:
          "Harden to robustness: invariance must survive perturbation — a gap law, the same spectral currency the epoch-4 compiler already pays.",
        anchor: "local:vacuum-compiler",
        falsifier:
          "perturbation past the gap melts the world — the fuel-tilt gap-closing law; stability without a gap is a coincidence, not a solution.",
        price:
          "gap margin bought with circuit structure: the wider the guard band, the more the compilation constrains the program. Unquoted here — this milestone's number belongs to the compiler that earns it.",
      },
      {
        id: "D2-M4",
        statement:
          "Ask the Noether question: which group action, which conserved charge guards the choice semantics — the mechanism-design layer's answer is now exhibited (dsic-noether's Groves gauge group and charge, discrete and continuum, cross-checked here by W-F); the LANGUAGE-level charge remains unidentified.",
        anchor: "local:dsic-noether",
        falsifier:
          "if no symmetry guards the semantics, stability is maintenance rather than physics — every perturbation must be recompiled against, and the 'physical law' wording retires. This face stands: the exhibited charge guards DSIC truth-telling, not yet the choice primitive's semantics.",
        price:
          "REPRICED (was: unpriced by law — no number for an unexhibited conservation law; the law is now exhibited): the charge has the closed form G(s;t) = -(n-1)(s-t)^2/(2n), zero exactly at truth, gauge-invariant along the Groves orbit p -> p + h(theta_-i) — cross-checked by W-F on exact BigInt rationals: gap === closed form bitwise on 72 probes (n in {2,3}); two gauges shift every payment by exactly h - h' with gains bitwise unchanged; the off-gauge payment p + eps*s buys a profitable deviation worth exactly eps^2*n/(2(n-1)) at s* = t - eps*n/(n-1) (eps = 1/7: worth 1/49 at n=2, 3/196 at n=3). The language-level charge stays unpriced — the exhibited one prices the mechanism layer only.",
        execution: {
          repo: "dsic-noether",
          certificate: "T1/T6/T8",
          shipped:
            "the Groves gauge group with its conserved charge G(s;t) = -(n-1)(s-t)^2/(2n), bitwise at the discrete layer and coefficient-wise on the continuum, plus the Noether-to-Green-Laffont chain [E][I][S][G] with its four load-bearing controls",
          crossCheck: "W-F",
        },
      },
      {
        id: "D2-M5",
        statement:
          "Price the observation: certifying the desired world costs the postselection toll unless the choice is made classical — in which case the primitive is an if-statement wearing a costume.",
        anchor: "local:postselect-sched",
        falsifier:
          "the measurement wall — reading which world collapsed the choice, the same wall readout puts on superposed order; W-B's certification trials: the observed frequency matches the branch weight, and the repetitions match the toll ledger.",
        price:
          "uniform branches: expected certifications equal the number of worlds (the 1/P arithmetic, W-C) — the epoch-3 ledger, re-invoiced at the language layer (D2-P1).",
      },
    ],
    prices: [
      {
        id: "D2-P1",
        item: "the certification toll at the language layer: expected repetitions to certify the desired world equal the reciprocal branch weight.",
        amount:
          "uniform B branches: 1/P = B exactly on the grid, closed form vs seeded Monte Carlo (W-C); weighted branches: 1/P = 1/|alpha_w|² — e.g. weight 1/2 costs a doubling, weight 1/5 costs a fivefold (W-B certification trials).",
        witness: "W-C",
      },
      {
        id: "D2-P2",
        item: "the broadcast ban: the condition is spent, not copied — branch callers inherit entanglement with the control, not replicas of the choice.",
        amount:
          "executed, not quoted: the W-B clone trial shows the CNOT pair's coherence stays fixed under rephasing (machine zero) while the clone's target rotates at twice the rate — two curves that coincide only at isolated phases and are separated everywhere by the covariance mark.",
        witness: "W-B",
      },
      {
        id: "D2-P3",
        item: "stability, the engineered kind: invariance exact for compiled targets, strictly broken for generic ones — the default-world price of the primitive.",
        amount:
          "W-B: engineered targets drift at machine zero (fidelity gap < 1e-15); seeded random programs average near the Haar mean and never touch exact — the distance between the two families is the compilation the language would have to automate.",
        witness: "W-B",
      },
    ],
    citations: ["SEL04", "WZ82", "NOE18"],
  },
];
