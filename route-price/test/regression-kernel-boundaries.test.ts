import test from "node:test";
import assert from "node:assert/strict";
import { DOSSIERS, type Dossier } from "../src/kernel/dossier.js";
import { checkDossiers, type DossierInput } from "../src/kernel/audit.js";
import { c, conditionalData, outer } from "../src/kernel/linalg.js";
import { q, qDiv } from "../src/kernel/exact.js";

/** a kernel refusal is only usable if it is NAMED: the throw must carry the
 *  expected stable code, and the message must embed it (the workspace's
 *  [CODE] convention) */
function expectNamed(fn: () => unknown, errorName: string, code: string): void {
  assert.throws(
    fn,
    (e: unknown): boolean =>
      e instanceof Error &&
      e.name === errorName &&
      (e as { code?: unknown }).code === code &&
      e.message.includes(`[${code}]`),
    `expected a named ${errorName} with code ${code}`,
  );
}

test("regression: a null control outcome has no conditional state — refused by name, not NaN (COND_NULL_OUTCOME)", () => {
  // the hole: conditionalData normalized the (g,g) block by its trace without
  // checking it — a control outcome of probability zero divided by 0 and
  // handed back NaN cells, and NaN > 1e-15 is FALSE, so the leakage checks
  // downstream would have read a NaN state as "no leakage" (a pass)
  const definiteOne = outer([c(0), c(0), c(1), c(0)]); // control definitely 1
  expectNamed(() => conditionalData(definiteOne, 2, 0), "LinAlgError", "COND_NULL_OUTCOME");
  // a NaN trace off a corrupt rho is the same null face (NaN > 0 is false)
  const corrupt = outer([c(Number.NaN), c(0), c(0), c(0)]);
  expectNamed(() => conditionalData(corrupt, 2, 0), "LinAlgError", "COND_NULL_OUTCOME");
  expectNamed(() => conditionalData(corrupt, 2, 1), "LinAlgError", "COND_NULL_OUTCOME");
  // legal neighbors: the definite and the half-probability conditionals keep
  // their exact cells (binary fractions, bitwise)
  const cond1 = conditionalData(definiteOne, 2, 1);
  assert.equal(cond1[0]![0]!.re, 1);
  assert.equal(cond1[0]![0]!.im, 0);
  assert.equal(cond1[0]![1]!.re, 0);
  assert.equal(cond1[1]![1]!.re, 0);
  // a half-and-half control split with distinguishable data cells: the (1,1)
  // block is [[1, 0], [0, 0]] with trace 1 — normalized to itself, bitwise
  const halfSplit = outer([c(Math.SQRT1_2), c(0), c(1), c(0)]);
  const condHalf = conditionalData(halfSplit, 2, 1);
  assert.equal(condHalf[0]![0]!.re, 1);
  assert.equal(condHalf[0]![1]!.re, 0);
  assert.equal(condHalf[1]![0]!.re, 0);
  assert.equal(condHalf[1]![1]!.re, 0);
  assert.equal(condHalf[0]![0]!.im, 0);
  // and a genuinely mixed block normalizes by its trace exactly (0.25/0.5)
  const uniform = outer([c(0.5), c(0.5), c(0.5), c(0.5)]); // every cell 0.25
  const condMixed = conditionalData(uniform, 2, 1);
  assert.equal(condMixed[0]![0]!.re, 0.5);
  assert.equal(condMixed[0]![1]!.re, 0.5);
  assert.equal(condMixed[1]![1]!.re, 0.5);
});

test("regression: a zero denominator is not a rational — the exact layer refuses it by name (Q_ZERO_DENOMINATOR)", () => {
  // the hole: q(1n, 0n) constructed {n: 1n, d: 0n} silently, and qDiv by it
  // came back as the exact-looking 0/1 — a wrong VALUE wearing exactness,
  // the worst kind of wrong for a layer whose only law is exactness
  expectNamed(() => q(1n, 0n), "ExactError", "Q_ZERO_DENOMINATOR");
  expectNamed(() => q(0n, 0n), "ExactError", "Q_ZERO_DENOMINATOR");
  expectNamed(() => qDiv(q(1n), q(0n)), "ExactError", "Q_ZERO_DENOMINATOR"); // division by the value zero
  expectNamed(() => qDiv(q(1n), q(1n, 0n)), "ExactError", "Q_ZERO_DENOMINATOR"); // the smuggled denominator itself
  // legal neighbors: sign normalization and gcd reduction are unchanged
  assert.deepEqual(q(6n, 4n), { n: 3n, d: 2n });
  assert.deepEqual(q(-6n, -4n), { n: 3n, d: 2n });
  assert.deepEqual(q(1n, -2n), { n: -1n, d: 2n });
  assert.deepEqual(qDiv(q(1n), q(2n)), { n: 1n, d: 2n });
  assert.deepEqual(q(5n), { n: 5n, d: 1n });
});

test("regression: an empty local anchor certifies nothing — R4 names it (the cite: branch already did)", () => {
  // the hole: "cite:" with no id was already refused by name, but "local:"
  // with no repo resolved to the WORKSPACE ROOT — which exists by
  // construction — so the same degeneracy sailed through R4 as a legal anchor
  const d1 = DOSSIERS[0] as Dossier;
  const withEmpty: readonly DossierInput[] = [
    { ...d1, milestones: [...d1.milestones, { id: "D1-M94", statement: "anchored to nothing", anchor: "local:", falsifier: "has one", price: "priced" }] },
  ];
  const v = checkDossiers(withEmpty);
  assert.equal(v.length, 1);
  assert.equal(v[0]?.law, "R4");
  assert.ok(v[0]?.detail.includes("local anchor names no repo"));
  // the sibling degeneracy stays named (unchanged behavior, the pairing proof)
  const withEmptyCite: readonly DossierInput[] = [
    { ...d1, milestones: [...d1.milestones, { id: "D1-M93", statement: "cites nothing", anchor: "cite:", falsifier: "has one", price: "priced" }] },
  ];
  const vc = checkDossiers(withEmptyCite);
  assert.equal(vc.length, 1);
  assert.equal(vc[0]?.law, "R4");
  // legal neighbor: the same smuggled milestone with a real local repo passes clean
  const withReal: readonly DossierInput[] = [
    { ...d1, milestones: [...d1.milestones, { id: "D1-M94", statement: "anchored to nothing", anchor: "local:dtc-clock", falsifier: "has one", price: "priced" }] },
  ];
  assert.deepEqual(checkDossiers(withReal), []);
});
