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
import { RcError, entropyBits, mutualInfoBits } from "./state.js";
import { h2 } from "./tariff.js";

// ---------------------------------------------------------------------------
// The toy fields GF(2^m): m = 4 (poly x^4 + x + 1) and m = 8 (poly
// x^8 + x^4 + x^3 + x + 1, the AES/Rijndael polynomial). Irreducibility is a
// machine certificate below: every nonzero element has an inverse.
// ---------------------------------------------------------------------------

const FIELD_POLY: Readonly<Record<number, number>> = {
  4: 0b10011,
  8: 0b100011011,
};

export function gfMul(a: number, b: number, m: number): number {
  const poly = FIELD_POLY[m];
  if (poly === undefined) throw new RcError("RC_NO_FIELD", `gfMul: no toy field GF(2^${m}) on file`);
  // operands must be field elements; an out-of-range operand would wrap
  // through the reduction and silently return a non-element
  if (!(a >= 0 && a < (1 << m) && b >= 0 && b < (1 << m)))
    throw new RcError("RC_FIELD_ELEM", `gfMul: operands must lie in [0, 2^${m}) (got a=${a}, b=${b})`);
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

// ---------------------------------------------------------------------------
// Hot-path caches (pure-function memoization; the W5 experiment evaluates the
// same exact enumerations dozens of times per render). Every cache stores a
// value that is a deterministic pure function of its key: a hit returns the
// very number the uncached path recomputed, so all tables are bit-identical
// by construction. Only the toy scales the machine actually runs (m <= 8,
// 256x256) take the cached fast path; larger m keeps the direct path with its
// original failure mode.
// ---------------------------------------------------------------------------

/** full multiplication table MT[a][x] = gfMul(a, x, m), 1 <= a < 2^m — an
 *  exhaustive, exact enumeration, so every lookup equals the gfMul call it
 *  replaces (the hot loops each made ~2^2m of those per render). */
const mulTables = new Map<number, number[][]>();
function mulTable(m: number): number[][] | undefined {
  if (m > 8) return undefined; // 2^m x 2^m tables beyond toy scale: direct path
  let t = mulTables.get(m);
  if (t === undefined) {
    const n = 1 << m;
    t = [];
    for (let a = 1; a < n; a++) {
      const row = new Array<number>(n);
      for (let x = 0; x < n; x++) row[x] = gfMul(a, x, m);
      t.push(row);
    }
    mulTables.set(m, t);
  }
  return t;
}

/** the BSC(d) joint weight structure G[x][z] = w[popcount(x ^ z)] — the exact
 *  matrix both bscBlockInfo's joint table and paMeasure's per-map fill read;
 *  shared model infrastructure (like bscWeights), not a second verification
 *  path: every entry is the same expression over the same w and popcounts. */
const gMatrices = new Map<string, number[][]>();
function gMatrix(m: number, eps: number): number[][] | undefined {
  if (m > 8) return undefined;
  const key = `${m}|${eps}`;
  let g = gMatrices.get(key);
  if (g === undefined) {
    const n = 1 << m;
    const pc = popcounts(n);
    const w = bscWeights(m, eps);
    g = [];
    for (let x = 0; x < n; x++) {
      const row = new Array<number>(n);
      for (let z = 0; z < n; z++) row[z] = w[pc[x ^ z]!]!;
      g.push(row);
    }
    gMatrices.set(key, g);
  }
  return g;
}

export interface InverseCensus {
  readonly m: number;
  readonly nonzero: number;
  readonly invertible: number;
}

/** every nonzero element invertible <=> the polynomial is irreducible <=> the
 *  toy structure is a field (exhaustive: a*b over all pairs is the search). */
export function inverseCensus(m: number): InverseCensus {
  // the census must enumerate to mean anything: at m <= 0 or m >= 31 the
  // `1 << m` bound wraps (or empties), the loops never run, gfMul's own field
  // gate never fires, and a vacuous {0, 0} certificate ships silently —
  // refused at the field gate instead, the same code gfMul would raise
  if (FIELD_POLY[m] === undefined) throw new RcError("RC_NO_FIELD", `inverseCensus: no toy field GF(2^${m}) on file`);
  const hit = inverseCensusMemo.get(m);
  if (hit !== undefined) return hit;
  const n = 1 << m;
  const mt = mulTable(m);
  let invertible = 0;
  for (let a = 1; a < n; a++) {
    if (mt !== undefined) {
      const row = mt[a - 1]!;
      for (let b = 1; b < n; b++) {
        if (row[b] === 1) {
          invertible++;
          break;
        }
      }
    } else {
      for (let b = 1; b < n; b++) {
        if (gfMul(a, b, m) === 1) {
          invertible++;
          break;
        }
      }
    }
  }
  const out = { m, nonzero: n - 1, invertible };
  inverseCensusMemo.set(m, out);
  return out;
}

const inverseCensusMemo = new Map<number, InverseCensus>();

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
  if (k < 1 || k > m) throw new RcError("RC_K_RANGE", `collisionCensus: need 1 <= k <= m (got m=${m}, k=${k})`);
  // the shift-wrap face of inverseCensus: `1 << m` wraps at m >= 31, the
  // family count goes non-positive, and the census would return universal2:
  // true over zero evidence (or a negative family) without ever multiplying
  if (FIELD_POLY[m] === undefined) throw new RcError("RC_NO_FIELD", `collisionCensus: no toy field GF(2^${m}) on file`);
  const memoKey = `${m}|${k}`;
  const hit = collisionCensusMemo.get(memoKey);
  if (hit !== undefined) return hit;
  const n = 1 << m;
  const mask = (1 << k) - 1;
  const fam = n - 1;
  const mt = mulTable(m);
  let collisionsPerDelta = -1;
  for (let delta = 1; delta < n; delta++) {
    let count = 0;
    for (let a = 1; a < n; a++) {
      const prod = mt !== undefined ? mt[a - 1]![delta]! : gfMul(a, delta, m);
      if ((prod & mask) === 0) count++;
    }
    if (collisionsPerDelta === -1) collisionsPerDelta = count;
    else if (count !== collisionsPerDelta)
      throw new RcError("RC_DELTA_DEPENDENCE", `collisionCensus: delta-dependence at delta=${delta} (${count} vs ${collisionsPerDelta}) — family analysis broken`);
  }
  const maxCollisionProb = collisionsPerDelta / fam;
  const uniform2Bound = 2 ** -k;
  const out = {
    m,
    k,
    family: fam,
    collisionsPerDelta,
    maxCollisionProb,
    uniform2Bound,
    universal2: maxCollisionProb <= uniform2Bound + 1e-15,
  };
  collisionCensusMemo.set(memoKey, out);
  return out;
}

