/**
 * T6-a — the GYNI flat-top certificate layer (three-party ring, classical and
 * shared-random faces, machine-exhaustive; sampled quantum battery).
 *
 * The game: parties 0, 1, 2 sit on a directed ring. Party i receives an
 * i.i.d. uniform bit x_i and must guess x_{i+1 mod 3}; the ONLY local
 * information is x_i, so a deterministic strategy is a triple of unary
 * functions f_i: {0,1} -> {0,1} (4 each, 4³ = 64 vertices). Success
 *
 *   p_succ = (1/24) Σ_x Σ_i [ f_i(x_i) = x_{i+1} ].
 *
 * Baseline theorem (cited, dual-sourced R15 register line 41): M.L. Almeida,
 * J.-D. Bancal, N. Brunner, A. Acín, N. Gisin, S. Pironio, "Guess Your
 * Neighbor's Input", PRL 104, 230404 (2010) — the GYNI game is a multipartite
 * Bell inequality with NO quantum violation. The nontrivial inequality of the
 * paper lives on a CORRELATED input distribution; this module certificates
 * the UNIFORM-INPUT face, where the machine finds the flat top below.
 *
 * What the machine certifies here (all exact enumeration, no sampling on the
 * classical faces):
 *
 * - (GY-a) Census theorem: all 64 vertices succeed at EXACTLY C₃ = 1/2 —
 *   min = max = 1/2 over the census (the FLAT TOP). Hand derivation, pinned
 *   by the census: f_i(x_i) is a function of x_i alone while x_{i+1} is an
 *   independent uniform bit, so P[f_i(x_i) = x_{i+1}] = 1/2 per party per
 *   input; the average is 1/2 for EVERY vertex.
 * - (GY-b) Maximizer characterization: the achiever set is the FULL vertex
 *   set — 64 of 64, every triple of unary functions. The characterization is
 *   vacuous (no constraint): each party's four functions {0, 1, id, not} all
 *   attain the per-party cap 1/2, and per-party caps add to the total.
 * - (GY-c) Shared randomness: p_succ is LINEAR in the joint behavior
 *   P(b|x); a shared-random strategy is a convex mixture of vertices, so its
 *   value is Σ_v w_v · p_succ(v) = C₃ · Σ_v w_v — at the flat top every
 *   mixture is EXACTLY C₃ (stronger than the usual "cannot exceed": the cap
 *   is equality for every convex weight). Machine-verified TWO ways: the
 *   linear decomposition, and a from-scratch recompute of the mixture's
 *   induced behavior P(b|x) = Σ_v w_v P_v(b|x).
 * - (GY-c′) Sampled quantum battery (non-exhaustive echo of the cited
 *   no-violation theorem): parties share three pairwise Bell states (or
 *   Werner-diluted, or GHZ), measure each qubit in an x-dependent basis,
 *   XOR their two outcomes, and the exact Born probabilities give p_succ =
 *   C₃ to ≤ 1e-12 on the whole angle grid. Structural reason (uniform-input
 *   face): under no-signaling P[b_i = x_{i+1}] = ½(P(b_i=0|x_i) +
 *   P(b_i=1|x_i)) = 1/2 — every no-signaling strategy, quantum included,
 *   sits ON the cap. The battery echoes the cited theorem's conclusion; it
 *   does not reproduce the paper's correlated-input inequality (scope).
 * - (GY-d) Audit face: claimed census records, deterministic-vertex values,
 *   and shared-random values are recomputed from scratch; a forgery (inflated
 *   cap, truncated family, wrong achiever count, value > C₃) is NAMED and
 *   rejected.
 *
 * Boundary: the three-party process-matrix layer (6+ registers) is NOT built
 * here — the certificate layer covers the classical / shared-random /
 * sampled-quantum strategy faces only.
 */

import { type CMat, type CVec, kronAll, mat } from '../core/cmat.js';
import { KET0, rotY } from '../core/states.js';

