/**
 * The SET face of the certification toll (C1, v0.5.0).
 *
 * THE THEOREM (falsifiable): for any LIVE pattern set A — a non-empty set of
 * control patterns, each of positive weight — certifying "the run landed in
 * A" by projection-and-retry costs attempts drawn from EXACTLY the geometric
 * law with parameter
 *
 *     W(A) = sum_{a in A} prod_i w_i(a_i),   w_i(b) = cos^2(th_i) / sin^2(th_i),
 *
 * so E[attempts] = 1/W(A) and Var[attempts] = (1 - W(A)) / W(A)^2. The
 * single-pattern rows R4/R9/R11 are the size-one specializations: W({pt}) is
 * the pattern weight, W_{P++Q}({p} x {q}) = W_P({p})·W_Q({q}) is T-MULT, and
 * W(body^k)({1..1}) = w^k is L-TOLL — the existing laws are this theorem's
 * projections, promoted from points to sets:
 *
 *   SET-COMP   W_{P++Q}(A x B) = W_P(A) · W_Q(B) exactly (state-independent,
 *              the control diagonals are untouchable — S1 lifted to sets);
 *   SET-NEST   for a nested Term, the weight of a LEAF SET is the arrival
 *              probability: sum of the live paths' product weights, read both
 *              from the closed form and off the run's own conditioning.
 *
 * Certification here is the honest protocol only: measure the controls,
 * accept if the pattern is in A, else re-run. No amplitude amplification —
 * with it the toll would scale as 1/sqrt(W), outside this theorem.
 */
import { type CMat } from "../core/cmat.js";
import { ChoiceLangError } from "../core/errors.js";
import { makeRng, type Rng } from "../core/rng.js";
import { conditionOnPattern, runProgram, type Program } from "./lang.js";
import {
  conditionTermOnPath,
  registerPattern,
  termPaths,
  type Term,
} from "./compose.js";

/** One control pattern, in STEP order (the register reads newest-first). */
export type Pattern = ReadonlyArray<0 | 1>;

export interface SetToll {
  /** |A| */
  readonly size: number;
  /** W(A), the exact set weight (closed form) */
  readonly w: number;
  /** E[attempts] = 1/W(A) */
  readonly meanAttempts: number;
  /** Var[attempts] = (1 - W(A)) / W(A)^2 */
  readonly variance: number;
}

function stepWeight(step: { theta: number }, bit: number): number {
  return bit === 1 ? Math.sin(step.theta) ** 2 : Math.cos(step.theta) ** 2;
}

/** Named rejection of pattern sets the toll cannot certify. */
function validatePatternSet(p: Program, a: readonly Pattern[]): void {
  if (a.length === 0) {
    throw new ChoiceLangError(
      "TOLL_EMPTY_SET",
      "patternSetWeight: the pattern set is empty — certification of the empty event never succeeds (W = 0, E[attempts] = infinity)",
    );
  }
  const seen = new Set<string>();
  for (const [i, pat] of a.entries()) {
    if (pat.length !== p.length) {
      throw new ChoiceLangError(
        "TOLL_SET_ARITY",
        `patternSetWeight: member ${i + 1} has ${pat.length} bits but the program has ${p.length} steps — a mixed-arity set would smuggle foreign patterns into the weight`,
      );
    }
    const key = pat.join("");
    if (seen.has(key)) {
      throw new ChoiceLangError(
        "TOLL_SET_DUPLICATE",
        `patternSetWeight: member '${key}' appears twice — a multiset would double-count its weight past a probability`,
      );
    }
    seen.add(key);
    for (const [j, b] of pat.entries()) {
      const bit = b as number; // the 0|1 union proves nothing at runtime
      if (bit !== 0 && bit !== 1) {
        throw new ChoiceLangError(
          "PATTERN_ARITY",
          `patternSetWeight: member ${i + 1} bit ${j + 1} is ${bit}, not 0 or 1 — an illegal bit names no control outcome`,
        );
      }
    }
  }
}

/** W(A) in closed form: the sum over A of the per-step weight products. */
export function patternSetWeight(p: Program, a: readonly Pattern[]): number {
  validatePatternSet(p, a);
  let sum = 0;
  for (const pat of a) {
    let w = 1;
    for (const [i, b] of pat.entries()) w *= stepWeight(p[i]!, b);
    sum += w;
  }
  return sum;
}

