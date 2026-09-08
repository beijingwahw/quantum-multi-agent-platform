/**
 * 实验 6 —— 元素级 de-signing 可判定性（README 0.1.x 开放问题的决策层）。
 *
 * 决策问题：给定 +κ XX 驱动器族（含 ZZ 对角部分与 Z 场），是否存在单比特
 * 实正交基变换 U = ⊗U_i 使 U†HU 的全部非对角元 ≤ 0？三层输出：
 *  A. 两比特均匀横场族的相图（κ × w × p）——解析二分法（κ ≤ Γ，非平凡）
 *    与认证 NO（Lipschitz 边际）双面机器复核；
 *  B. 图族判例（链/奇环/随机 3 度图）：元素判决 + 对角规范判决对照 +
 *    计算基 P vs 旋转基 P（YES 证书 ⟹ 旋转基 P = 1，Perron-Frobenius
 *    定理穿过判定器被引擎再验证）；
 *  C. 规模（n=64 链，公式路径，无稠密裁判）。
 */
import {
  decideElementDesignable,
  uniformPairDichotomy,
  dichotomyGridCheck,
  denseRotatedMatrix,
  denseGroundStateSignRatio,
  verifyElementCertificate,
} from "../anneal/designing-element.js";
import type { ElementTerms, ElementDecision } from "../anneal/designing-element.js";
import { classifyDiagonalGaugeDesignable } from "../anneal/designing.js";
import { randomIsing } from "../core/ising.js";
import { Rng } from "../core/rng.js";
import { fmt, writeReport } from "./common.js";
import { pathToFileURL } from "node:url";

const GAMMA = 1;
const SEED = 20260908;

/** 计算基（恒等旋转）稠密哈密顿量——P 的原始定义基。 */
function identityRot(n: number): { psi: number[]; d: number[] } {
  return { psi: new Array<number>(n).fill(0), d: new Array<number>(n).fill(1) };
}

function diagonalGaugeVerdict(terms: ElementTerms): boolean {
  const r = classifyDiagonalGaugeDesignable(
    {
      xFields: terms.xFields.map((f) => ({ i: f.i, c: f.c })),
      xxPairs: terms.pairs.map((p) => ({ i: p.i, j: p.j, k: p.kappa })),
      zxPairs: [],
    },
    terms.n,
  );
  return r.designable;
}

/** 两比特均匀横场族成员：−Γ(X_u+X_v) + p·(Z_u+Z_v) + κ·X_uX_v + w·Z_uZ_v。 */
function uniformPair(kappa: number, w: number, p: [number, number]): ElementTerms {
  return {
    n: 2,
    xFields: [
      { i: 0, c: -GAMMA },
      { i: 1, c: -GAMMA },
    ],
    zFields: [
      { i: 0, c: p[0] },
      { i: 1, c: p[1] },
    ],
    pairs: [{ i: 0, j: 1, kappa, zz: w }],
  };
}

function verdictCell(terms: ElementTerms, label: string): {
  label: string;
  verdict: ElementDecision["verdict"];
  vacuous: boolean;
  bestMax: number;
  margin: number | null;
  referee: string;
  ms: number;
} {
  const t0 = Date.now();
  const dec = decideElementDesignable(terms, { pairGrid: 360, seed: SEED, starts: 400 });
  const ms = Date.now() - t0;
  if (dec.verdict === "YES" && dec.certificate) {
    const v = verifyElementCertificate(terms, dec.certificate);
    if (!v.accepted) throw new Error(`exp6: certificate failed verification for ${label}`);
  }
  return {
    label,
    verdict: dec.verdict,
    vacuous: dec.vacuous,
    bestMax: dec.bestMax,
    margin: dec.noGo ? dec.noGo.margin : null,
    referee: dec.denseReferee,
    ms,
  };
}

