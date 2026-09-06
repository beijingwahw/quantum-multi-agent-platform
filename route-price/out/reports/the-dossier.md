# THE DOSSIER — route and price for the two OPEN rows

> The atlas's discipline lets OPEN rows quote no numbers; what they owe is a route with falsifiers and prices with derivations. This page is only rendered because the checker passed: every milestone books a price and names its own failure mode, the only verdict expressible here is OPEN-ROUTE, and every quoted figure is re-derived by an executable witness.

## D1 — Time crystals as the clock wall — a zero-energy, eternal beat clocking general computation.

**atlas row:** `dtc-clock` (verdict OPEN there, OPEN-ROUTE here — nothing was settled by writing this page)


Three faces, three different truths: the beat exists (driven systems, experimentally certified at NISQ scale); the beat is zero-energy (closed as impossible in equilibrium — a no-go, not a promise); the beat clocks general computation (uncertified anywhere). The dossier prices all three and routes the third.


### What a demonstration would have to exhibit

| id | demand | status | anchor |
| --- | --- | --- | --- |
| D1-C1 | subharmonic rigidity — the response stays locked at the doubled period under drive detuning and perturbation | CERTIFIED-ELSEWHERE | `cite:MI22` |
| D1-C2 | wall coherence — clocks across the register agree in phase at every tick | CERTIFIED-ELSEWHERE | `cite:MI22` |
| D1-C3 | universality — the tick drives a universal gate set for the full depth of a computation | CERTIFIED-ELSEWHERE | `local:dtc-clock` |
| D1-C4 | energy accounting — energy per tick priced against the tariff schedule of rival clocks at equal error | CERTIFIED-ELSEWHERE | `local:dtc-clock` |

### The route — milestones that name their own failure mode

| id | milestone | anchor | falsifier | price |
| --- | --- | --- | --- | --- |
| D1-M1 | Separate the wording from the physics: no equilibrium ground state beats at all — the zero-energy half of the claim is closed as impossible, not open as promising. | `cite:WO15` | none available from inside equilibrium — the no-go IS the falsifier: no local order parameter oscillates in any ground or thermal-equilibrium state of a local Hamiltonian. | keeping zero-energy costs the entire beat (WO15). The wording survives only re-scoped to driven systems, where the drive is paid every period — see D1-P3. |
| D1-M2 | Walk the Floquet route: the beat is real and the drive is the meter — the proposal and the processor demonstration already exist at NISQ scale. | `cite:WIL12` | heating: driven systems generically absorb their way to infinite-temperature mush; the order survives only behind many-body-localization or prethermal protection, and every demonstrated protection has a finite lifetime — drive long enough and the crystal dies. | drive power every period, for as long as the crystal is asked to beat. The word 'eternal' is bought with a power cord (hardware-specific; no number quoted without a measurement to stand on — D1-P3). |
| D1-M3 | Promote the beat to a clock register: ticks phase-lock a data register across a full circuit depth — the job the Feynman-Kitaev clock does today, done by physics instead of spectrum. | `local:vacuum-compiler` | per-tick dephasing accumulates; the wall fails where cumulative phase error exceeds the circuit's tolerance — and the demonstrated ticks are far short of circuit depth. | coherence-time-per-tick times tick-count must cover the computation, and every read of the clock pays the readout tariff — the same erasure schedule the vacuum-compiler already prices (D1-P2). |
| D1-M4 | The certificate itself: a computation clocked by a time crystal whose per-operation energy undercuts reversible rivals at equal error. | `cite:LAND61` | if drive energy per tick exceeds the rivals' erasure bill, the wall loses on its own tariff schedule — universality without an energy win is a slower clock. | the floor any rival pays is erasure at kT ln2 per irreversible bit (D1-P1); beating that floor requires reversible operation, at which point the clock is overhead, not engine. |

### The price lines

