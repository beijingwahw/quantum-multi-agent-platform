# T1 — sorter branch algebra (exact amplitude execution)

## A. certainty-in-branch: one query, postselect flag=1, t=1

| n | P(flag=1) | t/N closed | fidelity with |x*> | uniformity dev | off-marked leak |
| --- | --- | --- | --- | --- | --- |
| 4 | 0.062500000000 | 0.062500000000 | 1.000000000000 | 0.000 | 0.000 |
| 6 | 0.015625000000 | 0.015625000000 | 1.000000000000 | 0.000 | 0.000 |
| 8 | 0.003906250000 | 0.003906250000 | 1.000000000000 | 0.000 | 0.000 |
| 10 | 0.000976562500 | 0.000976562500 | 1.000000000000 | 0.000 | 0.000 |
| 12 | 0.000244140625 | 0.000244140625 | 1.000000000000 | 0.000 | 0.000 |
| 14 | 0.000061035156 | 0.000061035156 | 1.000000000000 | 0.000 | 0.000 |

The conditional address state is EXACTLY |x*> — the sorter's truthful half.

## B. the branch is a clean conditional sample (payload readout)

| n | t | P(flag=1) | P(payload=1 | flag) amplitude | integer referee | deviation |
| --- | --- | --- | --- | --- | --- |
| 8 | 35 | 0.136718750 | 0.428571428571 | 0.428571428571 | 0.000 |
| 10 | 37 | 0.036132813 | 0.567567567568 | 0.567567567568 | 0.000 |
| 12 | 37 | 0.009033203 | 0.594594594595 | 0.594594594595 | 0.000 |

Every in-branch outcome probability is an integer ratio |{g AND h}|/|{g}| — a #P-fraction value.

## C. the filter is not a channel

- conditioning the mixture vs averaging the conditionals: trace distance = 0.166666666667 (expected exactly 1/6 = 0.166666666667)
- two-Kraus filter {Pi0, Pi1}: trace preservation dev 0.000, measurement-channel certificate (blocks kept, coherences killed) dev 0.000
- single Kraus {Pi1} on marked-supported state: trace 1.000000000000 (exactly 1)
- single Kraus on off-support state: deficit 0.500000000000 (in (0,1))

Conditioning is affine only in the branch-weighted sense: cond(sum lambda_i rho_i) = sum lambda_i w_i cond(rho_i) / sum lambda_i w_i. The measure-and-keep realization reproduces the weighted version — checked by Monte Carlo below.

## D. physical realization referee (measure flag, keep the branch)

| n | t | samples | accept sigma | worst cell sigma |
| --- | --- | --- | --- | --- |
| 6 | 11 | 40000 | 0.75 | 0.63 |
| 8 | 37 | 60000 | 0.18 | 1.12 |

Both statistics inside 5 sigma: the physical procedure lands on the conditional distribution the algebra predicts.
