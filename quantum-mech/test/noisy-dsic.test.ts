import test from "node:test";
import assert from "node:assert/strict";
import { makeRng } from "../src/core/rng.js";
import { fromVec, randomPureState, HADAMARD } from "../src/core/states.js";
import { applyKraus } from "../src/core/channels.js";
import {
  eigHermitian,
  identity,
  mat,
  matEq,
  mAdd,
  mDagger,
  mMul,
  mScale,
} from "../src/core/cmat.js";
import { quantumBestGain } from "../src/mech/dsic.js";
import {
  effectOperators,
  noiseBreakCensus,
  noisyChannelKraus,
  noisyUtilityObservablePath,
  noisyUtilityPhysicalPath,
  reportUtilities,
  requireCptp,
  spectralDsicCriterion,
  utilityObservable,
  verifyNoiseBreakClaim,
  type NoisyChannelName,
} from "../src/protocol/noisy-dsic.js";

const GAMMAS = [0, 0.1, 0.25, 0.5, 0.75, 0.9];
const FAMILIES: NoisyChannelName[] = [
  "phaseFlip",
  "ampDamp",
  "depol",
  "resetDamp",
  "parityFlip",
  "rotation",
];
const kOf = (name: NoisyChannelName): number =>
  name === "phaseFlip" || name === "ampDamp" || name === "rotation" ? 2 : 4;
/** families whose effects A_r are diagonal — the no-coherence-advantage side */
const DIAGONAL: NoisyChannelName[] = [
  "phaseFlip",
  "ampDamp",
  "depol",
  "resetDamp",
  "parityFlip",
];

test("T1N-a: A_r forms a POVM (completeness defect <= 1e-15) for every family and gamma", () => {
  for (const name of FAMILIES) {
    const k = kOf(name);
    for (const gamma of GAMMAS) {
      const { effects, completenessDefect } = effectOperators(
        noisyChannelKraus(name, gamma, k),
        k,
      );
      assert.ok(
        completenessDefect <= 1e-15,
        `${name}/gamma=${gamma}: defect ${completenessDefect.toExponential(2)}`,
      );
      for (const a of effects) {
        // each effect is PSD: Hermitian with nonnegative diagonal
        for (let i = 0; i < k; i++)
          assert.ok(
            a.re[i * k + i]! >= -1e-15,
            `${name}: negative effect diagonal`,
          );
      }
    }
  }
});

test("T1N-a: dual-path identity Tr[B sigma] = readout(N(sigma)) to 1e-14 on random states", () => {
  const rng = makeRng(20260920);
  for (const name of FAMILIES) {
    const k = kOf(name);
    for (const gamma of [0.25, 0.6]) {
      const kraus = noisyChannelKraus(name, gamma, k);
      const u = reportUtilities("second", 1.4, [1], 0, k);
      const b = utilityObservable(u, kraus, k);
      let worst = 0;
      for (let t = 0; t < 200; t++) {
        const sigma = fromVec(randomPureState(k, rng));
        worst = Math.max(
          worst,
          Math.abs(
            noisyUtilityObservablePath(sigma, b) -
              noisyUtilityPhysicalPath(sigma, kraus, u),
          ),
        );
      }
      assert.ok(
        worst <= 1e-14,
        `${name}/gamma=${gamma}: dual-path worst ${worst.toExponential(2)}`,
      );
    }
  }
});

test("T1N-b: the top eigenvector ACHIEVES lambda_max exactly; random states never exceed it", () => {
  const rng = makeRng(0x5eed1234);
  for (const name of FAMILIES) {
    const k = kOf(name);
    const kraus = noisyChannelKraus(name, 0.7, k);
    const u = reportUtilities("second", 1.4, [1], 0, k);
    const b = utilityObservable(u, kraus, k);
    const { values, vectors } = eigHermitian(b);
    const lambdaMax = Math.max(...Array.from(values));
    const top = vectors[values.indexOf(Math.max(...Array.from(values)))]!;
    const rhoTop = mat(k, k);
    for (let i = 0; i < k; i++) {
      for (let j = 0; j < k; j++) {
        rhoTop.re[i * k + j] =
          top.re[i]! * top.re[j]! + top.im[i]! * top.im[j]!;
        rhoTop.im[i * k + j] =
          top.im[i]! * top.re[j]! - top.re[i]! * top.im[j]!;
      }
    }
    const achieved = noisyUtilityObservablePath(rhoTop, b);
    assert.ok(
      Math.abs(achieved - lambdaMax) <= 1e-14,
      `${name}: eigvec achieves ${achieved} vs lambda ${lambdaMax}`,
    );
    for (let t = 0; t < 200; t++) {
      const sigma = fromVec(randomPureState(k, rng));
      const val = noisyUtilityObservablePath(sigma, b);
      assert.ok(
        val <= lambdaMax + 1e-12,
        `${name}: random sigma at ${val} exceeded lambda_max ${lambdaMax}`,
      );
    }
  }
});

