/**
 * The cross-validation kernel — instances, exact engine, offline QAOA,
 * dry-run QPU. All per the machine-time application's own spec:
 * optima by enumeration (never heuristics), parameters offline only,
 * the dry-run QPU never feeds back into optimization.
 */

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

export function quboValue(inst: Instance, bits: number): number {
  let v = 0;
  for (let i = 0; i < inst.n; i++) {
    const bi = (bits >> (inst.n - 1 - i)) & 1;
    if (bi === 1) v += inst.linear[i] as number;
    for (let j = i + 1; j < inst.n; j++) {
      const bj = (bits >> (inst.n - 1 - j)) & 1;
      if (bi === 1 && bj === 1) v += ((inst.coupling[i] as readonly number[])[j - i - 1] ?? 0);
    }
  }
  return v;
}

/** Exhaustive optimum — the only referee this repo trusts (law X1). */
export function enumerateOptimum(inst: Omit<Instance, "optBits" | "optValue">): { optBits: number; optValue: number } {
  let best = -Infinity;
  let bestBits = 0;
  for (let bits = 0; bits < 1 << inst.n; bits++) {
    const v = quboValue({ ...inst, optBits: 0, optValue: 0 }, bits);
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
  const mkLinear = (n: number, seed: number): Omit<Instance, "optBits" | "optValue"> => {
    const rng = makeRng(seed);
    const linear: number[] = [];
    for (let i = 0; i < n; i++) linear.push(Math.round((rng() * 20 - 10) * 10) / 10);
    return { id: `lin-n${n}-${lin++}`, n, kind: "linear", linear, coupling: Array.from({ length: n }, () => []) };
  };
  const mkCoupled = (n: number, k: number): Omit<Instance, "optBits" | "optValue"> => {
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

function finish(base: Omit<Instance, "optBits" | "optValue">): Instance {
  const { optBits, optValue } = enumerateOptimum(base);
  return { ...base, optBits, optValue };
}

// ---------------------------------------------------------------------------
// Exact statevector QAOA — real amplitudes, typed arrays, n <= 20.
// ---------------------------------------------------------------------------

/** Statevector layout: [real (dim) | imaginary (dim)], dim = 2^n. */
export function uniformState(n: number): Float64Array {
  const dim = 1 << n;
  const v = new Float64Array(2 * dim);
  const amp = 1 / Math.sqrt(dim);
  for (let k = 0; k < dim; k++) v[k] = amp;
  return v;
}

/** QUBO cost of every basis state (minimization form: -value). */
export function costTable(inst: Instance): Float64Array {
  const t = new Float64Array(1 << inst.n);
  for (let bits = 0; bits < t.length; bits++) t[bits] = -quboValue(inst, bits);
  return t;
}

/** Apply the cost phase e^{-i gamma c} to each amplitude. */
export function applyCost(psi: Float64Array, costs: Float64Array, gamma: number): void {
  const dim = psi.length >> 1;
  for (let k = 0; k < dim; k++) {
    const c = costs[k] as number;
    if (c === 0) continue;
    const phRe = Math.cos(-gamma * c);
    const phIm = Math.sin(-gamma * c);
    const re = psi[k] as number;
    const im = psi[dim + k] as number;
    psi[k] = re * phRe - im * phIm;
    psi[dim + k] = re * phIm + im * phRe;
  }
}

/** Apply a single-qubit RX(theta) rotation on qubit q (0 = MSB), in place. */
export function applyRX(psi: Float64Array, n: number, q: number, theta: number): void {
  const c = Math.cos(theta / 2);
  const s = Math.sin(theta / 2);
  const bit = 1 << (n - 1 - q);
  const half = psi.length >> 1;
  for (let b0 = 0; b0 < half; b0++) {
    if ((b0 & bit) !== 0) continue;
    const b1 = b0 | bit;
    const r0 = psi[b0] as number;
    const i0 = psi[half + b0] as number;
    const r1 = psi[b1] as number;
    const i1 = psi[half + b1] as number;
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

export function runQaoa(inst: Instance, params: QaoaParams): Float64Array {
  const n = inst.n;
  const psi = uniformState(n);
  const costs = costTable(inst);
  const p = params.betas.length;
  for (let l = 0; l < p; l++) {
    applyCost(psi, costs, params.gammas[l] as number);
    for (let q = 0; q < n; q++) applyRX(psi, n, q, 2 * (params.betas[l] as number));
  }
  return psi;
}

export function expectation(psi: Float64Array, costs: Float64Array): number {
  let e = 0;
  const half = psi.length >> 1;
  for (let k = 0; k < half; k++) {
    const p = psi[k]! * psi[k]! + (psi[half + k] as number) * (psi[half + k] as number);
    e += p * (costs[k] as number);
  }
  return e;
}

/** Offline parameter optimization: coarse grid + coordinate refine. Offline ONLY (law X2).
 * Effort tiers by size (the n=20 universe costs ~1M amplitudes per evaluation):
 * full grid + refine for n <= 12, grid only for n = 16, coarse grid for n = 20. */
export function optimizeOffline(inst: Instance, p: number): QaoaParams {
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
          if (which === 0) betas[l] = (betas[l] as number) + d / Math.max(1, p);
          else gammas[l] = (gammas[l] as number) + d / Math.max(1, p);
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
  const half = psi.length >> 1;
  const probs = new Float64Array(half);
  let acc = 0;
  for (let k = 0; k < half; k++) {
    acc += psi[k]! * psi[k]! + (psi[half + k] as number) * (psi[half + k] as number);
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
      if ((probs[mid] as number) < r) lo = mid + 1;
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
  return {
    format: "qasm-like-json",
    n: inst.n,
    instanceId: inst.id,
    layers: params.betas.map((b, i) => ({ gamma: params.gammas[i] as number, beta: b })),
    cost: { linear: inst.linear, coupling: inst.coupling },
    shots,
  };
}
