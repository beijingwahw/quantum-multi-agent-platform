/**
 * The 4-switch, executable: order superposition over the 24 topological sorts
 * of four boxes (system dimension 4 — two qubits; at d = 2 no four pairwise
 * anticommuting unitaries exist, the Pauli set {X, Y, Z} is maximal).
 *
 * PARITY LAW AT k = 4 (the v0.2.0 primary face):
 *   - pairwise COMMUTING quadruple: every order's product is the SAME P —
 *     the control ends exactly in |u> (uniform over the 24 orders);
 *   - pairwise ANTI-COMMUTING quadruple: every order's product equals
 *     sgn(pi)·P (bubble-sorting costs inv(pi) adjacent transpositions, each
 *     contributing a minus sign) — the control ends exactly in the SIGN-
 *     CHARACTER STATE |u_sgn> = (1/sqrt 24) sum_pi sgn(pi)|pi>;
 *   - S_4 has 12 even and 12 odd permutations, so <u|u_sgn> = (12-12)/24 = 0
 *     EXACTLY: the binary promise readout survives from k = 3 to k = 4.
 *
 * TCA+21 (PRX Quantum 2, 010320) ran the N = 4 switch in fiber with a target
 * qubit — their promise problem is the P-permutation Hadamard version; the
 * d = 4 all-24-orders parity law here is our own bounded face, machine-answered.
 *
 * PLAIN-ORDER BLINDNESS AT k = 4 (census, honest):
 *   commuting quadruples: products order-INDEPENDENT (all 24 orders, exact);
 *   anticommuting quadruples: products = sgn(pi)·P. Class-blindness of a
 *   plain fixed order needs a MATCHED pair (commuting quad, anticommuting
 *   quad) with proportional product Paulis — the k = 3 canonical pair
 *   (XX,YY,ZZ | X,Z,Y has -I vs iI) extends iff such a pair exists in the
 *   16-Pauli universe. The census machine-decides; see matchedBlindPairs().
 */
import { cmatKron, cmatMul, cmatZero, type CMat } from "../core/cmat.js";
import { I2, X2, Y2, Z2, randomState, randomUnitary } from "./promise.js";
import { Rng } from "./rng.js";
import { KSwitchError } from "./errors.js";

/** All 24 permutations of (0,1,2,3), indexed 0..23; sgn = (-1)^inv. */
export const S4: ReadonlyArray<{ readonly seq: readonly [number, number, number, number]; readonly inv: number; readonly even: boolean }> = (() => {
  const out: Array<{ seq: readonly [number, number, number, number]; inv: number; even: boolean }> = [];
  for (let a = 0; a < 4; a++) {
    for (let b = 0; b < 4; b++) {
      if (a === b) continue;
      for (let c = 0; c < 4; c++) {
        if (c === a || c === b) continue;
        for (let d = 0; d < 4; d++) {
          if (d === a || d === b || d === c) continue;
          const seq = [a, b, c, d] as const;
          let inv = 0;
          for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) if (seq[i]! > seq[j]!) inv++;
          out.push({ seq, inv, even: inv % 2 === 0 });
        }
      }
    }
  }
  return out;
})();

export type Quad = readonly [CMat, CMat, CMat, CMat];

/** Deterministic d=4 verification input (fixed seed — every certificate re-verified on the same state). */
export function verificationState4(): { re: number[]; im: number[] } {
  return randomState(new Rng(20260908), 4);
}

/** Product for order pi: boxes applied seq[0] first (U_seq3 U_seq2 U_seq1 U_seq0). */
export function orderedProduct4(boxes: Quad, seq: readonly [number, number, number, number]): CMat {
  return cmatMul(cmatMul(cmatMul(boxes[seq[3]] as CMat, boxes[seq[2]] as CMat), boxes[seq[1]] as CMat), boxes[seq[0]] as CMat);
}

/**
 * Canonical commuting quadruple — NECESSARILY non-Pauli (machine census: the
 * 16 two-qubit Paulis contain ZERO pairwise-commuting quadruples; the maximal
 * abelian Pauli subgroup has 4 elements of which 3 are non-identity). Four
 * rotations e^{iθG} of the SAME generator G = Z⊗X with angles summing to π/2:
 * pairwise commuting, and every order's product = i·(Z⊗X) exactly.
 */
export function commutingQuad(): Quad {
  return rotationsOf(cmatKron(Z2, X2));
}

