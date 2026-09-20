import { strict as assert } from "node:assert";
import { test } from "node:test";
import { Rng } from "../src/core/rng.js";
import { energies, maxcut3Reg, randomIsing } from "../src/core/ising.js";
import type { IsingModel } from "../src/core/ising.js";
import { DensityMatrix } from "../src/core/density.js";
import { FtQaoaError } from "../src/core/errors.js";
import { linearRamp } from "../src/qaoa/params.js";
import { makeParams } from "../src/qaoa/engine.js";
import { qaoaExpectation } from "../src/qaoa/engine.js";
import type { QaoaParams } from "../src/qaoa/engine.js";
import { applyReadoutFlips, noisyExpectation } from "../src/qaoa/noise.js";
import {
  binomialMarginalExpectation,
  diagonalFilterExpectation,
  exchangeRegime,
  fastHadamard,
  noiseGrades,
  noisyObjectiveFromGrades,
  perGateNoisyExpectation,
  readoutFilterReport,
  shrinkExchangeReport,
  shrinkFactor,
  spectralObservedExpectation,
  terminalShrinkExpectation,
  verifyShrinkClaim,
  walshSpectrumDirect,
} from "../src/qaoa/shrink.js";

// ---------------------------------------------------------------------------
// F2 — readout Walsh-filter identity.
// ---------------------------------------------------------------------------

test("shrink: readout Walsh-filter identity holds against the flip-convolution engine (two independent algebras)", () => {
  const model = randomIsing(new Rng(51), 6);
  const E = energies(model);
  const params = linearRamp(6, 5);
  // Route 1: the shipped convolution channel on the ideal Born vector.
  // Route 2: the spectral pairing sum_S (1-2q)^{|S|} cHat(S) <chi_S>.
  const probs: Float64Array = (() => {
    const rho = DensityMatrix.plusState(model.n);
    for (let t = 0; t < params.gammas.length; t++) {
      rho.applyCostPhase(params.gammas[t]!, E);
      rho.applyMixer(params.betas[t]!);
    }
    return rho.probabilities();
  })();
  for (const q of [0, 0.01, 0.05, 0.1, 0.25, 0.5]) {
    const obs = applyReadoutFlips(probs, model.n, q);
    let eng = 0;
    for (let s = 0; s < obs.length; s++) eng += obs[s]! * E[s]!;
    const spec = spectralObservedExpectation(E, probs, q);
    assert.ok(Math.abs(eng - spec) < 1e-13, `Walsh filter identity gap at q=${q}: ${Math.abs(eng - spec)}`);
  }
});

test("shrink: fast Hadamard transform matches the direct-sum Walsh spectrum", () => {
  const model = randomIsing(new Rng(9), 5);
  const E = energies(model);
  const dim = 1 << model.n;
  const direct = walshSpectrumDirect(E, model.n);
  const f = E.slice();
  fastHadamard(f, model.n);
  for (let S = 0; S < dim; S++) {
    assert.ok(Math.abs(f[S]! / dim - direct[S]!) < 1e-12, `FHT vs direct-sum disagree at S=${S}`);
  }
});

test("shrink: grouped filter coefficients sum to the ideal value; 2-local costs have degree <= 2", () => {
  const model = randomIsing(new Rng(51), 6);
  const E = energies(model);
  const params = linearRamp(6, 5);
  const report = readoutFilterReport(model, E, params, [0.01, 0.05, 0.25]);
  const wsum = report.w.reduce((acc, x) => acc + x, 0);
  assert.ok(Math.abs(wsum - qaoaExpectation(model, E, params)) < 1e-12, "sum_k w_k must equal <C>_ideal");
  assert.ok(report.effectiveDegree <= 2, `2-local cost must filter with degree <= 2, got ${report.effectiveDegree}`);
  assert.ok(report.maxFilterGap < 1e-13, `filter pairing gap ${report.maxFilterGap}`);
});

