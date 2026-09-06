import { strict as assert } from "node:assert";
import { test } from "node:test";
import { Rng } from "../src/core/rng.js";
import { energies, randomIsing } from "../src/core/ising.js";
import { xBasisEnergies } from "../src/anneal/driver.js";
import { projectGroundState } from "../src/anneal/project.js";
import { SseSampler, runSignMeasurement, sseConfigFrom } from "../src/sse/sse.js";
import { exactSignAverage } from "../src/sse/enumerate.js";
import { exactSignRatio } from "../src/sse/exact-ratio.js";

function driverOf(model: ReturnType<typeof randomIsing>, kappa: number) {
  return { gamma: 1, couplings: model.couplings.map((c) => ({ j: c.j, k: c.k, w: kappa })) };
}

test("sse: kappa=0 has no sign problem (sign identically 1)", () => {
  const model = randomIsing(new Rng(5), 6);
  const cfg = sseConfigFrom(model, driverOf(model, 0), 0.5, 2);
  const sampler = new SseSampler(cfg, { seed: 11 });
  for (let i = 0; i < 500; i++) {
    sampler.sweep();
    assert.equal(sampler.sign(), 1);
    assert.equal(sampler.xxCount(), 0);
  }
});

test("sse: propagation consistency invariant holds across sweeps", () => {
  const model = randomIsing(new Rng(7), 6);
  const cfg = sseConfigFrom(model, driverOf(model, 0.8), 0.5, 3);
  const sampler = new SseSampler(cfg, { seed: 13 });
  for (let i = 0; i < 2000; i++) {
    sampler.sweep();
    if (i % 200 === 0) assert.ok(sampler.consistent(), `invariant broken at sweep ${i}`);
  }
  assert.ok(sampler.consistent());
});

test("sse: exact enumeration truncation is stable at small beta", () => {
  const model = randomIsing(new Rng(3), 2);
  const cfg = sseConfigFrom(model, driverOf(model, 0.8), 0.5, 0.25);
  const a = exactSignAverage(cfg, 8);
  const b = exactSignAverage(cfg, 9);
  assert.ok(Math.abs(a.signAvg - b.signAvg) < 5e-3, `orders 8 vs 9 differ: ${a.signAvg} vs ${b.signAvg}`);
  assert.ok(a.signAvg <= 1 && a.signAvg >= -1);
});

test("sse: MC average sign matches exact enumeration at n=2 (ground-truth referee)", () => {
  const model = randomIsing(new Rng(3), 2);
  const cfg = sseConfigFrom(model, driverOf(model, 0.8), 0.5, 0.25);
  const exact = exactSignAverage(cfg, 9);
  const exactLow = exactSignAverage(cfg, 8);
  const mc = runSignMeasurement(cfg, { warmup: 1500, measure: 60000, seed: 21 });
  // 截断差必须小于统计误差（裁判自身无系统偏差）
  assert.ok(Math.abs(exact.signAvg - exactLow.signAvg) < 3 * mc.signErr);
  assert.ok(
    Math.abs(mc.signAvg - exact.signAvg) < 5 * mc.signErr,
    `MC ${mc.signAvg.toFixed(5)}±${mc.signErr.toExponential(2)} vs exact ${exact.signAvg.toFixed(5)}`,
  );
  assert.ok(exact.signAvg < 0.999, "expected a non-trivial sign at kappa=0.8");
});

test("sse: MC average sign matches exact Z-ratio at n=3 (fast-mixing regime)", () => {
  // 奇扇区权重 ~30% 的参数点：扇区翻转频繁，自相关小——裁判检验的是正确性，
  // 不是墙（墙由 exp3 Part D 专门展示）。矩阵 Trotter 无截断误差。
  const model = randomIsing(new Rng(4), 3);
  const E = energies(model);
  const beta = 0.5;
  const kappa = 1.2;
  const exact = exactSignRatio(3, E, xBasisEnergies(3, driverOf(model, kappa)), xBasisEnergies(3, driverOf(model, -kappa)), 0.5, beta, 10);
  const cfg = sseConfigFrom(model, driverOf(model, kappa), 0.5, beta);
  const mc = runSignMeasurement(cfg, { warmup: 5000, measure: 100000, seed: 22 });
  assert.ok(
    Math.abs(mc.signAvg - exact) < 5 * mc.signErr,
    `MC ${mc.signAvg.toFixed(5)}±${mc.signErr.toExponential(2)} vs exact Z-ratio ${exact.toFixed(5)}`,
  );
  assert.ok(exact < 0.97, `expected non-trivial sign, exact=${exact}`);
});

