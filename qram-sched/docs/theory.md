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

## 5a. The KVV tight instances, executed (v0.2.0)

The v0.1.0 boundary "tight instances not reproduced" is closed. The hard-input
distribution D_n and the exact finite-n values follow Feige
(arXiv:1812.11774, Sec. 1.1, Thm 6/14, Cor. 21), which we treat as the
reproducible execution of KVV STOC 1990:

- Construction. MonotoneG: workers v_1..v_n; arrival u_j is adjacent to the
  nested suffix {v_j..v_n}; the unique perfect matching is (u_j, v_j).
  D_n = MonotoneG under a uniformly random worker relabeling tau.
- Exact value. E[RANKING on D_n] = a(n)/n! with a(n) = (n+1)! - d(n+1) - d(n)
  (derangement numbers) = (1-1/e)n + 1 - 2/e + O(1/n!). Machine side: three
  INDEPENDENT exact kernels — the BigInt derangement formula, exhaustive
  enumeration of all n! rank permutations (n <= 9), and a subset DP for
  greedy-uniform over the suffix structure (n <= 24) — agree to 1e-15, and
  reproduce Feige's published table a(1..7) = 1, 3, 13, 67, 411, 2921, 23633
  and the additive constant 1 - 2/e = 0.2642 at every probed n in 8..20.
- Lemma 13, executed. KVV: every two greedy algorithms earn the same
  expectation on D_n. The DP/formula agreement IS that statement run on the
  machine: greedy-uniform and RANKING coincide on D_n at a(n)/n! (far above
  greedy's separate worst-case cap 1/2 — the caps are per-problem-class
  statements, and D_n is not greedy's tight family).
- Distributional nature. greedy-lowest matches MonotoneG PERFECTLY (each u_j
  takes v_j; ratio 1.0) and greedy-highest collapses to exactly n/2 there;
  averaging over D_n members drags both onto a(n)/n! (MC within 3e-3 at
  n=16, K=2000). Tightness lives in the distribution, not in a member.
- Deterministic 1/2, exactly. The phase adversary (Feige Sec. 1 sketch): the
  first n/2 arrivals see all workers; the rule's own phase-1 matches form S;
  the last n/2 arrivals see exactly S and all fail. Built in code for both
  tie-break rules at n = 8..128: OPT = n (Kuhn), greedy = n/2 to the edge.
- Quantum census on the tight stage: linear-rule RANKING means equal
  a(n)/(n! n) within MC error at n = 16..1024; the Durr-Hoyer variant stays
  on the cap within its counted misses; read ratios 1.22x -> 6.20x. The
  separation restates itself precisely where it is hardest.

## 5b. Ancillary v0.2.0 extensions

- qRAM insertion-cost metering (EXP1-D): charging the bucket-brigade at its
  own ledgers (write = n_b activations, query = n_b; classical array op = 1),
  one AE task at eps = 0.01 buys 3.6x-12x metered activations vs the
  Hoeffding sample count; the insertion bill N·n_b forces break-even task
  counts T* growing with memory (T* = 1 at n_b <= 10, T* >= 1493 at n_b = 20
  for eps = 0.01). The metering philosophy is Jaques-Rattew (arXiv:2305.10310,
  Quantum 9, 1922 (2025)): qRAM speedups are amortized-insertion speedups.
- Barbell-family census (EXP2-D'): chains of k K_m cliques (k = 2..4) keep the
  honest negative — envelope peak beyond the classical hitting time at every
  chain length (peak/HT 2.9-7.4). The naive marked-flip operator loses on the
  whole bottleneck family.
