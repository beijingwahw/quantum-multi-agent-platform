/**
 * The sensor layer (v0.2): what a scheduler on real hardware is allowed to
 * know, and the guards that keep the oracle out of it.
 *
 * Information contract (docs/theory.md §10):
 *   LEGAL (classical layer): heralded event timestamps (creation rounds),
 *     swap/purification outcomes, topology and request specs, and estimates
 *     derived from destructive calibration tomography recorded through this
 *     bank.
 *   CONTRABAND (quantum layer): the true Bell vector of any live pair, the
 *     true link fidelity f0, the true memory constant T₂.
 *
 * Under a SensorPlan the engine keeps truth for physics but hands policies a
 * BELIEF MIRROR propagated from these estimates (generation → werner(f0hat),
 * swap → belief XOR-convolution, purification → belief recurrence, aging →
 * believed T₂). Two guards make smuggling mechanically detectable:
 *   1. ILLEGAL_SAMPLE_SOURCE — the estimator bank accepts samples only with
 *      tokens minted by its own measurement channel ('calibration-sacrifice').
 *   2. QOS_CLAIM_VIOLATION — auditQosClaims re-checks every claimed-good
 *      delivery against the true fidelity the physics engine recorded.
 */

import { SchedError, type CodedError } from "../core/errors.js";
import type { Rng } from "../core/rng.js";

/** √6 as a module constant (sd of the unit triangular sum below). */
const SQRT6 = Math.sqrt(6); // IEEE-exact, platform-stable

/**
 * Destructive tomography noise: symmetric triangular on [−σ√6, σ√6), sd = σ.
 * Built from two uniforms only (no libm transcendentals) so sensor runs stay
 * bit-reproducible across platforms, like everything else in this repo.
 */
export function triangularNoise(rng: Rng, sigma: number): number {
  if (!Number.isFinite(sigma) || sigma < 0)
    throw new SchedError("SENSOR_BAD_SIGMA", `sigma=${sigma} is negative or not finite (noise scale must be ≥ 0)`);
  const u = rng.next() + rng.next() - 1; // triangular on [−1, 1), sd = 1/√6
  return sigma * SQRT6 * u;
}

/**
 * Named rejection for contraband entering the sensor layer. Implements the
 * repo-wide CodedError contract: `code` is machine-checkable and the message
 * is exactly `${code}: ${detail}`.
 */
export class SensorGuardError extends Error implements CodedError {
  readonly code: string;

  constructor(code: string, detail: string) {
    super(`${code}: ${detail}`);
    this.name = "SensorGuardError";
    this.code = code;
  }
}

/** Provenance tag accompanying every fidelity sample into the bank. */
export interface SampleToken {
  readonly kind: string;
  readonly seq: number;
}

/** The single legal sample provenance: destructive calibration of a fresh pair. */
export const LEGAL_SAMPLE_KIND = "calibration-sacrifice";

/** Datasheet belief before the first calibration sample on a link. */
export const PRIOR_F0 = 0.9;
/** Stated uncertainty of the datasheet belief (also the se fallback at n ≤ 1). */
export const PRIOR_SE = 0.05;

interface LinkAcc {
  n: number;
  mean: number;
  m2: number;
  lastRound: number;
}

export interface F0Estimate {
  /** Point estimate (lowered by zMargin·se when the bank is conservative). */
  readonly hatF: number;
  /** Standard error of the mean (PRIOR_SE before any / a single sample). */
  readonly se: number;
  readonly n: number;
}

/**
 * Per-link running estimate of the elementary-pair fidelity f0 (Welford).
 * zMargin = 0 → naive posterior mean; zMargin = 2 → ~95% lower confidence
 * bound: statistical margins that shrink like 1/√n (they cannot absorb a
 * systematic tomography bias — measured in exp6).
 */
export class LinkF0Bank {
  private readonly acc = new Map<string, LinkAcc>();
  private minted = 0;

  constructor(readonly zMargin = 0) {}

  /** The only mint of legal sample tokens: the measurement channel itself. */
  freshToken(): SampleToken {
    return { kind: LEGAL_SAMPLE_KIND, seq: this.minted++ };
  }

