# T6 — the exact-tie face: what the ledger does when gap = 0

The priced boundary of t5-power-ledger.md line 32 ('gap = 0, k = infinity, the ledger declines to quote') is executed here: the refusal is a TYPED result the ledger returns, the tie law is machine-executed on exact arithmetic, the instance families that hit exact ties are censused, the degenerate plateau of optimal policies is verified in BOTH cost models, and the tie constants of the amplification race are isolated as exact algebraic data.

## A. the refusal law, typed (the PP face: 2*both = m)

| instance | m | both | integer referee | gap | delta | quote |
| --- | --- | --- | --- | --- | --- | --- |
| moderate gap | 12 | 7 | 14 vs m | 0.083333333 | 0.1 | k = 167, queries = 14250.7 |
| near-tie | 11 | 6 | 12 vs m | 0.045454545 | 0.1 | k = 559, queries = 52037.8 |
| exact tie (x_0 absent) | 92 | 46 | TIE (2*both = m) | 0.000000000 | 0.1 | DECLINED (EXACT-TIE): k is ill-posed, the ledger declines to quote |
| random n=11 | 21 | 12 | 24 vs m | 0.071428571 | 0.1 | k = 227, queries = 22137.9 |
| random n=12 | 19 | 0 | 0 vs m | 0.500000000 | 0.1 | k = 5, queries = 1077.9 |

The quoting rule is decided by the INTEGER referee 2*both === m — never a float gap, so float noise can neither forge nor hide a tie. On a tie the ledger returns { status: 'declined', reason: 'EXACT-TIE', gap: 0 } — a typed refusal, data not prose.

## B. the tie plateau: the vote error is EXACTLY 1/2 for every odd k

| k (odd) | sum_{i<=k/2 floor} C(k,i) (integer path) | = 2^(k-1)? | float tail P[Bin(k,1/2)<=k/2] |
| --- | --- | --- | --- |
| 1 | 1 | yes | 0.500000000000000 |
| 3 | 4 | yes | 0.500000000000000 |
| 5 | 16 | yes | 0.500000000000000 |
| 21 | 1048576 | yes | 0.499999999999998 |
| 101 | 1267650600228229401496703205376 | yes | 0.500000000000038 |
| 501 | 3273390607896141870013189696827599152216642046043064789483291368096133796404674554883270092325904157150886684127560071009217256545885393053328527589376 (exact BigInt) | yes | 0.500000000001515 |
| 999 | 2678771517965668302371062622650004526403512029263834018609375970925877627812340306232995947039239645318986682293882867062967863214230785108996144393674643700983641943706057746355268651265592785469488545538261618745895485316849691889791385986519265728642799119421635541915107457913156096709301417017344 (exact BigInt) | yes | 0.500000000000305 |

Tie law, executed: each vote string pairs with its complement, so the half binomial sum is exactly 2^(k-1) (integer path, BigInt) and the majority-vote error is exactly 1/2 for EVERY odd k — the float path agrees to ~1e-13. Consequences: (i) every k ties with every other k — the argmin over k is all of them, the optimum is ill-posed; (ii) the constraint set {k : error <= delta} is EMPTY for every delta < 1/2 — no finite price buys a decision, k = infinity; (iii) that is exactly why the ledger declines to quote, and the refusal is the theorem.

## C. the tie-breaking census: which instance families hit exact ties

| family | instances | exact ties | notes |
| --- | --- | --- | --- |
| free variable (x_0 absent from every clause) | 20 | 20 (ALL) | model set closed under x_0 -> x_0 XOR 1 (verified by enumeration), so both = m/2 whenever m > 0; sample m = 34 |
| random 3-SAT (n=10, 30 clauses) | 300 | 8 | accidental ties: model counts of the tie instances m = [16, 4, 2, 10, 8, 8, 12, 14]; every tie had even m (machine-checked) |

The refusal semantics is not only the adversarial construction: 8 of 300 random instances landed on 2*both = m exactly (detected by integer arithmetic, no epsilon judgment). Honest number: the accidental rate is a few percent at these model counts — noticeable, not routine; the free-variable family is the family that ties ALWAYS.

## D. the restart-menu tie census: lambda(1) = lambda(2) on integer tables

| denominator range | solutions (d, a1, a2) | count | d divides a1^2 holds on every pair | no non-divisible pair ties |
| --- | --- | --- | --- | --- |
| 2 <= d <= 64 | (4,2,1) (8,4,2) (9,3,2) (9,6,2) (12,6,3) (16,4,3) (16,8,4) (16,12,3) (18,6,4) (18,12,4) (20,10,5) (24,12,6) ... | 58 | holds on every pair | no non-divisible pair ties (full sweep) |

The exact-tie equation is the integer equation d*a2 = a1*(d-a1), i.e. d | a1^2 — equivalently p2 = p1(1-p1), the geometric step: the tied family is 'geometric on the first two steps, arbitrary beyond'. Both directions are machine-verified by exact rational lambda equality (every divisible pair ties; for every non-divisible pair, NO integer second atom ties — full sweep). Each census solution automatically leaves remainder mass (a1 + a2 < d), so the table is a genuine 3+-support distribution.

## E. the degenerate plateau: optimal policies at an exact tie

