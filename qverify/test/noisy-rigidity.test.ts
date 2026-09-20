/** G2-b noisy-rigidity window shift: exact shrink laws, regime boundaries, closing noises, smuggling trials. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mat } from "../src/core/cmat.js";
import { applyKraus, depolarize } from "../src/core/channels.js";
import {
  isotropicNoiseKraus,
  shrinkEta,
  deliveredState,
  shiftCensusRow,
  shiftSweep,
  rawRegimeBoundaries,
  CERT_CLOSING_NOISE,
  ENTANGLE_CLOSING_NOISE,
  compensatedBetaStar,
  checkNoisyRigidityCertificate,
} from "../src/protocol/noisy-rigidity.js";
import { horodeckiSMax, pptMinEigenvalue } from "../src/protocol/chsh.js";
import {
  rigidityRegime,
  BETA_STAR,
  V_STAR,
  kaniewskiLowerBound,
  checkRigidityCertificate,
} from "../src/protocol/selftest.js";

const SQRT2 = Math.SQRT2;

test("S1 convention anchor: the Kraus set is TP and IS the repo depolarize convention", () => {
  for (const lambda of [0, 0.05, 0.2, 0.5, 0.9, 1]) {
    const kraus = isotropicNoiseKraus(lambda);
    // TP: (sum_j K_j†K_j)_{ef} = sum_j sum_c conj(K_j[c][e]) K_j[c][f] = I (full 2x2)
    let tp = 0;
    for (let e = 0; e < 2; e++) {
      for (let f = 0; f < 2; f++) {
        let re = 0;
        let im = 0;
        for (const k of kraus) {
          for (let c = 0; c < 2; c++) {
            const are = k.re[c * 2 + e]!;
            const aim = k.im[c * 2 + e]!;
            const bre = k.re[c * 2 + f]!;
            const bim = k.im[c * 2 + f]!;
            re += are * bre + aim * bim;
            im += aim * bre - are * bim;
          }
        }
        tp = Math.max(tp, Math.abs(re - (e === f ? 1 : 0)), Math.abs(im));
      }
    }
    assert.ok(tp < 1e-15, `lambda=${lambda}: sum K†K deviates from I by ${tp}`);
    // affine cross-check on a non-trivial qubit input
    const probe = mat(2, 2);
    probe.re[0] = 0.7;
    probe.re[3] = 0.3;
    probe.re[1] = probe.re[2] = 0.1;
    const viaKraus = applyKraus(probe, kraus);
    const viaRepo = depolarize(probe, lambda);
    let gap = 0;
    for (let i = 0; i < 4; i++) {
      gap = Math.max(gap, Math.abs(viaKraus.re[i]! - viaRepo.re[i]!));
    }
    assert.ok(
      gap < 1e-15,
      `lambda=${lambda}: Kraus form differs from depolarize by ${gap}`,
    );
  }
});

test("S1/S2 the shift laws hold on the full (v, lambda) grid", () => {
  const vs = Array.from({ length: 19 }, (_, i) => (i + 1) / 20);
  const lambdas = [0.02, 0.05, 0.1, 0.2, 0.3, 0.5];
  const sweep = shiftSweep(vs, lambdas);
  // spec tolerance: formula vs Horodecki engine on the noisy state <= 1e-13
  assert.ok(
    sweep.worstBetaGap <= 1e-13,
    `worst |S_max - 2*sqrt(2)*v*eta| = ${sweep.worstBetaGap.toExponential(3)}`,
  );
  assert.ok(
    sweep.worstClosure <= 1e-14,
    `worst ||delivered - rho_W(v*eta)||_1 = ${sweep.worstClosure.toExponential(3)}`,
  );
  assert.ok(
    sweep.worstCorrelation <= 1e-14,
    `worst |T_noisy - eta*T_clean| = ${sweep.worstCorrelation.toExponential(3)}`,
  );
});

test("S3 the delivered regime from the RECOMPUTED S matches rigidityRegime(v*eta) everywhere", () => {
  for (const lambda of [0.05, 0.15, 0.25]) {
    for (let i = 1; i <= 19; i++) {
      const v = i / 20;
      const row = shiftCensusRow(v, lambda);
      // independent path: classify by the S the Horodecki engine actually returned
      const fromS = rigidityRegime(row.betaNoisy / (2 * SQRT2));
      assert.equal(
        row.regime,
        fromS,
        `v=${v}, lambda=${lambda}: closed-form regime ${row.regime} vs S-based ${fromS}`,
      );
    }
  }
});

test("S3 the PPT boundary sits exactly at raw visibility 1/(3*eta)", () => {
  for (const lambda of [0.02, 0.05, 0.1, 0.2, 0.3]) {
    const eta = shrinkEta(lambda);
    const vBoundary = 1 / (3 * eta);
    if (vBoundary > 1) continue; // entanglement already closed at this noise (S4)
    const at = pptMinEigenvalue(deliveredState(vBoundary, lambda));
    assert.ok(
      Math.abs(at) < 1e-13,
      `lambda=${lambda}: PPT min at the boundary is ${at.toExponential(3)}, not 0`,
    );
    // raw visibility BELOW the boundary delivers a separable state (ppt >= 0);
    // ABOVE it delivers an entangled one (ppt < 0) — the sign flip is in the
    // delivered visibility v*eta crossing 1/3
    const below = pptMinEigenvalue(deliveredState(vBoundary - 1e-6, lambda));
    const above = pptMinEigenvalue(deliveredState(vBoundary + 1e-6, lambda));
    assert.ok(
      below > 1e-9 && above < -1e-9,
      `lambda=${lambda}: PPT sign flip straddles the boundary (${below}, ${above})`,
    );
  }
});

test("S3 the raw regime boundaries land exactly on their noiseless values", () => {
  for (const lambda of [0.05, 0.1, 0.2]) {
    const eta = shrinkEta(lambda);
    const b = rawRegimeBoundaries(lambda);
    assert.ok(Math.abs(b.eta - eta) === 0);
    // local boundary: at raw v = 1/(sqrt(2) eta) the observed S is exactly 2
    if (b.local <= 1) {
      const sAt = horodeckiSMax(deliveredState(b.local, lambda));
      assert.ok(
        Math.abs(sAt - 2) < 1e-12,
        `lambda=${lambda}: S at the local boundary is ${sAt}`,
      );
      // one step in: strictly inside the window (still local, entangled)
      assert.equal(
        rigidityRegime(
          horodeckiSMax(deliveredState(b.local - 0.02, lambda)) / (2 * SQRT2),
        ),
        "window: entangled, CHSH-local",
      );
    }
    // Kaniewski boundary: at raw v = v*/eta the observed beta equals beta* exactly
    if (b.kaniewski <= 1) {
      const betaAt = horodeckiSMax(deliveredState(b.kaniewski, lambda));
      assert.ok(
        Math.abs(betaAt - BETA_STAR) < 1e-12,
        `lambda=${lambda}: beta at the compensated gate is ${betaAt}, beta* = ${BETA_STAR}`,
      );
      // the boundary is strict: AT the gate the certificate must not certify
      const verdict = checkNoisyRigidityCertificate({
        visibility: b.kaniewski,
        declaredNoise: lambda,
        claimedBeta: 2 * SQRT2 * b.kaniewski,
        claimedFidelity: (1 + 3 * b.kaniewski) / 4,
        claimsCertified: true,
      });
      assert.equal(verdict.ok, false);
      assert.equal(verdict.name, "certified-inside-rigidity-gap");
    }
  }
});

