/**
 * The h₂(1/40) exact rational interval certificate (R20; spec R18 agentF
 * F5-b — "候选 9").
 *
 * W-E's float witness (audit.ts, |h − 0.168660931| < 1e-6) is upgraded to a
 * strict BigInt enclosure, two independent convergence roads:
 *
 *   HC1  every log the anchor needs — ln2, ln(5/4), ln(40/39), and the
 *        spec-literal identity ln(41/40) = 2·artanh(1/81) — is enclosed
 *        twice: road 1 by positive artanh series with a geometric tail
 *        bound (artanh(x) = Σ x^{2k+1}/(2k+1), remainder ≤
 *        x^{2K+3}/((2K+3)(1−x²))), road 2 by ln(1+x) alternating series
 *        (Leibniz partial-sum brackets) or the −ln(1−x) positive series.
 *        The two intervals overlap.
 *   HC2  h₂(1/40) = (1/40)·log₂40 + (39/40)·log₂(40/39) with
 *        ln40 = 5·ln2 + ln(5/4), interval-divided by ln2: the combined
 *        (intersected) width is < 1e-15 in EXACT BigInt comparison — the
 *        machine actually delivers < 1e-20.
 *   HC3  the float double agrees with the certificate within 5e-16 (float
 *        noise budget; the double itself carries ~1 ulp, so the claim is
 *        agreement, not containment inside the strict interval).
 *   HC4  the ledger row's six-digit number 0.168661 is bracketed exactly:
 *        both ends of the combined interval sit inside the 6th-decimal
 *        rounding window [0.1686605, 0.1686615].
 *
 * Negative controls (test/h2-certificate.test.ts): the tail-omitted partial
 * sum at K=2 (convicted below the certified lower bound by ~1.4e-4), the
 * forged shifted interval (1e-13 ≫ width), and the wrong-point value h₂(1/41)
 * — all three convicted by the faces above.
 *
 * Everything here is BigInt rationals; the ONLY float faces are the
 * cross-check against Math.log2 (documented as such). Zero dependencies —
 * the fraction core is this file's own (the R18 spec's "纯测试层" upgraded
 * to a kernel file, mirroring restart-threshold's route in v0.4.0).
 */

export interface Frac {
  readonly n: bigint;
  readonly d: bigint;
}

export interface Ivl {
  readonly lo: Frac;
  readonly hi: Frac;
}

export interface H2LogRow {
  readonly name: string;
  readonly route1: Ivl;
  readonly route2: Ivl;
  readonly overlap: boolean;
  readonly widthRoute1: Frac;
  readonly widthRoute2: Frac;
  readonly detail: string;
}

export interface H2ClaimRow {
  readonly id: string;
  readonly claim: string;
  readonly pass: boolean;
  readonly detail: string;
}

export interface H2Certificate {
  readonly logs: readonly H2LogRow[];
  readonly h2: {
    readonly route1: Ivl;
    readonly route2: Ivl;
    readonly combined: Ivl;
    readonly combinedWidth: Frac;
    readonly floatNote: string;
  };
  readonly claims: readonly H2ClaimRow[];
  readonly summary: string;
}

/** Named refusal — a series argument outside (0,1) has no enclosure, and a
 *  silent NaN cell would read as a pass in every comparison downstream. */
export class H2CertificateError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(`[${code}] ${message}`);
    this.code = code;
    this.name = "H2CertificateError";
  }
}

const gcd = (a: bigint, b: bigint): bigint => {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
};

export const fr = (n: bigint, d = 1n): Frac => {
  if (d === 0n)
    throw new H2CertificateError("H2_ZERO_DENOMINATOR", "fr: denominator 0");
  const sign = d < 0n ? -1n : 1n;
  const dd = d < 0n ? -d : d;
  const g = gcd(n, dd) || 1n;
  return { n: (sign * n) / g, d: dd / g };
};

export const fAdd = (a: Frac, b: Frac): Frac =>
  fr(a.n * b.d + b.n * a.d, a.d * b.d);
export const fSub = (a: Frac, b: Frac): Frac =>
  fr(a.n * b.d - b.n * a.d, a.d * b.d);
