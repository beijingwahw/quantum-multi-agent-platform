/**
 * THE WO15 TOMBSTONE — board B6, the equilibrium half of the claim, closed.
 *
 * WO15 (cited) proves no local order parameter oscillates in any ground or
 * thermal-equilibrium state of a local Hamiltonian. This board executes the
 * tombstone at the scale a machine can hold:
 *   (G1) the nondegenerate ground state is STATIONARY: every local
 *        expectation is constant along e^{-iHt} — deviation at the floor;
 *   (G2) thermal states are stationary the same way;
 *   (G3) the seed of a beat DOES exist in a static Hamiltonian — a PREPARED
 *        superposition of two eigenstates oscillates at the Bohr frequency
 *        (E1 - E0), with the period exact at 2 pi / gap: equilibrium never
 *        beats, but a spent battery can (ERS17, cited) — a beat outside
 *        equilibrium is either a battery or a drive, and both get priced.
 *
 * Solver note (batch 36): the family's eigHermitian fails its own
 * reconstruction check on generic real-symmetric TI chains (values fine,
 * complex-basis extraction off); the family file stays untouched (K-board
 * byte identity) and this board uses a local cyclic-Jacobi solver for the
 * real-symmetric case — H is real by construction (Paulis only).
 */
import { type CMat, type CVec, identity, mAdd, mMul, mScale } from "../core/cmat.js";
import { siteX, siteZ, expectation } from "./beat.js";

/** Transverse-field Ising chain H = -J sum Z_i Z_{i+1} - h sum X_i (open). */
export function tiHamiltonian(n: number, j: number, h: number): CMat {
  const dim = 1 << n;
  let ham: CMat = mScale(identity(dim), 0);
  for (let i = 0; i + 1 < n; i++) {
    ham = mAdd(ham, mScale(mMul(siteZ(n, i), siteZ(n, i + 1)), -j));
  }
  for (let i = 0; i < n; i++) ham = mAdd(ham, mScale(siteX(n, i), -h));
  return ham;
}

/** The real part of a real-symmetric matrix as a row-major Float64Array. */
export function realSymmetricPack(m: CMat): Float64Array {
  const a = new Float64Array(m.rows * m.cols);
  for (let i = 0; i < m.rows; i++) {
    for (let j = 0; j < m.cols; j++) {
      if (Math.abs(m.im[i * m.cols + j]!) > 1e-12) {
        throw new Error("realSymmetricPack on a non-real matrix — wrong object");
      }
      a[i * m.cols + j] = m.re[i * m.cols + j]!;
    }
  }
  return a;
}

export interface RealEigen {
  readonly values: Float64Array; // ascending
  readonly vectors: Float64Array; // columns: vectors[k*n + i] = component i of eigenvector k
}

/** Cyclic Jacobi for real symmetric matrices — eigenpairs, no dependencies. */
export function jacobiEigen(aIn: Float64Array, n: number): RealEigen {
  const a = Float64Array.from(aIn);
  const v = identity(n).re; // row-major orthogonal accumulator
  for (let sweep = 0; sweep < 64; sweep++) {
    let off = 0;
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) off += a[i * n + j]! * a[i * n + j]!;
    }
    if (off < 1e-26) break;
    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        const apq = a[p * n + q]!;
        if (Math.abs(apq) < 1e-18) continue;
        const app = a[p * n + p]!;
        const aqq = a[q * n + q]!;
        const theta = (aqq - app) / (2 * apq);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = a[k * n + p]!;
          const akq = a[k * n + q]!;
          a[k * n + p] = c * akp - s * akq;
          a[k * n + q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = a[p * n + k]!;
          const aqk = a[q * n + k]!;
          a[p * n + k] = c * apk - s * aqk;
          a[q * n + k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = v[k * n + p]!;
          const vkq = v[k * n + q]!;
          v[k * n + p] = c * vkp - s * vkq;
          v[k * n + q] = s * vkp + c * vkq;
        }
      }
    }
  }
  const order = Array.from({ length: n }, (_, i) => i).sort((x, y) => a[x * n + x]! - a[y * n + y]!);
  const values = new Float64Array(n);
  const vectors = new Float64Array(n * n);
  for (let k = 0; k < n; k++) {
    values[k] = a[order[k]! * n + order[k]!]!;
    for (let i = 0; i < n; i++) vectors[k * n + i] = v[i * n + order[k]!]!;
  }
  return { values, vectors };
}

/** Eigenvector k as a complex CVec (real solver: imaginary parts zero). */
export function realEigVecToCVec(vectors: Float64Array, n: number, k: number): CVec {
  const v: CVec = { n, re: new Float64Array(n), im: new Float64Array(n) };
  for (let i = 0; i < n; i++) v.re[i] = vectors[k * n + i]!;
  return v;
}