test("T1N-c: lambda_max(B) <= max_r u(r) on the whole census grid (noise cannot manufacture utility)", () => {
  const rows = noiseBreakCensus(GAMMAS);
  for (const row of rows) {
    const k = kOf(row.channel);
    const u = reportUtilities(row.kind, row.trueValue, row.others, 0, k);
    assert.ok(
      row.lambdaMax <= Math.max(...u) + 1e-12,
      `${row.channel}/gamma=${row.gamma}: lambda_max ${row.lambdaMax} exceeded max utility ${Math.max(...u)}`,
    );
  }
});

test("T1N-d: identity slice — B diagonal, lambda_max = max u, criterion gain 0 = quantumBestGain gain 0", () => {
  const k = 4;
  const u = reportUtilities("second", 1.4, [1], 0, k);
  const b = utilityObservable(u, [identity(k)], k);
  let offDiag = 0;
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      if (i !== j)
        offDiag = Math.max(
          offDiag,
          Math.abs(b.re[i * k + j]!),
          Math.abs(b.im[i * k + j]!),
        );
    }
  }
  const { values } = eigHermitian(b);
  const lambdaMax = Math.max(...Array.from(values));
  assert.ok(
    offDiag <= 1e-15,
    `identity channel must keep B diagonal, off-diag ${offDiag}`,
  );
  assert.ok(Math.abs(lambdaMax - Math.max(...u)) <= 1e-12);
  const c = spectralDsicCriterion("second", 1.4, [1], 0, k, [identity(k)]);
  assert.ok(
    Math.abs(c.gain) <= 1e-12,
    `DSIC instance must show gain 0 at the identity slice, got ${c.gain}`,
  );
  const q = quantumBestGain("second", 1.4, [1], 0, k, makeRng(11), 200);
  assert.ok(
    Math.abs(q.bestGain) <= 1e-12,
    `quantumBestGain agrees: ${q.bestGain}`,
  );
  // gamma = 0 rows of every family reproduce the same zero-gain slice
  for (const name of FAMILIES) {
    const kk = kOf(name);
    const row = spectralDsicCriterion(
      "second",
      1.4,
      [1],
      0,
      kk,
      noisyChannelKraus(name, 0, kk),
    );
    assert.ok(
      Math.abs(row.gain) <= 1e-12,
      `${name} at gamma=0 must recover the classical picture`,
    );
    assert.ok(
      Math.abs(row.coherenceAdvantage) <= 1e-12,
      `${name} at gamma=0 has no coherence advantage`,
    );
  }
});

test("collapse lemma: diagonal-effect families have lambda_max = max noisy codeword utility (B itself diagonal)", () => {
  for (const name of DIAGONAL) {
    const k = kOf(name);
    for (const gamma of GAMMAS) {
      const kraus = noisyChannelKraus(name, gamma, k);
      const u = reportUtilities("second", 1.4, [1], 0, k);
      const b = utilityObservable(u, kraus, k);
      let offDiag = 0;
      for (let i = 0; i < k; i++) {
        for (let j = 0; j < k; j++) {
          if (i !== j) offDiag = Math.max(offDiag, Math.abs(b.re[i * k + j]!));
        }
      }
      assert.ok(
        offDiag <= 1e-15,
        `${name}/gamma=${gamma}: B should be diagonal, off-diag ${offDiag}`,
      );
      const c = spectralDsicCriterion("second", 1.4, [1], 0, k, kraus);
      const bestCw = Math.max(...c.codewordUtilities);
      assert.ok(
        Math.abs(c.lambdaMax - bestCw) <= 1e-12,
        `${name}/gamma=${gamma}: lambda_max ${c.lambdaMax} vs best codeword ${bestCw}`,
      );
    }
  }
});

