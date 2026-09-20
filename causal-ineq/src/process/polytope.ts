/**
 * E14 — the exact contamination robustness of W* against the causal polytope
 * (the LP duality face), executed.
 *
 * THE OBJECTS. The three constructed causal processes of construct.ts span the
 * repo's causal polytope face
 *     C = conv{ V_AB (channel A≺B), V_BA (channel B≺A), V_M (white noise) },
 * a 2-simplex of VALID processes (every mixture valid — PSD convex, trace
 * affine, support signatures nested in the allowed set). The OCB z/x protocol
 * executed on the process Born rule gives each vertex an EXACT rational
 * payoff under any rational weight pair (c1, c2):
 *     p_M  = (c1 + c2)/2      — white noise, chance on both branches;
 *     p_AB = c1/2 + c2        — Bob reads a off the channel (y-branch = 1);
 *     p_BA = (c1 + c2)/2      — the B≺A channel is payoff-isomorphic to white
 *                               noise under THIS protocol: Alice's z-read of
 * A1 returns b XOR t (t Bob's private x-outcome), so both branches stay at
 * chance. (The B≺A ORDER still saturates the biased cap with a different
 * strategy — classical.ts's exhaustion; under the fixed OCB protocol the
 * vertex sits at chance. Both faces are machine-pinned in the tests.)
 *
 * THE THEOREM. The payoff is affine in the process (Born rule), so for a
 * mixture β·W* + (1−β)·V the protocol value is β·p_W* + (1−β)·p_V with
 * p_W* = (c1+c2)(2+√2)/4 exactly (an element of ℚ(√2)). Inside E13's
 * silver-ratio cone (p_W* > cap) the mixture violates the cap iff
 *     β > β*(V) := (cap − p_V) / (p_W* − p_V)      — the per-direction
 * critical W*-weight, a closed form in ℚ(√2) for rational weights. Three
 * exact LP faces, all in BigInt-fraction arithmetic:
 *
 * (a) WORST DIRECTION: β* is decreasing in p_V, so the worst contamination
 *     is the payoff-MINIMUM vertex — max/min of the linear payoff over C are
 *     small exact simplex LPs whose dual certificates close with gap exactly
 *     0. Uniform weights: the worst directions are white noise AND V_BA,
 *     β* = 1/√2 EXACTLY — the T3 white-noise threshold is a special-case
 *     direction of the polytope face. Guaranteed contamination radius
 *     σ_guar = 1 − 1/√2 (fraction of causal impurity tolerated against EVERY
 *     direction at once).
 * (b) BEST DIRECTION: the A≺B channel's payoff IS the uniform cap (3/4), so
 *     β*(V_AB) = 0 — ANY strictly positive W*-weight keeps the violation
 *     (β = 1e−9 pinned). The violation is arbitrarily dilutable against the
 *     extreme channel direction; under biased weights no vertex sits at the
 *     cap and every direction has β* > 0 (executed grid).
 * (c) SMUGGLING: membership in C is an exact Phase-1 LP over the rational
 *     entry grid — genuine barycentric members are recovered exactly
 *     (λ = (1/3,1/3,1/3)), forbidden-pattern processes are rejected by exact
 *     infeasibility, and W* and noisy-W* blends carry irrational entries (1/4√2) and
 *     are rejected BY NAME at the rationality gate — besides which no causal
 *     member can have payoff above the cap, so p_W* > cap alone convicts W*.
 *
 * CERTIFICATE DIVERGENCE (executed observation): W*'s spectrum is exactly
 * {0, ½}, and so is each channel's — they are isospectral — but any mixture
 * spreads the eigenvalues immediately (repulsion against white noise:
 * {⅛, ⅜}; against the channel: {0, 0.725}); the spectral certificate dies
 * with the first drop of contamination while the payoff violation survives
 * as long as β > β*. The two certificates part ways exactly at the
 * contamination boundary.
 *
 * Honest boundaries: C is the THREE-VERTEX hull of the constructed causal
 * processes (a subset of the full causal set, which is not a polytope in
 * the quantum formalism); payoffs are the fixed OCB protocol's values (the
 * strategy-sup face is cited, not re-optimized, for mixtures); robustness is
 * in the payoff metric only (no Hilbert-metric claim); weight pairs outside
 * E13's cone have no violation to protect and are refused by name.
 */
