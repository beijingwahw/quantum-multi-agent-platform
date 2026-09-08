/**
 * The executable witnesses — every number the price lines quote is re-derived
 * here from scratch, two-path (closed form vs numeric / Monte Carlo), never
 * transcribed. Law R5: a witness that fails fails the build.
 */
import { Rng } from "./rng.js";
import {
  apply,
  c,
  cabs2,
  cmul,
  cconj,
  conditionalData,
  dagger,
  gramSchmidtUnitary,
  identity,
  inner,
  kron2,
  matmul,
  normalize,
  outer,
  traceControl,
  traceData,
  type C,
  type Mat,
  type Vec,
} from "./linalg.js";
import {
  agentUtility,
  chargeClosedForm,
  grovesPayment,
  q,
  qCmp,
  qDiv,
  qEq,
  qIsZero,
  qMul,
  qSub,
  welfareGap,
  type Q,
} from "./exact.js";

export interface WitnessResult {
  /** The short id price lines and executions cite (R7 resolves against this). */
  readonly id: string;
  readonly name: string;
  readonly pass: boolean;
  readonly detail: string;
}

/** Boltzmann's constant, J/K — exact by the 2019 SI definition. The single
 * source: W-A's Landauer floor and W-E's joule faces quote the same exact
 * constant (was two identical literals before v0.2.1 — one law, one number). */
const K_B = 1.380649e-23;

/** The T4 uncertain-readout schedule — expected erasure bits per clocked
 * readout cycle at depth T, (T+1)·log2(T+1). The single source: W-A meters
 * eternity with it and W-E's tariff prices the FK spectral row by it (was
 * two identical inline formulas — one law, one definition). */
const t4Erasure = (T: number): number => (T + 1) * Math.log2(T + 1);

// ---------------------------------------------------------------------------
// W-A — the Landauer floor, two-path: k exact, ln2 by quadrature, metered eternity.
// ---------------------------------------------------------------------------

/** ln2 as the midpoint-rule quadrature of 1/x over [1,2] — the repo's two-path
 * derivation, shared by W-A (the floor) and W-E (the tariff's joule faces). */
function ln2Quadrature(steps: number): number {
  const h = 1 / steps;
  let s = 0;
  for (let i = 0; i < steps; i++) s += 1 / (1 + (i + 0.5) * h);
  return s * h;
}

function witnessLandauer(): WitnessResult {
  // path 1: the closed form
  const ln2Closed = Math.LN2;
  // path 2: ln2 as the quadrature of 1/x over [1,2] (midpoint rule)
  const ln2Quad = ln2Quadrature(1_000_000);
  const ln2Ok = Math.abs(ln2Quad - ln2Closed) < 1e-12;

  const e300 = K_B * 300 * ln2Closed;
  const e10mK = K_B * 0.01 * ln2Closed;
  const ratioOk = Math.abs(e300 / e10mK - 30000) < 1e-6;

  const b10 = t4Erasure(10);
  const b100 = t4Erasure(100);
  const b1000 = t4Erasure(1000);
  const meteredOk = b10 < b100 && b100 < b1000;

  return {
    id: "W-A",
    name: "W-A the Landauer floor, two-path (k exact; ln2 by quadrature; eternity metered)",
    pass: ln2Ok && ratioOk && meteredOk,
    detail:
      `ln2 quadrature vs closed: ${ln2Quad.toFixed(15)} vs ${ln2Closed.toFixed(15)}; ` +
      `E(300 K) = ${e300.toExponential(5)} J, E(10 mK) = ${e10mK.toExponential(5)} J, ratio ${(e300 / e10mK).toFixed(3)}; ` +
      `readout metering (T+1)log2(T+1): depth 10/100/1000 -> ${b10.toFixed(2)}/${b100.toFixed(2)}/${b1000.toFixed(2)} erasure bits, monotone unbounded`,
  };
}

// ---------------------------------------------------------------------------
// W-B — the choice toy: coherent branching, engineered stability vs random
// programs, the clone gap (no-cloning as a rephasing-covariance separation),
// the certification toll, and no leakage of the choice weights.
// ---------------------------------------------------------------------------

/** The primitive itself: alpha|0>⊗U0|psi> + beta|1>⊗U1|psi> (controlled-unitary). */
function chooseState(alpha: C, beta: C, u0: Mat, u1: Mat, psi: Vec): Vec {
  const d0 = apply(u0, psi);
  const d1 = apply(u1, psi);
  return [
    cmul(alpha, d0[0] as C),
    cmul(alpha, d0[1] as C),
    cmul(beta, d1[0] as C),
    cmul(beta, d1[1] as C),
  ];
}

