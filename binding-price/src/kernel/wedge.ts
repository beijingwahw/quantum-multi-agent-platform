/**
 * The wedge cosine law, rationalized (v0.5.0) — G7's 0.103553 float upgraded
 * to exact certificates.
 *
 * The bend of the noisy commit census, stated as one equation: for ANY
 * single-qubit channel E with Bloch output r', the wedge between an
 * announcement a and the output's loss is
 *     wedge(a) = loss(output) - slack(a) = |r'| (1 - cos L(a, r')) / 2,
 * cos L(a, r') = a.r' / (|a||r'|) — the geometry is CHANNEL-AGNOSTIC (the
 * channel only chooses r'; the reveal prices the angle), machine-checked
 * against the dense pass/loss machinery on both census channels. For
 * dephasing the output law is exactly rational, r' = ((1-2g) r_x,
 * (1-2g) r_y, r_z), so the certificates go exact in BigInt rationals:
 * cos^2 of the input-anchored wedge is ALWAYS rational on rational pure
 * inputs, and cos/wedge themselves are rational exactly when |r'| is a
 * rational length — always at g in {0, 1/2} on the Pythagorean family, and
 * NOT at g = 1/4 (the R18 spec claimed blanket rationality there; the machine
 * refuted it: r = (4/5, 0, 3/5) gives |r'|^2 = 13/25, 13 not a square). The
 * G7 point r = (1,0,1)/sqrt(2), g = 1/2 lands in Q(sqrt 2): wedge =
 * (sqrt 2 - 1)/4, bracketed 0.103553 < wedge < 0.103554 by exact squaring.
 */
import { applyNoise, type NoiseName } from "../core/channels.js";
import {
  blochOf,
  blochState,
  concealmentLoss,
  fibSphere,
  passProbability,
  pureState,
} from "./market.js";

// ---------------------------------------------------------------------------
// BigInt rationals — the certificate carrier (zero dependencies, the
// nosignal-tariff rational.ts precedent at the width this desk needs).
// Refusals are plain named errors ("wedge: ..." prefix, the binding-price
// channels.ts pattern): errors.ts's MarketErrorCode set is closed and owns
// the market doors, not this desk's arithmetic.
// ---------------------------------------------------------------------------

/** An exact rational num/den, den > 0, reduced. */
export interface Frac {
  readonly num: bigint;
  readonly den: bigint;
}

function bigGcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

function norm(num: bigint, den: bigint): Frac {
  if (den === 0n)
    throw new Error(
      "wedge: Q-ZERO-DENOMINATOR — a fraction needs a nonzero denominator",
    );
  const sign = den < 0n ? -1n : 1n;
  const n = num * sign;
  const d = den * sign;
  const g = bigGcd(n, d) || 1n;
  return { num: n / g, den: d / g };
}

export function frac(num: bigint | number, den: bigint | number = 1n): Frac {
  return norm(BigInt(num), BigInt(den));
}

export function fAdd(a: Frac, b: Frac): Frac {
  return norm(a.num * b.den + b.num * a.den, a.den * b.den);
}

export function fSub(a: Frac, b: Frac): Frac {
  return norm(a.num * b.den - b.num * a.den, a.den * b.den);
}

export function fMul(a: Frac, b: Frac): Frac {
  return norm(a.num * b.num, a.den * b.den);
}

export function fDiv(a: Frac, b: Frac): Frac {
  if (b.num === 0n)
    throw new Error(
      "wedge: Q-ZERO-DENOMINATOR — division by the zero rational",
    );
  return norm(a.num * b.den, a.den * b.num);
}

/** Sign of a - b: -1, 0, or 1. */
export function fCmp(a: Frac, b: Frac): -1 | 0 | 1 {
  const l = a.num * b.den;
  const r = b.num * a.den;
  return l < r ? -1 : l > r ? 1 : 0;
}

export function fEq(a: Frac, b: Frac): boolean {
  return fCmp(a, b) === 0;
}

export function fToNumber(a: Frac): number {
  return Number(a.num) / Number(a.den);
}

/** Exact integer square root, or null when n is not a perfect square. */
function bigSqrt(n: bigint): bigint | null {
  if (n < 0n) return null;
  if (n < 2n) return n;
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x * x === n ? x : null;
}

/** Is the nonnegative rational a a square in Q? (Both limbs perfect.) */
export function isRatSquare(a: Frac): boolean {
  return a.num >= 0n && bigSqrt(a.num) !== null && bigSqrt(a.den) !== null;
}

