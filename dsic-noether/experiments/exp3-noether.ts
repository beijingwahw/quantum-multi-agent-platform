/**
 * EXP3 — the discrete Noether theorem, executed (Marsden-West midpoint).
 *
 * A. closedness identity: the derivative-based value equals the CLOSED FORM
 *    h(a_x - a_y) mid_x mid_y to rounding — certifying the derivation itself
 * B. symmetry => closed: the identity is ~1e-16 for the isotropic potential;
 *    broken symmetry gives a systematically nonzero value (the "curl")
 * C. along DEL trajectories: the charge J is conserved to rounding scale for
 *    the symmetric potential and drifts when symmetry breaks
 */
import {
  closednessClosedForm,
  closednessComputed,
  trajectory,
  type Quad,
  type Vec2,
} from "../src/physics/variational.js";
import { Rng } from "../src/core/rng.js";
import { table, writeReport } from "./report.js";

function run(): void {
  const failures: string[] = [];
  const rng = new Rng(27182);

  const iso: Quad = { ax: 1, ay: 1 };
  const broken: Quad = { ax: 1, ay: 4 };

  // --- A: derivation certificate (both quads, random pairs)
  let worstDeriv = 0;
  for (let t = 0; t < 200; t++) {
    const q: Vec2 = { x: rng.next() * 2 - 1, y: rng.next() * 2 - 1 };
    const qPlus: Vec2 = { x: rng.next() * 2 - 1, y: rng.next() * 2 - 1 };
    const h = 0.01 + rng.next() * 0.1;
    for (const quad of [iso, broken]) {
      worstDeriv = Math.max(worstDeriv, Math.abs(closednessComputed(q, qPlus, h, quad) - closednessClosedForm(q, qPlus, h, quad)));
    }
  }
  if (worstDeriv > 1e-13) failures.push(`closed-form derivation deviates: ${worstDeriv}`); // floor ~1e-14: terms up to |q+-q|/h ~ 56
  console.log(`A. closedness identity matches closed form h(a_x-a_y)mx my, worst dev ${worstDeriv.toExponential(2)}`);

  // --- B: closed vs nonzero
  let worstIso = 0;
  let maxBroken = 0;
  for (let t = 0; t < 200; t++) {
    const q: Vec2 = { x: rng.next() * 2 - 1, y: rng.next() * 2 - 1 };
    const qPlus: Vec2 = { x: rng.next() * 2 - 1, y: rng.next() * 2 - 1 };
    const h = 0.05;
    worstIso = Math.max(worstIso, Math.abs(closednessComputed(q, qPlus, h, iso)));
    maxBroken = Math.max(maxBroken, Math.abs(closednessComputed(q, qPlus, h, broken)));
  }
  if (worstIso > 1e-13) failures.push(`symmetric potential not closed: ${worstIso}`); // floor ~1e-14
  if (!(maxBroken > 1e-2)) failures.push(`broken symmetry curl not exhibited: ${maxBroken}`);
  console.log(`B. symmetric: |closedness| <= ${worstIso.toExponential(2)} (form closed); anisotropic max |curl| ${maxBroken.toExponential(2)}`);

  // --- C: charge conservation along trajectories
  const h = 0.05;
  const q0: Vec2 = { x: 1, y: 0 };
  const q1: Vec2 = { x: Math.cos(h), y: Math.sin(h) };
  const trajIso = trajectory(q0, q1, 400, h, iso);
  const trajBroken = trajectory(q0, q1, 400, h, broken);
  if (trajIso.maxResidual > 1e-13) failures.push(`iso DEL residual ${trajIso.maxResidual}`);
  if (trajBroken.maxResidual > 1e-13) failures.push(`broken DEL residual ${trajBroken.maxResidual}`);
  if (trajIso.maxJDrift > 1e-12) failures.push(`iso charge drift ${trajIso.maxJDrift}`);
  if (!(trajBroken.maxJDrift > 1e-3)) failures.push(`broken charge drift not exhibited: ${trajBroken.maxJDrift}`);
  console.log(`C. DEL residuals <= ${Math.max(trajIso.maxResidual, trajBroken.maxResidual).toExponential(2)}; J drift: symmetric ${trajIso.maxJDrift.toExponential(2)}, broken ${trajBroken.maxJDrift.toExponential(2)} (J0 = ${trajIso.j0.toFixed(4)})`);

  const body = [
    "# EXP3 — discrete Noether, executed",
    "",
    "## A. the closedness identity has a closed form",
    "",
    "D_1 L_d·xi_Q(q) + D_2 L_d·xi_Q(q+) = h (a_x - a_y) mid_x mid_y —",
    `derivative-based value matches it to ${worstDeriv.toExponential(2)} over random pairs, both quads
(the guard 1e-13 sits above the ~1e-14 rounding floor of the |q+ - q|/h terms).`,
    "",
    "## B. symmetry => closed 1-form",
    "",
    table(["potential", "max |closedness| over random pairs"], [
      ["isotropic a_x = a_y = 1", worstIso.toExponential(2)],
      ["anisotropic (1, 4)", maxBroken.toExponential(2)],
    ]),
    "",
    "## C. the charge along DEL trajectories (400 steps, h = 0.05)",
    "",
    table(["potential", "max DEL residual", "max |J_k - J_0|"], [
      ["isotropic", trajIso.maxResidual.toExponential(2), trajIso.maxJDrift.toExponential(2)],
      ["anisotropic", trajBroken.maxResidual.toExponential(2), trajBroken.maxJDrift.toExponential(2)],
    ]),
    "",
    "Discrete Noether (MW01): exact invariance of L_d under the diagonal",
    "rotation => the momentum-map charge is conserved EXACTLY in exact",
    "arithmetic; the machine sees rounding scale. Break the symmetry and the",
    "charge drifts by orders of magnitude more — the same algebra as the",
    "mechanism side: gauge symmetry => charge invariant; broken rule =>",
    "positive cycles.",
    "",
  ].join("\n");
  const file = writeReport("exp3-noether.md", body);

  if (failures.length > 0) {
    console.error("EXP3 FAILURES:");
    for (const f of failures) console.error(`  - ${f}`);
    process.exitCode = 1;
  } else {
    console.log(`EXP3 OK — ${file}`);
  }
}

run();
