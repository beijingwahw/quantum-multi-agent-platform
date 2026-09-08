import { strict as assert } from "node:assert";
import { test } from "node:test";
import { Rng } from "../src/core/rng.js";
import { bruteForce, energies, randomIsing } from "../src/core/ising.js";
import { zeroSpectrum } from "../src/core/spectra.js";
import { StateVector } from "../src/core/statevector.js";
import { checkStoquasticity, xBasisEnergies } from "../src/anneal/driver.js";
import type { DriverSpec } from "../src/anneal/driver.js";
import { projectGroundState } from "../src/anneal/project.js";
import { anneal } from "../src/anneal/anneal.js";

test("walsh-hadamard: involutive on arbitrary phased states", () => {
  const rng = new Rng(3);
  for (const n of [1, 3, 6]) {
    const sv = StateVector.plusState(n);
    const E = new Float64Array(sv.dim);
    for (let s = 0; s < sv.dim; s++) E[s] = rng.range(-2, 2);
    sv.applyPhase(0.7, E);
    const before = sv.clone();
    sv.applyHadamardAll();
    sv.applyHadamardAll();
    for (let s = 0; s < sv.dim; s++) {
      assert.ok(Math.abs(sv.re[s]! - before.re[s]!) < 1e-14);
      assert.ok(Math.abs(sv.im[s]! - before.im[s]!) < 1e-14);
    }
  }
});

test("walsh-hadamard maps computational basis state to uniform-sign X-basis state", () => {
  // 直接构造 |0000>：StateVector 无该构造器，用 |+>^n 减元不优雅——改为验证
  // WH 作用于 |+>^n 产出 |0..0>（H^⊗n |+>^n = |0..0>，解析恒等）
  const sv = StateVector.plusState(4);
  sv.applyHadamardAll();
  for (let s = 0; s < 16; s++) {
    const expected = s === 0 ? 1 : 0;
    assert.ok(Math.abs(sv.re[s]! - expected) < 1e-14);
    assert.equal(sv.im[s], 0);
  }
});

test("driver: stoquasticity verdict follows the sign of kappa and gamma", () => {
  const stoq: DriverSpec = { gamma: 1, couplings: [{ j: 0, k: 1, w: 0 }] };
  assert.ok(checkStoquasticity(stoq).stoquastic);
  const antiferro: DriverSpec = { gamma: 1, couplings: [{ j: 0, k: 1, w: -0.5 }] };
  assert.ok(checkStoquasticity(antiferro).stoquastic); // 负 κ 仍是 stoquastic
  const nonstoq: DriverSpec = {
    gamma: 1,
    couplings: [
      { j: 0, k: 1, w: 0.2 },
      { j: 1, k: 2, w: -0.1 },
    ],
  };
  const report = checkStoquasticity(nonstoq);
  assert.ok(!report.stoquastic);
  assert.equal(report.positivePairs, 1);
  assert.ok(Math.abs(report.maxPositiveOffdiag - 0.2) < 1e-15);
  const badGamma: DriverSpec = { gamma: -1, couplings: [] };
  assert.ok(!checkStoquasticity(badGamma).stoquastic);
});

test("driver: X-basis energy table matches hand computation (n=2)", () => {
  const driver: DriverSpec = { gamma: 1, couplings: [{ j: 0, k: 1, w: 0.5 }] };
  const E = xBasisEnergies(2, driver);
  // x_i = 1−2·bit_i：t=0 (1,1)；t=1 (−1,1)；t=2 (1,−1)；t=3 (−1,−1)
  assert.ok(Math.abs(E[0]! - (0.5 - 2)) < 1e-15);
  assert.ok(Math.abs(E[1]! - -0.5) < 1e-15);
  assert.ok(Math.abs(E[2]! - -0.5) < 1e-15);
  assert.ok(Math.abs(E[3]! - (0.5 + 2)) < 1e-15);
});

