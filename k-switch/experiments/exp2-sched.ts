/**
 * EXP2 — the three-stage scheduling contact surface: alloc₁(X)–alloc₂(Z)–
 * exec(γ) chain, γ=1 vs γ=0, six fixed orders vs the six-order switch.
 * Receiver = machine register. The law is discovered by the machine and
 * reported as found.
 */
import { chainDistinguishability, plusPlus } from "../src/kswitch/sched3.js";
import { table, writeReport } from "./report.js";

function run(): void {
  // input: |+> — sensitive to both X and Z writes (the shared single source)
  const input = plusPlus();

  const r = chainDistinguishability(input);
  const best = Math.max(...r.fixed.map((f) => f.d));
  const sorted = [...r.fixed].sort((a, b) => b.d - a.d);

  const body =
    `# EXP2 — Six-order scheduling contact surface\n\n` +
    `Input |+><+| (sensitive to both writes); distinguish "exec always erases" (γ=1) vs "never" (γ=0).\n\n` +
    table(
      ["order", "D (fixed)"],
      [...sorted.map((f) => [f.label, f.d.toFixed(12)]), ["**switch (6-order uniform)**", `**${r.switchD.toFixed(12)}**`]],
    ) +
    `\n\n**The law, as found (and hand-verified)**: ALL six fixed orders carry D = 1/√2 exactly — γ=1 outputs ` +
    `|0><0| while γ=0 outputs the unitary-rotated state, and T(|0>, X·Z|+> = |->) = sqrt(1-1/2) closed-form. ` +
    `The six-order switch lands at exactly 1/2 = D(fixed)/√2 — the mixture dilutes by the SAME factor 1/√2. ` +
    `Verdict unchanged from the two-box case (../switch-sched exp3): order superposition does not beat ANY ` +
    `definite order on scheduling primitives — the write must survive to the end to be read.\n`;

  for (const f of r.fixed) {
    if (Math.abs(f.d - Math.SQRT1_2) > 1e-12) {
      throw new Error(`exp2: fixed order ${f.label} D = ${f.d} != 1/sqrt(2)`);
    }
  }
  if (Math.abs(r.switchD - 0.5) > 1e-12) {
    throw new Error(`exp2: switch D = ${r.switchD} != 1/2`);
  }
  if (r.switchD > best + 1e-12) {
    throw new Error(`exp2: switch D ${r.switchD} beats best fixed ${best}`);
  }
  const file = writeReport("exp2-sched.md", body);
  console.log(`exp2 done -> ${file} — switch D = ${r.switchD.toFixed(6)}, best fixed = ${best}`);
}

run();
