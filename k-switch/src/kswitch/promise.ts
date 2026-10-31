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
import { KSwitchError } from "./errors.js";

export const I2: CMat = { dim: 2, re: [[1, 0], [0, 1]], im: [[0, 0], [0, 0]] };
export const X2: CMat = { dim: 2, re: [[0, 1], [1, 0]], im: [[0, 0], [0, 0]] };
export const Y2: CMat = { dim: 2, re: [[0, 0], [0, 0]], im: [[0, -1], [1, 0]] };
export const Z2: CMat = { dim: 2, re: [[1, 0], [0, -1]], im: [[0, 0], [0, 0]] };

/** The canonical pairwise-COMMUTING triple (X⊗X, Y⊗Y, Z⊗Z). */
export function commutingTriple(): [CMat, CMat, CMat] {
  return [cmatKron(X2, X2), cmatKron(Y2, Y2), cmatKron(Z2, Z2)];
}

/** The canonical pairwise-ANTICOMMUTING triple (X⊗I, Z⊗I, Y⊗I). */
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
      const dr = ab.re[i]![j]! - ba.re[i]![j]!;
      const di = ab.im[i]![j]! - ba.im[i]![j]!;
      d = Math.max(d, Math.hypot(dr, di));
    }
  }
  return d;
}

/** A state vector |psi> on dim d with random amplitudes (normalized). */
export function randomState(rng: Rng, d: number): { re: number[]; im: number[] } {
  // d < 1 would normalize by 0 and silently hand back a NaN vector
  if (!Number.isInteger(d) || d < 1) {
    throw new KSwitchError("RANDOM-STATE-BAD-DIM", `randomState needs integer dim >= 1, got ${String(d)}`);
  }
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
      const ur = u.re[i]![j]!;
      const ui = u.im[i]![j]!;
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
  // 2026-11-01 修正 ×2（对齐 k=4 姊妹 interleavedDistinguishability4 的形）：
  // (1) 同一输入、同一组 W —— 旧版对两个不同随机输入态取 max，首项（不同
  //     输入穿过不同序）几乎恒 ≈1，把诚实的同输入探针完全淹没；
  // (2) boxes 已是 4×4 联合系统算符（commutingTriple 等返回 kron 好的），
  //     旧 lift = kron(u2, I2) 得 8×8，被 applyUnitaryToState 静默截断到
  //     左上 4×4 块（非幺正）——直接作用才是被探的电路类。
  const psi = randomState(rng, d);
  const w = [randomUnitary(rng, d), randomUnitary(rng, d), randomUnitary(rng, d), randomUnitary(rng, d)];
  const evolve = (boxes: readonly [CMat, CMat, CMat]): { re: number[]; im: number[] } => {
    let s = psi;
    s = applyUnitaryToState(w[0]!, s);
    s = applyUnitaryToState(boxes[order[0]]!, s);
    s = applyUnitaryToState(w[1]!, s);
    s = applyUnitaryToState(boxes[order[1]]!, s);
    s = applyUnitaryToState(w[2]!, s);
    s = applyUnitaryToState(boxes[order[2]]!, s);
    return applyUnitaryToState(w[3]!, s);
  };
  return pureTraceDistance(evolve(boxesA), evolve(boxesB));
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
  // 2026-11-01 修复：复 Givens 须共轭配对（[[c, −s·e^{iφ}], [s·e^{−iφ}, c]]
  // 才幺正）；旧 +s·sin(phi) 给出 s·e^{+iφ}，单层 max|U†U−I| 可达 1.0，
  // randomUnitary 三层组合后达 2.3 —— interleavedDistinguishability 的
  // 输出（及已发布的 exp1/exp3 "max distinguishability"）曾是非物理数。
  g.im[q]![p] = -s * Math.sin(phi);
  return g;
}
