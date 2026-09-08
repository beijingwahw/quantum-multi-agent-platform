/**
 * Verification-tier routing for a scheduler handing work to remote QPUs —
 * the verification-side sibling of the platform's NISQ/FTQC/classical
 * execution-tier router.
 *
 * Tiers (each backed by a machine-verified theorem layer in this repo):
 *  - local-exact  : small circuits — replay exactly on the trusted local
 *                   engine; trust nothing, verify everything (cost 2ⁿ).
 *  - trap-ubqc    : server exposes a UBQC interface — blindness (T1: zero
 *                   leakage identity) + trap detection (T2: exact three-tier
 *                   algebra, ≥ ½ per touched trap, exponential in trap count).
 *  - statistical  : large sampling circuits — shadows/mirror/XEB (T4).
 *                   Spoofable: a cut-spoof demo passes with F_XEB > 0 —
 *                   cross-checks mandatory, only fidelity-type conclusions.
 *  - classical-verifier : Mahadev-class (LWE) classical client — roadmap,
 *                   cited, not implemented here.
 */

export type VerificationTier = 'local-exact' | 'trap-ubqc' | 'statistical' | 'classical-verifier';

export interface VerifyRequest {
  qubits: number;
  /** two-qubit gate count of the submitted circuit */
  twoQubitGates: number;
  /** does the backend expose a blind-MBQC (UBQC) interface? */
  ubqcInterface: boolean;
  /** sampling task (many output samples) vs single-shot computation */
  sampling: boolean;
}

export interface TierDecision {
  tier: VerificationTier;
  rationale: string;
  /** expected detection per dishonest round when applicable */
  detectionPerRound?: number;
}

/** Exact-replay cost heuristic: statevector replay ≈ c·2ⁿ; deemed affordable up to ~2²⁴. */
export function exactReplayAffordable(qubits: number): boolean {
  return qubits <= 24;
}

export function routeVerification(req: VerifyRequest): TierDecision {
  if (!Number.isInteger(req.qubits) || req.qubits < 1) {
    throw new Error(`QV_QUBITS: routeVerification needs >=1 qubit, got ${req.qubits}`);
  }
  if (!req.sampling && exactReplayAffordable(req.qubits)) {
    return {
      tier: 'local-exact',
      rationale: `n=${req.qubits} ≤ 24: replay on the trusted local exact engine; the remote answer is only accepted after bit-exact agreement`,
    };
  }
  if (req.ubqcInterface) {
    const trapFraction = 0.5; // half the graph is traps/dummies in the FK layout
    const perRound = 1 - 0.5 ** Math.max(1, Math.round(trapFraction * req.qubits));
    return {
      tier: 'trap-ubqc',
      rationale: 'UBQC interface available: blindness is unconditional (T1) and trap rejection is ≥ 1/2 per touched trap (T2)',
      detectionPerRound: perRound,
    };
  }
  if (req.sampling || req.qubits > 24) {
    return {
      tier: 'statistical',
      rationale:
        'no UBQC interface and exact replay unaffordable: shadow/mirror/XEB certification (T4) — reports fidelity-type evidence only; a cut-spoof passes XEB, so pair with cross-platform checks',
    };
  }
  return {
    tier: 'classical-verifier',
    rationale: 'roadmap tier: Mahadev-class classical verification under LWE (cited), not implemented',
  };
}
