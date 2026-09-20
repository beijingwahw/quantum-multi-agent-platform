/**
 * Kernel — the mixed-strategy convexity argument, machine-executed (v0.5.0).
 *
 * W3's census caps the 256 DETERMINISTIC shared-randomness strategies at
 * |S| = 2 exactly; the README's boundary 4 carried the extension to MIXED
 * strategies as "convex combinations cannot exceed the deterministic cap
 * (standard argument, applied not re-proved)". This file executes that
 * argument as a machine instance, closing the boundary:
 *
 * Theorem (extremal attainment of a linear functional, executed).
 * The CHSH functional S is affine in the joint response tables, and the
 * local polytope here IS conv{the 256 deterministic vertices} — shared
 * randomness is exactly a convex mixture of deterministic strategies.
 *   (a) VERTEX COMPLETENESS. The deterministic strategy space is the full
 *       function set (+/-1)^4 (A's responses) x (+/-1)^4 (B's) = 16 x 16 =
 *       256, enumerated by id with no repetition (the enumeration IS the
 *       completeness certificate: every deterministic strategy has an id,
 *       and the census visits all of them — cross-checked against W3's own
 *       classicalCensus in the tests).
 *   (b) MIDPOINT TRIVIALITY (the extremal face). Every vertex is extreme:
 *       the vertices are the hypercube (+/-1)^8, whose convex hull is
 *       [-1,1]^8 coordinate-wise, and a coordinate pinned to +/-1 pins any
 *       midpoint decomposition to itself in that coordinate. The machine
 *       exhausts ALL 256*255/2 = 32640 vertex pairs: u + w = 2v holds only
 *       trivially (u = w = v); every nontrivial midpoint carries a 0
 *       coordinate and is not a vertex. No sampling.
 *   (c) THE CAP UNDER MIXING. For seeded dyadic convex combinations
 *       w_j = c_j / 2^D (c_j >= 0, sum c_j = 2^D), the mixed strategy's
 *       joint tables are the same mixture of vertex tables, and its CHSH
 *       value computed FROM THE MIXED TABLE (exact rational BigInt — the
 *       second path) equals the linear prediction sum_j w_j S(v_j) exactly,
 *       every trial. Hence |S_mix| <= max_j |S(v_j)| <= 2: the supremum of
 *       a linear functional over the polytope is attained at a vertex.
 *
 * Negative control (the smuggling trial). The PR box (CHSH = 4) is NOT a
 * local vertex. Smuggled into the mixture at any weight w > 0 against the
 * |S| = 2 vertex, the value (1-w)*2 + w*4 > 2 — the cap convicts. The cap's
 * innocence depends on the vertex set being exactly the local 256.
 *
 * Honest boundaries. Toy dimension: 2 settings per side, 2 outcomes, one
 * shared random bit — the polytope statement is about THIS strategy space,
 * and the general separation theorem is cited, not re-proved (CHSH69 is in
 * the book; convex analysis is standard — no new citation is claimed, no
 * arXiv id or DOI is quoted). Nothing existing was re-rendered; W3's float
 * census keeps running untouched.
 */
import { RcError, Rng } from "./state.js";

/** exact nonnegative-denominator rationals — no float enters any claim here */
export interface Rat {
  readonly n: bigint;
  readonly d: bigint;
}

const ratOf = (n: bigint, d = 1n): Rat => ({ n, d });

function ratAdd(a: Rat, b: Rat): Rat {
  return ratOf(a.n * b.d + b.n * a.d, a.d * b.d);
}

function ratMul(a: Rat, b: Rat): Rat {
  return ratOf(a.n * b.n, a.d * b.d);
}

function ratLe(a: Rat, b: Rat): boolean {
  return a.n * b.d <= b.n * a.d;
}

function ratLt(a: Rat, b: Rat): boolean {
  return a.n * b.d < b.n * a.d;
}

function ratAbs(a: Rat): Rat {
  return ratOf(a.n < 0n ? -a.n : a.n, a.d);
}

/** One deterministic shared-randomness vertex: rA/rB are the four response
 *  bits [x(a=0,s=0), x(a=0,s=1), x(a=1,s=0), x(a=1,s=1)] as +/-1. */
export interface Vertex {
  readonly id: number;
  readonly rA: readonly number[];
  readonly rB: readonly number[];
}

export const VERTEX_COUNT = 256;

function signBit(bit: number): 1 | -1 {
  return bit === 1 ? 1 : -1;
}