function witnessChoiceToy(): WitnessResult {
  const seed = 20260906;
  const rng = new Rng(seed);
  const psi = normalize([c(1), c(0, 1)]);
  const psiStd = normalize([c(1), c(0)]); // |0> — the engineered target's support

  // (1) coherence: control off-diagonal = alpha*conj(beta)*<psi|U1†U0|psi>, exact vs closed form
  const alpha = c(Math.SQRT1_2, 0);
  const beta = c(0, Math.SQRT1_2);
  const uA = gramSchmidtUnitary(() => rng.gaussian(), 2);
  const uB = gramSchmidtUnitary(() => rng.gaussian(), 2);
  const st = chooseState(alpha, beta, uA, uB, psi);
  const rhoC = traceData(outer(st), 2);
  const numeric = (rhoC[0] as readonly C[])[1] as C;
  const closedOverlap = inner(apply(uB, psi), apply(uA, psi));
  const closedCoherence = cmul(cmul(alpha, cconj(beta)), closedOverlap);
  const coherenceOk = Math.abs(numeric.re - closedCoherence.re) < 1e-15 && Math.abs(numeric.im - closedCoherence.im) < 1e-15;

  // (2) engineered stability: diagonal branch unitaries share |0> as eigenvector -> the
  // desired world is an invariant subspace; data marginal is exactly |0><0|
  const uEng0: Mat = [
    [c(Math.cos(1.1), Math.sin(1.1)), c(0)],
    [c(0), c(Math.cos(-1.1), Math.sin(-1.1))],
  ];
  const uEng1: Mat = [
    [c(Math.cos(0.7), Math.sin(0.7)), c(0)],
    [c(0), c(Math.cos(-0.7), Math.sin(-0.7))],
  ];
  const stEng = chooseState(alpha, beta, uEng0, uEng1, psiStd);
  const rhoD = traceControl(outer(stEng), 2);
  const fidelity = (rhoD[0] as readonly C[])[0] as C;
  const offDiag = (rhoD[0] as readonly C[])[1] as C;
  const engineeredOk = Math.abs(fidelity.re - 1) < 1e-15 && Math.abs(fidelity.im) < 1e-15 && cabs2(offDiag) < 1e-30;

  // (3) generic programs break stability: seeded random pairs never touch exact;
  // the single-branch fidelity to |0> averages near the Haar mean 1/2
  let maxF = 0;
  let sumF = 0;
  const trials = 40;
  for (let t = 0; t < trials; t++) {
    const u0 = gramSchmidtUnitary(() => rng.gaussian(), 2);
    const u1 = gramSchmidtUnitary(() => rng.gaussian(), 2);
    for (const u of [u0, u1]) {
      const f = cabs2(inner([c(1), c(0)], apply(u, psiStd)));
      maxF = Math.max(maxF, f);
      sumF += f;
    }
  }
  const meanF = sumF / (2 * trials);
  const genericOk = maxF < 0.999 && meanF > 0.35 && meanF < 0.65;

  // (4) the clone gap: a CNOT 'copy' of the control is rephasing-covariant; a true
  // clone would not be. The complex coherences may coincide at isolated phases, but
  // covariance vs rotation separates the objects for every phase — that mark is no-cloning
  // made executable.
  let cloneOk = true;
  const gapLine: string[] = [];
  const base = Math.PI / 4;
  const pairAt = (phi: number): C => {
    const a = c(Math.cos(base + phi) * Math.SQRT1_2, Math.sin(base + phi) * Math.SQRT1_2);
    const b = c(Math.cos(base + phi) * Math.SQRT1_2, Math.sin(base + phi) * Math.SQRT1_2);
    return cmul(a, cconj(b)); // what a CNOT copy actually holds
  };
  const cloneAt = (phi: number): C => {
    const a = c(Math.cos(base + phi) * Math.SQRT1_2, Math.sin(base + phi) * Math.SQRT1_2);
    return cmul(a, a); // what a clone would need to hold
  };
  const pairBaseTerm = pairAt(0);
  const cloneBaseTerm = cloneAt(0);
  const grid = [0, 0.3, 0.785, 1.2, 2.7];
  let bestGap = 0;
  for (const phi of grid) {
    const pair = pairAt(phi);
    const clone = cloneAt(phi);
    // covariance: the pair term never moves under rephasing (exact)
    if (Math.abs(pair.re - pairBaseTerm.re) > 1e-15 || Math.abs(pair.im - pairBaseTerm.im) > 1e-15) cloneOk = false;
    // the clone term rotates at twice the rephasing rate (exact)
    const expect = cmul(c(Math.cos(2 * phi), Math.sin(2 * phi)), cloneBaseTerm);
    if (Math.abs(clone.re - expect.re) > 1e-15 || Math.abs(clone.im - expect.im) > 1e-15) cloneOk = false;
    const gap = Math.hypot(pair.re - clone.re, pair.im - clone.im);
    bestGap = Math.max(bestGap, gap);
    gapLine.push(`phi=${phi}: gap=${gap.toFixed(3)}`);
  }
  // the two curves separate fully somewhere on the grid (at base+phi = pi/2 the gap is 1)
  if (bestGap < 0.99) cloneOk = false;

  // (5) the certification toll: expected repetitions to hit the desired world match
  // 1/P = 1/weight (seeded Monte Carlo vs closed form — the geometric wait IS the toll)
  let certOk = true;
  const certLine: string[] = [];
  for (const w of [0.5, 0.2, 0.8]) {
    const shots = 4000;
    const mc = new Rng(seed + Math.round(w * 100));
    let repSum = 0;
    for (let s = 0; s < shots; s++) {
      let reps = 1;
      while (!mc.bernoulli(w)) reps++;
      repSum += reps;
    }
    const meanReps = repSum / shots;
    if (Math.abs(meanReps - 1 / w) / (1 / w) > 0.06) certOk = false;
    certLine.push(`w=${w}: mean reps ${meanReps.toFixed(3)} vs 1/P=${(1 / w).toFixed(3)}`);
  }

  // (6) no leakage: the world you get does not price the worlds you didn't —
  // the conditional data state given control outcome 1 is independent of beta
  let leakOk = true;
  const ref = conditionalData(outer(chooseState(alpha, c(Math.SQRT1_2, 0), uA, uB, psi)), 2, 1);
  for (const b2 of [0.01, 0.09, 0.25, 0.81]) {
    const b = c(Math.sqrt(b2), 0);
    const a2 = 1 - b2;
    const a = c(Math.sqrt(a2), 0);
    const cond = conditionalData(outer(chooseState(a, b, uA, uB, psi)), 2, 1);
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        const x = (cond[i] as readonly C[])[j] as C;
        const y = (ref[i] as readonly C[])[j] as C;
        if (Math.abs(x.re - y.re) > 1e-15 || Math.abs(x.im - y.im) > 1e-15) leakOk = false;
      }
    }
  }

  return {
    id: "W-B",
    name: "W-B the choice toy (coherence exact; engineered invariance at machine zero; random programs near the Haar mean; clone mark; certification toll; no leakage)",
    pass: coherenceOk && engineeredOk && genericOk && cloneOk && certOk && leakOk,
    detail:
      `sub-flags coherence/engineered/generic/clone/cert/leak = ${[coherenceOk, engineeredOk, genericOk, cloneOk, certOk, leakOk].map((b) => (b ? 1 : 0)).join("/")}; ` +
      `coherence numeric vs closed: (${numeric.re.toFixed(12)},${numeric.im.toFixed(12)}) vs (${closedCoherence.re.toFixed(12)},${closedCoherence.im.toFixed(12)}); ` +
      `engineered fidelity gap ${Math.abs(fidelity.re - 1).toExponential(2)}; random max/mean single-branch fidelity ${maxF.toFixed(3)}/${meanF.toFixed(3)} (Haar mean 0.5); ` +
      `clone mark: pair term invariant (exact) while clone term rotates at twice rate, ${gapLine.join(", ")}, best gap ${bestGap.toFixed(3)}; ` +
      `${certLine.join("; ")}; leakage zero across four weightings; seed ${seed}`,
  };
}

