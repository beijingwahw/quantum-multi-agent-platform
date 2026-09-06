# W2 — the marginal tariff: the cache does not leak the question

## A. I(B answer; A question) = 0 — B's answer is uniform under every setting

- 24 A-settings x 4 B-axes: worst |P(y) - 1/2| = 0.000000000000000
- B reduced state vs I/2: HS 0.000000000000000

The question may be any of the 24 axes; the answer distribution never moves. This is GRW80 executed.

## B. A-side operations do not reach B — the joint state does move

- 10 random A-unitaries: worst B-marginal dev 0.000000000000000; smallest joint-state HS move 0.882275
- (the A-side CPTP generality of this statement is the bqp-map exp6 B1 certificate — carried, not duplicated)

A's whole laboratory changes the joint column and cannot touch B's row.

## C. B-side local maps: bias your own coin, inject zero A-dependence

- 10 structured CPTP maps on B: largest self-bias |P(y)-1/2| = 0.000000 (B may tilt its own coin — non-unital maps)
- same maps, A-dependence |P(y|a1) - P(y|a2)| = 0.000000000000000 (exactly zero at every precision that matters)

## D. the bits, stated correctly

- I(B answer; A QUESTION) = 0 — verified above as the settings-grid invariance
- I(B answer; A ANSWER), aligned axes, from the joint table: 1.000000000000000 bit — the full bit is real, and it lives in the joint column
- access to that bit arrives only when A's half travels the classical channel — W4 prices that trip
