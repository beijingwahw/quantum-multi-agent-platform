/**
 * No-signaling withdrawal clause — the machine certificate behind the atlas
 * entry `retrocausal-cache` (genealogy family).
 *
 * Claim on trial: "the retrocausal cache — answers arrive before questions,
 * hit rate 100%."
 *
 * What the machine executes (exact complex linear algebra, no sampling):
 *   A. MARGINAL INVARIANCE: for random bipartite-plus-environment states,
 *      an arbitrary local unitary on the A side — and an arbitrary local
 *      CPTP map, executed as a Stinespring unitary on A plus a fresh
 *      ancilla with everything but B traced out — leaves the B-side marginal
 *      unchanged to float zero. The distant receiver's state cannot encode
 *      the sender's choice of operation: no message, no withdrawal.
 *   B. THE WITHDRAWAL CLAUSE: the same local unitary DOES change the joint
 *      state (Hilbert-Schmidt distance > 0) — the answer exists, but only
 *      in the correlation; spending it requires the A half to be delivered,
 *      over a channel whose latency floor is distance/c (relativity quoted,
 *      not derived here).
 *   C. CORRELATION-WITHOUT-SIGNATURE anchor: the singlet's marginals are
 *      exactly I/2 along every axis while correlations follow -a.b in
 *      closed form and CHSH reaches 2*sqrt(2) — the strongest statement the
 *      formalism itself makes: correlation is real, signaling is zero.
 *
 * Scope (honest): this certifies quantum mechanics' own no-signaling (GRW80)
 * on exact instances. It says nothing about superquantum no-signaling
 * theories; the wall is the formalism's, verified here by execution.
 */
import type { Rng } from "../core/rng.js";

export interface CMat {
  readonly dim: number;
  readonly re: number[][];
  readonly im: number[][];
}
export interface CVec {
  readonly dim: number;
  readonly re: number[];
  readonly im: number[];
}

function cmatZero(dim: number): CMat {
  return {
    dim,
    re: Array.from({ length: dim }, () => new Array<number>(dim).fill(0)),
    im: Array.from({ length: dim }, () => new Array<number>(dim).fill(0)),
  };
}

function cmatIdentity(dim: number): CMat {
  const m = cmatZero(dim);
  for (let i = 0; i < dim; i++) m.re[i]![i] = 1;
  return m;
}

function cmatMul(a: CMat, b: CMat): CMat {
  const out = cmatZero(a.dim);
  for (let i = 0; i < a.dim; i++) {
    for (let k = 0; k < a.dim; k++) {
      const ar = a.re[i]![k] as number;
      const ai = a.im[i]![k] as number;
      if (ar === 0 && ai === 0) continue;
      for (let j = 0; j < b.dim; j++) {
        const br = b.re[k]![j] as number;
        const bi = b.im[k]![j] as number;
        out.re[i]![j] = (out.re[i]![j] as number) + ar * br - ai * bi;
        out.im[i]![j] = (out.im[i]![j] as number) + ar * bi + ai * br;
      }
    }
  }
  return out;
}

function cmatKron(a: CMat, b: CMat): CMat {
  const dim = a.dim * b.dim;
  const out = cmatZero(dim);
  for (let i = 0; i < a.dim; i++) {
    for (let j = 0; j < a.dim; j++) {
      const ar = a.re[i]![j] as number;
      const ai = a.im[i]![j] as number;
      if (ar === 0 && ai === 0) continue;
      for (let k = 0; k < b.dim; k++) {
        for (let l = 0; l < b.dim; l++) {
          const br = b.re[k]![l] as number;
          const bi = b.im[k]![l] as number;
          out.re[i * b.dim + k]![j * b.dim + l] = ar * br - ai * bi;
          out.im[i * b.dim + k]![j * b.dim + l] = ar * bi + ai * br;
        }
      }
    }
  }
  return out;
}

/** Qubit q = 0 is the most significant bit of the basis index. */
function bit(i: number, nQubits: number, q: number): number {
  return (i >>> (nQubits - 1 - q)) & 1;
}

/** Embed U (dim 2^targets.length) acting on the given target qubits, in the order given, into nQubits qubits. */
export function embed(U: CMat, targets: readonly number[], nQubits: number): CMat {
  const dim = 2 ** nQubits;
  if (U.dim !== 2 ** targets.length) {
    throw new Error(`embed: unitary dim ${U.dim} does not match ${2 ** targets.length} = 2^${targets.length} target qubits`);
  }
  const out = cmatZero(dim);
  const isTarget = new Array<boolean>(nQubits).fill(false);
  for (const q of targets) isTarget[q] = true;
  const subIdx = (i: number): number => {
    let v = 0;
    for (const q of targets) v = v * 2 + bit(i, nQubits, q);
    return v;
  };
  for (let i = 0; i < dim; i++) {
    for (let j = 0; j < dim; j++) {
      let same = true;
      for (let q = 0; q < nQubits; q++) {
        if (isTarget[q]) continue;
        if (bit(i, nQubits, q) !== bit(j, nQubits, q)) {
          same = false;
          break;
        }
      }
      if (!same) continue;
      const ui = subIdx(i);
      const uj = subIdx(j);
      out.re[i]![j] = U.re[ui]![uj] as number;
      out.im[i]![j] = U.im[ui]![uj] as number;
    }
  }
  return out;
}

