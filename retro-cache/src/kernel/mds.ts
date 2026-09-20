/**
 * Kernel — the Singleton-grade rank theorem for the truncated-multiplication
 * amplification family (v0.4.0): Eve's coordinate-knowledge information is
 * exactly the rank formula, and the family rides the dimension bound.
 *
 * The family is W5's: F_{m,k} = { x -> trunc_k(a (x) x) : a in GF(2^m)* }
 * over the toy fields on file (m = 4, 8). The sparse adversary knows a fixed
 * set S of raw bit positions exactly (s = |S|); F below is the FREE mask
 * (the positions she does NOT know), f = m - s.
 *
 * Theorem A (universal lower bound — the Singleton-grade face).
 * For EVERY map a != 0 and EVERY free mask F:
 *     rank { trunc_k(a (x) e_i) : i in F }  >=  max(0, f + k - m),
 * hence Eve's surviving information obeys
 *     I(K; Z | a) = k - rank  <=  min(k, s).
 * Proof shape, machine-executed per instance below: trunc_k(a (x) .) has
 * kernel {x : a (x) x in H} with H = span{beta^k..beta^{m-1}} of dim m-k —
 * multiplication by a is INJECTIVE (the field property; the inverse census
 * certifies 255/255 at m = 8), so the kernel is an exact copy of H — the
 * restricted kernel ker(T_a|F) = ker T_a AND span(F) has dim <= m-k, and
 * rank = f - dim (rank-nullity on the restriction, verified per instance by
 * enumerating all 2^f free completions). The Singleton reading: Eve's info
 * about the k-bit key never exceeds what she knows about the m-bit input —
 * the data-processing ceiling executed at full generality for this family —
 * and the column-rank bound max(0, f + k - m) is the q-ary Singleton shape
 * (Singleton-1964-on maximum q-ary codes, cited, double-source pending; no
 * arXiv id, DOI, or volume quoted from memory) read on the generator's
 * columns instead of the minimum distance.
 *
 * Theorem B (closed form). For every (a, F, z): enumerating all 2^f free
 * completions of the known bits z, the key trunc_k(a (x) x) is uniform on
 * exactly 2^rank values, each hit 2^(f-rank) times — so H(K|z) = rank
 * exactly and I(K;Z|a) = k - rank. The machine certificate is the exact
 * integer histogram (no entropy float enters the claim); z-independence is
 * checked on a second z (the two histograms are XOR-translations by
 * trunc_k(a (x) base(z))).
 *
 * Census C (the bound is ridden — globally, and where exactly). For m in
 * {4, 8}, every k in 1..m and f in 0..m, the minimum of the rank over ALL
 * maps a != 0 AND ALL free masks with |F| = f EQUALS max(0, f + k - m): the
 * worst-case Eve information is exactly min(k, s) — the dimension bound is
 * globally tight at every sparsity level, which is the family's
 * Singleton-optimality in the worst case. Per free mask the census ALSO
 * reports that equality is NOT everywhere: scattered free sets (m = 8,
 * k = 4, F = {0, 7}; m = 4, k = 2, F = {0, 2}) admit no map that drops the
 * rank to the bound — their per-F minimum sits strictly above it, strictly
 * better privacy than the Singleton worst case. The inequality is the
 * theorem; both census faces are machine data.
 *
 * Negative control (the field property is load-bearing). Replacing the
 * irreducible field polynomial by a reducible one (x^4 + x^2 + 1 =
 * (x^2 + x + 1)^2) breaks Theorem A outright: a zero divisor a has
 * non-injective multiplication, ker T_a can exceed m - k, and the scan
 * below EXHIBITS an (a, k, F) with rank < max(0, f + k - m). Over the
 * fields on file the same scan finds no violation at any scale tested.
 *
 * Honest boundaries. Coordinate-knowledge (sparse) adversary only — the
 * smoothed BSC face of W5 is a different theorem. Census claims are bounded
 * to the fields on file (m = 4, 8): for larger m Theorem A stands (it is
 * dimension counting in any field) but no census is executed here. The
 * universal-2 collision face is W5's own (CW79, in the book) and is not
 * re-derived.
 */
import { gfMul } from "./amplify.js";
import { entropyBits, RcError } from "./state.js";

/** GF(2) rank of a set of bit-vectors by leading-bit elimination — the same
 *  algorithm as amplify.ts's module-private gf2Rank (that copy is not
 *  exported and this file may not edit it; the two are kept in step by the
 *  brute-force cross-checks in the tests). */
