/**
 * R19 (agent W, spec r18/agentF.md F7-b) — the mixed-strategy convexity
 * argument as a machine instance, closing README boundary 4 ("mixed
 * strategies are convex combinations and cannot exceed the deterministic
 * cap — standard argument, applied not re-proved"): now applied AND
 * executed. All arithmetic is exact BigInt rationals; the seeded mixing
 * trials are deterministic under the fixed seeds below. Nothing here
 * re-renders the frozen reports; W3's own float census is a cross-check.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { classicalCensus } from "../src/kernel/tariff.js";
import { RcError } from "../src/kernel/state.js";
import {
  VERTEX_COUNT,
  chshFromTables,
  classicalCapCensus,
  extremalityCensus,
  mixedCensus,
  prBoxSmuggle,
  vertexAt,
  vertexS,
  vertexTables,
  type Rat,
} from "../src/kernel/mixed.js";

function ratEq(a: Rat, b: Rat): boolean {
  return a.n * b.d === b.n * a.d;
}

test("M.A vertex completeness and the cap: 256 distinct deterministic strategies, max |S| exactly 2, cross-checked against W3's float census", () => {
  const c = classicalCapCensus();
  assert.equal(c.vertices, VERTEX_COUNT);
  assert.equal(
    VERTEX_COUNT,
    16 * 16,
    "the full function space (+/-1)^4 x (+/-1)^4",
  );
  // completeness as distinctness: all 256 response signatures differ
  const sigs = new Set<string>();
  for (let id = 0; id < VERTEX_COUNT; id++) {
    const v = vertexAt(id);
    assert.equal(v.id, id);
    sigs.add(`${v.rA.join("")}|${v.rB.join("")}`);
  }
  assert.equal(
    sigs.size,
    VERTEX_COUNT,
    "no two ids map to the same deterministic strategy",
  );
  // the cap, exact
  assert.ok(
    ratEq(c.maxAbsS, { n: 2n, d: 1n }),
    `census max |S| = ${c.maxAbsS.n}/${c.maxAbsS.d}, expected 2`,
  );
  // the attained value set is exactly {-2, 0, 2}
  assert.equal(c.distinctS.length, 3);
  assert.ok(ratEq(c.distinctS[0]!, { n: -2n, d: 1n }));
  assert.ok(ratEq(c.distinctS[1]!, { n: 0n, d: 1n }));
  assert.ok(ratEq(c.distinctS[2]!, { n: 2n, d: 1n }));
  // cross-check against W3's own census (float path, independent file)
  const w3 = classicalCensus();
  assert.equal(w3.strategies, VERTEX_COUNT);
  assert.ok(Math.abs(w3.maxAbsS - 2) < 1e-12);
  // and the table path agrees with the direct path on a spot vertex
  const spotId = 0x5 * 16 + 0x3;
  const spot = chshFromTables(vertexTables(spotId));
  const direct = vertexS(spotId);
  assert.ok(
    ratEq(spot, direct),
    "S from tables must equal S from the strategy bits",
  );
});

test("M.B extremality: all 32640 vertex pairs checked — midpoints are trivial, every vertex is extreme", () => {
  const e = extremalityCensus();
  assert.equal(e.pairsChecked, (VERTEX_COUNT * (VERTEX_COUNT - 1)) / 2);
  assert.equal(
    e.nontrivialMidpointsAtVertices,
    0,
    "no distinct vertex pair has a vertex midpoint",
  );
  // the hypercube structure: every vertex coordinate is +/-1 (never 0), so a
  // differing bit pins the midpoint coordinate to 0 — interior, not extreme
  for (let id = 0; id < VERTEX_COUNT; id++) {
    const v = vertexAt(id);
    for (const r of [v.rA, v.rB])
      for (const bit of r) assert.ok(bit === 1 || bit === -1);
  }
});

test("M.C seeded dyadic mixtures: S is exactly linear in the weights, the cap holds, and the sandwich is tight at the ends", () => {
  const rep = mixedCensus(20260920, 64, 8);
  assert.equal(rep.trials, 64);
  assert.ok(rep.weightsSumOk, "every trial's weights sum to exactly 2^depth");
  assert.ok(
    rep.allLinear,
    "S from the mixed table equals sum_j w_j S(v_j) exactly, every trial",
  );
  assert.ok(rep.allWithinCap, "|S_mix| <= 2 on every trial");
  assert.ok(
    rep.worstAbsS.n <= 2n * rep.worstAbsS.d,
    `worst |S| = ${rep.worstAbsS.n}/${rep.worstAbsS.d}`,
  );
  // a second seed, deeper dyadics — the certificate is not one lucky stream
  const rep2 = mixedCensus(42, 32, 12);
  assert.ok(rep2.allLinear && rep2.allWithinCap && rep2.weightsSumOk);
  // directed sandwiches: half-and-half of S=2 and S=-2 vertices lands at 0;
  // half-and-half of S=2 and S=0 lands at 1 — the convex hull's faces, exact
  const mid = (a: bigint, b: bigint): Rat => ({ n: a + b, d: 2n });
  assert.ok(ratEq(mid(2n, -2n), { n: 0n, d: 1n }));
  assert.ok(ratEq(mid(2n, 0n), { n: 1n, d: 1n }));
  // and the extreme points of the attainable S set are the vertex values
  const c = classicalCapCensus();
  assert.ok(ratEq(c.distinctS[0]!, { n: -2n, d: 1n }));
  assert.ok(ratEq(c.distinctS[c.distinctS.length - 1]!, { n: 2n, d: 1n }));
});

test("M.D the PR-box smuggling trial: a nonlocal vertex in the mixture breaks the cap — convicted by exact rationals", () => {
  // w = 1/2 against the |S| = 2 vertex: (1/2)*2 + (1/2)*4 = 3 > 2
  const half = prBoxSmuggle(1n, 2n);
  assert.ok(ratEq(half, { n: 3n, d: 1n }));
  assert.ok(half.n > 2n * half.d, "3 > 2 — the cap convicts");
  // a thin w = 1/8 still convicts: (7/8)*2 + (1/8)*4 = 9/4 > 2
  const thin = prBoxSmuggle(1n, 8n);
  assert.ok(ratEq(thin, { n: 9n, d: 4n }));
  assert.ok(thin.n > 2n * thin.d, "9/4 > 2 — even a thin smuggle convicts");
  // the control: w = 0 degenerates to the local cap exactly (the legal edge)
  assert.ok(ratEq(prBoxSmuggle(0n, 1n), { n: 2n, d: 1n }));
});

test("M.E named refusals: illegal arguments are rejected by code, not prose", () => {
  assert.throws(
    () => vertexAt(256),
    (e: unknown) => e instanceof RcError && e.code === "RC_MIX_ID_RANGE",
  );
  assert.throws(
    () => vertexAt(-1),
    (e: unknown) => e instanceof RcError && e.code === "RC_MIX_ID_RANGE",
  );
  assert.throws(
    () => mixedCensus(1, 0, 8),
    (e: unknown) => e instanceof RcError && e.code === "RC_MIX_TRIALS",
  );
  assert.throws(
    () => mixedCensus(1, 4, 0),
    (e: unknown) => e instanceof RcError && e.code === "RC_MIX_DEPTH",
  );
  assert.throws(
    () => prBoxSmuggle(2n, 2n),
    (e: unknown) => e instanceof RcError && e.code === "RC_MIX_WEIGHT",
  );
  assert.throws(
    () => chshFromTables(Array<Rat>(15).fill({ n: 0n, d: 1n })),
    (e: unknown) => e instanceof RcError && e.code === "RC_MIX_TABLES",
  );
});
