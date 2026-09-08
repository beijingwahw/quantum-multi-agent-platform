/**
 * T4 — the strategy space beyond rotated measurements, executable.
 *
 * Family F_q: each lab plays a binary-outcome TPCP instrument on its qubit
 * in/out systems (A1->A2 resp. B1->B2), with ARBITRARY dependence on its
 * local input (a for Alice; b, b' for Bob) and arbitrary CJ elements
 *
 *     M_x >= 0 on the 4-dim (input ⊗ output),   sum_x Tr_out[M_x] = 1_in.
 *
 * This strictly generalizes the OCB protocol: projective z/x measurements are
 * the sharp product special case. Entangled CJ elements ("measurement with
 * memory") are valid members of F_q, as are shared-ancilla strategies — by
 * the standard reduction (OCB12 Methods, instrument-ancilla discussion),
 * marginalising private ancillas maps every such strategy to PSD, TP elements
 * of exactly this form, so bounding F_q bounds them all.
 *
 * Two parameterised sub-families are provided for the numerical sweep:
 *  - detect-prepare product instruments: binary POVM {A_x} on the input qubit
 *    with axis n, sharpness s (A_x = (1/2)[1 + s (-1)^x n.sigma]) and a
 *    general mixed qubit state rho(x) = (1/2)(1 + r(x).sigma) on the output;
 *  - entangled-element instruments M_x = |psi_x><psi_x| built from a Schmidt
 *    pair (used as adversarial probes of the certificate lemmas, since their
 *    elements are NOT product).
 *
 * The payoff is still only the process Born rule: P = Tr[W (M^A ⊗ M^B)],
 * evaluated element by element — no shortcuts inside this module.
 */
import { cmatKron, cmatPartialTraceSecond, cmatTraceProd, type CMat } from "../core/cmat.js";
import type { GameProbabilities } from "./quantum.js";

export type Axis = readonly [number, number, number];

/** A binary-outcome instrument as its two CJ elements [M_0, M_1]. */
export type InstrumentPair = readonly [CMat, CMat];

export interface InstrumentBuilder {
  /** Alice's instrument for her input a. */
  readonly alice: (a: number) => InstrumentPair;
  /** Bob's instrument for his inputs (b, b'). */
  readonly bob: (b: number, bp: number) => InstrumentPair;
}

// ---------------------------------------------------------------------------
// small kernels: Pauli-vector matrices, states, POVM elements
// ---------------------------------------------------------------------------

/** n.sigma for a unit (or unnormalised) axis n. */
export function sigmaDot(n: Axis): CMat {
  const [x, y, z] = n;
  return {
    dim: 2,
    re: [[z, x], [x, -z]],
    im: [[0, -y], [y, 0]],
  };
}

/** General mixed qubit state (1/2)(1 + r.sigma); PSD iff |r| <= 1. */
export function blochState(r: Axis): CMat {
  const s = sigmaDot(r);
  return {
    dim: 2,
    re: [
      [0.5 + 0.5 * (s.re[0]![0] as number), 0.5 * (s.re[0]![1] as number)],
      [0.5 * (s.re[1]![0] as number), 0.5 + 0.5 * (s.re[1]![1] as number)],
    ],
    im: [
      [0, 0.5 * (s.im[0]![1] as number)],
      [0.5 * (s.im[1]![0] as number), 0],
    ],
  };
}

/** Binary POVM element A_x = (1/2)[1 + s (-1)^x n.sigma], sharpness s in [0,1]. */
export function povmElement(n: Axis, outcome: number, sharpness: number): CMat {
  const s = sigmaDot(n);
  const c = sharpness * (outcome === 0 ? 1 : -1) * 0.5;
  return {
    dim: 2,
    re: [
      [0.5 + c * (s.re[0]![0] as number), c * (s.re[0]![1] as number)],
      [c * (s.re[1]![0] as number), 0.5 + c * (s.re[1]![1] as number)],
    ],
    im: [
      [0, c * (s.im[0]![1] as number)],
      [c * (s.im[1]![0] as number), 0],
    ],
  };
}

/** Detect-and-prepare CJ element: A_x on the input, rho on the output. */
export function detectPrepare(n: Axis, outcome: number, sharpness: number, prep: Axis): CMat {
  return cmatKron(povmElement(n, outcome, sharpness), blochState(prep));
}