function gf2Rank(vectors: readonly number[]): number {
  const basis = new Map<number, number>(); // leading bit -> reduced vector
  for (const v0 of vectors) {
    let v = v0;
    while (v !== 0) {
      const lead = 31 - Math.clz32(v);
      const b = basis.get(lead);
      if (b === undefined) {
        basis.set(lead, v);
        break;
      }
      v ^= b;
    }
  }
  return basis.size;
}

function fieldCheck(m: number): void {
  if (m !== 4 && m !== 8)
    throw new RcError(
      "RC_NO_FIELD",
      `mds: no toy field GF(2^${m}) on file (census claims live at m = 4, 8)`,
    );
}

function argsCheck(m: number, k: number, a: number, freeMask: number): number {
  fieldCheck(m);
  if (!Number.isInteger(k) || k < 1 || k > m)
    throw new RcError(
      "RC_K_RANGE",
      `mds: need 1 <= k <= m (got m=${m}, k=${k})`,
    );
  if (!Number.isInteger(a) || a < 1 || a >= 1 << m)
    throw new RcError(
      "RC_A_RANGE",
      `mds: the map a must be a nonzero field element (got a=${a})`,
    );
  if (!Number.isInteger(freeMask) || freeMask < 0 || freeMask >= 1 << m)
    throw new RcError(
      "RC_MASK_RANGE",
      `mds: freeMask must lie in [0, 2^${m}) (got ${freeMask})`,
    );
  return (1 << k) - 1;
}

/** the truncated columns { trunc_k(a (x) e_i) : i in F } — the restricted generator's columns. */
export function truncColumns(
  m: number,
  k: number,
  a: number,
  freeMask: number,
): number[] {
  const mask = argsCheck(m, k, a, freeMask);
  const cols: number[] = [];
  for (let i = 0; i < m; i++)
    if (freeMask & (1 << i)) cols.push(gfMul(a, 1 << i, m) & mask);
  return cols;
}

/** Singleton-shape dimension bound for (f, k, m): max(0, |F| + k - m). */
export function dimensionBound(m: number, k: number, freeBits: number): number {
  return Math.max(0, freeBits + k - m);
}

export interface RankFace {
  readonly m: number;
  readonly k: number;
  readonly a: number;
  readonly freeMask: number;
  readonly freeBits: number;
  /** rank of the truncated columns */
  readonly rank: number;
  /** dim of { v in span(F) : trunc_k(a (x) v) = 0 }, by exhaustive enumeration */
  readonly kernelDim: number;
  /** the FULL kernel's dim { x : trunc_k(a (x) x) = 0 }, by exhaustive enumeration */
  readonly fullKernelDim: number;
  readonly bound: number;
  /** rank >= bound AND rank + kernelDim === f AND kernelDim <= fullKernelDim === m - k */
  readonly theoremHolds: boolean;
}

/** One instance's full certificate: rank, both kernels by enumeration, rank-nullity, the bound, and the inclusion. */
export function rankFace(
  m: number,
  k: number,
  a: number,
  freeMask: number,
): RankFace {
  const mask = argsCheck(m, k, a, freeMask);
  const rank = gf2Rank(truncColumns(m, k, a, freeMask));
  let kernelCount = 0;
  for (let v = freeMask; ; v = (v - 1) & freeMask) {
    if ((gfMul(a, v, m) & mask) === 0) kernelCount++;
    if (v === 0) break;
  }
  let fullKernelCount = 0;
  for (let x = 0; x < 1 << m; x++)
    if ((gfMul(a, x, m) & mask) === 0) fullKernelCount++;
  const freeBits = popcount(freeMask);
  const kernelDim = Math.log2(kernelCount);
  const fullKernelDim = Math.log2(fullKernelCount);
  const bound = dimensionBound(m, k, freeBits);
  return {
    m,
    k,
    a,
    freeMask,
    freeBits,
    rank,
    kernelDim,
    fullKernelDim,
    bound,
    theoremHolds:
      rank >= bound &&
      rank + kernelDim === freeBits &&
      kernelDim <= fullKernelDim &&
      fullKernelDim === m - k,
  };
}

function popcount(x: number): number {
  let c = 0;
  while (x !== 0) {
    x &= x - 1;
    c++;
  }
  return c;
}

export interface SurjectivityCensus {
  readonly m: number;
  readonly k: number;
  readonly maps: number;
  /** every a != 0 has |image of trunc_k(a (x) .)| = 2^k (rank T_a = k) — the machine half of the kernel dimension m - k */
  readonly allSurjective: boolean;
}

