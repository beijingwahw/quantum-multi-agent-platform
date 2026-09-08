/**
 * The erasure-boundary census (exp2's honest boundary, executed).
 *
 * exp2-privacy's transcript claim holds only under a retention schedule —
 * "erasure is an auditable operational assumption, not a theorem". This
 * module replaces ideal erasure/ideal channels with PARAMETERIZED physical
 * channels — dephasing (phase-flip) and amplitude damping at strength γ on
 * every payload qubit — and machine-measures which mechanism properties
 * SURVIVE, DEGRADE, or DROWN:
 *
 *  R1. hiding of the locked ensembles: χ of {N_γ(ρ_v)} for wiesner vs otp
 *      modes (exact — the channel commutes with the key average);
 *  R2. the otp invariance law: ρ_v identical across v ⟹ χ = 0 under ANY
 *      CPTP noise — machine-verified per (channel, γ), not just asserted;
 *  R3. unlock correctness: key-holder readout bit-error rate under noise
 *      (density-matrix Monte Carlo, seeded);
 *  R4. interceptor detectability: flip-rate separation between an honest
 *      noisy run and an intercept-plus-noisy run — the noise floor inside
 *      which a pre-deadline eavesdropper becomes invisible;
 *  R5. HJW concealment/steering/reveal under noise on the verifier's qubit:
 *      I/2 is a fixed point of both channels here, but the naive protocol's
 *      reveal pass rates are NOT channel-flat.
 *
 * Every measured number comes from the exact ensembles (R1/R2/R5) or a
 * seeded Monte Carlo over exact density matrices (R3/R4).
 */

import { type CMat, type CVec, kronAll, identity } from '../core/cmat.js';
import { applyKraus, applyQubitChannel, applyUnitary, amplitudeDampKraus, marginalProbs, partialTrace, phaseFlipKraus } from '../core/channels.js';
import { holevo, fidelity, traceDistance, type EnsembleItem } from '../core/measures.js';
import { fromVec, KET0, PLUS, RPLUS, LPLUS, maximallyMixed } from '../core/states.js';
import { type LockMode, lockedEnsemble, lockValue, interceptMeasureResend, lockStateVector, basisUnitary, dagger2 } from './locking.js';
import { conjVec, PSI_Z1, PSI_X1 } from '../contract/hjw.js';
import { makeRng, type Rng } from '../core/rng.js';
import { type Verification } from './datalock.js';

export type NoiseName = 'dephase' | 'ampdamp';

export function noiseKraus(noise: NoiseName, gamma: number): CMat[] {
  if (noise === 'dephase') return phaseFlipKraus(gamma);
  return amplitudeDampKraus(gamma);
}

// ---------------------------------------------------------------------------
// R1/R2: exact Holevo χ of the noisy locked ensembles.
// ---------------------------------------------------------------------------

/** χ (bits) of the auctioneer's ensemble {N_γ(ρ_v)} over all 2^m payloads:
 * the hiding quality of the lock when the register sits in a noisy memory. */
export function noisyLockedHolevo(m: number, nBases: 2 | 3, mode: LockMode, noise: NoiseName, gamma: number): number {
  const kraus = noiseKraus(noise, gamma);
  const items: EnsembleItem[] = [];
  const count = 2 ** m;
  for (let v = 0; v < count; v++) {
    const rho = applyQubitChannel(lockedEnsemble(v, m, nBases, mode), m, kraus);
    items.push({ key: String(v), state: rho, weight: 1 / count });
  }
  return holevo(items);
}

/** The otp invariance law as a machine fact: identical ensemble states stay
 * identical under any CPTP map, so χ must stay 0 for every (channel, γ). */
export function otpInvarianceDefect(m: number, noise: NoiseName, gamma: number): number {
  // worst entrywise gap between the noisy ρ_v across payloads (otp mode)
  const kraus = noiseKraus(noise, gamma);
  const count = 2 ** m;
  const states: CMat[] = [];
  for (let v = 0; v < count; v++) states.push(applyQubitChannel(lockedEnsemble(v, m, 3, 'otp'), m, kraus));
  let worst = 0;
  for (let v = 1; v < count; v++) {
    for (let k = 0; k < states[0]!.re.length; k++) {
      worst = Math.max(
        worst,
        Math.abs(states[0]!.re[k]! - states[v]!.re[k]!),
        Math.abs(states[0]!.im[k]! - states[v]!.im[k]!),
      );
    }
  }
  return worst;
}

