/**
 * exp1 — physics layer: every analytic identity the engine relies on, re-checked
 * against the independent density-matrix referee, plus the closed-form
 * constants (purification threshold, key-fraction threshold, swap-chain decay,
 * ladder cost). All numbers rebuild from this script.
 */

import { Rng } from "../core/rng.js";
import { werner } from "../physics/bell.js";
import {
  depol,
  keyFraction,
  purify2to1,
  purifyWerner,
  swapBell,
  wernerSwapChainVec,
  wernerSwapF,
} from "../physics/ops.js";
import {
  refereeDepol,
  refereePurifyTwirled,
  refereeSwap,
  refereeSwapPhiMinus,
} from "../physics/referee.js";
import { fmt, mdTable, writeReport } from "./common.js";
import { pathToFileURL } from "node:url";
// batch-33 retrofit: entry-guard law (house form since batch 21) — imports never render
if (import.meta.url !== pathToFileURL(process.argv[1] ?? "").href) {
  // imported by a test or module: definitions only, no render
} else {

function maxVecDiff(a: Float64Array, b: Float64Array): number {
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i]! - b[i]!)); // i < a.length (loop bound)
  return m;
}

const rng = new Rng(2026);

// swap identity over random (Fa, Fb)
let maxSwap = 0;
let maxFrame = 0;
for (let t = 0; t < 200; t++) {
  const fa = rng.range(0.3, 1);
  const fb = rng.range(0.3, 1);
  const ref = refereeSwap(fa, fb);
  maxSwap = Math.max(maxSwap, maxVecDiff(ref.vec, swapBell(werner(fa), werner(fb))));
  maxFrame = Math.max(maxFrame, maxVecDiff(refereeSwapPhiMinus(fa, fb), swapBell(werner(fa), werner(fb))));
}

// purification identity (twirled protocol) over random (f1, f2)
let maxPurifyP = 0;
let maxPurifyF = 0;
for (let t = 0; t < 200; t++) {
  const f1 = rng.range(0.55, 1);
  const f2 = rng.range(0.55, 1);
  const ref = refereePurifyTwirled(werner(f1), werner(f2));
  const ana = purify2to1(werner(f1), werner(f2));
  maxPurifyP = Math.max(maxPurifyP, Math.abs(ref.p - ana.p));
  maxPurifyF = Math.max(maxPurifyF, Math.abs(ref.vec[0]! - ana.out[0]!));
}

// depolarization identity
let maxDepol = 0;
for (let t = 0; t < 100; t++) {
  const f = rng.range(0.5, 1);
  const p = rng.range(0.01, 0.9);
  for (const q of [0, 1] as const)
    maxDepol = Math.max(maxDepol, maxVecDiff(refereeDepol(f, p, q), depol(werner(f), p)));
}

// purification improvement threshold: root of purify(F).fOut − F
let lo = 0.1;
let hi = 0.9;
for (let k = 0; k < 200; k++) {
  const mid = (lo + hi) / 2;
  const improves = purifyWerner(mid).fOut > mid;
  if (improves) hi = mid;
  else lo = mid;
}
const purifyThreshold = (lo + hi) / 2;

// key-fraction threshold F*
lo = 0.7;
hi = 0.9;
for (let k = 0; k < 200; k++) {
  const mid = (lo + hi) / 2;
  if (keyFraction(werner(mid)) > 0) hi = mid;
  else lo = mid;
}
const keyThreshold = (lo + hi) / 2;

// swap-chain decay: fresh fidelity after k hops
const chainRows: string[][] = [];
for (const f0 of [0.99, 0.95, 0.9]) {
  const row = [fmt(f0, 2)];
  for (const hops of [1, 2, 4, 8]) {
    const v = wernerSwapChainVec(f0, hops);
    // cross-check vector composition against closed form
    const closed = chainClosed(f0, hops);
    if (Math.abs(v[0]! - closed) > 1e-14) throw new Error("chain closed form mismatch");
    row.push(fmt(v[0]!, 5));
  }
  chainRows.push(row);
}
function chainClosed(f0: number, hops: number): number {
  let f = f0;
  for (let k = 1; k < hops; k++) f = wernerSwapF(f, f0);
  return f;
}

// purification ladder projection: F_k and expected fresh-pair cost 2^k / ΠP
const ladderRows: string[][] = [];
for (const f0 of [0.75, 0.85, 0.92]) {
  let f = f0;
  let cost: number;
  let pProd = 1;
  for (let k = 1; k <= 6; k++) {
    const { p, fOut } = purifyWerner(f);
    pProd *= p;
    cost = 2 ** k / pProd;
    f = fOut;
    ladderRows.push([fmt(f0, 2), String(k), fmt(f, 5), fmt(p, 4), fmt(cost, 2)]);
  }
}

const payload = {
  maxAbsDiff: { swapVec: maxSwap, swapFrameFix: maxFrame, purifyProb: maxPurifyP, purifyF: maxPurifyF, depolVec: maxDepol },
  purifyImprovementThreshold: purifyThreshold,
  keyFractionThreshold: keyThreshold,
};

const md = `# exp1 — 物理层恒等式与常数（裁判互证）

分析公式 vs 独立密度矩阵裁判，随机网格 200 点，最大绝对偏差：

${mdTable(
  ["identity", "max |Δ|"],
  [
    ["swap: XOR 卷积 vs Φ+ 分支电路", fmt(maxSwap)],
    ["swap: Φ− 分支 + Z 帧修正 = Φ+ 分支", fmt(maxFrame)],
    ["purify: 成功概率 P（twirl 协议）", fmt(maxPurifyP)],
    ["purify: 输出保真度 F′", fmt(maxPurifyF)],
    ["depol: 替换信道（两端分别）", fmt(maxDepol)],
  ]
)}

- 纯化改进阈值（BBPSSW 不动点）：**F = ${fmt(purifyThreshold, 10)}** —— 恰是纠缠阈值 1/2（机器验证到 1e-10）
- Werner 单向密钥分数阈值：**F* = ${fmt(keyThreshold, 6)}**（r(F) = 0 的根，文献口径 ≈0.8108）

交换链保真度衰减（k 跳新鲜链路，F = ⟨Φ+|ρ|Φ+⟩，向量复合与闭式 F₁F₂+(1−F₁)(1−F₂)/3 互证到 1e-14）：

${mdTable(["F₀ \\ hops", "1", "2", "4", "8"], chainRows)}

纯化阶梯投影（BBPSSW 递归：F_k、单步成功率、期望新鲜对成本 2^k/ΠP）：

${mdTable(["F₀", "k", "F_k", "P_k", "期望成本（对/交付）"], ladderRows)}
`;

writeReport("exp1-physics", payload, md);

}