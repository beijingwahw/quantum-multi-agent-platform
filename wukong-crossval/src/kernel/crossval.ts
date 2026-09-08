/**
 * The cross-validation kernel — instances, exact engine, offline QAOA,
 * dry-run QPU. All per the machine-time application's own spec:
 * optima by enumeration (never heuristics), parameters offline only,
 * the dry-run QPU never feeds back into optimization.
 */
import { requireQubitCount, requireUnitInterval, XvalError } from "./error.js";

/** Seeded RNG (mulberry32 idiom). */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Instance {
  readonly id: string;
  readonly n: number;
  readonly kind: "linear" | "coupled";
  /** QUBO coefficients: linear[i], coupling[i][j] (i < j, upper triangle) */
  readonly linear: readonly number[];
  readonly coupling: ReadonlyArray<readonly number[]>;
  /** exhaustive optimum (bitstring as number, MSB = qubit 0) and value */
  readonly optBits: number;
  readonly optValue: number;
}

/** A QUBO without its enumerated verdict — the shape quboValue and
 * enumerateOptimum actually consume (full instances are structurally
 * assignable, so callers pass either). */
export type QuboSpec = Omit<Instance, "optBits" | "optValue">;

export function quboValue(inst: QuboSpec, bits: number): number {
  if (inst.linear.length !== inst.n) {
    // a short linear row would poison the sum with undefined -> NaN (the
    // dimension-slot family); rejected by name, never shipped. Coupling rows
    // may be empty or trailing-omitted — boundary reads fall back to 0.
    throw new XvalError("XVAL_QUBO_SHAPE", `quboValue: linear must carry n=${String(inst.n)} coefficients, got ${String(inst.linear.length)} (coupling rows may be empty or trailing-omitted — boundary reads fall back to 0)`);
  }
  let v = 0;
  for (let i = 0; i < inst.n; i++) {
    const bi = (bits >> (inst.n - 1 - i)) & 1;
    if (bi === 1) v += inst.linear[i]!;
    for (let j = i + 1; j < inst.n; j++) {
      const bj = (bits >> (inst.n - 1 - j)) & 1;
      if (bi === 1 && bj === 1) v += inst.coupling[i]?.[j - i - 1] ?? 0;
    }
  }
  return v;
}

/** Exhaustive optimum — the only referee this repo trusts (law X1). */
export function enumerateOptimum(inst: QuboSpec): { optBits: number; optValue: number } {
  requireQubitCount(inst.n, "enumerateOptimum");
  let best = -Infinity;
  let bestBits = 0;
  for (let bits = 0; bits < 1 << inst.n; bits++) {
    const v = quboValue(inst, bits);
    if (v > best) {
      best = v;
      bestBits = bits;
    }
  }
  return { optBits: bestBits, optValue: best };
}

/** The 20-instance set: sizes 8/12/16/20 — 5 linear (extra at n=12) + 15 coupled. */
export function instanceSet(): Instance[] {
  const out: Instance[] = [];
  let lin = 0;
  let cp = 0;
  const mkLinear = (n: number, seed: number): QuboSpec => {
    const rng = makeRng(seed);
    const linear: number[] = [];
    for (let i = 0; i < n; i++) linear.push(Math.round((rng() * 20 - 10) * 10) / 10);
    return { id: `lin-n${n}-${lin++}`, n, kind: "linear", linear, coupling: Array.from({ length: n }, () => []) };
  };
  const mkCoupled = (n: number, k: number): QuboSpec => {
    const rng = makeRng(1000 + n * 10 + k);
    const linear: number[] = [];
    for (let i = 0; i < n; i++) linear.push(Math.round((rng() * 10 - 5) * 10) / 10);
    const coupling: number[][] = [];
    for (let i = 0; i < n; i++) {
      const row: number[] = [];
      for (let j = i + 1; j < n; j++) row.push(Math.round((rng() * 12 - 6) * 10) / 10);
      coupling.push(row);
    }
    return { id: `np-n${n}-${cp++}`, n, kind: "coupled", linear, coupling };
  };
  out.push(finish(mkLinear(8, 101)), finish(mkLinear(12, 113)), finish(mkLinear(12, 777)), finish(mkLinear(16, 116)), finish(mkLinear(20, 120)));
  for (let k = 0; k < 4; k++) out.push(finish(mkCoupled(8, k)));
  for (let k = 0; k < 3; k++) out.push(finish(mkCoupled(12, k)));
  for (let k = 0; k < 4; k++) out.push(finish(mkCoupled(16, k)));
  for (let k = 0; k < 4; k++) out.push(finish(mkCoupled(20, k)));
  return out;
}