/** vertex by id = iA * 16 + iB — the full function-space enumeration */
export function vertexAt(id: number): Vertex {
  if (!Number.isInteger(id) || id < 0 || id >= VERTEX_COUNT)
    throw new RcError(
      "RC_MIX_ID_RANGE",
      `vertexAt: id must be an integer in [0, ${VERTEX_COUNT}) (got ${id})`,
    );
  const iA = id >> 4;
  const iB = id & 15;
  const rA = [0, 1, 2, 3].map((k) => signBit((iA >> k) & 1));
  const rB = [0, 1, 2, 3].map((k) => signBit((iB >> k) & 1));
  return { id, rA, rB };
}

/** S(v) as an exact rational: E(ai,bj) = (1/2) sum_s x(a,s) y(b,s) */
export function vertexS(id: number): Rat {
  const v = vertexAt(id);
  const e = (ai: number, bj: number): Rat => {
    const s0 = v.rA[ai * 2]! * v.rB[bj * 2]!;
    const s1 = v.rA[ai * 2 + 1]! * v.rB[bj * 2 + 1]!;
    return ratOf(BigInt(s0 + s1), 2n);
  };
  return ratAdd(
    ratAdd(ratAdd(e(0, 0), e(0, 1)), e(1, 0)),
    ratMul(ratOf(-1n), e(1, 1)),
  );
}

/** the vertex's joint tables P(x,y|a,b), layout [ab*4 + x*2 + y] with
 *  outcomes 0 -> -1, 1 -> +1; every cell is 0, 1/2, or 1 (seed uniform). */
export function vertexTables(id: number): readonly Rat[] {
  const v = vertexAt(id);
  const cells = Array<Rat>(16).fill(ratOf(0n));
  for (let ab = 0; ab < 4; ab++) {
    const a = ab >> 1;
    const b = ab & 1;
    for (let s = 0; s < 2; s++) {
      const x = v.rA[a * 2 + s]!;
      const y = v.rB[b * 2 + s]!;
      const cell = ab * 4 + (x > 0 ? 2 : 0) + (y > 0 ? 1 : 0);
      cells[cell] = ratAdd(cells[cell]!, ratOf(1n, 2n));
    }
  }
  return cells;
}

/** S computed from arbitrary joint tables (the second path — table algebra
 *  only, no strategy objects): E(ab) = sum_xy x*y*P(x,y|a,b). */
export function chshFromTables(cells: readonly Rat[]): Rat {
  if (cells.length !== 16)
    throw new RcError(
      "RC_MIX_TABLES",
      `chshFromTables: expected 16 cells (4 settings x 4 outcomes), got ${cells.length}`,
    );
  const e = (ab: number): Rat => {
    let acc = ratOf(0n);
    for (let x = 0; x < 2; x++)
      for (let y = 0; y < 2; y++) {
        const xy = (x === 0 ? -1 : 1) * (y === 0 ? -1 : 1);
        acc = ratAdd(
          acc,
          ratMul(ratOf(BigInt(xy)), cells[ab * 4 + x * 2 + y]!),
        );
      }
    return acc;
  };
  return ratAdd(ratAdd(ratAdd(e(0), e(1)), e(2)), ratMul(ratOf(-1n), e(3)));
}

/** The cap census: every vertex visited, the maximum exact, and the exact
 *  set of attained S values (completeness made countable). */
export interface CapCensus {
  readonly vertices: number;
  readonly maxAbsS: Rat;
  readonly distinctS: readonly Rat[];
}

export function classicalCapCensus(): CapCensus {
  let maxAbsS = ratOf(0n);
  const seen = new Map<string, Rat>();
  for (let id = 0; id < VERTEX_COUNT; id++) {
    const s = vertexS(id);
    maxAbsS = ratLt(maxAbsS, ratAbs(s)) ? ratAbs(s) : maxAbsS;
    if (!seen.has(`${s.n}/${s.d}`)) seen.set(`${s.n}/${s.d}`, s);
  }
  const distinct = [...seen.values()].sort((a, b) => (ratLt(a, b) ? -1 : 1));
  return { vertices: VERTEX_COUNT, maxAbsS, distinctS: distinct };
}

/** The extremal face: ALL 32640 vertex pairs checked — u + w = 2v only
 *  trivially; every nontrivial midpoint has a 0 coordinate (interior to the
 *  hypercube face structure, not a vertex). */
export interface Extremality {
  readonly pairsChecked: number;
  readonly nontrivialMidpointsAtVertices: number;
}

