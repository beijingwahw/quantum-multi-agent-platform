/** T1–T5 theorem-layer identities: every assert is an exact anchor. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serverViewMixed, worstCaseBlindnessGap, angleOtpMutualInfo, noPadLeakage } from '../src/protocol/ubqc.js';
import { makeRng } from '../src/core/rng.js';
import { maximallyMixed, fromVec, bellState, wernerFidelity, schmidtState, equatorial, vKronAll } from '../src/core/states.js';
import { EIGHT_ANGLES } from '../src/protocol/ubqc.js';
import { traceDistance } from '../src/core/measures.js';
import type { CMat } from '../src/core/cmat.js';
import {
  trapAcceptanceFormula,
  trapAcceptanceDirect,
  trapAcceptanceExpansion,
  idMass,
  rejectionLowerBound,
  xAttack,
  randomChannel,
  garbageBlindSpot,
} from '../src/protocol/traps.js';
import { horodeckiSMax, optimizeChsh, classicalGameWinRate, concurrence, pptMinEigenvalue, correlationT, chshGame } from '../src/protocol/chsh.js';
import { shadowBias, fidelityShadowMC } from '../src/protocol/shadows.js';
import { runMirrorExperiment, localDepolarize } from '../src/protocol/mirror.js';
import { xebSelfConsistency, xebOfDistribution, uniformDist, cutSpoofDist, tvDistance, depolarizedDist } from '../src/protocol/xeb.js';
import { randomCircuit, circuitProbs } from '../src/core/gates.js';
import {
  equatorialPairHelstrom,
  equatorialPairHelstromClosed,
  helstromTwo,
  helstromTwoOptimize,
  bb84LabelGame,
  bb84BitGame,
  projectorSumIdentity,
  commitRevealMC,
} from '../src/protocol/attacks.js';
import {
  shrinkAcceptanceCurve,
  shrinkIsometryError,
  shrinkDeferredGuess,
  shrinkTrapAcceptanceAveraged,
} from '../src/protocol/cloner.js';
import {
  BETA_STAR,
  V_STAR,
  BETA_QUANTUM,
  kaniewskiLowerBound,
  trivialUpperBound,
  isotropicBarrier,
  rigidityRegime,
  windowCensusRow,
  checkRigidityCertificate,
} from '../src/protocol/selftest.js';
import {
  hoeffdingN,
  cramerRate,
  xebWallRow,
  uniformFalseAcceptMC,
  shadowWallRow,
  checkSampleComplexityRow,
} from '../src/protocol/samplewall.js';
import { shadowFidelityExact } from '../src/protocol/shadows.js';
import {
  amplitudeDampingKraus,
  phaseDampingKraus,
  ampDampAcceptanceClosed,
  phaseDampAcceptanceClosed,
  noiseCensusRow,
  dampedGuessOptimized,
} from '../src/protocol/noise.js';
import { applyKraus, depolarize } from '../src/core/channels.js';

const rng = makeRng(0x7e57);

// ---------------- T1 ----------------

test('T1: server view is exactly maximally mixed for every secret (n=1..3)', () => {
  for (let n = 1; n <= 3; n++) {
    const thetas = Array.from({ length: n }, () => EIGHT_ANGLES[rng.int(8)]!); // rng.int(8) ∈ [0,8) on the 8-angle grid
    const view = serverViewMixed(thetas);
    assert.ok(traceDistance(view, maximallyMixed(1 << n)) < 1e-13, `n=${n}`);
  }
});

test('T1: worst-case blindness gap is machine zero (n=1 exhaustive, n=3 sampled)', () => {
  assert.ok(worstCaseBlindnessGap(1, 64, 1) < 1e-13);
  assert.ok(worstCaseBlindnessGap(3, 25, 0x77) < 1e-13);
});

test('T1: angle OTP — standard pads leak exactly 1 bit (quadrant), full-group pads leak 0', () => {
  const otp = angleOtpMutualInfo();
  assert.ok(Math.abs(otp.standard.mutualInfoBits - 1) < 1e-12);
  assert.ok(Math.abs(otp.standard.condEntropyBits - 2) < 1e-12);
  assert.ok(Math.abs(otp.fullGroup.mutualInfoBits) < 1e-12);
  assert.ok(Math.abs(otp.fullGroup.condEntropyBits - 3) < 1e-12);
});

test('T1 negative control: without pads the leakage is strictly positive', () => {
  const { maxTraceDistance, chiBits } = noPadLeakage(2);
  assert.ok(maxTraceDistance > 0.1);
  assert.ok(chiBits > 0.1);
});

// ---------------- T2 ----------------

test('T2: three-way acceptance agreement + bound holds on 40 random channels', () => {
  for (let i = 0; i < 40; i++) {
    const kraus = randomChannel(rng, 1 + rng.int(4));
    const f = trapAcceptanceFormula(kraus);
    assert.ok(Math.abs(f - trapAcceptanceDirect(kraus)) < 1e-11);
    assert.ok(Math.abs(f - trapAcceptanceExpansion(kraus)) < 1e-11);
    assert.ok(1 - f >= rejectionLowerBound(kraus) - 1e-12);
  }
});

test('T2: Pauli tier anchors — I:1, X:½, Y:½, Z:0', () => {
  // independent literals (NOT states.PAULI_*): the hand-written matrices
  // cross-examine the Pauli constructors the formula itself consumes
  const eye2: CMat = { rows: 2, cols: 2, re: Float64Array.from([1, 0, 0, 1]), im: new Float64Array(4) };
  const px: CMat = { rows: 2, cols: 2, re: Float64Array.from([0, 1, 1, 0]), im: new Float64Array(4) };
  const py: CMat = { rows: 2, cols: 2, re: new Float64Array(4), im: Float64Array.from([0, -1, 1, 0]) };
  const pz: CMat = { rows: 2, cols: 2, re: Float64Array.from([1, 0, 0, -1]), im: new Float64Array(4) };
  assert.ok(Math.abs(trapAcceptanceFormula([eye2]) - 1) < 1e-12);
  assert.ok(Math.abs(trapAcceptanceFormula([px]) - 0.5) < 1e-12);
  assert.ok(Math.abs(trapAcceptanceFormula([py]) - 0.5) < 1e-12);
  assert.ok(Math.abs(trapAcceptanceFormula([pz]) - 0) < 1e-12);
});

test('T2: X-attack acceptance is exactly 1 − q/2 (bound is tight)', () => {
  for (const q of [0.2, 0.5, 1.0]) {
    const kraus = xAttack(q);
    const acc = trapAcceptanceFormula(kraus);
    assert.ok(Math.abs(acc - (1 - q / 2)) < 1e-12);
    assert.ok(Math.abs(idMass(kraus) - (1 - q)) < 1e-12);
    assert.ok(Math.abs((1 - acc) - rejectionLowerBound(kraus)) < 1e-12);
  }
});

test('T2 blind spot: garbage-qubit attack leaves acceptance exactly 1', () => {
  const spot = garbageBlindSpot(rng);
  assert.ok(Math.abs(spot.trapAcceptance - 1) < 1e-12);
  assert.ok(spot.garbageFidelity < 0.99); // the garbage qubit really was disturbed
});

// ---------------- T3 ----------------

test('T3: Horodecki anchors — Bell 2√2, Werner 2√2·F, threshold F=1/√2 gives exactly 2', () => {
  assert.ok(Math.abs(horodeckiSMax(fromVec(bellState('phi+'))) - 2 * Math.SQRT2) < 1e-10);
  for (const f of [1.0, 0.9, 0.8]) {
    assert.ok(Math.abs(horodeckiSMax(wernerFidelity(f)) - 2 * Math.SQRT2 * f) < 1e-10);
  }
  assert.ok(Math.abs(horodeckiSMax(wernerFidelity(1 / Math.SQRT2)) - 2) < 1e-10);
});

test('T3: optimizer reproduces the formula (Bell + 10 random mixed)', () => {
  const gap = Math.abs(optimizeChsh(fromVec(bellState('psi-'))).s - 2 * Math.SQRT2);
  assert.ok(gap < 1e-6, `gap ${gap}`);
});

test('T3: pure-state law S_max = 2√(1+C²) over the Schmidt sweep', () => {
  for (let i = 0; i <= 8; i++) {
    const gamma = (i / 8) * (Math.PI / 4);
    const rho = fromVec(schmidtState(gamma));
    const s = horodeckiSMax(rho);
    const closed = 2 * Math.sqrt(1 + Math.sin(2 * gamma) ** 2);
    assert.ok(Math.abs(s - closed) < 1e-10);
    assert.ok(Math.abs(concurrence(rho) - Math.sin(2 * gamma)) < 1e-8);
  }
});

test('T3: game MC matches W = 1/2 + S/8 within 4σ (guards projector signs)', () => {
  const rho = fromVec(bellState('phi+'));
  const opt = optimizeChsh(rho, 0x99, 8);
  const game = chshGame(rho, opt.angles, 30000, rng);
  const wFromS = 0.5 + game.sFromAngles / 8;
  const sigma = Math.sqrt((wFromS * (1 - wFromS)) / 30000);
  assert.ok(Math.abs(game.winRate - wFromS) < 4 * sigma, `win=${game.winRate} formula=${wFromS}`);
});

test('T3: classical CHSH game optimum is exactly 3/4', () => {
  assert.ok(Math.abs(classicalGameWinRate() - 0.75) < 1e-12);
});

test('T3 honest boundary: Werner(0.65) is PPT-entangled but CHSH-local', () => {
  const w = wernerFidelity(0.65);
  assert.ok(pptMinEigenvalue(w) < -1e-6);
  assert.ok(horodeckiSMax(w) < 2);
});

test('T3: correlation matrix of |Φ+⟩ is diag(1,−1,1)', () => {
  const t = correlationT(fromVec(bellState('phi+')));
  assert.ok(Math.abs(t[0]![0]! - 1) < 1e-12 && Math.abs(t[1]![1]! + 1) < 1e-12 && Math.abs(t[2]![2]! - 1) < 1e-12);
  assert.ok(Math.abs(t[0]![1]!) < 1e-12 && Math.abs(t[0]![2]!) < 1e-12);
});

// ---------------- T4 ----------------

test('T4a: shadow unbiasedness by exact enumeration (n=2,3; pure + depolarized)', () => {
  for (const n of [2, 3]) {
    const target = makeTarget(n);
    assert.ok(shadowBias(fromVec(target), n) < 1e-12, `pure n=${n}`);
    const mixed = depolarize(fromVec(target), 0.25);
    assert.ok(shadowBias(mixed, n) < 1e-12, `mixed n=${n}`);
  }
});

test('T4a: fidelity estimator MC matches (1−q)+q/2ⁿ within 4σ', () => {
  const n = 3;
  const target = makeTarget(n);
  const q = 0.3;
  const rho = depolarize(fromVec(target), q);
  const mc = fidelityShadowMC(rho, target, n, 20000, rng);
  const closed = (1 - q) + q / (1 << n);
  assert.ok(Math.abs(mc.mean - closed) < 4 * mc.stdErr + 1e-4, `mean=${mc.mean} closed=${closed}`);
});

test('T4b: mirror return prob equals the closed form to machine precision', () => {
  for (const layers of [1, 3, 7]) {
    for (const lambda of [0.1, 0.3]) {
      const { simulated, closed } = runMirrorExperiment(3, layers, lambda, rng);
      assert.ok(Math.abs(simulated - closed) < 1e-13, `L=${layers} λ=${lambda}: ${simulated} vs ${closed}`);
    }
  }
});

test('T4b: localDepolarize at λ=0 is identity, λ=1 is fully mixed on that qubit', () => {
  const rho = fromVec(bellState('phi+'));
  assert.ok(traceDistance(localDepolarize(rho, 2, 1, 0), rho) < 1e-14);
  const mixed = localDepolarize(rho, 2, 1, 1);
  // qubit 1 fully mixed, qubit 0 remains pure (original was pure)
  const m0 = mixed.re[0]! + mixed.re[5]! + mixed.re[10]! + mixed.re[15]!; // trace
  assert.ok(Math.abs(m0 - 1) < 1e-12);
});

test('T4c: XEB facts at n=8 — uniform gives 0, self gives PT value, cut spoof positive', () => {
  const circuit = randomCircuit(rng, 8, 24);
  const probs = circuitProbs(circuit);
  const self = xebSelfConsistency(probs);
  assert.ok(self > 0.8 && self < 1.4, `self ${self}`);
  assert.ok(Math.abs(xebOfDistribution(uniformDist(probs.length), probs)) < 1e-12);
  const spoof = cutSpoofDist(probs, 4);
  const spoofXeb = xebOfDistribution(spoof, probs);
  assert.ok(spoofXeb > 0.01, `spoof XEB ${spoofXeb}`);
  assert.ok(tvDistance(spoof, probs) > 0.1);
});

test('T4c: depolarized XEB expectation is exactly λ·(2ⁿΣp²−1)', () => {
  const circuit = randomCircuit(rng, 6, 6);
  const probs = circuitProbs(circuit);
  const self = xebSelfConsistency(probs);
  for (const lambda of [0.4, 0.7]) {
    const q = depolarizedDist(probs, lambda);
    assert.ok(Math.abs(xebOfDistribution(q, probs) - lambda * self) < 1e-12);
  }
});

// ---------------- T5 ----------------

test('T5a: Helstrom pair game = (1+sin π/8)/2 via formula and optimizer', () => {
  const f = equatorialPairHelstrom();
  assert.ok(Math.abs(f - equatorialPairHelstromClosed()) < 1e-12);
  const o = helstromTwoOptimize(fromVec(equatorial(0)), fromVec(equatorial(Math.PI / 4)));
  assert.ok(Math.abs(o - f) < 1e-6, `optimizer ${o} vs ${f}`);
});

test('T5b: BB84 label game = exactly ½ (PGM = dual bound); bit game = (2+√2)/4', () => {
  const label = bb84LabelGame();
  assert.ok(Math.abs(label.pgmSuccess - 0.5) < 1e-12);
  assert.ok(Math.abs(label.dualUpperBound - 0.5) < 1e-12);
  const bit = bb84BitGame();
  assert.ok(Math.abs(bit.helstrom - (0.5 + Math.SQRT2 / 4)) < 1e-12);
  assert.ok(Math.abs(bit.helstrom - bit.closed) < 1e-12);
  assert.ok(Math.abs(bit.optimized - bit.helstrom) < 1e-6);
});

test('T5d: projector-sum identity (1/8)ΣΠ_θ^+ = I/2; MC wall at ½', () => {
  assert.ok(projectorSumIdentity().maxDeviation < 1e-13);
  const mc = commitRevealMC(8000, 0x31);
  assert.ok(Math.abs(mc.acceptance - 0.5) < 4 * mc.stdErr + 1e-3, `acc=${mc.acceptance}`);
});

test('T5c: shrink attack costs exactly 5/6 at every trap angle', () => {
  const curve = shrinkAcceptanceCurve();
  for (const p of curve) {
    assert.ok(Math.abs(p.acceptance - 5 / 6) < 1e-12, `θ=${p.theta}: ${p.acceptance}`);
  }
  assert.ok(Math.abs(shrinkTrapAcceptanceAveraged() - 5 / 6) < 1e-12);
});

test('T5c: Stinespring isometry of the optimal attack is exact', () => {
  assert.ok(shrinkIsometryError() < 1e-14);
});

test('T5c: deferred guess on the kept environment = (1+⅔sin π/8)/2 exactly', () => {
  const d = shrinkDeferredGuess();
  assert.ok(Math.abs(d.helstrom - 0.5 * (1 + (2 / 3) * Math.sin(Math.PI / 8))) < 1e-12, `${d.helstrom}`);
  assert.ok(Math.abs(d.baseline - (1 + Math.sin(Math.PI / 8)) / 2) < 1e-12);
});

// ---------------- v0.2: Werner-window rigidity census ----------------

test('T3+: Kaniewski threshold anchors — v* = (7+4√2)/17, 2√2·v* = β*, bound endpoints', () => {
  assert.ok(Math.abs(BETA_STAR - (16 + 14 * Math.SQRT2) / 17) < 1e-15);
  assert.ok(Math.abs(V_STAR - (7 + 4 * Math.SQRT2) / 17) < 1e-15);
  assert.ok(Math.abs(2 * Math.SQRT2 * V_STAR - BETA_STAR) < 1e-12); // visibility ↔ threshold identity
  assert.ok(BETA_STAR > 2 && BETA_STAR < BETA_QUANTUM); // the threshold sits strictly inside the violation range
  assert.ok(Math.abs(kaniewskiLowerBound(BETA_STAR) - 0.5) < 1e-12); // leaves the trivial floor exactly at β*
  assert.ok(Math.abs(kaniewskiLowerBound(2.05) - 0.5) < 1e-12); // below β*: clamped at the floor
  assert.ok(Math.abs(kaniewskiLowerBound(BETA_QUANTUM) - 1) < 1e-12); // tight at Tsirelson
  assert.ok(Math.abs(trivialUpperBound(2) - 1 / Math.SQRT2) < 1e-12);
  assert.ok(Math.abs(trivialUpperBound(BETA_QUANTUM) - 1) < 1e-12);
});

test('T3+: isotropic closed forms S = 2√2·v and F = (1+3v)/4 across the census grid', () => {
  for (const v of [0, 1 / 3, 0.5, 1 / Math.SQRT2, V_STAR, 0.85, 1]) {
    const row = windowCensusRow(v);
    assert.ok(Math.abs(row.beta - 2 * Math.SQRT2 * v) < 1e-12, `S at v=${v}`);
    assert.ok(Math.abs(row.fidelityNumeric - (1 + 3 * v) / 4) < 1e-12, `F at v=${v}`);
    assert.ok(Math.abs(row.fidelityClosed - row.fidelityNumeric) < 1e-12);
  }
  assert.ok(Math.abs(isotropicBarrier(2) - (1 + 3 / Math.SQRT2) / 4) < 1e-12);
});

test('T3+: regime boundaries at the exact critical points', () => {
  assert.equal(rigidityRegime(1 / 3), 'separable');
  assert.equal(rigidityRegime(0.34), 'window: entangled, CHSH-local');
  assert.equal(rigidityRegime(1 / Math.SQRT2), 'window: entangled, CHSH-local');
  assert.equal(rigidityRegime(0.73), 'violation, proven bound trivial (rigidity gap)');
  assert.equal(rigidityRegime(V_STAR), 'violation, proven bound trivial (rigidity gap)');
  assert.equal(rigidityRegime(0.75), 'certified: extractability bound > 1/2');
  // anchors: the separability boundary sits exactly on the trivial fidelity floor
  const sep = windowCensusRow(1 / 3);
  assert.ok(Math.abs(sep.pptMin) < 1e-12 && Math.abs(sep.fidelityClosed - 0.5) < 1e-12);
  // inside the window: entangled (PPT < 0) yet CHSH-local
  const inWindow = windowCensusRow(0.34);
  assert.ok(inWindow.pptMin < -1e-3 && inWindow.beta < 2);
  // inside the gap: violation but the floor is still the bound
  const gap = windowCensusRow(0.73);
  assert.ok(gap.beta > 2 && Math.abs(gap.lowerBound - 0.5) < 1e-12);
  // certified: bound strictly above the floor
  const cert = windowCensusRow(0.75);
  assert.ok(cert.beta > BETA_STAR && cert.lowerBound > 0.5 + 1e-6);
});

test('T3+: bound-shape inequalities — lower ≤ barrier and lower ≤ honest fidelity on [v*, 1]', () => {
  for (let i = 0; i <= 100; i++) {
    const beta = 2 + (i / 100) * (BETA_QUANTUM - 2);
    assert.ok(
      kaniewskiLowerBound(beta) <= trivialUpperBound(beta) + 1e-12,
      `lower above barrier at beta=${beta}`,
    );
  }
  for (let i = 0; i <= 100; i++) {
    const v = V_STAR + (i / 100) * (1 - V_STAR);
    const row = windowCensusRow(v);
    assert.ok(row.lowerBound <= row.fidelityClosed + 1e-12, `bound above device fidelity at v=${v}`);
  }
});

test('T3+ smuggling trial: counterfeit rigidity certificates are named and rejected', () => {
  // (a) a certificate from broken noise claiming a violation the state cannot produce
  const fake1 = checkRigidityCertificate({ visibility: 0.65, claimedBeta: 2.3, claimedFidelity: 0.8, claimsCertified: true });
  assert.equal(fake1.ok, false);
  assert.equal(fake1.name, 'claimed-beta-not-reproduced'); // actual S at v=0.65 is 1.838 < 2
  // (b) a fidelity claim above the isotropic barrier
  const fake2 = checkRigidityCertificate({
    visibility: 0.75,
    claimedBeta: 2 * Math.SQRT2 * 0.75,
    claimedFidelity: 0.82,
    claimsCertified: false,
  });
  assert.equal(fake2.ok, false);
  assert.equal(fake2.name, 'fidelity-above-isotropic-barrier'); // (1+3·0.75)/4 = 0.8125 is the cap
  // (c) certified fidelity beyond what the proven bound guarantees
  const fake3 = checkRigidityCertificate({
    visibility: 0.85,
    claimedBeta: 2 * Math.SQRT2 * 0.85,
    claimedFidelity: 0.8875,
    claimsCertified: true,
  });
  assert.equal(fake3.ok, false);
  assert.equal(fake3.name, 'claimed-fidelity-exceeds-proven-bound'); // proven bound ≈ 0.706
  // and the honest certificate passes
  const honest = checkRigidityCertificate({
    visibility: 0.85,
    claimedBeta: 2 * Math.SQRT2 * 0.85,
    claimedFidelity: kaniewskiLowerBound(2 * Math.SQRT2 * 0.85),
    claimsCertified: true,
  });
  assert.equal(honest.ok, true);
  assert.equal(honest.name, 'clean');
});

// ---------------- v0.2: sample-complexity census ----------------

test('T4+: hoeffdingN exact arithmetic and 1/τ² scaling', () => {
  assert.equal(hoeffdingN(2, 0.01, 0.5), Math.ceil((4 * Math.log(100)) / 0.5)); // = 37
  const atTau = hoeffdingN(3, 0.01, 0.2);
  const atHalfTau = hoeffdingN(3, 0.01, 0.1);
  // quadratic in the margin up to the ±1 slop of the two ceilings
  assert.ok(atHalfTau >= 4 * atTau - 4 && atHalfTau <= 4 * atTau);
});

test('T4+: cramerRate matches the binary relative entropy on a fair coin', () => {
  // I(0.75) for X ∈ {0,1} fair = d(0.75‖0.5) = 0.75ln1.5 + 0.25ln0.5
  const expected = 0.75 * Math.log(1.5) + 0.25 * Math.log(0.5);
  assert.ok(Math.abs(cramerRate([0, 1], [0.5, 0.5], 0.75) - expected) < 1e-9);
});

test('T4+: Chernoff count never exceeds Hoeffding on the (λ, δ) wall grid', () => {
  const circuit = randomCircuit(rng, 8, 24);
  const probs = circuitProbs(circuit);
  for (const lambdaTarget of [0.25, 0.5, 1.0]) {
    for (const delta of [0.05, 0.01, 0.001]) {
      const row = xebWallRow(probs, lambdaTarget, delta);
      assert.ok(row.rate > 0, 'rate must be positive');
      assert.ok(row.nChernoff <= row.nHoeffding, `λ=${lambdaTarget} δ=${delta}`);
    }
  }
  // the wall: noisier target (smaller λ₀) needs more samples, monotonically
  const n025 = xebWallRow(probs, 0.25, 0.01).nChernoff;
  const n10 = xebWallRow(probs, 1.0, 0.01).nChernoff;
  assert.ok(n025 > 5 * n10, `quadratic blowup in 1/λ₀: ${n025} vs ${n10}`);
});

test('T4+: uniform device false-accepts at ≤ δ when given the exact Chernoff count (MC)', () => {
  const circuit = randomCircuit(rng, 8, 24);
  const probs = circuitProbs(circuit);
  const row = xebWallRow(probs, 0.5, 0.01);
  const mc = uniformFalseAcceptMC(probs, row.threshold, row.nChernoff, 1500, rng);
  const slack = 3 * Math.sqrt((0.01 * 0.99) / 1500);
  assert.ok(mc.rate <= 0.01 + slack, `false-accept ${mc.rate} > δ+3σ at N=${row.nChernoff}`);
});

test('T4+: shadow exact moments — mean = closed form, batch std = σ/√N', () => {
  const n = 3;
  const target = makeTarget(n);
  const q = 0.3;
  const rho = depolarize(fromVec(target), q);
  const exact = shadowFidelityExact(rho, target, n);
  const closed = (1 - q) + q / (1 << n);
  assert.ok(Math.abs(exact.mean - closed) < 1e-12);
  assert.ok(exact.variance > 0.1 && exact.max > exact.min);
  const wall = shadowWallRow(exact, 0.05, 0.05);
  assert.equal(wall.nChebyshev, Math.ceil(exact.variance / (0.05 * 0.0025)));
  assert.ok(wall.nChebyshev < wall.nHoeffding * 2); // same order: exact range vs variance
  // empirical batch-mean std matches the exact σ/√N the count consumes
  const batches = 60;
  const shots = 800;
  const means: number[] = [];
  for (let t = 0; t < batches; t++) means.push(fidelityShadowMC(rho, target, n, shots, rng).mean);
  const mAvg = means.reduce((a, b) => a + b, 0) / batches;
  const mVar = means.reduce((a, b) => a + (b - mAvg) ** 2, 0) / (batches - 1);
  const empirical = Math.sqrt(mVar);
  const predicted = Math.sqrt(exact.variance / shots);
  assert.ok(Math.abs(empirical - predicted) < 0.15 * predicted, `std ${empirical} vs ${predicted}`);
});

test('T4+ smuggling trial: fake sample-complexity rows are named and rejected', () => {
  const circuit = randomCircuit(rng, 8, 24);
  const probs = circuitProbs(circuit);
  // (a) too-cheap row at moderate noise
  const fake1 = checkSampleComplexityRow(probs, { lambdaTarget: 0.5, delta: 0.01, claimedN: 50 });
  assert.equal(fake1.ok, false);
  assert.equal(fake1.name, 'below-exact-chernoff-requirement'); // exact requirement is ≈152
  // (b) too-cheap row at low noise and high confidence
  const fake2 = checkSampleComplexityRow(probs, { lambdaTarget: 0.1, delta: 0.001, claimedN: 100 });
  assert.equal(fake2.ok, false);
  assert.equal(fake2.name, 'below-exact-chernoff-requirement'); // exact requirement is ≈5000
  // (c) padded row — a bound a thousand times looser than Hoeffding is not a bound for this circuit
  const fake3 = checkSampleComplexityRow(probs, { lambdaTarget: 0.5, delta: 0.01, claimedN: 10 ** 9 });
  assert.equal(fake3.ok, false);
  assert.equal(fake3.name, 'padded-beyond-hoeffding-slop');
  // and the exact count itself passes
  const honest = checkSampleComplexityRow(probs, {
    lambdaTarget: 0.5,
    delta: 0.01,
    claimedN: xebWallRow(probs, 0.5, 0.01).nChernoff,
  });
  assert.equal(honest.ok, true);
  assert.equal(honest.name, 'clean');
});

// ---------------- v0.2: noise census (second noise model) ----------------

test('T5+: amplitude damping acceptance = (1+√(1−γ))²/4 + γ/4 against all three T2 referees', () => {
  assert.ok(Math.abs(ampDampAcceptanceClosed(0) - 1) < 1e-12); // identity at γ=0
  assert.ok(Math.abs(ampDampAcceptanceClosed(1) - 0.5) < 1e-12); // half a full decay is undetectable
  for (let k = 0; k <= 8; k++) {
    const gamma = k / 8;
    const ad = amplitudeDampingKraus(gamma);
    const closed = ampDampAcceptanceClosed(gamma);
    assert.ok(Math.abs(trapAcceptanceFormula(ad) - closed) < 1e-12, `formula γ=${gamma}`);
  }
  const row = noiseCensusRow(0.5);
  assert.ok(Math.abs(row.ampDampDirect - ampDampAcceptanceClosed(0.5)) < 1e-12);
  assert.ok(Math.abs(row.ampDampExpansion - ampDampAcceptanceClosed(0.5)) < 1e-12);
});

test('T5+: phase damping sits in the Z-tier — acceptance exactly 1−γ, guess game is the V-form', () => {
  for (let k = 0; k <= 8; k++) {
    const gamma = k / 8;
    const pd = phaseDampingKraus(gamma);
    assert.ok(Math.abs(trapAcceptanceFormula(pd) - (1 - gamma)) < 1e-12, `accept γ=${gamma}`);
    assert.ok(Math.abs(phaseDampAcceptanceClosed(gamma) - (1 - gamma)) < 1e-15);
    const row = noiseCensusRow(gamma);
    assert.ok(Math.abs(row.phaseDampDirect - (1 - gamma)) < 1e-12);
    const vForm = (1 + Math.abs(1 - 2 * gamma) * Math.sin(Math.PI / 8)) / 2;
    assert.ok(Math.abs(row.guessAfterPhaseDamp - vForm) < 1e-12, `guess γ=${gamma}`);
  }
  // the decoupling anchor: at γ=1 the trap rejects everything, the attacker loses nothing
  const full = noiseCensusRow(1);
  assert.ok(Math.abs(full.phaseDampDirect) < 1e-12);
  assert.ok(Math.abs(full.guessAfterPhaseDamp - (1 + Math.sin(Math.PI / 8)) / 2) < 1e-12);
  const mid = noiseCensusRow(0.5);
  assert.ok(Math.abs(mid.guessAfterPhaseDamp - 0.5) < 1e-12); // incoherent midpoint kills both
});

test('T5+: damped Helstrom endpoints exact and the POVM optimizer agrees at γ=0.5', () => {
  const none = noiseCensusRow(0).guessAfterAmpDamp;
  assert.ok(Math.abs(none - (1 + Math.sin(Math.PI / 8)) / 2) < 1e-12);
  const full = noiseCensusRow(1).guessAfterAmpDamp;
  assert.ok(Math.abs(full - 0.5) < 1e-12); // both states decay to |0⟩
  const damped0 = applyKraus(fromVec(equatorial(0)), amplitudeDampingKraus(0.5));
  const damped1 = applyKraus(fromVec(equatorial(Math.PI / 4)), amplitudeDampingKraus(0.5));
  assert.ok(Math.abs(dampedGuessOptimized(0.5) - helstromTwo(damped0, damped1)) < 1e-5);
});

// helpers

function makeTarget(n: number): { n: number; re: Float64Array; im: Float64Array } {
  // product of distinct equatorial states — entanglement-free but phase-rich
  const qs = Array.from({ length: n }, (_, q) => equatorial(EIGHT_ANGLES[(q * 3) % 8]!));
  return vKronAll(qs);
}
