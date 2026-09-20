/**
 * The covering-partition certificate — v0.5.0's gap-free face.
 *
 * v0.2.0's theorem certified the three chi families on the grid
 * lambda = i/20: twenty-one points, twenty certified descents, twenty
 * certified convexity cells. BETWEEN the grid points the curves carried no
 * certificate — descending "on the lattice" is not descending at every scale.
 * This module closes those gaps with an adaptive rational subdivision:
 *
 * THEOREM (machine, exact): for each family and each ln path, every seed cell
 * [i/20, (i+1)/20] is subdivided to at least REFINE_FLOOR levels —
 * unconditionally, because a partition that merely reproduces the grid
 * certificate certifies nothing new — and further while a cell fails its gap.
 * A cell is DESCENT-certified when chi(a).lo - chi(b).hi > 0 and
 * CONVEXITY-certified when chi(a).lo + chi(b).lo - 2 chi(m).hi > 0 at the
 * exact rational midpoint m — the same interval relations the v0.2.0 grid
 * certifier applies to adjacent lattice points, lifted to every cell the
 * machine discovers. The certificate's coverage IS the partition: the machine
 * reports the partition size, the discovered depth, and the exact minimum
 * certified gap per face. No analytic all-interval statement is booked.
 *
 * The chain face: the subdivision's endpoints are re-verified through
 * certifyStrictlyDecreasing itself (theorem.ts's checker, shared here), and
 * every grid point i/20 must be a partition point — the new certificate is
 * a strict refinement of the old one, never a replacement. The convexity
 * face is per-cell by necessity: certifyConvexGrid signs the second
 * difference v[i-1] + v[i+1] - 2 v[i] only at EQUAL spacing, and an adaptive
 * partition is not uniform — a mixed-depth triple would pass the old checker
 * on a convexity-violating arrangement, so the midpoint triple (always
 * equally spaced) is the only honest per-cell carrier.
 *
 * METHODOLOGICAL CONTRAST (the sibling nosignal-tariff v0.4.0 — the reason
 * this module exists as a different species, not a port): that repo's
 * withdrawal curve admits an all-positive-coefficient power series, so any
 * rational pair carries a scale-free algebraic margin — one closed-form
 * inequality covers the whole interval at any scale the rationals can name.
 * The chi families admit no such re-indexing: the eigenvalue slopes mix
 * signs ((5-l)/16 descends while (3+l)/16 climbs), so the entropy sum's
 * series carriers have mixed-sign coefficients and no pair margin factors
 * out. THAT is why the certificate carrier here is the subdivision itself:
 * it buys gap-free coverage at a finite, machine-discovered resolution —
 * honestly weaker than an algebraic all-interval margin, and the strongest
 * carrier these families have. The contrast is the finding.
 *
 * Honest split (the same line as v0.2.0):
 *   THEOREM (machine, exact): the covering partition, every cell's gap an
 *     exact rational comparison of interval bounds; both ln paths agree
 *     (overlap at every partition point); the min gap dominates the max
 *     enclosure width (the margin is not enclosure slop).
 *   CITATION (classical analysis, data only): F1's chi'' formula — restated
 *     below because theorem.ts keeps its copy private and this repo's law is
 *     new-file-only — checked per cell against the midpoint second
 *     difference; agreement is quoted as data, never as certificate.
 */
import {
  type Frac,
  type Ivl,
  type LnPath,
  F_ONE,
  F_ZERO,
  fAdd,
  fCmp,
  fDiv,
  fMul,
  fSub,
  fr,
  iAdd,
  iDivPos,
  iNeg,
  iOf,
  iScaleNonneg,
  iSub,
  iWidth,
  LN_PATHS,
  PATH_T,
} from "./rational.js";
import { refuse } from "../core/errors.js";
import {
  certifyStrictlyDecreasing,
  esc18Chi,
  gridPoints,
  k3Chi,
  replacerChi,
} from "./theorem.js";

// --- the adaptive subdivision machinery (generic — shared with the smuggling trials) -----------

export interface WallCell {
  readonly a: Frac;
  readonly b: Frac;
}

/** A curve evaluator with the ln path pre-bound — counterfeit curves plug in here. */
export type CellChiFn = (lambda: Frac) => Ivl;

/** The exact gap a cell must carry for its face to certify (descent or convexity). */
export type CellGapFn = (chi: CellChiFn, a: Frac, b: Frac) => Frac;

export interface SubCell {
  readonly a: Frac;
  readonly b: Frac;
  /** bisections below the seed — depth REFINE_FLOOR is the certificate's floor resolution */
  readonly depth: number;
  /** which seed cell this cell descends from */
  readonly seed: number;
  readonly gap: Frac;
}

export interface ConvictedCell {
  readonly seed: number;
  readonly a: Frac;
  readonly b: Frac;
  readonly depth: number;
  /** the nonpositive gap that named it — the forger's runway, measured exactly */
  readonly gap: Frac;
}

