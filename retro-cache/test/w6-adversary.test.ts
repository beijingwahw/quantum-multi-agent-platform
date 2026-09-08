import test from "node:test";
import assert from "node:assert/strict";
import {
  censusCrossingTap,
  chshUnderAttack,
  eveInfoNoisyStorage,
  interceptResendRow,
  qberUnderAttack,
  settingsMutationRow,
} from "../src/kernel/adversary.js";
import { sparseAdversaryInfo } from "../src/kernel/amplify.js";
import { chshStandard, wernerPair } from "../src/kernel/state.js";
import { h2 } from "../src/kernel/tariff.js";

test("W6.A intercept-resend: QBER and CHSH two-path, eta=0 reproduces the honest ledger", () => {
  for (const p of [1, 0.9, 0.75, 0.5]) {
    for (const eta of [0, 0.25, 0.5, 0.75, 1]) {
      const q = qberUnderAttack(p, eta);
      const s = chshUnderAttack(p, eta);
      assert.ok(Math.abs(q.table - q.closed) < 1e-14, `p=${p} eta=${eta}: QBER two-path`);
      assert.ok(Math.abs(s.table - s.closed) < 1e-14, `p=${p} eta=${eta}: CHSH two-path`);
    }
    // no tap = the W1 value, exactly
    const s0 = chshUnderAttack(p, 0);
    assert.ok(Math.abs(s0.table - chshStandard(wernerPair(p))) < 1e-14, `p=${p}: eta=0 is the honest channel`);
  }
  // the full-tap signature: q(eta=1, p) = 1/4 + (1-p)/4 >= 1/4, exactly 1/4
  // on the noiseless cache (honest noise adds on top of the tap footprint)
  for (const p of [1, 0.9, 0.75, 0.5]) {
    assert.ok(Math.abs(qberUnderAttack(p, 1).closed - (0.25 + (1 - p) / 4)) < 1e-14, `p=${p}: full-tap footprint`);
  }
  assert.ok(Math.abs(qberUnderAttack(1, 1).closed - 0.25) < 1e-14, "on the noiseless cache the tap stamps q = 1/4 exactly");
});

test("W6.B the census depreciation line: |S| under the classical cap at eta=1, crossing exact", () => {
  for (const p of [1, 0.9, 0.75, 0.5]) {
    const s = chshUnderAttack(p, 1);
    assert.ok(Math.abs(Math.abs(s.closed) - Math.SQRT2 * p) < 1e-14, `p=${p}: eta=1 gives |S| = sqrt(2)*p`);
    assert.ok(Math.abs(s.closed) <= 2, `p=${p}: the fully mediated column is inside the census`);
  }
  assert.ok(Math.abs((censusCrossingTap(1) as number) - (2 - Math.SQRT2)) < 1e-14, "eta*(1) = 2 - sqrt(2)");
  assert.equal(censusCrossingTap(1 / Math.SQRT2 + 1e-6) !== null, true);
  assert.equal(censusCrossingTap(0.7), null, "below p = 1/sqrt(2) the surplus already starts under the cap");
  // crossing self-consistency: at eta*, |S| = 2 to machine precision
  const etaStar = censusCrossingTap(1) as number;
  const atCrossing = chshUnderAttack(1, etaStar);
  assert.ok(Math.abs(Math.abs(atCrossing.closed) - 2) < 1e-12, "|S(eta*)| = 2");
});

test("W6.C noisy storage: endpoints exact, decay monotone", () => {
  assert.equal(eveInfoNoisyStorage(1, 0), 0.5, "perfect memory keeps her full take");
  assert.equal(eveInfoNoisyStorage(1, 0.5), 0, "a fair-coin memory carries nothing");
  let prev = Number.POSITIVE_INFINITY;
  for (const nu of [0, 0.05, 0.11, 0.25, 0.4, 0.5]) {
    const v = eveInfoNoisyStorage(1, nu);
    assert.ok(v <= prev + 1e-15, `nu=${nu}: monotone decay`);
    prev = v;
  }
  assert.ok(Math.abs(eveInfoNoisyStorage(1, 0.25) - 0.5 * (1 - h2(0.25))) < 1e-15, "composition formula");
});

test("W6.D settings mutation: two-path QBER, strictly positive tax, exactly zero gain", () => {
  for (const mu of [0.05, 0.1, 0.25]) {
    const r = settingsMutationRow(1, mu);
    assert.ok(Math.abs(r.qberTable - r.qberClosed) < 1e-14, `mu=${mu}: two-path`);
    assert.ok(r.extraTax > 0, `mu=${mu}: mutation strictly raises the tariff`);
    assert.equal(r.adversaryGain, 0, "the settings column is W2's zero-information face");
  }
  assert.ok(Math.abs(settingsMutationRow(1, 0.25).qberClosed - 0.125) < 1e-14, "mu=1/4 at p=1: q_eff = 1/8");
});

test("W6.E the ledger's verdicts and the full-tap confiscation", () => {
  assert.equal(interceptResendRow(1, 0.5).verdict, "proceed");
  assert.equal(interceptResendRow(1, 0.75).verdict, "abort");
  const full = interceptResendRow(1, 1);
  assert.equal(full.verdict, "abort");
  assert.ok(Math.abs(full.netPrePA - (1 - h2(0.25) - 0.5)) < 1e-14, "net = 1 - h2(1/4) - 1/2");
  assert.ok(Math.abs(full.netPrePA - (-0.31127812445913283)) < 1e-12, "the confiscated number itself");
  // QBER monotone in eta for every visibility
  for (const p of [1, 0.9, 0.5]) {
    let prev = Number.NEGATIVE_INFINITY;
    for (const eta of [0, 0.25, 0.5, 0.75, 1]) {
      const q = qberUnderAttack(p, eta).closed;
      assert.ok(q > prev, `p=${p}: footprint grows with the tap`);
      prev = q;
    }
  }
});

test("W6.F the full tap through the amplifier: collapse is real, the floor still confiscates", () => {
  let prev = Number.POSITIVE_INFINITY;
  for (const k of [4, 3, 2]) {
    const sp = sparseAdversaryInfo(8, k, 4);
    assert.equal(sp.sampleCheckDev, 0);
    assert.ok(sp.infoMean < prev, `k=${k}: compressing shrinks her surviving information`);
    prev = sp.infoMean;
    const net = (k - sp.infoMean) / 8 - h2(0.25);
    assert.ok(net < 0, `k=${k}: h2(1/4) floor keeps the net negative — the amplifier cannot refund confiscated rate`);
  }
});