/** The geometric toll of certifying membership in A (the theorem's moments). */
export function setToll(p: Program, a: readonly Pattern[]): SetToll {
  const w = patternSetWeight(p, a);
  if (!(w > 0)) {
    // !(w > 0): a NaN weight compares false against everything and would
    // silently price the toll at NaN — refused for the value, as ever
    throw new ChoiceLangError(
      "TOLL_DEAD_SET",
      `setToll: the set's total weight is ${w} — a dead set (every member on a zero-weight branch) can never be certified`,
    );
  }
  return {
    size: a.length,
    w,
    meanAttempts: 1 / w,
    variance: (1 - w) / (w * w),
  };
}

/** The composed set A x B in step order (P's bits first, then Q's). */
export function composedPatternSet(
  aP: readonly Pattern[],
  aQ: readonly Pattern[],
): Pattern[] {
  const out: Pattern[] = [];
  for (const p of aP) for (const q of aQ) out.push([...p, ...q]);
  return out;
}

/**
 * SET-COMP: the composed program's set weight, with the parts' own weights —
 * the identity W_{P++Q}(A x B) = W_P(A)·W_Q(B) is read as composed vs
 * partP·partQ, all three from the same closed form.
 */
export function composedSetToll(
  p: Program,
  q: Program,
  aP: readonly Pattern[],
  aQ: readonly Pattern[],
): { partP: number; partQ: number; composed: number } {
  const partP = patternSetWeight(p, aP);
  const partQ = patternSetWeight(q, aQ);
  const composed = patternSetWeight([...p, ...q], composedPatternSet(aP, aQ));
  return { partP, partQ, composed };
}

/**
 * The MEASURED second path: run the program once and sum the conditioning
 * probabilities of A's members — the weight the run itself reports, against
 * the closed form. Every member must be live (positive standalone weight):
 * a dead member's conditioning is refused by conditionOnPattern's own
 * ZERO_PROBABILITY, so it is named here first, at the set boundary.
 */
export function measuredPatternSetWeight(
  p: Program,
  a: readonly Pattern[],
  rho: CMat,
): number {
  validatePatternSet(p, a);
  for (const [i, pat] of a.entries()) {
    let w = 1;
    for (const [j, b] of pat.entries()) w *= stepWeight(p[j]!, b);
    if (!(w > 0)) {
      throw new ChoiceLangError(
        "TOLL_DEAD_PATTERN",
        `measuredPatternSetWeight: member ${i + 1} (${pat.join("")}) has weight ${w} — the measured path conditions every member, and a dead member is refused by name rather than silently skipped`,
      );
    }
  }
  const d = rho.rows;
  const fin = runProgram(p, rho);
  let sum = 0;
  for (const pat of a) {
    const { p: measured } = conditionOnPattern(
      fin,
      p.length,
      registerPattern(pat),
      d,
    );
    sum += measured;
  }
  return sum;
}

/** SET-NEST: the closed-form weight of a term's leaf set (arrival probability). */
export function termLeafSetWeight(
  t: Term,
  keep: (leaf: CMat) => boolean,
): number {
  let sum = 0;
  for (const path of termPaths(t))
    if (keep(path.leafUnitary)) sum += path.weight;
  return sum;
}

/** SET-NEST measured: the same sum read off the run's own conditionings. */
export function measuredTermLeafSetWeight(
  t: Term,
  rho: CMat,
  keep: (leaf: CMat) => boolean,
): number {
  let sum = 0;
  for (const path of termPaths(t)) {
    if (!keep(path.leafUnitary)) continue;
    sum += conditionTermOnPath(t, rho, path.bits).p;
  }
  return sum;
}

export interface CertifyTrial {
  readonly trials: number;
  /** MC mean of the attempt count (closed form: 1/W) */
  readonly mean: number;
  /** MC variance of the attempt count (closed form: (1-W)/W^2) */
  readonly variance: number;
  /** empirical P[attempts = k] for k = 1..6 (closed form: W(1-W)^(k-1)) */
  readonly pmf: readonly number[];
}

