/**
 * The Schmidt joint-reveal envelope, closed-form (v0.6.0) — G8's bounded
 * census upgraded from floats to a law.
 *
 * The two-coin Schmidt family of the G8 census: the ensemble
 * {1/2 psi(t), 1/2 psi'(t)} with psi(t) = cos t|00> + sin t|11> and the
 * swap-flip companion psi'(t) = sin t|00> + cos t|11> — per-coin marginals
 * I/2 at EVERY t (the census's flat supply), joint average NOT flat (the
 * census's honest boundary). This desk closes the boundary's arithmetic:
 * for ANY product announcement |a> x |b> with
 *     |a> = cos alpha |0> + e^{i ga} sin alpha |1>,
 *     |b> = cos beta  |0> + e^{i gb} sin beta  |1>,
 * the joint pass probability is EXACTLY
 *     P(a,b;t) = 1/4 [1 + cos2a cos2b + sin2t . sin2a sin2b . cos(ga+gb)]
 *               = 1/4 [1 + a^T C(t) b]   (Bloch bilinear),
 * with correlation matrix C(t) = diag(sin2t, -sin2t, 1) — the family's whole
 * two-coin behavior is one diagonal matrix.
 *
 * THE R18 SPEC'S FORMULA (candidate 6: P = 1/4[1 + sin2a sin2b cos2t]) IS
 * MACHINE-REFUTED: it carries no population term, and at the witness t = 0,
 * a = b = |+> it claims 1/2 where the truth is 1/4 (worst grid deviation
 * 0.354 = the missing cos2a cos2b term at its max). The spec's own
 * "(z,z) announce reaches the 1/2 ceiling" aside survives — through the
 * population term, which the spec's ellipsis never wrote down.
 *
 * Faces this law gives the census:
 *   - sup over ALL product announcements is 1/2 at EVERY t (the population
 *     correlation is t-independent and always saturates) — the envelope is
 *     FLAT, not the spec's 1/2(1+|cos2t|);
 *   - the steering lives on the equatorial slice: a = b = |+> gives
 *     1/4(1 + sin2t), sweeping the census's 1/4 -> 1/2 span;
 *   - the y-phase sum ga+gb = pi/2 KILLS the t-term entirely (the y axis is
 *     the family's dead correlator) — a falsifiable face, not prose;
 *   - t = 0 collapses to the classical joint table 1/4[1 + cos2a cos2b];
 *     t = pi/4 both members ARE |Phi+> (the family closes at the Bell point).
 */
import { mat, mDagger, mMul, kron, mTrace, type CMat } from "../core/cmat.js";
import {
  bellStates,
  coinReveal,
  jointAverage,
  jointProductReveal,
  pureState,
} from "./market.js";

// ---------------------------------------------------------------------------
// The family and the announcements.
// ---------------------------------------------------------------------------

/** The two members of the Schmidt pair as 4x4 densities (real kets). */
export function schmidtMembers(t: number): CMat[] {
  const ct = Math.cos(t);
  const st = Math.sin(t);
  const psi = mat(4, 1);
  psi.re[0] = ct;
  psi.re[3] = st;
  const psiP = mat(4, 1);
  psiP.re[0] = st;
  psiP.re[3] = ct;
  return [mMul(psi, mDagger(psi)), mMul(psiP, mDagger(psiP))];
}

/** The ensemble average rho(t) = 1/2|psi><psi| + 1/2|psi'><psi'|. */
export function schmidtAverage(t: number): CMat {
  const [rho, rhoP] = schmidtMembers(t);
  return jointAverage([
    { weight: 0.5, state: rho! },
    { weight: 0.5, state: rhoP! },
  ]);
}

/** The announcement |a> = cos a|0> + e^{i g} sin a|1> as a density (its Bloch
 *  vector is (sin2a cos g, sin2a sin g, cos2a) — the kernel's own blochState). */
