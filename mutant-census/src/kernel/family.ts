/**
 * THE FAMILY UNDER TEST — the workspace's shared kernel (src/core, byte-copied
 * from the stable-world lineage) plus the standard compositions every repo
 * builds on it, assembled behind one interface so the battery can be pointed
 * at the CANONICAL implementation or at a MUTANT: a copy with exactly one
 * piece corrupted, re-enacting a real defect class from the burial record
 * (provenance on every row — a mutant without provenance is a toy).
 *
 * The kill semantics: a mutant is KILLED when a named property of the battery
 * fails against it — by crash (the corruption trips a shape guard), by exact
 * arithmetic (a deviation far above tolerance), or statistically (a 5-sigma
 * census, labeled DATA). A survivor is a BLIND SPOT and must be declared, not
 * hidden.
 */
import { type CMat, type CVec, identity, kron, mat, mMul } from "../core/cmat.js";
import { applyKraus, filterBasisDigit, marginalProbs } from "../core/channels.js";
import { outer as coreOuter, vInner as coreVInner } from "../core/cmat.js";
import { vecToRho as coreVecToRho } from "../core/states.js";
import type { Rng } from "../core/rng.js";
import { GAMMA, lawKraus, mcOutsideAtK, twoRateInWorld } from "./law.js";

export interface Family {
  /** matrix product with the family's shape guard */
  mMul(a: CMat, b: CMat): CMat;
  vInner(a: CVec, b: CVec): { re: number; im: number };
  outer(a: CVec, b: CVec): CMat;
  vecToRho(v: CVec): CMat;
  applyKraus(rho: CMat, kraus: readonly CMat[]): CMat;
  /** |1><1| (x) cargo on the census register (world qubit x data qubit) */
  embedWorld(cargo: CMat): CMat;
  /** Born probabilities of the world qubit readout, [P(0), P(1)] */
  measureWorldQubit(rho: CMat): [number, number];
  /** conditional state on world = digit, normalized by the BLOCK TRACE */
  conditionalOn(rho: CMat, digit: number): CMat;
  applyLaw(rho: CMat): CMat;
  /** the k->infinity state of the law */
  limitObject(rho: CMat): CMat;
  /** MC estimate of P(outside the world AT step K), same event as the closed form */
  mcOutsideAtK(rng: Rng, trials: number, K: number, r: number): number;
  /** MC conditional frequency after postselection, with its exact value */
  postselectedFreq(rng: Rng, trials: number): { est: number; exact: number };
}

function worldProjector(): CMat {
  const p1 = mat(2, 2);
  p1.re[3] = 1;
  return p1;
}

export function canonicalFamily(): Family {
  const p1 = worldProjector();
  return {
    mMul: (a, b) => mMul(a, b),
    vInner: (a, b) => coreVInner(a, b),
    outer: (a, b) => coreOuter(a, b),
    vecToRho: (v) => coreVecToRho(v),
    applyKraus: (rho, kraus) => applyKraus(rho, kraus),
    embedWorld: (cargo) => kron(p1, cargo),
    measureWorldQubit: (rho) => {
      const { probs } = marginalProbs(rho, [2, 2], [0]);
      return [probs[0]!, probs[1]!] as [number, number];
    },
    conditionalOn: (rho, digit) => filterBasisDigit(rho, [2, 2], 0, digit).conditional,
    applyLaw: (rho) => applyKraus(rho, lawKraus(GAMMA)),
    limitObject: (rho) => {
      // both diagonal blocks summed INTO the world, sector coherences dead
      const out = mat(4, 4);
      for (let a = 0; a < 2; a++) {
        for (let b = 0; b < 2; b++) {
          const w = (2 + a) * 4 + (2 + b);
          const c = a * 4 + b;
          out.re[w] = rho.re[w]! + rho.re[c]!;
          out.im[w] = rho.im[w]! + rho.im[c]!;
        }
      }
      return out;
    },
    mcOutsideAtK: (rng, trials, K, r) => {
      let out = 0;
      for (let t = 0; t < trials; t++) if (mcOutsideAtK(true, rng, K, r, GAMMA)) out++;
      return out / trials;
    },
    postselectedFreq: (rng, trials) => {
      // accept with p_a = 0.3; accepted draws are x=1 with p_x = 0.6
      let x1 = 0;
      let accepted = 0;
      for (let t = 0; t < trials; t++) {
        if (rng() < 0.3) {
          accepted++;
          if (rng() < 0.6) x1++;
        }
      }
      return { est: x1 / accepted, exact: 0.6 };
    },
  };
}

