import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DOSSIERS, type Dossier, type DossierVerdict } from "../src/kernel/dossier.js";
import { checkDossiers, WORKSPACE_ROOT } from "../src/kernel/audit.js";
import { runWitnesses } from "../src/kernel/witnesses.js";
import { renderLines } from "../src/experiments/render.js";
import { Rng } from "../src/kernel/rng.js";
import { apply, c, cabs2, cmul, cconj, gramSchmidtUnitary, inner, normalize } from "../src/kernel/linalg.js";

test("R-all: both dossiers balance — every law holds", () => {
  const v = checkDossiers();
  assert.deepEqual(v, [], `violations: ${JSON.stringify(v)}`);
  assert.equal(DOSSIERS.length, 2);
  assert.deepEqual(
    DOSSIERS.map((d) => d.atlasRow).sort(),
    ["choice-primitive", "dtc-clock"],
  );
});

test("R6: the atlas actually carries both anchor rows", () => {
  const atlas = readFileSync(resolve(WORKSPACE_ROOT, "bqp-map", "src", "atlas", "entries.ts"), "utf8");
  for (const d of DOSSIERS) assert.ok(atlas.includes(`id: "${d.atlasRow}"`));
});

test("R5: all executable witnesses pass", () => {
  for (const w of runWitnesses()) assert.ok(w.pass, `${w.name}: ${w.detail}`);
});

test("census: every milestone is priced, falsified, and anchored; every dossier is fully furnished", () => {
  for (const d of DOSSIERS) {
    assert.ok(d.milestones.length >= 4, `${d.id}: too few milestones`);
    assert.ok(d.prices.length >= 3, `${d.id}: too few price lines`);
    assert.ok(d.criteria.length >= 4, `${d.id}: too few criteria`);
    for (const m of d.milestones) {
      assert.ok(m.price.trim().length > 0);
      assert.ok(m.falsifier.trim().length > 0);
      assert.ok(m.anchor.startsWith("cite:") || m.anchor.startsWith("local:"));
    }
    for (const p of d.prices) assert.ok(p.amount.trim().length > 0);
  }
});

test("smuggling: a milestone without a price is rejected by name (R1)", () => {
  const d2 = DOSSIERS[1] as Dossier;
  const smuggled: readonly Dossier[] = [
    {
      ...d2,
      milestones: [...d2.milestones, { id: "D2-M99", statement: "a free ride", anchor: "cite:NOE18", falsifier: "has one", price: "" }],
    },
  ];
  const v = checkDossiers(smuggled);
  assert.equal(v.length, 1);
  assert.equal(v[0]?.law, "R1");
  assert.ok(v[0].detail.includes("D2-M99"));
});

test("smuggling: a milestone without a falsifier is rejected by name (R3)", () => {
  const d1 = DOSSIERS[0] as Dossier;
  const smuggled: readonly Dossier[] = [
    {
      ...d1,
      milestones: [...d1.milestones, { id: "D1-M98", statement: "cannot fail (it can)", anchor: "cite:MI22", falsifier: "", price: "priced" }],
    },
  ];
  const v = checkDossiers(smuggled);
  assert.equal(v.length, 1);
  assert.equal(v[0]?.law, "R3");
  assert.ok(v[0].detail.includes("D1-M98"));
});

test("smuggling: a settled verdict is rejected by name (R2) — this repo cannot settle", () => {
  const d1 = DOSSIERS[0] as Dossier;
  const smuggled: readonly Dossier[] = [{ ...d1, verdict: "MECHANISM-SETTLED" as unknown as DossierVerdict }];
  const v = checkDossiers(smuggled);
  assert.equal(v.length, 1);
  assert.equal(v[0]?.law, "R2");
  assert.equal(v[0]?.dossierId, "D1");
});

test("smuggling: a citation that does not resolve is rejected by name (R4)", () => {
  const d2 = DOSSIERS[1] as Dossier;
  const smuggled: readonly Dossier[] = [{ ...d2, citations: [...d2.citations, "XX99"] }];
  const v = checkDossiers(smuggled);
  assert.equal(v.length, 1);
  assert.equal(v[0]?.law, "R4");
  assert.ok(v[0].detail.includes("XX99"));
});