/** Four distinct rotations e^{iθG} of ONE involutory generator G (angles sum to π/2). */
export function rotationsOf(g: CMat): Quad {
  const rot = (theta: number): CMat => {
    // e^{iθG} = cosθ·I + i·sinθ·G for involutory G (G² = I), full complex G
    const out = cmatZero(4);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        out.re[i]![j] = Math.cos(theta) * (i === j ? 1 : 0) - Math.sin(theta) * g.im[i]![j]!;
        out.im[i]![j] = Math.sin(theta) * g.re[i]![j]!;
      }
    }
    return out;
  };
  // π/24 + π/8 + π/12 + π/4 = (1+3+2+6)π/24 = π/2 — four distinct angles
  return [rot(Math.PI / 24), rot(Math.PI / 8), rot(Math.PI / 12), rot(Math.PI / 4)];
}

/** Canonical anticommuting quadruple: 4 pairwise-anticommuting Majoranas at d = 4. */
export function anticommutingQuad(): Quad {
  return [cmatKron(X2, I2), cmatKron(Y2, I2), cmatKron(Z2, X2), cmatKron(Z2, Z2)];
}

/** Control states on the 24-dim order register: uniform and sign-character. */
export function uniformControl4(): { re: number[]; im: number[] } {
  return { re: S4.map(() => 1 / Math.sqrt(24)), im: S4.map(() => 0) };
}

export function sgnControl4(): { re: number[]; im: number[] } {
  return { re: S4.map((p) => (p.even ? 1 / Math.sqrt(24) : -1 / Math.sqrt(24))), im: S4.map(() => 0) };
}

export function controlInner4(a: { re: number[]; im: number[] }, b: { re: number[]; im: number[] }): { re: number; im: number } {
  let re = 0;
  let im = 0;
  for (let i = 0; i < 24; i++) {
    re += a.re[i]! * b.re[i]! + a.im[i]! * b.im[i]!;
    im += a.re[i]! * b.im[i]! - a.im[i]! * b.re[i]!;
  }
  return { re, im };
}

/**
 * Reduced 24x24 control state after the 4-switch on control |u> ⊗ |psi>:
 * block pi holds P_pi|psi>, so rho_c[p][q] = (1/24) <P_q psi | P_p psi>.
 */
export function switchedControlState4(boxes: Quad, psi: { re: number[]; im: number[] }): { re: number[][]; im: number[][] } {
  const d = psi.re.length;
  const outs = S4.map((p) => {
    const prod = orderedProduct4(boxes, p.seq);
    const re = new Array<number>(d).fill(0);
    const im = new Array<number>(d).fill(0);
    for (let i = 0; i < d; i++) {
      for (let j = 0; j < d; j++) {
        const ur = prod.re[i]![j]!;
        const ui = prod.im[i]![j]!;
        re[i] = re[i]! + ur * psi.re[j]! - ui * psi.im[j]!;
        im[i] = im[i]! + ur * psi.im[j]! + ui * psi.re[j]!;
      }
    }
    return { re, im };
  });
  const reM = Array.from({ length: 24 }, () => new Array<number>(24).fill(0));
  const imM = Array.from({ length: 24 }, () => new Array<number>(24).fill(0));
  for (let p = 0; p < 24; p++) {
    for (let q = 0; q < 24; q++) {
      let dotR = 0;
      let dotI = 0;
      for (let i = 0; i < d; i++) {
        dotR += outs[q]!.re[i]! * outs[p]!.re[i]! + outs[q]!.im[i]! * outs[p]!.im[i]!;
        dotI += outs[q]!.re[i]! * outs[p]!.im[i]! - outs[q]!.im[i]! * outs[p]!.re[i]!;
      }
      reM[p]![q] = dotR / 24;
      imM[p]![q] = dotI / 24;
    }
  }
  return { re: reM, im: imM };
}

/** Fidelity <v| rho |v> for a 24-dim control vector and density matrix. */
export function controlFidelity4(rho: { re: number[][]; im: number[][] }, v: { re: number[]; im: number[] }): number {
  let acc = 0;
  for (let p = 0; p < 24; p++) {
    for (let q = 0; q < 24; q++) {
      const rvRe = rho.re[p]![q]! * v.re[q]! - rho.im[p]![q]! * v.im[q]!;
      const rvIm = rho.re[p]![q]! * v.im[q]! + rho.im[p]![q]! * v.re[q]!;
      acc += v.re[p]! * rvRe + v.im[p]! * rvIm;
    }
  }
  return acc;
}