Instance: table (2, 1, 0, 0, 1)/4 — the census family with the remainder pushed out to t = 5. Exact rational lambdas:
| t | lambda(t) exact | = 2? |
| --- | --- | --- |
| 1 | 2/1 | TIED OPTIMUM |
| 2 | 2/1 | TIED OPTIMUM |
| 3 | 7/3 | strictly above |
| 4 | 8/3 | strictly above |
| 5 | 9/4 | strictly above |

Optimal set = {1, 2} (exact tie at lambda* = 2/1). Degenerate plateau, executed: all 14 cyclic schedules of length <= 3 over the tied cutoffs attain lambda* with worst deviation 0.000000000000000 — the convex identity T(S) = sum g_i lambda(t_i) with every ingredient equal makes the optimal-policy set the FULL SIMPLEX over the tied cutoffs (every deterministic cycle and every mixture is exactly optimal). Mixing in a cutoff outside the set lands strictly above lambda* (worst ingredient margin 0.666667).

## F. the plateau survives the always-pay model

Always-pay menu with an exact cost/probability tie — rounds (c,p) = (1, 1/3), (2, 2/3), both c/p = 3/1: ratios exactly equal (machine-checked rationals). The alternating schedule costs T = (c1 + (1-p1)c2)/(p1 + p2 - p1 p2) = 3/1 EXACTLY — equal to L* — and the float renewal path agrees to 0.00. Exact reason: the per-cycle payment telescopes, sum_i (prod_{j<i}(1-p_j)) c_i = L (1 - prod_j (1-p_j)), and the geometric series closes. So the degenerate plateau holds in BOTH cost models — even when every round is paid in full, mixing tied optima is free (while mixing any sub-optimal round strictly costs).

## G. the Grover face never ties at integer points

| N | t scanned | exact ties found |
| --- | --- | --- |
| 256 | 256 | 0 |
| 1024 | 1024 | 0 |
| 4096 | 4096 | 0 |

The k=0-vs-k=1 tie equation at sin^2(theta) = t/N is (3N - 4t)^2 = 2N^2 — an integer equation with NO solutions (it would make sqrt(2) rational), machine-checked in BigInt at every t. Consequence: exact ties are a PP-face and restart-face phenomenon; at integer (N, t) the amplification ledger always quotes a strict winner. The threshold constant (3-sqrt(2))/4 is irrational, so finite instances sit strictly on one side of the boundary — never ON it.

## H. the tie constants c_k as exact algebraic data

P_k(s) = U_{2k}(sqrt(1-s)) = sin((2k+1)theta)/sin(theta) as integer-coefficient polynomials in s = sin^2(theta); the k-th optimality tie is the root of Q_k = P_k^2 - (k+1).

| k | P_k(s) coefficients | c_k certified digits (bisection, exact) | sign changes of Q_k on (0,1) |
| --- | --- | --- | --- |
| 1 | [3, -4] | 0.3964466094067262377995778189475754803575 | 1 |
| 2 | [5, -20, 16] | 0.1932846128836095899543202188511345021638 | 1 |
| 3 | [7, -56, 112, -64] | 0.1132954307789794802160006227975521177971 | 1 |
| 4 | [9, -120, 432, -576, 256] | 0.0743666560468173167940877815842140327071 | 1 |
| 5 | [11, -220, 1232, -2816, 2816, -1024] | 0.0525865010906941994181932973974302858819 | 3 |
| 6 | [13, -364, 2912, -9984, 16640, -13312, 4096] | 0.0391821215860373721841776044151155266692 | 3 |

Second independent paths (nested integer square roots, zero floats): c_1 = (3 - sqrt(2))/4 -> 0.3964466094067262377995778189475754803575 (agrees with bisection on every certified digit); c_2 = (20 - sqrt(80 + 64 sqrt(3)))/32 -> 0.1932846128836095899543202188511345021638 (agrees with bisection likewise). Monotone census: c_1 = 0.3964... > c_2 = 0.1932... > c_3 = 0.1132... > c_4 = 0.0743... > c_5 = 0.0525... > c_6 = 0.0391... — c_1 > c_2 > ... > c_6 on certified brackets, so k = 1 is the binding constraint of the threshold law (now an exact-algebraic-data statement over k = 1..6, upgrading the float-grid verification of boundary 6).

### finite-N thresholds against the certified c_1

| N | finite-N threshold density t/N | certified c_1 (upper bracket) | above? |
| --- | --- | --- | --- |
| 256 | 0.398437500 | 0.396446609 | yes |
| 1024 | 0.396484375 | 0.396446609 | yes |
| 4096 | 0.396484375 | 0.396446609 | yes |
| 16384 | 0.396484375 | 0.396446609 | yes |

## I. the adjudication protocol (laws the ledger enforces)

| law | names and rejects |
| --- | --- |
| TIE-QUOTE | a fabricated finite-k quote at an exact tie (2*both = m) |
| FALSE-REFUSAL | a typed refusal on a row where the integer referee says quotable |
| K-FORGE / PRICE-FORGE | a quoted k or price that the row's own gap/geometry does not generate |
| PLATEAU-FORGE | a claimed exact-tie optimal plateau that the integer table's exact lambdas contradict |
| DIGITS-FORGE | a claimed decimal for c_1 that the certified bracket contradicts |

The smuggling trials in test/t6-tieface.test.ts feed each law a fabricated artifact; every trial must be NAMED and REJECTED by the adjudicator.
