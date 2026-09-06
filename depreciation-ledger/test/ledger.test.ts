import test from "node:test";
import assert from "node:assert/strict";
import { LEDGER } from "../src/kernel/ledger.js";
import { checkLedger, runWitnesses } from "../src/kernel/audit.js";

test("L-all: the ledger balances — every law holds on all 17 rows", () => {
  const v = checkLedger();
  assert.deepEqual(v, [], `violations: ${JSON.stringify(v)}`);
  assert.equal(LEDGER.length, 17);
});

test("L6: all five arithmetic witnesses pass", () => {
  for (const w of runWitnesses()) assert.ok(w.pass, `${w.name}: ${w.detail}`);
});

test("#17 self-enforcement: an unpriced number row is rejected by name", () => {
  const smuggled = [
    ...LEDGER,
    {
      claimId: "#99",
      epoch: "smuggle",
      claim: "a row that quotes a number and books nothing",
      verdict: "HEURISTIC" as const,
      numberColumn: "fantastic result, 99.9%",
      costColumn: "",
      atlasRow: "postselect-sort",
      appealRepo: "bqp-map",
      appealCommand: "test",
    },
  ];
  const v = checkLedger(smuggled);
  assert.equal(v.length, 1);
  assert.equal(v[0]?.claimId, "#99");
  assert.equal(v[0]?.law, "L1");
});

test("#17 self-enforcement: a numberless row with a priced verdict is rejected", () => {
  const smuggled = [
    ...LEDGER,
    {
      claimId: "#98",
      epoch: "smuggle",
      claim: "a row with no numbers but a confident verdict",
      verdict: "MECHANISM-SETTLED" as const,
      numberColumn: "",
      costColumn: "costs exist but nothing is quoted — should still be OPEN",
      atlasRow: "postselect-sort",
      appealRepo: "bqp-map",
      appealCommand: "test",
    },
  ];
  const v = checkLedger(smuggled);
  assert.equal(v.length, 1);
  assert.equal(v[0]?.law, "L2");
});

test("OPEN rows quote nothing — and after dtc-clock settled #10 at the model layer, the letter has NO open rows left (both graduations: #15 via stable-world, #10 via dtc-clock)", () => {
  const open = LEDGER.filter((r) => r.verdict === "OPEN");
  assert.equal(open.length, 0);
});
