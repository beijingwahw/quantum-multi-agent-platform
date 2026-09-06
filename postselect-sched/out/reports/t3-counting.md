# T3 — counting power: the branch as a #P-fraction evaluator

## A. conditional counting ratio vs integer referee

| n | m = |{g}| | |{g AND h}| | branch ratio | integer referee | deviation |
| --- | --- | --- | --- | --- | --- |
| 8 | 93 | 51 | 0.548387096774 | 0.548387096774 | 0.000 |
| 10 | 412 | 202 | 0.490291262136 | 0.490291262136 | 0.000 |
| 12 | 1661 | 805 | 0.484647802529 | 0.484647802529 | 0.000 |

The amplitude path and the exact integer path agree to float zero: the postselected readout evaluates #P-function ratios in closed form. This is the executable face of PostBQP = PP (AAR04, cited) — the class equality itself is not re-proven here.

## B. odd-denominator separation and the single-shot decision law

| n | m (odd) | ratio | gap to 1/2 | lower bound 1/(2m) | decision error = 1/2 - gap |
| --- | --- | --- | --- | --- | --- |
| 8 | 109 | 0.458715596 | 0.041284404 | 0.004587156 | 0.458715596 |
| 10 | 425 | 0.482352941 | 0.017647059 | 0.001176471 | 0.482352941 |
| 12 | 1579 | 0.501583281 | 0.001583281 | 0.000316656 | 0.498416719 |

With |{g}| odd the ratio can never sit exactly on 1/2, the gap is at least 1/(2m) (integer separation), and one postselected readout decides the majority sign with error exactly 1/2 - gap — the toy PP-threshold semantics, with every quantity machine-checked.

## C. two readouts in-branch: a full conditional simplex

| n | m | P(0,0) | P(0,1) | P(1,0) | P(1,1) | sum | max dev vs integer referee |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 10 | 360 | 0.263888889 | 0.261111111 | 0.236111111 | 0.238888889 | 1.000000000000 | 0.000 |

The branch carries the full joint conditional distribution — the sorter is a conditional sampler over any readout family, each cell an integer ratio.
