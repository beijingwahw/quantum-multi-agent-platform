import { strict as assert } from "node:assert";
import { test } from "node:test";
import { CONSTANTS_AUDIT, LIVE_CONSTANT_VALUES, validateConstantsAudit } from "../src/ft/constants.js";
import type { ConstantRow, ProvenanceSource } from "../src/ft/constants.js";

test("constants: the live audit passes the provenance gate", () => {
  const result = validateConstantsAudit(CONSTANTS_AUDIT);
  assert.deepEqual(
    result.rejected.map((r) => r.id),
    [],
    `live audit must be clean: ${JSON.stringify(result.rejected)}`,
  );
  assert.ok(result.valid);
  assert.ok(result.rowCount >= 18);
  assert.ok(result.anchoredCount >= 7, "at least 7 citation-anchored rows expected");
  assert.ok(result.assumptionCount >= 9, "engineering assumptions must stay labeled as such");
});

test("constants: audit rows bind the values the code actually consumes (no drift)", () => {
  const bound = CONSTANTS_AUDIT.filter((row) => row.binding !== undefined);
  assert.ok(bound.length >= 10, "most estimator constants should be bound to live values");
  for (const row of bound) {
    const live = LIVE_CONSTANT_VALUES[row.binding!.key];
    assert.notEqual(live, undefined, `binding key ${row.binding!.key} must exist live`);
    assert.equal(live, row.binding!.claimed, `drifted constant ${row.id}`);
  }
  // Spot anchors that the noise face depends on.
  assert.equal(LIVE_CONSTANT_VALUES["grossCode.k"], 12);
  assert.equal(LIVE_CONSTANT_VALUES["grossCode.d"], 12);
  assert.equal(LIVE_CONSTANT_VALUES["DEFAULT_FT_ASSUMPTIONS.pPhys"], 1e-3);
});

test("constants: Willow anchors for the noise grid are present and two-sourced", () => {
  const lambda = CONSTANTS_AUDIT.find((row) => row.id === "logical-error-suppression-lambda");
  assert.notEqual(lambda, undefined);
  assert.equal(lambda!.value, 2.14);
  const d7 = CONSTANTS_AUDIT.find((row) => row.id === "d7-logical-error-per-cycle");
  assert.notEqual(d7, undefined);
  assert.equal(d7!.value, 0.00143);
  const works = new Set(d7!.provenance.map((s) => s.workId));
  assert.ok(works.size >= 2, "anchored rows need >= 2 independent works");
});

const SRC_A: ProvenanceSource = { workId: "smuggled-work-a", title: "Fabricated Work A", locator: "arXiv:2501.00001", kind: "paper" };
const SRC_A_MIRROR: ProvenanceSource = {
  workId: "smuggled-work-a",
  title: "Fabricated Work A (journal mirror)",
  locator: "10.0000/fake-doi",
  kind: "paper",
};
const SRC_B: ProvenanceSource = { workId: "smuggled-work-b", title: "Fabricated Work B", locator: "10.0001/fake-doi", kind: "paper" };

test("smuggling trial: constant with fake single-work provenance is named and rejected", () => {
  // The smuggler cites one work twice under two locators and calls it anchored.
  const row: ConstantRow = {
    id: "smuggled-threshold",
    symbol: "p_th(fake)",
    value: 0.9,
    unit: "probability",
    kind: "citation-anchored",
    provenance: [SRC_A, SRC_A_MIRROR],
    usedIn: "nowhere (smuggling trial)",
  };
  const result = validateConstantsAudit([row]);
  assert.equal(result.valid, false);
  assert.equal(result.rejected.length, 1);
  assert.equal(result.rejected[0]!.id, "smuggled-threshold");
  assert.ok(
    result.rejected[0]!.reason.includes("needs >= 2 independent works, got 1"),
    `rejection must name the offense: ${result.rejected[0]!.reason}`,
  );
});

test("smuggling trial: provenance-free anchored row and bad locator are named and rejected", () => {
  const noProv: ConstantRow = {
    id: "smuggled-noprov",
    symbol: "p_th(telepathy)",
    value: 0.99,
    unit: "probability",
    kind: "citation-anchored",
    provenance: [],
    usedIn: "nowhere (smuggling trial)",
  };
  const badLocator: ConstantRow = {
    id: "smuggled-locator",
    symbol: "p_th(rumor)",
    value: 0.8,
    unit: "probability",
    kind: "citation-anchored",
    provenance: [
      SRC_A,
      { workId: "smuggled-work-c", title: "Heard It Somewhere", locator: "trust-me-bro", kind: "press" },
    ],
    usedIn: "nowhere (smuggling trial)",
  };
  const result = validateConstantsAudit([noProv, badLocator]);
  assert.equal(result.valid, false);
  const byId = new Map(result.rejected.map((r) => [r.id, r.reason]));
  assert.ok(byId.get("smuggled-noprov")!.includes("needs >= 2 independent works, got 0"));
  assert.ok(byId.get("smuggled-locator")!.includes("invalid provenance source"));
});

test("smuggling trial: drifted binding, thin rationale, and duplicate ids are rejected", () => {
  const drifted: ConstantRow = {
    id: "smuggled-drift",
    symbol: "d_gross",
    value: 13,
    unit: "code distance",
    kind: "citation-anchored",
    provenance: [SRC_A, SRC_B],
    binding: { key: "grossCode.d", claimed: 13 },
    usedIn: "nowhere (smuggling trial)",
  };
  const thin: ConstantRow = {
    id: "smuggled-thin",
    symbol: "A",
    value: 0.5,
    unit: "dimensionless",
    kind: "engineering-assumption",
    provenance: [],
    rationale: "looks right",
    usedIn: "nowhere (smuggling trial)",
  };
  const dup: ConstantRow = { ...thin, rationale: "a second copy of the same row id must be caught by the gate" };
  const result = validateConstantsAudit([drifted, thin, dup]);
  assert.equal(result.valid, false);
  const driftReason = result.rejected.find((r) => r.id === "smuggled-drift")!.reason;
  assert.ok(driftReason.includes("binding drift on 'grossCode.d': audit claims 13, code uses 12"));
  // thin and dup share an id: one rejection names the thin rationale, the
  // other names the duplicate — the map-free check keeps both visible.
  const thinReasons = result.rejected.filter((r) => r.id === "smuggled-thin").map((r) => r.reason);
  assert.equal(thinReasons.length, 2);
  assert.ok(thinReasons.some((r) => r.includes("needs a substantive rationale")));
  assert.ok(thinReasons.some((r) => r.includes("duplicate id")));
});