import {
  NamedError,
  cmatAdd,
  cmatScale,
  hermitianExtremeEig,
  type CMat,
} from "../core/cmat.js";
import { wChannelAB, wChannelBA, wMixed, wStar } from "./construct.js";
import { checkValidity } from "./validity.js";
import { runProtocol } from "../game/quantum.js";

// ---------------------------------------------------------------------------
// exact rationals (BigInt fractions), reduced, d > 0
// ---------------------------------------------------------------------------

export interface Frac {
  readonly n: bigint;
  readonly d: bigint;
}

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

export function frac(n: bigint, d = 1n): Frac {
  if (d === 0n)
    throw new NamedError("polytope/zero-denominator", "frac: denominator 0");
  const s = d < 0n ? -1n : 1n;
  const g = gcd(n, d) || 1n;
  return { n: (s * n) / g, d: (s * d) / g };
}

const ZERO = frac(0n);
const ONE = frac(1n);
const HALF = frac(1n, 2n);

export const fAdd = (a: Frac, b: Frac): Frac =>
  frac(a.n * b.d + b.n * a.d, a.d * b.d);
export const fSub = (a: Frac, b: Frac): Frac =>
  frac(a.n * b.d - b.n * a.d, a.d * b.d);
export const fMul = (a: Frac, b: Frac): Frac => frac(a.n * b.n, a.d * b.d);
export const fDiv = (a: Frac, b: Frac): Frac => {
  if (b.n === 0n)
    throw new NamedError("polytope/div-zero", `fDiv: ${a.n}/${a.d} by zero`);
  return frac(a.n * b.d, a.d * b.n);
};
export const fNeg = (a: Frac): Frac => frac(-a.n, a.d);
/** Exact comparison: −1, 0, +1. */
export function fCmp(a: Frac, b: Frac): number {
  const l = a.n * b.d;
  const r = b.n * a.d;
  return l < r ? -1 : l > r ? 1 : 0;
}
export const fIsZero = (a: Frac): boolean => a.n === 0n;
export const fToNumber = (a: Frac): number => Number(a.n) / Number(a.d);

/**
 * Exact rational reconstruction from a float via continued fractions: the
 * first convergent p/q with |x − p/q| ≤ tol AND q ≤ maxDen (10⁴) is taken —
 * a small-denominator rational (the vertices' quarters, 1/20 controls, 5/12
 * barycentric entries) is recovered EXACTLY, while an irrational entry
 * (1/(4√2) ≈ 0.17678, carried by W* and every noisy blend) needs q ≳ 10⁶ to
 * get within 1e-12 and is refused BY NAME — the irrationality gate.
 */
export function fOfNumber(x: number, tol = 1e-12, maxDen = 10000n): Frac {
  if (!Number.isFinite(x)) {
    throw new NamedError(
      "polytope/irrational-entry",
      `fOfNumber: ${x} is not finite`,
    );
  }
  const sgn = x < 0 ? -1n : 1n;
  const ax = Math.abs(x);
  // convergents h_i/k_i of ax; h_{-2}=0, h_{-1}=1; k_{-2}=1, k_{-1}=0
  let hPrev = 0n;
  let hCur = 1n;
  let kPrev = 1n;
  let kCur = 0n;
  let a = BigInt(Math.floor(ax));
  let rem = ax - Math.floor(ax);
  for (let step = 0; step < 40; step++) {
    const h = a * hCur + hPrev;
    const k = a * kCur + kPrev;
    if (k > maxDen) break; // denominators only grow along the expansion
    if (Math.abs(ax - Number(h) / Number(k)) <= tol) return frac(sgn * h, k);
    hPrev = hCur;
    hCur = h;
    kPrev = kCur;
    kCur = k;
    if (rem === 0) break;
    const inv = 1 / rem;
    a = BigInt(Math.floor(inv));
    rem = inv - Math.floor(inv);
  }
  throw new NamedError(
    "polytope/irrational-entry",
    `fOfNumber: ${x} is not a small-denominator rational within ${tol} — W* and its blends carry 1/(4√2) entries outside the hull's coordinate ring`,
  );
}