export function announcementState(alpha: number, gamma: number): CMat {
  const s = Math.sin(2 * alpha);
  return pureState([
    s * Math.cos(gamma),
    s * Math.sin(gamma),
    Math.cos(2 * alpha),
  ]);
}

// ---------------------------------------------------------------------------
// The closed form, the dense route, and the correlator route — three paths.
// ---------------------------------------------------------------------------

export interface SchmidtRevealFaces {
  /** the closed form 1/4[1 + cos2a cos2b + sin2t sin2a sin2b cos(ga+gb)] */
  readonly closed: number;
  /** the dense route: Tr[(|a><a| (x) |b><b|) rho(t)] through the kernel */
  readonly dense: number;
  /** the correlator route 1/4[1 + a^T C b], C = diag(sin2t, -sin2t, 1) */
  readonly correlator: number;
  /** |closed - dense| */
  readonly closedVsDense: number;
  /** |correlator - dense| */
  readonly correlatorVsDense: number;
}

function requireAngle(x: number, name: string, lo: number, hi: number): void {
  if (!Number.isFinite(x) || x < lo || x > hi) {
    throw new Error(
      `schmidt: ANGLE-RANGE — ${name} must lie in [${lo}, ${hi}], got ${x}`,
    );
  }
}

/** All three evaluation routes for one point (the census's dual-path law). */
export function schmidtReveal(
  alpha: number,
  beta: number,
  gammaA: number,
  gammaB: number,
  t: number,
): SchmidtRevealFaces {
  requireAngle(alpha, "alpha", 0, Math.PI / 2);
  requireAngle(beta, "beta", 0, Math.PI / 2);
  requireAngle(gammaA, "gammaA", 0, 2 * Math.PI);
  requireAngle(gammaB, "gammaB", 0, 2 * Math.PI);
  requireAngle(t, "t", 0, Math.PI / 2);
  const closed =
    0.25 *
    (1 +
      Math.cos(2 * alpha) * Math.cos(2 * beta) +
      Math.sin(2 * t) *
        Math.sin(2 * alpha) *
        Math.sin(2 * beta) *
        Math.cos(gammaA + gammaB));
  const joint = schmidtAverage(t);
  const dense = jointProductReveal(
    joint,
    announcementState(alpha, gammaA),
    announcementState(beta, gammaB),
  );
  // the correlator route: a^T C b with the announcement Bloch components
  const ax = Math.sin(2 * alpha) * Math.cos(gammaA);
  const ay = Math.sin(2 * alpha) * Math.sin(gammaA);
  const az = Math.cos(2 * alpha);
  const bx = Math.sin(2 * beta) * Math.cos(gammaB);
  const by = Math.sin(2 * beta) * Math.sin(gammaB);
  const bz = Math.cos(2 * beta);
  const correlator =
    0.25 *
    (1 + az * bz + Math.sin(2 * t) * ax * bx - Math.sin(2 * t) * ay * by);
  return {
    closed,
    dense,
    correlator,
    closedVsDense: Math.abs(closed - dense),
    correlatorVsDense: Math.abs(correlator - dense),
  };
}

// ---------------------------------------------------------------------------
// The correlator census: C(t) = diag(sin2t, -sin2t, 1) against the density.
// ---------------------------------------------------------------------------

const PAULI: Record<"x" | "y" | "z", CMat> = {
  x: (() => {
    const m = mat(2, 2);
    m.re[1] = 1;
    m.re[2] = 1;
    return m;
  })(),
  y: (() => {
    const m = mat(2, 2);
    m.im[1] = -1;
    m.im[2] = 1;
    return m;
  })(),
  z: (() => {
    const m = mat(2, 2);
    m.re[0] = 1;
    m.re[3] = -1;
    return m;
  })(),
};

export interface SchmidtCorrelatorTable {
  readonly t: number;
  /** all nine <sigma_i (x) sigma_j>, row i, column j */
  readonly observed: readonly number[];
  /** the law: diag(sin2t, -sin2t, 1), zeros off the diagonal */
  readonly claimed: readonly number[];
  readonly worstDeviation: number;
}