test("sse: determinism — same seed gives identical measurement", () => {
  const model = randomIsing(new Rng(9), 6);
  const cfg = sseConfigFrom(model, driverOf(model, 0.5), 0.5, 2);
  const a = runSignMeasurement(cfg, { warmup: 200, measure: 3000, seed: 77 });
  const b = runSignMeasurement(cfg, { warmup: 200, measure: 3000, seed: 77 });
  assert.equal(a.signAvg, b.signAvg);
  assert.equal(a.meanOps, b.meanOps);
});

test("sse: parity ergodicity — the sampler visits both N_xx parity sectors", () => {
  const model = randomIsing(new Rng(15), 6);
  const cfg = sseConfigFrom(model, driverOf(model, 1), 0.5, 0.5);
  const sampler = new SseSampler(cfg, { seed: 33 });
  let oddVisits = 0;
  let evenVisits = 0;
  for (let i = 0; i < 5000; i++) {
    sampler.sweep();
    if (sampler.sign() === -1) oddVisits++;
    else evenVisits++;
  }
  assert.ok(sampler.consistent());
  assert.ok(oddVisits > 100, `odd sector starved: ${oddVisits}/5000`);
  assert.ok(evenVisits > 100);
});

test("referee: matrix-Trotter Z-ratio agrees with SSE enumeration at n=2 (no Trotter error vs no truncation)", () => {
  const model = randomIsing(new Rng(3), 2);
  const E = energies(model);
  const xPlus = xBasisEnergies(2, driverOf(model, 0.8));
  const xMinus = xBasisEnergies(2, driverOf(model, -0.8));
  const trotter = exactSignRatio(2, E, xPlus, xMinus, 0.5, 0.25, 10);
  const cfg = sseConfigFrom(model, driverOf(model, 0.8), 0.5, 0.25);
  const enumerated = exactSignAverage(cfg, 9).signAvg;
  assert.ok(Math.abs(trotter - enumerated) < 2e-3, `trotter ${trotter} vs enum ${enumerated}`);
});

test("sse: MC average sign matches matrix-Trotter exact ratio at n=6 (non-trivial sign)", () => {
  const model = randomIsing(new Rng(SEED_N6()), 6);
  const E = energies(model);
  const kappa = 1;
  const beta = 0.4;
  const xPlus = xBasisEnergies(6, driverOf(model, kappa));
  const xMinus = xBasisEnergies(6, driverOf(model, -kappa));
  const exact = exactSignRatio(6, E, xPlus, xMinus, 0.5, beta, 10);
  const cfg = sseConfigFrom(model, driverOf(model, kappa), 0.5, beta);
  const mc = runSignMeasurement(cfg, { warmup: 3000, measure: 80000, seed: 55 });
  assert.ok(
    Math.abs(mc.signAvg - exact) < 5 * mc.signErr,
    `MC ${mc.signAvg.toFixed(5)}±${mc.signErr.toExponential(2)} vs exact Z-ratio ${exact.toFixed(5)}`,
  );
  assert.ok(exact < 0.95, `expected non-trivial sign, exact=${exact}`);
});

function SEED_N6(): number {
  return 20260905 + 6;
}

test("sign identity: Delta E0 = E0(kappa) - E0(shadow) > 0 on frustrated random graphs", () => {
  // ⟨sign⟩ = Z(κ)/Z(−κ) ≈ e^{−β·ΔE0}：衰减要求非 stoq 驱动器基态能量高于影子
  const model = randomIsing(new Rng(20260905 + 8), 8);
  const E = energies(model);
  const xPlus = xBasisEnergies(8, driverOf(model, 1));
  const xMinus = xBasisEnergies(8, driverOf(model, -1));
  const p1 = projectGroundState(8, E, xPlus, 0.5);
  const p2 = projectGroundState(8, E, xMinus, 0.5);
  assert.ok(p1.converged && p2.converged);
  const delta = p1.energy - p2.energy;
  assert.ok(delta > 0, `expected frustration-driven Delta E0 > 0, got ${delta}`);
});