export const fMul = (a: Frac, b: Frac): Frac => fr(a.n * b.n, a.d * b.d);
export const fDiv = (a: Frac, b: Frac): Frac => {
  if (b.n === 0n)
    throw new H2CertificateError(
      "H2_ZERO_DENOMINATOR",
      "fDiv: division by zero",
    );
  return fr(a.n * b.d, a.d * b.n);
};
export const fCmp = (a: Frac, b: Frac): number => {
  const l = a.n * b.d;
  const r = b.n * a.d;
  return l < r ? -1 : l > r ? 1 : 0;
};

const width = (a: Ivl): Frac => fSub(a.hi, a.lo);
const overlap = (a: Ivl, b: Ivl): boolean =>
  fCmp(a.hi, b.lo) >= 0 && fCmp(b.hi, a.lo) >= 0;
const intersect = (a: Ivl, b: Ivl): Ivl => ({
  lo: fCmp(a.lo, b.lo) > 0 ? a.lo : b.lo,
  hi: fCmp(a.hi, b.hi) < 0 ? a.hi : b.hi,
});
/** positive intervals only (every log here is positive) */
const mulPos = (a: Ivl, b: Ivl): Ivl => {
  const c1 = fMul(a.lo, b.lo);
  const c2 = fMul(a.lo, b.hi);
  const c3 = fMul(a.hi, b.lo);
  const c4 = fMul(a.hi, b.hi);
  return {
    lo: [c1, c2, c3, c4].reduce((u, v) => (fCmp(v, u) < 0 ? v : u)),
    hi: [c1, c2, c3, c4].reduce((u, v) => (fCmp(v, u) > 0 ? v : u)),
  };
};
const divPos = (a: Ivl, b: Ivl): Ivl => {
  const c1 = fDiv(a.lo, b.hi);
  const c2 = fDiv(a.hi, b.lo);
  return {
    lo: fCmp(c1, c2) < 0 ? c1 : c2,
    hi: fCmp(c1, c2) > 0 ? c1 : c2,
  };
};
const scaleIvl = (k: Frac, a: Ivl): Ivl => mulPos({ lo: k, hi: k }, a);

const checkDomain = (num: bigint, den: bigint, what: string): void => {
  if (den <= 0n)
    throw new H2CertificateError(
      "H2_SERIES_DOMAIN",
      `${what}: denominator must be positive, got ${den}`,
    );
  if (num <= 0n || num >= den)
    throw new H2CertificateError(
      "H2_SERIES_DOMAIN",
      `${what}: need 0 < num/den < 1, got ${num}/${den}`,
    );
};

/** artanh(x) for x = num/den ∈ (0,1), strict enclosure:
 *  partial sum S_K (lower) + geometric tail bound (upper). */
export function artanhInterval(num: bigint, den: bigint, terms: number): Ivl {
  checkDomain(num, den, "artanhInterval");
  const x = fr(num, den);
  const x2 = fMul(x, x);
  let sum = fr(0n);
  let term = x; // x^{2k+1} at k = 0
  for (let k = 0; k <= terms; k++) {
    sum = fAdd(sum, fr(term.n, term.d * BigInt(2 * k + 1)));
    term = fMul(term, x2);
  }
  // remainder ≤ term(k=terms+1 head, undivided) / ((2K+3)·(1−x²))
  const tailHead = fr(term.n, term.d * BigInt(2 * terms + 3));
  const oneMinusX2 = fSub(fr(1n), x2);
  const bound = fMul(tailHead, fDiv(fr(oneMinusX2.d, oneMinusX2.n), fr(1n)));
  return { lo: sum, hi: fAdd(sum, bound) };
}

/** ln(1+x) for x = num/den ∈ (0,1), strict enclosure by the alternating
 *  series: S_{2m+1} is an upper bound, S_{2m+1} − x^{2m+2}/(2m+2) a lower. */