function finish(base: QuboSpec): Instance {
  const { optBits, optValue } = enumerateOptimum(base);
  return { ...base, optBits, optValue };
}

// ---------------------------------------------------------------------------
// Exact statevector QAOA — real amplitudes, typed arrays, n <= 20.
// ---------------------------------------------------------------------------

/** Statevector layout: [real (dim) | imaginary (dim)], dim = 2^n. The single
 * source of the layout arithmetic — every kernel function goes through here
 * (docs/theory.md's "the layout constant is shared by every kernel function"
 * is this accessor, not a repeated idiom). */
export function dimOf(psi: Float64Array): number {
  return psi.length >> 1;
}

/** |amplitude_k|^2 — the basis-state probability, single-sourced so the
 * expectation, the sampler, and the Hamming-mass kernel share one expression
 * (bit-identical to the previously inlined re*re + im*im). */
export function probOf(psi: Float64Array, k: number): number {
  const half = dimOf(psi);
  return psi[k]! * psi[k]! + psi[half + k]! * psi[half + k]!;
}

/** The layout contract every statevector consumer enforces: dim = 2^n. */
export function requireStateLayout(psi: Float64Array, n: number, what: string): void {
  requireQubitCount(n, what);
  if (psi.length !== (1 << n) << 1) {
    throw new XvalError("XVAL_LAYOUT_MISMATCH", `${what}: statevector must carry (1 << n) * 2 = ${String((1 << n) << 1)} entries for n=${String(n)}, got ${String(psi.length)}`);
  }
}

/** Statevector layout: [real (dim) | imaginary (dim)], dim = 2^n. */
export function uniformState(n: number): Float64Array {
  requireQubitCount(n, "uniformState");
  const dim = 1 << n;
  const v = new Float64Array(2 * dim);
  const amp = 1 / Math.sqrt(dim);
  for (let k = 0; k < dim; k++) v[k] = amp;
  return v;
}

/** QUBO cost of every basis state (minimization form: -value). */
export function costTable(inst: Instance): Float64Array {
  requireQubitCount(inst.n, "costTable");
  const t = new Float64Array(1 << inst.n);
  for (let bits = 0; bits < t.length; bits++) t[bits] = -quboValue(inst, bits);
  return t;
}

/** Apply the cost phase e^{-i gamma c} to each amplitude. */
export function applyCost(psi: Float64Array, costs: Float64Array, gamma: number): void {
  const dim = dimOf(psi);
  if (costs.length < dim) {
    throw new XvalError("XVAL_LAYOUT_MISMATCH", `applyCost: cost table must cover every basis state (${String(dim)}), got ${String(costs.length)}`);
  }
  for (let k = 0; k < dim; k++) {
    const c = costs[k]!;
    if (c === 0) continue;
    const phRe = Math.cos(-gamma * c);
    const phIm = Math.sin(-gamma * c);
    const re = psi[k]!;
    const im = psi[dim + k]!;
    psi[k] = re * phRe - im * phIm;
    psi[dim + k] = re * phIm + im * phRe;
  }
}

/** Apply the single-qubit mixer rotation on qubit q (0 = MSB), in place.
 * SIGN CONVENTION (frozen, hand-anchored in the test suite): this applies
 * e^{+i (theta/2) X} — the conjugate of the textbook RX(theta) = e^{-i (theta/2) X}.
 * The offline optimizer searches beta freely, so the achievable circuit
 * family is closed under this conjugation (beta -> -beta), and every shipped
 * number is self-consistent in THIS convention; the X4 circuit export must
 * be consumed with the same sign, or the hardware circuit differs from the
 * dry-run by conjugated mixer layers. */
