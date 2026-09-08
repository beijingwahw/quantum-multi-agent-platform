/**
 * T6 kernel — the exact-tie face of the power-depreciation ledger.
 *
 * The priced boundary (out/reports/t5-power-ledger.md:32): at gap = 0 the
 * optimal k is ill-posed and "the ledger declines to quote". This kernel makes
 * that refusal a TYPED RESULT the ledger returns, executes the tie law on
 * exact arithmetic, censuses which instance families hit exact ties, and
 * verifies the degenerate plateau of optimal policies at ties — in BOTH cost
 * models — exactly.
 *
 * The three exact-tie theatres, kept separate:
 *   PP FACE       (T5): 2*both = m among models — majority vote error is
 *                EXACTLY 1/2 for every odd k (integer path: the half binomial
 *                sum is 2^(k-1)); the feasible set for delta < 1/2 is empty.
 *   RESTART FACE  (T2): two cutoffs tie exactly at lambda* on integer
 *                probability tables (lambda is a rational of the table
 *                entries — exact equality is an integer equation, censused).
 *   GROVER FACE   (T2): the E* race NEVER ties at integer (N, t): the tie
 *                equation is (3N-4t)^2 = 2N^2, impossible for N >= 1 —
 *                sqrt(2) is irrational, machine-checked in BigInt.
 *
 * Everything here is exact BigInt rational arithmetic or exact integer
 * identities; floats appear only as readouts, cross-checked against the
 * exact value.
 */
import {
  binomTailAtMost,
  modelsOf,
  randomSat,
  repetitionsFor,
  type PowerLedgerRow,
  type SatInstance,
} from "./ppledger.js";
import { payExpected, renewalEarlyStop, type Dist } from "./restart.js";

// ---------------------------------------------------------------------------
// Exact rationals (BigInt, always reduced, den > 0).
// ---------------------------------------------------------------------------

export interface Rat {
  readonly num: bigint;
  readonly den: bigint;
}

function bgcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y > 0n) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

export function rat(num: bigint, den = 1n): Rat {
  if (den === 0n) throw new Error("rat: zero denominator");
  if (den < 0n) {
    num = -num;
    den = -den;
  }
  const g = bgcd(num, den);
  return { num: num / g, den: den / g };
}

export function ratAdd(a: Rat, b: Rat): Rat {
  return rat(a.num * b.den + b.num * a.den, a.den * b.den);
}

export function ratSub(a: Rat, b: Rat): Rat {
  return rat(a.num * b.den - b.num * a.den, a.den * b.den);
}

export function ratMul(a: Rat, b: Rat): Rat {
  return rat(a.num * b.num, a.den * b.den);
}

/** sign of a - b: -1 | 0 | 1 — exact comparison */
export function ratCmp(a: Rat, b: Rat): -1 | 0 | 1 {
  const d = a.num * b.den - b.num * a.den;
  return d < 0n ? -1 : d > 0n ? 1 : 0;
}

export function ratEq(a: Rat, b: Rat): boolean {
  return ratCmp(a, b) === 0;
}

export function ratToNumber(r: Rat): number {
  return Number(r.num) / Number(r.den);
}

export function ratToString(r: Rat): string {
  return `${r.num}/${r.den}`;
}

/** integer square root (Newton on BigInt) */
export function isqrt(n: bigint): bigint {
  if (n < 0n) throw new Error("isqrt: negative");
  if (n < 2n) return n;
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x;
}

// ---------------------------------------------------------------------------
// PP FACE — the tie plateau of the majority vote, exactly.
// ---------------------------------------------------------------------------

/**
 * Integer path for the tie plateau: sum_{i=0}^{(k-1)/2} C(k,i) for ODD k.
 * At p = 1/2 the majority-vote error is this sum / 2^k; the tie law says it
 * equals 2^(k-1) EXACTLY (each vote string pairs with its complement), so the
 * error is exactly 1/2 for every odd k — no k beats any other k, and no k
 * meets any delta < 1/2. Returned as exact BigInts: caller checks the
 * identity, nothing here is pre-decided.
 */
