/**
 * THE CLOCK REGISTER — boards B2 (the token) and B5 (back-action), the
 * quantum composite layer.
 *
 * Space: clock chain (dim C = 2^n) (x) runner (token x data, dim
 * D = (T+1) 2^m; index d = token*2^m + data), CLOCK-major total index
 * z*runnerDim + d (the family kron's convention — read before use, batch 36).
 * One DRIVE period:
 *   U_per = K . (F (x) I_D)
 *   K = P_+ (x) R + P_- (x) I_D
 * where P_+ projects the clock onto the positive order sector
 * (m_hat(z) = (n - 2 popcount(z))/n > 0) and R is the runner permutation.
 * K is itself a permutation of the product basis: Pi(z, d) = (z, R[d] if
 * z in + else d).
 *
 * Why the beat keys the load: on the eigenstate-order orbit the strobed
 * clock is exactly |0...0> or |1...1>, wholly inside one sector at every
 * keying — so the runner advances on every SECOND period (the subharmonic,
 * beat-rate tick) and the keying NEVER splits the clock state: zero
 * back-action, exactly. Off the orbit (superpositions, detuning, reads)
 * the sectors split and the frontier begins — censused, not assumed.
 */
import {
  type CMat,
  type CVec,
  basisVec,
  kron,
  mDagger,
  mMul,
  vKron,
} from "../core/cmat.js";
import { randomStateVec, vecToRho } from "../core/states.js";
import { applyUnitary, partialTrace } from "../core/channels.js";
import { traceDistance, vonNeumannEntropy } from "../core/measures.js";
import { type Rng } from "../core/rng.js";
import { classicalAfter, popcount, runnerPermutation, type RevGate } from "./compile.js";
import { echoFloquet, polarizedRho, siteZ, type EchoParams } from "./beat.js";

export interface CompositeDims {
  readonly n: number; // clock qubits
  readonly clockDim: number; // 2^n
  readonly runnerDim: number; // (T+1) * 2^m
  readonly totalDim: number;
  readonly perm: Int32Array; // Pi over the product basis
  readonly keyF: CMat; // the clock echo
}

export function compositeDims(
  n: number,
  gates: readonly RevGate[],
  m: number,
  theta: number,
): CompositeDims {
  const clockDim = 1 << n;
  const runnerDim = (gates.length + 1) * (1 << m);
  const r = runnerPermutation(gates, m);
  const perm = new Int32Array(clockDim * runnerDim);
  for (let z = 0; z < clockDim; z++) {
    const inPlus = popcount(z) < n / 2;
    for (let d = 0; d < runnerDim; d++) {
      perm[z * runnerDim + d] = z * runnerDim + (inPlus ? r[d]! : d);
    }
  }
  const params: EchoParams = {
    n,
    theta,
    fields: Array<number>(n).fill(0),
    couplings: Array<number>(n - 1).fill(1.1),
  };
  return {
    n,
    clockDim,
    runnerDim,
    totalDim: clockDim * runnerDim,
    perm,
    keyF: echoFloquet(params),
  };
}

export function makeComposite(n: number, gates: readonly RevGate[], m: number): CompositeDims {
  return compositeDims(n, gates, m, Math.PI / 2);
}

/**
 * Apply the clock unitary F (x) I to rho. For each (d1, d2) pair the C x C
 * z-block transforms as B' = F B F+ through the family kernel — O(D^2 C^3)
 * total. (d1 = d2 AND d1 != d2 both included: collapsing the pair loop
 * silently zeroes the runner's coherences while every clock marginal still
 * passes — batch 36; the cargo check caught what the marginals blessed.)
 */