const collisionCensusMemo = new Map<string, CollisionCensus>();

// ---------------------------------------------------------------------------
// The smoothed adversary: Z^m = X^m through a per-bit BSC(eps), X uniform.
// Everything below is exact enumeration on complete tables — no sampling.
// (A standalone class-assignment exporter lived here — zero references
//  workspace-wide; the live paMeasure path computes the same trunc_k(a (x) x)
//  inline, fused with the weight accumulation, so it was deleted outright.)
// ---------------------------------------------------------------------------

function popcounts(n: number): number[] {
  const pc = new Array<number>(n).fill(0);
  for (let i = 1; i < n; i++) pc[i] = pc[i >> 1]! + (i & 1);
  return pc;
}

/** the BSC(d) Hamming-weight probabilities of a uniform m-bit block:
 *  w[d] = 2^-m (1-eps)^(m-d) eps^d — the single source (bscBlockInfo and
 *  paMeasure rode identical inline copies before they were converged at
 *  v0.2.2; the expression is unchanged and moved verbatim, so every table
 *  it feeds is bit-identical by construction). This is shared model
 *  infrastructure, NOT a second verification path — the anti-smuggling
 *  two-path discipline (table vs closed form) stays separate by design. */
function bscWeights(m: number, eps: number): number[] {
  const w = new Array<number>(m + 1);
  for (let d = 0; d <= m; d++) w[d] = 2 ** -m * (1 - eps) ** (m - d) * eps ** d;
  return w;
}

/** I(X^m; Z^m) two paths: closed form m(1 - h2(eps)) vs the full 2^m x 2^m
 *  joint table through mutualInfoBits. */
