/**
 * The Haar adversary face (C2, v0.5.0).
 *
 * THE THEOREM (falsifiable): when the adversary's single choose(theta, U0,
 * U1) draws its branch unitaries i.i.d. Haar on U(d), then for EVERY input
 * density matrix rho and EVERY theta the post-step membership charge is
 * d_W/d in expectation — the universal constant, independent of the input,
 * the angle, and the adversary's own draw:
 *
 *     E[q] = (cos^2 + sin^2) · d_W/d = d_W/d,
 *
 * because E[U† Pi_W U] = (d_W/d)·I (the projector's only invariant under the
 * Haar twirl is its rank). For a PURE input the second moment closes too:
 * each branch's q is the membership of a Haar-random state, so
 *
 *     E[q^2] = (c^4 + s^4) · d_W(d_W+1)/(d(d+1)) + 2 c^2 s^2 (d_W/d)^2,
 *
 * the pure-Haar moment d_W(d_W+1)/(d(d+1)) mixed across the two branches.
 * This positions the 24-strategy bounded census (game.ts, DATA) on exact
 * coordinates: the census mean's distance to d_W/d is the bounded strategy
 * set's deviation from the Haar baseline, computable cell by cell.
 *
 * Boundaries, honestly: the family is Haar — min over Haar unitaries is an
 * infimum of 0 approachable by a malicious U aligning W with W-perp's
 * complement, never attained; a FIXED non-Haar adversary (e.g. diagonal
 * phases — they commute with a diagonal Pi_W) breaks universality outright,
 * and that break is the negative control. The second-moment face is claimed
 * for pure inputs only (a mixed input has E[q^2] = (d_W/d)^2 exactly when
 * both branches agree in expectation — smaller, and not this law).
 */
import { type CMat, mat } from "../core/cmat.js";
import { ChoiceLangError } from "../core/errors.js";
import { makeRng, type Rng } from "../core/rng.js";
import { membershipExpectation, runProgram, type Program } from "./lang.js";
import { randomUnitary } from "./fixtures.js";
import { gameCensus } from "./game.js";

/** The universal mean: E[q] = d_W/d for any input and any theta (Haar branches). */
export function haarMeanMembership(dimW: number, dim: number): number {
  validateDims(dimW, dim);
  return dimW / dim;
}

/** The pure-Haar second moment of one branch: d_W(d_W+1)/(d(d+1)). */
export function haarPureSecondMoment(dimW: number, dim: number): number {
  validateDims(dimW, dim);
  return (dimW * (dimW + 1)) / (dim * (dim + 1));
}

/** The pure-input second moment of the full step at angle theta (both branches). */
export function haarStepSecondMoment(
  theta: number,
  dimW: number,
  dim: number,
): number {
  if (!Number.isFinite(theta)) {
    throw new ChoiceLangError(
      "HAAR_THETA",
      `haarStepSecondMoment: non-finite control angle (${theta})`,
    );
  }
  validateDims(dimW, dim);
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return (
    (c ** 4 + s ** 4) * haarPureSecondMoment(dimW, dim) +
    2 * c * c * s * s * (dimW / dim) ** 2
  );
}

function validateDims(dimW: number, dim: number): void {
  if (!Number.isInteger(dim) || dim < 1) {
    throw new ChoiceLangError(
      "HAAR_DIM",
      `haarMeanMembership: dim must be an integer >= 1, got ${dim}`,
    );
  }
  if (!Number.isInteger(dimW) || dimW < 1 || dimW > dim) {
    throw new ChoiceLangError(
      "HAAR_DIM",
      `haarMeanMembership: dimW must be an integer in [1, dim=${dim}], got ${dimW} — a rank outside the projector's range is not a subspace`,
    );
  }
}

/** The marked world as a coordinate-initial subspace: diag(1 x dimW, 0). */
export function coordinateWorld(dimW: number, dim: number): CMat {
  validateDims(dimW, dim);
  const m = mat(dim, dim);
  for (let i = 0; i < dimW; i++) m.re[i * dim + i] = 1;
  return m;
}