/** The correlation matrix of rho(t): diag(sin2t, -sin2t, 1), machine-read. */
export function schmidtCorrelators(t: number): SchmidtCorrelatorTable {
  requireAngle(t, "t", 0, Math.PI / 2);
  const joint = schmidtAverage(t);
  const keys = ["x", "y", "z"] as const;
  const observed: number[] = [];
  const claimed: number[] = [];
  let worst = 0;
  for (const i of keys) {
    for (const j of keys) {
      const obs = mTrace(mMul(kron(PAULI[i], PAULI[j]), joint)).re;
      const law =
        i === "x" && j === "x"
          ? Math.sin(2 * t)
          : i === "y" && j === "y"
            ? -Math.sin(2 * t)
            : i === "z" && j === "z"
              ? 1
              : 0;
      observed.push(obs);
      claimed.push(law);
      worst = Math.max(worst, Math.abs(obs - law));
    }
  }
  return { t, observed, claimed, worstDeviation: worst };
}

// ---------------------------------------------------------------------------
// The two-path census over the algebraic grid.
// ---------------------------------------------------------------------------

export interface SchmidtCensusSummary {
  readonly points: number;
  readonly worstClosedVsDense: number;
  readonly worstCorrelatorVsDense: number;
  readonly worstCorrelatorTable: number;
  /** worst per-coin reveal deviation from 1/2, both coins, every t */
  readonly worstPerCoin: number;
  /** worst |P(z,z;t) - 1/2| over the grid — the census pin */
  readonly worstZZPin: number;
  /** worst |P(+,+;t) - (1+sin2t)/4| — the steering curve */
  readonly worstSteering: number;
  /** worst |P(a,b;t) with ga+gb = pi/2 - the same at t and at 0| — dead y axis */
  readonly worstDeadAxis: number;
  /** the envelope scan: max and min joint pass over announcements, every t */
  readonly envelopeMax: number;
  readonly envelopeMin: number;
  /** the R18 spec formula's worst deviation on the same grid (the refutation) */
  readonly worstSpecFormula: number;
}

/** The census grid: angles k*pi/24 (algebraic cos/sin values), phases fixed. */
export const SCHMIDT_GRID = {
  /** alpha/beta/t grid points per axis (multiples of pi/24, endpoints included) */
  anglePoints: 13,
  /** the phase sums swept: 0 (real), pi/2 (dead axis), and one generic */
  phasePairs: [
    [0, 0],
    [Math.PI / 2, 0],
    [Math.PI / 3, Math.PI / 6],
  ] as const,
} as const;

/**
 * The full census: every algebraic-grid point carries all three routes; the
 * per-coin flatness (both coins), the (z,z) pin, the equatorial steering
 * curve, the dead-axis y-phase independence, a full envelope scan, and the
 * R18 spec formula's refutation on the same grid.
 */