// ---------------------------------------------------------------------------
// W-C — the uniform-branch toll: 1/P = B exact on the grid, closed vs Monte Carlo.
// ---------------------------------------------------------------------------

function witnessUniformToll(): WitnessResult {
  let gridOk = true;
  for (const B of [2, 4, 8, 16]) {
    const P = 1 / B;
    if (1 / P !== B) gridOk = false; // powers of two: exact in floating point
    if (B / 1 !== B) gridOk = false; // the epoch-3 invoice line: N/t with t = 1
  }
  const B = 8;
  const P = 1 / B;
  const shots = 3000;
  const mc = new Rng(20260907);
  let repSum = 0;
  for (let s = 0; s < shots; s++) {
    let reps = 1;
    while (!mc.bernoulli(P)) reps++;
    repSum += reps;
  }
  const mean = repSum / shots;
  const mcOk = Math.abs(mean - B) / B < 0.06;
  return {
    id: "W-C",
    name: "W-C the uniform-branch toll (1/P = B exact on the grid; Monte Carlo agreement)",
    pass: gridOk && mcOk,
    detail: `grid B in {2,4,8,16}: 1/P = B exact, N/t = B at t = 1; MC at B = 8: mean reps ${mean.toFixed(3)} vs 8 (${shots} shots, seed 20260907)`,
  };
}