// ---------------------------------------------------------------------------
// ℚ(√2): a + b·√2 — the ring where p_W*, β* and σ_guar live
// ---------------------------------------------------------------------------

export interface Q2 {
  readonly a: Frac;
  readonly b: Frac;
}

export const q2 = (a: Frac, b: Frac): Q2 => ({ a, b });
export const q2OfFrac = (a: Frac): Q2 => ({ a, b: ZERO });
export const q2Add = (x: Q2, y: Q2): Q2 => q2(fAdd(x.a, y.a), fAdd(x.b, y.b));
export const q2Sub = (x: Q2, y: Q2): Q2 => q2(fSub(x.a, y.a), fSub(x.b, y.b));
export const q2Mul = (x: Q2, y: Q2): Q2 =>
  q2(
    fAdd(fMul(x.a, y.a), fMul(fMul(x.b, y.b), frac(2n))),
    fAdd(fMul(x.a, y.b), fMul(x.b, y.a)),
  );
export function q2Div(x: Q2, y: Q2): Q2 {
  // multiply by the conjugate: denominator a² − 2b², nonzero for y ≠ 0
  const den = fSub(fMul(y.a, y.a), fMul(frac(2n), fMul(y.b, y.b)));
  if (fIsZero(den)) {
    throw new NamedError(
      "polytope/q2-div-zero",
      "q2Div: divisor is zero in ℚ(√2)",
    );
  }
  const num = q2Mul(x, q2(y.a, fNeg(y.b)));
  return q2(fDiv(num.a, den), fDiv(num.b, den));
}
/** Exact sign of a + b√2, via the norm (a + b√2)(a − b√2) = a² − 2b². */
export function q2Sign(x: Q2): number {
  if (fIsZero(x.b)) return fCmp(x.a, ZERO);
  if (fIsZero(x.a)) return fCmp(x.b, ZERO);
  const norm = fSub(fMul(x.a, x.a), fMul(frac(2n), fMul(x.b, x.b)));
  const sn = fCmp(norm, ZERO);
  if (sn === 0) return 0; // unreachable for irrational √2 unless a = b = 0
  return fCmp(x.a, ZERO) * sn;
}
export const q2ToNumber = (x: Q2): number =>
  fToNumber(x.a) + fToNumber(x.b) * Math.SQRT2;

// ---------------------------------------------------------------------------
// the small exact simplex (Bland's rule, Phase-1): max c·x s.t. Ax=b, x≥0
// ---------------------------------------------------------------------------

export interface ExactLPResult {
  readonly status: "OPTIMAL" | "INFEASIBLE" | "UNBOUNDED";
  readonly value: Frac | null;
  readonly x: readonly Frac[] | null;
  /** the Phase-1 total infeasibility when status = INFEASIBLE (exact, > 0) */
  readonly infeasibility: Frac | null;
}

/**
 * Dense tableau simplex over Frac with Bland's anti-cycling rule. Reduced
 * costs are recomputed from the basis each iteration (the LPs here are at
 * most ~40×45, so clarity beats caching); every arithmetic step is exact.
 */