/** The rational square root, or null when a is not a square in Q. */
export function ratSqrt(a: Frac): Frac | null {
  if (a.num < 0n) return null;
  const rn = bigSqrt(a.num);
  const rd = bigSqrt(a.den);
  if (rn === null || rd === null) return null;
  return { num: rn, den: rd };
}

// ---------------------------------------------------------------------------
// Q(sqrt 2) comparisons — the G7 certificate's field.
// ---------------------------------------------------------------------------

/** Compare p + q*sqrt(2) against the rational c: -1, 0, or 1. Exact: every
 *  case reduces to sign(d) or to d^2 vs 2 q^2 in BigInt. */
export function compareQsqrt2(p: Frac, q: Frac, c: Frac): -1 | 0 | 1 {
  const d = fSub(p, c);
  if (q.num === 0n) return fCmp(d, frac(0n));
  if (d.num === 0n) return q.num > 0n ? 1 : -1; // q*sqrt(2) vs 0, sqrt(2) > 0
  const dPos = d.num > 0n;
  const qPos = q.num > 0n;
  if (dPos && qPos) return 1;
  if (!dPos && !qPos) return -1;
  // opposite signs: the winner is the larger magnitude — compare |d| vs |q| sqrt(2)
  const lhs = fMul(d, d); // d^2
  const rhs = fMul(fMul(q, q), frac(2n)); // 2 q^2
  const cmp = fCmp(lhs, rhs);
  if (cmp === 0) return 0; // |d| = |q| sqrt(2) would need sqrt(2) rational — unreachable on rationals, kept for exhaustiveness
  const magnitudeWins = cmp > 0;
  return dPos ? (magnitudeWins ? 1 : -1) : magnitudeWins ? -1 : 1;
}

// ---------------------------------------------------------------------------
// The exact dephase faces (pure rational Bloch inputs).
// ---------------------------------------------------------------------------

/** The exact strength grid of the rationality census. */
export const GAMMA_EXACT_GRID: readonly Frac[] = [
  frac(0n),
  frac(1n, 4n),
  frac(1n, 2n),
];

/** Pure rational Bloch directions on the unit circle's Pythagorean points
 *  (plus one y-family member): |r|^2 = 1 in BigInt, exactly. */
export function pythagoreanFamily(): ReadonlyArray<
  readonly [Frac, Frac, Frac]
> {
  const out: Array<readonly [Frac, Frac, Frac]> = [
    [frac(1n), frac(0n), frac(0n)],
    [frac(0n), frac(1n), frac(0n)],
    [frac(0n), frac(0n), frac(1n)],
  ];
  for (const [m, n] of [
    [2n, 1n],
    [3n, 1n],
    [4n, 1n],
    [3n, 2n],
    [4n, 3n],
    [5n, 2n],
  ] as const) {
    const d = m * m + n * n;
    out.push([frac(2n * m * n, d), frac(0n), frac(m * m - n * n, d)]);
    out.push([frac(0n), frac(2n * m * n, d), frac(m * m - n * n, d)]);
  }
  return out;
}

function requirePureRational(r: readonly [Frac, Frac, Frac]): void {
  const normSq = fAdd(
    fAdd(fMul(r[0], r[0]), fMul(r[1], r[1])),
    fMul(r[2], r[2]),
  );
  if (!fEq(normSq, frac(1n))) {
    throw new Error(
      `wedge: NOT-PURE-INPUT — the exact faces need |r|^2 = 1, got ${normSq.num}/${normSq.den}`,
    );
  }
}

function requireGammaInRange(gamma: Frac): void {
  if (fCmp(gamma, frac(0n)) < 0 || fCmp(gamma, frac(1n, 2n)) > 0) {
    throw new Error(
      `wedge: GAMMA-RANGE — dephasing strength must lie in [0, 1/2], got ${gamma.num}/${gamma.den}`,
    );
  }
}

/** The exact output law: r' = ((1-2g) r_x, (1-2g) r_y, r_z), in BigInt. */
export function dephaseOutputExact(
  r: readonly [Frac, Frac, Frac],
  gamma: Frac,
): readonly [Frac, Frac, Frac] {
  requireGammaInRange(gamma);
  const s = fSub(frac(1n), fMul(frac(2n), gamma));
  return [fMul(s, r[0]), fMul(s, r[1]), r[2]];
}

