/**
 * Promise instances and the blindness certificate.
 *
 * Promise: the triple of 2-qubit boxes is either pairwise COMMUTING or
 * pairwise ANTI-COMMUTING; decide which, one use of each box.
 *
 * Canonical instances:
 *   commuting:   (X⊗X, Y⊗Y, Z⊗Z) — products (XY)⊗(XY) etc., all commute;
 *                total product -I, order-independent.
 *   anticommuting: (X⊗I, Z⊗I, Y⊗I) — pairwise anticommute on the first
 *                qubit; every order's product = +- i I⊗I (global phase).
 *
 * A random promise-family sampler draws commuting triples (random 2-qubit
 * unitaries rotated into a commuting family) and Pauli-type anticommuting
 * triples; the machine checks the promise property and the blindness
 * structure on every draw.
 */
import { cmatKron, cmatMul, cmatZero, type CMat } from "../core/cmat.js";
import type { Rng } from "./rng.js";

export const I2: CMat = { dim: 2, re: [[1, 0], [0, 1]], im: [[0, 0], [0, 0]] };
export const X2: CMat = { dim: 2, re: [[0, 1], [1, 0]], im: [[0, 0], [0, 0]] };
export const Y2: CMat = { dim: 2, re: [[0, 0], [0, 0]], im: [[0, -1], [1, 0]] };
export const Z2: CMat = { dim: 2, re: [[1, 0], [0, -1]], im: [[0, 0], [0, 0]] };

export function commutingTriple(): [CMat, CMat, CMat] {
  return [cmatKron(X2, X2), cmatKron(Y2, Y2), cmatKron(Z2, Z2)];
}

export function anticommutingTriple(): [CMat, CMat, CMat] {
  return [cmatKron(X2, I2), cmatKron(Z2, I2), cmatKron(Y2, I2)];
}

/** Commutator deviation max |[A,B]| over entries (Hermitian unitaries: 0 or 2). */
export function commutatorDev(a: CMat, b: CMat): number {
  const ab = cmatMul(a, b);
  const ba = cmatMul(b, a);
  let d = 0;
  for (let i = 0; i < a.dim; i++) {
    for (let j = 0; j < a.dim; j++) {
      const dr = (ab.re[i]![j] as number) - (ba.re[i]![j] as number);
      const di = (ab.im[i]![j] as number) - (ba.im[i]![j] as number);
      d = Math.max(d, Math.hypot(dr, di));
    }
  }
  return d;
}

/** A state vector |psi> on dim d with random amplitudes (normalized). */
export function randomState(rng: Rng, d: number): { re: number[]; im: number[] } {
  const re = Array.from({ length: d }, () => rng.next() - 0.5);
  const im = Array.from({ length: d }, () => rng.next() - 0.5);
  let n = 0;
  for (let i = 0; i < d; i++) n += re[i]! ** 2 + im[i]! ** 2;
  const s = 1 / Math.sqrt(n);
  return { re: re.map((x) => x * s), im: im.map((x) => x * s) };
}

/** Trace distance between two pure states given as vectors (max |rho1-rho2| via 1-|<a|b>|... exact: T = sqrt(1-|<a|b>|^2) for pure states). */
export function pureTraceDistance(a: { re: number[]; im: number[] }, b: { re: number[]; im: number[] }): number {
  let dotR = 0;
  let dotI = 0;
  for (let i = 0; i < a.re.length; i++) {
    dotR += a.re[i]! * b.re[i]! + a.im[i]! * b.im[i]!;
    dotI += a.re[i]! * b.im[i]! - a.im[i]! * b.re[i]!;
  }
  const ov = Math.hypot(dotR, dotI);
  return Math.sqrt(Math.max(0, 1 - ov * ov));
}

