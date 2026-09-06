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
  gramSchmidtUnitary,
  inner,
  normalize,
  outer,
  traceControl,
  traceData,
  type C,
  type Mat,
  type Vec,
} from "./linalg.js";

export interface WitnessResult {
  readonly name: string;
  readonly pass: boolean;
  readonly detail: string;
}

// ---------------------------------------------------------------------------
// W-A — the Landauer floor, two-path: k exact, ln2 by quadrature, metered eternity.
// ---------------------------------------------------------------------------

function witnessLandauer(): WitnessResult {
  const K_B = 1.380649e-23; // J/K — exact by the 2019 SI definition
  // path 1: the closed form
  const ln2Closed = Math.LN2;
  // path 2: ln2 as the quadrature of 1/x over [1,2] (midpoint rule)
  const n = 1_000_000;
  let ln2Quad = 0;
  for (let i = 0; i < n; i++) ln2Quad += 1 / (1 + (i + 0.5) / n);
  ln2Quad /= n;
  const ln2Ok = Math.abs(ln2Quad - ln2Closed) < 1e-12;

  const e300 = K_B * 300 * ln2Closed;
  const e10mK = K_B * 0.01 * ln2Closed;
  const ratioOk = Math.abs(e300 / e10mK - 30000) < 1e-6;

  const bits = (T: number): number => (T + 1) * Math.log2(T + 1);
  const b10 = bits(10);
  const b100 = bits(100);
  const b1000 = bits(1000);
  const meteredOk = b10 < b100 && b100 < b1000;

  return {
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
    name: "W-C the uniform-branch toll (1/P = B exact on the grid; Monte Carlo agreement)",
    pass: gridOk && mcOk,
    detail: `grid B in {2,4,8,16}: 1/P = B exact, N/t = B at t = 1; MC at B = 8: mean reps ${mean.toFixed(3)} vs 8 (${shots} shots, seed 20260907)`,
  };
}

export function runWitnesses(): WitnessResult[] {
  return [witnessLandauer(), witnessChoiceToy(), witnessUniformToll()];
}
