/**
 * T1-N · the spectral criterion for DSIC under readout noise (v0.5.0).
 *
 * The T1 setting (mech/dsic.ts) reads the report register in the codeword
 * basis through an IDEAL channel. This module executes the noisy version:
 * the register passes through an arbitrary CPTP noise map N (Kraus {K_j})
 * AFTER the agent submits sigma and BEFORE the mechanism measures {|r>}:
 *
 * (T1N-a) affine noise form: U_N(sigma) = Tr[B sigma] with the Hermitian
 *   utility observable B = sum_r u(r) * N^dagger(|r><r|). The effects
 *   A_r = N^dagger(|r><r|) form a POVM (sum_r A_r = N^dagger(I) = I for
 *   trace-preserving N) — so the noisy readout is itself a generalized
 *   measurement and expected utility stays affine in sigma.
 *
 * (T1N-b) collapse of the quantum search: max over ALL density matrices of
 *   U_N = lambda_max(B) (Rayleigh-Ritz: a Hermitian linear functional on the
 *   convex compact set of states tops out at the top eigenvector). The full
 *   quantum-deviation search — the codewords + random pure states + mixtures
 *   battery of quantumBestGain — collapses to ONE eigendecomposition.
 *
 * (T1N-c) sandwich: lambda_max(B) <= max_r u(r). The readout distribution
 *   p(r|sigma) = Tr[A_r sigma] is a probability distribution, so no state
 *   can extract more than the best codeword's utility. Noise cannot
 *   manufacture utility; it can only redirect it.
 *
 * (T1N-d) zero-noise slice: N = id gives A_r = |r><r|, B diagonal, and
 *   lambda_max = max_r u(r) — the classical optimum. The original T1 is the
 *   identity slice of this theorem.
 *
 * (T1N-e) the criterion and its census: DSIC against quantum deviations
 *   under noise ⟺ lambda_max(B) <= U_N(truthful codeword) — one eigenvalue
 *   versus one utility evaluation. The gain decomposes EXACTLY as
 *     lambda_max - U_N(truth)
 *       = [lambda_max - max_i U_N(codeword i)]   (coherence advantage)
 *       + [max_i U_N(codeword i) - U_N(truth)]   (classical noisy-grid incentive)
 *   For every channel whose effects A_r are diagonal (phase flip, amplitude
 *   damping, depolarizing, reset damping, parity flip) the coherence
 *   advantage is 0: no quantum state beats the best noisy codeword. For a
 *   unitary rotation channel it is positive wherever the rotation angle is:
 *   the agent PRE-COMPENSATES the known noise (submits U^dagger|best> so the
 *   channel itself rotates it onto the best codeword) and DSIC breaks even
 *   on instances that are classically DSIC at every grid point. The census
 *   below machine-decides this on the {phaseFlip, ampDamp, depol, resetDamp,
 *   parityFlip, rotation} x gamma x instance grid.
 *
 * Literature anchors: revelation-principle family and the repo's own T1
 * (docs/theory.md §T1); POVM readout of a noisy register and Rayleigh-Ritz
 * on Hermitian observables are textbook material — Nielsen & Chuang
 * "Quantum Computation and Quantum Information" (POVM/generalized
 * measurement chapters) and Horn & Johnson "Matrix Analysis" (Rayleigh
 * quotient extremal characterization) 〔待双源〕.
 */

import {
  type CMat,
  eigHermitian,
  isHermitian,
  mAdd,
  mDagger,
  mMul,
  mScale,
  mat,
  matEq,
  identity,
} from "../core/cmat.js";
import {
  applyKraus,
  amplitudeDampKraus,
  phaseFlipKraus,
} from "../core/channels.js";
import { type AuctionKind, utilityOf } from "../mech/auctions.js";

/** Channel families of the census. Qubit-native families (phaseFlip, ampDamp,
 * rotation) act on k = 2 report registers; the k-level families (depol,
 * resetDamp, parityFlip) act on any k >= 2. */
export type NoisyChannelName =
  "phaseFlip" | "ampDamp" | "depol" | "resetDamp" | "parityFlip" | "rotation";

function checkGamma(fn: string, gamma: number): void {
  if (!Number.isFinite(gamma) || gamma < 0 || gamma > 1) {
    throw new Error(`${fn}: gamma must lie in [0,1], got ${gamma}`);
  }
}

