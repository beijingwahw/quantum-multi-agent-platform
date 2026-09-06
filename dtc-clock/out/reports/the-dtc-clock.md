# THE DTC CLOCK — the epoch-4 open core executed: the beat clocks general computation, and the price list ships on the same page

> The letter's epoch-4 sentence: 'time crystals as the clock wall — a zero-energy eternal beat, the second law a disclaimer clause.' Route-price D1 split it into three truths and left two cells uncertified: the beat clocking GENERAL COMPUTATION (C3) and the energy accounting against rival clocks (C4). This page certifies both at the model layer — an exact driven-echo family whose beat advances a one-hot token that fires a universal reversible gate set with cargo fidelity exactly 1 at every tick, a thermodynamic ledger where the ideal beat costs zero net work in-model and every deviation pays, and the WO15 tombstone executed. The eternal beat is real in-model and metered at every use: the second law stays a price list (#11's verdict, now at the clock layer). Hardware is NOT claimed — MI22 holds the hardware cells.


## The certificate criterion — fixed law, legislated before the numbers (L5)


> per-run erasure obligation in units of kT ln 2 at equal error (all machines exact): garbage wires zeroed on cycle + information-theoretic readout cost of delivery (a deterministic delivery reads a known outcome and pays 0); fewest units wins


## The board

