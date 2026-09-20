import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GYNI_CAP,
  GYNI_PARTIES,
  GYNI_VERTICES,
  auditSharedRandomClaim,
  auditVertexClaim,
  batteryGridMaxDeviation,
  behaviorValue,
  decomposedValue,
  gyniCensus,
  gyniCensusSummary,
  gyniScore,
  mixtureBehavior,
  pairwiseBatteryValue,
  verifyGyniCensus,
  verifySharedRandom,
  vertexBehavior,
  vertexValue,
  wernerSixQubitState,
} from '../src/process/gyni.js';

// ---------------------------------------------------------------------------
// GY-a — the 64-vertex census is a FLAT top at exactly C₃ = 1/2.
// ---------------------------------------------------------------------------

test('gyni: census has 64 vertices and every one sits at exactly C₃ = 1/2', () => {
  const census = gyniCensus();
  assert.equal(census.length, 64);
  for (const p of census) {
    assert.ok(Math.abs(p.psucc - GYNI_CAP) <= 1e-15, `${p.label} deviates: ${p.psucc}`);
  }
});

test('gyni: census summary — cap = min = 1/2, achievers = 64/64 (the full vertex set)', () => {
  const s = gyniCensusSummary();
  assert.equal(s.familySize, 64);
  assert.equal(s.achieverCount, 64);
  assert.ok(Math.abs(s.cap - 0.5) < 1e-15);
  assert.ok(Math.abs(s.min - 0.5) < 1e-15);
  assert.equal(GYNI_VERTICES, 64);
  assert.equal(GYNI_PARTIES, 3);
});

test('gyni: per-party reason the top is flat — own input cannot predict the neighbor bit', () => {
  // For every unary function f and independent uniform bit z: P[f(x) = z] = 1/2.
  // Machine form: average the score contribution of party 0 over all 8 inputs
  // and all 4 functions — exactly 4 per input tuple (half of 8 party-points).
  for (let f = 0; f < 4; f++) {
    let wins = 0;
    for (let x = 0; x < 8; x++) {
      const x0 = (x >> 2) & 1;
      const x1 = (x >> 1) & 1;
      if (((f >> x0) & 1) === x1) wins++;
    }
    assert.equal(wins, 4, `function ${f} should win on exactly half the inputs`);
  }
});

test('gyni: gyniScore counts the ring neighbors (b_i vs x_{i+1}), not own input', () => {
  // x = (0,1,1), b = (1,1,0): party 0 guesses x_1 = 1 (win), party 1 guesses
  // x_2 = 1 (win), party 2 guesses x_0 = 0 (win) — score 3/3.
  assert.equal(gyniScore([1, 1, 0], [0, 1, 1]), 3);
  // b = own input instead: (0,1,1) — party 0 says 0 but needs x_1 = 1
  // (loss), party 1 says 1 = x_2 (win), party 2 says 1 but needs x_0 = 0
  // (loss) — score 1/3. (First draft of this test hand-counted 2/3 — the
  // ring has TWO losses when one party's copy misses; wrong-object, booked.)
  assert.equal(gyniScore([0, 1, 1], [0, 1, 1]), 1);
});

// ---------------------------------------------------------------------------
// GY-b — maximizer characterization: the achiever condition is vacuous.
// ---------------------------------------------------------------------------

test('gyni: every unary-function triple attains the cap (achiever set = full vertex set)', () => {
  // The four per-party functions are {const0, const1, id, not} (truth tables
  // 0..3); ALL 64 triples are maximizers, and the per-party value is exactly
  // the cap for each function — which is why no constraint survives.
  const census = gyniCensus();
  const byVertex = new Map(census.map((p) => [p.fs[0]! + p.fs[1]! * 4 + p.fs[2]! * 16, p.psucc]));
  assert.equal(byVertex.size, 64);
  for (const v of byVertex.values()) assert.ok(Math.abs(v - GYNI_CAP) < 1e-15);
});

test('gyni: vertexValue matches the induced-behavior value for sampled vertices', () => {
  for (const fs of [[0, 0, 0], [1, 2, 3], [3, 3, 3], [2, 1, 0]]) {
    const direct = vertexValue(fs);
    const viaBehavior = behaviorValue(vertexBehavior(fs));
    assert.ok(Math.abs(direct - viaBehavior) < 1e-15, `f=[${fs.join(',')}]`);
  }
});

