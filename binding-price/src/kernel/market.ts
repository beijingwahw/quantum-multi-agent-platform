/**
 * The market machinery — #13's goods, prices, and the flat supply.
 *
 * The setup: a commitment protocol's reveal — the promisor announces a pure
 * state |a> (basis member), the verifier measures own register in that basis.
 * The pass probability is Tr[|a><a| rho_V] = (1 + a.r)/2 with r the Bloch
 * vector of the verifier's marginal. Binding slack (pass - 1/2) is therefore
 * HALF THE POLARIZATION of the very marginal whose vanishing concealment
 * demands: privacy bought = binding dead, as an equation, not a trade-off
 * curve. The promisor's HJW freedom (choice of decomposition of I/2) cannot
 * move r at any price — the flat supply.
 */
import { type CMat, identity, kron, mat, mDagger, mMul, mTrace } from "../core/cmat.js";
import { applyNoise, type NoiseName } from "../core/channels.js";
import { traceDistance } from "../core/measures.js";

export const HALF_MIXED: CMat = (() => {
  const m = mat(2, 2);
  m.re[0] = 0.5;
  m.re[3] = 0.5;
  return m;
})();

/** Density matrix from a Bloch vector. */
export function blochState(r: readonly [number, number, number]): CMat {
  const m = mat(2, 2);
  m.re[0] = (1 + r[2]) / 2;
  m.re[1] = (r[0]) / 2;
  m.re[2] = (r[0]) / 2;
  m.re[3] = (1 - r[2]) / 2;
  m.im[1] = -r[1] / 2;
  m.im[2] = r[1] / 2;
  return m;
}

/** Bloch vector of a 2x2 density matrix.
 *  v0.2.0 sign fix: y is +2*im[1][0] (the [0][1] element carries -y/2). The
 *  v0.1.0 form returned -y — masked until now because every caller dotted TWO
 *  blochOf outputs and the double flip cancelled; the noise census mixes a raw
 *  direction tuple with one blochOf and exposed it. */
export function blochOf(rho: CMat): [number, number, number] {
  const x = 2 * rho.re[2]!;
  const y = 2 * rho.im[2]!;
  const z = rho.re[0]! - rho.re[3]!;
  return [x, y, z];
}

/** Pure-state density |a><a| from a unit Bloch direction. */
export function pureState(a: readonly [number, number, number]): CMat {
  return blochState(a);
}

/** The verifier's two-outcome measurement in the basis containing |a>: probability of |a>.
 * Tr[|a><a| rho] via the kernel's matrix product — hand-expanded element
 * arithmetic here had a real-part sign slip in the complex quadrant (batch 10's
 * lesson: closed forms go through the kernel, not through the fingers). */
export function passProbability(announced: CMat, rhoV: CMat): number {
  return mTrace(mMul(announced, rhoV)).re;
}

export interface EnsembleMember {
  readonly weight: number;
  readonly state: CMat;
}

/** The verifier's marginal under a promisor strategy: sum w_i rho_i. */
export function marginal(members: readonly EnsembleMember[]): CMat {
  const out = mat(2, 2);
  for (const m of members) {
    for (let k = 0; k < 4; k++) {
      out.re[k] = out.re[k]! + m.weight * m.state.re[k]!;
      out.im[k] = out.im[k]! + m.weight * m.state.im[k]!;
    }
  }
  return out;
}

/** Worst-case (max over members) and average reveal pass under a strategy. */
export function revealStats(members: readonly EnsembleMember[], rhoV: CMat): { worst: number; average: number } {
  let worst = 0;
  let avg = 0;
  for (const m of members) {
    const p = passProbability(m.state, rhoV);
    worst = Math.max(worst, p);
    avg += m.weight * p;
  }
  return { worst, average: avg };
}

/** TV distance of a marginal from the maximally mixed state — concealment loss. */
export function concealmentLoss(rhoV: CMat): number {
  return traceDistance(rhoV, HALF_MIXED);
}

