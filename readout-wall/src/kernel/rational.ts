/**
 * Exact rational interval arithmetic — the kernel of the interior theorem.
 *
 * v0.1.0 shipped the weak-readout curve's interior as DATA (float values,
 * monotone on the grid because the floats came out sorted). v0.2.0 upgrades
 * the ESC18 curve — and its two sibling families — to machine certificates:
 * every comparison below is an exact BigInt rational comparison; the only
 * transcendental step (ln) is enclosed by TWO independent series whose partial
 * sums are exact rationals and whose tails carry rigorous closed-form bounds.
 * No floating-point number enters any certificate.
 *
 * Fractions are stored UNREDUCED (sign normalized to the denominator): gcd
 * reduction of wide denominators buys nothing — comparisons are
 * cross-multiplications, exact either way. (Method mirrored from
 * nosignal-tariff v0.2.0's rational kernel, independently re-derived here.)
 */

export interface Frac {
  readonly n: bigint;
  readonly d: bigint; // > 0
}

export function fr(n: bigint | number, d: bigint | number = 1n): Frac {
  const bn = typeof n === "bigint" ? n : BigInt(n);
  const bd = typeof d === "bigint" ? d : BigInt(d);
  if (bd === 0n) throw new Error("fr: zero denominator");
  if (bd < 0n) {
    return { n: -bn, d: -bd };
  }
  return { n: bn, d: bd };
}

export const F_ZERO: Frac = { n: 0n, d: 1n };
export const F_ONE: Frac = { n: 1n, d: 1n };
export const F_HALF: Frac = { n: 1n, d: 2n };

export const fAdd = (a: Frac, b: Frac): Frac => ({ n: a.n * b.d + b.n * a.d, d: a.d * b.d });
export const fSub = (a: Frac, b: Frac): Frac => ({ n: a.n * b.d - b.n * a.d, d: a.d * b.d });
export const fMul = (a: Frac, b: Frac): Frac => ({ n: a.n * b.n, d: a.d * b.d });
export const fDiv = (a: Frac, b: Frac): Frac => {
  if (b.n === 0n) throw new Error("fDiv: zero divisor");
  return b.n < 0n ? { n: -a.n * b.d, d: a.d * -b.n } : { n: a.n * b.d, d: a.d * b.n };
};
export const fNeg = (a: Frac): Frac => ({ n: -a.n, d: a.d });
export const fIsZero = (a: Frac): boolean => a.n === 0n;
export const fIsNeg = (a: Frac): boolean => a.n < 0n;
export const fCmp = (a: Frac, b: Frac): number => {
  const l = a.n * b.d;
  const r = b.n * a.d;
  return l < r ? -1 : l > r ? 1 : 0;
};

/** Decimal rendering by exact long division (no rounding of the last digit). */
export function fDecimal(a: Frac, digits: number): string {
  const neg = a.n < 0n;
  const n = neg ? -a.n : a.n;
  const int = n / a.d;
  let rem = n % a.d;
  let frac = "";
  for (let i = 0; i < digits; i++) {
    rem *= 10n;
    frac += (rem / a.d).toString();
    rem %= a.d;
  }
  const s = int.toString() + (frac.length > 0 ? "." + frac : "");
  return neg && (int !== 0n || rem !== 0n) ? "-" + s : s;
}

/**
 * Double preview (display only — never enters a certificate). Falls back to
 * decimal long division when either limb overflows a double (BigInt limbs of
 * wide denominators make the naive Number(n)/Number(d) a NaN of
 * Infinity/Infinity).
 */
export const fToNumber = (a: Frac): number => {
  const LIMB = 9007199254740992n; // 2^53
  if (a.n >= -LIMB && a.n <= LIMB && a.d <= LIMB) return Number(a.n) / Number(a.d);
  return Number(fDecimal(a, 40));
};

// --- intervals: lo <= hi, both exact ------------------------------------------------------

export interface Ivl {
  readonly lo: Frac;
  readonly hi: Frac;
}

