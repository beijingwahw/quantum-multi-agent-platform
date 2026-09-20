import test from "node:test";
import assert from "node:assert/strict";
import {
  recombineLedger,
  alignmentControl,
  phaseAverageFace,
} from "../src/kernel/recombine.js";
import { buildPhaseFamilies } from "../src/kernel/phasecensus.js";
import { Rng } from "../src/kernel/survivor.js";
import { CensusError } from "../src/kernel/errors.js";
import { TOL } from "../src/kernel/tol.js";

const n = 4;
const N = 2 ** n;
const families = buildPhaseFamilies(n);
const flat = families[0]!;
const byName = new Map(families.map((f) => [f.name, f]));

/** the weighted instance: seeded counts (0..5) over the full space, a
 *  5-address funded marked set — same seeds as the R20 machine trial */
function weightedInstance(): { counts: number[]; marked: number[] } {
  const counts: number[] = [];
  const rng = new Rng(777);
  for (let x = 0; x < N; x++) counts.push(Math.floor(rng.next() * 6));
  const marked: number[] = [];
  const rng2 = new Rng(778);
  const pool = [...Array(N).keys()];
  for (let k = 0; k < 5; k++)
    marked.push(
      pool.splice(Math.floor(rng2.next() * pool.length), 1)[0] as number,
    );
  return { counts, marked };
}

/** the equal-weight instance: the dispersed prior, where visibility is
 *  genuinely phase-limited (concentrated weights make V phase-insensitive) */
function equalWeightInstance(): { counts: number[]; marked: number[] } {
  const counts = new Array<number>(N).fill(0);
  const marked: number[] = [];
  const rng = new Rng(778);
  const pool = [...Array(N).keys()];
  for (let k = 0; k < 5; k++)
    marked.push(
      pool.splice(Math.floor(rng.next() * pool.length), 1)[0] as number,
    );
  for (const x of marked) counts[x] = 3;
  return { counts, marked };
}

test("S9.A the MZ recombination law: circuit / amplitude / closed-form agree on every family, weighted instance", () => {
  const { counts, marked } = weightedInstance();
  let worstPRec = 0;
  let worstVis = 0;
  let worstOverlap = 0;
  let worstBound = 0;
  let worstSlack = Number.POSITIVE_INFINITY;
  for (const fam of families) {
    const led = recombineLedger(n, counts, marked, flat.phi, fam.phi);
    worstPRec = Math.max(worstPRec, led.pRecDev);
    worstVis = Math.max(worstVis, led.visibilityDev);
    worstOverlap = Math.max(worstOverlap, led.overlapDev);
    worstBound = Math.max(worstBound, Math.abs(led.l1Bound - 1)); // sum_funded w = P on the survivor frame
    worstSlack = Math.min(worstSlack, led.boundSlack);
    assert.ok(led.pKeep > 0 && led.pKeep <= 1);
  }
  assert.ok(worstPRec < TOL, `worst three-path P_rec deviation ${worstPRec}`);
  assert.ok(worstVis < TOL, `worst two-path visibility deviation ${worstVis}`);
  assert.ok(worstOverlap < TOL, `worst overlap deviation ${worstOverlap}`);
  assert.ok(worstBound < TOL, `l1 bound evaluates to 1 up to ${worstBound}`);
  assert.ok(
    worstSlack > -TOL,
    `the l1 bound is never violated (worst slack ${worstSlack})`,
  );
  // flat against itself: full coherence, the trivial top of the ledger
  const selfLed = recombineLedger(n, counts, marked, flat.phi, flat.phi);
  assert.ok(Math.abs(selfLed.visibility - 1) < 1e-15);
  assert.ok(Math.abs(selfLed.pRecCircuit - 1) < 1e-15);
});

test("S9.A the equality case of the census survives recombination: constant phase difference buys P_rec = 1", () => {
  const { counts, marked } = weightedInstance();
  const b3 = byName.get("fourier-b3")!;
  const shifted = byName.get("ramp3+const")!;
  const led = recombineLedger(n, counts, marked, b3.phi, shifted.phi);
  assert.ok(Math.abs(led.visibility - 1) < 1e-15, `V = ${led.visibility}`);
  assert.ok(
    Math.abs(led.pRecCircuit - 1) < 1e-15,
    `P_rec = ${led.pRecCircuit}`,
  );
});

