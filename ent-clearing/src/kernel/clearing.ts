/**
 * The clearing machinery of the entanglement standard — how the currency is
 * SPENT (teleportation burns the coin to deliver), QUOTED (dense coding
 * returns it as a catalyst), NETTED (a Procrustean filter nets a weak coin
 * at exactly 2*lambda_min), and why the desk can never MINT (local channels
 * do not raise entanglement of formation; one global gate mints C 0 -> 1).
 *
 * Every closed form below was hand-derived before being keyed in; the
 * witnesses re-derive the headline numbers from these constructions only.
 */
import {
  type CMat,
  type CVec,
  identity,
  kron,
  mAdd,
  mDagger,
  mMul,
  mScale,
  mat,
  outer,
  vAdd,
  vInner,
  vKron,
  vScale,
  eigenvaluesHermitian,
  sqrtPSD,
} from "../core/cmat.js";
import { applyKraus, applyUnitary, partialTrace } from "../core/channels.js";
import {
  KET0,
  KET1,
  PAULI_X,
  PAULI_Y,
  PAULI_Z,
  PLUS,
  maximallyMixed,
  randomStateVec,
  vecToRho,
} from "../core/states.js";
import type { Rng } from "../core/rng.js";
import { holevo, traceReal, vonNeumannEntropy, type EnsembleItem } from "../core/measures.js";

/* ------------------------------------------------------------------ */
/* The coin and the Bell basis                                         */
/* ------------------------------------------------------------------ */

/** The Bell basis in pairing order: [Phi+, Phi-, Psi+, Psi-]. */
export function bellBasis(): readonly CVec[] {
  const k00 = vKron(KET0, KET0);
  const k01 = vKron(KET0, KET1);
  const k10 = vKron(KET1, KET0);
  const k11 = vKron(KET1, KET1);
  const inv = 1 / Math.SQRT2;
  return [
    vScale(vAdd(k00, k11), inv),
    vScale(vAdd(k00, vScale(k11, -1)), inv),
    vScale(vAdd(k01, k10), inv),
    vScale(vAdd(k01, vScale(k10, -1)), inv),
  ];
}

/** Bell-basis projectors on two qubits. */
export function bellProjectors(): readonly CMat[] {
  return bellBasis().map((b) => outer(b, b));
}

/** Corrections paired with [Phi+, Phi-, Psi+, Psi-]: I, Z, X, XZ. */
export function corrections(): readonly CMat[] {
  return [identity(2), PAULI_Z, PAULI_X, mMul(PAULI_X, PAULI_Z)];
}

/** The standard coin: |Phi+><Phi+| as a 4x4 density matrix. */
export const PHI_PLUS: CMat = (() => {
  const b = bellBasis()[0] as CVec;
  return outer(b, b);
})();

/* ------------------------------------------------------------------ */
/* Wootters concurrence and entanglement of formation (2 qubits)       */
/* ------------------------------------------------------------------ */

/** Spin-flipped state: (Y (x) Y) rho* (Y (x) Y). */
function spinFlip(rho: CMat): CMat {
  const conj = {
    rows: rho.rows,
    cols: rho.cols,
    re: rho.re.slice(),
    im: rho.im.map((x) => -x),
  } as CMat;
  const yy = kron(PAULI_Y, PAULI_Y);
  return mMul(mMul(yy, conj), yy);
}

/** Wootters concurrence of a 2-qubit (possibly mixed) state. */
export function concurrence(rho: CMat): number {
  const sq = sqrtPSD(rho);
  const inner = mMul(mMul(sq, spinFlip(rho)), sq);
  const vals = Array.from(eigenvaluesHermitian(inner))
    .sort((a, b) => b - a)
    .map((x) => Math.max(0, x));
  const c = Math.sqrt(vals[0] as number) - Math.sqrt(vals[1] as number) - Math.sqrt(vals[2] as number) - Math.sqrt(vals[3] as number);
  return Math.max(0, c);
}