export function applyClockUnitary(rho: CMat, f: CMat, cDim: number, dDim: number): CMat {
  const fd = mDagger(f);
  const out: CMat = {
    rows: rho.rows,
    cols: rho.cols,
    re: new Float64Array(rho.re.length),
    im: new Float64Array(rho.im.length),
  };
  const block: CMat = {
    rows: cDim,
    cols: cDim,
    re: new Float64Array(cDim * cDim),
    im: new Float64Array(cDim * cDim),
  };
  for (let d1 = 0; d1 < dDim; d1++) {
    for (let d2 = 0; d2 < dDim; d2++) {
      for (let z1 = 0; z1 < cDim; z1++) {
        for (let z2 = 0; z2 < cDim; z2++) {
          block.re[z1 * cDim + z2] = rho.re[(z1 * dDim + d1) * rho.cols + (z2 * dDim + d2)]!;
          block.im[z1 * cDim + z2] = rho.im[(z1 * dDim + d1) * rho.cols + (z2 * dDim + d2)]!;
        }
      }
      const t = mMul(mMul(f, block), fd);
      for (let z1 = 0; z1 < cDim; z1++) {
        for (let z2 = 0; z2 < cDim; z2++) {
          out.re[(z1 * dDim + d1) * out.cols + (z2 * dDim + d2)] = t.re[z1 * cDim + z2]!;
          out.im[(z1 * dDim + d1) * out.cols + (z2 * dDim + d2)] = t.im[z1 * cDim + z2]!;
        }
      }
    }
  }
  return out;
}

/** Apply the keyed permutation Pi to rho: out[Pi[i], Pi[j]] = in[i, j]. */
export function applyKeyedPermutation(rho: CMat, perm: ArrayLike<number>): CMat {
  const out: CMat = {
    rows: rho.rows,
    cols: rho.cols,
    re: new Float64Array(rho.re.length),
    im: new Float64Array(rho.im.length),
  };
  const d = rho.cols;
  for (let i = 0; i < rho.rows; i++) {
    const pi = perm[i]!;
    for (let j = 0; j < rho.cols; j++) {
      out.re[pi * d + perm[j]!] = rho.re[i * d + j]!;
      out.im[pi * d + perm[j]!] = rho.im[i * d + j]!;
    }
  }
  return out;
}

/** One drive period on the total state. */
export function compositePeriod(rho: CMat, dims: CompositeDims): CMat {
  const afterEcho = applyClockUnitary(rho, dims.keyF, dims.clockDim, dims.runnerDim);
  return applyKeyedPermutation(afterEcho, dims.perm);
}

// ---------------------------------------------------------------------------
// Readouts.
// ---------------------------------------------------------------------------

/** Clock reduced state: trace out the runner (dims [C, D]). */
export function clockReduced(rho: CMat, dims: CompositeDims): CMat {
  return partialTrace(rho, [dims.clockDim, dims.runnerDim], [1]);
}

/** P(token = k) summed over clock and data. */
export function tokenProb(rho: CMat, dims: CompositeDims, m: number, k: number): number {
  const dataDim = 1 << m;
  let p = 0;
  for (let z = 0; z < dims.clockDim; z++) {
    for (let x = 0; x < dataDim; x++) {
      const idx = z * dims.runnerDim + k * dataDim + x;
      p += rho.re[idx * rho.cols + idx]!;
    }
  }
  return p;
}

/** Clock order parameter m of a clock-space state, through the kernel. */
export function clockOrder(rhoClock: CMat, n: number): number {
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const z = siteZ(n, i);
    let sre = 0;
    for (let r = 0; r < rhoClock.rows; r++) {
      for (let c = 0; c < rhoClock.cols; c++) {
        sre +=
          rhoClock.re[c * rhoClock.cols + r]! * z.re[r * z.cols + c]! -
          rhoClock.im[c * rhoClock.cols + r]! * z.im[r * z.cols + c]!;
      }
    }
    acc += sre;
  }
  return acc / n;
}

// ---------------------------------------------------------------------------
// B2 witnesses: the orbit run — beat-rate advance, zero back-action, cargo.
// ---------------------------------------------------------------------------

