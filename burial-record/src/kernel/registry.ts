/**
 * The registry — the burial record as data.
 *
 * Twenty-two batches of error logs, transcribed from the daily memory files
 * (memory/2026-09-05.md, memory/2026-09-06.md) where they were buried as
 * prose — the twenty-second being this repo's own delivery log. Every error carries two columns — the wrong assertion and the
 * correction — because that is the ledger's own discipline applied to
 * ourselves: a number never travels without its cost, and an error never
 * travels without its fix.
 *
 * Anchors are dual: the repo the batch happened in (must exist on disk, B1)
 * and the memory file + heading that records it (must resolve, B4). The date
 * must be the anchor file's own date (B6) — a batch cannot predate or outlive
 * its own evidence.
 */

export const CATEGORIES = [
  "conjugation",
  "dimension-slot",
  "wrong-object",
  "anchor-blindspot",
  "bogus-comparison",
  "citation-drift",
  "toolchain",
  "statistics",
  "machine-overruled",
  "process",
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface BurialError {
  /** what was wrongly asserted or practiced, as it stood before the catch */
  readonly wrong: string;
  /** the correction, as recorded in the daily log */
  readonly right: string;
  readonly category: Category;
}

export interface SourceAnchor {
  /** workspace-relative memory file, e.g. memory/2026-09-05.md */
  readonly file: string;
  /** heading substring that must appear in that file */
  readonly heading: string;
}

export interface BurialBatch {
  /** 1..N continuous — the count may not drift (B3) */
  readonly batch: number;
  /** workspace directory the batch happened in */
  readonly repo: string;
  /** the date of the memory file that records it */
  readonly date: string;
  readonly context: string;
  readonly source: SourceAnchor;
  readonly errors: readonly BurialError[];
}

export const DECLARED_TOTAL_BATCHES = 47;
export const DECLARED_TOTAL_ERRORS = 284;

export const BURIAL_RECORD: readonly BurialBatch[] = [
  {
    batch: 1,
    repo: "ds_extracted/ds",
    date: "2026-09-05",
    context: "platform audit repair (P0x1 / P1x15 + antipattern clusters, ~60 items)",
    source: { file: "memory/2026-09-05.md", heading: "审计修复 + 推送" },
    errors: [
      {
        wrong: "moduleResolution node10 is fine: extensionless relative imports compile, so dist will load",
        right: "tsc emits them verbatim and Node ESM cannot load dist — NodeNext + explicit .js suffixes on 141 imports; a dist smoke step in CI catches it (audit item I6's prediction came true)",
        category: "toolchain",
      },
      {
        wrong: "tests that lock in audited-defective semantics (precheck-reject = failed+throw; cancelled counted as failed) must be preserved as-is",
        right: "update the assertion together with the semantics and note the change — never route around the test",
        category: "process",
      },
      {
        wrong: "a synchronous API can be de-blocked in place with Atomics.wait",
        right: "the sync signature admits only a hard total-budget ceiling + contract doc; the real fix (async) is a breaking change deferred to Wave 4",
        category: "process",
      },
      {
        wrong: "callers always pass coupling keys as (q1<q2); the reversed order can be ignored",
        right: "q1>q2 order silently dropped the coupling — normalize the key at the boundary and both the drop and the doubt die together",
        category: "process",
      },
      {
        wrong: "deferred audit items (fitGrid refit, global seed, Date DTO) are loose ends to forget",
        right: "defer deliberately and record why: the refit needs benchmark evidence, the global seed breaks the reproducibility contract",
        category: "process",
      },
    ],
  },
  {
    batch: 2,
    repo: "ds_extracted/ds",
    date: "2026-09-05",
    context: "P2/P3 second-round closure (commits 96c377e + 9c821aa)",
    source: { file: "memory/2026-09-05.md", heading: "关键经验（第二轮）" },
    errors: [
      {
        wrong: "verify an expm1 refactor by continuity across beta",
        right: "assert against the analytic truth K = -ln(1-d(1+(1-a)/a)/(1-q0))/beta — K is proportional to 1/beta and discontinuous to begin with",
        category: "bogus-comparison",
      },
      {
        wrong: "silently ignore demand classes the scheduler cannot implement",
        right: "declare the four classes at type level, implement one, reject the rest at entry — unimplementable hard constraints fail loudly",
        category: "process",
      },
      {
        wrong: "Promise.race cancels the runaway command",
        right: "race only drops the result; the abort must pierce executor -> AbortController -> argv signal -> process tree (60s sleeper reaped in 415ms)",
        category: "wrong-object",
      },
      {
        wrong: "TS-Python parity requires running both toolchains in CI",
        right: "embed shared SELF_CHECK vectors in both artifacts: the Python runtime asserts at run time, the CI test reads them back — drift turns both sides red",
        category: "process",
      },
      {
        wrong: "pass {signal: undefined} into an optional {signal?:}",
        right: "exactOptionalPropertyTypes forbids explicit undefined — construct by conditional key spread",
        category: "toolchain",
      },
      {
        wrong: "hand-edited code survives prettier and lint as written",
        right: "run format after batch edits; prefer-for-of false positives on genuinely hot loops get a disable comment with rationale",
        category: "toolchain",
      },
      {
        wrong: "python3 is the Python on this Windows box",
        right: "python3 is the WindowsApps stub; python is the real interpreter",
        category: "toolchain",
      },
      {
        wrong: "a failed push means the network",
        right: "two distinct forms: 443 timeout (retry 2-3x, 20s apart) and non-fast-forward (fetch + rebase)",
        category: "toolchain",
      },
    ],
  },
  {
    batch: 3,
    repo: "ft-qaoa",
    date: "2026-09-05",
    context: "logical-layer p=128 QAOA: monotonicity + resource estimator + decode scheduler",
    source: { file: "memory/2026-09-05.md", heading: "关键经验（第三批）" },
    errors: [
      {
        wrong: "golden-section search finds the global optimum of the ramp-T objective",
        right: "the landscape oscillates — pure golden section locked 4/7 instances at <C> ~ 0; coarse log-grid global scan first, then local refine",
        category: "wrong-object",
      },
      {
        wrong: "single-level T-distillation (eps_T=1e-8) suffices for deep circuits",
        right: "its floor of 3.2e-6 x T-gates fails every deep budget (the all-FAIL table); two-level 1e-12 is the first meaningful point — a route conclusion, written into theory",
        category: "process",
      },
      {
        wrong: "exactOptionalPropertyTypes bites rarely",
        right: "third bite in this workspace: optional properties cannot carry explicit undefined — conditional spread",
        category: "toolchain",
      },
      {
        wrong: "-x ** 2 parses as -(x^2)",
        right: "unary minus may not neighbor ** in JS — write -(x**2); esbuild's 'Unexpected **' is the symptom",
        category: "toolchain",
      },
      {
        wrong: "p=0 gives <C> exactly 0",
        right: "it is ~1e-17 — (1/sqrt(dim))^2 binary rounding; assert with 1e-12 tolerance",
        category: "statistics",
      },
    ],
  },
  {
    batch: 4,
    repo: "nonstoq-anneal",
    date: "2026-09-05",
    context: "X-basis diagonal engine + stoquasticity verifier + imaginary-time projection",
    source: { file: "memory/2026-09-05.md", heading: "关键经验（第四批）" },
    errors: [
      {
        wrong: "put the maximize-convention Ising objective straight into the Hamiltonian",
        right: "adiabatic following tracks the LOWEST eigenvalue: H_P := -C must be declared explicitly (measured r -> -1 before the fix)",
        category: "conjugation",
      },
      {
        wrong: "imaginary-time projection from |+>^n reaches the ground state",
        right: "|+>^n is a single point in the X basis and can have ZERO overlap with the target space (the k>2*Gamma XX driver is exactly that) — start from a seeded generic real vector; fix a global sign convention before measuring sign purity",
        category: "wrong-object",
      },
      {
        wrong: "the annealer can always prepare |+>^n as the driver state",
        right: "for k>2*Gamma the driver's own ground state differs from |+>^n — the engine must offer driver-ground initialization",
        category: "machine-overruled",
      },
      {
        wrong: "a push retry loop (for do push && break || sleep; done) reports failure",
        right: "it returns exit code 0 after three failures — judge pushes by git status -sb, never by exit code",
        category: "toolchain",
      },
      {
        wrong: "prettier format:check piped through tail propagates failure",
        right: "the pipe eats the non-zero exit — run it standalone before committing",
        category: "toolchain",
      },
    ],
  },
  {
    batch: 5,
    repo: "nonstoq-anneal",
    date: "2026-09-05",
    context: "SSE worldline sampler + direct <sign> measurement (gap 1)",
    source: { file: "memory/2026-09-05.md", heading: "关键经验（第五批" },
    errors: [
      {
        wrong: "SSE stationary weights need no slot combinatorics",
        right: "the same ordered sequence occupies C(M,n) slots — the weight must carry 1/C(M,n); omitting it biased <n> sixfold (<n>-vs-exact is the bisection locator: offset -> diagonal update, sign-only offset -> type move)",
        category: "statistics",
      },
      {
        wrong: "single-edge string flips move between N_xx sectors",
        right: "they preserve GF(2) parity — cross-sector moves need the edge + two-sites triple flip, and odd-key strings of the flip involution are rejected outright (the initial-state flip cannot save a closure)",
        category: "dimension-slot",
      },
      {
        wrong: "accept 0/0 as infinity when the old weight vanishes",
        right: "unconditional acceptance admits closure-breaking configurations with wOld=0 — require wNew>0",
        category: "statistics",
      },
      {
        wrong: "rollback with the inverted ternary is harmless",
        right: "the flip map is an involution; the wrong ternary silently rewrites key 2b+2 as 2b+3 — an ADJACENT key",
        category: "dimension-slot",
      },
      {
        wrong: "square the matrix and take the trace for Trotter Z",
        right: "normalize per level and accumulate in log scale; remember the dtau(1-s) driver factor — missing it cost four orders of magnitude",
        category: "statistics",
      },
      {
        wrong: "a fixed block width gives honest MC error bars",
        right: "sector autocorrelation outlasts any fixed width — adaptive block width + multi-seed spread; and judge tests must pick fast-mixing points (slow-mixing deviation is physics, not bug)",
        category: "statistics",
      },
    ],
  },
  {
    batch: 6,
    repo: "nonstoq-anneal",
    date: "2026-09-05",
    context: "catalyst testbed + matrix-free Lanczos spectrometer (gap 3)",
    source: { file: "memory/2026-09-05.md", heading: "关键经验（第六批" },
    errors: [
      {
        wrong: "reproduce a paper from memory of its equations",
        right: "three memory deviations (p=3 is the paper's own counterexample; the XX coefficient sits on the s side; the path is two-parameter) derailed two exploratory implementations — fetching the original ended the guessing in 30 seconds",
        category: "citation-drift",
      },
      {
        wrong: "a fixed s-grid resolves the first-order avoided crossing",
        right: "the valley's width is ~ the gap itself — coarse scan then local golden section, or the grid steps over the valley wholesale",
        category: "wrong-object",
      },
      {
        wrong: "Lanczos lambda_1 is 'the first excited level'",
        right: "single-vector Krylov contributes one direction per eigenspace: lambda_1 is the first level OUTSIDE the manifold — exactly the annealing-gap semantics; judges compare against the degeneracy-resolved dense spectrum",
        category: "wrong-object",
      },
      {
        wrong: "full-space Lanczos converges at k = dim - 1",
        right: "T must be full rank k = dim for machine-precision exactness",
        category: "dimension-slot",
      },
      {
        wrong: "N*m_x^2 for the fully-connected XX term is normalization-free",
        right: "N*m_x^2 = (2/n) * sum_{i<j} x_i x_j + 1 — the per-pair coupling scales with n",
        category: "dimension-slot",
      },
      {
        wrong: "a negative operational result is a failure to hide",
        right: "negative results are deliverables when falsifiable, judged, and attributed (catalyst success 0.24-0.53x baseline across variants, reported as-is)",
        category: "process",
      },
    ],
  },
  {
    batch: 7,
    repo: "nonstoq-anneal",
    date: "2026-09-05",
    context: "DMRG scaling + de-signing theorem + hardware profile (gaps 2/4/5)",
    source: { file: "memory/2026-09-05.md", heading: "关键经验（第七批" },
    errors: [
      {
        wrong: "MPO key-completion terms live at station i",
        right: "the (1->3) completion belongs at station i+1 — alpha-through-ZZ-all-zero located it in seconds; per-term micro-judges (n=1, n=2 single-term energies) are the fastest locator",
        category: "dimension-slot",
      },
      {
        wrong: "absorb environments with =",
        right: "the four w-channels overwrite each other and the contraction collapses to identically 0 — accumulation must be +=",
        category: "dimension-slot",
      },
      {
        wrong: "naive nested contraction with in/out spins as they come",
        right: "the four-step matvec (right env -> W2 -> W1 -> left env) is 100x faster; q.s is the input and q.sp the output — do not swap them",
        category: "dimension-slot",
      },
      {
        wrong: "Perron-Frobenius means 'all amplitudes non-negative'",
        right: "DMRG's global sign is arbitrary — the test is 'sampled amplitudes single-sign'",
        category: "wrong-object",
      },
      {
        wrong: "my de-signing analysis: X and XX are gauge-invariant, odd cycles are the obstruction",
        right: "sz sx sz = -sx: the gauge maps X -> eX and XX -> eeXX — ANY k>0 XX edge makes the sign irreducible (sharper than 'odd cycles'); the dense-matrix judge vetoed two versions of my own test expectations and the final theorem is stronger than the initial claim",
        category: "machine-overruled",
      },
    ],
  },
  {
    batch: 8,
    repo: "ent-sched",
    date: "2026-09-05",
    context: "entanglement distribution scheduling: round engine + ERS strategy",
    source: { file: "memory/2026-09-05.md", heading: "关键经验（第八批" },
    errors: [
      {
        wrong: "purify the raw BBPSSW output directly",
        right: "one purification round leaves a non-Werner state (error concentrated in the Z sector) — measured F regressed 0.884 -> 0.850 until twirling every round; and twirl-fixing Phi+ holds only for real rotations (complex ones need the Pauli frame: 'the S3 label permutation fixing Phi+' is a composite action, not the rotation group)",
        category: "wrong-object",
      },
      {
        wrong: "<H(x)H, Ry(pi/2)(x)Ry(pi/2)> should be a decent twirling group",
        right: "it fixes Psi- and is non-transitive; adding K=SH goes dense beyond cap — the judge's twirl is the Bell-basis six-permutation average",
        category: "machine-overruled",
      },
      {
        wrong: "dedupe group elements by normalizing the first entry of a",
        right: "normalize by the complex ratio b0/a0 — otherwise e^{i*theta}I tests unequal to I and the closure never closes",
        category: "conjugation",
      },
      {
        wrong: "purification ladder economics is monotone in effort",
        right: "three machine-found laws: the mixed-purification fixed point (F0=0.85 caps ~0.909); champion grazing needs a MIN_GAIN threshold + bottom-up fHi fusion; champion + 2 working slots is the minimal 2^k ladder (3 slots saturate)",
        category: "machine-overruled",
      },
      {
        wrong: "greedy interval tiling in id order",
        right: "short segments grab by id and evict the only long cover — interval exact-cover DP; non-adjacent cascade joints merge in the same round",
        category: "wrong-object",
      },
      {
        wrong: "sub-threshold full pairs are the engine's business",
        right: "deliver-or-hold is a POLICY decision; asap's zero delivery is the post-warmup steady state of the frozen deadlock — read the attempts counter to see it",
        category: "process",
      },
      {
        wrong: "the key-rate collapse sits at n/p vs T2",
        right: "it sits at tiling-wait x T2 decay — the phase diagram's true collapse locus",
        category: "wrong-object",
      },
    ],
  },
  {
    batch: 9,
    repo: "quantum-mech",
    date: "2026-09-05",
    context: "quantum mechanism design: DSIC conservation + privacy + entangled collateral",
    source: { file: "memory/2026-09-05.md", heading: "关键经验（第九批" },
    errors: [
      {
        wrong: "Im(v v+) with the conjugate on the left factor",
        right: "v_i * conj(v_j) has imaginary part b*c - a*d; inverted, EVERY real-vector anchor is immune — complex anchors (random complex pure-state rebuild judge) must be in place from the first batch",
        category: "anchor-blindspot",
      },
      {
        wrong: "hand-track Jacobi rotation handedness through the accumulation",
        right: "values come from the Jacobi diagonal (always right); vectors from block inverse iteration + cluster-block orthogonalization + a rebuild judge — convention-free by construction",
        category: "conjugation",
      },
      {
        wrong: "inverse-iteration shift eps = gap/2 splits the clusters",
        right: "the midpoint amplifies both clusters equally (measured 2 vs 2, no convergence) — eps must be far below gap (gap/16, 12 iterations)",
        category: "statistics",
      },
      {
        wrong: "partial-trace strides from the input space",
        right: "kept/measured strides must be recomputed in the OUTPUT space — input strides silently transpose (the W-state reduction wrote |01> into |10>; GHZ/Bell all-diagonal, immune)",
        category: "anchor-blindspot",
      },
      {
        wrong: "detection rate is detection rate",
        right: "per-bid vs per-bit counting, qubits-per-run = bidders x m, k=min(2^m,4) dilutes flips with payload-free high bits — the '0.167 bug' was bookkeeping",
        category: "statistics",
      },
      {
        wrong: "search 20k random states for the 1/sqrt(2) double-mortgage ceiling",
        right: "random search reached 0.658; the analytic balanced family touches exactly 1/sqrt(2) at x=1/2 — constructive families before random search",
        category: "process",
      },
      {
        wrong: "any tight instance set demonstrates first-price underbidding",
        right: "the demo needs slot-0 + a strict price gap (ties-to-low-index lose slot-1) — 'mathematically fine but demonstration-powerless' sets get rebuilt",
        category: "process",
      },
      {
        wrong: "Bell fidelity and concurrence tell one story at the optimum",
        right: "GHZ attains double-mortgage Bell fidelity (1/2, 1/2); the concurrence-balanced family (x=1/2) has LOWER fidelity there — two metrics, two optima, two stories",
        category: "wrong-object",
      },
    ],
  },
  {
    batch: 10,
    repo: "qverify",
    date: "2026-09-05",
    context: "delegated-computation quantum self-verification: blindness + traps + rigidity",
    source: { file: "memory/2026-09-05.md", heading: "关键经验（第十批" },
    errors: [
      {
        wrong: "<+theta|Y|+theta> = 0",
        right: "it is ±sin(theta) — the sign error produced a fake 'Y component 100% detectable' formula that self-consisted on X/Z anchors; random-channel cross-examination killed it, and the trap acceptance corrected to a constant 5/6 (cleaner than the fake theta-dependence)",
        category: "anchor-blindspot",
      },
      {
        wrong: "k=1 anchors vet the Kraus expansion",
        right: "the divisor over-counted kraus: k=1 is immune (divide by 1), k=4 random channels exposed a 4x deviation — multi-Kraus batteries or nothing",
        category: "anchor-blindspot",
      },
      {
        wrong: "measure in the Y basis by applying U",
        right: "the measurement rotation is R = U-dagger; H is self-adjoint so X/Z all passed while every complex basis was wrong — real anchors are immune to conjugate-side bugs (batch 9 recurring; the complex-phase makeTarget caught it)",
        category: "anchor-blindspot",
      },
      {
        wrong: "CZ rho CZ flips both quadrants touching 11",
        right: "it flips 'exactly ONE side in the 11 quadrant' ((3,3) is (+1)(-1)(-1)); forward and mirror errors cancelled at lambda=0 — depolarizing admixture exposed it (theory 0.925 vs measured 0.9108); symmetric-masking bugs demand asymmetric-path tests",
        category: "anchor-blindspot",
      },
      {
        wrong: "(1,0) of -i(xX + yY + zZ) equals conj of (0,1)",
        right: "it is y - ix — write closed-form matrices element by element; 'symmetry' is not a derivation",
        category: "conjugation",
      },
      {
        wrong: "projected gradient descent terminates on the sphere",
        right: "project-back each step always micro-improves -> 14s infinite loops; sweep cap + stagnation counter",
        category: "statistics",
      },
      {
        wrong: "grind the compass search until the symmetric double cloner is found",
        right: "the A/B budget interlock fails Cauchy-Schwarz twice — stop-loss: the exact contraction channel {sqrt(3/4) I, sqrt(1/12) sigma} + Stinespring complement replaces the construction; the BH double cloner demotes to a cited boundary",
        category: "process",
      },
      {
        wrong: "Werner and isotropic states under I/4 mixing behave alike",
        right: "PPT thresholds 1/3 vs 1/2; T = F*diag gives S = 2*sqrt(2)*F cleanly — align conventions with the literature before writing anchors",
        category: "conjugation",
      },
      {
        wrong: "hand-written markdown templates through python heredocs",
        right: "backticks and unicode break — Edit tool or single-line replace",
        category: "toolchain",
      },
      {
        wrong: "the diagnostic script is the trusted side",
        right: "my hand-computed CZ flipped rows only — the 'theory' was the bug; verify the hand-calculation path itself before cross-examining the machine",
        category: "process",
      },
    ],
  },
  {
    batch: 11,
    repo: "qram-sched",
    date: "2026-09-05",
    context: "qRAM-accelerated online scheduling: walks + AE + regret/query ledger separation",
    source: { file: "memory/2026-09-05.md", heading: "关键经验（第十一批" },
    errors: [
      {
        wrong: "Szegedy's search step is whatever unitary pairs the flip with the diffusion",
        right: "the working convention is C.S.R (oracle postposed, double-coordinate flip): first-coordinate single flip, preposed flip, and absorbing columns all fail to search (254 steps, no 0.25 on K_n); the absorbing variant is non-unitary on the support-restricted edge space (norms 0.97-0.99)",
        category: "conjugation",
      },
      {
        wrong: "the walk implementation is broken (when norms decay)",
        right: "the TEST INPUT was broken — the 2-state family missed the 1-q stay probability: columns non-normalized, R not a reflection; pre-verify input row sums before blaming the algorithm",
        category: "wrong-object",
      },
      {
        wrong: "lazy doubling: E2 doubles for every graph",
        right: "path graph 0-1-2-3-4 with targets {0,4}: non-lazy E2 = 4 (hand-missed the +1 from E1), lazy E2 = 8 — the x2 holds only for K_n; the LU judge corrected two versions of my hand anchor consecutively",
        category: "machine-overruled",
      },
      {
        wrong: "first-passage time under a single threshold measures detection",
        right: "the barbell's early transient (2-8 steps) already wipes 0.25 at prob 0.26-0.50 — the honest metric is the envelope peak; dual-report transient + envelope",
        category: "statistics",
      },
      {
        wrong: "report the mean over 20 seeds",
        right: "one wrong-terminal UCB1 seed contributes T*Delta = 2000 regret and distorts the mean — median + wrong-terminal count, reported separately",
        category: "statistics",
      },
      {
        wrong: "adversarial regret is non-negative",
        right: "regret vs the best FIXED arm can be -9: dynamic strategies are not dominated (r[0,0]=r[1,1]=1) — assert what the quantity is, not its sign",
        category: "wrong-object",
      },
      {
        wrong: "RANKING dominates greedy-uniform instance-wise",
        right: "no such theorem exists — 1/2 and 1-1/e are worst-case caps, and a random sparse bank at n=16 had RANKING lower by 0.018; the invented dominance died on test data",
        category: "bogus-comparison",
      },
      {
        wrong: "compare the sum of per-seed ratios with a tolerance",
        right: "|sum rr - sum gr| <= 0.05 passed over the SUM of 40 ratios (0.22) — divide before comparing",
        category: "bogus-comparison",
      },
      {
        wrong: "the separation margin is physics",
        right: "the 1-cell (2*pi/2^m) margin is a design knob: Delta=0.2 gave 2/20 wrong commits, 1.5 cells gave zero — report policy shape and complexity law separately",
        category: "statistics",
      },
    ],
  },
  {
    batch: 12,
    repo: "bqp-map",
    date: "2026-09-05",
    context: "scheduling complexity atlas: reductions / upper / lower / witness layers",
    source: { file: "memory/2026-09-05.md", heading: "关键经验（第十二批" },
    errors: [
      {
        wrong: "write k*/sqrt(N) inside a block comment",
        right: "'*/' closes the comment early — it exploded twice (exp2 header + an entries string); write k* / sqrt with spaces",
        category: "toolchain",
      },
      {
        wrong: "the max off-diagonal of the ZZ Hamiltonian is the -Gamma entry",
        right: "plain max returns 0 — the matrix is diagonal with mostly-zero off-diagonals; the anchor lives on the NONZERO support (positive side unaffected: positives dominate zero)",
        category: "wrong-object",
      },
      {
        wrong: "one ascending comparator sorts Johnson's groups",
        right: "the second group is p2 DESCENDING — the permutation judge caught the reversal; check sort direction group by group",
        category: "dimension-slot",
      },
      {
        wrong: "BBHT costs ~35*sqrt(N), close enough",
        right: "cap = ceil(sqrt(N)), lambda = 8/7, cap-interval [cap/2, cap), 8 retries -> ~13*sqrt(N) with 100% hits — the inner search's FAILURE path (declaring no-solution) dominates the query account",
        category: "statistics",
      },
      {
        wrong: "promise instances are plentiful — assert > 10",
        right: "(m=2, B=20) has exactly 4 (nondecreasing sequences with fixed sum = partition count) — expectations by arithmetic, not vibes",
        category: "process",
      },
      {
        wrong: "the advantage factor is a constant",
        right: "it grows ~1.27*sqrt(N) — assert at > sqrt(N)/4 scale, not as a fixed multiple",
        category: "wrong-object",
      },
      {
        wrong: "one resolve root fits all",
        right: "in-repo files (theory.md) use repoRoot, sibling prototypes workspaceRoot (one MORE level up) — one resolve, two semantics",
        category: "toolchain",
      },
      {
        wrong: "round the measured slope to the theorem's 0.5",
        right: "the measured 0.575 is implementation overhead, not physics — report it with the source explained, neither cosmetic nor passed off as 0.5",
        category: "process",
      },
    ],
  },
  {
    batch: 13,
    repo: "switch-sched",
    date: "2026-09-05",
    context: "indefinite causal order theorem layer (quantum switch)",
    source: { file: "memory/2026-09-05.md", heading: "关键经验（第十三批" },
    errors: [
      {
        wrong: "bake 1/sqrt(2) into the switch isometry M",
        right: "M is controlled routing with no factor — the superposition comes from the input control |+>; baked in, M+ M = (1/2) I and the isometry certificate vetoed it on the spot",
        category: "conjugation",
      },
      {
        wrong: "assign environment slots by execution order",
        right: "slot a is ALWAYS A's environment and slot b B's — ordering them by execution silently destroys the cross-branch coherence (the replacer-control judge returned |+><+| instead of (1/2) I)",
        category: "dimension-slot",
      },
      {
        wrong: "I (x) U as mMul(identity, U)",
        right: "tensor product is kron, not matrix multiplication — both 'look runnable' at 2x2; the shape error is the only warning",
        category: "dimension-slot",
      },
      {
        wrong: "copy Weyl Kraus operators elementwise",
        right: "the copy drops the imaginary part — d=2 Pauli (all real) is immune, d=3 complex phases expose it (batch 9 recurring); multi-dimensional anchors from the first batch",
        category: "anchor-blindspot",
      },
      {
        wrong: "replacer Kraus operators carry amplitude v_j",
        right: "the Kraus is |v><j| with amplitude exactly 1 — the v_j factor cut trace preservation to 2/3; every hand-built Kraus family passes a sum K+ K = I self-check",
        category: "conjugation",
      },
      {
        wrong: "one matched deception pair refutes all fixed-order simulators",
        right: "coherent control makes global phase visible (kickback) — each strategy class needs its own pair; (X,Z) vs (ZX,I) (equal matrix products) is the coherent class's deceiver",
        category: "wrong-object",
      },
      {
        wrong: "patch TS strings via JSON -> bash heredoc -> Python",
        right: "the double-escaped \\n split strings into two lines — typecheck after every batch patch; complex patches go through the Edit tool",
        category: "toolchain",
      },
      {
        wrong: "my hand-derived T = 1/4, chi = H2(1/4) anchors",
        right: "both wrong (T = 1/2, chi = H2(1/4) - 1/2) — fix the anchor, not the machine; three-way comparison (derivation / machine / consistency), whoever is right wins",
        category: "machine-overruled",
      },
    ],
  },
  {
    batch: 14,
    repo: "bqp-map",
    date: "2026-09-05",
    context: "genealogy registration: the visitor's 17 claims as machine-checked atlas rows",
    source: { file: "memory/2026-09-05.md", heading: "关键经验（第十四批" },
    errors: [
      {
        wrong: "compare the postselect ledger against Grover's best success probability",
        right: "optimalK maximizes success with NO cost model — t/N ~ 1/2 touches 0.99 at k=5 but pays 5 queries against the ledger's 2.29, and n=4 t=7 shattered 'ledger >= grover queries'; give Grover the same certain-answer standard (k iterations + 1 verification + failure restart, E* = min_k (k+1)/p_k, k=0 the pure guess) — then ledger >= E* always, with attainable equality",
        category: "bogus-comparison",
      },
      {
        wrong: "the brute-force control is the same formula evaluated again",
        right: "that is a tautology — the control must be a different path: integer rational-exact counting against floating-point amplitude accumulation",
        category: "bogus-comparison",
      },
      {
        wrong: "apply sigma_a (x) I to measure along axis a",
        right: "that operator is unitary, not a measurement — projectors P± = (I ± a.sigma)/2, two unnormalized branches summed = the outcome-forgetting channel; otherwise the test greens on the wrong theorem (unitary invariance)",
        category: "wrong-object",
      },
      {
        wrong: "pin the tolerance at 1e-16",
        right: "(1/sqrt(2))^2 floats to 0.5000000000000001 — the assertion at 1e-16 is exceeded exactly; regression guard 2e-16 with the provenance commented",
        category: "statistics",
      },
      {
        wrong: "debug with tsx -e in Git Bash",
        right: "it is silently mute on Windows — write a temp script file (and repo-root debug files import ./src, not ../src)",
        category: "toolchain",
      },
      {
        wrong: "the equality row (n=4, t=7: ledger/E* = 1.00 with k=0 optimal) weakens the table",
        right: "honest equality ships as-is with its explanation — no selecting, no cosmetics",
        category: "process",
      },
    ],
  },
  {
    batch: 15,
    repo: "causal-ineq",
    date: "2026-09-05",
    context: "causal inequality execution layer (process matrix framework)",
    source: { file: "memory/2026-09-05.md", heading: "关键经验（第十五批" },
    errors: [
      {
        wrong: "run Jacobi row and column rotations inside one k loop",
        right: "column updates then read pre-update elements — the J+AJ two-pass structure breaks; 2x2 hand-checks all pass while 16x16 fails; two independent full passes (anchors [[1,1],[1,-1]] -> ±sqrt(2), sigma_y -> ±1 caught it)",
        category: "dimension-slot",
      },
      {
        wrong: "hand-write complex Hermitian Jacobi",
        right: "double to real-symmetric [[Re,-Im],[Im,Re]] (eigenvalues in pairs) — pure-real rotations, textbook-stable",
        category: "conjugation",
      },
      {
        wrong: "|Phi><Phi| = 11 + XX - YY + ZZ",
        right: "the 1/2 normalization fronts the expansion — nearly lost twice (the channel-W trace alarmed 8 != 4); write the normalization first, then kron",
        category: "conjugation",
      },
      {
        wrong: "pin Alice's detection outcome to marginalize Bob's branch",
        right: "pinning computes the JOINT probability — marginalization sums over both outcomes (the T2 terms cancel exactly in the sum and the closed form closes); same family as batch 14's 'control path must differ'",
        category: "wrong-object",
      },
      {
        wrong: "assert support signatures as Pauli index strings",
        right: "Pauli indices (0-3) are not subsystem support signatures (0/1), and deepEqual is order-sensitive — assert the support-signature SET",
        category: "wrong-object",
      },
      {
        wrong: "grab the nature.com file number from memory",
        right: "ncomms2156 is a genomics paper — the causal-inequality PDF is ncomms2076; walk the PMC + redirect chain fully, and when formulas are images, have the machine construct within constraints and let anchors adjudicate (W* came out stronger than transcription, PSD-tightness proof included)",
        category: "citation-drift",
      },
    ],
  },
  {
    batch: 16,
    repo: "k-switch",
    date: "2026-09-05",
    context: "k! order-superposition execution layer (six-order switch)",
    source: { file: "memory/2026-09-05.md", heading: "关键经验（第十六批" },
    errors: [
      {
        wrong: "the isometry certificate is M.M",
        right: "it is M+ M — exp1 wrote the matrix square and the sign habit slipped through; self-check the algebraic object after writing it",
        category: "conjugation",
      },
      {
        wrong: "sample Pauli triples with rng.int(3) x 3",
        right: "sampling with replacement breaks the promise class (X,X,Y no longer pairwise anticommuting — the product is Y, not a phase); sample random permutations constrained to the class",
        category: "statistics",
      },
      {
        wrong: "a 1e-16 tolerance bounds the sqrt amplification",
        right: "T = sqrt(1 - |<a|b>|^2) at |<a|b>| = 1-eps gives sqrt(2*eps) ~ 2e-8 — the threshold comes from the amplification formula (1e-7), provenance commented",
        category: "statistics",
      },
      {
        wrong: "post-erasure fixed order should show maximal dilution D=1",
        right: "the machine: all six fixed orders exactly 1/sqrt(2), the six-order switch exactly 1/2 = D/sqrt(2) — narrate and assert what the machine found, hand-verify the closed form after (X.Z|+> = -|->)",
        category: "machine-overruled",
      },
    ],
  },
  {
    batch: 17,
    repo: "vacuum-compiler",
    date: "2026-09-05",
    context: "ground-state compiler prototype (Feynman clock + readout energy ledger)",
    source: { file: "memory/2026-09-05.md", heading: "关键经验（第十七批" },
    errors: [
      {
        wrong: "compute Im(v v+) with the conj on the output side",
        right: "(v v+) imaginary part is im_i*re_j - re_i*im_j — inverted, real matrices are immune (t3 anchors green) and pure-imaginary sigma_y showed deviation exactly 2; rebuild certificates must include complex examples",
        category: "anchor-blindspot",
      },
      {
        wrong: "dedup degenerate eigenvector clusters",
        right: "Jacobi returns arbitrary REAL bases — decoded complex vectors may be complex-linearly dependent; rebuild per cluster (even real multiplicity = complex multiplicity, in-cluster complex Gram-Schmidt); odd real multiplicity throws directly",
        category: "dimension-slot",
      },
      {
        wrong: "half-fill sigma_y's imaginary part; it looks right",
        right: "the eyeball passed, cmatUnitaryDev returned deviation exactly 1 — hand-written gate matrices fill completely and pass the unitarity check",
        category: "anchor-blindspot",
      },
      {
        wrong: "start the kron chain with out = eye unconditionally",
        right: "at a=0 the embedder krons a 2x-dimension matrix and historyState reads out of bounds -> NaN — and 8x8 kron(eye, cnot) was STILL unitary; embedders verify output dimension exactly 2^n; guards fail loudly over silent NaN",
        category: "dimension-slot",
      },
      {
        wrong: "vals[1] is the spectral gap",
        right: "H_prop's ground state is 2^n-fold degenerate — the gap reads via firstExcited with multiplicity; 'every input's history state is a ground state' becomes the assertion at that site",
        category: "wrong-object",
      },
      {
        wrong: "comparison target kron(I, chain)",
        right: "the global order is data (x) clock — reversed, the identity is off by 0.5; on cross-check failure, audit factor order on BOTH sides first",
        category: "dimension-slot",
      },
      {
        wrong: "the clock marginal is diagonal; the fuel tilt dirties the cargo at O((eps/Delta)^2)",
        right: "both physics claims overruled twice: the marginal-COHERENCE law is the true law (the identity circuit is fully coherent), and the tilt closes on the trajectory-covariant subspace — the fuel account moves to the spectral gap; re-narrate per machine, closed forms supplied",
        category: "machine-overruled",
      },
    ],
  },
  {
    batch: 18,
    repo: "dsic-noether",
    date: "2026-09-05",
    context: "mechanism-design symmetry layer (Groves gauge group + discrete Noether)",
    source: { file: "memory/2026-09-05.md", heading: "关键经验（第十八批" },
    errors: [
      {
        wrong: "a stepwise ~1e-15 residual certifies the variational integrator",
        right: "the DEL sign was inverted (an anti-oscillator): residuals green while |q| exploded to 3.5e8 over 400 steps — certificates also watch trajectory scale (a bounded max|q| assertion added); after the fix lambda sits on the unit circle per the hand-derived (1 - h^2/4)/(1 + h^2/4)",
        category: "wrong-object",
      },
      {
        wrong: "fixed-order serial dictatorship is the negative control",
        right: "SD is the classic non-manipulable rule — the machine refused to break it 40/40; second-best (one step from optimal) is the biter (25/40). Prior intuition yields to machine precedent, and corrections are recorded, not buried",
        category: "machine-overruled",
      },
      {
        wrong: "exclude agent i and keep a square bijection",
        right: "n-1 agents over n items is a PARTIAL INJECTION P(n, n-1); and global agent indices must align with local rows (values[agent] crashed undefined — the loud failure was the good news)",
        category: "dimension-slot",
      },
      {
        wrong: "enumerate injections in ascending index order",
        right: "ascending order yields combinations, not k-permutations — agent order matters in assignment; 'looks right' combinatorics exposed at runtime",
        category: "dimension-slot",
      },
      {
        wrong: "let the Groves payment sign convention emerge from the code",
        right: "p_i = h_i - W_-i(x), U = Phi_v(x) - h, charge = welfare gap — hand-derive the signs once before coding",
        category: "conjugation",
      },
      {
        wrong: "a 1e-15 guard is 'strictly better'",
        right: "the floor is set by the largest intermediate (|q+ - q|/h terms ~56 -> ~1e-14); guard 1e-13 with provenance",
        category: "statistics",
      },
      {
        wrong: "experiments reach the workspace root in three levels",
        right: "two (../..) — the fifth fall on resolve paths",
        category: "toolchain",
      },
    ],
  },
  {
    batch: 19,
    repo: "postselect-sched",
    date: "2026-09-05",
    context: "restart-scheduling theorem layer for the many-worlds sorter",
    source: { file: "memory/2026-09-05.md", heading: "关键经验（第十九批" },
    errors: [
      {
        wrong: "transcribe lambda(t) from the LSZ93 preprint PDF",
        right: "the transcription violated the paper's own lambda <= L lemma — the exhaustive judge returned 19.999 for enumerated strategies against the transcribed 'lambda* = 42.07'; correct semantics lambda(t) = E[min(T,t)]/q(t), hand-checked on {1,5} before rewriting",
        category: "citation-drift",
      },
      {
        wrong: "a trace-preserving channel equals the identity elementwise",
        right: "the complementary-projection two-Kraus channel is block-preserving + cross-block decohering — state the object's semantics before the assertion",
        category: "wrong-object",
      },
      {
        wrong: "the average of conditionals is the conditional of the average",
        right: "(1/2)cond(mix) + (1/2)cond(rho2) does not equal cond(rho1)/2 + cond(rho2)/2 — the second computational path is audited too",
        category: "wrong-object",
      },
      {
        wrong: "MC conditional frequencies divide by the total sample count",
        right: "the denominator is the number of ACCEPTED samples — branch-world population counts only branch residents",
        category: "statistics",
      },
      {
        wrong: "sample marked sets with possible repeats",
        right: "birthday collisions decouple t from the array length — dedup at entry",
        category: "statistics",
      },
      {
        wrong: "word the README by the expected limit",
        right: "finite-N thresholds approach from ABOVE (0.3984 -> 0.396484) — wording follows the data, not the expectation",
        category: "process",
      },
    ],
  },
  {
    batch: 20,
    repo: "retro-cache",
    date: "2026-09-06",
    context: "no-signaling tariff ledger for the retrocausal cache",
    source: { file: "memory/2026-09-06.md", heading: "关键经验（第二十批" },
    errors: [
      {
        wrong: "build rho_03 = psi_0 * psi_3",
        right: "it is psi_0 * conj(psi_3) with imaginary part -sin(theta)/2 — dropping the conj builds |Phi_-theta> and flips every sin(theta) correlation; the complex anchor family cashed its value immediately (deviation 0.5826 at theta = pi/4 located on the spot)",
        category: "conjugation",
      },
      {
        wrong: "apply the B(x)env unitary on the 4-dim A(x)B space",
        right: "the Stinespring dilation is constructed on the FULL (A) (x) (B (x) env) space with the control straddling A — the A-dependence test alarmed maxdiff 190-scale at once; dimension accounts before matrix multiplies",
        category: "dimension-slot",
      },
      {
        wrong: "no-signaling means I(B; A's outcome) = 0",
        right: "the correct object is I(B; A's SETTINGS) = 0 — on the aligned axis the outcome MI is legitimately 1 bit (that IS the entanglement); the perpendicular axis gives 0, and the bit lives in the |a.b| alignment",
        category: "wrong-object",
      },
      {
        wrong: "the invariant is 'B's coin stays uniform'",
        right: "non-unitary CPTP legitimately biases B's own coin (E(I/2) != I/2) — the invariant is 'independent of A'; write the physical object first",
        category: "wrong-object",
      },
      {
        wrong: "trust the |Phi_theta> tensor at a glance",
        right: "two easy misses: T_zz = +1 (the Z(x)Z diagonal (-1)(-1) = +1 — both-side signs MULTIPLY) and T_xy = T_yx = sin(theta) (coherent off-diagonal) — hand-derive the full tensor closed form before coding",
        category: "conjugation",
      },
    ],
  },
  {
    batch: 21,
    repo: "route-price",
    date: "2026-09-06",
    context: "route-and-price dossiers for the two OPEN rows",
    source: { file: "memory/2026-09-06.md", heading: "关键经验（第二十一批" },
    errors: [
      {
        wrong: "normalize conditionalData by the joint element P(control=g, data=0)",
        right: "the divisor is the BLOCK TRACE (control=g's marginal) — the joint element sent the leakage check to maxdiff 190; after the fix, exact zero drift. Ask first: conditioned on whom, traced over whom",
        category: "wrong-object",
      },
      {
        wrong: "the clone gap's numerical lower bound certifies no-cloning",
        right: "gap = |sin(theta + phi)| passes through zero (0.337 at phi = 2.7) — no bound exists; the discriminant is COVARIANCE: pair terms invariant under rephasing, clone terms rotating at double speed. Same type as batch 20's Stinespring lesson — write the correct invariant first, then the threshold",
        category: "wrong-object",
      },
      {
        wrong: "render.ts runs main() at import",
        right: "an entry guard (import.meta.url === pathToFileURL(process.argv[1]).href) — otherwise the test's first import executes the rendering",
        category: "toolchain",
      },
      {
        wrong: "hand-compute the dossier's price column, then round",
        right: "the witness measured 9977.19 against the hand's 9977.87 — run the witness first, then write the number into the text",
        category: "process",
      },
    ],
  },
  {
    batch: 22,
    repo: "burial-record",
    date: "2026-09-06",
    context: "this repo's own delivery: the burial record promoted to a machine-audited registry",
    source: { file: "memory/2026-09-06.md", heading: "关键经验（第二十二批" },
    errors: [
      {
        wrong: "feed the category census witness error-shaped objects ({repo, category}[]) through a batch-shaped counter (countBy over BurialBatch[])",
        right: "tsc rejected the call site — the witness counts by two direct traversals (direct vs JSON round-trip) instead. The live specimen of this registry's own wrong-object category",
        category: "wrong-object",
      },
      {
        wrong: "cite batch 19's source anchor from memory as memory/2026-09-06.md",
        right: "postselect-sched's first delivery (T1-T4, batch 19) happened on 2026-09-05 — only the T5 extension was on the 6th; the B4 gate named the dead anchor, and the B4 smuggling trial caught the real violation by collateral (actual 19 vs expected 20). Anchors are verified against the file by grep, never by recall",
        category: "citation-drift",
      },
      {
        wrong: "place the diagnostic script outside the repo (system temp)",
        right: "it cannot resolve ./src from there — batch 14's own lesson (repo-root debug files import ./src) repeated; the script belongs inside the repo",
        category: "toolchain",
      },
      {
        wrong: "number the laws B0-B4 then B6",
        right: "a gap in the law numbering of the very repo whose law B3 forbids gaps in batch numbering — caught in self-review, renumbered B0-B5",
        category: "process",
      },
    ],
  },
  {
    batch: 23,
    repo: "readout-wall",
    date: "2026-09-06",
    context: "the readout wall delivered as an exchange-rate ledger",
    source: { file: "memory/2026-09-06.md", heading: "关键经验（第二十三批" },
    errors: [
      {
        wrong: "track only the REAL amplitudes in the k=3 branch builder",
        right: "random complex CPTP channels would be silently corrupted — and the depolarizing witnesses are structurally immune (real Kraus; batch 9 recurring). Caught in self-review, then the hole closed by construction: W-E's mixture identity now includes complex random triples. A blindspot is not fixed until an anchor exists that can see it",
        category: "anchor-blindspot",
      },
      {
        wrong: "leave the wrong-dims expression, the void-ed leftover and the invalid hex literal 0x5ead0u7 in the complex sub-check's first draft",
        right: "drafts do not reach the machine dirty — cleaned in review before the run; the draft's errors still book",
        category: "dimension-slot",
      },
      {
        wrong: "import mulberry32 from the kernel by memory",
        right: "the export is makeRng — the grep chain refused to run the probe until fixed. A reference into your own codebase is still a reference: verify, never recall",
        category: "citation-drift",
      },
      {
        wrong: "reuse report.ts assuming the contract travels with the idiom",
        right: "the source repo's writeReport returns void and writes reports/, not out/reports/ — the render printed 'rendered -> undefined' until caught. Read the contract before wiring a reused file; same idiom is not same signature",
        category: "process",
      },
    ],
  },
  {
    batch: 24,
    repo: "nosignal-tariff",
    date: "2026-09-06",
    context: "the no-signaling tariff itemized as one machine-audited schedule",
    source: { file: "memory/2026-09-06.md", heading: "关键经验（第二十四批" },
    errors: [
      {
        wrong: "apply a 2x2 projector directly to the 4x4 two-qubit state",
        right: "an operator acting on a subsystem tensors with the identity first — kron(P, I); the shape error fired on the very first run",
        category: "dimension-slot",
      },
      {
        wrong: "fill SINGLET/PHI_PLUS density matrices by writing amplitudes into wrong elements (the |01><10| coefficient into the (0,1) slot)",
        right: "caught in self-review before any run — the state's index account precedes filling numbers; |01> is index 1, |10> is index 2",
        category: "dimension-slot",
      },
      {
        wrong: "read the joint elements re[0]/re[3] of the dephased output as the order-bit probabilities",
        right: "the object is the CONTROL MARGINAL's diagonal — joint elements depend on the payload by design; the probe's 1.856e-1 was the alarm. The no-signaling object (setting, marginal) has now recurred THREE times (retro-cache batch 20, readout-wall batch 21 conditioning, this batch) — the schedule now writes the correct object at the top of its page",
        category: "wrong-object",
      },
      {
        wrong: "transcribe the binary-entropy Taylor series from memory with the prefactor 4x too large and the first power off by one",
        right: "the machine returned 2.793 deviation; after the fix 1.27e-3 exposed the boundary convergence issue (at d=1 the series converges only as 1/(2N)) — 400 terms on the open grid q in [0.05, 0.45], closed forms at the endpoints; a series is quoted only where it is honest",
        category: "citation-drift",
      },
      {
        wrong: "check 'ensemble average is I/2' by comparing against identity(2)",
        right: "the comparison object is the maximally mixed diag(1/2, 1/2) — printing the diagonal 0.5 exposed that the wrong side of the comparison was wrong, not the physics",
        category: "wrong-object",
      },
      {
        wrong: "call the gate green when npm test passes",
        right: "tsc caught two unused imports (PHI_PLUS, dephase) after all 11 tests were green — tsx does not typecheck; typecheck and test are separate gates and both must run",
        category: "toolchain",
      },
      {
        wrong: "feed a 2x2 zero matrix into the 4x4 local-map channel, and require() inside an ESM probe",
        right: "the stack trace refused both at once — sanity checks need the right-shaped input; ESM imports modules statically",
        category: "toolchain",
      },
      {
        wrong: "let the negative-control test wander into a positive assertion with a void-ed leftover variable",
        right: "rewritten in review before merge — drafts do not reach the machine dirty, and the draft's errors still book",
        category: "process",
      },
    ],
  },
  {
    batch: 25,
    repo: "choice-lang",
    date: "2026-09-06",
    context: "the first executable model of choice as a language primitive",
    source: { file: "memory/2026-09-06.md", heading: "关键经验（第二十五批" },
    errors: [
      {
        wrong: "run a 20-step program without accounting the register: each choose adds a control qubit",
        right: "the joint state is 2^20 x 4 dimensional — the probe hung and was killed by timeout. Dimension accounts before matrix multiplies (third of the family): program length is bounded by memory, not by mathematics",
        category: "dimension-slot",
      },
      {
        wrong: "let the language kernel reach the machine on the third draft (draft 1: dead code and a nonsense ternary; draft 2: silly accumulation expressions and per-loop diagonal extraction)",
        right: "rewritten twice in review — drafts do not reach the machine dirty, and every draft's errors book",
        category: "process",
      },
      {
        wrong: "'verify' the clone's order-2 phase by composing the expected rotation myself and checking it against itself",
        right: "a tautology wearing a witness's clothes (batch 14's bogus-comparison recurring) — rewritten to read the phase off real matrices: the CNOT pair state rephased by R(x)R, the pair term's ratio extracted from the result",
        category: "bogus-comparison",
      },
      {
        wrong: "tensor the 2x2 control marginal against the 4x4 pair projector",
        right: "the clone input is kron(rho_c, |0><0|_2) — the shape error fired on the run",
        category: "dimension-slot",
      },
      {
        wrong: "assert the control marginal equals the prepared state after a choose",
        right: "the cross-term is scaled by Tr[U0 rho U1-dagger] — that scaling is HOW a control carries information (the replacer pair's mechanism); the invariant is the DIAGONAL (the readout-blind face). The failing test corrected the asserted object, not the physics",
        category: "wrong-object",
      },
      {
        wrong: "quote the rounding floor from the probe's seeds (211-family) for a witness using different seeds (201-family)",
        right: "floors are not seed-stable: the witness measured 8.882e-16 against the quoted 4.5e-16 — quote the floor at the witness's own seeds, with provenance commented",
        category: "statistics",
      },
      {
        wrong: "write render.ts through a bash heredoc",
        right: "the heredoc truncated the file's tail and swallowed the following command — complex files go through the Write tool, always; tsc also caught an unused parameter left by an earlier edit",
        category: "toolchain",
      },
    ],
  },
  {
    batch: 26,
    repo: "binding-price",
    date: "2026-09-06",
    context: "the market of #13 executed: privacy bought, binding not",
    source: { file: "memory/2026-09-06.md", heading: "关键经验（第二十六批" },
    errors: [
      {
        wrong: "hand-expand the pass probability's element arithmetic (a real-part sign slip in the A10*B01 term)",
        right: "real states were immune; the identity sweep caught 1.5e-1 in the complex quadrant — closed forms go through the kernel (mMul + mTrace), never through the fingers (batch 10's expPauli recurring)",
        category: "conjugation",
      },
      {
        wrong: "write probe.ts through a bash heredoc again",
        right: "truncated a second time in the same session (batch 25's lesson re-offended on the spot) — code files go through the Write tool, promoted to a hard rule",
        category: "toolchain",
      },
    ],
  },
  {
    batch: 27,
    repo: "letter-audit",
    date: "2026-09-06",
    context: "the letter itself, fully audited — origin claim and five abilities",
    source: { file: "memory/2026-09-06.md", heading: "关键经验（第二十七批" },
    errors: [
      {
        wrong: "start writing the Turing-machine encoding before finishing the design (two drafts collapsed into placeholder voids mid-file)",
        right: "the third draft defined the clean self-encoding (4(n+1) options per entry) on paper first — encodings are designed before they are typed",
        category: "process",
      },
      {
        wrong: "write the universe count as 4 * (n + 1) ** (2 * n)",
        right: "precedence: that is 4*((n+1)^(2n)) = 324, not (4(n+1))^(2n) = 20736 — the enumeration ran on a truncated universe and returned BB=3 against the expected 6. Hand-evaluate formulas on a concrete case before they enter code",
        category: "statistics",
      },
      {
        wrong: "encode the right-walker transition as K - 1 - (n + 1) instead of exactly 3 * (n + 1)",
        right: "an off-by-one in index arithmetic, caught in self-review — substitute concrete numbers into index formulas the same way",
        category: "dimension-slot",
      },
    ],
  },
  {
    batch: 28,
    repo: "wukong-crossval",
    date: "2026-09-06",
    context: "the physical-verification pipeline, built to the machine-time application's spec",
    source: { file: "memory/2026-09-06.md", heading: "关键经验（第二十八批" },
    errors: [
      {
        wrong: "allocate the statevector with dim entries but index it as the [real | imaginary] split layout",
        right: "psi[dim + k] reads out of bounds into NaN energies — the layout constant (dim = length >> 1) must have a single source threaded through every kernel function",
        category: "dimension-slot",
      },
      {
        wrong: "read coupling coefficients from empty rows without a fallback",
        right: "v += undefined poisons the value with NaN, and NaN comparisons silently fool the enumeration referee (opt 8.6 against the true 18) — boundary reads get ?? 0, and the separable second path is exactly the detective that caught it",
        category: "dimension-slot",
      },
      {
        wrong: "apply the cost phase with the real part missing the -im*phIm term",
        right: "an incomplete complex-product real part (batch 10's conjugate-side class, third appearance this session) — caught by the NaN-energy probe before any number was written",
        category: "conjugation",
      },
      {
        wrong: "build 21 instances then slice(0, 20), silently dropping the fifth linear one",
        right: "4 linear + 16 coupled against the spec's 5 + 15 — count the construction before truncating it",
        category: "process",
      },
    ],
  },
  {
    batch: 29,
    repo: "survivor-census",
    date: "2026-09-06",
    context: "the survivor semantics of the many-worlds sorter (posterior, kill register, waiting price)",
    source: { file: "memory/2026-09-06.md", heading: "关键经验（第二十九批" },
    errors: [
      {
        wrong: "write the imaginary part of <A|B> as aIm*bRe - aRe*bIm",
        right: "conj(A)B has Im = aRe*bIm - aIm*bRe — the test referee convicted it at deviation 1.176 = 2 sin(pi/5), exactly twice the imaginary part. Conjugation-side sign error, THIRD recurrence (batch 10 expPauli, batch 28 applyCost): write the conjugate expansion before typing the loop",
        category: "conjugation",
      },
      {
        wrong: "referee E[T] by a plain truncated loop at every P (P=2^-20 needs ~4e7 accumulated adds)",
        right: "float drift 4.4e-5, far past the tolerance — the second path became the closed-form partial sum (1-(K+1)q^K+Kq^{K+1})/p with analytic tail < 1e-12 of the mean, and the loop referee stays only at moderate P where K is small. A second path must be independent AND numerically stable, not the same sum in another accent",
        category: "statistics",
      },
      {
        wrong: "assert the degenerate full-funding case with assert.equal(pKeep, 1)",
        right: "the normalized weight sum is 1+2.2e-16 — degenerate assertions over float sums take tolerances; the same eps pushed waitingPrice's domain check to throw on p=1+eps",
        category: "wrong-object",
      },
      {
        wrong: "resolve the workspace root in test/ with the three-level climb copied from src/experiments/",
        right: "test/ sits TWO levels below the workspace — G3 misreported every live anchor as dead (postselect-sched, retro-cache all 'not on disk'). The climb depth belongs to the file's own position; count your own directories before copying a neighbor's relative root",
        category: "toolchain",
      },
      {
        wrong: "print the kill register's fractions as mass*N over N",
        right: "the true denominator is totalC (60), not N (16) — '2/16 (0.1167)' is a fraction that lies about its own decimal. KillRow now carries count/totalC and the register prints the real integer ratio",
        category: "bogus-comparison",
      },
      {
        wrong: "let draft residue reach the machine (a `| \"\"` leftover inside a ternary, an unused N in p0Probe, an unused seed parameter in mcWaiting)",
        right: "tsc named all three before any test ran — drafts do not reach the machine dirty, and every draft's errors book",
        category: "process",
      },
    ],
  },
  {
    batch: 30,
    repo: "ent-clearing",
    date: "2026-09-06",
    context: "the settlement layer of the entanglement standard (teleportation burns the coin, dense coding returns it, Procrustean netting, the mint wall)",
    source: { file: "memory/2026-09-06.md", heading: "关键经验（第三十批" },
    errors: [
      {
        wrong: "write |Phi-> and |Psi-> as global negations of the plus states: vScale(vAdd(k00, k11), -inv)",
        right: "the minus lives on the SECOND ket, not on the whole vector — the broken basis destroyed orthogonality (the Phi- projector traced 1 on the Phi+ signal; the Z and XZ signals decoded as all-zero rows). The decode matrix convicted it before any number was written",
        category: "conjugation",
      },
      {
        wrong: "print probe fidelities at toExponential(6) and read 1.000000e+0 as clean",
        right: "the value was 1 + 2.1e-8 — the format masked the dirt while npm test failed on the same number (batch 29's fake-fraction lesson recurring on the reader's side): debug output needs enough digits to convict",
        category: "bogus-comparison",
      },
      {
        wrong: "verify pure-payload identity through the Uhlmann fidelity (the sqrtPSD route)",
        right: "the eigenvector path carries ~1e-8 noise on rank-deficient states (reconstruction accepted at 1e-8), so 'fidelity exactly 1' failed at 1+2.1e-8 — pure references take <psi|rho|psi> (exact linear algebra), identity between mixed matrices takes trace distance (eigenvalues only): the metric is chosen by the rank of what it touches",
        category: "wrong-object",
      },
      {
        wrong: "normalize the Procrustean fail branch unguarded at l_min = 1/2",
        right: "K_fail is the zero matrix there, pFail is exactly 0, and the fail 'state' is 0/0 = NaN slipping through silently — probability-zero branches are guarded before division (survivor-census S4's P=0 lesson in arithmetic form)",
        category: "statistics",
      },
      {
        wrong: "let audit.ts draft residue stand: indirection chains (mMat/randomMixedLike), mid-file imports, a void dead branch, a placeholder rejects() line in T4",
        right: "self-review caught all of it before the machine saw the file; drafts do not reach the machine dirty, and every draft's errors book",
        category: "process",
      },
      {
        wrong: "copy the kernel core but skip measures.ts (it had only been read)",
        right: "tsc named both dead imports immediately — a copy list is a checklist, not a memory",
        category: "toolchain",
      },
    ],
  },
  {
    batch: 31,
    repo: "stable-world",
    date: "2026-09-06",
    context: "the physics half of ledger row #15: the desired world as the absorbing class of a fixed dissipative law (quiet-on-world, global attraction, the charge as Lyapunov function, perturbation census, stabilization tariff, escape ledger) — the row's first verdict move, OPEN -> MECHANISM-SETTLED",
    source: { file: "memory/2026-09-06.md", heading: "关键经验（第三十一批" },
    errors: [
      {
        wrong: "write the |1><0| Kraus element at flat index 1 (that is element (0,1) — the damping would flow OUT of the world)",
        right: "row-major (1,0) is index 1*2+0 = 2; self-caught before the machine saw it — indices are written as row*cols+col, never as a bare number (batch 22's index lesson in Kraus form)",
        category: "dimension-slot",
      },
      {
        wrong: "scale a 4x4 matrix by multiplying it with a 1x1 'scalar' matrix through mMul",
        right: "mScale is the operation; mMul would have thrown a shape mismatch — self-caught in review",
        category: "dimension-slot",
      },
      {
        wrong: "build random unitaries as exp(iH) through the family eigHermitian on an INDEFINITE random Hermitian",
        right: "the family solver's reconstruction check runs through reconstruct(), which sums only λ > 0 — it is PSD-only by construction and threw 'reconstruction failed' on every draw; random unitaries rebuilt on complex Gram-Schmidt QR (two re-orthogonalization passes, random column phases), no eigendecomposition. A solver's implicit precondition is part of the object it accepts",
        category: "wrong-object",
      },
      {
        wrong: "define the law's k->infinity limit as the diagonal blocks kept IN PLACE (the dephased twin)",
        right: "K1 carries |0,x> into |1,x>: the true limit is the into-world collapse — the world block equals rho_WW + rho_SS with the cargo intact and the complement block gone; the 1e-12 assertion convicted the wrong object at once. Derive the limit from the Kraus action chain before constructing it",
        category: "wrong-object",
      },
      {
        wrong: "compare the converged state against inWorldState(outside) — embedding a 4x4 full state as if it were 2x2 cargo, producing 8x8, while the family mAdd silently accepted the shape mismatch (garbage, not an error)",
        right: "keep the cargo and embed it both ways from the same 2x2 object; the kernel's adders do not check shapes, so the dimension account is always ours to keep (batch 24's ⊗I lesson, silent variant)",
        category: "dimension-slot",
      },
      {
        wrong: "Monte-Carlo the event 'ever left the world within K steps' while the closed form gives 'out of the world AT step K' (the chain has return)",
        right: "two different events an order of magnitude apart — 682σ; the census resimulates the same event on the full chain with return (1.21σ). The event definition is written in the same sentence as the closed-form claim, before any sampling",
        category: "statistics",
      },
      {
        wrong: "import basisVec from states.js (it lives in cmat.js)",
        right: "the ESM loader named the missing export; a module map is a citation too — grep it, do not remember it (batches 23/24 recurring)",
        category: "citation-drift",
      },
      {
        wrong: "consume mat and mAdd in the test file with neither in its import list",
        right: "self-caught before the run — same lesson as the basisVec line, the import list is checked against the file's actual uses, not assumed",
        category: "citation-drift",
      },
    ],
  },
  {
    batch: 32,
    repo: "mutant-census",
    date: "2026-09-06",
    context: "the workspace's quality layer: the burial record's defect classes replayed as nine mutants and killed by a ten-property battery (6 EXACT + 1 CRASH + 2 DATA, zero survivors), the kernel family's byte-identity censused live, the 26 repos' hygiene machine-swept",
    source: { file: "memory/2026-09-06.md", heading: "关键经验（第三十二批" },
    errors: [
      {
        wrong: "ship P2 as a statehood battery (Hermitian, trace 1, PSD) while MU2's corruption is elementwise CONJUGATION (rho*) — the conjugated mutant passed every statehood check and the declared EXACT-KILL was in fact a SURVIVOR",
        right: "the kill-census test convicted the declaration on the spot; the fix is history's own fix — the sector coherence block carries its phase (e^{i phi}/2 exact), conjugation survives statehood, never the phase (batch 20's blind spot recurring on its own memorial). A negative control isomorphic to the checked object is no control at all",
        category: "machine-overruled",
      },
      {
        wrong: "NC-P3's violator: dagger the outer product — a mirror-symmetric corruption set against the mirror-symmetric identity outer(a,b)|dagger = outer(b,a), which it satisfies exactly (the control could never fire)",
        right: "W-C convicted the deaf control; replaced by a lopsided corruption (element (0,1) doubled) with the mirror-blindness recorded in the boundary: mirror-symmetric tests cannot see mirror-symmetric corruptions, conjugation is killed by the PHASE, not by mirrors",
        category: "bogus-comparison",
      },
      {
        wrong: "build P10's entangled states with a random GLOBAL U(4) on |Phi+> and assert B's marginal is I/2",
        right: "only LOCAL unitaries preserve maximal entanglement — a generic global U(4) leaves B's marginal far from I/2 (convicted at 4.61e-1); the states are built as U_A (x) U_B. The assertion's admissible class precedes the assertion",
        category: "wrong-object",
      },
      {
        wrong: "require the CNOT negative control to move B's marginal by strictly MORE than 0.5 — the CNOT on |+0> moves it by EXACTLY 1/2",
        right: "threshold 0.4 with the exact value documented on the line; a threshold that coincides with the physical value is a trap",
        category: "statistics",
      },
      {
        wrong: "let P6's leakage loop advance one shared state through k MORE steps for each k in [1,3,7] (cumulative 1, 4, 11) while comparing against (1-gamma)^k",
        right: "the canonical-family run convicted itself at 2.83e-1; each k evolves independently from rho — a loop counter named k must BE k",
        category: "statistics",
      },
      {
        wrong: "leave nonstoq-anneal and ft-qaoa out of the legacy guard register on the strength of a recon grep that found a guard SOMEWHERE in each repo",
        right: "the census detector is per-FILE: a repo can carry a guarded render and an unguarded experiment entry at once; register what the detector sees, not what a coarse grep remembers",
        category: "anchor-blindspot",
      },
      {
        wrong: "capture provenance repos with /batch \\d+ \\(([^)]+)\\)/ — MU1's 'batch 10 (qverify, expPauli)' yields the repo name 'qverify, expPauli'",
        right: "the Q6 anchor check convicted the nonexistent repo; repo names are lowercase-with-hyphens: /batch \\d+ \\(([a-z0-9][a-z0-9-]*)/",
        category: "citation-drift",
      },
      {
        wrong: "format kill margins with a >1000-means-sigma heuristic — MU5's exact trace ratio 3580 printed as '~3580 sigma'",
        right: "the sigma unit belongs to DATA kills only; units are carried by the verdict's grade, not by magnitude",
        category: "process",
      },
      {
        wrong: "construct P1's mismatched pair as mat(k, m === k ? m + 1 : m) against mat(m, n) — when m !== k the product is LEGAL and the 'mismatch' census counts legal products",
        right: "self-caught; a.cols = m + 1 against b.rows = m mismatches by construction — a negative census must GUARANTEE its negatives, not sample them",
        category: "wrong-object",
      },
      {
        wrong: "the MU6 edit left a duplicated assignment line (k0w.re[0] set twice) and MU7 zeroed the dephased twin's cells by hand-listing all eight cross index pairs",
        right: "self-caught; the duplicate removed and the listing replaced by the sector comparison floor(r/2) !== floor(c/2) — an enumerated index list is a loop waiting to be written",
        category: "process",
      },
      {
        wrong: "ship render.ts with a placeholder helper whose body throws 'unreachable' — the render would have crashed on first run",
        right: "self-caught on review; the whole file rewritten — drafts do not reach the machine dirty, and the draft's errors still book",
        category: "process",
      },
      {
        wrong: "walk the tree in census.ts through existsSync + readdir try/catch pairs with two helper functions nothing called",
        right: "rewritten on readdirSync withFileTypes before the machine saw it — one walk, one dirent check, no orphans",
        category: "process",
      },
      {
        wrong: "import block missing mMul/vec/vKron while importing unused depolarize/PAULI_X/Rng/CMat",
        right: "tsc convicted both directions (TS2304 cannot find name; TS6133 declared but never read) — typecheck is its own gate, tsx does not check types",
        category: "toolchain",
      },
    ],
  },
  {
    batch: 33,
    repo: "mutant-census",
    date: "2026-09-06",
    context: "the v0.2.0 full-coverage extension: the pre-batch-21 guard debt PAID (42 experiment entries retrofitted across 11 repos, every gate re-run green, repro verified on all three retrofit shapes), the legacy register emptied into an absolute ratchet, the platform repo censused under a registered exemption, and `npm run total` judging the whole workspace as one command (55 jobs first run ALL GREEN)",
    source: { file: "memory/2026-09-06.md", heading: "关键经验（第三十三批" },
    errors: [
      {
        wrong: "drop the retrofit probe into /tmp — which resolves to D:\\Data\\Temp on this machine, outside the repo, so './src/kernel/census.js' failed to resolve (batch 22's exact trap, re-triggered)",
        right: "probes live INSIDE the repo (probe-detect.ts, probe-retrofit.ts at the census root) — a lesson that has recurred is a directory convention, not advice",
        category: "process",
      },
      {
        wrong: "the retrofit script inserted the guard import after the LAST line matching /^import / — qverify exp5-attacks.ts's last import is a MULTI-LINE declaration, so the line landed inside its braces; the test suite stayed 46/46 green because the test glob never imports the experiment file",
        right: "typecheck convicted it (TS1003/TS1005) while the tests smiled: green tests say nothing about files they never import — typecheck is its own gate, and a script that edits imports must respect multi-line declarations",
        category: "anchor-blindspot",
      },
      {
        wrong: "verify the retrofitted repos with `npx tsc --noEmit --project <other-repo-path>` from the workspace root — npx resolved tsc against the root's node_modules and banner-errored for all 11 repos, every one a false alarm",
        right: "run each repo's OWN `npm run typecheck` — tooling that resolves against the nearest node_modules must be invoked from the repo it serves",
        category: "toolchain",
      },
      {
        wrong: "scout the trailing invocations through a compound pipeline whose `grep -v \":: \"` stage filtered out EVERY line (each line contained the separator), while the awk stage tripped ugrep's empty-subexpression error",
        right: "a filter that swallows the signal is as guilty as one that passes noise — verify a filter lets signal through before trusting its silence; replaced by direct per-file tails",
        category: "process",
      },
    ],
  },
  {
    batch: 34,
    repo: "mutant-census",
    date: "2026-09-06",
    context: "the v0.3.0 enrollment: the registry CLOSED — every buried error wired live to the guard that kills it now (107 on the mutants by declared class, 61 on build gates anchored file+needle to disk, 36 booked unenforceable with printed reasons, E1-E6 + W-F); this batch's eight delivery errors were enrolled in the same motion — the first batch born already-enrolled",
    source: { file: "memory/2026-09-06.md", heading: "关键经验（第三十四批" },
    errors: [
      {
        wrong: "batch-edit family.ts through a bash-inline node one-liner whose regex escaping ate the pattern — the script printed 'classes added to 0 mutants' and changed nothing, silently",
        right: "source surgery goes through the edit tools, never regex through pipes (the heredoc lesson's sibling); an edit script that reports zero replacements is a failure, not a no-op",
        category: "toolchain",
      },
      {
        wrong: "hand-mapped b20#3 onto MU2 by misreading its category as conjugation — the registry files it under wrong-object",
        right: "the generator's class-tie validation REFUSED the emission ('MU2 does not replay category wrong-object') — the mapping is data checked against the live registry, never memory; the same error in a shipped table is E2's exact conviction",
        category: "machine-overruled",
      },
      {
        wrong: "enumerated the 204 errors by hand for the decision table and dropped one (b30#5, the measures.ts copy skip)",
        right: "the generator's coverage validation named the undecided row — the table is generated FROM the live registry, so an omission cannot pass; the same hole in a shipped table is E1's exact conviction",
        category: "machine-overruled",
      },
      {
        wrong: "the render.ts edit carried a phantom call ENROLLMENT_used(enrollment) — a function that exists nowhere — caught in self-review before any machine saw it",
        right: "draft residue is booked even when pre-flight review catches it; the initial draft does not go to the machine, but its errors go to the record",
        category: "process",
      },
      {
        wrong: "gen-enrollment.ts assigned `DEFAULTS[...] ?? null` into a Decision | undefined slot — TS2322 under noUncheckedIndexedAccess",
        right: "restructured to a const decision chain (override ?? machine-overruled default ?? category default); tsc is its own gate",
        category: "machine-overruled",
      },
      {
        wrong: "wrote `if (!d) d = ...` where eslint's prefer-nullish-coalescing demanded ??= — the lint gate refused the emission",
        right: "the const chain removed the reassignment entirely; typed-lint convicts style debt the compiler tolerates",
        category: "machine-overruled",
      },
      {
        wrong: "the emitter wrote D:\\Data\\Temp into the generated TS with bare backslashes — no-useless-escape named the dead \\D and \\T",
        right: "the emitter escapes backslash and quote on every emitted column; generated code is code — it goes through the same lint gate",
        category: "machine-overruled",
      },
      {
        wrong: "E1's un-enrolled conviction named batch/repo/category but not the key — the smuggling test's /b35#0/ regex failed against a detail that could not name its own defendant",
        right: "the conviction text now LEADS with the key ('b35#0 un-enrolled …'); a conviction that cannot name its defendant is not one — the new test caught it on first run",
        category: "machine-overruled",
      },
    ],
  },
  {
    batch: 35,
    repo: "mutant-census",
    date: "2026-09-06",
    context: "the v0.4.0 anchor board: every GATE anchor upgraded from a string to a registered guard with evidence (FIRING-INJECT demos, FIRING-LIVE shots, RESOLVED machinery) under laws A1-A3 — five delivery errors, born enrolled",
    source: { file: "memory/2026-09-06.md", heading: "关键经验（第三十五批" },
    errors: [
      {
        wrong: "resolveAnchor's branch conditions were written on reg.anchor (which ENDS with the needle) instead of the split-out path — endsWith('/package.json') was always false and every package anchor fell into the 'no resolution rule' fallback",
        right: "conditions bind to the split's PRODUCT: path.endsWith('/package.json'), not the whole anchor string — the A3 test convicted the blindness by name ('did not resolve')",
        category: "wrong-object",
      },
      {
        wrong: "forged the L2 firing ammo from the daily memory's wording — '— (none) —' as a no-numbers row — without reading the law's implementation; hasNumbers is trim() nonempty, so the filler string is a perfectly legal number column and the demo fired at nothing",
        right: "the conviction demo now encodes the law's real object read from the ledger's own audit.ts source (a BLANK column with a settled verdict); casting ammo for a sibling repo's law means reading that law, not remembering it",
        category: "citation-drift",
      },
      {
        wrong: "six T[] annotations on non-simple types in the new anchor module — the array-type lint gate refused until --fix rewrote them",
        right: "Array<T> for non-simple element types, enforced by typed-lint — generated-or-handwritten, new code goes through the same gate",
        category: "machine-overruled",
      },
      {
        wrong: "after narrowing a closed three-kind union, compared reg.kind === 'RESOLVED' (always true) and chained ?. on a non-optional margin — no-unnecessary-condition named both",
        right: "the else branch of a closed union does not re-compare; non-nullish values do not get optional chains — the lint gate holds these so tsc cannot",
        category: "machine-overruled",
      },
      {
        wrong: "the E1a smuggling fixture hardcoded the forged key as b35#0 — a 'future' batch number at writing time; when batch 35 actually landed, the forged entry shadowed the REAL b35#0 in the key map (category process over wrong-object) and the test detonated two unrelated citations (E6 mislabel + E2 class mismatch) instead of its single intended E1",
        right: "smuggling ammunition uses keys that can never collide (b99#0); an assumption that the future stays quiet is exactly the kind of thing the registry exists to convict — 2 !== 1 said so",
        category: "machine-overruled",
      },
    ],
  },
  {
    batch: 36,
    repo: "dtc-clock",
    date: "2026-09-06",
    context: "the #10 settlement repo: the beat clocking universal reversible computation with a legislated tariff table — twenty-two delivery errors, born enrolled (E1 self-application, third generation)",
    source: { file: "memory/2026-09-06.md", heading: "关键经验（第三十六批" },
    errors: [
      {
        wrong: "applyClockUnitary treated the total index as runner-major while the permutation and every readout used clock-major — two index conventions for one space (the family kron is A-major; the law was read only after the crime)",
        right: "one layout everywhere: clock-major, row = z*runnerDim + d; read the family convention BEFORE writing operators against it",
        category: "wrong-object",
      },
      {
        wrong: "the 'optimized' applyClockUnitary collapsed the (d1,d2) pair loop into a single d — only d1=d2 blocks were written, silently zeroing every cross-d coherence (the runner's ENTIRE coherence) while every clock marginal still passed",
        right: "the pair loop runs over all (d1,d2); marginals passing is not the state passing — the cargo matrix check caught what the marginals blessed",
        category: "wrong-object",
      },
      {
        wrong: "the detuned work law was written as the closed form J(n-1)(cos^2 2d)^k sin^2 2d for all k — true only for k=1: after the first kick the state is a superposition and the ZZ stroke entangles it, so the product-state geometry dies",
        right: "first period kept as the true closed form (E_1 dev 4.4e-15), the chain's heating beyond it is DATA (suppression 4.5x vs the isolated echo), and NO infinite-time total is claimed — the scratch numbers convicted the prose before it shipped",
        category: "machine-overruled",
      },
      {
        wrong: "the runner halted by absorption (token |T> stays) — NOT injective: |T-1,x> -> |T,U x> collides with |T,U x> -> |T,U x>; the permutation lost bijectivity at the first wrap and the trace died at period 4",
        right: "the cyclic self-resetting runner: the wrap beat applies (U_T...U_1)+ (involutions replayed in reverse) — one (T+1)-cycle permutation; halt is a READING at the cycle top, not a stop",
        category: "wrong-object",
      },
      {
        wrong: "the family's eigHermitian fails its own reconstruction check on generic real-symmetric TI chains (err ~ 49; the values path is fine) — discovered by feeding it one",
        right: "a local cyclic-Jacobi solver for the real-symmetric case (H is real by construction), with the two evolution roads cross-validated (4.4e-16); the family file stays untouched (K-board byte identity) — recorded as a family design boundary",
        category: "machine-overruled",
      },
      {
        wrong: "the tombstone's battery probe was X_0 — an EVEN operator under the chain's Z2, so <E0|X|E1> vanishes by parity and the 'oscillation' was 5e-15 of nothing (a vacuous check wearing a battery's clothes)",
        right: "the machine scans ALL local observables and certifies the one that actually swings (a Z: amplitude 0.6508 at the Bohr period, exact to 1.4e-15); a negative control forbidden by symmetry is no control at all",
        category: "wrong-object",
      },
      {
        wrong: "the eigenbasis fast path transposed the transform — V^T O V instead of V O V^T with rows-as-eigenvectors; the ground state's <Z_0> must vanish by Z2 parity and the wrong transform gave -0.244",
        right: "O~[r,c] = sum V[r,k] O[k,l] V[c,l]; physics (a forced zero) is a free oracle against convention slips",
        category: "wrong-object",
      },
      {
        wrong: "expectationAt scaled only the imaginary part of (rr + i ri)(c + i s) by the observable — the real part was multiplied by nothing",
        right: "both parts multiply the (real) observable: tre*O + i tim*O — the conjugation-side arithmetic family's fourth offense",
        category: "conjugation",
      },
      {
        wrong: "the stationarity check was moved to the eigenbasis fast path, where diagonal states give EXACTLY zero by construction — a check that cannot fail",
        right: "stationarity re-routed through the direct projector-sum evolution (real floating-point cancellation, 3.7e-15); the fast path survives only for the battery scan, cross-checked against the direct road",
        category: "bogus-comparison",
      },
      {
        wrong: "sitePauli seeded the loop with the Pauli itself and prepended n factors — every site operator came out 2^(n+1)-dimensional; the family's mMul shape guard refused 64x64 * 128x128 on the spot",
        right: "build the n-factor array (qubit 0 = low-order bit = LAST tensor factor) and kronAll it; dimension bookkeeping is the coder's, never the kernel's",
        category: "dimension-slot",
      },
      {
        wrong: "the multiplier's independent verifier read a1a0 with bit0 as a0 AND extracted the output nibble with p3 (wire 4) as the LSB — 6/16 'wrong' while the netlist was right; twice the same reversal in the checker, not the checked",
        right: "wire0=a1 (MSB), nibble = p3@4 ... p0@7 MSB-first; the hand trace on x=0101 exposed the checker, and the machine's netlist was acquitted",
        category: "wrong-object",
      },
      {
        wrong: "chainDrift computed (E_0 - E_k)/J(n-1) — negative while the chain heats (energy PAID is the rise)",
        right: "(E_k - E_0)/J(n-1); sign the object before signing the formula",
        category: "wrong-object",
      },
      {
        wrong: "the cross-validation error was folded into batteryPeriodError (Math.max of two different claims under one label)",
        right: "a separate crossValidationError field — a number never travels under another claim's name",
        category: "process",
      },
      {
        wrong: "the pi-pairing tolerance was calibrated at 1e-90 against ONE run's 1.3e-97 (n=6); n=5 gives 2.9e-79 and the gate refused its own witness",
        right: "tolerance states the CLASS claim (structural zero: <= 1e-25), not a snapshot of one run; unit-test assertions get their own seeds (shared-rng state drifts with test order)",
        category: "process",
      },
      {
        wrong: "the repeated-read census applied the phase-flip channel through dense (CD)^3 Kraus multiplies — 8e9 flops per run, 4.5-minute test suite",
        right: "the channel as its mixture form: rho -> (1-q)rho + q Z0 rho Z0 with Z0 diagonal — an O((CD)^2) sign scaling; performance is a correctness debt the timer collects with interest",
        category: "process",
      },
      {
        wrong: "applyClockUnitary's six nested loops cost D^2 C^4 (the (a,b) sum runs per OUTPUT entry), mis-estimated as D^2 C^3 — a 16x surprise at n=5",
        right: "extract each C x C block and transform through the family mMul (F B F+): D^2 C^3 total; the 4.5-minute suite became 20 seconds",
        category: "process",
      },
      {
        wrong: "board literals quoted the scratch run's numbers while the audit witness re-derived different ones in tolerance (rng consumption order differs) — text numbers and witness numbers drifted apart twice in one session",
        right: "censuses get dedicated seeds and the board is written AFTER the witness run (run-then-write, again, until it is reflex); both drifts were caught before shipping by reading the rendered report against the witness lines",
        category: "process",
      },
      {
        wrong: "a bash heredoc python codemod tangled (fourth offense: b25, b26, b36 — the third was being recorded when the fourth fired, the heredoc swallowing the very lines that bury it)",
        right: "code files go through the Write tool, full stop; the lesson has now buried itself twice in one batch",
        category: "process",
      },
      {
        wrong: "~150 noUncheckedIndexedAccess errors (index reads typed number | undefined) — the strict-mode tax every new repo pays at once",
        right: "the family convention: `!` on structurally-safe index reads (the eslint config documents it); the next repo writes them from the first line",
        category: "machine-overruled",
      },
      {
        wrong: "lint: implicit-any JSON.stringify replacer, a template literal on a narrowed `never`, and redundant `!` on consts already narrowed by their initializers",
        right: "explicit param types, a string-typed capture before the template, and --fix for the redundant assertions — tsc and lint each catch what the other blesses",
        category: "machine-overruled",
      },
      {
        wrong: "one FREDKIN line shipped with an unclosed parenthesis — esbuild refused the transform before anything ran",
        right: "the transform error names file:line:col; syntax is the cheapest error class there is",
        category: "toolchain",
      },
      {
        wrong: "scratch.ts left an unused loop variable after the pairing-test reseed",
        right: "noUnusedLocals names it; dead probes are deleted, not silenced",
        category: "machine-overruled",
      },
    ],
  },
  {
    batch: 37,
    repo: "ds_extracted/ds",
    date: "2026-09-06",
    context: "the GENESIS target-A delivery: QuantumSched-Bench (the reproducible benchmark suite that convicted the 0/5 record) plus the flap disposition in the total gate — eight delivery errors, born enrolled",
    source: { file: "memory/2026-09-06.md", heading: "关键经验（第三十七批" },
    errors: [
      {
        wrong: "generator.ts called require() in an ESM/verbatimModuleSyntax repo to import defaultPenalties — and runner.ts repeated the same sin ten minutes later, one file above the freshly written lesson",
        right: "top-level static imports, both files; the second offense fired after the first was already being buried — ESM law is per-file, memory is not a gate",
        category: "machine-overruled",
      },
      {
        wrong: "the bench tests sat in tests/sched-bench/ but imported ../src/... — one level short; the module loader refused with ERR_MODULE_NOT_FOUND",
        right: "count YOUR OWN directory depth before copying a sibling's relative root (batch 29's class); tests/sched-bench needs ../../src",
        category: "process",
      },
      {
        wrong: "writeReports derived its expected cell count from the run's OWN rows.length — the anti-selection check was self-consistent against a forged report (a dropped row passed)",
        right: "expectedCells is minted by runBenchmark (instances x solvers) and carried IN the run object; checkRun compares rows against that mint — the forged-report test convicted the checker itself",
        category: "bogus-comparison",
      },
      {
        wrong: "the smoke test guessed the kernel API (sampleWithReadoutNoise(inst, params, ...) and circuit.angles) instead of reading the copied kernel's law first — both wrong",
        right: "read the signatures, rewrite: sampleWithReadoutNoise(psi, n, optBits, shots, flip, rng), ExportedCircuit.layers — the read-before-cast discipline applies to one's own copy as much as to a sibling's law",
        category: "citation-drift",
      },
      {
        wrong: "prettier format:check flagged out/bench/bench-report.json — a GENERATED artifact dragged into the style gate",
        right: "out/ added to .prettierignore; generated files are exempt from hand style law by declaration, not by luck",
        category: "toolchain",
      },
      {
        wrong: "the flap fix tried first — QUANTUM_DISABLE_PARALLEL=1 on the platform job — DISABLED THE CODE UNDER TEST: three parallel-evolution tests fail by design under the knob (actual null)",
        right: "REJECTED and reverted: a stabilizer that silences the code under test is not a stabilizer; the convicted fix itself is the batch's best entry — the suite overruled its own mechanic",
        category: "machine-overruled",
      },
      {
        wrong: "a `grep -c` with zero matches returns exit 1 and silently broke an && chain — the total gate never ran while the session read the stale artifact",
        right: "exit codes are output; chain gates explicitly or run them one by one — the gate that 'ran' was the previous run's ghost",
        category: "toolchain",
      },
      {
        wrong: "total-gate carried its OWN stale EPOCH_REPOS list (27 entries) while the census listed 28 — dual-list drift, caught because the artifact header said 55 jobs after dtc-clock had landed (batch-37 find, house-registered)",
        right: "both lists updated in step; the dual-list is design debt booked at the enrollment table — single-sourcing the repo list is future work",
        category: "anchor-blindspot",
      },
    ],
  },
  {
    batch: 38,
    repo: "phase-law",
    date: "2026-09-06",
    context: "the combinatorial phase law delivered: envelope theorem (deviation 0), cross-implementation accord with the v1.11 bench (2/2/3 exact), stability-vs-reachability separation, two-face census — two delivery errors, born enrolled",
    source: { file: "memory/2026-09-06.md", heading: "关键经验（第三十八批" },
    errors: [
      {
        wrong: "the phase-law scratch file shipped with a mid-thought residue block (an unused cross-check loop plus two wrapper helpers from before the clean path was chosen) — the batch-36 lesson applied seconds later, but the draft still reached the disk",
        right: "rewritten clean before any run; drafts that reach the disk are drafts the record sees — the residue was caught by re-reading, not by a gate",
        category: "process",
      },
      {
        wrong: "`npx tsx -e` under Git Bash produced NO output for a TS-importing one-liner — the batch-14 environment family recurring four visits later",
        right: "run the scratch FILE instead (the house rule since b14); the -e route stays banned for anything that imports .ts",
        category: "toolchain",
      },
    ],
  },
  {
    batch: 39,
    repo: "phase-law",
    date: "2026-09-06",
    context: "the v0.2.0 scaling campaign (two-face law confirmed, SA crossing monotone 0.925/0.775/0.525, re-entrant tail) plus the 2xn LS-threshold theorem — one delivery error, born enrolled",
    source: { file: "memory/2026-09-06.md", heading: "关键经验（第三十九批" },
    errors: [
      {
        wrong: "an Edit anchored on a section-header comment REPLACED it with the new block — the landscape section's header vanished into the insertion, and the same anchor-swallow fired AGAIN three minutes later on the census envelope header (one class, two files, one sitting)",
        right: "re-insert the swallowed header after the new block, both files; when the anchor IS a section header, the new text must END with that header restored — anchors are splices, not eats",
        category: "process",
      },
    ],
  },
  {
    batch: 40,
    repo: "phase-law",
    date: "2026-09-06",
    context: "the v0.3.0 hardness-island delivery: the coupled-regime decomposition theorem (deviation 8.88e-16), the left face P by own Hungarian, no SA relief to λ=4 — two delivery errors, born enrolled",
    source: { file: "memory/2026-09-06.md", heading: "关键经验（第四十批" },
    errors: [
      {
        wrong: "the b39 header-swallow class recurred TWICE MORE in the same sitting that recorded it — law.ts's landscape header and census.ts's envelope header both eaten by section-anchored inserts, the second while writing the fix pattern for the first",
        right: "both headers restored on the spot; the rule now has teeth in memory: an insert anchored on a section header ENDS with that header verbatim — four offenses in two batches make this the visit's signature error",
        category: "process",
      },
      {
        wrong: "the Hungarian cross-check compared the matching total against the UNCOUPLED-only optimum — the wrong object: at λ=0 coupled assignments score the same W_0, so the correct referee is the λ=0 optimum over ALL assignments; the 0.08 discrepancy was the checker's, not the algorithm's",
        right: "re-pointed at optimumOf(λ=0); the algorithm was acquitted and the wrong-object lesson re-earned: sign the OBJECT before signing the comparison",
        category: "wrong-object",
      },
    ],
  },
  {
    batch: 41,
    repo: "phase-law",
    date: "2026-09-06",
    context: "the v0.4.0 density-axis delivery: the k+1-line envelope theorem (monotone staircase, argmax identity, deviation 0), the all-k right face (integer-exact 0.00e+0), the density census (LS λ-flat at every k, level falls 0.53→0.33→0.27) — three delivery errors, born enrolled",
    source: { file: "memory/2026-09-06.md", heading: "关键经验（第四十一批" },
    errors: [
      {
        wrong: "the k-pair enumerator counted a pair as realized when AT LEAST ONE of its agents was used (pairUsed set on either member) — the v0.1 semantics is BOTH; the k=1 compatibility check convicted it instantly (optima disagree)",
        right: "the leaf recomputes realized pairs by scanning the assignment: pair i fires iff BOTH agents 2i and 2i+1 appear — compatibility is now exact, and the compatibility check itself was the catcher it was built to be",
        category: "wrong-object",
      },
      {
        wrong: "the v0.4.0 scratch shipped with a require() in ESM (the THIRD offense of batch 37's class) plus a dead mid-thought SA adapter block",
        right: "rewritten clean via the Write tool with static imports before any run; the require-in-ESM class is now a named repeat offender — three batches, three sightings",
        category: "machine-overruled",
      },
      {
        wrong: "the all-k decomposition test cases were sized m < 2k — the regime cannot exist there; the shape guard refused with 'all-k regime requires m >= 2k' exactly as designed",
        right: "cases re-sized to (4,6,2) and (6,8,3); a guard refusing a wrong-object call is the guard earning its keep — the refusal itself confirmed the boundary law",
        category: "process",
      },
    ],
  },
  {
    batch: 42,
    repo: "dtc-clock",
    date: "2026-09-06",
    context: "the v0.2.0 lifetime delivery: the isolated closed form (exact agreement), the protection cliff (175x at delta 0.3, collapse to 1.0x by 0.4, locked at 1500 for delta <= 0.2), the front-loaded heating twin — three delivery errors, born enrolled",
    source: { file: "memory/2026-09-06.md", heading: "关键经验（第四十二批" },
    errors: [
      {
        wrong: "a python -c edit carrying a JS template literal was fed through bash — bash treated ${...} as command substitution and swallowed the whole detail string, leaving `detail: ,` in audit.ts; tsc caught the corpse (TS1109) on the next breath",
        right: "code edits with template literals go through the Edit tool, never python -c through bash — the shell's grammar owns backticks and dollars, and it collects",
        category: "toolchain",
      },
      {
        wrong: "a python -c import-patch asserted on an import block that prettier had already reflowed — the assertion fired after the patch's neighbors had run, breaking the gate chain mid-command",
        right: "read the file's CURRENT text before anchoring a patch; prettier owns the layout, assertions anchor on read text",
        category: "process",
      },
      {
        wrong: "the witness-count test still asserted results.length === 6 after W-H made seven",
        right: "count assertions ride with the registry — 7 now; tsc green but the count red: each gate catches what the others bless",
        category: "machine-overruled",
      },
    ],
  },
  {
    batch: 43,
    repo: "dtc-clock",
    date: "2026-09-06",
    context: "the v0.3.0 delivery: the cliff line (honest negative at ED scale — the cliff exists at every J, its location does not track J) and the self-synchronizing clock (bit-flip reads absorbed exactly at the keying layer, the cost one bit of entanglement) — three delivery errors, born enrolled",
    source: { file: "memory/2026-09-06.md", heading: "关键经验（第四十三批" },
    errors: [
      {
        wrong: "a python -c import-patch on audit.ts clobbered the import list wholesale — removing the three lifetime functions the W-H witness block (two sections above) still needed; tsc named all three (TS2304)",
        right: "import edits are additive, not wholesale: the patch adds names to the list as it stands; the sections above still hold their own claims",
        category: "process",
      },
      {
        wrong: "the bit-flip census shipped with dead statements (`void i;`/`void s;`/`void flipZ;`) that the no-void lint rule then rewrote into bare expressions — three no-unused-expressions errors",
        right: "dead statements deleted outright, never voided; --fix on a void is a downgrade, not a repair",
        category: "machine-overruled",
      },
      {
        wrong: "the render-section python anchor missed (the B4 string had a newline inside the quote) — the MISS printed but the surrounding && chain continued on stale success",
        right: "the anchor was re-read from the file and the Edit tool used directly; a MISS is a stop, not a warning",
        category: "process",
      },
    ],
  },
  {
    batch: 44,
    repo: "dtc-clock",
    date: "2026-09-06",
    context: "the v0.4.0 Pauli wall + Hamming armor delivery: Y absorbed, T1 absorbed, the mechanism is the popcount extremes' distance floor(n/2) to the keying boundary — three delivery errors, born enrolled",
    source: { file: "memory/2026-09-06.md", heading: "关键经验（第四十四批" },
    errors: [
      {
        wrong: "the first T1 census draft had muddled Kraus index arithmetic (the K1 branch condition was inside the d2 loop, the loop variable used before its declaration) — tsc named TS2532 four times",
        right: "rewritten from the Kraus algebra directly: out = K0 rho K0 + K1 rho K1 with clean index maps (diagonal scale + index merge), each O((CD)^2)",
        category: "machine-overruled",
      },
      {
        wrong: "the T1 draft shipped inside a bash heredoc with escaped quotes in JS template literals — the escaping survived but the structure collapsed (three unused variables, a dead branch)",
        right: "heredoc code with template literals is now triple-banned (b25/26/36 classes): Write tool always; the T1 census was rewritten via python line-splice with the Write tool for the body",
        category: "process",
      },
      {
        wrong: "the TC24 claim was originally scoped as 'the T1 wall — where self-sync dies' (a negative result expected); the numbers said otherwise — fidelity exactly 1 at every gamma — and the claim was REWRITTEN to the honest positive: the Hamming armor",
        right: "when the machine overrules the expectation, the expectation loses — the board text follows the data, never the other way; the mechanism (popcount extremes, distance floor(n/2) to the boundary) was then derived and witnessed",
        category: "machine-overruled",
      },
    ],
  },
  {
    batch: 45,
    repo: "dtc-clock",
    date: "2026-09-07",
    context: "the v0.5.0 armor dynamics delivery: absorption radius (repetition code [n,1,n], r = floor((n-1)/2)), classical shadow (DP === dense census), majority repair tariff — ten delivery errors across five classes, born enrolled",
    source: { file: "memory/2026-09-07.md", heading: "关键经验（第四十五批" },
    errors: [
      {
        wrong: "the armor DP first drafted `next[i]! += v` — a non-null assertion is an expression, not an assignment target, and tsc rejects it (the transition accumulation, first instance)",
        right: "`next[i] = next[i]! + v` — the family form, visible in clock.ts's applyT1 all along; the kernel was written from the algebra but not reread against the house idiom before compiling",
        category: "toolchain",
      },
      {
        wrong: "the repair map made the same `out[dst]! += rho[src]` mistake in its accumulation loop (second instance, same draft)",
        right: "`out[dst] = out[dst]! + rho[src]` — one class, two instances; the reread-against-the-idiom pass now runs before the first compile, not after",
        category: "toolchain",
      },
      {
        wrong: "the DP's syndrome meter read the PRE-noise mask distribution — one order off the quantum repair census, which meters POST-noise PRE-repair — so the tariff's H(M) would have been the wrong functional of the walk",
        right: "the meter reads the post-transition distribution each period, matching the quantum census's wrongSectorProb placement exactly; the repaired-shadow and quantum syndrome numbers then agree (0.425335 both roads)",
        category: "wrong-object",
      },
      {
        wrong: "the render's first radius table re-ran the exhaustive n=5 censuses in all four columns (+~58s repro) — paying exhaustive cost where the claim is only subset-level",
        right: "exhaustive only where the board claims exhaustive (the absorbed side, 10/10 at n=5); the deterministic wall cell uses one subset with the mechanism stated (q=1 mask alternates 0 and r+1, subset-independent) — repro 148s",
        category: "process",
      },
      {
        wrong: "TC17's price was anchored from memory as sin^2 2delta where the disk has sin^2(2delta) — a parenthesis is part of the anchor, and the Edit missed",
        right: "grep the on-disk text before anchoring (the b22 lesson, again)",
        category: "anchor-blindspot",
      },
      {
        wrong: "package.json's 2 KB description was anchored as one full block for a tail-append — the Edit missed on invisible whitespace",
        right: "long JSON strings get patched structurally via python json round-trip (load, append, dump), never by whole-block replace",
        category: "anchor-blindspot",
      },
      {
        wrong: "`tsx src/...` at the shell: command not found — the runner binary is not on this shell's PATH",
        right: "npx tsx (or the npm scripts that resolve locally) — the probe belonged in npm run from the start",
        category: "toolchain",
      },
      {
        wrong: "the working expectation was 'majority repair always helps the token' — the numbers overruled it: at even n the tie dead zone pins the walk where misses accrue unrecovered, and at 64 periods the PASSIVE refund beats the decoder 10x (n=6, p=0.2: 1.74e-4 vs 1.66e-5)",
        right: "TC27 rewritten to carry the conviction as a finding (the odd/even dichotomy: exact forever at odd n, a long-horizon liability at even n) — the decoder's tie structure is the honest boundary, and the text follows the data",
        category: "machine-overruled",
      },
      {
        wrong: "batch 45 was buried in the burial registry but its eight errors were NOT enrolled in the mutant-census E-board tiers — the total gate's first run went 1 RED with E1 naming b45#0..#7 un-enrolled (the 'born enrolled' law skipped at birth, caught at the gate)",
        right: "enroll b45#0..#7 in the same visit as the burial (the 34/35/36 precedent), and this very miss as b45#8 — the E1 closed loop holding by working exactly as legislated: an error without an enforcement anchor cannot be buried",
        category: "process",
      },
      {
        wrong: "the count prose drifted from the count data: the batch-45 context still said 'eight delivery errors' after b45#8 made it nine, and the visit's memory notes wrote 'nine errors across six classes' where the registry carries FIVE distinct categories (the b36 board-drift / b42 count-lag family, third sighting) — caught by the visitor quoting the stale eight back",
        right: "the reconciliation reads out from the registry, never from memory: 10 entries, five classes (toolchain x3, process x2, anchor-blindspot x2, wrong-object, machine-overruled), 274 declared — and this drift itself enrolled as b45#9; prose counts are a copy of the data, written after reading it",
        category: "process",
      },
    ],
  },
  {
    batch: 46,
    repo: "mutant-census",
    date: "2026-09-07",
    context: "the v0.5.0 genealogy board (G1-G4) + burial-record's B7 count law: families, resolutions, the catch ledger — six delivery errors, born enrolled on both sides",
    source: { file: "memory/2026-09-07.md", heading: "关键经验（第四十六批" },
    errors: [
      {
        wrong: "batch 35's context said 'four delivery errors' while the registry carried FIVE — the count-drift family's oldest member, undetected for two days until B7's own pre-flight convicted it on first fire (the law exposing the history it was written from)",
        right: "the prose aligned to the data ('five'), the finding booked here, and the class is now machine-held: B7 refuses any registry whose stated counts drift from its carried counts",
        category: "process",
      },
      {
        wrong: "the genealogy scratch census first ran as `npx tsx -e` with a multiline program under Git Bash — silent, no output (the b14/b38 family, fifth sighting; the scratch-file rule was already on the books)",
        right: "a scratch file, run once, numbers harvested, file deleted — the rule exists because the shell's quoting rules own backticks and dollar-braces; -e one-liners are for imports only, never multiline",
        category: "toolchain",
      },
      {
        wrong: "the A-fire B7 demo was inserted into anchors.test.ts with its closing `});` swallowed by the edit — tsc named TS1005 at end of file",
        right: "every inserted test block is read back at its closing brace before compiling; the typecheck gate held the line (the conviction demo now closes itself)",
        category: "process",
      },
      {
        wrong: "the render wiring first went through a python heredoc whose anchor on the em-dash T-board line failed its own assert (encoding suspicion, undiagnosed) — the patch aborted before any write",
        right: "heredoc patches with non-ascii anchors are banned outright: Read the file, Edit with the exact on-disk text — the self-set assert did its job and nothing drifted",
        category: "process",
      },
      {
        wrong: "the genealogy test wrote `cd!.latestTier` after an assert.ok narrow — lint named no-unnecessary-type-assertion",
        right: "assert.ok narrows; the bang is for reads before the narrow, not after — the lint gate held the line",
        category: "toolchain",
      },
      {
        wrong: "the genealogy witness was named W-G without grepping the witness-letter table first — W-G was already the anchor census's letter (renamed W-H before any test ran)",
        right: "identifier namespaces are grepped before claimed: witnesses, board letters, anchor names — the collision was caught at render-wiring time by reading the file being edited",
        category: "process",
      },
    ],
  },
  {
    batch: 47,
    repo: "mutant-census",
    date: "2026-09-07",
    context: "the v0.6.0 upgrade: the witness-letter guard (b46#5's tier upgrade), the pre-flight card (G5), burial-record's B8 memory-side count law — four delivery errors, born enrolled on both sides",
    source: { file: "memory/2026-09-07.md", heading: "关键经验（第四十七批" },
    errors: [
      {
        wrong: "the B8 count law's first two drafts matched every 'N处' in the daily notes' free prose — twelve false convictions on the historical record; the pre-flight validation harness convicted the rule before it ever landed on disk",
        right: "the law's object is the ESTABLISHED phrase (交付期X处 in the lesson heading), not any count-like text; a law is validated against the full history before it is written into the checker",
        category: "process",
      },
      {
        wrong: "the fireLive case for the letter guard was drafted through a bash heredoc carrying TS string escapes — the shell ate one layer and planted a REAL newline inside two string literals; the loader convicted the file (esbuild: Unterminated string literal) at test time — the banned heredoc class, FIFTH sighting, in the very visit that upgraded its enrollment",
        right: "the Edit tool, always, for code carrying escapes (b25/26/36/44 — the class now has its own pre-flight card row); the rewrite used join(chr) instead of inline escapes so the pattern cannot recur through quoting layers",
        category: "process",
      },
      {
        wrong: "extending the bridge's LiveBurialError with the right column broke three smuggling fixtures and one unused parameter across two files — tsc named TS2741 (property missing) and TS6133 at four sites",
        right: "when an interface grows, its forgeries grow with it in the same edit — the typecheck gate held the line on all four sites at once",
        category: "toolchain",
      },
      {
        wrong: "the letter guard's anchor was registered FIRING-LIVE without a fireLive case — the A-board's own A3 law convicted the registration on the spot ('did not fire: no live-fire rule'), failing three tests before the case existed",
        right: "a FIRING-LIVE registration and its fire routine ship in the SAME edit — A3 holds the guard author to the guard's own standard",
        category: "process",
      },
    ],
  },
];
