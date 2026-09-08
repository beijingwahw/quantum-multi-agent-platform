import { strict as assert } from "node:assert";
import { test } from "node:test";
import { Rng } from "../src/core/rng.js";
import { maxcut3Reg } from "../src/core/ising.js";
import { NonstoqError } from "../src/core/errors.js";
import type { NonstoqErrorCode } from "../src/core/errors.js";
import { jacobiEigenvalues, jacobiEigenWithVectors } from "../src/core/jacobi.js";
import { zeroSpectrum } from "../src/core/spectra.js";
import { magnetization, xBasisEnergies } from "../src/anneal/driver.js";
import { pspinEnergies } from "../src/anneal/catalyst.js";
import { antiferroRing } from "../src/anneal/instances.js";
import { applyHamiltonian } from "../src/anneal/lanczos.js";
import { projectGroundState } from "../src/anneal/project.js";
import {
  uniformPairDichotomy,
  denseRotatedMatrix,
  decideElementDesignable,
} from "../src/anneal/designing-element.js";
import type { ElementDecision, ElementTerms } from "../src/anneal/designing-element.js";
import { parityFind } from "../src/anneal/designing.js";
import { sseDiagElement } from "../src/sse/sse.js";
import type { SseConfig } from "../src/sse/sse.js";

// ---------------------------------------------------------------------------
// 走私审判 #4-#8：非法输入按具名错误码被驳回（0.3.0 错误面）
// ---------------------------------------------------------------------------

/** 走私审判的机器落点：断言 err 是 NonstoqError 且 code 精确等于预期。 */
function assertCode(fn: () => unknown, code: NonstoqErrorCode): void {
  let caught: unknown = null;
  assert.throws(fn, (e: unknown) => {
    caught = e;
    return e instanceof NonstoqError;
  });
  assert.ok(caught instanceof NonstoqError, "must be a NonstoqError");
  assert.equal(caught.code, code);
  assert.ok(caught instanceof Error, "NonstoqError IS an Error (catch 兼容)");
  assert.ok(caught.message.length > 0, "message carries the offending value");
}

test("smuggling trial #4: non-integer / too-small p is rejected by exact code", () => {
  assertCode(() => pspinEnergies(4, 1.5), "PSpinDomain");
  assertCode(() => pspinEnergies(4, 1), "PSpinDomain");
  assertCode(() => pspinEnergies(4, 0), "PSpinDomain");
  // 合法域仍工作（负对照：同入口不误伤合法输入）
  const E = pspinEnergies(4, 2);
  assert.equal(E[0], 4); // 全 +1 态磁化 4，C = N·1^2 = 4
});

test("smuggling trial #5: AF ring domain violations are named", () => {
  assertCode(() => antiferroRing(2), "AfRingDomain");
  assertCode(() => antiferroRing(3.5), "AfRingDomain");
  const ok = antiferroRing(3);
  assert.equal(ok.couplings.length, 3);
});

test("smuggling trial #6: 3-regular MaxCut domain violations are named", () => {
  assertCode(() => maxcut3Reg(new Rng(1), 3), "Maxcut3RegDomain");
  assertCode(() => maxcut3Reg(new Rng(1), 5), "Maxcut3RegDomain");
  const ok = maxcut3Reg(new Rng(1), 6);
  assert.equal(ok.couplings.length, 9); // 环 6 + 匹配 3 = 3-正则
});

test("smuggling trial #7: dichotomy domain (gamma,kappa > 0) is enforced by code", () => {
  assertCode(() => uniformPairDichotomy(0, 1), "DichotomyDomain");
  assertCode(() => uniformPairDichotomy(1, -0.5), "DichotomyDomain");
  const ok = uniformPairDichotomy(1, 0.5);
  assert.ok(ok.nonVacuousDesignable);
});

test("smuggling trial #8: dense referee cap is a named error, not a silent wrong answer", () => {
  const big: ElementTerms = {
    n: 11,
    xFields: [{ i: 0, c: -1 }],
    zFields: [],
    pairs: [],
  };
  assertCode(
    () => denseRotatedMatrix(big, { psi: new Array<number>(11).fill(0), d: new Array<number>(11).fill(1) }),
    "DenseRefereeCap",
  );
});

// ---------------------------------------------------------------------------
// 品牌谱表：编译期负对照（@ts-expect-error 是断言本体——品牌一旦失效，
// "未使用的期望错误" 本身就是编译失败；闭包永不执行，零运行时效应）
// ---------------------------------------------------------------------------

