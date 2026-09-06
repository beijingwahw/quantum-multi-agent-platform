import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  type CMat,
  type CVec,
  cmatAdjoint,
  cmatApplyMaxNorm,
  cmatEye,
  cmatHermDev,
  cmatKron,
  cmatMaxDiff,
  cmatMul,
  cmatUnitaryDev,
  cvecFidelity,
  cvecInner,
  cvecZero,
  eigHermitian,
  firstExcited,
} from "../src/core/cmat.js";
import { assertGateLibrary } from "../src/compile/gates.js";
import {
  dataBasisState,
  demoProgram,
  program,
  randomCircuit,
  runCircuit,
  unitaryDeviation,
} from "../src/compile/circuit.js";
import {
  assemble,
  bareClockChain,
  buildDressing,
  buildFuel,
  buildInputCheck,
  buildOutputCheck,
  buildPropagation,
  clockChainEigenvalue,
} from "../src/compile/hamiltonian.js";
import {
  clockRho,
  conditionalData,
  historyState,
  spectralEvolve,
  stateNorm,
  staticReadoutFidelity,
} from "../src/compile/history.js";
import { geometricAttempts, staticExpectedErasureBits, uniformEntropyBits } from "../src/compile/ledger.js";
import { Rng } from "../src/compile/rng.js";

function randomDataState(dim: number, rng: Rng) {
  const v = cvecZero(dim);
  for (let k = 0; k < dim; k++) {
    v.re[k] = rng.next() * 2 - 1;
    v.im[k] = rng.next() * 2 - 1;
  }
  const n = Math.sqrt(v.re.reduce((s, x) => s + x * x, 0) + v.im.reduce((s, x) => s + x * x, 0));
  for (let k = 0; k < dim; k++) {
    v.re[k] = v.re[k]! / n;
    v.im[k] = v.im[k]! / n;
  }
  return v;
}

describe("T0 kernels", () => {
  it("gate library is unitary", () => {
    assert.doesNotThrow(assertGateLibrary);
  });

  it("Jacobi eigensolver: anchors [[1,1],[1,-1]] -> ±√2 and σ_y -> ±1", () => {
    const anchor: CMat = { dim: 2, re: [[1, 1], [1, -1]], im: [[0, 0], [0, 0]] };
    const vals = eigHermitian(anchor).values;
    assert.ok(Math.abs((vals[0] as number) + Math.SQRT2) < 1e-12);
    assert.ok(Math.abs((vals[1] as number) - Math.SQRT2) < 1e-12);
    const sy: CMat = { dim: 2, re: [[0, 0], [0, 0]], im: [[0, -1], [1, 0]] };
    const valsY = eigHermitian(sy).values;
    assert.ok(Math.abs((valsY[0] as number) + 1) < 1e-12);
    assert.ok(Math.abs((valsY[1] as number) - 1) < 1e-12);
  });

  it("matrix multiply is associative-shaped: (AB)C = A(BC) on a random 4x4 triple", () => {
    const rng = new Rng(11);
    const rand = (): CMat => {
      const m = cmatEye(4, 0);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        m.re[i]![j] = rng.next();
        m.im[i]![j] = rng.next();
      }
      return m;
    };
    const [a, b, c] = [rand(), rand(), rand()];
    assert.ok(cmatMaxDiff(cmatMul(cmatMul(a, b), c), cmatMul(a, cmatMul(b, c))) < 1e-12);
  });
});