/** For every a != 0 the truncated map has image exactly 2^k — injectivity of multiplication meets surjectivity of truncation. */
export function surjectivityCensus(m: number, k: number): SurjectivityCensus {
  fieldCheck(m);
  if (!Number.isInteger(k) || k < 1 || k > m)
    throw new RcError(
      "RC_K_RANGE",
      `surjectivityCensus: need 1 <= k <= m (got m=${m}, k=${k})`,
    );
  const n = 1 << m;
  const mask = (1 << k) - 1;
  let ok = true;
  for (let a = 1; a < n; a++) {
    const image = new Set<number>();
    for (let x = 0; x < n; x++) image.add(gfMul(a, x, m) & mask);
    if (image.size !== 1 << k) ok = false;
  }
  return { m, k, maps: n - 1, allSurjective: ok };
}

export interface EveClosedForm {
  readonly m: number;
  readonly k: number;
  readonly a: number;
  readonly freeMask: number;
  readonly z: number;
  readonly rank: number;
  /** I(K; Z | a) = k - rank — the closed form */
  readonly info: number;
  /** distinct keys hit by the 2^f free completions (must be 2^rank) */
  readonly imageKeys: number;
  /** the uniform multiplicity of every hit key (must be 2^(f-rank)) */
  readonly multiplicity: number;
  /** every key multiplicity equals `multiplicity` — the exact-integer uniformity certificate */
  readonly uniform: boolean;
  /** H(K|z) by the histogram through entropyBits — the float cross-check (|dev| < 1e-12) */
  readonly entropyDev: number;
}

/** The closed form on one (a, F, z): enumerate all 2^f completions, histogram the keys, demand exact uniformity. */
export function eveInfoClosedForm(
  m: number,
  k: number,
  a: number,
  freeMask: number,
  z: number,
): EveClosedForm {
  const mask = argsCheck(m, k, a, freeMask);
  const knownMask = ((1 << m) - 1) ^ freeMask;
  if (!Number.isInteger(z) || z < 0 || z >= 1 << popcount(knownMask))
    throw new RcError(
      "RC_Z_RANGE",
      `eveInfoClosedForm: z must index the known bits, 0 <= z < 2^${popcount(knownMask)} (got ${z})`,
    );
  // spread z over the known positions (free positions start at 0 — the coset structure is z-independent)
  let base = 0;
  let rest = z;
  for (let i = 0; i < m; i++)
    if (knownMask & (1 << i)) {
      if (rest & 1) base |= 1 << i;
      rest >>= 1;
    }
  const counts = new Map<number, number>();
  const completions = 1 << popcount(freeMask);
  for (let u = freeMask; ; u = (u - 1) & freeMask) {
    const key = gfMul(a, base | u, m) & mask;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (u === 0) break;
  }
  const imageKeys = counts.size;
  const multiplicity = completions / imageKeys;
  let uniform = true;
  for (const c of counts.values()) if (c !== multiplicity) uniform = false;
  const rank = gf2Rank(truncColumns(m, k, a, freeMask));
  const probs = [...counts.values()].map((c) => c / completions);
  return {
    m,
    k,
    a,
    freeMask,
    z,
    rank,
    info: k - rank,
    imageKeys,
    multiplicity,
    uniform,
    entropyDev: Math.abs(entropyBits(probs) - rank),
  };
}

export interface SingletonRow {
  readonly m: number;
  readonly k: number;
  readonly f: number;
  readonly bound: number;
  /** min over maps a != 0 AND free masks |F| = f — the adversary picks both */
  readonly minRank: number;
  /** a witness (map, mask) achieving minRank */
  readonly witnessA: number;
  readonly witnessMask: number;
  /** k - minRank — the worst-case Eve info at this sparsity */
  readonly worstEveInfo: number;
  /** min(k, m - f) — the Singleton-grade ceiling Theorem A proves */
  readonly singletonEveInfo: number;
  readonly achieved: boolean;
  /** free masks with |F| = f whose PER-MASK minimum equals the bound */
  readonly sets: number;
  readonly achievingSets: number;
}

export interface SingletonCensus {
  readonly m: number;
  readonly rows: readonly SingletonRow[];
  /** every (a, k, F) instance in the scan obeys rank >= bound — Theorem A as data */
  readonly theoremHoldsEverywhere: boolean;
  readonly instances: number;
}

function combinations(m: number, bits: number): number[] {
  const out: number[] = [];
  const rec = (start: number, left: number, acc: number) => {
    if (left === 0) {
      out.push(acc);
      return;
    }
    for (let i = start; i < m - left + 1; i++)
      rec(i + 1, left - 1, acc | (1 << i));
  };
  rec(0, bits, 0);
  return out;
}