/** The exact input-anchored wedge faces of a pure rational r under dephase:
 *  dot = r.r', nr2 = |r'|^2, cosSq = dot^2 / nr2 (rational wherever the
 *  output is nonzero), and cos/wedge exactly when nr2 is a square in Q (null
 *  otherwise — the honest irrationality face, not a refusal). The degenerate
 *  boundary — a fully dephased EQUATORIAL input, r' = 0 — carries no angle:
 *  cos and cosSq are undefined (null), and the wedge is EXACTLY 0 (the output
 *  is I/2: zero loss, zero slack, nothing wedged). */
export interface WedgeExactFaces {
  readonly dot: Frac;
  readonly nr2: Frac;
  /** true exactly when r' = 0 (the angle's undefined boundary). */
  readonly degenerate: boolean;
  readonly cosSq: Frac | null;
  readonly cos: Frac | null;
  /** exactly 0 on the degenerate boundary; null iff cos lives outside Q on a
   *  non-degenerate output. */
  readonly wedge: Frac | null;
}

export function wedgeExactFaces(
  r: readonly [Frac, Frac, Frac],
  gamma: Frac,
): WedgeExactFaces {
  requirePureRational(r);
  requireGammaInRange(gamma);
  const s = fSub(frac(1n), fMul(frac(2n), gamma));
  const s2 = fMul(s, s);
  const xy2 = fAdd(fMul(r[0], r[0]), fMul(r[1], r[1]));
  const z2 = fMul(r[2], r[2]);
  const dot = fAdd(fMul(s, xy2), z2);
  const nr2 = fAdd(fMul(s2, xy2), z2);
  if (nr2.num === 0n)
    return {
      dot,
      nr2,
      degenerate: true,
      cosSq: null,
      cos: null,
      wedge: frac(0n),
    };
  const cosSq = fDiv(fMul(dot, dot), nr2);
  const nr = ratSqrt(nr2);
  if (nr === null)
    return { dot, nr2, degenerate: false, cosSq, cos: null, wedge: null };
  const cos = fDiv(dot, nr);
  const wedge = fDiv(fSub(nr, dot), frac(2n));
  return { dot, nr2, degenerate: false, cosSq, cos, wedge };
}

// ---------------------------------------------------------------------------
// The float faces — the closed form against the dense market machinery.
// ---------------------------------------------------------------------------

export interface WedgeClosedForm {
  /** cos of the angle between a and r'. */
  readonly cos: number;
  /** |r'| (1 - cos) / 2. */
  readonly wedge: number;
  readonly lossOut: number;
}

/** The closed form: wedge(a; r') = |r'| (1 - cos L(a, r')) / 2 — pure Bloch
 *  geometry, valid for every channel's output r'. */
export function wedgeClosedForm(
  a: readonly [number, number, number],
  rOut: readonly [number, number, number],
): WedgeClosedForm {
  const aN = Math.hypot(a[0], a[1], a[2]);
  const rN = Math.hypot(rOut[0], rOut[1], rOut[2]);
  if (aN === 0)
    throw new Error(
      "wedge: ZERO-ANNOUNCEMENT — the angle needs a nonzero announcement",
    );
  if (rN === 0)
    throw new Error(
      "wedge: ZERO-OUTPUT — the angle needs a nonzero output polarization",
    );
  const dot = a[0] * rOut[0] + a[1] * rOut[1] + a[2] * rOut[2];
  const cos = dot / (aN * rN);
  return { cos, wedge: (rN * (1 - cos)) / 2, lossOut: rN / 2 };
}

/** The dense route: the market's own pass/loss machinery on the output state. */
export function wedgeDense(
  a: readonly [number, number, number],
  r: readonly [number, number, number],
  noise: NoiseName,
  gamma: number,
): number {
  const rhoOut = applyNoise(blochState([r[0], r[1], r[2]]), noise, gamma);
  const pass = passProbability(pureState([a[0], a[1], a[2]]), rhoOut);
  return concealmentLoss(rhoOut) - (pass - 0.5);
}

export interface WedgeCensusSummary {
  readonly points: number;
  readonly worstClosedVsDense: number;
  readonly worstAlignedSlackEqLoss: number;
  readonly minMisalignedWedge: number;
  readonly worstOutputLaw: number;
  readonly worstInputAnchoredCos: number;
}

