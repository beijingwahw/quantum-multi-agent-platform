/**
 * The quantum switch as an executable supermap.
 *
 * A black-box channel is given as a Stinespring isometry V: H_in → H_S ⊗ H_E
 * (same target dimension in and out). The switch of two isometries V_A, V_B
 * with a control qubit c is the controlled-routing isometry
 *
 *   M |0⟩|ψ⟩ = |0⟩ ⊗ W_{A-first}|ψ⟩   (control 0 → A acts first)
 *   M |1⟩|ψ⟩ = |1⟩ ⊗ W_{B-first}|ψ⟩   (control 1 → B acts first)
 *
 * mapping (c ⊗ S_in) → (c ⊗ S_out ⊗ E_A ⊗ E_B). The order superposition
 * arises when the input control is e.g. |+⟩; M itself is a plain isometry
 * (certificate: M†M = I), so the switch is a valid physical process.
 *
 * Index conventions (big-endian digit decomposition, matching partialTrace in
 * core/channels): V has row (s, m) = s·envDim + m over dims [d, envDim]; every
 * branch isometry has rows over dims [d, eA, eB] with FIXED slot semantics —
 * slot a always holds A's environment, slot b always B's, regardless of which
 * operator acts first. Permuting slots per-branch silently corrupts the
 * cross-branch coherences (a bug class this repo's judges are built to catch).
 */

import { type CMat, identity, kron, mat, matEq, mDagger, mMul } from '../core/cmat.js';
import { partialTrace } from '../core/channels.js';

export interface Stinespring {
  /** target system dimension (input = output) */
  readonly d: number;
  /** environment dimension (number of Kraus operators) */
  readonly envDim: number;
  /** (d·envDim) × d isometry: V†V = I_d; row (s, m) = s·envDim + m */
  readonly V: CMat;
}

/** Standard Stinespring dilation of a Kraus set: V = Σ_m K_m ⊗ |m⟩_E. */
export function krausToStinespring(kraus: readonly CMat[]): Stinespring {
  const d = kraus[0]?.rows ?? 0;
  if (kraus.some((k) => k.rows !== d || k.cols !== d)) throw new Error('kraus operators must be d×d');
  const envDim = kraus.length;
  const V = mat(d * envDim, d);
  for (let m = 0; m < envDim; m++) {
    const K = kraus[m]!;
    for (let i = 0; i < d; i++) {
      for (let s = 0; s < d; s++) {
        // K is d×d — enforced by the shape check directly above
        V.re[(s * envDim + m) * d + i] = K.re[s * d + i]!;
        V.im[(s * envDim + m) * d + i] = K.im[s * d + i]!;
      }
    }
  }
  const st: Stinespring = { d, envDim, V };
  assertStinespring(st);
  return st;
}

/** Isometry certificate: V†V = I_d. */
export function assertStinespring(st: Stinespring, tol = 1e-12): void {
  if (!matEq(mMul(mDagger(st.V), st.V), identity(st.d), tol)) {
    throw new Error('Stinespring dilation failed the isometry check V†V = I');
  }
}

/** Boundary check: V must be the (d·envDim)×d buffer the index conventions assume. */
function checkStinespringShape(st: Stinespring, caller: string): void {
  if (st.V.rows !== st.d * st.envDim || st.V.cols !== st.d) {
    throw new Error(`${caller}: V must be ${st.d * st.envDim}x${st.d}, got ${st.V.rows}x${st.V.cols}`);
  }
}

/**
 * Branch isometry with fixed environment slot semantics (rows over
 * [d, eA, eB]; slot a = A's environment, slot b = B's, always):
 *
 *   first='A': β(s,a,b|i) = Σ_j V_B[(s,b), j] · V_A[(j,a), i]
 *   first='B': β(s,a,b|i) = Σ_j V_A[(s,a), j] · V_B[(j,b), i]
 */
export function branchIsometry(va: Stinespring, vb: Stinespring, first: 'A' | 'B'): CMat {
  if (va.d !== vb.d) throw new Error('target dimensions must match');
  // a malformed dilation buffer would read past its end and silently produce a
  // NaN branch — refuse it here, once, not per inner-loop iteration
  checkStinespringShape(va, 'branchIsometry');
  checkStinespringShape(vb, 'branchIsometry');
  const d = va.d;
  const eA = va.envDim;
  const eB = vb.envDim;
  const W = mat(d * eA * eB, d);
  for (let i = 0; i < d; i++) {
    for (let s = 0; s < d; s++) {
      for (let a = 0; a < eA; a++) {
        for (let b = 0; b < eB; b++) {
          let accRe = 0;
          let accIm = 0;
          for (let j = 0; j < d; j++) {
            let lateRe: number, lateIm: number, earlyRe: number, earlyIm: number;
            if (first === 'A') {
              // A early on intermediate j (env slot a), B late on output s (env slot b)
              earlyRe = va.V.re[(j * eA + a) * d + i]!;
              earlyIm = va.V.im[(j * eA + a) * d + i]!;
              lateRe = vb.V.re[(s * eB + b) * d + j]!;
              lateIm = vb.V.im[(s * eB + b) * d + j]!;
            } else {
              // B early on intermediate j (env slot b), A late on output s (env slot a)
              earlyRe = vb.V.re[(j * eB + b) * d + i]!;
              earlyIm = vb.V.im[(j * eB + b) * d + i]!;
              lateRe = va.V.re[(s * eA + a) * d + j]!;
              lateIm = va.V.im[(s * eA + a) * d + j]!;
            }
            accRe += lateRe * earlyRe - lateIm * earlyIm;
            accIm += lateRe * earlyIm + lateIm * earlyRe;
          }
          const row = (s * eA + a) * eB + b;
          W.re[row * d + i] = accRe;
          W.im[row * d + i] = accIm;
        }
      }
    }
  }
  return W;
}

