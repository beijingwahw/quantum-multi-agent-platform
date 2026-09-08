# W4 — the withdrawal ledger: priced, exact

Protocol: aligned-axes extraction on Werner pairs. B flips its bit; same-base pairs are kept (two bases, sifting 1/2); disagreement on sifted bits is the QBER; reconciliation must communicate at least h2(QBER) per sifted bit (SHAN48); the settings must be compared over the classical channel — log2(#bases) = 1 bit per raw pair.

| p | QBER (table path) | QBER closed (1-p)/2 | dev | leak floor h2(q) | net bits/pair | settings tariff bits/pair |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 0.000000000000 | 0.000000000000 | 0.000000000000000 | 0.000000000 | 0.500000000 | 1 |
| 0.95 | 0.025000000000 | 0.025000000000 | 0.000000000000000 | 0.168660931 | 0.415669534 | 1 |
| 0.9 | 0.050000000000 | 0.050000000000 | 0.000000000000000 | 0.286396957 | 0.356801521 | 1 |
| 0.8 | 0.100000000000 | 0.100000000000 | 0.000000000000000 | 0.468995594 | 0.265502203 | 1 |
| 0.6 | 0.200000000000 | 0.200000000000 | 0.000000000000000 | 0.721928095 | 0.139035953 | 1 |
| 0.5 | 0.250000000000 | 0.250000000000 | 0.000000000000000 | 0.811278124 | 0.094360938 | 1 |
| 0.25 | 0.375000000000 | 0.375000000000 | 0.000000000000000 | 0.954434003 | 0.022782999 | 1 |
| 0 | 0.500000000000 | 0.500000000000 | 0.000000000000000 | 1.000000000 | 0.000000000 | 1 |

Readings: the noiseless cache pays 1 bit of settings conversation per pair and nets 1/2 bit/pair of shared key; at visibility p the QBER eats h2((1-p)/2) per sifted bit; at p = 0 the cache is the shared seed of W3 — net exactly 0, every bit of key was pre-shared classical randomness all along. Nothing in this ledger arrives before the settings conversation closes.

- anchor: h2(0.5) = 1.000000000000000, h2(0.1100278644) = 0.500000000 (the h2 = 1/2 point)

## Boundary

This ledger prices RECONCILIATION and the settings tariff only. Privacy amplification against an adversary — the security layer that turns these numbers into a secret-key rate — is executed since v0.2.0 at BB84-grade toy scale in W5 (out/reports/w5-amplification.md): explicit universal-2 family, measured Eve-surviving information, key-rate curve with honest gap accounting; the composable/Shor-Preskill layer remains deliberately unclaimed. The pre-arrival zero-information column is the no-signaling face (GRW80, cited); the joint-column surplus is the Tsirelson face (TSIR80, cited).