/** The two-path census: closed form vs dense machinery over Fibonacci
 *  direction grids x both channels x the strength grids; the output law
 *  r' = ((1-2g) r_x, (1-2g) r_y, r_z) for dephase; the input-anchored cos
 *  formula [(1-2g)(r_x^2+r_y^2)+r_z^2]/(|r||r'|); and the aligned/misaligned
 *  faces of slack = loss. Every input ALSO carries its exactly-aligned
 *  announcement r'/|r'| — the equality face is swept, never vacuous. */
export function wedgeCensus(gridPerAxis = 16): WedgeCensusSummary {
  const ofNoise = (
    noise: NoiseName,
    grid: readonly number[],
  ): Array<{ noise: NoiseName; gamma: number }> =>
    grid.map((gamma) => ({ noise, gamma }));
  const strengths: ReadonlyArray<{ noise: NoiseName; gamma: number }> = [
    ...ofNoise("dephase", [0, 0.125, 0.25, 0.375, 0.5]),
    ...ofNoise("ampdamp", [0, 0.25, 0.5, 0.75, 1]),
  ];
  let points = 0;
  let worstClosedVsDense = 0;
  let worstAlignedSlackEqLoss = 0;
  let minMisalignedWedge = Infinity;
  let worstOutputLaw = 0;
  let worstInputAnchoredCos = 0;
  for (const { noise, gamma } of strengths) {
    for (let i = 0; i < gridPerAxis; i++) {
      const a = fibSphere(i, gridPerAxis);
      for (let j = 0; j < gridPerAxis; j++) {
        const r = fibSphere(j, gridPerAxis, 0.5);
        const scale = 0.7;
        const rs: [number, number, number] = [
          scale * r[0],
          scale * r[1],
          scale * r[2],
        ];
        const rhoOut = applyNoise(blochState(rs), noise, gamma);
        const rOut = blochOf(rhoOut);
        const rOutN = Math.hypot(rOut[0], rOut[1], rOut[2]);
        const closed = wedgeClosedForm(a, rOut);
        points++;
        worstClosedVsDense = Math.max(
          worstClosedVsDense,
          Math.abs(closed.wedge - wedgeDense(a, rs, noise, gamma)),
        );
        const cross = Math.hypot(
          a[1] * rOut[2] - a[2] * rOut[1],
          a[2] * rOut[0] - a[0] * rOut[2],
          a[0] * rOut[1] - a[1] * rOut[0],
        );
        if (cross <= 1e-9 * rOutN) {
          // grid-coincident alignment (measure-zero on the grid, swept anyway)
          worstAlignedSlackEqLoss = Math.max(
            worstAlignedSlackEqLoss,
            Math.abs(
              passProbability(pureState([a[0], a[1], a[2]]), rhoOut) -
                0.5 -
                closed.lossOut,
            ),
          );
        } else {
          minMisalignedWedge = Math.min(minMisalignedWedge, closed.wedge);
        }
        // the exactly-aligned announcement r'/|r'|: slack MUST equal loss here
        if (rOutN > 1e-12) {
          const aligned: [number, number, number] = [
            rOut[0] / rOutN,
            rOut[1] / rOutN,
            rOut[2] / rOutN,
          ];
          worstAlignedSlackEqLoss = Math.max(
            worstAlignedSlackEqLoss,
            Math.abs(
              passProbability(pureState(aligned), rhoOut) -
                0.5 -
                closed.lossOut,
            ),
          );
        }
        if (noise === "dephase") {
          const s = 1 - 2 * gamma;
          worstOutputLaw = Math.max(
            worstOutputLaw,
            Math.abs(rOut[0] - s * rs[0]),
            Math.abs(rOut[1] - s * rs[1]),
            Math.abs(rOut[2] - rs[2]),
          );
          const rN = Math.hypot(rs[0], rs[1], rs[2]);
          const specCos =
            (s * (rs[0] * rs[0] + rs[1] * rs[1]) + rs[2] * rs[2]) /
            (rN * rOutN);
          worstInputAnchoredCos = Math.max(
            worstInputAnchoredCos,
            Math.abs(specCos - wedgeClosedForm(rs, rOut).cos),
          );
        }
      }
    }
  }
  return {
    points,
    worstClosedVsDense,
    worstAlignedSlackEqLoss,
    minMisalignedWedge,
    worstOutputLaw,
    worstInputAnchoredCos,
  };
}

// ---------------------------------------------------------------------------
// The G7 certificate: wedge = (sqrt(2) - 1)/4 in Q(sqrt 2), exactly bracketed.
// ---------------------------------------------------------------------------