function applyVec(U: CMat, v: CVec): CVec {
  const re = new Array<number>(U.dim).fill(0);
  const im = new Array<number>(U.dim).fill(0);
  for (let i = 0; i < U.dim; i++) {
    for (let j = 0; j < U.dim; j++) {
      const ur = U.re[i]![j] as number;
      const ui = U.im[i]![j] as number;
      if (ur === 0 && ui === 0) continue;
      re[i] = re[i]! + ur * (v.re[j] as number) - ui * (v.im[j] as number);
      im[i] = im[i]! + ur * (v.im[j] as number) + ui * (v.re[j] as number);
    }
  }
  return { dim: U.dim, re, im };
}

function rz(lambda: number): CMat {
  const m = cmatZero(2);
  m.re[0]![0] = Math.cos(lambda / 2);
  m.im[0]![0] = -Math.sin(lambda / 2);
  m.re[1]![1] = Math.cos(lambda / 2);
  m.im[1]![1] = Math.sin(lambda / 2);
  return m;
}

function ry(theta: number): CMat {
  const m = cmatZero(2);
  const c = Math.cos(theta / 2);
  const s = Math.sin(theta / 2);
  m.re[0]![0] = c;
  m.re[0]![1] = -s;
  m.re[1]![0] = s;
  m.re[1]![1] = c;
  return m;
}

/** CNOT in the |control, target> basis (control = first target qubit). */
function cnot(): CMat {
  const m = cmatIdentity(4);
  m.re[2]![2] = 0;
  m.re[3]![3] = 0;
  m.re[2]![3] = 1;
  m.re[3]![2] = 1;
  return m;
}

/** A generic-enough random unitary: alternating random su(2) layers and CNOT chains. */
function randomLocalCircuit(nQubits: number, layers: number, rng: Rng): CMat {
  let u = cmatIdentity(2 ** nQubits);
  for (let l = 0; l < layers; l++) {
    for (let q = 0; q < nQubits; q++) {
      const g1 = cmatMul(rz(rng.next() * 2 * Math.PI), ry(rng.next() * 2 * Math.PI));
      const g = cmatMul(g1, rz(rng.next() * 2 * Math.PI));
      u = cmatMul(embed(g, [q], nQubits), u);
    }
    for (let q = 0; q + 1 < nQubits; q++) {
      u = cmatMul(embed(cnot(), [q, q + 1], nQubits), u);
    }
  }
  return u;
}

function basisState(nQubits: number): CVec {
  const dim = 2 ** nQubits;
  const re = new Array<number>(dim).fill(0);
  const im = new Array<number>(dim).fill(0);
  re[0] = 1;
  return { dim, re, im };
}

function randomState(nQubits: number, rng: Rng): CVec {
  return applyVec(randomLocalCircuit(nQubits, 4, rng), basisState(nQubits));
}

/** psi (x) |0> — append one fresh qubit in |0> as the LEAST significant bit. */
function tensorAncillaZero(psi: CVec): CVec {
  const dim = psi.dim * 2;
  const re = new Array<number>(dim).fill(0);
  const im = new Array<number>(dim).fill(0);
  for (let i = 0; i < psi.dim; i++) {
    re[2 * i] = psi.re[i] as number;
    im[2 * i] = psi.im[i] as number;
  }
  return { dim, re, im };
}

/**
 * Partial trace of |psi><psi| down to the kept qubits (kept order = output
 * bit order; strides computed in the OUTPUT space, never reused from input).
 */