export function bscBlockInfo(m: number, eps: number): { readonly closed: number; readonly table: number } {
  if (!(m >= 1 && m <= 16)) throw new RcError("RC_M_RANGE", `bscBlockInfo: m must lie in [1, 16] for exact enumeration (got m=${m})`);
  if (!(eps >= 0 && eps <= 0.5)) throw new RcError("RC_EPS_RANGE", `bscBlockInfo: BSC crossover eps must lie in [0, 1/2] (got ${eps})`);
  const memoKey = `${m}|${eps}`;
  const hit = bscBlockInfoMemo.get(memoKey);
  if (hit !== undefined) return hit;
  const n = 1 << m;
  // the joint table IS the shared BSC weight structure G[x][z] = w[pc[x^z]]
  // (same expression the inline build evaluated); at toy scale it comes from
  // the per-(m, eps) cache, beyond it the direct build stands
  const g = gMatrix(m, eps);
  let joint: number[][];
  if (g !== undefined) {
    joint = g;
  } else {
    const pc = popcounts(n);
    const w = bscWeights(m, eps);
    joint = Array.from({ length: n }, (_, x) => Array.from({ length: n }, (_, z) => w[pc[x ^ z]!]!));
  }
  const out = { closed: m * (1 - h2(eps)), table: mutualInfoBits(joint) };
  bscBlockInfoMemo.set(memoKey, out);
  return out;
}

const bscBlockInfoMemo = new Map<string, { readonly closed: number; readonly table: number }>();

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
  if (!(m >= 1 && m <= 16)) throw new RcError("RC_M_RANGE", `paMeasure: m must lie in [1, 16] for exact enumeration (got m=${m})`);
  if (k < 1 || k > m) throw new RcError("RC_K_RANGE", `paMeasure: need 1 <= k <= m (got m=${m}, k=${k})`);
  if (!(eps >= 0 && eps <= 0.5)) throw new RcError("RC_EPS_RANGE", `paMeasure: BSC crossover eps must lie in [0, 1/2] (got ${eps})`);
  const memoKey = `${m}|${k}|${eps}`;
  const hit = paMeasureMemo.get(memoKey);
  if (hit !== undefined) return hit;
  const n = 1 << m;
  const mask = (1 << k) - 1;
  const fam = n - 1;
  const pc = popcounts(n);
  const w = bscWeights(m, eps);
  // toy-scale fast path: the full multiplication table (one gfMul-identical
  // lookup per (a, x)) and the shared BSC weight rows G[x][z] = w[pc[x^z]]
  // (the exact value the inner loop's expression produced for that cell)
  const mt = mulTable(m);
  const g = gMatrix(m, eps);

  const before = bscBlockInfo(m, eps);

  let sum = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let worstHkDev = 0;
  const fAvg: number[][] = Array.from({ length: 1 << k }, () => new Array<number>(n).fill(0));
  for (let a = 1; a < n; a++) {
    const table: number[][] = Array.from({ length: 1 << k }, () => new Array<number>(n).fill(0));
    const mtRow = mt !== undefined ? mt[a - 1]! : undefined;
    for (let x = 0; x < n; x++) {
      const c = mtRow !== undefined ? mtRow[x]! & mask : gfMul(a, x, m) & mask;
      if (g !== undefined) {
        const row = table[c]!;
        const gx = g[x]!;
        for (let z = 0; z < n; z++) row[z] = row[z]! + gx[z]!;
      } else {
        const row = table[c]!;
        for (let z = 0; z < n; z++) row[z] = row[z]! + w[pc[x ^ z]!]!;
      }
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

  const out = {
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
  paMeasureMemo.set(memoKey, out);
  return out;
}

const paMeasureMemo = new Map<string, PaMeasure>();

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
  if (!(m >= 1 && m <= 16)) throw new RcError("RC_M_RANGE", `sparseAdversaryInfo: m must lie in [1, 16] for exact enumeration (got m=${m})`);
  if (k < 1 || k > m) throw new RcError("RC_K_RANGE", `sparseAdversaryInfo: need 1 <= k <= m (got m=${m}, k=${k})`);
  if (knownBits < 0 || knownBits > m) throw new RcError("RC_KNOWNBITS_RANGE", `sparseAdversaryInfo: 0 <= knownBits <= m (got knownBits=${knownBits}, m=${m})`);
  const n = 1 << m;
  const mask = (1 << k) - 1;
  const sets = combinations(m, knownBits);
  const mt = mulTable(m);
  let sum = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const s of sets) {
    const free: number[] = [];
    for (let i = 0; i < m; i++) if ((s & (1 << i)) === 0) free.push(1 << i);
    for (let a = 1; a < n; a++) {
      const mtRow = mt !== undefined ? mt[a - 1]! : undefined;
      // the truncated products trunc_k(a (x) e) as one table lookup each —
      // every lookup equals the gfMul(a, e, m) it replaces (exact enumeration)
      const cols = free.map((e) => (mtRow !== undefined ? mtRow[e]! : gfMul(a, e, m)) & mask);
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
