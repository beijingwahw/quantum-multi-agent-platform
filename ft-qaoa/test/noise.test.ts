import { strict as assert } from "node:assert";
import { test } from "node:test";
import { Rng } from "../src/core/rng.js";
import { bruteForce, energies, randomIsing } from "../src/core/ising.js";
import { DensityMatrix } from "../src/core/density.js";
import { linearRamp } from "../src/qaoa/params.js";
import { qaoaExpectation } from "../src/qaoa/engine.js";
import {
  applyReadoutFlips,
  noiseBendReport,
  noisyDepthSeries,
  noisyExpectation,
  NOISELESS,
  verifyNoiseClaim,
} from "../src/qaoa/noise.js";
import type { DepthPoint } from "../src/qaoa/monotonic.js";

test("density: |+><+| depolarizing decays coherence by (1-4p/3), keeps the diagonal", () => {
  // The textbook single-qubit check: off-diagonal of |+><+| must decay by the
  // Pauli-depolarizing coherence factor (1-4p/3), diagonal untouched.
  const p = 0.3;
  const rho = DensityMatrix.plusState(1);
  rho.depolarizeQubit(0, p);
  assert.ok(Math.abs(rho.re[0]! - 0.5) < 1e-15);
  assert.ok(Math.abs(rho.re[3]! - 0.5) < 1e-15);
  assert.ok(Math.abs(rho.im[1]!) < 1e-15);
  assert.ok(Math.abs(rho.re[1]! - 0.5 * (1 - (4 * p) / 3)) < 1e-15, `coherence decay factor wrong: ${rho.re[1]}`);
});

test("density: full depolarization (p=3/4) maps any single-qubit state to I/2", () => {
  const rho = DensityMatrix.fromPureState(1, new Float64Array([1, 0]), new Float64Array(2));
  rho.depolarizeQubit(0, 0.75);
  for (const idx of [0, 3]) assert.ok(Math.abs(rho.re[idx]! - 0.5) < 1e-15);
  assert.ok(Math.abs(rho.re[1]!) < 1e-15);
  assert.ok(Math.abs(rho.re[2]!) < 1e-15);
});

test("density: depolarizeQubit matches an independent naive Pauli conjugation (n=2)", () => {
  const n = 2;
  const dim = 1 << n;
  const rng = new Rng(123);
  const psiRe = Array.from({ length: dim }, () => rng.range(-1, 1));
  const psiIm = Array.from({ length: dim }, () => rng.range(-1, 1));
  let norm = 0;
  for (let s = 0; s < dim; s++) norm += psiRe[s]! ** 2 + psiIm[s]! ** 2;
  const inv = 1 / Math.sqrt(norm);
  for (let s = 0; s < dim; s++) {
    psiRe[s] = psiRe[s]! * inv;
    psiIm[s] = psiIm[s]! * inv;
  }
  const re = new Float64Array(dim * dim);
  const im = new Float64Array(dim * dim);
  for (let s = 0; s < dim; s++) {
    for (let t = 0; t < dim; t++) {
      re[s * dim + t] = psiRe[s]! * psiRe[t]! + psiIm[s]! * psiIm[t]!;
      im[s * dim + t] = psiIm[s]! * psiRe[t]! - psiRe[s]! * psiIm[t]!;
    }
  }
  const engine = DensityMatrix.fromPureState(n, new Float64Array(psiRe), new Float64Array(psiIm));
  const j = 1;
  const p = 0.21;

  // Independent reference: (1-p)rho + (p/3)(X rho X + Y rho Y + Z rho Z)
  // with the single-qubit Paulis embedded on qubit j as full complex matrices.
  type Cx = { re: number[][]; im: number[][] };
  const bit = 1 << j;
  const pauli = (which: "X" | "Y" | "Z"): Cx => {
    const pr = Array.from({ length: dim }, () => new Array<number>(dim).fill(0));
    const pi = Array.from({ length: dim }, () => new Array<number>(dim).fill(0));
    for (let s = 0; s < dim; s++) {
      for (let t = 0; t < dim; t++) {
        const sb = (s >>> j) & 1;
        if (which === "Z") {
          if (s === t) pr[s]![t] = sb === 0 ? 1 : -1;
        } else if ((s ^ t) === bit) {
          if (which === "X") pr[s]![t] = 1;
          // Y = [[0,-i],[i,0]]: <0|Y|1> = -i, <1|Y|0> = +i
          else pi[s]![t] = sb === 0 ? -1 : 1;
        }
      }
    }
    return { re: pr, im: pi };
  };
  const mul = (a: Cx, b: Cx): Cx => {
    const outr = Array.from({ length: dim }, () => new Array<number>(dim).fill(0));
    const outi = Array.from({ length: dim }, () => new Array<number>(dim).fill(0));
    for (let s = 0; s < dim; s++) {
      for (let t = 0; t < dim; t++) {
        let sr = 0;
        let si = 0;
        for (let u = 0; u < dim; u++) {
          sr += a.re[s]![u]! * b.re[u]![t]! - a.im[s]![u]! * b.im[u]![t]!;
          si += a.re[s]![u]! * b.im[u]![t]! + a.im[s]![u]! * b.re[u]![t]!;
        }
        outr[s]![t] = sr;
        outi[s]![t] = si;
      }
    }
    return { re: outr, im: outi };
  };
  const rhoFlat: Cx = {
    re: Array.from({ length: dim }, (_, s) => Array.from({ length: dim }, (_, t) => re[s * dim + t]!)),
    im: Array.from({ length: dim }, (_, s) => Array.from({ length: dim }, (_, t) => im[s * dim + t]!)),
  };
  const conjBy = (which: "X" | "Y" | "Z"): Cx => {
    const P = pauli(which);
    return mul(mul(P, rhoFlat), P);
  };
  const channels = [conjBy("X"), conjBy("Y"), conjBy("Z")];

  engine.depolarizeQubit(j, p);
  let worst = 0;
  for (let s = 0; s < dim; s++) {
    for (let t = 0; t < dim; t++) {
      let vr = (1 - p) * rhoFlat.re[s]![t]!;
      let vi = (1 - p) * rhoFlat.im[s]![t]!;
      for (const ch of channels) {
        vr += (p / 3) * ch.re[s]![t]!;
        vi += (p / 3) * ch.im[s]![t]!;
      }
      worst = Math.max(worst, Math.abs(vr - engine.re[s * dim + t]!), Math.abs(vi - engine.im[s * dim + t]!));
    }
  }
  assert.ok(worst < 1e-15, `naive Pauli conjugation disagrees by ${worst}`);
});

