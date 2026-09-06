/**
 * The honest wall, made executable: entanglement gives HIDING and late
 * choice, never BINDING.
 *
 * Core lemma (Hughston-Jozsa-Wootters 1993, "steering"), machine-verified
 * here: the verifier V holds one qubit of |Φ+>; its marginal is I/2 —
 * independent of anything. The committer C holds the purification and, at
 * any later time, CHOOSES the measurement basis {Z, X, Y}: each choice
 * makes V's collapse realize a different ensemble decomposition of the
 * very same I/2 (|0/1>, |+/−>, |R/L>, each with probability ½). The
 * decomposition V will end up in is therefore NOT fixed at commit time.
 *
 * This steering freedom is the engine of the Mayers-Lo-Chau no-go theorem
 * (Mayers, PRL 78, 3414 (1997); Lo & Chau, PRL 78, 3410 (1997)): no quantum
 * protocol is simultaneously concealing and binding — cited as theorems,
 * not re-proved here. We also run the textbook attack on a naive
 * "commit = send |ψ_b> ∈ {|0>,|+>}" protocol: the EPR cheater passes each
 * reveal check with probability exactly ½ while being perfectly concealed,
 * and (for calibration) a classical equiangular cheat already reaches ¾ —
 * the naive protocol is broken from both sides; the lesson for the auction
 * stack: quantum = privacy + detection; binding = classical escrow
 * signature after readout.
 */

import { type CMat, type CVec, basisVec, mDagger, mMul, mat, vAdd, vNormalize } from '../core/cmat.js';
import { fidelity, traceDistance } from '../core/measures.js';
import { partialTrace } from '../core/channels.js';
import { fromVec } from '../core/states.js';

const PSI_Z0 = { n: 2, re: Float64Array.of(1, 0), im: new Float64Array(2) };
const PSI_Z1 = { n: 2, re: Float64Array.of(0, 1), im: new Float64Array(2) };
const PSI_X0 = { n: 2, re: Float64Array.of(Math.SQRT1_2, Math.SQRT1_2), im: new Float64Array(2) };
const PSI_X1 = { n: 2, re: Float64Array.of(Math.SQRT1_2, -Math.SQRT1_2), im: new Float64Array(2) };
const PSI_Y0 = { n: 2, re: Float64Array.of(Math.SQRT1_2, 0), im: Float64Array.of(0, Math.SQRT1_2) };
const PSI_Y1 = { n: 2, re: Float64Array.of(Math.SQRT1_2, 0), im: Float64Array.of(0, -Math.SQRT1_2) };

const I2 = (() => {
  const m = mat(2, 2);
  m.re[0] = 0.5;
  m.re[3] = 0.5;
  return m;
})();

function projectorOnSys1(v: CVec): CMat {
  const V = fromVec(v);
  const ident = mat(2, 2);
  ident.re[0] = 1;
  ident.re[3] = 1;
  const p = mat(4, 4);
  // (I ⊗ |v><v|): |v> acts on qubit 1
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      for (let a = 0; a < 2; a++) {
        for (let b = 0; b < 2; b++) {
          const left = i === j ? 1 : 0;
          const right = V.re[a * 2 + b]!;
          p.re[(i * 2 + a) * 4 + (j * 2 + b)] = p.re[(i * 2 + a) * 4 + (j * 2 + b)]! + left * right;
          p.im[(i * 2 + a) * 4 + (j * 2 + b)] = p.im[(i * 2 + a) * 4 + (j * 2 + b)]! + left * V.im[a * 2 + b]!;
        }
      }
    }
  }
  return p;
}

export interface SteeringRow {
  basis: 'Z' | 'X' | 'Y';
  /** probability of each decomposition member */
  probs: [number, number];
  /** fidelity of V's conditional state with each target member */
  fidelities: [number, number];
}

export interface SteeringReport {
  /** V's marginal vs I/2 during the entire commit phase */
  hidingTraceDistance: number;
  rows: SteeringRow[];
}