/** Binary entropy, path 1 (direct log2). */
export function h2(x: number): number {
  const a = Math.min(Math.max(x, 0), 1);
  let s = 0;
  if (a > 0) s -= a * Math.log2(a);
  if (a < 1) s -= (1 - a) * Math.log2(1 - a);
  return s;
}

/** Binary entropy, path 2 (natural log / ln 2) — the independent route. */
export function h2ViaLn(x: number): number {
  const a = Math.min(Math.max(x, 0), 1);
  let s = 0;
  if (a > 0) s -= a * Math.log(a);
  if (a < 1) s -= (1 - a) * Math.log(1 - a);
  return s / Math.LN2;
}

/** Entanglement of formation of a 2-qubit state from its concurrence. */
export function eF(rho: CMat): number {
  const c = concurrence(rho);
  return h2((1 + Math.sqrt(Math.max(0, 1 - c * c))) / 2);
}

/* ------------------------------------------------------------------ */
/* T1 — Redemption: teleportation burns the coin                       */
/* ------------------------------------------------------------------ */

export interface Redemption {
  /** B's qubit after the full settlement (correction applied): equals the payload. */
  readonly delivered: CMat;
  /** B's qubit BEFORE the classical leg settles: exactly I/2 for any payload. */
  readonly bobPreBits: CMat;
  /** The (A,B) pair after the settlement event: concurrence exactly 0. */
  readonly coinAfter: CMat;
}

/**
 * The full teleportation channel on (payload=1, A=2, B=3): A measures (1,2)
 * in the Bell basis, B applies the paired correction.
 */
export function redeem(payload: CMat): Redemption {
  const rho = kron(payload, PHI_PLUS); // q1 (x) (q2 q3)
  const proj = bellProjectors();
  const corr = corrections();
  let post = mat(8, 8);
  let out = mat(8, 8);
  for (let k = 0; k < 4; k++) {
    const P = kron(proj[k] as CMat, identity(2)); // acts on (q1 q2), identity on q3
    const term = mMul(mMul(P, rho), P);
    post = mAdd(post, term);
    const S = kron(identity(4), corr[k] as CMat); // correction on q3
    out = mAdd(out, mMul(mMul(S, term), mDagger(S)));
  }
  return {
    delivered: partialTrace(out, [2, 2, 2], [0, 1]),
    bobPreBits: partialTrace(post, [2, 2, 2], [0, 1]),
    coinAfter: partialTrace(post, [2, 2, 2], [0]),
  };
}

/* ------------------------------------------------------------------ */
/* T2 — Reverse quote: dense coding returns the coin                   */
/* ------------------------------------------------------------------ */

export interface DenseQuote {
  /** The four signal states (I, Z, X, XZ applied to A's half of the coin). */
  readonly signals: readonly CMat[];
  /** Decode probability matrix p[outcome | message]. */
  readonly decode: number[][];
  /** Mutual information (bits) between message and outcome under uniform messages. */
  readonly mutualInformation: number;
  /** Post-decode (A,B) state given the correct outcome: a known Bell pair. */
  readonly coinReturned: CMat;
}

export function denseCode(): DenseQuote {
  const proj = bellProjectors();
  const corr = corrections();
  const signals = corr.map((s) => {
    const U = kron(s, identity(2));
    return mMul(mMul(U, PHI_PLUS), mDagger(U));
  });
  const decode: number[][] = [];
  for (let k = 0; k < 4; k++) {
    const row: number[] = [];
    for (let j = 0; j < 4; j++) {
      const p = Math.max(0, traceReal(mMul(proj[j] as CMat, signals[k] as CMat)));
      row.push(p);
    }
    decode.push(row);
  }
  // I(M;Y) = H(Y) - H(Y|M) under uniform messages, with 0 log 0 = 0.
  const px: number[] = decode.map((row) => row.reduce((a, b) => a + b, 0) / 4);
  let hy = 0;
  for (const p of px) if (p > 1e-15) hy -= p * Math.log2(p);
  let hyGivenM = 0;
  for (let k = 0; k < 4; k++) {
    for (const p of decode[k] as number[]) if (p > 1e-15) hyGivenM -= (p / 4) * Math.log2(p);
  }
  const mutualInformation = hy - hyGivenM;
  // Post-decode state on the correct outcome: |B_k><B_k| (p = 1)
  const coinReturned = proj[0] as CMat;
  return { signals, decode, mutualInformation, coinReturned };
}