test("density: noisy evolution keeps trace 1 and hermiticity to float noise", () => {
  const model = randomIsing(new Rng(31), 7);
  const E = energies(model);
  const params = linearRamp(16, 6);
  const energy = noisyExpectation(model, E, params, { depolarizingPerLayer: 3e-3, readoutFlip: 0.01 });
  assert.ok(Number.isFinite(energy));
  // Rebuild the final state to inspect invariants directly.
  const rho = DensityMatrix.plusState(model.n);
  for (let t = 0; t < params.gammas.length; t++) {
    rho.applyCostPhase(params.gammas[t]!, E);
    rho.applyMixer(params.betas[t]!);
    for (let j = 0; j < model.n; j++) rho.depolarizeQubit(j, 3e-3);
  }
  assert.ok(Math.abs(rho.trace() - 1) < 1e-12);
  assert.ok(rho.hermiticityDefect() < 1e-12);
});

test("noise: eps=0 reproduces the statevector engine exactly (parity, several depths)", () => {
  const model = randomIsing(new Rng(43), 8);
  const E = energies(model);
  for (const [p, T] of [[1, 3], [5, 7], [32, 12]] as const) {
    const params = linearRamp(p, T);
    const a = qaoaExpectation(model, E, params);
    const b = noisyExpectation(model, E, params, NOISELESS);
    assert.ok(Math.abs(a - b) < 1e-12, `parity gap at p=${p}: ${Math.abs(a - b)}`);
  }
});

test("noise: readout flips conserve probability; q=1/2 flattens to uniform", () => {
  const probs = new Float64Array([0.1, 0.2, 0.3, 0.4]);
  const flipped = applyReadoutFlips(probs, 2, 0.1);
  const sum = flipped.reduce((acc, x) => acc + x, 0);
  assert.ok(Math.abs(sum - 1) < 1e-12);
  // independent manual convolution over flip patterns for n=2, q=0.1
  const q = 0.1;
  const manual = new Float64Array(4);
  for (let s = 0; s < 4; s++) {
    let acc = 0;
    for (let mask = 0; mask < 4; mask++) {
      const flips = ((s ^ mask) & 1) + (((s ^ mask) >> 1) & 1);
      acc += probs[mask]! * q ** flips * (1 - q) ** (2 - flips);
    }
    manual[s] = acc;
  }
  for (let s = 0; s < 4; s++) assert.ok(Math.abs(flipped[s]! - manual[s]!) < 1e-15);
  const flat = applyReadoutFlips(probs, 2, 0.5);
  for (let s = 0; s < 4; s++) assert.ok(Math.abs(flat[s]! - 0.25) < 1e-15);
});

