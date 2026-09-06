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

## The parity, and why the coin's fate differs by direction

E1 and E2 quote the same parity from two sides — 1 ebit = 1 qubit = 2 cbits — but the coin's fate is not symmetric. In redemption the settlement event itself burns the coin: A's Bell measurement destroys the pair (post-trade concurrence exactly 0), and the 2 classical bits merely deliver the correction key — the goods do not move on the quantum leg alone (B's pre-bits marginal is exactly I/2, the no-signaling tariff of the settlement). In the reverse quote the coin is the KEY, not the payment: one transmitted qubit unlocks 2 cbits, and the decode leaves a KNOWN Bell pair — a standard coin in a known frame, spendable in the next trade. Fuel in one direction, catalyst in the other; the parity holds, the accounting does not.


## Witnesses (independent re-derivations)

- PASS — W-A redemption (24 payloads (18 pure via <psi|rho|psi>, 6 mixed + I/2 via trace distance): worst pure infidelity 1.332e-15, worst mixed TD 3.635e-16, worst pre-bits marginal TV 4.718e-16, worst post-trade coin concurrence 0.000e+0)
- PASS — W-B reverse quote and the no-coin floor (decode diag 4.441e-16 / off-diag 0.000e+0, MI 2.000000000000 bits, returned coin concurrence 1.000000000000, tetrahedron chi 1.000000000000 (avg eig worst dev 0.000e+0))
- PASS — W-C Procrustean netting (10 grades (l_min 0.05..0.50): worst |p - 2 l_min| 2.220e-16, worst success infidelity 3.331e-16, worst fail concurrence 9.793e-109, worst p - C 2.220e-16)
- PASS — W-D the mint wall (200 local rounds: worst E_F rise 0.000e+0; 50 product states stay products (worst C 0.000e+0); one CNOT mints C = 1.000000000000, fidelity to |Phi+> 1.000000000000)
- PASS — W-E two-path arithmetic (h2 both routes on 99 points: maxdev 2.220e-16; E_F(C=1) = 1.000000000000, E_F(C=0) = 0.000000000000, S(I/2) = 1.000000000000)
- PASS — W-F cross-anchors resolve (all anchor packages and the quoted tariff's rendered schedule are on disk)

## Boundaries

- Mixed-coin netting (weak MIXED pairs to standard coins) is multi-copy and asymptotic — BBPS96 with its 1997 erratum, quoted here, not claimed as machine output. The executed netting is the pure-coin Procrustean grade exactly.
- The mint wall's non-increase census is DATA supporting a cited theorem (VIDAL00: convex-roof monotones do not rise under LOCC on average); the census is the machine's testimony, the theorem is the court's.
- The classical leg's thermodynamic tariff (kT ln 2 per bit) is the #11 schedule of the sibling books — cross-anchored (W-F), never re-executed here.
- Public-key quantum money remains open (quantum-mech's boundary stands); this desk notarizes with private keys the way Wiesner's bank does.


## Closing

The letter said: Bell pairs as money, no-cloning as the free notary. The coin's exclusivity and the notary's rates were already books. What this page adds is the desk: the currency is CONSUMED by spending (teleportation burns it), CATALYZED by quoting (dense coding returns it), GRADED by netting (2*l_min exactly), and NEVER printed locally — the mint is a global gate, and its logistics are the sibling ent-sched's book. An entanglement standard is not a metaphor: it is a parity with two asymmetric fates of the coin, and both columns balance to the last decimal.