/* ------------------------------------------------------------------ */
/* T3 — Netting: the Procrustean filter                               */
/* ------------------------------------------------------------------ */

export interface Netting {
  /** Success probability of the filter. */
  readonly pSucc: number;
  /** The netted coin on success: exactly |Phi+>. */
  readonly successState: CMat;
  /** Failure branch: a worthless product state. */
  readonly failState: CMat;
  readonly pFail: number;
  /** Concurrence of the weak coin. */
  readonly weakConcurrence: number;
}

/**
 * Net a weak coin |psi> = sqrt(l0)|00> + sqrt(l1)|11> (l1 <= 1/2) to one
 * standard coin: local filter K_succ = diag(sqrt(l1/l0), 1) on B's half.
 * Success branch is exactly |Phi+>; p = 2*l1; failure leaves |00>.
 */
export function netWeakCoin(lambdaMin: number): Netting {
  if (lambdaMin <= 0 || lambdaMin > 0.5) throw new Error("lambdaMin must be in (0, 1/2]");
  const l0 = 1 - lambdaMin;
  const psi = vAdd(vScale(vKron(KET0, KET0), Math.sqrt(l0)), vScale(vKron(KET1, KET1), Math.sqrt(lambdaMin)));
  const rho = outer(psi, psi);
  const Ks = mat(2, 2);
  Ks.re[0] = Math.sqrt(lambdaMin / l0);
  Ks.re[3] = 1;
  const Kf = mat(2, 2);
  Kf.re[0] = Math.sqrt(Math.max(0, 1 - lambdaMin / l0));
  const succUn = applyKraus(rho, [kron(identity(2), Ks)]);
  const failUn = applyKraus(rho, [kron(identity(2), Kf)]);
  const pSucc = traceReal(succUn);
  const pFail = traceReal(failUn);
  return {
    pSucc,
    successState: mScale(succUn, 1 / pSucc),
    failState: mScale(failUn, 1 / pFail),
    pFail,
    weakConcurrence: 2 * Math.sqrt(l0 * lambdaMin),
  };
}

/* ------------------------------------------------------------------ */
/* T4 — The mint wall                                                 */
/* ------------------------------------------------------------------ */

/** A random local (single-side) qubit channel: Kraus rank 2, K0 scaled */
/** Ginibre, K1 = sqrt(I - K0^ K0). */
export function randomLocalKraus(rng: Rng): readonly CMat[] {
  const A = mat(2, 2);
  for (let k = 0; k < 4; k++) {
    A.re[k] = rng.normal();
    A.im[k] = rng.normal();
  }
  const adA = mMul(mDagger(A), A);
  const maxEig = Math.max(...Array.from(eigenvaluesHermitian(adA)));
  const s = maxEig > 1e-15 ? 0.9 / Math.sqrt(maxEig) : 1;
  const As = mScale(A, s);
  const rest = mAdd(identity(2), mScale(mMul(mDagger(As), As), -1));
  return [As, sqrtPSD(rest)];
}

/** Apply an independent random local channel to each side of a 2-qubit state. */
export function randomLocalRound(rng: Rng, rho: CMat): CMat {
  const ka = randomLocalKraus(rng);
  const kb = randomLocalKraus(rng);
  const sideA = applyKraus(rho, ka.map((k) => kron(k, identity(2))));
  return applyKraus(sideA, kb.map((k) => kron(identity(2), k)));
}

