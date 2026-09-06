/** in-repo probe (batch-22 lesson: probes live INSIDE the repo). Lists the
 * unguarded entry files the W-board detector sees, per repo. */
import { unguardedEntryFiles } from "./src/kernel/census.js";

const repos = [
  "bqp-map",
  "depreciation-ledger",
  "postselect-sched",
  "retro-cache",
  "qverify",
  "qram-sched",
  "quantum-mech",
  "ent-sched",
  "vacuum-compiler",
  "dsic-noether",
  "switch-sched",
  "causal-ineq",
  "k-switch",
  "nonstoq-anneal",
  "ft-qaoa",
];

for (const r of repos) {
  const files = unguardedEntryFiles(r);
  console.log(`${r}: ${files.length ? files.join(", ") : "(none detected)"}`);
}
