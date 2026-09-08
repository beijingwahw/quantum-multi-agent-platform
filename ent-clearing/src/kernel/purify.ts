/**
 * The purification desk — mixed-coin netting at bounded exact scale, the face
 * v0.1.0 only quoted (BBPS96, asymptotic). What executes here is the
 * recurrence round of that paper: a bilateral CNOT between the two coins,
 * the sacrifice pair measured in the computational basis, the source kept
 * when the two outcomes AGREE. n = 2, 3, 4 input coins are netted exactly
 * (16x16 density matrices, no sampling); the BBPS96 asymptotic hashing line
 * stays quoted, and the gap between the executed yields and that line is
 * reported as data, not smoothed over.
 *
 * Every closed form below was hand-derived before being keyed in; the
 * witnesses re-derive the headline numbers from these constructions only.
 */
import {
  type CMat,
  type CVec,
  at4,
  kron,
  mAdd,
  mMul,
  mScale,
  mat,
  vInner,
} from "../core/cmat.js";
import { applyKraus, applyUnitary, depolarize, filterBasisDigit, partialTrace } from "../core/channels.js";
import { shannonBits, traceReal } from "../core/measures.js";
import { bellProjectors, concurrence, eF, PHI_PLUS } from "./clearing.js";

/* ------------------------------------------------------------------ */
/* Mixed coin families                                                 */
/* ------------------------------------------------------------------ */

/** A Bell-diagonal coin from its weights [Phi+, Phi-, Psi+, Psi-]. */
export function bellDiagonal(w: readonly number[]): CMat {
  if (w.length !== 4) {
    throw new Error(`EC_WEIGHTS: bellDiagonal needs exactly 4 Bell weights [Phi+, Phi-, Psi+, Psi-], got ${w.length}`);
  }
  const proj = bellProjectors();
  let acc = mScale(proj[0], w[0]!);
  for (let k = 1; k < 4; k++) acc = mAdd(acc, mScale(at4(proj, k, "bellProjector"), w[k]!));
  return acc;
}

/** Werner coin W_F: fidelity F on |Phi+>, remaining weight uniform on the
 *  other three Bell states — the mixed coin the desk nets. */
export function wernerCoin(F: number): CMat {
  if (F <= 0 || F >= 1) throw new Error(`EC_F_RANGE: wernerCoin needs F in (0,1), got ${F}`);
  const g = (1 - F) / 3;
  return bellDiagonal([F, g, g, g]);
}

/** A standard coin sent through a depolarizing wire at parameter p:
 *  (1-p)|Phi+><Phi+| + p I/4 — machine-identical to W_{1-3p/4}. */
export function depolCoin(p: number): CMat {
  if (p < 0 || p > 1) throw new Error(`EC_P_RANGE: depolCoin needs p in [0,1], got ${p}`);
  return depolarize(PHI_PLUS, p);
}

/** Bell-basis weights [Phi+, Phi-, Psi+, Psi-] of a two-qubit state. */
export function bellWeights(rho: CMat): readonly number[] {
  return bellProjectors().map((P) => traceReal(mMul(P, rho)));
}

/** Fidelity of a two-qubit state to |Phi+> = its Phi+ Bell weight. */
export function bellFidelity(rho: CMat): number {
  return traceReal(mMul(bellProjectors()[0], rho));
}

/* ------------------------------------------------------------------ */
/* The bilateral round                                                 */
/* ------------------------------------------------------------------ */

/** CNOT on an n-qubit register (qubit 0 is the leftmost tensor factor):
 *  a permutation unitary, |x> -> |x XOR e_target> when the control bit is 1. */