/** shape of a mutant registration: provenance + which piece is corrupted */
export interface MutantSpec {
  readonly id: string;
  readonly defect: string;
  readonly history: string;
  readonly corrupted: string;
  /** the burial-record CATEGORIES this mutant re-enacts — the E-board's class
   * tie: an error may sit on this mutant only if the registry filed it under
   * one of these categories (E2). A mutant that declares no class guards nothing. */
  readonly classes: readonly string[];
  readonly killer: string;
  readonly expected: "EXACT-KILL" | "CRASH-KILL" | "DATA-KILL" | "SURVIVED" | "EXEMPT";
}

export const MUTANTS: readonly MutantSpec[] = [
  {
    id: "MU1",
    defect: "vInner returns the CONJUGATE of the true inner product (imaginary sign flipped)",
    history: "the conjugation-side sign error, THREE recurrences: batch 10 (qverify, expPauli), batch 28 (wukong-crossval, applyCost real part), batch 29 (survivor-census, <A|B> imaginary part)",
    corrupted: "core/cmat.ts vInner",
    classes: ["conjugation"],
    killer: "P2",
    expected: "EXACT-KILL",
  },
  {
    id: "MU2",
    defect: "vecToRho builds rho-CONJUGATE (the imaginary block sign-flipped: rho*) — a matrix that is still Hermitian, still trace 1, still PSD",
    history: "batch 20 (retro-cache): rho_03 = psi_0 conj(psi_3) written without the conjugate — |Phi_-theta> instead of |Phi_theta>, every sin-theta correlation flipped; statehood checks never saw it, the phase did",
    corrupted: "core/states.ts vecToRho",
    classes: ["conjugation"],
    killer: "P2",
    expected: "EXACT-KILL",
  },
  {
    id: "MU3",
    defect: "embedWorld inflates the register: the cargo is embedded as if it already carried the world bit — an 8x8 state from a 2x2 cargo, silently accepted",
    history: "batch 31 (stable-world): inWorldState embedded a 4x4 full state as if it were the 2x2 cargo, mAdd accepted the shape mismatch without a word — the family's adder does not check shapes (recorded there as a design boundary)",
    corrupted: "composition embedWorld (dimension-slot class)",
    classes: ["dimension-slot"],
    killer: "P2",
    expected: "EXACT-KILL",
  },
  {
    id: "MU4",
    defect: "measureWorldQubit applies the bare 2x2 projector straight to the 4x4 state — the (x) I is missing",
    history: "batch 24 (nosignal-tariff): measureQubit0 forgot the (x)I — the 2x2 projection hit the 4x4 state and the stack refused it on the spot",
    corrupted: "composition measureWorldQubit (missing tensor identity)",
    classes: ["dimension-slot"],
    killer: "P5",
    expected: "CRASH-KILL",
  },
  {
    id: "MU5",
    defect: "conditionalOn normalizes by the JOINT probability element rho[w,data=0; w,data=0] instead of the block-trace marginal",
    history: "batch 21 (route-price): conditionalData divided by the joint probability cell, not the block trace — the leakage check screamed maxdiff 190 until the conditioning object was named",
    corrupted: "composition conditionalOn (wrong-object conditioning)",
    classes: ["wrong-object"],
    killer: "P5",
    expected: "EXACT-KILL",
  },
  {
    id: "MU6",
    defect: "the law's second Kraus operator is written at the transposed index — damping flows OUT of the world instead of into it",
    history: "batch 31 (stable-world): |1><0| written with the flat index 1 instead of row-major (1,0) — the damping would flow toward the boundary",
    corrupted: "composition applyLaw (Kraus direction)",
    classes: ["dimension-slot"],
    killer: "P6",
    expected: "EXACT-KILL",
  },
  {
    id: "MU7",
    defect: "limitObject returns the DEPHASED TWIN (diagonal blocks stay in place) instead of the into-world collapse",
    history: "batch 31 (stable-world): the law's limit was first written as 'diagonal blocks stay' — the dephased twin; the true limit carries |0,x> into |1,x>, the 1e-12 assertion convicted the wrong object on the spot",
    corrupted: "composition limitObject (wrong limit object)",
    classes: ["wrong-object"],
    killer: "P7",
    expected: "EXACT-KILL",
  },
  {
    id: "MU8",
    defect: "mcOutsideAtK counts 'EVER left the world by step K' instead of 'outside AT step K' — the chain has return flow, the two events differ by an order of magnitude",
    history: "batch 31 (stable-world): the MC censused 'ever left within K steps' while the closed form priced 'outside at step K' — 682 sigma apart until the MC re-simulated the same event",
    corrupted: "composition mcOutsideAtK (event-definition mismatch)",
    classes: ["statistics"],
    killer: "P8",
    expected: "DATA-KILL",
  },
  {
    id: "MU9",
    defect: "postselectedFreq divides the success count by the TOTAL number of draws instead of the number of ACCEPTED samples",
    history: "batch 19 (postselect-sched): MC conditional frequencies divided by the total sample count — the denominator is the accepted count only, branch-world population counts branch residents",
    corrupted: "composition postselectedFreq (statistics denominator)",
    classes: ["statistics"],
    killer: "P9",
    expected: "DATA-KILL",
  },
];

