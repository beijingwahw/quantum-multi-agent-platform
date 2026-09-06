/**
 * EXP2 — the causal game, classical strategies exhausted: every deterministic
 * strategy in both orders, success capped at exactly 3/4.
 */
import { sweepDeterministic } from "../src/game/classical.js";
import { table, writeReport } from "./report.js";

function run(): void {
  const r = sweepDeterministic();
  const rows = [
    ["A ≺ B (all f,g,h functions)", String(4 * 4 * 256), r.orders.aFirst.toFixed(12)],
    ["B ≺ A (all f,g,h functions)", String(16 * 16 * 16), r.orders.bFirst.toFixed(12)],
  ];
  const body =
    `# EXP2 — The causal bound, exhausted\n\n` +
    `Every deterministic classical causal strategy in both orders enumerated\n` +
    `(shared randomness is a convex mixture — linearity keeps the cap):\n\n` +
    table(["order", "strategies", "max success"], rows) +
    `\n\n**The cap is exactly 3/4**: max over all ${r.strategiesSwept} deterministic strategies = ` +
    `${r.maxSuccess.toFixed(12)} (${r.argmaxCount} strategies attain it). Whichever direction the one bit ` +
    `flows, the other half of the game is a blind guess: in A ≺ B, Bob can learn a (win b'=1 always) ` +
    `but Alice cannot see b (win b'=0 half the time) — and vice versa.\n`;
  if (Math.abs(r.maxSuccess - 0.75) > 1e-12) {
    throw new Error(`exp2: causal cap ${r.maxSuccess} != 3/4`);
  }
  const file = writeReport("exp2-classical.md", body);
  console.log(`exp2 done -> ${file} — max = ${r.maxSuccess}`);
}

run();