/** |v><v| for a unit vector. */
export function projector(v: CVec): CMat {
  const d = v.n;
  const p: CMat = { rows: d, cols: d, re: new Float64Array(d * d), im: new Float64Array(d * d) };
  for (let r = 0; r < d; r++) {
    for (let c = 0; c < d; c++) {
      p.re[r * d + c] = v.re[r]! * v.re[c]! + v.im[r]! * v.im[c]!;
      p.im[r * d + c] = v.im[r]! * v.re[c]! - v.re[r]! * v.im[c]!;
    }
  }
  return p;
}

/** rho(t) = sum_{jk} e^{-i(l_j - l_k)t} P_j rho P_k. */
export function evolveRho(
  rho: CMat,
  values: readonly number[],
  projectors: readonly CMat[],
  t: number,
): CMat {
  const d = rho.rows;
  const out: CMat = { rows: d, cols: d, re: new Float64Array(d * d), im: new Float64Array(d * d) };
  for (let j = 0; j < projectors.length; j++) {
    for (let k = 0; k < projectors.length; k++) {
      const m2 = mMul(mMul(projectors[j]!, rho), projectors[k]!);
      const phase = -(values[j]! - values[k]!) * t;
      const cph = Math.cos(phase);
      const sph = Math.sin(phase);
      for (let r = 0; r < d * d; r++) {
        const are = m2.re[r]!;
        const aim = m2.im[r]!;
        out.re[r]! += are * cph - aim * sph;
        out.im[r]! += are * sph + aim * cph;
      }
    }
  }
  return out;
}

export interface StationarityResult {
  readonly n: number;
  readonly gap: number;
  readonly groundWorst: number; // worst |<O>(t) - <O>(0)| over local O, t grid
  readonly thermalWorst: number;
  readonly batteryAmplitude: number; // max oscillation of the two-eigenstate battery
  readonly batteryPeriodError: number; // worst |d(t + 2pi/gap) - d(t)| — the Bohr period
  readonly crossValidationError: number; // eigenbasis path vs direct spectral evolution
  readonly solverReconstruction: number; // worst |V diag(lambda) V^T - H| entry
}

/**
 * The tombstone census: ground and thermal stationarity (the no-go's
 * executable face) plus the battery exhibition (why the loophole fails).
 */
