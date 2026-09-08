# W6 — the adversary census: active taps on the withdrawal, priced

## A. the intercept-resend ledger IR(eta)

Eve taps a fraction eta of pairs, measures her half in a random basis, resends. Right-basis taps relay the underlying table faithfully and hand her that sifted bit exactly (a known eta/2 fraction); wrong-basis taps depolarize the cell. Two-path QBER and CHSH on exact tables.

| p | eta | QBER (two-path) | S attacked | census cap | below cap | I_E sparse bits/sifted | net pre-PA 1-h2(q)-I_E | verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 0 | 0.000000000 | -2.828427125 | 2 | no | 0.000 | 1.000000000 | proceed |
| 1 | 0.25 | 0.062500000 | -2.474873734 | 2 | no | 0.125 | 0.537709933 | proceed |
| 1 | 0.5 | 0.125000000 | -2.121320344 | 2 | no | 0.250 | 0.206435557 | proceed |
| 1 | 0.75 | 0.187500000 | -1.767766953 | 2 | yes | 0.375 | -0.071212260 | abort |
| 1 | 1 | 0.250000000 | -1.414213562 | 2 | yes | 0.500 | -0.311278124 | abort |
| 0.9 | 0 | 0.050000000 | -2.545584412 | 2 | no | 0.000 | 0.713603043 | proceed |
| 0.9 | 0.25 | 0.106250000 | -2.227386361 | 2 | no | 0.125 | 0.386499839 | proceed |
| 0.9 | 0.5 | 0.162500000 | -1.909188309 | 2 | yes | 0.250 | 0.109743056 | proceed |
| 0.9 | 0.75 | 0.218750000 | -1.590990258 | 2 | yes | 0.375 | -0.132878463 | abort |
| 0.9 | 1 | 0.275000000 | -1.272792206 | 2 | yes | 0.500 | -0.348548178 | abort |
| 0.75 | 0 | 0.125000000 | -2.121320344 | 2 | no | 0.000 | 0.456435557 | proceed |
| 0.75 | 0.25 | 0.171875000 | -1.856155301 | 2 | yes | 0.125 | 0.213023936 | proceed |
| 0.75 | 0.5 | 0.218750000 | -1.590990258 | 2 | yes | 0.250 | -0.007878463 | abort |
| 0.75 | 0.75 | 0.265625000 | -1.325825215 | 2 | yes | 0.375 | -0.210116495 | abort |
| 0.75 | 1 | 0.312500000 | -1.060660172 | 2 | yes | 0.500 | -0.396038233 | abort |
| 0.5 | 0 | 0.250000000 | -1.414213562 | 2 | yes | 0.000 | 0.188721876 | proceed |
| 0.5 | 0.25 | 0.281250000 | -1.237436867 | 2 | yes | 0.125 | 0.017851563 | proceed |
| 0.5 | 0.5 | 0.312500000 | -1.060660172 | 2 | yes | 0.250 | -0.146038233 | abort |
| 0.5 | 0.75 | 0.343750000 | -0.883883476 | 2 | yes | 0.375 | -0.303362072 | abort |
| 0.5 | 1 | 0.375000000 | -0.707106781 | 2 | yes | 0.500 | -0.454434003 | abort |

Worst two-path deviation across the grid: QBER 0.0e+0, CHSH 8.9e-16. Readings: the full tap (eta = 1) stamps q = 1/4 + (1-p)/4 >= 1/4 on every visibility (exactly the intercept-resend signature 1/4 on the noiseless cache) and confiscates the withdrawal — net = -0.311278 at p = 1 — the ledger reads ABORT. Verdicts flip from proceed to abort between eta = 0.5 and 0.75 at p = 1 (the tariff, not a security theorem, is the decision maker here).

## B. the census depreciation line: taps push the surplus under the classical cap

S_attacked = (1 - eta/2) * 2*sqrt(2)*p sinks below the census cap 2 at eta* = 2 - sqrt(2)/p (defined for p > 1/sqrt(2)); past that tap rate the joint column is worth less than a shared seed's classical ceiling.

