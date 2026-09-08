# T5 — the power-depreciation ledger: both columns, on one page

Machine: random 3-SAT instance phi; postselection flag g = 'x satisfies phi'; readout h = 'x_0 = 1'. The branch decides the PP-style threshold question 'among the models of phi, do more than half set x_0 = 1?' — power column = the decision and its confidence, depreciation column = the branch weight paid for it.

## A. the power column: threshold decisions on real 3-SAT instances

| instance | n | clauses | m = models | models with x_0=1 | branch ratio | integer referee | deviation | gap to 1/2 | single-shot error | decision |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| moderate gap | 10 | 30 | 12 | 7 | 0.583333333 | 0.583333333 | 0.00 | 0.083333333 | 0.416666667 | h-majority |
| near-tie | 10 | 30 | 11 | 6 | 0.545454545 | 0.545454545 | 0.00 | 0.045454545 | 0.454545455 | h-majority |
| exact tie (x_0 absent) | 10 | 24 | 92 | 46 | 0.500000000 | 0.500000000 | 0.00 | 0.000000000 | 0.500000000 | tie |
| random n=10 | 10 | 32 | 20 | 14 | 0.700000000 | 0.700000000 | 0.00 | 0.200000000 | 0.300000000 | h-majority |
| random n=11 | 11 | 35 | 21 | 12 | 0.571428571 | 0.571428571 | 0.00 | 0.071428571 | 0.428571429 | h-majority |
| random n=12 | 12 | 38 | 19 | 0 | 0.000000000 | 0.000000000 | 0.00 | 0.500000000 | 0.000000000 | h-minority |

Every branch probability is the integer ratio both/m (float-zero deviation); the integer separation |2*both - m| >= 1 pins the gap at >= 1/(2m) off exact ties; the free-variable construction is an EXACT tie — the single-shot error is exactly 1/2 and no amount of repetition buys a decision.

## B. the exchange rate: confidence vs depreciation (moderate-gap instance)

| delta | k (odd) | exact vote-error P[Bin(k,1/2+gap) <= k/2] | Hoeffding bound | total expected queries k * N/m |
| --- | --- | --- | --- | --- |
| 0.1 | 167 | 0.014918354239 | 0.098328197209 | 14250.7 |
| 0.01 | 333 | 0.001087871567 | 0.009803655036 | 28416.0 |
| 0.001 | 499 | 0.000088000187 | 0.000977457685 | 42581.3 |

The exact binomial tail never exceeds delta (the Hoeffding design is conservative but sound), and the depreciation grows only as ln(1/delta): each decimal of confidence costs a fixed multiple of m^2 * N/m branch queries.

## C. the price spike: near-tie instances

| near-tie instance: m = 11, gap = 0.045454545 (= 0.045454545 floor) | delta = 0.1 | k = 559 | exact tail = 0.015588545593 | queries = 52037.8 |

At the integer-separation floor (gap = 1/(2m)) the same delta=0.1 decision costs 3.7x the moderate-gap instance — the sorter's power is priced by how close the count sits to the threshold. The exact-tie row of table A is the limit: gap = 0, k = infinity, the ledger declines to quote — priced and executed as its own face in t6-tieface.md (the refusal there is a typed result, not prose).

## D. both columns, side by side (the page the report was missing)

| instance | power: decision at 99% confidence | depreciation: expected queries |
| --- | --- | --- |
| moderate gap (gap=0.0833) | h-majority | 28416.0 |
| near-tie (gap=0.0455) | h-majority | 52037.8 (delta=0.1 only) |
| exact tie | no decision at any finite price | infinity |

Postselected counting power (the PostBQP = PP face, AAR04 cited) is real, exact in-branch — and metered: confidence 1-delta costs k(delta) * N/m queries with k = ln(1/delta)/(2 gap^2). Power and depreciation, one ledger, two columns, printed.