// ---------------------------------------------------------------------------
// R3/R4: seeded density-matrix Monte Carlo of unlock checks under noise.
// ---------------------------------------------------------------------------

/** One trial: lock a random payload, optionally intercept, then let the
 * register pass through the channel; unlock with the true key by rotating to
 * the key basis and reading the computational-basis marginals. Returns the
 * number of flipped payload bits. */
export function noisyUnlockErrors(
  m: number,
  nBases: 2 | 3,
  mode: LockMode,
  noise: NoiseName,
  gamma: number,
  rng: Rng,
  intercept: boolean,
): number {
  if (!Number.isInteger(m) || m < 1) {
    throw new Error(`ROBUST01-bad-m: noisyUnlockErrors needs integer m >= 1, got ${m}`);
  }
  const v = rng.int(2 ** m);
  const lock = lockValue(v, m, rng, nBases, mode);
  if (intercept) interceptMeasureResend(lock, rng, nBases);
  let rho = fromVec(lockStateVector(lock));
  rho = applyQubitChannel(rho, m, noiseKraus(noise, gamma));
  // rotate the whole register back into the key basis
  const rot = kronAll(lock.bases.map((b) => basisUnitary(b)).map((u) => dagger2(u)));
  rho = applyUnitary(rho, rot);
  let errors = 0;
  for (let q = 0; q < m; q++) {
    const { probs } = marginalProbs(rho, new Array<number>(m).fill(2), [q]);
    const outcome = rng() < probs[1]! ? 1 : 0;
    let bit = outcome;
    if (mode === 'otp') bit ^= lock.pads[q]!;
    if (bit !== ((v >> q) & 1)) errors++;
  }
  return errors;
}

export interface SeparationStats {
  trials: number;
  honestFlipRate: number;
  interceptFlipRate: number;
  /** intercept flip rate minus honest flip rate: the detection signal */
  separation: number;
}

/** R4: the noise floor. Compare per-qubit flip rates of honest-but-noisy
 * runs against intercept-plus-noisy runs; when the separation drowns, the
 * information-disturbance claim of exp2 section B no longer detects anyone. */
export function interceptSeparation(
  trials: number,
  m: number,
  nBases: 2 | 3,
  noise: NoiseName,
  gamma: number,
  rng: Rng,
): SeparationStats {
  let honest = 0;
  let intercept = 0;
  for (let t = 0; t < trials; t++) {
    honest += noisyUnlockErrors(m, nBases, 'wiesner', noise, gamma, rng, false);
    intercept += noisyUnlockErrors(m, nBases, 'wiesner', noise, gamma, rng, true);
  }
  const honestFlipRate = honest / (trials * m);
  const interceptFlipRate = intercept / (trials * m);
  return { trials, honestFlipRate, interceptFlipRate, separation: interceptFlipRate - honestFlipRate };
}

// ---------------------------------------------------------------------------
// R5: HJW under noise on the verifier's qubit (qubit 0 of |Φ+⟩).
// ---------------------------------------------------------------------------

export interface HjwNoiseReport {
  /** T(N_γ(ρ_V), I/2): concealment defect during commit */
  concealment: number;
  /** max |p(ψ) − 1/2| over the three steering bases, both members */
  steeringProbDev: number;
  /** mean conditional fidelity of V's collapsed state with the steered target */
  meanConditionalFidelity: number;
  /** naive-protocol honest reveal pass rates for bits 0 (|0⟩) and 1 (|+⟩) */
  revealPass: [number, number];
}

// The R5 demonstration states: Z0/X0 from the states.ts canon, Z1/X1 the
// hjw.ts closed-form literals (byte-identical to this module's former local
// copies), Y pair the states.ts RPLUS/LPLUS constants.
const PSI_Z0 = KET0;
const PSI_X0 = PLUS;

/** Noise on the verifier's qubit (qubit 0) of |Φ+⟩, then the steering
 * analysis: committer measures qubit 1 in {Z, X, Y}, probabilities shift,
 * conditional fidelities degrade, reveal pass rates drop below 1. */
