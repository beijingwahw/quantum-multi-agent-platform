import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../src/core/rng.js';
import { fromVec, PLUS, KET0, KET1 } from '../src/core/states.js';
import { applyKraus, applyQubitChannel, amplitudeDampKraus, phaseFlipKraus } from '../src/core/channels.js';
import { traceDistance, fidelity } from '../src/core/measures.js';
import { identity } from '../src/core/cmat.js';
import {
  hjwUnderNoise,
  interceptSeparation,
  noisyLockedHolevo,
  noisyUnlockErrors,
  otpInvarianceDefect,
  verifyRobustnessClaim,
  type RobustnessClaim,
} from '../src/protocol/robustness.js';

const I2 = { rows: 2, cols: 2, re: Float64Array.of(0.5, 0, 0, 0.5), im: new Float64Array(4) };

test('phase-flip channel anchors: γ=½ fully dephases |+⟩, never touches Z populations', () => {
  const plus = fromVec(PLUS);
  const dephased = applyKraus(plus, phaseFlipKraus(0.5));
  assert.ok(traceDistance(dephased, I2) < 1e-12, 'full dephasing at γ=½ must yield I/2');
  const zero = applyKraus(fromVec(KET0), phaseFlipKraus(0.5));
  assert.ok(traceDistance(zero, fromVec(KET0)) < 1e-12, 'Z populations untouched');
  // γ = ¼ halves the coherence: ⟨+|ρ|+⟩ = 3/4 (fidelity kernel is exact to
  // ~1e-7 on mixed states — tolerance matches the kernel, not the math)
  const quarter = applyKraus(plus, phaseFlipKraus(0.25));
  assert.ok(Math.abs(fidelity(quarter, plus) - 0.75) < 1e-6);
});

test('amplitude-damping channel anchors: γ=1 maps |1⟩ to |0⟩, trace preserved', () => {
  const damped = applyKraus(fromVec(KET1), amplitudeDampKraus(1));
  assert.ok(traceDistance(damped, fromVec(KET0)) < 1e-12);
  const mixed = applyKraus(fromVec(PLUS), amplitudeDampKraus(0.5));
  let tr = 0;
  for (let i = 0; i < 2; i++) tr += mixed.re[i * 2 + i]!;
  assert.ok(Math.abs(tr - 1) < 1e-12);
});

test('applyQubitChannel: independent per-qubit dephasing of |+⟩|+⟩ gives I/4', () => {
  const plus2 = { n: 4, re: Float64Array.of(0.5, 0.5, 0.5, 0.5), im: new Float64Array(4) };
  const out = applyQubitChannel(fromVec(plus2), 2, phaseFlipKraus(0.5));
  const I4 = identity(4);
  for (let k = 0; k < 16; k++) {
    assert.ok(Math.abs(out.re[k]! - I4.re[k]! / 4) < 1e-12);
    assert.ok(Math.abs(out.im[k]!) < 1e-12);
  }
});

test('otp hiding is channel-invariant: identical ensemble states stay identical', () => {
  assert.ok(otpInvarianceDefect(2, 'dephase', 0.5) <= 1e-15);
  assert.ok(otpInvarianceDefect(2, 'ampdamp', 0.5) <= 1e-15);
  assert.ok(Math.abs(noisyLockedHolevo(2, 3, 'otp', 'dephase', 0.5)) < 1e-12);
  assert.ok(Math.abs(noisyLockedHolevo(2, 3, 'otp', 'ampdamp', 0.75)) < 1e-12);
});

test('wiesner residual hiding changes under noise: dephasing first helps the hider', () => {
  const noiseless = noisyLockedHolevo(2, 3, 'wiesner', 'dephase', 0);
  const half = noisyLockedHolevo(2, 3, 'wiesner', 'dephase', 0.5);
  // coherence-borne leak is REMOVED by full dephasing; only the Z-locked
  // payload fraction survives — an honest, counterintuitive census fact
  assert.ok(half < noiseless - 0.1, `${half} vs ${noiseless}`);
  assert.ok(half > 0.01);
  // amplitude damping kills both privacy and payload at the endpoint
  assert.ok(Math.abs(noisyLockedHolevo(2, 3, 'wiesner', 'ampdamp', 1)) < 1e-12);
});

