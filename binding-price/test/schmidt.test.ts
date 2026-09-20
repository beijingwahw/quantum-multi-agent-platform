import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SCHMIDT_CLAIMS,
  announcementState,
  bellClosureDeviation,
  checkSchmidtClaims,
  classicalCollapseDeviation,
  schmidtAverage,
  schmidtCensus,
  schmidtCorrelators,
  schmidtReveal,
  verifySchmidtRevealClaim,
  type UntrustedSchmidtClaimRow,
} from "../src/kernel/schmidt.js";
import { jointProductReveal } from "../src/kernel/market.js";

describe("T-S1 the closed form, three paths (closed / dense / correlator)", () => {
  it("SC1: P = 1/4[1 + cos2a cos2b + sin2t sin2a sin2b cos(ga+gb)] against the dense kernel route on the whole algebraic grid", () => {
    const c = schmidtCensus();
    assert.ok(c.points > 5000, `the census must sweep the grid (${c.points})`);
    assert.ok(
      c.worstClosedVsDense <= 1e-12,
      `closed vs dense ${c.worstClosedVsDense}`,
    );
    assert.ok(
      c.worstCorrelatorVsDense <= 1e-12,
      `correlator vs dense ${c.worstCorrelatorVsDense}`,
    );
  });

  it("spot points pin exact algebraic values: (+,+) at t=pi/4 is 1/2 (the Phi+ point); (z,z) is 1/2 at every t; (z,-z) is exactly 0", () => {
    const q = Math.PI / 4;
    const f = schmidtReveal(q, q, 0, 0, q);
    assert.ok(Math.abs(f.closed - 0.5) <= 1e-15);
    assert.ok(Math.abs(f.dense - 0.5) <= 1e-15);
    for (const t of [0, 0.3, q, 1.2]) {
      const zz = schmidtReveal(0, 0, 0, 0, t);
      assert.ok(Math.abs(zz.closed - 0.5) <= 1e-15, `P(z,z;t) at t=${t}`);
      const zm = schmidtReveal(0, q * 2, 0, 0, t); // beta = pi/2: |1> on the second coin
      assert.ok(Math.abs(zm.closed) <= 1e-15, `P(z,-z;t) at t=${t}`);
    }
  });
});

describe("T-S2 the flat faces — per-coin supply, the pin, the steering curve, the envelope", () => {
  it("SC2: per-coin flat at EVERY t and announcement (the census's flat supply as the closed form's corollary)", () => {
    const c = schmidtCensus();
    assert.ok(c.worstPerCoin <= 1e-12, `worst ${c.worstPerCoin}`);
  });

  it("SC3: the (z,z) pin at 1/2, the equatorial steering curve 1/4(1+sin2t) sweeping 1/4 -> 1/2, and the FLAT envelope (max 1/2, min 0)", () => {
    const c = schmidtCensus();
    assert.ok(c.worstZZPin <= 1e-12, `pin ${c.worstZZPin}`);
    assert.ok(c.worstSteering <= 1e-12, `steering ${c.worstSteering}`);
    // endpoints of the census's span, closed-form
    assert.ok(
      Math.abs(
        schmidtReveal(Math.PI / 4, Math.PI / 4, 0, 0, 0).closed - 0.25,
      ) <= 1e-15,
    );
    assert.ok(
      Math.abs(
        schmidtReveal(Math.PI / 4, Math.PI / 4, 0, 0, Math.PI / 4).closed - 0.5,
      ) <= 1e-15,
    );
    // the envelope: flat above, zero below — NOT the spec's 1/2(1+|cos2t|)
    assert.ok(Math.abs(c.envelopeMax - 0.5) <= 1e-9, `max ${c.envelopeMax}`);
    assert.ok(Math.abs(c.envelopeMin) <= 1e-9, `min ${c.envelopeMin}`);
  });

  it("SC4: the y-phase sum pi/2 kills the t-term — the dead-axis face (t-dependence refuted, not just reduced)", () => {
    const c = schmidtCensus();
    assert.ok(c.worstDeadAxis <= 1e-12, `dead axis ${c.worstDeadAxis}`);
    const a = Math.PI / 6;
    const b = Math.PI / 3;
    for (const t of [0, 0.4, Math.PI / 4, 1.1]) {
      const f = schmidtReveal(a, b, Math.PI / 2, 0, t);
      const g = schmidtReveal(a, b, Math.PI / 3, Math.PI / 6, t); // ga+gb = pi/2
      assert.ok(Math.abs(f.closed - g.closed) <= 1e-15);
    }
  });

  it("SC4b: the correlation matrix diag(sin2t, -sin2t, 1) — machine-read from the density, off-diagonals zero", () => {
    for (const t of [0, 0.2, Math.PI / 4, 0.9, Math.PI / 2]) {
      const tab = schmidtCorrelators(t);
      assert.ok(tab.worstDeviation <= 1e-12, `t=${t}: ${tab.worstDeviation}`);
      assert.ok(Math.abs(tab.claimed[0]! - Math.sin(2 * t)) <= 1e-15);
      assert.ok(Math.abs(tab.claimed[4]! + Math.sin(2 * t)) <= 1e-15);
      assert.ok(Math.abs(tab.claimed[8]! - 1) <= 1e-15);
    }
  });
});