export function tombstoneCensus(n: number, j: number, h: number, tMax: number): StationarityResult {
  const ham = tiHamiltonian(n, j, h);
  const dim = ham.rows;
  const eig = jacobiEigen(realSymmetricPack(ham), dim);
  // solver deed: V diag V^T reconstructs H
  let solverReconstruction = 0;
  for (let r = 0; r < dim; r++) {
    for (let c = 0; c < dim; c++) {
      let s = 0;
      for (let k = 0; k < dim; k++) s += eig.vectors[k * dim + r]! * eig.values[k]! * eig.vectors[k * dim + c]!;
      solverReconstruction = Math.max(solverReconstruction, Math.abs(s - ham.re[r * dim + c]!));
    }
  }
  const gap = eig.values[1]! - eig.values[0]!;
  if (!(gap > 1e-9)) throw new Error("degenerate ground state — the tombstone needs a unique vacuum");

  const observables: CMat[] = [];
  for (let i = 0; i < n; i++) observables.push(siteX(n, i), siteZ(n, i));
  for (let i = 0; i + 1 < n; i++) observables.push(mMul(siteZ(n, i), siteZ(n, i + 1)));

  // one-time eigenbasis transform of every observable: O~ = V O V^T with
  // V[r*dim + k] = component k of eigenvector r (rows are eigenvectors);
  // then <O>(t) = sum_{jk} rho~[j,k] e^{-i(l_j-l_k)t} O~[k,j] for ANY state
  // given by its eigenbasis matrix rho~ — every t point costs O(d^2).
  // (An early version transposed V — caught by physics: the ground state's
  // <Z_0> must vanish by Z2 parity; the wrong transform gave -0.244.)
  const obsTilde: Float64Array[] = observables.map((o) => {
    const t = new Float64Array(dim * dim);
    for (let r = 0; r < dim; r++) {
      for (let c = 0; c < dim; c++) {
        let s = 0;
        for (let k = 0; k < dim; k++) {
          for (let l = 0; l < dim; l++) {
            s += eig.vectors[r * dim + k]! * o.re[k * dim + l]! * eig.vectors[c * dim + l]!;
          }
        }
        t[r * dim + c] = s;
      }
    }
    return t;
  });
  const expectationAt = (rhoTildeRe: Float64Array, rhoTildeIm: Float64Array, oi: number, t: number): number => {
    const ot = obsTilde[oi]!;
    let sre = 0;
    let sim = 0;
    for (let j = 0; j < dim; j++) {
      for (let k = 0; k < dim; k++) {
        const rr = rhoTildeRe[j * dim + k]!;
        const ri = rhoTildeIm[j * dim + k]!;
        if (rr === 0 && ri === 0) continue;
        const w = (eig.values[j]! - eig.values[k]!) * t;
        const c = Math.cos(w);
        const s = Math.sin(w);
        // (rr + i ri)(c + i s) * O~[k,j] — observable real, both parts scale
        const tre = rr * c - ri * s;
        const tim = rr * s + ri * c;
        sre += tre * ot[k * dim + j]!;
        sim += tim * ot[k * dim + j]!;
      }
    }
    if (Math.abs(sim) > 1e-9) throw new Error("imaginary expectation beyond rounding — wrong object");
    return sre;
  };

  // ground state's eigenbasis matrix: |0><0| (used by the fast battery path)
  const groundTilde = new Float64Array(dim * dim);
  groundTilde[0] = 1;
  const groundTildeIm = new Float64Array(dim * dim);

  // stationarity through the DIRECT spectral evolution (projector sums,
  // real floating-point cancellation — a check that cannot fail is a
  // smuggle; the fast path is trivially zero on diagonal states).
  const projectors: CMat[] = [];
  for (let k = 0; k < dim; k++) projectors.push(projector(realEigVecToCVec(eig.vectors, dim, k)));
  const groundRho = projectors[0]!;
  const beta = 1.0;
  let z = 0;
  const w: number[] = [];
  for (let k = 0; k < dim; k++) {
    const wk = Math.exp(-beta * eig.values[k]!);
    w.push(wk);
    z += wk;
  }
  let thermal: CMat = mScale(identity(dim), 0);
  for (let k = 0; k < dim; k++) thermal = mAdd(thermal, mScale(projectors[k]!, w[k]! / z));
  const stationarityObs = [observables[0]!, observables[1]!, observables[2]!];
  let groundWorst = 0;
  let thermalWorst = 0;
  for (let t = 0; t <= tMax; t += 1.4) {
    const eg = evolveRho(groundRho, Array.from(eig.values), projectors, t);
    const et = evolveRho(thermal, Array.from(eig.values), projectors, t);
    for (const o of stationarityObs) {
      groundWorst = Math.max(groundWorst, Math.abs(expectation(eg, o) - expectation(groundRho, o)));
      thermalWorst = Math.max(thermalWorst, Math.abs(expectation(et, o) - expectation(thermal, o)));
    }
  }

  // the battery: (|E0> + |E1>)/sqrt2 — rho~ has four nonzero entries; the
  // probe observable is chosen by its ACTUAL swing (Z2 parity forbids X)
  const batteryTilde = new Float64Array(dim * dim);
  batteryTilde[0] = 0.5;
  batteryTilde[1 * dim + 1] = 0.5;
  batteryTilde[0 * dim + 1] = 0.5;
  batteryTilde[1 * dim + 0] = 0.5;
  let swingOi = 0;
  let swingAmp = -1;
  for (let oi = 0; oi < observables.length; oi++) {
    let amp = 0;
    for (let t = 0; t <= tMax; t += 0.1) {
      amp = Math.max(amp, Math.abs(expectationAt(batteryTilde, groundTildeIm, oi, t) - expectationAt(batteryTilde, groundTildeIm, oi, 0)));
    }
    if (amp > swingAmp) {
      swingAmp = amp;
      swingOi = oi;
    }
  }
  const batteryAmplitude = swingAmp;
  const period = (2 * Math.PI) / gap;
  let batteryPeriodError = 0;
  for (let t = 0.13; t < period; t += 0.17) {
    batteryPeriodError = Math.max(
      batteryPeriodError,
      Math.abs(
        expectationAt(batteryTilde, groundTildeIm, swingOi, t + period) - expectationAt(batteryTilde, groundTildeIm, swingOi, t),
      ),
    );
  }

  // cross-validation: the eigenbasis path against the direct spectral
  // evolution at one nontrivial time — two independent roads, one number
  const tCross = 1.3;
  const direct = expectation(evolveRho(groundRho, Array.from(eig.values), projectors, tCross), observables[1]!);
  const fast = expectationAt(groundTilde, groundTildeIm, 1, tCross);
  const crossError = Math.abs(direct - fast);

  return {
    n,
    gap,
    groundWorst,
    thermalWorst,
    batteryAmplitude,
    batteryPeriodError,
    crossValidationError: crossError,
    solverReconstruction,
  };
}
