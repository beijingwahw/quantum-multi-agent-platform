import { strict as assert } from "node:assert";
import { test } from "node:test";
import { Rng } from "../src/core/rng.js";
import { bruteForce, cutSize, energies, maxcut3Reg, randomIsing } from "../src/core/ising.js";
import { StateVector } from "../src/core/statevector.js";
import { appendZeroLayer, embeddingGap, makeParams, qaoaExpectation, qaoaState } from "../src/qaoa/engine.js";
import { interp, linearRamp } from "../src/qaoa/params.js";
import { coordinateDescent, depthLadder, goldenMax, optimizeRampT } from "../src/qaoa/optimize.js";
import { monotonicityReport, verifyEmbedding } from "../src/qaoa/monotonic.js";

test("rng: same seed gives identical streams, different seeds differ", () => {
  const a = new Rng(42);
  const b = new Rng(42);
  const c = new Rng(43);
  const sa = Array.from({ length: 100 }, () => a.next());
  const sb = Array.from({ length: 100 }, () => b.next());
  const sc = Array.from({ length: 100 }, () => c.next());
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, sc);
  for (const x of sa) assert.ok(x >= 0 && x < 1);
});

test("ising: energies match hand formula on n=2", () => {
  const model = { n: 2, fields: [0.5, -0.25], couplings: [{ j: 0, k: 1, w: 0.75 }] };
  const E = energies(model);
  // spin = +1 when bit is 0, -1 when bit is 1
  const z = (s: number, j: number): number => ((s >>> j) & 1 ? -1 : 1);
  for (let s = 0; s < 4; s++) {
    const expected = 0.5 * z(s, 0) - 0.25 * z(s, 1) + 0.75 * z(s, 0) * z(s, 1);
    assert.ok(Math.abs(E[s]! - expected) < 1e-15);
  }
});

test("ising: maxcut3Reg is exactly 3-regular and cut mapping is consistent", () => {
  const rng = new Rng(7);
  for (const n of [4, 6, 10, 12]) {
    const model = maxcut3Reg(rng, n);
    const degree = new Map<number, number>();
    const edgeSet = new Set<string>();
    for (const c of model.couplings) {
      const key = `${c.j}-${c.k}`;
      assert.ok(!edgeSet.has(key), "duplicate edge");
      edgeSet.add(key);
      degree.set(c.j, (degree.get(c.j) ?? 0) + 1);
      degree.set(c.k, (degree.get(c.k) ?? 0) + 1);
    }
    for (const d of degree.values()) assert.equal(d, 3);
    assert.equal(model.couplings.length, (3 * n) / 2);
  }
  const model = maxcut3Reg(new Rng(11), 10);
  const E = energies(model);
  const { optimum, argmax } = bruteForce(E);
  assert.equal(optimum, Math.max(...E));
  let direct = 0;
  for (const c of model.couplings) {
    if (((argmax >>> c.j) & 1) !== ((argmax >>> c.k) & 1)) direct++;
  }
  assert.equal(direct, cutSize(model, optimum));
});

test("statevector: plus state, norm preservation, zero-angle identities", () => {
  const sv = StateVector.plusState(4);
  assert.equal(sv.dim, 16);
  assert.ok(Math.abs(sv.norm() - 1) < 1e-12);
  const probs = sv.probabilities();
  for (const p of probs) assert.ok(Math.abs(p - 1 / 16) < 1e-15);
  for (let s = 0; s < sv.dim; s++) {
    assert.ok(Math.abs(sv.re[s]! - Math.sqrt(1 / 16)) < 1e-15);
    assert.equal(sv.im[s], 0);
  }
  const rng = new Rng(1);
  const E = new Float64Array(16);
  for (let s = 0; s < 16; s++) E[s] = rng.range(-2, 2);
  const before = sv.clone();
  sv.applyCostPhase(0, E);
  sv.applyMixer(0);
  for (let s = 0; s < 16; s++) {
    assert.ok(Math.abs(sv.re[s]! - before.re[s]!) < 1e-15);
    assert.ok(Math.abs(sv.im[s]! - before.im[s]!) < 1e-15);
  }
  const randomized = StateVector.plusState(4);
  randomized.applyCostPhase(0.37, E);
  randomized.applyMixer(0.22);
  assert.ok(Math.abs(randomized.norm() - 1) < 1e-12, "unitarity");
});

test("statevector: n=1 forward pass matches independent complex arithmetic", () => {
  const e0 = 1;
  const e1 = -1;
  const gamma = 0.6;
  const beta = 0.35;
  const sv = StateVector.plusState(1);
  const E = new Float64Array([e0, e1]);
  sv.applyCostPhase(gamma, E);
  sv.applyMixer(beta);
  // Independent reference: amp * exp(-i gamma E), then [[cos, -i sin], [-i sin, cos]].
  const refRe = [0, 0];
  const refIm = [0, 0];
  for (let s = 0; s < 2; s++) {
    const phase = -gamma * (s === 0 ? e0 : e1);
    refRe[s] = Math.cos(phase) / Math.SQRT2;
    refIm[s] = Math.sin(phase) / Math.SQRT2;
  }
  const c = Math.cos(beta);
  const si = Math.sin(beta);
  const outRe = [c * refRe[0]! + si * refIm[1]!, c * refRe[1]! + si * refIm[0]!];
  const outIm = [c * refIm[0]! - si * refRe[1]!, c * refIm[1]! - si * refRe[0]!];
  assert.ok(Math.abs(sv.re[0]! - outRe[0]!) < 1e-14);
  assert.ok(Math.abs(sv.im[0]! - outIm[0]!) < 1e-14);
  assert.ok(Math.abs(sv.re[1]! - outRe[1]!) < 1e-14);
  assert.ok(Math.abs(sv.im[1]! - outIm[1]!) < 1e-14);
});

