/**
 * R21 batch-2 pi — F16 (tilted-spectrum three-term recurrence / Sturm)
 * spec-as-hypothesis machine verification. Throwaway, NOT part of any gate.
 * run: npx tsx tmp/r21p-verify-vacuum.ts
 */
import { eigHermitian, cmatMul, cmatAdjoint, type CMat } from "../vacuum-compiler/src/core/cmat.js";
import { assemble, buildDressing } from "../vacuum-compiler/src/compile/hamiltonian.js";
import { program, randomCircuit } from "../vacuum-compiler/src/compile/circuit.js";
import { Rng } from "../vacuum-compiler/src/compile/rng.js";

// ---- exact rational helpers (prototype of the kernel; gcd-reduced) ----
type Q = { num: bigint; den: bigint };
const bigAbs = (a: bigint): bigint => (a < 0n ? -a : a);
const bigGcd = (a: bigint, b: bigint): bigint => {
  let x = bigAbs(a), y = bigAbs(b);
  while (y !== 0n) { const t = x % y; x = y; y = t; }
  return x;
};
function qNorm(r: Q): Q {
  if (r.den < 0n) return { num: -r.num, den: -r.den };
  const g = bigGcd(r.num, r.den) || 1n;
  return { num: r.num / g, den: r.den / g };
}
const qAdd = (a: Q, b: Q): Q => qNorm({ num: a.num * b.den + b.num * a.den, den: a.den * b.den });
const qMul = (a: Q, b: Q): Q => qNorm({ num: a.num * b.num, den: a.den * b.den });
const qNeg = (a: Q): Q => ({ num: -a.num, den: a.den });
const qSub = (a: Q, b: Q): Q => qAdd(a, qNeg(b));
const qCmp = (a: Q, b: Q): number => (a.num * b.den < b.num * a.den ? -1 : a.num * b.den > b.num * a.den ? 1 : 0);
const qOf = (n: bigint, d: bigint): Q => qNorm({ num: n, den: d });
const qF = (q: Q): number => Number(q.num) / Number(q.den);
const ZERO = qOf(0n, 1n), ONE = qOf(1n, 1n);

type Poly = Q[]; // coefficients, index = power
const polyTrim = (p: Poly): Poly => { const o = [...p]; while (o.length > 1 && o[o.length - 1]!.num === 0n) o.pop(); return o; };
const polyScale = (p: Poly, c: Q): Poly => p.map((a) => qMul(a, c));
const polyAdd = (a: Poly, b: Poly): Poly => {
  const out: Poly = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) out.push(qAdd(a[i] ?? ZERO, b[i] ?? ZERO));
  return polyTrim(out);
};
const polyMul = (a: Poly, b: Poly): Poly => {
  const out: Poly = Array(a.length + b.length - 1).fill(ZERO);
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) out[i + j] = qAdd(out[i + j]!, qMul(a[i]!, b[j]!));
  return polyTrim(out);
};
const polyEval = (p: Poly, x: Q): Q => { let acc = ZERO; for (let i = p.length - 1; i >= 0; i--) acc = qAdd(qMul(acc, x), p[i]!); return acc; };
const polyDeriv = (p: Poly): Poly => { if (p.length <= 1) return [ZERO]; const o: Poly = []; for (let i = 1; i < p.length; i++) o.push(qMul(p[i]!, qOf(BigInt(i), 1n))); return o; };
function polyRem(a: Poly, b: Poly): Poly {
  const r = [...a];
  const db = b.length - 1;
  const lead = b[db]!;
  while (r.length - 1 >= db && !(r.length === 1 && r[0]!.num === 0n)) {
    const dr = r.length - 1;
    const f = qMul(r[dr]!, qOf(lead.den, lead.num));
    for (let i = 0; i <= db; i++) r[dr - i] = qSub(r[dr - i]!, qMul(f, b[db - i]!));
    while (r.length > 1 && r[r.length - 1]!.num === 0n) r.pop();
  }
  return polyTrim(r);
}
function gcdPolyDeg(a: Poly, b: Poly): number {
  let x = polyTrim(a), y = polyTrim(b);
  while (!(y.length === 1 && y[0]!.num === 0n)) { const r = polyRem(x, y); x = y; y = r; }
  return x.length - 1;
}
const sgn = (v: Q): number => (v.num === 0n ? 0 : v.den < 0n ? (v.num > 0n ? -1 : 1) : v.num > 0n ? 1 : -1);
function sturmChain(p: Poly): Poly[] {
  const seq: Poly[] = [polyTrim(p), polyDeriv(p)];
  for (;;) {
    const prev = seq[seq.length - 2]!, cur = seq[seq.length - 1]!;
    const r = polyRem(prev, cur).map(qNeg);
    if (r.length === 1 && r[0]!.num === 0n) break;
    seq.push(polyTrim(r));
  }
  return seq;
}
function variations(seq: Poly[], x: Q): number {
  let v = 0, last = 0;
  for (const p of seq) { const s = sgn(polyEval(p, x)); if (s === 0) continue; if (last !== 0 && s !== last) v++; last = s; }
  return v;
}
function vAtNegInf(seq: Poly[]): number {
  let v = 0, last = 0;
  for (const p of seq) { const deg = p.length - 1; const s = deg % 2 === 0 ? sgn(p[deg]!) : -sgn(p[deg]!); if (last !== 0 && s !== last) v++; last = s; }
  return v;
}
/** #roots of square-free p in (-inf, x] — valid whether or not p(x) = 0
 * (zero signs are skipped, which lands the root AT x on the counted side). */