export const ivl = (lo: Frac, hi: Frac): Ivl => {
  if (fCmp(lo, hi) > 0) throw new Error("ivl: lo > hi");
  return { lo, hi };
};
export const iOf = (a: Frac): Ivl => ({ lo: a, hi: a });
export const iAdd = (a: Ivl, b: Ivl): Ivl => ({ lo: fAdd(a.lo, b.lo), hi: fAdd(a.hi, b.hi) });
export const iSub = (a: Ivl, b: Ivl): Ivl => ({ lo: fSub(a.lo, b.hi), hi: fSub(a.hi, b.lo) });
export const iNeg = (a: Ivl): Ivl => ({ lo: fNeg(a.hi), hi: fNeg(a.lo) });
/** Multiply by a NONNEGATIVE rational scalar. */
export const iScaleNonneg = (a: Ivl, s: Frac): Ivl => {
  if (fIsNeg(s)) throw new Error("iScaleNonneg: negative scalar");
  return { lo: fMul(a.lo, s), hi: fMul(a.hi, s) };
};
/** Divide by an interval KNOWN to be strictly positive. */
export const iDivPos = (a: Ivl, b: Ivl): Ivl => {
  if (fIsNeg(b.lo) || fIsZero(b.lo)) throw new Error("iDivPos: divisor not strictly positive");
  return { lo: fDiv(a.lo, b.hi), hi: fDiv(a.hi, b.lo) };
};
export const iWidth = (a: Ivl): Frac => fSub(a.hi, a.lo);
/** Exact overlap test: the two enclosures admit a common point. */
export const iOverlap = (a: Ivl, b: Ivl): boolean => fCmp(a.lo, b.hi) <= 0 && fCmp(b.lo, a.hi) <= 0;

// --- ln on two independent series paths ----------------------------------------------------

/**
 * Path T (mantissa t-series): for m in [1/2, 1), with t = 1 - m in (0, 1/2],
 *   -ln(m) = sum_{k>=1} t^k / k,
 * tail <= t^{K+1}/((K+1)(1-t)) = t^{K+1}/((K+1) m). Partial sum exact, tail
 * bound exact.
 */
const LN_TERMS_T = 64;

function negLnMantissaT(m: Frac): Ivl {
  const t = fSub(F_ONE, m);
  if (fIsNeg(t) || fIsZero(t)) throw new Error("negLnMantissaT: t outside (0,1/2]");
  let s = F_ZERO;
  let tk = t;
  for (let k = 1; k <= LN_TERMS_T; k++) {
    s = fAdd(s, fDiv(tk, fr(k)));
    tk = fMul(tk, t);
  }
  const tail = fDiv(tk, fMul(fr(LN_TERMS_T + 1), m));
  return { lo: s, hi: fAdd(s, tail) };
}

/** ln 2 on path T: ln 2 = sum (1/2)^k / k, tail <= 2 (1/2)^{K+1}/(K+1). */
export const LN2_T: Ivl = (() => {
  let s = F_ZERO;
  let tk = F_HALF;
  for (let k = 1; k <= LN_TERMS_T; k++) {
    s = fAdd(s, fDiv(tk, fr(k)));
    tk = fMul(tk, F_HALF);
  }
  const tail = fDiv(fMul(fr(2), tk), fr(LN_TERMS_T + 1));
  return { lo: s, hi: fAdd(s, tail) };
})();

/**
 * Path A (atanh series): for m in [1/2, 1), with w = (1-m)/(1+m) in (0, 1/3],
 *   -ln(m) = 2 sum_{k>=0} w^{2k+1}/(2k+1),
 * tail <= 2 w^{2K+3} / ((2K+3)(1-w^2)). Partial sum exact, tail bound exact.
 * Independent of path T: different series, different convergence mechanism.
 */
const LN_TERMS_A = 32; // w <= 1/3 -> (1/9)^32 ~ 1e-31 before the tail