/** The machine-exact flat-top cap C₃ (census output; = 1/2). */
export const GYNI_CAP = 1 / 2;
/** Parties in the ring. */
export const GYNI_PARTIES = 3;
/** Deterministic vertices: 4 unary functions per party, 4³ total. */
export const GYNI_VERTICES = 64;

/** Game score of one input/output tuple: party i wins iff b_i = x_{i+1}. */
export function gyniScore(b: readonly number[], x: readonly number[]): number {
  let s = 0;
  for (let i = 0; i < GYNI_PARTIES; i++) {
    if (b[i] === x[(i + 1) % GYNI_PARTIES]) s += 1;
  }
  return s;
}

/** Truth-table encoding of a vertex: fs[i] ∈ {0,1,2,3} (bit 0 = f(0), bit 1 = f(1)). */
export function vertexOutput(fs: readonly number[], party: number, ownInput: number): number {
  return (fs[party]! >> ownInput) & 1;
}

/** Exact p_succ of one deterministic vertex (uniform inputs, full enumeration). */
export function vertexValue(fs: readonly number[]): number {
  let acc = 0;
  for (let x = 0; x < 8; x++) {
    const xs = [(x >> 2) & 1, (x >> 1) & 1, x & 1];
    const bs = [0, 1, 2].map((i) => vertexOutput(fs, i, xs[i]!));
    acc += gyniScore(bs, xs);
  }
  return acc / 24;
}

export interface GyniCensusPoint {
  readonly fs: readonly number[];
  readonly label: string;
  readonly psucc: number;
}

/**
 * The exhaustive deterministic census: all 64 vertices, with values. Under
 * the flat top every point carries psucc = C₃ exactly — the returned array is
 * the achiever enumeration at the same time (GY-a and GY-b in one pass).
 */
export function gyniCensus(): GyniCensusPoint[] {
  const points: GyniCensusPoint[] = [];
  for (let v = 0; v < GYNI_VERTICES; v++) {
    const fs = [v & 3, (v >> 2) & 3, (v >> 4) & 3];
    points.push({ fs, label: `f=[${fs.join(',')}]`, psucc: vertexValue(fs) });
  }
  return points;
}

/** Census summary: family size, cap, min, and achiever count (GY-a/GY-b). */
export function gyniCensusSummary(): { familySize: number; cap: number; min: number; achieverCount: number } {
  const census = gyniCensus();
  let cap = 0;
  let min = 1;
  for (const p of census) {
    cap = Math.max(cap, p.psucc);
    min = Math.min(min, p.psucc);
  }
  let achieverCount = 0;
  for (const p of census) if (p.psucc === cap) achieverCount++;
  return { familySize: census.length, cap, min, achieverCount };
}

// ---------------------------------------------------------------------------
// Shared randomness — the linearity argument, machine-pinned two ways.
// ---------------------------------------------------------------------------

/** Induced behavior P(b|x) of a vertex as a 64-array: index x*8 + b (b big-endian). */
export function vertexBehavior(fs: readonly number[]): Float64Array {
  const beh = new Float64Array(64);
  for (let x = 0; x < 8; x++) {
    const xs = [(x >> 2) & 1, (x >> 1) & 1, x & 1];
    const bs = [0, 1, 2].map((i) => vertexOutput(fs, i, xs[i]!));
    beh[x * 8 + (bs[0]! * 4 + bs[1]! * 2 + bs[2]!)] = 1;
  }
  return beh;
}

/** Game value of an arbitrary behavior P(b|x) (not necessarily normalized). */
export function behaviorValue(beh: Float64Array): number {
  if (beh.length !== 64) throw new Error(`behaviorValue: expected 64 entries (x*8+b), got ${beh.length}`);
  let acc = 0;
  for (let x = 0; x < 8; x++) {
    const xs = [(x >> 2) & 1, (x >> 1) & 1, x & 1];
    for (let b = 0; b < 8; b++) {
      const p = beh[x * 8 + b]!;
      if (p === 0) continue;
      acc += (1 / 24) * p * gyniScore([(b >> 2) & 1, (b >> 1) & 1, b & 1], xs);
    }
  }
  return acc;
}