export function exactSimplexMax(
  A: ReadonlyArray<readonly Frac[]>,
  b: readonly Frac[],
  c: readonly Frac[],
): ExactLPResult {
  const m = b.length;
  const n = c.length;
  if (A.length !== m || A.some((row) => row.length !== n)) {
    throw new NamedError(
      "polytope/lp-shape",
      `exactSimplexMax: A is ${A.length} rows vs b ${m}, c ${n}`,
    );
  }
  // working tableau: rows of length n+m (structural + artificials), rhs ≥ 0
  const T: Frac[][] = A.map((row, i) => {
    const neg = fCmp(b[i] as Frac, ZERO) < 0;
    const out = row.map((v) => (neg ? fNeg(v) : v));
    return [
      ...out,
      ...Array.from({ length: m }, (_, j) => (i === j ? ONE : ZERO)),
    ];
  });
  const rhs: Frac[] = b.map((v) => (fCmp(v, ZERO) < 0 ? fNeg(v) : v));
  const basis: number[] = Array.from({ length: m }, (_, j) => n + j);
  const total = n + m;

  const pivot = (row: number, col: number): void => {
    const p = T[row]![col] as Frac;
    for (let j = 0; j < total; j++) T[row]![j] = fDiv(T[row]![j] as Frac, p);
    rhs[row] = fDiv(rhs[row] as Frac, p);
    for (let i = 0; i < m; i++) {
      if (i === row) continue;
      const f = T[i]![col] as Frac;
      if (fIsZero(f)) continue;
      for (let j = 0; j < total; j++)
        T[i]![j] = fSub(T[i]![j] as Frac, fMul(f, T[row]![j] as Frac));
      rhs[i] = fSub(rhs[i] as Frac, fMul(f, rhs[row]));
    }
    basis[row] = col;
  };

  // one simplex phase on objective `cost`; entering columns restricted to
  // [0, enterLimit) — phase 2 must NEVER re-enter an artificial column.
  // Returns false on an unbounded improving ray.
  const runPhase = (cost: readonly Frac[], enterLimit: number): boolean => {
    for (;;) {
      let enter = -1;
      for (let j = 0; j < enterLimit; j++) {
        if (basis.includes(j)) continue;
        let rc = cost[j] as Frac;
        for (let i = 0; i < m; i++)
          rc = fSub(
            rc,
            fMul(cost[basis[i] as number] as Frac, T[i]![j] as Frac),
          );
        if (fCmp(rc, ZERO) > 0) {
          enter = j; // Bland: lowest-index improving column
          break;
        }
      }
      if (enter < 0) return true;
      let leave = -1;
      let best: Frac | undefined;
      for (let i = 0; i < m; i++) {
        const tij = T[i]![enter] as Frac;
        if (fCmp(tij, ZERO) <= 0) continue;
        const ratio = fDiv(rhs[i] as Frac, tij);
        const cmp = best === undefined ? -1 : fCmp(ratio, best);
        if (
          cmp < 0 ||
          (cmp === 0 && (basis[i] as number) < (basis[leave] as number))
        ) {
          best = ratio;
          leave = i;
        }
      }
      if (leave < 0) return false; // unbounded improving ray
      pivot(leave, enter);
    }
  };

  // Phase 1: maximize −Σ artificials (bounded by 0 by construction)
  const phase1Cost = Array.from({ length: total }, (_, j) =>
    j >= n ? frac(-1n) : ZERO,
  );
  if (!runPhase(phase1Cost, total)) {
    throw new NamedError(
      "polytope/lp-phase1-unbounded",
      "exactSimplexMax: phase-1 unbounded — an internal bug, the objective is bounded by 0",
    );
  }
  let phase1 = ZERO;
  for (let i = 0; i < m; i++) {
    if ((basis[i] as number) >= n) phase1 = fAdd(phase1, rhs[i] as Frac);
  }
  // phase1 = Σ basic-artificial values = total residual infeasibility;
  // the phase-1 optimum is −phase1 < 0 exactly when the system is infeasible
  if (fCmp(phase1, ZERO) > 0)
    return {
      status: "INFEASIBLE",
      value: null,
      x: null,
      infeasibility: phase1,
    };
  // drive artificials out of the basis where a structural column allows it
  for (let i = 0; i < m; i++) {
    if ((basis[i] as number) < n) continue;
    for (let j = 0; j < n; j++) {
      if (!basis.includes(j) && fCmp(T[i]![j] as Frac, ZERO) !== 0) {
        pivot(i, j);
        break;
      }
    }
  }
  // Phase 2 on the true objective; artificial columns never improve (cost 0)
  const phase2Cost = Array.from({ length: total }, (_, j) =>
    j < n ? (c[j] as Frac) : ZERO,
  );
  if (!runPhase(phase2Cost, n))
    return { status: "UNBOUNDED", value: null, x: null, infeasibility: null };
  const x: Frac[] = Array.from({ length: n }, () => ZERO);
  let value = ZERO;
  for (let i = 0; i < m; i++) {
    if ((basis[i] as number) < n) {
      x[basis[i] as number] = rhs[i] as Frac;
      value = fAdd(value, fMul(c[basis[i] as number] as Frac, rhs[i] as Frac));
    }
  }
  return { status: "OPTIMAL", value, x, infeasibility: null };
}

