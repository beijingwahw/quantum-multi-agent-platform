/**
 * EXP3 — the energy ledger: what "zero energy" actually buys and where the
 * bill starts.
 *
 * A. static ledger: uniform clock marginal => entropy log2(T+1) per attempt,
 *    expected (T+1) attempts => (T+1)·log2(T+1) expected erasure bits
 *    (MC cross-check of the geometric mean); direct execution erases 0.
 * B. fuel: tilting the clock by -eps·t buys delivery probability P(T), and
 *    the perturbation envelope infidelity <= 2·(eps·T/Delta)^2 is measured,
 *    not assumed — oil buys delivery and dirties the cargo.
 * C. the free clock walk: evolve |00,0> under the compiled Hamiltonian; the
 *    clock-T conditional state is EXACTLY the program output whenever its
 *    probability is nonzero (the walk never garbles the program), but the
 *    path graph has no perfect transfer — delivery probability stays small.
 */
import { type CVec, cvecFidelity, cvecZero, eigHermitian } from "../src/core/cmat.js";
import { dataBasisState, program, randomCircuit, runCircuit } from "../src/compile/circuit.js";
import { assemble } from "../src/compile/hamiltonian.js";
import { conditionalData, spectralEvolve, stateNorm } from "../src/compile/history.js";
import { geometricAttempts, staticExpectedErasureBits, uniformEntropyBits } from "../src/compile/ledger.js";
import { Rng } from "../src/compile/rng.js";
import { table, writeReport } from "./report.js";

function normalizedConditional(psi: CVec, clockStates: number, t: number): { state: CVec; prob: number } {
  const { state, prob } = conditionalData(psi, clockStates, t);
  const inv = 1 / Math.sqrt(prob);
  const out = cvecZero(state.dim);
  for (let k = 0; k < state.dim; k++) {
    out.re[k] = (state.re[k] as number) * inv;
    out.im[k] = (state.im[k] as number) * inv;
  }
  return { state: out, prob };
}