/** The mixture's induced behavior: Σ_v w_v P_v(b|x). */
export function mixtureBehavior(weights: readonly number[]): Float64Array {
  if (weights.length !== GYNI_VERTICES) {
    throw new Error(`mixtureBehavior: expected ${GYNI_VERTICES} weights, got ${weights.length}`);
  }
  const mix = new Float64Array(64);
  for (let v = 0; v < GYNI_VERTICES; v++) {
    if (weights[v] === 0) continue;
    const beh = vertexBehavior([v & 3, (v >> 2) & 3, (v >> 4) & 3]);
    for (let k = 0; k < 64; k++) mix[k] = mix[k]! + weights[v]! * beh[k]!;
  }
  return mix;
}

/** The LINEAR DECOMPOSITION of a shared-random strategy's value: Σ_v w_v p_succ(v). */
export function decomposedValue(weights: readonly number[]): number {
  if (weights.length !== GYNI_VERTICES) {
    throw new Error(`decomposedValue: expected ${GYNI_VERTICES} weights, got ${weights.length}`);
  }
  let acc = 0;
  for (let v = 0; v < GYNI_VERTICES; v++) acc += weights[v]! * vertexValue([v & 3, (v >> 2) & 3, (v >> 4) & 3]);
  return acc;
}

export interface SharedRandomVerdict {
  readonly weightSum: number;
  readonly decomposed: number;
  readonly direct: number;
  readonly linearityGap: number;
  readonly capGap: number;
}

/**
 * A shared-random strategy on trial: the two computations must agree
 * (linearity is what carries the cap from vertices to mixtures), and for a
 * normalized strategy (Σw = 1) the value must equal C₃ exactly.
 */
export function verifySharedRandom(weights: readonly number[]): SharedRandomVerdict {
  const decomposed = decomposedValue(weights);
  const direct = behaviorValue(mixtureBehavior(weights));
  const weightSum = weights.reduce((a, b) => a + b, 0);
  return {
    weightSum,
    decomposed,
    direct,
    linearityGap: Math.abs(decomposed - direct),
    capGap: Math.abs(direct - GYNI_CAP * weightSum),
  };
}

// ---------------------------------------------------------------------------
// Sampled quantum battery — pairwise Bell / Werner sharing (exact Born rule).
// ---------------------------------------------------------------------------

/** Qubit k's owner: pairs (0,1),(1,2),(2,0) on qubits 0..5; party i holds q_{2i mod 6}, q_{2i+3 mod 6}. */
const OWNERS = [0, 1, 1, 2, 2, 0] as const;
/** The two qubits each party measures (b_i = XOR of their outcomes). */
const HELD_QUBITS: ReadonlyArray<readonly [number, number]> = [[0, 5], [1, 2], [3, 4]];

/** |Φ⁺⟩⟨Φ⁺| on one pair (real in the computational basis). */
function bellPairRho(): CMat {
  const m = mat(4, 4);
  const a = 1 / Math.SQRT2;
  m.re[0 * 4 + 0] = a * a;
  m.re[0 * 4 + 3] = a * a;
  m.re[3 * 4 + 0] = a * a;
  m.re[3 * 4 + 3] = a * a;
  return m;
}

/** Werner pair ρ_w = w|Φ⁺⟩⟨Φ⁺| + (1−w)𝟙/4 (real, PSD for w ∈ [−1/3, 1]). */
function wernerPairRho(w: number): CMat {
  const m = bellPairRho();
  for (let k = 0; k < 16; k++) m.re[k] = m.re[k]! * w + (1 - w) / 4;
  return m;
}

/** Measurement vector of qubit k: R_y(angle)|outcome⟩ (real rotation). */
function realBasisVector(angle: number, outcome: number): CVec {
  const r = rotY(angle + Math.PI * outcome);
  const v: CVec = { n: 2, re: new Float64Array(2), im: new Float64Array(2) };
  v.re[0] = r.re[0 * 2]! * KET0.re[0]!;
  v.re[1] = r.re[1 * 2]! * KET0.re[0]!;
  return v;
}

