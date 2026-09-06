import { strict as assert } from "node:assert";
import { test } from "node:test";
import { classifyDiagonalGaugeDesignable, applyGauge } from "../src/anneal/designing.js";

/** 稠密非对角元符号检查（n ≤ 6 裁判）：全部 ≤ 0 ⟺ stoquastic。 */
function maxOffDiagonal(
  terms: {
    xFields: ReadonlyArray<{ i: number; c: number }>;
    xxPairs: ReadonlyArray<{ i: number; j: number; k: number }>;
    zxPairs: ReadonlyArray<{ i: number; j: number; z: number }>;
  },
  n: number,
): number {
  const dim = 1 << n;
  const H = Array.from({ length: dim }, () => new Array<number>(dim).fill(0));
  for (const f of terms.xFields) for (let z = 0; z < dim; z++) H[z]![z ^ (1 << f.i)]! += f.c;
  for (const p of terms.xxPairs)
    for (let z = 0; z < dim; z++) H[z]![z ^ (1 << p.i) ^ (1 << p.j)]! += p.k;
  for (const p of terms.zxPairs)
    for (let z = 0; z < dim; z++)
      H[z]![z ^ (1 << p.j)]! += p.z * (((z >>> p.i) & 1) === 0 ? 1 : -1);
  let maxOff = 0;
  for (let a = 0; a < dim; a++)
    for (let b = 0; b < dim; b++) if (a !== b && H[a]![b]! > maxOff) maxOff = H[a]![b]!;
  return maxOff;
}

test("de-signing: XX on a triangle (odd cycle) is gauge-irreducible — the theorem-level barrier", () => {
  const terms = {
    xFields: [0, 1, 2].map((i) => ({ i, c: -1 })),
    xxPairs: [
      { i: 0, j: 1, k: 0.5 },
      { i: 1, j: 2, k: 0.5 },
      { i: 2, j: 0, k: 0.5 },
    ],
    zxPairs: [],
  };
  const r = classifyDiagonalGaugeDesignable(terms, 3);
  assert.ok(!r.designable);
  assert.ok(r.frustratedCycle !== null && r.frustratedCycle.length >= 2);
  assert.equal(r.certificate, null);
});

test("de-signing: XX-only chain (no X fields) is designable; certificate verified on dense matrix", () => {
  const terms = {
    xFields: [],
    xxPairs: [
      { i: 0, j: 1, k: 0.5 },
      { i: 1, j: 2, k: 0.5 },
      { i: 2, j: 3, k: 0.5 },
    ],
    zxPairs: [],
  };
  assert.ok(maxOffDiagonal(terms, 4) > 0, "原始非 stoquastic");
  const r = classifyDiagonalGaugeDesignable(terms, 4);
  assert.ok(r.designable, r.detail);
  const gauged = applyGauge(terms, r.certificate!);
  assert.ok(maxOffDiagonal(gauged, 4) <= 1e-12, `规范后 max off-diag = ${maxOffDiagonal(gauged, 4)}`);
});

test("de-signing (sharp theorem): uniform transverse field + even one positive XX edge is irreducible", () => {
  // X 场把整支 ε 钉死为 +1，κ>0 的 XX 边无处翻号——exp1 家族即此类
  const terms = {
    xFields: [0, 1, 2, 3].map((i) => ({ i, c: -1 })),
    xxPairs: [{ i: 0, j: 1, k: 0.5 }],
    zxPairs: [],
  };
  const r = classifyDiagonalGaugeDesignable(terms, 4);
  assert.ok(!r.designable);
});

test("de-signing: mixed XX/ZX constraints combine; even cycle with product-of-signs +1 designable", () => {
  // 4-环：两条 κ>0 XX + 两条 ζ>0 ZX，约束积 = (−1)⁴ = +1 → 可解
  const terms = {
    xFields: [],
    xxPairs: [
      { i: 0, j: 1, k: 0.5 },
      { i: 2, j: 3, k: 0.5 },
    ],
    zxPairs: [
      { i: 1, j: 2, z: 0.3 },
      { i: 3, j: 0, z: 0.3 },
    ],
  };
  const r = classifyDiagonalGaugeDesignable(terms, 4);
  // 逐项可去；ZX 元素符号随行交替（结构性质），元素级求和判定留作开放问题——见 docs
  assert.ok(r.designable, r.detail);
});

test("de-signing: odd AF ring with kappa on all bonds is irreducible (exp1 family class)", () => {
  const n = 5;
  const terms = {
    xFields: [],
    xxPairs: Array.from({ length: n }, (_, i) => ({ i, j: (i + 1) % n, k: 0.5 })),
    zxPairs: [],
  };
  const r = classifyDiagonalGaugeDesignable(terms, n);
  assert.ok(!r.designable);
  assert.ok(r.frustratedCycle !== null);
});

test("de-signing: positive bare X field alone is designable (epsilon flips it)", () => {
  const terms = { xFields: [{ i: 0, c: 0.7 }], xxPairs: [], zxPairs: [] };
  const r = classifyDiagonalGaugeDesignable(terms, 1);
  assert.ok(r.designable);
  const gauged = applyGauge(terms, r.certificate!);
  assert.ok(maxOffDiagonal(gauged, 1) <= 1e-12);
});
