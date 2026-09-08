/**
 * Exact rational interval arithmetic — the kernel of the interior theorem.
 *
 * v0.1.0 shipped the withdrawal curve's interior as DATA (float values,
 * monotone on the grid because the floats came out sorted). v0.2.0 upgrades
 * the monotonicity of net(p) = (1 - h2((1-p)/2))/2 to a machine theorem:
 * every comparison below is an exact BigInt rational comparison; the only
 * transcendental step (ln) is enclosed by series whose partial sums are
 * exact rationals and whose tails carry rigorous closed-form bounds. No
 * floating-point number enters any certificate.
 *
 * Fractions are stored UNREDUCED (sign normalized to the denominator): gcd
 * reduction of ~380-bit denominators buys nothing — comparisons are
 * cross-multiplications, exact either way.
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
/** 1/a, a != 0. */
export const fRecip = (a: Frac): Frac => fDiv(F_ONE, a);

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

/** Parse a decimal string ("0.0025", "9e-22") into an exact Frac. */
export function frDec(s: string): Frac {
  const m = /^(-?)(\d+)(?:\.(\d+))?(?:e(-?\d+))?$/i.exec(s.trim());
  if (m === null) throw new Error(`frDec: cannot parse "${s}"`);
  const [, signRaw, intRaw, fracRaw, expRaw] = m;
  if (signRaw === undefined || intRaw === undefined) throw new Error(`frDec: cannot parse "${s}"`);
  const exp = expRaw !== undefined ? Number(expRaw) : 0;
  const digits = BigInt(intRaw + (fracRaw ?? ""));
  const power = exp - (fracRaw ?? "").length;
  const abs = power >= 0 ? { n: digits * 10n ** BigInt(power), d: 1n } : { n: digits, d: 10n ** BigInt(-power) };
  return signRaw === "-" ? { n: -abs.n, d: abs.d } : abs;
}

/**
 * Double preview (display only — never enters a certificate). Falls back to
 * decimal long division when either limb overflows a double (BigInt limbs of
 * ~380-bit denominators make the naive Number(n)/Number(d) a NaN of
 * Infinity/Infinity — caught on v0.2.0's first render).
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
export const iMul = (a: Ivl, b: Ivl): Ivl => {
  const cands = [fMul(a.lo, b.lo), fMul(a.lo, b.hi), fMul(a.hi, b.lo), fMul(a.hi, b.hi)];
  let lo = cands[0]!;
  let hi = cands[0]!;
  for (const c of cands) {
    if (fCmp(c, lo) < 0) lo = c;
    if (fCmp(c, hi) > 0) hi = c;
  }
  return { lo, hi };
};
/** Divide by an interval KNOWN to be strictly positive. */
export const iDivPos = (a: Ivl, b: Ivl): Ivl => {
  if (fIsNeg(b.lo) || fIsZero(b.lo)) throw new Error("iDivPos: divisor not strictly positive");
  return { lo: fDiv(a.lo, b.hi), hi: fDiv(a.hi, b.lo) };
};
export const iWidth = (a: Ivl): Frac => fSub(a.hi, a.lo);
/** Exact overlap test: the two enclosures admit a common point. */
export const iOverlap = (a: Ivl, b: Ivl): boolean => fCmp(a.lo, b.hi) <= 0 && fCmp(b.lo, a.hi) <= 0;

// --- ln by exact series with rigorous tails -------------------------------------------------

const LN_TERMS = 64; // tail <= (1/2)^64/65 ~ 8.4e-22 per reduction

/**
 * -ln(m) for m in [1/2, 1) EXACT rational: with t = 1 - m in (0, 1/2],
 *   -ln(m) = ln(1/(1-t)) = sum_{k>=1} t^k / k, and the tail obeys
 *   sum_{k>K} t^k/k <= t^{K+1}/((K+1)(1-t)) = t^{K+1}/((K+1) m).
 *   Partial sum exact; tail bound exact.
 */
function negLnMantissa(m: Frac): Ivl {
  const t = fSub(F_ONE, m);
  const tf = t;
  if (fIsNeg(tf) || fIsZero(tf)) throw new Error("negLnMantissa: t out of (0,1/2]");
  let s = F_ZERO;
  let tk = tf; // t^k at k = 1
  for (let k = 1; k <= LN_TERMS; k++) {
    s = fAdd(s, fDiv(tk, fr(k)));
    tk = fMul(tk, tf);
  }
  const tail = fDiv(tk, fMul(fr(LN_TERMS + 1), m)); // t^{K+1}/((K+1) m), tk now t^{K+1}
  return { lo: s, hi: fAdd(s, tail) };
}

