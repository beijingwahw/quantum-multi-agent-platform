import {
  eStarGrover,
  payStarMenu,
  zeroOptimal,
  ZERO_OPTIMAL_DENSITY_LIMIT,
} from "./restart.js";
import { KernelError } from "./errors.js";

/**
 * T7 kernel — the amplification-restart menu identity and the k* monotone law
 * (E9, v0.4.0).
 *
 * (ML-a) MENU IDENTITY (theorem, falsifiable): for every (N, t) with
 * 1 <= t <= N, the always-pay optimum over the FULL amplified-round menu
 * {(k+1, p_k(theta)) : p_k > 0, k = 0..ceil(pi/4theta)+3} — evaluated through
 * the generic menu referee payStarMenu (best round c_i/p_i) — EQUALS
 * eStarGrover(N, t).queries = min_k (k+1)/p_k:
 *     payStarMenu(menu(N,t)).value === eStarGrover(N,t).queries
 * and the argmin indices agree (menu row i carries k = i's depth). The two
 * sides are independent code paths: the generic round-ratio referee vs the
 * Grover-specific scan. Machine: exhaustive over all (N, t), N = 1..2^12 —
 * worst relative deviation 0 EXACTLY (both paths divide the same doubles),
 * zero argmin mismatches.
 *
 * (ML-b) k* MONOTONE LAW (machine law, zero countersteps): k*(N, t) =
 * argmin_k (k+1)/p_k is NONINCREASING in t at fixed N — equivalently
 * NONDECREASING in the ledger ratio N/t (theta = asin(sqrt(t/N)) is the
 * monotone bridge: fewer marked items, more amplification depth). Machine:
 * the full-t ladder at N = 2^8..2^14 (32505 adjacent steps) has ZERO
 * violations. This upgrades the existing zeroOptimal threshold law (a
 * single boundary) to a whole-ladder monotonicity statement.
 *
 * (ML-b') k* = 0 iff zeroOptimal(N, t) — the argmin face and the direct
 * p_k <= (k+1) p_0 scan agree on every sampled (N, t) (two definitions of
 * the same boundary), and the boundary concentrates at c* = (3-sqrt 2)/4
 * with an O(1/N) finite correction, delivered as DATA:
 * |t_c(N)/N - c*| <= 1/N on the sampled grid, t_c = min{t : zeroOptimal}.
 *
 * Audit face (verdict style): a quoted query count below BOTH re-derived
 * optima, a forged k* ladder with an up-step in t, and a mis-stated zero
 * threshold are each NAMED and REJECTED against the machine-recomputed
 * truth (the E-family smuggling-trial house form).
 *
 * Honest boundaries: c* is the k = 1 binding constraint's N -> infinity
 * limit — at finite N the boundary shifts by the measured O(1/N) correction,
 * so the two-sided clamp is stated at c* ± delta with delta >> 1/N; p_k is
 * the closed form sin^2((2k+1)theta) (already two-path pinned to 1e-12
 * against the iterated 2x2 evolution in restart.ts); rounds with p_k = 0
 * exactly (theta a rational multiple of pi) are dropped from the menu on
 * BOTH paths — eStarGrover skips them, and a zero-probability round has no
 * c/p ratio — so the identity is over the positive-probability rounds; the
 * monotone law is a machine law over the scanned grid, not an analytic
 * proof (the theta reparameterization is the structural reason, in prose).
 *
 * Literature: LSZ93 (in-repo, dual-sourced — the restart layer this menu
 * sits on); the optimal Grover depth lineage (Boyer-Brassard-Hoyer-Tapp
 * 1998 / DH96 shapes) [to be dual-sourced].
 */

/** The amplified-round menu at (N, t): costs k+1, probs p_k(theta), zero-probability
 * rounds dropped (both identity paths skip them — see the header boundary). */
export function amplifiedRoundMenu(
  N: number,
  t: number,
): {
  readonly costs: readonly number[];
  readonly probs: readonly number[];
  readonly ks: readonly number[];
} {
  if (!Number.isInteger(t) || t < 1 || t > N) {
    // BAD-MARKED-COUNT is the restart face's code for exactly this domain —
    // reuse, never restate (the t=0 theta=0 hang is priced in restart.ts)
    throw new KernelError(
      "BAD-MARKED-COUNT",
      `amplifiedRoundMenu: t must be an integer in 1..N (got ${t}, N=${N}) — the menu inherits eStarGrover's domain`,
    );
  }
  const theta = Math.asin(Math.sqrt(t / N));
  const hi = Math.ceil(Math.PI / (4 * theta)) + 3;
  const costs: number[] = [];
  const probs: number[] = [];
  const ks: number[] = [];
  for (let k = 0; k <= hi; k++) {
    const p = Math.sin((2 * k + 1) * theta) ** 2;
    if (p <= 0) continue;
    costs.push(k + 1);
    probs.push(p);
    ks.push(k);
  }
  return { costs, probs, ks };
}