| id | item | amount | witness |
| --- | --- | --- | --- |
| D1-P1 | the floor every clock pays per irreversible bit — E = kT ln2, with k the exact SI constant; dilution-fridge and room temperature span four orders of magnitude. | closed form k·T·ln2 with k = 1.380649e-23 J/K (exact, SI 2019); ln2 independently re-derived by midpoint quadrature of 1/x on [1,2]; E(300 K) ≈ 2.8710e-21 J, E(10 mK) ≈ 9.5699e-26 J, ratio exactly the temperature ratio (30000). | W-A |
| D1-P2 | eternity is metered: expected erasure for a full clock-readout cycle grows superlinearly with circuit depth — the beat may be eternal, the readout is not. | the vacuum-compiler T4 law, priced: (T+1)·log2(T+1) expected erasure bits per cycle — depth 10: ≈ 38.05 bits; depth 100: ≈ 672.48; depth 1000: ≈ 9977.19; monotone, unbounded (W-A). | W-A |
| D1-P3 | the drive: the re-scoped claim's recurring cost — every period, for as long as the crystal is asked to beat. | hardware-specific and deliberately unquoted: this dossier prices the floor (P1), the no-go (M1), and the readout meter (P2); the cord is priced by the experiment that survives its own falsifier, not by prose. | — |

## D2 — 'Choice' as a language primitive — writing the desired world makes it a stable solution of the program.

**atlas row:** `choice-primitive` (verdict OPEN there, OPEN-ROUTE here — nothing was settled by writing this page)


The primitive's nearest certified relatives are already in the atlas: coherent branching (controlled operations — legal today), stability-as-invariance (ground-state compilation), the certification toll (the postselection ledger). What is undelivered is the semantics where stability is the default, and the conservation law that would guard it. The dossier draws the boundary, prices the tolls, and leaves the Noether question open with its price unquoted — by law.


### What a demonstration would have to exhibit

| id | demand | status | anchor |
| --- | --- | --- | --- |
| D2-C1 | semantics — a formal model with choice as a primitive, well-defined and composable | UNCERTIFIED | `cite:SEL04` |
| D2-C2 | stability — the desired world invariant under the program, robust under perturbation | CERTIFIED-ELSEWHERE | `local:vacuum-compiler` |
| D2-C3 | the conservation law — the symmetry whose conserved charge guards the stability | UNCERTIFIED | `local:dsic-noether` |
| D2-C4 | certification — observing that the desired world was obtained, priced | CERTIFIED-ELSEWHERE | `local:postselect-sched` |

### The route — milestones that name their own failure mode

| id | milestone | anchor | falsifier | price |
| --- | --- | --- | --- | --- |
| D2-M1 | Draw the boundary of the legal primitive: coherent control exists — a superposed control steers the program down superposed branches; what cannot exist is copying the condition to the branches' callers. The control steers, never broadcasts. | `cite:SEL04` | the copy attack, executed in W-B: a CNOT 'copy' of the control entangles instead of cloning — the pair's coherence is rephasing-invariant while a true clone's would rotate at twice the rate, the two coinciding only at isolated phases and separated everywhere by the covariance mark: no-cloning made executable (WZ82). | one control, shared: parallel worlds query it jointly and pay entanglement, or measure it and collapse the choice. SEL04's quantum-data-classical-control restriction is not timidity — it is this wall, adopted as syntax (D2-P2). |
| D2-M2 | Define stability as invariance: the desired world is stable exactly when its projector reduces the program's evolution — testable algebra, executed on toy models. | `local:vacuum-compiler` | generic targets are not invariant — W-B's random-program trials keep fidelity strictly below the engineered-exact runs; stability is engineered (compiled), never a default of the syntax. | engineering invariance is the vacuum-compiler's compilation cost all over again: the desired world must be made an invariant subspace before the language can be asked to keep it (D2-P3). |
| D2-M3 | Harden to robustness: invariance must survive perturbation — a gap law, the same spectral currency the epoch-4 compiler already pays. | `local:vacuum-compiler` | perturbation past the gap melts the world — the fuel-tilt gap-closing law; stability without a gap is a coincidence, not a solution. | gap margin bought with circuit structure: the wider the guard band, the more the compilation constrains the program. Unquoted here — this milestone's number belongs to the compiler that earns it. |
| D2-M4 | Ask the Noether question: which group action, which conserved charge guards the choice semantics — the discrete exact layer exists for mechanism design's domain; the language-level charge is unidentified. | `local:dsic-noether` | if no symmetry guards the semantics, stability is maintenance rather than physics — every perturbation must be recompiled against, and the 'physical law' wording retires. | unpriced by law: no number may be quoted for an unexhibited conservation law — the row that owes this price stays OPEN (the atlas's own discipline, enforced there and here). |
| D2-M5 | Price the observation: certifying the desired world costs the postselection toll unless the choice is made classical — in which case the primitive is an if-statement wearing a costume. | `local:postselect-sched` | the measurement wall — reading which world collapsed the choice, the same wall readout puts on superposed order; W-B's certification trials: the observed frequency matches the branch weight, and the repetitions match the toll ledger. | uniform branches: expected certifications equal the number of worlds (the 1/P arithmetic, W-C) — the epoch-3 ledger, re-invoiced at the language layer (D2-P1). |