export interface G7Certificate {
  /** 0.103553 < (sqrt 2 - 1)/4 — exact BigInt squaring. */
  readonly aboveLo: boolean;
  /** (sqrt 2 - 1)/4 < 0.103554 — exact BigInt squaring. */
  readonly belowHi: boolean;
  readonly lo: Frac;
  readonly hi: Frac;
  /** cos^2 of the input-anchored wedge at the G7 point: exactly 1/2. */
  readonly cosSq: Frac;
  /** the float wedge of the dense machinery vs the Q(sqrt 2) value's float. */
  readonly floatDev: number;
}

/** r = (1,0,1)/sqrt(2), gamma = 1/2: r' = (0,0,1/sqrt 2), cos = 1/sqrt 2,
 *  wedge = (sqrt 2 - 1)/4 — every comparison below is exact in BigInt. */
export function g7WedgeCertificate(): G7Certificate {
  const q = Math.SQRT1_2;
  const r: [number, number, number] = [q, 0, q];
  const dense = wedgeDense(r, r, "dephase", 0.5);
  const exactFloat = (Math.SQRT2 - 1) / 4;
  const lo = frac(103553n, 1000000n);
  const hi = frac(103554n, 1000000n);
  // wedge = -1/4 + (1/4) sqrt 2: compareQsqrt2 does the squaring
  const aboveLo = compareQsqrt2(frac(-1n, 4n), frac(1n, 4n), lo) > 0;
  const belowHi = compareQsqrt2(frac(-1n, 4n), frac(1n, 4n), hi) < 0;
  return {
    aboveLo,
    belowHi,
    lo,
    hi,
    cosSq: frac(1n, 2n),
    floatDev: Math.abs(dense - exactFloat),
  };
}

// ---------------------------------------------------------------------------
// The claims table and its checker; the counterfeit verifier.
// ---------------------------------------------------------------------------

export type WedgeClaimTag = "HOLDS" | "REFUTED";

export interface WedgeClaimRow {
  readonly id: string;
  readonly claim: string;
  readonly tag: WedgeClaimTag;
}

export const WEDGE_CLAIMS: readonly WedgeClaimRow[] = [
  {
    id: "WC1",
    claim:
      "the dephase output law is exactly rational: r' = ((1-2g) r_x, (1-2g) r_y, r_z) (dense cross-check to 1e-15, BigInt exact on the Pythagorean family)",
    tag: "HOLDS",
  },
  {
    id: "WC2",
    claim:
      "the cosine law holds for EVERY channel's output: wedge(a) = loss(output) x (1 - cos L(a, r')), cos L(a, r') = a.r'/(|a||r'|) — channel-agnostic geometry, two-path to 1e-12 (the R18 draft factored loss of the INPUT; the machine convicts: 0.146446 != 0.103553)",
    tag: "HOLDS",
  },
  {
    id: "WC3",
    claim:
      "slack(a) = loss(output) if and only if a parallels r' (aligned announcements meet the one-to-one to 1e-15; every misaligned point on the grid is strictly wedged)",
    tag: "HOLDS",
  },
  {
    id: "WC4",
    claim:
      "cos^2 of the input-anchored wedge is EXACTLY rational for every rational pure r and rational g wherever the output is nonzero (BigInt, no square root in the certificate); the fully-dephased equatorial boundary r' = 0 has no angle and wedge exactly 0",
    tag: "HOLDS",
  },
  {
    id: "WC5",
    claim:
      "wedge is an exact rational on the whole Pythagorean family at g in {0, 1/2} (0 on the degenerate boundary; at 1/2 every non-degenerate |r'| = |r_z| is rational), cos likewise except undefined on that boundary; at g = 1/4 irrational (null) faces appear — rationality is the rational-length condition, not a blanket",
    tag: "HOLDS",
  },
  {
    id: "WC6",
    claim:
      "the R18 spec's blanket rationality at g = 1/4: cos and wedge rational for every rational pure r (REFUTED at r = (4/5, 0, 3/5): |r'|^2 = 13/25, 13 is not a square — cos = sqrt(13)/5 outside Q)",
    tag: "REFUTED",
  },
  {
    id: "WC7",
    claim:
      "the G7 float 0.103553 upgraded: wedge = (sqrt 2 - 1)/4 exactly bracketed 0.103553 < w < 0.103554 by BigInt squaring, cos^2 = 1/2 exactly, dense-vs-Q(sqrt 2) float deviation at 1e-16 scale",
    tag: "HOLDS",
  },
];

