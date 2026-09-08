/**
 * The four-stage scheduling contact surface (v0.2.0): 24-order switch vs 24
 * fixed orders on an alloc₁(X)–alloc₂(Z)–alloc₃(Y)–exec(γ) chain — exp2's
 * three-stage family one stage deeper. Receiver = the machine register.
 *
 * Model (mirrors sched3.ts): alloc = X/Z/Y write (unitary on the register),
 * exec(γ) = with probability γ the register is erased to |0><0|, else
 * identity. Distinguish γ=1 vs γ=0 through each order; for the switch, the
 * control is traced out — the uniform mixture of the 24 branch outputs.
 *
 * The k=3 law was: ALL six fixed orders D = 1/√2, switch D = 1/2 =
 * D(fixed)/√2. Does it survive to k = 4? The machine answers (exp5).
 */
import { cmatZero, type CMat } from "../core/cmat.js";
import { X2, Y2, Z2 } from "./promise.js";
import { S4 } from "./k4.js";

function unitaryOnRho(u: CMat, rho: CMat): CMat {
  return mulLocal(mulLocal(u, rho), dagger(u));
}

function mulLocal(a: CMat, b: CMat): CMat {
  const out = cmatZero(a.dim);
  for (let i = 0; i < a.dim; i++) {
    for (let k = 0; k < a.dim; k++) {
      const ar = a.re[i]![k]!;
      const ai = a.im[i]![k]!;
      if (ar === 0 && ai === 0) continue;
      for (let j = 0; j < b.dim; j++) {
        out.re[i]![j]! += ar * b.re[k]![j]! - ai * b.im[k]![j]!;
        out.im[i]![j]! += ar * b.im[k]![j]! + ai * b.re[k]![j]!;
      }
    }
  }
  return out;
}

function dagger(a: CMat): CMat {
  const out = cmatZero(a.dim);
  for (let i = 0; i < a.dim; i++) {
    for (let j = 0; j < a.dim; j++) {
      out.re[i]![j] = a.re[j]![i]!;
      out.im[i]![j] = -a.im[j]![i]!;
    }
  }
  return out;
}

function erase(gamma: number, rho: CMat): CMat {
  const out = cmatZero(2);
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      out.re[i]![j] = (1 - gamma) * (rho.re[i]![j] as number);
      out.im[i]![j] = (1 - gamma) * (rho.im[i]![j] as number);
    }
  }
  out.re[0]![0]! += gamma;
  return out;
}

function applyStage(stage: number, gamma: number, rho: CMat): CMat {
  if (stage === 0) return unitaryOnRho(X2, rho);
  if (stage === 1) return unitaryOnRho(Z2, rho);
  if (stage === 2) return unitaryOnRho(Y2, rho);
  return erase(gamma, rho);
}

function traceDistance(a: CMat, b: CMat): number {
  const dr00 = (a.re[0]![0] as number) - (b.re[0]![0] as number);
  const dr11 = (a.re[1]![1] as number) - (b.re[1]![1] as number);
  const dr10r = (a.re[1]![0] as number) - (b.re[1]![0] as number);
  const dr10i = (a.im[1]![0] as number) - (b.im[1]![0] as number);
  const t = (dr00 + dr11) / 2;
  const r = Math.hypot((dr00 - dr11) / 2, Math.hypot(dr10r, dr10i));
  return (Math.abs(t + r) + Math.abs(t - r)) / 2;
}

export interface Chain4Result {
  readonly fixed: ReadonlyArray<{ readonly label: string; readonly d: number }>;
  readonly switchD: number;
}

/** Distinguish γ=1 vs γ=0 through all 24 fixed orders and the 24-order switch. */
export function chainDistinguishability4(input: CMat): Chain4Result {
  const outs = (gamma: number, seq: readonly [number, number, number, number]): CMat => {
    let rho = input;
    for (const s of seq) rho = applyStage(s, gamma, rho);
    return rho;
  };
  const fixed = S4.map((p) => ({
    label: p.seq.map((s) => (s === 0 ? "X" : s === 1 ? "Z" : s === 2 ? "Y" : "E")).join(""),
    d: traceDistance(outs(1, p.seq), outs(0, p.seq)),
  }));
  const mix = (gamma: number): CMat => {
    const m = cmatZero(2);
    for (const p of S4) {
      const o = outs(gamma, p.seq);
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          m.re[i]![j] = m.re[i]![j]! + o.re[i]![j]! / 24;
          m.im[i]![j] = m.im[i]![j]! + o.im[i]![j]! / 24;
        }
      }
    }
    return m;
  };
  return { fixed, switchD: traceDistance(mix(1), mix(0)) };
}