export function hjwUnderNoise(noise: NoiseName, gamma: number): HjwNoiseReport {
  const phiPlus = fromVec({
    n: 4,
    re: Float64Array.of(Math.SQRT1_2, 0, 0, Math.SQRT1_2),
    im: new Float64Array(4),
  });
  const I2 = identity(2);
  const embedded = noiseKraus(noise, gamma).map((k) => kronAll([k, I2]));
  const noisy = applyKraus(phiPlus, embedded);
  const vMarginal = partialTrace(noisy, [2, 2], [1]);
  const Ihalf = maximallyMixed(2);
  const concealment = traceDistance(vMarginal, Ihalf);

  const members = [
    [PSI_Z0, PSI_Z1],
    [PSI_X0, PSI_X1],
    [RPLUS, LPLUS],
  ];
  let probDev = 0;
  let fidSum = 0;
  let fidCount = 0;
  for (const pair of members) {
    for (const psi of pair) {
      // projector |ψ⟩⟨ψ| on qubit 1 = I ⊗ |ψ⟩⟨ψ|
      const proj = kronAll([I2, fromVec(psi)]);
      const applied = applyKraus(noisy, [proj]);
      const p = applied.re[0]! + applied.re[5]! + applied.re[10]! + applied.re[15]!;
      if (p > 1e-15) {
        const conditional: CMat = {
          rows: 4,
          cols: 4,
          re: applied.re.map((x) => x / p),
          im: applied.im.map((x) => x / p),
        };
        const vQubit = partialTrace(conditional, [2, 2], [1]);
        fidSum += fidelity(vQubit, fromVec(conjVec(psi)));
        fidCount++;
      }
      probDev = Math.max(probDev, Math.abs(p - 0.5));
    }
  }
  // naive-protocol reveal: honest committer sends |ψ_b⟩, verifier's qubit
  // passes through the channel, reveal measures against ψ_b
  const passRate = (psi: CVec): number => {
    const rho = applyKraus(fromVec(psi), noiseKraus(noise, gamma));
    const proj = fromVec(psi);
    const applied = applyKraus(rho, [proj]);
    return applied.re[0]! + applied.re[3]!;
  };
  return {
    concealment,
    steeringProbDev: probDev,
    meanConditionalFidelity: fidCount > 0 ? fidSum / fidCount : 0,
    revealPass: [passRate(PSI_Z0), passRate(PSI_X0)],
  };
}

// ---------------------------------------------------------------------------
// Robustness-table verification (the anti-smuggling referee).
// ---------------------------------------------------------------------------

export type RobustnessMetric = 'chiOtp' | 'chiWiesner' | 'concealmentHjw' | 'unlockError';

export interface RobustnessClaim {
  metric: RobustnessMetric;
  m?: number;
  nBases?: 2 | 3;
  noise: NoiseName;
  gamma: number;
  /** claimed measured value */
  value: number;
}

function computeClaim(c: RobustnessClaim, rng: Rng): number {
  const m = c.m ?? 2;
  const nBases = c.nBases ?? 3;
  switch (c.metric) {
    case 'chiOtp':
      return noisyLockedHolevo(m, 3, 'otp', c.noise, c.gamma);
    case 'chiWiesner':
      return noisyLockedHolevo(m, nBases, 'wiesner', c.noise, c.gamma);
    case 'concealmentHjw':
      return hjwUnderNoise(c.noise, c.gamma).concealment;
    case 'unlockError': {
      let errors = 0;
      for (let t = 0; t < 2000; t++) errors += noisyUnlockErrors(m, nBases, 'wiesner', c.noise, c.gamma, rng, false);
      return errors / (2000 * m);
    }
  }
}

/** Re-measure every claimed robustness number from scratch. Deterministic
 * metrics (chiOtp, chiWiesner, concealmentHjw) must match to 1e-9; the
 * Monte-Carlo unlockError is re-run at fixed seed and must match to 5e-3.
 * A table row that was never measured does not survive this referee. */
export function verifyRobustnessClaim(claim: RobustnessClaim, seed = 777): Verification {
  if (!Number.isFinite(claim.gamma) || claim.gamma < 0 || claim.gamma > 1) {
    return { ok: false, code: 'REF10-gamma-range', detail: `gamma ${claim.gamma} outside [0,1]` };
  }
  const tol = claim.metric === 'unlockError' ? 5e-3 : 1e-9;
  const measured = computeClaim(claim, makeRng(seed));
  if (Math.abs(measured - claim.value) > tol) {
    return {
      ok: false,
      code: 'REF11-fabricated-value',
      detail: `${claim.metric}/${claim.noise}/γ=${claim.gamma}: claimed ${claim.value}, re-measured ${measured.toFixed(6)}`,
    };
  }
  return { ok: true };
}

