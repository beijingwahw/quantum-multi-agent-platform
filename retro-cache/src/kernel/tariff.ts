/**
 * Kernel — local maps, the classical-strategy census, and the withdrawal ledger.
 */
import {
  cmatAdd,
  cmatMul,
  cmatScale,
  cmatZero,
  correlationFromTable,
  entropyBits,
  I2,
  jointTable,
  kron2,
  PAULI,
  projector,
  Rng,
  trace,
  type CMat,
} from "./state.js";

/** random 2x2 unitary via the closed form exp(i c.sigma) = cos|c| I + i sin|c| (c.sigma)/|c| */
export function randomUnitary2(rng: Rng): CMat {
  const c = [rng.next() * 2 - 1, rng.next() * 2 - 1, rng.next() * 2 - 1];
  const norm = Math.sqrt(c[0]! ** 2 + c[1]! ** 2 + c[2]! ** 2);
  if (norm < 1e-12) return randomUnitary2(new Rng(rng.next() * 4294967295));
  const co = Math.cos(norm);
  const si = Math.sin(norm);
  const out = cmatScale(I2, co);
  for (let p = 0; p < 3; p++) {
    const pauli = PAULI[p]!;
    const s = (si * c[p]!) / norm;
    const term = cmatZero(2);
    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 2; j++) {
        term.re[i]![j] = -s * pauli.im[i]![j]!;
        term.im[i]![j] = s * pauli.re[i]![j]!;
      }
    const added = cmatAdd(out, term);
    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 2; j++) {
        out.re[i]![j] = added.re[i]![j]!;
        out.im[i]![j] = added.im[i]![j]!;
      }
  }
  return out;
}

function dagger(a: CMat): CMat {
  const out = cmatZero(a.dim);
  for (let i = 0; i < a.dim; i++)
    for (let j = 0; j < a.dim; j++) {
      out.re[i]![j] = a.re[j]![i]!;
      out.im[i]![j] = -a.im[j]![i]!;
    }
  return out;
}

/** apply a unitary to the A half: rho -> (U (x) I) rho (U^dagger (x) I) */
export function unitaryOnA(rho: CMat, u: CMat): CMat {
  const op = kron2(u, I2);
  return cmatMul(cmatMul(op, rho), dagger(op));
}

/** apply a unitary to the B half: rho -> (I (x) U) rho (I (x) U^dagger) */
export function unitaryOnB(rho: CMat, u: CMat): CMat {
  const op = kron2(I2, u);
  return cmatMul(cmatMul(op, rho), dagger(op));
}

/** structured-random Stinesring CPTP on B: fresh env qubit in |0>, a random
 *  unitary (local (x) local . controlled-local) acts on B (x) env, env is
 *  traced out. Built on the full 8-dim A (x) B (x) env space so the dilation
 *  never touches the A factor (an earlier draft applied the B (x) env unitary
 *  directly on the 4-dim A (x) B matrix — its control straddled A and B, and
 *  the referee flagged the A-dependence). Family includes entangling
 *  dilations and non-unital maps; not Haar — noted in the README boundary. */
export function cptpOnB(rho: CMat, rng: Rng): CMat {
  if (rho.dim !== 4) throw new Error(`cptpOnB: expected a 4x4 two-qubit matrix, got dim ${rho.dim}`);
  const u1 = randomUnitary2(rng);
  const v1 = randomUnitary2(rng);
  const u2 = randomUnitary2(rng);
  // W = (u1 (x) v1) . [ |0><0|_B (x) I_env + |1><1|_B (x) u2 ]  on B (x) env
  const p0 = projector([0, 0, 1], 1);
  const p1 = projector([0, 0, 1], -1);
  const w4 = cmatMul(kron2(u1, v1), cmatAdd(kron2(p0, I2), kron2(p1, u2)));
  // 8-dim: (I_A (x) W) on A (x) (B (x) env); env starts in |0>
  const op = kron2(I2, w4); // 8x8
  const withEnv = cmatZero(8);
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      // kron(rho, |0><0|): env index fixed at 0 -> index (i*2+0)*2? layout a*4+b*2+e
      withEnv.re[i * 2]![j * 2] = rho.re[i]![j]!;
      withEnv.im[i * 2]![j * 2] = rho.im[i]![j]!;
    }
  const applied = cmatMul(cmatMul(op, withEnv), dagger(op));
  // trace out env only: keep the A(x)B block (index (a*2+b)*2+e -> a*2+b)
  const out = cmatZero(4);
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      out.re[i]![j] = applied.re[i * 2]![j * 2]! + applied.re[i * 2 + 1]![j * 2 + 1]!;
      out.im[i]![j] = applied.im[i * 2]![j * 2]! + applied.im[i * 2 + 1]![j * 2 + 1]!;
    }
  return out;
}