/** |v><v| for a complex vector v of any dimension (rank-one projector). */
export function rankOneProjector(re: readonly number[], im: readonly number[]): CMat {
  const dim = re.length;
  const out: CMat = {
    dim,
    re: Array.from({ length: dim }, () => new Array<number>(dim).fill(0)),
    im: Array.from({ length: dim }, () => new Array<number>(dim).fill(0)),
  };
  for (let i = 0; i < dim; i++) {
    for (let j = 0; j < dim; j++) {
      out.re[i]![j] = (re[i] as number) * (re[j] as number) + (im[i] as number) * (im[j] as number);
      out.im[i]![j] = (im[i] as number) * (re[j] as number) - (re[i] as number) * (im[j] as number);
    }
  }
  return out;
}

/**
 * Entangled-element instrument from a Schmidt pair: with orthonormal
 * phi0, phi1 on the output qubit and weight q,
 *   M_0 = |psi0><psi0|, psi0 = sqrt(q)|0>phi0 + sqrt(1-q)|1>phi1 (on in ⊗ out),
 *   M_1 = |psi1><psi1|, psi1 = sqrt(1-q)|0>phi0 + sqrt(q)|1>phi1,
 * which satisfies sum_x Tr_out[M_x] = 1 exactly (diagonal weights add to 1)
 * and has genuinely entangled elements for 0 < q < 1.
 */
export function entangledInstrumentPair(q: number, phi0re: readonly number[], phi0im: readonly number[], phi1re: readonly number[], phi1im: readonly number[]): InstrumentPair {
  const s0 = Math.sqrt(q);
  const s1 = Math.sqrt(1 - q);
  const psi0re = [s0 * (phi0re[0] as number), s0 * (phi0re[1] as number), s1 * (phi1re[0] as number), s1 * (phi1re[1] as number)];
  const psi0im = [s0 * (phi0im[0] as number), s0 * (phi0im[1] as number), s1 * (phi1im[0] as number), s1 * (phi1im[1] as number)];
  const psi1re = [s1 * (phi0re[0] as number), s1 * (phi0re[1] as number), s0 * (phi1re[0] as number), s0 * (phi1re[1] as number)];
  const psi1im = [s1 * (phi0im[0] as number), s1 * (phi0im[1] as number), s0 * (phi1im[0] as number), s0 * (phi1im[1] as number)];
  return [rankOneProjector(psi0re, psi0im), rankOneProjector(psi1re, psi1im)];
}

// ---------------------------------------------------------------------------
// the payoff under general strategies (process Born rule, element by element)
// ---------------------------------------------------------------------------

/** Execute the OCB game on W under general instruments (family F_q). */
export function strategyPayoff(w: CMat, builder: InstrumentBuilder): GameProbabilities {
  let pAliceSum = 0; // over (a,b): P(x = b | a, b, b'=0), summing Bob's outcome y
  let pBobSum = 0; // over (a,b): P(y = a | a, b, b'=1), summing Alice's outcome x
  for (let a = 0; a < 2; a++) {
    for (let b = 0; b < 2; b++) {
      const ma = builder.alice(a);
      const mb0 = builder.bob(b, 0);
      for (let x = 0; x < 2; x++) {
        for (let y = 0; y < 2; y++) {
          const p = cmatTraceProd(w, cmatKron(ma[x] as CMat, mb0[y] as CMat)).re;
          if (x === b) pAliceSum += p;
        }
      }
      const mb1 = builder.bob(b, 1);
      for (let x = 0; x < 2; x++) {
        for (let y = 0; y < 2; y++) {
          const p = cmatTraceProd(w, cmatKron(ma[x] as CMat, mb1[y] as CMat)).re;
          if (y === a) pBobSum += p;
        }
      }
    }
  }
  const pAliceGuesses = pAliceSum / 4;
  const pBobGuesses = pBobSum / 4;
  return { pAliceGuesses, pBobGuesses, pSuccess: 0.5 * pAliceGuesses + 0.5 * pBobGuesses };
}

/**
 * Per-(a,b) branch outcome tables of a strategy on W:
 *   pAlice[b][a][x] = P(x | a, b, b'=0)  (Bob's b'=0 outcome marginalised),
 *   pBob[b][a][y]   = P(y | a, b, b'=1)  (Alice's outcome marginalised).
 * These are the tables OCB12 report in closed form (their eq. (26)) — the
 * equivalence face compares them entry by entry.
 */