function countRootsUpTo(p: Poly, x: Q): number {
  const seq = sturmChain(p);
  return vAtNegInf(seq) - variations(seq, x);
}
function rootsInOpen(p: Poly, a: Q, b: Q): number {
  return countRootsUpTo(p, b) - countRootsUpTo(p, a) - (polyEval(p, b).num === 0n ? 1 : 0);
}
function rootsBelow(p: Poly, x: Q): number {
  return countRootsUpTo(p, x) - (polyEval(p, x).num === 0n ? 1 : 0);
}
/** isolate the idx-th (0-based from bottom) root of square-free p in [lo,hi]
 * to width ~2^-bits by rational bisection (dyadic-midpoint roots handled by
 * the up-to-count convention). */
function isolateRoot(p: Poly, lo: Q, hi: Q, idx: number, bits = 60): Q {
  for (let it = 0; it < bits; it++) {
    const m = qOf(lo.num * hi.den + hi.num * lo.den, lo.den * hi.den * 2n);
    const upTo = countRootsUpTo(p, m);
    if (polyEval(p, m).num === 0n && upTo - 1 === idx) return m;
    if (upTo > idx) hi = m; else lo = m;
  }
  return qOf(lo.num * hi.den + hi.num * lo.den, lo.den * hi.den * 2n);
}

// ---- the Jacobi three-term recurrence ----
function chainDiagonals(T: number, eps: Q, penalty: bigint): Q[] {
  const C = T + 1;
  const d: Q[] = [];
  for (let t = 0; t < C; t++) {
    let a = qOf(t === 0 || t === T ? 1n : 2n, 2n);
    if (t === 0) a = qAdd(a, qOf(penalty, 1n));
    d.push(qSub(a, qOf(eps.num * BigInt(t), eps.den)));
  }
  return d;
}
function jacobiCharPoly(diag: Q[]): Poly {
  let dPrev: Poly = [ONE]; // D_{-1} = 1 (the Jacobi determinant recurrence convention)
  let dCur: Poly = polyAdd([ZERO, ONE], [qNeg(diag[0]!)]);
  for (let t = 1; t < diag.length; t++) {
    const lamMinusA = polyAdd([ZERO, ONE], [qNeg(diag[t]!)]);
    const next = polyAdd(polyMul(lamMinusA, dCur), polyScale(dPrev, qOf(-1n, 4n)));
    dPrev = dCur;
    dCur = next;
  }
  return dCur;
}
function chainFloatMatrix(diag: Q[]): CMat {
  const n = diag.length;
  const m: CMat = { dim: n, re: [], im: [] };
  for (let i = 0; i < n; i++) {
    m.re.push(Array(n).fill(0));
    m.im.push(Array(n).fill(0));
    m.re[i]![i] = qF(diag[i]!);
    if (i > 0) m.re[i]![i - 1] = -0.5;
    if (i < n - 1) m.re[i]![i + 1] = -0.5;
  }
  return m;
}