export function halfBinomialSum(k: number): { sum: bigint; total: bigint; half: bigint } {
  if (k < 1 || k % 2 === 0) throw new Error("halfBinomialSum: k must be odd and >= 1");
  let c = 1n; // C(k, 0)
  let sum = 0n;
  const m = (k - 1) / 2;
  for (let i = 0; i <= m; i++) {
    sum += c;
    // C(k, i+1) = C(k, i) * (k-i) / (i+1)
    c = (c * BigInt(k - i)) / BigInt(i + 1);
  }
  return { sum, total: 2n ** BigInt(k), half: 2n ** BigInt(k - 1) };
}

/** float path for the same law — must return 0.5 to machine precision */
export function halfTieTailFloat(k: number): number {
  return binomTailAtMost(k, 0.5, (k - 1) / 2);
}

// ---------------------------------------------------------------------------
// PP FACE — the typed refusal ("declines to quote" as data, not prose).
// ---------------------------------------------------------------------------

export interface QuoteOk {
  readonly status: "quoted";
  readonly delta: number;
  readonly k: number;
  readonly tailExact: number;
  readonly hoeffding: number;
  readonly queries: number;
}

export interface QuoteDeclined {
  readonly status: "declined";
  readonly delta: number;
  readonly reason: "EXACT-TIE";
  readonly gap: 0;
  readonly detail: string;
}

export type LedgerQuote = QuoteOk | QuoteDeclined;

/**
 * The ledger's quoting rule, executed. The tie test is the INTEGER referee
 * 2*both === m — never a float gap (float noise near 0 cannot forge or hide a
 * tie). On a tie the returned result is a typed refusal: the ledger declines
 * to quote because the constraint set {k : majority-vote error <= delta} is
 * empty for every delta < 1/2 (the error is exactly 1/2 for every odd k).
 */
export function quoteDecision(row: PowerLedgerRow, delta: number): LedgerQuote {
  if (2 * row.both === row.m) {
    return {
      status: "declined",
      delta,
      reason: "EXACT-TIE",
      gap: 0,
      detail: `2*both = m = ${row.m} exactly (integer referee): the majority-vote error is exactly 1/2 for every odd k, so no finite k meets delta = ${delta} < 1/2 — k is ill-posed, the ledger declines to quote`,
    };
  }
  const k = repetitionsFor(row.gap, delta);
  if (!Number.isFinite(k)) {
    throw new Error("quoteDecision: non-tie row produced infinite k (gap <= 0 without 2*both === m?)");
  }
  return {
    status: "quoted",
    delta,
    k,
    tailExact: binomTailAtMost(k, 0.5 + row.gap, (k - 1) / 2),
    hoeffding: Math.exp(-2 * k * row.gap ** 2),
    queries: k * (row.N / row.m),
  };
}

export interface Adjudication {
  readonly ok: boolean;
  readonly law: string | null;
  readonly message: string;
}

/**
 * The adjudicator: re-derives, from the row's own integers, whether a quote
 * may exist at all. Used by the smuggling trials — a fabricated quote at an
 * exact tie is NAMED and REJECTED here, not by prose.
 */
export function adjudicateQuote(row: PowerLedgerRow, quote: LedgerQuote): Adjudication {
  const isExactTie = 2 * row.both === row.m;
  if (isExactTie && quote.status === "quoted") {
    return {
      ok: false,
      law: "TIE-QUOTE",
      message: `TIE-QUOTE rejected: 2*both = m = ${row.m} is an exact tie (integer referee); the vote error is exactly 1/2 for every odd k, so the quoted k = ${quote.k} at delta = ${quote.delta} certifies nothing`,
    };
  }
  if (!isExactTie && quote.status === "declined") {
    return {
      ok: false,
      law: "FALSE-REFUSAL",
      message: `FALSE-REFUSAL rejected: 2*both = ${2 * row.both} != m = ${row.m}, gap = ${row.gap} > 0 — the ledger CAN quote here and must`,
    };
  }
  if (quote.status === "quoted") {
    const k = repetitionsFor(row.gap, quote.delta);
    if (quote.k !== k) {
      return {
        ok: false,
        law: "K-FORGE",
        message: `K-FORGE rejected: schedule k = ${quote.k}, but the Hoeffding schedule for delta = ${quote.delta}, gap = ${row.gap} is k = ${k}`,
      };
    }
    if (Math.abs(quote.queries - k * (row.N / row.m)) > 1e-9 * Math.max(1, k * (row.N / row.m))) {
      return {
        ok: false,
        law: "PRICE-FORGE",
        message: `PRICE-FORGE rejected: depreciation must be k * N/m = ${k * (row.N / row.m)}, quoted ${quote.queries}`,
      };
    }
  }
  return { ok: true, law: null, message: "quote consistent with the row's own integers" };
}

