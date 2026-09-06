# qverify — Machine verification of the theorem layer behind delegated-computation verification

**未来技术版图 #5：委托计算的量子自验证。** Verification protocols for delegated
quantum computation exist as cryptographic paper proofs (UBQC, FK traps, RUV
rigidity, Mahadev) and as photonic demonstrations (Barz et al. 2013) — the
**theorem layer itself has never been machine-verified**. This prototype makes
the core identities executable and falsifiable: every claim below is a number
reproduced by `npm run repro` (17 s, fully deterministic), guarded by
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
| **T4 Sampling certification** | shadow unbiasedness E[ρ̂] = ρ; mirror closed form (1−λ)^L + (1−(1−λ)^L)/2ⁿ; XEB spoofable | bias ≤ 1e-15 by exact enumeration; mirror sim = closed form to 1e-16; cut-spoof scores F_XEB = 0.436 at TV = 0.294 |
| **T5 Optimal attacks** | Helstrom pair (1+sin π/8)/2; BB84 bit-game = (2+√2)/4 ≡ CHSH value; commit-then-reveal = exactly ½; optimal copy costs exactly 5/6 per trap | all to 1e-12; deferred guess on kept info = (1+⅔ sin π/8)/2 = 0.627561 exactly |

Negative results, reported as findings: standard UBQC pads leak exactly one
bit (the quadrant) — zero leakage requires the full angle group; traps are a
perfect Z-detector but only half-see X/Y and see nothing that never touches
them; positive XEB is passed by a classically-computed cut distribution; the
Werner window F ∈ (1/3, 1/√2] is PPT-entangled yet CHSH-local — noisy honest
devices can fail rigidity.

## Verification-tier router

`src/router.ts` routes a remote-QPU request across the tiers this repo
machine-checks: `local-exact` (n ≤ 24: replay and compare bit-exactly),
`trap-ubqc` (blindness + traps when the backend speaks UBQC), `statistical`
(shadows/mirror/XEB — spoofable, fidelity-type claims only), and the
`classical-verifier` Mahadev tier (cited roadmap, not implemented).

## Reproduce

```bash
npm ci
npm test          # 46/46
npm run repro     # regenerates out/exp{1..5}-*.md|json in ~17 s
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
- The symmetric two-clone Bužek–Hillery machine (both clones at 5/6) is
  cited; the attack analysis uses the optimal **individual-copy** shrink
  channel, which is exact.
- Tsirelson is checked by sampling + the analytic argument in the theory doc;
  a finite sample is a check, not a proof.
- The spoof distribution is computed from the exact marginals here; the
  classical-cost claim of a real cut-based sampler (~2^{n/2} contraction) is
  the standard circuit-cuting argument, cited.