// ---------------------------------------------------------------------------
// Own kernels for the cross-check witnesses (zero-dep, toy scale). These
// re-derive — from scratch, with this repo's linalg — the faces of the
// sibling certificates that the executed milestones now cite (law R7): no
// sibling code is imported, only its published numbers are checked against
// independent re-derivations at bounded scale.
// ---------------------------------------------------------------------------

/** e^{-i*theta*X} for one site. */
function rotX(theta: number): Mat {
  const ct = Math.cos(theta);
  const st = Math.sin(theta);
  return [
    [c(ct), c(0, -st)],
    [c(0, -st), c(ct)],
  ];
}

/** Fold kron2 over per-site factors: site 0 is the FIRST tensor factor, so
 * site i of basis index z lives at bit (n-1-i). */
function kronFold(factors: readonly Mat[]): Mat {
  return factors.reduce((acc, m) => kron2(acc, m));
}

const Z2: Mat = [
  [c(1), c(0)],
  [c(0), c(-1)],
];

/** Z on site i of an n-site register (kron convention: site 0 = high bit). */
function ownSiteZ(n: number, i: number): Mat {
  return kronFold(Array.from({ length: n }, (_, k) => (k === i ? Z2 : identity(2))));
}

/** Diagonal ZZ energies of the open chain (h = 0): E(z) = -sum_i J_i s_i s_{i+1},
 * bit 0 -> s = +1 (the |0> eigenvalue of Z). */
function ownZzEnergies(n: number, couplings: readonly number[]): Float64Array {
  const dim = 1 << n;
  const out = new Float64Array(dim);
  for (let z = 0; z < dim; z++) {
    let e = 0;
    for (let i = 0; i + 1 < n; i++) {
      const si = (z >> (n - 1 - i)) & 1 ? -1 : 1;
      const sj = (z >> (n - 1 - i - 1)) & 1 ? -1 : 1;
      e -= couplings[i]! * si * sj;
    }
    out[z] = e;
  }
  return out;
}

/** The one-period driven echo F = kick . free, kick = e^{-i*theta*sum X},
 * free = e^{-i H_zz} — the Floquet form of the DTC literature, rebuilt here
 * from this repo's own primitives. */
function ownEchoFloquet(n: number, couplings: readonly number[], theta: number): Mat {
  const dim = 1 << n;
  const energies = ownZzEnergies(n, couplings);
  const free: C[][] = Array.from({ length: dim }, () => Array.from({ length: dim }, () => c(0)));
  for (let z = 0; z < dim; z++) free[z]![z] = c(Math.cos(energies[z]!), -Math.sin(energies[z]!));
  const kick = kronFold(Array.from({ length: n }, () => rotX(theta)));
  return matmul(kick, free);
}

/** Max |entry| of the deviation of F+ Z_i F from -Z_i, worst site. */
function echoIdentityDeviation(n: number, couplings: readonly number[]): number {
  const f = ownEchoFloquet(n, couplings, Math.PI / 2);
  const fd = dagger(f);
  let worst = 0;
  for (let i = 0; i < n; i++) {
    const zi = ownSiteZ(n, i);
    const lhs = matmul(fd, matmul(zi, f));
    for (let r = 0; r < lhs.length; r++) {
      for (let cc = 0; cc < lhs.length; cc++) {
        const x = (lhs[r] as readonly C[])[cc] as C;
        const z = (zi[r] as readonly C[])[cc] as C;
        worst = Math.max(worst, Math.hypot(x.re + z.re, x.im + z.im));
      }
    }
  }
  return worst;
}

/** <H_zz> of the state F^k |0...0> (index 0 = |0...0> under the kron convention). */
function orbitEnergy(n: number, couplings: readonly number[], theta: number, k: number): number {
  const dim = 1 << n;
  const energies = ownZzEnergies(n, couplings);
  const f = ownEchoFloquet(n, couplings, theta);
  let v: Vec = Array.from({ length: dim }, (_, j) => c(j === 0 ? 1 : 0));
  for (let t = 0; t < k; t++) v = apply(f, v);
  let e = 0;
  for (let z = 0; z < dim; z++) e += ((v[z] as C).re ** 2 + (v[z] as C).im ** 2) * energies[z]!;
  return e;
}

/** |amplitude|^2 of basis state |0...0> after k periods — the subharmonic
 * token's return fidelity (the beat's period-2 face at the register). */