  recordSample(token: SampleToken, linkId: string, round: number, value: number): void {
    if (token.kind !== LEGAL_SAMPLE_KIND) {
      throw new SensorGuardError(
        "ILLEGAL_SAMPLE_SOURCE",
        `token kind '${token.kind}' (seq ${token.seq}) on link '${linkId}' — the estimator bank accepts only '${LEGAL_SAMPLE_KIND}' tomography of freshly generated pairs; oracle readings, heralded-outcome sidelines, and forged values are contraband (docs/theory.md §10)`
      );
    }
    // Raw tomography readings may be unphysical (bias + noise can push a
    // 0.99-fidelity reading past 1.0); the ESTIMATE is clamped to [0,1] on
    // use. A reading outside [0,2] cannot come from any plausible tomograph.
    if (!Number.isFinite(value) || value < 0 || value > 2) {
      throw new SensorGuardError("ILLEGAL_SAMPLE_VALUE", `${value} is not a fidelity reading`);
    }
    const a = this.acc.get(linkId);
    if (a) {
      const d1 = value - a.mean;
      a.mean += d1 / (a.n + 1);
      a.m2 += d1 * (value - a.mean);
      a.n += 1;
      a.lastRound = round;
    } else {
      this.acc.set(linkId, { n: 1, mean: value, m2: 0, lastRound: round });
    }
  }

  estimate(linkId: string): F0Estimate {
    const a = this.acc.get(linkId);
    if (!a || a.n === 0) return { hatF: PRIOR_F0, se: PRIOR_SE, n: 0 };
    const se = a.n >= 2 ? Math.sqrt(a.m2 / (a.n - 1) / a.n) : PRIOR_SE;
    const hatF = Math.min(1, Math.max(0, a.mean - this.zMargin * se));
    return { hatF, se, n: a.n };
  }

  /** Links with at least one recorded sample (report rendering). */
  sampledLinks(): string[] {
    return [...this.acc.entries()].filter(([, a]) => a.n > 0).map(([id]) => id);
  }
}

/**
 * One released delivery: what the scheduler believed vs what the physics
 * engine measured. The audit ledger is the certificate a QoS claim has to
 * survive.
 */
export interface QosClaim {
  readonly owner: string;
  readonly round: number;
  /** Believed fidelity at release (the gate the scheduler actually used). */
  readonly claimedF: number;
  /** True fidelity at release (physics referee, never shown to policies). */
  readonly trueF: number;
}

export interface QosAudit {
  readonly ok: boolean;
  readonly violations: readonly QosClaim[];
  readonly claimedGood: number;
  readonly message: string;
}

/**
 * Audit a release ledger: every delivery that CLAIMED good (claimedF ≥ fMin)
 * must truly be good (trueF ≥ fMin). Below-claim deliveries (policies that
 * knowingly release below grade) are not violations — they never claimed.
 */
export function auditQosClaims(claims: readonly QosClaim[], fMin: number, fromRound = 0): QosAudit {
  if (!Number.isFinite(fMin) || fMin < 0 || fMin > 1)
    throw new SchedError("QOS_AUDIT_BAD_FMIN", `fMin=${fMin} outside [0,1] — not a fidelity threshold`);
  const window = claims.filter((c) => c.round >= fromRound);
  const claimedGood = window.filter((c) => c.claimedF >= fMin - 1e-12);
  const violations = claimedGood.filter((c) => c.trueF < fMin - 1e-12);
  if (violations.length === 0) {
    return {
      ok: true,
      violations,
      claimedGood: claimedGood.length,
      message: `QOS_AUDIT_OK: ${claimedGood.length} claimed-good deliveries, all truly ≥ fMin=${fMin}`,
    };
  }
  const worst = violations.reduce((w, c) => (c.trueF < w.trueF ? c : w), violations[0]!);
  return {
    ok: false,
    violations,
    claimedGood: claimedGood.length,
    message: `QOS_CLAIM_VIOLATION: ${violations.length}/${claimedGood.length} claimed-good deliveries are truly below fMin=${fMin} (worst: owner ${worst.owner} round ${worst.round} claimed F ${worst.claimedF.toFixed(4)} vs true F ${worst.trueF.toFixed(4)})`,
  };
}

/** How the engine builds the belief mirror; also the robustness axes of exp6. */
export interface SensorPlan {
  readonly bank: LinkF0Bank;
  /** Fraction of successfully generated pairs destructively measured (cost). */
  readonly calibRate: number;
  /** Tomography noise sd (triangular). */
  readonly tomoSigma: number;
  /** Systematic tomography miscalibration added to every reading (default 0). */
  readonly tomoBias?: number;
  /** Scheduler's believed memory constant; default = the true net T₂. */
  readonly t2Belief?: number;
  /** When present, every delivery is appended (the QoS audit ledger). */
  readonly ledger?: QosClaim[];
}

/** Strict form of the audit: throws the named rejection instead of reporting. */
export function assertNoQosViolations(claims: readonly QosClaim[], fMin: number, fromRound = 0): void {
  const audit = auditQosClaims(claims, fMin, fromRound);
  if (!audit.ok) {
    // audit messages open with their code ("QOS_CLAIM_VIOLATION: ...") — split
    // it back out so the thrown error satisfies the CodedError contract
    const sep = audit.message.indexOf(": ");
    throw new SensorGuardError(audit.message.slice(0, sep), audit.message.slice(sep + 2));
  }
}
