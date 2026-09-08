import test from 'node:test';
import assert from 'node:assert/strict';
import { type CMat, eigenvaluesHermitian, identity, kron, mat, matEq, mDagger, mMul, mScale, mAdd } from '../src/core/cmat.js';
import { applyKraus } from '../src/core/channels.js';
import { makeRng } from '../src/core/rng.js';
import { randomStateVec, vecToRho, PAULI_X, PAULI_Z } from '../src/core/states.js';
import { randomChannelStinespring, stinespringToKraus } from '../src/switch/chanlib.js';
import {
  cjMatrix,
  firstPartyProcess,
  measurePrepareKraus,
  processProbability,
} from '../src/process/cj.js';
import {
  CLASSICAL_CAP,
  OCB_QUANTUM_VALUE,
  WITNESS_GAP,
  aliceCJ,
  bobCJ,
  causalWitness,
  classicalCensus,
  gameWitnessFunctional,
  psuccOCBStrategies,
  psuccOCBThroughSwitch,
  verifyClassicalCensus,
} from '../src/process/gypi.js';
import {
  gameValueFunctional,
  judgeProcess,
  noisyOcbProcess,
  ocbProcess,
  verifyClassicalCapRecord,
  verifyWitnessCertificate,
  whiteNoiseProcess,
  witnessValue,
} from '../src/process/wocb.js';
import { judgeTermTypes } from '../src/process/termtype.js';

// ---------------------------------------------------------------------------
// CJ convention anchors (the convention the whole process layer stands on).
// ---------------------------------------------------------------------------

test('cjMatrix: identity channel gives SWAP (OCB convention), not |I⟩⟨I|', () => {
  const m = cjMatrix([identity(2)]);
  // SWAP: entry [(i,a),(i',a')] = δ_{i,a'} δ_{a,i'}
  const swap = mat(4, 4);
  swap.re[0 * 4 + 0] = 1; // (0,0),(0,0): i=0,a=0,i'=0,a'=0 → δ_{0,0}δ_{0,0}
  swap.re[1 * 4 + 2] = 1; // (0,1),(1,0)
  swap.re[2 * 4 + 1] = 1; // (1,0),(0,1)
  swap.re[3 * 4 + 3] = 1; // (1,1),(1,1)
  assert.ok(matEq(m, swap, 1e-14));
});

test('cjMatrix: complex measure-prepare gives exactly |ψ⟩⟨ψ| ⊗ |φ⟩⟨φ| (OCB Eq. 20)', () => {
  const rng = makeRng(20260908);
  for (let t = 0; t < 8; t++) {
    const psi = randomStateVec(rng, 2);
    const phi = randomStateVec(rng, 2);
    const m = cjMatrix(measurePrepareKraus(psi, phi));
    const want = kron(vecToRho(psi), vecToRho(phi));
    assert.ok(matEq(m, want, 1e-12), `trial ${t}`);
  }
});

test('cjMatrix: Hermitian for random complex Kraus sets; probabilities under W_OCB stay nonnegative', () => {
  // NOTE: in the OCB convention (transpose included) the CJ of a channel is
  // NOT PSD in general — the identity channel maps to SWAP, eigenvalues
  // {1,1,1,−1}. Positivity lives in the PROBABILITIES Tr[W(M⊗M)] ≥ 0, which
  // the process structure guarantees; that is what this anchor asserts.
  const rng = makeRng(777);
  for (let t = 0; t < 8; t++) {
    const m = cjMatrix(stinespringToKraus(randomChannelStinespring(rng, 2, 2)));
    assert.ok(matEq(m, mDagger(m), 1e-12), `Hermitian trial ${t}`);
    const p = processProbability(ocbProcess(), m, m);
    assert.ok(p >= -1e-12, `probability trial ${t}: ${p}`);
    assert.ok(p <= 1 + 1e-12, `probability trial ${t} upper bound: ${p}`);
  }
  // the identity channel's CJ is SWAP with the −1 eigenvalue — pinned
  const swap = cjMatrix([identity(2)]);
  const eig = eigenvaluesHermitian(swap);
  const sorted = Array.from(eig).sort((x, y) => x - y);
  assert.ok(Math.abs(sorted[0]! + 1) < 1e-12 && Math.abs(sorted[3]! - 1) < 1e-12);
  // ... and still yields probability exactly 1 against every valid process
  assert.ok(Math.abs(processProbability(ocbProcess(), swap, swap) - 1) < 1e-12);
});