export interface SubdivisionResult {
  readonly ok: boolean;
  /** cells carrying a strictly positive gap (the certified covering when ok) */
  readonly cells: readonly SubCell[];
  /** min over cells (null when !ok, mirroring StrictDecrResult) */
  readonly minGap: Frac | null;
  readonly maxDepthUsed: number;
  readonly convicted: ConvictedCell | null;
}

/**
 * The subdivision queue: cells below REFINE_FLOOR bisect unconditionally (the
 * floor resolution is part of the claim); at or above it a positive gap
 * certifies, a nonpositive gap bisects while depth remains, and depth
 * exhaustion CONVICTS with the named cell and its exact nonpositive gap. On
 * the true curves every floor cell certifies (the machine discovers depth
 * REFINE_FLOOR and stops) — the bisection is armed for hiding dips, whose
 * cells fail at every depth until the runway runs out.
 */
export function certifySubdivision(
  chi: CellChiFn,
  gapOf: CellGapFn,
  seeds: readonly WallCell[],
  refineFloor: number,
  maxDepth: number,
): SubdivisionResult {
  if (seeds.length === 0) {
    refuse(
      "GLOBALWALL_EMPTY_SEEDS",
      "certifySubdivision: no seed cells — a certificate of nothing certifies nothing",
    );
  }
  if (
    !Number.isInteger(refineFloor) ||
    refineFloor < 0 ||
    !Number.isInteger(maxDepth) ||
    maxDepth < refineFloor
  ) {
    refuse(
      "GLOBALWALL_DEPTH_BUDGET",
      `certifySubdivision: depth budget must satisfy 0 <= refineFloor (${refineFloor}) <= maxDepth (${maxDepth})`,
    );
  }
  const cells: SubCell[] = [];
  let maxDepthUsed = 0;
  const queue: Array<{ a: Frac; b: Frac; depth: number; seed: number }> =
    seeds.map((c, i) => ({
      a: c.a,
      b: c.b,
      depth: 0,
      seed: i,
    }));
  while (queue.length > 0) {
    const c = queue.shift()!;
    if (c.depth < refineFloor) {
      // unconditional refinement — the floor resolution is claimed, not optional
      const mid = fDiv(fAdd(c.a, c.b), fr(2));
      queue.push(
        { a: c.a, b: mid, depth: c.depth + 1, seed: c.seed },
        { a: mid, b: c.b, depth: c.depth + 1, seed: c.seed },
      );
      continue;
    }
    const gap = gapOf(chi, c.a, c.b);
    if (fCmp(gap, F_ZERO) > 0) {
      cells.push({ a: c.a, b: c.b, depth: c.depth, seed: c.seed, gap });
      if (c.depth > maxDepthUsed) maxDepthUsed = c.depth;
      continue;
    }
    if (c.depth >= maxDepth) {
      return {
        ok: false,
        cells,
        minGap: null,
        maxDepthUsed,
        convicted: { ...c, gap },
      };
    }
    const mid = fDiv(fAdd(c.a, c.b), fr(2));
    queue.push(
      { a: c.a, b: mid, depth: c.depth + 1, seed: c.seed },
      { a: mid, b: c.b, depth: c.depth + 1, seed: c.seed },
    );
  }
  let minGap: Frac | null = null;
  for (const cell of cells) {
    minGap =
      minGap === null
        ? cell.gap
        : fCmp(cell.gap, minGap) < 0
          ? cell.gap
          : minGap;
  }
  return { ok: true, cells, minGap, maxDepthUsed, convicted: null };
}

/** Descent gap of a cell: the grid certifier's adjacent-pair relation, verbatim. */
export const descentGap: CellGapFn = (chi, a, b) => fSub(chi(a).lo, chi(b).hi);

/** Convexity gap of a cell: midpoint second difference, lower bound — equal spacing by construction. */
export const convexityGap: CellGapFn = (chi, a, b) => {
  const m = fDiv(fAdd(a, b), fr(2));
  return fSub(fAdd(chi(a).lo, chi(b).lo), fMul(chi(m).hi, fr(2)));
};

/** Convenience wrappers naming the face (the trials call the generic engine directly). */
export function certifyAdaptiveDescent(
  chi: CellChiFn,
  seeds: readonly WallCell[],
  refineFloor: number,
  maxDepth: number,
): SubdivisionResult {
  return certifySubdivision(chi, descentGap, seeds, refineFloor, maxDepth);
}

export function certifyAdaptiveConvexity(
  chi: CellChiFn,
  seeds: readonly WallCell[],
  refineFloor: number,
  maxDepth: number,
): SubdivisionResult {
  return certifySubdivision(chi, convexityGap, seeds, refineFloor, maxDepth);
}

