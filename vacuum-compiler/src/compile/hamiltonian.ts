/**
 * The vacuum compiler: circuit -> Hamiltonian.
 *
 * Tensor ordering: data (dim 2^n) ⊗ clock (dim T+1), basis index d*(T+1)+t.
 *
 * H_prop = Σ_{t=1..T} ½ [ I⊗|t><t| + I⊗|t-1><t-1|
 *                          - U_t⊗|t><t-1| - U_t†⊗|t-1><t| ]
 * Each summand = ½ (I⊗|t> - U_t†⊗|t-1>)(h.c.) ⪰ 0, and the history state of
 * ANY input is annihilated (the certificate this repository exists to stamp).
 *
 * H_in lifts histories whose clock-0 state violates the input convention;
 * H_out penalizes non-accepting data states at clock T.
 * H_fuel = -ε Σ_t t |t><t| ⊗ I tilts the clock toward late times — the oil
 * that buys readout probability and (measured, not assumed) dirties the cargo.
 */
import { type CMat, cmatEye, cmatHermDev, cmatMul, cmatZero } from "../core/cmat.js";
import type { CompiledProgram } from "./circuit.js";

export interface CompiledHamiltonian {
  readonly h: CMat;
  readonly nQubits: number;
  readonly clockStates: number; // T+1
  readonly parts: { prop: boolean; input: boolean; output: boolean };
  readonly hermDev: number;
}

function dataDim(nQubits: number): number {
  return 2 ** nQubits;
}

export function buildPropagation(nQubits: number, steps: ReadonlyArray<{ matrix: CMat }>): CMat {
  const D = dataDim(nQubits);
  const C = steps.length + 1;
  const h = cmatZero(D * C);
  for (let t = 1; t <= steps.length; t++) {
    const u = steps[t - 1]!.matrix;
    for (let i = 0; i < D; i++) {
      for (let j = 0; j < D; j++) {
        // I⊗|t><t| and I⊗|t-1><t-1|: diagonal in clock
        if (i === j) {
          h.re[i * C + t]![j * C + t] = (h.re[i * C + t]![j * C + t] as number) + 0.5;
          h.re[i * C + t - 1]![j * C + t - 1] = (h.re[i * C + t - 1]![j * C + t - 1] as number) + 0.5;
        }
        // -½ U_t ⊗ |t><t-1|
        const ur = u.re[i]![j] as number;
        const ui = u.im[i]![j] as number;
        h.re[i * C + t]![j * C + t - 1] = (h.re[i * C + t]![j * C + t - 1] as number) - 0.5 * ur;
        h.im[i * C + t]![j * C + t - 1] = (h.im[i * C + t]![j * C + t - 1] as number) - 0.5 * ui;
        // -½ U_t† ⊗ |t-1><t| : U†_{ij} = conj(U_{ji})
        const adr = u.re[j]![i] as number;
        const adi = -(u.im[j]![i] as number);
        h.re[i * C + t - 1]![j * C + t] = (h.re[i * C + t - 1]![j * C + t] as number) - 0.5 * adr;
        h.im[i * C + t - 1]![j * C + t] = (h.im[i * C + t - 1]![j * C + t] as number) - 0.5 * adi;
      }
    }
  }
  return h;
}

export function buildInputCheck(nQubits: number, checkedQubits: readonly number[], T: number): CMat {
  const D = dataDim(nQubits);
  const C = T + 1;
  const h = cmatZero(D * C);
  const checked = new Set(checkedQubits);
  for (let d = 0; d < D; d++) {
    let violated = false;
    for (let q = 0; q < nQubits; q++) {
      if (!checked.has(q)) continue;
      // qubit q is bit (nQubits-1-q) of index d (q0 = most significant)
      const bit = (d >> (nQubits - 1 - q)) & 1;
      if (bit === 1) violated = true;
    }
    if (violated) h.re[d * C]![d * C] = 1;
  }
  return h;
}