export interface BranchTables {
  readonly pAlice: readonly number[][][];
  readonly pBob: readonly number[][][];
}

export function strategyBranchTables(w: CMat, builder: InstrumentBuilder): BranchTables {
  const pAlice: number[][][] = [];
  const pBob: number[][][] = [];
  for (let b = 0; b < 2; b++) {
    pAlice.push([]);
    pBob.push([]);
    for (let a = 0; a < 2; a++) {
      const ma = builder.alice(a);
      const mb0 = builder.bob(b, 0);
      const mb1 = builder.bob(b, 1);
      const rowA = [0, 0];
      const rowB = [0, 0];
      for (let x = 0; x < 2; x++) {
        for (let y = 0; y < 2; y++) {
          rowA[x] = (rowA[x] as number) + cmatTraceProd(w, cmatKron(ma[x] as CMat, mb0[y] as CMat)).re;
        }
      }
      for (let x = 0; x < 2; x++) {
        for (let y = 0; y < 2; y++) {
          rowB[y] = (rowB[y] as number) + cmatTraceProd(w, cmatKron(ma[x] as CMat, mb1[y] as CMat)).re;
        }
      }
      (pAlice[b] as number[][]).push(rowA);
      (pBob[b] as number[][]).push(rowB);
    }
  }
  return { pAlice, pBob };
}

/** TP conformance deviation: || sum_x Tr_out[M_x] - 1 ||_max (the family-F_q ticket is 0). */export function instrumentTP(pair: InstrumentPair): number {
  const tot = cmatPartialTraceSecond(pair[0]);
  const t1 = cmatPartialTraceSecond(pair[1]);
  let d = 0;
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      d = Math.max(
        d,
        Math.abs((tot.re[i]![j] as number) + (t1.re[i]![j] as number) - (i === j ? 1 : 0)),
        Math.abs((tot.im[i]![j] as number) + (t1.im[i]![j] as number)),
      );
    }
  }
  return d;
}

// ---------------------------------------------------------------------------
// the parameterised detect-prepare sub-family + the OCB protocol as member
// ---------------------------------------------------------------------------

export interface PartyParams {
  /** measurement axis (unit vector), one per local input */
  readonly axis: readonly Axis[];
  /** measurement sharpness in [0,1], one per local input */
  readonly sharp: readonly number[];
  /** prepared Bloch vectors, per (local input, outcome) */
  readonly prep: ReadonlyArray<readonly Axis[]>;
}

export interface StrategyParams {
  readonly alice: PartyParams; // 2 slots (a = 0, 1)
  readonly bob: PartyParams; // 4 slots ((b,b') = 00, 01, 10, 11)
}

export function buildStrategy(params: StrategyParams): InstrumentBuilder {
  const buildParty = (p: PartyParams, key: number): InstrumentPair =>
    [
      detectPrepare(p.axis[key] as Axis, 0, p.sharp[key] as number, (p.prep[key] as readonly Axis[])[0] as Axis),
      detectPrepare(p.axis[key] as Axis, 1, p.sharp[key] as number, (p.prep[key] as readonly Axis[])[1] as Axis),
    ];
  return {
    alice: (a) => buildParty(params.alice, a),
    bob: (b, bp) => buildParty(params.bob, 2 * b + bp),
  };
}

const ZP: Axis = [0, 0, 1];
const XP: Axis = [1, 0, 0];
const ZERO: Axis = [0, 0, 0];

/** The OCB protocol (T3) as a member of family F_q: z-measurements, z/x-encodings. */
export function ocbStrategy(): InstrumentBuilder {
  return {
    alice: (a) => [
      detectPrepare(ZP, 0, 1, a === 0 ? ZP : [0, 0, -1]),
      detectPrepare(ZP, 1, 1, a === 0 ? ZP : [0, 0, -1]),
    ],
    bob: (b, bp) => {
      if (bp === 1) {
        // guess y from a z-measurement of B1; prepare |0>
        return [
          detectPrepare(ZP, 0, 1, ZERO),
          detectPrepare(ZP, 1, 1, ZERO),
        ];
      }
      // b' = 0: measure B1 in x (outcome t), prepare z-encoding of b XOR t
      const enc = (t: number): Axis => ((b ^ t) === 0 ? ZP : [0, 0, -1]);
      return [
        detectPrepare(XP, 0, 1, enc(0)),
        detectPrepare(XP, 1, 1, enc(1)),
      ];
    },
  };
}