test("engine: p=0 expectation is exactly 0; appending zero layers never changes the value", () => {
  const model = randomIsing(new Rng(5), 5);
  const E = energies(model);
  assert.ok(Math.abs(qaoaExpectation(model, E, makeParams([], []))) < 1e-12);
  const rng = new Rng(9);
  const params = makeParams(
    Array.from({ length: 4 }, () => rng.range(-0.5, 0.5)),
    Array.from({ length: 4 }, () => rng.range(-0.3, 0.3)),
  );
  const base = qaoaExpectation(model, E, params);
  const padded = qaoaExpectation(model, E, appendZeroLayer(appendZeroLayer(params)));
  assert.ok(Math.abs(base - padded) < 1e-12);
  assert.ok(embeddingGap(model, E, params) < 1e-12);
});

test("engine: expectation never exceeds the exact optimum (variational bound)", () => {
  const model = randomIsing(new Rng(13), 6);
  const E = energies(model);
  const optimum = bruteForce(E).optimum;
  const rng = new Rng(17);
  for (let i = 0; i < 50; i++) {
    const params = makeParams(
      Array.from({ length: 3 }, () => rng.range(-1, 1)),
      Array.from({ length: 3 }, () => rng.range(-0.5, 0.5)),
    );
    assert.ok(qaoaExpectation(model, E, params) <= optimum + 1e-12);
  }
});

test("verifyEmbedding: engine-level identity holds at several depths on seeded angles", () => {
  const model = randomIsing(new Rng(23), 6);
  const E = energies(model);
  for (const p of [1, 7, 63]) {
    const check = verifyEmbedding(model, E, p, 99, 1e-10);
    assert.ok(check.passed, `embedding gap too large at p=${p}: ${check.gap}`);
    assert.ok(check.gap < 1e-12);
  }
});

test("params: ramp shape, interp endpoints, interp preserves depth-p value under scaling 1", () => {
  const ramp = linearRamp(8, 4);
  assert.equal(ramp.gammas.length, 8);
  assert.ok(ramp.gammas[7]! > ramp.gammas[0]!);
  assert.ok(ramp.betas[7]! < ramp.betas[0]!);
  const same = interp(ramp, 8);
  for (let t = 0; t < 8; t++) {
    assert.ok(Math.abs(same.gammas[t]! - ramp.gammas[t]!) < 1e-12);
  }
  const deep = interp(ramp, 64);
  assert.equal(deep.gammas.length, 64);
  assert.ok(Math.abs(deep.gammas[63]! - ramp.gammas[7]!) < 1e-12, "endpoint match");
});

test("optimize: golden search beats bracket endpoints; ramp tuning and descent only improve", () => {
  const f = (x: number): number => -((x - 0.3) ** 2);
  const res = goldenMax(f, -2, 2, 30);
  assert.ok(Math.abs(res.x - 0.3) < 1e-6);
  const model = randomIsing(new Rng(31), 6);
  const E = energies(model);
  const tuned = optimizeRampT(model, E, 2);
  const endpointLow = qaoaExpectation(model, E, linearRamp(2, 0.05));
  const endpointHigh = qaoaExpectation(model, E, linearRamp(2, 40));
  assert.ok(tuned.expectation >= endpointLow - 1e-12);
  assert.ok(tuned.expectation >= endpointHigh - 1e-12);
  const polished = coordinateDescent(
    (params) => qaoaExpectation(model, E, params),
    tuned.params,
    { passes: 2 },
  );
  assert.ok(
    qaoaExpectation(model, E, polished) >= tuned.expectation - 1e-12,
    "coordinate descent must not lose ground",
  );
});

test("optimize: depth ladder is sorted and reuses the ramp+interp route", () => {
  const model = randomIsing(new Rng(37), 8);
  const E = energies(model);
  const ladder = depthLadder(model, E, 4, [4, 8, 16]);
  assert.deepEqual(ladder.map((pt) => pt.p), [4, 8, 16]);
  for (const pt of ladder) assert.equal(pt.params.gammas.length, pt.p);
});

test("monotonicity: optimized small-p ladder is non-decreasing (warm-started descent)", () => {
  const model = randomIsing(new Rng(41), 8);
  const E = energies(model);
  const optimum = bruteForce(E).optimum;
  const points: Array<{ p: number; best: number; ratio: number }> = [];
  let prev: null | { gammas: readonly number[]; betas: readonly number[] } = null;
  for (let p = 1; p <= 5; p++) {
    const start = prev ?? optimizeRampT(model, E, p).params;
    const polished = coordinateDescent(
      (params) => qaoaExpectation(model, E, params),
      start,
      { passes: 3 },
    );
    const value = qaoaExpectation(model, E, polished);
    points.push({ p, best: value, ratio: value / optimum });
    prev = { gammas: [...polished.gammas, 0], betas: [...polished.betas, 0] };
  }
  const report = monotonicityReport(points, 0);
  assert.ok(report.monotone, `violations: ${JSON.stringify(report.violations)}`);
});

test("engine: qaoaState returns a normalized state at p=128", () => {
  const model = randomIsing(new Rng(43), 8);
  const E = energies(model);
  const ramp = linearRamp(128, 8);
  const state = qaoaState(model, E, ramp);
  assert.ok(Math.abs(state.norm() - 1) < 1e-10);
  const expectation = qaoaExpectation(model, E, ramp);
  assert.ok(expectation <= bruteForce(E).optimum);
});