// ---------------------------------------------------------------------------
// the polytope: vertices, exact payoffs, extremal LPs with dual certificates
// ---------------------------------------------------------------------------

export type VertexName = "mixed" | "channelAB" | "channelBA";

export const VERTEX_ORDER: readonly VertexName[] = [
  "mixed",
  "channelAB",
  "channelBA",
];

export function vertexMatrix(name: VertexName): CMat {
  if (name === "mixed") return wMixed();
  if (name === "channelAB") return wChannelAB();
  return wChannelBA();
}

function requirePositiveWeightsF(c1: Frac, c2: Frac, fn: string): void {
  if (fCmp(c1, ZERO) <= 0 || fCmp(c2, ZERO) <= 0) {
    throw new NamedError(
      "polytope/nonpositive-weight",
      `${fn}: weights must be strictly positive fractions (the polytope face lives on the open positive quadrant)`,
    );
  }
}

/** cap(c1,c2) = max(c1 + c2/2, c1/2 + c2) — E13's piecewise cap, exact. */
export function exactCap(c1: Frac, c2: Frac): Frac {
  requirePositiveWeightsF(c1, c2, "exactCap");
  const lo = fAdd(c1, fMul(c2, HALF));
  const hi = fAdd(fMul(c1, HALF), c2);
  return fCmp(lo, hi) >= 0 ? lo : hi;
}

/** The vertex payoffs under weights (c1,c2): (c1+c2)/2, c1/2+c2, (c1+c2)/2 — exact. */
export function exactVertexPayoffs(
  c1: Frac,
  c2: Frac,
): Record<VertexName, Frac> {
  requirePositiveWeightsF(c1, c2, "exactVertexPayoffs");
  const chance = fMul(fAdd(c1, c2), HALF);
  return {
    mixed: chance,
    channelAB: fAdd(fMul(c1, HALF), c2),
    channelBA: chance,
  };
}

/** p_W*(c1,c2) = (c1+c2)(2+√2)/4 — the executed cos²(π/8) scaling, in ℚ(√2). */
export function exactWstarPayoff(c1: Frac, c2: Frac): Q2 {
  requirePositiveWeightsF(c1, c2, "exactWstarPayoff");
  return q2Mul(q2OfFrac(fMul(fAdd(c1, c2), frac(1n, 4n))), q2(frac(2n), ONE));
}

export interface ExtremalLP {
  readonly best: { readonly vertex: VertexName; readonly value: Frac };
  readonly worst: { readonly vertex: VertexName; readonly value: Frac };
  /** LP value − independent vertex scan, exactly 0 — the strong-duality witness */
  readonly bestDualGap: Frac;
  readonly worstDualGap: Frac;
}