describe("T1 the compiler deed", () => {
  it("H_prop |Psi_hist> = 0 for random circuits and random inputs", () => {
    for (const seed of [101, 102, 103, 104]) {
      const rng = new Rng(seed);
      const circuit = randomCircuit(2, 5, rng);
      assert.ok(unitaryDeviation(circuit) < 1e-13);
      const h = buildPropagation(2, circuit.steps);
      assert.ok(cmatHermDev(h) < 1e-14);
      for (let trial = 0; trial < 3; trial++) {
        const psi = historyState(circuit, randomDataState(4, rng));
        assert.ok(cmatApplyMaxNorm(h, psi) < 1e-14, `seed ${seed} trial ${trial}`);
      }
    }
  });

  it("assembled Hamiltonians stay Hermitian with all parts on", () => {
    const demo = demoProgram();
    for (const opts of [{}, { output: true }, { output: true, epsilon: 0.3 }] as const) {
      const comp = assemble(demo, opts);
      assert.ok(comp.hermDev < 1e-14);
    }
  });

  it("degeneracy: 2^n bare, halved per checked qubit", () => {
    const circuit = randomCircuit(2, 4, new Rng(205));
    for (const checked of [[], [0], [0, 1]] as const) {
      const comp = assemble(program(circuit, checked, new Map()), { output: false });
      const vals = eigHermitian(comp.h).values;
      let count = 0;
      for (const v of vals) if (Math.abs(v) < 1e-9) count++;
      assert.equal(count, 2 ** (2 - checked.length), `checked=[${checked.join(",")}]`);
    }
  });

  it("witness semantics: accept => E0 = 0, reject => E0 > 0", () => {
    const demo = demoProgram();
    const accepting = eigHermitian(assemble(demo, { output: true }).h).values;
    assert.ok(Math.abs(accepting[0] as number) < 1e-10);
    const rejecting = program(demo.circuit, demo.checkedQubits, new Map([[1, 0]]));
    const vals = eigHermitian(assemble(rejecting, { output: true }).h).values;
    assert.ok((vals[0] as number) > 1e-4);
  });
});

describe("T2 the gap law", () => {
  it("bare clock chain: gap = 1 - cos(pi/(T+1)) for T = 2..12 (2-fold degenerate ground)", () => {
    const eye = { dim: 2, re: [[1, 0], [0, 1]], im: [[0, 0], [0, 0]] } as CMat;
    for (let T = 2; T <= 12; T++) {
      const steps = Array.from({ length: T }, () => ({ name: "I", matrix: eye }));
      const vals = eigHermitian(buildPropagation(1, steps)).values;
      const { gap, groundDegeneracy } = firstExcited(vals);
      assert.equal(groundDegeneracy, 2, `T=${T}`);
      const closed = clockChainEigenvalue(1, T + 1);
      assert.ok(Math.abs(gap - closed) < 1e-10, `T=${T}: ${gap} vs ${closed}`);
    }
  });

  it("full spectrum multiset at T=5 matches {1-cos(pi k/6)} with multiplicity 2", () => {
    const eye = { dim: 2, re: [[1, 0], [0, 1]], im: [[0, 0], [0, 0]] } as CMat;
    const steps = Array.from({ length: 5 }, () => ({ name: "I", matrix: eye }));
    const vals = Array.from(eigHermitian(buildPropagation(1, steps)).values);
    const expected: number[] = [];
    for (let k = 0; k <= 5; k++) {
      const lam = clockChainEigenvalue(k, 6);
      expected.push(lam, lam);
    }
    expected.sort((a, b) => a - b);
    for (let i = 0; i < vals.length; i++) {
      assert.ok(Math.abs(vals[i]! - expected[i]!) < 1e-10, `index ${i}`);
    }
  });

  it("dressing identity: W† H_prop W = ½·Laplian(path) ⊗ I for every circuit (spectrum is circuit-independent)", () => {
    for (const T of [4, 6, 8]) {
      const circuit = randomCircuit(2, T, new Rng(400 + T));
      const h = buildPropagation(2, circuit.steps);
      const w = buildDressing(2, circuit.steps);
      assert.ok(cmatUnitaryDev(w) < 1e-13, "W unitary");
      const dressed = cmatMul(cmatMul(cmatAdjoint(w), h), w);
      const bare = cmatKron(cmatEye(4), bareClockChain(T + 1));
      assert.ok(cmatMaxDiff(dressed, bare) < 1e-12, `T=${T}`);
    }
  });

  it("random-circuit propagation Hamiltonians are PSD with 2^n-degenerate ground and positive gap", () => {
    for (const T of [4, 6, 8]) {
      const circuit = randomCircuit(2, T, new Rng(400 + T));
      const vals = eigHermitian(buildPropagation(2, circuit.steps)).values;
      assert.ok((vals[0] as number) > -1e-12, "PSD");
      const { gap, groundDegeneracy } = firstExcited(vals);
      assert.equal(groundDegeneracy, 4, "every input's history is a ground state");
      assert.ok(gap > 1e-3, "gap");
    }
  });
});

