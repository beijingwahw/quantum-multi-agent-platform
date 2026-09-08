import { strict as assert } from "node:assert";
import { test } from "node:test";
import { Rng } from "../src/core/rng.js";
import { randomIsing } from "../src/core/ising.js";
import { blocksFor, grossCode, logicalErrorPerRound, physicalQubits, surfaceCode } from "../src/ft/codes.js";
import { qaoaLayerProfile, tCountForRotation } from "../src/ft/synthesis.js";
import { DEFAULT_SYNTHESIS } from "../src/ft/synthesis.js";
import { DEFAULT_FT_ASSUMPTIONS, estimateDeepQaoa, selectCodes } from "../src/ft/estimate.js";
import { analyzeDecoderSchedule, DECODER_SCENARIOS, windowPolicySweep } from "../src/ft/decoder-scheduler.js";

test("codes: catalog invariants and published parameters", () => {
  const surface = surfaceCode(5);
  assert.equal(surface.n, 25);
  assert.equal(surface.k, 1);
  assert.equal(surface.ancilla, 24);
  assert.equal(surface.checks, 24);
  const gross = grossCode();
  assert.equal(gross.n, 144);
  assert.equal(gross.k, 12);
  assert.equal(gross.d, 12);
  assert.equal(gross.ancilla, 144);
  assert.equal(gross.checks, 144);
  assert.ok(gross.source.includes("Bravyi"));
  assert.equal(blocksFor(80, gross), 7);
  assert.equal(blocksFor(12, gross), 1);
  assert.equal(physicalQubits(1, gross), 288);
});

test("codes: logical error per round follows the power law and shrinks with d and p_phys", () => {
  const pPhys = 1e-3;
  const e5 = logicalErrorPerRound(surfaceCode(5), pPhys);
  const e7 = logicalErrorPerRound(surfaceCode(7), pPhys);
  const e7better = logicalErrorPerRound(surfaceCode(7), 1e-4);
  assert.ok(Math.abs(e5 - 0.1 * Math.pow(1 / 6, 3)) < 1e-18);
  assert.ok(e7 < e5);
  assert.ok(e7better < e7);
  assert.ok(logicalErrorPerRound(grossCode(), pPhys) > 0);
});

test("synthesis: T-count formula and per-layer profile", () => {
  assert.equal(tCountForRotation({ epsilon: 1e-6, coefficient: 3, additiveConstant: 4 }), 64);
  assert.ok(tCountForRotation({ epsilon: 1e-9, coefficient: 3, additiveConstant: 4 }) > 64);
  const model = { n: 4, fields: [0, 0, 0, 0], couplings: Array.from({ length: 5 }, (_, i) => ({ j: i % 3, k: (i % 3) + 1, w: 1 })) };
  const profile = qaoaLayerProfile(model, DEFAULT_SYNTHESIS);
  assert.equal(profile.twoQubitRotations, 5);
  assert.equal(profile.singleQubitRotations, 8);
  assert.equal(profile.tCount, 13 * tCountForRotation(DEFAULT_SYNTHESIS));
});

test("estimate: block accounting, T totals, and error budget composition", () => {
  const model = randomIsing(new Rng(51), 12);
  const est = estimateDeepQaoa({ model, code: grossCode(), qaoaDepth: 8 });
  assert.equal(est.blocks, 1);
  assert.equal(est.dataQubits, 144);
  assert.equal(est.ancillaQubits, 144);
  const m = model.couplings.length;
  assert.equal(est.rotationsPerLayer, m + 2 * 12);
  assert.equal(est.logicalOpsTotal, 8 * (m + 24));
  assert.equal(est.syndromeRoundsPerOp, 12);
  assert.equal(est.syndromeRoundsTotal, est.logicalOpsTotal * 12);
  const a = DEFAULT_FT_ASSUMPTIONS;
  assert.ok(Math.abs(est.epsilonChannelTotal - est.logicalOpsTotal * est.epsilonChannelPerOp) < 1e-18);
  assert.ok(
    Math.abs(est.epsilonTotal - (est.epsilonChannelTotal + est.epsilonDistillationTotal)) < 1e-18,
  );
  assert.equal(est.meetsBudget, est.epsilonTotal <= a.targetCircuitError);
  assert.ok(est.totalPhysicalQubits >= est.dataQubits + est.ancillaQubits);
});