// --- the certificate assembly -------------------------------------------------------------------

/** Every F1/F2 seed cell subdivides this deep unconditionally — the certificate's resolution (1/80). */
export const REFINE_FLOOR = 2;
/**
 * F3's floor is shallower BY COST, stated openly: the k=3 family evaluates
 * fourteen entropy terms per point, and on this kernel's UNREDUCED fractions
 * (rational.ts, frozen by the new-file law) the atanh path's denominators
 * grow as (m.d)^2048 — a deeper partition costs minutes, not milliseconds.
 * The certificate claims per-family resolution and reports it; F3's covering
 * is 1/40, F1/F2's is 1/80, both strictly finer than the v0.2.0 lattice and
 * both adaptive below their floors.
 */
export const REFINE_FLOOR_K3 = 1;
/** The forger's runway: a cell failing at this depth convicts instead of bisecting. */
export const MAX_DEPTH = 12;

/** The 20 grid cells [i/20, (i+1)/20] — the v0.2.0 lattice, as seeds. */
export function wallSeeds(): WallCell[] {
  const pts = gridPoints();
  const seeds: WallCell[] = [];
  for (let i = 0; i + 1 < pts.length; i++)
    seeds.push({ a: pts[i]!, b: pts[i + 1]! });
  return seeds;
}

/** F1's chi'' citation formula, restated (theorem.ts keeps its copy private; this
 * repo's law is new-file-only): chi''(l) = [1/(3-l)+1/(1+l)-1/(5-l)-1/(3+l)]/(8 ln 2). */
export function esc18SecondDerivativeIvl(
  lambda: Frac,
  path: LnPath = PATH_T,
): Ivl {
  const l = lambda;
  const bracket = iAdd(
    iAdd(iOf(fDiv(F_ONE, fSub(fr(3), l))), iOf(fDiv(F_ONE, fAdd(fr(1), l)))),
    iNeg(
      iAdd(iOf(fDiv(F_ONE, fSub(fr(5), l))), iOf(fDiv(F_ONE, fAdd(fr(3), l)))),
    ),
  );
  return iDivPos(iScaleNonneg(bracket, fr(1, 8)), path.ln2);
}

function iDist(a: Ivl, b: Ivl): Frac {
  const c1 = fSub(a.lo, b.hi);
  const c2 = fSub(b.lo, a.hi);
  return fCmp(c1, c2) > 0 ? c1 : c2;
}

export interface FamilyWallCert {
  readonly family: string;
  /** per-path descent subdivisions, one entry per LN_PATHS */
  readonly descent: readonly SubdivisionResult[];
  /** per-path per-cell convexity subdivisions */
  readonly convex: readonly SubdivisionResult[];
  /** min descent gap over paths (exact) */
  readonly minGap: Frac | null;
  /** min convexity gap over paths (exact) */
  readonly minDD: Frac | null;
  /** partition points per path (cells + 1; both paths agree by construction) */
  readonly partitionPoints: number;
  /** deepest bisection the machine needed */
  readonly maxDepthUsed: number;
  /** widest chi enclosure across the partition — the honesty number */
  readonly maxWidth: Frac;
  /** the two paths' enclosures share a point at every partition point */
  readonly crossOverlapAll: boolean;
  /** every grid point i/20 is a partition point, and the endpoint chain re-verifies green
   * through certifyStrictlyDecreasing with the same min gap — the shared v0.2.0 checker */
  readonly chainViaGridCertifier: boolean;
  /** every grid point appears among the partition endpoints */
  readonly coversGrid: boolean;
  /** min descent gap > max enclosure width — the margin is not enclosure slop */
  readonly gapDominatesWidth: boolean;
  /** F1 only: max |midpoint second difference - citation chi''(m)*(b-a)^2/2| (DATA, exact) */
  readonly citationMaxDist: Frac | null;
}