test('firstPartyProcess: process probabilities equal direct circuit simulation (complex states, random channels)', () => {
  const rng = makeRng(4242);
  const traceOf = (m: CMat): number => m.re[0]! + m.re[3]!;
  for (let t = 0; t < 20; t++) {
    const psiA = randomStateVec(rng, 2);
    const phiA = randomStateVec(rng, 2);
    const psiB = randomStateVec(rng, 2);
    const phiB = randomStateVec(rng, 2);
    const rhoIn = vecToRho(randomStateVec(rng, 2));
    const chan = stinespringToKraus(randomChannelStinespring(rng, 2, 2));
    const kA = measurePrepareKraus(psiA, phiA)[0]!;
    const kB = measurePrepareKraus(psiB, phiB)[0]!;
    const pProcA = processProbability(firstPartyProcess('A', rhoIn, chan), cjMatrix([kA]), cjMatrix([kB]));
    const pProcB = processProbability(firstPartyProcess('B', rhoIn, chan), cjMatrix([kA]), cjMatrix([kB]));
    // A-first circuit: rho -> Alice(mp) -> chan -> Bob(mp)
    const pCircA = traceOf(mMul(mMul(kB, applyKraus(mMul(mMul(kA, rhoIn), mDagger(kA)), chan)), mDagger(kB)));
    const pCircB = traceOf(mMul(mMul(kA, applyKraus(mMul(mMul(kB, rhoIn), mDagger(kB)), chan)), mDagger(kA)));
    assert.ok(Math.abs(pProcA - pCircA) < 1e-12, `A-first trial ${t}: ${pProcA} vs ${pCircA}`);
    assert.ok(Math.abs(pProcB - pCircB) < 1e-12, `B-first trial ${t}: ${pProcB} vs ${pCircB}`);
  }
});

// ---------------------------------------------------------------------------
// W_OCB anchors — validity and violation.
// ---------------------------------------------------------------------------

test('W_OCB: PSD with eigenvalues exactly {0, ½}, trace 4, valid term types, normalized', () => {
  const w = ocbProcess();
  const verdict = judgeProcess(w, [stinespringToKraus(randomChannelStinespring(makeRng(1), 2, 2))]);
  assert.ok(verdict.hermitian);
  assert.ok(verdict.psd, `min eig ${verdict.eig.min}`);
  const eigs = verdict.eig.values;
  const zeros = eigs.filter((l) => Math.abs(l) < 1e-12).length;
  const halves = eigs.filter((l) => Math.abs(l - 0.5) < 1e-12).length;
  assert.strictEqual(zeros, 8);
  assert.strictEqual(halves, 8);
  let tr = 0;
  for (let i = 0; i < 16; i++) tr += w.re[i * 16 + i]!;
  assert.ok(Math.abs(tr - 4) < 1e-12, `trace ${tr}`);
  assert.ok(verdict.termJudge.valid);
  assert.ok(verdict.normalizationError < 1e-10);
  assert.ok(verdict.valid);
});

test('W_OCB term types are exactly {∅, A2B1, A1B1B2} — both causal directions present', () => {
  const tj = judgeTermTypes(ocbProcess(), 1e-10);
  const types = tj.terms.map((t) => t.type).sort();
  assert.deepStrictEqual(types, ['', 'A1B1B2', 'A2B1']);
  // A2B1 is A⋠B-direction; A1B1B2 is B⋠A-direction: neither order alone suffices
  const a2b1 = tj.terms.find((t) => t.type === 'A2B1')!;
  const b2Touch = tj.terms.find((t) => t.type === 'A1B1B2')!;
  assert.ok(Math.abs(a2b1.coefficient - 1 / (4 * Math.SQRT2)) < 1e-12);
  assert.ok(Math.abs(b2Touch.coefficient - 1 / (4 * Math.SQRT2)) < 1e-12);
});

