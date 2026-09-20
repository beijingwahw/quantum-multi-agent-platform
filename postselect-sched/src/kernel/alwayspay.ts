import { payExpected, payStarMenu, lambdaStar, qOf } from "./restart.js";
import type { Dist } from "./restart.js";
import { KernelError } from "./errors.js";

/**
 * T8 kernel — the always-pay no-beating theorem (E10, v0.5.0): LSZ93
 * Theorem 3's pay-side twin, completing the two-cost-model no-beating pair.
 *
 * (AP-a) THE CONVEX IDENTITY (theorem, falsifiable): for any round menu
 * {(c_i, p_i)} with c_i > 0 and p_i in (0,1], and any cyclic schedule
 * S = (t_0, t_1, ...) cycling forever, the expected total payment
 *   T(S) = sum_k R_k c_{t_k},  R_k = prod_{j<k} (1 - p_{t_j})
 * decomposes as
 *   T(S) = sum_k g_k * (c_{t_k} / p_{t_k}),  g_k = R_k p_{t_k} >= 0,
 *   sum_k g_k = 1
 * — every cyclic schedule is a convex combination of single-round ratios,
 * the always-pay twin of LSZ93 eq. (7) (restart.ts's convexDecomposition is
 * the early-stop side). Machine: exhaustive cyclic-schedule enumeration
 * (menus <= 4 rounds, prefixes <= 3, tens of thousands of schedules) with
 * the identity on a THIRD arithmetic path vs payExpected.
 *
 * (AP-b) NO-BEATING (theorem): T(S) >= min_i c_i/p_i for every cyclic S —
 * no schedule of rounds beats the best single round when every round pays
 * its full price. Together with the early-stop no-beating (restart.ts,
 * exhaustive at small depth), the two cost models' complete no-beating
 * pair: in NEITHER accounting can a strategy beat the best fixed round.
 *
 * (AP-c) THE EQUALITY CHARACTERIZATION (theorem): T(S) = min_i c_i/p_i iff
 * every round APPEARING in the schedule attains the menu minimum (the
 * support sits inside argmin). The E10 spec's literal "iff S is a
 * single-round cycle" is the unique-argmin special case: when two rounds
 * TIE at the minimum, cycling between them also attains equality (the
 * convex combination of equal values), and the machine trial convicted the
 * literal wording before this refinement was written down. Both directions
 * are enumerated: no schedule outside argmin reaches equality, none inside
 * strictly exceeds it.
 *
 * (AP-d) THE MODEL SPLIT (negative control): a distribution whose
 * early-stop optimum is a deep cutoff (truncated geometric, the run-on
 * regime) — that optimal EARLY-STOP strategy is BEATEN under always-pay by
 * the best single round (geometric(50, 0.1): lambda* = 9.7410 at t=50 vs
 * lambda(1) = 9.9485 early-stop, but [50] pays 50.0000 always-pay vs the
 * best round's 9.9485 — beaten by factor 5.03). Partial-progress credit is
 * exactly the resource the always-pay model denies; the two models are
 * separated by an executable instance, pinning the boundary between them.
 *
 * Audit face (verdict style): a third-party quote of an expected payment
 * below the machine-recomputed menu minimum is NAMED and REJECTED.
 *
 * Honest boundaries: the theorem class is CYCLIC schedules (LSZ's strategy
 * class; prefixes of length <= 3 over menus of <= 4 rounds are the
 * enumeration witness, not a proof over all schedules — the identity (AP-a)
 * is the algebraic root, the enumeration is its falsification trial);
 * non-cyclic adaptive schedules are OUTSIDE the claim (the early-stop side
 * of LSZ93 covers its own class); g_k positivity is certified down to the
 * 1e-18 truncation of the renewal tail (sum g = 1 - tail); p_i = 0 rounds
 * are refused by name (they would make c/p infinite and the schedule's
 * success probability degenerate).
 *
 * Literature: LSZ93 (in-repo, dual-sourced — both cost models sit on its
 * restart layer); the "best biased coin" optimal-stopping folklore
 * (Bernoulli-factory-adjacent shape) [to be dual-sourced, no claim made].
 */

/** A round menu entry list plus the cyclic schedules built over it. */
export interface RoundMenu {
  readonly costs: readonly number[];
  readonly probs: readonly number[];
}

export interface PayConvexLedger {
  /** renewal path: sum R_k c_{t_k} (recomputed here, not borrowed) */
  readonly T: number;
  /** convex path: sum g_k (c_{t_k}/p_{t_k}) — the (AP-a) third path */
  readonly weighted: number;
  readonly deviation: number;
  /** sum_k g_k — telescopes to 1 - tail (tail < 1e-18) */
  readonly gSum: number;
  /** min emitted g_k — strict positivity witness down to the truncation */
  readonly gMin: number;
  /** distinct round indices appearing in the schedule (the support) */
  readonly usedRounds: readonly number[];
}