test("T1N-e: the rotation channel breaks DSIC by pre-compensation with the closed form gain", () => {
  // canonical instance: second price, v = 1.4, other = 1, k = 2:
  // u = [0, 0.4]; under rotation theta = gamma*pi/2 the gain is
  // 0.4*sin^2(theta/2) — the agent submits U^dagger|1> and the noise itself
  // rotates the report onto the winning codeword
  for (const gamma of [0.1, 0.3, 0.5, 0.8]) {
    const kraus = noisyChannelKraus("rotation", gamma, 2);
    const c = spectralDsicCriterion("second", 1.4, [1], 0, 2, kraus);
    const expected = 0.4 * Math.sin((gamma * Math.PI) / 4) ** 2;
    assert.ok(
      Math.abs(c.gain - expected) <= 1e-12,
      `gamma=${gamma}: gain ${c.gain.toFixed(12)} vs closed form ${expected.toFixed(12)}`,
    );
    assert.ok(
      c.coherenceAdvantage > 1e-12,
      "the rotation break IS noise-created",
    );
    assert.ok(!c.dsic, "the criterion convicts the broken mechanism");
    // the witness achieves the eigenvalue through the physical channel
    const u = reportUtilities("second", 1.4, [1], 0, 2);
    const witnessed = noisyUtilityPhysicalPath(c.bestDeviation, kraus, u);
    assert.ok(
      Math.abs(witnessed - c.lambdaMax) <= 1e-12,
      `witness U = ${witnessed} vs lambda_max ${c.lambdaMax}`,
    );
    // and the witness is exactly the pre-rotation U^dagger|1> (here real):
    // <u|rho|u> = 1 with u = second column of U^dagger, flat indices [1, 3]
    const ud = mDagger(kraus[0]!);
    const u0 = ud.re[1]!;
    const u1 = ud.re[3]!;
    const rho = c.bestDeviation;
    const overlap =
      u0 * u0 * rho.re[0]! +
      u1 * u1 * rho.re[3]! +
      u0 * u1 * (rho.re[1]! + rho.re[2]!);
    assert.ok(
      Math.abs(overlap - 1) <= 1e-12,
      `pre-compensation overlap ${overlap}`,
    );
  }
});

test("T1N-e: the Hadamard channel is the gamma = 1 rotation (identical spectra)", () => {
  const u = reportUtilities("second", 1.4, [1], 0, 2);
  const bh = utilityObservable(u, [HADAMARD], 2);
  const br = utilityObservable(u, noisyChannelKraus("rotation", 1, 2), 2);
  const lh = Math.max(...Array.from(eigHermitian(bh).values));
  const lr = Math.max(...Array.from(eigHermitian(br).values));
  assert.ok(
    Math.abs(lh - lr) <= 1e-12,
    `H lambda ${lh} vs rotation lambda ${lr}`,
  );
});

test("T1N-e census: noise-created breaks exist ONLY in the rotation family; grid artifacts stay classical", () => {
  const rows = noiseBreakCensus(GAMMAS);
  assert.ok(rows.length > 100, `census covered ${rows.length} rows`);
  const created = rows.filter((r) => r.noiseCreated);
  assert.ok(created.length > 0, "the census must exhibit the rotation break");
  for (const row of created) {
    assert.equal(
      row.channel,
      "rotation",
      `noise-created break outside rotation: ${JSON.stringify(row)}`,
    );
    assert.ok(row.gamma > 0, "gamma=0 rows cannot be noise-created");
  }
  // every non-rotation family: coherence advantage exactly 0 (<= 1e-12) at
  // every gamma, on every instance including the classically broken ones
  for (const row of rows.filter((r) => r.channel !== "rotation")) {
    assert.ok(
      row.coherenceAdvantage <= 1e-12,
      `${row.channel}/gamma=${row.gamma}: coherence advantage ${row.coherenceAdvantage}`,
    );
    // decomposition identity: gain = coherence + classical, exactly
    assert.ok(
      Math.abs(row.gain - row.coherenceAdvantage - row.classicalIncentive) <=
        1e-12,
    );
  }
  // the grid-artifact instance (v = 2.6, others = [1, 3]) is broken for the
  // RIGHT reason: classical incentive at gamma = 0 already, and diagonal
  // noise adds no coherence to it
  const artifact = rows.filter((r) => r.trueValue === 2.6 && r.gamma === 0);
  assert.ok(artifact.length >= 2);
  for (const row of artifact) {
    assert.ok(
      row.broken,
      "the classically broken instance must be convicted even at gamma = 0",
    );
    assert.ok(!row.noiseCreated);
  }
});

