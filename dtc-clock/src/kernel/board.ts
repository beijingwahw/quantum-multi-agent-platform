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
      "the detuned beat PAYS: the first period has a true closed form, the chain's heating beyond it is suppressed by the same rigidity, and the dephased isolated benchmark is exact",
    family: "thermo",
    price:
      "E_1 closed form <H_zz>_1 = -J(n-1)cos^2(2 delta): deviation 4.4e-15; W_0 = J(n-1) sin^2(2 delta) = 0.2566 at J=1.3, n=6, delta=0.1; isolated benchmark 1 - (cos 2 delta)^kMax — the DEPHASED drive's exact expected echo loss (v0.20.0/TC46: the v0.2.0 reading, a COHERENT isolated decay |<Z>_k| = |cos 2 delta|^k, was verified tautologically and is FALSE — the coherent isolated qubit is the quasi-periodic rotor); chain drift over 15 periods = 5.7e-2 of the binding energy vs the dephased benchmark 2.6e-1 — suppression 4.5x; NO infinite-time total claimed: the naive (cos^2)^k law was convicted by the scratch run (batch 36 — after one kick the state is a superposition and the ZZ stroke entangles it); prethermal bounds cited (EBN16/KLS16)",
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
      "the LIFETIME BENCHMARK, restated at v0.20.0 (route-price v0.2.0's cross-check convicted the original verification as TAUTOLOGICAL — the 'direct simulation' iterated the formula itself): under per-period sign noise eps_j = ±delta the expected echo decays geometrically — E[m~(k)] = (cos 2 delta)^k exactly — so the benchmark lifetime tau*(delta, theta) = ln theta / ln|cos 2 delta| is the EXPECTED echo's crossing; the coherent isolated qubit does NOT decay (m(k) = (-1)^k cos 2k delta, the detuned rotor — YAO17's beating), its threshold crossings are recurrences, not lifetimes",
    family: "beat",
    price:
      "the v0.2.0 witness (tau* = 35/9/4 at delta = 0.1/0.2/0.3, 'agreement exact') was formula-times-itself in the test, the witness W-H and scratch-life.ts — it certifies ANY constant handed to it (reproduced and rejected, TC46's negative control); the dephased law now verified by an INDEPENDENT path: exhaustive over ALL 2^k sign sequences through the kernel at k = 8/12 (deviation <= 3.6e-15) and Monte Carlo at N = 40000 within 1.3 sigma at (delta,k) = (0.2,9)/(0.1,35); the tau* crossing margins: E[m~] = 0.5161 above / 0.4733 below at k = 8/9 (delta = 0.2), 0.5604/0.4627 at k = 3/4 (delta = 0.3); the chain's protection factors (TC19) are UNCHANGED — the benchmark's MEANING is",
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
  {
    id: "TC28",
    claim:
      "THE TIE RESET (v0.6.0 — the priced next step of TC27, the even-n cure): the majority decoder's blind spot — the tie set {popcount = n/2}, a fixed point of the global flip — is cleared by an EXACT-POLE reset on the tie branch, whose erasure is EXACTLY log2 C(n, n/2) bits by exchangeability (the delocalized noise is iid per qubit, so the mask conditioned on the tie is uniform over the C(n, n/2) tie states); with the reset the repaired token fidelity is EXACTLY 1 at EVERY n — the v0.5.0 even-n long-horizon liability is cured outright, and the odd/even dichotomy survives only as a PRICE dichotomy, metered",
    family: "thermo",
    price:
      "full-repair census (sector repair + tie reset): n=4 p=0.1/0.2 — worst fidelity 1.000000000000001 (the rounding floor) against passive twins 0.3953/0.1762; n=6 p=0.1 — 1.000000000000000 against 0.4891; the long-horizon cure: n=6, p=0.2, 64 periods — sector-only repair 1.66e-5 (the v0.5.0 liability), FULL repair 1.000000000000023; n=8 the same (8.14e-4 passive / 7.71e-5 sector-only / 1.000000000000030 full); the DP twin agrees to 1.3e-15 INCLUDING both meters (tie meter 0.8151/1.3586 bits per period at n=4 p=0.1/0.2, identical on both roads); the erasure constants log2 C(n,n/2) = 2.585/4.322/6.129 bits at n=4/6/8 — asymptotically the whole register (n - O(log n)): each tie erases WHICH of C(n,n/2) states the clock was in; at odd n the tie set is empty — the reset is a no-op (tariff 0, meter 0.000000), the v0.5.0 odd-n repair unchanged; boundary: the reset is a projective tie read + conditional pole preparation (erasure) — the B4 maintenance row carries the amortized price, and the Landauer account is exact, not asymptotic",
    exactness: "EXACT",
    witness: "W-L",
    anchors: [],
  },
  {
    id: "TC29",
    claim:
      "THE BINOMIAL SHADOW LAW (v0.7.0 — the priced next step of TC28: the analytic faces of the passive shadow): under delocalized X-fire each clock bit's flip history is independent of every other's, so the passive mask popcount is EXACTLY binomial — w_t ~ Bin(n, q_t) with q_t = (1-(1-2p)^t)/2 — and every passive face closes: the tie occupancy, the per-strobe breach tail, and the stationary faces 1/2 + C(n,n/2)/2^{n+1} and C(n,n/2)/2^n",
    family: "backaction",
    price:
      "worst |machine marginal - Bin(n,q_t)| = 2.0e-15 over n in {4,6,8} x p in {0.05,0.1,0.2} x t in {5..16}; the stationary faces exact to 6.1e-14 at n=4..10: breach 0.6875/0.65625/0.63672/0.62305 = 1/2 + C(n,n/2)/2^{n+1}, tie = C(n,n/2)/2^n; the naive relaxation q'_t = 1-(1-p)^t (flips treated as absorbing) is WRONG by 3.2e-1 at n=6 p=0.2 t=8 — the identity is contentful and the negative control convicts it; the closed tie face P(w_t = n/2) = C(n,n/2)(q_t(1-q_t))^{n/2} peaks at q_t = 1/2 (t -> inf at rate 1-2p); boundary: these are the PASSIVE chain's faces — the repaired chain's meters (TC28) stay machine-exact via the DP, the repair resets the walk and no binomial law survives it",
    exactness: "EXACT",
    witness: "W-M",
    anchors: [],
  },
  {
    id: "TC30",
    claim:
      "THE SHADOW CENSUS AT SCALE (the second priced item): the erosion and repair faces at n = 10/12/16 — beyond any honest dense-census horizon — through the machine-validated shadow; the full repair stays EXACTLY 1 at every scale, and the tie tariff's stationary face grows toward the whole register",
    family: "backaction",
    price:
      "DATA through the shadow, 64 periods at p=0.2 (its equivalence to the quantum census is TC26's, machine-checked at n=4/5): n=10/12/16 — passive F(64) = 2.18e-3 / 4.27e-3 / 1.01e-2 (the passive fidelity RISES with n: more room for the refund structure to balance the drift), full-repair F(64) = 1.000000000000039 / 046 / 059 (exactly 1 at every scale probed), tie meters 1.887 / 2.028 / 2.290 bits/period, erasure constants log2C = 7.977 / 9.852 / 13.652 bits, stationary faces tie C/2^n = 0.2461 / 0.2256 / 0.1964 and breach 1/2+C/2^{n+1} = 0.6230 / 0.6128 / 0.5982 (exact to 6.1e-14) — the passive clock's long-time wrong-sector occupancy, the erosion's endgame quantified",
    exactness: "DATA",
    witness: "W-M",
    anchors: [],
  },
  {
    id: "TC31",
    claim:
      "THE SPECTRAL SURVIVAL LAW (v0.8.0 — the priced next step of TC29/TC30: the first-passage face): the strict armor's survival P(w_s < n/2 for all s <= T) is the absorbing-chain problem of the substochastic Q on {0..n/2-1}; Q is reversible (m_i Q_ij = m_j Q_ji, m_w = C(n,w), to the rounding floor — the hypercube flip chain is uniform-reversible and the popcount lumping is equitable), hence similar to a symmetric matrix, and the survival series is the EXACT eigen-expansion sum_j c_j lambda_j^T — with lambda_1 the armor's DECAY CONSTANT: survival(T+1)/survival(T) -> lambda_1",
    family: "backaction",
    price:
      "the eigen-expansion reconstructs the absorbing-chain survival to 2.0e-15 over n in {4,6} x p in {0.1,0.2} x T<=40, and the absorbing chain itself matches the house DP survival to 5.6e-17; the ratio convergence is exact to 12 decimals (n=6 p=0.2 at T=60: 0.666844641587 = lambda_1); the decay-constant grid — p=0.05: 0.90369/0.90456/0.90526/0.90585/0.90637/0.90724 at n=4/6/8/10/12/16; p=0.1: 0.81456/0.81774/0.82021/0.82223/0.82392/0.82664; p=0.2: 0.65637/0.66684/0.67433/0.68000/0.68447/0.69109 — lambda_1 RISES slowly with n at fixed p (a bigger register decays marginally slower) and falls steeply in p; the half-life is ln 2 / -ln lambda_1 periods; derivation boundary: four convention slips in the first draft (the symmetrization ratio inverted, the solver's dimension argument squared, the pack fed a plain array, the coefficient's D-sides swapped) were each caught by the scratch harness's numeric probes BEFORE landing — the machine-first law is the derivation's review",
    exactness: "EXACT",
    witness: "W-N",
    anchors: [],
  },
  {
    id: "TC32",
    claim:
      "THE STATIONARY REPAIR (the repaired chain's limit faces): the repaired chain's per-period meters converge to the stationary value of the small repaired chain — p_tie at stationarity, the syndrome meter averaged over the two top parities, and the tie tariff H2(p_tie^inf) + p_tie^inf * log2C — closing the TC28/TC29 dichotomy: the passive faces are binomial (TC29), the repaired faces are stationary-linear-algebra",
    family: "thermo",
    price:
      "n=6 p=0.2: stationary p_tie 0.201389, syndrome meter 0.602526, tie meter 1.595083 (constant log2C(6,3) = 4.3219); the DP's 400-period MEAN is 1.592612 — it lags BELOW the stationary value through the transient (the early periods start at w=0 and are cheaper), the per-period meter converging from below — stated, not hidden; boundary: the stationary faces are the LIMIT objects, the DP mean over any finite horizon is transient-contaminated and the two must not be conflated",
    exactness: "EXACT",
    witness: "W-N",
    anchors: [],
  },
  {
    id: "TC33",
    claim:
      "THE UNIVERSAL DECAY RATE (v0.9.0 — the priced next step of TC31: the perturbative face): the armor's decay-rate constant is gamma = 2 EXACTLY, for EVERY n — u_w = n-2w is a positive eigenvector of the amputated Ehrenfest birth-death generator (birth n-w, death w, the top row's birth amputated into the absorbing set) with eigenvalue exactly n-2 at every row including both boundaries, and Perron-Frobenius makes it the top — so lambda_1(p) = 1 - 2p + O(p^2) is n-INDEPENDENT to first order: the strict armor's small-fire half-life is ln2/(2p) + O(p) periods regardless of register size",
    family: "backaction",
    price:
      "gamma = 2.000000000 at every n in {4,6,8,10,12,16,20,24,32,40} (the house Jacobi through the binomial-reversible symmetrization); the algebraic eigenpair residual |Bu - (n-2)u| is 0.00e+0 by the solver-free closed-form check (interior rows: (n-w)(n-2w-2) + w(n-2w+2) = (n-2)(n-2w); the amputated top row r = n/2-1: r(n-2(r-1)) = 4r = 2(n-2) = (n-2)(n-2r)); the fit face: (1-lambda_1(p))/p at n=6 is 1.962903/1.981351/1.990650/1.995319 at p = 0.02/0.01/0.005/0.0025 — the residual to gamma halves exactly with p (clean O(p)), same at n=10 (1.951744 -> 1.993863, residual ratio 2.00); the n-dependence of the TC31 grid (0.656 -> 0.691 at p=0.2) is entirely the O(p^2) face — the fitted second coefficient grows with n (-1.87 at n=6, -2.45 at n=10, fitted, labeled DATA); the mechanism: at small fire the walk leaves w=0 rarely, and the decay is governed by the drift-and-killing balance of the one-flip generator — universal, size-blind",
    exactness: "EXACT",
    witness: "W-O",
    anchors: [],
  },
  {
    id: "TC34",
    claim:
      "THE KRAWTCHOUK SPECTRUM (v0.10.0 — the priced next step of TC33: the amputated generator's FULL spectrum, closed form): the amputation is a Dirichlet boundary at the tie plane w = n/2, and the ODD Krawtchouk modes are antisymmetric under the reflection w <-> n-w — they vanish at the tie plane exactly, so they survive the amputation INTACT with their full-chain eigenvalues: spectrum(B) = {n-2, n-6, n-10, ...} — INTEGERS, an arithmetic progression with common difference EXACTLY 4; TC33's gamma = 2 is the k = 1 member, and the adjacent-mode gap of exactly 4 is the ratio test's convergence constant",
    family: "backaction",
    price:
      "the solver-free eigenpair residual max_w |B K_j - (n-2j) K_j| is the rounding floor for every odd j at n = 6..24 (Krawtchouk vectors by the three-term recurrence); the house Jacobi spectrum matches the integer list to 1e-9 at n = 6/8/10/12 (n=6: [4, 0, -4]; n=8: [6, 2, -2, -6]; n=12: [10, 6, 2, -2, -6, -10]); the even modes do NOT survive (negative control: K_2 fails the amputated eigen-residual outright); the mechanism is the reflection antisymmetry — K_j(n/2) = 0 for odd j, the tie plane is the reflection's fixed set, and Dirichlet there selects exactly the odd family",
    exactness: "EXACT",
    witness: "W-P",
    anchors: [],
  },
  {
    id: "TC35",
    claim:
      "THE SECOND-ORDER FACE (the other priced item): c_2(n) = lim_{p->0} (2 - (1-lambda_1(p))/p)/p, evaluated by Richardson extrapolation on the EXACT eigenvalue — rational-valued in the limit (3/2, 15/8, 35/16, 315/128 at n = 4/6/8/10, seven digits), and the register's size enters the decay law only here",
    family: "backaction",
    price:
      "census: the Richardson grid n = 4..24 at p = 0.01/0.005, each point an exact Jacobi eigen-solve (horizon: two p-points per n, O(p^2) extrapolation); the Richardson values c_2(n) = 1.500003/1.875003/2.187500/2.460929/2.707011/3.142029/3.523816/3.868107 at n = 4/6/8/10/12/16/20/24 (the raw single-point values lag by O(p), the two-point Richardson extrapolation is exact to O(p^2)); the observed scaling c_2/n * sqrt(n) ~ 0.785 ~ pi/4 across the grid is labeled OBSERVED and NOT claimed — a scaling coincidence on eight points is numerology until derived; boundary: c_2's closed form as a finite Rayleigh-Schrodinger sum over the odd Krawtchouk modes (denominators exactly 4(k-1) by TC34) is priced as the next step, not claimed here",
    exactness: "DATA",
    witness: "W-P",
    anchors: [],
  },
  {
    id: "TC36",
    claim:
      "THE RAYLEIGH-SCHRODINGER CLOSED FORM FOR c_2 (v0.11.0 — the priced next step of TC35): the second-order decay coefficient is a SINGLE repulsion-free Rayleigh quotient — c_2(n) = u^T D Q^(2) u / u^T D u with u_w = n-2w and D = diag(C(n,w)) — because the level-repulsion term vanishes identically (A_1 is diagonal in its own Krawtchouk eigenbasis, TC34's gift), and Q^(2) is the EXACT p^2 coefficient of the absorbing block (the flip counts TIMES the binomial expansion of the (1-p)^{n-a-b} factor: two-flip counts minus (n-1) times the one-flip counts plus C(n,2) on the diagonal, Dirichlet-truncated)",
    family: "backaction",
    price:
      "the quotient matches the Richardson extrapolation to ITS tolerance at every n in {4,6,8,10,12,16,20,24}: 1.500000000000 / 1.875000000000 / 2.187500000000 / 2.460937500000 / 2.707031250000 / 3.142089843750 / 3.523941040039 / 3.868326187134 (the quotient is the exact value; Richardson carries the O(p^2) extrapolation error, 3e-6 to 2e-4); the values are rational — 3/2, 15/8, 35/16, 315/128, 693/256 at n = 4/6/8/10/12 (continued-fraction reconstruction at the floating floor); derivation boundary: the first two drafts were convicted by the scratch harness's Richardson cross-check (a double-counted C(n-w,2); the missing -(n-1) and C(n,2) terms from the (1-p) expansion) — the cross-check is the derivation's firing range; the general-n pattern of the rationals (numerators C(n,n/2) x {1/2, 3/4, 5/4}-ish, no clean law identified) is left UNCLAIMED — priced, not asserted",
    exactness: "EXACT",
    witness: "W-Q",
    anchors: [],
  },
  {
    id: "TC37",
    claim:
      "THE GENERAL-n LAW FOR c_2 (v0.12.0 — the priced next step of TC36): c_2(n) = (n-1) C(n-2, (n-2)/2) / 2^(n-2) for even n >= 4 — with m = (n-2)/2 this is the CENTRAL-BINOMIAL PARTIAL SUM (2m+1) C(2m,m) / 4^m = sum_{k=0}^{m} C(2k,k)/4^k (each term the simple symmetric walk's return probability P(S_2k = 0): the armor's second-order decay coefficient IS the walk's cumulative return count), the identity carried by the integer-exact induction step 2(m+1) C(2m+2, m+1) = 4(2m+1) C(2m, m)",
    family: "backaction",
    price:
      "BigInt cross-multiplied residue against TC36's RS quotient: ZERO at every n = 4..40 (worst |0|); the partial-sum identity's induction-step residue ZERO at every m = 1..19, full-sum residue ZERO; the float kernel agrees at 0.00e+0 (n = 4..40); asymptotic c_2(n) = sqrt(2n/pi) (1 - 1/(4n) + 1/(32n^2) + O(n^-3)): the scaled ratio r = c_2 sqrt(pi/2n) rises MONOTONICALLY to 1 (census n = 4..200), n(1-r) -> 1/4 (0.2401 at n=4, 0.2498 at n=200), the second face 32n^2 (r - 1 + 1/(4n)) -> 1 (1.27 -> 1.006) — machine-fitted, DATA, horizon n = 200; THE pi/4 SCALING OF TC35 IS RETIRED: c_2/sqrt(n) -> sqrt(2/pi) = 0.797884561, not pi/4 = 0.785398163 — the census curve crosses pi/4 near n = 16, INSIDE TC35's grid (the observation was honest at its horizon and is corrected by the law); negative controls: the off-by-shift sibling (n+1) C(n, n/2) / 2^n and the one-power-off denominator 2^(n-1) both convicted at every probe n = 4..12 (nonzero exact residues)",
    exactness: "EXACT",
    witness: "W-R",
    anchors: [],
  },
  {
    id: "TC38",
    claim:
      "THE THIRD-ORDER COEFFICIENT c_3 (v0.13.0 — the priced next step of the c_2 arc): lambda_1(p) = 1 - 2p + c_2 p^2 + c_3 p^3 + O(p^4) with c_3(n) an exact two-face rational — the plain quotient <u, Q_3 u>/<u,u> PLUS the FIRST NON-VANISHING LEVEL-REPULSION FACE: sum over the odd Krawtchouk modes j = 3, 5, ... of <K_j, Q_2 u>^2 / (2(j-1) <K_j,K_j> <u,u>) — TC36's repulsion-free gift ends at second order; from c_3 on the WHOLE odd-Krawtchouk spectrum (TC34's edifice) participates in the decay law, with mode gaps exactly 2(j-1)",
    family: "backaction",
    price:
      "Q_3 is the exact p^3 coefficient (three-flip counts -(n-2) two-flip + C(n-1,2) one-flip - C(n,3) diagonal, every (1-p) factor expanded, Dirichlet-truncated); all pieces integer, the total an exact BigInt rational; the three-term series reproduces lambda_1(1/100) to 6.3e-10 / 6.2e-10 / 8.6e-11 / 1.6e-9 / 3.9e-9 / 1.2e-8 at n = 4/6/8/10/12/16 (the c_4 p^4 face — the decisive witness); Richardson on the exact eigenvalue agrees within ITS contamination at every n (-0.437484 vs -0.437500, -1.005838 vs -1.005859, -1.669147 vs -1.669108, -2.411106 vs -2.410870, -3.221816 vs -3.221165, -5.023943 vs -5.021436); the rationals -7/16 and -515/512 at n = 4/6; the repulsion face is NONZERO at every n >= 4 (0.5625 at n=4 — the K_3 mode lives even on the two-point block), convicting the 'gift continues' hypothesis; negative control: the quotient-only value misses the series by exactly the repulsion face; derivation boundary: the first TWO scratch drafts were convicted by the numeric arbiter (the repulsion summed over even j — not eigenmodes of the block; the normalization read <u,u> for <K_j,K_j>; the sign flipped; the final <u,u> division dropped) and one intermediate hand check mis-multiplied 6*4*20 as 2400 — every convention slip caught at the scratch stage, none reached the machine; the general-n pattern of the rationals is observed, NOT claimed (priced)",
    exactness: "EXACT",
    witness: "W-S",
    anchors: [],
  },
  {
    id: "TC39",
    claim:
      "THE QUOTIENT-FACE LAW (v0.14.0 — TC38's priced general-n next step, executed for the face that closes): u is a JOINT Rayleigh vector of the second and third orders — 3<u, Q_3 u> + (n-2)<u, Q_2 u> = 0 exactly for every even n >= 4, so c_3's quotient face inherits TC37's law verbatim: q(n) = -(n-2)/3 · c_2(n) = -(n-1)(n-2)·C(n-2,(n-2)/2)/(3·2^(n-2)); and the cancellation face is DATA with a refutation: the naive 2/3-share hypothesis dies on the grid",
    family: "backaction",
    price:
      "the identity residue 3<u,Q_3 u> + (n-2)<u,Q_2 u> is EXACTLY ZERO for all even n = 4..60 (integer arithmetic on the cheap path — no Krawtchouk vectors — spot -1/1, -5/2, -35/8, -105/16, -1155/128, -3003/256 matching -(n-2)c_2/3 reduced); the cancellation census (exact rationals, horizon n = 30 where the repulsion sum's BigInt cost caps): the deficit c_3 + (n-2)c_2/9 is negative through n=18 (-1.04e-1..-6.71e-2) and positive from n=20 (+1.58e-2 rising to +6.48e-1) — the repulsion share 9r/(2(n-2)c_2) CROSSES 1 between n=18 and n=20 and keeps rising (0.8438, 0.9277, 0.9645, 0.9943, 1.0011, 1.0120, 1.0165, 1.0205, 1.0240 at n=4..30): the 2/3-share hypothesis is REFUTED — the faces' asymptotic split is not identified on the grid and stays open (re-priced); the combined c_3 is a small difference of large terms (at n=20: r = 14.114 vs |q| = 21.145, c_3 = -7.032) — the general-n pattern of the combined rational remains observed, NOT claimed",
    exactness: "EXACT",
    witness: "W-T",
    anchors: [],
  },
  {
    id: "TC40",
    claim:
      "THE COUPLING CLOSED FORMS (v0.15.0 — TC39's re-priced inter-face split, executed): the repulsion face collapses to pure binomials — the truncated Krawtchouk norms equal the classical full norms (vv = C(n,j)·2^(n-1)), u's norm joins the family (uu = n·2^(n-1)), and the coupling is proportional to c_2's central binomial (|cpl(n,j)| = 2n(n-1)·C(n-2,m)·C(dim-1,(j-1)/2)) — and the closed form pushes the share's horizon from n=30 to n=1024, where it extrapolates to 9/8",
    family: "backaction",
    price:
      "zero-residue verification of all three forms over n = 4..36, every odd mode j (the closed addend reproduces the kernel's exact repulsion face at the spot checks); the horizon push by pure substitution (no matrices, no BigInt products): the share 9r/(2(n-2)c2) is monotone past its n=18..20 crossing and rises to 1.1078 at n=1024 with per-doubling increments shrinking by 2^(-1/2) — an a/sqrt(n) extrapolation lands at 0.125000 stably across five decades (n=24..1024): the limit is IDENTIFIED AS 9/8 by extrapolation, NOT claimed as a theorem — if it holds, r -> (n-2)c_2/4 and c_3 -> -(n-2)c_2/12; the proof is the Gaussian asymptotics of the k-sum C(dim-1,k)^2/C(n,2k+1), re-priced; derivation boundary: the horizon push uses log-space floats (spot-checked against the exact BigInt rationals at n=6/24 to all digits)",
    exactness: "EXACT",
    witness: "W-U",
    anchors: [],
  },
  {
    id: "TC41",
    claim:
      "THE 9/8 LIMIT, ASSEMBLED (v0.16.0 — TC40's re-priced Gaussian asymptotics, executed to theorem grade): the mode ratio factors EXACTLY into central binomials — C(dim-1,k)^2/C(n,2k+1) = [(dim-1)!^2/(2dim)!]·(2k+1)C(2k,k)·(2j+1)C(2j,j), j = dim-1-k — and with the classical central-binomial asymptotic the share assembles to share(n) = 9/8 - a/sqrt(n) + O(1/n) with a converging to 0.55091",
    family: "backaction",
    price:
      "the factorization holds with ZERO BigInt residue over n = 4..30, every k (the share reduces to central binomials ONLY — the assembly's every step is either this exact identity or the cited classical C(2t,t) ~ 4^t/sqrt(pi t)); the machine arbitrates: the share is monotone increasing on the full grid with per-doubling increments shrinking geometrically (ratio ~0.70 = 2^(-1/2)), so the limit EXISTS and is bracketed by the geometric tail bound at n=2048 — 9/8 sits inside the bracket to four digits; the first correction a(n) = (9/8 - share(n))·sqrt(n) converges to 0.55091 (stable to five digits over n = 256..2048: 0.551133, 0.550939, 0.550907); if the limit holds: r -> (n-2)c_2/4 and c_3 -> -(n-2)c_2/12 (the decay-law arc's third-order face closed); boundary honest: the a-constant's closed form is identified by convergence, not derived — the O(1/n) control is machine-witnessed on the grid, the uniform-remainder proof on all of k-space remains the cited-classical residue",
    exactness: "EXACT",
    witness: "W-V",
    anchors: [],
  },
  {
    id: "TC42",
    claim:
      "THE ARCSINE LAW and the correction constant's STRUCTURE (v0.17.0 — TC41's priced a-closed-form, executed to the structure): the share satisfies the exact chain identity share = P(n)·A(n)·S(n)/4, and S's k-profile is the ARCSINE density — S·sqrt(dim)·sqrt(pi) -> pi/2 (the Beta(1/2,3/2) integral) — independently reproducing the 9/8 limit; the correction constant a = 0.5508694(2) is NOT a one-term combination of the natural basis (refuted at seven digits), because the arcsine profile's x^(-1/2) endpoint singularities feed the 1/sqrt(dim) correction through singular Euler-Maclaurin (zeta-flavored) constants",
    family: "backaction",
    price:
      "the chain identity holds EXACTLY (float spot equality at every grid n, algebraic in the TC40 closed forms); the arcsine law: S·sqrt(dim)·sqrt(pi) = 1.544113, 1.558112, 1.564620, 1.567750 at dim = 512..32768, Richardson-extrapolating to pi/2 = 1.570796 — and pi/2 pushed through the chain reproduces share -> 9/8 exactly (the independent confirmation of TC41's bracket); a's two-term accelerated convergence: a(n) = a + b/n + O(n^-2) with b = 0.0664 (successive-difference ratio 2.03) and a = 0.5508694(2); the one-term refutation: a/sqrt(2/pi) = 0.690412(3), a/sqrt(pi/2) = 0.439530(2), a·sqrt(pi) = 0.976067(4) — none within 3e-3 of a rational with small denominator at seven digits; the structural explanation: the arcsine profile int sqrt((1-x)/x) dx has x^(-1/2) endpoint singularities whose discrete-sum corrections are NOT captured by regular Euler-Maclaurin — they feed the 1/sqrt(dim) term with zeta-flavored constants, which is why a is not elementary; boundary honest: a's full closed form = the singular Euler-Maclaurin constants of the arcsine profile, priced as the arc's next step",
    exactness: "EXACT",
    witness: "W-W",
    anchors: [],
  },
  {
    id: "TC43",
    claim:
      "THE CORRECTION CONSTANT PINNED (v0.18.0 — TC42's priced a-closed-form, executed to the machine ceiling): a = 0.550874786 identified to TEN digits via sigma1 = -0.4896664762 (a = -(9/8)sigma1, Richardson over n <= 2^18 with 1/n corrections), every one-term closed candidate REFUTED at that precision, and the endpoint mass pinned by an EXACT fixed-k edge law — the last assembly step (the singular Euler-Maclaurin coefficient of the true profile) precisely delineated and priced",
    family: "backaction",
    price:
      "sigma1(n) = (share/(9/8) - 1)·sqrt(n) converges as sigma1 + O(1/n): -0.489680660, -0.489669903, -0.489667448, -0.489666728 at n = 4096..262144, Richardson to -0.4896664762 — so a = 0.550874786 (ten digits, consistent with TC42's five); the one-term refutations at ten digits: sigma1·sqrt(pi)/zeta(1/2) = 0.59431544 (no small rational), sigma1/zeta(1/2) = 0.33530658, sigma1·sqrt(pi) = -0.86791123 — none lands on the zeta-lattice, and the two-element scan (alpha + beta·zeta(1/2)) finds no small pair; the EXACT edge law: summand(n,k)·dim -> (2k+1)C(2k,k)/(2·4^k·k) for fixed k (machine-verified convergent at k = 1..4 over the grid) — the endpoint mass the singular Euler-Maclaurin must regularize, each coefficient an exact rational multiple of C(2k,k)/4^k; boundary honest: the final assembly — the exact singular-EM coefficient of the true profile sqrt((1-x)/x)/sqrt(pi) with its discrete 1/k weighting — is delineated to this one step and priced; a's numeric value is machine-settled at ten digits",
    exactness: "EXACT",
    witness: "W-X",
    anchors: [],
  },
  {
    id: "TC44",
    claim:
      "THE EXACT TRANSFER AND THE S-FACE ROAD (v0.19.0 — the assembly, part one): sigma1(n) = G(n)·u(D) - sqrt(n) is an ALGEBRAIC IDENTITY in the chain pieces (G = (2·sqrt(2)/9)·P·A, u = S·sqrt(D), D = n/2) — machine residual at the float floor (2.3e-11 worst on the grid) — so the limit identity sigma1 = 2·sqrt(2/pi)·kappa transfers the ten-digit sigma1 to the S-face constant kappa = -0.3068529603 EXACTLY (v0.20.0 re-render; v0.19.0 printed -0.3068529590), and the arc's third-order face closes at theorem grade: c3(n) = -(n-2)·c2(n)/12·(1 - 3·sigma1/sqrt(n) + O(1/n)), the closure face verified against the exact c3 on its rational domain",
    family: "backaction",
    price:
      "the transfer identity is exact per-point (float floor); kappa's own D-grid Richardson confirms to 4.7e-5 (slow mixed-order convergence — the transfer is the precise route, the grid is the road's independent witness); the third-order closure: c3(n) + (n-2)c2/12·(1 - 3·sigma1/sqrt(n)) relative deviation 1.9e-3 at n=16 and declining as O(1/sqrt(n)) on the exact-rational domain (n=4..16) — the IF of TC41 (c3 -> -(n-2)c2/12) now ships as a theorem with its full 1/sqrt(n) correction face and the named machine constant sigma1 = -0.4896664762; boundary honest: kappa's D-grid road converges slowly (log-free mixed faces), the transfer carries the precision",
    exactness: "EXACT",
    witness: "W-Y",
    anchors: [],
  },
  {
    id: "TC45",
    claim:
      "THE SINGULAR EULER-MACLAURIN ASSEMBLY (v0.19.0 — the assembly, part two, machine-arbitrated; CORRECTED at v0.20.0): kappa = zeta_m + Phi1 — the constant DECOMPOSES additively into the edge-mass series' generalized-zeta constant zeta_m = sum_{k>=1}(m_k - mu_k) - sqrt(2/pi) plus the cutoff face's constant Phi1; the v0.19.0 reading 'Phi1 = -4.547e-4 SMALL BUT NONZERO' was zetaEM's SIGN ERROR wearing a physical story — with the tail fixed (TC47) the certified bracket is |Phi1| <= 5.6e-7 WITH ZERO INSIDE, and whatever sub-bracket residue survives is the F-function's own singular face",
    family: "backaction",
    price:
      "the exact per-k terms: m_k = (2k+1)C(2k,k)/(2·4^k·k) exact rationals (incremental recurrence spot-checked bitwise-converted at k=1..200), mu_k the midpoint masses; the next-order laws EXACT: E_k·sqrt(pi)·k^{3/2} -> 3/8 (Richardson 0.37500000) and (E·sqrt(pi)k^{3/2} - 3/8)·k -> -11/128 (hand-derived from the central-binomial expansion and the midpoint Taylor: (1+1/2k)(1-1/8k+1/128k^2) - (1+1/32k^2) = 3/8k - 11/128k^2); the accelerated series sum(E) = (3/8)zeta(3/2)/sqrt(pi) - (11/128)(3/8)zeta(5/2)/sqrt(pi) + R = 0.491031741 WITH THE v0.20.0 SIGN FIX (the v0.19.0 value 0.491486318 carried the Euler-Maclaurin tail's +N^{-s} error — zetaEM ADDED the (1/2)N^{-s} term it must subtract, +4.542e-4 on zetaFace at N=60, the error's exact N^{-s} signature 2.1517e-3 = 60^{-1.5}/7.6073e-4 = 120^{-1.5}/3.5861e-5 = 60^{-2.5} convicting it, TC47) with R = -0.037280594 an explicit convergent remainder (k^{-7/2} tail) — the STRUCTURAL EXPLANATION of TC43's zeta(1/2) refutations stands: the constant is zeta(3/2)/zeta(5/2)-flavored plus an explicit remainder, not a zeta(1/2) composite; zeta_m = -0.306852819 (fixed) so Phi1 = kappa - zeta_m = +7.14e-8, bracketed within ±5.6e-7 (TC47) — the 'nonzero' claim RETIRED; the F-function face F(k,D) -> f(k/D) with f(0)=1 (0.99999 at k=3, D=1e5): its leading O(1) shift renormalizes 2/sqrt(pi) -> sqrt(pi)/2 (the arcsine law's own leading constant); boundary honest: Phi1's fate inside the bracket is open — a's value remains machine-settled at ten digits, its arithmetic structure named",
    exactness: "EXACT",
    witness: "W-Y",
    anchors: [],
  },
  {
    id: "TC46",
    claim:
      "THE ISOLATED ECHO LAWS, INDEPENDENTLY RE-VERIFIED (v0.20.0 — route-price v0.2.0's cross-check CONVICTED the v0.2.0 verification as TAUTOLOGICAL, and the conviction stands): the COHERENT isolated qubit (n=1, h=0, theta=pi/2+delta) NEVER decays — through the family kernel m(k) = (-1)^k cos 2k delta EXACTLY, the detuned rotor (YAO17's beating/peak-splitting), and at any field the SU(2) rotor law with angle and axis read off F once; the geometric law |cos 2 delta|^k is the DEPHASED drive's law, EXACT IN EXPECTATION under per-period sign noise eps_j = ±delta: E[m~(k)] = (cos 2 delta)^k by independence of the sign product — and the benchmark lifetime tau* = ln theta / ln|cos 2 delta| is its expected-echo crossing",
    family: "beat",
    price:
      "coherent law worst deviation 8.3e-15 over delta in {0.05,0.1,0.2,0.3}, k <= 40 (kernel trajectory vs rotation closed form — two roads); the B1 census arm (h=0.05) rotor law 2.5e-14 at delta=0.1, k <= 60, axis norm deviation 1.1e-16; the v0.2.0 law CONVICTED on the same grid: worst ||m(k)| - |cos2d|^k| = 0.82..0.99, the coherent first theta-crossings at 6/3/2 (delta = 0.1/0.2/0.3) where the retired law claimed 35/9/4; dephased law EXACT — exhaustive over ALL 2^k sign sequences through the kernel at k = 8/12 (worst deviation 3.6e-15), Monte Carlo at N=40000 within 1.3 sigma at (delta,k) = (0.2,9)/(0.1,35), tau* crossing margins E[m~] = 0.5161/0.4733 (k=8/9, delta=0.2) and 0.5604/0.4627 (k=3/4, delta=0.3); the TAUTOLOGY reproduced as the negative control: the v0.2.0 formula-times-itself witness certifies the WRONG constant |cos 3 delta| just as happily — named, rejected",
    exactness: "EXACT",
    witness: "W-Z",
    anchors: ["route-price"],
  },
  {
    id: "TC47",
    claim:
      "Phi1 BOUNDED, THE NONZERO CLAIM RETIRED (v0.20.0 — the arc's one open face, closed to a certified bracket): the v0.19.0 'Phi1 = -4.547e-4 SMALL BUT NONZERO' was an ARTIFACT — zetaEM's Euler-Maclaurin tail ADDED the (1/2)N^{-s} term it must subtract (the error's exact N^{-s} signature: 2.1517e-3 = 60^{-1.5} on zeta(3/2), 7.6073e-4 = 120^{-1.5}, 3.5861e-5 = 60^{-2.5} on zeta(5/2)), contaminating zetaFace by +4.542e-4; with the sign fixed (certified by N=60/120/240 agreement at ~1e-10 where the buggy road disagreed at 1e-3), zeta_m = -0.306852819 and Phi1 = kappa - zeta_m = +7.14e-8, machine-bracketed with |Phi1| <= 5.58e-7 and every error piece named — the bracket CONTAINS ZERO: the sharp-cutoff assembly closes within the certified error, and whether Phi1 is exactly zero or a sub-bracket constant is left undecided (NO fake closed form)",
    family: "backaction",
    price:
      "the bracket's pieces: eps_kappa = 4.86e-7 — the spread of four cross-family sigma1 Richardson combos on the NEW incremental-binomial share road (per-step quotient recurrences, clean past n = 2^18 where the log-factorial table's ulp random-walk bites; cross-validated against shareFloat to 8.2e-10 relative at n <= 2^16) — plus eps_zeta = 4.6e-11 (the series' probed k^{-7/2} tail bound 9.5e-12 + the fixed zetaEM's N-truncation 3.7e-11): the transfer carries the precision; the independent kappa(D) road (incremental S, cross-validated to 1.4e-6 at D = 2^16, clean through D = 2^20) confirms the transfer kappa to 5.8e-6 — 8x tighter than v0.19's 4.7e-5 confirmation; the D-grid structure certified: Phi1(D) negative and monotone rising on D = 2^12..2^20 with increment ratios 0.502/0.501/0.498 (the 1/sqrt(D) face); fake brackets rejected BY NAME by the checker (over-narrow = over-precision fraud, misdirected, provenance-free); boundary: the D = 2^22 road point is a named outlier, excluded",
    exactness: "EXACT",
    witness: "W-Z",
    anchors: [],
  },
];