/** Promisor strategy families: decompositions of I/2 (the HJW freedom). */
export function strategyFamilies(): Array<{ name: string; members: readonly EnsembleMember[] }> {
  const out: Array<{ name: string; members: readonly EnsembleMember[] }> = [];
  // random orthonormal bases swept on a grid
  for (let t = 0; t < 6; t++) {
    const theta = (t / 6) * Math.PI;
    for (let p = 0; p < 4; p++) {
      const phi = (p / 4) * 2 * Math.PI;
      const s = Math.sin(theta);
      const a: [number, number, number] = [s * Math.cos(phi), s * Math.sin(phi), Math.cos(theta)];
      const neg: [number, number, number] = [-a[0], -a[1], -a[2]];
      out.push({ name: `basis(theta=${theta.toFixed(2)},phi=${phi.toFixed(2)})`, members: [{ weight: 0.5, state: pureState(a) }, { weight: 0.5, state: pureState(neg) }] });
    }
  }
  // tetrahedral decomposition: equal weights 1/4
  const invSqrt3 = 1 / Math.sqrt(3);
  const tetra: ReadonlyArray<[number, number, number]> = [
    [invSqrt3, invSqrt3, invSqrt3],
    [invSqrt3, -invSqrt3, -invSqrt3],
    [-invSqrt3, invSqrt3, -invSqrt3],
    [-invSqrt3, -invSqrt3, invSqrt3],
  ];
  out.push({ name: "tetrahedral", members: tetra.map((a) => ({ weight: 0.25, state: pureState(a) })) });
  // mixed-member decomposition: {1/2: I/2 itself, 1/4: |0>, 1/4: |1>}
  out.push({
    name: "mixed-members",
    members: [
      { weight: 0.5, state: blochState([0, 0, 0]) },
      { weight: 0.25, state: pureState([0, 0, 1]) },
      { weight: 0.25, state: pureState([0, 0, -1]) },
    ],
  });
  return out;
}

// ---------------------------------------------------------------------------
// v0.2.0 — the supply beyond enumeration: structured CONTINUOUS families of
// HJW ensembles, swept on deterministic grids so the census is exhaustive
// over the parameterized family (the family stated precisely, not sampled
// anonymously).
// ---------------------------------------------------------------------------

const GOLDEN_ANGLE = 2.399963229728653;

/** Equal-area Fibonacci point i of n on the unit sphere. */
function fibSphere(i: number, n: number, offset = 0): [number, number, number] {
  const z = 1 - (2 * (i + 0.5)) / n;
  const s = Math.sqrt(Math.max(0, 1 - z * z));
  const phi = (i + offset) * GOLDEN_ANGLE;
  return [s * Math.cos(phi), s * Math.sin(phi), z];
}