test("brands: Z/X 谱表互换与裸表走私都是编译错误（dimension-slot 族的类型装甲）", () => {
  const zeros = zeroSpectrum(2); // 基无关：Z/X 两槽皆可（正对照，编译即验证）
  const xE = xBasisEnergies(2, { gamma: 1, couplings: [] });
  const zE = pspinEnergies(2, 2); // 纯 Z 谱表
  const v = new Float64Array(4);
  const out = new Float64Array(4);
  const swaps: Array<() => unknown> = [
    () => {
      // @ts-expect-error X 基表不得流入 Z 基槽位（projectGroundState 的 energies）
      projectGroundState(2, xE, zeros, 0);
    },
    () => {
      // @ts-expect-error Z 基表不得流入 X 基槽位（applyHamiltonian 的 xEnergies）
      applyHamiltonian(2, zE, zE, 0, v, out);
    },
    () => {
      // @ts-expect-error 裸 Float64Array 不得流入品牌槽位
      applyHamiltonian(2, new Float64Array(4), xE, 0, v, out);
    },
  ];
  for (const s of swaps) assert.equal(typeof s, "function");
  assert.equal(zeros.length, 4);
});

// ---------------------------------------------------------------------------
// 判决可辨识联合：不变量 + 穷尽 switch
// ---------------------------------------------------------------------------

/** 穷尽 switch：新增 verdict 而不更新此函数 = 编译失败（never 检查）。 */
function exhaustiveVerdictLabel(d: ElementDecision): string {
  switch (d.verdict) {
    case "YES":
      return `yes:${d.certificate.psi.length}`;
    case "NO":
      return `no:${d.noGo.margin > 0 ? "certified" : "broken"}`;
    case "UNRESOLVED":
      return "unresolved";
    default: {
      const impossible: never = d;
      return String(impossible);
    }
  }
}

test("decision union: YES carries a certificate and no no-go; NO carries a no-go and no certificate", () => {
  const yesTerms: ElementTerms = {
    n: 2,
    xFields: [
      { i: 0, c: -1 },
      { i: 1, c: -1 },
    ],
    zFields: [],
    pairs: [{ i: 0, j: 1, kappa: 0.5, zz: 0 }],
  };
  const yes = decideElementDesignable(yesTerms, { pairGrid: 240 });
  assert.equal(yes.verdict, "YES");
  assert.ok(yes.certificate !== null, "YES variant always carries a rotation");
  assert.equal(yes.noGo, null);
  assert.match(exhaustiveVerdictLabel(yes), /^yes:2$/);

  const noTerms: ElementTerms = {
    n: 2,
    xFields: [
      { i: 0, c: -1 },
      { i: 1, c: -1 },
    ],
    zFields: [
      { i: 0, c: 0.5 },
      { i: 1, c: 0.7 },
    ],
    pairs: [{ i: 0, j: 1, kappa: 1, zz: 2 }],
  };
  const no = decideElementDesignable(noTerms, { pairGrid: 360 });
  assert.equal(no.verdict, "NO");
  assert.ok(no.noGo !== null && no.noGo.margin > 0, "NO variant always carries a positive-margin no-go");
  assert.equal(no.certificate, null);
  assert.equal(no.vacuous, false);
  assert.match(exhaustiveVerdictLabel(no), /^no:certified$/);
});

// ---------------------------------------------------------------------------
// 单源化 Jacobi：值路径与向量路径出自同一核心（回归锚）
// ---------------------------------------------------------------------------

test("single-source jacobi: values path is exactly the sorted vectors path (bit-identical)", () => {
  const rng = new Rng(97);
  for (let trial = 0; trial < 20; trial++) {
    const k = 2 + (trial % 5);
    const A: number[][] = Array.from({ length: k }, () => new Array<number>(k).fill(0));
    for (let p = 0; p < k; p++) {
      for (let q = p; q < k; q++) {
        const v = rng.range(-2, 2);
        A[p]![q] = v;
        A[q]![p] = v;
      }
    }
    const values = jacobiEigenvalues(A);
    const { eigenvalues } = jacobiEigenWithVectors(A);
    const sorted = [...eigenvalues].sort((x, y) => x - y);
    assert.deepStrictEqual(values, sorted, `trial ${trial}: two paths of the SAME core must agree bit-for-bit`);
  }
});

test("single-source jacobi: eigenvectors are orthonormal and diagonalize A (3x3 analytic anchor)", () => {
  const A = [
    [2, 1, 0],
    [1, 2, 1],
    [0, 1, 2],
  ];
  const { eigenvalues, eigenvectors } = jacobiEigenWithVectors(A);
  // 正交性：VᵀV = I
  for (let p = 0; p < 3; p++) {
    for (let q = 0; q < 3; q++) {
      let dot = 0;
      for (let i = 0; i < 3; i++) dot += eigenvectors[p]![i]! * eigenvectors[q]![i]!;
      assert.ok(Math.abs(dot - (p === q ? 1 : 0)) < 1e-12, `⟨v${p},v${q}⟩ = ${dot}`);
    }
  }
  // 本征方程：A·v = λ·v，λ = {2, 2±√2}
  const expected = [2 - Math.SQRT2, 2, 2 + Math.SQRT2].sort((x, y) => x - y);
  const sorted = [...eigenvalues].sort((x, y) => x - y);
  for (let j = 0; j < 3; j++) {
    assert.ok(Math.abs(sorted[j]! - expected[j]!) < 1e-12, `λ${j} = ${sorted[j]}`);
    const v = eigenvectors[j]!;
    for (let i = 0; i < 3; i++) {
      let av = 0;
      for (let k2 = 0; k2 < 3; k2++) av += A[i]![k2]! * v[k2]!;
      assert.ok(Math.abs(av - eigenvalues[j]! * v[i]!) < 1e-12, `row ${i} of A·v${j}`);
    }
  }
});

