import { strict as assert } from "node:assert";
import { test } from "node:test";
import { FtQaoaError } from "../src/core/errors.js";
import { StateVector } from "../src/core/statevector.js";
import { DensityMatrix } from "../src/core/density.js";
import { Rng } from "../src/core/rng.js";
import { bruteForce, energies } from "../src/core/ising.js";
import { blocksFor, grossCode, surfaceCode } from "../src/ft/codes.js";
import { DEFAULT_LOGICAL_ERROR_MODEL } from "../src/ft/codes.js";
import { tCountForRotation, DEFAULT_SYNTHESIS } from "../src/ft/synthesis.js";
import { DEFAULT_FT_ASSUMPTIONS, estimateDeepQaoa } from "../src/ft/estimate.js";
import { LIVE_CONSTANT_VALUES } from "../src/ft/constants.js";
import { analyzeDecoderSchedule } from "../src/ft/decoder-scheduler.js";
import type { DecoderScenario } from "../src/ft/decoder-scheduler.js";
import { applyReadoutFlips } from "../src/qaoa/noise.js";
import { makeParams } from "../src/qaoa/engine.js";

/** The shared conviction helper: the named code, and only that code, fires. */
function expectCode(fn: () => unknown, code: string): void {
  assert.throws(
    fn,
    (err: unknown) => {
      assert.ok(err instanceof FtQaoaError, `expected FtQaoaError [${code}], got: ${String(err)}`);
      assert.equal(err.name, "FtQaoaError");
      assert.equal(err.code, code, `rejection must be named ${code}`);
      assert.ok(err.message.startsWith(`[${code}]`), "message must lead with the code");
      return true;
    },
    `expected a named [${code}] rejection`,
  );
}

test("errors: FtQaoaError carries a stable machine-readable code", () => {
  const err = new FtQaoaError("TEST_CODE", "the offense");
  assert.ok(err instanceof Error);
  assert.equal(err.name, "FtQaoaError");
  assert.equal(err.code, "TEST_CODE");
  assert.equal(err.message, "[TEST_CODE] the offense");
});

test("smuggling trial: ragged gamma/beta pairs are named and rejected (PARAM_LENGTH_MISMATCH)", () => {
  expectCode(() => makeParams([0.1, 0.2], [0.3]), "PARAM_LENGTH_MISMATCH");
  expectCode(() => makeParams([], [0.3]), "PARAM_LENGTH_MISMATCH");
  // Positive control: matched lengths still pass through untouched.
  assert.deepEqual(makeParams([0.1], [0.3]), { gammas: [0.1], betas: [0.3] });
});

test("smuggling trial: qubit counts that would wrap a 32-bit shift are named and rejected (QUBIT_COUNT_INVALID)", () => {
  // 1 << 32 === 1 in JS: n=32 would silently build a 1-entry "statevector".
  expectCode(() => StateVector.plusState(32), "QUBIT_COUNT_INVALID");
  expectCode(() => StateVector.plusState(31), "QUBIT_COUNT_INVALID");
  expectCode(() => StateVector.plusState(-1), "QUBIT_COUNT_INVALID");
  expectCode(() => StateVector.plusState(2.5), "QUBIT_COUNT_INVALID");
  expectCode(() => DensityMatrix.plusState(31), "QUBIT_COUNT_INVALID");
  expectCode(() => DensityMatrix.fromPureState(31, new Float64Array(2), new Float64Array(2)), "QUBIT_COUNT_INVALID");
  expectCode(() => energies({ n: 32, fields: [], couplings: [] }), "QUBIT_COUNT_INVALID");
  // Positive control at the degenerate boundary: n=0 is a legal 1-dim trivial system.
  const sv0 = StateVector.plusState(0);
  assert.equal(sv0.dim, 1);
  assert.equal(sv0.re[0], 1);
});