export function schmidtCensus(): SchmidtCensusSummary {
  const K = SCHMIDT_GRID.anglePoints;
  const ang = (k: number): number => (k / (K - 1)) * (Math.PI / 2);
  let points = 0;
  let worstClosedVsDense = 0;
  let worstCorrelatorVsDense = 0;
  let worstCorrelatorTable = 0;
  let worstPerCoin = 0;
  let worstZZPin = 0;
  let worstSteering = 0;
  let worstDeadAxis = 0;
  let worstSpecFormula = 0;
  for (let it = 0; it < K; it++) {
    const t = ang(it);
    const joint = schmidtAverage(t);
    worstCorrelatorTable = Math.max(
      worstCorrelatorTable,
      schmidtCorrelators(t).worstDeviation,
    );
    const quarter = Math.PI / 4;
    const plus = announcementState(quarter, 0);
    worstSteering = Math.max(
      worstSteering,
      Math.abs(
        jointProductReveal(joint, plus, plus) - (1 + Math.sin(2 * t)) / 4,
      ),
    );
    const z = announcementState(0, 0);
    worstZZPin = Math.max(
      worstZZPin,
      Math.abs(jointProductReveal(joint, z, z) - 0.5),
    );
    for (let ia = 0; ia < K; ia++) {
      const a = ang(ia);
      worstPerCoin = Math.max(
        worstPerCoin,
        Math.abs(coinReveal(joint, 0, announcementState(a, 0)) - 0.5),
        Math.abs(coinReveal(joint, 1, announcementState(a, 0)) - 0.5),
      );
      for (let ib = 0; ib < K; ib++) {
        const b = ang(ib);
        for (const [ga, gb] of SCHMIDT_GRID.phasePairs) {
          const f = schmidtReveal(a, b, ga, gb, t);
          points++;
          worstClosedVsDense = Math.max(worstClosedVsDense, f.closedVsDense);
          worstCorrelatorVsDense = Math.max(
            worstCorrelatorVsDense,
            f.correlatorVsDense,
          );
          const spec =
            0.25 * (1 + Math.sin(2 * a) * Math.sin(2 * b) * Math.cos(2 * t));
          worstSpecFormula = Math.max(
            worstSpecFormula,
            Math.abs(f.dense - spec),
          );
          if (Math.abs(ga + gb - Math.PI / 2) < 1e-12) {
            const atZero = schmidtReveal(a, b, ga, gb, 0).closed;
            worstDeadAxis = Math.max(
              worstDeadAxis,
              Math.abs(f.closed - atZero),
            );
          }
        }
      }
    }
  }
  // the envelope scan, finer: every announcement angle x phase x t
  let envelopeMax = 0;
  let envelopeMin = 1;
  const F = 24;
  for (let it = 0; it <= F / 2; it++) {
    const t = (it / F) * Math.PI;
    const joint = schmidtAverage(t);
    for (let ia = 0; ia <= F; ia++) {
      const a = (ia / F) * (Math.PI / 2);
      for (const g of [0, Math.PI]) {
        const A = announcementState(a, g);
        for (let ib = 0; ib <= F; ib++) {
          const b = (ib / F) * (Math.PI / 2);
          for (const g2 of [0, Math.PI]) {
            const p = jointProductReveal(joint, A, announcementState(b, g2));
            envelopeMax = Math.max(envelopeMax, p);
            envelopeMin = Math.min(envelopeMin, p);
          }
        }
      }
    }
  }
  return {
    points,
    worstClosedVsDense,
    worstCorrelatorVsDense,
    worstCorrelatorTable,
    worstPerCoin,
    worstZZPin,
    worstSteering,
    worstDeadAxis,
    envelopeMax,
    envelopeMin,
    worstSpecFormula,
  };
}

// ---------------------------------------------------------------------------
// The baseline anchors: t = 0 classical table; t = pi/4 = |Phi+>.
// ---------------------------------------------------------------------------

/** Worst |member - |Phi+><Phi+|| at t = pi/4 (the family closes at Bell). */
export function bellClosureDeviation(): number {
  const bell = bellStates()[0]!;
  let worst = 0;
  for (const m of schmidtMembers(Math.PI / 4)) {
    for (let k = 0; k < 16; k++)
      worst = Math.max(worst, Math.abs(m.re[k]! - bell.re[k]!));
  }
  return worst;
}

/** Worst |P(a,b;0) - 1/4[1 + cos2a cos2b]| on the grid — the classical table. */
export function classicalCollapseDeviation(): number {
  const K = SCHMIDT_GRID.anglePoints;
  const ang = (k: number): number => (k / (K - 1)) * (Math.PI / 2);
  const joint = schmidtAverage(0);
  let worst = 0;
  for (let ia = 0; ia < K; ia++) {
    for (let ib = 0; ib < K; ib++) {
      const a = ang(ia);
      const b = ang(ib);
      const p = jointProductReveal(
        joint,
        announcementState(a, 0),
        announcementState(b, 0),
      );
      worst = Math.max(
        worst,
        Math.abs(p - 0.25 * (1 + Math.cos(2 * a) * Math.cos(2 * b))),
      );
    }
  }
  return worst;
}