function tokenReturnFidelity(n: number, couplings: readonly number[], k: number): number {
  const dim = 1 << n;
  const f = ownEchoFloquet(n, couplings, Math.PI / 2);
  let v: Vec = Array.from({ length: dim }, (_, j) => c(j === 0 ? 1 : 0));
  for (let t = 0; t < k; t++) v = apply(f, v);
  return (v[0] as C).re ** 2 + (v[0] as C).im ** 2;
}

/** The order parameter m(k) = (1/n) sum_i <Z_i> of the state F^k |0...0>. */
function orbitMeanZ(n: number, couplings: readonly number[], theta: number, k: number): number {
  const dim = 1 << n;
  const f = ownEchoFloquet(n, couplings, theta);
  let v: Vec = Array.from({ length: dim }, (_, j) => c(j === 0 ? 1 : 0));
  for (let t = 0; t < k; t++) v = apply(f, v);
  const probs = Array.from({ length: dim }, (_, z) => (v[z] as C).re ** 2 + (v[z] as C).im ** 2);
  let m = 0;
  for (let i = 0; i < n; i++) {
    let acc = 0;
    for (let z = 0; z < dim; z++) acc += ((z >> (n - 1 - i)) & 1 ? -1 : 1) * probs[z]!;
    m += acc;
  }
  return m / n;
}

// --- the compiled-cargo kernel: a reversible 2x2-bit multiplier netlist ---

export interface ReversibleGate {
  /** Control wires (1 for CNOT, 2 for Toffoli). */
  readonly controls: readonly number[];
  readonly target: number;
}

/**
 * A garbage-free-output reversible 2x2-bit multiplier, own netlist:
 * 13 wires, 11 gates, TOFFOLI + CNOT only (a universal reversible set).
 *   wires 0..3   inputs  a0 a1 b0 b1
 *   wires 4..7   product p0..p3 = a*b (zero-initialized on computational inputs)
 *   wires 8..12  garbage u1 u2 u3 c1 c2 (nonzero after the run — the tariff)
 */
export const MULTIPLIER_WIRES = 13;
const MULTIPLIER_GARBAGE_WIRES = [8, 9, 10, 11, 12] as const;
export const MULTIPLIER_NETLIST: readonly ReversibleGate[] = [
  { controls: [0, 2], target: 4 }, // p0 = a0 & b0
  { controls: [0, 3], target: 8 }, // u1 = a0 & b1
  { controls: [1, 2], target: 9 }, // u2 = a1 & b0
  { controls: [1, 3], target: 10 }, // u3 = a1 & b1
  { controls: [8], target: 5 },
  { controls: [9], target: 5 }, // p1 = u1 ^ u2
  { controls: [8, 9], target: 11 }, // c1 = u1 & u2
  { controls: [10], target: 6 },
  { controls: [11], target: 6 }, // p2 = u3 ^ c1
  { controls: [10, 11], target: 12 }, // c2 = u3 & c1
  { controls: [12], target: 7 }, // p3 = c2
];

/** Run a reversible netlist on the full wire state `s` (a bitvector). */
export function applyNetlist(netlist: readonly ReversibleGate[], s: number): number {
  let state = s;
  for (const g of netlist) {
    const fire = g.controls.every((w) => (state >> w) & 1);
    if (fire) state ^= 1 << g.target;
  }
  return state;
}

/** Worst-case garbage bits the own netlist leaves over the 16 computational
 * inputs — the tariff's as-built row. The single source: W-D's garbage census
 * and W-E's re-priced table count the same physical wires (was two identical
 * loops — one census, one count). */
function multiplierGarbageWorst(): number {
  let worst = 0;
  for (let a = 0; a < 4; a++) {
    for (let b = 0; b < 4; b++) {
      const s1 = applyNetlist(MULTIPLIER_NETLIST, a | (b << 2));
      let g = 0;
      for (const w of MULTIPLIER_GARBAGE_WIRES) g += (s1 >> w) & 1;
      worst = Math.max(worst, g);
    }
  }
  return worst;
}

// ---------------------------------------------------------------------------
// W-D — the beat-register cross-check (D1-M3): the sibling clock's exact
// faces rebuilt here at toy scale — the echo identity, the alternating
// trajectory, the subharmonic token return, and a compiled reversible
// program (own multiplier netlist) that is integer-exact, bijective, and
// self-resetting under reversal.
// ---------------------------------------------------------------------------