/** Unit vector orthogonal to u (deterministic choice). */
function orthoTo(u: readonly [number, number, number]): [number, number, number] {
  const seed: [number, number, number] = Math.abs(u[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const dot = u[0] * seed[0] + u[1] * seed[1] + u[2] * seed[2];
  const v: [number, number, number] = [seed[0] - dot * u[0], seed[1] - dot * u[1], seed[2] - dot * u[2]];
  const n = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / n, v[1] / n, v[2] / n];
}

/** Geodesic from u toward -u: g(alpha) = cos(alpha) u + sin(alpha) u_perp. */
function geodesic(u: readonly [number, number, number], alpha: number): [number, number, number] {
  const p = orthoTo(u);
  return [
    Math.cos(alpha) * u[0] + Math.sin(alpha) * p[0],
    Math.cos(alpha) * u[1] + Math.sin(alpha) * p[1],
    Math.cos(alpha) * u[2] + Math.sin(alpha) * p[2],
  ];
}

export const CONTINUOUS_GRID = {
  /** antipodal-pair products: u-grid size */
  uPoints: 61,
  /** antipodal-pair products: v-grid size (offset Fibonacci lattice) */
  vPoints: 25,
  /** geodesic interpolations between extremal decompositions */
  geodesicPoints: 91,
  /** convex refinements: weight grid for w in [0,1] */
  wPoints: 21,
  /** convex refinements: direction grid for the pure pair */
  aPoints: 25,
} as const;

/**
 * The structured continuous strategy families (v0.2.0):
 *
 *  F1 "pairs" — antipodal-pair products {1/4 ±u, 1/4 ±v}: EVERY equal-weight
 *     union of two antipodal pairs decomposes I/2 identically (the member
 *     Bloch vectors cancel pairwise), a 4-parameter family swept on
 *     Fibonacci grids. Parameter points include the degenerate basis pair
 *     (v = ±u) and the great square (u ⊥ v), with every relative tilt
 *     between the pairs covered by the grid. (The regular tetrahedron is
 *     NOT of this form — its six pairwise dots are all -1/3, while a pair
 *     family realizes dots {±u·v} — it stays in W-B's enumerated families.)
 *  F2 "geodesic" — {1/4 ±u0, 1/4 ±v(alpha)} with v(alpha) sweeping the full
 *     geodesic from +u0 to -u0: one continuous parameter interpolating the
 *     family's extremal points (collapsed pair -> square -> collapsed pair),
 *     u0 = (1,1,1)/sqrt(3).
 *  F3 "refine" — convex refinements {w I/2, (1-w)/2 |a>, (1-w)/2 |-a>}: the
 *     mixed-member ensemble of v0.1.0 generalized to a two-parameter family
 *     (any decomposition refinable through the mixed state stays a
 *     decomposition — the convex-hull face of the HJW freedom).
 */
export function continuousStrategies(): Array<{ name: string; members: readonly EnsembleMember[] }> {
  const out: Array<{ name: string; members: readonly EnsembleMember[] }> = [];
  // F1: antipodal-pair products on Fibonacci grids
  for (let i = 0; i < CONTINUOUS_GRID.uPoints; i++) {
    const u = fibSphere(i, CONTINUOUS_GRID.uPoints);
    for (let j = 0; j < CONTINUOUS_GRID.vPoints; j++) {
      const v = fibSphere(j, CONTINUOUS_GRID.vPoints, 0.5);
      out.push({
        name: `pairs(u=${i},v=${j})`,
        members: [
          { weight: 0.25, state: pureState(u) },
          { weight: 0.25, state: pureState([-u[0], -u[1], -u[2]]) },
          { weight: 0.25, state: pureState(v) },
          { weight: 0.25, state: pureState([-v[0], -v[1], -v[2]]) },
        ],
      });
    }
  }
  // F2: geodesic interpolation between extremal decompositions
  const invSqrt3 = 1 / Math.sqrt(3);
  const u0: [number, number, number] = [invSqrt3, invSqrt3, invSqrt3];
  for (let k = 0; k < CONTINUOUS_GRID.geodesicPoints; k++) {
    const alpha = (k / (CONTINUOUS_GRID.geodesicPoints - 1)) * Math.PI;
    const v = geodesic(u0, alpha);
    out.push({
      name: `geodesic(alpha=${alpha.toFixed(3)})`,
      members: [
        { weight: 0.25, state: pureState(u0) },
        { weight: 0.25, state: pureState([-u0[0], -u0[1], -u0[2]]) },
        { weight: 0.25, state: pureState(v) },
        { weight: 0.25, state: pureState([-v[0], -v[1], -v[2]]) },
      ],
    });
  }
  // F3: convex refinements
  for (let w = 0; w < CONTINUOUS_GRID.wPoints; w++) {
    const weight = w / (CONTINUOUS_GRID.wPoints - 1);
    for (let j = 0; j < CONTINUOUS_GRID.aPoints; j++) {
      const a = fibSphere(j, CONTINUOUS_GRID.aPoints);
      out.push({
        name: `refine(w=${weight.toFixed(2)},a=${j})`,
        members: [
          { weight, state: blochState([0, 0, 0]) },
          { weight: (1 - weight) / 2, state: pureState(a) },
          { weight: (1 - weight) / 2, state: pureState([-a[0], -a[1], -a[2]]) },
        ],
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// v0.2.0 — the two-coin market (bounded census): joint 2-qubit promisor
// strategies, per-coin marginals, and the joint product-announce reveal.
// ---------------------------------------------------------------------------

export interface TwoCoinStrategy {
  readonly name: string;
  /** ensemble members on the 2-qubit (4x4) joint register */
  readonly members: readonly JointMember[];
  /** true when the ensemble average is exactly I/4 (a decomposition of I/4) */
  readonly jointFlat: boolean;
}

export interface JointMember {
  readonly weight: number;
  /** 4x4 density matrix */
  readonly state: CMat;
}

/** Bell states |Φ+>, |Φ->, |Ψ+>, |Ψ-> as 4x4 density matrices. */
export function bellStates(): CMat[] {
  const out: CMat[] = [];
  const mk = (a: number, b: number, sign: number): CMat => {
    // |psi> = (|a,b> + sign |1-a,1-b>)/sqrt(2)
    const v = mat(4, 1);
    v.re[a * 2 + b] = Math.SQRT1_2;
    v.re[(1 - a) * 2 + (1 - b)] = sign * Math.SQRT1_2;
    return mMul(v, mDagger(v));
  };
  out.push(mk(0, 0, 1), mk(0, 0, -1), mk(0, 1, 1), mk(0, 1, -1));
  return out;
}

function rotY4(theta: number): CMat {
  const c = Math.cos(theta / 2);
  const s = Math.sin(theta / 2);
  const m = mat(2, 2);
  m.re[0] = c;
  m.re[1] = -s;
  m.re[2] = s;
  m.re[3] = c;
  return m;
}

/**
 * The bounded two-coin strategy census:
 *  C1 "prod" — product decompositions {1/4 (±u ⊗ ±v)}: both coins commit
 *      one-coin strategies; average joint state I/2 ⊗ I/2 = I/4.
 *  C2 "bell" — the four-Bell equal ensemble (the entangled decomposition of
 *      I/4); every member's per-coin marginal is I/2.
 *  C3 "rotbell" — locally rotated Bell ensembles (U ⊗ V applied to every
 *      member): maximally entangled bases stay maximally entangled, so the
 *      average stays I/4 and per-coin marginals stay I/2.
 *  C4 "schmidt" — two-member Schmidt interpolations {1/2 ψ(t), 1/2 ψ'(t)}
 *      with ψ(t) = cos t |00> + sin t |11> and ψ'(t) = cos t |11> + sin t |00>:
 *      per-coin marginals are I/2 at EVERY t while the joint average is
 *      diag-classical — the family that separates per-coin flatness from
 *      joint flatness (the census's found boundary).
 */
export function twoCoinStrategies(): TwoCoinStrategy[] {
  const out: TwoCoinStrategy[] = [];
  // C1: product decompositions
  const dirs: ReadonlyArray<[number, number, number]> = [
    [0, 0, 1],
    [Math.SQRT1_2, 0, Math.SQRT1_2],
    [Math.SQRT1_2, 0, -Math.SQRT1_2],
    [0, Math.SQRT1_2, Math.SQRT1_2],
  ];
  for (const u of dirs) {
    for (const v of dirs) {
      const members: JointMember[] = [];
      for (const su of [1, -1] as const) {
        for (const sv of [1, -1] as const) {
          members.push({
            weight: 0.25,
            state: kron(pureState([su * u[0], su * u[1], su * u[2]]), pureState([sv * v[0], sv * v[1], sv * v[2]])),
          });
        }
      }
      out.push({ name: `prod(u=(${u.map((x) => x.toFixed(2)).join(",")}),v=(${v.map((x) => x.toFixed(2)).join(",")}))`, members, jointFlat: true });
    }
  }
  // C2: the Bell ensemble
  out.push({
    name: "bell(ensemble)",
    members: bellStates().map((b) => ({ weight: 0.25, state: b })),
    jointFlat: true,
  });
  // C3: locally rotated Bell ensembles
  const angles = [0, Math.PI / 6, Math.PI / 3, Math.PI / 2, (2 * Math.PI) / 3];
  for (const alpha of angles) {
    for (const beta of angles) {
      const UV = kron(rotY4(alpha), rotY4(beta));
      out.push({
        name: `rotbell(a=${alpha.toFixed(2)},b=${beta.toFixed(2)})`,
        members: bellStates().map((b) => ({ weight: 0.25, state: mMul(mMul(UV, b), mDagger(UV)) })),
        jointFlat: true,
      });
    }
  }
  // C4: Schmidt interpolations — psi(t) = cos t |00> + sin t |11> against its
  // swap-flip psi'(t) = sin t |00> + cos t |11>: the per-coin marginals are
  // I/2 at EVERY t while the joint average is diag-classical
  const T = 21;
  for (let k = 0; k < T; k++) {
    const t = (k / (T - 1)) * (Math.PI / 2);
    const ct = Math.cos(t);
    const st = Math.sin(t);
    const psi = mat(4, 1);
    psi.re[0] = ct;
    psi.re[3] = st;
    const psiP = mat(4, 1);
    psiP.re[0] = st;
    psiP.re[3] = ct;
    out.push({
      name: `schmidt(t=${t.toFixed(3)})`,
      members: [
        { weight: 0.5, state: mMul(psi, mDagger(psi)) },
        { weight: 0.5, state: mMul(psiP, mDagger(psiP)) },
      ],
      jointFlat: false,
    });
  }
  return out;
}

/** Ensemble average of joint members: sum w rho. */
export function jointAverage(members: readonly JointMember[]): CMat {
  const out = mat(4, 4);
  for (const m of members) {
    for (let k = 0; k < 16; k++) {
      out.re[k] = out.re[k]! + m.weight * m.state.re[k]!;
      out.im[k] = out.im[k]! + m.weight * m.state.im[k]!;
    }
  }
  return out;
}

/** Per-coin reveal: |a> announced on `coin`, that coin measured — P(pass). */
export function coinReveal(joint: CMat, coin: 0 | 1, announced: CMat): number {
  const proj = coin === 0 ? kron(announced, identity(2)) : kron(identity(2), announced);
  return mTrace(mMul(proj, joint)).re;
}

/** Joint product reveal: |a>⊗|b> announced, both coins measured — P(pass). */
export function jointProductReveal(joint: CMat, a: CMat, b: CMat): number {
  return mTrace(mMul(kron(a, b), joint)).re;
}

/** Reveal stats after the commit channel acts on the verifier's marginal —
 *  E_γ(Σ w ρ) = Σ w E_γ(ρ) by CPTP linearity, so the channel composes with
 *  the promisor's decomposition choice instead of interfering with it. */
export function noisyRevealStats(
  members: readonly EnsembleMember[],
  noise: NoiseName,
  gamma: number,
): { worst: number; average: number } {
  return revealStats(members, applyNoise(marginal(members), noise, gamma));
}