/** |e_k><e_k| — a basis resident (k = 0 is in-world when dimW >= 1). */
export function basisState(k: number, dim: number): CMat {
  if (!Number.isInteger(k) || k < 0 || k >= dim) {
    throw new ChoiceLangError(
      "HAAR_DIM",
      `basisState: index k must be in [0, dim=${dim}), got ${k}`,
    );
  }
  const m = mat(dim, dim);
  m.re[k * dim + k] = 1;
  return m;
}

/** The maximally mixed state I/d. */
export function mixedState(dim: number): CMat {
  if (!Number.isInteger(dim) || dim < 1) {
    throw new ChoiceLangError(
      "HAAR_DIM",
      `mixedState: dim must be an integer >= 1, got ${dim}`,
    );
  }
  const m = mat(dim, dim);
  for (let i = 0; i < dim; i++) m.re[i * dim + i] = 1 / dim;
  return m;
}

/** A pure random state |psi><psi|, read from a Haar column (psi = u's column col). */
export function columnState(u: CMat, col: number): CMat {
  if (!Number.isInteger(col) || col < 0 || col >= u.cols) {
    throw new ChoiceLangError(
      "HAAR_DIM",
      `columnState: column index ${col} outside the ${u.cols}-column unitary`,
    );
  }
  const d = u.rows;
  const m = mat(d, d);
  for (let i = 0; i < d; i++) {
    for (let j = 0; j < d; j++) {
      // psi_i * conj(psi_j) — the imaginary part is load-bearing: a real-only
      // outer product is not a state of a complex vector
      m.re[i * d + j] =
        u.re[i * u.cols + col]! * u.re[j * u.cols + col]! +
        u.im[i * u.cols + col]! * u.im[j * u.cols + col]!;
      m.im[i * d + j] =
        u.im[i * u.cols + col]! * u.re[j * u.cols + col]! -
        u.re[i * u.cols + col]! * u.im[j * u.cols + col]!;
    }
  }
  return m;
}

export interface HaarCensusSpec {
  readonly dimW: number;
  readonly dim: number;
  readonly theta: number;
  readonly input: "in-world" | "perp" | "mixed" | "random-pure";
  readonly draws: number;
}

export interface HaarCensusRow extends HaarCensusSpec {
  /** MC mean of the post-step membership over Haar draws */
  readonly meanMC: number;
  readonly closedMean: number;
  /** (meanMC - closedMean) / standard error of the mean */
  readonly sigmaUnits: number;
  /** MC second moment (reported for every row; asserted only for pure inputs) */
  readonly moment2MC: number;
  readonly closedMoment2: number;
  readonly moment2SigmaUnits: number;
}

/**
 * The Haar census: for every grid row, draw i.i.d. Haar branch pairs (the
 * fixtures' Gram-Schmidt-over-Gaussians generator), run the adversary's
 * actual step on the actual register, and read the membership off the result
 * — never from the closed form. Each row reports its deviation from the
 * theorem's constants in units of its own standard error.
 */
