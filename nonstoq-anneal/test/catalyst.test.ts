import { strict as assert } from "node:assert";
import { test } from "node:test";
import { Rng } from "../src/core/rng.js";
import { energies, randomIsing } from "../src/core/ising.js";
import { xBasisEnergies } from "../src/anneal/driver.js";
import type { DriverSpec } from "../src/anneal/driver.js";
import { antiferroRing } from "../src/anneal/instances.js";
import { applyHamiltonian, hadamardInPlace, jacobiEigenvalues, lowestSpectrum } from "../src/anneal/lanczos.js";
import { annealCatalystPath, magTable, pspinEnergies, xEnergiesAt, xxScaled } from "../src/anneal/catalyst.js";
import { StateVector as StateVector2 } from "../src/core/statevector.js";

function driverOf(model: ReturnType<typeof randomIsing>, kappa: number): DriverSpec {
  return { gamma: 1, couplings: model.couplings.map((c) => ({ j: c.j, k: c.k, w: kappa })) };
}

/** 构造稠密 H（n ≤ 4）作裁判：Z 对角 −sC；单翻转 −(1−s)Γ；双翻转 (1−s)κ。 */
function denseH(n: number, energies: Float64Array, driver: DriverSpec, s: number): number[][] {
  const dim = 1 << n;
  const H = Array.from({ length: dim }, () => new Array<number>(dim).fill(0));
  for (let z = 0; z < dim; z++) {
    H[z]![z] = -s * energies[z]!;
    for (let i = 0; i < n; i++) {
      H[z]![z ^ (1 << i)] = H[z]![z ^ (1 << i)]! + -(1 - s) * driver.gamma; // H_D 含 −Γσx
    }
    for (const c of driver.couplings) {
      H[z]![z ^ (1 << c.j) ^ (1 << c.k)] = H[z]![z ^ (1 << c.j) ^ (1 << c.k)]! + (1 - s) * c.w; // H_D 含 +κσxσx
    }
  }
  return H;
}

test("matvec referee: applyHamiltonian matches dense H application (n=3)", () => {
  const model = randomIsing(new Rng(41), 3);
  const E = energies(model);
  const driver = driverOf(model, 0.7);
  const xE = xBasisEnergies(3, driver);
  const rng = new Rng(43);
  const dim = 8;
  const v = new Float64Array(dim);
  for (let i = 0; i < dim; i++) v[i] = rng.range(-1, 1);
  for (const s of [0, 0.3, 0.7, 1]) {
    const out = new Float64Array(dim);
    applyHamiltonian(3, E, xE, s, v, out);
    const H = denseH(3, E, driver, s);
    for (let i = 0; i < dim; i++) {
      let expected = 0;
      for (let j = 0; j < dim; j++) expected += H[i]![j]! * v[j]!;
      assert.ok(Math.abs(out[i]! - expected) < 1e-12, `s=${s} row ${i}`);
    }
  }
});

test("spectrum referee: s=0 / s=1 limits vs dense Jacobi (multiplicity-correct)", () => {
  // Lanczos 单向量 Krylov 对简并本征空间只贡献一个方向（λ1 是流形外的
  // 第一能级——这恰是退火 gap 的正确语义），故 λ1 裁判用稠密 Jacobi。
  const model = randomIsing(new Rng(45), 3);
  const driver = driverOf(model, 0.8);
  const E = energies(model);
  const xE = xBasisEnergies(3, driver);
  for (const s of [0, 1]) {
    const exact = jacobiEigenvalues(denseH(3, E, driver, s));
    const result = lowestSpectrum(3, E, xE, s, { k: 8 });
    assert.ok(Math.abs(result.lambda0 - exact[0]!) < 1e-9, `s=${s} lambda0`);
    // λ1：Lanczos 报流形外第一能级 = 稠密谱中首个 > λ0+ε 的值
    const firstAbove = exact.find((e) => e > exact[0]! + 1e-9)!;
    assert.ok(Math.abs(result.lambda1 - firstAbove) < 1e-8, `s=${s} lambda1`);
  }
  // s=0 的解析对照：H_D 谱 = X 基本征值表
  const sortedX = Array.from(xE).sort((a, b) => a - b);
  const r0 = lowestSpectrum(3, E, xE, 0, { k: 8 });
  assert.ok(Math.abs(r0.lambda0 - sortedX[0]!) < 1e-9);
});