export interface MenuIdentityRow {
  readonly n: number;
  readonly t: number;
  /** payStarMenu over the full amplified menu. */
  readonly menuValue: number;
  /** eStarGrover's own k-scan. */
  readonly engineQueries: number;
  readonly relativeDeviation: number;
  readonly menuK: number;
  readonly engineK: number;
  readonly argminAgrees: boolean;
}

/** One (N, t) row of the identity: the generic menu referee vs the Grover scan. */
export function menuIdentityRow(n: number, t: number): MenuIdentityRow {
  const menu = amplifiedRoundMenu(n, t);
  const star = payStarMenu(menu.costs, menu.probs);
  const engine = eStarGrover(n, t);
  const menuK = menu.ks[star.t] as number;
  return {
    n,
    t,
    menuValue: star.value,
    engineQueries: engine.queries,
    relativeDeviation: Math.abs(star.value - engine.queries) / engine.queries,
    menuK,
    engineK: engine.k,
    argminAgrees: menuK === engine.k,
  };
}

export interface MenuIdentityScan {
  readonly pairs: number;
  readonly worstRelativeDeviation: number;
  readonly argminMismatches: number;
}

/** Exhaustive identity scan over ALL (N, t) with 1 <= t <= N <= nMax. */
export function menuIdentityScan(nMax: number): MenuIdentityScan {
  let pairs = 0;
  let worst = 0;
  let mismatches = 0;
  for (let n = 1; n <= nMax; n++) {
    for (let t = 1; t <= n; t++) {
      const row = menuIdentityRow(n, t);
      pairs++;
      worst = Math.max(worst, row.relativeDeviation);
      if (!row.argminAgrees) mismatches++;
    }
  }
  return { pairs, worstRelativeDeviation: worst, argminMismatches: mismatches };
}

export interface KStarLadder {
  readonly n: number;
  /** k*(N, t) for t = 1..N — nonincreasing when the law holds. */
  readonly ks: readonly number[];
  /** adjacent up-steps in t: each is a counterstep to the monotone law. */
  readonly violations: ReadonlyArray<{
    readonly t: number;
    readonly prevK: number;
    readonly k: number;
  }>;
}

/** The full-t k* ladder at fixed N and its countersteps (must be zero). */
export function kStarLadder(n: number): KStarLadder {
  if (!Number.isInteger(n) || n < 1)
    throw new KernelError(
      "BAD-MARKED-COUNT",
      `kStarLadder: N must be a positive integer (got ${n})`,
    );
  const ks: number[] = [];
  const violations: Array<{ t: number; prevK: number; k: number }> = [];
  let prev = eStarGrover(n, 1).k;
  ks.push(prev);
  for (let t = 2; t <= n; t++) {
    const k = eStarGrover(n, t).k;
    if (k > prev) violations.push({ t, prevK: prev, k });
    prev = k;
    ks.push(k);
  }
  return { n, ks, violations };
}

export interface ZeroThreshold {
  readonly n: number;
  /** t_c(N) = min{t : zeroOptimal(N, t)} — the ladder's k*=0 boundary. */
  readonly t: number;
  readonly density: number;
  /** t_c/N - c* (the finite-N correction, |correction| <= 1/N as DATA). */
  readonly correction: number;
  /** |correction| * N — the bounded O(1/N) constant on this grid point. */
  readonly correctionTimesN: number;
}

/** The k*=0 boundary at N: first t where the pure sorter is restart-optimal.
 * Searched in the c* +- 8 window (the measured correction stays below 1 —
 * a threshold outside the window would itself refute the DATA claim). */
export function zeroThreshold(n: number): ZeroThreshold {
  if (!Number.isInteger(n) || n < 8)
    throw new KernelError(
      "BAD-MARKED-COUNT",
      `zeroThreshold: N must be an integer >= 8 for the c* window to sit inside 1..N (got ${n})`,
    );
  const center = Math.floor(ZERO_OPTIMAL_DENSITY_LIMIT * n);
  for (let t = Math.max(1, center - 8); t <= Math.min(n, center + 8); t++) {
    if (zeroOptimal(n, t)) {
      const density = t / n;
      const correction = density - ZERO_OPTIMAL_DENSITY_LIMIT;
      return {
        n,
        t,
        density,
        correction,
        correctionTimesN: Math.abs(correction) * n,
      };
    }
  }
  throw new KernelError(
    "EXP-SCAN-FAILED",
    `zeroThreshold: no k*=0 boundary inside the c*±8 window at N=${n} — the O(1/N) DATA claim is refuted at this grid point`,
  );
}