/** The (AP-a) convex-decomposition ledger of one cyclic schedule. */
export function payConvexLedger(
  costs: readonly number[],
  probs: readonly number[],
  order: readonly number[],
): PayConvexLedger {
  if (order.length === 0) {
    throw new KernelError("EMPTY-SCHEDULE", "payConvexLedger: empty order");
  }
  if (costs.length !== probs.length) {
    throw new KernelError(
      "BAD-ROUND-PROBABILITY",
      `payConvexLedger: costs and probs must be paired per round (got ${costs.length} costs vs ${probs.length} probs)`,
    );
  }
  let T = 0;
  let R = 1;
  let gSum = 0;
  let weighted = 0;
  let gMin = 1;
  const used = new Set<number>();
  let i = 0;
  let guard = 0;
  while (R > 1e-18) {
    const idx = order[i % order.length] as number;
    if (idx < 0 || idx >= costs.length || !Number.isInteger(idx)) {
      throw new KernelError(
        "CUTOFF-NOT-PRECOMPUTED",
        `payConvexLedger: order entry ${idx} is not a round index (0..${costs.length - 1})`,
      );
    }
    const c = costs[idx] as number;
    const p = probs[idx] as number;
    if (!(p > 0) || p > 1) {
      // p=0 makes g = 0 and c/p infinite — a round that never succeeds has
      // no ratio, and the convex decomposition degenerates; payExpected
      // refuses the same face
      throw new KernelError(
        "BAD-ROUND-PROBABILITY",
        `payConvexLedger: probs in (0,1] (got ${p})`,
      );
    }
    if (!(c > 0)) {
      throw new KernelError(
        "BAD-ROUND-PROBABILITY",
        `payConvexLedger: costs must be positive (got ${c})`,
      );
    }
    const g = R * p;
    used.add(idx);
    T += R * c;
    weighted += g * (c / p);
    gSum += g;
    gMin = Math.min(gMin, g);
    R *= 1 - p;
    i++;
    if (++guard > 1_000_000) {
      throw new KernelError(
        "CYCLE-NEVER-SUCCEEDS",
        "payConvexLedger: cycle never succeeds",
      );
    }
  }
  return {
    T,
    weighted,
    deviation: Math.abs(weighted - T),
    gSum,
    gMin,
    usedRounds: [...used].sort((a, b) => a - b),
  };
}

export interface NoBeatingRow {
  /** payExpected's renewal total — the independent first path */
  readonly T: number;
  /** min_i c_i/p_i through payStarMenu */
  readonly best: number;
  /** relative slack (T - best)/best — nonnegative when (AP-b) holds */
  readonly slack: number;
  readonly supportInsideArgmin: boolean;
  readonly atEquality: boolean;
  /** atEquality === supportInsideArgmin on this instance (AP-c, both ways) */
  readonly characterizationHolds: boolean;
}

/** One schedule against the menu minimum: no-beating plus the (AP-c) equality face. */
export function noBeatingRow(
  costs: readonly number[],
  probs: readonly number[],
  order: readonly number[],
): NoBeatingRow {
  const T = payExpected(costs, probs, order);
  const star = payStarMenu(costs, probs);
  const conv = payConvexLedger(costs, probs, order);
  const argmin = new Set<number>();
  for (let i = 0; i < costs.length; i++) {
    if (costs[i]! / probs[i]! <= star.value * (1 + 1e-12)) argmin.add(i);
  }
  const inside = conv.usedRounds.every((r) => argmin.has(r));
  const atEquality = T <= star.value * (1 + 1e-9);
  return {
    T,
    best: star.value,
    slack: (T - star.value) / star.value,
    supportInsideArgmin: inside,
    atEquality,
    characterizationHolds: atEquality === inside,
  };
}

export interface NoBeatingScan {
  readonly menus: number;
  readonly schedules: number;
  /** schedules with T < best (must be 0 — a counterexample kills AP-b) */
  readonly violations: number;
  /** (AP-c) failures: atEquality !== supportInsideArgmin (must be 0) */
  readonly equalityMismatches: number;
  readonly worstIdentityDev: number;
  readonly worstGSumDev: number;
  readonly minG: number;
}

/** Enumerate ALL cyclic schedules of length 1..maxLen over each menu: the
 *  (AP-a)/(AP-b)/(AP-c) falsification trial. */
export function noBeatingScan(
  menus: readonly RoundMenu[],
  maxLen: number,
): NoBeatingScan {
  if (!Number.isInteger(maxLen) || maxLen < 1) {
    throw new KernelError(
      "BAD-HORIZON",
      `noBeatingScan: maxLen must be an integer >= 1 (got ${maxLen})`,
    );
  }
  let schedules = 0;
  let violations = 0;
  let mismatches = 0;
  let worstIdentity = 0;
  let worstGSum = 0;
  let minG = 1;
  for (const menu of menus) {
    const m = menu.costs.length;
    for (let len = 1; len <= maxLen; len++) {
      const build = (prefix: number[], acc: number[][]): void => {
        if (prefix.length === len) {
          acc.push([...prefix]);
          return;
        }
        for (let i = 0; i < m; i++) build([...prefix, i], acc);
      };
      const acc: number[][] = [];
      build([], acc);
      for (const order of acc) {
        const row = noBeatingRow(menu.costs, menu.probs, order);
        const conv = payConvexLedger(menu.costs, menu.probs, order);
        schedules++;
        if (row.slack < -1e-9) violations++;
        if (!row.characterizationHolds) mismatches++;
        worstIdentity = Math.max(worstIdentity, conv.deviation / row.T);
        worstGSum = Math.max(worstGSum, Math.abs(conv.gSum - 1));
        minG = Math.min(minG, conv.gMin);
      }
    }
  }
  return {
    menus: menus.length,
    schedules,
    violations,
    equalityMismatches: mismatches,
    worstIdentityDev: worstIdentity,
    worstGSumDev: worstGSum,
    minG,
  };
}