export function main(): void {
  // ---- Part A: 两比特相图 ------------------------------------------------
  const kappas = [0.25, 0.5, 1.0, 2.0, 4.0];
  const ws = [0, 0.25, 1.0, 4.0];
  const partA: Array<ReturnType<typeof verdictCell> & { kappa: number; w: number; p: string; theorem: string }> = [];
  for (const p of ["0", "0.5/0.7"] as const) {
    const pv: [number, number] = p === "0" ? [0, 0] : [0.5, 0.7];
    for (const kappa of kappas) {
      for (const w of ws) {
        const cell = verdictCell(uniformPair(kappa, w, pv), `k=${kappa},w=${w},p=${p}`);
        let theorem = "—";
        if (w === 0 && pv[0] === 0 && pv[1] === 0) {
          const d = uniformPairDichotomy(GAMMA, kappa);
          theorem = d.nonVacuousDesignable ? "nv-designable (kappa<=Gamma)" : "only vacuous";
          if (!d.nonVacuousDesignable) {
            const gc = dichotomyGridCheck(GAMMA, kappa, 120);
            theorem += gc.holds ? " [grid-verified]" : " [GRID CHECK FAILED]";
          }
        }
        partA.push({ ...cell, kappa, w, p, theorem });
      }
    }
  }

  // ---- Part B: 图族判例 --------------------------------------------------
  interface FamilyRow {
    family: string;
    n: number;
    edges: number;
    element: ElementDecision["verdict"];
    vacuous: boolean;
    bestMax: number;
    margin: number | null;
    gaugeDesignable: boolean;
    pComp: number | null;
    pRotated: number | null;
    ms: number;
  }
  const families: Array<{ family: string; terms: ElementTerms; referee: boolean; pDense: boolean }> = [];

  // B1: 开链 n=8，κ=0.5，AF ZZ（w=−1），无 Z 场——反射规范可染色（链二部）
  families.push({
    family: "chain n=8, kappa=0.5, w=-1",
    terms: {
      n: 8,
      xFields: Array.from({ length: 8 }, (_, i) => ({ i, c: -GAMMA })),
      zFields: [],
      pairs: Array.from({ length: 7 }, (_, i) => ({ i, j: i + 1, kappa: 0.5, zz: -1 })),
    },
    referee: true,
    pDense: true,
  });
  // B2: 奇环 n=7，κ=0.5，w=+1（奇数条 w>0 边 ⟹ 反射规范受挫环）
  families.push({
    family: "odd ring n=7, kappa=0.5, w=+1",
    terms: {
      n: 7,
      xFields: Array.from({ length: 7 }, (_, i) => ({ i, c: -GAMMA })),
      zFields: [],
      pairs: Array.from({ length: 7 }, (_, i) => ({ i, j: (i + 1) % 7, kappa: 0.5, zz: 1 })),
    },
    referee: true,
    pDense: true,
  });
  // B3/B4: exp1 随机 3 度图族（s=0.5 点）：κ=0.5 与 κ=0.05
  for (const kappa of [0.5, 0.05]) {
    const model = randomIsing(new Rng(20260905 + 6), 6);
    const s = 0.5;
    families.push({
      family: `exp1-family n=6, kappa=${kappa}, s=0.5`,
      terms: {
        n: 6,
        xFields: Array.from({ length: 6 }, (_, i) => ({ i, c: -(1 - s) })),
        zFields: model.fields.map((h, i) => ({ i, c: -s * h })),
        pairs: model.couplings.map((c) => ({ i: c.j, j: c.k, kappa, zz: -s * c.w })),
      },
      referee: true,
      pDense: true,
    });
  }
  // B5: 完全图 K4，κ=0.5，w 混号（种子化）——三角形受挫源
  {
    const rng = new Rng(SEED);
    families.push({
      family: "K4 n=4, kappa=0.5, w mixed",
      terms: {
        n: 4,
        xFields: Array.from({ length: 4 }, (_, i) => ({ i, c: -GAMMA })),
        zFields: [],
        pairs: [
          { i: 0, j: 1, kappa: 0.5, zz: rng.range(-1, 1) },
          { i: 0, j: 2, kappa: 0.5, zz: rng.range(-1, 1) },
          { i: 0, j: 3, kappa: 0.5, zz: rng.range(-1, 1) },
          { i: 1, j: 2, kappa: 0.5, zz: rng.range(-1, 1) },
          { i: 1, j: 3, kappa: 0.5, zz: rng.range(-1, 1) },
          { i: 2, j: 3, kappa: 0.5, zz: rng.range(-1, 1) },
        ],
      },
      referee: true,
      pDense: true,
    });
  }

  const partB: FamilyRow[] = [];
  for (const fam of families) {
    const t0 = Date.now();
    const dec = decideElementDesignable(fam.terms, { pairGrid: 360, seed: SEED });
    const ms = Date.now() - t0;
    if (dec.verdict === "YES" && dec.certificate) {
      const v = verifyElementCertificate(fam.terms, dec.certificate);
      if (!v.accepted) throw new Error(`exp6: certificate failed verification for ${fam.family}`);
    }
    const gauge = diagonalGaugeVerdict(fam.terms);
    let pComp: number | null = null;
    let pRotated: number | null = null;
    if (fam.pDense) {
      pComp = denseGroundStateSignRatio(denseRotatedMatrix(fam.terms, identityRot(fam.terms.n)));
      if (dec.certificate) {
        pRotated = denseGroundStateSignRatio(denseRotatedMatrix(fam.terms, dec.certificate));
      }
    }
    partB.push({
      family: fam.family,
      n: fam.terms.n,
      edges: fam.terms.pairs.length,
      element: dec.verdict,
      vacuous: dec.vacuous,
      bestMax: dec.bestMax,
      margin: dec.noGo ? dec.noGo.margin : null,
      gaugeDesignable: gauge,
      pComp,
      pRotated,
      ms,
    });
  }

  // ---- Part C: 规模（n=64 链，公式路径）---------------------------------
  const t0c = Date.now();
  const chain64: ElementTerms = {
    n: 64,
    xFields: Array.from({ length: 64 }, (_, i) => ({ i, c: -GAMMA })),
    zFields: Array.from({ length: 64 }, (_, i) => ({ i, c: -0.5 * (0.3 - 0.01 * (i % 5)) })),
    pairs: Array.from({ length: 63 }, (_, i) => ({
      i,
      j: i + 1,
      kappa: 0.25,
      zz: -0.5 * (0.4 - 0.02 * (i % 4)),
    })),
  };
  const dec64 = decideElementDesignable(chain64, { denseRefereeMax: 0, pairMaxEdges: 63, starts: 12, seed: SEED });
  const msC = Date.now() - t0c;

  // ---- 报告 --------------------------------------------------------------
  const yesA = partA.filter((r) => r.verdict === "YES");
  const noA = partA.filter((r) => r.verdict === "NO");
  const unresA = partA.filter((r) => r.verdict === "UNRESOLVED");
  const nvYes = partA.filter((r) => r.verdict === "YES" && !r.vacuous);
  const vacOnly = partA.filter((r) => r.verdict === "YES" && r.vacuous);

  const payload = {
    experiment: "exp6-element-designability",
    seed: SEED,
    gamma: GAMMA,
    partA,
    partB,
    partC: {
      family: "chain n=64, kappa=0.25, w mixed",
      verdict: dec64.verdict,
      vacuous: dec64.vacuous,
      bestMax: dec64.bestMax,
      ms: msC,
      method: dec64.method,
    },
    summary: {
      twoQubitCells: partA.length,
      yes: yesA.length,
      yesNonVacuous: nvYes.length,
      yesVacuousOnly: vacOnly.length,
      certifiedNo: noA.length,
      unresolved: unresA.length,
    },
  };

  const lines: string[] = [
    "# Experiment 6 — Element-level de-signing decidability",
    "",
    "Decision problem: does ANY single-qubit real-orthogonal basis change make every",
    "off-diagonal element of the +kappa XX driver family (plus ZZ part and Z fields)",
    "non-positive? Verdicts carry certificates: YES = explicit angles re-verified by the",
    "exact element formulas (+ dense 2^n referee at small n); NO = isolated-pair",
    "relaxation + Lipschitz margin (relaxation-infeasible PROVES infeasibility);",
    "UNRESOLVED = honest gap between search upper bound and certificate resolution.",
    "Regenerate with `npm run repro`.",
    "",
    "## Part A — two-qubit uniform-field phase diagram (Gamma = 1)",
    "",
    "| kappa | w | p_Z | verdict | vacuous | best max-elem | no-go margin | theorem |",
    "|---|---|---|---|---|---|---|---|",
    ...partA.map(
      (r) =>
        `| ${r.kappa} | ${r.w} | ${r.p} | ${r.verdict} | ${r.vacuous ? "YES" : "no"} | ${fmt(r.bestMax, 4)} | ${r.margin === null ? "—" : fmt(r.margin, 4)} | ${r.theorem} |`,
    ),
    "",
    `Dichotomy readout: ${nvYes.length} cells YES non-vacuous, ${vacOnly.length} YES only-vacuous,`,
    `${noA.length} certified NO, ${unresA.length} UNRESOLVED. w=0 row: non-trivial de-signing exists`,
    `iff kappa <= Gamma (closed-form theorem, grid machine-check on the NO side).`,
    `Any w != 0 with p_Z = 0: YES non-vacuous at EVERY kappa (reflection-gauge X-basis`,
    `construction) — the single-edge sign barrier is an artifact of the w=0, p=0 slice.`,
    `Certified NO requires Z-field pins that frustrate the reflection gauge (k=2, w=1,`,
    `p=0.5/0.7 class).`,
    "",
    "## Part B — graph families (element verdict vs diagonal gauge vs sign metric)",
    "",
    "| family | n | edges | element | vacuous | best | margin | diag-gauge | P(comp) | P(rotated) |",
    "|---|---|---|---|---|---|---|---|---|---|",
    ...partB.map(
      (r) =>
        `| ${r.family} | ${r.n} | ${r.edges} | ${r.element} | ${r.vacuous ? "YES" : "no"} | ${fmt(r.bestMax, 4)} | ${r.margin === null ? "—" : fmt(r.margin, 4)} | ${r.gaugeDesignable ? "designable" : "NO"} | ${r.pComp === null ? "—" : fmt(r.pComp, 4)} | ${r.pRotated === null ? "—" : fmt(r.pRotated, 4)} |`,
    ),
    "",
    "P(comp) = ground-state sign ratio in the computational basis (the metric of exp1);",
    "P(rotated) = same ratio in the certified de-signed basis. Non-vacuous YES",
    "certificates recover P(rotated) = 1 (to degeneracy-limited precision when the",
    "certificate sits exactly at the zero boundary) — Perron-Frobenius re-verified",
    "THROUGH the decision layer — while P(comp) reflects the hardware readout basis:",
    "de-signing moves the sign structure out of it, it does not remove it there.",
    "PF is one-directional: P(comp) = 1 does not certify stoquasticity (the k=0.5,",
    "w=0.3 cell is non-stoquastic with positive ground state); P(comp) ~ 0 marks the",
    "barrier as measured in exp1.",
    "",
    "## Part C — scale",
    "",
    `- chain n=64, kappa=0.25, mixed w and Z fields: **${dec64.verdict}** (vacuous=${dec64.vacuous},`,
    `  best max-elem ${fmt(dec64.bestMax, 4)}, ${msC} ms, formulas path only) — the decision`,
    "  layer runs at DMRG scale via the O(n+|E|) exact element formulas.",
    "",
  ];

  writeReport("exp6-designability", payload, lines.join("\n"));
}

// entry-guard law: imports never render
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