| p | 2*sqrt(2)*p | eta* (crossing) | S at eta = 1 |
| --- | --- | --- | --- |
| 1 | 2.828427125 | 0.585786438 | -1.414213562 |
| 0.9 | 2.545584412 | 0.428651597 | -1.272792206 |
| 0.8 | 2.262741700 | 0.232233047 | -1.131370850 |
| 0.7072 | 2.000263663 | 0.000263628 | -1.000131831 |

At eta = 1 every signal is mediated by Eve's classical data: the attacked channel IS a shared-randomness column, and its |S| = sqrt(2)*p <= 2 sits inside W3's 256-strategy census (CHSH69's line behind it — the cap is cited, the attacked values are computed). The adversary cannot relay the entangled surplus: tapping depreciates the cache toward the seed she could have pre-shared for free.

## C. noisy storage NS(nu): the retro price of holding data across the conversation

The settings conversation closes AFTER the quantum exchange (W2's order), so Eve must carry her tapped bits across it. Storage modeled as a BSC(nu) memory on each known bit.

| nu | I_E after storage (eta = 1) |
| --- | --- |
| 0 | 0.500000000 |
| 0.05 | 0.356801521 |
| 0.11 | 0.250042021 |
| 0.25 | 0.094360938 |
| 0.5 | 0.000000000 |

Endpoints exact: nu = 0 full retention (0.5 bits/sifted bit), nu = 1/2 storage wiped (exactly 0 — a fair-coin memory carries nothing). At the h2 = 1/2 point nu = 0.11 half her take evaporates: the cache forces the adversary to fund a memory, and the memory is priced.

## D. classical-channel mutation CM(mu): priced dead loss

Flipping transported settings bits at rate mu keeps cross-basis rounds as if sifted — a fair-coin cell — inflating the observed QBER. The mutator learns nothing about key bits: the settings column is W2's certified zero-information face (the question never carries the answer).

| p | mu | q_eff (two-path) | extra reconciliation tax | adversary gain |
| --- | --- | --- | --- | --- |
| 1 | 0.05 | 0.025000000 (dev 0.0e+0) | 0.168660931 | 0 |
| 1 | 0.1 | 0.050000000 (dev 0.0e+0) | 0.286396957 | 0 |
| 1 | 0.25 | 0.125000000 (dev 0.0e+0) | 0.543564443 | 0 |

Every mutation rate strictly RAISES the tariff (extra tax > 0 for mu > 0 at p = 1) and returns exactly zero: on this channel, vandalism is not an attack, it is a donation to the QBER estimate. The zero-gain column is W2.A's theorem, executed there.

## E. the full tap through the amplifier: the floor confiscates first

| k | sparse surviving I(K;Z) bits/block | net = (k - I)/8 - h2(1/4) | verdict |
| --- | --- | --- | --- |
| 4 | 0.745154 | -0.404422382 | abort |
| 3 | 0.370532 | -0.482594651 | abort |
| 2 | 0.167227 | -0.582181486 | abort |

Amplification does collapse her information (0.745 surviving bits of a 4-bit key at k = 4, 0.167 at k = 2 — W5.C), but the h2(1/4) = 0.811278 reconciliation floor keeps the net negative at every k: at toy scale the tariff ledger's binding constraint is the floor, not the amplifier. Privacy amplification buys security margin; it cannot refund confiscated rate.

## Boundary

The census is a bounded toy family (intercept-resend taps at quartile rates, BSC memories, settings flips) — not the attack space of a security proof, and no composable statement is made. Eve's census information counts only what her tap hands her; the worst-case attribution of ALL channel noise to the adversary (which would add 1 - h2(p/2) bits at eta = 0) is W5's smoothed profile — the two accountings are printed side by side, never mixed. The eta = 1 census-cap statement executes on exact tables; the all-strategies cap behind it is W3's 256-census (CHSH69), carried not re-proved.