export interface OrbitRun {
  readonly beats: number;
  readonly advanceWorst: number; // worst |P(token=k after 2k periods) - 1|
  readonly backActionWorst: number; // worst trace distance(clock reduced, free clock)
  readonly cargoWorst: number; // worst |conditional data - expected permuted rho|_max
}

/**
 * The orbit run: clock starts |0...0>; data starts each of `runs` random
 * superpositions. After 2k drive periods (k beats): token = k exactly,
 * clock untouched, and conditioned on the token the data equals the direct
 * gate product U_k...U_1 |psi> — the T3 semantics, beat-driven.
 */
export function orbitRun(
  rng: Rng,
  n: number,
  gates: readonly RevGate[],
  m: number,
  runs: number,
): OrbitRun {
  const dims = makeComposite(n, gates, m);
  const dataDim = 1 << m;
  const tokenCount = gates.length + 1;
  let advanceWorst = 0;
  let backActionWorst = 0;
  let cargoWorst = 0;
  for (let run = 0; run < runs; run++) {
    const psi = randomStateVec(rng, dataDim);
    let rho = kron(polarizedRho(n), vecToRho(vKron(basisVec(tokenCount, 0), psi)));
    let freeClock = polarizedRho(n);
    for (let k = 1; k <= gates.length; k++) {
      rho = compositePeriod(rho, dims);
      rho = compositePeriod(rho, dims);
      freeClock = applyUnitary(freeClock, dims.keyF);
      freeClock = applyUnitary(freeClock, dims.keyF);
      advanceWorst = Math.max(advanceWorst, Math.abs(tokenProb(rho, dims, m, k) - 1));
      backActionWorst = Math.max(backActionWorst, traceDistance(clockReduced(rho, dims), freeClock));
      const cargo = conditionalData(rho, dims, m, k);
      const expect = expectedPermutedRho(psi, gates, k);
      for (let i = 0; i < cargo.rows; i++) {
        for (let j = 0; j < cargo.cols; j++) {
          cargoWorst = Math.max(
            cargoWorst,
            Math.abs(cargo.re[i * cargo.cols + j]! - expect.re[i * expect.cols + j]!),
            Math.abs(cargo.im[i * cargo.cols + j]! - expect.im[i * expect.cols + j]!),
          );
        }
      }
    }
  }
  return { beats: gates.length, advanceWorst, backActionWorst, cargoWorst };
}

/** Reduced data state conditioned on token = k (clock and other tokens traced). */
export function conditionalData(rho: CMat, dims: CompositeDims, m: number, k: number): CMat {
  const dataDim = 1 << m;
  const out: CMat = {
    rows: dataDim,
    cols: dataDim,
    re: new Float64Array(dataDim * dataDim),
    im: new Float64Array(dataDim * dataDim),
  };
  let norm = 0;
  for (let z = 0; z < dims.clockDim; z++) {
    for (let x1 = 0; x1 < dataDim; x1++) {
      for (let x2 = 0; x2 < dataDim; x2++) {
        const i = z * dims.runnerDim + k * dataDim + x1;
        const j = z * dims.runnerDim + k * dataDim + x2;
        out.re[x1 * dataDim + x2]! += rho.re[i * rho.cols + j]!;
        out.im[x1 * dataDim + x2]! += rho.im[i * rho.cols + j]!;
      }
    }
  }
  for (let x = 0; x < dataDim; x++) norm += out.re[x * dataDim + x]!;
  for (let i = 0; i < dataDim * dataDim; i++) {
    out.re[i]! /= norm;
    out.im[i]! /= norm;
  }
  return out;
}