export interface WedgeViolation {
  readonly row: string;
  readonly law: "WEDGE";
  readonly detail: string;
}

/** A WedgeClaimRow as it crosses the untrusted boundary (the tag is an
 *  unvalidated string until the vocabulary check has run). */
export type UntrustedWedgeClaimRow = Omit<WedgeClaimRow, "tag"> & {
  readonly tag: string;
};

/** The wedge table's honesty law — tags must match the machine's recomputed
 *  verdict (the H8 pattern; the market's M-laws are a closed set elsewhere). */
export function checkWedgeClaims(
  rows: readonly UntrustedWedgeClaimRow[] = WEDGE_CLAIMS,
  tol = 1e-12,
): WedgeViolation[] {
  const violations: WedgeViolation[] = [];
  for (const r of rows) {
    if (r.tag !== "HOLDS" && r.tag !== "REFUTED") {
      violations.push({
        row: r.id,
        law: "WEDGE",
        detail: `illegal claim tag "${r.tag}" — the vocabulary is {HOLDS, REFUTED}`,
      });
      continue;
    }
    const v = wedgeClaimOutcome(r.id, tol);
    if (r.tag === "HOLDS" && !v.holds) {
      violations.push({
        row: r.id,
        law: "WEDGE",
        detail: `claimed HOLDS but the machine says otherwise (${v.detail})`,
      });
    }
    if (r.tag === "REFUTED" && !v.refuted) {
      violations.push({
        row: r.id,
        law: "WEDGE",
        detail: `claimed REFUTED but no counterexample recomputes (${v.detail})`,
      });
    }
  }
  return violations;
}

