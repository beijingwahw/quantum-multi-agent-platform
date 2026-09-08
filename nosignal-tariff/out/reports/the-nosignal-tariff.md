# THE NO-SIGNALING TARIFF — the correlators' tax, item by item

> The letter's last clause: 'no-signaling 关税逐条记着' — recorded item by item. This page is that itemization: every correlator this correspondence has priced, one schedule, one checker, zeros witnessed by machine. It renders only because the checker passed — an item without a price, an unwitnessed zero, or a dead anchor all refuse to render.

| id | resource | tariff item | price | exactness | witness |
| --- | --- | --- | --- | --- | --- |
| T1 | the cache (singlet correlations) | B's marginal must not depend on A's axis — the no-signaling object is the SETTING, never the outcome | TV <= 2.3e-16 over the 24-axis grid, plain / under random local unitaries / under Stinespring CPTP on B's side — exact zero at the rounding floor | EXACT | W-A |
| T2 | the order register (the switched pair) | the order bit the readout buys is input-blind — P(control | payload) constant | max deviation 1.7e-16 across depol / replacer / random CPTP pairs and three payload inputs — a fair coin about the branch, never about the cargo | EXACT | W-B |
| T3 | the HJW ensembles (binding's root) | Bob's ensemble-averaged state is the same I/2 for every basis Alice commits to — the commitment is not readable before the reveal | pairwise TV = 0.0 across Z/X/Y commitments (the conditional members differ — the correlations are real; the choice is not in the marginal) | EXACT | W-C |
| T4 | the cache's withdrawal (key extraction) | gross 1/2 bit per sifted aligned pair; settings announcement 1 bit per raw pair; reconciliation h2(QBER) per sifted bit; QBER = (1-p)/2 | net(p) = (1 - h2((1-p)/2))/2: 0 at p=0 (the seed floor), 0.094360938 at p=0.5, 0.5 at p=1 — anchors exact, interior values shipped as data (the interior's monotonicity and convexity carry their own priced rows T6/T7) | DATA | W-D |
| T5 | the schedule's own arithmetic | h2 by closed form vs the Taylor series around the maximum (1 - sum d^{2k}/(2 ln2 k(2k-1))) — two paths for every quoted rate | max deviation <= 1e-12 on the open grid q in [0.05, 0.45] (400 terms); the endpoints q=0 and q=1/2 handled by closed forms — the series is honest only where it converges at machine precision | EXACT | W-E |
| T6 | the withdrawal curve's monotonicity (the interior theorem) | net(p) strictly increasing on the rational grid family p = i/20 — a machine theorem, not an observation of sorted floats | exact-rational interval certificate: upper(net(p_i)) < lower(net(p_{i+1})) for every adjacent pair, h2 enclosed on BOTH independent paths (closed form and Taylor series, rigorous tails) and the two enclosures overlapping at every interior point; min gap 0.000902060478 (pair 0->1), widest enclosure 9e-22 — nineteen orders below the margin | EXACT | W-F |
| T7 | the withdrawal curve's convexity (the inflection face) | no interior inflection: every grid second difference certified positive as exact data; the analytic candidate net''(p) = 1/(8 ln2 q(1-q)) > 0 verified pointwise — the formula itself is the citation | grid: min lower bound on Delta^2 net = 0.001808652 over the family p = i/20; data: sampled interval difference quotients strictly positive with NO calculus assumed, first-derivative agreement <= 2.5e-3 and second-derivative agreement <= 0.049 at h = 1/100 — theorem vs citation stated, not blended | EXACT | W-G |
| T8 | the cache census, fifth payer (the tetrahedral SIC family) | A's choice among the tetrahedral axes (pairwise |<psi_i|psi_j>|^2 = 1/3, the beyond-Pauli symmetric family — a qubit's complete MUB set is exactly {X,Y,Z}, so this is the honest family, not more MUBs) cannot move B's marginal | TV <= 2.2e-16 across the 4-axis tetrahedron, plain / local unitary / Stinespring CPTP on B's side — the rounding floor unchanged from the 24-axis census | EXACT | W-H |

## The interior theorem (v0.2.0) — monotonicity as a machine certificate

