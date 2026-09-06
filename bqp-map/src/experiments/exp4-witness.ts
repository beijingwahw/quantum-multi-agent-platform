/**
 * EXP4 — Witness verification: the QMA/NP asymmetry and the StoqMA boundary.
 *
 * A: one scheduling instance, both witnesses: classical bitstring (1 exact
 *    evaluation) vs quantum state (Born sampling); error ~ 1/sqrt(shots)
 * B: Hoeffding coverage law (completeness) and soundness rejection — both
 *    sides of the statistical contract, Monte Carlo verified
 * C: stoquastic dichotomy on annealing Hamiltonians: ZZ(any sign) - Gamma X
 *    has max off-diagonal EXACTLY -Gamma; +kappa XX lifts it to EXACTLY +kappa
 */
import { Rng } from "../core/rng.js";
import { fitSlope, table, writeReport } from "./report.js";
import { hoeffdingCoverage, quantumEnergyExact, quantumEnergySampled, soundness } from "../witness/verify.js";
import { stoqDichotomy } from "../witness/stoq.js";
import { totalOf } from "../reductions/makespan.js";
import { pathToFileURL } from "node:url";

function run(): void {
  const rng = new Rng(2026090504);
  const parts: string[] = [];
  const nums = Array.from({ length: 8 }, () => 3 + rng.int(18));
  const total = totalOf(nums);
  const dim = 2 ** nums.length;

  // A: asymmetry table
  {
    const w = { amps: Array.from({ length: dim }, () => 1 / Math.sqrt(dim)) };
    const exact = quantumEnergyExact(nums, w);
    const rows: Array<readonly string[]> = [];
    const logS: number[] = [];
    const logE: number[] = [];
    for (const shots of [100, 1000, 10000]) {
      const errs: number[] = [];
      for (let t = 0; t < 200; t++) {
        errs.push(Math.abs(quantumEnergySampled(nums, w, shots, rng) - exact));
      }
      const med = errs.slice().sort((a, b) => a - b)[Math.floor(errs.length / 2)] as number;
      rows.push([String(shots), exact.toFixed(4), med.toFixed(5)]);
      logS.push(Math.log10(shots));
      logE.push(Math.log10(med));
    }
    const slope = fitSlope(logS, logE);
    parts.push(
      `## A: witness asymmetry on one P2||Cmax instance (n=8)\n\nClassical witness: one bitstring z, verified by ONE exact evaluation makespan(z) <= B (deterministic, zero samples).\nQuantum witness: uniform state, exact <H> = ${exact.toFixed(4)} (linear-algebra referee).\n\n${table(["shots", "exact <H>", "median |estimate - exact|"], rows)}\n\nlog-log slope of median error vs shots: ${slope.toFixed(3)} (the 1/sqrt(m) law predicts -0.5). Verification cost is the price of the quantum witness's expressive scope.\n`,
    );
  }

  // B: coverage + soundness
  {
    const w = { amps: Array.from({ length: dim }, () => 1 / Math.sqrt(dim)) };
    const grid = [
      { eps: 4, delta: 0.1 },
      { eps: 2, delta: 0.1 },
      { eps: 1, delta: 0.1 },
      { eps: 2, delta: 0.05 },
    ];
    const cov = hoeffdingCoverage(nums, w, grid, 1000, 2026090540);
    const B = Math.ceil(total / 2) + 4;
    const eps = 2;
    const snd = soundness(nums, B, eps, 0.1, [1, 2, 3], 1000, 2026090541);
    parts.push(
      `## B: the statistical contract, both sides\n\n${table(
        ["eps", "delta", "Hoeffding shots", "empirical coverage", "holds (>= 1-delta)"],
        cov.map((c) => [c.eps.toFixed(1), c.delta.toFixed(2), String(c.shots), c.empiricalCoverage.toFixed(4), c.holds ? "OK" : "FAIL"]),
      )}\n\nSoundness (verifier accepts iff estimate <= B + eps; cheating states with <H> >= B + (1+gap)*eps):\n\n${table(
        ["gap (in units of eps)", "delta", "shots", "rejection rate", "holds (>= 1-delta)"],
        snd.map((s) => [s.gap.toFixed(1), s.delta.toFixed(2), String(s.shots), s.rejectionRate.toFixed(4), s.holds ? "OK" : "FAIL"]),
      )}\n`,
    );
    if (!cov.every((c) => c.holds) || !snd.every((s) => s.holds)) throw new Error("witness law violated");
  }

  // C: stoquastic dichotomy
  {
    const rows: Array<readonly string[]> = [];
    for (const [Gamma, kappa] of [
      [1.0, 0.5],
      [1.0, 2.0],
      [0.3, 0.1],
      [2.0, 5.0],
    ] as const) {
      const instances = Array.from({ length: 8 }, () => {
        const J = Array.from({ length: 5 }, () => {
          const i = rng.int(3);
          const j = i + 1 + rng.int(3 - i);
          return { i, j, w: rng.bernoulli(0.5) ? rng.int(5) + 1 : -(rng.int(5) + 1) };
        });
        const h = Array.from({ length: 4 }, () => (rng.bernoulli(0.5) ? 1 : -1) * (rng.int(4) + 1));
        const xx = [
          { i: 0, j: 1 },
          { i: 1, j: 2 },
        ];
        return { J, h, xx };
      });
      const v = stoqDichotomy(4, Gamma, kappa, instances);
      if (!v.dichotomyHolds) throw new Error("stoq dichotomy failed");
      rows.push([Gamma.toFixed(1), kappa.toFixed(1), v.stoqMaxOffDiag.toFixed(2), v.nonStoqMaxOffDiag.toFixed(2)]);
    }
    parts.push(
      `## C: stoquastic dichotomy (n=4, 8 random sign patterns per row)\n\n${table(
        ["Gamma", "kappa", "stoq max off-diag (= -Gamma exactly)", "nonstoq max off-diag (= +kappa exactly)"],
        rows,
      )}\n\nZZ couplers of ANY sign never leave the diagonal; the -Gamma X driver is the only off-diagonal term in the annealing regime and it is negative. One +kappa XX edge flips the certificate. This is the machine-checked boundary between StoqMA (BDOT08) and QMA-complete (KKR06) territory — the complexity-class face of nonstoq-anneal's sign barrier.\n`,
    );
  }

  const body = `# EXP4 — Witness verification and the StoqMA boundary\n\n${parts.join("\n")}`;
  const file = writeReport("exp4-witness.md", body);
  console.log(`exp4 done -> ${file}`);
}

// batch-33 retrofit: entry-guard law (house form since batch 21) — imports never render
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  run();
}