export function reduced(psi: CVec, nQubits: number, keep: readonly number[]): CMat {
  const kdim = 2 ** keep.length;
  const out = cmatZero(kdim);
  const isKeep = new Array<boolean>(nQubits).fill(false);
  for (const q of keep) isKeep[q] = true;
  const keepIdx = (i: number): number => {
    let v = 0;
    for (const q of keep) v = v * 2 + bit(i, nQubits, q);
    return v;
  };
  for (let i = 0; i < psi.dim; i++) {
    const air = psi.re[i] as number;
    const aii = psi.im[i] as number;
    if (air === 0 && aii === 0) continue;
    for (let j = 0; j < psi.dim; j++) {
      let same = true;
      for (let q = 0; q < nQubits; q++) {
        if (isKeep[q]) continue;
        if (bit(i, nQubits, q) !== bit(j, nQubits, q)) {
          same = false;
          break;
        }
      }
      if (!same) continue;
      const bjr = psi.re[j] as number;
      const bji = psi.im[j] as number;
      const ki = keepIdx(i);
      const kj = keepIdx(j);
      // rho[ki][kj] += psi_i * conj(psi_j) = (a+bi)(c-di) = (ac+bd) + i(bc-ad)
      out.re[ki]![kj] = (out.re[ki]![kj] as number) + air * bjr + aii * bji;
      out.im[ki]![kj] = (out.im[ki]![kj] as number) + aii * bjr - air * bji;
    }
  }
  return out;
}

/** Max elementwise |a - b| (complex modulus). */
export function maxElementDiff(a: CMat, b: CMat): number {
  let d = 0;
  for (let i = 0; i < a.dim; i++) {
    for (let j = 0; j < a.dim; j++) {
      const dr = (a.re[i]![j] as number) - (b.re[i]![j] as number);
      const di = (a.im[i]![j] as number) - (b.im[i]![j] as number);
      d = Math.max(d, Math.hypot(dr, di));
    }
  }
  return d;
}

/** Hilbert-Schmidt distance ||a - b||_F. */
export function froDiff(a: CMat, b: CMat): number {
  let s = 0;
  for (let i = 0; i < a.dim; i++) {
    for (let j = 0; j < a.dim; j++) {
      const dr = (a.re[i]![j] as number) - (b.re[i]![j] as number);
      const di = (a.im[i]![j] as number) - (b.im[i]![j] as number);
      s += dr * dr + di * di;
    }
  }
  return Math.sqrt(s);
}

function sigmaAxis(a: readonly [number, number, number]): CMat {
  const m = cmatZero(2);
  m.re[0]![0] = a[2];
  m.re[1]![1] = -a[2];
  m.re[0]![1] = a[0];
  m.im[0]![1] = -a[1];
  m.re[1]![0] = a[0];
  m.im[1]![0] = a[1];
  return m;
}

/** <psi|M|psi> as a real number (Hermitian forms). */
function cvecExpect(psi: CVec, m: CMat): number {
  let acc = 0;
  for (let i = 0; i < m.dim; i++) {
    for (let j = 0; j < m.dim; j++) {
      const mr = m.re[i]![j] as number;
      const mi = m.im[i]![j] as number;
      if (mr === 0 && mi === 0) continue;
      // conj(psi_i) * M[i][j] * psi_j
      const cr = psi.re[i] as number;
      const ci = psi.im[i] as number;
      const vr = psi.re[j] as number;
      const vi = psi.im[j] as number;
      // (cr - i ci)(mr + i mi) = (cr*mr + ci*mi) + i(cr*mi - ci*mr); times (vr + i vi):
      const wr = cr * mr + ci * mi;
      const wi = cr * mi - ci * mr;
      acc += wr * vr - wi * vi;
    }
  }
  return acc;
}

export interface NosignalTrial {
  /** HS distance the local unitary moved the JOINT state (non-vacuity: info exists) */
  readonly jointUnitary: number;
  /** B-marginal max-element deviation under the same unitary (float zero) */
  readonly marginalUnitary: number;
  /** HS distance the local CPTP map moved the JOINT state */
  readonly jointCptp: number;
  /** B-marginal deviation under the same CPTP map (float zero) */
  readonly marginalCptp: number;
}

/**
 * One trial of the withdrawal clause. Registers (5 qubits): A = {0,1},
 * B = {2,3}, environment E = {4}; the CPTP pass adds ancilla F = {5}.
 * The B receiver's register never appears in any operation.
 */
export function nosignalTrial(rng: Rng): NosignalTrial {
  const psi = randomState(5, rng);
  const rhoB = reduced(psi, 5, [2, 3]);
  const rhoAB = reduced(psi, 5, [0, 1, 2, 3]);

  // (1) arbitrary local unitary on A
  const uA = randomLocalCircuit(2, 3, rng);
  const psiU = applyVec(embed(uA, [0, 1], 5), psi);
  const jointUnitary = froDiff(reduced(psiU, 5, [0, 1, 2, 3]), rhoAB);
  const marginalUnitary = maxElementDiff(reduced(psiU, 5, [2, 3]), rhoB);

  // (2) arbitrary local CPTP on A: Stinespring unitary on A (x) F with F=|0>, traced out
  const psiF = tensorAncillaZero(psi); // 6 qubits; A={0,1}, B={2,3}, E={4}, F={5}
  const v = randomLocalCircuit(3, 3, rng); // acts on qubits {0,1,5} in role order (A0,A1,F)
  const psiC = applyVec(embed(v, [0, 1, 5], 6), psiF);
  const jointCptp = froDiff(reduced(psiC, 6, [0, 1, 2, 3]), rhoAB);
  const marginalCptp = maxElementDiff(reduced(psiC, 6, [2, 3]), rhoB);

  return { jointUnitary, marginalUnitary, jointCptp, marginalCptp };
}