test("shrink: 'readout only rescales' criterion holds on the seeded instances and implies monotone non-increasing <C>_obs", () => {
  const instances: IsingModel[] = [
    randomIsing(new Rng(51), 6),
    maxcut3Reg(new Rng(109), 8),
    maxcut3Reg(new Rng(2105), 10),
  ];
  for (const model of instances) {
    const E = energies(model);
    const params = linearRamp(8, 6);
    const report = readoutFilterReport(model, E, params, [0.01, 0.05, 0.2]);
    assert.ok(report.onlyRescales, `criterion w_k >= 0 must hold on the seeded instance (w = ${report.w.join(",")})`);
    // The criterion's conclusion, checked directly on the engine: <C>_obs(q)
    // non-increasing on q in [0, 1/2].
    const rho = DensityMatrix.plusState(model.n);
    for (let t = 0; t < params.gammas.length; t++) {
      rho.applyCostPhase(params.gammas[t]!, E);
      rho.applyMixer(params.betas[t]!);
    }
    const probs = rho.probabilities();
    let prev = Infinity;
    for (const q of [0, 0.05, 0.1, 0.2, 0.35, 0.5]) {
      const obs = applyReadoutFlips(probs, model.n, q);
      let value = 0;
      for (let s = 0; s < obs.length; s++) value += obs[s]! * E[s]!;
      assert.ok(value <= prev + 1e-12, `<C>_obs must be non-increasing in q (q=${q}: ${value} > ${prev})`);
      prev = value;
    }
  }
});

// ---------------------------------------------------------------------------
// F1 — the exchange identity: closed-form routes and the regime predicate.
// ---------------------------------------------------------------------------

test("shrink: route A (Pauli weights) equals route B (binomial marginals) in both regimes", () => {
  const interacting = randomIsing(new Rng(51), 6);
  const nonInteracting: IsingModel = { n: 6, fields: [0.3, -0.7, 0.5, 0.9, -0.2, 0.6], couplings: [] };
  for (const [model, params] of [
    [interacting, linearRamp(3, 6)],
    [interacting, linearRamp(2, 6)],
    [nonInteracting, linearRamp(8, 6)],
  ] as Array<[IsingModel, QaoaParams]>) {
    const E = energies(model);
    for (const eps of [1e-3, 1e-2, 0.05]) {
      const A = terminalShrinkExpectation(model, E, params, eps);
      const B = binomialMarginalExpectation(model, E, params, eps);
      assert.ok(Math.abs(A - B) < 1e-12, `route A/B split ${Math.abs(A - B)} (eps=${eps})`);
    }
  }
});

test("shrink: commuting regime (non-interacting cost) — the terminal-shrink identity is exact at every depth", () => {
  const model: IsingModel = { n: 6, fields: [0.3, -0.7, 0.5, 0.9, -0.2, 0.6], couplings: [] };
  const E = energies(model);
  assert.deepEqual(exchangeRegime(model, linearRamp(4, 6)), { commuting: true, reason: "non-interacting" });
  for (const depth of [2, 4, 8]) {
    const params = linearRamp(depth, 6);
    for (const eps of [1e-3, 1e-2, 0.05]) {
      const r = shrinkExchangeReport(model, E, params, eps);
      assert.ok(r.maxClosedFormGap < 1e-12, `closed-form gap ${r.maxClosedFormGap} (p=${depth}, eps=${eps})`);
      assert.ok(r.diagonalRouteGap < 1e-12, `diagonal-route gap ${r.diagonalRouteGap} (p=${depth}, eps=${eps})`);
    }
  }
});

test("shrink: commuting regime (trivial tail mixers) — ramp p=2 and explicit beta=(x,0,0) are exact through all routes", () => {
  const model = randomIsing(new Rng(51), 6);
  const E = energies(model);
  // The linear ramp's trailing beta is identically 0, so p=2 sits in the regime.
  assert.deepEqual(exchangeRegime(model, linearRamp(2, 6)), { commuting: true, reason: "trivial-tail-mixers" });
  const tailTrivial = makeParams([0.5, 1.0, 1.5], [1.5, 0, 0]);
  assert.deepEqual(exchangeRegime(model, tailTrivial), { commuting: true, reason: "trivial-tail-mixers" });
  for (const params of [linearRamp(2, 6), tailTrivial]) {
    for (const eps of [1e-3, 1e-2, 0.05]) {
      const r = shrinkExchangeReport(model, E, params, eps);
      assert.ok(r.maxClosedFormGap < 1e-12, `closed-form gap ${r.maxClosedFormGap} (eps=${eps})`);
      assert.ok(r.diagonalRouteGap < 1e-12, `diagonal-route gap ${r.diagonalRouteGap} (eps=${eps})`);
    }
  }
});

