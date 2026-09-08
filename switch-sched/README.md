# switch-sched — the theorem layer of indefinite causal order, made executable

Roadmap item #8 ("Epoch 2: causal-order liberation") in honest Epoch-1 form.
The claim on trial: *use the quantum switch so that "allocate first or execute
first" loses its definition — the scheduler no longer orders tasks, because
order itself becomes an optional resource.*

What exists in the literature: the supermap theorems (Chiribella et al. 2013),
the zero+zero→positive capacity theorem (Ebler-Salek-Chiribella 2018), photonic
demonstrations (Procopio 2015, Rubino 2017, Goswami 2018), the causal
inequality and its process-matrix violation (Oreshkov-Costa-Brukner 2012), and
the 2023–2026 device-independent turn (van der Lugt 2023; Guo et al. 2025;
Richter et al. 2025). What did **not** exist — and what this repo delivers —
is the certificate layer: nobody had machine-verified the switch's theorem
statements, nobody had mapped when order-superposition actually helps
scheduling primitives, and the OCB causal witness itself had no executable
certificate (v0.2.0 adds it: T5).

**Engineering:** TypeScript strict mode (exactOptionalPropertyTypes), zero
runtime dependencies, NodeNext, `node:test`. `npm run repro` rebuilds every
report in seconds. Every number in `reports/` is exact linear algebra — no
sampling anywhere in a theorem claim.

## The five layers

**T1 — switch algebra** (`src/experiments/exp1-switch-algebra.ts`)
- The switch as an executable isometry with certificate M†M = I (a valid
  physical process, not a postselected fiction).
- Commutation task: decide whether two black-box involutions commute or
  anticommute — the switch reads |+⟩/|−⟩ **deterministically, one use of each
  box** (fidelity 1.000000000000 on four instance families).
- Irreducibility, strengthened to a per-class statement: the plain fixed-order
  class is fooled by global-phase-matched instances; the
  coherent-control-of-gates class is fooled by matrix-equal-product instances
  (global phase becomes observable under control — phase kickback); **each
  class has its fooling pair, the switch has none.**
- Control-displacement witness Δ_c: fixed orders leave the control untouched
  (0 exactly); the replacer-pair switch displaces it by exactly 1/2.
- Dilation independence: three dilations of the same channel give identical
  switched output (≤ 3.5e-18) — the supermap is well-defined on the channel.

**T2 — capacity theorem** (`src/experiments/exp2-capacity.ts`)
- Replacer pair (each channel: T = 0, χ = 0): switched control register
  carries T = 1/2, Helstrom 3/4, χ = H₂(1/4) − 1/2 bits — closed forms,
  asserted.
- Completely depolarizing pair: the information lives **only in the joint
  (control, target) state** — both marginals exactly zero, joint T = 1/4.
  The receiver must measure jointly.
- Asymmetry sweep (depol(p), depol(1)): all definite orders closed for every
  p; the switched joint distinguishability obeys the exact linear law
  **T = p/4**.
- Priority for the general theorem: Ebler-Salek-Chiribella, PRL 120, 120502
  (2018). We certify positive accessible information; the capacity
  optimisation itself is cited, not reproduced.

**T3 — scheduling contact surface** (`src/experiments/exp3-sched-contact.ts`)
Allocation/execution as CPTP maps on a machine register; receiver = the
machine register (the scheduling-relevant one).
- Realistic pair (alloc vs exec(γ)): closed forms D(AB) = 1−γ, D(BA) = 1, and
  **D(switch) = (1−γ)/2** — order superposition carries HALF the signature of
  even the worse definite order. The best fixed order dominates at every γ.
- ESC-shaped column (allocation write erased with prob ε): exact law
  **D(switch) = (1−ε)/4**; at ε = 1 everything closes, including the switch.
  Contrast with T2 sharpens the admission criterion: **order pays only when
  the payload TRANSITS erasing channels on both branches** — an
  allocation-created payload erased after the fact gets no rescue.
- Random CPTP pairs (40 seeds): system-register receiver never wins (median
  deficit −0.15, 0/40 positive); joint receiver wins 34/40, partly on the
  strength of an extra output register — reported with that caveat, see
  docs/theory.md.