/** The 4-switch isometry M = sum_pi |pi><pi| ⊗ P_pi on control (24) ⊗ system (dSys). */
export function switchIsometry4(boxes: Quad, dSys: number): CMat {
  const dim = 24 * dSys;
  const m = cmatZero(dim);
  for (let p = 0; p < 24; p++) {
    const prod = orderedProduct4(boxes, S4[p]!.seq);
    for (let i = 0; i < dSys; i++) {
      for (let j = 0; j < dSys; j++) {
        const ar = prod.re[i]![j]!;
        const ai = prod.im[i]![j]!;
        if (ar === 0 && ai === 0) continue;
        m.re[p * dSys + i]![p * dSys + j]! += ar;
        m.im[p * dSys + i]![p * dSys + j]! += ai;
      }
    }
  }
  return m;
}

// ---------------------------------------------------------------------------
// The d=4 Pauli census (the plain-order blindness face at k = 4).
// ---------------------------------------------------------------------------

/** All 16 two-qubit Paulis I,X,Y,Z ⊗ I,X,Y,Z (Hermitian unitaries incl identity). */
export const PAULIS4: ReadonlyArray<{ readonly name: string; readonly mat: CMat }> = (() => {
  const one: Array<[string, CMat]> = [
    ["I", I2],
    ["X", X2],
    ["Y", Y2],
    ["Z", Z2],
  ];
  const out: Array<{ name: string; mat: CMat }> = [];
  for (const [an, a] of one) for (const [bn, b] of one) out.push({ name: `${an}⊗${bn}`, mat: cmatKron(a, b) });
  return out;
})();

/** +1 commuting, -1 anticommuting, 0 error (Paulis commute or anticommute exactly). */
export function pauliCommuteSign(a: CMat, b: CMat): number {
  const ab = cmatMul(a, b);
  const ba = cmatMul(b, a);
  let devSame = 0;
  let devNeg = 0;
  for (let i = 0; i < a.dim; i++) {
    for (let j = 0; j < a.dim; j++) {
      const abr = ab.re[i]![j]!;
      const abi = ab.im[i]![j]!;
      devSame = Math.max(devSame, Math.hypot(abr - ba.re[i]![j]!, abi - ba.im[i]![j]!));
      devNeg = Math.max(devNeg, Math.hypot(abr + ba.re[i]![j]!, abi + ba.im[i]![j]!));
    }
  }
  if (devSame < 1e-12) return 1;
  if (devNeg < 1e-12) return -1;
  return 0;
}

/** Phase-invariant name of a Pauli ray (via pauliReference); "?" if not a Pauli ray. */
export function pauliName(m: CMat): string {
  const ref = pauliReference(m);
  return ref === null ? "?nonPauli" : ref.name;
}

export interface QuadCensusEntry {
  readonly indices: readonly [number, number, number, number];
  readonly names: readonly string[];
  /** "mixed" quadruples are counted in QuadCensus.mixed, never emitted as entries. */
  readonly kind: "commuting" | "anticommuting";
  /** product Pauli of the identity order (phase-invariant name), with kind. */
  readonly productName: string;
  /** max deviation of order-products from (+1 resp. sgn(pi)) * identity-order product over all 24 orders. */
  readonly signLawDev: number;
}

export interface QuadCensus {
  readonly commuting: readonly QuadCensusEntry[];
  readonly anticommuting: readonly QuadCensusEntry[];
  readonly mixed: number;
}

/**
 * Exhaustive census over the C(15,4) = 1365 quadruples of non-identity
 * two-qubit Paulis: classify pairwise-commuting vs pairwise-anticommuting vs
 * mixed, verify the structural product laws on every quadruple:
 *   commuting  -> product independent of the order (dev from P_id, all 24);
 *   anticommuting -> product = sgn(pi) * P_id (dev over all 24 orders).
 */