### The price lines

| id | item | amount | witness |
| --- | --- | --- | --- |
| D2-P1 | the certification toll at the language layer: expected repetitions to certify the desired world equal the reciprocal branch weight. | uniform B branches: 1/P = B exactly on the grid, closed form vs seeded Monte Carlo (W-C); weighted branches: 1/P = 1/|alpha_w|² — e.g. weight 1/2 costs a doubling, weight 1/5 costs a fivefold (W-B certification trials). | W-C |
| D2-P2 | the broadcast ban: the condition is spent, not copied — branch callers inherit entanglement with the control, not replicas of the choice. | executed, not quoted: the W-B clone trial shows the CNOT pair's coherence stays fixed under rephasing (machine zero) while the clone's target rotates at twice the rate — two curves that coincide only at isolated phases and are separated everywhere by the covariance mark. | W-B |
| D2-P3 | stability, the engineered kind: invariance exact for compiled targets, strictly broken for generic ones — the default-world price of the primitive. | W-B: engineered targets drift at machine zero (fidelity gap < 1e-15); seeded random programs average near the Haar mean and never touch exact — the distance between the two families is the compilation the language would have to automate. | W-B |

## Executable witnesses (independent re-derivations, R5)

- PASS — W-A the Landauer floor, two-path (k exact; ln2 by quadrature; eternity metered) (ln2 quadrature vs closed: 0.693147180559905 vs 0.693147180559945; E(300 K) = 2.87098e-21 J, E(10 mK) = 9.56993e-26 J, ratio 30000.000; readout metering (T+1)log2(T+1): depth 10/100/1000 -> 38.05/672.48/9977.19 erasure bits, monotone unbounded)
- PASS — W-B the choice toy (coherence exact; engineered invariance at machine zero; random programs near the Haar mean; clone mark; certification toll; no leakage) (sub-flags coherence/engineered/generic/clone/cert/leak = 1/1/1/1/1/1; coherence numeric vs closed: (0.152813571044,0.437972399315) vs (0.152813571044,0.437972399315); engineered fidelity gap 2.22e-16; random max/mean single-branch fidelity 0.998/0.525 (Haar mean 0.5); clone mark: pair term invariant (exact) while clone term rotates at twice rate, phi=0: gap=0.707, phi=0.3: gap=0.884, phi=0.785: gap=1.000, phi=1.2: gap=0.915, phi=2.7: gap=0.337, best gap 1.000; w=0.5: mean reps 2.019 vs 1/P=2.000; w=0.2: mean reps 5.082 vs 1/P=5.000; w=0.8: mean reps 1.264 vs 1/P=1.250; leakage zero across four weightings; seed 20260906)
- PASS — W-C the uniform-branch toll (1/P = B exact on the grid; Monte Carlo agreement) (grid B in {2,4,8,16}: 1/P = B exact, N/t = B at t = 1; MC at B = 8: mean reps 7.871 vs 8 (3000 shots, seed 20260907))

## Closing

Two rows entered OPEN and leave OPEN — that is what delivery looks like in a repo that cannot settle. What changed: the zero-energy wording is closed by the equilibrium no-go, the driven route carries its power cord on the same line as its promise, the choice-primitive's boundary is executed rather than asserted, and every toll on the route is re-derived, not transcribed. The visitor asked which universe would be paid; these two pages are the invoice.