**T4 — the mechanism wall** (`src/experiments/exp4-mechanism.ts`)
- Toy posted-price mechanism, deviation family R_y(θ), exact arithmetic:
  - Definite order: DSIC holds (max gain ≤ 0).
  - Switched order, measurement-style allocation: utility is EXACTLY
    ½(U_def + U_raw) — deviation gains halve, never flip sign. IC preserved.
  - Switched order, coherent (CNOT) allocation: the mixture law survives
    exactly (machine's surprise verdict): cross-branch coherences cancel out of
    the payoff marginal. For this mechanism family, order indefiniteness
    rescales the incentive landscape; it does not invert it. Echoes quantum-mech
    T1 (affine utility = conservation beats deviation).

**T5 — the process-witness face** (`src/experiments/exp5-process-witness.ts`,
new in v0.2.0) — the causally-separable comparison class, machine-checked
at d = 2 per wire (the OCB 2012 layer that v0.1.0 could only cite):
- The "guess your partner's input" game as a linear functional S_game on
  process space; causal witness S = (3/16)𝟙 − S_game with
  Tr[S W] = ¾ − p_succ(W) on every valid process (Tr W = 4).
- Exhaustive classical census: ALL 8192 deterministic strategies of BOTH
  definite orders cap at exactly ¾ (256 achievers) — shared randomness
  cannot lift a vertex cap.
- The OCB process matrix W = ¼[𝟙 + (σ_z^{A2}σ_z^{B1} +
  σ_z^{A1}σ_x^{B1}σ_z^{B2})/√2]: eigenvalues exactly {0, ½} (8-fold each),
  normalization ≤ 2.2e-16, term types {∅, A2B1, A1B1B2} (both causal
  directions present); game value (2+√2)/4 by TWO independent computations
  (functional; from-scratch Born loop); witness −(√2−1)/4.
- Isotropic robustness: W(ν) = νW_OCB + (1−ν)𝟙/4 is valid for all ν and
  violates iff ν > 1/√2 (bisected to 2.2e-16 of the closed form).
- The switch contrast: the T1 quantum switch plays the SAME game at exactly
  5/8 < ¾ — order indefiniteness is NOT causal-inequality violation
  (machine echo of van der Lugt et al. 2023; see also the 2025–2026
  experimental line: Guo et al. arXiv:2506.20516 / Sci. Adv. aee2912;
  Richter et al. arXiv:2506.16949 — anchored, not reproduced).
- Convention debt paid: v0.1.0's half-built process layer had the wrong CJ
  convention on complex Kraus, a double-counted ½, and a fabricated census
  size; all caught and fixed by new circuit-vs-process anchors (agreement
  2.2e-16 over complex random instances).

## Verdict on the Epoch-2 claim

- **Proven and now machine-certified:** order is a real resource — zero+zero
  channels transmit through it (T2); the switch does things no fixed-order
  circuit does with the same box uses (T1); the general-class comparison now
  has a machine-checked instance — the OCB process beats EVERY classical
  causal strategy (census-exhaustive) at (2+√2)/4 vs 3/4 (T5).
- **Walls, each with numbers:** the scheduler's product is a classical
  decision; reading it is a measurement that collapses the order (T3: the
  machine register never gains, and on the realistic pair strictly loses);
  known switch advantages are structural (erasing-channel admission), not
  generic (0/40 random pairs); mechanism-design incentives survive switching
  in this toy with gains halved (T4) — the DSIC direction is order-free here;
  and the switch itself does NOT violate the causal inequality it is
  superficially closest to — 5/8 < 3/4 (T5): order indefiniteness and
  causal-order violation are different claims, and this repo now separates
  them with numbers.
- **Open (stated as open):** incentive constraints under genuinely coherent
  allocation with quantum types; multi-party causal games; beyond the OCB
  witness instance — other causal inequalities, higher dimensions, the full
  quantum separable classification, device-independent variants (2023–2026
  experimental line cited, anchored, not machine-checked).

## Layout

```
src/core/        complex LA, channels (partial trace), measures (T, F, S, χ), rng
src/switch/      Stinespring machinery, branch/switch isometries, chanlib,
                 witnesses, capacity helpers
src/process/     OCB process layer: CJ convention (pinned by circuit anchors),
                 the guess-your-partner's-input game + census + switch game,
                 term-type judge, W_OCB + witness certificates (gypi/cj/
                 termtype/wocb)
src/experiments/ exp1..exp5 + run-all (npm run repro)
test/            anchor suite (closed forms vs machine, judges, smuggling trials)
docs/            theory.md (derivations), citations.md (web-verified register)
reports/         generated markdown, one per experiment
```

## Honest boundaries

1. No new separation from classical/definite-order computation is claimed;
   every "cannot" here is either a cited theorem or a computed instance.
2. The irreducibility check exhausts the no-ancilla and
   coherent-control-of-gates classes on enumerated Pauli families; the full
   4-vs-2 query bound (ancilla-assisted) is Chiribella et al.'s theorem.
3. Capacity results are accessible-information certificates (single-use T,
   binary-ensemble χ), not optimal capacities.
4. T3's random-pair statistics cover d = 2, env dim 2, 40 seeds — a sample,
   not a classification.
5. T4 is one toy mechanism and one deviation family: an executable probe, not
   a theorem about mechanism design without causal order.
6. T5 machine-checks ONE causal inequality (OCB's) at d = 2 per wire. The
   classical cap is census-exhaustive (8192 vertices, shared randomness
   included by linearity); the QUANTUM causally-separable side is a sampled
   battery (120 definite-order processes + shared Bell) plus OCB's cited
   theorem — not an exhaustive classification of the separable set. The
   switch-plays-the-game number (5/8) covers the canonical instruments and
   one target preparation: a computed instance, not a claim over all switch
   strategies (the all-strategies statement is van der Lugt et al.'s,
   cited). Device-independent and multi-party variants are cited anchors
   only.
7. `npm run repro` was a silent no-op until the v0.2.0 wiring fix: run-all
   merely imported the exp modules and the entry guards (correctly)
   suppressed their mains — exit 0 without a single report re-rendered
   (exit 0 is not "ran"). The runner now calls the exported mains directly
   and verifies all five rendered; the defect is documented at the head of
   `src/experiments/run-all.ts`.