// ---------------------------------------------------------------------------
// PP FACE — the tie-breaking census: which instance families hit exact ties.
// ---------------------------------------------------------------------------

export interface PPTieCensus {
  readonly scanned: number;
  readonly tieCount: number;
  /** model counts m of the instances that tied (exact data, not a rate claim) */
  readonly tieMs: readonly number[];
  /** every tie had even m (2*both = m forces it) — machine-checked */
  readonly tiesAllEvenM: boolean;
  /** the free-variable family: models closed under x0 -> x0 XOR 1, both = m/2 */
  readonly freeVarTie: boolean;
  readonly freeVarM: number;
}

/** Census of exact ties over random instances + the forced free-variable family. */
export function ppTieCensus(scanned: number, n: number, numClauses: number, skipVar: number): PPTieCensus {
  // forced family: skipVar absent from every clause => the model set is closed
  // under flipping x_{skipVar} (an involution pairing models), so both = m/2
  // exactly whenever m > 0. Verified by direct enumeration, not the argument.
  let freeVarTie = true;
  let freeVarM = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const inst = randomSatCached(n, numClauses, seed, skipVar);
    const models = modelsOfCached(inst);
    freeVarM = models.length;
    const both = models.filter((x) => (x & 1) === 1).length;
    if (2 * both !== models.length) freeVarTie = false;
    const modelSet = new Set(models);
    for (const x of models) {
      if (!modelSet.has(x ^ 1)) freeVarTie = false;
    }
    if (models.length === 0) freeVarTie = false;
  }
  // random family: count accidental ties (2*both = m, integer equality)
  let tieCount = 0;
  const tieMs: number[] = [];
  let tiesAllEvenM = true;
  for (let seed = 1; seed <= scanned; seed++) {
    const inst = randomSatCached(n, numClauses, seed, -1);
    const models = modelsOfCached(inst);
    const m = models.length;
    if (m === 0) continue;
    const both = models.filter((x) => (x & 1) === 1).length;
    if (2 * both === m) {
      tieCount++;
      tieMs.push(m);
      if (m % 2 !== 0) tiesAllEvenM = false;
    }
  }
  return { scanned, tieCount, tieMs, tiesAllEvenM, freeVarTie, freeVarM };
}

// module-level caches so the census can scan thousands of instances cheaply
const satCache = new Map<string, SatInstance>();
function randomSatCached(n: number, c: number, seed: number, skip: number): SatInstance {
  const key = `${n}:${c}:${seed}:${skip}`;
  let inst = satCache.get(key);
  if (inst === undefined) {
    inst = randomSat(n, c, seed, skip);
    satCache.set(key, inst);
  }
  return inst;
}
const modelsCache = new Map<SatInstance, number[]>();
function modelsOfCached(inst: SatInstance): number[] {
  let ms = modelsCache.get(inst);
  if (ms === undefined) {
    ms = modelsOf(inst);
    modelsCache.set(inst, ms);
  }
  return ms;
}

// ---------------------------------------------------------------------------
// RESTART FACE — exact-tie cutoffs on integer probability tables.
// ---------------------------------------------------------------------------

/**
 * Integer probability table: table[u] = a_u for u = 1..H, table[0] = 0, total
 * d = sum a_u. Then lambda(t) = (t*d - sum_{u<t} (t-u) a_u) / q_t with
 * q_t = sum_{u<=t} a_u — an exact rational. (lambda of the float dist in
 * restart.ts is the same number; here it is computed exactly.)
 */
export function lambdaRat(table: readonly bigint[], t: number): Rat | null {
  const d = tableTotal(table);
  let q = 0n;
  for (let u = 1; u <= t && u < table.length; u++) q += table[u] as bigint;
  if (q === 0n) return null;
  let deficit = 0n;
  for (let u = 1; u < t && u < table.length; u++) deficit += BigInt(t - u) * (table[u] as bigint);
  return rat(BigInt(t) * d - deficit, q);
}

export function tableTotal(table: readonly bigint[]): bigint {
  let d = 0n;
  for (let u = 1; u < table.length; u++) d += table[u] as bigint;
  return d;
}