export function cnotOnQubits(nQubits: number, control: number, target: number): CMat {
  if (nQubits < 2) throw new Error(`EC_QUBITS: cnotOnQubits needs >= 2 qubits, got ${nQubits}`);
  if (control < 0 || control >= nQubits || target < 0 || target >= nQubits) {
    throw new Error(`EC_INDEX: cnotOnQubits control ${control} / target ${target} out of range for ${nQubits} qubits`);
  }
  if (control === target) throw new Error("EC_INDEX: cnotOnQubits needs control !== target");
  const d = 1 << nQubits;
  const strides: number[] = new Array<number>(nQubits);
  strides[nQubits - 1] = 1;
  for (let i = nQubits - 2; i >= 0; i--) strides[i] = strides[i + 1]! * 2;
  const m = mat(d, d);
  for (let col = 0; col < d; col++) {
    const digits: number[] = new Array<number>(nQubits);
    let c = col;
    for (let i = 0; i < nQubits; i++) {
      digits[i] = Math.floor(c / strides[i]!);
      c %= strides[i]!;
    }
    let row = col;
    if (digits[control] === 1) row = col ^ (1 << (nQubits - 1 - target));
    m.re[row * d + col] = 1;
  }
  return m;
}

export interface PurifyRound {
  /** Probability the two measurement outcomes agree (the keep branch). */
  readonly pSucc: number;
  /** The kept source pair, conditional on agreement: 4x4. */
  readonly successState: CMat;
  readonly pFail: number;
  /** The discarded source pair, conditional on disagreement: 4x4. */
  readonly failState: CMat;
}

/**
 * One BBPSSW recurrence round on registers (A1, B1, A2, B2): bilateral CNOT
 * A1->A2 and B1->B2, then both parties measure their A2/B2 qubit in the
 * computational basis and keep the source pair iff the outcomes agree.
 * `source` is the pair kept; `target` is the pair sacrificed.
 */
export function purifyRound(source: CMat, target: CMat): PurifyRound {
  const dims = [2, 2, 2, 2];
  const rho = kron(source, target);
  const u = mMul(cnotOnQubits(4, 1, 3), cnotOnQubits(4, 0, 2));
  const after = applyUnitary(rho, u);
  const s0 = filterBasisDigit(after, dims, 2, 0); // A2 = 0
  const s1 = filterBasisDigit(after, dims, 2, 1); // A2 = 1
  const s00 = filterBasisDigit(s0.conditional, dims, 3, 0);
  const s11 = filterBasisDigit(s1.conditional, dims, 3, 1);
  const f01 = filterBasisDigit(s0.conditional, dims, 3, 1);
  const f10 = filterBasisDigit(s1.conditional, dims, 3, 0);
  const pSucc = s0.p * s00.p + s1.p * s11.p;
  const pFail = s0.p * f01.p + s1.p * f10.p;
  if (pSucc <= 1e-12 || pFail <= 1e-12) throw new Error(`EC_ZERO_BRANCH: purifyRound hit a probability-zero branch (pSucc ${pSucc}, pFail ${pFail}) — dividing would smuggle NaN`);
  const succUn = mAdd(mScale(s00.conditional, s0.p * s00.p), mScale(s11.conditional, s1.p * s11.p));
  const failUn = mAdd(mScale(f01.conditional, s0.p * f01.p), mScale(f10.conditional, s1.p * f10.p));
  return {
    pSucc,
    successState: mScale(partialTrace(succUn, dims, [2, 3]), 1 / pSucc),
    pFail,
    failState: mScale(partialTrace(failUn, dims, [2, 3]), 1 / pFail),
  };
}

/* ------------------------------------------------------------------ */
/* Closed forms (hand-derived; the machine must agree to 1e-12)        */
/* ------------------------------------------------------------------ */

/**
 * BBPSSW Werner recurrence, hand-derived from the Bell-label XOR calculus.
 * With g = (1-F)/3: p = (F+g)^2 + (2g)^2 = F^2 + 2F(1-F)/3 + 5(1-F)^2/9 and
 * F' = (F^2 + g^2)/p. Improvement (F' > F) exactly iff F > 1/2.
 */
