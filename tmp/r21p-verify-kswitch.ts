/**
 * R21 batch-2 pi — G6-b (dilution family law D_k, the source of sqrt(10)/6)
 * spec-as-hypothesis machine verification. Throwaway, NOT part of any gate.
 * run: npx tsx tmp/r21p-verify-kswitch.ts
 */
import { cmatZero, cmatMul, cmatDagger, type CMat } from "../k-switch/src/core/cmat.js";
import { X2, Y2, Z2 } from "../k-switch/src/kswitch/promise.js";

// reuse the repo's own kernels (sched3 is the single source)
import { erase, unitaryOnRho, traceDistance, plusPlus } from "../k-switch/src/kswitch/sched3.js";

type Write = "X" | "Z" | "Y" | "H";
const writeOf = (w: Write): CMat | null => (w === "X" ? X2 : w === "Z" ? Z2 : w === "Y" ? Y2 : null);
const applyStage = (w: Write | "E", gamma: number, rho: CMat): CMat => {
  if (w === "E") return erase(gamma, rho);
  const u = writeOf(w);
  if (u === null) {
    // Hadamard: 1/sqrt2 [[1,1],[1,-1]] — only for the negative control
    const h: CMat = { dim: 2, re: [[Math.SQRT1_2, Math.SQRT1_2], [Math.SQRT1_2, -Math.SQRT1_2]], im: [[0, 0], [0, 0]] };
    return unitaryOnRho(h, rho);
  }
  return unitaryOnRho(u, rho);
};

/** all k! orders of k distinct stage slots (writes..., E as stage k-1) */
function permutations(k: number): number[][] {
  const out: number[][] = [];
  const cur: number[] = [];
  const used = Array(k).fill(false);
  const rec = (): void => {
    if (cur.length === k) { out.push([...cur]); return; }
    for (let i = 0; i < k; i++) {
      if (used[i]) continue;
      used[i] = true; cur.push(i);
      rec();
      used[i] = false; cur.pop();
    }
  };
  rec();
  return out;
}

const CYCLE: Write[] = ["X", "Z", "Y"]; // the cycling family writes[j] = CYCLE[j mod 3]

interface ExecutorResult {
  fixedD: number[];          // D per fixed order (all k! of them, slots distinct)
  fixedMaxDev: number;       // max |D - 1/sqrt(2)| over fixed orders (plane family only)
  switchD: number;           // mixture trace distance
  gamma0Dispersion: number;  // max pairwise trace distance among gamma=0 branch outputs
  gamma1Distinct: number;    // number of distinct gamma=1 branch density matrices (<=2 expected)
  counts: [number, number];  // [#branches ending |0><0|, #branches ending |1><1|] (gamma=1)
}

function execute(writes: Write[]): ExecutorResult {
  const k = writes.length + 1;
  const stages: (Write | "E")[] = [...writes, "E"];
  const outs = (gamma: number, order: readonly number[]): CMat => {
    let rho = plusPlus();
    for (const s of order) rho = applyStage(stages[s] as Write | "E", gamma, rho);
    return rho;
  };
  const orders = permutations(k);
  const fixedD = orders.map((o) => traceDistance(outs(1, o), outs(0, o)));
  const fixedMaxDev = Math.max(...fixedD.map((d) => Math.abs(d - Math.SQRT1_2)));
  // gamma=0 dispersion
  const z = orders.map((o) => outs(0, o));
  let disp = 0;
  for (let a = 0; a < z.length; a++) for (let b = a + 1; b < z.length; b++) disp = Math.max(disp, traceDistance(z[a]!, z[b]!));
  // gamma=1 census
  let n0 = 0, n1 = 0, distinct = 0;
  const seen: CMat[] = [];
  for (const o of orders) {
    const o1 = outs(1, o);
    const isOne = Math.abs(o1.re[1]![1]! - 1) < 1e-12;
    if (isOne) n1++; else n0++;
    if (!seen.some((s) => traceDistance(s, o1) < 1e-12)) { seen.push(o1); distinct++; }
  }
  const mix = (gamma: number): CMat => {
    const m = cmatZero(2);
    for (const o of orders) {
      const out = outs(gamma, o);
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
        m.re[i]![j] = m.re[i]![j]! + out.re[i]![j]! / orders.length;
        m.im[i]![j] = m.im[i]![j]! + out.im[i]![j]! / orders.length;
      }
    }
    return m;
  };
  return { fixedD, fixedMaxDev, switchD: traceDistance(mix(1), mix(0)), gamma0Dispersion: disp, gamma1Distinct: distinct, counts: [n0, n1] };
}

