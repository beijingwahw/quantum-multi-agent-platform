/**
 * The theta desk (v0.4.0) — the GHZ bank re-opened at an arbitrary coin
 * angle. |GHZ_theta> = (|000> + e^{i theta}|111>)/sqrt(2).
 *
 * The theorem on sale is a TRIPLE with one direction of flow: the bank's
 * every NUMERICAL face is theta-free (pairwise concurrences exactly 0, every
 * 1-vs-2 cut exactly 1/2, every branch probability exactly 1/2 — for every
 * theta, by a structure the machine can see: the bit-flip symmetry pairs the
 * phase-conjugate coherences and the reductions land on phase-free blocks),
 * while C's X-measurement plus 1 cbit withdraws |Phi_{+-theta}> — the angle
 * rides INTO THE COIN'S PHASE and nowhere else. The basis census prices the
 * neighboring claims: no measurement basis folds theta into any population
 * (the R18 draft expected Y to fold it — the machine refuted that: Y folds
 * its OWN basis phase into the coin as theta - pi/2, populations stay 1/2),
 * and the standard-coin withdrawal is basis-specific (equatorial bases only).
 */
import {
  type CMat,
  type CVec,
  identity,
  kron,
  mScale,
  outer,
  vAdd,
  vKron,
  vScale,
} from "../core/cmat.js";
import { applyKraus, partialTrace } from "../core/channels.js";
import { traceReal } from "../core/measures.js";
import { KET0, KET1, PLUS, MINUS, vecToRho } from "../core/states.js";
import { concurrence, eF, pureFidelity } from "./clearing.js";
import { ghzCutNegativities, ghzPairwiseConcurrences } from "./ghz.js";

/** Every kernel throw in this desk carries a named EC_ code (the house rule). */
function requireFiniteAngle(angle: number, what: string): void {
  if (!Number.isFinite(angle)) {
    throw new Error(
      `EC_THETA_NON_FINITE: ${what} must be finite, got ${angle}`,
    );
  }
}

/** Complex scalar times a ket: v * (cRe + i cIm) — the one piece of complex
 *  scalar arithmetic the cmat kernel does not carry (its vScale is real). */
function cScaleKet(v: CVec, cRe: number, cIm: number): CVec {
  const out = vScale(v, 0);
  for (let k = 0; k < v.n; k++) {
    out.re[k] = cRe * v.re[k]! - cIm * v.im[k]!;
    out.im[k] = cRe * v.im[k]! + cIm * v.re[k]!;
  }
  return out;
}

/** |GHZ_theta> = (|000> + e^{i theta}|111>)/sqrt(2) as an 8x8 density matrix. */
export function ghzThetaCoin(theta: number): CMat {
  requireFiniteAngle(theta, "ghzThetaCoin angle");
  const k000 = vKron(vKron(KET0, KET0), KET0);
  const k111 = vKron(vKron(KET1, KET1), KET1);
  const psi = vScale(
    vAdd(k000, cScaleKet(k111, Math.cos(theta), Math.sin(theta))),
    1 / Math.SQRT2,
  );
  return vecToRho(psi);
}

/** |Phi_{s,theta}> = (|00> + s e^{i theta}|11>)/sqrt(2) as a ket — the
 *  withdrawal's target coin, built independently of the bank. */
export function bellThetaKet(theta: number, s: 1 | -1): CVec {
  requireFiniteAngle(theta, "bellThetaKet angle");
  return vScale(
    vAdd(
      vKron(KET0, KET0),
      cScaleKet(vKron(KET1, KET1), s * Math.cos(theta), s * Math.sin(theta)),
    ),
    1 / Math.SQRT2,
  );
}

/** The same coin as a density matrix (for matrix-side comparisons). */
export function bellTheta(theta: number, s: 1 | -1): CMat {
  return vecToRho(bellThetaKet(theta, s));
}

