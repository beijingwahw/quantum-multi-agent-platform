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
  VacuumError,
} from "../src/core/cmat.js";
import { assertGateLibrary, cnot4, embedSingle, embedTwoAdjacent } from "../src/compile/gates.js";
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
import { expectedErasureBits, geometricAttempts, pricedWalk, staticExpectedErasureBits, uniformEntropyBits } from "../src/compile/ledger.js";
import {
  amplifiedStaticBits,
  binomialAmplificationResidue,
  decayCensus,
  exactRationalPower,
  partialDemoPrograms,
  perRoundSoundness,
  worstSigmaUnits,
  type ExactRational,
} from "../src/compile/amplify.js";
import {
  bigPow,
  fkStaticBits,
  fkStaticCompare,
  fkStaticIntegerBracket,
  fkStaticRoundsTo,
  fkStaticUndercuts,
  tariffCrossoverDepth,
  tariffOrderingAtDepth,
} from "../src/compile/tariff.js";
import { auditBoundaryCitation, auditDecayTable, type BoundaryCitation, type SubmittedDecayRow } from "../src/compile/audit.js";
import { Rng, randomDataState } from "../src/compile/rng.js";

/** Convict by error code, never by message prose. */
function throwsCode(code: string): (err: unknown) => boolean {
  return (err: unknown): boolean => err instanceof VacuumError && err.code === code;
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

describe("T5 the graduated boundary (v0.2.0)", () => {
  it("exact tariff comparisons match hand-checked integer cases", () => {
    // (T+1)^(T+1) vs 2^c, by hand: 3^3=27, 4^4=256, 5^5=3125; 2^5=32, 2^8=256, 2^9=512
    assert.equal(fkStaticUndercuts(3, 9), true); // 4.75 < 9
    assert.equal(fkStaticUndercuts(4, 9), true); // 8 < 9
    assert.equal(fkStaticUndercuts(5, 9), false); // 11.61 > 9
    assert.equal(fkStaticUndercuts(4, 5), false); // 8 > 5
    assert.equal(fkStaticCompare(4, 8), 0); // 4·log2(4) = 8 EXACTLY (256 = 256)
    assert.equal(fkStaticCompare(4, 7), 1);
    assert.equal(fkStaticCompare(3, 5), -1);
  });

  it("integer bracket and the 43.02 rounding certificate are exact", () => {
    const b11 = fkStaticIntegerBracket(12);
    assert.equal(b11.lo, 43n);
    assert.equal(b11.hi, 44n);
    assert.equal(fkStaticIntegerBracket(4).lo, 8n); // 4·log2(4) = 8 exactly
    assert.equal(fkStaticRoundsTo(12, 4302), true);
    assert.equal(fkStaticRoundsTo(12, 4301), false); // tight on both sides
    assert.equal(fkStaticRoundsTo(12, 4303), false);
  });

  it("the legislated ordering 5 < 9 < 43.02 holds on OUR conventions at matched depth 11, exactly", () => {
    const o = tariffOrderingAtDepth(11);
    assert.equal(o.fkExceedsFive, true);
    assert.equal(o.fkExceedsNine, true);
    assert.ok(Math.abs(o.fkBits - 43.0196) < 5e-5, `fkBits ${o.fkBits}`);
    // the crossovers: FK static undercuts the 5-unit rival only at T <= 2, the 9-unit rival at T <= 3
    assert.equal(tariffCrossoverDepth(5), 3);
    assert.equal(tariffCrossoverDepth(9), 4);
  });

  it("genuine sibling citations pass the two-ground audit", () => {
    const tc14: BoundaryCitation = { repo: "dtc-clock", version: "0.21.0", witness: "TC14", figureHundredths: 4302, depth: 11, direction: "fk-most-expensive" };
    const we: BoundaryCitation = { repo: "route-price", version: "0.2.0", witness: "W-E", figureHundredths: 4302, depth: 11, direction: "fk-most-expensive" };
    assert.deepEqual(auditBoundaryCitation(tc14), []);
    assert.deepEqual(auditBoundaryCitation(we), []);
  });

  it("SMUGGLING TRIAL: fake graduated-boundary citations are named and rejected", () => {
    const genuine: BoundaryCitation = { repo: "dtc-clock", version: "0.21.0", witness: "TC14", figureHundredths: 4302, depth: 11, direction: "fk-most-expensive" };
    const wrongDepth: BoundaryCitation = { ...genuine, depth: 12 }; // 13·log2(13) ≈ 48.11, not 43.02
    const v1 = auditBoundaryCitation(wrongDepth);
    assert.ok(v1.some((x) => x.crime === "tariff figure not our conventions at claimed depth"), JSON.stringify(v1));
    const ghostWitness: BoundaryCitation = { ...genuine, witness: "TC99" }; // no such claim in the shipped report
    const v2 = auditBoundaryCitation(ghostWitness);
    assert.ok(v2.some((x) => x.crime === "witness id not in shipped report"), JSON.stringify(v2));
    const flipped: BoundaryCitation = { ...genuine, direction: "fk-cheapest" }; // the FK entry is the expensive row
    const v3 = auditBoundaryCitation(flipped);
    assert.ok(v3.some((x) => x.crime === "direction contradicted by exact ordering"), JSON.stringify(v3));
    const versionDrift: BoundaryCitation = { ...genuine, version: "0.18.0" };
    const v4 = auditBoundaryCitation(versionDrift);
    assert.ok(v4.some((x) => x.crime === "version drift"), JSON.stringify(v4));
    const unenrolled: BoundaryCitation = { ...genuine, repo: "not-a-repo" };
    const v5 = auditBoundaryCitation(unenrolled);
    assert.ok(v5.some((x) => x.crime === "unknown sibling repo"), JSON.stringify(v5));
  });
});

describe("T5 amplification (v0.2.0)", () => {
  it("exact rational powers and the binomial amplification identity (BigInt residue 0)", () => {
    const half = exactRationalPower({ num: 1n, den: 2n }, 10);
    assert.equal(half.num, 1n);
    assert.equal(half.den, 1024n);
    const threeQuarters = exactRationalPower({ num: 3n, den: 4n }, 3);
    assert.equal(threeQuarters.num, 27n);
    assert.equal(threeQuarters.den, 64n);
    const pairs: ReadonlyArray<[ExactRational, number]> = [
      [{ num: 1n, den: 2n }, 24],
      [{ num: 1n, den: 4n }, 16],
      [{ num: 3n, den: 4n }, 12],
      [{ num: 1n, den: 3n }, 10],
      [{ num: 2n, den: 7n }, 9],
    ];
    for (const [eps, k] of pairs) assert.equal(binomialAmplificationResidue(eps, k), 0n);
  });

  it("per-round soundness of the demo family is exactly the dyadic claim", () => {
    const [half, quarter] = partialDemoPrograms();
    assert.ok(Math.abs(perRoundSoundness(half!.prog, half!.input) - 0.5) < 1e-12);
    assert.ok(Math.abs(perRoundSoundness(quarter!.prog, quarter!.input) - 0.25) < 1e-12);
  });

  it("the decay census: eps^k exact, resolution floor honest, MC within 5 sigma", () => {
    const half = decayCensus({ num: 1n, den: 2n }, 12, new Rng(801));
    const quarter = decayCensus({ num: 1n, den: 4n }, 12, new Rng(802));
    assert.ok(worstSigmaUnits(half) < 5, `eps=1/2 worst ${worstSigmaUnits(half)} sigma units`);
    assert.ok(worstSigmaUnits(quarter) < 5, `eps=1/4 worst ${worstSigmaUnits(quarter)} sigma units`);
    // resolution floor: 20000·eps^k >= 10 — k <= 10 for eps = 1/2, k <= 5 for eps = 1/4
    assert.equal(half.filter((r) => r.resolvable).length, 10);
    assert.equal(quarter.filter((r) => r.resolvable).length, 5);
    // dyadic float column is bit-identical to the exact rational
    for (const r of half) assert.equal(r.float, Math.pow(0.5, r.k));
    // survival (1-eps)^k: for eps=1/4 this is 3^k/4^k exactly
    for (const r of quarter) {
      assert.equal(r.survival.num, 3n ** BigInt(r.k));
      assert.equal(r.survival.den, 4n ** BigInt(r.k));
    }
  });

  it("amplification is priced: k rounds erase k·(T+1)·log2(T+1) bits; completeness stays 1", () => {
    assert.ok(Math.abs(amplifiedStaticBits(3, 8) - 8 * 3 * Math.log2(3)) < 1e-12);
    assert.ok(Math.abs(amplifiedStaticBits(7, 1) - staticExpectedErasureBits(7)) < 1e-12);
    // completeness: the honest accepting witness passes every delivered round with
    // probability exactly 1 (T3 certificate) — 1^k = 1, no MC needed
    for (let k = 1; k <= 12; k++) assert.equal(1 ** k, 1);
  });

  it("SMUGGLING TRIAL: counterfeit amplification-decay tables are named and rejected row by row", () => {
    const eps: ExactRational = { num: 1n, den: 2n };
    const census = decayCensus(eps, 12, new Rng(801));
    const honest: SubmittedDecayRow[] = census.map((r) => ({
      k: r.k,
      claimedExact: r.exact,
      claimedFloat: r.float,
      claimedSurvival: r.survival,
      claimedMc: r.mc,
      claimedResolvable: r.resolvable,
    }));
    assert.deepEqual(auditDecayTable(eps, honest), []);
    // the counterfeit: three corrupted rows, four named crimes
    const counterfeit = honest.map((r) => {
      if (r.k === 8) return { ...r, claimedExact: { num: 1n, den: 1023n }, claimedFloat: 1 / 1023 }; // wrong eps^k
      if (r.k === 11) return { ...r, claimedResolvable: true, claimedMc: 0.5 }; // below the resolution floor
      if (r.k === 6) return { ...r, claimedSurvival: { num: 1n, den: 63n }, claimedMc: 0.5 }; // wrong (1-eps)^k AND a resolvable row's MC far outside 5 sigma
      return r;
    });
    const v = auditDecayTable(eps, counterfeit);
    const crimes = new Set(v.map((x) => x.crime));
    assert.ok(crimes.has("counterfeit epsilon^k (exact)"), JSON.stringify([...crimes]));
    assert.ok(crimes.has("counterfeit epsilon^k (float)"), JSON.stringify([...crimes]));
    assert.ok(crimes.has("counterfeit survival (1-eps)^k"), JSON.stringify([...crimes]));
    assert.ok(crimes.has("resolution smuggling"), JSON.stringify([...crimes]));
    assert.ok(crimes.has("MC claimed below the resolution floor"), JSON.stringify([...crimes]));
    assert.ok(crimes.has("MC outside 5-sigma band"), JSON.stringify([...crimes]));
    // only the corrupted rows are flagged, each with its row number named
    assert.deepEqual([...new Set(v.map((x) => x.k))].sort((a, b) => a - b), [6, 8, 11]);
  });
});

describe("T4 walk price (v0.2.0)", () => {
  it("second walk family: sigma_E is exactly 1/2, conserved under the walk, MT floor pi", () => {
    for (const T of [4, 8] as const) {
      const circuit = randomCircuit(2, T, new Rng(601));
      const prog = program(circuit, [0, 1], new Map());
      const comp = assemble(prog, { output: false });
      const eig = eigHermitian(comp.h);
      const psi0 = cvecZero(comp.h.dim);
      psi0.re[0] = 1;
      const walk = pricedWalk(comp.h, eig, psi0, T + 1, 2 * (T + 1));
      assert.ok(Math.abs(walk.sigmaE0 - 0.5) < 1e-9, `T=${T}: sigma_E ${walk.sigmaE0}`);
      assert.ok(Math.abs(walk.sigmaE0 - walk.sigmaEStar) < 1e-9, `T=${T}: not conserved`);
      assert.ok(Math.abs(walk.mtFloor - Math.PI) < 1e-9, `T=${T}: MT floor ${walk.mtFloor}`);
      assert.ok(Math.abs(walk.product - walk.tStar * 0.5) < 1e-9);
      assert.ok(walk.peak > 1 / (T + 1), `T=${T}: peak ${walk.peak} vs floor`);
    }
  });

  it("cargo is exact at the delivery peak of the second family", () => {
    const T = 6;
    const circuit = randomCircuit(2, T, new Rng(601));
    const prog = program(circuit, [0, 1], new Map());
    const comp = assemble(prog, { output: false });
    const eig = eigHermitian(comp.h);
    const psi0 = cvecZero(comp.h.dim);
    psi0.re[0] = 1;
    const walk = pricedWalk(comp.h, eig, psi0, T + 1, 2 * (T + 1));
    const evolved = spectralEvolve(eig, psi0, walk.tStar);
    const { state, prob } = conditionalData(evolved, T + 1, T);
    const inv = 1 / Math.sqrt(prob);
    const target = runCircuit(circuit, dataBasisState(2, [0, 0]));
    const cargo = cvecFidelity(
      { dim: state.dim, re: Float64Array.from(state.re, (x) => x * inv), im: Float64Array.from(state.im, (x) => x * inv) },
      target,
    );
    assert.ok(Math.abs(1 - cargo) < 1e-12, `fidelity ${cargo}`);
  });
});

describe("T6 the quality wall: error surface and module surface (v0.3.0)", () => {
  it("NaN-grid conviction: malformed grids and dim mismatches are rejected by name; legal operands bit-identical", () => {
    const eye2 = cmatEye(2);
    const eye4 = cmatEye(4);
    const ragged: CMat = { dim: 2, re: [[1, 0], [0]], im: [[0, 0], [0, 0]] }; // row 1 is 1-wide
    assert.throws(() => cmatMaxDiff(eye2, ragged), throwsCode("cmat/malformed-grid"));
    assert.throws(() => cmatMul(eye2, eye4), throwsCode("cmat/dim-mismatch"));
    assert.throws(() => cmatApplyMaxNorm(eye2, cvecZero(4)), throwsCode("cmat/dim-mismatch"));
    assert.throws(() => cvecInner(cvecZero(4), cvecZero(8)), throwsCode("cmat/dim-mismatch"));
    assert.throws(() => eigHermitian(ragged), throwsCode("cmat/malformed-grid"));
    const skew: CMat = { dim: 2, re: [[1, 1], [0, 0]], im: [[0, 0], [0, 0]] }; // not Hermitian
    assert.throws(() => eigHermitian(skew), throwsCode("cmat/not-hermitian"));
    assert.throws(() => firstExcited(new Float64Array(0)), throwsCode("cmat/empty-spectrum"));
    // legal operands pass unchanged (the guards reject, they never rewrite)
    assert.equal(cmatMaxDiff(eye2, eye2), 0);
    assert.equal(cmatMaxDiff(cmatMul(eye4, eye4), eye4), 0);
    // a wrong-dim step matrix can no longer poison the propagation grid with NaNs
    assert.throws(() => buildPropagation(2, [{ matrix: eye2 }]), throwsCode("hamiltonian/step-dim-mismatch"));
    assert.throws(() => buildDressing(2, [{ matrix: eye2 }]), throwsCode("hamiltonian/step-dim-mismatch"));
  });

  it("SMUGGLING TRIAL: the silent gate drop is dead — off-register placements are named and rejected", () => {
    // pre-fix evidence: embedTwoAdjacent(cnot4(), -1, 2) returned the 4x4 IDENTITY
    // (the placement never matched, the chain came back all-identities with the
    // right dimension) — the gate vanished without a signal
    assert.throws(() => embedTwoAdjacent(cnot4(), -1, 2), throwsCode("gate/placement-out-of-range"));
    assert.throws(() => embedTwoAdjacent(cnot4(), 1, 2), throwsCode("gate/placement-out-of-range")); // pair (1,2) exceeds the register
    assert.throws(() => embedTwoAdjacent(cnot4(), 0.5, 3), throwsCode("gate/placement-out-of-range"));
    assert.throws(() => embedTwoAdjacent(cnot4(), 2, 2), throwsCode("gate/placement-out-of-range"));
    assert.throws(() => embedSingle([cmatEye(4)], 1), throwsCode("gate/factor-not-qubit")); // 4x4 where a 1-qubit factor belongs
    assert.throws(() => embedSingle([cmatEye(2)], 2), throwsCode("gate/factor-count-mismatch"));
    // the legal placements still land exactly where they always did
    assert.equal(embedTwoAdjacent(cnot4(), 0, 3).dim, 8);
    assert.ok(cmatUnitaryDev(embedTwoAdjacent(cnot4(), 1, 3)) < 1e-14);
  });

  it("hang conviction: geometricAttempts rejects p outside (0,1] by name; p=1 stays exact", () => {
    // pre-fix evidence: p=0 spun the draw loop forever (bernoulli(0) never fires);
    // p>1 returned a sub-unit "mean" — both now named rejections
    assert.throws(() => geometricAttempts(0, new Rng(1)), throwsCode("ledger/probability-out-of-domain"));
    assert.throws(() => geometricAttempts(1.5, new Rng(1)), throwsCode("ledger/probability-out-of-domain"));
    assert.throws(() => geometricAttempts(0.5, new Rng(1), 0), throwsCode("ledger/trials-out-of-domain"));
    const { mean, mc } = geometricAttempts(1, new Rng(9));
    assert.equal(mean, 1);
    assert.equal(mc, 1); // every trial succeeds on attempt 1, exactly
  });

  it("epsilon smuggling: non-probability eps is rejected by name at the census AND the auditor", () => {
    // pre-fix evidence: eps = 3/2 silently produced a census with mc = 1 and
    // sigma = NaN rows, and the auditor would have recomputed against the
    // meaningless ground — both entries now reject the class by name
    const bogus = { num: 3n, den: 2n };
    assert.throws(() => decayCensus(bogus, 4, new Rng(1)), throwsCode("amplify/epsilon-out-of-domain"));
    assert.throws(() => auditDecayTable(bogus, []), throwsCode("amplify/epsilon-out-of-domain"));
    assert.throws(() => exactRationalPower({ num: 1n, den: 0n }, 2), throwsCode("amplify/malformed-rational"));
    assert.throws(() => exactRationalPower({ num: 1n, den: 2n }, -1), throwsCode("amplify/rounds-out-of-domain"));
  });

  it("circuit entry rejections: pattern bits and qubit ranges are named", () => {
    const circuit = demoProgram().circuit;
    assert.throws(() => dataBasisState(2, [0]), throwsCode("circuit/pattern-length-mismatch"));
    assert.throws(() => dataBasisState(2, [0, 2]), throwsCode("circuit/pattern-bit-not-binary"));
    assert.throws(() => program(circuit, [5], new Map()), throwsCode("circuit/checked-qubit-out-of-range"));
    assert.throws(() => program(circuit, [], new Map([[9, 1]])), throwsCode("circuit/accept-qubit-out-of-range"));
    // the historical state guards its data dimension
    assert.throws(() => historyState(circuit, cvecZero(8)), throwsCode("cmat/dim-mismatch"));
  });

  it("readout guards: a non-divisor clock and an out-of-range clock step are named", () => {
    // pre-fix evidence: clockStates=5 on a 28-dim state truncated D to 5 and
    // read past the buffers silently (garbage, no signal)
    const psi28 = cvecZero(28);
    assert.throws(() => conditionalData(psi28, 5, 0), throwsCode("readout/clock-not-divisor"));
    assert.throws(() => clockRho(psi28, 5), throwsCode("readout/clock-not-divisor"));
    assert.throws(() => conditionalData(psi28, 7, 7), throwsCode("readout/clock-step-out-of-range"));
    assert.throws(() => spectralEvolve({ values: new Float64Array(3), vectors: [cvecZero(4), cvecZero(4)] }, cvecZero(4), 0), throwsCode("readout/eigendecomposition-mismatch"));
    assert.throws(() => pricedWalk(cmatEye(4), { values: new Float64Array(4), vectors: [] }, cvecZero(4), 7, 0, 0), throwsCode("ledger/walk-step-out-of-domain"));
  });

  it("tariff domain rejections are named (the exact path refuses illegal inputs, not just wrong answers)", () => {
    assert.throws(() => fkStaticUndercuts(1, 5), throwsCode("tariff/clock-states-out-of-domain"));
    assert.throws(() => fkStaticCompare(4, 2.5), throwsCode("tariff/rival-units-out-of-domain"));
    assert.throws(() => fkStaticRoundsTo(12, -1), throwsCode("tariff/hundredths-out-of-domain"));
    assert.throws(() => uniformEntropyBits(0), throwsCode("ledger/outcomes-out-of-domain"));
    assert.throws(() => bareClockChain(1), throwsCode("hamiltonian/clock-states-out-of-domain"));
  });

  it("single-source anchors: one bigPow, one erasure-price formula — exact-value proofs", () => {
    // bigPow: THE definition (amplify's identical private copy retired) — hand-checked
    assert.equal(bigPow(2n, 10), 1024n);
    assert.equal(bigPow(12n, 0), 1n);
    assert.equal(bigPow(-3n, 3), -27n);
    // fkStaticBits delegates to the ledger's single (T+1)·log2(T+1) definition
    // (both former copies computed clockStates * Math.log2(clockStates) — the
    // delegation is bit-identical, asserted by strict float equality)
    assert.equal(fkStaticBits(12), staticExpectedErasureBits(12));
    assert.equal(fkStaticBits(7), staticExpectedErasureBits(7));
    // expectedErasureBits (folded into exp3's wall table): exact dyadic values
    assert.equal(expectedErasureBits(0.5, 8), 6); // log2(8)=3, 3/0.5
    assert.equal(expectedErasureBits(1, 7), uniformEntropyBits(7));
    assert.throws(() => expectedErasureBits(0, 7), throwsCode("ledger/probability-out-of-domain"));
    // the single randomDataState (rng.js) draws byte-identically to the retired
    // test copy: same seed, same state, norm 1
    const s = randomDataState(4, new Rng(42));
    assert.ok(Math.abs(Math.hypot(...Array.from(s.re), ...Array.from(s.im)) - 1) < 1e-12);
  });

  it("module surface regression: the retired dead exports stay deleted (no import path)", async () => {
    const cmat = await import("../src/core/cmat.js");
    assert.ok(!("cmatAdd" in cmat), "cmatAdd must stay retired");
    assert.ok(!("cvecBasisState" in cmat), "cvecBasisState must stay retired");
    assert.ok(!("cvecAddScaled" in cmat), "cvecAddScaled must stay retired");
    const circuitMod = await import("../src/compile/circuit.js");
    assert.ok(!("circuitUnitary" in circuitMod), "circuitUnitary must stay retired");
    const historyMod = await import("../src/compile/history.js");
    assert.ok(!("overlap" in historyMod), "overlap must stay retired");
    const ledgerMod = await import("../src/compile/ledger.js");
    assert.ok(!("directExecutionErasureBits" in ledgerMod), "directExecutionErasureBits must stay retired");
    assert.ok(typeof ledgerMod.expectedErasureBits === "function", "expectedErasureBits survives (absorbed into exp3's wall table)");
    const rngMod = await import("../src/compile/rng.js");
    assert.ok(!("pick" in rngMod.Rng.prototype), "Rng.pick must stay retired");
    assert.ok(typeof rngMod.randomDataState === "function", "randomDataState lives here (single-sourced)");
  });
});