/** Kraus operators of the named channel at strength gamma on the k-level
 * report register. rotation maps gamma to the rotation angle theta =
 * gamma*pi/2 of the real rotation U = [[cos, -sin], [sin, cos]] (gamma = 1
 * is the Hadamard channel up to a final Z conjugation — identical spectra,
 * see the H-equivalence test). */
export function noisyChannelKraus(
  name: NoisyChannelName,
  gamma: number,
  k: number,
): CMat[] {
  checkGamma(`T1N01-${name}`, gamma);
  if (!Number.isInteger(k) || k < 2) {
    throw new Error(
      `T1N02-bad-k: report register needs integer k >= 2 levels, got ${k}`,
    );
  }
  const qubitOnly =
    name === "phaseFlip" || name === "ampDamp" || name === "rotation";
  if (qubitOnly && k !== 2) {
    throw new Error(
      `T1N03-qubit-family: ${name} is a qubit channel, needs k = 2, got k = ${k}`,
    );
  }
  switch (name) {
    case "phaseFlip":
      return phaseFlipKraus(gamma);
    case "ampDamp":
      return amplitudeDampKraus(gamma);
    case "rotation": {
      // half-angle convention: U = R_y(theta) with theta = gamma*pi/2, i.e.
      // [[cos(theta/2), -sin(theta/2)], [sin(theta/2), cos(theta/2)]] —
      // gamma = 1 is theta = pi/2, the Hadamard channel up to a final Z
      // conjugation (identical spectra; see the H-equivalence test)
      const u = mat(2, 2);
      const c = Math.cos((gamma * Math.PI) / 4);
      const s = Math.sin((gamma * Math.PI) / 4);
      u.re[0] = c;
      u.re[1] = -s;
      u.re[2] = s;
      u.re[3] = c;
      return [u];
    }
    case "depol": {
      // rho -> (1-gamma) rho + gamma I/k: one identity Kraus plus |i><j| *
      // sqrt(gamma/k) for every pair (the replace-by-maximally-mixed part)
      const ops: CMat[] = [mScale(identity(k), Math.sqrt(1 - gamma))];
      const c = Math.sqrt(gamma / k);
      for (let i = 0; i < k; i++) {
        for (let j = 0; j < k; j++) {
          const m = mat(k, k);
          m.re[i * k + j] = c;
          ops.push(m);
        }
      }
      return ops;
    }
    case "resetDamp": {
      // every excited level decays to |0> with probability gamma: K_0 =
      // diag(1, sqrt(1-gamma), ...) plus ONE Kraus sqrt(gamma)|0><i| PER
      // excited level — merging them into a single operator is NOT
      // trace-preserving (sum K^dagger K grows off-diagonal ones; caught by
      // the spec-verification run, see memory/r21/agent-iota.md)
      const ops: CMat[] = [];
      const k0 = mat(k, k);
      k0.re[0] = 1;
      for (let i = 1; i < k; i++) k0.re[i * k + i] = Math.sqrt(1 - gamma);
      ops.push(k0);
      for (let i = 1; i < k; i++) {
        const ki = mat(k, k);
        ki.re[0 * k + i] = Math.sqrt(gamma);
        ops.push(ki);
      }
      return ops;
    }
    case "parityFlip": {
      // K_0 = sqrt(1-gamma) I, K_1 = sqrt(gamma) D with D = diag((-1)^r):
      // populations kept, odd-parity coherences scaled by (1-2 gamma)
      const d = mat(k, k);
      for (let i = 0; i < k; i++) d.re[i * k + i] = i % 2 === 0 ? 1 : -1;
      return [
        mScale(identity(k), Math.sqrt(1 - gamma)),
        mScale(d, Math.sqrt(gamma)),
      ];
    }
  }
}

/** Trace-preservation guard: sum_j K_j^dagger K_j = I or the channel is
 * refused by name (a non-CPTP "noise" would break every theorem here). */
export function requireCptp(
  kraus: readonly CMat[],
  k: number,
  tol = 1e-10,
): void {
  let sum = mat(k, k);
  for (const op of kraus) {
    if (op.rows !== k || op.cols !== k) {
      throw new Error(
        `T1N04-bad-shape: Kraus operator is ${op.rows}x${op.cols}, register is ${k}x${k}`,
      );
    }
    sum = mAdd(sum, mMul(mMul(mDagger(op), identity(k)), op));
  }
  if (!matEq(sum, identity(k), tol)) {
    throw new Error(
      `T1N05-non-cptp: sum_j K_j^dagger K_j differs from I by more than ${tol} — this noise map is not trace-preserving`,
    );
  }
}