/** The algebraic survey grid: theta = pi k / 12, k = 0..23 (the full turn). */
export const THETA_GRID: readonly number[] = Array.from(
  { length: 24 },
  (_, k) => (k * Math.PI) / 12,
);

/** The basis-tilt grid: beta = pi k / 24, k = 0..12 (Z to equator to Z-perp). */
export const BETA_GRID: readonly number[] = Array.from(
  { length: 13 },
  (_, k) => (k * Math.PI) / 24,
);

/** The basis-phase grid: the two named directions (X and Y). */
export const PHI_GRID: readonly number[] = [0, Math.PI / 2];

/** Embed a 2x2 projector on party C: I (x) I (x) P — Kronecker structure
 *  through the kernel, never through the fingers. */
function kronII(p: CMat): CMat {
  return kron(kron(identity(2), identity(2)), p);
}

/** The theta-freedom evidence for one angle: the bank's numerical faces. */
export interface ThetaFaces {
  readonly theta: number;
  readonly pairwise: readonly [number, number, number];
  readonly cuts: readonly [number, number, number];
  /** Branch probabilities of the X-withdrawal: exactly 1/2 each. */
  readonly pPlus: number;
  readonly pMinus: number;
  /** Computational-basis populations of the whole bank (8 diagonal cells). */
  readonly populations: readonly number[];
  /** True when the pairwise reduction's coherence cells are EXACTLY 0.0 —
   *  the bit-flip symmetry cancelling the phase at the bit level, not at a
   *  tolerance (the 2x2 block structure, machine-visible). */
  readonly abBlockExact: boolean;
}

/** The faces of the bank at one theta (the TH6 evidence carrier). */
export function thetaFaces(theta: number): ThetaFaces {
  const rho = ghzThetaCoin(theta);
  const ab = partialTrace(rho, [2, 2, 2], [2]);
  const wd = withdrawTheta(theta);
  const populations: number[] = [];
  for (let k = 0; k < 8; k++) populations.push(rho.re[k * 8 + k]!);
  return {
    theta,
    pairwise: ghzPairwiseConcurrences(rho),
    cuts: ghzCutNegativities(rho),
    pPlus: wd.pPlus,
    pMinus: wd.pMinus,
    populations,
    abBlockExact:
      ab.re[0 * 4 + 3] === 0 &&
      ab.im[0 * 4 + 3] === 0 &&
      ab.re[3 * 4 + 0] === 0 &&
      ab.im[3 * 4 + 0] === 0,
  };
}

export interface ThetaWithdrawal {
  readonly theta: number;
  /** Branch probabilities: exactly 1/2 each, at every theta. */
  readonly pPlus: number;
  readonly pMinus: number;
  /** The AB pair on each branch: exactly |Phi_{+-theta}>. */
  readonly abPlus: CMat;
  readonly abMinus: CMat;
  /** The JOINT post-measurement state on each branch (for the cut ledger). */
  readonly jointPlus: CMat;
  readonly jointMinus: CMat;
  /** The classical leg's cost: C announces her outcome. */
  readonly cbits: number;
  /** The coin's relative phase on each branch: theta and theta + pi. */
  readonly coinPhasePlus: number;
  readonly coinPhaseMinus: number;
}

/** The withdrawal through an arbitrary orthonormal C-basis {mPlus, mMinus};
 *  C measures, sends 1 cbit, and the angle lands in the coin's phase (the
 *  arg of the |00><11| cell) — in nothing else. */
