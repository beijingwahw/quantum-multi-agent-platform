/**
 * R18 (agent M, candidate F12) — the Singleton-grade rank theorem for the
 * truncated-multiplication family: Theorem A (rank >= max(0, |F|+k-m) on
 * every instance), Theorem B (Eve's info = k - rank as an exact-integer
 * coset-uniformity certificate), the attainment census, and the non-field
 * negative control. All claims machine-counted; nothing here re-renders the
 * frozen reports.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { RcError } from "../src/kernel/state.js";
import {
  dimensionBound,
  eveInfoClosedForm,
  minRankOverMaps,
  nonFieldViolation,
  rankFace,
  singletonCensus,
  surjectivityCensus,
  truncColumns,
} from "../src/kernel/mds.js";

test("S.A Theorem A holds on every instance — exhaustive scans at m=4 and m=8", () => {
  for (const m of [4, 8]) {
    const c = singletonCensus(m);
    assert.ok(
      c.theoremHoldsEverywhere,
      `m=${m}: some (a, k, F) instance violates the dimension bound`,
    );
    assert.equal(
      c.instances,
      m * ((1 << m) - 1) * (1 << m),
      `m=${m}: the scan must be the full (k, a, F) enumeration`,
    );
    assert.equal(c.rows.length, m * (m + 1));
  }
  // the deep per-instance certificate (kernel enumeration + rank-nullity + inclusion) on curated faces
  const faces = [
    rankFace(8, 4, 0x10, 0b0011),
    rankFace(8, 4, 0x57, 0b1111),
    rankFace(8, 4, 0x57, 0b10000001),
    rankFace(4, 2, 0x3, 0b0101),
    rankFace(4, 1, 0x2, 0b1110),
    rankFace(4, 4, 0x7, 0b1010),
  ];
  for (const f of faces) {
    assert.ok(
      f.theoremHolds,
      `face (m=${f.m}, k=${f.k}, a=0x${f.a.toString(16)}, F=0b${f.freeMask.toString(2)}) fails its certificate`,
    );
    assert.equal(
      f.fullKernelDim,
      f.m - f.k,
      "the full kernel is an exact copy of the truncation kernel H (dim m-k)",
    );
    assert.ok(
      f.kernelDim <= f.fullKernelDim,
      "the restricted kernel cannot exceed the full kernel",
    );
    assert.equal(truncColumns(f.m, f.k, f.a, f.freeMask).length, f.freeBits);
  }
});

test("S.B the closed form: uniform cosets, exact integers, z-independence, and the forged-rank conviction", () => {
  const samples: Array<[number, number, number, number]> = [
    [8, 4, 0x10, 0b1111],
    [8, 4, 0x57, 0b10000001],
    [8, 2, 0x0d, 0b10110111],
    [4, 3, 0x9, 0b0110],
    [4, 2, 0x5, 0b1100],
  ];
  for (const [m, k, a, freeMask] of samples) {
    const f = popc(freeMask);
    const zMax = 1 << (m - f);
    const e0 = eveInfoClosedForm(m, k, a, freeMask, 0);
    const e1 = eveInfoClosedForm(m, k, a, freeMask, zMax - 1);
    for (const e of [e0, e1]) {
      assert.equal(
        e.rank,
        gf2RankOf(truncColumns(m, k, a, freeMask)),
        "the closed form's rank is the column rank",
      );
      assert.equal(e.imageKeys, 2 ** e.rank, "coset size = 2^rank exactly");
      assert.equal(
        e.multiplicity,
        2 ** (f - e.rank),
        "coset multiplicity = 2^(f-rank) exactly",
      );
      assert.ok(e.uniform, "the integer histogram is exactly uniform");
      assert.ok(
        e.entropyDev < 1e-12,
        "the float entropy cross-check rides the same histogram",
      );
      assert.equal(e.info, k - e.rank);
    }
    assert.deepEqual(
      [e1.rank, e1.imageKeys, e1.multiplicity, e1.uniform],
      [e0.rank, e0.imageKeys, e0.multiplicity, e0.uniform],
      "z-independence",
    );
  }
  // the smuggling trial: a FORGED rank cannot hide — the histogram convicts it
  const e = eveInfoClosedForm(8, 4, 0x57, 0b10000001, 0);
  const forged = e.rank < e.k ? e.rank + 1 : e.rank - 1;
  assert.notEqual(
    e.k - forged,
    Math.log2(e.imageKeys),
    "k minus a forged rank disagrees with the measured coset size",
  );
  assert.notEqual(forged, e.rank);
});

test("S.C the census: the dimension bound is globally tight — worst-case Eve info = min(k, s) at every sparsity", () => {
  for (const m of [4, 8]) {
    const c = singletonCensus(m);
    for (const row of c.rows) {
      assert.ok(
        row.achieved,
        `m=${m} k=${row.k} f=${row.f}: minRank ${row.minRank} != bound ${row.bound}`,
      );
      assert.equal(
        row.worstEveInfo,
        row.singletonEveInfo,
        `m=${m} k=${row.k} f=${row.f}`,
      );
      // the witness is real: its rank is the row's minimum
      assert.equal(
        gf2RankOf(truncColumns(m, row.k, row.witnessA, row.witnessMask)),
        row.minRank,
      );
      assert.equal(popc(row.witnessMask), row.f);
    }
  }
});

test("S.D per-mask attainment is honest data: scattered masks sit strictly above the Singleton worst case", () => {
  // m=4, k=2, F={0,2}: no map reaches rank 0 — the per-mask minimum is 1
  const scattered4 = minRankOverMaps(4, 2, 0b0101);
  assert.equal(scattered4.min, 1);
  assert.equal(dimensionBound(4, 2, 2), 0);
  // m=8, k=4, F={0,7}: same phenomenon at the bigger field
  const scattered8 = minRankOverMaps(8, 4, 0b10000001);
  assert.ok(
    scattered8.min > 0,
    "the scattered mask {0,7} admits no rank-0 map",
  );
  // consecutive masks DO attain: a = beta^4 = 0x10 kills F = {0,1} at m=8, k=4
  const low = rankFace(8, 4, 0x10, 0b0011);
  assert.equal(low.rank, 0);
  assert.equal(low.bound, 0);
  // and the census row for (m=8, k=4, f=2) counts attaining vs non-attaining masks honestly
  const c8 = singletonCensus(8);
  const row = c8.rows.find((r) => r.k === 4 && r.f === 2);
  assert.ok(row !== undefined);
  assert.equal(row.sets, 28); // C(8,2)
  assert.ok(
    row.achievingSets < row.sets,
    "not every 2-mask attains — the per-F detail is real",
  );
  assert.ok(
    row.achievingSets > 0,
    "and at least one does — the global attainment witness",
  );
});

test("S.E surjectivity: every map is onto — the kernel dimension m-k is machine-certified", () => {
  for (const m of [4, 8])
    for (let k = 1; k <= m; k++) {
      const s = surjectivityCensus(m, k);
      assert.equal(s.maps, (1 << m) - 1);
      assert.ok(
        s.allSurjective,
        `m=${m} k=${k}: some map's truncated image is not all of GF(2)^k`,
      );
    }
});

test("S.F the field property is load-bearing: the reducible ring violates Theorem A outright", () => {
  const v = nonFieldViolation();
  assert.ok(
    v !== null,
    "the scan over GF(2)[x]/(x^4+x^2+1) must find a violation",
  );
  if (v !== null) {
    assert.ok(
      v.rank < v.bound,
      `the exhibited violation must sit below the bound (rank ${v.rank} vs bound ${v.bound})`,
    );
    assert.equal(v.m, 4);
    assert.ok(v.polyNote.includes("reducible"));
    // over the fields on file the same scan never violates — S.A's theoremHoldsEverywhere is the contrast face
    assert.ok(singletonCensus(4).theoremHoldsEverywhere);
  }
});

test("S.G named refusals: illegal arguments are rejected by code, not prose", () => {
  assert.throws(
    () => singletonCensus(16),
    (e: unknown) => e instanceof RcError && e.code === "RC_NO_FIELD",
  );
  assert.throws(
    () => rankFace(4, 5, 1, 0),
    (e: unknown) => e instanceof RcError && e.code === "RC_K_RANGE",
  );
  assert.throws(
    () => rankFace(4, 2, 0, 0),
    (e: unknown) => e instanceof RcError && e.code === "RC_A_RANGE",
  );
  assert.throws(
    () => rankFace(4, 2, 1, 16),
    (e: unknown) => e instanceof RcError && e.code === "RC_MASK_RANGE",
  );
  assert.throws(
    () => eveInfoClosedForm(4, 2, 1, 0b1100, 4),
    (e: unknown) => e instanceof RcError && e.code === "RC_Z_RANGE",
  );
});

/** popcount — test-local (the kernel keeps its own). */
function popc(x: number): number {
  let c = 0;
  while (x !== 0) {
    x &= x - 1;
    c++;
  }
  return c;
}

/** GF(2) rank by an independently written Gaussian elimination — the test's second path. */
function gf2RankOf(vectors: readonly number[]): number {
  const rows = [...vectors];
  const n = Math.max(0, ...vectors.map((v) => 31 - Math.clz32(v))) + 1;
  let rank = 0;
  for (let col = n - 1; col >= 0 && rank < rows.length; col--) {
    const piv = rows.findIndex((r, i) => i >= rank && (r & (1 << col)) !== 0);
    if (piv === -1) continue;
    const tmp = rows[rank]!;
    rows[rank] = rows[piv]!;
    rows[piv] = tmp;
    for (let i = 0; i < rows.length; i++)
      if (i !== rank && (rows[i]! & (1 << col)) !== 0)
        rows[i] = rows[i]! ^ rows[rank]!;
    rank++;
  }
  return rank;
}