/** The HJW steering table: same |Φ+>, three measurement choices, three
 * different ensemble decompositions of the same I/2 on V. */
export function steeringDemonstration(): SteeringReport {
  const phiPlus = fromVec(vNormalize(vAdd(basisVec(4, 0), basisVec(4, 3))));
  const vMarginal = partialTrace(phiPlus, [2, 2], [1]);
  const rows: SteeringRow[] = [];
  const families: Array<{ basis: 'Z' | 'X' | 'Y'; pair: [CVec, CVec] }> = [
    { basis: 'Z', pair: [PSI_Z0, PSI_Z1] },
    { basis: 'X', pair: [PSI_X0, PSI_X1] },
    { basis: 'Y', pair: [PSI_Y0, PSI_Y1] },
  ];
  for (const { basis, pair } of families) {
    const probs: [number, number] = [0, 0];
    const fids: [number, number] = [0, 0];
    pair.forEach((psi, which) => {
      const P = projectorOnSys1(psi);
      const proj = mMul(mMul(P, phiPlus), mDagger(P));
      // proj is 4x4: diagonal entries 0,5,10,15 are defined
      const p = proj.re[0]! + proj.re[5]! + proj.re[10]! + proj.re[15]!;
      const conditional = { rows: 4, cols: 4, re: proj.re.map((x) => x / p), im: proj.im.map((x) => x / p) } as CMat;
      const vQubit = partialTrace(conditional, [2, 2], [1]);
      probs[which] = p;
      // steering of |Φ+>: measuring C in basis {v} leaves V in conj(v)
      fids[which] = fidelity(vQubit, fromVec(conjVec(psi)));
    });
    rows.push({ basis, probs, fidelities: fids });
  }
  return { hidingTraceDistance: traceDistance(vMarginal, I2), rows };
}

function conjVec(v: CVec): CVec {
  return { n: v.n, re: v.re.slice(), im: v.im.map((x) => -x) };
}

export interface NaiveCommitAttack {
  /** P(verifier passes | EPR cheater reveals bit b) — exactly ½ each */
  eprPass: [number, number];
  /** conditional fidelity of V's qubit with ψ_b given steering outcome ψ_b */
  conditionalFidelity: [number, number];
  /** classical equiangular cheat reference: (1+|<0|+>|)/2 = 3/4 */
  equiangularPassRate: number;
  /** concealment of the EPR cheater: V's marginal is exactly I/2 */
  concealed: number;
}

/** Textbook attack on "commit by sending |ψ_b> ∈ {|0>, |+>}". */
export function naiveCommitAttack(): NaiveCommitAttack {
  const run = (b: 0 | 1): { p: number; f: number } => {
    const psiB = b === 0 ? PSI_Z0 : PSI_X0;
    const phiPlus = fromVec(vNormalize(vAdd(basisVec(4, 0), basisVec(4, 3))));
    const P = projectorOnSys1(psiB);
    const proj = mMul(mMul(P, phiPlus), mDagger(P));
    const p = proj.re[0]! + proj.re[5]! + proj.re[10]! + proj.re[15]!;
    const conditional = { rows: 4, cols: 4, re: proj.re.map((x) => x / p), im: proj.im.map((x) => x / p) } as CMat;
    const vQubit = partialTrace(conditional, [2, 2], [1]);
    return { p, f: fidelity(vQubit, fromVec(psiB)) };
  };
  const r0 = run(0);
  const r1 = run(1);
  const phiPlus = fromVec(vNormalize(vAdd(basisVec(4, 0), basisVec(4, 3))));
  const vMarginal = partialTrace(phiPlus, [2, 2], [1]);
  const overlap = Math.abs(PSI_Z0.re[0]! * PSI_X0.re[0]! + PSI_Z0.re[1]! * PSI_X0.re[1]!);
  return {
    eprPass: [r0.p, r1.p],
    conditionalFidelity: [r0.f, r1.f],
    equiangularPassRate: (1 + overlap) / 2,
    concealed: traceDistance(vMarginal, I2),
  };
}
