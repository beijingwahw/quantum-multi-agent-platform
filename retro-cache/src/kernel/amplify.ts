/**
 * Kernel — bounded privacy amplification (W5): an explicit universal-2 hash
 * family over small binary fields, and the exact before/after measurement of
 * an adversary's surviving information on complete joint tables.
 *
 * Scope law (BB84-grade toy, deliberately bounded): the adversary is an
 * explicit instantiation — a per-bit BSC(eps) copy of the raw key (the
 * "footprint-equal" smoothed profile) plus a sparse "intercept-resend"
 * profile that knows a subset of raw bits exactly. The machine measures THESE
 * adversaries on exact tables; the all-adversaries statement rides on
 * BB84/BBR88/CW79/ILL89, cited not re-proved. The leftover-hash bound is
 * computed and printed even where it is vacuous at toy scale.
 */
import { entropyBits, mutualInfoBits } from "./state.js";
import { h2 } from "./tariff.js";

// ---------------------------------------------------------------------------
// The toy fields GF(2^m): m = 4 (poly x^4 + x + 1) and m = 8 (poly
// x^8 + x^4 + x^3 + x + 1, the AES/Rijndael polynomial). Irreducibility is a
// machine certificate below: every nonzero element has an inverse.
// ---------------------------------------------------------------------------

export const FIELD_POLY: Readonly<Record<number, number>> = {
  4: 0b10011,
  8: 0b100011011,
};

export function gfMul(a: number, b: number, m: number): number {
  const poly = FIELD_POLY[m];
  if (poly === undefined) throw new Error(`gfMul: no toy field GF(2^${m}) on file`);
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

export interface InverseCensus {
  readonly m: number;
  readonly nonzero: number;
  readonly invertible: number;
}

/** every nonzero element invertible <=> the polynomial is irreducible <=> the
 *  toy structure is a field (exhaustive: a*b over all pairs is the search). */
export function inverseCensus(m: number): InverseCensus {
  const n = 1 << m;
  let invertible = 0;
  for (let a = 1; a < n; a++) {
    for (let b = 1; b < n; b++) {
      if (gfMul(a, b, m) === 1) {
        invertible++;
        break;
      }
    }
  }
  return { m, nonzero: n - 1, invertible };
}

// ---------------------------------------------------------------------------
// The explicit hash family: F_{m,k} = { x -> trunc_k(a (x) x) : a in GF(2^m)* }.
// CW79-style field-multiplication family, truncated to k output bits. For
// every collision test delta != 0 the collision count is EXACTLY
// 2^(m-k) - 1 over the 2^m - 1 maps (a (x) delta runs over all nonzero field
// elements), so the family is universal-2 with room to spare:
// (2^(m-k)-1)/(2^m-1) <= 2^-k, with equality never attained for m > k.
// ---------------------------------------------------------------------------

export interface CollisionCensus {
  readonly m: number;
  readonly k: number;
  readonly family: number;
  /** collision count per delta: identical for every delta != 0, machine-verified */
  readonly collisionsPerDelta: number;
  readonly maxCollisionProb: number;
  readonly uniform2Bound: number;
  readonly universal2: boolean;
}

export function collisionCensus(m: number, k: number): CollisionCensus {
  if (k < 1 || k > m) throw new Error(`collisionCensus: need 1 <= k <= m (got m=${m}, k=${k})`);
  const n = 1 << m;
  const mask = (1 << k) - 1;
  const fam = n - 1;
  let collisionsPerDelta = -1;
  for (let delta = 1; delta < n; delta++) {
    let count = 0;
    for (let a = 1; a < n; a++) if ((gfMul(a, delta, m) & mask) === 0) count++;
    if (collisionsPerDelta === -1) collisionsPerDelta = count;
    else if (count !== collisionsPerDelta)
      throw new Error(`collisionCensus: delta-dependence at delta=${delta} (${count} vs ${collisionsPerDelta}) — family analysis broken`);
  }
  const maxCollisionProb = collisionsPerDelta / fam;
  const uniform2Bound = 2 ** -k;
  return {
    m,
    k,
    family: fam,
    collisionsPerDelta,
    maxCollisionProb,
    uniform2Bound,
    universal2: maxCollisionProb <= uniform2Bound + 1e-15,
  };
}

/** class assignment x -> trunc_k(a (x) x) over all x in GF(2)^m */
export function hashAssign(m: number, k: number, a: number): number[] {
  const n = 1 << m;
  const mask = (1 << k) - 1;
  const out = new Array<number>(n).fill(0);
  for (let x = 0; x < n; x++) out[x] = gfMul(a, x, m) & mask;
  return out;
}

// ---------------------------------------------------------------------------
// The smoothed adversary: Z^m = X^m through a per-bit BSC(eps), X uniform.
// Everything below is exact enumeration on complete tables — no sampling.
// ---------------------------------------------------------------------------

function popcounts(n: number): number[] {
  const pc = new Array<number>(n).fill(0);
  for (let i = 1; i < n; i++) pc[i] = pc[i >> 1]! + (i & 1);
  return pc;
}

/** I(X^m; Z^m) two paths: closed form m(1 - h2(eps)) vs the full 2^m x 2^m
 *  joint table through mutualInfoBits. */
export function bscBlockInfo(m: number, eps: number): { readonly closed: number; readonly table: number } {
  const n = 1 << m;
  const pc = popcounts(n);
  const w = new Array<number>(m + 1);
  for (let d = 0; d <= m; d++) w[d] = 2 ** -m * (1 - eps) ** (m - d) * eps ** d;
  const joint: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let x = 0; x < n; x++) for (let z = 0; z < n; z++) joint[x]![z] = w[pc[x ^ z]!]!;
  return { closed: m * (1 - h2(eps)), table: mutualInfoBits(joint) };
}