/** The POVM the noisy readout implements: A_r = N^dagger(|r><r|) =
 * sum_j K_j^dagger |r><r| K_j, plus the completeness defect
 * ||sum_r A_r - I||_max (must be ~1e-15 for CPTP input). */
export function effectOperators(
  kraus: readonly CMat[],
  k: number,
): { effects: CMat[]; completenessDefect: number } {
  requireCptp(kraus, k);
  const effects: CMat[] = [];
  let sum = mat(k, k);
  for (let r = 0; r < k; r++) {
    const proj = mat(k, k);
    proj.re[r * k + r] = 1;
    let acc = mat(k, k);
    for (const op of kraus) acc = mAdd(acc, mMul(mMul(mDagger(op), proj), op));
    effects.push(acc);
    sum = mAdd(sum, acc);
  }
  let defect = 0;
  const eye = identity(k);
  for (let idx = 0; idx < k * k; idx++) {
    defect = Math.max(
      defect,
      Math.abs(sum.re[idx]! - eye.re[idx]!),
      Math.abs(sum.im[idx]!),
    );
  }
  return { effects, completenessDefect: defect };
}

/** The Hermitian utility observable B = sum_r u(r) A_r (T1N-a). */
export function utilityObservable(
  u: readonly number[],
  kraus: readonly CMat[],
  k: number,
): CMat {
  if (u.length !== k) {
    throw new Error(
      `T1N06-bad-utility: expected ${k} utilities (one per report level), got ${u.length}`,
    );
  }
  const { effects } = effectOperators(kraus, k);
  let b = mat(k, k);
  for (let r = 0; r < k; r++) b = mAdd(b, mScale(effects[r]!, u[r]!));
  if (!isHermitian(b, 1e-12)) {
    throw new Error(
      "T1N07-non-hermitian: B = sum_r u(r) N^dagger(Pi_r) must be Hermitian — non-CPTP Kraus input?",
    );
  }
  return b;
}

/** U_N(sigma) through the observable: Tr[B sigma] (the theorem's path). */
export function noisyUtilityObservablePath(sigma: CMat, b: CMat): number {
  // Tr[B sigma] = sum_ij B_ij sigma_ji; imaginary parts cancel for Hermitian B
  let s = 0;
  for (let i = 0; i < b.rows; i++) {
    for (let j = 0; j < b.cols; j++) {
      const br = b.re[i * b.cols + j]!;
      const bi = b.im[i * b.cols + j]!;
      const sr = sigma.re[j * sigma.cols + i]!;
      const si = sigma.im[j * sigma.cols + i]!;
      s += br * sr - bi * si;
    }
  }
  return s;
}

/** U_N(sigma) through the physics: apply the channel, then read the codeword
 * basis — the independent dual path every pinned number here is checked
 * against. */
export function noisyUtilityPhysicalPath(
  sigma: CMat,
  kraus: readonly CMat[],
  u: readonly number[],
): number {
  const noisy = applyKraus(sigma, kraus);
  const k = sigma.rows;
  let s = 0;
  for (let r = 0; r < k; r++) s += u[r]! * noisy.re[r * k + r]!;
  return s;
}

/** Utilities u(r) of the auction for each report level r (others bid
 * classically, agent at agentSlot). */
export function reportUtilities(
  kind: AuctionKind,
  trueValue: number,
  others: readonly number[],
  agentSlot: number,
  k: number,
): number[] {
  const u: number[] = [];
  for (let r = 0; r < k; r++) {
    const bids = [...others];
    bids.splice(agentSlot, 0, r);
    u.push(utilityOf(kind, trueValue, bids, agentSlot));
  }
  return u;
}

export interface SpectralCriterion {
  /** lambda_max(B): the best achievable U_N over ALL quantum deviations */
  lambdaMax: number;
  /** U_N of the truthful codeword |level(trueValue)> */
  uTruth: number;
  /** lambdaMax - uTruth: the total DSIC gain under noise */
  gain: number;
  /** lambdaMax - max_i U_N(codeword i): the part only a coherent
   * (non-codeword) deviation can reach — noise-CREATED quantum incentive */
  coherenceAdvantage: number;
  /** max_i U_N(codeword i) - uTruth: the classical part (grid/tie
   * incentives, already visible at gamma = 0) */
  classicalIncentive: number;
  /** the noisy codeword utilities U_N(|i>) for i = 0..k-1 */
  codewordUtilities: number[];
  /** DSIC under noise: no quantum deviation gains (gain <= 1e-12) */
  dsic: boolean;
  /** the top eigenvector of B as a density matrix: the optimal deviation */
  bestDeviation: CMat;
}