// ---------------------------------------------------------------------------
// deterministic samplers (the sweep is reproducible; no Math.random anywhere)
// ---------------------------------------------------------------------------

/** mulberry32: small deterministic PRNG. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomAxis(rng: () => number): Axis {
  const z = 2 * rng() - 1;
  const phi = 2 * Math.PI * rng();
  const r = Math.sqrt(Math.max(0, 1 - z * z));
  return [r * Math.cos(phi), r * Math.sin(phi), z];
}

function randomBlochBall(rng: () => number): Axis {
  const n = randomAxis(rng);
  const rad = Math.cbrt(rng());
  return [n[0] * rad, n[1] * rad, n[2] * rad];
}

function randomPartyParams(rng: () => number, slots: number): PartyParams {
  const axis: Axis[] = [];
  const sharp: number[] = [];
  const prep: Array<readonly Axis[]> = [];
  for (let k = 0; k < slots; k++) {
    axis.push(randomAxis(rng));
    sharp.push(rng());
    prep.push([randomBlochBall(rng), randomBlochBall(rng)]);
  }
  return { axis, sharp, prep };
}

/** Uniform random detect-prepare strategy (axes on the sphere, preps in the ball). */
export function randomStrategyParams(rng: () => number): StrategyParams {
  return { alice: randomPartyParams(rng, 2), bob: randomPartyParams(rng, 4) };
}

// ---------------------------------------------------------------------------
// parameter-vector view + deterministic hill-climb (the sweep machinery)
// ---------------------------------------------------------------------------

const NUMS_PER_SLOT = 10; // axis(3) + sharp(1) + prep0(3) + prep1(3)

function partyToVector(p: PartyParams): number[] {
  const out: number[] = [];
  for (let k = 0; k < p.axis.length; k++) {
    out.push(...(p.axis[k] as Axis), (p.sharp[k] as number), ...((p.prep[k] as readonly Axis[])[0] as Axis), ...((p.prep[k] as readonly Axis[])[1] as Axis));
  }
  return out;
}

/** Flatten a strategy to 60 numbers (Alice 2 slots + Bob 4 slots, 10 each). */
export function paramsToVector(params: StrategyParams): number[] {
  return [...partyToVector(params.alice), ...partyToVector(params.bob)];
}

/**
 * Rebuild a strategy from its vector, SANITIZED into family F_q: sharpness and
 * axis length coupled so the POVM stays PSD (s|n| <= 1), prep radii clamped to
 * the Bloch ball. Every rebuilt point is a legal instrument family member.
 */
export function vectorToParams(v: readonly number[]): StrategyParams {
  const buildParty = (offset: number, slots: number): PartyParams => {
    const axis: Axis[] = [];
    const sharp: number[] = [];
    const prep: Array<readonly Axis[]> = [];
    for (let k = 0; k < slots; k++) {
      const o = offset + k * NUMS_PER_SLOT;
      const ax: Axis = [(v[o] as number), (v[o + 1] as number), (v[o + 2] as number)];
      const s = Math.max(-1, Math.min(1, v[o + 3] as number)); // |s| <= 1 …
      const nAx = Math.hypot(...ax);
      axis.push(ax);
      // … and s * |n| <= 1 so the POVM element (1 + s n.sigma)/2 stays PSD
      sharp.push(s / Math.max(1, Math.abs(s) * nAx));
      const clamp = (o2: number): Axis => {
        const r: Axis = [(v[o2] as number), (v[o2 + 1] as number), (v[o2 + 2] as number)];
        const nr = Math.hypot(...r);
        const scale = nr > 1 ? 1 / nr : 1;
        return [r[0] * scale, r[1] * scale, r[2] * scale];
      };
      prep.push([clamp(o + 4), clamp(o + 7)]);
    }
    return { axis, sharp, prep };
  };
  return { alice: buildParty(0, 2), bob: buildParty(2 * NUMS_PER_SLOT, 4) };
}