export function pauliQuadCensus(): QuadCensus {
  const commuting: QuadCensusEntry[] = [];
  const anticommuting: QuadCensusEntry[] = [];
  let mixed = 0;
  for (let i = 0; i < 15; i++) {
    for (let j = i + 1; j < 15; j++) {
      for (let k = j + 1; k < 15; k++) {
        for (let l = k + 1; l < 15; l++) {
          const indices: [number, number, number, number] = [i + 1, j + 1, k + 1, l + 1]; // skip index 0 (I⊗I)
          const boxes: Quad = [PAULIS4[indices[0]]!.mat, PAULIS4[indices[1]]!.mat, PAULIS4[indices[2]]!.mat, PAULIS4[indices[3]]!.mat];
          const pairs: ReadonlyArray<[number, number]> = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
          const signs = pairs.map(([a, b]) => pauliCommuteSign(boxes[a] as CMat, boxes[b] as CMat));
          if (signs.includes(0)) throw new KSwitchError("CENSUS-NON-PAULI-PAIR", `a census pair at ${indices.toString()} neither commutes nor anticommutes — the PAULIS4 table is corrupt`);
          const allC = signs.every((s) => s === 1);
          const allA = signs.every((s) => s === -1);
          const names: readonly string[] = indices.map((x) => PAULIS4[x]!.name);
          if (!allC && !allA) {
            mixed++;
            continue;
          }
          const base = orderedProduct4(boxes, [0, 1, 2, 3]);
          let dev = 0;
          for (let p = 0; p < 24; p++) {
            const prod = orderedProduct4(boxes, S4[p]!.seq);
            const target = allC ? 1 : S4[p]!.even ? 1 : -1;
            for (let a = 0; a < 4; a++) {
              for (let b = 0; b < 4; b++) {
                dev = Math.max(dev, Math.hypot(prod.re[a]![b]! - target * base.re[a]![b]!, prod.im[a]![b]! - target * base.im[a]![b]!));
              }
            }
          }
          const entry: QuadCensusEntry = { indices, names, kind: allC ? "commuting" : "anticommuting", productName: pauliName(base), signLawDev: dev };
          (allC ? commuting : anticommuting).push(entry);
        }
      }
    }
  }
  return { commuting, anticommuting, mixed };
}

/**
 * THE k=4 BLINDNESS QUESTION, machine-decided in two steps:
 *
 * 1. Inside the 16-Pauli universe: a matched pair needs a commuting Pauli
 *    quadruple — the census says ZERO exist, so the k=3 canonical blindness
 *    pair (both classes Pauli, -I vs iI) has NO k=4 Pauli analogue. This
 *    function returns [] always; the empty result IS the finding.
 * 2. Leaving the Pauli universe on the commuting side: rotations of one
 *    generator recover a matched pair — matchedBlindPair() below. At k = 3
 *    the matched pair sits inside the Pauli set; at k = 4 it provably
 *    (census) cannot.
 */
export function matchedBlindPairs(census: QuadCensus): ReadonlyArray<{ readonly comm: QuadCensusEntry; readonly anti: QuadCensusEntry }> {
  const out: Array<{ comm: QuadCensusEntry; anti: QuadCensusEntry }> = [];
  for (const c of census.commuting) {
    for (const a of census.anticommuting) {
      if (c.productName === a.productName) out.push({ comm: c, anti: a });
    }
  }
  return out;
}

export interface MatchedPairCertificate {
  readonly comm: Quad;
  readonly anti: Quad;
  /** phase-invariant product names of the two identity-order products. */
  readonly commProduct: string;
  readonly antiProduct: string;
  /** max over 24 orders of the trace distance between the two classes' outputs on a fixed input. */
  readonly maxTraceDistance: number;
}

/**
 * The constructed k=4 matched blindness pair. The generator is DERIVED from
 * the anticommuting quadruple's own identity-order product (machine-extracted
 * Pauli G, phase-invariant): the commuting side is then four rotations of G
 * with angles summing to π/2, whose product is i·G in every order — the same
 * ray as the anticommuting product ±G. Then every plain fixed order maps both
 * promise classes to the same output up to a global phase — trace distance 0
 * to the float floor, all 24 orders. (First construction attempt rotated the
 * wrong generator Z⊗X while the anticommuting product is I⊗Y — the machine
 * rejected it at max T = 0.918; deriving G is the fix.)
 */