test("S9.B the alignment control spends the full l1 budget: diag(e^{i chi}), chi = -dphi, attains the bound", () => {
  const { counts, marked } = weightedInstance();
  // on a non-constant family (the interesting case: the bound starts slack)
  const rand = byName.get("random-s101")!;
  const before = recombineLedger(n, counts, marked, flat.phi, rand.phi);
  assert.ok(
    before.boundSlack > 0.01,
    `the bound starts slack here (slack ${before.boundSlack})`,
  );
  const aligned = alignmentControl(n, counts, marked, flat.phi, rand.phi);
  assert.ok(
    aligned.equalityDev <= 1e-15,
    `equality deviation ${aligned.equalityDev}`,
  );
  assert.ok(
    Math.abs(aligned.alignedPRec - before.l1Bound) <= 1e-15,
    "the control attains the l1 bound exactly",
  );
  // the same on the constant-difference pair (already at the bound: it stays)
  const b3 = byName.get("fourier-b3")!;
  const shifted = byName.get("ramp3+const")!;
  const stay = alignmentControl(n, counts, marked, b3.phi, shifted.phi);
  assert.ok(stay.equalityDev <= 1e-15);
});

test("S9.C the equal-weight census: exact rational visibility for sign-alt, data visibility for the rest", () => {
  const { counts, marked } = equalWeightInstance();
  const signAlt = recombineLedger(
    n,
    counts,
    marked,
    flat.phi,
    byName.get("sign-alt")!.phi,
  );
  // 3 even + 2 odd funded marks: |3 - 2|/5 = 1/5 — exact rational, hand-checked
  assert.ok(
    Math.abs(signAlt.visibility - 0.2) < 1e-15,
    `sign-alt V = ${signAlt.visibility}`,
  );
  const b3 = recombineLedger(
    n,
    counts,
    marked,
    flat.phi,
    byName.get("fourier-b3")!.phi,
  );
  assert.ok(b3.visibility < 0.5, `fourier-b3 V = ${b3.visibility}`);
  const rand101 = recombineLedger(
    n,
    counts,
    marked,
    flat.phi,
    byName.get("random-s101")!.phi,
  );
  assert.ok(
    rand101.visibility > 0.3 && rand101.visibility < 0.8,
    `random-s101 V = ${rand101.visibility} (a single realization, DATA)`,
  );
});

test('S9.D negative control, the spec\'s phase-average face: E[complex amplitude] = 0, E[V] at the random-walk scale — the literal "E[V] = 0" is convicted', () => {
  for (const t of [2, 6, 24]) {
    const face = phaseAverageFace(t, 20260920, 40000);
    assert.ok(
      face.meanAmplitudeSigma < 3,
      `t=${t}: |E[A]| is inside the 3-sigma band (got ${face.meanAmplitudeSigma} sigma)`,
    );
    assert.ok(
      face.scaleDev < 0.05,
      `t=${t}: E[V] rides the random-walk scale (dev ${(face.scaleDev * 100).toFixed(2)}%)`,
    );
    assert.ok(
      face.specLiteralConvicted,
      `t=${t}: E[V] = ${face.meanVisibility} is far from the asserted 0`,
    );
  }
});

test("S9.E negative control: high-visibility claims under random phases are convicted on the dispersed prior", () => {
  const { counts, marked } = equalWeightInstance();
  const r101 = byName.get("random-s101")!;
  const r103 = byName.get("random-s103")!;
  // two independent random encodings against each other: the visibility is
  // random-walk small — a claimed P_rec >= 0.999 dies against the machine number
  const led = recombineLedger(n, counts, marked, r101.phi, r103.phi);
  assert.ok(led.visibility < 0.3, `random-vs-random V = ${led.visibility}`);
  assert.ok(
    led.pRecCircuit < 0.7,
    `random-vs-random P_rec^max = ${led.pRecCircuit}`,
  );
  assert.ok(
    0.999 > led.pRecCircuit + 0.25,
    "the smuggled high-visibility claim is convicted by a wide margin",
  );
  // one random encoding against flat: still far from full coherence
  const vsFlat = recombineLedger(n, counts, marked, flat.phi, r103.phi);
  assert.ok(vsFlat.visibility < 0.7, `random-vs-flat V = ${vsFlat.visibility}`);
});

test("S9.F error face: the named refusals", () => {
  assert.throws(
    () => phaseAverageFace(0, 1, 100),
    (e) => e instanceof CensusError && e.code === "SC/BAD-MARKED",
  );
  assert.throws(
    () => phaseAverageFace(6, 1, 0),
    (e) => e instanceof CensusError && e.code === "SC/MC-BAD-INPUTS",
  );
  const { counts, marked } = weightedInstance();
  const badPhase = flat.phi.slice();
  badPhase[3] = Number.NaN;
  assert.throws(
    () => recombineLedger(n, counts, marked, flat.phi, badPhase),
    (e) => e instanceof CensusError && e.code === "SC/BAD-PHASES",
  );
});