test("S4 the certification window closes at lambda = 1 - sqrt(v*)", () => {
  const eta = shrinkEta(CERT_CLOSING_NOISE);
  assert.ok(
    Math.abs(eta - V_STAR) < 1e-15,
    "eta at the closing noise is exactly v*",
  );
  // the BEST device (v = 1) observes exactly beta* and cannot certify (strict gate)
  const betaObs = horodeckiSMax(deliveredState(1, CERT_CLOSING_NOISE));
  assert.ok(Math.abs(betaObs - BETA_STAR) < 1e-12);
  const verdict = checkNoisyRigidityCertificate({
    visibility: 1,
    declaredNoise: CERT_CLOSING_NOISE,
    claimedBeta: 2 * SQRT2,
    claimedFidelity: 1,
    claimsCertified: true,
  });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.name, "certified-inside-rigidity-gap");
  // past the closing noise: no raw visibility reaches the gate
  const past = CERT_CLOSING_NOISE + 0.01;
  for (let i = 1; i <= 20; i++) {
    const v = i / 20;
    const beta = horodeckiSMax(deliveredState(v, past));
    assert.ok(
      beta < BETA_STAR,
      `v=${v}: beta=${beta} still reaches the gate past the closing noise`,
    );
  }
});

test("S4 the entanglement window closes at lambda = 1 - 1/sqrt(3)", () => {
  const eta = shrinkEta(ENTANGLE_CLOSING_NOISE);
  assert.ok(
    Math.abs(eta - 1 / 3) < 1e-15,
    "eta at the closing noise is exactly 1/3",
  );
  const at = pptMinEigenvalue(deliveredState(1, ENTANGLE_CLOSING_NOISE));
  assert.ok(
    Math.abs(at) < 1e-13,
    `PPT min of the best device at the closing noise is ${at}`,
  );
  const past = ENTANGLE_CLOSING_NOISE + 0.01;
  for (let i = 1; i <= 20; i++) {
    const v = i / 20;
    assert.ok(
      pptMinEigenvalue(deliveredState(v, past)) > -1e-12,
      `v=${v}: delivered state still entangled past the entanglement closing noise`,
    );
  }
});