export function ln1pAlternatingInterval(
  num: bigint,
  den: bigint,
  m: number,
): Ivl {
  checkDomain(num, den, "ln1pAlternatingInterval");
  const x = fr(num, den);
  let sum = fr(0n);
  let term = x; // x^k
  for (let k = 1; k <= 2 * m + 1; k++) {
    sum =
      k % 2 === 1
        ? fAdd(sum, fr(term.n, term.d * BigInt(k)))
        : fSub(sum, fr(term.n, term.d * BigInt(k)));
    term = fMul(term, x);
  }
  const drop = fr(term.n, term.d * BigInt(2 * m + 2));
  return { lo: fSub(sum, drop), hi: sum };
}

/** −ln(1−x) for x = num/den ∈ (0,1) (a positive number), strict enclosure:
 *  partial sum S_K (lower) + geometric tail (upper). */
export function negLn1mInterval(num: bigint, den: bigint, terms: number): Ivl {
  checkDomain(num, den, "negLn1mInterval");
  const x = fr(num, den);
  let sum = fr(0n);
  let term = x; // x^k
  for (let k = 1; k <= terms; k++) {
    sum = fAdd(sum, fr(term.n, term.d * BigInt(k)));
    term = fMul(term, x);
  }
  const tailHead = fr(term.n, term.d * BigInt(terms + 1));
  const oneMinusX = fSub(fr(1n), x);
  const bound = fMul(tailHead, fDiv(fr(oneMinusX.d, oneMinusX.n), fr(1n)));
  return { lo: sum, hi: fAdd(sum, bound) };
}

/** The raw partial sum WITHOUT any tail bound — the negative control's
 *  forged "certificate" (what a tail-omission smuggler would hand over). */
export function partialSumOnly(num: bigint, den: bigint, terms: number): Frac {
  checkDomain(num, den, "partialSumOnly");
  const x = fr(num, den);
  const x2 = fMul(x, x);
  let sum = fr(0n);
  let term = x;
  for (let k = 0; k <= terms; k++) {
    sum = fAdd(sum, fr(term.n, term.d * BigInt(2 * k + 1)));
    term = fMul(term, x2);
  }
  return sum;
}

/** h₂(1/40) from a triple of log intervals: ln2, ln(5/4), ln(40/39). */
function h2From(ln2: Ivl, ln54: Ivl, ln4039: Ivl): Ivl {
  const ln40 = {
    lo: fAdd(fMul(fr(5n), ln2.lo), ln54.lo),
    hi: fAdd(fMul(fr(5n), ln2.hi), ln54.hi),
  };
  const log2_40 = divPos(ln40, ln2);
  const log2_4039 = divPos(ln4039, ln2);
  const t1 = scaleIvl(fr(1n, 40n), log2_40);
  const t2 = scaleIvl(fr(39n, 40n), log2_4039);
  return { lo: fAdd(t1.lo, t2.lo), hi: fAdd(t1.hi, t2.hi) };
}

const asFloat = (a: Frac): number => Number(a.n) / Number(a.d);
const fmt = (a: Frac): string => asFloat(a).toPrecision(18);

/** The assembled certificate. Term counts are fixed constants — every width
 *  they leave is machine-reported in the rows, never asserted silently. */
