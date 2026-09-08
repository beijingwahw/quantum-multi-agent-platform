/**
 * T3 — CHSH rigidity as the verification kernel, machine-checked.
 *
 *  (1) Horodecki formula: for a two-qubit state ρ with correlation matrix
 *      T_{ij} = Tr(ρ σ_i ⊗ σ_j), the maximal CHSH value is exactly
 *      S_max(ρ) = 2√(u₁ + u₂), u₁ ≥ u₂ the two largest eigenvalues of TᵀT
 *      (R. Horodecki, P. Horodecki, M. Horodecki, Phys. Lett. A 200, 340 (1995)).
 *      Referee: direct numerical optimization of S over the eight measurement
 *      angles must converge to the formula value on Bell/Werner/Schmidt/random
 *      mixed states.
 *  (2) Tsirelson: S ≤ 2√2 on all sampled states (the analytic argument is in
 *      docs/theory.md; the sampler checks no physical state exceeds it).
 *  (3) Pure-state rigidity law: S_max = 2√(1 + C²) with C the concurrence —
 *      exact quantitative self-testing anchor: a CHSH violation certifies
 *      entanglement for pure states, with the Schmidt angle pinned by S.
 *  (4) Game form: W = 1/2 + S/8; quantum optimum (2+√2)/4 ≈ 0.853553,
 *      classical optimum 3/4 — MC of the game vs the formula.
 *  (5) Honest boundary: Werner states with F ∈ (1/2, 1/√2] are PPT-entangled
 *      but CHSH-local — CHSH verification is sufficient, not necessary.
 */

import { type CMat, eigenvaluesHermitian, mat, mMul, kron, sqrtPSD } from '../core/cmat.js';
import { PAULIS, PAULI_Y } from '../core/states.js';
import { partialTransposeQ } from '../core/gates.js';
import { makeRng, type Rng } from '../core/rng.js';

/** Correlation matrix T[i][j] = Tr(ρ σ_i ⊗ σ_j) of a two-qubit state. */
export function correlationT(rho: CMat): number[][] {
  const t: number[][] = [[], [], []];
  for (let i = 0; i < 3; i++) {
    const si = PAULIS[i]!;
    for (let j = 0; j < 3; j++) {
      const op = kron(si, PAULIS[j]!);
      const prod = mMul(rho, op);
      // Tr(ρ σ⊗σ) is real for Hermitian ρ
      let tr = 0;
      let tim = 0;
      for (let k = 0; k < 4; k++) {
        tr += prod.re[k * 4 + k]!;
        tim += prod.im[k * 4 + k]!;
      }
      if (Math.abs(tim) > 1e-10) throw new Error('QV_IMAGINARY_TRACE: correlation not real (input not Hermitian?)');
      t[i]![j] = tr;
    }
  }
  return t;
}

/** Horodecki S_max(ρ) = 2√(u₁+u₂) from eigenvalues of TᵀT. */
export function horodeckiSMax(rho: CMat): number {
  const t = correlationT(rho);
  const u = tTtEigenvalues(t);
  return 2 * Math.sqrt(Math.max(0, u[0]! + u[1]!));
}

export function tTtEigenvalues(t: ReadonlyArray<readonly number[]>): number[] {
  const a = mat(3, 3);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      let s = 0;
      for (let k = 0; k < 3; k++) s += t[k]![i]! * t[k]![j]!;
      a.re[i * 3 + j] = s;
    }
  }
  return Array.from(eigenvaluesHermitian(a)).sort((x, y) => y - x);
}

/** Unit Bloch direction from polar angles. */
export function blochDir(theta: number, phi: number): readonly number[] {
  return [Math.sin(theta) * Math.cos(phi), Math.sin(theta) * Math.sin(phi), Math.cos(theta)];
}

