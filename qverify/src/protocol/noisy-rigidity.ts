/**
 * T3+ extension (v0.6) — the rigidity window SHIFT under isotropic detector
 * noise, exact.
 *
 * Physical model (stated once, everything else follows): the source emits a
 * Werner state rho_W(v); each qubit then passes a detector front-end modeled
 * by the isotropic (depolarizing) channel with noise lambda,
 *   D_lambda(rho) = (1-lambda) rho + lambda I/2,
 * the same convention as core/channels.ts `depolarize`. Kraus form
 * { sqrt(a) I, sqrt(b) X, sqrt(b) Y, sqrt(b) Z }, a = (4-3lambda)/4,
 * b = lambda/4 (TP exact; bit-equal to the affine form on qubit inputs).
 *
 * Theorem (machine-checked below, every number recomputed from the state):
 *  (S1) Correlation homogeneity: Lambda x Lambda acts on the Horodecki
 *       correlation matrix as T -> eta(lambda) T with eta = (1-lambda)^2
 *       (each qubit's Bloch vector shrinks by (1-lambda); the correlation
 *       is a product). Horodecki's S_max = 2 sqrt(u1+u2) is homogeneous of
 *       degree 1 in T, hence
 *         S_max((Lambda x Lambda)[rho_W(v)]) = 2 sqrt(2) v eta(lambda) EXACT.
 *  (S2) Werner closure: (Lambda x Lambda)[rho_W(v)] = rho_W(v eta) as
 *       matrices (worst entry deviation <= 1e-15 on the grid) — the family
 *       is closed under the noisy front-end, so EVERY closed form of the
 *       noiseless census (fidelity (1+3v)/4, PPT min eigenvalue, regime)
 *       transfers verbatim at the delivered visibility v*eta.
 *  (S3) Regime shift: the four-regime classification of the delivered state
 *       is rigidityRegime(v eta); in RAW visibility the boundaries sit at
 *       b/eta for b in {1/3, 1/sqrt(2), v*}. The PPT boundary lands exactly
 *       at v = 1/(3 eta) (min eigenvalue 0 to machine precision).
 *  (S4) Window closing: eta < v* (lambda > 1 - sqrt(v*)) CLOSES certification
 *       — no Werner device can deliver an observed violation above beta*;
 *       eta < 1/3 (lambda > 1 - 1/sqrt(3)) closes entanglement itself.
 *  (S5) Compensated certification gate: a certificate that DECLARES detector
 *       noise lambda and claims rigidity is re-judged on the OBSERVED
 *       correlations beta_obs = beta_true * eta — the only value a proven
 *       bound consumes — so in TRUE-state coordinates the certification bar
 *       moves beta-star to beta-star-over-eta (the compensated threshold).
 *       The certified FIDELITY claim stays capped by the proven bound
 *       evaluated at beta_obs (the noiseless discipline, unchanged: what the
 *       observed data proves is all a certificate may claim). The noise model
 *       buys only the REGIME inference v_true = v_obs / eta, never a higher
 *       certified fidelity — that weaker, model-dependent number is reported
 *       as data (the census rows), not as a certified claim.
 *
 * Smuggling referee: certificates that certify on the RAW beta while their
 * declared noise pushes the observed beta into the local window or the
 * rigidity gap are NAMED and killed. Fraud names are SHARED with the noiseless
 * referee ('certified-without-violation', 'certified-inside-rigidity-gap') so
 * lambda = 0 reduces the referee verbatim; the shift-specific content (the
 * observed beta, the compensated gate beta-star-over-eta) lives in the detail.
 *
 * Honest boundary: the closed forms cover the ISOTROPIC shrink family only —
 * a single-axis dephasing front-end (phase damping) shrinks T by different
 * factors per axis, the Werner family is not closed under it, and no shift
 * closed form is claimed there. lambda = 0 reduces every face to the
 * noiseless referee (machine anchor).
 */

import { type CMat, mScale, identity, kron } from "../core/cmat.js";
import { wernerFidelity, PAULI_X, PAULI_Y, PAULI_Z } from "../core/states.js";
import { applyKraus } from "../core/channels.js";
import { horodeckiSMax, correlationT, pptMinEigenvalue } from "./chsh.js";
import {
  rigidityRegime,
  BETA_STAR,
  V_STAR,
  isotropicBeta,
  kaniewskiLowerBound,
  type RigidityRegime,
  type CertificateVerdict,
} from "./selftest.js";

/**
 * Kraus operators of the isotropic detector-noise channel D_lambda =
 * (1-lambda) rho + lambda I/2 (the `depolarize` convention, single qubit).
 * lambda = 0 is the identity; lambda = 1 fully depolarizes to I/2.
 */
