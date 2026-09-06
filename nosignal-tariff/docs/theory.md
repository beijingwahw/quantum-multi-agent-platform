# Theory — one tax, three payers, one checker

## The object

The no-signaling tax appears throughout this correspondence under different names: retro-cache's marginal tariff (the tax that makes the cache a correlator, not an oracle), readout-wall's blindness clause (the order bit never describes the payload), quantum-mech's HJW analysis (why binding cannot be bought). Each was verified in its home repo. This schedule puts the items on one page and runs them through one checker.

## The correct object (a recurring lesson)

The no-signaling object is I(B; A's **setting**) = 0 — the receiver's marginal across the sender's *choices* — never a statement about outcomes (on the aligned axis the outcome mutual information is legitimately 1 bit; that IS the entanglement). This workspace has now hit this wrong-object trap three times (retro-cache's batch 20, readout-wall's order bit, and this repo's own first probe, which read joint elements instead of the control marginal — batch 24). The schedule exists partly so the object is written down once, correctly, at the top.

## Why the zeros are theorems, and what the resources add

Measurement on A cannot move B's marginal for *any* state — a biased product mixture also shows zero setting-leakage (the tests assert this explicitly). What distinguishes the correlator resources is what sits on top of the theorem: the singlet's marginal is exactly the maximally mixed state (nothing about the correlation leaks into either side alone), the order register's outcome is a fair coin, and Bob's HJW-averaged state is I/2 for every committed basis. The tax schedule prices the *use* of what survives: only the joint, off-block, or conditional structure — and every withdrawal line (T4) charges for exactly that.

## The withdrawal schedule

Per raw pair: alignment succeeds with probability ½ (double-basis sifting), yielding one correlated bit; the settings announcement costs 1 classical bit per raw pair (a cost line, not a key deduction); reconciliation leaks h₂(QBER) per sifted bit with QBER = (1−p)/2. Net key rate per raw pair: **(1 − h₂((1−p)/2))/2** — zero at p=0 (the seed floor: at zero visibility the cache is distributionally indistinguishable from shared randomness, retro-cache's W3), ½ at p=1. The curve is strictly monotone on the executed grid; the interior ships as data with no convexity claim, matching the boundary discipline of readout-wall's E4.

## Two-path arithmetic

Every quoted rate is computed twice: the closed-form binary entropy and its Taylor series around the maximum, 1 − Σ_{k≥1} d²ᵏ/(2 ln 2 · k(2k−1)) with d = 1−2q. The series converges geometrically in d² — machine precision at 400 terms for q ∈ [0.05, 0.45] — but only as 1/(2N) at d=1, so the endpoints are closed forms and the series path is quoted only where it is honest. (The first draft of this series had the prefactor 4× too large and the power off by one — batch 24; the two-path discipline exists precisely to catch that class.)

## Citations

**None new.** GRW80/CHSH69/TSIR80/SHAN48 remain anchored in retro-cache's verified bibliography; the HJW structure in quantum-mech's; the order-register blindness in readout-wall's. The appeal court for every row is the witness in this repo's `npm test`.
