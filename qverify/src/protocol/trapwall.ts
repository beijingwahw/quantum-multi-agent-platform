/**
 * The trap-budget wall (G2-a, v0.5): the exact sample price of separating an
 * honest noisy server from an idMass-bounded attacker, as a closed-form
 * two-point Cramér budget over the existing samplewall engine.
 *
 * (TB-a) ENGINE ANCHOR. cramerRate(values, probs, tau) is the generic
 * Legendre-transform engine over an arbitrary finite exact distribution. On a
 * two-point distribution X ∈ {0,1}, P(X=1) = p, its upper-tail rate at τ > p
 * collapses to the binary Kullback–Leibler divergence
 *     I(τ) = D(τ‖p) = τ ln(τ/p) + (1−τ) ln((1−τ)/(1−p)),
 * and the lower-tail rate at τ < p is the dual of the flipped variable 1−X
 * (cramerRate([0,1],[p,1−p],1−τ)). This is an independent analytic anchor on
 * the engine: a numerical drift in the golden-section search would show up as
 * a nonzero deviation against the closed form (machine grid: ≤ 1e-14).
 *
 * (TB-b) EXACT BUDGET. Each trap is a Bernoulli test: an honest server behind
 * noise channel Λ accepts the trap with p̄_H — phase damping exactly 1−γ, and
 * amplitude damping (1+√(1−γ))²/4 + γ/4 (the T5+ closed forms, re-imported,
 * never restated) — while an attacker with idMass ≤ 1−ε accepts with
 * p̄_L ≤ 1 − ε/2 (the T2 bound ½(1−idMass) on rejection). At the midpoint
 * threshold τ = (p̄_H + p̄_L)/2 the two error exponents are exactly
 * D(τ‖p̄_H) and D(τ‖p̄_L) (Cramér), so
 *     N(δ,ε,γ) = ⌈ ln(1/δ) / min(D(τ‖p̄_H), D(τ‖p̄_L)) ⌉
 * is an exact sufficient budget for BOTH error probabilities ≤ δ.
 *
 * (TB-c) NOISE PRICE MONOTONICITY. Fixed ε, δ: N(γ) is strictly increasing.
 * γ up ⇒ p̄_H down ⇒ the midpoint τ slides toward p̄_L ⇒ both exponents
 * shrink ⇒ the budget grows — noise makes traps strictly more expensive.
 *
 * (TB-d) CHERNOFF ≤ HOEFFDING. For the two-point test the exact Chernoff
 * budget never exceeds the Hoeffding budget hoeffdingN(1, δ, |τ−p|): the
 * machine face of D(τ‖p) ≥ 2(τ−p)² (the Pinsker inequality specialized to
 * Bernoulli pairs, where TV distance is exactly |τ−p|).
 *
 * Audit face: checkTrapBudgetClaim() re-derives the budget from scratch and
 * NAMES a too-cheap third-party claim ('below-exact-trap-budget') — a
 * smuggling trial in the checkSampleComplexityRow family.
 *
 * Honest boundary: per-trap independence (a fixed attack acts i.i.d. across
 * the trap rounds); adaptive attackers fall to the FK composition security
 * argument, which this file cites but does not re-execute; the p̄_H closed
 * forms cover only the two damping channels above.
 *
 * Literature: Chernoff-1952 (dual-sourced, R15 register); FK trap taxonomy
 * (docs/citations.md, in-repo); the attribution of the binary KL divergence
 * as the EXACT Cramér rate of a Bernoulli tail to a specific textbook —
 * standard result, specific source [to be dual-sourced].
 */
import { cramerRate, hoeffdingN } from "./samplewall.js";
import { ampDampAcceptanceClosed, phaseDampAcceptanceClosed } from "./noise.js";
import type { Rng } from "../core/rng.js";

/** The two noise channels whose honest trap-acceptance closed forms are pinned (T5+). */
export type TrapChannel = "phase" | "amplitude";