export function wernerRoundClosedForm(F: number): { pSucc: number; fidelityOut: number } {
  const g = (1 - F) / 3;
  const pSucc = F * F + 2 * F * (1 - F) / 3 + 5 * (1 - F) * (1 - F) / 9;
  const fidelityOut = (F * F + g * g) / pSucc;
  return { pSucc, fidelityOut };
}

/**
 * The general Bell-diagonal round in XOR calculus. Bell labels (x,z) with
 * x = 0 for Phi's, 1 for Psi's: the bilateral CNOT copies the source's
 * bit-label onto the target's and the target's phase-label onto the source's
 * (x_s kept, z_s -> z_s XOR z_t; x_t -> x_t XOR x_s, z_t kept). Agreement
 * means the measured target has x_t XOR x_s = 0, so
 *   p = (l1+l2)(m1+m2) + (l3+l4)(m3+m4),
 *   out = [l1m1+l2m2, l1m2+l2m1, l3m3+l4m4, l3m4+l4m3] / p.
 */
export function bellRoundClosedForm(
  lam: readonly number[],
  mu: readonly number[],
): { pSucc: number; out: readonly number[] } {
  if (lam.length !== 4 || mu.length !== 4) {
    throw new Error(`EC_WEIGHTS: bellRoundClosedForm needs two 4-weight Bell spectra, got ${lam.length}/${mu.length}`);
  }
  const pSucc = (lam[0]! + lam[1]!) * (mu[0]! + mu[1]!) + (lam[2]! + lam[3]!) * (mu[2]! + mu[3]!);
  const out = [
    (lam[0]! * mu[0]! + lam[1]! * mu[1]!) / pSucc,
    (lam[0]! * mu[1]! + lam[1]! * mu[0]!) / pSucc,
    (lam[2]! * mu[2]! + lam[3]! * mu[3]!) / pSucc,
    (lam[2]! * mu[3]! + lam[3]! * mu[2]!) / pSucc,
  ];
  return { pSucc, out };
}

/* ------------------------------------------------------------------ */
/* Bounded-scale schemes: n = 2, 3, 4 coins                            */
/* ------------------------------------------------------------------ */

/** The six Pauli-axis states (+/-x, +/-y, +/-z). */
function axisStates(): readonly CVec[] {
  const inv = 1 / Math.SQRT2;
  return [
    { n: 2, re: Float64Array.from([1, 0]), im: new Float64Array(2) },
    { n: 2, re: Float64Array.from([0, 1]), im: new Float64Array(2) },
    { n: 2, re: Float64Array.from([inv, inv]), im: new Float64Array(2) },
    { n: 2, re: Float64Array.from([inv, -inv]), im: new Float64Array(2) },
    { n: 2, re: Float64Array.from([inv, 0]), im: Float64Array.from([0, inv]) },
    { n: 2, re: Float64Array.from([inv, 0]), im: Float64Array.from([0, -inv]) },
  ];
}

/**
 * The 24-element single-qubit Clifford group: every unitary whose columns
 * are orthogonal Pauli-axis states, the second column carried through the
 * phases {1, i, -1, i}. (U (x) U*) kills the global phase, so one
 * representative per phase class suffices.)
 */
export function cliffords(): readonly CMat[] {
  const out: CMat[] = [];
  const phases: ReadonlyArray<{ re: number; im: number }> = [
    { re: 1, im: 0 },
    { re: 0, im: 1 },
    { re: -1, im: 0 },
    { re: 0, im: -1 },
  ];
  for (const c1 of axisStates()) {
    for (const c2 of axisStates()) {
      for (const ph of phases) {
        const c2p: CVec = {
          n: 2,
          re: new Float64Array([c2.re[0]! * ph.re - c2.im[0]! * ph.im, c2.re[1]! * ph.re - c2.im[1]! * ph.im]),
          im: new Float64Array([c2.re[0]! * ph.im + c2.im[0]! * ph.re, c2.re[1]! * ph.im + c2.im[1]! * ph.re]),
        };
        if (Math.abs(vInner(c1, c2p).re) > 1e-12 || Math.abs(vInner(c1, c2p).im) > 1e-12) continue; // columns must be orthogonal (both parts)
        const m = mat(2, 2);
        m.re[0] = c1.re[0]!;
        m.im[0] = c1.im[0]!;
        m.re[1] = c1.re[1]!;
        m.im[1] = c1.im[1]!;
        m.re[2] = c2p.re[0]!;
        m.im[2] = c2p.im[0]!;
        m.re[3] = c2p.re[1]!;
        m.im[3] = c2p.im[1]!;
        out.push(m);
      }
    }
  }
  return out;
}