/** CHSH value from correlation matrix and four directions (a0, a1, b0, b1). */
export function chshValue(
  t: ReadonlyArray<readonly number[]>,
  a0: readonly number[],
  a1: readonly number[],
  b0: readonly number[],
  b1: readonly number[],
): number {
  const e = (a: readonly number[], b: readonly number[]): number =>
    a[0]! * (t[0]![0]! * b[0]! + t[0]![1]! * b[1]! + t[0]![2]! * b[2]!) +
    a[1]! * (t[1]![0]! * b[0]! + t[1]![1]! * b[1]! + t[1]![2]! * b[2]!) +
    a[2]! * (t[2]![0]! * b[0]! + t[2]![1]! * b[1]! + t[2]![2]! * b[2]!);
  return e(a0, b0) + e(a0, b1) + e(a1, b0) - e(a1, b1);
}

/**
 * Direct optimization of the CHSH value over the eight angles (four Bloch
 * directions), deterministic multistart compass search. Must reproduce the
 * Horodecki formula value — the referee for (1).
 */
export function optimizeChsh(rho: CMat, seed = 0x5eed, starts = 24): { s: number; angles: number[] } {
  const t = correlationT(rho);
  const rng = makeRng(seed);
  let best = -Infinity;
  let bestAngles: number[] = [0, 0, 0, 0, 0, 0, 0, 0];
  for (let s = 0; s < starts; s++) {
    let x = [rng() * Math.PI, rng() * 2 * Math.PI, rng() * Math.PI, rng() * 2 * Math.PI, rng() * Math.PI, rng() * 2 * Math.PI, rng() * Math.PI, rng() * 2 * Math.PI];
    let fx = evalAngles(t, x);
    let step = 0.4;
    while (step > 1e-7) {
      let improved = false;
      for (let d = 0; d < 8; d++) {
        for (const sgn of [1, -1]) {
          const y = x.slice();
          y[d] = y[d]! + sgn * step;
          const fy = evalAngles(t, y);
          if (fy > fx + 1e-12) {
            x = y;
            fx = fy;
            improved = true;
          }
        }
      }
      if (!improved) step *= 0.5;
    }
    // CHSH sign: |S| is what matters; flip measurement outcomes if needed
    const val = Math.abs(fx);
    if (val > best) {
      best = val;
      bestAngles = x;
    }
  }
  return { s: best, angles: bestAngles };
}

function evalAngles(t: ReadonlyArray<readonly number[]>, x: readonly number[]): number {
  return chshValue(t, blochDir(x[0]!, x[1]!), blochDir(x[2]!, x[3]!), blochDir(x[4]!, x[5]!), blochDir(x[6]!, x[7]!));
}

/** CHSH game: random inputs x,y ∈ {0,1}; win iff a⊕b = xy. Returns empirical win rate. */
export function chshGame(
  rho: CMat,
  angles: readonly number[],
  trials: number,
  rng: Rng,
): { winRate: number; sFromAngles: number } {
  const t = correlationT(rho);
  let dirs = [blochDir(angles[0]!, angles[1]!), blochDir(angles[2]!, angles[3]!), blochDir(angles[4]!, angles[5]!), blochDir(angles[6]!, angles[7]!)];
  // normalize the sign so S > 0 (the game value is 1/2 + S/8)
  if (chshValue(t, dirs[0]!, dirs[1]!, dirs[2]!, dirs[3]!) < 0) {
    dirs = [dirs[0]!, [-dirs[1]![0]!, -dirs[1]![1]!, -dirs[1]![2]!], dirs[2]!, dirs[3]!];
  }
  let wins = 0;
  for (let trial = 0; trial < trials; trial++) {
    const x = rng.int(2);
    const y = rng.int(2);
    const a = dirs[x]!;
    const b = dirs[2 + y]!;
    const { aOut, bOut } = sampleProjectiveOutcomes(rho, a, b, rng);
    const win = (aOut ^ bOut) === (x & y);
    if (win) wins++;
  }
  const sFrom = chshValue(t, dirs[0]!, dirs[1]!, dirs[2]!, dirs[3]!);
  return { winRate: wins / trials, sFromAngles: sFrom };
}