/** classical postprocessing: a stochastic map on the B outcome distribution */
export function postprocessOutcome(table: ReadonlyArray<readonly number[]>, m: readonly [readonly number[], readonly number[]]): number[][] {
  // new P(x, y') = sum_y P(x,y) M[y][y']
  const out = [
    [0, 0],
    [0, 0],
  ];
  for (let x = 0; x < 2; x++)
    for (let y = 0; y < 2; y++) {
      const p = table[x]![y]!;
      out[x]![0]! += p * m[y]![0]!;
      out[x]![1]! += p * m[y]![1]!;
    }
  return out;
}

// ---------------------------------------------------------------------------
// The classical shared-randomness census: all 256 deterministic strategies.
// r_A: {a0,a1} x {seed 0,1} -> +/-1 (4 bits); r_B likewise. The CHSH value of
// each strategy is computed exactly; the census maximum is the classical cap.
// ---------------------------------------------------------------------------

export interface CensusResult {
  readonly strategies: number;
  readonly maxAbsS: number;
  readonly argmax: number;
}

function strategyBits(idx: number): number[] {
  return [(idx >> 3) & 1, (idx >> 2) & 1, (idx >> 1) & 1, idx & 1].map((b) => (b === 1 ? 1 : -1));
}

/** x_A(a, s): bit layout [a0s0, a0s1, a1s0, a1s1] */
export function classicalCensus(): CensusResult {
  let maxAbsS = 0;
  let argmax = 0;
  let count = 0;
  for (let i = 0; i < 16; i++) {
    const rA = strategyBits(i);
    for (let j = 0; j < 16; j++) {
      const rB = strategyBits(j);
      const e = (ai: number, bj: number): number => {
        // seed s uniform: E = (1/4) sum_s x(a_i,s) y(b_j,s) -> via table
        let s = 0;
        for (let sd = 0; sd < 2; sd++) {
          const x = ai === 0 ? (sd === 0 ? (rA[0] as number) : (rA[1] as number)) : sd === 0 ? (rA[2] as number) : (rA[3] as number);
          const y = bj === 0 ? (sd === 0 ? (rB[0] as number) : (rB[1] as number)) : sd === 0 ? (rB[2] as number) : (rB[3] as number);
          s += x * y;
        }
        return s / 2;
      };
      const S = e(0, 0) + e(0, 1) + e(1, 0) - e(1, 1);
      count++;
      if (Math.abs(S) > maxAbsS + 1e-15) {
        maxAbsS = Math.abs(S);
        argmax = i * 16 + j;
      }
    }
  }
  return { strategies: count, maxAbsS, argmax };
}

// ---------------------------------------------------------------------------
// The withdrawal ledger (W4).
// ---------------------------------------------------------------------------

/** binary entropy h2(q), base 2 (SHAN48) */
export function h2(q: number): number {
  if (q <= 0 || q >= 1) return 0;
  return entropyBits([q, 1 - q]);
}

export interface WithdrawalRow {
  readonly p: number;
  /** QBER after B flips: P(disagree) on aligned axes — table path */
  readonly qberTable: number;
  /** closed form (1 - p)/2 */
  readonly qberClosed: number;
  /** reconciliation leak floor per SIFTED bit (Shannon bound) */
  readonly leakFloor: number;
  /** net bits per raw pair: sift 1/2 (two bases) times (1 - h2(q)) */
  readonly netRate: number;
  /** settings tariff per raw pair on the classical channel (log2 of #bases) */
  readonly settingsTariff: number;
}

export function withdrawalRow(rho: CMat, p: number): WithdrawalRow {
  const z = [0, 0, 1];
  const table = jointTable(rho, z, z);
  // B flips its bit: agreement becomes the (x, -y) cells; QBER = P(x = y)
  const qberTable = (table[0][0]) + (table[1][1]);
  const qberClosed = (1 - p) / 2;
  const leakFloor = h2(qberClosed);
  return {
    p,
    qberTable,
    qberClosed,
    leakFloor,
    netRate: 0.5 * (1 - leakFloor),
    settingsTariff: 1,
  };
}

export function correlationOf(rho: CMat, a: readonly number[], b: readonly number[]): number {
  return correlationFromTable(jointTable(rho, a, b));
}

export function traceReal(m: CMat): number {
  return trace(m).re;
}

export { projector, Rng, type CMat };