test("noise: monotonicity survives mild noise and bends under strong noise (fixed seed)", () => {
  const model = randomIsing(new Rng(51), 6);
  const E = energies(model);
  const optimum = bruteForce(E).optimum;
  const schedules = [
    { p: 2, params: linearRamp(2, 4) },
    { p: 8, params: linearRamp(8, 6) },
    { p: 16, params: linearRamp(16, 8) },
  ];
  const quiet = noisyDepthSeries(model, E, optimum, schedules, { depolarizingPerLayer: 1e-5, readoutFlip: 0 });
  assert.equal(quiet.length, 3);
  assert.equal(quiet[0]!.p, 2);
  // Mild noise: the ladder stays non-decreasing (r grows with depth).
  for (let i = 1; i < quiet.length; i++) {
    assert.ok(quiet[i]!.ratio >= quiet[i - 1]!.ratio - 1e-9, `quiet ladder must stay monotone at i=${i}`);
  }
  // Strong noise (5% per layer per qubit): the deeper schedule now LOSES to
  // the middle one — monotonicity breaks and the bend must be located.
  const loud = noisyDepthSeries(model, E, optimum, schedules, { depolarizingPerLayer: 0.05, readoutFlip: 0 });
  assert.ok(loud[2]!.ratio < loud[1]!.ratio, "eps=0.05 must bend the ladder: p=16 must underperform p=8");
  const bend = noiseBendReport(
    loud.map((pt) => ({ p: pt.p, best: pt.best, ratio: pt.ratio })),
    1e-9,
    0.05,
  );
  assert.equal(bend.monotonePrefixLen, 2);
  assert.equal(bend.firstDropAt, 16);
  assert.equal(bend.pStar, 8);
  assert.ok(Math.abs(bend.epsilonTimesPStar - 0.05 * 8) < 1e-15);
});

test("smuggling trial: forged monotonicity-under-noise series is named and rejected", () => {
  const measured: DepthPoint[] = [
    { p: 2, best: 1.0, ratio: 0.5 },
    { p: 4, best: 1.2, ratio: 0.6 },
    { p: 8, best: 1.1, ratio: 0.55 },
    { p: 16, best: 0.9, ratio: 0.45 },
  ];
  // The counterfeit: flatten the tail, claim monotone.
  const forged = measured.map((pt, i) => (i >= 2 ? { ...pt, best: measured[1]!.best, ratio: measured[1]!.ratio } : pt));
  const verdict = verifyNoiseClaim(
    { instanceId: "smuggle-1", noise: { depolarizingPerLayer: 0.05, readoutFlip: 0 }, claimedMonotone: true, claimedSeries: forged },
    measured,
    1e-9,
    1e-12,
  );
  assert.equal(verdict.accepted, false);
  const named = verdict.reasons.join(" | ");
  assert.ok(named.includes("smuggle-1"), "rejection must name the instance");
  assert.ok(named.includes("FORGED series at p=8"), `rejection must name the forged depth: ${named}`);
  assert.ok(named.includes("FALSE monotonicity claim"), `rejection must name the false claim: ${named}`);
  assert.ok(named.includes("drops at p=8"), `rejection must name where the data drops: ${named}`);
});

test("smuggling trial: true data with a false monotone label is rejected; honest claims pass", () => {
  const measured: DepthPoint[] = [
    { p: 2, best: 1.0, ratio: 0.5 },
    { p: 4, best: 1.2, ratio: 0.6 },
    { p: 8, best: 1.1, ratio: 0.55 },
  ];
  const liar = verifyNoiseClaim(
    { instanceId: "smuggle-2", noise: { depolarizingPerLayer: 0.05, readoutFlip: 0 }, claimedMonotone: true, claimedSeries: measured },
    measured,
    1e-9,
    1e-12,
  );
  assert.equal(liar.accepted, false);
  assert.ok(liar.reasons.join(" | ").includes("FALSE monotonicity claim — measured series drops at p=8"));
  const honest = verifyNoiseClaim(
    { instanceId: "smuggle-2", noise: { depolarizingPerLayer: 0.05, readoutFlip: 0 }, claimedMonotone: false, claimedSeries: measured },
    measured,
    1e-9,
    1e-12,
  );
  assert.equal(honest.accepted, true);
  assert.deepEqual(honest.reasons, []);
});