export function haarCensus(
  specs: readonly HaarCensusSpec[],
  seedBase: number,
): HaarCensusRow[] {
  return specs.map((spec, row) => {
    validateDims(spec.dimW, spec.dim);
    if (!Number.isFinite(spec.theta)) {
      throw new ChoiceLangError(
        "HAAR_THETA",
        `haarCensus: row ${row + 1} carries a non-finite theta (${spec.theta})`,
      );
    }
    if (!Number.isInteger(spec.draws) || spec.draws < 1) {
      throw new ChoiceLangError(
        "HAAR_DRAWS",
        `haarCensus: row ${row + 1} asks for ${spec.draws} draws — a census of none proves nothing`,
      );
    }
    const piW = coordinateWorld(spec.dimW, spec.dim);
    const rng: Rng = makeRng(seedBase + 7919 * (row + 1));
    const rho =
      spec.input === "mixed"
        ? mixedState(spec.dim)
        : spec.input === "random-pure"
          ? columnState(randomUnitary(rng, spec.dim), 0)
          : spec.input === "in-world"
            ? basisState(0, spec.dim)
            : basisState(spec.dimW, spec.dim); // perp: first index outside W
    let sum = 0;
    let sum2 = 0;
    let sum4 = 0; // for the second moment's own standard error: Var(q^2)/draws
    for (let i = 0; i < spec.draws; i++) {
      const u0 = randomUnitary(rng, spec.dim);
      const u1 = randomUnitary(rng, spec.dim);
      const q = membershipExpectation(
        runProgram([{ theta: spec.theta, u0, u1 }], rho),
        piW,
        spec.dim,
      );
      sum += q;
      sum2 += q * q;
      sum4 += q ** 4;
    }
    const meanMC = sum / spec.draws;
    const moment2MC = sum2 / spec.draws;
    const varMC = Math.max(moment2MC - meanMC * meanMC, 0);
    const se = Math.sqrt(varMC / spec.draws);
    const closedMean = haarMeanMembership(spec.dimW, spec.dim);
    const closedMoment2 = haarStepSecondMoment(spec.theta, spec.dimW, spec.dim);
    const se2 = Math.sqrt(
      Math.max(sum4 / spec.draws - moment2MC * moment2MC, 0) / spec.draws,
    );
    return {
      ...spec,
      meanMC,
      closedMean,
      sigmaUnits: se > 0 ? (meanMC - closedMean) / se : 0,
      moment2MC,
      closedMoment2,
      moment2SigmaUnits: se2 > 0 ? (moment2MC - closedMoment2) / se2 : 0,
    };
  });
}

/** A fixed DIAGONAL adversary: diag(exp(i phi_k)) — commutes with the
 * coordinate world, so it cannot randomize membership at all. */
export function diagonalUnitary(phases: readonly number[]): CMat {
  if (phases.length < 1) {
    throw new ChoiceLangError(
      "HAAR_DIM",
      `diagonalUnitary: ${phases.length} phases is not a unitary`,
    );
  }
  for (const [i, phi] of phases.entries()) {
    if (!Number.isFinite(phi)) {
      throw new ChoiceLangError(
        "HAAR_THETA",
        `diagonalUnitary: phase ${i + 1} is non-finite (${phi})`,
      );
    }
  }
  const d = phases.length;
  const m = mat(d, d);
  for (let k = 0; k < d; k++) {
    m.re[k * d + k] = Math.cos(phases[k]!);
    m.im[k * d + k] = Math.sin(phases[k]!);
  }
  return m;
}

/** The membership after a fixed-diagonal adversary step, read off the register. */
export function diagonalAdversaryMembership(
  theta: number,
  phases: readonly number[],
  rho: CMat,
  piW: CMat,
): number {
  const u = diagonalUnitary(phases);
  const d = u.rows;
  return membershipExpectation(
    runProgram([{ theta, u0: u, u1: u }], rho),
    piW,
    d,
  );
}

export interface CensusGain {
  /** the universal Haar mean d_W/d */
  readonly universal: number;
  /** the bounded census's extreme charges (DATA, game.ts's 24 strategies) */
  readonly censusMin: number;
  readonly censusMax: number;
  /** max over census cells of |final - universal| — the bounded set's gain */
  readonly maxGain: number;
}

/** Position the bounded-strategy census against the universal Haar mean. */
export function boundedCensusGain(
  first: Program,
  firstBits: ReadonlyArray<0 | 1>,
  advBit: 0 | 1,
  rho: CMat,
  piW: CMat,
): CensusGain {
  const d = rho.rows;
  let dimW = 0;
  for (let i = 0; i < d; i++) dimW += piW.re[i * d + i]!; // diagonal worlds only
  const cells = gameCensus(first, firstBits, advBit, rho, piW);
  const finals = cells.map((c) => c.final);
  const universal = dimW / d;
  return {
    universal,
    censusMin: Math.min(...finals),
    censusMax: Math.max(...finals),
    maxGain: Math.max(...finals.map((f) => Math.abs(f - universal))),
  };
}