function wedgeClaimOutcome(
  id: string,
  tol: number,
): { holds: boolean; refuted: boolean; detail: string } {
  switch (id) {
    case "WC1": {
      const census = wedgeCensus();
      let worstExact = 0;
      for (const r of pythagoreanFamily()) {
        for (const g of GAMMA_EXACT_GRID) {
          const out = dephaseOutputExact(r, g);
          // the float route must agree with the BigInt route, cell by cell
          const rf: [number, number, number] = [
            fToNumber(r[0]),
            fToNumber(r[1]),
            fToNumber(r[2]),
          ];
          const rfOut = blochOf(
            applyNoise(blochState(rf), "dephase", fToNumber(g)),
          );
          worstExact = Math.max(
            worstExact,
            Math.abs(rfOut[0] - fToNumber(out[0])),
            Math.abs(rfOut[1] - fToNumber(out[1])),
            Math.abs(rfOut[2] - fToNumber(out[2])),
          );
        }
      }
      const holds = census.worstOutputLaw <= 1e-15 && worstExact <= 1e-15;
      return {
        holds,
        refuted: !holds,
        detail: `worst dense output-law deviation ${census.worstOutputLaw.toExponential(3)} over ${census.points} census points; worst BigInt-vs-dense deviation ${worstExact.toExponential(3)} over ${pythagoreanFamily().length} x ${GAMMA_EXACT_GRID.length} exact points`,
      };
    }
    case "WC2": {
      const census = wedgeCensus();
      const holds =
        census.worstClosedVsDense <= tol && census.worstInputAnchoredCos <= tol;
      return {
        holds,
        refuted: !holds,
        detail: `worst closed-vs-dense wedge deviation ${census.worstClosedVsDense.toExponential(3)}, worst input-anchored cos deviation ${census.worstInputAnchoredCos.toExponential(3)} over ${census.points} census points (both channels)`,
      };
    }
    case "WC3": {
      const census = wedgeCensus();
      const holds =
        census.worstAlignedSlackEqLoss <= 1e-12 &&
        census.minMisalignedWedge > 1e-6;
      return {
        holds,
        refuted: !holds,
        detail: `aligned announcements meet slack = loss to ${census.worstAlignedSlackEqLoss.toExponential(3)}; the smallest misaligned wedge on the grid is ${census.minMisalignedWedge.toExponential(3)} (strictly positive)`,
      };
    }
    case "WC4": {
      // cos^2 rational for EVERY rational pure r and rational strength with a
      // nonzero output — the certificate carries no square root by
      // construction; this sweep also crosses it against the float geometry
      let worst = 0;
      let degenerate = 0;
      for (const r of pythagoreanFamily()) {
        for (const g of GAMMA_EXACT_GRID) {
          const faces = wedgeExactFaces(r, g);
          if (faces.degenerate) {
            degenerate++;
            continue;
          }
          const rf: [number, number, number] = [
            fToNumber(r[0]),
            fToNumber(r[1]),
            fToNumber(r[2]),
          ];
          const rOut = blochOf(
            applyNoise(blochState(rf), "dephase", fToNumber(g)),
          );
          const cosFloat = wedgeClosedForm(rf, rOut).cos;
          worst = Math.max(
            worst,
            Math.abs(cosFloat * cosFloat - fToNumber(faces.cosSq!)),
          );
        }
      }
      return {
        holds: worst <= tol,
        refuted: worst > tol,
        detail: `cos^2 recomputes as an exact BigInt rational on every non-degenerate Pythagorean x strength point; float cross-deviation ${worst.toExponential(3)}; ${degenerate} degenerate boundary rows (r' = 0: no angle, wedge exactly 0)`,
      };
    }
    case "WC5": {
      // rational exactly when |r'| is a rational length: gamma 0 and 1/2 give
      // wedge on the WHOLE family (0 on the degenerate boundary; at 1/2 every
      // non-degenerate |r'| = |r_z| is rational); gamma 1/4 hits non-square
      // |r'|^2 — the null face is the certificate
      let allWedgeAtEndpoints = true;
      let cosOnlyOnBoundary = true;
      let someNullAtQuarter = false;
      for (const r of pythagoreanFamily()) {
        for (const g of GAMMA_EXACT_GRID) {
          const faces = wedgeExactFaces(r, g);
          const isHalf = fEq(g, frac(1n, 2n)) || fEq(g, frac(0n));
          if (isHalf) {
            if (faces.wedge === null) allWedgeAtEndpoints = false;
            if (faces.cos === null && !faces.degenerate)
              cosOnlyOnBoundary = false;
          } else if (faces.cos === null && !faces.degenerate)
            someNullAtQuarter = true;
        }
      }
      const holds =
        allWedgeAtEndpoints && cosOnlyOnBoundary && someNullAtQuarter;
      return {
        holds,
        refuted: !holds,
        detail: `gamma in {0, 1/2}: wedge an exact rational on the whole family (${allWedgeAtEndpoints}), cos exact everywhere but the degenerate boundary (${cosOnlyOnBoundary}); gamma = 1/4: irrational (null) cos faces appear (${someNullAtQuarter}) — rationality is the rational-length condition, not a blanket`,
      };
    }
    case "WC6": {
      // the counterexample: r = (4/5, 0, 3/5) at gamma = 1/4
      const r: readonly [Frac, Frac, Frac] = [
        frac(4n, 5n),
        frac(0n),
        frac(3n, 5n),
      ];
      const faces = wedgeExactFaces(r, frac(1n, 4n));
      const refuted =
        faces.cos === null &&
        fEq(faces.nr2, frac(13n, 25n)) &&
        !isRatSquare(frac(13n, 25n));
      return {
        holds: !refuted,
        refuted,
        detail: `|r'|^2 = 13/25 with 13 not a square (BigInt): cos = sqrt(13)/5 outside Q — the spec's blanket rationality at gamma = 1/4 dies at this point`,
      };
    }
    case "WC7": {
      const cert = g7WedgeCertificate();
      const holds =
        cert.aboveLo &&
        cert.belowHi &&
        cert.floatDev <= 1e-15 &&
        fEq(cert.cosSq, frac(1n, 2n));
      return {
        holds,
        refuted: !holds,
        detail: `0.103553 < (sqrt 2 - 1)/4 < 0.103554 by exact squaring (${cert.aboveLo}, ${cert.belowHi}); cos^2 = 1/2 exact; dense-vs-field float deviation ${cert.floatDev.toExponential(3)}`,
      };
    }
    default:
      throw new Error(
        `wedge: WEDGE-CLAIM — unknown wedge claim id "${id}" — the table has WC1..WC7`,
      );
  }
}

// ---------------------------------------------------------------------------
// The counterfeit verifier — a handed-in exact wedge claim is re-derived.
// ---------------------------------------------------------------------------

export type WedgeFraudCode =
  | "NOT-PURE-INPUT"
  | "GAMMA-RANGE"
  | "DEGENERATE-OUTPUT"
  | "NOT-RATIONAL-POINT"
  | "FORGED-COS-SQUARE"
  | "FORGED-COS"
  | "FORGED-WEDGE";