function certifyWallFamily(
  family: string,
  chi: (lambda: Frac, path: LnPath) => Ivl,
  citation: boolean,
  refineFloor: number,
): FamilyWallCert {
  const seeds = wallSeeds();
  const descent = LN_PATHS.map((path) =>
    certifyAdaptiveDescent((l) => chi(l, path), seeds, refineFloor, MAX_DEPTH),
  );
  const convex = LN_PATHS.map((path) =>
    certifyAdaptiveConvexity(
      (l) => chi(l, path),
      seeds,
      refineFloor,
      MAX_DEPTH,
    ),
  );
  let minGap: Frac | null = null;
  for (const d of descent) {
    if (d.minGap === null) continue;
    minGap =
      minGap === null
        ? d.minGap
        : fCmp(d.minGap, minGap) < 0
          ? d.minGap
          : minGap;
  }
  let minDD: Frac | null = null;
  for (const c of convex) {
    if (c.minGap === null) continue;
    minDD =
      minDD === null ? c.minGap : fCmp(c.minGap, minDD) < 0 ? c.minGap : minDD;
  }
  // partition endpoints per path, sorted: the chain face and the grid coverage
  const firstPath = descent[0]!;
  const pts = new Set<string>();
  for (const cell of firstPath.cells) {
    pts.add(`${cell.a.n}/${cell.a.d}`);
    pts.add(`${cell.b.n}/${cell.b.d}`);
  }
  const sorted = [...pts]
    .map((s) => {
      const [n, d] = s.split("/");
      return fr(BigInt(n!), BigInt(d!));
    })
    .sort((x, y) => fCmp(x, y));
  let chainViaGridCertifier = true;
  let crossOverlapAll = true;
  let maxWidth = F_ZERO;
  for (let p = 0; p < LN_PATHS.length; p++) {
    const path = LN_PATHS[p]!;
    const vals = sorted.map((pt) => chi(pt, path));
    const chain = certifyStrictlyDecreasing(vals);
    // per-path: the shared checker must reproduce THAT path's own subdivision minimum
    if (
      !chain.ok ||
      chain.minGap === null ||
      descent[p]!.minGap === null ||
      fCmp(chain.minGap, descent[p]!.minGap!) !== 0
    ) {
      chainViaGridCertifier = false;
    }
    for (const val of vals) {
      const w = iWidth(val);
      if (fCmp(w, maxWidth) > 0) maxWidth = w;
    }
  }
  const otherPath = LN_PATHS[1]!;
  for (const p of sorted) {
    const t = chi(p, PATH_T);
    const a = chi(p, otherPath);
    if (fCmp(t.lo, a.hi) > 0 || fCmp(a.lo, t.hi) > 0) crossOverlapAll = false;
  }
  let coversGrid = true;
  const ptsSet = new Set(sorted.map((p) => `${p.n}/${p.d}`));
  for (const g of gridPoints()) {
    if (!ptsSet.has(`${g.n}/${g.d}`)) coversGrid = false;
  }
  // F1 citation: per cell, the midpoint second difference vs chi''(m)*(b-a)^2/2 — data only
  let citationMaxDist: Frac | null = null;
  if (citation) {
    let maxDist = F_ZERO;
    for (const cell of firstPath.cells) {
      const m = fDiv(fAdd(cell.a, cell.b), fr(2));
      const dd = iSub(
        iAdd(chi(cell.a, PATH_T), chi(cell.b, PATH_T)),
        iScaleNonneg(chi(m, PATH_T), fr(2)),
      );
      const scaled = iScaleNonneg(
        esc18SecondDerivativeIvl(m, PATH_T),
        fDiv(fMul(fSub(cell.b, cell.a), fSub(cell.b, cell.a)), fr(2)),
      );
      const dist = iDist(dd, scaled);
      if (fCmp(dist, maxDist) > 0) maxDist = dist;
    }
    citationMaxDist = maxDist;
  }
  return {
    family,
    descent,
    convex,
    minGap,
    minDD,
    partitionPoints: sorted.length,
    maxDepthUsed: Math.max(
      ...descent.map((d) => d.maxDepthUsed),
      ...convex.map((c) => c.maxDepthUsed),
    ),
    maxWidth,
    crossOverlapAll,
    chainViaGridCertifier,
    coversGrid,
    gapDominatesWidth: minGap !== null && fCmp(minGap, maxWidth) > 0,
    citationMaxDist,
  };
}

export interface GlobalWallCert {
  readonly esc18: FamilyWallCert;
  readonly replacer: FamilyWallCert;
  readonly k3: FamilyWallCert;
  readonly ok: boolean;
}

export function familyWallOk(c: FamilyWallCert): boolean {
  return (
    c.descent.every((d) => d.ok) &&
    c.convex.every((v) => v.ok) &&
    c.crossOverlapAll &&
    c.chainViaGridCertifier &&
    c.coversGrid &&
    c.gapDominatesWidth
  );
}

let wallCache: GlobalWallCert | null = null;

/** The covering-partition certificate, memoized (pure and expensive). */
export function globalWallCertificates(): GlobalWallCert {
  wallCache ??= {
    esc18: certifyWallFamily(
      "F1 ESC18 weak readout (covering partition)",
      esc18Chi,
      true,
      REFINE_FLOOR,
    ),
    replacer: certifyWallFamily(
      "F2 replacer control (covering partition)",
      replacerChi,
      false,
      REFINE_FLOOR,
    ),
    k3: certifyWallFamily(
      "F3 k=3 six orders (covering partition)",
      k3Chi,
      false,
      REFINE_FLOOR_K3,
    ),
    get ok(): boolean {
      return (
        familyWallOk(this.esc18) &&
        familyWallOk(this.replacer) &&
        familyWallOk(this.k3)
      );
    },
  };
  return wallCache;
}