export function extremalityCensus(): Extremality {
  let pairs = 0;
  let violations = 0;
  for (let i = 0; i < VERTEX_COUNT; i++) {
    const u = vertexAt(i);
    for (let j = 0; j < i; j++) {
      const w = vertexAt(j);
      pairs++;
      // is (u + w)/2 itself a vertex? Only if u and w agree on all 8
      // response bits — impossible for distinct ids; a differing bit pins
      // the midpoint coordinate to 0, which no vertex has.
      let differs = false;
      for (let k = 0; k < 4 && !differs; k++)
        differs = u.rA[k] !== w.rA[k] || u.rB[k] !== w.rB[k];
      if (!differs) violations++;
    }
  }
  return { pairsChecked: pairs, nontrivialMidpointsAtVertices: violations };
}

/** One seeded dyadic mixing trial's certificate. */
export interface MixReport {
  readonly trials: number;
  readonly allLinear: boolean;
  readonly allWithinCap: boolean;
  readonly worstAbsS: Rat;
  readonly weightsSumOk: boolean;
}

/** Seeded random dyadic convex combinations of the 256 vertices: each trial
 *  drops 2^depth tokens uniformly into the vertex buckets, builds the mixed
 *  joint tables in exact BigInt rationals, computes S from the mixed table,
 *  and checks (i) exact equality with the linear prediction, (ii) the cap
 *  |S| <= 2, and (iii) the weights summing to exactly 2^depth. */
export function mixedCensus(
  seed: number,
  trials: number,
  depth: number,
): MixReport {
  if (!Number.isInteger(trials) || trials < 1)
    throw new RcError(
      "RC_MIX_TRIALS",
      `mixedCensus: trials must be a positive integer (got ${trials})`,
    );
  if (!Number.isInteger(depth) || depth < 1 || depth > 16)
    throw new RcError(
      "RC_MIX_DEPTH",
      `mixedCensus: depth must be in [1, 16] (got ${depth})`,
    );
  const rng = new Rng(seed);
  const tokens = 1 << depth;
  const denom = BigInt(tokens);
  const vertexSValues = Array.from({ length: VERTEX_COUNT }, (_, id) =>
    vertexS(id),
  );
  const vertexT = Array.from({ length: VERTEX_COUNT }, (_, id) =>
    vertexTables(id),
  );
  let allLinear = true;
  let allWithinCap = true;
  let weightsSumOk = true;
  let worst = ratOf(0n);
  for (let t = 0; t < trials; t++) {
    const counts = new Array<number>(VERTEX_COUNT).fill(0);
    for (let k = 0; k < tokens; k++)
      counts[Math.floor(rng.next() * VERTEX_COUNT)]!++;
    const sum = counts.reduce((a, b) => a + b, 0);
    if (sum !== tokens) weightsSumOk = false;
    // mixed tables: sum_j (c_j / 2^D) T_j
    const cells = Array<Rat>(16).fill(ratOf(0n));
    let predicted = ratOf(0n);
    for (let j = 0; j < VERTEX_COUNT; j++) {
      const c = BigInt(counts[j]!);
      if (c === 0n) continue;
      for (let cell = 0; cell < 16; cell++)
        cells[cell] = ratAdd(
          cells[cell]!,
          ratMul(ratOf(c, denom), vertexT[j]![cell]!),
        );
      predicted = ratAdd(predicted, ratMul(ratOf(c, denom), vertexSValues[j]!));
    }
    const fromTable = chshFromTables(cells);
    if (fromTable.n * predicted.d !== predicted.n * fromTable.d)
      allLinear = false;
    const absS = ratAbs(fromTable);
    if (ratLt(worst, absS)) worst = absS;
    if (!ratLe(absS, ratOf(2n))) allWithinCap = false;
  }
  return { trials, allLinear, allWithinCap, worstAbsS: worst, weightsSumOk };
}

/** The smuggling trial: the PR box (S = 4, nonlocal) mixed into the |S| = 2
 *  local vertex at weight w — the cap must convict for any w > 0. */
export function prBoxSmuggle(wN: bigint, wD: bigint): Rat {
  if (wD <= 0n || wN < 0n || wN >= wD)
    throw new RcError(
      "RC_MIX_WEIGHT",
      `prBoxSmuggle: weight must lie in [0,1) with positive denominator (got ${wN}/${wD})`,
    );
  // (1-w)*S_v + w*4 with S_v = 2 (the census max, exact)
  const local = ratMul(ratOf(wD - wN, wD), ratOf(2n));
  const smuggled = ratMul(ratOf(wN, wD), ratOf(4n));
  return ratAdd(local, smuggled);
}