// ---- closed form ----
const bigFact = (n: number): bigint => { let r = 1n; for (let i = 2n; i <= BigInt(n); i++) r *= i; return r; };
const bigBinom = (n: number, kk: number): bigint => {
  if (kk < 0 || kk > n) return 0n;
  let r = 1n;
  for (let i = 0; i < kk; i++) r = (r * BigInt(n - i)) / BigInt(i + 1);
  return r;
};
function closedForm(writes: Write[]): { q: number; N1: bigint; kfact: bigint; F: number; K: number; D: number } {
  const k = writes.length + 1;
  const F = writes.filter((w) => w === "X" || w === "Y").length;
  const K = writes.filter((w) => w === "Z").length;
  let N1 = 0n;
  for (let s = 0; s <= k - 1; s++) {
    let O = 0n;
    for (let f = 1; f <= Math.min(F, s); f += 2) O += bigBinom(F, f) * bigBinom(K, s - f);
    N1 += bigFact(s) * bigFact(k - 1 - s) * O;
  }
  const kf = bigFact(k);
  const q = Number(N1) / Number(kf);
  return { q, N1, kfact: kf, F, K, D: Math.sqrt(0.25 + (q - 0.5) ** 2) };
}

let failures = 0;
const check = (name: string, ok: boolean, detail = ""): void => {
  if (!ok) failures++;
  console.log(`${ok ? "ok " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const FAMILIES: ReadonlyArray<{ label: string; writes: Write[] }> = [
  { label: "k=2 [X]", writes: ["X"] },
  { label: "k=3 [X,Z]", writes: ["X", "Z"] },
  { label: "k=4 [X,Z,Y]", writes: ["X", "Z", "Y"] },
  { label: "k=5 cycling [X,Z,Y,X]", writes: ["X", "Z", "Y", "X"] },
  { label: "k=5 alt [X,Z,Y,Z]", writes: ["X", "Z", "Y", "Z"] },
];

for (const fam of FAMILIES) {
  const ex = execute(fam.writes);
  const cf = closedForm(fam.writes);
  check(`${fam.label}: executor switchD == closed form D (1e-12)`, Math.abs(ex.switchD - cf.D) < 1e-12, `exec ${ex.switchD.toFixed(12)} closed ${cf.D.toFixed(12)}`);
  check(`${fam.label}: all fixed orders D = 1/sqrt(2) exactly`, ex.fixedMaxDev < 1e-12, `max dev ${ex.fixedMaxDev.toExponential(2)}`);
  check(`${fam.label}: gamma=0 branches all ONE ray (dispersion 0)`, ex.gamma0Dispersion < 1e-12, `disp ${ex.gamma0Dispersion.toExponential(2)}`);
  check(`${fam.label}: gamma=1 branches exactly 2 distinct outputs with counts [N0,N1] = closed`, ex.gamma1Distinct === 2 && ex.counts[0] + ex.counts[1] === bigFactSafe(fam.writes.length + 1) && BigInt(ex.counts[1]) === cf.N1, `counts ${ex.counts} vs N1 ${cf.N1}/${cf.kfact}`);
  const exchangers = fam.writes.filter((w) => w === "Z" || w === "Y").length;
  console.log(`     q=${cf.q.toFixed(9)} D=${cf.D.toFixed(12)} F=${cf.F} K=${cf.K} exchangers=${exchangers} (${exchangers % 2 === 0 ? "|+> ray" : "|-> ray"})`);
}
function bigFactSafe(n: number): number { return Number(bigFact(n)); }

// anchors
{
  const cf3 = closedForm(["X", "Z"]);
  const cf4 = closedForm(["X", "Z", "Y"]);
  check("anchor k=3 switch D = 1/2 (halving of 1/sqrt2)", Math.abs(cf3.D - 0.5) < 1e-15);
  check("anchor k=4 switch D = sqrt(10)/6 exactly", cf4.D === Math.sqrt(10) / 6 || Math.abs(cf4.D - Math.sqrt(10) / 6) < 1e-15, `D=${cf4.D}`);
  check("k=4 dilution ratio = sqrt(5)/3", Math.abs(cf4.D * Math.SQRT2 - Math.sqrt(5) / 3) < 1e-15);
}

// F-odd lemma: F odd => q = 1/2 exactly (complement bijection)
{
  const oddFamilies: Write[][] = [["X"], ["X", "Z"], ["Y"], ["Y", "X", "Y"], ["X", "Z", "Y", "X"], ["X", "Z", "Y", "Y"], ["X", "X", "X"], ["Y", "Z", "Z"], ["X", "Y", "X", "Y", "X"]];
  let allOk = true;
  for (const w of oddFamilies) {
    const cf = closedForm(w);
    if (cf.F % 2 !== 1 || 2n * cf.N1 !== cf.kfact) allOk = false;
  }
  check("F-odd lemma: F odd => N1 = k!/2 exactly (all sampled multiset families)", allOk);
}

// even-F data: q != 1/2 in general (k=4 and k=5-Z are 1/3)
{
  const cf4 = closedForm(["X", "Z", "Y"]);
  const cf5z = closedForm(["X", "Z", "Y", "Z"]);
  check("even-F data: k=4 q = 1/3, k=5-Z q = 1/3 (the halving break quantified)", 3n * cf4.N1 === cf4.kfact && 3n * cf5z.N1 === cf5z.kfact, `q4=${cf4.q} q5z=${cf5z.q}`);
}

// closed-form-only table k = 2..9 (cycling family)
{
  console.log("cycling-family table (closed form only):");
  for (let k = 2; k <= 9; k++) {
    const writes: Write[] = [];
    for (let j = 0; j < k - 1; j++) writes.push(CYCLE[j % 3] as Write);
    const cf = closedForm(writes);
    console.log(`  k=${k} writes=[${writes.join(",")}] F=${cf.F} K=${cf.K} q=${cf.q.toFixed(9)} D=${cf.D.toFixed(12)} ratio=${(cf.D * Math.SQRT2).toFixed(6)}`);
  }
}

// negative control: H write breaks the plane family
{
  const ex = execute(["X", "H"] as Write[]);
  check("negative control: an H write disperses gamma=0 branches (family assumption named)", ex.gamma0Dispersion > 1e-6, `disp ${ex.gamma0Dispersion.toFixed(6)}`);
  const exFixed = Math.max(...ex.fixedD.map((d) => Math.abs(d - Math.SQRT1_2)));
  check("negative control: with H, fixed orders leave the 1/sqrt(2) wall", exFixed > 1e-6, `max dev ${exFixed.toFixed(6)}`);
}

// sanity: the gamma=0 ray for k=4 is |+> (parity of exchangers = 2): report
{
  const ex = execute(["X", "Z", "Y"]);
  const stages: (Write | "E")[] = ["X", "Z", "Y", "E"];
  const o = [0, 1, 2, 3];
  let rho = plusPlus();
  for (const s of o) rho = applyStage(stages[s] as Write | "E", 0, rho);
  console.log(`gamma=0 single-branch k=4 (order X,Z,Y,E): [[${rho.re[0]![0]!.toFixed(6)}, ${rho.re[0]![1]!.toFixed(6)}], [${rho.re[1]![0]!.toFixed(6)}, ${rho.re[1]![1]!.toFixed(6)}]] (|+> has 0.5 off-diagonal, |-> has -0.5)`);
  void ex;
}

console.log(failures === 0 ? "ALL SPEC CHECKS PASSED" : `${failures} FAILURES`);
