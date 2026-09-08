/**
 * EXP5 — The four-stage scheduling contact surface (v0.2.0): 24-order switch
 * vs 24 fixed orders on alloc₁(X)–alloc₂(Z)–alloc₃(Y)–exec(γ), input |+⟩,
 * distinguish γ=1 vs γ=0. Does the k=3 law (D(fixed) = 1/√2 for every order,
 * D(switch) = D(fixed)/√2) survive to k = 4? The machine answers.
 */
import { cmatZero } from "../src/core/cmat.js";
import { chainDistinguishability4 } from "../src/kswitch/sched4.js";
import { table, writeReport } from "./report.js";

function run(): void {
  // input: |+> — sensitive to both X and Z writes (and Y flips it to |->)
  const input = cmatZero(2);
  input.re[0]![0] = 0.5;
  input.re[0]![1] = 0.5;
  input.re[1]![0] = 0.5;
  input.re[1]![1] = 0.5;

  const r = chainDistinguishability4(input);
  const fixedVals = new Set(r.fixed.map((f) => f.d.toFixed(12)));
  const best = Math.max(...r.fixed.map((f) => f.d));
  const dilution = r.switchD / Math.SQRT1_2;

  // closed form for the switch mixture (derived in docs/theory.md §7):
  // gamma=1 mixture = (2/3)|0><0| + (1/3)|1><1|, gamma=0 mixture = |-><-|
  //   => T = sqrt( (1/6)^2 + (1/2)^2 ) = sqrt(10)/6
  const closed = Math.sqrt(10) / 6;

  const body =
    `# EXP5 — The 24-order scheduling contact surface (k = 4)\n\n` +
    `Input |+⟩⟨+|; distinguish "exec always erases" (γ=1) vs "never" (γ=0) through each of the 24 fixed orders ` +
    `and the 24-order uniform switch (control traced out).\n\n` +
    table(
      ["receiver", "D"],
      [
        ["every fixed order (24 of 24)", `${[...fixedVals].join(" , ")} = 1/√2`],
        ["**switch (24-order uniform)**", `**${r.switchD.toFixed(12)}**`],
        ["switch closed form", `√10/6 = ${closed.toFixed(12)}`],
        ["dilution D(switch)/D(fixed)", `${dilution.toFixed(12)} = √5/3`],
      ],
    ) +
    `\n\n**The machine's verdict**: D(fixed) = 1/√2 SURVIVES — all 24 orders exactly (any prefix of the X/Z/Y writes ` +
    `keeps |+⟩ in the |±⟩ plane, and unitary stages after the erasure cannot change the trace distance). ` +
    `D(switch) = D(fixed)/√2 DOES **NOT** SURVIVE: the 24-order mixture lands at √10/6 = ${r.switchD.toFixed(6)}, ` +
    `NOT 1/2 — the dilution factor is √5/3 = ${dilution.toFixed(6)}, not 1/√2. The k=3 "halving law" (../switch-sched ` +
    `exp3, exp2 here) was that family's law at k = 2 and k = 3, not a universal: at k = 4 the mixture is slightly ` +
    `BETTER than halving but still strictly below EVERY definite order (Δ = D_sw − max D_fix = ` +
    `${(r.switchD - best).toFixed(6)} < 0). Verdict unchanged where it matters: order superposition does not beat ` +
    `ANY definite order on scheduling primitives.\n\n` +
    `Hand-checkable: with exactly one erasure stage E and unitary writes, γ=1 branches ending in E give |0⟩⟨0|; ` +
    `branches with writes after E give the write-image of |0⟩⟨0| — the 24-order average is (2/3)|0⟩⟨0| + (1/3)|1⟩⟨1| ` +
    `(16 of 24 branches end |0⟩), while every γ=0 branch is |−⟩⟨−| (the single Y flips |+⟩ to |−⟩ wherever it sits; ` +
    `X/Z only phase). T(diag(2/3,1/3), |−⟩⟨−|) = √((1/6)² + (1/2)²) = √10/6 — matches the machine.\n`;

  if (fixedVals.size !== 1 || Math.abs(Number([...fixedVals][0]) - Math.SQRT1_2) > 1e-12) {
    throw new Error(`exp5: fixed orders not uniformly 1/sqrt(2): ${[...fixedVals].join(",")}`);
  }
  if (Math.abs(r.switchD - closed) > 1e-12) {
    throw new Error(`exp5: switch D = ${r.switchD} != sqrt(10)/6 = ${closed}`);
  }
  if (r.switchD > best + 1e-12) {
    throw new Error(`exp5: switch D ${r.switchD} beats best fixed ${best}`);
  }
  const file = writeReport("exp5-sched4.md", body);
  console.log(`exp5 done -> ${file} — 24 fixed orders D=${Math.SQRT1_2.toFixed(6)}, switch D=${r.switchD.toFixed(9)} (= sqrt(10)/6), dilution ${dilution.toFixed(6)}`);
}

run();