test("lambda = 0 reduces the referee to the noiseless one (machine anchor)", () => {
  for (const visibility of [0.3, 0.5, 0.72, 0.8, 0.95]) {
    const noisy = checkNoisyRigidityCertificate({
      visibility,
      declaredNoise: 0,
      claimedBeta: 2 * SQRT2 * visibility,
      claimedFidelity: (1 + 3 * visibility) / 4,
      claimsCertified: true,
    });
    const clean = checkRigidityCertificate({
      visibility,
      claimedBeta: 2 * SQRT2 * visibility,
      claimedFidelity: (1 + 3 * visibility) / 4,
      claimsCertified: true,
    });
    assert.equal(
      noisy.ok,
      clean.ok,
      `v=${visibility}: verdict divergence at zero noise`,
    );
    assert.equal(
      noisy.name,
      clean.name,
      `v=${visibility}: fraud-name divergence at zero noise`,
    );
  }
});

test("audit: an honest certificate passes; a data-only window row ships clean", () => {
  // observed beta = 2*sqrt(2)*0.9*0.9025 = 2.297 > beta*: the detectors still see past the gate;
  // the certified fidelity claim rides the proven bound at the OBSERVED beta (noiseless discipline)
  const betaObs = 2 * SQRT2 * 0.9 * shrinkEta(0.05);
  assert.ok(betaObs > BETA_STAR);
  const proven = kaniewskiLowerBound(betaObs);
  const pass = checkNoisyRigidityCertificate({
    visibility: 0.9,
    declaredNoise: 0.05,
    claimedBeta: 2 * SQRT2 * 0.9,
    claimedFidelity: proven - 1e-9,
    claimsCertified: true,
  });
  assert.equal(pass.ok, true);
  assert.equal(pass.name, "clean");
  const dataOnly = checkNoisyRigidityCertificate({
    visibility: 0.72,
    declaredNoise: 0.05,
    claimedBeta: 2 * SQRT2 * 0.72,
    claimedFidelity: (1 + 3 * 0.72) / 4,
    claimsCertified: false,
  });
  assert.equal(dataOnly.ok, true);
});

