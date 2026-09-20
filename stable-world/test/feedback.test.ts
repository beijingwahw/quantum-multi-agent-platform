import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { makeRng } from "../src/core/rng.js";
import { randomStateVec, vecToRho } from "../src/core/states.js";
import { coherentShortcut } from "../src/kernel/law.js";
import {
  at15CensusInputs,
  auditFeedbackWorkClaim,
  feedbackExtraction,
  incoherentEngineYield,
  mixedWeightState,
  straddlerState,
  suFeedbackShifts,
  suMeasurementKraus,
  witnessFeedback,
} from "../src/kernel/feedback.js";
import { DomainError } from "../src/core/errors.js";

describe("E4 the measurement-feedback work extraction (v0.9.0)", () => {
  it("the engine's machinery is exact: measurement complete, feedback shifts unitary, the banking channel lands on |1><1| in every branch", () => {
    const rng = makeRng(4711);
    for (let t = 0; t < 30; t++) {
      const ledger = feedbackExtraction(vecToRho(randomStateVec(rng, 2)));
      assert.ok(
        ledger.completenessDev <= 1e-15,
        `completeness ${ledger.completenessDev}`,
      );
      assert.ok(ledger.bankedDev <= 1e-15, `banked dev ${ledger.bankedDev}`);
      assert.ok(
        Math.abs(ledger.qPlusKraus + ledger.qMinusKraus - 1) <= 1e-15,
        `branch probabilities sum to ${ledger.qPlusKraus + ledger.qMinusKraus}`,
      );
    }
    // the operator surface itself
    assert.equal(suFeedbackShifts().length, 2);
    assert.equal(suMeasurementKraus().length, 2);
  });

  it("two independent roads to W_ext: the closed form from the l1 matrix elements vs the Kraus execution's branch statistics — zero deviation after alignment, strictly below before (AT14's slack in work units)", () => {
    const rng = makeRng(8123);
    let worstTwoRoad = 0;
    let worstNaiveExcess = 0;
    let naiveSlackSeen = 0;
    for (let t = 0; t < 60; t++) {
      const rhoW = vecToRho(randomStateVec(rng, 2));
      const ledger = feedbackExtraction(rhoW);
      worstTwoRoad = Math.max(worstTwoRoad, ledger.twoRoadDev);
      worstNaiveExcess = Math.max(
        worstNaiveExcess,
        ledger.naiveWorkBits - ledger.workBits,
      );
      naiveSlackSeen = Math.max(
        naiveSlackSeen,
        ledger.workBits - ledger.naiveWorkBits,
      );
    }
    assert.ok(worstTwoRoad <= 1e-15, `two-road deviation ${worstTwoRoad}`);
    assert.ok(
      worstNaiveExcess <= 1e-12,
      `naive road beat the aligned one by ${worstNaiveExcess}`,
    );
    assert.ok(
      naiveSlackSeen > 1e-3,
      `the uncontrolled road's slack never showed (max ${naiveSlackSeen})`,
    );
  });

  it("straddlers harvest the banked bit WHOLE: W_ext = kT ln2 exactly (C_l1 = 1), over random cargo phases — and the gap to the value is exactly 0", () => {
    const rng = makeRng(2024);
    for (let t = 0; t < 12; t++) {
      const phi = rng() * 2 * Math.PI;
      const ledger = feedbackExtraction(
        coherentShortcut(straddlerState(phi)).weight,
      );
      assert.ok(Math.abs(ledger.cL1 - 1) <= 1e-12, `C_l1 ${ledger.cL1}`);
      assert.ok(
        Math.abs(ledger.workBits - 1) <= 1e-12,
        `work bits ${ledger.workBits}`,
      );
      assert.ok(
        Math.abs(ledger.lockGapBits) <= 1e-12,
        `gap ${ledger.lockGapBits}`,
      );
    }
  });

  it("work locking: kT ln2 · C_rel(weight) − W_ext >= 0 over the AT15 37-trajectory census, zero EXACTLY on the equal-population face, strictly positive on unequal families", () => {
    const inputs = at15CensusInputs();
    assert.equal(inputs.length, 37);
    let gapMin = Infinity;
    let gapMax = -Infinity;
    for (const rho of inputs) {
      const ledger = feedbackExtraction(coherentShortcut(rho).weight);
      gapMin = Math.min(gapMin, ledger.lockGapBits);
      gapMax = Math.max(gapMax, ledger.lockGapBits);
    }
    assert.ok(gapMin >= -1e-12, `gap went negative: ${gapMin}`);
    assert.ok(
      gapMax > 1e-2,
      `no locked share anywhere on the census (max ${gapMax})`,
    );
    // the equality face: equal populations, whatever the coherence
    let worstEqual = 0;
    for (const s of [0.1, 0.5, 0.9]) {
      const ledger = feedbackExtraction(mixedWeightState(0.5, s, 0.7));
      worstEqual = Math.max(worstEqual, Math.abs(ledger.lockGapBits));
    }
    assert.ok(
      worstEqual <= 1e-12,
      `equal-population gap ${worstEqual} (must be exactly 0)`,
    );
    // the strict face: unequal populations carry a strictly positive gap
    let minUnequal = Infinity;
    for (const p0 of [0.25, 0.4, 0.6, 0.75]) {
      for (const s of [0.2, 0.6, 1]) {
        const ledger = feedbackExtraction(mixedWeightState(p0, s, 1.2));
        minUnequal = Math.min(minUnequal, ledger.lockGapBits);
      }
    }
    assert.ok(minUnequal > 1e-6, `unequal-family gap dipped to ${minUnequal}`);
  });

  it("the incoherent no-go: an energy-diagonal engine's yield is IDENTICAL on rho and Delta rho — the coherence face contributes exactly 0 (work locking is operational)", () => {
    let worst = 0;
    for (const rho of at15CensusInputs()) {
      worst = Math.max(
        worst,
        incoherentEngineYield(coherentShortcut(rho).weight)
          .coherenceContribution,
      );
    }
    assert.equal(worst, 0, "the incoherent engine saw the coherence");
  });

  it("SMUGGLING TRIAL: work claims are recomputed and convicted by name — the raw ln(1+C_l1)/ln2 form, a nudged engine output, an incoherent-engine coherence claim; honest claims pass", () => {
    const rhoW = mixedWeightState(0.5, 0.5, 0);
    const honest = feedbackExtraction(rhoW);
    // the honest claim passes clean
    assert.deepEqual(
      auditFeedbackWorkClaim({
        rhoW,
        claimedWorkBits: honest.workBits,
        controller: "aligned",
      }),
      [],
    );
    // the spec's raw form: ln(1+C_l1)/ln2 bits on the C_l1 = 1/2 state
    const specForm = Math.log(1 + honest.cL1) / Math.LN2;
    const v1 = auditFeedbackWorkClaim({
      rhoW,
      claimedWorkBits: specForm,
      controller: "aligned",
    });
    assert.ok(
      v1.some((x) => x.crime === "work smuggling above the free-energy value"),
      JSON.stringify(v1),
    );
    assert.ok(
      v1.some((x) => x.crime === "counterfeit engine output"),
      JSON.stringify(v1),
    );
    // a nudged engine output
    const v2 = auditFeedbackWorkClaim({
      rhoW,
      claimedWorkBits: honest.workBits + 0.01,
      controller: "aligned",
    });
    assert.ok(
      v2.some((x) => x.crime === "counterfeit engine output"),
      JSON.stringify(v2),
    );
    // an incoherent engine claiming the coherence face
    const rhoW2 = mixedWeightState(0.7, 0.8, 0.3);
    const v3 = auditFeedbackWorkClaim({
      rhoW: rhoW2,
      claimedWorkBits: feedbackExtraction(rhoW2).workBits,
      controller: "incoherent",
    });
    assert.ok(
      v3.some((x) => x.crime === "locked-work smuggling"),
      JSON.stringify(v3),
    );
    // the endpoints where the raw form is honest: C_l1 = 0 and C_l1 = 1
    const diag = mixedWeightState(0.5, 0, 0);
    assert.deepEqual(
      auditFeedbackWorkClaim({
        rhoW: diag,
        claimedWorkBits: 0,
        controller: "aligned",
      }),
      [],
    );
    const straddle = coherentShortcut(straddlerState(1.1)).weight;
    assert.deepEqual(
      auditFeedbackWorkClaim({
        rhoW: straddle,
        claimedWorkBits: 1,
        controller: "aligned",
      }),
      [],
    );
  });

  it("W-S witness: the whole engine, one detail string, all faces green", () => {
    const w = witnessFeedback();
    assert.equal(w.name, "W-S measurement-feedback work extraction");
    assert.ok(w.pass, w.detail);
  });

  it("domain rejections are named: non-2x2 states and unphysical grids", () => {
    const bad = {
      rows: 4,
      cols: 4,
      re: new Float64Array(16),
      im: new Float64Array(16),
    };
    assert.throws(
      () => feedbackExtraction(bad),
      (e: unknown) =>
        e instanceof DomainError && e.code === "feedbackExtraction:dim",
    );
    assert.throws(
      () => mixedWeightState(1.2, 0.5, 0),
      (e: unknown) =>
        e instanceof DomainError && e.code === "mixedWeightState:range",
    );
  });
});