/** The shared 6-qubit state of three Werner pairs at visibility w (w = 1: Bell). */
export function wernerSixQubitState(w: number): CMat {
  const pair = wernerPairRho(w);
  // kron of three pair states under the house big-endian layout: pair (0,1)
  // owns qubits 0,1 (bits 5,4), pair (1,2) owns qubits 2,3, pair (2,0) owns
  // qubits 4,5 — the same layout the measurement product vectors use.
  return kronAll([pair, pair, pair]);
}

/**
 * Exact p_succ of the pairwise-sharing battery: shared state `rho6` (real
 * 64×64), party i measures both its qubits in an x_i-dependent basis
 * (angles[party][input]), b_i = XOR of its two outcomes. Every joint outcome
 * probability is the Born overlap ⟨β_o|ρ6|β_o⟩ — no sampling.
 */
export function pairwiseBatteryValue(
  rho6: CMat,
  angles: ReadonlyArray<readonly number[]>,
): number {
  let acc = 0;
  for (let x = 0; x < 8; x++) {
    const xs = [(x >> 2) & 1, (x >> 1) & 1, x & 1];
    for (let o = 0; o < 64; o++) {
      let prod: CVec = realBasisVector(angles[OWNERS[0]]![xs[OWNERS[0]]!]!, (o >> 5) & 1);
      for (let k = 1; k < 6; k++) {
        const owner = OWNERS[k]!;
        const f = realBasisVector(angles[owner]![xs[owner]!]!, (o >> (5 - k)) & 1);
        const nx: CVec = { n: prod.n * 2, re: new Float64Array(prod.n * 2), im: new Float64Array(prod.n * 2) };
        for (let i = 0; i < prod.n; i++) {
          nx.re[i * 2] = prod.re[i]! * f.re[0]!;
          nx.re[i * 2 + 1] = prod.re[i]! * f.re[1]!;
        }
        prod = nx;
      }
      let p = 0;
      for (let i = 0; i < 64; i++) {
        let row = 0;
        for (let j = 0; j < 64; j++) row += rho6.re[i * 64 + j]! * prod.re[j]!;
        p += prod.re[i]! * row;
      }
      const b = HELD_QUBITS.map(
        ([qa, qb]) => (((o >> (5 - qa)) & 1) ^ ((o >> (5 - qb)) & 1)),
      );
      acc += (1 / 24) * gyniScore(b, xs) * p;
    }
  }
  return acc;
}

/**
 * The sampled battery over the angle grid (5×5 base angles, structured
 * offsets), Bell (w = 1) and Werner (w < 1) — max |p_succ − C₃| across the
 * grid is the machine echo of the cited no-violation theorem (scope: this
 * family and grid, not all quantum strategies).
 */
export function batteryGridMaxDeviation(w: number): number {
  const rho6 = wernerSixQubitState(w);
  const grid = [0, Math.PI / 8, Math.PI / 4, (3 * Math.PI) / 8, Math.PI / 2];
  let maxDev = 0;
  for (const a0 of grid) {
    for (const a1 of grid) {
      const angles = [
        [a0, a0 + Math.PI / 4],
        [a1, a1],
        [a0, a1],
      ];
      maxDev = Math.max(maxDev, Math.abs(pairwiseBatteryValue(rho6, angles) - GYNI_CAP));
    }
  }
  return maxDev;
}

// ---------------------------------------------------------------------------
// Audit face — census records and strategy claims on trial.
// ---------------------------------------------------------------------------

export interface GyniCensusRecord {
  readonly familySize: number;
  readonly cap: number;
  readonly min: number;
  readonly achieverCount: number;
}

export interface GyniVerdict {
  readonly ok: boolean;
  readonly reason: string;
}

