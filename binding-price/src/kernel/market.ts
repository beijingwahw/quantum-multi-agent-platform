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
import { type CMat, mat, mMul, mTrace } from "../core/cmat.js";
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

/** Bloch vector of a 2x2 density matrix. */
export function blochOf(rho: CMat): [number, number, number] {
  const x = 2 * rho.re[2]!;
  const y = -2 * rho.im[2]!;
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