/**
 * Extremize the payoff linear functional over C with the exact simplex:
 * max/min p·λ over {λ ≥ 0, Σλ = 1}. Each program's dual is the 1-row
 * certificate min/max over the vertex payoffs; strong duality is witnessed
 * by the gap being exactly zero in fraction arithmetic.
 */
export function polytopeExtremes(c1: Frac, c2: Frac): ExtremalLP {
  const p = exactVertexPayoffs(c1, c2);
  const c = VERTEX_ORDER.map((v) => p[v]);
  const A = [c.map(() => ONE)];
  const b = [ONE];
  const maxLP = exactSimplexMax(A, b, c);
  const minLP = exactSimplexMax(A, b, c.map(fNeg));
  if (
    maxLP.status !== "OPTIMAL" ||
    minLP.status !== "OPTIMAL" ||
    maxLP.value === null ||
    minLP.value === null
  ) {
    throw new NamedError(
      "polytope/lp-not-optimal",
      `polytopeExtremes: simplex returned ${maxLP.status}/${minLP.status} on a bounded simplex LP`,
    );
  }
  const arg = (
    pick: (a: Frac, b2: Frac) => boolean,
  ): { vertex: VertexName; value: Frac } => {
    let idx = 0;
    for (let i = 1; i < c.length; i++) {
      if (pick(c[i] as Frac, c[idx] as Frac)) idx = i;
    }
    return { vertex: VERTEX_ORDER[idx] as VertexName, value: c[idx] as Frac };
  };
  const bestScan = arg((a, b2) => fCmp(a, b2) > 0);
  const worstScan = arg((a, b2) => fCmp(a, b2) < 0);
  return {
    best: bestScan,
    worst: worstScan,
    bestDualGap: fSub(maxLP.value, bestScan.value),
    worstDualGap: fAdd(minLP.value, worstScan.value),
  };
}

/**
 * The per-direction critical W*-weight: β·W* + (1−β)·V violates the cap iff
 * β > β*, ties at β*, loses below. Refused by name outside E13's cone
 * (p_W* ≤ cap: no violation to protect).
 */
export function criticalWstarWeight(
  vertex: VertexName,
  c1: Frac,
  c2: Frac,
): Q2 {
  const p = exactVertexPayoffs(c1, c2);
  const cap = exactCap(c1, c2);
  const pW = exactWstarPayoff(c1, c2);
  const pV = q2OfFrac(p[vertex]);
  if (q2Sign(q2Sub(pW, q2OfFrac(cap))) <= 0) {
    throw new NamedError(
      "polytope/no-violation-to-protect",
      "criticalWstarWeight: p_W* ≤ cap at these weights — outside the silver-ratio cone there is no violation to protect",
    );
  }
  return q2Div(q2Sub(q2OfFrac(cap), pV), q2Sub(pW, pV));
}

/** The uniform-game anchors, exact in ℚ(√2): worst β* = 1/√2 = √2/2, best β* = 0, σ_guar = 1 − √2/2. */
export function uniformAnchors(): {
  readonly worstBeta: Q2;
  readonly bestBeta: Q2;
  readonly sigmaGuaranteed: Q2;
} {
  const worstBeta = q2(ZERO, HALF); // (1/2)√2 = 1/√2
  return {
    worstBeta,
    bestBeta: q2(ZERO, ZERO),
    sigmaGuaranteed: q2Sub(q2OfFrac(ONE), worstBeta),
  };
}

// ---------------------------------------------------------------------------
// exact hull membership (Phase-1 LP) — the smuggling trial's structural face
// ---------------------------------------------------------------------------

export interface MembershipVerdict {
  readonly inside: boolean;
  /** exact barycentric coordinates when inside */
  readonly lambda: readonly Frac[] | null;
  /** Phase-1 total infeasibility when outside: exact, > 0 */
  readonly infeasibility: Frac | null;
}