/**
 * The certification experiment: repeat the honest protocol — fresh run,
 * measure the controls, accept iff the pattern lands in A — until it does;
 * record the attempt count per trial. Each attempt draws its pattern bit by
 * bit from the exact branch weights (the control diagonals ARE the product
 * measure, S1), so the draw is the measurement, and the attempt count's law
 * is the theorem's geometric. Seeded: bit-for-bit reproducible.
 */
export function certifyUntilInSet(
  p: Program,
  a: readonly Pattern[],
  trials: number,
  seed: number,
): CertifyTrial {
  validatePatternSet(p, a);
  if (!Number.isInteger(trials) || trials < 1 || !Number.isFinite(trials)) {
    throw new ChoiceLangError(
      "TOLL_TRIALS",
      `certifyUntilInSet: trials must be a whole number >= 1, got ${trials} — a fractional or zero trial count reports a variance of nothing`,
    );
  }
  const members = new Set(a.map((pat) => pat.join("")));
  const rng: Rng = makeRng(seed);
  let sum = 0;
  let sum2 = 0;
  const tally = new Array<number>(7).fill(0); // index 1..6
  for (let t = 0; t < trials; t++) {
    let n = 0;
    for (;;) {
      n++;
      let bits = "";
      for (const step of p)
        bits += rng() < Math.sin(step.theta) ** 2 ? "1" : "0";
      if (members.has(bits)) break;
    }
    sum += n;
    sum2 += n * n;
    if (n <= 6) tally[n] = tally[n]! + 1;
  }
  const mean = sum / trials;
  return {
    trials,
    mean,
    variance: sum2 / trials - mean * mean,
    pmf: tally.slice(1).map((c) => c / trials),
  };
}

export interface SetTollClaim {
  /** the claim's name, e.g. "T-SET-ADD" — quoted in the verdict */
  readonly id: string;
  /** the claimed composed-set law, as a function of the parts' weights */
  readonly composedOf: (wp: number, wq: number) => number;
  /** an optional claimed variance law, as a function of W */
  readonly varianceOf?: (w: number) => number;
}

export interface SetTollVerdict {
  readonly id: string;
  readonly convicted: boolean;
  readonly detail: string;
}

/**
 * The smuggling trial for the set face: a claimed set-toll law is
 * cross-examined by the machine on the (P, Q, A, B) instance — the true
 * composed law is MULTIPLICATIVE and the true variance law is (1-W)/W^2, and
 * a counterfeit is named with the true law quoted (the P5 doctrine, lifted
 * from the frozen registry into this file's own court).
 */
export function crossExamineSetTollLaw(
  claim: SetTollClaim,
  p: Program,
  q: Program,
  aP: readonly Pattern[],
  aQ: readonly Pattern[],
  tol = 1e-12,
): SetTollVerdict {
  const { partP, partQ, composed } = composedSetToll(p, q, aP, aQ);
  const claimed = claim.composedOf(partP, partQ);
  if (Math.abs(claimed - composed) > tol) {
    return {
      id: claim.id,
      convicted: true,
      detail: `${claim.id}: claimed W_{P++Q}(AxB) = ${claimed.toPrecision(12)} but the machine says ${composed.toPrecision(12)} — the SET-COMP law is MULTIPLICATIVE: W_P(A)·W_Q(B) = ${(partP * partQ).toPrecision(12)}`,
    };
  }
  if (claim.varianceOf) {
    // a convicted-free composed law still owes its variance: the attempt
    // count is geometric in W, so Var = (1-W)/W^2 and nothing else
    const claimedVar = claim.varianceOf(composed);
    const trueVar = (1 - composed) / (composed * composed);
    if (Math.abs(claimedVar - trueVar) > tol) {
      return {
        id: claim.id,
        convicted: true,
        detail: `${claim.id}: the composed weight passes but the claimed variance ${claimedVar.toPrecision(12)} is not the machine's ${trueVar.toPrecision(12)} — the geometric variance law is (1-W)/W^2`,
      };
    }
  }
  return {
    id: claim.id,
    convicted: false,
    detail: `${claim.id}: agrees with the machine to ${tol.toExponential(0)}`,
  };
}