/** Build the mutant family: the canonical family with exactly one piece corrupted. */
export function mutantFamily(spec: MutantSpec): Family {
  const canon = canonicalFamily();
  const p1 = worldProjector();
  switch (spec.id) {
    case "MU1":
      return { ...canon, vInner: (a, b) => { const r = coreVInner(a, b); return { re: r.re, im: -r.im }; } };
    case "MU2":
      return {
        ...canon,
        vecToRho: (v) => {
          const m = mat(v.n, v.n);
          for (let i = 0; i < v.n; i++) {
            for (let j = 0; j < v.n; j++) {
              m.re[i * v.n + j] = v.re[i]! * v.re[j]! + v.im[i]! * v.im[j]!;
              m.im[i * v.n + j] = -(v.im[i]! * v.re[j]! - v.re[i]! * v.im[j]!); // conjugate on the wrong side: rho^T
            }
          }
          return m;
        },
      };
    case "MU3":
      return {
        ...canon,
        embedWorld: (cargo) => kron(p1, kron(identity(2), cargo)), // 8x8 from a 2x2 cargo — silent inflation
      };
    case "MU4":
      return {
        ...canon,
        measureWorldQubit: (rho) => {
          const m = mMul(p1, rho); // no (x)I: 2x2 against 4x4 — the family's shape guard must refuse
          return [1 - m.re[0]!, m.re[0]!] as [number, number];
        },
      };
    case "MU5":
      return {
        ...canon,
        conditionalOn: (rho, digit) => {
          const { conditional } = filterBasisDigit(rho, [2, 2], 0, digit);
          const joint = rho.re[digit * 4 + 0]!; // joint element world=digit AND data=0 — the wrong denominator
          const out = mat(4, 4);
          for (let k = 0; k < out.re.length; k++) {
            out.re[k] = conditional.re[k]! / joint;
            out.im[k] = conditional.im[k]! / joint;
          }
          return out;
        },
      };
    case "MU6":
      return {
        ...canon,
        applyLaw: (rho) => {
          const k0w = mat(2, 2);
          k0w.re[0 * 2 + 0] = Math.sqrt(1 - GAMMA);
          k0w.re[1 * 2 + 1] = 1;
          const k1w = mat(2, 2);
          k1w.re[0 * 2 + 1] = Math.sqrt(GAMMA); // transposed index: |0><1| — damping flows outward
          return applyKraus(rho, [kron(k0w, identity(2)), kron(k1w, identity(2))]);
        },
      };
    case "MU7":
      return {
        ...canon,
        limitObject: (rho) => {
          const out = mat(4, 4);
          for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
              if (Math.floor(r / 2) !== Math.floor(c / 2)) continue; // dephased twin: cross-block cells die
              out.re[r * 4 + c] = rho.re[r * 4 + c]!;
              out.im[r * 4 + c] = rho.im[r * 4 + c]!;
            }
          }
          return out;
        },
      };
    case "MU8":
      return {
        ...canon,
        mcOutsideAtK: (rng, trials, K, r) => {
          let everOut = 0;
          for (let t = 0; t < trials; t++) {
            let inWorld = true;
            let left = false;
            for (let k = 0; k < K; k++) {
              inWorld = inWorld ? rng() >= r : rng() < GAMMA;
              if (!inWorld) left = true;
            }
            if (left) everOut++;
          }
          return everOut / trials;
        },
      };
    case "MU9":
      return {
        ...canon,
        postselectedFreq: (rng, trials) => {
          let x1 = 0;
          for (let t = 0; t < trials; t++) {
            if (rng() < 0.3 && rng() < 0.6) x1++;
          }
          return { est: x1 / trials, exact: 0.6 }; // total denominator: 0.18 against 0.6
        },
      };
    case "MU98":
      // the Q2 fixture: the GHOST — declares a corruption and ships the
      // canonical function unchanged. Nothing to kill; the census must say so.
      return { ...canon, vInner: (a, b) => coreVInner(a, b) };
    default:
      throw new Error(`unknown mutant ${spec.id}`);
  }
}

/** closed form used by the battery's statistical kill (re-exported for tests) */
export { twoRateInWorld };
