# theory.md — derivations behind the machine-verified claims

## 1. Bucket-brigade addressing as a block-diagonal rotation

A qRAM query on address register (n qubits) plus one bus qubit acts, at the effect
level, as M = diag_a R(x_a) with

  R(x): |0> -> sqrt(1-x)|0> + sqrt(x)|1>,   R(x) completed as the rotation
  [[sqrt(1-x), -sqrt(x)], [sqrt(x), sqrt(1-x)]]

per address a holding value x_a in [0,1]. M is manifestly unitary (direct sum of
rotations); for x_a in {0,1} it is the exact classical read |a>|0> -> |a>|x_a>.
A uniform address superposition plus one query prepares

  (1/sqrt(N)) sum_a |a> (sqrt(1-x_a)|0> + sqrt(x_a)|1>),

whose bus-one probability is exactly mean(x) — the amplitude encoding of the task
stream. Amplitude estimation on the bus measurement then estimates mean(x) with
O(1/eps) queries (EXP3), against O(1/eps^2) Monte Carlo samples.

Error exposure: the bucket brigade routes the bus by writing one routing node per
level — exactly n active nodes per query (Giovannetti-Lloyd-Maccone's headline
property) — while the fanout architecture drives all 2^n - 1 switches. Under
independent per-active-node failure with probability p, query failure is
1 - (1-p)^(active): verified against exhaustive subset enumeration (EXP1-C). The
exposure ratio is 2^n/n, exponential in address length.

## 2. Szegedy search walk and the detection semantics

For a lazy reversible chain P' (laziness removes the bipartite periodicity),
phi_x = sum_y sqrt(p'(y|x)) |x,y> on the edge space. One search step applies
v <- C S R v:

- R = 2 Pi - I with Pi = sum_x |phi_x><phi_x|. The columns phi_x are orthogonal
  because they live on disjoint blocks (x fixed in the first coordinate), so Pi
  is a genuine projector and R is applied blockwise in O(edges).
- S is the flip-flop swap |x,y> -> |y,x> (requires symmetric support: laziness
  guarantees the self-loops).
- C = I - 2 P_M2 phase-flips every edge touching a marked vertex (both
  coordinates) — the "check after move" oracle.

We verified empirically that this ordering detects quadratically on expanders
(K_n: detection ~ sqrt(n) vs LU-exact classical 2(n-1)), on the two-state family
(QT * sqrt(q) -> const ~ 0.85 while classical HT = 2/q), and on the assignment
lattice (CT/QT^2 ~ 2.6-2.9 across 81 -> 729 states). We also verified it LOSES
on the barbell bottleneck (envelope peak ~ 7x classical HT): Szegedy's theorem
is stated for the absorbing-chain quantization with MNRS phase schedules; the
naive marked-flip operator is a different (weaker on bottlenecks) construction.
Both facts are reported.

Classical referee: expected hitting time solves the fundamental-matrix system
(I - Q) tau = 1 over transient states (LU with partial pivoting); closed forms
2(n-1) for lazy K_n (conditioned uniform start) and 2/q for the lazy two-state
family are reproduced exactly. A hand-derivation trap we fell into and the LU
referee corrected: the lazy doubling of hitting times is NOT a general rule
(Path 0-1-2-3-4 from 2 to {0,4}: non-lazy E2 = 4, lazy E2 = 8 — the first-step
system must be re-solved, shortcuts lie).

## 3. Exact QPE amplitude estimation

The Grover iterate on the invariant 2-plane (good axis g, bad axis b) is the
rotation G = R(2 theta), sin^2(theta) = p (verified against full-space Grover
simulation to 2.2e-16). With m phase qubits: after H^m and controlled-G^{x},
the joint state is sum_x [sin((2x+1)theta)|g> + cos((2x+1)theta)|b>] |x> /
sqrt(2^m); the exact inverse QFT on the register yields outcome j with

  p_hat = sin^2(pi j / 2^m),

whose two spectral peaks (from eigenphases +-2theta) both map back to p. The
full outcome distribution is computed in exact complex arithmetic; median error
slopes -1.07 in log2-log2 vs queries (theory -1). MC referee: median error
slopes -0.483 vs samples (theory -1/2). At matched median accuracy 0.2%:
1023 quantum queries vs 32768 classical samples (32x).

## 4. The regret / query ledger separation

Layer definitions (each a different INFORMATION model, not a different algorithm
quality):

- LIVE: the learner observes only the rewards of arms it physically plays.
  Exploration is paid in regret: Lai-Robbins; UCB1 sits on the ln(T) scale
  (EXP4-A medians), ETC-live burns exactly N * sum_i Delta_i (135 in our bank).
- REPLAY-classical: a classical simulator/logs of the environment can be
  sampled freely; exploration costs queries (Theta(1/eps^2) by Hoeffding), not
  regret. Regret ~ 0 (commit error only).
- REPLAY-quantum (qRAM premise): same zero regret; amplitude estimation prices
  exploration at Theta(1/eps) queries. Measured classical/quantum query ratios
  2.2 -> 12.3 as Delta shrinks 0.20 -> 0.025.

So the "tear in the regret bound" decomposes honestly: moving LIVE -> REPLAY
removes regret from the ledger (an information-model change available to
classical algorithms too), and inside REPLAY the quantum scheduler wins the
quadratic query law. The tear is real, conditional, and precisely located.

Adversarial wall: with bandit feedback on an oblivious uniform-random reward
stream (the Auer et al. minimax construction), any policy's regret is
information-limited. We machine-check the sharpest form of "compute does not
help": serving Exp3's inner argmax by Durr-Hoyer search yields bit-identical
decision sequences (10/10 seeds) and hence identical regret to the digit — the
Omega(sqrt(kT)) wall survives any speedup of the compute layer.

## 5. Online matching: information caps vs compute

Cascade adversary (v ~ {u_1,u_2} then w ~ {u_1}, per pair): deterministic
lowest-index greedy matches exactly half (machine-verified: ratio 0.5000 across
sizes 8/16/64 pairs); uniform-tie greedy and RANKING sit at 3/4 (hand-derived
and verified). Worst-case caps greedy 1/2, RANKING 1 - 1/e are cited theorems;
no per-instance dominance between greedy-uniform and RANKING exists (our n=16
bank has RANKING trailing on average — reported).

The quantum layer: RANKING's per-arrival inner argmin over n workers served by
Durr-Hoyer search. Decision rule identical; bounded-error misses reported per
bank; read ledger drops as ~sqrt(n) up to the Durr-Hoyer log factor (read ratio
1.28x at n=16 growing with n). Competitive ratios — information-theoretic
caps — are untouched: quantum buys queries, not match quality.
