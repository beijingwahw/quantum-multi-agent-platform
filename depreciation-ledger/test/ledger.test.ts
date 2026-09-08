import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { LEDGER, LEGAL_VERDICTS, type LedgerRow } from "../src/kernel/ledger.js";
import { booksCost, checkLedger, quotesNumbers, readPackageScripts, runWitnesses } from "../src/kernel/audit.js";

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

test("L0 firing: a runtime-smuggled verdict outside the vocabulary is convicted by name", () => {
  // the cast is the crime under test: an untyped caller can hand checkLedger
  // a verdict string the type system never blessed — L0 is the runtime guard
  const forged = LEDGER.map((r, i) =>
    i === 0 ? ({ ...r, verdict: "SMUGGLED-AND-ILLEGAL" } as unknown as LedgerRow) : r,
  );
  const v = checkLedger(forged);
  const hit = v.find((x) => x.law === "L0");
  assert.ok(hit, `L0 did not fire: ${JSON.stringify(v)}`);
  assert.equal(hit.claimId, "#01");
  assert.match(hit.detail, /SMUGGLED-AND-ILLEGAL/);
});

test("L3 firing: a forged atlas anchor is convicted", () => {
  const forged = LEDGER.map((r, i) => (i === 0 ? { ...r, atlasRow: "an-anchor-that-exists-nowhere" } : r));
  const v = checkLedger(forged);
  const hit = v.find((x) => x.law === "L3");
  assert.ok(hit, `L3 did not fire: ${JSON.stringify(v)}`);
  assert.equal(hit.claimId, "#01");
  assert.match(hit.detail, /an-anchor-that-exists-nowhere/);
});

test("L5 firing: a forged appeal command and a missing appeal repo are both convicted", () => {
  const badCommand = LEDGER.map((r, i) => (i === 1 ? { ...r, appealCommand: "not-a-script" } : r));
  const hitCommand = checkLedger(badCommand).find((x) => x.law === "L5");
  assert.ok(hitCommand, `L5 (command) did not fire: ${JSON.stringify(checkLedger(badCommand))}`);
  assert.equal(hitCommand.claimId, "#02");
  assert.match(hitCommand.detail, /not a script/);

  const badRepo = LEDGER.map((r, i) => (i === 2 ? { ...r, appealRepo: "atlantis-repo" } : r));
  const hitRepo = checkLedger(badRepo).find((x) => x.law === "L5");
  assert.ok(hitRepo, `L5 (repo) did not fire: ${JSON.stringify(checkLedger(badRepo))}`);
  assert.equal(hitRepo.claimId, "#03");
  assert.match(hitRepo.detail, /appeal repo missing/);
});

test("L5 error face: a malformed appeal package.json is BOOKED as a violation, never a crash", () => {
  // an isolated mini-workspace (temp dir, removed in finally): one fake atlas
  // carrying the row's anchor and verdict tag, one appeal repo whose
  // package.json is garbage — the checker must convict by name, not throw
  const root = mkdtempSync(join(tmpdir(), "ledger-root-"));
  try {
    mkdirSync(join(root, "bqp-map", "src", "atlas"), { recursive: true });
    writeFileSync(
      join(root, "bqp-map", "src", "atlas", "entries.ts"),
      'export const ATLAS = [{ id: "fake-anchor", verdict: "HEURISTIC" }];\n',
      "utf8",
    );
    mkdirSync(join(root, "broken-repo"), { recursive: true });
    writeFileSync(join(root, "broken-repo", "package.json"), "{ this is not json", "utf8");
    const row: LedgerRow = {
      claimId: "#97",
      epoch: "smuggle",
      claim: "an appeal into a repo whose package.json is garbage",
      verdict: "HEURISTIC",
      numberColumn: "quoted 1",
      costColumn: "paid in full",
      atlasRow: "fake-anchor",
      appealRepo: "broken-repo",
      appealCommand: "repro",
    };
    const v = checkLedger([row], root);
    assert.equal(v.length, 1, `expected exactly the L5 conviction, got ${JSON.stringify(v)}`);
    assert.equal(v[0]?.law, "L5");
    assert.match(v[0]?.detail ?? "", /malformed JSON/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("readPackageScripts: the appeal manifest is validated, never cast-trusted", () => {
  const dir = mkdtempSync(join(tmpdir(), "ledger-pkg-"));
  try {
    const p = join(dir, "package.json");
    writeFileSync(p, "{ oops", "utf8");
    const malformed = readPackageScripts(p);
    assert.ok(!malformed.ok && /malformed JSON/.test(malformed.reason), JSON.stringify(malformed));

    writeFileSync(p, '"just a string"', "utf8");
    const notObject = readPackageScripts(p);
    assert.ok(!notObject.ok && /not an object/.test(notObject.reason), JSON.stringify(notObject));

    writeFileSync(p, JSON.stringify({ scripts: "nope" }), "utf8");
    const notTable = readPackageScripts(p);
    assert.ok(!notTable.ok && /not a table/.test(notTable.reason), JSON.stringify(notTable));

    writeFileSync(p, JSON.stringify({ scripts: { repro: "tsx run.ts", weird: 3 } }), "utf8");
    const table = readPackageScripts(p);
    assert.ok(table.ok, JSON.stringify(table));
    if (table.ok) {
      assert.ok(table.scripts.has("repro"));
      assert.ok(!table.scripts.has("weird"), "a non-string entry is not a callable script");
      assert.ok(!table.scripts.has("test"));
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("single source: the census the renderer counts IS the law the checker enforces", () => {
  // the trim reading is L1/L2's own; on the live seventeen rows it is
  // bit-identical to the raw-length reading the renderer used before the
  // merge — proven here, so the merge cannot have moved a single row
  for (const r of LEDGER) {
    assert.equal(quotesNumbers(r), r.numberColumn.length > 0, r.claimId);
    assert.equal(booksCost(r), r.costColumn.length > 0, r.claimId);
  }
  // and on the smuggled edge the two readings DIFFER: whitespace quotes
  // nothing, books nothing — the law's own classification
  assert.equal(quotesNumbers({ numberColumn: "   " }), false);
  assert.equal(booksCost({ costColumn: "\t\n" }), false);
});

test("single source: the verdict vocabulary is ONE list, and the five-witness prose is law", () => {
  for (const r of LEDGER) {
    assert.ok(LEGAL_VERDICTS.includes(r.verdict), `verdict ${r.verdict} of ${r.claimId} is outside the single-sourced vocabulary`);
  }
  const witnesses = runWitnesses();
  assert.equal(witnesses.length, 5, "the README and package description both say FIVE witnesses");
  assert.deepEqual(
    witnesses.map((w) => w.name.slice(0, 3)),
    ["W-A", "W-B", "W-C", "W-D", "W-E"],
  );
});