export interface PaMeasure {
  readonly m: number;
  readonly k: number;
  readonly eps: number;
  /** I(X^m; Z^m) before amplification — exact, two paths */
  readonly beforeTable: number;
  readonly beforeClosed: number;
  /** mean / min / max over the whole family of I(K; Z^m | hash a public) */
  readonly afterMean: number;
  readonly afterMin: number;
  readonly afterMax: number;
  /** worst |H(K|a) - k| over the family — exact-uniformity residual (is 0) */
  readonly worstHkDev: number;
  /** TV( P(K,Z) family-mixed , uniform_K x P(Z) ) — exact */
  readonly tvFamilyMixed: number;
  /** worst-case-z min-entropy of X^m given Z^m, -m*log2(max(eps, 1-eps)) */
  readonly hInf: number;
  /** leftover-hash bound (ILL89 form) 0.5 * 2^((k - hInf)/2) — printed even when vacuous */
  readonly lhlBound: number;
}

export function paMeasure(m: number, k: number, eps: number): PaMeasure {
  if (k < 1 || k > m) throw new Error(`paMeasure: need 1 <= k <= m (got m=${m}, k=${k})`);
  const n = 1 << m;
  const mask = (1 << k) - 1;
  const fam = n - 1;
  const pc = popcounts(n);
  const w = new Array<number>(m + 1);
  for (let d = 0; d <= m; d++) w[d] = 2 ** -m * (1 - eps) ** (m - d) * eps ** d;

  const before = bscBlockInfo(m, eps);

  let sum = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let worstHkDev = 0;
  const fAvg: number[][] = Array.from({ length: 1 << k }, () => new Array<number>(n).fill(0));
  for (let a = 1; a < n; a++) {
    const table: number[][] = Array.from({ length: 1 << k }, () => new Array<number>(n).fill(0));
    for (let x = 0; x < n; x++) {
      const c = gfMul(a, x, m) & mask;
      for (let z = 0; z < n; z++) table[c]![z]! += w[pc[x ^ z]!]!;
    }
    const info = mutualInfoBits(table);
    sum += info;
    if (info < min) min = info;
    if (info > max) max = info;
    const pk = table.map((r) => r.reduce((s, v) => s + v, 0));
    worstHkDev = Math.max(worstHkDev, Math.abs(entropyBits(pk) - k));
    for (let c = 0; c < 1 << k; c++) for (let z = 0; z < n; z++) fAvg[c]![z]! += table[c]![z]!;
  }
  for (let c = 0; c < 1 << k; c++) for (let z = 0; z < n; z++) fAvg[c]![z]! /= fam;

  // family-mixed TV against uniform_K (x) P(Z)
  const pz = new Array<number>(n).fill(0);
  for (let z = 0; z < n; z++) for (let c = 0; c < 1 << k; c++) pz[z] = pz[z]! + fAvg[c]![z]!;
  let tv = 0;
  for (let c = 0; c < 1 << k; c++)
    for (let z = 0; z < n; z++) tv += Math.abs(fAvg[c]![z]! - 2 ** -k * pz[z]!);
  const tvFamilyMixed = tv / 2;

  const hInf = -m * Math.log2(Math.max(eps, 1 - eps));
  const lhlBound = 0.5 * 2 ** ((k - hInf) / 2);

  return {
    m,
    k,
    eps,
    beforeTable: before.table,
    beforeClosed: before.closed,
    afterMean: sum / fam,
    afterMin: min,
    afterMax: max,
    worstHkDev,
    tvFamilyMixed,
    hInf,
    lhlBound,
  };
}