/** Projector (I + s*a.sigma)/2 onto the s-eigenaxis of a. */
function projector(a: readonly [number, number, number], s: number): CMat {
  const m = cmatZero(2);
  m.re[0]![0] = (1 + s * a[2]) / 2;
  m.re[1]![1] = (1 - s * a[2]) / 2;
  m.re[0]![1] = (s * a[0]) / 2;
  m.im[0]![1] = (-s * a[1]) / 2;
  m.re[1]![0] = (s * a[0]) / 2;
  m.im[1]![0] = (s * a[1]) / 2;
  return m;
}

export interface SingletAnchors {
  /** max over random axes of ||rho_B(axis) - I/2||_max */
  readonly marginalMaxDev: number;
  /** max over random axis pairs of |E(a,b) - (-a.b)| */
  readonly correlationMaxErr: number;
  /** CHSH value at the standard maximal-violation angles */
  readonly chsh: number;
  /** |chsh| - 2*sqrt(2) */
  readonly chshErr: number;
}

function randomAxis(rng: Rng): [number, number, number] {
  // uniform on the sphere: z = 2u-1, phi = 2*pi*v
  const z = 2 * rng.next() - 1;
  const phi = 2 * Math.PI * rng.next();
  const r = Math.sqrt(1 - z * z);
  return [r * Math.cos(phi), r * Math.sin(phi), z];
}

function normalize(v: readonly [number, number, number]): [number, number, number] {
  const n = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / n, v[1] / n, v[2] / n];
}

/** The singlet (|01> - |10>)/sqrt(2): qubit 0 is the most significant bit. */
export function singlet(): CVec {
  const re = [0, 1 / Math.SQRT2, -1 / Math.SQRT2, 0];
  return { dim: 4, re, im: [0, 0, 0, 0] };
}

export function singletAnchors(rng: Rng, axes: number): SingletAnchors {
  const psi = singlet();
  const i2 = cmatZero(2);
  i2.re[0]![0] = 0.5;
  i2.re[1]![1] = 0.5;

  let marginalMaxDev = 0;
  let correlationMaxErr = 0;
  for (let t = 0; t < axes; t++) {
    const a = randomAxis(rng);
    const b = randomAxis(rng);
    // A is MEASURED along a, outcome forgotten: rho' = sum_s (P_s (x) I)|psi><psi|(P_s (x) I).
    // Both branch vectors enter unnormalized, so their norms carry the outcome weights.
    const rhoB = cmatZero(2);
    for (const s of [1, -1] as const) {
      const branch = applyVec(cmatKron(projector(a, s), cmatIdentity(2)), psi);
      const r = reduced(branch, 2, [1]);
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          rhoB.re[i]![j] = (rhoB.re[i]![j] as number) + (r.re[i]![j] as number);
          rhoB.im[i]![j] = (rhoB.im[i]![j] as number) + (r.im[i]![j] as number);
        }
      }
    }
    marginalMaxDev = Math.max(marginalMaxDev, maxElementDiff(rhoB, i2));
    const e = cvecExpect(psi, cmatKron(sigmaAxis(a), sigmaAxis(b)));
    correlationMaxErr = Math.max(correlationMaxErr, Math.abs(e - (-(a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))));
  }

  // CHSH at the standard angles: A0=z, A1=x, B0=(z+x)/sqrt2, B1=(z-x)/sqrt2
  const A0: [number, number, number] = [0, 0, 1];
  const A1: [number, number, number] = [1, 0, 0];
  const B0 = normalize([1, 0, 1]);
  const B1 = normalize([-1, 0, 1]);
  const e00 = cvecExpect(psi, cmatKron(sigmaAxis(A0), sigmaAxis(B0)));
  const e01 = cvecExpect(psi, cmatKron(sigmaAxis(A0), sigmaAxis(B1)));
  const e10 = cvecExpect(psi, cmatKron(sigmaAxis(A1), sigmaAxis(B0)));
  const e11 = cvecExpect(psi, cmatKron(sigmaAxis(A1), sigmaAxis(B1)));
  const chsh = Math.abs(e00 + e01 + e10 - e11);

  return { marginalMaxDev, correlationMaxErr, chsh, chshErr: Math.abs(chsh - 2 * Math.SQRT2) };
}
