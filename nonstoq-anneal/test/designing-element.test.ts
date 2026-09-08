import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  decideElementDesignable,
  scanMaxOffDiagonal,
  listViolations,
  verifyElementCertificate,
  verifyNoGoCertificate,
  isVacuousCertificate,
  normalizeTerms,
  uniformPairDichotomy,
  dichotomyGridCheck,
  denseRotatedMatrix,
  denseMaxPositiveOffdiag,
  denseGroundStateSignRatio,
} from "../src/anneal/designing-element.js";
import type { ElementTerms, LocalRotation, PairNoGo } from "../src/anneal/designing-element.js";
import { Rng } from "../src/core/rng.js";

const identity = (n: number): LocalRotation => ({
  psi: new Array<number>(n).fill(0),
  d: new Array<number>(n).fill(1),
});

/** 两比特均匀横场族成员：−Γ(X_u+X_v) + p·(Z_u+Z_v) + κ·X_uX_v + w·Z_uZ_v（Γ=1）。 */
function uniformPair(kappa: number, w: number, p: [number, number]): ElementTerms {
  return {
    n: 2,
    xFields: [
      { i: 0, c: -1 },
      { i: 1, c: -1 },
    ],
    zFields: [
      { i: 0, c: p[0] },
      { i: 1, c: p[1] },
    ],
    pairs: [{ i: 0, j: 1, kappa, zz: w }],
  };
}

test("element decider: exact formulas vs dense Kronecker referee (randomized, multi-edges)", () => {
  // 2026-09-08 修复回归：同一无序点对的多条 pair 记录共享同一个邻位 z 符号，
  // 逐边 |t| 求和会高估 max 元素——随机化对照曾在 n=2 双重边上量出 1e0 失配。
  const rng = new Rng(99);
  let worst = 0;
  for (let trial = 0; trial < 300; trial++) {
    const n = 2 + (trial % 3);
    const pairs: Array<{ i: number; j: number; kappa: number; zz: number }> = [];
    for (let e = 0; e < n; e++) {
      pairs.push({ i: e, j: (e + 1) % n, kappa: rng.range(-1, 1), zz: rng.range(-1, 1) });
    }
    const terms: ElementTerms = {
      n,
      xFields: Array.from({ length: n }, (_, i) => ({ i, c: rng.range(-1, 1) })),
      zFields: Array.from({ length: n }, (_, i) => ({ i, c: rng.range(-1, 1) })),
      pairs,
    };
    const rot: LocalRotation = {
      psi: Array.from({ length: n }, () => rng.next() * 2 * Math.PI),
      d: Array.from({ length: n }, () => (rng.next() < 0.5 ? 1 : -1)),
    };
    const fm = Math.max(scanMaxOffDiagonal(terms, rot).max, 0);
    const dm = denseMaxPositiveOffdiag(denseRotatedMatrix(terms, rot));
    worst = Math.max(worst, Math.abs(fm - dm));
  }
  assert.ok(worst < 1e-9, `formula-vs-dense worst |diff| = ${worst}`);
});

test("element decider: multi-edge z-sign sharing is exact (targeted)", () => {
  // 同一边两条记录、贡献反号：真元素 = 基项 + |t1+t2|，不是 |t1|+|t2|
  const terms: ElementTerms = {
    n: 2,
    xFields: [],
    zFields: [{ i: 0, c: 0.2 }],
    pairs: [
      { i: 0, j: 1, kappa: 0.9, zz: 0 },
      { i: 1, j: 0, kappa: -0.7, zz: 0 },
    ],
  };
  const rot: LocalRotation = { psi: [0.3, 1.1], d: [1, -1] };
  const fm = scanMaxOffDiagonal(terms, rot).max;
  const dm = denseMaxPositiveOffdiag(denseRotatedMatrix(terms, rot));
  assert.ok(Math.abs(Math.max(fm, 0) - dm) < 1e-12, `formula ${fm} vs dense ${dm}`);
  const norm = normalizeTerms(terms);
  assert.equal(norm.pairs.length, 1, "duplicate edge merges to one");
  assert.ok(Math.abs(norm.pairs[0]!.kappa - 0.2) < 1e-12, "kappa sums");
  const withSelfLoop = normalizeTerms({
    n: 2,
    xFields: [],
    zFields: [],
    pairs: [
      { i: 0, j: 1, kappa: 0.5, zz: 0.1 },
      { i: 1, j: 1, kappa: 0.9, zz: 0.9 },
    ],
  });
  assert.equal(withSelfLoop.pairs.length, 1, "self-loop (diagonal-only) dropped");
});

test("element decider: 2-qubit dichotomy YES side (kappa <= Gamma) with explicit certificate", () => {
  for (const kappa of [0.25, 0.5, 1.0]) {
    const terms = uniformPair(kappa, 0, [0, 0]);
    const d = uniformPairDichotomy(1, kappa);
    assert.ok(d.nonVacuousDesignable, `kappa=${kappa}`);
    assert.ok(d.certificate !== null);
    const v = verifyElementCertificate(terms, d.certificate);
    assert.ok(v.accepted, `certificate rejected for kappa=${kappa}`);
    assert.ok(!v.vacuous, "dichotomy certificate keeps a live single-flip channel");
  }
  const dec = decideElementDesignable(uniformPair(0.5, 0, [0, 0]), { pairGrid: 240 });
  assert.equal(dec.verdict, "YES");
  if (dec.certificate) {
    assert.ok(verifyElementCertificate(uniformPair(0.5, 0, [0, 0]), dec.certificate).accepted);
  }
});