/** A claimed census record on trial: recomputed from scratch, forgery named. */
export function verifyGyniCensus(claimed: GyniCensusRecord): GyniVerdict {
  const truth = gyniCensusSummary();
  if (claimed.familySize !== truth.familySize) {
    return {
      ok: false,
      reason: `GYNI-COUNTERFEIT: claimed ${claimed.familySize} deterministic vertices, machine census has ${truth.familySize}`,
    };
  }
  if (Math.abs(claimed.cap - truth.cap) > 1e-12) {
    return {
      ok: false,
      reason: `GYNI-COUNTERFEIT: claimed cap ${claimed.cap.toFixed(6)}, machine cap ${truth.cap.toFixed(6)} — the flat top C₃ cannot be exceeded`,
    };
  }
  if (Math.abs(claimed.min - truth.min) > 1e-12) {
    return {
      ok: false,
      reason: `GYNI-COUNTERFEIT: claimed min ${claimed.min.toFixed(6)}, machine min ${truth.min.toFixed(6)} — the top is FLAT`,
    };
  }
  if (claimed.achieverCount !== truth.achieverCount) {
    return {
      ok: false,
      reason: `GYNI-COUNTERFEIT: claimed ${claimed.achieverCount} maximizers, machine count ${truth.achieverCount} (the full vertex set)`,
    };
  }
  return {
    ok: true,
    reason: `verified: ${truth.familySize} vertices, flat cap ${truth.cap.toFixed(6)}, ${truth.achieverCount}/${truth.familySize} achievers`,
  };
}

/** A claimed deterministic-vertex value on trial: recomputed, forgery named. */
export function auditVertexClaim(fs: readonly number[], claimedPsucc: number): GyniVerdict {
  if (fs.length !== GYNI_PARTIES) {
    return { ok: false, reason: `GYNI-COUNTERFEIT: vertex needs ${GYNI_PARTIES} truth tables, got ${fs.length}` };
  }
  const truth = vertexValue(fs);
  if (Math.abs(claimedPsucc - truth) > 1e-12) {
    return {
      ok: false,
      reason: `GYNI-COUNTERFEIT: vertex f=[${fs.join(',')}] claimed ${claimedPsucc.toFixed(6)}, machine recomputes ${truth.toFixed(6)} — the flat top C₃ = ${GYNI_CAP} cannot be exceeded`,
    };
  }
  if (truth > GYNI_CAP + 1e-12) {
    return { ok: false, reason: `GYNI-COUNTERFEIT: vertex f=[${fs.join(',')}] exceeds the cap` };
  }
  return { ok: true, reason: `verified: f=[${fs.join(',')}] at ${truth.toFixed(6)} = C₃` };
}

/** A claimed shared-random value on trial: BOTH recomputations, forgery named. */
export function auditSharedRandomClaim(weights: readonly number[], claimedPsucc: number): GyniVerdict {
  if (weights.length !== GYNI_VERTICES) {
    return { ok: false, reason: `GYNI-COUNTERFEIT: mixture needs ${GYNI_VERTICES} weights, got ${weights.length}` };
  }
  const v = verifySharedRandom(weights);
  const weightSum = v.weightSum;
  if (weightSum > 1 + 1e-9) {
    return { ok: false, reason: `GYNI-COUNTERFEIT: weights sum to ${weightSum.toFixed(9)} > 1 — not a strategy` };
  }
  if (v.linearityGap > 1e-12) {
    return {
      ok: false,
      reason: `GYNI-COUNTERFEIT: decomposition and behavior recomputation disagree (${v.linearityGap.toExponential(2)})`,
    };
  }
  if (Math.abs(claimedPsucc - v.direct) > 1e-12) {
    return {
      ok: false,
      reason: `GYNI-COUNTERFEIT: mixture claimed ${claimedPsucc.toFixed(6)}, machine recomputes ${v.direct.toFixed(6)} — shared randomness cannot leave the flat top`,
    };
  }
  return { ok: true, reason: `verified: mixture at ${v.direct.toFixed(6)} (decomposition gap ${v.linearityGap.toExponential(1)})` };
}