test("negative controls: forged census rows are convicted by name", () => {
  // a real row to forge against
  const real = spectralDsicCriterion(
    "second",
    1.4,
    [1],
    0,
    2,
    noisyChannelKraus("rotation", 0.5, 2),
  );
  // (a) a forged "not noise-created" filing on the broken rotation row
  const forgedFiling = verifyNoiseBreakClaim({
    channel: "rotation",
    gamma: 0.5,
    kind: "second",
    trueValue: 1.4,
    others: [1],
    lambdaMax: real.lambdaMax,
    uTruth: real.uTruth,
    noiseCreated: false,
  });
  assert.ok(!forgedFiling.ok);
  assert.equal(forgedFiling.code, "T1NX04-forged-noise-created-filing");
  // (b) a fabricated lambda_max ("noise halves the gain" — never measured)
  const forgedLambda = verifyNoiseBreakClaim({
    channel: "rotation",
    gamma: 0.5,
    kind: "second",
    trueValue: 1.4,
    others: [1],
    lambdaMax: real.lambdaMax / 2,
    uTruth: real.uTruth,
    noiseCreated: true,
  });
  assert.ok(!forgedLambda.ok);
  assert.equal(forgedLambda.code, "T1NX02-fabricated-lambda-max");
  // (c) a fabricated truth utility on a diagonal family
  const depol = spectralDsicCriterion(
    "second",
    1.4,
    [1],
    0,
    4,
    noisyChannelKraus("depol", 0.25, 4),
  );
  const forgedTruth = verifyNoiseBreakClaim({
    channel: "depol",
    gamma: 0.25,
    kind: "second",
    trueValue: 1.4,
    others: [1],
    lambdaMax: depol.lambdaMax,
    uTruth: depol.uTruth + 0.05,
    noiseCreated: false,
  });
  assert.ok(!forgedTruth.ok);
  assert.equal(forgedTruth.code, "T1NX03-fabricated-truth-utility");
  // (d) the honest row survives
  assert.ok(
    verifyNoiseBreakClaim({
      channel: "rotation",
      gamma: 0.5,
      kind: "second",
      trueValue: 1.4,
      others: [1],
      lambdaMax: real.lambdaMax,
      uTruth: real.uTruth,
      noiseCreated: true,
    }).ok,
  );
});

test("entry guards: non-CPTP Kraus, wrong utility arity, off-grid truth are refused by name", () => {
  // non-TP: a "reset damping" with the decay operators merged (the exact
  // construction the spec-verification run convicted)
  const merged = [mat(4, 4), mat(4, 4)];
  merged[0]!.re[0] = 1;
  for (let i = 1; i < 4; i++) merged[0]!.re[i * 4 + i] = Math.sqrt(0.5);
  for (let i = 1; i < 4; i++) merged[1]!.re[0 * 4 + i] = Math.sqrt(0.5);
  assert.throws(() => {
    requireCptp(merged, 4);
  }, /T1N05-non-cptp/);
  assert.throws(() => {
    effectOperators(merged, 4);
  }, /T1N05-non-cptp/);
  // non-square Kraus of the wrong dimension
  assert.throws(() => {
    requireCptp([identity(3)], 4);
  }, /T1N04-bad-shape/);
  // utility arity mismatch
  const kraus = noisyChannelKraus("phaseFlip", 0.5, 2);
  assert.throws(
    () => utilityObservable([0.1, 0.2, 0.3], kraus, 2),
    /T1N06-bad-utility/,
  );
  // truthful level off the grid: named cause, not a downstream basisVec error
  // (level(3.6) = 4 is outside [0,4); the guard fires before any Kraus use)
  assert.throws(
    () => spectralDsicCriterion("second", 3.6, [2], 0, 4, kraus),
    /T1N09-truth-off-grid/,
  );
  assert.throws(
    () => spectralDsicCriterion("second", -0.6, [1], 0, 2, kraus),
    /T1N09-truth-off-grid/,
  );
  // gamma out of range
  assert.throws(() => noisyChannelKraus("depol", 1.5, 4), /T1N01/);
  // qubit family on a 4-level register
  assert.throws(
    () => noisyChannelKraus("phaseFlip", 0.5, 4),
    /T1N03-qubit-family/,
  );
});