export interface RationalStar {
  readonly value: Rat;
  /** ALL cutoffs attaining the minimum — exact ties surface here as data */
  readonly optima: readonly number[];
  readonly lambdas: readonly string[];
}

export function lambdaStarRat(table: readonly bigint[]): RationalStar {
  let best: Rat | null = null;
  const optima: number[] = [];
  const lambdas: string[] = [];
  for (let t = 1; t < table.length; t++) {
    const v = lambdaRat(table, t);
    if (v === null) {
      lambdas.push("null");
      continue;
    }
    lambdas.push(ratToString(v));
    if (best === null || ratCmp(v, best) < 0) {
      best = v;
      optima.length = 0;
      optima.push(t);
    } else if (ratCmp(v, best) === 0) {
      optima.push(t);
    }
  }
  if (best === null) throw new Error("lambdaStarRat: empty table");
  return { value: best, optima, lambdas };
}

/** float Dist for the strategy machinery in restart.ts (readout path only) */
export function tableToDist(table: readonly bigint[]): Dist {
  const d = Number(tableTotal(table));
  const p: number[] = [0];
  for (let u = 1; u < table.length; u++) p.push(Number(table[u]) / d);
  return p;
}

export interface CensusEntry {
  readonly d: number;
  readonly a1: number;
  readonly a2: number;
}

export interface TieCensus {
  /** all (d, a1, a2) with lambda(1) = lambda(2) EXACTLY, d <= dMax */
  readonly entries: readonly CensusEntry[];
  /** entries.length === count of (d,a1) with d | a1^2 — the characterization */
  readonly characterizationHolds: boolean;
  /** every NON-solution pair has lambda(1) != lambda(2) exactly — checked */
  readonly nonSolutionsDiffer: boolean;
}

/**
 * Census of exact cutoff ties lambda(1) = lambda(2) over integer tables of
 * denominator d. The tie equation is the integer equation d*a2 = a1*(d - a1),
 * equivalently d | a1^2 — so the exact-tie family is characterized by
 * divisibility, and every census solution automatically leaves remainder mass
 * (a1 + a2 < d). Completion convention: the remainder sits as ONE atom at
 * t = 3, so the table total is exactly d — the tie of cutoffs 1 and 2 depends
 * only on (a1, a2, d), never on where the remainder lives. Both directions
 * are machine-verified by exact rational lambda equality: every divisible
 * pair ties, and for every non-divisible pair NO integer a2 ties.
 */
export function tieCensusFirstTwo(dMax: number): TieCensus {
  const entries: CensusEntry[] = [];
  let characterizationHolds = true;
  let nonSolutionsDiffer = true;
  const tableWith = (d: number, a1: number, a2: number): readonly bigint[] => [
    0n,
    BigInt(a1),
    BigInt(a2),
    BigInt(d - a1 - a2), // remainder atom at t = 3, total = d exactly
  ];
  for (let d = 2; d <= dMax; d++) {
    for (let a1 = 1; a1 < d; a1++) {
      const div = (BigInt(a1) * BigInt(a1)) % BigInt(d) === 0n;
      if (div) {
        const a2 = Number(BigInt(a1) - (BigInt(a1) * BigInt(a1)) / BigInt(d));
        const table = tableWith(d, a1, a2);
        const l1 = lambdaRat(table, 1);
        const l2 = lambdaRat(table, 2);
        if (l1 === null || l2 === null) throw new Error("tieCensusFirstTwo: degenerate table");
        if (ratEq(l1, l2)) entries.push({ d, a1, a2 });
        else characterizationHolds = false;
      } else {
        // no integer a2 may tie: sweep every possible second atom
        for (let a2 = 1; a2 <= d - a1 - 1; a2++) {
          const table = tableWith(d, a1, a2);
          const l1 = lambdaRat(table, 1);
          const l2 = lambdaRat(table, 2);
          if (l1 === null || l2 === null) continue;
          if (ratEq(l1, l2)) {
            nonSolutionsDiffer = false;
            break;
          }
        }
      }
    }
  }
  return { entries, characterizationHolds, nonSolutionsDiffer };
}

// ---------------------------------------------------------------------------
// The degenerate plateau — ties in BOTH cost models.
// ---------------------------------------------------------------------------

