# experiments/qpu-cross-validation — the QPU cross-validation pipeline (GENESIS 目标 B)

The platform-side home of the local-exact-engine vs real-QPU cross-validation
experiment, per the Wukong-180 machine-time application's own specification:
**all variational parameters optimized offline; machine time spent only on
verification sampling.** The canonical, fully gated implementation lives in
the workspace repo `wukong-crossval` (12/12 tests, smuggling trials, rendered
package report); this copy is the platform entry the GENESIS task book
requires. Regenerate by copying `wukong-crossval/src/kernel/crossval.ts`
over `kernel.ts` — the smoke test below pins the interface so a drifted copy
fails loudly.

Contents (all seeded, all deterministic):

- **X1 the instance set** — 20 instances at 8/12/16/20 qubits (5 linear +
  15 NP-hard coupled), every optimum by exhaustive enumeration (the only
  referee), linear optima verified on a second path.
- **X2 offline optimization** — exact-statevector QAOA (p = 1..3), effort
  tiered by size; the dry-run QPU never feeds back into optimization.
- **X3 the dry-run QPU** — sample the optimized state with symmetric
  per-qubit readout flips (provenance stated), report raw/observed/calibrated
  hit rates; at zero noise observed === raw within MC error.
- **X4 the export format** — Qiskit-compatible JSON circuits (offline angles
  + cost coefficients + shots); the Sinan toolchain is the documented
  consumer.
- **X5 the falsifier** — if the hit rate decays at the noise boundary, the
  decay scaling IS the result (reported as found, never selected).

Honest boundary: the noise model is synthetic (symmetric flips) and says so;
real readout confusion matrices arrive with the granted hours' calibration
stage. Nothing here touches the real machine; everything runs the day it is
available.

Reproduce: `npx tsx --test tests/qpu-crossval-smoke.test.ts` (the smoke gate)
or the full gated suite in the `wukong-crossval` workspace repo.