test("the renderer refuses to print an illegal dossier", () => {
  const d1 = DOSSIERS[0] as Dossier;
  const smuggled: readonly Dossier[] = [
    { ...d1, milestones: [...d1.milestones, { id: "D1-M97", statement: "unpriced", anchor: "cite:MI22", falsifier: "f", price: "" }] },
  ];
  assert.throws(() => renderLines(smuggled), /DOSSIER REJECTED/);
});

test("stability is engineered, not default: exact for compiled targets, strictly broken for random programs", () => {
  const psi = normalize([c(1), c(0)]);
  // engineered: |0> is an eigenvector of both branch unitaries — the desired world is invariant
  const engMat0 = [
    [c(Math.cos(1.1), Math.sin(1.1)), c(0)],
    [c(0), c(Math.cos(-1.1), Math.sin(-1.1))],
  ];
  const engMat1 = [
    [c(Math.cos(0.7), Math.sin(0.7)), c(0)],
    [c(0), c(Math.cos(-0.7), Math.sin(-0.7))],
  ];
  for (const u of [engMat0, engMat1]) {
    const out = apply(u, psi);
    // u is a literal 2×2 matrix above, so apply yields a 2-vector; index 0 is in bounds
    assert.ok(Math.abs(cabs2(out[0]!) - 1) < 1e-15);
  }
  // random: seeded Gram-Schmidt unitaries never hand back the target exactly
  const rng = new Rng(99);
  let maxF = 0;
  for (let t = 0; t < 20; t++) {
    const u = gramSchmidtUnitary(() => rng.gaussian(), 2);
    const f = cabs2(inner([c(1), c(0)], apply(u, psi)));
    maxF = Math.max(maxF, f);
    assert.ok(f < 0.999);
  }
  assert.ok(maxF > 0); // the trials actually ran
});

test("the clone mark: the CNOT pair is rephasing-invariant, the clone rotates at twice the rate", () => {
  const base = Math.PI / 4;
  const pairAt = (phi: number) => cmul(c(Math.cos(base + phi) * Math.SQRT1_2, Math.sin(base + phi) * Math.SQRT1_2), cconj(c(Math.cos(base + phi) * Math.SQRT1_2, Math.sin(base + phi) * Math.SQRT1_2)));
  const cloneAt = (phi: number) => cmul(c(Math.cos(base + phi) * Math.SQRT1_2, Math.sin(base + phi) * Math.SQRT1_2), c(Math.cos(base + phi) * Math.SQRT1_2, Math.sin(base + phi) * Math.SQRT1_2));
  const pairBase = pairAt(0);
  const cloneBase = cloneAt(0);
  let bestGap = 0;
  for (const phi of [0, 0.3, 0.785, 1.2, 2.7]) {
    const pair = pairAt(phi);
    const clone = cloneAt(phi);
    // covariance: the pair term never moves
    assert.ok(Math.abs(pair.re - pairBase.re) < 1e-15 && Math.abs(pair.im - pairBase.im) < 1e-15);
    // rotation: the clone term moves at exactly twice the rephasing rate
    const expect = cmul(c(Math.cos(2 * phi), Math.sin(2 * phi)), cloneBase);
    assert.ok(Math.abs(clone.re - expect.re) < 1e-15 && Math.abs(clone.im - expect.im) < 1e-15);
    bestGap = Math.max(bestGap, Math.hypot(pair.re - clone.re, pair.im - clone.im));
  }
  assert.ok(bestGap > 0.99); // the curves separate fully somewhere on the grid
});

test("the uniform-branch toll identity: 1/P = B exact on the powers-of-two grid", () => {
  for (const B of [2, 4, 8, 16]) {
    const P = 1 / B;
    assert.equal(1 / P, B);
    assert.equal(B / 1, B); // the epoch-3 invoice line: N/t at t = 1
  }
});

test("workspace wiring: every local anchor exists on disk", () => {
  for (const d of DOSSIERS) {
    for (const anchor of d.criteria.map((c) => c.anchor).concat(d.milestones.map((m) => m.anchor))) {
      if (anchor.startsWith("local:")) {
        const repo = anchor.slice("local:".length).split(/\s+/)[0] as string;
        assert.ok(existsSync(resolve(WORKSPACE_ROOT, repo)), `missing local anchor: ${repo}`);
      }
    }
  }
});