describe("T-S3 the baseline anchors — the classical table and the Bell closure", () => {
  it("SC5: t = 0 collapses to the classical joint table 1/4[1 + cos2a cos2b]", () => {
    assert.ok(classicalCollapseDeviation() <= 1e-12);
  });

  it("SC5b: t = pi/4 both members ARE |Phi+> — the family closes at the Bell point (cross-anchored with the G8 Bell ensemble)", () => {
    assert.ok(bellClosureDeviation() <= 1e-15);
    const joint = schmidtAverage(Math.PI / 4);
    const plus = announcementState(Math.PI / 4, 0);
    assert.ok(Math.abs(jointProductReveal(joint, plus, plus) - 0.5) <= 1e-15);
  });
});

describe("T-S4 the spec refutations and the smuggling trials (v0.6.0)", () => {
  it("SC6 (the R18 spec's formula refuted): P = 1/4[1 + sin2a sin2b cos2t] misses the population term — witness t=0, (+,+): spec 1/2, truth 1/4", () => {
    const f = schmidtReveal(Math.PI / 4, Math.PI / 4, 0, 0, 0);
    const spec = 0.25 * (1 + 1 * Math.cos(0)); // sin2a = sin2b = 1, cos2t = 1
    assert.ok(Math.abs(f.dense - 0.25) <= 1e-15);
    assert.equal(spec, 0.5);
    const c = schmidtCensus();
    // the magnitude at local scale: the miss IS the population term at its max
    assert.ok(
      c.worstSpecFormula > 0.35 && c.worstSpecFormula < 0.354,
      `worst spec deviation ${c.worstSpecFormula} (expected ~0.3536 = sqrt(2)/4)`,
    );
  });

  it("SC7 (the spec's envelope refuted): sup over announcements is FLAT at 1/2, not 1/2(1+|cos2t|)", () => {
    const c = schmidtCensus();
    assert.ok(Math.abs(c.envelopeMax - 0.5) <= 1e-9);
    // the spec's envelope reaches 1 at t=0 — a pass of 1 is not just wrong, it
    // exceeds the law's ceiling 1/4(1 + sigma_max(C)) with sigma_max = 1
    const v = verifySchmidtRevealClaim({
      alpha: 0,
      beta: 0,
      gammaA: 0,
      gammaB: 0,
      t: 0,
      claimedPass: 1,
    });
    assert.ok(!v.ok && v.code === "ENVELOPE-EXCEEDED");
  });

  it("the claims table is honest: every tag matches the machine's recomputed verdict", () => {
    assert.deepEqual(checkSchmidtClaims(), []);
    // tamper both directions: SC6 claimed HOLDS, SC1 claimed REFUTED
    const asRows: UntrustedSchmidtClaimRow[] = SCHMIDT_CLAIMS.map((r) => ({
      ...r,
    }));
    const tamperedA = asRows.map((r) =>
      r.id === "SC6" ? { ...r, tag: "HOLDS" } : r,
    );
    const violA = checkSchmidtClaims(tamperedA);
    assert.equal(violA.length, 1);
    assert.equal(violA[0]!.row, "SC6");
    assert.match(
      violA[0]!.detail,
      /claimed HOLDS but the machine says otherwise/,
    );
    const tamperedB = asRows.map((r) =>
      r.id === "SC1" ? { ...r, tag: "REFUTED" } : r,
    );
    const violB = checkSchmidtClaims(tamperedB);
    assert.equal(violB.length, 1);
    assert.equal(violB[0]!.row, "SC1");
    const tamperedC = asRows.map((r) =>
      r.id === "SC3" ? { ...r, tag: "MAYBE" } : r,
    );
    const violC = checkSchmidtClaims(tamperedC);
    assert.equal(violC.length, 1);
    assert.match(violC[0]!.detail, /illegal claim tag/);
  });

  it("an honest claim is VERIFIED with its three-route digits; the flat ceiling itself passes", () => {
    const f = schmidtReveal(Math.PI / 8, Math.PI / 6, 0.3, 0.4, Math.PI / 5);
    const v = verifySchmidtRevealClaim({
      alpha: Math.PI / 8,
      beta: Math.PI / 6,
      gammaA: 0.3,
      gammaB: 0.4,
      t: Math.PI / 5,
      claimedPass: f.closed,
    });
    assert.ok(v.ok, v.ok ? "" : v.detail);
    const zz = verifySchmidtRevealClaim({
      alpha: 0,
      beta: 0,
      gammaA: 0,
      gammaB: 0,
      t: 0.7,
      claimedPass: 0.5,
    });
    assert.ok(zz.ok);
  });

  it("the spec-shaped forgery is convicted with the SC6 fingerprint and the deviation at local scale", () => {
    // a claimed value matching the R18 shape exactly at a point where it is wrong
    // (alpha = beta = pi/6, t = pi/6: the population term cos2a cos2b = 1/4 is
    // live and sin2t = cos2t do NOT coincide — the shapes genuinely differ)
    const alpha = Math.PI / 6;
    const beta = Math.PI / 6;
    const t = Math.PI / 6;
    const spec =
      0.25 * (1 + Math.sin(2 * alpha) * Math.sin(2 * beta) * Math.cos(2 * t));
    const truth = schmidtReveal(alpha, beta, 0, 0, t).dense;
    assert.ok(
      Math.abs(spec - truth) > 1e-3,
      "the forgery must be materially wrong here",
    );
    const v = verifySchmidtRevealClaim({
      alpha,
      beta,
      gammaA: 0,
      gammaB: 0,
      t,
      claimedPass: spec,
    });
    assert.ok(!v.ok && v.code === "FORGED-VALUE");
    assert.match(v.detail, /SC6/);
    assert.match(v.detail, /local scale/);
  });

  it("an impossible probability and out-of-range angles are refused by name", () => {
    const v = verifySchmidtRevealClaim({
      alpha: 0,
      beta: 0,
      gammaA: 0,
      gammaB: 0,
      t: 0,
      claimedPass: 1.5,
    });
    assert.ok(!v.ok && v.code === "SUBZERO-PASS");
    const w = verifySchmidtRevealClaim({
      alpha: 2,
      beta: 0,
      gammaA: 0,
      gammaB: 0,
      t: 0,
      claimedPass: 0.5,
    });
    assert.ok(!w.ok && w.code === "ANGLE-RANGE");
  });
});
