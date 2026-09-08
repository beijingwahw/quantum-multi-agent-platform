# ⚛️ Quantum Multi-Agent Development & Scheduling Platform

> 🇨🇳 **中文版（主文档）**: [README.md](./README.md) — the diagrams' in-figure labels are Chinese; captions below each embed carry the key English terms.

![version](https://img.shields.io/badge/version-1.12.0-blue)
![tests](https://img.shields.io/badge/tests-520-brightgreen)
![typescript](https://img.shields.io/badge/TypeScript-5.9%20strict-blue)
![node](https://img.shields.io/badge/node-%3E%3D22-green)
![license](https://img.shields.io/badge/license-MIT-lightgrey)

A multi-agent platform whose scheduling core runs **real quantum algorithms** (QAOA / adiabatic annealing / Born-rule measurement collapse). Task assignments are encoded as Hamiltonians and evolved **exactly** inside the constraint subspace — jointly scheduling batches up to the **equivalent of 80 qubits** (full-space simulation would need ~10¹⁵ TB of memory), and hitting the exact optimum **5/5** on NP-hard coupled instances where the best classical opponent scores **3/5** (reproducible via `npm run bench`; v1.11 unified-accounting erratum in the baselines section).

![Architecture](docs/diagrams/01-architecture.png)

All 18 diagrams in the README set are rendered from **real artifacts** (`out/bench/bench-report.json` + published measured numbers) by [`docs/diagrams/generate.py`](./docs/diagrams/generate.py).

## Highlights

| | Capability |
|---|---|
| ⚛️ | **Real quantum physics**: complex-amplitude statevectors, unitary evolution, variational QAOA, adiabatic annealing, Born-rule collapse |
| 🌌 | **Constraint-subspace breakthrough**: exact evolution over valid assignments (dim P(n,m)), penalty-free, closed-form fiber mixers, 80 equivalent qubits |
| 🔗 | **Entanglement = physical coupling**: entangled agent pairs enter the Hamiltonian and demonstrably flip the joint optimum |
| 🏆 | **Certified classical baselines**: point-wise agreement with Hungarian O(n³) on linear instances; 5/5 wins on NP-hard coupled instances |
| 🔌 | **Real QPU backend layer**: D-Wave Leap REST client + IBM Qiskit program export + automatic fallback to the local exact engine |
| 🧭 | **Execution-tier routing (v1.11)**: FTQC resource estimator decides per task — NISQ dispatch, FTQC queue via `FtqcDeferredError`, or classical fallback |
| 🧠 | **Market-mechanism research**: CompoundBrain (DSIC theorem + online learning-curve calibration), batch VCG, phase-transition laws |

## Quantum Scheduling Core

The pipeline below is the essence: every batch goes through a complete encode → evolve → observe quantum process.

![Pipeline](docs/diagrams/02-pipeline.png)

**Hamiltonian encoding** — affinity weights `w` enter the diagonal, entangled agent pairs enter coupling terms `J` that shift the ground state (i.e., flip the optimal joint assignment):

![Hamiltonian](docs/diagrams/03-hamiltonian.png)

**Constraint subspace** — 8 tasks × 10 agents is 2⁸⁰ ≈ 1.2×10²⁴ dimensions in full space (~10¹⁵ TB, infeasible) but only P(n,m) = 1,814,400 valid assignments (~150 MB, exact solve in 42 s). The constraint lives in the basis itself — zero penalty terms:

![Subspace](docs/diagrams/04-subspace.png)

**Fiber mixers** — with all other tasks fixed, a single task's move adjacency is the complete graph K_k = J − I, whose exponential has a closed form: applied per fiber exactly in O(dim), zero Trotter error. The adiabatic start is the uniform superposition (Perron–Frobenius):

![Fiber](docs/diagrams/05-fiber.png)

**QAOA & angle layouts** — alternating cost/mixer layers, plus ma-QAOA (per-operator angles, v1.10) whose dominance over layer mode is a **constructive theorem** (seeded coordinate descent accepts only strict improvements ⇒ ⟨E⟩_multi ≤ ⟨E⟩_layer always):

![QAOA](docs/diagrams/06-qaoa.png) ![ma-QAOA](docs/diagrams/13-ma-qaoa.png)

**Adiabatic annealing & Born collapse** — discrete-grid integration of H(s) = (1−s)(−ΣA) + sC with closed-form fiber rotations (every step an exact unitary); the final measurement is a genuine Born-rule readout — `decision.probability` is a real quantum probability:

![Annealing](docs/diagrams/07-annealing.png) ![Born](docs/diagrams/08-born.png)

## Real QPU & Execution Tiers

`toIsing()` exports (h, J) directly submittable to real quantum annealers — same problem, different execution venue, no code change. Real-hardware samples pass three gates (validity, noise filtering, optimality cross-check). v1.11 adds FTQC execution-tier routing:

![Execution tier](docs/diagrams/15-execution-tier.png)

## Market Mechanism Line

Task allocation as a **market for intellectual capital**: settlement streams calibrate learning curves q̂(k) online, an augmented WDP solves allocation, Clarke pivot payments keep it DSIC. Measured on a real LLM (n=2112): implicit skill rises 0.458→0.747; a poisoned case library collapses q to 0.129 (negative capital).

![Market](docs/diagrams/14-market.png)

## Benchmarks & Performance

> Reproducible since v1.11: `npm run bench` re-runs the whole comparison (50 instances × 7 solvers; `bench:regenerate` rebuilds from public seeds). The referee is always brute-force enumeration under one accounting.

- **Scale ladder** — 30→80 equivalent qubits, annealing optimality 100.0% at every rung (8×10: 1,814,400 dims, exact optimum, greedy gap 6.7%):
  ![Ladder](docs/diagrams/09-ladder.png)
- **Linear track** — quantum subspace × Hungarian O(n³): **both 25/25 point-wise optimal** (independent-algorithm cross-validation):
  ![Linear](docs/diagrams/10-bench-linear.png)
- **NP-hard coupled track** (6×8 × 5 public seeds, unified accounting): greedy 2/5, local search 2/5, simulated annealing 3/5, **quantum 5/5**:
  ![NP-hard](docs/diagrams/11-bench-nphard.png)

  > ⚠️ **Erratum (v1.11)**: an earlier table read "greedy 0/5, local search 0/5" — an accounting artifact (classical side scored without coupling bonuses against a coupling-aware optimum). Under the single accounting the classical side scores 2/5; the verdict stands (5/5 vs best classical 3/5), the margin restated honestly.

- **Deterministic parallel evolution (v1.6)** — 8×10 evolution 285.8 s → 56.2 s (5.1×) → **12.2 s with 16 threads (23.5×)**, bitwise identical to serial (worker_threads + SharedArrayBuffer + Atomics; every fiber owned by one thread; pinned by bit-level tests):
  ![Parallel](docs/diagrams/12-parallel.png)
- **Hot-path performance** (classical hybrid mode, `npm run performance`): scheduling 2,702 ops/s (83×), bus 487,448 msgs/s (4.3×), agent registration 28,500 ops/s (4.7×), DSH 4,791 ops/s (3.2×):
  ![Hot path](docs/diagrams/17-hotpath.png)

## Quick Start

```bash
git clone https://github.com/beijingwahw/quantum-multi-agent-platform.git
cd quantum-multi-agent-platform && npm install
npm test                 # 520 tests · 0 failures
npm run typecheck        # strict + noUncheckedIndexedAccess, whole repo
npm run bench            # QuantumSched-Bench full comparison
npm run example:qpu      # real-QPU entry (auto-detects DWAVE_API_TOKEN)
npm run dev              # start the platform (WS :8080)
```

## Tests & Quality

**520 tests · 0 failures · 48 files / 152 suites**; six gates green; coverage ratchet 92/82/92/92 with measured 94.2% statements / 86.2% branches; knip dead-code sweep clean; single runtime dependency (`ws`).

![Quality gates](docs/diagrams/16-quality.png)

Security baseline: command allowlist + metacharacter rejection, filesystem sandbox on realpaths, opt-in shared-token bus auth (timing-safe), `__proto__`-key rejection, https-only QPU endpoints.

## Version Timeline

![Timeline](docs/diagrams/18-timeline.png)

## Honest Boundaries

1. The quantum core is an **exact classical simulation** of the Schrödinger equation, not a real QPU.
2. Subspace dimension still grows combinatorially as P(n,m), capped at 2²⁰ by default (~150 MB); the 8×10 case is a **decision-quality mode**, not the hot path.
3. High-throughput hot paths (>10³ tasks/s) stay on the classical `hybrid` heuristic.
4. Every optimality ratio and probability is a genuine observable of the final state; optimum references come from subspace enumeration (exact up to 2²¹ dimensions), never extrapolated.
5. The annealing-level, Born-distribution and fiber diagrams are formula-derived schematics (labeled as such); all measured numbers come from command artifacts.

## License

MIT © Quantum Agent Team