test("estimate: selectCodes returns a feasible surface distance when one exists", () => {
  const model = randomIsing(new Rng(53), 12);
  const { surface, gross } = selectCodes(model, 100);
  assert.ok(surface.code.d >= 3 && surface.code.d <= 31);
  assert.equal(gross.code.id, "gross-bb-144-12-12");
  // L=12 fits a single gross block; at p_phys=1e-3 its fixed d=12 either passes
  // or fails the budget, and meetsBudget must agree with the composed epsilon.
  assert.equal(gross.meetsBudget, gross.epsilonTotal <= DEFAULT_FT_ASSUMPTIONS.targetCircuitError);
});

test("decoder: utilization scales inversely with fleet size; verdicts match the ceiling", () => {
  const base = {
    unit: { latencyUs: 10, roundsPerSecond: 200000 },
    windowRounds: 8,
    note: "test",
  };
  const small = analyzeDecoderSchedule(50000, 1, 7, { ...base, id: "x1", units: 7 }, new Rng(1));
  const big = analyzeDecoderSchedule(50000, 1, 7, { ...base, id: "x2", units: 70 }, new Rng(1));
  assert.ok(small.utilization > big.utilization);
  assert.ok(Math.abs(small.utilization / big.utilization - 10) < 1e-9);
  assert.equal(small.verdict, small.utilization <= 0.95 ? "realtime" : "backlog-grows");
  assert.equal(big.verdict, big.utilization <= 0.95 ? "realtime" : "backlog-grows");
});

test("decoder: seeded determinism and bounded backlog in the real-time regime", () => {
  const scenario = DECODER_SCENARIOS[4]!; // aggressive asic
  const r1 = analyzeDecoderSchedule(100000, 1, 7, scenario, new Rng(77));
  const r2 = analyzeDecoderSchedule(100000, 1, 7, scenario, new Rng(77));
  assert.deepEqual(r1, r2);
  assert.equal(r1.verdict, "realtime");
  assert.ok(r1.maxBacklogRounds < 400, `backlog should stay bounded, got ${r1.maxBacklogRounds}`);
  assert.notEqual(r1.extrapolatedDrainUs, null);
});

test("decoder: CPU-class BP+OSD cannot keep up (the known bottleneck)", () => {
  const scenario = DECODER_SCENARIOS[0]!; // 1 ms/round CPU
  const r = analyzeDecoderSchedule(100000, 1, 7, scenario, new Rng(3));
  assert.equal(r.verdict, "backlog-grows");
  assert.ok(r.utilization > 100);
  assert.equal(r.extrapolatedDrainUs, null);
});

test("decoder: window-size policy prices the batching tradeoff and picks a feasible window", () => {
  const base = {
    unit: { latencyUs: 100, roundsPerSecond: 20000 }, // FPGA-class
    units: 512,
    windowRounds: 8,
    note: "policy sweep test",
  };
  const sweep = windowPolicySweep(614400, 1, 7, { ...base, id: "fpga-sweep" }, [1, 2, 4, 8, 16, 32], new Rng(5));
  assert.equal(sweep.points.length, 6);
  // Streaming single-round windows: fixed 100 us decode latency per window
  // cannot fit a 1 us cycle even across 73 units/block -> backlog.
  assert.equal(sweep.points[0]!.windowRounds, 1);
  assert.equal(sweep.points[0]!.verdict, "backlog-grows");
  // Utilization amortizes toward 1/(mu*tau*k) as W grows (monotone decrease here).
  for (let i = 1; i < sweep.points.length; i++) {
    assert.ok(sweep.points[i]!.utilization < sweep.points[i - 1]!.utilization + 1e-12);
  }
  // Correction latency grows with the window fill time; the policy must pick
  // the smallest realtime-feasible window (W=4 still exceeds the ceiling at
  // utilization 1.03, W=8 is the first to pass at 0.856).
  assert.equal(sweep.minLatencyRealtimeWindow, 8);
  const asic = windowPolicySweep(614400, 1, 7, { ...DECODER_SCENARIOS[4]!, id: "asic-sweep" }, [1, 2, 4, 8], new Rng(5));
  assert.equal(asic.minLatencyRealtimeWindow, 1);
  // A hopeless fleet stays hopeless at every window size.
  const cpu = windowPolicySweep(614400, 1, 7, { ...DECODER_SCENARIOS[0]!, id: "cpu-sweep" }, [1, 8, 32, 128], new Rng(5));
  assert.equal(cpu.minLatencyRealtimeWindow, null);
});