export function isotropicNoiseKraus(lambda: number): CMat[] {
  if (!(lambda >= 0 && lambda <= 1)) {
    throw new Error(
      `QV_PROBABILITY: isotropicNoiseKraus lambda must be in [0,1], got ${lambda}`,
    );
  }
  const a = Math.sqrt((4 - 3 * lambda) / 4);
  const b = Math.sqrt(lambda / 4);
  return [
    mScale(identity(2), a),
    mScale(PAULI_X, b),
    mScale(PAULI_Y, b),
    mScale(PAULI_Z, b),
  ];
}

/** Correlation shrink factor eta(lambda) = (1-lambda)^2 of Lambda x Lambda. */
export function shrinkEta(lambda: number): number {
  if (!(lambda >= 0 && lambda <= 1)) {
    throw new Error(
      `QV_PROBABILITY: shrinkEta lambda must be in [0,1], got ${lambda}`,
    );
  }
  return (1 - lambda) * (1 - lambda);
}

/** The delivered state (Lambda x Lambda)[rho_W(v)] — 16 Kraus terms, exact. */
export function deliveredState(visibility: number, lambda: number): CMat {
  const one = isotropicNoiseKraus(lambda);
  const both: CMat[] = [];
  for (const kj of one) {
    for (const kk of one) both.push(kron(kj, kk));
  }
  return applyKraus(wernerFidelity(visibility), both);
}

export interface ShiftCensusRow {
  visibility: number;
  noise: number;
  /** eta(lambda) = (1-lambda)^2 */
  eta: number;
  /** Horodecki S_max recomputed from the delivered state */
  betaNoisy: number;
  /** the closed form 2 sqrt(2) v eta (S1) */
  betaClosed: number;
  /** || delivered - rho_W(v*eta) ||_1 (S2 closure residual) */
  closureResidual: number;
  /** max_ij |T_delivered - eta T_clean| (S1 homogeneity residual) */
  correlationResidual: number;
  pptMin: number;
  /** regime of the DELIVERED state = rigidityRegime(v*eta) (S3) */
  regime: RigidityRegime;
}

/** One census row at (v, lambda): every number recomputed from the state. */
export function shiftCensusRow(
  visibility: number,
  lambda: number,
): ShiftCensusRow {
  if (!(visibility >= 0 && visibility <= 1)) {
    throw new Error(
      `QV_PROBABILITY: shiftCensusRow visibility must be in [0,1], got ${visibility}`,
    );
  }
  const eta = shrinkEta(lambda);
  const rho = wernerFidelity(visibility);
  const delivered = deliveredState(visibility, lambda);
  const tNoisy = correlationT(delivered);
  const tClean = correlationT(rho);
  let correlationResidual = 0;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      correlationResidual = Math.max(
        correlationResidual,
        Math.abs(tNoisy[i]![j]! - eta * tClean[i]![j]!),
      );
    }
  }
  const target = wernerFidelity(visibility * eta);
  let closureResidual = 0;
  for (let k = 0; k < delivered.re.length; k++) {
    closureResidual +=
      Math.abs(delivered.re[k]! - target.re[k]!) +
      Math.abs(delivered.im[k]! - target.im[k]!);
  }
  return {
    visibility,
    noise: lambda,
    eta,
    betaNoisy: horodeckiSMax(delivered),
    betaClosed: isotropicBeta(visibility) * eta,
    closureResidual,
    correlationResidual,
    pptMin: pptMinEigenvalue(delivered),
    regime: rigidityRegime(visibility * eta),
  };
}

/** Worst residuals of (S1)-(S3) over the (v, lambda) grid. */
export function shiftSweep(
  visibilities: readonly number[],
  noises: readonly number[],
): {
  worstBetaGap: number;
  worstClosure: number;
  worstCorrelation: number;
} {
  if (visibilities.length < 1 || noises.length < 1) {
    throw new Error(
      "QV_GRID: shiftSweep needs at least one visibility and one noise value",
    );
  }
  const out = { worstBetaGap: 0, worstClosure: 0, worstCorrelation: 0 };
  for (const v of visibilities) {
    for (const lambda of noises) {
      const row = shiftCensusRow(v, lambda);
      out.worstBetaGap = Math.max(
        out.worstBetaGap,
        Math.abs(row.betaNoisy - row.betaClosed),
      );
      out.worstClosure = Math.max(out.worstClosure, row.closureResidual);
      out.worstCorrelation = Math.max(
        out.worstCorrelation,
        row.correlationResidual,
      );
    }
  }
  return out;
}