let failures = 0;
const check = (name: string, ok: boolean, detail = ""): void => {
  if (!ok) failures++;
  console.log(`${ok ? "ok " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

// (0) dressed block structure -------------------------------------------------
for (const T of [4, 6, 8]) {
  const circuit = randomCircuit(2, T, new Rng(400 + T));
  const prog = program(circuit, [0, 1], new Map());
  const comp = assemble(prog, { output: false, epsilon: 0.37 });
  const w = buildDressing(2, circuit.steps);
  const dressed = cmatMul(cmatMul(cmatAdjoint(w), comp.h), w);
  const C = T + 1;
  let dev = 0;
  for (let d = 0; d < 4; d++) {
    const diag = chainDiagonals(T, qOf(37n, 100n), d !== 0 ? 1n : 0n);
    for (let t = 0; t < C; t++) {
      dev = Math.max(dev, Math.abs(dressed.re[d * C + t]![d * C + t]! - qF(diag[t]!)));
      if (t > 0) dev = Math.max(dev, Math.abs(dressed.re[d * C + t]![d * C + t - 1]! + 0.5));
      for (let d2 = 0; d2 < 4; d2++) if (d2 !== d) dev = Math.max(dev, Math.abs(dressed.re[d * C + t]![d2 * C + t]!));
    }
  }
  check(`(0) dressed block structure T=${T}`, dev < 1e-12, `max dev ${dev.toExponential(2)}`);
}

// (1) recurrence vs float eigenvalues, T = 2..12: degree count + per-root
//     bisection boxes from the BigInt layer vs float roots
{
  let allOk = true;
  let worst = 0;
  let detail = "";
  for (let T = 2; T <= 12; T++) {
    const eps: Q = qOf(7n, 25n);
    for (const pen of [0n, 1n]) {
      const diag = chainDiagonals(T, eps, pen);
      const poly = jacobiCharPoly(diag);
      const deg = poly.length - 1;
      const wide = rootsInOpen(poly, qOf(-100000n, 1n), qOf(100000n, 1n));
      if (wide !== deg) { allOk = false; detail = `T=${T} pen=${pen}: Sturm ${wide} != deg ${deg}`; continue; }
      const vals = Array.from(eigHermitian(chainFloatMatrix(diag)).values).sort((a, b) => a - b);
      for (let j = 0; j < deg; j++) {
        const box = isolateRoot(poly, qOf(-100000n, 1n), qOf(100000n, 1n), j, 48);
        const off = Math.abs(qF(box) - (vals[j] as number));
        if (off > worst) worst = off;
        if (off > 1e-9) { allOk = false; detail = `T=${T} pen=${pen} root ${j}: box ${qF(box)} vs float ${vals[j]}`; }
      }
    }
  }
  check("(1) T=2..12 both chains: Sturm degree count + bisection boxes match float roots", allOk, `worst |box-float| ${worst.toExponential(2)} ${detail}`);
}

// (2) simplicity (gcd(p, p') = const) for all T, eps -------------------------
{
  let allOk = true;
  for (let T = 2; T <= 12; T++) for (const pen of [0n, 1n]) {
    const poly = jacobiCharPoly(chainDiagonals(T, qOf(7n, 25n), pen));
    if (gcdPolyDeg(poly, polyDeriv(poly)) !== 0) allOk = false;
  }
  check("(2) all chains square-free (gcd(p,p')=const, spectrum simple)", allOk);
}

// (3) eps = 0 anchor ------------------------------------------------------------
{
  const T = 6;
  const pV = jacobiCharPoly(chainDiagonals(T, ZERO, 0n));
  const pX = jacobiCharPoly(chainDiagonals(T, ZERO, 1n));
  check("(3) eps=0: p_V(0)=0 exact BigInt (history-state zero energy)", polyEval(pV, ZERO).num === 0n);
  // p(0) = det(-M) = (-1)^C det(M): PSD demands det(M_X) = (-1)^C p_X(0) > 0
  const xAt0 = polyEval(pX, ZERO);
  check("(3) eps=0: det(M_X) > 0 (X chain strictly positive at eps=0)", qCmp(qMul(xAt0, T % 2 === 0 ? qOf(-1n, 1n) : ONE), ZERO) > 0, `p_X(0)=${xAt0.num}/${xAt0.den}`);
  check("(3) eps=0: no roots below 0 (PSD both chains)", rootsBelow(pV, ZERO) === 0 && rootsBelow(pX, ZERO) === 0);
  const e1V = isolateRoot(pV, qOf(-1000n, 1n), qOf(1000n, 1n), 1);
  const e0X = isolateRoot(pX, qOf(-1000n, 1n), qOf(1000n, 1n), 0);
  const closed = 1 - Math.cos(Math.PI / 7);
  const gap = Math.min(qF(e1V), qF(e0X));
  check("(3) eps=0 gap = min(1-cos(pi/C), e0X); which side wins recorded", true, `e1V=${qF(e1V).toFixed(9)} (closed ${closed.toFixed(9)}) e0X=${qF(e0X).toFixed(9)} gap=${gap.toFixed(9)}`);
}

// (4) sandwich + monotonicity + gap on the rational grid, census instance ------
{
  const T = 6;
  const circuit = randomCircuit(2, T, new Rng(601));
  const prog = program(circuit, [0, 1], new Map());
  let sandwichOk = true, e0Strict = true, captureStrict = true, gapMono = true;
  let prevE0 = Number.POSITIVE_INFINITY, prevCap = Number.POSITIVE_INFINITY, prevGap = Number.POSITIVE_INFINITY;
  const rows: string[] = [];
  for (let j = 0; j <= 32; j++) {
    const eps = qOf(BigInt(j), 20n);
    const diagV = chainDiagonals(T, eps, 0n);
    const polyV = jacobiCharPoly(diagV);
    const e0Box = isolateRoot(polyV, qOf(-1000n, 1n), qOf(1000n, 1n), 0, 44);
    const e0 = qF(e0Box);
    const lamT = qF(diagV[T]!);
    const loB = qNeg(qOf(eps.num * BigInt(T), eps.den));
    const hiB = qSub(qOf(1n, 2n), qOf(eps.num * BigInt(T), eps.den));
    const pHi = polyEval(polyV, hiB);
    const atMostHi = pHi.num === 0n || rootsBelow(polyV, hiB) >= 1;
    if (rootsBelow(polyV, loB) !== 0 || !atMostHi) sandwichOk = false;
    const full = eigHermitian(assemble(prog, { output: false, epsilon: qF(eps) }).h).values;
    const gapF = (full[1] as number) - (full[0] as number);
    if (e0 >= prevE0 - 1e-12) e0Strict = false;
    const cap = lamT - e0;
    if (cap >= prevCap - 1e-12) captureStrict = false;
    if (gapF > prevGap + 1e-12) gapMono = false;
    rows.push(`eps=${qF(eps).toFixed(2)} E0=${e0.toFixed(9)} a_T-E0=${cap.toFixed(6)} gapF=${gapF.toExponential(6)}`);
    prevE0 = e0; prevCap = cap; prevGap = gapF;
  }
  check("(4) sandwich -epsT <= E0 <= 1/2-epsT (Sturm-certified every grid point)", sandwichOk);
  check("(4) E0 strictly decreasing across grid (boxes)", e0Strict);
  check("(4) a_T - E0 strictly decreasing (T-end capture)", captureStrict);
  check("(4) full-H float gap non-increasing across grid", gapMono);
  console.log(rows.slice(0, 4).join("\n"));
  console.log("...");
  console.log(rows.slice(-2).join("\n"));
}

// (5) certified gap boxes vs float, and the multiset dressing check ------------
{
  const T = 6;
  const circuit = randomCircuit(2, T, new Rng(601));
  const prog = program(circuit, [0, 1], new Map());
  const eps: Q = qOf(7n, 50n);
  const diagV = chainDiagonals(T, eps, 0n), diagX = chainDiagonals(T, eps, 1n);
  const pV = jacobiCharPoly(diagV), pX = jacobiCharPoly(diagX);
  const e0V = isolateRoot(pV, qOf(-1000n, 1n), qOf(1000n, 1n), 0);
  const e1V = isolateRoot(pV, qOf(-1000n, 1n), qOf(1000n, 1n), 1);
  const e0X = isolateRoot(pX, qOf(-1000n, 1n), qOf(1000n, 1n), 0);
  const allF = [
    ...Array.from(eigHermitian(chainFloatMatrix(diagV)).values),
    ...Array.from(eigHermitian(chainFloatMatrix(diagX)).values),
    ...Array.from(eigHermitian(chainFloatMatrix(diagX)).values),
    ...Array.from(eigHermitian(chainFloatMatrix(diagX)).values),
  ].sort((a, b) => a - b);
  const fullF = Array.from(eigHermitian(assemble(prog, { output: false, epsilon: qF(eps) }).h).values).sort((a, b) => a - b);
  let devF = 0;
  for (let i = 0; i < fullF.length; i++) devF = Math.max(devF, Math.abs((allF[i] as number) - (fullF[i] as number)));
  const gapBox = Math.min(qF(e1V), qF(e0X)) - qF(e0V);
  const gapF = (fullF[1] as number) - (fullF[0] as number);
  check("(5) chain multiset == assembled full matrix (dressing identity, 1e-12)", devF < 1e-12, `worst ${devF.toExponential(2)}`);
  check("(5) certified gap box vs float gap (1e-9)", Math.abs(gapBox - gapF) < 1e-9, `box ${gapBox.toFixed(10)} float ${gapF.toFixed(10)}`);
}

console.log(failures === 0 ? "ALL SPEC CHECKS PASSED" : `${failures} FAILURES`);