/** CNOT (control A, target B) as a 4x4 unitary. */
export const CNOT: CMat = (() => {
  const m = mat(4, 4);
  m.re[0] = 1; // |00> -> |00>
  m.re[5] = 1; // |01> -> |01>
  m.re[11] = 1; // |10> -> |11>
  m.re[14] = 1; // |11> -> |10>
  return m;
})();

/** The mint in one gate: CNOT on |+>|0> produces exactly |Phi+>. */
export function mintByGate(): CMat {
  const plusRho = outer(PLUS, PLUS);
  const zeroRho = outer(KET0, KET0);
  return applyUnitary(kron(plusRho, zeroRho), CNOT);
}

/* ------------------------------------------------------------------ */
/* No-coin floor: the tetrahedron ensemble and its Holevo chi          */
/* ------------------------------------------------------------------ */

function blochState(r: readonly [number, number, number]): CMat {
  const m = mScale(
    mAdd(identity(2), mAdd(mScale(PAULI_X, r[0]), mAdd(mScale(PAULI_Y, r[1]), mScale(PAULI_Z, r[2])))),
    0.5,
  );
  return m;
}

/** The tetrahedron ensemble: 4 pure qubit states averaging to exactly I/2. */
export function tetrahedron(): readonly CMat[] {
  const s = 1 / Math.sqrt(3);
  return [
    blochState([s, s, s]),
    blochState([s, -s, -s]),
    blochState([-s, s, -s]),
    blochState([-s, -s, s]),
  ];
}

/** chi(tetrahedron) on two paths: eigenvalue entropy of the average state. */
export function tetrahedronChi(): { chi: number; avgIsMixed: number } {
  const states = tetrahedron();
  const items: EnsembleItem[] = states.map((st, i) => ({ key: `t${i}`, state: st, weight: 1 / 4 }));
  const chi = holevo(items);
  const avg = mScale(
    states.reduce((acc, s) => mAdd(acc, s)),
    1 / 4,
  );
  const eig = Array.from(eigenvaluesHermitian(avg));
  const worst = Math.max(...eig.map((l) => Math.abs(l - 0.5)));
  return { chi, avgIsMixed: worst };
}

/** Entropy of the maximally mixed qubit, computed from its eigenvalues. */
export function entropyOfMixedQubit(): number {
  return vonNeumannEntropy(maximallyMixed(2));
}

/* ------------------------------------------------------------------ */
/* Census states                                                       */
/* ------------------------------------------------------------------ */

/** Fidelity of rho to a PURE reference |phi>: <phi|rho|phi> — exact linear */
/** algebra, no eigensolver (the Uhlmann route carries ~1e-8 eigenvector */
/** noise on rank-deficient states; pure references deserve the exact route). */
export function pureFidelity(rho: CMat, phi: CVec): number {
  const n = phi.n;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let sr = 0;
    let si = 0;
    for (let j = 0; j < n; j++) {
      const rr = rho.re[i * n + j]!;
      const ii = rho.im[i * n + j]!;
      sr += rr * phi.re[j]! - ii * phi.im[j]!;
      si += rr * phi.im[j]! + ii * phi.re[j]!;
    }
    re[i] = sr;
    im[i] = si;
  }
  const br = vInner(phi, { n, re, im });
  return br.re;
}

/** Random mixed 2-qubit state: (1-t)|psi><psi| + t I/4. */
export function randomMixedPair(rng: Rng): CMat {
  const psi = randomStateVec(rng, 4);
  const t = rng();
  return mAdd(mScale(vecToRho(psi), 1 - t), mScale(maximallyMixed(4), t));
}

/** Random mixed single-qubit state: (1-t)|psi><psi| + t I/2. */
export function randomMixedQubit(rng: Rng): CMat {
  const psi = randomStateVec(rng, 2);
  const t = rng();
  return mAdd(mScale(vecToRho(psi), 1 - t), mScale(maximallyMixed(2), t));
}
