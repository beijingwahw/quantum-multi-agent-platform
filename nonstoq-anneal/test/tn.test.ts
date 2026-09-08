import { strict as assert } from "node:assert";
import { test } from "node:test";
import { Rng } from "../src/core/rng.js";
import { energies, randomIsing } from "../src/core/ising.js";
import type { ZSpectrum } from "../src/core/spectra.js";
import { xBasisEnergies } from "../src/anneal/driver.js";
import { projectGroundState } from "../src/anneal/project.js";
import { mpsAmplitude, mpsFromDense } from "../src/tn/mps.js";
import { dmrgGroundState } from "../src/tn/dmrg.js";
import type { ChainHamiltonian } from "../src/tn/mpo.js";

/** 链实例 → ChainHamiltonian（s=0.5，Γ=1，κ 在链键上；与 anneal 家族同约定）。 */
function chainOf(model: ReturnType<typeof randomIsing>, kappa: number, s: number): ChainHamiltonian {
  // 过滤出近邻键（i, i+1）——MPO 只支持开链近邻
  const nn = model.couplings.filter((c) => Math.abs(c.k - c.j) === 1);
  const n = model.n;
  const alpha = model.fields.map((h) => -s * h);
  const beta = new Array<number>(n).fill(-(1 - s));
  const omega = new Array<number>(n - 1).fill(0);
  const kap = new Array<number>(n - 1).fill(0);
  for (const c of nn) {
    const i = Math.min(c.j, c.k);
    if (i < n - 1) {
      omega[i] = -s * c.w;
      kap[i] = (1 - s) * kappa;
    }
  }
  return { n, alpha, beta, omega, kappa: kap };
}

test("mps: SVD-encoded MPS reproduces dense amplitudes exactly (chi sufficient)", () => {
  const rng = new Rng(61);
  const n = 8;
  const dim = 1 << n;
  const vec = new Float64Array(dim);
  for (let i = 0; i < dim; i++) vec[i] = rng.range(-1, 1);
  const mps = mpsFromDense(vec, n, 64);
  for (const s of [0, 1, 127, 255, dim - 1]) {
    assert.ok(Math.abs(mpsAmplitude(mps, s) - vec[s]!) < 1e-10, `s=${s}`);
  }
});

test("dmrg referee: ground energy matches imaginary-time projection at n=8..12 (kappa=0)", () => {
  for (const n of [8, 10, 12]) {
    const model = randomIsing(new Rng(20260905 + n), n);
    const E = energiesNearest(model);
    const xE = xBasisEnergies(n, { gamma: 1, couplings: [] });
    const exact = projectGroundState(n, E, xE, 0.5, { dtau: 0.06, maxSteps: 4000, tolerance: 1e-11 });
    const dmrg = dmrgGroundState(chainOf(model, 0, 0.5), { chiMax: 48, sweeps: 6, seed: 71 });
    assert.ok(
      Math.abs(dmrg.energy - exact.energy) < 2e-3,
      `n=${n}: dmrg ${dmrg.energy} vs exact ${exact.energy}`,
    );
  }
});

test("dmrg referee: non-stoquastic kappa=0.5 ground energy matches projection at n=10", () => {
  const n = 10;
  const model = randomIsing(new Rng(20260905 + n), n);
  const E = energiesNearest(model);
  const driver = {
    gamma: 1,
    couplings: model.couplings
      .filter((c) => Math.abs(c.k - c.j) === 1)
      .map((c) => ({ j: c.j, k: c.k, w: 0.5 })),
  };
  const xE = xBasisEnergies(n, driver);
  const exact = projectGroundState(n, E, xE, 0.5, { dtau: 0.06, maxSteps: 4000, tolerance: 1e-11 });
  const dmrg = dmrgGroundState(chainOf(model, 0.5, 0.5), { chiMax: 48, sweeps: 6, seed: 73 });
  assert.ok(
    Math.abs(dmrg.energy - exact.energy) < 2e-3,
    `dmrg ${dmrg.energy} vs exact ${exact.energy}`,
  );
});

test("dmrg at scale: stoquastic Perron-Frobenius at n=20 (amplitudes single-signed, global sign free)", () => {
  const n = 20;
  const model = randomIsing(new Rng(20260905 + 20), n);
  const dmrg = dmrgGroundState(chainOf(model, 0, 0.5), { chiMax: 48, sweeps: 8, seed: 77 });
  const rng = new Rng(79);
  let pos = 0;
  let neg = 0;
  const tol = 1e-9;
  for (let k = 0; k < 500; k++) {
    let bits = 0;
    for (let i = 0; i < n; i++) if (rng.next() < 0.5) bits |= 1 << i;
    const amp = mpsAmplitude(dmrg.state, bits);
    if (amp > tol) pos++;
    else if (amp < -tol) neg++;
  }
  // PF：基态非负（或其全局负像）——采样振幅必须单符号
  assert.ok(pos === 0 || neg === 0, `mixed signs: ${pos} positive vs ${neg} negative`);
  assert.ok(pos + neg > 0);
});

test("dmrg at scale: kappa=0.5 develops negative amplitudes at n=20 (sign structure)", () => {
  const n = 20;
  const model = randomIsing(new Rng(20260905 + 20), n);
  const dmrg = dmrgGroundState(chainOf(model, 0.5, 0.5), { chiMax: 48, sweeps: 6, seed: 81 });
  const rng = new Rng(83);
  let negatives = 0;
  let samples = 0;
  for (let k = 0; k < 2000; k++) {
    let bits = 0;
    for (let i = 0; i < n; i++) if (rng.next() < 0.5) bits |= 1 << i;
    const amp = mpsAmplitude(dmrg.state, bits);
    samples++;
    if (amp < -1e-12) negatives++;
  }
  assert.ok(negatives > samples * 0.01, `expected >1% negative amplitudes, got ${negatives}/${samples}`);
});


function energiesNearest(model: ReturnType<typeof randomIsing>): ZSpectrum {
  // 链哈密顿量只用近邻键的能量表（与 MPO 一致）
  const nnModel = { n: model.n, fields: model.fields, couplings: model.couplings.filter((c) => Math.abs(c.k - c.j) === 1) };
  return energies(nnModel);
}