export interface Verdict {
  readonly ok: boolean;
  readonly name: string;
  readonly detail: string;
}

export interface MenuQuoteClaim {
  readonly n: number;
  readonly t: number;
  /** third-party quoted expected query count at the standard. */
  readonly claimedQueries: number;
}

/** Smuggling trial 1: a quoted amplification budget below BOTH re-derived
 * optima is NAMED — a vendor cannot beat the menu. */
export function checkMenuQuoteClaim(claim: MenuQuoteClaim): Verdict {
  const row = menuIdentityRow(claim.n, claim.t);
  if (claim.claimedQueries < row.engineQueries * (1 - 1e-12)) {
    return {
      ok: false,
      name: "MENU-QUOTE-COUNTERFEIT",
      detail: `claimed ${claim.claimedQueries} queries at (N=${claim.n}, t=${claim.t}) but the menu optimum is ${row.menuValue.toPrecision(10)} (engine ${row.engineQueries.toPrecision(10)}, k*=${row.engineK}) — no schedule beats the best round`,
    };
  }
  return {
    ok: true,
    name: "clean",
    detail: `quote ${claim.claimedQueries} >= the menu optimum ${row.menuValue.toPrecision(10)} at (N=${claim.n}, t=${claim.t})`,
  };
}

export interface KStarTableClaim {
  readonly n: number;
  /** third-party claimed k* ladder, indexed t = 1..N. */
  readonly claimedKs: readonly number[];
}

/** Smuggling trial 2: a forged k* table with an up-step in t (or disagreeing
 * with the machine ladder) is NAMED against the recomputed truth. */
export function checkKStarTableClaim(claim: KStarTableClaim): Verdict {
  const ladder = kStarLadder(claim.n);
  if (claim.claimedKs.length !== ladder.ks.length) {
    return {
      ok: false,
      name: "KSTAR-TABLE-COUNTERFEIT",
      detail: `claimed ladder has ${claim.claimedKs.length} entries, N=${claim.n} needs exactly ${ladder.ks.length}`,
    };
  }
  for (let i = 0; i < claim.claimedKs.length; i++) {
    const claimed = claim.claimedKs[i] as number;
    const truth = ladder.ks[i] as number;
    if (claimed !== truth) {
      return {
        ok: false,
        name: "KSTAR-TABLE-COUNTERFEIT",
        detail: `claimed k*(N=${claim.n}, t=${i + 1}) = ${claimed}, the machine ladder has ${truth} — a forged depth row`,
      };
    }
  }
  // the monotone law itself is re-derived: the machine ladder's own up-steps
  if (ladder.violations.length > 0) {
    const v = ladder.violations[0] as { t: number; prevK: number; k: number };
    return {
      ok: false,
      name: "KSTAR-MONOTONE-REFUTED",
      detail: `the machine itself found an up-step at t=${v.t} (${v.prevK} -> ${v.k}) — the monotone law fails at N=${claim.n}`,
    };
  }
  return {
    ok: true,
    name: "clean",
    detail: `k* ladder verified at N=${claim.n}: ${ladder.ks.length} rows, monotone nonincreasing in t, no up-steps`,
  };
}

export interface ZeroThresholdClaim {
  readonly n: number;
  /** third-party claimed k*=0 boundary density t_c/N. */
  readonly claimedDensity: number;
}

/** Smuggling trial 3: a mis-stated zero threshold is recomputed and NAMED. */
export function checkZeroThresholdClaim(claim: ZeroThresholdClaim): Verdict {
  const thr = zeroThreshold(claim.n);
  if (Math.abs(claim.claimedDensity - thr.density) > 1e-12) {
    return {
      ok: false,
      name: "ZERO-THRESHOLD-COUNTERFEIT",
      detail: `claimed density ${claim.claimedDensity.toPrecision(10)} at N=${claim.n}, the machine boundary is t_c=${thr.t}, density ${thr.density.toPrecision(10)} (c* = ${ZERO_OPTIMAL_DENSITY_LIMIT.toPrecision(10)}, finite-N correction ${thr.correction.toExponential(3)})`,
    };
  }
  return {
    ok: true,
    name: "clean",
    detail: `zero threshold verified at N=${claim.n}: t_c=${thr.t}, density ${thr.density.toPrecision(10)}`,
  };
}