test('W_OCB game value (2+√2)/4 by BOTH the linear functional and the Born-rule loop; witness −(√2−1)/4', () => {
  const w = ocbProcess();
  const gv1 = gameValueFunctional(w);
  const gv2 = psuccOCBStrategies(w);
  assert.ok(Math.abs(gv1 - OCB_QUANTUM_VALUE) < 1e-12);
  assert.ok(Math.abs(gv2 - OCB_QUANTUM_VALUE) < 1e-12);
  assert.ok(Math.abs(gv1 - gv2) < 1e-12);
  const wv = witnessValue(w);
  assert.ok(Math.abs(wv + WITNESS_GAP) < 1e-12);
  // linearity: functional value equals Σ (1/8) score P(x,y) recomputed from scratch
  let acc = 0;
  for (let a = 0; a < 2; a++) {
    for (let b = 0; b < 2; b++) {
      for (let bp = 0; bp < 2; bp++) {
        for (let x = 0; x < 2; x++) {
          for (let y = 0; y < 2; y++) {
            const score = bp === 0 ? (x === b ? 1 : 0) : (y === a ? 1 : 0);
            if (score === 0) continue;
            acc += (1 / 8) * processProbability(w, aliceCJ(x, a), bobCJ(y, b, bp));
          }
        }
      }
    }
  }
  assert.ok(Math.abs(acc - gv1) < 1e-12);
});

// ---------------------------------------------------------------------------
// Census anchors — the exhaustive classical cap.
// ---------------------------------------------------------------------------

test('classical census: 8192 vertices (4096 per order), cap exactly 3/4, ≥256 achievers', () => {
  const census = classicalCensus();
  assert.strictEqual(census.length, 8192);
  assert.strictEqual(census.filter((p) => p.order === 'B-first').length, 4096);
  assert.strictEqual(census.filter((p) => p.order === 'A-first').length, 4096);
  assert.ok(Math.abs(census[0]!.psucc - CLASSICAL_CAP) < 1e-12);
  const achievers = census.filter((p) => Math.abs(p.psucc - CLASSICAL_CAP) < 1e-12);
  assert.ok(achievers.length >= 256, `${achievers.length} achievers`);
  for (let k = 1; k < census.length; k++) {
    assert.ok(census[k - 1]!.psucc >= census[k]!.psucc - 1e-15, 'sorted descending');
  }
});

test('witness nonnegative on separable anchors: white noise +0.25, shared Bell ≥ 0, definite-order ≥ 0', () => {
  assert.ok(Math.abs(witnessValue(whiteNoiseProcess()) - 0.25) < 1e-12);
  const bell = mat(4, 4);
  bell.re[0] = 0.25; bell.re[3] = 0.25; bell.re[12] = 0.25; bell.re[15] = 0.25;
  const shared = kron(kron(bell, identity(2)), identity(2));
  assert.ok(witnessValue(shared) >= -1e-12);
  const rng = makeRng(31337);
  for (let t = 0; t < 20; t++) {
    const rhoIn = vecToRho(randomStateVec(rng, 2));
    const chan = stinespringToKraus(randomChannelStinespring(rng, 2, 2));
    for (const first of ['A', 'B'] as const) {
      assert.ok(witnessValue(firstPartyProcess(first, rhoIn, chan)) >= -1e-12, `${first} trial ${t}`);
    }
  }
});

test('isotropic family: valid for all ν; witness closes exactly at ν* = 1/√2', () => {
  for (const nu of [0, 0.3, 0.7, 1]) {
    assert.ok(judgeProcess(noisyOcbProcess(nu)).valid, `ν=${nu} must be a valid process`);
  }
  const wStar = witnessValue(noisyOcbProcess(1 / Math.SQRT2));
  assert.ok(Math.abs(wStar) < 1e-12, `witness at ν* = ${wStar}`);
  assert.ok(witnessValue(noisyOcbProcess(0.9)) < 0);
  assert.ok(witnessValue(noisyOcbProcess(0.5)) > 0);
});

test('the quantum switch plays the OCB game at exactly 5/8 — no causal inequality violation', () => {
  const p = psuccOCBThroughSwitch();
  assert.ok(Math.abs(p - 0.625) < 1e-12, `switch game value ${p}`);
  assert.ok(p < CLASSICAL_CAP, 'the isolated switch must not beat the classical causal cap');
});

// ---------------------------------------------------------------------------
// Smuggling trials — counterfeit numbers and structures are NAMED and REJECTED.
// ---------------------------------------------------------------------------

test('SMUGGLING TRIAL: inflated classical cap is named and rejected', () => {
  const truth = classicalCensus();
  // a counterfeit record claiming the quantum value as the CLASSICAL cap
  const counterfeit = {
    familySize: truth.length,
    maxPsucc: OCB_QUANTUM_VALUE,
    argmaxLabel: truth[0]!.label,
  };
  const v = verifyClassicalCensus(counterfeit);
  assert.equal(v.ok, false);
  assert.match(v.reason, /CLASSICAL-CENSUS-COUNTERFEIT/);
  assert.match(v.reason, /0\.853553/);
  assert.match(v.reason, /0\.750000/);
});

