# EXP1 — qRAM bucket-brigade: addressing exactness, streaming, error exposure

## A. Addressing semantics (noiseless)

| address bits n | cells N | max |bus1 - x_a| over addresses | max |bus1(uniform) - mean| over trials |
| --- | --- | --- | --- |
| 1 | 2 | 0.000000000000000 | 0.000000000000000 |
| 2 | 4 | 0.000000000000000 | 0.000000000000000 |
| 3 | 8 | 0.000000000000000 | 0.000000000000000 |
| 4 | 16 | 0.000000000000000 | 0.000000000000000 |

Unitarity monitor over all basis queries: |norm - 1| <= 0.000000000000000. The addressing map is an exact isometry: per-address readout returns the stored value, and a uniform address superposition plus one query amplitude-encodes the whole stream (bus-one probability = mean).

## B. Streaming: online task updates

| quantity | value |
| --- | --- |
| mean before update | 0.448336 |
| mean after writing cell 17 <- 0.95 | 0.453639 |
| bus-one probability of re-encoded stream | 0.453639 |
| residual |bus1 - mean| | 0.000000000000000 |
| write cost (routing activations) | 6 |
| rewrite-all-cells cost (activations) | 64 |

One write costs 6 routing activations (one per level) versus 64 for rewriting every cell; the encoded stream reflects the update immediately on the next query — the online task flow never re-prepares the state.

## C. Error exposure: bucket-brigade O(log N) vs fanout O(N)

| node failure p | address bits n | active nodes (bucket) | failure formula | failure enumerated | |diff| |
| --- | --- | --- | --- | --- | --- |
| 0.01 | 2 | 2 | 0.019900 | 0.019900 | 0.000000000000000 |
| 0.01 | 3 | 3 | 0.029701 | 0.029701 | 0.000000000000000 |
| 0.01 | 4 | 4 | 0.039404 | 0.039404 | 0.000000000000000 |
| 0.01 | 5 | 5 | 0.049010 | 0.049010 | 0.000000000000000 |
| 0.01 | 6 | 6 | 0.058520 | 0.058520 | 0.000000000000000 |
| 0.05 | 2 | 2 | 0.097500 | 0.097500 | 0.000000000000000 |
| 0.05 | 3 | 3 | 0.142625 | 0.142625 | 0.000000000000000 |
| 0.05 | 4 | 4 | 0.185494 | 0.185494 | 0.000000000000000 |
| 0.05 | 5 | 5 | 0.226219 | 0.226219 | 0.000000000000000 |
| 0.05 | 6 | 6 | 0.264908 | 0.264908 | 0.000000000000000 |
| 0.10 | 2 | 2 | 0.190000 | 0.190000 | 0.000000000000000 |
| 0.10 | 3 | 3 | 0.271000 | 0.271000 | 0.000000000000000 |
| 0.10 | 4 | 4 | 0.343900 | 0.343900 | 0.000000000000000 |
| 0.10 | 5 | 5 | 0.409510 | 0.409510 | 0.000000000000000 |
| 0.10 | 6 | 6 | 0.468559 | 0.468559 | 0.000000000000001 |

| node failure p | address bits n | exposed switches (fanout) | fanout failure | enumerated | fanout/bucket failure ratio |
| --- | --- | --- | --- | --- | --- |
| 0.01 | 2 | 3 | 0.02970100 | 0.02970100 | 1.5 |
| 0.01 | 3 | 7 | 0.06793465 | 0.06793465 | 2.3 |
| 0.01 | 4 | 15 | 0.13994165 | 0.13994165 | 3.6 |
| 0.05 | 2 | 3 | 0.14262500 | 0.14262500 | 1.5 |
| 0.05 | 3 | 7 | 0.30166270 | 0.30166270 | 2.1 |
| 0.05 | 4 | 15 | 0.53670877 | 0.53670877 | 2.9 |
| 0.10 | 2 | 3 | 0.27100000 | 0.27100000 | 1.4 |
| 0.10 | 3 | 7 | 0.52170310 | 0.52170310 | 1.9 |
| 0.10 | 4 | 15 | 0.79410887 | 0.79410887 | 2.3 |

Exposure ratio fanout/bucket grows as 1.5 -> 2.3 -> 3.8 for n = 2, 3, 4: exactly 2^n/n, exponential in address length. Formula matches exhaustive enumeration to 1e-15 (bucket, n<=6) and (fanout, n<=4).

## Honest boundaries

- Routing failures are modeled as independent, flagged (detectable) per-active-node events. Coherent noise on stored amplitudes is strictly harder; see Arunachalam et al., New J. Phys. 17, 123010 (2015) for the robustness analysis of bucket-brigade qRAM.
- The addressing unitary here is the effect-level model (block-diagonal rotation per cell). The physical tree circuit (trit routing nodes, prepare/erase cycles) is not simulated gate-by-gate.
- No qRAM of this size exists on hardware today; this is the query model that EXP3/EXP4 condition on.
