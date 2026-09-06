# T2 — restart algebra: the depreciation ledger as a Las Vegas strategy

## A. two-path identity: closed lambda(t) vs renewal sum, fixed cutoffs

| distribution | lambda* | t* | worst |renewal - closed| |
| --- | --- | --- | --- |
| geometric r=0.05 (H=200) | 19.9930 | 200 | 0.000000000000 |
| geometric r=0.01 (H=400) | 92.6885 | 400 | 0.000000000001 |
| power-law u^-2 (H=400) | 1.6424 | 1 | 0.000000000000 |
| bimodal 0.8@1 + 0.2@100 | 1.2500 | 1 | 0.000000000000 |

The fixed-cutoff expectation computed by closed form and by the renewal sum agree to float zero — the machinery is consistent before any claim is read off it.

## B. no strategy beats the best fixed cutoff (LSZ93 Thm 3, exhaustive check)

| distribution | strategies enumerated | min T(S) | lambda* (global) | best menu lambda | margin (lambda* - min T) |
| --- | --- | --- | --- | --- | --- |
| geometric r=0.05 (H=200) | 584 | 19.998998 | 19.992989 | 19.998998 | -0.006009048 |
| geometric r=0.01 (H=400) | 584 | 98.066483 | 92.688534 | 98.066483 | -5.377949661 |
| power-law u^-2 (H=400) | 584 | 1.642437 | 1.642437 | 1.642437 | -0.000000000 |
| bimodal 0.8@1 + 0.2@100 | 584 | 1.250000 | 1.250000 | 1.250000 | 0.000000000 |

Every cyclic strategy over the cutoff menu lands at or above lambda*, and the enumeration minimum is exactly the best fixed cutoff IN the menu (the global optimum may use a cutoff outside it — reported side by side). The convex-combination identity below is the algebraic reason no schedule dips under lambda*.

## C. the convex-combination identity, LSZ93 eq. (7)

| distribution | strategy | T(S) | sum g_i | sum g_i lambda(t_i) | deviation |
| --- | --- | --- | --- | --- | --- |
| geometric r=0.05 (H=200) | (1,3,1,16) cycle | 19.999094 | 1.000000000000 | 19.999094 | 0.000000000 |
| geometric r=0.05 (H=200) | (2,5) cycle | 19.999243 | 1.000000000000 | 19.999243 | 0.000000000 |
| geometric r=0.05 (H=200) | (6,) fixed | 19.999206 | 1.000000000000 | 19.999206 | 0.000000000 |
| geometric r=0.01 (H=400) | (1,3,1,16) cycle | 98.099372 | 1.000000000000 | 98.099372 | 0.000000000 |
| geometric r=0.01 (H=400) | (2,5) cycle | 98.176665 | 1.000000000000 | 98.176665 | 0.000000000 |
| geometric r=0.01 (H=400) | (6,) fixed | 98.159542 | 1.000000000000 | 98.159542 | 0.000000000 |
| power-law u^-2 (H=400) | (1,3,1,16) cycle | 1.775021 | 1.000000000000 | 1.775021 | 0.000000000 |
| power-law u^-2 (H=400) | (2,5) cycle | 1.902899 | 1.000000000000 | 1.902899 | 0.000000000 |
| power-law u^-2 (H=400) | (6,) fixed | 2.250446 | 1.000000000000 | 2.250446 | 0.000000000 |
| bimodal 0.8@1 + 0.2@100 | (1,3,1,16) cycle | 1.354167 | 1.000000000000 | 1.354167 | 0.000000000 |
| bimodal 0.8@1 + 0.2@100 | (2,5) cycle | 1.625000 | 1.000000000000 | 1.625000 | 0.000000000 |
| bimodal 0.8@1 + 0.2@100 | (6,) fixed | 2.500000 | 1.000000000000 | 2.500000 | 0.000000000 |

sum g_i telescopes to 1 and the g-weighted lambdas rebuild T(S) exactly: any strategy is a convex mix of fixed-cutoff expectations, so it cannot dip below the cheapest ingredient.

## D. the universal doubling sequence (LSZ93 Thm 5, empirical)

| distribution | lambda* | T(S_univ) | ratio | bound (19/2)lambda*(log2 lambda* + 5) |
| --- | --- | --- | --- | --- |
| geometric r=0.05 (H=200) | 19.9930 | 19.9993 | 1.000 | 1770.4 |
| geometric r=0.01 (H=400) | 92.6885 | 98.1656 | 1.059 | 10156.4 |
| power-law u^-2 (H=400) | 1.6424 | 1.6653 | 1.014 | 89.2 |
| bimodal 0.8@1 + 0.2@100 | 1.2500 | 1.2581 | 1.006 | 63.2 |

Unknown-distribution robustness is bought for a modest factor. Honest caveat: the executed strategy is the finite prefix of S_univ with cutoffs up to 16, cycled forever — LSZ93's theorem is about the infinite sequence; the check witnesses the bound's shape on this truncation, not the theorem verbatim.

## E. the sorter's ledger vs amplified restarts (Grover curves, two-path)

| N | t | E* = min_k (k+1)/p_k | k* | ledger N/t | ledger/E* | k=0 optimal? |
| --- | --- | --- | --- | --- | --- | --- |
| 256 | 1 | 11.619 | 9 | 256.0 | 22.033 | no |
| 256 | 7 | 4.747 | 3 | 36.6 | 7.704 | no |
| 1024 | 1 | 22.675 | 18 | 1024.0 | 45.159 | no |
| 1024 | 37 | 4.223 | 3 | 27.7 | 6.553 | no |
| 4096 | 1 | 44.750 | 37 | 4096.0 | 91.531 | no |

Closed form sin^2((2k+1)theta) vs iterated 2x2 rotation agree to 0.000000000000001 across the whole grid.

## F. the threshold law: when is the pure sorter restart-optimal?

| N | last t where amplification still wins | threshold t | density t/N | limit (3-sqrt(2))/4 |
| --- | --- | --- | --- | --- |
| 256 | 101 | 102 | 0.398437500 | 0.396446609 |
| 1024 | 405 | 406 | 0.396484375 | 0.396446609 |
| 4096 | 1623 | 1624 | 0.396484375 | 0.396446609 |
| 16384 | 6495 | 6496 | 0.396484375 | 0.396446609 |

The binding constraint is k=1: p_1 = sin^2(3theta) exceeds 2 p_0 = 2 sin^2(theta) exactly when t/N < (3-sqrt(2))/4 = 0.396446609. Above the measured threshold the visitor's sorter is, by the ledger's own standard, the optimal restart strategy; below it, amplify-then-postselect strictly dominates.

## G. always-pay model: no-beating at the coherent-round standard

| N | t | depths menu | strategies | min T | E* menu | margin |
| --- | --- | --- | --- | --- | --- | --- |
| 256 | 1 | 7 | 399 | 11.784391 | 11.784391 | 0.000000000 |
| 1024 | 3 | 7 | 399 | 13.631720 | 13.631720 | 0.000000000 |

Mid-circuit rounds cannot be inspected without killing the amplification, so the full cutoff price is paid — and even then the cheapest single round type is unbeatable by any cyclic schedule (enumerated, matching LSZ's L-function argument).

## H. side observation: the classical scanner under optimal restart

| N | t | no-restart mean | lambda* |
| --- | --- | --- | --- |
| 256 | 1 | 128.50 | 128.50 |
| 1024 | 4 | 205.00 | 205.00 |

For the uniform first-mark law, restarting cannot beat running on (lambda* sits at the full-horizon cutoff): the restart machinery reports the honest no-gain.