// ---------------------------------------------------------------------------
// The claims table and its checker (the wedge desk's honesty law).
// ---------------------------------------------------------------------------

export type SchmidtClaimTag = "HOLDS" | "REFUTED";

export interface SchmidtClaimRow {
  readonly id: string;
  readonly claim: string;
  readonly tag: SchmidtClaimTag;
}

export const SCHMIDT_CLAIMS: readonly SchmidtClaimRow[] = [
  {
    id: "SC1",
    claim:
      "the closed form P(a,b;t) = 1/4[1 + cos2a cos2b + sin2t sin2a sin2b cos(ga+gb)] holds at every algebraic-grid point against the dense kernel route (three paths: closed, dense, correlator)",
    tag: "HOLDS",
  },
  {
    id: "SC2",
    claim:
      "per-coin flat at every t and every announcement: coinReveal = 1/2 on both coins, the census's flat supply as a one-line corollary of the closed form",
    tag: "HOLDS",
  },
  {
    id: "SC3",
    claim:
      "the (z,z) announcement is PINNED at 1/2 for every t (the population correlation is t-independent); the equatorial (+,+) steering curve is exactly 1/4(1 + sin2t), sweeping the census's 1/4 -> 1/2 span; the full envelope is FLAT at 1/2 above and 0 below (attained at (z,-z))",
    tag: "HOLDS",
  },
  {
    id: "SC4",
    claim:
      "the correlation matrix is exactly diag(sin2t, -sin2t, 1): the y-phase sum ga+gb = pi/2 kills the t-term entirely (the dead-axis face), and the off-diagonal correlators vanish",
    tag: "HOLDS",
  },
  {
    id: "SC5",
    claim:
      "the baseline anchors: t = 0 collapses to the classical joint table 1/4[1 + cos2a cos2b]; t = pi/4 has both members equal to |Phi+> (the family closes at the Bell point)",
    tag: "HOLDS",
  },
  {
    id: "SC6",
    claim:
      "the R18 spec's formula P = 1/4[1 + sin2a sin2b cos2t] (REFUTED: no population term — worst grid deviation 0.354; at the witness t = 0, a = b = |+> it claims 1/2 where the truth is 1/4)",
    tag: "REFUTED",
  },
  {
    id: "SC7",
    claim:
      "the spec's envelope sup = 1/2(1 + |cos2t|) (REFUTED: the machine's sup over all product announcements is 1/2 at EVERY t — flat, because the population term saturates it; the t-dependence the spec wanted lives on the equatorial slice 1/4(1+sin2t), where sin2t is the correlator, not cos2t)",
    tag: "REFUTED",
  },
];

export interface SchmidtViolation {
  readonly row: string;
  readonly law: "SCHMIDT";
  readonly detail: string;
}

/** A SchmidtClaimRow as it crosses the untrusted boundary. */
export type UntrustedSchmidtClaimRow = Omit<SchmidtClaimRow, "tag"> & {
  readonly tag: string;
};

/** The desk's honesty law — tags must match the machine's recomputed verdict. */
export function checkSchmidtClaims(
  rows: readonly UntrustedSchmidtClaimRow[] = SCHMIDT_CLAIMS,
  tol = 1e-12,
): SchmidtViolation[] {
  const violations: SchmidtViolation[] = [];
  for (const r of rows) {
    if (r.tag !== "HOLDS" && r.tag !== "REFUTED") {
      violations.push({
        row: r.id,
        law: "SCHMIDT",
        detail: `illegal claim tag "${r.tag}" — the vocabulary is {HOLDS, REFUTED}`,
      });
      continue;
    }
    const v = schmidtClaimOutcome(r.id, tol);
    if (r.tag === "HOLDS" && !v.holds) {
      violations.push({
        row: r.id,
        law: "SCHMIDT",
        detail: `claimed HOLDS but the machine says otherwise (${v.detail})`,
      });
    }
    if (r.tag === "REFUTED" && !v.refuted) {
      violations.push({
        row: r.id,
        law: "SCHMIDT",
        detail: `claimed REFUTED but no counterexample recomputes (${v.detail})`,
      });
    }
  }
  return violations;
}