/** Sample a joint projective measurement outcome (±1, ±1) on a two-qubit state. */
export function sampleProjectiveOutcomes(
  rho: CMat,
  a: readonly number[],
  b: readonly number[],
  rng: Rng,
): { aOut: number; bOut: number } {
  // P(m,n) = Tr ρ Π_m^a ⊗ Π_n^b, Π± = (I ± d·σ)/2
  const probs: number[] = [];
  const pa = projector(a);
  const pb = projector(b);
  for (let m = 0; m < 2; m++) {
    for (let n = 0; n < 2; n++) {
      const op = kron(m === 0 ? pa.plus : pa.minus, n === 0 ? pb.plus : pb.minus);
      const prod = mMul(rho, op);
      probs.push(prod.re[0]! + prod.re[5]! + prod.re[10]! + prod.re[15]!);
    }
  }
  const r = rng();
  let acc = 0;
  let pick = 0;
  for (let i = 0; i < 4; i++) {
    acc += Math.max(0, probs[i]!);
    if (r < acc) {
      pick = i;
      break;
    }
  }
  return { aOut: pick < 2 ? 0 : 1, bOut: pick % 2 === 0 ? 0 : 1 };
}

function projector(d: readonly number[]): { plus: CMat; minus: CMat } {
  // Π± = (I ± d·σ)/2 with d·σ = [[d_z, d_x − i d_y], [d_x + i d_y, −d_z]]
  const plus = mat(2, 2);
  const minus = mat(2, 2);
  plus.re[0] = 0.5 * (1 + d[2]!);
  plus.re[3] = 0.5 * (1 - d[2]!);
  plus.re[1] = 0.5 * d[0]!;
  plus.re[2] = 0.5 * d[0]!;
  plus.im[1] = -0.5 * d[1]!;
  plus.im[2] = 0.5 * d[1]!;
  minus.re[0] = 0.5 * (1 - d[2]!);
  minus.re[3] = 0.5 * (1 + d[2]!);
  minus.re[1] = -0.5 * d[0]!;
  minus.re[2] = -0.5 * d[0]!;
  minus.im[1] = 0.5 * d[1]!;
  minus.im[2] = -0.5 * d[1]!;
  return { plus, minus };
}

/** Concurrence of a two-qubit state via the spin-flip construction. */
export function concurrence(rho: CMat): number {
  // ρ̃ = (Y⊗Y) ρ* (Y⊗Y); eigenvalues of ρ ρ̃ via the similar Hermitian √ρ ρ̃ √ρ
  const yy = kron(PAULI_Y, PAULI_Y);
  const conj = mat(4, 4);
  for (let i = 0; i < 16; i++) conj.im[i] = -rho.im[i]!;
  conj.re.set(rho.re);
  const flipped = mMul(mMul(yy, conj), yy);
  const sq = sqrtPSD(rho);
  const roots = eigenvaluesHermitian(mMul(mMul(sq, flipped), sq));
  const sorted = Array.from(roots).sort((x, y) => Math.max(0, y) - Math.max(0, x));
  const l = sorted.map((v) => Math.sqrt(Math.max(0, v)));
  return Math.max(0, l[0]! - l[1]! - l[2]! - l[3]!);
}

/** Minimum eigenvalue of the partial transpose (PPT criterion; < 0 ⟺ entangled). */
export function pptMinEigenvalue(rho: CMat): number {
  const pt = partialTransposeQ(rho, 2, 1);
  const eig = eigenvaluesHermitian(pt);
  // eigenvaluesHermitian returns length-n ascending — the minimum is entry 0
  const min = eig[0];
  if (min === undefined) throw new Error('pptMinEigenvalue: empty spectrum');
  return min;
}

/** Classical CHSH game optimum by deterministic enumeration of 16 local strategies: exactly 3/4. */
export function classicalGameWinRate(): number {
  let best = 0;
  for (let mask = 0; mask < 16; mask++) {
    const ax: number[] = [(mask & 1) === 0 ? 1 : -1, (mask & 2) === 0 ? 1 : -1];
    const by: number[] = [(mask & 4) === 0 ? 1 : -1, (mask & 8) === 0 ? 1 : -1];
    let wins = 0;
    for (let x = 0; x < 2; x++) {
      for (let y = 0; y < 2; y++) {
        if ((ax[x]! === by[y]! ? 0 : 1) === (x & y)) wins++;
      }
    }
    best = Math.max(best, wins / 4);
  }
  return best;
}