test("shrink: p=1 is always commuting — the identity is exact for interacting instances too", () => {
  const model = randomIsing(new Rng(51), 6);
  const E = energies(model);
  assert.deepEqual(exchangeRegime(model, linearRamp(1, 4)), { commuting: true, reason: "single-layer" });
  for (const eps of [1e-3, 1e-2, 0.05]) {
    const r = shrinkExchangeReport(model, E, linearRamp(1, 4), eps);
    assert.ok(r.maxClosedFormGap < 1e-12, `p=1 gap ${r.maxClosedFormGap}`);
    assert.ok(r.diagonalRouteGap < 1e-12, `p=1 diagonal-route gap ${r.diagonalRouteGap}`);
  }
});

test("shrink: interleaved regime — the identity FAILS, the failure is priced, and the polynomial law survives", () => {
  const model = randomIsing(new Rng(51), 6);
  const E = energies(model);
  // Random angles at p=2 (both mixers nontrivial) and the ramp at p=3.
  const r2 = new Rng(777);
  const randomAngles = makeParams(
    Array.from({ length: 2 }, () => r2.range(-0.8, 0.8)),
    Array.from({ length: 2 }, () => r2.range(-0.4, 0.4)),
  );
  const ramp3 = linearRamp(3, 6);
  for (const params of [randomAngles, ramp3]) {
    assert.equal(exchangeRegime(model, params).reason, "interleaved");
    let worstGap = 0;
    for (const eps of [3e-3, 1e-2]) {
      const r = shrinkExchangeReport(model, E, params, eps);
      worstGap = Math.max(worstGap, r.maxClosedFormGap);
      // The two closed-form algebras still agree with each other.
      assert.ok(r.closedFormSplit < 1e-12, "routes A/B must agree even where both are wrong");
    }
    assert.ok(worstGap > 1e-4, `interleaved-regime gap must be machine-significant, got ${worstGap}`);
  }
  // The polynomial law is exact where the identity is not.
  const grades = noiseGrades(model, E, randomAngles);
  assert.ok(grades.maxResidual < 1e-9, `grade interpolation residual ${grades.maxResidual}`);
});

// ---------------------------------------------------------------------------
// F1(b) — the grade decomposition (decidable retraining split).
// ---------------------------------------------------------------------------

test("shrink: noise grades — a^0 coefficient is mean(E) and angle-independent; sum of grades is the ideal value", () => {
  const model = randomIsing(new Rng(51), 6);
  const E = energies(model);
  const meanE = E.reduce((acc, x) => acc + x, 0) / E.length;
  const gradesA = noiseGrades(model, E, linearRamp(4, 6));
  const gradesB = noiseGrades(model, E, linearRamp(4, 9));
  assert.equal(gradesA.degree, 24);
  // The a^0 grade: at a=0 the state is maximally mixed after one layer and
  // stays there — angle-independent by structure, not by accident.
  assert.ok(Math.abs(gradesA.g0 - meanE) < 1e-9, `g0 ${gradesA.g0} vs mean(E) ${meanE}`);
  assert.ok(Math.abs(gradesB.g0 - meanE) < 1e-9, "g0 must not depend on the schedule");
  // sum_k g_k = value at a=1 = eps=0 = the ideal engine value.
  for (const g of [gradesA, gradesB]) {
    assert.ok(Math.abs(g.idealValue - g.idealEngineValue) < 1e-9, `grade sum ${g.idealValue} vs ideal engine ${g.idealEngineValue}`);
  }
  // Off-node eps values: one polynomial evaluation reproduces the engine.
  for (const eps of [0.007, 0.02, 0.6]) {
    const fromGrades = noisyObjectiveFromGrades(gradesA, eps);
    const engine = noisyExpectation(model, E, linearRamp(4, 6), { depolarizingPerLayer: eps, readoutFlip: 0 });
    assert.ok(Math.abs(fromGrades - engine) < 1e-8, `grade evaluation at eps=${eps}: ${Math.abs(fromGrades - engine)}`);
  }
});

// ---------------------------------------------------------------------------
// Negative control: the per-gate placement.
// ---------------------------------------------------------------------------

test("shrink: negative control — per-gate noise placement breaks the identity even where the layer placement is exact", () => {
  const model = randomIsing(new Rng(51), 6);
  const E = energies(model);
  // The ramp at p=2 is a commuting-regime schedule for the LAYER placement.
  const params = linearRamp(2, 6);
  for (const eps of [1e-2, 5e-2]) {
    const perGate = perGateNoisyExpectation(model, E, params, eps);
    const layer = noisyExpectation(model, E, params, { depolarizingPerLayer: eps, readoutFlip: 0 });
    const closed = terminalShrinkExpectation(model, E, params, eps);
    assert.ok(Math.abs(perGate - layer) > 1e-4, `per-gate vs layer gap must be significant at eps=${eps}`);
    assert.ok(Math.abs(perGate - closed) > 1e-4, `per-gate vs closed-form gap must be significant at eps=${eps}`);
    assert.ok(Math.abs(layer - closed) < 1e-12, "the layer placement itself stays exact here");
  }
});