v0.1.0 shipped T4's interior as data, monotone on the grid because the floats came out sorted. v0.2.0 proves it: net(p) = (1 - h2((1-p)/2))/2 is certified strictly increasing on the rational grid family p = i/20 by exact BigInt rational interval arithmetic — upper(net(p_i)) < lower(net(p_{i+1})) for every adjacent pair, with h2 enclosed on two independent paths (closed form and the Taylor series around the maximum, each with a rigorous tail bound). The theorem half assumes no calculus. The citation half — the closed-form derivative net'(p) = log2((1-q)/q)/4 and second derivative net''(p) = 1/(8 ln2 q(1-q)) — is classical differentiation; the machine verifies it pointwise as data (sampled interval quotients vs formula intervals), and its positivity reduces to q < 1/2, pure rational algebra.

| adjacent pair (p_i -> p_{i+1}) | certified gap lower bound |
| --- | --- |
| 0/20 -> 1/20 | 0.000902060478 |
| 1/20 -> 2/20 | 0.002710712527 |
| 2/20 -> 3/20 | 0.004533095682 |
| 3/20 -> 4/20 | 0.006378834084 |
| 4/20 -> 5/20 | 0.008258295764 |
| 5/20 -> 6/20 | 0.010182973774 |
| 6/20 -> 7/20 | 0.012165966422 |
| 7/20 -> 8/20 | 0.014222611650 |
| 8/20 -> 9/20 | 0.016371360468 |
| 9/20 -> 10/20 | 0.018635026917 |
| 10/20 -> 11/20 | 0.021042647723 |
| 11/20 -> 12/20 | 0.023632367062 |
| 12/20 -> 13/20 | 0.026456129915 |
| 13/20 -> 14/20 | 0.029587765170 |
| 14/20 -> 15/20 | 0.033137930758 |
| 15/20 -> 16/20 | 0.037284424805 |
| 16/20 -> 17/20 | 0.042342024731 |
| 17/20 -> 18/20 | 0.048957293505 |
| 18/20 -> 19/20 | 0.058868012809 |
| 19/20 -> 20/20 | 0.084330465748 |

The convexity face: every grid second difference is certified positive as exact data (min lower bound 0.001808652) — the inflection map names **no interior inflection cell**. The citation formula net''(p) > 0 holds at every sample; sampled interval difference quotients are strictly positive with no calculus assumed; formula-vs-quotient agreement (data): first-derivative actual 0.002432327, second 0.048876992 at h = 1/100 (quoted ceilings 2.5e-3 / 0.049). Widest h2 enclosure across both paths: 8.97e-22 — nineteen orders below the smallest certified gap.


## Witnesses (independent re-derivations)

- PASS — W-A cache leakage (24 axes x local maps) (plain 1.110e-16, unitary 2.220e-16, CPTP 2.220e-16 — floor 2.30e-16)
- PASS — W-B order-bit blindness (max deviation 1.665e-16)
- PASS — W-C HJW ensemble equivalence (pairwise TV max 0.000e+0, |avg - I/2| max 0.000e+0 over Z/X/Y commitments)
- PASS — W-D withdrawal schedule (anchors 0.000000000000 / 0.094360938 / 0.500000000000, grid match true, strictly monotone true)
- PASS — W-E h2 two-path (closed vs series) (max deviation 4.441e-16 on the open grid)
- PASS — W-F interior monotonicity (exact interval certificate) (strictly increasing on p = i/20, both h2 paths; min gap 0.000902060478 (pair 0->1), widest enclosure 8.97e-22 (quote 9e-22), cross-path overlap true)
- PASS — W-G convexity / inflection face (grid Delta^2 lower bounds all positive (min 0.001808652), inflection cells named: none; citation formula positive at every sample; agreement (data) actuals 1st 0.002432327, 2nd 0.048876992 vs quoted ceilings 0.0025 / 0.049 at h = 1/100)
- PASS — W-H tetrahedral SIC census (fifth payer) (plain 0.000e+0, unitary 1.110e-16, CPTP 5.931e-17 over the 4-axis tetrahedron — floor 2.20e-16; structure dev |n.n'+1/3|, |overlap-1/3| 1.110e-16)

## Closing

Three correlators, one tax, one checker: the cache's marginal (the setting, never the outcome), the order register's blind bit, the HJW ensembles' unreadable commitment — each zero verified by the same machinery that prices the withdrawal schedule, and the census now includes the tetrahedral fifth payer at the same rounding floor. The withdrawal curve's interior is no longer data that happens to sort: its monotonicity is an exact machine certificate on the grid family, its convexity exact on the grid with the analytic candidate carried as a named citation verified pointwise. The tariff is not a fine imposed on the correlators; it is the reason they can be resources at all: correlations that signaled would be communication, and communication this cheap would already violate the census caps retro-cache enforced. What the epoch-3 letter called an oracle pays this schedule on every withdrawal — and the schedule, not the marketing, is what ships.