export function matchedBlindPair(psi: { re: number[]; im: number[] }): MatchedPairCertificate {
  const anti = anticommutingQuad();
  const pa = orderedProduct4(anti, [0, 1, 2, 3]);
  const gRef = pauliReference(pa);
  if (gRef === null) throw new KSwitchError("MATCHED-PAIR-GENERATOR-NOT-PAULI", "anticommuting product is not a Pauli ray — cannot construct matched pair");
  const comm = rotationsOf(gRef.mat);
  const pc = orderedProduct4(comm, [0, 1, 2, 3]);
  let worst = 0;
  for (let p = 0; p < 24; p++) {
    const outC = applyMat(orderedProduct4(comm, S4[p]!.seq), psi);
    const outA = applyMat(orderedProduct4(anti, S4[p]!.seq), psi);
    // pure-state trace distance via overlap
    let dotR = 0;
    let dotI = 0;
    for (let i = 0; i < psi.re.length; i++) {
      dotR += outC.re[i]! * outA.re[i]! + outC.im[i]! * outA.im[i]!;
      dotI += outC.re[i]! * outA.im[i]! - outC.im[i]! * outA.re[i]!;
    }
    const ov = Math.hypot(dotR, dotI);
    worst = Math.max(worst, Math.sqrt(Math.max(0, 1 - ov * ov)));
  }
  return { comm, anti, commProduct: pauliName(pc), antiProduct: pauliName(pa), maxTraceDistance: worst };
}

/** Phase-invariant Pauli reference of m: the PAULIS4 entry proportional to m, or null. */
export function pauliReference(m: CMat): { readonly name: string; readonly mat: CMat } | null {
  // a Pauli ray is q·P for a unit phase q ∈ {1, i, -1, -i} — try all four
  const phases: ReadonlyArray<[number, number]> = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  for (const [qc, qs] of phases) {
    const ref = PAULIS4.find((p) => {
      let dev = 0;
      for (let a = 0; a < 4; a++) {
        for (let b = 0; b < 4; b++) {
          const rr = m.re[a]![b]! * qc - m.im[a]![b]! * qs;
          const ii = m.re[a]![b]! * qs + m.im[a]![b]! * qc;
          dev = Math.max(dev, Math.hypot(rr - p.mat.re[a]![b]!, ii - p.mat.im[a]![b]!));
        }
      }
      return dev < 1e-12;
    });
    if (ref !== undefined) return ref;
  }
  return null;
}

/** Apply a d×d CMat to a state vector (d = psi length). */
function applyMat(u: CMat, psi: { re: number[]; im: number[] }): { re: number[]; im: number[] } {
  const d = psi.re.length;
  const re = new Array<number>(d).fill(0);
  const im = new Array<number>(d).fill(0);
  for (let i = 0; i < d; i++) {
    for (let j = 0; j < d; j++) {
      const ur = u.re[i]![j]!;
      const ui = u.im[i]![j]!;
      re[i] = re[i]! + ur * psi.re[j]! - ui * psi.im[j]!;
      im[i] = im[i]! + ur * psi.im[j]! + ui * psi.re[j]!;
    }
  }
  return { re, im };
}

/**
 * Random interleaved circuit between two k=4 promise instances at d = 4:
 * W0, U_a, W1, U_b, W2, U_c, W3, U_d, W4 in a fixed order, the SAME W's and
 * input for both instances — the honest sampling probe for the interleaved
 * class (the general fixed-order lower bound is ARA14's / Bavaresco et
 * al. 2024's theorem, cited). Returns the pure-state trace distance between
 * the two outputs from the shared input.
 */
export function interleavedDistinguishability4(
  boxesA: Quad,
  boxesB: Quad,
  order: readonly [number, number, number, number],
  rng: Rng,
): number {
  const d = 4;
  const psi = randomState(rng, d);
  const w = [randomUnitary(rng, d), randomUnitary(rng, d), randomUnitary(rng, d), randomUnitary(rng, d), randomUnitary(rng, d)];
  const evolve = (boxes: Quad): { re: number[]; im: number[] } => {
    let s = psi;
    for (let t = 0; t < 5; t++) {
      s = applyMat(w[t]!, s);
      if (t < 4) s = applyMat(boxes[order[t]!]!, s);
    }
    return s;
  };
  const a = evolve(boxesA);
  const b = evolve(boxesB);
  let dotR = 0;
  let dotI = 0;
  for (let i = 0; i < d; i++) {
    dotR += a.re[i]! * b.re[i]! + a.im[i]! * b.im[i]!;
    dotI += a.re[i]! * b.im[i]! - a.im[i]! * b.re[i]!;
  }
  const ov = Math.hypot(dotR, dotI);
  return Math.sqrt(Math.max(0, 1 - ov * ov));
}


