/**
 * Exact rational and multivariate-polynomial arithmetic over BigInt — the
 * arithmetic layer of the continuum derivation (T5-T8).
 *
 * A continuum identity is verified COEFFICIENT-WISE: checking that a
 * polynomial difference is the ZERO POLYNOMIAL proves the identity for EVERY
 * type profile in the region at once — the machine form of "for all theta"
 * on a continuum. This is the continuum counterpart of the integer-exact
 * layer of T1/T2 (there: finitely many integer bids, bitwise; here: a
 * continuum box, coefficient-wise).
 *
 * Dimension accounting is the caller's: every operation on two polys asserts
 * matching variable lists (the mAdd lesson — mismatches throw, never blend).
 */

import { KernelError } from "../core/errors.js";

export interface Rat {
  readonly n: bigint;
  readonly d: bigint; // > 0, gcd(|n|, d) = 1; zero is {0, 1}
}

export function gcdBig(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

export function rat(n: bigint | number, d: bigint | number = 1n): Rat {
  let bn = typeof n === "bigint" ? n : BigInt(n);
  let bd = typeof d === "bigint" ? d : BigInt(d);
  if (bd === 0n) throw new KernelError("rat/zero-denominator", "rat: zero denominator");
  if (bd < 0n) {
    bn = -bn;
    bd = -bd;
  }
  const g = gcdBig(bn, bd);
  if (g === 0n || g === 1n) return { n: bn, d: bd };
  return { n: bn / g, d: bd / g };
}

export const R0 = rat(0);
export const R1 = rat(1);

export function rAdd(a: Rat, b: Rat): Rat {
  return rat(a.n * b.d + b.n * a.d, a.d * b.d);
}
export function rSub(a: Rat, b: Rat): Rat {
  return rat(a.n * b.d - b.n * a.d, a.d * b.d);
}
export function rMul(a: Rat, b: Rat): Rat {
  return rat(a.n * b.n, a.d * b.d);
}
export function rDiv(a: Rat, b: Rat): Rat {
  if (b.n === 0n) throw new KernelError("rdiv/zero-divisor", "rDiv: zero divisor");
  return rat(a.n * b.d, a.d * b.n);
}
export function rNeg(a: Rat): Rat {
  return { n: -a.n, d: a.d };
}
export function rIsZero(a: Rat): boolean {
  return a.n === 0n;
}
export function rCmp(a: Rat, b: Rat): number {
  const l = a.n * b.d;
  const r = b.n * a.d;
  return l < r ? -1 : l > r ? 1 : 0;
}
export function rStr(a: Rat): string {
  return a.d === 1n ? a.n.toString() : `${a.n}/${a.d}`;
}

/** A multivariate polynomial over the rationals. Monomials with zero
 * coefficient are never stored. Key = exponent tuple joined by ",". */
export interface Poly {
  readonly vars: readonly string[];
  readonly mono: ReadonlyMap<string, Rat>;
}

function keyOf(exps: readonly number[]): string {
  return exps.join(",");
}

function sameVars(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function pAssertSame(a: Poly, b: Poly, what: string): void {
  if (!sameVars(a.vars, b.vars)) {
    throw new KernelError(
      "poly/var-mismatch",
      `${what}: variable mismatch [${a.vars.join(",")}] vs [${b.vars.join(",")}]`,
    );
  }
}

export function pZero(vars: readonly string[]): Poly {
  return { vars, mono: new Map<string, Rat>() };
}

export function pConst(vars: readonly string[], c: Rat): Poly {
  const mono = new Map<string, Rat>();
  if (!rIsZero(c)) mono.set(keyOf(new Array<number>(vars.length).fill(0)), c);
  return { vars, mono };
}

export function pVar(vars: readonly string[], idx: number): Poly {
  if (idx < 0 || idx >= vars.length) throw new KernelError("poly/index-range", `pVar: index ${idx} out of range`);
  const exps = new Array<number>(vars.length).fill(0);
  exps[idx] = 1;
  const mono = new Map<string, Rat>();
  mono.set(keyOf(exps), R1);
  return { vars, mono };
}

export function pMono(vars: readonly string[], exps: readonly number[], c: Rat): Poly {
  if (exps.length !== vars.length) throw new KernelError("poly/arity", "pMono: exponent arity mismatch");
  const mono = new Map<string, Rat>();
  if (!rIsZero(c)) mono.set(keyOf(exps), c);
  return { vars, mono };
}

/** Build a polynomial from raw monomial entries (re-normalizing zero
 * coefficients away) — the safe constructor for code that assembles terms
 * by hand (e.g. after a pullback). */
export function pFromMonomials(vars: readonly string[], entries: Iterable<readonly [string, Rat]>): Poly {
  const mono = new Map<string, Rat>();
  for (const [k, c] of entries) {
    if (rIsZero(c)) continue;
    mono.set(k, c);
  }
  return { vars, mono };
}

export function pIsZero(p: Poly): boolean {
  for (const c of p.mono.values()) {
    if (!rIsZero(c)) return false;
  }
  return true;
}

/** Zero-polynomial assertion — the standard of proof for every identity
 * below. A forged identity (nonzero polynomial) is CONVICTED here. */
export function pAssertZero(p: Poly, what: string): void {
  if (!pIsZero(p)) {
    const terms = [...p.mono.entries()].map(([k, c]) => `${rStr(c)}·[${k}]`).join(" + ");
    // the CONVICTION channel: a forged identity (nonzero polynomial) is
    // convicted here — mathematically distinct from every validation code
    throw new KernelError("poly/identity-failed", `identity FAILED: ${what} — residual ${terms}`);
  }
}

export function pAdd(a: Poly, b: Poly): Poly {
  pAssertSame(a, b, "pAdd");
  const mono = new Map<string, Rat>(a.mono);
  for (const [k, c] of b.mono) {
    const prev = mono.get(k) ?? R0;
    const s = rAdd(prev, c);
    if (rIsZero(s)) mono.delete(k);
    else mono.set(k, s);
  }
  return { vars: a.vars, mono };
}

export function pNeg(a: Poly): Poly {
  const mono = new Map<string, Rat>();
  for (const [k, c] of a.mono) mono.set(k, rNeg(c));
  return { vars: a.vars, mono };
}

export function pSub(a: Poly, b: Poly): Poly {
  return pAdd(a, pNeg(b));
}

export function pScale(a: Poly, c: Rat): Poly {
  const mono = new Map<string, Rat>();
  if (!rIsZero(c)) {
    for (const [k, v] of a.mono) mono.set(k, rMul(v, c));
  }
  return { vars: a.vars, mono };
}

export function pMul(a: Poly, b: Poly): Poly {
  pAssertSame(a, b, "pMul");
  const acc = new Map<string, Rat>();
  const arity = a.vars.length;
  for (const [ka, ca] of a.mono) {
    const ea = ka.split(",").map(Number);
    for (const [kb, cb] of b.mono) {
      const eb = kb.split(",").map(Number);
      const e = new Array<number>(arity);
      for (let i = 0; i < arity; i++) e[i] = (ea[i] as number) + (eb[i] as number);
      const k = keyOf(e);
      const prev = acc.get(k) ?? R0;
      const s = rAdd(prev, rMul(ca, cb));
      if (rIsZero(s)) acc.delete(k);
      else acc.set(k, s);
    }
  }
  return { vars: a.vars, mono: acc };
}

/** Partial derivative with respect to variable idx. */
export function pDeriv(p: Poly, idx: number): Poly {
  if (idx < 0 || idx >= p.vars.length) throw new KernelError("poly/index-range", `pDeriv: index ${idx} out of range`);
  const out = new Map<string, Rat>();
  for (const [k, c] of p.mono) {
    const e = k.split(",").map(Number);
    const ek = e[idx] as number;
    if (ek === 0) continue;
    const coef = rMul(c, rat(ek));
    const f = [...e];
    f[idx] = ek - 1;
    out.set(keyOf(f), coef);
  }
  return { vars: p.vars, mono: out };
}

/** Indefinite integral in variable idx (integration constant 0): term-wise
 * sigma^k -> sigma^(k+1)/(k+1). */
export function pInteg(p: Poly, idx: number): Poly {
  if (idx < 0 || idx >= p.vars.length) throw new KernelError("poly/index-range", `pInteg: index ${idx} out of range`);
  const out = new Map<string, Rat>();
  for (const [k, c] of p.mono) {
    const e = k.split(",").map(Number);
    const ek = e[idx] as number;
    const coef = rDiv(c, rat(ek + 1));
    const f = [...e];
    f[idx] = ek + 1;
    out.set(keyOf(f), coef);
  }
  return { vars: p.vars, mono: out };
}

/** Substitute variable idx := q (a polynomial over the SAME variables). */
export function pSubst(p: Poly, idx: number, q: Poly): Poly {
  pAssertSame(p, q, "pSubst");
  let out = pZero(p.vars);
  const arity = p.vars.length;
  for (const [k, c] of p.mono) {
    const e = k.split(",").map(Number);
    let term = pConst(p.vars, c);
    for (let i = 0; i < arity; i++) {
      const ei = e[i] as number;
      if (ei === 0) continue;
      // the substituted variable enters to ITS OWN degree (q^ei — an early
      // draft multiplied q once regardless of degree and every diagonal
      // identity quietly passed for the wrong reason; the charge's closed
      // form caught it)
      const factor = i === idx ? polyPower(q, ei) : pMonoPower(p.vars, i, ei);
      term = pMul(term, factor);
    }
    out = pAdd(out, term);
  }
  return out;
}

function polyPower(q: Poly, power: number): Poly {
  let out = pConst(q.vars, { n: 1n, d: 1n });
  for (let r = 0; r < power; r++) out = pMul(out, q);
  return out;
}

/** SIMULTANEOUS substitution of several variables (idxs[i] := qs[i]).
 * Sequential single substitutions compose wrongly when the replacements
 * share variables — the quarter-turn check was convicted exactly so. */
export function pSubstAll(p: Poly, idxs: readonly number[], qs: readonly Poly[]): Poly {
  if (idxs.length !== qs.length) throw new KernelError("poly/arity", "pSubstAll: arity mismatch");
  for (const q of qs) pAssertSame(p, q, "pSubstAll");
  let out = pZero(p.vars);
  const arity = p.vars.length;
  for (const [k, c] of p.mono) {
    const e = k.split(",").map(Number);
    let term = pConst(p.vars, c);
    for (let i = 0; i < arity; i++) {
      const ei = e[i] as number;
      if (ei === 0) continue;
      const slot = idxs.indexOf(i);
      const factor = slot >= 0 ? polyPower(qs[slot] as Poly, ei) : pMonoPower(p.vars, i, ei);
      term = pMul(term, factor);
    }
    out = pAdd(out, term);
  }
  return out;
}

function pMonoPower(vars: readonly string[], idx: number, power: number): Poly {
  const exps = new Array<number>(vars.length).fill(0);
  exps[idx] = power;
  return pMono(vars, exps, R1);
}

/** Substitute variable idx := rational constant. */
export function pSubstRat(p: Poly, idx: number, c: Rat): Poly {
  return pSubst(p, idx, pConst(p.vars, c));
}

/** Exact evaluation at a rational point. */
export function pEval(p: Poly, pt: readonly Rat[]): Rat {
  if (pt.length !== p.vars.length) throw new KernelError("poly/arity", "pEval: point arity mismatch");
  let acc = R0;
  for (const [k, c] of p.mono) {
    const e = k.split(",").map(Number);
    let m = c;
    for (let i = 0; i < e.length; i++) {
      const ei = e[i] as number;
      if (ei === 0) continue;
      let pow = (pt[i] as Rat);
      for (let r = 1; r < ei; r++) pow = rMul(pow, pt[i] as Rat);
      m = rMul(m, pow);
    }
    acc = rAdd(acc, m);
  }
  return acc;
}

/** Number of monomials that involve variable idx (the classification
 * verdict: a payment residual with monomials in the own-report coordinate is
 * NOT a gauge element). */
export function pMonomialsUsing(p: Poly, idx: number): number {
  let count = 0;
  for (const k of p.mono.keys()) {
    const e = k.split(",").map(Number);
    if ((e[idx] as number) > 0) count++;
  }
  return count;
}

/** The coefficient of a given monomial (exact). */
export function pCoef(p: Poly, exps: readonly number[]): Rat {
  return p.mono.get(keyOf(exps)) ?? R0;
}

/** Total degree (zero polynomial: -1). */
export function pTotalDeg(p: Poly): number {
  let d = -1;
  for (const k of p.mono.keys()) {
    const e = k.split(",").map(Number);
    let s = 0;
    for (const x of e) s += x;
    if (s > d) d = s;
  }
  return d;
}