describe("T3 the readout certificates", () => {
  it("clock outcomes exactly uniform; marginal coherences = intermediate-state overlaps / C", () => {
    const circuit = randomCircuit(2, 6, new Rng(303));
    const input = dataBasisState(2, [0, 0]);
    const psi = historyState(circuit, input);
    const rho = clockRho(psi, 7);
    // diagonal: 4-term sums of squares, floor ~4·eps — guard sits above it
    for (const p of rho.probs) assert.ok(Math.abs(p - 1 / 7) < 2e-15);
    // off-diagonal: rho[t,t'] = <psi_t|psi_t'>/7 — coherent in general
    const states: CVec[] = [];
    for (let t = 0; t <= 6; t++) {
      states.push(t === 0 ? input : runCircuit({ nQubits: 2, steps: circuit.steps.slice(0, t) }, input));
    }
    let maxCoh = 0;
    for (let t = 0; t < 7; t++) {
      for (let tp = 0; tp < 7; tp++) {
        const z = cvecInner(states[t] as CVec, states[tp] as CVec); // <psi_t|psi_tp>
        const devR = Math.abs((rho.re[t]![tp] as number) - z.re / 7);
        const devI = Math.abs((rho.im[t]![tp] as number) - z.im / 7);
        assert.ok(devR < 1e-14 && devI < 1e-14, `(${t},${tp}): ${devR.toExponential(2)}/${devI.toExponential(2)}`);
        if (t !== tp) maxCoh = Math.max(maxCoh, Math.hypot(z.re, z.im) / 7);
      }
    }
    assert.ok(maxCoh > 0, "random circuit has nonzero clock coherences (the law is coherence, not diagonality)");
  });

  it("static readout: P(T) = 1/(T+1) and conditional fidelity exactly 1", () => {
    for (const T of [2, 5, 8]) {
      const circuit = randomCircuit(2, T, new Rng(900 + T));
      const input = dataBasisState(2, [0, 0]);
      const target = runCircuit(circuit, input);
      const { probT, fidelity } = staticReadoutFidelity(circuit, input, target);
      assert.ok(Math.abs(probT - 1 / (T + 1)) < 1e-12, `T=${T} P=${probT}`);
      assert.ok(Math.abs(1 - fidelity) < 1e-12, `T=${T} F=${fidelity}`);
    }
  });

  it("conditional readout at EVERY clock step gives the exact intermediate state", () => {
    const circuit = randomCircuit(2, 4, new Rng(950));
    const input = dataBasisState(2, [0, 1]);
    const psi = historyState(circuit, input);
    let running = input;
    for (let t = 0; t <= 4; t++) {
      if (t > 0) running = runCircuit({ nQubits: 2, steps: circuit.steps.slice(0, t) }, input);
      const { state, prob } = conditionalData(psi, 5, t);
      assert.ok(Math.abs(prob - 1 / 5) < 1e-15);
      const inv = 1 / Math.sqrt(prob);
      for (let k = 0; k < 4; k++) {
        state.re[k] = state.re[k]! * inv;
        state.im[k] = state.im[k]! * inv;
      }
      assert.ok(Math.abs(1 - cvecFidelity(state, running)) < 1e-14, `step ${t}`);
    }
  });

  it("free-clock walk never garbles: conditional state at T is exact whenever P(T) > 0", () => {
    const circuit = randomCircuit(2, 6, new Rng(601));
    const prog = program(circuit, [0, 1], new Map());
    const eig = eigHermitian(assemble(prog, { output: false }).h);
    const target = runCircuit(circuit, dataBasisState(2, [0, 0]));
    const psi0 = cvecZero(28);
    psi0.re[0] = 1;
    let maxP = 0;
    for (let t = 0.5; t <= 12; t += 0.5) {
      const psi = spectralEvolve(eig, psi0, t);
      assert.ok(Math.abs(stateNorm(psi) - 1) < 1e-9);
      let pT = 0;
      for (let d = 0; d < 4; d++) pT += (psi.re[6 + d * 7] as number) ** 2 + (psi.im[6 + d * 7] as number) ** 2;
      maxP = Math.max(maxP, pT);
      if (pT > 1e-6) {
        const { state, prob } = conditionalData(psi, 7, 6);
        const inv = 1 / Math.sqrt(prob);
        for (let k = 0; k < 4; k++) {
          state.re[k] = state.re[k]! * inv;
          state.im[k] = state.im[k]! * inv;
        }
        assert.ok(Math.abs(1 - cvecFidelity(state, target)) < 1e-12, `t=${t}`);
      }
    }
    assert.ok(maxP > 1e-3);
  });
});