test("smuggling trial: mis-sized energy tables are named at the phase gate (ENERGY_LENGTH_MISMATCH)", () => {
  const sv = StateVector.plusState(2);
  expectCode(() => { sv.applyCostPhase(0.1, new Float64Array(3)); }, "ENERGY_LENGTH_MISMATCH");
  expectCode(() => { sv.applyCostPhase(0.1, new Float64Array(8)); }, "ENERGY_LENGTH_MISMATCH");
  const rho = DensityMatrix.plusState(1);
  expectCode(() => { rho.applyCostPhase(0.1, new Float64Array([1])); }, "ENERGY_LENGTH_MISMATCH");
  // Positive control: an exactly-sized table applies cleanly.
  sv.applyCostPhase(0.1, new Float64Array(4));
  assert.ok(Math.abs(sv.norm() - 1) < 1e-12);
});

test("smuggling trial: depolarizing qubit index and probability domains are named (QUBIT_INDEX_INVALID / DEPOLARIZE_P_INVALID)", () => {
  const rho = DensityMatrix.plusState(2);
  // j=2 and j=32 both fall outside [0, n); 1 << 32 wraps to hit qubit 1 silently.
  expectCode(() => { rho.depolarizeQubit(2, 0.1); }, "QUBIT_INDEX_INVALID");
  expectCode(() => { rho.depolarizeQubit(32, 0.1); }, "QUBIT_INDEX_INVALID");
  expectCode(() => { rho.depolarizeQubit(-1, 0.1); }, "QUBIT_INDEX_INVALID");
  expectCode(() => { rho.depolarizeQubit(0, -0.1); }, "DEPOLARIZE_P_INVALID");
  expectCode(() => { rho.depolarizeQubit(0, 1.1); }, "DEPOLARIZE_P_INVALID");
  // Positive controls at the domain boundaries.
  rho.depolarizeQubit(1, 1);
  assert.ok(Math.abs(rho.trace() - 1) < 1e-12);
});

test("smuggling trial: readout channel names q outside [0,1] and mis-sized vectors (READOUT_Q_INVALID / PROB_LENGTH_MISMATCH)", () => {
  const probs = new Float64Array(4);
  expectCode(() => applyReadoutFlips(probs, 2, 1.5), "READOUT_Q_INVALID");
  expectCode(() => applyReadoutFlips(probs, 2, -0.1), "READOUT_Q_INVALID");
  expectCode(() => applyReadoutFlips(probs, 3, 0.1), "PROB_LENGTH_MISMATCH");
  // Positive controls: q=0 is the documented no-op, q=1 is the full-shuffle boundary.
  const zero = applyReadoutFlips(probs, 2, 0);
  assert.deepEqual(Array.from(zero), [0, 0, 0, 0]);
  const shuffled = applyReadoutFlips(new Float64Array([0.25, 0.25, 0.25, 0.25]), 2, 1);
  assert.deepEqual(Array.from(shuffled), [0.25, 0.25, 0.25, 0.25]);
});

test("smuggling trial: pure-state construction names wrong lengths (PURE_STATE_LENGTH_MISMATCH)", () => {
  expectCode(
    () => DensityMatrix.fromPureState(1, new Float64Array([1]), new Float64Array(2)),
    "PURE_STATE_LENGTH_MISMATCH",
  );
});

test("smuggling trial: code catalog names illegal distances and qubit counts (CODE_DISTANCE_INVALID / LOGICAL_QUBITS_INVALID)", () => {
  expectCode(() => surfaceCode(1.5), "CODE_DISTANCE_INVALID");
  expectCode(() => surfaceCode(0), "CODE_DISTANCE_INVALID");
  assert.equal(surfaceCode(2).n, 4, "d=2 is the legal boundary");
  expectCode(() => blocksFor(0, grossCode()), "LOGICAL_QUBITS_INVALID");
  expectCode(() => blocksFor(3.5, grossCode()), "LOGICAL_QUBITS_INVALID");
  assert.equal(blocksFor(1, grossCode()), 1, "a single logical qubit is the legal boundary");
});

test("smuggling trial: bruteForce refuses an empty energy table by name (ENERGY_TABLE_EMPTY)", () => {
  expectCode(() => bruteForce(new Float64Array(0)), "ENERGY_TABLE_EMPTY");
});