/** Binary KL divergence D(τ‖p) = τ ln(τ/p) + (1−τ) ln((1−τ)/(1−p)). */
export function binaryKl(tau: number, p: number): number {
  if (!(tau > 0 && tau < 1))
    throw new Error(`QV_THRESHOLD: binaryKl tau must be in (0,1), got ${tau}`);
  if (!(p > 0 && p < 1))
    throw new Error(`QV_PROBABILITY: binaryKl p must be in (0,1), got ${p}`);
  return tau * Math.log(tau / p) + (1 - tau) * Math.log((1 - tau) / (1 - p));
}

/**
 * Engine anchor deviation: |cramerRate([0,1],·,·) − D(τ‖p)| for either tail.
 * τ > p uses the direct upper tail; τ < p uses the dual variable 1−X (the
 * engine has no lower-tail face, so the dual IS the independent second path);
 * τ = p returns the trivial rate 0 deviation.
 */
export function cramerTwoPointDev(p: number, tau: number): number {
  if (!(p > 0 && p < 1))
    throw new Error(
      `QV_PROBABILITY: cramerTwoPointDev p must be in (0,1), got ${p}`,
    );
  if (!(tau > 0 && tau < 1))
    throw new Error(
      `QV_THRESHOLD: cramerTwoPointDev tau must be in (0,1), got ${tau}`,
    );
  if (Math.abs(tau - p) < 1e-15) return 0;
  if (tau > p)
    return Math.abs(cramerRate([0, 1], [1 - p, p], tau) - binaryKl(tau, p));
  return Math.abs(cramerRate([0, 1], [p, 1 - p], 1 - tau) - binaryKl(tau, p));
}

/** Honest trap-acceptance p̄_H(γ) — the T5+ closed forms, single-sourced from noise.ts. */
export function honestAcceptance(channel: TrapChannel, gamma: number): number {
  if (!(gamma > 0 && gamma < 1)) {
    throw new Error(
      `QV_PROBABILITY: honestAcceptance gamma must be in (0,1), got ${gamma} — γ=0 needs no budget, γ=1 never accepts`,
    );
  }
  return channel === "phase"
    ? phaseDampAcceptanceClosed(gamma)
    : ampDampAcceptanceClosed(gamma);
}

/** Attack bound: idMass ≤ 1−ε forces trap acceptance p̄_L ≤ 1 − ε/2 (T2: p̄_reject ≥ ½(1−idMass)). */
export function attackAcceptance(epsilon: number): number {
  if (!(epsilon > 0 && epsilon <= 1)) {
    throw new Error(
      `QV_EPSILON: attackAcceptance epsilon must be in (0,1], got ${epsilon} — ε=0 is an honest server, indistinguishable by any budget`,
    );
  }
  return 1 - epsilon / 2;
}

export interface TrapBudget {
  readonly channel: TrapChannel;
  readonly gamma: number;
  readonly epsilon: number;
  readonly delta: number;
  /** honest acceptance p̄_H (closed form) */
  readonly pH: number;
  /** attack acceptance bound p̄_L = 1 − ε/2 */
  readonly pL: number;
  /** midpoint threshold τ = (p̄_H + p̄_L)/2 */
  readonly tau: number;
  /** error exponent of false conviction, D(τ‖p̄_H) */
  readonly rateH: number;
  /** error exponent of false acquittal, D(τ‖p̄_L) */
  readonly rateL: number;
  /** min(rateH, rateL) — the binding exponent */
  readonly rate: number;
  /** exact sufficient budget ⌈ln(1/δ)/rate⌉ for both errors ≤ δ */
  readonly nChernoff: number;
  /** Hoeffding budget of the binding side, R = 1 (TB-d comparison face) */
  readonly nHoeffding: number;
}

/**
 * The exact trap budget (TB-b). Refuses the degenerate regime where the
 * honest acceptance has already sunk to the attack bound (p̄_H ≤ p̄_L —
 * no threshold separates the two hypotheses) BY NAME.
 */
