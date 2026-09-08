# W5 — bounded privacy amplification: the security layer, measured at toy scale

## A. the explicit family and its machine certificate

- field certificates: GF(2^4) poly x^4+x+1 — 15/15 nonzero elements invertible; GF(2^8) poly x^8+x^4+x^3+x+1 — 255/255. Multiplication anchor 0x57 * 0x83 = 0xc1 in GF(2^8).

| m | k | family | collisions per delta | collision prob | 2^-k | universal-2 |
| --- | --- | --- | --- | --- | --- | --- |
| 8 | 8 | 255 | 0 | 0.000000000000 | 0.003906250000 | yes (strict) |
| 8 | 6 | 255 | 3 | 0.011764705882 | 0.015625000000 | yes (strict) |
| 8 | 4 | 255 | 15 | 0.058823529412 | 0.062500000000 | yes (strict) |
| 8 | 2 | 255 | 63 | 0.247058823529 | 0.250000000000 | yes (strict) |
| 4 | 4 | 15 | 0 | 0.000000000000 | 0.062500000000 | yes (strict) |
| 4 | 2 | 15 | 3 | 0.200000000000 | 0.250000000000 | yes (strict) |

The collision count is identical for every delta != 0 (exhaustive) and equals 2^(m-k) - 1 of 2^m - 1 maps: universal-2 with room to spare (CW79's definition met strictly, never exactly at 2^-k — the audit below rejects any claim of exact uniformity).

## B. Eve-surviving information, before and after amplification (exact states)

| eps_E | before I(X^8;Z^8) (two-path dev) | after k=6 | after k=4 | after k=2 | TV family-mixed (k=4) | h_inf | LHL bound (k=4) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0.5 | 0.000000 (0.0e+0) | 0.000000 | 0.000000 | 0.000000 | 0.000000 | 8.0000 | 0.1250 |
| 0.45 | 0.057804 (3.3e-12) | 0.014635 | 0.003502 | 0.000703 | 0.000836 | 6.9000 | 0.1830 |
| 0.4 | 0.232395 (1.7e-11) | 0.063138 | 0.015382 | 0.003116 | 0.001697 | 5.8957 | 0.2592 |
| 0.3 | 0.949673 (9.0e-13) | 0.327598 | 0.089161 | 0.018998 | 0.003255 | 4.1166 | 0.4802 |
| 0.25 | 1.509775 (6.5e-13) | 0.600214 | 0.181534 | 0.040815 | 0.003927 | 3.3203 | 0.6328 |
| 0.1 | 4.248035 (2.1e-12) | 2.528675 | 1.193818 | 0.385146 | 0.006010 | 1.2160 | 1.3122 |

Readings: at the full-tap equivalence point eps_E = 1/4 her 1.509775 block bits collapse to 0.181534 at k = 4 (8.3x) and 0.040815 at k = 2; the identity k = m reproduces the before-value to 1e-14 (the bijection anchor). The leftover-hash bound (ILL89 form) is VACUOUS at toy scale for k >= 4 whenever eps_E is noisy (bound >= 0.5 certifies nothing): printed, not hidden — that is the finite-size price of an 8-bit block. The family-mixed TV is small throughout, but with no composable epsilon behind it.

## C. the sparse (intercept-resend) profile through the same amplifier

| known raw bits of 8 | surviving I(K; Z) at k=4, mean | min | max |
| --- | --- | --- | --- |
| 1 | 0.058824 | 0.000000 | 1.000000 |
| 2 | 0.167087 | 0.000000 | 2.000000 |
| 3 | 0.370868 | 0.000000 | 3.000000 |
| 4 | 0.745154 | 0.000000 | 4.000000 |

Exact linear algebra (field multiplication is GF(2)-linear, so I = k - rank of the truncated uncertainty subspace), brute-force cross-checked to 0 deviation. At the full tap (4 of 8 bits known) the mean surviving information is 0.745154 bits per 4-bit key — NOT zero, because the finite family contains degenerate maps (the identity map with the low half known leaks all k bits; max = 4). The finite-hash-family leak is measured, not averaged away.

## D. the key-rate curve r(p) vs the 1 - h2(q) line, with gap accounting

Rate per sifted bit: r = max_k (k - I_after(k))/8 - h2(q), the W4 reconciliation floor subtracted. Data processing pins (k - I_after)/8 <= h2(eps_E) with equality at k = m (the identity), so the ceiling itself is the measured optimum at toy scale.

| p | q=(1-p)/2 | line 1-h2(q) | I_E = 1-h2(p/2) | measured r | k* | gap to line | certified floor of the gap |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 0.000 | 1.000000000 | 0.000000000 | 1.000000000 | 8 | 0.000000000 | 0.000000000 |
| 0.95 | 0.025 | 0.831339069 | 0.001804121 | 0.829534948 | 8 | 0.001804121 | 0.001804121 |
| 0.9 | 0.050 | 0.713603043 | 0.007225546 | 0.706377497 | 8 | 0.007225546 | 0.007225546 |
| 0.8 | 0.100 | 0.531004406 | 0.029049406 | 0.501955001 | 8 | 0.029049406 | 0.029049406 |
| 0.7 | 0.150 | 0.390159695 | 0.065931945 | 0.324227751 | 8 | 0.065931945 | 0.065931945 |
| 0.6 | 0.200 | 0.278071905 | 0.118709101 | 0.159362804 | 8 | 0.118709101 | 0.118709101 |
| 0.55 | 0.225 | 0.230807171 | 0.151451822 | 0.079355349 | 8 | 0.151451822 | 0.151451822 |
| 0.5 | 0.250 | 0.188721876 | 0.188721876 | -0.000000000 | 8 | 0.188721876 | 0.188721876 |

Full k-sweep 1..8 run at p = 0.9 and p = 0.6 confirms k* = 8: (k - I_after(k)) never exceeds the identity's m*h2(eps_E) — the amplifier buys information collapse (B), not rate, at n = 8; the h2(q) reconciliation floor confiscates first. The measured curve sits where the worst-case attribution puts it: gap to the line exactly Eve's per-bit information (the certified floor), zero only at p = 1. At p = 1/2 (q = 1/4, the full-tap footprint) the measured rate reads 0 to machine precision — the census threshold. NOTE: this curve exceeds the Shor-Preskill-grade 1 - 2*h2(q) line wherever both are positive, because the toy adversary is an instantiation, weaker than the phase-symmetric worst case; no security claim rides on the measured numbers (see Boundary).

| k | (k - I_after)/8 at p=0.9 | at p=0.6 | ceiling h2(eps_E) |
| --- | --- | --- | --- |
| 8 | 0.992774454 | 0.881290899 | 0.992774454 / 0.881290899 |
| 7 | 0.871339241 | 0.802859789 | 0.992774454 / 0.881290899 |
| 6 | 0.748170564 | 0.709050303 | 0.992774454 / 0.881290899 |
| 5 | 0.624096800 | 0.603064774 | 0.992774454 / 0.881290899 |
| 4 | 0.499562269 | 0.488854842 | 0.992774454 / 0.881290899 |
| 3 | 0.374795418 | 0.369619413 | 0.992774454 / 0.881290899 |
| 2 | 0.249912180 | 0.247625259 | 0.992774454 / 0.881290899 |
| 1 | 0.124970654 | 0.124180283 | 0.992774454 / 0.881290899 |

## E. finite-size: the small-block table (m = 4 vs m = 8)

| m | p | eps_E | after k=m/2 | TV family-mixed | r (identity anchor) |
| --- | --- | --- | --- | --- | --- |
| 4 | 0.9 | 0.45 | 0.005848 | 0.007848 | 0.706377497 |
| 8 | 0.9 | 0.45 | 0.003502 | 0.000836 | 0.706377497 |
| 4 | 0.7 | 0.35 | 0.058410 | 0.025048 | 0.324227751 |
| 8 | 0.7 | 0.35 | 0.040448 | 0.002523 | 0.324227751 |

The 4-bit block amplifies the same way at a fifth of the family size; the identity-anchored rate is m-independent (the product-BSC structure cancels), while the surviving information and TV carry the block's finite size. This is the small-block table as data — the reconciliation floor h2(q) on both paths remains exact from W4.

## F. the smuggling audit, run on this report's own rows

- auditRateRow over all 8 curve rows: 8 pass, 0 rejected (a row sitting on the 1-h2(q) line or above the certified-floor gap is a named counterfeit).
- auditUniformityClaim, honest form: pass — collision probability matches the exhaustive census (15/255 = 0.0588235294118 <= 2^-4 = 0.0625000000000, strict)
- forged row demo 1 (measured column replaced by the theoretical line, machine number still the honest one): REJECTED — offense "counterfeit key-rate row (value)".
- forged row demo 2 (machine number itself tampered to sit on the line): REJECTED — offense "counterfeit key-rate row (no gap)".
- forged uniformity demo (family claimed exactly 2^-4-uniform): REJECTED — offense "counterfeit uniformity claim (exactly 2^-k)".

## Boundary

BB84-grade bounded amplification, not Shor-Preskill and not composable: the adversary is the explicit smoothed BSC(eps_E) profile (worst-case footprint attribution) plus the sparse profile — the machine measures THESE, and the all-adversaries statement rides on BB84/BBR88/CW79/ILL89, cited not re-proved. The leftover-hash bound is vacuous at this block size for most k; no composable epsilon is claimed anywhere in this report. The reconciliation syndrome is priced at its Shannon floor in the rate but its exact coupling into Eve's posterior is code-dependent and not modeled. Finite-size and finite-family effects are printed as data (B, C, E), not folded into an error bar.