// ---------------------------------------------------------------------------
// F1 x F2 compound: the whole noise face is algebraic in the commuting regime.
// ---------------------------------------------------------------------------

test("shrink: F1 x F2 compound — depolarizing and readout filters compose multiplicatively per Walsh mode", () => {
  const model = randomIsing(new Rng(51), 6);
  const E = energies(model);
  const params = linearRamp(2, 6); // trivial tail mixer: commuting regime
  for (const [eps, q] of [
    [0.01, 0.05],
    [3e-3, 0.2],
  ] as const) {
    const b = Math.pow(shrinkFactor(eps), 2);
    const lambdaTotal = b * (1 - 2 * q); // eigenvalue per degree-1 mode of the composed filter
    const qEff = (1 - lambdaTotal) / 2;
    // Compound closed form: one effective readout filter on the ideal Born vector.
    const rho = DensityMatrix.plusState(model.n);
    for (let t = 0; t < params.gammas.length; t++) {
      rho.applyCostPhase(params.gammas[t]!, E);
      rho.applyMixer(params.betas[t]!);
    }
    const obs = applyReadoutFlips(rho.probabilities(), model.n, qEff);
    let closed = 0;
    for (let s = 0; s < obs.length; s++) closed += obs[s]! * E[s]!;
    const engine = noisyExpectation(model, E, params, { depolarizingPerLayer: eps, readoutFlip: q });
    assert.ok(Math.abs(closed - engine) < 1e-12, `compound identity gap ${Math.abs(closed - engine)} (eps=${eps}, q=${q})`);
  }
});

test("shrink: F2 remains exact on top of an already-noisy (interleaved) circuit distribution", () => {
  const model = randomIsing(new Rng(51), 6);
  const E = energies(model);
  const params = linearRamp(4, 6); // interleaved regime — F1's identity does NOT hold
  const eps = 0.01;
  const rho = DensityMatrix.plusState(model.n);
  for (let t = 0; t < params.gammas.length; t++) {
    rho.applyCostPhase(params.gammas[t]!, E);
    rho.applyMixer(params.betas[t]!);
    for (let j = 0; j < model.n; j++) rho.depolarizeQubit(j, eps);
  }
  const noisyProbs = rho.probabilities();
  for (const q of [0.02, 0.1]) {
    const obs = applyReadoutFlips(noisyProbs, model.n, q);
    let eng = 0;
    for (let s = 0; s < obs.length; s++) eng += obs[s]! * E[s]!;
    const spec = spectralObservedExpectation(E, noisyProbs, q);
    assert.ok(Math.abs(eng - spec) < 1e-13, `F2 on noisy distribution gap ${Math.abs(eng - spec)}`);
  }
});

// ---------------------------------------------------------------------------
// Anti-smuggling gate.
// ---------------------------------------------------------------------------

test("smuggling trial: forged shrink gap is named and rejected", () => {
  const model = randomIsing(new Rng(51), 6);
  const E = energies(model);
  const params = linearRamp(4, 6); // interleaved; real gap is O(1e-2)
  const verdict = verifyShrinkClaim(
    { instanceId: "smuggle-shrink-1", eps: 1e-2, claimedTerminalIdentity: false, claimedMaxGap: 0 },
    model,
    E,
    params,
    1e-12,
  );
  assert.equal(verdict.accepted, false);
  const named = verdict.reasons.join(" | ");
  assert.ok(named.includes("smuggle-shrink-1"), "rejection must name the instance");
  assert.ok(named.includes("FORGED gap"), `rejection must name the forged gap: ${named}`);
});

test("smuggling trial: identity claim in the interleaved regime is convicted with the measured gap", () => {
  const model = randomIsing(new Rng(51), 6);
  const E = energies(model);
  const params = linearRamp(4, 6);
  const real = shrinkExchangeReport(model, E, params, 1e-2);
  const verdict = verifyShrinkClaim(
    { instanceId: "smuggle-shrink-2", eps: 1e-2, claimedTerminalIdentity: true, claimedMaxGap: real.maxClosedFormGap },
    model,
    E,
    params,
    1e-12,
  );
  assert.equal(verdict.accepted, false);
  const named = verdict.reasons.join(" | ");
  assert.ok(named.includes("MISCLAIMED identity"), `must name the misclaimed identity: ${named}`);
  assert.ok(named.includes("regime is interleaved"), `must name the regime: ${named}`);
});

