import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cmatEye, cvecZero, eigHermitian, cmatMul, cvecInner, type CMat } from "../src/core/cmat.js";
import { unitaryDeviation, randomCircuit, demoProgram, dataBasisState } from "../src/compile/circuit.js";
import { assemble, buildFuel, buildInputCheck, buildOutputCheck, clockChainEigenvalue } from "../src/compile/hamiltonian.js";
import { historyState, staticReadoutFidelity } from "../src/compile/history.js";
import { pricedWalk, staticExpectedErasureBits } from "../src/compile/ledger.js";
import { bigPow } from "../src/compile/tariff.js";
import { acceptanceProbability, amplifiedStaticBits } from "../src/compile/amplify.js";
import { Rng } from "../src/compile/rng.js";
import { VacuumError } from "../src/core/cmat.js";

/** Convict by error code, never by message prose. */
function throwsCode(code: string): (err: unknown) => boolean {
  return (err: unknown): boolean => err instanceof VacuumError && err.code === code;
}

/**
 * Regression: the degenerate-input classes the v0.3.0 wall left alive.
 *
 * Probes that convicted each hole pre-fix:
 * - Rng.int(0) returned 0 and int(-1) returned -1 (not indices at all); a
 *   fractional n drew from the wrong range;
 * - pricedWalk with tMax = Infinity made `t <= tMax + 1e-9` always true — a
 *   synchronous sweep no timeout could interrupt;
 * - buildFuel(epsilon = NaN) wrote NaN into the clock diagonal, and the
 *   assembled Hamiltonian sailed through Hermiticity (`NaN > tol` compares
 *   false) into a meaningless spectrum;
 * - a NaN grid crashed eigHermitian deep (odd-multiplicity at lambda NaN) or
 *   returned garbage — never named at the entry;
 * - clockChainEigenvalue(0, 0) divided by zero into NaN while its sibling
 *   bareClockChain refuses clockStates < 2 by name; k = C read past the
 *   spectrum and returned a plausible 2;
 * - bigPow(2n, -1) silently returned 1n; bigPow(2n, 2.5) returned 8n;
 * - buildInputCheck / buildOutputCheck / acceptanceProbability shifted by
 *   (nQubits-1-q) < 0 on an out-of-register qubit ((d >> -1) reads 0) — a
 *   silently wrong penalty/probability surface;
 * - amplifiedStaticBits(3, 1.5) priced one and a half rounds;
 * - randomCircuit(0, ...) crashed on a raw TypeError; a fractional depth
 *   silently composed ceil(depth) steps.
 */
describe("Q1 Rng.int names its degenerate domain", () => {
  it("int(0), int(-1) and a fractional n are refused — they returned 0, -1, and biased draws", () => {
    const r = new Rng(1);
    assert.throws(() => r.int(0), throwsCode("rng/int-out-of-domain"));
    assert.throws(() => r.int(-3), throwsCode("rng/int-out-of-domain"));
    assert.throws(() => r.int(2.5), throwsCode("rng/int-out-of-domain"));
  });

  it("legal draws are unchanged: the seeded stream still reads 4,3,5,4,1 from Rng(42).int(7)", () => {
    const r = new Rng(42);
    assert.deepEqual([r.int(7), r.int(7), r.int(7), r.int(7), r.int(7)], [4, 3, 5, 4, 1]);
    for (let k = 0; k < 100; k++) {
      const v = r.int(7);
      assert.ok(Number.isInteger(v) && v >= 0 && v < 7);
    }
  });
});

describe("Q2 the walk sweep refuses a non-finite horizon or step", () => {
  const comp = assemble(demoProgram(), { output: true });
  const eig = eigHermitian(comp.h);
  const psi0 = cvecZero(comp.h.dim);
  psi0.re[0] = 1;

  it("tMax = Infinity used to make the sweep condition always true (an uninterruptible loop)", () => {
    assert.throws(() => pricedWalk(comp.h, eig, psi0, 3, Number.POSITIVE_INFINITY), throwsCode("ledger/walk-horizon-out-of-domain"));
    assert.throws(() => pricedWalk(comp.h, eig, psi0, 3, Number.NaN), throwsCode("ledger/walk-horizon-out-of-domain"));
  });

  it("a non-finite step is refused alongside the existing non-positive step", () => {
    assert.throws(() => pricedWalk(comp.h, eig, psi0, 3, 4, Number.POSITIVE_INFINITY), throwsCode("ledger/walk-step-out-of-domain"));
    assert.throws(() => pricedWalk(comp.h, eig, psi0, 3, 4, 0), throwsCode("ledger/walk-step-out-of-domain"));
  });

  it("legal sweeps are unchanged: t in [0, tMax] inclusive, boundaries included", () => {
    const w = pricedWalk(comp.h, eig, psi0, 3, 1, 0.5);
    assert.deepEqual(w.samples.map((s) => s.t), [0, 0.5, 1]);
    assert.equal(w.peak, Math.max(...w.samples.map((s) => s.p)));
    const zero = pricedWalk(comp.h, eig, psi0, 3, 0, 0.5);
    assert.deepEqual(zero.samples.map((s) => s.t), [0]);
  });
});