// ---------------------------------------------------------------------------
// 单源化 sseDiagElement：裁判与采样器共用的矩阵元约定（手算精确锚）
// ---------------------------------------------------------------------------

test("single-source sseDiagElement: hand-computed exact convention (shifted-nonneg)", () => {
  const cfg: SseConfig = {
    n: 2,
    s: 0.5,
    beta: 1,
    fields: [0.7, -0.3],
    edges: [{ i: 0, j: 1, w: -0.4, kappaMag: 0.9 }],
    gamma: 1,
  };
  const z = Int8Array.from([1, -1]);
  // 站点键 0（h=0.7）：s·(h·z0+|h|) = 0.5·(0.7+0.7) = 0.7
  assert.ok(Math.abs(sseDiagElement(cfg, 0, z) - 0.7) < 1e-15);
  // 站点键 1（h=−0.3，z1=−1）：0.5·(−0.3·−1+0.3) = 0.3
  assert.ok(Math.abs(sseDiagElement(cfg, 1, z) - 0.3) < 1e-15);
  // 边键 2（w=−0.4，z0·z1=−1）：0.5·(−0.4·−1+0.4) = 0.4
  assert.ok(Math.abs(sseDiagElement(cfg, 2, z) - 0.4) < 1e-15);
  // 反构型 z=(−1,+1)：站点 0 → 0.5·(−0.7+0.7) = 0（平移非负的零点）
  const z2 = Int8Array.from([-1, 1]);
  assert.ok(Math.abs(sseDiagElement(cfg, 0, z2) - 0) < 1e-15);
  assert.ok(sseDiagElement(cfg, 0, z2) >= 0 && sseDiagElement(cfg, 2, z2) >= 0);
});

// ---------------------------------------------------------------------------
// 单源化 magnetization 与 parityFind：约定钉死
// ---------------------------------------------------------------------------

test("single-source magnetization: bit convention (0 -> +1) exact values", () => {
  assert.equal(magnetization(0, 3), 3); // |000> → +3
  assert.equal(magnetization(0b001, 3), 1); // 仅位 0 置 1 → −1+1+1
  assert.equal(magnetization(0b011, 3), -1); // 位 0、1 置 1 → −1−1+1
  assert.equal(magnetization(0b111, 3), -3); // 全置 1 → −3
  assert.equal(magnetization(1, 1), -1);
  assert.equal(magnetization(2, 2), 0);
});

test("single-source parityFind: roots, parities, and compression idempotence", () => {
  // 链 0−1−2，约束 par：p1·p0 = −1（0-1 反号），p2·p1 = +1（1-2 同号）
  const parent = Array.from({ length: 3 }, (_, i) => i);
  const parity = new Array<number>(3).fill(1);
  const union = (a: number, b: number, req: number): void => {
    const ra = parityFind(parent, parity, a);
    const rb = parityFind(parent, parity, b);
    parent[rb.root] = ra.root;
    parity[rb.root] = req * rb.par * ra.par;
  };
  union(0, 1, -1);
  union(1, 2, 1);
  const r0 = parityFind(parent, parity, 0);
  const r1 = parityFind(parent, parity, 1);
  const r2 = parityFind(parent, parity, 2);
  assert.equal(r0.root, r1.root);
  assert.equal(r1.root, r2.root);
  assert.equal(r0.par * r1.par, -1, "0-1 opposite");
  assert.equal(r1.par * r2.par, 1, "1-2 same");
  // 压缩幂等：再查一次，根与奇偶不变
  const again = parityFind(parent, parity, 0);
  assert.deepStrictEqual(again, r0);
  assert.equal(parent[1], r0.root, "path compressed to the root");
});

// ---------------------------------------------------------------------------
// zeroSpectrum：基无关零表（品牌交叉点）
// ---------------------------------------------------------------------------

test("zeroSpectrum: all-zero table of length 2^n, valid in the Z slot of the engine", () => {
  const z = zeroSpectrum(4);
  assert.equal(z.length, 16);
  for (const v of z) assert.equal(v, 0);
  // 正对照：零问题表 + 纯驱动器（s=0）→ 基态能量 = min(E_x) = −Γ·n = −2
  const xE = xBasisEnergies(2, { gamma: 1, couplings: [] });
  const proj = projectGroundState(2, zeroSpectrum(2), xE, 0);
  assert.ok(proj.converged);
  assert.ok(Math.abs(proj.energy - -2) < 1e-9, `E0 = ${proj.energy}`);
});
