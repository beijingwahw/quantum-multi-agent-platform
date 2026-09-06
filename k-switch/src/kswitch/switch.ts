/**
 * The 3-switch, executable: order superposition over the six topological
 * sorts of three boxes.
 *
 * Control register: 6-dim, basis |pi> indexed by permutations of (1,2,3).
 * The switch isometry M acts as
 *     M |pi>|psi> = |pi> (x) U_{pi(3)} U_{pi(2)} U_{pi(1)} |psi>,
 * a block-diagonal controlled routing — physically the coherent version of
 * "apply the boxes in order pi", one use of each box in every branch.
 *
 * PROMISE READOUT (the core law, dimension-free):
 *   - pairwise COMMUTING triple: U_{pi3}U_{pi2}U_{pi1} = P for every pi, so
 *     the control factorises out untouched: |c> -> |c>|P psi>.
 *   - pairwise ANTI-COMMUTING triple (all three pairs): every order's
 *     product equals (-1)^{inv(pi)} P — bubble-sorting the identity order to
 *     pi costs inv(pi) adjacent transpositions, each contributing a minus
 *     sign. With control prepared uniform, |u> = (1/sqrt 6) sum_pi |pi>,
 *     the control ends in the PARITY STATE |u_par> = (1/sqrt 6) sum_pi
 *     (-1)^{inv(pi)} |pi>, while the system factorises as P|psi>.
 *   - S_3 has 3 even and 3 odd permutations, so <u|u_par> = (3-3)/6 = 0
 *     EXACTLY: the two promise classes are deterministically distinguishable.
 *
 * This needs only d_sys >= 1 — the d >= N! dimension requirement of ARA14
 * belongs to their strictly harder problem (identifying the phase of every
 * order); the binary commuting/anticommuting promise has no such bound.
 *
 * PLAIN FIXED-ORDER BLINDNESS (structural, exact):
 *   - commuting triple: the product is order-INDEPENDENT;
 *   - anticommuting triple of Pauli type: every order's product is +- c·I.
 *   Either way a plain sequential circuit's output is |psi> up to a global
 *   phase — trace distance exactly 0 between the promise classes, for every
 *   order and every promise instance. Interleaved/ancilla-assisted circuits
 *   are the cited theorem's territory (ARA14's O(n^2) lower bound); the
 *   coherent-control-of-application class is the switch's own mechanism and
 *   excluded from "fixed-order" by definition.
 */
import { cmatMul, cmatZero, type CMat } from "../core/cmat.js";

/** All six permutations of (0,1,2), indexed 0..5; inv = inversion count. */
export const S3: ReadonlyArray<{ readonly seq: readonly [number, number, number]; readonly inv: number; readonly even: boolean }> = (() => {
  const out: Array<{ seq: readonly [number, number, number]; inv: number; even: boolean }> = [];
  for (let a = 0; a < 3; a++) {
    for (let b = 0; b < 3; b++) {
      for (let c = 0; c < 3; c++) {
        if (a === b || b === c || a === c) continue;
        const seq = [a, b, c] as const;
        let inv = 0;
        for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) if (seq[i]! > seq[j]!) inv++;
        out.push({ seq, inv, even: inv % 2 === 0 });
      }
    }
  }
  return out;
})();

/** Product for order pi: boxes applied seq[0] first. */
export function orderedProduct(boxes: readonly [CMat, CMat, CMat], seq: readonly [number, number, number]): CMat {
  // first applied acts first on the state: |psi> -> U_seq2 U_seq1 U_seq0 |psi>
  return cmatMul(cmatMul(boxes[seq[2]] as CMat, boxes[seq[1]] as CMat), boxes[seq[0]] as CMat);
}

/** The 3-switch isometry on control (6) ⊗ system (d): M = sum_pi |pi><pi| ⊗ P_pi. */
export function switchIsometry(boxes: readonly [CMat, CMat, CMat], dSys: number): CMat {
  const dim = 6 * dSys;
  const m = cmatZero(dim);
  for (let p = 0; p < 6; p++) {
    const prod = orderedProduct(boxes, S3[p]!.seq);
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

/** Control state vectors |u> and |u_par> as 6-dim complex vectors (CMat dim 1 columns not needed). */
export function uniformControl(): { re: number[]; im: number[] } {
  return { re: S3.map(() => 1 / Math.sqrt(6)), im: S3.map(() => 0) };
}

export function parityControl(): { re: number[]; im: number[] } {
  return { re: S3.map((p) => (p.even ? 1 / Math.sqrt(6) : -1 / Math.sqrt(6))), im: S3.map(() => 0) };
}

export function controlInner(a: { re: number[]; im: number[] }, b: { re: number[]; im: number[] }): { re: number; im: number } {
  let re = 0;
  let im = 0;
  for (let i = 0; i < 6; i++) {
    re += a.re[i]! * b.re[i]! + a.im[i]! * b.im[i]!;
    im += a.re[i]! * b.im[i]! - a.im[i]! * b.re[i]!;
  }
  return { re, im };
}

/**
 * Evolve |u> ⊗ |psi> under the switch and return the (exact) reduced control
 * state. The system is traced out by construction per control block: block p
 * holds P_pi|psi>, so rho_c[p][q] = <P_q psi | P_p psi>.
 */
export function switchedControlState(boxes: readonly [CMat, CMat, CMat], psi: { re: number[]; im: number[] }): { re: number[][]; im: number[][] } {
  const d = psi.re.length;
  // per-order output states
  const outs = S3.map((p) => {
    const prod = orderedProduct(boxes, p.seq);
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
  const reM = Array.from({ length: 6 }, () => new Array<number>(6).fill(0));
  const imM = Array.from({ length: 6 }, () => new Array<number>(6).fill(0));
  const nrm = 1 / 6; // |<u| = 1/sqrt6 each: rho_c[p][q] = (1/6) <out_q|out_p>
  for (let p = 0; p < 6; p++) {
    for (let q = 0; q < 6; q++) {
      let dotR = 0;
      let dotI = 0;
      for (let i = 0; i < d; i++) {
        // <out_q|out_p> = conj(out_q_i) * out_p_i
        dotR += outs[q]!.re[i]! * outs[p]!.re[i]! + outs[q]!.im[i]! * outs[p]!.im[i]!;
        dotI += outs[q]!.re[i]! * outs[p]!.im[i]! - outs[q]!.im[i]! * outs[p]!.re[i]!;
      }
      reM[p]![q] = dotR * nrm;
      imM[p]![q] = dotI * nrm;
    }
  }
  return { re: reM, im: imM };
}

/** Fidelity <v| rho |v> for a 6-dim control state vector v and density matrix rho. */
export function controlFidelity(rho: { re: number[][]; im: number[][] }, v: { re: number[]; im: number[] }): number {
  let acc = 0;
  for (let p = 0; p < 6; p++) {
    for (let q = 0; q < 6; q++) {
      // (rho v)_p = sum_q rho[p][q] v_q ; then <v|rho v>
      const rvRe = rho.re[p]![q]! * v.re[q]! - rho.im[p]![q]! * v.im[q]!;
      const rvIm = rho.re[p]![q]! * v.im[q]! + rho.im[p]![q]! * v.re[q]!;
      acc += v.re[p]! * rvRe + v.im[p]! * rvIm;
    }
  }
  return acc;
}