/**
 * The BBPSSW depolarizing step, executed exactly: the isotropic twirl
 * (1/24) Σ_k (U_k (x) U_k*) ρ (U_k (x) U_k*)† over the local Clifford group —
 * the finite exact form of the paper's random bilateral rotations on
 * Bell-diagonal coins (|Phi+> is a fixed point of every U (x) U*; the triplet
 * {Phi-, Psi+, Psi-} is averaged uniformly, so any Bell-diagonal coin maps to
 * the Werner coin of the SAME Phi+ fidelity). A draws U_k, applies it, sends
 * the index; B applies U_k*. The step is load-bearing: without it the round's
 * output concentrates its error in the phase slot and the NEXT raw round
 * DEGRADES the coin (machine-measured honest negative, witness W-G).
 */
export function bellTwirl(rho: CMat): CMat {
  const group = cliffords();
  const kraus = group.map((u) => {
    const ustar: CMat = { rows: 2, cols: 2, re: u.re, im: u.im.map((x) => -x) };
    return mScale(kron(u, ustar), 1 / Math.sqrt(group.length));
  });
  return applyKraus(rho, kraus);
}

export interface SchemeResult {
  /** Input coins committed to the scheme. */
  readonly n: number;
  /** Probability the chain delivers one purified coin. */
  readonly pSucc: number;
  /** The delivered coin (conditional on the full chain succeeding): Werner. */
  readonly finalState: CMat;
  readonly rounds: number;
  readonly fidelityIn: number;
  readonly fidelityOut: number;
  readonly cOut: number;
  readonly efOut: number;
  /** E_F of one input coin (the give column of the yield accounting). */
  readonly efIn: number;
  /** Expected E_F delivered per input coin: pSucc * E_F(out) / n. */
  readonly efYield: number;
  /** Expected standard-coin equivalents per input coin: pSucc / n. */
  readonly coinYield: number;
}

/**
 * The bounded-scale netting schemes, one per face of the census — each round
 * is the full BBPSSW step (bilateral CNOT round, then the survivor twirled
 * back to a Werner coin):
 *   n=2 — one round: coin 1 kept, coin 2 sacrificed;
 *   n=3 — sequential: round 1 on (1,2), the twirled survivor kept and the
 *         banked coin 3 sacrificed in round 2;
 *   n=4 — nested: two independent rounds, then their twirled survivors
 *         netted against each other.
 * Every probability is a product of exactly-executed round probabilities.
 */
export function schemePurify(nCoins: number, coin: CMat): SchemeResult {
  if (nCoins !== 2 && nCoins !== 3 && nCoins !== 4) {
    throw new Error(`EC_SCALE: schemePurify executes n in {2,3,4} only — got ${nCoins} (the asymptotic scale is quoted, never executed)`);
  }
  const r1 = purifyRound(coin, coin);
  const t1 = bellTwirl(r1.successState);
  if (nCoins === 2) {
    return finish(2, r1.pSucc, t1, 1, coin);
  }
  if (nCoins === 3) {
    const r2 = purifyRound(t1, coin);
    return finish(3, r1.pSucc * r2.pSucc, bellTwirl(r2.successState), 2, coin);
  }
  const r2 = purifyRound(t1, t1);
  return finish(4, r1.pSucc * r1.pSucc * r2.pSucc, bellTwirl(r2.successState), 3, coin);
}