// ---------------------------------------------------------------------------
// GY-c — shared randomness: the linearity argument, both computations.
// ---------------------------------------------------------------------------

test('gyni: shared-random mixtures sit EXACTLY at C₃ (decomposition = behavior recompute)', () => {
  const weightsCases: number[][] = [
    new Array(64).fill(1 / 64), // uniform mixture
    (() => {
      const w = new Array(64).fill(0);
      w[0] = 1; // a pure vertex
      return w;
    })(),
    (() => {
      const w = new Array(64).fill(0);
      w[21] = 0.3;
      w[42] = 0.7;
      return w;
    })(),
    (() => {
      const w: number[] = [];
      for (let v = 0; v < 64; v++) w.push(((v * 37) % 64) / 64 + 0.1);
      const tot = w.reduce((a, b) => a + b, 0);
      return w.map((x) => x / tot);
    })(),
  ];
  for (const w of weightsCases) {
    const v = verifySharedRandom(w);
    assert.ok(Math.abs(v.weightSum - 1) < 1e-12);
    assert.ok(v.linearityGap < 1e-14, `linearity gap ${v.linearityGap}`);
    assert.ok(v.capGap < 1e-14, `cap gap ${v.capGap}`);
    assert.ok(Math.abs(v.direct - GYNI_CAP) < 1e-14);
  }
});

test('gyni: pure linearity — doubling the weights doubles the value (no normalization hiding)', () => {
  const w = new Array(64).fill(1 / 64);
  const v1 = verifySharedRandom(w);
  const v2 = verifySharedRandom(w.map((x) => 2 * x));
  assert.ok(Math.abs(v2.weightSum - 2) < 1e-12);
  assert.ok(Math.abs(v2.direct - 2 * v1.direct) < 1e-14);
  assert.ok(Math.abs(decomposedValue(w.map((x) => 2 * x)) - 2 * decomposedValue(w)) < 1e-14);
});

test('gyni: mixture behavior is the weight-sum of vertex behaviors (probabilities intact)', () => {
  const w = new Array(64).fill(1 / 64);
  const mix = mixtureBehavior(w);
  let tot = 0;
  for (let x = 0; x < 8; x++) {
    let rowTot = 0;
    for (let b = 0; b < 8; b++) {
      const p = mix[x * 8 + b]!;
      assert.ok(p >= -1e-15 && p <= 1 + 1e-15);
      rowTot += p;
    }
    assert.ok(Math.abs(rowTot - 1) < 1e-14, `input ${x} behavior not normalized: ${rowTot}`);
    tot += rowTot;
  }
  assert.ok(Math.abs(tot - 8) < 1e-13);
});

// ---------------------------------------------------------------------------
// GY-c′ — sampled quantum battery: exact Born probabilities, flat at C₃.
// ---------------------------------------------------------------------------

test('gyni: pairwise Bell battery (w = 1) is flat at C₃ over the angle grid', () => {
  const dev = batteryGridMaxDeviation(1);
  assert.ok(dev < 1e-12, `Bell battery deviation ${dev.toExponential(2)}`);
});

test('gyni: Werner-diluted batteries stay on the cap (w = 0.5, 0.8)', () => {
  for (const w of [0.5, 0.8]) {
    const dev = batteryGridMaxDeviation(w);
    assert.ok(dev < 1e-12, `Werner w=${w} deviation ${dev.toExponential(2)}`);
  }
});

test('gyni: a single fixed battery point recomputes to exactly 1/2 (z/x bases)', () => {
  const rho6 = wernerSixQubitState(1);
  const angles = [
    [0, Math.PI / 2],
    [0, Math.PI / 2],
    [0, Math.PI / 2],
  ];
  const v = pairwiseBatteryValue(rho6, angles);
  assert.ok(Math.abs(v - 0.5) < 1e-14, `battery value ${v}`);
});

// ---------------------------------------------------------------------------
// GY-d — the audit face: forgeries are recomputed and NAMED.
// ---------------------------------------------------------------------------

test('gyni: the true census record verifies', () => {
  const verdict = verifyGyniCensus(gyniCensusSummary());
  assert.ok(verdict.ok, verdict.reason);
  assert.match(verdict.reason, /64 vertices, flat cap 0\.500000, 64\/64/);
});