function withdrawInBasis(
  theta: number,
  mPlus: CVec,
  mMinus: CVec,
): ThetaWithdrawal {
  const g = ghzThetaCoin(theta);
  const unPlus = applyKraus(g, [kronII(outer(mPlus, mPlus))]);
  const unMinus = applyKraus(g, [kronII(outer(mMinus, mMinus))]);
  const pPlus = traceReal(unPlus);
  const pMinus = traceReal(unMinus);
  const abPlus = mScale(partialTrace(unPlus, [2, 2, 2], [2]), 1 / pPlus);
  const abMinus = mScale(partialTrace(unMinus, [2, 2, 2], [2]), 1 / pMinus);
  // the coin's phase is the phase of the |11><00| coherence (rho[3,0] =
  // v[3] conj(v[0]) carries +theta; the [0,3] cell is its conjugate)
  const phase = (m: CMat): number =>
    Math.atan2(m.im[3 * 4 + 0]!, m.re[3 * 4 + 0]!);
  return {
    theta,
    pPlus,
    pMinus,
    abPlus,
    abMinus,
    jointPlus: mScale(unPlus, 1 / pPlus),
    jointMinus: mScale(unMinus, 1 / pMinus),
    cbits: 1,
    coinPhasePlus: phase(abPlus),
    coinPhaseMinus: phase(abMinus),
  };
}

/** The theta withdrawal: C measures X and sends 1 cbit. */
export function withdrawTheta(theta: number): ThetaWithdrawal {
  requireFiniteAngle(theta, "withdrawTheta angle");
  return withdrawInBasis(theta, PLUS, MINUS);
}

export interface BasisCensusRow {
  readonly beta: number;
  readonly phi: number;
  readonly pPlus: number;
  readonly pMinus: number;
  /** Branch concurrences, machine-measured by the general solver. */
  readonly cPlus: number;
  readonly cMinus: number;
  /** The exact linear route 2|rho_{00,11}| on each branch (pure pair). */
  readonly cellPlus: number;
  readonly cellMinus: number;
  /** The closed form |sin(2 beta)| both branches must equal. */
  readonly predictedC: number;
  /** The coin's phase on the plus branch, measured and predicted (theta - phi). */
  readonly phasePlus: number;
  readonly phasePredicted: number;
}

/** The C-measurement basis at tilt beta from Z, phase phi:
 *  |m+> = cos(beta)|0> + e^{i phi} sin(beta)|1>,
 *  |m-> = sin(beta)|0> - e^{i phi} cos(beta)|1>. */
export function basisKets(
  beta: number,
  phi: number,
): { mPlus: CVec; mMinus: CVec } {
  requireFiniteAngle(beta, "basisKets tilt");
  requireFiniteAngle(phi, "basisKets phase");
  const cb = Math.cos(beta);
  const sb = Math.sin(beta);
  const cp = Math.cos(phi);
  const sp = Math.sin(phi);
  const mPlus: CVec = {
    n: 2,
    re: Float64Array.from([cb, sb * cp]),
    im: Float64Array.from([0, sb * sp]),
  };
  const mMinus: CVec = {
    n: 2,
    re: Float64Array.from([sb, -cb * cp]),
    im: Float64Array.from([0, -cb * sp]),
  };
  return { mPlus, mMinus };
}

/** Wrap an angle into (-pi, pi]. */
function wrapAngle(a: number): number {
  let x = a % (2 * Math.PI);
  if (x > Math.PI) x -= 2 * Math.PI;
  if (x <= -Math.PI) x += 2 * Math.PI;
  return x;
}

/** The exact concurrence route for a PURE 2-qubit pair: C = 2|rho_{00,11}|.
 *  The Wootters solver is the general path but carries ~1e-8 on rank-deficient
 *  states (the eigenvector reconstruction's documented noise — batch 30's
 *  lesson), so every exactness claim in this desk runs the linear cell and
 *  keeps the solver as the cross-check. */
export function purePairCoherence(rho: CMat): number {
  if (rho.rows !== 4 || rho.cols !== 4) {
    throw new Error(
      `EC_SHAPE: purePairCoherence is defined on 2-qubit (4x4) pairs, got ${rho.rows}x${rho.cols}`,
    );
  }
  return 2 * Math.hypot(rho.re[0 * 4 + 3]!, rho.im[0 * 4 + 3]!);
}

