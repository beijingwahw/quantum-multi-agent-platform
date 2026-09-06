/**
 * W1 — the correlation inventory.
 */
import {
  chshStandard,
  correlationFromTable,
  jointTable,
  phasePair,
  Rng,
  wernerCorrelation,
  wernerPair,
} from "../kernel/state.js";
import { writeReport, fmt } from "./report.js";
import { pathToFileURL } from "node:url";

function main(): void {
  const lines: string[] = [];
  lines.push("# W1 — the correlation inventory: what the joint column holds\n");
  lines.push("| p (visibility) | E(a,b) matrix path | -p a.b closed | worst dev (24 axis pairs) | CHSH | 2*sqrt(2)*p |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  const rng = new Rng(20260906);
  const axes: number[][] = [];
  for (let i = 0; i < 48; i++) axes.push(rng.axis());
  for (const p of [1, 0.9, 0.75, 0.5, 0.25]) {
    const rho = wernerPair(p);
    let worst = 0;
    for (let i = 0; i < 24; i++) {
      const a = axes[i] as number[];
      const b = axes[i + 24] as number[];
      const dev = Math.abs(correlationFromTable(jointTable(rho, a, b)) - wernerCorrelation(p, a, b));
      if (dev > worst) worst = dev;
    }
    const s = chshStandard(rho);
    lines.push(`| ${p} | (24 pairs) | (24 pairs) | ${fmt(worst, 15)} | ${fmt(s, 12)} | ${fmt(2 * Math.SQRT2 * p, 12)} |`);
  }
  lines.push("\nThe joint table P(x,y|a,b) = (1 - xy p a.b)/4 on both arithmetic paths; CHSH rides Tsirelson's line 2*sqrt(2)*p to machine precision (TSIR80).\n");

  lines.push("## The complex-anchor family |Phi_theta> = (|00> + e^{i theta}|11>)/sqrt(2)\n");
  lines.push("| theta | E(a,b) matrix path | full closed form | dev |");
  lines.push("| --- | --- | --- | --- |");
  const probeA = [0.6, 0.64, 0.48];
  const probeB = [-0.2, 0.9, 0.39];
  for (const theta of [0, Math.PI / 4, Math.PI / 3, Math.PI / 2]) {
    const rho = phasePair(theta);
    const e = correlationFromTable(jointTable(rho, probeA, probeB));
    const closed =
      Math.cos(theta) * (probeA[0]! * probeB[0]! - probeA[1]! * probeB[1]!) +
      probeA[2]! * probeB[2]! +
      Math.sin(theta) * (probeA[0]! * probeB[1]! + probeA[1]! * probeB[0]!);
    lines.push(`| ${fmt(theta, 4)} | ${fmt(e, 12)} | ${fmt(closed, 12)} | ${fmt(Math.abs(e - closed), 15)} |`);
  }
  lines.push("\nFull tensor: E = cos(theta)(ax bx - ay by) + az bz + sin(theta)(ax by + ay bx). The z-diagonal (+1, phase-blind) and the sin(theta) off-diagonals (phase-carrying, conjugation-sensitive) both anchor — the y-side cells break first under any conjugation slip. An earlier draft dropped both terms; the referee flagged the 0.1872 = az*bz residual at theta = 0 before shipping.\n");

  const path = writeReport("w1-correlations.md", lines.join("\n"));
  console.log(`exp W1 done -> ${path}`);
}

// batch-33 retrofit: entry-guard law (house form since batch 21) — imports never render
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