| id | claim | family | price | tag | witness |
| --- | --- | --- | --- | --- | --- |
| TC1 | the beat, operator form: at theta=pi/2, h=0, ANY couplings, the echo satisfies F+ Z_i F = -Z_i at every site — the global flip is exact, not asymptotic | beat | worst max-entry deviation 2.2e-16 over n=4..6 x 5 trials x all sites, random J in [0,2]; the identity is structural ((-i)^n Xbar e^{-iH_zz} conjugates every Z into -Z because every ZZ pair is flip-even) | EXACT | W-A |
| TC2 | the beat, trajectory: from |0...0> the order parameter alternates m(k) = (-1)^k — structurally exact (the orbit never leaves the ZZ eigenstate pair), witnessed at the floating-point summation floor | beat | worst deviation 8.9e-16 over n=4..6 x trials x k<=12, random J — the residual is the rounding of summing n values of +-1, not physics; the integer-exact statement lives on the cargo path (TC9), where it is genuinely 0 | EXACT | W-A |
| TC3 | the eigenstate-order signature: the quasi-energy spectrum is exactly pi-paired — tr F^(2k+1) = 0 for all odd powers, and tr F^(2k) = (-1)^(nk) tr B^(2k) with B = e^{-i H_zz} | beat | odd-power traces <= 2.9e-79 (exact-zero structure surviving floating point), even-power identity worst 3.0e-15 over n=5 x 3 trials x powers 2..6; the pairing follows from G = i^n F = Xbar B satisfying G^2 = B^2 (flip-invariance) — spec(G) = {+-sqrt(beta_j)}, no eigensolver involved | EXACT | W-A |
| TC4 | rigidity, censused: at equal detuning the interacting chain's subharmonic response stays locked while the isolated qubit's echo dies | beat | DATA, horizon k=20 periods, n=6, J=1.2, fields h in [0.05,0.15]: |m| at k=10 — chain 0.9922 / 0.9654 / 0.8324 vs isolated 0.5414 / 0.4138 / 0.6573 at delta = 0.05 / 0.1 / 0.2; NOT a lifetime theorem (finite horizon, prethermal bounds cited EBN16/KLS16); the hardware-scale certificate is MI22's, cited not re-run | DATA | W-A |
| TC5 | the clock register, exact layer: the beat keys a one-hot token that advances exactly once per subharmonic period, and the keying leaves the clock untouched — zero back-action on the eigenstate-order orbit | clock | worst |P(token=k after 2k drive periods) - 1| = 1.1e-15 and worst trace-distance(clock reduced, free clock) = 5.6e-16 (n=4; n=5 gives 8.9e-16 / 4.4e-16), 4-gate demo circuit, 4 random superposition inputs per run; the keying fires on the order sector, which the orbit visits wholly — the permutation never splits the clock state | EXACT | W-B |
| TC6 | cargo exactness, the T3 semantics beat-driven: conditioned on the token at beat k, the data register equals U_k...U_1 |psi> — fidelity 1 at EVERY tick | clock | worst max-entry deviation 3.3e-16 (n=4) / 1.7e-16 (n=5) between the conditional data state and the directly permuted superposition, over every beat k=1..4 and 4 random inputs; the same law vacuum-compiler certified for the spectral clock, here with the beat as the sequencing resource | EXACT | W-B |
| TC7 | the frontier is real: off the orbit (random clock superpositions) the sectors split, the clock entangles with the load, and the advance fidelity drops — the wall B5 was licensed to find | backaction | DATA, census of 3 random clock states x 4 beats (n=4, seed 31): clock-load entanglement up to 1.000 bits, worst advance fidelity 0.421 — the exact layer is an orbit statement, not a generic one, and the census says so with numbers | DATA | W-B |
| TC8 | phase-read immunity, witnessed: stroboscopic phase flips on the orbit cost nothing — |0...0> and |1...1> are basis states, the phase channel is a global phase | backaction | advance fidelity 1 - 1e-15, clock entropy 0.000, order back-action 0.0000 at q=0.10 per period — the DTC's rigidity doubles as read-protection for the phase channel; boundary: amplitude/depolarizing reads are NOT modeled here — that is the readout wall's face, priced on the route-price P1/P2 schedule this repo quotes in TC14 | EXACT | W-B |
| TC9 | the demonstrated program: a 2x2-bit reversible multiplier (TOFFOLI+CNOT netlist, depth 11, 13 wires) compiled onto the runner — functionally correct on all 16 inputs, integer-exact cargo, and the wrap beat self-resets | compile | wrong outputs 0/16; integer cargo deviation exactly 0 at every beat for every input; wrap returns the data register to its input for all 16 (the runner is a single (T+1)-cycle permutation — an absorbing halt is NOT unitary, batch 36); halt is a READING at the cycle top: the eternal beat computes the same program every cycle | EXACT | W-C |
| TC10 | the gate set's deeds: FREDKIN conserves Hamming weight on the full basis (conservative logic, machine-checked), the runner permutation is a bijection | compile | weight conservation verified on all 2^6 basis states; runner permutation hits (T+1)2^m distinct targets (Set-size check, the probe that caught the absorbing-halt bug); universality itself is CITED, not re-proven (TC11) | EXACT | W-C |
| TC11 | universality of {NOT, CNOT, TOFFOLI} for reversible computation, and FREDKIN's conservative-logic universality — the literature layer | compile | BEN73 (logical reversibility, IBM JRD 17:525) and FT82 (conservative logic, IJTP 21:219), both double-sourced in citations.md; the demonstrated depth is 11 gates on 13 wires — the claim is universal SET + demonstrated depth, never 'the DTC computes anything for free' | CITED | W-C |
| TC12 | the ideal beat costs ZERO NET WORK in-model: along the orbit every strobe is a ZZ eigenstate of the same energy, and the two-point-measurement work distribution of a period is delta(W-0) | thermo | worst |<H_zz>(k) - <H_zz>(0)| = 2.7e-15 over k=0..12 (n=6, J=1.3); TPM escape probability 1.1e-31 — the drive's work is throughput, returned; this is a CLOSED-unitary statement: baths, error correction and the physical dissipation of a real drive are hardware prices, deliberately unquoted (the dossier's power cord, P3 discipline) | EXACT | W-D |
| TC13 | the detuned beat PAYS: the first period has a true closed form, the chain's heating beyond it is suppressed by the same rigidity, and the isolated-qubit echo decay is exact | thermo | E_1 closed form <H_zz>_1 = -J(n-1)cos^2(2 delta): deviation 4.4e-15; W_0 = J(n-1) sin^2(2 delta) = 0.2566 at J=1.3, n=6, delta=0.1; isolated echo |<Z>_k| = |cos 2 delta|^k EXACT; chain drift over 15 periods = 5.7e-2 of the binding energy vs the isolated benchmark 2.6e-1 — suppression 4.5x; NO infinite-time total claimed: the naive (cos^2)^k law was convicted by the scratch run (batch 36 — after one kick the state is a superposition and the ZZ stroke entangles it); prethermal bounds cited (EBN16/KLS16) | EXACT | W-D |
| TC14 | the tariff table (D1-C4), criterion legislated BEFORE the numbers (L5): per-run erasure obligation in kT ln 2 units at equal error | thermo | DTC-clocked Bennett machine 0 < DTC as-built 5 (five garbage wires) < irreversible Boolean rival 9 (4 input + 5 internal) < FK spectral clock 43.02 QUOTED (vacuum-compiler T4 static mode, (T+1)log2(T+1) at T=11 — the uncertain-readout schedule); deterministic delivery reads a KNOWN outcome and pays 0; joule prices at k = 1.380649e-23 J/K (exact SI 2019): 5 units = 1.4355e-20 J at 300 K, 9 units = 8.6129e-25 J at 10 mK; ln 2 re-derived by midpoint quadrature, deviation 5.0e-15 from the library value | QUOTED | W-D |
| TC15 | the WO15 tombstone, executed: the nondegenerate ground state and the thermal state are STATIONARY — every local expectation constant along e^{-iHt}; and the only beat a static Hamiltonian offers is a spent two-eigenstate battery at the Bohr frequency | tombstone | n=5 TI chain (J=1, h=0.7), gap 0.1835: ground stationarity worst 3.7e-15, thermal 3.9e-15 over X_i, Z_i, ZZ_i at 11 times; battery amplitude 0.6508 with the Bohr period 2pi/gap exact to 1.4e-15; solver deed V diag V^T = H to 4.8e-14; two independent evolution roads (eigenbasis vs projector sums) agree to 4.4e-16 | EXACT | W-E |
| TC16 | the tombstone's literature layer: WO15 excludes local order-parameter oscillation in ANY ground or thermal state of a local Hamiltonian; ERS17 prices the beat outside equilibrium — a clock spends free energy to tick | tombstone | WO15 (PRL 114:251603) covers the general case our exhibition cannot (degenerate and thermodynamic-limit spectra); ERS17 (PRX 7:031022 — last author Huber, a from-memory citation writes Miller) is the battery's price tag: equilibrium never beats, a spent superposition can, the eternal beat requires the drive — both cited with boundaries, neither re-proven | CITED | W-E |
| TC17 | the certificate (D1-C4/M4), by the legislated criterion: at equal error the DTC-clocked Bennett machine wins the tariff table with 0 units — the clock is OVERHEAD, NOT ENGINE, exactly as the dossier pre-announced | certificate | winner recomputed by fewest-units at every audit: 'DTC-clocked, Bennett-uncomputed (depth 2T+1)'; the zero is the ideal closed model's (drive net work 0 at theta=pi/2, TC12) and every deviation pays — garbage 5, detuning W_0 = J(n-1)sin^2(2delta) (TC13), readout the P1/P2 schedule (TC14), armor maintenance the syndrome meter (TC27, v0.5.0); boundaries honest: hardware instantiation NOT claimed (MI22 holds the hardware cells) — clock-register noise and its majority repair are now modeled at the keying layer (TC25–TC27), hardware fault tolerance remains MI22's wall | EXACT | W-F |
| TC18 | the LIFETIME LAW, isolated face (v0.2.0 — the priced next step of TC4): the detuned echo's decay is geometric, |m(k)| = |cos 2δ|^k, so the lifetime to any threshold θ has the closed form τ*(δ, θ) = ln θ / ln|cos 2δ| | beat | closed form === direct simulation at δ = 0.1/0.2/0.3 with θ = 0.5 (τ* = 35/9/4, agreement exact) — the benchmark the chain's protection is measured against | EXACT | W-H |
| TC19 | the LIFETIME LAW, chain face — and the PROTECTION CLIFF: the interacting chain's echo lifetime exceeds the isolated qubit's by more than two orders of magnitude through δ ≈ 0.3, then COLLAPSES to 1.0× by δ = 0.4 | beat | DATA, horizon 1500 strobes at n = 6 (J = 1.2, fields as TC4): δ = 0.1/0.15/0.2 — chain STILL LOCKED at kMax (protection > 42×/94×/167× and growing, lower bounds only); δ = 0.3 — τ*_chain 700 vs τ*_iso 4, protection 175×; δ = 0.4 — τ*_chain 2 = τ*_iso 2, protection 1.0×: the prethermal shield is not smooth, it holds at full strength and then fails — the cliff sits in (0.3, 0.4) at this J; NOT a lifetime theorem in the exponential-prethermal sense (EBN16/KLS16 cited) — the model sees the cliff, the asymptotic law beyond it is cited | DATA | W-H |
| TC20 | the HEATING TWIN (the priced next step of TC13): the energy account's window drift is FRONT-LOADED — the perturbative first-strobe jump dominates — while the empirical diagonal value climbs toward the infinite-temperature face as δ grows | thermo | DATA, horizon 1500 strobes at n = 6 (J = 1.3, h = 0): τ_heat = 2 at every δ ∈ {0.1, 0.2, 0.4} (the 90%-of-window metric saturates on the perturbative jump — the slow prethermal leakage tail is what this metric cannot resolve, stated as the boundary); the window drift grows 0.419 → 1.623 → 4.388 and the empirical E∞ climbs −6.08 → −4.88 → −2.11 toward the infinite-temperature zero as δ grows — the heating total's δ-face is monotone and steep | DATA | W-H |
| TC21 | the CLIFF LINE, honestly negative at ED scale (v0.3.0 — the priced next step of TC19): the protection cliff EXISTS at every coupling J probed, but its LOCATION does not track J cleanly at n = 6 | beat | DATA, horizon 900 strobes, criterion tau_chain >= 10 x tau_iso, bisection width 7: delta_c = 0.349 / 0.344 / 0.228 / 0.357 at J = 0.6 / 1.2 / 1.8 / 2.4 — scatter (~0.13) exceeds any trend; the prethermal monotone intuition (bigger J, farther cliff) is NOT resolvable at this scale, reported as the negative result it is; priced next: larger n and longer horizons, where the asymptotic law is cited (EBN16/KLS16) not re-proven | DATA | W-I |
| TC22 | the SELF-SYNCHRONIZING CLOCK (v0.3.0 — the priced boundary of TC8, resolved POSITIVELY): under bit-flip reads on the clock register — the honest wall face the free phase channel was not — the token's advance fidelity is EXACTLY 1 at every beat and every error rate probed | backaction | fidelity 1.000000000000000 (the rounding floor) at q in {0.001 .. 0.2}, every beat of the 4-gate composite at n = 4; the mechanism: a bit flip shifts a branch's sector phase by one strobe, the branch advances early then pauses — any flip history accumulates exactly k advances over 2k strobes, so token(k) is a function of the strobe count alone; the COST is one bit of clock-load entanglement (entropy 0.067 -> 0.98 as q grows), never a misfire — the subharmonic period-2 structure is an error absorber at the keying layer | EXACT | W-I |
| TC23 | the PAULI WALL, complete: X absorbed (TC22), Z exactly free (TC8), and Y-flip reads — Y0 = i·X0·Z0, the composition — ALSO absorbed at the keying layer: the ENTIRE single-Pauli wall on the clock register leaves the token exactly on schedule | backaction | Y-flip census at n = 4 (mixture form, O((CD)^2)): advance fidelity 1.000000000000000 (the rounding floor) at q = 0.05/0.1/0.2, every beat; the entropy grows (0.86 → 1.00) — the same one-bit entanglement cost as X, never a misfire; the Pauli trinity is closed: X absorbed, Y absorbed, Z free | EXACT | W-J |
| TC24 | THE HAMMING ARMOR (the real mechanism, and the T1 wall's honest verdict): the orbit states sit at popcount 0 and n — the EXTREME popcounts — so their Hamming distance to the keying boundary (popcount n/2) is floor(n/2), which no single-qubit error can cross; ALL single-qubit noise channels, unitary AND dissipative (including T1 amplitude damping), are absorbed at the keying layer | backaction | T1 census at n = 4 (Kraus pair on bit 0, structured O((CD)^2)): advance fidelity exactly 1 at gamma = 0.001/0.01/0.05/0.1, every beat — the dissipative channel is absorbed just like the unitary ones; the mechanism: |0..0> has popcount 0 (bit 0 already 0, T1 does nothing), |1..1> has popcount n (T1 takes it to n-1, still in the minus sector); the armor's thickness is floor(n/2) — the number of SIMULTANEOUS single-qubit errors needed to cross the keying boundary grows linearly with the clock register's size | EXACT | W-J |
| TC25 | THE ABSORPTION RADIUS (v0.5.0 — the priced boundary of TC17/TC24's 'error correction unmodeled'): the clock register is the REPETITION CODE [n,1,n] and the keying is its MAJORITY DECODER — X-fire on any FIXED set of at most r = floor((n-1)/2) clock qubits is absorbed at every rate and every history, and the wall stands at |S| = r+1 | backaction | exhaustive subset census (every subset, every beat of the 4-gate composite): n=4 all sizes at q=0.5 — |S|<=1 worst fidelity exactly 1.000000000000000, |S|=2 worst 0.3164, |S|=3 worst 0.1295; n=5 all 10 subsets of size r=2 at q=0.5 — exactly 1; the deterministic worst case q=1.0: |S|=r exactly 1, |S|=r+1 exactly 0 (total misfire — the wall is real); full-strength depolarizing p=0.75 (the radius-set qubits fully mixed) at n=4/5: fidelity exactly 1 — the mechanism covers EVERY CPTP channel on the fixed set (each Kraus image of a basis state stays inside the set's popcount band); the cost is bounded: clock entropy saturates at exactly |S| bits (1.000/2.000 bits witnessed), never grows; r = floor((d-1)/2) at distance d = n is HAM50's classical correction-radius law holding for a quantum clock register; n=6/7 radii extend through the classical shadow (TC26), whose equivalence is machine-checked at n=4/5 | EXACT | W-K |
| TC26 | THE CLASSICAL SHADOW (the erosion law's engine): under delocalized X-fire (each clock qubit flips independently, prob p per period) the token process is EXACTLY classical — a functional of the popcount walk of the accumulated mask — and the armor erodes AND PARTIALLY SELF-HEALS: the fidelity sits strictly above strict sector survival, because a full-period excursion into the inverted sector refunds its even-strobe miss with an odd-strobe advance | backaction | worst |DP - quantum| 7.8e-16 over n=4 x p in {0.01,0.05,0.1,0.2} and n=5 x p=0.1, every beat — the dense (CD)^2 census and the (popcount, drift) dynamic program are the same numbers at the rounding floor; the fire rule is parity-quantized (period t fires iff (t even AND w < n/2) OR (t odd AND w > n/2)), so inverted-sector dwell is refunded: at n=4, horizon 8 periods — p=0.05 fidelity 0.691 vs strict survival 0.619; p=0.2 fidelity 0.176 vs survival 0.048 (3.7x refund); the clock marginal stays diagonal at every strobe (its entropy is the mask distribution's Shannon entropy); the walk is the Bernoulli-flip walk on the n-cube lumped to popcount (KAC47's lineage); larger n censused through the shadow: F(64 periods) at p=0.1 — n=6 2.71e-4, n=7 0.219, n=8 7.13e-4 (the odd/even drift structure persists at scale) | EXACT | W-K |
| TC27 | THE REPAIR (the epoch's priced wall, executed): majority decoding at the clock layer — a 1-bit sector read at each period top plus a conditional global flip (unitary) — restores the armor EXACTLY at odd n, where the decoder can never tie: repaired fidelity EXACTLY 1 under sustained delocalized fire; the maintenance is metered (the B4 row); at even n the tie dead zone is the decoder's honest boundary, where the machine convicted the expectation that repair always helps | thermo | n=5, p in {0.05, 0.1, 0.2}: repaired advance fidelity 1.000000000000000 (the rounding floor) at EVERY beat, against the passive twin's 0.9172/0.7427/0.5035 — the majority decoder cannot tie at odd n, so every keying fires on schedule, forever in-model; the tariff: mean syndrome entropy 0.1707/0.4253/0.7380 bits per period (0 in the noiseless ideal — a deterministic read pays 0, TC14's criterion), the conditional flip itself unitary and free; at n=4 the tie set {popcount = 2} passes through unrepaired: repaired 0.4423 vs passive 0.3953 at p=0.1 over the program, and at LONG horizons the passive refund beats the decoder outright — n=6, p=0.2, 64 periods: repaired 1.66e-5 vs passive 1.74e-4, 10x WORSE (the decoder pins the walk at the tie where misses accrue unrecovered) — the numbers overruled the expectation, reported as found; boundary: the repair is a projective sector read + conditional unitary (cross-sector dephasing is the read's cost); no fault-tolerant machinery claimed — that wall belongs to the hardware epoch (MI22) | EXACT | W-K |

## B1 — rigidity census (DATA, horizon 20 periods)

| delta | k | chain \|m\| | isolated \|m\| |
| --- | --- | --- | --- |
| 0.05 | 10 | 0.9922 | 0.5414 |
| 0.05 | 20 | 0.9908 | 0.4139 |
| 0.10 | 10 | 0.9654 | 0.4138 |
| 0.10 | 20 | 0.9581 | 0.6574 |
| 0.20 | 10 | 0.8324 | 0.6573 |
| 0.20 | 20 | 0.8482 | 0.1354 |

## B5 — the frontier census (off the orbit the wall is real)

| probe | last-beat fidelity | entropy (bits) | order back-action |
| --- | --- | --- | --- |
| detuned delta=0.05 | 0.9997 | 0.004 | 0.0001 |
| detuned delta=0.15 | 0.9815 | 0.164 | 0.0041 |
| detuned delta=0.3 | 0.8445 | 0.864 | 0.0964 |
| random clock (worst) | 0.4435 | 0.999 | 0.0000 |
| phase read q=0.10 | 1.000000000000 | 0.000000000000 | 0.000000000000 |

## The lifetime law (v0.2.0 — the priced next steps of TC4/TC13, n = 6, threshold 0.5)

| delta | tau_iso (closed form) | tau_chain (measured) | protection |

| --- | --- | --- | --- |

| 0.1 | 35 | >1500 (locked) | >42x (locked at 1500) |
| 0.15 | 16 | >1500 (locked) | >93x (locked at 1500) |
| 0.2 | 9 | >1500 (locked) | >166x (locked at 1500) |
| 0.3 | 4 | 700 | 175.0x |
| 0.4 | 2 | 2 | 1.0x |

The protection cliff: the prethermal shield holds at full strength through delta ~ 0.3 (175x at 0.3, still locked at 1500 strobes for delta <= 0.2) and COLLAPSES to 1.0x by delta = 0.4 — not smooth decay, a cliff. The heating twin (TC20): the window drift is front-loaded (the perturbative first-strobe jump; tau_heat = 2 at every delta) while the empirical diagonal value climbs toward the infinite-temperature face as delta grows. Boundaries: ED-scale horizons — the exponential-prethermal asymptotics beyond the cliff are cited (EBN16/KLS16), not re-proven.


## The cliff line and the self-synchronizing clock (v0.3.0)


The cliff LINE at n = 6, horizon 900, criterion tau >= 10 x tau_iso: delta_c = 0.349 / 0.344 / 0.228 / 0.357 at J = 0.6 / 1.2 / 1.8 / 2.4 — the cliff EXISTS at every J but its location does not track J cleanly at this scale (scatter exceeds trend; the prethermal monotone intuition is not resolvable at n = 6 — reported as the honest negative result it is).


The SELF-SYNCHRONIZING CLOCK: under bit-flip reads on the clock register — the honest wall face the free phase channel was not — the token's advance fidelity is EXACTLY 1 (the rounding floor) at every beat and every q <= 0.2. The mechanism: a bit flip shifts a branch's sector phase by one strobe; the branch advances early then pauses; ANY flip history accumulates exactly k advances over 2k strobes, so token(k) is a function of the strobe count alone. The subharmonic period-2 structure is an error absorber at the keying layer — the cost is one bit of clock-load entanglement (entropy 0.067 -> 0.98 as q grows), never a misfire.


## The Pauli wall and the Hamming armor (v0.4.0)


The PAULI WALL, closed: X absorbed (TC22), Z exactly free (TC8), and Y — the composition — also absorbed: Y-flip census advance fidelity exactly 1 at every q probed. The PAULI TRINITY is closed at the keying layer.


THE HAMMING ARMOR (TC24, the real mechanism): the orbit states sit at popcount 0 and n — the EXTREME popcounts — so their Hamming distance to the keying boundary (popcount n/2) is floor(n/2), which no single-qubit error can cross. T1 amplitude damping — the DISSIPATIVE channel — is absorbed just like the unitary ones (fidelity exactly 1 at every gamma probed): |0..0> has bit 0 already 0 (T1 does nothing), |1..1> has popcount n (T1 takes it to n-1, still in the minus sector). The armor's thickness is floor(n/2) simultaneous single-qubit errors — growing linearly with the clock register's size. This is why DTCs are experimentally robust (MI22): the subharmonic order parameter is a MAJORITY-VOTE code on the clock register.


## The armor dynamics (v0.5.0)


THE ABSORPTION RADIUS (TC25): the clock register is the repetition code [n,1,n] and the keying is its majority decoder — r = floor((n-1)/2) is the correction radius (HAM50's classical law, holding for a quantum clock register at the keying layer).

| n | r | absorbed: worst over ALL \|S\|=r subsets (q=0.5) | wall: \|S\|=r+1 (q=0.5) | deterministic q=1.0 |
| --- | --- | --- | --- | --- |
| 4 | 1 | 1.000000000000000 (4/4 subsets) | 0.3164 (6 subsets, exhaustive) | \|S\|=r 1.000000000000000, \|S\|=r+1 0.000000000000000 (exhaustive) |
| 5 | 2 | 1.000000000000000 (10/10 subsets, exhaustive) | 0.4918 (subset {0,1,2}) | \|S\|=r+1 {0,1,2} 0.000000000000000 (subset-independent: the deterministic mask alternates 0 and 3, every even strobe misses) |

The mechanism: X-fire on a fixed set S keeps the corrupted orbit |pole(t) XOR mask> inside the keying sector (popcount(mask) <= r < n/2 at even strobes, n - popcount(mask) >= n - r > n/2 at odd), so every history is absorbed — and EVERY CPTP channel on the set is (each Kraus image stays in the set's popcount band): full-strength depolarizing p=0.75 on the radius set gives advance fidelity 1.000000000000000 at n=5. The cost is bounded: clock entropy saturates at exactly |S| bits, never grows. n=6/7 radii extend through the classical shadow (below), whose equivalence is machine-checked at n=4/5.


THE EROSION LAW (TC26): delocalized X-fire — each clock qubit flips independently, prob p per period — and the token process is EXACTLY the classical shadow (worst |DP - quantum| 7.8e-16). The armor erodes AND PARTIALLY SELF-HEALS: an excursion into the inverted sector refunds its even-strobe miss with an odd-strobe advance.

| p (n=4) | fidelity at beats 1..4 (quantum === DP) | shadow dev | strict survival at period 8 | refund |
| --- | --- | --- | --- | --- |
| 0.01 | 0.999408 / 0.995007 / 0.986869 / 0.975583 | 7.77e-16 | 0.968537 | 1.01x |
| 0.05 | 0.985981 / 0.908255 / 0.801715 / 0.690712 | 7.77e-16 | 0.618534 | 1.12x |
| 0.1 | 0.947700 / 0.746506 / 0.549357 / 0.395323 | 3.33e-16 | 0.279484 | 1.41x |
| 0.2 | 0.819200 / 0.482020 / 0.285577 / 0.176160 | 1.67e-16 | 0.047906 | 3.68x |

THE REPAIR (TC27): majority decoding at every period top — a 1-bit sector read plus a conditional global flip. At ODD n the decoder can never tie, so the repaired clock is exact under sustained fire; the maintenance is metered; at even n the tie dead zone is the honest boundary.

| n | p | repaired (worst beat) | passive twin | syndrome bits/period |
| --- | --- | --- | --- | --- |
| 5 | 0.05 | 0.999999999999999 | 0.9172 | 0.1707 |
| 5 | 0.1 | 1.000000000000000 | 0.7427 | 0.4253 |
| 5 | 0.2 | 1.000000000000001 | 0.5035 | 0.7380 |
| 4 | 0.1 | 0.442342916211420 | 0.3953 | 0.5403 |

The long-horizon conviction (the machine overruling the expectation that repair always helps): at even n the tie dead zone pins the walk where misses accrue unrecovered, and the PASSIVE refund wins outright — n=6, p=0.2, 64 periods: repaired 1.658e-5 vs passive 1.745e-4 (10.5x worse); n=8 the same (10.6x). At odd n the repair is exact at every horizon probed (n=7, p=0.2, 64 periods: 1.000000000000027).


## B4 — the tariff table (per run, units of kT ln 2, equal error)

| machine | garbage | readout | units | note |
| --- | --- | --- | --- | --- |
| DTC-clocked, Bennett-uncomputed (depth 2T+1) | 0 | 0 | 0 | the zero-dissipation reading survives ONLY as this in-model ideal; every deviation pays (rows below, board B5) |
| DTC-clocked, as built (the multiplier in this repo) | 5 | 0 | 5 | five garbage wires zeroed per machine cycle |
| irreversible Boolean rival (same function, workspace reuse) | 9 | 0 | 9 | combinational: no clock register, no readout column — pays in erasure what it saves in depth |
| FK spectral clock (vacuum-compiler T4, quoted) | 0 | 43.02 | 43.02 | QUOTED from vacuum-compiler T4 static mode at T=11: the uncertain-readout schedule; a detuned DTC enters this regime (board B5) |
| DTC clock, armor-repaired (majority maintenance, n=5 p=0.10) | 0 | 0.4253 | 0.4253 | v0.5.0's maintenance contract: the 1-bit sector read's Shannon entropy per period — 0 while the armor holds strictly (a deterministic read pays 0, the TC14 criterion), metered under fire; the conditional global flip is unitary and pays 0; W-K re-derives this meter reading live and convicts drift |

Joule prices: 5 units = 1.4355e-20 J at 300 K; 9 units = 8.6129e-25 J at 10 mK (k = 1.380649e-23 J/K exact, SI 2019; ln 2 by quadrature).

## B6 — the tombstone


TI chain n=5 (J=1, h=0.7), gap 0.1835: ground stationarity 3.66e-15, thermal 3.94e-15; the spent battery swings with amplitude 0.6508 at the Bohr period, exact to 1.39e-15; the eigenbasis and projector roads agree to 4.44e-16; the solver reconstructs H to 4.80e-14.

## Witnesses

- **W-A**: PASS — flip 2.22e-16 (<=5e-15); alternation 8.88e-16 (<=1e-15, the summation floor); pairing odd 2.95e-79 even 3.00e-15; rigidity chain>isolated at k=10 for all deltas: true
- **W-B**: PASS — orbit n=4 advance 1.11e-15 backAction 5.55e-16 cargo 3.33e-16; n=5 8.88e-16/4.44e-16/1.67e-16; frontier entropy<= 1.000 bits, fidelity>= 0.421; detuned fidelity 0.9997 (d=0.05) / 0.8445 (d=0.3); phase-read fidelity 1.000000000000 entropy 0.00e+0
- **W-C**: PASS — multiplier 16/16 correct, integer cargo deviation 0; FREDKIN weight conservation true; runner bijective true (Set 40/40); runner unitary true
- **W-D**: PASS — ln2 dev 5.00e-15; T-ratio 30000.0; beat energy dev 2.66e-15; TPM escape 1.14e-31; E1 closed dev 4.44e-15; W0 0.2566 vs closed 0.2566; suppression 4.5x; tariff units [0,5,9,43.02] winner 'DTC-clocked, Bennett-uncomputed (depth 2T+1)'; 5 units @300K 1.4355e-20 J
- **W-E**: PASS — gap 0.1835; ground 3.66e-15; thermal 3.94e-15; battery amplitude 0.6508, period error 1.39e-15; cross-road 4.44e-16; solver 4.80e-14
- **W-H**: PASS — iso closed form === simulation (3 deltas); protection cliff at 800-horizon rerun: delta0.3 tau 700 vs iso 4, delta0.4 tau 2 vs iso 2; heating front-loaded tau_heat 2
- **W-I**: PASS — cliff bracket resolvable at both J ends (compact rerun): true; bit-flip advance fidelity exactly 1 at q=0.05/0.2 every beat: true
- **W-J**: PASS — Y-flip advance fidelity exactly 1 (q=0.1/0.2): true; T1 amplitude damping exactly 1 (gamma=0.05/0.1): true
- **W-K**: PASS — radius n=4 |S|=r worst 1.000000000000000 / |S|=r+1 q=1 worst 0.000 / q=1 |S|=r 1.000000000000000; n=5 all 10 |S|=2 worst 1.000000000000000, |S|={0,1,2} q=1 0.000000000000000; depol p=0.75 1.000000000000000; shadow worst dev 5.55e-16; refund F 0.176 > survival 0.048: true; repair n=5 p=0.1 exact-1 true passive 0.7427 syndrome 0.4253 bits (B4 row 0.4253); forged fire rule diverges: true
- **W-F**: PASS — board legal (0 violations); winner 'DTC-clocked, Bennett-uncomputed (depth 2T+1)' by the legislated criterion; anchors and citation keys alive

## The certificate

At equal error, per the legislated criterion, the winner is **DTC-clocked, Bennett-uncomputed (depth 2T+1)** — the clock is overhead, not engine (D1-M4's pre-announcement, now with numbers). The zero is the ideal closed model's; every deviation pays: garbage (5 units), detuning (W_0 = J(n-1)sin^2 2delta), readout (the P1/P2 schedule), armor maintenance (the syndrome meter, TC27). Boundaries on the same line: hardware instantiation NOT claimed (MI22) — clock-register noise and its majority repair are modeled at the keying layer since v0.5.0 (TC25–TC27); hardware fault tolerance remains MI22's wall. The eternal beat computes the same program every cycle; halt is a reading, and every reading is metered.