/** The whole criterion in one call (T1N-b/T1N-e): one eigendecomposition of
 * B plus one utility evaluation per codeword. */
export function spectralDsicCriterion(
  kind: AuctionKind,
  trueValue: number,
  others: readonly number[],
  agentSlot: number,
  k: number,
  kraus: readonly CMat[],
): SpectralCriterion {
  if (!Number.isInteger(k) || k < 2) {
    throw new Error(`T1N08-bad-k: need integer k >= 2 report levels, got ${k}`);
  }
  const truth = Math.round(trueValue);
  if (truth < 0 || truth >= k) {
    // the R18 registry's dsic.ts:95 defect: a rounded-out-of-grid truth
    // surfaces as an unrelated basisVec range error — refuse it here with
    // the actual cause named
    throw new Error(
      `T1N09-truth-off-grid: level(trueValue) = ${truth} is outside the report grid [0, ${k}) — pick k > ${truth} or re-anchor trueValue`,
    );
  }
  const u = reportUtilities(kind, trueValue, others, agentSlot, k);
  const b = utilityObservable(u, kraus, k);
  // eigHermitian's reconstruction referee skips non-positive eigenvalues (it
  // is a density-matrix kernel), but B legitimately carries negative
  // spectrum whenever utilities are negative (e.g. losing bids). Shift
  // B + cI with c = max|u| + 1: the sandwich bound max|u|*I >= B >= -max|u|*I
  // makes B + cI >= I, the eigenvectors are untouched, and the values come
  // back shifted by exactly c — no new eigensolver, the public kernel only.
  const c = Math.max(...u.map(Math.abs), 0) + 1;
  const shifted = mAdd(b, mScale(identity(k), c));
  const { values, vectors } = eigHermitian(shifted);
  let top = 0;
  for (let i = 1; i < k; i++) if (values[i]! > values[top]!) top = i;
  const lambdaMax = values[top]! - c;
  const vk = vectors[top]!;
  const bestDeviation = mat(k, k);
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      bestDeviation.re[i * k + j] =
        vk.re[i]! * vk.re[j]! + vk.im[i]! * vk.im[j]!;
      bestDeviation.im[i * k + j] =
        vk.im[i]! * vk.re[j]! - vk.re[i]! * vk.im[j]!;
    }
  }
  const codewordUtilities: number[] = [];
  for (let i = 0; i < k; i++) {
    const cw = mat(k, k);
    cw.re[i * k + i] = 1;
    codewordUtilities.push(noisyUtilityPhysicalPath(cw, kraus, u));
  }
  const uTruth = codewordUtilities[truth]!;
  const bestCodeword = Math.max(...codewordUtilities);
  const gain = lambdaMax - uTruth;
  return {
    lambdaMax,
    uTruth,
    gain,
    coherenceAdvantage: lambdaMax - bestCodeword,
    classicalIncentive: bestCodeword - uTruth,
    codewordUtilities,
    dsic: gain <= 1e-12,
    bestDeviation,
  };
}

export interface NoiseBreakRow {
  channel: NoisyChannelName;
  gamma: number;
  kind: AuctionKind;
  trueValue: number;
  others: readonly number[];
  lambdaMax: number;
  uTruth: number;
  gain: number;
  coherenceAdvantage: number;
  classicalIncentive: number;
  /** total gain > tol: some deviation beats truth under noise */
  broken: boolean;
  /** coherence advantage > tol: the break is noise-CREATED (impossible at
   * gamma = 0 for any channel) rather than a classical grid incentive */
  noiseCreated: boolean;
}

const CENSUS_INSTANCES: ReadonlyArray<{
  kind: AuctionKind;
  trueValue: number;
  others: readonly number[];
}> = [
  // classically DSIC on the grid at gamma = 0 (gain(0) = 0)
  { kind: "second", trueValue: 1.4, others: [1] },
  { kind: "second", trueValue: 0.4, others: [1] },
  { kind: "first", trueValue: 1.4, others: [1] },
  // classically broken by grid rounding: truth rounds to a tying bid that
  // wins at a loss — the criterion must catch this WITHOUT calling it noise
  { kind: "second", trueValue: 2.6, others: [1, 3] },
  { kind: "first", trueValue: 2.6, others: [1, 3] },
];

