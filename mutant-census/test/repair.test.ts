/**
 * THE REPAIR-AUDIT GATE — R1-R3 enforced against the live registry and the
 * live enrollment, plus the smuggling docket: every law convicts by name.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { FIRING_EVIDENCE, REPAIR_AUDIT, checkRepairAudit, witnessRepairAudit, type FiringEvidence, type RepairRow } from "../src/kernel/repair.js";
import { ENROLLMENT, type EnrollmentRow } from "../src/kernel/enrollment.js";
import { loadLiveRegistry } from "../src/kernel/bridge.js";

test("W-Y the repair audit census: the whole booked population audited, live", async () => {
  const w = await witnessRepairAudit();
  assert.ok(w.pass, w.detail);
});

test("the repair state: eleven upgrades (b67#6 and b70#3 flipped under R1), thirty-three sharpenings, the rest held", async () => {
  const registry = await loadLiveRegistry();
  assert.equal(checkRepairAudit(REPAIR_AUDIT, ENROLLMENT, registry).length, 0);
  const byVerdict = (v: string): number => REPAIR_AUDIT.filter((r) => r.verdict === v).length;
  assert.equal(byVerdict("UPGRADED"), 11);
  assert.equal(byVerdict("SHARPENED"), 33);
  assert.equal(byVerdict("HELD"), 131);
  assert.equal(REPAIR_AUDIT.length, 175);
  // the tier census after the repair is arithmetic on the enrollment, not memory
  const gate = ENROLLMENT.filter((r) => r.tier === "GATE-ENFORCED").length;
  const booked = ENROLLMENT.filter((r) => r.tier === "BOOKED-UNENFORCEABLE").length;
  assert.equal(gate, 246);
  assert.equal(booked, 164);
  // the audit population is exactly the booked population plus the upgraded
  const audited = new Set(REPAIR_AUDIT.map((r) => r.key));
  const upgraded = new Set(REPAIR_AUDIT.filter((r) => r.verdict === "UPGRADED").map((r) => r.key));
  const expected = new Set([...ENROLLMENT.filter((r) => r.tier === "BOOKED-UNENFORCEABLE").map((r) => r.key), ...upgraded]);
  assert.deepEqual(audited, expected, "the audit population must equal live booked + upgraded, exactly");
});

test("the nine upgrades sit on their exact falsifying anchors", async () => {
  const byKey = new Map(ENROLLMENT.map((r) => [r.key, r] as const));
  const expect: Record<string, string> = {
    "b36#13": "dtc-clock/package.json :: test",
    "b37#1": "ds_extracted/ds/package.json :: test",
    "b37#7": "mutant-census/test/census.test.ts :: b37#7",
    "b47#1": "mutant-census/package.json :: typecheck",
    "b56#3": "stable-world/package.json :: typecheck",
    "b56#7": "stable-world/package.json :: test",
    "b56#8": "stable-world/package.json :: test",
    "b57#3": "stable-world/package.json :: typecheck",
    "b59#0": "stable-world/package.json :: typecheck",
  };
  for (const [key, anchor] of Object.entries(expect)) {
    const row = byKey.get(key)!;
    assert.equal(row.tier, "GATE-ENFORCED", `${key} must be gate-held after the repair`);
    assert.equal(row.anchor, anchor, `${key} sits on the wrong anchor`);
  }
});

// ---- the smuggling docket: every law convicts by name ----

test("smuggle R1-a: a booked row without an audit verdict is convicted (born-audited is law)", async () => {
  const registry = await loadLiveRegistry();
  const shrunk = REPAIR_AUDIT.filter((r) => r.key !== "b2#3");
  const hit = checkRepairAudit(shrunk, ENROLLMENT, registry).find((v) => v.law === "R1" && v.row === "b2#3");
  assert.ok(hit, "the un-audited booked row was NOT convicted");
  assert.match(hit.detail, /born-audited/);
});

test("smuggle R1-b: an UPGRADED verdict on a row that is not gate-held is convicted", async () => {
  const registry = await loadLiveRegistry();
  const forged: readonly RepairRow[] = REPAIR_AUDIT.map((r) =>
    r.key === "b2#3" ? { ...r, verdict: "UPGRADED", basis: "forged upgrade with no machine behind it" } : r,
  );
  const hit = checkRepairAudit(forged, ENROLLMENT, registry).find((v) => v.law === "R1" && v.row === "b2#3");
  assert.ok(hit, "the forged upgrade was NOT convicted");
  assert.match(hit.detail, /really is gate-held/);
});

test("smuggle R1-c: a later tier flip without an audit edit is convicted", async () => {
  const registry = await loadLiveRegistry();
  const flipped: readonly EnrollmentRow[] = ENROLLMENT.map((r) =>
    r.key === "b2#3" ? { ...r, tier: "GATE-ENFORCED" as const, anchor: "mutant-census/package.json :: typecheck", reason: "" } : r,
  );
  const hit = checkRepairAudit(REPAIR_AUDIT, flipped, registry).find((v) => v.law === "R1" && v.row === "b2#3");
  assert.ok(hit, "the stale HELD verdict on a flipped row was NOT convicted");
  assert.match(hit.detail, /same act/);
});

test("smuggle R2: an UPGRADED basis that does not cite its falsifying anchor is convicted", async () => {
  const registry = await loadLiveRegistry();
  const forged: readonly RepairRow[] = REPAIR_AUDIT.map((r) =>
    r.key === "b36#13" ? { ...r, basis: "upgraded for excellent reasons that name no gate" } : r,
  );
  const hit = checkRepairAudit(forged, ENROLLMENT, registry).find((v) => v.law === "R2" && v.row === "b36#13");
  assert.ok(hit, "the uncited upgrade was NOT convicted");
  assert.match(hit.detail, /verbatim/);
});

test("smuggle R3-a: an illegal verdict is convicted", async () => {
  const registry = await loadLiveRegistry();
  const forged: readonly RepairRow[] = [
    ...REPAIR_AUDIT,
    { key: "b2#3", verdict: "MAYBE" as unknown as RepairRow["verdict"], basis: "forged verdict outside the vocabulary" },
  ];
  const hit = checkRepairAudit(forged, ENROLLMENT, registry).find((v) => v.law === "R3");
  assert.ok(hit, "the illegal verdict was NOT convicted");
  assert.match(hit.detail, /vocabulary is closed/);
});

test("smuggle R3-b: an audit row for an error the registry does not carry is convicted", async () => {
  const registry = await loadLiveRegistry();
  const forged: readonly RepairRow[] = [...REPAIR_AUDIT, { key: "b99#9", verdict: "HELD", basis: "auditing an error that never existed" }];
  const hit = checkRepairAudit(forged, ENROLLMENT, registry).find((v) => v.law === "R3" && v.row === "b99#9");
  assert.ok(hit, "the dead key was NOT convicted");
});

test("smuggle R3-c: an empty basis is convicted", async () => {
  const registry = await loadLiveRegistry();
  const forged: readonly RepairRow[] = REPAIR_AUDIT.map((r) => (r.key === "b2#3" ? { ...r, basis: "   " } : r));
  const hit = checkRepairAudit(forged, ENROLLMENT, registry).find((v) => v.law === "R3" && v.row === "b2#3");
  assert.ok(hit, "the empty basis was NOT convicted");
});

test("smuggle R4-a: an UPGRADED row without firing evidence is convicted", async () => {
  const registry = await loadLiveRegistry();
  const shrunk = FIRING_EVIDENCE.filter((e) => e.key !== "b36#13");
  const hit = checkRepairAudit(REPAIR_AUDIT, ENROLLMENT, registry, shrunk).find((v) => v.law === "R4" && v.row === "b36#13");
  assert.ok(hit, "the upgrade without firing evidence was NOT convicted");
  assert.match(hit.detail, /needle-level witness/);
});

test("smuggle R4-b: an evidence needle that is not on disk is convicted", async () => {
  const registry = await loadLiveRegistry();
  const forged: readonly FiringEvidence[] = FIRING_EVIDENCE.map((e) =>
    e.key === "b56#7" ? { ...e, needle: "[U, H_tot] normm (a typo from memory)" } : e,
  );
  const hit = checkRepairAudit(REPAIR_AUDIT, ENROLLMENT, registry, forged).find((v) => v.law === "R4" && v.row === "b56#7");
  assert.ok(hit, "the dead evidence needle was NOT convicted");
  assert.match(hit.detail, /firing witness is not on disk/);
});

test("smuggle R4-c: firing evidence for a row that is not UPGRADED is convicted", async () => {
  const registry = await loadLiveRegistry();
  const forged: readonly FiringEvidence[] = [...FIRING_EVIDENCE, { key: "b2#3", path: "mutant-census/test/census.test.ts", needle: "b37#7" }];
  const hit = checkRepairAudit(REPAIR_AUDIT, ENROLLMENT, registry, forged).find((v) => v.law === "R4" && v.row === "b2#3");
  assert.ok(hit, "the orphan evidence row was NOT convicted");
  assert.match(hit.detail, /evidence follows verdicts/);
});