function finish(n: number, pSucc: number, out: CMat, rounds: number, coin: CMat): SchemeResult {
  const efOut = eF(out);
  const efIn = eF(coin);
  return {
    n,
    pSucc,
    finalState: out,
    rounds,
    fidelityIn: bellFidelity(coin),
    fidelityOut: bellFidelity(out),
    cOut: concurrence(out),
    efOut,
    efIn,
    efYield: (pSucc * efOut) / n,
    coinYield: pSucc / n,
  };
}

/* ------------------------------------------------------------------ */
/* The quoted asymptotic line (BBPS96 hashing)                         */
/* ------------------------------------------------------------------ */

/**
 * The BBPS96 hashing lower bound on the asymptotic distillation rate of a
 * Bell-diagonal coin: R >= 1 - H(lambda). QUOTED with the citation, never
 * executed here — it is the n -> infinity line the bounded yields are
 * reported against, not a number this desk has produced.
 */
function hashingLineBell(lam: readonly number[]): number {
  return 1 - shannonBits(lam);
}

/** The line for a Werner coin: R(F) = 1 + F log2 F + (1-F) log2((1-F)/3). */
export function hashingLineWerner(F: number): number {
  const g = (1 - F) / 3;
  return hashingLineBell([F, g, g, g]);
}

/** The Werner fidelity behind a family/param pair — the single source for
 * the WERNER F vs DEPOL p mapping (checker, renderer, and tests agree). */
export function wernerFOfFamily(family: "WERNER" | "DEPOL", param: number): number {
  return family === "WERNER" ? param : 1 - (3 * param) / 4;
}

/* ------------------------------------------------------------------ */
/* The yield table — keyed claims, machine-recomputed by the checker   */
/* ------------------------------------------------------------------ */

export interface YieldRow {
  readonly id: string;
  readonly family: "WERNER" | "DEPOL";
  /** 2 | 3 | 4 for EXECUTED rows; the asymptotic scale for QUOTED rows. */
  readonly scale: number;
  /** Werner fidelity F, or the depolarizing parameter p for DEPOL. */
  readonly param: number;
  readonly tag: "EXECUTED" | "QUOTED";
  readonly pSucc: number;
  readonly fidelityOut: number;
  readonly coinYield: number;
  readonly efYield: number;
  readonly cOut: number;
  readonly efOut: number;
  /** required for QUOTED rows */
  readonly citation?: string;
}

/** The coin a family/param pair hands the desk. */
export function familyCoin(family: "WERNER" | "DEPOL", param: number): CMat {
  return family === "WERNER" ? wernerCoin(param) : depolCoin(param);
}

/**
 * The purification desk's yield census, keyed from actual runs and
 * recomputed row by row by the checker (law H6). EXECUTED rows are bounded
 * scale (n <= 4); QUOTED rows are BBPS96's asymptotic hashing line — the
 * comparison line, never claimed as machine output. Note the honest
 * negatives: at F = 0.45 the round DEGRADES the coin (below the F > 1/2
 * threshold), and the hashing line is negative below F ~ 0.81 (no
 * asymptotic distillation at that grade at all).
 */