/** the minimum rank over maps a != 0 at one fixed free mask, with a witness. */
export function minRankOverMaps(
  m: number,
  k: number,
  freeMask: number,
): { min: number; bestA: number } {
  const mask = argsCheck(m, k, 1, freeMask);
  const n = 1 << m;
  let best = Number.POSITIVE_INFINITY;
  let bestA = 1;
  for (let a = 1; a < n; a++) {
    const cols: number[] = [];
    for (let i = 0; i < m; i++)
      if (freeMask & (1 << i)) cols.push(gfMul(a, 1 << i, m) & mask);
    const r = gf2Rank(cols);
    if (r < best) {
      best = r;
      bestA = a;
    }
  }
  return { min: best, bestA };
}

/** The full census over the toy fields: Theorem A as exhaustive data plus the attainment table. */
export function singletonCensus(m: number): SingletonCensus {
  fieldCheck(m);
  const n = 1 << m;
  const rows: SingletonRow[] = [];
  let theoremHoldsEverywhere = true;
  let instances = 0;
  for (let k = 1; k <= m; k++) {
    const mask = (1 << k) - 1;
    for (let f = 0; f <= m; f++) {
      const sets = combinations(m, f);
      let minRank = Number.POSITIVE_INFINITY;
      let witnessA = 1;
      let witnessMask = sets[0] ?? 0;
      let achievingSets = 0;
      for (const freeMask of sets) {
        let perFMin = Number.POSITIVE_INFINITY;
        for (let a = 1; a < n; a++) {
          const cols: number[] = [];
          for (let i = 0; i < m; i++)
            if (freeMask & (1 << i)) cols.push(gfMul(a, 1 << i, m) & mask);
          const rank = gf2Rank(cols);
          instances++;
          if (rank < dimensionBound(m, k, f)) theoremHoldsEverywhere = false;
          if (rank < perFMin) perFMin = rank;
          if (rank < minRank) {
            minRank = rank;
            witnessA = a;
            witnessMask = freeMask;
          }
        }
        if (perFMin === dimensionBound(m, k, f)) achievingSets++;
      }
      rows.push({
        m,
        k,
        f,
        bound: dimensionBound(m, k, f),
        minRank,
        witnessA,
        witnessMask,
        worstEveInfo: k - minRank,
        singletonEveInfo: Math.min(k, m - f),
        achieved: minRank === dimensionBound(m, k, f),
        sets: sets.length,
        achievingSets,
      });
    }
  }
  return { m, rows, theoremHoldsEverywhere, instances };
}

// --- the non-field negative control -------------------------------------------

/** x^4 + x^2 + 1 = (x^2 + x + 1)^2 over GF(2) — reducible: the quotient ring has zero divisors. */
const REDUCIBLE_POLY = 0b10101;

/** multiplication in GF(2)[x]/(poly) with an EXPLICIT polynomial — gfMul's algorithm, any poly. */
function ringMul(a: number, b: number, m: number, poly: number): number {
  let x = a >>> 0;
  let y = b >>> 0;
  let acc = 0;
  while (y > 0) {
    if (y & 1) acc ^= x;
    y >>>= 1;
    x <<= 1;
    if ((x >>> m) & 1) x ^= poly;
  }
  return acc;
}

export interface NonFieldViolation {
  readonly poly: number;
  readonly polyNote: string;
  readonly m: number;
  readonly k: number;
  readonly a: number;
  readonly freeMask: number;
  readonly rank: number;
  readonly bound: number;
  readonly violated: boolean;
}

/**
 * The same Theorem-A scan over the REDUCIBLE ring GF(2)[x]/(x^4+x^2+1): a
 * zero-divisor map breaks injectivity and the dimension bound with it. In
 * the fields on file the same scan never violates (singletonCensus) — the
 * contrast IS the evidence that the field property is load-bearing.
 */
export function nonFieldViolation(): NonFieldViolation | null {
  const m = 4;
  const n = 1 << m;
  for (let k = 1; k <= m; k++) {
    const mask = (1 << k) - 1;
    for (let freeMask = 0; freeMask < n; freeMask++) {
      for (let a = 1; a < n; a++) {
        const cols: number[] = [];
        for (let i = 0; i < m; i++)
          if (freeMask & (1 << i))
            cols.push(ringMul(a, 1 << i, m, REDUCIBLE_POLY) & mask);
        const rank = gf2Rank(cols);
        if (rank < dimensionBound(m, k, popcount(freeMask)))
          return {
            poly: REDUCIBLE_POLY,
            polyNote: "x^4 + x^2 + 1 = (x^2 + x + 1)^2 — reducible",
            m,
            k,
            a,
            freeMask,
            rank,
            bound: dimensionBound(m, k, popcount(freeMask)),
            violated: true,
          };
      }
    }
  }
  return null;
}