export interface PlateauCertificate {
  /** exact lambda at every cutoff 1..H */
  readonly lambdas: readonly string[];
  /** the exactly-tied optimal cutoff set (length >= 2 = a tie) */
  readonly optima: readonly number[];
  readonly star: string;
  /** cyclic strategies over the tied optimum set enumerated */
  readonly strategies: number;
  /** worst |T(S) - lambda*| over all of them — the plateau, executed */
  readonly worstDev: number;
  /** a cutoff OUTSIDE the tied set mixed in: T strictly above lambda* */
  readonly mixingStrict: boolean;
  readonly mixingMargin: number;
}

/**
 * At an exact tie of optimal cutoffs the optimal-policy set is the FULL
 * simplex over the tied cutoffs: by the convex identity T(S) = sum g_i
 * lambda(t_i) with every ingredient = lambda*, every cyclic (and every
 * mixed) strategy over the tied set attains lambda* exactly. Executed by
 * enumerating all cyclic schedules of length <= 3 over the tied cutoffs and
 * pricing them on the renewal-sum path; mixing in one sub-optimal cutoff must
 * land STRICTLY above lambda* (exact rational margin on the ingredient).
 */
export function plateauCertificate(table: readonly bigint[]): PlateauCertificate {
  const star = lambdaStarRat(table);
  if (star.optima.length < 2) throw new Error("plateauCertificate: no exact tie at the optimum");
  const dist = tableToDist(table);
  const target = ratToNumber(star.value);
  const tied = [...star.optima];
  let strategies = 0;
  let worstDev = 0;
  for (let len = 1; len <= 3; len++) {
    const prefixes: number[][] = [];
    const build = (prefix: number[]): void => {
      if (prefix.length === len) {
        prefixes.push([...prefix]);
        return;
      }
      for (const t of tied) build([...prefix, t]);
    };
    build([]);
    for (const prefix of prefixes) {
      const T = renewalEarlyStop(dist, { prefix });
      strategies++;
      const dev = Math.abs(T - target);
      if (dev > worstDev) worstDev = dev;
    }
  }
  // strict separation: one sub-optimal cutoff mixed in
  const outside = [];
  for (let t = 1; t < table.length; t++) {
    if (!tied.includes(t) && lambdaRat(table, t) !== null) outside.push(t);
  }
  let mixingStrict = false;
  let mixingMargin = 0;
  for (const t of outside) {
    const v = lambdaRat(table, t);
    if (v === null) continue;
    const margin = ratToNumber(ratSub(v, star.value));
    if (margin > mixingMargin) mixingMargin = margin; // reported worst ingredient
    if (ratCmp(v, star.value) > 0) mixingStrict = true;
  }
  return {
    lambdas: star.lambdas,
    optima: star.optima,
    star: ratToString(star.value),
    strategies,
    worstDev,
    mixingStrict,
    mixingMargin,
  };
}

export interface TiedMenuPlateau {
  /** exact c_i / p_i for both rounds — must be EQUAL rationals */
  readonly ratiosEqual: boolean;
  readonly L: string;
  /** exact alternating-schedule cost (c1 + (1-p1) c2) / (1 - (1-p1)(1-p2)) */
  readonly texact: string;
  /** float renewal path payExpected([0,1]) */
  readonly tfloat: number;
  readonly dev: number;
}

/**
 * ALWAYS-PAY model plateau: if two round types tie exactly at c_i/p_i = L,
 * the alternating schedule also costs exactly L. Exact reason: per cycle the
 * expected payment telescopes, sum_i (prod_{j<i}(1-p_j)) c_i = L (1 - prod_j
 * (1-p_j)), and the geometric series in the cycle survival closes to L. So
 * the degenerate plateau exists in BOTH cost models — mixing tied optima is
 * free even when every round is paid in full. Verified here in exact
 * rationals plus the float renewal path.
 */
export function tiedMenuPlateau(c1: number, c2: number, p1: Rat, p2: Rat): TiedMenuPlateau {
  const r1 = rat(BigInt(c1), 1n);
  const r2 = rat(BigInt(c2), 1n);
  const ratio1 = ratDivExact(r1, p1);
  const ratio2 = ratDivExact(r2, p2);
  const one = rat(1n);
  // T = (c1 + (1 - p1) c2) / (p1 + p2 - p1 p2), exact
  const num = ratAdd(r1, ratMul(ratSub(one, p1), r2));
  const den = ratSub(ratAdd(p1, p2), ratMul(p1, p2));
  const texact = ratDivExact(num, den);
  const tfloat = payExpected([c1, c2], [ratToNumber(p1), ratToNumber(p2)], [0, 1]);
  return {
    ratiosEqual: ratEq(ratio1, ratio2),
    L: ratToString(ratio1),
    texact: ratToString(texact),
    tfloat,
    dev: Math.abs(tfloat - ratToNumber(texact)),
  };
}