test("spectrum referee: full-space Lanczos (n=4, k=16=dim) matches dense Jacobi exactly", () => {
  const model = randomIsing(new Rng(49), 4);
  const E = energies(model);
  const driver = driverOf(model, 0.9);
  for (const s of [0.25, 0.5, 0.75]) {
    const exact = jacobiEigenvalues(denseH(4, E, driver, s));
    const result = lowestSpectrum(4, E, xBasisEnergies(4, driver), s, { k: 16 });
    assert.ok(Math.abs(result.lambda0 - exact[0]!) < 1e-9, `s=${s} lambda0`);
    assert.ok(Math.abs(result.lambda1 - exact[1]!) < 1e-9, `s=${s} lambda1`);
  }
});

test("jacobi referee: recovers known eigenvalues of a 3x3 diagonal-dominant matrix", () => {
  const A = [
    [2, 1, 0],
    [1, 2, 1],
    [0, 1, 2],
  ];
  const eigs = jacobiEigenvalues(A);
  // 解析：2, 2 ± √2
  assert.ok(Math.abs(eigs[0]! - (2 - Math.SQRT2)) < 1e-12);
  assert.ok(Math.abs(eigs[1]! - 2) < 1e-12);
  assert.ok(Math.abs(eigs[2]! - (2 + Math.SQRT2)) < 1e-12);
});

test("AF ring instances: even ring unfrustrated (2-fold ground degeneracy), odd ring 2n-fold", () => {
  for (const n of [4, 6, 8]) {
    const E = energies(antiferroRing(n));
    const optimum = Math.max(...E);
    const degeneracy = Array.from(E).filter((e) => e === optimum).length;
    assert.equal(degeneracy, 2, `even ring n=${n}`);
  }
  for (const n of [5, 7, 9]) {
    const E = energies(antiferroRing(n));
    const optimum = Math.max(...E);
    const degeneracy = Array.from(E).filter((e) => e === optimum).length;
    // 受挫键位置 n × 全局自旋翻转 2
    assert.equal(degeneracy, 2 * n, `odd ring n=${n}`);
  }
});

test("hadamardInPlace: involutive and norm-preserving", () => {
  const rng = new Rng(51);
  const v = new Float64Array(16);
  for (let i = 0; i < 16; i++) v[i] = rng.range(-1, 1);
  const before = v.slice();
  hadamardInPlace(v, 4);
  hadamardInPlace(v, 4);
  for (let i = 0; i < 16; i++) assert.ok(Math.abs(v[i]! - before[i]!) < 1e-14);
});

test("catalyst: p-spin tables and xEnergiesAt composition limits", () => {
  const n = 6;
  const E = pspinEnergies(n, 5);
  // p 奇 → 唯一最优全 +1（索引 0），值 n
  assert.equal(E[0], n);
  assert.equal(Array.from(E).filter((e) => e === n).length, 1);
  const mag = magTable(n);
  const xx = xxScaled(n);
  // N·m_x² 在 |+…+⟩_x（索引 0）处 = N
  assert.ok(Math.abs(xx[0]! - n) < 1e-12);
  // s=0：纯场 −Γ·mag；λ=1：无 XX
  const t0 = xEnergiesAt(mag, xx, 0, 0.1);
  for (let i = 0; i < t0.length; i++) assert.ok(Math.abs(t0[i]! + mag[i]!) < 1e-12);
  const t1 = xEnergiesAt(mag, xx, 0.7, 1);
  for (let i = 0; i < t1.length; i++) assert.ok(Math.abs(t1[i]! + 0.3 * mag[i]!) < 1e-12);
});

test("catalyst: lambda0=1 reduces exactly to the plain stoquastic anneal", () => {
  const n = 6;
  const E = pspinEnergies(n, 5);
  const mag = magTable(n);
  const xx = xxScaled(n);
  // 手工纯化学计量退火（同一离散化）
  const slices = 200;
  const time = 8;
  const dt = time / slices;
  const manual = StateVector2.plusState(n);
  for (let m = 1; m <= slices; m++) {
    const u = m / slices;
    const s = Math.min(1, u / 0.5); // 与路径引擎同一分段调度（λ0=1 → λ≡1）
    manual.applyPhase(-dt * s, E);
    manual.applyHadamardAll();
    const xE = new Float64Array(1 << n);
    for (let i = 0; i < xE.length; i++) xE[i] = -(1 - s) * mag[i]!;
    manual.applyPhase(dt, xE);
    manual.applyHadamardAll();
  }
  const viaPath = annealCatalystPath(n, E, mag, xx, { lambda0: 1, s1: 0.5, time, slices });
  assert.ok(Math.abs(viaPath - manual.probabilities()[0]!) < 1e-12);
  assert.ok(viaPath >= 0 && viaPath <= 1);
});
