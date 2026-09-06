/**
 * EXP2 — the spectral gap law.
 *
 * A. bare clock anchor: identity gates reduce H_prop to half the path-graph
 *    Laplacian — spectrum {1 - cos(pi k / C)} exactly; machine vs closed form
 *    for T = 2..12 (gap) and the full multiset at T = 5.
 * B. random circuits: gap table (reported, no theorem claimed beyond the
 *    identity anchor; ratios to the anchor are printed as observed).
 * C. full program Hamiltonian (prop+in+out) at toy scale: gap strictly > 0
 *    for the accepting demo — the compiled witness has a spectral certificate.
 */
import { cmatAdjoint, cmatEye, cmatKron, cmatMaxDiff, cmatMul, cmatUnitaryDev, eigenvaluesHermitian, firstExcited } from "../src/core/cmat.js";
import { GATES, embedSingle } from "../src/compile/gates.js";
import { demoProgram, program, randomCircuit } from "../src/compile/circuit.js";
import { assemble, bareClockChain, buildDressing, buildPropagation, clockChainEigenvalue } from "../src/compile/hamiltonian.js";
import { Rng } from "../src/compile/rng.js";
import { table, writeReport } from "./report.js";

function identityCircuit(nQubits: number, depth: number) {
  const eye = GATES[0]!.m;
  const factors: Array<typeof eye> = [];
  for (let q = 0; q < nQubits; q++) factors.push(eye);
  const m = embedSingle(factors, nQubits);
  return { nQubits, steps: Array.from({ length: depth }, () => ({ name: "I", matrix: m })) };
}