function schmidtClaimOutcome(
  id: string,
  tol: number,
): { holds: boolean; refuted: boolean; detail: string } {
  switch (id) {
    case "SC1": {
      const c = schmidtCensus();
      const holds =
        c.worstClosedVsDense <= tol && c.worstCorrelatorVsDense <= tol;
      return {
        holds,
        refuted: !holds,
        detail: `worst closed-vs-dense ${c.worstClosedVsDense.toExponential(3)}, correlator-vs-dense ${c.worstCorrelatorVsDense.toExponential(3)} over ${c.points} grid points`,
      };
    }
    case "SC2": {
      const c = schmidtCensus();
      const holds = c.worstPerCoin <= 1e-12;
      return {
        holds,
        refuted: !holds,
        detail: `worst per-coin deviation from 1/2 ${c.worstPerCoin.toExponential(3)} (both coins, every grid t and announcement)`,
      };
    }
    case "SC3": {
      const c = schmidtCensus();
      const holds =
        c.worstZZPin <= 1e-12 &&
        c.worstSteering <= 1e-12 &&
        Math.abs(c.envelopeMax - 0.5) <= 1e-9 &&
        Math.abs(c.envelopeMin) <= 1e-9;
      return {
        holds,
        refuted: !holds,
        detail: `(z,z) pinned to ${c.worstZZPin.toExponential(3)}; steering curve to ${c.worstSteering.toExponential(3)}; envelope max ${c.envelopeMax.toFixed(9)} (claimed 1/2), min ${c.envelopeMin.toFixed(9)} (claimed 0)`,
      };
    }
    case "SC4": {
      const c = schmidtCensus();
      const holds = c.worstCorrelatorTable <= 1e-12 && c.worstDeadAxis <= 1e-12;
      return {
        holds,
        refuted: !holds,
        detail: `correlation table to ${c.worstCorrelatorTable.toExponential(3)}; dead-axis independence to ${c.worstDeadAxis.toExponential(3)}`,
      };
    }
    case "SC5": {
      const bell = bellClosureDeviation();
      const classical = classicalCollapseDeviation();
      const holds = bell <= 1e-15 && classical <= 1e-12;
      return {
        holds,
        refuted: !holds,
        detail: `Bell closure ${bell.toExponential(3)}; classical table ${classical.toExponential(3)}`,
      };
    }
    case "SC6": {
      const c = schmidtCensus();
      const witness = schmidtReveal(Math.PI / 4, Math.PI / 4, 0, 0, 0);
      const specAtWitness = 0.25 * (1 + 1 * Math.cos(0)); // sin2a=sin2b=1, cos2t=1
      const refuted =
        c.worstSpecFormula > 0.1 &&
        Math.abs(witness.dense - specAtWitness) > 0.2;
      return {
        holds: !refuted,
        refuted,
        detail: `worst spec deviation ${c.worstSpecFormula.toFixed(3)} on the same grid; the witness t=0,(+,+) reads ${witness.dense.toFixed(3)} against the spec's ${specAtWitness.toFixed(3)}`,
      };
    }
    case "SC7": {
      const c = schmidtCensus();
      // the spec envelope at t=0 would be 1/2(1+1) = 1 — the machine's sup is 1/2
      const refuted = Math.abs(c.envelopeMax - 0.5) <= 1e-9;
      return {
        holds: !refuted,
        refuted,
        detail: `the spec's sup 1/2(1+|cos2t|) reaches 1 at t=0; the machine's sup over all product announcements is ${c.envelopeMax.toFixed(6)} at EVERY t — flat at 1/2, and 1 is not just wrong but unreachable (P <= 1/4(1 + sigma_max(C)) with sigma_max = 1)`,
      };
    }
    default:
      throw new Error(
        `schmidt: SCHMIDT-CLAIM — unknown claim id "${id}" — the table has SC1..SC7`,
      );
  }
}