export interface ModelSplitRow {
  /** early-stop optimum over all cutoffs: lambda* and its cutoff */
  readonly earlyStopStar: { readonly value: number; readonly t: number };
  /** always-pay optimum over all cutoffs: min_t t/q(t) and its cutoff */
  readonly alwaysPayStar: { readonly value: number; readonly t: number };
  /** lambda(1) — the single-round early-stop value the deep optimum beats */
  readonly earlyStopLambda1: number;
  /** what the EARLY-STOP-OPTIMAL schedule pays under always-pay */
  readonly earlyStopWinnerPays: number;
  /** earlyStopWinnerPays / alwaysPayStar.value — the split's sharpness */
  readonly splitFactor: number;
  /** the split holds: early-stop strictly beats cutoff 1, and that winner is
   *  strictly beaten under always-pay by the best single round */
  readonly splitHolds: boolean;
}

/** (AP-d) the model split on one distribution: the early-stop winner's
 *  always-pay conviction. Rounds carry (cost = cutoff, prob = q(cutoff)). */
export function modelSplitRow(p: Dist): ModelSplitRow {
  const es = lambdaStar(p);
  const l1 = p[1] ?? 0;
  if (!(l1 > 0)) {
    throw new KernelError(
      "BAD-HORIZON",
      "modelSplitRow: distribution needs p[1] > 0 (a first-round success mass)",
    );
  }
  let bestPay = Number.POSITIVE_INFINITY;
  let bestT = 1;
  for (let t = 1; t < p.length; t++) {
    const L = t / qOf(p, t);
    if (L < bestPay) {
      bestPay = L;
      bestT = t;
    }
  }
  const winnerPays = payExpected([es.t], [qOf(p, es.t)], [0]);
  return {
    earlyStopStar: { value: es.value, t: es.t },
    alwaysPayStar: { value: bestPay, t: bestT },
    earlyStopLambda1: 1 / l1,
    earlyStopWinnerPays: winnerPays,
    splitFactor: winnerPays / bestPay,
    splitHolds:
      es.t > 1 && es.value < 1 / l1 - 1e-9 && winnerPays > bestPay * (1 + 1e-9),
  };
}

export interface Verdict {
  readonly ok: boolean;
  readonly name: string;
  readonly detail: string;
}

export interface PayQuoteClaim {
  readonly costs: readonly number[];
  readonly probs: readonly number[];
  /** third-party quoted expected total payment for SOME schedule over this menu. */
  readonly claimedExpectedPay: number;
}

/** Smuggling trial: a quoted expected payment below the menu minimum is
 *  NAMED — no vendor beats the best round under always-pay. */
export function checkPayQuoteClaim(claim: PayQuoteClaim): Verdict {
  const star = payStarMenu(claim.costs, claim.probs);
  if (claim.claimedExpectedPay < star.value * (1 - 1e-9)) {
    return {
      ok: false,
      name: "PAY-QUOTE-COUNTERFEIT",
      detail: `claimed ${claim.claimedExpectedPay} expected pay but the menu minimum is ${star.value.toPrecision(10)} (round ${star.t}: c/p) — no cyclic schedule beats the best round`,
    };
  }
  return {
    ok: true,
    name: "clean",
    detail: `quote ${claim.claimedExpectedPay} >= the menu minimum ${star.value.toPrecision(10)}`,
  };
}

/** Seeded LCG menu generator for the enumeration corpus (deterministic:
 *  menus are data for the falsification trial, fixed by the seed). */
export function syntheticMenus(seed: number, count: number): RoundMenu[] {
  if (!Number.isInteger(count) || count < 1) {
    throw new KernelError(
      "BAD-HORIZON",
      `syntheticMenus: count must be a positive integer (got ${count})`,
    );
  }
  let s = seed >>> 0;
  if (s === 0) s = 0x9e3779b9;
  const next = (): number => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    return s / 4294967296;
  };
  const cs = [1, 2, 3, 5, 8];
  const ps = [0.05, 0.1, 0.25, 0.5, 0.8, 1.0];
  const menus: RoundMenu[] = [];
  for (let m = 0; m < count; m++) {
    const size = 1 + Math.floor(next() * 4);
    const costs: number[] = [];
    const probs: number[] = [];
    for (let r = 0; r < size; r++) {
      costs.push(cs[Math.floor(next() * cs.length)] as number);
      probs.push(ps[Math.floor(next() * ps.length)] as number);
    }
    menus.push({ costs, probs });
  }
  return menus;
}