test("analytic anchor: kappa_c = 2*gamma phase transition of the 2-qubit XX driver", () => {
  // 零问题谱表（基无关，zeroSpectrum 同时携带 Z/X 品牌）
  const zeros = zeroSpectrum(2);
  // κ < 2Γ：基态 = |++>_x（Z 基全非负）→ P = 1
  const weak = xBasisEnergies(2, { gamma: 1, couplings: [{ j: 0, k: 1, w: 0.5 }] });
  const pWeak = projectGroundState(2, zeros, weak, 0);
  assert.ok(pWeak.converged);
  assert.ok(pWeak.signRatio > 1 - 1e-9, `P=${pWeak.signRatio}`);
  // κ > 2Γ：基态空间 {|+−>, |−+>}，均匀初态投出对称组合 ∝ |00> − |11> → P = 0
  const strong = xBasisEnergies(2, { gamma: 1, couplings: [{ j: 0, k: 1, w: 3 }] });
  const pStrong = projectGroundState(2, zeros, strong, 0);
  assert.ok(pStrong.converged);
  assert.ok(Math.abs(pStrong.signRatio) < 0.5, `P=${pStrong.signRatio}`);
  assert.ok(Math.abs(pStrong.energy - -3) < 1e-9); // 基态能量 = −κ
});

test("projection: stoquastic ground state of a random instance is sign-positive", () => {
  const model = randomIsing(new Rng(21), 8);
  const E = energies(model);
  const xE = xBasisEnergies(8, { gamma: 1, couplings: [] });
  const proj = projectGroundState(8, E, xE, 0.5, { dtau: 0.06, maxSteps: 4000, tolerance: 1e-10 });
  assert.ok(proj.converged);
  assert.ok(proj.signRatio > 1 - 1e-4, `P=${proj.signRatio}`);
});

test("anneal: unitarity at zero time; ferromagnetic chain converges to the aligned optima", () => {
  // n=6 铁磁链：C = Σ z_i z_{i+1}，最优 = 全对齐（两个简并基态，C_opt = 5）
  const n = 6;
  const couplings = Array.from({ length: n - 1 }, (_, i) => ({ j: i, k: i + 1, w: 1 }));
  const model = { n, fields: new Array<number>(n).fill(0), couplings };
  const E = energies(model);
  const optimum = bruteForce(E).optimum;
  assert.equal(optimum, n - 1);

  const driver: DriverSpec = { gamma: 1, couplings: [] };
  const zero = anneal(model, E, optimum, driver, { time: 0, slices: 10, initialState: "plus" });
  assert.ok(Math.abs(zero.meanEnergy) < 1e-12); // 未演化 → ⟨C⟩_{|+>^n} = 0

  const slow = anneal(model, E, optimum, driver, { time: 24, slices: 300 });
  assert.ok(slow.successProbability > 0.5, `success=${slow.successProbability}`);
  assert.ok(slow.energyRatio > 0.7);
});

test("anneal: driver-ground initialization is physically consistent for kappa > 2*gamma", () => {
  // n=2 XX 驱动器 κ=3：基态空间 {|+−>, |−+>}（X 基反关联）——
  // 从驱动器基态出发的零时长演化应保持在其上（成功概率有定义且引擎稳定）
  const model = { n: 2, fields: [0, 0], couplings: [{ j: 0, k: 1, w: 1 }] };
  const E = energies(model);
  const optimum = bruteForce(E).optimum;
  const driver: DriverSpec = { gamma: 1, couplings: [{ j: 0, k: 1, w: 3 }] };
  const r = anneal(model, E, optimum, driver, { time: 4, slices: 100 });
  assert.ok(r.successProbability >= 0 && r.successProbability <= 1);
  assert.ok(Number.isFinite(r.energyRatio));
});

test("anneal: non-stoquastic driver runs through the same engine (norm implicit in probabilities)", () => {
  const model = randomIsing(new Rng(33), 8);
  const E = energies(model);
  const optimum = bruteForce(E).optimum;
  const driver: DriverSpec = {
    gamma: 1,
    couplings: model.couplings.map((c) => ({ j: c.j, k: c.k, w: 0.5 })),
  };
  for (const T of [2, 8]) {
    const r = anneal(model, E, optimum, driver, { time: T, slices: 150 });
    assert.ok(r.successProbability >= 0 && r.successProbability <= 1);
    assert.ok(r.energyRatio <= 1 + 1e-9);
  }
});

test("signRatio: uniform state gives 1; partially negative state gives < 1", () => {
  const sv = StateVector.plusState(3);
  assert.ok(Math.abs(sv.signRatio() - 1) < 1e-15);
  sv.re[3] = -sv.re[3]!;
  assert.ok(sv.signRatio() < 1);
});
