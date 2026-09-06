import { Rng } from "../core/rng.js";
import { randomIsing } from "../core/ising.js";
import { mpsAmplitude } from "../tn/mps.js";
import { dmrgGroundState } from "../tn/dmrg.js";
import type { ChainHamiltonian } from "../tn/mpo.js";
import { fmt, writeReport } from "./common.js";
import { pathToFileURL } from "node:url";

const SEED = 20260905;
const SIZES = [16, 24, 32, 48, 64];
const KAPPAS = [0, 0.5, 1.0];
const SAMPLES = 1000;

function chainOf(model: ReturnType<typeof randomIsing>, kappa: number): ChainHamiltonian {
  const nn = model.couplings.filter((c) => Math.abs(c.k - c.j) === 1 && c.k < model.n);
  const n = model.n;
  const alpha = model.fields.map((h) => -0.5 * h);
  const beta = new Array<number>(n).fill(-0.5);
  const omega = new Array<number>(n - 1).fill(0);
  const kap = new Array<number>(n - 1).fill(0);
  for (const c of nn) {
    const i = Math.min(c.j, c.k);
    omega[i] = -0.5 * c.w;
    kap[i] = 0.5 * kappa;
  }
  return { n, alpha, beta, omega, kappa: kap };
}

export function main(): void {
  const rows: Array<{
    n: number;
    kappa: number;
    energy: number;
    signP: number;
    negativeFraction: number;
    maxBond: number;
    wallMs: number;
  }> = [];

  for (const n of SIZES) {
    const model = randomIsing(new Rng(SEED + n), n);
    for (const kappa of KAPPAS) {
      const dmrg = dmrgGroundState(chainOf(model, kappa), {
        chiMax: 48,
        sweeps: 5,
        lanczosK: 16,
        seed: SEED + n + Math.round(kappa * 10),
      });
      // 基态振幅随机采样：P̂ = Σψ/Σ|ψ|（全局符号约定：Σψ ≥ 0）
      const rng = new Rng(SEED + 1000 + n);
      let sum = 0;
      let absSum = 0;
      let negatives = 0;
      for (let k = 0; k < SAMPLES; k++) {
        let bits = 0;
        for (let i = 0; i < n; i++) if (rng.next() < 0.5) bits |= 1 << i;
        const amp = mpsAmplitude(dmrg.state, bits);
        sum += amp;
        absSum += Math.abs(amp);
        if (amp < 0) negatives++;
      }
      const signP = sum < 0 ? -sum / absSum : sum / absSum;
      rows.push({
        n,
        kappa,
        energy: dmrg.energy,
        signP,
        negativeFraction: negatives / SAMPLES,
        maxBond: dmrg.maxBond,
        wallMs: dmrg.wallMs,
      });
    }
  }

  const payload = {
    experiment: "exp5-tensor-scale",
    method: "two-site DMRG (chi<=48) on open NN chains; sign metric by random amplitude sampling (K=1000)",
    rows,
  };

  const lines: string[] = [
    "# Experiment 5 — Tensor-network scaling: sign structure at n up to 64",
    "",
    "Open nearest-neighbor chains (exact diagonalization caps at n≈13; DMRG χ≤48 extends to 64).",
    "Sign metric P̂ = Σ_sampled ψ / Σ_sampled |ψ| (global sign fixed so P̂ ≥ 0), K=1000 samples.",
    "Regenerate: `npm run exp:scale`.",
    "",
    "| n | kappa | E0 (variational) | sign P̂ | negative fraction | max bond | wall ms |",
    "|---|---|---|---|---|---|---|",
    ...rows.map(
      (r) =>
        `| ${r.n} | ${r.kappa.toFixed(1)} | ${fmt(r.energy, 4)} | ${fmt(r.signP, 4)} | ${fmt(r.negativeFraction, 3)} | ${r.maxBond} | ${r.wallMs} |`,
    ),
    "",
    "Referee anchoring (test/tn.test.ts): DMRG energy matches imaginary-time projection at",
    "n=8/10/12 within 2e-3 (χ-truncation); stoquastic amplitudes are single-signed (Perron-",
    "Frobenius) at n=20; κ=0.5 develops negative amplitudes at n=20.",
    "",
  ];

  writeReport("exp5-tensor-scale", payload, lines.join("\n"));
}

if (import.meta.url === pathToFileURL(process.argv[1]!).href) main();
