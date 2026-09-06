# EXP2 — The causal bound, exhausted

Every deterministic classical causal strategy in both orders enumerated
(shared randomness is a convex mixture — linearity keeps the cap):

| order | strategies | max success |
| --- | --- | --- |
| A ≺ B (all f,g,h functions) | 4096 | 0.750000000000 |
| B ≺ A (all f,g,h functions) | 4096 | 0.750000000000 |

**The cap is exactly 3/4**: max over all 8192 deterministic strategies = 0.750000000000 (256 strategies attain it). Whichever direction the one bit flows, the other half of the game is a blind guess: in A ≺ B, Bob can learn a (win b'=1 always) but Alice cannot see b (win b'=0 half the time) — and vice versa.