test('gyni: forged census records are named and rejected (cap, size, min, achievers)', () => {
  const truth = gyniCensusSummary();
  const inflated = verifyGyniCensus({ ...truth, cap: 0.75 });
  assert.ok(!inflated.ok);
  assert.match(inflated.reason, /GYNI-COUNTERFEIT: claimed cap 0\.750000/);

  const truncated = verifyGyniCensus({ ...truth, familySize: 32 });
  assert.ok(!truncated.ok);
  assert.match(truncated.reason, /claimed 32 deterministic vertices, machine census has 64/);

  const tilted = verifyGyniCensus({ ...truth, min: 0.25 });
  assert.ok(!tilted.ok);
  assert.match(tilted.reason, /claimed min 0\.250000/);

  const underCounted = verifyGyniCensus({ ...truth, achieverCount: 63 });
  assert.ok(!underCounted.ok);
  assert.match(underCounted.reason, /claimed 63 maximizers, machine count 64/);
});

test('gyni: a forged deterministic value (5/8 > C₃) dies at recomputation by name', () => {
  const ok = auditVertexClaim([0, 1, 2], vertexValue([0, 1, 2]));
  assert.ok(ok.ok, ok.reason);
  const forged = auditVertexClaim([0, 1, 2], 5 / 8);
  assert.ok(!forged.ok);
  assert.match(forged.reason, /GYNI-COUNTERFEIT: vertex f=\[0,1,2\] claimed 0\.625000, machine recomputes 0\.500000/);
});

test('gyni: a vertex claim that exceeds the cap is rejected even if self-consistent', () => {
  // Hypothetical engine bug returning 0.5001 consistently: the cap face fires.
  const forged = auditVertexClaim([3, 3, 3], 0.5000001);
  assert.ok(!forged.ok);
  assert.match(forged.reason, /GYNI-COUNTERFEIT/);
});

test('gyni: a forged shared-random claim (5/8) dies at the double recomputation', () => {
  const w = new Array(64).fill(1 / 64);
  const honest = auditSharedRandomClaim(w, verifySharedRandom(w).direct);
  assert.ok(honest.ok, honest.reason);
  const forged = auditSharedRandomClaim(w, 5 / 8);
  assert.ok(!forged.ok);
  assert.match(forged.reason, /machine recomputes 0\.500000 — shared randomness cannot leave the flat top/);
});

test('gyni: audit rejects malformed inputs by name (arity, weight length, non-strategy)', () => {
  const wrongVertex = auditVertexClaim([0, 1], 0.5);
  assert.ok(!wrongVertex.ok);
  assert.match(wrongVertex.reason, /vertex needs 3 truth tables, got 2/);

  const wrongLen = auditSharedRandomClaim(new Array(63).fill(1 / 63), 0.5);
  assert.ok(!wrongLen.ok);
  assert.match(wrongLen.reason, /mixture needs 64 weights, got 63/);

  const overWeight = auditSharedRandomClaim(new Array(64).fill(0.02), 0.5);
  assert.ok(!overWeight.ok);
  assert.match(overWeight.reason, /weights sum to 1\.280000000 > 1 — not a strategy/);

  assert.throws(() => behaviorValue(new Float64Array(63)), /expected 64 entries/);
  assert.throws(() => decomposedValue(new Array(8).fill(1)), /expected 64 weights/);
});

test('gyni: boundary — a non-strategy mixture shows raw linearity (Σw·C₃) and is rejected as a strategy', () => {
  // Doubling one weight AFTER the fact: the two computation channels still
  // agree (both recompute from the same weights), the value is Σw·C₃ = 0.75
  // — linearity visible, not a cap break — and the audit face convicts it as
  // a non-strategy (weights > 1), so the doctoring cannot pass as a win.
  const w = new Array(64).fill(1 / 64);
  const v = verifySharedRandom(w);
  const doctored = [...w];
  doctored[9] = doctored[9]! + 0.5;
  const vDoc = verifySharedRandom(doctored);
  assert.ok(v.linearityGap < 1e-14); // honest weights: the two channels agree
  assert.ok(vDoc.linearityGap < 1e-14); // still consistent (both recomputed)
  assert.ok(Math.abs(vDoc.direct - 1.5 * GYNI_CAP) < 1e-14); // Σw = 1.5 → value 0.75
  assert.ok(vDoc.weightSum > 1); // and the audit face above rejects it as a non-strategy
});
