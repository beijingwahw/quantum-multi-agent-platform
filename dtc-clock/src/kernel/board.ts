/**
 * THE BOARD — ledger row #10's open core, executed at the model layer.
 * Route-price D1 left two cells UNCERTIFIED: C3 (the beat clocking general
 * computation) and C4 (energy accounting against the tariff schedule of
 * rival clocks). These rows certify both, plus the beat itself re-executed
 * locally (not just cited from MI22) and the WO15 tombstone. Every number
 * below was witnessed BEFORE it was written (the scratch run of
 * 2026-09-06); the audit re-derives each one from the matrices.
 *
 * Tags: EXACT (machine-witnessed, tolerance stated), DATA (census, horizon
 * stated), QUOTED (from the in-register schedule, holding repo anchored),
 * CITED (literature, key resolved in citations.md).
 */
export type Exactness = "EXACT" | "DATA" | "QUOTED" | "CITED";

export type Family = "beat" | "clock" | "compile" | "thermo" | "backaction" | "tombstone" | "certificate";

export interface BoardRow {
  readonly id: string;
  readonly claim: string;
  readonly family: Family;
  readonly price: string;
  readonly exactness: Exactness;
  readonly witness: string;
  readonly anchors: readonly string[];
}

export const BOARD: readonly BoardRow[] = [
  {
    id: "TC1",
    claim:
      "the beat, operator form: at theta=pi/2, h=0, ANY couplings, the echo satisfies F+ Z_i F = -Z_i at every site — the global flip is exact, not asymptotic",
    family: "beat",
    price:
      "worst max-entry deviation 2.2e-16 over n=4..6 x 5 trials x all sites, random J in [0,2]; the identity is structural ((-i)^n Xbar e^{-iH_zz} conjugates every Z into -Z because every ZZ pair is flip-even)",
    exactness: "EXACT",
    witness: "W-A",
    anchors: [],
  },
  {
    id: "TC2",
    claim:
      "the beat, trajectory: from |0...0> the order parameter alternates m(k) = (-1)^k — structurally exact (the orbit never leaves the ZZ eigenstate pair), witnessed at the floating-point summation floor",
    family: "beat",
    price:
      "worst deviation 8.9e-16 over n=4..6 x trials x k<=12, random J — the residual is the rounding of summing n values of +-1, not physics; the integer-exact statement lives on the cargo path (TC9), where it is genuinely 0",
    exactness: "EXACT",
    witness: "W-A",
    anchors: [],
  },
  {
    id: "TC3",
    claim:
      "the eigenstate-order signature: the quasi-energy spectrum is exactly pi-paired — tr F^(2k+1) = 0 for all odd powers, and tr F^(2k) = (-1)^(nk) tr B^(2k) with B = e^{-i H_zz}",
    family: "beat",
    price:
      "odd-power traces <= 2.9e-79 (exact-zero structure surviving floating point), even-power identity worst 3.0e-15 over n=5 x 3 trials x powers 2..6; the pairing follows from G = i^n F = Xbar B satisfying G^2 = B^2 (flip-invariance) — spec(G) = {+-sqrt(beta_j)}, no eigensolver involved",
    exactness: "EXACT",
    witness: "W-A",
    anchors: [],
  },
  {
    id: "TC4",
    claim:
      "rigidity, censused: at equal detuning the interacting chain's subharmonic response stays locked while the isolated qubit's echo dies",
    family: "beat",
    price:
      "DATA, horizon k=20 periods, n=6, J=1.2, fields h in [0.05,0.15]: |m| at k=10 — chain 0.9922 / 0.9654 / 0.8324 vs isolated 0.5414 / 0.4138 / 0.6573 at delta = 0.05 / 0.1 / 0.2; NOT a lifetime theorem (finite horizon, prethermal bounds cited EBN16/KLS16); the hardware-scale certificate is MI22's, cited not re-run",
    exactness: "DATA",
    witness: "W-A",
    anchors: [],
  },
  {
    id: "TC5",
    claim:
      "the clock register, exact layer: the beat keys a one-hot token that advances exactly once per subharmonic period, and the keying leaves the clock untouched — zero back-action on the eigenstate-order orbit",
    family: "clock",
    price:
      "worst |P(token=k after 2k drive periods) - 1| = 1.1e-15 and worst trace-distance(clock reduced, free clock) = 5.6e-16 (n=4; n=5 gives 8.9e-16 / 4.4e-16), 4-gate demo circuit, 4 random superposition inputs per run; the keying fires on the order sector, which the orbit visits wholly — the permutation never splits the clock state",
    exactness: "EXACT",
    witness: "W-B",
    anchors: ["vacuum-compiler"],
  },
  {
    id: "TC6",
    claim:
      "cargo exactness, the T3 semantics beat-driven: conditioned on the token at beat k, the data register equals U_k...U_1 |psi> — fidelity 1 at EVERY tick",
    family: "clock",
    price:
      "worst max-entry deviation 3.3e-16 (n=4) / 1.7e-16 (n=5) between the conditional data state and the directly permuted superposition, over every beat k=1..4 and 4 random inputs; the same law vacuum-compiler certified for the spectral clock, here with the beat as the sequencing resource",
    exactness: "EXACT",
    witness: "W-B",
    anchors: ["vacuum-compiler"],
  },
  {
    id: "TC7",
    claim:
      "the frontier is real: off the orbit (random clock superpositions) the sectors split, the clock entangles with the load, and the advance fidelity drops — the wall B5 was licensed to find",
    family: "backaction",
    price:
      "DATA, census of 3 random clock states x 4 beats (n=4, seed 31): clock-load entanglement up to 1.000 bits, worst advance fidelity 0.421 — the exact layer is an orbit statement, not a generic one, and the census says so with numbers",
    exactness: "DATA",
    witness: "W-B",
    anchors: [],
  },
  {
    id: "TC8",
    claim:
      "phase-read immunity, witnessed: stroboscopic phase flips on the orbit cost nothing — |0...0> and |1...1> are basis states, the phase channel is a global phase",
    family: "backaction",
    price:
      "advance fidelity 1 - 1e-15, clock entropy 0.000, order back-action 0.0000 at q=0.10 per period — the DTC's rigidity doubles as read-protection for the phase channel; boundary: amplitude/depolarizing reads are NOT modeled here — that is the readout wall's face, priced on the route-price P1/P2 schedule this repo quotes in TC14",
    exactness: "EXACT",
    witness: "W-B",
    anchors: ["readout-wall", "route-price"],
  },
  {
    id: "TC9",
    claim:
      "the demonstrated program: a 2x2-bit reversible multiplier (TOFFOLI+CNOT netlist, depth 11, 13 wires) compiled onto the runner — functionally correct on all 16 inputs, integer-exact cargo, and the wrap beat self-resets",
    family: "compile",
    price:
      "wrong outputs 0/16; integer cargo deviation exactly 0 at every beat for every input; wrap returns the data register to its input for all 16 (the runner is a single (T+1)-cycle permutation — an absorbing halt is NOT unitary, batch 36); halt is a READING at the cycle top: the eternal beat computes the same program every cycle",
    exactness: "EXACT",
    witness: "W-C",
    anchors: [],
  },
  {
    id: "TC10",
    claim:
      "the gate set's deeds: FREDKIN conserves Hamming weight on the full basis (conservative logic, machine-checked), the runner permutation is a bijection",
    family: "compile",
    price:
      "weight conservation verified on all 2^6 basis states; runner permutation hits (T+1)2^m distinct targets (Set-size check, the probe that caught the absorbing-halt bug); universality itself is CITED, not re-proven (TC11)",
    exactness: "EXACT",
    witness: "W-C",
    anchors: [],
  },
  {
    id: "TC11",
    claim:
      "universality of {NOT, CNOT, TOFFOLI} for reversible computation, and FREDKIN's conservative-logic universality — the literature layer",
    family: "compile",
    price:
      "BEN73 (logical reversibility, IBM JRD 17:525) and FT82 (conservative logic, IJTP 21:219), both double-sourced in citations.md; the demonstrated depth is 11 gates on 13 wires — the claim is universal SET + demonstrated depth, never 'the DTC computes anything for free'",
    exactness: "CITED",
    witness: "W-C",
    anchors: [],
  },
  {
    id: "TC12",
    claim:
      "the ideal beat costs ZERO NET WORK in-model: along the orbit every strobe is a ZZ eigenstate of the same energy, and the two-point-measurement work distribution of a period is delta(W-0)",
    family: "thermo",
    price:
      "worst |<H_zz>(k) - <H_zz>(0)| = 2.7e-15 over k=0..12 (n=6, J=1.3); TPM escape probability 1.1e-31 — the drive's work is throughput, returned; this is a CLOSED-unitary statement: baths, error correction and the physical dissipation of a real drive are hardware prices, deliberately unquoted (the dossier's power cord, P3 discipline)",
    exactness: "EXACT",
    witness: "W-D",
    anchors: ["route-price"],
  },
  {
    id: "TC13",
    claim:
      "the detuned beat PAYS: the first period has a true closed form, the chain's heating beyond it is suppressed by the same rigidity, and the isolated-qubit echo decay is exact",
    family: "thermo",
    price:
      "E_1 closed form <H_zz>_1 = -J(n-1)cos^2(2 delta): deviation 4.4e-15; W_0 = J(n-1) sin^2(2 delta) = 0.2566 at J=1.3, n=6, delta=0.1; isolated echo |<Z>_k| = |cos 2 delta|^k EXACT; chain drift over 15 periods = 5.7e-2 of the binding energy vs the isolated benchmark 2.6e-1 — suppression 4.5x; NO infinite-time total claimed: the naive (cos^2)^k law was convicted by the scratch run (batch 36 — after one kick the state is a superposition and the ZZ stroke entangles it); prethermal bounds cited (EBN16/KLS16)",
    exactness: "EXACT",
    witness: "W-D",
    anchors: [],
  },
  {
    id: "TC14",
    claim:
      "the tariff table (D1-C4), criterion legislated BEFORE the numbers (L5): per-run erasure obligation in kT ln 2 units at equal error",
    family: "thermo",
    price:
      "DTC-clocked Bennett machine 0 < DTC as-built 5 (five garbage wires) < irreversible Boolean rival 9 (4 input + 5 internal) < FK spectral clock 43.02 QUOTED (vacuum-compiler T4 static mode, (T+1)log2(T+1) at T=11 — the uncertain-readout schedule); deterministic delivery reads a KNOWN outcome and pays 0; joule prices at k = 1.380649e-23 J/K (exact SI 2019): 5 units = 1.4355e-20 J at 300 K, 9 units = 8.6129e-25 J at 10 mK; ln 2 re-derived by midpoint quadrature, deviation 5.0e-15 from the library value",
    exactness: "QUOTED",
    witness: "W-D",
    anchors: ["vacuum-compiler", "route-price"],
  },
  {
    id: "TC15",
    claim:
      "the WO15 tombstone, executed: the nondegenerate ground state and the thermal state are STATIONARY — every local expectation constant along e^{-iHt}; and the only beat a static Hamiltonian offers is a spent two-eigenstate battery at the Bohr frequency",
    family: "tombstone",
    price:
      "n=5 TI chain (J=1, h=0.7), gap 0.1835: ground stationarity worst 3.7e-15, thermal 3.9e-15 over X_i, Z_i, ZZ_i at 11 times; battery amplitude 0.6508 with the Bohr period 2pi/gap exact to 1.4e-15; solver deed V diag V^T = H to 4.8e-14; two independent evolution roads (eigenbasis vs projector sums) agree to 4.4e-16",
    exactness: "EXACT",
    witness: "W-E",
    anchors: [],
  },
  {
    id: "TC16",
    claim:
      "the tombstone's literature layer: WO15 excludes local order-parameter oscillation in ANY ground or thermal state of a local Hamiltonian; ERS17 prices the beat outside equilibrium — a clock spends free energy to tick",
    family: "tombstone",
    price:
      "WO15 (PRL 114:251603) covers the general case our exhibition cannot (degenerate and thermodynamic-limit spectra); ERS17 (PRX 7:031022 — last author Huber, a from-memory citation writes Miller) is the battery's price tag: equilibrium never beats, a spent superposition can, the eternal beat requires the drive — both cited with boundaries, neither re-proven",
    exactness: "CITED",
    witness: "W-E",
    anchors: ["route-price"],
  },
  {
    id: "TC17",
    claim:
      "the certificate (D1-C4/M4), by the legislated criterion: at equal error the DTC-clocked Bennett machine wins the tariff table with 0 units — the clock is OVERHEAD, NOT ENGINE, exactly as the dossier pre-announced",
    family: "certificate",
    price:
      "winner recomputed by fewest-units at every audit: 'DTC-clocked, Bennett-uncomputed (depth 2T+1)'; the zero is the ideal closed model's (drive net work 0 at theta=pi/2, TC12) and every deviation pays — garbage 5, detuning W_0 = J(n-1)sin^2(2delta) (TC13), readout the P1/P2 schedule (TC14), armor maintenance the syndrome meter (TC27, v0.5.0); boundaries honest: hardware instantiation NOT claimed (MI22 holds the hardware cells) — clock-register noise and its majority repair are now modeled at the keying layer (TC25–TC27), hardware fault tolerance remains MI22's wall",
    exactness: "EXACT",
    witness: "W-F",
    anchors: ["bqp-map", "route-price", "vacuum-compiler"],
  },
  {
    id: "TC18",
    claim:
      "the LIFETIME LAW, isolated face (v0.2.0 — the priced next step of TC4): the detuned echo's decay is geometric, |m(k)| = |cos 2δ|^k, so the lifetime to any threshold θ has the closed form τ*(δ, θ) = ln θ / ln|cos 2δ|",
    family: "beat",
    price:
      "closed form === direct simulation at δ = 0.1/0.2/0.3 with θ = 0.5 (τ* = 35/9/4, agreement exact) — the benchmark the chain's protection is measured against",
    exactness: "EXACT",
    witness: "W-H",
    anchors: [],
  },
  {
    id: "TC19",
    claim:
      "the LIFETIME LAW, chain face — and the PROTECTION CLIFF: the interacting chain's echo lifetime exceeds the isolated qubit's by more than two orders of magnitude through δ ≈ 0.3, then COLLAPSES to 1.0× by δ = 0.4",
    family: "beat",
    price:
      "DATA, horizon 1500 strobes at n = 6 (J = 1.2, fields as TC4): δ = 0.1/0.15/0.2 — chain STILL LOCKED at kMax (protection > 42×/94×/167× and growing, lower bounds only); δ = 0.3 — τ*_chain 700 vs τ*_iso 4, protection 175×; δ = 0.4 — τ*_chain 2 = τ*_iso 2, protection 1.0×: the prethermal shield is not smooth, it holds at full strength and then fails — the cliff sits in (0.3, 0.4) at this J; NOT a lifetime theorem in the exponential-prethermal sense (EBN16/KLS16 cited) — the model sees the cliff, the asymptotic law beyond it is cited",
    exactness: "DATA",
    witness: "W-H",
    anchors: [],
  },
  {
    id: "TC20",
    claim:
      "the HEATING TWIN (the priced next step of TC13): the energy account's window drift is FRONT-LOADED — the perturbative first-strobe jump dominates — while the empirical diagonal value climbs toward the infinite-temperature face as δ grows",
    family: "thermo",
    price:
      "DATA, horizon 1500 strobes at n = 6 (J = 1.3, h = 0): τ_heat = 2 at every δ ∈ {0.1, 0.2, 0.4} (the 90%-of-window metric saturates on the perturbative jump — the slow prethermal leakage tail is what this metric cannot resolve, stated as the boundary); the window drift grows 0.419 → 1.623 → 4.388 and the empirical E∞ climbs −6.08 → −4.88 → −2.11 toward the infinite-temperature zero as δ grows — the heating total's δ-face is monotone and steep",
    exactness: "DATA",
    witness: "W-H",
    anchors: [],
  },
  {
    id: "TC21",
    claim:
      "the CLIFF LINE, honestly negative at ED scale (v0.3.0 — the priced next step of TC19): the protection cliff EXISTS at every coupling J probed, but its LOCATION does not track J cleanly at n = 6",
    family: "beat",
    price:
      "DATA, horizon 900 strobes, criterion tau_chain >= 10 x tau_iso, bisection width 7: delta_c = 0.349 / 0.344 / 0.228 / 0.357 at J = 0.6 / 1.2 / 1.8 / 2.4 — scatter (~0.13) exceeds any trend; the prethermal monotone intuition (bigger J, farther cliff) is NOT resolvable at this scale, reported as the negative result it is; priced next: larger n and longer horizons, where the asymptotic law is cited (EBN16/KLS16) not re-proven",
    exactness: "DATA",
    witness: "W-I",
    anchors: [],
  },
  {
    id: "TC22",
    claim:
      "the SELF-SYNCHRONIZING CLOCK (v0.3.0 — the priced boundary of TC8, resolved POSITIVELY): under bit-flip reads on the clock register — the honest wall face the free phase channel was not — the token's advance fidelity is EXACTLY 1 at every beat and every error rate probed",
    family: "backaction",
    price:
      "fidelity 1.000000000000000 (the rounding floor) at q in {0.001 .. 0.2}, every beat of the 4-gate composite at n = 4; the mechanism: a bit flip shifts a branch's sector phase by one strobe, the branch advances early then pauses — any flip history accumulates exactly k advances over 2k strobes, so token(k) is a function of the strobe count alone; the COST is one bit of clock-load entanglement (entropy 0.067 -> 0.98 as q grows), never a misfire — the subharmonic period-2 structure is an error absorber at the keying layer",
    exactness: "EXACT",
    witness: "W-I",
    anchors: [],
  },
  {
    id: "TC23",
    claim:
      "the PAULI WALL, complete: X absorbed (TC22), Z exactly free (TC8), and Y-flip reads — Y0 = i·X0·Z0, the composition — ALSO absorbed at the keying layer: the ENTIRE single-Pauli wall on the clock register leaves the token exactly on schedule",
    family: "backaction",
    price:
      "Y-flip census at n = 4 (mixture form, O((CD)^2)): advance fidelity 1.000000000000000 (the rounding floor) at q = 0.05/0.1/0.2, every beat; the entropy grows (0.86 → 1.00) — the same one-bit entanglement cost as X, never a misfire; the Pauli trinity is closed: X absorbed, Y absorbed, Z free",
    exactness: "EXACT",
    witness: "W-J",
    anchors: [],
  },
  {
    id: "TC24",
    claim:
      "THE HAMMING ARMOR (the real mechanism, and the T1 wall's honest verdict): the orbit states sit at popcount 0 and n — the EXTREME popcounts — so their Hamming distance to the keying boundary (popcount n/2) is floor(n/2), which no single-qubit error can cross; ALL single-qubit noise channels, unitary AND dissipative (including T1 amplitude damping), are absorbed at the keying layer",
    family: "backaction",
    price:
      "T1 census at n = 4 (Kraus pair on bit 0, structured O((CD)^2)): advance fidelity exactly 1 at gamma = 0.001/0.01/0.05/0.1, every beat — the dissipative channel is absorbed just like the unitary ones; the mechanism: |0..0> has popcount 0 (bit 0 already 0, T1 does nothing), |1..1> has popcount n (T1 takes it to n-1, still in the minus sector); the armor's thickness is floor(n/2) — the number of SIMULTANEOUS single-qubit errors needed to cross the keying boundary grows linearly with the clock register's size",
    exactness: "EXACT",
    witness: "W-J",
    anchors: [],
  },
  {
    id: "TC25",
    claim:
      "THE ABSORPTION RADIUS (v0.5.0 — the priced boundary of TC17/TC24's 'error correction unmodeled'): the clock register is the REPETITION CODE [n,1,n] and the keying is its MAJORITY DECODER — X-fire on any FIXED set of at most r = floor((n-1)/2) clock qubits is absorbed at every rate and every history, and the wall stands at |S| = r+1",
    family: "backaction",
    price:
      "exhaustive subset census (every subset, every beat of the 4-gate composite): n=4 all sizes at q=0.5 — |S|<=1 worst fidelity exactly 1.000000000000000, |S|=2 worst 0.3164, |S|=3 worst 0.1295; n=5 all 10 subsets of size r=2 at q=0.5 — exactly 1; the deterministic worst case q=1.0: |S|=r exactly 1, |S|=r+1 exactly 0 (total misfire — the wall is real); full-strength depolarizing p=0.75 (the radius-set qubits fully mixed) at n=4/5: fidelity exactly 1 — the mechanism covers EVERY CPTP channel on the fixed set (each Kraus image of a basis state stays inside the set's popcount band); the cost is bounded: clock entropy saturates at exactly |S| bits (1.000/2.000 bits witnessed), never grows; r = floor((d-1)/2) at distance d = n is HAM50's classical correction-radius law holding for a quantum clock register; n=6/7 radii extend through the classical shadow (TC26), whose equivalence is machine-checked at n=4/5",
    exactness: "EXACT",
    witness: "W-K",
    anchors: [],
  },
  {
    id: "TC26",
    claim:
      "THE CLASSICAL SHADOW (the erosion law's engine): under delocalized X-fire (each clock qubit flips independently, prob p per period) the token process is EXACTLY classical — a functional of the popcount walk of the accumulated mask — and the armor erodes AND PARTIALLY SELF-HEALS: the fidelity sits strictly above strict sector survival, because a full-period excursion into the inverted sector refunds its even-strobe miss with an odd-strobe advance",
    family: "backaction",
    price:
      "worst |DP - quantum| 7.8e-16 over n=4 x p in {0.01,0.05,0.1,0.2} and n=5 x p=0.1, every beat — the dense (CD)^2 census and the (popcount, drift) dynamic program are the same numbers at the rounding floor; the fire rule is parity-quantized (period t fires iff (t even AND w < n/2) OR (t odd AND w > n/2)), so inverted-sector dwell is refunded: at n=4, horizon 8 periods — p=0.05 fidelity 0.691 vs strict survival 0.619; p=0.2 fidelity 0.176 vs survival 0.048 (3.7x refund); the clock marginal stays diagonal at every strobe (its entropy is the mask distribution's Shannon entropy); the walk is the Bernoulli-flip walk on the n-cube lumped to popcount (KAC47's lineage); larger n censused through the shadow: F(64 periods) at p=0.1 — n=6 2.71e-4, n=7 0.219, n=8 7.13e-4 (the odd/even drift structure persists at scale)",
    exactness: "EXACT",
    witness: "W-K",
    anchors: [],
  },
  {
    id: "TC27",
    claim:
      "THE REPAIR (the epoch's priced wall, executed): majority decoding at the clock layer — a 1-bit sector read at each period top plus a conditional global flip (unitary) — restores the armor EXACTLY at odd n, where the decoder can never tie: repaired fidelity EXACTLY 1 under sustained delocalized fire; the maintenance is metered (the B4 row); at even n the tie dead zone is the decoder's honest boundary, where the machine convicted the expectation that repair always helps",
    family: "thermo",
    price:
      "n=5, p in {0.05, 0.1, 0.2}: repaired advance fidelity 1.000000000000000 (the rounding floor) at EVERY beat, against the passive twin's 0.9172/0.7427/0.5035 — the majority decoder cannot tie at odd n, so every keying fires on schedule, forever in-model; the tariff: mean syndrome entropy 0.1707/0.4253/0.7380 bits per period (0 in the noiseless ideal — a deterministic read pays 0, TC14's criterion), the conditional flip itself unitary and free; at n=4 the tie set {popcount = 2} passes through unrepaired: repaired 0.4423 vs passive 0.3953 at p=0.1 over the program, and at LONG horizons the passive refund beats the decoder outright — n=6, p=0.2, 64 periods: repaired 1.66e-5 vs passive 1.74e-4, 10x WORSE (the decoder pins the walk at the tie where misses accrue unrecovered) — the numbers overruled the expectation, reported as found; boundary: the repair is a projective sector read + conditional unitary (cross-sector dephasing is the read's cost); no fault-tolerant machinery claimed — that wall belongs to the hardware epoch (MI22)",
    exactness: "EXACT",
    witness: "W-K",
    anchors: [],
  },
];