function ratDivExact(a: Rat, b: Rat): Rat {
  return rat(a.num * b.den, a.den * b.num);
}

/**
 * Adjudicator for plateau CLAIMS (smuggling trial target): a claim that a set
 * of cutoffs is an exact-tie optimal plateau is re-derived from the integer
 * table. A counterfeit (cutoffs not exactly tied, or tied but sub-optimal) is
 * NAMED and REJECTED.
 */
export function adjudicatePlateau(table: readonly bigint[], claimedCutoffs: readonly number[]): Adjudication {
  const star = lambdaStarRat(table);
  const claimedSorted = [...claimedCutoffs].sort((a, b) => a - b);
  const optimaSorted = [...star.optima].sort((a, b) => a - b);
  const same =
    claimedSorted.length === optimaSorted.length && claimedSorted.every((t, i) => t === optimaSorted[i]);
  if (!same || optimaSorted.length < 2) {
    const why =
      optimaSorted.length < 2
        ? `the true optimum is UNIQUE at cutoff ${optimaSorted.join(",")} (lambda* = ${ratToString(star.value)}) — there is no tie to plateau over`
        : `the true exactly-tied optimum is {${optimaSorted.join(",")}} (lambda* = ${ratToString(star.value)}), not {${claimedSorted.join(",")}}`;
    return {
      ok: false,
      law: "PLATEAU-FORGE",
      message: `PLATEAU-FORGE rejected: exact rational lambdas of this integer table give ${why}`,
    };
  }
  return {
    ok: true,
    law: null,
    message: `plateau verified: cutoffs {${optimaSorted.join(",")}} tie exactly at lambda* = ${ratToString(star.value)}`,
  };
}

// ---------------------------------------------------------------------------
// GROVER FACE — the E* race never ties at integer (N, t).
// ---------------------------------------------------------------------------

/**
 * Tie in the k=0-vs-k=1 race means sin^2(3theta) = 2 sin^2(theta) with
 * sin^2(theta) = t/N, i.e. (3N - 4t)^2 = 2 N^2 — no integer solution exists
 * (it would make sqrt(2) rational). Executed: for every t = 1..N the BigInt
 * identity is checked directly and must NEVER hold. Consequence: at integer
 * points the amplification ledger ALWAYS quotes a strict winner — exact ties
 * are a PP-face and restart-face phenomenon, not a Grover-face one.
 */
export function groverTieScan(N: number): { checked: number; ties: number; firstTieT: number } {
  const bigN = BigInt(N);
  const twoN2 = 2n * bigN * bigN;
  let ties = 0;
  let firstTieT = -1;
  for (let t = 1; t <= N; t++) {
    const a = 3n * bigN - 4n * BigInt(t);
    if (a * a === twoN2) {
      ties++;
      if (firstTieT < 0) firstTieT = t;
    }
  }
  return { checked: N, ties, firstTieT };
}

// ---------------------------------------------------------------------------
// ASYMPTOTIC FACE — the threshold constants c_k as exact algebraic data.
// ---------------------------------------------------------------------------

/** polynomials in s with BigInt coefficients: coeffs[i] = coeff of s^i */
export type Poly = readonly bigint[];

function polyAdd(a: Poly, b: Poly): Poly {
  const out: bigint[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    out.push((a[i] ?? 0n) + (b[i] ?? 0n));
  }
  while (out.length > 1 && out[out.length - 1] === 0n) out.pop();
  return out;
}

function polyMul(a: Poly, b: Poly): Poly {
  const out: bigint[] = new Array<bigint>(a.length + b.length - 1).fill(0n);
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      out[i + j] = (out[i + j] as bigint) + (a[i] as bigint) * (b[j] as bigint);
    }
  }
  while (out.length > 1 && out[out.length - 1] === 0n) out.pop();
  return out;
}