/** The T1N-e census: every (channel, gamma, instance) row with the full
 * decomposition. gamma = 0 rows are the analytic negative control: the
 * identity channel recovers the classical picture (coherence advantage
 * exactly 0 for every family, by T1N-d). */
export function noiseBreakCensus(
  gammas: readonly number[],
  channels: readonly NoisyChannelName[] = [
    "phaseFlip",
    "ampDamp",
    "depol",
    "resetDamp",
    "parityFlip",
    "rotation",
  ],
): NoiseBreakRow[] {
  const rows: NoiseBreakRow[] = [];
  for (const channel of channels) {
    const k =
      channel === "phaseFlip" || channel === "ampDamp" || channel === "rotation"
        ? 2
        : 4;
    for (const gamma of gammas) {
      const kraus = noisyChannelKraus(channel, gamma, k);
      for (const inst of CENSUS_INSTANCES) {
        if (Math.round(inst.trueValue) < 0 || Math.round(inst.trueValue) >= k)
          continue;
        const c = spectralDsicCriterion(
          inst.kind,
          inst.trueValue,
          inst.others,
          0,
          k,
          kraus,
        );
        rows.push({
          channel,
          gamma,
          kind: inst.kind,
          trueValue: inst.trueValue,
          others: inst.others,
          lambdaMax: c.lambdaMax,
          uTruth: c.uTruth,
          gain: c.gain,
          coherenceAdvantage: c.coherenceAdvantage,
          classicalIncentive: c.classicalIncentive,
          broken: c.gain > 1e-12,
          noiseCreated: c.coherenceAdvantage > 1e-12,
        });
      }
    }
  }
  return rows;
}

export interface NoisyDsicClaim {
  channel: NoisyChannelName;
  gamma: number;
  kind: AuctionKind;
  trueValue: number;
  others: readonly number[];
  /** claimed lambda_max(B) */
  lambdaMax: number;
  /** claimed U_N(truth) */
  uTruth: number;
  /** claimed noise-created verdict */
  noiseCreated: boolean;
}

/** The anti-smuggling referee (negative-control machinery): re-derives a
 * claimed census row from scratch and convicts forged values, forged
 * no-break verdicts on broken rows, and forged noise-created filings by
 * name. A table row that was never measured does not survive this referee. */
export function verifyNoiseBreakClaim(claim: NoisyDsicClaim): {
  ok: boolean;
  code?: string;
  detail?: string;
} {
  checkGamma("T1N10-claim-gamma", claim.gamma);
  const k =
    claim.channel === "phaseFlip" ||
    claim.channel === "ampDamp" ||
    claim.channel === "rotation"
      ? 2
      : 4;
  if (Math.round(claim.trueValue) < 0 || Math.round(claim.trueValue) >= k) {
    return {
      ok: false,
      code: "T1NX01-truth-off-grid",
      detail: `level(${claim.trueValue}) outside the k = ${k} report grid`,
    };
  }
  const kraus = noisyChannelKraus(claim.channel, claim.gamma, k);
  const c = spectralDsicCriterion(
    claim.kind,
    claim.trueValue,
    claim.others,
    0,
    k,
    kraus,
  );
  if (Math.abs(c.lambdaMax - claim.lambdaMax) > 1e-9) {
    return {
      ok: false,
      code: "T1NX02-fabricated-lambda-max",
      detail: `${claim.channel}/gamma=${claim.gamma}/${claim.kind}/v=${claim.trueValue}: claimed lambda_max ${claim.lambdaMax}, re-derived ${c.lambdaMax.toFixed(9)}`,
    };
  }
  if (Math.abs(c.uTruth - claim.uTruth) > 1e-9) {
    return {
      ok: false,
      code: "T1NX03-fabricated-truth-utility",
      detail: `${claim.channel}/gamma=${claim.gamma}: claimed U_N(truth) ${claim.uTruth}, re-derived ${c.uTruth.toFixed(9)}`,
    };
  }
  if (claim.noiseCreated !== c.coherenceAdvantage > 1e-12) {
    return {
      ok: false,
      code: "T1NX04-forged-noise-created-filing",
      detail: `${claim.channel}/gamma=${claim.gamma}: coherence advantage is ${c.coherenceAdvantage.toExponential(2)}, the noise-created verdict is ${!claim.noiseCreated}`,
    };
  }
  return { ok: true };
}