export function buildOutputCheck(nQubits: number, acceptPattern: ReadonlyMap<number, 0 | 1>, T: number): CMat {
  const D = dataDim(nQubits);
  const C = T + 1;
  const h = cmatZero(D * C);
  for (let d = 0; d < D; d++) {
    let accepting = true;
    for (const [q, bit] of acceptPattern) {
      const observed = (d >> (nQubits - 1 - q)) & 1;
      if (observed !== bit) accepting = false;
    }
    if (!accepting) h.re[d * C + T]![d * C + T] = 1;
  }
  return h;
}

export function buildFuel(nQubits: number, T: number, epsilon: number): CMat {
  const D = dataDim(nQubits);
  const C = T + 1;
  const h = cmatZero(D * C);
  for (let d = 0; d < D; d++) {
    for (let t = 0; t < C; t++) h.re[d * C + t]![d * C + t] = -epsilon * t;
  }
  return h;
}

export function assemble(
  prog: CompiledProgram,
  opts: { input?: boolean; output?: boolean; epsilon?: number } = {},
): CompiledHamiltonian {
  const { circuit, checkedQubits, acceptPattern } = prog;
  const T = circuit.steps.length;
  const D = dataDim(circuit.nQubits);
  const C = T + 1;
  const h = buildPropagation(circuit.nQubits, circuit.steps);
  const withInput = opts.input ?? true;
  const withOutput = opts.output ?? false;
  if (withInput) {
    const hin = buildInputCheck(circuit.nQubits, checkedQubits, T);
    for (let i = 0; i < D * C; i++) h.re[i]![i] = (h.re[i]![i] as number) + (hin.re[i]![i] as number);
  }
  if (withOutput) {
    const hout = buildOutputCheck(circuit.nQubits, acceptPattern, T);
    for (let i = 0; i < D * C; i++) h.re[i]![i] = (h.re[i]![i] as number) + (hout.re[i]![i] as number);
  }
  const epsilon = opts.epsilon ?? 0;
  if (epsilon !== 0) {
    const hf = buildFuel(circuit.nQubits, T, epsilon);
    for (let i = 0; i < D * C; i++) h.re[i]![i] = (h.re[i]![i] as number) + (hf.re[i]![i] as number);
  }
  const hermDev = cmatHermDev(h);
  if (hermDev > 1e-14) throw new Error(`assembled Hamiltonian not Hermitian: ${hermDev}`);
  return {
    h,
    nQubits: circuit.nQubits,
    clockStates: C,
    parts: { prop: true, input: withInput, output: withOutput },
    hermDev,
  };
}

/** Closed-form anchor: the bare clock chain (identity gates) has propagation
 * spectrum = {1 - cos(pi k / C)} (k = 0..T), each 2^n-fold degenerate —
 * half the path-graph Laplacian on C = T+1 vertices. */
export function clockChainEigenvalue(k: number, clockStates: number): number {
  return 1 - Math.cos((Math.PI * k) / clockStates);
}

/** The bare clock chain operator itself: ½ the path-graph Laplacian on C
 * vertices, tensored with nothing (data space excluded). */
export function bareClockChain(clockStates: number): CMat {
  const C = clockStates;
  const m = cmatZero(C);
  for (let t = 1; t < C; t++) {
    m.re[t]![t] = (m.re[t]![t] as number) + 0.5;
    m.re[t - 1]![t - 1] = (m.re[t - 1]![t - 1] as number) + 0.5;
    m.re[t]![t - 1] = (m.re[t]![t - 1] as number) - 0.5;
    m.re[t - 1]![t] = (m.re[t - 1]![t] as number) - 0.5;
  }
  return m;
}

/** The dressing unitarity W = sum_t (U_t...U_1) ⊗ |t><t|. */
export function buildDressing(nQubits: number, steps: ReadonlyArray<{ matrix: CMat }>): CMat {
  const D = 2 ** nQubits;
  const C = steps.length + 1;
  const w = cmatZero(D * C);
  let v = cmatEye(D);
  for (let t = 0; t <= steps.length; t++) {
    if (t > 0) v = cmatMul((steps[t - 1] as { matrix: CMat }).matrix, v);
    for (let i = 0; i < D; i++) {
      for (let j = 0; j < D; j++) {
        w.re[i * C + t]![j * C + t] = v.re[i]![j] as number;
        w.im[i * C + t]![j * C + t] = v.im[i]![j] as number;
      }
    }
  }
  return w;
}
