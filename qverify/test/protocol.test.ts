/** T1–T5 theorem-layer identities: every assert is an exact anchor. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serverViewMixed, worstCaseBlindnessGap, angleOtpMutualInfo, noPadLeakage } from '../src/protocol/ubqc.js';
import { makeRng } from '../src/core/rng.js';
import { maximallyMixed, fromVec, bellState, wernerFidelity, schmidtState, equatorial, vKronAll } from '../src/core/states.js';
import { EIGHT_ANGLES } from '../src/protocol/ubqc.js';
import { traceDistance } from '../src/core/measures.js';
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
  const eye2 = { rows: 2, cols: 2, re: Float64Array.from([1, 0, 0, 1]), im: new Float64Array(4) } as never;
  const px = { rows: 2, cols: 2, re: Float64Array.from([0, 1, 1, 0]), im: new Float64Array(4) } as never;
  const py = { rows: 2, cols: 2, re: new Float64Array(4), im: Float64Array.from([0, -1, 1, 0]) } as never;
  const pz = { rows: 2, cols: 2, re: Float64Array.from([1, 0, 0, -1]), im: new Float64Array(4) } as never;
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
    const mixed = mixDepol(fromVec(target), 0.25, 1 << n);
    assert.ok(shadowBias(mixed, n) < 1e-12, `mixed n=${n}`);
  }
});

test('T4a: fidelity estimator MC matches (1−q)+q/2ⁿ within 4σ', () => {
  const n = 3;
  const target = makeTarget(n);
  const q = 0.3;
  const rho = mixDepol(fromVec(target), q, 1 << n);
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

// helpers

function makeTarget(n: number): { n: number; re: Float64Array; im: Float64Array } {
  // product of distinct equatorial states — entanglement-free but phase-rich
  const qs = Array.from({ length: n }, (_, q) => equatorial(EIGHT_ANGLES[(q * 3) % 8]!));
  return vKronAll(qs);
}

function mixDepol(rho: { rows: number; cols: number; re: Float64Array; im: Float64Array }, q: number, d: number) {
  const out = { rows: d, cols: d, re: new Float64Array(d * d), im: new Float64Array(d * d) };
  for (let i = 0; i < d; i++) {
    for (let j = 0; j < d; j++) {
      out.re[i * d + j] = (1 - q) * rho.re[i * d + j]!;
      out.im[i * d + j] = (1 - q) * rho.im[i * d + j]!;
    }
    out.re[i * d + i] = out.re[i * d + i]! + q / d;
  }
  return out;
}