export const YIELD_TABLE: readonly YieldRow[] = [
  { id: "Y-W45-2", family: "WERNER", scale: 2, param: 0.45, tag: "EXECUTED", pSucc: 0.535555555556, fidelityOut: 0.440871369295, coinYield: 0.267777777778, efYield: 0.0, cOut: 0.0, efOut: 0.0 },
  { id: "Y-W55-2", family: "WERNER", scale: 2, param: 0.55, tag: "EXECUTED", pSucc: 0.58, fidelityOut: 0.560344827586, coinYield: 0.29, efYield: 0.010107312049, cOut: 0.120689655172, efOut: 0.034852800168 },
  { id: "Y-W55-3", family: "WERNER", scale: 3, param: 0.55, tag: "EXECUTED", pSucc: 0.338, fidelityOut: 0.566568047337, coinYield: 0.112666666667, efYield: 0.004639355893, cOut: 0.133136094675, efOut: 0.041177715028 },
  { id: "Y-W55-4", family: "WERNER", scale: 4, param: 0.55, tag: "EXECUTED", pSucc: 0.197, fidelityOut: 0.572842639594, coinYield: 0.04925, efYield: 0.002361701099, cOut: 0.145685279188, efOut: 0.04795332181 },
  { id: "Y-W65-2", family: "WERNER", scale: 2, param: 0.65, tag: "EXECUTED", pSucc: 0.642222222222, fidelityOut: 0.679065743945, coinYield: 0.321111111111, efYield: 0.067440102259, cOut: 0.358131487889, efOut: 0.210021079699 },
  { id: "Y-W65-3", family: "WERNER", scale: 3, param: 0.65, tag: "EXECUTED", pSucc: 0.419086419753, fidelityOut: 0.695531137689, coinYield: 0.139695473251, efYield: 0.033730393799, cOut: 0.391062275379, efOut: 0.241456598512 },
  { id: "Y-W65-4", family: "WERNER", scale: 4, param: 0.65, tag: "EXECUTED", pSucc: 0.273718792867, fidelityOut: 0.712092502293, coinYield: 0.068429698217, efYield: 0.018779471643, cOut: 0.424185004586, efOut: 0.274434523784 },
  { id: "Y-W75-2", family: "WERNER", scale: 2, param: 0.75, tag: "EXECUTED", pSucc: 0.722222222222, fidelityOut: 0.788461538462, coinYield: 0.361111111111, efYield: 0.159535454455, cOut: 0.576923076923, efOut: 0.44179048926 },
  { id: "Y-W75-3", family: "WERNER", scale: 3, param: 0.75, tag: "EXECUTED", pSucc: 0.533950617284, fidelityOut: 0.807803468208, coinYield: 0.177983539095, efYield: 0.086793584423, cOut: 0.615606936416, efOut: 0.487649503234 },
  { id: "Y-W75-4", family: "WERNER", scale: 4, param: 0.75, tag: "EXECUTED", pSucc: 0.395233196159, fidelityOut: 0.827006507592, coinYield: 0.09880829904, efYield: 0.052802578303, cOut: 0.654013015184, efOut: 0.534394163409 },
  { id: "Y-W85-2", family: "WERNER", scale: 2, param: 0.85, tag: "EXECUTED", pSucc: 0.82, fidelityOut: 0.884146341463, coinYield: 0.41, efYield: 0.278787317848, cOut: 0.768292682927, efOut: 0.679969067921 },
  { id: "Y-W85-3", family: "WERNER", scale: 3, param: 0.85, tag: "EXECUTED", pSucc: 0.687333333333, fidelityOut: 0.89888457808, coinYield: 0.229111111111, efYield: 0.164720621533, cOut: 0.797769156159, efOut: 0.718955186129 },
  { id: "Y-W85-4", family: "WERNER", scale: 4, param: 0.85, tag: "EXECUTED", pSucc: 0.576555555556, fidelityOut: 0.913403353247, coinYield: 0.144138888889, efYield: 0.109241592464, cOut: 0.826806706495, efOut: 0.757891179165 },
  { id: "Y-W95-2", family: "WERNER", scale: 2, param: 0.95, tag: "EXECUTED", pSucc: 0.935555555556, fidelityOut: 0.964964370546, coinYield: 0.467777777778, efYield: 0.421057700615, cOut: 0.929928741093, efOut: 0.900123350483 },
  { id: "Y-W95-3", family: "WERNER", scale: 3, param: 0.95, tag: "EXECUTED", pSucc: 0.883975308642, fidelityOut: 0.97041283763, coinYield: 0.294658436214, efYield: 0.269757425099, cOut: 0.94082567526, efOut: 0.915491945744 },
  { id: "Y-W95-4", family: "WERNER", scale: 4, param: 0.95, tag: "EXECUTED", pSucc: 0.835331961591, fidelityOut: 0.975812167362, coinYield: 0.208832990398, efYield: 0.194378094379, cOut: 0.951624334723, efOut: 0.930782507152 },
  { id: "Y-D10-2", family: "DEPOL", scale: 2, param: 0.1, tag: "EXECUTED", pSucc: 0.905, fidelityOut: 0.946132596685, coinYield: 0.4525, efYield: 0.38348877666, cOut: 0.89226519337, efOut: 0.847489009192 },
  { id: "Y-D10-3", family: "DEPOL", scale: 3, param: 0.1, tag: "EXECUTED", pSucc: 0.8305, fidelityOut: 0.954169175196, coinYield: 0.276833333333, efYield: 0.240805631957, cOut: 0.908338350391, efOut: 0.869857791536 },
  { id: "Y-D10-4", family: "DEPOL", scale: 4, param: 0.1, tag: "EXECUTED", pSucc: 0.7623125, fidelityOut: 0.962109535132, coinYield: 0.190578125, efYield: 0.170013879467, cOut: 0.924219070263, efOut: 0.892095456745 },
  { id: "Y-D20-2", family: "DEPOL", scale: 2, param: 0.2, tag: "EXECUTED", pSucc: 0.82, fidelityOut: 0.884146341463, coinYield: 0.41, efYield: 0.278787317848, cOut: 0.768292682927, efOut: 0.679969067921 },
  { id: "Y-D20-3", family: "DEPOL", scale: 3, param: 0.2, tag: "EXECUTED", pSucc: 0.687333333333, fidelityOut: 0.89888457808, coinYield: 0.229111111111, efYield: 0.164720621533, cOut: 0.797769156159, efOut: 0.718955186129 },
  { id: "Y-D20-4", family: "DEPOL", scale: 4, param: 0.2, tag: "EXECUTED", pSucc: 0.576555555556, fidelityOut: 0.913403353247, coinYield: 0.144138888889, efYield: 0.109241592464, cOut: 0.826806706495, efOut: 0.757891179165 },
  { id: "Y-H55", family: "WERNER", scale: Number.POSITIVE_INFINITY, param: 0.55, tag: "QUOTED", pSucc: 1, fidelityOut: 1, coinYield: -0.706007579312, efYield: -0.706007579312, cOut: 1, efOut: 1, citation: "BBPS96" },
  { id: "Y-H65", family: "WERNER", scale: Number.POSITIVE_INFINITY, param: 0.65, tag: "QUOTED", pSucc: 1, fidelityOut: 1, coinYield: -0.488804930628, efYield: -0.488804930628, cOut: 1, efOut: 1, citation: "BBPS96" },
  { id: "Y-H75", family: "WERNER", scale: Number.POSITIVE_INFINITY, param: 0.75, tag: "QUOTED", pSucc: 1, fidelityOut: 1, coinYield: -0.207518749639, efYield: -0.207518749639, cOut: 1, efOut: 1, citation: "BBPS96" },
  { id: "Y-H85", family: "WERNER", scale: Number.POSITIVE_INFINITY, param: 0.85, tag: "QUOTED", pSucc: 1, fidelityOut: 1, coinYield: 0.152415320175, efYield: 0.152415320175, cOut: 1, efOut: 1, citation: "BBPS96" },
  { id: "Y-H95", family: "WERNER", scale: Number.POSITIVE_INFINITY, param: 0.95, tag: "QUOTED", pSucc: 1, fidelityOut: 1, coinYield: 0.634354917848, efYield: 0.634354917848, cOut: 1, efOut: 1, citation: "BBPS96" },
];