// ---------------------------------------------------------------------------
// The sparse adversary (intercept-resend profile): Eve knows a subset S of
// the m raw bits exactly (and knows which). Because field multiplication is
// GF(2)-linear, K|z is uniform on a coset of trunc_k(a (x) U_Sbar) and
// I(K; (S, X_S) | a) = k - rank — exact linear algebra, cross-checked by
// brute-force enumeration on a sample.
// ---------------------------------------------------------------------------

/** GF(2) rank of a set of bit-vectors, leading-bit elimination */
function gf2Rank(vectors: number[]): number {
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

export interface SparseMeasure {
  readonly m: number;
  readonly k: number;
  readonly knownBits: number;
  readonly maps: number;
  readonly sets: number;
  readonly infoMean: number;
  readonly infoMin: number;
  readonly infoMax: number;
  /** brute-force second path on one (a, S) sample: H(K|z) enumerated vs rank */
  readonly sampleCheckDev: number;
}

function combinations(m: number, bits: number): number[] {
  const out: number[] = [];
  const rec = (start: number, left: number, acc: number) => {
    if (left === 0) {
      out.push(acc);
      return;
    }
    for (let i = start; i < m - left + 1; i++) rec(i + 1, left - 1, acc | (1 << i));
  };
  rec(0, bits, 0);
  return out;
}

export function sparseAdversaryInfo(m: number, k: number, knownBits: number): SparseMeasure {
  if (k < 1 || k > m) throw new Error(`sparseAdversaryInfo: need 1 <= k <= m`);
  if (knownBits < 0 || knownBits > m) throw new Error(`sparseAdversaryInfo: 0 <= knownBits <= m`);
  const n = 1 << m;
  const mask = (1 << k) - 1;
  const sets = combinations(m, knownBits);
  let sum = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const s of sets) {
    const free: number[] = [];
    for (let i = 0; i < m; i++) if ((s & (1 << i)) === 0) free.push(1 << i);
    for (let a = 1; a < n; a++) {
      const cols = free.map((e) => gfMul(a, e, m) & mask);
      const rank = gf2Rank(cols);
      const info = k - rank;
      sum += info;
      if (info < min) min = info;
      if (info > max) max = info;
    }
  }
  const total = sets.length * (n - 1);

  // second path: brute-force H(K | z) on the first (set, map), z = the known
  // bits set, enumerate every completion of the free positions.
  let sampleCheckDev = 0;
  if (sets.length > 0 && knownBits > 0) {
    const s = sets[0]!;
    const free: number[] = [];
    for (let i = 0; i < m; i++) if ((s & (1 << i)) === 0) free.push(i);
    const a = 1;
    const counts = new Map<number, number>();
    const completions = 1 << free.length;
    for (let u = 0; u < completions; u++) {
      let x = s; // z: every known bit reads 1 (any fixed z works — rank is z-independent)
      for (let j = 0; j < free.length; j++) if ((u >> j) & 1) x |= 1 << free[j]!;
      const key = gfMul(a, x, m) & mask;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const hBrute = entropyBits([...counts.values()].map((c) => c / completions));
    const cols = free.map((i) => gfMul(a, 1 << i, m) & mask);
    sampleCheckDev = Math.abs(hBrute - gf2Rank(cols));
  }

  return {
    m,
    k,
    knownBits,
    maps: n - 1,
    sets: sets.length,
    infoMean: sum / total,
    infoMin: min,
    infoMax: max,
    sampleCheckDev,
  };
}