function witnessBeatRegister(): WitnessResult {
  const seed = 20260908;
  const rng = new Rng(seed);

  // (1) the beat, operator form: F+ Z_i F = -Z_i at theta = pi/2, h = 0, ANY couplings
  let worstEcho = 0;
  for (let t = 0; t < 5; t++) {
    const couplings = Array.from({ length: 3 }, () => 2 * rng.next());
    worstEcho = Math.max(worstEcho, echoIdentityDeviation(4, couplings));
  }
  const echoOk = worstEcho < 1e-12;

  // (2) the beat, trajectory form: from |0...0> the order parameter alternates exactly
  const couplingsFix = [1.2, 1.2, 1.2];
  let worstM = 0;
  for (let k = 1; k <= 12; k++) {
    worstM = Math.max(worstM, Math.abs(orbitMeanZ(4, couplingsFix, Math.PI / 2, k) - (-1) ** k));
  }
  const trajOk = worstM < 1e-12;

  // (3) the subharmonic token: after every 2k periods the register returns exactly
  let worstToken = 0;
  for (let k = 1; k <= 6; k++) {
    worstToken = Math.max(worstToken, 1 - tokenReturnFidelity(4, couplingsFix, 2 * k));
  }
  const tokenOk = worstToken < 1e-12;

  // (4) the compiled cargo: 16/16 integer-exact, bijection on the full cube,
  //     bitwise self-reset under reversal, garbage census = 5 wires
  let wrong = 0;
  for (let a = 0; a < 4; a++) {
    for (let b = 0; b < 4; b++) {
      const s1 = applyNetlist(MULTIPLIER_NETLIST, a | (b << 2));
      const p = (s1 >> 4) & 15;
      if (p !== a * b) wrong++;
    }
  }
  const worstGarbage = multiplierGarbageWorst();
  const dim = 1 << MULTIPLIER_WIRES;
  const seen = new Set<number>();
  let resetFails = 0;
  const reversed = [...MULTIPLIER_NETLIST].reverse();
  for (let s = 0; s < dim; s++) {
    const t = applyNetlist(MULTIPLIER_NETLIST, s);
    seen.add(t);
    if (applyNetlist(reversed, t) !== s) resetFails++;
  }
  const cargoOk = wrong === 0 && seen.size === dim && resetFails === 0;

  return {
    id: "W-D",
    name: "W-D the beat-register cross-check (echo identity; alternating trajectory; subharmonic token return; compiled reversible cargo)",
    pass: echoOk && trajOk && tokenOk && cargoOk,
    detail:
      `sub-flags echo/traj/token/cargo = ${[echoOk, trajOk, tokenOk, cargoOk].map((b) => (b ? 1 : 0)).join("/")}; ` +
      `echo identity worst |F+Z_i F + Z_i| ${worstEcho.toExponential(2)} (n=4, 5 random-J trials, J in [0,2]); ` +
      `trajectory |m(k) - (-1)^k| worst ${worstM.toExponential(2)} (k<=12); ` +
      `token return 1 - |<0|F^(2k)|0>|^2 worst ${worstToken.toExponential(2)} (k<=6); ` +
      `own multiplier netlist (11 gates, 13 wires): 16/16 integer-exact, ${seen.size}/${dim} bijection, self-reset bitwise on the full cube (${resetFails} failures), garbage census ${worstGarbage} wires; seed ${seed}`,
  };
}

// ---------------------------------------------------------------------------
// W-E — the energy-certificate cross-check (D1-M4): zero net work on the
// ideal beat, the detuned first period's closed form W_0 = J(n-1) sin^2(2*delta),
// the isolated-qubit echo decay, and the tariff table re-priced on this
// repo's own machine (own netlist's garbage, own Landauer arithmetic).
// ---------------------------------------------------------------------------

