# qverify — Machine verification of the theorem layer behind delegated-computation verification

**未来技术版图 #5：委托计算的量子自验证。** Verification protocols for delegated
quantum computation exist as cryptographic paper proofs (UBQC, FK traps, RUV
rigidity, Mahadev) and as photonic demonstrations (Barz et al. 2013) — the
**theorem layer itself has never been machine-verified**. This prototype makes
the core identities executable and falsifiable: every claim below is a number
reproduced by `npm run repro` (~16 s, deterministic except the measured
wall-clock cost table), guarded by
independent referees on the other side of the computation.

TypeScript strict mode (`exactOptionalPropertyTypes`), zero runtime
dependencies, NodeNext, `node:test`. Ported from the same battle-tested
density-matrix core as the sibling prototypes (ft-qaoa / nonstoq-anneal /
ent-sched / quantum-mech).

## The five theorem pillars

| Pillar | Exact statement | Machine number |
|---|---|---|
| **T1 Blindness** | pad-averaged server view of prepare-and-send UBQC is exactly I/2ⁿ for every secret | trace distance ≤ 2.4e-16 (n = 1..4); angle OTP: standard pads leak exactly 1 bit (the quadrant), full-group pads leak 0 |
| **T2 Trap calculus** | p̄(Λ) = Σⱼ\|c_{j,I}\|² + ½ Σⱼ(\|c_{j,X}\|² + \|c_{j,Y}\|²); reject ≥ ½(1 − idMass), tight | 3-way agreement 4.4e-16 over 60 random CPTP maps; Z detected with certainty, X/Y at exactly ½; t = 20 traps → survival < 1e-6 |
| **T3 CHSH rigidity** | Horodecki S_max = 2√(u₁+u₂); Tsirelson 2√2; pure states S_max = 2√(1+C²) | formula vs direct optimization ≤ 5.2e-13 on Bell/Werner/Schmidt/30 random mixed; Werner threshold F = 1/√2 gives S = 2.000000000000 |
| **T3+ Werner window (v0.2)** | isotropic ρ(v): S = 2√2·v, F = (1+3v)/4 exactly; regimes separable / window / gap / certified at v = 1/3, 1/√2, v* = (7+4√2)/17 | Kaniewski extractability bound ½+½(β−β*)/(2√2−β*) as data; bound never exceeds the honest fidelity (worst −0.000e+0); the isotropic barrier ¼+3β/(8√2) caps any plain-fidelity claim; 2√2·v* = β* to machine zero |
| **T4 Sampling certification** | shadow unbiasedness E[ρ̂] = ρ; mirror closed form (1−λ)^L + (1−(1−λ)^L)/2ⁿ; XEB spoofable | bias ≤ 1e-15 by exact enumeration; mirror sim = closed form to 1e-16; cut-spoof scores F_XEB = 0.436 at TV = 0.294 |
| **T4+ Sample wall (v0.2)** | uniform-rejection counts N_C = ⌈ln(1/δ)/I₀(τ)⌉ (exact Cramér rate over all 2ⁿ values) and N_H = ⌈R²ln(1/δ)/2τ²⌉; shadow counts from exact per-shot moments | n=8 census: N_C = 28 (λ₀=1, δ=0.05) → 5023 (λ₀=0.1, δ=0.001), always ≤ N_H; MC: false-accept 0.0012 ≤ δ = 0.01 at N_C, 0.052 at N/4; shadow σ² = 2.107 exact, batch std matches to 2.5% |
| **T5 Optimal attacks** | Helstrom pair (1+sin π/8)/2; BB84 bit-game = (2+√2)/4 ≡ CHSH value; commit-then-reveal = exactly ½; optimal copy costs exactly 5/6 per trap | all to 1e-12; deferred guess on kept info = (1+⅔ sin π/8)/2 = 0.627561 exactly |
| **T5+ Noise census (v0.2)** | trap calculus under physical noise: phase flips accepted exactly 1−γ (Z-tier), amplitude damping (1+√(1−γ))²/4+γ/4; damped guess game | closed forms vs all three T2 referees to 4.4e-16; phase-flip guess = (1+\|1−2γ\| sin π/8)/2 (V-shaped: coherent noise decouples detection from leakage) |

Negative results, reported as findings: standard UBQC pads leak exactly one
bit (the quadrant) — zero leakage requires the full angle group; traps are a
perfect Z-detector but only half-see X/Y and see nothing that never touches
them; positive XEB is passed by a classically-computed cut distribution; the
Werner window F ∈ (1/3, 1/√2] is PPT-entangled yet CHSH-local — noisy honest
devices can fail rigidity; and even above S = 2 the proven self-testing bound
stays trivial until β* = (16+14√2)/17 ≈ 2.106 (the rigidity gap) — a
violation alone certifies less than folklore suggests; a full-strength phase
flip (γ = 1) leaves the attacker's discrimination untouched while the trap
rejects everything.

## Verification-tier router

`src/router.ts` routes a remote-QPU request across the tiers this repo
machine-checks: `local-exact` (n ≤ 24: replay and compare bit-exactly),
`trap-ubqc` (blindness + traps when the backend speaks UBQC), `statistical`
(shadows/mirror/XEB — spoofable, fidelity-type claims only), and the
`classical-verifier` Mahadev tier (cited roadmap, not implemented).

## Reproduce

```bash
npm ci
npm test          # 60/60
npm run repro     # regenerates out/exp{1..5}-*.md|json in ~16 s
```

Docs: [docs/theory.md](docs/theory.md) (statements, proofs, honest
boundaries), [docs/citations.md](docs/citations.md) (every reference
web-verified against the original source).

## Honest boundaries

- The machine-verified layer covers the **initial-state blindness**, the
  **isolated-trap detection calculus**, the **CHSH/Horodecki rigidity layer**,
  **sampling-estimator exactness**, and **single-shot attack games**. The
  compositional security of full UBQC (adaptive corrections, interleaved
  traps, output checks) and Mahadev's LWE protocol are cited, not re-proved.
- The v0.2 self-testing census carries **published bound shapes as data**
  (Kaniewski's linear extractability bound and its trivial upper barrier),
  re-computed exactly in the (β, F) plane — it does not re-derive them. The
  bound is on **extractability** (fidelity after optimal local channels), a
  weaker guarantee than plain fidelity; the isotropic barrier ¼+3β/(8√2) is
  the exact cap on any plain-fidelity claim, and whether it is achievable is
  not decided here. The Bancal et al. β ≈ 2.37 numerical threshold is cited
  only (swap-trick numerics, not reproducible in-repo).
- The sample-complexity census prices the **statistical** side only: each XEB
  sample still costs the verifier one exact p_ideal(x) evaluation (the
  2ⁿ simulation wall measured in exp4). Shadow counts use the exact
  single-observable moments; the M-observable log(M/δ)·3^ℓ/ε² scaling
  (Huang–Kueng–Preskill) and its matching lower bounds (Lowe et al.) are
  cited, not re-proved.
- The symmetric two-clone Bužek–Hillery machine (both clones at 5/6) is
  cited; the attack analysis uses the optimal **individual-copy** shrink
  channel, which is exact.
- Tsirelson is checked by sampling + the analytic argument in the theory doc;
  a finite sample is a check, not a proof.
- The spoof distribution is computed from the exact marginals here; the
  classical-cost claim of a real cut-based sampler (~2^{n/2} contraction) is
  the standard circuit-cuting argument, cited.