function polyEvalNum(p: Poly, num: bigint, den: bigint): bigint {
  // p(num/den) with common denominator den^deg — exact integer, sign-safe
  const deg = p.length - 1;
  let s = 0n;
  for (let i = 0; i < p.length; i++) {
    s += (p[i] as bigint) * num ** BigInt(i) * den ** BigInt(deg - i);
  }
  return s; // den^deg > 0 for den > 0, so sign(s) = sign of p at the point
}

/**
 * P_k(s) = U_{2k}(sqrt(1-s)) — the k-amplification race polynomial:
 * sin((2k+1)theta)/sin(theta) = P_k(s), s = sin^2(theta). Integer
 * coefficients, built by the Chebyshev recurrence in exact BigInt arithmetic
 * and composed with x^2 = 1 - s. The k-th optimality constraint is
 * P_k(s)^2 <= k + 1 (on the descending branch), so the tie density is the
 * root of Q_k = P_k^2 - (k+1) — an integer polynomial.
 */
export function racePoly(k: number): Poly {
  if (k < 1) throw new Error("racePoly: k >= 1");
  // U_n in x: U_0 = 1, U_1 = 2x, U_{n+1} = 2x U_n - U_{n-1}
  let un1: Poly = [1n]; // U_0
  let un: Poly = [0n, 2n]; // U_1 = 2x
  for (let n = 1; n < 2 * k; n++) {
    const twoXUn = [0n, ...un.map((c) => 2n * c)];
    const next = polyAdd(twoXUn, un1.map((c) => -c));
    un1 = un;
    un = next;
  }
  // un is now U_{2k}: even powers of x only — compose x^2 = 1 - s
  const even: bigint[] = [];
  for (let i = 0; i < un.length; i += 2) even.push(un[i] as bigint);
  const oneMinusS: Poly = [1n, -1n];
  let out: Poly = [0n];
  for (let j = even.length - 1; j >= 0; j--) {
    out = polyAdd(out, [(even[j] as bigint)]);
    if (j > 0) out = polyMul(out, oneMinusS);
  }
  return out;
}

/** Q_k = P_k^2 - (k+1): the exact tie polynomial — integer coefficients */
export function constraintPoly(k: number): Poly {
  const P = racePoly(k);
  const sq = polyMul(P, P);
  const shifted = [...sq];
  shifted[0] = (shifted[0] as bigint) - BigInt(k + 1);
  return shifted;
}

export interface RootBracket {
  readonly lo: Rat;
  readonly hi: Rat;
  /** sign changes found on the scan grid (sanity: the target must be the first) */
  readonly gridFlips: number;
}

/**
 * Certified isolation of the smallest root of an integer polynomial on (0,1):
 * fine rational sign scan (gridDen slices) finds the FIRST sign change, then
 * exact bisection narrows it to width < 2^-bits. Every sign test is exact
 * integer arithmetic — no float enters the certificate.
 */
export function isolateSmallestRoot(poly: Poly, gridDen = 1024, bits = 130): RootBracket {
  const ev = (num: bigint, den: bigint): bigint => polyEvalNum(poly, num, den);
  const s0 = ev(0n, 1n);
  const s1 = ev(1n, 1n);
  if (s0 === 0n || s1 === 0n) throw new Error("isolateSmallestRoot: root at an endpoint");
  let gridFlips = 0;
  let loI = -1;
  let prevSign = s0 < 0n ? -1 : 1;
  for (let i = 1; i <= gridDen; i++) {
    const num = BigInt(i);
    const v = ev(num, BigInt(gridDen));
    if (v === 0n) throw new Error(`isolateSmallestRoot: exact root on the grid at ${i}/${gridDen}`);
    const sign = v < 0n ? -1 : 1;
    if (sign !== prevSign) {
      gridFlips++;
      if (loI < 0) loI = i;
      prevSign = sign;
    }
  }
  if (loI < 0) throw new Error("isolateSmallestRoot: no sign change on (0,1)");
  let lo = rat(BigInt(loI - 1), BigInt(gridDen));
  let hi = rat(BigInt(loI), BigInt(gridDen));
  for (let it = 0; it < bits + 10; it++) {
    const mid = ratAdd(lo, hi);
    const half = rat(1n, 2n);
    const m = ratMul(mid, half);
    const vm = polyEvalNum(poly, m.num, m.den);
    if (vm === 0n) throw new Error("isolateSmallestRoot: hit the root exactly");
    const vLo = polyEvalNum(poly, lo.num, lo.den);
    const loSign = vLo < 0n ? -1 : 1;
    if ((vm < 0n ? -1 : 1) === loSign) lo = m;
    else hi = m;
  }
  return { lo, hi, gridFlips };
}