/** The basis census: every (beta, phi) x theta row of the withdrawal ledger. */
export function basisCensus(
  theta: number,
  betas: readonly number[] = BETA_GRID,
  phis: readonly number[] = PHI_GRID,
): BasisCensusRow[] {
  const rows: BasisCensusRow[] = [];
  for (const beta of betas) {
    for (const phi of phis) {
      const { mPlus, mMinus } = basisKets(beta, phi);
      const wd = withdrawInBasis(theta, mPlus, mMinus);
      rows.push({
        beta,
        phi,
        pPlus: wd.pPlus,
        pMinus: wd.pMinus,
        cPlus: concurrence(wd.abPlus),
        cMinus: concurrence(wd.abMinus),
        cellPlus: purePairCoherence(wd.abPlus),
        cellMinus: purePairCoherence(wd.abMinus),
        predictedC: Math.abs(Math.sin(2 * beta)),
        phasePlus: wd.coinPhasePlus,
        phasePredicted: wrapAngle(theta - phi),
      });
    }
  }
  return rows;
}

/** The claims table — the checker recomputes every verdict from the machinery
 *  (the H8 discipline, extended to this desk's own rows without touching the
 *  audit face). */
export type ThetaClaimTag = "HOLDS" | "REFUTED" | "CENSUS";

export interface ThetaClaimRow {
  readonly id: string;
  readonly claim: string;
  readonly tag: ThetaClaimTag;
}

export const THETA_CLAIMS: readonly ThetaClaimRow[] = [
  {
    id: "TH1",
    claim:
      "all three pairwise concurrences are exactly 0 at every grid theta (the pair ledger stays empty)",
    tag: "HOLDS",
  },
  {
    id: "TH2",
    claim:
      "every 1-vs-2 cut carries exactly 1/2 negativity at every grid theta (the joint holding never moves)",
    tag: "HOLDS",
  },
  {
    id: "TH3",
    claim:
      "C measures X + 1 cbit: p = 1/2 each, AB receive exactly |Phi_{+-theta}> (fidelity 1, concurrence 1, E_F 1)",
    tag: "HOLDS",
  },
  {
    id: "TH4",
    claim:
      "the withdrawal conserves the A|BC and B|AC cuts exactly (1/2 -> 1/2) and drops AB|C exactly (1/2 -> 0), at every theta",
    tag: "HOLDS",
  },
  {
    id: "TH5",
    claim:
      "basis census: branch probabilities exactly 1/2 at EVERY tilt and phase; branch concurrence = |sin 2 beta|, theta-free; the coin's phase = theta - phi (X -> theta, Y -> theta - pi/2)",
    tag: "CENSUS",
  },
  {
    id: "TH6",
    claim:
      "the bank's angle can be read off a numerical face (a population, a branch probability, a concurrence, a cut) without consulting the coin's phase",
    tag: "REFUTED",
  },
  {
    id: "TH7",
    claim: "any C-measurement basis withdraws a standard coin (concurrence 1)",
    tag: "REFUTED",
  },
];

export interface ThetaViolation {
  readonly row: string;
  readonly law: "H8";
  readonly detail: string;
}

/** A ThetaClaimRow as it crosses the untrusted boundary into the checker: the
 *  compile-time tag union proves nothing at runtime (rows arrive parsed or
 *  mutated), so the tag is an unvalidated string until the vocabulary check
 *  has run — the audit face's UntrustedGhzClaimRow pattern, same desk. */
export type UntrustedThetaClaimRow = Omit<ThetaClaimRow, "tag"> & {
  readonly tag: string;
};

/** Recompute every claim's verdict. HOLDS must survive its sweep; REFUTED must
 *  have a recomputing counterexample; CENSUS must pass its own census. The
 *  linear faces carry the exactness (tol); the Wootters solver runs beside
 *  them at WOOT_TOL — the eigenvector path's documented ~1e-8 noise on
 *  rank-deficient pure states is a face of the solver, not of the coin. */
export const WOOT_TOL = 1e-7;

