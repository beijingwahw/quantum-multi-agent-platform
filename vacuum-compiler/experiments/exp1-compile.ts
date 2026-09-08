/**
 * EXP1 — the compiler certificate.
 *
 * A. gate library unitarity
 * B. H_prop |Psi_hist> = 0 for random circuits x random inputs (the deed)
 * C. ground-state degeneracy accounting: 2^n (all inputs) -> 2^(n-k) (k checked)
 * D. input/output checks: accepting program has E=0 ground, rejecting program
 *    has E>0 (the QMA-witness semantics at toy scale)
 * E. static readout: P(T) = 1/(T+1) exactly, conditional fidelity exactly 1
 */
import { type CVec, cmatApplyMaxNorm, cvecInner, eigenvaluesHermitian } from "../src/core/cmat.js";
import { assertGateLibrary } from "../src/compile/gates.js";
import { dataBasisState, demoProgram, program, randomCircuit, runCircuit } from "../src/compile/circuit.js";
import { assemble, buildPropagation } from "../src/compile/hamiltonian.js";
import { clockRho, historyState, staticReadoutFidelity } from "../src/compile/history.js";
import { Rng, randomDataState } from "../src/compile/rng.js";
import { table, writeReport } from "./report.js";

function groundCount(values: Float64Array, tol: number): number {
  let c = 0;
  for (const v of values) if (Math.abs(v) < tol) c++;
  return c;
}