// ---------------------------------------------------------------------------
// The counterfeit verifier — a handed-in pass claim is re-derived on the spot.
// ---------------------------------------------------------------------------

export type SchmidtFraudCode =
  "ANGLE-RANGE" | "FORGED-VALUE" | "ENVELOPE-EXCEEDED" | "SUBZERO-PASS";

export type SchmidtVerdict =
  | { readonly ok: true; readonly code: "VERIFIED"; readonly detail: string }
  | {
      readonly ok: false;
      readonly code: SchmidtFraudCode;
      readonly detail: string;
    };

/** A handed-in joint-reveal claim: the announcement angles, phases, t, and
 *  the claimed pass probability. */
export interface SchmidtRevealClaim {
  readonly alpha: number;
  readonly beta: number;
  readonly gammaA: number;
  readonly gammaB: number;
  readonly t: number;
  readonly claimedPass: number;
}

/** Re-derives all three routes and names every counterfeit kind — including
 *  the fake envelope point (a pass above the flat 1/2 ceiling the law
 *  guarantees) and the spec-formula forgery (the R18 shape itself). The
 *  deviation is reported at its local scale: the closed form's gradient in
 *  the angles is bounded by 3/2, so |claimed - derived| is judged against
 *  1e-9 absolute and printed against the local claim magnitude. */
export function verifySchmidtRevealClaim(
  claim: SchmidtRevealClaim,
  tol = 1e-9,
): SchmidtVerdict {
  let faces: SchmidtRevealFaces;
  try {
    faces = schmidtReveal(
      claim.alpha,
      claim.beta,
      claim.gammaA,
      claim.gammaB,
      claim.t,
    );
  } catch (e) {
    return {
      ok: false,
      code: "ANGLE-RANGE",
      detail: e instanceof Error ? e.message : String(e),
    };
  }
  if (claim.claimedPass < -tol || claim.claimedPass > 1 + tol) {
    return {
      ok: false,
      code: "SUBZERO-PASS",
      detail: `a pass probability of ${claim.claimedPass} is not a probability — the law's range is [0, 1/2] on this family`,
    };
  }
  if (claim.claimedPass > 0.5 + 1e-9) {
    return {
      ok: false,
      code: "ENVELOPE-EXCEEDED",
      detail: `claimed ${claim.claimedPass.toFixed(6)} at (a=${claim.alpha.toFixed(3)}, b=${claim.beta.toFixed(3)}, t=${claim.t.toFixed(3)}) — the family's envelope is FLAT at 1/2 (P = 1/4[1 + a^T C b] with sigma_max(C) = 1); the dense route reads ${faces.dense.toFixed(6)}`,
    };
  }
  const dev = Math.abs(claim.claimedPass - faces.dense);
  if (dev > tol) {
    const specForm =
      0.25 *
      (1 +
        Math.sin(2 * claim.alpha) *
          Math.sin(2 * claim.beta) *
          Math.cos(2 * claim.t));
    const specShaped = Math.abs(claim.claimedPass - specForm) <= tol;
    return {
      ok: false,
      code: "FORGED-VALUE",
      detail: `claimed ${claim.claimedPass.toFixed(9)}, the machine derives ${faces.closed.toFixed(9)} (closed) = ${faces.dense.toFixed(9)} (dense); deviation ${dev.toExponential(3)} = ${(dev / Math.max(Math.abs(claim.claimedPass), 0.25)).toExponential(3)} of the local scale${specShaped ? " — the value matches the R18 spec's refuted shape 1/4[1 + sin2a sin2b cos2t] exactly (SC6)" : ""}`,
    };
  }
  return {
    ok: true,
    code: "VERIFIED",
    detail: `re-derived: closed ${faces.closed.toFixed(9)} = dense ${faces.dense.toFixed(9)} (correlator route ${faces.correlator.toFixed(9)})`,
  };
}