/** The expected data state after k gates on a superposition (gates are permutations). */
export function expectedPermutedRho(psi: CVec, gates: readonly RevGate[], k: number): CMat {
  const dataDim = psi.n;
  const out: CMat = {
    rows: dataDim,
    cols: dataDim,
    re: new Float64Array(dataDim * dataDim),
    im: new Float64Array(dataDim * dataDim),
  };
  for (let x = 0; x < dataDim; x++) {
    if (psi.re[x] === 0 && psi.im[x] === 0) continue;
    const y = classicalAfter(gates, x, k);
    for (let x2 = 0; x2 < dataDim; x2++) {
      if (psi.re[x2] === 0 && psi.im[x2] === 0) continue;
      const y2 = classicalAfter(gates, x2, k);
      const are = psi.re[x]!;
      const aim = psi.im[x]!;
      const bre = psi.re[x2]!;
      const bim = -psi.im[x2]!; // conjugated
      out.re[y * dataDim + y2]! += are * bre - aim * bim;
      out.im[y * dataDim + y2]! += are * bim + aim * bre;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// B5 census: off the orbit — random clock states, detuning, repeated reads.
// The back-action probe is ALWAYS the loaded quantity against its own
// unloaded twin from the same initial state — the deviation of the object,
// not of some ideal it never claimed to be.
// ---------------------------------------------------------------------------

export interface FrontierRow {
  readonly probe: string;
  readonly beat: number;
  readonly advanceFidelity: number; // P(token = beat)
  readonly clockEntropyBits: number; // entanglement clock (x) rest
  readonly orderBackAction: number; // |m(loaded) - m(free twin)| at the same strobe
}

/** Random clock pure states: the sectors split, entanglement begins. */
export function randomClockCensus(
  rng: Rng,
  n: number,
  gates: readonly RevGate[],
  m: number,
  runs: number,
): FrontierRow[] {
  const rows: FrontierRow[] = [];
  const dims = makeComposite(n, gates, m);
  const tokenCount = gates.length + 1;
  const dataDim = 1 << m;
  for (let run = 0; run < runs; run++) {
    const psi = randomStateVec(rng, dataDim);
    const clockPsi = randomStateVec(rng, dims.clockDim);
    let rho = kron(vecToRho(clockPsi), vecToRho(vKron(basisVec(tokenCount, 0), psi)));
    let twin = vecToRho(clockPsi);
    for (let k = 1; k <= gates.length; k++) {
      rho = compositePeriod(rho, dims);
      rho = compositePeriod(rho, dims);
      twin = applyUnitary(twin, dims.keyF);
      twin = applyUnitary(twin, dims.keyF);
      const red = clockReduced(rho, dims);
      rows.push({
        probe: `random-clock#${run}`,
        beat: k,
        advanceFidelity: tokenProb(rho, dims, m, k),
        clockEntropyBits: vonNeumannEntropy(red),
        orderBackAction: Math.abs(clockOrder(red, n) - clockOrder(twin, n)),
      });
    }
  }
  return rows;
}

/** Detuned census: theta = pi/2 + delta — the advance fidelity decays with the echo. */
export function detunedCensus(
  n: number,
  delta: number,
  gates: readonly RevGate[],
  m: number,
): FrontierRow[] {
  const rows: FrontierRow[] = [];
  const dims = compositeDims(n, gates, m, Math.PI / 2 + delta);
  const dataDim = 1 << m;
  const tokenCount = gates.length + 1;
  const psi = basisVec(dataDim, 0b101);
  let rho = kron(polarizedRho(n), vecToRho(vKron(basisVec(tokenCount, 0), psi)));
  let twin = polarizedRho(n);
  for (let k = 1; k <= gates.length; k++) {
    rho = compositePeriod(rho, dims);
    rho = compositePeriod(rho, dims);
    twin = applyUnitary(twin, dims.keyF);
    twin = applyUnitary(twin, dims.keyF);
    const red = clockReduced(rho, dims);
    rows.push({
      probe: `detuned delta=${delta.toFixed(3)}`,
      beat: k,
      advanceFidelity: tokenProb(rho, dims, m, k),
      clockEntropyBits: vonNeumannEntropy(red),
      orderBackAction: Math.abs(clockOrder(red, n) - clockOrder(twin, n)),
    });
  }
  return rows;
}

/** Repeated-read census: a phase flip (prob q) on clock qubit 0 each period — the readout wall. */
export function readDephasingCensus(
  n: number,
  q: number,
  gates: readonly RevGate[],
  m: number,
): FrontierRow[] {
  const rows: FrontierRow[] = [];
  const dims = makeComposite(n, gates, m);
  // phase-flip channel as the mixture rho -> (1-q) rho + q Z0 rho Z0 —
  // Z0 is diagonal +-1 on the clock digit, so this is an O((CD)^2) sign
  // scaling, never a dense (CD)^3 Kraus multiply (batch 36 performance find)
  const z0bit = (z: number) => ((z & 1) === 1 ? -1 : 1); // qubit 0 = bit 0
  const phaseFlip = (rho: CMat): CMat => {
    const out: CMat = {
      rows: rho.rows,
      cols: rho.cols,
      re: new Float64Array(rho.re.length),
      im: new Float64Array(rho.im.length),
    };
    for (let z1 = 0; z1 < dims.clockDim; z1++) {
      const s1 = z0bit(z1);
      for (let z2 = 0; z2 < dims.clockDim; z2++) {
        const s = s1 * z0bit(z2);
        for (let d1 = 0; d1 < dims.runnerDim; d1++) {
          const i1 = (z1 * dims.runnerDim + d1) * rho.cols;
          for (let d2 = 0; d2 < dims.runnerDim; d2++) {
            const i = i1 + (z2 * dims.runnerDim + d2);
            out.re[i] = (1 - q) * rho.re[i]! + q * s * rho.re[i]!;
            out.im[i] = (1 - q) * rho.im[i]! + q * s * rho.im[i]!;
          }
        }
      }
    }
    return out;
  };
  const dataDim = 1 << m;
  const tokenCount = gates.length + 1;
  const psi = basisVec(dataDim, 0b101);
  let rho = kron(polarizedRho(n), vecToRho(vKron(basisVec(tokenCount, 0), psi)));
  let twin = polarizedRho(n);
  const twinFlip = (t: CMat): CMat => {
    const o: CMat = {
      rows: t.rows,
      cols: t.cols,
      re: new Float64Array(t.re.length),
      im: new Float64Array(t.im.length),
    };
    for (let z1 = 0; z1 < dims.clockDim; z1++) {
      for (let z2 = 0; z2 < dims.clockDim; z2++) {
        const s = z0bit(z1) * z0bit(z2);
        const i = z1 * t.cols + z2;
        o.re[i] = (1 - q) * t.re[i]! + q * s * t.re[i]!;
        o.im[i] = (1 - q) * t.im[i]! + q * s * t.im[i]!;
      }
    }
    return o;
  };
  for (let k = 1; k <= gates.length; k++) {
    rho = compositePeriod(rho, dims);
    rho = phaseFlip(rho);
    rho = compositePeriod(rho, dims);
    rho = phaseFlip(rho);
    twin = applyUnitary(twin, dims.keyF);
    twin = twinFlip(twin);
    twin = applyUnitary(twin, dims.keyF);
    twin = twinFlip(twin);
    const red = clockReduced(rho, dims);
    rows.push({
      probe: `read-dephase q=${q.toFixed(2)}`,
      beat: k,
      advanceFidelity: tokenProb(rho, dims, m, k),
      clockEntropyBits: vonNeumannEntropy(red),
      orderBackAction: Math.abs(clockOrder(red, n) - clockOrder(twin, n)),
    });
  }
  return rows;
}

/**
 * v0.3.0 — THE READ WALL'S BIT-FLIP FACE (the priced boundary of TC8):
 * the phase channel was exactly free on the orbit; the BIT-FLIP channel is
 * the honest wall. X on clock qubit 0 with prob q per period, as the
 * mixture rho -> (1-q) rho + q X0 rho X0 — X0 is a bit-permutation on the
 * clock index, so this is an O((CD)^2) index swap, never a dense multiply.
 * Returns the advance fidelity and order at each beat under the wall.
 */
export function bitFlipReadCensus(
  n: number,
  q: number,
  gates: readonly RevGate[],
  m: number,
): FrontierRow[] {
  const rows: FrontierRow[] = [];
  const dims = makeComposite(n, gates, m);
  const flipZ = (z: number): number => z ^ 1; // qubit 0 = bit 0
  const bitFlip = (rho: CMat): CMat => {
    const out: CMat = {
      rows: rho.rows,
      cols: rho.cols,
      re: new Float64Array(rho.re.length),
      im: new Float64Array(rho.im.length),
    };
    const d = rho.cols;
    for (let z1 = 0; z1 < dims.clockDim; z1++) {
      const f1 = flipZ(z1);
      for (let d1 = 0; d1 < dims.runnerDim; d1++) {
        for (let z2 = 0; z2 < dims.clockDim; z2++) {
          const f2 = flipZ(z2);
          for (let d2 = 0; d2 < dims.runnerDim; d2++) {
            const dst = (z1 * dims.runnerDim + d1) * d + (z2 * dims.runnerDim + d2);
            const sf = (f1 * dims.runnerDim + d1) * d + (f2 * dims.runnerDim + d2);
            out.re[dst] = (1 - q) * rho.re[dst]! + q * rho.re[sf]!;
            out.im[dst] = (1 - q) * rho.im[dst]! + q * rho.im[sf]!;
          }
        }
      }
    }
    return out;
  };
  const dataDim = 1 << m;
  const tokenCount = gates.length + 1;
  const psi = basisVec(dataDim, 0b101);
  let rho = kron(polarizedRho(n), vecToRho(vKron(basisVec(tokenCount, 0), psi)));
  let twin = polarizedRho(n);
  const twinFlip = (t: CMat): CMat => {
    const o: CMat = {
      rows: t.rows,
      cols: t.cols,
      re: new Float64Array(t.re.length),
      im: new Float64Array(t.im.length),
    };
    for (let z1 = 0; z1 < dims.clockDim; z1++) {
      for (let z2 = 0; z2 < dims.clockDim; z2++) {
        const src = (flipZ(z1) * t.cols + flipZ(z2));
        const dst = z1 * t.cols + z2;
        o.re[dst] = (1 - q) * t.re[dst]! + q * t.re[src]!;
        o.im[dst] = (1 - q) * t.im[dst]! + q * t.im[src]!;
      }
    }
    return o;
  };
  for (let k = 1; k <= gates.length; k++) {
    rho = compositePeriod(rho, dims);
    rho = bitFlip(rho);
    rho = compositePeriod(rho, dims);
    rho = bitFlip(rho);
    twin = applyUnitary(twin, dims.keyF);
    twin = twinFlip(twin);
    twin = applyUnitary(twin, dims.keyF);
    twin = twinFlip(twin);
    const red = clockReduced(rho, dims);
    rows.push({
      probe: `bit-flip-read q=${q.toFixed(3)}`,
      beat: k,
      advanceFidelity: tokenProb(rho, dims, m, k),
      clockEntropyBits: vonNeumannEntropy(red),
      orderBackAction: Math.abs(clockOrder(red, n) - clockOrder(twin, n)),
    });
  }
  return rows;
}

/**
 * v0.4.0 — THE PAULI WALL (the priced question of TC22): X-flip reads are
 * absorbed (self-synchronization) and Z-flip reads are exactly free (TC8);
 * what about Y? Y0 = i X0 Z0, so Y-conjugation = X-conjugation after
 * Z-conjugation (the global phase cancels) — compose the two structured
 * maps. If the token fidelity stays exactly 1, the ENTIRE single-Pauli
 * wall on the clock register is absorbed at the keying layer.
 */
export function yFlipReadCensus(
  n: number,
  q: number,
  gates: readonly RevGate[],
  m: number,
): FrontierRow[] {
  const rows: FrontierRow[] = [];
  const dims = makeComposite(n, gates, m);
  const flipZ = (z: number): number => z ^ 1;
  const signZ = (z: number): number => (z & 1) === 1 ? -1 : 1;
  // Y rho Y = X (Z rho Z) X, each an O((CD)^2) structured map on bit 0
  const pauliY = (rho: CMat): CMat => {
    // Z pass: scale (z1,z2) block by signZ(z1)*signZ(z2)
    const afterZ: CMat = {
      rows: rho.rows,
      cols: rho.cols,
      re: new Float64Array(rho.re.length),
      im: new Float64Array(rho.im.length),
    };
    const d = rho.cols;
    for (let z1 = 0; z1 < dims.clockDim; z1++) {
      const s1 = signZ(z1);
      for (let z2 = 0; z2 < dims.clockDim; z2++) {
        const s = s1 * signZ(z2);
        for (let d1 = 0; d1 < dims.runnerDim; d1++) {
          for (let d2 = 0; d2 < dims.runnerDim; d2++) {
            const i = (z1 * dims.runnerDim + d1) * d + (z2 * dims.runnerDim + d2);
            afterZ.re[i] = s * rho.re[i]!;
            afterZ.im[i] = s * rho.im[i]!;
          }
        }
      }
    }
    // X pass: mix (1-q) id + q flip-source
    const out: CMat = {
      rows: rho.rows,
      cols: rho.cols,
      re: new Float64Array(rho.re.length),
      im: new Float64Array(rho.im.length),
    };
    for (let z1 = 0; z1 < dims.clockDim; z1++) {
      const f1 = flipZ(z1);
      for (let d1 = 0; d1 < dims.runnerDim; d1++) {
        for (let z2 = 0; z2 < dims.clockDim; z2++) {
          const f2 = flipZ(z2);
          for (let d2 = 0; d2 < dims.runnerDim; d2++) {
            const dst = (z1 * dims.runnerDim + d1) * d + (z2 * dims.runnerDim + d2);
            const src = (f1 * dims.runnerDim + d1) * d + (f2 * dims.runnerDim + d2);
            out.re[dst] = (1 - q) * afterZ.re[dst]! + q * afterZ.re[src]!;
            out.im[dst] = (1 - q) * afterZ.im[dst]! + q * afterZ.im[src]!;
          }
        }
      }
    }
    return out;
  };
  const dataDim = 1 << m;
  const tokenCount = gates.length + 1;
  const psi = basisVec(dataDim, 0b101);
  let rho = kron(polarizedRho(n), vecToRho(vKron(basisVec(tokenCount, 0), psi)));
  let twin = polarizedRho(n);
  const twinY = (t: CMat): CMat => {
    const o: CMat = {
      rows: t.rows,
      cols: t.cols,
      re: new Float64Array(t.re.length),
      im: new Float64Array(t.im.length),
    };
    for (let z1 = 0; z1 < dims.clockDim; z1++) {
      const f1 = flipZ(z1);
      const s1 = signZ(z1);
      for (let z2 = 0; z2 < dims.clockDim; z2++) {
        const f2 = flipZ(z2);
        const s2 = signZ(z2);
        const dst = z1 * t.cols + z2;
        const src = f1 * t.cols + f2;
        o.re[dst] = (1 - q) * (s1 * s2 * t.re[dst]!) + q * (s1 * s2 * t.re[src]!);
        o.im[dst] = (1 - q) * (s1 * s2 * t.im[dst]!) + q * (s1 * s2 * t.im[src]!);
      }
    }
    return o;
  };
  for (let k = 1; k <= gates.length; k++) {
    rho = compositePeriod(rho, dims);
    rho = pauliY(rho);
    rho = compositePeriod(rho, dims);
    rho = pauliY(rho);
    twin = applyUnitary(twin, dims.keyF);
    twin = twinY(twin);
    twin = applyUnitary(twin, dims.keyF);
    twin = twinY(twin);
    const red = clockReduced(rho, dims);
    rows.push({
      probe: `y-flip-read q=${q.toFixed(3)}`,
      beat: k,
      advanceFidelity: tokenProb(rho, dims, m, k),
      clockEntropyBits: vonNeumannEntropy(red),
      orderBackAction: Math.abs(clockOrder(red, n) - clockOrder(twin, n)),
    });
  }
  return rows;
}

/**
 * v0.4.0 — THE T1 WALL (the honest endpoint): amplitude damping on clock
 * qubit 0 (rate gamma per period). Damping MERGES the orbit — |1> -> |0> —
 * so the sector lock that absorbs Pauli noise CANNOT survive: the branch
 * populations flow toward the bit-0-cleared state regardless of strobe parity.
 * Kraus pair on bit 0: K0 = |0><0| + sqrt(1-gamma)|1><1| (diagonal scale),
 * K1 = sqrt(gamma)|0><1| (index merge) — both O((CD)^2) structured.
 */
export interface T1Row {
  readonly gamma: number;
  readonly beat: number;
  readonly advanceFidelity: number;
  readonly order: number;
}

export function t1ReadCensus(n: number, gamma: number, gates: readonly RevGate[], m: number): T1Row[] {
  const rows: T1Row[] = [];
  const dims = makeComposite(n, gates, m);
  // out[z1,z2] = c(z1)c(z2) rho[z1,z2] + (both bit0=0) gamma * rho[z1+1, z2+1]
  const applyT1 = (rho: CMat): CMat => {
    const out: CMat = {
      rows: rho.rows,
      cols: rho.cols,
      re: new Float64Array(rho.re.length),
      im: new Float64Array(rho.im.length),
    };
    const d = rho.cols;
    const s0 = Math.sqrt(1 - gamma);
    const c = (z: number): number => (z & 1) === 1 ? s0 : 1;
    for (let z1 = 0; z1 < dims.clockDim; z1++) {
      for (let d1 = 0; d1 < dims.runnerDim; d1++) {
        for (let z2 = 0; z2 < dims.clockDim; z2++) {
          const base = (z1 * dims.runnerDim + d1) * d + (z2 * dims.runnerDim);
          for (let d2 = 0; d2 < dims.runnerDim; d2++) {
            const i = base + d2;
            out.re[i] = out.re[i]! + c(z1) * c(z2) * rho.re[i]!;
            out.im[i] = out.im[i]! + c(z1) * c(z2) * rho.im[i]!;
          }
          if ((z1 & 1) === 0 && (z2 & 1) === 0 && z1 + 1 < dims.clockDim && z2 + 1 < dims.clockDim) {
            const src = ((z1 + 1) * dims.runnerDim + d1) * d + ((z2 + 1) * dims.runnerDim);
            for (let d2 = 0; d2 < dims.runnerDim; d2++) {
              out.re[base + d2] = out.re[base + d2]! + gamma * rho.re[src + d2]!;
              out.im[base + d2] = out.im[base + d2]! + gamma * rho.im[src + d2]!;
            }
          }
        }
      }
    }
    return out;
  };
  const dataDim = 1 << m;
  const tokenCount = gates.length + 1;
  const psi = basisVec(dataDim, 0b101);
  let rho = kron(polarizedRho(n), vecToRho(vKron(basisVec(tokenCount, 0), psi)));
  for (let k = 1; k <= gates.length; k++) {
    rho = compositePeriod(rho, dims);
    rho = applyT1(rho);
    rho = compositePeriod(rho, dims);
    rho = applyT1(rho);
    const red = clockReduced(rho, dims);
    rows.push({
      gamma,
      beat: k,
      advanceFidelity: tokenProb(rho, dims, m, k),
      order: clockOrder(red, n),
    });
  }
  return rows;
}