/** ln 2 enclosure: ln 2 = sum (1/2)^k/k, tail <= (1/2)^K/(K+1) (t=1/2: 1/(1-t)=2). */
export const LN2: Ivl = (() => {
  const half = F_HALF;
  let s = F_ZERO;
  let tk = half;
  for (let k = 1; k <= LN_TERMS; k++) {
    s = fAdd(s, fDiv(tk, fr(k)));
    tk = fMul(tk, half);
  }
  const tail = fDiv(fMul(fr(2), tk), fr(LN_TERMS + 1)); // 2 (1/2)^{K+1}/(K+1) = (1/2)^K/(K+1)
  return { lo: s, hi: fAdd(s, tail) };
})();

/**
 * -ln(x) for x in (0, 1) rational: normalize x = m * 2^e with m in [1/2, 1)
 * (e an integer <= 0), then -ln(x) = -ln(m) + e * ln... - e*ln2 -> -ln m - e ln 2.
 * With e <= 0: -ln(x) = negLnMantissa(m) + (-e) * ln2, both enclosures positive.
 */
export function negLn(x: Frac): Ivl {
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
  const mant = negLnMantissa(m); // -ln(m)
  if (e === 0) return mant;
  // -ln(x) = -ln(m) - e ln2; e <= 0 here (x < 1), so -e >= 0 scales ln2 up
  const shift = iScaleNonneg(LN2, fr(-e));
  return iAdd(mant, shift);
}

// --- h2 on two independent rigorous paths ---------------------------------------------------

/**
 * Path A (closed form): h2(q) = (-q ln q - (1-q) ln(1-q)) / ln 2.
 * Endpoints q = 0 (limit 0) and q = 1/2 (limit 1) are the closed-form
 * constants — the same discipline as v0.1.0's W-E: the series is quoted
 * only where it converges; the limits are exact.
 */
export function h2Closed(q: Frac): Ivl {
  if (fIsZero(q)) return iOf(F_ZERO);
  if (fCmp(q, F_HALF) === 0) return iOf(F_ONE);
  if (fCmp(q, F_ZERO) <= 0 || fCmp(q, F_ONE) >= 0) throw new Error("h2Closed: q outside [0,1]");
  const oneMinusQ = fSub(F_ONE, q);
  const numer = iAdd(iScaleNonneg(negLn(q), q), iScaleNonneg(negLn(oneMinusQ), oneMinusQ));
  return iDivPos(numer, LN2);
}

const SERIES_TERMS = 512; // handles d^2 up to (19/20)^2 with tail < 1e-30

/**
 * Path B (Taylor around the maximum): h2(q) = 1 - sum_{k>=1} d^{2k}/(2 ln2 * k(2k-1)),
 * d = 1-2q. Partial sum exact; the tail obeys
 *   sum_{k>K} d^{2k}/(k(2k-1)) <= d^{2(K+1)} / ((K+1)(2K+1)(1-d^2)).
 * q = 1/2 (d = 0) returns the exact constant 1; q = 0 (d = 1) is refused —
 * the honest exclusion, matching W-E's open-grid discipline.
 */
export function h2Series(q: Frac): Ivl {
  if (fCmp(q, F_HALF) === 0) return iOf(F_ONE);
  if (fCmp(q, F_ZERO) <= 0 || fCmp(q, F_ONE) >= 0) {
    throw new Error("h2Series: q outside (0,1) with q != 1/2");
  }
  const d = fSub(F_ONE, fMul(fr(2), q)); // 1 - 2q, in (-1,1) \ {0}
  const d2 = fMul(d, d); // in (0,1)
  let psum = F_ZERO;
  let d2k = d2;
  for (let k = 1; k <= SERIES_TERMS; k++) {
    psum = fAdd(psum, fDiv(d2k, fr(k * (2 * k - 1))));
    d2k = fMul(d2k, d2);
  }
  // S = sum_{k>K} term, S <= d2^{K+1}/((K+1)(2K+1)(1-d2)) — d2k is now d2^{K+1}
  const tail = fDiv(d2k, fMul(fr((SERIES_TERMS + 1) * (2 * (SERIES_TERMS + 1) - 1)), fSub(F_ONE, d2)));
  // h2 = 1 - S/(2 ln2), S in [psum, psum+tail]:
  const ratio = iDivPos(ivl(psum, fAdd(psum, tail)), iScaleNonneg(LN2, fr(2)));
  return iSub(iOf(F_ONE), ratio);
}

/** net(p) = (1 - h2((1-p)/2))/2 on either path. */
export function netOnPath(p: Frac, path: (q: Frac) => Ivl): Ivl {
  const q = fDiv(fSub(F_ONE, p), fr(2));
  return iScaleNonneg(iSub(iOf(F_ONE), path(q)), F_HALF);
}