test('HJW concealment survives dephasing exactly, breaks linearly under damping', () => {
  for (const g of [0, 0.25, 0.5]) {
    assert.ok(hjwUnderNoise('dephase', g).concealment <= 1e-12, `dephase γ=${g}`);
  }
  for (const g of [0.25, 0.5, 0.75]) {
    const r = hjwUnderNoise('ampdamp', g);
    assert.ok(Math.abs(r.concealment - g / 2) < 1e-12, `ampdamp T = γ/2 at γ=${g}, got ${r.concealment}`);
    assert.ok(r.steeringProbDev <= 1e-12, 'steering probabilities stay unbiased');
  }
  // reveal asymmetry: the X-encoded bit dies at rate γ under dephasing
  const r = hjwUnderNoise('dephase', 0.25);
  assert.ok(Math.abs(r.revealPass[0] - 1) < 1e-12);
  assert.ok(Math.abs(r.revealPass[1] - 0.75) < 1e-12);
});

test('interceptor detection: separation shrinks with noise but survives dephasing', () => {
  const rng = makeRng(808);
  const clean = interceptSeparation(800, 3, 3, 'dephase', 0, rng);
  const noisy = interceptSeparation(800, 3, 3, 'dephase', 0.4, rng);
  assert.ok(clean.separation > 0.25, `clean sep ${clean.separation}`);
  assert.ok(noisy.separation > 0.05, `noisy sep must stay positive under dephasing, got ${noisy.separation}`);
  assert.ok(noisy.separation < clean.separation);
});

test('noisy unlock MC is seeded-reproducible', () => {
  const a = makeRng(1234);
  const b = makeRng(1234);
  let ea = 0;
  let eb = 0;
  for (let t = 0; t < 200; t++) {
    ea += noisyUnlockErrors(2, 3, 'wiesner', 'ampdamp', 0.4, a, false);
    eb += noisyUnlockErrors(2, 3, 'wiesner', 'ampdamp', 0.4, b, false);
  }
  assert.equal(ea, eb);
  assert.ok(ea > 0, 'damping must corrupt the honest readout');
});

test('smuggling trial: fake robustness tables are rejected BY NAME', () => {
  // 1. honest row (value = the machine-measured χ under noise) passes
  const truth = noisyLockedHolevo(2, 3, 'otp', 'dephase', 0.25);
  const honestRow: RobustnessClaim = { metric: 'chiOtp', m: 2, noise: 'dephase', gamma: 0.25, value: truth };
  assert.equal(verifyRobustnessClaim(honestRow).ok, true);

  // 2. fabricated otp value ("the otp lock leaks 0.3 under dephasing")
  const fakeOtp: RobustnessClaim = { metric: 'chiOtp', m: 2, noise: 'dephase', gamma: 0.25, value: 0.3 };
  const r1 = verifyRobustnessClaim(fakeOtp);
  assert.ok(!r1.ok); // narrows the discriminated verdict for the named checks below
  assert.equal(r1.code, 'REF11-fabricated-value');
  assert.match(r1.detail ?? '', /chiOtp\/dephase\/γ=0\.25: claimed 0\.3, re-measured/);

  // 3. plausible-sounding lie: "wiesner χ unchanged by full dephasing"
  const noiselessWiesner = noisyLockedHolevo(2, 3, 'wiesner', 'dephase', 0);
  const fakeStable: RobustnessClaim = {
    metric: 'chiWiesner',
    m: 2,
    nBases: 3,
    noise: 'dephase',
    gamma: 0.5,
    value: noiselessWiesner,
  };
  const r2 = verifyRobustnessClaim(fakeStable);
  assert.ok(!r2.ok);
  assert.equal(r2.code, 'REF11-fabricated-value');

  // 4. out-of-range gamma on the same metric
  const fakeGamma: RobustnessClaim = { metric: 'chiOtp', m: 2, noise: 'dephase', gamma: 1.5, value: 0 };
  const r3 = verifyRobustnessClaim(fakeGamma);
  assert.ok(!r3.ok);
  assert.equal(r3.code, 'REF10-gamma-range');

  // 5. Monte-Carlo metric verifies at fixed seed (deterministic re-run over
  //    the referee's own 2000-trial protocol)
  const rngA = makeRng(777);
  let errors = 0;
  for (let t = 0; t < 2000; t++) errors += noisyUnlockErrors(1, 3, 'wiesner', 'dephase', 0.3, rngA, false);
  const mcRow: RobustnessClaim = { metric: 'unlockError', m: 1, nBases: 3, noise: 'dephase', gamma: 0.3, value: errors / 2000 };
  assert.equal(verifyRobustnessClaim(mcRow, 777).ok, true, 'same seed must re-measure the same MC value');
});