/** decimal digits CERTIFIED by a bracket: longest prefix agreed by lo and hi */
export function certifiedDigits(br: { readonly lo: Rat; readonly hi: Rat }, maxDigits = 40): string {
  for (let n = maxDigits; n >= 1; n--) {
    const scale = 10n ** BigInt(n);
    const a = (br.lo.num * scale) / br.lo.den; // floor, lo >= 0 here
    const b = (br.hi.num * scale) / br.hi.den;
    if (a === b) {
      const s = a.toString().padStart(n + 1, "0");
      return `${s.slice(0, 1)}.${s.slice(1)}`;
    }
  }
  return "0.";
}

/** sqrt(2) in [lo/10^n, (lo+1)/10^n] by integer sqrt — an exact certificate */
export function sqrt2Bracket(n: number): { readonly lo: Rat; readonly hi: Rat } {
  const scale = 10n ** BigInt(n);
  const lo = isqrt(2n * scale * scale);
  return { lo: rat(lo, scale), hi: rat(lo + 1n, scale) };
}

/** c_1 = (3 - sqrt(2))/4 bracket from the isqrt path — independent of bisection */
export function c1BracketFromSqrt2(n: number): { readonly lo: Rat; readonly hi: Rat } {
  const s = sqrt2Bracket(n);
  // (3 - x)/4 is decreasing in x
  return {
    lo: ratMul(ratSub(rat(3n), s.hi), rat(1n, 4n)),
    hi: ratMul(ratSub(rat(3n), s.lo), rat(1n, 4n)),
  };
}

/** sqrt(r) in [lo, hi] with width < 10^-n — exact integer certificate */
export function sqrtRatBracket(r: Rat, n: number): { readonly lo: Rat; readonly hi: Rat } {
  const scale = 10n ** BigInt(n);
  const a = (r.num * scale * scale) / r.den; // floor(r * scale^2)
  const lo = isqrt(a);
  return { lo: rat(lo, scale), hi: rat(lo + 1n, scale) };
}

/** sqrt(3) bracket (second nested radical of the c_2 closed form) */
export function sqrt3Bracket(n: number): { readonly lo: Rat; readonly hi: Rat } {
  const scale = 10n ** BigInt(n);
  const lo = isqrt(3n * scale * scale);
  return { lo: rat(lo, scale), hi: rat(lo + 1n, scale) };
}

/**
 * c_2 = (20 - sqrt(80 + 64*sqrt(3)))/32 bracket from nested integer square
 * roots — the closed form of the k=2 tie polynomial root P_2(s)^2 = 3 on the
 * descending branch, independent of the bisection path.
 */
export function c2BracketFromClosedForm(n: number): { readonly lo: Rat; readonly hi: Rat } {
  const s3 = sqrt3Bracket(n + 8); // extra digits: the nesting eats precision
  const inner = {
    lo: ratAdd(rat(80n), ratMul(rat(64n), s3.lo)),
    hi: ratAdd(rat(80n), ratMul(rat(64n), s3.hi)),
  };
  const sInner = {
    lo: sqrtRatBracket(inner.lo, n + 4).lo,
    hi: sqrtRatBracket(inner.hi, n + 4).hi,
  };
  // (20 - x)/32 is decreasing in x
  return {
    lo: ratMul(ratSub(rat(20n), sInner.hi), rat(1n, 32n)),
    hi: ratMul(ratSub(rat(20n), sInner.lo), rat(1n, 32n)),
  };
}

/** Adjudicator for digit claims (smuggling trial target): a decimal string for
 *  c_1 must match the certified bracket digits from BOTH independent paths. */
export function adjudicateDigits(claimed: string, br: { readonly lo: Rat; readonly hi: Rat }): Adjudication {
  const certified = certifiedDigits(br, 40);
  if (claimed === certified) {
    return { ok: true, law: null, message: `digits match the certified bracket (${certified}...)` };
  }
  return {
    ok: false,
    law: "DIGITS-FORGE",
    message: `DIGITS-FORGE rejected: certified digits are ${certified}..., claimed ${claimed}`,
  };
}
