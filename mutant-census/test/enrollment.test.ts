/**
 * THE ENROLLMENT GATE — the E-board laws enforced against the LIVE registry,
 * plus its own smuggling docket: every law convicts by name.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ENROLLMENT, type EnrollmentRow } from "../src/kernel/enrollment.js";
import { loadLiveRegistry, type LiveRegistry } from "../src/kernel/bridge.js";
import { checkEnrollment, witnessEnrollment } from "../src/kernel/audit.js";

test("the enrollment covers every buried error exactly (E1-E6, live)", async () => {
  const registry = await loadLiveRegistry();
  assert.deepEqual(checkEnrollment(ENROLLMENT, registry), []);
});

test("W-F: the live enrollment witness passes", async () => {
  const w = await witnessEnrollment();
  assert.ok(w.pass, w.detail);
  assert.match(w.detail, /errors enrolled LIVE/);
});

test("smuggle E1a: a newly buried error without enrollment is convicted by name", async () => {
  // the smuggler buries a new batch and even fixes the declared totals — the
  // registry is internally consistent; the missing enrollment is the crime.
  // (batch 99, never a real key: a smuggling fixture that hardcodes a
  // "future" batch number becomes a live-key collision two deliveries later —
  // batch 35's fifth error, convicted by this very suite)
  const live = await loadLiveRegistry();
  const grown: LiveRegistry = {
    ...live,
    errors: [
      ...live.errors,
      { key: "b99#0", batch: 99, index: 0, repo: "mutant-census", category: "process", wrong: "a new error buried without enrollment" },
    ],
    batchCount: live.batchCount + 1,
    declaredBatches: live.batchCount + 1,
    declaredErrors: live.errors.length + 1,
  };
  const v = checkEnrollment(ENROLLMENT, grown);
  assert.equal(v.length, 1);
  assert.equal(v[0]?.law, "E1");
  assert.match(v[0]?.detail ?? "", /b99#0/);
  assert.match(v[0]?.detail ?? "", /cannot be buried/);
});

test("smuggle E1b: enrolling an error the registry does not carry is convicted", async () => {
  const live = await loadLiveRegistry();
  const rows: readonly EnrollmentRow[] = [
    ...ENROLLMENT,
    { key: "b99#0", category: "process", tier: "BOOKED-UNENFORCEABLE", anchor: "", reason: "a ghost error" },
  ];
  const v = checkEnrollment(rows, live);
  assert.equal(v.length, 1);
  assert.equal(v[0]?.law, "E1");
  assert.match(v[0]?.detail ?? "", /registry does not carry/);
});

test("smuggle E2a: an enrollment anchored to an unknown mutant is convicted", async () => {
  const live = await loadLiveRegistry();
  const rows = ENROLLMENT.map((r) => (r.key === "b4#0" ? { ...r, tier: "MUTANT-KILLED" as const, anchor: "MU42" } : r));
  const v = checkEnrollment(rows, live);
  assert.equal(v.length, 1);
  assert.equal(v[0]?.law, "E2");
  assert.match(v[0]?.detail ?? "", /unknown mutant "MU42"/);
});

test("smuggle E2b: a mutant that does not declare the error's class is convicted", async () => {
  const live = await loadLiveRegistry();
  // b19#3 is statistics (MU9's class); anchoring it on MU1 (conjugation-only)
  // claims a guard that never replayed this class
  const rows = ENROLLMENT.map((r) => (r.key === "b19#3" ? { ...r, anchor: "MU1" } : r));
  const v = checkEnrollment(rows, live);
  assert.equal(v.length, 1);
  assert.equal(v[0]?.law, "E2");
  assert.match(v[0]?.detail ?? "", /does not replay the "statistics" class/);
});

test("smuggle E3: gate anchors that are not on disk are convicted (both faces)", async () => {
  const live = await loadLiveRegistry();
  const missingFile = ENROLLMENT.map((r) =>
    r.key === "b21#2" ? { ...r, anchor: "atlantis/src/kernel/census.ts :: unguardedEntryFiles" } : r,
  );
  const v1 = checkEnrollment(missingFile, live);
  assert.equal(v1.length, 1);
  assert.equal(v1[0]?.law, "E3");
  assert.match(v1[0]?.detail ?? "", /anchor file missing/);

  const missingNeedle = ENROLLMENT.map((r) =>
    r.key === "b21#2" ? { ...r, anchor: "mutant-census/src/kernel/census.ts :: a-needle-that-is-not-there" } : r,
  );
  const v2 = checkEnrollment(missingNeedle, live);
  assert.equal(v2.length, 1);
  assert.equal(v2[0]?.law, "E3");
  assert.match(v2[0]?.detail ?? "", /not found in/);
});

test("smuggle E4: booking a line without a reason is convicted", async () => {
  const live = await loadLiveRegistry();
  const rows = ENROLLMENT.map((r) => (r.key === "b2#6" ? { ...r, reason: "" } : r));
  const v = checkEnrollment(rows, live);
  assert.equal(v.length, 1);
  assert.equal(v[0]?.law, "E4");
  assert.match(v[0]?.detail ?? "", /must say why/);
});

test("smuggle E5: a registry that declares other totals than it carries is convicted", async () => {
  const live = await loadLiveRegistry();
  const lying: LiveRegistry = { ...live, declaredErrors: live.errors.length - 1 };
  const v = checkEnrollment(ENROLLMENT, lying);
  assert.equal(v.length, 1);
  assert.equal(v[0]?.law, "E5");
  assert.match(v[0]?.detail ?? "", /may not drift/);
});

test("smuggle E6: duplicate keys, illegal tiers and category mislabels are convicted", async () => {
  const live = await loadLiveRegistry();
  const dup = ENROLLMENT.map((r) => (r.key === "b1#0" ? { ...r, key: "b1#1" } : r));
  assert.ok(checkEnrollment(dup, live).some((x) => x.law === "E6" && /duplicate/.test(x.detail)));

  const badTier = ENROLLMENT.map((r) =>
    r.key === "b1#0" ? { ...r, tier: "PRAYED-AWAY" as EnrollmentRow["tier"] } : r,
  );
  assert.ok(checkEnrollment(badTier, live).some((x) => x.law === "E6" && /illegal tier/.test(x.detail)));

  const mislabeled = ENROLLMENT.map((r) => (r.key === "b4#0" ? { ...r, category: "process" } : r));
  assert.ok(checkEnrollment(mislabeled, live).some((x) => x.law === "E6" && /mislabeled/.test(x.detail)));
});

test("the renderer refuses to print an illegal enrollment", async () => {
  const { renderCensus } = await import("../src/experiments/render.js");
  const rows = ENROLLMENT.map((r) => (r.key === "b2#6" ? { ...r, reason: "   " } : r));
  await assert.rejects(() => renderCensus(undefined, rows), /enrollment is illegal/);
});

test("E4's report face: every booked row is printed, none implied", async () => {
  const { renderCensus } = await import("../src/experiments/render.js");
  const text = await renderCensus();
  assert.match(text, /E-board — the enrollment census/);
  const booked = ENROLLMENT.filter((r) => r.tier === "BOOKED-UNENFORCEABLE");
  assert.ok(booked.length >= 30, `expected the honest boundary to be visible, got ${booked.length} booked rows`);
  for (const r of booked) assert.ok(text.includes(r.key), `${r.key} booked but not printed — the boundary must be visible`);
  assert.match(text, /W-F enrollment census/);
});