test("smuggling trial: understating the theorem (denying the identity in its commuting regime) is named", () => {
  const model = randomIsing(new Rng(51), 6);
  const E = energies(model);
  const params = linearRamp(2, 6); // commuting (trivial tail mixer)
  const verdict = verifyShrinkClaim(
    { instanceId: "smuggle-shrink-3", eps: 1e-2, claimedTerminalIdentity: false, claimedMaxGap: 0 },
    model,
    E,
    params,
    1e-12,
  );
  assert.equal(verdict.accepted, false);
  assert.ok(verdict.reasons.join(" | ").includes("understates the theorem"));
});

test("smuggling trial: honest shrink claims pass with empty reasons", () => {
  const model = randomIsing(new Rng(51), 6);
  const E = energies(model);
  const interleaved = shrinkExchangeReport(model, E, linearRamp(4, 6), 1e-2);
  const honestInterleaved = verifyShrinkClaim(
    { instanceId: "honest-1", eps: 1e-2, claimedTerminalIdentity: false, claimedMaxGap: interleaved.maxClosedFormGap },
    model,
    E,
    linearRamp(4, 6),
    1e-12,
  );
  assert.equal(honestInterleaved.accepted, true);
  assert.deepEqual(honestInterleaved.reasons, []);
  const commuting = shrinkExchangeReport(model, E, linearRamp(2, 6), 1e-2);
  const honestCommuting = verifyShrinkClaim(
    { instanceId: "honest-2", eps: 1e-2, claimedTerminalIdentity: true, claimedMaxGap: commuting.maxClosedFormGap },
    model,
    E,
    linearRamp(2, 6),
    1e-12,
  );
  assert.equal(honestCommuting.accepted, true);
  assert.deepEqual(honestCommuting.reasons, []);
});

// ---------------------------------------------------------------------------
// Guards and degenerate inputs.
// ---------------------------------------------------------------------------

test("smuggling trial: shrink guards name eps domain, empty q grid, and grade budget by code", () => {
  const model = randomIsing(new Rng(51), 6);
  const E = energies(model);
  assert.throws(() => shrinkFactor(-0.1), (err: unknown) => err instanceof FtQaoaError && err.code === "SHRINK_EPS_INVALID");
  assert.throws(() => shrinkFactor(1.5), (err: unknown) => err instanceof FtQaoaError && err.code === "SHRINK_EPS_INVALID");
  assert.throws(
    () => terminalShrinkExpectation(model, E, linearRamp(2, 6), -1),
    (err: unknown) => err instanceof FtQaoaError && err.code === "SHRINK_EPS_INVALID",
  );
  assert.throws(
    () => readoutFilterReport(model, E, linearRamp(2, 6), []),
    (err: unknown) => err instanceof FtQaoaError && err.code === "SHRINK_Q_GRID_INVALID",
  );
  // Degree budget: n=30 x p=9 = 270 > cap 256 — refused BEFORE any engine run
  // (the energy table is a stub: the guard fires ahead of any evaluation).
  const big: IsingModel = { n: 30, fields: new Array<number>(30).fill(0.1), couplings: [] };
  assert.throws(
    () => noiseGrades(big, new Float64Array(1), linearRamp(9, 1)),
    (err: unknown) => err instanceof FtQaoaError && err.code === "SHRINK_GRADE_DEGREE_INVALID",
  );
});

test("shrink: eps=0 collapses every route onto the ideal expectation", () => {
  const model = randomIsing(new Rng(51), 6);
  const E = energies(model);
  const params = linearRamp(5, 6);
  const ideal = qaoaExpectation(model, E, params);
  const r = shrinkExchangeReport(model, E, params, 0);
  assert.ok(r.maxClosedFormGap < 1e-12, `eps=0 closed-form gap ${r.maxClosedFormGap}`);
  assert.ok(r.diagonalRouteGap < 1e-12, `eps=0 diagonal-route gap ${r.diagonalRouteGap}`);
  assert.ok(Math.abs(r.engineValue - ideal) < 1e-12, "engine at eps=0 is the ideal value");
  const D = diagonalFilterExpectation(model, E, params, 0);
  assert.ok(Math.abs(D - ideal) < 1e-12, "route C at eps=0 is the ideal value");
});