export interface SwitchIsometry {
  /** rows 2·d·eA·eB over dims [2, d, eA, eB]; cols 2·d over dims [2, d] */
  readonly M: CMat;
  readonly d: number;
  readonly eA: number;
  readonly eB: number;
  /** branch isometries (A first) and (B first), rows over [d, eA, eB] */
  readonly wAFirst: CMat;
  readonly wBFirst: CMat;
}

/**
 * The quantum switch isometry M — controlled routing, not a superposition
 * itself. Control bit 0 runs A-then-B, bit 1 runs B-then-A; the control
 * passes through untouched. Certificate: M†M = I.
 */
export function switchIsometry(va: Stinespring, vb: Stinespring): SwitchIsometry {
  if (va.d !== vb.d) throw new Error('target dimensions must match');
  const d = va.d;
  const eA = va.envDim;
  const eB = vb.envDim;
  const wAFirst = branchIsometry(va, vb, 'A');
  const wBFirst = branchIsometry(va, vb, 'B');
  const outRows = 2 * d * eA * eB;
  const M = mat(outRows, 2 * d);
  for (let c = 0; c < 2; c++) {
    const W = c === 0 ? wAFirst : wBFirst;
    for (let col = c * d; col < (c + 1) * d; col++) {
      for (let row = 0; row < d * eA * eB; row++) {
        const target = (c * d * eA * eB + row) * (2 * d) + col;
        // row < W.rows and (col - c*d) < d = W.cols by the loop bounds above
        M.re[target] = W.re[row * d + (col - c * d)]!;
        M.im[target] = W.im[row * d + (col - c * d)]!;
      }
    }
  }
  if (!matEq(mMul(mDagger(M), M), identity(2 * d), 1e-12)) {
    throw new Error('switch isometry failed M†M = I — construction bug');
  }
  return { M, d, eA, eB, wAFirst, wBFirst };
}

/** Apply an isometry W (R×C) to a density matrix on C dims: W ρ W†. */
export function applyIsometry(rho: CMat, W: CMat): CMat {
  return mMul(mMul(W, rho), mDagger(W));
}

export interface SwitchedChannel {
  readonly sw: SwitchIsometry;
  /** ρ on (c ⊗ S) → ρ on (c ⊗ S), environments traced out. */
  channel(rhoCS: CMat): CMat;
  /** Full output on (c ⊗ S ⊗ E_A ⊗ E_B) before tracing. */
  channelFull(rhoCS: CMat): CMat;
  /** Fixed order "A then B" on S: dims [d, eA, eB] → traced → [d]. */
  fixedAB(rhoS: CMat): CMat;
  /** Fixed order "B then A" on S. */
  fixedBA(rhoS: CMat): CMat;
}

/** Switched channel plus both definite-order reference channels. */
export function makeSwitchedChannel(va: Stinespring, vb: Stinespring): SwitchedChannel {
  const sw = switchIsometry(va, vb);
  const outDims = [2, sw.d, sw.eA, sw.eB] as const;
  return {
    sw,
    channelFull(rhoCS: CMat): CMat {
      return applyIsometry(rhoCS, sw.M);
    },
    channel(rhoCS: CMat): CMat {
      return partialTrace(applyIsometry(rhoCS, sw.M), outDims, [2, 3]);
    },
    fixedAB(rhoS: CMat): CMat {
      return partialTrace(applyIsometry(rhoS, sw.wAFirst), [sw.d, sw.eA, sw.eB], [1, 2]);
    },
    fixedBA(rhoS: CMat): CMat {
      return partialTrace(applyIsometry(rhoS, sw.wBFirst), [sw.d, sw.eA, sw.eB], [1, 2]);
    },
  };
}

/** Environment unitary freedom: V' = (I_d ⊗ U_E) V — same channel, new dilation. */
export function envUnitaryFreedom(st: Stinespring, U: CMat): Stinespring {
  if (U.rows !== st.envDim) throw new Error('environment unitary dimension mismatch');
  const full = mMul(kron(identity(st.d), U), st.V);
  const out: Stinespring = { d: st.d, envDim: st.envDim, V: full };
  assertStinespring(out);
  return out;
}

/** Dilation padding: V' = V ⊗ |0⟩ with one fresh unused environment qudit. */
export function padDilation(st: Stinespring, padDim: number): Stinespring {
  checkStinespringShape(st, 'padDilation');
  const e2 = st.envDim * padDim;
  const V2 = mat(st.d * e2, st.d);
  for (let row = 0; row < st.V.rows; row++) {
    const s = Math.floor(row / st.envDim);
    const m = row % st.envDim;
    const newRow = s * e2 + m * padDim; // fresh env digit 0
    for (let col = 0; col < st.d; col++) {
      V2.re[newRow * st.d + col] = st.V.re[row * st.d + col]!;
      V2.im[newRow * st.d + col] = st.V.im[row * st.d + col]!;
    }
  }
  const out: Stinespring = { d: st.d, envDim: e2, V: V2 };
  assertStinespring(out);
  return out;
}
