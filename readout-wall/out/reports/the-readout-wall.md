# THE READOUT WALL — order knowledge and order advantage, both columns

> The ledger's #06 cost column says it in one clause: readout collapses the order. This page executes the clause as trades — every row books what you GET (the definite branch) against what you PAY (the off-block coherences that carry the advantage). It is only rendered because the checker passed: a one-sided trade, an EXACT tag whose witness fails, or a dead anchor all refuse to render.

| id | face | GET | PAY | exactness | witness |
| --- | --- | --- | --- | --- | --- |
| E1 | ESC18 exchange — two completely depolarizing boxes, joint receiver | the order bit: P(control=0 | input) = 1/2 to 1e-15 for every input — a fair coin about the branch, never about the payload | chi_joint 0.048794940695399 -> 0.000000000000000: every bit of the switched advantage lives in the off-block coherences the readout demolishes | EXACT | W-B |
| E2 | Collapse identity — what the readout leaves behind | the definite branch: a classical mixture of the fixed-order channels, weighted by the control's diagonal (p_c * M_c) | the off-block terms, all of them: dephased switch = the mixture, machine-identity to 1e-15 across the showcase pairs, biased controls, and random CPTP pairs — the read-out switch is not a new process, it is the average of the orders you could have chosen | EXACT | W-A |
| E3 | Complementarity face — replacer pair, information parked ON the control | the order bit, again input-blind (P = 1/2) | control information T = 1/2 (chi_control = H2(1/4) - 1/2 = 0.311278 bits) -> z-readout T = 0.000000000000000: the information lives at x-coherence; the order basis sees nothing. Order-knowledge and order-advantage are complementary observables of the same register | EXACT | W-C |
| E4 | Weak readout — partial dephasing of strength lambda | lambda-strength order knowledge | chi(lambda): 0.048795 -> 0.026470 (@0.25) -> 0.011482 (@0.5) -> 0.002831 (@0.75) -> 0 (@1) — the interior is now a THEOREM (v0.2.0): the closed form 2f((5-l)/16)+2f((3+l)/16)-f((3-l)/8)-f((1+l)/8)-2f(1/4) is machine-verified against the simulation at every grid point and certified STRICTLY DECREASING and STRICTLY CONVEX on the rational grid lambda = i/20 by exact interval arithmetic, ln enclosed on two independent series paths | EXACT | W-D |
| E5 | k=3 face — six orders, one register | the order register over the six permutations of S3 | chi_joint 0.098069743463625 -> 0.000000000000000 (machine-measured; no paper value claimed); the six-order mixture identity holds to 1e-15 — and the k=3 weak-readout curve has its own closed form (dyadic spectra, affine in the coherence, machine-verified) with its own exact monotonicity+convexity certificates on the same grid (v0.2.0) — the wall scales with the order count it buries | EXACT | W-E |
| E6 | Exchange-rate frontier — order bits priced in chi | G(lambda) = lambda bits of order knowledge: the read-and-remember instrument (with probability lambda, projectively read the order register and keep the record) leaves exactly the weak-readout state and carries I(record; order) = lambda — the order bit, input-blind as ever | capacity lost L(lambda) = chi(0) - chi(lambda), machine-mapped as exact data on both showcase families (ESC18 joint, replacer control). Pareto certificate (exact, on the census): no measured point dominates another. First-touch dominance (exact): every next 1/20 of order knowledge is strictly cheaper — the first costs 0.005123 (ESC18) / 0.065113 (replacer control); the wall is steepest at first touch | EXACT | W-F |

## Witnesses (independent re-derivations)

- PASS — W-A collapse identity (readout = classical mixture) (5 pairs x 3 inputs, maxdev 1.110e-16)
- PASS — W-B ESC18 exchange (T_full 0.250000000000000, chi 0.048794940695399 -> 0.000000000000000, order-bit blindness 3.33e-16)
- PASS — W-C complementarity face (T(control) 0.499999999999999 -> z-readout 0.000000000000000; chi_control 0.311278124 vs H2(1/4)-1/2)
- PASS — W-D weak-readout interior theorem (closed form vs sim maxdev 3.886e-16 (worst lambda=0.1, 21 pts); exact: monotone (min gap 1.127e-4) + convex (min dd 2.257e-4), 2 ln paths, widths <= 9.626e-21)
- PASS — W-E k=3 face (six orders) (chi 0.098069743463625 -> 0.000000000000000; mixture identity 1.388e-17 (depol), 5.551e-17 (complex random triples); weak-readout closed form vs sim maxdev 1.749e-15, certified monotone+convex (2 paths, min dd 4.288e-4))
- PASS — W-F exchange-rate frontier (replacer closed form vs sim maxdev 2.776e-16 (21 pts); Pareto: no census point dominates (both families, exact); first-touch dominance: first bit costs 0.005122626 (ESC18 joint) / 0.065113068 (replacer control), every next bit strictly less)

## The interior theorem (v0.2.0) — exact certificates on the stated families

> v0.1.0 shipped these curves as data with no theorem claimed. Each family below now has a closed form whose spectra the simulation re-derives at every grid point (agreement quoted as data, <= 1e-12), certified on the rational grid lambda = i/20 by exact rational interval arithmetic with ln enclosed on two independent series (t-series and atanh-series); no float enters any certificate.