describe("Q3 a non-finite fuel tilt is named, never assembled", () => {
  it("buildFuel refuses epsilon = NaN/Infinity — it used to write NaN diagonals that compared false against every tolerance", () => {
    assert.throws(() => buildFuel(2, 4, Number.NaN), throwsCode("hamiltonian/epsilon-out-of-domain"));
    assert.throws(() => buildFuel(2, 4, Number.POSITIVE_INFINITY), throwsCode("hamiltonian/epsilon-out-of-domain"));
    // pre-fix probe: assemble(demoProgram(), { epsilon: NaN }) was ACCEPTED
    // (hermDev NaN) and eigHermitian then died deep with "odd real
    // multiplicity at lambda NaN"
    assert.throws(() => assemble(demoProgram(), { epsilon: Number.NaN }), throwsCode("hamiltonian/epsilon-out-of-domain"));
  });

  it("legal tilts land exactly where they always did", () => {
    const hf = buildFuel(2, 4, 0.5);
    assert.ok(Math.abs(hf.re[0]![0] as number) < 1e-15); // -epsilon * 0 is -0; same value the T4 anchor pins
    assert.equal(hf.re[4]![4], -2);
  });
});

describe("Q4 a non-finite grid entry is a malformed grid, named at the entry", () => {
  const nanGrid: CMat = cmatEye(2);

  it("cmatMul and eigHermitian refuse NaN entries — they used to multiply NaN through or crash deep", () => {
    nanGrid.re[0]![1] = Number.NaN;
    nanGrid.re[1]![0] = Number.NaN;
    assert.throws(() => cmatMul(nanGrid, cmatEye(2)), throwsCode("cmat/malformed-grid"));
    // pre-fix probe: eigHermitian(nanGrid) crashed with a misleading
    // "odd real multiplicity" deep inside the solver, never naming the grid
    assert.throws(() => eigHermitian(nanGrid), throwsCode("cmat/malformed-grid"));
    assert.throws(() => eigHermitian({ ...nanGrid, re: [[1, Number.POSITIVE_INFINITY], [0, 0]], im: [[0, 0], [0, 0]] }), throwsCode("cmat/malformed-grid"));
  });

  it("a non-finite state vector is refused before it can poison the history or the readout", () => {
    const badInput = cvecZero(4);
    badInput.re[0] = Number.NaN;
    const circuit = demoProgram().circuit;
    assert.throws(() => historyState(circuit, badInput), throwsCode("cvec/malformed-vector"));
    assert.throws(() => staticReadoutFidelity(circuit, badInput, cvecZero(4)), throwsCode("cvec/malformed-vector"));
    assert.throws(() => cvecInner(badInput, badInput), throwsCode("cvec/malformed-vector"));
  });

  it("legal operands still pass through the guards bit-identically", () => {
    assert.equal(cmatMul(cmatEye(4), cmatEye(4)).re[3]![3], 1);
    const v = cvecZero(4);
    v.re[0] = 1;
    assert.equal(cvecInner(v, v).re, 1);
  });
});

describe("Q5 the closed-form clock chain carries its sibling's domain", () => {
  it("clockStates < 2 or fractional is refused — (0, 0) used to divide by zero into a silent NaN", () => {
    assert.throws(() => clockChainEigenvalue(0, 0), throwsCode("hamiltonian/clock-states-out-of-domain"));
    assert.throws(() => clockChainEigenvalue(0, -2), throwsCode("hamiltonian/clock-states-out-of-domain"));
    assert.throws(() => clockChainEigenvalue(0, 1.5), throwsCode("hamiltonian/clock-states-out-of-domain"));
  });

  it("k outside [0, C-1] is refused — k = C used to return a plausible 2 that is not in the spectrum", () => {
    assert.throws(() => clockChainEigenvalue(7, 6), throwsCode("hamiltonian/spectral-index-out-of-range"));
    assert.throws(() => clockChainEigenvalue(-1, 6), throwsCode("hamiltonian/spectral-index-out-of-range"));
    assert.throws(() => clockChainEigenvalue(0.5, 6), throwsCode("hamiltonian/spectral-index-out-of-range"));
  });

  it("legal anchors are unchanged, bit-identical to the formula", () => {
    assert.equal(clockChainEigenvalue(0, 6), 1 - Math.cos(0));
    assert.equal(clockChainEigenvalue(1, 6), 1 - Math.cos(Math.PI / 6));
    assert.equal(clockChainEigenvalue(5, 6), 1 - Math.cos((5 * Math.PI) / 6));
  });
});