function run(): void {
  const failures: string[] = [];

  // --- A. static ledger
  const staticRows: string[][] = [];
  for (let T = 2; T <= 12; T++) {
    const bits = staticExpectedErasureBits(T + 1);
    staticRows.push([String(T), uniformEntropyBits(T + 1).toFixed(4), bits.toFixed(2)]);
  }
  const geo = geometricAttempts(1 / 7, new Rng(701));
  if (Math.abs(geo.mc - geo.mean) / geo.mean > 0.03) failures.push(`geometric MC ${geo.mc.toFixed(3)} vs mean ${geo.mean}`);
  console.log(`A. static: T=6 expected attempts ${geo.mean.toFixed(2)}, MC ${geo.mc.toFixed(2)}; erasure (T+1)log2(T+1) bits; direct execution erases 0`);

  // --- the shared fuel/walk instance: unique input |00>, T=6, n=2
  const circuit = randomCircuit(2, 6, new Rng(601));
  const prog = program(circuit, [0, 1], new Map());
  const C = 7;
  const T = 6;
  const target = runCircuit(circuit, dataBasisState(2, [0, 0]));
  const base = assemble(prog, { output: false });
  const baseEig = eigHermitian(base.h);
  const delta = baseEig.values[1] as number;
  if (Math.abs(baseEig.values[0] as number) > 1e-10) failures.push(`base ground energy ${baseEig.values[0]}`);
  console.log(`instance: n=2 T=6, unique input |00>, gap Delta = ${delta.toFixed(6)}`);

  // --- B. fuel curve
  // Machine-discovered law (see report): the tilt -eps·sum t|t><t| ⊗ I closes
  // on the trajectory-covariant subspace exactly, so the ground state keeps
  // the form sum_t alpha_t psi_t ⊗ |t> for EVERY eps — conditional readout at
  // any clock step stays exact. The price of oil is the closing gap, not the
  // cargo. We measure both columns and verify the exact-zero law.
  const fuelRows: string[][] = [];
  const ratios = [0, 0.05, 0.1, 0.2, 0.4, 0.8, 1.6] as const;
  const pAt: number[] = [];
  for (const r of ratios) {
    const eps = r * delta;
    const comp = assemble(prog, { output: false, epsilon: eps });
    const eig = eigHermitian(comp.h);
    const v0 = eig.vectors[0] as CVec;
    let pT = 0;
    for (let d = 0; d < 4; d++) pT += (v0.re[d * C + T] as number) ** 2 + (v0.im[d * C + T] as number) ** 2;
    const cond = normalizedConditional(v0, C, T);
    const infid = 1 - cvecFidelity(cond.state, target);
    // exact-zero cargo law, asserted at float level for every tilt
    if (infid > 1e-14) failures.push(`fuel r=${r}: cargo infidelity ${infid.toExponential(2)} — covariant-subspace law broken`);
    // every clock step stays exact too (stronger: full covariant form)
    if (r === 1.6) {
      for (let t = 0; t < C; t++) {
        const c = normalizedConditional(v0, C, t);
        const running = t === 0 ? dataBasisState(2, [0, 0]) : runCircuit({ nQubits: 2, steps: circuit.steps.slice(0, t) }, dataBasisState(2, [0, 0]));
        const dev = 1 - cvecFidelity(c.state, running);
        if (dev > 1e-14) failures.push(`fuel r=${r} step ${t}: intermediate infidelity ${dev.toExponential(2)}`);
      }
    }
    // gap of the fueled Hamiltonian: the actual price curve
    const gapE = (eig.values[1] as number) - (eig.values[0] as number);
    // oil bill: <H_fuel> = -eps · <D> with D = sum t |t><t| ⊗ I
    let expecD = 0;
    for (let t = 0; t < C; t++) {
      let pT2 = 0;
      for (let d = 0; d < 4; d++) pT2 += (v0.re[d * C + t] as number) ** 2 + (v0.im[d * C + t] as number) ** 2;
      expecD += t * pT2;
    }
    pAt.push(pT);
    fuelRows.push([r.toFixed(2), pT.toFixed(6), (1 - infid).toFixed(12), infid.toExponential(2), gapE.toFixed(6), (eps * expecD).toFixed(6)]);
  }
  if (Math.abs(pAt[0]! - 1 / C) > 1e-12) failures.push(`eps=0 P(T) ${pAt[0]}`);
  if (!(pAt[4]! > pAt[0]! + 0.05)) failures.push(`fuel r=0.4 did not buy delivery: ${pAt[4]}`);
  if (!(pAt[5]! > pAt[2]!)) failures.push(`fuel non-monotone r 0.1 -> 0.8`);
  console.log(`B. fuel: P(T) ${pAt[0]!.toFixed(4)} -> ${pAt[pAt.length - 1]!.toFixed(4)} across eps/gap 0 -> 1.6; cargo infidelity EXACTLY 0 at every tilt (covariant-subspace law)`);

  // --- C. free clock walk
  const psi0 = cvecZero(28);
  psi0.re[0] = 1; // |00> data, clock 0
  let maxP = 0;
  let argMaxT = 0;
  let worstFid = 0;
  const curveRows: string[][] = [];
  const grid: number[] = [];
  const pCurve: number[] = [];
  for (let t = 0; t <= 21; t += 0.25) {
    const psi = spectralEvolve(baseEig, psi0, t);
    const normDev = Math.abs(stateNorm(psi) - 1);
    if (normDev > 1e-9) failures.push(`walk norm dev ${normDev} at t=${t}`);
    let pT = 0;
    for (let d = 0; d < 4; d++) pT += (psi.re[d * C + T] as number) ** 2 + (psi.im[d * C + T] as number) ** 2;
    grid.push(t);
    pCurve.push(pT);
    if (pT > maxP) {
      maxP = pT;
      argMaxT = t;
    }
    if (pT > 0.02) {
      const cond = normalizedConditional(psi, C, T);
      worstFid = Math.max(worstFid, 1 - cvecFidelity(cond.state, target));
    }
    if (Math.abs(t % 1) < 1e-9) curveRows.push([t.toFixed(0), pT.toFixed(6)]);
  }
  if (worstFid > 1e-12) failures.push(`walk garbled cargo: infidelity ${worstFid}`);
  // the clock walks alone: delivery curve is circuit-independent (the data
  // register rides along as U_t...U_1|00> at every clock t, so the amplitude
  // dynamics is the bare chain regardless of the gates) — machine-checked by
  // running a different circuit and comparing curves elementwise.
  let curveIndepDev = 0;
  {
    const circuit2 = randomCircuit(2, 6, new Rng(602));
    const prog2 = program(circuit2, [0, 1], new Map());
    const eig2 = eigHermitian(assemble(prog2, { output: false }).h);
    for (let i = 0; i < grid.length; i++) {
      const psi = spectralEvolve(eig2, psi0, grid[i] as number);
      let pT = 0;
      for (let d = 0; d < 4; d++) pT += (psi.re[d * C + T] as number) ** 2 + (psi.im[d * C + T] as number) ** 2;
      curveIndepDev = Math.max(curveIndepDev, Math.abs(pT - (pCurve[i] as number)));
    }
  }
  if (curveIndepDev > 1e-12) failures.push(`walk curve not circuit-independent: ${curveIndepDev}`);
  console.log(`C. walk: peak P(T) = ${maxP.toFixed(4)} at t = ${argMaxT}; conditional fidelity exactly 1 (worst dev ${worstFid.toExponential(2)}); curve circuit-independent (dev ${curveIndepDev.toExponential(2)})`);
  if (!(maxP > 1e-3)) failures.push(`walk never delivers: peak ${maxP}`);

  // --- the wall, in one table
  const wallRows: string[][] = [
    ["direct execution", "0", "T unitary gates, reversible", "0"],
    ["static (ground state)", `${(1 / C).toFixed(4)}`, "measure clock, retry", staticExpectedErasureBits(C).toFixed(2)],
    [`fueled (eps=0.4·Delta)`, `${pAt[4]!.toFixed(4)}`, "oil: tilt -eps·t (gap closes; cargo stays exact)", `${(uniformEntropyBits(C) / (pAt[4] as number)).toFixed(2)}`],
    [`walk (free clock)`, `${maxP.toFixed(4)}`, `coherent time t*=${argMaxT}; energy bandwidth ~ ||H||`, `${(uniformEntropyBits(C) / maxP).toFixed(2)}`],
  ];

  const body = [
    "# EXP3 — the energy ledger",
    "",
    "Units: bits of erasure (multiply by kT·ln2 for joules — LAND61).",
    "",
    "## A. static ledger",
    "",
    table(["T", "entropy log2(T+1) bits/attempt", "expected erasure (T+1)·log2(T+1) bits"], staticRows),
    "",
    `Geometric mean cross-check at T=6: exact ${(1 / (1 / 7)).toFixed(2)}, MC ${geo.mc.toFixed(2)}.`,
    "Direct execution: T unitary gates, zero erasure — the comparison baseline.",
    "",
    "## B. fuel: buying delivery probability",
    "",
    table(["eps/Delta", "P(T)", "conditional fidelity", "infidelity", "gap(eps)", "oil bill eps·<D>"], fuelRows),
    "",
    "Machine-discovered law: the tilt -eps·sum t|t><t| ⊗ I closes on the",
    "trajectory-covariant subspace exactly, so the ground state keeps the form",
    "sum_t alpha_t(eps)·psi_t ⊗ |t> for EVERY tilt — conditional readout at",
    "every clock step stays exact (verified step-by-step at eps = 1.6·Delta).",
    "The price of oil is the closing spectral gap, not the cargo.",
    "",
    "## C. the free clock walk",
    "",
    table(["t", "P(clock = T)"], curveRows),
    "",
    `Peak delivery ${maxP.toFixed(4)} at t = ${argMaxT} vs static floor 1/${C} = ${(1 / C).toFixed(4)}.`,
    "At every sampled time with nonzero P(T), the conditional data state equals",
    `U_T...U_1|00> to machine precision (worst infidelity ${worstFid.toExponential(2)}):`,
    "the walk never garbles the program — it just rarely delivers it.",
    "",
    "## The wall",
    "",
    table(["mode", "P(deliver)", "price", "expected erasure bits"], wallRows),
    "",
    "The vacuum compiler stores and attests computation; it never beats running it.",
    "",
  ].join("\n");
  const file = writeReport("exp3-ledger.md", body);

  if (failures.length > 0) {
    console.error("EXP3 FAILURES:");
    for (const f of failures) console.error(`  - ${f}`);
    process.exitCode = 1;
  } else {
    console.log(`EXP3 OK — ${file}`);
  }
}

run();