test("smuggling trial: a certified fidelity claim above the OBSERVED-correlation bound is killed", () => {
  // the model-inferred fidelity (1+3*0.9)/4 = 0.925 exceeds the proven bound 0.6325 at
  // the observed beta — the noise model may infer a regime, not a certified fidelity
  const betaObs = 2 * SQRT2 * 0.9 * shrinkEta(0.05);
  const verdict = checkNoisyRigidityCertificate({
    visibility: 0.9,
    declaredNoise: 0.05,
    claimedBeta: 2 * SQRT2 * 0.9,
    claimedFidelity: (1 + 3 * 0.9) / 4,
    claimsCertified: true,
  });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.name, "claimed-fidelity-exceeds-proven-bound");
  assert.ok(verdict.detail.includes(`${kaniewskiLowerBound(betaObs)}`));
});

test("smuggling trial: raw-beta certification falling into the COMPENSATED gap is NAMED and killed", () => {
  // v_true = 0.75: raw beta 2.121 > beta* = 2.106 (certified if the detectors were perfect);
  // declared lambda = 0.02 degrades the observation to 2.037: above 2, below beta* — the gap
  const lambda = 0.02;
  const verdict = checkNoisyRigidityCertificate({
    visibility: 0.75,
    declaredNoise: lambda,
    claimedBeta: 2 * SQRT2 * 0.75,
    claimedFidelity: (1 + 3 * 0.75) / 4,
    claimsCertified: true,
  });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.name, "certified-inside-rigidity-gap");
  assert.ok(
    verdict.detail.includes("compensated gate"),
    "the conviction names the compensated gate",
  );
  // the compensated threshold this fraud dodged:
  assert.ok(compensatedBetaStar(lambda) > BETA_STAR);
  assert.ok(2 * SQRT2 * 0.75 < compensatedBetaStar(lambda));
});

test("smuggling trial: declared noise that hides even the violation is killed by its own name", () => {
  const verdict = checkNoisyRigidityCertificate({
    visibility: 0.78,
    declaredNoise: 0.25,
    claimedBeta: 2 * SQRT2 * 0.78,
    claimedFidelity: (1 + 3 * 0.78) / 4,
    claimsCertified: true,
  });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.name, "certified-without-violation");
  assert.ok(2 * SQRT2 * 0.78 * shrinkEta(0.25) <= 2);
});

test("smuggling trial: fidelity above the isotropic barrier and unreproduced beta are killed", () => {
  const barrierFraud = checkNoisyRigidityCertificate({
    visibility: 0.8,
    declaredNoise: 0.05,
    claimedBeta: 2 * SQRT2 * 0.8,
    claimedFidelity: (1 + 3 * 0.8) / 4 + 0.01,
    claimsCertified: false,
  });
  assert.equal(barrierFraud.ok, false);
  assert.equal(barrierFraud.name, "fidelity-above-isotropic-barrier");
  const betaFraud = checkNoisyRigidityCertificate({
    visibility: 0.8,
    declaredNoise: 0.05,
    claimedBeta: 2 * SQRT2 * 0.8 + 0.01,
    claimedFidelity: (1 + 3 * 0.8) / 4,
    claimsCertified: false,
  });
  assert.equal(betaFraud.ok, false);
  assert.equal(betaFraud.name, "claimed-beta-not-reproduced");
});

test("guards: illegal noise, visibility and sweep domains are refused by name", () => {
  assert.throws(() => isotropicNoiseKraus(-0.1), /QV_PROBABILITY/);
  assert.throws(() => isotropicNoiseKraus(1.5), /QV_PROBABILITY/);
  assert.throws(() => shrinkEta(2), /QV_PROBABILITY/);
  assert.throws(() => shiftCensusRow(1.2, 0.1), /QV_PROBABILITY/);
  assert.throws(() => shiftCensusRow(0.5, -1), /QV_PROBABILITY/);
  assert.throws(() => shiftSweep([], [0.1]), /QV_GRID/);
  assert.throws(() => shiftSweep([0.5], []), /QV_GRID/);
});