export function applyRX(psi: Float64Array, n: number, q: number, theta: number): void {
  requireStateLayout(psi, n, "applyRX");
  if (!Number.isInteger(q) || q < 0 || q >= n) {
    throw new XvalError("XVAL_N_RANGE", `applyRX: qubit index must be an integer in [0, n), got ${String(q)} for n=${String(n)}`);
  }
  const c = Math.cos(theta / 2);
  const s = Math.sin(theta / 2);
  const bit = 1 << (n - 1 - q);
  const half = dimOf(psi);
  for (let b0 = 0; b0 < half; b0++) {
    if ((b0 & bit) !== 0) continue;
    const b1 = b0 | bit;
    const r0 = psi[b0]!;
    const i0 = psi[half + b0]!;
    const r1 = psi[b1]!;
    const i1 = psi[half + b1]!;
    psi[b0] = c * r0 - s * i1;
    psi[half + b0] = c * i0 + s * r1;
    psi[b1] = c * r1 - s * i0;
    psi[half + b1] = c * i1 + s * r0;
  }
}

export interface QaoaParams {
  readonly betas: readonly number[];
  readonly gammas: readonly number[];
}

function requirePairedParams(params: QaoaParams, what: string): void {
  if (params.betas.length !== params.gammas.length) {
    throw new XvalError("XVAL_PARAMS_LENGTH", `${what}: betas and gammas must be paired per layer, got ${String(params.betas.length)} betas vs ${String(params.gammas.length)} gammas`);
  }
}

export function runQaoa(inst: Instance, params: QaoaParams): Float64Array {
  const n = inst.n;
  requirePairedParams(params, "runQaoa");
  const psi = uniformState(n);
  const costs = costTable(inst);
  const p = params.betas.length;
  for (let l = 0; l < p; l++) {
    applyCost(psi, costs, params.gammas[l]!);
    for (let q = 0; q < n; q++) applyRX(psi, n, q, 2 * params.betas[l]!);
  }
  return psi;
}

export function expectation(psi: Float64Array, costs: Float64Array): number {
  const half = dimOf(psi);
  if (costs.length < half) {
    throw new XvalError("XVAL_LAYOUT_MISMATCH", `expectation: cost table must cover every basis state (${String(half)}), got ${String(costs.length)}`);
  }
  let e = 0;
  for (let k = 0; k < half; k++) {
    e += probOf(psi, k) * costs[k]!;
  }
  return e;
}

/** Offline parameter optimization: coarse grid + coordinate refine. Offline ONLY (law X2).
 * Effort tiers by size (the n=20 universe costs ~1M amplitudes per evaluation):
 * full grid + refine for n <= 12, grid only for n = 16, coarse grid for n = 20. */