export function certifyH2AtOneFortieth(): H2Certificate {
  // road 1: artanh series (ln2 = 2·artanh(1/3), ln(5/4) = 2·artanh(1/9),
  // ln(40/39) = 2·artanh(1/79), ln(41/40) = 2·artanh(1/81))
  const ln2R1 = scaleIvl(fr(2n), artanhInterval(1n, 3n, 30));
  const ln54R1 = scaleIvl(fr(2n), artanhInterval(1n, 9n, 12));
  const ln4039R1 = scaleIvl(fr(2n), artanhInterval(1n, 79n, 6));
  const ln4140R1 = scaleIvl(fr(2n), artanhInterval(1n, 81n, 6));
  // road 2: ln2 = −ln(1−1/2) positive series; the others alternating ln(1+x)
  const ln2R2 = negLn1mInterval(1n, 2n, 80);
  const ln54R2 = ln1pAlternatingInterval(1n, 4n, 20);
  const ln4039R2 = ln1pAlternatingInterval(1n, 39n, 8);
  const ln4140R2 = ln1pAlternatingInterval(1n, 40n, 8);

  const logPairs: ReadonlyArray<{ name: string; r1: Ivl; r2: Ivl }> = [
    { name: "ln2", r1: ln2R1, r2: ln2R2 },
    { name: "ln(5/4)", r1: ln54R1, r2: ln54R2 },
    { name: "ln(40/39)", r1: ln4039R1, r2: ln4039R2 },
    { name: "ln(41/40)", r1: ln4140R1, r2: ln4140R2 },
  ];
  const logs: H2LogRow[] = logPairs.map((p) => ({
    name: p.name,
    route1: p.r1,
    route2: p.r2,
    overlap: overlap(p.r1, p.r2),
    widthRoute1: width(p.r1),
    widthRoute2: width(p.r2),
    detail: `road1 [${fmt(p.r1.lo)}, ${fmt(p.r1.hi)}] w=${asFloat(width(p.r1)).toExponential(2)}; road2 [${fmt(p.r2.lo)}, ${fmt(p.r2.hi)}] w=${asFloat(width(p.r2)).toExponential(2)}`,
  }));

  const route1 = h2From(ln2R1, ln54R1, ln4039R1);
  const route2 = h2From(ln2R2, ln54R2, ln4039R2);
  const combined = intersect(route1, route2);
  const combinedWidth = width(combined);

  const floatH2 =
    -(1 / 40) * Math.log2(1 / 40) - (39 / 40) * Math.log2(39 / 40);
  const mid = (asFloat(combined.lo) + asFloat(combined.hi)) / 2;
  const floatNote = `the float double ${floatH2.toPrecision(18)} sits ${Math.abs(mid - floatH2).toExponential(2)} from the certificate midpoint — agreement within its own ~1 ulp of rounding, not containment`;

  const claims: H2ClaimRow[] = [
    {
      id: "HC1",
      claim:
        "every log is enclosed twice (positive artanh + geometric tail vs alternating/positive ln-series) and the two strict intervals overlap",
      pass: logs.every((r) => r.overlap),
      detail: logs.map((r) => `${r.name}: overlap=${r.overlap}`).join("; "),
    },
    {
      id: "HC2",
      claim:
        "the combined h2(1/40) interval width is < 1e-15 in exact BigInt comparison (the machine delivers < 1e-20)",
      pass:
        fCmp(combinedWidth, fr(1n, 10n ** 15n)) < 0 &&
        fCmp(combinedWidth, fr(1n, 10n ** 20n)) < 0,
      detail: `combined width ${asFloat(combinedWidth).toExponential(3)} = ${combinedWidth.n}/${combinedWidth.d}; road1 [${fmt(route1.lo)}, ${fmt(route1.hi)}]; road2 [${fmt(route2.lo)}, ${fmt(route2.hi)}]`,
    },
    {
      id: "HC3",
      claim:
        "the float double agrees with the certificate within 5e-16 (float-noise budget — agreement, not containment)",
      pass: Math.abs(mid - floatH2) <= 5e-16,
      detail: floatNote,
    },
    {
      id: "HC4",
      claim:
        "the ledger row's six-digit number 0.168661 is bracketed exactly: both ends inside [0.1686605, 0.1686615]",
      pass:
        fCmp(combined.lo, fr(1686605n, 10n ** 7n)) >= 0 &&
        fCmp(combined.hi, fr(1686615n, 10n ** 7n)) <= 0,
      detail: `combined [${fmt(combined.lo)}, ${fmt(combined.hi)}] inside the 6th-decimal rounding window of 0.168661`,
    },
  ];

  const allPass = claims.every((r) => r.pass);
  return {
    logs,
    h2: { route1, route2, combined, combinedWidth, floatNote },
    claims,
    summary:
      `h2(1/40) certified: ${claims.filter((r) => r.pass).length}/${claims.length} rows hold, width ${asFloat(combinedWidth).toExponential(3)} < 1e-15 (BigInt-exact verdict), ` +
      `the W-E ledger number 0.168661 bracketed — ${allPass ? "the float witness now has its exact brackets" : "AT LEAST ONE ROW FAILED"}`,
  };
}