test("smuggling trial: synthesis epsilon outside (0,1] is named (SYNTH_EPSILON_INVALID)", () => {
  expectCode(() => tCountForRotation({ epsilon: 0 }), "SYNTH_EPSILON_INVALID");
  expectCode(() => tCountForRotation({ epsilon: 1.5 }), "SYNTH_EPSILON_INVALID");
  expectCode(() => tCountForRotation({ epsilon: -1 }), "SYNTH_EPSILON_INVALID");
  // Positive control at the boundary: eps=1 gives log2(1)=0, so T = additive floor.
  assert.equal(tCountForRotation({ epsilon: 1, coefficient: 3, additiveConstant: 4 }), 4);
});

test("smuggling trial: estimator names zero/fractional depth (QAOA_DEPTH_INVALID)", () => {
  const model = { n: 4, fields: [0, 0, 0, 0], couplings: [{ j: 0, k: 1, w: 1 }] };
  expectCode(() => estimateDeepQaoa({ model, code: grossCode(), qaoaDepth: 0 }), "QAOA_DEPTH_INVALID");
  expectCode(() => estimateDeepQaoa({ model, code: grossCode(), qaoaDepth: 2.5 }), "QAOA_DEPTH_INVALID");
  expectCode(() => estimateDeepQaoa({ model, code: grossCode(), qaoaDepth: -8 }), "QAOA_DEPTH_INVALID");
});

test("smuggling trial: decoder scheduler names degenerate scenario inputs", () => {
  const rng = new Rng(1);
  const good: DecoderScenario = {
    id: "ok",
    unit: { latencyUs: 100, roundsPerSecond: 20000 },
    units: 32,
    windowRounds: 8,
    note: "base",
  };
  const variant = (over: Partial<DecoderScenario>): DecoderScenario => ({ ...good, ...over });
  expectCode(() => analyzeDecoderSchedule(0, 1, 7, good, rng), "TOTAL_ROUNDS_INVALID");
  expectCode(() => analyzeDecoderSchedule(1000, 0, 7, good, rng), "CYCLE_TIME_INVALID");
  expectCode(() => analyzeDecoderSchedule(1000, 1, 0, good, rng), "BLOCK_COUNT_INVALID");
  expectCode(() => analyzeDecoderSchedule(1000, 1, 7, variant({ units: 0 }), rng), "FLEET_SIZE_INVALID");
  expectCode(() => analyzeDecoderSchedule(1000, 1, 7, variant({ windowRounds: 0 }), rng), "WINDOW_ROUNDS_INVALID");
  expectCode(
    () => analyzeDecoderSchedule(1000, 1, 7, variant({ unit: { latencyUs: 100, roundsPerSecond: 0 } }), rng),
    "DECODER_UNIT_SPEC_INVALID",
  );
  // Positive control: the untouched scenario still simulates.
  const result = analyzeDecoderSchedule(1000, 1, 7, good, rng);
  assert.ok(result.utilization > 0);
});

test("single-source: DEFAULT_FT_ASSUMPTIONS consumes the canonical constants by reference (no drift site)", () => {
  // The prefactor and the synthesis defaults are declared exactly once
  // (codes.ts / synthesis.ts); the estimator holds references, not copies —
  // a re-duplicated literal here is convicted on the spot.
  assert.equal(DEFAULT_FT_ASSUMPTIONS.logicalErrorModel, DEFAULT_LOGICAL_ERROR_MODEL);
  assert.equal(DEFAULT_FT_ASSUMPTIONS.synthesis, DEFAULT_SYNTHESIS);
  assert.equal(DEFAULT_FT_ASSUMPTIONS.logicalErrorModel.amplitude, 0.1);
  assert.deepEqual(
    {
      epsilon: DEFAULT_FT_ASSUMPTIONS.synthesis.epsilon,
      coefficient: DEFAULT_FT_ASSUMPTIONS.synthesis.coefficient,
      additiveConstant: DEFAULT_FT_ASSUMPTIONS.synthesis.additiveConstant,
    },
    { epsilon: 1e-6, coefficient: 3, additiveConstant: 4 },
  );
  // The audit's drift oracle binds the same single source.
  assert.equal(
    LIVE_CONSTANT_VALUES["DEFAULT_FT_ASSUMPTIONS.logicalErrorModel.amplitude"],
    DEFAULT_LOGICAL_ERROR_MODEL.amplitude,
  );
});