test("element decider: 2-qubit dichotomy NO side (kappa > Gamma) — only vacuous escapes", () => {
  for (const kappa of [1.05, 2.0, 4.0]) {
    const d = uniformPairDichotomy(1, kappa);
    assert.ok(!d.nonVacuousDesignable, `kappa=${kappa}`);
    assert.equal(d.certificate, null);
  }
  const gc = dichotomyGridCheck(1, 2, 120);
  assert.ok(gc.holds, `every feasible grid point is vacuous (worst |a| escape ${gc.worstEscape})`);
  // 通用判定器如定理预期：可行点全部 vacuous（驱动器被断开的逃逸仍在）
  const dec = decideElementDesignable(uniformPair(2, 0, [0, 0]), { pairGrid: 240 });
  assert.equal(dec.verdict, "YES");
  assert.ok(dec.vacuous, "the only feasible de-signings disconnect the driver");
});

test("element decider: any single edge is curable once w != 0 (reflection-gauge X basis)", () => {
  for (const [kappa, w] of [
    [5, 0.3],
    [5, 2.0],
    [0.5, -1.5],
  ] as const) {
    const terms = uniformPair(kappa, w, [0, 0]);
    const rot: LocalRotation = {
      psi: [Math.PI / 2, Math.PI / 2],
      d: [1, w > 0 ? -1 : 1],
    };
    const v = verifyElementCertificate(terms, rot);
    assert.ok(v.accepted, `kappa=${kappa}, w=${w}`);
    assert.ok(!v.vacuous, "the -|w| XX channel stays live");
  }
  // Perron-Frobenius 穿过判定器：严格负证书 ⟹ 旋转基基态 P = 1
  const terms = uniformPair(0.25, 1, [0, 0]);
  const dec = decideElementDesignable(terms, { pairGrid: 240 });
  assert.equal(dec.verdict, "YES");
  assert.ok(dec.certificate !== null);
  assert.ok(dec.bestMax < 0, "strictly interior certificate");
  const H = denseRotatedMatrix(terms, dec.certificate);
  assert.ok(denseGroundStateSignRatio(H) > 1 - 1e-9, "P(rotated) = 1 exactly");
});

test("element decider: certified NO with Lipschitz margin and independent re-derivation", () => {
  const terms = uniformPair(1, 2, [0.5, 0.7]);
  const dec = decideElementDesignable(terms, { pairGrid: 360 });
  assert.equal(dec.verdict, "NO");
  assert.ok(dec.noGo !== null && dec.noGo.margin > 0);
  const verdict = verifyNoGoCertificate(terms, dec.noGo);
  assert.ok(verdict.accepted, verdict.reason);
});

test("smuggling trial #1: counterfeit de-signing certificate is NAMED and rejected", () => {
  // 走私品 A：恒等旋转冒充 de-signing 证书（κ>0 的 XX 双翻转元素原样暴露）
  const triangle: ElementTerms = {
    n: 3,
    xFields: [0, 1, 2].map((i) => ({ i, c: -1 })),
    zFields: [],
    pairs: [
      { i: 0, j: 1, kappa: 0.5, zz: 0 },
      { i: 1, j: 2, kappa: 0.5, zz: 0 },
      { i: 2, j: 0, kappa: 0.5, zz: 0 },
    ],
  };
  const fakeA = verifyElementCertificate(triangle, identity(3));
  assert.ok(!fakeA.accepted, "identity rotation smuggled as a de-signing certificate");
  const namesA = fakeA.violations.map((v) => v.name).join("; ");
  for (const edge of ["(0,1)", "(1,2)", "(0,2)"]) {
    assert.ok(namesA.includes(`double-flip element ${edge}`), `violations must name ${edge}: ${namesA}`);
  }
  for (const v of fakeA.violations) {
    if (v.kind === "double-flip") assert.ok(Math.abs(v.value - 0.5) < 1e-12, `value = κ = 0.5, got ${v.value}`);
  }
  // 走私品 B：从"另一个哈密顿量"偷来的 vacuous 角度——原实例 Z 场为 +0.5 时
  // π/2/d=+1 是真证书；贴到 Z 场为 −0.5 的实例上，−d·p·b = +0.5 > 0，
  // 逐站点名拒绝（同一份角度，跨实例即为赝品）
  const pinned: ElementTerms = {
    n: 3,
    xFields: [0, 1, 2].map((i) => ({ i, c: -1 })),
    zFields: [0, 1, 2].map((i) => ({ i, c: -0.5 })),
    pairs: [{ i: 0, j: 1, kappa: 0.5, zz: 0 }],
  };
  const stolen: LocalRotation = {
    psi: [Math.PI / 2, Math.PI / 2, Math.PI / 2],
    d: [1, 1, 1],
  };
  const fakeB = verifyElementCertificate(pinned, stolen);
  assert.ok(!fakeB.accepted, "stolen vacuous angles smuggled onto a pinned Hamiltonian");
  const rowsNamed = fakeB.violations.filter((v) => v.name.startsWith("single-flip row site"));
  assert.ok(rowsNamed.length >= 1, `violations must name the single-flip rows: ${JSON.stringify(fakeB.violations)}`);
  // 该证书连 vacuous 都冒充不成
  assert.ok(!isVacuousCertificate(pinned, stolen));
});

