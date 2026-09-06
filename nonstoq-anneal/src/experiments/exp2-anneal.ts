import { Rng } from "../core/rng.js";
import { bruteForce, energies, maxcut3Reg, randomIsing } from "../core/ising.js";
import type { IsingModel } from "../core/ising.js";
import type { DriverSpec } from "../anneal/driver.js";
import { anneal } from "../anneal/anneal.js";
import { fmt, writeReport } from "./common.js";
import { pathToFileURL } from "node:url";

const SEED = 20260905;
const TIMES = [4, 8, 16, 32];
const SLICES = 200;
const KAPPAS = [0, 0.05, 0.2, 0.5];

interface InstanceSpec {
  readonly id: string;
  readonly model: IsingModel;
}

export function main(): void {
  const instances: InstanceSpec[] = [];
  for (let i = 0; i < 5; i++) {
    instances.push({
      id: `random-n10-s${SEED + i}`,
      model: randomIsing(new Rng(SEED + i), 10),
    });
  }
  instances.push({
    id: `maxcut-n10-s${SEED + 100}`,
    model: maxcut3Reg(new Rng(SEED + 100), 10),
  });

  const rows: Array<{
    instance: string;
    kappa: number;
    time: number;
    successProbability: number;
    energyRatio: number;
  }> = [];

  for (const inst of instances) {
    const E = energies(inst.model);
    const optimum = bruteForce(E).optimum;
    for (const kappa of KAPPAS) {
      const driver: DriverSpec = {
        gamma: 1,
        couplings: inst.model.couplings.map((c) => ({ j: c.j, k: c.k, w: kappa })),
      };
      for (const T of TIMES) {
        const result = anneal(inst.model, E, optimum, driver, { time: T, slices: SLICES });
        rows.push({
          instance: inst.id,
          kappa,
          time: T,
          successProbability: result.successProbability,
          energyRatio: result.energyRatio,
        });
      }
    }
  }

  const payload = {
    experiment: "exp2-anneal",
    seed: SEED,
    slices: SLICES,
    instances: instances.map((i) => i.id),
    rows,
  };

  const lines: string[] = [
    "# Experiment 2 — Real-time anneal: stoquastic vs non-stoquastic drivers",
    "",
    `Linear schedule, ${SLICES} Trotter slices, kappa on the problem's coupling edges.`,
    "successProbability = P(measure an exact optimum). Mixed outcomes are reported",
    "as measured — non-stoquastic drivers help on some instances and hurt on others;",
    "the route claim is the sign barrier (exp1) and hardware exclusivity, not a",
    "guaranteed per-instance win. Regenerate with `npm run exp:anneal`.",
    "",
  ];
  for (const inst of instances) {
    lines.push(`### ${inst.id}`);
    lines.push("");
    lines.push("| kappa \\ T | " + TIMES.map((t) => `T=${t}`).join(" | ") + " |");
    lines.push("|---|" + TIMES.map(() => "---").join("|") + "|");
    for (const kappa of KAPPAS) {
      lines.push(
        `| κ=${kappa.toFixed(2)} | ` +
          rows
            .filter((r) => r.instance === inst.id && r.kappa === kappa)
            .map((r) => `${fmt(r.successProbability, 3)} (r=${fmt(r.energyRatio, 3)})`)
            .join(" | ") +
          " |",
      );
    }
    lines.push("");
  }

  writeReport("exp2-anneal", payload, lines.join("\n"));
}

if (import.meta.url === pathToFileURL(process.argv[1]!).href) main();