/**
 * Is the process w in the hull C? Every entry must reconstruct as a
 * small-denominator rational (the vertices are dyadic quarters; W* and its
 * blends carry 1/(4√2) and are refused BY NAME at that gate). The system
 * Σλᵢ·Vᵢ = w over the upper
 * triangle plus normalization is solved as a Phase-1 LP in exact fractions;
 * the returned λ is re-verified entrywise as the membership certificate.
 */
export function hullMembership(w: CMat, name = "process"): MembershipVerdict {
  if (w.dim !== 16) {
    throw new NamedError(
      "polytope/dim-not-16",
      `hullMembership: ${name} has dim ${w.dim} ≠ 16 (the polytope lives on 4 qubits)`,
    );
  }
  for (let i = 0; i < 16; i++) {
    for (let j = 0; j < 16; j++) {
      if (Math.abs(w.im[i]![j] as number) > 1e-12) {
        throw new NamedError(
          "polytope/complex-entry",
          `hullMembership: ${name} has a complex entry at (${i},${j}) — the hull is real-symmetric`,
        );
      }
      if (Math.abs((w.re[i]![j] as number) - (w.re[j]![i] as number)) > 1e-9) {
        throw new NamedError(
          "polytope/not-symmetric",
          `hullMembership: ${name} is not symmetric at (${i},${j})`,
        );
      }
    }
  }
  const grids = VERTEX_ORDER.map((v) =>
    vertexMatrix(v).re.map((row) => row.map((x) => fOfNumber(x))),
  );
  const target = w.re.map((row) => row.map((x) => fOfNumber(x)));
  const A: Frac[][] = [];
  const b: Frac[] = [];
  for (let i = 0; i < 16; i++) {
    for (let j = i; j < 16; j++) {
      const row = grids.map((g) => g[i]![j] as Frac);
      const flat = row.every((v) => fCmp(v, row[0] as Frac) === 0);
      if (flat && fCmp(target[i]![j] as Frac, row[0] as Frac) === 0) continue; // nothing to constrain
      A.push(row);
      b.push(target[i]![j] as Frac);
    }
  }
  A.push([ONE, ONE, ONE]);
  b.push(ONE);
  const lp = exactSimplexMax(A, b, [ZERO, ZERO, ZERO]);
  if (lp.status === "INFEASIBLE") {
    return { inside: false, lambda: null, infeasibility: lp.infeasibility };
  }
  if (lp.status !== "OPTIMAL" || lp.x === null) {
    throw new NamedError(
      "polytope/lp-not-optimal",
      `hullMembership: simplex returned ${lp.status}`,
    );
  }
  // the certificate: λ reproduces w entrywise in exact fractions
  let worst = ZERO;
  for (let i = 0; i < 16; i++) {
    for (let j = i; j < 16; j++) {
      let acc = ZERO;
      for (let k = 0; k < 3; k++)
        acc = fAdd(acc, fMul(lp.x[k] as Frac, grids[k]![i]![j] as Frac));
      const dev = fSub(acc, target[i]![j] as Frac);
      if (fCmp(fCmp(dev, ZERO) < 0 ? fNeg(dev) : dev, worst) > 0)
        worst = fCmp(dev, ZERO) < 0 ? fNeg(dev) : dev;
    }
  }
  if (!fIsZero(worst)) {
    return { inside: false, lambda: null, infeasibility: worst };
  }
  return { inside: true, lambda: lp.x, infeasibility: null };
}

/**
 * Membership adjudicator (the fake-causal smuggling trial): a process
 * claimed causal must pass validity AND the exact hull LP. Forbidden-pattern
 * processes are convicted by exact infeasibility; W* and noisy blends by the
 * named rationality gate; invalid processes by validity.
 */