test("smuggling trial #2: counterfeit stoquastic Hamiltonian (sign-of-kappa shortcut) is NAMED", () => {
  // 走私话术："所有 κ 净值 ≤ 0，且 X 场都是负的，所以 stoquastic"。
  // 真元素检查：多重边逐条记账——两条 +0.2 的 κ 记录净额 −0.3+0.2+0.2 = +0.1 > 0；
  // 站点 2 的 +0.8 X 场是活的正单翻转行。
  const smuggled: ElementTerms = {
    n: 3,
    xFields: [
      { i: 0, c: -0.6 },
      { i: 1, c: -0.4 },
      { i: 2, c: 0.8 }, // 藏在"负场"清单里的正场
    ],
    zFields: [],
    pairs: [
      { i: 0, j: 1, kappa: -0.3, zz: 0 },
      { i: 1, j: 0, kappa: 0.2, zz: 0 }, // 与上条同一无序边：真元素 = −0.1
      { i: 1, j: 2, kappa: -0.5, zz: 0 },
      { i: 0, j: 2, kappa: 0.2, zz: 0 },
      { i: 2, j: 0, kappa: 0.2, zz: 0 }, // 同一无序边第二条：真元素 = +0.4
    ],
  };
  const viol = listViolations(smuggled, identity(3));
  const names = viol.map((v) => v.name).join("; ");
  assert.ok(names.includes("double-flip element (0,2)"), `must name the net-positive edge: ${names}`);
  assert.ok(names.includes("single-flip row site 2"), `must name the hidden positive field: ${names}`);
  const d02 = viol.find((v) => v.kind === "double-flip" && v.edge![0] === 0 && v.edge![1] === 2);
  assert.ok(d02 && Math.abs(d02.value - 0.4) < 1e-12, `net double-flip element = +0.4, got ${d02?.value}`);
  const row2 = viol.find((v) => v.kind === "single-flip" && v.site === 2);
  assert.ok(row2 && Math.abs(row2.value - 0.8) < 1e-12, `row value = +0.8, got ${row2?.value}`);
  assert.ok(!verifyElementCertificate(smuggled, identity(3)).accepted);
});

test("smuggling trial #3: counterfeit no-go certificate fails independent re-derivation", () => {
  // 真证书：在认证 NO 实例上重推通过；赝品：同一份 no-go 对象贴到可去实例上
  const designable = uniformPair(0.5, 0.3, [0, 0]);
  const counterfeit: PairNoGo = {
    edge: [0, 1],
    gridMin: 0.05,
    slack: 0.01,
    margin: 0.04,
    resolution: 360,
  };
  const verdict = verifyNoGoCertificate(designable, counterfeit);
  assert.ok(!verdict.accepted, "fabricated no-go on a designable instance must be rejected");
  assert.ok(verdict.reason.includes("counterfeit"), `reason must NAME the counterfeit: ${verdict.reason}`);
  // 指向不存在边的 no-go 也必须被点名
  const ghost = verifyNoGoCertificate(designable, { ...counterfeit, edge: [0, 5] });
  assert.ok(!ghost.accepted && ghost.reason.includes("does not exist"), ghost.reason);
});

test("element decider: honest UNRESOLVED keeps the verdict gap explicit", () => {
  // 奇环（反射规范受挫）：判决允许 UNRESOLVED——不硬编具体判决值，
  // 但结构必须自洽：YES 必带已验证证书、NO 必带正边际且重推通过、UNRESOLVED 无证书。
  const terms: ElementTerms = {
    n: 3,
    xFields: [0, 1, 2].map((i) => ({ i, c: -1 })),
    zFields: [],
    pairs: [0, 1, 2].map((i) => ({ i, j: (i + 1) % 3, kappa: 0.5, zz: 1 })),
  };
  const dec = decideElementDesignable(terms, { starts: 32, pairGrid: 240 });
  assert.ok(dec.verdict === "YES" || dec.verdict === "NO" || dec.verdict === "UNRESOLVED");
  if (dec.verdict === "YES") {
    assert.ok(dec.certificate !== null);
    assert.ok(verifyElementCertificate(terms, dec.certificate).accepted);
  } else {
    assert.equal(dec.certificate, null, "non-YES verdicts carry no rotation");
  }
  if (dec.verdict === "NO") {
    assert.ok(dec.noGo !== null && dec.noGo.margin > 0);
    assert.ok(verifyNoGoCertificate(terms, dec.noGo).accepted);
  }
  assert.ok(!dec.vacuous);
});