| family | closed form | monotone (min gap) | convex (min dd) | widest enclosure | paths agree |
| --- | --- | --- | --- | --- | --- |
| F1 ESC18 weak readout (grid lambda = i/20) | `chi(l) = 2f((5-l)/16)+2f((3+l)/16)-f((3-l)/8)-f((1+l)/8)-2f(1/4)` | yes (1.127e-4) | yes (2.257e-4) | 9.626e-21 | yes |
| F2 replacer control (grid lambda = i/20) | `chi(l) = f((3-l)/4)+f((1+l)/4)-[f(l/2)+f(1-l/2)+1]/2` | yes (4.512e-4) | yes (9.063e-4) | 4.813e-21 | yes |
| F3 k=3 six orders (grid lambda = i/20) | `chi(c) = sum_avg f(c*b+(1-c)/12) - sum_member f(c*n/48+(1-c)/12)` | yes (2.229e-4) | yes (4.288e-4) | 1.585e-20 | yes |

Citation (classical analysis, DATA only): the candidate chi''(l) = [1/(3-l)+1/(1+l)-1/(5-l)-1/(3+l)]/(8 ln 2) agrees with the sampled interval second-difference quotients to 2.583e-6 at every interior grid point — quoted as agreement, never asserted as certificate.


## The exchange-rate frontier (E6) — order bits priced in chi

> GET = lambda bits of order knowledge (the read-and-remember instrument leaves exactly the weak-readout state; its record satisfies I(record; order) = lambda). PAY = chi(0) - chi(lambda). Pareto certificate: on each census, no measured point dominates another — an exact antichain check on the census only, never a global claim. The marginal columns are exact: every entry is strictly smaller than the one above it (first-touch dominance).

| lambda | GET | PAY: ESC18 joint | marginal | PAY: replacer control | marginal |
| --- | --- | --- | --- | --- | --- |
| 0.00 | 0.000000000 | 0.000000000 | 0.005122626 | 0.000000000 | 0.065113068 |
| 0.05 | 0.050000000 | 0.005122626 | 0.004779159 | 0.065113068 | 0.040815357 |
| 0.10 | 0.100000000 | 0.009901785 | 0.004451140 | 0.105928425 | 0.032035574 |
| 0.15 | 0.150000000 | 0.014352925 | 0.004136871 | 0.137963999 | 0.026521023 |
| 0.20 | 0.200000000 | 0.018489796 | 0.003834858 | 0.164485022 | 0.022537092 |
| 0.25 | 0.250000000 | 0.022324654 | 0.003543778 | 0.187022114 | 0.019440041 |
| 0.30 | 0.300000000 | 0.025868432 | 0.003262452 | 0.206462154 | 0.016917626 |
| 0.35 | 0.350000000 | 0.029130884 | 0.002989822 | 0.223379780 | 0.014794336 |
| 0.40 | 0.400000000 | 0.032120706 | 0.002724928 | 0.238174117 | 0.012961594 |
| 0.45 | 0.450000000 | 0.034845634 | 0.002466900 | 0.251135710 | 0.011347473 |
| 0.50 | 0.500000000 | 0.037312534 | 0.002214940 | 0.262483184 | 0.009901785 |
| 0.55 | 0.550000000 | 0.039527474 | 0.001968310 | 0.272384969 | 0.008588011 |
| 0.60 | 0.600000000 | 0.041495784 | 0.001726328 | 0.280972980 | 0.007378636 |
| 0.65 | 0.650000000 | 0.043222112 | 0.001488353 | 0.288351615 | 0.006252274 |
| 0.70 | 0.700000000 | 0.044710464 | 0.001253782 | 0.294603890 | 0.005191828 |
| 0.75 | 0.750000000 | 0.045964246 | 0.001022043 | 0.299795718 | 0.004183250 |
| 0.80 | 0.800000000 | 0.046986289 | 0.000792589 | 0.303978968 | 0.003214680 |
| 0.85 | 0.850000000 | 0.047778877 | 0.000564892 | 0.307193648 | 0.002275824 |
| 0.90 | 0.900000000 | 0.048343769 | 0.000338440 | 0.309469472 | 0.001357481 |
| 0.95 | 0.950000000 | 0.048682210 | 0.000112731 | 0.310826953 | 0.000451171 |
| 1.00 | 1.000000000 | 0.048794941 | — | 0.311278124 | — |

Cross-family (DATA, no certificate claimed across currencies): the replacer family's control-parked information trades at roughly 7-13x the ESC18 joint rate across the census — the first 1/20 of order knowledge costs 0.065113 bits of control chi versus 0.005123 bits of joint chi. The two PAY columns price different registers; the antichain certificates are per family.


## Closing

The wall is not 'you cannot know the order.' It is a price list. The order bit is always for sale, and it is always the same coin: a fair flip about the branch — never about the payload (E1's blindness clause). What it buys depends on where the advantage was parked: on the off-blocks of the joint state (ESC18, E1), on the control's own coherence (the replacer pair, E3), or across six orders at once (E5). Reading does not merely disturb the advantage; the dephased switch IS the classical mixture of the orders you could have chosen without any switch at all (E2). And the price schedule is now a theorem on the stated families: the weak-readout curve is strictly decreasing and strictly convex — the first touch of the order register is always the most expensive (E4, E6). That is why the verdict stays HW-WAIT rather than collapsing to 'impossible': no hardware advance repeals a complementarity — but none is needed to keep paying these prices. Order is superposable, not abolishable; knowledge of it is purchasable, never free.
