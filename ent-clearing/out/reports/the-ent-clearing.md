# THE ENT CLEARING — the settlement layer of the entanglement standard, one page

> Ledger row #12 settled the coin (exclusivity is physics) and #13 the notary (no-cloning notarizes, binding is not sold). What neither book ever executed is the SETTLEMENT itself — how the currency is spent, quoted, and netted. This page is that book. Every trade carries both columns and the coin's fate; it renders only because the checker passed.

| id | trade | give | get | coin's fate | tag | witness |
| --- | --- | --- | --- | --- | --- | --- |
| E1 | redeem an unknown qubit (teleportation) | 1 ebit (the coin) + 2 cbits (the settlement's classical leg) | the payload itself, delivered — channel fidelity exactly 1 over pure and mixed payloads | BURNED — post-trade pairwise concurrence exactly 0; and the goods do not move until the classical leg settles (B's pre-bits marginal is exactly I/2) | EXACT | W-A |
| E2 | buy classical capacity (dense coding) | 1 transmitted qubit (the coin is the key, not the payment) | exactly 2 cbits — the four signals decode with probability exactly 1 | RETURNED — post-decode state is a KNOWN Bell pair, concurrence exactly 1: fuel in E1, catalyst in E2 | EXACT | W-B |
| E3 | the no-coin floor (classical capacity without entanglement) | 1 transmitted qubit, zero ebits | at most 1 cbit — the tetrahedron ensemble achieves chi exactly 1 (the ceiling is Holevo's, anchored in-book) | coinless — this is the floor the doubling in E2 is quoted against | EXACT | W-B |
| E4 | net a weak coin to standard (Procrustean filter) | 1 weak coin, concurrence C = 2*sqrt(l0*l1) | 1 standard coin with probability exactly 2*l_min; the success branch is exactly |Phi+> | UPGRADED on success; on failure a worthless product state (concurrence 0). Mixed-coin netting stays multi-copy asymptotic (BBPS96, quoted — not claimed here) | EXACT | W-C |
| E5 | mint new entanglement | a global two-qubit interaction (one CNOT does it) — or nothing, if you only hold local operations | locally: never — the census never raises E_F (the monotonicity is VIDAL00, cited); globally: concurrence 0 -> 1 in one gate | this row is the mint itself: the desk moves, spends, nets — it never prints | DATA | W-D |
| E6 | the classical leg's thermodynamic tariff | the 2 cbits of E1, read out at temperature T | kT ln 2 per bit — the already-settled #11 schedule, cross-anchored here, not re-executed | not a coin transaction: the price of the settlement's paperwork | QUOTED | W-F |
| E7 | net MIXED coins (BBPSSW bilateral round at bounded scale) | n mixed coins (Werner F or depolarized p), n in {2,3,4} — the sacrifice pairs are measured away | 1 purified coin with the chain probability executed exactly; post-round concurrence and E_F machine-measured; the round matches its closed forms to 1e-12; the round's expected E_F never rises | upgraded but NEVER standard at bounded scale (F_out < 1 exactly); the depolarizing step (Clifford twirl) is load-bearing — without it the next raw round degrades the coin. The BBPS96 asymptotic hashing line stays quoted, with the gap reported as data | EXACT | W-G |
| E8 | settle the ledger (the catalyst conservation census) | the settlement ops themselves, replayed with instruments | a conservation ledger: the catalyst's E_F conserved exactly (dense coding 1 -> 1), the fuel's burned exactly (teleportation delta -1), every netting and purification row never rises, the GHZ cuts conserved or settled exactly | the census itself: each row an exact identity, an exact counterexample, or an exact never-rises (the monotonicity is VIDAL00, cited) | EXACT | W-H |
| E9 | the multi-party desk (a 3-party GHZ bank) | 1 GHZ coin held jointly by A, B, C (pairwise concurrences exactly 0; every 1-vs-2 cut exactly 1/2 negativity) | any two parties withdraw: C measures X and sends 1 cbit — AB end with a KNOWN standard coin (both branches pure Bell, concurrence exactly 1); the A|BC and B|AC cuts conserved exactly, AB|C settled exactly | the mint wall survives per cut (local-channel census never raises any cut; the monotonicity is VW02, cited) and FAILS on the pairwise ledger (exact counterexample: C_AB 0 -> 1) — entanglement moves between ledgers, it is never printed | DATA | W-I |

## The parity, and why the coin's fate differs by direction

E1 and E2 quote the same parity from two sides — 1 ebit = 1 qubit = 2 cbits — but the coin's fate is not symmetric. In redemption the settlement event itself burns the coin: A's Bell measurement destroys the pair (post-trade concurrence exactly 0), and the 2 classical bits merely deliver the correction key — the goods do not move on the quantum leg alone (B's pre-bits marginal is exactly I/2, the no-signaling tariff of the settlement). In the reverse quote the coin is the KEY, not the payment: one transmitted qubit unlocks 2 cbits, and the decode leaves a KNOWN Bell pair — a standard coin in a known frame, spendable in the next trade. Fuel in one direction, catalyst in the other; the parity holds, the accounting does not.


## The purification desk — mixed coins netted at bounded exact scale (E7)

v0.1.0 quoted the BBPS96 asymptotic and did not execute it. This desk now executes the recurrence round exactly on 16x16 density matrices: a bilateral CNOT between the two coins, the sacrifice pair measured in the computational basis, the source kept when the outcomes agree, the survivor re-Wernerized by the depolarizing step (the exact 24-element local-Clifford twirl — the paper's random bilateral rotations in finite form). Every probability below is a product of exactly-executed round probabilities; the closed forms (p = F² + 2F(1-F)/3 + 5(1-F)²/9, F' = (F²+(1-F)²/9)/p, and the general Bell-diagonal XOR form) recompute to 1e-12.

| id | coin | n | tag | p(chain) | F_out | C_out | E_F_out | coin-yield p/n | E_F-yield | hashing line (QUOTED) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Y-W45-2 | Werner F=0.45 | 2 | EXECUTED | 0.535556 | 0.440871 | 0.000000 | 0.000000 | 0.267778 | 0.000000 | -0.864504 |
| Y-W55-2 | Werner F=0.55 | 2 | EXECUTED | 0.580000 | 0.560345 | 0.120690 | 0.034853 | 0.290000 | 0.010107 | -0.706008 |
| Y-W55-3 | Werner F=0.55 | 3 | EXECUTED | 0.338000 | 0.566568 | 0.133136 | 0.041178 | 0.112667 | 0.004639 | -0.706008 |
| Y-W55-4 | Werner F=0.55 | 4 | EXECUTED | 0.197000 | 0.572843 | 0.145685 | 0.047953 | 0.049250 | 0.002362 | -0.706008 |
| Y-W65-2 | Werner F=0.65 | 2 | EXECUTED | 0.642222 | 0.679066 | 0.358131 | 0.210021 | 0.321111 | 0.067440 | -0.488805 |
| Y-W65-3 | Werner F=0.65 | 3 | EXECUTED | 0.419086 | 0.695531 | 0.391062 | 0.241457 | 0.139695 | 0.033730 | -0.488805 |
| Y-W65-4 | Werner F=0.65 | 4 | EXECUTED | 0.273719 | 0.712093 | 0.424185 | 0.274435 | 0.068430 | 0.018779 | -0.488805 |
| Y-W75-2 | Werner F=0.75 | 2 | EXECUTED | 0.722222 | 0.788462 | 0.576923 | 0.441790 | 0.361111 | 0.159535 | -0.207519 |
| Y-W75-3 | Werner F=0.75 | 3 | EXECUTED | 0.533951 | 0.807803 | 0.615607 | 0.487650 | 0.177984 | 0.086794 | -0.207519 |
| Y-W75-4 | Werner F=0.75 | 4 | EXECUTED | 0.395233 | 0.827007 | 0.654013 | 0.534394 | 0.098808 | 0.052803 | -0.207519 |
| Y-W85-2 | Werner F=0.85 | 2 | EXECUTED | 0.820000 | 0.884146 | 0.768293 | 0.679969 | 0.410000 | 0.278787 | 0.152415 |
| Y-W85-3 | Werner F=0.85 | 3 | EXECUTED | 0.687333 | 0.898885 | 0.797769 | 0.718955 | 0.229111 | 0.164721 | 0.152415 |
| Y-W85-4 | Werner F=0.85 | 4 | EXECUTED | 0.576556 | 0.913403 | 0.826807 | 0.757891 | 0.144139 | 0.109242 | 0.152415 |
| Y-W95-2 | Werner F=0.95 | 2 | EXECUTED | 0.935556 | 0.964964 | 0.929929 | 0.900123 | 0.467778 | 0.421058 | 0.634355 |
| Y-W95-3 | Werner F=0.95 | 3 | EXECUTED | 0.883975 | 0.970413 | 0.940826 | 0.915492 | 0.294658 | 0.269757 | 0.634355 |
| Y-W95-4 | Werner F=0.95 | 4 | EXECUTED | 0.835332 | 0.975812 | 0.951624 | 0.930783 | 0.208833 | 0.194378 | 0.634355 |
| Y-D10-2 | depol p=0.1 (F=0.9250) | 2 | EXECUTED | 0.905000 | 0.946133 | 0.892265 | 0.847489 | 0.452500 | 0.383489 | 0.496816 |
| Y-D10-3 | depol p=0.1 (F=0.9250) | 3 | EXECUTED | 0.830500 | 0.954169 | 0.908338 | 0.869858 | 0.276833 | 0.240806 | 0.496816 |
| Y-D10-4 | depol p=0.1 (F=0.9250) | 4 | EXECUTED | 0.762312 | 0.962110 | 0.924219 | 0.892095 | 0.190578 | 0.170014 | 0.496816 |
| Y-D20-2 | depol p=0.2 (F=0.8500) | 2 | EXECUTED | 0.820000 | 0.884146 | 0.768293 | 0.679969 | 0.410000 | 0.278787 | 0.152415 |
| Y-D20-3 | depol p=0.2 (F=0.8500) | 3 | EXECUTED | 0.687333 | 0.898885 | 0.797769 | 0.718955 | 0.229111 | 0.164721 | 0.152415 |
| Y-D20-4 | depol p=0.2 (F=0.8500) | 4 | EXECUTED | 0.576556 | 0.913403 | 0.826807 | 0.757891 | 0.144139 | 0.109242 | 0.152415 |
| Y-H55 | Werner F=0.55 | inf | QUOTED | 1.000000 | 1.000000 | 1.000000 | 1.000000 | -0.706008 | -0.706008 | -0.706008 |
| Y-H65 | Werner F=0.65 | inf | QUOTED | 1.000000 | 1.000000 | 1.000000 | 1.000000 | -0.488805 | -0.488805 | -0.488805 |
| Y-H75 | Werner F=0.75 | inf | QUOTED | 1.000000 | 1.000000 | 1.000000 | 1.000000 | -0.207519 | -0.207519 | -0.207519 |
| Y-H85 | Werner F=0.85 | inf | QUOTED | 1.000000 | 1.000000 | 1.000000 | 1.000000 | 0.152415 | 0.152415 | 0.152415 |
| Y-H95 | Werner F=0.95 | inf | QUOTED | 1.000000 | 1.000000 | 1.000000 | 1.000000 | 0.634355 | 0.634355 | 0.634355 |

### Gap accounting — the executed curve vs the quoted line, honestly

- **Grade gap.** Every EXECUTED row delivers a sub-standard coin (F_out < 1 exactly — bounded-scale recurrence never mints a standard coin; the mint wall holds inside the desk too). The hashing line counts coins at F -> 1, so its rate and the executed yields are not like-for-like: the desk trades grade for rate.
- **Protocol gap.** The recurrence is 2 -> 1 per round: its own asymptotic yield is exactly zero, which is BBPS96's reason for inventing hashing. At n = 2, 3, 4 the executed yield falls as n rises while F_out rises — the tradeoff itself, measured.
- **Threshold honesty.** At F = 0.45 the round DEGRADES the coin (0.45 -> 0.440871) — purification improves fidelity only above F = 1/2, and the quoted hashing line is negative below F ~ 0.8107 (the machine brackets the sign change between F = 0.81 and F = 0.82): at those grades there is no asymptotic distillation either, only bounded netting that still returns something.
- **The twirl is load-bearing.** Without the depolarizing step the round's output concentrates its error in the phase slot and the NEXT raw round degrades the coin (0.884146 -> 0.812024 at F = 0.85, machine-measured). The protocol's step is not decoration; it is what makes the recurrence a recurrence.
- **Modern context, cited not executed.** ZANG25 (no-go theorems for universal purification) and LAMI24 (exact distillable entanglement under dually non-entangling operations) bound what any such desk can promise; both are anchors in citations.md, not machine output here.


## The conservation ledger — what settlement conserves, exactly (E8)

Across every settlement op the machine measures the give and the get. The catalyst's E_F is conserved EXACTLY (dense coding returns the coin undiminished); the fuel's E_F is destroyed EXACTLY (teleportation: delta exactly -1); every netting and purification row never rises (the VIDAL00 toll instantiated, branch-averaged); and the GHZ withdrawal conserves two cuts exactly while settling the third. The checker recomputes every delta — a fake conservation identity does not survive.

| id | op | resource | before | after | claim | note |
| --- | --- | --- | --- | --- | --- | --- |
| L1 | redeem (E1) | coin pairwise concurrence | 1.000000 | 0.000000 | NOT-CONSERVED | the settlement event burns the pair: 1 -> 0 exactly |
| L2 | redeem (E1) | coin E_F | 1.000000 | 0.000000 | NOT-CONSERVED | fuel, not catalyst: delta exactly -1 |
| L3 | redeem (E1) | cbits on the wire | 0.000000 | 2.000000 | NOT-CONSERVED | created: the classical leg carries exactly 2 (the Bell-outcome key) |
| L4 | dense code (E2) | coin E_F | 1.000000 | 1.000000 | CONSERVED | the catalyst identity: returned as a known Bell, E_F 1 -> 1 exactly |
| L5 | dense code (E2) | cbits delivered | 0.000000 | 2.000000 | NOT-CONSERVED | created: exactly 2 bits of mutual information |
| L6 | net weak coin (E4, l_min=1/4) | expected coin E_F | 0.811278 | 0.500000 | NEVER-RISES | h2 of the weak grade in, 2*l_min = 1/2 expected out — the filter's toll |
| L7 | net weak coin (E4, l_min=1/4) | expected coins | 1.000000 | 0.500000 | NOT-CONSERVED | 1 -> 2*l_min = 1/2 in expectation |
| L8 | net weak coin (E4) | cbits on the wire | 0.000000 | 1.000000 | NOT-CONSERVED | created: 1 bit announcing the filter's verdict |
| L9 | purify round (2 Werner coins, F=0.85) | expected total E_F | 1.183715 | 0.557575 | NEVER-RISES | branch-averaged E_F over keep and discard: the VIDAL00 toll, instantiated |
| L10 | purify round (2 Werner coins, F=0.85) | expected coins | 2.000000 | 0.820000 | NOT-CONSERVED | 2 -> p_succ exactly; the sacrifice pair is measured away |
| L11 | purify round | cbits on the wire | 0.000000 | 2.000000 | NOT-CONSERVED | created: 2 bits comparing the bilateral measurements (the twirl's coordination adds a bounded constant) |
| L12 | GHZ withdrawal (E9) | pairwise concurrence on AB | 0.000000 | 1.000000 | NOT-CONSERVED | the refuted wall: 0 -> 1 exactly — a standard coin MOVED onto the AB ledger |
| L13 | GHZ withdrawal (E9) | negativity across AB|C | 0.500000 | -0.000000 | NEVER-RISES | 1/2 -> 0 exactly: the joint holding across this cut is settled and closed |
| L14 | GHZ withdrawal (E9) | negativity across A|BC | 0.500000 | 0.500000 | CONSERVED | 1/2 -> 1/2 exactly, both branches |
| L15 | GHZ withdrawal (E9) | negativity across B|AC | 0.500000 | 0.500000 | CONSERVED | 1/2 -> 1/2 exactly, both branches |
| L16 | GHZ local-channel census (150 rounds) | max cut negativity (3 cuts) | 0.500000 | 0.217784 | NEVER-RISES | random local channels on all three parties never raise any cut (VW02, cited) |

The one-line law the census supports: cbits are created freely where the parity demands them (2 for a redemption, 2 for a quote, 1 for a filter verdict, 2 for a round's comparison), the coin is conserved only when it is a CATALYST, and expected E_F never rises anywhere — the desk moves and spends, it never prints.


## The GHZ bank — does the mint wall survive three parties? (E9)

A GHZ coin is held jointly: no two parties share a coin (pairwise concurrences exactly 0) yet every 1-vs-2 cut carries exactly 1/2 negativity. Any two parties can withdraw: C measures X and sends 1 cbit, and AB end holding a KNOWN standard coin (both branches pure Bell, concurrence exactly 1). The wall that survives is PER CUT — the withdrawal conserves the A|BC and B|AC cuts exactly and settles the AB|C cut to zero; a 150-round census of random local channels never raises any cut (worst rise 0). The wall that FAILS is the pairwise ledger — C_AB rises 0 -> 1 under one LOCC withdrawal, an exact counterexample. Entanglement MOVES between ledgers; it is never printed.

| id | claim | verdict |
| --- | --- | --- |
| G1 | GHZ pairwise concurrences are exactly 0 (no two parties share a coin) | HOLDS |
| G2 | every 1-vs-2 cut carries exactly 1/2 negativity (the bank's joint holding) | HOLDS |
| G3 | C measures X and sends 1 cbit: AB receive a known standard coin on both branches (purity, fidelity, concurrence all exact) | HOLDS |
| G4 | the withdrawal conserves the A|BC and B|AC cuts exactly (1/2 -> 1/2) and drops AB|C exactly (1/2 -> 0) | HOLDS |
| G5 | no tripartite LOCC raises pairwise concurrence — a pairwise mint wall | REFUTED |
| G6 | random local channels never raise any cut's negativity (150-round census; the monotonicity is VW02, cited) | CENSUS |
| G7 | random local channels keep every pairwise reduction separable (C stays 0, 150-round census) | CENSUS |


Census backing G6/G7: 150 rounds of independent random local channels on all three parties — worst pairwise concurrence 0.000e+0, worst cut rise 0.000e+0 (cuts start at 1/2 and only fall). The cut monotonicity is VW02, cited; the census is the testimony.


## Witnesses (independent re-derivations)

- PASS — W-A redemption (24 payloads (18 pure via <psi|rho|psi>, 6 mixed + I/2 via trace distance): worst pure infidelity 1.332e-15, worst mixed TD 3.635e-16, worst pre-bits marginal TV 4.718e-16, worst post-trade coin concurrence 0.000e+0)
- PASS — W-B reverse quote and the no-coin floor (decode diag 4.441e-16 / off-diag 0.000e+0, MI 2.000000000000 bits, returned coin concurrence 1.000000000000, tetrahedron chi 1.000000000000 (avg eig worst dev 0.000e+0))
- PASS — W-C Procrustean netting (10 grades (l_min 0.05..0.50): worst |p - 2 l_min| 2.220e-16, worst success infidelity 3.331e-16, worst fail concurrence 9.793e-109, worst p - C 2.220e-16)
- PASS — W-D the mint wall (200 local rounds: worst E_F rise 0.000e+0; 50 product states stay products (worst C 0.000e+0); one CNOT mints C = 1.000000000000, fidelity to |Phi+> 1.000000000000)
- PASS — W-E two-path arithmetic (h2 both routes on 99 points: maxdev 2.220e-16; E_F(C=1) = 1.000000000000, E_F(C=0) = 0.000000000000, S(I/2) = 1.000000000000)
- PASS — W-F cross-anchors resolve (all anchor packages and the quoted tariff's rendered schedule are on disk)
- PASS — W-G the purification desk (11 Werner grades: worst |p-cf| 5.551e-16, |F'-cf| 3.331e-16; 8 random Bell pairs vs XOR form: 2.776e-16; Clifford twirl 24 unitaries, fixed-point dev 3.331e-16; raw nested round degrades 0.884146 -> 0.812024 without it; worst expected-E_F rise 0.000e+0; F=0.45 degrades and F=0.55 improves as claimed; n=2,3,4 chains recompute to 0.000e+0, no minted standard coin, worst E_F excess 0.000e+0; depol family == Werner family; yield table clean (0 violations); hashing line brackets 0 between F=0.81 and F=0.82)
- PASS — W-H the conservation ledger (16 rows recomputed: the burn delta -1.000000000000, the catalyst delta 0.000e+0, every identity exact, every counterexample real, every never-rises holding)
- PASS — W-I the GHZ bank (pairwise concurrences exactly 0 (worst 3.886e-16), cuts exactly 1/2 (worst dev 2.220e-16), withdrawal/census claims all recompute — the wall survives per cut and fails on the pairwise ledger, exactly as claimed)

## Boundaries

- Mixed-coin netting is EXECUTED at bounded scale (n = 2, 3, 4, exact kernels): the BBPSSW recurrence with its depolarizing step realized as the exact 24-element local-Clifford twirl. The n -> infinity asymptotics — hashing's positive rate above F ~ 0.8107, and the no-go/exactness results of ZANG25/LAMI24 — remain quoted, never claimed as machine output.
- The bounded schemes never deliver a standard coin (F_out < 1 exactly); the mint wall holds inside the purification desk as everywhere else.
- The mint wall's non-increase is a census (DATA) supporting cited theorems (VIDAL00 for E_F, VW02 for cut negativity); the machine testifies, the court cites.
- The classical leg's thermodynamic tariff (kT ln 2 per bit) is the #11 schedule of the sibling books — cross-anchored (W-F), never re-executed here.
- The GHZ census is bounded (150 local rounds, single-qubit local channels); deeper LOCC strategies and larger banks are not explored.
- Public-key quantum money remains open (quantum-mech's boundary stands); this desk notarizes with private keys the way Wiesner's bank does.


## Closing

The letter said: Bell pairs as money, no-cloning as the free notary. The coin's exclusivity and the notary's rates were already books. What this page adds is the desk: the currency is CONSUMED by spending (teleportation burns it), CATALYZED by quoting (dense coding returns it), GRADED by netting (2*l_min exactly for pure coins, executed recurrence rounds for mixed ones at bounded scale), conserved exactly where it is a catalyst (the ledger), banked jointly where three parties hold it (the GHZ desk), and NEVER printed locally — the mint is a global gate, and its logistics are the sibling ent-sched's book. An entanglement standard is not a metaphor: it is a parity with two asymmetric fates of the coin, a ledger where only the catalyst's row balances to zero, and both columns balance to the last decimal.