/** Apply a unitary (dim = vector dim) to a state vector. */
export function applyUnitaryToState(u: CMat, psi: { re: number[]; im: number[] }): { re: number[]; im: number[] } {
  const d = psi.re.length;
  const re = new Array<number>(d).fill(0);
  const im = new Array<number>(d).fill(0);
  for (let i = 0; i < d; i++) {
    for (let j = 0; j < d; j++) {
      const ur = u.re[i]![j] as number;
      const ui = u.im[i]![j] as number;
      re[i] = re[i]! + ur * psi.re[j]! - ui * psi.im[j]!;
      im[i] = im[i]! + ur * psi.im[j]! + ui * psi.re[j]!;
    }
  }
  return { re, im };
}

/**
 * Random interleaved circuit between two promise instances: W0, U_a, W1,
 * U_b, W2, U_c, W3 — random unitaries interleaved with one use of each box
 * in a fixed order, on the joint system (the honest sampling probe for the
 * interleaved class; the general lower bound is ARA14's, cited).
 */
export function interleavedDistinguishability(
  boxesA: readonly [CMat, CMat, CMat],
  boxesB: readonly [CMat, CMat, CMat],
  order: readonly [number, number, number],
  rng: Rng,
): number {
  const d = 4;
  const lift = (u2: CMat): CMat => cmatKron(u2, I2); // act on system qubit 0
  const psiA = randomState(rng, d);
  const psiB = randomState(rng, d);
  let a = psiA;
  let b = psiB;
  const w = [randomUnitary(rng, d), randomUnitary(rng, d), randomUnitary(rng, d), randomUnitary(rng, d)];
  const seq = [w[0]!, lift(boxesA[order[0]]!), w[1]!, lift(boxesA[order[1]]!), w[2]!, lift(boxesA[order[2]]!), w[3]!];
  const seqB = [w[0]!, lift(boxesB[order[0]]!), w[1]!, lift(boxesB[order[1]]!), w[2]!, lift(boxesB[order[2]]!), w[3]!];
  // NOTE: same W's and same initial-state index structure — the distinguisher measures
  // the output pair; optimal measurement distinguishes the two output states up to T.
  for (const u of seq) a = applyUnitaryToState(u, a);
  for (const u of seqB) b = applyUnitaryToState(u, b);
  // The distinguisher may choose |psiA> freely; we give the classes their best
  // shot by taking max over "same input" (the honest probe: outputs from the
  // SAME input state through the two promise channels).
  const same = randomState(rng, d);
  let a2 = same;
  let b2 = same;
  for (const u of seq) a2 = applyUnitaryToState(u, a2);
  for (const u of seqB) b2 = applyUnitaryToState(u, b2);
  return Math.max(pureTraceDistance(a, b), pureTraceDistance(a2, b2));
}

/** Random d-dim unitary via a few Givens-like layers (sufficient randomness for spot checks). */
export function randomUnitary(rng: Rng, d: number): CMat {
  let u: CMat = cmatZero(d);
  for (let i = 0; i < d; i++) u.re[i]![i] = 1;
  for (let layer = 0; layer < 3; layer++) {
    for (let p = 0; p < d; p++) {
      for (let q = p + 1; q < d; q++) {
        const theta = rng.next() * Math.PI;
        const phi = rng.next() * 2 * Math.PI;
        const c = Math.cos(theta);
        const s = Math.sin(theta);
        const g = givens(d, p, q, c, s, phi);
        u = cmatMul(g, u);
      }
    }
  }
  return u;
}

function givens(d: number, p: number, q: number, c: number, s: number, phi: number): CMat {
  const g = cmatZero(d);
  for (let i = 0; i < d; i++) g.re[i]![i] = 1;
  g.re[p]![p] = c;
  g.re[q]![q] = c;
  g.re[p]![q] = -s * Math.cos(phi);
  g.im[p]![q] = -s * Math.sin(phi);
  g.re[q]![p] = s * Math.cos(phi);
  g.im[q]![p] = s * Math.sin(phi);
  return g;
}