describe("T4 the ledger", () => {
  it("uniform entropy and static expected erasure are exact arithmetic", () => {
    assert.ok(Math.abs(uniformEntropyBits(8) - 3) < 1e-15);
    assert.ok(Math.abs(staticExpectedErasureBits(8) - 24) < 1e-12);
  });

  it("geometric mean cross-check: MC within 3% of 1/p at p = 1/7", () => {
    const { mean, mc } = geometricAttempts(1 / 7, new Rng(701));
    assert.ok(Math.abs(mean - 7) < 1e-12);
    assert.ok(Math.abs(mc - mean) / mean < 0.03, `mc ${mc.toFixed(3)}`);
  });

  it("fuel tilt never dirties the cargo: infidelity exactly 0 at every tilt (covariant-subspace law)", () => {
    const circuit = randomCircuit(2, 6, new Rng(601));
    const prog = program(circuit, [0, 1], new Map());
    const target = runCircuit(circuit, dataBasisState(2, [0, 0]));
    const base = eigHermitian(assemble(prog, { output: false }).h);
    const delta = base.values[1] as number;
    for (const r of [0.05, 0.2, 0.4, 0.8, 1.6]) {
      const eig = eigHermitian(assemble(prog, { output: false, epsilon: r * delta }).h);
      const v0 = eig.vectors[0]!;
      const { state, prob } = conditionalData(v0, 7, 6);
      const inv = 1 / Math.sqrt(prob);
      for (let k = 0; k < 4; k++) {
        state.re[k] = state.re[k]! * inv;
        state.im[k] = state.im[k]! * inv;
      }
      const infid = 1 - cvecFidelity(state, target);
      assert.ok(infid < 1e-14, `r=${r}: ${infid.toExponential(2)} — ground state left the covariant subspace`);
    }
  });

  it("fuel buys delivery: P(T) rises well above the static floor", () => {
    const circuit = randomCircuit(2, 6, new Rng(601));
    const prog = program(circuit, [0, 1], new Map());
    const base = eigHermitian(assemble(prog, { output: false }).h);
    const delta = base.values[1] as number;
    const pAt = (eps: number): number => {
      const v0 = eigHermitian(assemble(prog, { output: false, epsilon: eps }).h).vectors[0]!;
      let pT = 0;
      for (let d = 0; d < 4; d++) pT += (v0.re[6 + d * 7] as number) ** 2 + (v0.im[6 + d * 7] as number) ** 2;
      return pT;
    };
    const p0 = pAt(0);
    const pHi = pAt(0.4 * delta);
    assert.ok(Math.abs(p0 - 1 / 7) < 1e-12);
    assert.ok(pHi > p0 + 0.05, `pHi ${pHi}`);
  });

  it("input/output/fuel builders land exactly on their clock blocks", () => {
    const hin = buildInputCheck(2, [0], 4);
    // qubit 0 = most significant bit: data indices 2,3 violate |0>
    assert.equal(hin.re[2 * 5]![2 * 5], 1);
    assert.equal(hin.re[3 * 5]![3 * 5], 1);
    assert.equal(hin.re[0]![0], 0);
    const hout = buildOutputCheck(2, new Map([[1, 1]]), 4);
    // qubit 1 = least significant bit: data indices with bit1=0 are penalized at clock T
    let penalized = 0;
    for (let d = 0; d < 4; d++) {
      const v = hout.re[d * 5 + 4]![d * 5 + 4] as number;
      if (v === 1) penalized++;
    }
    assert.equal(penalized, 2);
    const hf = buildFuel(2, 4, 0.5);
    assert.ok(Math.abs((hf.re[0]![0] as number) - 0) < 1e-15);
    assert.ok(Math.abs((hf.re[4]![4] as number) + 2) < 1e-15);
    // spot-check hermiticity of one off-diagonal-heavy builder
    const hp = buildPropagation(2, demoProgram().circuit.steps);
    assert.ok(cmatHermDev(hp) < 1e-14);
    assert.ok(cmatUnitaryDev(demoProgram().circuit.steps[0]!.matrix) < 1e-14);
  });
});