export function adjudicateCausalClaim(
  w: CMat,
  name = "process",
): { accepted: boolean; problems: string[] } {
  const problems: string[] = [];
  const val = checkValidity(w);
  if (!val.valid)
    problems.push(`REJECT[invalid-process]: ${val.violations.join("; ")}`);
  try {
    const member = hullMembership(w, name);
    if (!member.inside) {
      const inf =
        member.infeasibility === null
          ? ""
          : ` (exact total infeasibility ${fToNumber(member.infeasibility).toExponential(3)})`;
      problems.push(
        `REJECT[polytope/not-in-hull]: ${name} is not a convex combination of the causal vertices${inf}`,
      );
    }
  } catch (err) {
    if (
      err instanceof NamedError &&
      (err.code === "polytope/irrational-entry" ||
        err.code === "polytope/complex-entry")
    ) {
      problems.push(
        `REJECT[${err.code}]: ${name} — ${err.message.split(" — ")[1] ?? "outside the hull's coordinate ring"}`,
      );
      return { accepted: problems.length === 0, problems };
    }
    throw err;
  }
  return { accepted: problems.length === 0, problems };
}

// ---------------------------------------------------------------------------
// the contamination adjudicator + the spectral divergence witness
// ---------------------------------------------------------------------------

export interface ContaminationVerdict {
  readonly accepted: boolean;
  readonly reasons: readonly string[];
  /** executed protocol payoff of every vertex-direction mixture at the claim */
  readonly executedPayoffs: readonly number[];
}

/**
 * Adjudicate a claim that "β·W* + (1−β)·V violates the causal cap 3/4 for
 * EVERY causal direction V ∈ C" at uniform weights: accepted only if every
 * executed mixture exceeds the cap; each failing direction is NAMed and
 * REJECTED (a claim beyond σ_guar = 1 − 1/√2 dies on the white-noise/BA
 * direction, whose executed mixture is already below the cap).
 */
export function adjudicateGuaranteedContamination(
  betaClaim: number,
): ContaminationVerdict {
  const cap = 0.75;
  const wS = wStar(Math.SQRT1_2);
  const own = runProtocol(wS).pSuccess;
  if (!(own > cap + 1e-12)) {
    return {
      accepted: false,
      reasons: [
        `REJECT[polytope/no-violation-to-protect]: W* itself does not violate at these weights (executed ${own.toExponential(3)} ≤ cap ${cap})`,
      ],
      executedPayoffs: [own],
    };
  }
  const executed: number[] = [];
  const reasons: string[] = [];
  for (const v of VERTEX_ORDER) {
    const mix = cmatAdd(
      cmatScale(wS, betaClaim),
      cmatScale(vertexMatrix(v), 1 - betaClaim),
    );
    const p = runProtocol(mix).pSuccess;
    executed.push(p);
    if (!(p > cap + 1e-12)) {
      reasons.push(
        `REJECT[polytope/claim-beyond-radius]: claimed guaranteed violation at β=${betaClaim}, but the ${v} direction's executed mixture scores ${p.toExponential(4)} ≤ cap ${cap} — the claim exceeds the guaranteed radius σ_guar = 1 − 1/√2`,
      );
    }
  }
  return { accepted: reasons.length === 0, reasons, executedPayoffs: executed };
}

/**
 * The certificate-divergence witness: W*'s exact {0, ½} spectrum (shared by
 * the channels — they are isospectral) spreads under contamination while the
 * payoff violation survives as long as β > β*(direction). Executed.
 */
export function contaminationSpectrum(
  beta: number,
  vertex: VertexName,
): {
  readonly mix: { min: number; max: number };
  readonly wstar: { min: number; max: number };
  readonly spectrumBroken: boolean;
  readonly mixValid: boolean;
} {
  const wS = wStar(Math.SQRT1_2);
  const mix = cmatAdd(
    cmatScale(wS, beta),
    cmatScale(vertexMatrix(vertex), 1 - beta),
  );
  const eMix = hermitianExtremeEig(mix);
  return {
    mix: eMix,
    wstar: hermitianExtremeEig(wS),
    spectrumBroken:
      Math.abs(eMix.min) > 1e-9 || Math.abs(eMix.max - 0.5) > 1e-9,
    mixValid: checkValidity(mix).valid,
  };
}