function witnessEnergyCertificate(): WitnessResult {
  const ln2 = ln2Quadrature(1 << 20);

  // (1) zero net work on the ideal beat: <H_zz>(k) constant along the orbit
  const n = 6;
  const jj = Array.from({ length: n - 1 }, () => 1.3);
  const e0 = orbitEnergy(n, jj, Math.PI / 2, 0);
  let worstZero = 0;
  for (let k = 1; k <= 12; k++) {
    worstZero = Math.max(worstZero, Math.abs(orbitEnergy(n, jj, Math.PI / 2, k) - e0));
  }
  const zeroWorkOk = worstZero < 1e-12;

  // (2) the detuned first period: <H_zz>_1 = -J(n-1) cos^2(2 delta) exactly;
  //     the first period's work W_0 = J(n-1) sin^2(2 delta)
  const delta = 0.1;
  const e1 = orbitEnergy(n, jj, Math.PI / 2 + delta, 1);
  const e1Closed = -1.3 * (n - 1) * Math.cos(2 * delta) ** 2;
  const w0Numeric = e1 - e0;
  const w0Closed = 1.3 * (n - 1) * Math.sin(2 * delta) ** 2;
  const detuneOk = Math.abs(e1 - e1Closed) < 1e-12 && Math.abs(w0Numeric - w0Closed) < 1e-12;

  // (3) the isolated qubit's stroboscope, re-derived honestly: a lone spin under
  //     the detuned echo is a rigid rotation, so |<Z>_k| = |cos(2k*delta)| EXACTLY
  //     — coherent oscillation with revivals, not geometric decay. The geometric
  //     envelope |cos2delta|^k sometimes quoted for the "isolated echo" assumes
  //     independent per-period errors; the coherent echo's law is this one.
  let worstIso = 0;
  for (let k = 1; k <= 10; k++) {
    const m = Math.abs(orbitMeanZ(1, [], Math.PI / 2 + delta, k));
    worstIso = Math.max(worstIso, Math.abs(m - Math.abs(Math.cos(2 * k * delta))));
  }
  const isoOk = worstIso < 1e-12;

  // (4) the tariff table, re-priced on this repo's own machine: the sibling's
  //     criterion (per-run erasure in kT*ln2 units at equal error) recomputed
  //     with THIS netlist's garbage census and THIS ln2 quadrature
  const bennett = 0; // uncomputed + deterministic delivery: a known outcome reads for free
  const asBuilt = multiplierGarbageWorst();
  const irreversible = 4 + 5; // the Boolean rival: 4 input wires + 5 internal nodes
  const depth = MULTIPLIER_NETLIST.length;
  const fkSpectral = t4Erasure(depth); // the T4 uncertain-readout schedule
  const tariffOk = bennett < asBuilt && asBuilt < irreversible && irreversible < fkSpectral && asBuilt === 5;
  const joules5 = asBuilt * K_B * 300 * ln2;
  const joules9 = irreversible * K_B * 0.01 * ln2;

  return {
    id: "W-E",
    name: "W-E the energy-certificate cross-check (zero net work; detuned W_0; isolated stroboscope; tariff ordering)",
    pass: zeroWorkOk && detuneOk && isoOk && tariffOk,
    detail:
      `sub-flags zero/detune/iso/tariff = ${[zeroWorkOk, detuneOk, isoOk, tariffOk].map((b) => (b ? 1 : 0)).join("/")}; ` +
      `orbit |<H_zz>(k) - <H_zz>(0)| worst ${worstZero.toExponential(2)} (n=6, J=1.3, k<=12); ` +
      `<H_zz>_1 numeric ${e1.toFixed(12)} vs closed ${e1Closed.toFixed(12)}, W_0 numeric ${w0Numeric.toFixed(6)} vs closed J(n-1)sin^2(2d) = ${w0Closed.toFixed(6)} (the sibling's 0.2566); ` +
      `isolated stroboscope |<Z>_k| = |cos 2k*delta| exact to ${worstIso.toExponential(2)} (k<=10 — coherent revivals; the geometric |cos2delta|^k envelope is an independent-error assumption, not the coherent echo's law); ` +
      `tariff on own machine: Bennett ${bennett} < as-built ${asBuilt} < irreversible ${irreversible} < FK spectral ${fkSpectral.toFixed(2)} kT*ln2 units at depth ${depth}; ` +
      `${asBuilt} units = ${joules5.toExponential(4)} J at 300 K, ${irreversible} units = ${joules9.toExponential(4)} J at 10 mK (ln2 by quadrature, dev ${(ln2 - Math.LN2).toExponential(1)})`,
  };
}

// ---------------------------------------------------------------------------
// W-F — the welfare-gap charge cross-check (D2-M4): the sibling Noether
// layer's exact statements re-derived on BigInt rationals — the charge's
// closed form, gauge invariance, equality-only-at-truth, and the off-gauge
// payment's profitable deviation with its exact worth.
// ---------------------------------------------------------------------------

