/**
 * The three-stage scheduling contact surface: six-order switch vs six fixed
 * orders on an alloc₁–alloc₂–exec(γ) chain. Receiver = the machine register.
 *
 * Model (mirrors ../switch-sched exp3, one stage deeper):
 *   alloc₁ = X (write), alloc₂ = Z (write), exec(γ) = with probability γ the
 *   register is erased to |0><0|, else identity (Kraus: {sqrt(1-γ)I, sqrt(γ)|0><0|,
 *   sqrt(γ)|0><1|}). Distinguish the instances γ=1 vs γ=0 (exec always vs
 *   never erases) through each order; for the switch, tracing the control
 *   yields the uniform mixture of the six branch outputs.
 *
 * v0.3.0 (quality wave): the private matrix kernels (mulLocal, dagger) are
 * deleted — the shared src/core/cmat.js cmatMul/cmatDagger are bit-identical
 * and now the single source; erase, traceDistance and plusPlus are exported
 * for the k = 4 surface (sched4.ts), which reuses them verbatim.
 */
import { cmatDagger, cmatMul, cmatZero, type CMat } from "../core/cmat.js";
import { X2, Z2 } from "./promise.js";

/** The |+><+| scheduling input: sensitive to both X and Z writes. */
export function plusPlus(): CMat {
  const rho = cmatZero(2);
  rho.re[0]![0] = 0.5;
  rho.re[0]![1] = 0.5;
  rho.re[1]![0] = 0.5;
  rho.re[1]![1] = 0.5;
  return rho;
}

/** Apply a 1-qubit unitary to a density matrix. */
function unitaryOnRho(u: CMat, rho: CMat): CMat {
  // u rho u^dagger
  return cmatMul(cmatMul(u, rho), cmatDagger(u));
}

/** Erasure channel with probability γ: rho -> (1-γ)ρ + γ |0><0|. */
export function erase(gamma: number, rho: CMat): CMat {
  const out = cmatZero(2);
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      out.re[i]![j] = (1 - gamma) * rho.re[i]![j]!;
      out.im[i]![j] = (1 - gamma) * rho.im[i]![j]!;
    }
  }
  out.re[0]![0]! += gamma;
  return out;
}

function applyStage(stage: number, gamma: number, rho: CMat): CMat {
  if (stage === 0) return unitaryOnRho(X2, rho);
  if (stage === 1) return unitaryOnRho(Z2, rho);
  return erase(gamma, rho);
}

/**
 * Trace distance between two 1-qubit density matrices: T = (1/2)·Σ|λ_i| of
 * the Hermitian difference Δ = a − b, whose eigenvalues are t ± r with
 * t = Re[Δ₀₀+Δ₁₁]/2 and r = hypot(Re[Δ₀₀−Δ₁₁]/2, |Δ₁₀|) — the closed 2×2
 * form, exact for Hermitian inputs.
 */
export function traceDistance(a: CMat, b: CMat): number {
  const dr00 = a.re[0]![0]! - b.re[0]![0]!;
  const dr11 = a.re[1]![1]! - b.re[1]![1]!;
  const dr10r = a.re[1]![0]! - b.re[1]![0]!;
  const dr10i = a.im[1]![0]! - b.im[1]![0]!;
  const t = (dr00 + dr11) / 2;
  const r = Math.hypot((dr00 - dr11) / 2, Math.hypot(dr10r, dr10i));
  return (Math.abs(t + r) + Math.abs(t - r)) / 2;
}

export interface ChainResult {
  readonly fixed: Array<{ readonly seq: readonly [number, number, number]; readonly label: string; readonly d: number }>;
  readonly switchD: number;
}

/** Distinguish γ=1 vs γ=0 through all six orders and the six-order switch. */
export function chainDistinguishability(input: CMat): ChainResult {
  const outs = (gamma: number, seq: readonly [number, number, number]): CMat => {
    let rho = input;
    for (const s of seq) rho = applyStage(s, gamma, rho);
    return rho;
  };
  const seqs: ReadonlyArray<{ seq: readonly [number, number, number]; label: string }> = [
    { seq: [0, 1, 2], label: "X,Z,E" },
    { seq: [1, 0, 2], label: "Z,X,E" },
    { seq: [0, 2, 1], label: "X,E,Z" },
    { seq: [2, 0, 1], label: "E,X,Z" },
    { seq: [1, 2, 0], label: "Z,E,X" },
    { seq: [2, 1, 0], label: "E,Z,X" },
  ];
  const fixed = seqs.map((s) => ({ seq: s.seq, label: s.label, d: traceDistance(outs(1, s.seq), outs(0, s.seq)) }));
  // switch: uniform mixture over the six orders (control traced out)
  const mix = (gamma: number): CMat => {
    const m = cmatZero(2);
    for (const s of seqs) {
      const o = outs(gamma, s.seq);
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          m.re[i]![j] = m.re[i]![j]! + o.re[i]![j]! / 6;
          m.im[i]![j] = m.im[i]![j]! + o.im[i]![j]! / 6;
        }
      }
    }
    return m;
  };
  return { fixed, switchD: traceDistance(mix(1), mix(0)) };
}
