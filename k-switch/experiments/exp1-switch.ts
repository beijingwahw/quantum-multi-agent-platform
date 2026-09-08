/**
 * EXP1 — the 3-switch: isometry certificate, deterministic promise readout,
 * structural plain-order blindness, interleaved spot check.
 *
 * v0.3.0 (quality wave): the private dag/mul/maxDevFrom kernel copies are
 * deleted — experiments/kernels.ts is the single source (exp3's path), and
 * the report below is bit-identical to the pre-refactor render.
 */
import { cmatEye, cmatKron } from "../src/core/cmat.js";
import { Rng } from "../src/kswitch/rng.js";
import {
  S3,
  orderedProduct,
  parityControl,
  switchIsometry,
  switchedControlState,
  controlFidelity,
  uniformControl,
  controlInner,
} from "../src/kswitch/switch.js";
import { anticommutingTriple, commutingTriple, commutatorDev, pureTraceDistance, randomState, applyUnitaryToState, interleavedDistinguishability as interleavedMax, X2, Y2, Z2, I2 } from "../src/kswitch/promise.js";
import { dag, mul, maxDevFrom } from "./kernels.js";
import { table, writeReport } from "./report.js";

function run(): void {
  const failures: string[] = [];
  const rng = new Rng(20260905);
  const comm = commutingTriple();
  const anti = anticommutingTriple();

  // --- A. promise property of the canonical instances
  const devC = Math.max(commutatorDev(comm[0], comm[1]), commutatorDev(comm[1], comm[2]), commutatorDev(comm[0], comm[2]));
  const devA = Math.min(commutatorDev(anti[0], anti[1]), commutatorDev(anti[1], anti[2]), commutatorDev(anti[0], anti[2]));
  if (devC > 1e-14) failures.push(`commuting triple has commutator ${devC}`);
  if (devA < 2 - 1e-12) failures.push(`anticommuting triple commutator ${devA} != 2`);

  // --- B. isometry certificate M†M = I for both instances
  for (const [name, boxes] of [["commuting", comm], ["anticommuting", anti]] as const) {
    const m = switchIsometry(boxes, 4);
    const m2 = mul(dag(m), m);
    const dev = maxDevFrom(m2, cmatEye(24));
    if (dev > 1e-13) failures.push(`${name}: M†M - I deviation ${dev.toExponential(2)}`);
  }

  // --- C. deterministic readout: fidelity 1 with the predicted control state
  const psi = randomState(rng, 4);
  const rhoC = switchedControlState(comm, psi);
  const rhoA = switchedControlState(anti, psi);
  const fC = controlFidelity(rhoC, uniformControl());
  const fA = controlFidelity(rhoA, parityControl());
  const inner = controlInner(uniformControl(), parityControl());
  if (Math.abs(fC - 1) > 1e-12) failures.push(`commuting readout fidelity ${fC} != 1`);
  if (Math.abs(fA - 1) > 1e-12) failures.push(`anticommuting readout fidelity ${fA} != 1`);
  if (Math.hypot(inner.re, inner.im) > 1e-15) failures.push(`<u|u_par> = ${Math.hypot(inner.re, inner.im)} != 0`);

  // --- D. plain fixed-order blindness: output = input up to global phase, all 6 orders,
  //        both promise classes, canonical + random Pauli-type instances
  let worstT = 0;
  const instances: Array<[string, readonly [typeof comm[0], typeof comm[1], typeof comm[2]]]> = [
    ["canonical", comm],
    ["canonical", anti],
  ];
  // extra random Pauli-type anticommuting triple: a random PERMUTATION of
  // (X,Y,Z) ⊗ I — pairwise distinct Paulis are pairwise anticommuting
  const paulis = [X2, Y2, Z2];
  const perm = [0, 1, 2];
  for (let i = 2; i > 0; i--) {
    const j = rng.int(i + 1);
    const tmp = perm[i]!;
    perm[i] = perm[j]!;
    perm[j] = tmp;
  }
  const p3: [typeof comm[0], typeof comm[1], typeof comm[2]] = [
    cmatKron(paulis[perm[0]!] as typeof X2, I2),
    cmatKron(paulis[perm[1]!] as typeof X2, I2),
    cmatKron(paulis[perm[2]!] as typeof X2, I2),
  ];
  instances.push(["random-pauli", p3]);
  for (const [_tag, boxes] of instances) {
    for (let p = 0; p < 6; p++) {
      const prod = orderedProduct(boxes, S3[p]!.seq);
      const out = applyUnitaryToState(prod, psi);
      worstT = Math.max(worstT, pureTraceDistance(out, psi));
    }
  }
  if (worstT > 1e-7) {
    // sqrt formula amplifies the float floor: |<a|b>| = 1-eps gives T = sqrt(2*eps) ~ 2e-8
    failures.push(`plain fixed order not blind: max T = ${worstT.toExponential(2)}`);
  }

  // --- E. interleaved spot check (sampling, honestly labeled; general bound is ARA14's)
  let maxInter = 0;
  for (let t = 0; t < 8; t++) {
    const order = S3[t % 6]!.seq;
    const d = interleavedMax(comm, anti, order, rng);
    maxInter = Math.max(maxInter, d);
  }

  const body =
    `# EXP1 — The 3-switch, executed\n\n` +
    `**A. promise instances verified**: canonical commuting triple commutator ${devC.toExponential(2)} (=0); ` +
    `anticommuting commutator modulus ${devA.toFixed(12)} (=2, the Pauli value).\n\n` +
    `**B. isometry certificate**: M†M = I to <1e-13 for both instances (24-dim: control 6 x system 4).\n\n` +
    `**C. the parity-orthogonality law, executed**: on the commuting instance the control ends EXACTLY in ` +
    `|u> (uniform): fidelity ${fC.toFixed(15)}; on the anticommuting instance EXACTLY in |u_par> ` +
    `(permutation-parity state): fidelity ${fA.toFixed(15)}; <u|u_par> = ${Math.hypot(inner.re, inner.im).toExponential(2)} ` +
    `(3 even - 3 odd = 0). One use of each box, deterministic — dimension-free.\n\n` +
    `**D. plain fixed-order blindness is structural**: every one of the 6 orders, on both canonical instances ` +
    `and a random Pauli-type anticommuting triple, outputs the input up to a global phase — max trace distance ` +
    `${worstT.toExponential(2)}. Commuting triples have order-independent products; anticommuting Pauli triples ` +
    `have products +-c·I. The promise classes are invisible to this whole circuit class.\n\n` +
    `**E. interleaved spot check** (sampling probe, NOT a proof): random unitaries interleaved between the ` +
    `queries, 8 seeds: max distinguishability ${maxInter.toFixed(6)}. The general statement — fixed-order ` +
    `circuits need quadratically more queries — is ARA14's theorem, cited.\n\n` +
    table(
      ["quantity", "value", "anchor"],
      [
        ["commuting control fidelity", fC.toFixed(15), "1"],
        ["anticommuting control fidelity", fA.toFixed(15), "1"],
        ["<u|u_par>", Math.hypot(inner.re, inner.im).toExponential(2), "0"],
        ["plain-order max T (6 orders x 3 instances)", worstT.toExponential(2), "0"],
      ],
    );

  if (failures.length > 0) throw new Error(`exp1 failures:\n${failures.map((f) => `- ${f}`).join("\n")}`);
  const file = writeReport("exp1-switch.md", body);
  console.log(`exp1 done -> ${file} — fC=${fC.toFixed(12)}, fA=${fA.toFixed(12)}`);
}

run();