function run(): void {
  const failures: string[] = [];

  // --- A. gate library
  try {
    assertGateLibrary();
  } catch (e) {
    failures.push(`gate library: ${(e as Error).message}`);
  }
  console.log("A. gate library unitary-verified (H/X/Y/Z/S/T/CNOT)");

  // --- B. the deed: H_prop |Psi_hist> = 0
  const deedRows: string[][] = [];
  let worstDeed = 0;
  const instances: Array<{ n: number; T: number; seed: number }> = [
    { n: 2, T: 4, seed: 101 },
    { n: 2, T: 6, seed: 102 },
    { n: 3, T: 4, seed: 103 },
    { n: 3, T: 6, seed: 104 },
  ];
  for (const inst of instances) {
    const r = new Rng(inst.seed);
    const circuit = randomCircuit(inst.n, inst.T, r);
    const h = buildPropagation(inst.n, circuit.steps);
    let worst = 0;
    for (let trial = 0; trial < 3; trial++) {
      const input = randomDataState(2 ** inst.n, r);
      const psi = historyState(circuit, input);
      worst = Math.max(worst, cmatApplyMaxNorm(h, psi));
    }
    worstDeed = Math.max(worstDeed, worst);
    deedRows.push([`n=${inst.n}, T=${inst.T}, seed=${inst.seed}`, circuit.steps.map((s) => s.name).slice(0, 6).join(","), worst.toExponential(2)]);
    if (worst > 1e-14) failures.push(`deed violated n=${inst.n} T=${inst.T}: ${worst}`);
  }
  console.log(`B. H_prop|Psi_hist> = 0, worst deviation ${worstDeed.toExponential(2)}`);
  if (worstDeed > 1e-14) failures.push(`B deed: ${worstDeed}`);

  // --- C. degeneracy accounting
  const degRows: string[][] = [];
  {
    // n=2, T=4: bare prop -> 4 ground states; +check q0 -> 2; +check q0,q1 -> 1
    const circuit = randomCircuit(2, 4, new Rng(205));
    for (const checked of [[], [0], [0, 1]] as const) {
      const prog = program(circuit, checked, new Map());
      const comp = assemble(prog, { output: false });
      const vals = eigenvaluesHermitian(comp.h);
      const count = groundCount(vals, 1e-9);
      const expected = 2 ** (2 - checked.length);
      degRows.push([`checked=[${checked.join(",")}]`, String(count), String(expected)]);
      if (count !== expected) failures.push(`degeneracy checked=[${checked.join(",")}] : ${count} != ${expected}`);
    }
  }
  console.log("C. degeneracy accounting (bare 2^n -> 2^(n-k) with k checked qubits)");

  // --- D. witness semantics on the demo program
  const witnessRows: string[][] = [];
  {
    const demo = demoProgram();
    const accept = assemble(demo, { output: true });
    const valsA = eigenvaluesHermitian(accept.h);
    witnessRows.push(["accepting (q1=1 at T)", (valsA[0] as number).toExponential(2), "0"]);
    if (Math.abs(valsA[0] as number) > 1e-10) failures.push(`accepting ground energy ${valsA[0]}`);

    const reject = program(demo.circuit, demo.checkedQubits, new Map<number, 0 | 1>([[1, 0]]));
    const compR = assemble(reject, { output: true });
    const valsR = eigenvaluesHermitian(compR.h);
    const e0 = valsR[0] as number;
    // rejecting instance: ground energy > 0 (penalty ~ presence at clock T of
    // non-accepting data, diluted by the 1/sqrt(T+1) history amplitude)
    witnessRows.push(["rejecting (q1=0 at T)", e0.toFixed(6), "> 0"]);
    if (!(e0 > 1e-4)) failures.push(`rejecting ground energy not lifted: ${e0}`);
  }
  console.log("D. witness semantics: accept => E0 = 0, reject => E0 > 0");

  // --- E. static readout
  const readoutRows: string[][] = [];
  let worstFid = 0;
  for (const inst of instances) {
    const circuit = randomCircuit(inst.n, inst.T, new Rng(inst.seed + 1));
    const input = dataBasisState(inst.n, new Array(inst.n).fill(0));
    const target = runCircuit(circuit, input);
    const { probT, fidelity } = staticReadoutFidelity(circuit, input, target);
    worstFid = Math.max(worstFid, Math.abs(1 - fidelity));
    const expectP = 1 / (inst.T + 1);
    readoutRows.push([`n=${inst.n}, T=${inst.T}`, probT.toFixed(12), expectP.toFixed(12), fidelity.toFixed(12)]);
    if (Math.abs(probT - expectP) > 1e-12) failures.push(`P(T) ${probT} != ${expectP}`);
    if (Math.abs(1 - fidelity) > 1e-12) failures.push(`fidelity ${fidelity}`);
  }
  // clock marginal: outcomes exactly uniform; coherences = overlaps / C
  {
    const circuit = randomCircuit(2, 6, new Rng(303));
    const input = dataBasisState(2, [0, 0]);
    const psi = historyState(circuit, input);
    const rho = clockRho(psi, 7);
    const uniformDev = Math.max(...rho.probs.map((p) => Math.abs(p - 1 / 7)));
    if (uniformDev > 2e-15) failures.push(`clock outcomes not uniform: ${uniformDev}`);
    const states: Array<typeof input> = [];
    for (let t = 0; t <= 6; t++) {
      states.push(t === 0 ? input : runCircuit({ nQubits: 2, steps: circuit.steps.slice(0, t) }, input));
    }
    let cohLawDev = 0;
    for (let t = 0; t < 7; t++) {
      for (let tp = 0; tp < 7; tp++) {
        const z = cvecInner(states[t] as CVec, states[tp] as CVec);
        cohLawDev = Math.max(
          cohLawDev,
          Math.abs((rho.re[t]![tp] as number) - z.re / 7),
          Math.abs((rho.im[t]![tp] as number) - z.im / 7),
        );
      }
    }
    if (cohLawDev > 1e-14) failures.push(`coherence law dev ${cohLawDev}`);
    console.log(`E. clock outcomes uniform (dev ${uniformDev.toExponential(2)}); coherence law <psi_t|psi_t'>/C holds (dev ${cohLawDev.toExponential(2)})`);
  }
  console.log(`E. static readout: P(T) = 1/(T+1), fidelity 1 - ${worstFid.toExponential(2)}`);

  const body = [
    "# EXP1 — the compiler certificate",
    "",
    "Every number below regenerates from `npm run repro` (seeded, zero dependencies).",
    "",
    "## A. gate library",
    "",
    "H/X/Y/Z/S/T/CNOT all pass M†M = I to machine precision.",
    "",
    "## B. the deed: H_prop |Psi_hist> = 0",
    "",
    "Random circuits × random inputs; max |H_prop Psi| entry modulus.",
    "",
    table(["instance", "first gates", "max |H·Psi|"], deedRows),
    "",
    "## C. ground-state degeneracy accounting",
    "",
    "Bare propagation Hamiltonian: every input's history is a ground state.",
    "",
    table(["input convention", "machine count", "expected"], degRows),
    "",
    "## D. witness semantics (accept/reject)",
    "",
    table(["program", "ground energy", "expected"], witnessRows),
    "",
    "## E. static readout",
    "",
    table(["instance", "P(T) machine", "P(T) = 1/(T+1)", "conditional fidelity"], readoutRows),
    "",
    "Measuring the clock at step T hands back U_T...U_1|psi_in> with fidelity",
    `exactly 1 (worst deviation ${worstFid.toExponential(2)}). The clock marginal is exactly uniform.`,
    "",
  ].join("\n");
  const file = writeReport("exp1-compile.md", body);

  if (failures.length > 0) {
    console.error("EXP1 FAILURES:");
    for (const f of failures) console.error(`  - ${f}`);
    process.exitCode = 1;
  } else {
    console.log(`EXP1 OK — ${file}`);
  }
}

run();