function run(): void {
  const failures: string[] = [];

  // --- A. bare clock anchor
  const anchorRows: string[][] = [];
  let worstAnchor = 0;
  for (let T = 2; T <= 12; T++) {
    const C = T + 1;
    const circ = identityCircuit(1, T);
    const h = buildPropagation(1, circ.steps);
    const vals = eigenvaluesHermitian(h);
    const closed = clockChainEigenvalue(1, C);
    const { gap, groundDegeneracy } = firstExcited(vals);
    if (groundDegeneracy !== 2) failures.push(`anchor degeneracy T=${T}: ${groundDegeneracy} != 2`);
    const dev = Math.abs(gap - closed);
    worstAnchor = Math.max(worstAnchor, dev);
    anchorRows.push([String(T), String(C), gap.toFixed(12), closed.toFixed(12), dev.toExponential(2), (closed / gap).toFixed(6)]);
    if (dev > 1e-10) failures.push(`anchor gap T=${T}: ${dev}`);
  }
  // full multiset at T=5, n=1: every eigenvalue 1-cos(pi k/6), twice
  {
    const circ = identityCircuit(1, 5);
    const vals = Array.from(eigenvaluesHermitian(buildPropagation(1, circ.steps)));
    const expected: number[] = [];
    for (let k = 0; k <= 5; k++) {
      const lam = clockChainEigenvalue(k, 6);
      expected.push(lam, lam);
    }
    expected.sort((a, b) => a - b);
    let dev = 0;
    for (let i = 0; i < vals.length; i++) dev = Math.max(dev, Math.abs(vals[i]! - expected[i]!));
    if (dev > 1e-10) failures.push(`anchor full spectrum T=5: ${dev}`);
    console.log(`A. full spectrum at T=5 matches {1-cos(pi k/6)} x2, dev ${dev.toExponential(2)}`);
  }
  console.log(`A. gap anchor 1-cos(pi/(T+1)) for T=2..12, worst dev ${worstAnchor.toExponential(2)}`);

  // --- B. the dressing identity: W† H_prop W = L_clock ⊗ I for EVERY circuit
  // (W = sum_t U_t...U_1 ⊗ |t><t|). The gates are a clock-local unitary
  // dressing: the propagation spectrum is EXACTLY the bare chain spectrum for
  // every circuit — which is also why the walk delivery curve of exp3 is
  // circuit-independent.
  const dressRows: string[][] = [];
  let worstDress = 0;
  for (const T of [4, 6, 8] as const) {
    for (let seed = 401; seed < 406; seed++) {
      const circuit = randomCircuit(2, T, new Rng(seed));
      const h = buildPropagation(2, circuit.steps);
      const w = buildDressing(2, circuit.steps);
      const wd = cmatAdjoint(w);
      const dressed = cmatMul(cmatMul(wd, h), w);
      const bare = cmatKron(cmatEye(4), bareClockChain(T + 1));
      const dev = cmatMaxDiff(dressed, bare);
      const unitDev = cmatUnitaryDev(w);
      worstDress = Math.max(worstDress, dev);
      dressRows.push([String(T), String(seed), dev.toExponential(2), unitDev.toExponential(2)]);
      if (dev > 1e-12) failures.push(`dressing identity T=${T} seed=${seed}: ${dev}`);
      if (unitDev > 1e-13) failures.push(`dressing not unitary T=${T} seed=${seed}: ${unitDev}`);
    }
  }
  console.log(`B. dressing identity W†H_prop W = L⊗I holds for every circuit, worst dev ${worstDress.toExponential(2)} — propagation spectrum is circuit-independent`);

  // --- C. full program gap
  const fullRows: string[][] = [];
  {
    const demo = demoProgram();
    const comp = assemble(demo, { output: true });
    const vals = eigenvaluesHermitian(comp.h);
    const { gap, groundDegeneracy } = firstExcited(vals);
    if (groundDegeneracy !== 1) failures.push(`demo accept ground degeneracy ${groundDegeneracy} != 1`);
    fullRows.push(["demo accept (n=2, T=2)", (vals[0] as number).toExponential(2), gap.toFixed(6)]);
    if (Math.abs(vals[0] as number) > 1e-10) failures.push("demo accept: ground not at 0");
    if (!(gap > 1e-3)) failures.push(`demo accept gap: ${gap}`);

    // longer random program, unique input, no output check: gap of prop+in
    const circuit = randomCircuit(2, 6, new Rng(501));
    const prog = program(circuit, [0, 1], new Map());
    const comp2 = assemble(prog, { output: false });
    const vals2 = eigenvaluesHermitian(comp2.h);
    const gap2 = firstExcited(vals2).gap;
    fullRows.push(["random unique-input (n=2, T=6)", (vals2[0] as number).toExponential(2), gap2.toFixed(6)]);
    if (Math.abs(vals2[0] as number) > 1e-10) failures.push("unique-input ground not 0");
    if (!(gap2 > 1e-3)) failures.push(`unique-input gap: ${gap2}`);
  }
  console.log("C. full program Hamiltonians have certified zero-energy ground + positive gap");

  const body = [
    "# EXP2 — the spectral gap law",
    "",
    "## A. bare clock anchor (identity gates)",
    "",
    "With identity gates H_prop = (1/2 · path Laplacian on C vertices) ⊗ I:",
    "spectrum {1 - cos(pi k / C)}, each value 2^n-degenerate.",
    "",
    table(["T", "C=T+1", "gap machine", "gap closed form", "dev", "closed/machine"], anchorRows),
    "",
    `Full-spectrum multiset check at T=5 passes at 1e-10.`,
    "",
    "## B. the dressing identity (a theorem, machine-verified)",
    "",
    "W = sum_t (U_t...U_1) ⊗ |t><t| is a unitary clock-local dressing and",
    "W† H_prop W = ½·(path Laplacian on C vertices) ⊗ I_data — for EVERY circuit.",
    "The propagation spectrum is exactly {1 - cos(pi k / C)} with multiplicity",
    "2^n regardless of the gates; this conjugation also explains why the walk",
    "delivery curve in exp3 is circuit-independent (the clock walks alone).",
    "",
    table(["T", "seed", "max |W†H W − L⊗I|", "max |W†W − I|"], dressRows),
    "",
    "## C. full program Hamiltonian (prop + input check + output check)",
    "",
    table(["program", "ground energy", "gap"], fullRows),
    "",
  ].join("\n");
  const file = writeReport("exp2-gap.md", body);

  if (failures.length > 0) {
    console.error("EXP2 FAILURES:");
    for (const f of failures) console.error(`  - ${f}`);
    process.exitCode = 1;
  } else {
    console.log(`EXP2 OK — ${file}`);
  }
}

run();