describe("Q6 bigPow refuses a non-integer or negative exponent", () => {
  it("bigPow(2n, -1) used to return 1n silently; bigPow(2n, 2.5) returned 8n", () => {
    assert.throws(() => bigPow(2n, -1), throwsCode("tariff/exponent-out-of-domain"));
    assert.throws(() => bigPow(2n, 2.5), throwsCode("tariff/exponent-out-of-domain"));
  });

  it("legal powers are the same hand-checked integers", () => {
    assert.equal(bigPow(2n, 10), 1024n);
    assert.equal(bigPow(12n, 0), 1n);
    assert.equal(bigPow(-3n, 3), -27n);
  });
});

describe("Q7 out-of-register qubits never shift past the bit range", () => {
  it("buildInputCheck refuses them — q = -1 used to read (d >> -1) & 1 = 0 everywhere, a silently wrong penalty", () => {
    assert.throws(() => buildInputCheck(2, [-1], 4), throwsCode("hamiltonian/checked-qubit-out-of-range"));
    assert.throws(() => buildInputCheck(2, [2], 4), throwsCode("hamiltonian/checked-qubit-out-of-range"));
  });

  it("buildOutputCheck and acceptanceProbability refuse them — q = 5 on 2 qubits silently collapsed the probability", () => {
    assert.throws(() => buildOutputCheck(2, new Map([[-1, 1]]), 4), throwsCode("hamiltonian/accept-qubit-out-of-range"));
    assert.throws(() => buildOutputCheck(2, new Map([[2, 1]]), 4), throwsCode("hamiltonian/accept-qubit-out-of-range"));
    assert.throws(() => acceptanceProbability(cvecZero(4), 2, new Map([[5, 1]])), throwsCode("amplify/accept-qubit-out-of-range"));
  });

  it("legal placements still build the exact same surfaces", () => {
    const hin = buildInputCheck(2, [0], 4);
    assert.equal(hin.re[2 * 5]![2 * 5], 1);
    assert.equal(hin.re[3 * 5]![3 * 5], 1);
    assert.equal(hin.re[0]![0], 0);
    let penalized = 0;
    for (let d = 0; d < 4; d++) if (buildOutputCheck(2, new Map([[1, 1]]), 4).re[d * 5 + 4]![d * 5 + 4] === 1) penalized++;
    assert.equal(penalized, 2);
    assert.equal(acceptanceProbability(dataBasisState(2, [1, 1]), 2, new Map([[1, 1]])), 1);
    assert.equal(acceptanceProbability(dataBasisState(2, [1, 1]), 2, new Map([[1, 0]])), 0);
  });
});

describe("Q8 the amplification ledger prices whole rounds only", () => {
  it("amplifiedStaticBits(3, 1.5) used to price one and a half rounds silently", () => {
    assert.throws(() => amplifiedStaticBits(3, 1.5), throwsCode("amplify/rounds-out-of-domain"));
    assert.throws(() => amplifiedStaticBits(3, -2), throwsCode("amplify/rounds-out-of-domain"));
  });

  it("legal round counts price exactly as before", () => {
    assert.equal(amplifiedStaticBits(3, 8), 8 * staticExpectedErasureBits(3));
    assert.equal(amplifiedStaticBits(7, 1), staticExpectedErasureBits(7));
  });
});

describe("Q9 the random-circuit generator names its register and depth domain", () => {
  it("nQubits = 0 used to crash on a raw TypeError inside embedSingle", () => {
    assert.throws(() => randomCircuit(0, 3, new Rng(3)), throwsCode("circuit/qubit-count-out-of-domain"));
    assert.throws(() => randomCircuit(1.5, 3, new Rng(3)), throwsCode("circuit/qubit-count-out-of-domain"));
  });

  it("a fractional depth used to silently compose ceil(depth) steps", () => {
    assert.throws(() => randomCircuit(2, 2.5, new Rng(3)), throwsCode("circuit/depth-out-of-domain"));
  });

  it("legal generation is unchanged: same seed, same circuit, unitary steps", () => {
    const c = randomCircuit(2, 4, new Rng(205));
    assert.equal(c.steps.length, 4);
    assert.deepEqual(c.steps.map((s) => s.name), ["CNOT@0", "ZY", "HS", "YT"]);
    assert.ok(unitaryDeviation(c) < 1e-13);
    const again = randomCircuit(2, 4, new Rng(205));
    assert.deepEqual(again.steps.map((s) => s.name), c.steps.map((s) => s.name));
  });
});