function negLnMantissaA(m: Frac): Ivl {
  const w = fDiv(fSub(F_ONE, m), fAdd(F_ONE, m));
  if (fIsNeg(w) || fIsZero(w)) throw new Error("negLnMantissaA: w outside (0,1/3]");
  let s = F_ZERO;
  const w2 = fMul(w, w);
  let wk = w; // w^{2k+1} at k = 0
  for (let k = 0; k < LN_TERMS_A; k++) {
    s = fAdd(s, fDiv(wk, fr(2 * k + 1)));
    wk = fMul(wk, w2);
  }
  // -ln(m) = 2 sum_{k>=0} w^{2k+1}/(2k+1) — the leading 2 is the whole point
  // (an earlier draft dropped it; the chi certificates survived by accidental
  // cancellation in fTerm's ln2 denominator, but the ln2 enclosure did not)
  const two = fr(2);
  const lo = fMul(two, s);
  const tail = fMul(two, fDiv(wk, fMul(fr(2 * LN_TERMS_A + 1), fSub(F_ONE, w2))));
  return { lo, hi: fAdd(lo, tail) };
}

/** ln 2 on path A: m = 1/2, w = 1/3. */
export const LN2_A: Ivl = (() => {
  const w = fr(1, 3);
  let s = F_ZERO;
  const w2 = fMul(w, w);
  let wk = w;
  for (let k = 0; k < LN_TERMS_A; k++) {
    s = fAdd(s, fDiv(wk, fr(2 * k + 1)));
    wk = fMul(wk, w2);
  }
  const two = fr(2);
  const lo = fMul(two, s);
  const tail = fMul(two, fDiv(wk, fMul(fr(2 * LN_TERMS_A + 1), fSub(F_ONE, w2))));
  return { lo, hi: fAdd(lo, tail) };
})();

export type LnPath = {
  readonly negLnMantissa: (m: Frac) => Ivl;
  readonly ln2: Ivl;
};

export const PATH_T: LnPath = { negLnMantissa: negLnMantissaT, ln2: LN2_T };
export const PATH_A: LnPath = { negLnMantissa: negLnMantissaA, ln2: LN2_A };
export const LN_PATHS: readonly LnPath[] = [PATH_T, PATH_A];

/**
 * -ln(x) for x in (0, 1) rational on the given path: normalize x = m * 2^e
 * with m in [1/2, 1) (e an integer <= 0), then -ln(x) = -ln(m) + (-e) ln 2.
 */
export function negLn(x: Frac, path: LnPath = PATH_T): Ivl {
  if (fCmp(x, F_ZERO) <= 0 || fCmp(x, F_ONE) >= 0) {
    throw new Error("negLn: x outside (0,1)");
  }
  let m = x;
  let e = 0;
  while (fCmp(m, F_ONE) >= 0) {
    m = fMul(m, F_HALF);
    e++;
  }
  while (fCmp(m, F_HALF) < 0) {
    m = fMul(m, fr(2));
    e--;
  }
  const mant = path.negLnMantissa(m);
  if (e === 0) return mant;
  const shift = iScaleNonneg(path.ln2, fr(-e));
  return iAdd(mant, shift);
}

/**
 * The entropy term -q log2 q as an exact enclosure on the given path, for
 * rational q in [0, 1]: q * (-ln q) / ln 2. The endpoints contribute exactly
 * nothing (-0 log 0 = -1 log 1 = 0) and are returned as exact constants —
 * the series is quoted only where it converges.
 */
export function fTerm(q: Frac, path: LnPath = PATH_T): Ivl {
  if (fIsZero(q)) return iOf(F_ZERO);
  if (fCmp(q, F_ONE) === 0) return iOf(F_ZERO);
  if (fCmp(q, F_ZERO) < 0 || fCmp(q, F_ONE) > 0) {
    throw new Error(`fTerm: q outside [0,1]`);
  }
  return iDivPos(iScaleNonneg(negLn(q, path), q), path.ln2);
}