/** The OCB protocol in parameter-vector form (the known optimum, for probing attainment).
 *  Slot order (Bob): k = 2b + b', i.e. (0,0), (0,1), (1,0), (1,1). */
export function ocbParamsVector(): number[] {
  const slot = (axis: Axis, prep0: Axis, prep1: Axis): number[] => [...axis, 1, ...prep0, ...prep1];
  const ZP2: Axis = [0, 0, 1];
  const ZN: Axis = [0, 0, -1];
  const O: Axis = [0, 0, 0];
  return [
    ...slot(ZP2, ZP2, ZP2), // Alice a=0: z-measure, prepare |0>
    ...slot(ZP2, ZN, ZN), // Alice a=1: z-measure, prepare |1>
    ...slot([1, 0, 0], ZP2, ZN), // Bob (b=0, b'=0): x-measure, prepare b XOR t
    ...slot(ZP2, O, O), // Bob (b=0, b'=1): z-guess, prepare |0>
    ...slot([1, 0, 0], ZN, ZP2), // Bob (b=1, b'=0)
    ...slot(ZP2, O, O), // Bob (b=1, b'=1)
  ].flatMap((x) => x);
}

export interface ClimbResult {
  readonly params: StrategyParams;
  readonly value: number;
  readonly evals: number;
}

/** Deterministic coordinate hill-climb: per coordinate, try +/- step in place, keep the better. */
export function hillClimb(
  payoff: (p: StrategyParams) => number,
  start: readonly number[],
  rng: () => number,
  passes = 44,
  step0 = 0.5,
  shrink = 0.8,
): ClimbResult {
  const v = [...start];
  let value = payoff(vectorToParams(v));
  let evals = 1;
  let step = step0;
  for (let pass = 0; pass < passes; pass++) {
    for (let i = 0; i < v.length; i++) {
      const old = v[i] as number;
      const mag = step * (0.25 + 0.75 * rng());
      v[i] = old + mag;
      const vp = payoff(vectorToParams(v));
      evals++;
      v[i] = old - mag;
      const vm = payoff(vectorToParams(v));
      evals++;
      if (vp > value || vm > value) {
        if (vp >= vm) {
          v[i] = old + mag;
          value = vp;
        } else {
          v[i] = old - mag;
          value = vm;
        }
      } else {
        v[i] = old;
      }
    }
    step *= shrink;
  }
  return { params: vectorToParams(v), value, evals };
}

/** Random entangled-element instruments (probe family for the certificate lemmas). */
export function randomEntangledPair(rng: () => number): InstrumentPair {
  // random orthonormal pair phi0, phi1 on C^2 (complex Gram-Schmidt)
  const a0 = rng() * 2 - 1;
  const a1 = rng() * 2 - 1;
  const b0 = rng() * 2 - 1;
  const b1 = rng() * 2 - 1;
  let n = Math.hypot(a0, a1, b0, b1);
  const p0re = [a0 / n, a1 / n];
  const p0im = [b0 / n, b1 / n];
  // second vector: random, orthogonalised against phi0
  const c0 = rng() * 2 - 1;
  const c1 = rng() * 2 - 1;
  const d0 = rng() * 2 - 1;
  const d1 = rng() * 2 - 1;
  const dotRe = (c0) * (p0re[0] as number) + (c1) * (p0re[1] as number) + (d0) * (p0im[0] as number) + (d1) * (p0im[1] as number);
  const dotIm = (d0) * (p0re[0] as number) + (d1) * (p0re[1] as number) - (c0) * (p0im[0] as number) - (c1) * (p0im[1] as number);
  // v := v - phi0 <phi0|v>
  const v0re = (c0) - ((p0re[0] as number) * dotRe - (p0im[0] as number) * dotIm);
  const v0im = (d0) - ((p0re[0] as number) * dotIm + (p0im[0] as number) * dotRe);
  const v1re = (c1) - ((p0re[1] as number) * dotRe - (p0im[1] as number) * dotIm);
  const v1im = (d1) - ((p0re[1] as number) * dotIm + (p0im[1] as number) * dotRe);
  n = Math.hypot(v0re, v0im, v1re, v1im);
  return entangledInstrumentPair(0.25 + 0.5 * rng(), p0re, p0im, [v0re / n, v1re / n], [v0im / n, v1im / n]);
}
