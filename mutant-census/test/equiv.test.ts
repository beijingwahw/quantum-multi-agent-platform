/**
 * THE EQUIVALENCE GATE — the J-board's laws bite: the per-error verdicts are
 * LIVE (declared must equal computed, bit-exactly for collapses), the pilot is
 * exhaustive over its class, and the bookings carry their reasons. The
 * equivalent specimen's proof runs as a test of its own — the booking is not
 * prose, it is arithmetic.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeRng } from "../src/core/rng.js";
import { randomStateVec, vecToRho } from "../src/core/states.js";
import { vScale } from "../src/core/cmat.js";
import { PER_ERROR, batteryPrint, printsEqual, checkEquivalence, witnessEquivalence, runPerErrorCensus, perErrorFamily, PILOT_CLASSES, type PerErrorSpec } from "../src/kernel/equiv.js";
import { ENROLLMENT } from "../src/kernel/enrollment.js";

test("W-I: the per-error equivalence census is legal, and the verdict tally is the measured boundary", () => {
  const { result, rows } = witnessEquivalence();
  assert.ok(result.pass, result.detail);
  assert.equal(rows.length, 117, "four exhaustive pilots: conjugation 19 + wrong-object 44 + dimension-slot 29 + statistics 25");
  const tally = new Map<string, number>();
  for (const r of rows) tally.set(r.computed, (tally.get(r.computed) ?? 0) + 1);
  assert.equal(tally.get("COLLAPSES"), 9, "nine provenance collapses — every prototype MU1-MU9 now has its own history error as a bit-exact specimen");
  assert.equal(tally.get("ERROR-LEVEL"), 12, "seven conjugation + three wrong-object + two dimension-slot constructions, killed live");
  assert.equal(tally.get("EQUIVALENT"), 2, "two equivalent specimens: b30#0 (representation-blind) and b5#2 (degenerate-input-blind)");
  assert.equal(tally.get("UNBUILDABLE"), 94, "defects whose home is not a family member, across all four classes");
});

test("J2: a forged ERROR-LEVEL on the equivalent survivor is convicted by the live census", () => {
  const forged = PER_ERROR.map((r): PerErrorSpec =>
    r.key === "b30#0" ? { ...r, verdict: "ERROR-LEVEL", killer: "P2" } : r,
  );
  const census = runPerErrorCensus(forged);
  const v = checkEquivalence(forged, census);
  assert.ok(v.some((x) => x.law === "J2" && x.row === "b30#0" && /EQUIVALENT/.test(x.detail)), JSON.stringify(v));
});

test("J2: a forged COLLAPSES on a distinct construction is convicted (the prints differ)", () => {
  const forged = PER_ERROR.map((r): PerErrorSpec =>
    r.key === "b10#4" ? { ...r, verdict: "COLLAPSES", onto: "MU1" } : r,
  );
  const census = runPerErrorCensus(forged);
  const v = checkEquivalence(forged, census);
  assert.ok(v.some((x) => x.law === "J2" && x.row === "b10#4" && /ERROR-LEVEL/.test(x.detail)), JSON.stringify(v));
});

test("J2: an ERROR-LEVEL declared where no construction exists is convicted by the builder's refusal", () => {
  const forged = PER_ERROR.map((r): PerErrorSpec =>
    r.key === "b9#1" ? { ...r, verdict: "ERROR-LEVEL", killer: "P2", built: "invented" } : r,
  );
  const census = runPerErrorCensus(forged);
  const v = checkEquivalence(forged, census);
  assert.ok(v.some((x) => x.law === "J2" && x.row === "b9#1" && /builder refused|UNBUILDABLE/.test(x.detail)), JSON.stringify(v));
});

test("J1: dropping a pilot row and smuggling a foreign row are both convicted", () => {
  const dropped = PER_ERROR.filter((r) => r.key !== "b29#0");
  const vDrop = checkEquivalence(dropped, runPerErrorCensus(dropped));
  assert.ok(vDrop.some((x) => x.law === "J1" && x.row === "b29#0" && /exhaustive/.test(x.detail)), JSON.stringify(vDrop));
  const foreign: PerErrorSpec = { key: "b1#0", prototype: "ds_extracted/ds/package.json :: test", verdict: "UNBUILDABLE", reason: "smuggled: a GATE-ENFORCED row — the census runs over mutation-killed rows only" };
  const vForeign = checkEquivalence([...PER_ERROR, foreign], runPerErrorCensus([...PER_ERROR, foreign]));
  assert.ok(vForeign.some((x) => x.law === "J1" && x.row === "b1#0" && /pilot class/.test(x.detail)), JSON.stringify(vForeign));
});

test("J1: re-labeling a row's prototype away from the enrollment's own anchor is convicted", () => {
  const forged = PER_ERROR.map((r): PerErrorSpec => (r.key === "b20#0" ? { ...r, prototype: "MU1" } : r));
  const v = checkEquivalence(forged, runPerErrorCensus(forged));
  assert.ok(v.some((x) => x.law === "J1" && x.row === "b20#0" && /re-labeled/.test(x.detail)), JSON.stringify(v));
});

test("J3: EQUIVALENT and UNBUILDABLE rows without reasons are convicted; buildable rows without constructions too", () => {
  const noReason = PER_ERROR.map((r): PerErrorSpec =>
    r.key === "b4#0" ? { ...r, reason: "" } : r,
  );
  const vReason = checkEquivalence(noReason, runPerErrorCensus(noReason));
  assert.ok(vReason.some((x) => x.law === "J3" && x.row === "b4#0" && /reason/.test(x.detail)), JSON.stringify(vReason));
  const noBuilt = PER_ERROR.map((r): PerErrorSpec => (r.key === "b16#0" ? { ...r, built: "" } : r));
  const vBuilt = checkEquivalence(noBuilt, runPerErrorCensus(noBuilt));
  assert.ok(vBuilt.some((x) => x.law === "J3" && x.row === "b16#0" && /construction line/.test(x.detail)), JSON.stringify(vBuilt));
});

test("the equivalent specimen's proof, live: vecToRho of the globally-negated ket is ELEMENTWISE identical", () => {
  const rng = makeRng(5959);
  for (let t = 0; t < 200; t++) {
    const d = t % 2 === 0 ? 2 : 4;
    const psi = randomStateVec(rng, d);
    const a = vecToRho(psi);
    const b = vecToRho(vScale(psi, -1));
    for (let k = 0; k < a.re.length; k++) {
      assert.equal(a.re[k], b.re[k], `real part moved at input ${t}`);
      assert.equal(a.im[k], b.im[k], `imaginary part moved at input ${t}`);
    }
  }
});

test("the twin: b26#0 and b28#2 are the same mutation shape — battery-indistinguishable twins", () => {
  const a = batteryPrint(perErrorFamily("b26#0"));
  const b = batteryPrint(perErrorFamily("b28#2"));
  assert.ok(printsEqual(a, b), "two errors, one mutation shape — the prints must agree bit-exactly");
});

test("the pilots cover exactly the enrollment's MUTANT-KILLED rows of both classes", () => {
  const pilot = new Set(
    ENROLLMENT.filter((r) => PILOT_CLASSES.includes(r.category) && r.tier === "MUTANT-KILLED").map((r) => r.key),
  );
  const table = new Set(PER_ERROR.map((r) => r.key));
  assert.deepEqual([...pilot].sort(), [...table].sort());
});

test("the wrong-object pilot's machine facts: two provenance collapses, three P5 readout kills, ZERO survivors", () => {
  const census = new Map(runPerErrorCensus().map((r) => [r.key, r] as const));
  // the prototypes' own history errors collapse bit-exactly
  assert.equal(census.get("b21#0")!.computed, "COLLAPSES");
  assert.equal(census.get("b31#3")!.computed, "COLLAPSES");
  // three distinct readout-object constructions, all killed by P5
  for (const k of ["b24#2", "b15#3", "b14#2"]) {
    const row = census.get(k)!;
    assert.equal(row.computed, "ERROR-LEVEL", `${k}: ${row.detail}`);
    assert.ok(row.killers.includes("P5"), `${k} killed by ${row.killers.join(",")}`);
  }
  // and NOT twins: b24#2 and b14#2 differ bit-exactly (checked at construction time)
  assert.ok(!printsEqual(batteryPrint(perErrorFamily("b24#2")), batteryPrint(perErrorFamily("b14#2"))));
  // the class produced no equivalent survivor — every buildable re-enactment died
  const wo = runPerErrorCensus(PER_ERROR.filter((s) => ["b21#0", "b31#3", "b24#2", "b15#3", "b14#2"].includes(s.key)));
  assert.equal(wo.filter((r) => r.computed === "EQUIVALENT").length, 0);
});

test("the dimension-slot and statistics pilots' machine facts: five more provenance collapses, two kills, the degenerate-input survivor", () => {
  const census = new Map(runPerErrorCensus().map((r) => [r.key, r] as const));
  // five provenance collapses — ALL NINE prototypes now have their history error as a specimen
  const collapses: Array<[string, string]> = [["b24#0", "MU4"], ["b31#0", "MU6"], ["b31#4", "MU3"], ["b31#5", "MU8"], ["b19#3", "MU9"]];
  for (const [k, onto] of collapses) {
    const row = census.get(k)!;
    assert.equal(row.computed, "COLLAPSES", `${k}: ${row.detail}`);
    assert.equal(row.onto, onto);
  }
  // b24#0's collapse runs through the CRASH face (P5 at infinite worst) — the
  // battery's crash containment makes the print comparable bit-exactly
  // two distinct dimension kills: the tensor-as-product (P2) and the 1x1-scalar mMul scaling (P5 crash, NOT MU3's face)
  assert.equal(census.get("b13#2")!.computed, "ERROR-LEVEL");
  assert.ok(census.get("b13#2")!.killers.includes("P2"));
  const b311 = census.get("b31#1")!;
  assert.equal(b311.computed, "ERROR-LEVEL", `b31#1: ${b311.detail}`);
  assert.ok(b311.killers.includes("P5"), `b31#1 killed by ${b311.killers.join(",")}`);
  // the statistics survivor: the unguarded 0/0 ratio on the never-exercised degenerate branch
  const b52 = census.get("b5#2")!;
  assert.equal(b52.computed, "EQUIVALENT", `b5#2: ${b52.detail}`);
});