export type WedgeVerdict =
  | { readonly ok: true; readonly code: "VERIFIED"; readonly detail: string }
  | {
      readonly ok: false;
      readonly code: WedgeFraudCode;
      readonly detail: string;
    };

/** A handed-in rationality claim: a pure rational r, a rational dephase
 *  strength, and the claimed exact cos^2 / cos / wedge. */
export interface RationalWedgeClaim {
  readonly r: readonly [Frac, Frac, Frac];
  readonly gamma: Frac;
  readonly claimedCosSq: Frac;
  readonly claimedCos: Frac;
  readonly claimedWedge: Frac;
}

/** Re-derives the exact faces and names every counterfeit kind — including
 *  the rationality laundering itself (a cos claimed rational where the field
 *  certificate says otherwise) and the degenerate boundary (an angle claimed
 *  where the output has no direction). */
export function verifyRationalWedgeClaim(
  claim: RationalWedgeClaim,
): WedgeVerdict {
  const normSq = fAdd(
    fAdd(fMul(claim.r[0], claim.r[0]), fMul(claim.r[1], claim.r[1])),
    fMul(claim.r[2], claim.r[2]),
  );
  if (!fEq(normSq, frac(1n))) {
    return {
      ok: false,
      code: "NOT-PURE-INPUT",
      detail: `|r|^2 = ${normSq.num}/${normSq.den}, not 1 — the exact faces are stated on pure rational inputs`,
    };
  }
  if (fCmp(claim.gamma, frac(0n)) < 0 || fCmp(claim.gamma, frac(1n, 2n)) > 0) {
    return {
      ok: false,
      code: "GAMMA-RANGE",
      detail: `gamma = ${claim.gamma.num}/${claim.gamma.den} outside [0, 1/2]`,
    };
  }
  const faces = wedgeExactFaces(claim.r, claim.gamma);
  if (faces.degenerate) {
    if (!fEq(claim.claimedWedge, frac(0n))) {
      return {
        ok: false,
        code: "FORGED-WEDGE",
        detail: `the fully-dephased equatorial output r' = 0 wedges NOTHING — the wedge is exactly 0, claimed ${claim.claimedWedge.num}/${claim.claimedWedge.den}`,
      };
    }
    return {
      ok: false,
      code: "DEGENERATE-OUTPUT",
      detail: `the fully-dephased equatorial output r' = 0 carries no angle — wedge is exactly 0, cos is undefined; a claimed rational cos/cos^2 is meaningless on this boundary`,
    };
  }
  if (!fEq(claim.claimedCosSq, faces.cosSq!)) {
    return {
      ok: false,
      code: "FORGED-COS-SQUARE",
      detail: `claimed cos^2 = ${claim.claimedCosSq.num}/${claim.claimedCosSq.den}, the machine derives ${faces.cosSq!.num}/${faces.cosSq!.den}`,
    };
  }
  if (faces.cos === null || faces.wedge === null) {
    return {
      ok: false,
      code: "NOT-RATIONAL-POINT",
      detail: `|r'|^2 = ${faces.nr2.num}/${faces.nr2.den} is not a square in Q — cos and wedge live OUTSIDE the rationals here (cos^2 = ${faces.cosSq!.num}/${faces.cosSq!.den} is the rational certificate); a claimed rational cos is laundering`,
    };
  }
  if (!fEq(claim.claimedCos, faces.cos)) {
    return {
      ok: false,
      code: "FORGED-COS",
      detail: `claimed cos = ${claim.claimedCos.num}/${claim.claimedCos.den}, the machine derives ${faces.cos.num}/${faces.cos.den}`,
    };
  }
  if (!fEq(claim.claimedWedge, faces.wedge)) {
    return {
      ok: false,
      code: "FORGED-WEDGE",
      detail: `claimed wedge = ${claim.claimedWedge.num}/${claim.claimedWedge.den}, the machine derives ${faces.wedge.num}/${faces.wedge.den}`,
    };
  }
  return {
    ok: true,
    code: "VERIFIED",
    detail: `re-derived: cos^2 = ${faces.cosSq!.num}/${faces.cosSq!.den}, cos = ${faces.cos.num}/${faces.cos.den}, wedge = ${faces.wedge.num}/${faces.wedge.den}`,
  };
}