export interface RawBoundaries {
  eta: number;
  /** raw visibility at which the delivered state hits the separable boundary: 1/(3 eta) */
  separable: number;
  /** raw visibility at which the delivered state starts to violate CHSH: 1/(sqrt(2) eta) */
  local: number;
  /** raw visibility at which the observed beta clears beta-star: v-star-over-eta (the compensated gate) */
  kaniewski: number;
}

/**
 * Regime boundaries in RAW visibility coordinates (S3): each noiseless
 * boundary b sits at b/eta. Values > 1 mean the boundary is out of physical
 * reach at this noise — the regime beyond it is closed (S4).
 */
export function rawRegimeBoundaries(lambda: number): RawBoundaries {
  const eta = shrinkEta(lambda);
  return {
    eta,
    separable: 1 / (3 * eta),
    local: 1 / (Math.SQRT2 * eta),
    kaniewski: V_STAR / eta,
  };
}

/** Noise above which NO Werner device can deliver a certifiable violation (eta < v*). */
export const CERT_CLOSING_NOISE: number = 1 - Math.sqrt(V_STAR);
/** Noise above which every delivered Werner state is separable (eta < 1/3). */
export const ENTANGLE_CLOSING_NOISE: number = 1 - 1 / Math.sqrt(3);

/** The compensated certification threshold: beta-star over eta(lambda), in TRUE beta coordinates. */
export function compensatedBetaStar(lambda: number): number {
  return BETA_STAR / shrinkEta(lambda);
}

export interface NoisyRigidityCertificate {
  /** claimed TRUE (pre-front-end) visibility of the source state */
  visibility: number;
  /** the detector noise the certificate declares (isotropic, per qubit) */
  declaredNoise: number;
  /** the S the certificate claims for the true state */
  claimedBeta: number;
  /** the |Phi+> fidelity the certificate claims for the true state */
  claimedFidelity: number;
  /** the certificate asserts "rigidity certified" */
  claimsCertified: boolean;
}

/**
 * Smuggling trial referee for declared-noise rigidity certificates. Every
 * claimed number is recomputed from the claimed visibility; certification is
 * re-judged on the OBSERVED correlations beta_obs = 2 sqrt(2) v eta (the only
 * value a proven bound consumes). The checker NAMES the specific fraud.
 */
export function checkNoisyRigidityCertificate(
  cert: NoisyRigidityCertificate,
): CertificateVerdict {
  const eta = shrinkEta(cert.declaredNoise);
  const betaTrue = isotropicBeta(cert.visibility);
  const betaObs = betaTrue * eta;
  if (Math.abs(cert.claimedBeta - betaTrue) > 1e-9) {
    return {
      ok: false,
      name: "claimed-beta-not-reproduced",
      detail: `certificate claims S=${cert.claimedBeta} for the true state but v=${cert.visibility} gives S=${betaTrue}`,
    };
  }
  const barrier = (1 + 3 * cert.visibility) / 4;
  if (cert.claimedFidelity > barrier + 1e-12) {
    return {
      ok: false,
      name: "fidelity-above-isotropic-barrier",
      detail: `certificate claims F=${cert.claimedFidelity} but the isotropic device at v=${cert.visibility} has exactly F=${barrier} — no device at this visibility can do better`,
    };
  }
  if (cert.claimsCertified) {
    if (betaObs <= 2) {
      return {
        ok: false,
        name: "certified-without-violation",
        detail: `declared noise lambda=${cert.declaredNoise} (eta=${eta}) degrades the observed correlations to S_obs=${betaObs} <= 2 — the detectors do not even see a violation`,
      };
    }
    if (betaObs <= BETA_STAR) {
      return {
        ok: false,
        name: "certified-inside-rigidity-gap",
        detail: `certified on the raw S=${betaTrue} but the observed correlations are S_obs=${betaObs} <= beta*=${BETA_STAR} (compensated gate beta*/eta=${BETA_STAR / eta}): every proven bound on the data the detectors actually saw is still the trivial 1/2`,
      };
    }
    const proven = kaniewskiLowerBound(betaObs);
    if (cert.claimedFidelity > proven + 1e-12) {
      return {
        ok: false,
        name: "claimed-fidelity-exceeds-proven-bound",
        detail: `at the OBSERVED S_obs=${betaObs} the proven extractability bound is ${proven}; the certificate claims F=${cert.claimedFidelity} — the noise model may infer a regime, but a certified fidelity claim rides the observed correlations only (raw-S inference is not additional evidence)`,
      };
    }
  }
  return {
    ok: true,
    name: "clean",
    detail:
      "claimed numbers recomputed; certification re-judged on the observed correlations",
  };
}