function witnessWelfareGapCharge(): WitnessResult {
  // (1) the charge: welfare gap === closed form -(n-1)(s-t)^2/(2n), bitwise
  let gapOk = true;
  let gapCount = 0;
  const fifth = (k: number): Q => q(BigInt(k), 5n);
  for (const n of [2, 3]) {
    const otherSets = n === 2 ? [[fifth(2)]] : [[fifth(2), fifth(4)], [fifth(1), fifth(3)]];
    for (const others of otherSets) {
      for (const tN of [1, 2, 3, 4]) {
        for (const sN of [0, 1, 2, 3, 4, 5]) {
          const trueTypes = [fifth(tN), ...others];
          const gap = welfareGap(trueTypes, fifth(sN), fifth(tN));
          const closed = chargeClosedForm(n, fifth(sN), fifth(tN));
          if (!qEq(gap, closed)) gapOk = false;
          gapCount++;
        }
      }
    }
  }

  // (2) equality iff s = t: the charge is zero exactly at truth
  let zeroIffOk = true;
  {
    const trueTypes = [fifth(3), fifth(2)];
    for (const sN of [0, 1, 2, 3, 4, 5]) {
      const gap = welfareGap(trueTypes, fifth(sN), fifth(3));
      if (qIsZero(gap) !== (sN === 3)) zeroIffOk = false;
    }
  }

  // (3) gauge invariance: two gauges shift every payment by exactly h - h' and
  //     leave every deviation gain bitwise unchanged; the gain equals the gap
  let gaugeOk = true;
  const gauge1 = q(7n);
  const gauge2 = q(-3n, 2n);
  const shift = qSub(gauge1, gauge2);
  {
    const others = [fifth(2), fifth(4)];
    const trueTypes = [fifth(3), ...others];
    for (const sN of [0, 1, 2, 3, 4, 5]) {
      const p1 = grovesPayment(gauge1, trueTypes, fifth(sN));
      const p2 = grovesPayment(gauge2, trueTypes, fifth(sN));
      if (!qEq(qSub(p1, p2), shift)) gaugeOk = false;
      const g1 = qSub(agentUtility(trueTypes, fifth(sN), p1), agentUtility(trueTypes, fifth(3), grovesPayment(gauge1, trueTypes, fifth(3))));
      const g2 = qSub(agentUtility(trueTypes, fifth(sN), p2), agentUtility(trueTypes, fifth(3), grovesPayment(gauge2, trueTypes, fifth(3))));
      if (!qEq(g1, g2) || !qEq(g1, welfareGap(trueTypes, fifth(sN), fifth(3)))) gaugeOk = false;
    }
  }

  // (4) the off-gauge payment p'(s) = p(s) + eps*s (the sibling's K1, mirrored):
  //     the best deviation lands at s* = t - eps*n/(n-1) and is worth exactly
  //     eps^2*n/(2(n-1)) — DSIC broken by a machine-checkable amount
  let offGaugeOk = true;
  const offGaugeLine: string[] = [];
  const eps = q(1n, 7n);
  for (const n of [2, 3]) {
    const others = Array.from({ length: n - 1 }, (_, j) => fifth(j + 2));
    const t = q(3n, 5n);
    const trueTypes = [t, ...others];
    const gainPrime = (s: Q): Q =>
      qSub(welfareGap(trueTypes, s, t), qMul(eps, qSub(s, t)));
    let best = q(0n);
    let bestS = q(0n);
    for (let k = 0; k <= 70; k++) {
      const s = q(BigInt(k), 70n);
      if (k === 0 || qCmp(gainPrime(s), best) > 0) {
        best = gainPrime(s);
        bestS = s;
      }
    }
    const sStar = qSub(t, qMul(eps, qDiv(q(BigInt(n)), q(BigInt(n - 1)))));
    const worth = qMul(qMul(eps, eps), qDiv(q(BigInt(n)), q(2n * BigInt(n - 1))));
    if (!qEq(bestS, sStar) || !qEq(best, worth) || qCmp(best, q(0n)) <= 0) offGaugeOk = false;
    offGaugeLine.push(`n=${n}: s*=${bestS.n}/${bestS.d}, worth ${best.n}/${best.d} (${qCmp(best, q(0n)) > 0 ? "profitable" : "not"})`);
  }

  return {
    id: "W-F",
    name: "W-F the welfare-gap charge cross-check (closed form; equality iff truth; gauge invariance; off-gauge deviation worth)",
    pass: gapOk && zeroIffOk && gaugeOk && offGaugeOk,
    detail:
      `sub-flags gap/iff/gauge/offgauge = ${[gapOk, zeroIffOk, gaugeOk, offGaugeOk].map((b) => (b ? 1 : 0)).join("/")}; ` +
      `gap === -(n-1)(s-t)^2/(2n) bitwise on ${gapCount} rational probes (n in {2,3}, fifths grid); ` +
      `charge zero exactly at s=t on the grid; two gauges shift payments by exactly h-h' with gains bitwise unchanged; ` +
      `off-gauge p+eps*s (eps=1/7): ${offGaugeLine.join("; ")} — the closed-form s* = t - eps*n/(n-1) and worth eps^2*n/(2(n-1)), both exact`,
  };
}

export function runWitnesses(): WitnessResult[] {
  return [
    witnessLandauer(),
    witnessChoiceToy(),
    witnessUniformToll(),
    witnessBeatRegister(),
    witnessEnergyCertificate(),
    witnessWelfareGapCharge(),
  ];
}