test('SMUGGLING TRIAL: truncated census family is named and rejected', () => {
  const truth = classicalCensus();
  const v = verifyClassicalCensus({ familySize: 4096, maxPsucc: truth[0]!.psucc, argmaxLabel: truth[0]!.label });
  assert.equal(v.ok, false);
  assert.match(v.reason, /CLASSICAL-CENSUS-COUNTERFEIT/);
  assert.match(v.reason, /4096 deterministic strategies, machine census has 8192/);
});

test('SMUGGLING TRIAL: witness certificate with a fabricated gap is named and rejected', () => {
  const w = ocbProcess();
  const truth = witnessValue(w);
  // certificate inflates the violation by 0.02
  const v = verifyWitnessCertificate({
    process: w,
    claimedWitnessValue: truth - 0.02,
    claimedGameValue: OCB_QUANTUM_VALUE + 0.02,
  });
  assert.equal(v.ok, false);
  assert.match(v.reason, /WITNESS-COUNTERFEIT/);
  assert.match(v.reason, /machine recomputes/);
});

test('SMUGGLING TRIAL: violation-claiming process with honest numbers but a FORBIDDEN term type is named and rejected', () => {
  // W_fake = W(0.9) + 0.05·σx^{A1}σx^{A2}: still PSD, still violates the witness
  // (so every claimed NUMBER is exactly recomputable and honest), but the
  // A1A2 term type is forbidden by OCB Fig. 3 — a process that cannot exist.
  // Only the structural judge can refuse this certificate.
  const badTerm = mScale(kron(kron(PAULI_X, PAULI_X), kron(identity(2), identity(2))), 0.05);
  const wFake = mAdd(noisyOcbProcess(0.9), badTerm);
  const wit = witnessValue(wFake);
  assert.ok(wit < -1e-12, `fake must claim a genuine recomputable violation, got ${wit}`);
  const v = verifyWitnessCertificate({
    process: wFake,
    claimedWitnessValue: wit, // honest number
    claimedGameValue: gameValueFunctional(wFake), // honest number
  });
  assert.equal(v.ok, false);
  assert.match(v.reason, /WITNESS-COUNTERFEIT/);
  assert.match(v.reason, /A1A2/);
  assert.match(v.reason, /forbidden/);
});

test('SMUGGLING TRIAL: non-PSD "super-OCB" process is named and rejected', () => {
  // amplify the corrections beyond PSD: W' = ¼[𝟙 + 2·(corrections)] has eigs ¼(1±2)
  const zz = kron(kron(identity(2), PAULI_Z), kron(PAULI_Z, identity(2)));
  const zxz = kron(kron(PAULI_Z, identity(2)), kron(PAULI_X, PAULI_Z));
  const corrections = mScale(mAdd(zz, zxz), 2 / Math.SQRT2);
  const wAmp = mScale(mAdd(identity(16), corrections), 1 / 4);
  const v = verifyWitnessCertificate({
    process: wAmp,
    claimedWitnessValue: witnessValue(wAmp),
    claimedGameValue: gameValueFunctional(wAmp),
  });
  assert.equal(v.ok, false);
  assert.match(v.reason, /WITNESS-COUNTERFEIT/);
  assert.match(v.reason, /not PSD/);
});

test('the honest certificates pass their own trials (guard against an over-strict judge)', () => {
  const w = ocbProcess();
  const v = verifyWitnessCertificate({
    process: w,
    claimedWitnessValue: witnessValue(w),
    claimedGameValue: gameValueFunctional(w),
  });
  assert.ok(v.ok, v.reason);
  const cap = verifyClassicalCapRecord({ familySize: 8192, maxPsucc: 0.75 });
  assert.ok(cap.ok, cap.reason);
  const census = verifyClassicalCensus({ familySize: 8192, maxPsucc: 0.75, argmaxLabel: classicalCensus()[0]!.label });
  assert.ok(census.ok, census.reason);
});

test('causalWitness S_game decomposition: S + S_game = (3/16)𝟙 exactly', () => {
  const s = causalWitness();
  const g = gameWitnessFunctional();
  const sum = mAdd(s, g);
  for (let k = 0; k < 256; k++) {
    const want = k % 17 === 0 ? 3 / 16 : 0;
    assert.ok(Math.abs(sum.re[k]! - want) < 1e-14);
  }
});