export function optimizeOffline(inst: Instance, p: number): QaoaParams {
  if (!Number.isInteger(p) || p < 0) {
    throw new XvalError("XVAL_DEPTH_RANGE", `optimizeOffline: layer count must be an integer >= 0 (p=0 is the uniform-state anchor), got ${String(p)}`);
  }
  const tier: "full" | "grid" | "coarse" = inst.n <= 12 ? "full" : inst.n <= 16 ? "grid" : "coarse";
  const costs = costTable(inst);
  const gridFull = [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4, Math.PI, (5 * Math.PI) / 4, (3 * Math.PI) / 2, (7 * Math.PI) / 4];
  const grid = tier === "full" ? gridFull : tier === "grid" ? [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4, Math.PI, (3 * Math.PI) / 2] : [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4, Math.PI];
  let best: QaoaParams = { betas: new Array<number>(p).fill(0), gammas: new Array<number>(p).fill(0) };
  let bestE = Infinity;
  const evalP = (params: QaoaParams): number => expectation(runQaoa(inst, params), costs);
  for (const g of grid) {
    for (const b of grid) {
      const params: QaoaParams = { betas: new Array<number>(p).fill(b / p), gammas: new Array<number>(p).fill(g / p) };
      const e = evalP(params);
      if (e < bestE) {
        bestE = e;
        best = params;
      }
    }
  }
  // coordinate refinement: one pass of local delta on each angle (full tier only)
  const deltas = [0.1, -0.1, 0.25, -0.25];
  for (let round = 0; tier === "full" && round < 2; round++) {
    for (let l = 0; l < p; l++) {
      for (const d of deltas) {
        for (const which of [0, 1] as const) {
          const betas = [...best.betas];
          const gammas = [...best.gammas];
          if (which === 0) betas[l] = betas[l]! + d / Math.max(1, p);
          else gammas[l] = gammas[l]! + d / Math.max(1, p);
          const cand: QaoaParams = { betas, gammas };
          const e = evalP(cand);
          if (e < bestE - 1e-9) {
            bestE = e;
            best = cand;
          }
        }
      }
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Dry-run QPU: sample the optimized state, readout confusion, calibration.
// ---------------------------------------------------------------------------

export interface DryRunResult {
  readonly shots: number;
  readonly counts: Map<number, number>;
  /** true-circuit hit rate: sampled from the optimized state BEFORE readout noise */
  readonly rawHitRate: number;
  /** hit rate AFTER symmetric per-qubit readout flips */
  readonly observedHitRate: number;
  /** observed / stay, clamped to [0,1] — the stated crude inversion (provenance: X3) */
  readonly calibratedHitRate: number;
}

/** Dry-run QPU: sample the optimized state, apply symmetric per-qubit readout flips
 * (flip probability stated per X3), report raw / observed / calibrated hit rates. */
export function sampleWithReadoutNoise(
  psi: Float64Array,
  n: number,
  optBits: number,
  shots: number,
  flipProb: number,
  rng: () => number,
): DryRunResult {
  requireStateLayout(psi, n, "sampleWithReadoutNoise");
  if (!Number.isInteger(optBits) || optBits < 0 || optBits >= 1 << n) {
    throw new XvalError("XVAL_BITS_RANGE", `sampleWithReadoutNoise: optBits must be a basis state in [0, ${String(1 << n)}) for n=${String(n)}, got ${String(optBits)}`);
  }
  if (!Number.isInteger(shots) || shots < 1) {
    throw new XvalError("XVAL_SHOTS_RANGE", `sampleWithReadoutNoise: shots must be an integer >= 1, got ${String(shots)}`);
  }
  requireUnitInterval(flipProb, "sampleWithReadoutNoise: flip probability");
  const half = dimOf(psi);
  const probs = new Float64Array(half);
  let acc = 0;
  for (let k = 0; k < half; k++) {
    acc += probOf(psi, k);
    probs[k] = acc;
  }
  const counts = new Map<number, number>();
  let raw = 0;
  let observed = 0;
  for (let s = 0; s < shots; s++) {
    const r = rng() * acc;
    let lo = 0;
    let hi = half - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (probs[mid]! < r) lo = mid + 1;
      else hi = mid;
    }
    let bits = lo;
    if (bits === optBits) raw++;
    for (let q = 0; q < n; q++) {
      if (rng() < flipProb) bits ^= 1 << (n - 1 - q);
    }
    counts.set(bits, (counts.get(bits) ?? 0) + 1);
    if (bits === optBits) observed++;
  }
  const stay = (1 - flipProb) ** n;
  return {
    shots,
    counts,
    rawHitRate: raw / shots,
    observedHitRate: observed / shots,
    calibratedHitRate: Math.min(1, observed / shots / Math.max(stay, 1e-9)),
  };
}

/** Qiskit-compatible circuit export (JSON): gates + measured qubits + offline params. */
export interface ExportedCircuit {
  readonly format: "qasm-like-json";
  readonly n: number;
  readonly instanceId: string;
  readonly layers: ReadonlyArray<{ gamma: number; beta: number }>;
  readonly cost: { linear: readonly number[]; coupling: ReadonlyArray<readonly number[]> };
  readonly shots: number;
}

export function exportCircuit(inst: Instance, params: QaoaParams, shots: number): ExportedCircuit {
  requirePairedParams(params, "exportCircuit");
  return {
    format: "qasm-like-json",
    n: inst.n,
    instanceId: inst.id,
    layers: params.betas.map((b, i) => ({ gamma: params.gammas[i]!, beta: b })),
    cost: { linear: inst.linear, coupling: inst.coupling },
    shots,
  };
}