test("negative control (statistics face): a depolarizing row claimed as noise-created is convicted by magnitude", () => {
  // the diagonal families sit at coherence advantage EXACTLY 0 at BOTH ends
  // of a gamma step — the zero is machine-exact, not a tolerance accident;
  // the forged amplitude is judged against the local slope of lambda_max
  const depol = noisyChannelKraus("depol", 0.25, 4);
  const c = spectralDsicCriterion("second", 1.4, [1], 0, 4, depol);
  assert.ok(Math.abs(c.coherenceAdvantage) <= 1e-12);
  const cStep = spectralDsicCriterion(
    "second",
    1.4,
    [1],
    0,
    4,
    noisyChannelKraus("depol", 0.26, 4),
  );
  assert.ok(
    Math.abs(cStep.coherenceAdvantage) <= 1e-12,
    "coherence advantage stays machine-zero across the step",
  );
  const slope = Math.abs(cStep.lambdaMax - c.lambdaMax) / 0.01;
  assert.ok(
    slope > 0 && Number.isFinite(slope),
    `lambda_max is gamma-sensitive (slope ${slope.toFixed(3)})`,
  );
  // a forged lambda_max + 1e-3 corresponds to a gamma drift of 1e-3/slope —
  // far below the grid step, so the re-derivation at the CLAIMED gamma
  // convicts it; it cannot hide behind discretization
  const verdict = verifyNoiseBreakClaim({
    channel: "depol",
    gamma: 0.25,
    kind: "second",
    trueValue: 1.4,
    others: [1],
    lambdaMax: c.lambdaMax + 1e-3,
    uTruth: c.uTruth,
    noiseCreated: true,
  });
  assert.ok(!verdict.ok);
  assert.equal(verdict.code, "T1NX02-fabricated-lambda-max");
  assert.ok(
    1e-3 / slope < 0.01,
    `forged amplitude ${1e-3} vs slope ${slope.toFixed(3)}: equivalent drift ${((1e-3 / slope) * 1000).toPrecision(3)}e-3`,
  );
});

test("T1N-a consistency: the observable path matches the physical path on the census witnesses", () => {
  for (const name of FAMILIES) {
    const k = kOf(name);
    const kraus = noisyChannelKraus(name, 0.4, k);
    const u = reportUtilities("second", 0.4, [1], 0, k);
    const b = utilityObservable(u, kraus, k);
    const c = spectralDsicCriterion("second", 0.4, [1], 0, k, kraus);
    const obs = noisyUtilityObservablePath(c.bestDeviation, b);
    const phys = noisyUtilityPhysicalPath(c.bestDeviation, kraus, u);
    assert.ok(
      Math.abs(obs - phys) <= 1e-13,
      `${name}: witness dual-path ${obs} vs ${phys}`,
    );
    assert.ok(
      Math.abs(obs - c.lambdaMax) <= 1e-12,
      `${name}: witness achieves lambda_max`,
    );
  }
});

test("the resetDamp Kraus decomposition is CPTP where the merged form is not (the spec-run lesson, pinned)", () => {
  const correct = noisyChannelKraus("resetDamp", 0.5, 4);
  requireCptp(correct, 4); // must not throw
  const sum = correct.reduce(
    (acc, op) => mAdd(acc, mMul(mMul(mDagger(op), identity(4)), op)),
    mat(4, 4),
  );
  assert.ok(matEq(sum, identity(4), 1e-12));
  // the merged single-operator form carries off-diagonal g blocks: not TP
  const k0 = mat(4, 4);
  k0.re[0] = 1;
  for (let i = 1; i < 4; i++) k0.re[i * 4 + i] = Math.sqrt(0.5);
  const k1 = mat(4, 4);
  for (let i = 1; i < 4; i++) k1.re[0 * 4 + i] = Math.sqrt(0.5);
  assert.throws(() => {
    requireCptp([k0, k1], 4);
  }, /T1N05-non-cptp/);
});

test("applyKraus agreement: noisyChannelKraus depol matches the direct depolarize formula", () => {
  // rho -> (1-gamma) rho + gamma I/k through Kraus must equal the closed
  // form entrywise — an independent anchor of the d^2+1-operator construction
  const rng = makeRng(42);
  const kraus = noisyChannelKraus("depol", 0.3, 4);
  const sigma = fromVec(randomPureState(4, rng));
  const via = applyKraus(sigma, kraus);
  const closed = mAdd(mScale(sigma, 0.7), mScale(identity(4), 0.3 / 4));
  assert.ok(matEq(via, closed, 1e-14));
});