export function trapBudget(
  channel: TrapChannel,
  gamma: number,
  epsilon: number,
  delta: number,
): TrapBudget {
  if (!(delta > 0 && delta < 1))
    throw new Error(
      `QV_DELTA: trapBudget delta must be in (0,1), got ${delta}`,
    );
  const pH = honestAcceptance(channel, gamma);
  const pL = attackAcceptance(epsilon);
  if (pH <= pL) {
    throw new Error(
      `QV_DEGENERATE: trapBudget honest acceptance ${pH.toPrecision(8)} already at/below the attack bound ${pL.toPrecision(8)} — the (γ,ε) pair is unseparable; for '${channel}' the noise price exceeds the attack budget`,
    );
  }
  const tau = (pH + pL) / 2;
  const rateH = binaryKl(tau, pH);
  const rateL = binaryKl(tau, pL);
  const rate = Math.min(rateH, rateL);
  const bindingSide = rateH <= rateL ? pH : pL;
  return {
    channel,
    gamma,
    epsilon,
    delta,
    pH,
    pL,
    tau,
    rateH,
    rateL,
    rate,
    nChernoff: Math.ceil(Math.log(1 / delta) / rate),
    nHoeffding: hoeffdingN(1, delta, Math.abs(tau - bindingSide)),
  };
}

/**
 * N(γ) over a grid — the TB-c monotonicity face. The gammas must be given in
 * INCREASING order (the caller owns the sweep direction); the returned budget
 * sequence is asserted strictly increasing by the test, not by this helper.
 */
export function budgetSequence(
  channel: TrapChannel,
  gammas: readonly number[],
  epsilon: number,
  delta: number,
): number[] {
  return gammas.map((g) => trapBudget(channel, g, epsilon, delta).nChernoff);
}

/** MC estimate of P[mean of n Bernoulli(p) draws ≥ τ] with a binomial standard error. */
export function mcAboveThreshold(
  p: number,
  tau: number,
  n: number,
  trials: number,
  rng: Rng,
): { rate: number; stdErr: number } {
  if (!(p > 0 && p < 1))
    throw new Error(
      `QV_PROBABILITY: mcAboveThreshold p must be in (0,1), got ${p}`,
    );
  if (!(n >= 1) || !Number.isInteger(n))
    throw new Error(
      `QV_SAMPLES: mcAboveThreshold n must be a positive integer, got ${n}`,
    );
  let above = 0;
  for (let t = 0; t < trials; t++) {
    let hits = 0;
    for (let s = 0; s < n; s++) if (rng() < p) hits++;
    if (hits / n >= tau) above++;
  }
  const rate = above / trials;
  return {
    rate,
    stdErr: Math.sqrt(Math.max(rate * (1 - rate), 1 / trials) / trials),
  };
}

export interface TrapBudgetClaim {
  readonly channel: TrapChannel;
  readonly gamma: number;
  readonly epsilon: number;
  readonly delta: number;
  /** third-party claimed sufficient trap count */
  readonly claimedN: number;
}

export interface TrapBudgetVerdict {
  readonly ok: boolean;
  /** fraud name when rejected, 'clean' otherwise */
  readonly name: string;
  readonly detail: string;
}

/**
 * Smuggling trial: a vendor hands us a "sufficient trap count" row for a
 * (channel, γ, ε, δ) operating point. The referee re-derives the exact
 * Cramér budget and NAMES any claim that promises the confidence δ on fewer
 * traps than the exponent permits.
 */
export function checkTrapBudgetClaim(
  claim: TrapBudgetClaim,
): TrapBudgetVerdict {
  const row = trapBudget(
    claim.channel,
    claim.gamma,
    claim.epsilon,
    claim.delta,
  );
  if (claim.claimedN < row.nChernoff) {
    return {
      ok: false,
      name: "below-exact-trap-budget",
      detail: `claim N=${claim.claimedN} but D_min=${row.rate.toExponential(6)} at τ=${row.tau.toFixed(6)} (p̄_H=${row.pH.toFixed(6)}, p̄_L=${row.pL.toFixed(6)}) requires N ≥ ${row.nChernoff} at δ=${claim.delta}`,
    };
  }
  if (claim.claimedN > row.nChernoff * 1000) {
    return {
      ok: false,
      name: "padded-beyond-any-exponent-slop",
      detail: `claim N=${claim.claimedN} exceeds the exact budget ${row.nChernoff} by >1000× — the row prices a different operating point`,
    };
  }
  return {
    ok: true,
    name: "clean",
    detail: `trap count satisfies the exact Cramér budget ${row.nChernoff}`,
  };
}
