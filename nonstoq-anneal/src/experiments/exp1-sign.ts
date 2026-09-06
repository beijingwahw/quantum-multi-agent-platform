import { Rng } from "../core/rng.js";
import { energies, randomIsing } from "../core/ising.js";
import { checkStoquasticity, xBasisEnergies } from "../anneal/driver.js";
import type { DriverSpec } from "../anneal/driver.js";
import { projectGroundState } from "../anneal/project.js";
import { fmt, writeReport } from "./common.js";
import { pathToFileURL } from "node:url";

const SEED = 20260905;
const KAPPAS = [0, 0.1, 0.3, 1.0];
const SIZES = [6, 8, 10, 12];
const S = 0.5;

export function main(): void {
  const rows: Array<{
    n: number;
    kappa: number;
    stoquastic: boolean;
    signRatio: number;
    energy: number;
    converged: boolean;
    steps: number;
  }> = [];

  for (const n of SIZES) {
    const model = randomIsing(new Rng(SEED + n), n);
    const E = energies(model);
    for (const kappa of KAPPAS) {
      const driver: DriverSpec = {
        gamma: 1,
        couplings: model.couplings.map((c) => ({ j: c.j, k: c.k, w: kappa })),
      };
      const xE = xBasisEnergies(n, driver);
      const proj = projectGroundState(n, E, xE, S, { dtau: 0.06, maxSteps: 3000, tolerance: 1e-10 });
      const matrixCheck = checkStoquasticity(driver);
      rows.push({
        n,
        kappa,
        stoquastic: matrixCheck.stoquastic,
        signRatio: proj.signRatio,
        energy: proj.energy,
        converged: proj.converged,
        steps: proj.steps,
      });
    }
  }

  const stoRows = rows.filter((r) => r.kappa === 0);
  const stoAllUnity = stoRows.every((r) => r.signRatio >= 1 - 1e-6 && r.converged);

  const payload = {
    experiment: "exp1-sign-barrier",
    seed: SEED,
    schedulePoint: S,
    note: "ground-state sign ratio P = sum(psi)/sum(|psi|) via imaginary-time projection at s=0.5; kappa on the problem's coupling edges; gamma=1",
    rows,
    stoquasticBaselineUnity: stoAllUnity,
  };

  const lines: string[] = [
    "# Experiment 1 — Sign-structure barrier of non-stoquastic drivers",
    "",
    "Ground state of H(s) = s·C + (1−s)·H_D at s=0.5, imaginary-time projection.",
    "P = Σψ/Σ|ψ|: 1 for every stoquastic ground state (Perron-Frobenius);",
    "P < 1 certifies the sign structure that worldline samplers pay for exponentially.",
    "Regenerate with `npm run exp:sign`.",
    "",
    "| n | kappa | sign ratio P | <H(s)> | converged | steps |",
    "|---|---|---|---|---|---|",
    ...rows.map(
      (r) =>
        `| ${r.n} | ${r.kappa.toFixed(1)} | ${fmt(r.signRatio, 6)} | ${fmt(r.energy, 4)} | ${r.converged ? "YES" : "cap"} | ${r.steps} |`,
    ),
    "",
    `**Stoquastic baseline (kappa=0): all P = 1 — ${stoAllUnity ? "CONFIRMED" : "check convergence"}**`,
    "",
  ];

  writeReport("exp1-sign", payload, lines.join("\n"));
}

if (import.meta.url === pathToFileURL(process.argv[1]!).href) main();