export function checkThetaClaims(
  rows: readonly UntrustedThetaClaimRow[] = THETA_CLAIMS,
  tol = 1e-12,
): ThetaViolation[] {
  const violations: ThetaViolation[] = [];
  for (const r of rows) {
    if (r.tag !== "HOLDS" && r.tag !== "REFUTED" && r.tag !== "CENSUS") {
      violations.push({
        row: r.id,
        law: "H8",
        detail: `illegal claim tag "${r.tag}" — the vocabulary is {HOLDS, REFUTED, CENSUS}`,
      });
      continue;
    }
    const v = thetaClaimOutcome(r.id, tol);
    if (r.tag === "HOLDS" && !v.holds) {
      violations.push({
        row: r.id,
        law: "H8",
        detail: `claimed HOLDS but the machine says otherwise (${v.detail})`,
      });
    }
    if (r.tag === "REFUTED" && !v.refuted) {
      violations.push({
        row: r.id,
        law: "H8",
        detail: `claimed REFUTED but no counterexample recomputes (${v.detail})`,
      });
    }
    if (r.tag === "CENSUS" && !v.holds) {
      violations.push({
        row: r.id,
        law: "H8",
        detail: `census claim fails its own census (${v.detail})`,
      });
    }
  }
  return violations;
}

function thetaClaimOutcome(
  id: string,
  tol: number,
): { holds: boolean; refuted: boolean; detail: string } {
  switch (id) {
    case "TH1": {
      let worst = 0;
      for (const theta of THETA_GRID)
        for (const c of ghzPairwiseConcurrences(ghzThetaCoin(theta)))
          worst = Math.max(worst, c);
      return {
        holds: worst <= tol,
        refuted: worst > tol,
        detail: `worst pairwise concurrence ${worst.toExponential(3)} over ${THETA_GRID.length} thetas`,
      };
    }
    case "TH2": {
      let worst = 0;
      for (const theta of THETA_GRID)
        for (const n of ghzCutNegativities(ghzThetaCoin(theta)))
          worst = Math.max(worst, Math.abs(n - 0.5));
      return {
        holds: worst <= tol,
        refuted: worst > tol,
        detail: `worst cut deviation ${worst.toExponential(3)} over ${THETA_GRID.length} thetas`,
      };
    }
    case "TH3": {
      let worstP = 0;
      let worstF = 0;
      let worstCell = 0;
      let worstWoot = 0;
      for (const theta of THETA_GRID) {
        const wd = withdrawTheta(theta);
        worstP = Math.max(
          worstP,
          Math.abs(wd.pPlus - 0.5),
          Math.abs(wd.pMinus - 0.5),
        );
        worstF = Math.max(
          worstF,
          1 - pureFidelity(wd.abPlus, bellThetaKet(theta, 1)),
          1 - pureFidelity(wd.abMinus, bellThetaKet(theta, -1)),
        );
        worstCell = Math.max(
          worstCell,
          Math.abs(purePairCoherence(wd.abPlus) - 1),
          Math.abs(purePairCoherence(wd.abMinus) - 1),
        );
        worstWoot = Math.max(
          worstWoot,
          Math.abs(concurrence(wd.abPlus) - 1),
          Math.abs(concurrence(wd.abMinus) - 1),
          Math.abs(eF(wd.abPlus) - 1),
          Math.abs(eF(wd.abMinus) - 1),
        );
      }
      const holds =
        Math.max(worstP, worstF, worstCell) <= tol && worstWoot <= WOOT_TOL;
      return {
        holds,
        refuted: !holds,
        detail: `worst linear-face deviation ${Math.max(worstP, worstF, worstCell).toExponential(3)}, worst solver-path deviation ${worstWoot.toExponential(3)} over ${THETA_GRID.length} thetas`,
      };
    }
    case "TH4": {
      let worst = 0;
      for (const theta of THETA_GRID) {
        const wd = withdrawTheta(theta);
        for (const joint of [wd.jointPlus, wd.jointMinus]) {
          const cuts = ghzCutNegativities(joint);
          worst = Math.max(
            worst,
            Math.abs(cuts[0] - 0),
            Math.abs(cuts[1] - 0.5),
            Math.abs(cuts[2] - 0.5),
          );
        }
      }
      return {
        holds: worst <= tol,
        refuted: worst > tol,
        detail: `worst cut-conservation deviation ${worst.toExponential(3)} over ${THETA_GRID.length} thetas`,
      };
    }
    case "TH5": {
      let worstP = 0;
      let worstCell = 0;
      let worstWoot = 0;
      let worstPhase = 0;
      for (const theta of THETA_GRID) {
        for (const row of basisCensus(theta)) {
          worstP = Math.max(
            worstP,
            Math.abs(row.pPlus - 0.5),
            Math.abs(row.pMinus - 0.5),
          );
          worstCell = Math.max(
            worstCell,
            Math.abs(row.cellPlus - row.predictedC),
            Math.abs(row.cellMinus - row.predictedC),
          );
          worstWoot = Math.max(
            worstWoot,
            Math.abs(row.cPlus - row.predictedC),
            Math.abs(row.cMinus - row.predictedC),
          );
          // the coin's phase is undefined on the degenerate endpoints (tilt 0
          // or pi/2: the |00><11| cell is exactly zero) — skipped, not swept
          if (row.predictedC > 1e-12) {
            worstPhase = Math.max(
              worstPhase,
              Math.abs(wrapAngle(row.phasePlus - row.phasePredicted)),
            );
          }
        }
      }
      const holds =
        worstP <= tol &&
        worstCell <= tol &&
        worstWoot <= WOOT_TOL &&
        worstPhase <= 1e-9;
      return {
        holds,
        refuted: !(worstP <= tol && worstCell <= tol),
        detail: `worst (probability, linear-coherence) deviation ${Math.max(worstP, worstCell).toExponential(3)}, worst solver-path deviation ${worstWoot.toExponential(3)}, worst phase deviation ${worstPhase.toExponential(3)} over ${THETA_GRID.length} x ${BETA_GRID.length * PHI_GRID.length} census rows (degenerate tilts phase-skipped)`,
      };
    }
    case "TH6": {
      // the claim says SOME face reads theta; the counterexample is that ALL
      // faces reproduce their theta = 0 values across the whole grid
      const base = thetaFaces(0);
      const dev = (a: readonly number[], b: readonly number[]): number =>
        Math.max(...a.map((x, i) => Math.abs(x - b[i]!)));
      let worst = 0;
      for (const theta of THETA_GRID) {
        const f = thetaFaces(theta);
        worst = Math.max(
          worst,
          dev(f.pairwise, base.pairwise),
          dev(f.cuts, base.cuts),
          Math.abs(f.pPlus - base.pPlus),
          Math.abs(f.pMinus - base.pMinus),
          dev(f.populations, base.populations),
        );
      }
      return {
        holds: worst > tol,
        refuted: worst <= tol,
        detail: `every numerical face reproduces its theta=0 value (worst deviation ${worst.toExponential(3)}) — no face reads theta`,
      };
    }
    case "TH7": {
      // counterexample: a non-equatorial tilt withdraws C = sin(2 beta) < 1
      const beta = Math.PI / 12;
      const kets = basisKets(beta, 0);
      const wd = withdrawInBasis(Math.PI / 5, kets.mPlus, kets.mMinus);
      const cell = purePairCoherence(wd.abPlus);
      const predicted = Math.sin(2 * beta);
      return {
        holds: Math.abs(cell - 1) <= tol,
        refuted: cell < 1 - 10 * tol && Math.abs(cell - predicted) <= tol,
        detail: `tilt beta = pi/12 withdraws concurrence ${cell.toFixed(12)} (closed form ${predicted.toFixed(12)}), not a standard coin`,
      };
    }
    default:
      throw new Error(
        `EC_THETA_CLAIM: unknown theta claim id "${id}" — the table has TH1..TH7`,
      );
  }
}
